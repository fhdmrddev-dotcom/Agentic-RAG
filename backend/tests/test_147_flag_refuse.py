"""Phase 147 (FLAG-01 / D-04 layer 2 REFUSE) — the fail-closed capability REFUSE seam.

Even if a model calls a capability the HIDE layer omitted, the shared ``dispatch_tool``
seam refuses it with a plain ``capability_disabled`` ToolResult the agent can relay —
for EVERY provider (the refusal is a plain ToolResult string; the agent loop attaches
the ``tool_call_id`` itself, so NO ``provider ==`` branch is ever touched). When the
flag is ON/absent the branch is a literal no-op and dispatch reaches the handler exactly
as before (Deep Mode byte-identical — the Phase 091 ``phase_whitelist is None`` template).
"""
import json
from types import SimpleNamespace

import pytest


def _settings(*, web=True, sandbox=True, self_improve=True):
    return SimpleNamespace(
        web_search_enabled=web,
        sandbox_enabled=sandbox,
        self_improve_enabled=self_improve,
    )


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "tool_name,flag_kwarg",
    [
        ("web_search", "web"),
        ("execute_code", "sandbox"),
        ("save_skill", "self_improve"),
    ],
)
async def test_capability_refused_when_flag_off(
    make_tool_context, monkeypatch, tool_name, flag_kwarg
):
    """Each of the three capability tools → a plain ``capability_disabled`` refusal when
    ITS flag is OFF (the other two stay ON, proving the gate is per-capability)."""
    import app.services.tool_dispatcher as td
    from app.services.tool_dispatcher import ToolResult, dispatch_tool

    monkeypatch.setattr(td, "load_app_settings", lambda: _settings(**{flag_kwarg: False}))
    ctx = make_tool_context(phase_whitelist=None)  # Deep Mode (the whitelist branch is a no-op)
    result = await dispatch_tool(tool_name, {}, ctx)

    assert isinstance(result, ToolResult)
    payload = json.loads(result.result)
    assert payload["error"] == "capability_disabled"
    assert payload["tool"] == tool_name
    assert "disabled by the administrator" in payload["message"]


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "tool_name,flag_kwarg",
    [
        ("web_search", "web"),
        ("execute_code", "sandbox"),
        ("save_skill", "self_improve"),
    ],
)
async def test_capability_dispatches_when_flag_on(
    make_tool_context, monkeypatch, tool_name, flag_kwarg
):
    """Flag ON → the refuse branch is a literal no-op → the tool reaches its handler.
    Asserts the SAME handler path as an unflagged dispatch (the spy 'ok', not the
    refusal envelope) — Deep Mode byte-identical."""
    import app.services.tool_dispatcher as td
    from app.services.tool_dispatcher import ToolResult, dispatch_tool

    monkeypatch.setattr(td, "load_app_settings", lambda: _settings())  # all flags ON
    called = {}

    async def _spy_handler(args, ctx):
        called["hit"] = True
        return ToolResult(result="ok")

    monkeypatch.setitem(td._TOOL_REGISTRY, tool_name, _spy_handler)
    ctx = make_tool_context(phase_whitelist=None)
    result = await dispatch_tool(tool_name, {}, ctx)

    assert called.get("hit") is True, "flag ON must dispatch to the handler (no-op refuse branch)"
    assert result.result == "ok"


@pytest.mark.asyncio
async def test_non_capability_tool_never_refused(make_tool_context, monkeypatch):
    """A non-gated tool is never touched by the capability gate even when ALL capability
    flags are OFF (fast no-op for the common case — no collateral refusals)."""
    import app.services.tool_dispatcher as td
    from app.services.tool_dispatcher import ToolResult, dispatch_tool

    monkeypatch.setattr(
        td, "load_app_settings", lambda: _settings(web=False, sandbox=False, self_improve=False)
    )
    called = {}

    async def _spy_handler(args, ctx):
        called["hit"] = True
        return ToolResult(result="ok")

    monkeypatch.setitem(td._TOOL_REGISTRY, "search_documents", _spy_handler)
    ctx = make_tool_context(phase_whitelist=None)
    result = await dispatch_tool("search_documents", {}, ctx)

    assert called.get("hit") is True
    assert result.result == "ok"


@pytest.mark.asyncio
async def test_read_failure_defaults_capability_on(make_tool_context, monkeypatch):
    """Fail-closed toward last-known-good (D-Q4 / T-147-02): a ``load_app_settings()``
    blow-up (cold cache / DB blip) must NOT spuriously refuse — the tool dispatches."""
    import app.services.tool_dispatcher as td
    from app.services.tool_dispatcher import ToolResult, dispatch_tool

    def _boom():
        raise RuntimeError("settings read failed")

    monkeypatch.setattr(td, "load_app_settings", _boom)
    called = {}

    async def _spy_handler(args, ctx):
        called["hit"] = True
        return ToolResult(result="ok")

    monkeypatch.setitem(td._TOOL_REGISTRY, "execute_code", _spy_handler)
    ctx = make_tool_context(phase_whitelist=None)
    result = await dispatch_tool("execute_code", {}, ctx)

    assert called.get("hit") is True, "a settings-read blip must not disable a capability"
    assert result.result == "ok"
