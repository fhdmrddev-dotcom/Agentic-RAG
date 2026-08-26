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


@patch("app.services.openai_service.get_llm_client")
@patch("app.services.openai_service._resolve_max_tokens")
@patch("app.services.openai_service._uses_max_completion_tokens")
def test_parallel_tool_calls_not_required_of_openrouter(mock_uses_max, mock_resolve_tokens, mock_get_client):
    """⚠ CHANGED BY BUG-260825-03, AND THE ORIGINAL ASSERTION IS PRESERVED ONE TEST DOWN.

    This test previously asserted ``parallel_tool_calls is False`` on the OpenRouter +
    ``quality`` path. That path ALSO sends ``provider.require_parameters: True``, which per
    OpenRouter's own provider-selection documentation stops being a preference and becomes a
    hard endpoint EXCLUSION — the documented cause of
    ``404 No endpoints found that can handle the requested parameters``. Requiring an
    endpoint to support a parameter we send purely as an optimisation shrank the candidate
    set for no benefit, so it is dropped on this path and ONLY on this path.
    """
    mock_client = MagicMock()
    mock_get_client.return_value = mock_client
    mock_resolve_tokens.return_value = 1000
    mock_uses_max.return_value = False

    user_settings = _make_user_settings()  # openrouter + quality
    messages = [{"role": "user", "content": "hello"}]

    from app.services.openai_service import create_adaptive_streaming_chat
    create_adaptive_streaming_chat(
        messages=messages,
        tool_choice="auto",
        user_settings=user_settings,
    )

    call_kwargs = mock_client.chat.completions.create.call_args.kwargs
    assert "parallel_tool_calls" not in call_kwargs
    # Positive control: the narrowing this test is about really WAS applied.
    assert call_kwargs["extra_body"]["provider"] == {"require_parameters": True}
    assert call_kwargs.get("tools"), "tools must still be attached — only the requirement moved"


@patch("app.services.openai_service.get_llm_client")
@patch("app.services.openai_service._resolve_max_tokens")
@patch("app.services.openai_service._uses_max_completion_tokens")
def test_parallel_tool_calls_false(mock_uses_max, mock_resolve_tokens, mock_get_client):
    """The ORIGINAL assertion, on a provider that never had the OpenRouter narrowing.

    ⚠ THIS IS THE SHARED-PATH GUARD: the BUG-260825-03 fix must not degrade every provider
    to fix one, so a non-OpenRouter call still carries ``parallel_tool_calls=False`` exactly
    as it always did."""
    mock_client = MagicMock()
    mock_get_client.return_value = mock_client
    mock_resolve_tokens.return_value = 1000
    mock_uses_max.return_value = False

    user_settings = _make_user_settings(provider="openai", llm_model="gpt-4o")
    messages = [{"role": "user", "content": "hello"}]

    from app.services.openai_service import create_adaptive_streaming_chat
    create_adaptive_streaming_chat(
        messages=messages,
        tool_choice="auto",
        user_settings=user_settings,
    )

    call_kwargs = mock_client.chat.completions.create.call_args.kwargs
    assert call_kwargs.get("parallel_tool_calls") is False
    assert "extra_body" not in call_kwargs, "no OpenRouter narrowing on a non-OpenRouter call"


@patch("app.services.openai_service.get_llm_client")
@patch("app.services.openai_service._resolve_max_tokens")
@patch("app.services.openai_service._uses_max_completion_tokens")
def test_exacto_appended_for_quality(mock_uses_max, mock_resolve_tokens, mock_get_client):
    mock_client = MagicMock()
    mock_get_client.return_value = mock_client
    mock_resolve_tokens.return_value = 1000
    mock_uses_max.return_value = False

    user_settings = _make_user_settings(llm_model="openrouter/anthropic/claude-sonnet-4.5")
    messages = [{"role": "user", "content": "hello"}]

    from app.services.openai_service import create_adaptive_streaming_chat
    create_adaptive_streaming_chat(
        messages=messages,
        tool_choice="auto",
        user_settings=user_settings,
    )

    call_kwargs = mock_client.chat.completions.create.call_args.kwargs
    assert ":exacto" in call_kwargs.get("model", "")


@patch("app.services.openai_service.get_llm_client")
@patch("app.services.openai_service._resolve_max_tokens")
@patch("app.services.openai_service._uses_max_completion_tokens")
def test_exacto_not_doubled(mock_uses_max, mock_resolve_tokens, mock_get_client):
    """If model already has :exacto, don't double-append."""
    mock_client = MagicMock()
    mock_get_client.return_value = mock_client
    mock_resolve_tokens.return_value = 1000
    mock_uses_max.return_value = False

    user_settings = _make_user_settings(llm_model="openrouter/gpt-4o:exacto")
    messages = [{"role": "user", "content": "hello"}]

    from app.services.openai_service import create_adaptive_streaming_chat
    create_adaptive_streaming_chat(
        messages=messages,
        tool_choice="auto",
        user_settings=user_settings,
    )

    call_kwargs = mock_client.chat.completions.create.call_args.kwargs
    model = call_kwargs.get("model", "")
    assert model.count(":exacto") == 1


@patch("app.services.openai_service.get_llm_client")
@patch("app.services.openai_service._resolve_max_tokens")
@patch("app.services.openai_service._uses_max_completion_tokens")
def test_response_healing_plugin(mock_uses_max, mock_resolve_tokens, mock_get_client):
    mock_client = MagicMock()
    mock_get_client.return_value = mock_client
    mock_resolve_tokens.return_value = 1000
    mock_uses_max.return_value = False

    user_settings = _make_user_settings()
    messages = [{"role": "user", "content": "hello"}]

    from app.services.openai_service import create_adaptive_streaming_chat
    create_adaptive_streaming_chat(
        messages=messages,
        tool_choice="auto",
        user_settings=user_settings,
    )

    call_kwargs = mock_client.chat.completions.create.call_args.kwargs
    extra_body = call_kwargs.get("extra_body", {})
    plugins = extra_body.get("plugins", [])
    assert any(p.get("id") == "response-healing" for p in plugins)


@patch("app.services.openai_service.get_llm_client")
@patch("app.services.openai_service._resolve_max_tokens")
@patch("app.services.openai_service._uses_max_completion_tokens")
def test_native_strategy_no_exacto(mock_uses_max, mock_resolve_tokens, mock_get_client):
    mock_client = MagicMock()
    mock_get_client.return_value = mock_client
    mock_resolve_tokens.return_value = 1000
    mock_uses_max.return_value = False

    user_settings = _make_user_settings(strategy="native")
    messages = [{"role": "user", "content": "hello"}]

    from app.services.openai_service import create_adaptive_streaming_chat
    create_adaptive_streaming_chat(
        messages=messages,
        tool_choice="auto",
        user_settings=user_settings,
    )

    call_kwargs = mock_client.chat.completions.create.call_args.kwargs
    assert ":exacto" not in call_kwargs.get("model", "")
    assert "extra_body" not in call_kwargs


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
