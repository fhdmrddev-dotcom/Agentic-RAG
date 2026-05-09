---
phase: 067-frontend-streaming-ux-fix
plan: 03
subsystem: api
tags: [redis, async, sse, exception-handling, asyncio, pytest, caplog, fastapi]

# Dependency graph
requires:
  - phase: 062-stream-replay-tail
    provides: replay_tail_consumer (the async generator whose three xread call sites this plan differentiates)
  - phase: 061-run-backed-streaming-backend
    provides: D-061-03 cooperative cancellation + finally-pass invariant
  - phase: 059-asyncio-queue-bridge
    provides: D-059-04 cooperative cancellation contract (CancelledError must be re-raised)
provides:
  - Differentiated cancellation/timeout/error handlers at all three xread call sites in replay_tail_consumer
  - Module-top RedisTimeoutError import alias (variable-shadowing-safe, Pattern J)
  - backend/tests/api/ test subpackage with first cancellation-differentiation test file
  - BLK-2 closure (VALIDATION.md Wave 0 link satisfied)
affects:
  - phase 067-04 (stopgap env removal — independent worktree)
  - phase 067-05 (live UAT — relies on quiet logs to validate UX-067-04 closure)

# Tech tracking
tech-stack:
  added: [pytest caplog (already part of pytest 7.x — no new install)]
  patterns:
    - "Pattern J: module-top alias `from redis.exceptions import RedisError, TimeoutError as RedisTimeoutError` to dodge Pitfall 2 (variable shadowing on `redis: aioredis.Redis = Depends(get_redis)`)"
    - "Differentiated except-chain priority: CancelledError (re-raise) → narrow timeout (INFO log) → broad RedisError (full traceback). Order matters because narrow IS-A broad."
    - "Test driver via direct generator-driving (not httpx) when an async generator is exported at module level — cleaner than ASGI for unit-scope behavior assertions"
    - "SimpleNamespace settings stub for unit tests when only one attribute (`consumer_timeout_seconds`) is consumed by the function under test"

key-files:
  created:
    - backend/tests/api/__init__.py
    - backend/tests/api/test_runs_cancellation.py
  modified:
    - backend/app/api/runs.py

key-decisions:
  - "D-067-04: differentiate redis.exceptions.TimeoutError (cancellation-equivalent on xread BLOCK — INFO log, no traceback) from genuine RedisError (cluster failover / OOM / connection reset — keep full traceback) at all three xread call sites in replay_tail_consumer"
  - "Symmetric defense per RESEARCH Open Question 4: ALL three xread sites get the differentiated handler chain (replay phase, live-tail phase, post-BLOCK exists probe), not just the live-tail one — tab-cycle interrupts during the probe must not surface a stack trace either"
  - "Test signature deviation (Rule 3, plan-authorized): adapted to actual replay_tail_consumer(redis, run_id, since, settings) — plan notes loosely described (run_id, since, redis); plan's <action> note explicitly authorized adapting"

patterns-established:
  - "Module-top RedisTimeoutError alias is the canonical import shape for any FastAPI route file that uses `redis: aioredis.Redis = Depends(get_redis)` and needs to differentiate redis-py's wrapper-converted timeouts from genuine RedisError"
  - "When an async generator is exported at module level (D-061.1-10 IN-04 lift-to-module), unit tests can drive it directly without going through the ASGI route — cleaner assertion surface for log behavior + yield sequences"

requirements-completed: [STREAM-04-polish]

# Metrics
duration: 9min
completed: 2026-05-07
---

# Phase 067 Plan 03: runs.py xread Cancellation Cleanup Summary

**Differentiated `redis.exceptions.TimeoutError` from genuine `RedisError` at all three xread call sites in `replay_tail_consumer` so backend logs go quiet on browser tab refresh (UX-067-04) without regressing diagnostics for genuine Redis failures.**

## Performance

- **Duration:** ~9 min
- **Started:** 2026-05-07T13:35:46Z
- **Completed:** 2026-05-07T13:44:42Z
- **Tasks:** 3
- **Files modified:** 1 (runs.py)
- **Files created:** 2 (`tests/api/__init__.py`, `tests/api/test_runs_cancellation.py`)

## Accomplishments

- runs.py module-top import now aliases `redis.exceptions.TimeoutError as RedisTimeoutError` (line 48), variable-shadowing-safe per Pattern J
- All three xread call sites in `replay_tail_consumer` differentiate cancellation/timeout/error in priority order:
  - Site 1 (Phase 1 replay xread, line 104): handlers at lines 113-141 — `CancelledError`→raise, `RedisTimeoutError`→INFO log + clean SSE close, `RedisError`→full traceback + clean SSE close
  - Site 2 (Phase 2 live-tail xread, line 187): handlers at lines 194-222 — same shape
  - Site 3 (post-BLOCK exists probe, line 229): handlers at lines 236-261 — same shape PLUS retained `(RedisError, OSError)` tuple for legitimate genuine-failure path (best-effort probe, falls through)
- New `backend/tests/api/` test subpackage created with three monkey-patched cancellation tests (3/3 PASS) — closes BLK-2 (VALIDATION.md Wave 0 link)
- Phase 062 regression suite still green: 5/5 pass on `test_062_redis_down`, `test_062_stream_replay`, `test_062_stream_terminal`

## Task Commits

Each task was committed atomically:

1. **Task 1: Add `RedisTimeoutError` import alias at module top** — `27c0b6c` (feat)
2. **Task 2: Differentiate cancellation/timeout/error handlers at all three xread call sites** — `4c9de8e` (feat)
3. **Task 3: Create monkey-patched cancellation tests at `backend/tests/api/test_runs_cancellation.py` (BLK-2 closure)** — `e0ed4dc` (test)

## Files Created/Modified

- `backend/app/api/runs.py` — Module-top alias import (line 45-48); three differentiated handler chains at xread sites #1 (lines 113-141), #2 (lines 194-222), #3 (lines 236-261). Outer `try/finally: pass` (D-061-03) and inner `for entry_id, fields in entries:` BaseException-wrapper yield loops preserved verbatim per Pitfall 1.
- `backend/tests/api/__init__.py` — package marker for the new subpackage (sibling to `backend/tests/integration/`)
- `backend/tests/api/test_runs_cancellation.py` — three async pytest tests using `caplog` + `AsyncMock` covering CancelledError (re-raised, INFO log, no traceback), RedisTimeoutError (INFO log with canonical substring `consumer disconnected; xread cancellation-equivalent`, sentinel SSE error event yielded), and genuine RedisError ConnectionError (ERROR record with `exc_info` non-None — regression guard for cluster-failover diagnostics)

## D-062-14 File-Layout Sanity Check

`git diff --name-only` against the plan's three commits confirms ONLY `backend/app/api/runs.py`, `backend/tests/api/__init__.py`, and `backend/tests/api/test_runs_cancellation.py` were touched. No edits leaked into `backend/app/api/threads.py` or any other off-limits region. The Phase 062 D-062-14 file-layout discipline is intact.

## Test Results

| Test file | Tests | Outcome |
|---|---|---|
| `tests/api/test_runs_cancellation.py` (new) | 3 | 3/3 PASS |
| `tests/integration/test_062_redis_down.py` | 2 | 2/2 PASS (regression baseline) |
| `tests/integration/test_062_stream_replay.py` | 2 | 2/2 PASS (regression baseline) |
| `tests/integration/test_062_stream_terminal.py` | 1 | 1/1 PASS (regression baseline) |

Combined run (3 new + 5 regression): `8 passed, 1 warning in 3.48s`.

## Decisions Made

- **D-067-04 (recorded in PROJECT.md by orchestrator):** Differentiate `redis.exceptions.TimeoutError` (cancellation-equivalent — caused by `redis-py`'s `async_timeout` wrapper converting `CancelledError` on socket-read) from genuine `RedisError` failures (connection reset, OOM, cluster failover) at the three xread call sites in `replay_tail_consumer`. INFO-only log (no traceback) for `RedisTimeoutError`; keep `logger.exception` for genuine `RedisError`.
- **Symmetric defense at site #3:** Per RESEARCH Open Question 4 recommendation, the post-BLOCK exists probe gets the same differentiated chain even though it's a best-effort probe — a tab-cycle interrupt during the probe should not surface a stack trace either. The `(RedisError, OSError)` tuple is retained as the FINAL clause in the chain for legitimate genuine-failure handling.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Plan-authorized signature adaptation] Test driver passes actual replay_tail_consumer signature**
- **Found during:** Task 3 test authoring
- **Issue:** Plan note describes the function signature as `(run_id: str, since: str, redis: aioredis.Redis)` (three positional args, redis last). The actual signature in `backend/app/api/runs.py:76` is `(redis, run_id: UUID, since: str, settings)` (four positional args, redis FIRST, settings FOURTH).
- **Fix:** Adapted the test calls to `replay_tail_consumer(client, run_id, "0", settings_stub)`. Built a `SimpleNamespace(consumer_timeout_seconds=600)` settings stub since `replay_tail_consumer` only reads `settings.consumer_timeout_seconds` for the deadline computation.
- **Files modified:** `backend/tests/api/test_runs_cancellation.py` (only — no production code touched)
- **Verification:** All 3 tests pass against the actual function signature. Plan's Task 3 `<action>` note explicitly authorized this adaptation: "If the executor finds that `replay_tail_consumer` is NOT importable as `from app.api.runs import replay_tail_consumer` (e.g., it was renamed in Tasks 1+2 — unlikely), they should adapt the import to the actual public symbol used by the route handler. Document any deviation per Rule 3."
- **Committed in:** `e0ed4dc` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (Rule 3 plan-authorized signature adaptation)
**Impact on plan:** Zero scope creep — the adaptation is mechanical and only touches the test file's call shape. Production code in runs.py is unchanged from the plan's specified text.

## Issues Encountered

- **Worktree path resolution gotcha (resolved):** the first attempted edit landed in the main repo's `backend/app/api/runs.py` instead of the worktree's. Reverted main repo (`git checkout -- backend/app/api/runs.py`) and re-applied to the worktree's absolute path. No commits were affected — the issue was caught before staging. All three task commits land cleanly on `worktree-agent-a1091ae5afdb19494`.
- **No venv in worktree (resolved):** the worktree does not contain its own Python venv. Used the main repo's venv at `C:/Vibe Apps/Agentic RAG/backend/venv/Scripts/python.exe` with `PYTHONPATH=$(pwd)` and the four pydantic-settings env vars (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `LLM_API_KEY`, `LANGSMITH_TRACING`) set inline at invocation time. Mirrors the env-var bootstrap pattern in `backend/tests/conftest.py`.

## User Setup Required

None — no external service configuration required. Pure refactor of in-process exception handling + new test file.

## Self-Check: PASSED

- `backend/app/api/runs.py` line 48 contains `from redis.exceptions import RedisError, TimeoutError as RedisTimeoutError` — VERIFIED
- 3× `except asyncio.CancelledError` clauses in runs.py, each followed by `raise` — VERIFIED via Read at lines 113-122, 194-201, 236-246
- 3× `except RedisTimeoutError` clauses in runs.py — VERIFIED via grep
- 3× canonical INFO substring `consumer disconnected; xread cancellation-equivalent` — VERIFIED via grep
- `except (RedisError, OSError):` tuple still present at site #3 — VERIFIED via grep
- Outer `try/finally: pass` (D-061-03) preserved at end of replay_tail_consumer — VERIFIED via grep
- `backend/tests/api/__init__.py` exists — VERIFIED
- `backend/tests/api/test_runs_cancellation.py` exists with 3 test functions — VERIFIED
- All 3 new tests pass against post-Tasks-1+2 source — VERIFIED
- 5 Phase 062 regression tests pass — VERIFIED
- Commits exist: `27c0b6c`, `4c9de8e`, `e0ed4dc` — VERIFIED via `git log --oneline`

## Next Phase Readiness

- BLK-2 closed: VALIDATION.md Wave 0 row for `backend/tests/api/test_runs_cancellation.py` is now satisfied
- UX-067-04 backend half complete: tab-cycle on a long-running run no longer triggers `redis.exceptions.TimeoutError` traceback dumps in `uvicorn` stdout. INFO-level structured log line carries `run_id` for traceability.
- Plan 05's live UAT (Chrome MCP open `/`, refresh during stream, observe backend logs) can now assert presence of one INFO `consumer disconnected` line and absence of any `Traceback (most recent call last):` block from runs.py xread call sites.
- Plans 01, 02, 04 in Phase 067 are independent of this work — they execute in parallel worktrees per the wave plan.

---
*Phase: 067-frontend-streaming-ux-fix*
*Plan: 03 (runs-xread-cancellation-cleanup)*
*Completed: 2026-05-07*
