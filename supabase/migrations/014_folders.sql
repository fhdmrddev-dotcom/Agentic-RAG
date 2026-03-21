-- Migration 014: Folders feature
-- Creates the folders table, adds folder_id to documents, enables RLS, adds to Realtime.

-- ============================================================
-- folders table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.folders (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        text NOT NULL,
  parent_id   uuid REFERENCES public.folders(id) ON DELETE CASCADE,
  is_global   boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Index for tree traversal
CREATE INDEX IF NOT EXISTS folders_parent_id_idx ON public.folders(parent_id);
CREATE INDEX IF NOT EXISTS folders_user_id_idx ON public.folders(user_id);

-- Row-Level Security
ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own and global folders"
  ON public.folders FOR SELECT
  USING (auth.uid() = user_id OR is_global = true);

CREATE POLICY "Users can insert own folders"
  ON public.folders FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own folders"
  ON public.folders FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own folders"
  ON public.folders FOR DELETE
  USING (auth.uid() = user_id);

-- Add folders to Realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.folders;

-- ============================================================
-- Add folder_id to documents
-- ============================================================
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS folder_id uuid REFERENCES public.folders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS documents_folder_id_idx ON public.documents(folder_id);

-- updated_at trigger for folders
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS folders_set_updated_at ON public.folders;
CREATE TRIGGER folders_set_updated_at
  BEFORE UPDATE ON public.folders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
