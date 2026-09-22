-- Migration 182 — Phase 256 (METER-03 / D-256-01 / D-256-03 / D-256-06 / D-256-07 / D-256-09)
-- workflow_runs token totals + the coverage marker.
--
-- WHY ALL THREE COLUMNS ARE NULLABLE, AND WHY THAT IS NOT LAZINESS.
--   A provider that emitted no usage is a DIFFERENT FACT from one that used zero tokens.
--   NULL means never measured; 0 means measured as zero. Collapsing the two would make an
--   uninstrumented run indistinguishable from a free one — which is the exact defect Phase 257
--   exists to prevent ($0.00 for an unrated model). So: no nullability constraint here, and no
--   zero fallback value on any of the three. (D-256-06.)
--   `integer` mirrors public.runs exactly (035_runs_table.sql:30-31) so the same grain reads the
--   same in both tables.
--
-- HOW THE NUMBERS ACCUMULATE (D-256-09).
--   db.workflows.persist_run_usage ADDs a per-phase DELTA at the database
--   (input_tokens = COALESCE(input_tokens, 0) + $n); it never SETs. ctx.run_usage_box is reset
--   to {} on every _resume_run (harness_engine.py:1844), so the box only ever carries ONE run
--   SEGMENT's spend — a SET would make the last segment's spend the whole run's total.
--
-- GRAINS — NEVER SUM ACROSS THE TWO TABLES (D-256-03).
--   workflow_runs is AUTHORITATIVE for a harness run. The producer shell in public.runs carries
--   ITS SEGMENT only. Both are honest at their own grain; pick a grain, never add them together.
--
-- THE READ RULE OVER public.runs (D-256-01).
--   A producer run's persisted number is INCLUSIVE of every descendant, so any org-level or
--   thread-level total over runs sums only rows WHERE parent_run_id IS NULL. That narrowing is
--   not new — api/workflows.py:1772 and api/runs.py:1563 already use it.
--
-- WHY THERE IS NO BACKFILL HERE.
--   A schema change must not do data work. Every run that already exists keeps all three columns
--   NULL and therefore reads honestly as "never measured", forever, with no date arithmetic —
--   which is precisely the third state token_coverage needs (D-256-07 / SC#4).
--
-- NOTE: no COMMIT inside a PROCEDURE/DO block — migrations 105 and 107 could not be pasted into
-- the Supabase SQL editor for exactly that reason.

ALTER TABLE public.workflow_runs
    ADD COLUMN IF NOT EXISTS input_tokens   integer,
    ADD COLUMN IF NOT EXISTS output_tokens  integer,
    ADD COLUMN IF NOT EXISTS token_coverage text[];

COMMENT ON COLUMN public.workflow_runs.input_tokens IS
    'Phase 256 (METER-03). Cumulative input tokens for this harness run, ACCUMULATED BY ADDITION '
    'at every phase boundary by db.workflows.persist_run_usage — never SET, because '
    'ctx.run_usage_box is reset per run SEGMENT at harness_engine.py:1844 and a SET would make '
    'the last segment''s spend the whole run''s total (D-256-09). Nullable, deliberately: NULL '
    'means never measured, 0 means measured as zero, and the two are different facts — do not '
    'coalesce (D-256-06). This is the WORKFLOW grain; runs.input_tokens on the per-segment '
    'producer shell is the SEGMENT grain — NEVER SUM ACROSS public.runs AND public.workflow_runs '
    '(D-256-03). Read rule for public.runs (D-256-01): any org-level or thread-level total sums '
    'only rows WHERE parent_run_id IS NULL, because a parent row is INCLUSIVE of its descendants.';

COMMENT ON COLUMN public.workflow_runs.output_tokens IS
    'Phase 256 (METER-03). See input_tokens: same writer (db.workflows.persist_run_usage), same '
    'ADD-not-SET accumulation and the same reason for it (D-256-09), same WORKFLOW grain with the '
    'same prohibition on summing across public.runs and public.workflow_runs (D-256-03), same '
    'NULL-means-never-measured / 0-means-measured-as-zero rule (D-256-06), and the same read rule '
    'over public.runs — sum only rows WHERE parent_run_id IS NULL (D-256-01).';

COMMENT ON COLUMN public.workflow_runs.token_coverage IS
    'Phase 256 (D-256-07 / SC#4). WHICH COUNTING LEGS this run''s totals actually include, e.g. '
    '{agent,single,batch,emit}. Written from ONE module-level constant, db.workflows.'
    'TOKEN_COVERAGE_LEGS, in the same commit as the leg it names — so a run persisted before a '
    'leg shipped reads honestly as NOT covering it, forever, with no memory required. Coverage is '
    'RECORDED, never INFERRED: deriving it from created_at against a ship date is "someone''s '
    'memory" encoded as a comparison, which SC#4 forbids. Phase 257''s METER-07 "what it cannot '
    'see" view reads THIS COLUMN, never hand-written prose. THREE states and all three are '
    'distinct: NULL = no instrumented leg ever reported usage for this run (a pre-182 row, or a '
    'run whose every leg was silent) · {} = reported, but covering nothing · a populated array = '
    'exactly the legs listed. Same grain rule as input_tokens (D-256-03) and same read rule over '
    'public.runs — sum only rows WHERE parent_run_id IS NULL (D-256-01).';

-- The per-org "which runs are not fully covered" query, WITHOUT a scan (D-256-07's hard
-- constraint, and Phase 257 METER-07's access path). PARTIAL: only the incomplete rows are
-- indexed, so the covered majority costs nothing and the negation a GIN index cannot serve is
-- sidestepped entirely. Array containment @> is IMMUTABLE, which a partial-index predicate
-- requires.
-- ⚠ workflow_runs has only two indexes today (thread_id, user_id) and NO org_id index at all,
--    so this is also the table's first per-org access path.
-- ⚠ The complete leg set is a LITERAL inside the predicate. Adding a fifth counting leg means
--    one migration that DROPs and re-CREATEs this index — no data change. That is the price of
--    an index that can answer a NEGATIVE question.
CREATE INDEX IF NOT EXISTS idx_workflow_runs_org_coverage_incomplete
    ON public.workflow_runs (org_id, created_at DESC)
    WHERE token_coverage IS NULL
       OR NOT (token_coverage @> ARRAY['agent','single','batch','emit']::text[]);
