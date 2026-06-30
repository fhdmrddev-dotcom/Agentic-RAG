-- 080_eval_runs_and_results.sql
-- Phase 133 Plan 01 (EVAL-02) — Eval runner persistence (with-skill vs without-skill).
--
-- Creates the two owner-scoped tables the v3.2 Skill Eval Studio runner writes to. Phase 132
-- (mig 079) deliberately deferred these (D-09); this migration lands them:
--   * public.eval_runs    — one row per eval run (D-08). A run is single-provider/single-model
--                           (D-01): provider/model live on the run. status is a durable run-audit
--                           enum mirroring 035_runs_table.sql (running/completed/failed/cancelled/
--                           interrupted) so a backend that dies mid-run leaves a recoverable
--                           'interrupted'/'running' row, never a lost run (D-06 / SC#3). eval_runs.id
--                           doubles as the stream run_id (companion public.runs row uses the same
--                           UUID — no separate run_id column).
--   * public.eval_results — one row per (test_case × variant). variant is a CHECK-constrained
--                           with_skill/without_skill discriminator (D-04). Each row carries
--                           provider+model (D-02 — provider-keyed even though the run is
--                           single-provider, so a later multi-provider fan-out is additive). output
--                           holds the model's full_content_final; status is the per-case terminal
--                           (completed/failed/timed_out/cancelled). Survives Redis TTL + a backend
--                           restart (D-06 / SC#3).
--
-- TRACEABILITY (Phase-132 D-10): eval_runs.skill_version_id -> skill_versions.id and
--   eval_results.test_case_id -> skill_test_cases.id (the two stable UUID FK targets mig 079
--   created for exactly this). A run is traceable to the EXACT immutable instruction snapshot it
--   exercised, and each result to the exact case prompt.
--
-- OWNERSHIP / SERVICE-ROLE / RLS SEMANTICS (035/079 precedent, D-08):
--   The backend writes both tables via the SERVICE-ROLE client (the eval background task), which
--   BYPASSES RLS. RLS here is owner-only SELECT defense-in-depth (T-133-01); the app-code
--   .eq("user_id", …) filter (Plans 03/04) is the real runtime gate. There are NO INSERT/UPDATE/
--   DELETE policies — only the service-role task writes (035/079 precedent), so a client can never
--   forge an eval row (T-133-EoP).
--
-- Apply via the Supabase SQL editor OR psycopg2 :54322 (NEVER `supabase db push` / `db reset` —
--   they wipe local dev data, T-133-DATA), then regenerate `supabase/full-schema.sql` with
--   `bash scripts/regenerate-full-schema.sh` (NO --reset). Commit BOTH the migration and the
--   regenerated full-schema.sql per CLAUDE.md. This file is AUTHORED ONLY in Plan 01 Task 1;
--   Task 2 (autonomous:false, blocking-human) applies it + commits the regenerated full-schema.sql.

-- ============================================================
-- (1) eval_runs — one durable row per eval run (D-08). Single provider/model per run (D-01).
-- ============================================================
CREATE TABLE public.eval_runs (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),  -- == the stream run_id (companion runs.run_id)
    skill_id         uuid NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE,
    skill_version_id uuid NOT NULL REFERENCES public.skill_versions(id) ON DELETE CASCADE,  -- D-10 traceability
    user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    provider         text NOT NULL,                               -- D-01 single provider/run
    model            text NOT NULL,
    status           text NOT NULL DEFAULT 'running'
                       CHECK (status IN ('running','completed','failed','cancelled','interrupted')),
    case_count       integer NOT NULL DEFAULT 0,                  -- N test cases at launch
    error            text,
    created_at       timestamptz NOT NULL DEFAULT now(),
    completed_at     timestamptz
);

CREATE INDEX idx_eval_runs_skill_id         ON public.eval_runs (skill_id);
CREATE INDEX idx_eval_runs_skill_version_id ON public.eval_runs (skill_version_id);
CREATE INDEX idx_eval_runs_user_id          ON public.eval_runs (user_id);

COMMENT ON TABLE public.eval_runs IS
  'One durable row per eval run (EVAL-02, D-08). Single provider/model per run (D-01) — provider/'
  'model live here. status is a durable run-audit enum (035 precedent): a backend that dies mid-run '
  'leaves a recoverable running/interrupted row (D-06 / SC#3). id doubles as the stream run_id '
  '(companion public.runs row uses the same UUID). skill_version_id FKs skill_versions.id for exact '
  'instruction-snapshot traceability (Phase-132 D-10). Owner-only RLS SELECT is defense-in-depth; '
  'the service-role eval task writes (bypasses RLS) and the app-code .eq("user_id") filter is the '
  'real gate (T-133-01). NO write policies — only the service-role task writes (T-133-EoP).';

-- ============================================================
-- (2) eval_results — one row per (test_case × variant). Provider-keyed (D-02), variant-keyed (D-04).
-- ============================================================
CREATE TABLE public.eval_results (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    eval_run_id   uuid NOT NULL REFERENCES public.eval_runs(id) ON DELETE CASCADE,
    test_case_id  uuid NOT NULL REFERENCES public.skill_test_cases(id) ON DELETE CASCADE,  -- D-10
    user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    variant       text NOT NULL CHECK (variant IN ('with_skill','without_skill')),         -- D-04 discriminator
    provider      text NOT NULL,                                  -- D-02 provider-keyed even though run is single-provider
    model         text NOT NULL,
    output        text NOT NULL DEFAULT '',                       -- full_content_final
    status        text NOT NULL DEFAULT 'completed'
                    CHECK (status IN ('completed','failed','timed_out','cancelled')),
    error         text,
    input_tokens  integer,
    output_tokens integer,
    created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_eval_results_run_id  ON public.eval_results (eval_run_id);
CREATE INDEX idx_eval_results_case_id ON public.eval_results (test_case_id);
CREATE INDEX idx_eval_results_user_id ON public.eval_results (user_id);

COMMENT ON TABLE public.eval_results IS
  'One row per (test_case × variant) for an eval run (EVAL-02, D-08). variant is a CHECK-constrained '
  'with_skill/without_skill discriminator (D-04). Carries provider+model (D-02 — provider-keyed even '
  'though the run is single-provider, so multi-provider fan-out is additive). output holds the full '
  'final content; survives Redis TTL + a backend restart (D-06 / SC#3). test_case_id FKs '
  'skill_test_cases.id for exact case traceability (Phase-132 D-10); Phase 134 ratings FK '
  'eval_results.id (keep PK stable). Owner-only RLS SELECT defense-in-depth; service-role writes '
  '(bypasses RLS), app-code .eq("user_id") is the real gate (T-133-01). NO write policies (T-133-EoP).';

-- ============================================================
-- (3) RLS — owner-only SELECT (defense-in-depth; service-role writes bypass RLS).
-- NO INSERT/UPDATE/DELETE policies — all writes go through the service-role background task
-- (035/079 precedent); app-code .eq("user_id") is the real gate (T-133-01 / T-133-EoP).
-- ============================================================
ALTER TABLE public.eval_runs    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eval_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own eval runs"
  ON public.eval_runs FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view own eval results"
  ON public.eval_results FOR SELECT USING (auth.uid() = user_id);

COMMENT ON POLICY "Users can view own eval runs" ON public.eval_runs IS
  'Owner-only (D-08). Defense-in-depth: the service-role eval task bypasses RLS and the app-code '
  '.eq("user_id", …) filter is the real runtime gate (035/079 precedent, T-133-01).';

COMMENT ON POLICY "Users can view own eval results" ON public.eval_results IS
  'Owner-only (D-08). Defense-in-depth: the service-role eval task bypasses RLS and the app-code '
  '.eq("user_id", …) filter is the real runtime gate (035/079 precedent, T-133-01).';
