-- 085_eval_matrix_duration_case_feedback.sql
-- Phase 137.1 Plan 01 (EVAL-05) — matrix grouping + gate-feeder + per-arm duration +
-- advisory case_feedback + skill-less smoke-sweep relaxation. The data + interface
-- foundation the whole 137.1 phase builds on.
--
-- Additive-and-relaxing ONLY — no data migration, no DROP TABLE/COLUMN, no UPDATE.
-- Every pre-085 eval_runs / eval_results row stays valid unchanged (new columns
-- backfill NULL / DEFAULT false, which is the correct value for a pre-matrix run):
--   * public.eval_runs   — matrix_group_id (D-06: the shared group identity so the N
--                          provider arms of one matrix run share one id; NULL for a
--                          single run — pre-085 rows backfill NULL, which is accurate
--                          because they were never matrix runs) + feeds_gate (D-05: the
--                          exactly-one-TRUE-per-group gate-feeder flag; NOT NULL DEFAULT
--                          false so single runs and every pre-085 row read false and
--                          their publish-gate behavior is unchanged — the "▣ feeds gate"
--                          chip is a LABEL on this flag, never a second gate computation).
--   * public.eval_results — duration_ms (EVAL-05e: per-arm wall-clock, NULL on pre-085
--                          rows; sits alongside the existing input_tokens/output_tokens)
--                          + case_feedback (EVAL-05d: advisory judge critique of the TEST
--                          CASE — is it weak / non-discriminating? — NULL on old rows,
--                          NEVER in rollup math, NEVER a verdict; the schema-bound
--                          JudgeVerdict.case_feedback field lands here).
--   * idx_eval_runs_matrix_group_id — supports the group readout (all arms of a matrix run).
--
-- SKILL-LESS SMOKE-SWEEP RELAXATION (D-02, checker Blocker 1 option b):
--   DROP NOT NULL on eval_runs.skill_id / eval_runs.skill_version_id / eval_results.test_case_id
--   so the built-in in-memory engine smoke fixture persists honestly with NO seeded
--   skills / skill_versions / skill_test_cases rows. The FKs are UNCHANGED — still enforced
--   when the column is non-NULL; only NULL becomes allowed. Rationale: a seeded smoke skill
--   would NOT survive a greenfield deploy — full-schema.sql is SCHEMA-ONLY, data seeds are not
--   in it (the mig-018 / SEED-101 trap), so the sweep is skill-less BY DESIGN. Skill-scoped
--   Studio queries (`.eq("skill_id", …)`) naturally exclude NULL-skill sweep rows, so the sweep
--   never pollutes a user's skill run history.
--
-- OWNERSHIP / SERVICE-ROLE / RLS SEMANTICS (080/081 precedent — UNCHANGED, T-137.1-01):
--   The backend writes these columns via the SERVICE-ROLE eval task (the same append-only
--   insert as the result / run row; no client write path). RLS stays owner-only SELECT
--   defense-in-depth; the app-code `.eq("user_id", …)` filter is the real runtime gate. This
--   migration adds NO new RLS policy and NO new write path — the owner-scoping gate is
--   identical to 080/081.
--
-- Apply via the Supabase SQL editor OR psycopg2 against the local DB at 127.0.0.1:54322, then
--   rebuild supabase/full-schema.sql with `bash scripts/regenerate-full-schema.sh` (NO --reset —
--   the default live-DB dump preserves dev data) and commit the migration + regenerated
--   full-schema.sql together. Do NOT use the destructive Supabase-CLI path that wipes and
--   replays the whole local database (`supabase db push` / `db reset`) — it destroys local dev
--   data (CLAUDE.md migration discipline). This file is AUTHORED in Plan 01 Task 1; the
--   blocking-human Task 3 applies it live + commits the regenerated full-schema.sql.

-- ============================================================
-- (1) eval_runs — matrix grouping (D-06) + gate-feeder flag (D-05). Additive; service-role-written.
-- ============================================================
ALTER TABLE public.eval_runs
  ADD COLUMN matrix_group_id uuid,                            -- D-06: shared group id; NULL for single runs (pre-085 backfill NULL — safe)
  ADD COLUMN feeds_gate      boolean NOT NULL DEFAULT false;  -- D-05: exactly one TRUE per group; single/old runs = false (gate read unchanged)

COMMENT ON COLUMN public.eval_runs.matrix_group_id IS
  'D-06 matrix grouping. The shared uuid identity for the N single-provider arms of one '
  'matrix run; NULL for a single run (pre-085 rows backfill NULL — accurate, they were never '
  'matrix runs). Indexed (idx_eval_runs_matrix_group_id) for the group readout.';

COMMENT ON COLUMN public.eval_runs.feeds_gate IS
  'D-05 gate-feeder flag. Exactly ONE arm per matrix_group_id is TRUE (default = the user''s '
  'active provider); single runs and every pre-085 row are false and their publish-gate read is '
  'UNCHANGED. The "feeds gate" chip is a LABEL on this flag — NEVER a second gate computation.';

-- ============================================================
-- (2) eval_results — per-arm wall-clock (EVAL-05e) + advisory case_feedback (EVAL-05d). Additive.
-- ============================================================
ALTER TABLE public.eval_results
  ADD COLUMN duration_ms   integer,   -- EVAL-05e: per-arm wall-clock (ms); NULL on pre-085 rows; sits beside input_tokens/output_tokens
  ADD COLUMN case_feedback text;      -- EVAL-05d: advisory judge critique of the CASE; NULL on old rows; NEVER a verdict, NEVER in rollup math

COMMENT ON COLUMN public.eval_results.duration_ms IS
  'EVAL-05e per-arm wall-clock in milliseconds (time.monotonic around the agent loop). NULL on '
  'pre-085 rows and on arms that never timed. Persisted in the SAME insert as the result row '
  '(never a follow-up UPDATE), alongside input_tokens / output_tokens.';

COMMENT ON COLUMN public.eval_results.case_feedback IS
  'EVAL-05d advisory judge critique of the TEST CASE itself (is the case weak / '
  'non-discriminating / ambiguous?). Written from the schema-bound JudgeVerdict.case_feedback '
  'field. NEVER a verdict, NEVER a gate input, NEVER counted in rollup math — it renders '
  'visually distinct from PASS/FAIL. NULL on pre-085 rows and un-graded arms.';

-- ============================================================
-- (3) index — group readout (all arms of a matrix run).
-- ============================================================
CREATE INDEX idx_eval_runs_matrix_group_id ON public.eval_runs (matrix_group_id);

-- ============================================================
-- (4) skill-less smoke-sweep relaxation (D-02). DROP NOT NULL only — FKs stay enforced when
-- non-NULL; a smoke-sweep arm persists with NULL skill_id / skill_version_id / test_case_id
-- (built-in in-memory fixture, no user data, no seeded rows — the mig-018/SEED-101 deploy-parity
-- trap avoided: data seeds are not in schema-only full-schema.sql, so the sweep is skill-less).
-- ============================================================
ALTER TABLE public.eval_runs
  ALTER COLUMN skill_id         DROP NOT NULL,
  ALTER COLUMN skill_version_id DROP NOT NULL;

ALTER TABLE public.eval_results
  ALTER COLUMN test_case_id DROP NOT NULL;
