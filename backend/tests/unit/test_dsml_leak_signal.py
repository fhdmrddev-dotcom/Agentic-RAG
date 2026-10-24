"""XPROV-02b (Phase 175) — the DeepSeek DSML leak signal. CONSCIOUSLY RETIRED in Phase 292.1.

Phase 292.1 (D-01 / D-02 / D-04) — consciously retired, with the reason written in here (the
D-206-07 / SEED-177 precedent: retire a fence deliberately, never trip it by surprise).

What this suite used to pin, and why each pin encoded the bug (BUG-261024-03):

* ``test_non_deepseek_stream_never_sets_dsml_leaked`` asserted that a non-``deepseek`` stream
  passes DSML through verbatim and never raises the flag. That IS cause D-01, as a test: the
  production failure was a DeepSeek model routed through ``openrouter``, so the deepseek-gated
  strip never ran and the markup became the answer.
* ``test_leaking_deepseek_stream_sets_dsml_leaked`` drove the two-bar opener ``<｜｜DSML｜｜``.
  Production writes ``<｜DSML｜ calls>`` (one bar, then a space), which that opener cannot match
  (cause D-02), so native DeepSeek v4.1 leaked as well.
* The post-drain guard appended ``DSML_LEAK_ERROR_MESSAGE`` and let the run finish ``completed``
  (cause D-04): a dead end with no Continue, even though the model still had work queued.

The ``dsml_leaked`` flag, the deepseek-only strip and ``DSML_LEAK_ERROR_MESSAGE`` are deleted.
The NEW contract, pinned below, is that the OpenAI-compat adapter does nothing special with tool
markup for ANY provider: it yields DSML text verbatim as ``delta`` events and carries no
``dsml_leaked`` attribute. The loop owns the markup provider-blind — held live by
``text_tool_calls.TagHoldback``, then parsed into a real call (queued at the cap, dispatched
mid-run) or worded. The new owners are ``test_2921_cap_text_calls.py`` (loop behaviour) and
``test_2921_text_tool_calls.py`` (parser, detector, holdback).
"""
from types import SimpleNamespace

import pytest

from app.services.openai_service import CallingMode
from app.services.provider_gateway.openai_compat import _ClosableEventStream

# The measured production spelling (prod msg 4226d237) and the two-bar native spelling.
F1_OPENER_TEXT = '<｜DSML｜ calls>\n<｜DSML｜ invoke name="execute_code">'
F3_OPENER_TEXT = '<｜｜DSML｜｜tool_calls>\n<｜｜DSML｜｜invoke name="execute_code">'


def _fake_chunk(content=None, finish_reason=None, usage=None):
    delta = SimpleNamespace(content=content, reasoning_content=None, tool_calls=None)
    choice = SimpleNamespace(delta=delta, finish_reason=finish_reason)
    return SimpleNamespace(choices=[choice], usage=usage)


def _drive(chunks, provider):
    stream = _ClosableEventStream(chunks, provider, CallingMode.NATIVE)
    return stream, list(stream)


@pytest.mark.parametrize("provider", ["deepseek", "openrouter", "zhipu"])
@pytest.mark.parametrize("markup", [F1_OPENER_TEXT, F3_OPENER_TEXT], ids=["F1", "F3"])
def test_the_adapter_yields_dsml_verbatim_for_every_provider(provider, markup):
    text = "ok " + markup
    stream, events = _drive([_fake_chunk(text)], provider)
    deltas = [e["content"] for e in events if e["type"] == "delta"]
    assert "".join(deltas) == text
    assert not hasattr(stream, "dsml_leaked")
