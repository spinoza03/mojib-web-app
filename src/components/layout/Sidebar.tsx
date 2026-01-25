import { NavLink, useLocation } from 'react-router-dom';
import { Home, Calendar, Smartphone, Settings, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';

const navItems = [
  { icon: Home, label: 'Dashboard', path: '/dashboard' },
  { icon: Calendar, label: 'Appointments', path: '/appointments' },
  { icon: Smartphone, label: 'Connect WhatsApp', path: '/connect' },
  { icon: Settings, label: 'Bot Config', path: '/settings' },
];

export function Sidebar() {
  const location = useLocation();
  const { profile, signOut } = useAuth();

  const handleLogout = async () => {
    await signOut();
    window.location.href = '/auth';
  };

  const userInitials = profile?.clinic_name
    ? profile.clinic_name.substring(0, 2).toUpperCase()
    : 'DR';

  return (
    <motion.aside
      initial={{ x: -80, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="fixed left-0 top-0 z-40 h-screen w-64 glass border-r border-[hsl(var(--glass-border))]"
    >
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className="flex h-20 items-center px-6 border-b border-[hsl(var(--glass-border))]">
          <span className="text-2xl font-bold tracking-tight">
            <span className="text-primary">NEORA</span>
          </span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-6 space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
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
        </nav>

        {/* User Profile */}
        <div className="p-4 border-t border-[hsl(var(--glass-border))]">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary/50 to-primary flex items-center justify-center">
              <span className="text-sm font-semibold text-primary-foreground">{userInitials}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{profile?.clinic_name || 'My Clinic'}</p>
              <p className="text-xs text-muted-foreground truncate">Admin</p>
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
