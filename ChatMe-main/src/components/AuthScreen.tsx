import { useState, type FormEvent } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Logo } from '@/components/Logo';
import { Loader2, CheckCircle2 } from 'lucide-react';

export function AuthScreen() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function switchMode(newMode: 'signin' | 'signup') {
    setMode(newMode);
    setError(null);
    setInfo(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);

    if (mode === 'signup') {
      if (password.length < 6) {
        setError('Password must be at least 6 characters.');
        setLoading(false);
        return;
      }
      if (!fullName.trim()) {
        setError('Please enter your full name.');
        setLoading(false);
        return;
      }
      const { error: signUpError } = await signUp(email.trim(), password, fullName.trim());
      if (signUpError) {
        setError(signUpError);
        setLoading(false);
        return;
      }
      setInfo('Account created! You can now sign in with your credentials.');
      setMode('signin');
      setPassword('');
      setLoading(false);
    } else {
      const { error: signInError } = await signIn(email.trim(), password);
      if (signInError) {
        setError(signInError);
        setLoading(false);
      }
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-slate-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-emerald-200/30 rounded-full blur-3xl" />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-emerald-100/40 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <Logo size={64} className="shadow-lg shadow-emerald-500/20 rounded-2xl" />
          <h1 className="mt-4 text-3xl font-bold text-slate-900 tracking-tight">ChatMe</h1>
          <p className="mt-1 text-slate-500 text-sm">
            {mode === 'signin' ? 'Welcome back. Sign in to chat.' : 'Create an account to start chatting.'}
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100 p-8">
          <div className="flex gap-1 p-1 bg-slate-100 rounded-xl mb-6">
            <button
              type="button"
              onClick={() => switchMode('signin')}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
                mode === 'signin'
                  ? 'bg-white text-emerald-600 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => switchMode('signup')}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
                mode === 'signup'
                  ? 'bg-white text-emerald-600 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Sign Up
            </button>
          </div>

          {info && (
            <div className="mb-4 flex items-start gap-2.5 text-sm rounded-xl px-4 py-3 bg-emerald-50 text-emerald-700 border border-emerald-200">
              <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
              <span>{info}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Full Name</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Jane Doe"
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === 'signup' ? 'At least 6 characters' : '••••••••'}
                required
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
              />
            </div>

            {error && (
              <div className="text-sm rounded-xl px-4 py-3 bg-red-50 text-red-600 border border-red-200">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white font-semibold rounded-xl transition-all shadow-lg shadow-emerald-500/25 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {mode === 'signin' ? 'Sign In' : 'Create Account'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          By continuing, you agree to ChatMe's Terms of Service.
        </p>
      </div>
    </div>
  );
}
