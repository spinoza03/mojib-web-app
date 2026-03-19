import { NavLink, useLocation } from 'react-router-dom';
import { Home, Calendar, Smartphone, Settings, LogOut, Shield, Stethoscope, HeartPulse, Scissors, Home as HomeIcon, Car, GraduationCap, Users, PieChart } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { useAuth, type FeatureName, type NicheType } from '@/hooks/useAuth';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';

const NICHE_CONFIG: Record<NicheType, { label: string; icon: any; active: boolean }> = {
  dentistry: { label: '🦷 Dentisterie', icon: Stethoscope, active: true },
  doctor: { label: '🩺 Médecin / Clinique', icon: HeartPulse, active: true },
  beauty_center: { label: '💆 Centre de Beauté', icon: Scissors, active: true },
  immobilier: { label: '🏠 Immobilier', icon: HomeIcon, active: false },
  car_location: { label: '🚗 Location Voitures', icon: Car, active: false },
  centre_formation: { label: '🎓 Centre Formation', icon: GraduationCap, active: false },
};

const navItems: Array<{ icon: any; label: string; path: string; feature: FeatureName }> = [
  { icon: Home, label: 'Tableau de Bord', path: '/dashboard', feature: 'dashboard' },
  { icon: Users, label: 'Patients (CRM)', path: '/crm', feature: 'crm' },
  { icon: PieChart, label: 'Finances & Marge', path: '/finance', feature: 'finance' },
  { icon: Calendar, label: 'Gérer Rendez-vous', path: '/appointments', feature: 'calendar-sync' },
  { icon: Smartphone, label: 'Connecter WhatsApp', path: '/connect', feature: 'chat' },
  { icon: Settings, label: 'Configuration IA', path: '/settings', feature: 'advanced-settings' },
];

export function Sidebar() {
  const location = useLocation();
  const { profile, signOut, user, canAccessFeature } = useAuth();

  const handleLogout = async () => {
    await signOut();
    window.location.href = '/auth';
  };

  const userInitials = profile?.clinic_name
    ? profile.clinic_name.substring(0, 2).toUpperCase()
    : 'DR';

  const getTrialDaysLeft = (trialEndsAt?: string | null) => {
    if (!trialEndsAt) return 0;
    const endDate = new Date(trialEndsAt);
    const today = new Date();
    const diff = endDate.getTime() - today.getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  const renderSubscriptionBadge = () => {
    if (!profile) return null;
    if (profile.subscription_status === 'trial') {
      const daysLeft = getTrialDaysLeft(profile.trial_ends_at);
      return (
        <Badge className="bg-yellow-500/20 text-yellow-600 border-yellow-500/30">
          🎁 Essai : {daysLeft} Jours Restants
        </Badge>
      );
    }
    if (profile.subscription_status === 'active') {
      return (
        <Badge className="bg-green-500/20 text-green-600 border-green-500/30">
          ✅ Plan PRO
        </Badge>
      );
    }
    return (
      <Badge className="bg-red-500/20 text-red-600 border-red-500/30">
        ⛔ Expiré
      </Badge>
    );
  };

  // Check superuser role
  const isAdmin = profile?.role === 'superuser';

  return (
    <motion.aside
      initial={{ x: -80, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="fixed left-0 top-0 z-40 h-screen w-64 glass border-r border-[hsl(var(--glass-border))]"
    >
      <div className="flex h-full flex-col">
        {/* Logo Section */}
        <div className="flex h-20 items-center px-6 border-b border-[hsl(var(--glass-border))]">
          <span className="text-2xl font-extrabold tracking-tight font-sans">
            <span className="text-[#333C45]">MOJIB</span>
            <span className="text-[#2589D0]">.AI</span>
          </span>
        </div>
        <div className="px-6 py-3 border-b border-[hsl(var(--glass-border))] space-y-2">
          {renderSubscriptionBadge()}
          {profile?.niche && (
            <div>
              <Badge className={cn(
                'text-xs',
                NICHE_CONFIG[profile.niche]?.active
                  ? 'bg-primary/10 text-primary border-primary/20'
                  : 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
              )}>
                {NICHE_CONFIG[profile.niche]?.label || profile.niche}
                {!NICHE_CONFIG[profile.niche]?.active && ' · Beta'}
              </Badge>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-6 space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            const isAllowed = canAccessFeature(item.feature);

            if (!isAllowed) {
              return (
                <div
                  key={item.path}
                  className="flex items-center gap-3 px-4 py-3 rounded-lg text-muted-foreground opacity-50 cursor-not-allowed"
                >
                  <item.icon className="h-5 w-5" />
                  <span className="font-medium">{item.label}</span>
                </div>
              );
            }
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={cn(
                  'flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                )}
              >
                <item.icon
                  className={cn(
                    'h-5 w-5 transition-transform duration-200',
                    isActive && 'scale-110'
                  )}
                />
                <span className="font-medium">{item.label}</span>
                {isActive && (
                  <motion.div
                    layoutId="activeIndicator"
                    className="absolute left-0 w-1 h-8 bg-primary rounded-r-full"
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  />
                )}
              </NavLink>
            );
          })}

          {/* Admin Link - Only for Superusers */}
          {isAdmin && (
            <NavLink
              to="/admin"
              className={cn(
                'flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group',
                location.pathname === '/admin'
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
              )}
            >
              <Shield
                className={cn(
                  'h-5 w-5 transition-transform duration-200',
                  location.pathname === '/admin' && 'scale-110'
                )}
              />
              <span className="font-medium">Panneau Admin</span>
            </NavLink>
          )}
        </nav>

        {/* User Profile Footer */}
        <div className="p-4 border-t border-[hsl(var(--glass-border))]">
          <div className="flex items-center gap-3 px-3 py-2">
            
            {/* UPDATED: Now uses Avatar Component */}
            <Avatar className="h-10 w-10 border border-primary/20">
              <AvatarImage src={profile?.avatar_url || ''} className="object-cover" />
              <AvatarFallback className="bg-gradient-to-br from-primary/50 to-primary text-primary-foreground font-semibold">
                {userInitials}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{profile?.clinic_name || 'Ma Clinique'}</p>
              <p className="text-xs text-muted-foreground truncate">
                {isAdmin ? 'Superadmin' : 'Compte Client'}
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </motion.aside>
  );
}