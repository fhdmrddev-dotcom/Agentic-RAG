"""
Unit tests for persistent tool memory — tool_call_id persistence and history reconstruction.
"""
import json
import os

os.environ.setdefault("SUPABASE_URL", "https://test.supabase.co")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key")
os.environ.setdefault("LLM_API_KEY", "test-llm-api-key")
os.environ.setdefault("LANGSMITH_TRACING", "false")
os.environ.setdefault("LANGSMITH_PROJECT", "test-project")

import pytest


# ---------------------------------------------------------------------------
# Task 1 tests — tool_call_id included in persisted_tool_calls dict
# ---------------------------------------------------------------------------

def _build_persisted_entry(tc: dict, tool_result: str, sub_agent_record=None) -> dict:
    """
    Inline reproduction of the persisted_tool_calls.append logic in threads.py.
    After Task 1 lands, this is what the code does:
      {
        "tool_call_id": tc["id"],
        "name": tool_name,
        "args": args,
        "result": tool_result[:2000],
        "status": "done",
        **({"sub_agent": sub_agent_record} if sub_agent_record else {}),
      }
    """
    entry = {
        "tool_call_id": tc["id"],
        "name": tc["name"],
        "args": json.loads(tc.get("arguments", "{}")),
        "result": tool_result[:2000],
        "status": "done",
    }
    if sub_agent_record:
        entry["sub_agent"] = sub_agent_record
    return entry


class TestPersistToolCallId:
    """Tests that verify tool_call_id is included in persisted tool call entries."""

    def test_tool_call_id_is_included(self):
        tc = {"id": "call_abc123", "name": "search_documents", "arguments": "{}"}
        entry = _build_persisted_entry(tc, "some result")
        assert entry["tool_call_id"] == "call_abc123"

    def test_result_capped_at_2000_chars(self):
        tc = {"id": "call_xyz", "name": "search_documents", "arguments": "{}"}
        long_result = "x" * 3000
        entry = _build_persisted_entry(tc, long_result)
        assert len(entry["result"]) == 2000

    def test_result_under_2000_chars_preserved(self):
        tc = {"id": "call_xyz", "name": "search_documents", "arguments": "{}"}
        short_result = "short result"
        entry = _build_persisted_entry(tc, short_result)
        assert entry["result"] == "short result"

    def test_sub_agent_record_included_when_present(self):
        tc = {"id": "call_sub", "name": "analyze_document", "arguments": "{}"}
        sub = {"document_id": "doc-1", "model": "gpt-4"}
        entry = _build_persisted_entry(tc, "analysis result", sub_agent_record=sub)
        assert entry["sub_agent"] == sub

    def test_sub_agent_not_included_when_none(self):
        tc = {"id": "call_no_sub", "name": "ls", "arguments": "{}"}
        entry = _build_persisted_entry(tc, "result", sub_agent_record=None)
        assert "sub_agent" not in entry

    def test_name_and_args_preserved(self):
        tc = {"id": "call_args", "name": "grep", "arguments": '{"pattern": "foo", "path": "/"}'}
        entry = _build_persisted_entry(tc, "result")
        assert entry["name"] == "grep"
        assert entry["args"] == {"pattern": "foo", "path": "/"}

    def test_status_is_done(self):
        tc = {"id": "call_status", "name": "ls", "arguments": "{}"}
        entry = _build_persisted_entry(tc, "result")
        assert entry["status"] == "done"


# ---------------------------------------------------------------------------
# Task 2 tests — _reconstruct_history helper
# These will fail until Task 2 is implemented (TDD RED for Task 2)
# ---------------------------------------------------------------------------

def _get_reconstruct_history():
    """Import _reconstruct_history from threads.py (added in Task 2)."""
    from app.api.threads import _reconstruct_history
    return _reconstruct_history


class TestReconstructHistory:
    """Tests that verify multi-turn tool call history reconstruction."""

    def test_user_message_passes_through(self):
        _reconstruct_history = _get_reconstruct_history()
        rows = [{"role": "user", "content": "Hello", "tool_calls": None}]
        result = _reconstruct_history(rows)
        assert result == [{"role": "user", "content": "Hello"}]

    def test_plain_assistant_message_passes_through(self):
        _reconstruct_history = _get_reconstruct_history()
        rows = [{"role": "assistant", "content": "Hi there", "tool_calls": None}]
        result = _reconstruct_history(rows)
        assert result == [{"role": "assistant", "content": "Hi there"}]

    def test_assistant_with_empty_tool_calls_passes_through(self):
        _reconstruct_history = _get_reconstruct_history()
        rows = [{"role": "assistant", "content": "No tools used", "tool_calls": []}]
        result = _reconstruct_history(rows)
        assert result == [{"role": "assistant", "content": "No tools used"}]

    def test_assistant_with_tool_calls_produces_three_parts(self):
        _reconstruct_history = _get_reconstruct_history()
        rows = [
            {
                "role": "assistant",
                "content": "I searched for that.",
                "tool_calls": [
                    {
                        "tool_call_id": "call_abc",
                        "name": "search_documents",
                        "args": {"query": "budget"},
                        "result": "Found 3 docs",
                        "status": "done",
                    }
                ],
            }
        ]
        result = _reconstruct_history(rows)
        # Should produce 3 messages: assistant+tool_calls, tool result, assistant text
        assert len(result) == 3

        # Part 1: assistant message with tool_calls array
        assert result[0]["role"] == "assistant"
        assert result[0]["content"] is None
        assert len(result[0]["tool_calls"]) == 1
        assert result[0]["tool_calls"][0]["id"] == "call_abc"
        assert result[0]["tool_calls"][0]["type"] == "function"
        assert result[0]["tool_calls"][0]["function"]["name"] == "search_documents"

        # Part 2: tool result message
        assert result[1]["role"] == "tool"
        assert result[1]["tool_call_id"] == "call_abc"
        assert result[1]["content"] == "Found 3 docs"

        # Part 3: assistant text response
        assert result[2]["role"] == "assistant"
        assert result[2]["content"] == "I searched for that."

    def test_assistant_with_tool_calls_no_content_produces_two_parts(self):
        """When assistant content is empty/None after tool calls, only emit 2 parts."""
        _reconstruct_history = _get_reconstruct_history()
        rows = [
            {
                "role": "assistant",
                "content": "",
                "tool_calls": [
                    {
                        "tool_call_id": "call_xyz",
                        "name": "ls",
                        "args": {"path": "/"},
                        "result": "folder list",
                        "status": "done",
                    }
                ],
            }
        ]
        result = _reconstruct_history(rows)
        # Only 2 parts: assistant+tool_calls, tool result (no assistant text since content is empty)
        assert len(result) == 2
        assert result[0]["role"] == "assistant"
        assert result[1]["role"] == "tool"

    def test_old_message_without_tool_call_id_falls_back_to_plain(self):
        """Old DB rows without tool_call_id on tool entries should emit as plain assistant msg."""
        _reconstruct_history = _get_reconstruct_history()
        rows = [
            {
                "role": "assistant",
                "content": "Old response",
                "tool_calls": [
                    {
                        # No tool_call_id field — old format
                        "name": "search_documents",
                        "args": {"query": "test"},
                        "result": "some result",
                        "status": "done",
                    }
                ],
            }
        ]
        result = _reconstruct_history(rows)
        assert len(result) == 1
        assert result[0] == {"role": "assistant", "content": "Old response"}

    def test_tool_result_none_uses_empty_string_fallback(self):
        """Tool results stored as None should be emitted as empty string."""
        _reconstruct_history = _get_reconstruct_history()
        rows = [
            {
                "role": "assistant",
                "content": "Done",
                "tool_calls": [
                    {
                        "tool_call_id": "call_null",
                        "name": "ls",
                        "args": {},
                        "result": None,
                        "status": "done",
                    }
                ],
            }
        ]
        result = _reconstruct_history(rows)
        tool_msg = next(m for m in result if m["role"] == "tool")
        assert tool_msg["content"] == ""

    def test_multiple_tool_calls_in_single_assistant_message(self):
        """Multiple tool calls in one message should each produce a tool result message."""
        _reconstruct_history = _get_reconstruct_history()
        rows = [
            {
                "role": "assistant",
                "content": "Used two tools",
                "tool_calls": [
                    {
                        "tool_call_id": "call_1",
                        "name": "ls",
                        "args": {"path": "/"},
                        "result": "files",
                        "status": "done",
                    },
                    {
                        "tool_call_id": "call_2",
                        "name": "grep",
                        "args": {"pattern": "budget"},
                        "result": "matches",
                        "status": "done",
                    },
                ],
            }
        ]
        result = _reconstruct_history(rows)
        # 1 assistant+tool_calls, 2 tool results, 1 assistant text = 4 total
        assert len(result) == 4
        tool_msgs = [m for m in result if m["role"] == "tool"]
        assert len(tool_msgs) == 2
        assert tool_msgs[0]["tool_call_id"] == "call_1"
        assert tool_msgs[1]["tool_call_id"] == "call_2"
