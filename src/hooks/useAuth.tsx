import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

// 1. Define the Profile shape
type PlanType = 'starter' | 'pro';
type SubscriptionStatus = 'trial' | 'active' | 'expired';
export type FeatureName = 'dashboard' | 'chat' | 'calendar-sync' | 'advanced-settings';
export type NicheType = 'dentistry' | 'doctor' | 'beauty_center' | 'immobilier' | 'car_location' | 'centre_formation';

const ACTIVE_NICHES: NicheType[] = ['dentistry', 'doctor', 'beauty_center'];

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
    metaData?: { clinic_name: string; phone: string; niche?: string; waha_session_name?: string }
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
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId) 
      .maybeSingle();
    
    if (error) {
      console.error('Error fetching profile:', error);
    }

    if (data) {
      console.log('Profile loaded:', data);
      setProfile(data as Profile);
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          fetchProfile(session.user.id);
        } else {
          setProfile(null);
        }
        
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signUp = async (email: string, password: string, metaData?: { clinic_name: string; phone: string; niche?: string; waha_session_name?: string }) => {
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
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id);
    }
  };

  const canAccessFeature = (featureName: FeatureName) => {
    if (!profile) return false;

    if (profile.subscription_status === 'expired') {
      return false;
    }

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