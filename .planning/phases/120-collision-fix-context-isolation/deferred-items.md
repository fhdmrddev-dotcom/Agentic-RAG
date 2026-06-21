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
