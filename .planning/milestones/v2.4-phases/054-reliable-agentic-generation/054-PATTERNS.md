# Phase 54: Reliable Agentic Generation - Pattern Map

**Mapped:** 2026-04-26
**Files analyzed:** 6 (2 new, 4 modified)
**Analogs found:** 6 / 6

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `backend/app/services/anthropic_service.py` | service | streaming / request-response | `backend/app/services/openai_service.py` | role-match (same streaming service tier, different SDK) |
| `backend/app/services/openai_service.py` | service | request-response | self (targeted edits to `_resolve_max_tokens` + `create_adaptive_streaming_chat`) | exact |
| `backend/app/api/threads.py` | controller / agent-loop | event-driven | self (targeted removals + dispatch branch) | exact |
| `frontend/src/pages/SettingsPage.tsx` | component | request-response | self (targeted conditional render + existing `activeProvider` state) | exact |
| `backend/tests/unit/test_anthropic_service.py` | test | — | `backend/tests/unit/test_openai_service.py` | role-match |
| `backend/requirements.txt` | config | — | self (append one line) | exact |

---

## Pattern Assignments

---

### `backend/app/services/anthropic_service.py` (service, streaming)

**Analog:** `backend/app/services/openai_service.py`

**Imports pattern** — copy structure from `openai_service.py` lines 1–11, substitute SDK:

```python
from __future__ import annotations

import json
from typing import TYPE_CHECKING, Generator

import anthropic

from app.config import settings

if TYPE_CHECKING:
    from app.models.user_settings import UserEffectiveSettings
```

Key notes:
- `from __future__ import annotations` is the project-wide convention (matches `openai_service.py` line 1).
- `TYPE_CHECKING` guard for `UserEffectiveSettings` matches the pattern at `openai_service.py` lines 10–11.
- No `from app.services.openai_service import ...` — this is a parallel, independent service module.

**Core streaming generator pattern** — modelled on `create_adaptive_streaming_chat` at `openai_service.py` lines 778–834, adapted for native Anthropic events:

```python
def stream_anthropic(
    messages: list[dict],
    tools: list[dict],
    system_prompt: str,
    model: str,
    api_key: str,
    max_tokens: int,
    force_no_tools: bool = False,
) -> Generator[dict, None, None]:
    """Yield normalized event dicts compatible with threads.py agent loop.

    stop_reason → canonical finish_reason mapping:
        end_turn   → "stop"
        tool_use   → "tool_calls"
        max_tokens → "length"
    """
    client = anthropic.Anthropic(api_key=api_key)

    anthropic_messages = _convert_messages_to_anthropic(messages)
    anthropic_tools = _convert_tools_to_anthropic(tools)

    # System prompt with prompt caching — cache_control on the text block (D-05)
    system = [{"type": "text", "text": system_prompt, "cache_control": {"type": "ephemeral"}}]

    tool_choice = {"type": "none"} if force_no_tools else {"type": "auto"}

    with client.messages.stream(
        model=model,
        max_tokens=max_tokens,
        system=system,
        tools=anthropic_tools,
        tool_choice=tool_choice,
        messages=anthropic_messages,
    ) as stream:
        tool_blocks: dict[int, dict] = {}   # index → {id, name, arguments}
        finish_reason: str = "stop"

        for event in stream:
            if event.type == "content_block_start":
                block = event.content_block
                if block.type == "tool_use":
                    tool_blocks[event.index] = {
                        "id": block.id,
                        "name": block.name,
                        "arguments": "",
                    }
                    # Do NOT yield tool_start yet — wait for full arguments at content_block_stop

            elif event.type == "content_block_delta":
                delta = event.delta
                if delta.type == "text_delta":
                    yield {"type": "delta", "content": delta.text}
                elif delta.type == "input_json_delta":
                    if event.index in tool_blocks:
                        tool_blocks[event.index]["arguments"] += delta.partial_json

            elif event.type == "content_block_stop":
                # Tool block complete — now yield tool_start with full arguments
                if event.index in tool_blocks:
                    tb = tool_blocks[event.index]
                    try:
                        parsed_args = json.loads(tb["arguments"]) if tb["arguments"] else {}
                    except json.JSONDecodeError:
                        parsed_args = {}
                    yield {
                        "type": "tool_start",
                        "id": tb["id"],
                        "name": tb["name"],
                        "args": parsed_args,
                    }

            elif event.type == "message_delta":
                stop_reason = event.delta.stop_reason
                finish_reason = {
                    "end_turn":   "stop",
                    "tool_use":   "tool_calls",
                    "max_tokens": "length",
                }.get(stop_reason or "", "stop")

        yield {
            "type": "finish",
            "finish_reason": finish_reason,
            "tool_calls": list(tool_blocks.values()),
        }
```

**ANTI-PATTERN (do NOT do this):** Do not yield `tool_start` at `content_block_start` time with empty `args`. The agent loop in `threads.py` executes tools from the `finish` event's `tool_calls` list; yielding partial-arg events causes no functional breakage, but the design established in RESEARCH.md (pitfall #1) requires buffering until `content_block_stop`.

**Message conversion pattern** — no analog in codebase; new logic, but must produce OpenAI-compatible inverse. Key rules (from RESEARCH.md Pattern 2):

```python
def _convert_messages_to_anthropic(messages: list[dict]) -> list[dict]:
    """Convert OpenAI-format messages array to Anthropic native format.

    Rules enforced:
    1. role="system" messages are stripped (caller passes system separately)
    2. role="tool" messages are grouped into a single role="user" content array
       with type="tool_result" blocks — multiple consecutive tool messages
       from one assistant turn MUST all land in ONE user message (Anthropic 400 otherwise)
    3. role="assistant" with tool_calls → content blocks with type="tool_use"
    """
    result = []
    i = 0
    while i < len(messages):
        msg = messages[i]
        role = msg.get("role")

        if role == "system":
            i += 1
            continue  # extracted to top-level system param

        if role == "user":
            result.append({"role": "user", "content": msg.get("content", "")})
            i += 1

        elif role == "assistant":
            tool_calls = msg.get("tool_calls")
            if tool_calls:
                content_blocks = []
                text_content = msg.get("content") or ""
                if text_content:
                    content_blocks.append({"type": "text", "text": text_content})
                for tc in tool_calls:
                    fn = tc.get("function", {})
                    content_blocks.append({
                        "type": "tool_use",
                        "id": tc["id"],
                        "name": fn["name"],
                        "input": json.loads(fn.get("arguments", "{}")),
                    })
                result.append({"role": "assistant", "content": content_blocks})

                # Consume ALL consecutive tool-role messages → single user message
                i += 1
                tool_result_blocks = []
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
```

**Tool conversion + prompt caching pattern** (from RESEARCH.md Pattern 3):

```python
def _convert_tools_to_anthropic(tools: list[dict]) -> list[dict]:
    """Convert OpenAI function-wrapper format to Anthropic flat format.
    Adds cache_control on the last tool to cache all tools (D-05)."""
    anthropic_tools = []
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
```

**Error handling pattern** — follow `openai_service.py` convention: no try/except inside the service function itself; let `APIError` bubble up to the `threads.py` outer try/except at line 714, which already handles `openai.APIError`. Since `anthropic.APIError` is a different class, the dispatch branch in `threads.py` should catch it separately or map it before the shared handler.

---

### `backend/app/services/openai_service.py` — MODIFY (service, request-response)

**Analog:** self — two targeted edits.

**Edit 1: Remove 20% token reduction** (`create_adaptive_streaming_chat`, lines 794–799)

Current code to DELETE (lines 794–799):

```python
    # When tools are enabled, reserve ~20% of output budget for tool call arguments.
    # Models (especially Anthropic) tend to generate verbose narration before tools,
    # exhausting the token budget and cutting off tool arguments mid-stream.
    effective_tokens = resolved_tokens
    if tool_choice == "auto" and resolved_tokens > 4096:
        effective_tokens = int(resolved_tokens * 0.8)
```

Replacement (single line, line 797 becomes):

```python
    effective_tokens = resolved_tokens  # GEN-01: no reduction — full budget always
```

The `token_param` and `kwargs` build at lines 801–806 remain unchanged. Only the `effective_tokens` assignment changes.

**Edit 2: Add provider bypass to `_resolve_max_tokens`** (lines 638–675)

Current priority order at lines 655–658 (user override checked first):

```python
    # Check user settings override first (from Settings UI)
    user_max_tokens = getattr(user_settings, "llm_max_output_tokens", 0) if user_settings else 0
    if user_max_tokens > 0:
        return user_max_tokens
```

New code — insert `NATIVE_PROVIDERS` constant at module level (after `_FALLBACK_MAX_TOKENS`, line 584), and rewrite the user-override block:

```python
# Module-level constant (add after _FALLBACK_MAX_TOKENS line 584):
NATIVE_PROVIDERS = frozenset({"openai", "anthropic", "google"})
```

```python
# Inside _resolve_max_tokens, replace lines 655–658:
    provider = (user_settings.active_provider if user_settings else "") or settings.llm_provider or ""

    # For native providers: bypass user override — prevents a stale OpenRouter value
    # (e.g. 4096) from silently capping Anthropic/OpenAI/Google calls. (GEN-02/GEN-05)
    if provider.lower() not in NATIVE_PROVIDERS:
        user_max_tokens = getattr(user_settings, "llm_max_output_tokens", 0) if user_settings else 0
        if user_max_tokens > 0:
            return user_max_tokens
```

The existing lines 660–675 (env var check, model registry lookup, provider fallback) remain unchanged. The `provider` local variable assignment that currently lives at line 674 moves up to immediately after the explicit-check at line 652.

Full rewritten `_resolve_max_tokens` for reference:

```python
def _resolve_max_tokens(
    explicit: int | None,
    user_settings: "UserEffectiveSettings | None",
) -> int:
    if explicit is not None:
        return explicit

    provider = (user_settings.active_provider if user_settings else "") or settings.llm_provider or ""

    # For native providers: skip user override to prevent stale slider values
    # from silently capping output. (GEN-02 defense-in-depth)
    if provider.lower() not in NATIVE_PROVIDERS:
        user_max_tokens = getattr(user_settings, "llm_max_output_tokens", 0) if user_settings else 0
        if user_max_tokens > 0:
            return user_max_tokens

    env_val = settings.llm_max_output_tokens
    env_default = 8192
    if env_val != env_default:
        return env_val

    model = (user_settings.llm_model if user_settings else "") or settings.llm_model or ""
    if model:
        env_overrides = _parse_model_output_limits(settings.model_output_limits)
        if model in env_overrides:
            return env_overrides[model]
        if model in _MODEL_OUTPUT_DEFAULTS:
            return _MODEL_OUTPUT_DEFAULTS[model]

    return _PROVIDER_DEFAULT_MAX_TOKENS.get(provider.lower(), _FALLBACK_MAX_TOKENS)
```

---

### `backend/app/api/threads.py` — MODIFY (controller, event-driven agent loop)

**Analog:** self — three targeted edits.

**Edit 1: Increase `max_iterations`** (lines 553–560)

```python
        # Current (lines 553–560):
        if body.agent_mode == "explorer":
            ...
            max_iterations = 6
        else:
            ...
            max_iterations = 8

        # Replace with (GEN-04):
        if body.agent_mode == "explorer":
            ...
            max_iterations = 8    # was 6
        else:
            ...
            max_iterations = 15   # was 8
```

**Edit 2: Remove `_CTX_LIMIT_*` constants and cap application** (lines 706–712 and lines 1447–1467)

Remove the constant definitions at lines 711–712:

```python
        # DELETE these two lines:
        _CTX_LIMIT_DEFAULT = 3000
        _CTX_LIMIT_SUBAGENT = 8000
```

Remove the cap-application block at lines 1447–1467:

```python
        # DELETE this entire block (lines 1447–1467):
        # --- Option B: cap tool result size added to the LLM messages array ---
        ctx_content = llm_tool_content if llm_tool_content is not None else tool_result
        ctx_limit = (
            _CTX_LIMIT_SUBAGENT if tool_name == "analyze_document"
            else _CTX_LIMIT_DEFAULT
        )
        if len(ctx_content) > ctx_limit:
            overflow = len(ctx_content) - ctx_limit
            if tool_name == "analyze_document":
                ctx_content = ctx_content[:ctx_limit] + "\n[Document fully analyzed. ...]"
            else:
                ctx_content = ctx_content[:ctx_limit] + f"\n[... truncated — {overflow} chars omitted]"

        messages.append({
            "role": "tool",
            "tool_call_id": tc["id"],
            "content": ctx_content,
        })
```

Replace with uncapped append:

```python
        # REPLACEMENT — full tool result, no cap (GEN-03):
        full_content = llm_tool_content if llm_tool_content is not None else tool_result
        messages.append({
            "role": "tool",
            "tool_call_id": tc["id"],
            "content": full_content,
        })
```

**Edit 3: Add Anthropic dispatch branch** — add import at line 23 area and dispatch logic inside the agent loop where `create_adaptive_streaming_chat` is currently called.

Import addition (after existing imports at line 23):

```python
from app.services.anthropic_service import stream_anthropic
```

Dispatch pattern — wrap the existing `create_adaptive_streaming_chat` call in a provider branch:

```python
        # Inside the for-iteration loop, where create_adaptive_streaming_chat is called:
        if getattr(user_settings, "active_provider", "") == "anthropic":
            event_generator = stream_anthropic(
                messages=messages,
                tools=active_tools if active_tools is not None else get_tools(user_settings),
                system_prompt=active_system_prompt,
                model=effective_model,
                api_key=user_settings.anthropic_api_key,
                max_tokens=_resolve_max_tokens(None, user_settings),
                force_no_tools=force_no_tools,
            )
            # Process normalized event dicts from the Anthropic adapter
            for event in event_generator:
                handle_anthropic_event(event)  # new branch; see pattern below
        else:
            stream, calling_mode = create_adaptive_streaming_chat(
                messages=messages,
                tool_choice=tool_choice,
                ...
            )
            # existing OpenAI/Google/OpenRouter stream processing unchanged
```

Note: `_resolve_max_tokens` is already imported from `openai_service.py` (line 23). No additional import needed for that function.

**Two distinct fallback messages** — where `finish_reason == "length"` is handled and where an empty model response is detected, use separate messages:

```python
        # Context overflow (finish_reason == "length"):
        "The model's context window was exceeded. Please start a new chat or reduce the document size."

        # Empty model response (no content, no tool calls):
        "The model returned an empty response. Please try again or switch to a different model."
```

---

### `frontend/src/pages/SettingsPage.tsx` — MODIFY (component, request-response)

**Analog:** self — conditional render using existing `activeProvider` state.

**Existing pattern to copy from** (lines 857–871) — read-only `FieldRow` with `font-mono` span:

```tsx
<FieldRow label="Title drafting">
  <span className="text-xs text-muted-foreground font-mono">
    {subAgentModel
      ? subAgentModel
      : `${resolvedSubAgentModel || "auto"} (auto)`}
  </span>
</FieldRow>
```

**New constant** — add near top of component function body, after `activeProvider` state is declared (line 485):

```tsx
const isNativeProvider = ["openai", "anthropic", "google"].includes(activeProvider)
```

**Slider → conditional render pattern** — apply to each of the three sliders at lines 788–817. Pattern for "Context depth (input)" slider (lines 788–797):

```tsx
{isNativeProvider ? (
  <FieldRow label="Context depth (input)">
    <span className="text-xs text-muted-foreground font-mono">
      Model default (managed automatically)
    </span>
  </FieldRow>
) : (
  <FieldRow label="Context depth (input)">
    <SliderInput
      value={contextWindowMaxTokens}
      onChange={setContextWindowMaxTokens}
      min={0}
      max={200000}
      step={1000}
      hint={contextWindowMaxTokens === 0 ? "Using model default" : `${contextWindowMaxTokens.toLocaleString()} tokens`}
    />
  </FieldRow>
)}
```

Apply the same conditional pattern to:
- "Main model output tokens" (`llmMaxOutputTokens` slider, lines 798–807)
- "Sub-agent output tokens" (`subAgentMaxOutputTokens` slider, lines 808–817)

**State preservation note:** The React state variables (`contextWindowMaxTokens`, `llmMaxOutputTokens`, `subAgentMaxOutputTokens`) are kept even when sliders are hidden. `handleSaveAIModel` at line 578 still sends them to the backend. Switching back to OpenRouter reveals sliders with preserved values — no state loss.

---

### `backend/tests/unit/test_anthropic_service.py` (test, new file)

**Analog:** `backend/tests/unit/test_openai_service.py`

**File header pattern** (copy from `test_openai_service.py` lines 1–6):

```python
"""Unit tests for app.services.anthropic_service.

No real Anthropic API calls — all tested via pure Python input/output of
the conversion functions and mocked stream events.
"""
from unittest.mock import patch, MagicMock, call
import json

import pytest
```

**Test class structure pattern** — use classes grouped by function, matching `test_openai_service.py` pattern (`TestGetLlmClient`, `TestGetEmbeddingClient`, etc.):

```python
class TestConvertMessagesToAnthropic:
    """GEN-02: message format conversion correctness."""

    def test_system_message_stripped(self): ...
    def test_plain_user_message_passes_through(self): ...
    def test_plain_assistant_message_passes_through(self): ...
    def test_assistant_tool_calls_converted_to_content_blocks(self): ...
    def test_single_tool_result_grouped_into_user_message(self): ...
    def test_multiple_tool_results_grouped_into_single_user_message(self): ...


class TestConvertToolsToAnthropic:
    """GEN-02: tool list conversion + cache_control placement."""

    def test_function_wrapper_converted_to_flat_format(self): ...
    def test_cache_control_on_last_tool_only(self): ...
    def test_empty_tool_list_returns_empty(self): ...
    def test_input_schema_key_used_not_parameters(self): ...


class TestStopReasonMapping:
    """GEN-02: stop_reason → canonical finish_reason."""

    def test_end_turn_maps_to_stop(self): ...
    def test_tool_use_maps_to_tool_calls(self): ...
    def test_max_tokens_maps_to_length(self): ...
    def test_unknown_stop_reason_maps_to_stop(self): ...


class TestResolveMaxTokensProviderBypass:
    """GEN-02/GEN-05: provider bypass in _resolve_max_tokens (in test_openai_service.py)."""

    def test_anthropic_provider_ignores_user_override(self): ...
    def test_openai_provider_ignores_user_override(self): ...
    def test_google_provider_ignores_user_override(self): ...
    def test_openrouter_provider_respects_user_override(self): ...
    def test_ollama_provider_respects_user_override(self): ...
```

Note: `TestResolveMaxTokensProviderBypass` belongs in `test_openai_service.py` (tests `_resolve_max_tokens` from `openai_service.py`), not in `test_anthropic_service.py`.

**Mock pattern for pure conversion functions** — no patching needed for `_convert_messages_to_anthropic` and `_convert_tools_to_anthropic` since they are pure functions. Call directly:

```python
def test_multiple_tool_results_grouped_into_single_user_message(self):
    from app.services.anthropic_service import _convert_messages_to_anthropic

    messages = [
        {"role": "assistant", "content": "", "tool_calls": [
            {"id": "tc_1", "function": {"name": "search_documents", "arguments": '{"query":"foo"}'}},
            {"id": "tc_2", "function": {"name": "query_tables", "arguments": '{"sql":"SELECT 1"}'}},
        ]},
        {"role": "tool", "tool_call_id": "tc_1", "content": "result 1"},
        {"role": "tool", "tool_call_id": "tc_2", "content": "result 2"},
    ]

    result = _convert_messages_to_anthropic(messages)

    # assistant turn + one grouped user message (not two separate user messages)
    assert len(result) == 2
    user_msg = result[1]
    assert user_msg["role"] == "user"
    assert len(user_msg["content"]) == 2
    assert all(b["type"] == "tool_result" for b in user_msg["content"])
    assert user_msg["content"][0]["tool_use_id"] == "tc_1"
    assert user_msg["content"][1]["tool_use_id"] == "tc_2"
```

**Mock pattern for `_resolve_max_tokens` bypass test** — copy `_make_user_settings` factory from `test_openai_service.py` lines 127–139, add `llm_max_output_tokens` field:

```python
def _make_user_settings(
    provider: str = "openrouter",
    llm_model: str = "openrouter/gpt-4o",
    llm_max_output_tokens: int = 4096,
):
    from types import SimpleNamespace
    return SimpleNamespace(
        active_provider=provider,
        llm_model=llm_model,
        llm_max_output_tokens=llm_max_output_tokens,
        openrouter_tool_strategy="quality",
        web_search_enabled=False,
        sandbox_enabled=False,
    )
```

---

### `backend/requirements.txt` — MODIFY (config)

**Analog:** self — append one dependency after the existing `openai` line.

Current `openai` line (line 4):

```
openai>=2.0.0
```

Add after it:

```
anthropic>=0.97.0
```

Full file after edit:

```
fastapi==0.115.6
uvicorn[standard]==0.32.1
supabase==2.10.0
openai>=2.0.0
anthropic>=0.97.0
tiktoken>=0.12.0
...
```

---

## Shared Patterns

### Provider Detection
**Source:** `backend/app/services/openai_service.py` line 808 and `backend/app/api/threads.py` line 720
**Apply to:** `anthropic_service.py` dispatch logic, `_resolve_max_tokens` bypass, `SettingsPage.tsx` slider visibility

```python
# Backend pattern (already used in both files):
provider = (user_settings.active_provider if user_settings else "") or settings.llm_provider or ""
# Then: provider.lower() in {"anthropic", "openai", "google"}

# Frontend pattern (activeProvider state already at SettingsPage.tsx line 485):
const isNativeProvider = ["openai", "anthropic", "google"].includes(activeProvider)
```

### FieldRow Read-Only Info Row
**Source:** `frontend/src/pages/SettingsPage.tsx` lines 857–870
**Apply to:** All three slider replacement info rows in SettingsPage.tsx

```tsx
<FieldRow label="...">
  <span className="text-xs text-muted-foreground font-mono">
    Model default (managed automatically)
  </span>
</FieldRow>
```

### Normalized Event Dict Schema
**Source:** `backend/app/api/threads.py` — established by reading the OpenAI chunk processing loop
**Apply to:** `anthropic_service.py` — every `yield` statement must match these field names exactly

| Event type | Required fields | threads.py usage |
|---|---|---|
| `delta` | `type`, `content` | `full_content += event["content"]` |
| `tool_start` | `type`, `id`, `name`, `args` | emitted to frontend SSE |
| `finish` | `type`, `finish_reason`, `tool_calls` | `if finish_reason == "length"`, tool execution loop |

### Test Mock Factory
**Source:** `backend/tests/unit/test_openai_service.py` lines 127–139
**Apply to:** `test_anthropic_service.py` and new test class in `test_openai_service.py`

```python
def _make_user_settings(provider="openrouter", llm_model="openrouter/gpt-4o", ...):
    from types import SimpleNamespace
    return SimpleNamespace(active_provider=provider, llm_model=llm_model, ...)
```

### Import Guard for TYPE_CHECKING
**Source:** `backend/app/services/openai_service.py` lines 10–11
**Apply to:** `anthropic_service.py`

```python
from typing import TYPE_CHECKING
if TYPE_CHECKING:
    from app.models.user_settings import UserEffectiveSettings
```

---

## No Analog Found

No files in this phase lack an analog. All new/modified files have direct or role-match analogs in the existing codebase.

---

## Metadata

**Analog search scope:** `backend/app/services/`, `backend/app/api/`, `backend/tests/unit/`, `frontend/src/pages/`
**Files scanned:** 6 source files read directly
**Pattern extraction date:** 2026-04-26
