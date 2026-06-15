"""Integration test for Phase 092-05 F1 — live-DB harness_audit owner stamp.

THIS IS THE TEST THAT CLOSES THE 091 MOCK BLIND SPOT.

The F1 critical bug (harness mode end-to-end broken) shipped because every
``write_audit`` call in the harness suite was exercised ONLY against the mock
asyncpg pool (``mock_asyncpg_pool``), which never enforces the live
``harness_audit.user_id NOT NULL`` constraint. The first LIVE run in Phase 092
raised ``NotNullViolationError`` on the very first audit write and the run died
before any phase executed.

This module uses the LIVE asyncpg pool fixture (``pg_pool``) — NOT the mock — so
the real constraint is in force. It proves:
  1. ``create_workflow_run(..., user_id=<owner>)`` + ``write_audit(..., user_id=<owner>)``
     writes a REAL harness_audit row carrying the correct owner (no violation).
  2. ``write_audit(..., user_id=None)`` (the pre-fix bug condition) raises
     ``NotNullViolationError`` against the live table — the constraint is real
     and the fix is load-bearing.

Modeled byte-for-byte on test_073_concurrency.py's live-DB harness (PG_AVAILABLE
skipif + function-scoped pg_pool + seeded auth.users/threads fixture). Skips
cleanly (never errors) when local Postgres :54322 is unreachable.

Requires local Supabase Postgres on :54322 AND migration 064 applied
(workflow_runs.user_id) — applied by the operator via the SQL editor at the
092-05 Task 1 checkpoint.
"""

import asyncio
import json
import os
from uuid import uuid4

import asyncpg
import pytest
import pytest_asyncio

from app.db.workflows import create_workflow_run, write_audit
from app.models.harness import WorkflowDefinition


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
    reason=f"Local Postgres on {_POSTGRES_TEST_DSN} not reachable; skipping live harness_audit integration tests",
)


# ----------------------------------------------------------------------------
# Fixtures (mirrors test_073_concurrency.py — LIVE pool, NOT mock_asyncpg_pool)
# ----------------------------------------------------------------------------

@pytest_asyncio.fixture
async def pg_pool():
    """Function-scoped real asyncpg pool against local Postgres :54322.

    Function scope (NOT session) is REQUIRED — pytest-asyncio creates a fresh
    event loop per test, and asyncpg pools are loop-bound.
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
    """Seed a throwaway auth.users + threads pair; clean up afterward.

    harness_audit.user_id FKs to auth.users(id) and workflow_runs.user_id (064)
    FKs to auth.users(id) — so a REAL auth.users row is required. Yields
    (thread_id, user_id). Cleanup deletes harness_audit/workflow_phases/
    workflow_runs/threads/auth.users in FK-safe order.
    """
    user_id = uuid4()
    thread_id = uuid4()
    try:
        await pg_pool.execute(
            "INSERT INTO auth.users (id, email) VALUES ($1, $2)",
            user_id, f"phase-092-{user_id}@test.local",
        )
        await pg_pool.execute(
            "INSERT INTO threads (id, user_id, title) VALUES ($1, $2, $3)",
            thread_id, user_id, "phase-092 audit test thread",
        )
    except Exception as e:
        pytest.skip(f"test_thread_user fixture setup failed: {type(e).__name__}: {e}")
    yield (thread_id, user_id)
    # FK-safe teardown. harness_audit has no FK to workflow_runs (partial index
    # only) so delete it by run-owner; workflow_phases FKs workflow_runs.
    for sql in (
        ("DELETE FROM harness_audit WHERE user_id = $1", user_id),
        ("DELETE FROM workflow_phases WHERE workflow_run_id IN "
         "(SELECT id FROM workflow_runs WHERE thread_id = $1)", thread_id),
        ("DELETE FROM workflow_runs WHERE thread_id = $1", thread_id),
        ("DELETE FROM threads WHERE id = $1", thread_id),
        ("DELETE FROM auth.users WHERE id = $1", user_id),
    ):
        try:
            await pg_pool.execute(*sql)
        except Exception:
            pass


def _minimal_definition() -> WorkflowDefinition:
    """A 1-phase published WorkflowDefinition for the create_workflow_run call.

    create_workflow_run iterates ``definition.phases`` to INSERT workflow_phases;
    the ``definition_id`` is the FK target — we pass a real published seed id (or
    skip if none exists).
    """
    return WorkflowDefinition.model_validate({
        "slug": "audit_live_test",
        "version": 1,
        "name": "Audit Live Test",
        "status": "published",
        "phases": [
            {"slug": "p0", "phase_index": 0,
             "config": {"phase_type": "llm_single", "prompt": "x"}},
        ],
    })


# ----------------------------------------------------------------------------
# F1 closure gates
# ----------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_harness_audit_row_written_for_created_run(pg_pool, test_thread_user):
    """F1: a created run + a write_audit call write a REAL harness_audit row
    carrying the owner user_id — NO NotNullViolationError. This is the exact
    path that died in the Phase 092 live UAT before the fix.
    """
    thread_id, user_id = test_thread_user

    # Need a published definition id (FK target). Reuse a migration-061 seed.
    def_id = await pg_pool.fetchval(
        "SELECT id FROM workflow_definitions WHERE status = 'published' LIMIT 1"
    )
    if def_id is None:
        pytest.skip("no published workflow_definitions seed present (migration 061)")

    run_id = await create_workflow_run(
        pg_pool,
        thread_id=thread_id,
        definition_id=def_id,
        definition=_minimal_definition(),
        inputs={"kickoff_prompt": "live audit test"},
        model=None,
        user_id=user_id,
    )

    # The write that USED to raise NotNullViolationError (F1) — now binds the owner.
    await write_audit(
        pg_pool,
        run_id,
        user_id=user_id,
        event_type="phase_started",
        metadata={"phase": "p0"},
    )

    row = await pg_pool.fetchrow(
        "SELECT user_id::text AS user_id, event_type "
        "FROM harness_audit WHERE run_id = $1",
        run_id,
    )
    assert row is not None, "harness_audit row was not written"
    assert row["user_id"] == str(user_id)
    assert row["event_type"] == "phase_started"


@pytest.mark.asyncio
async def test_write_audit_null_user_id_violates_constraint(pg_pool, test_thread_user):
    """F1 reproduction (now guarded): a write_audit with user_id=None raises
    asyncpg NotNullViolationError against the LIVE table — proving the NOT NULL
    constraint is real and the owner stamp is load-bearing. THIS is what the
    091 mock pool could never catch.
    """
    _thread_id, _user_id = test_thread_user
    run_id = uuid4()

    with pytest.raises(asyncpg.exceptions.NotNullViolationError):
        await write_audit(
            pg_pool,
            run_id,
            user_id=None,
            event_type="run_started",
            metadata={},
        )
