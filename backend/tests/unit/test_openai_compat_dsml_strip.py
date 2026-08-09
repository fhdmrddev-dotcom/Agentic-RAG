"""Guard: DeepSeek native tool-call markup must never render as visible content.

Root cause (thread 5a86a9fd, 2026-07-08): DeepSeek sometimes emits a tool call as
plain text using its `<｜｜DSML｜｜tool_calls>…` markup instead of the structured
tool_calls delta. The OpenAI-compat normalizer treats `delta.content` as visible
text, so ~16 KB of raw markup leaked into the chat. `_strip_deepseek_tool_markup`
suppresses that markup from the moment the opener appears (prose before it is kept).
It does NOT re-parse the call into a real tool_call — that is a tracked follow-up.
"""
from types import SimpleNamespace

from app.services.openai_service import CallingMode
from app.services.provider_gateway.openai_compat import (
    _ClosableEventStream,
    _DSML_OPENER,
    _strip_deepseek_tool_markup,
)


def _feed(chunks):
    """Drive the pure filter across a list of content chunks; return joined visible."""
    pending, leaking, out = "", False, []
    for c in chunks:
        vis, pending, leaking = _strip_deepseek_tool_markup(c, pending, leaking)
        out.append(vis)
    return "".join(out)


def test_opener_constant_is_fullwidth_pipe():
    # U+FF5C fullwidth vertical bar, not ASCII '|'.
    assert _DSML_OPENER == "<｜｜DSML｜｜"
    assert "|" not in _DSML_OPENER


def test_clean_content_passes_through_unchanged():
    assert _feed(["Hi there! ", "How can I help?"]) == "Hi there! How can I help?"


def test_pure_markup_is_fully_suppressed():
    markup = _DSML_OPENER + 'tool_calls>\n<invoke name="execute_code">...'
    assert _feed([markup]) == ""


def test_prose_before_opener_is_preserved():
    text = "Let me generate that.\n\n" + _DSML_OPENER + "tool_calls>\nimport os"
    assert _feed([text]) == "Let me generate that.\n\n"


def test_leaking_state_drops_all_subsequent_chunks():
    first = "ok " + _DSML_OPENER + "tool_calls>"
    assert _feed([first, "\nmore markup", "even more"]) == "ok "


def test_opener_split_across_chunks_is_caught():
    # DeepSeek can stream the opener across chunk boundaries. The pending buffer must
    # hold the partial prefix and still suppress the block.
    half = len(_DSML_OPENER) // 2
    piece_a = "prefix" + _DSML_OPENER[:half]
    piece_b = _DSML_OPENER[half:] + "tool_calls>garbage"
    assert _feed([piece_a, piece_b]) == "prefix"


def test_partial_prefix_tail_is_held_not_emitted_midstream():
    # A chunk ending in '<' (a possible opener start) holds that tail rather than
    # emitting it, so it can combine with the next chunk.
    vis1, pending1, leaking1 = _strip_deepseek_tool_markup("abc<", "", False)
    assert vis1 == "abc"
    assert pending1 == "<"
    assert leaking1 is False
    # Next chunk reveals it was NOT the opener → the held '<x' flushes as normal text.
    vis2, pending2, leaking2 = _strip_deepseek_tool_markup("x def", pending1, leaking1)
    assert vis2 == "<x def"
    assert pending2 == ""
    assert leaking2 is False


def test_ascii_pipe_lookalike_does_not_trigger():
    # A message that happens to contain ASCII pipes must NOT be suppressed.
    text = "run `cat a | grep b` and <DSML> stays too"
    assert _feed([text]) == text


# --- Stream-end flush (XPROV-02a, Phase 175) ----------------------------------
# The pure _feed cases above prove the per-chunk strip. These drive the full
# _normalize generator (the real stream-end path) to prove the trailing
# _dsml_pending fragment is flushed — and that the SC#2 floor still holds.


def _fake_chunk(content=None, finish_reason=None, usage=None):
    """A minimal OpenAI-SDK-shaped streaming chunk for driving _normalize."""
    delta = SimpleNamespace(content=content, reasoning_content=None, tool_calls=None)
    choice = SimpleNamespace(delta=delta, finish_reason=finish_reason)
    return SimpleNamespace(choices=[choice], usage=usage)


def _drive(chunks, provider="deepseek"):
    """Run the full _normalize path over fake raw chunks; return the event dicts."""
    stream = _ClosableEventStream(chunks, provider, CallingMode.NATIVE)
    return list(stream)


def test_stream_end_flushes_trailing_partial_opener_fragment():
    # A deepseek turn whose final visible chunk is a partial-opener PREFIX ("<｜",
    # non-leaking) holds that fragment in _dsml_pending mid-stream. At stream end it
    # MUST be flushed as a final delta so content is not silently swallowed.
    partial = _DSML_OPENER[:2]  # "<｜" — a real prefix of the opener, never the full opener
    events = _drive([_fake_chunk("hello "), _fake_chunk(partial)])
    deltas = [e["content"] for e in events if e["type"] == "delta"]
    assert deltas == ["hello ", partial]


def test_stream_end_does_not_flush_when_leaking():
    # A deepseek turn still leaking at stream end (opener already seen) MUST flush
    # nothing — the markup stays suppressed (the SC#2 no-dirty-render floor).
    leak_chunk = "ok " + _DSML_OPENER + "tool_calls>"
    events = _drive([_fake_chunk(leak_chunk), _fake_chunk("\ntrailing markup")])
    deltas = [e["content"] for e in events if e["type"] == "delta"]
    assert deltas == ["ok "]


def test_stream_end_flush_long_turn_floor_holds():
    # Long deepseek turn: many clean chunks, THEN the opener mid-stream. Prose before
    # the opener is preserved; the opener + everything after is suppressed; nothing is
    # flushed at end (leaking).
    chunks = [_fake_chunk(f"line {i} ") for i in range(30)]
    chunks.append(_fake_chunk("tail " + _DSML_OPENER + "tool_calls>x"))
    chunks.append(_fake_chunk(" more suppressed"))
    events = _drive(chunks)
    joined = "".join(e["content"] for e in events if e["type"] == "delta")
    assert joined == "".join(f"line {i} " for i in range(30)) + "tail "
    assert _DSML_OPENER not in joined


def test_non_deepseek_never_flushes_and_is_byte_identical():
    # Non-deepseek provider: the DSML strip branch is never entered, so a chunk that
    # merely LOOKS like a partial opener passes through verbatim and nothing is held
    # or flushed at stream end (D-14 default-inert).
    partial = _DSML_OPENER[:2]
    events = _drive([_fake_chunk("hi "), _fake_chunk(partial)], provider="openai")
    deltas = [e["content"] for e in events if e["type"] == "delta"]
    assert deltas == ["hi ", partial]
