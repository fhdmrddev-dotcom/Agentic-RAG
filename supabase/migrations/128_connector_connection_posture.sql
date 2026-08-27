-- 128_connector_connection_posture.sql
-- Phase 213 (GRANT-01, GRANT-02) — Per-Tool Grants and the Approval Moment.
--
-- Decisions: D-213-05 (migrate tool_grants in place to posture map 'allow' | 'ask' | 'deny'),
--            D-213-06 (absent key means INHERIT connection default_approval_posture),
--            D-213-07 (shape-aware backfill: MCP rows and capability rows grandfathered safely),
--            D-213-08 (default_approval_posture column + column-level GRANT SELECT in same migration).
--
-- WHY: Tools offered by a connection need granular approval postures ('allow' | 'ask' | 'deny').
-- This migration adds `default_approval_posture` with a CHECK constraint ('allow', 'ask', 'deny'),
-- migrates existing boolean tool_grants safely, grandfathers legacy rows without arming new actions,
-- and grants column-level SELECT to authenticated without exposing secret_ciphertext (SEC-2).
--
-- ── Apply discipline (CLAUDE.md, D-21) ───────────────────────────────────────────────────
--   Paste this WHOLE file into the LOCAL Supabase SQL editor and run it. NEVER apply it with
--   the Supabase CLI's push or reset subcommands. Then run `bash scripts/regenerate-full-schema.sh`
--   with NO `--reset`, and commit this migration together with the regenerated
--   `supabase/full-schema.sql`. Never hand-edit that file.
--
--   The whole file is RE-PASTE-SAFE: `ADD COLUMN IF NOT EXISTS`, `DROP CONSTRAINT IF EXISTS`
--   before every `ADD CONSTRAINT`, and all backfills carry idempotent transformations.

-- ================================================================================================
-- §1 — the column
-- ================================================================================================
ALTER TABLE public.connector_connections
    ADD COLUMN IF NOT EXISTS default_approval_posture text NOT NULL DEFAULT 'ask';

COMMENT ON COLUMN public.connector_connections.default_approval_posture IS
  'Phase 213 (D-213-06, D-213-08): The connection-level default approval posture (''allow'', ''ask'', ''deny''). Newly discovered or unconfigured tools inherit this posture until explicitly overridden in tool_grants.';

-- ================================================================================================
-- §2 — the constraint
-- ================================================================================================
ALTER TABLE public.connector_connections
    DROP CONSTRAINT IF EXISTS connector_connections_default_posture_check;

ALTER TABLE public.connector_connections
    ADD CONSTRAINT connector_connections_default_posture_check
    CHECK (default_approval_posture IN ('allow', 'ask', 'deny'));

-- ================================================================================================
-- §3 — the shape-aware backfill (D-213-07)
-- ================================================================================================
-- MCP rows: default_approval_posture = 'deny', tool_grants true -> 'allow', false keys dropped
UPDATE public.connector_connections
   SET default_approval_posture = 'deny',
       tool_grants = COALESCE(
         (
           SELECT jsonb_object_agg(key, 'allow')
             FROM jsonb_each(COALESCE(tool_grants, '{}'::jsonb))
            WHERE value = 'true'::jsonb OR value = '"allow"'::jsonb
         ),
         '{}'::jsonb
       )
 WHERE mcp_server_url IS NOT NULL;

-- Capability rows: default_approval_posture = 'deny', tool_grants = {capability: 'allow'}
UPDATE public.connector_connections
   SET default_approval_posture = 'deny',
       tool_grants = jsonb_build_object(capability, 'allow')
 WHERE capability IS NOT NULL;

-- ================================================================================================
-- §4 — column-level SELECT grant (SEC-2, D-213-08)
-- ================================================================================================
-- ⚠ MIGRATION 118 RE-GRANTED `SELECT` ON THIS TABLE COLUMN BY COLUMN TO `authenticated` so
-- that `secret_ciphertext` could be excluded by omission. A NEW COLUMN IS UNREADABLE BY DEFAULT.
-- The column added to `connector_connections` owes its grant HERE, in the same migration.
GRANT SELECT (
    default_approval_posture
) ON public.connector_connections TO authenticated;
