-- 213 — Phase 292 (VIS-02, D-12 / D-13)
-- Table: public.message_artifacts — widen the closed component set from three to six
--
-- WHAT. `show_artifact` gains three components chosen at the 292 sketch: `diagram`, `comparison` and
-- `timeline` (202 created the table for `chart | table | metric`). This migration widens exactly two
-- CHECKs and refreshes the COMMENTs that name the set:
--   * message_artifacts_component_check — component IN the six names;
--   * message_artifacts_label_check     — label ~ '^(<the six>) [1-9][0-9]*$', so the server's
--                                          per-component labels read `diagram N` / `comparison N` /
--                                          `timeline N` (D-13).
-- NOTHING ELSE: no table, column, function, trigger, grant, policy or seed. RLS is unchanged.
-- `row_count` keeps BETWEEN 1 AND 500 and counts nodes / terms / events for the new types (their
-- caps are 25 / 20 / 40, far inside it). `octet_length(spec) <= 262144` is unchanged.
--
-- WHY. The six names must equal backend/app/models/artifact.py's ARTIFACT_COMPONENTS (I-1;
-- test_292_migration_213_shape asserts literal-set equality). Without 213 every new-type insert fails
-- the 202 CHECK and the model is told "couldn't save the artifact; try again" — a retry that fails
-- identically.
--
-- The constraint names are the ones 202's inline CHECKs were auto-named (full-schema.sql:
-- message_artifacts_component_check, message_artifacts_label_check). ⚠ If a database carries a
-- differently named copy, DROP ... IF EXISTS no-ops and the old three-name CHECK keeps refusing every
-- new row — the VERIFY block below counts ONE CHECK per column for exactly that reason (RESEARCH
-- Pitfall 8).
--
-- ADD CONSTRAINT ... CHECK validates the existing rows (every one is chart / table / metric, so all
-- pass) and is an ALTER, so the BEFORE UPDATE immutability trigger does not fire.
--
-- Apply discipline (CLAUDE.md): paste into the Supabase SQL editor, or locally run
--   backend/venv/Scripts/python scripts/apply_migration_213.py --apply
-- NEVER `supabase db push` / `db reset`. Idempotent: safe to paste twice.
-- Then: bash scripts/regenerate-full-schema.sh (no --reset).
-- ⚠ PRODUCTION ORDERING: cloud must receive 213 BEFORE the backend that emits a diagram, comparison or
--   timeline deploys. Then run VERIFY there and get_advisors(security) (213 adds no table, function,
--   grant or policy, so the advisor delta is nil by construction) — a deploy-parity item.
-- ============================================================================

BEGIN;

ALTER TABLE public.message_artifacts DROP CONSTRAINT IF EXISTS message_artifacts_component_check;
ALTER TABLE public.message_artifacts ADD CONSTRAINT message_artifacts_component_check
    CHECK (component IN ('chart', 'table', 'metric', 'diagram', 'comparison', 'timeline'));

ALTER TABLE public.message_artifacts DROP CONSTRAINT IF EXISTS message_artifacts_label_check;
ALTER TABLE public.message_artifacts ADD CONSTRAINT message_artifacts_label_check
    CHECK (label ~ '^(chart|table|metric|diagram|comparison|timeline) [1-9][0-9]*$');

COMMENT ON TABLE public.message_artifacts IS
    'Agent-authored artifacts (chart | table | metric | diagram | comparison | timeline) shown under an assistant answer (Phase 273, ART-01..05; Phase 292, VIS-02). One immutable row per show_artifact emission. Visibility mirrors public.messages; written only by the backend pool.';
COMMENT ON COLUMN public.message_artifacts.label IS
    'chart N / table N / metric N / diagram N / comparison N / timeline N — assigned at INSERT per component per thread under an advisory lock, never recomputed (UI-D-03, 292 D-13). A from_artifact alias.';
COMMENT ON COLUMN public.message_artifacts.component IS
    'The closed component set (I-1), six names since Phase 292. Must equal ARTIFACT_COMPONENTS in backend/app/models/artifact.py.';
COMMENT ON COLUMN public.message_artifacts.spec IS
    'The validated spec (spec_version 1). chart | table | metric: title, columns, rows, chart | metric encoding. diagram | comparison | timeline: title plus that type''s own encoding (nodes and edges / options and terms / sorted events) with server-resolved sources. Never a free props bag (D-02).';
COMMENT ON COLUMN public.message_artifacts.row_count IS
    'Rows in spec.rows for chart | table | metric; nodes / terms / events for diagram | comparison | timeline. 1..500; above a cap the call is refused, never truncated (D-09).';

COMMIT;

-- ============================================================================================
-- VERIFY — run after applying. Every row must read PASS.
--
--   with c as (
--     select pg_get_constraintdef(oid) as def from pg_constraint
--     where conrelid = 'public.message_artifacts'::regclass and contype = 'c'
--   ), checks(what, ok) as (values
--     ('exactly one CHECK mentions component',
--      (select count(*) = 1 from c where def like '%component%')),
--     ('the component CHECK names all six',
--      (select bool_and(def like '%''chart''%' and def like '%''table''%' and def like '%''metric''%'
--              and def like '%''diagram''%' and def like '%''comparison''%' and def like '%''timeline''%')
--         from c where def like '%component%')),
--     ('exactly one CHECK mentions label',
--      (select count(*) = 1 from c where def like '%label%')),
--     ('the label CHECK names all six',
--      (select bool_and(def like '%(chart|table|metric|diagram|comparison|timeline) %')
--         from c where def like '%label%')),
--     ('row_count cap unchanged (1..500)',
--      (select count(*) = 1 from c where def like '%row_count >= 1%' and def like '%row_count <= 500%')),
--     ('spec size cap unchanged (262144)',
--      (select count(*) = 1 from c where def like '%262144%')),
--     ('RLS still enabled',
--      (select c2.relrowsecurity from pg_class c2 join pg_namespace n on n.oid = c2.relnamespace
--        where n.nspname = 'public' and c2.relname = 'message_artifacts')),
--     ('still exactly one policy (SELECT)',
--      (select count(*) = 1 and bool_and(cmd = 'SELECT') from pg_policies
--        where schemaname = 'public' and tablename = 'message_artifacts'))
--   )
--   select case when ok then 'PASS' else '*** FAIL ***' end as status, what from checks;
-- ============================================================================================
