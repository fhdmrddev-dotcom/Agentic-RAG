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


# ---------------------------------------------------------------------------
# Phase 085 Plan 02 — ToolContext extension
# ---------------------------------------------------------------------------

def test_tool_context_default_new_fields():
    """Plan 02 Task 2: ToolContext exposes 4 new fields with safe defaults.

    Constructing a ToolContext with ONLY the pre-Plan-02 required args must
    succeed AND auto-populate parent_run_id=None, per_run_task_semaphore=None,
    available_tools=[], tool_call_id="". This is the regression guard for the
    existing 22 handlers (they don't pass these new kwargs).
    """
    ctx = ToolContext(
        redis=None, run_id=None, thread_id="t", supabase=None, pool=None,
        user_settings=None, current_user={"id": "u"},
        folder_subtree_ids=None, scoped_folder_path=None,
        emit=AsyncMock(), spawn=lambda c: None,
    )
    assert ctx.parent_run_id is None
    assert ctx.per_run_task_semaphore is None
    assert ctx.available_tools == []
    assert ctx.tool_call_id == ""


# ---------------------------------------------------------------------------
# Phase 085 Plan 04 Task 1 — Tool JSON schemas in openai_service
# ---------------------------------------------------------------------------

def test_phase_085_tool_schemas_present():
    """Behavior 1: WRITE_TODOS_TOOL / TASK_TOOL / ASK_USER_TOOL are module-level
    dicts with the correct OpenAI function-calling shape and the canonical names.
    """
    from app.services.openai_service import (
        WRITE_TODOS_TOOL, TASK_TOOL, ASK_USER_TOOL,
    )
    for tool in (WRITE_TODOS_TOOL, TASK_TOOL, ASK_USER_TOOL):
        assert isinstance(tool, dict)
        assert tool.get("type") == "function"
        assert isinstance(tool.get("function"), dict)
        assert isinstance(tool["function"].get("name"), str)
        assert isinstance(tool["function"].get("description"), str)
        assert isinstance(tool["function"].get("parameters"), dict)

    assert WRITE_TODOS_TOOL["function"]["name"] == "write_todos"
    assert TASK_TOOL["function"]["name"] == "task"
    assert ASK_USER_TOOL["function"]["name"] == "ask_user"


def test_phase_085_descriptions_lead_with_use_when_and_do_not_use_for():
    """Behavior 2 + 3 (D-085-25): every new tool's description contains both
    'Use when' AND 'Do not use for' phrases — the lead-with style that
    mitigates the 24-tool selection-accuracy concern across Google +
    DeepSeek/Moonshot."""
    from app.services.openai_service import (
        WRITE_TODOS_TOOL, TASK_TOOL, ASK_USER_TOOL,
    )
    for tool in (WRITE_TODOS_TOOL, TASK_TOOL, ASK_USER_TOOL):
        desc = tool["function"]["description"]
        name = tool["function"]["name"]
        assert "Use when" in desc, f"{name}: description missing 'Use when' phrase"
        assert "Do not use for" in desc, f"{name}: description missing 'Do not use for' phrase"


def test_task_tool_description_excludes_self_and_friends():
    """Behavior 4: TASK_TOOL description explicitly tells the LLM that sub-agents
    cannot call task(), ask_user(), or write_todos() — the 1-level-nesting +
    sub-agent-toolset-exclusion contract is in the description itself."""
    from app.services.openai_service import TASK_TOOL
    assert "Sub-agents cannot call task(), ask_user(), or write_todos()" in TASK_TOOL["function"]["description"]


def test_get_tools_includes_phase_085_tools():
    """Behavior 5: get_tools() returns a list containing the 3 new tools."""
    from app.services.openai_service import get_tools
    names = {t["function"]["name"] for t in get_tools(None)}
    assert {"write_todos", "task", "ask_user"}.issubset(names), (
        f"get_tools() missing Phase 085 tools; got {sorted(names)}"
    )


def test_get_tools_returns_24_tools_with_no_conditional_enabled():
    """Behavior 6: the base toolbox (no web_search / no sandbox) is exactly 19 tools
    (8 KB + 3 skills + 3 memory/sql + 5 workspace = 19) + 3 Phase 085 = 22 minimum.
    Phase-end target is 24 when web_search + sandbox both enabled.
    """
    from app.services.openai_service import get_tools

    # 19 base + 3 phase 085 = 22 with no conditionals
    base_tools = get_tools(None)
    assert len(base_tools) == 22, (
        f"Expected exactly 22 tools in base (no web/sandbox); got {len(base_tools)}: "
        f"{[t['function']['name'] for t in base_tools]}"
    )


def test_phase_085_tool_required_fields_include_all_optional_params():
    """Behavior 7: Every new tool's 'required' list contains ALL parameter
    keys (strict-mode compatibility — all 9 providers including Google + OpenAI
    strict tool calling accept the schema). Workspace tools (Phase 084) follow
    the same convention.
    """
    from app.services.openai_service import (
        WRITE_TODOS_TOOL, TASK_TOOL, ASK_USER_TOOL,
    )
    for tool in (WRITE_TODOS_TOOL, TASK_TOOL, ASK_USER_TOOL):
        params = tool["function"]["parameters"]
        props = set(params.get("properties", {}).keys())
        required = set(params.get("required", []))
        name = tool["function"]["name"]
        assert props == required, (
            f"{name}: 'required' must list every property "
            f"(missing: {props - required}; extra: {required - props})"
        )
