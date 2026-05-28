# Phase 085: New LLM Tools - Pattern Map

**Mapped:** 2026-05-28
**Files analyzed:** 14 (5 NEW source files + 6 MODIFIED source files + 1 NEW migration + ~9 NEW test files)
**Analogs found:** 13 / 14 strong matches + 1 first-usage (ask_user pub/sub has no in-codebase precedent)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `backend/app/services/todos_service.py` | service (DB + SSE) | CRUD + event-emit | `backend/app/services/workspace_service.py` | exact (Phase 084 sibling) |
| `backend/app/services/task_service.py` | sub-agent loop service | request-response loop + nested tool dispatch | `backend/app/services/sub_agent_service.py` + `backend/app/api/threads.py:agent_runner` | role-match (existing sub-agent is single-stream-only) |
| `backend/app/services/ask_user_service.py` | pub/sub control-channel helper | event-driven (cross-worker rendezvous) | **NONE — first pub/sub usage in repo**; ref skeleton from RESEARCH §A.1 | first-of-its-kind |
| `backend/app/api/panel.py` | FastAPI router (thread-scoped reads) | request-response (3 GET endpoints) | `backend/app/api/workspace.py` | exact (Phase 084 cold-path REST template) |
| `supabase/migrations/055_todos_table.sql` | migration (DDL + RLS) | schema | `supabase/migrations/054_workspace_files.sql` | exact (FK-chain RLS template) |
| `backend/app/services/tool_dispatcher.py` (MODIFIED) | dispatcher (add 3 handlers + 3 registry entries) | tool dispatch | self — existing `_handle_workspace_*` block at lines 865-1006 + `_TOOL_REGISTRY` at 1013-1036 | exact |
| `backend/app/services/openai_service.py` (MODIFIED) | tool schema constants + `get_tools()` extension | schema declaration | self — existing `WORKSPACE_*_TOOL` constants at lines 495-625 + `get_tools()` at 651-658 | exact |
| `backend/app/api/threads.py` (MODIFIED) | `ToolContext` dataclass extension + semaphore init in `agent_runner` | data-structure extension | self — existing `ToolContext` at `tool_dispatcher.py:59-77` + construction site at `threads.py:2603-2618` | exact |
| `backend/app/api/runs.py` (MODIFIED) | POST `/runs/{rid}/ask_user_response` + cancel-sentinel publish | request-response | self — existing `cancel_run` at lines 485-625 + `stream_run` ownership SELECT at 385-444 | exact |
| `backend/app/main.py` (MODIFIED) | lifespan shutdown — broadcast ask_user sentinel | lifecycle hook | self — existing `lifespan` `RUN_TASKS.cancel()` block at lines 215-227 | exact |
| `backend/app/config.py` (MODIFIED) | new Settings fields (timeouts + caps) | config | self — existing `sub_agent_*` settings at lines 777-789 + `_SUB_AGENT_MODEL_DEFAULTS` at 546-556 | exact |
| `backend/tests/unit/test_085_todos_service.py` | unit test | test | `backend/tests/unit/test_tool_dispatcher.py` (mock supabase/redis pattern) | partial (no asyncpg-pool fixture analog) |
| `backend/tests/unit/test_085_task_service.py` | unit test | test | `backend/tests/unit/test_tool_dispatcher.py` | partial |
| `backend/tests/integration/test_085_ask_user_*.py` (4 files) | integration test (Redis pub/sub) | test | **NONE** — no integration tests for runs.py currently exist | first-of-its-kind |
| `backend/tests/integration/test_085_panel_endpoints.py` | integration test (FastAPI routes) | test | `backend/tests/unit/test_workspace_api.py` (only bytea-decode helper unit; no full FastAPI route tests) | partial |
| `backend/tests/integration/test_085_concurrency.py` | integration test (semaphore + Redis counter) | test | none | first-of-its-kind |

---

## Pattern Assignments

### `backend/app/services/todos_service.py` (NEW — service, CRUD + SSE emit)

**Analog:** `backend/app/services/workspace_service.py` (Phase 084) — same shape: pure async functions taking asyncpg pool + UUIDs, returning dicts; handler in `tool_dispatcher.py` wraps the call with a `ctx.emit(...)` and returns a `ToolResult`.

**Imports pattern** (workspace_service.py:1-31) — copy verbatim style, swap target table:
```python
from __future__ import annotations

import logging
from typing import TYPE_CHECKING
from uuid import UUID

if TYPE_CHECKING:
    import asyncpg
    from supabase import Client

logger = logging.getLogger(__name__)
```
**Divergence:** todos_service does NOT need `mimetypes`, `difflib`, `re`, `run_in_threadpool` — only the asyncpg pool + transactional DELETE+INSERT (RESEARCH §C.2). No Supabase Storage at all. No `WorkspaceError`-style exception class needed; raise `ValueError` on invalid status enum and let the dispatcher handler convert to a `ToolResult` error string.

**Core CRUD pattern** (NEW — full-state-replace transaction, no analog this clean in the repo) — use RESEARCH §C.2 verbatim:
```python
async def replace_todos(pool, thread_id: UUID, todos: list[dict]) -> dict:
    async with pool.acquire() as conn:
        async with conn.transaction():
            await conn.execute("DELETE FROM todos WHERE thread_id = $1", thread_id)
            if todos:
                rows = [
                    (thread_id, t["id"], t["content"], t["status"],
                     t.get("parent_id"), t.get("order_index", 0))
                    for t in todos
                ]
                await conn.executemany(
                    """INSERT INTO todos (thread_id, todo_id, content, status, parent_id, order_index)
                       VALUES ($1, $2, $3, $4, $5, $6)""",
                    rows,
                )
    return {"accepted": len(todos), "version": int(time.time() * 1000)}
```
**Why no analog:** workspace_service uses upserts per-file (no atomic DELETE-then-INSERT semantics); the `messages` writes during finalize are async-queue style. The transactional full-replace shape is genuinely new — derive from RESEARCH.

**SSE-emit-from-handler pattern** (this is the cleanest analog) — `tool_dispatcher.py:865-897` (`_handle_workspace_write`):
```python
async def _handle_workspace_write(args: dict, ctx: ToolContext) -> ToolResult:
    path = args.get("path", "")
    content_str = args.get("content", "")
    content = content_str.encode("utf-8")
    try:
        result = await ws_write_file(
            ctx.pool, ctx.supabase,
            thread_id=UUID(ctx.thread_id),
            user_id=UUID(ctx.current_user["id"]),
            path=path,
            content=content,
        )
        await ctx.emit(
            ctx.redis, ctx.run_id, 'workspace_file_written',
            path=result["path"], version=result["version"],
            size_bytes=result["size_bytes"], mime_type=result["mime_type"],
        )
        # ... build summary ...
        return ToolResult(result=json.dumps(summary))
    except WorkspaceError as e:
        return ToolResult(result=json.dumps({"error": str(e)}))
```
**Divergence for `_handle_write_todos`:** validate status enum + required fields BEFORE the service call (RESEARCH §C.3 shows the validation pre-check shape); after service returns, re-SELECT the canonical list and emit `todo_updated{todos: [...]}` with the FULL list (not a delta).

---

### `backend/app/services/task_service.py` (NEW — sub-agent loop, request-response + nested tool dispatch)

**Analog A (model routing safety + SDK call shape):** `backend/app/services/sub_agent_service.py:62-126` — **read but DO NOT modify per D-085-16**. Replicate lines 62-89 (cross-provider model-validation fallback per D-075.5-04 footgun) into task_service via a shared helper or inline copy.

**Cross-provider model fallback excerpt** (sub_agent_service.py:62-89):
```python
_active_provider = (user_settings.active_provider if user_settings else "") or ""
_active_models = (user_settings.llm_models if (user_settings and getattr(user_settings, "llm_models", None)) else "")
_active_models_list = [m.strip() for m in _active_models.split(",") if m.strip()] if _active_models else []
_provider_default = _SUB_AGENT_MODEL_DEFAULTS.get(_active_provider, "")

if override_model and _active_models_list and override_model not in _active_models_list:
    logger.warning(
        "sub_agent_model=%r is not in active provider=%r's model list — "
        "falling back to default to avoid cross-provider call.",
        override_model, _active_provider,
    )
    effective_model = (
        _provider_default
        or (user_settings.llm_model if user_settings else None)
        or model
        or settings.llm_model
    )
# ...
```
**MANDATORY for task_service.py — verbatim replication of this block (RESEARCH risk R3, FC#5).** Recommend a new shared helper `resolve_sub_agent_model_safely(user_settings, model_override)` co-located in `app/services/sub_agent_models.py` (NEW utility file) so both `sub_agent_service.py` (frozen) and `task_service.py` (new) reference one source — but DO NOT edit `sub_agent_service.py` to use it (frozen per D-085-16). Plan 02's Wave 0 should call this out explicitly.

**Analog B (sub-agent's own run row + Stream finalize discipline):** `backend/app/api/threads.py:agent_runner` (lines 1402-3096) — task_service ships a MINIMAL mirror. Specifically copy these patterns:

**runs row INSERT + finalize discipline** (`backend/app/db/runs.py:26-102`):
```python
async def insert_run(pool, *, run_id, thread_id, user_id, status, model, provider, spawned_by_worker=None):
    await pool.execute(
        "INSERT INTO runs (run_id, thread_id, user_id, status, model, provider, spawned_by_worker) "
        "VALUES ($1, $2, $3, $4, $5, $6, $7)",
        run_id, thread_id, user_id, status, model, provider, spawned_by_worker,
    )

async def finalize_run(pool, *, run_id, status, error, completed_at, message_id, input_tokens, output_tokens):
    await pool.execute(
        "UPDATE runs SET status = $2, error = $3, completed_at = $4, message_id = $5, "
        "input_tokens = $6, output_tokens = $7 WHERE run_id = $1",
        run_id, status, error, completed_at, message_id, input_tokens, output_tokens,
    )
```
**Divergence for task_service:** insert_run signature needs a new kwarg `parent_run_id: UUID | None` (Plan 01's migration adds the column). Plan 02 must extend insert_run to accept it (or use a direct `pool.execute("INSERT ... parent_run_id ...")` from task_service). RECOMMENDED: extend `insert_run` since other code may also need parent_run_id eventually.

**Terminal sentinel ordering** (`backend/app/api/threads.py:2989-3088`) — mirror this 5-step finalize for the SUB-agent's own stream:
```python
# 1. Persist messages (sub-agent's own final message — optional for task; can skip)
# 2. UPDATE runs row via finalize_run (sub_run_id)
# 3. _emit_terminal(redis, sub_run_id, "done" | "error" | "cancelled")
# 4. EXPIRE f"run:{sub_run_id}" (600 if completed, 60 if failed)
# 5. ZREM "runs:active" and "runs_by_thread:{thread_id}"
```
Skip step 1 (sub-agents don't persist their own assistant messages — D-085-13 says only the SUMMARY returns). Steps 2–5 are mandatory.

**Streaming chat + tool dispatch loop** — derive from RESEARCH §B.4 (full sketch) — calls `openai_service.create_adaptive_streaming_chat` + reuses `tool_dispatcher.dispatch_tool` with a sub-agent-scoped `ToolContext` that:
- Sets `parent_run_id = parent_ctx.run_id` (enforces 1-level nesting cap via `_handle_task` early-return)
- Sets `available_tools = validated_subset` (defense-in-depth — sub-agent's dispatch_tool calls fail fast for unauthorized tools)
- Sets `previous_files_in_run = {}` (fresh dict — Pitfall 7)
- Shares `per_run_task_semaphore` with parent (sub-agents can't spawn more tasks anyway)

**Concurrency caps** — RESEARCH §B.3 gives the Lua atomic INCR+EXPIRE skeleton for the Redis global counter:
```python
async def acquire_global_task_slot(redis, max_concurrent):
    SCRIPT = """
    local cur = redis.call('GET', KEYS[1]) or '0'
    if tonumber(cur) >= tonumber(ARGV[1]) then return 0 end
    redis.call('INCR', KEYS[1])
    redis.call('EXPIRE', KEYS[1], ARGV[2])
    return 1
    """
    result = await redis.eval(SCRIPT, 1, "tasks:global:active", max_concurrent, 7200)
    return bool(result)
```
Per-run cap is in-process `asyncio.Semaphore` carried on `ToolContext.per_run_task_semaphore` (initialized once in `agent_runner` before the iteration loop — see ToolContext extension below).

---

### `backend/app/services/ask_user_service.py` (NEW — Redis pub/sub helpers)

**Analog:** **NONE** — this is the first pub/sub usage in the repo. Streams (XADD/XREAD) is used everywhere; pub/sub (SUBSCRIBE/PUBLISH) is a different Redis API on the same `redis.asyncio` client.

**Closest neighbors to crib idioms from:**
- `backend/app/dependencies.py:26-47` — `get_redis()` returns the singleton aioredis client; pub/sub spawns its own internal connection on first `subscribe()` call (RESEARCH A.1, verified). No new connection pooling needed.
- `backend/app/services/redis_runs.py` — for XADD/XREAD style (NOT pub/sub style, but shows the canonical async-Redis-call shape).
- `backend/app/api/runs.py:485-625` (`cancel_run`) — for the cancel-path integration site where the sentinel must be PUBLISHED.
- `backend/app/api/threads.py:_shielded_finalize` (lines 2989-3088) — for the shielded-cleanup discipline that ask_user's `finally:` block mirrors at smaller scale.

**RECOMMENDED skeleton (FIRST USAGE — derive from RESEARCH §A.1–A.7 verbatim):**

```python
# backend/app/services/ask_user_service.py
"""Phase 085 D-085-01..07 — ask_user pub/sub helpers (FIRST PUB/SUB USAGE).

Channel naming: ask_user:{run_id}:{tool_call_id}
Per-run channel index (for cross-worker cancel): ask_user:channels:{run_id} (SET, TTL 3600s)
"""
from __future__ import annotations
import asyncio, json, logging
from uuid import UUID
import redis.asyncio as aioredis

logger = logging.getLogger(__name__)


async def subscribe_for_response(
    redis: aioredis.Redis,
    run_id: UUID,
    tool_call_id: str,
    timeout_seconds: float,
) -> dict | None:
    """Block until PUBLISH arrives on ask_user:{run_id}:{tool_call_id} or timeout.

    Returns the parsed JSON payload {"kind": "response"|"cancel"|"shutdown", ...}
    or None on timeout. ALWAYS pairs with the SADD before SSE emit (Pitfall 2 —
    SUBSCRIBE-before-anything-user-can-see rule, RESEARCH §A.3).
    """
    channel = f"ask_user:{run_id}:{tool_call_id}"
    pubsub = redis.pubsub()
    await pubsub.subscribe(channel)              # MUST complete before SSE emit
    await redis.sadd(f"ask_user:channels:{run_id}", channel)
    await redis.expire(f"ask_user:channels:{run_id}", 3600)
    try:
        async def _wait():
            while True:
                msg = await pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
                if msg is not None and msg.get("type") == "message":
                    return json.loads(msg["data"])
        return await asyncio.wait_for(_wait(), timeout=timeout_seconds)
    except asyncio.TimeoutError:
        return None
    finally:
        try:
            await pubsub.unsubscribe(channel)
            await asyncio.wait_for(pubsub.aclose(), timeout=2.0)
        except Exception:
            logger.exception("ask_user pubsub cleanup failed for run=%s tcid=%s",
                             run_id, tool_call_id)
        try:
            await redis.srem(f"ask_user:channels:{run_id}", channel)
        except Exception:
            logger.exception("ask_user channels-set SREM failed for run=%s", run_id)


async def publish_response(redis, run_id, tool_call_id, response_text, choice_index):
    channel = f"ask_user:{run_id}:{tool_call_id}"
    return await redis.publish(channel, json.dumps({
        "kind": "response",
        "response_text": response_text,
        "choice_index": choice_index,
    }))


async def publish_cancel_sentinel(redis, run_id: UUID):
    """Broadcast cancel to ALL active ask_user channels for this run.

    Must be called BEFORE task.cancel() in runs.py:cancel_run — RESEARCH §A.5
    (PUBLISH-first ordering ensures _handle_ask_user returns a normal ToolResult
    BEFORE CancelledError propagates).
    """
    channels = await redis.smembers(f"ask_user:channels:{run_id}")
    for ch in channels:
        try:
            await redis.publish(ch, json.dumps({"kind": "cancel"}))
        except Exception:
            logger.exception("ask_user cancel publish failed for run=%s ch=%s", run_id, ch)


async def broadcast_shutdown_sentinel_to_all(redis):
    """Called from main.py lifespan BEFORE RUN_TASKS cancel loop.

    SCAN ask_user:channels:*, SMEMBERS each, PUBLISH {"kind": "shutdown"} to every
    channel. Best-effort — never block shutdown on Redis failure.
    """
    try:
        async for key in redis.scan_iter("ask_user:channels:*", count=100):
            try:
                channels = await redis.smembers(key)
                for ch in channels:
                    await redis.publish(ch, json.dumps({"kind": "shutdown"}))
            except Exception:
                logger.exception("ask_user shutdown broadcast failed for key=%s", key)
    except Exception:
        logger.exception("ask_user shutdown SCAN failed")
```

**SUBSCRIBE-then-persist-then-emit ordering** is load-bearing. RESEARCH §A.3 is the authoritative reference; Plan 03's first task should be an integration test that asserts this ordering with a Redis time-travel scenario.

---

### `backend/app/api/panel.py` (NEW — FastAPI router, 3 thread-scoped GET endpoints)

**Analog:** `backend/app/api/workspace.py` (Phase 084) — same shape: thread-scoped router with prefix, `_verify_thread_ownership` helper, `run_in_threadpool` wrapping for sync supabase-py, RLS-enforced reads.

**Router scaffolding** (workspace.py:1-49):
```python
"""REST API endpoints for thread-scoped panel data (Phase 085, D-085-23)."""
from __future__ import annotations
import logging
from fastapi import APIRouter, Depends, HTTPException, status
from starlette.concurrency import run_in_threadpool
from supabase import Client

from app.dependencies import get_current_user, get_supabase, get_pg_pool
from app.utils.db import aexec

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/threads/{thread_id}",
    tags=["panel"],
)


async def _verify_thread_ownership(thread_id: str, current_user: dict, supabase: Client) -> None:
    """Verify the authenticated user owns this thread. Raises 404 on failure (D-062-12 convention)."""
    resp = await aexec(
        supabase.table("threads")
        .select("id")
        .eq("id", thread_id)
        .eq("user_id", current_user["id"])
        .maybe_single()
    )
    row = resp.data if resp is not None else None
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Thread not found")
```
**Divergence:** prefix is `/threads/{thread_id}` (NOT `/threads/{thread_id}/workspace`); the 3 endpoints attach paths `/todos`, `/ask_user/pending`, `/tasks` directly to that root prefix.

**GET endpoint pattern** (workspace.py:98-123 — full route):
```python
@router.get("/files")
async def list_workspace_files(
    thread_id: str,
    prefix: str | None = Query(None, description="Path prefix filter"),
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    await _verify_thread_ownership(thread_id, current_user, supabase)
    query = (
        supabase.table("workspace_files")
        .select("id, path, size_bytes, mime_type, created_at, updated_at")
        .eq("thread_id", thread_id)
        .order("path")
    )
    resp = await aexec(query)
    # ... return resp.data ...
```
**Divergences:**
- `GET /todos` — straight supabase-py select, mirrors workspace_files shape verbatim.
- `GET /ask_user/pending` — RESEARCH §D.4 uses a jsonb `@>` containment query that supabase-py doesn't natively express; route through asyncpg via `get_pg_pool()` instead. After `_verify_thread_ownership`, use:
  ```python
  pool = await get_pg_pool()
  rows = await pool.fetch("""
      SELECT m.id, m.tool_calls, m.created_at
      FROM messages m
      WHERE m.thread_id = $1 AND m.role = 'system'
        AND m.tool_calls @> '[{"kind": "ask_user_prompt"}]'::jsonb
        AND NOT EXISTS (
            SELECT 1 FROM messages r WHERE r.thread_id = m.thread_id AND r.role = 'system'
              AND r.tool_calls @> '[{"kind": "ask_user_response"}]'::jsonb
              AND r.tool_calls->0->>'tool_call_id' = m.tool_calls->0->>'tool_call_id'
        )
      ORDER BY m.created_at ASC
  """, UUID(thread_id))
  ```
- `GET /tasks` — RESEARCH §D.5; selects from `runs WHERE parent_run_id IN (SELECT run_id FROM runs WHERE thread_id = $1 AND user_id = $2)`. Use asyncpg directly.

**Router registration in main.py:** mirror line 303-317 — add `from app.api import ..., panel` and `app.include_router(panel.router)` after the workspace router include.

---

### `supabase/migrations/055_todos_table.sql` (NEW — DDL + RLS via FK-chain)

**Analog:** `supabase/migrations/054_workspace_files.sql` — exact template. Copy-paste the table + RLS policy structure, swap `workspace_files` → `todos`, swap columns.

**Section structure to mirror** (054_workspace_files.sql:1-53):
1. `CREATE TABLE public.todos (...)` with `id uuid PK`, `thread_id uuid FK ON DELETE CASCADE`, content/status columns, UNIQUE constraint.
2. `CREATE INDEX idx_todos_thread ON public.todos(thread_id, order_index);`
3. `ALTER TABLE public.todos ENABLE ROW LEVEL SECURITY;`
4. 4× RLS policies (SELECT / INSERT / UPDATE / DELETE), each using the FK-chain `USING (auth.uid() = (SELECT user_id FROM threads WHERE id = thread_id))` pattern.

**Verbatim RLS template** (054_workspace_files.sql:37-53):
```sql
ALTER TABLE workspace_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_files_select_own" ON workspace_files
    FOR SELECT TO authenticated
    USING (auth.uid() = (SELECT user_id FROM threads WHERE id = thread_id));

CREATE POLICY "workspace_files_insert_own" ON workspace_files
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = (SELECT user_id FROM threads WHERE id = thread_id));

CREATE POLICY "workspace_files_update_own" ON workspace_files
    FOR UPDATE TO authenticated
    USING (auth.uid() = (SELECT user_id FROM threads WHERE id = thread_id));

CREATE POLICY "workspace_files_delete_own" ON workspace_files
    FOR DELETE TO authenticated
    USING (auth.uid() = (SELECT user_id FROM threads WHERE id = thread_id));
```

**Phase 085 additions BEYOND the 054 template** (RESEARCH §C.1):
- Section 3 (`ALTER TABLE public.runs ADD COLUMN parent_run_id uuid REFERENCES public.runs(run_id) ON DELETE SET NULL;`) + `CREATE INDEX idx_runs_parent ON public.runs(parent_run_id) WHERE parent_run_id IS NOT NULL;`
- Section 4 (`COMMENT ON COLUMN public.messages.tool_calls IS '...ask_user_prompt | ask_user_response (Phase 085)...';`) — doc-only, no DDL.

**Status enum constraint:** `CHECK (status IN ('pending', 'in_progress', 'completed'))` — RESEARCH §C.1, D-085-19.

**Apply per CLAUDE.md:** paste into Supabase SQL editor (NEVER `db push`/`db reset`), then run `bash scripts/regenerate-full-schema.sh` (no `--reset` flag).

---

### `backend/app/services/tool_dispatcher.py` (MODIFIED — add 3 handlers + 3 registry entries)

**Analog:** self — Phase 084's workspace handlers at lines 865-1006 + registry entries at lines 1030-1035.

**Handler shape — `_handle_write_todos`** (mirror `_handle_workspace_write` at 865-897):
```python
async def _handle_write_todos(args: dict, ctx: ToolContext) -> ToolResult:
    todos_in = args.get("todos") or []
    for t in todos_in:
        if t.get("status") not in ("pending", "in_progress", "completed"):
            return ToolResult(result=f"write_todos: invalid status {t.get('status')!r}; "
                                     "must be pending|in_progress|completed")
        if not t.get("id") or not t.get("content"):
            return ToolResult(result="write_todos: each todo requires id and content")
    from app.services.todos_service import replace_todos  # noqa: PLC0415
    result = await replace_todos(ctx.pool, UUID(ctx.thread_id), todos_in)
    # Re-SELECT canonical list for SSE payload (RESEARCH §C.3)
    rows = await ctx.pool.fetch(
        "SELECT todo_id AS id, content, status, parent_id, order_index "
        "FROM todos WHERE thread_id = $1 ORDER BY order_index, created_at",
        UUID(ctx.thread_id),
    )
    todos_payload = [dict(r) for r in rows]
    await ctx.emit(ctx.redis, ctx.run_id, 'todo_updated', todos=todos_payload)
    return ToolResult(result=json.dumps({"accepted": result["accepted"], "version": result["version"]}))
```

**Handler shape — `_handle_task`** (RESEARCH §B.1 — early-return for nesting cap):
```python
async def _handle_task(args: dict, ctx: ToolContext) -> ToolResult:
    if ctx.parent_run_id is not None:
        return ToolResult(result="task() unavailable inside a sub-agent — 1-level nesting cap")
    # Toolset validation, concurrency acquire, then call task_service.run_task_sub_agent
    # ...
```
The full handler body lives largely in `task_service.run_task_sub_agent`; the dispatcher handler is thin (validation + global-cap acquire + spawn + result formatting + sub_agent_start/done emits).

**Handler shape — `_handle_ask_user`** (RESEARCH §A.3 — SUBSCRIBE FIRST):
```python
async def _handle_ask_user(args: dict, ctx: ToolContext) -> ToolResult:
    prompt = (args.get("prompt") or "").strip()
    if not prompt:
        return ToolResult(result="ask_user requires a non-empty prompt")
    timeout_seconds = min(
        int(args.get("timeout_seconds") or 300),
        settings.ask_user_max_timeout_seconds,
    )
    tool_call_id = ctx.tool_call_id  # NEW field on ToolContext (carries the LLM-provided call id)
    options = args.get("options")

    from app.services.ask_user_service import subscribe_for_response  # noqa: PLC0415

    # ORDER IS LOAD-BEARING — RESEARCH §A.3
    # 1. SUBSCRIBE FIRST (subscribe_for_response sets up pubsub + SADD before returning the awaitable)
    # 2. Persist messages row (kind='ask_user_prompt')
    # 3. Emit SSE 'ask_user_prompt'
    # 4. Block on get_message (inside subscribe_for_response)
    # Implementation note: split subscribe_for_response into (a) register-channel and
    # (b) wait-for-message OR pass a callback so this ordering is enforced from one site.
    # ...
```
**Key divergence:** ToolContext needs a `tool_call_id` field (or pass it through `args`/dispatcher signature). Verify with Plan 02 — the dispatcher's current signature `dispatch_tool(name, args, ctx)` doesn't carry tool_call_id. The cleanest fix: thread the LLM's tool_call_id into args under a reserved key (e.g. args["_tool_call_id"]) at the agent_runner dispatch site, OR add a `tool_call_id: str = ""` field to ToolContext set per-tool-call by agent_runner. Recommend the ToolContext field — symmetric with `tool_index`, `iteration`.

**Registry entry pattern** (tool_dispatcher.py:1013-1036):
```python
_TOOL_REGISTRY: dict[str, Callable] = {
    # ... existing 21 entries ...
    # Phase 085: New tools (D-085-25 — 24-tool toolbox)
    "write_todos": _handle_write_todos,
    "task": _handle_task,
    "ask_user": _handle_ask_user,
}
```

---

### `backend/app/services/openai_service.py` (MODIFIED — add 3 tool schema constants + extend `get_tools()`)

**Analog:** self — Phase 084's `WORKSPACE_*_TOOL` constants at lines 495-625 + `get_tools()` at 651-658.

**Tool schema constant pattern** (openai_service.py:525-553, WORKSPACE_READ_TOOL):
```python
WORKSPACE_READ_TOOL = {
    "type": "function",
    "function": {
        "name": "workspace_read",
        "description": (
            "Read a file from the thread's workspace. Returns file content (truncated "
            "for large files). Use start_line and end_line for targeted reads of large files. "
            "For binary files, returns metadata only (size, type)."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "File path to read (e.g. /plan.md)."},
                "start_line": {"type": ["integer", "null"], "description": "..."},
                "end_line": {"type": ["integer", "null"], "description": "..."},
            },
            "required": ["path", "start_line", "end_line"],
        },
    },
}
```
**Key divergences for Phase 085:**
- D-085-25 / RESEARCH §E description style: lead with "Use when..." + "Do not use for..." to mitigate the 24-tool selection-accuracy concern. RESEARCH §E lines 767-862 already contain the full text for `WRITE_TODOS_TOOL`, `TASK_TOOL`, `ASK_USER_TOOL` — copy verbatim into the new file constants.
- Google union-type quirk: `"type": ["integer", "null"]` works with the workspace tools today (Phase 084 Plan 05 added a sanitizer); Plan 04 must verify the same sanitizer covers the 3 new tools' nullable args. UAT Row 13 is the gate (RESEARCH Assumption A3).
- `required` array must include ALL optional fields too (per workspace tool pattern, e.g. `"required": ["path", "start_line", "end_line"]`) — this is a strict-mode-compatible shape used across all 5 workspace tools and works on all 9 providers.

**`get_tools()` extension** (openai_service.py:651-658):
```python
def get_tools(user_settings: "UserEffectiveSettings | None" = None) -> list[dict]:
    effective = user_settings if user_settings is not None else None
    tools = [SEARCH_DOCUMENTS_TOOL, QUERY_DOCUMENTS_TOOL, LS_TOOL, TREE_TOOL, GREP_TOOL, GLOB_TOOL,
             READ_DOCUMENT_TOOL, ANALYZE_DOCUMENT_TOOL,
             LOAD_SKILL_TOOL, SAVE_SKILL_TOOL, READ_SKILL_FILE_TOOL,
             REMEMBER_TOOL, RECALL_TOOL, QUERY_TABLES_TOOL,
             WORKSPACE_WRITE_TOOL, WORKSPACE_READ_TOOL, WORKSPACE_LIST_TOOL,
             WORKSPACE_DELETE_TOOL, WORKSPACE_DIFF_TOOL,
             # Phase 085 — three new tools
             WRITE_TODOS_TOOL, TASK_TOOL, ASK_USER_TOOL]
    # ... existing web_search conditional append + sandbox conditional append ...
```
**No call-site changes needed** — `agent_runner` already calls `get_tools(user_settings)` at threads.py:1499-1506 and passes the result through. New tools are picked up automatically.

---

### `backend/app/api/threads.py` (MODIFIED — extend `ToolContext` + initialize semaphore in `agent_runner`)

**Analog:** self — `ToolContext` dataclass at `tool_dispatcher.py:59-77`, construction site at `threads.py:2603-2618`.

**ToolContext extension** (`backend/app/services/tool_dispatcher.py:59-77` — actually edit this file, not threads.py, but the construction site is in threads.py):
```python
@dataclass
class ToolContext:
    # ... existing fields ...
    iteration: int = 0
    # Phase 085 — three new fields
    parent_run_id: UUID | None = None              # D-085-12 — non-null enforces 1-level nesting cap in _handle_task
    per_run_task_semaphore: asyncio.Semaphore | None = None  # D-085-15 — per-run task() cap
    available_tools: list[str] = field(default_factory=list)  # D-085-09 — for sub-agent toolset subset validation
    tool_call_id: str = ""                         # D-085-01 — for ask_user channel naming
```
**Divergence:** field default_factory for `available_tools` requires `from dataclasses import field` (already imported). All three fields default to safe no-op values so existing 21 handlers don't break.

**Semaphore init at agent_runner site** (`backend/app/api/threads.py:2603-2618`):
```python
# BEFORE the for iteration in range(max_iterations) loop, ONCE per top-level run:
_per_run_task_semaphore = asyncio.Semaphore(settings.task_per_run_concurrency)  # default 3

# In the ToolContext(...) construction at line 2603, ADD three kwargs:
tool_ctx = ToolContext(
    redis=redis,
    run_id=run_id,
    thread_id=thread_id,
    supabase=supabase,
    pool=await get_pg_pool(),
    user_settings=user_settings,
    current_user=current_user,
    folder_subtree_ids=folder_subtree_ids,
    scoped_folder_path=scoped_folder_path,
    emit=_emit,
    spawn=_spawn,
    model=body.model or settings.llm_model,
    previous_files_in_run=_previous_files_in_run,
    iteration=iteration,
    # Phase 085 additions
    parent_run_id=None,                          # top-level run; task_service overrides for sub-agents
    per_run_task_semaphore=_per_run_task_semaphore,
    available_tools=[t["function"]["name"] for t in (active_tools or get_tools(user_settings))],
    # tool_call_id is set PER tool call inside the for-loop below, like tool_index is:
)

# Inside the for tool_index, tc in enumerate(tool_calls) loop at line 2620:
tool_ctx.tool_index = tool_index
tool_ctx.tool_call_id = tc["id"]   # NEW — populate from LLM's tool_call payload
_tool_result = await dispatch_tool(tool_name, args, tool_ctx)
```
**G-5 minimization** (per CLAUDE.md hot-file ledger — threads.py is at 9+ phases): these are the ONLY changes to threads.py. No agent_runner control-flow changes. All new logic lives in `task_service.py`, `todos_service.py`, `ask_user_service.py`.

---

### `backend/app/api/runs.py` (MODIFIED — POST endpoint + cancel-sentinel publish)

**Analog:** self — `cancel_run` at lines 485-625 + `stream_run` at 385-456 (ownership SELECT pattern).

**Ownership SELECT excerpt** (runs.py:396-406):
```python
row_resp = await aexec(
    supabase.table("runs")
    .select("run_id, status, thread_id")
    .eq("run_id", str(run_id))
    .eq("user_id", current_user["id"])
    .maybe_single()
)
row = row_resp.data if row_resp is not None else None
if not row:
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Run not found")
```
**Reuse verbatim** in `submit_ask_user_response` — same 404-not-403 convention (D-062-12 — never leak existence).

**POST endpoint body — `submit_ask_user_response`** (RESEARCH §D.2):
```python
class AskUserResponseBody(BaseModel):
    tool_call_id: str
    response_text: str
    choice_index: int | None = None


@router.post("/{run_id}/ask_user_response", status_code=200)
async def submit_ask_user_response(
    run_id: UUID,
    body: AskUserResponseBody,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
    redis: aioredis.Redis = Depends(get_redis),
):
    # Ownership SELECT — mirror lines 396-406 of stream_run
    # Persist messages row with kind='ask_user_response' FIRST (durable even if PUBLISH no-subscriber)
    # PUBLISH to ask_user:{run_id}:{tool_call_id} via publish_response()
    # Return {"status": "ok"}
```

**Cancel-sentinel integration** in existing `cancel_run` at runs.py:520-529 — INSERT a step 3a before `task.cancel()`:
```python
# Step 3a — happy path
task = RUN_TASKS.get(run_id)
if task is not None and not task.done():
    # Phase 085 D-085-04 — publish cancel sentinel to all active ask_user channels
    # BEFORE task.cancel() so _handle_ask_user returns a normal ToolResult before
    # CancelledError propagates (RESEARCH §A.5 — PUBLISH-first ordering).
    try:
        from app.services.ask_user_service import publish_cancel_sentinel  # noqa: PLC0415
        await publish_cancel_sentinel(redis, run_id)
    except Exception:
        logger.exception("ask_user cancel sentinel broadcast failed for run %s", run_id)
    task.cancel()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
```

---

### `backend/app/main.py` (MODIFIED — lifespan shutdown sentinel broadcast + panel router include)

**Analog:** self — existing lifespan at lines 185-268, router-include block at 303-317.

**Lifespan shutdown broadcast** (main.py:215-227 — insert BEFORE the RUN_TASKS cancel loop):
```python
# Phase 085 D-085-07 — broadcast ask_user shutdown sentinel BEFORE cancelling
# producer tasks (RESEARCH §A.6). Allows paused _handle_ask_user calls to
# return a normal ToolResult so the run completes cleanly as 'error' instead
# of stuck 'streaming'. Best-effort — never block shutdown.
try:
    from app.services.ask_user_service import broadcast_shutdown_sentinel_to_all
    from app.dependencies import get_redis
    await asyncio.wait_for(broadcast_shutdown_sentinel_to_all(get_redis()), timeout=2.0)
except Exception:
    logger.exception("ask_user shutdown sentinel broadcast failed")

# Existing block:
try:
    from app.api.threads import RUN_TASKS
    for task in list(RUN_TASKS.values()):
        if not task.done():
            task.cancel()
    if RUN_TASKS:
        await asyncio.gather(*RUN_TASKS.values(), return_exceptions=True)
except ImportError:
    pass
```

**Router include** (main.py:303-317):
```python
from app.api import threads, runs, documents, settings as settings_api, folders, kb, skills, audit, knowledge_health, feedback, sandbox_outputs, workspace, admin, panel  # noqa: E402

app.include_router(threads.router)
app.include_router(runs.router)
# ... existing includes ...
app.include_router(workspace.router)
app.include_router(admin.router)
app.include_router(panel.router)  # Phase 085 — thread-scoped panel data endpoints
```

---

### `backend/app/config.py` (MODIFIED — new Settings fields)

**Analog:** self — `sub_agent_*` Settings at lines 777-789.

**New Settings fields** (append after `sub_agent_max_output_tokens`):
```python
# Phase 085 — ask_user / task knobs (D-085-03, D-085-10, D-085-15)
ask_user_max_timeout_seconds: int = 1800   # 30 min hard cap (default 300 per-call)
task_max_steps: int = 10                   # Sub-agent iteration cap (default 5 per-call)
task_per_run_concurrency: int = 3          # In-process asyncio.Semaphore
task_global_concurrency: int = 20          # Redis tasks:global:active counter cap
```
All pydantic-settings BaseSettings fields auto-bind to env vars (uppercase form). Defaults match RESEARCH + CONTEXT decisions.

---

### Test files (NEW — `backend/tests/unit/test_085_*.py`, `backend/tests/integration/test_085_*.py`)

**Analog (unit/dispatch registry):** `backend/tests/unit/test_tool_dispatcher.py` — copy the EXPECTED_TOOLS list pattern and registry-count assertion:

```python
# tests/unit/test_085_tool_registration.py (or fold into test_tool_dispatcher.py extension)
EXPECTED_TOOLS_AFTER_085 = [
    # ... 21 existing names ...
    # Phase 085
    "write_todos", "task", "ask_user",
]

def test_registry_has_exactly_24_entries():
    assert len(_TOOL_REGISTRY) == 24

def test_phase_085_tools_registered():
    for tool_name in ("write_todos", "task", "ask_user"):
        assert tool_name in _TOOL_REGISTRY
```

**Analog (mocking pattern for ToolContext-using handlers):** test_tool_dispatcher.py:64-82:
```python
@pytest.mark.asyncio
async def test_dispatch_unknown_tool_returns_error():
    ctx = ToolContext(
        redis=None, run_id=None, thread_id="test-thread", supabase=None, pool=None,
        user_settings=None, current_user={"id": "test-user"},
        folder_subtree_ids=None, scoped_folder_path=None,
        emit=AsyncMock(), spawn=lambda c: None,
    )
    result = await dispatch_tool("nonexistent_tool", {}, ctx)
    assert isinstance(result, ToolResult)
```
**Divergence for Phase 085 tests:** ToolContext now requires the 4 new fields. Add defaults in the test fixture or update ToolContext's dataclass defaults so test instantiation stays one-line.

**Integration test scaffolding:** **NO close analog in the repo for Redis pub/sub.** Plan 03 Wave 0 must build a `redis_pubsub` pytest fixture from scratch. Recommended skeleton:
```python
# tests/integration/conftest.py addition
@pytest_asyncio.fixture
async def redis_client():
    from app.dependencies import get_redis
    client = get_redis()
    yield client
    # Cleanup: clear test channels
    async for key in client.scan_iter("ask_user:channels:*", count=100):
        await client.delete(key)
```
**Integration test for SUBSCRIBE-before-PUBLISH ordering** (RESEARCH §A.3 — load-bearing):
```python
@pytest.mark.asyncio
async def test_publish_resumes_paused_handler(redis_client):
    # 1. Start a task awaiting subscribe_for_response with a 10s timeout
    # 2. Wait 100ms (enough for SUBSCRIBE to register)
    # 3. PUBLISH from a separate coroutine
    # 4. Assert the awaiting task returns the published payload
```

---

## Shared Patterns

### Authentication / Ownership (4 endpoints)
**Source:** `backend/app/api/workspace.py:27-49` (`_verify_thread_ownership`) + `backend/app/api/runs.py:396-406` (ownership SELECT on runs).
**Apply to:** `panel.py` (3 GET endpoints — verify thread ownership) + `runs.py:submit_ask_user_response` (verify run ownership).
```python
# Thread-scoped (panel.py)
async def _verify_thread_ownership(thread_id: str, current_user: dict, supabase: Client) -> None:
    resp = await aexec(
        supabase.table("threads")
        .select("id").eq("id", thread_id).eq("user_id", current_user["id"])
        .maybe_single()
    )
    if not (resp.data if resp is not None else None):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Thread not found")

# Run-scoped (runs.py — copy from stream_run / cancel_run pattern)
row_resp = await aexec(
    supabase.table("runs").select("run_id, status, thread_id")
    .eq("run_id", str(run_id)).eq("user_id", current_user["id"])
    .maybe_single()
)
row = row_resp.data if row_resp is not None else None
if not row:
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Run not found")
```
**404-not-403 convention** is project-wide (D-062-12) — NEVER leak resource existence.

### Error handling (all new code)
**Source:** `backend/app/services/tool_dispatcher.py:865-897` — handlers catch domain errors + return `ToolResult(result=json.dumps({"error": str(e)}))`; broad exceptions are caught in `agent_runner` at threads.py:2644-2652 and converted to a generic "Tool execution failed" string.
**Apply to:** `_handle_write_todos`, `_handle_task`, `_handle_ask_user`.
```python
try:
    result = await service_call(...)
    await ctx.emit(...)
    return ToolResult(result=json.dumps({"status": "ok", ...}))
except DomainError as e:
    return ToolResult(result=json.dumps({"error": str(e)}))
# Broader exceptions propagate to agent_runner's outer except — DON'T swallow them.
```

### Blocking-I/O wrapping (D-v2.5-01)
**Source:** `backend/app/services/workspace_service.py:135-139, 249-254, 391-393` — `await run_in_threadpool(supabase.storage.from_(...).download, path)`.
**Apply to:** All supabase-py sync calls in `panel.py`. `aexec()` (from `app.utils.db`) already wraps `.execute()` in threadpool — use it for queries. Direct storage / non-table calls use `run_in_threadpool` explicitly.
**Exception:** `redis.asyncio` calls are async-native; `asyncpg.Pool` calls are async-native. NO threadpool wrap on either.

### SSE emit (5 new event types)
**Source:** `backend/app/api/threads.py:109-123` (`_emit`).
**Apply to:** All 3 new handlers + sub-agent stream emits in `task_service.py`.
```python
await ctx.emit(ctx.redis, ctx.run_id, 'todo_updated', todos=todos_payload)
await ctx.emit(ctx.redis, ctx.run_id, 'ask_user_prompt', tool_call_id=tcid, prompt=prompt, options=options, timeout_seconds=timeout_seconds)
await ctx.emit(ctx.redis, ctx.run_id, 'ask_user_response', tool_call_id=tcid, response_text=text, choice_index=ci)
await ctx.emit(parent_ctx.redis, parent_ctx.run_id, 'sub_agent_start', sub_run_id=str(sub_run_id), description=desc, tools=tools, max_steps=max_steps)
await ctx.emit(parent_ctx.redis, parent_ctx.run_id, 'sub_agent_done', sub_run_id=str(sub_run_id), status=status, summary=summary)
```
**Critical for `task` sub-agent (RESEARCH §R9):** start/done emit on PARENT's `run:{parent_run_id}` Stream; all sub-agent-INTERNAL tool events emit on `run:{sub_run_id}` Stream. Phase 086 demux relies on this split.

**Existing `sub_agent_*` collision (RESEARCH R10):** `analyze_document` already emits `sub_agent_start{filename, task}` / `sub_agent_delta` / `sub_agent_done`. Phase 085's `task` emits `sub_agent_start{sub_run_id, description, tools, max_steps}` / `sub_agent_done{sub_run_id, status, summary}` — SAME event names, DIFFERENT payload shapes. Frontend Phase 086 demuxes by presence of `sub_run_id` field. Plan 04's VALIDATION.md must document this contract (UAT Row 17).

### Singleton client access
**Source:** `backend/app/dependencies.py:26-100` — `get_redis()`, `get_supabase()`, `get_pg_pool()` are singletons; never instantiate clients in handlers.
**Apply to:** All new endpoints — use `Depends(get_supabase)`, `Depends(get_redis)`, and `await get_pg_pool()` (for asyncpg routes in `panel.py`).

### Migration discipline (CLAUDE.md hard rule)
1. Filename: `055_todos_table.sql` — no letter suffix (Phase 085 uses next-available integer).
2. Apply via Supabase SQL editor (never `supabase db push` or `db reset` — preserves dev data).
3. After apply: run `bash scripts/regenerate-full-schema.sh` (defaults to no-reset live-DB dump).
4. Commit both `055_todos_table.sql` AND the regenerated `supabase/full-schema.sql`.

---

## No Analog Found

Files with no close match in the codebase (planner should use RESEARCH.md sections as the authoritative spec):

| File | Role | Data Flow | Reason | RESEARCH section |
|------|------|-----------|--------|------------------|
| `backend/app/services/ask_user_service.py` | pub/sub helper | event-driven | First Redis pub/sub usage in the repo — Streams (XADD/XREAD) is the existing pattern, pub/sub (SUBSCRIBE/PUBLISH) is novel | §A.1 (channel naming + cleanup), §A.3 (race ordering), §A.5 (cancel sentinel), §A.6 (shutdown broadcast) |
| `backend/tests/integration/test_085_ask_user_*.py` (4 files) | integration test | Redis pub/sub coordination | No integration tests exist for pub/sub behavior; no existing fixtures for cross-coroutine subscriber + publisher | Plan 03 Wave 0 must scaffold (RESEARCH "Validation Architecture › Wave 0 Gaps" — line 989) |
| `backend/tests/integration/test_085_concurrency.py` | integration test | semaphore + Redis Lua counter | No analog for `tasks:global:active` cap or per-run Semaphore stress tests | Plan 02 Wave 0 must scaffold |
| Replace-todos transactional shape | service primitive | DB | Workspace_service uses upserts, not atomic DELETE+INSERT-many; the full-state-replace shape is genuinely new in this codebase | §C.2 |

---

## Cross-cutting Planning Notes (for the planner)

### Plan 01 (todos + migration) read-first list
1. `supabase/migrations/054_workspace_files.sql` — RLS FK-chain template
2. `backend/app/services/tool_dispatcher.py:865-897, 1013-1036` — `_handle_workspace_write` and registry shape
3. `backend/app/db/runs.py:26-59` — insert_run signature; extend with `parent_run_id` kwarg
4. `backend/tests/unit/test_tool_dispatcher.py:1-117` — registry assertion pattern

### Plan 02 (task service + concurrency caps) read-first list
1. `backend/app/services/sub_agent_service.py:62-126` — cross-provider model fallback (MUST replicate, MUST NOT modify)
2. `backend/app/api/threads.py:1402-1508, 2600-2700, 2989-3097` — agent_runner setup + tool-dispatch loop + _shielded_finalize discipline
3. `backend/app/api/threads.py:109-141` — `_emit` and `_emit_terminal` helpers
4. `backend/app/services/tool_dispatcher.py:59-77` — `ToolContext` dataclass (extend with 4 new fields)
5. `backend/app/db/runs.py:1-103` — insert_run + finalize_run signatures
6. `backend/app/services/openai_service.py:create_adaptive_streaming_chat` (find via Grep — used in threads.py) — the LLM streaming SDK entry point

### Plan 03 (ask_user pub/sub) read-first list
1. `backend/app/dependencies.py:26-47` — singleton Redis client (no new connection setup needed)
2. `backend/app/api/runs.py:485-625` — cancel_run integration site for sentinel publish
3. `backend/app/main.py:185-268` — lifespan shutdown hook
4. `backend/app/api/threads.py:2989-3097` — `_shielded_finalize` 5-step ordering (ensure ask_user pause doesn't break it)
5. RESEARCH §A.1-A.8 — full pub/sub design (NO codebase analog)

### Plan 04 (REST + tool schemas + UAT) read-first list
1. `backend/app/api/workspace.py:1-49, 98-123` — panel.py router scaffolding template
2. `backend/app/api/runs.py:385-456` — ownership SELECT pattern for run-scoped endpoint
3. `backend/app/services/openai_service.py:495-625, 651-658` — tool schema constants + get_tools() extension site
4. `backend/app/main.py:303-317` — router include site
5. RESEARCH §D.1-D.5 — endpoint specifics + §E tool descriptions verbatim
6. RESEARCH §"Validation Architecture › SC#10 4-Axis UAT Matrix" — 18-row UAT table is Plan 04's VALIDATION.md backbone

---

## Metadata

**Analog search scope:**
- `backend/app/services/*.py` (workspace_service, sub_agent_service, tool_dispatcher, openai_service)
- `backend/app/api/*.py` (threads, runs, workspace)
- `backend/app/db/*.py` (runs)
- `backend/app/dependencies.py`, `backend/app/main.py`, `backend/app/config.py`
- `supabase/migrations/054_workspace_files.sql`
- `backend/tests/unit/test_tool_dispatcher.py`, `backend/tests/unit/test_workspace_api.py`

**Files scanned:** 14 source files + 1 migration + 2 test files (read fully or via targeted Grep + offset Reads)

**Pattern extraction date:** 2026-05-28

**Confidence:**
- **HIGH** — todos_service, panel.py, migration 055, tool_dispatcher handlers, openai_service schemas, ToolContext extension, runs.py POST endpoint, main.py lifespan, config.py: every analog read verbatim and Phase 084 is the perfect sibling template.
- **MEDIUM-HIGH** — task_service: sub_agent_service.py shows model-routing safety pattern + threads.py:agent_runner shows finalize discipline, but the dispatcher-loop-inside-sub-agent shape is genuinely new (RESEARCH §B.4 is the spec).
- **MEDIUM** — ask_user_service: NO codebase analog; RESEARCH §A is the authoritative reference, derived from redis-py async docs.
- **MEDIUM** — integration tests for Redis pub/sub and concurrency caps: no existing fixtures; Wave 0 scaffolding required.

## PATTERN MAPPING COMPLETE
