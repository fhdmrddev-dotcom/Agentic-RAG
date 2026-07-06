---
phase: 138-run-end-honesty-stretch
plan: 01
subsystem: agent-loop
tags: [sandbox, execute_code, sse, final_output_files, content-hash, run-scope]

# Dependency graph
requires:
  - phase: 120-collision-fix
    provides: "snapshot_output_baseline() run-start seed + content-hash dedup baseline (_previous_files_in_run)"
provides:
  - "Run-scoped _new_file_hashes_in_run accumulator (ToolContext field + agent_loop lifecycle)"
  - "final_output_files SSE emit filtered to files genuinely new to THIS run (baseline/leftover excluded)"
  - "All-leftover run emits NO final_output_files event"
affects: [138-02, 138-03, run-end-honesty, sandbox-output-display]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Run-scoped content-hash accumulator threaded by-reference through ToolContext (mirrors _previous_files_in_run S3), None-defaulted for Deep/sub-agent/harness byte-identity"
    - "Emit identity read from dict .items() keys (SHA-256 hash) — never from a meta field or filename"

key-files:
  created:
    - .planning/phases/138-run-end-honesty-stretch/deferred-items.md
  modified:
    - backend/app/services/tool_dispatcher.py
    - backend/app/services/agent_loop.py
    - backend/tests/unit/test_120_collision_regression.py
    - backend/tests/unit/test_075_4_final_output_files_payload.py

key-decisions:
  - "D-07/D-08 honored: display-only fix — sandbox_service.harvest_output_files upload/insert untouched (git diff --stat confirms 0 changes)"
  - "D-14 red line: new ToolContext field defaults None + dispatcher populate guarded; sub-agent/harness ctx builds byte-identical"
  - "Accumulator population computes set(_iter_files) - _previous_files_in_run.keys() BEFORE .update() so baseline + cross-cell regenerations are excluded"
  - "Filter identity keyed on the SHA-256 hash (dict key) not iteration/url — the iteration:-1/url:None markers are overwritten by re-harvest before the emit (BUG-260626-02)"

patterns-established:
  - "Run-scoped hash accumulator: init in run_agent_loop -> thread on both ctx builds -> mutate in dispatcher delta-merge -> read at final emit"
  - "PRIMARY behavioral proof drives REAL snapshot_output_baseline()/harvest_output_files() (not hand-built dicts); SUPPLEMENTARY source-shape check stays regex-only"

requirements-completed: [RUN-01]

# Metrics
duration: 14min
completed: 2026-07-06
---

# Phase 138 Plan 01: Run-End Honesty (RUN-01a) Summary

**Baseline/leftover sandbox files no longer leak into a run's `final_output_files` SSE emit — a run-scoped `_new_file_hashes_in_run` content-hash accumulator filters the aggregate emit so only files genuinely new to THIS run surface, and an all-leftover run emits nothing.**

## Performance

- **Duration:** ~14 min
- **Started:** 2026-07-06T03:15:27Z
- **Completed:** 2026-07-06T03:29:34Z
- **Tasks:** 2
- **Files modified:** 4 (+1 created: deferred-items.md)

## Accomplishments
- Added `ToolContext.new_file_hashes_in_run` (default `None`) and populated it at the execute_code harvest delta-merge with `set(_iter_files) - _previous_files_in_run.keys()`, computed **before** the existing `.update()` so baseline (iteration:-1) hashes and cross-cell regenerations are excluded.
- Threaded a run-scoped `_new_file_hashes_in_run` set through `agent_loop.run_agent_loop` exactly like `_previous_files_in_run` (init once, by-reference on both the resume-path and main-loop ctx builds), then filtered the `final_output_files` emit via `_previous_files_in_run.items()` hash-key membership. An empty filtered list now suppresses the emit entirely.
- PRIMARY behavioral proof: two new cases in `test_120_collision_regression.py` drive the REAL `snapshot_output_baseline()` + `harvest_output_files()` functions to reproduce the exact reappearance (a leftover re-harvested with a fresh real URL, its `iteration:-1` baseline overwritten to `iteration:0`), then assert the leftover is excluded from the aggregate emit and an all-leftover run emits nothing.
- Kept the payload wire shape byte-identical (`filename` / `url` guarded via `or ""` / `size` / `is_hero`) — D-14 wire-compat held.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add the new_file_hashes_in_run ToolContext field + populate at delta-merge** - `de8c2bed` (feat)
2. **Task 2: Thread accumulator through agent_loop + filter emit + regression tests** - `fbe9beec` (feat)

**Plan metadata:** committed with SUMMARY (docs) — see final metadata commit.

## Files Created/Modified
- `backend/app/services/tool_dispatcher.py` - `ToolContext.new_file_hashes_in_run` field (default None) + guarded accumulator population before the harvest `.update()`
- `backend/app/services/agent_loop.py` - run-scoped `_new_file_hashes_in_run` init + by-reference thread on both ctx builds + hash-membership filter on the `final_output_files` emit with empty-list guard
- `backend/tests/unit/test_120_collision_regression.py` - PRIMARY proof: real reappearance-mechanism exclusion + all-leftover-emits-nothing
- `backend/tests/unit/test_075_4_final_output_files_payload.py` - SUPPLEMENTARY source-shape checks rewritten for the filtered emit (also resolved 2 pre-existing regex-rot failures on the drifted emit block)
- `.planning/phases/138-run-end-honesty-stretch/deferred-items.md` - out-of-scope pre-existing test rot log

## Decisions Made
- Followed the plan's locked decisions exactly (D-07/D-08 display-only, D-14 red line, hash-key identity). `sandbox_service.py` deliberately untouched — verified via `git diff --stat backend/app/services/sandbox_service.py` (empty).
- Test-execution note: the two target test files were run with the main repo's venv Python (`backend/venv/Scripts/python.exe`) since the worktree carries no `.env`/venv; conftest supplies the required env vars for the pytest path.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Pre-existing regex-rot in the supplementary source-shape test**
- **Found during:** Baseline run before Task 2 (and re-confirmed after)
- **Issue:** `test_075_4_final_output_files_payload.py` had 2 assertions failing at the phase base commit — its regexes asserted the OLD emit shape (`meta["url"]` and an `if _previous_files_in_run:` → immediate `await _emit` structure) that had already drifted (source now uses `meta.get("url") or ""` and an intervening hero/re-stamp block). Since Task 2 rewrites exactly that emit block and this file is in the plan's `files_modified`, the supplementary checks were brought in line with the new filtered emit.
- **Fix:** Rewrote both source-shape functions to assert the new shape (`.items()` + `if _h in _new_file_hashes_in_run`, unfiltered `list(...values())` gone, url guarded via `or ""`, two nested guards) and added a dedicated RUN-01a filter-shape test.
- **Files modified:** backend/tests/unit/test_075_4_final_output_files_payload.py
- **Verification:** `pytest tests/unit/test_075_4_final_output_files_payload.py` — 3/3 green.
- **Committed in:** `fbe9beec` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 test rot in an in-scope modified file)
**Impact on plan:** No scope creep — the change is confined to the emit block this plan rewrites; supplementary test updated to match, per the plan's own "additions here are supplementary source-shape checks" guidance.

## Issues Encountered
- **Out-of-scope pre-existing failures (NOT fixed):** `test_sandbox_service.py::TestHarvestOutputFiles` (3 tests) fail at the base commit — they assert `current_files_set == {"output.csv"}` but since Phase 075.4 `harvest_output_files`'s second return is keyed by content-hash. `sandbox_service.py` and `test_sandbox_service.py` are untouched by this plan (D-07), so these are pre-existing rot. Logged to `deferred-items.md`; suggested as a small test-maintenance quick-task.

## Threat Flags

None — no new network endpoint, auth path, file-access pattern, or schema change. The `_new_file_hashes_in_run` accumulator is run-scoped and strictly more restrictive than the prior unfiltered emit (T-138-01/02/03 mitigations from the plan's threat register are satisfied by construction).

## Known Stubs

None — no placeholder/empty-value stubs introduced.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- RUN-01a (display-only emit filter) is complete and unit-proven. Live/manual confirmation of the leftover-exclusion behaviour is covered by plan 138-03 (checkpoint), per the plan's verification section.
- RUN-01b (run-end todo reconciler) is a separate plan on this phase and is unaffected by these changes.

---
*Phase: 138-run-end-honesty-stretch*
*Completed: 2026-07-06*
