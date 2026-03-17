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
        """When embedding_base_url is empty, base_url is not passed."""
        with patch("app.services.openai_service.settings") as mock_settings:
            mock_settings.llm_api_key = "sk-llm"
            mock_settings.embedding_api_key = ""
            mock_settings.embedding_base_url = ""

            with patch("app.services.openai_service.OpenAI") as MockOpenAI:
                from app.services.openai_service import get_embedding_client
                get_embedding_client()
                call_kwargs = MockOpenAI.call_args[1]
                assert "base_url" not in call_kwargs
