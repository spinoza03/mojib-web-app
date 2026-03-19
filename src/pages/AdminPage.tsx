import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { fetchAdminStats, fetchAllClinics, type ClinicWithEmail } from '@/services/api';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase, supabaseAdmin } from '@/integrations/supabase/client';
import { DollarSign, Calendar, Loader2, Trash2, Users, Settings2, UserPlus, Bot, Wifi, Play } from 'lucide-react';
import { addDays, isAfter } from 'date-fns';

const WAHA_URL = 'https://waha.mojib.online';
const WAHA_API_KEY = 'my-secret-key';
const BACKEND_WEBHOOK_URL = 'http://72.62.237.248:3001/waha/webhook';

export default function AdminPage() {
	const { profile, user } = useAuth();
	const { toast } = useToast();
	const queryClient = useQueryClient();

	// State
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
	const [manageDialogOpen, setManageDialogOpen] = useState(false);
	const [createDialogOpen, setCreateDialogOpen] = useState(false);
	const [selectedUser, setSelectedUser] = useState<ClinicWithEmail | null>(null);
	const [userEmails, setUserEmails] = useState<Record<string, string>>({});
	
	// Subscription & Config State
	const [planSelection, setPlanSelection] = useState<'pro'>('pro');
	const [startingSessionId, setStartingSessionId] = useState<string | null>(null);
	const [statusSelection, setStatusSelection] = useState<'trial' | 'active' | 'expired'>('trial');
	const [trialEndDate, setTrialEndDate] = useState('');
	const [trialExtension, setTrialExtension] = useState('');
	
	const [nicheSelection, setNicheSelection] = useState<string>('dentistry');
	const [workingHours, setWorkingHours] = useState('');
	const [botTone, setBotTone] = useState('');
	const [botLanguages, setBotLanguages] = useState('');
	const [additionalInfo, setAdditionalInfo] = useState('');
	const [systemPrompt, setSystemPrompt] = useState('');
	const [isFetchingConfig, setIsFetchingConfig] = useState(false);

	// Create User form state
	const [newClinicName, setNewClinicName] = useState('');
	const [newEmail, setNewEmail] = useState('');
	const [newPassword, setNewPassword] = useState('');
	const [newPhone, setNewPhone] = useState('');
	const [newWahaSessionName, setNewWahaSessionName] = useState('');
	const [newSystemPrompt, setNewSystemPrompt] = useState('');
	const [isCreating, setIsCreating] = useState(false);
	const [isImpersonating, setIsImpersonating] = useState(false);

	// 1. Fetch Stats
	const { data: stats, isLoading: statsLoading } = useQuery({
		queryKey: ['adminStats'],
		queryFn: fetchAdminStats,
	});

	// 2. Fetch Users/Clinics
	const { data: clinics, isLoading: clinicsLoading } = useQuery<ClinicWithEmail[]>({
		queryKey: ['allClinics'],
		queryFn: fetchAllClinics,
	});

	useEffect(() => {
		if (!clinics) return;
		const emails: Record<string, string> = {};
		for (const clinic of clinics) {
			if (user?.id === clinic.id) {
				emails[clinic.id] = user.email || 'N/A';
			} else {
				emails[clinic.id] = clinic.email || 'N/A';
			}
		}
		setUserEmails(emails);
	}, [clinics, user]);

	// 3. Mutation: Delete User
	const deleteUserMutation = useMutation({
		mutationFn: async (userId: string) => {
			const { error } = await (supabase as any).rpc('delete_user_by_email', {
				user_email: userEmails[userId]
			});

			if (error) {
				const { error: deleteError } = await supabase.from('profiles').delete().eq('id', userId);
				if (deleteError) throw deleteError;
			}
		},
		onSuccess: () => {
			toast({
				title: 'User Deleted',
				description: `Successfully deleted ${selectedUser?.clinic_name}.`,
			});
			queryClient.invalidateQueries({ queryKey: ['allClinics'] });
			queryClient.invalidateQueries({ queryKey: ['adminStats'] });
			setDeleteDialogOpen(false);
			setSelectedUser(null);
		},
		onError: (error: Error) => {
			toast({
				title: 'Delete Failed',
				description: error.message || 'Failed to delete user.',
				variant: 'destructive',
			});
		},
	});

	const updateSubscriptionMutation = useMutation({
		mutationFn: async ({ userId, updates }: { userId: string; updates: Partial<ClinicWithEmail> }) => {
			const { error } = await supabase.from('profiles').update(updates).eq('id', userId);
			if (error) {
				console.error('[Admin] Error updating subscription:', error);
				throw error;
			}
		},
	});

	// ---------------------------------------------------
	// CREATE USER HANDLER
	// ---------------------------------------------------
	const handleCreateUser = async () => {
		if (!newEmail || !newPassword || !newClinicName) {
			toast({ variant: 'destructive', title: 'Missing Fields', description: 'Email, password, and clinic name are required.' });
			return;
		}

		setIsCreating(true);
		try {
			// 1. Sign up the new user using the secondary client (won't log out admin)
			//    DB trigger (handle_new_user) reads clinic_name + waha_session_name from metadata
			const { data: signUpData, error: signUpError } = await supabaseAdmin.auth.signUp({
				email: newEmail,
				password: newPassword,
				options: {
					data: {
						clinic_name: newClinicName,
						phone: newPhone,
						waha_session_name: newWahaSessionName || 'none',
					},
				},
			});

			if (signUpError) throw signUpError;

			const newUserId = signUpData?.user?.id;
			if (!newUserId) throw new Error('User was not created. Check if the email is already in use.');

			// 2. Wait a moment for the trigger to create the profile row
			await new Promise(resolve => setTimeout(resolve, 2000));

			// 3. Update bot_configs system_prompt (trigger already created the row)
			if (newSystemPrompt) {
				const { error: botError } = await supabase
					.from('bot_configs' as any)
					.update({ system_prompt: newSystemPrompt })
					.eq('user_id', newUserId);

				if (botError) {
					console.error('[Admin] Error setting system_prompt:', botError);
				}
			}

			// 4. Create WAHA session with the n8n webhook configured
			if (newWahaSessionName && newWahaSessionName !== 'none') {
				try {
					const wahaResponse = await fetch(`${WAHA_URL}/api/sessions`, {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
							'X-Api-Key': WAHA_API_KEY,
						},
						body: JSON.stringify({
							name: newWahaSessionName,
							config: {
								proxy: null,
								debug: false,
								webhooks: [
									{
										url: BACKEND_WEBHOOK_URL,
										events: ['message'],
										retries: {
											delaySeconds: 40,
											attempts: 1,
											policy: 'linear',
										},
										customHeaders: null,
									},
								],
							},
						}),
					});

					if (!wahaResponse.ok) {
						const errBody = await wahaResponse.text();
						console.error('[Admin] WAHA session creation failed:', errBody);
						toast({ variant: 'destructive', title: 'WAHA Warning', description: 'User created but WAHA session setup failed. You can retry from the Connect page.' });
					} else {
						console.log('[Admin] WAHA session created:', newWahaSessionName);
					}
				} catch (wahaErr) {
					console.error('[Admin] WAHA API call failed (non-blocking):', wahaErr);
					toast({ variant: 'destructive', title: 'WAHA Warning', description: 'User created but could not reach WAHA server.' });
				}
			}

			toast({ title: 'User Created', description: `${newClinicName} has been created successfully.` });

			// 6. Refresh data
			queryClient.invalidateQueries({ queryKey: ['allClinics'] });
			queryClient.invalidateQueries({ queryKey: ['adminStats'] });
			handleCloseCreate();

		} catch (err: any) {
			toast({ variant: 'destructive', title: 'Creation Failed', description: err.message || 'Could not create user.' });
		} finally {
			setIsCreating(false);
		}
	};

	const handleCloseCreate = () => {
		setCreateDialogOpen(false);
		setNewClinicName('');
		setNewEmail('');
		setNewPassword('');
		setNewPhone('');
		setNewWahaSessionName('');
		setNewSystemPrompt('');
	};

	// ---------------------------------------------------
	// START / RESTART WAHA SESSION
	// ---------------------------------------------------
	const handleStartSession = async (clinic: ClinicWithEmail) => {
		const sessionName = (clinic as any).waha_session_name;
		if (!sessionName || sessionName === 'none') {
			toast({ variant: 'destructive', title: 'No Session', description: 'This user has no WAHA session name configured.' });
			return;
		}

		setStartingSessionId(clinic.id);
		try {
			// Check if session already exists
			const checkParams = new URLSearchParams({ all: 'true' });
			const checkRes = await fetch(`${WAHA_URL}/api/sessions?${checkParams}`, {
				headers: { 'X-Api-Key': WAHA_API_KEY },
			});
			const sessions = await checkRes.json();
			const existing = sessions.find((s: any) => s.name === sessionName);

			if (existing) {
				if (existing.status === 'WORKING') {
					toast({ title: 'Already Running', description: `Session "${sessionName}" is already online.` });
					return;
				}
				// Stop and delete existing before recreating
				await fetch(`${WAHA_URL}/api/sessions/${sessionName}/stop`, {
					method: 'POST',
					headers: { 'X-Api-Key': WAHA_API_KEY },
				}).catch(() => { });
				await fetch(`${WAHA_URL}/api/sessions/${sessionName}`, {
					method: 'DELETE',
					headers: { 'X-Api-Key': WAHA_API_KEY },
				}).catch(() => { });
			}

			// Create session with webhook config
			const createRes = await fetch(`${WAHA_URL}/api/sessions`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'X-Api-Key': WAHA_API_KEY,
				},
				body: JSON.stringify({
					name: sessionName,
					config: {
						proxy: null,
						debug: false,
						webhooks: [
							{
								url: BACKEND_WEBHOOK_URL,
								events: ['message'],
								retries: {
									delaySeconds: 40,
									attempts: 1,
									policy: 'linear',
								},
								customHeaders: null,
							},
						],
					},
				}),
			});

			if (!createRes.ok) {
				const errText = await createRes.text();
				throw new Error(errText);
			}

			// Update DB status to scanning
			await supabase.from('profiles').update({ whatsapp_status: 'scanning' } as any).eq('id', clinic.id);

			toast({ title: 'Session Started', description: `"${sessionName}" is now running. User can scan QR from their Connect page.` });
			queryClient.invalidateQueries({ queryKey: ['allClinics'] });
		} catch (err: any) {
			console.error('[Admin] Start session error:', err);
			toast({ variant: 'destructive', title: 'Session Failed', description: err.message || 'Could not start WAHA session.' });
		} finally {
			setStartingSessionId(null);
		}
	};

	const handleCloseManage = () => {
		setManageDialogOpen(false);
		setSelectedUser(null);
		setTrialExtension('');
	};

	const handleOpenManage = async (clinic: ClinicWithEmail) => {
		setSelectedUser(clinic);
		setPlanSelection('pro'); // Force pro
		setStatusSelection((clinic.subscription_status as 'trial' | 'active' | 'expired') || 'trial');
		setTrialEndDate(clinic.trial_ends_at ? clinic.trial_ends_at.slice(0, 10) : '');
		setTrialExtension('');
		setNicheSelection((clinic as any).niche || 'dentistry');
		
		setIsFetchingConfig(true);
		setManageDialogOpen(true);

		try {
			const { data: config } = await supabase
				.from('bot_configs' as any)
				.select('*')
				.eq('user_id', clinic.id)
				.maybeSingle();

			if (config) {
				const typedConfig = config as any;
				setWorkingHours(typedConfig.working_hours || '');
				setBotTone(typedConfig.tone || '');
				setBotLanguages(typedConfig.languages || '');
				setAdditionalInfo(typedConfig.additional_info || '');
				setSystemPrompt(typedConfig.system_prompt || '');
			} else {
				setWorkingHours('');
				setBotTone('');
				setBotLanguages('');
				setAdditionalInfo('');
				setSystemPrompt('');
			}
		} catch (err) {
			console.error("Error fetching bot config:", err);
		} finally {
			setIsFetchingConfig(false);
		}
	};

	const handleImpersonate = async () => {
		if (!selectedUser) return;
		
		try {
			setIsImpersonating(true);
			const { data: { session } } = await supabase.auth.getSession();
			
			const res = await fetch('/api/admin/impersonate', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${session?.access_token}`
				},
				body: JSON.stringify({ targetUserId: selectedUser.id })
			});
			
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || 'Failed to impersonate');
			
			// Open the magic link in a new tab
			window.open(data.link, '_blank');
			toast({ title: "Success", description: "Opened session in new window." });
		} catch (error: any) {
			toast({ variant: "destructive", title: "Impersonation Failed", description: error.message });
		} finally {
			setIsImpersonating(false);
		}
	};

	const handleSaveSubscription = async () => {
		if (!selectedUser) return;

		const updates: Partial<ClinicWithEmail> = {
			plan_type: 'pro',
			subscription_status: statusSelection,
			niche: nicheSelection,
		} as any;

		if (trialEndDate) {
			updates.trial_ends_at = new Date(trialEndDate).toISOString();
		}

		try {
			await updateSubscriptionMutation.mutateAsync({
				userId: selectedUser.id,
				updates,
			});

			// Save Bot Config
			const { error: configErr } = await supabase
				.from('bot_configs' as any)
				.update({
					working_hours: workingHours,
					tone: botTone,
					languages: botLanguages,
					additional_info: additionalInfo,
					system_prompt: systemPrompt
				})
				.eq('user_id', selectedUser.id);
				
			if (configErr) {
				console.error("[Admin] error saving user bot config", configErr);
			}

			toast({
				title: 'User Updated',
				description: `${selectedUser.clinic_name}'s profile and config have been saved.`,
			});

			queryClient.invalidateQueries({ queryKey: ['allClinics'] });
			queryClient.invalidateQueries({ queryKey: ['adminStats'] });
			handleCloseManage();
		} catch (error: any) {
			toast({
				title: 'Update Failed',
				description: error.message || 'Unable to update subscription.',
				variant: 'destructive',
			});
		}
	};

	const handleExtendTrial = async () => {
		if (!selectedUser) return;

		const days = parseInt(trialExtension, 10);
		if (isNaN(days) || days <= 0) {
			toast({
				title: 'Invalid Days',
				description: 'Please enter a valid number of days to extend.',
				variant: 'destructive',
			});
			return;
		}

		const currentTrialDate = selectedUser.trial_ends_at ? new Date(selectedUser.trial_ends_at) : null;
		const today = new Date();
		const baseDate = currentTrialDate && isAfter(currentTrialDate, today) ? currentTrialDate : today;
		const updatedDate = addDays(baseDate, days);
		const isoDate = updatedDate.toISOString();

		try {
			await updateSubscriptionMutation.mutateAsync({
				userId: selectedUser.id,
				updates: {
					trial_ends_at: isoDate,
					subscription_status: 'trial',
				},
			});

			toast({
				title: 'Trial Extended',
				description: `${selectedUser.clinic_name} trial extended by ${days} days.`,
			});

			setStatusSelection('trial');
			setTrialEndDate(isoDate.slice(0, 10));
			setTrialExtension('');
			setSelectedUser((prev) => (prev ? { ...prev, trial_ends_at: isoDate, subscription_status: 'trial' } : prev));
			queryClient.invalidateQueries({ queryKey: ['allClinics'] });
		} catch (error: any) {
			toast({
				title: 'Extension Failed',
				description: error.message || 'Unable to extend trial.',
				variant: 'destructive',
			});
		}
	};

	// Handlers
	const handleOpenDelete = (clinic: ClinicWithEmail) => {
		setSelectedUser(clinic);
		setDeleteDialogOpen(true);
	};

	// Protected Route Check
	if (profile?.role !== 'superuser') {
		return (
			<AppLayout>
				<div className="flex items-center justify-center h-[50vh]">
					<p className="text-muted-foreground">Access Denied. You are not an administrator.</p>
				</div>
			</AppLayout>
		);
	}

	// Stat Cards Configuration
	const statCards = [
		{
			title: 'Total Users',
			value: stats?.totalUsers ?? 0,
			icon: Users,
			color: 'text-primary',
			bgColor: 'bg-primary/10',
		},
		{
			title: 'Total Revenue',
			value: `${stats?.totalRevenue ?? 0} DH`,
			icon: DollarSign,
			color: 'text-primary',
			bgColor: 'bg-primary/10',
		},
		{
			title: 'Active Appointments',
			value: stats?.activeAppointments ?? 0,
			icon: Calendar,
			color: 'text-primary',
			bgColor: 'bg-primary/10',
		},
	];

	return (
		<AppLayout>
			<div className="space-y-8">
				{/* Header */}
				<div className="flex items-center justify-between">
					<div>
						<h1 className="text-3xl font-bold mb-2 text-foreground">
							Admin <span className="text-primary">Panel</span>
						</h1>
						<p className="text-muted-foreground">
							Manage all users and monitor system-wide statistics.
						</p>
					</div>
					<Button onClick={() => setCreateDialogOpen(true)} className="gap-2">
						<UserPlus className="h-4 w-4" />
						Create User
					</Button>
				</div>

				{/* Global Stats */}
				<motion.div
					initial={{ opacity: 0, y: 20 }}
					animate={{ opacity: 1, y: 0 }}
					className="grid grid-cols-1 md:grid-cols-3 gap-6"
				>
					{statCards.map((stat, index) => (
						<motion.div
							key={stat.title}
							initial={{ opacity: 0, y: 20 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ delay: index * 0.1 }}
						>
							<Card className="glass-card border-primary/20">
								<CardContent className="p-6">
									<div className="flex items-center justify-between">
										<div>
											<p className="text-sm text-muted-foreground mb-1">{stat.title}</p>
											<p className="text-3xl font-bold text-white">
												{statsLoading ? (
													<Loader2 className="h-6 w-6 animate-spin text-primary" />
												) : (
													stat.value
												)}
											</p>
										</div>
										<div className={`p-3 rounded-xl ${stat.bgColor}`}>
											<stat.icon className={`h-6 w-6 ${stat.color}`} />
										</div>
									</div>
								</CardContent>
							</Card>
						</motion.div>
					))}
				</motion.div>

				{/* Clinics Table */}
				<motion.div
					initial={{ opacity: 0, y: 20 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ delay: 0.3 }}
				>
					<Card className="glass-card border-primary/20">
						<CardHeader>
							<CardTitle className="text-white flex items-center gap-2">
								<Users className="h-5 w-5 text-primary" />
								User Management
							</CardTitle>
						</CardHeader>
						<CardContent>
							{clinicsLoading ? (
								<div className="flex items-center justify-center py-12">
									<Loader2 className="h-8 w-8 animate-spin text-primary" />
								</div>
							) : clinics && clinics.length > 0 ? (
								<div className="rounded-md border border-primary/20 overflow-x-auto">
									<Table>
										<TableHeader>
											<TableRow className="border-primary/20 hover:bg-primary/5">
												<TableHead className="text-foreground">Clinic Name</TableHead>
												<TableHead className="text-foreground">Email</TableHead>
												<TableHead className="text-foreground">Phone</TableHead>
												<TableHead className="text-foreground">WAHA Session</TableHead>
												<TableHead className="text-foreground">Status</TableHead>
												<TableHead className="text-foreground text-right">Actions</TableHead>
											</TableRow>
										</TableHeader>
										<TableBody>
											{clinics.map((clinic) => (
												<TableRow key={clinic.id} className="border-primary/20 hover:bg-primary/5">
													<TableCell className="font-medium text-foreground">
														{clinic.clinic_name}
													</TableCell>
													<TableCell className="text-muted-foreground">
														{userEmails[clinic.id] || clinic.email || '...'}
													</TableCell>
													<TableCell className="text-muted-foreground">
														{clinic.phone || 'N/A'}
													</TableCell>
													<TableCell className="text-muted-foreground">
														<div className="flex items-center gap-1.5">
															<Wifi className="h-3 w-3" />
															{(clinic as any).waha_session_name || 'N/A'}
														</div>
													</TableCell>
													<TableCell>
														<Badge
															className={
																clinic.subscription_status === 'active'
																	? 'bg-green-500/20 text-green-500 border-green-500/30'
																	: clinic.subscription_status === 'trial'
																		? 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30'
																		: 'bg-red-500/20 text-red-500 border-red-500/30'
															}
														>
															{clinic.subscription_status || 'N/A'}
														</Badge>
													</TableCell>
													<TableCell className="text-right">
														<div className="flex items-center justify-end gap-2">
															<Button
																size="sm"
																variant="outline"
																onClick={() => handleStartSession(clinic)}
																disabled={startingSessionId === clinic.id || !(clinic as any).waha_session_name || (clinic as any).waha_session_name === 'none'}
																className="border-green-500/30 text-green-500 hover:bg-green-500/10"
															>
																{startingSessionId === clinic.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
															</Button>
															<Button
																size="sm"
																variant="outline"
																onClick={() => handleOpenManage(clinic)}
																className="border-primary/30 text-primary hover:bg-primary/10"
															>
																<Settings2 className="h-4 w-4 mr-1" />
																Manage
															</Button>
															<Button
																size="sm"
																variant="destructive"
																onClick={() => handleOpenDelete(clinic)}
															>
																<Trash2 className="h-4 w-4" />
															</Button>
														</div>
													</TableCell>
												</TableRow>
											))}
										</TableBody>
									</Table>
								</div>
							) : (
								<div className="text-center py-12 text-muted-foreground">
									<Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
									<p>No users found</p>
								</div>
							)}
						</CardContent>
					</Card>
				</motion.div>
			</div>

			{/* ============================================ */}
			{/* CREATE USER DIALOG                          */}
			{/* ============================================ */}
			<Dialog open={createDialogOpen} onOpenChange={(open) => { if (!open) handleCloseCreate(); }}>
				<DialogContent className="glass-card border-primary/20 max-w-lg max-h-[90vh] overflow-y-auto">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							<UserPlus className="h-5 w-5 text-primary" />
							Create New User
						</DialogTitle>
						<DialogDescription>
							Create a new user profile, configure their WAHA session and system prompt.
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-4 py-4">
						{/* Clinic Name */}
						<div className="space-y-2">
							<Label>Clinic Name *</Label>
							<Input
								value={newClinicName}
								onChange={(e) => setNewClinicName(e.target.value)}
								placeholder="e.g. Royal Dental Center"
							/>
						</div>

						{/* Email & Password */}
						<div className="grid gap-4 md:grid-cols-2">
							<div className="space-y-2">
								<Label>Email *</Label>
								<Input
									type="email"
									value={newEmail}
									onChange={(e) => setNewEmail(e.target.value)}
									placeholder="user@clinic.com"
								/>
							</div>
							<div className="space-y-2">
								<Label>Password *</Label>
								<Input
									type="password"
									value={newPassword}
									onChange={(e) => setNewPassword(e.target.value)}
									placeholder="Min 6 characters"
								/>
							</div>
						</div>

						{/* Phone */}
						<div className="space-y-2">
							<Label>Phone Number</Label>
							<Input
								value={newPhone}
								onChange={(e) => setNewPhone(e.target.value)}
								placeholder="+212 6..."
							/>
						</div>

						<hr className="border-white/10" />

						{/* WAHA Session Name */}
						<div className="space-y-2">
							<Label className="flex items-center gap-2">
								<Wifi className="h-4 w-4 text-primary" />
								WAHA Session Name
							</Label>
							<Input
								value={newWahaSessionName}
								onChange={(e) => setNewWahaSessionName(e.target.value)}
								placeholder="e.g. royal-dental-session"
							/>
							<p className="text-xs text-muted-foreground">
								This is saved in the profiles table and triggers the webhook to provision the session.
							</p>
						</div>

						{/* System Prompt */}
						<div className="space-y-2">
							<Label className="flex items-center gap-2">
								<Bot className="h-4 w-4 text-primary" />
								System Prompt
							</Label>
							<Textarea
								value={newSystemPrompt}
								onChange={(e) => setNewSystemPrompt(e.target.value)}
								placeholder="You are a helpful AI receptionist for this clinic..."
								className="min-h-[120px] font-mono text-sm bg-secondary/50"
							/>
							<p className="text-xs text-muted-foreground">
								Saved in the bot_configs table. The user can later edit this from their Settings page.
							</p>
						</div>
					</div>

					<DialogFooter>
						<Button variant="outline" onClick={handleCloseCreate} className="border-primary/30">
							Cancel
						</Button>
						<Button onClick={handleCreateUser} disabled={isCreating}>
							{isCreating && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
							Create User
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* ============================================ */}
			{/* MANAGE SUBSCRIPTION DIALOG                  */}
			{/* ============================================ */}
			<Dialog
				open={manageDialogOpen}
				onOpenChange={(open) => {
					if (!open) {
						handleCloseManage();
					}
				}}
			>
				<DialogContent className="glass-card border-primary/20 max-w-2xl max-h-[90vh] overflow-y-auto">
					<DialogHeader>
						<DialogTitle>Manage User: {selectedUser?.clinic_name}</DialogTitle>
						<DialogDescription>
							Update plan, status, niche, and AI bot configuration.
						</DialogDescription>
					</DialogHeader>
					
					{isFetchingConfig ? (
						<div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
					) : (
					<div className="space-y-6 py-4">
					
						{/* ROW 1: Plan & Status */}
						<div className="grid gap-4 md:grid-cols-2">
							<div className="space-y-2">
								<Label>Plan</Label>
								<Input value="Pro (Only Plan Available)" disabled className="bg-secondary/30" />
							</div>
							<div className="space-y-2">
								<Label>Status</Label>
								<Select
									value={statusSelection}
									onValueChange={(value) => setStatusSelection(value as 'trial' | 'active' | 'expired')}
								>
									<SelectTrigger>
										<SelectValue placeholder="Select status" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="trial">Trial</SelectItem>
										<SelectItem value="active">Active</SelectItem>
										<SelectItem value="expired">Expired (Blocks AI)</SelectItem>
									</SelectContent>
								</Select>
							</div>
						</div>

						{/* ROW 2: Trial Dates */}
						<div className="grid gap-4 md:grid-cols-2">
							<div className="space-y-2">
								<Label>Trial Ends At</Label>
								<Input
									type="date"
									value={trialEndDate}
									onChange={(e) => setTrialEndDate(e.target.value)}
								/>
							</div>
							<div className="space-y-2">
								<Label>Extend Trial (days)</Label>
								<div className="flex gap-2">
									<Input
										type="number"
										min="1"
										value={trialExtension}
										onChange={(e) => setTrialExtension(e.target.value)}
										placeholder="e.g. 7"
									/>
									<Button
										type="button"
										variant="secondary"
										onClick={handleExtendTrial}
										disabled={updateSubscriptionMutation.isPending}
									>
										Extend
									</Button>
								</div>
							</div>
						</div>

						{selectedUser?.trial_ends_at && (
							<p className="text-xs text-muted-foreground mt-0">
								Current trial end: {new Date(selectedUser.trial_ends_at).toLocaleDateString()}
							</p>
						)}
						
						<hr className="border-white/10" />
						
						{/* ROW 3: Niche */}
						<div className="space-y-2">
							<Label className="text-primary font-semibold">User Niche</Label>
							<Select value={nicheSelection} onValueChange={setNicheSelection}>
								<SelectTrigger>
									<SelectValue placeholder="Select Niche" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="dentistry">Dentistry</SelectItem>
									<SelectItem value="doctor">Medical Doctor</SelectItem>
									<SelectItem value="beauty_center">Beauty Center</SelectItem>
									<SelectItem value="immobilier">Real Estate (Coming Soon)</SelectItem>
									<SelectItem value="car_location">Car Rental (Coming Soon)</SelectItem>
									<SelectItem value="centre_formation">Training Center (Coming Soon)</SelectItem>
								</SelectContent>
							</Select>
						</div>

						{/* ROW 4: AI Config */}
						<div className="space-y-4">
							<Label className="text-primary font-semibold">Bot Configuration</Label>
							<div className="grid gap-4 md:grid-cols-2">
								<div className="space-y-2">
									<Label className="text-xs">Working Hours</Label>
									<Input value={workingHours} onChange={e => setWorkingHours(e.target.value)} placeholder="Mon-Sat 09:00-18:00" />
								</div>
								<div className="space-y-2">
									<Label className="text-xs">Agent Tone</Label>
									<Select value={botTone} onValueChange={setBotTone}>
										<SelectTrigger><SelectValue placeholder="Select Tone" /></SelectTrigger>
										<SelectContent>
											<SelectItem value="professional,welcoming">Professional & Welcoming</SelectItem>
											<SelectItem value="friendly,casual">Friendly & Casual</SelectItem>
											<SelectItem value="formal,direct">Formal & Direct</SelectItem>
										</SelectContent>
									</Select>
								</div>
							</div>
							
							<div className="space-y-2">
								<Label className="text-xs">Supported Languages</Label>
								<Input value={botLanguages} onChange={e => setBotLanguages(e.target.value)} placeholder="e.g. darija, french, english" />
							</div>
							
							<div className="space-y-2">
								<Label className="text-xs">Additional Info</Label>
								<Textarea value={additionalInfo} onChange={e => setAdditionalInfo(e.target.value)} placeholder="Any special instructions..." className="min-h-[60px]" />
							</div>
							
							<div className="space-y-2 pt-2">
								<Label className="text-xs text-yellow-500">Raw Override System Prompt (Optional)</Label>
								<Textarea 
									value={systemPrompt} 
									onChange={e => setSystemPrompt(e.target.value)} 
									placeholder="Leave empty to auto-generate from the fields above..." 
									className="min-h-[100px] font-mono text-xs bg-secondary/30" 
								/>
								<p className="text-[10px] text-muted-foreground">If filled, this completely overrides the template generator.</p>
							</div>
						</div>
						
					</div>
					)}
					<DialogFooter>
						<Button
							variant="outline"
							onClick={handleCloseManage}
						>
							Cancel
						</Button>
						<Button onClick={handleImpersonate} disabled={isImpersonating} variant="secondary">
							{isImpersonating && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
							Login As User
						</Button>
						<Button onClick={handleSaveSubscription} disabled={updateSubscriptionMutation.isPending}>
							{updateSubscriptionMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
							Save Changes
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* ============================================ */}
			{/* DELETE USER DIALOG                          */}
			{/* ============================================ */}
			<AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
				<AlertDialogContent className="glass-card border-primary/20">
					<AlertDialogHeader>
						<AlertDialogTitle className="text-white">Delete User</AlertDialogTitle>
						<AlertDialogDescription className="text-muted-foreground">
							Are you sure you want to delete <span className="font-medium text-white">{selectedUser?.clinic_name}</span>?
							This action cannot be undone.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel className="border-primary/30 text-foreground">Cancel</AlertDialogCancel>
						<AlertDialogAction
							onClick={() => selectedUser && deleteUserMutation.mutate(selectedUser.id)}
							disabled={deleteUserMutation.isPending}
						>
							{deleteUserMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
							Delete
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</AppLayout>
	);
}