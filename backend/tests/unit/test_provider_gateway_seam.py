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


def _collect_sync(stream) -> list[GatewayEvent]:
    """Drain a SYNC event stream into a list.

    ALL THREE adapters return a SYNC stream the consumer's
    ``_drain_stream_with_close_on_cancel`` drives with ``for chunk in stream:``
    in a threadpool + closes via ``stream.close`` on timeout (the byte-identical
    RED LINE):
      - Anthropic/Google return the bare ``stream_*`` SYNC generator VERBATIM.
      - the OpenAI-compat adapter returns a SYNC ``_ClosableEventStream`` wrapping
        the raw ``create_adaptive_streaming_chat`` ``Stream`` (Plan 03 settled the
        boundary is sync — an async re-wrap would change the cascade-surface drain
        machinery; the Wave-0 async-generator fakes were a scaffold assumption).
    The seam test mirrors that sync drive."""
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


async def test_open_stream_openai_compat_routes_to_adapter(monkeypatch):
    """092.5 Wave 4: the openai-compat ``else`` branch (OpenAI / OpenRouter /
    Ollama / native-7 fallbacks) is now LIVE — it no longer raises
    NotImplementedError. It returns a (stream, CallingMode) 2-tuple (Pitfall 3 —
    calling_mode rides alongside the stream). Pins the routing SHAPE the seam
    depends on."""
    import app.services.provider_gateway.openai_compat as _openai_compat

    def _fake_create(**kwargs):
        return [_mk_openai_chunk(content="ok")], CallingMode.NATIVE

    monkeypatch.setattr(
        _openai_compat, "create_adaptive_streaming_chat", _fake_create, raising=False
    )
    for provider in ("openai", "openrouter"):
        result = await open_stream(provider, _mk_request(provider))
        assert isinstance(result, tuple) and len(result) == 2
        assert isinstance(result[1], CallingMode)


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
    FULL canonical vocabulary VERBATIM (no re-shaping).

    Plan 04 directive (strengthened from the 2-4-event subset): assert the full
    canonical event sequence — usage -> tool_preparing -> tool_args_progress
    (incl. code_so_far) -> tool_start -> usage_delta -> finish — AND the key fields
    on each (tool name/id/args, content, finish_reason, token counts). This closes
    the seam-contract under-specification Phase 093 consumes."""
    import app.services.provider_gateway.anthropic as _anthropic

    def _fake_stream_anthropic(**kwargs):
        yield {"type": "usage", "input_tokens": 10, "output_tokens": 0}
        yield {"type": "delta", "content": "Hello"}
        yield {"type": "tool_preparing", "id": "t1", "name": "search_documents", "index": 0}
        yield {
            "type": "tool_args_progress",
            "tool_index": 0,
            "name": "search_documents",
            "args_so_far": '{"q": "x"}',
            "total_args_bytes_so_far": 10,
            "code_so_far": '{"q": "x"}',
        }
        yield {"type": "tool_start", "id": "t1", "name": "search_documents", "args": {"q": "x"}}
        yield {"type": "usage_delta", "output_tokens": 5}
        yield {"type": "finish", "finish_reason": "tool_calls", "tool_calls": [{"id": "t1"}]}

    monkeypatch.setattr(_anthropic, "stream_anthropic", _fake_stream_anthropic, raising=False)
    stream, calling_mode = await open_stream("anthropic", _mk_request("anthropic"))
    events = _collect_sync(stream)
    types = [e["type"] for e in events]
    # FULL canonical vocabulary + event-TYPE ORDER (not a subset).
    assert types == [
        "usage",
        "delta",
        "tool_preparing",
        "tool_args_progress",
        "tool_start",
        "usage_delta",
        "finish",
    ]
    # Key fields per event (the contract 093 builds on).
    _by_type = {e["type"]: e for e in events}
    assert _by_type["usage"]["input_tokens"] == 10
    assert _by_type["delta"]["content"] == "Hello"
    assert _by_type["tool_preparing"]["name"] == "search_documents"
    assert _by_type["tool_preparing"]["index"] == 0
    assert _by_type["tool_args_progress"]["code_so_far"] == '{"q": "x"}'
    assert _by_type["tool_args_progress"]["tool_index"] == 0
    assert _by_type["tool_start"]["id"] == "t1"
    assert _by_type["tool_start"]["args"] == {"q": "x"}
    assert _by_type["usage_delta"]["output_tokens"] == 5
    assert _by_type["finish"]["finish_reason"] == "tool_calls"
    assert calling_mode == CallingMode.NATIVE


# ════════════════════════════════════════════════════════════════════════════
# Anthropic assistant-prefill strip (BUG-260701-01 / D-14) — Phase 137.1-06
# ════════════════════════════════════════════════════════════════════════════


async def test_anthropic_adapter_strips_prefill_for_unsupported_model(monkeypatch):
    """BUG-260701-01 / D-14: the Anthropic adapter strips a TRAILING assistant prefill
    for prefill-UNSUPPORTED Claude models (4.6+/5) so the eval WITHOUT-skill arm + Deep
    chat stop 400ing (``This model does not support assistant message prefill``) — while
    leaving messages BYTE-IDENTICAL for prefill-supporting models (Deep-mode-unchanged)."""
    import dataclasses
    import app.services.provider_gateway.anthropic as _anthropic

    captured: dict = {}

    def _fake_stream_anthropic(**kwargs):
        captured["messages"] = kwargs.get("messages")
        yield {"type": "finish", "finish_reason": "stop", "tool_calls": []}

    monkeypatch.setattr(_anthropic, "stream_anthropic", _fake_stream_anthropic, raising=False)

    prefill_msgs = [
        {"role": "user", "content": "Summarize the doc."},
        {"role": "assistant", "content": "Here is the summary:"},  # the prefill that 400s
    ]

    # UNSUPPORTED (claude-sonnet-5): the trailing assistant prefill is stripped.
    req_unsup = dataclasses.replace(
        _mk_request("anthropic"), model="claude-sonnet-5", messages=list(prefill_msgs)
    )
    stream, _ = await open_stream("anthropic", req_unsup)
    _collect_sync(stream)
    assert captured["messages"] == [{"role": "user", "content": "Summarize the doc."}]

    # SUPPORTED (claude-haiku-4-5): messages pass through BYTE-IDENTICAL (D-14 red line —
    # a prefill-tolerating model's request shape is never altered).
    req_sup = dataclasses.replace(
        _mk_request("anthropic"), model="claude-haiku-4-5-20251001", messages=list(prefill_msgs)
    )
    stream2, _ = await open_stream("anthropic", req_sup)
    _collect_sync(stream2)
    assert captured["messages"] == prefill_msgs


def test_strip_prefill_helper_edge_cases():
    """Direct unit coverage of the strip helper's branches (fast, no async)."""
    from app.services.provider_gateway.anthropic import (
        _strip_unsupported_assistant_prefill as strip,
    )

    trailing_assistant = [
        {"role": "user", "content": "a"},
        {"role": "assistant", "content": "b"},
    ]
    # Unsupported model + trailing assistant => stripped to the user turn.
    assert strip(list(trailing_assistant), "claude-opus-4-8") == [{"role": "user", "content": "a"}]
    # Supported model + trailing assistant => unchanged (byte-identical).
    assert strip(list(trailing_assistant), "claude-haiku-4-5-20251001") == trailing_assistant
    # Unknown / other-provider model (absent flag => True) => unchanged.
    assert strip(list(trailing_assistant), "gpt-5.5") == trailing_assistant
    # Unsupported model + trailing USER (no prefill) => unchanged.
    user_only = [{"role": "user", "content": "a"}]
    assert strip(list(user_only), "claude-opus-4-8") == user_only
    # Single assistant-only message (edge) => NOT stripped (len<=1 guard avoids empty msgs).
    assistant_only = [{"role": "assistant", "content": "b"}]
    assert strip(list(assistant_only), "claude-opus-4-8") == assistant_only


# ════════════════════════════════════════════════════════════════════════════
# Google adapter contract — LIVE (provider_gateway/google landed Wave 2)
# ════════════════════════════════════════════════════════════════════════════


async def test_google_adapter_yields_canonical_events_with_thought_signature(monkeypatch):
    """I2 / D-07: the Google adapter carries the base64 thought_signature on
    finish.tool_calls[] so the consumer can hydrate it (else Gemini-3 400s round 2).

    Plan 04 directive (strengthened from the finish-only fish-out): assert the FULL
    canonical event sequence AND event-TYPE ORDER (usage -> delta ->
    tool_preparing -> tool_args_progress incl. code_so_far -> tool_start ->
    usage_delta -> finish), plus the I2 thought_signature on finish.tool_calls[]."""
    import app.services.provider_gateway.google as _google

    def _fake_stream_google(**kwargs):
        yield {"type": "usage", "input_tokens": 12, "output_tokens": 0}
        yield {"type": "delta", "content": "thinking..."}
        yield {"type": "tool_preparing", "id": "g1", "name": "execute_code", "index": 0}
        yield {
            "type": "tool_args_progress",
            "tool_index": 0,
            "name": "execute_code",
            "args_so_far": '{"code": "1+1"}',
            "total_args_bytes_so_far": 15,
            "code_so_far": '{"code": "1+1"}',
        }
        yield {
            "type": "tool_start",
            "id": "g1",
            "name": "execute_code",
            "args": {"code": "1+1"},
            "thought_signature": "BASE64SIG==",
        }
        yield {"type": "usage_delta", "output_tokens": 7}
        yield {
            "type": "finish",
            "finish_reason": "tool_calls",
            "tool_calls": [{"id": "g1", "thought_signature": "BASE64SIG=="}],
        }

    monkeypatch.setattr(_google, "stream_google", _fake_stream_google, raising=False)
    stream, calling_mode = await open_stream("google", _mk_request("google"))
    events = _collect_sync(stream)
    types = [e["type"] for e in events]
    # FULL canonical vocabulary + event-TYPE ORDER (was: only fished out finish).
    assert types == [
        "usage",
        "delta",
        "tool_preparing",
        "tool_args_progress",
        "tool_start",
        "usage_delta",
        "finish",
    ]
    _by_type = {e["type"]: e for e in events}
    assert _by_type["usage"]["input_tokens"] == 12
    assert _by_type["delta"]["content"] == "thinking..."
    assert _by_type["tool_preparing"]["name"] == "execute_code"
    assert _by_type["tool_args_progress"]["code_so_far"] == '{"code": "1+1"}'
    assert _by_type["usage_delta"]["output_tokens"] == 7
    # I2 / D-07: the base64 sig rides finish.tool_calls[] (consumer hydrates it).
    finish = _by_type["finish"]
    assert finish["finish_reason"] == "tool_calls"
    assert finish["tool_calls"][0]["thought_signature"] == "BASE64SIG=="
    assert calling_mode == CallingMode.NATIVE


# ════════════════════════════════════════════════════════════════════════════
# OpenAI-compat adapter contract — LIVE (provider_gateway/openai_compat landed
# Wave 4, D-04 — the entangled unit).
#
# The adapter returns a SYNC ``_ClosableEventStream`` wrapping the raw
# ``create_adaptive_streaming_chat`` ``Stream`` (Plan 03 settled the boundary is
# sync — the consumer's threadpool drain + ``close_fn=stream.close`` stay
# byte-identical; the Wave-0 async-generator fakes were a scaffold assumption). So
# the fakes feed SYNC raw-chunk iterables and the assertions sync-drive via
# ``_collect_sync``.
# ════════════════════════════════════════════════════════════════════════════


def _require_openai_compat():
    return pytest.importorskip(
        "app.services.provider_gateway.openai_compat",
        reason="openai_compat adapter lands in Wave 4",
    )


def _mk_tc(index, tool_id, name, arguments):
    """A synthetic openai-python streaming delta.tool_calls[] entry."""
    return SimpleNamespace(
        index=index,
        id=tool_id,
        function=SimpleNamespace(name=name, arguments=arguments),
    )


async def test_openai_adapter_yields_delta_and_tool_preparing(monkeypatch):
    """The OpenAI adapter EMITS canonical delta + tool_preparing events (it builds
    the cumulative args internally + EMITS the canonical events the other two
    adapters already emit)."""
    _openai_compat = _require_openai_compat()

    def _fake_create(**kwargs):
        chunks = [
            _mk_openai_chunk(content="Hi"),
            _mk_openai_chunk(tool_calls=[_mk_tc(0, "o1", "execute_code", "{")]),
        ]
        return chunks, CallingMode.NATIVE

    monkeypatch.setattr(_openai_compat, "create_adaptive_streaming_chat", _fake_create, raising=False)
    stream, calling_mode = await open_stream("openai", _mk_request("openai"))
    events = _collect_sync(stream)
    types = [e["type"] for e in events]
    assert "delta" in types
    assert "tool_preparing" in types
    # tool_preparing carries id+name+index so the consumer can build the buffer
    # (the SSE _emit drops id — wire byte-identical).
    _tp = next(e for e in events if e["type"] == "tool_preparing")
    assert _tp["id"] == "o1"
    assert _tp["name"] == "execute_code"
    assert _tp["index"] == 0
    assert calling_mode == CallingMode.NATIVE


async def test_openai_adapter_think_tag_routes_to_reasoning_delta(monkeypatch):
    """I4: a Kimi/MiniMax/GLM <think>...</think>visible stream routes the think
    content to reasoning_delta and the rest to delta — NO <think> leak into delta."""
    _openai_compat = _require_openai_compat()

    def _fake_create(**kwargs):
        return [_mk_openai_chunk(content="<think>reasoning</think>visible")], CallingMode.NATIVE

    monkeypatch.setattr(_openai_compat, "create_adaptive_streaming_chat", _fake_create, raising=False)
    # active_provider_name must be one of moonshot/deepseek/minimax/zhipu to trigger
    # the <think> state machine — _mk_request sets it directly (the consumer carries
    # the registry-derived provider into the request; the seam simulates it).
    req = _mk_request("moonshot")
    stream, _ = await open_stream("moonshot", req)
    events = _collect_sync(stream)
    reasoning = [e for e in events if e["type"] == "reasoning_delta"]
    deltas = [e for e in events if e["type"] == "delta"]
    assert any("reasoning" in e["content"] for e in reasoning)
    assert all("<think>" not in e["content"] for e in deltas)
    assert all("</think>" not in e["content"] for e in deltas)
    assert any(e["content"] == "visible" for e in deltas)


async def test_openai_adapter_surfaces_calling_mode(monkeypatch):
    """Pitfall 3: open_stream returns a 2-tuple whose [1] is a CallingMode member —
    surfaced from create_adaptive_streaming_chat, NEVER buried (the bug that made
    the harness OpenAI-only)."""
    _openai_compat = _require_openai_compat()

    def _fake_create(**kwargs):
        return [_mk_openai_chunk(content="text-as-tool")], CallingMode.STRUCTURED

    monkeypatch.setattr(_openai_compat, "create_adaptive_streaming_chat", _fake_create, raising=False)
    result = await open_stream("deepseek", _mk_request("deepseek"))
    assert isinstance(result, tuple)
    assert len(result) == 2
    assert isinstance(result[1], CallingMode)
    assert result[1] == CallingMode.STRUCTURED


async def test_openai_adapter_usage_via_accumulate_chunk_usage(monkeypatch):
    """I8: usage accounting rides _accumulate_chunk_usage (Google cumulative-overwrite
    vs OpenAI +=); the adapter accumulates per-stream + EMITS a canonical usage
    event the consumer SUMs. The trailing OpenAI choices=[] usage chunk → input=12,
    output=3."""
    _openai_compat = _require_openai_compat()

    def _fake_create(**kwargs):
        chunks = [
            _mk_openai_chunk(content="hi"),
            _mk_openai_chunk(prompt_tokens=12, completion_tokens=3, has_choice=False),
        ]
        return chunks, CallingMode.NATIVE

    monkeypatch.setattr(_openai_compat, "create_adaptive_streaming_chat", _fake_create, raising=False)
    stream, _ = await open_stream("openai", _mk_request("openai"))
    events = _collect_sync(stream)
    usage = [e for e in events if e["type"] in ("usage", "usage_delta")]
    assert usage, "OpenAI adapter must emit a usage/usage_delta event"
    _u = next(e for e in usage if e["type"] == "usage")
    assert _u["input_tokens"] == 12
    assert _u["output_tokens"] == 3


async def test_openai_adapter_no_synthetic_tool_start(monkeypatch):
    """Open Q2: the OpenAI native path emits tool_preparing + tool_args_progress —
    NOT a synthetic tool_start (that would add a skeleton token the OpenAI path
    lacks → a Wave-5 skeleton diff). The consumer builds tool_calls_buffer from the
    two progress events."""
    _openai_compat = _require_openai_compat()

    def _fake_create(**kwargs):
        # name+id announce, then several arg deltas (small — sub-boundary), then a
        # finish chunk. A real OpenAI tool-call stream.
        chunks = [
            _mk_openai_chunk(tool_calls=[_mk_tc(0, "call_1", "search_documents", "")]),
            _mk_openai_chunk(tool_calls=[_mk_tc(0, None, None, '{"q":')]),
            _mk_openai_chunk(tool_calls=[_mk_tc(0, None, None, '"x"}')]),
            _mk_openai_chunk(finish_reason="tool_calls"),
        ]
        return chunks, CallingMode.NATIVE

    monkeypatch.setattr(_openai_compat, "create_adaptive_streaming_chat", _fake_create, raising=False)
    stream, _ = await open_stream("openai", _mk_request("openai"))
    events = _collect_sync(stream)
    types = [e["type"] for e in events]
    assert "tool_start" not in types, "OpenAI native path must NOT emit a synthetic tool_start (Open Q2)"
    assert "tool_preparing" in types
    assert "tool_args_progress" in types
    # The progress events carry the FULL cumulative code_so_far so the consumer's
    # buffer is complete even for sub-boundary tools (no boundary crossed here).
    _last_progress = [e for e in events if e["type"] == "tool_args_progress"][-1]
    assert _last_progress["code_so_far"] == '{"q":"x"}'
    # finish carries the complete tool_calls (id/name/arguments) — SSE-silent.
    _finish = next(e for e in events if e["type"] == "finish")
    assert _finish["tool_calls"][0]["id"] == "call_1"
    assert _finish["tool_calls"][0]["name"] == "search_documents"
    assert _finish["tool_calls"][0]["arguments"] == '{"q":"x"}'
