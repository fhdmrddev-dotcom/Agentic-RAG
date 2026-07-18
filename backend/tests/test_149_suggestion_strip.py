"""Phase 149 Plan 12 — regression: strip <think> blocks before the suggestion parse.

Round-2 UAT Test 7 (D-149-10 fallback path): after a disabled-model fallback served
the reply via MiniMax (a compat-path reasoning model), the follow-up suggestion chips
rendered raw `<think>` chain-of-thought — each think line became a question chip and the
real questions were pushed out of the 3-item clamp.

`suggestion_service.generate_suggestions` parses the raw completion line-by-line with no
think/reasoning stripping. Reasoning models served via the compat path emit
`<think>...</think>` inline in `message.content` (MiniMax/DeepSeek/GLM); the streaming chat
path separates reasoning via the compat adapter's `<think>` state machine, but the
non-streaming suggestion call bypasses that separation.

These tests lock: think blocks (closed + unclosed trailing) are stripped BEFORE the
split/clamp, so only clean questions survive; the no-think path is byte-identical.
"""
from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest


# ---------------------------------------------------------------------------
# Helpers (mirror tests/unit/test_suggestions.py mocking convention)
# ---------------------------------------------------------------------------

def _make_completion(text: str):
    """Minimal mock completion with choices[0].message.content == text."""
    mock_resp = MagicMock()
    mock_resp.choices[0].message.content = text
    return mock_resp


def _make_mock_client(text: str):
    """Mock client whose chat.completions.create returns a completion with text.

    create() returns normally, so the NotFoundError fallback-retry path is never taken.
    """
    mock_client = MagicMock()
    mock_client.chat.completions.create.return_value = _make_completion(text)
    return mock_client


def _run(text: str):
    mock_client = _make_mock_client(text)
    with patch("app.services.suggestion_service.get_llm_client", return_value=mock_client):
        from app.services.suggestion_service import generate_suggestions
        # user_settings=None avoids the NotFoundError path (create() returns normally).
        return generate_suggestions(
            user_message="How do I ship this?",
            assistant_response="Promote develop to production surgically.",
            user_settings=None,
        )


# ---------------------------------------------------------------------------
# Test A — the reproduced Test-7 leak (MiniMax-style inline <think>)
# ---------------------------------------------------------------------------

def test_a_minimax_think_block_stripped_only_clean_questions():
    """A closed <think>...</think> reasoning block emitted inline by a compat-path
    reasoning model is stripped; the 3 clean questions after it are returned, and NO
    chip contains `<think>` or a chain-of-thought sentence."""
    content = (
        "<think>\n"
        "The user asked about deployment. Let me consider the branches.\n"
        "I should suggest env parity next.\n"
        "</think>\n"
        "How do I promote develop to production?\n"
        "Where are the pending cloud migrations listed?\n"
        "What env vars must match between local and cloud?"
    )
    questions, fallback = _run(content)

    assert questions == [
        "How do I promote develop to production?",
        "Where are the pending cloud migrations listed?",
        "What env vars must match between local and cloud?",
    ]
    # No reasoning markup or chain-of-thought leaked into any chip.
    for q in questions:
        assert "<think>" not in q.lower()
        assert "</think>" not in q.lower()
        assert "The user asked about deployment" not in q
        assert "I should suggest env parity next" not in q
    assert fallback is None


# ---------------------------------------------------------------------------
# Test B — no-think byte-identical (no regression to the normal chip flow)
# ---------------------------------------------------------------------------

def test_b_no_think_byte_identical():
    """A clean completion of 3 plain question lines is returned unchanged — stripping a
    completion with no `<think>` markup must be a no-op (byte-identical)."""
    content = (
        "What are the main findings?\n"
        "How does this compare to last year?\n"
        "What actions should be taken?"
    )
    questions, fallback = _run(content)

    assert questions == [
        "What are the main findings?",
        "How does this compare to last year?",
        "What actions should be taken?",
    ]
    assert fallback is None


# ---------------------------------------------------------------------------
# Test C — unclosed trailing <think> (reasoning ran out of budget)
# ---------------------------------------------------------------------------

def test_c_unclosed_trailing_think_stripped():
    """A completion whose tail is an unclosed `<think>` (reasoning that ran out of
    budget mid-thought) has the trailing think stripped; the clean question survives and
    no reasoning fragment leaks."""
    content = (
        "How do I promote develop to production?\n"
        "<think>\n"
        "partial reasoning that ran out of budget"
    )
    questions, fallback = _run(content)

    assert questions == ["How do I promote develop to production?"]
    for q in questions:
        assert "<think>" not in q.lower()
        assert "partial reasoning" not in q
    assert fallback is None


# ---------------------------------------------------------------------------
# Test D — think lines would fill the clamp and drop the real questions
# ---------------------------------------------------------------------------

def test_d_think_stripped_before_clamp_to_3():
    """The think block's lines, if counted, would fill the 3-item clamp and drop the
    real questions. After stripping (BEFORE the clamp), the 3 real questions are
    returned — proving the strip happens before clamp-to-3."""
    content = (
        "<think>\n"
        "reasoning line one\n"
        "reasoning line two\n"
        "reasoning line three\n"
        "</think>\n"
        "Real question one?\n"
        "Real question two?\n"
        "Real question three?"
    )
    questions, fallback = _run(content)

    assert questions == [
        "Real question one?",
        "Real question two?",
        "Real question three?",
    ]
    for q in questions:
        assert "reasoning line" not in q
        assert "<think>" not in q.lower()
    assert fallback is None


if __name__ == "__main__":  # pragma: no cover
    pytest.main([__file__, "-v"])
