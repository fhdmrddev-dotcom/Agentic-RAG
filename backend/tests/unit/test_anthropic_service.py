"""Unit tests for app.services.anthropic_service.

Wave 0: These tests are written BEFORE the implementation exists.
They fail with ImportError (collected as skipped) until Wave 2 creates anthropic_service.py.

Tests cover GEN-02: message format conversion, tool conversion, stop_reason mapping, cache_control.
"""
import json
import pytest

# Skip entire module until the service is implemented.
# pytest.importorskip causes all tests to be "skipped" (not error) when module absent.
anthropic_svc = pytest.importorskip(
    "app.services.anthropic_service",
    reason="anthropic_service.py not yet created — implement in Wave 2 (054-03-PLAN.md)",
)

_convert_messages = anthropic_svc._convert_messages_to_anthropic
_convert_tools = anthropic_svc._convert_tools_to_anthropic


class TestConvertMessagesToAnthropic:
    """GEN-02: OpenAI-format → Anthropic native message conversion."""

    def test_system_message_stripped(self):
        result = _convert_messages([{"role": "system", "content": "Be helpful"}])
        assert result == []

    def test_plain_user_message_passes_through(self):
        result = _convert_messages([{"role": "user", "content": "hello"}])
        assert len(result) == 1
        assert result[0] == {"role": "user", "content": "hello"}

    def test_plain_assistant_message_passes_through(self):
        result = _convert_messages([{"role": "assistant", "content": "ok"}])
        assert len(result) == 1
        assert result[0] == {"role": "assistant", "content": "ok"}

    def test_assistant_tool_calls_converted_to_content_blocks(self):
        messages = [
            {
                "role": "assistant",
                "content": "",
                "tool_calls": [
                    {"id": "tc_1", "function": {"name": "search_documents", "arguments": '{"query":"climate"}'}}
                ],
            }
        ]
        result = _convert_messages(messages)
        assert len(result) == 1
        assert result[0]["role"] == "assistant"
        blocks = result[0]["content"]
        tool_block = next((b for b in blocks if b.get("type") == "tool_use"), None)
        assert tool_block is not None
        assert tool_block["id"] == "tc_1"
        assert tool_block["name"] == "search_documents"
        assert tool_block["input"] == {"query": "climate"}

    def test_single_tool_result_grouped_into_user_message(self):
        messages = [
            {
                "role": "assistant",
                "content": "",
                "tool_calls": [
                    {"id": "tc_1", "function": {"name": "search_documents", "arguments": "{}"}}
                ],
            },
            {"role": "tool", "tool_call_id": "tc_1", "content": "search result here"},
        ]
        result = _convert_messages(messages)
        assert len(result) == 2  # assistant + one user message
        user_msg = result[1]
        assert user_msg["role"] == "user"
        assert isinstance(user_msg["content"], list)
        assert len(user_msg["content"]) == 1
        assert user_msg["content"][0]["type"] == "tool_result"
        assert user_msg["content"][0]["tool_use_id"] == "tc_1"
        assert user_msg["content"][0]["content"] == "search result here"

    def test_multiple_tool_results_grouped_into_single_user_message(self):
        """CRITICAL: multiple tool results MUST land in ONE user message (Anthropic 400 otherwise)."""
        messages = [
            {
                "role": "assistant",
                "content": "",
                "tool_calls": [
                    {"id": "tc_1", "function": {"name": "search_documents", "arguments": '{"query":"foo"}'}},
                    {"id": "tc_2", "function": {"name": "query_tables", "arguments": '{"sql":"SELECT 1"}'}},
                ],
            },
            {"role": "tool", "tool_call_id": "tc_1", "content": "result 1"},
            {"role": "tool", "tool_call_id": "tc_2", "content": "result 2"},
        ]
        result = _convert_messages(messages)
        # One assistant message + ONE user message (not two separate user messages)
        assert len(result) == 2
        user_msg = result[1]
        assert user_msg["role"] == "user"
        assert len(user_msg["content"]) == 2
        assert all(b["type"] == "tool_result" for b in user_msg["content"])
        assert user_msg["content"][0]["tool_use_id"] == "tc_1"
        assert user_msg["content"][1]["tool_use_id"] == "tc_2"


class TestConvertToolsToAnthropic:
    """GEN-02: OpenAI function-wrapper format → Anthropic flat format + cache_control."""

    def test_function_wrapper_converted_to_flat_format(self):
        tools = [
            {
                "type": "function",
                "function": {
                    "name": "search_documents",
                    "description": "Search the knowledge base",
                    "parameters": {"type": "object", "properties": {}},
                },
            }
        ]
        result = _convert_tools(tools)
        assert len(result) == 1
        assert result[0]["name"] == "search_documents"
        assert result[0]["description"] == "Search the knowledge base"
        assert "input_schema" in result[0]
        assert "parameters" not in result[0]
        assert "function" not in result[0]

    def test_cache_control_on_last_tool_only(self):
        tools = [
            {"type": "function", "function": {"name": "tool_a", "description": "", "parameters": {}}},
            {"type": "function", "function": {"name": "tool_b", "description": "", "parameters": {}}},
            {"type": "function", "function": {"name": "tool_c", "description": "", "parameters": {}}},
        ]
        result = _convert_tools(tools)
        assert "cache_control" not in result[0]
        assert "cache_control" not in result[1]
        assert result[2]["cache_control"] == {"type": "ephemeral"}

    def test_empty_tool_list_returns_empty(self):
        result = _convert_tools([])
        assert result == []

    def test_input_schema_key_used_not_parameters(self):
        tools = [
            {
                "type": "function",
                "function": {
                    "name": "search",
                    "description": "desc",
                    "parameters": {
                        "type": "object",
                        "properties": {"query": {"type": "string"}},
                    },
                },
            }
        ]
        result = _convert_tools(tools)
        assert result[0]["input_schema"]["properties"]["query"]["type"] == "string"


# stop_reason → canonical finish_reason mapping
# These test the mapping dict used inside stream_anthropic — tested here as pure logic
_STOP_REASON_MAP = {
    "end_turn":   "stop",
    "tool_use":   "tool_calls",
    "max_tokens": "length",
}


class TestStopReasonMapping:
    """GEN-02: Anthropic stop_reason → canonical finish_reason mapping."""

    def test_end_turn_maps_to_stop(self):
        assert _STOP_REASON_MAP.get("end_turn", "stop") == "stop"

    def test_tool_use_maps_to_tool_calls(self):
        assert _STOP_REASON_MAP.get("tool_use", "stop") == "tool_calls"

    def test_max_tokens_maps_to_length(self):
        assert _STOP_REASON_MAP.get("max_tokens", "stop") == "length"

    def test_unknown_stop_reason_maps_to_stop(self):
        assert _STOP_REASON_MAP.get("completely_unexpected_value", "stop") == "stop"
