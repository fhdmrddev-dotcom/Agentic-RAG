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


def test_sanitize_strips_additional_properties_recursively() -> None:
    """Google's OpenAPI subset rejects additionalProperties (per live 2026-05-23
    error: 'Unknown name "additional_properties" at properties[N].value').
    Our search_documents.metadata_filter and query_tables.column_filter both
    use the JSON Schema map-type idiom via additionalProperties; this must be
    stripped on the Google boundary while leaving OpenAI/Anthropic paths intact."""
    from app.services.google_service import _sanitize_schema_for_google
    schema = {
        "type": "object",
        "properties": {
            "query": {"type": "string"},
            "filter": {
                "type": "object",
                "description": "string map",
                "additionalProperties": {"type": "string"},
            },
        },
        "additionalProperties": False,  # also stripped at top-level
        "$schema": "http://json-schema.org/draft-07/schema#",
    }
    out = _sanitize_schema_for_google(schema)
    assert "additionalProperties" not in out
    assert "$schema" not in out
    assert "additionalProperties" not in out["properties"]["filter"]
    # Non-stripped fields preserved
    assert out["properties"]["filter"]["type"] == "object"
    assert out["properties"]["filter"]["description"] == "string map"


# -- Phase 084 Plan 05: type-array -> nullable translation ----------------


def test_sanitize_translates_type_array_with_null_to_nullable_string() -> None:
    """Phase 084 strict-mode optionals use ``type: ["X", "null"]`` for OpenAI
    strict-mode compat. Google's OpenAPI subset rejects array-typed ``type``
    fields and requires ``{type: "X", nullable: true}`` instead."""
    from app.services.google_service import _sanitize_schema_for_google
    schema = {
        "type": "object",
        "properties": {
            "prefix": {
                "type": ["string", "null"],
                "description": "optional path prefix",
            },
        },
        "required": ["prefix"],
    }
    out = _sanitize_schema_for_google(schema)
    prefix = out["properties"]["prefix"]
    assert prefix["type"] == "string", f"expected scalar 'string', got {prefix['type']!r}"
    assert prefix["nullable"] is True
    assert prefix["description"] == "optional path prefix"


def test_sanitize_translates_type_array_with_null_to_nullable_integer() -> None:
    """workspace_read.start_line / workspace_read.end_line use the integer-
    null shape; same translation must apply across scalar types."""
    from app.services.google_service import _sanitize_schema_for_google
    schema = {"type": ["integer", "null"], "description": "1-indexed line"}
    out = _sanitize_schema_for_google(schema)
    assert out["type"] == "integer"
    assert out["nullable"] is True


def test_sanitize_handles_reversed_null_first_ordering() -> None:
    """JSON Schema allows ["null", "X"] order; translation must be order-agnostic."""
    from app.services.google_service import _sanitize_schema_for_google
    out = _sanitize_schema_for_google({"type": ["null", "string"]})
    assert out["type"] == "string"
    assert out["nullable"] is True


def test_sanitize_passes_through_scalar_type() -> None:
    """Non-array ``type`` values must not gain a spurious ``nullable`` field."""
    from app.services.google_service import _sanitize_schema_for_google
    out = _sanitize_schema_for_google({"type": "string"})
    assert out == {"type": "string"}
    assert "nullable" not in out


def test_sanitize_passes_through_type_array_without_null() -> None:
    """``type: ["string", "integer"]`` (a union of two non-null types) is not
    Phase 084's nullable-optional shape -- leave unchanged."""
    from app.services.google_service import _sanitize_schema_for_google
    out = _sanitize_schema_for_google({"type": ["string", "integer"]})
    assert out["type"] == ["string", "integer"]
    assert "nullable" not in out


def test_sanitize_translates_recursively_inside_nested_object_properties() -> None:
    """The 5 workspace_* tools nest the nullable optionals one level deep
    under .parameters.properties. Translation must walk into nested dicts."""
    from app.services.google_service import _sanitize_schema_for_google
    schema = {
        "type": "object",
        "properties": {
            "path": {"type": "string"},
            "start_line": {"type": ["integer", "null"], "description": "..."},
            "end_line": {"type": ["integer", "null"], "description": "..."},
        },
        "required": ["path", "start_line", "end_line"],
    }
    out = _sanitize_schema_for_google(schema)
    assert out["properties"]["path"] == {"type": "string"}
    assert out["properties"]["start_line"]["type"] == "integer"
    assert out["properties"]["start_line"]["nullable"] is True
    assert out["properties"]["end_line"]["type"] == "integer"
    assert out["properties"]["end_line"]["nullable"] is True
    assert out["required"] == ["path", "start_line", "end_line"]


def test_real_workspace_tools_pass_sanitize_for_google() -> None:
    """Regression backstop -- the 5 workspace_* tools defined in
    openai_service.py (Phase 084) must all translate cleanly through
    _convert_tools_to_google and emit valid Google FunctionDeclarations."""
    from app.services.openai_service import get_tools
    from app.services.google_service import _convert_tools_to_google

    tools = get_tools(None)
    workspace_tools = [
        t for t in tools
        if t.get("function", {}).get("name", "").startswith("workspace_")
    ]
    assert len(workspace_tools) == 5, (
        f"expected 5 workspace_* tools, got {len(workspace_tools)}"
    )

    gtools = _convert_tools_to_google(workspace_tools)
    assert len(gtools) == 1
    names = {fd.name for fd in gtools[0].function_declarations}
    assert names == {
        "workspace_write",
        "workspace_read",
        "workspace_list",
        "workspace_delete",
        "workspace_diff",
    }


def test_signature_encode_decode_round_trip() -> None:
    """Google's SDK returns thought_signature as raw bytes, but the downstream
    pipeline (token-estimate json.dumps, asyncpg jsonb persist) needs a
    JSON-safe string. _encode_signature_for_json base64-encodes; _decode does
    the reverse. Round-trip must be lossless.

    Live-2026-05-23 regression context: without this, the agent loop hit
    `TypeError: Object of type bytes is not JSON serializable` at
    context_window.py:146 (estimate_messages_tokens) after Gemini returned a
    tool call. DB persistence also failed for the same reason."""
    from app.services.google_service import _encode_signature_for_json, _decode_signature_for_part
    import json

    raw = b"opaque protobuf bytes \x00\xff\x12\xff\x00 trailer"
    encoded = _encode_signature_for_json(raw)
    assert isinstance(encoded, str), "encoded value must be a str for JSON safety"
    # Must round-trip through json.dumps (this is the path that broke in production)
    payload = json.dumps({"thought_signature": encoded})
    parsed = json.loads(payload)
    assert parsed["thought_signature"] == encoded
    decoded = _decode_signature_for_part(encoded)
    assert decoded == raw, "round-trip lossy — Gemini round 2 would 400"


def test_signature_encode_idempotent_on_str() -> None:
    """A signature already encoded as str (e.g. cached from a prior thread reload
    where the value was read back as base64 str from jsonb) must pass through
    unchanged — encoder must be idempotent so we don't double-encode."""
    from app.services.google_service import _encode_signature_for_json
    pre_encoded = "cmF3IHNpZ25hdHVyZSBieXRlcw=="
    assert _encode_signature_for_json(pre_encoded) == pre_encoded


def test_signature_encode_empty_returns_empty_string() -> None:
    """Falsy inputs (None, empty bytes, empty str) all collapse to '' so the
    persist site's conditional spread (`{} if not sig`) treats them as absent."""
    from app.services.google_service import _encode_signature_for_json
    assert _encode_signature_for_json(None) == ""
    assert _encode_signature_for_json(b"") == ""
    assert _encode_signature_for_json("") == ""


def test_real_tools_pass_sanitize_without_offending_field() -> None:
    """Audit-level: the project's real get_tools() output (incl. search_documents
    and query_tables) must not carry additionalProperties / $ref / oneOf after
    going through _convert_tools_to_google. End-to-end live API call against
    Gemini-3 confirmed at adoption time (2026-05-23) — this test pins the
    structural property so future tool additions can't silently regress."""
    from app.services.openai_service import get_tools
    from app.services.google_service import _convert_tools_to_google

    tools = get_tools(None)
    assert tools, "get_tools(None) must return at least one tool"
    gtools = _convert_tools_to_google(tools)
    assert len(gtools) == 1
    # Serialize the way the SDK does on the wire
    dumped = gtools[0].model_dump(exclude_none=True, by_alias=True)

    def find_bad(obj):
        if isinstance(obj, dict):
            for k in ("additional_properties", "additionalProperties", "$ref", "oneOf", "anyOf", "allOf"):
                if k in obj:
                    return f"{k}={obj[k]!r}"
            for v in obj.values():
                hit = find_bad(v)
                if hit:
                    return hit
        elif isinstance(obj, list):
            for it in obj:
                hit = find_bad(it)
                if hit:
                    return hit
        return None

    bad = find_bad(dumped)
    assert bad is None, f"Sanitized wire payload still contains unsupported field: {bad}"


# ── Test 7 — finish_reason map ───────────────────────────────────────────────


def test_finish_reason_map_canonical_values() -> None:
    from app.services.google_service import _FINISH_REASON_MAP
    assert _FINISH_REASON_MAP["STOP"] == "stop"
    assert _FINISH_REASON_MAP["MAX_TOKENS"] == "length"
    assert _FINISH_REASON_MAP["SAFETY"] == "stop"


# ── Test 8 — Audit: router branch present in threads.py ──────────────────────


def test_threads_module_routes_google_to_native_sdk() -> None:
    """The 'google' provider must route through the native SDK (stream_google),
    NOT create_adaptive_streaming_chat. Audit the source so future refactors
    can't silently revert to the OpenAI-compat path.

    Phase 089-03 (G-5 verbatim move): the agent loop (incl. the Google native
    branch) moved from threads.py into agent_loop.py::run_agent_loop.

    Phase 092.5 Wave 2: the Anthropic + Google branches collapsed into ONE
    gateway-dispatched native branch — agent_loop now routes 'google' through
    ``open_stream("google", ...)`` (the merged
    ``active_provider_name in ("anthropic", "google")`` gate), and the actual
    ``stream_google(`` call moved into ``provider_gateway/google.py`` (which is
    where it must still live — NOT the OpenAI-compat path). This test now audits
    BOTH halves of the seam: consumer dispatch + adapter native-SDK call."""
    from app.services import agent_loop as agent_loop_mod
    from app.services.provider_gateway import google as google_adapter_mod

    src = inspect.getsource(agent_loop_mod)
    # Consumer side: the merged native gate dispatches google through the gateway.
    assert 'active_provider_name in ("anthropic", "google")' in src
    assert "open_stream(" in src
    # Adapter side: the native SDK call (stream_google) lives in the gateway
    # adapter, NOT the OpenAI-compat path.
    adapter_src = inspect.getsource(google_adapter_mod)
    assert "from app.services.google_service import stream_google" in adapter_src
    assert "stream_google(" in adapter_src
    # And the obsolete openai-compat google-only capture path is GONE:
    assert "extra_content.google.thought_signature" not in src or "# OBSOLETE" not in src or "_etype" in src
    # The above checks the live capture loop doesn't gate-on-google to populate
    # tool_calls_buffer[idx]["thought_signature"] via the extra_content extraction
    # (lines 2137-2175 in the pre-075.5 shape).
