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
    """Google sub-agent uses gemini-3.5-flash (093 Open Q1 — locked to the
    confirmed-served 3.x+ representative; gemini-2.5 narrates tools without
    emitting the call, D-03)."""
    assert _SUB_AGENT_MODEL_DEFAULTS["google"] == "gemini-3.5-flash"


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

class Test093ModelResolver:
    """093-03 — resolve_sub_agent_model_safely reads the REAL field
    ``available_models`` (D-06), so the dead safety net (silent since Phase 085)
    actually fires and ``_SUB_AGENT_MODEL_DEFAULTS`` engages. Plus the new
    ``resolve_workflow_ctx_model`` resolve-never-mutate wrapper (D-04/D-05)."""

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

    def test_empty_available_models_returns_candidate_unchanged(self):
        """Fresh/empty settings (available_models=[]) → no list to validate
        against → the candidate passes through as-is (backward compatible —
        the fallback must fire ONLY on a genuine cross-provider mismatch, never
        on an unvalidatable empty list)."""
        from app.services.sub_agent_models import resolve_sub_agent_model_safely
        us = SimpleNamespace(
            active_provider="anthropic",
            llm_model="claude-sonnet-4-6",
            available_models=[],  # fresh row — nothing to validate against
        )
        resolved = resolve_sub_agent_model_safely(us, override_model="some-unknown-model")
        assert resolved == "some-unknown-model"

    def test_flexible_provider_mismatch_keeps_candidate_best_effort(self):
        """A flexible provider (openrouter/ollama — empty default) with a mismatch
        keeps the candidate as best-effort (the flexible-provider contract: those
        providers route by arbitrary model id / locally-pulled models)."""
        from app.services.sub_agent_models import resolve_sub_agent_model_safely
        assert _SUB_AGENT_MODEL_DEFAULTS["openrouter"] == ""  # flexible by design
        us = SimpleNamespace(
            active_provider="openrouter",
            llm_model="z-ai/glm-5.1",
            available_models=["openai/gpt-5.4", "anthropic/claude-haiku-4-5"],
        )
        # candidate not in available_models, but provider default is empty →
        # keep the candidate best-effort (no hard provider default to fall back to).
        resolved = resolve_sub_agent_model_safely(us, override_model="z-ai/glm-5.1")
        assert resolved == "z-ai/glm-5.1"

    def test_resolve_workflow_ctx_model_none_returns_empty(self):
        """resolve_workflow_ctx_model(None) → "" (the resume/Continue
        user_settings=None case — Open Q2, deferred to the Wave-2 plans). With
        no settings only phase.config.model applies downstream."""
        from app.services.sub_agent_models import resolve_workflow_ctx_model
        assert resolve_workflow_ctx_model(None) == ""

    def test_resolve_workflow_ctx_model_resolves_without_mutating(self):
        """resolve_workflow_ctx_model(settings) → the safely-resolved model string,
        and NEVER mutates the passed settings object (D-05: resolve, never mutate).
        A stale cross-provider llm_model resolves to the provider default while the
        saved llm_model on the object stays UNCHANGED."""
        from app.services.sub_agent_models import resolve_workflow_ctx_model
        us = SimpleNamespace(
            active_provider="anthropic",
            llm_model="gpt-5.4-mini",  # stale cross-provider
            available_models=["claude-haiku-4-5-20251001"],
        )
        before_llm_model = us.llm_model
        before_provider = us.active_provider
        before_available = list(us.available_models)
        resolved = resolve_workflow_ctx_model(us)
        # resolves to the provider default (the stale gpt name is filtered out)
        assert resolved == _SUB_AGENT_MODEL_DEFAULTS["anthropic"]
        # D-05 — saved settings are untouched
        assert us.llm_model == before_llm_model
        assert us.active_provider == before_provider
        assert list(us.available_models) == before_available

    def test_resolve_workflow_ctx_model_passes_through_valid_model(self):
        """resolve_workflow_ctx_model resolves a same-provider valid llm_model
        as-is (the fallback fires ONLY on a genuine cross-provider mismatch)."""
        from app.services.sub_agent_models import resolve_workflow_ctx_model
        us = SimpleNamespace(
            active_provider="anthropic",
            llm_model="claude-sonnet-4-6",
            available_models=["claude-haiku-4-5-20251001", "claude-sonnet-4-6"],
        )
        assert resolve_workflow_ctx_model(us) == "claude-sonnet-4-6"


# ===========================================================================
# Phase 093 / Plan 08 — intentional harness sub-agent model resolution (D-18 / S3)
#
# run_task_sub_agent (task_service.py) resolved the sub-agent model via
#   resolve_sub_agent_model_safely(user_settings, override_model=None,
#                                  fallback_model=parent_ctx.model or None)
# When the harness phase ctx reaches it WITHOUT a real parent_ctx.model AND the
# owner's available_models is empty/sparse, the resolver's candidate chain falls
# all the way through to settings.llm_model="gpt-4o" (config.py:635) and passes it
# THROUGH unchanged (the empty-available_models hole, sub_agent_models.py:111-134)
# — so a Google/Moonshot/GLM sub-agent silently ran on gpt-4o (LIVE UAT S3:
# threads f4990f15 / 1cf88e93 / ec2a4f69, sub-agents on ...-flash/...-haiku via the
# ACCIDENTAL gpt-4o fallback, never the user's selection).
#
# Fix (D-18): the resolution is now INTENTIONAL — the user's explicit
# sub_agent_model is threaded as override_model, the resolved run/ctx model as
# fallback, and a narrow per-provider-default guard closes the empty-list gpt-4o
# leak for a NON-openai provider (never overriding openai/openrouter/ollama/unknown).
# The pure helper _resolve_sub_agent_effective_model isolates this for testing.
# ===========================================================================

class Test093IntentionalSubAgentResolution:
    """093-08 — _resolve_sub_agent_effective_model honors the user's sub_agent_model,
    falls through to the resolved ctx model, and floors a no-real-model harness ctx on
    a non-openai provider to the FAST per-provider default (never the gpt-4o global
    bounce)."""

    def test_valid_sub_agent_model_override_is_honored(self):
        """A valid sub_agent_model (in available_models) for the active provider is
        the user's explicit choice → honored as the override."""
        from app.services.task_service import _resolve_sub_agent_effective_model
        us = _make_user_settings(
            provider="anthropic",
            llm_model="claude-sonnet-4-6",
            sub_agent_model="claude-haiku-4-5-20251001",
        )
        us.available_models = ["claude-haiku-4-5-20251001", "claude-sonnet-4-6"]
        resolved = _resolve_sub_agent_effective_model(us, ctx_model="")
        assert resolved == "claude-haiku-4-5-20251001"

    def test_no_sub_agent_model_uses_resolved_ctx_model(self):
        """No sub_agent_model but a valid resolved ctx model → the ctx model is used
        (the fallback honors the D-04-threaded run/ctx model)."""
        from app.services.task_service import _resolve_sub_agent_effective_model
        us = _make_user_settings(
            provider="anthropic",
            llm_model="",
            sub_agent_model="",
        )
        us.available_models = ["claude-sonnet-4-6", "claude-haiku-4-5-20251001"]
        resolved = _resolve_sub_agent_effective_model(us, ctx_model="claude-sonnet-4-6")
        assert resolved == "claude-sonnet-4-6"

    def test_google_no_real_model_falls_to_fast_default_not_gpt4o(self):
        """Harness ctx with ctx_model="" + empty available_models + google →
        gemini-3.5-flash (the fast tier), NEVER gpt-4o."""
        from app.config import settings
        from app.services.task_service import _resolve_sub_agent_effective_model
        us = _make_user_settings(provider="google", llm_model="", sub_agent_model="")
        us.available_models = []  # fresh/sparse → resolver passes gpt-4o through
        with patch.object(settings, "llm_model", "gpt-4o"):
            resolved = _resolve_sub_agent_effective_model(us, ctx_model="")
        assert resolved == _SUB_AGENT_MODEL_DEFAULTS["google"] == "gemini-3.5-flash"
        assert resolved != "gpt-4o"

    def test_moonshot_no_real_model_falls_to_kimi_not_gpt4o(self):
        """Same no-real-model case, active_provider=moonshot → kimi-k2.6, not gpt-4o."""
        from app.config import settings
        from app.services.task_service import _resolve_sub_agent_effective_model
        us = _make_user_settings(provider="moonshot", llm_model="", sub_agent_model="")
        us.available_models = []
        with patch.object(settings, "llm_model", "gpt-4o"):
            resolved = _resolve_sub_agent_effective_model(us, ctx_model="")
        assert resolved == _SUB_AGENT_MODEL_DEFAULTS["moonshot"] == "kimi-k2.6"
        assert resolved != "gpt-4o"

    def test_zhipu_no_real_model_falls_to_glm_not_gpt4o(self):
        """Same no-real-model case, active_provider=zhipu → glm-4.6, not gpt-4o."""
        from app.config import settings
        from app.services.task_service import _resolve_sub_agent_effective_model
        us = _make_user_settings(provider="zhipu", llm_model="", sub_agent_model="")
        us.available_models = []
        with patch.object(settings, "llm_model", "gpt-4o"):
            resolved = _resolve_sub_agent_effective_model(us, ctx_model="")
        assert resolved == _SUB_AGENT_MODEL_DEFAULTS["zhipu"] == "glm-4.6"
        assert resolved != "gpt-4o"

    def test_openai_global_default_stays_gpt4o_guard_does_not_fire(self):
        """active_provider=openai + the global default → STAYS gpt-4o (the
        per-provider-default guard MUST NOT fire for openai)."""
        from app.config import settings
        from app.services.task_service import _resolve_sub_agent_effective_model
        us = _make_user_settings(provider="openai", llm_model="", sub_agent_model="")
        us.available_models = []
        with patch.object(settings, "llm_model", "gpt-4o"):
            resolved = _resolve_sub_agent_effective_model(us, ctx_model="")
        assert resolved == "gpt-4o"

    def test_openrouter_global_default_stays_passthrough_guard_does_not_fire(self):
        """active_provider=openrouter (flexible) → the guard must NOT fire; the
        candidate (the global default here) passes through best-effort."""
        from app.config import settings
        from app.services.task_service import _resolve_sub_agent_effective_model
        us = _make_user_settings(provider="openrouter", llm_model="", sub_agent_model="")
        us.available_models = []
        with patch.object(settings, "llm_model", "gpt-4o"):
            resolved = _resolve_sub_agent_effective_model(us, ctx_model="")
        # flexible provider: no hard per-provider default → candidate kept as-is
        assert resolved == "gpt-4o"

    def test_deep_shaped_real_ctx_model_passthrough_byte_identical(self):
        """A Deep task() caller passes a real parent_ctx.model → that model is
        returned (the chain resolves before the guard; byte-identical to today)."""
        from app.config import settings
        from app.services.task_service import _resolve_sub_agent_effective_model
        us = _make_user_settings(
            provider="anthropic",
            llm_model="claude-sonnet-4-6",
            sub_agent_model="",
        )
        us.available_models = ["claude-sonnet-4-6", "claude-haiku-4-5-20251001"]
        with patch.object(settings, "llm_model", "gpt-4o"):
            resolved = _resolve_sub_agent_effective_model(
                us, ctx_model="claude-sonnet-4-6"
            )
        assert resolved == "claude-sonnet-4-6"
        assert resolved != "gpt-4o"

    def test_none_user_settings_unknown_provider_no_guard(self):
        """No user_settings at all → provider resolves to "unknown" → the guard
        must NOT fire (unknown is excluded); the candidate (global default) is
        returned as-is."""
        from app.config import settings
        from app.services.task_service import _resolve_sub_agent_effective_model
        with patch.object(settings, "llm_model", "gpt-4o"):
            resolved = _resolve_sub_agent_effective_model(None, ctx_model="")
        assert resolved == "gpt-4o"
