# Phase 061: Run-Backed Streaming (Backend) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-02
**Phase:** 061-run-backed-streaming-backend
**Areas discussed:** D-v2.5-09 cancel/timeout policy, public.runs schema details, Producer architecture, Redis test infrastructure

---

## D-v2.5-09 cancel/timeout policy

### Q1 — Server-side hard timeout default

| Option | Description | Selected |
|--------|-------------|----------|
| 120s (Recommended) | Matches PROJECT.md/STATE.md hint. Generous for 12-iteration agentic loop, tight enough to cap abandoned-run cost at ~$0.50 of Sonnet/4o tokens. Configurable via env var. | ✓ |
| 180s | Safer headroom for explorer-mode chains and analyze_document on large PDFs. Cost ceiling ~50% higher. | |
| 60s | Aggressive cost ceiling. Risks turning the timeout into a UX bug — multi-tool analyze_document can exceed 60s. | |

**User's choice:** 120s, env-overridable as `RUN_HARD_TIMEOUT_SECONDS`.

### Q2 — Abandoned-run TTL (no-consumer cancel)

| Option | Description | Selected |
|--------|-------------|----------|
| No separate TTL — hard timeout is sole bound (Recommended) | Simplest. 120s wall-clock already bounds runaway cost. Sweeper adds edge cases (quick reconnect = don't kill). | ✓ |
| 60s no-consumer → cancel (with sweeper) | Saves up to ~60s of LLM tokens vs 120s cap. Adds sweeper task, last-seen tracking, race window. | |
| 5 min no-consumer → cancel | Looser — 120s wall-clock fires first in most realistic cases anyway. | |

**User's choice:** No separate TTL. No sweeper task in 061.

### Q3 — Stop button semantics during 061-only dev state

| Option | Description | Selected |
|--------|-------------|----------|
| No-op backend-side; 120s timeout bounds it (Recommended) | Architectural truth: SC#3 explicitly requires producer survives consumer disconnect. Single-feature-branch deploy (D-v2.5-11) means users never see the broken-Stop window because 062 ships in same merge. | ✓ |
| Build temporary cancel hook in 061 | Re-adds the consumer-cancels-producer coupling that 061 is trying to eliminate, contradicts SC#3, builds a behavior we'd then delete. | |
| Ship 061+062 lockstep, no 061-only Stop semantics | Blurs the phase boundary the roadmap drew. | |

**User's choice:** No-op backend-side. Document explicitly in 061-VERIFICATION.md that Stop is intentionally non-functional until 062's DELETE /runs/{id} lands in the same merge.

### Q4 — Persistence shape when 120s timeout fires

| Option | Description | Selected |
|--------|-------------|----------|
| status='failed', error='hard_timeout', terminal `error` event (Recommended) | Folds timeout into existing `failed` bucket; uses `error` field as discriminator. Status enum stays at 4 values. | ✓ |
| Add `timed_out` as 5th status enum value | Distinct status; useful only if UX later differentiates. Mostly cosmetic. | |
| status='cancelled', error='hard_timeout' | Conflates with user-initiated DELETE /runs/{id} cancel. Probably wrong. | |

**User's choice:** status=failed/error=hard_timeout, terminal `error` event on stream.

---

## public.runs schema details

### Q1 — run_id PK type

| Option | Description | Selected |
|--------|-------------|----------|
| UUID via gen_random_uuid() (Recommended) | Matches Supabase convention (messages.id, threads.id, etc. since migration 001). Globally unique, opaque, URL-safe. | ✓ |
| TEXT id, generated client-side | More compact in URLs but breaks repo convention; introduces new id-generation pattern. | |
| BIGINT auto-increment | Smallest/fastest joins but leaks run-rate via sequential ids; breaks convention. | |

**User's choice:** uuid PK with gen_random_uuid() default.

### Q2 — FK ON DELETE behavior on thread_id and user_id

| Option | Description | Selected |
|--------|-------------|----------|
| thread_id CASCADE; user_id CASCADE (Recommended) | Matches messages.thread_id CASCADE convention. Delete thread → runs vanish. Delete user → all runs vanish. Redis Stream entries TTL independently. | ✓ |
| thread_id SET NULL; user_id SET NULL | Preserves runs as audit/billing record; orphan rows accumulate. Future-billing concern, not v2.5. | |
| thread_id CASCADE; user_id RESTRICT | Blocks user deletion if runs exist; surprising for support flows. | |

**User's choice:** Both CASCADE.

### Q3 — Index strategy for active-runs hot path

| Option | Description | Selected |
|--------|-------------|----------|
| Partial index (user_id, thread_id, status) WHERE status='streaming' (Recommended) | Tiny — 99.9% of rows are terminal. Optimal for hot path. Plus separate composite for history queries. | ✓ |
| Single composite (user_id, thread_id, started_at DESC) | One index for both. Less optimal for active-runs but simpler. | |
| No special index in 061 | Seq scan on >1000 runs per user. Don't recommend. | |

**User's choice:** Partial index for streaming + composite (user_id, thread_id, started_at DESC) for history.

### Q4 — RLS shape

| Option | Description | Selected |
|--------|-------------|----------|
| SELECT: auth.uid()=user_id; INSERT/UPDATE/DELETE blocked at policy level (Recommended) | Read-only from RLS perspective. Backend service-role does all writes. Mirrors messages RLS. | ✓ |
| Full CRUD policies | Allows frontend writes; adds attack surface; backend already handles all writes. | |
| INSERT-only (audit-style) | Doesn't fit — runs are mutable across lifecycle. | |

**User's choice:** SELECT-only RLS.

---

## Producer architecture

### Q1 — Queue vs direct XADD

| Option | Description | Selected |
|--------|-------------|----------|
| Producer XADDs directly; in-memory queue removed (Recommended) | Cleanest. Every queue.put becomes redis.xadd. Consumer reads same `data` field. Smallest mental model. | ✓ |
| Keep asyncio.Queue + drainer task | Three tasks; more failure modes; no clear win at v2.5 scale. | |
| Producer XADDs AND puts on local queue for origin consumer | Dual code paths, behavioral divergence between origin and reattached. | |

**User's choice:** Direct XADD. asyncio.Queue from 059 removed entirely.

### Q2 — Producer task lifetime / ownership

| Option | Description | Selected |
|--------|-------------|----------|
| Module-level RUN_TASKS registry (Recommended) | Process-local dict[uuid, asyncio.Task]. Producer's finally self-removes. 062's cancel verb uses it. App lifespan close cancels all. Single-worker (D-v2.5-02) makes this simple. | ✓ |
| asyncio.create_task without registry | Spawn-and-forget. 062 needs registry anyway, deferring just makes 062 bigger. | |
| asyncio.TaskGroup at lifespan | Surprising cancel-cascade semantics; registry is simpler. | |

**User's choice:** RUN_TASKS module-level registry.

### Q3 — Consumer termination signal

| Option | Description | Selected |
|--------|-------------|----------|
| Producer writes terminal sentinel; consumer breaks on receipt (Recommended) | Mirrors 059's None sentinel pattern in Redis. Frontend already routes on `type` field. Multi-tab consumers each see same sentinel. | ✓ |
| Consumer polls runs.status from Postgres | DB latency on every iteration; couples consumer to Postgres. | |
| Max-wait timeout only | Catches producer-crash case. Use as safety net alongside sentinel, not as primary signal. | |

**User's choice:** Terminal sentinel + defensive max-wait safety net (130s = hard timeout + 10s grace).

### Q4 — Redis client lifecycle

| Option | Description | Selected |
|--------|-------------|----------|
| Singleton in dependencies.py::get_redis() (Recommended) | Mirrors get_supabase() pattern. Lazy-init, module cache. Lifespan close calls aclose(). | ✓ |
| app.state.redis from lifespan | Slightly more idiomatic FastAPI but inconsistent with supabase pattern. | |
| Per-task new connection | Wasteful: TCP handshake per request. | |

**User's choice:** get_redis() singleton in dependencies.py.

---

## Redis test infrastructure

### Q1 — Test substrate

| Option | Description | Selected |
|--------|-------------|----------|
| Real Redis via docker-compose.dev.yml (Recommended) | Match production 1:1. Streams semantics are subtle; fakeredis lags. Local dev already has Redis. CI adds compose-up step. | ✓ |
| fakeredis | No Docker needed. Streams support has divergences vs real Redis. Passing fakeredis can mask real failures. | |
| testcontainers-python | Real Redis + hermetic isolation. Adds heavyweight dep, ~5–10s startup tax. Overkill at v2.5 scale. | |

**User's choice:** Real Redis via docker-compose.dev.yml. CI assumes Redis is up.

### Q2 — 061 binding test shape

| Option | Description | Selected |
|--------|-------------|----------|
| test_061_producer_survives_disconnect.py: drive POST mid-stream, abort consumer, assert XADD count grows + sentinel + runs.status=completed (Recommended) | Mirrors 058/059 binding pattern. Slow-mock-LLM fixture. Plus regression assertion that 058 cross-tab GET <1s holds. | ✓ |
| Two separate tests (XADD persistence; runs.status update) | Separation-of-concerns; minor preference; risks drift. | |
| Reuse 059's disconnect test pointed at Redis | Misses SC#3 — different invariant (producer NOT cancelled vs cancelled). | |

**User's choice:** New test file. Single deterministic assertion combining all three properties.

### Q3 — 059 disconnect test under 061's new contract

| Option | Description | Selected |
|--------|-------------|----------|
| Invert: rewrite to assert producer survives disconnect (Recommended) | Contract changes intentionally per D-v2.5-08/SC#3. Document in commit message + 061-VERIFICATION.md. | ✓ |
| Delete outright | Loses regression history. | |
| Skip with @pytest.mark.skip | Conservative; leaves dead-skipped tests indefinitely. | |

**User's choice:** Invert in 061's scope. Documented contract change.

### Q4 — Test isolation between concurrent runs

| Option | Description | Selected |
|--------|-------------|----------|
| UUID run_ids prevent collision; session-end FLUSHDB (Recommended) | UUIDs make collision statistically impossible. Production code carries no test-specific config. | ✓ |
| Per-test key prefix | Test config bleeds into production code. Overkill for UUIDs. | |
| Spin testcontainers per test class | Already rejected; fallback only. | |

**User's choice:** UUID-based isolation, session-end FLUSHDB.

---

## Claude's Discretion

The following are explicitly delegated to the planner / executor — no user-facing decision needed:

- Whether RUN_TASKS and agent_runner extract to `_run_registry.py` / `_agent_runner.py` or stay nested in threads.py. Functionally equivalent.
- Exact redis-py version pin (latest stable 5.x, Python 3.12 compatible).
- `_emit(run_id, type, **fields)` helper or inline xadd calls — purely ergonomics.
- Test fixture name (`redis_client`, `aredis`, etc.).
- Consumer two-mode XREAD loop structure (if/else vs separate async-for blocks).
- Whether `RUN_HARD_TIMEOUT_SECONDS` lives next to `anyio_thread_tokens` in Settings or in a nested `RunStreamingSettings` model.
- XADD MAXLEN cap (recommend ~10000; planner can drop if it complicates call site).
- Whether `runs_by_thread:{thread_id}` ZADD/ZREM happens in producer's finally or via a route-handler helper.
- /health Redis ping result caching (PING is sub-millisecond; uncached fine).
- error column wording conventions (e.g., `'hard_timeout'`, `'llm_api_error'`, `'cancelled_by_user'`) — planner picks consistent strings.
- Token-counter accounting source (SDK return value vs tiktoken estimate).

---

## Deferred Ideas

- Abandoned-run sweeper task (revisit if cost evidence accumulates post-061; D-061-02).
- Cleanup of `runs:active` and `runs_by_thread:{id}` sorted-set entries on Stream key EXPIRE (passive cleanup at query time in 061).
- testcontainers-python fallback if UUID isolation flakes under pytest-xdist.
- asyncpg / async Supabase client migration (CONCUR-03; future requirement).
- Hidden /__health/sse observability endpoint (carried from 059 deferred list).
- Structured `event:` field routing on the SSE wire (currently data-only with `type` discriminator).
- KI-001 mid-LLM-call cancellation (still bounded by yield-point semantics; 120s timeout is the wall-clock guard).
- Cross-worker coordination if uvicorn ever scales to --workers N>1 (062's DELETE /runs/{id} would need Redis Pub/Sub).
- Token-counter accounting source decision (deferred until billing/usage UI lands).
- message_id NULL-vs-failure semantics on persist failure.
