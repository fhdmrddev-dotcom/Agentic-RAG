-- Migration 203 — Phase 274 (ATT-03 / D-28)
-- public.workspace_files — the "In Library" mark on a chat attachment.
--
-- PURPOSE. A chat attachment lives in workspace_files for the life of its thread (Phase 274,
-- D-05: expires_at NULL). When the person saves it to the Library (plan 274-02), the attachment
-- row records WHICH Library document it became, and HOW:
--   library_document_id = <uuid>, library_link = 'saved'    → this attachment was saved as that document
--   library_document_id = <uuid>, library_link = 'already'  → an identical document already existed
--   library_document_id = NULL                              → not in the Library (or the document was deleted)
-- Readers treat library_link as meaningful ONLY when library_document_id is non-null.
--
-- WHY ON DELETE SET NULL (T-274-06).
--   Documents are HARD-deleted (DELETE /documents/{id}). A NO ACTION foreign key would make every
--   promoted document undeletable, because the attachment row still points at it. SET NULL lets
--   the document go and leaves the attachment reading "not in the Library" — the true state.
--
-- WHY THERE IS NO CHECK PAIRING THE TWO COLUMNS.
--   ON DELETE SET NULL nulls ONLY the FK column. A CHECK such as
--   ((library_document_id IS NULL) = (library_link IS NULL)) would therefore REJECT the very
--   document delete the SET NULL exists to allow. The stale library_link left behind is harmless
--   because of the reader rule above.
--
-- No backfill (schema only — no attachment has been saved before 274). No GRANT, no anon, no RLS
-- change: workspace_files keeps RLS and its *_own policies, and table-level grants already cover
-- new columns (workspace_files has no column-level grants).
--
-- Apply discipline (CLAUDE.md): paste into the Supabase SQL editor, or run this file's text
-- directly against local Postgres. NEVER `supabase db push` / `db reset`. Idempotent: safe to
-- paste twice. No DO block, no COMMIT inside a procedure (migrations 105/107 precedent).
--
-- PRODUCTION ORDERING: production still needs migration 202 first, then 203. Apply 203 BEFORE the
-- backend that reads these columns deploys, then run get_advisors(security).
-- ============================================================================

BEGIN;

ALTER TABLE public.workspace_files
    ADD COLUMN IF NOT EXISTS library_document_id uuid REFERENCES public.documents(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS library_link text;

ALTER TABLE public.workspace_files DROP CONSTRAINT IF EXISTS workspace_files_library_link_check;
ALTER TABLE public.workspace_files
    ADD CONSTRAINT workspace_files_library_link_check
    CHECK (library_link IS NULL OR library_link IN ('saved', 'already'));

-- Partial index: the FK's ON DELETE SET NULL scans workspace_files by library_document_id on every
-- document delete; only marked rows are ever matched.
CREATE INDEX IF NOT EXISTS idx_workspace_files_library_document_id
    ON public.workspace_files (library_document_id)
    WHERE library_document_id IS NOT NULL;

COMMENT ON COLUMN public.workspace_files.library_document_id IS
    'Phase 274 (ATT-03 / D-28). The Library document this chat attachment was saved as, or the '
    'identical document that already existed. ON DELETE SET NULL: a promoted document stays '
    'deletable, and the attachment then reads "not in the Library".';

COMMENT ON COLUMN public.workspace_files.library_link IS
    'Phase 274 (ATT-03 / D-28). saved = this attachment was saved to the Library; already = an '
    'identical document already existed. Meaningful ONLY when library_document_id is non-null '
    '(no pairing CHECK: SET NULL nulls only the FK column).';

COMMENT ON COLUMN public.workspace_files.expires_at IS
    'Phase 100 TMPL-01; Phase 274 D-05/D-06. NULL = lives with the thread (agent files, and chat '
    'attachments from Phase 274 on — removed with their bytes when the thread is deleted). '
    'Non-NULL = TTL (workflow template inputs): the read-path filter excludes the row once now() '
    'passes it, the lifespan sweep GCs row + Storage bytes, and the kickoff run-pin extends it.';

COMMIT;

-- Verify (read-only):
-- SELECT column_name, data_type, is_nullable
--   FROM information_schema.columns
--  WHERE table_schema = 'public' AND table_name = 'workspace_files'
--    AND column_name IN ('library_document_id', 'library_link')
--  ORDER BY column_name;
-- expected: library_document_id uuid YES · library_link text YES
--
-- SELECT conname, pg_get_constraintdef(oid)
--   FROM pg_constraint
--  WHERE conrelid = 'public.workspace_files'::regclass
--    AND conname IN ('workspace_files_library_link_check', 'workspace_files_library_document_id_fkey')
--  ORDER BY conname;
-- expected: the CHECK (library_link IS NULL OR library_link IN ('saved','already')) and the FK
--           ... REFERENCES documents(id) ON DELETE SET NULL
--
-- SELECT relrowsecurity FROM pg_class WHERE oid = 'public.workspace_files'::regclass;
-- expected: t
