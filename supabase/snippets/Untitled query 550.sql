-- Migration 014: Document-Folder Integration (Phase 2)
-- Adds folder_id (nullable FK to folders, ON DELETE SET NULL) and full_markdown (nullable text) to documents.
-- Backward-compatible: existing rows get NULL for both columns.

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS folder_id uuid REFERENCES public.folders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS full_markdown text;

CREATE INDEX IF NOT EXISTS documents_folder_id_idx ON public.documents(folder_id);
