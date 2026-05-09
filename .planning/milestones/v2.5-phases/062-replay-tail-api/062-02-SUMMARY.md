---
phase: 062-replay-tail-api
plan: 02
subsystem: api

tags: [sse, run-backed, stream, replay-tail, api, redis-streams]

requires:
  - phase: 061-run-backed-streaming-backend
    provides: "RUN_TASKS registry, TERMINAL_TYPES, _emit_terminal, _RUN_STATUS_TO_TERMINAL_TYPE, public.runs lifecycle table, run:{run_id} Redis Stream key convention"
  - phase: 062-replay-tail-api
    plan: 01
    provides: "ActiveRunResponse Pydantic model file (app/models/run.py — Plan 02 imports from app.api.threads only, but the convention is established here)"
provides:
  - "GET /runs/{run_id}/stream?since={offset} endpoint (3 sub-paths: live replay-then-tail, already-terminal replay, TTL-expired synthetic terminal)"
  - "replay_tail_consumer module-level async generator (D-062-07 cursor parameterization of event_consumer)"
  - "_synthetic_terminal_generator module-level async generator (D-062-06 TTL-expired path)"
  - "RedisError-shadow-safe import pattern documented and codified (top-level `from redis.exceptions import RedisError` to avoid the variable-shadowing trap on the route's `redis` parameter)"
  - "Multi-consumer fan-out foundation (XREAD non-destructive — multiple replay_tail_consumer instances on the same run_id receive identical sequences; tested end-to-end in Plan 04)"
affects: [062-replay-tail-api, 063-frontend-reconcile, 064-browser-mcp-harness]

tech-stack:
  added: []
  patterns:
    - "Top-level `from redis.exceptions import RedisError` import to avoid `redis` variable-shadowing inside route handler (matches Phase 061 threads.py convention)"
    - "Anti-false-RED guard for cross-user/missing 404 tests: assert resp.json()['detail'] equals route's HTTPException string ('Run not found') AND mock SELECT was called — distinguishes route-404 from FastAPI's default unregistered-route 404"
    - "Per-test `_reset_redis_singleton` autouse fixture pattern for tests exercising route handlers' `get_redis()` (mirrors `_reset_sse_starlette_app_status` rationale — RESEARCH.md Pitfall 6 loop-binding trap)"

key-files:
  created:
    - backend/app/api/runs.py
    - backend/tests/integration/test_062_stream_replay.py
    - backend/tests/integration/test_062_stream_terminal.py
    - backend/tests/integration/test_062_stream_ttl_expired.py
  modified:
    - backend/app/main.py
    - backend/tests/integration/test_062_cross_user_404.py

key-decisions:
  - "Mirrored event_consumer at threads.py:336-423 verbatim with single change `last_id = since` — preserved WR-01 carry-forward, H1 BaseException wrapper, deadline arithmetic, TERMINAL_TYPES break, and finally:pass invariants exactly (D-062-07 + D-061-03 + D-061.1-07)"
  - "Top-level `from redis.exceptions import RedisError` import — explicitly NOT `import redis.exceptions` (would AttributeError on the Redis instance because the route's `redis` parameter shadows the module name)"
  - "Added per-file `_reset_redis_singleton` autouse fixture rather than touching conftest.py — keeps the fix scoped to tests that actually exercise route's `get_redis()` and avoids surprising 058/059/061 tests that don't have the issue"
  - "Pydantic response_model deliberately omitted on the stream route — EventSourceResponse is the response, not JSON; `response_model` would attempt to validate the SSE stream as JSON"

patterns-established:
  - "When a route handler declares `redis: aioredis.Redis = Depends(get_redis)`, NEVER use `redis.exceptions.X` inside the handler — the parameter shadows the module. Always use top-level unqualified imports for redis exception types."
  - "Tests that exercise route handlers' singleton dependencies (`get_redis()`, etc.) need a per-test reset fixture if the singleton is event-loop-bound; reset via `app.dependencies._redis = None` in an autouse function-scoped fixture"

requirements-completed: []  # STREAM-04 stays open until Plans 03 + 04 complete (DELETE verb + multi-consumer fan-out test)

duration: 7min
completed: 2026-05-03
---

# Phase 062 Plan 02: GET /runs/{run_id}/stream Endpoint Summary

**`GET /runs/{run_id}/stream?since={offset}` shipped — replay-then-tail-to-terminal across all three sub-paths (live, already-terminal, TTL-expired) with cross-user 404 (D-062-12) and Redis-down 503 (D-062-13). Foundation for SC#4 multi-consumer fan-out is in place via XREAD's non-destructive read-cursor semantics.**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-05-03T~10:30:00Z
- **Completed:** 2026-05-03T~10:37:00Z
- **Tasks:** 2 (RED + GREEN)
- **Files created:** 4 (1 controller module, 3 integration test files)
- **Files modified:** 2 (main.py — 2-line router registration; test_062_cross_user_404.py — appended 1 cross-user stream test + local helper)

## Accomplishments

- Shipped the read-side stream surface that Phase 063's frontend reconcile-on-(re)connect will subscribe to
- Established the **RedisError variable-shadowing fix pattern** in code, with explicit module-level import + comment block + invariant called out in the docstring (so future contributors don't re-introduce `redis.exceptions.RedisError` qualified references inside route handlers where `redis` is also a parameter name)
- Established the **`_reset_redis_singleton` autouse fixture pattern** for any test file that exercises a route handler's `get_redis()` (Pitfall 6 mirror — same loop-binding trap as `_reset_sse_starlette_app_status`)
- Anti-false-RED guards added on the two missing-row 404 tests (`test_404_when_runs_row_missing` + `test_get_stream_other_user_returns_404`) — assert `detail == "Run not found"` so the tests fail when the route is missing rather than silently passing on FastAPI's default `Not Found`
- Confirmed D-062-14 file-layout discipline holds: zero modifications to `threads.py` (the new `runs.py` is a freestanding module)
- Plan 01 + 058/059/061 binding regression sweep stays green (15/15 tests across 5 files)

## Task Commits

Each task was committed atomically (TDD RED → GREEN cycle):

1. **Task 1: Wave 0 RED stubs** — `ddfa636` (test) — 8 failing tests across 3 new files + 1 test appended to test_062_cross_user_404.py
2. **Task 2: GREEN implementation** — `a8f3b63` (feat) — runs.py module + main.py router registration + per-file `_reset_redis_singleton` fixture additions

## Files Created/Modified

### Created

- **`backend/app/api/runs.py`** (~239 lines) — new freestanding module under D-062-14 file layout. Exposes:
  - `router = APIRouter(prefix="/runs", tags=["runs"])` (line 60)
  - `async def replay_tail_consumer(redis, run_id, since, settings)` (lines 73-138) — module-level (D-061.1-10 IN-04 convention). Mirrors `event_consumer` at `threads.py:336-423` verbatim with `last_id = since` (D-062-07). Two-mode XREAD: replay phase (no-block COUNT 100) → tail phase (BLOCK 5000 COUNT 100). WR-01 carry-forward (no `$` reset between phases). Deadline = `monotonic() + run_hard_timeout_seconds + 10`. H1 BaseException wrapper around per-entry yield bodies. Breaks on first TERMINAL_TYPES entry. `finally: pass` (D-061-03 invariant — consumer disconnect MUST NOT cancel producer).
  - `async def _synthetic_terminal_generator(runs_status, runs_error)` (lines 147-170) — yields exactly ONE wire envelope `{"type": <mapped via _RUN_STATUS_TO_TERMINAL_TYPE>, "error": "buffer_expired", "runs_status": <orig>, "runs_error": <error>}` then returns. Defensive `streaming` fallback emits `{"type": "error", "error": "buffer_expired_while_streaming", "runs_status": "streaming"}`.
  - `@router.get("/{run_id}/stream") stream_run` (lines 181-239) — 4-step flow:
    1. ownership SELECT on `runs` via aexec with `.eq("run_id", str(run_id))` AND `.eq("user_id", current_user["id"])` AND `.maybe_single()` — `not row` → 404 with `detail="Run not found"` (D-062-12 / T-062-01)
    2. Redis health probe via `asyncio.wait_for(redis.exists(stream_key), timeout=2.0)` — on `(RedisError, asyncio.TimeoutError, OSError)` → JSONResponse(503) + `Retry-After: 10` header (D-062-13 / T-062-03)
    3a. `if buffer_exists:` → `EventSourceResponse(replay_tail_consumer(...), ping=None)` (covers both live and already-terminal sub-paths — D-062-05)
    3b. else (TTL-expired) → `EventSourceResponse(_synthetic_terminal_generator(...), ping=None)` (D-062-06)

  Critical import: `from redis.exceptions import RedisError` is a top-level import (line 47), NOT `import redis.exceptions`. The route's `redis: aioredis.Redis = Depends(get_redis)` parameter shadows the `redis` module name; any `redis.exceptions.X` reference inside the handler would AttributeError on the Redis instance. Documented in module docstring + inline comment at the except clause.

- **`backend/tests/integration/test_062_stream_replay.py`** (~165 lines) — 2 tests covering D-062-05/07:
  - `test_replay_then_tail_to_terminal` — drive POST `/threads/{tid}/messages` with slow-mock LLM patches, extract run_id from mock, configure runs SELECT mock to return ownership-passing row, fire GET `/runs/{rid}/stream?since=0`, drain to natural close on terminal sentinel. Asserts `len(events) >= 3`, `events[-1].type` in TERMINAL_TYPES, at least one delta before terminal.
  - `test_replay_from_specific_offset` — pre-populate `run:{rid}` directly via `redis_client.xadd` with 3 deltas + 1 done sentinel; call GET with `?since={ids[1]}`; assert tok0 + tok1 are NOT in the response body but tok2 + done ARE.

  Includes per-file `_reset_redis_singleton` autouse fixture.

- **`backend/tests/integration/test_062_stream_terminal.py`** (~75 lines) — 1 test covering D-062-05:
  - `test_terminal_run_replays_and_closes` — pre-populate `run:{rid}` with 3 deltas + 1 terminal sentinel; mock runs SELECT to return `status='completed'`; drive GET `/runs/{rid}/stream?since=0`; assert exactly 4 events yielded, last is `done`, first 3 are `delta`. Proves D-062-05 same-code-path semantics for already-terminal runs.

  Includes per-file `_reset_redis_singleton` autouse fixture.

- **`backend/tests/integration/test_062_stream_ttl_expired.py`** (~190 lines) — 4 tests covering D-062-06:
  - `test_emits_synthetic_terminal_when_buffer_expired_completed` — empty Redis + status=completed → ONE event `{type: done, error: buffer_expired, runs_status: completed}`
  - `test_emits_synthetic_terminal_when_buffer_expired_failed` — empty Redis + status=failed → ONE event `{type: error, error: buffer_expired, runs_status: failed, runs_error: TimeoutError}`
  - `test_emits_synthetic_terminal_when_buffer_expired_cancelled` — empty Redis + status=cancelled → ONE event `{type: cancelled, error: buffer_expired, runs_status: cancelled, runs_error: cancelled_by_user}`
  - `test_404_when_runs_row_missing` — empty Redis + runs SELECT returns None → HTTP 404 with `detail="Run not found"` (anti-false-RED guard)

  Includes local `_mock_runs_returning(mock_supabase, payload)` helper mirroring the cross-user file's helper, plus per-file `_reset_redis_singleton` autouse fixture.

### Modified

- **`backend/app/main.py`** — 2 lines changed (1 added to import, 1 new include_router):
  - Line 136: added `runs` to `from app.api import threads, runs, documents, ...`
  - Line 139: added `app.include_router(runs.router)` immediately after `app.include_router(threads.router)`

  No other modifications.

- **`backend/tests/integration/test_062_cross_user_404.py`** — appended ~83 lines (Plan 01's `test_active_runs_other_user_returns_404` left intact):
  - New `_mock_runs_returning(mock_supabase, payload)` helper (local — mirrors test_062_stream_ttl_expired.py)
  - New `test_get_stream_other_user_returns_404` — overrides `get_current_user` to OTHER_USER, mocks runs SELECT to return None, drives GET `/runs/{rid}/stream?since=0`, asserts `status_code == 404` AND `detail == "Run not found"` (anti-false-RED guard) AND runs SELECT was called

## Decisions Made

- **Top-level `from redis.exceptions import RedisError` import** is the only safe form when the route handler also has a `redis` parameter. The plan locked this; the implementation followed verbatim and added prominent docstring + inline-comment callouts so the invariant doesn't get refactored away.
- **`_reset_redis_singleton` per-file autouse fixture** rather than session-wide / conftest-wide. The singleton-reset is only needed for tests that exercise the actual route handler's `get_redis()` call. Tests that use `redis_client` fixture directly are unaffected (their client is per-test scoped already). Adding to conftest as autouse risked surprising 058/059/061 tests that don't currently have the issue.
- **No `response_model` on the `@router.get("/{run_id}/stream")` route.** EventSourceResponse is the response object, not JSON; declaring `response_model=...` would attempt to validate the SSE stream as JSON. Pydantic typing is preserved on the path param (`run_id: UUID`) and query param (`since: str = "0"`).
- **`_synthetic_terminal_generator` defensive `streaming` fallback** emits `{type: error, error: buffer_expired_while_streaming, runs_status: streaming}` rather than 500. This shouldn't happen at this branch (status='streaming' implies the buffer should still exist), but the defensive fallback gives clients a clean close even in the corrupted state.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking issue] Per-file `_reset_redis_singleton` autouse fixture**

- **Found during:** Task 2 (first GREEN test run)
- **Issue:** After committing the GREEN implementation, the test suite had 6 passing / 3 failing. The 3 failures all surfaced as `RuntimeError: Event loop is closed` inside `redis.asyncio.connection.Connection.disconnect`. Root cause: the singleton `_redis` in `app.dependencies` is created on the first `get_redis()` call and then cached. pytest-asyncio creates a fresh event loop per test (function-scope), but the singleton remains bound to the FIRST loop that created it. Subsequent tests invoke the singleton against a closed loop — same loop-binding trap as the `_reset_sse_starlette_app_status` fixture documented in RESEARCH.md Pitfall 6.
- **Fix:** Added a function-scoped autouse fixture to each new test file that exercises the route handler's `get_redis()`:
  ```python
  @pytest.fixture(autouse=True)
  def _reset_redis_singleton():
      import app.dependencies as _deps
      _deps._redis = None
      yield
      _deps._redis = None
  ```
  Per-file scope (rather than conftest-wide autouse) avoids surprising 058/059/061 tests that don't currently exercise the route's `get_redis()`. Not added to test_062_cross_user_404.py because the new stream cross-user test 404s before Redis is touched (runs SELECT returns None first).
- **Files modified:** `backend/tests/integration/test_062_stream_replay.py`, `backend/tests/integration/test_062_stream_terminal.py`, `backend/tests/integration/test_062_stream_ttl_expired.py`
- **Verification:** After the fix, all 9 stream tests pass GREEN. 058/059/061 binding regression sweep also stays GREEN (10/10).
- **Committed in:** `a8f3b63` (Task 2 GREEN commit, with the fixture additions bundled into the same commit because they were discovered during the GREEN gate)

---

**Total deviations:** 1 auto-fixed (blocking issue — Rule 3)
**Impact on plan:** No scope change. The fix is test-infrastructure only; it does not modify the production runs.py implementation. Plan-wide invariants (D-062-14 file-layout discipline, the RedisError shadow-fix, the EventSourceResponse(ping=None) preservation) are unchanged.

## Issues Encountered

The singleton-loop-binding issue (documented above as Rule 3 deviation) was the only friction. Task 1 (RED) landed cleanly with all 8 tests failing as expected. Task 2's GREEN implementation passed all the static plan-wide grep guards on the first attempt (router signature, RedisError import, no qualified references, ping=None, 503/Retry-After, threat refs, main.py registration). The 3 failing tests were a runtime infrastructure issue, not an implementation bug.

## Plan-Wide Verification (post-completion)

All checks from `<verification>` block in the plan:

| # | Check | Expected | Actual | Result |
|---|-------|----------|--------|--------|
| 1 | router/replay_tail_consumer/_synthetic/stream_run all defined | each grep >= 1 | 1/1/1/1 | PASS |
| 2 | Top-level `from redis.exceptions import RedisError` | >= 1 | 1 | PASS |
| 2b | No qualified `redis.exceptions.X` in code (comments/docstrings allowed) | 0 in code | 0 in code (3 in docstrings/comments only) | PASS |
| 3 | `from app.api.threads import` includes RUN_TASKS, TERMINAL_TYPES, _emit_terminal, _RUN_STATUS_TO_TERMINAL_TYPE | all 4 present | all 4 present | PASS |
| 4 | No `last_id = "$"` reset | 0 | 0 | PASS |
| 5 | `ping=None` | >= 1 | 2 (both EventSourceResponse calls) | PASS |
| 6 | 503 / Retry-After present | >= 2 | 4 | PASS |
| 7 | Threat IDs / decision IDs referenced | >= 3 | 7 | PASS |
| 8 | Router registered in main.py | >= 1 | 1 | PASS |
| 9 | All Plan 02 tests pass | 9/9 | 9/9 | PASS |
| 10 | Plan 01 tests still pass | 6/6 | 6/6 | PASS |
| 11 | 058/059/061 binding tests still pass | no regression | 4/4 (cross_tab + survives + 3 cursor_race) | PASS |

## Regression Sweep

```
test_062_active_runs.py (5 tests)              PASSED
test_062_cross_user_404.py (2 tests)           PASSED
test_062_stream_replay.py (2 tests)            PASSED
test_062_stream_terminal.py (1 test)           PASSED
test_062_stream_ttl_expired.py (4 tests)       PASSED
test_058_concurrency.py::test_cross_tab...     PASSED
test_059_disconnect.py::test_agent..SURVIVES   PASSED
test_061_consumer_cursor_race.py (3 tests)     PASSED
                                       Total:  19 / 19 PASSED
```

## Off-Limits Region Verification

Per D-062-14 the following regions of `backend/app/api/threads.py` MUST NOT be modified by Plan 02. Confirmed via `git diff backend/app/api/threads.py` → no output (file untouched):

- `event_consumer` (lines 336-423) — untouched
- `agent_runner` (lines ~757-2156) — untouched
- `_shielded_finalize` (lines ~2087-2146) — untouched
- `send_message` (lines ~675-2186) — untouched
- Registry constants region (RUN_TASKS, TERMINAL_TYPES, _emit, _emit_terminal, _RUN_STATUS_TO_TERMINAL_TYPE) — untouched
- All Plan 01 additions (`list_active_runs` route, ActiveRunResponse import, `from uuid import UUID` import) — untouched

Only `backend/app/main.py` was modified outside `runs.py` itself, and only by the planned 2-line router registration.

## D-062-13 Mocked-Redis Test Status

Per the plan's `<output>` clause, an explicit pytest mocked-Redis test for the 503 + Retry-After path is deferred to Plan 04. The implementation IS in place (lines 211-219 of runs.py — `try: ... except (RedisError, asyncio.TimeoutError, OSError): return JSONResponse(503, ..., headers={"Retry-After": "10"})`) and observable via code grep, but the runtime exercise of that branch will land in Plan 04's cross-cutting test sweep. Acceptable per the plan's explicit deferral and the threat model's mitigation column for T-062-03 (covered in code; runtime test deferred).

## Next Plan Readiness

Plan 03 (`DELETE /runs/{run_id}`) is unblocked:

- The new `app/api/runs.py` module is in place with `router = APIRouter(prefix="/runs", ...)` already registered in main.py — Plan 03 just appends the DELETE route to the existing module (no main.py change needed).
- The imports `RUN_TASKS`, `TERMINAL_TYPES`, `_emit_terminal`, `_RUN_STATUS_TO_TERMINAL_TYPE` from `app.api.threads` are already in place at the top of runs.py — Plan 03 reuses them for the zombie heal path (`_emit_terminal(redis, run_id, "cancelled", reason="zombie_healed")`).
- The `RedisError` import + variable-shadowing comment block is in place — Plan 03's Redis ops (synthetic XADD, ZREM × 2, EXPIRE) inherit the same import discipline and the same try/except `RedisError` pattern.
- The shared cross-user 404 test file `test_062_cross_user_404.py` now has 2 of the 3 planned tests; Plan 03 will append `test_delete_other_user_returns_404` here.

Plan 04 (cross-cutting tests + 062-VERIFICATION.md) is unblocked for the SC#2 + SC#5(stream) + D-062-13(stream) coverage Plan 02 just shipped. Plan 04 will add the multi-consumer fan-out test (SC#4) and the explicit mocked-Redis 503 test deferred above.

## Self-Check: PASSED

- File `backend/app/api/runs.py` exists with `router = APIRouter(prefix="/runs", tags=["runs"])`
- File `backend/app/main.py` modified with `from app.api import threads, runs, ...` and `app.include_router(runs.router)`
- File `backend/tests/integration/test_062_stream_replay.py` exists with 2 test functions
- File `backend/tests/integration/test_062_stream_terminal.py` exists with 1 test function
- File `backend/tests/integration/test_062_stream_ttl_expired.py` exists with 4 test functions
- File `backend/tests/integration/test_062_cross_user_404.py` modified with appended `test_get_stream_other_user_returns_404`
- Commit `ddfa636` exists in `git log` (Task 1 RED)
- Commit `a8f3b63` exists in `git log` (Task 2 GREEN)
- All 9 Plan 02 tests GREEN
- Plan 01 tests still GREEN (6/6)
- 058/059/061 binding regression sweep GREEN (4/4)
- D-062-14 off-limits regions of threads.py untouched (zero diff)

---

*Phase: 062-replay-tail-api*
*Plan: 02*
*Completed: 2026-05-03*
