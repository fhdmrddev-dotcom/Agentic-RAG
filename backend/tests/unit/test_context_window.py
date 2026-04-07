"""Unit tests for context_window service — token estimation and message trimming."""
import pytest
from app.services.context_window import estimate_tokens, estimate_messages_tokens, trim_messages_to_fit


# ---------------------------------------------------------------------------
# estimate_tokens
# ---------------------------------------------------------------------------

def test_estimate_tokens_basic():
    # "hello world" is 11 chars — 11 // 4 = 2, but max(1, ...) = 2
    assert estimate_tokens("hello world") == 2


def test_estimate_tokens_longer_text():
    # 40 chars → 10 tokens
    text = "a" * 40
    assert estimate_tokens(text) == 10


def test_estimate_tokens_none():
    assert estimate_tokens(None) == 0


def test_estimate_tokens_empty_string():
    assert estimate_tokens("") == 0


# ---------------------------------------------------------------------------
# estimate_messages_tokens
# ---------------------------------------------------------------------------

def test_estimate_messages_tokens():
    messages = [
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": "Hello there!"},
    ]
    total = estimate_messages_tokens(messages)
    # Should be positive and account for overhead
    assert total > 0
    # Each message gets 4 tokens overhead → at least 8 tokens overhead
    assert total >= 8


def test_estimate_messages_tokens_with_tool_calls():
    messages = [
        {
            "role": "assistant",
            "content": None,
            "tool_calls": [
                {"id": "call_1", "type": "function", "function": {"name": "ls", "arguments": '{"path": "/"}'}}
            ],
        }
    ]
    total = estimate_messages_tokens(messages)
    assert total > 0


def test_estimate_messages_tokens_empty():
    assert estimate_messages_tokens([]) == 0


# ---------------------------------------------------------------------------
# trim_messages_to_fit — no-op when under limit
# ---------------------------------------------------------------------------

def test_trim_noop_when_under_limit():
    messages = [
        {"role": "system", "content": "System prompt."},
        {"role": "user", "content": "Hello"},
        {"role": "assistant", "content": "Hi there!"},
    ]
    result = trim_messages_to_fit(messages, max_tokens=100000)
    assert result == messages


# ---------------------------------------------------------------------------
# trim_messages_to_fit — preserves system message
# ---------------------------------------------------------------------------

def test_trim_preserves_system_message():
    system_msg = {"role": "system", "content": "I am a system prompt."}
    # Build a conversation that exceeds a tiny limit
    messages = [system_msg]
    for i in range(20):
        messages.append({"role": "user", "content": f"User message {i}" * 10})
        messages.append({"role": "assistant", "content": f"Assistant reply {i}" * 10})

    result = trim_messages_to_fit(messages, max_tokens=100, reserve_recent=2)
    # System message must always be present
    assert result[0] == system_msg


# ---------------------------------------------------------------------------
# trim_messages_to_fit — removes oldest non-system messages first
# ---------------------------------------------------------------------------

def test_trim_removes_oldest_first():
    system_msg = {"role": "system", "content": "System."}
    old_user = {"role": "user", "content": "Old message " * 50}
    new_user = {"role": "user", "content": "Recent message."}
    new_assistant = {"role": "assistant", "content": "Recent reply."}

    messages = [system_msg, old_user, new_user, new_assistant]

    # Use a token budget that forces trimming the old message
    # Estimate: old_user is ~600 chars = 150 tokens, system ~2, new_user ~4, new_assistant ~4
    # Set a limit that can only fit system + new messages
    result = trim_messages_to_fit(messages, max_tokens=50, reserve_recent=2)

    # old_user should be trimmed; recent messages preserved
    contents = [m["content"] for m in result if m.get("content")]
    assert "Recent message." in contents or "Recent reply." in contents
    # Old message should be gone
    assert not any("Old message" in (m.get("content") or "") for m in result)


# ---------------------------------------------------------------------------
# trim_messages_to_fit — preserves recent messages
# ---------------------------------------------------------------------------

def test_trim_preserves_recent_messages():
    system_msg = {"role": "system", "content": "System."}
    messages = [system_msg]
    for i in range(30):
        messages.append({"role": "user", "content": f"Message {i} " * 20})
        messages.append({"role": "assistant", "content": f"Reply {i} " * 20})

    # Last 4 messages should be preserved
    result = trim_messages_to_fit(messages, max_tokens=200, reserve_recent=4)
    last_4 = messages[-4:]
    for msg in last_4:
        assert msg in result


# ---------------------------------------------------------------------------
# trim_messages_to_fit — atomic tool call removal
# ---------------------------------------------------------------------------

def test_trim_atomic_tool_call_removal():
    """If an assistant message with tool_calls is trimmed, its tool results must also be removed."""
    system_msg = {"role": "system", "content": "System."}
    # Old tool call sequence (should be trimmed together atomically)
    old_assistant_tool = {
        "role": "assistant",
        "content": None,
        "tool_calls": [
            {"id": "call_old", "type": "function", "function": {"name": "ls", "arguments": '{"path": "/"}'}}
        ],
    }
    old_tool_result = {
        "role": "tool",
        "tool_call_id": "call_old",
        "content": "Some old tool result " * 50,
    }
    # Recent messages that should be kept
    recent_user = {"role": "user", "content": "Recent question."}
    recent_assistant = {"role": "assistant", "content": "Recent answer."}

    messages = [system_msg, old_assistant_tool, old_tool_result, recent_user, recent_assistant]

    result = trim_messages_to_fit(messages, max_tokens=80, reserve_recent=2)

    # Verify no orphaned tool messages remain
    for msg in result:
        if msg.get("role") == "tool":
            tool_call_id = msg.get("tool_call_id")
            # The corresponding assistant tool_calls message must exist
            has_parent = any(
                m.get("role") == "assistant"
                and any(tc.get("id") == tool_call_id for tc in (m.get("tool_calls") or []))
                for m in result
            )
            assert has_parent, f"Orphaned tool result found: {tool_call_id}"


# ---------------------------------------------------------------------------
# trim_messages_to_fit — inserts marker message after trimming
# ---------------------------------------------------------------------------

def test_trim_inserts_marker_message():
    system_msg = {"role": "system", "content": "System."}
    messages = [system_msg]
    for i in range(20):
        messages.append({"role": "user", "content": f"Old message {i} " * 30})
        messages.append({"role": "assistant", "content": f"Old reply {i} " * 30})

    result = trim_messages_to_fit(messages, max_tokens=200, reserve_recent=4)

    # A marker message should be present right after the system prompt
    assert len(result) >= 2
    # Find marker
    marker_found = any(
        "trimmed" in (m.get("content") or "").lower()
        for m in result
        if m.get("role") == "user"
    )
    assert marker_found, "Expected a trimming marker message but none found"
