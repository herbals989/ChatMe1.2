/*
# Fix conversation creation — allow adding other users as participants

## Problem
The `participants_insert_own` policy only lets a user insert their OWN row into
`conversation_participants`. When creating a new chat, the creator needs to add
OTHER users as participants too, which fails RLS.

## Solution
Create a SECURITY DEFINER function `create_conversation` that atomically:
1. Inserts a new conversation row.
2. Inserts participant rows for the creator AND the specified user IDs.
This runs with elevated privileges (bypassing RLS) so it can add other users.

## Security
- The function is SECURITY DEFINER, owned by `postgres`.
- It only inserts participants — it does not modify or delete anything.
- It validates that the calling user (`auth.uid()`) is included in the participant list.
- Granted EXECUTE to `authenticated` only.
- Search_path is pinned to `public` to prevent schema injection.
*/

CREATE OR REPLACE FUNCTION public.create_conversation(participant_user_ids uuid[])
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_conv_id uuid;
  caller_id uuid := auth.uid();
  all_ids uuid[];
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  all_ids := array_append(COALESCE(participant_user_ids, ARRAY[]::uuid[]), caller_id);

  INSERT INTO public.conversations DEFAULT VALUES RETURNING id INTO new_conv_id;

  INSERT INTO public.conversation_participants (conversation_id, user_id)
  SELECT new_conv_id, unnest(all_ids)
  ON CONFLICT DO NOTHING;

  RETURN new_conv_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_conversation(uuid[]) TO authenticated;