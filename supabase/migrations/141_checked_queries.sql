-- 141_checked_queries.sql
-- Phase 217.1 (BE-6 / D-217.1 / T-217.1-05) — the CHECKED QUERIES table.
--
-- WHY: a single number per query ("was rank 2, now rank 6") that a person can watch and
-- decide "this search has degraded" or "the fix worked." The tile placeholder in Plan 12's
-- Health tab renders "Not known yet"; this migration makes it real.
--
-- ── RLS: 108 Shape A (membership + owner), exactly like 124_workflow_schedules.sql ────────
--   A checked query is a PRIVATE assertion about one person's corpus. A colleague reading it
--   would learn which documents you consider sensitive enough to test. There is NO org-wide
--   read branch and NO global escape branch, and — as 124's header establishes for its own
--   table — THE ABSENCE IS THE DECISION. A sibling table carrying such a branch would
--   otherwise make the omission read as an oversight.
--
-- ── Apply discipline (CLAUDE.md) ─────────────────────────────────────────────────────────
--   Paste this WHOLE file into the LOCAL Supabase SQL editor and run it. NEVER `supabase db push`
--   / `supabase db reset` (both destroy dev data). Then run `bash scripts/regenerate-full-schema.sh`
--   with NO `--reset`, and commit this migration together with the regenerated
--   `supabase/full-schema.sql`. Never hand-edit that file.

BEGIN;

-- ================================================================================================
-- §1 — the table
-- ================================================================================================
CREATE TABLE IF NOT EXISTS public.checked_queries (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    question text NOT NULL,
    expected_document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
    last_rank integer,
    previous_rank integer,
    checked_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON COLUMN public.checked_queries.question IS 'The question to evaluate against the user''s corpus.';
COMMENT ON COLUMN public.checked_queries.expected_document_id IS 'The document that SHOULD be among the top hits for this question. Validated for ownership on write.';
COMMENT ON COLUMN public.checked_queries.last_rank IS 'The 1-indexed rank of expected_document_id at the most recent check. NULL = checked but the document was not found in the top N results (never 0).';
COMMENT ON COLUMN public.checked_queries.previous_rank IS 'The last_rank from the check BEFORE the most recent one, so Holding/Slipped can be derived.';
COMMENT ON COLUMN public.checked_queries.checked_at IS 'When the most recent evaluation finished. NULL = not yet checked (a fresh create that awaits triggerCheck).';

-- ================================================================================================
-- §2 — indexes
-- ================================================================================================
CREATE INDEX IF NOT EXISTS idx_checked_queries_user
  ON public.checked_queries USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_checked_queries_org_user
  ON public.checked_queries USING btree (org_id, user_id);

-- ================================================================================================
-- §3 — RLS: four policies, 108 Shape A (membership AND owner) on every one of them
-- ================================================================================================
ALTER TABLE public.checked_queries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS checked_queries_select ON public.checked_queries;
CREATE POLICY checked_queries_select ON public.checked_queries
  FOR SELECT TO authenticated
  USING (org_id IN (SELECT public.current_user_org_ids()) AND (auth.uid() = user_id));

DROP POLICY IF EXISTS checked_queries_insert ON public.checked_queries;
CREATE POLICY checked_queries_insert ON public.checked_queries
  FOR INSERT TO authenticated
  WITH CHECK (org_id IN (SELECT public.current_user_org_ids()) AND (auth.uid() = user_id));

DROP POLICY IF EXISTS checked_queries_update ON public.checked_queries;
CREATE POLICY checked_queries_update ON public.checked_queries
  FOR UPDATE TO authenticated
  USING (org_id IN (SELECT public.current_user_org_ids()) AND (auth.uid() = user_id))
  WITH CHECK (org_id IN (SELECT public.current_user_org_ids()) AND (auth.uid() = user_id));

DROP POLICY IF EXISTS checked_queries_delete ON public.checked_queries;
CREATE POLICY checked_queries_delete ON public.checked_queries
  FOR DELETE TO authenticated
  USING (org_id IN (SELECT public.current_user_org_ids()) AND (auth.uid() = user_id));

-- ================================================================================================
-- §4 — triggers
-- ================================================================================================
DROP TRIGGER IF EXISTS checked_queries_autofill_org_id ON public.checked_queries;
CREATE TRIGGER checked_queries_autofill_org_id BEFORE INSERT ON public.checked_queries
  FOR EACH ROW EXECUTE FUNCTION public.autofill_org_id_by_owner('user_id');

DROP TRIGGER IF EXISTS checked_queries_set_updated_at ON public.checked_queries;
CREATE TRIGGER checked_queries_set_updated_at BEFORE UPDATE ON public.checked_queries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMIT;