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


# ═══════════════════════════════════════════════════════════════════════════════
# Phase 189 CONN-01 / D-03 — the 7th phase type RIDES THIS GUARD. Nothing new here.
# ═══════════════════════════════════════════════════════════════════════════════
#
# ⚠ THESE CASES BUILD NO GUARD. That is the point, and it is a red line rather than a
# convenience: SC#1 claims the external-action node "rides the existing per-phase
# tool-whitelist guard", and the only honest way to support that claim is to DRIVE the
# shipped guard with the new type and show it already covers it. A second enforcement path
# would violate the one-home-per-concern rule AND this phase's own zero-new-governance-
# concept flag — and it is exactly what D-03 rejected when it was written.
#
# The enforcement point is `tool_dispatcher.dispatch_tool`'s
# `ctx.phase_whitelist is not None and tool_name not in ctx.phase_whitelist` refusal (with
# its fire-and-forget `tool_refused` audit). `phase_types._build_phase_tool_context` is the
# MAIN RUN's whitelist builder — `api/runs.py:resolve_phase_available_tools` is the
# *Continue* re-read of the same list, not a second builder. Both are exercised below and
# both are named correctly; conflating them is how the last two plans' pointers drifted.


def _external_action_phase(capability: str = "send_email", available_tools=None):
    """A real, model-validated external_action PhaseSpec — never a look-alike."""
    from app.models.harness import WorkflowDefinition

    config = {"phase_type": "external_action", "capability": capability}
    if available_tools is not None:
        config["available_tools"] = available_tools
    wf = WorkflowDefinition.model_validate({
        "slug": "phase-189-whitelist",
        "version": 1,
        "name": "Phase 189 whitelist",
        "status": "draft",
        "phases": [{"slug": "notify", "phase_index": 0, "config": config}],
    })
    return wf, wf.phases[0]


def _harness_ctx():
    """The minimal harness run ctx `_build_phase_tool_context` reads via getattr.

    `producer_run_id` is the ONE thing it refuses to default (Facet A / 092-07): a missing
    value raises rather than silently falling back to the workflow_run id.
    """
    from types import SimpleNamespace
    from uuid import uuid4

    return SimpleNamespace(producer_run_id=uuid4(), run_id=uuid4(), thread_id="t")


def test_external_action_phase_whitelist_carries_its_capability():
    """D-03 — the capability reaches `ToolContext.phase_whitelist` through the SHIPPED
    builder, with no 189-specific branch anywhere in the path.

    Driven through `_build_phase_tool_context` itself rather than through
    `frozenset(config.available_tools)`, because the second would prove a property of the
    test rather than of the run path.
    """
    from app.services.harness.phase_types import _build_phase_tool_context

    _, phase = _external_action_phase("send_email")
    ctx = _build_phase_tool_context(phase, _harness_ctx())

    assert ctx.phase_whitelist == frozenset({"send_email"})
    assert ctx.available_tools == ["send_email"]


@pytest.mark.asyncio
async def test_external_action_phase_refuses_a_tool_not_on_its_whitelist(make_tool_context):
    """D-03 — the shipped refusal, unchanged, applied to the new type.

    An `external_action` phase's whitelist is exactly its capability, so every other tool
    in the product is refused there — including the ones that could actually reach out
    (`execute_code` runs arbitrary Python in the sandbox). The envelope is the shipped
    `tool_not_available_in_phase` shape, byte-for-byte the same one Phase 091 authored.
    """
    def _close_spawn(coro, *a, **k):
        try:
            coro.close()
        except (AttributeError, RuntimeError):
            pass

    _, phase = _external_action_phase("send_email")
    ctx = make_tool_context(
        phase_whitelist=frozenset(phase.config.available_tools), spawn=_close_spawn
    )

    result = await dispatch_tool("execute_code", {}, ctx)

    payload = json.loads(result.result)
    assert payload["error"] == "tool_not_available_in_phase"
    assert payload["tool"] == "execute_code"
    assert payload["allowed"] == ["send_email"]


@pytest.mark.asyncio
async def test_a_whitelisted_capability_with_no_handler_is_a_SOFT_error(make_tool_context):
    """D-22 — a capability name has NO `_TOOL_REGISTRY` handler, and `dispatch_tool`
    answers `"Unknown tool: send_email"` rather than crashing.

    ⚠ **ASSERTED DELIBERATELY. DO NOT "FIX" THIS INTO A RAISE.** For a phase whose entire
    point is that nothing is sent, a soft "unknown tool" string is the SAFEST failure mode
    available: if some future agent ever hallucinates `send_email` as a tool call, it gets
    a harmless sentence back, not a dispatch and not a 500. That outcome is produced by
    D-22's no-registry-entry choice — the capability is a STEP THE EXECUTOR PERFORMS
    (`phase_types._exec_external_action`), never a tool the model may call — and the
    registration that would make it real belongs to Phase 190.

    The name IS honoured by the whitelist while being invisible to the model: that is the
    shipped `render_template` two-layer shape MINUS layer 1, which
    `phase_types._effective_tools`' docblock states in full.
    """
    import app.services.tool_dispatcher as td

    assert "send_email" not in td._TOOL_REGISTRY, (
        "D-22: a capability must never be registered as a dispatchable tool - live egress "
        "is Phase 190"
    )

    ctx = make_tool_context(phase_whitelist=frozenset({"send_email"}))
    result = await dispatch_tool("send_email", {}, ctx)

    assert isinstance(result, ToolResult)
    assert result.result == "Unknown tool: send_email"


def test_the_whitelist_is_re_read_server_side_so_a_lying_client_changes_nothing():
    """D-03 / D-08 — the whole point of putting the capability in `available_tools`, in one
    assertion.

    `api/runs.py:resolve_phase_available_tools` re-reads the list from the PARSED
    DEFINITION at Continue time, never from a client payload or a stale row. And on this
    type the definition itself cannot carry a lie: the config's own validator DERIVES
    `available_tools` from `capability` by TOTAL REPLACEMENT (189-07), so a client that
    submits `execute_code` alongside it does not get a wider whitelist — it gets a
    narrower one.
    """
    from app.api.runs import resolve_phase_available_tools

    definition, phase = _external_action_phase(
        "create_ticket", available_tools=["execute_code", "search_documents"]
    )

    # the lie never survives the parse ...
    assert phase.config.available_tools == ["create_ticket"]
    # ... and the run-time re-read sees only the derived truth.
    assert resolve_phase_available_tools(definition, "notify") == ["create_ticket"]
    # a slug that is not in the definition resolves to no tools at all (shipped behaviour).
    assert resolve_phase_available_tools(definition, "no-such-phase") == []
