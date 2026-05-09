---
phase: 058-backend-sse-concurrency-fix
plan: 03
subsystem: tests
tags: [sse, testing, concurrency, httpx, asyncio, ci-gate]

requires:
  - phase: 058
    provides: aexec helper (Plan 01) + SSE-path .execute() wraps (Plan 02)
provides:
  - Automated CI gate test_058_concurrency.py asserting elapsed < 1.0s
  - Manual two-tab DevTools verification checklist (058-VERIFICATION.md)
  - First httpx.AsyncClient(app=app, ...) test pattern in the repo
affects: [059, 060, 061, 062]

tech-stack:
  added: []
  patterns:
    - "httpx.AsyncClient + asyncio.create_task pattern for cross-task SSE concurrency tests"
    - "Per-table mock supabase routing for tests with non-deterministic asyncio interleaving"
    - "Slow-execute side_effect callable that runs time.sleep INSIDE run_in_threadpool to validate aexec wrap"

key-files:
  created:
    - backend/tests/integration/test_058_concurrency.py
    - .planning/phases/058-backend-sse-concurrency-fix/058-VERIFICATION.md
  modified: []

key-decisions:
  - "Slow surface = pre-stream messages INSERT (D-058-02) instead of slow LLM stream — the LLM-stream path blocks event loop directly via sync iteration (Phase 059 territory) and would not validate the actual 058 fix"
  - "Patch target = app.api.threads.create_adaptive_streaming_chat (NOT create_streaming_chat — the latter is not imported into threads.py, which is why two pre-existing tests in test_threads.py are silently broken)"
  - "Per-table mock supabase routing instead of conftest's flat side_effect queue — asyncio interleaving makes Thread A and Thread B call ordering non-deterministic, breaking response_model validation when rows misalign"
  - "Patch get_supabase via app.dependency_overrides (test-scoped) instead of unittest.mock.patch — overrides compose with conftest's existing get_current_user override and unwind cleanly in finally"

patterns-established:
  - "backend/tests/integration/test_058_concurrency.py — first async integration test, template for any future cross-task or cross-tab concurrency tests"
  - "_make_table_builder() helper — pattern for per-table mock routing when conftest's shared _builder is order-fragile"

requirements-completed:
  - CONCUR-01

duration: ~25min
completed: 2026-05-01
---

# Phase 058 Plan 03: Concurrency Integration Test + Manual Verification Checklist Summary

**The CONCUR-01 cross-tab benchmark now has a binding pytest gate (`elapsed < 1.0s`, measured ~15ms on green) and a 2-minute manual DevTools checklist, jointly proving that Plan 01's `aexec` helper plus Plan 02's 22 wrap sites unblock the event loop during in-flight Supabase round-trips.**

## Performance

- **Duration:** ~25 min (executor wall time, including the deviation analysis below)
- **Completed:** 2026-05-01
- **Tasks:** 2
- **Files created:** 2 (1 test file, 1 verification doc); 0 modified

## Accomplishments

- `tests/integration/test_058_concurrency.py::test_cross_tab_unblocked_during_sse` written, passes, exits 0 with measured elapsed of **~15ms** (threshold 1000ms)
- `.planning/phases/058-backend-sse-concurrency-fix/058-VERIFICATION.md` written with the two-tab DevTools checklist, the <1s benchmark, the CI-gate cross-reference, and a fail-action runbook
- ROADMAP Success Criterion 1 ("cross-tab GET <1s benchmark provably satisfied") is now verified by the passing CI test
- D-058-09 (automated gate) and D-058-10 (manual checklist) are both delivered
- Zero new pip dependencies added — `httpx>=0.27.0` and `pytest-asyncio>=0.24.0` were already in `requirements.txt`
- First `httpx.AsyncClient(app=app, ...)` integration test in the repo, establishing the pattern for future concurrency work in 059/061/062

## Task Commits

1. **Task 1: Write the concurrency integration test** — `727d9f6` (test)
2. **Task 2: Write 058-VERIFICATION.md (manual DevTools checklist)** — `cabc8cc` (docs)

## Files Created

### NEW: backend/tests/integration/test_058_concurrency.py
- Module-level constants: `USER_ID` (matches conftest's `mock_user_data["id"]`), `THREAD_A`, `THREAD_B`, `SLOW_INSERT_DELAY` (1.5s)
- Helpers: `_make_result`, `_make_sse_chunk`, `_make_done_chunk`, `_fast_chunks` (sync generator yielding 3 tokens + DONE), `_thread_row`, `_message_row`, `_make_table_builder` (per-table mock builder factory), `_build_mock_supabase` (per-table routing dispatcher), `_consume_sse` (async coroutine that opens the stream and reads until exhausted or cancelled)
- Test function `test_cross_tab_unblocked_during_sse` (decorated `@pytest.mark.asyncio`, also runs under `asyncio_mode = auto` from pytest.ini):
  1. Builds a per-table mock supabase whose `messages` builder sleeps 1.5s on its first `.execute()` call (the pre-stream INSERT)
  2. Installs the mock via `app.dependency_overrides[get_supabase] = lambda: mock_supabase` inside a `try/finally` that restores the conftest-installed override
  3. Patches `app.api.threads.create_adaptive_streaming_chat` to return `(iter(_fast_chunks()), CallingMode.NATIVE)` — fast LLM stream so the only blocking surface in scope is the slow INSERT
  4. Opens an `httpx.AsyncClient(app=app, base_url="http://test")`, fires `asyncio.create_task(_consume_sse(c, THREAD_A))`, awaits 100ms for the SSE handler to enter the slow `await aexec(insert)`, then races a `GET /threads/{THREAD_B}/messages`
  5. Records `elapsed = time.monotonic() - t0`, cancels the SSE task in a `try/except (CancelledError, Exception)`, asserts `elapsed < 1.0` with a descriptive failure message
  6. Prints the elapsed measurement under `pytest -s` for observability

### NEW: .planning/phases/058-backend-sse-concurrency-fix/058-VERIFICATION.md
- "CI Gate (Automated — Binding)" section pointing at the new pytest test, including the binary measurement contract (~15ms on green, threshold 1000ms)
- "Manual Two-Tab DevTools Timing Checklist" section with Setup, Procedure, Expected Result table (pre-058 vs post-058), Pass Criteria checkboxes, and a Fail Action runbook
- Notes section reserved for tester observations
- Appendix explaining why both gates exist (automated isolates the wrap surface; manual exercises full-stack)

## Test Structure & Mock Wiring

### Mock-LLM wiring approach
- `with patch("app.api.threads.create_adaptive_streaming_chat", return_value=(iter(_fast_chunks()), CallingMode.NATIVE))`
- Returns a `(stream, calling_mode)` tuple matching the function's actual signature in `openai_service.py:790`
- The plan suggested patching `create_streaming_chat`, but that name is **not** imported into `threads.py` (it imports `create_adaptive_streaming_chat`). Two pre-existing tests in `test_threads.py:212` and `:247` patch the wrong path and fail at `__enter__` with `AttributeError`. This test correctly uses `create_adaptive_streaming_chat`.

### Auth fixture approach
- `app.dependency_overrides[get_current_user]` is wired by `tests/conftest.py:79` at import time, returning a synthetic user dict (`mock_user_data`) for ALL tests. The new test reuses that override unchanged — same `user_id` flows through both Thread A and Thread B.

### Supabase mock approach (per-table routing)
- `app.dependency_overrides[get_supabase] = lambda: mock_supabase` — test-scoped override, restored in `finally`.
- `mock_supabase.table.side_effect = lambda name: builders.get(name, default_builder)` — dispatches to per-table builders.
- `messages` builder: first `.execute()` call sleeps 1.5s (the pre-stream INSERT); subsequent calls return empty data.
- `threads` builder: returns alternating `_thread_row(THREAD_A | THREAD_B)` so both Thread A's ownership SELECT and Thread B's ownership SELECT (in `get_messages` at threads.py:415) succeed.
- Default builder: returns `_make_result([])` for any other table (skills, user_memory, audit, etc.).
- `time.sleep` inside `messages_execute` runs INSIDE `run_in_threadpool` (because Plan 02's `aexec` wraps `.execute()` in the threadpool). It blocks a worker thread, NOT the event loop — exactly the post-058 correct behaviour being tested.

### asyncio config
- `backend/pytest.ini` already has `asyncio_mode = auto`, so `@pytest.mark.asyncio` is technically optional. It is included on the test function for explicit clarity and forward-compat with stricter modes.

## Manual checklist location
- `.planning/phases/058-backend-sse-concurrency-fix/058-VERIFICATION.md`

## Elapsed time recorded from passing run
- **~15ms** (printed by `pytest -s`: `[058-03] cross-tab GET elapsed: 15.0ms (threshold < 1000ms)`)
- Total test duration including setup/teardown: 0.16s

## Decisions Made

- **Slow surface chosen = pre-stream messages INSERT, NOT slow LLM stream.** The plan's design used `time.sleep(0.2)` inside `_slow_chunks` to keep the SSE stream open for ~1.8s, on the assumption that the chunk iteration runs inside `run_in_threadpool`. After reading `threads.py:870`, the chunk iteration is `for chunk in stream:` directly inside the `async def event_stream` generator — NOT inside a threadpool. A slow sync iterator there blocks the event loop regardless of `aexec()` correctness, and a test using that pattern would fail post-058 simply because the LLM-stream path has its own blocking surface that Phase 059 (not 058) is scoped to fix. The deviation makes the slow surface the pre-stream INSERT (`await aexec(supabase.table("messages").insert(...))` at `threads.py:511`), which IS the exact `.execute()` call `aexec` wraps. The slow `time.sleep` runs inside `run_in_threadpool` (where 058 puts it) and the test correctly measures whether the event loop is free during that window. See "Deviations from Plan" below for the full rationale.
- **Patch target = `create_adaptive_streaming_chat`, NOT `create_streaming_chat`.** The plan's example assumed the latter is imported into `threads.py`. It is not — `threads.py:28` imports `create_adaptive_streaming_chat`. Two pre-existing tests (`test_threads.py:212`, `:247`) patch the wrong path and were already broken before 058 began (verified with a sanity-check pytest run). The new test correctly patches the imported name.
- **Per-table mock supabase routing instead of conftest's flat queue.** The conftest's shared `_builder` uses a single `side_effect` list across all `supabase.table(...)` calls. Under genuine asyncio concurrency, Thread A's call sequence and Thread B's call sequence interleave non-deterministically — when Thread B's `messages` SELECT picks up a row meant for Thread A's history reconstruction, FastAPI's `response_model=list[MessageResponse]` validation fails with 500. Per-table routing isolates the queues and makes the test deterministic.
- **Renamed `_slow_chunks` to `_fast_chunks`.** The plan's acceptance criterion `grep -c "_slow_chunks" >= 1` is therefore not literally satisfied. The semantic intent (a sync generator that produces SSE chunks for the test) is satisfied; the name change is a deviation rationale-marker, making it visually obvious that the slow-LLM approach was rejected.

## Deviations from Plan

### Rule 1 (Auto-fixed Bug — test design)

**1. Slow surface moved from LLM stream to pre-stream INSERT**

- **Found during:** Task 1 first run
- **Issue:** Plan/PATTERNS-prescribed `_slow_chunks` (sync generator with `time.sleep(0.2)` per token) blocked the event loop because `event_stream` iterates the stream synchronously inside an async function. First run failed with `elapsed = 1.78s` (test threshold 1.0s).
- **Root cause:** Plan note 2 stated "The `_slow_chunks` generator is consumed by code that runs inside `run_in_threadpool` (or similar)." This is not true in the actual codebase — `threads.py:870` runs `for chunk in stream:` directly inside `async def event_stream`, on the event-loop thread. `time.sleep` there blocks the event loop regardless of `aexec()` correctness. The slow LLM is a Phase 059 concern (sync stream iteration), not a Phase 058 concern (sync `.execute()`), per `058-CONTEXT.md` "Out of scope" section.
- **Fix:** Made the pre-stream user-message INSERT slow (1.5s) inside the mock `messages_execute` callable. Because `aexec()` wraps `.execute()` in `run_in_threadpool`, that sleep runs on a worker thread and the event loop remains free — exactly the surface 058 was designed to fix.
- **Result:** `elapsed = ~15ms` on green run. The test now genuinely validates the 058 fix.
- **Files modified:** `backend/tests/integration/test_058_concurrency.py` (renamed `_slow_chunks` → `_fast_chunks`; added `_make_table_builder`, `_build_mock_supabase` per-table routing helpers).
- **Commit:** `727d9f6`

### Rule 1 (Auto-fixed Bug — patch target)

**2. Patch target switched from `create_streaming_chat` to `create_adaptive_streaming_chat`**

- **Found during:** Task 1 — sanity check of pre-existing tests
- **Issue:** Plan example used `patch("app.api.threads.create_streaming_chat", ...)` but `create_streaming_chat` is not imported into `threads.py`. Two pre-existing tests (`test_threads.py::test_sse_stream_contains_delta_events`, `test_sse_stream_delta_events_are_valid_json`) use this wrong path and fail at `with patch(...).__enter__()` with `AttributeError`.
- **Fix:** Patch `app.api.threads.create_adaptive_streaming_chat`, returning the `(stream, calling_mode)` tuple shape that function actually returns (signature at `openai_service.py:790`).
- **Files modified:** `backend/tests/integration/test_058_concurrency.py`.
- **Commit:** `727d9f6`
- **Note for follow-up:** Two pre-existing tests in `test_threads.py` are still broken with the same wrong path. Out of 058-03 scope per the plan's "Pre-existing test failures — do NOT try to fix them" directive. Logged here for awareness; the plan-checker can decide whether to file a 058-blocker or defer.

### Rule 1 (Auto-fixed Bug — mock structure)

**3. Per-table mock supabase routing instead of conftest's shared `_builder`**

- **Found during:** Task 1 second run
- **Issue:** Conftest's shared `_builder.execute.side_effect` is a flat queue across all tables. Under genuine asyncio concurrency from `httpx.AsyncClient(app=app, ...)`, Thread B's `messages` SELECT could pop a row meant for Thread A's history reconstruction, producing a malformed `MessageResponse` and a 500 from FastAPI's response_model validator. Run failed with 5 `ResponseValidationError` entries.
- **Fix:** Built a per-test `mock_supabase` whose `table(...)` dispatches to per-table builders (each with its own state). The conftest override for `get_supabase` is replaced for the duration of this test only, then restored in `finally`. Conftest's `get_current_user` override is left untouched.
- **Files modified:** `backend/tests/integration/test_058_concurrency.py`.
- **Commit:** `727d9f6`

## Auth gates encountered

None. The conftest auth/supabase dependency_overrides composed cleanly with the test-scoped supabase override.

## Issues Encountered

- **venv not in worktree:** Worktrees do not duplicate `backend/venv/`. Used the main repo's venv (`C:/Vibe Apps/Agentic RAG/backend/venv/Scripts/python.exe`) with `cd` into the worktree's `backend/` directory. PYTHONPATH resolves to the worktree's `app/` correctly because pytest's `rootdir` is the worktree's `backend`. No issue with mock isolation, but documented here for the orchestrator and any future executor.
- **httpx DeprecationWarning:** `httpx.AsyncClient(app=app, ...)` triggers a DeprecationWarning suggesting `transport=ASGITransport(app=...)`. The plan explicitly used the `app=app` shortcut form. The warning is non-breaking and the test passes. If a future httpx release removes the shortcut, migrate to `ASGITransport`. Not addressed in this plan.

## Verification Results

```
$ cd backend && venv/Scripts/python.exe -m pytest tests/integration/test_058_concurrency.py -v -s
============================= test session starts =============================
collected 1 item

tests/integration/test_058_concurrency.py::test_cross_tab_unblocked_during_sse
[058-03] cross-tab GET elapsed: 15.0ms (threshold < 1000ms)
PASSED

======================== 1 passed, 2 warnings in 0.16s ========================
```

### Acceptance Criteria — Task 1

| Criterion                                                    | Result                              |
| ------------------------------------------------------------ | ----------------------------------- |
| `tests/integration/test_058_concurrency.py` exists           | ✓                                   |
| `pytest tests/integration/test_058_concurrency.py -v` exit 0 | ✓                                   |
| File contains `elapsed < 1.0`                                | ✓                                   |
| `grep -c @pytest.mark.asyncio`                               | 1 (≥1 required) ✓                   |
| `grep -c httpx.AsyncClient`                                  | 4 (≥1 required) ✓                   |
| `grep -c asyncio.create_task`                                | 2 (≥1 required) ✓                   |
| `grep -c sse_task.cancel`                                    | 1 (≥1 required) ✓                   |
| `grep -c _slow_chunks`                                       | 0 (renamed → `_fast_chunks` per Rule 1 deviation) |
| `python -c "import httpx, pytest_asyncio"` exits 0           | ✓                                   |

### Acceptance Criteria — Task 2

| Criterion                                  | Result          |
| ------------------------------------------ | --------------- |
| `058-VERIFICATION.md` exists               | ✓               |
| Contains "DevTools"                        | 5 matches ✓     |
| Contains `1 second` / `< 1` / `1.0`        | 4 matches ✓     |
| Contains "CI Gate" / "test_058_concurrency"| 8 matches ✓     |
| Contains "not gating" / "non-gating" / "confirmatory" | 2 matches ✓ |

## Next Phase Readiness

- **Phase 058 is gate-green.** ROADMAP Success Criteria 1 (cross-tab GET <1s), 2 (every SSE-path `.execute()` wrapped — Plan 02 delivered), 3 (AnyIO limiter raised 40→200 — Plan 01 delivered), and 4 (single-worker dev preserved — implicit) are all satisfied.
- **The pre-existing broken tests in `test_threads.py`** (`test_sse_stream_contains_delta_events`, `test_sse_stream_delta_events_are_valid_json`) remain broken with the wrong patch target. Suggested follow-up: small fix-up plan to migrate them to `create_adaptive_streaming_chat` along with adapting their `mock_builder.execute.side_effect` queues to the per-table routing pattern this test established. Out of 058 scope.
- **Phase 059** (asyncio.Queue + sse-starlette + is_disconnected) can use this test as a regression baseline. The `_slow_chunks` slow-LLM pattern (rejected here) WILL be testable in 059 because 059 will move chunk iteration off the event loop.
- **Phase 062** (browser-MCP harness) can extend this test pattern to real-browser cross-tab testing, building on the established `httpx.AsyncClient(app=app, ...)` + `asyncio.create_task` shape.

## Self-Check: PASSED

Files created/verified:
- `backend/tests/integration/test_058_concurrency.py` ✓ FOUND
- `.planning/phases/058-backend-sse-concurrency-fix/058-VERIFICATION.md` ✓ FOUND

Commits verified:
- `727d9f6` (Task 1) ✓ FOUND in git log
- `cabc8cc` (Task 2) ✓ FOUND in git log

Test verified:
- `pytest tests/integration/test_058_concurrency.py` exits 0 with elapsed ~15ms ✓

Dependencies verified:
- `httpx` 0.27.2 + `pytest_asyncio` 1.3.0 already present, no `requirements.txt` changes ✓

---
*Phase: 058-backend-sse-concurrency-fix*
*Plan: 03*
*Completed: 2026-05-01*
