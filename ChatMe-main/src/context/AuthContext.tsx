import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, type Profile } from '@/lib/supabase';

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadProfile(userId: string): Promise<Profile | null> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error('Failed to load profile:', error.message);
      return null;
    }
    return data as Profile | null;
  }

  async function ensureProfile(userId: string, email: string, fullName?: string): Promise<Profile | null> {
    let existing = await loadProfile(userId);
    if (existing) {
      if (fullName && !existing.full_name) {
        const { data, error } = await supabase
          .from('profiles')
          .update({ full_name: fullName })
          .eq('id', userId)
          .select('*')
          .maybeSingle();
        if (!error && data) existing = data as Profile;
      }
      return existing;
    }

    const fallbackUsername = (email.split('@')[0] || 'user') + '_' + userId.slice(0, 4);
    const { data: created, error: createError } = await supabase
      .from('profiles')
      .insert({ id: userId, username: fallbackUsername, full_name: fullName || null })
      .select('*')
      .maybeSingle();

    if (createError) {
      console.error('Profile create failed:', createError.message);
      return await loadProfile(userId);
    }
    return created as Profile | null;
  }

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setUser(data.session?.user ?? null);
      if (data.session?.user) {
        loadProfile(data.session.user.id).then((p) => {
          if (!mounted) return;
          setProfile(p);
          setLoading(false);
        });
      } else {
        setLoading(false);
      }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      (async () => {
        setSession(newSession);
        setUser(newSession?.user ?? null);
        if (newSession?.user) {
          const p = await loadProfile(newSession.user.id);
          if (!mounted) return;
          setProfile(p);
        } else {
          setProfile(null);
        }
        setLoading(false);
      })();
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  async function signUp(email: string, password: string, fullName: string) {
    try {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) return { error: error.message };

      if (!data.user) {
        return { error: 'Sign-up failed. Please try again.' };
      }

      if (data.session) {
        await ensureProfile(data.user.id, email, fullName);
        return { error: null };
      }

      return {
        error: null,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'An unexpected error occurred during sign-up.';
      return { error: msg };
    }
  }

  async function signIn(email: string, password: string) {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return { error: error.message };
      return { error: null };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'An unexpected error occurred during sign-in.';
      return { error: msg };
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    setProfile(null);
    setSession(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ session, user, profile, loading, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
