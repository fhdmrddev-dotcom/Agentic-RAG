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


# All 21 tools that must be registered (16 base + 5 workspace tools from Phase 084)
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
    # Phase 084: Workspace tools
    "workspace_write",
    "workspace_read",
    "workspace_list",
    "workspace_delete",
    "workspace_diff",
]


def test_registry_has_exactly_21_entries():
    """_TOOL_REGISTRY must contain exactly 21 tool handlers (16 base + 5 workspace)."""
    assert len(_TOOL_REGISTRY) == 21


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


# -- Phase 084 Plan 05: weak-model dispatcher normalization --------------
# Pins the defensive str-`null`/str-int normalization for the 3 workspace
# tools (list/read/diff) with optional params. Weak OpenRouter models
# (e.g. llama-3.3-70b) stringify JSON null and integer values; native
# providers emit proper JSON types so the normalizer is a no-op for them.


def test_normalize_optional_treats_null_string_as_none() -> None:
    from app.services.tool_dispatcher import _normalize_optional
    assert _normalize_optional("null") is None
    assert _normalize_optional("None") is None
    assert _normalize_optional("") is None


def test_normalize_optional_passes_through_real_values() -> None:
    from app.services.tool_dispatcher import _normalize_optional
    assert _normalize_optional("docs/") == "docs/"
    assert _normalize_optional(None) is None
    assert _normalize_optional(42) == 42


def test_normalize_optional_int_coerces_string_integers() -> None:
    from app.services.tool_dispatcher import _normalize_optional_int
    assert _normalize_optional_int("1") == 1
    assert _normalize_optional_int("  42  ") == 42
    assert _normalize_optional_int(7) == 7


def test_normalize_optional_int_null_strings_become_none() -> None:
    from app.services.tool_dispatcher import _normalize_optional_int
    assert _normalize_optional_int("null") is None
    assert _normalize_optional_int("None") is None
    assert _normalize_optional_int("") is None
    assert _normalize_optional_int(None) is None


def test_normalize_optional_int_uncoercible_becomes_none() -> None:
    """Defensive: weird strings shouldn't raise -- the downstream code
    handles None gracefully and treats it as 'no optional given'."""
    from app.services.tool_dispatcher import _normalize_optional_int
    assert _normalize_optional_int("not-a-number") is None
    assert _normalize_optional_int([]) is None


@pytest.mark.asyncio
async def test_workspace_list_normalizes_str_null_prefix() -> None:
    """Handler-level integration: workspace_list with ``{"prefix": "null"}``
    (weak-model emit) must call list_files_in_thread with prefix=None, NOT
    the literal 4-char string "null" that would WHERE LIKE 'null%' to 0 rows.

    This reproduces the exact OpenRouter llama-3.3-70b defect from
    084-HUMAN-UAT Test 4 (thread 5aa25f1d) where a freshly-written file
    was hidden from the agent by a stringified-null prefix bug."""
    from unittest.mock import patch
    from uuid import UUID
    from app.services.tool_dispatcher import _handle_workspace_list, ToolContext

    captured: dict = {}

    async def _fake_list(pool, *, thread_id, prefix=None):
        captured["prefix"] = prefix
        captured["thread_id"] = thread_id
        # Return one row so we exercise the formatted-output branch too.
        return [{"path": "/test.md", "size_bytes": 11, "mime_type": "text/markdown"}]

    fake_thread_id = "00000000-0000-0000-0000-000000000001"
    ctx = ToolContext(
        redis=None, run_id=None, thread_id=fake_thread_id,
        supabase=None, pool="fake_pool", user_settings=None,
        current_user={"id": "u"}, folder_subtree_ids=None,
        scoped_folder_path=None, emit=AsyncMock(), spawn=lambda c: None,
    )
    with patch(
        "app.services.tool_dispatcher.ws_list_files",
        side_effect=_fake_list,
    ):
        result = await _handle_workspace_list({"prefix": "null"}, ctx)

    assert captured["prefix"] is None, (
        f"prefix should be normalized to None, got {captured['prefix']!r}"
    )
    assert captured["thread_id"] == UUID(fake_thread_id)
    assert "/test.md" in result.result
    assert "Workspace is empty" not in result.result


@pytest.mark.asyncio
async def test_workspace_read_coerces_str_int_line_args() -> None:
    """Handler-level integration: workspace_read with stringified ints
    (`{"start_line": "1", "end_line": "5"}`, the exact shape llama-3.3
    emitted in 084-HUMAN-UAT Test 4) must pass int values downstream."""
    from unittest.mock import patch
    from app.services.tool_dispatcher import _handle_workspace_read, ToolContext

    captured: dict = {}

    async def _fake_read(pool, supabase, *, thread_id, path, start_line, end_line):
        captured["start_line"] = start_line
        captured["end_line"] = end_line
        return {"content": "hello world", "is_binary": False, "is_truncated": False}

    ctx = ToolContext(
        redis=None, run_id=None, thread_id="00000000-0000-0000-0000-000000000001",
        supabase=None, pool="fake_pool", user_settings=None,
        current_user={"id": "u"}, folder_subtree_ids=None,
        scoped_folder_path=None, emit=AsyncMock(), spawn=lambda c: None,
    )
    with patch(
        "app.services.tool_dispatcher.ws_read_file",
        side_effect=_fake_read,
    ):
        result = await _handle_workspace_read(
            {"path": "/test.md", "start_line": "1", "end_line": "5"}, ctx,
        )

    assert captured["start_line"] == 1
    assert captured["end_line"] == 5
    assert isinstance(captured["start_line"], int)
    assert isinstance(captured["end_line"], int)
    assert result.result == "hello world"
