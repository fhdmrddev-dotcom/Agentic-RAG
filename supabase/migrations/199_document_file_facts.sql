-- 199 — Phase 270 (FIND-05 / FIND-04): the document as an object
-- Tables: public.documents (four typed file-fact columns), public.app_settings (download-link TTL)
--
-- WHY. FIND-05: a document's detail view must show what the FILE says about itself — pages, the date it
-- was created, the date it was last modified, its author. They are TYPED columns, not metadata jsonb,
-- so Phase 271 can filter and sort on them directly (the date_typed precedent). Every column is
-- nullable and there is NO backfill (D-01): an old row reads NULL, which the UI renders as
-- "not recorded". NULL is never 0 and never the upload date (that is created_at, a different fact).
--
-- FIND-04 / D-05: the lifetime of a minted download link is a setting, not a constant. It is bounded
-- 10-900 seconds by a CHECK so a hand-edited row can never make a signed link live for an hour.
--
-- DDL ONLY: no INSERT, no UPDATE, no policy, no GRANT, no index. documents and app_settings keep
-- their RLS policies exactly as they are. Idempotent: every statement is IF NOT EXISTS / DROP IF EXISTS.
--
-- Apply discipline (CLAUDE.md): paste into the Supabase SQL editor.
-- NEVER `supabase db push` / `db reset`. Safe to paste twice.
-- ============================================================================

BEGIN;

ALTER TABLE public.documents
    ADD COLUMN IF NOT EXISTS page_count integer,
    ADD COLUMN IF NOT EXISTS source_created_at timestamptz,
    ADD COLUMN IF NOT EXISTS source_modified_at timestamptz,
    ADD COLUMN IF NOT EXISTS source_author text;

ALTER TABLE public.documents DROP CONSTRAINT IF EXISTS documents_page_count_positive;
ALTER TABLE public.documents
    ADD CONSTRAINT documents_page_count_positive
    CHECK (page_count IS NULL OR page_count > 0);

ALTER TABLE public.app_settings
    ADD COLUMN IF NOT EXISTS document_download_url_ttl_seconds integer NOT NULL DEFAULT 60;

ALTER TABLE public.app_settings DROP CONSTRAINT IF EXISTS app_settings_download_ttl_bounds;
ALTER TABLE public.app_settings
    ADD CONSTRAINT app_settings_download_ttl_bounds
    CHECK (document_download_url_ttl_seconds BETWEEN 10 AND 900);

COMMENT ON COLUMN public.documents.page_count IS
    'Pages in the file, read from the PDF or DOCX at ingest. NULL = not recorded (non-paged format, unreadable file, or ingested before Phase 270). Never 0.';
COMMENT ON COLUMN public.documents.source_created_at IS
    'The date the FILE claims it was created (PDF CreationDate / DOCX core created), UTC. NULL = not recorded. Never the upload date, that is created_at.';
COMMENT ON COLUMN public.documents.source_modified_at IS
    'The date the FILE claims it was last modified (PDF ModDate / DOCX core modified), UTC. NULL = not recorded. Never the upload date.';
COMMENT ON COLUMN public.documents.source_author IS
    'The author the FILE names (PDF Author / DOCX core author), trimmed and capped at 512 chars. NULL = not recorded.';
COMMENT ON COLUMN public.app_settings.document_download_url_ttl_seconds IS
    'Lifetime in seconds of a minted document download link. Default 60; bounded 10-900 by app_settings_download_ttl_bounds.';

COMMIT;

-- Verify (run after applying; expect 5 rows, the TTL row NOT NULL default 60):
-- SELECT table_name, column_name, data_type, is_nullable, column_default
--   FROM information_schema.columns
--  WHERE table_schema = 'public'
--    AND ((table_name = 'documents' AND column_name IN ('page_count','source_created_at','source_modified_at','source_author'))
--      OR (table_name = 'app_settings' AND column_name = 'document_download_url_ttl_seconds'));
