/*
# Revoke anon access to SECURITY DEFINER functions

## Changes
- Revoke EXECUTE on `create_conversation` and `handle_new_user` from the `anon`
  role so unauthenticated users cannot call these privileged functions.
- Keep EXECUTE granted to `authenticated` only (for create_conversation).
- handle_new_user is a trigger function — it does not need EXECUTE from any role
  except the trigger invoker, so we revoke from both anon and authenticated.
*/

REVOKE EXECUTE ON FUNCTION public.create_conversation(uuid[]) FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;