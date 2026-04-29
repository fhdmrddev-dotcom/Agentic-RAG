"""Native Anthropic SDK streaming adapter.

Yields normalized event dicts compatible with the threads.py agent loop.
The agent loop is unchanged — this module handles all SDK-specific translation.

Event schema (matches OpenAI path in threads.py):
  {"type": "delta",      "content": str}
  {"type": "tool_start", "id": str, "name": str, "args": dict}
  {"type": "finish",     "finish_reason": str, "tool_calls": list[dict]}

finish_reason canonical values:
  "stop"       <- Anthropic end_turn
  "tool_calls" <- Anthropic tool_use
  "length"     <- Anthropic max_tokens

Implements GEN-02 (D-02, D-03, D-05).
"""
from __future__ import annotations

import json
import logging
from typing import TYPE_CHECKING, Generator

import anthropic

from app.config import settings

if TYPE_CHECKING:
    from app.models.user_settings import UserEffectiveSettings

logger = logging.getLogger(__name__)

# Canonical mapping from Anthropic stop_reason to internal finish_reason
_STOP_REASON_MAP: dict[str, str] = {
    "end_turn":   "stop",
    "tool_use":   "tool_calls",
    "max_tokens": "length",
}


def _convert_messages_to_anthropic(messages: list[dict]) -> list[dict]:
    """Convert OpenAI-format messages array to Anthropic native format.

    Rules:
    - role="system" messages are stripped (caller passes system separately)
    - role="assistant" with tool_calls -> content blocks with type="tool_use"
    - consecutive role="tool" messages after assistant+tool_calls ->
      bundled into ONE role="user" message with tool_result blocks
      (Anthropic requires all tool results for a round in a single user message)
    """
    result: list[dict] = []
    i = 0
    while i < len(messages):
        msg = messages[i]
        role = msg.get("role")

        if role == "system":
            i += 1
            continue  # extracted to top-level system param by caller

        if role == "user":
            result.append({"role": "user", "content": msg.get("content", "")})
            i += 1

        elif role == "assistant":
            tool_calls = msg.get("tool_calls")
            if tool_calls:
                content_blocks: list[dict] = []
                text_content = msg.get("content") or ""
                if text_content:
                    content_blocks.append({"type": "text", "text": text_content})
                for tc in tool_calls:
                    fn = tc.get("function", {})
                    try:
                        parsed_input = json.loads(fn.get("arguments", "{}") or "{}")
                    except (json.JSONDecodeError, TypeError):
                        parsed_input = {}
                    content_blocks.append({
                        "type": "tool_use",
                        "id": tc["id"],
                        "name": fn["name"],
                        "input": parsed_input,
                    })
                result.append({"role": "assistant", "content": content_blocks})

                # Consume ALL consecutive role="tool" messages into ONE user message
                i += 1
                tool_result_blocks: list[dict] = []
                while i < len(messages) and messages[i].get("role") == "tool":
                    tr = messages[i]
                    tool_result_blocks.append({
                        "type": "tool_result",
                        "tool_use_id": tr["tool_call_id"],
                        "content": tr.get("content", ""),
                    })
                    i += 1
                if tool_result_blocks:
                    result.append({"role": "user", "content": tool_result_blocks})
            else:
                result.append({"role": "assistant", "content": msg.get("content", "")})
                i += 1
        else:
            i += 1

    return result


def _convert_tools_to_anthropic(tools: list[dict]) -> list[dict]:
    """Convert OpenAI function-wrapper format to Anthropic flat format.

    - Removes the type:"function" wrapper
    - Uses "input_schema" key (not "parameters")
    - Adds cache_control={"type":"ephemeral"} to the LAST tool (caches all tools, D-05)
    """
    anthropic_tools: list[dict] = []
    for tool in tools:
        fn = tool.get("function", {})
        anthropic_tools.append({
            "name": fn["name"],
            "description": fn.get("description", ""),
            "input_schema": fn.get("parameters", {"type": "object", "properties": {}}),
        })
    if anthropic_tools:
        anthropic_tools[-1]["cache_control"] = {"type": "ephemeral"}
    return anthropic_tools


def stream_anthropic(
    messages: list[dict],
    tools: list[dict],
    system_prompt: str,
    model: str,
    api_key: str,
    max_tokens: int,
    force_no_tools: bool = False,
) -> Generator[dict, None, None]:
    """Stream Anthropic API call; yield normalized event dicts for threads.py agent loop.

    Uses sync anthropic.Anthropic() client (matches existing OpenAI sync pattern in threads.py).
    System prompt cached via cache_control (D-05).
    Tool arguments buffered until content_block_stop before yielding tool_start
    (avoids partial-JSON issue — see RESEARCH.md anti-pattern #1).
    """
    client = anthropic.Anthropic(api_key=api_key)

    anthropic_messages = _convert_messages_to_anthropic(messages)
    anthropic_tools = _convert_tools_to_anthropic(tools) if tools else []

    # System prompt as content block array with cache_control (D-05)
    system = [{"type": "text", "text": system_prompt, "cache_control": {"type": "ephemeral"}}]

    # tool_choice must be a dict (Anthropic does not accept string shorthand)
    tool_choice = {"type": "none"} if force_no_tools else {"type": "auto"}

    # tool_choice is invalid when tools list is empty
    stream_kwargs: dict = {
        "model": model,
        "max_tokens": max_tokens,
        "system": system,
        "messages": anthropic_messages,
    }
    if anthropic_tools:
        stream_kwargs["tools"] = anthropic_tools
        stream_kwargs["tool_choice"] = tool_choice

    tool_blocks: dict[int, dict] = {}  # index -> {id, name, arguments}
    finish_reason: str = "stop"

    with client.messages.stream(**stream_kwargs) as stream:
        for event in stream:
            event_type = event.type

            if event_type == "content_block_start":
                block = event.content_block
                if block.type == "tool_use":
                    tool_blocks[event.index] = {
                        "id": block.id,
                        "name": block.name,
                        "arguments": "",
                    }
                    # Yield tool_preparing immediately — name is known, args still streaming.
                    # tool_start is still delayed until content_block_stop (needs complete args).
                    yield {"type": "tool_preparing", "id": block.id, "name": block.name, "index": event.index}

            elif event_type == "content_block_delta":
                delta = event.delta
                if delta.type == "text_delta":
                    if delta.text:
                        yield {"type": "delta", "content": delta.text}
                elif delta.type == "input_json_delta":
                    if event.index in tool_blocks:
                        tool_blocks[event.index]["arguments"] += delta.partial_json

            elif event_type == "content_block_stop":
                # Tool block is now complete — parse accumulated JSON and yield tool_start
                if event.index in tool_blocks:
                    tb = tool_blocks[event.index]
                    try:
                        parsed_args = json.loads(tb["arguments"]) if tb["arguments"] else {}
                    except json.JSONDecodeError:
                        logger.warning(
                            "Failed to parse tool arguments for %s: %r",
                            tb["name"], tb["arguments"][:200],
                        )
                        parsed_args = {}
                    yield {
                        "type": "tool_start",
                        "id": tb["id"],
                        "name": tb["name"],
                        "args": parsed_args,
                    }

            elif event_type == "message_delta":
                # stop_reason is ONLY available here (not in content_block events)
                stop_reason = event.delta.stop_reason
                finish_reason = _STOP_REASON_MAP.get(stop_reason or "", "stop")

    yield {
        "type": "finish",
        "finish_reason": finish_reason,
        "tool_calls": list(tool_blocks.values()),
    }
