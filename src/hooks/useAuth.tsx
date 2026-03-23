import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

// 1. Define the Profile shape
type PlanType = 'essentiel' | 'pro' | 'elite';
type SubscriptionStatus = 'trial' | 'active' | 'expired';
export type FeatureName = 'dashboard' | 'chat' | 'calendar-sync' | 'advanced-settings' | 'crm' | 'finance' | 'immobilier-catalogue';
export type NicheType = 'dentistry' | 'doctor' | 'beauty_center' | 'immobilier' | 'car_location' | 'centre_formation';

const ACTIVE_NICHES: NicheType[] = ['dentistry', 'doctor', 'beauty_center', 'immobilier'];

interface Profile {
  id: string;
  user_id: string;
  clinic_name: string;
  phone: string | null;
  avatar_url: string | null;
  whatsapp_status: string;
  niche: NicheType;
  waha_session_name: string | null;
  created_at?: string;
  updated_at?: string;
  role?: 'clinic' | 'superuser';
  plan_type: PlanType;
  subscription_status: SubscriptionStatus;
  trial_ends_at: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (
    email: string,
    password: string,
    metaData?: { clinic_name: string; phone: string; niche?: string; waha_session_name?: string; plan_type?: string }
  ) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  canAccessFeature: (featureName: FeatureName) => boolean;
  isNicheActive: boolean;
  isSubscriptionExpired: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    // Try by id first (profiles.id = auth.users.id for newer accounts)
    let { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    // Fallback: try by user_id for older accounts where id ≠ auth uid
    if (!data && !error) {
      const fallback = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      data = fallback.data;
      error = fallback.error;
    }

    if (error) {
      console.error('Error fetching profile:', error);
    }

    if (data) {
      setProfile(data as Profile);
    } else {
      console.warn('No profile found for user:', userId);
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          await fetchProfile(session.user.id);
        } else {
          setProfile(null);
        }

        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signUp = async (email: string, password: string, metaData?: { clinic_name: string; phone: string; niche?: string; waha_session_name?: string; plan_type?: string }) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: metaData 
      },
    });
    return { error };
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error('Sign out API error:', err);
    } finally {
      setUser(null);
      setSession(null);
      setProfile(null);
      localStorage.clear();
      sessionStorage.clear();
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id);
    }
  };

  const canAccessFeature = (featureName: FeatureName) => {
    if (!profile) return false;

    if (profile.role === 'superuser') return true;

    const isImmobilier = profile.niche === 'immobilier';
    const isEssentiel = profile.plan_type === 'essentiel';

    // Immobilier users should only see immobilier experience.
    if (isImmobilier) {
      const immobilierFeatures: FeatureName[] = ['dashboard', 'advanced-settings', 'immobilier-catalogue', 'chat', 'calendar-sync'];
      return immobilierFeatures.includes(featureName);
    }

    // Non-immobilier users should not access immobilier modules.
    if (featureName === 'immobilier-catalogue') return false;

    // WhatsApp automation stays locked for Essentiel, upgrade available in-app.
    if (featureName === 'chat' && isEssentiel) return false;

    return true;
  };

  const isNicheActive = profile ? ACTIVE_NICHES.includes(profile.niche) : false;

  const isSubscriptionExpired = (() => {
    if (!profile) return false;
    if (profile.subscription_status === 'expired') return true;
    if (profile.subscription_status === 'trial' && profile.trial_ends_at) {
      return new Date(profile.trial_ends_at) < new Date();
    }
    return false;
  })();

  return (
    <AuthContext.Provider value={{ user, session, profile, loading, signIn, signUp, signOut, refreshProfile, canAccessFeature, isNicheActive, isSubscriptionExpired }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}