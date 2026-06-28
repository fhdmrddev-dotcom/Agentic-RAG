-- ============================================================
-- FULL-SCHEMA SUPPLEMENT — cross-schema bootstrap bits
-- ============================================================
-- pg_dump --schema=public (used by regenerate-full-schema.sh) captures the
-- entire public schema (tables, functions, indexes, RLS on public tables) but
-- CANNOT capture objects that live in other schemas or are global:
--
--   * storage buckets        (rows in storage.buckets)
--   * storage RLS policies   (policies on storage.objects)
--   * the signup trigger     (trigger on auth.users)
--   * realtime memberships   (ALTER PUBLICATION supabase_realtime ...)
--
-- This file collects those bits so full-schema.sql is a TRUE one-paste
-- bootstrap for a fresh Supabase project (cloud or local). It is appended to
-- the generated dump by regenerate-full-schema.sh.
--
-- EVERYTHING HERE IS IDEMPOTENT — safe to run repeatedly (e.g. to patch an
-- already-provisioned DB that predates a new bucket/realtime table).
--
-- MAINTENANCE: when a NEW migration adds a storage bucket, an auth.users
-- trigger, or a realtime table, mirror it here (idempotently). Sources:
--   storage  -> migrations 017 (skill-files), 029 (documents, sandbox-outputs),
--               054 (workspace-files)
--   auth     -> migration 001 (on_auth_user_created)
--   realtime -> migrations 002 (documents), 014 (folders), 032 (messages)
-- ============================================================


-- ============================================================
-- 1. pgvector — ensure the extension exists in public.
--    (Belt-and-suspenders: the generator also injects this near the top so it
--    precedes the public.vector column/index definitions. Harmless here.)
-- ============================================================
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;


-- ============================================================
-- 2. Storage buckets (all private) + RLS on storage.objects
-- ============================================================

-- documents — path: {user_id}/{document_id}/{filename}
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false) ON CONFLICT (id) DO NOTHING;

-- sandbox-outputs — path: {user_id}/{execution_id}/{filename}
INSERT INTO storage.buckets (id, name, public)
VALUES ('sandbox-outputs', 'sandbox-outputs', false) ON CONFLICT (id) DO NOTHING;

-- skill-files — path: {user_id}/{...}
INSERT INTO storage.buckets (id, name, public)
VALUES ('skill-files', 'skill-files', false) ON CONFLICT (id) DO NOTHING;

-- workspace-files — path: {user_id}/{...}
INSERT INTO storage.buckets (id, name, public)
VALUES ('workspace-files', 'workspace-files', false) ON CONFLICT (id) DO NOTHING;

-- documents policies
DROP POLICY IF EXISTS "Users can read own documents" ON storage.objects;
CREATE POLICY "Users can read own documents" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'documents' AND (storage.foldername(name))[1] = (select auth.uid()::text));
DROP POLICY IF EXISTS "Users can upload to own documents folder" ON storage.objects;
CREATE POLICY "Users can upload to own documents folder" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'documents' AND (storage.foldername(name))[1] = (select auth.uid()::text));
DROP POLICY IF EXISTS "Users can delete own documents" ON storage.objects;
CREATE POLICY "Users can delete own documents" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'documents' AND (storage.foldername(name))[1] = (select auth.uid()::text));

-- sandbox-outputs policies
DROP POLICY IF EXISTS "Users can read own sandbox outputs" ON storage.objects;
CREATE POLICY "Users can read own sandbox outputs" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'sandbox-outputs' AND (storage.foldername(name))[1] = (select auth.uid()::text));
DROP POLICY IF EXISTS "Users can upload to own sandbox outputs folder" ON storage.objects;
CREATE POLICY "Users can upload to own sandbox outputs folder" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'sandbox-outputs' AND (storage.foldername(name))[1] = (select auth.uid()::text));
DROP POLICY IF EXISTS "Users can delete own sandbox outputs" ON storage.objects;
CREATE POLICY "Users can delete own sandbox outputs" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'sandbox-outputs' AND (storage.foldername(name))[1] = (select auth.uid()::text));

-- skill-files policies (read allows owner OR files belonging to a global skill)
DROP POLICY IF EXISTS "Users can read own skill files" ON storage.objects;
CREATE POLICY "Users can read own skill files" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'skill-files'
    AND (
      (storage.foldername(name))[1] = (select auth.uid()::text)
      OR EXISTS (
        SELECT 1 FROM public.skill_files sf
        JOIN public.skills s ON s.id = sf.skill_id
        WHERE sf.file_path = name AND s.is_global = true
      )
    )
  );
DROP POLICY IF EXISTS "Users can upload to own skill files folder" ON storage.objects;
CREATE POLICY "Users can upload to own skill files folder" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'skill-files' AND (storage.foldername(name))[1] = (select auth.uid()::text));
DROP POLICY IF EXISTS "Users can delete own skill files" ON storage.objects;
CREATE POLICY "Users can delete own skill files" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'skill-files' AND (storage.foldername(name))[1] = (select auth.uid()::text));

-- workspace-files policies
DROP POLICY IF EXISTS "workspace_storage_select_own" ON storage.objects;
CREATE POLICY "workspace_storage_select_own" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'workspace-files' AND (storage.foldername(name))[1] = (select auth.uid()::text));
DROP POLICY IF EXISTS "workspace_storage_insert_own" ON storage.objects;
CREATE POLICY "workspace_storage_insert_own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'workspace-files' AND (storage.foldername(name))[1] = (select auth.uid()::text));
DROP POLICY IF EXISTS "workspace_storage_delete_own" ON storage.objects;
CREATE POLICY "workspace_storage_delete_own" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'workspace-files' AND (storage.foldername(name))[1] = (select auth.uid()::text));


-- ============================================================
-- 3. Auth: auto-create a profile row on signup (trigger on auth.users)
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data->>'display_name');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- ============================================================
-- 4. Realtime: add tables to the supabase_realtime publication.
--    Wrapped so re-runs (table already a member) don't error.
-- ============================================================
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.documents;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.folders;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
