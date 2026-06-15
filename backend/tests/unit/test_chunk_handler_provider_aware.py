"""Unit tests for Phase 075.3 Plan 01 — provider-aware OpenAI-compat streaming
chunk handler usage accumulator.

Covers D-075.3-03 / D-075.3-04 / D-075.3-15 / D-075.3-16.

Probe verdict (D-075.3-01 locked 2026-05-22 in 075.3-01-PLAN.md <probe_result>):
    CUMULATIVE — Google's OpenAI-compat layer emits ``chunk.usage`` as a
    cumulative running total on every chunk. The Google branch overwrites
    the running total (last-wins). OpenAI/OpenRouter still sum via ``+=``
    (their usage emission is final-chunk-only per Phase 073 D-073-08).

The helper-under-test is the module-level pure function
``app.services.provider_gateway.openai_compat._accumulate_chunk_usage(chunk,
provider, input_total, output_total) -> tuple[int | None, int | None]``.

Phase 092.5 Wave 4 (D-04): the helper MOVED with the entangled OpenAI-compat
adapter — from ``app.api.threads`` (075.3) → ``app.services.agent_loop`` (089) →
``app.services.provider_gateway.openai_compat`` (092.5). The Google-vs-OpenAI
assertions below ARE the I8 usage-accounting guard; they pass unchanged because
the fn moved VERBATIM (both branches byte-for-byte).
"""
from __future__ import annotations

from types import SimpleNamespace

import pytest

# Helper under test — imported lazily inside ``_call()`` (kept from the 075.3
# scaffold idiom; harmless now that the symbol exists). Phase 092.5 Wave 4
# repointed the import to the OpenAI-compat adapter's new home.


def _call(chunk, provider, input_total, output_total):
    """Lazy-import wrapper. Resolves ``_accumulate_chunk_usage`` from its
    Phase 092.5 home (``app.services.provider_gateway.openai_compat``) and
    forwards arguments verbatim.
    """
    from app.services.provider_gateway.openai_compat import _accumulate_chunk_usage  # noqa: PLC0415
    return _accumulate_chunk_usage(chunk, provider, input_total, output_total)


# ── Fixture factory ───────────────────────────────────────────────────────
#
# Mirrors the project-canonical SimpleNamespace mock idiom (see RESEARCH.md
# §8.1 lines 480-492). Each ``_mk_chunk`` call returns a synthetic openai-
# python ``ChatCompletionChunk``-shaped object with the precise attribute
# graph the helper inspects:
#
#   chunk.choices  → list (empty list = "usage-only chunk")
#   chunk.choices[0].delta.content      (str | None)
#   chunk.choices[0].delta.tool_calls   (None for these tests — tool_calls
#                                        are exercised in handler-integration
#                                        tests, not the pure accumulator)
#   chunk.choices[0].finish_reason       (str | None)
#   chunk.usage.prompt_tokens            (int | None — None = no usage)
#   chunk.usage.completion_tokens        (int | None)
def _mk_chunk(
    content: str | None = None,
    prompt_tokens: int | None = None,
    completion_tokens: int | None = None,
    finish_reason: str | None = None,
    has_choice: bool | None = None,
):
    """Build a synthetic ChatCompletionChunk-shaped object.

    Parameters
    ----------
    content : assistant content delta (None = no content)
    prompt_tokens / completion_tokens : populate chunk.usage if either is not None
    finish_reason : populate choice.finish_reason
    has_choice : override for explicit empty-choices control. If None (default),
        defaults to True if content is non-None OR finish_reason is non-None,
        else False (i.e. usage-only chunk).
    """
    delta = SimpleNamespace(content=content, tool_calls=None)
    if has_choice is None:
        has_choice = content is not None or finish_reason is not None
    if has_choice:
        choices = [SimpleNamespace(delta=delta, finish_reason=finish_reason)]
    else:
        choices = []
    if prompt_tokens is None and completion_tokens is None:
        usage = None
    else:
        usage = SimpleNamespace(
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
        )
    return SimpleNamespace(choices=choices, usage=usage)


def _drive(chunks, provider: str) -> tuple[int | None, int | None]:
    """Drive the helper across a sequence of chunks, threading state."""
    i_total: int | None = None
    o_total: int | None = None
    for c in chunks:
        i_total, o_total = _call(c, provider, i_total, o_total)
    return i_total, o_total


# ── Test 1: Google cumulative — overwrite-last-wins ────────────────────────
def test_google_cumulative_chunks_overwrite_last_wins():
    """D-075.3-01 probe-locked: Google emits chunk.usage as cumulative running
    totals on EVERY chunk. The Google branch overwrites (last-wins), NOT ``+=``.

    Per CUMULATIVE verdict in <probe_result> (2026-05-22):
      stream [(c="Hi", p=10, c=1), (c="!", p=10, c=2, finish="stop")]
      expected final state = (10, 2) — NOT (20, 3) which would be ``+=``.
    """
    chunks = [
        _mk_chunk(content="Hi", prompt_tokens=10, completion_tokens=1),
        _mk_chunk(content="!", prompt_tokens=10, completion_tokens=2, finish_reason="stop"),
    ]
    assert _drive(chunks, "google") == (10, 2), (
        "Google branch must overwrite-last-wins (cumulative). Got `+=` behavior "
        "instead — re-check _accumulate_chunk_usage Google branch against the "
        "<probe_result> CUMULATIVE verdict."
    )


# ── Test 2: Google chunks with BOTH usage AND content — content not dropped ─
def test_google_chunks_with_both_usage_and_content_not_dropped():
    """D-075.3-04: the early-return on ``chunk.usage`` at the old
    ``_on_chunk_openai`` line 1816 dropped delta.content whenever a Google
    chunk carried usage alongside content. The defensive handler must flow
    through to delta processing.

    The PURE helper has no content-handling responsibility (that's the
    closure's job), so here we assert only that the accumulator does not
    raise/short-circuit when content is present on the same chunk. The
    handler-integration test (covered manually via Chrome MCP UAT Task 5)
    is the end-to-end witness.
    """
    chunks = [
        _mk_chunk(content="Hi", prompt_tokens=10, completion_tokens=1),
        _mk_chunk(content="!", prompt_tokens=10, completion_tokens=2, finish_reason="stop"),
    ]
    # No exception raised + tokens accumulate correctly (overwrite branch)
    assert _drive(chunks, "google") == (10, 2)
    # Verify the chunks themselves carry both content AND usage (precondition)
    assert chunks[0].choices[0].delta.content == "Hi"
    assert chunks[0].usage is not None
    assert chunks[1].choices[0].delta.content == "!"
    assert chunks[1].usage is not None


# ── Test 3: OpenAI final-chunk-only usage — accumulate via += ──────────────
def test_openai_final_chunk_only_usage_accumulates():
    """OpenAI emits ``chunk.usage`` ONLY on the trailing chunk with
    ``choices=[]`` (Phase 073 D-073-08). The OpenAI branch sums via ``+=``.

    For a single final-chunk emission, ``+=`` from None-init yields the
    final values directly (input=20, output=5). Mid-stream chunks carry
    no usage; they pass through unchanged.
    """
    chunks = [
        _mk_chunk(content="Hello"),                              # no usage
        _mk_chunk(content=" world"),                             # no usage
        _mk_chunk(prompt_tokens=20, completion_tokens=5),        # final: choices=[]
    ]
    assert _drive(chunks, "openai") == (20, 5)


# ── Test 4: OpenRouter — same += branch (forward-compat per Pitfall 8) ─────
def test_openrouter_uses_plus_equals():
    """OpenRouter is forward-compatible per Pitfall 8 (deprecation 2026 —
    always returns usage). If a stray mid-stream usage chunk ever appears
    alongside the final emission, ``+=`` must sum them correctly.

    Stream: [(c="A", p=5, c=1), (c="B"), (final p=10, c=3, finish="stop")]
    Expected: (15, 4) = 5+10 / 1+3.
    """
    chunks = [
        _mk_chunk(content="A", prompt_tokens=5, completion_tokens=1),
        _mk_chunk(content="B"),
        _mk_chunk(prompt_tokens=10, completion_tokens=3, finish_reason="stop"),
    ]
    assert _drive(chunks, "openrouter") == (15, 4)


# ── Test 5: usage-only chunk (no choices) — no crash, tokens recorded ──────
def test_chunk_with_usage_only_no_choices_does_not_crash():
    """D-075.3-04 safety: a chunk with ``usage`` populated and ``choices=[]``
    (OpenAI's final-chunk shape) must NOT raise and MUST record tokens.

    The pure helper handles this directly — usage extraction does not depend
    on ``choices``. The handler's downstream ``if not chunk.choices: return``
    guards the delta processing.
    """
    chunk = _mk_chunk(prompt_tokens=10, completion_tokens=2, has_choice=False)
    assert chunk.choices == []
    assert chunk.usage is not None
    # Google branch: overwrite (10, 2)
    assert _call(chunk, "google", None, None) == (10, 2)
    # OpenAI branch from None: also (10, 2) — first usage chunk initialises totals
    assert _call(chunk, "openai", None, None) == (10, 2)


# ── Test 6: choices but no usage — state unchanged ──────────────────────────
def test_chunk_with_choices_but_no_usage_only_processes_delta():
    """A normal content-bearing chunk with no usage must leave the running
    totals untouched (None / 0) and must not crash. The pure helper returns
    its inputs unchanged.
    """
    chunk = _mk_chunk(content="X")
    assert chunk.usage is None
    assert _call(chunk, "openai", None, None) == (None, None)
    assert _call(chunk, "google", 7, 3) == (7, 3)
    assert _call(chunk, "openrouter", 7, 3) == (7, 3)


# ── Test 7: unknown provider — falls through to += (safe default) ──────────
def test_unknown_provider_defaults_to_accumulate_plus_equals():
    """Cumulative-overwrite is Google-ONLY. Every other provider name
    (unknown / ollama / empty / anthropic / made-up) falls through to the
    ``+=`` branch — safe default matching OpenAI's final-chunk-only
    emission shape.

    Stream of 2 final-shape chunks (rare, but mathematically diagnostic):
      [(p=5, c=2), (p=7, c=4)] → expect (12, 6) via ``+=``, NOT (7, 4) overwrite.

    Looped inside one test (instead of @pytest.mark.parametrize) so the
    test count stays at exactly 7 per Plan 01 acceptance criteria.
    """
    chunks = [
        _mk_chunk(prompt_tokens=5, completion_tokens=2),
        _mk_chunk(prompt_tokens=7, completion_tokens=4),
    ]
    for provider in ("unknown", "ollama", "", "anthropic", "custom-provider"):
        assert _drive(chunks, provider) == (12, 6), (
            f"provider={provider!r} must fall through to += "
            "(not Google's overwrite branch)"
        )
