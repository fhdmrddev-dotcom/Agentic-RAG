-- 057_workflow_runs.sql
-- Phase 090: Harness workflow runs — table + 1-hop FK-chain RLS + ON DELETE RESTRICT FK.
--
-- Substrate for HARNESS-02 (a referenced published version cannot be deleted, SC#2).
-- RLS mirrors 055_todos_table.sql / 054_workspace_files.sql (1-hop via threads.user_id) verbatim.
-- The definition_id FK is ON DELETE RESTRICT — the ONE FK behavior new to the codebase
-- (all shipped FKs are CASCADE / SET NULL). thread_id keeps the standard ON DELETE CASCADE.
--
-- Apply AFTER 056 (FK to workflow_definitions). Authored only; Plan 03 applies it.

-- ============================================================
-- workflow_runs table
-- ============================================================
CREATE TABLE public.workflow_runs (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id        uuid NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
    definition_id    uuid NOT NULL REFERENCES workflow_definitions(id) ON DELETE RESTRICT,  -- D-06 / SC#2
    status           text NOT NULL DEFAULT 'active'
                     CHECK (status IN ('active', 'paused', 'completed', 'failed', 'cancelled')),
    current_phase_id uuid,                       -- nullable; advanced by the engine (091)
    org_id           uuid,                       -- D-11 forward-compat, nullable, NO FK
    created_at       timestamptz NOT NULL DEFAULT now(),
    updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_workflow_runs_thread ON public.workflow_runs(thread_id);

COMMENT ON COLUMN public.workflow_runs.org_id IS
  'Forward-compat (D-PRD-02/D-11): org-level multi-tenancy. NULL in v2.8; no FK until org schema exists; RLS stays user-scoped.';

-- ============================================================
-- workflow_runs RLS — 1-hop FK chain to threads.user_id (mirrors 055_todos_table.sql:21-37)
-- ============================================================
ALTER TABLE public.workflow_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workflow_runs_select_own" ON public.workflow_runs
    FOR SELECT TO authenticated
    USING (auth.uid() = (SELECT user_id FROM threads WHERE id = thread_id));

CREATE POLICY "workflow_runs_insert_own" ON public.workflow_runs
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = (SELECT user_id FROM threads WHERE id = thread_id));

CREATE POLICY "workflow_runs_update_own" ON public.workflow_runs
    FOR UPDATE TO authenticated
    USING (auth.uid() = (SELECT user_id FROM threads WHERE id = thread_id));

CREATE POLICY "workflow_runs_delete_own" ON public.workflow_runs
    FOR DELETE TO authenticated
    USING (auth.uid() = (SELECT user_id FROM threads WHERE id = thread_id));

-- ============================================================
-- updated_at trigger (reuses public.set_updated_at from 014_folders.sql)
-- ============================================================
DROP TRIGGER IF EXISTS workflow_runs_set_updated_at ON public.workflow_runs;
CREATE TRIGGER workflow_runs_set_updated_at
  BEFORE UPDATE ON public.workflow_runs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
