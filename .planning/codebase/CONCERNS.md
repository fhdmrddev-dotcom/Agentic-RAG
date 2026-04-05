# Technical Concerns
_Last updated: 2026-04-05_

---

## Security Concerns

### Service-Role Client Bypasses RLS — Manual Scoping Required Throughout

The backend creates a single Supabase client using the service-role key (`backend/app/dependencies.py`, line 15), which bypasses all Row-Level Security policies. This is an intentional architecture choice, but it creates a persistent risk: every endpoint must manually enforce user scoping or data leaks across users become possible.

- Files: `backend/app/dependencies.py` (line 15), `backend/app/services/sql_service.py` (lines 14–50)
- Current mitigation: `_inject_user_id()` in `sql_service.py` inserts `WHERE documents.user_id = '{user_id}'` or `WHERE folders.user_id = '...'` via regex substitution before executing SQL. This is fragile — any SQL shape that doesn't match the regex patterns could escape the filter.
- Risk: A poorly-formed LLM-generated SQL query that confuses the regex could bypass the user scope entirely. The DB-level RLS won't catch it because the service-role key skips it.
- Fix approach: Switch to a per-request Supabase client using the user's JWT token for all queries, relying on DB-level RLS rather than application-layer injection. If service role remains necessary, add a strict allowlist of SQL patterns.

### SQL Injection Risk in `grep_path` and `query_documents`

The `grep_path` function in `backend/app/api/kb.py` (line 252) builds a raw SQL query by string-interpolating the user-supplied regex pattern:

```python
sql = f"SELECT id, filename, folder_id FROM documents WHERE full_markdown ~ '{escaped_pattern}'"
```

The only sanitisation is `pattern.replace("'", "''")`. This escapes single quotes but does not protect against other SQL injection vectors (e.g., regex-level DoS via catastrophic backtracking, or injection via dollar-sign quoting).

The `query_user_documents` RPC in `backend/supabase/migrations/012_query_documents_fn.sql` uses `EXECUTE format(...)` with dynamic SQL. The application-level guard (`not clean.lower().startswith("select")` and `";" in clean`) is only defence-in-depth; it is bypassable with techniques like `SELECT ... FROM (SELECT pg_sleep(5))`. While the RPC is `SECURITY INVOKER`, the service-role client means RLS is not active — the manually-injected filter is the only guard.

- Files: `backend/app/api/kb.py` lines 250–258, `backend/app/services/sql_service.py` lines 14–50, `backend/supabase/migrations/012_query_documents_fn.sql`
- Risk: Medium — attacker must be authenticated; however any authenticated user could exfiltrate data from other users via crafted queries.
- Fix approach: Use parameterised queries or Supabase `.rpc()` with proper parameter binding rather than string interpolation.

### Settings Stored in Plain-Text JSON File on Disk

API keys and secrets (OpenAI, Anthropic, Cohere, Tavily) are persisted to `backend/settings_override.json` as plain text via `save_override()` in `backend/app/models/user_settings.py` (lines 91–101). This file is gitignored but sits on the server filesystem.

- Files: `backend/app/models/user_settings.py` lines 84–101, `backend/settings_override.json`
- Risk: Any process with filesystem read access (e.g., a compromised container or a directory traversal bug) can read all API keys.
- Fix approach: Store overrides in Supabase (encrypted at rest) or use a secrets manager rather than a local JSON file.

### `match_document_chunks` RPC Uses `SECURITY DEFINER`

The `match_document_chunks` function (`backend/supabase/migrations/002_module2_byo_retrieval.sql`, line 85) is declared `SECURITY DEFINER`, meaning it runs with the privileges of the function owner (superuser), not the caller. It filters by `match_user_id` but this parameter is supplied by the application and not verified at the DB level.

- Risk: If the application ever passes the wrong `match_user_id`, another user's chunks are returned. There is no DB-enforced guard.
- Fix approach: Change to `SECURITY INVOKER` and rely on RLS, or verify user ownership inside the function body using `auth.uid()`.

### No File Size Limit on Document Upload

Document uploads in `backend/app/api/documents.py` have no server-side size check. The entire file is read into memory with `raw = await file.read()` (line 60) before any validation. A large file (e.g., 500 MB PDF) will consume server memory for the full duration of the request.

- Files: `backend/app/api/documents.py` lines 60–66
- Note: Skill file uploads do enforce 10 MB (`backend/app/api/skills.py` line 375), but documents have no equivalent guard.
- Fix approach: Add a streaming size check or enforce a limit via FastAPI middleware before reading the full upload body.

### CORS Allows Any `localhost` Port

`backend/app/main.py` line 32 uses `allow_origin_regex=r"http://localhost:\d+"`, which permits connections from any localhost port. Acceptable for development but must be removed or tightened for production deployments.

- Files: `backend/app/main.py` lines 28–35

---

## Performance Concerns

### `fetch_all_folders` Scans All Folders in DB on Every Request

`backend/app/utils/folder_utils.py` functions `fetch_visible_folders` and `get_globally_visible_folder_ids` both call `fetch_all_folders()`, which does a full table scan (`SELECT * FROM folders`) on every invocation. These are called repeatedly within a single request from multiple functions.

Within a single `send_message` call, `fetch_visible_folders` is called: once for thread folder-scope subtree resolution (`threads.py` line 309), once per `ls` tool call (`kb.py` line 52), once per `tree` tool call (`kb.py` line 106), once per `grep` tool call (`kb.py` line 243), once per `glob` call (`kb.py` line 317), plus independently from `get_globally_visible_folder_ids` in several more places.

- Files: `backend/app/utils/folder_utils.py`, `backend/app/api/kb.py`, `backend/app/api/documents.py`, `backend/app/api/threads.py`
- Impact: N+1 style full-table queries per agent tool call. With a multi-tool agent turn, this is 5–10 full folder scans per message.
- Fix approach: Cache the folder list per request (pass it as a parameter through the call chain) or add an in-process cache with short TTL.

### Keyword Search Does Not Apply Folder Scoping

`backend/app/services/retrieval_service.py` line 218 calls `_keyword_search()` without passing `folder_ids`. The keyword search RPC (`keyword_search_chunks`) is not folder-scoped, so keyword results before RRF fusion include chunks from all of the user's documents regardless of the active folder scope. The folder filter is only applied to vector search.

- Files: `backend/app/services/retrieval_service.py` lines 218, 49–65
- Impact: Hybrid search returns chunks from outside the scoped folder, degrading retrieval quality in folder-scoped threads.
- Fix approach: Extend `_keyword_search` and the `keyword_search_chunks` RPC to accept an optional `p_folder_ids` parameter.

### Synchronous Supabase Calls Inside Async Endpoints

All Supabase calls use the synchronous `supabase-py` client (not `AsyncClient`) inside `async def` route handlers. FastAPI runs these blocking calls on the event loop thread, which blocks the event loop under concurrency.

- Files: All files in `backend/app/api/` and `backend/app/services/`
- Impact: Under concurrent users, async endpoints are effectively serialised at the Supabase I/O layer.
- Fix approach: Either use `supabase-py`'s `AsyncClient` throughout, or wrap all Supabase calls in `asyncio.run_in_executor()` calls.

### `ingest_document` Runs Blocking Calls in a Background Task

`backend/app/api/documents.py` line 155 uses `background_tasks.add_task(ingest_document, ...)`. FastAPI's `BackgroundTasks` runs the task in the event loop thread after the response is sent. Since `ingest_document` makes blocking calls to the OpenAI embedding API and the chunking loop, it blocks the event loop for the full ingestion duration.

- Files: `backend/app/api/documents.py` lines 155, 266–311
- Impact: Long documents block the server from processing other requests during ingestion.
- Fix approach: Use a proper task queue (Celery, ARQ) or `asyncio.get_event_loop().run_in_executor()`.

### `full_markdown` Stored Redundantly Alongside Chunk Contents

The `documents.full_markdown` column stores the full extracted text of every document alongside `document_chunks.content` which contains the same text chunked. For large documents these are effectively the same data stored twice.

- Files: `backend/supabase/migrations/014_document_folder_integration.sql`, `backend/app/api/documents.py` line 304
- Note: `fetch_full_document` in `backend/app/services/retrieval_service.py` already reconstructs full text from chunks without using `full_markdown`.
- Impact: Storage inefficiency; doubled data in Postgres for large documents.
- Fix approach: Either drop `full_markdown` and reconstruct from chunks everywhere, or keep only `full_markdown` and derive chunks from it at read time.

---

## Technical Debt

### `threads.py` `send_message` is 612 Lines — God Function

The `send_message` endpoint in `backend/app/api/threads.py` (lines 260–872) is a single async function containing: SSE streaming logic, multi-turn tool call loop, 13 tool dispatch branches each with inline business logic, sandbox execution orchestration, message persistence, thread title generation, and error handling.

- Files: `backend/app/api/threads.py` lines 260–872
- Impact: Extremely difficult to test, modify, or reason about. Adding a new tool requires editing deep inside this function. Unit tests cannot cover the dispatch logic without full integration harnesses.
- Fix approach: Extract tool dispatch into a `ToolDispatcher` class, move each tool handler to a dedicated function or module, separate the streaming scaffold from the business logic.

### `load_user_settings` Ignores `user_id` — Stub Function

`backend/app/models/user_settings.py` lines 257–258:
```python
def load_user_settings(user_id: str, supabase=None) -> UserEffectiveSettings:
    return load_app_settings()
```

The function signature accepts `user_id` and `supabase` but ignores both, returning global app settings. This is a stub left from when per-user settings were planned. Call sites throughout the codebase pass a user ID that is silently dropped.

- Files: `backend/app/models/user_settings.py` lines 257–258, called from `backend/app/api/threads.py` line 291
- Impact: Settings are shared across all users; multi-user per-user customisation is not possible without refactoring this layer.
- Fix approach: Implement actual per-user settings or remove the `user_id` parameter to make the global-only behaviour explicit.

### `app_settings` DB Table is Unused Dead Code

Migration `010_app_settings.sql` creates a `public.app_settings` table. The application does not read from or write to this table — all settings are handled via `backend/settings_override.json` on disk. The table is dead schema.

- Files: `backend/supabase/migrations/010_app_settings.sql`, `backend/app/models/user_settings.py`
- Fix approach: Drop the table in a migration or migrate settings storage to use it instead of the JSON file.

### Duplicate Migrations Directory — `backend/supabase/` vs Root `supabase/`

Two separate `supabase/migrations/` directories exist:
- `backend/supabase/migrations/` — migrations 001–015 (older, incomplete)
- `supabase/migrations/` (project root) — migrations 001–019 (canonical, more complete)

The root set is the active one (has migrations 016–019 that the backend set lacks). Migration 015 has completely different content between the two directories:
- `backend/supabase/migrations/015_sandbox.sql` — creates sandbox tables
- `supabase/migrations/015_global_folder_document_rls.sql` — updates document SELECT policy

- Files: `backend/supabase/migrations/`, `supabase/migrations/`
- Impact: Risk of applying wrong migrations to production; serious ambiguity about what has been applied.
- Fix approach: Remove `backend/supabase/` entirely; canonicalise on the root `supabase/migrations/`.

### Orphaned Pip Install Artifacts

The files `backend/=0.24.0`, `backend/=0.27.0`, and `backend/=8.0.0` exist in the backend directory — artefacts from malformed `pip install` invocations (e.g., `pip install package==0.24.0` typed without the package name, creating files named `=<version>`).

- Files: `backend/=0.24.0`, `backend/=0.27.0`, `backend/=8.0.0`
- Fix approach: Delete these three files.

### Storage Upload Failure Silently Swallowed on Document Upload

`backend/app/api/documents.py` lines 146–153:
```python
try:
    supabase.storage.from_("documents").upload(...)
except Exception:
    pass  # Storage upload failure doesn't block ingestion
```

If the storage upload fails, the document record is created and ingestion proceeds. The backing file will be missing from Supabase Storage, making future `delete_document` calls silently no-op the storage removal step. The user has no way to know the file was not stored.

- Files: `backend/app/api/documents.py` lines 146–153
- Impact: Silent data inconsistency — DB record exists but backing file does not.
- Fix approach: Log the storage failure explicitly and surface it in the document's `error_message` field, or make storage upload a prerequisite.

### Stale Document Deletion is Folder-Unaware

`backend/app/api/documents.py` lines 104–119 detects a "stale" document (same filename, different content) by querying across all folders — not just the target folder. If a user has `notes.md` in folder A and uploads a new `notes.md` to folder B, the old `notes.md` in folder A gets deleted.

- Files: `backend/app/api/documents.py` lines 104–119
- Impact: Unintended deletion of documents in other folders when uploading a same-name file to a different folder.
- Fix approach: Scope the stale document query to the same `folder_id` as the upload target (match the dedup query pattern on lines 88–99).

---

## Missing Error Handling

### `delete_folder` Does Not Guard Document Ownership on Deletion

`backend/app/api/folders.py` `delete_folder` (lines 131–167) uses BFS to collect all descendant folder IDs, then fetches and deletes all documents in those folders without a `.eq("user_id", ...)` guard on line 148.

- Files: `backend/app/api/folders.py` lines 131–167
- Current risk: Low (upload now validates folder ownership), but there is no defence-in-depth ownership check on deletion.
- Fix approach: Add `.eq("user_id", current_user["id"])` to the document query on line 148.

### `move_document` Allows Moving Into Other Users' Global Folders

`backend/app/api/documents.py` lines 243–253 (`move_document`) allows a user to move their document into any global folder (not just their own):
```python
.or_(f"user_id.eq.{current_user['id']},is_global.eq.true")
```

This means a user can inadvertently or deliberately expose private documents to all other users by moving them into a shared global folder.

- Files: `backend/app/api/documents.py` lines 243–253
- Fix approach: Restrict `move_document` to only allow moving into folders owned by the current user. Moving to a global folder should require owning that folder.

### No Timeout on Sandbox Code Execution

The `execute_code` path in `backend/app/api/threads.py` (lines 635–771) runs user-provided Python code in a Docker container via `loop.run_in_executor(None, _run_sync)`. There is a session TTL for idle eviction but no per-execution timeout. A user can submit an infinite loop and the request hangs indefinitely.

- Files: `backend/app/api/threads.py` lines 668–690, `backend/app/services/sandbox_service.py`
- Impact: A single bad code execution can tie up a thread worker indefinitely; no way for the user to cancel.
- Fix approach: Add a `timeout` parameter to `session.run()` or wrap `fut = loop.run_in_executor(...)` in `asyncio.wait_for(fut, timeout=60)`.

### `web_search` Has No Error Handling for Tavily API Failures

`backend/app/services/web_search_service.py` line 20 calls `response.raise_for_status()`, which propagates through tool dispatch and is caught by the broad `except Exception` at `threads.py` line 780, returning `"Tool execution failed: ..."` to the LLM.

- Files: `backend/app/services/web_search_service.py` lines 8–34
- Impact: Tavily outages or quota errors produce confusing LLM responses rather than a clear "web search is unavailable" message.
- Fix approach: Catch specific Tavily exceptions and return a structured error message.

### Tool Errors Not Distinguishable by SSE Clients

Tool execution errors in `backend/app/api/threads.py` lines 777–783 emit a generic `"Tool execution failed: {e}"` string as the tool result with a standard `tool_end` SSE event. The frontend and LLM cannot distinguish a tool failure from a real result.

- Files: `backend/app/api/threads.py` lines 777–783
- Fix approach: Emit a structured `tool_error` SSE event type distinct from `tool_end`.

---

## Scalability Concerns

### Folder Visibility Computed In-Process With Full Table Fetch

`backend/app/utils/folder_utils.py` `is_in_global_subtree()` walks the folder ancestor chain recursively in Python after fetching the full folders table into memory. With thousands of folders this becomes slow and memory-intensive.

The DB-native `folder_is_globally_visible()` recursive CTE exists in migration 019 and is used for RLS policies, but the application ignores it and reimplements the same logic in Python.

- Files: `backend/app/utils/folder_utils.py` lines 13–51, `supabase/migrations/019_global_folder_subtree_visibility.sql`
- Fix approach: Replace Python-side folder traversal with a call to the `folder_is_globally_visible` DB function.

### No Pagination on Any List Endpoint

All list endpoints return unbounded result sets:
- `GET /documents` — all documents with no limit (`backend/app/api/documents.py` line 160)
- `GET /threads` — all threads (`backend/app/api/threads.py` line 99)
- `GET /skills` — all skills (`backend/app/api/skills.py` line 72)
- `GET /folders` — all folders (`backend/app/api/folders.py` line 11)

- Impact: As users accumulate data, these endpoints return increasingly large payloads, degrading frontend performance and increasing DB query time.
- Fix approach: Add `limit` and `cursor` (or `offset`) parameters to all list endpoints.

### Context Window Growth Is Unbounded for Long Conversations

The `send_message` handler in `backend/app/api/threads.py` (lines 332–341) loads the full message history from DB and passes it to the LLM on every message with no truncation. A long conversation will eventually exceed the model's context window.

- Files: `backend/app/api/threads.py` lines 332–341, 386–388
- Impact: Long threads fail with a truncation note; the LLM loses context from early in the conversation.
- Fix approach: Implement sliding window truncation or summarisation of older messages.

### Sandbox Session Manager Is Not Multi-Process Safe

`backend/app/services/sandbox_service.py` stores sessions in `_sessions: dict[str, object] = {}` at module level (lines 15–16). Under a multi-worker deployment (`uvicorn --workers N`), each worker process has its own `_sessions` dict. A session created in worker A is invisible to worker B.

- Files: `backend/app/services/sandbox_service.py` lines 15–16
- Impact: Docker container proliferation under multi-worker deployment; session state lost on inter-worker routing.
- Fix approach: Store session state in Redis or restrict sandbox to single-worker deployment; document this constraint clearly.

---

## Fragile Areas

### `_reconstruct_history` Silently Drops Tool Calls Without `tool_call_id`

`backend/app/api/threads.py` lines 223–253 contains backward-compatibility logic: assistant messages without `tool_call_id` on their tool calls are emitted as plain assistant messages, silently dropping the tool call data from the reconstructed LLM context. Older messages (before the schema added `tool_call_id`) produce incorrect history.

- Files: `backend/app/api/threads.py` lines 223–253
- Impact: The LLM receives an inaccurate conversation history for threads containing pre-migration messages, potentially causing repeated tool calls or hallucinations.
- Fix approach: Add a one-time migration to backfill `tool_call_id` for existing messages, then remove the backward-compat branch.

### `glob` Folder Scoping Applied Client-Side After DB Fetch

`backend/app/api/threads.py` lines 498–503 applies folder subtree filtering to `glob` results after the DB query returns all matching documents for the user:
```python
result["matches"] = [m for m in result["matches"] if m.get("folder_id") in folder_subtree_ids]
```

This means the DB fetches all matching documents, then Python discards most of them. The `total` count in the pre-filter response is also misleading.

- Files: `backend/app/api/threads.py` lines 498–503, `backend/app/api/kb.py` `glob_path` function
- Fix approach: Pass `folder_ids` into `glob_path` and apply the filter in the DB query.

### `analyze_document` Does Not Respect Folder Scope

The `analyze_document` tool calls `resolve_document_id` in `backend/app/services/retrieval_service.py` (lines 124–148), which searches by filename across all of the user's documents regardless of folder scope. In a folder-scoped thread, the LLM could analyze a document from a different folder than the active scope.

- Files: `backend/app/api/threads.py` lines 527–548, `backend/app/services/retrieval_service.py` lines 124–148
- Impact: Folder-scoped chats may inadvertently surface content from outside the intended folder when `analyze_document` is invoked.
- Fix approach: Pass `folder_subtree_ids` to `resolve_document_id` and add an optional folder filter to that function.

---

## Dependencies at Risk

### `sentence-transformers` Always Installed but Rarely Used

`backend/requirements.txt` line 14 includes `sentence-transformers>=3.0.0`. This is a large ML package (~500 MB with PyTorch) only used when `rerank_provider="local"`. It is imported lazily (`# type: ignore`) in `backend/app/services/rerank_service.py` line 34 but always installed in the venv.

- Files: `backend/requirements.txt` line 14, `backend/app/services/rerank_service.py` line 34
- Impact: Very large venv; slow environment setup; unnecessary disk usage in production when only API reranking is used.
- Fix approach: Make it an optional dependency with a separate `requirements-local-rerank.txt`.

### `llm-sandbox[docker]` Requires Docker Daemon — No Startup Validation

`backend/requirements.txt` line 15 includes `llm-sandbox[docker]>=0.3.37`. When sandbox is enabled, Docker must be running or sandbox sessions fail at runtime with only a generic tool error. There is no startup health check.

- Files: `backend/requirements.txt` line 15, `backend/app/services/sandbox_service.py`, `backend/app/api/threads.py` lines 21–22
- Fix approach: Add a startup health check that validates Docker connectivity when `SANDBOX_ENABLED=true` and surfaces a clear error.

### `openai>=2.0.0` — Unpinned Major Version Upper Bound

`backend/requirements.txt` line 4 specifies `openai>=2.0.0` with no upper bound. A future `openai 3.x` release with breaking changes would silently install and break all LLM calls.

- Files: `backend/requirements.txt` line 4
- Fix approach: Pin to `openai>=2.0.0,<3.0.0`.

---

## Test Coverage Gaps

### The 612-Line Tool Dispatch Loop Has No Unit Tests

The tool dispatch logic inside `event_stream()` in `backend/app/api/threads.py` is tested only through integration tests with Supabase mocks. There are no unit tests for individual tool branches (`load_skill`, `save_skill`, `execute_code`, `analyze_document`, etc.) in isolation.

- Files: `backend/app/api/threads.py` lines 476–782
- What's not tested: `load_skill`, `save_skill`, `read_skill_file`, `execute_code` branches in isolation; the `_reconstruct_history` backward-compat branch; context budget truncation logic.
- Priority: High

### No Tests for SSE Streaming Parser in Frontend

`frontend/src/lib/api.ts` `streamMessage()` contains the SSE parsing logic (lines 109–165) including buffer accumulation and partial-line handling. There are no tests in `frontend/src/__tests__/lib/api.test.ts` covering this parsing path. A regression would silently break all chat streaming.

- Files: `frontend/src/lib/api.ts` lines 109–165, `frontend/src/__tests__/lib/api.test.ts`
- Priority: High

### Sandbox End-to-End Flow Has No Real Integration Tests

`backend/tests/unit/test_sandbox_service.py` and `backend/tests/unit/test_sandbox_tools.py` mock the sandbox manager. There are no tests exercising the actual Docker execution path (install libraries, run code, harvest output files, upload to storage).

- Files: `backend/tests/unit/test_sandbox_service.py`, `backend/tests/unit/test_sandbox_tools.py`
- Priority: Medium

### `extract_metadata` LLM Call Is Never Tested

`backend/app/services/embedding_service.py` `extract_metadata()` (lines 50–87) makes an LLM call during ingestion and silently swallows all failures (`except Exception: return None`). There are no tests for the extraction prompt, Pydantic validation, or fallback path.

- Files: `backend/app/services/embedding_service.py` lines 50–87
- Priority: Low

---

*Concerns audit: 2026-04-05*
