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
				.from('bot_configs' as any)
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
				.from('bot_configs' as any)
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
					.from('bot_configs' as any)
					.update(botPayload)
					.eq('user_id', user.id));
			} else {
				({ error: configError } = await supabase
					.from('bot_configs' as any)
					.insert({ user_id: user.id, ...botPayload }));
			}

			if (configError) throw configError;

			await refreshProfile();
			toast({ title: 'Enregistré', description: 'Paramètres mis à jour avec succès.' });

		} catch (error: any) {
			toast({ variant: 'destructive', title: 'Erreur', description: error.message });
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
					<h1 className="text-3xl font-bold mb-2">Paramètres de l'IA</h1>
					<p className="text-muted-foreground">Gérez votre identité et la configuration de votre assistant IA.</p>
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
										<h3 className="text-lg font-semibold text-red-400">Votre Période d'Essai / Abonnement a Expiré</h3>
										<p className="text-sm text-muted-foreground mt-1">
											Pour continuer à utiliser Mojib.AI, veuillez nous contacter ou effectuer un virement bancaire avec ces coordonnées :
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
											onClick={() => window.open(`https://wa.me/447749343372?text=${encodeURIComponent('Bonjour, je souhaite activer mon abonnement Mojib.AI.')}`, '_blank')}
											className="bg-[#25D366] hover:bg-[#25D366]/90 text-black font-medium"
										>
											Contacter sur WhatsApp
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
							<h3 className="text-xl font-bold text-yellow-400">🚧 À Venir</h3>
							<p className="text-muted-foreground max-w-md mx-auto">
								La configuration du bot IA pour votre secteur est en cours de développement. 
								Les fonctionnalités de calendrier et de rendez-vous sont disponibles dès maintenant. 
								Contactez le support pour plus d'informations.
							</p>
							<Button
								variant="outline"
								onClick={() => window.open(`https://wa.me/447749343372?text=${encodeURIComponent('Bonjour, je veux savoir quand mon industrie sera disponible sur Mojib.AI.')}`, '_blank')}
								className="border-yellow-500/30 text-yellow-500 hover:bg-yellow-500/10"
							>
								Contacter le Support
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
										Identité de la Clinique / Entreprise
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
													{uploading ? 'Téléchargement...' : 'Changer le Logo'}
												</div>
											</Label>
											<Input id="logo-upload" type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} disabled={uploading} />
										</div>
									</div>

									<div className="space-y-2">
										<Label>Nom de la Clinique / Entreprise</Label>
										<Input
											value={clinicName}
											onChange={(e) => setClinicName(e.target.value)}
											placeholder="ex. Centre Dentaire Sourire"
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
										Configuration de l'Agent IA
									</CardTitle>
									<CardDescription>
										Configurez le comportement de votre réceptionniste IA. Pas besoin d'écrire de prompts compliqués !
									</CardDescription>
								</CardHeader>
								<CardContent className="space-y-4">
									<div className="flex items-center justify-between mb-2">
										<div className="flex items-center gap-2">
											<Label htmlFor="ai-toggle" className="text-sm font-medium">Activer l'IA</Label>
											{isSubscriptionExpired && (
												<TooltipProvider>
													<Tooltip>
														<TooltipTrigger><Info className="h-4 w-4 text-destructive" /></TooltipTrigger>
														<TooltipContent>Abonnement expiré.</TooltipContent>
													</Tooltip>
												</TooltipProvider>
											)}
										</div>
										<Switch id="ai-toggle" checked={isAiEnabled} onCheckedChange={setIsAiEnabled} disabled={isSubscriptionExpired} />
									</div>

									{/* Working Hours */}
									<div className="space-y-2">
										<Label>Horaires de Travail</Label>
										<Input
											value={workingHours}
											onChange={(e) => setWorkingHours(e.target.value)}
											placeholder="ex. Lun-Sam 09:00-18:00"
											disabled={isSubscriptionExpired}
										/>
										<p className="text-xs text-muted-foreground">Les heures d'ouverture de votre clinique.</p>
									</div>

									{/* Tone */}
									<div className="space-y-2">
										<Label>Ton de l'Agent</Label>
										<Select value={tone} onValueChange={setTone} disabled={isSubscriptionExpired}>
											<SelectTrigger>
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="professional,welcoming">Professionnel & Accueillant</SelectItem>
												<SelectItem value="friendly,casual">Amical & Décontracté</SelectItem>
												<SelectItem value="formal,direct">Formel & Direct</SelectItem>
											</SelectContent>
										</Select>
									</div>

									{/* Languages */}
									<div className="space-y-2">
										<Label className="flex items-center gap-2">
											<Languages className="h-4 w-4" />
											Langues du Bot
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
										<p className="text-xs text-muted-foreground">Par défaut : Darija (lettres arabes) + Français</p>
									</div>
								</CardContent>
							</Card>
						</div>

						{/* Additional Info Card */}
						<Card className="glass-card">
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<Info className="h-5 w-5 text-primary" />
									Informations Supplémentaires (IA)
								</CardTitle>
								<CardDescription>
									Ajoutez des détails : tarifs, spécialités, assurance (CNSS/CNOPS), ou autres informations clés.
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-4">
								<Textarea
									value={additionalInfo}
									onChange={(e) => setAdditionalInfo(e.target.value)}
									className="min-h-[150px] font-mono text-sm bg-secondary/50 leading-relaxed"
									placeholder={`Exemple:\n- Consultation: 200 DH\n- Détartrage: 300 DH\n- Nous acceptons la CNSS\n- Spécialités: Orthodontie, Implantologie`}
									disabled={isSubscriptionExpired}
								/>
								<Button onClick={handleSave} disabled={loading || isSubscriptionExpired} className="w-full">
									<Save className="mr-2 h-4 w-4" />
									{loading ? 'Enregistrement...' : 'Enregistrer la Configuration'}
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
							Comportement du Bot
						</CardTitle>
						<CardDescription>Contrôlez les délais de réponse de l'IA.</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="space-y-3">
							<div className="flex items-center justify-between">
								<Label>Délai d'attente / Cooldown (secondes)</Label>
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
							<p className="text-xs text-muted-foreground">Temps de pause avant la reprise automatique de l'IA après une réponse humaine manuelle.</p>
						</div>
					</CardContent>
				</Card>

				{/* Appointment Reminders Card */}
				<Card className="glass-card">
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Bell className="h-5 w-5 text-primary" />
							Rappels de Rendez-vous
						</CardTitle>
						<CardDescription>Configurez les rappels automatiques WhatsApp pour les prochains rendez-vous.</CardDescription>
					</CardHeader>
					<CardContent className="space-y-6">
						{/* Reminder Rules */}
						<div className="space-y-3">
							<Label>Planification des Rappels</Label>
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
											<SelectItem value="heures">heures</SelectItem>
											<SelectItem value="jours">jours</SelectItem>
										</SelectContent>
									</Select>
									<span className="text-sm text-muted-foreground">avant</span>
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
								<Plus className="h-4 w-4" /> Ajouter un Rappel
							</Button>
						</div>

						{/* Reminder Message */}
						<div className="space-y-2">
							<Label>Modèle du Message de Rappel</Label>
							<Textarea
								value={reminderMessage}
								onChange={(e) => setReminderMessage(e.target.value)}
								className="min-h-[100px] font-mono text-sm bg-secondary/50"
								placeholder={`مرحبا {patient_name}، هاد تذكير بالموعد ديالك في {clinic_name} نهار {time}. نتمناو نشوفوك!`}
								disabled={isSubscriptionExpired}
							/>
							<p className="text-xs text-muted-foreground mt-2">
								Variables disponibles : <code>{'{patient_name}'}</code>, <code>{'{clinic_name}'}</code>, <code>{'{time}'}</code>
							</p>
						</div>

						<Button onClick={handleSave} disabled={loading || isSubscriptionExpired} className="w-full">
							<Save className="mr-2 h-4 w-4" />
							{loading ? 'Enregistrement...' : 'Enregistrer la Configuration'}
						</Button>
					</CardContent>
				</Card>

				{/* Subscription Section */}
				<Card className="glass-card">
					<CardHeader><CardTitle className="flex items-center gap-2"><CreditCard className="h-5 w-5 text-primary" /> Abonnement</CardTitle></CardHeader>
					<CardContent className="space-y-6">
						<div className="grid gap-4 md:grid-cols-3">
							<div className="rounded-lg border p-4 bg-secondary/20">
								<p className="text-sm text-muted-foreground">Plan</p>
								<p className="text-lg font-semibold capitalize">
									{planType === 'essentiel' ? "L'Essentiel" : planType === 'pro' ? "Le Pro" : planType === 'elite' ? "L'Elite" : planType}
								</p>
							</div>
							<div className="rounded-lg border p-4 bg-secondary/20">
								<p className="text-sm text-muted-foreground">Statut</p>
								<p className="text-lg font-semibold capitalize">{subscriptionStatus}</p>
							</div>
							<div className="rounded-lg border p-4 bg-secondary/20">
								<p className="text-sm text-muted-foreground">Essai restant</p>
								<p className="text-lg font-semibold">{subscriptionStatus === 'trial' ? `${getTrialDaysLeft(trialEndsAt)} jours` : 'N/A'}</p>
							</div>
						</div>

						{/* Bank Transfer Details */}
						<div className="p-4 rounded-xl bg-secondary/20 border border-border/50 space-y-3">
							<h4 className="text-sm font-semibold flex items-center gap-2">
								<CreditCard className="h-4 w-4 text-primary" />
								Paiement par Virement Bancaire
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
							onClick={() => window.open(`https://wa.me/447749343372?text=${encodeURIComponent(`Bonjour, je souhaite activer/renouveler mon abonnement ${planType !== 'elite' ? 'ou passer au plan Supérieur' : ''} sur Mojib.AI.`)}`, '_blank')}
							className="w-full"
						>
							Contacter pour {planType !== 'elite' ? 'Activer ou Upgrader' : 'Activation'}
						</Button>
					</CardContent>
				</Card>
			</div>
		</AppLayout>
	);
}