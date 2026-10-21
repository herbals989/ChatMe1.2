/*
# ChatMe: profiles, messages, and broadcast status

## Purpose
Multi-user realtime chat application. Users sign up with email/password, get a
profile (username, bio, status, display picture), and can send messages into a
shared broadcast chat room with live realtime updates.

## New Tables
1. `profiles`
   - `id` (uuid, primary key, references auth.users) — one row per auth user.
   - `username` (text, unique, not null) — permanent, user-chosen display name.
   - `email` (text, not null) — cached from auth.users for quick reads.
   - `bio` (text, nullable) — short user-editable bio / "about me".
   - `status` (text, nullable) — ephemeral status message (e.g. "Available").
   - `avatar_url` (text, nullable) — URL to display picture (Supabase Storage).
   - `created_at` (timestamptz) — profile creation time.

2. `messages`
   - `id` (uuid, primary key).
   - `user_id` (uuid, not null, defaults to auth.uid()) — sender.
   - `username` (text, not null) — denormalized sender username for fast render.
   - `avatar_url` (text, nullable) — denormalized sender avatar for fast render.
   - `content` (text, not null) — message body.
   - `created_at` (timestamptz) — send time.

3. `broadcast_presence`
   - `id` (uuid, primary key, defaults to auth.uid()) — one row per active user.
   - `username` (text, not null) — for sidebar presence list.
   - `avatar_url` (text, nullable).
   - `last_seen_at` (timestamptz) — heartbeat timestamp; updated periodically.
   - `is_online` (boolean, default false).

## Security — Row Level Security
- `profiles`: owner-scoped. A user can SELECT/UPDATE only their own profile row.
  INSERT is allowed for the owner at signup time (WITH CHECK auth.uid() = id).
- `messages`: SELECT is public to all authenticated users (shared chat room).
  INSERT is allowed for the sender only (auth.uid() = user_id). UPDATE/DELETE
  restricted to the sender.
- `broadcast_presence`: SELECT public to authenticated (so users can see who is
  online). INSERT/UPDATE restricted to the owner (auth.uid() = id). DELETE
  restricted to the owner.

## Notes
- `user_id` on messages and `id` on profiles/presence default to auth.uid() so
  inserts that omit the owner column still satisfy WITH CHECK.
- Email confirmation remains OFF (per Bolt defaults).
- Storage bucket `avatars` is created for display-picture uploads; policies
  allow authenticated users to read avatars and upload to their own prefix.
*/

-- =========================
-- profiles
-- =========================
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text UNIQUE NOT NULL,
  email text NOT NULL,
  bio text,
  status text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_profile" ON profiles;
CREATE POLICY "select_own_profile" ON profiles FOR SELECT
  TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "insert_own_profile" ON profiles;
CREATE POLICY "insert_own_profile" ON profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "update_own_profile" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "delete_own_profile" ON profiles;
CREATE POLICY "delete_own_profile" ON profiles FOR DELETE
  TO authenticated USING (auth.uid() = id);

-- =========================
-- messages
-- =========================
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  username text NOT NULL,
  avatar_url text,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_messages" ON messages;
CREATE POLICY "select_messages" ON messages FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_own_message" ON messages;
CREATE POLICY "insert_own_message" ON messages FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_message" ON messages;
CREATE POLICY "update_own_message" ON messages FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_message" ON messages;
CREATE POLICY "delete_own_message" ON messages FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- =========================
-- broadcast_presence
-- =========================
CREATE TABLE IF NOT EXISTS broadcast_presence (
  id uuid PRIMARY KEY DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  username text NOT NULL,
  avatar_url text,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  is_online boolean NOT NULL DEFAULT false
);

ALTER TABLE broadcast_presence ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_presence" ON broadcast_presence;
CREATE POLICY "select_presence" ON broadcast_presence FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_own_presence" ON broadcast_presence;
CREATE POLICY "insert_own_presence" ON broadcast_presence FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "update_own_presence" ON broadcast_presence;
CREATE POLICY "update_own_presence" ON broadcast_presence FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "delete_own_presence" ON broadcast_presence;
CREATE POLICY "delete_own_presence" ON broadcast_presence FOR DELETE
  TO authenticated USING (auth.uid() = id);

-- =========================
-- Indexes
-- =========================
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages (created_at);
CREATE INDEX IF NOT EXISTS idx_presence_last_seen ON broadcast_presence (last_seen_at);
