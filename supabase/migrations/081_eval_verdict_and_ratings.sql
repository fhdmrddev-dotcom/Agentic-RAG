-- 081_eval_verdict_and_ratings.sql
-- Phase 134 Plan 01 (EVAL-03 / EVAL-04) — Honest verdict + ratings schema foundation.
--
-- Additive-only migration that extends the Phase 133 eval tables and lands the first
-- user-initiated write surface in the eval domain. Three additive blocks + RLS:
--   * public.eval_results  — per-arm verdict columns (D-06). Written by the SAME service-role eval
--                            task that inserts the result row (no client write path). verdict_state
--                            is an OQ1 3-value discriminator so a provider-errored arm and an
--                            un-gradeable completed arm read DIFFERENTLY:
--                              'graded'       = the judge ran and returned a verdict.
--                              'not_measured' = the arm errored/was empty; the judge was NEVER
--                                               called (D-04) — the honest "we couldn't grade" state.
--                              'judge_error'  = the arm completed but the judge shot itself failed.
--                            NOT NULL DEFAULT 'not_measured' backfills the old Phase 133 rows to
--                            'not_measured' — accurate, since they were never graded.
--   * public.eval_runs     — the run rollup (D-07): passed_count / measured_count (with-skill-only
--                            denominator, D-02/D-07) + verdict_summary, a NON-AUTHORITATIVE default
--                            (OQ2) Phase 136 (GATE-01) can override WITHOUT a new migration.
--   * public.eval_ratings  — NEW owner-scoped thumbs table (EVAL-04, D-08/D-09). One thumbs up/down
--                            per (user, individual answer = an eval_results row), re-ratable
--                            (clear = DELETE the row). FK eval_result_id -> eval_results.id (the
--                            stable PK mig 080:74/99-100 reserved for exactly this). Minimal row
--                            (id, eval_result_id, user_id, rating, created_at, updated_at) so Phase
--                            135 can join verdict <-> rating for human-judge disagreement (D-09).
--
-- OWNERSHIP / SERVICE-ROLE / RLS SEMANTICS (035/079/080 precedent, D-06/D-08):
--   The backend writes verdict columns via the SERVICE-ROLE eval task (same append-only insert as
--   the result row, D-06) and eval_ratings via the SERVICE-ROLE ratings endpoint (Plan 03), both of
--   which BYPASS RLS. RLS here is owner-only SELECT defense-in-depth (T-134-01); the app-code
--   .eq("user_id", …) filter is the real runtime gate (the Plan 03 404-not-403 IDOR gate). There
--   are NO INSERT/UPDATE/DELETE policies on eval_ratings — only the service-role endpoint writes, so
--   a client can never forge a rating or a verdict row (T-134-04).
--
-- Apply via the Supabase SQL editor OR psycopg2 against the local DB at 127.0.0.1:54322, then
--   rebuild supabase/full-schema.sql with `bash scripts/regenerate-full-schema.sh` (NO --reset — the
--   default live-DB dump preserves dev data) and commit the migration + regenerated full-schema.sql
--   together. Do NOT use the destructive Supabase-CLI path that wipes and replays the whole local
--   database (remote push or full reset) — it destroys local dev data (CLAUDE.md migration
--   discipline, D-14). This file is AUTHORED ONLY in Plan 01 Task 1; Task 2 (autonomous:false,
--   blocking-human) applies it live + commits the regenerated full-schema.sql.

-- ============================================================
-- (1) eval_results — additive per-arm verdict columns (D-06). All service-role-written in the same
-- append-only insert as the result row; no client write path. verdict_state is OQ1 3-value.
-- ============================================================
ALTER TABLE public.eval_results
  ADD COLUMN verdict_state text NOT NULL DEFAULT 'not_measured' CHECK (verdict_state IN ('graded','not_measured','judge_error')),
  ADD COLUMN verdict_passed  boolean,   -- NULL unless verdict_state='graded'
  ADD COLUMN verdict_score   integer,   -- NULL unless verdict_state='graded'
  ADD COLUMN verdict_reason  text,      -- judge summary, or the truncated honest-failure reason
  ADD COLUMN judge_model     text;      -- which independent model judged (resolve_judge_model, Plan 02)

COMMENT ON COLUMN public.eval_results.verdict_state IS
  'OQ1 3-value verdict discriminator (D-06). graded = the judge ran and returned a verdict; '
  'not_measured = the arm errored/was empty and the judge was NEVER called (D-04); judge_error = '
  'the arm completed but the judge call itself failed. NOT NULL DEFAULT ''not_measured'' backfills '
  'the old Phase 133 rows to not_measured — accurate, they were never graded. verdict_passed/score '
  'are NULL unless graded (a not_measured/judge_error arm carrying a non-NULL verdict_passed is a bug).';

-- ============================================================
-- (2) eval_runs — additive rollup columns (D-07). Honest count over WITH-SKILL arms only (D-02/D-07);
-- the real publish threshold is deferred to Phase 136 (GATE-01).
-- ============================================================
ALTER TABLE public.eval_runs
  ADD COLUMN passed_count    integer,   -- with-skill cases graded PASS
  ADD COLUMN measured_count  integer,   -- with-skill cases graded (denominator N)
  ADD COLUMN verdict_summary text;      -- NON-AUTHORITATIVE default rollup (OQ2); Phase 136 owns the real threshold

COMMENT ON COLUMN public.eval_runs.verdict_summary IS
  'NON-AUTHORITATIVE default rollup (OQ2, D-07). Default rule: "pass" iff measured_count >= 1 AND '
  'passed_count == measured_count, else "fail". This is DERIVED TEXT, not a hard constraint — Phase '
  '136 (GATE-01) owns the real publish threshold and MUST be able to override it WITHOUT a new '
  'migration. passed_count/measured_count count WITH-SKILL arms only (D-02/D-07); the without-skill '
  'verdict is stored per-arm for the A/B story + SI-01, not as a rollup denominator.';

-- ============================================================
-- (3) eval_ratings — NEW owner-scoped thumbs table (EVAL-04, D-08/D-09). One thumbs up/down per
-- (user, answer); re-ratable (clear = DELETE the row). FK eval_result_id -> eval_results.id (the
-- stable PK reserved by 080:74/99-100). Minimal row so Phase 135 can join verdict <-> rating (D-09).
-- ============================================================
CREATE TABLE public.eval_ratings (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    eval_result_id uuid NOT NULL REFERENCES public.eval_results(id) ON DELETE CASCADE,  -- stable FK (080:74/99-100)
    user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    rating         text NOT NULL CHECK (rating IN ('up','down')),   -- clear = DELETE the row
    created_at     timestamptz NOT NULL DEFAULT now(),
    updated_at     timestamptz NOT NULL DEFAULT now(),
    -- one thumb per (user, answer); enables the Plan 03 upsert on_conflict + guards a double-rate.
    CONSTRAINT eval_ratings_result_user_unique UNIQUE (eval_result_id, user_id)
);

CREATE INDEX idx_eval_ratings_result_id ON public.eval_ratings (eval_result_id);
CREATE INDEX idx_eval_ratings_user_id   ON public.eval_ratings (user_id);

COMMENT ON TABLE public.eval_ratings IS
  'Owner-scoped human-preference thumbs (EVAL-04, D-08/D-09). One thumbs up/down per (user, answer '
  '= an eval_results row), re-ratable (clear = DELETE the row). Minimal shape (id, eval_result_id, '
  'user_id, rating, created_at, updated_at) so Phase 135 can join verdict <-> rating for human-judge '
  'disagreement (D-09). Written via the service-role ratings endpoint (Plan 03) with an '
  '.eq("user_id") IDOR gate; owner-only RLS SELECT is defense-in-depth (T-134-01). NO client write '
  'policies (T-134-04). Both FKs ON DELETE CASCADE — no orphaned rating survives its parent (T-134-05).';

-- eval_ratings.updated_at — reuse the existing set_updated_at() (014_folders.sql), exactly as 079
-- did. Do NOT redefine the function.
DROP TRIGGER IF EXISTS eval_ratings_set_updated_at ON public.eval_ratings;
CREATE TRIGGER eval_ratings_set_updated_at
  BEFORE UPDATE ON public.eval_ratings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- (4) RLS — owner-only SELECT on eval_ratings (defense-in-depth; service-role writes bypass RLS).
-- NO INSERT/UPDATE/DELETE policies — the Plan 03 ratings endpoint writes via the service-role client
-- (035/079/080 precedent); the .eq("user_id") filter is the real access control (T-134-01/T-134-04).
-- ============================================================
ALTER TABLE public.eval_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own eval ratings"
  ON public.eval_ratings FOR SELECT USING (auth.uid() = user_id);

COMMENT ON POLICY "Users can view own eval ratings" ON public.eval_ratings IS
  'Owner-only (D-08). Defense-in-depth: the service-role ratings endpoint bypasses RLS and the '
  'app-code .eq("user_id", …) filter is the real runtime gate (035/079/080 precedent, T-134-01).';
