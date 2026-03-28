import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronRight, ChevronLeft, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/hooks/useLanguage';

export interface OnboardingStep {
  titleKey: string;
  descKey: string;
  icon: React.ReactNode;
  gradient: string;
}

interface OnboardingPopupProps {
  pageKey: string;
  steps: OnboardingStep[];
}

const STORAGE_KEY = 'neora_onboarding_seen';

function getSeenPages(): string[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function markPageSeen(pageKey: string) {
  const seen = getSeenPages();
  if (!seen.includes(pageKey)) {
    seen.push(pageKey);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seen));
  }
}

export function OnboardingPopup({ pageKey, steps }: OnboardingPopupProps) {
  const { t, lang } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    const seen = getSeenPages();
    if (!seen.includes(pageKey)) {
      // Delay slightly so the page renders first
      const timer = setTimeout(() => setIsOpen(true), 800);
      return () => clearTimeout(timer);
    }
  }, [pageKey]);

  const handleClose = () => {
    setIsOpen(false);
    markPageSeen(pageKey);
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleClose();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) setCurrentStep(currentStep - 1);
  };

  const step = steps[currentStep];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
            onClick={handleClose}
          />

          {/* Popup */}
          <motion.div
            initial={{ opacity: 0, scale: 0.85, y: 40 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.85, y: 40 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
          >
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full pointer-events-auto overflow-hidden">
              {/* Animated Header */}
              <motion.div
                key={currentStep}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
                className={`relative p-8 pb-12 ${step.gradient}`}
              >
                <button
                  onClick={handleClose}
                  className="absolute top-3 right-3 h-8 w-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>

                {/* 3D-style floating icon */}
                <motion.div
                  initial={{ y: 20, rotateY: -30 }}
                  animate={{ y: 0, rotateY: 0 }}
                  transition={{ type: 'spring', stiffness: 200, delay: 0.1 }}
                  className="h-20 w-20 rounded-2xl bg-white/20 backdrop-blur-sm border border-white/30 flex items-center justify-center mx-auto mb-4"
                  style={{ perspective: '800px', transformStyle: 'preserve-3d' }}
                >
                  <motion.div
                    animate={{ rotateY: [0, 10, -10, 0] }}
                    transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                    className="text-white"
                  >
                    {step.icon}
                  </motion.div>
                </motion.div>

                {/* Floating particles */}
                {[...Array(5)].map((_, i) => (
                  <motion.div
                    key={i}
                    className="absolute h-2 w-2 rounded-full bg-white/20"
                    initial={{ x: Math.random() * 300, y: Math.random() * 120 }}
                    animate={{
                      y: [Math.random() * 120, Math.random() * 60, Math.random() * 120],
                      opacity: [0.2, 0.5, 0.2],
                    }}
                    transition={{ duration: 3 + i, repeat: Infinity, ease: 'easeInOut' }}
                  />
                ))}
              </motion.div>

              {/* Content */}
              <div className="p-6 -mt-6 relative">
                <div className="bg-white rounded-xl shadow-sm border p-5">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={currentStep}
                      initial={{ opacity: 0, x: 30 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -30 }}
                      transition={{ duration: 0.2 }}
                    >
                      <h3 className="text-lg font-bold text-foreground mb-2">{t(step.titleKey as any)}</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">{t(step.descKey as any)}</p>
                    </motion.div>
                  </AnimatePresence>
                </div>

                {/* Progress Dots */}
                <div className="flex items-center justify-center gap-1.5 mt-4">
                  {steps.map((_, i) => (
                    <motion.div
                      key={i}
                      className="rounded-full"
                      animate={{
                        width: i === currentStep ? 24 : 8,
                        height: 8,
                        backgroundColor: i === currentStep ? '#2589D0' : '#E2E8F0',
                      }}
                      transition={{ duration: 0.3 }}
                    />
                  ))}
                </div>

                {/* Navigation */}
                <div className="flex items-center justify-between mt-5">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handlePrev}
                    disabled={currentStep === 0}
                    className="gap-1"
                  >
                    <ChevronLeft className="h-4 w-4" /> {lang === 'fr' ? 'Retour' : 'Back'}
                  </Button>

                  <Button
                    size="sm"
                    onClick={handleNext}
                    className="gap-1"
                    style={{ backgroundColor: '#2589D0' }}
                  >
                    {currentStep === steps.length - 1 ? (
                      <>
                        <Sparkles className="h-4 w-4" /> {lang === 'fr' ? 'Compris !' : 'Got it!'}
                      </>
                    ) : (
                      <>
                        {lang === 'fr' ? 'Suivant' : 'Next'} <ChevronRight className="h-4 w-4" />
                      </>
                    )}
                  </Button>
                </div>

                {/* Skip */}
                <button
                  onClick={handleClose}
                  className="w-full text-center text-xs text-muted-foreground mt-3 hover:text-foreground transition-colors"
                >
                  {lang === 'fr' ? 'Passer le tutoriel' : 'Skip tutorial'}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ============================================================
// Pre-built onboarding configs for each page
// ============================================================
import { CalendarDays, MessageSquare, Settings, Users, BarChart3, Link2, Bell, Zap, Bot, Plug, Share2, UserX, Palette } from 'lucide-react';

export const ONBOARDING_CONFIGS: Record<string, OnboardingStep[]> = {
  dashboard: [
    { titleKey: 'onboarding.dashboard.1.title', descKey: 'onboarding.dashboard.1.desc', icon: <BarChart3 className="h-10 w-10" />, gradient: 'bg-gradient-to-br from-[#2589D0] to-[#1a6fb0]' },
    { titleKey: 'onboarding.dashboard.2.title', descKey: 'onboarding.dashboard.2.desc', icon: <Zap className="h-10 w-10" />, gradient: 'bg-gradient-to-br from-violet-500 to-purple-600' },
  ],
  appointments: [
    { titleKey: 'onboarding.appointments.1.title', descKey: 'onboarding.appointments.1.desc', icon: <CalendarDays className="h-10 w-10" />, gradient: 'bg-gradient-to-br from-[#2589D0] to-[#1a6fb0]' },
    { titleKey: 'onboarding.appointments.2.title', descKey: 'onboarding.appointments.2.desc', icon: <UserX className="h-10 w-10" />, gradient: 'bg-gradient-to-br from-violet-500 to-purple-600' },
    { titleKey: 'onboarding.appointments.3.title', descKey: 'onboarding.appointments.3.desc', icon: <Share2 className="h-10 w-10" />, gradient: 'bg-gradient-to-br from-emerald-500 to-green-600' },
    { titleKey: 'onboarding.appointments.4.title', descKey: 'onboarding.appointments.4.desc', icon: <Palette className="h-10 w-10" />, gradient: 'bg-gradient-to-br from-amber-500 to-orange-600' },
  ],
  connect: [
    { titleKey: 'onboarding.connect.1.title', descKey: 'onboarding.connect.1.desc', icon: <Plug className="h-10 w-10" />, gradient: 'bg-gradient-to-br from-green-500 to-emerald-600' },
    { titleKey: 'onboarding.connect.2.title', descKey: 'onboarding.connect.2.desc', icon: <Bot className="h-10 w-10" />, gradient: 'bg-gradient-to-br from-[#2589D0] to-[#1a6fb0]' },
    { titleKey: 'onboarding.connect.3.title', descKey: 'onboarding.connect.3.desc', icon: <MessageSquare className="h-10 w-10" />, gradient: 'bg-gradient-to-br from-violet-500 to-purple-600' },
  ],
  settings: [
    { titleKey: 'onboarding.settings.1.title', descKey: 'onboarding.settings.1.desc', icon: <Settings className="h-10 w-10" />, gradient: 'bg-gradient-to-br from-slate-600 to-slate-800' },
    { titleKey: 'onboarding.settings.2.title', descKey: 'onboarding.settings.2.desc', icon: <Bell className="h-10 w-10" />, gradient: 'bg-gradient-to-br from-amber-500 to-orange-600' },
    { titleKey: 'onboarding.settings.3.title', descKey: 'onboarding.settings.3.desc', icon: <CalendarDays className="h-10 w-10" />, gradient: 'bg-gradient-to-br from-[#2589D0] to-[#1a6fb0]' },
  ],
  crm: [
    { titleKey: 'onboarding.crm.1.title', descKey: 'onboarding.crm.1.desc', icon: <Users className="h-10 w-10" />, gradient: 'bg-gradient-to-br from-[#2589D0] to-[#1a6fb0]' },
    { titleKey: 'onboarding.crm.2.title', descKey: 'onboarding.crm.2.desc', icon: <Zap className="h-10 w-10" />, gradient: 'bg-gradient-to-br from-emerald-500 to-green-600' },
  ],
  finance: [
    { titleKey: 'onboarding.finance.1.title', descKey: 'onboarding.finance.1.desc', icon: <BarChart3 className="h-10 w-10" />, gradient: 'bg-gradient-to-br from-emerald-500 to-green-600' },
    { titleKey: 'onboarding.finance.2.title', descKey: 'onboarding.finance.2.desc', icon: <Zap className="h-10 w-10" />, gradient: 'bg-gradient-to-br from-[#2589D0] to-[#1a6fb0]' },
  ],
};
