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
import { Bot, Save, Building2, Upload, Loader2, Info, Clock, Bell, Plus, Trash2, Languages, AlertTriangle, CreditCard, CalendarDays, Users } from 'lucide-react';
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

type PlanType = 'essentiel' | 'pro' | 'elite';

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
	const [planActionLoading, setPlanActionLoading] = useState<PlanType | null>(null);

	// Profile fields
	const [clinicName, setClinicName] = useState('');
	const [avatarUrl, setAvatarUrl] = useState('');
	const [isAiEnabled, setIsAiEnabled] = useState(true);

	// Structured bot config fields (replaces raw prompt)
	const [workingHours, setWorkingHours] = useState('Mon-Sat 09:00-18:00');
	const [tone, setTone] = useState('professional,welcoming');
	const [selectedLanguages, setSelectedLanguages] = useState<string[]>(['darija', 'french']);
	const [additionalInfo, setAdditionalInfo] = useState('');
	const [slotCapacity, setSlotCapacity] = useState(1);
	const [slotIntervalMinutes, setSlotIntervalMinutes] = useState(30);

	// Cooldown & Reminder state
	const [cooldownSeconds, setCooldownSeconds] = useState(60);
	const [reminderRules, setReminderRules] = useState<{minutes_before: number; enabled: boolean; unit: string; value: number}[]>([]);
	const [reminderMessage, setReminderMessage] = useState('مرحبا {patient_name}، هاد تذكير بالموعد ديالك في {clinic_name} نهار {time}. نتمناو نشوفوك!');

	// Subscription Helpers
	const planType = profile?.plan_type || 'essentiel';
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
				.select('system_prompt, cooldown_seconds, reminder_message, reminder_rules, working_hours, tone, languages, additional_info, slot_capacity, slot_interval_minutes')
				.eq('user_id', user.id)
				.maybeSingle();

			if (botData) {
				// @ts-ignore
				if (botData.cooldown_seconds != null) setCooldownSeconds(botData.cooldown_seconds);
				// @ts-ignore
				if (botData.slot_capacity != null) setSlotCapacity(botData.slot_capacity);
				// @ts-ignore
				if (botData.slot_interval_minutes != null) setSlotIntervalMinutes(botData.slot_interval_minutes);
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
				slot_capacity: slotCapacity,
				slot_interval_minutes: slotIntervalMinutes,
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

	const isImmobilier = profile?.niche === 'immobilier';
	const isRestaurant = profile?.niche === 'restaurant';
	const isMedical = ['dentistry', 'doctor', 'beauty_center'].includes(profile?.niche || '');

	// Niche-aware labels (DB columns stay the same)
	const nicheLabels = isRestaurant
		? {
			entityName: 'Restaurant',
			namePlaceholder: 'ex. Restaurant Chez Hassan',
			personSingular: 'Client',
			personPlural: 'Clients',
			capacityLabel: 'Commandes Simultanées Max',
			capacityDesc: "Le nombre de commandes que vous pouvez traiter en simultané.",
			slotDesc: "Le temps moyen de préparation d'une commande (en minutes).",
			aiCardDesc: "Configurez le comportement de votre serveur IA WhatsApp.",
			hoursDesc: "Les horaires d'ouverture de votre restaurant.",
			additionalInfoDesc: "Ajoutez des détails : spécialités, zones de livraison, minimum de commande, etc.",
			additionalInfoPlaceholder: "Exemple:\n- Spécialités: Tajine, Couscous, Grillades\n- Livraison gratuite > 100 DH\n- Zone: Guéliz, Hivernage, Marrakech centre\n- Minimum commande livraison: 50 DH",
			reminderVar: '{patient_name} = nom du client',
		}
		: isImmobilier
		? {
			entityName: 'Agence',
			namePlaceholder: 'ex. Agence Immobilière Al Baraka',
			personSingular: 'Client',
			personPlural: 'Clients',
			capacityLabel: 'Capacité par Créneau (Clients en simultané)',
			capacityDesc: "Le nombre de clients que vous pouvez recevoir à la même heure pour des visites.",
			slotDesc: 'La durée standard réservée pour chaque visite (par ex: 30 minutes).',
			aiCardDesc: "Configurez le comportement de votre agent commercial IA. Pas besoin d'écrire de prompts compliqués !",
			hoursDesc: "Les horaires d'ouverture de votre agence.",
			additionalInfoDesc: "Ajoutez des détails : zones couvertes, types de biens, commissions, ou autres informations clés.",
			additionalInfoPlaceholder: "Exemple:\n- Zone: Marrakech, Guéliz, Hivernage\n- Types: Appartements, Villas, Locaux commerciaux\n- Commission: 2.5% du prix de vente",
			reminderVar: '{patient_name} = nom du client',
		}
		: isMedical
		? {
			entityName: 'Clinique',
			namePlaceholder: 'ex. Centre Dentaire Sourire',
			personSingular: 'Patient',
			personPlural: 'Patients',
			capacityLabel: 'Capacité par Créneau (Patients en simultané)',
			capacityDesc: "Le nombre de patients que vous pouvez recevoir à la même heure.",
			slotDesc: 'La durée standard réservée pour chaque consultation (par ex: 30 minutes).',
			aiCardDesc: "Configurez le comportement de votre réceptionniste IA. Pas besoin d'écrire de prompts compliqués !",
			hoursDesc: "Les heures d'ouverture de votre clinique.",
			additionalInfoDesc: "Ajoutez des détails : tarifs, spécialités, assurance (CNSS/CNOPS), ou autres informations clés.",
			additionalInfoPlaceholder: "Exemple:\n- Consultation: 200 DH\n- Détartrage: 300 DH\n- Nous acceptons la CNSS\n- Spécialités: Orthodontie, Implantologie",
			reminderVar: '{patient_name} = nom du patient',
		}
		: {
			entityName: 'Entreprise',
			namePlaceholder: 'ex. Mon Entreprise',
			personSingular: 'Client',
			personPlural: 'Clients',
			capacityLabel: 'Capacité par Créneau (Clients en simultané)',
			capacityDesc: "Le nombre de clients que vous pouvez recevoir à la même heure.",
			slotDesc: 'La durée standard réservée pour chaque rendez-vous (par ex: 30 minutes).',
			aiCardDesc: "Configurez le comportement de votre assistant IA. Pas besoin d'écrire de prompts compliqués !",
			hoursDesc: "Les horaires d'ouverture de votre entreprise.",
			additionalInfoDesc: "Ajoutez des détails : services proposés, tarifs, ou autres informations clés pour votre assistant IA.",
			additionalInfoPlaceholder: "Exemple:\n- Services: Consultation, Formation, Accompagnement\n- Tarifs sur devis\n- Zone d'intervention: Tout le Maroc",
			reminderVar: '{patient_name} = nom du client',
		};

	const PLAN_DISPLAY = isRestaurant
		? [
			{
				id: 'essentiel' as const,
				name: "L'Organisé",
				price: '299 DH',
				features: ['Gestion du menu', 'Suivi commandes', 'Tableau de bord'],
			},
			{
				id: 'pro' as const,
				name: "L'Automatisé",
				price: '499 DH',
				features: ["Tout dans L'Organisé", 'Serveur IA WhatsApp', 'Rappels automatiques'],
			},
			{
				id: 'elite' as const,
				name: "L'Elite",
				price: '799 DH',
				features: ["Tout dans L'Automatisé", 'Marketing WhatsApp', 'Gestion stocks avancée'],
			},
		]
		: isImmobilier
		? [
			{
				id: 'essentiel' as const,
				name: "L'Organise",
				price: '299 DH',
				features: ['Catalogue immobilier', 'Suivi leads simple', 'Tableau de bord'],
			},
			{
				id: 'pro' as const,
				name: "L'Automatise",
				price: '499 DH',
				features: ["Tout dans L'Organise", 'CRM immobilier complet', 'Matching automatise'],
			},
			{
				id: 'elite' as const,
				name: "L'Elite",
				price: '799 DH',
				features: ["Tout dans L'Automatise", 'Finance avancee', 'Priorite performance'],
			},
		]
		: [
			{
				id: 'essentiel' as const,
				name: "L'Organise",
				price: '299 DH',
				features: ['Dossiers numeriques', 'Finance & marge', 'Calendrier intelligent'],
			},
			{
				id: 'pro' as const,
				name: "L'Automatise",
				price: '499 DH',
				features: ["Tout dans L'Organise", 'Receptionniste IA WhatsApp', 'Automatisation continue'],
			},
			{
				id: 'elite' as const,
				name: "L'Elite",
				price: '799 DH',
				features: ["Tout dans L'Automatise", 'Site web haute conversion', 'Accompagnement premium'],
			},
		];

	const handlePlanChange = async (nextPlan: PlanType) => {
		if (!user) return;
		try {
			setPlanActionLoading(nextPlan);
			const updates: { plan_type: PlanType; subscription_status?: 'active' } = { plan_type: nextPlan };
			if (subscriptionStatus === 'expired') {
				updates.subscription_status = 'active';
			}
			const { error } = await supabase.from('profiles').update(updates).eq('id', user.id);
			if (error) throw error;
			await refreshProfile();
			toast({
				title: 'Plan mis a jour',
				description: nextPlan === planType ? 'Votre plan est deja actif.' : 'Votre changement de plan est applique immediatement.',
			});
		} catch (error: any) {
			toast({ variant: 'destructive', title: 'Erreur', description: error.message });
		} finally {
			setPlanActionLoading(null);
		}
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
											Choisissez ou mettez a niveau votre plan ci-dessous pour reactiver l'acces immediatement.
										</p>
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
										Identité {nicheLabels.entityName === 'Restaurant' ? 'du Restaurant' : nicheLabels.entityName === 'Agence' ? "de l'Agence" : nicheLabels.entityName === 'Clinique' ? 'de la Clinique' : "de l'Entreprise"} / Entreprise
									</CardTitle>
								</CardHeader>
								<CardContent className="space-y-6">
									<div className="flex items-center gap-4">
										<Avatar className="h-20 w-20 border-2 border-primary/20">
											<AvatarImage src={avatarUrl} className="object-cover" />
											<AvatarFallback className="text-xl font-bold bg-secondary">
												{clinicName.substring(0, 2).toUpperCase() || 'AI'}
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
										<Label>Nom {nicheLabels.entityName === 'Restaurant' ? 'du Restaurant' : nicheLabels.entityName === 'Agence' ? "de l'Agence" : nicheLabels.entityName === 'Clinique' ? 'de la Clinique' : "de l'Entreprise"} / Entreprise</Label>
										<Input
											value={clinicName}
											onChange={(e) => setClinicName(e.target.value)}
											placeholder={nicheLabels.namePlaceholder}
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
										{nicheLabels.aiCardDesc}
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
										<p className="text-xs text-muted-foreground">{nicheLabels.hoursDesc}</p>
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
									{nicheLabels.additionalInfoDesc}
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-4">
								<Textarea
									value={additionalInfo}
									onChange={(e) => setAdditionalInfo(e.target.value)}
									className="min-h-[150px] font-mono text-sm bg-secondary/50 leading-relaxed"
									placeholder={nicheLabels.additionalInfoPlaceholder}
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

				{/* Calendar Config Card (accessible for all niches) */}
				<Card className="glass-card">
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<CalendarDays className="h-5 w-5 text-primary" />
							Configuration du Calendrier
						</CardTitle>
						<CardDescription>Définissez vos règles de prise de rendez-vous pour éviter les conflits (sécurité double-booking).</CardDescription>
					</CardHeader>
					<CardContent className="space-y-6">
						<div className="space-y-3">
							<div className="flex items-center justify-between">
								<Label className="flex items-center gap-2"><Users className="h-4 w-4" /> {nicheLabels.capacityLabel}</Label>
								<span className="text-sm font-bold text-primary bg-primary/10 px-3 py-1 rounded-full">{slotCapacity} {slotCapacity > 1 ? nicheLabels.personPlural : nicheLabels.personSingular}</span>
							</div>
							<Slider
								value={[slotCapacity]}
								onValueChange={([v]) => setSlotCapacity(v)}
								min={1}
								max={10}
								step={1}
								disabled={isSubscriptionExpired}
							/>
							<p className="text-xs text-muted-foreground">{nicheLabels.capacityDesc}</p>
						</div>

						<div className="space-y-3 pt-4 border-t border-border/50">
							<div className="flex items-center justify-between">
								<Label className="flex items-center gap-2"><Clock className="h-4 w-4" /> Durée par Défaut du Créneau (minutes)</Label>
								<span className="text-sm font-bold text-primary bg-primary/10 px-3 py-1 rounded-full">{slotIntervalMinutes} min</span>
							</div>
							<Slider
								value={[slotIntervalMinutes]}
								onValueChange={([v]) => setSlotIntervalMinutes(v)}
								min={10}
								max={120}
								step={5}
								disabled={isSubscriptionExpired}
							/>
							<p className="text-xs text-muted-foreground">{nicheLabels.slotDesc}</p>
						</div>
					</CardContent>
				</Card>

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
								Variables disponibles : <code>{'{patient_name}'}</code> ({nicheLabels.reminderVar}), <code>{'{clinic_name}'}</code>, <code>{'{time}'}</code>
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
									{planType === 'essentiel' ? "L'Organisé" : planType === 'pro' ? "L'Automatisé" : planType === 'elite' ? "L'Elite" : planType}
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

						<div className="grid gap-4 md:grid-cols-3">
							{PLAN_DISPLAY.map((plan) => {
								const isCurrentPlan = plan.id === planType;
								return (
									<div key={plan.id} className={`rounded-xl border p-4 ${isCurrentPlan ? 'border-primary bg-primary/5' : 'border-border/60 bg-secondary/20'}`}>
										<div className="flex items-center justify-between">
											<p className="font-semibold">{plan.name}</p>
											{isCurrentPlan && <Badge className="bg-primary/20 text-primary border-primary/30">Actuel</Badge>}
										</div>
										<p className="text-xl font-bold mt-1">{plan.price}<span className="text-sm font-normal text-muted-foreground">/mois</span></p>
										<ul className="mt-3 space-y-1 text-xs text-muted-foreground">
											{plan.features.map((feature) => (
												<li key={feature}>- {feature}</li>
											))}
										</ul>
										<Button
											className="w-full mt-4"
											variant={isCurrentPlan ? 'secondary' : 'default'}
											onClick={() => handlePlanChange(plan.id)}
											disabled={planActionLoading !== null}
										>
											{planActionLoading === plan.id
												? 'Mise a jour...'
												: isCurrentPlan
													? 'Plan actif'
													: `Passer a ${plan.name}`}
										</Button>
									</div>
								);
							})}
						</div>
					</CardContent>
				</Card>
			</div>
		</AppLayout>
	);
}