"""Unit tests for Module 7 tool registration and get_tools().

Verifies that the correct tools are exposed to the LLM based on config,
and that tool schemas meet OpenAI function-calling requirements.
"""
from unittest.mock import patch

import pytest

from app.services.openai_service import (
    QUERY_DOCUMENTS_TOOL,
    SEARCH_DOCUMENTS_TOOL,
    WEB_SEARCH_TOOL,
    get_tools,
)


# ── Tool schema structure ─────────────────────────────────────────────────────

class TestToolSchemas:
    @pytest.mark.parametrize("tool", [SEARCH_DOCUMENTS_TOOL, QUERY_DOCUMENTS_TOOL, WEB_SEARCH_TOOL])
    def test_tool_has_type_function(self, tool):
        assert tool["type"] == "function"

    @pytest.mark.parametrize("tool", [SEARCH_DOCUMENTS_TOOL, QUERY_DOCUMENTS_TOOL, WEB_SEARCH_TOOL])
    def test_tool_has_name(self, tool):
        assert "name" in tool["function"]
        assert tool["function"]["name"]

    @pytest.mark.parametrize("tool", [SEARCH_DOCUMENTS_TOOL, QUERY_DOCUMENTS_TOOL, WEB_SEARCH_TOOL])
    def test_tool_has_description(self, tool):
        assert "description" in tool["function"]
        assert len(tool["function"]["description"]) > 10

    @pytest.mark.parametrize("tool", [SEARCH_DOCUMENTS_TOOL, QUERY_DOCUMENTS_TOOL, WEB_SEARCH_TOOL])
    def test_tool_parameters_has_required_fields(self, tool):
        params = tool["function"]["parameters"]
        assert params["type"] == "object"
        assert "properties" in params
        assert "required" in params

    def test_search_documents_requires_query(self):
        assert "query" in SEARCH_DOCUMENTS_TOOL["function"]["parameters"]["required"]

    def test_query_documents_requires_query(self):
        assert "query" in QUERY_DOCUMENTS_TOOL["function"]["parameters"]["required"]

    def test_web_search_requires_query(self):
        assert "query" in WEB_SEARCH_TOOL["function"]["parameters"]["required"]

    def test_search_documents_has_optional_metadata_filter(self):
        props = SEARCH_DOCUMENTS_TOOL["function"]["parameters"]["properties"]
        assert "metadata_filter" in props
        assert "metadata_filter" not in SEARCH_DOCUMENTS_TOOL["function"]["parameters"]["required"]

    def test_query_documents_name_is_query_documents(self):
        assert QUERY_DOCUMENTS_TOOL["function"]["name"] == "query_documents"

    def test_web_search_name_is_web_search(self):
        assert WEB_SEARCH_TOOL["function"]["name"] == "web_search"

    def test_query_documents_description_mentions_documents_table(self):
        desc = QUERY_DOCUMENTS_TOOL["function"]["description"]
        assert "documents" in desc.lower()

    def test_web_search_description_mentions_citing_sources(self):
        desc = WEB_SEARCH_TOOL["function"]["description"]
        assert "cite" in desc.lower() or "url" in desc.lower()


# ── get_tools() — web search enabled/disabled ─────────────────────────────────

class TestGetTools:
    def test_includes_search_documents_always(self):
        with patch("app.services.openai_service.settings") as mock_settings:
            mock_settings.web_search_enabled = False
            tools = get_tools()
        names = [t["function"]["name"] for t in tools]
        assert "search_documents" in names

    def test_includes_query_documents_always(self):
        with patch("app.services.openai_service.settings") as mock_settings:
            mock_settings.web_search_enabled = False
            tools = get_tools()
        names = [t["function"]["name"] for t in tools]
        assert "query_documents" in names

    def test_excludes_web_search_when_disabled(self):
        with patch("app.services.openai_service.settings") as mock_settings:
            mock_settings.web_search_enabled = False
            tools = get_tools()
        names = [t["function"]["name"] for t in tools]
        assert "web_search" not in names

    def test_includes_web_search_when_enabled(self):
        with patch("app.services.openai_service.settings") as mock_settings:
            mock_settings.web_search_enabled = True
            tools = get_tools()
        names = [t["function"]["name"] for t in tools]
        assert "web_search" in names

    def test_returns_base_tools_without_tavily_or_sandbox(self):
        """get_tools() returns 14 base tools when web_search and sandbox are both disabled."""
        with patch("app.services.openai_service.settings") as mock_settings:
            mock_settings.web_search_enabled = False
            mock_settings.sandbox_enabled = False
            tools = get_tools()
        assert len(tools) == 14

    def test_returns_one_more_tool_with_tavily(self):
        """Adding web_search gives 15 tools (14 base + web_search)."""
        with patch("app.services.openai_service.settings") as mock_settings:
            mock_settings.web_search_enabled = True
            mock_settings.sandbox_enabled = False
            tools = get_tools()
        assert len(tools) == 15

    def test_search_and_query_are_first_two_tools(self):
        """search_documents and query_documents remain first two tools regardless of config."""
        with patch("app.services.openai_service.settings") as mock_settings:
            mock_settings.web_search_enabled = True
            mock_settings.sandbox_enabled = False
            tools = get_tools()
        names = [t["function"]["name"] for t in tools]
        assert names[0] == "search_documents"
        assert names[1] == "query_documents"
