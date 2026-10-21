/*
# Add profiles INSERT policy

## Changes
- Adds an INSERT policy on `profiles` so an authenticated user can insert their
  own profile row. This serves as a fallback to the `on_auth_user_created_profile`
  trigger — if the trigger fails for any reason, the client can create the profile
  directly.
- The policy checks `auth.uid() = id` so users can only insert their own profile.
*/

DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
CREATE POLICY "profiles_insert_own"
  ON profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);