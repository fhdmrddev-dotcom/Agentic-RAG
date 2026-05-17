"""Phase 073 unit tests — OpenAI on-chunk usage accumulator (TOKEN-COL-01).

The accumulator body here is the SAME shape that Plan 04 inlines into
threads.py::_on_chunk_openai as a nonlocal closure. Keeping it isolated as
a top-level helper here lets us test the semantics without depending on
the agent-loop scaffolding.

Pitfall 2 mitigation built-in: every "happy path" mock must include a
trailing chunk with chunk.choices=[] and populated usage. A 4-chunk-only
fixture (no trailing usage) is the explicit interrupted-stream case
(D-073-09 NULL sentinel).
"""

from types import SimpleNamespace
from typing import Optional, Tuple

import pytest


def accumulate_openai(
    chunk,
    input_total: Optional[int],
    output_total: Optional[int],
) -> Tuple[Optional[int], Optional[int]]:
    """Mirror of the closure body Plan 04 will inline into _on_chunk_openai.

    Trailing usage chunk: chunk.choices=[] + populated chunk.usage.
    All other chunks: chunk.usage is None.
    """
    if getattr(chunk, "usage", None) is not None:
        u = chunk.usage
        in_t = getattr(u, "prompt_tokens", 0) or 0
        out_t = getattr(u, "completion_tokens", 0) or 0
        if input_total is None:
            return (in_t, out_t)
        return (input_total + in_t, output_total + out_t)
    return (input_total, output_total)


def _normal_chunk(content: str):
    """Build a fake openai chunk with usage=None + non-empty choices."""
    return SimpleNamespace(
        usage=None,
        choices=[SimpleNamespace(delta=SimpleNamespace(content=content))],
    )


def _trailing_usage_chunk(prompt_tokens: int, completion_tokens: int):
    """Build a fake openai trailing chunk: usage populated, choices=[]."""
    return SimpleNamespace(
        usage=SimpleNamespace(
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
        ),
        choices=[],
    )


def test_openai_trailing_usage_chunk():
    """Happy path: 4 normal chunks + 1 trailing usage chunk -> accumulator captures (100, 50)."""
    input_total = output_total = None
    chunks = [_normal_chunk(c) for c in ("Hello", " ", "world", "!")] + [
        _trailing_usage_chunk(prompt_tokens=100, completion_tokens=50)
    ]
    for chunk in chunks:
        input_total, output_total = accumulate_openai(chunk, input_total, output_total)
    assert (input_total, output_total) == (100, 50)


def test_openai_no_usage_chunk_leaves_none():
    """Interrupted stream (Pitfall 3): no trailing usage chunk -> accumulator stays None (D-073-09)."""
    input_total = output_total = None
    chunks = [_normal_chunk(c) for c in ("Hello", "world")]
    for chunk in chunks:
        input_total, output_total = accumulate_openai(chunk, input_total, output_total)
    assert (input_total, output_total) == (None, None)


def test_openai_chunk_with_zero_usage():
    """Zero usage is a real value, not missing. (0, 0) != (None, None)."""
    input_total = output_total = None
    chunks = [_normal_chunk("x"), _trailing_usage_chunk(0, 0)]
    for chunk in chunks:
        input_total, output_total = accumulate_openai(chunk, input_total, output_total)
    assert (input_total, output_total) == (0, 0)
    assert input_total is not None  # tiebreak: NOT NULL
