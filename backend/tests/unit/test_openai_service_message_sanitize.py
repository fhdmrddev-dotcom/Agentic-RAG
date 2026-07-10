"""Phase 123 (WR-06) regression: internal ``_``-prefixed message keys must be
stripped before the OpenAI-compat SDK call.

``_reconstruct_history`` stamps ``_pinned_skill`` on load_skill tool-result
messages on EVERY normal chat reload (CTX-03). ``trim_messages_to_fit``
preserves it (it is the de-dupe key). On the OpenAI-compat path the message
list is passed straight to ``client.chat.completions.create(messages=...)`` —
OpenAI and several compat providers 400 on unknown top-level message
properties. This test pins the sanitization at the gateway boundary so a
thread that loaded a skill can be re-streamed on OpenAI/OpenRouter without a
400.
"""
from unittest.mock import MagicMock, patch

from app.services.openai_service import create_adaptive_streaming_chat


def _capture_create_kwargs(messages, **call_kwargs):
    """Run create_adaptive_streaming_chat with a mocked client and return the
    kwargs that would have been sent to chat.completions.create."""
    mock_client = MagicMock()
    sentinel_stream = MagicMock(name="stream")
    mock_client.chat.completions.create.return_value = sentinel_stream

    with patch(
        "app.services.openai_service.get_llm_client", return_value=mock_client
    ), patch("app.services.openai_service.settings") as mock_settings:
        # Minimal env-settings surface the function reads. Concrete ints so the
        # max-token resolution/clamp math is real (not MagicMock comparisons).
        mock_settings.llm_model = "gpt-4o-mini"
        mock_settings.llm_provider = "openai"
        mock_settings.llm_max_output_tokens = 8192
        mock_settings.model_output_limits = ""
        # Passing an explicit max_tokens takes the ``explicit is not None`` path,
        # so token resolution stays numeric regardless of env-settings shape.
        create_adaptive_streaming_chat(
            messages=messages,
            tool_choice="auto",
            model="gpt-4o-mini",
            max_tokens=1024,
            **call_kwargs,
        )

    assert mock_client.chat.completions.create.called
    return mock_client.chat.completions.create.call_args.kwargs


def test_pinned_skill_key_is_stripped_before_openai_call():
    """A ``_pinned_skill`` marker on a tool message must NOT reach the SDK."""
    messages = [
        {"role": "system", "content": "you are helpful"},
        {"role": "user", "content": "hi"},
        {
            "role": "tool",
            "tool_call_id": "call_1",
            "content": "skill loaded",
            "_pinned_skill": "pptx-builder",
        },
    ]

    create_kwargs = _capture_create_kwargs(messages)
    sent_messages = create_kwargs["messages"]

    # No message dict carries any ``_``-prefixed key.
    for m in sent_messages:
        assert all(not k.startswith("_") for k in m.keys()), (
            f"internal key leaked to SDK: {list(m.keys())}"
        )

    # Specifically the pin marker is gone but the real fields survive.
    tool_msg = next(m for m in sent_messages if m["role"] == "tool")
    assert "_pinned_skill" not in tool_msg
    assert tool_msg["content"] == "skill loaded"
    assert tool_msg["tool_call_id"] == "call_1"


def test_multiple_internal_keys_stripped_content_preserved():
    """All ``_``-prefixed keys are dropped; non-prefixed payload is untouched."""
    messages = [
        {
            "role": "tool",
            "tool_call_id": "c1",
            "content": "x" * 5000,  # large content must not be deep-copied/altered
            "_pinned_skill": "s1",
            "_internal_debug": {"a": 1},
        },
    ]

    create_kwargs = _capture_create_kwargs(messages)
    sent = create_kwargs["messages"][0]

    assert set(sent.keys()) == {"role", "tool_call_id", "content"}
    assert sent["content"] == "x" * 5000


def test_clean_messages_pass_through_unchanged():
    """Messages with no internal keys are forwarded with identical fields."""
    messages = [
        {"role": "system", "content": "sys"},
        {"role": "user", "content": "u"},
    ]

    create_kwargs = _capture_create_kwargs(messages)
    sent = create_kwargs["messages"]

    assert sent == [
        {"role": "system", "content": "sys"},
        {"role": "user", "content": "u"},
    ]
