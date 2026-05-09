---
phase: 062-replay-tail-api
plan: 01
subsystem: api

tags: [sse, run-backed, active-runs, postgres, fastapi, pydantic, rls]

requires:
  - phase: 061-run-backed-streaming-backend
    provides: "public.runs lifecycle table with status enum + idx_runs_active partial index + runs_select_own RLS policy (migration 035)"
  - phase: 058-backend-sse-concurrency-fix
    provides: "aexec() helper wrapping sync supabase calls in run_in_threadpool (D-058-03)"
provides:
  - "GET /threads/{thread_id}/active-runs endpoint (bare-list response, streaming-only filter, ownership-enforced 404)"
  - "ActiveRunResponse Pydantic wire-shape model (run_id, started_at, status)"
  - "Cross-user existence-leak mitigation pattern (404, NOT 403, enforced by .eq(user_id) + RLS defense-in-depth)"
affects: [062-replay-tail-api, 063-frontend-reconcile, 064-browser-mcp-harness]

tech-stack:
  added: []
  patterns:
    - "Pydantic-bound bare-list response per D-062-04 (mirrors list_threads/get_messages convention)"
    - "Anti-false-RED test guards: assert HTTPException detail string + assert mock SELECT was actually called — distinguishes route-404 from missing-route-404"

key-files:
  created:
    - backend/app/models/run.py
    - backend/tests/integration/test_062_active_runs.py
    - backend/tests/integration/test_062_cross_user_404.py
  modified:
    - backend/app/api/threads.py

key-decisions:
  - "Used existing aexec() pattern for both ownership SELECT and runs SELECT (D-058-03 invariant — never call sync supabase directly in async handlers)"
  - "Path param typed as UUID so FastAPI auto-rejects malformed input with 422 before any handler runs (D-062-04)"
  - "Added anti-false-RED guards to ownership/cross-user tests asserting detail='Thread not found' AND threads SELECT was actually called — without these, the tests pass even before the route exists, creating a silent test-quality bug"
  - "Imported `from uuid import UUID` alongside the existing `import uuid as _uuid_mod` rather than refactoring all _uuid_mod uses — minimum-diff insertion"

patterns-established:
  - "Two-mock-then-assert pattern for SELECT-then-SELECT routes: configure threads_builder.execute.side_effect first (ownership row or None), then runs_builder.execute.side_effect (data rows or empty)"
  - "Anti-false-RED guard for ownership-404 tests: check resp.json()['detail'] equals the route's HTTPException string AND that the mock SELECT was invoked"

requirements-completed: [STREAM-04]

duration: 12min
completed: 2026-05-03
---

# Phase 062 Plan 01: Active-Runs Read-Side Surface Summary

**GET /threads/{thread_id}/active-runs endpoint shipped — Pydantic-bound bare list filtered to status='streaming', ordered started_at DESC, with ownership-SELECT-first 404 (NOT 403) per D-062-12 to prevent existence-leak.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-05-03T~10:30:00Z
- **Completed:** 2026-05-03T~10:42:00Z
- **Tasks:** 2 (RED + GREEN)
- **Files created:** 3 (1 model, 2 test files)
- **Files modified:** 1 (threads.py — additions only, 45 insertions / 0 deletions)

## Accomplishments

- Shipped the read-side surface that Phase 063's frontend reconcile-on-(re)connect will call
- Established the anti-false-RED guard pattern for ownership-404 tests (caught 2 silent false-greens during T1 RED gate that would have hidden a missing-route regression)
- Confirmed D-062-14 file-layout discipline holds: zero modifications to event_consumer / agent_runner / send_message / _shielded_finalize regions of threads.py
- 058/059/061 binding regression sweep stays green (test_cross_tab_unblocked_during_sse, test_agent_task_SURVIVES_on_disconnect, test_061_consumer_cursor_race ×3)

## Task Commits

Each task was committed atomically (TDD RED → GREEN cycle):

1. **Task 1: Wave 0 RED stubs** — `7534967` (test) — 6 failing tests across test_062_active_runs.py + test_062_cross_user_404.py
2. **Task 2: GREEN implementation** — `444bc2e` (feat) — ActiveRunResponse model + list_active_runs route

## Files Created/Modified

### Created

- **`backend/app/models/run.py`** (24 lines) — `ActiveRunResponse(BaseModel)` with three fields:
  - `run_id: UUID`
  - `started_at: datetime`
  - `status: str`

  Per D-062-03 the cursor field is deliberately omitted (frontend always replays from since=0; per-run buffer is bounded by MAXLEN 10000 ≈ 2MB so a full replay on reconnect is cheap). Per D-062-04 the `status` field is on the wire for forward-compat with the rejected `?include_terminal=true` variant.

- **`backend/tests/integration/test_062_active_runs.py`** (203 lines) — 5 tests covering SC#1:
  - `test_returns_streaming_only_filter` — asserts `.eq("status","streaming")` + `.order("started_at", desc=True)` are in the runs SELECT call args
  - `test_returns_response_model_shape` — asserts each item is exactly `{run_id, started_at, status}` (Pydantic strips extra source fields like `current_offset`)
  - `test_empty_when_no_streaming` — asserts 200 + `[]` when SELECT returns empty
  - `test_malformed_uuid_returns_422` — proves FastAPI auto-validation on the typed path param
  - `test_thread_ownership_select_runs_first` — asserts ownership SELECT runs first, returns `Thread not found` 404, and short-circuits before touching the runs table

- **`backend/tests/integration/test_062_cross_user_404.py`** (62 lines) — 1 test owned by Plan 01 (Plans 02 + 03 will append the stream and delete cross-user variants to this same file):
  - `test_active_runs_other_user_returns_404` — overrides `get_current_user` to OTHER_USER; asserts 404 (NOT 200, NOT 403) per D-062-12

### Modified

- **`backend/app/api/threads.py`** — 45 insertions, 0 deletions. Two contiguous insertion regions:
  1. Two import lines near top: `from uuid import UUID` (line 76) and `from app.models.run import ActiveRunResponse` (line 24)
  2. New `list_active_runs` route (lines 443–482) inserted between `list_threads` (ends line 440) and `create_thread` (starts line 487)

  Function ordering verified via `grep -n`:
  ```
  429:async def list_threads(
  450:async def list_active_runs(
  487:async def create_thread(
  ```

## Decisions Made

- **Anti-false-RED guards added to ownership tests.** During T1 RED, two tests (`test_thread_ownership_select_runs_first`, `test_active_runs_other_user_returns_404`) initially passed because FastAPI returns 404 for an unregistered route too. Without distinguishing "ownership-404" from "no-route-404", the RED gate would not actually prove the implementation is missing. Added two assertions to both tests: (1) `resp.json()['detail'] == "Thread not found"` (the route's HTTPException string, not FastAPI's default `Not Found`), and (2) the threads ownership SELECT was actually called. Both tests then failed RED correctly and pass GREEN after Task 2.
- **`from uuid import UUID` added next to existing `import uuid as _uuid_mod`.** The file already uses `_uuid_mod.UUID` for the `RUN_TASKS` registry annotation; refactoring all uses would have widened the diff and risked touching off-limits regions. Adding the second import is a single-line insertion with zero behavioral impact on existing code.
- **All other choices followed the plan.** Pydantic shape, ownership SELECT pattern, streaming-only filter, ORDER BY, and 404-not-403 semantics all came directly from D-062-02/03/04/12 and the plan's verbatim skeletons.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Test Quality Bug] Anti-false-RED guards on ownership tests**

- **Found during:** Task 1 (RED gate verification)
- **Issue:** The plan's verbatim test bodies for `test_thread_ownership_select_runs_first` and `test_active_runs_other_user_returns_404` only asserted `resp.status_code == 404`. Because FastAPI returns 404 for an unregistered route, both tests passed RED even though the route did not exist — a silent false-green that would not catch a future regression where the route is removed.
- **Fix:** Added two anti-false-RED guards to both tests:
  1. `assert body.get("detail") == "Thread not found"` — the route's HTTPException string differs from FastAPI's default `Not Found`, so this assertion fails when the route is missing.
  2. `assert threads_execute_called` — proves the ownership SELECT was actually invoked, which can only happen if the route ran.
- **Files modified:** `backend/tests/integration/test_062_active_runs.py`, `backend/tests/integration/test_062_cross_user_404.py`
- **Verification:** After the fix, all 6 tests fail RED (4 with status-mismatch, 2 with detail-mismatch) and all 6 pass GREEN after Task 2.
- **Committed in:** `7534967` (Task 1 RED commit, with the guards already in place — fixed before commit so the RED gate is honest)

---

**Total deviations:** 1 auto-fixed (test-quality bug — Rule 1)
**Impact on plan:** No scope change. The fix strengthens the RED gate without adding work or changing the implementation surface. Plan-wide invariants (D-062-14 file-layout discipline, D-062-12 cross-user 404, no off-limits-region modifications) are unchanged.

## Issues Encountered

None during planned work. The TDD fail-fast investigation surfaced the test-quality bug above, which was fixed inline before the T1 commit (so the RED gate is genuine) — no rollback or refactor needed.

## DEF-061.1-02 Disposition

DEF-061.1-02 (suspected producer exception classifier coercing `failed` → `completed`) is carried forward to a future 061.2 phase per the plan frontmatter `must_haves.deferred` clause. Rationale (verbatim from plan): the suspected fix lives at threads.py:2057-2076 — a region D-062-14 physically partitions OUT of 062's scope. The misclassification only affects audit metadata; a wrong-bucket `completed` run is filtered OUT of active-runs anyway (D-062-02 SELECT WHERE status='streaming'), so 062's user-visible contract is unaffected. The 062 full-suite verify inherits 061.1's canonical -k exclusion clause documented in 062-VALIDATION.md.

## Off-Limits Region Verification

Per D-062-14 the following regions of `backend/app/api/threads.py` MUST NOT be modified by Plan 01. Confirmed via `git diff --stat` showing 45 insertions / 0 deletions, and via inspection that all additions cluster in two contiguous regions (imports near top + new function between lines 440-487):

- `event_consumer` (lines 336-423) — untouched
- `agent_runner` (lines ~757-2156 in current file) — untouched
- `_shielded_finalize` (lines ~2087-2146) — untouched
- `send_message` (lines ~675-2186) — untouched
- Registry constants region (RUN_TASKS, TERMINAL_TYPES, _emit, _emit_terminal, _RUN_STATUS_TO_TERMINAL_TYPE) — untouched (only the two import lines added; `RUN_TASKS` annotation and constants block bodies unchanged)

## Regression Sweep

The plan's binding 058/059/061 regression sweep is green:

```
backend/tests/integration/test_058_concurrency.py::test_cross_tab_unblocked_during_sse  PASSED
backend/tests/integration/test_059_disconnect.py::test_agent_task_SURVIVES_on_disconnect  PASSED
backend/tests/integration/test_061_consumer_cursor_race.py  PASSED (3 tests)
```

All 6 plan-introduced tests are also green:

```
test_062_active_runs.py::test_returns_streaming_only_filter        PASSED
test_062_active_runs.py::test_returns_response_model_shape         PASSED
test_062_active_runs.py::test_empty_when_no_streaming              PASSED
test_062_active_runs.py::test_malformed_uuid_returns_422           PASSED
test_062_active_runs.py::test_thread_ownership_select_runs_first   PASSED
test_062_cross_user_404.py::test_active_runs_other_user_returns_404 PASSED
```

## Next Plan Readiness

Plan 02 (`GET /runs/{run_id}/stream`) and Plan 03 (`DELETE /runs/{run_id}`) are unblocked:

- The new `app/api/runs.py` module they will create can import `RUN_TASKS`, `TERMINAL_TYPES`, `_emit_terminal`, `_RUN_STATUS_TO_TERMINAL_TYPE` from `app.api.threads` (unchanged from 061 — verified above).
- The `ActiveRunResponse` model file `app/models/run.py` is in place; if Plans 02/03 add additional response models they should be appended to this same file per D-062-14 file-layout discipline.
- The shared cross-user 404 test file `test_062_cross_user_404.py` is in place; Plans 02 + 03 will append `test_stream_other_user_returns_404` and `test_delete_other_user_returns_404` here.

## Self-Check: PASSED

- File `backend/app/models/run.py` exists ✓
- File `backend/app/api/threads.py` modified (45 insertions / 0 deletions) ✓
- File `backend/tests/integration/test_062_active_runs.py` exists with 5 test functions ✓
- File `backend/tests/integration/test_062_cross_user_404.py` exists with `test_active_runs_other_user_returns_404` ✓
- Commit `7534967` exists in `git log` ✓
- Commit `444bc2e` exists in `git log` ✓
- All 6 plan tests GREEN ✓
- 058/059/061 regression sweep GREEN ✓

---

*Phase: 062-replay-tail-api*
*Plan: 01*
*Completed: 2026-05-03*
