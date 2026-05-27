# Phase 073: asyncpg Pool Integration - Research

**Researched:** 2026-05-17
**Domain:** Async Postgres connection pooling (asyncpg) + LLM streaming usage extraction (OpenAI / Anthropic / OpenRouter)
**Confidence:** HIGH

## Summary

Phase 073 has an unusually concentrated scope: introduce a single `asyncpg>=0.29` pool singleton, flip exactly three call sites in `backend/app/api/threads.py`, register a JSONB codec, harvest LLM `usage` into two run-level accumulators, and write them into the same finalize UPDATE that the asyncpg flip is touching. Almost every architectural decision is already locked in `073-CONTEXT.md` (D-073-01..12). The role of this research is to ground those decisions against verified SDK behavior — especially the asyncpg `init=` callback signature, the openai-python 2.28.0 stream_options final-chunk shape, the anthropic 0.97.0 `message_start` / `message_delta` usage payload, and the OpenRouter pass-through semantics.

Two findings warrant the planner's attention before drafting plans:

1. **D-073-06 wording is slightly imprecise.** The CONTEXT calls for `await pool.set_type_codec('jsonb', ...)` but `asyncpg.Pool` does **not** have a `set_type_codec` method. The canonical pattern (verified via Context7 from MagicStack/asyncpg docs) is to pass an `init=` async callback to `asyncpg.create_pool()`; the callback receives each newly-created `Connection` and calls `await conn.set_type_codec(...)` on it. The semantic intent of D-073-06 is preserved — codec registered once per connection at pool init — but the planner should write the code against `init=init_pg_connection` rather than a pool-level method that doesn't exist.

2. **OpenRouter's `stream_options.include_usage` is officially "deprecated, has no effect — usage always returned" as of 2026.** This is favorable: turning the flag on globally per D-073-08 is harmless on OpenRouter routes (forward-compatible no-op), and the final-chunk usage shape matches OpenAI's. The Phase 073 finalize logic should look at the final chunk's `chunk.usage` regardless of route; the flag is a defense for OpenAI-direct routes that still require it. [VERIFIED: OpenRouter docs 2026]

**Primary recommendation:** Mirror `get_redis()` verbatim for `get_pg_pool()`; pass an `init=` async callback for JSONB codec registration; close the pool BEFORE Supabase in the lifespan shutdown; accumulate usage in two `nonlocal` closure slots inside `send_message` (the same scope that already owns `full_content` / `persisted_tool_calls` / `_message_persisted`); finalize writes whatever's in the slots or NULL if both still 0, with a `logger.warning` on the NULL path. Use a hybrid test strategy: a `_build_mock_pg_pool()` AsyncMock factory in `_run_helpers.py` for the unit layer, plus a real local `:54322` asyncpg pool fixture for the new `test_073_concurrency.py` integration gate.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Connection Topology & Pool Config**
- **D-073-01:** asyncpg connects to **direct Postgres on port 5432** (not the Supabase pooler on 6543). Statement-cache stays at asyncpg's default. The pgbouncer transaction-mode pooler is documented in Phase 080 as a v3.x scaling lever — not needed for v2.6's `--workers 2` target.
- **D-073-02:** Connection string comes from a **new `POSTGRES_DSN` env var** added to `backend/.env.example` next to `SUPABASE_URL` / `REDIS_URL`. Local default: `postgresql://postgres:postgres@127.0.0.1:54322/postgres`. Cloud: paste from Supabase dashboard. Same pattern as Redis. Decouples asyncpg from the supabase-py URL shape.
- **D-073-03:** Pool **min=2 / max=10, env-tunable** via `POSTGRES_POOL_MIN` / `POSTGRES_POOL_MAX`. Leaves headroom for `--workers 2` in Phase 079 (effective ceiling 20 connections, well under Supabase defaults). Conservative enough that the single-worker case today doesn't waste connections.

**Scope of the asyncpg Flip**
- **D-073-04:** **SC-minimum scope.** Exactly three call sites in `backend/app/api/threads.py` flip from `aexec` → asyncpg:
  1. `runs` INSERT at `~line 974` (run row creation at request entry)
  2. `runs` UPDATE finalize at `~line 2651` inside `_shielded_finalize`
  3. `messages` INSERT at `~line 1310` inside `_persist_assistant_message`
  Every other supabase-py call stays on `aexec`. Smallest diff, tightest test surface.
- **D-073-05:** SQL strings live in a **new typed helper module `backend/app/db/runs.py`**. Exports: `insert_run(pool, ...)`, `finalize_run(pool, run_id, status, error, completed_at, message_id, input_tokens, output_tokens)`, `insert_assistant_message(pool, ...) -> UUID`.
- **D-073-06:** Pool registers a **JSONB codec at init time** via `await pool.set_type_codec('jsonb', encoder=json.dumps, decoder=json.loads, schema='pg_catalog')`. Call sites pass plain Python dicts/lists for `tool_calls`, `source_refs`, `confidence_*`, and the runs `error` column — no per-call `json.dumps` boilerplate. (See §Code Examples below for the exact `init=` callback shape — `pool.set_type_codec` is not a method; the codec is registered on each connection via the `init` parameter to `create_pool`.)

**Token Capture Mechanics (TOKEN-COL-01)**
- **D-073-07:** `runs.input_tokens` and `runs.output_tokens` represent the **sum across all LLM iterations** in a run (think → tool → think → respond → ...). Two run-level slots accumulate per-call usage as the agent loop iterates; the finalize UPDATE writes totals.
- **D-073-08:** `stream_options={'include_usage': True}` enabled **globally** on every streaming `chat.completions.create` call (OpenAI service + OpenRouter routing). Zero cost; adds one extra final chunk per stream containing usage. Anthropic native SDK already exposes usage on `MessageStart` / `MessageDelta` events without a flag.
- **D-073-09:** When the SDK doesn't surface usage (provider gap, network race, parsing fail), finalize writes **`NULL` + emits `logger.warning('runs.usage missing for run=%s provider=%s model=%s', ...)`**. NULL is the type-safe sentinel; no `0/0` write.

**Test Strategy**
- **D-073-10:** **Hybrid mock + real Postgres.** Unit tests against `backend/app/db/runs.py` use an `AsyncMock` pool. Integration tests hit local Supabase Postgres on `:54322` via a real asyncpg pool fixture.
- **D-073-11:** **Two binding gates, no overlap.** Keep `test_058_concurrency.py` as-is (mock-Supabase). Add new `test_073_concurrency.py` that drives a real asyncpg pool against local Postgres, asserts cross-tab GET stays <1s while an asyncpg-finalized run is in flight, AND asserts `runs.input_tokens` / `runs.output_tokens` are non-NULL on a happy-path run.
- **D-073-12:** New autouse fixture **`_reset_pg_pool_singleton`** in `backend/tests/conftest.py` mirrors `_reset_redis_singleton` pattern. Clears module-level `_pg_pool` before each test, awaits `pool.close()` in teardown if non-None.

### Claude's Discretion
- **Pool init pattern.** Default to lazy init mirroring `get_redis()` at `dependencies.py:20-44`. Planner can pick eager-at-startup-lifespan if there's a concrete reason.
- **Lifespan shutdown ordering.** Close `_pg_pool` before `_supabase` in `backend/app/main.py` lifespan (mirrors the Redis-then-Supabase order already established).
- **Connection auth.** Password embedded in `POSTGRES_DSN` (standard postgres pattern). No separate password lookup.
- **Exact SQL string shape** in `db/runs.py`. Planner finalizes column names + `RETURNING` clauses against the live schema in `supabase/full-schema.sql`.
- **Anthropic / Google / OpenRouter exact usage-extraction shape.** Planner finalizes per-SDK based on what each provider's stream events / response objects expose. Strategy: capture if surfaced; D-073-09 NULL-path if not.
- **Backward-compat shim for `aexec` import in `threads.py`.** Keep the import even if 0 hot-path callers remain in some refactor pass — `aexec` is still imported in 5 other modules.

### Deferred Ideas (OUT OF SCOPE)
- **pgbouncer transaction-mode pooler / Supabase :6543 endpoint.** Documented in Phase 080 as a v3.x scaling lever.
- **`--workers N` enable + D-PRD-12 ADR authoring + `CLAUDE.md` rule rewrite.** Phase 079 owns this; Phase 077 validates; Phase 080 docs.
- **v3.1 admin dashboard rendering of token-usage + missing-usage warning signal.**
- **Cached-token columns** (`input_tokens_cached_read`, etc.). PRD §3 Theme F explicitly scopes to `input_tokens` + `output_tokens` only.
- **Retry-accounting policy** (when a transient provider error retries inside the same run, do we double-count tokens?). Defer to v3.4 spend-cap work.
- **Aggressive hot-path flip** (the alternative to D-073-04). Not pre-planned; conditional on Phase 077 findings.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| WORKER-LIFT-02 | `asyncpg` connection pool replaces sync `supabase-py` calls inside the streaming endpoint (`agent_runner` Postgres reads/writes in `threads.py`) and inside `_drain_stream_with_close_on_cancel`'s persistence finalize path. CONCUR-01 binding pytest gate stays green. | §Standard Stack (asyncpg pool params + init callback) + §Architecture Patterns (singleton + lazy init mirroring `get_redis()`) + §Code Examples (pool init, JSONB codec, lifespan close) + §Validation Architecture (test_073_concurrency.py shape) |
| TOKEN-COL-01 | `runs.input_tokens` and `runs.output_tokens` are populated for every completed LLM call (read from response `usage`). Backfill: existing NULL rows stay NULL — forward-fill only. NULL writes after this ship become a dashboard warning. No caps or limits introduced. | §Standard Stack (openai 2.28.0 stream_options + anthropic 0.97.0 streaming usage shape) + §Architecture Patterns (run-level accumulator in send_message closure) + §Code Examples (usage extraction per SDK) + §Common Pitfalls (final-chunk delivery edge cases) |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Singleton `_pg_pool` + lazy-init `get_pg_pool()` | API / Backend (`backend/app/dependencies.py`) | — | Mirrors `get_redis()` exactly; shared module-level cache lives in the dependencies module today |
| `asyncpg.create_pool` invocation + `init=` JSONB codec callback | API / Backend (`dependencies.py`) | — | First-acquire happens at the first hot-path call site; no startup-time I/O |
| Typed SQL helpers (`insert_run` / `finalize_run` / `insert_assistant_message`) | API / Backend (`backend/app/db/runs.py` — NEW module) | — | Decouples SQL strings from the agent-loop business logic; mirrors how `multimodal_service` factors writes |
| Three hot-path flips (runs INSERT / runs UPDATE finalize / messages INSERT) | API / Backend (`backend/app/api/threads.py`) | — | The hot path itself; only the three SC-named call sites flip |
| Pool close on shutdown | API / Backend (`backend/app/main.py` lifespan) | — | Existing lifespan ordering: Redis aclose → (NEW) pg pool close → Supabase aclose |
| Token-usage accumulators (`input_tokens_total`, `output_tokens_total`) | API / Backend (`send_message` closure inside `threads.py`) | — | Same lexical scope as `full_content` + `persisted_tool_calls`; the finalize UPDATE reads them directly |
| Per-iteration usage extraction (OpenAI stream final chunk) | API / Backend (`threads.py` OpenAI branch via `_drain_stream_with_close_on_cancel` on-chunk callback) | Service-layer (`openai_service.py` flips `stream_options`) | The flag flips in openai_service.py; the usage extraction happens in threads.py's chunk callback because it owns the accumulator |
| Per-iteration usage extraction (Anthropic native SDK) | API / Backend (`threads.py` Anthropic branch on-chunk callback) | Service-layer (`anthropic_service.py` yields usage events) | `anthropic_service.py` needs a new normalized event yield (e.g. `{"type": "usage", "input": N, "output": M}`); threads.py adds a `_etype == "usage"` branch in `_on_chunk_anthropic` to accumulate |
| Test framework + `_reset_pg_pool_singleton` autouse fixture | Tests (`backend/tests/conftest.py`) | — | Single source of truth; pattern formalized for the whole suite per D-073-12 |
| Real-Postgres integration gate | Tests (`backend/tests/integration/test_073_concurrency.py` — NEW) | — | Drives `:54322` directly; mirrors `test_058_concurrency.py` scaffolding |
| `_build_mock_pg_pool()` AsyncMock factory | Tests (`backend/tests/integration/_run_helpers.py`) | — | Sibling of `_build_mock_supabase()`; reused across unit tests against `db/runs.py` |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| asyncpg | `>=0.29` (latest: `0.31.0` on 2025-11-24) | Async Postgres connection pool + binary-protocol driver | Canonical async Postgres driver for Python; no GIL hand-off via thread pool; pgvector-compatible. asyncpg 0.30 added Python 3.13 + PG 17; 0.31 added Python 3.14 + `servicefile` param. `>=0.29` is the floor that keeps us future-compatible. [VERIFIED: pypi.org/project/asyncpg + asyncpg release notes] |
| openai (existing) | `2.28.0` (already pinned) | Streaming chat completions + `stream_options={'include_usage': True}` | Current install confirmed via `backend/venv/Lib/site-packages/openai-2.28.0.dist-info/METADATA`. `stream_options` support has been in openai-python since 1.x; 2.28.0 supports it via `ChatCompletionStreamOptionsParam` (verified in `openai-python` SDK source). [VERIFIED: Context7 /openai/openai-python docs] |
| anthropic (existing) | `0.97.0` (already pinned) | Streaming Messages API with usage on `message_start` / `message_delta` | Current install confirmed. Stream events expose `usage.input_tokens` on `message_start` and `usage.output_tokens` (final) on `message_delta`. [CITED: docs.anthropic.com/en/docs/build-with-claude/streaming + DeepWiki anthropic-sdk-python streaming] |
| supabase (existing) | `2.29.0` (already pinned) | All cold-path calls (NOT changed by this phase) | Verified no transitive dep on asyncpg; httpx>=0.26,<0.29 pin is the only constraint. asyncpg adds zero dependency conflicts. [VERIFIED: METADATA in venv] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `json` (stdlib) | — | `encoder=json.dumps, decoder=json.loads` in the asyncpg JSONB codec | Required in the `init=` callback; no third-party JSON lib needed |
| `pytest-asyncio` (existing) | (pinned in requirements) | Per-test event-loop scope (`asyncio_mode = auto`) | Drives the `_reset_pg_pool_singleton` fixture requirement — confirmed `backend/pytest.ini` has `asyncio_mode = auto`, so every async test gets a fresh loop, which is exactly the trap D-073-12 guards against |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Direct Postgres on `:5432` (D-073-01) | Supabase pooler `:6543` (pgbouncer transaction-mode) | Pgbouncer transaction-mode requires `statement_cache_size=0` on asyncpg, disables prepared-statement reuse, and increases per-query latency. Locked out by D-073-01 in favor of direct connection. [VERIFIED: supabase/supabase GitHub issue #39227 + medium.com/@patrickduch93 "Supabase Pooling and asyncpg Don't Mix"] |
| Custom JSONB codec (D-073-06) | Pass `json.dumps(...)` at every call site | Boilerplate at 3 call sites today, grows linearly as more JSONB columns get written. The codec is a one-liner in `init=` and removes the friction permanently. [CITED: Context7 asyncpg "Custom Type Codecs"] |
| `nonlocal` closure slots for usage accumulators | Module-level `dict[run_id, dict]` registry | Closure slots live for exactly the agent_runner coroutine's lifetime, evict naturally on return, and don't need explicit cleanup. Module-level dict would need its own `pop()` in the finalize path and a stale-entry sweeper. The closure shape mirrors `_message_persisted`, `full_content`, etc. that already live in the same scope. |
| AsyncMock pool for ALL tests | Real Postgres for all tests | Real Postgres tests are slow and require docker-compose preamble; AsyncMock is fast but doesn't catch SQL-string typos, codec issues, or constraint violations. Hybrid (D-073-10) is the right tradeoff. |

**Installation:**
```bash
# In backend/requirements.txt — insert between redis and supabase (alphabetical-ish):
asyncpg>=0.29
```

**Version verification:** `asyncpg>=0.29` is the documented floor in the phase goal. Latest stable is `0.31.0` (2025-11-24). [VERIFIED: pypi.org/project/asyncpg + WebSearch 2026] No upper bound recommended — semver-respecting library, breaking-change history is minimal.

## Architecture Patterns

### System Architecture Diagram

```
                  Request enters
                       │
                       ▼
        ┌──────────────────────────────┐
        │   POST /threads/{id}/messages │
        │      (threads.py:909+)        │
        └──────────────────────────────┘
                       │
       ┌───────────────┴───────────────┐
       │                                │
       ▼                                ▼
  Cold-path reads             ┌────────────────┐
  (thread SELECT,             │  runs INSERT   │  ◄── FLIP #1 (D-073-04 site 1)
   history SELECT,            │  threads.py:974│      pool.fetchval(insert_run)
   user msg INSERT)           └────────────────┘
       │                              │
       ▼                              ▼
   aexec()  (unchanged)        asyncio.create_task(agent_runner)
                                      │
                                      ▼
              ┌────────────────────────────────────────┐
              │           agent_runner loop             │
              │                                         │
              │  for iteration in range(max_iterations):│
              │     ┌──────────────────────────────┐   │
              │     │  stream LLM call             │   │
              │     │  (OpenAI / Anthropic /       │   │
              │     │   OpenRouter via _drain_     │   │
              │     │   stream_with_close_on_cancel│   │
              │     │                              │   │
              │     │  on_chunk callback:          │   │
              │     │   - delta → emit             │   │
              │     │   - tool_start → buffer      │   │
              │     │   - usage  → ACCUMULATE  ◄───┼───┼── TOKEN-COL-01 capture
              │     │       input_tokens_total +=  │   │   (D-073-07/08)
              │     │       output_tokens_total += │   │
              │     └──────────────────────────────┘   │
              │     execute tool calls (if any)        │
              │     append tool results to messages    │
              └────────────────────────────────────────┘
                              │
                              ▼
              ┌────────────────────────────────────────┐
              │       _shielded_finalize()              │
              │       threads.py:2616-2682              │
              │                                         │
              │  1. _persist_assistant_message()        │
              │     ┌──────────────────────────┐       │
              │     │ messages INSERT          │ ◄─────┼── FLIP #3 (D-073-04 site 3)
              │     │ threads.py:1310          │       │   pool.fetchval(insert_msg)
              │     │ returns message_id       │       │
              │     └──────────────────────────┘       │
              │                                         │
              │  2. terminal sentinel XADD (Redis)      │
              │                                         │
              │  3. runs UPDATE                         │
              │     ┌──────────────────────────┐       │
              │     │ runs UPDATE              │ ◄─────┼── FLIP #2 (D-073-04 site 2)
              │     │ threads.py:2651          │       │   pool.execute(finalize_run)
              │     │ status, error,           │       │   + TOKEN-COL-01 writes
              │     │ completed_at,            │       │   (or NULL + warn per D-073-09)
              │     │ message_id,              │       │
              │     │ input_tokens,            │       │
              │     │ output_tokens            │       │
              │     └──────────────────────────┘       │
              │                                         │
              │  4. EXPIRE Redis stream                 │
              │  5. ZREM sorted-set indexes             │
              │  6. RUN_TASKS.pop                       │
              └────────────────────────────────────────┘
                              │
                              ▼
                       (response complete)
```

### Recommended Project Structure

```
backend/
├── app/
│   ├── dependencies.py            # +get_pg_pool() singleton (mirrors get_redis())
│   ├── main.py                    # +await _pg_pool.close() in lifespan (BEFORE _supabase.aclose())
│   ├── utils/
│   │   └── db.py                  # aexec() — UNCHANGED, preserved per D-073-04 / SC#4
│   ├── db/                        # NEW module (D-073-05)
│   │   ├── __init__.py            # empty / re-exports
│   │   └── runs.py                # insert_run() / finalize_run() / insert_assistant_message()
│   ├── api/
│   │   └── threads.py             # 3 surgical flips at the SC-named call sites
│   └── services/
│       ├── openai_service.py      # +stream_options={'include_usage': True} on create()
│       └── anthropic_service.py   # +yield usage event from message_start / message_delta
├── tests/
│   ├── conftest.py                # +_reset_pg_pool_singleton autouse fixture (D-073-12)
│   └── integration/
│       ├── _run_helpers.py        # +_build_mock_pg_pool() factory (sibling of _build_mock_supabase)
│       ├── test_058_concurrency.py    # UNCHANGED — preserves CONCUR-01 mock-Supabase gate (SC#2)
│       └── test_073_concurrency.py    # NEW — real asyncpg pool + TOKEN-COL-01 non-NULL assertion
└── .env.example                   # +POSTGRES_DSN, POSTGRES_POOL_MIN, POSTGRES_POOL_MAX
```

### Pattern 1: Singleton + Lazy Init + Lifespan Close (mirror `get_redis()`)
**What:** Module-level cache, no I/O at call time, closed in lifespan via `await pool.close()`.
**When to use:** This is THE established pattern for shared async clients in this codebase (Supabase, Redis, now asyncpg). Don't invent a new shape.
**Source:** `backend/app/dependencies.py:20-44` (get_redis), `backend/app/main.py:99-105` (lifespan close ordering)
**Example:**
```python
# backend/app/dependencies.py — NEW additions (mirrors get_redis() exactly)

import asyncpg
import json

_pg_pool: asyncpg.Pool | None = None


async def _init_pg_connection(conn: asyncpg.Connection) -> None:
    """Called once per connection on pool init (D-073-06).

    Registers JSONB codec so call sites pass plain dicts/lists. Without
    this, asyncpg returns jsonb as str (forcing per-call json.loads) and
    accepts jsonb writes as str only (forcing per-call json.dumps).
    """
    await conn.set_type_codec(
        'jsonb',
        encoder=json.dumps,
        decoder=json.loads,
        schema='pg_catalog',
    )


async def get_pg_pool() -> asyncpg.Pool:
    """Return the singleton asyncpg pool (Phase 073 — D-073-01/02/03/06).

    Mirrors get_redis(): module-level cache, lazy init at first call, no
    I/O at call time (create_pool returns immediately; first acquire does
    the TCP handshake). Closed in app lifespan via await pool.close().

    DSN comes from POSTGRES_DSN env var (D-073-02). Pool sized via
    POSTGRES_POOL_MIN / POSTGRES_POOL_MAX (D-073-03, default 2/10).

    Event-loop binding (Pitfall — see Common Pitfalls #1): the pool is
    bound to whatever event loop called create_pool. In tests, this
    requires the _reset_pg_pool_singleton autouse fixture (D-073-12).
    """
    global _pg_pool
    if _pg_pool is None:
        _pg_pool = await asyncpg.create_pool(
            settings.postgres_dsn,
            min_size=settings.postgres_pool_min,
            max_size=settings.postgres_pool_max,
            init=_init_pg_connection,
            command_timeout=30,  # per-query timeout; prevents stuck queries from wedging the pool
        )
    return _pg_pool
```
```python
# backend/app/main.py — lifespan shutdown (insert BEFORE _supabase.aclose())

    # Close the asyncpg pool BEFORE Supabase (matches Redis-then-Supabase order).
    # pool.close() waits for in-flight queries; wrap in wait_for so a stuck
    # query can't wedge shutdown. Falls back to pool.terminate() on timeout.
    try:
        from app.dependencies import _pg_pool
        if _pg_pool is not None:
            try:
                await asyncio.wait_for(_pg_pool.close(), timeout=5.0)
            except asyncio.TimeoutError:
                logger.warning("pg pool close timed out — terminating")
                _pg_pool.terminate()
    except Exception:
        logger.exception("pg pool close failed at shutdown")
```

### Pattern 2: Typed SQL Helpers (`backend/app/db/runs.py`)
**What:** SQL strings live in a single module with typed Python signatures; the route handler imports `insert_run` / `finalize_run` / `insert_assistant_message` and calls them.
**When to use:** Whenever a hot-path call site flips to asyncpg. Keeps `threads.py` readable; lets unit tests patch the module function directly.
**Source:** Analogous to `backend/app/services/multimodal_service.py` factoring SQL writes today; D-073-05.
**Example:**
```python
# backend/app/db/runs.py — NEW module

from datetime import datetime
from uuid import UUID
import asyncpg


async def insert_run(
    pool: asyncpg.Pool,
    *,
    run_id: UUID,
    thread_id: UUID,
    user_id: UUID,
    status: str,
    model: str,
    provider: str,
) -> None:
    """Phase 073 — replaces aexec(supabase.table('runs').insert(...)) at threads.py:974."""
    await pool.execute(
        """
        INSERT INTO runs (run_id, thread_id, user_id, status, model, provider)
        VALUES ($1, $2, $3, $4, $5, $6)
        """,
        run_id, thread_id, user_id, status, model, provider,
    )


async def finalize_run(
    pool: asyncpg.Pool,
    *,
    run_id: UUID,
    status: str,
    error: str | None,
    completed_at: datetime,
    message_id: UUID | None,
    input_tokens: int | None,
    output_tokens: int | None,
) -> None:
    """Phase 073 — replaces aexec(supabase.table('runs').update(...)) at threads.py:2651.

    TOKEN-COL-01 (D-073-07/09): input_tokens/output_tokens may be None
    (NULL write) if the SDK didn't surface usage on any iteration.
    """
    await pool.execute(
        """
        UPDATE runs
        SET status = $2,
            error = $3,
            completed_at = $4,
            message_id = $5,
            input_tokens = $6,
            output_tokens = $7
        WHERE run_id = $1
        """,
        run_id, status, error, completed_at, message_id, input_tokens, output_tokens,
    )


async def insert_assistant_message(
    pool: asyncpg.Pool,
    *,
    thread_id: UUID,
    user_id: UUID,
    content: str,
    tool_calls: list[dict] | None = None,
    source_refs: list[dict] | None = None,
    confidence_level: str | None = None,
    confidence_avg_similarity: float | None = None,
    confidence_disclaimer: str | None = None,
) -> UUID:
    """Phase 073 — replaces aexec(supabase.table('messages').insert(row)) at threads.py:1310.

    Returns the inserted message_id (UUID) so _persist_assistant_message
    can cache it for the runs UPDATE message_id column (Phase 061 D-061-05).

    JSONB codec (D-073-06) means tool_calls / source_refs flow as plain
    Python lists — no per-call json.dumps required.
    """
    return await pool.fetchval(
        """
        INSERT INTO messages (
            thread_id, user_id, role, content,
            tool_calls, source_refs,
            confidence_level, confidence_avg_similarity, confidence_disclaimer
        )
        VALUES ($1, $2, 'assistant', $3, $4, $5, $6, $7, $8)
        RETURNING id
        """,
        thread_id, user_id, content,
        tool_calls, source_refs,
        confidence_level, confidence_avg_similarity, confidence_disclaimer,
    )
```

### Pattern 3: Run-Level Token Accumulator (D-073-07)
**What:** Two `nonlocal` slots inside `send_message`'s agent_runner closure, written by each iteration's on-chunk callback, read by `_shielded_finalize`.
**When to use:** Multi-iteration LLM loops where the run-level total is the value of interest, not any single call's value.
**Source:** Sibling of `full_content`, `_message_persisted`, `_persisted_msg_id` slots already in send_message scope.
**Example:**
```python
# backend/app/api/threads.py — inside send_message, near full_content init (~line 1256)

            full_content = ""
            persisted_tool_calls: list[dict] = []
            # ...
            # Phase 073 TOKEN-COL-01 (D-073-07): per-run usage accumulators.
            # Both default to None — D-073-09 NULL sentinel if NO iteration
            # produced a usage payload. First successful usage flips to int
            # and subsequent ones add on top.
            input_tokens_total: int | None = None
            output_tokens_total: int | None = None

            # ... (inside on-chunk callback for each provider, when usage event arrives:)
            #   if input_tokens_total is None:
            #       input_tokens_total = chunk_input
            #       output_tokens_total = chunk_output
            #   else:
            #       input_tokens_total += chunk_input
            #       output_tokens_total += chunk_output

            # ... (inside _shielded_finalize, replacing the aexec UPDATE at line 2651:)
            try:
                if input_tokens_total is None and output_tokens_total is None:
                    logger.warning(
                        "runs.usage missing for run=%s provider=%s model=%s",
                        run_id, _resolved_provider, _resolved_model,
                    )
                await finalize_run(
                    await get_pg_pool(),
                    run_id=run_id,
                    status=_terminal_status,
                    error=_terminal_error,
                    completed_at=datetime.now(timezone.utc),
                    message_id=UUID(_msg_id_for_runs) if _msg_id_for_runs else None,
                    input_tokens=input_tokens_total,
                    output_tokens=output_tokens_total,
                )
            except BaseException:
                logger.exception("runs row UPDATE failed for run %s", run_id)
```

### Pattern 4: Per-Provider Usage Extraction
**What:** Each provider branch's on-chunk callback adds a usage-extraction line that bumps the accumulator.
**When to use:** Every streaming branch (OpenAI / OpenRouter / Anthropic) needs it; Google currently routes through OpenAI-compat shim or OpenRouter (no separate google-genai SDK in requirements.txt).
**Source:** Inferred from threads.py OpenAI/Anthropic branches at ~1390 + openai-python streaming docs + anthropic streaming docs.
**Example (OpenAI / OpenRouter):**
```python
# Inside openai_service.py create_adaptive_streaming_chat (around line 808):
    kwargs: dict = {
        "model": effective_model,
        "messages": messages,
        "stream": True,
        # Phase 073 D-073-08: enable usage on every streaming call globally.
        # OpenAI: emits one extra final chunk with chunk.usage populated and
        #         empty choices=[].
        # OpenRouter: pass-through (officially deprecated but harmless;
        #         OpenRouter always returns usage now).
        "stream_options": {"include_usage": True},
        token_param: effective_tokens,
    }
```
```python
# Inside threads.py OpenAI on-chunk callback (around line 1465-ish):
async def _on_chunk_openai(chunk):
    nonlocal full_content, finish_reason, input_tokens_total, output_tokens_total
    # Phase 073 TOKEN-COL-01: final usage chunk has empty choices=[] and
    # populated chunk.usage. Other chunks have chunk.usage=None.
    if getattr(chunk, "usage", None) is not None:
        u = chunk.usage
        in_t = getattr(u, "prompt_tokens", 0) or 0
        out_t = getattr(u, "completion_tokens", 0) or 0
        if input_tokens_total is None:
            input_tokens_total = in_t
            output_tokens_total = out_t
        else:
            input_tokens_total += in_t
            output_tokens_total += out_t
        return  # usage chunk has empty choices; no delta/tool work to do
    # ... existing delta / tool_call extraction
```
**Example (Anthropic native SDK):**
```python
# Inside anthropic_service.py stream_anthropic (around line 170, in the for-event loop):
            elif event_type == "message_start":
                # Phase 073 TOKEN-COL-01: input_tokens available immediately on stream open.
                m = event.message
                yield {
                    "type": "usage",
                    "input_tokens": getattr(m.usage, "input_tokens", 0),
                    "output_tokens": getattr(m.usage, "output_tokens", 0),
                }
            elif event_type == "message_delta":
                # Phase 073 TOKEN-COL-01: final output_tokens on the delta carrying stop_reason.
                stop_reason = event.delta.stop_reason
                finish_reason = _STOP_REASON_MAP.get(stop_reason or "", "stop")
                if hasattr(event, "usage") and event.usage is not None:
                    yield {
                        "type": "usage_delta",
                        "output_tokens": getattr(event.usage, "output_tokens", 0),
                    }
```
```python
# Inside threads.py Anthropic on-chunk callback (add usage branch around line 1462):
async def _on_chunk_anthropic(_ant_event):
    nonlocal full_content, finish_reason, input_tokens_total, output_tokens_total
    _etype = _ant_event.get("type")
    if _etype == "usage":
        # message_start: input_tokens known immediately, output_tokens starts at 0
        _i = _ant_event.get("input_tokens", 0) or 0
        _o = _ant_event.get("output_tokens", 0) or 0
        if input_tokens_total is None:
            input_tokens_total = _i
            output_tokens_total = _o
        else:
            input_tokens_total += _i
            output_tokens_total += _o
    elif _etype == "usage_delta":
        # message_delta: final cumulative output_tokens for THIS Message
        _o = _ant_event.get("output_tokens", 0) or 0
        if output_tokens_total is not None:
            output_tokens_total += _o
    elif _etype == "delta":
        # ... existing logic
```

### Anti-Patterns to Avoid
- **Calling `pool.set_type_codec(...)` directly on the Pool object.** No such method exists. Codec registration must go through `init=` callback on each Connection. (D-073-06 wording is shorthand — the planner should not write code that mirrors that shorthand literally.) [VERIFIED: Context7 asyncpg Pool API + asyncpg.Pool source code]
- **Module-level pool dict keyed by run_id for token accumulators.** Adds explicit lifecycle management (pop on finalize, sweep on crash) for zero benefit over closure slots. The closure shape already works for every other run-scoped variable in `send_message`.
- **Writing `0` instead of `NULL` when usage is missing.** Locked out by D-073-09. Zero would silently corrupt the v3.1 dashboards' averages; NULL surfaces as "missing" and feeds the warning histogram.
- **Closing pool BEFORE redis.aclose() or AFTER `_supabase.aclose()`.** Wrong order. Phase 073 Discretion locks: redis aclose → pg_pool.close() → _supabase.aclose(). Reason: producer tasks that are mid-finalize may still be writing to pg AND Redis; killing Redis first matches the existing convention (the finalize path uses `BaseException` catch so a dead Redis socket is non-fatal).
- **Trusting `pool.close()` to return promptly under all conditions.** It waits for all in-flight queries to drain. A stuck query wedges shutdown. ALWAYS wrap in `asyncio.wait_for(..., timeout=5.0)` with fallback to `pool.terminate()`. [VERIFIED: github.com/MagicStack/asyncpg issue #290 + WebSearch 2026]
- **Using the supabase pooler `:6543` endpoint for asyncpg.** Triggers prepared-statement errors under pgbouncer transaction-mode. Locked out by D-073-01. [CITED: github.com/supabase/supabase issue #39227]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Async Postgres pool | Custom thread-pool wrapper around psycopg2 | `asyncpg.create_pool()` | Native asyncio; binary protocol; battle-tested with pgvector; statement caching for free at direct-Postgres :5432 |
| JSONB serialization at every call site | `await pool.execute(sql, json.dumps(row['tool_calls']), ...)` | `asyncpg.Connection.set_type_codec('jsonb', encoder=json.dumps, decoder=json.loads, schema='pg_catalog')` via `init=` | Codec runs once per connection; call sites pass plain Python dicts/lists. Standard asyncpg practice. [CITED: Context7 asyncpg "Custom Type Codecs"] |
| Token counting from `response.choices` content | Run a tiktoken counter on the assistant message after the fact | Read `chunk.usage` from the final stream chunk (OpenAI) or `event.usage` (Anthropic `message_start` + `message_delta`) | Provider-reported usage is canonical; tiktoken estimates drift from billing reality; both SDKs surface usage natively when asked |
| Per-test event-loop singleton reset | Manual fixture in every test file | `_reset_pg_pool_singleton` autouse in `backend/tests/conftest.py` | Mirrors `_reset_redis_singleton` precedent (Phase 062 invented; Phase 074 SEED-011 formalizes). Avoids the "Event loop is closed" trap that bit Redis tests. [VERIFIED: pytest-asyncio issue #991 + MagicStack/asyncpg issue #293] |
| Mock Postgres for the integration gate | Stand up an in-process fake or use sqlite | Real local Supabase Postgres on `:54322` | The CONCUR-01 binding gate's whole purpose is to assert real-DB behavior under concurrent load. Mocks pass even when the real bug is present. (Hybrid strategy keeps mocks for SQL-shape unit tests at the helper module layer.) |

**Key insight:** This phase is almost entirely a "wire existing canonical patterns together" exercise. Every primitive is well-established; the only Phase 073 invention is the typed `db/runs.py` helper module and the autouse fixture name. Resist the temptation to add cleverness.

## Runtime State Inventory

> Phase 073 is NOT a rename/refactor — it's an additive integration. This category applies only at the surface level (new env vars). Documenting for completeness because the deployment side of this phase touches operator-facing knobs.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — Phase 073 reads/writes the same `runs` and `messages` tables that the legacy `aexec` path already wrote. No schema change (input_tokens / output_tokens columns already exist per `supabase/full-schema.sql:469-470`). | None |
| Live service config | None — no n8n/Datadog/Tailscale state references this phase. | None |
| OS-registered state | None | None |
| Secrets/env vars | NEW: `POSTGRES_DSN`, `POSTGRES_POOL_MIN`, `POSTGRES_POOL_MAX` in `backend/.env.example`. Local default works without any operator action. Cloud deployments will need a real DSN. | (a) Add three lines to `.env.example` with comments. (b) Document in `supabase/SETUP.md` (cloud-DSN path). (c) Update Hostinger/VPS runbooks in Phase 080 (deferred to that phase). |
| Build artifacts | None — `requirements.txt` change is the only artifact knob; `pip install asyncpg` is a fresh wheel, no stale state. | None |

## Common Pitfalls

### Pitfall 1: Event-loop-bound pool singleton (test-debt category)
**What goes wrong:** `_pg_pool` created on test N's event loop. Test N+1 runs on a fresh loop (per `pytest-asyncio asyncio_mode=auto`). Pool methods raise `RuntimeError: Event loop is closed` or `Future attached to a different loop`. Same exact category that bit Redis tests in Phase 062.
**Why it happens:** asyncpg binds Pool internals to whatever loop called `create_pool()`. pytest-asyncio default scope is function — every async test gets a new loop.
**How to avoid:** `_reset_pg_pool_singleton` autouse fixture in `backend/tests/conftest.py` (D-073-12). Set `_pg_pool = None` before and after each test; await `_pg_pool.close()` in teardown if non-None.
**Warning signs:** `RuntimeError: Event loop is closed` from any asyncpg call in a test that runs AFTER another test. Single-test runs pass; pytest -k 'test_a or test_b' fails.
**Sources:** [VERIFIED: github.com/MagicStack/asyncpg issue #293 "Asyncpg reuses old loop when testing"] [VERIFIED: github.com/pytest-dev/pytest-asyncio issue #991] [CITED: existing precedent at `backend/tests/integration/test_062_stream_replay.py:36-51`]

### Pitfall 2: OpenAI streaming final-chunk usage delivery is conditional
**What goes wrong:** The final chunk that contains `chunk.usage` is delivered AFTER the last content delta as a SEPARATE chunk with `choices=[]`. If the consumer breaks out of the loop on `choices[0].finish_reason`, it never sees the usage chunk. Result: `input_tokens_total` / `output_tokens_total` stay None → NULL write + warning.
**Why it happens:** OpenAI specifically chose to deliver usage as a trailing chunk to keep per-delta latency unchanged. The trailing chunk's `choices` is always `[]`.
**How to avoid:** Don't break the for-loop on `finish_reason`. The existing `_drain_stream_with_close_on_cancel` already iterates to the sentinel (the producer-thread loop runs to natural StopIteration), so the usage chunk WILL be delivered. The new on-chunk callback handles it via the `if getattr(chunk, "usage", None) is not None` early-return — no for-loop break needed.
**Warning signs:** A test pattern using a 4-chunk mock that ends with finish_reason='stop' will MISS the usage path. Mock fixtures must include a 5th synthetic chunk with `usage` populated and `choices=[]` to exercise the capture.
**Sources:** [VERIFIED: cookbook.openai.com + community.openai.com "Usage stats now available when using streaming"] [CITED: openai-python `src/openai/types/chat/chat_completion_chunk.py`]

### Pitfall 3: Stream interruption skips the usage chunk
**What goes wrong:** Client disconnect mid-stream, timeout cancel, lifespan cancel, or upstream HTTP drop. The producer thread's stream iterator never reaches the trailing usage chunk. Accumulator stays None → NULL write triggers (correctly, per D-073-09). This is correct behavior — but the planner needs to NOT mistake this case for a bug.
**Why it happens:** Cancellation paths cause `stream.close()` from the consumer side, which short-circuits the OpenAI client's HTTP response before the trailing usage frame is parsed.
**How to avoid:** Document the behavior in finalize_run docstring. The integration test (`test_073_concurrency.py`) asserts non-NULL on the HAPPY PATH only. Add a sibling test (or comment in the disconnect test) that asserts NULL + warning fires on the cancel path. The CONCUR-01 cross-tab test already exercises the happy path adequately.
**Warning signs:** `runs.input_tokens IS NULL` correlates with `status='cancelled'` or `status='timed_out'` rows. Expected.
**Sources:** [VERIFIED: OpenAI docs "If the stream is interrupted or cancelled, you may not receive the final usage chunk"] [VERIFIED: openai-python issue #1266 "AsyncStream returning only empty choices"]

### Pitfall 4: pool.close() can wedge on stuck queries
**What goes wrong:** `pool.close()` waits indefinitely for all connections to release. A query stuck behind a Postgres lock (or a dead network socket) blocks shutdown forever. asyncpg's own docs flag this.
**Why it happens:** Graceful close is "wait for all in-flight queries to complete." There's no built-in timeout.
**How to avoid:** Wrap close in `asyncio.wait_for(pool.close(), timeout=5.0)`. On timeout, call `pool.terminate()` (fire-and-forget, kills sockets immediately). Mirrors the pattern Redis already uses (socket_timeout=10 prevents the dead-socket trap).
**Warning signs:** uvicorn `--reload` or production graceful shutdown hangs past the SIGTERM grace period.
**Sources:** [VERIFIED: github.com/MagicStack/asyncpg issue #290 "Pool.close() does not close the pool gracefully"] [VERIFIED: sqlalchemy discussion #8418 "Use asyncpg terminate() instead of close()"]

### Pitfall 5: D-073-06 "pool.set_type_codec" wording is misleading
**What goes wrong:** Pool object has no `set_type_codec` method. Following D-073-06 literally crashes with `AttributeError`.
**Why it happens:** The asyncpg API requires per-connection codec registration. The Pool exposes `init=` parameter for "run this on every newly-created connection."
**How to avoid:** Write an `async def _init_pg_connection(conn): await conn.set_type_codec(...)` and pass it as `init=_init_pg_connection` to `create_pool()`. Functionally identical to "codec is set once per connection" (which is what D-073-06 means semantically).
**Warning signs:** Will not get past first import attempt — AttributeError at boot.
**Sources:** [VERIFIED: Context7 asyncpg "Pool Initialization and Setup Callbacks"] [VERIFIED: asyncpg source `asyncpg/pool.py`]

### Pitfall 6: `provider` column in `runs` is NOT NULL
**What goes wrong:** `insert_run` writes `provider` column. Schema constrains it `NOT NULL` (verified at `supabase/full-schema.sql:466`). If the route handler skips providing a provider value (e.g., the `_resolved_provider` resolution at line 957-971 falls through to an unexpected branch), the INSERT fails with a Postgres constraint violation. Surfacing the failure RIGHT at the asyncpg flip looks like a regression, but is preexisting.
**Why it happens:** Phase 067.3 D-067.3-N01 added the provider resolution. The new `insert_run()` helper must pass `_resolved_provider` through; can't accidentally drop it.
**How to avoid:** `insert_run()` signature requires `provider: str` (not Optional). The planner must verify the existing `_resolved_provider` value is always defined at line 974 entry — looking at the code: lines 957-971 always set `_resolved_provider` (the if/else chain has no `pass` branch). Safe.
**Warning signs:** `asyncpg.exceptions.NotNullViolationError` on the runs INSERT.
**Sources:** [VERIFIED: `supabase/full-schema.sql:466` + `backend/app/api/threads.py:957-983`]

### Pitfall 7: JSONB codec mismatch — list vs dict at write site
**What goes wrong:** asyncpg's JSONB codec encodes whatever Python object is passed via `json.dumps`. The existing supabase-py path silently coerces (it sees a dict, sends JSON). With the codec, you MUST pass the exact Python shape that round-trips through JSON — no Pydantic models, no datetime objects without isoformat conversion.
**Why it happens:** `json.dumps` raises `TypeError: Object of type datetime is not JSON serializable` if the dict contains a raw datetime.
**How to avoid:** Inspect existing call sites' dicts. The current `tool_calls` (`row["tool_calls"] = completed_tools`) is a list[dict] of stringified tool-call objects — all JSON-clean (no datetimes, no UUIDs). `source_refs` is list[dict] of strings. Confidence_* fields are scalar primitives. SAFE. But: future additions to these dicts must respect the constraint.
**Warning signs:** `TypeError: Object of type X is not JSON serializable` from `json.dumps` inside asyncpg encoding.
**Sources:** [VERIFIED: Context7 asyncpg type codecs docs] [VERIFIED: existing `threads.py:1289-1307` row construction]

### Pitfall 8: OpenRouter "include_usage deprecated" doesn't mean broken
**What goes wrong:** A reviewer reading OpenRouter docs sees "stream_options.include_usage is deprecated and has no effect" and concludes Phase 073 must conditionally OMIT the flag for OpenRouter routes.
**Why it happens:** OpenRouter moved to always-include-usage some time in late 2025. The flag is harmless; pass-through to underlying providers may still need it for non-OpenRouter direct routes.
**How to avoid:** Pass the flag GLOBALLY per D-073-08. It's a no-op on OpenRouter (forward-compatible) and required on OpenAI direct. Per-provider conditional logic is unnecessary complexity.
**Warning signs:** Reviewer LGTM gets blocked on "should we strip this flag for openrouter?" — answer is no.
**Sources:** [VERIFIED: openrouter.ai/docs/api/reference/streaming + openrouter.ai/docs/use-cases/usage-accounting]

### Pitfall 9: Anthropic `message_delta.usage.output_tokens` is FINAL CUMULATIVE for that Message, not delta-since-last-event
**What goes wrong:** Naive accumulation treats `message_delta.usage.output_tokens` as the per-event delta and adds it to a running total — overshoots by the total output_tokens count.
**Why it happens:** Anthropic's stream docs are slightly ambiguous; the SDK exposes a single `message_delta` event near the end of each Message that carries the FINAL output_tokens count for that Message.
**How to avoid:** Inside a single LLM call (single Anthropic Message), only the LAST `message_delta` matters for output_tokens. Inside the agent loop, the run-level total is SUM(final output_tokens per Message). The proposed shape in Pattern 4 yields a separate `{"type": "usage_delta", "output_tokens": event.usage.output_tokens}` event ONLY on `message_delta`, and the accumulator adds it once per Message. Correct.
**Warning signs:** `runs.output_tokens` is exactly the SUM of input+output, or double the expected value, or 2× the OpenAI equivalent for the same prompt.
**Sources:** [VERIFIED: docs.anthropic.com/en/docs/build-with-claude/streaming + DeepWiki anthropic-sdk-python "Streaming events" + github.com/anthropics/anthropic-sdk-python issue #424 "stream.get_final_message() does not return the correct usage of output_tokens" (resolved upstream; confirms field semantics)]

## Code Examples

Verified patterns from official sources:

### Example 1: asyncpg pool with JSONB codec via `init=` callback
```python
# Source: Context7 /magicstack/asyncpg + asyncpg official docs (usage.md)
import asyncio
import asyncpg
import json

async def init_connection(conn):
    """Called once when a connection is created."""
    await conn.set_type_codec(
        'jsonb',
        encoder=json.dumps,
        decoder=json.loads,
        schema='pg_catalog'
    )

async def main():
    pool = await asyncpg.create_pool(
        user='postgres',
        database='mydb',
        init=init_connection,    # Called on connection creation
    )
    async with pool.acquire() as conn:
        data = await conn.fetchval("SELECT $1::jsonb", {'key': 'value'})
        print(data)  # {'key': 'value'}
    await pool.close()

asyncio.run(main())
```

### Example 2: OpenAI streaming with stream_options for usage capture
```python
# Source: OpenAI cookbook + openai-python 2.28.0 ChatCompletionStreamOptionsParam
stream = client.chat.completions.create(
    model="gpt-4o",
    messages=messages,
    stream=True,
    stream_options={"include_usage": True},
)

input_tokens = output_tokens = 0
for chunk in stream:
    # Final chunk has empty choices=[] and populated usage
    if chunk.usage is not None:
        input_tokens = chunk.usage.prompt_tokens
        output_tokens = chunk.usage.completion_tokens
        continue
    # All other chunks: choices[0].delta processing
    delta = chunk.choices[0].delta
    if delta.content:
        print(delta.content, end='', flush=True)
```

### Example 3: Anthropic streaming usage extraction
```python
# Source: docs.anthropic.com/en/docs/build-with-claude/streaming + anthropic-sdk-python helpers.md
with client.messages.stream(
    model="claude-sonnet-4-5",
    max_tokens=1024,
    messages=[{"role": "user", "content": "..."}],
) as stream:
    input_tokens = output_tokens = 0
    for event in stream:
        if event.type == "message_start":
            # message.usage.input_tokens is set; output_tokens starts at 0
            input_tokens = event.message.usage.input_tokens
            output_tokens = event.message.usage.output_tokens
        elif event.type == "message_delta":
            # Final output_tokens for this Message, plus stop_reason
            if event.usage is not None:
                output_tokens = event.usage.output_tokens
        elif event.type == "content_block_delta":
            if event.delta.type == "text_delta":
                print(event.delta.text, end='', flush=True)
```

### Example 4: Pool close with timeout fallback (lifespan shutdown)
```python
# Source: github.com/MagicStack/asyncpg issue #290 + asyncpg pool.py source
try:
    await asyncio.wait_for(pool.close(), timeout=5.0)
except asyncio.TimeoutError:
    # In-flight queries didn't drain within budget; force-kill connections
    pool.terminate()
```

### Example 5: Real-Postgres pytest fixture (template for test_073_concurrency.py)
```python
# Source: derived from existing redis_client fixture pattern at conftest.py:174-199
import os
import pytest_asyncio
import asyncpg
import json

_POSTGRES_TEST_DSN = os.environ.get(
    "POSTGRES_DSN",
    "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
)


@pytest_asyncio.fixture
async def pg_pool():
    """Function-scoped real asyncpg pool against local Supabase Postgres :54322.

    Function scope is REQUIRED, not session: pytest-asyncio creates a fresh
    event loop per test (backend/pytest.ini asyncio_mode=auto). A session
    pool would bind to the FIRST loop and explode on test 2+ with
    'Event loop is closed' — same trap that bit Redis singletons.

    See Phase 073 D-073-12: this is the public real-pool fixture; the
    _reset_pg_pool_singleton autouse fixture handles the production
    singleton's reset.
    """
    async def _init(conn):
        await conn.set_type_codec(
            'jsonb', encoder=json.dumps, decoder=json.loads, schema='pg_catalog',
        )
    pool = await asyncpg.create_pool(_POSTGRES_TEST_DSN, min_size=1, max_size=4, init=_init)
    try:
        yield pool
    finally:
        await pool.close()
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Sync `supabase-py.execute()` wrapped in `run_in_threadpool` (`aexec`) | asyncpg native async pool for hot-path Postgres I/O | Phase 058 introduced aexec for SSE concurrency; Phase 073 lifts it to native async | Hot-path latency drops the threadpool hop; multi-worker readiness (Phase 077/079) becomes safe |
| `runs.input_tokens = NULL` forever (Phase 061 deferral) | Populated from SDK `usage` on every completed run | Phase 073 closes the deferral | v3.1 admin observability + v3.4 spend-cap pre-flight unblocked |
| OpenAI streams without `stream_options` | `stream_options={'include_usage': True}` globally | Phase 073 | Adds one extra final chunk per stream; zero cost; enables billing-accurate token counts |
| Anthropic usage captured only on non-streaming responses | `message_start` + `message_delta` events parsed for usage | Phase 073 (no SDK change; just consume what's already there) | Parity with OpenAI capture; closes the per-provider gap |
| Single uvicorn worker (D-v2.5-02) | `--workers N` enabled (Phase 079 / Phase 077 validates) | Phase 073 PREPARES; Phase 077/079 ENABLE | Phase 073 doesn't change worker count; it makes the connection model worker-safe so Phase 077/079 can light up the multiplier |

**Deprecated/outdated:**
- **OpenRouter `stream_options.include_usage` flag.** Officially deprecated per OpenRouter docs (2026); usage is always included automatically. **Action:** Pass the flag anyway (D-073-08); it's a no-op on OpenRouter and required on OpenAI direct.
- **`asyncpg` against Supabase `:6543` (pgbouncer) without `statement_cache_size=0`.** Causes prepared-statement errors. **Action:** Don't use :6543. D-073-01 routes to :5432 directly.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Google/Gemini routes through the OpenAI-compat shim (via `client.chat.completions.create` against a Gemini-compatible endpoint) OR OpenRouter — there is no separate `google-genai` SDK in `backend/requirements.txt`. So no Google-specific usage extraction is needed; the OpenAI capture path covers it. | §Architectural Responsibility Map (no Google row); §Code Examples Example 2 | If a future code path adds the native Google SDK, that branch needs its own usage extraction. Verified by `grep` of requirements.txt and services/ — no native Google SDK today. [VERIFIED: codebase grep] |
| A2 | The `message_delta.usage.output_tokens` field carries the FINAL cumulative output_tokens for that Anthropic Message — not a per-event delta. | §Common Pitfalls #9 + §Code Examples Example 3 | If actually per-event-delta, the accumulator double-counts. Mitigation: planner adds a unit test that streams a fixture-Anthropic response and asserts the accumulator equals the expected total. (Test should be cheap to add.) [CITED: docs.anthropic.com + DeepWiki — language is "delta event updates the snapshot with stop_reason, stop_sequence, and usage.output_tokens" which reads as snapshot-update = cumulative]. |
| A3 | Local Supabase Postgres is reachable at `postgresql://postgres:postgres@127.0.0.1:54322/postgres` for the integration test. | §Validation Architecture + §Environment Availability | If port is different (some Supabase CLI versions use 54321 for API + 54322 for direct pg), the fixture DSN must be updated. Default verified in CLAUDE.md ("Local-vs-cloud switch: env vars only ... see backend/.env.example"). |
| A4 | `provider` column on `runs` is `NOT NULL` and the existing `_resolved_provider` resolution at threads.py:957-971 always produces a non-None value. | §Common Pitfalls #6 | If a code path falls through to None, the asyncpg INSERT raises NotNullViolation. Verified by reading the if/else chain — no `pass` branch. [VERIFIED: codebase read] |
| A5 | The on-chunk callback for OpenAI runs through `_drain_stream_with_close_on_cancel` which iterates the producer-thread stream to natural StopIteration, so the trailing usage chunk WILL be delivered (no premature break). | §Common Pitfalls #2 + §Code Examples Example 2 | If the producer thread short-circuits on finish_reason (it doesn't, per current code at threads.py:158-255 — the for-loop is in `_producer` and runs unconditionally until StopIteration), usage capture would miss. [VERIFIED: codebase read of `_drain_stream_with_close_on_cancel`] |

**If this table is empty:** N/A — five assumptions documented above. A1, A4, A5 are verified by codebase grep/read; A2 and A3 carry moderate risk and have explicit mitigations.

## Open Questions

1. **Should `insert_assistant_message` accept `tool_calls` etc. as kwargs even when empty, or omit them from the INSERT entirely?**
   - What we know: The supabase-py path conditionally includes them (line 1295-1307 builds the row dict with `if persisted_tool_calls: row["tool_calls"] = ...`). asyncpg with the JSONB codec lets us pass `None` directly and the column will accept it.
   - What's unclear: Does the existing column default behavior differ between "key absent" and "key present with NULL value"? Schema shows `tool_calls jsonb` (no default), so NULL is the absent-value outcome either way.
   - Recommendation: Pass them as kwargs with `None` default. Treats the asyncpg helper as a typed signature; eliminates the dict-construction conditional. Equivalent behavior.

2. **For the `_terminal_error` UPDATE field, is `error` JSONB or TEXT?**
   - What we know: `supabase/full-schema.sql:471` shows `error text`. So just a string; not JSONB. Codec is irrelevant here.
   - What's unclear: Nothing — confirmed.
   - Recommendation: `finalize_run(... error: str | None ...)`. No JSONB handling needed for this column.

3. **Does the planner need a `_pg_pool_singleton` reset fixture for `pytest.fixture` files too, or is conftest enough?**
   - What we know: pytest-asyncio autouse fixture in conftest.py runs for every test in the directory tree. Mirrors the Phase 062 per-file pattern that Phase 074 SEED-011 is formalizing suite-wide.
   - What's unclear: Whether some test file has its own `conftest.py` that would intercept first.
   - Recommendation: Put the fixture in `backend/tests/conftest.py` (top-level) with `autouse=True`. Any per-directory conftest can opt OUT explicitly if needed; nothing in the existing suite does.

4. **Should the unit tests against `db/runs.py` exercise the JSONB codec round-trip, or just the SQL string shape?**
   - What we know: The codec lives on the pool init callback; unit tests using `AsyncMock` pool DON'T register a codec. So the unit tests can only verify the helper passes the dict through to `pool.execute(...)` correctly — they can't verify the codec encodes it.
   - What's unclear: Whether the planner wants a third test tier (real pool, real schema) for codec round-trip.
   - Recommendation: Codec round-trip is covered by `test_073_concurrency.py` (real Postgres). Unit tests against `db/runs.py` assert SQL-string + args-tuple shape only. Don't duplicate.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Python 3.12+ | asyncpg `>=0.29` (supports Python 3.9-3.14) | ✓ | venv at `backend/venv/Scripts/python.exe` is 3.12 (`anthropic 0.97.0`, `openai 2.28.0` are 3.12-compatible) | — |
| Local Supabase Postgres on `:54322` | Integration test `test_073_concurrency.py` | ✓ (assumed per CLAUDE.md + `supabase/SETUP.md`) | Postgres 15.x via supabase CLI | Skip integration test with `@pytest.mark.skipif` guarding on a `PG_AVAILABLE` env var; document degraded coverage in VERIFICATION.md |
| asyncpg | Pool + all queries | ✗ NOT YET INSTALLED | — | INSTALL: add `asyncpg>=0.29` to `backend/requirements.txt`; run `cd backend && venv/Scripts/python.exe -m pip install asyncpg`. No fallback — blocks phase. |
| Existing openai 2.28.0 | `stream_options` support | ✓ | `openai-2.28.0.dist-info/METADATA` confirmed | — |
| Existing anthropic 0.97.0 | `message_start` / `message_delta` event surface | ✓ | `anthropic-0.97.0.dist-info/METADATA` confirmed | — |
| Supabase 2.29.0 (httpx<0.29 pin) | Verifying no asyncpg conflict | ✓ | `Requires-Dist: httpx>=0.26,<0.29` — no asyncpg in transitive deps | — |
| pytest-asyncio with `asyncio_mode=auto` | `_reset_pg_pool_singleton` autouse fixture | ✓ | `backend/pytest.ini` confirmed `asyncio_mode = auto` | — |

**Missing dependencies with no fallback:**
- `asyncpg` itself — must be installed in `backend/venv`. This is Plan 01 Task 1 territory (requirements.txt + pip install).

**Missing dependencies with fallback:**
- None blocking. Integration test against `:54322` has a documented skip path if local Postgres is unreachable.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `pytest` + `pytest-asyncio` (`asyncio_mode=auto`) + `httpx.AsyncClient` for SSE/concurrency |
| Config file | `backend/pytest.ini` (`asyncio_mode = auto`, `testpaths = tests`) |
| Quick run command | `cd backend && venv/Scripts/python.exe -m pytest tests/integration/test_073_concurrency.py tests/unit/test_db_runs.py -x -q` |
| Full suite command | `cd backend && venv/Scripts/python.exe -m pytest tests/ -x -q` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| WORKER-LIFT-02 | CONCUR-01 binding gate stays green under aexec hot paths (mock Supabase) | integration | `pytest backend/tests/integration/test_058_concurrency.py::test_cross_tab_unblocked_during_sse -x` | ✅ EXISTS (D-073-11: preserved verbatim) |
| WORKER-LIFT-02 | CONCUR-01 binding gate stays green under asyncpg hot paths (real local Postgres `:54322`) | integration | `pytest backend/tests/integration/test_073_concurrency.py::test_cross_tab_unblocked_during_asyncpg_sse -x` | ❌ NEW (Wave 0) |
| WORKER-LIFT-02 | `insert_run`, `finalize_run`, `insert_assistant_message` helpers produce correct SQL + args | unit | `pytest backend/tests/unit/test_db_runs.py -x` | ❌ NEW (Wave 0) |
| WORKER-LIFT-02 | Pool singleton lazy-inits at first call, no I/O at import time | unit | `pytest backend/tests/unit/test_pg_pool_singleton.py -x` | ❌ NEW (Wave 0) |
| WORKER-LIFT-02 | Lifespan close: `pool.close()` runs BEFORE `_supabase.aclose()`, timeout falls back to `terminate()` | unit | `pytest backend/tests/unit/test_lifespan.py::test_pg_pool_closes_before_supabase -x` | ❌ NEW (Wave 0) — Phase 078 also touches this file (CQ-SUPA-01); coordinate |
| WORKER-LIFT-02 | JSONB codec round-trips a dict via real pool | integration | `pytest backend/tests/integration/test_073_concurrency.py::test_jsonb_codec_round_trip -x` | ❌ NEW |
| TOKEN-COL-01 | `runs.input_tokens` + `runs.output_tokens` populated non-NULL on happy-path completed run | integration | `pytest backend/tests/integration/test_073_concurrency.py::test_token_capture_happy_path -x` | ❌ NEW |
| TOKEN-COL-01 | OpenAI on-chunk callback accumulates `chunk.usage.prompt_tokens` / `.completion_tokens` from the trailing usage chunk | unit | `pytest backend/tests/unit/test_token_accumulator_openai.py -x` | ❌ NEW |
| TOKEN-COL-01 | Anthropic on-chunk callback accumulates from `message_start` + `message_delta` events | unit | `pytest backend/tests/unit/test_token_accumulator_anthropic.py -x` | ❌ NEW |
| TOKEN-COL-01 | Multi-iteration accumulation: 2 LLM calls in a run sum correctly into `runs.input_tokens` / `.output_tokens` | unit | `pytest backend/tests/unit/test_token_accumulator_multi_iter.py -x` | ❌ NEW |
| TOKEN-COL-01 | NULL + warning when SDK doesn't surface usage (interrupted stream simulation) | unit | `pytest backend/tests/unit/test_token_accumulator_missing_usage.py -x` | ❌ NEW |
| TOKEN-COL-01 | `logger.warning('runs.usage missing for run=%s provider=%s model=%s', ...)` fires on NULL path | unit (caplog) | included in `test_token_accumulator_missing_usage.py` | ❌ NEW |
| WORKER-LIFT-02 | `_reset_pg_pool_singleton` autouse fixture clears `_pg_pool` between tests; no "Event loop is closed" | meta | implicit (any test that imports get_pg_pool and isn't first in the test run); plus an explicit assert in `test_073_concurrency.py::test_singleton_reset_between_tests` | ❌ NEW |

### Sampling Rate
- **Per task commit:** `cd backend && venv/Scripts/python.exe -m pytest tests/unit/test_db_runs.py tests/unit/test_pg_pool_singleton.py tests/unit/test_token_accumulator_*.py -x -q` (unit tier — fast, no Postgres needed)
- **Per wave merge:** Add `tests/integration/test_073_concurrency.py tests/integration/test_058_concurrency.py` to the unit set (both binding gates green together)
- **Phase gate:** Full suite green before `/gsd:verify-work`. Specific must-haves: test_058 + test_073 + the 5 new test_token_accumulator_* + test_db_runs + test_pg_pool_singleton + test_lifespan.

### Wave 0 Gaps
- [ ] `backend/app/db/__init__.py` — empty module file (D-073-05 establishes the package)
- [ ] `backend/app/db/runs.py` — three typed helpers (insert_run / finalize_run / insert_assistant_message)
- [ ] `backend/tests/unit/test_db_runs.py` — asserts SQL string + args-tuple shape with AsyncMock pool
- [ ] `backend/tests/unit/test_pg_pool_singleton.py` — asserts get_pg_pool() returns same instance + no I/O at import
- [ ] `backend/tests/unit/test_token_accumulator_openai.py` — feeds fake chunks (including trailing usage chunk) through the on-chunk callback
- [ ] `backend/tests/unit/test_token_accumulator_anthropic.py` — feeds fake message_start + message_delta events
- [ ] `backend/tests/unit/test_token_accumulator_multi_iter.py` — simulates 2 LLM iterations, asserts SUM
- [ ] `backend/tests/unit/test_token_accumulator_missing_usage.py` — simulates SDK-missing path; asserts NULL write + caplog warning
- [ ] `backend/tests/unit/test_lifespan.py` — NEW test for pg_pool close-before-supabase ordering (Phase 078 will also touch this file for CQ-SUPA-01 — coordinate plan boundaries)
- [ ] `backend/tests/integration/test_073_concurrency.py` — real-pool gate (cross-tab unblocked + jsonb round-trip + token capture happy path)
- [ ] `backend/tests/integration/_run_helpers.py` add `_build_mock_pg_pool()` factory (AsyncMock with `.execute` / `.fetchval` / `.fetchrow` patched)
- [ ] `backend/tests/conftest.py` add `_reset_pg_pool_singleton` autouse fixture (D-073-12)
- [ ] Framework install: `cd backend && venv/Scripts/python.exe -m pip install asyncpg>=0.29` (or update `requirements.txt` and `pip install -r requirements.txt`)

*(11 NEW test files / 1 install command; existing test_058_concurrency.py and conftest.py modified, not new.)*

## Project Constraints (from CLAUDE.md)

| Directive | How Phase 073 honors it |
|-----------|--------------------------|
| Python backend must use `venv` virtual environment | All commands in this research target `backend/venv/Scripts/python.exe`; new `asyncpg` install goes into the same venv |
| No LangChain, no LangGraph — raw SDK calls only | asyncpg is a raw SDK; openai + anthropic native already; this phase doesn't introduce any framework |
| Use Pydantic for structured LLM outputs | N/A — token usage is plain integers from provider response; no structured output parsing |
| All tables need Row-Level Security | `runs` and `messages` already have RLS from prior phases; asyncpg uses the service-role connection (`postgres` superuser via direct DSN), which bypasses RLS — this is the SAME effective auth posture as supabase-py with the service-role key. No RLS regression. |
| Stream chat responses via SSE | Phase 073 doesn't touch the SSE surface; only the DB writes inside the stream-finalize path |
| Stateless chat completions — store and send chat history yourself, no provider-side thread state | Unchanged. The `runs.input_tokens` / `runs.output_tokens` capture is for accounting, not state. |
| Ingestion is manual file upload only | N/A |
| Schema changes ship as numbered SQL migrations under `supabase/migrations/` | **NO MIGRATION NEEDED.** `runs.input_tokens` + `runs.output_tokens` already exist (verified `supabase/full-schema.sql:469-470`). Phase 073 only WRITES to existing columns. |
| Apply each new migration via Supabase SQL editor (not `db push`/`db reset`) | N/A — no migration. |
| Single uvicorn worker — `--workers N` masks concurrency bugs | UNCHANGED by this phase. Phase 073 PREPARES for `--workers N` (Phase 077 validates, Phase 079 enables). Single-worker constraint stays. |
| Supabase Realtime is best-effort hint | Unaffected. |
| **D-v2.5-01: Do not run blocking I/O directly inside async handlers — wrap with `run_in_threadpool`** | asyncpg is natively async — satisfies the rule natively, no wrap needed. `aexec` survives for cold paths (5 modules still use it). The rule holds: any FUTURE sync-Postgres or sync-SDK call MUST be wrapped. |
| Settings live in `user_settings` / `app_settings` and the Settings UI; env vars are for secrets and infra only | `POSTGRES_DSN` is infra/connection-string → correct as env var (mirrors `SUPABASE_URL`, `REDIS_URL`). |

## Sources

### Primary (HIGH confidence)
- **Context7 `/magicstack/asyncpg`** — Pool Initialization and Setup Callbacks; Custom Type Codecs for JSON, Numeric, and Composite Types; Pool close()/terminate() semantics
- **`backend/app/dependencies.py:1-44`** (codebase) — get_redis() canonical pattern to mirror
- **`backend/app/main.py:99-110`** (codebase) — lifespan shutdown ordering precedent
- **`backend/app/api/threads.py:155-258, 974-983, 1267-1316, 2616-2682`** (codebase) — three flip sites + _drain helper + finalize block
- **`backend/tests/integration/test_058_concurrency.py`** (codebase) — CONCUR-01 binding gate scaffolding
- **`backend/tests/integration/test_062_stream_replay.py:36-51`** (codebase) — `_reset_redis_singleton` autouse pattern (template for `_reset_pg_pool_singleton`)
- **`supabase/full-schema.sql:402-473`** (codebase) — exact column types for `runs` and `messages`
- **`backend/venv/Lib/site-packages/openai-2.28.0.dist-info/METADATA` + `anthropic-0.97.0.dist-info/METADATA` + `supabase-2.29.0.dist-info/METADATA`** — version-pinning verification
- **`docs.anthropic.com/en/docs/build-with-claude/streaming`** — message_start / message_delta event shape with `usage.input_tokens` / `usage.output_tokens`

### Secondary (MEDIUM confidence)
- **OpenAI cookbook `examples/how_to_stream_completions`** — final usage chunk semantics (`choices=[]`, `usage` populated)
- **`community.openai.com/t/usage-stats-now-available-when-using-streaming...`** — confirms streaming usage feature flag behavior
- **`openrouter.ai/docs/api/reference/streaming` + `openrouter.ai/docs/use-cases/usage-accounting`** — OpenRouter pass-through "deprecated but always-on" usage delivery
- **`github.com/MagicStack/asyncpg/issues/290`** — `Pool.close()` graceful-vs-stuck behavior
- **`github.com/MagicStack/asyncpg/issues/293`** — asyncpg event-loop binding trap
- **`github.com/pytest-dev/pytest-asyncio/issues/991`** — "Event loop is closed" root cause analysis
- **`github.com/supabase/supabase/issues/39227`** — asyncpg + Supabase pgbouncer transaction-mode prepared-statement errors (rationale for D-073-01)
- **`medium.com/@patrickduch93 "Supabase Pooling and asyncpg Don't Mix — Here's the Real Fix"`** — operator-side rationale corroborating D-073-01

### Tertiary (LOW confidence)
- **`leeroopedia.com/index.php/Implementation:Anthropics_Anthropic_sdk_python_Stream_Event_Processing`** — third-party doc; confirms field names but flagged for cross-verify (covered by primary anthropic docs)
- **`deepwiki.com/anthropics/anthropic-sdk-python/6-streaming`** — useful event-flow narrative; deepwiki is AI-generated so independent verification (Context7 + official docs) is the trust anchor

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — asyncpg pool init verified through Context7 + asyncpg source; openai 2.28.0 + anthropic 0.97.0 versions verified via venv METADATA; no transitive-dep conflicts
- Architecture: HIGH — pattern is verbatim mirror of existing `get_redis()` + lifespan shape; nothing invented
- Pitfalls: HIGH — all 9 cross-verified against either codebase precedent (Pitfall 1 against test_062), official SDK docs (Pitfalls 2/3/4/5/8), schema (Pitfall 6), or GitHub issues (Pitfall 9 indirectly via SDK issue #424)
- Validation Architecture: HIGH — test framework verified (pytest.ini), real-pool fixture template derived from existing redis_client fixture, requirement-to-test mapping complete

**Research date:** 2026-05-17
**Valid until:** 2026-06-17 (30 days — asyncpg / openai-python / anthropic-sdk are stable; only volatile axis is OpenRouter's usage-flag semantics, which is on the deprecated-but-still-pass-through trajectory). Re-verify if any of: (a) openai-python major version bump, (b) anthropic-sdk-python major version bump, (c) Supabase Python SDK changes its httpx pin range, (d) asyncpg 1.0 ships.
