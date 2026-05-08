"""Unit tests for Phase 32-01: Suggestion Service.

Tests:
1. test_generate_suggestions_returns_list — mock returns 3 lines, assert list of 3 strings
2. test_generate_suggestions_clamps_to_3 — mock returns 5 lines, assert exactly 3 items
3. test_generate_suggestions_empty_lines_filtered — mock returns text with blank lines, assert filtered
4. test_generate_suggestions_uses_sub_agent_model_override — settings.sub_agent_model wins
5. test_generate_suggestions_uses_provider_default — openai provider uses gpt-5.4-nano
6. test_generate_suggestions_raises_propagated — client raises, exception propagates
"""
from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_user_settings(provider: str = "openai", llm_model: str = "gpt-4o"):
    us = MagicMock()
    us.active_provider = provider
    us.llm_model = llm_model
    us.sub_agent_model = ""  # no override so provider default is used
    return us


def _make_completion(text: str):
    """Build a minimal mock completion object with choices[0].message.content."""
    mock_resp = MagicMock()
    mock_resp.choices[0].message.content = text
    return mock_resp


def _make_mock_client(text: str):
    """Return a mock client whose chat.completions.create returns a completion with text."""
    mock_client = MagicMock()
    mock_client.chat.completions.create.return_value = _make_completion(text)
    return mock_client


# ---------------------------------------------------------------------------
# Test 1: returns list of 3 strings
# ---------------------------------------------------------------------------

def test_generate_suggestions_returns_list():
    """Mock returns 3 lines of text. Assert result is a list of 3 strings."""
    text = "What are the main findings?\nHow does this compare to last year?\nWhat actions should be taken?"
    mock_client = _make_mock_client(text)

    with patch("app.services.suggestion_service.get_llm_client", return_value=mock_client):
        from app.services.suggestion_service import generate_suggestions
        result = generate_suggestions(
            user_message="Tell me about the report",
            assistant_response="The report shows revenue grew by 20%.",
        )

    questions, fallback = result
    assert isinstance(questions, list)
    assert len(questions) == 3
    assert all(isinstance(q, str) and q for q in questions)


# ---------------------------------------------------------------------------
# Test 2: clamps to 3 when model returns more lines
# ---------------------------------------------------------------------------

def test_generate_suggestions_clamps_to_3():
    """Mock returns 5 lines. Assert result has exactly 3 items."""
    text = "Question one?\nQuestion two?\nQuestion three?\nQuestion four?\nQuestion five?"
    mock_client = _make_mock_client(text)

    with patch("app.services.suggestion_service.get_llm_client", return_value=mock_client):
        from app.services.suggestion_service import generate_suggestions
        result = generate_suggestions(
            user_message="Tell me more",
            assistant_response="Here is a detailed response.",
        )

    questions, _ = result
    assert len(questions) == 3


# ---------------------------------------------------------------------------
# Test 3: blank lines are filtered
# ---------------------------------------------------------------------------

def test_generate_suggestions_empty_lines_filtered():
    """Mock returns text with blank lines. Assert blank lines excluded."""
    text = "First question?\n\nSecond question?\n\nThird question?\n"
    mock_client = _make_mock_client(text)

    with patch("app.services.suggestion_service.get_llm_client", return_value=mock_client):
        from app.services.suggestion_service import generate_suggestions
        result = generate_suggestions(
            user_message="Hi",
            assistant_response="Hello",
        )

    questions, _ = result
    assert len(questions) == 3
    assert all(q.strip() for q in questions)


# ---------------------------------------------------------------------------
# Test 4: SUB_AGENT_MODEL env override wins
# ---------------------------------------------------------------------------

def test_generate_suggestions_uses_sub_agent_model_override():
    """Set settings.sub_agent_model = 'custom-model', verify create called with that model."""
    mock_client = _make_mock_client("Q1?\nQ2?\nQ3?")

    with patch("app.services.suggestion_service.get_llm_client", return_value=mock_client), \
         patch("app.services.suggestion_service.settings") as mock_settings:
        mock_settings.sub_agent_model = "custom-model"
        mock_settings.llm_model = "fallback-model"

        from app.services import suggestion_service
        suggestion_service.generate_suggestions(
            user_message="Tell me something",
            assistant_response="Here it is.",
            user_settings=_make_user_settings(provider="anthropic"),
        )

    create_call = mock_client.chat.completions.create.call_args
    model_used = create_call.kwargs.get("model") or (create_call.args[0] if create_call.args else None)
    assert model_used == "custom-model", f"Expected custom-model, got {model_used!r}"


# ---------------------------------------------------------------------------
# Test 5: provider default used when no sub_agent_model override
# ---------------------------------------------------------------------------

def test_generate_suggestions_uses_provider_default():
    """settings.sub_agent_model='', user provider=openai → model should be gpt-5.4-mini."""
    mock_client = _make_mock_client("Q1?\nQ2?\nQ3?")
    user_settings = _make_user_settings(provider="openai", llm_model="gpt-4o")

    with patch("app.services.suggestion_service.get_llm_client", return_value=mock_client), \
         patch("app.services.suggestion_service.settings") as mock_settings:
        mock_settings.sub_agent_model = ""
        mock_settings.llm_model = "fallback-model"

        from app.services import suggestion_service
        suggestion_service.generate_suggestions(
            user_message="Tell me something",
            assistant_response="Here it is.",
            user_settings=user_settings,
        )

    create_call = mock_client.chat.completions.create.call_args
    model_used = create_call.kwargs.get("model") or (create_call.args[0] if create_call.args else None)
    assert model_used == "gpt-5.4-mini", f"Expected gpt-5.4-mini for openai provider, got {model_used!r}"


# ---------------------------------------------------------------------------
# Test 6: exception propagates to caller
# ---------------------------------------------------------------------------

def test_generate_suggestions_raises_propagated():
    """mock client.chat.completions.create raises Exception. Assert it propagates."""
    mock_client = MagicMock()
    mock_client.chat.completions.create.side_effect = RuntimeError("API unavailable")

    with patch("app.services.suggestion_service.get_llm_client", return_value=mock_client):
        from app.services.suggestion_service import generate_suggestions
        with pytest.raises(RuntimeError, match="API unavailable"):
            generate_suggestions(
                user_message="What is the answer?",
                assistant_response="The answer is 42.",
            )


# ---------------------------------------------------------------------------
# Phase 067.4 (D-067.4-R3-01 branch b): max_completion_tokens budget bump
# ---------------------------------------------------------------------------

def test_max_completion_tokens_budget_is_2000_for_gpt5_family():
    """D-067.4-R3-01 branch (b): when effective_model resolves to gpt-5.4-mini,
    the call to client.chat.completions.create uses max_completion_tokens=2000
    (post-fix), NOT 200 (pre-fix; reasoning-token starvation cause).

    GPT-5+ family uses max_completion_tokens as a UNIFIED budget covering both
    visible content AND chain-of-thought reasoning. At 200 tokens reasoning
    consumes the cap and content="" (finish_reason="length"). 2000 is the
    empirical floor for `gpt-5.4-mini` on a 3-instruction system prompt.

    RED on master (token_param=200 at suggestion_service.py:70 and :87).
    GREEN after Plan 01 budget bump.
    """
    mock_client = _make_mock_client("Q1?\nQ2?\nQ3?")
    user_settings = _make_user_settings(provider="openai", llm_model="gpt-4o")

    with patch("app.services.suggestion_service.get_llm_client", return_value=mock_client), \
         patch("app.services.suggestion_service.settings") as mock_settings:
        mock_settings.sub_agent_model = ""
        mock_settings.llm_model = "fallback-model"

        from app.services import suggestion_service
        suggestion_service.generate_suggestions(
            user_message="Search for documents about Fahed Mrad",
            assistant_response="Found 3 documents about Fahed Mrad: ...",
            user_settings=user_settings,
        )

    create_call = mock_client.chat.completions.create.call_args
    # gpt-5.4-mini → token_param == "max_completion_tokens" (reasoning model)
    assert create_call.kwargs.get("max_completion_tokens") == 2000, (
        f"Expected max_completion_tokens=2000 (D-067.4-R3-01 branch b); "
        f"got kwargs={create_call.kwargs!r}"
    )
    assert "max_tokens" not in create_call.kwargs, (
        "gpt-5.4-mini should use max_completion_tokens (reasoning model), not max_tokens"
    )


# ---------------------------------------------------------------------------
# Phase 067.4 (D-067.4-R3-01 branch b symptom): empty content clean return
# ---------------------------------------------------------------------------

def test_empty_content_returns_clean_empty_no_exception():
    """D-067.4-R3-01 branch (b) symptom: simulate gpt-5.4-mini returning
    content="" with finish_reason="length" (reasoning-token starvation).
    generate_suggestions should return ([], None) — no exception.

    GREEN on master today; serves as regression guard against future changes
    that might raise on empty content (which would trip the broad except
    upstream and silently swallow suggestions for ANY user).
    """
    mock_client = _make_mock_client("")  # empty content

    with patch("app.services.suggestion_service.get_llm_client", return_value=mock_client):
        from app.services.suggestion_service import generate_suggestions
        questions, fallback = generate_suggestions(
            user_message="Hi",
            assistant_response="Hello",
        )

    assert questions == [], f"Expected []; got {questions!r}"
    assert fallback is None, f"Expected None; got {fallback!r}"
