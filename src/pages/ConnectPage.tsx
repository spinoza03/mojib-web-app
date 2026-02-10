import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Smartphone, QrCode, CheckCircle2, RefreshCw, Timer, XCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

const WAHA_URL = 'https://waha.mojib.online';
const API_KEY = 'my-secret-key';
const REFRESH_INTERVAL = 20;

export default function ConnectPage() {
	const { user, isSubscriptionExpired } = useAuth();
	const { toast } = useToast();

	const [status, setStatus] = useState<'disconnected' | 'scanning' | 'connected'>('disconnected');
	const [wahaSessionName, setWahaSessionName] = useState<string | null>(null);
	const [qrCode, setQrCode] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [isRefreshing, setIsRefreshing] = useState(false);
	const [timeLeft, setTimeLeft] = useState(REFRESH_INTERVAL);

	// ------------------------------------------------------------------
	// 1. STATUS SYNC & NUMBER CAPTURE (The Brain)
	// ------------------------------------------------------------------
	useEffect(() => {
		async function checkRealStatus() {
			if (!user) return;

			const { data: profile } = await supabase
				.from('profiles')
				.select('whatsapp_status, waha_session_name')
				.eq('id', user.id)
				.maybeSingle();

			if (!profile) return;

			const dbStatus = profile.whatsapp_status as any;
			const sessionName = profile.waha_session_name;
			setWahaSessionName(sessionName);

			if (sessionName) {
				try {
					const response = await fetch(`${WAHA_URL}/api/sessions/${sessionName}`, {
						method: 'GET',
						headers: { 'X-Api-Key': API_KEY }
					});

					if (response.ok) {
						const wahaData = await response.json();
						const realStatus = wahaData.status;

						// --- DETECT SUCCESSFUL CONNECTION ---
						if (realStatus === 'WORKING' && dbStatus !== 'connected') {
							setStatus('connected');

							// 1. Fetch the REAL connected number
							const meResponse = await fetch(`${WAHA_URL}/api/sessions/${sessionName}/me`, {
								headers: { 'X-Api-Key': API_KEY }
							});

							let realPhoneNumber = null;
							if (meResponse.ok) {
								const meData = await meResponse.json();
								// Format is usually "212600000000@c.us" -> We want "212600000000"
								if (meData?.id) {
									realPhoneNumber = meData.id.split('@')[0];
								}
							}

							// Check for duplicate phone number
							if (realPhoneNumber) {
								const { data: duplicateUser } = await supabase
									.from('profiles')
									.select('id')
									.eq('phone', realPhoneNumber)
									.neq('id', user.id)
									.maybeSingle();

								if (duplicateUser) {
									toast({
										variant: "destructive",
										title: "Duplicate Number",
										description: "This number is already linked to another account. Please disconnect it from the old account first."
									});
									await handleCancel();
									return;
								}
							}

							// 2. Update DB with 'connected' AND the Real Phone Number
							const updateData: any = { whatsapp_status: 'connected' };
							if (realPhoneNumber) {
								updateData.phone = realPhoneNumber; // <--- SAVING THE SCANNED NUMBER HERE
							}

							await supabase.from('profiles').update(updateData).eq('id', user.id);

							toast({ title: "Connected!", description: `Linked to +${realPhoneNumber || 'WhatsApp'}` });
							return;
						}

						if (realStatus === 'STOPPED' && dbStatus === 'scanning') {
							// Optional: Handle timeout
						}
					}
				} catch (e) {
					console.error("WAHA Check failed", e);
				}
			}

			if (dbStatus) setStatus(dbStatus);
		}

		checkRealStatus();
		const interval = setInterval(checkRealStatus, 5000);
		return () => clearInterval(interval);
	}, [user]);


	// ------------------------------------------------------------------
	// 2. QR FETCH LOGIC
	// ------------------------------------------------------------------
	const fetchQR = useCallback(async () => {
		if (isSubscriptionExpired || !wahaSessionName || status !== 'scanning') return;

		setIsRefreshing(true);
		try {
			const response = await fetch(`${WAHA_URL}/api/${wahaSessionName}/auth/qr?format=image`, {
				method: 'GET',
				headers: {
					'X-Api-Key': API_KEY,
					'Accept': 'application/json',
				},
			});

			if (!response.ok) {
				if (response.status === 400 || response.status === 409) return;
				throw new Error('QR Fetch Failed');
			}

			const data = await response.json();
			if (data?.data && data?.mimetype) {
				const src = data.data.startsWith('data:')
					? data.data
					: `data:${data.mimetype};base64,${data.data}`;
				setQrCode(src);
			}
		} catch (err) {
			console.error('QR Fetch Error:', err);
		} finally {
			setIsRefreshing(false);
		}
	}, [wahaSessionName, isSubscriptionExpired, status]);


	// ------------------------------------------------------------------
	// 3. COUNTDOWN TIMER
	// ------------------------------------------------------------------
	useEffect(() => {
		let timer: NodeJS.Timeout;

		if (status === 'scanning') {
			if (!qrCode) fetchQR();

			timer = setInterval(() => {
				setTimeLeft((prev) => {
					if (prev <= 1) {
						fetchQR();
						return REFRESH_INTERVAL;
					}
					return prev - 1;
				});
			}, 1000);
		} else {
			setTimeLeft(REFRESH_INTERVAL);
		}

		return () => clearInterval(timer);
	}, [status, fetchQR, qrCode]);


	// ------------------------------------------------------------------
	// 4. ACTION HANDLERS
	// ------------------------------------------------------------------

	const handleStartSession = async () => {
		if (isSubscriptionExpired || !wahaSessionName) return;

		setIsLoading(true);
		try {
			// Check if already running
			const checkParams = new URLSearchParams({ all: 'true' });
			const checkRes = await fetch(`${WAHA_URL}/api/sessions?${checkParams}`, {
				headers: { 'X-Api-Key': API_KEY }
			});
			const sessions = await checkRes.json();
			const existing = sessions.find((s: any) => s.name === wahaSessionName);

			if (existing && existing.status === 'WORKING') {
				setStatus('connected');
				await supabase.from('profiles').update({ whatsapp_status: 'connected' }).eq('id', user?.id);
				toast({ title: "Already Linked", description: "System is already online." });
				setIsLoading(false);
				return;
			}

			// Start Session
			await fetch(`${WAHA_URL}/api/sessions`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'X-Api-Key': API_KEY
				},
				body: JSON.stringify({
					name: wahaSessionName,
					config: { proxy: null, debug: false }
				})
			});

			await supabase.from('profiles').update({ whatsapp_status: 'scanning' }).eq('id', user?.id);

			setStatus('scanning');
			fetchQR();

		} catch (error) {
			console.error("Start error:", error);
			toast({ variant: "destructive", title: "Connection Failed", description: "Could not reach WhatsApp server." });
		} finally {
			setIsLoading(false);
		}
	};

	const handleCancel = async () => {
		setStatus('disconnected');
		setQrCode(null);
		setTimeLeft(REFRESH_INTERVAL);

		if (user?.id) {
			await supabase.from('profiles').update({
				whatsapp_status: 'disconnected',
				phone: null,
				waha_session_name: null
			}).eq('id', user.id);
		}

		if (wahaSessionName) {
			try {
				await fetch(`${WAHA_URL}/api/sessions/${wahaSessionName}`, {
					method: 'DELETE',
					headers: { 'X-Api-Key': API_KEY }
				});
			} catch (e) { }
		}
	};

	const handleManualRefresh = () => {
		fetchQR();
		setTimeLeft(REFRESH_INTERVAL);
		toast({ description: "Checking for new code..." });
	};

	return (
		<AppLayout>
			<div className="max-w-4xl mx-auto space-y-8">
				<div className="text-center">
					<h1 className="text-3xl font-bold mb-2">WhatsApp Connection</h1>
					<p className="text-muted-foreground">Scan the QR code to link your clinic's WhatsApp.</p>
				</div>

				<Card className="glass-card border-primary/20 overflow-hidden shadow-2xl">
					<CardContent className="p-0">
						<div className="grid md:grid-cols-2 min-h-[500px]">

							{/* Instructions */}
							<div className="p-8 space-y-8 flex flex-col justify-center bg-secondary/10 border-r border-white/5">
								<div className="space-y-6">
									<div className="flex items-start gap-4 p-4 rounded-lg bg-white/5 border border-white/10">
										<div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold text-primary shrink-0">1</div>
										<div>
											<p className="font-medium text-foreground">Open WhatsApp</p>
											<p className="text-sm text-muted-foreground">Go to Settings on your mobile.</p>
										</div>
									</div>
									<div className="flex items-start gap-4 p-4 rounded-lg bg-white/5 border border-white/10">
										<div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold text-primary shrink-0">2</div>
										<div>
											<p className="font-medium text-foreground">Tap "Linked Devices"</p>
											<p className="text-sm text-muted-foreground">Select "Link a Device".</p>
										</div>
									</div>
									<div className="flex items-start gap-4 p-4 rounded-lg bg-white/5 border border-white/10">
										<div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold text-primary shrink-0">3</div>
										<div>
											<p className="font-medium text-foreground">Scan QR Code</p>
											<p className="text-sm text-muted-foreground">Point your camera at the screen.</p>
										</div>
									</div>
								</div>

								<div className="pt-4 border-t border-white/5">
									<p className="text-xs text-muted-foreground mb-2 uppercase tracking-wider font-semibold">Current Status</p>
									<div className="flex items-center gap-3">
										{status === 'connected' && <Badge className="bg-green-500 px-3 py-1">Online & Ready</Badge>}
										{status === 'scanning' && <Badge variant="secondary" className="animate-pulse px-3 py-1">Waiting for Scan...</Badge>}
										{status === 'disconnected' && <Badge variant="destructive" className="px-3 py-1">Offline</Badge>}
									</div>
								</div>
							</div>

							{/* QR Display */}
							<div className="p-8 flex flex-col items-center justify-center bg-gradient-to-br from-black/40 to-black/60 relative">

								{status === 'connected' ? (
									<div className="text-center space-y-6 animate-in fade-in zoom-in duration-500">
										<div className="h-24 w-24 bg-green-500/20 rounded-full flex items-center justify-center mx-auto ring-4 ring-green-500/10">
											<CheckCircle2 className="h-12 w-12 text-green-500" />
										</div>
										<div>
											<h3 className="text-xl font-bold text-white">WhatsApp Linked</h3>
											<p className="text-sm text-white/60 mt-1">Your AI receptionist is active.</p>
										</div>
										<Button variant="destructive" onClick={handleCancel} disabled={isLoading} className="w-full max-w-xs">
											Disconnect
										</Button>
									</div>
								) : status === 'scanning' ? (
									<div className="w-full max-w-xs space-y-6 animate-in fade-in slide-in-from-bottom-4">

										<div className="relative group bg-white p-4 rounded-2xl shadow-xl border-4 border-white/10 mx-auto">
											{qrCode ? (
												<>
													<img src={qrCode} alt="QR Code" className="w-full h-auto rounded-lg mix-blend-multiply" />
													{isRefreshing && (
														<div className="absolute inset-0 bg-white/90 flex items-center justify-center backdrop-blur-sm rounded-lg transition-all">
															<Loader2 className="h-10 w-10 text-primary animate-spin" />
														</div>
													)}
												</>
											) : (
												<div className="aspect-square flex items-center justify-center bg-gray-100 rounded-lg animate-pulse">
													<QrCode className="h-16 w-16 text-gray-300" />
												</div>
											)}
										</div>

										<div className="space-y-3 bg-black/40 p-4 rounded-xl border border-white/5 backdrop-blur-md">
											<div className="flex justify-between items-center text-xs text-white/70">
												<span className="flex items-center gap-1.5">
													<Timer className="h-3.5 w-3.5" />
													Auto-refresh in {timeLeft}s
												</span>
												<span className="text-[10px] uppercase tracking-wider opacity-50">Secured</span>
											</div>

											<Progress value={(timeLeft / REFRESH_INTERVAL) * 100} className="h-1.5" />

											<div className="grid grid-cols-2 gap-2 pt-1">
												<Button
													variant="outline"
													size="sm"
													onClick={handleManualRefresh}
													disabled={isRefreshing}
													className="w-full text-xs h-8 bg-white/5 hover:bg-white/10 border-white/10 text-white"
												>
													<RefreshCw className={`mr-2 h-3 w-3 ${isRefreshing ? 'animate-spin' : ''}`} />
													Refresh Now
												</Button>
												<Button
													variant="ghost"
													size="sm"
													onClick={handleCancel}
													className="w-full text-xs h-8 text-red-400 hover:text-red-300 hover:bg-red-500/10"
												>
													<XCircle className="mr-2 h-3 w-3" />
													Cancel
												</Button>
											</div>
										</div>

									</div>
								) : (
									<div className="text-center space-y-6">
										<div className="h-24 w-24 bg-white/5 rounded-full flex items-center justify-center mx-auto border border-white/10">
											<Smartphone className="h-10 w-10 text-white/40" />
										</div>
										<div>
											<h3 className="text-lg font-medium text-white">No Active Session</h3>
											<p className="text-sm text-white/50 mt-1">Start a session to generate a secure QR code.</p>
										</div>
										<Button
											onClick={handleStartSession}
											disabled={isLoading || !wahaSessionName}
											className="w-full max-w-xs bg-[#25D366] hover:bg-[#25D366]/90 text-black font-bold h-11"
										>
											{isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <QrCode className="mr-2 h-5 w-5" />}
											Start Connection
										</Button>
									</div>
								)}
							</div>

						</div>
					</CardContent>
				</Card>
			</div>
		</AppLayout>
	);
}