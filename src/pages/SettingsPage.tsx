import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { AppLayout } from '@/components/layout/AppLayout';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Bot, Save, Building2, Upload, Loader2, Info } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from '@/components/ui/tooltip';

export default function SettingsPage() {
	const { user, refreshProfile, profile, isSubscriptionExpired } = useAuth();
	const { toast } = useToast();

	const [loading, setLoading] = useState(false);
	const [uploading, setUploading] = useState(false);

	const [prompt, setPrompt] = useState('');
	const [clinicName, setClinicName] = useState('');
	const [avatarUrl, setAvatarUrl] = useState('');
	const [isAiEnabled, setIsAiEnabled] = useState(true);

	// Subscription Helpers
	const planType = profile?.plan_type || 'starter';
	const subscriptionStatus = profile?.subscription_status || 'trial';
	const trialEndsAt = profile?.trial_ends_at;

	const getTrialDaysLeft = (trialEndsAtValue?: string) => {
		if (!trialEndsAtValue) return 0;
		const endDate = new Date(trialEndsAtValue);
		const today = new Date();
		const diff = endDate.getTime() - today.getTime();
		return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
	};

	const whatsappNumber = '212600000000';
	const getWhatsAppLink = (targetPlan: 'starter' | 'pro') => {
		const message = targetPlan === 'pro' ? 'Hello, I want to upgrade to PRO.' : 'Hello, I want to change to STARTER.';
		return `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
	};

	useEffect(() => {
		if (isSubscriptionExpired) setIsAiEnabled(false);
	}, [isSubscriptionExpired]);

	// 1. FETCH DATA
	useEffect(() => {
		async function loadSettings() {
			if (!user) return;

			// A. Load Profile Data
			const { data: profileData } = await supabase
				.from('profiles')
				.select('clinic_name, avatar_url')
				.eq('id', user.id)
				.maybeSingle();

			if (profileData) {
				setClinicName(profileData.clinic_name || '');
				setAvatarUrl(profileData.avatar_url || '');
			}

			// B. Load Bot Config (FIXED: Using 'bot_configs')
			const { data: botData, error } = await supabase
				.from('bot_configs') // <--- FIXED PLURAL NAME
				.select('system_prompt')
				.eq('user_id', user.id)
				.maybeSingle();

			if (botData) {
				// @ts-ignore
				setPrompt(botData.system_prompt || '');
			}
		}
		loadSettings();
	}, [user]);

	// 2. Handle Logo Upload
	const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
		try {
			setUploading(true);
			if (!user || !event.target.files || event.target.files.length === 0) return;

			const file = event.target.files[0];
			const fileExt = file.name.split('.').pop();
			const filePath = `${user.id}-${Date.now()}.${fileExt}`;

			const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, file, { upsert: true });
			if (uploadError) throw uploadError;

			const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath);
			await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', user.id);

			setAvatarUrl(publicUrl);
			await refreshProfile();
			toast({ title: 'Success', description: 'Logo updated.' });

		} catch (error: any) {
			toast({ variant: 'destructive', title: 'Upload Failed', description: error.message });
		} finally {
			setUploading(false);
		}
	};

	// 3. SAVE SETTINGS
	const handleSave = async () => {
		if (!user) return;
		setLoading(true);

		try {
			// A. Update Profile
			const { error: profileError } = await supabase
				.from('profiles')
				.update({ clinic_name: clinicName })
				.eq('id', user.id);

			if (profileError) throw profileError;

			// B. Update Bot Config (FIXED: Using 'bot_configs')
			const { data: existingBot } = await supabase
				.from('bot_configs')
				.select('user_id')
				.eq('user_id', user.id)
				.maybeSingle();

			let configError;
			if (existingBot) {
				({ error: configError } = await supabase
					.from('bot_configs')
					.update({ system_prompt: prompt })
					.eq('user_id', user.id));
			} else {
				({ error: configError } = await supabase
					.from('bot_configs')
					.insert({ user_id: user.id, system_prompt: prompt }));
			}

			if (configError) throw configError;

			await refreshProfile();
			toast({ title: 'Saved', description: 'Settings and Prompt updated successfully.' });

		} catch (error: any) {
			toast({ variant: 'destructive', title: 'Error', description: error.message });
		} finally {
			setLoading(false);
		}
	};

	return (
		<AppLayout>
			<div className="space-y-6 max-w-4xl mx-auto">
				<div>
					<h1 className="text-3xl font-bold mb-2">Settings</h1>
					<p className="text-muted-foreground">Manage your clinic identity and AI personality.</p>
				</div>

				<div className="grid gap-6 md:grid-cols-2">
					{/* Identity Card */}
					<Card className="glass-card">
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<Building2 className="h-5 w-5 text-primary" />
								Clinic Identity
							</CardTitle>
						</CardHeader>
						<CardContent className="space-y-6">
							<div className="flex items-center gap-4">
								<Avatar className="h-20 w-20 border-2 border-primary/20">
									<AvatarImage src={avatarUrl} className="object-cover" />
									<AvatarFallback className="text-xl font-bold bg-secondary">
										{clinicName.substring(0, 2).toUpperCase() || 'DR'}
									</AvatarFallback>
								</Avatar>

								<div className="space-y-2">
									<Label htmlFor="logo-upload" className="cursor-pointer">
										<div className="flex items-center gap-2 px-4 py-2 bg-secondary hover:bg-secondary/80 rounded-md text-sm font-medium transition-colors border border-input">
											{uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
											{uploading ? 'Uploading...' : 'Upload Logo'}
										</div>
									</Label>
									<Input id="logo-upload" type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} disabled={uploading} />
								</div>
							</div>

							<div className="space-y-2">
								<Label>Clinic Name (Used in Greetings)</Label>
								<Input
									value={clinicName}
									onChange={(e) => setClinicName(e.target.value)}
									placeholder="e.g. Smile Dental"
									disabled={isSubscriptionExpired}
								/>
							</div>
						</CardContent>
					</Card>

					{/* System Prompt Card */}
					<Card className="glass-card md:row-span-2">
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<Bot className="h-5 w-5 text-primary" />
								System Prompt
							</CardTitle>
							<CardDescription>
								Instructions for your AI Receptionist.
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="flex items-center justify-between mb-2">
								<div className="flex items-center gap-2">
									<Label htmlFor="ai-toggle" className="text-sm font-medium">Enable AI</Label>
									{isSubscriptionExpired && (
										<TooltipProvider>
											<Tooltip>
												<TooltipTrigger><Info className="h-4 w-4 text-destructive" /></TooltipTrigger>
												<TooltipContent>Plan expired.</TooltipContent>
											</Tooltip>
										</TooltipProvider>
									)}
								</div>
								<Switch id="ai-toggle" checked={isAiEnabled} onCheckedChange={setIsAiEnabled} disabled={isSubscriptionExpired} />
							</div>

							<Textarea
								value={prompt}
								onChange={(e) => setPrompt(e.target.value)}
								className="min-h-[300px] font-mono text-sm bg-secondary/50 leading-relaxed"
								placeholder="You are a helpful receptionist..."
								disabled={isSubscriptionExpired}
							/>
							<Button onClick={handleSave} disabled={loading || isSubscriptionExpired} className="w-full">
								<Save className="mr-2 h-4 w-4" />
								{loading ? 'Saving...' : 'Update Settings'}
							</Button>
						</CardContent>
					</Card>
				</div>

				{/* Subscription Section */}
				<Card className="glass-card">
					<CardHeader><CardTitle>Subscription</CardTitle></CardHeader>
					<CardContent className="space-y-6">
						<div className="grid gap-4 md:grid-cols-3">
							<div className="rounded-lg border p-4 bg-secondary/20">
								<p className="text-sm text-muted-foreground">Plan</p>
								<p className="text-lg font-semibold capitalize">{planType}</p>
							</div>
							<div className="rounded-lg border p-4 bg-secondary/20">
								<p className="text-sm text-muted-foreground">Status</p>
								<p className="text-lg font-semibold capitalize">{subscriptionStatus}</p>
							</div>
							<div className="rounded-lg border p-4 bg-secondary/20">
								<p className="text-sm text-muted-foreground">Trial Left</p>
								<p className="text-lg font-semibold">{subscriptionStatus === 'trial' ? `${getTrialDaysLeft(trialEndsAt)} days` : 'N/A'}</p>
							</div>
						</div>
						<div className="grid gap-4 md:grid-cols-2">
							<Button variant="outline" onClick={() => window.open(getWhatsAppLink('starter'), '_blank')}>Contact for Starter</Button>
							<Button onClick={() => window.open(getWhatsAppLink('pro'), '_blank')}>Contact for Pro</Button>
						</div>
					</CardContent>
				</Card>
			</div>
		</AppLayout>
	);
}