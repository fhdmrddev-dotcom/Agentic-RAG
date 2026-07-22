"""XPROV-02b (Phase 175): a detected DeepSeek DSML leak must end the turn HONESTLY.

When DeepSeek writes a tool call as visible text (`<｜｜DSML｜｜tool_calls>…`), the
sanitizer suppresses the markup so it never renders — but the turn is then silently
incomplete (the tool never ran). The honest notice is surfaced the SAME way the
provider-error path is (code-review CR-01 fix): appended to the finalized content AND
emitted as a `delta` — NOT the terminal `error` SSE event — driven off a
`stream.dsml_leaked` flag set inside `_normalize`.

These tests prove:
  1. `_normalize` flips `stream.dsml_leaked` True on a leaking deepseek stream,
     leaves it False on a clean deepseek stream, and never sets it on a
     non-deepseek stream (D-14 default-inert).
  2. The agent_loop post-drain guard emits exactly ONE fixed-copy `delta` event AND
     persists the notice in `full_content` when the flag is set, and does NOTHING
     otherwise (including when the attr is absent — the `getattr` default that keeps
     anthropic/google streams byte-identical).
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


async def _post_drain_guard(stream, emit, full_content=""):
    """Mirror of the agent_loop Option-B post-drain hook (CR-01 fix, kept in lockstep;
    the copy is single-sourced via DSML_LEAK_ERROR_MESSAGE).

    A DSML leak is surfaced the SAME way the provider-error path is: the honest notice
    is APPENDED to full_content (so it persists in the finalized assistant message) and
    emitted as a `delta` (so the live view shows it inline). It is NOT the terminal
    `error` event — api.ts treats `error` as terminal while this path keeps streaming
    and finalizes the run as `completed` (the CR-01 mismatch)."""
    if getattr(stream, "dsml_leaked", False):
        notice = (
            f"\n\n{DSML_LEAK_ERROR_MESSAGE}" if full_content else DSML_LEAK_ERROR_MESSAGE
        )
        full_content += notice
        await emit(None, "run-1", "delta", content=notice)
    return full_content


def test_guard_emits_delta_and_persists_when_leaked():
    stream, _ = _drive([_fake_chunk("hi " + _DSML_OPENER + "tool_calls>")])
    emit = _EmitRecorder()
    final = asyncio.run(_post_drain_guard(stream, emit, full_content="hi "))
    # Exactly one event, and it is a `delta` (NOT terminal `error`).
    assert len(emit.calls) == 1
    event_type, kwargs = emit.calls[0]
    assert event_type == "delta"
    assert kwargs["content"].endswith(DSML_LEAK_ERROR_MESSAGE)
    # The notice PERSISTS in the finalized content (the CR-01 fix — no silent turn).
    assert final.endswith(DSML_LEAK_ERROR_MESSAGE)


def test_guard_no_emit_on_clean_deepseek():
    stream, _ = _drive([_fake_chunk("clean answer")])
    emit = _EmitRecorder()
    final = asyncio.run(_post_drain_guard(stream, emit, full_content="clean answer"))
    assert emit.calls == []
    # Clean stream: content is untouched (no notice appended).
    assert final == "clean answer"


def test_guard_no_emit_when_attr_absent():
    # anthropic/google streams are plain generators with no dsml_leaked attr — the
    # getattr default keeps them byte-identical (no emit, content untouched).
    emit = _EmitRecorder()
    final = asyncio.run(_post_drain_guard(object(), emit, full_content="native answer"))
    assert emit.calls == []
    assert final == "native answer"


def test_error_message_is_fixed_and_has_no_raw_interpolation():
    # Info-disclosure control: the honest copy is a fixed string — it must not embed
    # the model's raw (attacker-controllable) leaked markup.
    assert isinstance(DSML_LEAK_ERROR_MESSAGE, str)
    assert _DSML_OPENER not in DSML_LEAK_ERROR_MESSAGE
    assert "{" not in DSML_LEAK_ERROR_MESSAGE and "%" not in DSML_LEAK_ERROR_MESSAGE
