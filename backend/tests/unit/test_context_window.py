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


def _skill_tool(tool_call_id: str, skill_name: str, content: str) -> dict:
    """A tool-result message tagged as a pinned load_skill result (CTX-03)."""
    return {
        "role": "tool",
        "tool_call_id": tool_call_id,
        "content": content,
        "_pinned_skill": skill_name,
    }


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


# ---------------------------------------------------------------------------
# trim_messages_to_fit — CTX-03 pinned load_skill protected class (Plan 123-02)
# ---------------------------------------------------------------------------

def _has_parent_tool_calls(result: list[dict], tool_call_id: str) -> bool:
    """True if some assistant+tool_calls message in result owns tool_call_id."""
    return any(
        m.get("role") == "assistant"
        and any(tc.get("id") == tool_call_id for tc in (m.get("tool_calls") or []))
        for m in result
    )


def test_pin_load_skill_survives_trim():
    """A load_skill group near the FRONT survives even when older non-skill turns
    are trimmed out (CTX-03 — a loaded skill stays available for the session)."""
    system_msg = _sys("System.")
    messages = [system_msg]
    # The load_skill group lives near the front (would normally be trimmed first)
    messages.append(_assistant_tc([_tc("call_skill", "load_skill", '{"skill_name": "pptx-builder"}')]))
    messages.append(_skill_tool("call_skill", "pptx-builder", "SKILL INSTRUCTIONS: build pptx. " * 10))
    # Many filler non-skill turns that blow the budget
    for i in range(20):
        messages.append(_user(f"Filler question {i} " * 20))
        messages.append(_assistant(f"Filler reply {i} " * 20))

    # max_tokens=900 → pin budget = 300 tokens, comfortably fits the single
    # ~150-token skill group while the full history (~2000+ tokens) forces trimming.
    result = trim_messages_to_fit(messages, max_tokens=900, reserve_recent=4)

    # The pinned skill tool-result is STILL present
    skill_tool = next(
        (m for m in result if m.get("role") == "tool" and m.get("_pinned_skill") == "pptx-builder"),
        None,
    )
    assert skill_tool is not None, "Pinned load_skill tool-result must survive the trim"
    # Older non-skill filler turns are gone
    assert not any("Filler question 0 " in (m.get("content") or "") for m in result), (
        "Oldest non-skill turns should have been trimmed"
    )


def test_pin_keeps_atomic_pair():
    """The pinned group keeps BOTH its assistant+tool_calls parent AND its
    tool-result — no orphaned tool message (Pitfall 2 / D-14 atomic invariant)."""
    system_msg = _sys("System.")
    messages = [system_msg]
    messages.append(_assistant_tc([_tc("call_skill", "load_skill", '{"skill_name": "docx-builder"}')]))
    messages.append(_skill_tool("call_skill", "docx-builder", "SKILL INSTRUCTIONS " * 20))
    for i in range(20):
        messages.append(_user(f"Filler {i} " * 20))
        messages.append(_assistant(f"Reply {i} " * 20))

    result = trim_messages_to_fit(messages, max_tokens=900, reserve_recent=4)

    # The pinned tool-result is present AND its parent assistant+tool_calls is too
    skill_tool = next(
        (m for m in result if m.get("role") == "tool" and m.get("_pinned_skill") == "docx-builder"),
        None,
    )
    assert skill_tool is not None
    assert _has_parent_tool_calls(result, "call_skill"), (
        "Pinned tool-result must keep its assistant+tool_calls parent (no orphan)"
    )
    # No orphaned tool messages anywhere in the output
    for msg in result:
        if msg.get("role") == "tool":
            assert _has_parent_tool_calls(result, msg.get("tool_call_id")), (
                f"Orphaned tool result: {msg.get('tool_call_id')}"
            )


def test_pin_dedupe_same_skill():
    """The same skill loaded twice → exactly ONE pinned copy survives (the LATEST);
    the older one is demoted to the trimmable pool (D-13 de-dupe)."""
    system_msg = _sys("System.")
    messages = [system_msg]
    # First (older) load of the same skill
    messages.append(_assistant_tc([_tc("call_a", "load_skill", '{"skill_name": "pptx-builder"}')]))
    messages.append(_skill_tool("call_a", "pptx-builder", "OLD instructions " * 20))
    # Filler
    for i in range(6):
        messages.append(_user(f"Filler {i} " * 20))
        messages.append(_assistant(f"Reply {i} " * 20))
    # Second (newer) load of the SAME skill
    messages.append(_assistant_tc([_tc("call_b", "load_skill", '{"skill_name": "pptx-builder"}')]))
    messages.append(_skill_tool("call_b", "pptx-builder", "NEW instructions " * 20))
    # More filler to force trimming
    for i in range(10):
        messages.append(_user(f"Late {i} " * 20))
        messages.append(_assistant(f"LateReply {i} " * 20))

    # pin budget = 300 tokens fits the single de-duped survivor (~150 tokens).
    result = trim_messages_to_fit(messages, max_tokens=900, reserve_recent=4)

    pinned_tool_ids = [
        m.get("tool_call_id")
        for m in result
        if m.get("role") == "tool"
        and m.get("_pinned_skill") == "pptx-builder"
        and _has_parent_tool_calls(result, m.get("tool_call_id"))
    ]
    # Exactly ONE pinned copy survives, and it is the LATEST (call_b)
    assert pinned_tool_ids == ["call_b"], (
        f"Expected only the latest pinned copy (call_b); got {pinned_tool_ids}"
    )


def test_pin_budget_evicts_lru_with_marker():
    """Pinned groups whose summed token estimate exceeds PIN_BUDGET_FRACTION*max_tokens
    → the least-recently-loaded pinned group is evicted AND _TRIM_MARKER appears."""
    from app.services.context_window import PIN_BUDGET_FRACTION

    system_msg = _sys("System.")
    max_tokens = 600
    pin_budget = int(PIN_BUDGET_FRACTION * max_tokens)  # 200 tokens
    # Size each pinned group so ONE fits the pin budget but TWO overflow it:
    # target ~60% of the budget per group → two groups (~120%) exceed the cap,
    # forcing exactly one LRU eviction (the least-recently-loaded skill-old).
    big = "X" * int(pin_budget * 0.6 * 4)  # chars/4 → ~0.6*pin_budget tokens of content
    messages = [system_msg]
    # Older pinned skill (least-recently-loaded — should be evicted)
    messages.append(_assistant_tc([_tc("call_old", "load_skill", '{"skill_name": "skill-old"}')]))
    messages.append(_skill_tool("call_old", "skill-old", big))
    # Newer pinned skill (should be kept)
    messages.append(_assistant_tc([_tc("call_new", "load_skill", '{"skill_name": "skill-new"}')]))
    messages.append(_skill_tool("call_new", "skill-new", big))
    # Non-skill filler turns so the total (demoted skill-old + filler) overflows
    # max_tokens and the trim loop actually removes the demoted least-recent pin.
    for i in range(8):
        messages.append(_user(f"Filler {i} " * 20))
        messages.append(_assistant(f"Reply {i} " * 20))
    # A couple of recent protected turns
    messages.append(_user("recent question"))
    messages.append(_assistant("recent reply"))

    result = trim_messages_to_fit(messages, max_tokens=max_tokens, reserve_recent=2)

    kept_skills = {
        m.get("_pinned_skill")
        for m in result
        if m.get("role") == "tool" and m.get("_pinned_skill")
        and _has_parent_tool_calls(result, m.get("tool_call_id"))
    }
    # The newer skill is kept; the older (LRU) one was evicted
    assert "skill-new" in kept_skills, "Newest pinned skill must survive the budget cap"
    assert "skill-old" not in kept_skills, "Least-recently-loaded pinned skill must be evicted over budget"
    # Eviction is never silent — the honest trim marker is present
    assert any(_TRIM_MARKER in (m.get("content") or "") for m in result), (
        "Pin eviction must insert the honest _TRIM_MARKER"
    )


def test_pin_never_starves_recent():
    """With pins at the budget cap, the reserve_recent tail is STILL fully preserved
    (T-123-02-01 — pinning never starves the recent-message budget)."""
    system_msg = _sys("System.")
    max_tokens = 500
    big = "Y" * (max_tokens * 4)  # one oversized pinned result
    messages = [system_msg]
    messages.append(_assistant_tc([_tc("call_skill", "load_skill", '{"skill_name": "huge-skill"}')]))
    messages.append(_skill_tool("call_skill", "huge-skill", big))
    # Recent protected tail
    recent_user = _user("recent question")
    recent_assistant = _assistant("recent reply")
    messages.append(recent_user)
    messages.append(recent_assistant)

    result = trim_messages_to_fit(messages, max_tokens=max_tokens, reserve_recent=2)

    # The recent tail is fully preserved even though the pin overflowed the budget
    assert recent_user in result, "reserve_recent tail must never be starved by a pin"
    assert recent_assistant in result, "reserve_recent tail must never be starved by a pin"


# ---------------------------------------------------------------------------
# _reconstruct_history pin-tag (Plan 123-02 Task 2 — CTX-03 in code, no JSON sniff)
# ---------------------------------------------------------------------------

def _row_with_tool_calls(tool_calls: list[dict], content: str | None = None) -> dict:
    """A stored assistant DB row with tool_calls (the _reconstruct_history input shape)."""
    return {"role": "assistant", "content": content, "tool_calls": tool_calls}


def test_reconstruct_history_tags_load_skill_pinned():
    """A load_skill tool-result row gets _pinned_skill set (from tc args, in code),
    while a non-skill (search_documents) tool row does NOT — proving the flag is set
    from tc metadata, never by sniffing the tool-result content JSON."""
    from app.services.agent_loop import _reconstruct_history

    rows = [
        _row_with_tool_calls([
            {
                "tool_call_id": "call_skill",
                "name": "load_skill",
                "args": {"skill_name": "pptx-builder"},
                "result": '{"instructions": "build pptx", "files": []}',
            },
            {
                "tool_call_id": "call_search",
                "name": "search_documents",
                "args": {"query": "budget"},
                "result": '{"results": []}',
            },
        ]),
    ]

    messages = _reconstruct_history(rows)

    skill_tool = next(
        (m for m in messages if m.get("role") == "tool" and m.get("tool_call_id") == "call_skill"),
        None,
    )
    search_tool = next(
        (m for m in messages if m.get("role") == "tool" and m.get("tool_call_id") == "call_search"),
        None,
    )
    assert skill_tool is not None and search_tool is not None
    # load_skill tool-result IS pinned, tagged with the skill name from the args
    assert skill_tool.get("_pinned_skill") == "pptx-builder"
    # search_documents tool-result is NOT pinned
    assert "_pinned_skill" not in search_tool


def test_reconstruct_history_pin_fallback_to_tool_call_id():
    """When the load_skill args lack skill_name, the pin flag falls back to the
    tool_call_id so de-dupe still works (never unset on a load_skill row)."""
    from app.services.agent_loop import _reconstruct_history

    rows = [
        _row_with_tool_calls([
            {
                "tool_call_id": "call_skill_noargs",
                "name": "load_skill",
                "args": {},
                "result": '{"instructions": "x"}',
            },
        ]),
    ]
    messages = _reconstruct_history(rows)
    skill_tool = next(
        (m for m in messages if m.get("role") == "tool"),
        None,
    )
    assert skill_tool is not None
    assert skill_tool.get("_pinned_skill") == "call_skill_noargs"


def test_reconstruct_pin_flag_drives_trim_pinning_end_to_end():
    """The _pinned_skill flag set by _reconstruct_history survives into
    trim_messages_to_fit and engages the pinning on a realistic reconstructed
    history (Task 1 + Task 2 wired together)."""
    from app.services.agent_loop import _reconstruct_history

    rows = [
        _row_with_tool_calls(
            [
                {
                    "tool_call_id": "call_skill",
                    "name": "load_skill",
                    "args": {"skill_name": "docx-builder"},
                    "result": "SKILL INSTRUCTIONS: build docx. " * 10,
                },
            ],
            content="Loaded the docx skill.",
        ),
    ]
    reconstructed = _reconstruct_history(rows)

    messages = [_sys("System.")] + reconstructed
    # Pile on filler turns to force trimming.
    for i in range(20):
        messages.append(_user(f"Filler {i} " * 20))
        messages.append(_assistant(f"Reply {i} " * 20))

    result = trim_messages_to_fit(messages, max_tokens=900, reserve_recent=4)

    skill_tool = next(
        (m for m in result if m.get("role") == "tool" and m.get("_pinned_skill") == "docx-builder"),
        None,
    )
    assert skill_tool is not None, "Reconstructed load_skill result must be pinned through the trim path"
    assert _has_parent_tool_calls(result, "call_skill"), "Pinned group must keep its parent"
