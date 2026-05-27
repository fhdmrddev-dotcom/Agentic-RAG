# Phase 077: Multi-Worker Validation Harness - Pattern Map

**Mapped:** 2026-05-26
**Files analyzed:** 5 new/modified files
**Analogs found:** 5 / 5

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `backend/tests/integration/test_077_multi_worker.py` | test | request-response | `backend/tests/integration/test_073_concurrency.py` | role-match |
| `backend/tests/integration/test_077_cross_cancel.py` | test | request-response | `backend/tests/integration/test_062_delete_zombie.py` + `test_073_concurrency.py` | role-match |
| `backend/tests/integration/test_077_sandbox_reattach.py` | test | CRUD | `backend/tests/integration/test_073_concurrency.py` | role-match |
| `backend/app/_test_mock_llm.py` | utility (test-only) | transform | `backend/app/api/test_fixtures.py` | role-match |
| `backend/app/services/sandbox_service.py` (modified) | service | CRUD | self (current implementation) | exact |

## Pattern Assignments

### `backend/tests/integration/test_077_multi_worker.py` (test, request-response)

**Analog:** `backend/tests/integration/test_073_concurrency.py` (real-Postgres integration pattern) + `backend/tests/integration/test_058_concurrency.py` (httpx.AsyncClient + concurrent request pattern)

**Module docstring pattern** (test_073_concurrency.py lines 1-16):
```python
"""Integration test for Phase 073 -- asyncpg pool binding gates.

Two CONCUR-01 gates run side by side (D-073-11):
  - test_058_concurrency.py -- preserved verbatim; mock-Supabase aexec gate
  - test_073_concurrency.py -- NEW; real-Postgres asyncpg gate (this file)

Four binding-gate tests in this file:
  1. test_singleton_reset_between_tests           -- Plan 01 autouse contract
  2. test_jsonb_codec_round_trip                  -- JSONB codec functional
  3. test_token_capture_happy_path                -- TOKEN-COL-01 non-NULL
  4. test_cross_tab_unblocked_during_asyncpg_sse  -- CONCUR-01 under asyncpg
...
"""
```

**External-service availability guard pattern** (test_073_concurrency.py lines 31-64):
```python
_POSTGRES_TEST_DSN = os.environ.get(
    "POSTGRES_DSN",
    "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
)

async def _pg_reachable(dsn: str = _POSTGRES_TEST_DSN) -> bool:
    """Probe local Postgres availability without raising. Used by skipif guard."""
    try:
        conn = await asyncio.wait_for(asyncpg.connect(dsn), timeout=2.0)
        await conn.close()
        return True
    except Exception:
        return False

def _check_pg_available_sync() -> bool:
    """Synchronous wrapper for the async probe (used by pytest.mark.skipif)."""
    import asyncio as _a
    try:
        loop = _a.new_event_loop()
        try:
            return loop.run_until_complete(_pg_reachable())
        finally:
            loop.close()
    except Exception:
        return False

PG_AVAILABLE = _check_pg_available_sync()
pytestmark = pytest.mark.skipif(
    not PG_AVAILABLE,
    reason=f"Local Postgres on {_POSTGRES_TEST_DSN} not reachable; skipping asyncpg integration tests",
)
```
**Adapt for 077:** Probe both Redis and Postgres availability, plus Docker daemon. Use `pytestmark` to skip the entire module if infrastructure is missing.

**httpx.AsyncClient concurrent request pattern** (test_058_concurrency.py lines 230-278):
```python
@pytest.mark.asyncio
async def test_cross_tab_unblocked_during_sse():
    # ...
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as c:
        sse_task = asyncio.create_task(_consume_sse(c, THREAD_A))
        await asyncio.sleep(0.1)
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
    assert elapsed < 1.0, (
        f"... took {elapsed:.2f}s ... Expected < 1.0s."
    )
```
**Adapt for 077:** Replace `ASGITransport` with real HTTP against `http://127.0.0.1:{port}` (subprocess uvicorn). Use `asyncio.gather` for 50 concurrent requests. Auth via real Supabase JWT (not `Bearer test-token`).

**CONCUR-01 elapsed-time assertion pattern** (test_073_concurrency.py lines 247-306):
```python
@pytest.mark.asyncio
async def test_cross_tab_unblocked_during_asyncpg_sse(pg_pool, test_thread_user):
    async def _driver():
        """Simulate a busy hot-path: INSERT then immediate UPDATE."""
        await insert_run(pg_pool, ...)
        await asyncio.sleep(0.05)
        await finalize_run(pg_pool, ...)

    async def _concurrent_read():
        await asyncio.sleep(0.01)
        t0 = time.monotonic()
        result = await pg_pool.fetchrow("SELECT id FROM threads WHERE id = $1", thread_id)
        elapsed = time.monotonic() - t0
        return elapsed, result

    driver_task = asyncio.create_task(_driver())
    elapsed, result = await _concurrent_read()
    await driver_task

    assert elapsed < 1.0, f"concurrent SELECT took {elapsed:.3f}s -- CONCUR-01 binding gate failed"
```

**Fixture cleanup pattern with FK-safe ordering** (test_073_concurrency.py lines 98-136):
```python
@pytest_asyncio.fixture
async def test_thread_user(pg_pool):
    user_id = uuid4()
    thread_id = uuid4()
    try:
        await pg_pool.execute(
            "INSERT INTO auth.users (id, email) VALUES ($1, $2)",
            user_id, f"phase-073-{user_id}@test.local",
        )
        await pg_pool.execute(
            "INSERT INTO threads (id, user_id, title) VALUES ($1, $2, $3)",
            thread_id, user_id, "phase-073 test thread",
        )
    except Exception as e:
        pytest.skip(f"test_thread_user fixture setup failed: {type(e).__name__}: {e}")
    yield (thread_id, user_id)
    # Cleanup -- FK-safe order: runs/messages -> threads -> auth.users
    for sql in (
        ("DELETE FROM runs WHERE thread_id = $1", thread_id),
        ("DELETE FROM messages WHERE thread_id = $1", thread_id),
        ("DELETE FROM threads WHERE id = $1", thread_id),
        ("DELETE FROM auth.users WHERE id = $1", user_id),
    ):
        try:
            await pg_pool.execute(*sql)
        except Exception:
            pass
```

---

### `backend/tests/integration/test_077_cross_cancel.py` (test, request-response)

**Analog:** `backend/tests/integration/test_062_delete_zombie.py` (zombie-heal cancel assertions) + `backend/tests/integration/_run_helpers.py` (setup_zombie_state helper)

**Zombie-state setup helper pattern** (_run_helpers.py lines 356-414):
```python
async def setup_zombie_state(
    redis_client,
    mock_supabase,
    run_id,
    thread_id,
    *,
    n_entries: int = 1,
):
    """Set up a zombie state for DELETE testing (D-062-11)."""
    import json
    import time as _time

    stream_key = f"run:{run_id}"
    for i in range(n_entries):
        await redis_client.xadd(
            stream_key,
            {"data": json.dumps({"type": "delta", "content": f"tok{i}"})},
        )
    score = _time.time()
    await redis_client.zadd("runs:active", {str(run_id): score})
    await redis_client.zadd(f"runs_by_thread:{thread_id}", {str(run_id): score})
```
**Adapt for 077:** Instead of mock setup, use real HTTP: POST a message to start a mocked-LLM run, then DELETE from another request. Assert on real Redis and Postgres state post-cancel.

**Cancel assertion targets** (from runs.py lines 531-625 zombie-heal path):
- `redis.set(f"run:{run_id}:cancel_lock", "1", nx=True, ex=60)` -- cancel_lock key
- `runs.status = 'cancelled'` in Postgres
- Synthetic terminal sentinel `{type: 'cancelled', reason: 'zombie_healed'}` in Redis stream
- ZREM from `runs:active` and `runs_by_thread:{thread_id}`
- EXPIRE 60s on stream key

**Redis assertion pattern** (from conftest.py redis_client fixture, lines 201-226):
```python
@_pytest_asyncio.fixture
async def redis_client():
    import redis.asyncio as aioredis
    client = aioredis.from_url(
        _REDIS_TEST_URL,
        encoding="utf-8",
        decode_responses=True,
    )
    try:
        yield client
    finally:
        await client.aclose()
```
**Adapt for 077:** The cross-cancel test needs a real Redis client to assert on stream contents and sorted set state. Reuse this fixture pattern.

---

### `backend/tests/integration/test_077_sandbox_reattach.py` (test, CRUD)

**Analog:** `backend/app/services/sandbox_service.py` (SandboxSessionManager being tested)

**Existing get_or_create pattern** (sandbox_service.py lines 23-48):
```python
def get_or_create(self, thread_id: str) -> object:
    from llm_sandbox import InteractiveSandboxSession  # lazy import
    self._evict_expired()
    if thread_id not in _sessions:
        session_kwargs: dict = {"lang": "python", "verbose": False}
        custom_image = os.environ.get("SANDBOX_IMAGE")
        if custom_image:
            session_kwargs["image"] = custom_image
        session = InteractiveSandboxSession(**session_kwargs)
        session.open()
        _sessions[thread_id] = session
    _last_used[thread_id] = time.time()
    return _sessions[thread_id]
```
**Adapt for 077:** This test verifies the re-attach path. Test scenario: (1) call `get_or_create(tid)` to create a container, (2) clear `_sessions[tid]` to simulate worker bounce, (3) call `get_or_create(tid)` again, (4) assert it re-attaches to the existing Docker container instead of creating fresh.

**Docker skipif guard pattern** (adapt from test_073 PG_AVAILABLE):
```python
def _docker_available() -> bool:
    try:
        import docker
        client = docker.from_env()
        client.ping()
        return True
    except Exception:
        return False

DOCKER_AVAILABLE = _docker_available()
pytestmark = pytest.mark.skipif(
    not DOCKER_AVAILABLE,
    reason="Docker daemon not reachable; skipping sandbox re-attach tests",
)
```

---

### `backend/app/_test_mock_llm.py` (utility, transform)

**Analog:** `backend/app/api/test_fixtures.py` (env-var-gated test code) + `backend/tests/integration/_run_helpers.py` (_fast_chunks mock pattern)

**Env-var gate + import-time mount pattern** (main.py lines 184-196):
```python
if os.getenv("ENABLE_TEST_FIXTURES", "0") == "1":
    if os.getenv("ENVIRONMENT", "").lower() in ("production", "prod"):
        raise RuntimeError(
            "ENABLE_TEST_FIXTURES=1 in production environment -- refusing to start. "
            "This env var is for local Playwright e2e harness use only "
            "(Phase 063 T-063-05-01)."
        )
    from app.api.test_fixtures import router as test_fixtures_router
    app.include_router(test_fixtures_router)
    logger.warning(
        "ENABLE_TEST_FIXTURES=1 -- /__test__/inject-failed-run endpoint is "
        "MOUNTED. This MUST NOT happen in production (Phase 063 T-063-05-01)."
    )
```
**Adapt for 077:** Same pattern for `MOCK_LLM_MODE=1`. Add production safety gate (refuse to start if `ENVIRONMENT=production`). Mount at bottom of `main.py` after router includes. Instead of mounting a router, call `install_mock()` to patch the streaming entrypoint.

**Mock chunk generator pattern** (_run_helpers.py lines 69-102):
```python
def _make_sse_chunk(content: str):
    """One delta SSE chunk in the shape create_adaptive_streaming_chat yields."""
    chunk = MagicMock()
    chunk.choices = [MagicMock()]
    chunk.choices[0].finish_reason = None
    chunk.choices[0].delta = MagicMock()
    chunk.choices[0].delta.content = content
    chunk.choices[0].delta.tool_calls = None
    return chunk

def _make_done_chunk():
    """Final SSE chunk with finish_reason='stop'."""
    chunk = MagicMock()
    chunk.choices = [MagicMock()]
    chunk.choices[0].finish_reason = "stop"
    chunk.choices[0].delta = MagicMock()
    chunk.choices[0].delta.content = None
    chunk.choices[0].delta.tool_calls = None
    return chunk

def _fast_chunks():
    for token in ("a", "b", "c"):
        yield _make_sse_chunk(token)
    yield _make_done_chunk()
```
**Adapt for 077:** Expand to 5 chunks + optional tool_call chunk. The mock must also include a `usage` attribute on the final chunk (for token accounting in finalize_run). Must return `(iterator, CallingMode.NATIVE)` tuple to match `create_adaptive_streaming_chat` contract.

**CallingMode import** (test_058_concurrency.py line 54):
```python
from app.services.openai_service import CallingMode
```

**Auth bypass pattern for subprocess** -- combine MOCK_LLM_MODE with a dependency override. In the mock module's `install_mock()`, also override `get_current_user`:
```python
# Pattern from conftest.py lines 73-81:
mock_user_data = {"id": "00000000-0000-0000-0000-000000000001", "email": "test@example.com"}
app.dependency_overrides[get_current_user] = lambda: mock_user_data
```
**Adapt for 077:** Per RESEARCH.md Open Question 2, prefer real Supabase auth token. But if using env-var auth bypass, follow the `dependency_overrides` pattern from conftest.py and scope it to MOCK_LLM_MODE only.

---

### `backend/app/services/sandbox_service.py` (service, CRUD -- modified)

**Analog:** Self (current implementation at sandbox_service.py)

**Existing get_or_create structure** (lines 23-48):
```python
def get_or_create(self, thread_id: str) -> object:
    from llm_sandbox import InteractiveSandboxSession
    self._evict_expired()
    if thread_id not in _sessions:
        session_kwargs: dict = {"lang": "python", "verbose": False}
        custom_image = os.environ.get("SANDBOX_IMAGE")
        if custom_image:
            session_kwargs["image"] = custom_image
        session = InteractiveSandboxSession(**session_kwargs)
        session.open()
        _sessions[thread_id] = session
    _last_used[thread_id] = time.time()
    return _sessions[thread_id]
```

**Modification contract (D-077-04/05/06):** Insert Docker container re-attach logic INSIDE the `if thread_id not in _sessions:` block, BEFORE creating a new session. The `get_or_create` signature and external API remain unchanged (D-077-06 transparency requirement). New private method `_find_existing_container(thread_id)` encapsulates Docker SDK lookup.

**Error handling pattern** (sandbox_service.py lines 50-59):
```python
def close_session(self, thread_id: str) -> None:
    session = _sessions.pop(thread_id, None)
    _last_used.pop(thread_id, None)
    if session:
        try:
            session.close()
            logger.info("Sandbox session closed for thread %s", thread_id)
        except Exception as e:
            logger.warning("Error closing sandbox session %s: %s", thread_id, e)
```
**Apply to re-attach:** Docker container lookup must use the same try/except-and-warn pattern. Container lookup failure should fall through to fresh creation (not raise).

**Logging convention** (sandbox_service.py lines 14, 42, 46):
```python
logger = logging.getLogger(__name__)
# ...
logger.info("Sandbox session using custom image %s for thread %s", custom_image, thread_id)
# ...
logger.info("Sandbox session opened for thread %s", thread_id)
```

---

## Shared Patterns

### Singleton Lazy-Init (Cross-Cutting)
**Source:** `backend/app/dependencies.py` lines 12-100
**Apply to:** Understanding of what the harness validates (not new code -- existing pattern)
```python
_redis: aioredis.Redis | None = None

def get_redis() -> aioredis.Redis:
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
The harness must verify: each worker independently initializes its own `_redis`, `_pg_pool`, `_supabase`. After 50 runs, `redis.zcard('runs:active')` shows correct count (no duplicates from cross-worker init).

### RUN_TASKS Registry (Cross-Cutting)
**Source:** `backend/app/api/threads.py` line 92
**Apply to:** Cross-worker cancel test understanding
```python
RUN_TASKS: dict[_uuid_mod.UUID, asyncio.Task] = {}
```
This is per-process. When cancel lands on a different worker than the producer, `RUN_TASKS.get(run_id)` returns `None` and the zombie-heal path at `runs.py:531-625` fires.

### Env-Var Gated Test Code (Cross-Cutting)
**Source:** `backend/app/main.py` lines 184-196
**Apply to:** `_test_mock_llm.py` mount block in `main.py`
```python
if os.getenv("ENABLE_TEST_FIXTURES", "0") == "1":
    if os.getenv("ENVIRONMENT", "").lower() in ("production", "prod"):
        raise RuntimeError("... refusing to start ...")
    from app.api.test_fixtures import router as test_fixtures_router
    app.include_router(test_fixtures_router)
    logger.warning("ENABLE_TEST_FIXTURES=1 -- ... MUST NOT happen in production ...")
```
Mirror this exact pattern for `MOCK_LLM_MODE`: env-var check, production refusal, warning log.

### Lifespan Post-Fork Init
**Source:** `backend/app/main.py` lines 62-125
**Apply to:** Harness singleton validation
```python
@asynccontextmanager
async def lifespan(app_instance):
    anyio.to_thread.current_default_thread_limiter().total_tokens = (
        settings.anyio_thread_tokens
    )
    from app.dependencies import get_redis
    try:
        await asyncio.wait_for(get_redis().ping(), timeout=1.0)
        logger.info("Redis ping ok")
    except Exception as e:
        logger.warning("Redis unreachable: %s", type(e).__name__)
    yield
    # ... shutdown cleanup ...
```
Each worker runs this lifespan independently after spawn. The harness proves this by checking that 50 runs complete successfully under `--workers 2`.

### Test Helpers Import Convention
**Source:** `backend/tests/integration/test_058_concurrency.py` lines 61-73
**Apply to:** Any new test file that needs mock helpers
```python
from tests.integration._run_helpers import (
    USER_ID,
    _make_result,
    _make_sse_chunk,
    _make_done_chunk,
    _fast_chunks,
    _slow_chunks,
    _thread_row,
    _message_row,
    _make_table_builder,
    _build_mock_supabase,
)
```
Absolute imports via `tests.integration._run_helpers`, not relative imports.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| (none) | -- | -- | All files have close analogs in the existing codebase |

**Note:** The subprocess uvicorn fixture pattern (launch `uvicorn --workers 2` as `subprocess.Popen`, health-check loop, teardown) has no existing analog in this codebase. The closest pattern is the `ENABLE_TEST_FIXTURES` env-var gate + httpx.AsyncClient from test_058. RESEARCH.md Pattern 2 provides the reference implementation for the subprocess fixture -- planner should use that as the canonical shape.

## Metadata

**Analog search scope:** `backend/app/`, `backend/tests/integration/`
**Files scanned:** 12 analog candidates read, 5 selected as primary matches
**Pattern extraction date:** 2026-05-26
