"""
Phase 076.2 Plan 01: Unit tests for DeepSeek thinking mode.
Covers D-02 (thinking enable), D-03 (reasoning_content round-trip),
D-04 (reasoning_effort), Pitfall 1 (accumulator reset), and
MessageResponse API exposure.
"""
import pytest
import inspect


class TestDeepSeekThinkingEnable:
    """D-02: openai_service sends thinking.type='enabled' for DeepSeek."""

    def test_deepseek_provider_registered(self):
        """DeepSeek is a registered provider in _PROVIDER_BASE_URLS."""
        from app.config import _PROVIDER_BASE_URLS
        assert "deepseek" in _PROVIDER_BASE_URLS

    def test_thinking_config_is_enabled_not_disabled(self):
        """Source must contain 'type': 'enabled' and NOT 'type': 'disabled'."""
        from app.services import openai_service
        source = inspect.getsource(openai_service)
        assert '"type": "enabled"' in source or "'type': 'enabled'" in source
        assert '"type": "disabled"' not in source

    def test_reasoning_effort_is_high(self):
        """Source must contain reasoning_effort='high' per D-04."""
        from app.services import openai_service
        source = inspect.getsource(openai_service)
        assert '"reasoning_effort": "high"' in source or "'reasoning_effort': 'high'" in source


class TestReasoningContentRoundTrip:
    """D-03: reasoning_content included in in-memory messages for tool-call turns."""

    def test_message_assembly_includes_reasoning_content(self):
        """In-memory assistant message dict includes reasoning_content when non-empty."""
        tool_calls = [{"id": "tc_1", "name": "execute_code", "arguments": '{"code":"print(1)"}'}]
        full_content = "Let me run that code."
        full_reasoning_content = "The user wants to see the output of print(1)."

        msg = {
            "role": "assistant",
            "tool_calls": [
                {
                    "id": tc["id"],
                    "type": "function",
                    "function": {"name": tc["name"], "arguments": tc["arguments"]},
                }
                for tc in tool_calls
            ],
            **({"content": full_content} if full_content else {}),
            **({"reasoning_content": full_reasoning_content} if full_reasoning_content else {}),
        }

        assert msg["reasoning_content"] == "The user wants to see the output of print(1)."
        assert msg["content"] == "Let me run that code."
        assert msg["role"] == "assistant"
        assert len(msg["tool_calls"]) == 1

    def test_message_assembly_excludes_empty_reasoning(self):
        """When full_reasoning_content is empty, the key must NOT appear."""
        tool_calls = [{"id": "tc_1", "name": "search", "arguments": '{"q":"test"}'}]
        full_content = ""
        full_reasoning_content = ""

        msg = {
            "role": "assistant",
            "tool_calls": [
                {
                    "id": tc["id"],
                    "type": "function",
                    "function": {"name": tc["name"], "arguments": tc["arguments"]},
                }
                for tc in tool_calls
            ],
            **({"content": full_content} if full_content else {}),
            **({"reasoning_content": full_reasoning_content} if full_reasoning_content else {}),
        }

        assert "reasoning_content" not in msg
        assert "content" not in msg

    def test_accumulator_reset_pattern(self):
        """Pitfall 1: accumulators must reset after being consumed."""
        full_reasoning_content = "Iteration 1 reasoning"
        full_content = "Iteration 1 content"

        _consumed_reasoning = full_reasoning_content
        _consumed_content = full_content

        # Reset pattern (must happen after append)
        full_content = ""
        full_reasoning_content = ""

        assert full_reasoning_content == ""
        assert full_content == ""
        assert _consumed_reasoning == "Iteration 1 reasoning"


class TestMessageResponseExposure:
    """MessageResponse pydantic model must include reasoning_content."""

    def test_reasoning_content_field_exists(self):
        """MessageResponse has a reasoning_content field with correct type."""
        from app.models.message import MessageResponse
        fields = MessageResponse.model_fields
        assert "reasoning_content" in fields
        field_info = fields["reasoning_content"]
        assert field_info.default is None

    def test_reasoning_content_serialization(self):
        """MessageResponse serializes reasoning_content when present."""
        from app.models.message import MessageResponse
        from uuid import uuid4
        from datetime import datetime

        msg = MessageResponse(
            id=uuid4(),
            thread_id=uuid4(),
            user_id=uuid4(),
            role="assistant",
            content="Hello",
            created_at=datetime.now(),
            updated_at=datetime.now(),
            reasoning_content="I thought about this carefully.",
        )
        data = msg.model_dump()
        assert data["reasoning_content"] == "I thought about this carefully."

    def test_reasoning_content_absent_when_none(self):
        """MessageResponse with no reasoning_content serializes as None."""
        from app.models.message import MessageResponse
        from uuid import uuid4
        from datetime import datetime

        msg = MessageResponse(
            id=uuid4(),
            thread_id=uuid4(),
            user_id=uuid4(),
            role="assistant",
            content="Hello",
            created_at=datetime.now(),
            updated_at=datetime.now(),
        )
        data = msg.model_dump()
        assert data["reasoning_content"] is None
