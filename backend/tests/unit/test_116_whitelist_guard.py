"""Phase 116 Wave-0 — SC#2 whitelist-guard RED scaffold (Plan 03 target).

`get_related_documents` is a read-only retrieval tool, so it must honor the same
per-phase whitelist gate every other tool does (the Phase 091 HARNESS-05 contract,
mirrored from `test_115_whitelist_guard.py`):

  * `phase_whitelist` EXCLUDING the tool → `dispatch_tool` returns the clean
    `tool_not_available_in_phase` refusal ToolResult (no special-casing, no leak).
  * `phase_whitelist` INCLUDING the tool → it dispatches (reaches its handler).
  * `phase_whitelist=None` (Deep Mode) → it dispatches (the guard is a no-op,
    byte-identical Deep dispatch).

The first test exercises the REAL `dispatch_tool` whitelist branch (which exists
today, independent of whether the handler is registered) — so it is genuinely GREEN
now. The dispatch-when-allowed tests monkeypatch a spy handler into the registry, so
they too do not depend on Plan 03's handler and are GREEN now. They guard that
nothing special-cases this tool name.

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


@pytest.mark.asyncio
async def test_excluded_tool_refused_clean_envelope(make_tool_context):
    """A phase whitelist EXCLUDING get_related_documents → the clean refusal envelope."""
    from app.services.tool_dispatcher import ToolResult, dispatch_tool

    ctx = make_tool_context(
        phase_whitelist=frozenset({"search_documents"}), spawn=_close_spawn
    )
    result = await dispatch_tool("get_related_documents", {}, ctx)
    assert isinstance(result, ToolResult)
    payload = json.loads(result.result)
    assert payload["error"] == "tool_not_available_in_phase"
    assert payload["tool"] == "get_related_documents"
    assert "get_related_documents" not in payload["allowed"]


@pytest.mark.asyncio
async def test_included_tool_dispatches(make_tool_context, monkeypatch):
    """A phase whitelist INCLUDING the tool dispatches it to its handler (not refused)."""
    import app.services.tool_dispatcher as td
    from app.services.tool_dispatcher import ToolResult, dispatch_tool

    called = {}

    async def _spy_handler(args, ctx):
        called["hit"] = True
        return ToolResult(result="ok")

    monkeypatch.setitem(td._TOOL_REGISTRY, "get_related_documents", _spy_handler)
    ctx = make_tool_context(phase_whitelist=frozenset({"get_related_documents"}))
    result = await dispatch_tool("get_related_documents", {}, ctx)
    assert called.get("hit") is True, "an in-whitelist tool must reach its handler"
    assert result.result == "ok"  # not the refusal envelope


@pytest.mark.asyncio
async def test_deep_mode_none_dispatches(make_tool_context, monkeypatch):
    """phase_whitelist=None (Deep Mode) → the guard is a no-op → the tool dispatches."""
    import app.services.tool_dispatcher as td
    from app.services.tool_dispatcher import ToolResult, dispatch_tool

    called = {}

    async def _spy_handler(args, ctx):
        called["hit"] = True
        return ToolResult(result="ok")

    monkeypatch.setitem(td._TOOL_REGISTRY, "get_related_documents", _spy_handler)
    ctx = make_tool_context(phase_whitelist=None)
    result = await dispatch_tool("get_related_documents", {}, ctx)
    assert called.get("hit") is True, "Deep Mode (None) must dispatch with no special-casing"
    assert result.result == "ok"
