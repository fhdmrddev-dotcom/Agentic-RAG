"""Native Google Gen AI SDK streaming adapter.

Yields normalized event dicts compatible with the threads.py agent loop —
identical schema to anthropic_service.py so the agent loop's per-provider
on_chunk callbacks stay structurally parallel.

Event schema (matches Anthropic path):
  {"type": "delta",              "content": str}
  {"type": "tool_preparing",     "id": str, "name": str, "index": int}
  {"type": "tool_args_progress", "tool_index": int, "name": str, "args_so_far": str, "total_args_bytes_so_far": int}
  {"type": "tool_start",         "id": str, "name": str, "args": dict}
  {"type": "finish",             "finish_reason": str, "tool_calls": list[dict]}
  {"type": "usage",              "input_tokens": int, "output_tokens": int}
  {"type": "usage_delta",        "output_tokens": int}

finish_reason canonical values (mirrors anthropic_service._STOP_REASON_MAP):
  "stop"       <- Google STOP / MAX_TOKENS-but-no-tool / generic completion
  "tool_calls" <- at least one function_call part present
  "length"     <- Google MAX_TOKENS without function_call

D-075.5-01 (Path B): Replaces the OpenAI-compatible Gemini path. The SDK's
auto-managed thought_signature round-trip (google-genai >= 1.55.0) makes the
extra_content.google.thought_signature serialization hack obsolete — the
field is now a first-class attribute on the Part object that we preserve
verbatim across rounds.

D-075.5-02 (feature parity only): This adapter exposes the same SSE surface
the OpenAI path does today (text deltas + tool calls + usage). Native
thinking-stream wiring + native code-execution-tool adoption are deferred
to a follow-on phase so the current UI keeps working unchanged.

D-075.5-03 (clean cut): Once threads.py routes active_provider="google"
here, the OpenAI-compat capture/persist/echo dance for thought_signature
in openai_service.py + threads.py is removed in the same commit train.
"""
from __future__ import annotations

import base64
import json
import logging
from typing import Any, Generator

from google import genai
from google.genai import types


def _encode_signature_for_json(sig: Any) -> str:
    """Google's native SDK returns ``thought_signature`` as raw protobuf bytes,
    which is not JSON-serializable. Downstream code (token estimator, DB
    persistence, _convert_messages_to_google on the next round) needs a JSON-safe
    string. Base64 is the canonical encoding for opaque-bytes-in-JSON and
    round-trips losslessly. If the value is already a str (e.g. cached from a
    prior reload), return as-is so we're idempotent."""
    if not sig:
        return ""
    if isinstance(sig, str):
        return sig
    if isinstance(sig, (bytes, bytearray)):
        return base64.b64encode(bytes(sig)).decode("ascii")
    # Defensive fallback: convert via str() for unexpected types.
    return str(sig)


def _decode_signature_for_part(sig: str) -> Any:
    """Reverse of _encode_signature_for_json. The Google SDK's
    ``Part.thought_signature`` field accepts EITHER a base64 str OR raw bytes
    (Pydantic auto-deserializes). We hand it bytes for safety so the wire
    serialization is deterministic."""
    if not sig:
        return None
    try:
        return base64.b64decode(sig)
    except (ValueError, TypeError):
        # If decode fails the cached value was probably already bytes-like or
        # something we can't reverse — pass through and let the SDK raise.
        return sig

# Phase 075.5 — match the LangSmith @traceable pattern from anthropic_service.py:35-41.
# wrap_google_genai is not yet released in the installed langsmith version
# (verified at adoption time); @traceable handles generator functions and
# tags this run_type="llm" surface in the LangSmith UI distinguishable
# from the OpenAI-wrap_openai path.
try:
    from langsmith import traceable as _ls_traceable
except ImportError:  # pragma: no cover — langsmith always installed in prod
    def _ls_traceable(*_args, **_kwargs):  # type: ignore[no-redef]
        def _wrap(fn):
            return fn
        return _wrap

logger = logging.getLogger(__name__)


# Canonical mapping from Google candidate.finish_reason to internal finish_reason.
# Source: google.genai.types.FinishReason enum values (verified against SDK 2.6.0).
_FINISH_REASON_MAP: dict[str, str] = {
    "STOP":                "stop",
    "MAX_TOKENS":          "length",
    "SAFETY":              "stop",       # treat moderation halts as stop; tool_calls aggregation still works
    "RECITATION":          "stop",
    "LANGUAGE":            "stop",
    "OTHER":               "stop",
    "BLOCKLIST":           "stop",
    "PROHIBITED_CONTENT":  "stop",
    "SPII":                "stop",
    "MALFORMED_FUNCTION_CALL": "stop",
    "IMAGE_SAFETY":        "stop",
}


# ── Translation: OpenAI-shape messages → Google Content[] ────────────────────


def _convert_messages_to_google(messages: list[dict]) -> tuple[list[types.Content], str]:
    """Convert OpenAI-shape messages → (Google Content list, system_instruction).

    The agent loop in threads.py builds messages in OpenAI shape; this
    adapter is the only place we translate to Google's native types.

    System messages are extracted and concatenated into a single system_instruction
    string (Google's API takes system_instruction separately from contents).

    Critical: thought_signature on assistant tool_calls (stored by upstream
    capture in the previous round) is attached to the function_call Part so the
    SDK round-trips it on the next request. Without this attachment, Gemini-3+
    returns 400 INVALID_ARGUMENT on the next tool round.
    """
    contents: list[types.Content] = []
    system_parts: list[str] = []
    # Map tool_call_id -> function name for tool result correlation.
    # Google's Part.from_function_response requires name + id; OpenAI's
    # tool role messages carry id but not name (the name lives on the
    # earlier assistant.tool_calls entry).
    tool_id_to_name: dict[str, str] = {}

    for msg in messages:
        role = msg.get("role", "")
        if role == "system":
            content = msg.get("content", "")
            if isinstance(content, str) and content:
                system_parts.append(content)
            continue

        if role == "user":
            content = msg.get("content", "")
            if isinstance(content, str) and content:
                contents.append(types.Content(
                    role="user",
                    parts=[types.Part.from_text(text=content)],
                ))
            elif isinstance(content, list):
                # multimodal user content (image_url parts etc.) — flatten text-only for now;
                # multimodal-input wiring deferred to follow-on phase per D-075.5-02.
                text_chunks = [p.get("text", "") for p in content if isinstance(p, dict) and p.get("type") == "text"]
                joined = "\n".join(t for t in text_chunks if t)
                if joined:
                    contents.append(types.Content(
                        role="user",
                        parts=[types.Part.from_text(text=joined)],
                    ))
            continue

        if role == "assistant":
            parts: list[types.Part] = []
            text = msg.get("content")
            if isinstance(text, str) and text:
                parts.append(types.Part.from_text(text=text))
            tool_calls = msg.get("tool_calls") or []
            for tc in tool_calls:
                fn = tc.get("function") or {}
                name = fn.get("name", "") or tc.get("name", "")
                raw_args = fn.get("arguments", "") or tc.get("arguments", "")
                # OpenAI shape carries arguments as a JSON string; Google wants a dict.
                if isinstance(raw_args, str):
                    try:
                        args_dict = json.loads(raw_args) if raw_args else {}
                    except json.JSONDecodeError:
                        args_dict = {}
                else:
                    args_dict = raw_args or {}
                tc_id = tc.get("id", "") or ""
                if tc_id and name:
                    tool_id_to_name[tc_id] = name
                # D-075.5-01: attach thought_signature directly to the Part so the SDK
                # round-trips it. The capture closure in the streaming loop below
                # stores tc["thought_signature"] when the upstream chunk carried one.
                sig = tc.get("thought_signature")
                fc_part = types.Part.from_function_call(name=name, args=args_dict)
                # ID is set separately on Part.function_call after construction in
                # google-genai 2.x — set it via attribute so a missing id (e.g. when
                # the upstream OpenAI-compat path stored "") doesn't error.
                if tc_id:
                    try:
                        fc_part.function_call.id = tc_id
                    except (AttributeError, TypeError):
                        pass
                if sig:
                    # Cached signature is a base64-string (see _encode_signature_for_json
                    # on the capture path). Decode back to raw bytes for the SDK Part.
                    try:
                        fc_part.thought_signature = _decode_signature_for_part(sig)
                    except (AttributeError, TypeError):
                        logger.debug("Could not attach thought_signature to function_call Part (SDK shape changed?)")
                parts.append(fc_part)
            if parts:
                # Google's role for assistant turn is "model".
                contents.append(types.Content(role="model", parts=parts))
            continue

        if role == "tool":
            tc_id = msg.get("tool_call_id", "") or ""
            name = tool_id_to_name.get(tc_id, "") or msg.get("name", "") or "tool"
            raw = msg.get("content", "")
            # OpenAI tool result content is typically a string; Google wants a dict response.
            if isinstance(raw, str):
                try:
                    response_dict: Any = {"result": json.loads(raw)}
                except (json.JSONDecodeError, TypeError):
                    response_dict = {"result": raw}
            elif isinstance(raw, dict):
                response_dict = raw
            else:
                response_dict = {"result": str(raw)}
            fr_part = types.Part.from_function_response(name=name, response=response_dict)
            # Some Google SDK versions accept id at construction; set via attribute too
            # for safety.
            if tc_id:
                try:
                    fr_part.function_response.id = tc_id
                except (AttributeError, TypeError):
                    pass
            # Function responses go in a user-role Content per Google's chat convention.
            contents.append(types.Content(role="user", parts=[fr_part]))
            continue

    system_instruction = "\n\n".join(system_parts) if system_parts else ""
    return contents, system_instruction


# ── Translation: OpenAI-shape tools → Google FunctionDeclaration[] ───────────


# Google's OpenAPI subset for tool parameter schemas REJECTS these JSON Schema
# fields with 400 INVALID_ARGUMENT (verified live 2026-05-23 on
# `additionalProperties` in search_documents.metadata_filter +
# query_tables.column_filter). The same schemas work fine for OpenAI / Anthropic,
# so we strip on the Google boundary only — original tool defs in
# openai_service.get_tools() stay untouched.
_GOOGLE_UNSUPPORTED_SCHEMA_KEYS: frozenset[str] = frozenset({
    "additionalProperties",
    "additional_properties",  # defensive: some serializers emit snake_case
    "$ref",
    "$schema",
    "definitions",
    "patternProperties",
    "oneOf",
    "anyOf",
    "allOf",
    "not",
    "if",
    "then",
    "else",
    "examples",  # Google ignores; safer to strip
    "$defs",
    "unevaluatedProperties",
    "unevaluatedItems",
})


def _sanitize_schema_for_google(schema: Any) -> Any:
    """Recursively strip JSON Schema fields Google's OpenAPI subset rejects.

    The map-type idiom (``additionalProperties: {type: "string"}``) loses its
    value-type constraint after this strip — the property still accepts an
    object, just without per-value schema validation. This is the right
    trade-off: Google's tool schema isn't expressive enough for arbitrary
    maps, and our tool implementations handle malformed values defensively
    (search_documents and query_tables both validate metadata_filter /
    column_filter at call time before forwarding to Postgres).
    """
    if isinstance(schema, dict):
        return {
            k: _sanitize_schema_for_google(v)
            for k, v in schema.items()
            if k not in _GOOGLE_UNSUPPORTED_SCHEMA_KEYS
        }
    if isinstance(schema, list):
        return [_sanitize_schema_for_google(item) for item in schema]
    return schema


def _convert_tools_to_google(tools: list[dict]) -> list[types.Tool]:
    """Convert OpenAI tools-array → Google Tool (single Tool wrapping all
    function_declarations). The schema bodies are already OpenAPI-shape on both
    sides, but Google strict-validates against its narrower subset, so each
    parameter schema is sanitized before construction (see
    _sanitize_schema_for_google)."""
    declarations: list[dict] = []
    for tool in tools or []:
        fn = tool.get("function") or {}
        name = fn.get("name", "")
        description = fn.get("description", "") or ""
        raw_parameters = fn.get("parameters") or {"type": "object", "properties": {}}
        parameters = _sanitize_schema_for_google(raw_parameters)
        if not name:
            continue
        declarations.append({
            "name": name,
            "description": description,
            "parameters": parameters,
        })
    if not declarations:
        return []
    return [types.Tool(function_declarations=declarations)]


# ── Main streaming entry point ───────────────────────────────────────────────


@_ls_traceable(run_type="llm", name="google.genai.streaming_chat")
def stream_google(
    messages: list[dict],
    tools: list[dict],
    system_prompt: str,
    model: str,
    api_key: str,
    max_tokens: int,
    force_no_tools: bool = False,
) -> Generator[dict, None, None]:
    """Stream a Gemini call via the native google-genai SDK; yield normalized
    event dicts for the threads.py agent loop.

    Uses sync ``genai.Client`` (matches existing OpenAI sync pattern in
    threads.py). Function-calling auto-mode is DISABLED (the agent loop owns
    tool dispatch — SDK auto-invoke would short-circuit our sandbox and
    LangSmith traces).
    """
    client = genai.Client(api_key=api_key)

    google_contents, system_instruction_from_messages = _convert_messages_to_google(messages)
    google_tools = _convert_tools_to_google(tools) if (tools and not force_no_tools) else []

    # Prefer explicit system_prompt arg; fall back to system-role messages.
    effective_system = system_prompt or system_instruction_from_messages or None

    config_kwargs: dict[str, Any] = {
        "max_output_tokens": max_tokens,
        # D-075.5-02 parity-only: disable automatic function calling so the
        # agent loop in threads.py keeps controlling tool dispatch. Without
        # this the SDK would try to call Python callables and short-circuit
        # our sandbox / SSE event emit / LangSmith trace structure.
        "automatic_function_calling": types.AutomaticFunctionCallingConfig(disable=True),
    }
    if effective_system:
        config_kwargs["system_instruction"] = effective_system
    if google_tools:
        config_kwargs["tools"] = google_tools

    config = types.GenerateContentConfig(**config_kwargs)

    # Per-tool-index tracking for the normalized event stream.
    # In Google's streaming, function_call parts can arrive complete in a single
    # chunk (args fully populated) OR be split across chunks; we accumulate by
    # the order they're first seen.
    tool_blocks: dict[int, dict] = {}
    next_tool_index = 0
    # Match the OpenAI path's tool_args_progress 5KB-boundary cadence.
    _tool_args_emit_boundary: dict[int, int] = {}
    finish_reason: str = "stop"
    saw_function_call = False

    # Track usage across chunks. Google emits cumulative usage_metadata on every
    # chunk (per probe doc 075.3-01-PLAN.md) — we yield once at the start with
    # the first sighting then a final usage_delta with the last.
    yielded_initial_usage = False
    last_input_tokens = 0
    last_output_tokens = 0

    try:
        stream = client.models.generate_content_stream(
            model=model,
            contents=google_contents,
            config=config,
        )
    except Exception:
        logger.exception("google-genai client.generate_content_stream raised on init")
        raise

    for chunk in stream:
        # ── usage_metadata (cumulative per probe) ─────────────────────────
        usage = getattr(chunk, "usage_metadata", None)
        if usage is not None:
            cur_in = getattr(usage, "prompt_token_count", 0) or 0
            cur_out = getattr(usage, "candidates_token_count", 0) or 0
            if not yielded_initial_usage:
                yielded_initial_usage = True
                last_input_tokens = cur_in
                last_output_tokens = cur_out
                yield {"type": "usage", "input_tokens": cur_in, "output_tokens": cur_out}
            else:
                # Cumulative — emit incremental delta in output_tokens since last seen.
                # Input tokens are constant once the prompt is sent; only output grows.
                delta_out = max(0, cur_out - last_output_tokens)
                last_output_tokens = cur_out
                if delta_out > 0:
                    yield {"type": "usage_delta", "output_tokens": delta_out}

        # ── candidates / parts ────────────────────────────────────────────
        candidates = getattr(chunk, "candidates", None) or []
        if not candidates:
            continue
        cand = candidates[0]
        cand_content = getattr(cand, "content", None)
        if cand_content is not None:
            parts = getattr(cand_content, "parts", None) or []
            for part in parts:
                # Text delta
                text = getattr(part, "text", None)
                if text:
                    yield {"type": "delta", "content": text}
                    continue

                # Function call (the args dict may already be complete on this single chunk
                # since Google doesn't stream args character-by-character)
                fc = getattr(part, "function_call", None)
                if fc is not None and getattr(fc, "name", None):
                    saw_function_call = True
                    idx = next_tool_index
                    next_tool_index += 1
                    name = fc.name
                    args = dict(fc.args) if fc.args else {}
                    fc_id = getattr(fc, "id", "") or ""
                    # Capture thought_signature from the Part (Gemini-3+); store
                    # on the buffer entry so the upstream agent loop can persist
                    # it into messages.tool_calls jsonb for next-round echo.
                    # Google's SDK returns this as raw protobuf bytes; the
                    # downstream pipeline (token-estimate json.dumps, asyncpg
                    # jsonb persist, _convert_messages_to_google on the next
                    # round) all need a JSON-safe string — base64 encode here.
                    raw_sig = getattr(part, "thought_signature", None)
                    sig = _encode_signature_for_json(raw_sig)
                    tool_blocks[idx] = {
                        "id": fc_id or f"call_{idx}",
                        "name": name,
                        "arguments": json.dumps(args, ensure_ascii=False),
                        "thought_signature": sig,
                    }
                    # tool_preparing immediately (name known).
                    yield {
                        "type": "tool_preparing",
                        "id": tool_blocks[idx]["id"],
                        "name": name,
                        "index": idx,
                    }
                    # Match OpenAI path's 5KB-boundary progress.
                    # T-260523-09 (2026-05-23): the prior `!= "execute_code"`
                    # filter caused total UI silence during the long
                    # code-generation LLM calls. Removed; frontend renders
                    # bytes streamed as a badge, not raw code.
                    if name:
                        args_str = tool_blocks[idx]["arguments"]
                        _bytes_total = len(args_str.encode("utf-8"))
                        if _bytes_total > 0:
                            _last_boundary = _tool_args_emit_boundary.get(idx, 0)
                            _new_boundary = _bytes_total // 5120
                            if _new_boundary > _last_boundary:
                                _tool_args_emit_boundary[idx] = _new_boundary
                                _tail_bytes = args_str.encode("utf-8")[-5120:]
                                _args_so_far = _tail_bytes.decode("utf-8", errors="ignore")
                                yield {
                                    "type": "tool_args_progress",
                                    "tool_index": idx,
                                    "name": name,
                                    "args_so_far": _args_so_far,
                                    "total_args_bytes_so_far": _bytes_total,
                                    # Phase 075.6 Plan 01 / Req #1: additive
                                    # `code_so_far` field carrying the FULL
                                    # cumulative concatenated args string.
                                    # Equivalent of Anthropic's `tb["arguments"]`
                                    # — see RESEARCH Pitfall 3 (contrast with
                                    # `args_so_far` = 5 KB sliding-window tail).
                                    "code_so_far": tool_blocks[idx]["arguments"],
                                }
                    # tool_start (args complete on this chunk for Google).
                    yield {
                        "type": "tool_start",
                        "id": tool_blocks[idx]["id"],
                        "name": name,
                        "args": args,
                    }
                    continue

                # Inline thought / thought_signature on a non-function part
                # (Gemini-3 may emit signature parts independent of function calls
                # in some thinking flows — capture is no-op without a tool block
                # to attach to, but the SDK auto-handles echo in that case).
                sig_only = getattr(part, "thought_signature", None)
                if sig_only and not getattr(part, "function_call", None):
                    # Nothing to emit downstream — SDK preserves it when the next
                    # request includes the same Content list. We don't surface
                    # standalone thought events to the UI in this phase (D-075.5-02).
                    pass

        # ── candidate finish_reason (terminal chunk usually carries it) ───
        cand_fr = getattr(cand, "finish_reason", None)
        if cand_fr is not None:
            # finish_reason can be Enum or string; normalize.
            cand_fr_name = getattr(cand_fr, "name", None) or str(cand_fr)
            mapped = _FINISH_REASON_MAP.get(cand_fr_name, "stop")
            # If we saw any function_call this turn, mark as tool_calls regardless of
            # what Google's enum says — matches the OpenAI-path semantics.
            finish_reason = "tool_calls" if saw_function_call else mapped

    yield {
        "type": "finish",
        "finish_reason": finish_reason,
        "tool_calls": list(tool_blocks.values()),
    }
