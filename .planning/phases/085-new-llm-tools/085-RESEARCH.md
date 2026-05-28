# Phase 085: New LLM Tools - Research

**Researched:** 2026-05-28
**Domain:** Backend agent tool dispatch + Redis pub/sub + sub-agent isolation + thread-scoped REST endpoints
**Confidence:** HIGH (verified against Phase 083/084 reference patterns + current codebase reads; ask_user pub/sub race verified against redis-py official docs)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**ask_user pause/resume:**
- D-085-01: `_handle_ask_user` blocks on Redis pub/sub SUBSCRIBE at `ask_user:{run_id}:{tool_call_id}`. Returns a normal `ToolResult` so the existing agent_runner loop continues — no run-state machinery.
- D-085-02: `POST /runs/{run_id}/ask_user_response` body = `{tool_call_id, response_text, choice_index?}`. Returns 200 after PUBLISH succeeds.
- D-085-03: Default timeout 300s; configurable via `timeout_seconds` arg; server clamp via `ASK_USER_MAX_TIMEOUT_SECONDS` (default 1800s).
- D-085-04: Cancel sentinel via PUBLISH; handler wakes and returns "ask_user cancelled by user stop".
- D-085-05: Prompts/responses persist as `messages` rows with `tool_calls.kind='ask_user_prompt'` / `'ask_user_response'` (extends Phase 075.4 pattern).
- D-085-06: Parallel ask_user supported via per-tool-call channel naming.
- D-085-07: Uvicorn lifespan shutdown broadcasts cancel sentinel to all `ask_user:*` channels.

**task sub-agent:**
- D-085-08: `task(description, instructions?, tools?, max_steps?)`; description required; instructions APPENDED to server-controlled base prompt.
- D-085-09: `tools` arg must be subset of parent's available_tools; `task`/`ask_user`/`write_todos` are excluded from sub-agent toolsets; default = parent's read-only tools.
- D-085-10: `max_steps` clamped to `TASK_MAX_STEPS` (default 10); default-when-omitted = 5.
- D-085-11: NO `model_override` / `system_prompt_override` exposure in v1. Sub-agent inherits parent's provider + user's configured `sub_agent_model`.
- D-085-12: 1-level nesting cap via `ToolContext.parent_run_id: UUID | None`.
- D-085-13: `task()` returns sub-agent's **final assistant message text only**.
- D-085-14: Each task() gets its own `runs` row + `run:{sub_run_id}` Stream. Parent emits `sub_agent_start{sub_run_id, description, tools, max_steps}` and `sub_agent_done{sub_run_id, status, summary}`.
- D-085-15: Concurrency caps — per-run 3 (`asyncio.Semaphore`); global 20 (`tasks:global:active` Redis INCR/DECR). Configurable via `TASK_PER_RUN_CONCURRENCY` / `TASK_GLOBAL_CONCURRENCY`.
- D-085-16: New `backend/app/services/task_service.py`. Existing `sub_agent_service.py` STAYS byte-identical.

**write_todos:**
- D-085-17: `write_todos(todos: list[Todo]) -> {accepted: int, version: int}`. Todo shape `{id, content, status, parent_id, order_index}`.
- D-085-18: Full-state-replace = DELETE + INSERT in a single transaction.
- D-085-19: Status enum `pending | in_progress | completed`.
- D-085-20: Optional `parent_id` for nesting.
- D-085-21: SSE `todo_updated{todos: [...]}` — full list on every emit.
- D-085-22: `todos` table with RLS via FK chain to `threads` (mirrors `workspace_files` pattern).

**REST endpoints:**
- D-085-23: Ship 4 endpoints — `POST /runs/{rid}/ask_user_response`, `GET /threads/{tid}/todos`, `GET /threads/{tid}/ask_user/pending`, `GET /threads/{tid}/tasks`.
- D-085-24: Follow existing FastAPI router patterns; RLS-enforced reads via supabase-py + `auth.uid()`; wrap sync with `run_in_threadpool`.

**Cross-cutting:**
- D-085-25: Toolbox grows to 24 tools (16 existing + 5 workspace + 3 new).
- D-085-26: Plant SEED-035 (re_open if Google/DeepSeek tool-selection <90%).
- D-085-27: SC#10 4-axis UAT (cross-provider × multi-tool × parallel-thread × long-message).
- D-085-28: All blocking I/O via `run_in_threadpool` / asyncpg pool. `redis.asyncio` SUBSCRIBE is already async — no threadpool.

### Claude's Discretion

- Whether `task_service.py` is one file or splits service + agent-loop adapter.
- Wire format of the structured Todo[] payload (always-array vs streaming partial).
- Migration numbering (next after 054); single migration combining todos table + comment on messages.tool_calls.kind.
- Whether sub-agent's `runs.parent_run_id` is a new column on `runs` vs stored in `runs.metadata` jsonb.
- Default `ask_user` prompt placeholder if agent passes empty string.
- Tool description wording in `get_tools()` (must lead with "Use when..." / "Do not use for...").

### Deferred Ideas (OUT OF SCOPE)

- `task` `system_prompt_override` / `model_override` exposure — v2.8.
- Tool count consolidation — SEED-035 trigger only.
- Harness Engine workflows — v2.8.
- Sub-agent panel drill-down UI — Phase 087.
- write_todos checkbox-in-panel-flips-status — v2.8.
- Markdown rendering in ask_user prompts — v2.8.
- BUG-260523-04 (Anthropic 15+ iter) — separate post-075.4 trace investigation, not folded.
- BUG-260528-03 (non-Anthropic generic task descriptions) — frontend concern, not in 085 scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TOOL-01 | `write_todos` persists per-thread; SSE emit; panel renders without re-fetch | Implementation Area C (todos table + transaction); SSE shape in Area F |
| TOOL-02 | `task` spawns sub-agent with constrained toolset, 1-level nesting cap, per-run + global concurrency | Implementation Area B (sub-agent isolation, semaphore + Redis INCR/DECR) |
| TOOL-03 | `ask_user` pauses; user responds via panel; agent resumes with response in tool_result | Implementation Area A (Redis pub/sub mechanics + sentinel) |
| TOOL-04 | `ask_user` cross-worker coordination; configurable timeout; graceful expiry | Implementation Area A (Worker A/B coordination, asyncio.wait_for race) |
</phase_requirements>

## Summary

Phase 085 is a backend-only delivery of three new LLM tools that ride the Phase 083 tool dispatcher: `write_todos` (durable per-thread todo list, full-state-replace), `task` (sub-agent spawner with isolation + concurrency caps), and `ask_user` (human-in-the-loop pause/resume via Redis pub/sub). It also ships 4 REST endpoints and one migration. Frontend (StreamsProvider extension Phase 086, Panel UI Phase 087) consumes the new SSE events + REST endpoints, but is not in scope here.

The phase has one genuinely hard area (`ask_user` cross-worker Redis pub/sub — Worker A blocks on SUBSCRIBE, Worker B receives the user's POST and PUBLISHes, Worker A wakes; race between PUBLISH and SUBSCRIBE registration is real per redis-py docs), one moderately hard area (`task` concurrency caps that survive crashes + 1-level nesting enforcement + sub-agent agent-loop scaffolding that doesn't share code with `threads.py:agent_runner`), and one straightforward area (`write_todos` table + transaction + SSE emit + GET endpoint, mechanically identical to Phase 084's `workspace_files`).

**Primary recommendation:** Structure as **4 plans across 2 waves**. Wave 1 (parallel): Plan 01 = migration + todos service + write_todos handler + SSE (independent vertical slice). Plan 02 = task_service.py + concurrency caps + task handler + sub_agent_start/done events (depends only on `ToolContext` extension and `tool_dispatcher` registry — independent of Plan 01). Wave 2: Plan 03 = ask_user_service.py + pub/sub + sentinel cleanup integration with `_shielded_finalize` (depends on stable ToolContext from Wave 1). Plan 04 = 4 REST endpoints + tool schemas in `get_tools()` + SC#10 4-axis UAT VALIDATION.md (depends on all three tools landing). Plan 04 also owns the `runs.parent_run_id` story (recommend new column via the migration in Plan 01 OR jsonb storage — see Area B.2).

The minimum viable structure is 3 plans (collapse Plan 04's tool schemas into each tool's plan), but separating the cross-cutting UAT + endpoints into Plan 04 buys the planner a clear gate where the 4-axis matrix can be authored against landed code, not against planned-but-not-shipped behavior. The 4-plan structure is recommended.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| `write_todos` persistence | Database (Postgres) | API/Backend (todos_service) | Full-state-replace is a DB transaction; service is a thin wrapper |
| `write_todos` SSE emit | API/Backend (tool_dispatcher) | — | Rides existing `run:{run_id}` Stream via `_emit` |
| `task` sub-agent loop | API/Backend (task_service.py) | LLM provider SDK | Owns its own agent loop iterations + tool calls; calls into `openai_service.create_streaming_chat` |
| `task` concurrency cap (per-run) | API/Backend (ToolContext semaphore) | — | In-process asyncio.Semaphore; no cross-process state needed |
| `task` concurrency cap (global) | Cache (Redis counter) | API/Backend | `INCR tasks:global:active` is atomic across uvicorn workers |
| `task` 1-level nesting cap | API/Backend (ToolContext field) | — | `parent_run_id` non-null at sub-agent ToolContext construction site |
| `ask_user` pause | API/Backend (asyncio coroutine block) | Cache (Redis pub/sub) | Worker holds the run; SUBSCRIBE is the cross-worker rendezvous |
| `ask_user` response | API/Backend (POST endpoint) | Cache (Redis PUBLISH) | POST lands on any worker; PUBLISH reaches the paused worker |
| `ask_user` persistence | Database (messages table) | — | Reload-survivable; mirrors Phase 075.4 system_warning pattern |
| 4 REST GET/POST endpoints | API/Backend (panel.py or runs.py) | Database (RLS reads) | Standard supabase-py-with-RLS pattern from Phase 084 |

## Implementation Areas

### A. `ask_user` Redis pub/sub mechanics (HIGH RISK)

#### A.1 Channel naming + lifecycle

Channel name: `ask_user:{run_id}:{tool_call_id}` [CITED: D-085-02, D-085-06]. The `tool_call_id` is provided by the LLM in its tool-call payload and is unique per call within a run — parallel `ask_user` invocations get distinct channels [CITED: D-085-06].

`redis.asyncio.pubsub` runs alongside the existing Streams traffic on the **same `aioredis.Redis` singleton** (`backend/app/dependencies.py:26-47`). Pub/sub uses a separate Redis connection internally (the redis-py async PubSub object spawns its own subscription connection on first `subscribe()` call) — does NOT compete with XADD/XREAD on the Streams connection. **No new connection pooling work needed.**

Verified pattern (from redis-py async docs):

```python
# In ask_user_service.py
async def subscribe_for_response(redis, run_id, tool_call_id, timeout_seconds):
    channel = f"ask_user:{run_id}:{tool_call_id}"
    pubsub = redis.pubsub()
    try:
        await pubsub.subscribe(channel)
        # CRITICAL: redis-py's async pubsub get_message() default timeout=0
        # spin-loops at 100% CPU. Always wrap with asyncio.wait_for.
        msg = await asyncio.wait_for(
            _wait_for_message(pubsub),
            timeout=timeout_seconds,
        )
        return msg  # {"kind": "response"|"cancel"|"shutdown", ...payload}
    except asyncio.TimeoutError:
        return None
    finally:
        try:
            await pubsub.unsubscribe(channel)
            await pubsub.aclose()
        except Exception:
            pass  # idempotent cleanup; never block on cleanup

async def _wait_for_message(pubsub):
    while True:
        msg = await pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
        if msg is not None and msg.get("type") == "message":
            return json.loads(msg["data"])
```

#### A.2 Cross-worker resume

User submits response → POST handler lands on Worker B → Worker B PUBLISHes `ask_user:{rid}:{tcid}` with `{kind: "response", response_text, choice_index}` → Worker A's pubsub connection receives the message → `get_message()` returns → `_handle_ask_user` returns `ToolResult(result=response_text_or_json)` → agent_runner loop continues.

**Redis pub/sub is fire-and-forget — messages are NOT queued for late subscribers** [VERIFIED: redis-py asyncio docs https://redis.readthedocs.io/en/stable/examples/asyncio_examples.html — "messages published to channels with no subscribers are lost"].

#### A.3 PUBLISH-BEFORE-SUBSCRIBE race (CRITICAL)

**The race window:**
1. Worker A: `_handle_ask_user` starts, has NOT yet awaited `pubsub.subscribe(channel)`.
2. Worker A: emits `ask_user_prompt` SSE event (frontend renders prompt).
3. (Very fast user) Worker B: POST arrives, PUBLISH happens.
4. Worker A: NOW awaits `pubsub.subscribe()` — too late, message is gone.
5. Worker A: hangs until timeout.

**Mitigation (REQUIRED in implementation):**

```python
# In _handle_ask_user — order is load-bearing:
# 1. SUBSCRIBE FIRST (before emitting the prompt or persisting the messages row)
pubsub = ctx.redis.pubsub()
await pubsub.subscribe(channel)  # blocks until Redis acks SUBSCRIBE

# 2. THEN persist the messages row (kind='ask_user_prompt') — durable reload state
await aexec(ctx.supabase.table("messages").insert({...}))

# 3. THEN emit the SSE event (frontend now renders prompt)
await ctx.emit(ctx.redis, ctx.run_id, 'ask_user_prompt', ...)

# 4. THEN block on get_message — now the race window is closed
msg = await asyncio.wait_for(_wait_for_message(pubsub), timeout=...)
```

Why this works: Step 1 establishes the subscription before the user has any way to know to respond (no SSE event, no DB row). The earliest possible user response can't happen until step 3 — at which point the subscriber is already registered.

#### A.4 Timeout race with simultaneous PUBLISH

`asyncio.wait_for(timeout)` fires at the same instant PUBLISH lands. Two outcomes are possible:
- The PUBLISH message arrived a microsecond before the timer fires → `wait_for` returns the message (success).
- The timer fires a microsecond before the PUBLISH lands → `asyncio.TimeoutError` raised, handler returns "timed out" — and the PUBLISH message is silently lost (channel still has the subscription until `unsubscribe` runs in the finally block).

This is acceptable: from the user's perspective, they hit "Submit" at the same moment the agent gave up; either outcome is reasonable. **Document this in the handler docstring.** The POST endpoint still returns 200 (PUBLISH succeeded; subscriber existed; we don't check the subscriber count).

#### A.5 Stop/cancel sentinel integration

Per D-085-04, the cancel path publishes a sentinel on `ask_user:{rid}:*`. Pattern publishing isn't supported in Redis (publishers publish to specific channels, not patterns) — the cancel path must enumerate active channels for this run and PUBLISH to each.

**Recommended state tracking:** Each Worker that calls `_handle_ask_user` adds the channel to a process-local set `_ASK_USER_CHANNELS_BY_RUN: dict[UUID, set[str]]`. The cancel path scans this set per run_id.

Integration site in `runs.py:cancel_run` (~line 490-528):

```python
# Step 3a happy path — task.cancel() schedules CancelledError.
# Before calling task.cancel(), broadcast sentinel to any active ask_user channels for this run:
if task is not None and not task.done():
    from app.services.ask_user_service import publish_cancel_sentinel
    await publish_cancel_sentinel(redis, run_id)  # PUBLISHes "cancel" to all channels in _ASK_USER_CHANNELS_BY_RUN[run_id]
    task.cancel()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
```

**The cancel sentinel order matters:** PUBLISH must happen BEFORE `task.cancel()`. If `task.cancel()` runs first, the CancelledError propagates into the SUBSCRIBE coroutine and the cleanup runs without ever seeing the sentinel — semantically the same outcome (run becomes cancelled) but the messages row has no `kind='ask_user_response'` companion, which Plan 03's GET `/threads/{tid}/ask_user/pending` would then return forever. PUBLISH-first ensures `_handle_ask_user` returns a normal ToolResult and the agent loop iterates one more time (writing the response row) before any cancellation propagates.

**Cross-worker cancel:** The cancel POST can land on ANY worker, but `_ASK_USER_CHANNELS_BY_RUN` is process-local. Solution: also store the channel name in Redis at SUBSCRIBE time:

```python
# At SUBSCRIBE time:
await ctx.redis.sadd(f"ask_user:channels:{run_id}", channel)
await ctx.redis.expire(f"ask_user:channels:{run_id}", 3600)  # safety TTL

# At UNSUBSCRIBE time (in finally):
await ctx.redis.srem(f"ask_user:channels:{run_id}", channel)

# At cancel time (from any worker):
channels = await ctx.redis.smembers(f"ask_user:channels:{run_id}")
for ch in channels:
    await ctx.redis.publish(ch, json.dumps({"kind": "cancel"}))
```

This is the canonical cross-worker rendezvous shape.

#### A.6 Uvicorn shutdown broadcast (D-085-07)

`main.py:215-227` already cancels all RUN_TASKS at lifespan shutdown. Add a step BEFORE that loop:

```python
# In main.py lifespan, BEFORE the RUN_TASKS cancel loop:
try:
    from app.services.ask_user_service import broadcast_shutdown_sentinel_to_all
    await broadcast_shutdown_sentinel_to_all(get_redis())
except Exception:
    logger.exception("ask_user shutdown sentinel broadcast failed")
```

Implementation: SCAN `ask_user:channels:*` keys, SMEMBERS each, PUBLISH `{"kind": "shutdown"}` to every channel. The SUBSCRIBE coroutines wake, return `ToolResult(result="ask_user interrupted by server shutdown")`, the agent loop iterates once more, the producer's normal cancellation path then catches CancelledError and runs `_shielded_finalize` with `_terminal_status='error'`.

**Race note:** between shutdown sentinel broadcast and the cancel of RUN_TASKS, paused agent loops may finish their iteration and hit the LLM SDK again. This is fine — the SDK call has its own timeout, and the subsequent cancel propagates normally.

#### A.7 Reload survival (D-085-05)

`messages` rows with `tool_calls.kind='ask_user_prompt'` persist to Postgres BEFORE the SUBSCRIBE call (per A.3 ordering). After hard reload:
- Frontend hits GET `/threads/{tid}/ask_user/pending` → returns rows that have no matching `kind='ask_user_response'` companion.
- Panel renders those prompts again.
- User submits → POST `/runs/{rid}/ask_user_response`.

**But the SUBSCRIBE is dead** (the worker process is gone or recycled). What happens?

- POST handler PUBLISHes anyway. No subscriber, message lost.
- POST handler ALSO inserts a `messages` row with `kind='ask_user_response'` BEFORE the PUBLISH (so the response is durable even when no subscriber exists).
- POST returns 200 regardless of whether PUBLISH had a subscriber.
- The dead agent run shows `status='error'` in the runs table from shutdown sentinel processing — user sees "Agent run ended" in the chat history. The response row exists but is observability-only.

This is the right behavior — runs don't resurrect across worker restarts. The user gets ack that their answer was recorded; the chat is over.

Wire format for `messages.tool_calls` rows (extending Phase 075.4 system_warning pattern):

```jsonc
// ask_user_prompt row (role='system')
{
  "tool_calls": [{
    "kind": "ask_user_prompt",
    "tool_call_id": "call_abc123",
    "prompt": "Which file should I overwrite?",
    "options": ["a.txt", "b.txt", null],  // optional
    "timeout_seconds": 300,
    "run_id": "uuid"  // for reverse-lookup in the GET /pending endpoint
  }]
}

// ask_user_response row (role='system')
{
  "tool_calls": [{
    "kind": "ask_user_response",
    "tool_call_id": "call_abc123",  // joins to prompt
    "response_text": "a.txt",
    "choice_index": 0  // or null
  }]
}
```

#### A.8 Recommended discretion resolutions for Area A

- **Empty prompt placeholder (Claude's discretion item):** Treat empty `prompt` as a tool error — return `ToolResult(result="ask_user requires a non-empty prompt")`. Less surprising than rendering "(no prompt)" in the panel; the LLM will retry with valid input.
- **`ASK_USER_MAX_TIMEOUT_SECONDS` env var:** Default 1800 (30 min) per D-085-03. Add to `Settings` in `backend/app/config.py`.

### B. `task` sub-agent isolation

#### B.1 Toolset constraint enforcement

Parent's `available_tools` lives on `ToolContext` already implicitly via the `agent_runner` scope (`active_tools` local at `threads.py:1499-1506` — derived from `get_tools()` or `get_explorer_tools()`). The cleanest construction:

1. Extend `ToolContext` with a new field `available_tools: list[str]` (list of tool names, populated by agent_runner before tool dispatch — derived from the tool schemas it passes to the LLM).
2. In `_handle_task`, validate `requested_tools ⊆ ctx.available_tools - {"task", "ask_user", "write_todos"}`. On violation, return `ToolResult(result="task() refused: requested tools {invalid_tools} not in parent agent's toolset")`.
3. Inside the sub-agent's loop, construct a new ToolContext with `available_tools=validated_tools` so any dispatch_tool call from the sub-agent loop can early-fail for any tool not in the sub-agent's set (defense-in-depth).

```python
# In _handle_task (called from parent's tool_dispatcher):
async def _handle_task(args: dict, ctx: ToolContext) -> ToolResult:
    if ctx.parent_run_id is not None:
        return ToolResult(result="task() unavailable inside a sub-agent — 1-level nesting cap")
    requested = args.get("tools")
    if requested is None:
        # Default: parent's read-only tools, minus the 3 new tools.
        DEFAULT_READ_ONLY = {"search_documents", "query_documents", "read_document",
                             "web_search", "ls", "tree", "grep", "glob",
                             "analyze_document", "query_tables",
                             "workspace_read", "workspace_list"}
        sub_tools = sorted(set(ctx.available_tools) & DEFAULT_READ_ONLY)
    else:
        EXCLUDED = {"task", "ask_user", "write_todos"}
        invalid = [t for t in requested if t not in ctx.available_tools or t in EXCLUDED]
        if invalid:
            return ToolResult(result=f"task() refused: tools {invalid} not available to sub-agent")
        sub_tools = [t for t in requested if t not in EXCLUDED]
    # ... proceed to spawn sub-agent ...
```

#### B.2 1-level nesting cap

`ToolContext.parent_run_id: UUID | None = None` (new field, defaults None for top-level runs). Set to the parent's `run_id` when constructing the sub-agent's context inside `task_service.py`. `_handle_task` short-circuits when `ctx.parent_run_id is not None` [CITED: D-085-12].

**Discretion resolution — `runs.parent_run_id` storage:** Recommend a new TEXT column on `runs` (added in Plan 01's migration). Two reasons:
1. `GET /threads/{tid}/tasks` (D-085-23) needs to query sub-agent runs by parent — a `WHERE parent_run_id = $1` filter on an indexed column is the cleanest read pattern.
2. The `runs` table doesn't currently have a `metadata` jsonb column (verified `supabase/migrations/035_runs_table.sql`), so the "stuff into jsonb" alternative isn't free — it would require a separate migration anyway.

Column DDL:
```sql
ALTER TABLE public.runs ADD COLUMN parent_run_id uuid REFERENCES public.runs(run_id) ON DELETE SET NULL;
CREATE INDEX idx_runs_parent_run_id ON public.runs(parent_run_id) WHERE parent_run_id IS NOT NULL;
```

#### B.3 Concurrency caps

**Per-run (asyncio.Semaphore):** Initialized once per top-level run in `agent_runner` before the iteration loop:

```python
# In threads.py:agent_runner, before the for iteration in range(max_iterations) loop:
_per_run_task_semaphore = asyncio.Semaphore(int(os.getenv("TASK_PER_RUN_CONCURRENCY", "3")))
ctx = ToolContext(..., per_run_task_semaphore=_per_run_task_semaphore)
```

`_handle_task` uses `async with ctx.per_run_task_semaphore:` to gate spawn:

```python
async def _handle_task(args: dict, ctx: ToolContext) -> ToolResult:
    # ... validation ...
    if not ctx.per_run_task_semaphore._value:  # already at cap
        return ToolResult(result=f"task() concurrency limit reached — {ctx.per_run_task_semaphore._bound_value} active")
    async with ctx.per_run_task_semaphore:
        # ... spawn sub-agent ...
```

**Caveat:** `_value` is private API. Better — use a non-blocking `acquire`:

```python
acquired = ctx.per_run_task_semaphore.locked() is False  # rough check
if not await _try_acquire_nowait(ctx.per_run_task_semaphore):
    return ToolResult(result="task() per-run concurrency limit reached")
try:
    # ... spawn ...
finally:
    ctx.per_run_task_semaphore.release()
```

Where `_try_acquire_nowait` does:
```python
async def _try_acquire_nowait(sem):
    try:
        await asyncio.wait_for(sem.acquire(), timeout=0)
        return True
    except asyncio.TimeoutError:
        return False
```

**Global (Redis counter):**

```python
async def acquire_global_task_slot(redis, max_concurrent):
    # Pseudo-atomic via Lua to avoid INCR+DECR races
    SCRIPT = """
    local cur = redis.call('GET', KEYS[1]) or '0'
    if tonumber(cur) >= tonumber(ARGV[1]) then return 0 end
    redis.call('INCR', KEYS[1])
    redis.call('EXPIRE', KEYS[1], ARGV[2])  -- safety TTL
    return 1
    """
    result = await redis.eval(SCRIPT, 1, "tasks:global:active", max_concurrent, 7200)
    return bool(result)

async def release_global_task_slot(redis):
    await redis.decr("tasks:global:active")
```

**Crash safety (failure signal #6):** If a worker crashes between INCR and DECR, the counter leaks. Mitigation:
1. Wrap DECR in `try/finally` inside `task_service.py`.
2. Add a startup-time reset in `main.py` lifespan startup: `await redis.set("tasks:global:active", 0)` ONLY when WORKER_COUNT=1 OR only on the leader worker. With WORKER_COUNT=2, neither worker can safely reset (the other may have in-flight tasks). Compromise: use the EXPIRE TTL (e.g. 2 hours) as the eventual-consistency safety net — leaked slots auto-clear after 2 hours. Document this and add a `/health/tasks` operator endpoint (out of scope for Phase 085; SEED-able).

#### B.4 Sub-agent agent loop (task_service.py)

Mirror the shape of `sub_agent_service.py:run_sub_agent` (which is byte-frozen per D-085-16) but build a NEW file with a NEW loop that supports tool calls (the existing one only streams a single LLM response).

Sketch:

```python
# backend/app/services/task_service.py
from uuid import uuid4
from app.services.openai_service import get_llm_client, create_adaptive_streaming_chat, get_tools
from app.services.tool_dispatcher import dispatch_tool, ToolContext
from app.db.runs import insert_run, finalize_run
from app.api.threads import _emit, _emit_terminal, RUN_TASKS

async def run_task_sub_agent(
    *,
    parent_ctx: ToolContext,
    description: str,
    instructions: str | None,
    allowed_tools: list[str],
    max_steps: int,
) -> dict:
    """Returns {"sub_run_id": uuid, "summary": str, "status": "completed"|"error"}."""
    sub_run_id = uuid4()
    # 1. Insert runs row with parent_run_id set
    await insert_run(
        pool=await get_pg_pool(),
        run_id=sub_run_id,
        thread_id=UUID(parent_ctx.thread_id),
        user_id=UUID(parent_ctx.current_user["id"]),
        status="streaming",
        model=resolve_sub_agent_model(parent_ctx),
        provider=parent_ctx.user_settings.active_provider,
        parent_run_id=parent_ctx.run_id,  # new column
    )

    # 2. Emit sub_agent_start on PARENT's stream
    await _emit(parent_ctx.redis, parent_ctx.run_id, 'sub_agent_start',
                sub_run_id=str(sub_run_id), description=description,
                tools=allowed_tools, max_steps=max_steps)

    # 3. Build sub-agent ToolContext — parent_run_id set, available_tools restricted
    sub_ctx = ToolContext(
        redis=parent_ctx.redis,
        run_id=sub_run_id,                    # sub-agent's own run_id
        thread_id=parent_ctx.thread_id,
        supabase=parent_ctx.supabase,
        pool=parent_ctx.pool,
        user_settings=parent_ctx.user_settings,
        current_user=parent_ctx.current_user,
        folder_subtree_ids=parent_ctx.folder_subtree_ids,
        scoped_folder_path=parent_ctx.scoped_folder_path,
        emit=parent_ctx.emit,
        spawn=parent_ctx.spawn,
        model=parent_ctx.model,
        parent_run_id=parent_ctx.run_id,      # ← non-null enforces 1-level cap
        available_tools=allowed_tools,
        per_run_task_semaphore=parent_ctx.per_run_task_semaphore,  # share parent's (sub-agent can't spawn anyway)
    )

    # 4. Loop — minimal mirror of agent_runner, no streaming SSE to parent for content
    messages = [
        {"role": "system", "content": build_sub_agent_system_prompt(description, instructions, allowed_tools)},
        {"role": "user", "content": description},
    ]
    summary = ""
    final_status = "completed"
    try:
        for step in range(max_steps):
            await _emit(parent_ctx.redis, sub_run_id, 'iteration_start', iteration=step)
            # Call LLM with constrained tools list
            sub_tool_schemas = [t for t in get_tools(parent_ctx.user_settings)
                                if t["function"]["name"] in allowed_tools]
            stream = create_adaptive_streaming_chat(messages=messages, tools=sub_tool_schemas, ...)
            content, tool_calls = await consume_stream_and_extract_tools(stream)
            if not tool_calls:
                summary = content
                break  # LLM produced final answer
            # Dispatch each tool call via the SAME dispatcher (defense-in-depth: sub-agent's
            # available_tools enforced at dispatch time)
            for tc in tool_calls:
                tr = await dispatch_tool(tc.name, tc.args, sub_ctx)
                messages.append({"role": "tool", "tool_call_id": tc.id, "content": tr.result})
            messages.append({"role": "assistant", "content": content, "tool_calls": [...]})
        else:
            # max_steps exhausted without final answer
            summary = content or "Sub-agent reached max_steps without producing a final answer."
            final_status = "completed"  # not error; just truncated
    except Exception as e:
        summary = f"Sub-agent failed: {e}"
        final_status = "error"
    finally:
        # 5. Finalize sub-agent's runs row
        await finalize_run(
            pool=await get_pg_pool(),
            run_id=sub_run_id,
            status=final_status,
            ...,
        )
        # 6. Terminal sentinel on SUB-agent's stream (for /runs/{sub_run_id}/stream consumers)
        await _emit_terminal(parent_ctx.redis, sub_run_id, "done" if final_status == "completed" else "error")
        # 7. Emit sub_agent_done on PARENT's stream
        await _emit(parent_ctx.redis, parent_ctx.run_id, 'sub_agent_done',
                    sub_run_id=str(sub_run_id), status=final_status, summary=summary)

    return {"sub_run_id": sub_run_id, "summary": summary, "status": final_status}
```

**Critical detail:** sub-agent's tool calls use `sub_run_id` as the emit target (Stream `run:{sub_run_id}`), NOT the parent's run_id. The two emit calls in step 2 + step 7 above go to the PARENT's run_id (so the parent's panel knows about the sub-agent); everything inside the loop emits to `sub_run_id` (so Phase 087 drill-down works via existing `/runs/{sub_run_id}/stream`).

**Model routing (D-075.5-04 footgun mitigation):** Replicate the `sub_agent_service.py:62-89` block that validates `effective_model` against the active provider's model list. Put this in a shared helper `resolve_sub_agent_model_safely(user_settings)` if both files need it (Discretion: minor refactor; do not modify existing `sub_agent_service.py`).

### C. `write_todos` schema + transaction

#### C.1 Migration (next number = **055**)

Verified next available number by `Glob supabase/migrations/*.sql` — highest existing is `054_workspace_files.sql`. Use **`055_todos_table.sql`** (no letter suffixes per CLAUDE.md rule).

Combine all DDL in a single migration:

```sql
-- 055_todos_table.sql
-- Phase 085: per-thread todo list (TOOL-01) + runs.parent_run_id for sub-agents (TOOL-02)
--           + doc-comment on messages.tool_calls.kind allowed values (TOOL-03/04)

-- Section 1: todos table
CREATE TABLE public.todos (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    thread_id uuid NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
    todo_id text NOT NULL,  -- client-supplied stable id within the thread
    content text NOT NULL,
    status text NOT NULL CHECK (status IN ('pending', 'in_progress', 'completed')),
    parent_id text,         -- nullable; references another todo's todo_id (same thread)
    order_index integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT todos_thread_todo_unique UNIQUE (thread_id, todo_id)
);
CREATE INDEX idx_todos_thread ON public.todos(thread_id, order_index);

-- Section 2: RLS — same FK-chain pattern as workspace_files
ALTER TABLE public.todos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "todos_select_own" ON public.todos
    FOR SELECT TO authenticated
    USING (auth.uid() = (SELECT user_id FROM threads WHERE id = thread_id));

CREATE POLICY "todos_insert_own" ON public.todos
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = (SELECT user_id FROM threads WHERE id = thread_id));

CREATE POLICY "todos_update_own" ON public.todos
    FOR UPDATE TO authenticated
    USING (auth.uid() = (SELECT user_id FROM threads WHERE id = thread_id));

CREATE POLICY "todos_delete_own" ON public.todos
    FOR DELETE TO authenticated
    USING (auth.uid() = (SELECT user_id FROM threads WHERE id = thread_id));

-- Section 3: runs.parent_run_id for sub-agent index (TOOL-02; D-085-14 + D-085-23)
ALTER TABLE public.runs
    ADD COLUMN parent_run_id uuid REFERENCES public.runs(run_id) ON DELETE SET NULL;
CREATE INDEX idx_runs_parent ON public.runs(parent_run_id) WHERE parent_run_id IS NOT NULL;

-- Section 4: doc-comment on messages.tool_calls.kind values
-- (Phase 075.4 added 'context_truncated', 'iteration_cap_dropped_tool_calls';
--  Phase 085 adds 'ask_user_prompt' and 'ask_user_response'.)
COMMENT ON COLUMN public.messages.tool_calls IS
'JSONB array. For role=system rows, first element may carry a "kind" discriminator: '
'context_truncated | iteration_cap_dropped_tool_calls (Phase 075.4) | '
'ask_user_prompt | ask_user_response (Phase 085).';
```

**Apply via Supabase SQL editor per CLAUDE.md rule.** Then regenerate `supabase/full-schema.sql` via `bash scripts/regenerate-full-schema.sh`.

#### C.2 Full-state-replace transaction

asyncpg is available via `get_pg_pool()`. Use a single transaction:

```python
# backend/app/services/todos_service.py
async def replace_todos(pool, thread_id: UUID, todos: list[dict]) -> dict:
    async with pool.acquire() as conn:
        async with conn.transaction():
            await conn.execute("DELETE FROM todos WHERE thread_id = $1", thread_id)
            if todos:
                # Batch INSERT via executemany for atomicity within the transaction
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
    return {"accepted": len(todos), "version": int(time.time() * 1000)}  # version = ms timestamp
```

**Version semantics (Claude's discretion):** Use a monotonic ms-resolution timestamp. Simple, sortable on the client for idempotency checks, doesn't require a sequence column. Frontend treats `version` as opaque — only used to detect "did the server accept my newer write?".

Alternative (rejected): a `todos_thread_version` table with INCR. Adds a second table for no real win — the LLM rarely calls write_todos in parallel, and even if it does, last-writer-wins is the documented semantics.

#### C.3 SSE emit shape

`_handle_write_todos` calls `replace_todos`, then re-SELECTs all rows for the thread, then emits the full payload:

```python
async def _handle_write_todos(args: dict, ctx: ToolContext) -> ToolResult:
    todos_in = args.get("todos") or []
    # Validate shape (status enum, required fields) — return ToolResult on error
    for t in todos_in:
        if t.get("status") not in ("pending", "in_progress", "completed"):
            return ToolResult(result=f"write_todos: invalid status {t.get('status')!r}; must be pending|in_progress|completed")
        if not t.get("id") or not t.get("content"):
            return ToolResult(result="write_todos: each todo requires id and content")
    result = await replace_todos(ctx.pool, UUID(ctx.thread_id), todos_in)
    # Re-SELECT for canonical SSE payload (returns rows in order_index order)
    rows = await ctx.pool.fetch(
        "SELECT todo_id AS id, content, status, parent_id, order_index "
        "FROM todos WHERE thread_id = $1 ORDER BY order_index, created_at",
        UUID(ctx.thread_id),
    )
    todos_payload = [dict(r) for r in rows]
    await ctx.emit(ctx.redis, ctx.run_id, 'todo_updated', todos=todos_payload)
    return ToolResult(result=json.dumps({"accepted": result["accepted"], "version": result["version"]}))
```

#### C.4 Ordering / idempotency

Two near-simultaneous write_todos calls from the same agent → last-writer-wins per D-085-18 (full-state-replace). The transaction in C.2 serializes them via Postgres' MVCC — both transactions can't commit "interleaved" DELETEs. Frontend uses the returned `version` to detect stale acks (if it tracks its last sent version).

### D. REST endpoints

#### D.1 File placement (G-5 hot-file ledger says minimize threads.py)

Create **`backend/app/api/panel.py`** for the 3 GET endpoints (thread-scoped panel data):
- `GET /threads/{tid}/todos`
- `GET /threads/{tid}/ask_user/pending`
- `GET /threads/{tid}/tasks`

Add `POST /runs/{rid}/ask_user_response` to existing `backend/app/api/runs.py` (per-run action; matches its current home for `DELETE /runs/{rid}` and `GET /runs/{rid}/stream`).

#### D.2 POST /runs/{rid}/ask_user_response

```python
# In backend/app/api/runs.py
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
    # 1. Ownership check via runs RLS chain — 404 on cross-user attempt
    row_resp = await aexec(
        supabase.table("runs")
        .select("run_id, thread_id, status")
        .eq("run_id", str(run_id))
        .eq("user_id", current_user["id"])
        .maybe_single()
    )
    row = row_resp.data if row_resp is not None else None
    if not row:
        raise HTTPException(status_code=404, detail="Run not found")

    # 2. Persist the response row FIRST (durable; survives PUBLISH no-subscriber case)
    await aexec(
        supabase.table("messages").insert({
            "thread_id": row["thread_id"],
            "user_id": current_user["id"],
            "role": "system",
            "content": body.response_text,
            "tool_calls": [{
                "kind": "ask_user_response",
                "tool_call_id": body.tool_call_id,
                "response_text": body.response_text,
                "choice_index": body.choice_index,
            }],
        })
    )

    # 3. PUBLISH — wakes the paused SUBSCRIBE if it's alive
    channel = f"ask_user:{run_id}:{body.tool_call_id}"
    await redis.publish(channel, json.dumps({
        "kind": "response",
        "response_text": body.response_text,
        "choice_index": body.choice_index,
    }))

    return {"status": "ok"}
```

#### D.3 GET /threads/{tid}/todos

Simple supabase-py select with RLS. Pattern from Phase 084 file-list endpoints. Wrap in `run_in_threadpool` per D-v2.5-01.

#### D.4 GET /threads/{tid}/ask_user/pending

Query needs to find `kind='ask_user_prompt'` rows that don't have a matching `kind='ask_user_response'` companion within the same thread.

Since `tool_calls` is jsonb and there's no index on the `kind` field today, the cleanest query is via Postgres jsonb operators. **Performance note:** ~messages per thread for typical user ~100; jsonb scan is acceptable. If perf becomes an issue (SEED-able), add a partial index `CREATE INDEX idx_messages_kind_ask_user ON messages USING GIN ((tool_calls)) WHERE role='system'`.

```sql
-- Conceptual SQL (RLS via thread_id chain):
SELECT m.id, m.tool_calls, m.created_at
FROM messages m
WHERE m.thread_id = $1
  AND m.role = 'system'
  AND m.tool_calls @> '[{"kind": "ask_user_prompt"}]'::jsonb
  AND NOT EXISTS (
    SELECT 1 FROM messages r
    WHERE r.thread_id = m.thread_id
      AND r.role = 'system'
      AND r.tool_calls @> '[{"kind": "ask_user_response"}]'::jsonb
      AND r.tool_calls->0->>'tool_call_id' = m.tool_calls->0->>'tool_call_id'
  )
ORDER BY m.created_at ASC;
```

This goes through asyncpg directly (not supabase-py) to use jsonb operators efficiently. RLS is enforced manually via the parent runs ownership check — caller hits `/threads/{tid}/...` with current_user; we verify `(thread_id, user_id)` in threads table before the asyncpg query.

#### D.5 GET /threads/{tid}/tasks

```sql
SELECT
  r.run_id AS sub_run_id,
  r.started_at,
  r.completed_at,
  r.status,
  -- description and summary live in messages.tool_calls for the parent's run
  -- ... but tracking them this way requires denormalization. Better:
  -- Store description + summary directly on a new runs column (deferred) or
  -- on a sub_agent_invocations table (also deferred).
  -- For v1 — return just the run-level fields; frontend joins via the parent's
  -- messages.tool_calls payload (which already carries the description via sub_agent_start).
FROM runs r
WHERE r.parent_run_id IN (
  SELECT run_id FROM runs WHERE thread_id = $1 AND user_id = $2
)
ORDER BY r.started_at DESC;
```

**Discretion resolution:** v1 returns minimal `[{sub_run_id, status, started_at, completed_at}]`. Frontend Phase 087 joins with `sub_agent_start` SSE events (already carry description/tools/max_steps) to render the drill-down list. Adding a `sub_agent_invocations` denormalization table is deferred — premature optimization for v1.

### E. Provider-specific tool-schema authoring

Look at the existing WORKSPACE_WRITE_TOOL shape (`openai_service.py:495-523`) as the template. All 9 providers (verified at `_SUB_AGENT_MODEL_DEFAULTS` keys) consume the OpenAI-style schema; Anthropic and Google services translate internally.

**Lead with "Use when..." + "Do not use for..." pattern (per D-085-25 specifics line 193):**

```python
# Phase 085 — three new tools follow workspace_* style

WRITE_TODOS_TOOL = {
    "type": "function",
    "function": {
        "name": "write_todos",
        "description": (
            "Replace the thread's todo list with a new list. "
            "Use when: you need to break a complex multi-step task into trackable items the user can see, "
            "or when updating the status of in-flight work. "
            "Do not use for: short single-step answers, scratch notes, or per-message reminders. "
            "Semantics: full-state-replace — every call OVERWRITES the entire todo list. "
            "Include all current todos (both new and existing) in every call, not just the changes. "
            "Status values: pending | in_progress | completed."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "todos": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "id": {"type": "string", "description": "Stable client-supplied identifier (e.g. 't1', 't2'). Reuse the same id when updating status of an existing todo."},
                            "content": {"type": "string", "description": "What needs to be done. One sentence."},
                            "status": {"type": "string", "enum": ["pending", "in_progress", "completed"]},
                            "parent_id": {"type": ["string", "null"], "description": "Optional id of a parent todo for nesting. Omit or null for top-level items."},
                            "order_index": {"type": "integer", "description": "Display order within the list. 0-indexed."},
                        },
                        "required": ["id", "content", "status", "parent_id", "order_index"],
                    },
                },
            },
            "required": ["todos"],
        },
    },
}

TASK_TOOL = {
    "type": "function",
    "function": {
        "name": "task",
        "description": (
            "Spawn a focused sub-agent to perform a delegated piece of work and return a summary. "
            "Use when: the work has a clear bounded objective that benefits from its own short context "
            "(e.g. 'find all mentions of X across these documents and summarize') and would otherwise pollute "
            "the main conversation. "
            "Do not use for: simple lookups (use search_documents directly), or for tasks that need "
            "to ask the user a question (sub-agents cannot call ask_user). "
            "Sub-agents cannot call task(), ask_user(), or write_todos(). "
            "Max sub-agent steps clamped server-side; long-running work should still be broken into multiple task() calls."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "description": {"type": "string", "description": "Required. What the sub-agent should accomplish, in one or two sentences."},
                "instructions": {"type": ["string", "null"], "description": "Optional task-specific guidance APPENDED to the server's base sub-agent prompt."},
                "tools": {
                    "type": ["array", "null"],
                    "items": {"type": "string"},
                    "description": "Optional. Restrict the sub-agent's toolset to these tool names (must be a subset of your own tools). Omit/null = use a safe read-only default set.",
                },
                "max_steps": {"type": ["integer", "null"], "description": "Optional. Maximum sub-agent iterations. Server clamps to a hard maximum."},
            },
            "required": ["description", "instructions", "tools", "max_steps"],
        },
    },
}

ASK_USER_TOOL = {
    "type": "function",
    "function": {
        "name": "ask_user",
        "description": (
            "Pause and ask the user a question. The agent waits for the user's response (up to a timeout) "
            "before continuing. "
            "Use when: you have a true blocker that requires a decision only the user can make "
            "(e.g. 'which of these 3 files should I overwrite?'), or when proceeding without confirmation "
            "would risk destructive action. "
            "Do not use for: clarification questions you can answer yourself, or as a substitute for "
            "writing final assistant content (just respond normally instead). "
            "Always pass a clear, specific prompt — never ask 'are you sure?' without context."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "prompt": {"type": "string", "description": "Required. The question to show the user. Be specific."},
                "options": {
                    "type": ["array", "null"],
                    "items": {"type": "string"},
                    "description": "Optional. Multiple-choice options. If provided, panel renders as buttons; user can still type free-text.",
                },
                "timeout_seconds": {"type": ["integer", "null"], "description": "Optional. Maximum seconds to wait. Server clamps."},
            },
            "required": ["prompt", "options", "timeout_seconds"],
        },
    },
}
```

**Google Gemini quirk:** Google rejects `"type": ["integer", "null"]` union syntax — Plan 084-05 added `_normalize_optional_int` in `tool_dispatcher.py:848-862` to handle the workaround for weak OpenRouter models that stringify the value. For Google's native path, the existing Google service sanitizer in `google_service.py` (per Plan 084-05 gap closure) handles this — verify it covers the new tools. Worst case the 3 new tool schemas need to be sent to Google with `"type": "integer"` only (no null) and the `null` case handled via `required: []` instead of `["..."]`. Plan 04 should verify this against the existing sanitizer.

**Update get_tools() at openai_service.py:651:**

```python
tools = [..., WORKSPACE_DIFF_TOOL,
         # Phase 085: new tools
         WRITE_TODOS_TOOL, TASK_TOOL, ASK_USER_TOOL]
```

### F. SSE event payload shapes

Wire format is uniform across providers per `feedback_provider_uniform_ux`. All ride existing `run:{run_id}` Stream via `_emit`.

```jsonc
// 1. todo_updated — emitted after each write_todos call
{
  "type": "todo_updated",
  "todos": [
    {
      "id": "t1",              // string (client-supplied)
      "content": "Read the spec",
      "status": "completed",   // pending | in_progress | completed
      "parent_id": null,       // string | null
      "order_index": 0
    },
    {...}
  ]
}

// 2. ask_user_prompt — emitted BEFORE the SUBSCRIBE blocks (handler waits inline)
{
  "type": "ask_user_prompt",
  "tool_call_id": "call_abc123",
  "prompt": "Which file should I overwrite?",
  "options": ["a.txt", "b.txt"],    // array | null
  "timeout_seconds": 300
}

// 3. ask_user_response — emitted by the POST endpoint (not the tool handler)
{
  "type": "ask_user_response",
  "tool_call_id": "call_abc123",
  "response_text": "a.txt",
  "choice_index": 0                  // int | null
}

// 4. sub_agent_start — emitted by parent's tool handler when task() spawns
{
  "type": "sub_agent_start",
  "sub_run_id": "uuid",
  "description": "Find all mentions of X in /docs",
  "tools": ["search_documents", "read_document"],
  "max_steps": 5
}

// 5. sub_agent_done — emitted by parent's tool handler when task() returns
{
  "type": "sub_agent_done",
  "sub_run_id": "uuid",
  "status": "completed",            // completed | error
  "summary": "Found 3 mentions: ..."
}
```

**Note on existing `sub_agent_*` events:** The current `analyze_document` tool already emits `sub_agent_start`, `sub_agent_delta`, `sub_agent_done` (verified `tool_dispatcher.py:222-263`). The Phase 085 `task` tool emits the SAME event NAMES with DIFFERENT payload shapes (sub_run_id added, no delta). Frontend Phase 086 must demux by payload shape (`sub_run_id` present → task drill-down; `filename` present → analyze_document overlay). **Plan 04 must document this in VALIDATION.md.**

**Discretion resolution for write_todos payload shape:** Always-array. Diff payloads would force Phase 086 to maintain reducer state; the array is simple and matches the full-state-replace semantics. ~1 KB per emit for a typical 20-item list is fine on the Stream.

## Risks

| # | Risk | Location | Failure Signal | Mitigation (plan task) |
|---|------|----------|----------------|------------------------|
| R1 | PUBLISH-before-SUBSCRIBE race loses user response | `ask_user_service.subscribe_for_response` | Agent hangs until timeout despite user clicking Submit | Plan 03: SUBSCRIBE → persist row → emit SSE → block on get_message (in that order) |
| R2 | Redis SUBSCRIBE client leaks on cancel | `_handle_ask_user` finally / pubsub.aclose | `redis-cli client list \| grep subscribe` shows N orphans after Stop button | Plan 03: try/finally around `pubsub.aclose()` + SREM channels-set on exit |
| R3 | Sub-agent inherits wrong provider/model (D-075.5-04 footgun) | `task_service.resolve_sub_agent_model` | Sub-agent 400-errors with cross-provider model name on UAT | Plan 02: replicate `sub_agent_service.py:62-89` validation pattern verbatim |
| R4 | Global semaphore leaks slot on worker crash | `tasks:global:active` counter | After repeated crashes, `task()` rejects calls with "limit reached" when no tasks active | Plan 02: EXPIRE 7200 on the key (auto-cleanup); document operator reset |
| R5 | 24-tool box drops tool-selection accuracy on Google/DeepSeek | `openai_service.get_tools()` | UAT row "ask Google to write a todo" → it calls search_documents or hallucinates a name | SEED-035 planted; Plan 04 measures via LangSmith trace count in UAT |
| R6 | Concurrent write_todos races overwrite each other | `todos_service.replace_todos` | After two parallel calls, todo list is the result of whichever transaction committed second only | Documented as last-writer-wins per D-085-18; transaction in Plan 01 makes it atomic per call |
| R7 | Uvicorn shutdown loses paused ask_user → run stuck `streaming` | `main.py` lifespan shutdown | After restart, `runs.status='streaming'` for paused-then-killed runs | Plan 03: broadcast shutdown sentinel BEFORE RUN_TASKS cancel loop |
| R8 | jsonb scan on GET /ask_user/pending too slow | `panel.py:get_pending_ask_user` | Endpoint p95 > 500ms with 1000+ messages in thread | Verify perf on a thread with 500 messages in UAT; add partial GIN index if regresses |
| R9 | Sub-agent's stream consumers compete with parent for the SAME `run:{rid}` key | `task_service` SSE emit targeting | Phase 086 demux loses sub-agent events into parent's chat stream | Plan 02: ALL sub-agent-internal events emit on `run:{sub_run_id}` (NOT parent's run_id); only start/done emit on parent's run_id |
| R10 | Frontend can't distinguish task() sub_agent_done from analyze_document sub_agent_done | wire format conflict (Area F note) | Phase 086 demux misroutes events | Plan 04 VALIDATION.md flags this; demux by payload shape (`sub_run_id` present → task, `filename` present → analyze_document) |

## Validation Architecture

> This phase is multi-faceted (3 tools + 4 endpoints + 5 SSE event types + SC#10 mandate). Validation has THREE layers: (1) unit tests for service-level logic (todos transaction, semaphore acquire/release, channel naming), (2) integration tests for the dispatcher + Redis pub/sub + REST endpoints, (3) human/Chrome MCP UAT covering the 4-axis matrix.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest (backend) + Chrome DevTools MCP for UAT |
| Config file | `backend/pyproject.toml` (existing) |
| Quick run command | `cd backend && pytest tests/unit/test_085_*.py -x` |
| Full suite command | `cd backend && pytest -x` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TOOL-01 | write_todos full-state-replace + SSE emit | unit + integration | `pytest tests/unit/test_085_todos_service.py -x` + `pytest tests/integration/test_085_write_todos_handler.py -x` | ❌ Wave 0 |
| TOOL-01 | GET /threads/{tid}/todos returns canonical list after write | integration | `pytest tests/integration/test_085_panel_endpoints.py::test_get_todos -x` | ❌ Wave 0 |
| TOOL-02 | task() refuses tools not in parent's available_tools | unit | `pytest tests/unit/test_085_task_service.py::test_toolset_subset_enforced -x` | ❌ Wave 0 |
| TOOL-02 | task() inside sub-agent context returns nesting-cap error | unit | `pytest tests/unit/test_085_task_service.py::test_nesting_cap -x` | ❌ Wave 0 |
| TOOL-02 | per-run semaphore blocks 4th concurrent task() when cap=3 | integration | `pytest tests/integration/test_085_concurrency.py::test_per_run_cap -x` | ❌ Wave 0 |
| TOOL-02 | global Redis counter blocks 21st task() when cap=20 | integration | `pytest tests/integration/test_085_concurrency.py::test_global_cap -x` | ❌ Wave 0 |
| TOOL-02 | sub_agent_start/done emitted on PARENT stream, sub-agent tool calls on sub stream | integration | `pytest tests/integration/test_085_sub_agent_emit.py -x` | ❌ Wave 0 |
| TOOL-03 | ask_user blocks until PUBLISH lands | integration (requires Redis) | `pytest tests/integration/test_085_ask_user_handler.py::test_publish_resumes -x` | ❌ Wave 0 |
| TOOL-03 | ask_user persists messages row with kind='ask_user_prompt' BEFORE blocking | integration | `pytest tests/integration/test_085_ask_user_handler.py::test_prompt_persisted_before_subscribe -x` | ❌ Wave 0 |
| TOOL-03 | POST /ask_user_response wakes paused handler | integration | `pytest tests/integration/test_085_ask_user_endpoint.py -x` | ❌ Wave 0 |
| TOOL-03 | timeout returns "ask_user timed out" ToolResult | unit | `pytest tests/unit/test_085_ask_user_timeout.py -x` | ❌ Wave 0 |
| TOOL-03 | cancel sentinel wakes paused handler with "cancelled by user stop" | integration | `pytest tests/integration/test_085_ask_user_cancel.py -x` | ❌ Wave 0 |
| TOOL-04 | Cross-worker: PUBLISH from Worker B reaches SUBSCRIBE on Worker A | manual UAT (WORKER_COUNT=2 dev server) | Chrome MCP scenario | ❌ Wave 0 + UAT |
| TOOL-04 | Uvicorn shutdown broadcasts sentinel; paused runs end as `error` not `streaming` | integration | `pytest tests/integration/test_085_lifespan_shutdown.py -x` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `pytest tests/unit/test_085_*.py -x` (~5s)
- **Per wave merge:** `pytest tests/ -x -k "085 or tool_dispatcher or ask_user or todos or task_service"` (~30s)
- **Phase gate:** Full suite + Chrome MCP 4-axis UAT matrix below.

### Wave 0 Gaps
All test files for Phase 085 are new. Wave 0 tasks (test scaffolding) for each plan:

- [ ] Plan 01 Wave 0: `tests/unit/test_085_todos_service.py` — fixtures for `pool`, `thread_id`
- [ ] Plan 02 Wave 0: `tests/unit/test_085_task_service.py`, `tests/integration/test_085_concurrency.py` — Redis fixture, mock LLM client
- [ ] Plan 03 Wave 0: `tests/integration/test_085_ask_user_*.py` — Redis fixture, pubsub helpers
- [ ] Plan 04 Wave 0: `tests/integration/test_085_panel_endpoints.py` — auth fixture, supabase RLS fixture
- [ ] Framework already exists — no installation needed.

### SC#10 4-Axis UAT Matrix (MANDATORY per CONTEXT D-085-27)

Lives in VALIDATION.md (created from this section). Each row exercises 1+ failure criteria from CONTEXT.md.

| Row | Tool | Provider | Multi-tool | Parallel-thread | Long-msg | Failure criteria covered | Pass criterion |
|-----|------|----------|------------|-----------------|----------|-------------------------|----------------|
| 1 | ask_user | OpenAI (gpt-5.4-mini) | — | — | — | FC#1, FC#2, FC#3 | Agent pauses; user submits; agent resumes; transcript has both prompt + response rows |
| 2 | ask_user | Anthropic (claude-haiku-4-5) | — | — | — | FC#1, FC#5 | Same as Row 1; verify Anthropic tool_use schema doesn't drop the prompt arg |
| 3 | ask_user | Google (gemini-2.5-flash) | — | — | — | FC#1, FC#8 | Same as Row 1; verify Google union types not breaking the schema |
| 4 | ask_user | OpenRouter (deepseek-r1) | — | — | — | FC#8 | Same as Row 1 (best-effort; OpenRouter experimental) |
| 5 | ask_user | OpenAI | — | YES — Thread A paused; Thread B starts new prompt | — | FC#1, FC#3 | Both threads operate; Thread A still gets response when user replies |
| 6 | ask_user + Stop | OpenAI | — | — | — | FC#2 | While paused, hit Stop; verify `redis-cli client list \| grep subscribe` shows ZERO orphans after 5s |
| 7 | ask_user + reload | Anthropic | — | — | — | FC#3 | While paused, refresh browser; panel re-renders prompt from GET /pending; submit → 200 (response recorded; run shows `error` status) |
| 8 | task | OpenAI | YES — task spawns sub-agent that calls search_documents + read_document | — | — | FC#4, FC#5 | sub_agent_start/done emitted; final summary returned; max_steps respected |
| 9 | task | Anthropic | YES — sub-agent calls workspace_read + analyze_document | — | — | FC#5 | Anthropic-routed sub-agent doesn't 400 from cross-provider model name |
| 10 | task (4 parallel) | OpenAI | — | — | — | FC#6 | 4th call returns "concurrency limit reached" (per-run cap = 3) |
| 11 | task (nested) | OpenAI | YES — task spawns sub-agent that tries to call task() | — | — | FC#4 | Sub-agent's task() returns "1-level nesting cap" ToolResult |
| 12 | write_todos | OpenAI | YES — write_todos + ask_user in same turn | — | — | FC#7, FC#10 | Both events fire; GET /todos returns canonical list; GET /pending returns unanswered prompt |
| 13 | write_todos | Google (gemini-2.5-flash) | — | — | — | FC#8 | Google's strict JSON-schema validator accepts the array-of-objects shape |
| 14 | write_todos status revert check | Anthropic | — | — | — | FC#7 | Call write_todos with status='completed', then again with status='pending' — final state matches second call |
| 15 | write_todos | OpenAI | — | — | YES — 50+ prior messages | FC#7 | LLM still calls write_todos correctly with long context; SSE emits |
| 16 | All 3 tools | OpenAI | YES — write_todos, then ask_user, then task | — | YES — 5KB user prompt | FC#7, FC#8 | All three SSE event types arrive in order; no provider regression |
| 17 | analyze_document + task | OpenAI | YES (existing analyze_document MUST coexist with new task) | — | — | FC#9 | Both `sub_agent_*` event streams demuxed correctly by payload shape |
| 18 | OpenRouter free model | OpenRouter (free tier model) | YES — all 3 new tools | — | — | FC#5, FC#8 | Best-effort verification; weak models may stringify args (Phase 084 Plan 05 normalizer covers) |

**4-axis coverage check:**
- Cross-provider: Rows 1,2,3,4 (OpenAI, Anthropic, Google, OpenRouter — all 3 tools each)
- Multi-tool: Rows 8, 9, 12, 16, 17 (2+ tools in one prompt)
- Parallel-thread: Row 5 (Thread A paused, Thread B running)
- Long-message: Rows 15, 16 (≥50 prior messages OR ≥5KB prompt)

**Operator manual notes:** Rows 6, 7, 18 require browser interaction (Stop button, refresh). Chrome MCP can drive 1-5, 8-17 automated. Row 6 needs `redis-cli` command on the dev server.

## Plan Structure Recommendation

**4 plans across 2 waves.**

### Wave 1 (parallel — different files)

**Plan 01: write_todos + migration + parent_run_id column**
- Files: NEW `supabase/migrations/055_todos_table.sql`, NEW `backend/app/services/todos_service.py`, MODIFIED `backend/app/services/tool_dispatcher.py` (+`_handle_write_todos` + registry entry)
- Migration includes runs.parent_run_id column (needed by Plan 02)
- Test files: NEW `tests/unit/test_085_todos_service.py`
- ~250 LOC
- Requirements: TOOL-01
- Failure criteria covered: FC#7, FC#10

**Plan 02: task service + concurrency caps**
- Files: NEW `backend/app/services/task_service.py`, MODIFIED `backend/app/services/tool_dispatcher.py` (+`_handle_task` + registry entry), MODIFIED `backend/app/api/threads.py` (extend `ToolContext` with `parent_run_id`, `per_run_task_semaphore`, `available_tools` fields; initialize per_run_task_semaphore once per agent_runner before iteration loop)
- Test files: NEW `tests/unit/test_085_task_service.py`, NEW `tests/integration/test_085_concurrency.py`
- ~450 LOC
- Requirements: TOOL-02
- Failure criteria covered: FC#4, FC#5, FC#6, FC#9
- Depends on: Plan 01's migration (uses `runs.parent_run_id`)

### Wave 2 (depends on Wave 1)

**Plan 03: ask_user pub/sub + shutdown sentinel**
- Files: NEW `backend/app/services/ask_user_service.py`, MODIFIED `backend/app/services/tool_dispatcher.py` (+`_handle_ask_user` + registry entry), MODIFIED `backend/app/api/runs.py` (+POST /ask_user_response), MODIFIED `backend/app/api/runs.py:cancel_run` (publish cancel sentinel BEFORE task.cancel), MODIFIED `backend/app/main.py` (lifespan shutdown broadcast)
- Test files: NEW `tests/integration/test_085_ask_user_handler.py`, `tests/integration/test_085_ask_user_endpoint.py`, `tests/integration/test_085_ask_user_cancel.py`, `tests/integration/test_085_lifespan_shutdown.py`
- ~400 LOC
- Requirements: TOOL-03, TOOL-04
- Failure criteria covered: FC#1, FC#2, FC#3
- Depends on: Plan 01 + 02 (stable ToolContext shape)

**Plan 04: REST endpoints + tool schemas + UAT**
- Files: NEW `backend/app/api/panel.py` (3 GET endpoints), MODIFIED `backend/app/main.py` (register panel router), MODIFIED `backend/app/services/openai_service.py` (3 new tool schemas + add to get_tools), NEW `.planning/phases/085-new-llm-tools/085-VALIDATION.md` (4-axis UAT matrix from this research)
- Test files: NEW `tests/integration/test_085_panel_endpoints.py`
- ~300 LOC + UAT scenarios
- Requirements: All four — closes loop with consumed-by Phase 086/087
- Failure criteria covered: FC#5 (cross-provider), FC#8 (tool selection accuracy), FC#9 (no regressions), FC#10 (persistence)
- Depends on: Plan 01 + 02 + 03 (all behavior must be landed before UAT)

### Plan ordering rationale

- Plan 01 first because the migration is the foundation for Plan 02 (parent_run_id) and the todos table is a trivial vertical slice that proves the dispatcher-+-SSE pattern works in this phase context.
- Plan 02 parallels Plan 01 (different files); the only shared file is `tool_dispatcher.py` — minor conflict, resolved by both plans adding a new handler + registry entry without touching shared helpers.
- Plan 03 must follow Plan 02 because it extends the `ToolContext` dataclass that Plan 02 also extends; serializing avoids merge churn.
- Plan 04 must follow all because it ships tool schemas and UAT — both depend on the 3 handlers being callable.

## Files to Create / Modify

| File | Role | Plan | Est. LOC |
|------|------|------|---------|
| `supabase/migrations/055_todos_table.sql` | NEW | Plan 01 | 60 |
| `backend/app/services/todos_service.py` | NEW | Plan 01 | 80 |
| `backend/app/services/task_service.py` | NEW | Plan 02 | 250 |
| `backend/app/services/ask_user_service.py` | NEW | Plan 03 | 120 |
| `backend/app/api/panel.py` | NEW | Plan 04 | 150 |
| `backend/app/services/tool_dispatcher.py` | MODIFIED — add `_handle_write_todos`, `_handle_task`, `_handle_ask_user` + 3 registry entries | Plans 01/02/03 | +120 |
| `backend/app/api/threads.py` | MODIFIED — extend `ToolContext` with `parent_run_id`, `per_run_task_semaphore`, `available_tools`; initialize semaphore in agent_runner | Plan 02 | +30 |
| `backend/app/api/runs.py` | MODIFIED — POST /ask_user_response endpoint; cancel_run sentinel publish | Plan 03 | +80 |
| `backend/app/main.py` | MODIFIED — register panel router; lifespan shutdown sentinel broadcast | Plan 03 + Plan 04 | +20 |
| `backend/app/services/openai_service.py` | MODIFIED — add `WRITE_TODOS_TOOL`, `TASK_TOOL`, `ASK_USER_TOOL` + add to `get_tools()` | Plan 04 | +90 |
| `backend/app/config.py` | MODIFIED — add `ask_user_max_timeout_seconds`, `task_max_steps`, `task_per_run_concurrency`, `task_global_concurrency` settings | Plan 02 + Plan 03 | +15 |
| `supabase/full-schema.sql` | REGENERATED via `bash scripts/regenerate-full-schema.sh` | Plan 01 | (auto) |
| `tests/unit/test_085_todos_service.py` | NEW | Plan 01 | 80 |
| `tests/unit/test_085_task_service.py` | NEW | Plan 02 | 120 |
| `tests/integration/test_085_concurrency.py` | NEW | Plan 02 | 100 |
| `tests/integration/test_085_ask_user_*.py` (4 files) | NEW | Plan 03 | 200 |
| `tests/integration/test_085_panel_endpoints.py` | NEW | Plan 04 | 120 |
| `.planning/phases/085-new-llm-tools/085-VALIDATION.md` | NEW — 4-axis UAT matrix (created from `## Validation Architecture` section above) | Plan 04 | 200 |

**Files NOT touched (verify in plan-checker):**
- `backend/app/services/sub_agent_service.py` — frozen per D-085-16
- `backend/app/services/workspace_service.py` — Phase 084 surface, no overlap
- `backend/app/services/openai_service.py:create_streaming_chat` (the call path) — read-only consumer; only `get_tools()` and tool-schema constants modified
- `backend/app/api/threads.py:agent_runner` control flow — only adds new ToolContext fields + semaphore init; no changes to LLM call / tool dispatch loop semantics (G-5 minimization)

## Project Constraints (from CLAUDE.md)

- **No LangChain / LangGraph** — Phase 085 uses raw SDK calls in `task_service.py` via `openai_service.create_streaming_chat`.
- **Pydantic for structured LLM outputs** — N/A here; tool args are dispatcher-decoded JSON.
- **All tables need RLS** — `todos` table policies added in 055 migration; FK-chain pattern (Phase 084).
- **Stream chat responses via SSE** — N/A here (new SSE events ride existing Stream).
- **Stateless chat completions** — N/A here.
- **Ingestion is manual file upload only** — N/A.
- **Migrations: numbered, no letter suffixes, applied via SQL editor** — Use 055; no letter suffix; apply via SQL editor; then run regen script.
- **Realtime is best-effort hint** — Phase 086/087 panel reconciles via fetch on (re)connect (D-v2.5-03); Phase 085 ships those GET endpoints.
- **Blocking I/O wrapped via `run_in_threadpool`** — Applies to all supabase-py calls in panel.py; `redis.asyncio` SUBSCRIBE is async-native (no threadpool); asyncpg is async-native.
- **WORKER_COUNT=2 default** — `ask_user` cross-worker design is the central artifact of this phase.
- **SC#10 4-axis UAT MANDATORY** — Phase 085 touches streaming + agent loop + provider routing → matrix above is required, NOT optional.
- **G-5 hot-file ledger: `backend/app/api/threads.py` at 9+ phases** — Phase 085 minimizes by ONLY extending ToolContext dataclass + semaphore init; no agent_runner control-flow changes. New logic goes in `task_service.py`, `todos_service.py`, `ask_user_service.py`, `panel.py`.
- **`backend/app/services/anthropic_service.py` at 4+ phases** — Phase 085 does NOT touch this file (the new tools route through `openai_service.create_streaming_chat`, which dispatches to Anthropic via the existing adapter).

## Runtime State Inventory

Not applicable — Phase 085 is greenfield additions, not a rename / refactor / migration. No legacy data needs reconciliation. The 055 migration adds new objects only (no ALTERs that affect existing rows beyond the runs.parent_run_id column add, which defaults NULL for all existing rows).

## Common Pitfalls

### Pitfall 1: redis-py async pubsub spin-loops at 100% CPU
**What goes wrong:** Default `pubsub.get_message()` timeout=0 returns immediately if no message; tight loops burn CPU.
**Why it happens:** redis-py async pubsub timeout default is 0, not None.
**How to avoid:** Always pass `timeout=1.0` (or another non-zero value) and wrap the loop in `asyncio.wait_for(...)` for the deadline.
**Warning signs:** Backend CPU at 100% on idle ask_user waits.

### Pitfall 2: SUBSCRIBE registration is async — PUBLISH can race ahead
**What goes wrong:** User responds before SUBSCRIBE is registered; PUBLISH message lost.
**Why it happens:** Redis pub/sub doesn't queue; messages without subscribers are dropped.
**How to avoid:** SUBSCRIBE → persist row → emit SSE → block (in that order). User has no signal to respond until after step 3.
**Warning signs:** Agent hangs until timeout despite user submitting; logs show `pubsub.subscribe` finished AFTER the response POST.

### Pitfall 3: pubsub.aclose() on a still-subscribed channel may hang
**What goes wrong:** Worker shutdown with active SUBSCRIBE.
**Why it happens:** redis-py async PubSub keeps a connection alive until explicit `aclose()`.
**How to avoid:** Always wrap in `try/finally` with `await pubsub.unsubscribe(channel)` BEFORE `pubsub.aclose()`; use `asyncio.wait_for(pubsub.aclose(), timeout=2.0)` for shutdown.
**Warning signs:** Shutdown hangs > 2s; `redis-cli client list` shows orphaned subscribe clients.

### Pitfall 4: asyncio.Semaphore acquire from inside dispatch is non-cancellable
**What goes wrong:** Sub-agent semaphore acquire waits forever if parent run is cancelled.
**Why it happens:** `await sem.acquire()` doesn't respect external cancellation gracefully in some redis-py versions.
**How to avoid:** Use `asyncio.wait_for(sem.acquire(), timeout=0)` for non-blocking try-acquire; fail fast with "concurrency limit reached" rather than blocking.
**Warning signs:** Test timeouts when parent run is cancelled mid-task spawn.

### Pitfall 5: Sub-agent's runs row persists with `status='streaming'` if task crashes
**What goes wrong:** Crash in sub-agent loop → no `finalize_run` call → `runs.status` stays `streaming` forever.
**Why it happens:** Try/finally needed but easy to miss.
**How to avoid:** Mirror `_shielded_finalize` discipline — wrap sub-agent loop in try/except/finally with finalize_run in finally.
**Warning signs:** GET /threads/{tid}/tasks shows sub-agents with status=streaming hours after parent finished.

### Pitfall 6: write_todos atomicity inside async handler
**What goes wrong:** Two concurrent write_todos calls interleave DELETE+INSERT.
**Why it happens:** Without an explicit transaction, asyncpg auto-commits each statement.
**How to avoid:** Use `async with conn.transaction():` block in `replace_todos`.
**Warning signs:** UAT row 14 fails — status reverts not consistently honored.

### Pitfall 7: Sub-agent inherits parent's `previous_files_in_run` dict
**What goes wrong:** Sub-agent's `execute_code` (if granted that tool by parent's allowlist) would corrupt parent's output-file dedup state.
**Why it happens:** If we copy ToolContext too shallowly, mutable fields leak.
**How to avoid:** Sub-agent's ToolContext sets `previous_files_in_run={}` (fresh empty dict). Verify in code review.
**Warning signs:** Parent's final_output_files include sub-agent's intermediate files.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cross-worker pub/sub | DIY socket signaling | `redis.asyncio.pubsub` | Already deployed; handles reconnect/cleanup; rock-solid pattern |
| Global concurrency counter | Process-local dict | Redis INCR/DECR + Lua atomic check | Atomic across workers; survives single-worker restarts via TTL |
| Sub-agent agent loop | Custom state machine | Direct call to `openai_service.create_streaming_chat` + `tool_dispatcher.dispatch_tool` | Reuses the canonical providers + tool registry; zero new code paths to UAT |
| Diff between todo versions | Custom diff engine | Just full-state-replace (D-085-18) | Server stays simple; client reconstructs history if needed |
| Auth on POST ask_user_response | Custom JWT validation | `get_current_user` Depends + runs RLS chain | Mirrors `/runs/{rid}/stream` pattern verbatim |

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| LangChain agents | Raw SDK + tool_dispatcher registry | Phase 083 (G-5 refactor) | All new tools register via single pattern; no orchestration framework |
| asyncio.Event for ask_user (proposed v2.7 research draft) | Redis pub/sub | v2.7 research consensus (CONTEXT.md "Decisions affecting current work" line in STATE.md) | asyncio.Event fails with WORKER_COUNT=2; pub/sub works |
| Sub-agent: shared system prompt + streaming only | Sub-agent: own runs row + own tool loop + own Stream | Phase 085 (D-085-14) | Sub-agents are first-class runs; observable via existing /runs/{sub_run_id}/stream |
| Todos: client-only state | Todos: server-side full-state-replace + SSE | Phase 085 (D-085-18) | Survives reload; multi-tab consistent |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | redis-py async pubsub spawns its own connection internally (doesn't share with main client) | A.1 | If shared, pubsub blocking could backpressure Stream XADD/XREAD; would need separate aioredis client. Verify in Plan 03 with a smoke test. |
| A2 | jsonb `@>` containment scan on `messages.tool_calls` with N≈500 rows/thread is fast enough (sub-100ms) | D.4 | If too slow, need GIN index. Verify in Plan 04 with a perf test on a seeded thread. |
| A3 | Google's tool-schema sanitizer (Phase 084 Plan 05) already handles `["string", "null"]` union types for the new tools | E (tool schemas) | If not, Plan 04 must extend the sanitizer to cover the 3 new tools. Verify with Row 13 of UAT matrix. |
| A4 | OpenRouter's free-tier models can stringify args (per Phase 084 Plan 05 `_normalize_optional_int`); the 3 new tools have similar nullable args | E | If new normalization needed, add to `_handle_write_todos` / `_handle_task` / `_handle_ask_user`. Verify with Row 18. |
| A5 | `asyncio.Semaphore` initialized once per top-level agent_runner call is sufficient for per-run cap (no leakage across runs sharing a worker) | B.3 | Semaphores are per-coroutine-scope; verify with concurrency test (Plan 02 Wave 0). |
| A6 | `time.time() * 1000` is monotonic enough for write_todos version sequencing | C.2 | If clock jumps backwards (NTP), two writes could have descending versions. Frontend treats version as opaque so this is benign. |
| A7 | Phase 086 demux can distinguish `task`'s `sub_agent_*` events from `analyze_document`'s by checking for `sub_run_id` field | F (and R10) | If demux misroutes, Phase 086 ships with a routing bug. Verify with UAT Row 17. |
| A8 | Existing `_emit` helper at `threads.py:109` is safe to call from inside `task_service.py` (cross-module import) | B.4 | Verify by importing in Plan 02 Wave 0; circular-import-safe per Phase 084's existing pattern (workspace_service imports nothing from threads.py). |

**The first 4 assumptions are first-class verification items in the relevant plans.**

## Sources

### Primary (HIGH confidence)
- `backend/app/services/tool_dispatcher.py` (Phase 083) — verified via Read tool; `ToolContext`/`ToolResult` dataclasses + `_TOOL_REGISTRY` + `dispatch_tool` entry point
- `backend/app/services/workspace_service.py` (Phase 084) — verified via Read tool; reference for service-layer pattern + SSE emit + `run_in_threadpool` wrapping
- `backend/app/services/sub_agent_service.py` — verified via Read tool; provides the model-routing fallback pattern (`62-89`) that task_service must replicate
- `backend/app/api/threads.py` — verified via Read tool (lines 1-300, 1300-1800, 2980-3140); `_emit`/`_emit_terminal` helpers, `RUN_TASKS` registry, `_shielded_finalize` 5-step ordering, ToolContext construction site
- `backend/app/api/runs.py` — verified via Read tool (lines 1-80, 440-560); FastAPI router pattern + `cancel_run` ownership check + Redis dependency injection
- `backend/app/db/runs.py` — verified via Read tool; asyncpg pool pattern + `insert_run`/`finalize_run` helpers
- `backend/app/dependencies.py` — verified via Read tool; `get_redis()` singleton (`socket_timeout=10`, `decode_responses=True`) + `get_pg_pool()` (jsonb codec via init callback)
- `backend/app/main.py:200-260` (lifespan shutdown) — verified via Read tool; RUN_TASKS cancel loop + Redis aclose + pg pool close ordering
- `supabase/migrations/054_workspace_files.sql` — verified via Read tool; RLS FK-chain template for the new 055 todos migration
- `supabase/migrations/048_messages_allow_system_role.sql` — verified via Read tool; `kind` discriminator pattern in `tool_calls` jsonb (Phase 075.4 system_warning precedent)
- `supabase/migrations/035_runs_table.sql` — verified via Read tool; runs table doesn't have a metadata jsonb column (recommends new parent_run_id TEXT column)
- `supabase/full-schema.sql:425-445` — verified via Read tool; messages table schema confirms `tool_calls jsonb` storage
- `backend/app/services/openai_service.py:450-665` — verified via Read tool; WORKSPACE_*_TOOL schema shape + `get_tools()` registration site
- `backend/app/config.py:546-556` — verified via Read tool; `_SUB_AGENT_MODEL_DEFAULTS` dict; 9 provider keys
- `.planning/phases/085-new-llm-tools/085-CONTEXT.md` — 28 locked decisions; ground truth

### Secondary (MEDIUM confidence)
- redis-py asyncio examples — official docs https://redis.readthedocs.io/en/stable/examples/asyncio_examples.html — pub/sub PUBLISH-before-SUBSCRIBE race confirmed
- `.planning/REQUIREMENTS.md` — TOOL-01..TOOL-04 specifications
- `.planning/ROADMAP.md` Phase 085 section — research flag note explicitly calls out `ask_user` Redis pub/sub edge cases

### Tertiary (LOW confidence — flagged in Assumptions Log)
- Performance characteristics of jsonb `@>` scans on `messages.tool_calls` (Assumption A2) — needs Plan 04 perf test
- Google sanitizer coverage for new tools (Assumption A3) — needs Plan 04 UAT Row 13

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every library + pattern verified against the Phase 083/084 reference code in the working tree
- Architecture: HIGH for write_todos + task; MEDIUM for ask_user pub/sub race window (race semantics derived from redis-py docs + reasoning; not yet empirically validated in this codebase — first phase to use pub/sub)
- Pitfalls: HIGH — pitfalls 1-3 come directly from redis-py docs + GitHub issues; pitfalls 4-7 from cross-referencing the existing sub_agent_service.py and threads.py finalize discipline
- Plan structure: HIGH — explicit file-list and LOC estimates verified against existing patterns

**Research date:** 2026-05-28
**Valid until:** 2026-06-15 (sub-2-week shelf life; provider tool-schema details and redis-py async pubsub semantics are stable but the 24-tool selection accuracy data needs UAT confirmation)

## RESEARCH COMPLETE
