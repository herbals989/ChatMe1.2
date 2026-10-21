import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

export type Profile = {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
};

export type Conversation = {
  id: string;
  created_at: string;
};

export type ConversationParticipant = {
  conversation_id: string;
  user_id: string;
  last_read_at: string;
};

export type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
};

export type ConversationWithDetails = {
  id: string;
  created_at: string;
  other_participants: Profile[];
  last_message: Message | null;
};
