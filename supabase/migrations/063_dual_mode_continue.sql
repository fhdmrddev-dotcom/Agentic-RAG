-- 063_dual_mode_continue.sql
-- Phase 092 (dual-mode wiring + Continue) — SEED-047 + D-06 schema foundation.
--
-- PROBLEM (092 RESEARCH gaps 1/4 + SEED-047 + D-06):
--   * There is NO live-app path that creates a workflow run yet (092 owns the
--     INSERT INTO workflow_runs / workflow_phases). When 092 creates a run it
--     must persist the kickoff `inputs` and the resolved `model` so the resume
--     sweep can rehydrate them (SEED-047: today the resume ctx loses top-level
--     `programmatic` inputs → empty splits, and resumed llm_* phases run with
--     model=""). `workflow_runs` has NO inputs and NO model column today.
--   * D-06 caps Continue at 3 per run, for BOTH a Deep run and a Harness phase.
--     The count MUST be durable (WORKER_COUNT=2 — the Continue-handling worker
--     may differ from the one that hit the cap; in-memory is wrong). Neither
--     `runs` nor `workflow_runs` has a `continues_used` column today.
--   * A cap-paused run is NON-TERMINAL (Continue must resume it) and must NOT
--     clear `threads.active_workflow_run_id` (the lock holds during the pause).
--     The existing status sets have no value outside the terminal sets for this,
--     and `workflow_runs.paused` is overloaded by find_resumable_runs (the sweep
--     would wrongly auto-resume a cap-pause that waits on a USER Continue click).
--     So a DISTINCT non-terminal `cap_paused` value is required on BOTH status
--     CHECKs.
--
-- FIX:
--   1. workflow_runs gains `inputs jsonb` (SEED-047 kickoff inputs), `model text`
--      (SEED-047 resolved model — nullable, older rows have none), and
--      `continues_used integer` (D-06 cap counter).
--   2. runs gains `continues_used integer` (D-06 Deep-run cap counter).
--   3. `cap_paused` added to runs.status CHECK (preserving the existing 5 values).
--   4. `cap_paused` added to workflow_runs.status CHECK (preserving the existing
--      5 values — `paused` stays DISTINCT; it is the sweep's auto-resume state).
--
-- The two CHECK recreations DROP-then-ADD with the FULL value set (never drop an
-- existing valid status — a missing value would silently break terminal-status
-- writes on existing rows; T-092-01). The NOT NULL columns get DEFAULTs so the
-- ALTER cannot fail on existing rows (T-092-02). `model` is nullable.
--
-- Idempotent (ADD COLUMN IF NOT EXISTS + DROP CONSTRAINT IF EXISTS) — safe to
-- paste-replay in the SQL editor.
-- Apply via the Supabase SQL editor (per CLAUDE.md — never `supabase db push`/`db reset`).

-- ── 1. workflow_runs columns (SEED-047 + D-06) ──────────────────────────────
ALTER TABLE public.workflow_runs ADD COLUMN IF NOT EXISTS inputs jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.workflow_runs ADD COLUMN IF NOT EXISTS model text;
ALTER TABLE public.workflow_runs ADD COLUMN IF NOT EXISTS continues_used integer NOT NULL DEFAULT 0;

-- ── 2. runs column (D-06 — Deep-run cap) ────────────────────────────────────
ALTER TABLE public.runs ADD COLUMN IF NOT EXISTS continues_used integer NOT NULL DEFAULT 0;

-- ── 3. runs.status CHECK: add cap_paused (preserve the existing 5 values) ────
ALTER TABLE public.runs DROP CONSTRAINT IF EXISTS runs_status_check;
ALTER TABLE public.runs ADD CONSTRAINT runs_status_check
  CHECK (status IN ('streaming','cap_paused','completed','failed','cancelled','timed_out'));

-- ── 4. workflow_runs.status CHECK: add cap_paused (keep `paused` distinct) ───
ALTER TABLE public.workflow_runs DROP CONSTRAINT IF EXISTS workflow_runs_status_check;
ALTER TABLE public.workflow_runs ADD CONSTRAINT workflow_runs_status_check
  CHECK (status IN ('active','paused','cap_paused','completed','failed','cancelled'));

-- ── Column comments (per 062 convention) ─────────────────────────────────────
COMMENT ON COLUMN public.workflow_runs.inputs IS
  'SEED-047: kickoff inputs persisted at creation for resume rehydration '
  '(top-level programmatic inputs + kickoff_prompt). Defaults to {} for legacy rows.';
COMMENT ON COLUMN public.workflow_runs.model IS
  'SEED-047: resolved model at run creation, rehydrated into the resume ctx so '
  'resumed llm_* phases do not run with an empty model. Nullable — older rows have none.';
COMMENT ON COLUMN public.workflow_runs.continues_used IS
  'D-06: Continue cap counter, max 3/run. Durable (WORKER_COUNT=2) — the '
  'Continue-handling worker may differ from the one that hit the cap.';
COMMENT ON COLUMN public.runs.continues_used IS
  'D-06: Continue cap counter, max 3/run (Deep-run cap). Durable (WORKER_COUNT=2).';
