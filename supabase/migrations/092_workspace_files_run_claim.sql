-- 092_workspace_files_run_claim.sql — Phase 141 (COLL-02 / D-141-02, D-141-04).
-- Run-scope the ephemeral `template_input` resolver: record WHICH run-context first
-- resolved (claimed) a workspace_files row so a foreign run-context can never silently
-- resolve it. Adds ONE ADDITIVE, NULLABLE column to `public.workspace_files`:
--   run_claim text — the claiming LINEAGE:
--     * `str(workflow_run_id)` when a WORKFLOW phase resolves the row, else
--     * the fixed `'deep'` sentinel when a DEEP turn resolves it.
--   NULL = unclaimed (never yet resolved). The `'deep'` sentinel (vs. leaving Deep-
--   resolved rows NULL) is what makes the block SYMMETRIC — it lets the resolver block
--   the Deep→workflow direction too (a later workflow run cannot claim a Deep-claimed row).
--
-- CRITICAL DIVERGENCE from migration 076 (`messages.origin`): 076 used
-- `NOT NULL DEFAULT 'deep'` because every message is written by a KNOWN mode at insert.
-- A `template_input` row is BORN RUN-LESS (`api/workspace.py` upload — "the handler has
-- no run") and MUST stay unclaimed until first resolve. So this column is NULLABLE with
-- NO DEFAULT and NO backfill (D-141-04, mirror 120 D-05). Copying 076's
-- `NOT NULL DEFAULT 'deep'` would instantly deep-claim EVERY legacy row → a later
-- legitimate workflow run could never resolve a pre-existing thread template = a
-- permanent cross-context block + a felt regression (141-RESEARCH Pitfall 3). Pre-
-- migration rows stay `run_claim IS NULL` (unclaimed) and get claimed on first resolve.
--
-- No CHECK constraint and no FK: the value is a workflow_run_id OR the `'deep'` sentinel
-- (a uuid FK cannot hold the sentinel), and it is SERVER-SET ONLY (derived from
-- `ToolContext.workflow_run_id`, never from tool args / user input) — no injection
-- surface, so no validation constraint is needed (V4 / V5). No new RLS policy: `run_claim`
-- inherits workspace_files' existing thread-owner RLS (mirror migration 076/050). The
-- resolver's `created_by = $user_id` scope stays the app-layer backstop (V4).
--
-- `IF NOT EXISTS` on the column ADD makes a re-apply a no-op (idempotent).
--
-- Apply BY HAND — paste this whole file into the Supabase SQL editor (or psycopg2 to
-- local :54322 per the 100/099/101.1/102/110/111/114/116/120 precedent) — NEVER
-- `supabase db push` / `supabase db reset` (both wipe local dev data). Then
-- `bash scripts/regenerate-full-schema.sh` (no `--reset`), and commit the migration +
-- the regenerated `full-schema.sql` together. Cloud parity: apply 092 to cloud Supabase
-- by hand at deploy (`scripts/pending-cloud-migrations.sh` lists it).
--
-- Plan 141-03 (operator, autonomous:false / BLOCKING) applies this file to the live DB
-- and regenerates full-schema.sql. THIS plan (141-01) ONLY AUTHORS the file — it is NOT
-- applied here, and `supabase/full-schema.sql` is NOT touched here.

ALTER TABLE public.workspace_files
    ADD COLUMN IF NOT EXISTS run_claim text;

COMMENT ON COLUMN public.workspace_files.run_claim IS
    'Phase 141 (COLL-02). Run-context claim lineage for kind=''template_input'' rows: '
    'str(workflow_run_id) for a workflow phase, the ''deep'' sentinel for a Deep turn, '
    'NULL = unclaimed. Server-set on first resolve; the ''deep'' sentinel makes the '
    'cross-context block symmetric. Nullable, no default, no backfill (D-141-02/04).';
