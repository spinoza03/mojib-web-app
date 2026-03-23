import { useLocation } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';
import { Activity, ChevronRight } from 'lucide-react';

const pathNames: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/appointments': 'Appointments',
  '/connect': 'Connect WhatsApp',
  '/settings': 'Bot Configuration',
};

export function Topbar() {
  const location = useLocation();
  const currentPath = pathNames[location.pathname] || 'Home';

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      className="sticky top-0 z-30 h-16 glass border-b border-[hsl(var(--glass-border))]"
    >
      <div className="flex h-full items-center justify-between px-3 md:px-6">
        {/* Breadcrumbs */}
        <nav className="flex items-center gap-1 md:gap-2 text-xs md:text-sm min-w-0">
          <span className="text-muted-foreground hidden sm:inline">Home</span>
          <ChevronRight className="h-3 w-3 md:h-4 md:w-4 text-muted-foreground/50 hidden sm:block" />
          <span className="font-medium text-foreground truncate">{currentPath}</span>
        </nav>

        {/* Status Badge */}
        <div className="flex items-center gap-3">
          <Badge
            variant="outline"
            className="gap-2 px-3 py-1.5 bg-success/10 border-success/20 text-success"
          >
            <Activity className="h-3 w-3" />
            <span className="text-xs font-medium">System Online</span>
          </Badge>
        </div>
      </div>
    </motion.header>
  );
}
