"""Regression tests for BUG-260529-01 — write_todos coercion + shape guards.

Some models (e.g. free OpenRouter llama-3.3-70b) serialize the nested ``todos``
tool arg as a JSON string, or emit a list containing non-dict elements. Before
the fix, ``_handle_write_todos`` iterated the string char-by-char (then called
``.get()`` on a ``str``), raising ``'str' object has no attribute 'get'`` and
forcing the agent to loop until the step cap.

These tests exercise the dispatcher handler directly (no live Postgres):
  (a) a valid stringified JSON array is parsed + reaches replace_todos as a list[dict]
  (b) a malformed string returns a friendly ToolResult error, no exception
  (c) a list with a non-dict element returns a friendly error, not AttributeError
"""
from __future__ import annotations

import json

import pytest
from unittest.mock import AsyncMock, patch

from app.services.tool_dispatcher import _handle_write_todos, ToolContext, ToolResult


def _ctx():
    """Build a ToolContext with a valid UUID thread_id and a mocked pool.

    ``UUID(ctx.thread_id)`` must parse, and ``ctx.pool.fetch`` is stubbed so the
    post-replace canonical re-SELECT returns [] without touching Postgres.
    """
    pool = AsyncMock()
    pool.fetch = AsyncMock(return_value=[])
    return ToolContext(
        redis=None, run_id="run-1",
        thread_id="6e284fb5-0000-0000-0000-000000000000",
        supabase=None, pool=pool, user_settings=None,
        current_user={"id": "u-1"}, folder_subtree_ids=None,
        scoped_folder_path=None, emit=AsyncMock(), spawn=lambda c: None,
    )


@pytest.mark.asyncio
async def test_stringified_valid_todos_succeeds():
    """Case (a): a valid JSON-string todos arg is parsed and reaches replace_todos."""
    valid = [{"id": "t1", "content": "Plan", "status": "pending"}]
    ctx = _ctx()
    with patch("app.services.todos_service.replace_todos",
               new=AsyncMock(return_value={"accepted": 1, "version": 123})) as rt:
        res = await _handle_write_todos({"todos": json.dumps(valid)}, ctx)
    assert isinstance(res, ToolResult)
    assert json.loads(res.result)["accepted"] == 1
    passed = rt.call_args.args[2]          # 3rd positional arg = todos_in
    assert isinstance(passed, list) and isinstance(passed[0], dict)


@pytest.mark.asyncio
async def test_malformed_string_returns_error():
    """Case (b): a malformed string returns a friendly error, no exception."""
    ctx = _ctx()
    res = await _handle_write_todos({"todos": "[not valid json"}, ctx)
    assert isinstance(res, ToolResult)
    assert res.result.startswith("write_todos:")


@pytest.mark.asyncio
async def test_non_dict_element_returns_error():
    """Case (c): a list with a non-dict element returns a friendly error, not AttributeError."""
    ctx = _ctx()
    res = await _handle_write_todos({"todos": ["just a string"]}, ctx)
    assert isinstance(res, ToolResult)
    assert res.result.startswith("write_todos:")
