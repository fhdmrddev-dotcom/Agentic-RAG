"""Phase 085 Plan 02 — sub-agent SSE emit + runs row integration tests.

Covers Tests 3-6, 8 from the plan:
  - Test 3: run_task_sub_agent calls insert_run with parent_run_id=parent.run_id
  - Test 4: emits sub_agent_start on PARENT's stream BEFORE the loop begins
  - Test 5: emits sub_agent_done on PARENT's stream AFTER the loop (in finally)
  - Test 6: sub-agent's internal tool calls dispatch with sub_ctx.run_id == sub_run_id
            (NOT parent's run_id) — Phase 086 demux contract
  - Test 7: on exception, finalize_run(status='error') is called in finally
  - Test 8: sub_ctx.previous_files_in_run is a fresh empty dict (Pitfall 7)
"""
from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID, uuid4

import pytest


THREAD_ID = "55555555-5555-5555-5555-555555555555"
PARENT_RUN_ID = uuid4()


def _parent_ctx(*, previous_files=None, available_tools=None):
    """Build a top-level ToolContext to use as parent_ctx for run_task_sub_agent."""
    from app.services.tool_dispatcher import ToolContext
    redis = MagicMock()
    redis.xadd = AsyncMock()  # _emit_terminal uses xadd
    return ToolContext(
        redis=redis,
        run_id=PARENT_RUN_ID,
        thread_id=THREAD_ID,
        supabase=MagicMock(),
        pool=MagicMock(),
        user_settings=None,
        current_user={"id": "00000000-0000-0000-0000-000000000001"},
        folder_subtree_ids=None,
        scoped_folder_path=None,
        emit=AsyncMock(),
        spawn=lambda c: None,
        model="gpt-4o",
        previous_files_in_run=previous_files if previous_files is not None
                              else {"sentinel-hash": {"filename": "parent.png"}},
        parent_run_id=None,
        per_run_task_semaphore=asyncio.Semaphore(3),
        available_tools=available_tools if available_tools is not None
                        else ["search_documents", "read_document"],
    )


def test_module_exists():
    """Wave 0 scaffold: task_service module imports cleanly."""
    from app.services import task_service
    assert task_service is not None


@pytest.mark.asyncio
async def test_insert_run_called_with_parent_run_id():
    """Test 3: insert_run receives parent_run_id=parent_ctx.run_id."""
    from app.services.task_service import run_task_sub_agent

    parent = _parent_ctx()
    fake_pool = MagicMock()

    insert_calls = []

    async def fake_insert_run(**kwargs):
        insert_calls.append(kwargs)

    # Patch _stream_one_iteration so the loop exits cleanly on iteration 0
    # (no tool calls -> sub-agent produced "final" content, break out of loop).
    async def fake_stream(**_kwargs):
        return ("", [])

    with patch("app.services.task_service.get_pg_pool", AsyncMock(return_value=fake_pool)), \
         patch("app.services.task_service.insert_run", side_effect=fake_insert_run), \
         patch("app.services.task_service.finalize_run", AsyncMock()), \
         patch("app.services.task_service._stream_one_iteration", side_effect=fake_stream):
        await run_task_sub_agent(
            parent_ctx=parent,
            description="do a thing",
            instructions=None,
            allowed_tools=["search_documents"],
            max_steps=5,
        )

    assert len(insert_calls) == 1
    kwargs = insert_calls[0]
    assert kwargs.get("parent_run_id") == PARENT_RUN_ID
    assert isinstance(kwargs.get("run_id"), UUID)
    assert kwargs.get("status") == "streaming"


@pytest.mark.asyncio
async def test_sub_agent_start_emitted_on_parent_stream():
    """Test 4: sub_agent_start fires on PARENT's run_id stream."""
    from app.services.task_service import run_task_sub_agent

    parent = _parent_ctx()

    async def fake_stream(**_kwargs):
        return ("", [])

    with patch("app.services.task_service.get_pg_pool", AsyncMock(return_value=MagicMock())), \
         patch("app.services.task_service.insert_run", AsyncMock()), \
         patch("app.services.task_service.finalize_run", AsyncMock()), \
         patch("app.services.task_service._stream_one_iteration", side_effect=fake_stream):
        await run_task_sub_agent(
            parent_ctx=parent,
            description="do x",
            instructions=None,
            allowed_tools=["search_documents"],
            max_steps=5,
        )

    # Find the sub_agent_start emit in the emit call list
    emit_events = [c.args[2] for c in parent.emit.call_args_list]
    assert "sub_agent_start" in emit_events
    # Verify the parent's run_id was used (positional arg 1)
    start_call = next(c for c in parent.emit.call_args_list if c.args[2] == "sub_agent_start")
    assert start_call.args[1] == PARENT_RUN_ID
    # Required payload fields
    kw = start_call.kwargs
    assert "sub_run_id" in kw
    assert kw["description"] == "do x"
    assert kw["tools"] == ["search_documents"]
    assert kw["max_steps"] == 5


@pytest.mark.asyncio
async def test_sub_agent_done_emitted_on_parent_stream():
    """Test 5: sub_agent_done fires on PARENT's run_id stream (in finally)."""
    from app.services.task_service import run_task_sub_agent

    parent = _parent_ctx()

    async def fake_stream(**_kwargs):
        return ("hello world", [])

    with patch("app.services.task_service.get_pg_pool", AsyncMock(return_value=MagicMock())), \
         patch("app.services.task_service.insert_run", AsyncMock()), \
         patch("app.services.task_service.finalize_run", AsyncMock()), \
         patch("app.services.task_service._stream_one_iteration", side_effect=fake_stream):
        await run_task_sub_agent(
            parent_ctx=parent,
            description="do x",
            instructions=None,
            allowed_tools=["search_documents"],
            max_steps=5,
        )

    emit_events = [c.args[2] for c in parent.emit.call_args_list]
    assert "sub_agent_done" in emit_events
    done_call = next(c for c in parent.emit.call_args_list if c.args[2] == "sub_agent_done")
    assert done_call.args[1] == PARENT_RUN_ID
    assert done_call.kwargs["status"] == "completed"
    assert done_call.kwargs["summary"] == "hello world"


@pytest.mark.asyncio
async def test_sub_agent_internal_dispatch_uses_sub_run_id():
    """Test 6: sub-agent's tool dispatch uses sub_ctx.run_id == sub_run_id,
    NOT parent's run_id (Phase 086 demuxer contract)."""
    from app.services.task_service import run_task_sub_agent

    parent = _parent_ctx()
    captured_ctx_run_ids = []

    async def fake_dispatch(_name, _args, ctx):
        captured_ctx_run_ids.append(ctx.run_id)
        from app.services.tool_dispatcher import ToolResult
        return ToolResult(result="tool ok")

    # First iteration: one tool call. Second iteration: no tool calls (loop breaks).
    iteration_count = {"n": 0}

    async def fake_stream(**_kwargs):
        iteration_count["n"] += 1
        if iteration_count["n"] == 1:
            return ("partial", [{"id": "tc-1", "name": "search_documents", "args": {"query": "x"}}])
        return ("final", [])

    with patch("app.services.task_service.get_pg_pool", AsyncMock(return_value=MagicMock())), \
         patch("app.services.task_service.insert_run", AsyncMock()), \
         patch("app.services.task_service.finalize_run", AsyncMock()), \
         patch("app.services.task_service._stream_one_iteration", side_effect=fake_stream), \
         patch("app.services.task_service.dispatch_tool", side_effect=fake_dispatch):
        await run_task_sub_agent(
            parent_ctx=parent,
            description="do x",
            instructions=None,
            allowed_tools=["search_documents"],
            max_steps=5,
        )

    assert len(captured_ctx_run_ids) == 1
    sub_id = captured_ctx_run_ids[0]
    assert sub_id != PARENT_RUN_ID, "sub-agent tool dispatch must NOT use parent's run_id"
    assert isinstance(sub_id, UUID)


@pytest.mark.asyncio
async def test_finalize_run_called_with_error_status_on_exception():
    """Test 7: exception inside the loop -> finalize_run(status='error') in finally."""
    from app.services.task_service import run_task_sub_agent

    parent = _parent_ctx()
    finalize_calls = []

    async def fake_finalize(**kwargs):
        finalize_calls.append(kwargs)

    async def boom_stream(**_kwargs):
        raise RuntimeError("simulated sub-agent crash")

    with patch("app.services.task_service.get_pg_pool", AsyncMock(return_value=MagicMock())), \
         patch("app.services.task_service.insert_run", AsyncMock()), \
         patch("app.services.task_service.finalize_run", side_effect=fake_finalize), \
         patch("app.services.task_service._stream_one_iteration", side_effect=boom_stream):
        result = await run_task_sub_agent(
            parent_ctx=parent,
            description="do x",
            instructions=None,
            allowed_tools=["search_documents"],
            max_steps=5,
        )

    # The dict result key uses "error" (the internal phase-085 final_status enum),
    # but finalize_run must write the runs.status DB enum value — which is "failed"
    # per the runs CHECK constraint (supabase/full-schema.sql:459-473 — values are
    # 'streaming'|'completed'|'failed'|'cancelled'|'timed_out', NOT 'error').
    # Mismatched name was a PLAN.md slip; the schema is authoritative.
    assert result["status"] == "error"
    assert len(finalize_calls) == 1
    assert finalize_calls[0]["status"] == "failed"


@pytest.mark.asyncio
async def test_sub_ctx_previous_files_is_fresh_dict():
    """Test 8: sub-agent's ToolContext has its own empty previous_files_in_run dict
    (NOT a reference to parent's). Mitigates Pitfall 7 — sub-agent's execute_code
    output tracking must not leak into parent's state.

    We assert this by patching dispatch_tool to capture the sub_ctx and inspecting
    its previous_files_in_run identity vs parent's.
    """
    from app.services.task_service import run_task_sub_agent

    parent = _parent_ctx(previous_files={"sentinel": {"filename": "parent.png"}})
    captured = {}

    async def capture_dispatch(_name, _args, ctx):
        captured["sub_ctx"] = ctx
        from app.services.tool_dispatcher import ToolResult
        return ToolResult(result="ok")

    iteration_count = {"n": 0}

    async def fake_stream(**_kwargs):
        iteration_count["n"] += 1
        if iteration_count["n"] == 1:
            return ("p", [{"id": "tc-1", "name": "search_documents", "args": {}}])
        return ("done", [])

    with patch("app.services.task_service.get_pg_pool", AsyncMock(return_value=MagicMock())), \
         patch("app.services.task_service.insert_run", AsyncMock()), \
         patch("app.services.task_service.finalize_run", AsyncMock()), \
         patch("app.services.task_service._stream_one_iteration", side_effect=fake_stream), \
         patch("app.services.task_service.dispatch_tool", side_effect=capture_dispatch):
        await run_task_sub_agent(
            parent_ctx=parent,
            description="do x",
            instructions=None,
            allowed_tools=["search_documents"],
            max_steps=5,
        )

    sub_ctx = captured["sub_ctx"]
    assert sub_ctx.previous_files_in_run == {}, (
        f"sub_ctx.previous_files_in_run must be empty; got {sub_ctx.previous_files_in_run!r}"
    )
    assert sub_ctx.previous_files_in_run is not parent.previous_files_in_run
    # Parent's dict must NOT have been touched
    assert parent.previous_files_in_run == {"sentinel": {"filename": "parent.png"}}


# ── WR-04 (091-08) — tools_override reaches the model's schema list ───────────

@pytest.mark.asyncio
async def test_tools_override_replaces_schema_list_seen_by_model():
    """When tools_override is given, _stream_one_iteration receives THOSE schemas
    (not the get_tools-rebuilt list) — so the harness budget cap reaches the model."""
    from app.services.task_service import run_task_sub_agent

    parent = _parent_ctx()
    override = [
        {"type": "function", "function": {"name": "search_documents", "description": "x"}}
    ]
    seen_tools = {}

    async def fake_stream(**kwargs):
        seen_tools["tools"] = kwargs.get("tools")
        return ("done", [])

    # get_tools would normally rebuild a list; assert the override wins (and get_tools
    # is NOT consulted for the schema list on this path).
    get_tools_called = {"n": 0}

    def fake_get_tools(_us):
        get_tools_called["n"] += 1
        return [{"type": "function", "function": {"name": "OTHER", "description": "y"}}]

    with patch("app.services.task_service.get_pg_pool", AsyncMock(return_value=MagicMock())), \
         patch("app.services.task_service.insert_run", AsyncMock()), \
         patch("app.services.task_service.finalize_run", AsyncMock()), \
         patch("app.services.task_service.get_tools", side_effect=fake_get_tools), \
         patch("app.services.task_service._stream_one_iteration", side_effect=fake_stream):
        await run_task_sub_agent(
            parent_ctx=parent,
            description="do x",
            instructions=None,
            allowed_tools=["search_documents"],
            max_steps=5,
            tools_override=override,
        )

    assert seen_tools["tools"] is override, "the model must see the override schemas (WR-04)"
    assert get_tools_called["n"] == 0, "tools_override skips the get_tools rebuild"


@pytest.mark.asyncio
async def test_tools_override_none_is_byte_identical_rebuild():
    """tools_override=None → the sub-agent rebuilds the allowed_tools-filtered list
    via get_tools (Deep-Mode/tasks path unchanged — SC#2 byte-identical)."""
    from app.services.task_service import run_task_sub_agent

    parent = _parent_ctx()
    seen_tools = {}

    async def fake_stream(**kwargs):
        seen_tools["tools"] = kwargs.get("tools")
        return ("done", [])

    def fake_get_tools(_us):
        return [
            {"type": "function", "function": {"name": "search_documents", "description": "x"}},
            {"type": "function", "function": {"name": "NOT_ALLOWED", "description": "y"}},
        ]

    with patch("app.services.task_service.get_pg_pool", AsyncMock(return_value=MagicMock())), \
         patch("app.services.task_service.insert_run", AsyncMock()), \
         patch("app.services.task_service.finalize_run", AsyncMock()), \
         patch("app.services.task_service.get_tools", side_effect=fake_get_tools), \
         patch("app.services.task_service._stream_one_iteration", side_effect=fake_stream):
        await run_task_sub_agent(
            parent_ctx=parent,
            description="do x",
            instructions=None,
            allowed_tools=["search_documents"],
            max_steps=5,
            # tools_override omitted → None (existing callers' behavior)
        )

    names = [t["function"]["name"] for t in seen_tools["tools"]]
    assert names == ["search_documents"], "None rebuilds the allowed_tools-filtered list"
