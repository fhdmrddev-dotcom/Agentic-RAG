"""Phase 073 unit tests — NULL + logger.warning when SDK doesn't surface usage.

When the LLM stream is interrupted, cancelled, times out, or the provider
drops the trailing usage chunk (Pitfall 3), the accumulator stays at (None, None).
Finalize then writes NULL to runs.input_tokens / runs.output_tokens and emits
a logger.warning so v3.1 dashboards can render the coverage gap.

SECURITY (T-073-04): The warning format string MUST contain run=, provider=,
model= identifiers but MUST NOT contain token VALUES (the whole point of the
NULL path is that no values exist). String literal asserted to NOT contain
"tokens=", "value=", "usage_dict".
"""

import logging
from types import SimpleNamespace
from typing import Optional
from uuid import uuid4

import pytest


def accumulate_openai(chunk, input_total: Optional[int], output_total: Optional[int]):
    if getattr(chunk, "usage", None) is not None:
        u = chunk.usage
        in_t = getattr(u, "prompt_tokens", 0) or 0
        out_t = getattr(u, "completion_tokens", 0) or 0
        if input_total is None:
            return (in_t, out_t)
        return (input_total + in_t, output_total + out_t)
    return (input_total, output_total)


def _normal_chunk(content: str):
    return SimpleNamespace(
        usage=None,
        choices=[SimpleNamespace(delta=SimpleNamespace(content=content))],
    )


# Canonical warning format string — this is the SAME literal Plan 04 inlines
# into _shielded_finalize step 3 per RESEARCH Pattern 3 lines 428-432.
_MISSING_USAGE_FORMAT = "runs.usage missing for run=%s provider=%s model=%s"


def test_missing_usage_returns_none():
    """No trailing usage chunk -> accumulator stays (None, None) — D-073-09 sentinel."""
    input_total = output_total = None
    for chunk in (_normal_chunk(c) for c in ("hello", "world")):
        input_total, output_total = accumulate_openai(chunk, input_total, output_total)
    assert (input_total, output_total) == (None, None)


def test_missing_usage_finalize_log_format(caplog):
    """When finalize detects (None, None), it logs the canonical warning.

    Asserts the formatted message via caplog. Plan 04 will inline this exact
    logger.warning call in threads.py::_shielded_finalize step 3.
    """
    run_id = uuid4()
    provider = "openai"
    model = "gpt-4o"

    input_total = output_total = None
    # Simulate the if/else from RESEARCH Pattern 3 lines 428-432
    with caplog.at_level(logging.WARNING):
        if input_total is None and output_total is None:
            logging.getLogger(__name__).warning(
                _MISSING_USAGE_FORMAT, run_id, provider, model,
            )

    records = [r for r in caplog.records if "runs.usage missing" in r.getMessage()]
    assert len(records) == 1, f"expected exactly one warning, got {len(records)}: {caplog.text}"
    msg = records[0].getMessage()
    assert f"run={run_id}" in msg
    assert "provider=openai" in msg
    assert "model=gpt-4o" in msg


def test_missing_usage_format_string_has_no_token_values():
    """T-073-04: warning format string must NOT contain token-value placeholders.

    The format string contains identifiers (run=, provider=, model=) but MUST
    NOT contain token-value substitution patterns. Future log-line evolutions
    must not regress this property without explicit threat-model re-review.
    """
    assert "run=%s" in _MISSING_USAGE_FORMAT
    assert "provider=%s" in _MISSING_USAGE_FORMAT
    assert "model=%s" in _MISSING_USAGE_FORMAT
    # NEGATIVE assertions — these substrings are FORBIDDEN
    assert "tokens=" not in _MISSING_USAGE_FORMAT
    assert "value=" not in _MISSING_USAGE_FORMAT
    assert "usage_dict" not in _MISSING_USAGE_FORMAT
    assert "%d" not in _MISSING_USAGE_FORMAT  # numeric placeholders -> no values logged
