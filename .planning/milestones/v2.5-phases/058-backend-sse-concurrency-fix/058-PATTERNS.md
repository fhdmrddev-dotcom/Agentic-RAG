# Phase 058: Backend SSE Concurrency Fix - Pattern Map

**Mapped:** 2026-05-01
**Files analyzed:** 7 in-scope files (1 NEW helper, 1 NEW test, 5 MOD)
**Analogs found:** 7 / 7

Driven by: `.planning/phases/058-backend-sse-concurrency-fix/058-CONTEXT.md` (decisions D-058-01..11) and `.planning/research/058-sse-concurrency-research.md` §A1–A2.

Knowledge graph used: `graphify-out/GRAPH_REPORT.md` — anchored Community 10 (lifespan + main.py monkey-patch precedent), Community 21 (Settings + pydantic-settings env_file), Community 23 (threads.py SSE integration tests), Community 30 (audit_service async + swallow), Community 11 (`_collect_sse_events` helper for SSE assertion shape).

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| **NEW** `backend/app/utils/db.py` (Claude's Discretion on exact path) | utility (db helper) | request-response (await wrapper around sync `.execute()`) | `backend/app/services/audit_service.py` (async function over `.insert(...).execute()`) and `backend/app/main.py:17–40` `_patch_postgrest_maybe_single` (centralized layer over `.execute()`) | role-match (no existing async sync→thread wrapper exists yet — analog establishes "centralized indirection over `.execute()`" precedent) |
| **MOD** `backend/app/api/threads.py` (line 511 INSERT, line 520 `event_stream`) | controller / SSE handler | streaming + CRUD | self (existing handler, in scope per D-058-01/D-058-02) — neighboring `async generator` style at `threads.py:520` is the in-place pattern | exact (file is itself the canonical SSE handler — wrap-in-place) |
| **MOD** `backend/app/main.py` (lifespan at line 50) | startup / config | lifespan hook | `backend/app/main.py:49–56` (existing `lifespan` async context manager already there for sandbox shutdown) | exact (extend existing hook) |
| **MOD** `backend/app/config.py` (Settings class line 128) | config | env-driven settings field | `config.py:200–227` existing fields like `retrieval_top_k`, `hybrid_candidate_count`, `sandbox_ttl_minutes` (all `int = <default>` on `Settings(BaseSettings)` with `env_file=".env"`) | exact (single-line addition, identical shape) |
| **MOD** `backend/app/utils/folder_utils.py` (`fetch_visible_folders`, `fetch_all_folders`) | helper / utility | request-response (`.execute()` calls) | self — sync helper currently called from `event_stream`; planner decides per-helper async vs call-site wrap (CONTEXT `<code_context>`) | exact |
| **MOD** `backend/app/services/audit_service.py` (`write_audit_entry`) | service | fire-and-forget audit write | self — already `async def`; just wrap the `.insert(...).execute()` line 31–35 | exact |
| **MOD** `backend/app/services/retrieval_service.py` (`_vector_search`, `_keyword_search`, `_enrich_with_filenames`, `resolve_document_id`, `fetch_full_document`, `search_documents`) | service | request-response (RPC + table queries) | self — sync funcs called from `event_stream`; cross helper boundary | exact |
| **MOD** `backend/app/services/sql_service.py` (`query_documents`) | service | request-response (RPC) | self — sync function with one `.rpc(...).execute()` call at line 122 | exact |
| **MOD** `backend/app/services/sub_agent_service.py` (`run_sub_agent`) | service | streaming generator | self — sync `Generator[str, None, None]`. **NB:** does not call `supabase.execute()`; it calls `client.chat.completions.create(stream=True)`. Wrap scope is bounded to Supabase `.execute()` per D-058-01; sub_agent is in scope only because `event_stream` iterates it on the loop. Planner verifies. | role-match (review for sync DB calls) |
| **MOD** `backend/app/services/multimodal_service.py` (`extract_and_store_tables`, `extract_and_store_images`, etc.) | service | CRUD writes during ingestion | self — currently sync. **In SSE scope only if reachable from `event_stream`**. Per CONTEXT, `multimodal_service` is listed in scope; planner audits whether SSE path actually reaches it. If not reached, drop from 058 wrap (deferred). | partial (scope-confirm needed) |
| **MOD** `backend/app/models/user_settings.py` (`load_user_settings`) | helper | settings load (currently disk JSON, not Supabase — line 306 calls `load_app_settings()`) | self — currently NOT a Supabase call. **No `.execute()` to wrap.** Planner confirms it does not need wrapping; it remains sync I/O only. | partial (likely no-op for 058) |
| **NEW** `backend/tests/integration/test_058_concurrency.py` | test (integration) | async test against `httpx.AsyncClient` | `backend/tests/integration/test_threads.py:193–264` (`test_sse_stream_contains_delta_events` — uses `client.stream(...)` with patched LLM stream); `backend/tests/integration/test_threads_skills.py:82–91` (`_collect_sse_events` helper); `backend/tests/unit/test_audit_service.py:23–72` (`@pytest.mark.asyncio` + AsyncClient pattern + `pytest-asyncio` already in requirements.txt:18) | role-match (no existing `httpx.AsyncClient` test — current SSE tests use sync `TestClient`; new test must adopt the AsyncClient pattern from D-058-09) |

---

## Pattern Assignments

### NEW: `backend/app/utils/db.py` — `aexec(query)` helper

**Role:** utility • **Data flow:** request-response (sync `.execute()` → awaitable)

**Primary analog:** `backend/app/services/audit_service.py` (entire file, 38 lines) — establishes the "thin async wrapper module that owns one Supabase concern" pattern.

**Secondary analog:** `backend/app/main.py:17–40` (`_patch_postgrest_maybe_single`) — the existing centralized layer over `SyncSingleRequestBuilder.execute`. Per CONTEXT canonical refs, the new `aexec` helper must coexist with this patch (both wrap `execute`, but the postgrest patch only intercepts a 204-error edge case and is orthogonal to the threadpool wrap).

**Imports pattern** (audit_service.py:1–9 — copy as-is for module shape):
```python
"""<one-line module docstring>"""
import logging
# (no need for supabase Client import; aexec receives an opaque query object)

logger = logging.getLogger(__name__)
```

**Core pattern** (specified verbatim by D-058-03 in CONTEXT.md):
```python
from starlette.concurrency import run_in_threadpool

async def aexec(query):
    """Run a sync supabase-py query off the event loop.

    Wraps query.execute() in run_in_threadpool so the SSE handler does not
    block the asyncio event loop on Postgres round-trips. Symmetric with the
    sync .execute() name; pairs naturally at call sites:

        data = await aexec(supabase.table("x").select("*").eq("id", uid))
    """
    return await run_in_threadpool(query.execute)
```

**Coexistence pattern** (`main.py:17–40` — informational, the new helper does NOT replace this):
```python
def _patch_postgrest_maybe_single():
    """Fix postgrest-py bug: maybe_single() raises APIError on 204 (no rows) instead of returning None."""
    try:
        from postgrest._sync.request_builder import SyncSingleRequestBuilder
        from postgrest.exceptions import APIError
        _orig = SyncSingleRequestBuilder.execute
        def _safe(self):
            try:
                return _orig(self)
            except APIError as e:
                if getattr(e, "code", None) == "204":
                    class _Empty:
                        data = None
                        count = None
                    return _Empty()
                raise
        SyncSingleRequestBuilder.execute = _safe
    except Exception:
        pass

_patch_postgrest_maybe_single()
```
The patch wraps `SyncSingleRequestBuilder.execute` at import time. `aexec` calls `query.execute()` from a worker thread, which still hits the patched method — both layers compose cleanly. The PATTERNS layer for 058 is additive on top of this precedent, NOT a replacement.

---

### MOD: `backend/app/api/threads.py` — wrap `.execute()` in `event_stream` and pre-stream INSERT

**Role:** controller / SSE handler • **Data flow:** streaming (async generator) + CRUD INSERT before stream

**Primary analog:** itself. The `event_stream` function (line 520) is already an `async generator` — per CONTEXT `<code_context>` it CAN `await` between yields, so wrapping inline calls with `await aexec(...)` is mechanically straightforward.

**Imports pattern** to add (threads.py top — analog: existing imports at threads.py:1–39):
```python
from app.utils.db import aexec  # NEW — D-058-03
```

**Pre-stream INSERT wrap** (threads.py:511, in scope per D-058-02). Today:
```python
# Insert user message
supabase.table("messages").insert({
    "thread_id": thread_id,
    "user_id": current_user["id"],
    "role": "user",
    "content": body.content,
}).execute()
```
Wrap to:
```python
# Insert user message
await aexec(
    supabase.table("messages").insert({
        "thread_id": thread_id,
        "user_id": current_user["id"],
        "role": "user",
        "content": body.content,
    })
)
```

**Inside `event_stream` generator wrap** (threads.py:530–536, 569–576, 602–609, 624–631, 718, 1182–1190, 1202–1208, 1222–1230, 1234–1245, 1251–1258, 1264–1271, 1355–1362, 1369–1376, and the thread-ownership SELECT at 499–506). Today:
```python
thread_data = (
    supabase.table("threads")
    .select("folder_id")
    .eq("id", thread_id)
    .single()
    .execute()
)
```
Wrap to:
```python
thread_data = await aexec(
    supabase.table("threads")
    .select("folder_id")
    .eq("id", thread_id)
    .single()
)
```

**Persistence path inside `_persist_assistant_message` closure** (threads.py:687–720). Today (line 718):
```python
try:
    supabase.table("messages").insert(row).execute()
except Exception as e:
    logger.error("Failed to persist assistant message: %s", e)
```
NOTE: `_persist_assistant_message` is currently a `def` (sync), called from the async generator's `finally`. Planner must either (a) make it `async def` and `await _persist_assistant_message()`, or (b) keep sync and wrap the body's `.execute()` with `run_in_threadpool` at call site. Decision belongs to planner per CONTEXT Claude's Discretion ("Whether to also wrap a tiny number of synchronous helpers"). Recommended: make it `async def`, then `await aexec(supabase.table("messages").insert(row))` and wrap with `try/except` exactly as today.

**Skills catalog SELECT** (threads.py:602–609 — pattern repeats for `user_memory` 624–631):
```python
enabled_skills = (
    supabase.table("skills")
    .select("name, description")
    .or_(f"user_id.eq.{current_user['id']},is_global.eq.true")
    .eq("is_enabled", True)
    .order("name")
    .execute()
).data or []
```
→
```python
_skills_resp = await aexec(
    supabase.table("skills")
    .select("name, description")
    .or_(f"user_id.eq.{current_user['id']},is_global.eq.true")
    .eq("is_enabled", True)
    .order("name")
)
enabled_skills = _skills_resp.data or []
```
The `.data or []` post-access stays as-is — `aexec` returns the same response object as `.execute()`.

**Tool dispatch pattern** (threads.py:1182–1190, repeats for every tool case): `load_skill`, `save_skill`, `read_skill_file`, `execute_code`'s `skill_files` injection, all currently use the same `(...).execute()` pattern inside the for-loop. Each one wraps identically with `await aexec(...)`.

**Helper boundary call** (threads.py:543):
```python
all_folders = fetch_visible_folders(supabase, current_user["id"])
```
Per CONTEXT, two options — planner picks one and applies consistently:
- **Option A (preferred — symmetric with `aexec`):** make `fetch_visible_folders` `async def`, wrap its internal `.execute()` calls with `await aexec(...)`, then call site becomes `await fetch_visible_folders(supabase, current_user["id"])`.
- **Option B:** keep helper sync, wrap at call site: `await run_in_threadpool(fetch_visible_folders, supabase, current_user["id"])`.

**Stop-event pattern (UNCHANGED — already correct):** `stop_event` checks at threads.py:748, 815, 871 are already in place from prior phases and are the cancellation mechanism the SSE response uses. Do NOT touch them.

---

### MOD: `backend/app/main.py` — lifespan hook bumps AnyIO limiter

**Role:** startup • **Data flow:** lifespan hook

**Analog:** `backend/app/main.py:49–56` (existing `lifespan` async context manager — extend, do not replace).

Today:
```python
@asynccontextmanager
async def lifespan(app_instance):
    # Startup: nothing to do — sandbox sessions created on demand
    yield
    # Shutdown: close all open sandbox sessions to free Docker containers
    if settings.sandbox_enabled:
        from app.services.sandbox_service import sandbox_manager
        sandbox_manager.close_all()
```

Pattern from D-058-07 (apply at the marked startup spot):
```python
import anyio  # at top of main.py near other imports

@asynccontextmanager
async def lifespan(app_instance):
    # Startup: bump AnyIO default thread limiter so SSE-path .execute() wraps
    # don't queue at the 40-token default (research §A2). Env-overridable via
    # ANYIO_THREAD_TOKENS.
    anyio.to_thread.current_default_thread_limiter().total_tokens = (
        settings.anyio_thread_tokens
    )
    yield
    # Shutdown: close all open sandbox sessions to free Docker containers
    if settings.sandbox_enabled:
        from app.services.sandbox_service import sandbox_manager
        sandbox_manager.close_all()
```

D-058-08 explicitly rejects module-level limiter sets — keep it inside `lifespan`.

---

### MOD: `backend/app/config.py` — add `anyio_thread_tokens` to Settings

**Role:** config • **Data flow:** env-overridable settings field

**Analog:** existing fields on `Settings(BaseSettings)` at config.py:200–227. Same shape: `<name>: int = <default>`. The env var name follows pydantic-settings auto-uppercase convention from `SettingsConfigDict(env_file=".env", ...)` at line 129.

Existing pattern (config.py:201–209 — copy field shape):
```python
# Retrieval settings
retrieval_top_k: int = 5
retrieval_match_threshold: float = 0.3

# Hybrid search (vector + keyword with RRF fusion)
hybrid_search_enabled: bool = True
hybrid_candidate_count: int = 20  # candidates from each method before fusion
```

Add (placement: anywhere within `Settings` class, e.g. near "Sandbox" block at config.py:226–228 or under a new "Concurrency" comment header):
```python
# Concurrency (Phase 058 — D-058-07)
# Total AnyIO thread-pool tokens. FastAPI defaults to 40, which is the ceiling
# for concurrent in-flight blocking .execute() calls when wrapped in
# run_in_threadpool. SSE chat with parallel tool calls + ingestion + audit
# writes can exceed 40 quickly; 200 gives headroom until async client migration
# (CONCUR-03). Override in .env: ANYIO_THREAD_TOKENS=<int>.
anyio_thread_tokens: int = 200
```

The `pydantic-settings` `env_file=".env"` config at line 129 lights up `ANYIO_THREAD_TOKENS` automatically — no validator or extra wiring needed.

---

### MOD: `backend/app/utils/folder_utils.py` — async-ify or wrap

**Role:** utility helper • **Data flow:** request-response

**Analog:** itself (in scope; very small file, all 51 lines already in context).

If planner picks Option A (helper becomes async — preferred), the pattern across the three helpers is uniform:
```python
# fetch_all_folders — sync version today (line 8–10)
def fetch_all_folders(supabase: "Client", fields: str = "id, user_id, name, parent_id, is_global") -> list[dict]:
    """Fetch ALL folders using service role key (no RLS). Returns everything."""
    return supabase.table("folders").select(fields).execute().data or []
```
becomes:
```python
async def fetch_all_folders(supabase: "Client", fields: str = "id, user_id, name, parent_id, is_global") -> list[dict]:
    """Fetch ALL folders using service role key (no RLS). Returns everything."""
    from app.utils.db import aexec  # local import to avoid circular if aexec lives in same package
    resp = await aexec(supabase.table("folders").select(fields))
    return resp.data or []
```
`fetch_visible_folders` and `get_globally_visible_folder_ids` (lines 32–51) follow identically — they call `fetch_all_folders` so they only need `await` added and `async def` signature.

**Cross-cutting concern:** every other module that calls these three helpers must also be checked (`sql_service.py:114` calls `get_globally_visible_folder_ids`, `kb.py` calls them too). Per CONTEXT D-058-01, **only call sites reachable from `event_stream` need to be migrated in 058**; non-SSE call sites can remain sync (they call helpers in their own threadpooled `def` endpoints). Planner audits.

---

### MOD: `backend/app/services/audit_service.py` — wrap `.execute()`

**Role:** service • **Data flow:** fire-and-forget audit write

**Analog:** itself (already `async def` — perfect candidate for the simplest possible wrap).

Existing (audit_service.py:20–37):
```python
async def write_audit_entry(
    user_id: str,
    action_type: str,
    metadata: dict,
    supabase: Client,
) -> None:
    """Write a single audit log entry.

    Exceptions are caught, logged to stderr, and swallowed (D-05).
    """
    try:
        supabase.table("audit_log").insert({
            "user_id": user_id,
            "action_type": action_type,
            "metadata": metadata,
        }).execute()
    except Exception as exc:
        logger.error("audit write failed [action=%s user=%s]: %s", action_type, user_id, exc)
```

Wrap to:
```python
async def write_audit_entry(
    user_id: str,
    action_type: str,
    metadata: dict,
    supabase: Client,
) -> None:
    """Write a single audit log entry.

    Exceptions are caught, logged to stderr, and swallowed (D-05).
    """
    from app.utils.db import aexec
    try:
        await aexec(supabase.table("audit_log").insert({
            "user_id": user_id,
            "action_type": action_type,
            "metadata": metadata,
        }))
    except Exception as exc:
        logger.error("audit write failed [action=%s user=%s]: %s", action_type, user_id, exc)
```
The `try/except Exception` swallow contract from D-05 is preserved verbatim. Test contract from `tests/unit/test_audit_service.py:60–72` (test_write_audit_entry_swallows_exception) keeps passing because the wrapper still propagates exceptions out of the threadpool back to the caller's try-block.

---

### MOD: `backend/app/services/retrieval_service.py` — wrap five sync `.execute()` sites

**Role:** service • **Data flow:** request-response (Supabase RPC + table SELECT)

**Analog:** itself. Five call sites, all the same shape:

1. `_vector_search` (line 45): `result = supabase.rpc("match_document_chunks", params).execute()`
2. `_keyword_search` (line 67): `result = supabase.rpc("keyword_search_chunks", params).execute()`
3. `_enrich_with_filenames` (line 106): `docs_result = supabase.table("documents").select(...).in_("id", doc_ids).execute()`
4. `resolve_document_id` (lines 165–173 and 177–185): two near-identical SELECT chains
5. `fetch_full_document` (lines 199–206 and 216–222): `single().execute()` and chunks fallback

**Pattern** — convert each helper to `async def`, wrap with `aexec`:
```python
# Today (lines 23–46)
def _vector_search(query, user_id, supabase, ...) -> list[dict]:
    query_embedding = embed_texts([query], user_settings=user_settings)[0]
    params: dict = {...}
    result = supabase.rpc("match_document_chunks", params).execute()
    return result.data or []
```
→
```python
async def _vector_search(query, user_id, supabase, ...) -> list[dict]:
    query_embedding = embed_texts([query], user_settings=user_settings)[0]  # already sync — keep as-is or wrap separately if it does I/O
    params: dict = {...}
    result = await aexec(supabase.rpc("match_document_chunks", params))
    return result.data or []
```

**Cascade:** `search_documents` (line 234, the entry point called from `event_stream` at threads.py:1095) becomes `async def` and `await`s its helpers. The `@traceable(name="search-documents", run_type="retriever")` decorator from langsmith on line 233 is compatible with `async def` (langsmith supports both).

**Note on `embed_texts` (retrieval_service.py:33):** this calls `client.embeddings.create(...)` (OpenAI sync SDK). Per CONTEXT D-058-01, the wrap closure is "every helper/service the SSE path reaches" — but D-058-01 also calls out specifically Supabase `.execute()` as the wrap target. Embedding calls are HTTP I/O via `openai` sync client and are outside 058 scope unless planner audits and decides otherwise. Recommendation: defer to a future phase per CONTEXT `<deferred>` "Backend-wide … audit".

---

### MOD: `backend/app/services/sql_service.py` — wrap `query_documents`

**Role:** service • **Data flow:** request-response (RPC)

**Analog:** itself. One `.execute()` call at line 122 plus a transitive call to `get_globally_visible_folder_ids` at line 114.

Today:
```python
def query_documents(sql_query: str, user_id: str, supabase: Client, folder_ids: list[str] | None = None) -> str:
    ...
    global_folder_ids = get_globally_visible_folder_ids(supabase, user_id)
    scoped = _inject_user_id(clean, user_id, global_folder_ids)
    if folder_ids:
        scoped = _inject_folder_scope(scoped, folder_ids)

    try:
        result = supabase.rpc("query_user_documents", {"sql_query": scoped}).execute()
    except Exception as e:
        raise RuntimeError(f"Database query failed: {e}") from e
    rows: list[dict] = result.data or []
    ...
```

Wrap pattern (consistent with retrieval_service):
```python
async def query_documents(sql_query: str, user_id: str, supabase: Client, folder_ids: list[str] | None = None) -> str:
    from app.utils.db import aexec
    ...
    global_folder_ids = await get_globally_visible_folder_ids(supabase, user_id)  # if planner async-ifies the helper
    scoped = _inject_user_id(clean, user_id, global_folder_ids)
    if folder_ids:
        scoped = _inject_folder_scope(scoped, folder_ids)

    try:
        result = await aexec(supabase.rpc("query_user_documents", {"sql_query": scoped}))
    except Exception as e:
        raise RuntimeError(f"Database query failed: {e}") from e
    rows: list[dict] = result.data or []
    ...
```
Call site at `threads.py:1133` becomes `tool_result = await query_documents(args["query"], current_user["id"], supabase, folder_ids=folder_subtree_ids)`.

The `RuntimeError`-from-`Exception` wrapping pattern at line 124 is preserved unchanged.

---

### MOD: `backend/app/services/sub_agent_service.py` — verify scope, no Supabase `.execute()` to wrap

**Role:** service • **Data flow:** streaming generator over LLM client

**Analog:** itself. `run_sub_agent` (sub_agent_service.py:17–105) is a sync `Generator[str, None, None]` that calls `client.chat.completions.create(stream=True)` — it does NOT call `supabase.execute()`. Iterating its `for chunk in stream` loop on the event loop (as `event_stream` does at threads.py:1159) blocks the loop on each chunk until `client.chat.completions` yields.

**Scope decision:** D-058-01 wrap target is "Supabase `.execute()` calls". `run_sub_agent` has none. The blocking issue here is the OpenAI SDK iterator, not Supabase. Per CONTEXT this falls under the deferred "Migration to asyncpg / async Supabase client" item AND the broader question of async LLM SDKs (not in 058 scope).

**Recommendation for planner:** flag as out-of-scope for 058, document in plan, defer. If 058 verification (D-058-09 elapsed < 1.0s) fails because of this iteration, escalate as a 058-blocker; otherwise leave to Phase 059 (`asyncio.Queue` + background task pattern from research §A3 puts the agent loop on a background task, automatically off the SSE coroutine).

---

### MOD: `backend/app/services/multimodal_service.py` — verify SSE-path reachability

**Role:** service • **Data flow:** CRUD writes during ingestion

**Analog:** itself. Inspecting `extract_and_store_tables` (multimodal_service.py:87–) shows it's called from the document ingestion pipeline, NOT from `event_stream`. CONTEXT lists `multimodal_service` as in-scope but the actual reachability from `event_stream` is unclear from the code reads.

**Scope decision:** planner must trace whether any function in `multimodal_service.py` is reachable from any tool dispatch case in `event_stream` (threads.py:1055–end). If not reachable, drop from 058 wrap and put in the broader audit deferred queue. If reachable (e.g. via a hypothetical `extract_*` tool), wrap each `.execute()` site identically to retrieval_service.

---

### MOD: `backend/app/models/user_settings.py` — `load_user_settings` is disk I/O, no wrap needed

**Role:** helper • **Data flow:** disk read (settings_override.json) + env reads

**Analog:** itself. Line 306–307:
```python
def load_user_settings(user_id: str, supabase=None) -> UserEffectiveSettings:
    return load_app_settings()
```
delegates entirely to `load_app_settings()` which reads `settings_override.json` from disk and merges with `env_settings`. No Supabase `.execute()` calls.

**Scope decision:** no wrap needed in 058. Disk I/O via Python's `Path.read_text` is fast (microseconds) and not a credible event-loop blocker. Document in plan as "no-change". CONTEXT lists it because it's called from `event_stream` at threads.py:525 — but the call is non-blocking enough to leave alone. Planner confirms.

---

### NEW: `backend/tests/integration/test_058_concurrency.py`

**Role:** test (integration) • **Data flow:** async test using `httpx.AsyncClient`

**Primary analog:** `backend/tests/integration/test_threads.py:193–264` (`test_sse_stream_contains_delta_events`) — current pattern for SSE-stream assertion in this codebase. **NB:** uses sync `TestClient`, not `AsyncClient`. The new test is the first `httpx.AsyncClient` test in the repo.

**Secondary analog:** `backend/tests/integration/test_threads_skills.py:82–91` (`_collect_sse_events` helper — useful for parsing SSE output if not using the `slow_mock_llm` sentinel).

**Tertiary analog:** `backend/tests/unit/test_audit_service.py:23–72` — `@pytest.mark.asyncio` decorator usage and the existing `pytest-asyncio` (requirements.txt:18) + `httpx>=0.27.0` (requirements.txt:19) dependencies confirm the toolchain is already in place.

**Existing SSE-test imports** (test_threads.py:1–8 — copy import shape):
```python
"""Integration tests for /threads endpoints."""
import json
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest
```

**Existing SSE assertion pattern** (test_threads.py:193–227 — verbatim, the structure to mirror):
```python
def test_sse_stream_contains_delta_events(self, client, auth_headers, mock_builder):
    """SSE stream yields data: {...} lines and ends with data: [DONE]."""
    mock_builder.execute.side_effect = [
        _make_result(_thread_row()),             # thread ownership check
        _make_result([_message_row()]),          # insert user message
        _make_result({"folder_id": None}),       # thread folder scope (single)
        _make_result([{"role": "user", "content": "Hello"}]),
        _make_result([]),                        # skills catalog
        _make_result([]),                        # user_memory
        _make_result([_message_row("assistant", "Hi!")]),
        _make_result([]),                        # touch thread updated_at
    ]
    stream_chunks = [_make_sse_chunk("Hi"), _make_sse_chunk("!"), _make_done_chunk()]
    with patch("app.api.threads.create_streaming_chat", return_value=iter(stream_chunks)):
        with client.stream("POST", f"/threads/{THREAD_ID}/messages",
                           json={"content": "Hello"}, headers=auth_headers) as response:
            assert response.status_code == 200
            lines = list(response.iter_lines())
    data_lines = [l for l in lines if l.startswith("data: ")]
    assert len(data_lines) >= 1
```

**New test pattern** (D-058-09 verbatim — adapt by reusing `mock_builder` side_effect lists from test_threads.py for both threads and adopting `httpx.AsyncClient` instead of `TestClient`):
```python
"""Integration test for Phase 058 — cross-tab GET unblocked during SSE.

D-058-09: passes when GET on Thread B's /messages returns < 1.0s while
Thread A's SSE stream is mid-flight with a slow mock LLM.

Uses httpx.AsyncClient (NOT sync TestClient) because we need genuine
asyncio.create_task concurrency; sync TestClient runs requests serially.
"""
import asyncio
import time
from unittest.mock import patch
from uuid import uuid4

import httpx
import pytest

from app.main import app
from tests.conftest import _make_result, _make_supabase, _builder, _execute_result


THREAD_A = str(uuid4())
THREAD_B = str(uuid4())


async def _consume_sse(client: httpx.AsyncClient, thread_id: str):
    """Open the SSE stream and read until [DONE]. Slow mock LLM keeps it open."""
    async with client.stream(
        "POST",
        f"/threads/{thread_id}/messages",
        json={"content": "hello"},
        headers={"Authorization": "Bearer test-token"},
    ) as r:
        async for _ in r.aiter_lines():
            pass


def _slow_chunks():
    """Generator that yields one chunk every 200ms — keeps SSE open ~2s total."""
    import time as _t
    from tests.integration.test_threads import _make_sse_chunk, _make_done_chunk
    for tok in ("a", "b", "c", "d", "e", "f", "g", "h"):
        _t.sleep(0.2)
        yield _make_sse_chunk(tok)
    yield _make_done_chunk()


@pytest.mark.asyncio
async def test_cross_tab_unblocked_during_sse():
    """GET /threads/B/messages returns < 1.0s while Thread A's SSE is streaming.

    Pre-058: GET blocks for the full SSE duration (~2s) because the sync
    .execute() on Thread A's loop call holds the event loop. Post-058:
    GET returns within 1.0s because aexec() puts the .execute() on the
    threadpool, freeing the loop.
    """
    # Configure mocks so both endpoints can resolve their Supabase queries
    # ... (use the existing mock_builder.execute.side_effect lists from
    # test_threads.py:194–204 for the SSE side and a single _thread_row() +
    # message list for the GET side).

    with patch("app.api.threads.create_streaming_chat", return_value=_slow_chunks()):
        async with httpx.AsyncClient(app=app, base_url="http://test") as c:
            sse_task = asyncio.create_task(_consume_sse(c, THREAD_A))
            await asyncio.sleep(0.1)  # let the SSE handler enter the generator

            t0 = time.monotonic()
            r = await c.get(
                f"/threads/{THREAD_B}/messages",
                headers={"Authorization": "Bearer test-token"},
            )
            elapsed = time.monotonic() - t0

            sse_task.cancel()
            try:
                await sse_task
            except (asyncio.CancelledError, Exception):
                pass

    assert elapsed < 1.0, f"GET took {elapsed:.2f}s — SSE is still blocking the loop"
    assert r.status_code == 200
```

**Key adaptation rules:**
- Reuse `_make_result`, `_make_sse_chunk`, `_make_done_chunk` from `tests/integration/test_threads.py:40–65` — they are already imported via the conftest pattern.
- Reuse the `mock_builder.execute.side_effect` queue pattern from test_threads.py:194–204 — but extend it with rows for THREAD_B's GET (one `_thread_row()` + one `_make_result([_message_row(...)])`).
- The `httpx.AsyncClient(app=app, ...)` pattern is required — sync `TestClient` (used everywhere else in this repo) blocks inside a single thread and would not exhibit the bug. This is the **single new dependency-on-a-new-pattern** for 058.
- **Cleanup pattern:** the `try/except` around `sse_task.cancel(); await sse_task` is essential — Starlette + AsyncClient leak the task otherwise. Reference research §A5 ("Always re-raise CancelledError after cleanup").

---

## Shared Patterns

### Centralized async indirection over `.execute()` — D-058-03 helper

**Source:** new `app/utils/db.py::aexec` (this phase) + precedent `app/main.py:17–40` `_patch_postgrest_maybe_single`
**Apply to:** every Supabase `.execute()` reachable from `event_stream` (controllers + services + utils — see scope table at top)

```python
# Pattern: replace .execute() at end of fluent chain with aexec(...) wrapping the chain
data = await aexec(supabase.table("x").select("*").eq("id", uid))  # was: .execute()
```

### Async helper migration — Option A (preferred per planner discretion)

**Source:** `backend/app/services/audit_service.py` (file-level pattern: thin async helper module) + `app/utils/folder_utils.py` migration
**Apply to:** any sync helper that contains `.execute()` AND is reachable from `event_stream`

Each helper transforms identically:
1. Add `async` to `def`.
2. Change every `<chain>.execute()` to `await aexec(<chain>)`.
3. Update every call site reachable from SSE to `await <helper>(...)`. **Non-SSE call sites can stay sync only if the helper itself stays sync** — async-ifying the helper forces all callers to migrate, so the planner traces the call graph and either (a) async-ifies callers in the SSE path AND keeps a sync wrapper for the rest, or (b) accepts that all callers migrate. CONTEXT D-058-01 explicitly bounds 058 to SSE-reachable sites — option (a) preserves that boundary.

### AnyIO limiter bump in `lifespan` — D-058-07

**Source:** new pattern, anchored in `backend/app/main.py:49` existing `lifespan` async context manager.
**Apply to:** main.py only (single global side effect). NOT module-level (D-058-08).

### `pydantic-settings` env-overridable field — D-058-07

**Source:** `backend/app/config.py:200–227` existing fields + `model_config = SettingsConfigDict(env_file=".env", ...)` at line 129.
**Apply to:** `Settings` class — add `anyio_thread_tokens: int = 200` once. `ANYIO_THREAD_TOKENS` env override is automatic.

### SSE integration test scaffolding

**Source:** `backend/tests/integration/test_threads.py:1–264` (sync `TestClient` pattern — for non-concurrency assertions) + `backend/tests/unit/test_audit_service.py:23–72` (`@pytest.mark.asyncio` shape).
**Apply to:** new `test_058_concurrency.py` only; do NOT migrate existing SSE tests to AsyncClient (out of scope).

### Read-after-write fixture state contract

**Source:** `backend/tests/conftest.py:85–132` (`reset_mocks` autouse fixture)
**Apply to:** new test must not pollute `_builder` / `_execute_result` state across tests — let `reset_mocks` autouse handle it; configure `mock_builder.execute.side_effect = [...]` at the start of the test function only.

### CLAUDE.md project-rule alignment

| CLAUDE.md rule | How 058 honors it |
|---|---|
| Python backend `venv` | No new deps; existing `requirements.txt` (httpx, pytest-asyncio, anyio via starlette) covers all 058 needs |
| No LangChain / LangGraph | N/A — 058 only touches Supabase + threadpool wiring |
| Pydantic for structured outputs | N/A — no LLM output structure changes |
| RLS on all tables | N/A — Phase 058 is concurrency, not data-model |
| Stream chat responses via SSE | Preserved — wrap-in-place in `event_stream` does not change emit shape |
| Module 2+ stateless completions | Preserved — history reconstruction at threads.py:569–576 unchanged in shape; just moves to threadpool |

---

## No Analog Found

Files where a strong existing analog does NOT exist and the planner should rely on RESEARCH.md + CONTEXT.md exemplars:

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `backend/app/utils/db.py` (`aexec`) | utility | request-response | First async-over-sync-DB wrapper in this codebase. RESEARCH §A2 + CONTEXT D-058-03 give the verbatim pattern. |
| `backend/tests/integration/test_058_concurrency.py` | test | concurrent async | First `httpx.AsyncClient` test in the repo. RESEARCH §A2 + CONTEXT D-058-09 give the verbatim sketch. |

For everything else, an in-codebase analog exists at the file level (the wrap is in-place).

---

## Metadata

**Analog search scope:**
- `backend/app/api/threads.py` (1791 lines, targeted reads at 1–80, 490–710, 700–1100, 1100–1400)
- `backend/app/main.py` (96 lines, full read)
- `backend/app/config.py` (283 lines, full read)
- `backend/app/services/{audit_service,retrieval_service,sub_agent_service,sql_service,multimodal_service}.py` (targeted reads)
- `backend/app/utils/folder_utils.py` (51 lines, full read)
- `backend/app/models/user_settings.py` (targeted at `load_user_settings`)
- `backend/app/dependencies.py` (31 lines, full read)
- `backend/app/responses.py` (153 lines, full read)
- `backend/tests/conftest.py` (161 lines, full read)
- `backend/tests/integration/test_threads.py` (lines 1–264)
- `backend/tests/integration/test_threads_skills.py` (lines 1–100)
- `backend/tests/unit/test_audit_service.py` (lines 1–90)
- `graphify-out/GRAPH_REPORT.md` (full read — Communities 10, 11, 15, 21, 23, 30 confirmed as relevant clusters)

**Knowledge graph anchors used:**
- Community 10 (lifespan + `_patch_postgrest_maybe_single` precedent — main.py)
- Community 21 (Settings, BaseSettings, model capability)
- Community 23 (threads.py SSE integration tests — `_make_sse_chunk`, `_make_done_chunk`)
- Community 30 (audit_service `write_audit_entry` — async + swallow contract)
- Community 11 (`_collect_sse_events` SSE-event collector helper in test_threads_skills.py)
- Community 18 (sql_service `query_documents` — SQL injection helpers + RPC `.execute()`)
- Community 15 (shared `_make_supabase` / `_make_builder` test fixture conftest pattern)

**Files scanned for `.execute()` reachability from `event_stream`:** 7 (threads.py + 5 services + 1 util). 152-call backend-wide audit explicitly out of scope per D-058-01.

**Pattern extraction date:** 2026-05-01

*Phase: 058-backend-sse-concurrency-fix*
