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
import { Bot, Save, Building2, Upload, Loader2, Info, Clock, Bell, Plus, Trash2, Languages, AlertTriangle, CreditCard, Copy, CheckCircle2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from '@/components/ui/tooltip';

// Payment info constants
const BANK_INFO = {
	titulaire: 'ILYAS ALLALI',
	rib: '230 400 5524413211017800 77',
	iban: 'MA64 2304 0055 2441 3211 0178 0077',
	swift: 'CIHMMAMC',
};

// Language options for bot
const LANGUAGE_OPTIONS = [
	{ id: 'darija', label: 'العربية الدارجة (Darija)', default: true },
	{ id: 'french', label: 'Français', default: true },
	{ id: 'english', label: 'English', default: false },
	{ id: 'arabic_msa', label: 'العربية الفصحى (MSA)', default: false },
];

export default function SettingsPage() {
	const { user, refreshProfile, profile, isSubscriptionExpired, isNicheActive } = useAuth();
	const { toast } = useToast();

	const [loading, setLoading] = useState(false);
	const [uploading, setUploading] = useState(false);
	const [copiedField, setCopiedField] = useState<string | null>(null);

	// Profile fields
	const [clinicName, setClinicName] = useState('');
	const [avatarUrl, setAvatarUrl] = useState('');
	const [isAiEnabled, setIsAiEnabled] = useState(true);

	// Structured bot config fields (replaces raw prompt)
	const [workingHours, setWorkingHours] = useState('Mon-Sat 09:00-18:00');
	const [tone, setTone] = useState('professional,welcoming');
	const [selectedLanguages, setSelectedLanguages] = useState<string[]>(['darija', 'french']);
	const [additionalInfo, setAdditionalInfo] = useState('');

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
			const { data: botData } = await supabase
				.from('bot_configs')
				.select('system_prompt, cooldown_seconds, reminder_message, reminder_rules, working_hours, tone, languages, additional_info')
				.eq('user_id', user.id)
				.maybeSingle();

			if (botData) {
				// @ts-ignore
				if (botData.cooldown_seconds != null) setCooldownSeconds(botData.cooldown_seconds);
				// @ts-ignore
				if (botData.reminder_message) setReminderMessage(botData.reminder_message);
				// @ts-ignore
				if (botData.working_hours) setWorkingHours(botData.working_hours);
				// @ts-ignore
				if (botData.tone) setTone(botData.tone);
				// @ts-ignore
				if (botData.languages) {
					// @ts-ignore
					setSelectedLanguages(botData.languages.split(',').filter(Boolean));
				}
				// @ts-ignore
				if (botData.additional_info) setAdditionalInfo(botData.additional_info);
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

			// B. Update Bot Config
			const { data: existingBot } = await supabase
				.from('bot_configs')
				.select('user_id')
				.eq('user_id', user.id)
				.maybeSingle();

			// Convert reminder rules to DB format
			const dbReminderRules = reminderRules.map(r => ({
				minutes_before: r.minutes_before,
				enabled: r.enabled
			}));

			const botPayload = {
				cooldown_seconds: cooldownSeconds,
				reminder_message: reminderMessage,
				reminder_rules: dbReminderRules,
				working_hours: workingHours,
				tone: tone,
				languages: selectedLanguages.join(','),
				additional_info: additionalInfo,
				// Clear system_prompt so backend auto-generates from structured fields
				system_prompt: '',
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
			toast({ title: 'Saved', description: 'Settings updated successfully.' });

		} catch (error: any) {
			toast({ variant: 'destructive', title: 'Error', description: error.message });
		} finally {
			setLoading(false);
		}
	};

	const toggleLanguage = (langId: string) => {
		setSelectedLanguages(prev =>
			prev.includes(langId)
				? prev.filter(l => l !== langId)
				: [...prev, langId]
		);
	};

	const copyToClipboard = (text: string, field: string) => {
		navigator.clipboard.writeText(text);
		setCopiedField(field);
		setTimeout(() => setCopiedField(null), 2000);
		toast({ description: 'Copied to clipboard!' });
	};

	return (
		<AppLayout>
			<div className="space-y-6 max-w-4xl mx-auto">
				<div>
					<h1 className="text-3xl font-bold mb-2">Settings</h1>
					<p className="text-muted-foreground">Manage your identity and AI configuration.</p>
				</div>

				{/* ============== EXPIRED SUBSCRIPTION BANNER ============== */}
				{isSubscriptionExpired && (
					<Card className="border-red-500/30 bg-red-500/5">
						<CardContent className="p-6">
							<div className="flex items-start gap-4">
								<div className="h-12 w-12 rounded-xl bg-red-500/20 flex items-center justify-center shrink-0">
									<AlertTriangle className="h-6 w-6 text-red-500" />
								</div>
								<div className="flex-1 space-y-4">
									<div>
										<h3 className="text-lg font-semibold text-red-400">Your Trial / Subscription Has Expired</h3>
										<p className="text-sm text-muted-foreground mt-1">
											To continue using Mojib.AI, please contact us or make a bank transfer with these details:
										</p>
									</div>
									
									<div className="grid gap-3 p-4 rounded-xl bg-black/30 border border-white/10 font-mono text-sm">
										{[
											{ label: 'Titulaire', value: BANK_INFO.titulaire, key: 'titulaire' },
											{ label: 'RIB', value: BANK_INFO.rib, key: 'rib' },
											{ label: 'IBAN', value: BANK_INFO.iban, key: 'iban' },
											{ label: 'Code SWIFT', value: BANK_INFO.swift, key: 'swift' },
										].map(item => (
											<div key={item.key} className="flex items-center justify-between gap-2">
												<div className="flex-1 min-w-0">
													<span className="text-muted-foreground text-xs">{item.label}:</span>
													<p className="text-foreground truncate">{item.value}</p>
												</div>
												<Button
													variant="ghost"
													size="icon"
													className="h-8 w-8 shrink-0"
													onClick={() => copyToClipboard(item.value, item.key)}
												>
													{copiedField === item.key ? (
														<CheckCircle2 className="h-4 w-4 text-green-500" />
													) : (
														<Copy className="h-4 w-4 text-muted-foreground" />
													)}
												</Button>
											</div>
										))}
									</div>

									<div className="flex gap-3">
										<Button
											onClick={() => window.open(`https://wa.me/212600000000?text=${encodeURIComponent('Hello, I want to activate my Mojib.AI subscription.')}`, '_blank')}
											className="bg-[#25D366] hover:bg-[#25D366]/90 text-black font-medium"
										>
											Contact on WhatsApp
										</Button>
									</div>
								</div>
							</div>
						</CardContent>
					</Card>
				)}

				{/* ============== COMING SOON OVERLAY FOR INACTIVE NICHES ============== */}
				{!isNicheActive && (
					<Card className="border-yellow-500/30 bg-yellow-500/5">
						<CardContent className="p-6 text-center space-y-4">
							<div className="h-16 w-16 mx-auto rounded-2xl bg-yellow-500/20 flex items-center justify-center">
								<Bot className="h-8 w-8 text-yellow-500" />
							</div>
							<h3 className="text-xl font-bold text-yellow-400">🚧 Coming Soon</h3>
							<p className="text-muted-foreground max-w-md mx-auto">
								AI bot configuration for your industry is under development. 
								The calendar and appointments features are available now. 
								Contact support for more information.
							</p>
							<Button
								variant="outline"
								onClick={() => window.open(`https://wa.me/212600000000?text=${encodeURIComponent('Hello, I want to know when my industry will be supported on Mojib.AI.')}`, '_blank')}
								className="border-yellow-500/30 text-yellow-500 hover:bg-yellow-500/10"
							>
								Contact Support
							</Button>
						</CardContent>
					</Card>
				)}

				{/* ============== MAIN CONFIG (Only for active niches) ============== */}
				{isNicheActive && (
					<>
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
										<Label>Clinic / Business Name</Label>
										<Input
											value={clinicName}
											onChange={(e) => setClinicName(e.target.value)}
											placeholder="e.g. Smile Dental"
											disabled={isSubscriptionExpired}
										/>
									</div>
								</CardContent>
							</Card>

							{/* Bot Personality Card */}
							<Card className="glass-card">
								<CardHeader>
									<CardTitle className="flex items-center gap-2">
										<Bot className="h-5 w-5 text-primary" />
										AI Agent Configuration
									</CardTitle>
									<CardDescription>
										Configure how your AI receptionist behaves. No need to write prompts — just fill in the details.
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

									{/* Working Hours */}
									<div className="space-y-2">
										<Label>Working Hours</Label>
										<Input
											value={workingHours}
											onChange={(e) => setWorkingHours(e.target.value)}
											placeholder="e.g. Mon-Sat 09:00-18:00"
											disabled={isSubscriptionExpired}
										/>
										<p className="text-xs text-muted-foreground">The hours your clinic is open for appointments.</p>
									</div>

									{/* Tone */}
									<div className="space-y-2">
										<Label>Agent Tone</Label>
										<Select value={tone} onValueChange={setTone} disabled={isSubscriptionExpired}>
											<SelectTrigger>
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="professional,welcoming">Professional & Welcoming</SelectItem>
												<SelectItem value="friendly,casual">Friendly & Casual</SelectItem>
												<SelectItem value="formal,direct">Formal & Direct</SelectItem>
											</SelectContent>
										</Select>
									</div>

									{/* Languages */}
									<div className="space-y-2">
										<Label className="flex items-center gap-2">
											<Languages className="h-4 w-4" />
											Bot Languages
										</Label>
										<div className="flex flex-wrap gap-2">
											{LANGUAGE_OPTIONS.map(lang => (
												<button
													key={lang.id}
													type="button"
													onClick={() => toggleLanguage(lang.id)}
													disabled={isSubscriptionExpired}
													className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
														selectedLanguages.includes(lang.id)
															? 'bg-primary/20 text-primary border-primary/30'
															: 'bg-secondary/30 text-muted-foreground border-border/50 hover:border-primary/20'
													}`}
												>
													{lang.label}
												</button>
											))}
										</div>
										<p className="text-xs text-muted-foreground">Default: Darija (Arabic letters) + French</p>
									</div>
								</CardContent>
							</Card>
						</div>

						{/* Additional Info Card */}
						<Card className="glass-card">
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<Info className="h-5 w-5 text-primary" />
									Additional Info for the AI
								</CardTitle>
								<CardDescription>
									Add details the bot should know: prices, specialties, accepted insurance (CNSS/CNOPS), special procedures, etc.
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-4">
								<Textarea
									value={additionalInfo}
									onChange={(e) => setAdditionalInfo(e.target.value)}
									className="min-h-[150px] font-mono text-sm bg-secondary/50 leading-relaxed"
									placeholder={`Example:\n- Consultation: 200 DH\n- Détartrage: 300 DH\n- We accept CNSS\n- Specialties: Orthodontie, Implantologie\n- Free parking available`}
									disabled={isSubscriptionExpired}
								/>
								<Button onClick={handleSave} disabled={loading || isSubscriptionExpired} className="w-full">
									<Save className="mr-2 h-4 w-4" />
									{loading ? 'Saving...' : 'Save Configuration'}
								</Button>
							</CardContent>
						</Card>
					</>
				)}

				{/* Bot Behavior Card (accessible for all niches) */}
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
							{loading ? 'Saving...' : 'Save Settings'}
						</Button>
					</CardContent>
				</Card>

				{/* Subscription Section */}
				<Card className="glass-card">
					<CardHeader><CardTitle className="flex items-center gap-2"><CreditCard className="h-5 w-5 text-primary" /> Subscription</CardTitle></CardHeader>
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

						{/* Bank Transfer Details */}
						<div className="p-4 rounded-xl bg-secondary/20 border border-border/50 space-y-3">
							<h4 className="text-sm font-semibold flex items-center gap-2">
								<CreditCard className="h-4 w-4 text-primary" />
								Payment by Bank Transfer
							</h4>
							<div className="grid gap-2 font-mono text-sm">
								{[
									{ label: 'Titulaire', value: BANK_INFO.titulaire, key: 'sub_titulaire' },
									{ label: 'RIB', value: BANK_INFO.rib, key: 'sub_rib' },
									{ label: 'IBAN', value: BANK_INFO.iban, key: 'sub_iban' },
									{ label: 'Code SWIFT', value: BANK_INFO.swift, key: 'sub_swift' },
								].map(item => (
									<div key={item.key} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-black/20">
										<div className="flex-1 min-w-0">
											<span className="text-muted-foreground text-xs">{item.label}:</span>
											<p className="text-foreground text-xs truncate">{item.value}</p>
										</div>
										<Button
											variant="ghost"
											size="icon"
											className="h-7 w-7 shrink-0"
											onClick={() => copyToClipboard(item.value, item.key)}
										>
											{copiedField === item.key ? (
												<CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
											) : (
												<Copy className="h-3.5 w-3.5 text-muted-foreground" />
											)}
										</Button>
									</div>
								))}
							</div>
						</div>

						<Button
							onClick={() => window.open(`https://wa.me/212600000000?text=${encodeURIComponent('Hello, I want to activate/renew my Mojib.AI subscription.')}`, '_blank')}
							className="w-full"
						>
							Contact for Activation
						</Button>
					</CardContent>
				</Card>
			</div>
		</AppLayout>
	);
}