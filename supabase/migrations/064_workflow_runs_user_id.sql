-- 064_workflow_runs_user_id.sql
-- F1 (Phase 092-05): harness_audit.user_id is NOT NULL, but workflow_runs never
-- persisted the run-owner. Add it + backfill from the owning thread + mirror the
-- ON DELETE CASCADE FK that harness_audit.user_id uses. Idempotent / replayable.
--
-- ROOT CAUSE (092-04-UAT-FINDINGS F1): write_audit's INSERT omitted user_id;
-- harness_audit.user_id is NOT NULL with no default; workflow_runs had no user_id
-- column at all, so harness_engine._build_resume_context read run.get("user_id")
-- as None. The first audit write (phase_started) raised NotNullViolationError and
-- the run died before any phase executed → Harness mode end-to-end broken.
--
-- The application layer (092-05 Tasks 2/3) supplies user_id on every new
-- workflow_runs INSERT and every harness_audit INSERT. This migration provides the
-- persisted column + backfills existing rows from the owning thread.
--
-- Apply via the Supabase SQL editor (per CLAUDE.md — never `supabase db push`/`db reset`).
-- Then regenerate the bootstrap artifact: `bash scripts/regenerate-full-schema.sh`
-- (no --reset — live-DB dump only) and commit BOTH this file and full-schema.sql.

ALTER TABLE public.workflow_runs
  ADD COLUMN IF NOT EXISTS user_id uuid;

-- Backfill existing rows from the owning thread (threads.user_id is NOT NULL).
UPDATE public.workflow_runs wr
SET user_id = t.user_id
FROM public.threads t
WHERE wr.thread_id = t.id
  AND wr.user_id IS NULL;

-- FK → auth.users, mirroring harness_audit.user_id (ON DELETE CASCADE). Guarded
-- so a re-paste does not raise "constraint already exists".
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'workflow_runs_user_id_fkey'
  ) THEN
    ALTER TABLE public.workflow_runs
      ADD CONSTRAINT workflow_runs_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Owner-scoped lookups (resume sweep + RLS-mirroring reads).
CREATE INDEX IF NOT EXISTS idx_workflow_runs_user_id
  ON public.workflow_runs (user_id);

-- NOTE: user_id is intentionally LEFT NULLABLE in this migration. Existing rows
-- backfill from threads, but enforcing NOT NULL here would fail if any orphan run
-- predates a thread. New inserts always supply it (092-05 Task 2); a future
-- migration can tighten to NOT NULL once backfill is proven across environments.

COMMENT ON COLUMN public.workflow_runs.user_id IS
  '092-05 F1: run-owner (server-side current_user at creation). Sourced into '
  'harness_audit.user_id (NOT NULL) on every audit write and into the resume ctx '
  '(_build_resume_context). FK -> auth.users ON DELETE CASCADE. Nullable for legacy '
  'rows; new inserts always supply it.';
