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

from unittest.mock import AsyncMock, MagicMock, call, patch
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
# Phase 138 RUN-01b — reconcile_open_todos_on_run_end
# ---------------------------------------------------------------------------

_MARKER = " (run ended — not completed)"


def _row(id_, content, status, order_index=0, parent_id=None):
    """Build a canonical todo row dict as pool.fetch would return it."""
    return {
        "id": id_,
        "content": content,
        "status": status,
        "parent_id": parent_id,
        "order_index": order_index,
    }


@pytest.mark.asyncio
async def test_run_ended_marker_exact_text():
    """The marker constant is the exact locked string (leading space + em-dash, D-03)."""
    from app.services.todos_service import _RUN_ENDED_MARKER

    assert _RUN_ENDED_MARKER == " (run ended — not completed)", repr(_RUN_ENDED_MARKER)


@pytest.mark.asyncio
async def test_reconcile_marks_open_pending_and_in_progress_leaves_completed():
    """(a) open pending AND open in_progress BOTH get the identical suffix (D-02);
    the completed item's content + ALL statuses are byte-unchanged (honesty guardrail);
    replace_todos is called with the FULL 3-item list (S1 full-state-replace)."""
    from app.services import todos_service

    pool, _conn = _make_pool_mock()
    pool.fetch = AsyncMock(return_value=[
        _row("t1", "First task", "pending", order_index=0),
        _row("t2", "Second task", "in_progress", order_index=1),
        _row("t3", "Third task", "completed", order_index=2),
    ])

    with patch.object(
        todos_service, "replace_todos",
        new=AsyncMock(return_value={"accepted": 3, "version": 1}),
    ) as mock_replace:
        await todos_service.reconcile_open_todos_on_run_end(pool, THREAD_ID)

    mock_replace.assert_awaited_once()
    passed = mock_replace.await_args.args[2]
    assert len(passed) == 3
    by_id = {t["id"]: t for t in passed}
    # D-02: identical suffix on BOTH open statuses.
    assert by_id["t1"]["content"] == "First task" + _MARKER
    assert by_id["t2"]["content"] == "Second task" + _MARKER
    # completed content untouched.
    assert by_id["t3"]["content"] == "Third task"
    # honesty guardrail — every status byte-unchanged (never auto-completed).
    assert by_id["t1"]["status"] == "pending"
    assert by_id["t2"]["status"] == "in_progress"
    assert by_id["t3"]["status"] == "completed"


@pytest.mark.asyncio
async def test_reconcile_does_not_stack_marker_and_skips_replace_when_only_open_already_marked():
    """(b) an already-marked open item is NOT re-appended (D-04 no-stack); when it is
    the ONLY open item, replace_todos is NOT called (nothing changed)."""
    from app.services import todos_service

    pool, _conn = _make_pool_mock()
    pool.fetch = AsyncMock(return_value=[
        _row("t1", "First task" + _MARKER, "pending", order_index=0),
        _row("t2", "Done task", "completed", order_index=1),
    ])

    with patch.object(todos_service, "replace_todos", new=AsyncMock()) as mock_replace:
        await todos_service.reconcile_open_todos_on_run_end(pool, THREAD_ID)

    mock_replace.assert_not_awaited()


@pytest.mark.asyncio
async def test_reconcile_all_completed_early_returns_no_replace_no_emit():
    """(c) all-completed / no-open list → early return: NO replace_todos, NO emit (D-14)."""
    from app.services import todos_service

    pool, _conn = _make_pool_mock()
    pool.fetch = AsyncMock(return_value=[
        _row("t1", "Done 1", "completed", order_index=0),
        _row("t2", "Done 2", "completed", order_index=1),
    ])
    emit = AsyncMock()

    with patch.object(todos_service, "replace_todos", new=AsyncMock()) as mock_replace:
        await todos_service.reconcile_open_todos_on_run_end(
            pool, THREAD_ID, emit=emit, redis="R", run_id="RID",
        )

    mock_replace.assert_not_awaited()
    emit.assert_not_awaited()


@pytest.mark.asyncio
async def test_reconcile_empty_list_early_returns():
    """(c companion) an empty todo list → early return, no mutation, no emit."""
    from app.services import todos_service

    pool, _conn = _make_pool_mock()
    pool.fetch = AsyncMock(return_value=[])
    emit = AsyncMock()

    with patch.object(todos_service, "replace_todos", new=AsyncMock()) as mock_replace:
        await todos_service.reconcile_open_todos_on_run_end(
            pool, THREAD_ID, emit=emit, redis="R", run_id="RID",
        )

    mock_replace.assert_not_awaited()
    emit.assert_not_awaited()


@pytest.mark.asyncio
async def test_reconcile_emits_todo_updated_once_with_full_list_on_change():
    """(d) when emit is supplied and a change occurs, todo_updated is emitted exactly
    once with the full re-selected list (S2 shape)."""
    from app.services import todos_service

    pool, _conn = _make_pool_mock()
    pool.fetch = AsyncMock(return_value=[
        _row("t1", "Task", "pending", order_index=0),
    ])
    emit = AsyncMock()

    with patch.object(todos_service, "replace_todos", new=AsyncMock()) as mock_replace:
        await todos_service.reconcile_open_todos_on_run_end(
            pool, THREAD_ID, emit=emit, redis="R", run_id="RID",
        )

    mock_replace.assert_awaited_once()
    emit.assert_awaited_once()
    args, kwargs = emit.await_args
    # (redis, run_id, event, todos=[...]) — identical positional shape to every emit.
    assert args[0] == "R"
    assert args[1] == "RID"
    assert args[2] == "todo_updated"
    assert isinstance(kwargs["todos"], list)
    assert len(kwargs["todos"]) == 1


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
