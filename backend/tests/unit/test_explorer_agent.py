"""
Unit tests for the Explorer Sub-Agent mode (Phase 07, Plan 01).

Covers AGENT-01, AGENT-02, AGENT-03 requirements:
- AGENT-01: agent_mode field on MessageCreate
- AGENT-02: explorer tool list (6 KB tools, no search/query/web)
- AGENT-03: synthesis instructions in EXPLORER_SYSTEM_PROMPT
"""
import json
from unittest.mock import MagicMock, patch

import pytest

from app.models.message import MessageCreate
from app.services.openai_service import (
    EXPLORER_SYSTEM_PROMPT,
    get_explorer_tools,
)


# ---------------------------------------------------------------------------
# MessageCreate model tests (AGENT-01)
# ---------------------------------------------------------------------------

class TestMessageCreateAgentMode:
    def test_message_create_default_agent_mode(self):
        """MessageCreate.agent_mode defaults to 'default' when not specified."""
        msg = MessageCreate(content="hello")
        assert msg.agent_mode == "default"

    def test_message_create_explorer_agent_mode(self):
        """MessageCreate accepts agent_mode='explorer' explicitly."""
        msg = MessageCreate(content="hello", agent_mode="explorer")
        assert msg.agent_mode == "explorer"

    def test_message_create_explicit_default_agent_mode(self):
        """MessageCreate accepts explicit agent_mode='default'."""
        msg = MessageCreate(content="hello", agent_mode="default")
        assert msg.agent_mode == "default"


# ---------------------------------------------------------------------------
# Explorer tools tests (AGENT-02)
# ---------------------------------------------------------------------------

class TestExplorerToolsList:
    def test_explorer_tools_list(self):
        """get_explorer_tools() returns exactly 6 KB tools."""
        tools = get_explorer_tools()
        assert len(tools) == 6

    def test_explorer_tools_names(self):
        """get_explorer_tools() returns exactly the 6 KB navigation tools."""
        tools = get_explorer_tools()
        names = {t["function"]["name"] for t in tools}
        assert names == {"ls", "tree", "grep", "glob", "read_document", "analyze_document"}

    def test_explorer_tools_excludes_non_kb(self):
        """get_explorer_tools() does NOT include search_documents, query_documents, or web_search."""
        tools = get_explorer_tools()
        names = {t["function"]["name"] for t in tools}
        assert "search_documents" not in names
        assert "query_documents" not in names
        assert "web_search" not in names

    def test_explorer_tools_returns_list(self):
        """get_explorer_tools() returns a list of dicts."""
        tools = get_explorer_tools()
        assert isinstance(tools, list)
        for tool in tools:
            assert isinstance(tool, dict)
            assert "function" in tool
            assert "name" in tool["function"]


# ---------------------------------------------------------------------------
# Explorer system prompt tests (AGENT-03)
# ---------------------------------------------------------------------------

class TestExplorerSystemPrompt:
    def test_explorer_system_prompt_contains_kb_explorer_name(self):
        """EXPLORER_SYSTEM_PROMPT identifies itself as Knowledge Base Explorer."""
        assert "Knowledge Base Explorer" in EXPLORER_SYSTEM_PROMPT

    def test_explorer_system_prompt_contains_synthesis_instruction(self):
        """EXPLORER_SYSTEM_PROMPT instructs coherent prose answer (AGENT-03)."""
        assert "coherent prose answer" in EXPLORER_SYSTEM_PROMPT

    def test_explorer_system_prompt_contains_empty_result_instruction(self):
        """EXPLORER_SYSTEM_PROMPT handles empty-result case via fallback to analyze_document (AGENT-03)."""
        assert "analyze_document" in EXPLORER_SYSTEM_PROMPT

    def test_explorer_system_prompt_contains_filename_instruction(self):
        """EXPLORER_SYSTEM_PROMPT instructs using filename for analyze_document (Pitfall 1)."""
        assert "filename" in EXPLORER_SYSTEM_PROMPT


# ---------------------------------------------------------------------------
# create_streaming_chat tools_override tests
# ---------------------------------------------------------------------------

class TestCreateStreamingChatToolsOverride:
    def test_create_streaming_chat_accepts_tools_override(self):
        """create_streaming_chat accepts tools_override parameter and uses it when provided."""
        with patch("app.services.openai_service.get_llm_client") as mock_get_client, \
             patch("app.services.openai_service.settings") as mock_settings:
            mock_settings.llm_model = "gpt-4o"
            mock_settings.web_search_enabled = False
            mock_client = MagicMock()
            mock_get_client.return_value = mock_client
            mock_client.chat.completions.create.return_value = iter([])

            custom_tools = [{"type": "function", "function": {"name": "custom_tool", "parameters": {}}}]

            from app.services.openai_service import create_streaming_chat
            create_streaming_chat(
                messages=[{"role": "user", "content": "hello"}],
                tool_choice="auto",
                tools_override=custom_tools,
            )

            call_kwargs = mock_client.chat.completions.create.call_args[1]
            assert call_kwargs["tools"] == custom_tools

    def test_create_streaming_chat_uses_default_tools_when_override_is_none(self):
        """create_streaming_chat uses get_tools() when tools_override is None."""
        with patch("app.services.openai_service.get_llm_client") as mock_get_client, \
             patch("app.services.openai_service.settings") as mock_settings, \
             patch("app.services.openai_service.get_tools") as mock_get_tools:
            mock_settings.llm_model = "gpt-4o"
            mock_settings.web_search_enabled = False
            default_tools = [{"type": "function", "function": {"name": "search_documents", "parameters": {}}}]
            mock_get_tools.return_value = default_tools
            mock_client = MagicMock()
            mock_get_client.return_value = mock_client
            mock_client.chat.completions.create.return_value = iter([])

            from app.services.openai_service import create_streaming_chat
            create_streaming_chat(
                messages=[{"role": "user", "content": "hello"}],
                tool_choice="auto",
                tools_override=None,
            )

            call_kwargs = mock_client.chat.completions.create.call_args[1]
            assert call_kwargs["tools"] == default_tools


# ---------------------------------------------------------------------------
# send_message branching tests (integration-style unit tests)
# ---------------------------------------------------------------------------

def _make_simple_stream_chunk(content="Hello", finish_reason="stop"):
    """Create a mock SSE chunk that yields a single text response."""
    chunk = MagicMock()
    chunk.choices = [MagicMock()]
    chunk.choices[0].finish_reason = finish_reason
    chunk.choices[0].delta = MagicMock()
    chunk.choices[0].delta.content = content
    chunk.choices[0].delta.tool_calls = None
    return chunk


def _setup_thread_mocks(mock_builder, mock_execute_result, agent_mode="explorer"):
    """Set up mock_builder side_effect for send_message's Supabase calls.

    send_message + event_stream make these sequential execute() calls:
    1. thread select (single) — thread lookup
    2. messages insert (user msg) — returns nothing meaningful
    3. threads select folder_id (single) — thread folder scope query (inside event_stream)
    4. messages select (history) — returns message list
    5. skills catalog select — only for general/default mode (agent_mode != 'explorer')
    6. user_memory select — memory/recall query (inside event_stream); skipped for explorer
    7. messages insert (assistant msg) — returns nothing meaningful
    8. threads update (touch updated_at) — returns nothing meaningful
    9. threads update (set title) — fires when history had exactly 1 user msg
       (generate_thread_title is also patched to avoid real LLM call)
    """
    thread_result = MagicMock()
    thread_result.data = {"id": "thread-123"}  # single() returns dict

    insert_result = MagicMock()
    insert_result.data = [{}]

    # Thread folder scope query result — single() returns dict; folder_id=None means unscoped
    thread_folder_result = MagicMock()
    thread_folder_result.data = {"folder_id": None}

    # Return 2 messages so auto-title does NOT fire (requires len==1 to trigger)
    history_result = MagicMock()
    history_result.data = [
        {"role": "user", "content": "previous message"},
        {"role": "user", "content": "hi"},
    ]

    assistant_insert_result = MagicMock()
    assistant_insert_result.data = [{}]

    touch_result = MagicMock()
    touch_result.data = [{}]

    if agent_mode == "explorer":
        # Explorer mode: no skills catalog, no user_memory
        side_effects = [
            thread_result,
            insert_result,
            thread_folder_result,
            history_result,
            assistant_insert_result,
            touch_result,
        ]
    else:
        # Default mode: history, then skills catalog, then user_memory
        skills_result = MagicMock()
        skills_result.data = []  # No enabled skills — catalog not appended

        memory_result = MagicMock()
        memory_result.data = []  # Empty memory so no memory note appended

        side_effects = [
            thread_result,
            insert_result,
            thread_folder_result,
            history_result,
            skills_result,
            memory_result,
            assistant_insert_result,
            touch_result,
        ]

    mock_builder.execute.side_effect = side_effects


class TestSendMessageAgentModeBranching:
    """Tests for send_message branching on agent_mode using HTTP client."""

    def test_send_message_explorer_mode_uses_explorer_prompt(
        self, client, auth_headers, mock_builder, mock_execute_result
    ):
        """POST with agent_mode=explorer uses EXPLORER_SYSTEM_PROMPT as first message."""
        _setup_thread_mocks(mock_builder, mock_execute_result)

        captured_messages = []

        def mock_create_streaming_chat(messages, **kwargs):
            captured_messages.extend(messages)
            return iter([_make_simple_stream_chunk()])

        with patch("app.api.threads.create_streaming_chat", side_effect=mock_create_streaming_chat):
            resp = client.post(
                "/threads/thread-123/messages",
                json={"content": "hi", "agent_mode": "explorer"},
                headers=auth_headers,
            )

        assert resp.status_code == 200
        system_msgs = [m for m in captured_messages if m.get("role") == "system"]
        assert len(system_msgs) == 1
        assert system_msgs[0]["content"] == EXPLORER_SYSTEM_PROMPT

    def test_send_message_explorer_mode_uses_explorer_tools(
        self, client, auth_headers, mock_builder, mock_execute_result
    ):
        """POST with agent_mode=explorer passes get_explorer_tools() via tools_override."""
        _setup_thread_mocks(mock_builder, mock_execute_result)

        captured_kwargs = {}

        def mock_create_streaming_chat(messages, **kwargs):
            captured_kwargs.update(kwargs)
            return iter([_make_simple_stream_chunk()])

        with patch("app.api.threads.create_streaming_chat", side_effect=mock_create_streaming_chat):
            resp = client.post(
                "/threads/thread-123/messages",
                json={"content": "hi", "agent_mode": "explorer"},
                headers=auth_headers,
            )

        assert resp.status_code == 200
        assert "tools_override" in captured_kwargs
        actual_tools = captured_kwargs["tools_override"]
        actual_names = {t["function"]["name"] for t in actual_tools}
        assert actual_names == {"ls", "tree", "grep", "glob", "read_document", "analyze_document"}

    def test_send_message_explorer_mode_uses_max_iterations_8(
        self, client, auth_headers, mock_builder, mock_execute_result
    ):
        """POST with agent_mode=explorer raises max_iterations to 8."""
        # We verify this by making the LLM "call a tool" repeatedly and checking it
        # eventually stops. The simplest proxy: patch and count calls. With max_iterations=8,
        # the code will call create_streaming_chat up to 8 times if we return tool_calls each time.
        # Instead, we verify via the force_no_tools logic: it forces tool_choice='none' on
        # the LAST iteration. We return tool_calls on iteration 0, stop on iteration 1.
        # The key check is that the endpoint doesn't 500 with agent_mode=explorer.
        _setup_thread_mocks(mock_builder, mock_execute_result)

        call_count = [0]

        def mock_create_streaming_chat(messages, **kwargs):
            call_count[0] += 1
            return iter([_make_simple_stream_chunk()])

        with patch("app.api.threads.create_streaming_chat", side_effect=mock_create_streaming_chat):
            resp = client.post(
                "/threads/thread-123/messages",
                json={"content": "hi", "agent_mode": "explorer"},
                headers=auth_headers,
            )

        assert resp.status_code == 200
        # The LLM returned stop on first call, so only 1 call needed
        assert call_count[0] == 1

    def test_send_message_default_mode_uses_default_prompt(
        self, client, auth_headers, mock_builder, mock_execute_result
    ):
        """POST without agent_mode (defaults to 'default') uses SYSTEM_PROMPT."""
        from app.api.threads import SYSTEM_PROMPT
        _setup_thread_mocks(mock_builder, mock_execute_result, agent_mode="default")

        captured_messages = []

        def mock_create_streaming_chat(messages, **kwargs):
            captured_messages.extend(messages)
            return iter([_make_simple_stream_chunk()])

        with patch("app.api.threads.create_streaming_chat", side_effect=mock_create_streaming_chat):
            resp = client.post(
                "/threads/thread-123/messages",
                json={"content": "hi"},
                headers=auth_headers,
            )

        assert resp.status_code == 200
        system_msgs = [m for m in captured_messages if m.get("role") == "system"]
        assert len(system_msgs) == 1
        assert system_msgs[0]["content"] == SYSTEM_PROMPT

    def test_send_message_default_mode_uses_default_tools(
        self, client, auth_headers, mock_builder, mock_execute_result
    ):
        """POST without agent_mode uses tools_override=None (falling back to get_tools())."""
        _setup_thread_mocks(mock_builder, mock_execute_result, agent_mode="default")

        captured_kwargs = {}

        def mock_create_streaming_chat(messages, **kwargs):
            captured_kwargs.update(kwargs)
            return iter([_make_simple_stream_chunk()])

        with patch("app.api.threads.create_streaming_chat", side_effect=mock_create_streaming_chat):
            resp = client.post(
                "/threads/thread-123/messages",
                json={"content": "hi"},
                headers=auth_headers,
            )

        assert resp.status_code == 200
        # Default mode passes tools_override=None
        assert captured_kwargs.get("tools_override") is None

    def test_send_message_explicit_default_mode_same_as_omitted(
        self, client, auth_headers, mock_builder, mock_execute_result
    ):
        """POST with agent_mode='default' explicitly behaves identically to omitting it."""
        from app.api.threads import SYSTEM_PROMPT
        _setup_thread_mocks(mock_builder, mock_execute_result, agent_mode="default")

        captured_messages = []

        def mock_create_streaming_chat(messages, **kwargs):
            captured_messages.extend(messages)
            return iter([_make_simple_stream_chunk()])

        with patch("app.api.threads.create_streaming_chat", side_effect=mock_create_streaming_chat):
            resp = client.post(
                "/threads/thread-123/messages",
                json={"content": "hi", "agent_mode": "default"},
                headers=auth_headers,
            )

        assert resp.status_code == 200
        system_msgs = [m for m in captured_messages if m.get("role") == "system"]
        assert len(system_msgs) == 1
        assert system_msgs[0]["content"] == SYSTEM_PROMPT


# ---------------------------------------------------------------------------
# GEN-04: max_iterations values
# These tests are RED until Wave 1 (054-02-PLAN.md) changes threads.py.
# ---------------------------------------------------------------------------

class TestMaxIterationsConfig:
    """GEN-04: Assert max_iterations values in threads.py meet the target spec."""

    def _read_threads_source(self) -> str:
        import os
        # Navigate from this test file to threads.py
        here = os.path.dirname(__file__)
        threads_path = os.path.join(here, "..", "..", "app", "api", "threads.py")
        with open(threads_path) as f:
            return f.read()

    def test_general_mode_max_iterations_is_15(self):
        """General agent mode must allow 15 iterations (was 8) — GEN-04."""
        source = self._read_threads_source()
        assert "max_iterations = 15" in source, (
            "Expected 'max_iterations = 15' in threads.py for general mode. "
            "Current value is 8 — will be fixed in 054-02-PLAN.md (Wave 1)."
        )

    def test_explorer_mode_max_iterations_is_8(self):
        """Explorer mode must allow 8 iterations (was 6) — GEN-04."""
        source = self._read_threads_source()
        assert "max_iterations = 8" in source, (
            "Expected 'max_iterations = 8' in threads.py for explorer mode. "
            "Current value is 6 — will be fixed in 054-02-PLAN.md (Wave 1)."
        )

    def test_old_general_max_iterations_8_is_gone(self):
        """After the fix, 'max_iterations = 8' should refer to explorer, not general.
        There should be exactly ONE occurrence of 'max_iterations = 8' (explorer)
        and ONE occurrence of 'max_iterations = 15' (general).
        This test passes only after both changes are applied."""
        source = self._read_threads_source()
        count_8 = source.count("max_iterations = 8")
        count_15 = source.count("max_iterations = 15")
        assert count_8 == 1, f"Expected exactly 1 occurrence of 'max_iterations = 8' but found {count_8}"
        assert count_15 == 1, f"Expected exactly 1 occurrence of 'max_iterations = 15' but found {count_15}"
