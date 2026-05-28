"""Phase 085 Plan 05 — cross-provider sub-agent model safety integration test.

This test ships in Task 1 as a RED test (intentionally failing for all
non-OpenAI providers) and turns GREEN after Task 2 hardens
``resolve_sub_agent_model_safely`` to always validate the resolved model
against the active provider's model family — closing BUG-260528-01.

Bug shape (BUG-260528-01):
  - User toggles Settings → active_provider = "anthropic"; picks
    claude-haiku-4-5-20251001 as the active model. The Settings UI's
    "Sub-agent model" stays on "Auto (cheapest)" (default).
  - Parent agent emits ``task(...)``. ``task_service.run_task_sub_agent``
    calls ``resolve_sub_agent_model_safely(user_settings, override_model=None,
    fallback_model=parent_ctx.model)``.
  - The helper's safety net (sub_agent_models.py:58) only fires when
    ``override_model`` is truthy. With ``override_model=None`` the final
    return chain leaks ``user_settings.llm_model`` (which may still be
    ``"gpt-4.1"`` — stale-cross-provider) through to the Anthropic client.
  - Anthropic 404s ("model not found"). Sub-agent fails 1.4s in.

Fix shape (Task 2): always validate the candidate against
``_active_models_list`` AFTER resolution. If mismatch + provider has a
non-empty ``_SUB_AGENT_MODEL_DEFAULTS`` entry, return that default. If
empty (openrouter, ollama), keep candidate as best-effort with a WARNING
log — those providers are intentionally flexible.

Coverage: 7 of the 9 supported providers (openai, anthropic, google,
openrouter, deepseek, moonshot, ollama). minimax + zhipu are excluded —
they have hardcoded single-model entries in ``_SUB_AGENT_MODEL_DEFAULTS``
but are NOT in the SC#10 UAT bandwidth defined by CLAUDE.md.
"""
from __future__ import annotations

import pytest

from app.config import _SUB_AGENT_MODEL_DEFAULTS
from app.services.sub_agent_models import resolve_sub_agent_model_safely


class _StubUserSettings:
    """Minimal stand-in for ``UserEffectiveSettings``.

    The real ``UserEffectiveSettings`` is a Pydantic model with ~40+ fields.
    ``resolve_sub_agent_model_safely`` only reads ``active_provider``,
    ``llm_model``, and ``llm_models`` (comma-separated string).
    """

    def __init__(self, *, active_provider: str, llm_model: str, llm_models: str):
        self.active_provider = active_provider
        self.llm_model = llm_model
        self.llm_models = llm_models


# Provider -> (representative llm_models CSV, model-family prefix(es) we expect)
_PROVIDER_FIXTURES: dict[str, tuple[str, tuple[str, ...]]] = {
    # OpenAI: stale llm_model="gpt-4.1" IS in this list -> baseline PASS pre-fix
    "openai": (
        "gpt-4.1,gpt-5.4-mini,gpt-5.4,gpt-4o,gpt-4o-mini",
        ("gpt-",),
    ),
    # Anthropic: llm_model="gpt-4.1" NOT in this list -> RED pre-fix
    "anthropic": (
        "claude-haiku-4-5-20251001,claude-sonnet-4-5-20251022,claude-opus-4-5-20251022",
        ("claude-",),
    ),
    # Google: same pattern
    "google": (
        "gemini-2.5-flash,gemini-2.5-pro,gemini-2.5-flash-lite",
        ("gemini-",),
    ),
    # OpenRouter: _SUB_AGENT_MODEL_DEFAULTS entry is "" -> best-effort path
    # Helper must NOT crash; returned model is the candidate (gpt-4.1) since
    # there's no provider default to fall back to. This is the documented
    # flexible-provider escape hatch.
    "openrouter": (
        "deepseek/deepseek-r1,anthropic/claude-3.5-sonnet,openai/gpt-4o",
        (),  # OpenRouter accepts anything — no prefix check
    ),
    # DeepSeek: real native provider, has a hard default
    "deepseek": (
        "deepseek-v4-flash,deepseek-v4-pro,deepseek-reasoner,deepseek-chat",
        ("deepseek-",),
    ),
    # Moonshot: real native provider, has a hard default
    "moonshot": (
        "kimi-k2.6,moonshot-v1-8k,moonshot-v1-32k",
        ("kimi-", "moonshot-"),
    ),
    # Ollama: _SUB_AGENT_MODEL_DEFAULTS entry is "" -> best-effort path
    "ollama": (
        "llama3.2,qwen2.5,mistral",
        (),  # Ollama accepts any local model — user manages
    ),
}


@pytest.mark.parametrize("provider", list(_PROVIDER_FIXTURES.keys()))
def test_cross_provider_default_path_no_footgun(provider: str):
    """For every supported provider, the default ``override_model=None`` path
    MUST return a model that's safe to send to the active provider's client.

    Reproduces BUG-260528-01: when the user toggled active_provider but
    ``user_settings.llm_model`` is still stale-cross-provider (``"gpt-4.1"``),
    the resolver must not let that cross-provider name leak through.

    Pass conditions:
      1. The returned model is NOT ``"gpt-4.1"`` UNLESS the active provider
         is ``"openai"`` (in which case gpt-4.1 is the correct family) OR
         the provider's default is empty (openrouter, ollama — best-effort).
      2. For providers with a hard ``_SUB_AGENT_MODEL_DEFAULTS`` entry
         (openai, anthropic, google, deepseek, moonshot), the returned
         model MUST belong to the provider's family OR be in the user's
         configured ``llm_models`` list for that provider.
    """
    csv_models, family_prefixes = _PROVIDER_FIXTURES[provider]
    user_settings = _StubUserSettings(
        active_provider=provider,
        # Intentionally stale-cross-provider — this is the bug trigger.
        # Even when provider is anthropic, user_settings.llm_model can
        # still be "gpt-4.1" if the user toggled providers without picking
        # a new active model.
        llm_model="gpt-4.1",
        llm_models=csv_models,
    )

    result = resolve_sub_agent_model_safely(
        user_settings,
        override_model=None,  # production call site (task_service.py:229)
        fallback_model="gpt-4.1",  # parent model in the cross-provider scenario
    )

    # Sanity: helper never returns None / empty
    assert result, f"Resolver returned empty/None for provider={provider!r}"

    provider_default = _SUB_AGENT_MODEL_DEFAULTS.get(provider, "")
    configured_models = [m.strip() for m in csv_models.split(",") if m.strip()]

    if not provider_default:
        # openrouter + ollama — flexible providers, no hard default.
        # Best-effort: helper returns the candidate as-is (with WARNING log).
        # Acceptable outcomes: returns gpt-4.1 (the candidate) OR any string
        # from the configured llm_models list. The contract is "don't crash".
        assert result == "gpt-4.1" or result in configured_models, (
            f"Flexible provider {provider!r}: resolver returned unexpected "
            f"model={result!r}"
        )
        return

    # Hard-default providers (openai, anthropic, google, deepseek, moonshot):
    # the resolver MUST NOT return the stale cross-provider candidate.
    if provider != "openai":
        assert result != "gpt-4.1", (
            f"BUG-260528-01 reproduced for provider={provider!r}: resolver "
            f"returned stale cross-provider model 'gpt-4.1' which would 404 "
            f"on the {provider!r} API endpoint."
        )

    # Stronger gate: the returned model must belong to the active provider's
    # family — either the canonical provider default OR a value from the
    # user's configured llm_models list (which we constructed to only contain
    # in-family models for this provider).
    in_family_by_prefix = (
        any(result.startswith(p) for p in family_prefixes) if family_prefixes else True
    )
    is_provider_default = result == provider_default
    is_configured_model = result in configured_models

    assert is_provider_default or is_configured_model or in_family_by_prefix, (
        f"Resolver returned model={result!r} which does not belong to "
        f"provider={provider!r}'s family (prefixes={family_prefixes!r}, "
        f"configured_models={configured_models!r}, "
        f"provider_default={provider_default!r})"
    )


def test_provider_default_table_covers_all_uat_axis_providers():
    """Sanity: every provider in the SC#10 4-axis UAT bandwidth has an entry
    in ``_SUB_AGENT_MODEL_DEFAULTS`` (even if empty for flexible providers).

    This guards against a future regression where a new provider lands in
    the UAT matrix but somebody forgets to add it to the defaults map.
    """
    expected_providers = {
        "openai", "anthropic", "google", "openrouter",
        "deepseek", "moonshot", "ollama",
    }
    actual_providers = set(_SUB_AGENT_MODEL_DEFAULTS.keys())
    missing = expected_providers - actual_providers
    assert not missing, (
        f"_SUB_AGENT_MODEL_DEFAULTS missing entries for: {missing!r}. "
        f"Every UAT-axis provider must have an explicit entry "
        f"(empty string is fine for flexible providers like openrouter/ollama)."
    )
