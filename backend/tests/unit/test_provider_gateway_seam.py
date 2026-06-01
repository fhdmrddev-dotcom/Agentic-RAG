"""D-08 seam-contract test scaffold (Phase 092.5, GATEWAY-01).

The deterministic "synthetic-stream-in -> canonical-events-out" contract test
the harness (Phase 093) builds on. Feeds each adapter a synthetic provider SDK
chunk stream and asserts the YIELDED canonical ``GatewayEvent`` sequence (event
types + key fields) matches the expected list — NO live keys, fully
deterministic, runs in CI.

Wave-0 authoring strategy (RED scaffold that COLLECTS green NOW):

  - ``events.py`` + ``dispatcher.py`` ALREADY exist (Tasks 1-2 this plan), so
    the SHAPE tests against ``GatewayEvent`` / ``open_stream`` / ``CallingMode``
    import directly and PASS today.
  - The per-adapter tests are gated by
    ``pytest.importorskip("app.services.provider_gateway.<adapter>", ...)`` —
    the adapter modules do NOT exist until Wave 2 (anthropic/google) / Wave 4
    (openai_compat), so those tests SKIP today and go RED->GREEN as each adapter
    lands. ``pytest --collect-only`` does NOT error, and
    ``pytest <thisfile> -x -q`` exits 0 today.

The EXPECTED canonical-event sequences below ARE the contract: when an adapter
lands, its test stops skipping and must yield exactly these events (the I4
``<think>``-routing, I2 ``thought_signature``, calling_mode-surfacing invariants
named in D-07 / VALIDATION).
"""
from __future__ import annotations

from types import SimpleNamespace

import pytest

# events.py + dispatcher.py exist NOW (Tasks 1-2) — import directly, no skip.
from app.services.provider_gateway import (
    CallingMode,
    GatewayRequest,
    open_stream,
)
from app.services.provider_gateway.events import (
    DeltaEvent,
    FinishEvent,
    GatewayEvent,
    ReasoningDeltaEvent,
    ToolArgsProgressEvent,
    ToolStartEvent,
)


# ── Synthetic chunk factory (copied/adapted from
#    test_chunk_handler_provider_aware.py:63-95) ──────────────────────────────
def _mk_openai_chunk(
    content: str | None = None,
    reasoning_content: str | None = None,
    prompt_tokens: int | None = None,
    completion_tokens: int | None = None,
    finish_reason: str | None = None,
    tool_calls=None,
    has_choice: bool | None = None,
):
    """Build a synthetic openai-python ChatCompletionChunk-shaped object.

    Mirrors the project-canonical SimpleNamespace mock idiom. ``reasoning_content``
    populates the DeepSeek separate-field path; ``content`` carries text (incl.
    ``<think>``-tagged content for the Kimi/MiniMax/GLM state-machine path).
    """
    delta = SimpleNamespace(
        content=content,
        reasoning_content=reasoning_content,
        tool_calls=tool_calls,
    )
    if has_choice is None:
        has_choice = (
            content is not None
            or reasoning_content is not None
            or finish_reason is not None
            or tool_calls is not None
        )
    choices = (
        [SimpleNamespace(delta=delta, finish_reason=finish_reason)] if has_choice else []
    )
    if prompt_tokens is None and completion_tokens is None:
        usage = None
    else:
        usage = SimpleNamespace(
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
        )
    return SimpleNamespace(choices=choices, usage=usage)


def _mk_request(provider: str) -> GatewayRequest:
    """Minimal deterministic request envelope for the seam tests (no live keys)."""
    return GatewayRequest(
        messages=[{"role": "user", "content": "hi"}],
        model="seam-test-model",
        active_provider_name=provider,
        tools=[],
        system_prompt="",
        api_key="test-key",
    )


async def _collect(stream) -> list[GatewayEvent]:
    """Drain an adapter's async event stream into a list (the seam assertion).

    Used by the Wave-4 openai_compat tests (async-iterable adapter)."""
    events: list[GatewayEvent] = []
    async for ev in stream:
        events.append(ev)
    return events


def _collect_sync(stream) -> list[GatewayEvent]:
    """Drain a SYNC event stream into a list.

    The Anthropic/Google adapters return the bare ``stream_*`` SYNC generator
    VERBATIM (the consumer's ``_drain_stream_with_close_on_cancel`` drives it
    with ``for chunk in stream:`` in a threadpool and closes it via
    ``stream.close`` on timeout — the byte-identical RED LINE). The seam test
    mirrors that sync drive."""
    return list(stream)


# ════════════════════════════════════════════════════════════════════════════
# Shape tests — events.py + dispatcher.py exist NOW; these PASS today.
# ════════════════════════════════════════════════════════════════════════════


def test_canonical_event_schema_is_lossless_superset():
    """events.py carries the 3 fields the docstring schema omits but the
    consumer consumes (code_so_far / thought_signature / reasoning_delta)."""
    assert "code_so_far" in ToolArgsProgressEvent.__annotations__
    assert "thought_signature" in ToolStartEvent.__annotations__
    # reasoning_delta is a first-class event type, not just a field.
    assert ReasoningDeltaEvent.__annotations__["type"] is not None
    # finish carries tool_calls (each may carry thought_signature for round-trip).
    assert "tool_calls" in FinishEvent.__annotations__
    assert "content" in DeltaEvent.__annotations__
    # GatewayEvent is the union the consumer switches on.
    assert GatewayEvent is not None


def test_calling_mode_is_reexported_not_redefined():
    """Pitfall 3: CallingMode is the EXISTING openai_service enum, re-exported —
    NATIVE / STRUCTURED members present (dropping/redefining it makes the harness
    OpenAI-only)."""
    from app.services.openai_service import CallingMode as _SourceCallingMode

    assert CallingMode is _SourceCallingMode
    assert CallingMode.NATIVE.value == "native"
    assert CallingMode.STRUCTURED.value == "structured"


async def test_open_stream_openai_compat_still_unimplemented():
    """092.5 Wave 2: anthropic + google adapters are LIVE (see the per-adapter
    tests below); the openai-compat ``else`` branch (OpenAI / OpenRouter / Ollama
    / native-7 fallbacks) STILL raises NotImplementedError until Wave 4 lands it.
    This pins the routing SHAPE the seam depends on — and proves Wave 2 did NOT
    touch the OpenAI branch."""
    for provider in ("openai", "openrouter"):
        with pytest.raises(NotImplementedError):
            await open_stream(provider, _mk_request(provider))


# ════════════════════════════════════════════════════════════════════════════
# Anthropic adapter contract — LIVE (provider_gateway/anthropic landed Wave 2)
#
# The adapter returns the bare ``stream_anthropic`` SYNC generator VERBATIM, so
# the fakes here are SYNC generators (matching the real
# ``stream_anthropic: Generator[dict, None, None]``) and the assertion sync-drives
# the returned stream — exactly how the consumer's drain does.
# ════════════════════════════════════════════════════════════════════════════


async def test_anthropic_adapter_yields_canonical_events(monkeypatch):
    """Anthropic adapter wraps stream_anthropic (already canonical) and yields the
    delta -> tool_start -> finish -> usage sequence VERBATIM (no re-shaping)."""
    import app.services.provider_gateway.anthropic as _anthropic

    def _fake_stream_anthropic(**kwargs):
        yield {"type": "delta", "content": "Hello"}
        yield {"type": "tool_start", "id": "t1", "name": "search_documents", "args": {"q": "x"}}
        yield {"type": "finish", "finish_reason": "tool_calls", "tool_calls": [{"id": "t1"}]}
        yield {"type": "usage", "input_tokens": 10, "output_tokens": 5}

    monkeypatch.setattr(_anthropic, "stream_anthropic", _fake_stream_anthropic, raising=False)
    stream, calling_mode = await open_stream("anthropic", _mk_request("anthropic"))
    events = _collect_sync(stream)
    types = [e["type"] for e in events]
    assert types == ["delta", "tool_start", "finish", "usage"]
    assert calling_mode == CallingMode.NATIVE


# ════════════════════════════════════════════════════════════════════════════
# Google adapter contract — LIVE (provider_gateway/google landed Wave 2)
# ════════════════════════════════════════════════════════════════════════════


async def test_google_adapter_yields_canonical_events_with_thought_signature(monkeypatch):
    """I2 / D-07: the Google adapter carries the base64 thought_signature on
    finish.tool_calls[] so the consumer can hydrate it (else Gemini-3 400s round 2)."""
    import app.services.provider_gateway.google as _google

    def _fake_stream_google(**kwargs):
        yield {"type": "delta", "content": "thinking..."}
        yield {
            "type": "finish",
            "finish_reason": "tool_calls",
            "tool_calls": [{"id": "g1", "thought_signature": "BASE64SIG=="}],
        }

    monkeypatch.setattr(_google, "stream_google", _fake_stream_google, raising=False)
    stream, calling_mode = await open_stream("google", _mk_request("google"))
    events = _collect_sync(stream)
    finish = next(e for e in events if e["type"] == "finish")
    assert finish["tool_calls"][0]["thought_signature"] == "BASE64SIG=="
    assert calling_mode == CallingMode.NATIVE


# ════════════════════════════════════════════════════════════════════════════
# OpenAI-compat adapter contract — SKIPS until Wave 4 lands
# provider_gateway/openai_compat
# ════════════════════════════════════════════════════════════════════════════


def _require_openai_compat():
    return pytest.importorskip(
        "app.services.provider_gateway.openai_compat",
        reason="openai_compat adapter lands in Wave 4",
    )


async def test_openai_adapter_yields_delta_and_tool_preparing(monkeypatch):
    """The OpenAI adapter emits canonical delta + tool_preparing events (it builds
    tool_calls_buffer from native delta.tool_calls inline today; post-extraction it
    EMITS the events the other two adapters already emit)."""
    _openai_compat = _require_openai_compat()

    def _fake_create(**kwargs):
        async def _gen():
            yield _mk_openai_chunk(content="Hi")
            tc = [SimpleNamespace(index=0, id="o1", function=SimpleNamespace(name="execute_code", arguments="{"))]
            yield _mk_openai_chunk(tool_calls=tc)
        return _gen(), CallingMode.NATIVE

    monkeypatch.setattr(_openai_compat, "create_adaptive_streaming_chat", _fake_create, raising=False)
    stream, calling_mode = await open_stream("openai", _mk_request("openai"))
    events = await _collect(stream)
    types = [e["type"] for e in events]
    assert "delta" in types
    assert "tool_preparing" in types
    assert calling_mode == CallingMode.NATIVE


async def test_openai_adapter_think_tag_routes_to_reasoning_delta(monkeypatch):
    """I4: a Kimi/MiniMax/GLM <think>...</think>visible stream routes the think
    content to reasoning_delta and the rest to delta — NO <think> leak into delta."""
    _openai_compat = _require_openai_compat()

    def _fake_create(**kwargs):
        async def _gen():
            yield _mk_openai_chunk(content="<think>reasoning</think>visible")
        return _gen(), CallingMode.NATIVE

    monkeypatch.setattr(_openai_compat, "create_adaptive_streaming_chat", _fake_create, raising=False)
    # active_provider_name must be one of moonshot/deepseek/minimax/zhipu to trigger
    # the <think> state machine.
    req = _mk_request("moonshot")
    stream, _ = await open_stream("moonshot", req)
    events = await _collect(stream)
    reasoning = [e for e in events if e["type"] == "reasoning_delta"]
    deltas = [e for e in events if e["type"] == "delta"]
    assert any("reasoning" in e["content"] for e in reasoning)
    assert all("<think>" not in e["content"] for e in deltas)
    assert any(e["content"] == "visible" for e in deltas)


async def test_openai_adapter_surfaces_calling_mode(monkeypatch):
    """Pitfall 3: open_stream returns a 2-tuple whose [1] is a CallingMode member —
    surfaced from create_adaptive_streaming_chat, NEVER buried."""
    _openai_compat = _require_openai_compat()

    def _fake_create(**kwargs):
        async def _gen():
            yield _mk_openai_chunk(content="text-as-tool")
        return _gen(), CallingMode.STRUCTURED

    monkeypatch.setattr(_openai_compat, "create_adaptive_streaming_chat", _fake_create, raising=False)
    result = await open_stream("deepseek", _mk_request("deepseek"))
    assert isinstance(result, tuple)
    assert len(result) == 2
    assert isinstance(result[1], CallingMode)
    assert result[1] == CallingMode.STRUCTURED


async def test_openai_adapter_usage_via_accumulate_chunk_usage(monkeypatch):
    """I8: usage accounting rides _accumulate_chunk_usage (Google cumulative-overwrite
    vs OpenAI +=); the adapter emits canonical usage events the consumer accumulates."""
    _openai_compat = _require_openai_compat()

    def _fake_create(**kwargs):
        async def _gen():
            yield _mk_openai_chunk(content="hi")
            yield _mk_openai_chunk(prompt_tokens=12, completion_tokens=3, has_choice=False)
        return _gen(), CallingMode.NATIVE

    monkeypatch.setattr(_openai_compat, "create_adaptive_streaming_chat", _fake_create, raising=False)
    stream, _ = await open_stream("openai", _mk_request("openai"))
    events = await _collect(stream)
    usage = [e for e in events if e["type"] in ("usage", "usage_delta")]
    assert usage, "OpenAI adapter must emit a usage/usage_delta event"
