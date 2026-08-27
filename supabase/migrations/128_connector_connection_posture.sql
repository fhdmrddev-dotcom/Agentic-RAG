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
--   §1, §2 and §4 are RE-PASTE-SAFE: `ADD COLUMN IF NOT EXISTS`, `DROP CONSTRAINT IF EXISTS`
--   before every `ADD CONSTRAINT`, and a `GRANT` that is idempotent by definition.
--
--   ⚠ CORRECTED 2026-08-27 (plan 213-06) — THIS HEADER CLAIMED "The whole file is
--   RE-PASTE-SAFE" AND §3 IS NOT. The original wording is kept above rather than quietly
--   swapped, because a false safety claim is worse than no claim: it INVITES the re-paste.
--   §3 is idempotent in the arithmetic sense — running it twice on an UNTOUCHED database
--   yields the same rows — and DESTRUCTIVE in the operator sense: it overwrites
--   `tool_grants` wholesale, so on a database where people have since set postures it
--   RESETS EVERY ONE of them and returns the connection default to `deny`. The MCP arm has
--   the same property; its `WHERE value = 'true' OR value = '"allow"'` silently drops any
--   `ask` or `deny` a person chose.
--
--   The §3 guard below makes that structural rather than a warning: both backfills now skip
--   any row that has already been migrated. The project rule `never re-execute an applied
--   migration` still stands and is the real protection — this is the belt to its braces.
--
--   ⚠ AND THE GUARD'S OWN RESIDUAL IS STATED RATHER THAN LEFT TO BE FOUND: it keys on
--   `default_approval_posture = 'ask'` plus the absence of any string-valued grant, so ONE
--   case still slips through — a connection a person has deliberately set BACK to `ask`
--   while overriding no individual tool. A re-paste would return that row to `deny`. It is
--   narrow, it fails CLOSED (toward refusing, never toward sending), and naming it is worth
--   more than a guard that claims to be total and is not.

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
 WHERE mcp_server_url IS NOT NULL
   -- ⚠ RE-PASTE GUARD (213-06): only rows still carrying the PRE-213 shape. A row whose
   -- grants are already posture strings, or whose default is already set, has been migrated
   -- and its postures are now a person's decisions — not this migration's to overwrite.
   AND default_approval_posture = 'ask'
   AND NOT EXISTS (
         SELECT 1 FROM jsonb_each(COALESCE(tool_grants, '{}'::jsonb))
          WHERE jsonb_typeof(value) = 'string'
       );

-- Capability rows: default_approval_posture = 'deny', tool_grants = {capability: 'allow'}
UPDATE public.connector_connections
   SET default_approval_posture = 'deny',
       tool_grants = jsonb_build_object(capability, 'allow')
 WHERE capability IS NOT NULL
   -- ⚠ RE-PASTE GUARD (213-06) — see the MCP arm above. Without it a re-paste discards
   -- every per-tool posture set on a capability connection since the migration ran.
   AND default_approval_posture = 'ask'
   AND NOT EXISTS (
         SELECT 1 FROM jsonb_each(COALESCE(tool_grants, '{}'::jsonb))
          WHERE jsonb_typeof(value) = 'string'
       );

-- ================================================================================================
-- §4 — column-level SELECT grant (SEC-2, D-213-08)
-- ================================================================================================
-- ⚠ MIGRATION 118 RE-GRANTED `SELECT` ON THIS TABLE COLUMN BY COLUMN TO `authenticated` so
-- that `secret_ciphertext` could be excluded by omission. A NEW COLUMN IS UNREADABLE BY DEFAULT.
-- The column added to `connector_connections` owes its grant HERE, in the same migration.
GRANT SELECT (
    default_approval_posture
) ON public.connector_connections TO authenticated;
