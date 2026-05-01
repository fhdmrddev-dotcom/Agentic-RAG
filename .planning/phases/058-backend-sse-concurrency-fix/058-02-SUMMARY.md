---
phase: 058-backend-sse-concurrency-fix
plan: 02
subsystem: api
tags: [sse, fastapi, concurrency, threadpool, supabase, aexec]

requires:
  - phase: 058
    provides: aexec helper from Plan 01 (backend/app/utils/db.py)
provides:
  - SSE-path .execute() wrapping in threads.py event_stream and send_message
  - 13 in-scope helpers converted to 'async def' (folder_utils x3, retrieval x6, sql x1, audit x1, multimodal x2)
  - 6 forced-cascade kb.py helpers converted to 'async def' (Step F bucket 2)
affects: [058-03]

tech-stack:
  added: []
  patterns:
    - "await aexec(<chain>) replaces <chain>.execute() — chain is built without trailing .execute()"
    - "SELECT chains that read .data inline get refactored to 'resp = await aexec(...); rows = resp.data or []'"
    - "async def helpers — non-SSE callers cascade-updated; signature change is forcing function"

key-files:
  modified:
    - backend/app/api/threads.py
    - backend/app/utils/folder_utils.py
    - backend/app/services/retrieval_service.py
    - backend/app/services/sql_service.py
    - backend/app/services/audit_service.py
    - backend/app/services/multimodal_service.py
    - backend/app/api/folders.py
    - backend/app/api/documents.py
    - backend/app/api/kb.py

key-decisions:
  - "kb.py cascade — _fetch_visible_folders wrapper + ls_path/tree_path/grep_path/glob_path/read_path converted to async (bucket 2). Threaded through into threads.py event_stream tool dispatch (await ls_path/tree_path/grep_path/glob_path/read_path)"
  - "embed_texts (retrieval_service:_vector_search) and rerank (search_documents) remain SYNC — they are OpenAI/Cohere HTTP calls, not Supabase .execute(). Out of 058 scope per D-058-01"
  - "BackgroundTasks.add_task(write_audit_entry, ...) calls in documents.py/feedback.py/settings.py left unchanged — FastAPI BackgroundTasks supports async functions natively"
  - "extract_and_store_tables / extract_and_store_images / extract_tables_from_pdf in multimodal_service.py left SYNC — ingestion-pipeline only, not reachable from event_stream"
  - "_persist_assistant_message converted to async def; shielded-finally _shielded_persist now awaits it. asyncio.shield wrapper preserved verbatim per research §A5"

patterns-established:
  - "Local 'from app.utils.db import aexec' import inside folder_utils.py to avoid potential cycle with sql_service which imports folder_utils"
  - "Inline SELECT->.data idiom rewritten as named temp resp variable: '_X_resp = await aexec(...); X = _X_resp.data or []'"

requirements-completed:
  - CONCUR-01

duration: ~16min
completed: 2026-05-01
---

# Phase 058 Plan 02: Wrap SSE-Path .execute() with aexec Summary

**Every Supabase `.execute()` reachable from `event_stream` (and the pre-stream user-message INSERT) is now wrapped in `await aexec(...)`, plus 13 in-scope helpers and 6 cascade-forced kb.py helpers are now `async def` — the asyncio loop is no longer blocked by sync DB round-trips on the SSE path.**

## Performance

- **Duration:** ~16 min (executor wall time)
- **Completed:** 2026-05-01
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments

- All 13 plan-listed helpers converted to `async def`: `fetch_all_folders`, `fetch_visible_folders`, `get_globally_visible_folder_ids`, `_vector_search`, `_keyword_search`, `_enrich_with_filenames`, `resolve_document_id`, `fetch_full_document`, `search_documents`, `query_documents`, `write_audit_entry` (already async — body wrapped), `_fetch_document_tables`, `handle_query_tables`
- 6 cascade-forced kb.py helpers converted to `async def`: `_fetch_visible_folders`, `ls_path`, `tree_path`, `grep_path`, `glob_path`, `read_path` (Step F bucket 2 — sync `def` wrappers forced async by signature change in upstream helpers)
- `threads.py` event_stream + send_message: 22 `await aexec(...)` sites covering pre-stream user-message INSERT (D-058-02), thread-ownership SELECT, history reconstruction, skills/memory catalog SELECTs, all tool-dispatch writes (load_skill/save_skill/read_skill_file/execute_code/remember/recall/query_tables), `_persist_assistant_message` (now async) INSERT, post-loop `updated_at` and title writes
- ROADMAP Success Criterion 2 fully delivered: every `supabase-py` `.execute()` inside the SSE path is wrapped with `starlette.concurrency.run_in_threadpool` (via `aexec`)

## Task Commits

1. **Task 1: Async-ify reachable helpers** — `ee8b66a` (feat)
2. **Task 2: Wrap event_stream + pre-stream INSERT** — `6154481` (feat)

## Files Created/Modified

### MOD: backend/app/api/threads.py
- Added `from app.utils.db import aexec` at top of imports
- 22 `.execute()` chains replaced with `await aexec(...)`
- `_persist_assistant_message` converted to `async def`; both call sites (normal-path + shielded-finally) updated to `await`
- Awaited helper calls: `fetch_visible_folders`, `search_documents`, `query_documents`, `resolve_document_id`, `fetch_full_document`, `handle_query_tables`, `ls_path`, `tree_path`, `grep_path`, `glob_path`, `read_path`

### MOD: backend/app/utils/folder_utils.py
- All 3 helpers (`fetch_all_folders`, `fetch_visible_folders`, `get_globally_visible_folder_ids`) converted to `async def`
- `aexec` imported via function-local import inside `fetch_all_folders` to avoid cycle risk (folder_utils is imported by sql_service which is imported by threads.py; aexec lives under same package)
- `is_in_global_subtree` (pure recursion) stays sync per plan

### MOD: backend/app/services/retrieval_service.py
- `_vector_search`, `_keyword_search`, `_enrich_with_filenames`, `resolve_document_id`, `fetch_full_document`, `search_documents` all `async def`
- 7 `await aexec(...)` sites
- `embed_texts` (line ~33 region) and `rerank` (line ~297 region) calls preserved SYNC — out of 058 scope (D-058-01: Supabase only). Documented inline in code comments
- `@traceable` decorator on `search_documents` preserved (langsmith supports async)
- Pure helpers (`_rrf_fuse`, `_deduplicate_chunks`, `_avg_cosine`) stay sync
- `from app.utils.db import aexec` at module top

### MOD: backend/app/services/sql_service.py
- `query_documents` now `async def`; RPC `.execute()` wrapped via `aexec`
- `await get_globally_visible_folder_ids(...)` cascade
- Pure helpers (`_inject_user_id`, `_inject_folder_scope`, `_to_markdown_table`, `_table_ref`) untouched
- `RuntimeError`-from-`Exception` wrap pattern preserved verbatim
- `from app.utils.db import aexec` at module top

### MOD: backend/app/services/audit_service.py
- `write_audit_entry` body's `.execute()` wrapped via `aexec`. Function was already `async def`. D-05 swallow contract preserved verbatim — `aexec` reraises threadpool exceptions back into the existing `try/except Exception` block
- `from app.utils.db import aexec` at module top

### MOD: backend/app/services/multimodal_service.py
- `_fetch_document_tables` and `handle_query_tables` converted to `async def`
- `await resolve_document_id(...)` and `await _fetch_document_tables(...)` cascade
- `extract_and_store_tables`, `extract_and_store_images`, `extract_tables_from_pdf` (ingestion pipeline) left SYNC per plan — they are not reachable from `event_stream`
- `from app.utils.db import aexec` at module top

### MOD: backend/app/api/folders.py
- 4 `await fetch_visible_folders(...)` sites (lines 17, 29, 43, 216) — bucket 1 (caller already `async def`)

### MOD: backend/app/api/documents.py
- 1 `await get_globally_visible_folder_ids(...)` site (line 303 in `list_documents`) — bucket 1
- `BackgroundTasks.add_task(write_audit_entry, ...)` patterns at lines 277 and 565 unchanged — FastAPI BackgroundTasks accepts async functions natively

### MOD: backend/app/api/kb.py
- `_fetch_visible_folders` wrapper, `ls_path`, `tree_path`, `grep_path`, `glob_path`, `read_path` all converted to `async def` (bucket 2 — forced cascade)
- All `.execute()` chains inside these helpers wrapped via `aexec`
- All `await get_globally_visible_folder_ids(...)` cascades inserted
- All 5 FastAPI route wrappers (`ls`, `tree`, `grep`, `glob_search`, `read`) updated to `await` their respective `*_path` helpers
- `read_path`: also added an `if not result or not result.data` guard since `aexec` returns whatever `.execute()` returns — for `maybe_single()` chains the response can be `None`-ish in edge cases; the new guard mirrors the pre-existing fallback safety

## Helper Migration Summary

### Converted to `async def` (13 in-scope per plan):

| Helper | File | Status |
|---|---|---|
| `fetch_all_folders` | `utils/folder_utils.py` | `async def` |
| `fetch_visible_folders` | `utils/folder_utils.py` | `async def` |
| `get_globally_visible_folder_ids` | `utils/folder_utils.py` | `async def` |
| `_vector_search` | `services/retrieval_service.py` | `async def` |
| `_keyword_search` | `services/retrieval_service.py` | `async def` |
| `_enrich_with_filenames` | `services/retrieval_service.py` | `async def` |
| `resolve_document_id` | `services/retrieval_service.py` | `async def` |
| `fetch_full_document` | `services/retrieval_service.py` | `async def` |
| `search_documents` | `services/retrieval_service.py` | `async def` |
| `query_documents` | `services/sql_service.py` | `async def` |
| `write_audit_entry` | `services/audit_service.py` | already `async def`; body wrapped |
| `_fetch_document_tables` | `services/multimodal_service.py` | `async def` |
| `handle_query_tables` | `services/multimodal_service.py` | `async def` |

### Cascade-forced async (6 helpers, all in `api/kb.py`):

| Helper | Why | Bucket |
|---|---|---|
| `_fetch_visible_folders` | Wraps `fetch_visible_folders` (now async) | 2 (sync def → async def) |
| `ls_path` | Calls `_fetch_visible_folders` + `get_globally_visible_folder_ids` | 2 |
| `tree_path` | Calls `_fetch_visible_folders` + `get_globally_visible_folder_ids` | 2 |
| `grep_path` | Calls `_fetch_visible_folders` (when path scoped) | 2 |
| `glob_path` | Calls `_fetch_visible_folders` + `get_globally_visible_folder_ids` | 2 |
| `read_path` | Calls `get_globally_visible_folder_ids` | 2 |

### Confirmed out-of-scope (zero changes — D-058-01):

- `backend/app/services/sub_agent_service.py` — no Supabase `.execute()` calls; OpenAI sync iterator deferred to Phase 059
- `backend/app/models/user_settings.py` (`load_user_settings`) — disk I/O only

`git diff --stat` confirms zero changes to both files.

## Step F Caller-Cascade Audit Result

Audit ran the plan-specified greps for each converted helper. Findings:

| Helper | Non-test caller location | Bucket | Action |
|---|---|---|---|
| `fetch_visible_folders` | `api/folders.py:17,29,43,216` | 1 | added `await` |
| `fetch_visible_folders` | `api/threads.py:543` | 1 | added `await` (Task 2) |
| `fetch_visible_folders` | `api/kb.py:_fetch_visible_folders` wrapper | 2 | wrapper converted to async |
| `get_globally_visible_folder_ids` | `api/documents.py:303` (`list_documents`) | 1 | added `await` |
| `get_globally_visible_folder_ids` | `api/kb.py:ls_path/tree_path/glob_path/read_path` | 2 | callers cascade-converted |
| `get_globally_visible_folder_ids` | `services/sql_service.py:query_documents` | 1 (caller now async) | added `await` |
| `search_documents` | `api/threads.py:1095` | 1 | added `await` (Task 2) |
| `query_documents` | `api/threads.py:1133` | 1 | added `await` (Task 2) |
| `resolve_document_id` | `api/threads.py:1137` | 1 | added `await` (Task 2) |
| `resolve_document_id` | `services/multimodal_service.py:handle_query_tables` (now async) | 1 | added `await` |
| `fetch_full_document` | `api/threads.py:1141` | 1 | added `await` (Task 2) |
| `handle_query_tables` | `api/threads.py:1603` | 1 | added `await` (Task 2) |
| `_fetch_document_tables` | `services/multimodal_service.py:handle_query_tables` (now async) | 1 | added `await` |
| `write_audit_entry` | `api/threads.py:asyncio.create_task` (5 sites) | n/a | unchanged — was already async; create_task pattern correct |
| `write_audit_entry` | `api/documents.py/feedback.py/settings.py:background_tasks.add_task` | n/a | unchanged — FastAPI BackgroundTasks supports async natively |

No Bucket 3 callers (pure helpers that don't `await`) were encountered.

## OpenAI/Sync calls left unwrapped (out of 058 per D-058-01)

| Call | Location | Reason |
|---|---|---|
| `embed_texts` | `services/retrieval_service.py:_vector_search` | OpenAI sync HTTP call — not Supabase `.execute()` |
| `rerank` | `services/retrieval_service.py:search_documents` | OpenAI/Cohere sync HTTP call — not Supabase `.execute()` |
| `client.chat.completions.create` | `threads.py` (multiple) | OpenAI streaming SDK — Phase 059 territory |
| `stream_anthropic` | `threads.py` (Anthropic path) | Anthropic streaming SDK — Phase 059 territory |
| `run_sub_agent` | `services/sub_agent_service.py` | Sync `Generator[str,None,None]` over OpenAI stream — Phase 059 |
| `load_user_settings` | `models/user_settings.py` | Disk I/O — microseconds, not credible event-loop blocker |
| `supabase.storage.from_(...).download(...)` | `threads.py:execute_code/read_skill_file` | Storage HTTP call (not `.execute()` chain). Sync today. Could be wrapped in a future pass; out of 058 scope |
| `session.execute_command`, `session.run` | `threads.py:execute_code` (sandbox) | Already runs via `loop.run_in_executor` (line 1414) — non-blocking by design |

## Decisions Made

- **Task 1 cascade includes kb.py**: Plan 02's `<interfaces>` says "Plan 02 audits the call graph and updates ALL callers — but ONLY for the helpers listed above." kb.py's `_fetch_visible_folders` directly wraps `fetch_visible_folders`, and kb.py's `ls_path/tree_path/etc.` call into `_fetch_visible_folders` and `get_globally_visible_folder_ids`. The cascade is forcing — keeping them sync would raise `RuntimeError: coroutine was never awaited` at runtime. Bucket 2 cascade applied.
- **Test files NOT touched**: Plan 03 owns mock_builder updates per Plan 02 Step F directive.
- **`read_path` defensive guard**: When `maybe_single()` is wrapped via `aexec`, the response shape under tests with mocks can vary. Added `if not result or not result.data` (was `if not result.data`) for both branches — purely defensive, mirrors pre-existing behavior.

## Deviations from Plan

None functional. One minor defensive tweak (`read_path` `not result or` guard) — documented above under Decisions.

The cascade scope (kb.py async-ification) was explicitly anticipated by Plan 02's `<interfaces>` section ("Bucket 2 — convert to async def, recursively update callers") and `must_haves.truths` #6 ("Non-SSE call sites of converted helpers are migrated only when forced by the `async def` signature change"). Documented in this SUMMARY for Plan 03 awareness.

## Issues Encountered

None blocking. The worktree shell does not have a `.env`, so all runtime probes used stub `SUPABASE_URL=http://stub SUPABASE_SERVICE_ROLE_KEY=stub` env vars — sufficient for `inspect.iscoroutinefunction` checks and module-import smoke tests. Full integration test runtime (with real Supabase mocks) is Plan 03's beat.

## Verification Results

- All 19 helpers (13 plan + 6 cascade) confirmed coroutine functions via `inspect.iscoroutinefunction`
- `app.api.threads`, `app.utils.db`, `app.services.*`, `app.api.kb/folders/documents` all import without error
- Send-message scope sweep: zero raw `.execute()` inside `send_message` / `event_stream` body
- `pytest tests/integration/test_threads.py --collect-only`: 14 tests collected (no import errors)
- `git diff --stat backend/app/services/sub_agent_service.py backend/app/models/user_settings.py`: empty (zero changes)

### Acceptance Criteria — Task 1

| Criterion | Result |
|---|---|
| `async def fetch_all_folders` | 1 ✓ |
| `async def fetch_visible_folders` | 1 ✓ |
| `async def get_globally_visible_folder_ids` | 1 ✓ |
| `.execute()` count in folder_utils.py | 0 ✓ |
| `async def _vector_search/_keyword_search/search_documents/resolve_document_id/fetch_full_document` | 5 ✓ |
| `await aexec` count in retrieval_service.py | 7 (≥5 required) ✓ |
| `async def query_documents` | 1 ✓ |
| `await aexec` in sql_service.py | 1 ✓ |
| `await get_globally_visible_folder_ids` in sql_service.py | 1 ✓ |
| `await aexec` in audit_service.py | 1 ✓ |
| Raw `.execute()` in audit_service.py (excl. comments) | 0 ✓ |
| `async def _fetch_document_tables/handle_query_tables` | 2 ✓ |
| `await resolve_document_id`, `await _fetch_document_tables` in multimodal | 2 ✓ |
| `extract_and_store_tables` async (must be 0 — stays sync) | 0 ✓ |

### Acceptance Criteria — Task 2

| Criterion | Result |
|---|---|
| `from app.utils.db import aexec` | 1 ✓ |
| `await aexec` count | 22 (≥15 required) ✓ |
| `async def _persist_assistant_message` | 1 ✓ |
| `await fetch_visible_folders` | 1 ✓ |
| `await search_documents` | 1 ✓ |
| `await query_documents` | 1 ✓ |
| `await handle_query_tables` | 1 ✓ |
| `git diff --stat sub_agent_service.py user_settings.py` | empty ✓ |

## Next Phase Readiness

- **Plan 03** can now wire the integration test (`httpx.AsyncClient(app=app)` cross-tab GET) without changes to threads.py/event_stream — the SSE path is non-blocking after this plan
- Test-side updates Plan 03 will need:
  - Mock `mock_builder.execute.side_effect` queues may need re-ordering since helpers are now awaited (call ordering preserved, but mocks built around `_vector_search`/`_keyword_search`/etc. must return awaitables-compatible mocks or use `AsyncMock`)
  - `kb.py` test mocks (`tests/integration/test_kb.py`) likely need similar adjustments since `ls_path`/`tree_path`/etc. are now async
- ROADMAP Success Criterion 1 (cross-tab GET <1s while SSE streams) is enabled by this plan — Plan 03 verifies it

## Self-Check: PASSED

Files created/modified verified:
- `backend/app/utils/folder_utils.py` ✓ FOUND (modified)
- `backend/app/services/retrieval_service.py` ✓ FOUND
- `backend/app/services/sql_service.py` ✓ FOUND
- `backend/app/services/audit_service.py` ✓ FOUND
- `backend/app/services/multimodal_service.py` ✓ FOUND
- `backend/app/api/threads.py` ✓ FOUND
- `backend/app/api/folders.py` ✓ FOUND
- `backend/app/api/documents.py` ✓ FOUND
- `backend/app/api/kb.py` ✓ FOUND

Commits verified:
- `ee8b66a` (Task 1) ✓ FOUND in git log
- `6154481` (Task 2) ✓ FOUND in git log

---
*Phase: 058-backend-sse-concurrency-fix*
*Plan: 02*
*Completed: 2026-05-01*
