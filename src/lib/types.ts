export interface Profile {
  id: string;
  username: string;
  email: string;
  bio: string | null;
  status: string | null;
  avatar_url: string | null;
  created_at: string;
}

export interface Message {
  id: string;
  user_id: string;
  username: string;
  avatar_url: string | null;
  content: string;
  created_at: string;
}

export interface PresenceRow {
  id: string;
  username: string;
  avatar_url: string | null;
  last_seen_at: string;
  is_online: boolean;
}
