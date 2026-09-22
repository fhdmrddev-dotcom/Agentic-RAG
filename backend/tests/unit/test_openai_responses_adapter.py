"""Contract tests for the OpenAI ``/v1/responses`` gateway adapter (Phase 262).

Synthetic-stream-in -> canonical-events-out, the same shape as
``test_provider_gateway_seam.py``. No live keys, fully deterministic.

⭐ THE FINDING THESE TESTS EXIST TO PIN is not "the adapter works" — it is that the
``gpt-5.6`` family had NO native tool calling at all before this adapter, because
``reasoning_first`` short-circuited it to ``CallingMode.STRUCTURED`` above every other
gate. So the routing assertions below are as load-bearing as the stream ones: a future
edit that re-orders ``resolve_calling_mode`` silently restores prose-parsed tool calls,
and only ``test_responses_family_routes_native`` would say so.
"""
from __future__ import annotations

from types import SimpleNamespace

import pytest

from app.services.openai_service import CallingMode, resolve_calling_mode, uses_responses_api
from app.services.provider_gateway.openai_responses import (
    _ClosableResponsesStream,
    _build_kwargs,
    _is_reasoning_summary_refusal,
    _schema_is_strict_ready,
    _to_responses_input,
    _to_responses_tools,
)

RESPONSES_MODELS = ("gpt-5.6-sol", "gpt-5.6-terra", "gpt-5.6-luna")


# ── Routing ───────────────────────────────────────────────────────────────────


@pytest.mark.parametrize("model", RESPONSES_MODELS)
def test_responses_family_routes_native(model):
    """The whole point: these three get NATIVE tool calling, not STRUCTURED prose."""
    assert uses_responses_api(model) is True
    assert resolve_calling_mode(model) is CallingMode.NATIVE


@pytest.mark.parametrize("model", RESPONSES_MODELS)
def test_non_openai_provider_keeps_the_structured_downgrade(model):
    """⛔ The Responses API is OpenAI's OWN surface.

    An OpenRouter-served copy of the same model id does not implement ``/v1/responses`` and
    still hard-400s on chat.completions with a tools param — so it must KEEP the Phase 175
    STRUCTURED downgrade. This is the assertion that stops the fix becoming a regression
    for every non-native route.
    """
    us = SimpleNamespace(
        active_provider="openrouter",
        llm_model=model,
        openrouter_tool_strategy="quality",
    )
    assert uses_responses_api(model, us) is False
    assert resolve_calling_mode(model, us) is CallingMode.STRUCTURED


def test_model_without_the_flag_is_unchanged():
    """Default-inert (D-14): a row with no ``api_surface`` behaves exactly as before."""
    assert uses_responses_api("gpt-5.5") is False
    assert resolve_calling_mode("gpt-5.5") is CallingMode.NATIVE


# ── Request translation ───────────────────────────────────────────────────────


def test_tool_call_round_trip_uses_call_id():
    """⛔ ``call_id`` is the identifier that round-trips, and this pins it end to end.

    Our loop stores the id the adapter emits and echoes it back as ``tool_call_id``. If the
    input converter wrote anything other than ``call_id`` on the ``function_call`` item, or
    read anything else off the ``tool`` message, round 2 of every multi-tool turn would be
    rejected by the API. The two halves are asserted against the SAME literal.
    """
    messages = [
        {"role": "system", "content": "sys"},
        {"role": "user", "content": "hi"},
        {
            "role": "assistant",
            "content": "let me check",
            "tool_calls": [
                {
                    "id": "call_abc123",
                    "type": "function",
                    "function": {"name": "search_documents", "arguments": '{"q":"x"}'},
                }
            ],
        },
        {"role": "tool", "tool_call_id": "call_abc123", "content": "result text"},
    ]
    items = _to_responses_input(messages)

    assert items[0] == {"role": "system", "content": "sys"}
    assert items[1] == {"role": "user", "content": "hi"}
    # Narration is preserved as its own assistant message, ahead of the call.
    assert items[2]["role"] == "assistant"
    assert items[2]["content"] == [{"type": "output_text", "text": "let me check"}]
    assert items[3] == {
        "type": "function_call",
        "call_id": "call_abc123",
        "name": "search_documents",
        "arguments": '{"q":"x"}',
    }
    assert items[4] == {
        "type": "function_call_output",
        "call_id": "call_abc123",
        "output": "result text",
    }


def test_internal_and_provider_specific_keys_are_dropped():
    """The converter BUILDS new dicts, so ``_pinned_skill`` / ``thought_signature`` vanish.

    Both are keys other paths add: ``_``-prefixed markers (which OpenAI 400s on) and the
    Google signature echo (meaningless here). Filtering by construction is what makes this
    true without a maintained deny-list.
    """
    messages = [
        {
            "role": "assistant",
            "tool_calls": [
                {
                    "id": "call_1",
                    "type": "function",
                    "function": {"name": "t", "arguments": "{}"},
                    "thought_signature": "sig-should-not-appear",
                }
            ],
        },
        {
            "role": "tool",
            "tool_call_id": "call_1",
            "content": "ok",
            "_pinned_skill": "writer",
        },
    ]
    items = _to_responses_input(messages)
    flat = repr(items)
    assert "thought_signature" not in flat
    assert "_pinned_skill" not in flat
    assert items[0]["call_id"] == "call_1"


def test_assistant_tool_call_with_no_content_emits_no_empty_message():
    """A tool-calling turn usually has ``content: None`` — do not invent a blank message."""
    items = _to_responses_input(
        [
            {
                "role": "assistant",
                "content": None,
                "tool_calls": [
                    {"id": "c1", "type": "function", "function": {"name": "n", "arguments": "{}"}}
                ],
            }
        ]
    )
    assert len(items) == 1
    assert items[0]["type"] == "function_call"


def test_multimodal_user_content_is_translated_not_flattened():
    items = _to_responses_input(
        [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": "what is this"},
                    {
                        "type": "image_url",
                        "image_url": {"url": "data:image/png;base64,AAA", "detail": "low"},
                    },
                ],
            }
        ]
    )
    assert items[0]["content"] == [
        {"type": "input_text", "text": "what is this"},
        {"type": "input_image", "image_url": "data:image/png;base64,AAA", "detail": "low"},
    ]


def test_tools_are_flattened_to_the_responses_shape():
    chat_tools = [
        {
            "type": "function",
            "function": {
                "name": "execute_code",
                "description": "run it",
                "parameters": {"type": "object", "properties": {"code": {"type": "string"}}},
            },
        }
    ]
    out = _to_responses_tools(chat_tools)
    assert out == [
        {
            "type": "function",
            "name": "execute_code",
            "description": "run it",
            "parameters": {"type": "object", "properties": {"code": {"type": "string"}}},
        }
    ]
    # Idempotent — a flat tool passes through unchanged.
    assert _to_responses_tools(out) == out


def test_strict_is_requested_only_for_a_strict_ready_schema():
    """⛔ Strict on a non-compliant schema is a REQUEST-time 400, not a soft degrade.

    OpenAI strict mode demands ``additionalProperties: false`` and every property in
    ``required``. Switching it on blindly would turn the forced-emission path into an
    outage, so the adapter asks only where the schema already satisfies the rules.
    """
    ready = {
        "type": "object",
        "additionalProperties": False,
        "properties": {"a": {"type": "string"}},
        "required": ["a"],
    }
    not_ready = {"type": "object", "properties": {"a": {"type": "string"}}}
    assert _schema_is_strict_ready(ready) is True
    assert _schema_is_strict_ready(not_ready) is False


def test_forced_emission_names_the_tool_in_responses_shape():
    from app.services.provider_gateway.dispatcher import GatewayRequest

    tools = [
        {
            "type": "function",
            "function": {
                "name": "emit",
                "description": "",
                "parameters": {
                    "type": "object",
                    "additionalProperties": False,
                    "properties": {"a": {"type": "string"}},
                    "required": ["a"],
                },
            },
        }
    ]
    kwargs = _build_kwargs(
        GatewayRequest(
            messages=[{"role": "user", "content": "go"}],
            model="gpt-5.6-sol",
            active_provider_name="openai",
            tools=tools,
            force_tool_name="emit",
            strict_schema=True,
        )
    )
    # Responses names the function at the TOP level of tool_choice — not nested under
    # a "function" key the way chat.completions does.
    assert kwargs["tool_choice"] == {"type": "function", "name": "emit"}
    assert kwargs["tools"][0]["strict"] is True
    assert kwargs["store"] is False


def test_force_no_tools_sends_no_tools_param():
    from app.services.provider_gateway.dispatcher import GatewayRequest

    kwargs = _build_kwargs(
        GatewayRequest(
            messages=[{"role": "user", "content": "go"}],
            model="gpt-5.6-sol",
            active_provider_name="openai",
            tools=[],
            force_no_tools=True,
        )
    )
    assert "tools" not in kwargs
    assert "tool_choice" not in kwargs


# ── Stream normalization ──────────────────────────────────────────────────────


def _ev(**kw):
    return SimpleNamespace(**kw)


def _fn_item(item_id, call_id, name, arguments=""):
    return SimpleNamespace(
        type="function_call", id=item_id, call_id=call_id, name=name, arguments=arguments
    )


def _usage(inp, out, reasoning=0):
    return SimpleNamespace(
        input_tokens=inp,
        output_tokens=out,
        output_tokens_details=SimpleNamespace(reasoning_tokens=reasoning),
    )


def test_text_and_reasoning_are_routed_to_separate_channels():
    raw = [
        _ev(type="response.reasoning_summary_text.delta", delta="thinking..."),
        _ev(type="response.output_text.delta", delta="Hello"),
        _ev(type="response.output_text.delta", delta=" world"),
        _ev(
            type="response.completed",
            response=SimpleNamespace(usage=_usage(10, 5, 3)),
        ),
    ]
    events = list(_ClosableResponsesStream(raw, "openai"))
    assert events[0] == {"type": "reasoning_delta", "content": "thinking..."}
    assert events[1] == {"type": "delta", "content": "Hello"}
    assert events[2] == {"type": "delta", "content": " world"}
    assert events[3] == {
        "type": "usage",
        "input_tokens": 10,
        "output_tokens": 5,
        "reasoning_tokens": 3,
    }
    assert events[4] == {"type": "finish", "finish_reason": "stop", "tool_calls": []}


def test_a_tool_call_produces_the_buffer_the_consumer_builds_from():
    """``agent_loop`` builds ``tool_calls_buffer`` from tool_preparing + tool_args_progress.

    This asserts the exact fields it reads: ``id`` / ``name`` / ``index`` on the first, and
    the FULL cumulative ``code_so_far`` on the second (it assigns, never appends — a
    partial value there ships truncated JSON to the dispatcher).
    """
    raw = [
        _ev(
            type="response.output_item.added",
            output_index=0,
            item=_fn_item("fc_1", "call_xyz", "search_documents"),
        ),
        _ev(type="response.function_call_arguments.delta", item_id="fc_1", delta='{"q":'),
        _ev(type="response.function_call_arguments.delta", item_id="fc_1", delta='"cats"}'),
        _ev(
            type="response.output_item.done",
            item=_fn_item("fc_1", "call_xyz", "search_documents", '{"q":"cats"}'),
        ),
        _ev(type="response.completed", response=SimpleNamespace(usage=_usage(1, 2))),
    ]
    events = list(_ClosableResponsesStream(raw, "openai"))

    prep = [e for e in events if e["type"] == "tool_preparing"]
    assert prep == [
        {"type": "tool_preparing", "id": "call_xyz", "name": "search_documents", "index": 0}
    ]

    progress = [e for e in events if e["type"] == "tool_args_progress"]
    assert progress[0]["code_so_far"] == '{"q":'
    assert progress[-1]["code_so_far"] == '{"q":"cats"}'
    assert all(p["tool_index"] == 0 for p in progress)
    assert all(p["name"] == "search_documents" for p in progress)

    finish = events[-1]
    assert finish["finish_reason"] == "tool_calls"
    assert finish["tool_calls"] == [
        {"id": "call_xyz", "name": "search_documents", "arguments": '{"q":"cats"}'}
    ]


def test_the_done_event_wins_over_accumulated_deltas():
    """The authoritative final arguments come from ``output_item.done``.

    A dropped or reordered delta would otherwise hand the tool dispatcher malformed JSON,
    and a JSON parse failure mid-turn reads to the user as the model getting it wrong.
    """
    raw = [
        _ev(type="response.output_item.added", item=_fn_item("fc_1", "c1", "t")),
        _ev(type="response.function_call_arguments.delta", item_id="fc_1", delta='{"broke'),
        _ev(type="response.output_item.done", item=_fn_item("fc_1", "c1", "t", '{"whole":1}')),
        _ev(type="response.completed", response=SimpleNamespace(usage=_usage(1, 1))),
    ]
    events = list(_ClosableResponsesStream(raw, "openai"))
    assert events[-1]["tool_calls"][0]["arguments"] == '{"whole":1}'


def test_two_tool_calls_get_dense_zero_based_indices():
    """⛔ ``output_index`` is NOT dense over tool calls — reasoning and message items share
    the counter. The consumer keys its buffer by ordinal, so arrival order is what it gets.
    """
    raw = [
        _ev(type="response.output_item.added", output_index=1, item=_fn_item("a", "ca", "one")),
        _ev(type="response.output_item.added", output_index=4, item=_fn_item("b", "cb", "two")),
        _ev(type="response.function_call_arguments.delta", item_id="b", delta="{}"),
        _ev(type="response.function_call_arguments.delta", item_id="a", delta="{}"),
        _ev(type="response.completed", response=SimpleNamespace(usage=_usage(1, 1))),
    ]
    events = list(_ClosableResponsesStream(raw, "openai"))
    prep = [(e["index"], e["name"]) for e in events if e["type"] == "tool_preparing"]
    assert prep == [(0, "one"), (1, "two")]
    assert [tc["id"] for tc in events[-1]["tool_calls"]] == ["ca", "cb"]


def test_incomplete_from_the_token_cap_is_named_length():
    """The loop's truncation-recovery path keys on the word ``length``."""
    raw = [
        _ev(type="response.output_text.delta", delta="partial"),
        _ev(
            type="response.incomplete",
            response=SimpleNamespace(
                usage=_usage(9, 9),
                incomplete_details=SimpleNamespace(reason="max_output_tokens"),
            ),
        ),
    ]
    events = list(_ClosableResponsesStream(raw, "openai"))
    assert events[-1]["finish_reason"] == "length"


def test_a_failed_response_raises_instead_of_finishing_quietly():
    """⛔ A failure that ends the turn as ``stop`` is indistinguishable from an answer."""
    raw = [
        _ev(type="response.output_text.delta", delta="half"),
        _ev(
            type="response.failed",
            response=SimpleNamespace(error=SimpleNamespace(message="upstream exploded")),
        ),
    ]
    with pytest.raises(RuntimeError, match="upstream exploded"):
        list(_ClosableResponsesStream(raw, "openai"))


def test_close_delegates_to_the_raw_stream():
    """The cancel path must close the SAME httpx response every other OpenAI call closes."""
    closed = []

    class _Raw:
        def __iter__(self):
            return iter([])

        def close(self):
            closed.append(True)

    stream = _ClosableResponsesStream(_Raw(), "openai")
    stream.close()
    assert closed == [True]
    assert stream.dsml_leaked is False


# ── The narrow summary fallback ───────────────────────────────────────────────


def test_summary_refusal_predicate_is_narrow():
    """It must fire for the summary 400 and for NOTHING else — a broad predicate would
    retry a real configuration error into a second identical failure."""
    summary_400 = SimpleNamespace(
        status_code=400,
        body={"error": {"param": "reasoning.summary", "message": "unsupported"}},
    )
    other_400 = SimpleNamespace(
        status_code=400, body={"error": {"param": "model", "message": "no such model"}}
    )
    rate_limit = SimpleNamespace(status_code=429, body={"error": {"message": "slow down"}})

    assert _is_reasoning_summary_refusal(summary_400) is True
    assert _is_reasoning_summary_refusal(other_400) is False
    assert _is_reasoning_summary_refusal(rate_limit) is False
    assert _is_reasoning_summary_refusal(RuntimeError("boom")) is False


def test_operator_native_tools_false_sends_it_back_to_structured(monkeypatch):
    """⭐ The other half of the bug: the Model Registry toggle must not be a lie twice.

    Before this change the UI showed ``native_tools: True`` for these rows over a control
    that could not fire — the ``reasoning_first`` gate sat above the override read. Routing
    to ``/v1/responses`` without consulting the override would repeat that one surface over.
    An explicit ``False`` therefore returns the model to the compat adapter, where the
    STRUCTURED downgrade applies, so the toggle and the behaviour agree.

    ⛔ ``None`` is NOT ``False``. An untouched toggle must keep the Responses route, or the
    fix would be disabled for every operator who never opened the registry.
    """
    import app.models.user_settings as us_mod

    monkeypatch.setattr(
        us_mod,
        "_model_overrides_cache",
        {
            "gpt-5.6-sol": {
                "model_id": "gpt-5.6-sol",
                "native_tools": False,
                "enabled": True,
                "provider": "openai",
            }
        },
    )
    assert uses_responses_api("gpt-5.6-sol") is False
    assert resolve_calling_mode("gpt-5.6-sol") is CallingMode.STRUCTURED

    # The untouched case — no override row at all — still routes to Responses.
    monkeypatch.setattr(us_mod, "_model_overrides_cache", {})
    assert uses_responses_api("gpt-5.6-sol") is True
    assert resolve_calling_mode("gpt-5.6-sol") is CallingMode.NATIVE
