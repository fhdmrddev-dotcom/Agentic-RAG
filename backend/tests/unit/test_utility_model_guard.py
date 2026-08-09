"""Phase 175 Plan 01 — shared inferred-provider utility-model guard (XPROV-03 D-03).

Two surfaces:

1. ``provider_safe_utility_model(user_settings, override_candidate)`` — the pure
   helper Plan 04 calls explicitly at the thread_title + suggestion sites. It
   drops a cross-provider override (inferred provider != active) BEFORE any
   provider call, keeps a same-provider candidate, never blocks a flexible
   provider (openrouter/ollama), and returns None on an empty candidate.

2. the folded inferred-provider gate inside ``resolve_sub_agent_model_safely`` —
   catches a genuine cross-provider candidate even when ``available_models`` is
   EMPTY (the blind spot the list-membership branch missed: the empty-list
   passthrough leaked a gpt-4o onto a non-openai-active user). The gate fires
   ONLY on a CONFIDENT known-provider mismatch — an unrecognised id (which
   infers to the fallback bucket) still passes through unchanged (D-14).

T-175-01-02: the guard only changes WHICH utility model id is sent; it never
touches the caller's RLS/auth context (request-scoped per Phase-163 D-03).
"""
from __future__ import annotations

from types import SimpleNamespace

from app.config import _SUB_AGENT_MODEL_DEFAULTS


def _make_user_settings(
    provider: str = "anthropic",
    llm_model: str = "claude-sonnet-5",
    available_models: list[str] | None = None,
):
    return SimpleNamespace(
        active_provider=provider,
        llm_model=llm_model,
        available_models=available_models if available_models is not None else [],
    )


# ===========================================================================
# provider_safe_utility_model — the pure helper (D-03)
# ===========================================================================

def test_cross_provider_candidate_returns_none():
    """A candidate whose inferred provider differs from the active provider is
    dropped (returns None → caller falls through to the provider default)."""
    from app.services.sub_agent_models import provider_safe_utility_model
    us = _make_user_settings(provider="anthropic")
    # "gpt-5.4-mini" infers to openai != anthropic
    assert provider_safe_utility_model(us, "gpt-5.4-mini") is None


def test_same_provider_candidate_returns_candidate():
    """A same-provider candidate (inferred == active) is returned unchanged."""
    from app.services.sub_agent_models import provider_safe_utility_model
    us = _make_user_settings(provider="anthropic")
    assert provider_safe_utility_model(us, "claude-sonnet-5") == "claude-sonnet-5"


def test_flexible_openrouter_never_blocks_cross_provider():
    """openrouter routes by arbitrary model id → a cross-provider-looking
    candidate is NEVER blocked (returned as-is)."""
    from app.services.sub_agent_models import provider_safe_utility_model
    us = _make_user_settings(provider="openrouter")
    # infers to openai, but openrouter is flexible → keep it
    assert provider_safe_utility_model(us, "gpt-5.4-mini") == "gpt-5.4-mini"


def test_flexible_ollama_never_blocks_cross_provider():
    """ollama serves locally-pulled models → never blocked."""
    from app.services.sub_agent_models import provider_safe_utility_model
    us = _make_user_settings(provider="ollama")
    assert provider_safe_utility_model(us, "gpt-5.4-mini") == "gpt-5.4-mini"


def test_none_candidate_returns_none():
    """A None candidate returns None."""
    from app.services.sub_agent_models import provider_safe_utility_model
    us = _make_user_settings(provider="anthropic")
    assert provider_safe_utility_model(us, None) is None


def test_empty_candidate_returns_none():
    """An empty-string candidate returns None."""
    from app.services.sub_agent_models import provider_safe_utility_model
    us = _make_user_settings(provider="anthropic")
    assert provider_safe_utility_model(us, "") is None


def test_none_user_settings_cross_provider_returns_none():
    """No user_settings → active provider is "" → a candidate that infers to a
    real provider is a mismatch → None (never a cross-provider call)."""
    from app.services.sub_agent_models import provider_safe_utility_model
    assert provider_safe_utility_model(None, "gpt-5.4-mini") is None


# ===========================================================================
# resolve_sub_agent_model_safely — the folded inferred-provider gate (D-03)
# ===========================================================================

def test_empty_available_models_cross_provider_falls_to_default():
    """EMPTY available_models + a CONFIDENT cross-provider candidate now falls
    through to _SUB_AGENT_MODEL_DEFAULTS[active] via the folded gate — closing
    the empty-list blind spot that used to leak gpt-4o onto a google-active
    user."""
    from app.services.sub_agent_models import resolve_sub_agent_model_safely
    us = _make_user_settings(provider="google", llm_model="", available_models=[])
    resolved = resolve_sub_agent_model_safely(us, override_model="gpt-4o")
    assert resolved == _SUB_AGENT_MODEL_DEFAULTS["google"] == "gemini-3.5-flash"
    assert resolved != "gpt-4o"


def test_empty_available_models_same_provider_passthrough_byte_identical():
    """EMPTY available_models + a SAME-provider candidate is byte-identical to
    pre-change — the gate does not fire (inferred == active)."""
    from app.services.sub_agent_models import resolve_sub_agent_model_safely
    us = _make_user_settings(provider="google", llm_model="", available_models=[])
    resolved = resolve_sub_agent_model_safely(us, override_model="gemini-3.5-flash")
    assert resolved == "gemini-3.5-flash"


def test_empty_available_models_unknown_candidate_passthrough_byte_identical():
    """EMPTY available_models + an UNRECOGNISED candidate (infers to the fallback
    bucket) is NOT a confident mismatch → passes through unchanged (D-14 — the
    fold must never fire on an unvalidatable empty list for an unknown id)."""
    from app.services.sub_agent_models import resolve_sub_agent_model_safely
    us = _make_user_settings(provider="anthropic", llm_model="", available_models=[])
    resolved = resolve_sub_agent_model_safely(us, override_model="totally-unknown-xyz")
    assert resolved == "totally-unknown-xyz"


def test_empty_available_models_cross_provider_flexible_passthrough():
    """EMPTY available_models + cross-provider candidate but a FLEXIBLE active
    provider (openrouter) → the gate does not fire; the candidate passes through
    best-effort (no hard per-provider default to fall back to)."""
    from app.services.sub_agent_models import resolve_sub_agent_model_safely
    us = _make_user_settings(provider="openrouter", llm_model="", available_models=[])
    resolved = resolve_sub_agent_model_safely(us, override_model="gpt-4o")
    assert resolved == "gpt-4o"


def test_populated_list_cross_provider_still_falls_to_default():
    """A cross-provider candidate with a POPULATED list that excludes it still
    falls to the provider default (the fold reaches the same result the existing
    list-membership branch produced — no regression)."""
    from app.services.sub_agent_models import resolve_sub_agent_model_safely
    us = _make_user_settings(
        provider="anthropic",
        llm_model="claude-sonnet-5",
        available_models=["claude-haiku-4-5-20251001", "claude-sonnet-5"],
    )
    resolved = resolve_sub_agent_model_safely(us, override_model="gpt-5.4-mini")
    assert resolved == _SUB_AGENT_MODEL_DEFAULTS["anthropic"]
