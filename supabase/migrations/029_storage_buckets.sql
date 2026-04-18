-- Migration 029: Restore missing columns and storage buckets
--
-- Fixes two gaps that existed only in the stale backend/supabase/migrations/ directory:
--   1. documents.full_markdown — added in backend/014 but never in supabase/migrations/
--   2. documents bucket — always created manually, never in any migration
--   3. sandbox-outputs bucket — defined in backend/015 but not in supabase/migrations/

-- ============================================================
-- documents.full_markdown column
-- ============================================================
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS full_markdown text;

-- ============================================================
-- documents bucket + RLS
-- Storage path: {user_id}/{document_id}/{filename}
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Users can read own documents" ON storage.objects;
CREATE POLICY "Users can read own documents"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = (select auth.uid()::text)
  );

DROP POLICY IF EXISTS "Users can upload to own documents folder" ON storage.objects;
CREATE POLICY "Users can upload to own documents folder"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = (select auth.uid()::text)
  );

DROP POLICY IF EXISTS "Users can delete own documents" ON storage.objects;
CREATE POLICY "Users can delete own documents"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = (select auth.uid()::text)
  );

-- ============================================================
-- sandbox-outputs bucket + RLS
-- Storage path: {user_id}/{execution_id}/{filename}
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('sandbox-outputs', 'sandbox-outputs', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Users can read own sandbox outputs" ON storage.objects;
CREATE POLICY "Users can read own sandbox outputs"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'sandbox-outputs'
    AND (storage.foldername(name))[1] = (select auth.uid()::text)
  );

DROP POLICY IF EXISTS "Users can upload to own sandbox outputs folder" ON storage.objects;
CREATE POLICY "Users can upload to own sandbox outputs folder"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'sandbox-outputs'
    AND (storage.foldername(name))[1] = (select auth.uid()::text)
  );

DROP POLICY IF EXISTS "Users can delete own sandbox outputs" ON storage.objects;
CREATE POLICY "Users can delete own sandbox outputs"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'sandbox-outputs'
    AND (storage.foldername(name))[1] = (select auth.uid()::text)
  );
