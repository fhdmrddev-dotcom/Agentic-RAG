"""Phase 085 Plan 01 — write_todos handler + registry tests.

Covers 5 behaviors of _handle_write_todos:
  1. invalid status returns "invalid status" ToolResult error
  2. missing id/content returns "requires id and content" ToolResult error
  3. happy path calls replace_todos, re-SELECTs, emits 'todo_updated' SSE
  4. happy path returns JSON containing "accepted" and "version"
  5. _TOOL_REGISTRY["write_todos"] is _handle_write_todos
"""
from __future__ import annotations

import json
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID, uuid4

import pytest

from app.services.tool_dispatcher import (
    ToolContext,
    ToolResult,
    _TOOL_REGISTRY,
    _handle_write_todos,
)


THREAD_ID = "22222222-2222-2222-2222-222222222222"
RUN_ID = uuid4()


def _make_ctx(pool_fetch_rows=None):
    """Build a ToolContext with mocked pool.fetch + AsyncMock emit."""
    pool = MagicMock()
    pool.fetch = AsyncMock(return_value=pool_fetch_rows or [])
    return ToolContext(
        redis=MagicMock(),
        run_id=RUN_ID,
        thread_id=THREAD_ID,
        supabase=MagicMock(),
        pool=pool,
        user_settings=None,
        current_user={"id": "test-user"},
        folder_subtree_ids=None,
        scoped_folder_path=None,
        emit=AsyncMock(),
        spawn=lambda c: None,
    )


# ---------------------------------------------------------------------------
# Registry tests
# ---------------------------------------------------------------------------

def test_write_todos_in_registry():
    """write_todos must be a registry key."""
    assert "write_todos" in _TOOL_REGISTRY


def test_registry_minimum_size_after_085_plan_01():
    """Plan 01 adds 1 tool (write_todos); plans 02 + 03 add 2 more.

    Lower bound = 22. Phase-end gate tightens to 24.
    """
    assert len(_TOOL_REGISTRY) >= 22


def test_registry_entry_is_handler():
    """Behavior 5: registry entry must be the _handle_write_todos function itself."""
    assert _TOOL_REGISTRY["write_todos"] is _handle_write_todos


# ---------------------------------------------------------------------------
# _handle_write_todos behavior tests
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_invalid_status_returns_friendly_error():
    """Behavior 1: invalid status enum is rejected with 'invalid status' string."""
    ctx = _make_ctx()
    args = {"todos": [{"id": "t1", "content": "x", "status": "cancelled"}]}

    result = await _handle_write_todos(args, ctx)

    assert isinstance(result, ToolResult)
    assert "invalid status" in result.result
    # No DB call should have happened
    ctx.pool.fetch.assert_not_awaited()
    ctx.emit.assert_not_awaited()


@pytest.mark.asyncio
async def test_missing_id_returns_friendly_error():
    """Behavior 2: missing id returns 'requires id and content' string."""
    ctx = _make_ctx()
    args = {"todos": [{"id": "", "content": "no id", "status": "pending"}]}

    result = await _handle_write_todos(args, ctx)

    assert isinstance(result, ToolResult)
    assert "requires id and content" in result.result
    ctx.pool.fetch.assert_not_awaited()
    ctx.emit.assert_not_awaited()


@pytest.mark.asyncio
async def test_missing_content_returns_friendly_error():
    """Behavior 2 (companion): missing content also rejected."""
    ctx = _make_ctx()
    args = {"todos": [{"id": "t1", "content": "", "status": "pending"}]}

    result = await _handle_write_todos(args, ctx)

    assert isinstance(result, ToolResult)
    assert "requires id and content" in result.result


@pytest.mark.asyncio
async def test_happy_path_calls_replace_todos_then_reselect_then_emit():
    """Behavior 3: happy path orchestrates replace_todos → re-SELECT → emit."""
    # Simulate the canonical list the re-SELECT would return
    canonical = [
        {"id": "a", "content": "first", "status": "pending",
         "parent_id": None, "order_index": 0},
        {"id": "b", "content": "second", "status": "in_progress",
         "parent_id": None, "order_index": 1},
    ]
    ctx = _make_ctx(pool_fetch_rows=canonical)

    fake_replace = AsyncMock(return_value={"accepted": 2, "version": 1234567890})

    with patch("app.services.todos_service.replace_todos", fake_replace):
        result = await _handle_write_todos(
            {"todos": [
                {"id": "a", "content": "first", "status": "pending"},
                {"id": "b", "content": "second", "status": "in_progress"},
            ]},
            ctx,
        )

    # replace_todos called with (pool, UUID(thread_id), payload)
    fake_replace.assert_awaited_once()
    args, kwargs = fake_replace.await_args
    assert args[0] is ctx.pool
    assert isinstance(args[1], UUID)
    assert str(args[1]) == THREAD_ID
    assert len(args[2]) == 2

    # Re-SELECT against the pool
    ctx.pool.fetch.assert_awaited_once()
    fetch_args, _ = ctx.pool.fetch.await_args
    assert "SELECT todo_id AS id" in fetch_args[0]
    assert "ORDER BY order_index" in fetch_args[0]

    # SSE emit fired with 'todo_updated' carrying the canonical payload
    ctx.emit.assert_awaited_once()
    emit_args, emit_kwargs = ctx.emit.await_args
    assert emit_args[0] is ctx.redis
    assert emit_args[1] is ctx.run_id
    assert emit_args[2] == "todo_updated"
    assert emit_kwargs.get("todos") == canonical


@pytest.mark.asyncio
async def test_happy_path_result_contains_accepted_and_version():
    """Behavior 4: ToolResult.result is JSON with 'accepted' and 'version'."""
    ctx = _make_ctx(pool_fetch_rows=[])

    fake_replace = AsyncMock(return_value={"accepted": 0, "version": 9999})
    with patch("app.services.todos_service.replace_todos", fake_replace):
        result = await _handle_write_todos({"todos": []}, ctx)

    assert isinstance(result, ToolResult)
    parsed = json.loads(result.result)
    assert parsed == {"accepted": 0, "version": 9999}
