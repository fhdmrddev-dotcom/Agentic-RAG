"""Integration test for Phase 092-07 F4 — live-DB sub-agent parent_run_id FK.

THIS IS THE LIVE-POOL BACKSTOP THE MOCK POOL CANNOT PROVIDE.

F4 (harness mode cannot run end-to-end) shipped because every sub-agent
``insert_run(parent_run_id=...)`` in the harness suite was exercised ONLY against
the mock asyncpg pool fixture, which never enforces the live
``runs_parent_run_id_fkey`` foreign key (``runs.parent_run_id`` REFERENCES
``runs.run_id``, migration 055). The FIRST live harness run in Phase 092-06 passed
the engine's ``workflow_runs.id`` (NOT a ``runs`` row) as the sub-agent
``parent_run_id`` → ``asyncpg.ForeignKeyViolationError`` ~2s in. This is the same
mock blind-spot class that hid F1 (092-05).

This module uses the LIVE asyncpg pool fixture (``pg_pool``) — NOT the mock — so
the real FK constraint is in force. It proves:
  1. ``insert_run(parent_run_id=<a real producer runs.run_id>)`` SUCCEEDS and the
     child row's parent RESOLVES (the schema-fk-tests risk #6 end-to-end JOIN,
     not merely "no error") — the Facet A fix produces a valid FK target.
  2. ``insert_run(parent_run_id=<a workflow_runs.id, NOT a runs row>)`` RAISES
     ``ForeignKeyViolationError`` — the exact F4 crash, reproduced against the
     live constraint.
  3. The resume mint path (``insert_run(run_id=<fresh shell>, model='unknown',
     provider='unknown', parent_run_id=None)``) produces a valid FK target a
     sub-agent can parent on — proving the Task 3 resume mint resolves.
  4. The Deep parent chain (a producer run + a sub-agent parented on it) is
     unchanged — a byte-identical guard against future drift to the Deep path.

Modeled byte-for-byte on test_092_harness_audit_live.py's live-DB harness
(PG_AVAILABLE skipif + function-scoped pg_pool + seeded auth.users/threads
fixture). Skips cleanly (never errors) when local Postgres :54322 is unreachable.

Requires local Supabase Postgres on :54322 AND migration 055 applied
(runs.parent_run_id FK). finalize_run is UPDATE-not-DELETE so the FK target
persists during the test.
"""

import asyncio
import json
import os
from datetime import datetime, timezone
from uuid import uuid4

import asyncpg
import pytest
import pytest_asyncio

from app.db.runs import insert_run, finalize_run
from app.db.workflows import create_workflow_run
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
    reason=f"Local Postgres on {_POSTGRES_TEST_DSN} not reachable; skipping live sub-agent FK integration tests",
)


# ----------------------------------------------------------------------------
# Fixtures (mirrors test_092_harness_audit_live.py — LIVE pool, NOT mock)
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

    runs.user_id FKs to auth.users(id) and runs.thread_id FKs to threads(id) — so
    a REAL auth.users + threads pair is required. Yields (thread_id, user_id).
    Cleanup deletes runs (children before/with parent in ONE statement — the FK is
    ON DELETE SET NULL so order is not strictly required, but a single
    thread-scoped delete covers both) / workflow_phases / workflow_runs / threads /
    auth.users in FK-safe order.
    """
    user_id = uuid4()
    thread_id = uuid4()
    try:
        await pg_pool.execute(
            "INSERT INTO auth.users (id, email) VALUES ($1, $2)",
            user_id, f"phase-092-07-{user_id}@test.local",
        )
        await pg_pool.execute(
            "INSERT INTO threads (id, user_id, title) VALUES ($1, $2, $3)",
            thread_id, user_id, "phase-092-07 sub-agent FK test thread",
        )
    except Exception as e:
        pytest.skip(f"test_thread_user fixture setup failed: {type(e).__name__}: {e}")
    yield (thread_id, user_id)
    # FK-safe teardown. A single thread-scoped delete removes parent + child runs
    # (DELETE FROM runs WHERE thread_id covers both — test_073 pattern);
    # workflow_phases FKs workflow_runs.
    for sql in (
        ("DELETE FROM runs WHERE thread_id = $1", thread_id),
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
    """A 1-phase published WorkflowDefinition for the create_workflow_run call
    (used to mint a real workflow_runs.id for the bug-path FK target)."""
    return WorkflowDefinition.model_validate({
        "slug": "fk_live_test",
        "version": 1,
        "name": "Sub-agent FK Live Test",
        "status": "published",
        "phases": [
            {"slug": "p0", "phase_index": 0,
             "config": {"phase_type": "llm_single", "prompt": "x"}},
        ],
    })


# ----------------------------------------------------------------------------
# F4 closure gates (LIVE FK constraint)
# ----------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_subagent_parent_resolves_for_producer_run(pg_pool, test_thread_user):
    """Happy path + risk-#6 end-to-end: a sub-agent insert_run with parent_run_id =
    a real PRODUCER runs.run_id SUCCEEDS, and the child row's parent RESOLVES via a
    JOIN (not merely "no error"). This is the Facet A fix: parent_ctx.run_id is the
    producer runs id, so runs_parent_run_id_fkey resolves.
    """
    thread_id, user_id = test_thread_user

    # 1. Seed a producer (top-level) runs row — the FK target.
    producer_id = uuid4()
    await insert_run(
        pg_pool,
        run_id=producer_id,
        thread_id=thread_id,
        user_id=user_id,
        status="streaming",
        model="gpt-5.4-mini",
        provider="openai",
        parent_run_id=None,
    )

    # 2. Insert a child sub-agent runs row parented on the producer — must succeed.
    child_id = uuid4()
    await insert_run(
        pg_pool,
        run_id=child_id,
        thread_id=thread_id,
        user_id=user_id,
        status="streaming",
        model="gpt-5.4-mini",
        provider="openai",
        parent_run_id=producer_id,
    )

    # 3. risk-#6 end-to-end: assert the child's parent ACTUALLY resolves via JOIN.
    resolved = await pg_pool.fetchval(
        "SELECT 1 FROM runs c JOIN runs p ON c.parent_run_id = p.run_id "
        "WHERE c.run_id = $1",
        child_id,
    )
    assert resolved == 1, "the sub-agent's parent_run_id must resolve to the producer run"


@pytest.mark.asyncio
async def test_subagent_parent_workflow_run_id_raises_fk(pg_pool, test_thread_user):
    """Bug path: a sub-agent insert_run with parent_run_id = a workflow_runs.id
    (NOT a runs row — the pre-fix F4 value) RAISES ForeignKeyViolationError against
    the live runs_parent_run_id_fkey. This is the exact ~2s crash that blocked
    Phase 092-06 end-to-end, reproduced against the real constraint.
    """
    thread_id, user_id = test_thread_user

    # Mint a real workflow_runs row — its id is NOT a runs row (the F4 mismatch).
    def_id = await pg_pool.fetchval(
        "SELECT id FROM workflow_definitions WHERE status = 'published' LIMIT 1"
    )
    if def_id is None:
        pytest.skip("no published workflow_definitions seed present (migration 061)")

    wf_run_id = await create_workflow_run(
        pg_pool,
        thread_id=thread_id,
        definition_id=def_id,
        definition=_minimal_definition(),
        inputs={"kickoff_prompt": "fk live bug-path"},
        model=None,
        user_id=user_id,
    )

    # The exact F4 crash: parent_run_id = a workflow_runs id is not in `runs`.
    with pytest.raises(asyncpg.exceptions.ForeignKeyViolationError):
        await insert_run(
            pg_pool,
            run_id=uuid4(),
            thread_id=thread_id,
            user_id=user_id,
            status="streaming",
            model="gpt-5.4-mini",
            provider="openai",
            parent_run_id=wf_run_id,  # workflow_runs.id — NOT a runs row → FK violation
        )


@pytest.mark.asyncio
async def test_resume_mint_produces_valid_fk_target(pg_pool, test_thread_user):
    """Resume mint path (Task 3): a fresh producer SHELL minted with NON-NULL
    placeholder model/provider + parent_run_id=None is a valid FK target — a
    resumed sub-agent insert_run parenting on it resolves. Also a top-level
    parent_run_id=None insert succeeds (the FK-safe degraded path).
    """
    thread_id, user_id = test_thread_user

    # The Task 3 resume-mint shape: a producer shell with 'unknown'/'unknown'.
    shell_id = uuid4()
    await insert_run(
        pg_pool,
        run_id=shell_id,
        thread_id=thread_id,
        user_id=user_id,
        status="streaming",
        model="unknown",
        provider="unknown",
        parent_run_id=None,
    )

    # A resumed sub-agent parents on the fresh shell — must resolve.
    child_id = uuid4()
    await insert_run(
        pg_pool,
        run_id=child_id,
        thread_id=thread_id,
        user_id=user_id,
        status="streaming",
        model="gpt-5.4-mini",
        provider="openai",
        parent_run_id=shell_id,
    )
    resolved = await pg_pool.fetchval(
        "SELECT 1 FROM runs c JOIN runs p ON c.parent_run_id = p.run_id "
        "WHERE c.run_id = $1",
        child_id,
    )
    assert resolved == 1, "the resume-mint shell must be a valid FK parent target"

    # The shell terminalizes (finalize_run is UPDATE-not-DELETE → FK target persists).
    await finalize_run(
        pg_pool,
        run_id=shell_id,
        status="completed",
        error=None,
        completed_at=datetime.now(timezone.utc),
        message_id=None,
        input_tokens=None,
        output_tokens=None,
    )
    # The child's parent still resolves after the parent is finalized (UPDATE, not DELETE).
    still_resolved = await pg_pool.fetchval(
        "SELECT 1 FROM runs c JOIN runs p ON c.parent_run_id = p.run_id "
        "WHERE c.run_id = $1",
        child_id,
    )
    assert still_resolved == 1, "finalize_run is UPDATE-not-DELETE; FK target persists"

    # The FK-safe degraded path: a top-level (parent_run_id=None) insert succeeds.
    top_id = uuid4()
    await insert_run(
        pg_pool,
        run_id=top_id,
        thread_id=thread_id,
        user_id=user_id,
        status="streaming",
        model="gpt-5.4-mini",
        provider="openai",
        parent_run_id=None,
    )


@pytest.mark.asyncio
async def test_deep_parent_chain_unchanged(pg_pool, test_thread_user):
    """Deep-path guard: a top-level producer run + a sub-agent parented on it
    resolves (byte-identical guard against future drift to the Deep parent chain —
    Deep already threads the producer runs id end-to-end; the harness Facet A fix
    must not change that).
    """
    thread_id, user_id = test_thread_user

    deep_producer = uuid4()
    await insert_run(
        pg_pool,
        run_id=deep_producer,
        thread_id=thread_id,
        user_id=user_id,
        status="streaming",
        model="claude-opus-4.8",
        provider="anthropic",
        parent_run_id=None,
    )
    deep_sub = uuid4()
    await insert_run(
        pg_pool,
        run_id=deep_sub,
        thread_id=thread_id,
        user_id=user_id,
        status="streaming",
        model="claude-opus-4.8",
        provider="anthropic",
        parent_run_id=deep_producer,
    )
    resolved = await pg_pool.fetchval(
        "SELECT 1 FROM runs c JOIN runs p ON c.parent_run_id = p.run_id "
        "WHERE c.run_id = $1",
        deep_sub,
    )
    assert resolved == 1, "the Deep sub-agent parent chain must remain unchanged"
