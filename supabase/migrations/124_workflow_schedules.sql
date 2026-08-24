-- 124_workflow_schedules.sql
-- Phase 204 (SCHED-01 / D-204-08 / D-204-09) — the org-scoped workflow SCHEDULE table.
--
-- WHY: every workflow run in this product is started by a person. A published workflow that
-- should run every Monday at 08:00 has, until now, no representation at all — the operator has
-- to be at the keyboard. This table is where that intent lives: one row per (workflow, cadence),
-- carrying the cadence itself (cron OR interval), the timezone the cron is read in, the run
-- INPUTS the unattended run is launched with, and the per-run spend caps SCHED-02's circuit
-- breaker reads.
--
-- CREATE (not ALTER) — this table is net-new at 204. CREATE TABLE IF NOT EXISTS + DROP POLICY
-- IF EXISTS before every CREATE POLICY + DROP TRIGGER IF EXISTS before every CREATE TRIGGER, so
-- the whole file is RE-PASTE-SAFE (the rule 104:23 states, and 116 follows verbatim).
--
-- ── RLS: the shape is the OWNER form (108 Shape A), NOT `connector_connections`' org-wide read
--    form — and the difference is deliberate ─────────────────────────────────────────────────
--   A schedule is an instruction to SPEND MONEY on somebody's behalf, unattended, on a repeating
--   cadence. `connector_connections` is org-WIDE readable because a colleague's published
--   workflow must be able to bind it; nothing about a schedule needs a second reader. So every
--   policy below is the membership macro AND the owner branch:
--
--       org_id IN (SELECT public.current_user_org_ids()) AND (auth.uid() = user_id)
--
--   which is 108's Shape A applied verbatim. There is NO global escape branch and NO org-wide
--   read branch, and — as 116's D-12 note establishes for its own table — THE ABSENCE IS THE
--   DECISION. A sibling table (workflow_definitions) does carry such a branch, so its omission
--   here would otherwise read as something someone forgot. Anyone adding one is asserting that a
--   colleague may read (or, on UPDATE, silently re-point) a schedule that charges another
--   member's budget, and owes a threat-model entry rather than a policy edit.
--
--   Mechanical check on this file: the four policy bodies below contain no global-visibility
--   token of any kind; every occurrence of one lives inside this header comment.
--
-- ── THE CADENCE IS EXACTLY ONE OF TWO, ENFORCED IN SQL ───────────────────────────────────────
--   `schedule_cadence_exactly_one` is a CHECK, not a convention: a row with BOTH a cron and an
--   interval has no defined next-run and a row with NEITHER can never fire. The API validates
--   the cron STRING (croniter) before it ever reaches Postgres — SQL cannot parse a cron field —
--   but which-of-the-two is a shape question, and shape questions belong to the table. This is
--   the one invariant a future writer bypassing the API still cannot violate.
--
-- ── THE CLAIM INDEX IS THE POINT OF `(next_run_at) WHERE is_active` ──────────────────────────
--   The poller's ONLY hot read is `WHERE is_active AND next_run_at <= now() ... FOR UPDATE SKIP
--   LOCKED`. It is a PARTIAL index so an install with thousands of retired schedules pays
--   nothing for them.
--
-- ── Apply discipline (CLAUDE.md) ─────────────────────────────────────────────────────────────
--   Paste this WHOLE file into the LOCAL Supabase SQL editor and run it. NEVER `supabase db push`
--   / `supabase db reset` (both destroy dev data). Then run `bash scripts/regenerate-full-schema.sh`
--   with NO `--reset`, and commit this migration together with the regenerated
--   `supabase/full-schema.sql`. Never hand-edit that file. Filename is DIGITS-ONLY (`124_…`) — a
--   letter suffix like `124b` is silently skipped by the Supabase CLI, which would ship a table
--   that does not exist.
--
-- ── Cloud parity ────────────────────────────────────────────────────────────────────────────
--   124 joins the pending cloud set, applied to cloud in order at the next operator-gated
--   production push. It seeds NO reference data — but note that Phase 204 DOES introduce a new
--   env var (`SCHEDULER_PROCESS_ENABLED`) and a new bundled background loop, so the D-16
--   deploy-artifact parity obligation is discharged by the SAME COMMIT'S changes to
--   `backend/.env.example`, `deploy/onebox.env.example`, `docs/OPERATOR.md` and
--   `docker-compose.prod.yml` — not by this file.

BEGIN;

-- ================================================================================================
-- §1 — the table
-- ================================================================================================
CREATE TABLE IF NOT EXISTS public.workflow_schedules (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    workflow_id uuid NOT NULL REFERENCES public.workflow_definitions(id) ON DELETE CASCADE,
    -- Matches the GROUP 2 sibling tables verbatim (workflow_definitions_created_by_fkey):
    -- REFERENCES auth.users(id) ON DELETE CASCADE. This is the run OWNER — the identity every
    -- unattended run this schedule launches is stamped with, and the identity whose budget it
    -- spends. It is NOT "whoever last edited the row".
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name text NOT NULL,

    -- ── the cadence: exactly one of these two, enforced below ──
    cron_expression text,
    interval_seconds integer,
    timezone text NOT NULL DEFAULT 'UTC',

    is_active boolean NOT NULL DEFAULT true,

    -- ── SCHED-02's per-run ceilings, carried on the SCHEDULE rather than on the run ──
    max_tokens_per_run integer NOT NULL DEFAULT 50000,
    max_duration_seconds integer NOT NULL DEFAULT 600,

    inputs jsonb NOT NULL DEFAULT '{}'::jsonb,

    last_run_at timestamptz,
    next_run_at timestamptz,
    last_status text,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    -- EXACTLY ONE cadence. See the header note: a both-or-neither row is not a preference, it is
    -- a row with no defined behaviour.
    CONSTRAINT schedule_cadence_exactly_one CHECK (
        (cron_expression IS NOT NULL AND interval_seconds IS NULL)
        OR (cron_expression IS NULL AND interval_seconds IS NOT NULL)
    ),
    -- A sub-minute interval is a busy-loop against the provider and the DB, not a schedule.
    CONSTRAINT schedule_interval_floor CHECK (
        interval_seconds IS NULL OR interval_seconds >= 60
    ),
    CONSTRAINT schedule_token_cap_positive CHECK (max_tokens_per_run > 0),
    CONSTRAINT schedule_duration_cap_positive CHECK (max_duration_seconds > 0)
);

COMMENT ON COLUMN public.workflow_schedules.inputs IS
  'The kickoff inputs each unattended run is launched with (the same shape workflow_runs.inputs carries, e.g. a kickoff_prompt key). Written as a jsonb OBJECT, never a JSON string scalar: the asyncpg pool registers a jsonb codec (dependencies.py _init_pg_connection), so a call site that pre-encodes with json.dumps stores a STRING and every arrow read then returns NULL. That defect shipped on 484 of 484 workflow_phases.output rows and was repaired by migration 123 — do not reintroduce it here.';

COMMENT ON COLUMN public.workflow_schedules.timezone IS
  'The IANA zone the cron expression is READ IN (D-204-10). Interval schedules ignore it entirely — an interval is a duration, and a duration has no timezone. Defaults to UTC; an unrecognised zone is rejected at the API boundary, because the run must fire where the author expects rather than where the server happens to sit.';

COMMENT ON COLUMN public.workflow_schedules.next_run_at IS
  'The claim key. The poller reads WHERE is_active AND next_run_at <= now() FOR UPDATE SKIP LOCKED and ADVANCES this column inside the SAME transaction that claims the row — which is what makes a duplicate firing impossible across uvicorn workers (D-204-09). NULL means never computed: such a row is invisible to the poller and will never fire, so every writer must set it.';

COMMENT ON COLUMN public.workflow_schedules.last_status IS
  'A HINT for the schedule list, never an authorization or control input: the terminal status of the most recent run this schedule launched, or launch_failed when the launch itself raised. NULL = has never run.';

-- ================================================================================================
-- §2 — indexes
-- ================================================================================================
-- THE poller read. Partial on is_active so retired schedules cost nothing.
CREATE INDEX IF NOT EXISTS idx_workflow_schedules_due
  ON public.workflow_schedules USING btree (next_run_at)
  WHERE is_active;
-- The per-workflow list (GET /workflows/{id}/schedules).
CREATE INDEX IF NOT EXISTS idx_workflow_schedules_workflow_id
  ON public.workflow_schedules USING btree (workflow_id);
-- The org/owner list (GET /schedules) + the ON DELETE CASCADE from auth.users.
CREATE INDEX IF NOT EXISTS idx_workflow_schedules_org_user
  ON public.workflow_schedules USING btree (org_id, user_id);

-- ================================================================================================
-- §3 — RLS: four policies, 108 Shape A (membership AND owner) on every one of them
-- ================================================================================================
ALTER TABLE public.workflow_schedules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS workflow_schedules_select ON public.workflow_schedules;
CREATE POLICY workflow_schedules_select ON public.workflow_schedules
  FOR SELECT TO authenticated
  USING (org_id IN (SELECT public.current_user_org_ids()) AND (auth.uid() = user_id));

DROP POLICY IF EXISTS workflow_schedules_insert ON public.workflow_schedules;
CREATE POLICY workflow_schedules_insert ON public.workflow_schedules
  FOR INSERT TO authenticated
  WITH CHECK (org_id IN (SELECT public.current_user_org_ids()) AND (auth.uid() = user_id));

DROP POLICY IF EXISTS workflow_schedules_update ON public.workflow_schedules;
CREATE POLICY workflow_schedules_update ON public.workflow_schedules
  FOR UPDATE TO authenticated
  USING (org_id IN (SELECT public.current_user_org_ids()) AND (auth.uid() = user_id))
  WITH CHECK (org_id IN (SELECT public.current_user_org_ids()) AND (auth.uid() = user_id));

DROP POLICY IF EXISTS workflow_schedules_delete ON public.workflow_schedules;
CREATE POLICY workflow_schedules_delete ON public.workflow_schedules
  FOR DELETE TO authenticated
  USING (org_id IN (SELECT public.current_user_org_ids()) AND (auth.uid() = user_id));

-- ================================================================================================
-- §4 — triggers
-- ================================================================================================
-- org_id auto-fill (106:74-107). GROUP 1 — this table owns by `user_id`, so TG_ARGV[0] is
-- 'user_id'. SECURITY DEFINER with a pinned empty search_path, a forward-compat NO-OP when
-- org_id is supplied explicitly, and FAIL-SAFE to NULL — which the NOT NULL column above then
-- rejects, so no silent bad-org row is ever written.
DROP TRIGGER IF EXISTS workflow_schedules_autofill_org_id ON public.workflow_schedules;
CREATE TRIGGER workflow_schedules_autofill_org_id BEFORE INSERT ON public.workflow_schedules
  FOR EACH ROW EXECUTE FUNCTION public.autofill_org_id_by_owner('user_id');

-- updated_at touch — REUSES the shipped public.set_updated_at(). No second touch function.
DROP TRIGGER IF EXISTS workflow_schedules_set_updated_at ON public.workflow_schedules;
CREATE TRIGGER workflow_schedules_set_updated_at BEFORE UPDATE ON public.workflow_schedules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMIT;
