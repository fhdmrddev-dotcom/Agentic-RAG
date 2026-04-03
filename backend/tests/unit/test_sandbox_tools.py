"""Unit tests for sandbox tool registration in openai_service.

Tests verify EXECUTE_CODE_TOOL definition and conditional registration
in get_tools() based on sandbox_enabled setting.
"""
from unittest.mock import patch

import pytest


class TestExecuteCodeToolRegistration:
    def test_execute_code_in_tools_when_enabled(self):
        """When sandbox_enabled=True, get_tools() includes execute_code."""
        with patch("app.services.openai_service.settings") as mock_settings:
            mock_settings.sandbox_enabled = True
            mock_settings.web_search_enabled = False

            from app.services.openai_service import get_tools
            tools = get_tools()
            tool_names = [t["function"]["name"] for t in tools]
            assert "execute_code" in tool_names

    def test_execute_code_not_in_tools_when_disabled(self):
        """When sandbox_enabled=False (default), get_tools() does NOT include execute_code."""
        with patch("app.services.openai_service.settings") as mock_settings:
            mock_settings.sandbox_enabled = False
            mock_settings.web_search_enabled = False

            from app.services.openai_service import get_tools
            tools = get_tools()
            tool_names = [t["function"]["name"] for t in tools]
            assert "execute_code" not in tool_names

    def test_execute_code_not_in_explorer_tools(self):
        """get_explorer_tools() never includes execute_code regardless of sandbox_enabled."""
        from app.services.openai_service import get_explorer_tools
        tools = get_explorer_tools()
        tool_names = [t["function"]["name"] for t in tools]
        assert "execute_code" not in tool_names

    def test_execute_code_tool_schema(self):
        """EXECUTE_CODE_TOOL has correct schema: code required, libraries/output_files optional."""
        from app.services.openai_service import EXECUTE_CODE_TOOL
        fn = EXECUTE_CODE_TOOL["function"]
        assert fn["name"] == "execute_code"
        params = fn["parameters"]
        assert "code" in params["required"]
        assert "libraries" not in params.get("required", [])
        assert "output_files" not in params.get("required", [])
        props = params["properties"]
        assert props["code"]["type"] == "string"
        assert props["libraries"]["type"] == "array"
        assert props["libraries"]["items"]["type"] == "string"
        assert props["output_files"]["type"] == "array"
        assert props["output_files"]["items"]["type"] == "string"
