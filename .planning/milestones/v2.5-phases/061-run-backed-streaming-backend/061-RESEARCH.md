# Phase 061: Run-Backed Streaming (Backend) - Research

**Researched:** 2026-05-02
**Domain:** Async Python (FastAPI 0.115 + sse-starlette 2.4) + Redis Streams (`redis>=5` asyncio) + Postgres lifecycle table (Supabase, RLS)
**Confidence:** HIGH

## Summary

Phase 061 swaps the in-memory `asyncio.Queue` introduced by Phase 059 for a per-run Redis Stream backing (`run:{run_id}`), so the agent producer task can outlive any single SSE consumer. The contract inverts 059's "consumer-disconnect ⇒ producer-cancel" invariant — producers now run to completion (or to the new 120s `asyncio.timeout` ceiling) regardless of whether anyone is listening. A new durable `public.runs` Postgres table records lifecycle metadata that survives Redis TTL expiry, providing audit/debug/billing ground truth.

Seventeen decisions are already locked in `061-CONTEXT.md` (D-061-01..17). Research confirmed them against the live codebase and resolved every "Claude's Discretion" item with an evidence-backed recommendation. No conflicts surfaced. The hard line items the planner needs to bake into PLAN.md: (1) `redis>=5.2,<8` pin (current stable is 7.4, ships ConnectionPool fixes for the FastAPI loop-binding issue noted in redis/redis-py#3230), (2) `redis.asyncio.from_url` lazily inside `get_redis()` — no I/O at import time, (3) `XADD ... MAXLEN ~ 10000` with the implicit understanding that "~" can overshoot by "a few tens" (acceptable per CONTEXT.md), (4) terminal sentinel XADD must precede `EXPIRE` in the producer's `finally` (otherwise EXPIRE 60s on a `failed` run can race the consumer's BLOCK 5000), (5) `asyncio.timeout(120)` is a 3.11+ API and re-raises as `TimeoutError` *outside* the `async with` — we have Python 3.12.6, so no compat shim needed, (6) `gen_random_uuid()` is built into Postgres 13+ (Supabase's stack), no `pgcrypto` extension prerequisite required.

**Primary recommendation:** Implement exactly to D-061-01..17 with the asyncio-API specifics, Postgres-DDL forms, and edge-case ordering this document spells out. Two non-mechanical planner decisions are flagged in *Open Questions* for the implementer to resolve in PLAN.md.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-v2.5-09 specifics: cancel/timeout policy**
- **D-061-01** — Server-side hard timeout default = 120s. Implemented as `async with asyncio.timeout(settings.run_hard_timeout_seconds):` wrapping the producer body. Env-overridable via `RUN_HARD_TIMEOUT_SECONDS`. Setting added to `Settings` in `backend/app/config.py` alongside `anyio_thread_tokens` (matches the 058 pattern).
- **D-061-02** — No abandoned-run sweeper. The 120s hard timeout is the sole bound. No `last_consumer_seen_at` tracking, no periodic asyncio sweeper task, no per-run no-consumer TTL distinct from the wall-clock cap.
- **D-061-03** — Stop is intentionally a no-op backend-side in the 061-only window. Frontend `AbortController.abort()` closes the consumer; the consumer's `finally` does NOT cancel the producer. Producer continues until natural completion or 120s timeout. The DELETE /runs/{id} cancel verb that actually stops the producer ships in 062, in the same merge (D-v2.5-11).
- **D-061-04** — Hard-timeout persistence shape. When `asyncio.timeout` fires: producer writes a terminal sentinel stream entry `{type: "error", error: "hard_timeout", ...}`, updates `runs.status='failed' error='hard_timeout' completed_at=now()`, EXPIREs the key with 60s TTL (failed-bucket). Status enum stays at 4 values: `streaming` / `completed` / `failed` / `cancelled`.

**`public.runs` schema details (migration 035)**
- **D-061-05** — Primary key: `run_id uuid PRIMARY KEY DEFAULT gen_random_uuid()`. Server-side generation; INSERT returns the value.
- **D-061-06** — FK ON DELETE behavior: both CASCADE. `thread_id` references `threads(id) ON DELETE CASCADE`. `user_id` references `auth.users(id) ON DELETE CASCADE`.
- **D-061-07** — Index strategy. Two indexes: partial `idx_runs_active ON runs(user_id, thread_id, status) WHERE status = 'streaming'`; composite `idx_runs_history ON runs(user_id, thread_id, started_at DESC)`.
- **D-061-08** — RLS shape: SELECT-only. `CREATE POLICY runs_select_own ON runs FOR SELECT USING (auth.uid() = user_id)`. No INSERT/UPDATE/DELETE policies (so all writes require service-role).
- **D-061-09** — Other column shapes: `status` TEXT with `CHECK IN`; `error` TEXT NULL; `input_tokens`/`output_tokens` INTEGER NULL; `started_at` TIMESTAMPTZ NOT NULL DEFAULT now(); `completed_at` TIMESTAMPTZ NULL; `model`/`provider` TEXT NOT NULL; `message_id` UUID NULL.

**Producer architecture**
- **D-061-10** — Producer XADDs directly; no intermediate `asyncio.Queue`. Every `await queue.put(json.dumps({...}))` becomes `await redis.xadd(f'run:{run_id}', {'data': json.dumps({...})})`. Single-field `data` shape mirrors 059's queue payload format byte-for-byte.
- **D-061-11** — Producer task ownership: module-level `RUN_TASKS: dict[uuid.UUID, asyncio.Task]` registry. Lives in `backend/app/api/threads.py` (or extracted to `backend/app/api/_run_registry.py`). App lifespan close cancels all entries.
- **D-061-12** — Consumer termination: terminal sentinel + safety-net timeout. `TERMINAL_TYPES = {'done', 'error', 'cancelled'}`. Two-mode XREAD: replay `COUNT 100 STREAMS run:{id} 0` then live-tail `BLOCK 5000 STREAMS run:{id} $`. Defensive max-wait `RUN_HARD_TIMEOUT_SECONDS + 10`.
- **D-061-13** — Redis client lifecycle: singleton via `get_redis()` mirroring `get_supabase()`. Lazy-init from `settings.redis_url`, module-level cache. `lifespan()` close calls `await client.aclose()`. `aexec` (D-058-03) is unchanged.

**Redis test infrastructure**
- **D-061-14** — Real Redis via `docker-compose.dev.yml`; CI assumes Redis is up. No fakeredis. No testcontainers. Pytest fixture: session-scoped `redis.asyncio.Redis` connecting to `localhost:6379`. CI workflow adds `docker compose -f docker-compose.dev.yml up -d redis` before pytest. Conftest does FLUSHDB at session end.
- **D-061-15** — New 061 binding test: `tests/integration/test_061_producer_survives_disconnect.py::test_producer_continues_after_consumer_disconnect`.
- **D-061-16** — Invert `tests/integration/test_059_disconnect.py::test_agent_task_cancels_on_disconnect`. Document in commit message + `061-VERIFICATION.md` that this is an intentional contract change.
- **D-061-17** — Test isolation: UUID-based, no per-test prefix.

### Claude's Discretion

The following are explicitly delegated to Claude (and resolved in this RESEARCH.md):
- Whether to extract `RUN_TASKS` and `agent_runner` into `_run_registry.py` / `_agent_runner.py` (cleaner imports) or keep nested in `threads.py` (smaller diff).
- Exact `redis-py` version pin in `requirements.txt`.
- Whether the producer wraps each `redis.xadd(...)` in a small `_emit(run_id, type, **fields)` helper.
- Exact name of the test fixture providing the session-scoped Redis client.
- Whether the consumer's two-mode XREAD loop is structured as `if/else` on a `mode` variable or as two separate `async for` loops.
- Whether `RUN_HARD_TIMEOUT_SECONDS` lives next to `anyio_thread_tokens` or in a new `RunStreamingSettings` nested model.
- The XADD MAXLEN cap (10k? unbounded?). Recommend `MAXLEN ~ 10000`. Sentinel must NOT be trimmed — see *Common Pitfalls* below.
- Whether `runs_by_thread:{thread_id}` sorted-set add/remove happens in producer's finally or in a tiny synchronous helper.
- Whether `/health` Redis ping is cached for N seconds or PINGs every call.

### Deferred Ideas (OUT OF SCOPE)

- Abandoned-run sweeper task (no-consumer-for-N-min cancellation).
- Cleanup of `runs:active`/`runs_by_thread:{id}` sorted-set entries when their referenced `run:{id}` Stream key EXPIREs (passive cleanup at query time in 061).
- `testcontainers-python` per-session Redis as fallback test substrate.
- Migration to `asyncpg` / async Supabase client (CONCUR-03).
- Hidden `/__health/sse` endpoint reporting `RUN_TASKS` count + Redis stream backlog.
- Structured `event:` field routing on the SSE wire.
- KI-001 mid-LLM-call cancellation (still bounded by yield-point semantics).
- Cross-worker coordination if uvicorn ever scales to `--workers N>1`.
- Token-counter accounting source (LLM SDK return value vs `tiktoken` estimate).
- `message_id` backfill semantics on persist failure.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **STREAM-04** (foundation) | A streaming response survives client navigation, refresh, and multi-tab access. Generation lifetime decoupled from any single HTTP request. Implementation requires per-run ephemeral buffer (Redis Streams per D-v2.5-08) + per-run durable metadata (`public.runs` Postgres table per D-v2.5-11). Verified by (a) start streaming → refresh → continued; (b) close tab → reopen → live continuation; (c) two tabs synced. | This phase delivers the **backend foundation**: producer task writes to `run:{run_id}` Redis Stream, consumer reads with offset cursor; `runs` Postgres row is INSERTed at start and UPDATEd in finally. Phase 062 builds the replay-and-tail HTTP API on top; Phase 063 wires the frontend. SC#1–8 in ROADMAP map directly to D-061-01..17 in this RESEARCH.md's *User Constraints* section. |

</phase_requirements>

## Project Constraints (from CLAUDE.md)

| Constraint | Source | Impact on Phase 061 |
|-----------|--------|---------------------|
| Python backend uses venv | `Rules` | All `pip install` for `redis>=5` happens inside `backend/venv/`. |
| No LangChain/LangGraph; raw SDK only | `Rules` | Use `redis.asyncio` directly; no abstraction wrappers. |
| Pydantic for structured outputs | `Rules` | Not relevant — Redis Stream `data` field is plain JSON-encoded dict. |
| All tables need RLS | `Rules` | `public.runs` ENABLE ROW LEVEL SECURITY + SELECT policy `auth.uid() = user_id` (D-061-08). |
| Single uvicorn worker; `--workers N` masks concurrency bugs | `Rules` (D-v2.5-02) | `RUN_TASKS: dict[uuid.UUID, asyncio.Task]` is per-process; works correctly because there is exactly one process. Future scale to N>1 requires Redis Pub/Sub (out of scope). |
| No blocking I/O directly in async handlers — wrap with `run_in_threadpool` | `Rules` (D-v2.5-01) | `redis.asyncio` is natively async — no `aexec` wrap needed. Supabase calls (`runs` INSERT/UPDATE) still go through `aexec`. |
| Schema changes ship as numbered SQL migrations under `supabase/migrations/`; format `<digits>_name.sql` | `Rules` | Phase 061 lands `supabase/migrations/035_runs_table.sql`. Then run `bash scripts/regenerate-full-schema.sh` to rebuild `supabase/full-schema.sql`. |
| Supabase Realtime is best-effort hint, not source of truth | `Rules` (D-v2.5-03) | Not used by 061. Phase 062's `GET /threads/{id}/active-runs` reads from Postgres. |
| Local Redis runs via docker-compose.dev.yml (port 6379, no auth) | `Rules` | Test fixture connects to `localhost:6379` (D-061-14). `REDIS_URL` env var defaults to `redis://localhost:6379`. |
| Redis key conventions: `run:{run_id}` (Stream), `runs_by_thread:{thread_id}` (sorted set), `runs:active` (sorted set) | `Rules` + REDIS-SETUP.md | Hard-coded in producer. The exact namespace strings are locked. |
| TTL discipline: 600s completed / 60s failed/aborted | REDIS-SETUP.md | Producer's `finally` calls `EXPIRE` with these exact values. |

## Architectural Responsibility Map

Phase 061 spans **API/Backend** and **Database/Storage** tiers only. No frontend changes (Phase 063 owns frontend cutover).

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Per-run event emission (XADD) | API/Backend (producer task) | Database/Storage (Redis Stream is the buffer) | Producer writes events as it iterates the LLM stream; Redis is the durable medium that survives consumer disconnect. |
| Per-run event consumption (XREAD) | API/Backend (route handler / consumer) | Database/Storage (Redis Stream is the source) | Consumer is a thin XREAD loop; sse-starlette emits the wire format. |
| Run lifecycle metadata (INSERT/UPDATE) | API/Backend (producer task) | Database/Storage (Postgres `runs` table) | Service-role write; durable record for audit/debug/billing. |
| Run lifecycle queries (SELECT) | Database/Storage (Postgres + RLS) | API/Backend (Phase 062 endpoints; not built here) | RLS-enforced; user-scoped reads. |
| Producer task ownership | API/Backend (in-process registry) | — | Single uvicorn worker; no cross-process coordination needed (D-v2.5-02). |
| Health probe (Redis PING) | API/Backend (`/health` endpoint) | Database/Storage (Redis) | Cheap availability check; reports `unreachable` without blocking startup. |
| TTL/eviction | Database/Storage (Redis EXPIRE) | — | Set in producer's finally — passive cleanup, no app-level cron. |

**Sanity check:** Producer task lives in the API tier (FastAPI process), but its **lifetime** is decoupled from any single HTTP request. This is the architectural shift; the tier itself doesn't move.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `redis` | `>=5.2,<8` (current stable: 7.4.0) | Async Redis client (`redis.asyncio` namespace) | Official client maintained by Redis Inc.; merged the legacy `aioredis` in 5.x; only credible asyncio Redis option. `requires_python>=3.10` per PyPI. [VERIFIED: pypi.org/pypi/redis/json] |
| `sse-starlette` | `==2.4.1` (already pinned) | EventSourceResponse for SSE | Phase 059 dependency; carries forward unchanged. The fixture in `test_059_disconnect.py` validates against `2.4.x` only — bump pin in lockstep with the version-assertion guard. [VERIFIED: backend/requirements.txt:2 + tests/integration/test_059_disconnect.py:63] |
| `fastapi` | `==0.115.6` (already pinned) | HTTP framework | Carries forward. [VERIFIED: backend/requirements.txt:1] |
| `pydantic-settings` | `==2.7.0` (already pinned) | Env-driven Settings class | New `redis_url` and `run_hard_timeout_seconds` fields slot in trivially. [VERIFIED: backend/requirements.txt:9] |
| `supabase` | `==2.10.0` (already pinned) | Sync Postgres client (wrapped via `aexec`) | Carries forward; runs INSERT/UPDATE go through `aexec`. [VERIFIED: backend/requirements.txt:4] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `pytest-asyncio` | `>=0.24.0` (already pinned) | Async test runner | Existing — no change. [VERIFIED: backend/requirements.txt:19] |
| `pytest-timeout` | `>=2.4.0` (already pinned) | Hard test timeout | Used by 058/059 binding gates; carries forward to 061's binding test. [VERIFIED: backend/requirements.txt:20] |

### Alternatives Considered (and rejected by D-v2.5-08 / D-061-14)

| Instead of | Could Use | Tradeoff | Decision |
|------------|-----------|----------|----------|
| `redis>=5` | `aioredis` (legacy) | Was merged into `redis-py` in 4.2; using it now is regression. | Use `redis>=5` (D-v2.5-08, REDIS-SETUP.md). |
| Redis Streams | pgmq, LISTEN/NOTIFY | pgmq is consume-once (no replay); LISTEN/NOTIFY hits 8KB payload caps. | Locked to Redis Streams (D-v2.5-08). |
| Real Redis in tests | `fakeredis` | Streams semantics drift between Redis and fakeredis (XREAD BLOCK behavior, MAXLEN ~ trimming heuristics). | Real Redis via docker-compose (D-061-14). |
| Real Redis in tests | `testcontainers` | Per-session container spin-up adds 10–30s to test runs at v2.5 scale. | Fall back to it only if pytest-xdist parallelism produces flakes (deferred). |

**Installation:**
```bash
# In backend/venv:
pip install 'redis>=5.2,<8'
# Then update backend/requirements.txt:
echo 'redis>=5.2,<8' >> backend/requirements.txt   # planner: insert in alphabetical position
pip freeze | grep redis  # verify the resolved version landed
```

**Version verification:** Per RESEARCH.md verification protocol, planner MUST run `pip index versions redis` (or `pip install redis==` to get the upper bound) before pinning. As of 2026-05-02, latest stable is **7.4.0** (release published October 2025; supports Python 3.10+ per PyPI metadata). [VERIFIED: pypi.org/pypi/redis/json fetched 2026-05-02]

## Architecture Patterns

### System Architecture Diagram

```
                ┌─────────────────────────────────────────────────────┐
                │ Browser (Phase 061: unchanged from 059)             │
                │   POST /threads/{tid}/messages → SSE response       │
                └──────────────────────┬──────────────────────────────┘
                                       │ HTTP/SSE
                                       ▼
       ┌────────────────────────────────────────────────────────┐
       │ FastAPI process (single uvicorn worker, D-v2.5-02)     │
       │                                                        │
       │  ┌──────────────────┐         ┌─────────────────────┐  │
       │  │ Route handler    │  spawn  │ Producer task       │  │
       │  │ POST /threads/   ├────────▶│ agent_runner(run_id)│  │
       │  │ {tid}/messages   │         │ async with          │  │
       │  │                  │         │   asyncio.timeout(  │  │
       │  │ 1. INSERT user   │         │     120):           │  │
       │  │    message       │         │   for iter in loop: │  │
       │  │ 2. INSERT runs   │         │     XADD run:{id}   │  │
       │  │    row           │         │       {data: ...}   │  │
       │  │ 3. spawn task    │         │ finally:            │  │
       │  │ 4. RUN_TASKS[id] │         │   shielded persist  │  │
       │  │    = task        │         │   sentinel XADD     │  │
       │  │ 5. return SSE    │         │   UPDATE runs row   │  │
       │  │    consumer      │         │   EXPIRE 600/60     │  │
       │  └──────────────────┘         │   ZREM sorted sets  │  │
       │           │                   │   RUN_TASKS.pop()   │  │
       │           │                   └──────────┬──────────┘  │
       │           │ EventSourceResponse          │              │
       │           ▼                              ▼              │
       │  ┌──────────────────┐         ┌─────────────────────┐  │
       │  │ Consumer         │◀──XREAD─│ Redis (run:{id})    │  │
       │  │ event_consumer() │         │ - Stream entries    │  │
       │  │ replay: COUNT 100│         │ - TTL 600 / 60      │  │
       │  │   STREAMS id 0   │         │ - MAXLEN ~ 10000    │  │
       │  │ tail: BLOCK 5000 │         │                     │  │
       │  │   STREAMS id $   │         │ runs_by_thread:{tid}│  │
       │  │ break on terminal│         │ runs:active         │  │
       │  └──────────────────┘         │   (sorted sets)     │  │
       │                               └─────────────────────┘  │
       │                                          │             │
       │                                          │ INSERT/UPDATE
       │                                          ▼             │
       │                               ┌─────────────────────┐  │
       │                               │ Postgres (Supabase) │  │
       │                               │ public.runs         │  │
       │                               │   (RLS, SELECT-only │  │
       │                               │    user-scoped)     │  │
       │                               └─────────────────────┘  │
       │                                                        │
       │  Lifespan: cancel all RUN_TASKS, await client.aclose() │
       └────────────────────────────────────────────────────────┘
```

**Key flow change vs 059:** The asyncio.Queue is gone. Producer XADDs into Redis; consumer XREADs from Redis. Killing the consumer no longer cancels the producer (D-061-03). Producer survives until natural completion or 120s `asyncio.timeout` (D-061-01).

### Recommended Project Structure

```
backend/
├── app/
│   ├── api/
│   │   ├── threads.py              # MODIFIED: queue→XADD, register RUN_TASKS, INSERT/UPDATE runs row
│   │   ├── _run_registry.py        # NEW (planner discretion): RUN_TASKS dict + helpers
│   │   └── _agent_runner.py        # NEW (planner discretion): extract producer body
│   ├── dependencies.py             # MODIFIED: add get_redis() singleton
│   ├── config.py                   # MODIFIED: add redis_url + run_hard_timeout_seconds
│   ├── main.py                     # MODIFIED: lifespan startup ping + shutdown cancel; /health Redis check
│   └── utils/
│       └── db.py                   # UNCHANGED: aexec wraps Supabase calls only
├── requirements.txt                # MODIFIED: add redis>=5.2,<8
└── tests/
    └── integration/
        ├── test_058_concurrency.py # UNCHANGED: regression guard
        ├── test_059_disconnect.py  # MODIFIED: invert contract per D-061-16
        └── test_061_producer_survives_disconnect.py  # NEW: D-061-15 binding gate

supabase/
├── migrations/
│   └── 035_runs_table.sql          # NEW: D-v2.5-11 mandate
└── full-schema.sql                 # REGENERATED via scripts/regenerate-full-schema.sh
```

**Note on extraction:** Whether to extract `_run_registry.py` and `_agent_runner.py` is *Claude's Discretion* per CONTEXT.md. Recommendation: **extract `_run_registry.py` only** (small, testable, eliminates module-level state from `threads.py`); leave `agent_runner` nested inside the route handler because it has a long closure capture surface (`current_user`, `body`, `thread_id`, `supabase`, `redis`, `run_id`) and extraction would inflate the diff with parameter-passing boilerplate that's pure mechanical noise.

### Pattern 1: Async Redis Singleton (mirrors `get_supabase()`)

**What:** Module-level cached `redis.asyncio.Redis` instance; lazy-initialized on first call; closed in lifespan.
**When to use:** All Redis access in 061. Routes inject via `Depends(get_redis)`; the producer task captures the instance via closure when spawned.
**Example:**
```python
# Source: pattern derived from backend/app/dependencies.py:9-15 (get_supabase)
#         and redis-py async docs (redis.readthedocs.io asyncio examples)
import redis.asyncio as aioredis

_redis: aioredis.Redis | None = None

def get_redis() -> aioredis.Redis:
    """Lazily create a singleton async Redis client. Closed in app lifespan."""
    global _redis
    if _redis is None:
        # from_url is sync — only sets up the pool config; first I/O
        # happens on the first awaited command. Safe to call inline.
        _redis = aioredis.from_url(
            settings.redis_url,
            encoding="utf-8",
            decode_responses=True,   # XREAD entries arrive as str (not bytes)
        )
    return _redis
```

**`decode_responses=True` rationale:** Without it, XREAD returns `bytes` keys/values and the consumer must `.decode("utf-8")` every entry's `data` field before `json.loads`. With it, you get strings directly. The 5–10% per-byte memory cost is irrelevant at this scale (≤2 MB per run).

[CITED: redis.readthedocs.io/en/stable/examples/asyncio_examples.html — "all commands are coroutine functions"]

### Pattern 2: Two-Mode XREAD Loop (replay then tail)

**What:** Consumer reads backlog with `XREAD COUNT 100 STREAMS run:{id} 0` until empty, then switches to live-tail with `XREAD BLOCK 5000 STREAMS run:{id} $`.
**When to use:** The consumer in `event_consumer()`. Single canonical pattern in Redis Streams literature.
**Example:**
```python
# Source: redis.io/commands/xread + redis.io/develop/data-types/streams (canonical pattern)
import json
import time

TERMINAL_TYPES = frozenset({"done", "error", "cancelled"})
RUN_HARD_TIMEOUT_SECONDS = 120  # from settings

async def event_consumer(redis: aioredis.Redis, run_id: uuid.UUID):
    stream_key = f"run:{run_id}"
    last_id = "0"   # replay from start
    deadline = time.monotonic() + RUN_HARD_TIMEOUT_SECONDS + 10  # safety net

    # Phase 1: replay backlog
    while True:
        if time.monotonic() > deadline:
            yield {"data": json.dumps({"type": "error", "error": "consumer_timeout"})}
            return
        result = await redis.xread(streams={stream_key: last_id}, count=100, block=0 if last_id == "0" else None)
        # NOTE: passing block=0 with starting id="0" reads available immediately;
        # if no entries exist yet (producer just spawned), result is None and we
        # transition to live-tail with $ below.
        if not result:
            break
        for _stream_name, entries in result:
            for entry_id, fields in entries:
                last_id = entry_id
                yield {"data": fields["data"]}
                payload = json.loads(fields["data"])
                if payload.get("type") in TERMINAL_TYPES:
                    return

    # Phase 2: live-tail
    last_id = "$"
    while True:
        if time.monotonic() > deadline:
            yield {"data": json.dumps({"type": "error", "error": "consumer_timeout"})}
            return
        result = await redis.xread(streams={stream_key: last_id}, count=100, block=5000)
        if not result:   # BLOCK timeout returned nil — loop and re-check deadline
            continue
        for _stream_name, entries in result:
            for entry_id, fields in entries:
                last_id = entry_id   # IMPORTANT: advance from $ to actual last id
                yield {"data": fields["data"]}
                payload = json.loads(fields["data"])
                if payload.get("type") in TERMINAL_TYPES:
                    return
```

**Critical detail per Redis docs:** After the first XREAD with `$`, subsequent XREADs MUST use the actual last-seen entry ID — NOT `$` again, otherwise you skip everything that arrives between calls. [CITED: redis.io/commands/xread — "you should use the `$` ID only for the first call to XREAD. Later the ID should be the one of the last reported item in the stream"]

### Pattern 3: Producer Task Registration

**What:** Spawn the producer with `asyncio.create_task`, register in `RUN_TASKS`, self-evict in `finally`.
**When to use:** Once per `POST /threads/{tid}/messages`.
**Example:**
```python
# Source: pattern derived from backend/app/api/threads.py:56-64 (_BACKGROUND_TASKS)
#         and CONTEXT.md D-061-11
import uuid
import asyncio

RUN_TASKS: dict[uuid.UUID, asyncio.Task] = {}

# Inside route handler:
run_id = uuid.uuid4()
# 1. INSERT runs row (status='streaming', started_at=now())
await aexec(supabase.table("runs").insert({
    "run_id": str(run_id),
    "thread_id": thread_id,
    "user_id": current_user["id"],
    "status": "streaming",
    "model": user_settings.llm_model,
    "provider": user_settings.active_provider,
}))
# 2. ZADD sorted-set indexes
started_score = time.time()
await redis.zadd(f"runs_by_thread:{thread_id}", {str(run_id): started_score})
await redis.zadd("runs:active", {str(run_id): started_score})
# 3. Spawn producer
task = asyncio.create_task(agent_runner(run_id, ...))
RUN_TASKS[run_id] = task
task.add_done_callback(lambda _: RUN_TASKS.pop(run_id, None))
# 4. Return consumer SSE response
return EventSourceResponse(event_consumer(redis, run_id), ping=15)
```

**Why `add_done_callback` for self-eviction?** Producer's own `finally` runs `RUN_TASKS.pop(run_id, None)` for the happy path. The done-callback is belt-and-suspenders for the rare case where the producer raises before reaching its finally (e.g., `asyncio.CancelledError` from app shutdown, or KeyboardInterrupt) — same pattern as the existing `_BACKGROUND_TASKS` set in threads.py:56-64.

### Pattern 4: Lifespan Startup Ping + Shutdown Cancel

**What:** `lifespan()` runs a best-effort Redis PING at startup (warns but doesn't block) and cancels all `RUN_TASKS` at shutdown.
**When to use:** `backend/app/main.py:50` lifespan context manager.
**Example:**
```python
# Source: extension of existing lifespan in backend/app/main.py:50-63
@asynccontextmanager
async def lifespan(app_instance):
    # Existing: AnyIO limiter (D-058-07)
    anyio.to_thread.current_default_thread_limiter().total_tokens = settings.anyio_thread_tokens

    # NEW: best-effort Redis startup ping (don't block startup if unreachable)
    redis_client = get_redis()
    try:
        await asyncio.wait_for(redis_client.ping(), timeout=1.0)
        logger.info("Redis ping ok at %s", settings.redis_url)
    except (asyncio.TimeoutError, Exception) as e:
        logger.warning("Redis unreachable at %s: %s — run-backed streaming will fail", settings.redis_url, e)

    yield

    # NEW: cancel all in-flight producer tasks
    from app.api.threads import RUN_TASKS   # or _run_registry
    for task in list(RUN_TASKS.values()):
        if not task.done():
            task.cancel()
    if RUN_TASKS:
        await asyncio.gather(*RUN_TASKS.values(), return_exceptions=True)

    # NEW: close Redis client
    await redis_client.aclose()

    # Existing: sandbox cleanup
    if settings.sandbox_enabled:
        from app.services.sandbox_service import sandbox_manager
        sandbox_manager.close_all()
```

**Why `asyncio.wait_for(... timeout=1.0)` on PING?** redis-py's `from_url` is sync; the actual TCP connect + RESP handshake happens on first awaited command. PING is the cheapest first-command (sub-millisecond on local Redis). The 1s wait_for ensures a misconfigured `REDIS_URL` doesn't hang startup forever; the warning log is loud enough that anyone reading logs catches it instantly. [CITED: docs.python.org/3/library/asyncio-task.html#asyncio.wait_for]

### Anti-Patterns to Avoid

- **`fakeredis` in tests.** Streams semantics drift; D-061-14 prohibits.
- **Sync `import redis` (not `redis.asyncio`).** Sync API blocks the event loop; only `redis.asyncio` is acceptable in this codebase.
- **`run_in_threadpool(redis.xadd, ...)`.** Redis-py async is natively async. Wrapping it in threadpool defeats the purpose and unnecessarily consumes one of the 200 AnyIO tokens (D-058-07).
- **Calling `XREAD` with `block=0` and `STREAMS run:{id} $` (the original pattern from older docs).** `block=0` means "block forever"; combined with `$` on a stream that never gets a message (e.g., producer crashed before any XADD), the consumer hangs forever. Use `block=5000` (5s) and re-check the deadline on every iteration. [CITED: redis.io/commands/xread]
- **EXPIRE before terminal sentinel XADD.** If EXPIRE runs first with `60s` (failed bucket) and the sentinel XADD happens shortly after, the entry is added but the key already has a 60s clock — usually fine, but if the consumer's BLOCK 5000 times out and re-checks while the key has just expired, the consumer can miss the sentinel entirely. Sentinel XADD MUST come BEFORE EXPIRE.
- **`MAXLEN ~ 100`.** Approximate trimming can leave actual length slightly above the cap ("a few tens more" per Redis docs). With a low cap, the sentinel could in theory fall outside the trim window in pathological cases. The recommended `MAXLEN ~ 10000` gives many orders of magnitude of headroom over per-run event counts (typical: <500 events per run). [CITED: redis.io/commands/xadd — "or at most a few tens more"]
- **Two-call ZADD-then-ZADD instead of single XADD.** Don't try to batch sorted-set updates with the XADD by hand — XADD is a single Redis call; ZADD is another. Use `redis.pipeline()` if you want to batch them in one round-trip, but it's not necessary at this scale (sub-millisecond local Redis).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SSE wire framing | Custom `data: {}\n\n` formatter | `sse-starlette.EventSourceResponse` | Already in the stack; handles ping intervals, disconnect detection, ASGI lifecycle correctly. |
| Stream replay-and-tail semantics | Polling SELECT on a Postgres events table | `XREAD STREAMS run:{id} {offset}` | Native Redis primitive; battle-tested for chat-streaming infra (chosen over LISTEN/NOTIFY + pgmq per D-v2.5-08). |
| Per-key TTL | App-level cron task scanning for expired entries | `EXPIRE run:{id} {seconds}` | Redis handles passive + active expiration internally. App is a producer of TTLs, not a consumer of expiry events. [CITED: redis.io/commands/expire] |
| Concurrent fan-out (multi-tab) | Pub/sub or fan-out queue | Independent XREAD per consumer with its own `last_id` | Redis Streams are designed for it: every consumer keeps its own cursor, the stream is the source of truth. |
| Producer-task lifetime tracking | A new "task supervisor" abstraction | Module-level `dict[uuid.UUID, asyncio.Task]` + done-callback | The existing pattern in threads.py:56-64 (`_BACKGROUND_TASKS`) is already correct; mirror it. |
| Health probes | Manual heartbeat key + sweeper | `redis.ping()` from `/health` | One async call, sub-millisecond latency, no state. |
| UUID generation in Postgres | Sequence + cast to text | `gen_random_uuid()` (built-in 13+) | No `pgcrypto` extension required; precedent in 9 existing migrations including 001. [VERIFIED: grep across `supabase/migrations/*.sql` 2026-05-02] |
| RLS for SELECT-only access | App-side ownership check | `CREATE POLICY ... FOR SELECT USING (auth.uid() = user_id)` | Defense-in-depth; the 062 GET endpoints route through service-role anyway, but RLS guards against any future direct-from-frontend access. |

**Key insight:** Redis Streams + `redis.asyncio` deliver replay, live-tail, multi-consumer fan-out, TTL, and bounded memory **as primitives**. Every line of replay/tail logic you write yourself is dead weight a future maintainer has to read.

## Runtime State Inventory

> Phase 061 is greenfield code (new Redis backing + new Postgres table). It is NOT a rename/refactor of stored runtime state.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — new Redis instance, new Postgres table. The legacy in-memory `asyncio.Queue` from 059 has no persisted state. | None. |
| Live service config | None — there are no existing 3rd-party services with embedded config strings related to runs. | None. |
| OS-registered state | None. | None. |
| Secrets/env vars | New: `REDIS_URL` (already present in `backend/.env.example` as of v2.5 dev infra setup) and `RUN_HARD_TIMEOUT_SECONDS` (new). Both have safe defaults; no secret rotation needed. | Confirm `backend/.env` has `REDIS_URL` set; if missing, app falls back to `redis://localhost:6379` default. |
| Build artifacts | None. New `redis>=5.2` package installs cleanly into `backend/venv/`. | Re-`pip install -r backend/requirements.txt` after the requirements bump. |

## Common Pitfalls

### Pitfall 1: `XREAD` with `$` after the first call

**What goes wrong:** Consumer sets `last_id = "$"` once and re-uses it on every BLOCK iteration. Every entry produced between two BLOCK calls is silently lost.
**Why it happens:** Redis interprets `$` as "ID greater than the largest currently-existing entry ID at the time of THIS call". On a second call, `$` is a different cutoff than on the first call.
**How to avoid:** After receiving any entry, set `last_id = entry_id` (the actual returned ID). Pattern shown in *Pattern 2* above. [CITED: redis.io/commands/xread]
**Warning signs:** Consumer receives the first batch of tokens but stops mid-stream while producer is still XADDing; XLEN keeps growing in Redis Insight while the consumer reports nothing.

### Pitfall 2: EXPIRE-before-sentinel race

**What goes wrong:** Producer's `finally` runs `EXPIRE run:{id} 60` (failed bucket) BEFORE the terminal sentinel XADD. Consumer is currently in `BLOCK 5000`; the BLOCK times out, the consumer re-issues XREAD and finds the key has just been TTL'd away. Consumer receives nil, loops on the deadline, eventually emits its synthetic timeout error.
**Why it happens:** Race between Redis's active-expiry sweeper and the consumer's next XREAD call.
**How to avoid:** Producer's `finally` MUST order operations as: (1) shielded persist, (2) terminal sentinel XADD, (3) UPDATE runs row, (4) EXPIRE, (5) ZREM sorted sets, (6) RUN_TASKS.pop. The sentinel comes BEFORE the EXPIRE.
**Warning signs:** `runs.status='completed'` but consumer reports `consumer_timeout` error to the user.

### Pitfall 3: `asyncio.timeout` swallowing CancelledError

**What goes wrong:** Code wraps `async with asyncio.timeout(120):` and catches `asyncio.CancelledError` inside. The `timeout` context manager raises `CancelledError` internally on timeout, intercepts it, and re-raises as `TimeoutError`. If your code catches `CancelledError` in a try/except inside the context, you defeat the timeout.
**Why it happens:** `asyncio.timeout` works by issuing `task.cancel()` on the current task; the CancelledError it raises is the signal.
**How to avoid:** Catch `TimeoutError` *outside* the `async with`, NOT `CancelledError` inside it. The producer's existing inner try/finally pattern (which re-raises `CancelledError` per D-059-02) is fine — `timeout` issues a fresh CancelledError that the timeout machinery catches. [CITED: docs.python.org/3/library/asyncio-task.html#asyncio.timeout]
**Warning signs:** 120s ceiling silently exceeded; a single rogue agent loop runs indefinitely.

### Pitfall 4: redis-py 5.x ConnectionPool churn under FastAPI/uvicorn

**What goes wrong:** Under sustained load, `redis.asyncio.ConnectionPool` raised "Connection lost" / "Connection closed by server" intermittently, especially when many concurrent requests share a pool. (Noted in [VERIFIED: github.com/redis/redis-py/issues/3230]; user identified `await asyncio.sleep(0.1)` as a workaround on redis-py 5.0.0.)
**Why it happens:** Race condition in async pool reconnect logic in early 5.x. Fixed in later 5.x and 7.x releases.
**How to avoid:** Pin `redis>=5.2,<8` (latest stable 7.4.0 as of 2026-05-02). Use `from_url` with default pool sizing. Don't share the pool across event loops (each FastAPI process has exactly one loop, so this is naturally satisfied with the singleton pattern).
**Warning signs:** Sporadic `ConnectionError` in logs that disappears on retry.

### Pitfall 5: `MAXLEN ~ N` may exceed N by "a few tens"

**What goes wrong:** Producer sets `XADD MAXLEN ~ 100` thinking the cap is 100. Actual stream length sits at 130 occasionally. If your consumer logic depends on an exact upper bound, it breaks.
**Why it happens:** Approximate trimming uses Redis's macro-node internal layout; trimming whole macro-nodes is faster than trimming individual entries, so Redis defers to the next round if the closest macro-node boundary is past the cap. [CITED: redis.io/commands/xadd]
**How to avoid:** Either (a) accept the slop (10% overshoot is irrelevant at MAXLEN 10000), or (b) use `MAXLEN N` (no `~`) for exact trimming at higher cost. Recommended: stay with `~ 10000`; sentinel never gets trimmed because it's the most-recent entry.
**Warning signs:** Tests asserting exact `XLEN` values after many XADDs intermittently fail.

### Pitfall 6: Test fixture event-loop binding

**What goes wrong:** Session-scoped `redis.asyncio.Redis` fixture connects on the first test's event loop; second test's loop is fresh, the connection is bound to the dead loop, all commands raise `RuntimeError: ... is bound to a different event loop`.
**Why it happens:** pytest-asyncio's per-function loop scope (configured in `backend/pytest.ini`: `asyncio_mode = auto`) creates a new loop per test by default; `redis.asyncio.Redis` lazy-creates its connection pool against whichever loop is current at the time of first command.
**How to avoid:** Either (a) make the fixture function-scoped (creates a fresh client per test, slight overhead acceptable), or (b) declare the fixture session-scoped but use `pytest_asyncio.fixture(scope="session")` AND configure `asyncio_mode = auto` to use a session-scoped loop — verify with the existing 059 fixture pattern (it asserts `sse_starlette.__version__.startswith("2.4.")` for the same loop-binding reason). Recommendation: function-scoped fixture + FLUSHDB at fixture teardown. UUID test isolation (D-061-17) makes cross-test bleed impossible at the data layer.
**Warning signs:** First test in suite passes, all subsequent tests fail with `RuntimeError: <... > is bound to a different event loop`.

### Pitfall 7: Producer's `finally` blocking on Redis when Redis is down

**What goes wrong:** Producer reaches its `finally`. Redis dropped network mid-stream. `await redis.xadd(...)` hangs (default socket timeout = 0 = forever). The shielded persist already completed, but the producer task never returns; `RUN_TASKS` accumulates dead tasks; lifespan shutdown waits forever.
**Why it happens:** Default redis-py socket timeout is `None`. Network drops aren't detected until next TCP keepalive (minutes).
**How to avoid:** Configure `socket_timeout=10` and `socket_connect_timeout=5` in `from_url`. Wrap the whole `finally` body in a try/except to log and continue rather than re-raise — the producer is already dying; the exit path needs to be robust to Redis flakiness.
**Warning signs:** `RUN_TASKS` count grows without bound; lifespan shutdown logs "still waiting for X tasks" repeatedly.

## Code Examples

### `get_redis()` singleton

```python
# Source: pattern derived from backend/app/dependencies.py:9-15 (get_supabase)
#         + redis.readthedocs.io/en/stable/examples/asyncio_examples.html
import redis.asyncio as aioredis

_redis: aioredis.Redis | None = None

def get_redis() -> aioredis.Redis:
    """Lazily create a singleton async Redis client. Closed in app lifespan."""
    global _redis
    if _redis is None:
        _redis = aioredis.from_url(
            settings.redis_url,
            encoding="utf-8",
            decode_responses=True,        # XREAD entries arrive as str
            socket_timeout=10,            # detect dead sockets within 10s
            socket_connect_timeout=5,     # fail fast on initial connect
        )
    return _redis
```

### Producer XADD helper (Claude's-discretion ergonomics)

```python
# Source: derived from CONTEXT.md "Specific Ideas" section
import json

async def _emit(redis: aioredis.Redis, run_id: uuid.UUID, type: str, **fields) -> None:
    """One canonical XADD shape. Wire format byte-identical to 059 queue payload."""
    payload = {"type": type, **fields}
    await redis.xadd(
        f"run:{run_id}",
        {"data": json.dumps(payload)},
        maxlen=10000,
        approximate=True,   # XADD MAXLEN ~ 10000 — see Pitfall 5
    )

# Replace every `await queue.put(json.dumps({...}))` from 059 with:
# await _emit(redis, run_id, "delta", content=delta.content)
# await _emit(redis, run_id, "tool_start", name=tool_name, args=args)
# ... etc
```

### Producer `finally` shape (preserves 059's shielded persist + adds terminal write + EXPIRE)

```python
# Source: extension of backend/app/api/threads.py:1817-1858 (existing finally)
finally:
    # 1. SHIELDED PERSIST — preserved verbatim from 059 (D-059-02)
    async def _shielded_persist():
        try:
            await _persist_assistant_message()
        except BaseException:
            logger.exception("Shielded persist failed")
    try:
        await asyncio.shield(_shielded_persist())
    except asyncio.CancelledError:
        pass   # CancelledError from app shutdown — proceed to cleanup

    # 2. TERMINAL SENTINEL XADD — MUST come before EXPIRE (Pitfall 2)
    terminal_type, error = "done", None
    if exception_was_caught:
        terminal_type, error = "error", str(exception_was_caught)
    elif timed_out:
        terminal_type, error = "error", "hard_timeout"
    try:
        await _emit(redis, run_id, terminal_type, error=error)
    except Exception:
        logger.exception("Terminal sentinel XADD failed")

    # 3. UPDATE runs row (status / completed_at / message_id / tokens / error)
    try:
        await aexec(supabase.table("runs").update({
            "status": {"done": "completed", "error": "failed"}[terminal_type],
            "completed_at": "now()",
            "error": error,
            "message_id": _persisted_message_id,    # may be None if persist failed
            # input_tokens, output_tokens — see Open Question Q2
        }).eq("run_id", str(run_id)))
    except Exception:
        logger.exception("Failed to update runs row")

    # 4. EXPIRE — 600s for completed, 60s for failed/cancelled
    try:
        ttl = 600 if terminal_type == "done" else 60
        await redis.expire(f"run:{run_id}", ttl)
    except Exception:
        logger.exception("EXPIRE failed")

    # 5. ZREM sorted-set indexes
    try:
        await redis.zrem(f"runs_by_thread:{thread_id}", str(run_id))
        await redis.zrem("runs:active", str(run_id))
    except Exception:
        logger.exception("ZREM failed")

    # 6. Self-evict from registry (done-callback also handles this; defense-in-depth)
    RUN_TASKS.pop(run_id, None)
```

### Migration `035_runs_table.sql` skeleton

```sql
-- Source: pattern derived from supabase/migrations/028_message_feedback.sql
--         + CONTEXT.md D-061-05..09
-- Phase 061: per-run lifecycle metadata for run-backed streaming (D-v2.5-11)

CREATE TABLE IF NOT EXISTS public.runs (
  run_id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id       uuid NOT NULL REFERENCES public.threads(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES auth.users(id)     ON DELETE CASCADE,
  message_id      uuid NULL,    -- NULL until producer's finally runs the persist
  status          text NOT NULL CHECK (status IN ('streaming','completed','failed','cancelled')),
  model           text NOT NULL,
  provider        text NOT NULL,
  started_at      timestamptz NOT NULL DEFAULT now(),
  completed_at    timestamptz NULL,
  input_tokens    integer NULL,
  output_tokens   integer NULL,
  error           text NULL
);

-- Partial index: tiny because 99.9% of rows are terminal (D-061-07)
CREATE INDEX IF NOT EXISTS idx_runs_active
  ON public.runs (user_id, thread_id, status)
  WHERE status = 'streaming';

-- Composite index: history/audit queries (D-061-07)
CREATE INDEX IF NOT EXISTS idx_runs_history
  ON public.runs (user_id, thread_id, started_at DESC);

-- RLS: SELECT-only via auth.uid() = user_id (D-061-08)
ALTER TABLE public.runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY runs_select_own
  ON public.runs FOR SELECT
  USING (auth.uid() = user_id);

-- No INSERT/UPDATE/DELETE policies — service-role only (backend writes).
```

**Post-migration step:** `bash scripts/regenerate-full-schema.sh` to rebuild `supabase/full-schema.sql` (CLAUDE.md project rule).

### Test fixture (D-061-14, D-061-17)

```python
# Source: pattern derived from backend/tests/conftest.py + REDIS-SETUP.md
import pytest_asyncio
import redis.asyncio as aioredis

@pytest_asyncio.fixture
async def redis_client():
    """Function-scoped async Redis client connected to local docker-compose Redis.

    Function scope avoids the event-loop binding issue (Pitfall 6).
    UUID-based test isolation (D-061-17) means no key prefixing needed.
    """
    client = aioredis.from_url(
        "redis://localhost:6379",
        encoding="utf-8",
        decode_responses=True,
    )
    yield client
    # Teardown: light cleanup. Per-test FLUSHDB is overkill given UUID isolation;
    # only flush if leftover keys impact memory/observability.
    await client.aclose()


@pytest_asyncio.fixture(scope="session", autouse=True)
async def _flush_redis_at_session_end():
    yield
    client = aioredis.from_url("redis://localhost:6379", decode_responses=True)
    await client.flushdb()
    await client.aclose()
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `aioredis` (separate package) | `redis>=4.2` with `redis.asyncio` | 2022 (redis-py 4.2 merged aioredis) | Use only `redis.asyncio.*` imports; never `aioredis.*`. |
| `asyncio.wait_for(timeout=...)` for cancellable timeouts | `async with asyncio.timeout(...)` | Python 3.11 | Cleaner contract; raises `TimeoutError` outside the context, doesn't conflict with internal `CancelledError`. We have 3.12.6, use the new API. [CITED: docs.python.org/3/library/asyncio-task.html#asyncio.timeout] |
| `client.close()` (sync) | `await client.aclose()` | redis-py 5.0 | Old `close()` is deprecated; explicit `aclose()` is the asyncio convention. [CITED: redis.readthedocs.io/en/stable/examples/asyncio_examples.html] |
| Custom Postgres events table for replay | Redis Streams `XREAD` with offset cursor | This phase (D-v2.5-08) | Native primitive; no DDL, no schema migrations for event payload changes, free multi-consumer fan-out. |

**Deprecated/outdated:**
- `aioredis` package — merged into redis-py; do NOT use the standalone package.
- `redis.client.Redis` for async — that's the sync class; only `redis.asyncio.Redis` is async.
- Sync `.close()` on async client — use `await client.aclose()`.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | redis-py 7.4.0 is fully compatible with Python 3.12.6 | Standard Stack | LOW — PyPI metadata states `requires_python>=3.10`; 3.12 is well within range and a major test target. [VERIFIED: pypi.org/pypi/redis/json] |
| A2 | redis-py 5.x ConnectionPool issue (#3230) is resolved in current 7.4.0 | Pitfall 4 | LOW — pinning `>=5.2` covers the post-fix range; latest stable (7.4) is well past the affected window. Verify by exercising the binding test under repeated runs. |
| A3 | `decode_responses=True` does not break any internal redis-py behavior we depend on | Pattern 1 | LOW — only affects how XREAD returns values; we control all XADD/XREAD call sites. Verify in unit test by round-tripping a known JSON payload. |
| A4 | Supabase's local-CLI Postgres is version 13+ (so `gen_random_uuid()` is built-in) | Standard Stack | LOW — Supabase has shipped on Postgres 14+ since 2022; precedent in 9 existing migrations including `001_initial_schema.sql` (no `pgcrypto` imports). [VERIFIED: grep across `supabase/migrations/*.sql`] |
| A5 | `asyncio.timeout()` re-raises CancelledError as TimeoutError without interfering with the producer's existing inner try/finally that re-raises CancelledError per D-059-02 | Pitfall 3 | MEDIUM — these two control flows interact. Safer reading: the producer's body raises CancelledError when `asyncio.timeout` fires. The inner `try/finally` runs (shielded persist completes). Then on the way out of `async with timeout`, the timeout context catches the CancelledError and re-raises it as TimeoutError. The route handler / done-callback observes TimeoutError. **Verify with a unit test** that drives a slow-mock-LLM past 120s and asserts both shielded persist runs AND `runs.status='failed' error='hard_timeout'`. |
| A6 | XADD MAXLEN ~ 10000 is sufficient headroom over typical per-run event counts | Pattern 2 / Pitfall 5 | LOW — typical agent runs emit <500 events (deltas + tool calls + tools); 10000 is 20× headroom. Verify with a pathological test (max_iterations=15, each generating 50 deltas + 5 tool events = 825 events; still 12× under the cap). |
| A7 | Redis EXPIRE behavior on Stream key is identical to other key types (whole key + all entries deleted) | Pattern 2 / Don't Hand-Roll table | HIGH-confidence verified — official Redis documentation confirms uniform EXPIRE semantics across data types. [CITED: redis.io/commands/expire + WebSearch corroboration 2026-05-02] |
| A8 | `pytest-asyncio asyncio_mode = auto` (current `backend/pytest.ini`) creates a fresh event loop per test, which makes session-scoped Redis fixtures fail with loop-binding error | Pitfall 6 | MEDIUM — confirmed by the existing 059 fixture which resets `sse_starlette.AppStatus` before every test for the same reason. The recommended function-scoped fixture sidesteps the issue. Verify by running 2 consecutive tests with the same fixture. |

**Two MEDIUM-confidence assumptions (A5, A8)** warrant a deliberate verification step in the binding test or its predecessor. Planner should add a wave-zero unit test for A5 (timeout interaction) and a smoke test for A8 (run the same fixture twice in one session).

## Open Questions (RESOLVED)

1. **Q1: Token-counter accounting source.**
   - What we know: Producer's `finally` UPDATEs `runs.input_tokens` / `runs.output_tokens`. The number must come from somewhere.
   - What's unclear: LLM SDKs return token counts in their final stream chunk (OpenAI: `usage` field on the last chunk if `stream_options={"include_usage": true}`; Anthropic: `usage` field on `message_stop` event). We could also estimate via `tiktoken`. CONTEXT.md "Deferred" explicitly says "planner picks the simplest path that gives a non-NULL number at completion."
   - Recommendation: For 061, capture the SDK-reported usage when available; fall back to NULL if the provider doesn't surface it (matches `INTEGER NULL` schema). Don't pull in `tiktoken` for estimation in this phase — that's a billing/usage concern that belongs alongside Phase 062's API surface.
   - **RESOLVED:** Plan 03 deviation block — SDK-reported usage only, NULL fallback, no tiktoken. See `061-03-PLAN.md` deviation section.

2. **Q2: Should `runs_by_thread:{thread_id}` and `runs:active` ZADD/ZREM happen in the producer's `finally`, or in the route handler's body before/after spawning the task?**
   - What we know: CONTEXT.md "Claude's Discretion" lists this. ZADD on start, ZREM on end. Both work.
   - What's unclear: Failure mode where ZADD happens but the producer task fails to spawn (e.g., resource exhaustion). Then the sorted set has an entry pointing at a non-existent run.
   - Recommendation: ZADD inside the route handler immediately AFTER `RUN_TASKS[run_id] = task` but BEFORE returning the consumer (atomic from request's perspective). ZREM inside producer's `finally`. If task spawn itself fails, the route handler raises and never returns the consumer; need a small `try/except` around the spawn that ZREMs on failure to prevent orphan sorted-set entries. Phase 062 will filter these by `runs.status='streaming'` from Postgres anyway, so even the orphan case is self-correcting.
   - **RESOLVED:** Plan 03 Task 1 Step C+E — ZADD in route handler post-spawn with spawn-failure ZREM cleanup; ZREM in producer's `finally`.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Local Redis (Docker) | Producer XADD, Consumer XREAD, all integration tests (D-061-14) | ✓ (per docker-compose.dev.yml) | redis:7-alpine | None — required infra. CI must `docker compose -f docker-compose.dev.yml up -d redis` before pytest. |
| Supabase local CLI (Postgres 14+) | `runs` table migration + RLS test | ✓ (per CLAUDE.md project setup) | Postgres 14+ (Supabase default) | None — required infra. |
| Python 3.12.6 | `asyncio.timeout()` (3.11+), `redis.asyncio` (3.10+) | ✓ | 3.12.6 (per `.planning/codebase/STACK.md`) | None — already the project standard. |
| `redis>=5.2,<8` | All Phase 061 code | ✗ (not yet installed; `pip` confirms `ModuleNotFoundError`) | — | Add to `requirements.txt`, `pip install -r requirements.txt` inside `backend/venv/`. |
| `bash` for `scripts/regenerate-full-schema.sh` | Post-migration full-schema regen | ✓ on dev machines (Git Bash on Windows works); CI runs Linux. | — | The script is a hard CLAUDE.md rule; no workaround. |

**Missing dependencies with no fallback:**
- `redis>=5.2,<8` — must be added to `backend/requirements.txt` and installed.

**Missing dependencies with fallback:**
- None.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | `pytest>=8.0.0` + `pytest-asyncio>=0.24.0` + `pytest-timeout>=2.4.0` |
| Config file | `backend/pytest.ini` (`asyncio_mode = auto`, `testpaths = tests`) |
| Quick run command | `cd backend && venv/Scripts/pytest tests/integration/test_061_producer_survives_disconnect.py -x` |
| Full suite command | `cd backend && venv/Scripts/pytest tests -q` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| STREAM-04 (foundation, SC#1) | XADD on every SSE event keyed by `run:{run_id}` | unit | `pytest backend/tests/unit/test_061_emit_helper.py::test_emit_xadds_data_field -x` | ❌ Wave 0 |
| STREAM-04 (foundation, SC#2) | Killing consumer does NOT kill producer | integration | `pytest backend/tests/integration/test_061_producer_survives_disconnect.py::test_producer_continues_after_consumer_disconnect -x` | ❌ Wave 0 (D-061-15) |
| STREAM-04 (foundation, SC#3) | Producer fills buffer fully even with no consumer attached | integration | (same test as SC#2 — covers both via XLEN-grows assertion) | ❌ Wave 0 |
| STREAM-04 (foundation, SC#4) | EXPIRE 600 (completed) / 60 (failed) applied | integration | `pytest backend/tests/integration/test_061_ttl.py::test_completed_run_expires_600s -x` AND `::test_failed_run_expires_60s -x` | ❌ Wave 0 |
| STREAM-04 (foundation, SC#5) | `runs` row INSERTed at start, UPDATEd in finally | integration | `pytest backend/tests/integration/test_061_runs_table.py::test_runs_lifecycle_row -x` | ❌ Wave 0 |
| STREAM-04 (foundation, SC#5b) | RLS on `runs` table (auth.uid()=user_id) | integration | `pytest backend/tests/integration/test_061_runs_table.py::test_rls_select_own_only -x` | ❌ Wave 0 |
| STREAM-04 (foundation, SC#6) | `/health` returns `{"redis": "ok" \| "unreachable"}` | unit | `pytest backend/tests/unit/test_health.py::test_health_includes_redis_status -x` | ❌ Wave 0 |
| STREAM-04 (foundation, SC#7) | 058 cross-tab GET <1s STILL passes | regression | `pytest backend/tests/integration/test_058_concurrency.py -x` | ✅ exists |
| STREAM-04 (foundation, SC#7b) | 059 disconnect test INVERTED — producer survives (D-061-16) | integration | `pytest backend/tests/integration/test_059_disconnect.py::test_agent_task_SURVIVES_on_disconnect -x` | ✅ file exists; rewrite per D-061-16 |
| STREAM-04 (foundation, SC#8) | 060 e2e thread-race STILL passes | regression | `pytest e2e/tests/060-thread-race.spec.ts` (Playwright) | ✅ exists |
| D-061-01 invariant | 120s `asyncio.timeout` correctly fires + writes terminal error sentinel + `runs.status='failed' error='hard_timeout'` | integration | `pytest backend/tests/integration/test_061_hard_timeout.py::test_120s_timeout_fires_full_finally -x` | ❌ Wave 0 |
| Pitfall 1 guard | Consumer advances `last_id` past `$` correctly (no skipped events) | unit | `pytest backend/tests/unit/test_061_consumer.py::test_xread_advances_last_id -x` | ❌ Wave 0 |
| Manual two-tab DevTools timing checklist | Per CONTEXT.md "061-VERIFICATION.md includes manual two-tab DevTools timing checklist" | manual | (human-only — non-gating backstop, mirrors 058/059 pattern) | ❌ Wave 0 (verification doc) |

### Sampling Rate

- **Per task commit:** `pytest backend/tests/integration/test_061_*.py -x` (~5 tests, target <30s)
- **Per wave merge:** `pytest backend/tests -q` (full backend suite)
- **Phase gate:** Full backend suite + `e2e/tests/060-thread-race.spec.ts` (Playwright) green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `backend/tests/unit/test_061_emit_helper.py` — covers _emit() XADD shape
- [ ] `backend/tests/unit/test_061_consumer.py` — covers two-mode XREAD loop, last_id advancement, terminal-sentinel break
- [ ] `backend/tests/unit/test_health.py` — extend with Redis-ping assertion (file may exist; verify)
- [ ] `backend/tests/integration/test_061_producer_survives_disconnect.py` — D-061-15 binding gate
- [ ] `backend/tests/integration/test_061_ttl.py` — covers SC#4 (600/60 EXPIRE)
- [ ] `backend/tests/integration/test_061_runs_table.py` — covers SC#5 (Postgres lifecycle + RLS)
- [ ] `backend/tests/integration/test_061_hard_timeout.py` — covers D-061-01 (120s timeout end-to-end)
- [ ] Rewrite `backend/tests/integration/test_059_disconnect.py::test_agent_task_cancels_on_disconnect` to assert producer SURVIVES (D-061-16). File header docstring should reference D-v2.5-08 + 061 phase as source of new contract.
- [ ] `backend/tests/conftest.py` — add `redis_client` function-scoped fixture + session-end FLUSHDB autouse fixture
- [ ] CI workflow gains `docker compose -f docker-compose.dev.yml up -d redis` before pytest
- [ ] `.planning/phases/061-run-backed-streaming-backend/061-VERIFICATION.md` — manual two-tab DevTools timing checklist mirroring 058/059 format; document the contract inversion explicitly

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Existing Supabase JWT bearer auth — `get_current_user` dependency on `POST /threads/{id}/messages`. Phase 061 makes no change. |
| V3 Session Management | yes (indirect) | The `run_id` is a UUID generated server-side; never derived from user input. RLS on `runs` filters by `auth.uid() = user_id`. Cross-user run_id leaks are blocked at the database layer. |
| V4 Access Control | yes | RLS policy `runs_select_own ON runs FOR SELECT USING (auth.uid() = user_id)` — D-061-08. Service-role bypasses RLS for backend writes. |
| V5 Input Validation | yes | `run_id` is a UUID parsed via `uuid.UUID(s)` in 062's URL handlers (out of scope here). 061 only ever generates UUIDs internally — no user input reaches Redis keys. |
| V6 Cryptography | no | Phase 061 transports no cryptographic material. Redis (local) is unauthenticated; cloud Redis (Upstash) uses TLS via `rediss://` URL — handled by redis-py automatically. |

### Known Threat Patterns for {Python async + Redis Streams + Supabase RLS}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| User attempts to read another user's run via guessed `run_id` (Phase 062 surface; relevant for Phase 061's data model) | Information Disclosure | RLS policy on `runs` (D-061-08) + UUID v4 unguessability (122 bits of entropy). |
| Redis becomes a side-channel for cross-user data leakage if key naming were derivable from user input | Information Disclosure | `run_id` is server-generated; never tied to user-controlled input. Key namespace is locked to `run:{run_id}` / `runs_by_thread:{thread_id}` / `runs:active` (REDIS-SETUP.md). |
| Resource exhaustion via deliberately-abandoned long-running streams | DoS | 120s `asyncio.timeout` per run (D-061-01) + 256MB Redis maxmemory + `allkeys-lru` eviction policy (docker-compose.dev.yml) + ZREM in finally to keep `runs:active` bounded. |
| Producer task accumulation via `RUN_TASKS` registry leak | DoS | Self-eviction in producer's `finally` + `add_done_callback` belt-and-suspenders + lifespan shutdown cancels all entries. |
| Redis credentials leaked via logs (cloud setup with `rediss://default:<password>@...`) | Information Disclosure | Standard practice: never log the full `settings.redis_url`; log only the host/port. Existing project pattern: redacting credentials from connection strings before logging. |

## Sources

### Primary (HIGH confidence)
- `redis.readthedocs.io/en/stable/examples/asyncio_examples.html` — async client lifecycle, `aclose()` requirement, all-commands-are-coroutines guarantee
- `redis.io/commands/xadd` — MAXLEN ~ semantics, "a few tens more" overshoot, trim-after-add ordering
- `redis.io/commands/xread` — `$` cutoff semantics, BLOCK behavior, COUNT limits, "use $ only on first call" warning
- `redis.io/commands/expire` — uniform TTL semantics across data types, passive + active expiration
- `docs.python.org/3/library/asyncio-task.html#asyncio.timeout` — Python 3.11+ context manager, TimeoutError-outside-the-context contract
- `pypi.org/pypi/redis/json` — current stable version 7.4.0, `requires_python>=3.10` (fetched 2026-05-02)
- Existing codebase: `backend/app/dependencies.py` (singleton pattern), `backend/app/api/threads.py:56-64` (BackgroundTask registry), `backend/app/utils/db.py` (aexec pattern), `supabase/migrations/001`/`028` (RLS + UUID PK pattern)
- `.planning/phases/061-run-backed-streaming-backend/061-CONTEXT.md` — 17 locked decisions (D-061-01..17)
- `REDIS-SETUP.md` — key namespace convention, TTL discipline, local vs cloud connection
- `docker-compose.dev.yml` — local Redis configuration

### Secondary (MEDIUM confidence)
- `github.com/redis/redis-py/issues/3230` — async ConnectionPool race in early 5.x (informs version pin lower bound)
- `tirkarthi.github.io/programming/2018/08/20/redis-streams-python.html` — practical XREAD-with-asyncio example pattern
- `oneuptime.com/blog/post/2026-01-21-redis-streams-event-sourcing` — modern (2026) event-sourcing pattern with Redis Streams (corroborates approach)
- `medium.com/@geetansh2k1/setting-up-and-using-an-async-redis-client-in-fastapi-the-right-way` — FastAPI lifespan pattern for Redis singleton

### Tertiary (LOW confidence)
- None — all critical claims verified against primary sources or codebase grep.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every package version verified against PyPI / requirements.txt
- Architecture: HIGH — 17 decisions locked in CONTEXT.md, all confirmed against current code state at the cited line numbers
- Pitfalls: MEDIUM-HIGH — six pitfalls drawn from official Redis docs, Python asyncio docs, and confirmed redis-py issue tracker; one pitfall (event-loop binding in fixtures) extrapolated from the existing sse-starlette fixture pattern

**Research date:** 2026-05-02
**Valid until:** 2026-06-01 (30 days — Redis Streams + asyncio APIs are stable; only redis-py minor versions move quickly. Re-verify the version pin before merge if PR sits longer than 30 days.)
