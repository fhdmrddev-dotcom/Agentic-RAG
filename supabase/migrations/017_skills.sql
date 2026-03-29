-- Phase 10: Agent Skills Core
-- Migration 017: Skills feature
-- Creates the skills + skill_files tables, RLS policies, storage bucket, and storage RLS.

-- ============================================================
-- skills table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.skills (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name         text NOT NULL,
  description  text NOT NULL DEFAULT '',
  instructions text NOT NULL DEFAULT '',
  is_enabled   boolean NOT NULL DEFAULT true,
  is_global    boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS skills_user_id_idx ON public.skills(user_id);

-- ============================================================
-- skills RLS
-- ============================================================
ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own and global skills"
  ON public.skills FOR SELECT
  USING (auth.uid() = user_id OR is_global = true);

CREATE POLICY "Users can insert own skills"
  ON public.skills FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own skills"
  ON public.skills FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own skills"
  ON public.skills FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================
-- updated_at trigger (reuses existing set_updated_at from 014_folders.sql)
-- ============================================================
DROP TRIGGER IF EXISTS skills_set_updated_at ON public.skills;
CREATE TRIGGER skills_set_updated_at
  BEFORE UPDATE ON public.skills
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- skill_files table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.skill_files (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_id   uuid NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  filename   text NOT NULL,
  file_path  text NOT NULL,
  file_size  bigint NOT NULL DEFAULT 0,
  mime_type  text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS skill_files_skill_id_idx ON public.skill_files(skill_id);
CREATE INDEX IF NOT EXISTS skill_files_user_id_idx ON public.skill_files(user_id);

-- ============================================================
-- skill_files RLS
-- ============================================================
ALTER TABLE public.skill_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view files on own or global skills"
  ON public.skill_files FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.skills
      WHERE skills.id = skill_files.skill_id
        AND skills.is_global = true
    )
  );

CREATE POLICY "Users can insert own skill files"
  ON public.skill_files FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own skill files"
  ON public.skill_files FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================
-- Storage bucket (idempotent)
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('skill-files', 'skill-files', false)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- Storage RLS (3 policies on storage.objects)
-- ============================================================
CREATE POLICY "Users can read own skill files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'skill-files'
    AND (
      (storage.foldername(name))[1] = (select auth.uid()::text)
      OR EXISTS (
        SELECT 1 FROM public.skill_files sf
        JOIN public.skills s ON s.id = sf.skill_id
        WHERE sf.file_path = name
          AND s.is_global = true
      )
    )
  );

CREATE POLICY "Users can upload to own skill files folder"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'skill-files'
    AND (storage.foldername(name))[1] = (select auth.uid()::text)
  );

CREATE POLICY "Users can delete own skill files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'skill-files'
    AND (storage.foldername(name))[1] = (select auth.uid()::text)
  );
