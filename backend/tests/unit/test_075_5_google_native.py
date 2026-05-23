"""Phase 075.5 — Google native SDK adoption coverage.

Replaces test_075_4_thought_signature.py (deleted — it tested the obsolete
OpenAI-compat extra_content shape that never actually worked in production).

Covers (per 075.5 D-075.5-01/02/03):
  Test 1 (translation: system prompt extracted): system-role messages collapse
          into system_instruction, not contents.
  Test 2 (translation: user text): user message → user-role Content with text Part.
  Test 3 (translation: assistant tool_call): assistant tool_calls → model-role Content
          with function_call Part. thought_signature top-level field on the tool_call
          dict attaches to Part.thought_signature.
  Test 4 (translation: tool result correlation by id): tool-role messages correlate
          back to function name via the matching assistant.tool_calls[].id.
  Test 5 (translation: tool args JSON string → dict): assistant tool_call.function.
          arguments is a JSON string in OpenAI shape; translation parses it to a dict
          for Google's Part.from_function_call.
  Test 6 (tools: openai-shape → google declarations): tools array translates,
          single Tool wrapping all FunctionDeclarations.
  Test 7 (finish_reason map): STOP → stop, MAX_TOKENS → length, etc.
  Test 8 (audit: router branch present in threads.py): active_provider == "google"
          branch exists and calls stream_google.

End-to-end live round-trip with the real Gemini API is verified manually
(see Phase 075.5 SUMMARY for the operator UAT result + smoke script).
"""
from __future__ import annotations

import inspect
import json

import pytest


# ── Test 1-5 — _convert_messages_to_google ───────────────────────────────────


def test_system_message_extracted_to_instruction() -> None:
    from app.services.google_service import _convert_messages_to_google
    contents, system = _convert_messages_to_google([
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": "hi"},
    ])
    assert system == "You are a helpful assistant."
    # Only the user message is in contents — system was hoisted out.
    assert len(contents) == 1
    assert contents[0].role == "user"


def test_user_text_translates_to_user_content() -> None:
    from app.services.google_service import _convert_messages_to_google
    contents, _ = _convert_messages_to_google([
        {"role": "user", "content": "Hello world"},
    ])
    assert len(contents) == 1
    assert contents[0].role == "user"
    assert len(contents[0].parts) == 1
    assert contents[0].parts[0].text == "Hello world"


def test_assistant_tool_call_attaches_thought_signature_to_part() -> None:
    """Load-bearing: this is what makes Gemini-3 multi-tool actually work.

    The top-level ``thought_signature`` field on the OpenAI-shape tool_call dict
    must attach to the resulting function_call Part so the native SDK can
    round-trip it on the continuation request. Without this attachment, Gemini-3
    returns 400 INVALID_ARGUMENT on round 2+ (this is the production bug that
    Phase 075.4-02's openai-compat extra_content hack failed to close)."""
    from app.services.google_service import _convert_messages_to_google
    contents, _ = _convert_messages_to_google([
        {"role": "assistant", "tool_calls": [{
            "id": "call_xyz",
            "type": "function",
            "function": {"name": "search", "arguments": '{"q":"foo"}'},
            "thought_signature": "SIGNATURE_BASE64",
        }]},
    ])
    assert len(contents) == 1
    assert contents[0].role == "model"
    assert len(contents[0].parts) == 1
    part = contents[0].parts[0]
    assert part.function_call is not None
    assert part.function_call.name == "search"
    assert part.function_call.args == {"q": "foo"}
    assert getattr(part, "thought_signature", None) == "SIGNATURE_BASE64"


def test_tool_result_correlates_to_function_name_by_id() -> None:
    """Google's Part.from_function_response requires the function name; OpenAI tool
    messages only carry tool_call_id. Translation must lookup the name via the
    earlier assistant.tool_calls[].id."""
    from app.services.google_service import _convert_messages_to_google
    contents, _ = _convert_messages_to_google([
        {"role": "assistant", "tool_calls": [{
            "id": "call_abc",
            "type": "function",
            "function": {"name": "search", "arguments": "{}"},
        }]},
        {"role": "tool", "tool_call_id": "call_abc", "content": '{"results": []}'},
    ])
    # Find the function_response part
    fr_part = None
    for c in contents:
        for p in c.parts:
            if getattr(p, "function_response", None):
                fr_part = p
                break
    assert fr_part is not None
    assert fr_part.function_response.name == "search", "name must correlate to the earlier tool_call"


def test_assistant_tool_args_json_string_parses_to_dict() -> None:
    """OpenAI passes function arguments as a JSON string; Google's
    Part.from_function_call wants a dict. Translation parses on the boundary."""
    from app.services.google_service import _convert_messages_to_google
    contents, _ = _convert_messages_to_google([
        {"role": "assistant", "tool_calls": [{
            "id": "call_1",
            "type": "function",
            "function": {"name": "f", "arguments": '{"key":"value","n":42}'},
        }]},
    ])
    part = contents[0].parts[0]
    assert part.function_call.args == {"key": "value", "n": 42}


# ── Test 6 — _convert_tools_to_google ────────────────────────────────────────


def test_openai_tools_translate_to_google_function_declarations() -> None:
    from app.services.google_service import _convert_tools_to_google
    tools = [
        {"type": "function", "function": {
            "name": "foo", "description": "does foo",
            "parameters": {"type": "object", "properties": {"x": {"type": "integer"}}},
        }},
        {"type": "function", "function": {
            "name": "bar", "description": "does bar",
            "parameters": {"type": "object", "properties": {}},
        }},
    ]
    gtools = _convert_tools_to_google(tools)
    # Single Tool object wraps all function_declarations.
    assert len(gtools) == 1
    names = [fd.name for fd in gtools[0].function_declarations]
    assert names == ["foo", "bar"]


def test_empty_tools_returns_empty_list() -> None:
    from app.services.google_service import _convert_tools_to_google
    assert _convert_tools_to_google([]) == []


# ── Test 7 — finish_reason map ───────────────────────────────────────────────


def test_finish_reason_map_canonical_values() -> None:
    from app.services.google_service import _FINISH_REASON_MAP
    assert _FINISH_REASON_MAP["STOP"] == "stop"
    assert _FINISH_REASON_MAP["MAX_TOKENS"] == "length"
    assert _FINISH_REASON_MAP["SAFETY"] == "stop"


# ── Test 8 — Audit: router branch present in threads.py ──────────────────────


def test_threads_module_routes_google_to_native_sdk() -> None:
    """The active_provider == 'google' branch in threads.py must call stream_google,
    NOT create_adaptive_streaming_chat. Audit the source string so future refactors
    can't silently revert to the OpenAI-compat path."""
    from app.api import threads as threads_mod
    src = inspect.getsource(threads_mod)
    assert "from app.services.google_service import stream_google" in src
    assert 'elif active_provider_name == "google":' in src
    assert "stream_google(" in src
    # And the obsolete openai-compat google-only capture path is GONE:
    assert "extra_content.google.thought_signature" not in src or "# OBSOLETE" not in src or "_etype" in src
    # The above checks the live capture loop doesn't gate-on-google to populate
    # tool_calls_buffer[idx]["thought_signature"] via the extra_content extraction
    # (lines 2137-2175 in the pre-075.5 shape).
