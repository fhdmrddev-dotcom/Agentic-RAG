-- 155_connection_default_ingest_visibility.sql
-- Phase 231: the connection-level default that VIS-02's sentence describes.
--
-- ⚠ WHY THIS IS A SECOND MIGRATION AND NOT AN EDIT TO 154.
-- 154 is applied. CLAUDE.md: never re-execute an applied migration. 154 put
-- `ingest_visibility` on `documents` — the ENFORCED value, read by all four sites. This adds the
-- CHOSEN value on the connection, which is what the person actually sets and what VIS-02's plain
-- sentence is about. They are two different facts and both are needed:
--
--   connector_connections.default_ingest_visibility  — what the owner chose, once, per connection
--   documents.ingest_visibility                      — what was stamped on THIS row at ingest
--
-- Keeping the stamped copy is deliberate, not redundancy. Re-pointing a connection later must not
-- silently re-scope documents already brought in and already answered from; and D-4's freeze-on-
-- disconnect needs the document to keep its own answer after the connection is gone
-- (source_connection_id is ON DELETE SET NULL).
--
-- Shape is copied from `default_approval_posture` — the connection-level default this product
-- already has, applied per-action at use time. Inventing a second shape for the same idea is how
-- two vocabularies for one concept start.
--
-- Apply discipline (CLAUDE.md): paste into the Supabase SQL editor.
-- NEVER `supabase db push` / `db reset`.
-- ============================================================================

BEGIN;

ALTER TABLE public.connector_connections
  ADD COLUMN IF NOT EXISTS default_ingest_visibility text NOT NULL DEFAULT 'private';

-- Enum-shaped, never a boolean — the same 069-A contract 154's column carries, and the same
-- three values, so the two columns can never drift into different vocabularies.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'connector_connections_default_ingest_visibility_check'
  ) THEN
    ALTER TABLE public.connector_connections
      ADD CONSTRAINT connector_connections_default_ingest_visibility_check
      CHECK (default_ingest_visibility IN ('private', 'org', 'dept'));
  END IF;
END $$;

COMMENT ON COLUMN public.connector_connections.default_ingest_visibility IS
  'Phase 231 (VIS-02): who the connection owner said may read what this connection brings in. '
  'Stamped onto documents.ingest_visibility at ingest; changing it does NOT re-scope documents '
  'already brought in. Defaults to private — the narrow end — so a connection created by any '
  'path that forgets to ask is closed, not open.';

COMMIT;
