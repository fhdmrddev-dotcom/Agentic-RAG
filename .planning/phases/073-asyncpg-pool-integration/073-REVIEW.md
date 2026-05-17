---
phase: 073-asyncpg-pool-integration
reviewed: 2026-05-17T00:00:00Z
depth: standard
files_reviewed: 20
files_reviewed_list:
  - backend/.env.example
  - backend/app/api/threads.py
  - backend/app/config.py
  - backend/app/db/__init__.py
  - backend/app/db/runs.py
  - backend/app/dependencies.py
  - backend/app/main.py
  - backend/app/services/anthropic_service.py
  - backend/app/services/openai_service.py
  - backend/requirements.txt
  - backend/tests/conftest.py
  - backend/tests/integration/_run_helpers.py
  - backend/tests/integration/test_073_concurrency.py
  - backend/tests/unit/test_db_runs.py
  - backend/tests/unit/test_lifespan.py
  - backend/tests/unit/test_pg_pool_singleton.py
  - backend/tests/unit/test_token_accumulator_anthropic.py
  - backend/tests/unit/test_token_accumulator_missing_usage.py
  - backend/tests/unit/test_token_accumulator_multi_iter.py
  - backend/tests/unit/test_token_accumulator_openai.py
findings:
  critical: 0
  warning: 1
  info: 5
  total: 6
status: issues_found
---

# Phase 073: Code Review Report

**Reviewed:** 2026-05-17T00:00:00Z
**Depth:** standard
**Files Reviewed:** 20
**Status:** issues_found

## Summary

Phase 073 adds an asyncpg connection pool singleton, JSONB codec registration, lifespan integration, three typed SQL helpers (`insert_run` / `finalize_run` / `insert_assistant_message`), LLM token-usage capture wiring across the OpenAI and Anthropic streams, and three hot-path flips in `threads.py`. The change set is tight and disciplined.

All ten high-risk items from the special phase context check out cleanly:

1. **SQL injection (T-073-02):** All three helpers in `app/db/runs.py` use `$N` positional placeholders exclusively. No f-strings or `.format()` on SQL values. The unit test `test_insert_run_uses_positional_placeholders` locks this contract.
2. **Token-value logging (D-073-09 / T-073-04):** The single warning emit at `threads.py:2719-2722` carries only `run=`, `provider=`, `model=` identifiers. No raw token values. The negative test `test_missing_usage_format_string_has_no_token_values` defends this property.
3. **JSONB codec correctness (D-073-06 / Pitfall 5):** Registration happens inside the `init=` callback (`_init_pg_connection`) passed to `create_pool` — codec lives on each Connection, not the Pool (which has no `set_type_codec`). The docstring at `dependencies.py:55-65` explicitly calls out the Pitfall 5 fix.
4. **Anthropic double-count guard (Pitfall 9):** `stream_anthropic` yields `usage` once per `message_start` (input + initial output) and `usage_delta` once per `message_delta` (carrying the cumulative-for-that-Message output). `_on_chunk_anthropic` at `threads.py:1463-1488` adds each value exactly once. `test_anthropic_pitfall_9_no_double_count` regression-locks this.
5. **Hot-path scope (D-073-04 SC-minimum):** Grep confirms EXACTLY 3 asyncpg helper call sites in `threads.py` (lines 979, 1326, 2723) — `insert_run`, `insert_assistant_message`, `finalize_run`. No scope creep.
6. **`aexec` preservation:** `from app.utils.db import aexec` remains at line 29; all cold-path call sites still use it (33 grep hits — kb queries, audit, skills, history fetches, runs spawn-failure cleanup, etc.).
7. **JSON-dumps boilerplate at call sites:** Grep for `json.dumps(tool_calls)` / `json.dumps(source_refs)` returns zero hits. Call sites pass plain Python lists/dicts; the codec encodes.
8. **Lifespan shutdown ordering:** `_pg_pool.close()` runs AFTER the Redis aclose and BEFORE the sandbox close. No `_supabase.aclose()` exists yet (that arrives in Phase 078 CQ-SUPA-01) — the comment at `main.py:107` is forward-referential.
9. **Lifespan timeout fallback:** `asyncio.wait_for(_pg_pool.close(), timeout=5.0)` wraps the close, and `_pg_pool.terminate()` is the TimeoutError fallback. `test_pg_pool_close_timeout_falls_back_to_terminate` locks the fallback path.
10. **Singleton reset fixture (D-073-12 / Pitfall 6):** `_reset_pg_pool_singleton` in `conftest.py:175-198` is `autouse=True`, sets `_deps._pg_pool = None` BEFORE each test, and awaits `pool.close()` in teardown. `test_singleton_reset_between_tests` is the meta-test.

No Critical issues. One Warning around a dead-write in the `row` dict construction at the message-persist site, and five Info-tier observations about minor quality issues, slow tests, and comment maintenance.

## Warnings

### WR-01: Dead writes in `row` dict at `_persist_assistant_message`

**File:** `backend/app/api/threads.py:1299-1336`
**Issue:** The `row` dict is constructed (line 1299) with keys `"thread_id"`, `"user_id"`, `"role"`, `"content"` assigned but never read. The subsequent `insert_assistant_message` call (line 1326) reads only `row.get("tool_calls")`, `row.get("source_refs")`, `row.get("confidence_level")`, `row.get("confidence_avg_similarity")`, `row.get("confidence_disclaimer")` — all other `row[...]` assignments are dead writes. `content` is also independently re-stripped via `_strip_nul(full_content)` at line 1330, after already being stripped into `row["content"]` at line 1303. This is leftover scaffolding from the pre-flip code path that built a single dict for the legacy supabase `insert(...)` call. Risk: code reader misreads the intent and assumes the legacy supabase path is still partially active; future maintainer adds back `row["content"] = ...` mutations expecting them to affect the insert.

**Fix:**
```python
# Replace the row dict assembly with direct kwargs, mirroring the helper signature.
_tool_calls_arg: list[dict] | None = None
_source_refs_arg: list[dict] | None = None
_conf_level: str | None = None
_conf_sim: float | None = None
_conf_disclaimer: str | None = None

if persisted_tool_calls:
    completed_tools = [tc for tc in persisted_tool_calls if tc.get("status") == "done"]
    if completed_tools:
        _tool_calls_arg = _strip_nul(completed_tools)
if unique_citations:
    _source_refs_arg = unique_citations
elif unique_sources:
    _source_refs_arg = unique_sources
if _confidence_slot:
    c = _confidence_slot[0]
    _conf_level = c["level"]
    _conf_sim = c["avg_similarity"]
    _conf_disclaimer = c["disclaimer"]

_stripped_content = _strip_nul(full_content)
try:
    _inserted_id = await insert_assistant_message(
        await get_pg_pool(),
        thread_id=UUID(thread_id) if isinstance(thread_id, str) else thread_id,
        user_id=UUID(current_user["id"]) if isinstance(current_user["id"], str) else current_user["id"],
        content=_stripped_content,
        tool_calls=_tool_calls_arg,
        source_refs=_source_refs_arg,
        confidence_level=_conf_level,
        confidence_avg_similarity=_conf_sim,
        confidence_disclaimer=_conf_disclaimer,
    )
    ...
```

This also eliminates the duplicate `_strip_nul(full_content)` call at line 1330 (line 1303 already stripped it).

## Info

### IN-01: Misleading forward-reference comment in lifespan shutdown

**File:** `backend/app/main.py:107`
**Issue:** Comment reads `# Phase 073 — close the asyncpg pool BEFORE Supabase (matches Redis-then-Supabase order)`. There is no `_supabase.aclose()` call in `main.py` today — the supabase-py sync client has no async shutdown path; that arrives in Phase 078 (CQ-SUPA-01). A reader scanning for `_supabase.aclose()` to verify the BEFORE-Supabase claim will find nothing and may assume the comment is stale or wrong.

**Fix:** Tighten the comment to call out the forward reference:
```python
# Phase 073 — close the asyncpg pool BEFORE the (Phase 078) _supabase.aclose()
# will be added. Today the pool close runs after Redis aclose and before the
# sandbox shutdown; Supabase has no async close yet (CQ-SUPA-01).
```

### IN-02: Slow lifespan timeout test (5-second wall clock)

**File:** `backend/tests/unit/test_lifespan.py:42-58`
**Issue:** `test_pg_pool_close_timeout_falls_back_to_terminate` calls `asyncio.wait_for(..., timeout=5.0)` with a `_hang_forever` side-effect that sleeps 60s. The test will sit for ~5 seconds of real wall-clock per run before `wait_for` fires. Across CI this adds up.

**Fix:** Patch the lifespan-internal timeout constant (or expose it as a module-level constant) so tests can override it to e.g. 0.05s:
```python
# In app/main.py — extract the magic number:
_PG_POOL_CLOSE_TIMEOUT_S = 5.0
...
await asyncio.wait_for(_pg_pool.close(), timeout=_PG_POOL_CLOSE_TIMEOUT_S)

# In test_lifespan.py:
with patch("app.main._PG_POOL_CLOSE_TIMEOUT_S", 0.05), \
     patch("app.dependencies._pg_pool", mock_pool):
    async with app.router.lifespan_context(app):
        pass
```

### IN-03: `_init_pg_connection` raises propagate up `create_pool`

**File:** `backend/app/dependencies.py:53-71`
**Issue:** If `await conn.set_type_codec(...)` raises (e.g., transient Postgres disconnect mid-init, or unexpected schema with no `jsonb` type), the exception propagates up through `create_pool` and crashes the first caller of `get_pg_pool()`. This is acceptable but worth documenting — a future operator running against an exotic Postgres variant without `pg_catalog.jsonb` would see a startup-time error with no hint that the codec init is the cause.

**Fix:** Wrap the codec registration in a logged context:
```python
async def _init_pg_connection(conn: asyncpg.Connection) -> None:
    try:
        await conn.set_type_codec(
            'jsonb',
            encoder=json.dumps,
            decoder=json.loads,
            schema='pg_catalog',
        )
    except Exception:
        logger = logging.getLogger(__name__)
        logger.exception(
            "JSONB codec registration failed; pool init aborting. "
            "Verify Postgres has pg_catalog.jsonb (PG 9.4+)."
        )
        raise
```

### IN-04: `_pg_pool.terminate()` after `wait_for` cancellation has subtle race

**File:** `backend/app/main.py:117-118`
**Issue:** When `asyncio.wait_for` times out, it CANCELS the inner `_pg_pool.close()` coroutine. asyncpg's `Pool.close()` is documented as cooperative — it will see the CancelledError and (depending on internal state) may leave the pool in a partially-closed state. The subsequent `_pg_pool.terminate()` is safe (it's sync and idempotent in asyncpg), but if any background asyncio task held a connection AND was also awaiting the close completion, the order of operations is implementation-defined. In practice this never bites because lifespan-shutdown is the last thing happening; flagged for posterity.

**Fix:** No code change recommended. Document the contract in the comment:
```python
# Pitfall 4: pool.close() can wedge on stuck queries. wait_for cancels the
# inner close coroutine on timeout — asyncpg sees CancelledError and may leave
# the pool partially-closed. terminate() is the unconditional kill switch.
# Safe at lifespan-shutdown because no other tasks will observe the pool state.
```

### IN-05: `_redis_url` import alias unused in `conftest.py`

**File:** `backend/tests/conftest.py:170`
**Issue:** `import pytest_asyncio as _pytest_asyncio  # noqa: E402` — the alias is created in the same line that already imports the canonical name. Comment claims "back-compat alias for existing fixtures" but only `redis_client` uses `_pytest_asyncio.fixture`, and changing it to `pytest_asyncio.fixture` would be a trivial sweep. Minor housekeeping.

**Fix:** Drop the alias and use `pytest_asyncio.fixture` directly on `redis_client` (line 201). Single-line cleanup.

---

_Reviewed: 2026-05-17T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
