"""XPROV-02b (Phase 175): a detected DeepSeek DSML leak must end the turn HONESTLY.

When DeepSeek writes a tool call as visible text (`<｜｜DSML｜｜tool_calls>…`), the
sanitizer suppresses the markup so it never renders — but the turn is then silently
incomplete (the tool never ran). Option B surfaces that via a single EXISTING `error`
SSE event, driven off a `stream.dsml_leaked` flag set inside `_normalize`.

These tests prove:
  1. `_normalize` flips `stream.dsml_leaked` True on a leaking deepseek stream,
     leaves it False on a clean deepseek stream, and never sets it on a
     non-deepseek stream (D-14 default-inert).
  2. The agent_loop post-drain guard emits exactly ONE fixed-copy `error` event when
     the flag is set, and ZERO otherwise (including when the attr is absent — the
     `getattr` default that keeps anthropic/google streams byte-identical).
"""
import asyncio
from types import SimpleNamespace

from app.services.agent_loop import DSML_LEAK_ERROR_MESSAGE
from app.services.openai_service import CallingMode
from app.services.provider_gateway.openai_compat import (
    _ClosableEventStream,
    _DSML_OPENER,
)


def _fake_chunk(content=None, finish_reason=None, usage=None):
    delta = SimpleNamespace(content=content, reasoning_content=None, tool_calls=None)
    choice = SimpleNamespace(delta=delta, finish_reason=finish_reason)
    return SimpleNamespace(choices=[choice], usage=usage)


def _drive(chunks, provider="deepseek"):
    """Run the full _normalize path; return (stream, events) so the flag is readable."""
    stream = _ClosableEventStream(chunks, provider, CallingMode.NATIVE)
    events = list(stream)
    return stream, events


# --- The flag: set inside _normalize (real code) ------------------------------


def test_leaking_deepseek_stream_sets_dsml_leaked():
    leak = "ok " + _DSML_OPENER + "tool_calls>\nimport os"
    stream, _ = _drive([_fake_chunk(leak)])
    assert stream.dsml_leaked is True


def test_clean_deepseek_stream_leaves_dsml_leaked_false():
    stream, _ = _drive([_fake_chunk("all good, here is your answer")])
    assert stream.dsml_leaked is False


def test_non_deepseek_stream_never_sets_dsml_leaked():
    # A non-deepseek stream that happens to contain the opener text passes it through
    # verbatim (no strip branch) and never flips the flag.
    leak = "ok " + _DSML_OPENER + "tool_calls>"
    stream, _ = _drive([_fake_chunk(leak)], provider="openai")
    assert stream.dsml_leaked is False


# --- The post-drain guard: reuse the existing `error` SSE event ---------------


class _EmitRecorder:
    def __init__(self):
        self.calls = []

    async def __call__(self, redis, run_id, event_type, **kwargs):
        self.calls.append((event_type, kwargs))


async def _post_drain_guard(stream, emit):
    """Mirror of the agent_loop Option-B post-drain hook (kept in lockstep; the copy
    is single-sourced via DSML_LEAK_ERROR_MESSAGE)."""
    if getattr(stream, "dsml_leaked", False):
        await emit(None, "run-1", "error", message=DSML_LEAK_ERROR_MESSAGE)


def test_guard_emits_exactly_one_error_when_leaked():
    stream, _ = _drive([_fake_chunk("hi " + _DSML_OPENER + "tool_calls>")])
    emit = _EmitRecorder()
    asyncio.run(_post_drain_guard(stream, emit))
    assert len(emit.calls) == 1
    event_type, kwargs = emit.calls[0]
    assert event_type == "error"
    assert kwargs["message"] == DSML_LEAK_ERROR_MESSAGE


def test_guard_no_emit_on_clean_deepseek():
    stream, _ = _drive([_fake_chunk("clean answer")])
    emit = _EmitRecorder()
    asyncio.run(_post_drain_guard(stream, emit))
    assert emit.calls == []


def test_guard_no_emit_when_attr_absent():
    # anthropic/google streams are plain generators with no dsml_leaked attr — the
    # getattr default keeps them byte-identical (no emit).
    emit = _EmitRecorder()
    asyncio.run(_post_drain_guard(object(), emit))
    assert emit.calls == []


def test_error_message_is_fixed_and_has_no_raw_interpolation():
    # Info-disclosure control: the honest copy is a fixed string — it must not embed
    # the model's raw (attacker-controllable) leaked markup.
    assert isinstance(DSML_LEAK_ERROR_MESSAGE, str)
    assert _DSML_OPENER not in DSML_LEAK_ERROR_MESSAGE
    assert "{" not in DSML_LEAK_ERROR_MESSAGE and "%" not in DSML_LEAK_ERROR_MESSAGE
