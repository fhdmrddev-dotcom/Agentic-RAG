"""Phase 115 Wave-0 — SC#2 whitelist-guard RED scaffold (Plan 03 target).

`query_documents_by_view` is a read-only retrieval tool, so it must honor the same
per-phase whitelist gate every other tool does (the Phase 091 HARNESS-05 contract,
mirrored from `test_harness_whitelist.py`):

  * `phase_whitelist` EXCLUDING the tool → `dispatch_tool` returns the clean
    `tool_not_available_in_phase` refusal ToolResult (no special-casing, no leak).
  * `phase_whitelist` INCLUDING the tool → it dispatches (reaches its handler).
  * `phase_whitelist=None` (Deep Mode) → it dispatches (the guard is a no-op).

Imports are inside the test bodies so collection never errors on the not-yet-built
handler while RED.
"""

import json

import pytest


def _close_spawn(coro, *a, **k):
    """Discard the fire-and-forget tool_refused audit coro cleanly (no event-loop warning)."""
    try:
        coro.close()
    except (AttributeError, RuntimeError):
        pass


@pytest.mark.xfail(strict=False, reason="Plan 03 registers the tool; the guard refuses it when excluded")
@pytest.mark.asyncio
async def test_excluded_tool_refused_clean_envelope(make_tool_context):
    """A phase whitelist EXCLUDING query_documents_by_view → the clean refusal envelope."""
    from app.services.tool_dispatcher import ToolResult, dispatch_tool

    ctx = make_tool_context(
        phase_whitelist=frozenset({"search_documents"}), spawn=_close_spawn
    )
    result = await dispatch_tool("query_documents_by_view", {}, ctx)
    assert isinstance(result, ToolResult)
    payload = json.loads(result.result)
    assert payload["error"] == "tool_not_available_in_phase"
    assert payload["tool"] == "query_documents_by_view"
    assert "query_documents_by_view" not in payload["allowed"]


@pytest.mark.xfail(strict=False, reason="Plan 03 registers query_documents_by_view in _TOOL_REGISTRY")
@pytest.mark.asyncio
async def test_included_tool_dispatches(make_tool_context, monkeypatch):
    """A phase whitelist INCLUDING the tool dispatches it to its handler (not refused)."""
    import app.services.tool_dispatcher as td
    from app.services.tool_dispatcher import ToolResult, dispatch_tool

    called = {}

    async def _spy_handler(args, ctx):
        called["hit"] = True
        return ToolResult(result="ok")

    monkeypatch.setitem(td._TOOL_REGISTRY, "query_documents_by_view", _spy_handler)
    ctx = make_tool_context(phase_whitelist=frozenset({"query_documents_by_view"}))
    result = await dispatch_tool("query_documents_by_view", {}, ctx)
    assert called.get("hit") is True, "an in-whitelist tool must reach its handler"
    assert result.result == "ok"  # not the refusal envelope


@pytest.mark.xfail(strict=False, reason="Plan 03 registers query_documents_by_view in _TOOL_REGISTRY")
@pytest.mark.asyncio
async def test_deep_mode_none_dispatches(make_tool_context, monkeypatch):
    """phase_whitelist=None (Deep Mode) → the guard is a no-op → the tool dispatches."""
    import app.services.tool_dispatcher as td
    from app.services.tool_dispatcher import ToolResult, dispatch_tool

    called = {}

    async def _spy_handler(args, ctx):
        called["hit"] = True
        return ToolResult(result="ok")

    monkeypatch.setitem(td._TOOL_REGISTRY, "query_documents_by_view", _spy_handler)
    ctx = make_tool_context(phase_whitelist=None)
    result = await dispatch_tool("query_documents_by_view", {}, ctx)
    assert called.get("hit") is True, "Deep Mode (None) must dispatch with no special-casing"
    assert result.result == "ok"
