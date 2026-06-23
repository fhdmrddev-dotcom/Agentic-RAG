"""Phase 101.1 (D-05 / D-14) — the gateway-boundary forcing translation + the
shared-path guard.

Plan 101.1-02 (Wave 2) un-marks these from the Wave-0 RED stubs to GREEN. The
tiered-forcing seam lands at the Phase 092.5 ``provider_gateway/`` boundary off
``GatewayRequest.force_tool_name`` + ``GatewayRequest.strict_schema`` (the D-14
routing decision: an ADDITIVE gateway seam, NOT an ``anthropic_service.py``
extraction).

The D-14 invariant (the RED LINE): NO provider branch leaks into the shared chunk/
SSE path; Deep stays byte-identical; each adapter's forcing translation is
self-contained. Mirrors ``test_provider_gateway_seam.py``'s ``GatewayRequest`` /
``open_stream`` import + synthetic-chunk factory.

CONVENTION: ``from app.services... import ...`` is INSIDE each test body for the
forcing symbols so COLLECTION never breaks even mid-refactor. The shared
``GatewayRequest`` import (which EXISTS today) stays at module top, matching the
seam test.
"""

from __future__ import annotations

from types import SimpleNamespace

import pytest

# GatewayRequest / open_stream / CallingMode EXIST today (Phase 092.5) — import
# directly at module top, exactly like test_provider_gateway_seam.py.
from app.services.provider_gateway import (
    CallingMode,
    GatewayRequest,
    open_stream,
)


# ── Synthetic chunk factory (mirrors test_provider_gateway_seam.py) ───────────
def _mk_openai_chunk(content=None, tool_calls=None, finish_reason=None):
    """Build a synthetic openai-python ChatCompletionChunk-shaped object."""
    delta = SimpleNamespace(content=content, reasoning_content=None, tool_calls=tool_calls)
    has_choice = content is not None or finish_reason is not None or tool_calls is not None
    choices = [SimpleNamespace(delta=delta, finish_reason=finish_reason)] if has_choice else []
    return SimpleNamespace(choices=choices, usage=None)


# ── GatewayRequest forcing fields (additive — defaults preserve auto) ─────────


def test_gateway_request_forcing_fields_default_safe():
    """A default GatewayRequest carries the NEW forcing fields at their SAFE
    defaults (no forcing) — byte-identical to the pre-101.1 envelope."""
    req = GatewayRequest(messages=[], model="gpt-5.4", active_provider_name="openai")
    assert req.force_tool_name is None
    assert req.strict_schema is False
    # The pre-existing field is untouched (Deep byte-identical).
    assert req.tool_choice == "auto"


# ── D-14 — the shared-path guard (the RED LINE) ───────────────────────────────


def test_no_provider_branch_in_shared_path():
    """The forcing translation must live ONLY at the gateway adapter boundary — NO
    ``if provider ==`` forcing branch leaks into the shared chunk/SSE consumer path
    (``agent_loop``). The consumer threads forcing via ``GatewayRequest`` to
    ``open_stream``; it never branches per-provider FOR FORCING in its own body."""
    import inspect

    from app.services import agent_loop

    src = inspect.getsource(agent_loop)
    # If the consumer references the forcing field at all, it MUST be threading it
    # through the gateway (open_stream), never branching on provider for forcing.
    if "force_tool_name" in src:
        assert "open_stream" in src, (
            "forcing must be threaded via GatewayRequest to the gateway, not branched in the consumer"
        )

    # The shared chunk handler must contain NO per-provider forcing branch. The ONLY
    # per-provider branches allowed in the consumer are the pre-existing usage / think
    # ones — none of which mention the forcing field.
    for line in src.splitlines():
        if "if provider ==" in line or "active_provider_name ==" in line:
            assert "force" not in line.lower(), (
                f"forcing must not branch per-provider in the shared path: {line.strip()!r}"
            )


def test_deep_request_byte_identical():
    """A Deep (non-forced) GatewayRequest with ``tool_choice='auto'`` and no
    ``force_tool_name`` produces the IDENTICAL downstream request as before 101.1 —
    the forcing fields are absent/None so the auto path is byte-for-byte unchanged."""
    deep = GatewayRequest(
        messages=[{"role": "user", "content": "hi"}],
        model="gpt-5.4",
        active_provider_name="openai",
        tool_choice="auto",
    )
    # The Deep envelope never sets a forced tool — the auto branch is taken downstream.
    assert deep.force_tool_name is None
    assert deep.strict_schema is False
    assert deep.tool_choice == "auto"

    # Forcing provider X (anthropic) does not mutate a separate provider-Y (openai)
    # request — each GatewayRequest is self-contained.
    forced = GatewayRequest(
        messages=[],
        model="claude-opus-4-8",
        active_provider_name="anthropic",
        force_tool_name="render_template",
    )
    assert forced.force_tool_name == "render_template"
    # The Deep request is unchanged by the existence of the forced one.
    assert deep.force_tool_name is None


# ── Per-adapter translation (the §2 param shapes) ─────────────────────────────


def test_anthropic_forcing_translation_thinking_off(monkeypatch):
    """The anthropic adapter passes ``tool_choice={"type":"tool","name":...}`` to
    ``stream_anthropic`` with extended thinking OFF (TIER-FORCE-NOTHINK — forcing
    ERRORS under thinking). Unset force => :177 behavior preserved (tool_choice None)."""
    from app.services.provider_gateway import anthropic as ant_adapter

    captured: dict = {}

    def _fake_stream_anthropic(**kwargs):
        captured.update(kwargs)
        if False:
            yield {}
        return
        yield  # pragma: no cover

    monkeypatch.setattr(ant_adapter, "stream_anthropic", _fake_stream_anthropic)

    # Forced: tool_choice is the named-tool dict.
    forced = GatewayRequest(
        messages=[],
        model="claude-opus-4-8",
        active_provider_name="anthropic",
        tools=[{"function": {"name": "render_template"}}],
        force_tool_name="render_template",
    )
    list(ant_adapter.open_anthropic_stream(forced))
    assert captured["tool_choice"] == {"type": "tool", "name": "render_template"}
    # No thinking is ever enabled by the adapter (TIER-FORCE-NOTHINK).
    assert "thinking" not in captured
    assert "budget_tokens" not in captured

    # Unforced: the adapter passes tool_choice=None so anthropic_service keeps :177.
    captured.clear()
    unforced = GatewayRequest(
        messages=[],
        model="claude-opus-4-8",
        active_provider_name="anthropic",
        tools=[{"function": {"name": "render_template"}}],
    )
    list(ant_adapter.open_anthropic_stream(unforced))
    assert captured.get("tool_choice") is None


def test_anthropic_service_tool_choice_param_additive():
    """``stream_anthropic`` gained EXACTLY one new param (``tool_choice``); the
    default preserves the :177 force_no_tools/auto behavior (G-5 additive seam)."""
    import inspect

    from app.services.anthropic_service import stream_anthropic

    sig = inspect.signature(stream_anthropic)
    assert "tool_choice" in sig.parameters
    # Default None → the :177 force_no_tools/auto resolution runs unchanged.
    assert sig.parameters["tool_choice"].default is None


def test_google_forcing_translation_mode_any(monkeypatch):
    """The google adapter injects ``tool_config(function_calling_config(mode='ANY',
    allowed_function_names=[...]))`` into ``config_kwargs`` (forces a function call)."""
    from app.services.provider_gateway import google as g_adapter

    captured: dict = {}

    def _fake_stream_google(**kwargs):
        captured.update(kwargs)
        return
        yield  # pragma: no cover

    monkeypatch.setattr(g_adapter, "stream_google", _fake_stream_google)

    forced = GatewayRequest(
        messages=[],
        model="gemini-3-pro",
        active_provider_name="google",
        tools=[{"function": {"name": "render_template"}}],
        force_tool_name="render_template",
    )
    list(g_adapter.open_google_stream(forced))

    tc = captured.get("tool_config")
    assert tc is not None, "forcing must inject a tool_config"
    fcc = tc.function_calling_config
    assert str(getattr(fcc.mode, "name", fcc.mode)).upper().endswith("ANY") or "ANY" in str(fcc.mode).upper()
    assert list(fcc.allowed_function_names) == ["render_template"]

    # Unforced: no tool_config injected (auto path byte-identical).
    captured.clear()
    unforced = GatewayRequest(
        messages=[],
        model="gemini-3-pro",
        active_provider_name="google",
        tools=[{"function": {"name": "render_template"}}],
    )
    list(g_adapter.open_google_stream(unforced))
    assert captured.get("tool_config") is None


def test_openai_compat_forcing_translation(monkeypatch):
    """The openai_compat adapter translates a forced GatewayRequest into the OpenAI
    ``tool_choice={"type":"function","function":{"name":...}}`` shape (+ a strict
    ``response_format`` when ``strict_schema``) — self-contained, beside the existing
    ``"auto"`` path. Unforced => the auto path is byte-identical."""
    from app.services.provider_gateway import openai_compat as oc_adapter

    captured: dict = {}

    def _fake_create(**kwargs):
        captured.update(kwargs)
        return iter([]), CallingMode.NATIVE

    monkeypatch.setattr(oc_adapter, "create_adaptive_streaming_chat", _fake_create)

    forced = GatewayRequest(
        messages=[],
        model="gpt-5.4",
        active_provider_name="openai",
        tools=[{"function": {"name": "render_template"}}],
        force_tool_name="render_template",
        strict_schema=True,
    )
    oc_adapter.open_openai_compat_stream(forced)
    assert captured.get("force_tool_name") == "render_template"
    assert captured.get("strict_response_format") is True

    # Unforced: the adapter passes the auto-path defaults (no forcing kwargs set).
    captured.clear()
    unforced = GatewayRequest(
        messages=[],
        model="gpt-5.4",
        active_provider_name="openai",
        tools=[{"function": {"name": "render_template"}}],
    )
    oc_adapter.open_openai_compat_stream(unforced)
    assert captured.get("force_tool_name") is None
    assert not captured.get("strict_response_format")


def test_openai_compat_forced_tool_choice_kwargs():
    """The OpenAI request construction translates ``force_tool_name`` into the named
    ``tool_choice`` dict + a strict ``response_format`` (D-05 / strict_json_schema)."""
    from app.services.openai_service import create_adaptive_streaming_chat

    import inspect

    sig = inspect.signature(create_adaptive_streaming_chat)
    # The forcing kwargs are additive on the OpenAI-compat stream constructor.
    assert "force_tool_name" in sig.parameters
    assert "strict_response_format" in sig.parameters
    assert sig.parameters["force_tool_name"].default is None
    assert sig.parameters["strict_response_format"].default is False


# ── Phase 101.1-07 (gap 1a / D-15 / TIER-FORCE-NOTHINK) — DeepSeek forced emit ─
# disables the thinking block (a named tool_choice WITH thinking ON 400s on
# DeepSeek v4: "Thinking mode does not support this tool_choice", UAT runs
# 575e7345/a7f415ad). The forced branch is provider-scoped; the auto path
# (force_tool_name None) keeps thinking ON byte-identical.


def _capture_openai_kwargs(monkeypatch, **call_kwargs):
    """Drive create_adaptive_streaming_chat with a captured fake client; return the
    kwargs dict the OpenAI request construction built (never makes a network call)."""
    from app.services import openai_service as oai

    captured: dict = {}

    class _FakeCompletions:
        def create(self, **kwargs):
            captured.update(kwargs)
            return iter([])

    class _FakeChat:
        completions = _FakeCompletions()

    class _FakeClient:
        chat = _FakeChat()

    monkeypatch.setattr(oai, "get_llm_client", lambda user_settings=None: _FakeClient())
    oai.create_adaptive_streaming_chat(**call_kwargs)
    return captured


def test_deepseek_forced_emit_disables_thinking(monkeypatch):
    """A DeepSeek forced emit (force_tool_name set) builds kwargs WITHOUT
    extra_body.thinking (thinking OFF) AND with the named tool_choice — so DeepSeek
    v4 no longer 400s on 'Thinking mode does not support this tool_choice' (gap 1a)."""
    us = SimpleNamespace(active_provider="deepseek", llm_model="deepseek-v4", openrouter_tool_strategy="quality")
    kwargs = _capture_openai_kwargs(
        monkeypatch,
        messages=[{"role": "user", "content": "fill"}],
        model="deepseek-v4",
        user_settings=us,
        tools_override=[{"function": {"name": "render_template", "parameters": {}}}],
        force_tool_name="render_template",
    )
    # Thinking is NOT enabled on the forced DeepSeek path.
    assert kwargs.get("extra_body", {}).get("thinking") is None
    # The named tool_choice IS sent.
    assert kwargs["tool_choice"]["function"]["name"] == "render_template"


def test_deepseek_non_forced_keeps_thinking(monkeypatch):
    """A DeepSeek call with force_tool_name=None (the Deep / non-forced path) STILL
    enables thinking — byte-identical to the pre-101.1-07 behavior."""
    us = SimpleNamespace(active_provider="deepseek", llm_model="deepseek-v4", openrouter_tool_strategy="quality")
    kwargs = _capture_openai_kwargs(
        monkeypatch,
        messages=[{"role": "user", "content": "hi"}],
        model="deepseek-v4",
        user_settings=us,
        # tools_override avoids get_tools(user_settings) on the auto path (the minimal
        # SimpleNamespace settings has no web_search_enabled attr) — the thinking-block
        # gate under test runs BEFORE the tool branch.
        tools_override=[{"function": {"name": "search_documents", "parameters": {}}}],
        tool_choice="auto",
    )
    assert kwargs["extra_body"]["thinking"]["type"] == "enabled"


def test_non_deepseek_forced_unaffected(monkeypatch):
    """A non-DeepSeek forced call is unaffected — no extra_body.thinking key appears
    just because forcing is on (the gate is DeepSeek-specific)."""
    us = SimpleNamespace(active_provider="openai", llm_model="gpt-5.4", openrouter_tool_strategy="quality")
    kwargs = _capture_openai_kwargs(
        monkeypatch,
        messages=[{"role": "user", "content": "fill"}],
        model="gpt-5.4",
        user_settings=us,
        tools_override=[{"function": {"name": "render_template", "parameters": {}}}],
        force_tool_name="render_template",
    )
    assert kwargs.get("extra_body", {}).get("thinking") is None
    assert kwargs["tool_choice"]["function"]["name"] == "render_template"


# ── Tier resolution — default SAFE on a registry miss ─────────────────────────


def test_force_default_safe_on_registry_miss():
    """A model id absent from MODEL_CAPABILITIES resolves ``forced_emission`` False
    (TIER-COERCE / SAFE) — a case-sensitivity registry miss NEVER wrongly forces."""
    from app.config import get_model_capability

    # A clearly-absent / mis-cased id falls to inferred defaults, which do NOT set
    # forced_emission → .get(..., False) is the SAFE coerce default.
    cap = get_model_capability("totally-made-up-model-xyz")
    assert cap.get("forced_emission", False) is False


# ── Phase 122 (MP-02 / D-122-04) — the provider-name gate is REMOVED ──────────
# The forcing branch (openai_service.py:1534-1581) used to (a) set a function-level
# ``strict`` flag (INERT for DeepSeek) and (b) gate the json_schema response_format
# behind ``and provider == "openai"`` — a name check. Post-122 the gate is
# TIER-DRIVEN: ``strict_response_format`` is set by the caller ONLY for
# emit_tier=="force_strict" shots (OpenAI-only by MEASUREMENT, not name), so the
# json_schema response_format is built whenever ``strict_response_format`` is true,
# with no provider-name special-case.


def test_no_provider_gate(monkeypatch):
    """A force_strict-tier shot whose provider-NAME context is NOT 'openai' still
    requests the json_schema response_format — the gate is tier-driven (the caller
    set strict_response_format=True), not name-driven. This proves the
    ``and provider == "openai"`` check is gone (the load-bearing MP-02 removal)."""
    # active_provider deliberately NOT "openai" — pre-122 this would have suppressed
    # the response_format entirely. Post-122 strict_response_format alone drives it.
    us = SimpleNamespace(active_provider="not-openai", llm_model="some-strict-model", openrouter_tool_strategy="quality")
    kwargs = _capture_openai_kwargs(
        monkeypatch,
        messages=[{"role": "user", "content": "fill"}],
        model="some-strict-model",
        user_settings=us,
        tools_override=[{"function": {"name": "render_template", "parameters": {"type": "object", "properties": {}}}}],
        force_tool_name="render_template",
        strict_response_format=True,
    )
    rf = kwargs.get("response_format")
    assert rf is not None, "json_schema response_format must be built regardless of provider name"
    assert rf["type"] == "json_schema"
    assert rf["json_schema"]["name"] == "render_template"
    assert rf["json_schema"]["strict"] is True
    # The named tool_choice is still sent (forcing works regardless).
    assert kwargs["tool_choice"]["function"]["name"] == "render_template"


def test_deepseek_force(monkeypatch):
    """A deepseek force-tier shot (force_tool_name set, strict_response_format NOT set
    — emit_tier=force never requests strict) carries NO function-level ``strict`` flag
    on the forced tool def AND no json_schema response_format. The inert DeepSeek
    strict block is removed (Pitfall 3)."""
    from app.config import MODEL_CAPABILITIES

    # The registry rows for deepseek must be emit_tier=force (substrate from Task 1).
    assert MODEL_CAPABILITIES["deepseek-v4-pro"]["emit_tier"] == "force"
    assert MODEL_CAPABILITIES["deepseek-v4-flash"]["emit_tier"] == "force"

    us = SimpleNamespace(active_provider="deepseek", llm_model="deepseek-v4-pro", openrouter_tool_strategy="quality")
    forced_tool = {"function": {"name": "render_template", "parameters": {"type": "object", "properties": {}}}}
    kwargs = _capture_openai_kwargs(
        monkeypatch,
        messages=[{"role": "user", "content": "fill"}],
        model="deepseek-v4-pro",
        user_settings=us,
        tools_override=[forced_tool],
        force_tool_name="render_template",
        # emit_tier=force => the caller does NOT set strict_response_format.
        strict_response_format=False,
    )
    # No json_schema response_format on a force-tier (non-strict) shot.
    assert kwargs.get("response_format") is None
    # No function-level "strict" flag on the forced tool def (the inert block is gone).
    sent_tools = kwargs.get("tools") or []
    for _t in sent_tools:
        _fn = _t.get("function") if isinstance(_t, dict) else None
        if _fn and _fn.get("name") == "render_template":
            assert "strict" not in _fn, "force-tier deepseek must NOT carry a function-level strict flag"
    # Forcing still happens.
    assert kwargs["tool_choice"]["function"]["name"] == "render_template"


def test_openai_force_strict_preserved(monkeypatch):
    """A4 (load-bearing): an OpenAI force_strict shot STILL requests the json_schema
    response_format after removing the function-level strict block. OpenAI's guarantee
    comes from the response_format json_schema, NOT the (now-removed) function flag —
    so removing the function-level strict loop does NOT weaken OpenAI."""
    us = SimpleNamespace(active_provider="openai", llm_model="gpt-5.4", openrouter_tool_strategy="quality")
    kwargs = _capture_openai_kwargs(
        monkeypatch,
        messages=[{"role": "user", "content": "fill"}],
        model="gpt-5.4",
        user_settings=us,
        tools_override=[{"function": {"name": "render_template", "parameters": {"type": "object", "properties": {}}}}],
        force_tool_name="render_template",
        strict_response_format=True,
    )
    rf = kwargs.get("response_format")
    assert rf is not None, "A4 — OpenAI force_strict must still emit the json_schema response_format"
    assert rf["type"] == "json_schema"
    assert rf["json_schema"]["strict"] is True
    assert rf["json_schema"]["name"] == "render_template"
