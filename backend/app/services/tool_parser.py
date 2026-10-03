"""Structured tool call parser for non-native tool calling modes.

Extracts tool invocations from model response text when native API tool calling
is not available or reliable. Normalizes to OpenAI-compatible ToolCall format.
"""
from __future__ import annotations

import json
import re
import uuid
from dataclasses import dataclass


@dataclass
class FunctionCall:
    """Function call details within a ToolCall."""
    name: str
    arguments: str  # JSON-encoded string


@dataclass
class ToolCall:
    """OpenAI-compatible tool call representation."""
    id: str
    type: str
    function: FunctionCall


# Known tool names for validation
# Populated lazily from openai_service.get_tools()
_KNOWN_TOOLS: set[str] | None = None


def _get_known_tools() -> set[str]:
    """Lazy load known tool names from the tool registry."""
    global _KNOWN_TOOLS
    if _KNOWN_TOOLS is None:
        try:
            from app.services.openai_service import get_tools
            tools = get_tools()
            _KNOWN_TOOLS = {t["function"]["name"] for t in tools}
        except Exception:
            _KNOWN_TOOLS = set()
    return _KNOWN_TOOLS


def parse_structured_tool_calls(text: str, known_tools: set[str] | None = None) -> list[ToolCall]:
    """Extract tool calls from markdown JSON blocks or inline JSON in text.
    
    Supports two formats:
    1. Markdown code fences:
       ```json
       {"tool": "search_documents", "arguments": {"query": "hello"}}
       ```
    
    2. Inline JSON objects:
       {"tool": "search_documents", "arguments": {"query": "hello"}}
    
    Args:
        text: Model response text to parse
        known_tools: Optional set of valid tool names. If None, loads from registry.
    
    Returns:
        List of ToolCall objects normalized to OpenAI format. Empty list if no valid
        tool calls found or if parsing fails.
    """
    if not text or not text.strip():
        return []
    
    if known_tools is None:
        known_tools = _get_known_tools()
    
    calls: list[ToolCall] = []
    
    # Strategy 1: Markdown JSON blocks
    md_pattern = r'```json\s*(\{[\s\S]*?\})\s*```'
    md_matches = re.findall(md_pattern, text, re.DOTALL)
    
    for match in md_matches:
        call = _parse_single_tool_call(match, known_tools)
        if call:
            calls.append(call)
    
    # Strategy 2: Inline JSON objects (only if no markdown blocks found)
    if not calls:
        calls.extend(_parse_inline_calls(text, known_tools))

    return calls


# The legacy inline regex. Its non-greedy `(\{...\})\s*\}` stops at the FIRST `}}`, so for any
# arguments object whose last value is itself an object it drops the outer brace (273-REVIEW WR-01:
# every show_artifact chart call). Kept ONLY as the fallback for text that is not valid JSON, so a
# malformed call still reaches the dispatcher (which tells the model its arguments did not parse).
_INLINE_LEGACY = re.compile(r'\{\s*"tool"\s*:\s*"([^"]+)"\s*,\s*"arguments"\s*:\s*(\{[\s\S]*?\})\s*\}', re.DOTALL)
_INLINE_START = re.compile(r'\{\s*"tool"\s*:')
_DECODER = json.JSONDecoder()


def _parse_inline_calls(text: str, known_tools: set[str]) -> list[ToolCall]:
    """Inline ``{"tool": …, "arguments": {…}}`` objects, decoded brace-balanced (``raw_decode``)."""
    out: list[ToolCall] = []
    pos = 0
    while True:
        m = _INLINE_START.search(text, pos)
        if m is None:
            return out
        try:
            obj, end = _DECODER.raw_decode(text, m.start())
        except json.JSONDecodeError:
            legacy = _INLINE_LEGACY.match(text, m.start())
            if legacy is None:
                pos = m.end()
                continue
            name, args_str = legacy.group(1), legacy.group(2)
            end = legacy.end()
        else:
            if not isinstance(obj, dict) or not isinstance(obj.get("tool"), str) or "arguments" not in obj:
                pos = m.end()
                continue
            name = obj["tool"]
            arguments = obj["arguments"]
            args_str = arguments if isinstance(arguments, str) else json.dumps(arguments)
        if name in known_tools:
            out.append(ToolCall(
                id=f"call_{uuid.uuid4().hex[:24]}",
                type="function",
                function=FunctionCall(name=name, arguments=args_str),
            ))
        pos = end


def _parse_single_tool_call(json_text: str, known_tools: set[str]) -> ToolCall | None:
    """Parse a single JSON object into a ToolCall."""
    try:
        data = json.loads(json_text)
    except json.JSONDecodeError:
        return None
    
    if not isinstance(data, dict):
        return None
    
    tool_name = data.get("tool")
    arguments = data.get("arguments")
    
    if not tool_name or not isinstance(tool_name, str):
        return None
    
    if tool_name not in known_tools:
        return None
    
    # Normalize arguments to JSON string
    if isinstance(arguments, dict):
        arguments = json.dumps(arguments)
    elif not isinstance(arguments, str):
        arguments = json.dumps(arguments)
    
    return ToolCall(
        id=f"call_{uuid.uuid4().hex[:24]}",
        type="function",
        function=FunctionCall(name=tool_name, arguments=arguments)
    )
