-- 059_harness_audit_and_threads_col.sql
-- Phase 090: INSERT-only harness audit trail (HARNESS-06) + threads.active_workflow_run_id (D-12).
--
-- harness_audit mirrors the audit_log INSERT-only pattern (030_missing_tables.sql): the absence
-- of UPDATE/DELETE policies means RLS denies all mutation, making rows tamper-proof (D-10).
-- run_id is a PLAIN uuid with NO FK so the audit row survives run deletion (D-09 — NEVER CASCADE).
--
-- Apply AFTER 057 (the threads FK references workflow_runs). Authored only; Plan 03 applies it.

-- ============================================================
-- harness_audit table (INSERT-only)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.harness_audit (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    run_id     uuid,                         -- D-09: PLAIN stored uuid, NO FK — audit survives run deletion (NEVER CASCADE)
    event_type text NOT NULL,
    metadata   jsonb NOT NULL DEFAULT '{}',
    org_id     uuid,                          -- D-11 forward-compat, nullable, NO FK
    created_at timestamptz NOT NULL DEFAULT now(),
    -- text + CHECK (NOT a Postgres ENUM — cheap to ALTER when 091 adds kinds, RESEARCH anti-pattern).
    -- Covers SC#3's three named categories: phase transitions, gate results (gate_passed/gate_failed),
    -- tool refusals (tool_refused) — plus run lifecycle. Coordinate the final event_type set with Phase 091.
    CONSTRAINT harness_audit_event_type_check CHECK (
        event_type IN (
            'phase_started', 'phase_completed', 'phase_transition',
            'gate_passed', 'gate_failed', 'tool_refused',
            'run_started', 'run_completed', 'run_failed'
        )
    )
);

CREATE INDEX idx_harness_audit_user_created ON public.harness_audit(user_id, created_at DESC);
CREATE INDEX idx_harness_audit_run ON public.harness_audit(run_id) WHERE run_id IS NOT NULL;

COMMENT ON COLUMN public.harness_audit.org_id IS
  'Forward-compat (D-PRD-02/D-11): org-level multi-tenancy. NULL in v2.8; no FK until org schema exists; RLS stays user-scoped.';

-- ============================================================
-- harness_audit RLS — INSERT-only (D-10): EXACTLY a SELECT(owner) + INSERT(owner) policy.
-- NO UPDATE policy, NO DELETE policy -> RLS denies all mutation (INSERT-only, mirrors audit_log in 030).
-- ============================================================
ALTER TABLE public.harness_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own harness audit"
  ON public.harness_audit FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own harness audit"
  ON public.harness_audit FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- NO UPDATE policy, NO DELETE policy -> RLS denies all mutation (INSERT-only, D-10).

-- ============================================================
-- threads.active_workflow_run_id (D-12) — ONLY this column; deep_mode_metadata is NOT created.
-- NULL = Deep Mode; non-null = Harness Mode (Phase 092 reads this).
-- Apply-ordering: this FK to workflow_runs requires 057 applied first (sequential SQL-editor apply guarantees it).
-- ============================================================
ALTER TABLE public.threads
  ADD COLUMN active_workflow_run_id uuid REFERENCES public.workflow_runs(id) ON DELETE SET NULL;

CREATE INDEX idx_threads_active_workflow_run
  ON public.threads(active_workflow_run_id) WHERE active_workflow_run_id IS NOT NULL;
