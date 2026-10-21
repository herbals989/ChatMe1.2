/*
# ChatMe - Core Database Schema

Creates the tables required for a real-time chat application: user profiles,
1-on-1 and group conversations, conversation participants, and messages.

## 1. New Tables

- `profiles` — one row per auth user (id, username, full_name, avatar_url, created_at)
- `conversations` — a chat room (id, created_at)
- `conversation_participants` — membership link (conversation_id, user_id, last_read_at)
- `messages` — individual message (id, conversation_id, sender_id, content, created_at)

## 2. Automation

- Trigger `on_auth_user_created_profile`: auto-creates a profile row on signup.
  Username defaults to email local-part + short id suffix.

## 3. Security (RLS)

- profiles: authenticated can read all; users update only their own.
- conversations: members can read; any authenticated can create.
- conversation_participants: members of a conversation can read; users insert
  only their own row; users update only their own last_read_at.
- messages: conversation members can read and insert.

## 4. Indexes

- messages(conversation_id, created_at), conversation_participants(user_id), profiles(username)
*/

-- Profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text UNIQUE NOT NULL,
  full_name text,
  avatar_url text,
  created_at timestamptz DEFAULT now()
);

-- Conversations table
CREATE TABLE IF NOT EXISTS conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now()
);

-- Conversation participants table
CREATE TABLE IF NOT EXISTS conversation_participants (
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_read_at timestamptz DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Profiles policies
DROP POLICY IF EXISTS "profiles_select_all" ON profiles;
CREATE POLICY "profiles_select_all"
  ON profiles FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own"
  ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Conversations policies
DROP POLICY IF EXISTS "conversations_select_member" ON conversations;
CREATE POLICY "conversations_select_member"
  ON conversations FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM conversation_participants cp
      WHERE cp.conversation_id = conversations.id
      AND cp.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "conversations_insert_authed" ON conversations;
CREATE POLICY "conversations_insert_authed"
  ON conversations FOR INSERT
  TO authenticated WITH CHECK (true);

-- Conversation participants policies
DROP POLICY IF EXISTS "participants_select_member" ON conversation_participants;
CREATE POLICY "participants_select_member"
  ON conversation_participants FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM conversation_participants cp
      WHERE cp.conversation_id = conversation_participants.conversation_id
      AND cp.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "participants_insert_own" ON conversation_participants;
CREATE POLICY "participants_insert_own"
  ON conversation_participants FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "participants_update_own" ON conversation_participants;
CREATE POLICY "participants_update_own"
  ON conversation_participants FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Messages policies
DROP POLICY IF EXISTS "messages_select_member" ON messages;
CREATE POLICY "messages_select_member"
  ON messages FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM conversation_participants cp
      WHERE cp.conversation_id = messages.conversation_id
      AND cp.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "messages_insert_member" ON messages;
CREATE POLICY "messages_insert_member"
  ON messages FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversation_participants cp
      WHERE cp.conversation_id = messages.conversation_id
      AND cp.user_id = auth.uid()
    )
  );

-- Indexes
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created
  ON messages (conversation_id, created_at);

CREATE INDEX IF NOT EXISTS idx_participants_user
  ON conversation_participants (user_id);

CREATE INDEX IF NOT EXISTS idx_profiles_username
  ON profiles (username);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, username)
  VALUES (
    NEW.id,
    lower(split_part(NEW.email, '@', 1)) || '_' || substr(NEW.id::text, 1, 4)
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

GRANT EXECUTE ON FUNCTION public.handle_new_user() TO authenticated;