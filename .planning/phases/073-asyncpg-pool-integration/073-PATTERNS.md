# Phase 073: asyncpg Pool Integration - Pattern Map

**Mapped:** 2026-05-17
**Files analyzed:** 18 (13 new + 5 modified)
**Analogs found:** 17 / 18 (16 HIGH confidence, 1 MEDIUM, 1 LOW)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality | Confidence |
|---|---|---|---|---|---|
| `backend/app/db/__init__.py` (NEW) | module-package | n/a | n/a (empty package init) | n/a | HIGH |
| `backend/app/db/runs.py` (NEW) | typed-sql-helper | CRUD (asyncpg) | (analog by ROLE only) `backend/app/utils/db.py` is the closest "DB helper module" in the codebase; asyncpg's native-async shape means no direct analog. SQL-string body shape mirrors the rows built at `backend/app/api/threads.py:1289-1307` (messages INSERT) and the dict shape at `threads.py:974-983` (runs INSERT) and `threads.py:2651-2657` (runs UPDATE). | role-match | HIGH |
| `backend/app/dependencies.py` (MODIFIED) | dependency-injection / singleton | request-response | `get_redis()` at `backend/app/dependencies.py:20-44` — exact pattern to mirror | exact | HIGH |
| `backend/app/main.py` (MODIFIED) | lifespan / app-bootstrap | event-driven (shutdown hook) | `redis aclose` block at `backend/app/main.py:99-105` | exact | HIGH |
| `backend/app/api/threads.py` (MODIFIED — 3 hot-path sites) | controller (FastAPI router) | request-response + streaming | site #1 (runs INSERT) self-analog at `threads.py:974-983`; site #2 (runs UPDATE) self-analog at `threads.py:2651-2657`; site #3 (messages INSERT) self-analog at `threads.py:1310` | exact (diff-target) | HIGH |
| `backend/app/services/openai_service.py` (MODIFIED — `stream_options` flip) | service / SDK adapter | streaming | self-analog at `openai_service.py:808-840` (the `kwargs` dict assembled before `client.chat.completions.create(**kwargs)`) | exact (diff-target) | HIGH |
| `backend/app/services/anthropic_service.py` (MODIFIED — yield usage events) | service / SDK adapter | streaming + event-driven | self-analog at `anthropic_service.py:128-222` (existing `stream_anthropic` generator that yields `{"type": ...}` dicts); `message_delta` branch at line 213 is the surgical insertion point | exact (diff-target) | HIGH |
| `backend/app/services/openrouter_service.py` (or equivalent) | service / SDK adapter | streaming | **NO DEDICATED FILE.** OpenRouter routes through the SAME OpenAI-compat client built in `openai_service.py` (per `backend/app/config.py:_PROVIDER_BASE_URLS` line 13 — `openrouter` URL flows through OpenAI SDK). The `stream_options` flip in `openai_service.py:808` covers both providers in one place. **No separate file modification needed.** | exact | HIGH |
| `backend/tests/conftest.py` (MODIFIED — add `_reset_pg_pool_singleton`) | test-fixture / autouse | n/a | `_reset_redis_singleton` at `backend/tests/integration/test_062_stream_replay.py:36-51` (currently per-file; D-073-12 promotes to suite-wide in conftest) | exact (pattern adaptation) | HIGH |
| `backend/tests/integration/_run_helpers.py` (MODIFIED — add `_build_mock_pg_pool`) | test-helper / factory | n/a | `_build_mock_supabase()` at `_run_helpers.py:179-249` + `_make_table_builder` at `_run_helpers.py:149-176` | exact (sibling factory) | HIGH |
| `backend/tests/unit/test_db_runs.py` (NEW) | unit-test (mock) | CRUD assertions | follows AsyncMock pool pattern; closest scaffolding is the existing mock-supabase unit tests under `backend/tests/unit/` (per conftest's `mock_builder` fixture pattern at `conftest.py:160-162`) | role-match | HIGH |
| `backend/tests/unit/test_pg_pool_singleton.py` (NEW) | unit-test | singleton lifecycle | no direct singleton-test analog exists in the suite today; pattern derived from research §Pattern 1 + Pitfall 1 — assert `get_pg_pool()` returns same instance, no I/O at import | role-match | MEDIUM |
| `backend/tests/unit/test_lifespan.py` (NEW) | unit-test | lifespan event-ordering | no direct analog; pattern is assert close-ordering via mock pool + mock supabase, observing call order. **COORDINATE: Phase 078 (CQ-SUPA-01) also touches this file** — plan boundaries must be reconciled. | low-match | LOW |
| `backend/tests/unit/test_token_accumulator_openai.py` (NEW) | unit-test | streaming chunk consumer | feeds fake OpenAI chunks (incl. trailing `usage` chunk with `choices=[]`) into the on-chunk callback shape. Mock chunk fixtures derive from `_make_sse_chunk` / `_make_done_chunk` at `_run_helpers.py:69-88`. | role-match | HIGH |
| `backend/tests/unit/test_token_accumulator_anthropic.py` (NEW) | unit-test | streaming event consumer | feeds fake `{"type":"usage"}` + `{"type":"usage_delta"}` dicts into the `_on_chunk_anthropic` shape. Pattern derived from the event-dict yields in `anthropic_service.py:182-217`. | role-match | HIGH |
| `backend/tests/unit/test_token_accumulator_multi_iter.py` (NEW) | unit-test | accumulator semantic gate | asserts SUM across 2 iterations (D-073-07). No direct analog; pattern is "drive two consecutive on-chunk callback runs and assert running totals." | role-match | MEDIUM |
| `backend/tests/unit/test_token_accumulator_missing_usage.py` (NEW) | unit-test (caplog) | accumulator semantic gate | asserts NULL write + `logger.warning('runs.usage missing ...')`. caplog usage pattern is standard pytest — no codebase-specific analog. | role-match | HIGH |
| `backend/tests/integration/test_073_concurrency.py` (NEW) | integration-test (real Postgres + real Redis) | streaming + concurrency | scaffold pattern from `backend/tests/integration/test_058_concurrency.py:1-80` (cross-tab GET unblocked under SSE); real-pool fixture pattern derived from `redis_client` fixture at `conftest.py:174-199`. **NEW PATTERN:** real asyncpg pool against local Postgres `:54322` — sibling-fixture-style but no exact prior fixture exists in the suite. | partial-match | LOW |
| `backend/requirements.txt` (MODIFIED) | dependency-manifest | n/a | self-analog: `redis>=5.2,<6` at line 27 — insert `asyncpg>=0.29` near it (alphabetical-ish) | exact | HIGH |
| `backend/.env.example` (MODIFIED) | env-template | n/a | Redis section at `backend/.env.example:54-62` — exact pattern to mirror (heading + local/cloud comments + var line) | exact | HIGH |

## Pattern Assignments

### `backend/app/dependencies.py` (singleton + lazy init, MODIFIED — add `_pg_pool` + `get_pg_pool()`)

**Analog:** `backend/app/dependencies.py:20-44` (`get_redis()` — EXACT mirror)

**Imports pattern** (current state, file head — extend with `asyncpg` + `json`):
```python
# Existing (backend/app/dependencies.py:1-7):
import redis.asyncio as aioredis
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from supabase import create_client, Client

from app.config import settings

# Phase 073 additions (per research Pattern 1 + Pitfall 5):
import asyncpg
import json
```

**Singleton + lazy init pattern** (lines 20-44, the canonical shape to mirror verbatim):
```python
_redis: aioredis.Redis | None = None


def get_redis() -> aioredis.Redis:
    """Return the singleton async Redis client (Phase 061 — D-061-13).

    Mirrors get_supabase(): module-level cache, lazy init, no I/O at call
    time (from_url only sets up pool config; the first awaited command
    does the TCP connect). Closed in app lifespan via await aclose().

    decode_responses=True: XREAD entries arrive as str (not bytes) so the
    consumer can json.loads(entry['data']) without a manual .decode().
    socket_timeout / socket_connect_timeout: defense against Pitfall 7
    (producer's finally hanging on a half-dead Redis socket).
    """
    global _redis
    if _redis is None:
        _redis = aioredis.from_url(
            settings.redis_url,
            encoding="utf-8",
            decode_responses=True,
            socket_timeout=10,
            socket_connect_timeout=5,
        )
    return _redis
```

**Copy-from-this when writing `get_pg_pool()`:**
- Module-level `_pg_pool: asyncpg.Pool | None = None` declaration (line 20 shape)
- `global _pg_pool; if _pg_pool is None: _pg_pool = await asyncpg.create_pool(...)` (lines 35-44 shape)
- Async signature — `get_pg_pool` IS `async def` (unlike `get_redis` which is sync because `aioredis.from_url` is sync); `asyncpg.create_pool` is a coroutine
- Docstring shape (8-line block w/ rationale + Pitfall references) matches `get_redis`'s docstring
- Settings access via `settings.postgres_dsn` / `settings.postgres_pool_min` / `settings.postgres_pool_max` — add these three fields to `Settings` in `backend/app/config.py:244-443` block (mirror `redis_url: str = "redis://localhost:6379"` at line 360)

**Validation:** Pitfall 5 (D-073-06 wording is misleading). Codec must register via `init=` callback, NOT `pool.set_type_codec`. The `_init_pg_connection(conn)` function lives in this same file (research §Pattern 1, lines 242-254 of RESEARCH.md).

---

### `backend/app/main.py` (lifespan shutdown ordering, MODIFIED — close `_pg_pool` BEFORE `_supabase`)

**Analog:** `backend/app/main.py:99-105` (Redis aclose block — EXACT placement template)

**Existing shutdown block** (lines 99-110 — INSERT new pg_pool close block BEFORE the Supabase aclose pattern, which doesn't exist yet but is implied by the Redis-then-Supabase ordering convention):
```python
    # Close the Redis client AFTER cancelling producer tasks (so producers
    # finishing their finally blocks can still write terminal sentinels).
    try:
        from app.dependencies import get_redis
        await get_redis().aclose()
    except Exception:
        logger.exception("Redis aclose failed at shutdown")

    # Shutdown: close all open sandbox sessions to free Docker containers
    if settings.sandbox_enabled:
        from app.services.sandbox_service import sandbox_manager
        sandbox_manager.close_all()
```

**Copy-from-this when adding pg_pool close:**
- Late-binding import shape (`from app.dependencies import _pg_pool` inside the try) mirrors `from app.dependencies import get_redis` at line 102
- Bare `try / except Exception: logger.exception(...)` wrap shape (lines 101-105)
- **Insertion point:** AFTER the Redis aclose block (lines 99-105), BEFORE the sandbox close block (lines 107-110)
- **Reason:** producers mid-`_shielded_finalize` may still be doing Postgres UPDATE + Redis XADD — close in the same order producers themselves use (sentinel-emit happens before runs-UPDATE; the producer task already self-cancelled at line 90-94 above, so its in-flight write is the last one)

**Mandatory addition from research §Pitfall 4 — pool.close() can wedge on stuck queries:**
```python
# Insert AFTER existing Redis aclose block (line 105), BEFORE sandbox close (line 108):
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

---

### `backend/app/api/threads.py` SITE #1 — runs INSERT (MODIFIED — flip from `aexec` to `insert_run`)

**Analog (self-analog at the diff target):** `threads.py:974-983` (current `aexec` shape)

**Current shape (the diff target):**
```python
# threads.py:973-983
    try:
        await aexec(
            supabase.table("runs").insert({
                "run_id": str(run_id),
                "thread_id": thread_id,
                "user_id": current_user["id"],
                "status": "streaming",
                "model": _resolved_model,
                "provider": _resolved_provider,
            })
        )
```

**Imports add at `threads.py:29` (after existing `from app.utils.db import aexec`):**
```python
from app.db.runs import insert_run, finalize_run, insert_assistant_message
```

**Surgical flip target — replace lines 974-983 body with:**
```python
        await insert_run(
            await get_pg_pool(),
            run_id=run_id,
            thread_id=thread_id,
            user_id=current_user["id"],
            status="streaming",
            model=_resolved_model,
            provider=_resolved_provider,
        )
```

**Note:** the surrounding `try / except Exception` (lines 973 + 994-1008) that handles spawn-failure cleanup STAYS untouched. Per Pitfall 6, `_resolved_provider` is guaranteed non-None at line 974 entry by the if/else chain at lines 957-971 — safe for the `provider: str` (not Optional) parameter on `insert_run`.

**Validation:** the rollback path at lines 997-1000 (the SECOND aexec — `supabase.table("runs").update(...)` for spawn-failure marking) is NOT in scope per D-073-04. It stays on `aexec`.

---

### `backend/app/api/threads.py` SITE #2 — runs UPDATE finalize (MODIFIED — flip + add TOKEN-COL-01 writes)

**Analog (self-analog at the diff target):** `threads.py:2650-2657` (current `aexec` shape inside `_shielded_finalize` step 3)

**Current shape (the diff target):**
```python
# threads.py:2643-2659 — inside _shielded_finalize, step 3
                    # 3. UPDATE runs row — status/error/completed_at/message_id/tokens
                    # WR-01 fix: Python-side ISO-8601 timestamp instead of the literal string
                    # "now()". PostgREST sends update payloads as JSON over the wire; "now()"
                    # arrives as a JSON string and timestamptz only treats the bare token 'now'
                    # (no parens) as a special literal. The "now()" form may store a literal
                    # string, return NULL, or error depending on column/version — silently
                    # corrupting the canonical run completion timestamp.
                    try:
                        await aexec(supabase.table("runs").update({
                            "status": _terminal_status,
                            "error": _terminal_error,
                            "completed_at": datetime.now(timezone.utc).isoformat(),
                            "message_id": _msg_id_for_runs,
                            # input_tokens/output_tokens: filled if SDK surfaced usage; NULL otherwise (RESEARCH.md Q1)
                        }).eq("run_id", str(run_id)))
                    except BaseException:
                        logger.exception("runs row UPDATE failed for run %s", run_id)
```

**Surgical flip + TOKEN-COL-01 wire-through:**
```python
                    try:
                        # Phase 073 TOKEN-COL-01 (D-073-09): NULL + warn when SDK
                        # never surfaced usage on any iteration (interrupted streams,
                        # provider gap). Both slots stay None until the on-chunk
                        # callback fires.
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
                            completed_at=datetime.now(timezone.utc).isoformat(),
                            message_id=UUID(_msg_id_for_runs) if _msg_id_for_runs else None,
                            input_tokens=input_tokens_total,
                            output_tokens=output_tokens_total,
                        )
                    except BaseException:
                        logger.exception("runs row UPDATE failed for run %s", run_id)
```

**Note:** the `try / except BaseException` shape (line 2658-2659) STAYS — research §Pattern 1 + Pitfall 1 confirm `BaseException` catch is intentional here (preserves 058/059 invariant under lifespan cancel).

**`asyncio.shield(...)` wrapper at line 2676 stays untouched** — pool operations inside the shield work identically to aexec calls.

---

### `backend/app/api/threads.py` SITE #3 — messages INSERT (MODIFIED — flip from `aexec` to `insert_assistant_message`)

**Analog (self-analog at the diff target):** `threads.py:1289-1316` (`_persist_assistant_message` closure)

**Current shape (the diff target):**
```python
# threads.py:1289-1316
                row: dict = {
                    "thread_id": thread_id,
                    "user_id": current_user["id"],
                    "role": "assistant",
                    "content": _strip_nul(full_content),
                }
                if persisted_tool_calls:
                    completed_tools = [tc for tc in persisted_tool_calls if tc.get("status") == "done"]
                    if completed_tools:
                        row["tool_calls"] = _strip_nul(completed_tools)
                if unique_citations:
                    row["source_refs"] = unique_citations
                elif unique_sources:
                    row["source_refs"] = unique_sources
                if _confidence_slot:
                    c = _confidence_slot[0]
                    row["confidence_level"] = c["level"]
                    row["confidence_avg_similarity"] = c["avg_similarity"]
                    row["confidence_disclaimer"] = c["disclaimer"]
                _cached_id: str | None = None
                try:
                    _resp = await aexec(supabase.table("messages").insert(row))
                    if _resp and getattr(_resp, "data", None):
                        _cached_id = _resp.data[0].get("id")
                except Exception as e:
                    logger.error("Failed to persist assistant message: %s", e)
                _persist_assistant_message._cached_id = _cached_id  # type: ignore[attr-defined]
                return _cached_id
```

**Surgical flip — replace lines 1308-1316 try/except body with:**
```python
                _cached_id: str | None = None
                try:
                    # Phase 073 (D-073-05): typed helper returns inserted UUID
                    # directly. JSONB codec (D-073-06) means tool_calls /
                    # source_refs flow as plain lists — no per-call json.dumps.
                    _inserted_id = await insert_assistant_message(
                        await get_pg_pool(),
                        thread_id=UUID(thread_id) if isinstance(thread_id, str) else thread_id,
                        user_id=UUID(current_user["id"]) if isinstance(current_user["id"], str) else current_user["id"],
                        content=_strip_nul(full_content),
                        tool_calls=row.get("tool_calls"),
                        source_refs=row.get("source_refs"),
                        confidence_level=row.get("confidence_level"),
                        confidence_avg_similarity=row.get("confidence_avg_similarity"),
                        confidence_disclaimer=row.get("confidence_disclaimer"),
                    )
                    _cached_id = str(_inserted_id) if _inserted_id else None
                except Exception as e:
                    logger.error("Failed to persist assistant message: %s", e)
                _persist_assistant_message._cached_id = _cached_id  # type: ignore[attr-defined]
                return _cached_id
```

**Note:** the dict-construction block at lines 1289-1307 STAYS as-is for readability (and because it's the single source of truth for which fields are set). The flip is at the INSERT site only — we read fields out of the already-constructed `row` dict via `.get()` so the conditional-set semantics carry over.

---

### `backend/app/db/runs.py` (NEW typed-helper module)

**Analog (role-only):** `backend/app/utils/db.py` (the closest DB-helper module in the codebase)

**Imports pattern** (mirrors `utils/db.py:25-29` shape — minimal, focused, with module docstring):
```python
"""asyncpg-backed write helpers for the runs + messages tables (Phase 073 — D-073-05).

These three helpers replace the three SC-named aexec() call sites in
backend/app/api/threads.py:
  - insert_run            → threads.py:974   (runs INSERT at request entry)
  - finalize_run          → threads.py:2651  (runs UPDATE inside _shielded_finalize)
  - insert_assistant_message → threads.py:1310 (messages INSERT inside _persist_assistant_message)

Every cold-path call site (kb.py, runs.py, sandbox_outputs.py, test_fixtures.py,
threads.py non-hot calls) STAYS on aexec per D-073-04.

JSONB codec (D-073-06) is registered on the pool at init time via
app.dependencies._init_pg_connection — call sites here pass plain Python
dicts/lists for tool_calls / source_refs.
"""

from datetime import datetime
from uuid import UUID
import asyncpg
```

**Body shape — column names verified against `supabase/full-schema.sql:405-473`:**
- `runs` columns (line 459-473): `run_id, thread_id, user_id, message_id, status, model, provider, started_at (DEFAULT now()), completed_at, input_tokens, output_tokens, error` — `provider NOT NULL` (Pitfall 6); status check constraint enumerates `'streaming'/'completed'/'failed'/'cancelled'/'timed_out'`
- `messages` columns (line 405-419): `id (DEFAULT gen_random_uuid()), thread_id, user_id, role, content, created_at, updated_at, tool_calls (jsonb), source_refs (jsonb), confidence_level, confidence_avg_similarity, confidence_disclaimer` — `role` constrained to `'user'/'assistant'`

**Three helper signatures (D-073-05):**
```python
async def insert_run(
    pool: asyncpg.Pool,
    *,
    run_id: UUID,
    thread_id: UUID,
    user_id: UUID,
    status: str,      # NOT Optional — schema constraint
    model: str,       # NOT NULL
    provider: str,    # NOT NULL (Pitfall 6)
) -> None: ...


async def finalize_run(
    pool: asyncpg.Pool,
    *,
    run_id: UUID,
    status: str,
    error: str | None,           # TEXT column, NOT JSONB (Q2 confirmed)
    completed_at: datetime,
    message_id: UUID | None,
    input_tokens: int | None,    # D-073-09: NULL allowed
    output_tokens: int | None,   # D-073-09: NULL allowed
) -> None: ...


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
) -> UUID: ...   # returns id (gen_random_uuid()) via RETURNING id
```

**SQL string shape — research §Pattern 2 (RESEARCH.md lines 305-398) provides ready-to-paste SQL. Use `pool.execute` for INSERT/UPDATE returning nothing; `pool.fetchval` for INSERT RETURNING id.**

---

### `backend/app/services/openai_service.py` (stream_options flip, MODIFIED)

**Analog (self-analog at the diff target):** `openai_service.py:808-840` (the `kwargs` dict)

**Current shape (the diff target):**
```python
# openai_service.py:808-813
    kwargs: dict = {
        "model": effective_model,
        "messages": messages,
        "stream": True,
        token_param: effective_tokens,
    }
```

**Surgical flip — add ONE line:**
```python
    kwargs: dict = {
        "model": effective_model,
        "messages": messages,
        "stream": True,
        # Phase 073 D-073-08: enable usage on every streaming call globally.
        # OpenAI: emits one extra final chunk with chunk.usage populated and
        # empty choices=[]. OpenRouter: pass-through (deprecated but harmless;
        # OpenRouter always returns usage now per Pitfall 8).
        "stream_options": {"include_usage": True},
        token_param: effective_tokens,
    }
```

**Why this covers OpenRouter too:** `backend/app/config.py:_PROVIDER_BASE_URLS` (line 13) routes `openrouter` through the SAME openai-compat client via `client.chat.completions.create(...)`. No separate `openrouter_service.py` exists; one diff covers both providers.

---

### `backend/app/services/anthropic_service.py` (yield usage events, MODIFIED)

**Analog (self-analog at the diff target):** `anthropic_service.py:128-222` (existing `stream_anthropic` generator)

**Current shape (the diff target, lines 213-217):**
```python
            elif event_type == "message_delta":
                # stop_reason is ONLY available here (not in content_block events)
                stop_reason = event.delta.stop_reason
                finish_reason = _STOP_REASON_MAP.get(stop_reason or "", "stop")
```

**No `message_start` branch exists today** — the existing event loop (lines 170-217) handles `content_block_start`, `content_block_delta`, `content_block_stop`, `message_delta`. Per research Pattern 4 (RESEARCH.md lines 487-506), insert a NEW `message_start` branch + extend the `message_delta` branch:

```python
            if event_type == "message_start":
                # Phase 073 TOKEN-COL-01: input_tokens known immediately on stream
                # open; output_tokens starts at 0. Yield a normalized event so
                # threads.py's _on_chunk_anthropic accumulator can consume it.
                m = event.message
                yield {
                    "type": "usage",
                    "input_tokens": getattr(m.usage, "input_tokens", 0) or 0,
                    "output_tokens": getattr(m.usage, "output_tokens", 0) or 0,
                }

            elif event_type == "content_block_start":
                # ... existing logic (line 173) — unchanged
```

```python
            elif event_type == "message_delta":
                # stop_reason is ONLY available here (not in content_block events)
                stop_reason = event.delta.stop_reason
                finish_reason = _STOP_REASON_MAP.get(stop_reason or "", "stop")
                # Phase 073 TOKEN-COL-01: final cumulative output_tokens for THIS
                # Message (Pitfall 9: this is FINAL CUMULATIVE per Message, not
                # a per-event delta — accumulator adds it once per Message).
                if hasattr(event, "usage") and event.usage is not None:
                    yield {
                        "type": "usage_delta",
                        "output_tokens": getattr(event.usage, "output_tokens", 0) or 0,
                    }
```

**Threads.py companion change (callback at `threads.py:1438-1463`):** add a `_etype == "usage"` and `_etype == "usage_delta"` branch in `_on_chunk_anthropic` per research §Pattern 4 (RESEARCH.md lines 509-529). The accumulator slots `input_tokens_total` / `output_tokens_total` are declared as `nonlocal` near the existing `nonlocal full_content, finish_reason` at line 1439.

**OpenAI companion change (callback at `threads.py:1524-1553`):** add the `if getattr(chunk, "usage", None) is not None` early-return branch at the top of `_on_chunk_openai` per research §Pattern 4 (RESEARCH.md lines 469-485).

---

### `backend/tests/conftest.py` (MODIFIED — add `_reset_pg_pool_singleton` autouse)

**Analog:** `_reset_redis_singleton` per-file fixture at `backend/tests/integration/test_062_stream_replay.py:36-51`

**Existing per-file pattern to mirror (test_062_stream_replay.py:36-51):**
```python
@pytest.fixture(autouse=True)
def _reset_redis_singleton():
    """Reset app.dependencies._redis so each test gets a Redis client bound to
    its own per-test event loop (pytest-asyncio function-scope creates a fresh
    loop per test). Without this, a singleton created in test N's loop is
    invoked by test N+1 against a closed loop → RuntimeError("Event loop is closed").

    Mirrors the rationale of test_059_disconnect's _reset_sse_starlette_app_status
    fixture (RESEARCH.md Pitfall 6) — same loop-binding trap, different module.
    Required for Phase 062's stream tests because the route handler hits the
    real `get_redis()` singleton (no Redis dependency override).
    """
    import app.dependencies as _deps
    _deps._redis = None
    yield
    _deps._redis = None
```

**Copy-from-this to write `_reset_pg_pool_singleton` (insert in `backend/tests/conftest.py` near the existing `redis_client` fixture at lines 174-199):**

D-073-12 promotes the pattern from per-file to **suite-wide** by placing it in `conftest.py`. The shape is the same, but teardown must `await pool.close()` if non-None (asyncpg pools own real sockets even when never used; Redis client `_redis` had no symmetric `await aclose()` because aioredis is lazier).

```python
@pytest_asyncio.fixture(autouse=True)
async def _reset_pg_pool_singleton():
    """Reset app.dependencies._pg_pool so each test gets a pool bound to
    its own per-test event loop (Pitfall 1 — asyncpg has the same
    event-loop binding trap that bit Redis singletons in Phase 062).

    Suite-wide (in conftest.py) rather than per-file because asyncpg is
    going to be touched by more test files than Redis was at the Phase 062
    introduction point. D-073-12.
    """
    import app.dependencies as _deps
    _deps._pg_pool = None
    yield
    if _deps._pg_pool is not None:
        try:
            await _deps._pg_pool.close()
        except Exception:
            pass
        _deps._pg_pool = None
```

**Note:** must be `@pytest_asyncio.fixture` (not `@pytest.fixture`) because teardown awaits `pool.close()`. The existing `@pytest.fixture(autouse=True) reset_mocks` at line 86 stays separate — different concern.

---

### `backend/tests/integration/_run_helpers.py` (MODIFIED — add `_build_mock_pg_pool()` factory)

**Analog:** `_build_mock_supabase()` at `_run_helpers.py:179-249` + `_make_table_builder` at `_run_helpers.py:149-176`

**Existing factory pattern (lines 179-249, abbreviated to show the shape):**
```python
def _build_mock_supabase():
    """Build a mock supabase client with per-table routing.

    The ``messages`` table builder serves the pre-stream INSERT slowly (1.5s)
    so the cross-tab GET races against an in-flight aexec(). All other
    table calls return immediately.
    """
    state = {"messages_select_count": 0, "threads_select_count": 0}

    def messages_execute(*args, **kwargs):
        ...

    builders = {
        "threads": _make_table_builder(threads_execute),
        "messages": _make_table_builder(messages_execute),
        "runs": _make_table_builder(runs_execute),
    }
    default_builder = _make_table_builder(default_execute)

    sb = MagicMock()
    sb.table.side_effect = lambda name: builders.get(name, default_builder)
    ...
    return sb
```

**Copy-from-this to write `_build_mock_pg_pool()`:**
- Module-level helper, same naming convention (`_build_mock_<thing>`)
- Returns a `MagicMock` (or `AsyncMock` since asyncpg pool methods are coroutines) with `.execute`, `.fetchval`, `.fetchrow` patched
- Per-table routing NOT needed (asyncpg is unfiltered SQL strings, no table-name routing); instead provide a `state` dict that records the captured SQL strings + args tuples for assertion (mirror of how `_extract_run_id_from_mock` at line 256-290 inspects `call_args_list`)
- Async methods → use `AsyncMock` instead of `MagicMock` for `.execute` / `.fetchval`
- Convention: factory at the BOTTOM of `_run_helpers.py` (after `setup_zombie_state` at line 356, mirroring the existing module growth pattern)

**Note:** unit tests against `db/runs.py` consume this factory; integration tests use the REAL local Postgres pool fixture from research §Pattern 5 (RESEARCH.md lines 720-754).

---

### `backend/tests/integration/test_073_concurrency.py` (NEW — real Postgres + real Redis gate)

**Analog (scaffolding):** `backend/tests/integration/test_058_concurrency.py:1-80` (CONCUR-01 binding gate)

**Existing scaffold (test_058 file header + imports, lines 1-75):**
```python
"""Integration test for Phase 058 — cross-tab GET unblocked during SSE streaming.

D-058-09 gate: passes only when the aexec() wrapping is in effect so that
a concurrent GET on Thread B returns within 1.0s while Thread A's SSE stream
is actively in-flight.
"""
import asyncio
import time
from unittest.mock import patch
from uuid import uuid4

import httpx
import pytest

from app.dependencies import get_supabase
from app.main import app
from app.services.openai_service import CallingMode

from tests.integration._run_helpers import (
    USER_ID, SLOW_INSERT_DELAY,
    _make_result, _make_sse_chunk, _make_done_chunk,
    _fast_chunks, _slow_chunks,
    _thread_row as _thread_row_helper,
    _message_row as _message_row_helper,
    _make_table_builder,
    _build_mock_supabase as _build_mock_supabase_helper,
)

THREAD_A = str(uuid4())
```

**Copy-from-this when writing test_073:**
- Module docstring shape (research §Validation Architecture table maps three sub-tests: `test_cross_tab_unblocked_during_asyncpg_sse`, `test_jsonb_codec_round_trip`, `test_token_capture_happy_path`)
- Same imports (httpx, asyncio, pytest, patch, USER_ID, etc.) — but ADD a real-pool fixture import + a new `pg_pool` `pytest_asyncio.fixture`
- **NEW pattern (no existing analog):** function-scoped real asyncpg pool fixture pointing at `:54322` — copy verbatim from research §Pattern 5 (RESEARCH.md lines 720-754). This is the only LOW-confidence pattern in the phase; mirror the existing `redis_client` fixture at `conftest.py:174-199` for the `try / yield / finally: await pool.close()` shape
- The cross-tab test reuses `_build_mock_supabase_helper` for cold-path Supabase calls + uses the new `pg_pool` fixture for the asyncpg-flipped sites
- Assert `runs.input_tokens IS NOT NULL` and `runs.output_tokens IS NOT NULL` via `await pg_pool.fetchrow("SELECT input_tokens, output_tokens FROM runs WHERE run_id = $1", run_id)` after `await_producer_finalized(...)` returns

---

### `backend/tests/unit/test_db_runs.py` (NEW — AsyncMock pool against SQL string + args)

**Analog (role only):** uses `_build_mock_pg_pool()` from `_run_helpers.py` (NEW), driven by the unit-test conftest scaffolding pattern

**Pattern shape:**
```python
import pytest
from uuid import uuid4
from datetime import datetime, timezone

from app.db.runs import insert_run, finalize_run, insert_assistant_message
from tests.integration._run_helpers import _build_mock_pg_pool


@pytest.mark.asyncio
async def test_insert_run_passes_required_args():
    pool = _build_mock_pg_pool()
    run_id = uuid4()
    thread_id = uuid4()
    user_id = uuid4()

    await insert_run(
        pool,
        run_id=run_id,
        thread_id=thread_id,
        user_id=user_id,
        status="streaming",
        model="claude-opus-4-7",
        provider="anthropic",
    )

    # Assert SQL contains the expected INSERT shape
    sql, *args = pool.execute.call_args[0]
    assert "INSERT INTO runs" in sql
    assert args == [run_id, thread_id, user_id, "streaming", "claude-opus-4-7", "anthropic"]
```

**Three test functions per helper:** `test_insert_run_*`, `test_finalize_run_*`, `test_insert_assistant_message_*`. Assert SQL-string-shape + args-tuple — NOT codec behavior (codec round-trip covered by integration test per Q4).

---

### `backend/tests/unit/test_pg_pool_singleton.py` (NEW)

**No direct analog.** Pattern derived from research §Pattern 1.

**Three assertions:**
1. `await get_pg_pool() is await get_pg_pool()` — same instance returned across calls (singleton)
2. Importing `app.dependencies` does NOT call `asyncpg.create_pool` (no I/O at import) — assert via `patch('asyncpg.create_pool')` import-time check
3. After the autouse fixture resets `_pg_pool`, the next `await get_pg_pool()` triggers a fresh `create_pool` (proves the fixture works)

---

### `backend/tests/unit/test_lifespan.py` (NEW — LOW confidence)

**No direct analog.** Pattern derived from research §Pattern 1 + main.py:99-110.

**COORDINATION NOTE:** Phase 078 (CQ-SUPA-01) per RESEARCH.md line 839 also touches this file. **Plan boundaries between Phase 073 and Phase 078 must be reconciled at plan-writing time** — likely Plan 03 / Plan 05 own different test methods within this single file; phase 073 owns `test_pg_pool_closes_before_supabase` + the timeout fallback test.

**Pattern shape:**
- Mock `_pg_pool` with `.close = AsyncMock(...)` and `.terminate = MagicMock(...)`
- Mock `_supabase` with `.aclose = AsyncMock(...)` (or whatever future shape Phase 078 introduces)
- Drive `lifespan(app_instance).__aexit__(...)` and assert `_pg_pool.close` was awaited BEFORE `_supabase.aclose` (use `unittest.mock.call_order` or instrument with a list-of-events recorder)
- Second test: configure `_pg_pool.close` to raise `asyncio.TimeoutError`; assert `_pg_pool.terminate` is then called

---

### `backend/tests/unit/test_token_accumulator_openai.py` (NEW)

**Analog:** chunk mock fixtures derive from `_make_sse_chunk` / `_make_done_chunk` at `_run_helpers.py:69-88`.

**Pattern shape:**
- Build a synthetic "trailing usage chunk" with `chunk.choices = []` and `chunk.usage.prompt_tokens = 100`, `chunk.usage.completion_tokens = 50`
- Drive a closure-scoped `_on_chunk_openai(chunk)` (copy the body from `threads.py:1524-1553` with the proposed usage branch added) over 4 normal chunks + 1 trailing usage chunk
- Assert `input_tokens_total == 100`, `output_tokens_total == 50` after the trailing chunk is processed

**Pitfall 2 mitigation built into the test:** the mock fixture MUST include a 5th synthetic chunk with `usage` populated and `choices=[]`. If a test uses only 4 chunks ending with `finish_reason='stop'`, the usage path is NEVER exercised — silent regression.

---

### `backend/tests/unit/test_token_accumulator_anthropic.py` (NEW)

**Analog:** event-dict yields from `anthropic_service.py:182-217`.

**Pattern shape:**
- Build synthetic event dicts: `{"type": "usage", "input_tokens": 200, "output_tokens": 0}` followed by `{"type": "delta", "content": "hello"}` followed by `{"type": "usage_delta", "output_tokens": 75}`
- Drive a closure-scoped `_on_chunk_anthropic` over the sequence
- Assert `input_tokens_total == 200`, `output_tokens_total == 75`

**Pitfall 9 mitigation:** the `message_delta.usage.output_tokens` value is FINAL CUMULATIVE per Message, not per-event-delta. Test asserts the value FROM the `usage_delta` event is the final stored value, not a running sum within a single Message.

---

### `backend/tests/unit/test_token_accumulator_multi_iter.py` (NEW)

**No direct analog.** Pattern: drive TWO consecutive on-chunk callback runs (mocking two LLM iterations of an agent loop), assert running totals.

**Pattern shape:**
- Iteration 1: feed OpenAI fixture with `prompt_tokens=100, completion_tokens=50`
- Iteration 2: feed OpenAI fixture with `prompt_tokens=150, completion_tokens=80`
- Assert `input_tokens_total == 250`, `output_tokens_total == 130` (D-073-07: SUM across iterations)

---

### `backend/tests/unit/test_token_accumulator_missing_usage.py` (NEW)

**Pattern:** uses standard pytest `caplog` fixture (no codebase-specific analog).

**Pattern shape:**
- Drive `_on_chunk_openai` over chunks that NEVER include a usage chunk (simulates interrupted stream / Pitfall 3)
- Manually invoke the `_shielded_finalize` step-3 logic with `input_tokens_total=None, output_tokens_total=None`
- Assert `caplog.records` contains a WARNING-level log with message matching `'runs.usage missing for run='`
- Assert `finalize_run` was awaited with `input_tokens=None, output_tokens=None`

---

### `backend/app/db/__init__.py` (NEW)

**Pattern:** Empty package init. Single line or empty file.

```python
"""asyncpg-backed DB helpers (Phase 073 — D-073-05)."""
```

**Note:** the package establishes a NEW namespace for typed SQL helpers — `app.db.runs` today, future expansions per [feedback-preserve-engine-optionality] in adjacent helper modules (e.g., `app.db.messages`, `app.db.threads`) IF cold paths get flipped in a later phase per D-073-04 conditional (Phase 077 findings).

---

### `backend/requirements.txt` (MODIFIED — add `asyncpg>=0.29`)

**Analog:** existing `redis>=5.2,<6` at line 27 (research §Standard Stack confirms `asyncpg>=0.29` is the floor; latest is 0.31).

**Diff target:** insert `asyncpg>=0.29` near `redis` (alphabetical-ish ordering). No upper bound — semver-respecting library.

---

### `backend/.env.example` (MODIFIED — add `POSTGRES_DSN`, `POSTGRES_POOL_MIN`, `POSTGRES_POOL_MAX`)

**Analog:** Redis section at `backend/.env.example:54-62` (EXACT pattern to mirror).

**Existing pattern:**
```ini
# ─────────────────────────────────────────────────────────────────────────────
# Redis (v2.5+ — run-backed streaming buffer; see Phase 061 / D-v2.5-08)
# ─────────────────────────────────────────────────────────────────────────────
# Local (default — `docker compose -f docker-compose.dev.yml up -d`):
#   REDIS_URL=redis://localhost:6379
# Cloud (Upstash example — note rediss:// for TLS):
#   REDIS_URL=rediss://default:<password>@<endpoint>.upstash.io:6379

REDIS_URL=redis://localhost:6379
```

**Copy-from-this to add Postgres section (insert AFTER Redis block at line 62):**
```ini


# ─────────────────────────────────────────────────────────────────────────────
# asyncpg pool (v2.6+ — hot-path Postgres I/O; see Phase 073 / WORKER-LIFT-02)
# ─────────────────────────────────────────────────────────────────────────────
# Local (default — Supabase CLI exposes direct Postgres on :54322):
#   POSTGRES_DSN=postgresql://postgres:postgres@127.0.0.1:54322/postgres
# Cloud (paste from Supabase dashboard — Connection Info → Direct connection
# string on :5432; NOT the pooler on :6543 per D-073-01).

POSTGRES_DSN=postgresql://postgres:postgres@127.0.0.1:54322/postgres
POSTGRES_POOL_MIN=2
POSTGRES_POOL_MAX=10
```

**Settings additions needed in `backend/app/config.py:244-443` (mirror `redis_url` at line 360):**
```python
    # asyncpg pool (Phase 073 — D-073-01/02/03)
    postgres_dsn: str = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
    postgres_pool_min: int = 2
    postgres_pool_max: int = 10
```

---

## Shared Patterns

### Pattern: Singleton + Lazy Init + Lifespan Close
**Source:** `backend/app/dependencies.py:10-44` (`get_supabase` + `get_redis`) + `backend/app/main.py:99-105` (lifespan aclose)
**Apply to:** `get_pg_pool()` in `dependencies.py` + lifespan close block in `main.py`

The codebase has TWO concrete prior examples (`_supabase` and `_redis`) — `get_pg_pool` is the third. Module-level cache, `global` declaration, `if _x is None: _x = create(...)`, no I/O at call time. Lifespan close in reverse-creation-order via `aclose()` (Redis) / `close()` (asyncpg, with `asyncio.wait_for(...)` + `.terminate()` fallback per Pitfall 4) / `aclose()` (Supabase httpx underlying).

### Pattern: aexec() on Cold Paths (PRESERVED, not modified)
**Source:** `backend/app/utils/db.py:32-44` (`aexec` helper)
**Apply to:** All NON-hot-path Postgres call sites — STAY on aexec per D-073-04 / SC#4

Survives in 5 modules: `kb.py`, `runs.py`, `sandbox_outputs.py`, `test_fixtures.py`, and `threads.py` (the non-hot calls — thread SELECT, message-history SELECT, user message INSERT, spawn-failure UPDATE, etc.). The `from app.utils.db import aexec` line at `threads.py:29` stays.

### Pattern: `asyncio.shield(...)` Wrap of Finalize Block
**Source:** `backend/app/api/threads.py:2676` (existing `await asyncio.shield(_shielded_finalize())`)
**Apply to:** No new files — preserves 058/059 invariant; asyncpg pool operations inside the shield work identically to aexec.

Pool operations are coroutines; the shield protects them the same way it protected aexec coroutines. No change to the shield wrapper itself.

### Pattern: `BaseException` Catch Inside Finalize Steps
**Source:** `backend/app/api/threads.py:2624-2627, 2637-2641, 2658-2659, 2664-2666, 2671-2673` (CR-02/WR-03 invariant)
**Apply to:** The new `finalize_run` call inside `_shielded_finalize` step 3 — `except BaseException: logger.exception(...)` (NOT bare `except Exception` — must catch `CancelledError` to preserve 058/059)

### Pattern: Per-test Event-Loop-Bound Singleton Reset
**Source:** `backend/tests/integration/test_062_stream_replay.py:36-51` (`_reset_redis_singleton` per-file autouse)
**Apply to:** `backend/tests/conftest.py` — `_reset_pg_pool_singleton` suite-wide autouse (D-073-12 promotes from per-file → suite-wide)

The autouse must be `pytest_asyncio.fixture` (not `pytest.fixture`) because teardown awaits `pool.close()`.

### Pattern: Real-Service Function-Scoped Pytest Fixture
**Source:** `backend/tests/conftest.py:174-199` (`redis_client` fixture — function-scoped, NOT session)
**Apply to:** `pg_pool` fixture in `backend/tests/integration/test_073_concurrency.py`

Function scope is REQUIRED (not session) because pytest-asyncio creates a fresh event loop per test (`asyncio_mode = auto`). A session-scoped pool would bind to the FIRST loop and explode on test 2+ with `"Event loop is closed"`.

### Pattern: Mock Factory in `_run_helpers.py`
**Source:** `backend/tests/integration/_run_helpers.py:179-249` (`_build_mock_supabase`)
**Apply to:** `_build_mock_pg_pool()` sibling factory in the same file

Module-level helper, AsyncMock-based, returns the mock object directly (no fixture wrapper — fixtures consume the factory).

### Pattern: SSE Streaming Provider Adapter (yield event-dict)
**Source:** `backend/app/services/anthropic_service.py:128-222` (`stream_anthropic` generator yielding `{"type": "delta" | "tool_start" | "tool_preparing" | "finish"}` dicts)
**Apply to:** Adding `{"type": "usage", "input_tokens": N, "output_tokens": M}` + `{"type": "usage_delta", "output_tokens": N}` to the same generator

The consumer side at `threads.py:1438-1463` (`_on_chunk_anthropic`) follows the matching pattern: `_etype = event.get("type"); if _etype == "delta": ...` — extend with new `_etype` branches for `usage` and `usage_delta`.

---

## No Analog Found

| File | Role | Data Flow | Reason | Confidence |
|---|---|---|---|---|
| `backend/tests/integration/test_073_concurrency.py` (real asyncpg pool against local Postgres) | integration test (real DB) | streaming + concurrency | The cross-tab scaffolding mirrors `test_058_concurrency.py`, BUT no existing test in the suite drives a real asyncpg pool. The `redis_client` fixture at `conftest.py:174-199` provides the function-scoped-real-service template; the asyncpg fixture is its sibling but new in this phase. | LOW |
| `backend/tests/unit/test_lifespan.py` (close-order assertion) | unit test (lifespan) | event-driven | No prior unit test asserts FastAPI lifespan close ordering. Pattern derived from `main.py:99-110` direct inspection + `unittest.mock` call-order primitives. **Coordinate with Phase 078 (CQ-SUPA-01)** — both phases touch this file. | LOW |

Planner should use the research §Pattern 5 + research §Validation Architecture sections of RESEARCH.md for these two files, in lieu of a codebase analog.

---

## Metadata

**Analog search scope:**
- `backend/app/dependencies.py` (FULL READ — 59 lines)
- `backend/app/main.py` (FULL READ — 183 lines)
- `backend/app/utils/db.py` (FULL READ — 45 lines)
- `backend/app/config.py` (FULL READ — 444 lines)
- `backend/app/api/threads.py` (TARGETED reads — lines 1-60, 950-1040, 1255-1345, 1430-1570, 2610-2700)
- `backend/app/services/openai_service.py` (TARGETED — lines 790-841)
- `backend/app/services/anthropic_service.py` (TARGETED — lines 120-222)
- `backend/tests/conftest.py` (FULL READ — 225 lines)
- `backend/tests/integration/_run_helpers.py` (FULL READ — 415 lines)
- `backend/tests/integration/test_058_concurrency.py` (TARGETED — lines 1-80)
- `backend/tests/integration/test_062_stream_replay.py` (TARGETED — lines 1-80)
- `supabase/full-schema.sql` (TARGETED — lines 400-475 for messages + runs columns)
- `backend/requirements.txt` (FULL — 25 lines via Bash)
- `backend/.env.example` (TARGETED — Redis section lines 50-75)

**Files scanned:** 14 source files + 4 test files
**Glob/Grep queries:** 6 (find openrouter routing layer, anthropic streaming setup, openai streaming setup, on_chunk callbacks, full-schema runs+messages, env Redis section)
**Pattern extraction date:** 2026-05-17

## PATTERN MAPPING COMPLETE

**Phase:** 073 - asyncpg-pool-integration
**Files classified:** 18 (13 new + 5 modified)
**Analogs found:** 17 / 18 (one file — `test_073_concurrency.py` real-pool fixture — is a NEW pattern with no codebase precedent; research §Pattern 5 supplies the template)

### Coverage
- Files with exact analog: 11 (singletons, lifespan, three threads.py flips, openai/anthropic adapters, test_062 autouse, test_058 scaffolding, requirements.txt, .env.example, _build_mock_supabase sibling)
- Files with role-match analog: 6 (db/runs.py, the four token-accumulator unit tests, test_db_runs.py)
- Files with LOW or no analog: 2 (test_073_concurrency.py real-pool fixture, test_lifespan.py close-ordering)

### Key Patterns Identified
- Singleton + lazy init + lifespan close is the THIRD instance of an established pattern (Supabase, Redis, now asyncpg) — verbatim mirror, no invention
- All three hot-path flips have explicit line-numbered self-analogs in `threads.py` (974-983, 1310, 2651-2657) — the diff target is a single concentrated SC-minimum surface
- `stream_options={'include_usage': True}` flip in OpenAI service covers BOTH OpenAI direct AND OpenRouter routes because they share the same `client.chat.completions.create` call site (config.py routes openrouter through the openai-compat SDK)
- Anthropic provider extends an existing yield-event-dict pattern — `usage` + `usage_delta` events slot into the same `{"type": ...}` shape consumed by the existing `_on_chunk_anthropic` callback
- Test autouse for event-loop-bound singletons has a per-file precedent (test_062 `_reset_redis_singleton`); D-073-12 promotes it suite-wide in `conftest.py` and switches it to `pytest_asyncio.fixture` to await `pool.close()` in teardown
- aexec preservation is a deliberate coexistence pattern — survives in 5 modules; the typed-helper module `app.db.runs` is an ADDITIVE namespace, not a replacement

### File Created
`C:\Vibe Apps\Agentic RAG\.planning\phases\073-asyncpg-pool-integration\073-PATTERNS.md`

### Ready for Planning
Pattern mapping complete. Planner can now reference analog patterns in PLAN.md files with concrete file paths and line numbers.
