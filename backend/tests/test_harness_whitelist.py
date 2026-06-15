"""Phase 091 — HARNESS-05 whitelist-guard contracts (Plan 06, LIVE).

The dispatch_tool whitelist guard (clean refusal envelope, matching
tool_call_id, Deep-Mode no-op, tool_refused audit) is owned by Plan 06. The
guard lives at the TOP of dispatch_tool() — one provider-agnostic entry, below
all provider streaming branches. None == Deep Mode == literal no-op (the Phase
089 byte-identical invariant).
"""
from __future__ import annotations

import json

import pytest

from app.models.harness import LlmAgentPhaseConfig
from app.services.tool_dispatcher import ToolContext, ToolResult, dispatch_tool


def test_whitelist_context_carries_phase_whitelist(make_tool_context):
    """LIVE anchor — the ctx factory exposes phase_whitelist (None = Deep Mode).

    The whitelist itself is sourced from a phase config's available_tools — the
    guard (Plan 06) converts available_tools → phase_whitelist on the ToolContext.
    """
    cfg = LlmAgentPhaseConfig.model_validate(
        {"phase_type": "llm_agent", "prompt": "x", "available_tools": ["search_documents"]}
    )
    ctx = make_tool_context(phase_whitelist=frozenset(cfg.available_tools))
    assert ctx.phase_whitelist == frozenset({"search_documents"})
    assert make_tool_context().phase_whitelist is None  # Deep Mode default


def test_toolcontext_has_phase_whitelist_field():
    """The real ToolContext dataclass carries phase_whitelist (default None)."""
    assert "phase_whitelist" in ToolContext.__dataclass_fields__
    # default is None → constructable without it (no caller breaks)
    fields = ToolContext.__dataclass_fields__
    assert fields["phase_whitelist"].default is None


@pytest.mark.asyncio
async def test_out_of_whitelist_refused_clean_tool_result(make_tool_context):
    """dispatch_tool of a non-whitelisted tool returns a clean
    {"error":"tool_not_available_in_phase","allowed":[...]} ToolResult (no raise)."""
    def _close_spawn(coro, *a, **k):
        try:
            coro.close()  # discard the fire-and-forget audit coro cleanly
        except (AttributeError, RuntimeError):
            pass

    ctx = make_tool_context(
        phase_whitelist=frozenset({"search_documents"}), spawn=_close_spawn
    )
    result = await dispatch_tool("execute_code", {}, ctx)
    assert isinstance(result, ToolResult)
    payload = json.loads(result.result)
    assert payload["error"] == "tool_not_available_in_phase"
    assert payload["tool"] == "execute_code"
    assert payload["allowed"] == ["search_documents"]
    assert "Available tools here: ['search_documents']" in payload["message"]


@pytest.mark.asyncio
async def test_in_whitelist_tool_dispatches_normally(make_tool_context, monkeypatch):
    """A tool IN the whitelist is NOT refused — it reaches its handler."""
    import app.services.tool_dispatcher as td

    called = {}

    async def _spy_handler(args, ctx):
        called["hit"] = True
        return ToolResult(result="ok")

    monkeypatch.setitem(td._TOOL_REGISTRY, "search_documents", _spy_handler)
    ctx = make_tool_context(phase_whitelist=frozenset({"search_documents"}))
    result = await dispatch_tool("search_documents", {"query": "x"}, ctx)
    assert called.get("hit") is True
    assert result.result == "ok"  # not the refusal envelope


@pytest.mark.asyncio
async def test_deep_mode_none_is_noop(make_tool_context, monkeypatch):
    """phase_whitelist=None → guard skipped → dispatch byte-identical to pre-091.

    A tool NOT in any phase whitelist still dispatches because the guard branch
    is entirely skipped when phase_whitelist is None (Deep Mode).
    """
    import app.services.tool_dispatcher as td

    called = {}

    async def _spy_handler(args, ctx):
        called["hit"] = True
        return ToolResult(result="ok")

    monkeypatch.setitem(td._TOOL_REGISTRY, "execute_code", _spy_handler)
    ctx = make_tool_context(phase_whitelist=None)
    result = await dispatch_tool("execute_code", {}, ctx)
    assert called.get("hit") is True  # guard never fired
    assert result.result == "ok"


@pytest.mark.asyncio
async def test_refusal_audited(make_tool_context):
    """A refused tool fire-and-forgets a harness_audit tool_refused write via ctx.spawn."""
    spawned: list = []

    def _spy_spawn(coro, *a, **k):
        spawned.append(coro)
        # close the coroutine so the event loop doesn't warn about never-awaited
        try:
            coro.close()
        except (AttributeError, RuntimeError):
            pass

    ctx = make_tool_context(
        phase_whitelist=frozenset({"search_documents"}), spawn=_spy_spawn
    )
    await dispatch_tool("execute_code", {}, ctx)
    assert len(spawned) == 1  # exactly one fire-and-forget audit write


@pytest.mark.asyncio
async def test_refusal_audit_failure_never_blocks_dispatch(make_tool_context):
    """If the audit spawn itself raises, the refusal is still returned cleanly."""
    def _raising_spawn(coro, *a, **k):
        try:
            coro.close()
        except (AttributeError, RuntimeError):
            pass
        raise RuntimeError("audit backend down")

    ctx = make_tool_context(
        phase_whitelist=frozenset({"search_documents"}), spawn=_raising_spawn
    )
    result = await dispatch_tool("execute_code", {}, ctx)
    payload = json.loads(result.result)
    assert payload["error"] == "tool_not_available_in_phase"


# ── Phase 098 GOV-01 / D-13 — act/export separability (no regression) ──────────
@pytest.mark.asyncio
async def test_act_export_tool_excluded_from_read_only_phase(make_tool_context):
    """D-13 — a read-only phase that excludes an act/export tool refuses it.

    Phase 098 GOV-01 preserves the per-phase whitelist gate (act/export
    separability) unchanged. A read-only research phase whitelists read tools
    only; an act/export tool (here `workspace_write`, which writes a workspace
    file) is NOT in that set, so `dispatch_tool` returns the clean refusal
    envelope — never reaching the handler. Mirrors the refusal-envelope
    assertion above; selectable by `-k exclude`.
    """
    def _close_spawn(coro, *a, **k):
        try:
            coro.close()  # discard the fire-and-forget tool_refused audit coro cleanly
        except (AttributeError, RuntimeError):
            pass

    read_only_phase = frozenset({"search_documents", "read_document", "ls", "grep"})
    ctx = make_tool_context(phase_whitelist=read_only_phase, spawn=_close_spawn)

    result = await dispatch_tool("workspace_write", {}, ctx)

    assert isinstance(result, ToolResult)
    payload = json.loads(result.result)
    assert payload["error"] == "tool_not_available_in_phase"
    assert payload["tool"] == "workspace_write"
    assert "workspace_write" not in payload["allowed"]  # the act/export tool is excluded
    assert payload["allowed"] == sorted(read_only_phase)
