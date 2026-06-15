-- 060_harness_update_with_check.sql
-- Phase 090 (code-review WR-01 hardening): add WITH CHECK to the harness UPDATE policies.
--
-- The UPDATE policies in 056/057/058 had only a USING clause (which gates WHICH rows
-- a user may target) but no WITH CHECK (which gates the NEW row values). Without WITH CHECK:
--   - workflow_definitions: a user could INSERT a private draft (is_global=false, allowed by
--     the 056 INSERT guard) then UPDATE it to is_global=true — escalating a private draft into
--     a GLOBAL definition everyone sees, bypassing the T-090-06 control entirely (the
--     block-published trigger only fires once status='published', so drafts promote freely).
--   - workflow_runs / workflow_phases: a user could UPDATE thread_id / run linkage to move a
--     row into another user's ownership scope.
--
-- Fix: re-create each UPDATE policy with a WITH CHECK that mirrors its USING predicate
-- (and, for definitions, re-asserts is_global = false — same guard as the INSERT policy).
-- Forward migration (056-059 are already applied); apply via the Supabase SQL editor.

-- ============================================================
-- workflow_definitions — block is_global self-promotion + created_by transfer
-- ============================================================
DROP POLICY IF EXISTS "Users can update own workflow definitions" ON public.workflow_definitions;
CREATE POLICY "Users can update own workflow definitions"
  ON public.workflow_definitions FOR UPDATE
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by AND is_global = false);

-- ============================================================
-- workflow_runs — mirror the 1-hop FK-chain predicate on the new row too
-- ============================================================
DROP POLICY IF EXISTS "workflow_runs_update_own" ON public.workflow_runs;
CREATE POLICY "workflow_runs_update_own" ON public.workflow_runs
    FOR UPDATE TO authenticated
    USING (auth.uid() = (SELECT user_id FROM threads WHERE id = thread_id))
    WITH CHECK (auth.uid() = (SELECT user_id FROM threads WHERE id = thread_id));

-- ============================================================
-- workflow_phases — mirror the 2-hop JOIN predicate on the new row too
-- ============================================================
DROP POLICY IF EXISTS "workflow_phases_update_own" ON public.workflow_phases;
CREATE POLICY "workflow_phases_update_own" ON public.workflow_phases
    FOR UPDATE TO authenticated
    USING (
        auth.uid() = (
            SELECT t.user_id FROM threads t
            JOIN workflow_runs wr ON wr.thread_id = t.id
            WHERE wr.id = workflow_run_id
        )
    )
    WITH CHECK (
        auth.uid() = (
            SELECT t.user_id FROM threads t
            JOIN workflow_runs wr ON wr.thread_id = t.id
            WHERE wr.id = workflow_run_id
        )
    );
