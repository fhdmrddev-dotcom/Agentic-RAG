-- Migration 013: Folder Schema (Phase 1)
-- Adjacency list for nested folders with global/per-user visibility

CREATE TABLE public.folders (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name          text        NOT NULL,
  parent_id     uuid        REFERENCES public.folders(id) ON DELETE CASCADE,
  is_global     boolean     NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Indexes for fast lookups
CREATE INDEX folders_parent_id_idx ON public.folders(parent_id);
CREATE INDEX folders_user_id_idx ON public.folders(user_id);

-- Enable RLS
ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;

-- SELECT: owner sees their own + all global folders
CREATE POLICY "Users can view their own and global folders"
  ON public.folders FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR is_global = true);

-- INSERT: users can only insert their own folders
CREATE POLICY "Users can insert their own folders"
  ON public.folders FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- UPDATE: users can only update their own folders
CREATE POLICY "Users can update their own folders"
  ON public.folders FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- DELETE: users can only delete their own folders
CREATE POLICY "Users can delete their own folders"
  ON public.folders FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Auto-update updated_at on change (reuses existing trigger function from migration 001)
CREATE TRIGGER set_folders_updated_at
  BEFORE UPDATE ON public.folders
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
