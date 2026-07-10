"""Phase 129 (D-02 / MP-04) — OpenRouter ``require_parameters`` request-build shape.

Wave 0 unit coverage for the one-line injection wired in
``openai_service.create_adaptive_streaming_chat``: on the
``openrouter_tool_strategy == "quality"`` strategy AND ``provider == "openrouter"``,
the assembled request ``kwargs`` carry::

    extra_body["provider"] == {"require_parameters": True}

alongside the pre-existing ``extra_body["plugins"] == [{"id": "response-healing"}]``
and the ``:exacto`` model suffix.

D-14 RED LINE — the injection lives strictly inside the quality + openrouter
double-gate. This file PROVES the shared path is untouched by asserting ABSENCE of
the ``provider`` key for:
  * provider=="openrouter" on the ``native`` strategy,
  * provider=="openrouter" on the ``xml`` strategy,
  * provider=="openai" on the ``quality`` strategy (the shared-path proof — the
    quality ``if`` guard fires on the strategy string, but the inner
    ``provider == "openrouter"`` gate blocks the injection for OpenAI/Anthropic/Google).

No live network call: ``get_llm_client`` is patched to return a fake client whose
``chat.completions.create`` is a spy that captures ``kwargs`` and returns a
``MagicMock`` stream (per ``feedback_mock_completeness.md`` — mock ALL network deps).
"""
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest

from app.services import openai_service


# ─────────────────────────────────────────────────────────────────────────────
# Fixtures / helpers
# ─────────────────────────────────────────────────────────────────────────────

def _make_user_settings(active_provider: str, strategy: str) -> SimpleNamespace:
    """Minimal UserEffectiveSettings-shaped object for the request-build path.

    The attributes accessed by ``create_adaptive_streaming_chat`` /
    ``get_llm_client`` / ``_resolve_max_tokens`` are explicit so a missing attr
    raises (rather than silently defaulting via a MagicMock auto-attr).
    """
    return SimpleNamespace(
        active_provider=active_provider,
        llm_provider=active_provider,
        llm_model=None,                       # caller passes `model=` explicitly
        llm_api_key="sk-test-key",
        llm_base_url="https://example.invalid/v1",
        openrouter_tool_strategy=strategy,
        llm_max_output_tokens=0,              # 0 → fall through to registry/provider defaults
    )


def _build_kwargs(model: str, active_provider: str, strategy: str) -> dict:
    """Drive the request-build path once and return the captured ``create`` kwargs.

    Patches ``openai_service.get_llm_client`` so no OpenAI client is constructed and
    no network call is made — the spy captures the assembled request kwargs.
    """
    spy = MagicMock(name="chat.completions.create", return_value=MagicMock(name="stream"))
    fake_client = MagicMock(name="OpenAIClient")
    fake_client.chat.completions.create = spy

    user_settings = _make_user_settings(active_provider, strategy)

    with patch.object(openai_service, "get_llm_client", return_value=fake_client):
        openai_service.create_adaptive_streaming_chat(
            messages=[{"role": "user", "content": "hi"}],
            tool_choice="auto",
            model=model,
            user_settings=user_settings,
            tools_override=[],   # bypass get_tools() — irrelevant to the extra_body shape
        )

    assert spy.call_count == 1, "request-build must call client.chat.completions.create exactly once"
    return spy.call_args.kwargs


# An OpenRouter registry model (provider=="openrouter") and an OpenAI registry model.
_OPENROUTER_MODEL = "deepseek/deepseek-chat"
_OPENAI_MODEL = "gpt-4o"


# ─────────────────────────────────────────────────────────────────────────────
# Tests
# ─────────────────────────────────────────────────────────────────────────────

def test_require_parameters_quality_only():
    """provider==openrouter + quality → extra_body.provider == {'require_parameters': True}.

    The RESEARCH test-map id for the positive case. Asserts the new flag rides
    ALONGSIDE the existing response-healing plugin (does not stomp it) and that the
    :exacto quality suffix is still applied.
    """
    kwargs = _build_kwargs(_OPENROUTER_MODEL, active_provider="openrouter", strategy="quality")

    extra_body = kwargs.get("extra_body")
    assert extra_body is not None, "quality+openrouter must assemble an extra_body block"
    # The D-02 injection:
    assert extra_body["provider"] == {"require_parameters": True}
    # Must not stomp the pre-existing response-healing plugin:
    assert extra_body["plugins"] == [{"id": "response-healing"}]
    # Quality routing still appends :exacto to the model id:
    assert kwargs["model"].endswith(":exacto")


def test_native_strategy_has_no_provider_key():
    """provider==openrouter + native → NO 'provider' key (no opt-in, no always-on)."""
    kwargs = _build_kwargs(_OPENROUTER_MODEL, active_provider="openrouter", strategy="native")

    extra_body = kwargs.get("extra_body") or {}
    assert "provider" not in extra_body, (
        "native strategy must NOT inject require_parameters — it is opt-in via 'quality' only"
    )
    # Native strategy also skips the :exacto suffix + response-healing plugin.
    assert not kwargs.get("model", "").endswith(":exacto")
    assert "plugins" not in extra_body


def test_xml_strategy_has_no_provider_key():
    """provider==openrouter + xml → NO 'provider' key (xml routes to STRUCTURED mode)."""
    kwargs = _build_kwargs(_OPENROUTER_MODEL, active_provider="openrouter", strategy="xml")

    extra_body = kwargs.get("extra_body") or {}
    assert "provider" not in extra_body, (
        "xml strategy must NOT inject require_parameters — it resolves to STRUCTURED mode"
    )


def test_non_openrouter_provider_unaffected():
    """provider==openai + quality → NO injection (shared-path byte-identical, D-14 RED LINE).

    The quality ``if`` guard fires on the strategy string, but the inner
    ``provider == 'openrouter'`` gate blocks the injection for OpenAI (and by the same
    gate, Anthropic/Google). This is the negative test that proves the shared path is
    provably untouched.
    """
    kwargs = _build_kwargs(_OPENAI_MODEL, active_provider="openai", strategy="quality")

    extra_body = kwargs.get("extra_body") or {}
    assert "provider" not in extra_body, (
        "non-OpenRouter provider must never receive the require_parameters injection (D-14)"
    )
    # And the OpenRouter-only quality modifiers must not appear either.
    assert "plugins" not in extra_body
    assert not kwargs.get("model", "").endswith(":exacto")
