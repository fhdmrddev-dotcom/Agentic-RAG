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
        inline_pattern = r'\{\s*"tool"\s*:\s*"([^"]+)"\s*,\s*"arguments"\s*:\s*(\{[\s\S]*?\})\s*\}'
        inline_matches = re.findall(inline_pattern, text, re.DOTALL)
        for name, args_str in inline_matches:
            if name in known_tools:
                calls.append(ToolCall(
                    id=f"call_{uuid.uuid4().hex[:24]}",
                    type="function",
                    function=FunctionCall(name=name, arguments=args_str)
                ))
    
    return calls


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
