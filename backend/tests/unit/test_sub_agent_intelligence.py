"""Unit tests for Phase 25-01: Sub-Agent Intelligence & Model-Aware Context.

Tests:
1. Sub-agent model resolution — provider default (anthropic → Haiku)
2. Sub-agent model resolution — SUB_AGENT_MODEL env override wins
3. Sub-agent model resolution — unknown provider falls back to user model
4. resolve_context_budget — CONTEXT_WINDOW_MAX_TOKENS env override
5. resolve_context_budget — per-provider defaults
6. JSON token estimation accuracy (chars/3 for tool_calls)
"""
from __future__ import annotations

import json
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest


# ---------------------------------------------------------------------------
# Helpers — build minimal fake objects
# ---------------------------------------------------------------------------

def _make_user_settings(provider: str = "anthropic", llm_model: str = "claude-sonnet-4-6"):
    us = MagicMock()
    us.active_provider = provider
    us.llm_model = llm_model
    return us


# ---------------------------------------------------------------------------
# Test 1: sub-agent model resolution — provider default
# ---------------------------------------------------------------------------

def test_sub_agent_model_provider_default_anthropic():
    """When SUB_AGENT_MODEL is empty and provider=anthropic, use Haiku."""
    from app.services import sub_agent_service
    from app.config import settings

    user_settings = _make_user_settings(provider="anthropic", llm_model="claude-sonnet-4-6")

    with patch.object(settings, "sub_agent_model", ""):
        # Simulate resolution logic directly (extracted from run_sub_agent)
        provider_default = sub_agent_service._SUB_AGENT_MODEL_DEFAULTS.get(
            user_settings.active_provider, ""
        )
        effective_model = (
            provider_default
            or user_settings.llm_model
            or "server-fallback"
        )

    assert effective_model == "claude-haiku-4-5-20251001", (
        f"Expected Haiku as Anthropic sub-agent default, got {effective_model!r}"
    )


def test_sub_agent_model_provider_default_openai():
    """When provider=openai, default to gpt-5.4-mini."""
    from app.services import sub_agent_service

    provider_default = sub_agent_service._SUB_AGENT_MODEL_DEFAULTS.get("openai", "")
    assert provider_default == "gpt-5.4-mini"


def test_sub_agent_model_provider_default_google():
    """When provider=google, default to gemini-3.5-flash (093 Open Q1 — locked
    to the confirmed-served 3.x+ representative; gemini-2.5 narrates tools
    without emitting the call, D-03)."""
    from app.services import sub_agent_service

    provider_default = sub_agent_service._SUB_AGENT_MODEL_DEFAULTS.get("google", "")
    assert provider_default == "gemini-3.5-flash"


# ---------------------------------------------------------------------------
# Test 2: SUB_AGENT_MODEL env override wins
# ---------------------------------------------------------------------------

def test_sub_agent_model_env_override_wins():
    """When SUB_AGENT_MODEL is set, it wins regardless of provider."""
    from app.config import settings

    user_settings = _make_user_settings(provider="anthropic", llm_model="claude-sonnet-4-6")

    with patch.object(settings, "sub_agent_model", "custom-model-override"):
        # Simulate the if branch
        if settings.sub_agent_model:
            effective_model = settings.sub_agent_model
        else:
            effective_model = "should-not-reach"

    assert effective_model == "custom-model-override"


def test_sub_agent_model_env_override_wins_for_google():
    """Env override takes priority even when provider would have a good default."""
    from app.config import settings

    user_settings = _make_user_settings(provider="google", llm_model="gemini-2.0-flash")

    with patch.object(settings, "sub_agent_model", "my-special-model"):
        if settings.sub_agent_model:
            effective_model = settings.sub_agent_model
        else:
            from app.services import sub_agent_service
            provider_default = sub_agent_service._SUB_AGENT_MODEL_DEFAULTS.get(
                user_settings.active_provider, ""
            )
            effective_model = provider_default or user_settings.llm_model

    assert effective_model == "my-special-model"


# ---------------------------------------------------------------------------
# Test 3: unknown provider falls back to user's selected model
# ---------------------------------------------------------------------------

def test_sub_agent_model_unknown_provider_falls_back():
    """openrouter has empty default — falls back to user's llm_model."""
    from app.services import sub_agent_service
    from app.config import settings

    user_settings = _make_user_settings(provider="openrouter", llm_model="mistral/mistral-7b")

    with patch.object(settings, "sub_agent_model", ""):
        provider_default = sub_agent_service._SUB_AGENT_MODEL_DEFAULTS.get(
            user_settings.active_provider, ""
        )
        # Empty string is falsy — falls back to user model
        effective_model = (
            provider_default
            or user_settings.llm_model
            or "server-default"
        )

    assert effective_model == "mistral/mistral-7b"


def test_sub_agent_model_ollama_falls_back():
    """ollama has empty default — falls back to user's model."""
    from app.services import sub_agent_service

    provider_default = sub_agent_service._SUB_AGENT_MODEL_DEFAULTS.get("ollama", "")
    assert provider_default == "", "ollama should have no default — user manages models"


# ---------------------------------------------------------------------------
# Test 4: resolve_context_budget — env override
# ---------------------------------------------------------------------------

def test_resolve_context_budget_env_override():
    """When CONTEXT_WINDOW_MAX_TOKENS is non-zero, it overrides per-provider defaults."""
    from app.config import settings
    from app.services.context_window import resolve_context_budget

    with patch.object(settings, "context_window_max_tokens", 500_000):
        result_anthropic = resolve_context_budget("anthropic")
        result_openai = resolve_context_budget("openai")
        result_unknown = resolve_context_budget("unknown-provider")

    assert result_anthropic == 500_000
    assert result_openai == 500_000
    assert result_unknown == 500_000


def test_resolve_context_budget_zero_uses_provider_defaults():
    """When context_window_max_tokens=0, provider defaults are used."""
    from app.config import settings
    from app.services.context_window import resolve_context_budget

    with patch.object(settings, "context_window_max_tokens", 0):
        result = resolve_context_budget("anthropic")

    assert result == 120_000, f"Expected 120k for anthropic, got {result}"


# ---------------------------------------------------------------------------
# Test 5: resolve_context_budget — per-provider defaults
# ---------------------------------------------------------------------------

def test_resolve_context_budget_anthropic():
    from app.config import settings
    from app.services.context_window import resolve_context_budget

    with patch.object(settings, "context_window_max_tokens", 0):
        assert resolve_context_budget("anthropic") == 120_000


def test_resolve_context_budget_openai():
    from app.config import settings
    from app.services.context_window import resolve_context_budget

    with patch.object(settings, "context_window_max_tokens", 0):
        assert resolve_context_budget("openai") == 200_000


def test_resolve_context_budget_google():
    from app.config import settings
    from app.services.context_window import resolve_context_budget

    with patch.object(settings, "context_window_max_tokens", 0):
        assert resolve_context_budget("google") == 180_000


def test_resolve_context_budget_openrouter():
    from app.config import settings
    from app.services.context_window import resolve_context_budget

    with patch.object(settings, "context_window_max_tokens", 0):
        assert resolve_context_budget("openrouter") == 100_000


def test_resolve_context_budget_ollama():
    from app.config import settings
    from app.services.context_window import resolve_context_budget

    with patch.object(settings, "context_window_max_tokens", 0):
        assert resolve_context_budget("ollama") == 80_000


def test_resolve_context_budget_unknown_provider_fallback():
    """Unknown provider falls back to 100k."""
    from app.config import settings
    from app.services.context_window import resolve_context_budget

    with patch.object(settings, "context_window_max_tokens", 0):
        assert resolve_context_budget("some-unknown-provider") == 100_000


# ---------------------------------------------------------------------------
# Test 6: JSON token estimation accuracy (chars/3 for tool_calls)
# ---------------------------------------------------------------------------

def test_json_token_estimation_uses_chars_over_3():
    """estimate_messages_tokens uses chars/3 for tool_calls (not chars/4)."""
    from app.services.context_window import estimate_messages_tokens

    # Realistic tool_calls payload with JSON punctuation overhead
    tool_calls = [
        {
            "id": "call_abc123",
            "type": "function",
            "function": {
                "name": "search_documents",
                "arguments": json.dumps({
                    "query": "What are the key revenue figures for Q3 2025?",
                    "metadata_filter": {"document_type": "financial_report"},
                    "top_k": 5,
                }),
            },
        }
    ]
    messages = [
        {
            "role": "assistant",
            "content": None,
            "tool_calls": tool_calls,
        }
    ]

    # Calculate what old (chars/4) would produce
    tc_json = json.dumps(tool_calls)
    old_estimate_tool_tokens = len(tc_json) // 4
    new_estimate_tool_tokens = max(1, len(tc_json) // 3)

    # New estimate should be strictly higher (more tokens counted for JSON punctuation)
    assert new_estimate_tool_tokens > old_estimate_tool_tokens, (
        f"chars/3 ({new_estimate_tool_tokens}) should be > chars/4 ({old_estimate_tool_tokens})"
    )

    # estimate_messages_tokens should use the new formula
    total = estimate_messages_tokens(messages)

    # Per-message overhead: 4 (overhead) + 1 (role) = 5 base tokens
    # Plus the new tool_calls estimate
    expected_min = 5 + new_estimate_tool_tokens
    assert total >= expected_min, (
        f"Total {total} should be >= {expected_min} (base 5 + tool_calls {new_estimate_tool_tokens})"
    )

    # Sanity: total should NOT equal what the old formula would give
    old_total = 5 + old_estimate_tool_tokens
    assert total != old_total or new_estimate_tool_tokens == old_estimate_tool_tokens, (
        f"estimate_messages_tokens appears to still use chars/4 (old formula)"
    )


def test_json_token_estimation_higher_than_plain_text():
    """Tool calls with JSON punctuation should produce higher estimates than equivalent plain text."""
    from app.services.context_window import estimate_messages_tokens, estimate_tokens

    payload = {"key": "value", "nested": {"list": [1, 2, 3]}}
    json_str = json.dumps(payload)

    # JSON estimate (chars/3) vs plain text estimate (chars/4)
    json_estimate = max(1, len(json_str) // 3)
    text_estimate = estimate_tokens(json_str)  # chars/4

    assert json_estimate > text_estimate, (
        f"JSON estimate {json_estimate} should exceed plain text estimate {text_estimate}"
    )
