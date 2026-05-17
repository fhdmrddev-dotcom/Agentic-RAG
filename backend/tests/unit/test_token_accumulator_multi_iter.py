"""Phase 073 unit tests — multi-iteration token accumulator SUM (D-073-07).

The agent loop iterates multiple LLM calls per run (think -> tool -> think ->
respond -> ...). runs.input_tokens / runs.output_tokens is the SUM across all
iterations, NOT any single call's value.

These tests drive the accumulator across two iterations to lock the SUM
semantics. Plan 04 inherits this contract when it wires the accumulator
slots into the agent_runner closure.
"""

from types import SimpleNamespace
from typing import Optional

# Inline the same handler shapes as test_token_accumulator_openai.py +
# test_token_accumulator_anthropic.py. (Keeping each test file self-contained
# means failures are localized.)


def accumulate_openai(chunk, input_total: Optional[int], output_total: Optional[int]):
    if getattr(chunk, "usage", None) is not None:
        u = chunk.usage
        in_t = getattr(u, "prompt_tokens", 0) or 0
        out_t = getattr(u, "completion_tokens", 0) or 0
        if input_total is None:
            return (in_t, out_t)
        return (input_total + in_t, output_total + out_t)
    return (input_total, output_total)


def accumulate_anthropic(event: dict, input_total: Optional[int], output_total: Optional[int]):
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
            return (input_total, o)
        return (input_total, output_total + o)
    return (input_total, output_total)


def _trailing_openai(p: int, c: int):
    return SimpleNamespace(
        usage=SimpleNamespace(prompt_tokens=p, completion_tokens=c),
        choices=[],
    )


def test_multi_iteration_sum_openai():
    """Iter 1: (100, 50). Iter 2: (150, 80). Final: (250, 130). D-073-07."""
    input_total = output_total = None

    # Iteration 1
    input_total, output_total = accumulate_openai(_trailing_openai(100, 50), input_total, output_total)
    # Iteration 2
    input_total, output_total = accumulate_openai(_trailing_openai(150, 80), input_total, output_total)

    assert input_total == 250
    assert output_total == 130


def test_multi_iteration_mixed_providers():
    """Iter 1 (OpenAI): (100, 50). Iter 2 (Anthropic): (200, 75). Final: (300, 125)."""
    input_total = output_total = None

    # Iteration 1: OpenAI
    input_total, output_total = accumulate_openai(_trailing_openai(100, 50), input_total, output_total)

    # Iteration 2: Anthropic — usage event (input=200, output=0) + usage_delta (output=75)
    input_total, output_total = accumulate_anthropic(
        {"type": "usage", "input_tokens": 200, "output_tokens": 0},
        input_total, output_total,
    )
    input_total, output_total = accumulate_anthropic(
        {"type": "usage_delta", "output_tokens": 75},
        input_total, output_total,
    )

    assert input_total == 300  # 100 + 200
    assert output_total == 125  # 50 + 0 + 75
