import { useEffect, useState, useCallback, useRef, type FormEvent } from 'react';
import { supabase, type Profile, type Message } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Logo } from '@/components/Logo';
import { NewChatModal } from '@/components/NewChatModal';
import {
  PenSquare, Send, LogOut, MessageCircle, ArrowLeft, Loader2,
} from 'lucide-react';

type ConversationListItem = {
  id: string;
  created_at: string;
  otherParticipants: Profile[];
  lastMessage: Message | null;
};

export function ChatApp() {
  const { user, profile, signOut } = useAuth();
  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [activeConversation, setActiveConversation] = useState<ConversationListItem | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [showNewChat, setShowNewChat] = useState(false);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [showSidebarMobile, setShowSidebarMobile] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const loadConversations = useCallback(async () => {
    if (!user) return;
    setLoadingConversations(true);

    const { data: participations, error: partError } = await supabase
      .from('conversation_participants')
      .select('conversation_id')
      .eq('user_id', user.id);

    if (partError || !participations || participations.length === 0) {
      setConversations([]);
      setLoadingConversations(false);
      return;
    }

    const convIds = participations.map((p) => p.conversation_id);

    const { data: allParticipants, error: allPartError } = await supabase
      .from('conversation_participants')
      .select('conversation_id, user_id, profiles!inner(id, username, full_name, avatar_url, created_at)')
      .in('conversation_id', convIds);

    if (allPartError || !allParticipants) {
      setConversations([]);
      setLoadingConversations(false);
      return;
    }

    const { data: lastMessages, error: msgError } = await supabase
      .from('messages')
      .select('*')
      .in('conversation_id', convIds)
      .order('created_at', { ascending: false });

    const lastMessageMap = new Map<string, Message>();
    if (!msgError && lastMessages) {
      for (const msg of lastMessages as Message[]) {
        if (!lastMessageMap.has(msg.conversation_id)) {
          lastMessageMap.set(msg.conversation_id, msg);
        }
      }
    }

    const grouped = new Map<string, Profile[]>();
    for (const row of allParticipants as unknown as Array<{ conversation_id: string; profiles: Profile | Profile[] }>) {
      const p = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
      if (!p || p.id === user.id) continue;
      if (!grouped.has(row.conversation_id)) grouped.set(row.conversation_id, []);
      grouped.get(row.conversation_id)!.push(p);
    }

    const items: ConversationListItem[] = convIds
      .map((id) => ({
        id,
        created_at: '',
        otherParticipants: grouped.get(id) ?? [],
        lastMessage: lastMessageMap.get(id) ?? null,
      }))
      .sort((a, b) => {
        const aTime = a.lastMessage?.created_at ?? '';
        const bTime = b.lastMessage?.created_at ?? '';
        return bTime.localeCompare(aTime);
      });

    setConversations(items);
    setLoadingConversations(false);
  }, [user]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Realtime subscription for conversations list
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('conversations-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => {
        loadConversations();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversation_participants' }, () => {
        loadConversations();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, loadConversations]);

  const loadMessages = useCallback(async (conversationId: string) => {
    setLoadingMessages(true);
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Failed to load messages:', error.message);
      setMessages([]);
    } else {
      setMessages(data as Message[]);
    }
    setLoadingMessages(false);
  }, []);

  useEffect(() => {
    if (activeConversation) {
      loadMessages(activeConversation.id);
      setShowSidebarMobile(false);
    }
  }, [activeConversation, loadMessages]);

  // Realtime subscription for active conversation messages
  useEffect(() => {
    if (!activeConversation) return;

    const channel = supabase
      .channel(`messages-${activeConversation.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${activeConversation.id}` },
        (payload) => {
          setMessages((prev) => {
            const newMsg = payload.new as Message;
            if (prev.find((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [activeConversation]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Mark as read
  useEffect(() => {
    if (!activeConversation || !user) return;
    supabase
      .from('conversation_participants')
      .update({ last_read_at: new Date().toISOString() })
      .eq('conversation_id', activeConversation.id)
      .eq('user_id', user.id)
      .then(({ error }) => {
        if (error) console.error('Failed to mark read:', error.message);
      });
  }, [activeConversation, user, messages.length]);

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    if (!newMessage.trim() || !activeConversation || !user) return;
    setSending(true);
    setSendError(null);

    const content = newMessage.trim();
    const { error } = await supabase
      .from('messages')
      .insert({
        conversation_id: activeConversation.id,
        sender_id: user.id,
        content,
      });

    if (error) {
      console.error('Send failed:', error.message);
      setSendError('Failed to send message. Please try again.');
    } else {
      setNewMessage('');
    }
    setSending(false);
  }

  function handleConversationCreated(conversationId: string) {
    loadConversations().then(() => {
      setConversations((prev) => {
        const conv = prev.find((c) => c.id === conversationId);
        if (conv) setActiveConversation(conv);
        return prev;
      });
    });
  }

  function getInitials(name: string) {
    return name.charAt(0).toUpperCase();
  }

  function formatTime(iso: string) {
    const date = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'now';
    if (diffMin < 60) return `${diffMin}m`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h`;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  const displayName = profile?.full_name || profile?.username || 'User';

  return (
    <div className="h-screen flex bg-slate-50 overflow-hidden">
      {/* Sidebar */}
      <aside className={`${
        showSidebarMobile ? 'flex' : 'hidden'
      } md:flex flex-col w-full md:w-80 lg:w-96 bg-white border-r border-slate-200 shrink-0`}>
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Logo size={36} />
            <span className="text-xl font-bold text-slate-900 tracking-tight">ChatMe</span>
          </div>
          <button
            onClick={signOut}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            title="Sign out"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>

        {/* Current user */}
        <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white font-semibold text-sm">
            {getInitials(displayName)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-900 truncate">{displayName}</p>
            <p className="text-xs text-emerald-600 flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
              Online
            </p>
          </div>
        </div>

        {/* New chat button */}
        <div className="px-4 py-3">
          <button
            onClick={() => setShowNewChat(true)}
            className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white font-medium rounded-xl transition-all shadow-md shadow-emerald-500/20"
          >
            <PenSquare className="w-4 h-4" />
            New Chat
          </button>
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto px-2 pb-2">
          {loadingConversations ? (
            <div className="flex items-center justify-center py-10 text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : conversations.length === 0 ? (
            <div className="text-center py-12 px-4">
              <MessageCircle className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-sm text-slate-400">No conversations yet.</p>
              <p className="text-xs text-slate-400 mt-1">Start a new chat to begin messaging.</p>
            </div>
          ) : (
            conversations.map((conv) => {
              const isActive = activeConversation?.id === conv.id;
              const name = conv.otherParticipants.map((p) => p.full_name || p.username).join(', ') || 'Unknown';
              const lastMsg = conv.lastMessage;
              const isOwnLast = lastMsg?.sender_id === user?.id;

              return (
                <button
                  key={conv.id}
                  onClick={() => setActiveConversation(conv)}
                  className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all text-left mb-0.5 ${
                    isActive
                      ? 'bg-emerald-50 border border-emerald-100'
                      : 'hover:bg-slate-50 border border-transparent'
                  }`}
                >
                  <div className="w-11 h-11 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white font-semibold shrink-0">
                    {getInitials(name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-900 truncate">{name}</p>
                      {lastMsg && (
                        <span className="text-xs text-slate-400 shrink-0">{formatTime(lastMsg.created_at)}</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 truncate mt-0.5">
                      {lastMsg
                        ? `${isOwnLast ? 'You: ' : ''}${lastMsg.content}`
                        : 'No messages yet'}
                    </p>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </aside>

      {/* Main chat window */}
      <main className={`${
        showSidebarMobile ? 'hidden' : 'flex'
      } md:flex flex-col flex-1 min-w-0`}>
        {activeConversation ? (
          <>
            {/* Chat header */}
            <div className="px-5 py-3.5 bg-white border-b border-slate-200 flex items-center gap-3">
              <button
                onClick={() => setShowSidebarMobile(true)}
                className="md:hidden p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white font-semibold shrink-0">
                {getInitials(activeConversation.otherParticipants.map((p) => p.full_name || p.username).join(', ') || '?')}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900 truncate">
                  {activeConversation.otherParticipants.map((p) => p.full_name || p.username).join(', ')}
                </p>
                <p className="text-xs text-slate-400">
                  {activeConversation.otherParticipants.length} participant{activeConversation.otherParticipants.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 bg-slate-50">
              {loadingMessages ? (
                <div className="flex items-center justify-center h-full text-slate-400">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center mb-4">
                    <MessageCircle className="w-8 h-8 text-emerald-500" />
                  </div>
                  <p className="text-slate-600 font-medium">No messages yet</p>
                  <p className="text-sm text-slate-400 mt-1">Send the first message to start the conversation.</p>
                </div>
              ) : (
                <div className="max-w-3xl mx-auto space-y-1">
                  {messages.map((msg, idx) => {
                    const isOwn = msg.sender_id === user?.id;
                    const prevMsg = messages[idx - 1];
                    const showAvatar = !prevMsg || prevMsg.sender_id !== msg.sender_id;

                    return (
                      <div
                        key={msg.id}
                        className={`flex items-end gap-2 ${isOwn ? 'justify-end' : 'justify-start'} ${
                          showAvatar ? 'mt-3' : 'mt-0.5'
                        }`}
                      >
                        {!isOwn && (
                          <div className={`w-7 h-7 rounded-full bg-gradient-to-br from-emerald-300 to-emerald-500 flex items-center justify-center text-white text-xs font-semibold shrink-0 ${
                            showAvatar ? '' : 'invisible'
                          }`}>
                            {getInitials(
                              activeConversation.otherParticipants.find((p) => p.id === msg.sender_id)?.username ?? '?'
                            )}
                          </div>
                        )}
                        <div className={`max-w-[75%] md:max-w-[65%] ${
                          isOwn
                            ? 'bg-emerald-500 text-white rounded-2xl rounded-br-md'
                            : 'bg-white text-slate-800 rounded-2xl rounded-bl-md border border-slate-100'
                        } px-4 py-2.5 shadow-sm`}>
                          <p className="text-sm leading-relaxed break-words">{msg.content}</p>
                          <p className={`text-[10px] mt-1 ${isOwn ? 'text-emerald-100' : 'text-slate-400'}`}>
                            {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* Message input */}
            <div className="px-4 md:px-8 py-4 bg-white border-t border-slate-200">
              {sendError && (
                <div className="max-w-3xl mx-auto mb-2 text-sm rounded-lg px-4 py-2 bg-red-50 text-red-600 border border-red-200">
                  {sendError}
                </div>
              )}
              <form onSubmit={handleSend} className="max-w-3xl mx-auto flex items-center gap-3">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 px-4 py-3 rounded-full border border-slate-200 bg-slate-50 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                />
                <button
                  type="submit"
                  disabled={!newMessage.trim() || sending}
                  className="w-11 h-11 flex items-center justify-center bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white rounded-full transition-all shadow-md shadow-emerald-500/25 disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                >
                  {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <Logo size={72} className="shadow-xl shadow-emerald-500/20 rounded-3xl mb-6" />
            <h2 className="text-2xl font-bold text-slate-800">Welcome to ChatMe</h2>
            <p className="text-slate-500 mt-2 max-w-sm">
              Select a conversation from the sidebar or start a new chat to begin messaging.
            </p>
          </div>
        )}
      </main>

      {showNewChat && (
        <NewChatModal
          onClose={() => setShowNewChat(false)}
          onConversationCreated={handleConversationCreated}
        />
      )}
    </div>
  );
}
