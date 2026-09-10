-- 156_grant_default_ingest_visibility_column.sql
-- Phase 231 follow-up — BUG-260905-04, a regression introduced by migration 155.
--
-- ⛔ WHAT BROKE, AND WHY IT WAS INVISIBLE UNTIL A HUMAN OPENED THE PAGE.
-- `connector_connections` does NOT have table-level grants. Migration 118 granted SELECT to
-- `authenticated` COLUMN BY COLUMN, deliberately, so the secret columns could be withheld. A
-- column added by any later migration is therefore UNREADABLE by `authenticated` unless that
-- migration also grants it — and 155 did not.
--
-- The symptom is not an error anyone would connect to a migration: the Connections page renders
-- "Could not load connections. Nothing is wrong with them — this page could not read them."
-- because the browser's user-JWT `select("*")` is refused on the one ungranted column.
--
-- ⚠ EVERY GATE STAYED GREEN. The backend's own reads use the SERVICE ROLE, which already had the
--   column, so `_to_response`, `list_connections` and the whole unit suite passed. Only a request
--   carrying a real user JWT can see this, and nothing in the suite makes one.
--   **This is the second time this exact trap has fired on this exact table.**
--
-- ⭐ THE RULE THIS MIGRATION EXISTS TO RESTATE: on `connector_connections`, adding a column is not
--    finished until the column is GRANTED. Mirror the grants of an adjacent non-secret column —
--    here `default_approval_posture`, which carries INSERT/SELECT/UPDATE for `authenticated`.
--    NEVER grant on the table: that would hand `authenticated` the secret columns 118 withheld.
--
-- Apply discipline (CLAUDE.md): paste into the Supabase SQL editor.
-- NEVER `supabase db push` / `db reset`.
-- ============================================================================

BEGIN;

-- Exactly the privilege set `default_approval_posture` carries, and nothing wider.
GRANT SELECT (default_ingest_visibility) ON public.connector_connections TO authenticated;
GRANT INSERT (default_ingest_visibility) ON public.connector_connections TO authenticated;
GRANT UPDATE (default_ingest_visibility) ON public.connector_connections TO authenticated;

GRANT SELECT (default_ingest_visibility) ON public.connector_connections TO service_role;
GRANT INSERT (default_ingest_visibility) ON public.connector_connections TO service_role;
GRANT UPDATE (default_ingest_visibility) ON public.connector_connections TO service_role;

COMMIT;
