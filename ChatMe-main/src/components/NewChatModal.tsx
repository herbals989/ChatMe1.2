import { useState, useEffect, useCallback, type FormEvent } from 'react';
import { supabase, type Profile, type Message } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Search, Check, X, Loader2 } from 'lucide-react';

type NewChatModalProps = {
  onClose: () => void;
  onConversationCreated: (conversationId: string) => void;
};

export function NewChatModal({ onClose, onConversationCreated }: NewChatModalProps) {
  const { user, profile } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<Profile[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const searchUsers = useCallback(async () => {
    if (searchQuery.trim().length < 1) {
      setResults([]);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .ilike('username', `%${searchQuery.trim()}%`)
      .neq('id', user?.id ?? '')
      .limit(10);

    if (error) {
      console.error('Search error:', error.message);
      setResults([]);
    } else {
      setResults(data as Profile[]);
    }
    setLoading(false);
  }, [searchQuery, user?.id]);

  useEffect(() => {
    const timer = setTimeout(searchUsers, 250);
    return () => clearTimeout(timer);
  }, [searchUsers]);

  function toggleSelect(profile: Profile) {
    setSelectedUsers((prev) => {
      const exists = prev.find((p) => p.id === profile.id);
      if (exists) return prev.filter((p) => p.id !== profile.id);
      return [...prev, profile];
    });
  }

  async function handleCreate() {
    if (selectedUsers.length === 0 || !user) return;
    setCreating(true);
    setCreateError(null);

    try {
      const participantIds = selectedUsers.map((p) => p.id);

      const { data: convId, error: rpcError } = await supabase
        .rpc('create_conversation', { participant_user_ids: participantIds });

      if (rpcError || !convId) {
        throw new Error(rpcError?.message ?? 'Failed to create conversation.');
      }

      onConversationCreated(convId as string);
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create conversation.';
      console.error('Failed to create conversation:', err);
      setCreateError(msg);
      setCreating(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-900">New Chat</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {createError && (
            <div className="text-sm rounded-xl px-4 py-3 bg-red-50 text-red-600 border border-red-200">
              {createError}
            </div>
          )}
          {selectedUsers.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {selectedUsers.map((p) => (
                <span
                  key={p.id}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-full text-sm font-medium border border-emerald-200"
                >
                  {p.full_name || p.username}
                  <button onClick={() => toggleSelect(p)} className="hover:text-emerald-900">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </span>
              ))}
            </div>
          )}

          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by username..."
              autoFocus
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
            />
          </div>

          <div className="max-h-64 overflow-y-auto space-y-1">
            {loading && (
              <div className="flex items-center justify-center py-6 text-slate-400">
                <Loader2 className="w-5 h-5 animate-spin" />
              </div>
            )}

            {!loading && searchQuery.trim().length > 0 && results.length === 0 && (
              <p className="text-center py-6 text-sm text-slate-400">No users found.</p>
            )}

            {!loading && results.map((p) => {
              const isSelected = selectedUsers.find((s) => s.id === p.id);
              return (
                <button
                  key={p.id}
                  onClick={() => toggleSelect(p)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left ${
                    isSelected
                      ? 'bg-emerald-50 border border-emerald-200'
                      : 'hover:bg-slate-50 border border-transparent'
                  }`}
                >
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white font-semibold text-sm shrink-0">
                    {(p.full_name || p.username).charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">
                      {p.full_name || p.username}
                    </p>
                    <p className="text-xs text-slate-400 truncate">@{p.username}</p>
                  </div>
                  {isSelected && <Check className="w-5 h-5 text-emerald-600 shrink-0" />}
                </button>
              );
            })}

            {!loading && !searchQuery && (
              <div className="text-center py-8">
                <Search className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-400">Search for people to start a conversation.</p>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-slate-100 bg-slate-50/50">
          <button
            onClick={onClose}
            className="px-4 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={selectedUsers.length === 0 || creating}
            className="px-5 py-2.5 text-sm font-semibold bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-all shadow-md shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {creating && <Loader2 className="w-4 h-4 animate-spin" />}
            {selectedUsers.length > 0 ? `Chat with ${selectedUsers.length}` : 'Start Chat'}
          </button>
        </div>
      </div>
    </div>
  );
}

export type { Message };
