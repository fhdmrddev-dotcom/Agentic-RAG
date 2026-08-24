-- ═══════════════════════════════════════════════════════════════════════════════════════
-- 123 — REPAIR the definition snapshots migration 122's writer stored double-encoded.
-- ═══════════════════════════════════════════════════════════════════════════════════════
--
-- WHAT WENT WRONG, MEASURED. Migration 122 added `workflow_runs.definition_snapshot` and
-- `db/workflows.create_workflow_run` began writing it. The writer passed
-- `json.dumps(definition.model_dump(mode="json"))` — an already-encoded STRING — into a
-- `$N::jsonb` parameter. `dependencies._init_pg_connection` registers a jsonb codec on every
-- pooled connection with `encoder=json.dumps` (Phase 073 / D-073-06), so the value was
-- encoded a SECOND time and landed as a jsonb **string scalar** holding JSON text.
--
-- The two runs executed on 2026-08-20 — the first and only runs since 122 shipped — both
-- carry that shape, and `test_migration_122.py` went RED on exactly the assertion it was
-- written for:
--
--     definition_snapshot must be a jsonb OBJECT; found [(…, 'string'), (…, 'string')]
--
-- ⚠ THE VALUE IS NOT LOST AND THIS REPAIR IS LOSSLESS. `#>> '{}'` extracts the jsonb string's
-- text content, which is the original JSON document verbatim; re-casting it to jsonb parses
-- that document into the object it should always have been. Nothing is re-derived from the
-- definition row, so a snapshot of a definition that has since changed stays the snapshot it
-- was — which is the entire point of the column.
--
-- ⚠ THE WRITER IS FIXED IN THE SAME COMMIT. `create_workflow_run` now hands the codec a plain
-- dict, which is what `_init_pg_connection`'s own docblock says the codec exists for
-- (*"lets call sites pass plain Python dicts/lists"*). Without that fix this migration would
-- repair two rows and the next run would create a third bad one.
--
-- ⚠ SCOPE — WHAT THIS DELIBERATELY DOES **NOT** TOUCH, so the silence is not read as an
-- oversight. `workflow_runs.inputs` (`jsonb_typeof = 'string'` on **230 of 230** rows) and
-- `workflow_definitions.definition` (**261 of 291**) carry the identical defect from the
-- identical cause. They are NOT repaired here, and their writers are NOT changed, because
-- their readers have lived with the string shape for the whole life of those columns and
-- flipping the writer alone would produce a table with two shapes in it. That is a change
-- with its own read-side audit and its own migration, not a line in this one. This column is
-- repairable alone precisely because it has TWO rows, both from today, and one reader
-- (`api/workflow_runs.py:_coerce_definition`) that already accepts both shapes.
--
-- IDEMPOTENT AND GUARDED. The `WHERE` selects only rows that are string scalars AND whose
-- text content parses to an object, so:
--   · re-running it is a no-op (repaired rows are no longer `'string'`);
--   · a string scalar holding something that is NOT a JSON object is LEFT ALONE rather than
--     blindly cast — a cast that raised would abort the whole statement, and one that
--     succeeded into a non-object would swap one wrong shape for another.
-- No schema change, no column added, no default, no backfill of NULLs: a run that never had
-- a snapshot still has none.

BEGIN;

UPDATE public.workflow_runs
   SET definition_snapshot = (definition_snapshot #>> '{}')::jsonb
 WHERE definition_snapshot IS NOT NULL
   AND jsonb_typeof(definition_snapshot) = 'string'
   AND jsonb_typeof((definition_snapshot #>> '{}')::jsonb) = 'object';

-- The post-condition, asserted in the same transaction that made it true. A repair that
-- silently matched zero rows, or that left a string scalar behind, aborts here rather than
-- committing a half-done state and leaving the suite to discover it.
DO $$
DECLARE
    remaining int;
BEGIN
    SELECT count(*) INTO remaining
      FROM public.workflow_runs
     WHERE definition_snapshot IS NOT NULL
       AND jsonb_typeof(definition_snapshot) <> 'object';

    IF remaining > 0 THEN
        RAISE EXCEPTION
            'migration 123: % definition_snapshot value(s) are still not jsonb objects', remaining;
    END IF;
END $$;

COMMIT;
