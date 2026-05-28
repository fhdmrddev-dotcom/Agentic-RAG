"""Phase 085 Plan 01 — todos_service unit tests.

Covers 6 behaviors:
  1. replace_todos empty list — DELETEs and returns {"accepted": 0, "version": <int>}
  2. replace_todos happy path — inserts N todos, returns {"accepted": N, ...}
  3. full-state-replace order — second call sequences DELETE then executemany
  4. validation pre-check — invalid status raises BEFORE any DB call
  5. insert_run accepts parent_run_id kwarg
  6. insert_run backward compat (parent_run_id default None still works)

Uses mocked asyncpg pool/conn — real Postgres semantics aren't required at the
unit-test layer because the DDL guard (migration 055 CHECK constraint) is what
enforces invariants in production. Here we verify the *Python control flow*:
ordering, transaction nesting, payload shape.
"""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, call
from uuid import UUID, uuid4

import pytest


THREAD_ID = UUID("11111111-1111-1111-1111-111111111111")


def _make_pool_mock():
    """Build an asyncpg.Pool / Connection / Transaction context-manager mock chain.

    pool.acquire() → async context manager → Connection
    Connection.transaction() → async context manager → None
    Connection.execute / executemany / fetch → AsyncMock
    """
    conn = MagicMock()
    conn.execute = AsyncMock(return_value=None)
    conn.executemany = AsyncMock(return_value=None)
    conn.fetch = AsyncMock(return_value=[])

    tx_cm = MagicMock()
    tx_cm.__aenter__ = AsyncMock(return_value=None)
    tx_cm.__aexit__ = AsyncMock(return_value=False)
    conn.transaction = MagicMock(return_value=tx_cm)

    acquire_cm = MagicMock()
    acquire_cm.__aenter__ = AsyncMock(return_value=conn)
    acquire_cm.__aexit__ = AsyncMock(return_value=False)

    pool = MagicMock()
    pool.acquire = MagicMock(return_value=acquire_cm)
    pool.execute = AsyncMock(return_value=None)
    return pool, conn


# ---------------------------------------------------------------------------
# Tests 1-4: replace_todos behavior
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_replace_todos_empty_list_deletes_and_returns_zero():
    """Behavior 1: empty list deletes all rows; no INSERT runs; version is ms-int."""
    from app.services.todos_service import replace_todos

    pool, conn = _make_pool_mock()
    result = await replace_todos(pool, THREAD_ID, [])

    assert result["accepted"] == 0
    assert isinstance(result["version"], int)
    assert result["version"] > 1_000_000_000_000  # ms-since-epoch ~ 13 digits
    # DELETE ran, executemany did not (empty list short-circuits the INSERT)
    conn.execute.assert_awaited_once()
    args, _ = conn.execute.await_args
    assert "DELETE FROM todos WHERE thread_id" in args[0]
    assert args[1] == THREAD_ID
    conn.executemany.assert_not_awaited()


@pytest.mark.asyncio
async def test_replace_todos_happy_path_inserts_three():
    """Behavior 2: happy path with 3 todos calls executemany with 3 rows."""
    from app.services.todos_service import replace_todos

    pool, conn = _make_pool_mock()
    payload = [
        {"id": "t1", "content": "first", "status": "pending"},
        {"id": "t2", "content": "second", "status": "in_progress", "parent_id": "t1"},
        {"id": "t3", "content": "third", "status": "completed", "order_index": 5},
    ]
    result = await replace_todos(pool, THREAD_ID, payload)

    assert result["accepted"] == 3
    assert isinstance(result["version"], int)
    conn.execute.assert_awaited_once()
    conn.executemany.assert_awaited_once()
    args, _ = conn.executemany.await_args
    assert "INSERT INTO todos" in args[0]
    rows = args[1]
    assert len(rows) == 3
    # Verify row shape: (thread_id, todo_id, content, status, parent_id, order_index)
    assert rows[0] == (THREAD_ID, "t1", "first", "pending", None, 0)
    assert rows[1] == (THREAD_ID, "t2", "second", "in_progress", "t1", 0)
    assert rows[2] == (THREAD_ID, "t3", "third", "completed", None, 5)


@pytest.mark.asyncio
async def test_replace_todos_full_state_replace_sequence():
    """Behavior 3: full-state-replace — single call always issues DELETE then INSERT,
    so a second call with fewer rows would shrink the set in production."""
    from app.services.todos_service import replace_todos

    pool, conn = _make_pool_mock()

    # Track call order across both DB ops
    call_order: list[str] = []

    async def _track_execute(*args, **kwargs):
        call_order.append(f"execute:{args[0][:6]}")  # 'DELETE' prefix
        return None

    async def _track_executemany(*args, **kwargs):
        call_order.append("executemany")
        return None

    conn.execute = AsyncMock(side_effect=_track_execute)
    conn.executemany = AsyncMock(side_effect=_track_executemany)

    await replace_todos(
        pool, THREAD_ID,
        [{"id": "only", "content": "single survivor", "status": "pending"}],
    )

    # DELETE must run BEFORE INSERT to make full-replace atomic
    assert call_order == ["execute:DELETE", "executemany"], (
        f"Expected DELETE then executemany; got {call_order}"
    )


@pytest.mark.asyncio
async def test_replace_todos_invalid_status_raises_before_db():
    """Behavior 4: pre-validation rejects invalid status; DB is never touched."""
    from app.services.todos_service import replace_todos, TodosValidationError

    pool, conn = _make_pool_mock()
    bad = [{"id": "t1", "content": "bad status", "status": "cancelled"}]

    with pytest.raises(TodosValidationError) as ei:
        await replace_todos(pool, THREAD_ID, bad)

    assert "invalid status" in str(ei.value)
    # The DB pool MUST NOT have been acquired
    pool.acquire.assert_not_called()
    conn.execute.assert_not_awaited()
    conn.executemany.assert_not_awaited()


@pytest.mark.asyncio
async def test_replace_todos_missing_id_or_content_raises_before_db():
    """Behavior 4 (companion): missing id or content rejects before DB."""
    from app.services.todos_service import replace_todos, TodosValidationError

    pool, conn = _make_pool_mock()

    with pytest.raises(TodosValidationError) as ei:
        await replace_todos(
            pool, THREAD_ID,
            [{"id": "", "content": "no id", "status": "pending"}],
        )
    assert "requires id and content" in str(ei.value)
    pool.acquire.assert_not_called()


# ---------------------------------------------------------------------------
# Tests 5-6: insert_run extended with parent_run_id
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_insert_run_accepts_parent_run_id_kwarg():
    """Behavior 5: insert_run accepts parent_run_id kwarg; SQL includes the column."""
    from app.db.runs import insert_run

    pool = MagicMock()
    pool.execute = AsyncMock(return_value=None)

    run_id = uuid4()
    thread_id = uuid4()
    user_id = uuid4()
    parent_run_id = uuid4()

    await insert_run(
        pool,
        run_id=run_id,
        thread_id=thread_id,
        user_id=user_id,
        status="streaming",
        model="gpt-4",
        provider="openai",
        parent_run_id=parent_run_id,
    )

    pool.execute.assert_awaited_once()
    args, _ = pool.execute.await_args
    sql = args[0]
    assert "parent_run_id" in sql, f"SQL must include parent_run_id column; got: {sql}"
    # Positional placeholder count: $1..$8 (8 columns)
    assert "$8" in sql
    # The parent_run_id value MUST be the 8th positional arg (after pool, run_id, thread_id,
    # user_id, status, model, provider, spawned_by_worker — i.e. positions 1..8 in the args)
    assert args[-1] == parent_run_id


@pytest.mark.asyncio
async def test_insert_run_backward_compat_default_none():
    """Behavior 6: existing callers passing no parent_run_id still work; column gets NULL."""
    from app.db.runs import insert_run

    pool = MagicMock()
    pool.execute = AsyncMock(return_value=None)

    run_id = uuid4()
    thread_id = uuid4()
    user_id = uuid4()

    # No parent_run_id kwarg — mimics every existing call site (16+)
    await insert_run(
        pool,
        run_id=run_id,
        thread_id=thread_id,
        user_id=user_id,
        status="streaming",
        model="gpt-4",
        provider="openai",
    )

    pool.execute.assert_awaited_once()
    args, _ = pool.execute.await_args
    # The last positional arg corresponds to parent_run_id and must be None
    assert args[-1] is None
