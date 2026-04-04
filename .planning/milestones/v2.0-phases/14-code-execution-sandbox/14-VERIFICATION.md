---
phase: 14-code-execution-sandbox
verified: 2026-04-03T13:30:00Z
status: passed
score: 13/13 must-haves verified
re_verification: false
human_verification:
  - test: "Set SANDBOX_ENABLED=true in .env, start backend, send a chat message asking to run a simple Python print statement"
    expected: "SSE stream delivers code_execution_start, then code_stdout with the printed output, then code_execution_complete with exit_code=0"
    why_human: "Requires a running Docker daemon, a live Supabase instance, and an active SSE connection — cannot simulate in unit tests"
  - test: "In a thread with sandbox_enabled=true, execute code that writes a file to /sandbox/output/, then check the Supabase Storage sandbox-outputs bucket"
    expected: "File appears in bucket at user_id/execution_id/filename; chat message includes a signed download URL"
    why_human: "Requires real Docker container, real Supabase Storage, and file I/O — end-to-end only"
  - test: "Delete a thread that has had code executed in it (sandbox_enabled=true), then inspect the running Docker containers"
    expected: "No lingering container for that thread_id after deletion"
    why_human: "Requires running Docker to inspect container lifecycle"
  - test: "Restart the FastAPI backend after executing code in a thread (sandbox_enabled=true)"
    expected: "All Docker containers from that session are stopped on shutdown (no orphaned containers)"
    why_human: "Requires Docker daemon and server restart to observe lifespan cleanup"
---

# Phase 14: Code Execution Sandbox Verification Report

**Phase Goal:** Code Execution Sandbox — enable the LLM to execute Python code in an isolated Docker container via an execute_code tool, stream real-time output to the frontend, harvest output files to Supabase Storage, and clean up containers on thread delete and app shutdown.
**Verified:** 2026-04-03T13:30:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | SandboxSessionManager can create and close sessions keyed by thread_id | VERIFIED | `sandbox_service.py` lines 19-61: `get_or_create`, `close_session`, `close_all` all present; 7 unit tests pass |
| 2 | When SANDBOX_ENABLED=false, llm-sandbox is never imported at module level | VERIFIED | `from llm_sandbox import InteractiveSandboxSession` is inside `get_or_create()` body only (line 24); no top-level import in sandbox_service.py, threads.py, or main.py |
| 3 | code_executions and sandbox_files tables exist with RLS policies | VERIFIED | `015_sandbox.sql` contains both `CREATE TABLE IF NOT EXISTS` statements plus `ENABLE ROW LEVEL SECURITY` and policies for SELECT and INSERT on each table |
| 4 | sandbox-outputs storage bucket exists in migration | VERIFIED | `015_sandbox.sql` line 38-40: `INSERT INTO storage.buckets (id, name, public) VALUES ('sandbox-outputs', 'sandbox-outputs', false)` |
| 5 | execute_code tool appears in get_tools() when sandbox_enabled=true | VERIFIED | `openai_service.py` lines 397-398: `if settings.sandbox_enabled: tools.append(EXECUTE_CODE_TOOL)`; confirmed by 4 passing unit tests in test_sandbox_tools.py |
| 6 | execute_code tool is absent from get_tools() when sandbox_enabled=false | VERIFIED | Same conditional gate; test `test_execute_code_not_in_tools_when_disabled` passes |
| 7 | execute_code tool is never in get_explorer_tools() | VERIFIED | `get_explorer_tools()` line 402-404 never references EXECUTE_CODE_TOOL; test `test_execute_code_not_in_explorer_tools` passes |
| 8 | execute_code dispatch runs session.run() in thread pool, not blocking the event loop | VERIFIED | `threads.py` line 651: `fut = loop.run_in_executor(None, _run_sync)` — blocking call offloaded to thread pool |
| 9 | Stdout/stderr stream as code_stdout/code_stderr SSE events via asyncio.Queue bridge | VERIFIED | `threads.py` lines 621-658: `on_stdout`/`on_stderr` callbacks use `loop.call_soon_threadsafe(queue.put_nowait, ...)` and queue drained with `await queue.get()` |
| 10 | code_execution_start fires before execution, code_execution_complete fires after | VERIFIED | `threads.py` line 614: `code_execution_start` yielded before `session.run()` call; line 682: `code_execution_complete` yielded after execution + DB insert |
| 11 | Files written to /sandbox/output/ are harvested and uploaded to Supabase Storage | VERIFIED | `harvest_output_files()` in sandbox_service.py lines 67-124: copies via `session.copy_from_runtime`, uploads to `sandbox-outputs` bucket; 3 unit tests pass |
| 12 | FastAPI lifespan handler closes all sandbox sessions on shutdown | VERIFIED | `main.py` lines 16-23: `@asynccontextmanager async def lifespan(app_instance)` calls `sandbox_manager.close_all()` guarded by `if settings.sandbox_enabled:` |
| 13 | Thread delete endpoint closes sandbox session before DB delete | VERIFIED | `threads.py` lines 138-142: `if settings.sandbox_enabled: sandbox_manager.close_session(thread_id)` before the DB delete call |

**Score:** 13/13 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/app/services/sandbox_service.py` | SandboxSessionManager class with get_or_create, close_session, close_all; harvest_output_files function; lazy llm_sandbox import | VERIFIED | 124 lines; all methods present; lazy import confirmed; `sandbox_manager` singleton exported |
| `backend/app/config.py` | sandbox_enabled (bool, default False) and sandbox_ttl_minutes (int, default 30) fields | VERIFIED | Lines 53-54: both fields present with correct defaults |
| `backend/supabase/migrations/015_sandbox.sql` | code_executions + sandbox_files tables with RLS + sandbox-outputs bucket | VERIFIED | 41 lines; both tables, both RLS enables, 4 policies, bucket insert all present |
| `backend/app/services/openai_service.py` | EXECUTE_CODE_TOOL definition with code/libraries/output_files params; conditional registration in get_tools() | VERIFIED | Lines 330-362: full tool definition; lines 397-398: conditional append |
| `backend/app/api/threads.py` | execute_code dispatch handler with SSE streaming bridge; delete_thread close_session hook; harvest_output_files call | VERIFIED | Lines 610-694: full execute_code handler; lines 138-142: delete_thread hook; line 677: harvest_output_files call |
| `backend/app/main.py` | FastAPI lifespan handler with sandbox cleanup | VERIFIED | Lines 16-23: asynccontextmanager lifespan calling close_all on shutdown; line 26: `lifespan=lifespan` in FastAPI constructor |
| `backend/tests/unit/test_sandbox_service.py` | Unit tests for SandboxSessionManager and harvest_output_files | VERIFIED | 10 tests covering get_or_create (new/existing), close_session (normal/nonexistent/error), close_all, lazy import guard, harvest (upload+insert, empty, path format) — all 10 pass |
| `backend/tests/unit/test_sandbox_tools.py` | Unit tests for execute_code tool registration | VERIFIED | 4 tests covering enabled/disabled registration, explorer exclusion, schema validation — all 4 pass |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `sandbox_service.py` | `config.py` | `settings.sandbox_enabled` conditional import | WIRED | Line 55: `from app.config import settings` inside `_evict_expired()` |
| `openai_service.py` | `config.py` | `settings.sandbox_enabled` check in `get_tools()` | WIRED | Line 397: `if settings.sandbox_enabled:` present |
| `threads.py` | `sandbox_service.py` | `sandbox_manager.get_or_create(thread_id)` | WIRED | Line 617: called inside execute_code elif branch |
| `threads.py` | `asyncio.Queue` | `loop.call_soon_threadsafe` SSE bridge | WIRED | Lines 622-630: both on_stdout and on_stderr use call_soon_threadsafe |
| `threads.py` | `sandbox_service.py` | `harvest_output_files()` in execute_code handler | WIRED | Lines 675-679: called after DB insert, result passed to code_execution_complete event |
| `threads.py` | `sandbox_service.py` | `sandbox_manager.close_session(thread_id)` in delete_thread | WIRED | Lines 139-141: inline import + close_session call guarded by settings.sandbox_enabled |
| `main.py` | `sandbox_service.py` | lifespan shutdown calls `sandbox_manager.close_all()` | WIRED | Lines 21-23: inline import + close_all() call guarded by settings.sandbox_enabled |
| `sandbox_service.py` | `supabase.storage` | upload to sandbox-outputs bucket | WIRED | Line 97: `supabase.storage.from_("sandbox-outputs").upload(storage_path, data)` |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `threads.py` execute_code handler | `output_file_list` | `harvest_output_files(session, execution_id, user_id, supabase)` | Yes — calls `session.copy_from_runtime`, iterates real files, uploads to storage | FLOWING |
| `threads.py` execute_code handler | `execution_id` | `supabase.table("code_executions").insert(...).execute().data[0]["id"]` | Yes — real DB insert with thread_id, user_id, code, exit_code, duration_ms | FLOWING |
| `sandbox_service.py` harvest_output_files | `output_files` | `os.walk(tmpdir)` over files copied from container | Yes — real file I/O from tempdir populated by copy_from_runtime | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| sandbox_service module importable without llm_sandbox | `pytest tests/unit/test_sandbox_service.py::TestLazyImportGuard -q` | 1 passed | PASS |
| execute_code tool in get_tools() when enabled | `pytest tests/unit/test_sandbox_tools.py::TestExecuteCodeToolRegistration::test_execute_code_in_tools_when_enabled -q` | 1 passed | PASS |
| execute_code tool absent when disabled | `pytest tests/unit/test_sandbox_tools.py::TestExecuteCodeToolRegistration::test_execute_code_not_in_tools_when_disabled -q` | 1 passed | PASS |
| harvest_output_files uploads and inserts | `pytest tests/unit/test_sandbox_service.py::TestHarvestOutputFiles -q` | 3 passed | PASS |
| Full sandbox test suite (14 tests) | `pytest tests/unit/test_sandbox_service.py tests/unit/test_sandbox_tools.py -q` | 14 passed | PASS |
| All non-pre-existing unit tests | `pytest tests/unit/ --ignore=test_retrieval_service.py --ignore=test_sql_service.py -q` | 104 passed | PASS |
| Full unit suite (pre-existing failures only) | `pytest tests/unit/ -q` | 7 failed (pre-existing), 124 passed | PASS (failures pre-date phase 14) |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| SAND-01 | Plan 02 | execute_code LLM tool available in General Mode when SANDBOX_ENABLED=true | SATISFIED | `get_tools()` appends EXECUTE_CODE_TOOL when `settings.sandbox_enabled=True`; 4 unit tests confirm. Note: REQUIREMENTS.md checkbox `[ ]` is stale and not updated — the implementation is complete. |
| SAND-02 | Plan 01 | Each chat thread maintains a persistent Docker sandbox session keyed by thread_id, TTL 30 min | SATISFIED | `SandboxSessionManager.get_or_create()` keyed by thread_id; `_evict_expired()` uses `settings.sandbox_ttl_minutes * 60` |
| SAND-03 | Plan 01 | Python sandbox via llm-sandbox; variables and packages persist across tool calls within same thread | SATISFIED | `InteractiveSandboxSession` reused per thread_id (same session object returned on second call); `llm-sandbox[docker]>=0.3.37` in requirements.txt |
| SAND-04 | Plans 02+03 | execute_code supports specifying additional PyPI packages | SATISFIED | `libraries` param in EXECUTE_CODE_TOOL schema (array of strings); `session.run(wrapped_code, libraries=libraries, ...)` in threads.py line 640 |
| SAND-05 | Plan 03 | Stdout and stderr streamed via SSE (code_stdout, code_stderr events) | SATISFIED | asyncio.Queue bridge with on_stdout/on_stderr callbacks; SSE events yielded as `{"type": "code_stdout", "content": chunk}` and `{"type": "code_stderr", "content": chunk}` |
| SAND-06 | Plan 03 | code_execution_start fires at start; code_execution_complete fires with exit code, duration, file list | SATISFIED | Lines 614 and 682 in threads.py; completion event includes exit_code, duration_ms, execution_id, output_files |
| SAND-07 | Plan 04 | Files in /sandbox/output/ uploaded to sandbox-outputs Supabase Storage bucket | SATISFIED | `harvest_output_files()` calls `session.copy_from_runtime("/sandbox/output/", tmpdir)` then uploads each file; 3 unit tests verify |
| SAND-08 | Plan 04 | sandbox_files table rows with signed download URLs accessible to user | SATISFIED | `supabase.table("sandbox_files").insert(...)` with execution_id, user_id, filename, storage_path, file_size; `create_signed_url(storage_path, 3600)` |
| SAND-09 | Plan 03 | Each execution logged to code_executions table | SATISFIED | `supabase.table("code_executions").insert({thread_id, user_id, code, exit_code, duration_ms})` at threads.py line 665 |
| SAND-10 | Plan 05 | Sandbox session closed when associated thread is deleted | SATISFIED | `delete_thread` endpoint calls `sandbox_manager.close_session(thread_id)` guarded by `if settings.sandbox_enabled:` before DB delete |
| SAND-11 | Plans 01+05 | Sandbox session manager starts/stops with FastAPI lifespan | SATISFIED | `@asynccontextmanager async def lifespan(app_instance)` in main.py calls `sandbox_manager.close_all()` on shutdown; `lifespan=lifespan` wired to FastAPI constructor |
| SAND-13 | Plans 01+02+03+05 | When SANDBOX_ENABLED=false, execute_code not registered, no Docker dependency at startup | SATISFIED | llm_sandbox import is lazy (inside get_or_create body only); all sandbox imports in threads.py and main.py are inside `if settings.sandbox_enabled:` guards |

**Note on SAND-12:** SAND-12 (Frontend Code Output panel) was NOT assigned to Phase 14 in any plan's requirements field. REQUIREMENTS.md maps SAND-12 to Phase 7 (Pending). This is not an orphaned requirement for Phase 14 — it is intentionally deferred to a future phase.

**Note on SAND-01 checkbox in REQUIREMENTS.md:** The `[ ]` checkbox for SAND-01 in REQUIREMENTS.md is stale. The implementation is complete — `get_tools()` returns EXECUTE_CODE_TOOL when `settings.sandbox_enabled=True`, verified by 4 unit tests. The REQUIREMENTS.md file was not updated to mark SAND-01 complete.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `backend/app/api/threads.py` | 31 | SYSTEM_PROMPT says "twelve tools" but actually documents 13 tools (execute_code listed as tool 13) | Warning | Incorrect count in system prompt text — LLM told it has 12 tools but receives 13. The tool definition in get_tools() is correct; this is a cosmetic mismatch in the natural language description string only. |

No missing implementations, empty stubs, placeholder returns, or TODO markers found in phase 14 files.

---

### Human Verification Required

#### 1. End-to-end execute_code streaming

**Test:** Set `SANDBOX_ENABLED=true` in `.env`, start the FastAPI backend with Docker running, open the chat frontend, and send a message asking the assistant to calculate something with Python (e.g., "what is 2^10 using Python?")
**Expected:** The frontend receives SSE events: `code_execution_start` first, then one or more `code_stdout` events with the printed result, then `code_execution_complete` with `exit_code: 0` and `duration_ms` > 0
**Why human:** Requires live Docker daemon, running FastAPI server, active SSE connection, and OpenRouter/OpenAI API call to trigger the tool — cannot be unit tested

#### 2. Output file harvesting and download links

**Test:** With sandbox enabled, ask the assistant to "generate a matplotlib chart and save it to /sandbox/output/chart.png"
**Expected:** The `code_execution_complete` SSE event includes `output_files` with a signed URL; the file appears in Supabase Storage under `sandbox-outputs/{user_id}/{execution_id}/chart.png`; clicking the link downloads the PNG
**Why human:** Requires Docker, real Supabase Storage bucket, matplotlib installed in container, and end-to-end file I/O

#### 3. Thread deletion cleans up Docker container

**Test:** Execute code in a thread (creating a Docker session), then delete the thread via the UI or API
**Expected:** The Docker container for that thread is stopped and removed; no orphaned containers remain; `docker ps -a` shows no lingering containers from the deleted thread
**Why human:** Requires Docker CLI access and ability to inspect running containers

#### 4. Lifespan shutdown closes all containers

**Test:** Execute code in one or more threads, then stop the FastAPI server (`Ctrl+C` or kill process)
**Expected:** FastAPI lifespan shutdown runs `sandbox_manager.close_all()`, stopping all Docker containers; no orphaned containers remain after server exits
**Why human:** Requires Docker daemon, server restart, and Docker CLI to verify container cleanup

---

### Gaps Summary

No gaps found. All 13 must-have truths verified. All 12 required artifacts pass all three verification levels (exist, substantive, wired). All 8 key links confirmed wired. All 12 requirements assigned to Phase 14 are satisfied.

**Minor warning (non-blocking):** The SYSTEM_PROMPT string in `threads.py` line 31 says "twelve tools" while actually describing 13 tools (execute_code is tool 13). This is a cosmetic inconsistency in the natural language count — the actual tool list in `get_tools()` is correct and execute_code is properly registered. The LLM receives the correct tool definitions regardless of this string.

**REQUIREMENTS.md stale checkbox (non-blocking):** SAND-01 checkbox is `[ ]` in REQUIREMENTS.md but is fully implemented and test-verified. The requirements tracking doc was not updated after Plan 02 completion.

**Pre-existing test failures (non-blocking):** 7 tests failing in `test_retrieval_service.py` (6) and `test_sql_service.py` (1) — confirmed pre-existing before Phase 14, unrelated to sandbox implementation.

---

_Verified: 2026-04-03T13:30:00Z_
_Verifier: Claude (gsd-verifier)_
