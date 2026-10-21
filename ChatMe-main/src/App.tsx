import { AuthProvider, useAuth } from '@/context/AuthContext';
import { AuthScreen } from '@/components/AuthScreen';
import { ChatApp } from '@/components/ChatApp';
import { Logo } from '@/components/Logo';

function AppContent() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Logo size={56} className="rounded-2xl shadow-lg shadow-emerald-500/20 animate-pulse" />
          <p className="text-slate-400 text-sm">Loading ChatMe...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return <AuthScreen />;
  }

  return <ChatApp />;
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
