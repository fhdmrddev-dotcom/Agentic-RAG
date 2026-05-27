"""Smoke tests for tool_dispatcher.py registry wiring.

Validates the registry structure, dispatch routing, and dataclass defaults
without calling actual tool handlers (which require DB/Redis/sandbox).
"""
from __future__ import annotations

import asyncio
import pytest
from unittest.mock import AsyncMock

from app.services.tool_dispatcher import (
    ToolContext,
    ToolResult,
    dispatch_tool,
    _TOOL_REGISTRY,
)


# All 16 tools that must be registered
EXPECTED_TOOLS = [
    "ls",
    "tree",
    "grep",
    "glob",
    "read_document",
    "search_documents",
    "query_documents",
    "web_search",
    "analyze_document",
    "load_skill",
    "save_skill",
    "read_skill_file",
    "execute_code",
    "remember",
    "recall",
    "query_tables",
]


def test_registry_has_exactly_16_entries():
    """_TOOL_REGISTRY must contain exactly 16 tool handlers."""
    assert len(_TOOL_REGISTRY) == 16


def test_registry_contains_all_expected_tools():
    """Every known tool name must be a key in _TOOL_REGISTRY."""
    for tool_name in EXPECTED_TOOLS:
        assert tool_name in _TOOL_REGISTRY, f"Missing tool: {tool_name}"


def test_registry_values_are_callable():
    """Every registry entry must be a callable (async function)."""
    for tool_name, handler in _TOOL_REGISTRY.items():
        assert callable(handler), f"Handler for {tool_name} is not callable"


@pytest.mark.asyncio
async def test_dispatch_unknown_tool_returns_error():
    """dispatch_tool with an unknown tool name returns ToolResult with error message."""
    ctx = ToolContext(
        redis=None,
        run_id=None,
        thread_id="test-thread",
        supabase=None,
        pool=None,
        user_settings=None,
        current_user={"id": "test-user"},
        folder_subtree_ids=None,
        scoped_folder_path=None,
        emit=AsyncMock(),
        spawn=lambda c: None,
    )
    result = await dispatch_tool("nonexistent_tool", {}, ctx)
    assert isinstance(result, ToolResult)
    assert result.result == "Unknown tool: nonexistent_tool"


def test_tool_context_can_be_instantiated():
    """ToolContext can be created with all required fields."""
    ctx = ToolContext(
        redis="fake_redis",
        run_id=None,
        thread_id="t-123",
        supabase="fake_sb",
        pool="fake_pool",
        user_settings=None,
        current_user={"id": "u-456"},
        folder_subtree_ids=None,
        scoped_folder_path="/docs",
        emit=AsyncMock(),
        spawn=lambda c: None,
    )
    assert ctx.thread_id == "t-123"
    assert ctx.current_user["id"] == "u-456"
    assert ctx.model == ""  # default
    assert ctx.previous_files_in_run is None  # default
    assert ctx.tool_index == 0  # default
    assert ctx.iteration == 0  # default


def test_tool_result_defaults():
    """ToolResult defaults are correct."""
    tr = ToolResult(result="test output")
    assert tr.result == "test output"
    assert tr.llm_content is None
    assert tr.source_refs == []
    assert tr.citations == []
    assert tr.similarity_score is None
    assert tr.sub_agent_record is None


def test_tool_result_with_side_effects():
    """ToolResult can carry all side-effect fields."""
    tr = ToolResult(
        result="search results",
        llm_content="stripped content",
        source_refs=[{"document_id": "d1", "filename": "test.pdf"}],
        citations=[{"document_id": "d1", "passage": "some text"}],
        similarity_score=0.85,
        sub_agent_record={"filename": "report.pdf", "task": "summarize"},
    )
    assert tr.llm_content == "stripped content"
    assert len(tr.source_refs) == 1
    assert len(tr.citations) == 1
    assert tr.similarity_score == 0.85
    assert tr.sub_agent_record["task"] == "summarize"


@pytest.mark.asyncio
async def test_dispatch_routes_to_correct_handler():
    """dispatch_tool routes to the registered handler, not a random one."""
    # We can't call the actual handler without mocks, but we can verify
    # that dispatch_tool returns a ToolResult (not None or an exception)
    # for a known tool name by patching the registry.
    original = _TOOL_REGISTRY.get("ls")
    try:
        async def _mock_ls(args, ctx):
            return ToolResult(result="mocked_ls_output")

        _TOOL_REGISTRY["ls"] = _mock_ls
        ctx = ToolContext(
            redis=None, run_id=None, thread_id="t",
            supabase=None, pool=None, user_settings=None,
            current_user={"id": "u"}, folder_subtree_ids=None,
            scoped_folder_path=None, emit=AsyncMock(), spawn=lambda c: None,
        )
        result = await dispatch_tool("ls", {}, ctx)
        assert result.result == "mocked_ls_output"
    finally:
        if original is not None:
            _TOOL_REGISTRY["ls"] = original
