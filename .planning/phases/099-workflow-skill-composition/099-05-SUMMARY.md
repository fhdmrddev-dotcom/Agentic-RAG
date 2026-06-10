---
phase: 099-workflow-skill-composition
plan: 05
subsystem: api
tags: [harness, skills, skill_files, supabase-storage, snapshot, materialize, pytest, tdd]

# Dependency graph
requires:
  - phase: 099-workflow-skill-composition (Plan 03)
    provides: "materialize_skill_snapshots host service + SkillSnapshot model + validate_skill_refs publish gate"
  - phase: 099-workflow-skill-composition (Plan 01)
    provides: "test_099_skill_composition.py cross-plan TDD contract + _FakeStorage / _FakeSkillsDB fakes"
provides:
  - "materialize_skill_snapshots file manifest sourced from the skill_files table (not a nonexistent skills.files column) — CR-01 BLOCKER fix"
  - "De-mocked test fakes modeling the real two-table shape (skills + skill_files as separate rowsets)"
  - "Verification truth #5 (snapshot file manifest populated + Storage-copied at materialization) now satisfiable in production"
affects: [099 verification, 099 secure-phase, WFSKILL-01 file-half, 101 template-fill skill use]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Two-table manifest fetch: skill instructions/name from skills, file NAMES from skill_files (mirrors _handle_load_skill, tool_dispatcher.py:375-383)"
    - "Offline fake DBs route by table name (table('skills') vs table('skill_files')) so the fake mirrors the real schema and cannot carry a phantom column"

key-files:
  created: []
  modified:
    - backend/app/services/harness/skill_snapshot.py
    - backend/tests/test_099_skill_composition.py

key-decisions:
  - "File manifest is sourced from the skill_files table keyed by the validated skill_ref UUID — no injection surface, no schema change, no row.get('files') on the skills row"
  - "Pre-fix empty-manifest snapshots stay idempotency-locked (documented as a known limitation); a re-materialization sweep is out of scope (would change idempotency semantics)"
  - "Test fakes de-mocked to the real two-table shape so they can no longer mask a phantom skills.files column"

patterns-established:
  - "Pattern 1: harness service fetches skill file NAMES from skill_files via aexec, exactly as the live load_skill path — never reads a files column off the skills row"
  - "Pattern 2: offline _FakeSkillsDB takes (skill_rows, skill_files=None) and routes table(name) so production-shaped two-table queries resolve without a live DB"

requirements-completed: [WFSKILL-01]

# Metrics
duration: ~8min
completed: 2026-06-10
---

# Phase 099 Plan 05: Skill-Snapshot Manifest Source Fix (CR-01) Summary

**materialize_skill_snapshots now sources the snapshot file manifest from the skill_files table (mirroring the live load_skill path) instead of a nonexistent skills.files column, and the de-mocked test fakes model the real two-table shape so they can no longer mask the bug.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-06-10T06:26Z
- **Completed:** 2026-06-10T06:33Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- **CR-01 BLOCKER closed:** the materializer's broken `filenames = list(row.get("files") or [])` (the `skills` table has no `files` column, so production always produced an empty manifest, zero Storage copies, and every `read_skill_file` in a skill-bearing phase errored) is replaced with a `skill_files`-table query wrapped in `aexec`, keyed by the validated `skill_ref` and ordered by `filename` — exactly mirroring `_handle_load_skill` (tool_dispatcher.py:375-383).
- **De-mocked the test fakes:** `_FakeSkillsDB` now takes `(skill_rows, skill_files=None)` and routes `table("skills")` vs `table("skill_files")` by name; a new `_FakeSkillFilesQuery` models the `select.eq.order.execute` chain; no skills row can carry a phantom `files` key. The fakes now fail against the OLD (broken) materializer and pass against the fixed one.
- **Verification truth #5 is now satisfiable:** the snapshot manifest is populated from real `skill_files` rows, one Storage copy happens per file, and the snapshot prefix can serve `read_skill_file`.
- Documented the pre-fix empty-manifest re-materialization limitation inline (idempotency-locked; out of scope).

## Task Commits

Each task was committed atomically:

1. **Task 1: Source the snapshot file manifest from the skill_files table** - `7a496829` (fix)
2. **Task 2: De-mock the test fakes to model the real two-table shape** - `4371f2f0` (test)

_Note: this is a gap-closure plan; Task 1 carries `tdd="true"` — the RED was confirmed by running the named materialize tests against the fixed materializer with the old single-table fakes (`AttributeError: '_FakeSkillsQuery' object has no attribute 'order'`), proving the old fakes masked the bug; Task 2's de-mock turns them GREEN._

## Files Created/Modified
- `backend/app/services/harness/skill_snapshot.py` - `materialize_skill_snapshots` now queries `skill_files` for the file manifest via `aexec`; the broken `row.get("files")` line is removed; `_SKILL_SELECT` comment + an inline idempotency-limitation note added; no schema/threat-surface change.
- `backend/tests/test_099_skill_composition.py` - `_FakeSkillsDB` restructured to two rowsets with table-name routing; new `_FakeSkillFilesQuery`; `mutate()` redirects a `files=` kwarg to the skill_files rowset; the two materialize tests seed `skill_files={...}` instead of a `files` key on the skills row.

## Decisions Made
- **Manifest source = `skill_files` keyed by the validated `skill_ref` UUID** (T-099-CR01-01): `.eq("skill_id", str(skill_ref))` has no injection surface and reflects the already-gate-resolved skill. No schema change; `_SKILL_SELECT` deliberately does NOT add a `files` token.
- **Pre-fix empty-manifest snapshots are NOT auto-healed** (T-099-CR01-03, accepted): a definition whose phases already carry `skill_snapshot` with `files: []` is locked by the idempotency check. A re-materialization sweep would change idempotency semantics — explicitly out of scope, documented inline.
- **Fakes de-mocked to the real two-table shape** so the test suite can no longer pass while production is broken (the original CR-01 root cause: the fake carried a `files` column the schema lacks).

## Deviations from Plan

None - plan executed exactly as written.

The plan's Task 1 `<verify>` expects the two materialize tests to be GREEN, but those tests only pass once Task 2's de-mocked fakes land (they share the cross-task dependency the plan describes: Task 1 fixes production, Task 2 de-mocks the tests). This is the plan's intended structure, not a deviation — Task 1 was committed with the production fix (RED confirmed), Task 2 committed the de-mock (GREEN). The plan's overall `<verification>` (full test_099 suite GREEN + 098/096 regression) gates completion and passed.

## Issues Encountered
- The worktree has no local `venv`; pytest was run with the shared-checkout venv python (`C:/Vibe Apps/Agentic RAG/backend/venv/Scripts/python.exe`) from the worktree backend cwd so the worktree source is on the path. Confirmed via the traceback resolving to the worktree-relative `app/services/harness/skill_snapshot.py`.

## Test Results
- `test_099_skill_composition.py`: **10 passed** (0 xfail, 0 skip) against the fixed materializer with de-mocked fakes.
- `test_098_scope_governance.py` + `test_096_ci_workflow_regression.py`: **10 passed** (regression — no net-new failures).
- Pre-existing rot (`test_bounded_retry_reaches_failed_after_3_attempts` KeyError; integration FK-violation cluster) is documented in `099-workflow-skill-composition/deferred-items.md` and untouched — out of scope; this plan modified only `skill_snapshot.py` + `test_099_skill_composition.py`.

## Threat Surface
No new security-relevant surface. The manifest query is keyed by the Pydantic-validated `skill_ref` UUID (T-099-CR01-01 mitigated: no injection surface, reflects the gate-resolved skill); the harness runs as service role and the skill was already resolved owned-or-global + enabled before the manifest query (T-099-CR01-02 accepted); pre-fix empty snapshots stay idempotency-locked (T-099-CR01-03 accepted). No new endpoints, auth paths, file-access patterns, or schema changes.

## Known Stubs
None — no stubs, placeholders, or hardcoded empty values introduced. The materializer now produces real filenames from real `skill_files` rows.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- WFSKILL-01's file half is now functional in production: the snapshot manifest is populated and Storage-copied at materialization, and `read_skill_file` can serve the snapshot prefix.
- Ready for `/gsd:verify-work 099` (truth #5 now satisfiable) and `/gsd:secure-phase 099`.
- Note (carried from Plan 04): `backend/app/api/threads.py` extraction remains DUE (G-5) — this gap-closure plan touched only `skill_snapshot.py` + the test, not the hot file.

## Self-Check: PASSED

- FOUND: `backend/app/services/harness/skill_snapshot.py`
- FOUND: `backend/tests/test_099_skill_composition.py`
- FOUND: `.planning/phases/099-workflow-skill-composition/099-05-SUMMARY.md`
- FOUND commit: `7a496829` (Task 1 — materializer fix)
- FOUND commit: `4371f2f0` (Task 2 — de-mocked fakes)

---
*Phase: 099-workflow-skill-composition*
*Completed: 2026-06-10*
