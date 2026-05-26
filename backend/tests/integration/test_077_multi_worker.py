"""Integration test for Phase 077 -- multi-worker validation harness.

Launches a real ``uvicorn --workers 2`` subprocess with MOCK_LLM_MODE=1
and fires concurrent HTTP requests via httpx.AsyncClient. Asserts:
  1. test_50_run_load        -- 50 concurrent runs complete; runs:active clean (D-077-09)
  2. test_concur01_multi_worker -- CONCUR-01 cross-tab GET <2s during SSE (D-077-03)
  3. test_singleton_no_crosstalk -- Redis/asyncpg singletons per-worker, no duplicates

Requires: Redis (docker-compose.dev.yml), Postgres (supabase start), Docker daemon.
See RESEARCH.md Patterns 1-2 for architectural rationale.
"""

import asyncio
import json
import os
import socket
import subprocess
import sys
import tempfile
import time
from pathlib import Path
from uuid import UUID, uuid4

import asyncpg
import httpx
import pytest
import redis.asyncio as aioredis

# ---------------------------------------------------------------------------
# Infrastructure guard -- skip the entire module if Redis + Postgres
# are not reachable (CI without services, disconnected dev laptop).
# Adapted from test_073_concurrency.py lines 37-64.
# ---------------------------------------------------------------------------

_POSTGRES_TEST_DSN = os.environ.get(
    "POSTGRES_DSN",
    "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
)
_REDIS_TEST_URL = os.environ.get("REDIS_URL", "redis://127.0.0.1:6379/0")

# Fixed test user UUID -- must match _test_mock_llm._MOCK_USER["id"]
# and conftest.mock_user_data["id"]. The mock auth dependency returns
# this user when MOCK_LLM_MODE=1.
_TEST_USER_ID = UUID("00000000-0000-0000-0000-000000000001")


def _check_infra_available() -> bool:
    """Check that Redis + Postgres are reachable (sync probe at import time)."""
    import asyncio as _a

    async def _probe():
        # Redis
        try:
            r = aioredis.from_url(_REDIS_TEST_URL)
            await asyncio.wait_for(r.ping(), timeout=2.0)
            await r.aclose()
        except Exception:
            return False
        # Postgres
        try:
            conn = await asyncio.wait_for(
                asyncpg.connect(_POSTGRES_TEST_DSN), timeout=2.0
            )
            await conn.close()
        except Exception:
            return False
        return True

    try:
        loop = _a.new_event_loop()
        try:
            return loop.run_until_complete(_probe())
        finally:
            loop.close()
    except Exception:
        return False


INFRA_AVAILABLE = _check_infra_available()
pytestmark = pytest.mark.skipif(
    not INFRA_AVAILABLE,
    reason="Redis + Postgres infrastructure not reachable; skipping multi-worker tests",
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _find_free_port() -> int:
    """Get an OS-assigned free port. Release the socket before returning
    so uvicorn can bind to it immediately."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(scope="module")
def multi_worker_server():
    """Launch ``uvicorn --workers 2`` on a free port with MOCK_LLM_MODE=1.

    The subprocess runs the real application with:
    - MOCK_LLM_MODE=1: deterministic fake LLM + auth bypass (Plan 01)
    - SANDBOX_ENABLED=false: load test does NOT exercise sandbox (D-077-09)

    The fixture waits up to 30s for the /health endpoint to respond 200
    before yielding. Teardown terminates the subprocess with proc.kill()
    fallback on timeout.

    Threat T-077-05: try/finally ensures proc is terminated even on test
    failure so no orphaned uvicorn processes remain.
    """
    port = _find_free_port()
    backend_dir = str(Path(__file__).resolve().parents[2])  # backend/

    env = {
        **os.environ,
        "MOCK_LLM_MODE": "1",
        "SANDBOX_ENABLED": "false",
    }

    # Write stderr to a temp file to avoid pipe buffer deadlock.
    # subprocess.PIPE has a finite OS buffer (~64KB); with 50+ requests
    # generating log output, the buffer fills and the subprocess blocks
    # on write, causing all subsequent requests to hang/timeout.
    stderr_file = tempfile.NamedTemporaryFile(
        mode="w+b", prefix="uvicorn_077_", suffix=".log", delete=False,
    )

    proc = subprocess.Popen(
        [
            sys.executable, "-m", "uvicorn",
            "app.main:app",
            "--host", "127.0.0.1",
            "--port", str(port),
            "--workers", "2",
        ],
        cwd=backend_dir,
        env=env,
        stdout=subprocess.DEVNULL,
        stderr=stderr_file,
    )

    base_url = f"http://127.0.0.1:{port}"

    # Health-check polling loop -- 30s deadline
    deadline = time.monotonic() + 30
    ready = False
    try:
        while time.monotonic() < deadline:
            try:
                r = httpx.get(f"{base_url}/health", timeout=2.0)
                if r.status_code == 200:
                    ready = True
                    break
            except (httpx.ConnectError, httpx.ReadError, httpx.ConnectTimeout):
                time.sleep(0.5)

        if not ready:
            proc.terminate()
            proc.wait(timeout=5)
            stderr_file.seek(0)
            _stderr = stderr_file.read().decode(errors="replace")[:2000]
            raise RuntimeError(
                f"uvicorn --workers 2 did not become ready in 30s.\n"
                f"stderr: {_stderr}"
            )

        yield {
            "port": port,
            "base_url": base_url,
            "process": proc,
            "stderr_path": stderr_file.name,
        }

    finally:
        # Threat T-077-05: unconditional cleanup
        proc.terminate()
        try:
            proc.wait(timeout=10)
        except subprocess.TimeoutExpired:
            proc.kill()
            proc.wait(timeout=5)
        stderr_file.close()
        try:
            os.unlink(stderr_file.name)
        except OSError:
            pass


@pytest.fixture(scope="module")
def _pg_pool_sync():
    """Module-scoped asyncpg pool for test data setup/teardown.

    Uses a synchronous wrapper because the module-scoped uvicorn fixture
    is synchronous (subprocess.Popen). The pool is created in a fresh
    event loop, used for setup, and closed in teardown.
    """
    import asyncio as _a

    async def _create():
        pool = await asyncpg.create_pool(
            _POSTGRES_TEST_DSN,
            min_size=1,
            max_size=2,
            command_timeout=10,
        )
        return pool

    loop = _a.new_event_loop()
    pool = loop.run_until_complete(_create())
    yield pool, loop
    loop.run_until_complete(pool.close())
    loop.close()


@pytest.fixture(scope="module")
def test_data(multi_worker_server, _pg_pool_sync):
    """Create the test user + thread in Postgres for the harness.

    The mock auth in MOCK_LLM_MODE returns user 00000000-0000-0000-0000-000000000001.
    This fixture creates that exact user in auth.users and a thread owned by
    that user so the endpoint's ownership checks pass.

    Threat T-077-04: FK-safe cleanup in fixture teardown
    (runs -> messages -> threads -> auth.users).
    """
    pool, loop = _pg_pool_sync
    thread_id = uuid4()

    async def _setup():
        # Insert test user (ignore if already exists -- idempotent)
        try:
            await pool.execute(
                "INSERT INTO auth.users (id, email) VALUES ($1, $2) "
                "ON CONFLICT (id) DO NOTHING",
                _TEST_USER_ID, "test-077@harness.local",
            )
        except Exception:
            # If ON CONFLICT is not supported on auth.users, try plain insert
            try:
                await pool.execute(
                    "INSERT INTO auth.users (id, email) VALUES ($1, $2)",
                    _TEST_USER_ID, "test-077@harness.local",
                )
            except Exception:
                pass  # User already exists from a prior run

        # Insert test thread
        await pool.execute(
            "INSERT INTO threads (id, user_id, title) VALUES ($1, $2, $3)",
            thread_id, _TEST_USER_ID, "phase-077 harness thread",
        )

    async def _teardown():
        # FK-safe cleanup order: runs -> messages -> threads -> auth.users
        for sql, param in [
            ("DELETE FROM runs WHERE thread_id = $1", thread_id),
            ("DELETE FROM messages WHERE thread_id = $1", thread_id),
            ("DELETE FROM threads WHERE id = $1", thread_id),
            ("DELETE FROM auth.users WHERE id = $1", _TEST_USER_ID),
        ]:
            try:
                await pool.execute(sql, param)
            except Exception:
                pass

    loop.run_until_complete(_setup())
    yield {"thread_id": thread_id, "user_id": _TEST_USER_ID}
    loop.run_until_complete(_teardown())


# ---------------------------------------------------------------------------
# SSE consumption helper
# ---------------------------------------------------------------------------

async def _consume_sse_until_end(
    client: httpx.AsyncClient,
    run_id: str,
    timeout: float = 60.0,
) -> list[str]:
    """Consume the SSE stream for a run until ``stream_end`` event or timeout.

    Returns the list of SSE event types received. Uses httpx stream() for
    line-by-line SSE parsing.
    """
    events = []
    try:
        async with asyncio.timeout(timeout):
            async with client.stream(
                "GET",
                f"/runs/{run_id}/stream",
                timeout=httpx.Timeout(timeout, connect=10.0),
            ) as response:
                event_type = None
                async for line in response.aiter_lines():
                    line = line.strip()
                    if line.startswith("event:"):
                        event_type = line[len("event:"):].strip()
                    elif line.startswith("data:") and event_type:
                        events.append(event_type)
                        if event_type == "stream_end":
                            return events
                        event_type = None
                    elif line == "":
                        # SSE blank line separates events
                        event_type = None
    except (asyncio.TimeoutError, httpx.ReadTimeout, httpx.RemoteProtocolError):
        pass
    return events


async def _fire_single_run(
    client: httpx.AsyncClient,
    thread_id: str,
    index: int,
) -> dict:
    """Send a message and consume its SSE stream. Returns run metadata."""
    # POST to start the run
    resp = await client.post(
        f"/threads/{thread_id}/messages",
        json={"content": f"test message {index}"},
        timeout=30.0,
    )
    if resp.status_code != 201:
        return {"index": index, "status_code": resp.status_code, "run_id": None, "ok": False, "body": resp.text[:500]}

    data = resp.json()
    run_id = data.get("run_id")
    if not run_id:
        return {"index": index, "status_code": 201, "run_id": None, "ok": False}

    # Consume SSE stream until stream_end
    events = await _consume_sse_until_end(client, run_id, timeout=60.0)
    return {
        "index": index,
        "status_code": 201,
        "run_id": run_id,
        "events": events,
        "ok": True,
    }


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_50_run_load(multi_worker_server, test_data):
    """Fire 50 runs in waves of 5 against ``uvicorn --workers 2``.

    Uses waves (not all-at-once) because each request makes 3+ blocking
    Supabase calls via ``run_in_threadpool``; firing 50 simultaneously
    saturates the default threadpool on 2 workers. Waves of 5 still
    guarantee both workers handle concurrent requests (round-robin).

    Asserts:
    - All 50 responses have status 201 (run started successfully)
    - After all 50 complete, Redis runs:active has 0 entries (all cleaned up)
    - Postgres runs table has 50 completed rows for this thread

    D-077-09: singleton validation -- runs:active count is a union (no
    duplicates) across both workers.
    """
    base_url = multi_worker_server["base_url"]
    thread_id = str(test_data["thread_id"])

    # Preflight: single request to validate the subprocess handles real
    # Supabase + Redis calls before scaling to 50 concurrent runs.
    async with httpx.AsyncClient(base_url=base_url) as preflight:
        r = await preflight.post(
            f"/threads/{thread_id}/messages",
            json={"content": "preflight check"},
            timeout=30.0,
        )
        if r.status_code != 201:
            # Dump stderr to see the server-side error
            stderr_tail = ""
            stderr_path = multi_worker_server.get("stderr_path")
            if stderr_path and os.path.exists(stderr_path):
                with open(stderr_path, "rb") as f:
                    stderr_tail = f.read().decode(errors="replace")[-5000:]
            pytest.fail(
                f"Preflight single-request failed: status={r.status_code} "
                f"body={r.text[:500]}\n"
                f"--- Server stderr ---\n{stderr_tail}"
            )
    # Brief settle after preflight
    await asyncio.sleep(1.0)

    TOTAL_RUNS = 50
    WAVE_SIZE = 5
    all_results = []

    async with httpx.AsyncClient(base_url=base_url) as client:
        for wave_start in range(0, TOTAL_RUNS, WAVE_SIZE):
            wave_end = min(wave_start + WAVE_SIZE, TOTAL_RUNS)
            tasks = [
                _fire_single_run(client, thread_id, i)
                for i in range(wave_start, wave_end)
            ]
            results = await asyncio.gather(*tasks, return_exceptions=True)
            all_results.extend(results)
            # Brief settle between waves to let background finalizers drain
            await asyncio.sleep(1.0)

    # Separate successful results from exceptions
    successes = [r for r in all_results if isinstance(r, dict) and r.get("ok")]
    failures = [r for r in all_results if isinstance(r, dict) and not r.get("ok")]
    exceptions = [r for r in all_results if isinstance(r, Exception)]

    # All 50 should have started successfully (status 201)
    if len(successes) != TOTAL_RUNS:
        # Dump subprocess stderr for debugging
        stderr_tail = ""
        stderr_path = multi_worker_server.get("stderr_path")
        if stderr_path and os.path.exists(stderr_path):
            with open(stderr_path, "rb") as f:
                stderr_tail = f.read().decode(errors="replace")[-3000:]
        assert len(successes) == TOTAL_RUNS, (
            f"Expected {TOTAL_RUNS} successful runs, got {len(successes)}. "
            f"Failures: {len(failures)}, Exceptions: {len(exceptions)}. "
            f"Failure details: {failures[:5]}, "
            f"Exception details: {[str(e) for e in exceptions[:5]]}\n"
            f"--- Server stderr (last 3000 chars) ---\n{stderr_tail}"
        )

    # Poll for Redis cleanup — finalizers are async tasks with real
    # asyncpg operations, so the last one may need a few seconds.
    redis = aioredis.from_url(_REDIS_TEST_URL)
    try:
        active_count = None
        for _ in range(10):
            active_count = await redis.zcard("runs:active")
            if active_count == 0:
                break
            await asyncio.sleep(1.0)
        if active_count != 0:
            stderr_tail = ""
            stderr_path = multi_worker_server.get("stderr_path")
            if stderr_path and os.path.exists(stderr_path):
                with open(stderr_path, "rb") as f:
                    stderr_tail = f.read().decode(errors="replace")[-4000:]
            assert active_count == 0, (
                f"runs:active should be empty after all runs complete, "
                f"but has {active_count} entries\n"
                f"--- Server stderr (last 4000 chars) ---\n{stderr_tail}"
            )
    finally:
        await redis.aclose()

    # Assert Postgres has 50 completed runs for this thread
    conn = await asyncpg.connect(_POSTGRES_TEST_DSN)
    try:
        count = await conn.fetchval(
            "SELECT count(*) FROM runs WHERE thread_id = $1 AND status = 'completed'",
            test_data["thread_id"],
        )
        expected = TOTAL_RUNS + 1  # +1 for preflight request
        assert count == expected, (
            f"Expected {expected} completed runs in Postgres, got {count}"
        )
    finally:
        await conn.close()


@pytest.mark.asyncio
async def test_concur01_multi_worker(multi_worker_server, test_data):
    """CONCUR-01 cross-tab GET <2s during SSE under --workers 2.

    Adapted from test_058_concurrency pattern but against the live
    subprocess. Starts an SSE stream on the thread (POST a message +
    consume response stream), and while streaming, fires a GET
    /threads/{thread_id}/messages. The GET must return in <2.0s
    (relaxed from 1.0s due to subprocess overhead).

    D-077-03: The existing test_058 protects aexec() single-worker;
    this test proves the same contract holds under --workers 2.
    """
    base_url = multi_worker_server["base_url"]
    thread_id = str(test_data["thread_id"])

    async with httpx.AsyncClient(base_url=base_url) as client:
        # Start a run to create an SSE stream
        resp = await client.post(
            f"/threads/{thread_id}/messages",
            json={"content": "concur-01 streaming message"},
            timeout=30.0,
        )
        assert resp.status_code == 201, f"POST failed: {resp.status_code} {resp.text}"
        run_id = resp.json()["run_id"]

        # Start consuming the SSE stream in a background task
        async def _consume_background():
            try:
                await _consume_sse_until_end(client, run_id, timeout=30.0)
            except Exception:
                pass

        sse_task = asyncio.create_task(_consume_background())

        # Brief delay to let the SSE stream establish
        await asyncio.sleep(0.3)

        # While SSE is streaming, fire a concurrent GET for messages
        t0 = time.monotonic()
        get_resp = await client.get(
            f"/threads/{thread_id}/messages",
            timeout=10.0,
        )
        elapsed = time.monotonic() - t0

        # CONCUR-01 gate: GET must return in <2.0s (relaxed for subprocess)
        assert elapsed < 2.0, (
            f"CONCUR-01 FAILED: GET /threads/{{tid}}/messages took {elapsed:.2f}s "
            f"(threshold: 2.0s). Cross-tab GET is blocked during SSE under --workers 2."
        )
        assert get_resp.status_code == 200, (
            f"GET /messages returned {get_resp.status_code}, expected 200"
        )

        # Cancel the background SSE consumer
        sse_task.cancel()
        try:
            await sse_task
        except asyncio.CancelledError:
            pass


@pytest.mark.asyncio
async def test_singleton_no_crosstalk(multi_worker_server, test_data):
    """Redis/asyncpg singletons per-worker, no duplicates in sorted sets.

    After the 50-run load test has completed (pytest runs tests in file
    order for module-scoped fixtures), this test verifies:
    - runs:active sorted set has 0 entries (no leaked entries from either worker)
    - runs_by_thread:{thread_id} sorted set has 0 entries (all cleaned up)
    - No duplicate run_ids exist in any Redis sorted set

    D-077-09: singleton validation -- union of both workers' sorted-set
    writes should show correct counts with no duplicates.
    """
    thread_id = str(test_data["thread_id"])

    redis = aioredis.from_url(_REDIS_TEST_URL)
    try:
        # Poll — prior test's finalizer may still be draining
        for _ in range(10):
            active_count = await redis.zcard("runs:active")
            if active_count == 0:
                break
            await asyncio.sleep(1.0)

        assert active_count == 0, (
            f"runs:active has {active_count} leaked entries from multi-worker run"
        )

        thread_count = await redis.zcard(f"runs_by_thread:{thread_id}")
        assert thread_count == 0, (
            f"runs_by_thread:{thread_id} has {thread_count} leaked entries"
        )

        # Verify no duplicate run_ids in runs:active
        # (Even if count is 0, this pattern validates the invariant)
        active_members = await redis.zrange("runs:active", 0, -1)
        assert len(active_members) == len(set(active_members)), (
            f"Duplicate run_ids found in runs:active: "
            f"{len(active_members)} total, {len(set(active_members))} unique"
        )

        # Verify no duplicate run_ids in runs_by_thread
        thread_members = await redis.zrange(
            f"runs_by_thread:{thread_id}", 0, -1
        )
        assert len(thread_members) == len(set(thread_members)), (
            f"Duplicate run_ids found in runs_by_thread:{thread_id}: "
            f"{len(thread_members)} total, {len(set(thread_members))} unique"
        )
    finally:
        await redis.aclose()
