import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Building2, Lock, Mail, Phone, Loader2, Stethoscope, Scissors, Home, Car, GraduationCap, HeartPulse, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Navigate, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

type NicheType = 'dentistry' | 'doctor' | 'beauty_center' | 'immobilier' | 'car_location' | 'centre_formation';

const NICHES: { id: NicheType; label: string; labelFr: string; icon: any; active: boolean }[] = [
  { id: 'dentistry', label: 'Dentistry', labelFr: 'Dentisterie', icon: Stethoscope, active: true },
  { id: 'doctor', label: 'Doctor / Clinic', labelFr: 'Médecin / Clinique', icon: HeartPulse, active: true },
  { id: 'beauty_center', label: 'Centres d\'esthétique', labelFr: 'Centres d\'esthétique', icon: Scissors, active: true },
  { id: 'immobilier', label: 'Real Estate', labelFr: 'Immobilier', icon: Home, active: false },
  { id: 'car_location', label: 'Car Rental', labelFr: 'Location de voitures', icon: Car, active: false },
  { id: 'centre_formation', label: 'Training Center', labelFr: 'Centre de formation', icon: GraduationCap, active: false },
];

type PlanType = 'essentiel' | 'pro' | 'elite';

const PLANS: { id: PlanType; label: string; price: string; pitchFr: string; pitchEn: string; valuesFr: string[]; valuesEn: string[]; ctaFr: string; ctaEn: string; recommended?: boolean }[] = [
  { 
    id: 'essentiel', 
    label: 'L\'Organisé', 
    price: '299 DH', 
    pitchFr: 'Tout ce dont vous avez besoin pour passer au sans papier et maîtriser vos chiffres.',
    pitchEn: 'Everything you need to go paperless and take control of your numbers.',
    valuesFr: ['Dossiers Patients Numériques', 'Suivi des Marges Financières', 'Calendrier Intelligent'], 
    valuesEn: ['Digital Patient Files (Gestion)', 'Financial Margin Tracker', 'Smart Booking Calendar'],
    ctaFr: 'Digitalisez votre cabinet aujourd\'hui.',
    ctaEn: 'Digitalize your practice today.'
  },
  { 
    id: 'pro', 
    label: 'L\'Automatisé', 
    price: '499 DH', 
    pitchFr: 'La secrétaire qui ne dort jamais. Parfait pour les cabinets très occupés.',
    pitchEn: 'The secretary that never sleeps. Perfect for busy practices that get high WhatsApp volume.',
    valuesFr: ['Tout dans L\'Organisé', 'Réceptionniste IA WhatsApp Dédiée'], 
    valuesEn: ['Everything in L\'Organisé', 'Dedicated WhatsApp AI Receptionist'],
    ctaFr: 'Ne manquez plus jamais un patient.',
    ctaEn: 'Never miss a patient again.',
    recommended: true
  },
  { 
    id: 'elite', 
    label: 'L\'Elite', 
    price: '799 DH', 
    pitchFr: 'La domination digitale absolue. Pour les cliniques qui veulent être le numéro 1.',
    pitchEn: 'Complete digital dominance. For clinics that want to be the #1 choice in their city.',
    valuesFr: ['Tout dans L\'Automatisé', 'Site Web Haute Conversion Sur-Mesure'], 
    valuesEn: ['Everything in L\'Automatisé', 'Custom High-Conversion Website'],
    ctaFr: 'Bâtissez votre autorité médicale.',
    ctaEn: 'Build your medical authority.'
  }
];

const IMMOBILIER_PLANS: typeof PLANS = [
  {
    id: 'essentiel',
    label: "L'Organise",
    price: '299 DH',
    pitchFr: 'Lancez votre activite immobiliere avec une base solide et claire.',
    pitchEn: 'Start your real estate activity with a solid and clear foundation.',
    valuesFr: ['Catalogue immobilier', 'Suivi de base des leads', 'Tableau de bord activite'],
    valuesEn: ['Real estate catalogue', 'Basic lead tracking', 'Activity dashboard'],
    ctaFr: 'Structurez votre agence des aujourd hui.',
    ctaEn: 'Structure your agency today.'
  },
  {
    id: 'pro',
    label: "L'Automatise",
    price: '499 DH',
    pitchFr: 'Optimisez la conversion de vos prospects et le matching des biens.',
    pitchEn: 'Improve prospect conversion and property matching.',
    valuesFr: ["Tout dans L'Organise", 'CRM immobilier complet', 'Matching automatise'],
    valuesEn: ["Everything in L'Organise", 'Full real estate CRM', 'Automated matching'],
    ctaFr: 'Accellerez vos ventes immobiliere.',
    ctaEn: 'Accelerate your real estate deals.',
    recommended: true
  },
  {
    id: 'elite',
    label: "L'Elite",
    price: '799 DH',
    pitchFr: 'Le mode performance maximale pour equipes et agences ambitieuses.',
    pitchEn: 'Maximum performance mode for ambitious teams and agencies.',
    valuesFr: ["Tout dans L'Automatise", 'Finance immobiliere avancee', 'Priorite support produit'],
    valuesEn: ["Everything in L'Automatise", 'Advanced real estate finance', 'Priority product support'],
    ctaFr: 'Passez au niveau agence leader.',
    ctaEn: 'Move to top-tier agency operations.'
  }
];

/** Generate a WAHA-safe session name: lowercase, no spaces, no arabic, + random digits */
function generateWahaSessionName(clinicName: string): string {
  const sanitized = clinicName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/[^\x00-\x7F]/g, '')     // remove non-ASCII (arabic etc.)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')       // replace non-alphanumeric with underscore
    .replace(/_+/g, '_')              // collapse multiple underscores
    .replace(/^_|_$/g, '')            // trim leading/trailing underscores
    .slice(0, 30);                    // limit length

  const random = Math.floor(Math.random() * 9000) + 1000; // 4-digit random
  return `${sanitized || 'clinic'}_${random}`;
}

export default function AuthPage() {
  const { signIn, signUp, user, loading, refreshProfile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [showPlansModal, setShowPlansModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PlanType>('essentiel');
  const [savingPlan, setSavingPlan] = useState(false);

  // Form States
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [clinicName, setClinicName] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedNiche, setSelectedNiche] = useState<NicheType>('dentistry');
  // Plans are shown after signup as a modal (not during signup).

  // Language toggle
  const [lang, setLang] = useState<'en' | 'fr'>('fr');
  
  // Password Reset Mode
  const [resetMode, setResetMode] = useState(false);

  if (user && !loading && !showPlansModal) {
    return <Navigate to="/dashboard" replace />;
  }

  useEffect(() => {
    if (!showPlansModal) return;
    const defaultPlan = selectedNiche === 'immobilier' ? 'pro' : 'essentiel';
    setSelectedPlan(defaultPlan);
  }, [showPlansModal, selectedNiche]);

  const t = {
    en: {
      tagline: 'The Intelligent AI Responder for Modern Business.',
      login: 'Login',
      signUp: 'Sign Up',
      email: 'Email',
      password: 'Password',
      forgotPassword: 'Forgot Password?',
      backToLogin: 'Back to Login',
      sendResetLink: 'Send Reset Link',
      signIn: 'Sign In',
      businessName: 'Business Name',
      phoneNumber: 'Phone Number',
      selectNiche: 'Select Your Industry',
      selectPlan: 'Select Subscription Plan',
      createAccount: 'Create Account',
      comingSoon: 'Coming Soon',
      loginFailed: 'Login Failed',
      missingInfo: 'Missing Info',
      fillFields: 'Please fill all required fields.',
      signUpFailed: 'Sign Up Failed',
      welcome: 'Welcome to Mojib.AI!',
      accountCreated: 'Account created. Check your email to confirm, then log in.',
      checkEmail: 'Check your email',
      resetSent: 'Password reset link sent!',
      emailPlaceholder: 'you@example.com',
      businessPlaceholder: 'e.g. Royal Dental Center',
      phonePlaceholder: '+212 6...',
    },
    fr: {
      tagline: "L'assistant IA intelligent pour les entreprises modernes.",
      login: 'Connexion',
      signUp: "S'inscrire",
      email: 'Email',
      password: 'Mot de passe',
      forgotPassword: 'Mot de passe oublié ?',
      backToLogin: 'Retour à la connexion',
      sendResetLink: 'Envoyer le lien',
      signIn: 'Se connecter',
      businessName: "Nom de l'entreprise",
      phoneNumber: 'Numéro de téléphone',
      selectNiche: 'Sélectionnez votre secteur',
      selectPlan: 'Choisir un abonnement',
      createAccount: 'Créer un compte',
      comingSoon: 'Bientôt disponible',
      loginFailed: 'Connexion échouée',
      missingInfo: 'Infos manquantes',
      fillFields: 'Veuillez remplir tous les champs requis.',
      signUpFailed: "Échec de l'inscription",
      welcome: 'Bienvenue sur Mojib.AI !',
      accountCreated: 'Compte créé. Vérifiez votre email pour confirmer, puis connectez-vous.',
      checkEmail: 'Vérifiez votre email',
      resetSent: 'Lien de réinitialisation envoyé !',
      emailPlaceholder: 'vous@exemple.com',
      businessPlaceholder: 'ex. Centre Dentaire Royal',
      phonePlaceholder: '+212 6...',
    },
  }[lang];

  const plansForSelectedNiche = selectedNiche === 'immobilier' ? IMMOBILIER_PLANS : PLANS;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    const { error } = await signIn(email, password);
    setIsLoading(false);
    
    if (error) {
      toast({ variant: 'destructive', title: t.loginFailed, description: error.message });
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast({ variant: 'destructive', title: 'Error', description: 'Please enter your email address first.' });
      return;
    }
    
    setIsLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/update-password`,
    });
    setIsLoading(false);
    
    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } else {
      toast({ title: t.checkEmail, description: t.resetSent });
      setResetMode(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clinicName || !phone || !email || !password) {
      toast({ variant: 'destructive', title: t.missingInfo, description: t.fillFields });
      return;
    }

    setIsLoading(true);
    const wahaSessionName = generateWahaSessionName(clinicName);
    
    const { error } = await signUp(email, password, {
      clinic_name: clinicName,
      phone: phone,
      niche: selectedNiche,
      waha_session_name: wahaSessionName,
    });
    setIsLoading(false);

    if (error) {
      toast({ variant: 'destructive', title: t.signUpFailed, description: error.message });
    } else {
      toast({ title: t.welcome, description: t.accountCreated });
      setShowPlansModal(true);
    }
  };

  const handleChoosePlan = async () => {
    if (!user) {
      setShowPlansModal(false);
      navigate('/dashboard');
      return;
    }

    try {
      setSavingPlan(true);
      const { error } = await supabase
        .from('profiles')
        .update({ plan_type: selectedPlan })
        .eq('id', user.id);

      if (error) throw error;

      await refreshProfile();
      toast({
        title: lang === 'fr' ? 'Plan enregistré' : 'Plan saved',
        description: lang === 'fr' ? 'Vous pouvez changer de plan à tout moment depuis Paramètres.' : 'You can change your plan anytime from Settings.',
      });
      setShowPlansModal(false);
      navigate('/dashboard');
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: lang === 'fr' ? 'Erreur' : 'Error',
        description: error?.message || (lang === 'fr' ? 'Impossible de choisir le plan.' : 'Unable to choose plan.'),
      });
    } finally {
      setSavingPlan(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-background pattern-grid opacity-20" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
      
      <Card className="w-full max-w-lg glass-card relative z-10 border-primary/20">
        <CardHeader className="text-center space-y-2">
          <div className="flex justify-end">
            <button
              onClick={() => setLang(lang === 'en' ? 'fr' : 'en')}
              className="text-xs font-medium px-3 py-1.5 rounded-full bg-secondary/50 hover:bg-secondary border border-primary/10 transition-colors"
            >
              {lang === 'en' ? '🇫🇷 FR' : '🇬🇧 EN'}
            </button>
          </div>
          <div className="mx-auto w-12 h-12 bg-primary/20 rounded-xl flex items-center justify-center mb-2">
            <Building2 className="w-6 h-6 text-primary" />
          </div>
          <CardTitle className="text-3xl font-bold tracking-tight">
            MOJIB<span className="text-primary">.AI</span>
          </CardTitle>
          <CardDescription>
            {t.tagline}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6 bg-secondary/50">
              <TabsTrigger value="login">{t.login}</TabsTrigger>
              <TabsTrigger value="register">{t.signUp}</TabsTrigger>
            </TabsList>

            {/* LOGIN FORM */}
            <TabsContent value="login">
              <form className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">{t.email}</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input 
                      id="email" 
                      type="email" 
                      placeholder={t.emailPlaceholder}
                      className="pl-9 bg-secondary/30"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>

                {!resetMode && (
                  <div className="space-y-2">
                    <Label htmlFor="password">{t.password}</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input 
                        id="password" 
                        type="password" 
                        className="pl-9 bg-secondary/30"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                )}

                <div className="flex justify-end">
                  <button 
                    type="button"
                    onClick={() => setResetMode(!resetMode)}
                    className="text-xs text-primary hover:underline"
                  >
                    {resetMode ? t.backToLogin : t.forgotPassword}
                  </button>
                </div>

                {resetMode ? (
                  <Button onClick={handleResetPassword} className="w-full" disabled={isLoading}>
                    {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : t.sendResetLink}
                  </Button>
                ) : (
                  <Button onClick={handleLogin} className="w-full bg-primary hover:bg-primary/90" disabled={isLoading}>
                    {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : t.signIn}
                  </Button>
                )}
              </form>
            </TabsContent>

            {/* REGISTER FORM */}
            <TabsContent value="register">
              <form onSubmit={handleRegister} className="space-y-4">
                {/* Niche Selection Grid */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">{t.selectNiche}</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {NICHES.map((niche) => (
                      <button
                        key={niche.id}
                        type="button"
                        onClick={() => setSelectedNiche(niche.id)}
                        className={cn(
                          'relative flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all duration-200 text-center',
                          selectedNiche === niche.id
                            ? 'border-primary bg-primary/10 text-primary shadow-lg shadow-primary/10'
                            : 'border-border/50 bg-secondary/20 text-muted-foreground hover:border-primary/30 hover:bg-secondary/40'
                        )}
                      >
                        <niche.icon className="h-5 w-5" />
                        <span className="text-[11px] font-medium leading-tight">
                          {lang === 'fr' ? niche.labelFr : niche.label}
                        </span>
                        {!niche.active && (
                          <span className="absolute -top-1.5 -right-1.5 text-[8px] font-bold bg-yellow-500/80 text-black px-1.5 py-0.5 rounded-full">
                            {t.comingSoon}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>{t.businessName}</Label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input 
                      placeholder={t.businessPlaceholder}
                      className="pl-9 bg-secondary/30"
                      value={clinicName}
                      onChange={(e) => setClinicName(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>{t.phoneNumber}</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input 
                      placeholder={t.phonePlaceholder}
                      className="pl-9 bg-secondary/30"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>{t.email}</Label>
                  <Input 
                    type="email" 
                    placeholder={t.emailPlaceholder}
                    className="bg-secondary/30"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label>{t.password}</Label>
                  <Input 
                    type="password" 
                    className="bg-secondary/30"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>

                <Button className="w-full" disabled={isLoading}>
                  {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : t.createAccount}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Post-signup Plans (popup/modal) */}
      <Dialog open={showPlansModal} onOpenChange={setShowPlansModal}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">
              {lang === 'fr' ? 'Choisissez votre formule' : 'Choose your plan'}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 md:grid-cols-3 pt-2">
            {plansForSelectedNiche.map((plan) => (
              <div
                key={plan.id}
                onClick={() => setSelectedPlan(plan.id)}
                className={cn(
                  'relative rounded-2xl border bg-secondary/20 p-4 flex flex-col cursor-pointer transition-all',
                  plan.recommended ? 'border-primary/30' : 'border-white/10',
                  selectedPlan === plan.id && 'ring-2 ring-primary border-primary'
                )}
              >
                {plan.recommended && (
                  <span className="absolute -top-3 left-4 bg-primary text-primary-foreground text-[10px] font-black px-2 py-1 rounded-full uppercase tracking-widest shadow-lg shadow-primary/20">
                    Recommandé
                  </span>
                )}
                <div className="mt-2">
                  <div className="text-lg font-black">{plan.label}</div>
                  <div className="text-2xl font-black mt-1">
                    {plan.price}
                    <span className="text-sm font-normal opacity-70">/mo</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed mt-2">
                    {lang === 'fr' ? plan.pitchFr : plan.pitchEn}
                  </p>
                </div>
                <div className="space-y-2 mt-auto pt-3">
                  {(lang === 'fr' ? plan.valuesFr : plan.valuesEn).map((val, idx) => (
                    <div key={idx} className="flex items-start gap-2.5 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <span className="text-xs font-medium leading-relaxed text-muted-foreground">
                        {val}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between pt-4">
            <Button
              variant="secondary"
              onClick={() => {
                setShowPlansModal(false);
                if (user) navigate('/dashboard');
              }}
            >
              {lang === 'fr' ? 'Continuer' : 'Continue'}
            </Button>
            <Button
              onClick={handleChoosePlan}
              disabled={savingPlan}
              className="sm:w-auto"
            >
              {savingPlan
                ? (lang === 'fr' ? 'Enregistrement...' : 'Saving...')
                : (lang === 'fr' ? 'Choisir ce plan' : 'Choose this plan')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}