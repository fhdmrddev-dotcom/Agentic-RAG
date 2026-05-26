"""Cross-worker cancel verification (Phase 077 D-077-07/D-077-08).

Launches uvicorn --workers 2, starts a SLOW mocked run (hits Worker A),
then sends DELETE /runs/{run_id} (likely hits Worker B since round-robin).
Asserts the zombie-heal path fires correctly:
  - runs.status = 'cancelled' in Postgres
  - cancel_lock key EXISTS in Redis (with TTL)
  - Synthetic 'zombie_healed' terminal sentinel in Redis stream

The zombie-heal path at runs.py:531-625 already handles cross-worker cancel.
This test only VERIFIES it works -- no new cancel logic needed (D-077-08).

Strategy: Rather than racing a cancel against a fast mock, we set up a
zombie state directly in Redis + Postgres (matching the setup_zombie_state
pattern from _run_helpers.py). This simulates the exact cross-worker scenario
where Worker A died/doesn't have the run in RUN_TASKS, and Worker B handles
the DELETE via the zombie-heal path.

Requires: Redis on 127.0.0.1:6379, Postgres via Supabase on :54322.
The test launches a real uvicorn --workers 2 subprocess with MOCK_LLM_MODE=1
so the server has the auth bypass and mock LLM active.
"""

from __future__ import annotations

import asyncio
import json
import os
import socket
import subprocess
import sys
import time
from pathlib import Path
from uuid import UUID, uuid4

import asyncpg
import httpx
import pytest
import redis.asyncio as aioredis


# ---------------------------------------------------------------------------
# Infrastructure availability guards
# ---------------------------------------------------------------------------

_POSTGRES_TEST_DSN = os.environ.get(
    "POSTGRES_DSN",
    "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
)

_REDIS_URL = os.environ.get("REDIS_URL", "redis://127.0.0.1:6379/0")


def _check_redis_available() -> bool:
    """Synchronous probe for Redis availability."""
    import redis as _sync_redis

    try:
        client = _sync_redis.Redis.from_url(_REDIS_URL, socket_timeout=2)
        client.ping()
        client.close()
        return True
    except Exception:
        return False


def _check_pg_available() -> bool:
    """Synchronous probe for Postgres availability."""
    import asyncio as _a

    try:
        loop = _a.new_event_loop()
        try:
            conn = loop.run_until_complete(
                asyncio.wait_for(asyncpg.connect(_POSTGRES_TEST_DSN), timeout=2.0)
            )
            loop.run_until_complete(conn.close())
            return True
        finally:
            loop.close()
    except Exception:
        return False


REDIS_AVAILABLE = _check_redis_available()
PG_AVAILABLE = _check_pg_available()

pytestmark = [
    pytest.mark.skipif(
        not REDIS_AVAILABLE,
        reason=f"Redis at {_REDIS_URL} not reachable; skipping cross-cancel test",
    ),
    pytest.mark.skipif(
        not PG_AVAILABLE,
        reason=f"Postgres at {_POSTGRES_TEST_DSN} not reachable; skipping cross-cancel test",
    ),
]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _find_free_port() -> int:
    """Get an OS-assigned free port."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


# Test user UUID — matches the MOCK_LLM_MODE auth bypass user
TEST_USER_ID = "00000000-0000-0000-0000-000000000001"


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(scope="module")
def multi_worker_server():
    """Launch uvicorn --workers 2 on a free port with MOCK_LLM_MODE=1.

    The MOCK_LLM_MODE=1 env var activates both the mock LLM (deterministic
    fake stream) and the auth bypass (fixed test user) in the subprocess
    workers. This allows httpx requests without real Supabase auth tokens.
    """
    port = _find_free_port()
    backend_dir = str(Path(__file__).resolve().parents[2])  # backend/
    env = {**os.environ, "MOCK_LLM_MODE": "1"}
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
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    base_url = f"http://127.0.0.1:{port}"

    # Wait for readiness via /health endpoint
    deadline = time.monotonic() + 30
    while time.monotonic() < deadline:
        try:
            r = httpx.get(f"{base_url}/health", timeout=2.0)
            if r.status_code == 200:
                break
        except (httpx.ConnectError, httpx.ReadTimeout):
            time.sleep(0.5)
    else:
        proc.terminate()
        proc.wait(timeout=10)
        raise RuntimeError("uvicorn --workers 2 did not become ready in 30s")

    yield {"port": port, "base_url": base_url, "process": proc}

    proc.terminate()
    try:
        proc.wait(timeout=10)
    except subprocess.TimeoutExpired:
        proc.kill()
        proc.wait(timeout=5)


@pytest.fixture
async def redis_client():
    """Function-scoped async Redis client for direct state manipulation."""
    client = aioredis.from_url(_REDIS_URL, decode_responses=True)
    yield client
    await client.aclose()


@pytest.fixture
async def pg_conn():
    """Function-scoped asyncpg connection for direct Postgres manipulation."""
    conn = await asyncpg.connect(_POSTGRES_TEST_DSN)
    yield conn
    await conn.close()


@pytest.fixture
async def zombie_state(redis_client, pg_conn):
    """Set up a zombie run state: runs row with status='streaming' in Postgres,
    plus Redis sorted set entries and a stream entry.

    Returns (run_id, thread_id) for assertion targets.
    Cleanup deletes the runs row and flushes Redis keys on teardown.
    """
    run_id = uuid4()
    thread_id = uuid4()
    score = time.time()

    # Ensure the test user exists in profiles (FK requirement for runs.user_id)
    await pg_conn.execute(
        """
        INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, confirmation_token, recovery_token)
        VALUES ($1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'test-077@example.com', '$2a$10$dummyhash', now(), now(), now(), '', '')
        ON CONFLICT (id) DO NOTHING
        """,
        UUID(TEST_USER_ID),
    )

    # Ensure thread exists (FK requirement for runs.thread_id)
    await pg_conn.execute(
        """
        INSERT INTO threads (id, user_id, title, created_at)
        VALUES ($1, $2, 'test-077-cross-cancel', now())
        ON CONFLICT (id) DO NOTHING
        """,
        thread_id,
        UUID(TEST_USER_ID),
    )

    # Insert runs row with status='streaming' (zombie scenario)
    await pg_conn.execute(
        """
        INSERT INTO runs (run_id, thread_id, user_id, status, started_at, created_at)
        VALUES ($1, $2, $3, 'streaming', now(), now())
        """,
        run_id,
        thread_id,
        UUID(TEST_USER_ID),
    )

    # Set up Redis state matching a streaming run
    stream_key = f"run:{run_id}"
    await redis_client.xadd(
        stream_key,
        {"data": json.dumps({"type": "delta", "content": "tok0"})},
    )
    await redis_client.zadd("runs:active", {str(run_id): score})
    await redis_client.zadd(f"runs_by_thread:{thread_id}", {str(run_id): score})

    yield run_id, thread_id

    # Cleanup: delete test data
    try:
        await pg_conn.execute("DELETE FROM runs WHERE run_id = $1", run_id)
    except Exception:
        pass
    try:
        await pg_conn.execute("DELETE FROM threads WHERE id = $1", thread_id)
    except Exception:
        pass
    # Redis key cleanup
    for key in [
        stream_key,
        f"run:{run_id}:cancel_lock",
        f"runs_by_thread:{thread_id}",
    ]:
        try:
            await redis_client.delete(key)
        except Exception:
            pass
    try:
        await redis_client.zrem("runs:active", str(run_id))
    except Exception:
        pass


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_cross_worker_cancel_via_zombie_heal(
    multi_worker_server, redis_client, pg_conn, zombie_state
):
    """DELETE /runs/{run_id} triggers zombie-heal when RUN_TASKS has no entry.

    The zombie state (runs.status='streaming' in Postgres, but no in-memory
    RUN_TASKS entry in any worker) is the exact scenario for cross-worker
    cancel. The DELETE handler falls through to the zombie-heal branch at
    runs.py:531-625 and must:
      1. UPDATE Postgres: status='cancelled', error='cancelled_by_user'
      2. SETNX cancel_lock key with TTL
      3. XADD synthetic 'zombie_healed' terminal sentinel to stream
      4. ZREM run_id from runs:active and runs_by_thread sorted sets
    """
    run_id, thread_id = zombie_state
    base_url = multi_worker_server["base_url"]

    # Fire DELETE /runs/{run_id} against the subprocess server
    # The mock auth bypass returns our test user, matching the runs row owner
    async with httpx.AsyncClient(base_url=base_url, timeout=10.0) as client:
        resp = await client.delete(
            f"/runs/{run_id}",
            headers={"Authorization": "Bearer mock-test-token"},
        )

    # --- Assertion 1: HTTP 204 ---
    assert resp.status_code == 204, (
        f"Expected 204 from DELETE /runs/{run_id}, got {resp.status_code}: {resp.text}"
    )

    # Allow a brief moment for async Postgres UPDATE to complete
    await asyncio.sleep(0.5)

    # --- Assertion 2: Postgres status='cancelled' ---
    row = await pg_conn.fetchrow(
        "SELECT status, error FROM runs WHERE run_id = $1",
        run_id,
    )
    assert row is not None, f"runs row for {run_id} not found after DELETE"
    assert row["status"] == "cancelled", (
        f"Expected status='cancelled', got '{row['status']}'"
    )
    assert row["error"] == "cancelled_by_user", (
        f"Expected error='cancelled_by_user', got '{row['error']}'"
    )

    # --- Assertion 3: cancel_lock key EXISTS in Redis ---
    cancel_lock_exists = await redis_client.exists(f"run:{run_id}:cancel_lock")
    assert cancel_lock_exists, (
        f"cancel_lock key 'run:{run_id}:cancel_lock' does not exist in Redis"
    )
    # Verify TTL is set (should be ~60s)
    ttl = await redis_client.ttl(f"run:{run_id}:cancel_lock")
    assert ttl > 0, f"cancel_lock TTL should be > 0, got {ttl}"

    # --- Assertion 4: zombie_healed sentinel in Redis stream ---
    stream_key = f"run:{run_id}"
    entries = await redis_client.xrange(stream_key)
    assert len(entries) >= 2, (
        f"Expected at least 2 stream entries (1 delta + 1 sentinel), got {len(entries)}"
    )
    # The last entry should be the zombie_healed terminal sentinel
    last_entry_id, last_entry_data = entries[-1]
    sentinel = json.loads(last_entry_data["data"])
    assert sentinel.get("type") == "cancelled", (
        f"Expected terminal sentinel type='cancelled', got '{sentinel.get('type')}'"
    )
    assert sentinel.get("reason") == "zombie_healed", (
        f"Expected sentinel reason='zombie_healed', got '{sentinel.get('reason')}'"
    )

    # --- Assertion 5: ZREM from runs:active ---
    active_score = await redis_client.zscore("runs:active", str(run_id))
    assert active_score is None, (
        f"run_id should have been ZREMed from runs:active, but zscore={active_score}"
    )

    # --- Assertion 6: ZREM from runs_by_thread ---
    thread_score = await redis_client.zscore(
        f"runs_by_thread:{thread_id}", str(run_id)
    )
    assert thread_score is None, (
        f"run_id should have been ZREMed from runs_by_thread:{thread_id}, "
        f"but zscore={thread_score}"
    )
