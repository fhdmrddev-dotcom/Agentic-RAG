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


def test_execute_code_capability_facts():
    """SRH-01 D-04/D-05a (proactive layer): the EXECUTE_CODE_TOOL description itself
    must carry the Python-only capability facts so the model knows BEFORE it plans a
    call which runtimes are unavailable and cannot be installed.

    This is the single-source proactive gate — the facts live on the tool CONTRACT
    string (uniformly translated by every provider gateway), NOT on SYSTEM_PROMPT
    (D-14 byte-identical Deep invariant). We deliberately assert against the tool
    description ONLY; the facts must NOT be added to SYSTEM_PROMPT.
    """
    from app.services.openai_service import EXECUTE_CODE_TOOL

    desc = EXECUTE_CODE_TOOL["function"]["description"].lower()

    # NOT-available runtime tokens the model must be told it cannot shell out to.
    for token in ("soffice", "pandoc", "pdftoppm", "markitdown"):
        assert token in desc, f"capability facts missing NOT-available token: {token!r}"
    # Node/npm family — either token satisfies the "no JS runtime" fact.
    assert ("node" in desc) or ("npm" in desc), "capability facts missing node/npm"

    # At least one available pre-installed library must be named.
    assert "python-pptx" in desc, "capability facts missing an available library name"

    # A forward do-not instruction so the model does the work in-memory / tells the user.
    assert ("do not" in desc) or ("will fail" in desc), (
        "capability facts missing a 'do not' / 'will fail' instruction"
    )
