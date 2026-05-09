# Phase 062: Replay & Tail API — Research

**Researched:** 2026-05-03
**Domain:** FastAPI HTTP API surface over Redis Streams + Postgres lifecycle table (built on Phase 061 foundation)
**Confidence:** HIGH

## Summary

Phase 062 is an HTTP-API-shape problem on top of fully-shipped infrastructure. Phase 061 delivered the producer task, RUN_TASKS registry, `public.runs` table, Redis Stream buffer (`run:{run_id}`), TTL discipline (600s/60s), terminal-sentinel discipline (`done`/`error`/`cancelled` per `TERMINAL_TYPES`), and the two-mode XREAD consumer at `threads.py:336`. Phase 061.1 hardened that foundation: WR-01 cursor `$` race fixed, `event_consumer` lifted to module-level (importable as `app.api.threads.event_consumer`), `await_producer_finalized` test helper available, ping=None workaround for `ERR_INCOMPLETE_CHUNKED_ENCODING`. The 14 D-062-01..14 decisions in CONTEXT.md are tightly scoped — research focuses on patterns, pitfalls, and validation architecture, not exploring alternatives.

The core technical question for the planner is **disposition of DEF-061.1-02** (the producer's exception classifier may be coercing failed runs to `_terminal_status='completed'` — see `agent_runner` exception handlers at `threads.py:2057-2076`). 062 reads `runs.status` as source-of-truth in three places (active-runs filter, TTL-expired synthetic terminal event, zombie heal), so a wrong-classifier writes phantom rows into 062's surface. The recommendation below is **disposition (a) — fix the classifier in 062 as a Wave 0 / Plan 0 pre-requisite**, with disposition (b) as the fallback if investigation shows the fix is non-trivial.

The remaining unknowns are mechanical (Pydantic shape conventions, FastAPI 204 idiom, multi-consumer pytest harness) — covered below with verified answers from the codebase and current docs.

**Primary recommendation:** Plan three concrete deliverables (active-runs route in `threads.py`, new `runs.py` module with `replay_tail_consumer` + GET stream + DELETE, optional `models/run.py`), reusing `event_consumer`'s WR-01-fixed two-mode XREAD pattern verbatim with a single parameterization (`since` instead of hardcoded `"0"`). Investigate the DEF-061.1-02 classifier as Wave 0; ship a fix in 062 if it's a 1-task surface.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| List active runs for a thread | API / Backend (FastAPI route) | Database / Storage (Postgres `public.runs` SELECT WHERE status='streaming') | D-062-02 — Postgres is durable source of truth; partial index `idx_runs_active` makes this O(rows-with-streaming-status) ≈ O(1) typical case |
| Replay buffered SSE events for a run | API / Backend (`replay_tail_consumer` async generator) | Database / Storage (Redis Stream `run:{run_id}` XREAD) | D-062-05 — Redis Stream IS the buffer; consumer is a thin pull cursor over an immutable log |
| Live-tail new SSE events as producer writes | API / Backend (BLOCK 5000 XREAD loop) | Database / Storage (Redis Stream blocking read) | D-061-12 inherited — same two-mode pattern as `event_consumer`; multi-consumer fan-out is free at the Redis layer (XREAD is non-destructive) |
| Cancel an in-flight run | API / Backend (DELETE handler) | API / Backend (`RUN_TASKS[run_id].task.cancel()`) + Database (Postgres UPDATE for zombie heal) | D-062-10/11 — single-process registry per D-v2.5-02 single-worker invariant; Postgres UPDATE is the durable cancel record |
| Translate TTL-expired buffer to terminal SSE event | API / Backend (synthetic event generator) | Database / Storage (`runs.status` SELECT) + Constants (`_RUN_STATUS_TO_TERMINAL_TYPE`) | D-062-06 — Postgres outlives Redis TTL; mapping dict translates enum to wire-format type |
| Auth + ownership enforcement | API / Backend (FastAPI Depends(get_current_user) + every-query .eq("user_id", ...)) | Database / Storage (RLS policy on `public.runs` as defense-in-depth) | D-062-12 — 404-not-403 convention; backend uses service role so RLS is verification, not gating |

**Verification:** Mapping consistent with locked decisions D-062-01..14; no tier inversions detected. Active-runs explicitly does NOT touch Redis (D-062-13 differentiated degradation), and DELETE explicitly always writes Postgres regardless of Redis health (graceful degradation).

## User Constraints (from CONTEXT.md)

### Locked Decisions

The following 14 decisions from `062-CONTEXT.md` are LOCKED — research these patterns, not alternatives:

- **D-062-01** — POST `/threads/{id}/messages` is untouched. New GET stream endpoint coexists with legacy POST consumer until 063.
- **D-062-02** — `GET /threads/{thread_id}/active-runs` returns streaming-only via Postgres SELECT with partial index `idx_runs_active`.
- **D-062-03** — Active-runs items omit cursor; frontend always replays from `since=0`. Per-item shape: `{run_id, started_at, status}`.
- **D-062-04** — Active-runs response is bare JSON array `list[ActiveRunResponse]`. Empty case is `[]`.
- **D-062-05** — `GET /runs/{run_id}/stream?since={offset}` on already-terminal runs replays buffer + closes (terminal sentinel from D-061-12 is in buffer).
- **D-062-06** — TTL-expired runs emit a synthetic terminal event mapped via `_RUN_STATUS_TO_TERMINAL_TYPE`. Missing runs row → 404.
- **D-062-07** — `?since=` accepts any string; defaults to `"0"`; passed through to XREAD; XREAD `ResponseError` on malformed → 400.
- **D-062-08** — DELETE auth check fetches the runs row first via `aexec` (defense in depth alongside RLS).
- **D-062-09** — DELETE on already-terminal runs returns 204 silent (idempotent).
- **D-062-10** — DELETE happy path: `RUN_TASKS.get(run_id).cancel()` → return 204 immediately, finalization runs asynchronously via the existing `_shielded_finalize`.
- **D-062-11** — DELETE on zombie heals: UPDATE Postgres `cancelled` + synthetic terminal sentinel + ZREM × 2 + EXPIRE 60 + 204.
- **D-062-12** — Cross-user 404 (not 403). Every endpoint's first DB call applies both `.eq("run_id"|"thread_id", ...)` AND `.eq("user_id", current_user["id"])`.
- **D-062-13** — Redis-unreachable degradation differentiated: active-runs unaffected; stream returns 503 + `Retry-After: 10`; DELETE returns 204 even if all Redis ops fail.
- **D-062-14** — File layout: new `backend/app/api/runs.py` for `/runs/*`; `GET /threads/{id}/active-runs` lives in `threads.py` near `list_threads`. Mount router in `main.py`.

### Claude's Discretion

These are the planner's freedom areas (research below makes recommendations):

- Whether to extract `RUN_TASKS`/`TERMINAL_TYPES`/`_emit_terminal`/`_RUN_STATUS_TO_TERMINAL_TYPE` to a new `_run_registry.py` (cleaner imports) vs. importing directly from `app.api.threads` (smaller diff). **Recommendation: import directly** — see Architecture Patterns below.
- Pydantic model location: new `backend/app/models/run.py` vs inlined in `runs.py`. **Recommendation: new `models/run.py`** for symmetry with existing `models/thread.py`, `models/message.py`.
- Whether `replay_tail_consumer` is nested inside the route handler (closure-captured) or module-level. **Recommendation: module-level** — Phase 061.1 IN-04 lifted `event_consumer` to module level for testability; 062 should follow the same convention.
- Exact `Retry-After` value on 503 path (`10` recommended).
- Test fixture organization — extend existing `_run_helpers.py` vs new `_062_helpers.py`. **Recommendation: extend existing.**
- 204 response idiom: `Response(status_code=204)` vs `status.HTTP_204_NO_CONTENT` (matches `delete_thread:380`). **Recommendation: latter** for consistency.
- `error` field discriminator string for synthetic TTL-expired terminal event — `"buffer_expired"` (recommended).
- Active-runs query `ORDER BY started_at DESC` (recommended; otherwise undefined under concurrent INSERTs).

### Deferred Ideas (OUT OF SCOPE)

- `?include_terminal=true` variant of active-runs.
- Cursor-aware response from active-runs (`last_stream_id` field).
- Wrapped response shape `{runs: [...], thread_id: '...'}`.
- `410 Gone` / `409 Conflict` on zombie DELETE.
- Uniform 503 across all endpoints when Redis is down.
- POST→JSON cut + delete inline `event_consumer()` at `threads.py:2065` — Phase 063.
- Consumer unification (`event_consumer` and `replay_tail_consumer` collapse) — Phase 063.
- `RUN_TASKS` extraction to `_run_registry.py` — discretion only, recommended NOT to do in 062.
- Cross-worker coordination if uvicorn ever scales beyond `--workers 1` — D-v2.5-02.
- Sweeper task for stale `runs:active` / `runs_by_thread:{id}` sorted-set entries.
- `Retry-After` header tuning beyond `10`.
- OpenAPI schema metadata polish.
- Multi-tab E2E browser-MCP validation — Phase 064.
- Resume button for `failed` runs — Phase 063 (frontend).

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| STREAM-04 (API layer) | "A streaming response survives client navigation, refresh, and multi-tab access." Implementation in 062: `GET /threads/{id}/active-runs`, `GET /runs/{id}/stream?since={offset}` replay-and-tail, `DELETE /runs/{id}` cancel verb. RLS-enforced auth. | This research details: (a) the proven WR-01-fixed two-mode XREAD pattern from `threads.py:336-423` to mirror in `replay_tail_consumer`, (b) the multi-consumer fan-out mechanism (XREAD is non-destructive — D-061-12 inherited), (c) the synthetic-terminal-event pattern for TTL-expired buffers (D-062-06), (d) the validation architecture covering all 9 ROADMAP SC#1-6 surfaces. |

## Project Constraints (from CLAUDE.md)

The following CLAUDE.md directives directly constrain 062's plan:

| Directive | How 062 Honors It |
|-----------|-------------------|
| Python backend uses `venv` virtual environment | All bash commands in plans assume `backend/venv/Scripts/python` (Windows) — verifier already enforces |
| No LangChain, no LangGraph — raw SDK calls only | 062 introduces no LLM call sites — pure HTTP + Redis + Postgres |
| All tables need RLS — users only see their own data | `public.runs` already has SELECT-only RLS policy `runs_select_own` (migration 035, D-061-08); 062 endpoints all add `.eq("user_id", current_user["id"])` defense-in-depth (D-062-12) |
| Stream chat responses via SSE | `GET /runs/{id}/stream` uses `EventSourceResponse(replay_tail_consumer(...), ping=None)` — wire format byte-identical to 061 |
| Stateless chat completions | 062 endpoints are stateless except for `RUN_TASKS` in-process registry (D-061-11 — single-worker per D-v2.5-02) |
| Schema changes ship as numbered SQL migrations under `supabase/migrations/` | **062 ships ZERO migrations** — `public.runs` already exists from migration 035. Any plan suggesting a new migration is a scope-creep red flag |
| Supabase Realtime is a best-effort hint, not source of truth | 062 doesn't use Realtime. Postgres `public.runs` is the source of truth |
| Do not run blocking I/O inside async handlers — wrap with `run_in_threadpool` | All 062 supabase calls go through `aexec` (D-058-03) — see `backend/app/utils/db.py:32-44` |
| Single uvicorn worker | `RUN_TASKS` registry is per-process; DELETE is in-process lookup (D-062-10) |
| Settings live in `user_settings` / `app_settings` | 062 introduces no new settings; `RUN_HARD_TIMEOUT_SECONDS` already in `Settings` per Phase 061 |

**No CLAUDE.md directive contradicts any locked D-062 decision.** All 14 decisions are CLAUDE.md-compatible.

## Standard Stack

### Core (already shipped — 062 introduces ZERO new dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| FastAPI | 0.115.6 | HTTP routing, Pydantic validation, dependency injection | `[VERIFIED: backend/requirements.txt:1]` — already in use; 062's three new routes are FastAPI `APIRouter` calls |
| sse-starlette | 2.4.1 | SSE response with consumer-disconnect handling | `[VERIFIED: backend/requirements.txt:2]` — `EventSourceResponse(generator, ping=None)` pattern from `threads.py:2183-2186` (D-061.1-04 H2 fix) |
| redis-py | 5.3.1 (constraint `>=5.2,<6`) | Async Redis client with Streams support | `[VERIFIED: backend/requirements.txt:18; pip index versions redis]` — `redis.asyncio.from_url` returns `redis.asyncio.Redis`. 7.4.0 is current stable; the project pinned `<6` in 061.1 (WR-07) for predictability |
| supabase-py | 2.10.0 | Postgres + Auth client | `[VERIFIED: backend/requirements.txt:4]` — sync API wrapped via `aexec` (D-058-03) |
| pydantic | (ships with FastAPI) | Request/response model validation | `[VERIFIED: backend/app/models/thread.py]` — used everywhere |
| pytest-asyncio | >=0.24.0 | Async test fixtures (`asyncio_mode = auto`) | `[VERIFIED: backend/requirements.txt:20]` |
| pytest-timeout | >=2.4.0 | Bounds runaway tests | `[VERIFIED: backend/requirements.txt:21]` — used as `@pytest.mark.timeout(15)` in all 061 integration tests |
| httpx | >=0.27.0 | ASGI test transport for integration tests | `[VERIFIED: backend/requirements.txt:22]` |

### Supporting (already shipped)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `app.utils.db.aexec` | local helper | Wraps sync supabase `.execute()` in `run_in_threadpool` | Every supabase call in async handlers (D-058-03) |
| `app.dependencies.get_redis` | local | Singleton `redis.asyncio.Redis` with `decode_responses=True`, `socket_timeout=10`, `socket_connect_timeout=5` | All 062 routes declare `redis: aioredis.Redis = Depends(get_redis)` |
| `app.dependencies.get_supabase` | local | Singleton `supabase.Client` (sync; wrap via aexec in async paths) | All 062 DB-touching routes |
| `app.dependencies.get_current_user` | local | Validates Bearer token via Supabase Auth, returns `{"id": ..., "email": ...}` | All 062 routes (auth gate) |
| `app.api.threads.event_consumer` | local (D-061.1-10) | Module-level two-mode XREAD generator | **Reference implementation** for 062's `replay_tail_consumer` (mirror with `since` parameterization) |
| `app.api.threads.RUN_TASKS` | local registry | `dict[UUID, asyncio.Task]` of in-flight producers | DELETE handler imports + `.get(run_id)` lookup |
| `app.api.threads.TERMINAL_TYPES` | local frozenset | `{"done", "error", "cancelled"}` | Consumer break check + DELETE zombie heal type guard |
| `app.api.threads._emit_terminal` | local helper | Terminal sentinel XADD (no MAXLEN) | Zombie heal path (D-062-11 step 2) |
| `app.api.threads._RUN_STATUS_TO_TERMINAL_TYPE` | local dict | `{"completed":"done", "failed":"error", "cancelled":"cancelled"}` | TTL-expired synthetic terminal mapping (D-062-06) and finalize (already used in producer's `_shielded_finalize` per 061-VERIFICATION.md) |

### Alternatives Considered (rejected by upstream decisions — do NOT explore)

| Instead of | Could Use | Why Rejected |
|------------|-----------|--------------|
| Postgres `runs` SELECT for active-runs | Redis sorted-set ZRANGE on `runs:active` / `runs_by_thread:{id}` | D-062-02 — Postgres is durable source of truth, partial `idx_runs_active` index makes it cheap, sorted-set entries can be stale (passive cleanup per D-061 deferred list). Redis sorted set is index-only and only used during run lifecycle bookkeeping. |
| Custom XREAD wrapper | `redis-py` `xread()` directly | redis-py's API is the canonical surface; no wrapper needed |
| Cross-process registry (Redis Pub/Sub) | In-process `RUN_TASKS` dict | D-v2.5-02 — single uvicorn worker; cross-worker coordination explicitly deferred |
| `EventSource`/`Last-Event-Id` browser semantics for replay | Custom `?since={offset}` query param | REQUIREMENTS.md "Out of Scope" — `EventSource` is read-only GET, blocked by auth headers |
| Fakeredis test substrate | Real Redis via docker-compose | D-061-14 — Streams semantics drift in fakeredis; UUID-based isolation per D-061-17 keeps real Redis tests sound |

**Installation:** None — all dependencies ship in 061.

**Version verification:**
- `redis-py 5.3.1` installed against constraint `>=5.2,<6` — `[VERIFIED: pip index versions redis 2026-05-03]` shows 5.3.1 within the pin window; 7.4.0 is current upstream stable but the project deliberately stays on the 5.x branch.
- `sse-starlette 2.4.1` pinned exactly — `[VERIFIED: backend/requirements.txt:2]`. `test_059_disconnect.py:82-88` asserts `__version__.startswith("2.4.")` — bumping requires re-validating the AppStatus reset fixture.

## Architecture Patterns

### System Architecture Diagram

```
                ┌────────────────────────────────────────────────────┐
                │ Frontend (063 — out of scope here)                 │
                │                                                    │
                │  on (re)connect: GET /threads/{id}/active-runs     │
                │  found run? → GET /runs/{run_id}/stream?since=0    │
                │  user clicks Stop → DELETE /runs/{run_id}          │
                └─────────┬──────────────────┬───────────────────────┘
                          │                  │
                          ▼                  ▼
   ┌──────────────────────────────────────────────────────────────┐
   │ FastAPI app (single uvicorn worker — D-v2.5-02)              │
   │                                                              │
   │  ┌────────────────────────┐    ┌────────────────────────┐   │
   │  │ threads.py (existing)  │    │ runs.py (NEW — 062)    │   │
   │  │                        │    │                        │   │
   │  │ POST  /threads/{id}/   │    │ GET    /runs/{id}/     │   │
   │  │       messages         │    │        stream?since=N  │   │
   │  │   (untouched)          │    │ DELETE /runs/{id}      │   │
   │  │                        │    │                        │   │
   │  │ GET   /threads/{id}/   │    │ replay_tail_consumer() │   │
   │  │       active-runs (NEW)│    │   (mirrors 061's       │   │
   │  │                        │    │    event_consumer w/   │   │
   │  │ event_consumer()       │    │    `since` parameter)  │   │
   │  │ RUN_TASKS dict ────────┼────┤ DELETE: .get + cancel  │   │
   │  │ TERMINAL_TYPES ────────┼────┤ + zombie heal Postgres │   │
   │  │ _emit_terminal ────────┼────┤ + zombie heal Redis    │   │
   │  │ _RUN_STATUS_TO_........│    │                        │   │
   │  │  TERMINAL_TYPE ────────┼────┤ TTL-expired synthetic  │   │
   │  │                        │    │   terminal event       │   │
   │  └────────────────────────┘    └────────────────────────┘   │
   │              │                          │                   │
   │              │                          │                   │
   └──────────────┼──────────────────────────┼───────────────────┘
                  │                          │
                  ▼                          ▼
       ┌──────────────────┐       ┌──────────────────────────┐
       │ Postgres         │       │ Redis (Streams)          │
       │ (Supabase)       │       │                          │
       │                  │       │ run:{run_id}             │
       │ public.runs      │       │   ─ XADD by producer     │
       │  status=         │       │   ─ XREAD by consumers   │
       │   streaming|     │       │   ─ EXPIRE 600/60 in     │
       │   completed|     │       │     producer.finally     │
       │   failed|        │       │                          │
       │   cancelled      │       │ runs:active (sorted set) │
       │                  │       │ runs_by_thread:{tid}     │
       │ idx_runs_active  │       │   (sorted set; passive   │
       │  partial idx     │       │    cleanup per D-061)    │
       │  WHERE status=   │       │                          │
       │   'streaming'    │       └──────────────────────────┘
       │                  │
       │ RLS:             │       Note: a 062 GET stream and
       │  runs_select_own │       061's POST consumer can both
       │  (auth.uid =     │       XREAD the same run:{id}
       │   user_id)       │       independently — XREAD is
       └──────────────────┘       non-destructive, multi-consumer
                                  fan-out is free.
```

### Data flow — three endpoints

**`GET /threads/{thread_id}/active-runs` (D-062-02, lives in `threads.py`):**
1. Auth → ownership SELECT on `threads` (mirror `get_messages:597-606`).
2. SELECT `run_id, started_at, status FROM public.runs WHERE thread_id=? AND user_id=? AND status='streaming' ORDER BY started_at DESC` via `aexec`.
3. Return `[{run_id, started_at, status}]` as `list[ActiveRunResponse]`.
4. Empty case: `[]`. Cross-user case: `[]` (RLS+`.eq("user_id", ...)` filters it out).
5. Redis is **not touched** (D-062-13).

**`GET /runs/{run_id}/stream?since={offset}` (D-062-05/06/07, lives in `runs.py`):**
1. Auth → ownership SELECT on `runs` via `aexec` (D-062-08-style, with `maybe_single()`).
2. If row missing → 404.
3. `if await redis.exists(f"run:{run_id}")`: return `EventSourceResponse(replay_tail_consumer(redis, run_id, since), ping=None)`.
4. Else (TTL expired): map `runs.status` via `_RUN_STATUS_TO_TERMINAL_TYPE` and yield exactly one synthetic SSE event with `{type: <mapped>, error: "buffer_expired", runs_status: <orig>}`. (D-062-06)
5. On Redis unreachable: 503 with `Retry-After: 10` header (D-062-13).
6. On malformed `since` (XREAD `ResponseError`): 400.

**`DELETE /runs/{run_id}` (D-062-08/09/10/11/12/13, lives in `runs.py`):**
1. Auth → SELECT run row (D-062-08); 404 if missing.
2. If `status in {completed, failed, cancelled}`: 204 silent (D-062-09).
3. If `RUN_TASKS.get(run_id)` exists:
   - `task.cancel()` (no `await task`)
   - Producer's existing `CancelledError` handler at `threads.py:2065-2070` sets `_terminal_status='cancelled'`; the `_shielded_finalize` runs the rest async.
   - 204.
4. If `RUN_TASKS.get(run_id)` is None (zombie — `runs.status='streaming'` but task missing per process restart / producer death):
   - UPDATE Postgres: `status='cancelled', error='cancelled_by_user', completed_at='now()'`
   - `if await redis.exists(f"run:{run_id}")`: `await _emit_terminal(redis, run_id, "cancelled", reason="zombie_healed")`
   - `await redis.zrem("runs:active", str(run_id))` and `await redis.zrem(f"runs_by_thread:{thread_id}", str(run_id))` (each in try/except)
   - `await redis.expire(f"run:{run_id}", 60)` (try/except)
   - 204.
5. All Redis ops in try/except + `logger.exception` — DELETE returns 204 even if Redis is fully down.

### Recommended Project Structure

```
backend/app/
├── api/
│   ├── threads.py              # MODIFIED: append GET /threads/{id}/active-runs
│   │                           #   near list_threads at line 426
│   │                           # DO NOT modify event_consumer, agent_runner,
│   │                           #   _shielded_finalize, send_message
│   └── runs.py                 # NEW: APIRouter(prefix="/runs", tags=["runs"])
│                               #   - replay_tail_consumer() module-level async generator
│                               #   - GET  /runs/{run_id}/stream
│                               #   - DELETE /runs/{run_id}
│                               # Imports from app.api.threads:
│                               #   RUN_TASKS, TERMINAL_TYPES, _emit_terminal,
│                               #   _RUN_STATUS_TO_TERMINAL_TYPE
├── models/
│   └── run.py                  # NEW: ActiveRunResponse(BaseModel)
├── main.py                     # MODIFIED: app.include_router(runs.router)
└── dependencies.py             # UNTOUCHED — get_redis/get_supabase/get_current_user
                                # already exist
```

`backend/tests/integration/`:
- New: `test_062_active_runs.py`, `test_062_stream_replay.py`, `test_062_stream_terminal.py`, `test_062_stream_ttl_expired.py`, `test_062_delete_happy.py`, `test_062_delete_zombie.py`, `test_062_delete_terminal_idempotent.py`, `test_062_cross_user_404.py`, `test_062_multi_consumer_fanout.py`.
- Modified: `_run_helpers.py` — add helpers as needed (multi-consumer harness, zombie-state setup).
- All reuse `redis_client` fixture (`conftest.py:174-199`) and `_flushdb_at_session_end` (`conftest.py:202-224`).

### Pattern 1: Active-Runs Route (replicates `list_threads` shape)

**What:** Bare `list[ResponseModel]` GET with auth + ownership.
**When to use:** D-062-04 — every active-runs response is a bare JSON array.
**Example:**
```python
# Source: pattern from threads.py:426-444 (list_threads), adapted for runs.
# In threads.py — append near line 426 per D-062-14.
@router.get("/{thread_id}/active-runs", response_model=list[ActiveRunResponse])
async def list_active_runs(
    thread_id: UUID,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    # Ownership check — mirror get_messages:597-606
    thread = await aexec(
        supabase.table("threads")
        .select("id")
        .eq("id", str(thread_id))
        .eq("user_id", current_user["id"])
        .single()
    )
    if not thread.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Thread not found")

    # D-062-02: streaming-only filter; partial index idx_runs_active
    response = await aexec(
        supabase.table("runs")
        .select("run_id, started_at, status")
        .eq("thread_id", str(thread_id))
        .eq("user_id", current_user["id"])
        .eq("status", "streaming")
        .order("started_at", desc=True)
    )
    return response.data or []
```

### Pattern 2: `replay_tail_consumer` (mirrors `event_consumer`)

**What:** Module-level async generator — two-mode XREAD with `since` cursor parameterization.
**When to use:** Inside `EventSourceResponse(replay_tail_consumer(redis, run_id, since), ping=None)` for `GET /runs/{id}/stream`.
**Example:**
```python
# Source: app.api.threads.event_consumer at threads.py:336-423.
# Differences from event_consumer:
#   1. last_id starts at `since` (not hardcoded "0")
#   2. Otherwise structurally identical — same WR-01 fix (carry last_id forward,
#      no `$` reset); same TERMINAL_TYPES break; same deadline = run_hard_timeout_seconds + 10;
#      same H1 wrapper convention.
async def replay_tail_consumer(
    redis,
    run_id: UUID,
    since: str = "0",
    settings = None,  # passed in or imported from app.config
):
    """Two-mode XREAD consumer with `since` cursor (062's analogue of event_consumer).

    Phase 062 (D-062-05/D-061-12 inherited). Killing the consumer does NOT
    kill the producer — finally is no-op (D-061-03).
    """
    stream_key = f"run:{run_id}"
    last_id = since
    deadline = time_mod.monotonic() + settings.run_hard_timeout_seconds + 10

    try:
        # Phase 1: replay from `since` (no block; immediate return)
        while True:
            if time_mod.monotonic() > deadline:
                yield {"data": json.dumps({"type": "error", "error": "consumer_timeout"})}
                return
            result = await redis.xread(streams={stream_key: last_id}, count=100)
            if not result:
                break
            for _stream_name, entries in result:
                for entry_id, fields in entries:
                    last_id = entry_id  # advance cursor (Pitfall 1)
                    yield {"data": fields["data"]}
                    if json.loads(fields["data"]).get("type") in TERMINAL_TYPES:
                        return

        # Phase 2: live-tail (BLOCK 5000) — WR-01 fix: carry last_id, no `$` reset
        while True:
            if time_mod.monotonic() > deadline:
                yield {"data": json.dumps({"type": "error", "error": "consumer_timeout"})}
                return
            result = await redis.xread(streams={stream_key: last_id}, count=100, block=5000)
            if not result:  # block timeout, no new entries
                continue
            for _stream_name, entries in result:
                for entry_id, fields in entries:
                    last_id = entry_id
                    yield {"data": fields["data"]}
                    if json.loads(fields["data"]).get("type") in TERMINAL_TYPES:
                        return
    finally:
        # D-061-03 inherited: do NOT cancel the producer here.
        pass
```

**Key invariant:** `replay_tail_consumer` is a pure read — it XREADs from a stream that someone else writes to, and its `finally` is a no-op. It can run concurrently with 061's `event_consumer` and any number of other `replay_tail_consumer` instances on the same `run_id`. Multi-consumer fan-out is implicit at the Redis layer (XREAD doesn't consume entries — they're a non-destructive cursor read). `[VERIFIED: redis.io/docs/latest/commands/xread]`

### Pattern 3: DELETE with Zombie Heal

**What:** Idempotent DELETE that handles three cases (terminal/happy/zombie) uniformly.
**When to use:** `DELETE /runs/{run_id}` per D-062-08/09/10/11/13.
**Example skeleton:**
```python
# Source: D-062-08..13 + app.api.threads:619-658 (ZADD pattern mirror)
@router.delete("/{run_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
async def cancel_run(
    run_id: UUID,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
    redis: aioredis.Redis = Depends(get_redis),
):
    # 1. Auth + ownership SELECT (D-062-08)
    row_resp = await aexec(
        supabase.table("runs")
        .select("run_id, status, thread_id")
        .eq("run_id", str(run_id))
        .eq("user_id", current_user["id"])
        .maybe_single()
    )
    row = row_resp.data
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Run not found")

    # 2. Already-terminal — silent 204 (D-062-09)
    if row["status"] in ("completed", "failed", "cancelled"):
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    # 3. Happy path — task in registry (D-062-10)
    task = RUN_TASKS.get(run_id)
    if task is not None and not task.done():
        task.cancel()  # NOT awaited; producer's CancelledError handler + _shielded_finalize handle the rest
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    # 4. Zombie heal (D-062-11)
    thread_id = row["thread_id"]
    try:
        await aexec(
            supabase.table("runs").update({
                "status": "cancelled",
                "error": "cancelled_by_user",
                "completed_at": "now()",
            }).eq("run_id", str(run_id))
        )
    except Exception:
        logger.exception("Zombie heal Postgres UPDATE failed for run %s", run_id)
        # D-062-13: still return 204 — Postgres write best-effort within zombie path

    # Redis ops — each best-effort (D-062-13)
    try:
        if await redis.exists(f"run:{run_id}"):
            await _emit_terminal(redis, run_id, "cancelled", reason="zombie_healed")
    except Exception:
        logger.exception("Zombie heal terminal sentinel failed for run %s", run_id)
    try:
        await redis.zrem("runs:active", str(run_id))
    except Exception:
        logger.exception("Zombie heal ZREM runs:active failed for run %s", run_id)
    try:
        await redis.zrem(f"runs_by_thread:{thread_id}", str(run_id))
    except Exception:
        logger.exception("Zombie heal ZREM runs_by_thread failed for run %s", run_id)
    try:
        await redis.expire(f"run:{run_id}", 60)
    except Exception:
        logger.exception("Zombie heal EXPIRE failed for run %s", run_id)

    return Response(status_code=status.HTTP_204_NO_CONTENT)
```

### Pattern 4: TTL-Expired Synthetic Terminal

**What:** A single-yield async generator that emits one synthetic terminal SSE event when the buffer is gone.
**When to use:** `GET /runs/{id}/stream` when `await redis.exists(f"run:{run_id}")` returns 0 but the runs row exists (D-062-06).
**Example:**
```python
async def synthetic_terminal_generator(runs_status: str, runs_error: str | None):
    """Yield exactly one synthetic terminal SSE event then close.

    Maps runs.status enum to TERMINAL_TYPES via _RUN_STATUS_TO_TERMINAL_TYPE.
    Defensive case: 'streaming' shouldn't be observed on this path; fall back to error.
    """
    mapped = _RUN_STATUS_TO_TERMINAL_TYPE.get(runs_status)
    if mapped is None:
        # status='streaming' but Redis key missing — defensive case
        yield {"data": json.dumps({
            "type": "error",
            "error": "buffer_expired_while_streaming",
            "runs_status": runs_status,
        })}
        return
    yield {"data": json.dumps({
        "type": mapped,
        "error": "buffer_expired",
        "runs_status": runs_status,
        "runs_error": runs_error,
    })}
```

### Anti-Patterns to Avoid

- **Modifying `event_consumer`, `agent_runner`, `_shielded_finalize`, `send_message`, `_emit`, `_emit_terminal`, or anything in the producer-side path.** D-062-14 file layout exists to physically prevent this. Phase 061.1 already shipped — but parallel cleanup work in those code regions is hazardous; 062 stays out for diff-conflict avoidance and to preserve the locked invariants.
- **Adding a new migration.** D-062 ships ZERO migrations. `public.runs` already exists from migration 035. Any plan suggesting `036_*.sql` is a scope-creep red flag.
- **Modifying ANY of D-061-01..17.** All locked architectural invariants from 061 carry forward. Most importantly: D-061-03 (consumer disconnect MUST NOT cancel producer) — 062's `replay_tail_consumer.finally` MUST be `pass`.
- **`asyncio.shield` in 062 endpoints.** No producer-side critical sections in 062's code path; HTTP request cancellation doesn't risk a partial DB write. The DELETE handler does NOT await `task` — fire-and-forget the cancellation.
- **Long-polling or `Last-Event-Id` semantics.** REQUIREMENTS.md "Out of Scope" — `?since={offset}` is the one cursor mechanism; frontend always passes `0` per D-062-03.
- **Catching specific Redis exceptions narrowly.** Use `redis.exceptions.RedisError` at the route boundary plus `BaseException` in best-effort blocks (matches existing pattern at `threads.py:2104-2138`). Don't try to enumerate every transient exception class.
- **Reusing `event_consumer` directly.** It hardcodes `last_id = "0"` in its body — `replay_tail_consumer` needs the `since` parameter. Two functions in parallel is intentional per D-062-01 / 063 deferred unification.
- **Returning `{run_id, current_offset}` from active-runs.** D-062-03 explicitly omits `current_offset`. Do not add it back.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Multi-consumer SSE fan-out | A custom asyncio.Queue + per-tab subscriber dict | Redis Stream + multiple `XREAD` consumers — non-destructive | XREAD returns the same entries to every reader independently; no broadcast logic needed `[VERIFIED: redis.io/docs/latest/commands/xread]` |
| Cancellation of an asyncio task across requests | Cross-process Redis Pub/Sub | `RUN_TASKS[run_id].cancel()` — single-process registry per D-v2.5-02 | Single uvicorn worker invariant; in-process dict lookup is microseconds |
| SSE response framing | Manual `data: ...\n\n` writing in route | `EventSourceResponse(generator, ping=None)` from sse-starlette 2.4.1 | Already in use, properly handles disconnect; `ping=None` per D-061.1-04 H2 fix to avoid `ERR_INCOMPLETE_CHUNKED_ENCODING` |
| Run ownership / RLS enforcement | Custom RBAC layer | Supabase RLS + `.eq("user_id", current_user["id"])` defense in depth | Migration 035 already shipped policy `runs_select_own`; service-role bypasses for backend writes per D-061-08 |
| Zombie detection (process restart between INSERT and producer.finally) | Periodic sweeper task | Lazy detection at DELETE time per D-062-11 | Simpler; abandoned-run sweeper deferred per D-061-02 — Postgres `runs.status='streaming'` is the durability anchor |
| 204 No Content response | Returning `None` from a JSONResponse-default route | `Response(status_code=status.HTTP_204_NO_CONTENT, response_class=Response)` per FastAPI canonical pattern | FastAPI default JSONResponse converts `None` → `"null"` body which violates RFC 2616 for 204 `[CITED: github.com/fastapi/fastapi/issues/717]` |
| TTL math for completed/failed buffers | Custom expiry tracking | `redis.expire(key, 600 or 60)` per D-061-04 already in producer's `_shielded_finalize` | Already shipped; 062's DELETE zombie path mirrors with EXPIRE 60 (failed/cancelled bucket) |
| Auth token validation | Custom JWT decode | `get_current_user` dependency at `dependencies.py:47-58` | Already in use everywhere |

**Key insight:** Every component 062 needs is already in the codebase or in a maintained library. The phase is API-shape work, not infrastructure work. The only judgment call is the disposition of DEF-061.1-02 (classifier bug) — see Open Questions below.

## Runtime State Inventory

> Phase 062 is a **greenfield API surface** — adds new code paths, no rename / refactor. Skipping the full rename/refactor inventory is appropriate, but each category is checked explicitly below for completeness:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — 062 reads/writes existing `public.runs` rows and `run:{run_id}` Stream entries that 061 already creates. No new key namespaces, no new tables. | None — verified by reading 061 producer code at `threads.py:619-658, 757-2156` |
| Live service config | None — no n8n/Datadog/Tailscale/etc. external services referenced. The Supabase RLS policy `runs_select_own` is the only live config and it's checked-in via migration 035. | None |
| OS-registered state | None — no Task Scheduler / launchd / systemd / pm2 entries. The single uvicorn worker (D-v2.5-02) is launched manually via `uvicorn app.main:app --reload --port 8000`. | None |
| Secrets/env vars | None new. `REDIS_URL` and `RUN_HARD_TIMEOUT_SECONDS` already in `Settings` from 061. | None |
| Build artifacts | None — pure Python, no compiled artifacts. `pip install -e backend` not used; backend runs from source. | None |

**Nothing-found explanation:** 062 introduces three new HTTP endpoints and one new Pydantic model. Zero infrastructure changes. The runtime state inventory is intentionally null.

## Common Pitfalls

### Pitfall 1: WR-01 Cursor `$` Race (already fixed in event_consumer; mirror the fix verbatim)

**What goes wrong:** Replay phase drains empty (no backlog), tail phase resets `last_id = "$"`, producer XADDs an entry between the two `xread` calls, the entry is silently missed (XREAD `$` returns only entries arriving AFTER the call).
**Why it happens:** `$` semantics in Redis: "everything strictly greater than current head id at call time."
**How to avoid:** Carry `last_id` forward from replay (or stay at `since` if replay drained empty). XREAD with a past id + BLOCK still returns only NEW entries.
**Warning signs:** A consumer hangs until `RUN_HARD_TIMEOUT_SECONDS + 10` deadline; XLEN shows entries the consumer never yielded.
**Source:** `[VERIFIED: backend/app/api/threads.py:387-403]` — comment at line 387-392 records the fix; regression tests at `backend/tests/integration/test_061_consumer_cursor_race.py`. 062's `replay_tail_consumer` MUST use the same carry-forward pattern.

### Pitfall 2: TERMINAL_TYPES Wire-Format Mismatch (DEF-061.1-01)

**What goes wrong:** A test or frontend asserts on `stream_end` (older 058/059-era event name), but Phase 061's TERMINAL_TYPES is `frozenset({"done", "error", "cancelled"})`. The producer emits `stream_end` as a non-terminal event but `done` as the terminal sentinel; the consumer breaks on `done` so `stream_end` is in Redis but never delivered to the SSE response.
**Why it happens:** Naming drift across phases — 058/059 used `stream_end`, 061 standardized on `done`.
**How to avoid:** All 062 tests assert TERMINAL_TYPES values exactly: `done` / `error` / `cancelled`. Never `stream_end`, never `complete`, never `finished`. Frontend wire-format (063) will use the same set.
**Warning signs:** Test logs show `Expected 'stream_end' event in stream; got types=['iteration_start', 'delta', 'delta', 'delta', 'done']`.
**Source:** `[VERIFIED: .planning/phases/061.1-run-backed-streaming-cleanup/deferred-items.md DEF-061.1-01]`. CONTEXT.md flags this as a wire-format pitfall for 062.

### Pitfall 3: DEF-061.1-02 Producer Exception Classifier — POTENTIALLY-WRONG `_terminal_status`

**What goes wrong:** The producer's exception classifier at `threads.py:2057-2076` may coerce certain LLM exceptions into `_terminal_status='completed'` when they should be `'failed'`. The 5-step `_shielded_finalize` at `threads.py:2087-2138` then writes wrong status to Postgres + applies wrong TTL bucket (600s "completed" instead of 60s "failed/cancelled").
**Why it matters for 062:**
- `GET /threads/{id}/active-runs` filters by `runs.status='streaming'`. If a failed run was misclassified to `completed`, it won't appear in active-runs (correct UX side-effect, wrong audit data). If a failed run was misclassified back into a non-terminal state due to the inverse bug, it could appear as a phantom "streaming" row.
- `GET /runs/{id}/stream` TTL-expired path maps `runs.status` → terminal type. Wrong status → wrong synthetic terminal event (e.g., user sees `done` when run actually failed).
- DELETE zombie heal UPDATEs `status='cancelled'`. If classifier wrote `'completed'` first, the cancel UPDATE may be racy or no-op (and silently inconsistent with what the user sees in the UI).

**How to avoid:**
1. **Investigate** by running `pytest backend/tests/integration/test_061_ttl.py::test_failed_run_expires_60s -x` against current `threads.py` and inspecting `mock_supabase.table("runs").update.call_args_list` to see what `status` value the producer writes when the LLM raises a stock `Exception`.
2. **Decide disposition (CONTEXT.md gives three options):**
   - **(a) Fix in 062 as Plan 0 / Wave 0 prerequisite.** Recommended if investigation reveals a 1-line fix in the exception handler. 062's contract depends on `runs.status` being correct.
   - **(b) Insert a 061.2 cleanup phase via `/gsd:insert-phase 061.2`.** Use only if classifier fix is a multi-task surface that warrants its own atomic phase.
   - **(c) Defer further** if investigation shows the classifier IS correct and the 3 failing tests fail for an orthogonal reason (e.g., test mock raises wrong exception class). Update `deferred-items.md` with actual root cause.
3. **In all dispositions: 062's baseline regression sweep MUST honor the canonical `-k "not (test_normal_stream_unchanged or test_failed_run_expires_60s or test_120s_timeout_fires_full_finally or test_producer_continues_after_consumer_disconnect)"` filter from 061.1's plan files until disposition is resolved.**

**Warning signs:** Tests asserting `runs.status='failed'` after a simulated LLM exception fail with `'completed'` actual; TTL on a failed-run Stream key reports 600 instead of 30-60 range.
**Source:** `[VERIFIED: .planning/phases/061.1-run-backed-streaming-cleanup/deferred-items.md DEF-061.1-02]`.

### Pitfall 4: redis-py XREAD BLOCK Returns None vs. Empty List

**What goes wrong:** Code that branches on `if not result: ...` may behave inconsistently across redis-py versions or Redis server versions (`None` vs `[]` on BLOCK timeout).
**Why it happens:** Redis CLI returns null reply on BLOCK timeout; redis-py wrappers normalize, but legacy code paths exist.
**How to avoid:** `if not result: continue` (replay phase) or `if not result: break` (live-tail phase) — the falsy check covers both `None` and `[]`. This matches the existing pattern at `threads.py:370, 402-403`.
**Warning signs:** Consumer enters infinite loop, or yields a synthetic error from a `for` loop iterating a `None` value.
**Source:** `[CITED: redis.readthedocs.io/en/stable/_modules/redis/asyncio/client.html]`. Pattern verified at `threads.py:370,402` (existing `event_consumer`).

### Pitfall 5: Connection Pool Exhaustion Under Multi-Consumer Fan-Out

**What goes wrong:** Multiple long-lived `replay_tail_consumer` instances each hold a Redis connection for their `XREAD BLOCK` cycle. If many tabs reattach to the same run, you can exhaust the connection pool.
**Why it happens:** Each `XREAD BLOCK 5000` ties up a connection for 5s. The default redis-py connection pool size is 10 (`max_connections=10` if unset).
**How to avoid:** Singleton `get_redis()` already uses `from_url` which spins up a fresh pool. Phase 061 didn't set `max_connections`. Document and revisit if multi-tab production load shows pool exhaustion. Phase 064 harness can probe this by spinning up N parallel consumers on one `run_id`. **For 062 itself: monitor in test, document for ops.**
**Warning signs:** `redis.exceptions.ConnectionError: Too many connections` in production logs.
**Source:** `[CITED: redis.readthedocs.io/en/stable/connections.html#connectionpool]`. Mitigation deferred — out of 062 scope per "Out of Scope" boundary.

### Pitfall 6: Cross-User Information Leak via 403 vs 404

**What goes wrong:** Returning 403 on cross-user access leaks the existence of the resource (user B can probe to discover that run X exists for user A).
**Why it happens:** Naive RBAC defaults to "user has no permission for this resource" (403) instead of "this resource doesn't exist for this user" (404).
**How to avoid:** D-062-12 — every 062 query applies BOTH `.eq("run_id"|"thread_id", ...)` AND `.eq("user_id", current_user["id"])`. No row → 404. Same convention as `get_messages:606`.
**Warning signs:** A 403 status code anywhere in 062 endpoints.
**Source:** `[VERIFIED: backend/app/api/threads.py:586-606]` — established convention. CONTEXT.md D-062-12.

### Pitfall 7: SSE Test Hang via httpx.AsyncClient + ASGITransport

**What goes wrong:** Tests using `async with c.stream("GET", ...)` against an SSE endpoint hang forever because both test code and server code share the same asyncio loop.
**Why it happens:** The server's `EventSourceResponse` is BLOCK-XREADing inside the test loop; the test's `aiter_lines()` is awaiting the same loop's slot.
**How to avoid:** All 061 integration tests already drain to natural completion via `async for _line in r.aiter_lines(): pass` with the producer mocked to a fast/slow generator (`_fast_chunks`, `_slow_chunks`). The producer's terminal sentinel breaks the consumer; `aiter_lines()` returns. **For 062's multi-consumer test: spin up two `httpx.AsyncClient` instances in parallel via `asyncio.gather`, each draining its own stream — see Validation Architecture below.**
**Warning signs:** Tests timeout at the `@pytest.mark.timeout(15)` decorator boundary; no events yielded.
**Source:** `[CITED: github.com/encode/httpx/discussions/1787]` + `[VERIFIED: backend/tests/integration/test_061_ttl.py:48-60]` — pattern validated.

### Pitfall 8: Producer Cancel Without Awaiting — Test-Time Race

**What goes wrong:** A test that calls DELETE then immediately asserts on `mock_supabase.table("runs").update.call_args_list` may see only the DELETE's UPDATE (or none) because `task.cancel()` schedules the producer's `_shielded_finalize` to run async — the assertion races the finalizer.
**Why it happens:** D-062-10 explicitly says DELETE does NOT await `task`. The 5-step finalizer runs in the background.
**How to avoid:** Use `await await_producer_finalized(mock_supabase)` from `_run_helpers.py:297-349` BEFORE asserting on mock state. This helper looks up the run in `RUN_TASKS` and awaits with timeout.
**Warning signs:** Tests pass intermittently; assertion sees `len(update_calls) == 0` then `1` non-deterministically.
**Source:** `[VERIFIED: backend/tests/integration/_run_helpers.py:297-349]` — D-061.1-01/02/03 keystone helper. All 5 S2 race tests now use it.

## Code Examples

Verified patterns from official sources and from this codebase:

### Two-mode XREAD with WR-01 Fix (the canonical 061 pattern, to mirror in 062)

```python
# Source: backend/app/api/threads.py:336-423 (event_consumer, lifted to module-level
# in Phase 061.1 IN-04 / D-061.1-10).
# 062 mirrors this verbatim with `last_id = since` initialization instead of `"0"`.

stream_key = f"run:{run_id}"
last_id = since  # ← only difference from event_consumer
deadline = time_mod.monotonic() + settings.run_hard_timeout_seconds + 10

# Phase 1: replay (no block; immediate return)
while True:
    if time_mod.monotonic() > deadline:
        yield {"data": json.dumps({"type": "error", "error": "consumer_timeout"})}
        return
    result = await redis.xread(streams={stream_key: last_id}, count=100)
    if not result:
        break
    for _stream_name, entries in result:
        for entry_id, fields in entries:
            last_id = entry_id  # advance cursor (Pitfall 1)
            yield {"data": fields["data"]}
            if json.loads(fields["data"]).get("type") in TERMINAL_TYPES:
                return

# Phase 2: live-tail (BLOCK 5000) — WR-01 fix: carry last_id, NO `$` reset
while True:
    if time_mod.monotonic() > deadline:
        yield {"data": json.dumps({"type": "error", "error": "consumer_timeout"})}
        return
    result = await redis.xread(streams={stream_key: last_id}, count=100, block=5000)
    if not result:  # block timeout, no new entries
        continue
    for _stream_name, entries in result:
        for entry_id, fields in entries:
            last_id = entry_id
            yield {"data": fields["data"]}
            if json.loads(fields["data"]).get("type") in TERMINAL_TYPES:
                return
```

### EventSourceResponse with ping=None (D-061.1-04 H2 fix)

```python
# Source: backend/app/api/threads.py:2183-2186
# ping=None disables sse-starlette's keep-alive injection that races
# with burst→quiet patterns and produces ERR_INCOMPLETE_CHUNKED_ENCODING.
return EventSourceResponse(
    replay_tail_consumer(redis=redis, run_id=run_id, since=since, settings=settings),
    ping=None,
)
```

### maybe_single() ownership check (062's variant of `get_messages:597-606`)

```python
# Source: D-062-08 + maybe_single (vs single) so missing row returns None
# rather than raising APIError (postgrest 204 patch in main.py:22-45).
row_resp = await aexec(
    supabase.table("runs")
    .select("run_id, status, thread_id")
    .eq("run_id", str(run_id))
    .eq("user_id", current_user["id"])
    .maybe_single()
)
row = row_resp.data
if not row:
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Run not found")
```

### Zombie heal Redis ops with try/except discipline (mirrors `threads.py:2104-2138`)

```python
# Each Redis call wrapped in try/except + logger.exception — D-062-13 + the
# established pattern at threads.py:2104-2138 (_shielded_finalize). DELETE
# returns 204 even if Redis is fully unreachable.
try:
    if await redis.exists(f"run:{run_id}"):
        await _emit_terminal(redis, run_id, "cancelled", reason="zombie_healed")
except Exception:
    logger.exception("Zombie heal sentinel XADD failed for run %s", run_id)

try:
    await redis.zrem("runs:active", str(run_id))
    await redis.zrem(f"runs_by_thread:{thread_id}", str(run_id))
except Exception:
    logger.exception("Zombie heal ZREM failed for run %s", run_id)

try:
    await redis.expire(f"run:{run_id}", 60)
except Exception:
    logger.exception("Zombie heal EXPIRE failed for run %s", run_id)
```

### Multi-consumer fan-out test harness (062 NEW)

```python
# Source: NEW pattern derived from test_061_producer_survives_disconnect.py.
# Two parallel httpx.AsyncClient instances XREADing the same run_id.
# Verifies SC#4 of ROADMAP Phase 062.

@pytest.mark.asyncio
@pytest.mark.timeout(15)
async def test_multi_consumer_fanout(redis_client):
    """SC#4: two concurrent consumers of the same run_id receive identical sequences."""
    mock_supabase = _build_mock_supabase()
    app.dependency_overrides[get_supabase] = lambda: mock_supabase
    try:
        with patch(
            "app.api.threads.create_adaptive_streaming_chat",
            return_value=(iter(_slow_chunks()), CallingMode.NATIVE),
        ), patch("app.services.suggestion_service.generate_suggestions", return_value=([], None)), \
           patch("app.api.threads.generate_thread_title", return_value=("T", None)):

            # Step 1: drive POST to spin up the producer
            transport = ASGITransport(app=app)
            async with httpx.AsyncClient(transport=transport, base_url="http://test") as ac:
                # Fire POST and immediately disconnect (we just want run_id + producer running)
                async with ac.stream(
                    "POST", f"/threads/{THREAD_A}/messages",
                    json={"content": "hello"},
                    headers={"Authorization": "Bearer test-token"},
                    timeout=30.0,
                ) as r:
                    # Read first chunk to confirm producer started, then disconnect
                    async for _ in r.aiter_lines():
                        break

                run_id = _extract_run_id_from_mock(mock_supabase)

                # Step 2: spin up TWO independent consumers via GET /runs/{id}/stream?since=0
                async def _consume(client: httpx.AsyncClient):
                    events = []
                    async with client.stream(
                        "GET", f"/runs/{run_id}/stream?since=0",
                        headers={"Authorization": "Bearer test-token"},
                        timeout=30.0,
                    ) as resp:
                        async for line in resp.aiter_lines():
                            if line.startswith("data: "):
                                events.append(line[6:])  # strip "data: "
                    return events

                async with httpx.AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c1, \
                           httpx.AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c2:
                    events1, events2 = await asyncio.gather(_consume(c1), _consume(c2))

            # Both consumers should have received identical event sequences
            assert events1 == events2, (
                f"Multi-consumer fan-out divergence: c1={len(events1)} events, "
                f"c2={len(events2)} events. First diff at index "
                f"{next((i for i,(a,b) in enumerate(zip(events1,events2)) if a!=b), None)}"
            )
            # Both should end with a terminal type
            assert events1, "Consumer 1 received no events"
            last = json.loads(events1[-1])
            assert last["type"] in TERMINAL_TYPES, f"Last event type {last['type']!r} not terminal"
    finally:
        app.dependency_overrides.pop(get_supabase, None)
```

### Zombie-state setup for DELETE test

```python
# Source: NEW. Zombie = runs.status='streaming' in Postgres but RUN_TASKS[run_id] missing.
# Simulate by directly INSERTing a runs row + run:{id} stream entries WITHOUT
# spawning a producer, then call DELETE.

@pytest.mark.asyncio
@pytest.mark.timeout(15)
async def test_delete_zombie_heals(redis_client):
    """SC#3 zombie path: producer task missing but runs.status='streaming'."""
    from app.api.threads import RUN_TASKS

    mock_supabase = _build_mock_supabase()
    app.dependency_overrides[get_supabase] = lambda: mock_supabase

    # Simulate zombie: pretend a producer wrote some entries then died
    run_id = uuid4()
    thread_id = THREAD_A
    stream_key = f"run:{run_id}"
    await redis_client.xadd(stream_key, {"data": json.dumps({"type": "delta", "content": "hi"})})
    await redis_client.zadd("runs:active", {str(run_id): time.time()})
    await redis_client.zadd(f"runs_by_thread:{thread_id}", {str(run_id): time.time()})

    # Configure mock to return a streaming runs row for SELECT
    runs_builder = mock_supabase.table("runs")
    runs_builder.execute.side_effect = lambda *a, **k: _make_result({
        "run_id": str(run_id), "status": "streaming", "thread_id": thread_id,
    })

    # Confirm RUN_TASKS does NOT have this run_id (zombie precondition)
    assert run_id not in RUN_TASKS

    try:
        async with httpx.AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            resp = await c.delete(
                f"/runs/{run_id}",
                headers={"Authorization": "Bearer test-token"},
            )

        assert resp.status_code == 204

        # Zombie heal effects (D-062-11):
        # 1. Postgres UPDATE called with status='cancelled', error='cancelled_by_user'
        update_calls = runs_builder.update.call_args_list
        cancelled_updates = [
            c for c in update_calls
            if c.args and isinstance(c.args[0], dict)
            and c.args[0].get("status") == "cancelled"
            and c.args[0].get("error") == "cancelled_by_user"
        ]
        assert cancelled_updates, f"Expected cancelled UPDATE; got {update_calls}"

        # 2. Synthetic terminal sentinel landed
        entries = await redis_client.xrange(stream_key)
        terminal = [
            e for e in entries
            if json.loads(e[1]["data"]).get("type") == "cancelled"
            and json.loads(e[1]["data"]).get("reason") == "zombie_healed"
        ]
        assert terminal, f"Expected zombie_healed terminal sentinel; got {entries}"

        # 3. ZREM cleared sorted-set membership
        assert await redis_client.zscore("runs:active", str(run_id)) is None
        assert await redis_client.zscore(f"runs_by_thread:{thread_id}", str(run_id)) is None

        # 4. EXPIRE 60 applied
        ttl = await redis_client.ttl(stream_key)
        assert 30 < ttl <= 65, f"Expected 60s EXPIRE on zombie; got {ttl}"
    finally:
        app.dependency_overrides.pop(get_supabase, None)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hardcoded `last_id = "0"` in `event_consumer` | Parameterized `last_id = since` in `replay_tail_consumer` | 062 | Enables resume-from-offset semantics for the new GET endpoint; `event_consumer` keeps hardcoded `"0"` for the legacy POST handler until 063 |
| Reset `last_id = "$"` between replay and tail phases | Carry `last_id` forward unchanged (WR-01 fix) | 061.1 (D-061.1-07) | Eliminates the race window where producer XADDs between drain and tail-subscribe were silently missed. **062 inherits this fix verbatim.** |
| `event_consumer` nested inside `send_message` (closure-captured) | `event_consumer` lifted to module level (D-061.1-10 / IN-04) | 061.1 | Importable as `app.api.threads.event_consumer`; testable directly with mock redis. **062's `replay_tail_consumer` should be module-level too.** |
| `EventSourceResponse(generator, ping=15)` | `EventSourceResponse(generator, ping=None)` | 061.1 (H2 fix per DIAGNOSIS.md) | Eliminates ping-task injection race that produced `ERR_INCOMPLETE_CHUNKED_ENCODING` during burst→quiet patterns. **062 endpoints all use `ping=None`.** |
| `assert type in TERMINAL_TYPES` in `_emit_terminal` | `if type not in TERMINAL_TYPES: raise ValueError(...)` (WR-03 fix) | 061 | Survives `python -O` (assertions stripped). 062 inherits — no plan change needed |
| `_extract_run_id_from_mock` returns `call_args_list[0]` | Filters by `payload.get('status') == 'streaming'` (D-061.1-12 / IN-02) | 061.1 | Survives spawn-failure cleanup paths that may add a retry-INSERT. 062 tests inherit |
| Tests assert immediately after `aiter_lines()` exhausts | `await await_producer_finalized(mock_supabase)` before mock assertions | 061.1 (D-061.1-01/02/03) | Closes 5 S2 race tests; deterministic finalize await. **062 tests use this helper for any post-stream mock assertion.** |
| 4-table mock builder (no `runs`) | 5-table mock builder including `runs` | 061 (Plan 05 Step 0a) | Tests can assert on `mock_supabase.table("runs").insert/update.call_args_list` |
| `redis>=5.2,<8` | `redis>=5.2,<6` (WR-07 tightening) | 061.1 | Predictability for the `event_consumer` and tests. **062 uses redis-py 5.3.1.** |

**Deprecated/outdated:**
- The original 058/059 `stream_end` event name — replaced by `done` per TERMINAL_TYPES. DEF-061.1-01 documents this; 062 tests use `done`/`error`/`cancelled` exclusively. Wire-format pitfall.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Python 3.12.x | Backend | ✓ | (assumed — backend already runs locally per `.planning/codebase/STACK.md`) | — |
| Redis | All 062 stream/delete-zombie endpoints | Unable to probe directly (redis-cli not in PATH; docker probe blocked by sandbox); REDIS-SETUP.md confirms docker-compose dev infra exists and CI workflow at `.github/workflows/backend-tests.yml:41` provisions Redis | redis-py 5.3.1 against Redis server (any 5+ supports Streams) | None — Redis is mandatory for 062. If unreachable in dev: `docker compose -f docker-compose.dev.yml up -d` |
| Docker | Local Redis via docker-compose.dev.yml | Unable to probe (sandbox restricted) — assumed available since 061.1 just shipped with green tests | (any) | If Docker is down locally: developer must start Docker Desktop. CI is unaffected (workflow has its own Redis preamble) |
| Supabase (Postgres) | All 062 endpoints | Configured locally via `supabase start` per CLAUDE.md | (Supabase CLI default) | Cloud Supabase via `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` env override |
| FastAPI / sse-starlette / pytest stack | All routes + tests | ✓ — all in `backend/requirements.txt` and venv per Phase 061 | per pin | None needed |
| pytest-asyncio + pytest-timeout | All async tests | ✓ — `pytest.ini` already configures `asyncio_mode = auto` | per pin | None needed |
| httpx with ASGITransport | Integration tests | ✓ — used by all 061 tests | >=0.27 | None needed |

**Missing dependencies with no fallback:** None confirmed missing — Redis is mandatory but assumed running per Phase 061's just-shipped state.

**Missing dependencies with fallback:** None.

**Note on probe failures:** The sandbox restricted both `docker ps` and `redis-cli ping`. Phase 061.1 verification status (`passed, 18/18 must-haves`) is the proxy evidence that the dev environment IS functional for run-backed streaming. The 062 plan should still include a Wave 0 health check that runs `docker ps | grep agentic-rag-redis && curl -sf http://localhost:8000/health` to verify the local environment before any test runs.

## Validation Architecture

> Required per Nyquist Dimension 8 — `workflow.nyquist_validation: true` per `.planning/config.json`.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest 8.x + pytest-asyncio (async fixtures) + pytest-timeout |
| Config file | `backend/pytest.ini` (already configures `asyncio_mode = auto`) |
| Quick run command (062 only) | `cd backend && venv\Scripts\python -m pytest tests/integration/test_062_*.py -v --tb=short` |
| Full suite command (062 + 061 + 058/059 regression) | `cd backend && venv\Scripts\python -m pytest tests/integration/ tests/unit/ -v -k "not (test_normal_stream_unchanged or test_failed_run_expires_60s or test_120s_timeout_fires_full_finally or test_producer_continues_after_consumer_disconnect)"` |
| Pre-test environment setup | `docker compose -f docker-compose.dev.yml up -d redis && supabase start` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| STREAM-04 / SC#1 | `GET /threads/{tid}/active-runs` returns streaming-only filter; bare list shape; cross-user empty | integration | `pytest backend/tests/integration/test_062_active_runs.py -x` | ❌ Wave 0 |
| STREAM-04 / SC#1 (negative) | Active-runs returns `[]` for thread with no streaming runs; returns `[]` for cross-user thread | integration | `pytest backend/tests/integration/test_062_active_runs.py::test_empty_when_no_streaming -x` and `::test_empty_for_other_user -x` | ❌ Wave 0 |
| STREAM-04 / SC#2 | `GET /runs/{rid}/stream?since=N` replays from N to current head, then live-tails through producer's terminal sentinel, then closes | integration | `pytest backend/tests/integration/test_062_stream_replay.py::test_replay_then_tail_to_terminal -x` | ❌ Wave 0 |
| STREAM-04 / SC#2 (terminal-already) | GET stream on already-terminal run replays buffer + closes (D-062-05) | integration | `pytest backend/tests/integration/test_062_stream_terminal.py::test_terminal_run_replays_and_closes -x` | ❌ Wave 0 |
| STREAM-04 / SC#2 (TTL-expired) | GET stream on TTL-expired run emits exactly one synthetic terminal event with `error="buffer_expired"` and runs.status mapped via `_RUN_STATUS_TO_TERMINAL_TYPE`; missing row → 404 (D-062-06) | integration | `pytest backend/tests/integration/test_062_stream_ttl_expired.py -v` | ❌ Wave 0 |
| STREAM-04 / SC#3 (happy path) | DELETE on in-flight run cancels producer (`RUN_TASKS[run_id].cancel()`); 204 immediately; `runs.status='cancelled'` after `await await_producer_finalized` (D-062-10) | integration | `pytest backend/tests/integration/test_062_delete_happy.py -x` | ❌ Wave 0 |
| STREAM-04 / SC#3 (zombie heal) | DELETE on `runs.status='streaming'` but `RUN_TASKS[rid]` missing: UPDATE Postgres `cancelled` + synthetic terminal sentinel + ZREM × 2 + EXPIRE 60 + 204 (D-062-11) | integration | `pytest backend/tests/integration/test_062_delete_zombie.py -x` | ❌ Wave 0 |
| STREAM-04 / SC#3 (idempotent) | DELETE on already-terminal run (status in {completed, failed, cancelled}) returns 204 silent (D-062-09) | integration | `pytest backend/tests/integration/test_062_delete_terminal_idempotent.py -x` | ❌ Wave 0 |
| STREAM-04 / SC#4 (multi-consumer fan-out) | Two `httpx.AsyncClient` instances XREAD same `run_id` via `asyncio.gather`; both receive identical event sequences (XREAD non-destructive) | integration | `pytest backend/tests/integration/test_062_multi_consumer_fanout.py -x` | ❌ Wave 0 |
| STREAM-04 / SC#5 (cross-user) | Cross-user GET active-runs returns `[]`; cross-user GET stream returns 404; cross-user DELETE returns 404 (all D-062-12) | integration | `pytest backend/tests/integration/test_062_cross_user_404.py -v` | ❌ Wave 0 |
| STREAM-04 / SC#6 (POST untouched) | Existing `test_058_concurrency.py::test_cross_tab_unblocked_during_sse` still passes | regression | `pytest backend/tests/integration/test_058_concurrency.py::test_cross_tab_unblocked_during_sse -x` | ✅ exists |
| 061 regression | `test_059_disconnect.py::test_agent_task_SURVIVES_on_disconnect` still passes | regression | `pytest backend/tests/integration/test_059_disconnect.py::test_agent_task_SURVIVES_on_disconnect -x` | ✅ exists |
| 061 regression | `test_061_consumer_cursor_race.py` (3 WR-01 tests) still pass | regression | `pytest backend/tests/integration/test_061_consumer_cursor_race.py -x` | ✅ exists |
| Redis-down degradation | `GET /runs/{id}/stream` returns 503 with `Retry-After: 10` when Redis unreachable; DELETE returns 204 (D-062-13) | integration (mocked Redis failure) | `pytest backend/tests/integration/test_062_redis_down.py -x` | ❌ Wave 0 — recommended optional |
| Pydantic validation | Malformed UUID in path → 422 (FastAPI auto-validates `UUID`) | integration | `pytest backend/tests/integration/test_062_active_runs.py::test_malformed_uuid_returns_422 -x` | ❌ Wave 0 |

### Detailed Test Specifications

**Test: `test_062_active_runs.py::test_returns_streaming_only_filter`**
- **What it verifies:** SC#1 — endpoint returns only runs where `status='streaming'`; ordering DESC by `started_at`.
- **Mock/fixture requirements:** `_build_mock_supabase`, override `runs` table builder's SELECT to return mixed-status rows; mock applies `eq("status", "streaming")` filtering server-side (assert call args). No Redis needed.
- **Expected pass criteria:** Response is `list[ActiveRunResponse]` with only streaming items, ordered by `started_at DESC`. SELECT call args include `.eq("status", "streaming")` and `.order("started_at", desc=True)`.

**Test: `test_062_stream_replay.py::test_replay_then_tail_to_terminal`**
- **What it verifies:** SC#2 — consumer XREADs from `since`, advances cursor through replay, transitions to BLOCK live-tail, breaks on terminal sentinel.
- **Mock/fixture requirements:** `redis_client` fixture; pre-populate `run:{rid}` with N entries via `xadd`; spawn a separate task that `xadd`s additional entries during the GET; verify the consumer yields all N+M then closes.
- **Expected pass criteria:** Response body contains exactly N+M+1 SSE `data:` lines (N replay + M tail + 1 terminal sentinel); last entry has `type in TERMINAL_TYPES`.

**Test: `test_062_stream_terminal.py::test_terminal_run_replays_and_closes`**
- **What it verifies:** D-062-05 — GET on an already-terminal run replays then closes naturally via the in-buffer terminal sentinel.
- **Mock/fixture requirements:** Pre-populate `run:{rid}` with delta entries + a final `{"type": "done"}` entry. NO producer running.
- **Expected pass criteria:** Consumer yields all entries up to and including the terminal sentinel, then closes (no BLOCK timeout).

**Test: `test_062_stream_ttl_expired.py::test_emits_synthetic_terminal_when_buffer_expired`**
- **What it verifies:** D-062-06 — when `redis.exists(f"run:{rid}")` returns 0 but runs row exists, emit one synthetic terminal event mapped via `_RUN_STATUS_TO_TERMINAL_TYPE`.
- **Mock/fixture requirements:** Mock `runs` table SELECT to return `{status: "completed", error: None}`; do NOT populate `run:{rid}` Stream (so `exists` returns 0).
- **Expected pass criteria:** Exactly one SSE event with `{"type": "done", "error": "buffer_expired", "runs_status": "completed"}`. Test variants for status `"failed"` → `"error"` and `"cancelled"` → `"cancelled"`.

**Test: `test_062_stream_ttl_expired.py::test_404_when_runs_row_missing`**
- **What it verifies:** D-062-06 fallback — runs row missing → 404.
- **Mock/fixture requirements:** Mock `runs` table SELECT to return `data=None`.
- **Expected pass criteria:** HTTP 404.

**Test: `test_062_delete_happy.py::test_cancels_in_flight_producer`**
- **What it verifies:** D-062-10 — DELETE on in-flight run calls `task.cancel()`; producer's CancelledError handler sets `_terminal_status='cancelled'`; finalize runs async; 204 returned immediately (< 100ms).
- **Mock/fixture requirements:** Spin up a real producer via POST + `_slow_chunks` (so it's mid-stream); `_extract_run_id_from_mock`; assert `RUN_TASKS[run_id]` exists pre-DELETE; call DELETE; `await await_producer_finalized`; assert `runs.status='cancelled'` UPDATE called.
- **Expected pass criteria:** 204 status; finalize completes within timeout; UPDATE call with `status='cancelled'`; terminal sentinel `type='cancelled'` in Redis.

**Test: `test_062_delete_zombie.py::test_heals_zombie_state`** (full skeleton in Code Examples above)
- **What it verifies:** D-062-11 — UPDATE Postgres + synthetic terminal + ZREM × 2 + EXPIRE 60 + 204; assert RUN_TASKS does NOT contain run_id pre-call.
- **Mock/fixture requirements:** Manually `xadd` entries + `zadd` sorted-sets WITHOUT spawning producer; mock `runs` SELECT to return streaming row.
- **Expected pass criteria:** All 4 zombie heal effects observable; 204 returned.

**Test: `test_062_delete_terminal_idempotent.py::test_terminal_returns_204_silent`**
- **What it verifies:** D-062-09 — DELETE on `runs.status` in {completed, failed, cancelled} returns 204 with no other side effects (no UPDATE, no Redis touch).
- **Mock/fixture requirements:** Mock `runs` SELECT to return `{status: "completed"}`; capture `runs_builder.update.call_args_list` length pre/post.
- **Expected pass criteria:** 204; UPDATE call count unchanged; no Redis errors logged.

**Test: `test_062_multi_consumer_fanout.py::test_two_consumers_receive_identical_sequences`** (full skeleton in Code Examples above)
- **What it verifies:** SC#4 — XREAD is non-destructive, two parallel consumers see identical sequences.
- **Mock/fixture requirements:** Spin up producer via POST (slow chunks); after first chunk, fire two parallel `c.stream("GET", "/runs/{rid}/stream?since=0")` via `asyncio.gather`; collect events from each.
- **Expected pass criteria:** `events1 == events2`; both end with terminal type. Bonus: assert at least one event arrived AFTER both consumers connected (proves true live-tail).

**Test: `test_062_cross_user_404.py` (multi-test file)**
- Tests: `test_active_runs_other_user_returns_404`, `test_get_stream_other_user_returns_404`, `test_delete_other_user_returns_404`.
- **What it verifies:** D-062-12 — every endpoint applies `.eq("user_id", current_user["id"])` and the thread/runs ownership SELECT raises 404 (NOT 403, NOT 200) on missing row; don't leak resource existence to other users.
- **Mock/fixture requirements:** Override `get_current_user` dependency with two distinct user IDs; the threads/runs ownership SELECT returns no row for user B (RLS + `.eq("user_id", ...)` filter); query as user B.
- **Expected pass criteria:** Active-runs returns 404; stream returns 404; DELETE returns 404. No 403, no 200 with `[]`, anywhere.

**Test: `test_062_redis_down.py::test_stream_returns_503_on_redis_unreachable`** (recommended optional)
- **What it verifies:** D-062-13 — stream endpoint returns 503 with `Retry-After: 10` when Redis is down.
- **Mock/fixture requirements:** Patch `app.dependencies.get_redis` to return a mock that raises `redis.exceptions.ConnectionError` on every call.
- **Expected pass criteria:** 503; response header `Retry-After: 10`.

**Test: `test_062_redis_down.py::test_delete_returns_204_on_redis_unreachable`**
- **What it verifies:** D-062-13 — DELETE returns 204 even if all Redis ops fail; Postgres UPDATE still happens for zombie path.
- **Expected pass criteria:** 204; `runs.status='cancelled'` UPDATE call observed.

### Sampling Rate

- **Per task commit:** `cd backend && venv\Scripts\python -m pytest tests/integration/test_062_*.py -x --tb=short` (062-only, fail-fast).
- **Per wave merge:** Full integration suite with the canonical `-k` filter to skip pre-existing DEF-061.1-02 failures.
- **Phase gate (`/gsd:verify-work`):** Full integration + unit suite + manual two-tab DevTools checklist (humanity backstop; multi-tab automation deferred to Phase 064).

### Wave 0 Gaps

- [ ] `backend/tests/integration/test_062_active_runs.py` — covers SC#1 (filter, shape, ordering, empty case, 422 on malformed UUID)
- [ ] `backend/tests/integration/test_062_stream_replay.py` — covers SC#2 (replay + live-tail to terminal)
- [ ] `backend/tests/integration/test_062_stream_terminal.py` — covers SC#2 (already-terminal replay)
- [ ] `backend/tests/integration/test_062_stream_ttl_expired.py` — covers D-062-06 (synthetic terminal + 404 fallback)
- [ ] `backend/tests/integration/test_062_delete_happy.py` — covers D-062-10 (in-flight cancel)
- [ ] `backend/tests/integration/test_062_delete_zombie.py` — covers D-062-11 (zombie heal)
- [ ] `backend/tests/integration/test_062_delete_terminal_idempotent.py` — covers D-062-09 (idempotent 204)
- [ ] `backend/tests/integration/test_062_cross_user_404.py` — covers D-062-12 (auth + 404 convention)
- [ ] `backend/tests/integration/test_062_multi_consumer_fanout.py` — covers SC#4 (multi-consumer)
- [ ] `backend/tests/integration/test_062_redis_down.py` — covers D-062-13 (degradation) — RECOMMENDED OPTIONAL
- [ ] (Helper extension) `backend/tests/integration/_run_helpers.py` — add `_setup_zombie_state(redis, mock_supabase, run_id, thread_id)` helper to dedupe zombie test boilerplate
- [ ] (Optional) Pydantic model `backend/app/models/run.py` — `ActiveRunResponse(BaseModel)`

**Existing test infrastructure REUSED (no Wave 0 needed):**
- `backend/tests/conftest.py:174-199` — `redis_client` async fixture
- `backend/tests/conftest.py:202-224` — `_flushdb_at_session_end` session autouse
- `backend/tests/integration/_run_helpers.py` — `_build_mock_supabase`, `_fast_chunks`, `_slow_chunks`, `_extract_run_id_from_mock`, `await_producer_finalized`, `USER_ID`
- `backend/tests/integration/test_059_disconnect.py` — `_reset_sse_starlette_app_status` autouse fixture (auto-applied by import in 061 tests; 062 tests should follow the same convention)
- `.github/workflows/backend-tests.yml` — Redis docker-compose preamble + host-port readiness probe (already shipped)

### Manual Two-Tab DevTools Checklist (Human Backstop)

Per CONTEXT.md "in scope" + ROADMAP Phase 064 deferral. The verifier should mark this as `human_needed`:

1. Open Tab A on a thread → send long message → see SSE streaming
2. Open Tab B on same thread → call `GET /threads/{tid}/active-runs` in DevTools console → see one streaming row with the in-flight `run_id`
3. In Tab B: open `GET /runs/{rid}/stream?since=0` (e.g., via `curl` or `EventSource` in console) → see backlog replay then live-tail in sync with Tab A
4. In Tab B: trigger `fetch('/runs/{rid}', {method: 'DELETE', headers: {Authorization: 'Bearer ...'}})` → both tabs receive `cancelled` terminal event within ~5s; both close cleanly
5. After completion: `GET /threads/{tid}/active-runs` returns `[]`
6. Wait 11 minutes after completion: `redis-cli XLEN run:{rid}` returns 0 (TTL expired); `GET /runs/{rid}/stream` returns synthetic terminal `{"type":"done","error":"buffer_expired"}`
7. Cross-user: log in as different user, attempt `GET /runs/{rid}/stream` → 404; `GET /threads/{tid}/active-runs` → `[]`

## Security Domain

> Required when `security_enforcement` is enabled. Status: `.planning/config.json` does not include `security_enforcement` key — treating as enabled per the conservative default.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Existing `get_current_user` Depends — Supabase Auth Bearer JWT validation at `dependencies.py:47-58`. No 062-specific changes. |
| V3 Session Management | n/a | Stateless API — no session cookies; JWT per-request |
| V4 Access Control | yes | RLS-enforced via Supabase service-role + per-query `.eq("user_id", current_user["id"])` (D-062-12). RLS policy `runs_select_own` shipped in migration 035. Defense in depth |
| V5 Input Validation | yes | FastAPI auto-validates UUID path params (rejects malformed → 422). `?since=` accepts any string but XREAD's own `ResponseError` handles bad cursors → 400 (D-062-07). Pydantic `ActiveRunResponse` validates outbound shape |
| V6 Cryptography | n/a | No crypto operations in 062. JWT validation handled by Supabase SDK |
| V7 Error Handling | yes | Wrap Redis errors at route boundary — return 503 (stream) / 204 (DELETE), never leak `redis.exceptions.RedisError` traceback as 500. Wrap supabase errors via `aexec` boundary. logger.exception for observability without leaking to clients |
| V13 API & Web Service | yes | RESTful conventions: 200 for GET, 204 for DELETE No Content, 404 for missing/cross-user, 422 for validation, 503 for upstream-down |

### Known Threat Patterns for FastAPI + Redis Streams + Postgres stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Information disclosure via 403-vs-404 | Information Disclosure | D-062-12 — return 404 on cross-user access (never leak resource existence). All queries `.eq("user_id", current_user["id"])`. Verified by `test_062_cross_user_404.py` |
| Cross-user run cancellation (one user cancels another's run) | Tampering, Elevation of Privilege | D-062-08 — DELETE auth check fetches the runs row first via aexec with `.eq("user_id", current_user["id"])`. RLS as defense in depth |
| Redis credential leak in logs | Information Disclosure | `main.py:65` warning explicitly never logs `settings.redis_url`. 062 endpoints only emit `logger.exception` which omits config. T-061-05 verified this |
| Run-state stale data poisoning (DEF-061.1-02) | Tampering | Investigate exception classifier per Open Question 1; if confirmed, fix in 062 Wave 0 (disposition (a)) |
| Resource exhaustion via flood of `GET /runs/{id}/stream` connections | Denial of Service | Per-stream connection holds for at most `RUN_HARD_TIMEOUT_SECONDS + 10` (130s) via consumer deadline. Single uvicorn worker bounds concurrency. Connection-pool exhaustion risk documented in Pitfall 5 — out of 062 scope but operationally observable |
| Buffer-expiry race causing 500 instead of synthetic terminal | Tampering / Information Disclosure | D-062-06 explicit `await redis.exists` check before XREAD; 404 fallback on missing runs row; no traceback leak |
| Bypass of TTL via deeply-nested DELETE chains | Tampering | DELETE always sets EXPIRE 60 in zombie path (D-062-11 step 4); producer's normal-completion path sets EXPIRE 600/60 (D-061-04). No path skips EXPIRE |
| Malformed `since` cursor causing XREAD ResponseError | Tampering / Denial of Service | D-062-07 — caught at route boundary, translated to 400. No XREAD result leaks to client |
| ZADD/ZREM membership skew under concurrent DELETE + finalize | Tampering | Each ZREM in try/except + logger.exception. Postgres `runs.status='streaming'` is the source-of-truth filter for active-runs; sorted-set staleness invisible to API consumers. Documented as deferred per D-061 / 062 |

## Sources

### Primary (HIGH confidence — verified in this session)

- `[VERIFIED]` `.planning/phases/062-replay-tail-api/062-CONTEXT.md` — All 14 D-062 decisions, file layout, and codebase landmarks
- `[VERIFIED]` `.planning/phases/061-run-backed-streaming-backend/061-CONTEXT.md` — D-061-01..17 architectural foundation
- `[VERIFIED]` `.planning/phases/061-run-backed-streaming-backend/061-VERIFICATION.md` — 17/18 truths verified, line numbers, artifact-by-artifact
- `[VERIFIED]` `.planning/phases/061.1-run-backed-streaming-cleanup/061.1-VERIFICATION.md` — 18/18 must-haves, status `passed`; all 14 D-061.1-XX decisions in place
- `[VERIFIED]` `.planning/phases/061.1-run-backed-streaming-cleanup/deferred-items.md` — DEF-061.1-01 / DEF-061.1-02 root analysis
- `[VERIFIED]` `.planning/REQUIREMENTS.md` — STREAM-04 acceptance text
- `[VERIFIED]` `.planning/PROJECT.md` — D-v2.5-08, D-v2.5-09, D-v2.5-10, D-v2.5-11 locked
- `[VERIFIED]` `.planning/ROADMAP.md` — Phase 062 SC#1-6 binding contract
- `[VERIFIED]` `backend/app/api/threads.py` lines 60-125 (RUN_TASKS, TERMINAL_TYPES, _emit_terminal, _RUN_STATUS_TO_TERMINAL_TYPE, _emit), 329-423 (event_consumer module-level), 426-444 (list_threads pattern), 591-617 (get_messages ownership SELECT), 675-755 (send_message INSERT/ZADD pattern), 2057-2076 (exception classifier — DEF-061.1-02 site), 2087-2156 (_shielded_finalize 5-step ordering), 2183-2186 (EventSourceResponse(ping=None))
- `[VERIFIED]` `backend/app/dependencies.py` lines 23-44 (get_redis singleton with decode_responses + socket timeouts)
- `[VERIFIED]` `backend/app/main.py` lines 54-101 (lifespan with PING + RUN_TASKS shutdown), 116-124 (/health Redis status)
- `[VERIFIED]` `backend/app/utils/db.py` (aexec helper)
- `[VERIFIED]` `backend/app/models/thread.py`, `backend/app/models/message.py` (Pydantic precedents for `models/run.py`)
- `[VERIFIED]` `backend/app/config.py` lines 230-251 (anyio_thread_tokens + redis_url + run_hard_timeout_seconds)
- `[VERIFIED]` `backend/requirements.txt` line 2 (sse-starlette==2.4.1) + line 18 (redis>=5.2,<6) + lines 19-22 (test stack)
- `[VERIFIED]` `backend/tests/conftest.py` lines 165-224 (redis_client fixture + _flushdb_at_session_end)
- `[VERIFIED]` `backend/tests/integration/_run_helpers.py` (full file — `_build_mock_supabase`, `_extract_run_id_from_mock`, `await_producer_finalized`, `_fast_chunks`, `_slow_chunks`, `_make_table_builder`)
- `[VERIFIED]` `backend/tests/integration/test_061_consumer_cursor_race.py` (WR-01 regression pattern)
- `[VERIFIED]` `backend/tests/integration/test_061_ttl.py` (TTL math + `await_producer_finalized` usage pattern)
- `[VERIFIED]` `backend/tests/integration/test_061_runs_table.py` (runs row INSERT/UPDATE inspection pattern)
- `[VERIFIED]` `backend/tests/integration/test_061_producer_survives_disconnect.py` (slow-mock-LLM + cross-tab pattern)
- `[VERIFIED]` `backend/tests/integration/test_059_disconnect.py` (sse-starlette AppStatus reset fixture pattern)
- `[VERIFIED]` `supabase/migrations/035_runs_table.sql` (11 columns, 2 indexes, SELECT-only RLS — already shipped)
- `[VERIFIED]` `REDIS-SETUP.md` (key conventions, TTL discipline)
- `[VERIFIED]` `.planning/config.json` (`workflow.nyquist_validation: true`; security_enforcement absent — treated as enabled)
- `[VERIFIED]` `pip index versions redis` 2026-05-03 — `5.3.1` installed; `7.4.0` is current upstream stable; project pinned `<6` deliberately

### Secondary (MEDIUM confidence — official docs cited from web search)

- `[CITED: redis.io/docs/latest/commands/xread]` — XREAD semantics: BLOCK timeout returns null/empty, non-destructive read, multi-consumer fan-out is implicit
- `[CITED: redis.readthedocs.io/en/stable/_modules/redis/asyncio/client.html]` — redis-py asyncio XREAD wrapper behavior on timeout
- `[CITED: github.com/sysid/sse-starlette]` and `[CITED: deepwiki.com/sysid/sse-starlette/3.5-client-disconnection-detection]` — `EventSourceResponse` with `ping=None` disables keep-alive task; passive disconnect detection still works via `_listen_for_disconnect` background task
- `[CITED: github.com/fastapi/fastapi/issues/717]` and `[CITED: fastapi.tiangolo.com/tutorial/response-status-code/]` — 204 No Content idiom: `response_class=Response` to avoid JSONResponse converting `None` to `"null"`
- `[CITED: github.com/encode/httpx/discussions/1787]` — Multi-consumer SSE testing: same-loop hang pattern + workaround via parallel `httpx.AsyncClient` instances

### Tertiary (LOW confidence — none in this research)

None. All claims tagged `[ASSUMED]` are listed in the Assumptions Log below.

## Assumptions Log

> Claims that were not directly verified in this session. The planner / discuss-phase may want user confirmation on each.

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The `RUN_HARD_TIMEOUT_SECONDS` Settings field is honored in the route handler the same way the producer uses it (so `replay_tail_consumer`'s `deadline` arithmetic matches `event_consumer`'s) | Pattern 2 (`replay_tail_consumer`) | Low — Settings is a singleton, both consumers import the same instance; mismatch would manifest as different deadline behavior, easily caught in tests |
| A2 | The user actually wants disposition (a) (fix DEF-061.1-02 in 062) and not (b) or (c) | Pitfall 3 + Open Question 1 | Medium — wrong disposition adds 1-3 unplanned tasks to 062 OR ships 062 with a known classifier bug. Discuss-phase should explicitly raise this. CONTEXT.md says "Disposition decision-maker: the 062 planner" — so the planner picks; this research recommends (a) but it's not a user-locked decision |
| A3 | Multi-consumer fan-out test (SC#4) can be reliably exercised via two parallel `httpx.AsyncClient + ASGITransport` instances on the same event loop | Validation Architecture + Code Examples | Medium — `[CITED: github.com/encode/httpx/discussions/1787]` documents same-loop hang issues with `c.stream()`. The test skeleton above MAY hang; if so, fall back to one client polling via `redis_client.xread` directly to verify both XREAD cursors see the same entries (less of an end-to-end test but still proves SC#4 at the data-layer level) |
| A4 | The Redis sorted-set membership for `runs:active` and `runs_by_thread:{tid}` survives across the producer's natural completion + zombie heal sequence cleanly (no double-ZREM raising) | DELETE Zombie Heal | Low — `redis.zrem` is idempotent (returns 0 if member missing); no exception. Verified by examining `threads.py:2134-2138` where the producer's finalize uses the same try/except pattern |
| A5 | `EventSourceResponse(generator, ping=None)` properly closes when the generator returns (consumer naturally exits the two-mode loop on terminal sentinel) | EventSourceResponse Pattern | Very Low — verified by 061's existing usage and 061.1's H2 fix; the disconnect mechanism is independent of ping |
| A6 | The DEF-061.1-02 classifier bug is in `agent_runner`'s `except Exception` handler at `threads.py:2072-2076` (the bug is _terminal_status="failed" being correct in code but somehow producing "completed" in tests) — this research did not run the proposed isolation test (`pytest test_061_ttl.py::test_failed_run_expires_60s -x`) due to sandbox restrictions on starting Docker/Redis | Pitfall 3 + Open Questions | Medium — actual root cause may be elsewhere (e.g., the producer's `finally` is committing `_terminal_status='completed'` because the default at line 768 is "completed" and the except handler doesn't override under some race). The investigation work itself is the recommended Wave 0 task; this research surfaces the pattern, not the fix |

## Open Questions (RESOLVED)

1. **What is the actual disposition for DEF-061.1-02 (producer exception classifier)?**
   - **What we know:** Three failing tests (`test_failed_run_expires_60s`, `test_120s_timeout_fires_full_finally`, `test_producer_continues_after_consumer_disconnect`) reproduce identically pre- and post-Plan 02, all asserting that a simulated LLM exception produces `_terminal_status='failed'` but the producer is writing `'completed'` in some path. The exception classifier in `agent_runner` (visible at `threads.py:2057-2076`) reads correctly in code, but the test mocks observe `'completed'` UPDATEs.
   - **What's unclear:** (i) whether the bug is in the classifier itself or in the order-of-operations between the inner try/finally and the assignment to `_terminal_status`; (ii) whether the fix is 1-line or larger; (iii) whether the failing tests have an orthogonal root cause (e.g., the simulated LLM exception class isn't reaching the `except Exception` handler because of a re-raise upstream).
   - **Recommendation:** Disposition (a) — investigate as Wave 0 / Plan 0; if fix is bounded, land in 062, otherwise escalate.
   - **RESOLVED:** Disposition (b) — defer to a future 061.2 cleanup phase. See `062-01-PLAN.md` `must_haves.deferred` and ROADMAP Phase 062 entry. The classifier code at `threads.py:2057-2076` is partitioned OUT of 062 by D-062-14 to prevent merge conflicts on the long-lived `v2.5-stream` feature branch. The misclassification only affects audit metadata: a wrong-bucket 'completed' run is filtered out of active-runs anyway by D-062-02's `WHERE status='streaming'`, so 062's user-visible contract (active-runs / stream / DELETE UX) is unaffected. Until 061.2 lands, 062's full-suite verify inherits 061.1's canonical `-k "not (test_normal_stream_unchanged or test_failed_run_expires_60s or test_120s_timeout_fires_full_finally or test_producer_continues_after_consumer_disconnect)"` exclusion clause.

2. **Should `RUN_TASKS` / `TERMINAL_TYPES` / etc. be extracted to `_run_registry.py` in 062?**
   - **What we know:** CONTEXT.md flags this as Claude's Discretion. Direct import from `app.api.threads` is the smallest diff; extraction is the cleaner long-term shape but adds two file moves and import-path updates across 5+ test files.
   - **What's unclear:** Whether the indirect import will create test isolation pain when 062's tests need to mock `RUN_TASKS` cleanly.
   - **Recommendation:** Direct import in 062.
   - **RESOLVED:** Direct import from `app.api.threads` (no extraction). All four 062 plans use `from app.api.threads import RUN_TASKS, TERMINAL_TYPES, _emit_terminal, _RUN_STATUS_TO_TERMINAL_TYPE`. Smallest diff; matches the Discretion call in 061 (D-061-09 follow-up). Revisit only if test isolation pain surfaces during execution.

3. **Should the multi-consumer fan-out test (SC#4) use `httpx.AsyncClient + ASGITransport` (canonical) or fall back to direct `redis_client.xread` polling?**
   - **What we know:** `[CITED: github.com/encode/httpx/discussions/1787]` documents same-loop hang with `c.stream()` on SSE endpoints. The test skeleton in Code Examples uses two parallel clients via `asyncio.gather`; this MAY work because the producer is already running independently (not a single-loop blocker).
   - **What's unclear:** Whether the parallel-client pattern actually demonstrates SC#4 end-to-end or hangs on the test's own event loop.
   - **Recommendation:** Try parallel-client pattern first; fall back to data-layer verification on hang.
   - **RESOLVED:** Plan 04 ships the parallel `httpx.AsyncClient` pattern as primary, with a documented data-layer fallback in the test docstring (one client through the endpoint + one direct `redis_client.xread`). The chosen path is recorded in `test_062_multi_consumer_fanout.py::test_two_consumers_receive_identical_sequences` docstring at execution time.

4. **Does the `replay_tail_consumer` need to actively check `request.is_disconnected()`?**
   - **What we know:** `[CITED: deepwiki.com/sysid/sse-starlette/3.5-client-disconnection-detection]` notes that without `ping`, sse-starlette still has passive disconnect detection via `_listen_for_disconnect`. But active checking is recommended for prompt cleanup.
   - **What's unclear:** Whether passive detection is sufficient for 062's deadline + sentinel architecture, or whether explicit `request.is_disconnected()` polling adds real value.
   - **Recommendation:** Skip explicit polling.
   - **RESOLVED:** Omitted. Plan 02's `replay_tail_consumer` uses the passive sse-starlette disconnect detection only — no `request.is_disconnected()` polling. The consumer's `finally: pass` (D-061-03 contract) means there's no producer-side cleanup that depends on prompt consumer disconnect; the deadline + sentinel mechanism handles termination. Matches the existing `event_consumer` at `threads.py:336-423`.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every library and version verified in `requirements.txt`; no new deps
- Architecture: HIGH — every pattern mirrored from a verified-shipped source in 061/061.1
- Pitfalls: HIGH for Pitfalls 1, 2, 4, 6, 7, 8 (verified in code/tests); MEDIUM for Pitfalls 3 (DEF-061.1-02 root cause is suspicion-level, not confirmed) and 5 (theoretical pool exhaustion, not measured)
- Validation Architecture: HIGH — every test pattern derived from existing 061 integration tests; SC mapping comprehensive

**Research date:** 2026-05-03
**Valid until:** 2026-05-17 (14 days — stack is stable but DEF-061.1-02 classifier behavior may change if 061.2 ships in parallel)

---

## Phase 062 Quick Reference Card

For the planner / executor:

**FILES TO CREATE (3):**
1. `backend/app/api/runs.py` — `replay_tail_consumer`, GET `/runs/{id}/stream`, DELETE `/runs/{id}`
2. `backend/app/models/run.py` — `ActiveRunResponse(BaseModel)`
3. `backend/tests/integration/test_062_*.py` (≥9 files per Validation Architecture)

**FILES TO MODIFY (2):**
1. `backend/app/api/threads.py` — append `GET /threads/{tid}/active-runs` route near line 426 (`list_threads` pattern). DO NOT touch event_consumer, agent_runner, _shielded_finalize, send_message
2. `backend/app/main.py` — `app.include_router(runs.router)` near line 138

**FILES NEVER TOUCHED:**
- `supabase/migrations/*` (zero new migrations)
- `backend/app/api/threads.py:336-423` (event_consumer)
- `backend/app/api/threads.py:675-2156` (send_message + agent_runner + _shielded_finalize)
- `backend/app/api/threads.py:60-125` (registry constants — only IMPORT from here)
- `backend/app/dependencies.py` (already has all deps needed)
- `backend/app/utils/db.py` (aexec is reused as-is)

**SHIP-AS-A-MERGE BOUNDARY (D-v2.5-11):** 062 lands on the long-lived `v2.5-stream` feature branch alongside 061+063. Production never sees 062 alone. The dual-path window (`event_consumer` + `replay_tail_consumer` co-existing) is by design and intentionally narrow.

**DEF-061.1-02 GUARD:** Until disposition resolved, 062's regression sweep MUST use the canonical `-k "not (test_normal_stream_unchanged or test_failed_run_expires_60s or test_120s_timeout_fires_full_finally or test_producer_continues_after_consumer_disconnect)"` filter from 061.1.
