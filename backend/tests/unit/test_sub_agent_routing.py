"""Unit tests for sub-agent model routing.

Sub-agents always use their dedicated provider default model.
The main (orchestrator) agent handles all generation tasks.
Escalation to the main model was removed — it caused sub-agents to consume
the expensive orchestrator model even for pure document analysis.
"""
from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import patch

import pytest

from app.config import _SUB_AGENT_MODEL_DEFAULTS


def _make_user_settings(
    provider: str = "anthropic",
    llm_model: str = "claude-sonnet-4-6",
    sub_agent_model: str = "",
):
    return SimpleNamespace(
        active_provider=provider,
        llm_model=llm_model,
        sub_agent_model=sub_agent_model,
    )


# ---------------------------------------------------------------------------
# Provider defaults — sub-agent always uses dedicated model
# ---------------------------------------------------------------------------

def test_anthropic_sub_agent_uses_haiku():
    """Anthropic sub-agent uses haiku, not the orchestrator model."""
    assert _SUB_AGENT_MODEL_DEFAULTS["anthropic"] == "claude-haiku-4-5-20251001"


def test_openai_sub_agent_uses_mini():
    """OpenAI sub-agent uses gpt-5.4-mini (high TPM, capable for analysis)."""
    assert _SUB_AGENT_MODEL_DEFAULTS["openai"] == "gpt-5.4-mini"


def test_google_sub_agent_uses_flash():
    """Google sub-agent uses gemini-2.5-flash."""
    assert _SUB_AGENT_MODEL_DEFAULTS["google"] == "gemini-2.5-flash"


# ---------------------------------------------------------------------------
# Model resolution order: override > provider default > main model fallback
# ---------------------------------------------------------------------------

def test_override_takes_priority():
    """user_settings.sub_agent_model override beats provider default."""
    from app.config import settings
    user_settings = _make_user_settings(provider="openai", sub_agent_model="gpt-4.1-mini")
    with patch.object(settings, "sub_agent_model", ""):
        override = user_settings.sub_agent_model or settings.sub_agent_model
        assert override == "gpt-4.1-mini"


def test_no_override_uses_provider_default():
    """Empty override falls through to _SUB_AGENT_MODEL_DEFAULTS."""
    from app.config import settings
    user_settings = _make_user_settings(provider="anthropic", sub_agent_model="")
    with patch.object(settings, "sub_agent_model", ""):
        override = user_settings.sub_agent_model or settings.sub_agent_model
        assert not override
        provider_default = _SUB_AGENT_MODEL_DEFAULTS.get(user_settings.active_provider, "")
        assert provider_default == "claude-haiku-4-5-20251001"


def test_analysis_task_does_not_use_main_model():
    """Analysis tasks (summarize, extract) use the provider default, not llm_model."""
    user_settings = _make_user_settings(provider="openai", llm_model="gpt-4.1")
    from app.config import settings
    with patch.object(settings, "sub_agent_model", ""):
        override = user_settings.sub_agent_model or settings.sub_agent_model
        if override:
            effective_model = override
        else:
            effective_model = (
                _SUB_AGENT_MODEL_DEFAULTS.get(user_settings.active_provider, "")
                or user_settings.llm_model
            )
        assert effective_model == "gpt-5.4-mini"
        assert effective_model != "gpt-4.1"


def test_generation_task_also_uses_provider_default():
    """Even PPT/report tasks use the provider default — generation is the main agent's job."""
    user_settings = _make_user_settings(provider="openai", llm_model="gpt-4.1")
    from app.config import settings
    with patch.object(settings, "sub_agent_model", ""):
        override = user_settings.sub_agent_model or settings.sub_agent_model
        effective_model = override or _SUB_AGENT_MODEL_DEFAULTS.get(user_settings.active_provider, "") or user_settings.llm_model
        assert effective_model == "gpt-5.4-mini"


# ---------------------------------------------------------------------------
# Output budget — always full
# ---------------------------------------------------------------------------

def test_output_ceiling_always_at_least_32768():
    """Sub-agent always gets at least 32768 output tokens regardless of task."""
    from app.config import settings
    with patch.object(settings, "sub_agent_max_output_tokens", 8192):
        ceiling = max(32768, settings.sub_agent_max_output_tokens)
        assert ceiling == 32768


def test_output_ceiling_respects_slider_when_higher():
    """If slider is above 32768, the higher value wins."""
    from app.config import settings
    with patch.object(settings, "sub_agent_max_output_tokens", 65536):
        ceiling = max(32768, settings.sub_agent_max_output_tokens)
        assert ceiling == 65536


# ===========================================================================
# Phase 093 / Plan 03 — model resolver field fix (D-06) — RED contract
#
# resolve_sub_agent_model_safely (sub_agent_models.py:70) reads a NON-EXISTENT
# field user_settings.llm_models; the real field on UserEffectiveSettings is
# available_models: list[str] (models/user_settings.py:100). Dead since Phase 085
# → _SUB_AGENT_MODEL_DEFAULTS never fires → stale cross-provider model ids leak.
#
# These cases stay skipped until 093-03 flips the read to available_models. 093-03
# removes the class-level skip and the cases assert the resolved model. Authored
# here as the named RED contract (D-13 Layer-1).
# ===========================================================================

@pytest.mark.skip(reason="093-03 owns the available_models field fix (D-06)")
class Test093ModelResolver:
    """RED contract for 093-03 — resolve_sub_agent_model_safely reads available_models."""

    def test_stale_cross_provider_model_falls_back_to_provider_default(self):
        """A STALE saved llm_model from a DIFFERENT provider that is NOT in
        available_models falls back to the active provider's default (not the stale
        name). Build a UserEffectiveSettings-like object with
        available_models=['claude-haiku-4-5-20251001'], active_provider='anthropic',
        and a stale cross-provider llm_model='gpt-5.4-mini' → expect the anthropic
        default 'claude-haiku-4-5-20251001'."""
        from app.services.sub_agent_models import resolve_sub_agent_model_safely
        us = SimpleNamespace(
            active_provider="anthropic",
            llm_model="gpt-5.4-mini",  # stale cross-provider — NOT in available_models
            available_models=["claude-haiku-4-5-20251001"],
        )
        resolved = resolve_sub_agent_model_safely(us, override_model="gpt-5.4-mini")
        assert resolved == _SUB_AGENT_MODEL_DEFAULTS["anthropic"]

    def test_candidate_in_available_models_passes_through(self):
        """A candidate that IS in available_models is returned as-is."""
        from app.services.sub_agent_models import resolve_sub_agent_model_safely
        us = SimpleNamespace(
            active_provider="anthropic",
            llm_model="claude-sonnet-4-6",
            available_models=["claude-haiku-4-5-20251001", "claude-sonnet-4-6"],
        )
        resolved = resolve_sub_agent_model_safely(us, override_model="claude-sonnet-4-6")
        assert resolved == "claude-sonnet-4-6"
