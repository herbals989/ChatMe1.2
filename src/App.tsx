import { useEffect, useState, useCallback, useRef } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "./lib/supabase";
import type { Profile } from "./lib/types";
import AuthScreen from "./components/AuthScreen";
import ChatApp from "./components/ChatApp";
import FullScreenLoader from "./components/FullScreenLoader";
import "./components.css";

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const profileFetchedRef = useRef<string | null>(null);

  const fetchProfile = useCallback(async (user: User): Promise<Profile | null> => {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, username, email, bio, status, avatar_url, created_at")
      .eq("id", user.id)
      .maybeSingle();

    if (error) {
      console.error("Error fetching profile:", error.message);
      return null;
    }
    return data as Profile | null;
  }, []);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      if (data.session?.user) {
        const p = await fetchProfile(data.session.user);
        if (mounted) setProfile(p);
      }
      if (mounted) setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      (async () => {
        if (!mounted) return;
        setSession(newSession);

        if (newSession?.user) {
          if (profileFetchedRef.current !== newSession.user.id) {
            profileFetchedRef.current = newSession.user.id;
            const p = await fetchProfile(newSession.user);
            if (mounted) setProfile(p);
          }
        } else {
          profileFetchedRef.current = null;
          setProfile(null);
        }

        if (event === "SIGNED_OUT") {
          setLoading(false);
        }
      })();
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const refreshProfile = useCallback(async () => {
    if (!session?.user) return;
    const p = await fetchProfile(session.user);
    setProfile(p);
  }, [session, fetchProfile]);

  if (loading) {
    return <FullScreenLoader />;
  }

  if (!session || !profile) {
    return <AuthScreen onAuthenticated={refreshProfile} hasSession={!!session} />;
  }

  return <ChatApp session={session} profile={profile} onProfileUpdate={refreshProfile} />;
}
