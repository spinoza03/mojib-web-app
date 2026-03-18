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
import { Bot, Save, Building2, Upload, Loader2, Info, Clock, Bell, Plus, Trash2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
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

	// Cooldown & Reminder state
	const [cooldownSeconds, setCooldownSeconds] = useState(60);
	const [reminderRules, setReminderRules] = useState<{minutes_before: number; enabled: boolean; unit: string; value: number}[]>([]);
	const [reminderMessage, setReminderMessage] = useState('مرحبا {patient_name}، هاد تذكير بالموعد ديالك في {clinic_name} نهار {time}. نتمناو نشوفوك!');

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

			// B. Load Bot Config
			const { data: botData, error } = await supabase
				.from('bot_configs')
				.select('system_prompt, cooldown_seconds, reminder_message, reminder_rules')
				.eq('user_id', user.id)
				.maybeSingle();

			if (botData) {
				// @ts-ignore
				setPrompt(botData.system_prompt || '');
				// @ts-ignore
				if (botData.cooldown_seconds != null) setCooldownSeconds(botData.cooldown_seconds);
				// @ts-ignore
				if (botData.reminder_message) setReminderMessage(botData.reminder_message);
				// @ts-ignore
				if (botData.reminder_rules && Array.isArray(botData.reminder_rules)) {
					// @ts-ignore
					setReminderRules(botData.reminder_rules.map((r: any) => {
						let unit = 'minutes';
						let value = r.minutes_before;
						if (r.minutes_before >= 1440 && r.minutes_before % 1440 === 0) { unit = 'days'; value = r.minutes_before / 1440; }
						else if (r.minutes_before >= 60 && r.minutes_before % 60 === 0) { unit = 'hours'; value = r.minutes_before / 60; }
						return { minutes_before: r.minutes_before, enabled: r.enabled, unit, value };
					}));
				}
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

			// Convert reminder rules to DB format (only minutes_before + enabled)
			const dbReminderRules = reminderRules.map(r => ({
				minutes_before: r.minutes_before,
				enabled: r.enabled
			}));

			const botPayload = {
				system_prompt: prompt,
				cooldown_seconds: cooldownSeconds,
				reminder_message: reminderMessage,
				reminder_rules: dbReminderRules
			};

			let configError;
			if (existingBot) {
				({ error: configError } = await supabase
					.from('bot_configs')
					.update(botPayload)
					.eq('user_id', user.id));
			} else {
				({ error: configError } = await supabase
					.from('bot_configs')
					.insert({ user_id: user.id, ...botPayload }));
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

				{/* Bot Behavior Card */}
				<Card className="glass-card">
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Clock className="h-5 w-5 text-primary" />
							Bot Behavior
						</CardTitle>
						<CardDescription>Control how the AI agent responds.</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="space-y-3">
							<div className="flex items-center justify-between">
								<Label>Cooldown Period (seconds)</Label>
								<span className="text-sm font-bold text-primary bg-primary/10 px-3 py-1 rounded-full">{cooldownSeconds}s</span>
							</div>
							<Slider
								value={[cooldownSeconds]}
								onValueChange={([v]) => setCooldownSeconds(v)}
								min={10}
								max={300}
								step={10}
								disabled={isSubscriptionExpired}
							/>
							<p className="text-xs text-muted-foreground">After a manual human reply, the AI waits this long before responding again.</p>
						</div>
					</CardContent>
				</Card>

				{/* Appointment Reminders Card */}
				<Card className="glass-card">
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Bell className="h-5 w-5 text-primary" />
							Appointment Reminders
						</CardTitle>
						<CardDescription>Configure automatic WhatsApp reminders for upcoming appointments.</CardDescription>
					</CardHeader>
					<CardContent className="space-y-6">
						{/* Reminder Rules */}
						<div className="space-y-3">
							<Label>Reminder Schedule</Label>
							{reminderRules.map((rule, idx) => (
								<div key={idx} className="flex items-center gap-2 p-3 rounded-lg border bg-secondary/30">
									<Switch
										checked={rule.enabled}
										onCheckedChange={(v) => {
											const updated = [...reminderRules];
											updated[idx].enabled = v;
											setReminderRules(updated);
										}}
										disabled={isSubscriptionExpired}
									/>
									<Input
										type="number"
										min={1}
										className="w-20"
										value={rule.value}
										onChange={(e) => {
											const val = parseInt(e.target.value) || 1;
											const updated = [...reminderRules];
											updated[idx].value = val;
											const multiplier = rule.unit === 'days' ? 1440 : rule.unit === 'hours' ? 60 : 1;
											updated[idx].minutes_before = val * multiplier;
											setReminderRules(updated);
										}}
										disabled={isSubscriptionExpired}
									/>
									<Select
										value={rule.unit}
										onValueChange={(unit) => {
											const updated = [...reminderRules];
											updated[idx].unit = unit;
											const multiplier = unit === 'days' ? 1440 : unit === 'hours' ? 60 : 1;
											updated[idx].minutes_before = rule.value * multiplier;
											setReminderRules(updated);
										}}
										disabled={isSubscriptionExpired}
									>
										<SelectTrigger className="w-[110px]">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="minutes">minutes</SelectItem>
											<SelectItem value="hours">hours</SelectItem>
											<SelectItem value="days">days</SelectItem>
										</SelectContent>
									</Select>
									<span className="text-sm text-muted-foreground">before</span>
									<Button
										variant="ghost"
										size="icon"
										className="h-8 w-8 text-destructive hover:text-destructive/80"
										onClick={() => setReminderRules(reminderRules.filter((_, i) => i !== idx))}
										disabled={isSubscriptionExpired}
									>
										<Trash2 className="h-4 w-4" />
									</Button>
								</div>
							))}
							<Button
								variant="outline"
								size="sm"
								className="gap-2"
								onClick={() => setReminderRules([...reminderRules, { minutes_before: 30, enabled: true, unit: 'minutes', value: 30 }])}
								disabled={isSubscriptionExpired}
							>
								<Plus className="h-4 w-4" /> Add Reminder
							</Button>
						</div>

						{/* Reminder Message */}
						<div className="space-y-2">
							<Label>Reminder Message Template</Label>
							<Textarea
								value={reminderMessage}
								onChange={(e) => setReminderMessage(e.target.value)}
								className="min-h-[100px] font-mono text-sm bg-secondary/50"
								disabled={isSubscriptionExpired}
							/>
							<div className="flex gap-2 flex-wrap">
								<span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full font-mono">{'{patient_name}'}</span>
								<span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full font-mono">{'{clinic_name}'}</span>
								<span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full font-mono">{'{time}'}</span>
							</div>
						</div>

						<Button onClick={handleSave} disabled={loading || isSubscriptionExpired} className="w-full">
							<Save className="mr-2 h-4 w-4" />
							{loading ? 'Saving...' : 'Save Reminder Settings'}
						</Button>
					</CardContent>
				</Card>

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