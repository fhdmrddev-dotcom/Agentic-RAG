"""Unit tests for app.services.openai_service client factory functions.

Settings are patched so no real environment values are needed.
"""
from unittest.mock import patch, MagicMock

import pytest


class TestGetLlmClient:
    def test_returns_openai_client_when_no_base_url(self):
        """When llm_base_url is empty, OpenAI is constructed without base_url."""
        with patch("app.services.openai_service.settings") as mock_settings:
            mock_settings.llm_api_key = "sk-test"
            mock_settings.llm_base_url = ""

            with patch("app.services.openai_service.OpenAI") as MockOpenAI:
                from app.services.openai_service import get_llm_client
                get_llm_client()
                MockOpenAI.assert_called_once_with(api_key="sk-test")

    def test_returns_client_with_custom_base_url_when_configured(self):
        """When llm_base_url is set, OpenAI is constructed with base_url."""
        with patch("app.services.openai_service.settings") as mock_settings:
            mock_settings.llm_api_key = "sk-openrouter"
            mock_settings.llm_base_url = "https://openrouter.ai/api/v1"

            with patch("app.services.openai_service.OpenAI") as MockOpenAI:
                from app.services.openai_service import get_llm_client
                get_llm_client()
                MockOpenAI.assert_called_once_with(
                    api_key="sk-openrouter",
                    base_url="https://openrouter.ai/api/v1",
                )

    def test_client_uses_llm_api_key(self):
        """get_llm_client passes the llm_api_key."""
        with patch("app.services.openai_service.settings") as mock_settings:
            mock_settings.llm_api_key = "my-special-key"
            mock_settings.llm_base_url = ""

            with patch("app.services.openai_service.OpenAI") as MockOpenAI:
                from app.services.openai_service import get_llm_client
                get_llm_client()
                call_kwargs = MockOpenAI.call_args[1]
                assert call_kwargs["api_key"] == "my-special-key"


class TestGetEmbeddingClient:
    def test_falls_back_to_llm_key_when_embedding_api_key_empty(self):
        """When embedding_api_key is empty, the llm_api_key is used."""
        with patch("app.services.openai_service.settings") as mock_settings:
            mock_settings.llm_api_key = "sk-llm-fallback"
            mock_settings.embedding_api_key = ""
            mock_settings.embedding_base_url = ""

            with patch("app.services.openai_service.OpenAI") as MockOpenAI:
                from app.services.openai_service import get_embedding_client
                get_embedding_client()
                call_kwargs = MockOpenAI.call_args[1]
                assert call_kwargs["api_key"] == "sk-llm-fallback"

    def test_uses_dedicated_embedding_key_when_provided(self):
        """When embedding_api_key is set, it is used instead of llm_api_key."""
        with patch("app.services.openai_service.settings") as mock_settings:
            mock_settings.llm_api_key = "sk-llm"
            mock_settings.embedding_api_key = "sk-embed-dedicated"
            mock_settings.embedding_base_url = ""

            with patch("app.services.openai_service.OpenAI") as MockOpenAI:
                from app.services.openai_service import get_embedding_client
                get_embedding_client()
                call_kwargs = MockOpenAI.call_args[1]
                assert call_kwargs["api_key"] == "sk-embed-dedicated"

    def test_uses_embedding_base_url_when_configured(self):
        """When embedding_base_url is set, it is passed to OpenAI constructor."""
        with patch("app.services.openai_service.settings") as mock_settings:
            mock_settings.llm_api_key = "sk-llm"
            mock_settings.embedding_api_key = "sk-embed"
            mock_settings.embedding_base_url = "https://custom-embed.example.com/v1"

            with patch("app.services.openai_service.OpenAI") as MockOpenAI:
                from app.services.openai_service import get_embedding_client
                get_embedding_client()
                call_kwargs = MockOpenAI.call_args[1]
                assert call_kwargs["base_url"] == "https://custom-embed.example.com/v1"

    def test_no_base_url_when_embedding_base_url_empty(self):
        """When embedding_base_url is empty and no LLM base_url, base_url is not passed."""
        with patch("app.services.openai_service.settings") as mock_settings:
            mock_settings.llm_api_key = "sk-llm"
            mock_settings.llm_base_url = ""
            mock_settings.embedding_api_key = ""
            mock_settings.embedding_base_url = ""

            with patch("app.services.openai_service.OpenAI") as MockOpenAI:
                from app.services.openai_service import get_embedding_client
                get_embedding_client()
                call_kwargs = MockOpenAI.call_args[1]
                assert "base_url" not in call_kwargs


class TestQueryTablesTool:
    def test_query_tables_in_general_tools(self):
        """MODAL-03/D-07: QUERY_TABLES_TOOL is included in get_tools() (General Mode)."""
        from app.services.openai_service import get_tools
        with patch("app.services.openai_service.settings") as mock_settings:
            mock_settings.web_search_enabled = False
            mock_settings.sandbox_enabled = False
            tools = get_tools()
        names = [t["function"]["name"] for t in tools]
        assert "query_tables" in names

    def test_query_tables_not_in_explorer_tools(self):
        """MODAL-03/D-07: QUERY_TABLES_TOOL is NOT in get_explorer_tools() (Explorer Mode)."""
        from app.services.openai_service import get_explorer_tools
        tools = get_explorer_tools()
        names = [t["function"]["name"] for t in tools]
        assert "query_tables" not in names


# ---------------------------------------------------------------------------
# OpenRouter quality enhancements — TOOL-01
# ---------------------------------------------------------------------------

def _make_user_settings(
    provider: str = "openrouter",
    llm_model: str = "openrouter/gpt-4o",
    strategy: str = "quality",
    llm_max_output_tokens: int = 0,
):
    from types import SimpleNamespace
    return SimpleNamespace(
        active_provider=provider,
        llm_model=llm_model,
        llm_max_output_tokens=llm_max_output_tokens,
        openrouter_tool_strategy=strategy,
        web_search_enabled=False,
        sandbox_enabled=False,
    )


# ---------------------------------------------------------------------------
# GEN-02/GEN-05: _resolve_max_tokens provider bypass
# These tests are RED until Wave 1 (054-02-PLAN.md) adds NATIVE_PROVIDERS bypass.
# ---------------------------------------------------------------------------

class TestResolveMaxTokensProviderBypass:
    """_resolve_max_tokens must bypass user override for openai/anthropic/google."""

    def _call(self, provider, llm_model, user_override):
        with patch("app.services.openai_service.settings") as mock_settings:
            mock_settings.llm_max_output_tokens = 8192  # env default — should not interfere
            mock_settings.llm_provider = provider
            mock_settings.llm_model = llm_model
            mock_settings.model_output_limits = ""
            from app.services.openai_service import _resolve_max_tokens
            us = _make_user_settings(
                provider=provider,
                llm_model=llm_model,
                llm_max_output_tokens=user_override,
            )
            return _resolve_max_tokens(None, us)

    def test_anthropic_provider_ignores_user_override(self):
        """Stale override=4096 must NOT cap Anthropic calls."""
        result = self._call("anthropic", "claude-sonnet-4-6", 4096)
        assert result != 4096, (
            f"Expected bypass (result != 4096) but got {result}. "
            "NATIVE_PROVIDERS bypass not yet implemented — will be fixed in 054-02-PLAN.md"
        )

    def test_openai_provider_ignores_user_override(self):
        """Stale override=4096 must NOT cap OpenAI calls."""
        result = self._call("openai", "gpt-4o", 4096)
        assert result != 4096, f"Expected bypass but got {result}"

    def test_google_provider_ignores_user_override(self):
        """Stale override=4096 must NOT cap Google calls."""
        result = self._call("google", "gemini-2.5-flash", 4096)
        assert result != 4096, f"Expected bypass but got {result}"

    def test_openrouter_provider_respects_user_override(self):
        """OpenRouter MUST respect user override — no bypass."""
        result = self._call("openrouter", "openrouter/gpt-4o", 4096)
        assert result == 4096, f"Expected 4096 (user override) but got {result}"

    def test_ollama_provider_respects_user_override(self):
        """Ollama MUST respect user override — no bypass."""
        result = self._call("ollama", "llama3", 2048)
        assert result == 2048, f"Expected 2048 (user override) but got {result}"
