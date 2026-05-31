-- 062_workflow_run_claim_lease.sql
-- Phase 091 (gap closure 091-08 / CR-01): real resume CAS via a claimed_at lease.
--
-- PROBLEM (091-REVIEW CR-01): claim_run did
--   UPDATE workflow_runs SET status='active' WHERE status IN ('active','paused')
-- but find_resumable_runs already returns 'active' rows, so the status never left
-- the claimable set — under WORKER_COUNT=2 BOTH workers matched the WHERE and BOTH
-- got a RETURNING row → the stranded run was re-driven twice (Pitfall 7 double-exec).
--
-- FIX: add a nullable claimed_at lease column. The claim becomes a CAS that stamps
-- claimed_at and only matches when the lease is unset OR expired:
--   UPDATE workflow_runs
--   SET claimed_at = now()
--   WHERE id=$1 AND status IN ('active','paused')
--     AND (claimed_at IS NULL OR claimed_at < now() - $2::interval)
--   RETURNING id
-- The winner stamps a fresh claimed_at; a racing loser sees that fresh value → 0
-- rows → returns False. A crash-mid-resume run becomes re-claimable once the lease
-- (an engine/config constant, default 5 min) expires. status is UNCHANGED by the
-- claim (the lease is orthogonal to status); find_resumable_runs continues to
-- anchor on status IN ('active','paused'). No CHECK / status-value change.
--
-- Idempotent (ADD COLUMN IF NOT EXISTS) — safe to paste-replay in the SQL editor.
-- Apply via the Supabase SQL editor (per CLAUDE.md — never `supabase db push`/`db reset`).

ALTER TABLE public.workflow_runs
  ADD COLUMN IF NOT EXISTS claimed_at timestamptz;  -- nullable, default NULL

COMMENT ON COLUMN public.workflow_runs.claimed_at IS
  'Resume CAS lease (Phase 091 CR-01): the startup sweep stamps now() when it wins '
  'the claim_run CAS so a racing WORKER_COUNT=2 sibling matches 0 rows and skips. '
  'Re-claimable once the lease (engine constant, default 5 min) expires. Orthogonal '
  'to status; NULL = never claimed.';
