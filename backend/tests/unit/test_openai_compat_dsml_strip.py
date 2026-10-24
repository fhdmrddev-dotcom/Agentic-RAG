"""The deepseek-only DSML strip in the OpenAI-compat adapter. CONSCIOUSLY RETIRED in Phase 292.1.

Phase 292.1 (D-01 / D-02) — consciously retired, with the reason written in here (the
D-206-07 / SEED-177 precedent: retire a fence deliberately, never trip it by surprise).

This suite pinned ``_strip_deepseek_tool_markup`` and its opener ``_DSML_OPENER``:

* ``test_opener_constant_is_fullwidth_pipe`` pinned the opener as ``<｜｜DSML｜｜`` (TWO bars).
  The measured production spelling is ``<｜DSML｜ calls>`` (ONE bar, then a space — prod msg
  4226d237), which that literal can never match (cause D-02).
* ``test_non_deepseek_never_flushes_and_is_byte_identical`` pinned the strip as gated on
  ``active_provider_name == "deepseek"``. The failing run was a DeepSeek model routed through
  ``openrouter``, so the strip never ran (cause D-01).
* The remaining cases (split opener, stream-end flush, long-turn floor) pinned behaviour of a
  function that no longer exists.

The adapter no longer handles tool markup at all; ``app.services.text_tool_calls`` owns it
provider-blind in the agent loop. The ASCII-lookalike intent
(``test_ascii_pipe_lookalike_does_not_trigger``) now lives in ``test_2921_text_tool_calls.py``
(``test_ascii_pipe_lookalike_is_not_dsml_and_not_stripped``). What stays pinned here is the
adapter's side of the new contract, plus the ``<think>`` handling it must keep untouched.
"""
from types import SimpleNamespace

import pytest

from app.services.openai_service import CallingMode
from app.services.provider_gateway import openai_compat
from app.services.provider_gateway.openai_compat import _ClosableEventStream


def _fake_chunk(content=None, finish_reason=None, usage=None):
    """A minimal OpenAI-SDK-shaped streaming chunk for driving _normalize."""
    delta = SimpleNamespace(content=content, reasoning_content=None, tool_calls=None)
    choice = SimpleNamespace(delta=delta, finish_reason=finish_reason)
    return SimpleNamespace(choices=[choice], usage=usage)


def _drive(chunks, provider="deepseek"):
    stream = _ClosableEventStream(chunks, provider, CallingMode.NATIVE)
    return list(stream)


def test_the_retired_strip_symbols_are_gone():
    for name in ("_DSML_OPENER", "_strip_deepseek_tool_markup"):
        assert not hasattr(openai_compat, name), name


@pytest.mark.parametrize("provider", ["deepseek", "openai", "openrouter"])
def test_a_partial_dsml_prefix_is_not_held_by_the_adapter(provider):
    # Before 292.1 the deepseek branch held "<｜" in a pending buffer. Holding is the loop's job
    # now (TagHoldback); the adapter yields every chunk as it arrives, for every provider.
    events = _drive([_fake_chunk("hello "), _fake_chunk("<｜")], provider=provider)
    assert [e["content"] for e in events if e["type"] == "delta"] == ["hello ", "<｜"]


@pytest.mark.parametrize("opener", ["<｜DSML｜ calls>", "<｜DSML｜tool_calls>", "<｜｜DSML｜｜tool_calls>"])
def test_dsml_in_every_measured_spelling_reaches_the_loop_verbatim(opener):
    chunks = [_fake_chunk(f"line {i} ") for i in range(5)] + [_fake_chunk("tail " + opener + "x")]
    joined = "".join(e["content"] for e in _drive(chunks) if e["type"] == "delta")
    assert joined == "".join(f"line {i} " for i in range(5)) + "tail " + opener + "x"


def test_think_block_handling_is_unchanged_for_moonshot():
    # The <think> state machine is untouched by the retirement: reasoning is still routed to
    # reasoning_delta and the visible text keeps flowing as delta.
    events = _drive([_fake_chunk("<think>plan</think>answer")], provider="moonshot")
    reasoning = "".join(e["content"] for e in events if e["type"] == "reasoning_delta")
    visible = "".join(e["content"] for e in events if e["type"] == "delta")
    assert reasoning == "plan"
    assert visible == "answer"
