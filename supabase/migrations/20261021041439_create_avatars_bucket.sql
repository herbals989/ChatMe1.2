/*
# Create avatars storage bucket and policies

## Purpose
A public storage bucket named `avatars` for user display picture (DP) uploads.
Each authenticated user can read all avatars (public) and upload/update only
to a path prefixed with their own user ID.

## Changes
1. Insert a row into `storage.buckets` for `avatars` (public = true).
2. Create storage policies:
   - SELECT (read): any authenticated user can read avatars.
   - INSERT (upload): authenticated users can upload to their own prefix (`id/`).
   - UPDATE: authenticated users can update files in their own prefix.
   - DELETE: authenticated users can delete files in their own prefix.
*/

INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "avatars_read_authenticated" ON storage.objects;
CREATE POLICY "avatars_read_authenticated"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "avatars_upload_own" ON storage.objects;
CREATE POLICY "avatars_upload_own"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "avatars_update_own" ON storage.objects;
CREATE POLICY "avatars_update_own"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "avatars_delete_own" ON storage.objects;
CREATE POLICY "avatars_delete_own"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
