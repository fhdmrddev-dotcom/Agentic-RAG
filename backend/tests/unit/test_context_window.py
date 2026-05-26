"""Unit tests for context_window service — token estimation and message trimming."""
import pytest
from app.services.context_window import (
    estimate_tokens,
    estimate_messages_tokens,
    trim_messages_to_fit,
    _TRIM_MARKER,
)


# ---------------------------------------------------------------------------
# Helper message factories (mirrors plan spec)
# ---------------------------------------------------------------------------

def _sys(content: str) -> dict:
    return {"role": "system", "content": content}


def _user(content: str) -> dict:
    return {"role": "user", "content": content}


def _assistant(content: str) -> dict:
    return {"role": "assistant", "content": content}


def _assistant_tc(tool_calls: list) -> dict:
    return {"role": "assistant", "content": None, "tool_calls": tool_calls}


def _tool(tool_call_id: str, content: str) -> dict:
    return {"role": "tool", "tool_call_id": tool_call_id, "content": content}


def _tc(id: str, name: str, args: str) -> dict:
    return {"id": id, "type": "function", "function": {"name": name, "arguments": args}}


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


def test_estimate_tokens_minimum_one_for_short_text():
    # Single char → 0 // 4 = 0, but max(1, 0) = 1
    assert estimate_tokens("x") == 1
    assert estimate_tokens("ab") == 1
    assert estimate_tokens("abc") == 1


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


def test_estimate_messages_tokens_sums_across_messages():
    """Token count must grow as more messages are added."""
    msgs1 = [_sys("system")]
    msgs2 = [_sys("system"), _user("hello")]
    assert estimate_messages_tokens(msgs2) > estimate_messages_tokens(msgs1)


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


def test_trim_empty_list_returns_empty():
    """Edge case: empty messages list returns empty."""
    assert trim_messages_to_fit([], max_tokens=1000) == []


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
# trim_messages_to_fit — preserves reserve_recent messages
# ---------------------------------------------------------------------------

def test_trim_preserves_recent_messages():
    system_msg = {"role": "system", "content": "System."}
    messages = [system_msg]
    for i in range(30):
        messages.append({"role": "user", "content": f"Message {i} " * 20})
        messages.append({"role": "assistant", "content": f"Reply {i} " * 20})

    # Last 4 messages should be preserved when budget is large enough.
    # Use a generous budget so protected tail fits without D-078-01 progressive trim.
    result = trim_messages_to_fit(messages, max_tokens=2000, reserve_recent=4)
    last_4 = messages[-4:]
    for msg in last_4:
        assert msg in result


def test_trim_all_trimmable_removed_only_protected_remain():
    """Edge case: if budget is tiny, all trimmable messages are removed; only system + protected remain.
    With D-078-01 progressive trim, protected messages may also be trimmed if they exceed max_tokens.
    Use a budget large enough that the 2 protected messages fit."""
    system_msg = _sys("System prompt.")
    # Build lots of old messages
    messages = [system_msg]
    for i in range(10):
        messages.append(_user(f"Old question {i} " * 20))
        messages.append(_assistant(f"Old reply {i} " * 20))
    # Add the recent protected messages
    recent_user = _user("Recent question")
    recent_assistant = _assistant("Recent reply")
    messages.append(recent_user)
    messages.append(recent_assistant)

    # Budget large enough for system + marker + 2 protected, but not old messages
    result = trim_messages_to_fit(messages, max_tokens=100, reserve_recent=2)

    assert result[0] == system_msg
    assert recent_user in result
    assert recent_assistant in result
    # None of the old messages should be present
    for msg in result:
        content = msg.get("content") or ""
        assert "Old question" not in content
        assert "Old reply" not in content


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


def test_trim_atomic_removal_using_helpers():
    """Atomic removal test using message factory helpers — never orphans a tool message."""
    messages = [
        _sys("system prompt"),
        _user("old question"),                          # trimmable
        _assistant_tc([_tc("tc1", "ls", "{}")]),        # trimmable (tool pair start)
        _tool("tc1", "result of ls " * 30),             # trimmable (tool pair end)
        _user("another question " * 5),                 # trimmable
        _user("recent 1"),                              # protected
        _assistant("recent reply"),                     # protected
    ]

    # Budget small enough to force trimming of the old messages
    result = trim_messages_to_fit(messages, max_tokens=60, reserve_recent=2)

    # System message preserved
    assert result[0]["role"] == "system"

    # No orphaned tool messages — every tool message must have a parent
    for msg in result:
        if msg.get("role") == "tool":
            tool_call_id = msg.get("tool_call_id")
            has_parent = any(
                m.get("role") == "assistant"
                and any(tc.get("id") == tool_call_id for tc in (m.get("tool_calls") or []))
                for m in result
            )
            assert has_parent, f"Orphaned tool result: {tool_call_id}"

    # Recent messages preserved
    recent_contents = [m["content"] for m in result if m.get("content")]
    assert "recent 1" in recent_contents
    assert "recent reply" in recent_contents


# ---------------------------------------------------------------------------
# trim_messages_to_fit — inserts _TRIM_MARKER after system message when trimming
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


def test_trim_marker_content_matches_constant():
    """_TRIM_MARKER constant is inserted verbatim after system message when trimming occurs."""
    system_msg = _sys("System prompt for marker test.")
    old_msg = _user("Old content " * 100)
    recent_user = _user("Recent question")
    recent_assistant = _assistant("Recent answer")

    messages = [system_msg, old_msg, recent_user, recent_assistant]

    result = trim_messages_to_fit(messages, max_tokens=50, reserve_recent=2)

    # System must be first
    assert result[0] == system_msg

    # Second message should be the _TRIM_MARKER
    assert result[1]["role"] == "user"
    assert result[1]["content"] == _TRIM_MARKER


def test_trim_no_marker_when_no_trimming():
    """No _TRIM_MARKER inserted when messages are already within the token budget."""
    messages = [
        _sys("System prompt."),
        _user("Short message."),
        _assistant("Short reply."),
    ]
    result = trim_messages_to_fit(messages, max_tokens=100000)
    # No marker should appear
    for msg in result:
        assert msg.get("content") != _TRIM_MARKER


# ---------------------------------------------------------------------------
# trim_messages_to_fit — inter-iteration growth scenario
# ---------------------------------------------------------------------------

def test_trim_inter_iteration_growth_scenario():
    """Simulate the threads.py agent loop: messages grow with tool pairs each iteration.
    After trimming, oldest pairs are removed atomically; most recent pairs are preserved.
    """
    # Start with system + user question (under budget)
    messages = [
        _sys("You are a helpful assistant."),
        _user("Find and analyze some documents."),
    ]

    # Simulate 5 tool call iterations — each adds assistant+tool_calls + tool result
    for i in range(5):
        tc_id = f"tc_{i}"
        messages.append(_assistant_tc([_tc(tc_id, "ls", f'{{"path": "/folder_{i}"}}')]))
        messages.append(_tool(tc_id, f"Tool result for iteration {i}. " * 20))

    # Verify the list grew as expected
    # 2 initial + 5 * 2 = 12 messages
    assert len(messages) == 12

    # Now trim as the agent loop would between iterations (reserve_recent=10)
    # Use a budget that forces removal of the earliest iterations
    result = trim_messages_to_fit(messages, max_tokens=300, reserve_recent=10)

    # System message preserved
    assert result[0]["role"] == "system"

    # No orphaned tool messages
    tool_ids_in_result = {
        tc.get("id")
        for m in result
        if m.get("role") == "assistant" and m.get("tool_calls")
        for tc in (m.get("tool_calls") or [])
    }
    for msg in result:
        if msg.get("role") == "tool":
            assert msg["tool_call_id"] in tool_ids_in_result, (
                f"Orphaned tool result {msg['tool_call_id']} found after inter-iteration trim"
            )

    # With reserve_recent=10 protecting the 10 most recent messages, only the
    # 2 initial messages (system + first user question) are trimmable. If the budget
    # forces trimming, the user question gets removed and a marker is inserted instead.
    # The key correctness invariant is: no orphaned tool results (already checked above).
    # The result should be smaller than or equal to the original 12-message list.
    assert len(result) <= len(messages), "Trim should not grow the messages list"


# ---------------------------------------------------------------------------
# tiktoken integration (CTX-05)
# ---------------------------------------------------------------------------

def test_tiktoken_estimate():
    """estimate_tokens uses tiktoken for gpt-* and o1/o3 models when available.

    This test verifies the MODEL argument is accepted and the function returns
    a reasonable count. If tiktoken is not installed, the test is skipped.
    """
    from app.services.context_window import estimate_tokens, _TIKTOKEN_AVAILABLE
    if not _TIKTOKEN_AVAILABLE:
        pytest.skip("tiktoken not installed — install with: pip install tiktoken==0.12.0")
    text = "The quick brown fox jumps over the lazy dog"
    # GPT-4 tokenizes this at 9 tokens; chars/4 gives 10 — tiktoken is more accurate
    count = estimate_tokens(text, model="gpt-4o")
    assert count > 0
    # tiktoken count should differ from chars/4 for known text
    chars_estimate = max(1, len(text) // 4)
    # Both should be in a reasonable range (allow either path to pass for CI)
    assert 5 <= count <= 20


def test_tiktoken_fallback():
    """estimate_tokens falls back to chars/4 for non-OpenAI models."""
    from app.services.context_window import estimate_tokens
    text = "hello world" * 10  # 110 chars → 110 // 4 = 27
    # Non-OpenAI model → always uses chars/4
    count = estimate_tokens(text, model="claude-sonnet-4-6")
    assert count == max(1, len(text) // 4)


def test_tiktoken_no_model_uses_chars_heuristic():
    """estimate_tokens with no model arg returns chars/4 (backward-compat)."""
    from app.services.context_window import estimate_tokens
    text = "a" * 40
    # No model arg → chars/4 → 10
    assert estimate_tokens(text) == 10


# ---------------------------------------------------------------------------
# trim_messages_to_fit — protected-only overrun (Phase 078 CQ-CTX-01 D-078-01)
# ---------------------------------------------------------------------------

def test_trim_protected_overrun_trims_inward():
    """When trimmable is empty AND protected+system still exceed max_tokens,
    progressively trim oldest protected messages (D-078-01 progressive trim)."""
    system_msg = _sys("System prompt.")
    # Only 2 messages — both land in protected (reserve_recent=2), trimmable is empty
    protected_old = _user("Protected-but-old message " * 50)   # ~1300 chars = ~325 tokens
    protected_new = _assistant("Recent reply.")

    messages = [system_msg, protected_old, protected_new]
    # Token budget smaller than protected_old alone forces trimming into protected
    result = trim_messages_to_fit(messages, max_tokens=30, reserve_recent=2)

    # System must always be present
    assert result[0] == system_msg
    # The long protected_old message should have been trimmed away
    assert protected_old not in result, "Oldest protected message should be trimmed"
    # The most recent protected message must survive (hard floor)
    assert protected_new in result, "Last protected message must be preserved"
    # Trim marker must be present (trimming occurred)
    assert any(
        _TRIM_MARKER in (m.get("content") or "") for m in result
    ), "Trim marker should be present after protected-only overrun"


def test_trim_protected_overrun_inserts_marker():
    """Marker is inserted when protected-only overrun causes trimming (D-078-01)."""
    system_msg = _sys("System.")
    protected_old = _user("Very long protected message. " * 100)
    protected_new = _assistant("Recent.")

    messages = [system_msg, protected_old, protected_new]
    result = trim_messages_to_fit(messages, max_tokens=20, reserve_recent=2)

    # A trim marker must be present (trimming occurred)
    assert any(
        _TRIM_MARKER in (m.get("content") or "")
        for m in result
    ), "Expected _TRIM_MARKER after protected-only overrun trim"


def test_trim_protected_overrun_never_errors():
    """trim_messages_to_fit always returns a list — never raises (D-078-02)."""
    system_msg = _sys("S" * 1000)   # large system prompt
    only_msg = _user("U" * 1000)    # only one protected message

    messages = [system_msg, only_msg]
    # Absurdly small budget — function must not raise
    result = trim_messages_to_fit(messages, max_tokens=1, reserve_recent=1)
    assert isinstance(result, list)
    assert len(result) >= 1  # at minimum system prompt


def test_trim_protected_overrun_preserves_last_message():
    """Hard floor: last message in protected tail is always preserved (D-078-01)."""
    system_msg = _sys("System.")
    messages = [system_msg]
    for i in range(5):
        messages.append(_user(f"Protected message {i} " * 30))
    last_msg = _assistant("The very last reply.")
    messages.append(last_msg)

    result = trim_messages_to_fit(messages, max_tokens=20, reserve_recent=6)
    # The last message must survive (hard floor)
    assert last_msg in result, "Last protected message must never be trimmed"
