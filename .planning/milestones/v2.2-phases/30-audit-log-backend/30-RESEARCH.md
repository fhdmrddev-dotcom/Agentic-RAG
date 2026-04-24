# Phase 30: Audit Log — Backend - Research

**Researched:** 2026-04-13
**Domain:** FastAPI BackgroundTasks, Supabase RLS, async fire-and-forget patterns
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01 — Action Type Naming:** Dotted namespace format: `document.upload`, `document.delete`, `search.query`, `code.execute`, `skill.load`, `thread.create`, `thread.delete`, `settings.update`. These 8 values are the complete set.

**D-02 — Action Type Column:** Plain TEXT with a CHECK constraint listing all valid values. No Postgres enum — avoids `ALTER TYPE` friction in future phases.

**D-03 — Audit Service Architecture:** Dedicated `backend/app/services/audit_service.py` with a single async helper function `write_audit_entry()`. Routers import and call this service. Centralized write logic.

**D-04 — Async Mechanism:** FastAPI `BackgroundTasks` for fire-and-forget. Add `background_tasks: BackgroundTasks` as a dependency to each instrumented endpoint. Call `background_tasks.add_task(write_audit_entry, ...)` after the main operation completes.

**D-05 — Failure Handling:** Catch exception, log to stderr, swallow. User's operation is never affected. No retry.

**D-06 — Settings Change Granularity:** One entry per `PUT /settings` call. No field-level diff. Full new settings payload in `metadata` JSONB.

**D-07 — Metadata Schema (Claude's Discretion):**
- `document.upload` — `{document_id, filename, folder_id}`
- `document.delete` — `{document_id, filename}`
- `search.query` — `{query_text, document_ids: [...]}`
- `code.execute` — `{thread_id, language}`
- `skill.load` — `{skill_id, skill_name}`
- `thread.create` — `{thread_id}`
- `thread.delete` — `{thread_id}`
- `settings.update` — `{new_settings: {...}}`

**D-08 — RLS Policy (Claude's Discretion):** Users can INSERT rows where `user_id = auth.uid()`. No SELECT, UPDATE, or DELETE for users. Admin reads use service-role key.

### Claude's Discretion
- Table column set: `id UUID PK`, `user_id UUID FK → auth.users`, `action_type TEXT`, `metadata JSONB`, `created_at TIMESTAMPTZ DEFAULT now()`
- No `updated_at` — audit entries are immutable
- Index on `(user_id, created_at DESC)` for Phase 31 pagination
- `write_audit_entry()` function signature and internal implementation details

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope. Phase 31 covers AUDIT-04 (viewer UI) and AUDIT-05 (CSV export).
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUDIT-01 | All significant user actions are automatically logged: document upload, document delete, search query, code execution, skill load, thread create, thread delete, settings change | 8 instrumentation points across 4 router files; `audit_service.py` write_audit_entry() called via BackgroundTasks |
| AUDIT-02 | Search query audit entries include the query text and IDs of documents retrieved | `search_documents` results in `threads.py:720-746` already collect `document_id` per hit; pass `args["query"]` + extracted IDs to audit entry |
| AUDIT-03 | Audit entries cannot be deleted or modified through any user-accessible API endpoint | RLS INSERT-only policy on `audit_log` table; no DELETE/UPDATE/SELECT exposed to JWT users; service-role key bypasses for Phase 31 reads |
| AUDIT-06 | Audit entries are written asynchronously and never delay a chat response or document operation | FastAPI BackgroundTasks for non-SSE endpoints; asyncio.create_task() inside SSE generator for search.query and code.execute |
</phase_requirements>

---

## Summary

Phase 30 adds an append-only `audit_log` table to Supabase and instruments 8 action types across 4 router files (`threads.py`, `documents.py`, `skills.py`, `settings.py`). All writes go through a centralized `audit_service.py` helper and fire asynchronously so no user-facing operation is ever delayed.

The key architectural tension is that two of the eight action types (`search.query` and `code.execute`) fire inside the `event_stream()` async generator inside `send_message`, which returns a `StreamingResponse`. FastAPI's `BackgroundTasks` dependency on `send_message` fires _after_ the full SSE stream is consumed by the client — too late for per-tool-call audit events. The correct approach for those two is `asyncio.create_task()` inside the generator (fire-and-forget coroutine). The other 6 action types are in normal non-SSE endpoints where `BackgroundTasks.add_task()` is straightforward.

The Supabase migration is a single SQL file creating the table, CHECK constraint, index, and RLS policies. The service-role client already used by all endpoints can INSERT audit rows directly — no new client instance needed.

**Primary recommendation:** Use `BackgroundTasks.add_task()` for the 6 non-SSE endpoints; use `asyncio.create_task(write_audit_entry(...))` for `search.query` and `code.execute` inside the SSE generator. The `write_audit_entry()` function must be a coroutine (`async def`) to support both call sites.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| FastAPI BackgroundTasks | (bundled with FastAPI) | Fire-and-forget post-response tasks on non-SSE endpoints | Built-in FastAPI pattern; no extra dependencies; request-scoped; already used in `documents.py` for `ingest_document` |
| asyncio.create_task | (Python stdlib) | Fire-and-forget coroutines inside async generators | Required for SSE context where BackgroundTasks fires too late; `asyncio` already imported in `threads.py` |
| supabase-py Client | (already in project) | Insert rows into `audit_log` | Same client injected as dependency in all routers |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| logging (stdlib) | — | Log audit write failures to stderr | D-05: catch-and-log pattern; `logger = logging.getLogger(__name__)` already used project-wide |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| asyncio.create_task (SSE) | Queue-based broker (Redis, Celery) | Massively over-engineered for single-user app; no infrastructure available |
| asyncio.create_task (SSE) | BackgroundTasks registered before StreamingResponse is returned | BackgroundTasks on the outer endpoint fires after full stream consumed — correct for cleanup but wrong for mid-stream audit events |
| TEXT + CHECK constraint | Postgres ENUM | Enum requires `ALTER TYPE` for new values; TEXT + CHECK is simpler to evolve |

**Installation:** No new packages required. All dependencies already in project.

---

## Architecture Patterns

### Recommended Project Structure
```
backend/
├── app/
│   ├── services/
│   │   └── audit_service.py    # NEW — write_audit_entry() coroutine
│   └── api/
│       ├── threads.py          # MODIFY — thread.create, thread.delete, search.query, code.execute
│       ├── documents.py        # MODIFY — document.upload, document.delete
│       ├── skills.py           # MODIFY — skill.load
│       └── settings.py         # MODIFY — settings.update
└── supabase/
    └── migrations/
        └── 017_audit_log.sql   # NEW — table + RLS + index
```

### Pattern 1: audit_service.py coroutine
**What:** Single async function that accepts `user_id`, `action_type`, `metadata`, and `supabase` client; inserts one row into `audit_log`; catches and logs any exception.
**When to use:** Always called via BackgroundTasks or asyncio.create_task — never awaited directly in request path.

```python
# backend/app/services/audit_service.py
import logging
from supabase import Client

logger = logging.getLogger(__name__)

VALID_ACTION_TYPES = {
    "document.upload", "document.delete", "search.query",
    "code.execute", "skill.load", "thread.create",
    "thread.delete", "settings.update",
}

async def write_audit_entry(
    user_id: str,
    action_type: str,
    metadata: dict,
    supabase: Client,
) -> None:
    try:
        supabase.table("audit_log").insert({
            "user_id": user_id,
            "action_type": action_type,
            "metadata": metadata,
        }).execute()
    except Exception as exc:
        logger.error("audit write failed [%s]: %s", action_type, exc)
```

### Pattern 2: BackgroundTasks injection — non-SSE endpoints
**What:** Add `background_tasks: BackgroundTasks` to endpoint signature; call `background_tasks.add_task()` after main operation succeeds.
**When to use:** `document.upload`, `document.delete`, `thread.create`, `thread.delete`, `skill.load`, `settings.update`.

```python
# documents.py — upload_document already has BackgroundTasks; add audit call after line 259
from fastapi import BackgroundTasks
from app.services.audit_service import write_audit_entry

@router.post("/upload", ...)
async def upload_document(
    background_tasks: BackgroundTasks,  # already present
    ...
):
    # ... existing logic ...
    background_tasks.add_task(ingest_document, ...)   # existing
    background_tasks.add_task(
        write_audit_entry,
        user_id=current_user["id"],
        action_type="document.upload",
        metadata={"document_id": document_id, "filename": filename, "folder_id": folder_id},
        supabase=supabase,
    )
    return doc
```

### Pattern 3: asyncio.create_task — inside SSE generator
**What:** Inside the `event_stream()` async generator in `send_message`, fire `asyncio.create_task()` for audit writes that occur mid-stream.
**When to use:** `search.query` (after `search_documents` call at line 720) and `code.execute` (after execution completes around line 1080).

```python
# threads.py — inside event_stream() after search_documents resolves
import asyncio
from app.services.audit_service import write_audit_entry

# After the search_documents call (line ~728):
document_ids = [h.get("document_id") or h.get("id") for h in results if h.get("document_id") or h.get("id")]
asyncio.create_task(write_audit_entry(
    user_id=current_user["id"],
    action_type="search.query",
    metadata={"query_text": args["query"], "document_ids": document_ids},
    supabase=supabase,
))
```

**Why not BackgroundTasks for SSE:** `send_message` returns `StreamingResponse(event_stream(), ...)`. FastAPI's `BackgroundTasks` registered on `send_message` run _after_ the client fully consumes the stream. For a long-running SSE chat turn this may be seconds later. `asyncio.create_task()` fires the coroutine concurrently within the current event loop immediately — correct for mid-stream events.

### Pattern 4: Supabase migration — audit_log table
**What:** SQL migration creating table, CHECK constraint, index, and RLS policies.
**When to use:** Applied once; numbered `017_audit_log.sql` following project convention.

```sql
-- Migration 017: Audit log table for Phase 30
CREATE TABLE IF NOT EXISTS audit_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_type  TEXT NOT NULL,
  metadata     JSONB NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT audit_log_action_type_check CHECK (
    action_type IN (
      'document.upload', 'document.delete', 'search.query',
      'code.execute', 'skill.load', 'thread.create',
      'thread.delete', 'settings.update'
    )
  )
);

-- Index for Phase 31 pagination: list by user, newest first
CREATE INDEX IF NOT EXISTS audit_log_user_created_idx
  ON audit_log (user_id, created_at DESC);

-- RLS: enable row-level security
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Users may INSERT their own entries; no SELECT/UPDATE/DELETE
CREATE POLICY "Users can insert own audit entries"
  ON audit_log FOR INSERT
  WITH CHECK (user_id = auth.uid());
```

### Anti-Patterns to Avoid

- **Awaiting write_audit_entry in request path:** Breaks AUDIT-06; audit write latency becomes visible to user. Never `await write_audit_entry(...)` directly.
- **Using BackgroundTasks for SSE tool-call events:** BackgroundTasks on `send_message` fire after the client closes the stream, not immediately after the tool call completes. Use `asyncio.create_task()` instead.
- **Raising HTTPException on audit failure:** AUDIT-03 would be undermined if audit errors block legitimate operations. D-05 says swallow.
- **SELECT RLS on audit_log:** Phase 31 uses service-role key to read logs, not a user-facing SELECT policy. Giving users SELECT RLS would expose data before Phase 31 is ready and creates an attack surface.
- **Passing the supabase client by reference into create_task and the client going out of scope:** The `supabase` Client in `get_supabase()` is a module-level singleton, so this is safe — it won't be garbage collected.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Fire-and-forget on HTTP endpoints | Custom thread pool | FastAPI `BackgroundTasks` | Built-in, request-scoped, tested in production |
| Fire-and-forget in async generator | `threading.Thread` | `asyncio.create_task()` | Thread in async context causes event loop blocking; asyncio task is correct primitive |
| Row immutability | Application-layer delete guard | Postgres RLS with INSERT-only policy | Database enforces; application layer can't accidentally circumvent it |

---

## Common Pitfalls

### Pitfall 1: BackgroundTasks fires too late for SSE tool-call audits
**What goes wrong:** Developer adds `BackgroundTasks` to `send_message` signature and calls `add_task()` inside `event_stream()`. The task appears to register but fires only after the client closes the SSE connection — potentially 30+ seconds after the search query completed.
**Why it happens:** `StreamingResponse` signals "response done" only after the generator exhausts. BackgroundTasks are tied to response completion.
**How to avoid:** Use `asyncio.create_task(write_audit_entry(...))` inside the async generator for `search.query` and `code.execute`.
**Warning signs:** Audit entries for search queries appear in the DB long after the chat turn ends, or only appear if the user closes the connection.

### Pitfall 2: write_audit_entry must be async to be usable with create_task
**What goes wrong:** `write_audit_entry` is defined as a regular `def` (synchronous). `asyncio.create_task()` requires a coroutine. `BackgroundTasks.add_task()` accepts both sync and async callables — so non-SSE endpoints work, but SSE instrumentation fails with `TypeError`.
**Why it happens:** Inconsistent callable types between the two call sites.
**How to avoid:** Define `write_audit_entry` as `async def`. Both `BackgroundTasks.add_task()` and `asyncio.create_task()` accept coroutines. FastAPI `BackgroundTasks` will `await` the coroutine correctly.

### Pitfall 3: supabase-py Client is synchronous — calling it inside async def blocks the event loop
**What goes wrong:** `supabase.table("audit_log").insert(...).execute()` is a synchronous blocking call. Inside an `async def`, it blocks the event loop for the duration of the HTTP round-trip.
**Why it happens:** supabase-py (the Python library) uses httpx synchronously, not an async client.
**How to avoid:** This is acceptable for audit writes because: (a) the write runs in a background task, not in the request's critical path; (b) audit writes are single-row inserts and typically complete in <50ms; (c) the entire project uses synchronous supabase-py calls in async endpoints throughout — this is an established project pattern. No change needed.
**Warning signs:** If audit writes start taking >500ms due to Supabase latency, consider wrapping in `asyncio.to_thread()`.

### Pitfall 4: threads.py send_message does not currently accept BackgroundTasks
**What goes wrong:** Developer assumes `send_message` already has `BackgroundTasks` (it doesn't — unlike `upload_document` and `import_skill` which do). Adding it requires adding `background_tasks: BackgroundTasks` to the function signature.
**Why it happens:** Not all endpoints need it at creation time; it was never added.
**How to avoid:** For `thread.create` and `thread.delete`, add `BackgroundTasks` to the respective endpoint signatures. For SSE audit inside `send_message`, use `asyncio.create_task()` — no `BackgroundTasks` on `send_message` needed at all.

### Pitfall 5: settings.py does not inject supabase Client
**What goes wrong:** `update_settings` endpoint has signature `(body: SettingsUpdate, current_user: dict = Depends(get_current_user))` — no `supabase` dependency. Audit service needs `supabase` client.
**Why it happens:** Settings are stored in a JSON file (`save_override()`), not in Supabase — so no DB client was needed before.
**How to avoid:** Add `supabase: Client = Depends(get_supabase)` to `update_settings` signature and pass it to `write_audit_entry`. Straightforward addition.

### Pitfall 6: skill.load happens in threads.py, not skills.py
**What goes wrong:** Developer instruments `skills.py` for `skill.load` — but `load_skill` is a tool dispatch inside `threads.py:784`, not a standalone API endpoint in `skills.py`.
**Why it happens:** The naming suggests it should be in `skills.py`, but skills are loaded by the agent via tool dispatch within the chat flow.
**How to avoid:** Instrument `skill.load` at `threads.py` line ~784 (inside the `event_stream()` generator), using `asyncio.create_task()`. The `skill_row` data (id, name) is available at that call site.

---

## Code Examples

### write_audit_entry full implementation
```python
# backend/app/services/audit_service.py
import logging
from supabase import Client

logger = logging.getLogger(__name__)


async def write_audit_entry(
    user_id: str,
    action_type: str,
    metadata: dict,
    supabase: Client,
) -> None:
    """Write a single audit log entry.

    Always fire-and-forget via BackgroundTasks.add_task() or asyncio.create_task().
    Never await directly in a request handler.
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

### document.upload instrumentation (documents.py)
```python
# After background_tasks.add_task(ingest_document, ...) at line 259
from app.services.audit_service import write_audit_entry

background_tasks.add_task(
    write_audit_entry,
    user_id=current_user["id"],
    action_type="document.upload",
    metadata={
        "document_id": document_id,
        "filename": filename,
        "folder_id": folder_id,
    },
    supabase=supabase,
)
```

### document.delete instrumentation (documents.py)
```python
# delete_document — BackgroundTasks must be added to signature
@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    document_id: str,
    background_tasks: BackgroundTasks,        # ADD
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    # ... existing ownership check and delete logic ...
    doc_filename = doc_resp.data.get("filename", "")
    supabase.table("documents").delete().eq("id", document_id).execute()
    background_tasks.add_task(
        write_audit_entry,
        user_id=current_user["id"],
        action_type="document.delete",
        metadata={"document_id": document_id, "filename": doc_filename},
        supabase=supabase,
    )
```

### thread.create instrumentation (threads.py)
```python
@router.post("", response_model=ThreadResponse)
async def create_thread(
    body: ThreadCreate = ThreadCreate(),
    background_tasks: BackgroundTasks,        # ADD
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    from app.services.audit_service import write_audit_entry
    insert_data = {"user_id": current_user["id"], "title": body.title}
    if body.folder_id:
        insert_data["folder_id"] = str(body.folder_id)
    response = supabase.table("threads").insert(insert_data).execute()
    new_thread = response.data[0]
    background_tasks.add_task(
        write_audit_entry,
        user_id=current_user["id"],
        action_type="thread.create",
        metadata={"thread_id": new_thread["id"]},
        supabase=supabase,
    )
    return new_thread
```

### search.query instrumentation (threads.py — inside event_stream)
```python
# Inside event_stream(), after search_documents call resolves (around line 728):
elif tool_name == "search_documents":
    results, avg_sim = search_documents(...)
    tool_result = json.dumps(results) if results else "No relevant documents found."
    # ... existing citation accumulation ...
    # Audit: fire-and-forget inside async generator
    _doc_ids = [
        h.get("document_id") or h.get("id")
        for h in (results or [])
        if h.get("document_id") or h.get("id")
    ]
    asyncio.create_task(write_audit_entry(
        user_id=current_user["id"],
        action_type="search.query",
        metadata={"query_text": args["query"], "document_ids": _doc_ids},
        supabase=supabase,
    ))
```

### skill.load instrumentation (threads.py — inside event_stream)
```python
# Inside event_stream(), in the load_skill branch (~line 784):
elif tool_name == "load_skill":
    # ... existing skill resolution logic ...
    if skill_row:
        row = skill_row[0] if isinstance(skill_row, list) else skill_row
        asyncio.create_task(write_audit_entry(
            user_id=current_user["id"],
            action_type="skill.load",
            metadata={"skill_id": row["id"], "skill_name": row["name"]},
            supabase=supabase,
        ))
```

### settings.update instrumentation (settings.py)
```python
from fastapi import APIRouter, Depends
from supabase import Client
from app.dependencies import get_current_user, get_supabase
from fastapi import BackgroundTasks

@router.put("", response_model=FullSettingsResponse)
async def update_settings(
    body: SettingsUpdate,
    background_tasks: BackgroundTasks,        # ADD
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),  # ADD
):
    from app.services.audit_service import write_audit_entry
    # ... existing save_override(updates) logic unchanged ...
    save_override(updates)
    background_tasks.add_task(
        write_audit_entry,
        user_id=current_user["id"],
        action_type="settings.update",
        metadata={"new_settings": updates},
        supabase=supabase,
    )
    return _build_response()
```

---

## Instrumentation Point Map

| Action Type | Router File | Function | Call Site | Async Mechanism | Data Available |
|-------------|-------------|----------|-----------|-----------------|----------------|
| `document.upload` | documents.py | `upload_document` | After `background_tasks.add_task(ingest_document, ...)` line 259 | BackgroundTasks (already has it) | `document_id`, `filename`, `folder_id` all in scope |
| `document.delete` | documents.py | `delete_document` | After `supabase.table("documents").delete()...execute()` line 397 | BackgroundTasks (add to signature) | `document_id` param; `doc_resp.data["filename"]` fetched earlier |
| `thread.create` | threads.py | `create_thread` | After insert, return value available | BackgroundTasks (add to signature) | `new_thread["id"]` from insert result |
| `thread.delete` | threads.py | `delete_thread` | After delete executes (end of function, line ~250) | BackgroundTasks (add to signature) | `thread_id` param |
| `settings.update` | settings.py | `update_settings` | After `save_override(updates)` | BackgroundTasks (add to signature + add supabase dep) | `updates` dict (new values) |
| `search.query` | threads.py | `event_stream()` generator | After `search_documents()` resolves, line ~728 | `asyncio.create_task()` | `args["query"]`; document_ids extracted from `results` |
| `code.execute` | threads.py | `event_stream()` generator | After execute_code completes, ~line 1080 | `asyncio.create_task()` | `thread_id`; language available from `args` |
| `skill.load` | threads.py | `event_stream()` generator | After skill resolved in load_skill branch, ~line 801 | `asyncio.create_task()` | `row["id"]`, `row["name"]` from skill_row |

---

## Environment Availability

Step 2.6: SKIPPED — phase is purely backend code changes + one Supabase SQL migration. No new external tools, CLI utilities, or services required. All dependencies (FastAPI, supabase-py, asyncio) are already present in the project venv.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest (pytest.ini exists at `backend/pytest.ini`) |
| Config file | `backend/pytest.ini` |
| Quick run command | `cd backend && python -m pytest tests/unit/test_audit_service.py -x -q` |
| Full suite command | `cd backend && python -m pytest tests/unit/ -x -q` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUDIT-01 | `write_audit_entry` inserts correct row for each action type | unit | `pytest tests/unit/test_audit_service.py::test_write_audit_entry_inserts_row -x` | Wave 0 |
| AUDIT-02 | `search.query` metadata includes `query_text` and `document_ids` list | unit | `pytest tests/unit/test_audit_service.py::test_search_query_metadata -x` | Wave 0 |
| AUDIT-03 | RLS policy allows INSERT, blocks SELECT/UPDATE/DELETE for regular user JWT | manual (Supabase SQL editor or integration test with real Supabase) | manual | — |
| AUDIT-06 | `write_audit_entry` exceptions are caught and swallowed; do not propagate | unit | `pytest tests/unit/test_audit_service.py::test_write_audit_entry_swallows_exception -x` | Wave 0 |

### Sampling Rate
- **Per task commit:** `cd backend && python -m pytest tests/unit/test_audit_service.py -x -q`
- **Per wave merge:** `cd backend && python -m pytest tests/unit/ -x -q`
- **Phase gate:** Full unit suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/unit/test_audit_service.py` — covers AUDIT-01, AUDIT-02, AUDIT-06 (new file needed)
- [ ] No new conftest fixtures required — existing `conftest.py` MagicMock builder is sufficient; audit service only needs a mock `supabase.table(...).insert(...).execute()` chain

---

## Project Constraints (from CLAUDE.md)

| Directive | Impact on Phase 30 |
|-----------|-------------------|
| No LangChain, no LangGraph — raw SDK calls only | audit_service.py uses supabase-py directly; no chain abstractions |
| Python backend must use venv | All installs in `backend/venv`; no new packages needed |
| All tables need Row-Level Security — users only see their own data | `audit_log` table must have RLS enabled with INSERT-only policy (D-08) |
| Stream chat responses via SSE | SSE generator constraint drives the `asyncio.create_task()` pattern for mid-stream audits |
| Save all plans to `.agent/plans/` | Planning artifact location (not relevant to implementation) |

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Postgres ENUM for action types | TEXT + CHECK constraint | Decision D-02 | Future action types added with `ALTER TABLE ... ADD ... TO CHECK` instead of `ALTER TYPE ... ADD VALUE` (which locks the table) |

---

## Open Questions

1. **code.execute language field availability**
   - What we know: `execute_code` args in threads.py include `code` and `libraries` but not an explicit `language` field (language is implied as Python from the sandbox implementation)
   - What's unclear: whether there is a language arg or if it should always be hardcoded to `"python"`
   - Recommendation: Log `metadata={"thread_id": thread_id, "language": args.get("language", "python")}` — `args.get("language", "python")` safely handles both cases

2. **delete_thread audit timing — sandbox cleanup runs first**
   - What we know: `delete_thread` does sandbox cleanup (sandbox_manager.close_session, storage.remove) before the thread DB delete. Some of this is wrapped in try/except.
   - What's unclear: whether audit should fire even if sandbox cleanup partially failed
   - Recommendation: Add audit entry at the very end of `delete_thread`, after all cleanup. This matches the "log the actual event" intent — the thread is deleted regardless of cleanup success.

3. **settings.update audit — API keys in metadata**
   - What we know: D-06 says log full new settings payload. The `updates` dict (from `save_override`) may contain API keys (e.g., `openai_api_key`, `embedding_api_key`).
   - What's unclear: whether logging API keys in `metadata` JSONB is acceptable
   - Recommendation: Sanitize the payload before logging — replace any key whose name contains `_key` or `_secret` with `"[REDACTED]"`. This is straightforward and avoids a security issue. Planner should include this as a task step.

---

## Sources

### Primary (HIGH confidence)
- FastAPI BackgroundTasks official docs — https://fastapi.tiangolo.com/tutorial/background-tasks/ — confirmed BackgroundTasks fires after response is sent
- FastAPI StreamingResponse behavior — confirmed BackgroundTasks on endpoint fires after stream exhausts
- Python asyncio.create_task docs — stdlib; confirmed creates concurrent task on running event loop
- Direct code inspection: `backend/app/api/threads.py`, `documents.py`, `settings.py`, `skills.py`, `dependencies.py`
- Direct code inspection: `backend/supabase/migrations/016_citations_chunk_index.sql` — migration format pattern
- Direct code inspection: `backend/tests/conftest.py` — test mock builder pattern

### Secondary (MEDIUM confidence)
- Supabase RLS documentation — INSERT-only policies are well-established Supabase pattern; multiple official examples exist

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — FastAPI BackgroundTasks and asyncio.create_task are well-documented stdlib/framework primitives; supabase-py usage directly mirrors project patterns
- Architecture: HIGH — patterns derived from direct code inspection of existing routers; instrumentation points precisely located with line numbers
- Pitfalls: HIGH — pitfalls 4, 5, 6 discovered by reading actual code (threads.py has no BackgroundTasks; settings.py has no supabase dep; skill.load is in threads.py not skills.py)

**Research date:** 2026-04-13
**Valid until:** 2026-05-13 (stable domain — FastAPI BackgroundTasks API has not changed since v0.95)
