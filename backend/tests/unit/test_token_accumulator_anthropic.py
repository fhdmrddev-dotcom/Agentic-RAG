"""Phase 073 unit tests — Anthropic on-chunk usage accumulator (TOKEN-COL-01).

Mirrors the closure body Plan 04 will inline into threads.py::_on_chunk_anthropic.
Anthropic emits TWO distinct usage events per Message:
  - "usage" (from message_start): input_tokens + initial output_tokens (0)
  - "usage_delta" (from message_delta): FINAL CUMULATIVE output_tokens for THAT Message

Pitfall 9: usage_delta.output_tokens is the final cumulative count for the
just-completed Message, NOT a per-event delta. Naive treatment of "delta"
in the name would double-count.
"""

from typing import Optional, Tuple

import pytest


def accumulate_anthropic(
    event: dict,
    input_total: Optional[int],
    output_total: Optional[int],
) -> Tuple[Optional[int], Optional[int]]:
    """Mirror of the closure body Plan 04 will inline into _on_chunk_anthropic.

    Consumes the {"type": "usage" | "usage_delta" | ...} events yielded by
    stream_anthropic (Task 2). Non-usage events leave the accumulator unchanged.
    """
    etype = event.get("type")
    if etype == "usage":
        i = event.get("input_tokens", 0) or 0
        o = event.get("output_tokens", 0) or 0
        if input_total is None:
            return (i, o)
        return (input_total + i, output_total + o)
    elif etype == "usage_delta":
        o = event.get("output_tokens", 0) or 0
        if output_total is None:
            # rare: usage_delta without prior message_start (e.g., partial stream)
            return (input_total, o)
        return (input_total, output_total + o)
    return (input_total, output_total)


def test_anthropic_message_start_then_delta():
    """Happy path: message_start (input=200, output=0) -> content -> message_delta (output=75).

    Final accumulator: input_tokens=200, output_tokens=75 (output_total = 0 + 75).
    """
    input_total = output_total = None
    events = [
        {"type": "usage", "input_tokens": 200, "output_tokens": 0},
        {"type": "delta", "content": "Hello"},
        {"type": "delta", "content": " world"},
        {"type": "usage_delta", "output_tokens": 75},
    ]
    for event in events:
        input_total, output_total = accumulate_anthropic(event, input_total, output_total)
    assert input_total == 200
    assert output_total == 75


def test_anthropic_only_message_start_no_delta():
    """Stream cancelled before message_delta: only message_start fired.

    Result: (input_tokens=N, output_tokens=0) — both non-None even though
    no usage_delta arrived. This case is valid (non-NULL telemetry available).
    """
    input_total = output_total = None
    events = [
        {"type": "usage", "input_tokens": 150, "output_tokens": 0},
        {"type": "delta", "content": "partial..."},
    ]
    for event in events:
        input_total, output_total = accumulate_anthropic(event, input_total, output_total)
    assert input_total == 150
    assert output_total == 0


def test_anthropic_non_usage_events_pass_through():
    """Non-usage events leave the accumulator unchanged at (None, None)."""
    input_total = output_total = None
    events = [
        {"type": "delta", "content": "hi"},
        {"type": "tool_start", "name": "search"},
    ]
    for event in events:
        input_total, output_total = accumulate_anthropic(event, input_total, output_total)
    assert (input_total, output_total) == (None, None)


def test_anthropic_pitfall_9_no_double_count():
    """Pitfall 9 regression: usage_delta.output_tokens is CUMULATIVE for that Message.

    If naively treated as a per-event delta and added to a running total, the
    accumulator would overshoot. Our shape ADDS the cumulative count once per
    Message (one usage_delta per Message), so output_total grows by the final
    message_delta.usage.output_tokens value of each Message.

    This test exercises ONE Message; Plan 04's multi-iteration test exercises
    the SUM across Messages.
    """
    input_total = output_total = None
    events = [
        {"type": "usage", "input_tokens": 100, "output_tokens": 0},
        # Anthropic only emits ONE usage_delta per Message (the final one
        # with stop_reason). If the SDK ever emits multiple usage_deltas
        # within a single Message, our accumulator would double-count —
        # but the SDK doesn't (verified per Pitfall 9 sources).
        {"type": "usage_delta", "output_tokens": 60},
    ]
    for event in events:
        input_total, output_total = accumulate_anthropic(event, input_total, output_total)
    # Expected output_total = 0 (from message_start) + 60 (from usage_delta) = 60
    # NOT 0 + 60 + 60 = 120 (which would be the double-count pathology)
    assert output_total == 60
