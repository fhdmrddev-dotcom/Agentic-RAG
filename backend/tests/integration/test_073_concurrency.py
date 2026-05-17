"""Integration test for Phase 073 — asyncpg pool binding gates.

Two CONCUR-01 gates run side by side (D-073-11):
  - test_058_concurrency.py — preserved verbatim; mock-Supabase aexec gate
  - test_073_concurrency.py — NEW; real-Postgres asyncpg gate (this file)

Four binding-gate tests in this file:
  1. test_singleton_reset_between_tests           — Plan 01 autouse contract
  2. test_jsonb_codec_round_trip                  — JSONB codec functional
  3. test_token_capture_happy_path                — TOKEN-COL-01 non-NULL
  4. test_cross_tab_unblocked_during_asyncpg_sse  — CONCUR-01 under asyncpg

Requires local Supabase Postgres on :54322 (the Supabase CLI's direct PG port).
Each test that touches the DB is @pytest.mark.skipif-guarded on PG_AVAILABLE
so the suite degrades gracefully on CI without Postgres.
"""

import asyncio
import json
import os
import time
from uuid import UUID, uuid4

import asyncpg
import pytest
import pytest_asyncio

from app.db.runs import insert_run, finalize_run, insert_assistant_message


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


# ----------------------------------------------------------------------------
# Fixtures
# ----------------------------------------------------------------------------

@pytest_asyncio.fixture
async def pg_pool():
    """Function-scoped real asyncpg pool against local Postgres :54322.

    Function scope (NOT session) is REQUIRED — pytest-asyncio creates a fresh
    event loop per test, and asyncpg pools are loop-bound. A session pool
    would explode on test 2+ with 'Event loop is closed'.
    """
    async def _init(conn):
        await conn.set_type_codec(
            "jsonb",
            encoder=json.dumps,
            decoder=json.loads,
            schema="pg_catalog",
        )
    pool = await asyncpg.create_pool(
        _POSTGRES_TEST_DSN,
        min_size=1,
        max_size=4,
        init=_init,
    )
    try:
        yield pool
    finally:
        await pool.close()


@pytest_asyncio.fixture
async def test_thread_user(pg_pool):
    """Insert a throwaway auth.users + threads pair for a test run; clean up afterward.

    Local Supabase has FK constraints (threads.user_id -> auth.users.id) that
    don't exist in the mock-supabase test_058 fixture, so we have to seed a
    real auth.users row. Only auth.users.id is strictly NOT NULL with no
    default — everything else accepts NULL or has a default.

    Cleanup at the end deletes runs/messages/threads/auth.users in FK-safe order.
    """
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
        # If schema differs (PK column names, FK targets), report so downstream
        # test sees a real signal rather than a silent FK violation.
        pytest.skip(f"test_thread_user fixture setup failed: {type(e).__name__}: {e}")
    yield (thread_id, user_id)
    # Cleanup — FK-safe order: runs/messages -> threads -> auth.users
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


# ----------------------------------------------------------------------------
# Binding-gate tests
# ----------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_singleton_reset_between_tests():
    """Plan 01 _reset_pg_pool_singleton autouse fixture: _pg_pool starts None.

    Meta-test that the suite-wide autouse fixture (Plan 01 Task 4) is doing
    its job. If this test fails, every other asyncpg test will inherit a
    stale pool from a prior test's event loop -> "Event loop is closed" trap.
    """
    import app.dependencies as _deps
    assert _deps._pg_pool is None, (
        "_reset_pg_pool_singleton autouse fixture did not reset _pg_pool before test entry"
    )


@pytest.mark.asyncio
async def test_jsonb_codec_round_trip(pg_pool, test_thread_user):
    """JSONB codec (D-073-06) round-trips a plain Python list through Postgres.

    Asserts:
      - Writing tool_calls=[{...}] via insert_assistant_message succeeds (no json.dumps boilerplate)
      - Reading the same row back yields a Python list, NOT a string (codec decode works)
      - The round-tripped value equals the original
    """
    thread_id, user_id = test_thread_user
    tool_calls = [
        {"name": "search", "args": {"query": "phase 073"}, "status": "done"},
        {"name": "summarize", "args": {"max_words": 50}, "status": "done"},
    ]
    source_refs = [{"document_id": str(uuid4()), "page": 1}]

    inserted_id = await insert_assistant_message(
        pg_pool,
        thread_id=thread_id,
        user_id=user_id,
        content="round-trip test",
        tool_calls=tool_calls,
        source_refs=source_refs,
        confidence_level="high",
        confidence_avg_similarity=0.95,
        confidence_disclaimer="grounded",
    )
    assert inserted_id is not None

    row = await pg_pool.fetchrow(
        "SELECT tool_calls, source_refs FROM messages WHERE id = $1",
        inserted_id,
    )
    assert row is not None

    # JSONB codec decoded the column as a list (not a str)
    assert isinstance(row["tool_calls"], list)
    assert isinstance(row["source_refs"], list)

    # Round-trip equality
    assert row["tool_calls"] == tool_calls
    assert row["source_refs"] == source_refs


@pytest.mark.asyncio
async def test_token_capture_happy_path(pg_pool, test_thread_user):
    """TOKEN-COL-01 happy path: insert + finalize a runs row with non-NULL tokens.

    Drives insert_run + finalize_run directly (no need to spin up the full
    agent loop — Tasks 1-3 already verified the wire-through; this test
    proves the SQL-level round trip).
    """
    from datetime import datetime, timezone

    thread_id, user_id = test_thread_user
    run_id = uuid4()

    await insert_run(
        pg_pool,
        run_id=run_id,
        thread_id=thread_id,
        user_id=user_id,
        status="streaming",
        model="gpt-4o",
        provider="openai",
    )

    await finalize_run(
        pg_pool,
        run_id=run_id,
        status="completed",
        error=None,
        completed_at=datetime.now(timezone.utc),
        message_id=None,
        input_tokens=120,
        output_tokens=45,
    )

    row = await pg_pool.fetchrow(
        "SELECT status, input_tokens, output_tokens FROM runs WHERE run_id = $1",
        run_id,
    )
    assert row is not None
    assert row["status"] == "completed"
    assert row["input_tokens"] == 120
    assert row["output_tokens"] == 45
    # explicit non-NULL gate (TOKEN-COL-01 SC#3) — equivalent of SQL `input_tokens IS NOT NULL`
    assert row["input_tokens"] is not None
    assert row["output_tokens"] is not None


@pytest.mark.asyncio
async def test_cross_tab_unblocked_during_asyncpg_sse(pg_pool, test_thread_user):
    """CONCUR-01 under asyncpg: a concurrent SELECT stays unblocked (<1s) while
    an asyncpg-driven INSERT/UPDATE pair runs against the same pool.

    Mirrors test_058_concurrency.py's contract but at the DB layer (not the
    full SSE stack — see test_058 for the HTTP-level SSE+GET race). Together
    the two tests cover the cross-tab invariant on both sides of the flip:
      - test_058 (mock supabase): aexec path stays unblocked
      - test_073 (this test):    asyncpg path stays unblocked
    """
    from datetime import datetime, timezone

    thread_id, user_id = test_thread_user
    run_id = uuid4()

    async def _driver():
        """Simulate a busy hot-path: INSERT then immediate UPDATE."""
        await insert_run(
            pg_pool,
            run_id=run_id,
            thread_id=thread_id,
            user_id=user_id,
            status="streaming",
            model="gpt-4o",
            provider="openai",
        )
        # Small simulated work-time, mimicking content_block deltas streaming
        await asyncio.sleep(0.05)
        await finalize_run(
            pg_pool,
            run_id=run_id,
            status="completed",
            error=None,
            completed_at=datetime.now(timezone.utc),
            message_id=None,
            input_tokens=50,
            output_tokens=25,
        )

    async def _concurrent_read():
        """Issue a SELECT against the same pool while the driver is in-flight."""
        # Small delay so we land MID-driver (after INSERT, before UPDATE)
        await asyncio.sleep(0.01)
        t0 = time.monotonic()
        result = await pg_pool.fetchrow(
            "SELECT id FROM threads WHERE id = $1",
            thread_id,
        )
        elapsed = time.monotonic() - t0
        return elapsed, result

    driver_task = asyncio.create_task(_driver())
    elapsed, result = await _concurrent_read()
    await driver_task

    # CONCUR-01 contract: concurrent SELECT returns within 1s even while the
    # asyncpg pool is busy on another connection.
    assert elapsed < 1.0, f"concurrent SELECT took {elapsed:.3f}s — CONCUR-01 binding gate failed"
    assert result is not None  # the thread row exists
