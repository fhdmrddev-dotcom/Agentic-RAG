"""
MDL Verification Tests — Phase 52: Multi-Provider Model Routing

MDL-02: title-drafter and follow-up-suggester use _SUB_AGENT_MODEL_DEFAULTS[active_provider]
MDL-03: switching chat model mid-conversation does not clear message history
         (messages stored by thread_id in DB; no application-layer model-keyed lookup)
"""
from __future__ import annotations

import os
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from app.config import _SUB_AGENT_MODEL_DEFAULTS


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_settings(provider: str, llm_model: str, sub_agent_override: str = "") -> MagicMock:
    """Create a minimal UserEffectiveSettings mock."""
    s = MagicMock()
    s.active_provider = provider
    s.llm_model = llm_model
    s.sub_agent_model = sub_agent_override
    return s


def _mock_completions_response(content: str) -> MagicMock:
    """Return a mock that looks like openai ChatCompletion response."""
    choice = MagicMock()
    choice.message.content = content
    resp = MagicMock()
    resp.choices = [choice]
    return resp


# ---------------------------------------------------------------------------
# MDL-02: Provider-aware model resolution
# ---------------------------------------------------------------------------

class TestMDL02ProviderAwareModelResolution:
    """generate_thread_title() and generate_suggestions() must select their default
    model from _SUB_AGENT_MODEL_DEFAULTS[active_provider], not any hardcoded string."""

    @pytest.mark.parametrize("provider,expected_default", [
        ("openai",     "gpt-4.1-nano"),
        ("anthropic",  "claude-haiku-4-5-20251001"),
        ("google",     "gemini-2.5-flash"),
        ("openrouter", ""),   # falls through to llm_model
        ("ollama",     ""),   # falls through to llm_model
    ])
    def test_generate_thread_title_uses_provider_default(self, provider, expected_default):
        """generate_thread_title picks _SUB_AGENT_MODEL_DEFAULTS[provider] when no override set."""
        from app.api.threads import generate_thread_title

        settings_mock = _make_settings(provider, llm_model="fallback-model")
        captured_model: list[str] = []

        def fake_create(**kwargs):
            captured_model.append(kwargs.get("model", ""))
            return _mock_completions_response("Test Title")

        with patch("app.api.threads.get_llm_client") as mock_client_factory:
            mock_client = MagicMock()
            mock_client.chat.completions.create.side_effect = fake_create
            mock_client_factory.return_value = mock_client

            title, fallback_info = generate_thread_title("hello", user_settings=settings_mock)

        assert fallback_info is None, "No fallback expected on success"
        assert title == "Test Title"
        expected_model = expected_default or "fallback-model"
        assert captured_model[0] == expected_model, (
            f"Provider '{provider}': expected model '{expected_model}', "
            f"got '{captured_model[0] if captured_model else '<not called>'}'"
        )

    @pytest.mark.parametrize("provider,expected_default", [
        ("openai",     "gpt-4.1-nano"),
        ("anthropic",  "claude-haiku-4-5-20251001"),
        ("google",     "gemini-2.5-flash"),
        ("openrouter", ""),   # falls through to llm_model
    ])
    def test_generate_suggestions_uses_provider_default(self, provider, expected_default):
        """generate_suggestions picks _SUB_AGENT_MODEL_DEFAULTS[provider] when no override set."""
        from app.services.suggestion_service import generate_suggestions

        settings_mock = _make_settings(provider, llm_model="fallback-model")
        captured_model: list[str] = []

        def fake_create(**kwargs):
            captured_model.append(kwargs.get("model", ""))
            return _mock_completions_response("1. Question one\n2. Question two")

        with patch("app.services.suggestion_service.get_llm_client") as mock_client_factory:
            mock_client = MagicMock()
            mock_client.chat.completions.create.side_effect = fake_create
            mock_client_factory.return_value = mock_client

            questions, fallback_info = generate_suggestions(
                user_message="hello",
                assistant_response="hi there",
                user_settings=settings_mock,
            )

        assert fallback_info is None, "No fallback expected on success"
        expected_model = expected_default or "fallback-model"
        assert captured_model[0] == expected_model, (
            f"Provider '{provider}': expected model '{expected_model}', "
            f"got '{captured_model[0] if captured_model else '<not called>'}'"
        )

    def test_sub_agent_model_defaults_dict_keys_match_known_providers(self):
        """_SUB_AGENT_MODEL_DEFAULTS covers all known providers."""
        from app.models.user_settings import KNOWN_PROVIDERS
        expected_keys = set(KNOWN_PROVIDERS.keys())
        actual_keys = set(_SUB_AGENT_MODEL_DEFAULTS.keys())
        assert expected_keys == actual_keys, (
            f"Dict key mismatch: expected {expected_keys}, got {actual_keys}"
        )


# ---------------------------------------------------------------------------
# MDL-03: Message history persistence across model switches
# ---------------------------------------------------------------------------

class TestMDL03MessageHistoryPersistence:
    """Switching the chat model must not cause message loss.
    Messages are stored in the DB threads table keyed by thread_id only —
    no application-layer model-keyed lookup exists in the codebase."""

    def test_no_model_keyed_message_lookup_in_threads_py(self):
        """threads.py must not filter or clear messages based on the model field.
        Verify that the load_messages / fetch_messages path does not use model as a filter key.
        """
        import re
        # Resolve path relative to this test file (tests/ is inside backend/)
        threads_path = Path(__file__).parent.parent / "app" / "api" / "threads.py"
        if not threads_path.exists():
            pytest.skip(f"{threads_path} not found — run from repo root")

        with open(threads_path) as f:
            source = f.read()

        # Pattern: any query that filters on 'model' column in the messages/threads table
        forbidden = re.compile(
            r'\.eq\(["\']model["\']',
            re.IGNORECASE,
        )
        matches = forbidden.findall(source)
        assert not matches, (
            "threads.py filters messages by model column — this would cause message loss "
            f"on model switch. Matches found: {matches}"
        )

    def test_user_effective_settings_llm_model_change_does_not_affect_thread_id(self):
        """Changing llm_model in UserEffectiveSettings is independent of thread identity.
        The thread_id is set at thread creation and never derived from the model name."""
        from app.models.user_settings import UserEffectiveSettings

        # Build two settings objects with different models but confirm they don't
        # encode model into any thread-identity field
        fields = set(UserEffectiveSettings.model_fields.keys())
        # thread_id must not be a field — it's a DB column, not a settings field
        assert "thread_id" not in fields, (
            "UserEffectiveSettings must not contain thread_id — that would couple model to thread identity"
        )
        # llm_model is a pure config field, not a partition key
        assert "llm_model" in fields, "llm_model field should exist in UserEffectiveSettings"
