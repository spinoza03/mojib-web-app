import { ReactNode, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { Loader2, Menu, MessageCircle, Monitor, X } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [showMobileBanner, setShowMobileBanner] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < 768 && !sessionStorage.getItem('hideMobileBanner');
  });

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return null;

  const dismissBanner = () => {
    setShowMobileBanner(false);
    sessionStorage.setItem('hideMobileBanner', '1');
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Mobile banner */}
      {showMobileBanner && (
        <div className="md:hidden bg-primary/10 border-b border-primary/20 px-4 py-2.5 flex items-center gap-3 text-sm">
          <Monitor className="h-4 w-4 text-primary shrink-0" />
          <span className="text-muted-foreground flex-1">Pour une meilleure expérience, utilisez un ordinateur.</span>
          <button onClick={dismissBanner} className="text-muted-foreground hover:text-foreground shrink-0">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="flex-1 flex">
      {/* 1. Desktop Sidebar (Hidden on Mobile) */}
      <div className="hidden md:block w-64 fixed h-full z-40">
        <Sidebar />
      </div>

      {/* 2. Mobile Sidebar (Drawer) */}
      <div className="md:hidden fixed top-4 left-4 z-50">
        <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" className="bg-background/80 backdrop-blur-md border-primary/20">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-64 bg-background border-r border-border">
             {/* We reuse the Sidebar component inside the drawer */}
             <Sidebar /> 
          </SheetContent>
        </Sheet>
      </div>

      {/* 3. Main Content Area */}
      {/* On desktop (md), add left padding. On mobile, no padding. */}
      <div className="flex-1 md:pl-64 w-full">
        <div className="p-6 md:p-8">
            {/* Optional: Add Topbar here if needed, or keep it inside pages */}
            {/* <Topbar /> */} 
            
            <motion.main
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            >
            {children}
            </motion.main>
        </div>
      </div>
      {/* 4. Global WhatsApp Support Button */}
      <a
        href="https://wa.me/447749343372"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-6 right-6 z-50 bg-[#25D366] hover:bg-[#25D366]/90 text-white p-4 rounded-full shadow-2xl transition-transform hover:scale-110 flex items-center justify-center pointer-events-auto group"
      >
        <MessageCircle className="h-6 w-6" />
        <span className="absolute right-full mr-4 bg-black/80 text-white text-xs font-medium px-3 py-1.5 rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
          Support Client
        </span>
      </a>
      </div>
    </div>
  );
}