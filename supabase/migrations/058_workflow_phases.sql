-- 058_workflow_phases.sql
-- Phase 090: Harness workflow phases — table + 2-hop JOIN FK-chain RLS + composite index.
--
-- RLS mirrors 054_workspace_files.sql:55-76 (the workspace_file_versions 2-hop JOIN) verbatim:
-- phase.workflow_run_id -> workflow_runs.thread_id -> threads.user_id.
-- NOTE: 054 ships only SELECT+INSERT on versions; we ADD UPDATE+DELETE with the same JOIN
-- predicate because the 091 engine mutates phase status.
--
-- Apply AFTER 057 (FK to workflow_runs). Authored only; Plan 03 applies it.

-- ============================================================
-- workflow_phases table
-- ============================================================
CREATE TABLE public.workflow_phases (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_run_id uuid NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE,
    phase_index     integer NOT NULL,
    slug            text NOT NULL,
    status          text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'active', 'completed', 'failed', 'skipped')),
    output          jsonb NOT NULL DEFAULT '{}',  -- resumability substrate; large outputs spill to the
                                                  -- workspace-files bucket (path-only) — do NOT force inline-only
    org_id          uuid,                         -- D-11 forward-compat, nullable, NO FK
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_workflow_phases_run ON public.workflow_phases(workflow_run_id, phase_index);

COMMENT ON COLUMN public.workflow_phases.org_id IS
  'Forward-compat (D-PRD-02/D-11): org-level multi-tenancy. NULL in v2.8; no FK until org schema exists; RLS stays user-scoped.';

-- ============================================================
-- workflow_phases RLS — 2-hop JOIN FK chain (mirrors 054_workspace_files.sql:55-76)
-- phase -> run -> thread.user_id. UPDATE/DELETE added beyond 054 (engine mutates phase status).
-- ============================================================
ALTER TABLE public.workflow_phases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workflow_phases_select_own" ON public.workflow_phases
    FOR SELECT TO authenticated
    USING (
        auth.uid() = (
            SELECT t.user_id FROM threads t
            JOIN workflow_runs wr ON wr.thread_id = t.id
            WHERE wr.id = workflow_run_id
        )
    );

CREATE POLICY "workflow_phases_insert_own" ON public.workflow_phases
    FOR INSERT TO authenticated
    WITH CHECK (
        auth.uid() = (
            SELECT t.user_id FROM threads t
            JOIN workflow_runs wr ON wr.thread_id = t.id
            WHERE wr.id = workflow_run_id
        )
    );

CREATE POLICY "workflow_phases_update_own" ON public.workflow_phases
    FOR UPDATE TO authenticated
    USING (
        auth.uid() = (
            SELECT t.user_id FROM threads t
            JOIN workflow_runs wr ON wr.thread_id = t.id
            WHERE wr.id = workflow_run_id
        )
    );

CREATE POLICY "workflow_phases_delete_own" ON public.workflow_phases
    FOR DELETE TO authenticated
    USING (
        auth.uid() = (
            SELECT t.user_id FROM threads t
            JOIN workflow_runs wr ON wr.thread_id = t.id
            WHERE wr.id = workflow_run_id
        )
    );

-- ============================================================
-- updated_at trigger (reuses public.set_updated_at from 014_folders.sql)
-- ============================================================
DROP TRIGGER IF EXISTS workflow_phases_set_updated_at ON public.workflow_phases;
CREATE TRIGGER workflow_phases_set_updated_at
  BEFORE UPDATE ON public.workflow_phases
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
