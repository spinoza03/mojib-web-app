import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

// 1. Define the Profile shape (matches your DB columns / generated types)
type PlanType = 'starter' | 'pro';
type SubscriptionStatus = 'trial' | 'active' | 'expired';
export type FeatureName = 'dashboard' | 'chat' | 'calendar-sync' | 'advanced-settings';

interface Profile {
  id: string;
  user_id: string;
  clinic_name: string;
  phone: string | null;
  avatar_url: string | null;
  whatsapp_status: string;
  created_at?: string;
  updated_at?: string;
  // Optional fields (some projects add these columns later)
  role?: 'clinic' | 'superuser'; // This is what unlocks the admin panel
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
    metaData?: { clinic_name: string; phone: string }
  ) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  canAccessFeature: (featureName: FeatureName) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    // 2. THE FIX: Changed .eq('user_id', userId) to .eq('id', userId)
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId) 
      .maybeSingle();
    
    if (error) {
      console.error('Error fetching profile:', error);
    }

    if (data) {
      console.log('Profile loaded:', data); // This helps debug in Console
      setProfile(data as Profile);
    }
  };

  useEffect(() => {
    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          // Fetch profile immediately when user logs in
          fetchProfile(session.user.id);
        } else {
          setProfile(null);
        }
        
        setLoading(false);
      }
    );

    // Initial check
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

// Find this part in useAuth.tsx and update it if it looks different
const signUp = async (email: string, password: string, metaData?: { clinic_name: string, phone: string }) => {
	const redirectUrl = `${window.location.origin}/`;
	
	const { error } = await supabase.auth.signUp({
	  email,
	  password,
	  options: {
		emailRedirectTo: redirectUrl,
		// Pass the extra data here
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

    if (profile.plan_type === 'starter') {
      if (featureName === 'calendar-sync' || featureName === 'advanced-settings') {
        return false;
      }
    }

    return true;
  };

  return (
    <AuthContext.Provider value={{ user, session, profile, loading, signIn, signUp, signOut, refreshProfile, canAccessFeature }}>
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