import { useState, useCallback } from "react";
import { supabase } from "../lib/supabase";
import ArbFooter from "./ArbFooter";

interface Props {
  onAuthenticated: () => void;
  hasSession: boolean;
}

export default function AuthScreen({ onAuthenticated, hasSession }: Props) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      setLoading(true);

      try {
        if (mode === "signup") {
          if (username.trim().length < 2) {
            throw new Error("Username must be at least 2 characters.");
          }
          const { data, error: signUpError } = await supabase.auth.signUp({
            email: email.trim(),
            password,
          });

          if (signUpError) throw signUpError;
          if (!data.user) throw new Error("Sign-up failed. Please try again.");

          const { error: profileError } = await supabase.from("profiles").insert({
            id: data.user.id,
            username: username.trim(),
            email: email.trim(),
          });

          if (profileError) {
            if (profileError.code === "23505") {
              throw new Error("That username is already taken.");
            }
            throw new Error("Could not create profile: " + profileError.message);
          }

          onAuthenticated();
        } else {
          const { error: signInError } = await supabase.auth.signInWithPassword({
            email: email.trim(),
            password,
          });

          if (signInError) throw signInError;
          onAuthenticated();
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Something went wrong.";
        setError(msg);
      } finally {
        setLoading(false);
      }
    },
    [mode, email, password, username, onAuthenticated]
  );

  return (
    <div className="auth-screen">
      <div className="auth-bg-blob blob-1" />
      <div className="auth-bg-blob blob-2" />

      <div className="auth-card">
        <div className="auth-header">
          <div className="chatme-logo">ChatMe</div>
          <p className="auth-subtitle">
            {mode === "signin" ? "Welcome back. Sign in to continue." : "Create your account to start chatting."}
          </p>
        </div>

        {hasSession && (
          <div className="auth-info-banner">
            Restoring your session…
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          {mode === "signup" && (
            <div className="form-group">
              <label htmlFor="username">Username</label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Choose a permanent username"
                autoComplete="username"
                required
                minLength={2}
                maxLength={30}
              />
            </div>
          )}

          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              required
              minLength={6}
            />
          </div>

          {error && <div className="auth-error">{error}</div>}

          <button type="submit" className="auth-submit-btn" disabled={loading}>
            {loading
              ? "Please wait…"
              : mode === "signin"
                ? "Sign In"
                : "Create Account"}
          </button>
        </form>

        <div className="auth-toggle">
          {mode === "signin" ? (
            <>
              Don't have an account?{" "}
              <button onClick={() => { setMode("signup"); setError(null); }}>
                Sign up
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button onClick={() => { setMode("signin"); setError(null); }}>
                Sign in
              </button>
            </>
          )}
        </div>

        <ArbFooter />
      </div>
    </div>
  );
}
