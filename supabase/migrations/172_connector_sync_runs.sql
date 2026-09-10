-- 172_connector_sync_runs.sql
-- Phase 235: The Source Says What It Did — SURF-02 / D-235-06 / D-235-07 / D-235-08
--
-- Gives the watch loop's counts dict a home.
--
-- `watch_service.py:203` computes {new, modified, renamed, missing, restored, errors},
-- logs it at `:435-439`, and returns it to a caller that discards it (`tick():111`).
-- SURF-02's sentence — "a person can see what a sync actually did" — is unanswerable
-- until that dict is stored. One row per release of a watch, written from
-- `db/watches.py::release_watch` so that all four release arms
-- (`watch_service.py:115`, `:143`, `:434`, `:458`) get a row BY CONSTRUCTION and a
-- future fifth arm cannot forget.
--
-- Append-only history (stated deviation from 168): this table has NO `updated_at`
-- column and NO mutation trigger. A run happened; it is not edited afterwards.
--
-- Retention is bounded ON WRITE (D-235-08): the insert prunes to the most recent
-- `WATCH_RUN_HISTORY_RETENTION` rows for that watch in ONE statement. There is no
-- unbounded-growth path and no sweeper to forget to run.
--
-- Grants (stated deviation, deliberate): the FULL 168 grant set is kept verbatim
-- rather than narrowed to SELECT for `authenticated`. Research assumption A1 — which
-- database role the asyncpg pool connects as, versus these grants — is this phase's
-- one unverified link, and `release_watch` SWALLOWS its exceptions, so a
-- silently-failing INSERT would be invisible. FOLLOW-UP: once the pool role is
-- measured, narrow `authenticated` to SELECT (history is written by the daemon, never
-- by a browser). Recorded here rather than taken blind.
--
-- Also reconciles migration 168's own defect: its `connector_watches.last_status`
-- COMMENT is wrong in two directions (see the block at the foot of this file).
--
-- Apply discipline (CLAUDE.md): paste into the Supabase SQL editor.
-- NEVER `supabase db push` / `db reset`.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.connector_sync_runs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    watch_id uuid NOT NULL REFERENCES public.connector_watches(id) ON DELETE CASCADE,

    started_at timestamptz NOT NULL DEFAULT now(),
    finished_at timestamptz,

    status text NOT NULL,
    failure_cause text,
    last_error text,

    listing_complete boolean NOT NULL DEFAULT false,

    -- Six flat integers, deliberately NOT a jsonb blob. A jsonb string-scalar column
    -- has silently killed a per-step count in this repository before
    -- (`workflow_phases.output`, Phase 200). Named integers cannot suffer that, index
    -- cleanly, and let the Health verdict be a plain SQL aggregate.
    count_new integer NOT NULL DEFAULT 0,
    count_modified integer NOT NULL DEFAULT 0,
    count_renamed integer NOT NULL DEFAULT 0,
    count_missing integer NOT NULL DEFAULT 0,
    count_restored integer NOT NULL DEFAULT 0,
    count_errors integer NOT NULL DEFAULT 0,

    created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.connector_sync_runs IS
  'Phase 235 (SURF-02): One row per release of a connector watch — what a single sync tick actually did. Append-only; pruned on write to the most recent N rows per watch (WATCH_RUN_HISTORY_RETENTION).';

COMMENT ON COLUMN public.connector_sync_runs.status IS
  'Terminal outcome of the tick, mirroring the status handed to release_watch. Measured set written by production code today: success, failed, paused. Deliberately free text with NO CHECK constraint — an unanticipated value written by a background loop must never become a 500 (the same reasoning that left connector_watches.last_status unconstrained).';

COMMENT ON COLUMN public.connector_sync_runs.failure_cause IS
  'Machine-readable classification of WHY a non-success tick ended that way (e.g. token_revoked, folder_gone, unreachable, unknown). Free text with NO CHECK, for the same reason as status. NULL on a successful tick. The human sentence for a cause lives in the frontend vocabulary leaf, never here.';

COMMENT ON COLUMN public.connector_sync_runs.listing_complete IS
  'H-5 / SRC-06 provenance, and it is load-bearing. watch_service.py:415-420 SUPPRESSES missing-state transitions when the source listing did not finish exhaustively (e.g. mid-pagination error), so such a tick records count_missing = 0 by design rather than by observation. Rendering that 0 as "nothing was deleted" without this flag would be the Onyx #1161 lie one layer up. FALSE means the counts below are a floor, not a census.';

COMMENT ON COLUMN public.connector_sync_runs.started_at IS
  'When the tick STARTED. Recorded here because connector_watches.last_run_at is set at CLAIM time (db/watches.py claim_due_watches, before any work), so that column also means "when the tick started" and the watch row alone cannot say when a tick ended.';

COMMENT ON COLUMN public.connector_sync_runs.finished_at IS
  'When the tick was released. NULL only if a writer omitted it; the pair (started_at, finished_at) is what makes a duration honest, which last_run_at alone cannot express.';

-- ── Indexes ──────────────────────────────────────────────────────────────────
-- THE history read AND the consecutive-failure derivation. One index serves both:
-- the per-watch history page reads ORDER BY started_at DESC, and the "N consecutive
-- soft failures" verdict is DERIVED from the leading rows of the same ordering
-- rather than from a counter column that four write sites could drift.
CREATE INDEX IF NOT EXISTS idx_connector_sync_runs_watch_time
  ON public.connector_sync_runs USING btree (watch_id, started_at DESC);

-- Tenant & owner lookup
CREATE INDEX IF NOT EXISTS idx_connector_sync_runs_org_user
  ON public.connector_sync_runs USING btree (org_id, user_id);

-- ── RLS (Shape A: Tenant membership AND owner) ──────────────────────────────
ALTER TABLE public.connector_sync_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS connector_sync_runs_select ON public.connector_sync_runs;
CREATE POLICY connector_sync_runs_select ON public.connector_sync_runs
  FOR SELECT TO authenticated
  USING (org_id IN (SELECT public.current_user_org_ids()) AND (auth.uid() = user_id));

DROP POLICY IF EXISTS connector_sync_runs_insert ON public.connector_sync_runs;
CREATE POLICY connector_sync_runs_insert ON public.connector_sync_runs
  FOR INSERT TO authenticated
  WITH CHECK (org_id IN (SELECT public.current_user_org_ids()) AND (auth.uid() = user_id));

DROP POLICY IF EXISTS connector_sync_runs_update ON public.connector_sync_runs;
CREATE POLICY connector_sync_runs_update ON public.connector_sync_runs
  FOR UPDATE TO authenticated
  USING (org_id IN (SELECT public.current_user_org_ids()) AND (auth.uid() = user_id))
  WITH CHECK (org_id IN (SELECT public.current_user_org_ids()) AND (auth.uid() = user_id));

DROP POLICY IF EXISTS connector_sync_runs_delete ON public.connector_sync_runs;
CREATE POLICY connector_sync_runs_delete ON public.connector_sync_runs
  FOR DELETE TO authenticated
  USING (org_id IN (SELECT public.current_user_org_ids()) AND (auth.uid() = user_id));

-- ── Triggers ─────────────────────────────────────────────────────────────────
-- Autofill org_id from user_id if omitted
DROP TRIGGER IF EXISTS connector_sync_runs_autofill_org_id ON public.connector_sync_runs;
CREATE TRIGGER connector_sync_runs_autofill_org_id BEFORE INSERT ON public.connector_sync_runs
  FOR EACH ROW EXECUTE FUNCTION public.autofill_org_id_by_owner('user_id');

-- ⛔ No mutation trigger, and no updated_at column for one to touch. 168 carries both;
-- this table deliberately does not, because it is append-only history. A run row that
-- can be edited after the fact is not a record of what happened.

-- ── Grants ───────────────────────────────────────────────────────────────────
REVOKE ALL ON TABLE public.connector_sync_runs FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.connector_sync_runs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.connector_sync_runs TO service_role;

-- ── Reconciliation of migration 168's last_status COMMENT (Phase 235 / C-6) ──
-- 168:65-66 documents the enumeration 'success, failed, running, skipped_still_running,
-- or partial'. That is wrong in TWO directions, both measured:
--   * it documents two values NOTHING writes — `partial` has no writer at all, and
--     `record_skipped_still_running` (db/watches.py) is imported by watch_service.py
--     and called from no production path, only from a unit test;
--   * it OMITS `paused`, which watch_service.py:143 does write when the underlying
--     connection is disabled.
-- No CHECK constraint is added: the column stays free text so an unanticipated status
-- in a background loop can never become a 500. The COMMENT is corrected to the
-- measured set instead, because a comment that documents intent must at least not
-- contradict the code.
COMMENT ON COLUMN public.connector_watches.last_status IS
  'Status of the latest sync run. MEASURED set actually written by production code: running (set at claim time), success, failed, paused (connection disabled). Note: "pending" is synthesised at READ time by api/sources.py and is never stored. The values partial and skipped_still_running were documented by migration 168 and are written by nothing. Free text by design — no CHECK constraint, so an unanticipated status in a background loop can never become a 500.';

COMMIT;
