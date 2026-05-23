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

# Phase 075.1 Plan 04 (B-260519-04) — LangSmith @traceable wrap for the
# Anthropic main-loop generator. langsmith.wrappers.wrap_anthropic is NOT
# available in the installed langsmith version (verified at plan-time),
# so we use the @traceable decorator path. @traceable handles generator
# functions per langsmith docs — captures inputs at call entry, run_type
# = "llm" surfaces the call in the LangSmith UI under the LLM trace bucket
# distinguishable from the OpenAI-path's wrap_openai-tagged traces.
try:
    from langsmith import traceable as _ls_traceable
except ImportError:  # pragma: no cover — langsmith always installed in prod
    def _ls_traceable(*_args, **_kwargs):  # type: ignore[no-redef]
        def _wrap(fn):
            return fn
        return _wrap

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


# Plan 075.4-03 Task 3 — re-verified producing LangSmith spans.
# Required env: LANGSMITH_API_KEY + LANGSMITH_TRACING=true (or
# LANGCHAIN_TRACING_V2=true legacy alias). LANGSMITH_PROJECT optional
# (defaults to 'default'). Verification gate at
# backend/tests/integration/test_075_4_anthropic_langsmith_trace.py
# asserts the decorator resolves to the real langsmith.traceable, not
# the no-op fallback stub at lines 38-42. Live trace fetch is a manual
# UAT row per the CLAUDE.md UAT scoreboard rule (Plan 05 Wave 0).
@_ls_traceable(name="ChatAnthropic", run_type="llm")
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
    # Phase 075 D-075-10 + Pitfall 3: per-tool_index 5KB-boundary counter.
    # Resets each time this generator is invoked (one invocation per LLM
    # call, mirroring the OpenAI-path per-iteration reset in threads.py).
    # NOTE: D-075-11's calling_mode filter doesn't apply here —
    # anthropic_service is only used for the NATIVE provider path;
    # STRUCTURED mode bypasses this generator entirely.
    _tool_args_emit_boundary: dict[int, int] = {}

    with client.messages.stream(**stream_kwargs) as stream:
        for event in stream:
            event_type = event.type

            if event_type == "message_start":
                # Phase 073 TOKEN-COL-01 (D-073-08): yield a normalized usage event
                # immediately on stream open. input_tokens is known here;
                # output_tokens typically starts at 0 and ramps up via the
                # later message_delta usage.output_tokens (Pitfall 9: that's
                # FINAL CUMULATIVE per Message, not a delta-since-last-event).
                m = event.message
                _usage = getattr(m, "usage", None)
                yield {
                    "type": "usage",
                    "input_tokens": getattr(_usage, "input_tokens", 0) or 0,
                    "output_tokens": getattr(_usage, "output_tokens", 0) or 0,
                }

            elif event_type == "content_block_start":
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
                        # Phase 075 D-075-09/10/11: yield tool_args_progress
                        # on every 5KB cumulative-byte boundary for non-
                        # execute_code tools. The calling_mode filter from
                        # D-075-11 does NOT apply here — anthropic_service is
                        # only invoked from the NATIVE provider path.
                        tb = tool_blocks[event.index]
                        _tool_name = tb["name"]
                        if _tool_name and _tool_name != "execute_code":
                            _bytes_total = len(tb["arguments"].encode("utf-8"))
                            _new_boundary = _bytes_total // 5120
                            _last_boundary = _tool_args_emit_boundary.get(event.index, 0)
                            if _new_boundary > _last_boundary:
                                _tool_args_emit_boundary[event.index] = _new_boundary
                                # D-075-09: args_so_far is the LAST 5KB of
                                # the cumulative accumulator (sliding-window
                                # tail). UTF-8-aware byte slice + decode
                                # errors="ignore" drops any invalid trailing
                                # codepoint bytes left by the byte boundary.
                                _tail_bytes = tb["arguments"].encode("utf-8")[-5120:]
                                _args_so_far = _tail_bytes.decode("utf-8", errors="ignore")
                                yield {
                                    "type": "tool_args_progress",
                                    "tool_index": event.index,
                                    "name": _tool_name,
                                    "args_so_far": _args_so_far,
                                    "total_args_bytes_so_far": _bytes_total,
                                }

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
                # Phase 073 TOKEN-COL-01 (D-073-08 + Pitfall 9): event.usage.output_tokens
                # is the FINAL CUMULATIVE output_tokens for THIS Message
                # (NOT a per-event delta — naive accumulation double-counts).
                # Yield once per message_delta when usage is surfaced. Consumer
                # (threads.py _on_chunk_anthropic in Plan 04) treats this as a
                # single SUM contribution from the just-completed Message.
                _usage = getattr(event, "usage", None)
                if _usage is not None:
                    yield {
                        "type": "usage_delta",
                        "output_tokens": getattr(_usage, "output_tokens", 0) or 0,
                    }

    yield {
        "type": "finish",
        "finish_reason": finish_reason,
        "tool_calls": list(tool_blocks.values()),
    }
