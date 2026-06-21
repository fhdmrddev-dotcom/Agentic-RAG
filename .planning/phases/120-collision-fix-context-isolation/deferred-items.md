# Phase 120 — Deferred Items (out-of-scope discoveries)

Logged per the executor SCOPE BOUNDARY rule: only auto-fix issues directly
caused by the current task's changes. The items below are pre-existing and
unrelated to Plan 01 (COLL-01) work.

## Pre-existing test failures in `backend/tests/unit/test_sandbox_service.py`

Discovered during Plan 01 Task 2 regression-guard run. Confirmed PRE-EXISTING
by stashing all Plan 01 working-tree changes and re-running — the failures
reproduce identically on the base, so they are NOT caused by the COLL-01 seed.

Failing tests (all in `TestHarvestOutputFiles`):
- `test_harvest_files_uploads_and_inserts`
- `test_harvest_files_empty_output`
- `test_harvest_files_storage_path_format`

Root cause (out of scope): these tests assert the OLD `harvest_output_files`
return shape — `current_files_set == {"output.csv"}` (a set of bare filenames).
Since the Phase 075.4 D-075.4-D1 signature pivot, `harvest_output_files`
returns a `dict[content_hash, meta]` (the second tuple element), so the bare
filename is now a SHA-256-prefixed storage-path key. The tests were never
updated to the hash-keyed contract.

Disposition: NOT fixed in Plan 01 (out of scope — unrelated to the run-scope
baseline seed). The directly-relevant shared dedup machinery suite
(`test_075_4_dedup_supersedes.py`, 6/6) and the new Plan 01 regression suite
(`test_120_collision_regression.py`, 4/4) are green. Candidate for a follow-up
test-hygiene fix (update the 3 assertions to the hash-keyed shape).

---

## Plan 120-02 (CTX-01) execution

### Pending migration 076 apply (resolved by Plan 03 — NOT a defect)

Two live-DB integration tests fail with PostgREST `PGRST204:
"Could not find the 'origin' column of 'messages' in the schema cache"`. This is
the EXPECTED interim state: Plan 120-02 AUTHORS migration 076 but does NOT apply
it (the plan objective is explicit — Plan 03 is the BLOCKING operator task that
applies migration 076 to the live DB + regenerates `full-schema.sql`). My code
now writes `origin` to `messages`; the live local DB will not have the column
until Plan 03 runs. Both pass once migration 076 is applied.

- `tests/integration/test_093_ask_user_workflow_run_live.py::test_deep_runs_id_path_still_200`
- `tests/integration/test_093_ask_user_workflow_run_live.py::test_ask_user_answer_resolves_via_workflow_run_fallback`

### Pre-existing failures (red at phase base `4bce9ded` — out of scope, NOT touched)

Verified failing against the base source (Task-1 files checked out at base,
Task-2 stashed) — none caused by this plan's changes. Per the SCOPE BOUNDARY
rule, these are NOT fixed here.

- `tests/unit/test_db_runs.py::test_insert_run_passes_args_positionally` — asserts
  the OLD 6-arg `insert_run` contract; `insert_run` gained `spawned_by_worker` +
  `parent_run_id` (Phase 079/085). Stale, unrelated to `origin`.
- `tests/unit/test_db_runs.py::test_insert_assistant_message_sql_shape` — asserts
  `len(args) == 8`; the helper already had 9 args (incl. `reasoning_content`,
  Phase 076.1) at base. Stale assertion (this plan's `origin` makes it 10, but it
  was already red before this plan).
- `tests/unit/test_db_runs.py::test_insert_assistant_message_optional_fields_none`
  — same stale `len(args) == 8` assertion.
- `tests/integration/test_061_runs_table.py::test_runs_lifecycle_row` — live-DB
  `ForeignKeyViolationError` on `runs_thread_id_fkey` (test-data setup).
- `tests/integration/test_063_1_messages_runs_join.py::test_get_messages_includes_run_id_and_run_status_for_assistant_rows`
  — `KeyError: 'model'` (fixture/data drift).
- `tests/integration/test_075_snapshot.py::test_snapshot_returns_messages_active_runs_cursors`
  — snapshot body assertion mismatch (live-DB data state).
- `tests/test_dual_mode_wiring.py::test_published_workflows_list_endpoint` —
  published-workflow list body assertion mismatch (`definition` field).

> The two stale `insert_assistant_message` unit-test assertions are the closest
> to this plan's surface (they cover the helper this plan modified) but were
> already red at base — pre-existing test debt, not a regression. A follow-up
> could refresh them to the current 10-arg shape (incl. `origin`); left out of
> 120-02 to honor the scope boundary.
