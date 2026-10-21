import { useEffect, useState, useCallback, useRef } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import type { Profile, Message, PresenceRow } from "../lib/types";
import ArbFooter from "./ArbFooter";
import ProfileDrawer from "./ProfileDrawer";

interface Props {
  session: Session;
  profile: Profile;
  onProfileUpdate: () => void;
}

const PRESENCE_INTERVAL = 20000;
const PRESENCE_STALE_MS = 45000;

export default function ChatApp({ session, profile, onProfileUpdate }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [onlineUsers, setOnlineUsers] = useState<PresenceRow[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageListRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load initial messages
  useEffect(() => {
    let mounted = true;

    (async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("id, user_id, username, avatar_url, content, created_at")
        .order("created_at", { ascending: true })
        .limit(200);

      if (!mounted) return;
      if (error) {
        console.error("Failed to load messages:", error.message);
      } else {
        setMessages(data as Message[]);
      }
      setLoadingMessages(false);
    })();

    return () => {
      mounted = false;
    };
  }, []);

  // Realtime subscription for new messages
  useEffect(() => {
    const channel = supabase
      .channel("public:messages")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const newMsg = payload.new as Message;
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "messages" },
        (payload) => {
          const deletedId = (payload.old as Message).id;
          setMessages((prev) => prev.filter((m) => m.id !== deletedId));
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, []);

  // Presence: upsert heartbeat + realtime presence changes
  useEffect(() => {
    let mounted = true;

    const upsertPresence = async (isOnline: boolean) => {
      const { error } = await supabase
        .from("broadcast_presence")
        .upsert({
          id: session.user.id,
          username: profile.username,
          avatar_url: profile.avatar_url,
          last_seen_at: new Date().toISOString(),
          is_online: isOnline,
        });

      if (error) console.error("Presence upsert error:", error.message);
    };

    upsertPresence(true);

    heartbeatRef.current = setInterval(() => upsertPresence(true), PRESENCE_INTERVAL);

    const presenceChannel = supabase
      .channel("public:broadcast_presence")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "broadcast_presence" },
        () => {
          if (!mounted) return;
          (async () => {
            const cutoff = new Date(Date.now() - PRESENCE_STALE_MS).toISOString();
            const { data } = await supabase
              .from("broadcast_presence")
              .select("id, username, avatar_url, last_seen_at, is_online")
              .gte("last_seen_at", cutoff)
              .order("username", { ascending: true });

            if (mounted && data) {
              setOnlineUsers(data as PresenceRow[]);
            }
          })();
        }
      )
      .subscribe();

    // Initial load of online users
    (async () => {
      const cutoff = new Date(Date.now() - PRESENCE_STALE_MS).toISOString();
      const { data } = await supabase
        .from("broadcast_presence")
        .select("id, username, avatar_url, last_seen_at, is_online")
        .gte("last_seen_at", cutoff)
        .order("username", { ascending: true });

      if (mounted && data) {
        setOnlineUsers(data as PresenceRow[]);
      }
    })();

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        upsertPresence(true);
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      mounted = false;
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      supabase.removeChannel(presenceChannel);
      document.removeEventListener("visibilitychange", handleVisibility);
      upsertPresence(false);
    };
  }, [session.user.id, profile.username, profile.avatar_url]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    const el = messageListRef.current;
    if (!el) return;
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    if (isNearBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const handleSendMessage = useCallback(async () => {
    const trimmed = newMessage.trim();
    if (!trimmed || sending) return;

    setSending(true);
    try {
      const { error } = await supabase.from("messages").insert({
        user_id: session.user.id,
        username: profile.username,
        avatar_url: profile.avatar_url,
        content: trimmed,
      });

      if (error) throw error;
      setNewMessage("");
    } catch (err) {
      console.error("Failed to send message:", err);
    } finally {
      setSending(false);
    }
  }, [newMessage, sending, session.user.id, profile.username, profile.avatar_url]);

  const handleLogout = useCallback(async () => {
    await supabase
      .from("broadcast_presence")
      .update({ is_online: false, last_seen_at: new Date().toISOString() })
      .eq("id", session.user.id);

    await supabase.auth.signOut();
    setDrawerOpen(false);
  }, [session.user.id]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const initials = profile.username
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="chat-shell">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="chatme-logo small">ChatMe</div>
        </div>

        <div className="sidebar-section">
          <div className="sidebar-section-title">Online — {onlineUsers.length}</div>
          <div className="online-list">
            {onlineUsers.length === 0 && (
              <div className="online-empty">No one online yet</div>
            )}
            {onlineUsers.map((u) => (
              <div key={u.id} className="online-user-item">
                <div className="online-avatar-wrap">
                  {u.avatar_url ? (
                    <img src={u.avatar_url} alt={u.username} className="online-avatar" />
                  ) : (
                    <div className="online-avatar placeholder">
                      {u.username.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <span className="online-dot" />
                </div>
                <span className="online-username">{u.username}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="sidebar-spacer" />

        {/* User profile button — opens drawer */}
        <button
          className="sidebar-user-btn"
          onClick={() => setDrawerOpen(true)}
        >
          <div className="sidebar-user-avatar-wrap">
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt={profile.username} className="sidebar-user-avatar" />
            ) : (
              <div className="sidebar-user-avatar placeholder">{initials}</div>
            )}
          </div>
          <div className="sidebar-user-info">
            <div className="sidebar-user-name">{profile.username}</div>
            <div className="sidebar-user-status">
              {profile.status || "Tap to edit profile"}
            </div>
          </div>
          <svg
            className="sidebar-user-chevron"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>

        <ArbFooter />
      </aside>

      {/* Chat area */}
      <main className="chat-main">
        <header className="chat-header">
          <div className="chat-header-info">
            <div className="chat-header-title">General Chat</div>
            <div className="chat-header-subtitle">
              {onlineUsers.length} {onlineUsers.length === 1 ? "person" : "people"} online
            </div>
          </div>
        </header>

        <div className="message-list" ref={messageListRef}>
          {loadingMessages && (
            <div className="messages-loading">
              <div className="typing-dots">
                <span />
                <span />
                <span />
              </div>
            </div>
          )}
          {!loadingMessages && messages.length === 0 && (
            <div className="messages-empty">
              <div className="messages-empty-icon">💬</div>
              <p>No messages yet. Say hello!</p>
            </div>
          )}
          {messages.map((msg) => {
            const isOwn = msg.user_id === session.user.id;
            return (
              <div
                key={msg.id}
                className={`message-row ${isOwn ? "own" : "other"}`}
              >
                <div className="message-avatar-wrap">
                  {msg.avatar_url ? (
                    <img src={msg.avatar_url} alt={msg.username} className="message-avatar" />
                  ) : (
                    <div className="message-avatar placeholder">
                      {msg.username.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="message-content">
                  <div className="message-meta">
                    <span className="message-author">{msg.username}</span>
                    <span className="message-time">
                      {new Date(msg.created_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <div className={`message-bubble ${isOwn ? "own" : "other"}`}>
                    {msg.content}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        <div className="message-composer">
          <textarea
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message…  (Enter to send, Shift+Enter for newline)"
            rows={1}
            maxLength={1000}
          />
          <button
            className="send-btn"
            onClick={handleSendMessage}
            disabled={!newMessage.trim() || sending}
            aria-label="Send message"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
      </main>

      {drawerOpen && (
        <ProfileDrawer
          profile={profile}
          onClose={() => setDrawerOpen(false)}
          onProfileUpdate={onProfileUpdate}
          onLogout={handleLogout}
        />
      )}
    </div>
  );
}
