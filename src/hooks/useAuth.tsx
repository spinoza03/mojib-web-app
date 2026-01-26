import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

// 1. Define the Profile shape (matches your DB columns)
interface Profile {
  id: string;
  clinic_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  whatsapp_status: 'connected' | 'disconnected';
  role: 'clinic' | 'superuser'; // This is what unlocks the admin panel
  credits: number;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
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

  return (
    <AuthContext.Provider value={{ user, session, profile, loading, signIn, signUp, signOut, refreshProfile }}>
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