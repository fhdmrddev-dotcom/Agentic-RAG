---
phase: 14-code-execution-sandbox
plan: "03"
subsystem: backend
tags: [code-execution, sse-streaming, asyncio, tool-dispatch]
dependency_graph:
  requires: ["14-01", "14-02"]
  provides: ["execute_code SSE streaming handler in event_stream"]
  affects: ["backend/app/api/threads.py"]
tech_stack:
  added: []
  patterns:
    - "asyncio.Queue bridge for thread-pool-to-event-loop SSE streaming"
    - "run_in_executor for blocking session.run() calls"
    - "call_soon_threadsafe for thread-safe queue push from callbacks"
key_files:
  created: []
  modified:
    - backend/app/api/threads.py
    - backend/tests/unit/test_explorer_agent.py
    - backend/tests/unit/test_module7_tools.py
    - backend/tests/unit/test_openai_service.py
decisions:
  - "asyncio.Queue bridge: callbacks push to queue from thread pool; event_stream drains queue via await — correct asyncio pattern for thread-to-coroutine streaming"
  - "Lazy sandbox import at module level behind if settings.sandbox_enabled guard — matches Plan 01 pattern, never imports Docker SDK when disabled"
  - "Pre-existing test failures (17 before, 7 after): fixed 10 stale tests in test_explorer_agent, test_module7_tools, test_openai_service that had missing mock setup entries"
metrics:
  duration: "20min"
  completed: "2026-04-03T12:32:05Z"
  tasks_completed: 1
  files_modified: 4
---

# Phase 14 Plan 03: execute_code SSE Streaming Bridge Summary

Wire the execute_code tool dispatch into the chat event stream with real-time asyncio.Queue-based SSE bridge for stdout/stderr, execution DB logging, and start/complete lifecycle events.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Add execute_code dispatch with asyncio.Queue SSE bridge | f0637a9 | threads.py, 3 test files |

## What Was Built

Added the `execute_code` elif branch inside `event_stream()` in `backend/app/api/threads.py`:

**Imports added:**
- `import asyncio` — for Queue and run_in_executor
- `import time as time_mod` — for execution timing
- Conditional module-level `from app.services.sandbox_service import sandbox_manager` (only when `settings.sandbox_enabled`)

**execute_code dispatch handler:**
1. Emits `code_execution_start` SSE event with first 200 chars of code
2. Gets or creates sandbox session via `sandbox_manager.get_or_create(thread_id)`
3. Creates `asyncio.Queue` and captures current event loop
4. Defines `on_stdout(chunk)` and `on_stderr(chunk)` callbacks that use `loop.call_soon_threadsafe(queue.put_nowait, ...)` to bridge thread pool → event loop
5. Prepends `/sandbox/output` makedirs to user code (Pitfall 5 prevention)
6. Runs `session.run()` in thread pool via `loop.run_in_executor(None, _run_sync)` — non-blocking
7. Drains queue with `await queue.get()` loop, yielding `code_stdout`/`code_stderr` SSE events; breaks on `_done` sentinel
8. Inserts row into `code_executions` table with thread_id, user_id, code, exit_code, duration_ms
9. Emits `code_execution_complete` SSE event with exit_code, duration_ms, execution_id, output_files
10. Sets `tool_result` as JSON summary for LLM context
11. Error path: catches Exception, emits `code_execution_complete` with exit_code=1, returns error result

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed pre-existing test mock setup missing thread_folder_result**
- **Found during:** Task 1 verification (pytest run)
- **Issue:** `test_send_message_explorer_mode_uses_explorer_prompt` failing with `AttributeError: 'list' object has no attribute 'get'` — `_setup_thread_mocks()` in test_explorer_agent.py had 5 execute() side effects but `event_stream()` now makes 6 calls (added thread folder scope query in a prior phase). The mock consumed `insert_result.data = [{}]` (a list) for the `.single().execute()` thread folder query, causing `.get()` to fail.
- **Fix:** Added `thread_folder_result.data = {"folder_id": None}` at position 3, added `agent_mode` parameter to `_setup_thread_mocks()` so general mode tests also include a `skills_result` (position 5). Updated 3 default-mode test calls to pass `agent_mode="default"`.
- **Files modified:** `backend/tests/unit/test_explorer_agent.py`
- **Commit:** f0637a9

**2. [Rule 1 - Bug] Fixed stale tool count assertions in test_module7_tools**
- **Found during:** Task 1 verification
- **Issue:** `test_returns_two_tools_without_tavily` and `test_returns_three_tools_with_tavily` asserted `len(tools) == 2` and `== 3`, but `get_tools()` now returns 11+ tools since many phases added tools after Module 7.
- **Fix:** Updated assertions to reflect actual base count (11), web_search adds 1 to make 12. Updated `test_tool_order_is_search_query_web` to only verify first two tools remain `search_documents` and `query_documents`.
- **Files modified:** `backend/tests/unit/test_module7_tools.py`
- **Commit:** f0637a9

**3. [Rule 1 - Bug] Fixed stale embedding client test mock missing llm_base_url**
- **Found during:** Task 1 verification
- **Issue:** `test_no_base_url_when_embedding_base_url_empty` failed because `settings.llm_base_url` was an unset MagicMock attribute (truthy), so the fallback `base_url = settings.embedding_base_url or settings.llm_base_url or None` resolved to the MagicMock, which got added to kwargs.
- **Fix:** Added `mock_settings.llm_base_url = ""` to the test setup.
- **Files modified:** `backend/tests/unit/test_openai_service.py`
- **Commit:** f0637a9

### Remaining Pre-existing Failures

7 tests still failing in `test_retrieval_service.py::TestSearchDocuments` and `test_sql_service.py::TestQueryDocumentsRpcCall` — pre-existing mock maintenance issues unrelated to this plan. Reduced from 17 → 7 pre-existing failures.

## Self-Check

- [x] backend/app/api/threads.py contains `elif tool_name == "execute_code":`
- [x] backend/app/api/threads.py contains `sandbox_manager.get_or_create(thread_id)`
- [x] backend/app/api/threads.py contains `loop.call_soon_threadsafe`
- [x] backend/app/api/threads.py contains `run_in_executor`
- [x] backend/app/api/threads.py contains `code_execution_start`
- [x] backend/app/api/threads.py contains `code_execution_complete`
- [x] backend/app/api/threads.py contains `code_stdout`
- [x] backend/app/api/threads.py contains `code_stderr`
- [x] backend/app/api/threads.py contains `supabase.table("code_executions").insert`
- [x] backend/app/api/threads.py contains `os.makedirs('/sandbox/output', exist_ok=True)`
- [x] 121 unit tests passing (up from 111 before)
- [x] Commit f0637a9 exists

## Self-Check: PASSED
