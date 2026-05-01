# Phase 54: Reliable Agentic Generation - Research

**Researched:** 2026-04-26
**Domain:** Anthropic Python SDK native integration, streaming event adaptation, token management, provider-conditional UI
**Confidence:** HIGH

## Summary

Phase 54 fixes the three root causes of agentic generation failures: (1) a 20% token reduction on every tool-choice=auto call that causes `finish_reason=length` mid-tool-stream, (2) tool-result character caps (8k/3k) that starve the model of context and trigger extra search loops, and (3) the Anthropic OpenAI-compat path that returns ambiguous `end_turn` for both text stops and tool calls. The fix is mechanical: remove the reduction, remove the caps, and route Anthropic calls through a native `anthropic` Python SDK adapter.

The native SDK research is complete and unambiguous. Anthropic streaming events have a well-defined structure: `message_start` → zero or more content blocks (each with `content_block_start` / `content_block_delta` / `content_block_stop`) → `message_delta` (carries `stop_reason`) → `message_stop`. Tool use produces a `content_block_start` with `type: "tool_use"`, followed by `input_json_delta` events carrying partial JSON strings for the tool arguments. `stop_reason` is always deterministic: `end_turn` (text done), `tool_use` (tool call pending), or `max_tokens` (truncated).

The message-format conversion from the existing OpenAI-style messages array to Anthropic native format is the most implementation-sensitive part. The current `threads.py` uses OpenAI message format throughout (`role: "tool"` messages with `tool_call_id`). The Anthropic native API requires `role: "user"` messages with `content: [{type: "tool_result", tool_use_id: "...", content: "..."}]`. A converter function in `anthropic_service.py` handles this before every call.

**Primary recommendation:** Implement `AnthropicProvider` as a streaming generator in `anthropic_service.py` that (1) converts the OpenAI-format messages array to Anthropic native format, (2) iterates over native SDK stream events and yields the same internal event dicts `threads.py` already processes, and (3) adds `cache_control: {"type": "ephemeral"}` to the system prompt block and the last tool in the tools list.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01**: Google uses existing OpenAI compat path. Phase 53 already fixed `parallel_tool_calls` skip and `finish_reason` normalization. A verified end-to-end generation test (gemini-2.5-flash, "generate PPT from document") confirms the compat path works. Native `google-generativeai` SDK is deferred.
- **D-02**: Native Anthropic provider in new `backend/app/services/anthropic_service.py`. Not added to `openai_service.py`.
- **D-03**: `anthropic_service.py` yields normalized event dicts matching the existing `threads.py` format. Agent loop is unchanged.
- **D-04**: `_CTX_LIMIT_SUBAGENT` and `_CTX_LIMIT_DEFAULT` caps are removed entirely. No replacement cap. `trim_messages_to_fit()` handles context budget.
- **D-05**: Anthropic prompt caching on system prompt block and tools list only. Message history caching is out of scope.

### Claude's Discretion

- Exact internal event dict schema for the adapter — match whatever `threads.py` currently processes
- How `_resolve_max_tokens` detects active provider — read from `user_settings.active_provider`
- Read-only info row copy/formatting in Settings UI — follow existing label row patterns in SettingsPage.tsx

### Deferred Ideas (OUT OF SCOPE)

- Native `google-generativeai` SDK
- Multi-turn prompt caching (message history)
- Sub-agent architecture redesign
- LiteLLM migration
- Extended thinking / Claude computer use
- Frontend streaming UI changes
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| GEN-01 | Remove 20% token reduction from `create_adaptive_streaming_chat` | Lines 797-799 of openai_service.py identified; removal is a 3-line deletion |
| GEN-02 | Native Anthropic SDK integration in `anthropic_service.py` | Streaming event format fully documented; message-format conversion patterns established |
| GEN-03 | Remove `_CTX_LIMIT_SUBAGENT` / `_CTX_LIMIT_DEFAULT` character caps | Lines 711-712 (definition) and 1447-1466 (application) in threads.py identified |
| GEN-04 | Increase `max_iterations` general→15, explorer→8 | Lines 556, 560 in threads.py identified |
| GEN-05 | Provider-aware Settings UI — hide sliders for OpenAI/Anthropic/Google | Slider locations at lines 788-817; `activeProvider` state already exists for conditional logic |
</phase_requirements>

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Anthropic streaming event parsing | API/Backend (`anthropic_service.py`) | — | SDK event loop runs server-side; frontend never sees raw SDK events |
| Message format conversion (OpenAI→Anthropic) | API/Backend (`anthropic_service.py`) | — | Conversion must happen before API call; not a UI concern |
| Prompt caching headers | API/Backend (`anthropic_service.py`) | — | `cache_control` is an API-level parameter |
| Token reduction removal | API/Backend (`openai_service.py`) | — | Server-side call construction |
| Tool-result cap removal | API/Backend (`threads.py`) | — | Server-side message assembly |
| Iteration limit increase | API/Backend (`threads.py`) | — | Agent loop control |
| Provider-conditional slider visibility | Frontend (`SettingsPage.tsx`) | Backend (`_resolve_max_tokens`) | UI hides sliders; backend enforces bypass even if stale override exists |
| Override bypass for native providers | API/Backend (`openai_service.py` `_resolve_max_tokens`) | — | Defense-in-depth: backend must not trust UI state |

## Standard Stack

### Core — Already in Use

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `anthropic` | 0.97.0 [VERIFIED: pypi.org/project/anthropic] | Anthropic native SDK | Official first-party SDK; prompt caching, deterministic stop_reason |
| `openai` | >=2.0.0 | OpenAI + Google + OpenRouter compat | Already in requirements.txt |
| `fastapi` | 0.115.6 | SSE streaming endpoint | Already in requirements.txt |
| `react` + `typescript` | (existing) | Settings UI | Already in use |

**Installation — backend only:**
```bash
# Add to backend/requirements.txt
anthropic>=0.97.0
```

**Version verification:** [VERIFIED: pypi.org] — `anthropic` latest is 0.97.0 as of 2026-04-26. Use `>=0.97.0` in requirements to allow patch updates.

### Anthropic SDK Key Facts

- `anthropic.Anthropic(api_key=...)` — sync client [CITED: platform.claude.com/docs/en/api/messages-streaming]
- `client.messages.stream(...)` — context-manager-based streaming
- `client.messages.create(..., stream=True)` — raw streaming (also works)
- The Python SDK `stream()` interface wraps raw SSE events and provides helpers, but raw `create(stream=True)` gives direct access to events via iteration — use this for the adapter pattern since we need raw event types

## Architecture Patterns

### System Architecture Diagram

```
threads.py (agent loop)
        │
        │  active_provider == "anthropic"?
        ├─────────────────────────────────────► anthropic_service.py
        │                                              │
        │  active_provider == "openai" /               │  anthropic.Anthropic().messages.create(stream=True)
        │  "google" / "openrouter" / "ollama"          │
        ▼                                              │  for raw_event in stream:
   openai_service.py                                   │    translate → normalized event dict
   create_adaptive_streaming_chat()                    │    yield {"type": "delta", ...}
        │                                              │    yield {"type": "tool_start", ...}
        │                                              │    yield {"type": "tool_end", ...}
        ▼                                              │    yield {"type": "finish", ...}
   OpenAI SDK stream                                   │
        │                                              │
        └──────────────────────────────────────────────┘
                           │
                           ▼
                  threads.py handles event dicts
                  (loop body unchanged)
```

### Recommended Project Structure — New File

```
backend/app/services/
├── openai_service.py        # existing — remove 20% reduction, add provider bypass to _resolve_max_tokens
├── anthropic_service.py     # NEW — AnthropicProvider: message conversion + streaming adapter + caching
├── context_window.py        # existing — no changes needed
backend/app/api/
└── threads.py               # existing — remove caps, increase iterations, add dispatch by provider
```

### Pattern 1: Anthropic Streaming Event → Normalized Event Dict

The native Anthropic SDK (when using `create(stream=True)`) yields SSE event objects with a `.type` attribute and structured payload. The complete streaming sequence for a tool-use turn is:

```
message_start           → {type: "message_start", message: {usage: {input_tokens: N}}}
content_block_start [0] → {type: "content_block_start", index: 0, content_block: {type: "text", text: ""}}
content_block_delta [0] → {type: "content_block_delta", index: 0, delta: {type: "text_delta", text: "Okay, let's check"}}
content_block_stop  [0] → {type: "content_block_stop", index: 0}
content_block_start [1] → {type: "content_block_start", index: 1, content_block: {type: "tool_use", id: "toolu_01...", name: "get_weather", input: {}}}
content_block_delta [1] → {type: "content_block_delta", index: 1, delta: {type: "input_json_delta", partial_json: "{\"location\":"}}
content_block_delta [1] → {type: "content_block_delta", index: 1, delta: {type: "input_json_delta", partial_json: " \"SF, CA\"}"}}
content_block_stop  [1] → {type: "content_block_stop", index: 1}
message_delta           → {type: "message_delta", delta: {stop_reason: "tool_use"}, usage: {output_tokens: M}}
message_stop            → {type: "message_stop"}
```

[CITED: platform.claude.com/docs/en/api/messages-streaming — see SSE response section]

**Adapter translation logic:**

```python
# Source: Anthropic streaming docs + codebase pattern from threads.py

def stream_anthropic(messages, tools, system_prompt, model, api_key, max_tokens):
    client = anthropic.Anthropic(api_key=api_key)
    
    # Convert OpenAI-format messages to Anthropic native format
    anthropic_messages = _convert_messages_to_anthropic(messages)
    
    # Build tool list in Anthropic format with cache_control on last tool
    anthropic_tools = _convert_tools_to_anthropic(tools)
    
    # System prompt as content block array with cache_control
    system = [{"type": "text", "text": system_prompt, "cache_control": {"type": "ephemeral"}}]
    
    with client.messages.stream(
        model=model,
        max_tokens=max_tokens,
        system=system,
        tools=anthropic_tools,
        tool_choice={"type": "auto"},
        messages=anthropic_messages,
    ) as stream:
        tool_blocks: dict[int, dict] = {}  # index → {id, name, arguments}
        finish_reason = None
        
        for event in stream:
            if event.type == "content_block_start":
                block = event.content_block
                if block.type == "tool_use":
                    tool_blocks[event.index] = {"id": block.id, "name": block.name, "arguments": ""}
                    yield {"type": "tool_start", "name": block.name, "id": block.id, "args": {}}
            
            elif event.type == "content_block_delta":
                delta = event.delta
                if delta.type == "text_delta":
                    yield {"type": "delta", "content": delta.text}
                elif delta.type == "input_json_delta":
                    if event.index in tool_blocks:
                        tool_blocks[event.index]["arguments"] += delta.partial_json
            
            elif event.type == "message_delta":
                stop_reason = event.delta.stop_reason
                # Map native stop_reason to canonical values
                finish_reason = {
                    "end_turn":   "stop",
                    "tool_use":   "tool_calls",
                    "max_tokens": "length",
                }.get(stop_reason, "stop")
        
        yield {"type": "finish", "finish_reason": finish_reason, "tool_calls": list(tool_blocks.values())}
```

### Pattern 2: Message Format Conversion — OpenAI → Anthropic Native

The most critical conversion. `threads.py` maintains messages in OpenAI format throughout the agent loop. `anthropic_service.py` must convert before each call.

**Key differences:**

| Aspect | OpenAI format (current in threads.py) | Anthropic native format (needed) |
|--------|--------------------------------------|----------------------------------|
| Tool result role | `role: "tool"` | `role: "user"` |
| Tool result key | `tool_call_id` | `tool_use_id` |
| Tool result wrapper | plain string in `content` | `[{"type": "tool_result", "tool_use_id": "...", "content": "..."}]` |
| Assistant tool call | `role: "assistant", tool_calls: [{id, type, function: {name, arguments}}]` | `role: "assistant", content: [{"type": "tool_use", "id": ..., "name": ..., "input": {...}}]` |
| Multiple tools in one turn | consecutive `role: "tool"` messages | single `role: "user"` message with multiple `tool_result` blocks |
| System prompt | First message with `role: "system"` | Top-level `system` parameter (NOT in messages array) |

[CITED: platform.claude.com/docs/en/agents-and-tools/tool-use/handle-tool-calls]

```python
def _convert_messages_to_anthropic(messages: list[dict]) -> list[dict]:
    """Convert OpenAI-format messages to Anthropic native format.
    
    Rules:
    - system messages: extracted separately, NOT in returned list
    - tool messages (role="tool"): grouped with preceding assistant message
      into a user message with tool_result blocks
    - assistant messages with tool_calls: converted to content blocks
    """
    result = []
    i = 0
    while i < len(messages):
        msg = messages[i]
        role = msg.get("role")
        
        if role == "system":
            i += 1
            continue  # extracted separately
        
        if role == "user":
            content = msg.get("content", "")
            result.append({"role": "user", "content": content})
            i += 1
        
        elif role == "assistant":
            tool_calls = msg.get("tool_calls")
            if tool_calls:
                # Convert to Anthropic tool_use content blocks
                content_blocks = []
                text_content = msg.get("content", "")
                if text_content:
                    content_blocks.append({"type": "text", "text": text_content})
                for tc in tool_calls:
                    fn = tc.get("function", {})
                    import json as _json
                    content_blocks.append({
                        "type": "tool_use",
                        "id": tc["id"],
                        "name": fn["name"],
                        "input": _json.loads(fn.get("arguments", "{}")),
                    })
                result.append({"role": "assistant", "content": content_blocks})
                
                # Consume immediately following tool-role messages and bundle into single user message
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
                # Plain assistant text
                result.append({"role": "assistant", "content": msg.get("content", "")})
                i += 1
        
        else:
            i += 1
    
    return result
```

**CRITICAL NOTE:** The Anthropic API requires that `tool_result` blocks in the user message come BEFORE any text in the same content array. When multiple `role: "tool"` messages follow a single `role: "assistant"` with `tool_calls`, they must ALL be bundled into one `role: "user"` message (not separate messages). [CITED: platform.claude.com/docs/en/agents-and-tools/tool-use/handle-tool-calls]

### Pattern 3: Tool List Conversion — OpenAI → Anthropic Native

OpenAI tools use `type: "function"` wrappers; Anthropic uses a flat structure with `input_schema` instead of `parameters`.

```python
def _convert_tools_to_anthropic(tools: list[dict]) -> list[dict]:
    """Convert OpenAI-format tool list to Anthropic native format.
    Last tool gets cache_control for prompt caching."""
    anthropic_tools = []
    for tool in tools:
        fn = tool.get("function", {})
        anthropic_tools.append({
            "name": fn["name"],
            "description": fn.get("description", ""),
            "input_schema": fn.get("parameters", {"type": "object", "properties": {}}),
        })
    # Add cache_control to last tool — caches all tools up to and including it
    if anthropic_tools:
        anthropic_tools[-1]["cache_control"] = {"type": "ephemeral"}
    return anthropic_tools
```

[CITED: platform.claude.com/docs/en/build-with-claude/prompt-caching — "Place cache_control on the last tool to cache all tools up to and including that tool"]

### Pattern 4: Provider Bypass in `_resolve_max_tokens`

The current `_resolve_max_tokens` checks `user_settings.llm_max_output_tokens` first. A stale value (e.g., `4096` from a previous OpenRouter session) silently caps Anthropic output. The fix: check `active_provider` first and bypass user overrides for native providers.

```python
# Modified _resolve_max_tokens (openai_service.py)
NATIVE_PROVIDERS = frozenset({"openai", "anthropic", "google"})

def _resolve_max_tokens(
    explicit: int | None,
    user_settings: "UserEffectiveSettings | None",
) -> int:
    if explicit is not None:
        return explicit

    provider = (user_settings.active_provider if user_settings else "") or settings.llm_provider or ""
    
    # For native providers: skip user override, go straight to model registry
    # Prevents stale overrides from silently capping e.g. Anthropic at 4096 tokens
    if provider.lower() not in NATIVE_PROVIDERS:
        user_max_tokens = getattr(user_settings, "llm_max_output_tokens", 0) if user_settings else 0
        if user_max_tokens > 0:
            return user_max_tokens

    # Env var override (non-default)
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

### Pattern 5: Settings UI — Provider-Conditional Sliders

`activeProvider` state is already present in SettingsPage.tsx (line 508). Use it to conditionally render sliders vs. read-only info rows. The `FieldRow` + label row pattern already exists for title drafting and follow-up suggestions (lines 857-871).

```tsx
// In SettingsPage.tsx — Context & Sub-Agent SectionCard
const isNativeProvider = ["openai", "anthropic", "google"].includes(activeProvider)

// Replace each slider with conditional:
{isNativeProvider ? (
  <FieldRow label="Context depth (input)">
    <span className="text-xs text-muted-foreground font-mono">
      Model default (managed automatically)
    </span>
  </FieldRow>
) : (
  <FieldRow label="Context depth (input)">
    <SliderInput ... />
  </FieldRow>
)}
```

The same pattern applies for "Main model output tokens" and "Sub-agent output tokens" sliders.

**Round-trip preservation:** When switching from OpenRouter to Anthropic, `handleSaveAIModel` still sends `llm_max_output_tokens: llmMaxOutputTokens` to the backend — the state is preserved in React even when hidden. Switching back to OpenRouter reveals the slider with its previous value. No state loss.

### Pattern 6: Prompt Caching

```python
# System prompt — cache_control on the text block
system = [{
    "type": "text",
    "text": system_prompt_text,
    "cache_control": {"type": "ephemeral"}
}]

# Tools — cache_control on the LAST tool only (caches all preceding tools too)
if anthropic_tools:
    anthropic_tools[-1]["cache_control"] = {"type": "ephemeral"}
```

Cache hit appears in `usage.cache_read_input_tokens > 0` on second+ calls in the same session. Minimum cached prefix: 2,048 tokens for claude-sonnet-4-6; 4,096 for claude-opus-4-6 and claude-haiku. System prompt (~3k tokens) + tools (~15 tools × ~200 tokens avg ≈ 3k) = ~6k tokens — comfortably above both thresholds. [CITED: platform.claude.com/docs/en/build-with-claude/prompt-caching]

### Pattern 7: threads.py Dispatch

The agent loop calls `create_adaptive_streaming_chat()` from `openai_service.py`. After the change, the dispatch branches by `active_provider`:

```python
# threads.py — agent loop (conceptual, not exact code)
if user_settings.active_provider == "anthropic":
    from app.services.anthropic_service import stream_anthropic
    event_generator = stream_anthropic(
        messages=messages,
        tools=active_tools or get_tools(user_settings),
        system_prompt=active_system_prompt,
        model=effective_model,
        api_key=user_settings.anthropic_api_key,  # already stored in settings
        max_tokens=_resolve_max_tokens(None, user_settings),
    )
    # Iterate event dicts from the generator
    for event in event_generator:
        ...
else:
    stream, calling_mode = create_adaptive_streaming_chat(...)
    for chunk in stream:
        ...
```

The internal event dict schema yielded by `anthropic_service.py` must match the fields `threads.py` already reads from the OpenAI path. From reading threads.py:

| Event type | Fields used by threads.py | Where used |
|------------|--------------------------|------------|
| `delta` | `content` | line ~801: `full_content += delta.content` |
| `tool_start` | `name`, `args` | line ~919: `yield f"data: {json.dumps({'type': 'tool_start', ...}}"` |
| `finish` | `finish_reason`, `tool_calls` | line ~862: `if finish_reason == "length"` |

The existing loop processes these from the OpenAI SDK's `chunk.choices[0]` objects. The Anthropic adapter **must pre-process** these and yield structured dicts — `threads.py`'s inner loop will need a parallel branch for Anthropic that iterates the adapter generator instead of the OpenAI chunk loop.

### Anti-Patterns to Avoid

- **Yielding partial tool arguments:** Do NOT yield `tool_start` events with partial arguments mid-stream. Buffer the entire `input_json_delta` string, parse the complete JSON at `content_block_stop`, then yield the full tool call. The existing `threads.py` tool execution expects complete JSON in `tc["arguments"]`.
- **Separate user messages for each tool_result:** The Anthropic API requires all tool results from one round to be in a SINGLE `role: "user"` message as a content array. Separate messages cause a 400 error.
- **system message in the messages array:** Anthropic does not accept `role: "system"` in the `messages` parameter — it goes in the top-level `system` parameter.
- **Sending tool_choice="none" as `{"type": "auto"}`:** When `force_no_tools` is True (last iteration), pass `tool_choice={"type": "none"}` to Anthropic, not `"none"` as a string.
- **Async/sync mismatch:** `threads.py` is an async generator (`async def event_stream`). `anthropic.Anthropic()` is sync. Use `anthropic.Anthropic()` (not `AsyncAnthropic`) and iterate synchronously inside the async generator — this works in FastAPI's async context since the stream is CPU/IO-bound at the subprocess level, and FastAPI runs sync code in a thread pool when needed. Alternatively, use `AsyncAnthropic` and `async for`. The simpler path is `Anthropic()` sync client since the existing OpenAI stream iteration is also sync.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Anthropic streaming | Custom SSE parser over HTTP | `anthropic.Anthropic().messages.stream()` or `.create(stream=True)` | SDK handles reconnect, partial events, error types |
| JSON accumulation for tool args | Custom partial-JSON parser | Accumulate `input_json_delta` strings, then `json.loads()` at `content_block_stop` | Tool input is always a complete JSON object once the block closes |
| Message format validation | Schema validator | Convert carefully + test | Anthropic returns 400 with clear error messages when format is wrong |
| Provider detection | New field in settings | `user_settings.active_provider` (already exists everywhere) | Already established pattern in both `openai_service.py` and `threads.py` |
| Prompt caching token tracking | Manual cache metrics | Use `stream.get_final_message().usage` after stream | SDK accumulates usage across events; `cache_read_input_tokens` available on final message |

**Key insight:** The Anthropic SDK is well-tested and the message format conversion is the only custom code needed. The streaming event handling is straightforward once the event taxonomy is understood.

## Common Pitfalls

### Pitfall 1: Multiple tool results → multiple user messages (400 error)
**What goes wrong:** When `threads.py` appends tool results as separate `role: "tool"` messages, and the converter creates one `role: "user"` message per tool result, the Anthropic API returns 400: "tool_use ids were found without tool_result blocks immediately after."
**Why it happens:** OpenAI allows consecutive `role: "tool"` messages; Anthropic requires ALL tool results for a given assistant turn to be in a single `role: "user"` message as a content block array.
**How to avoid:** The converter must scan ahead past all consecutive `role: "tool"` messages after an assistant+tool_calls message and group them into one user message.
**Warning signs:** 400 error in logs with "tool_use ids" message.

### Pitfall 2: system message in messages array (400 error)
**What goes wrong:** `threads.py` prepends a system message to the messages list: `messages[0] = {"role": "system", "content": "..."}`. If passed directly to the Anthropic API in the `messages` parameter, it returns 400.
**Why it happens:** Anthropic does not accept `role: "system"` in messages — it goes in the top-level `system` parameter.
**How to avoid:** The converter strips system messages from the messages list. The caller (`stream_anthropic`) passes system separately.
**Warning signs:** 400 error, "system role not allowed in messages."

### Pitfall 3: Stale `llm_max_output_tokens` override silently caps output
**What goes wrong:** A user who previously set `llm_max_output_tokens: 4096` on OpenRouter switches to Anthropic. The stored override caps every Anthropic call at 4096 tokens. `execute_code` output truncates mid-stream.
**Why it happens:** `_resolve_max_tokens` currently checks user override FIRST before model registry.
**How to avoid:** The provider bypass in `_resolve_max_tokens` (Pattern 4) must be implemented alongside the UI slider hiding — the backend fix is the defense-in-depth.
**Warning signs:** `finish_reason=length` on Anthropic calls for models known to support 32k+ output.

### Pitfall 4: `tool_choice` format difference
**What goes wrong:** Passing `tool_choice="auto"` (a string) to Anthropic returns 400. Anthropic requires `tool_choice={"type": "auto"}`.
**Why it happens:** OpenAI accepts string shorthand; Anthropic requires the object format.
**How to avoid:** Always construct `tool_choice` as a dict in `anthropic_service.py`. Map: `"auto"` → `{"type": "auto"}`, `"none"` → `{"type": "none"}`.
**Warning signs:** 400 error on first Anthropic call.

### Pitfall 5: Prompt caching minimum token threshold not met
**What goes wrong:** `cache_read_input_tokens` stays 0 across all Anthropic calls — no cache savings.
**Why it happens:** The minimum token threshold for caching is 2,048 tokens for sonnet, 4,096 for opus/haiku. If the system prompt is short, caching silently does nothing (no error returned).
**How to avoid:** The system prompt in this app is 3k+ tokens and tool list adds another ~3k — well above both thresholds. No action needed, but verify in LangSmith that `cache_creation_input_tokens > 0` on the first call.
**Warning signs:** No `cache_read_input_tokens` in LangSmith usage after 2+ turns.

### Pitfall 6: `finish_reason` before all content blocks close
**What goes wrong:** Reading `stop_reason` from `content_block_delta` events (wrong) instead of `message_delta`.
**Why it happens:** `stop_reason` is only set in the `message_delta` event, not in content block events. `message_start` has `stop_reason: null`.
**How to avoid:** Only read `stop_reason` from `message_delta` events. The adapter sets `finish_reason` only when it encounters `event.type == "message_delta"`.

### Pitfall 7: Cap removal causes context overflow in edge cases
**What goes wrong:** After removing the 8k/3k caps, a very large `analyze_document` result on a small OpenRouter model causes a context-exceeded error.
**Why it happens:** `trim_messages_to_fit` drops OLDER messages but cannot reduce a single oversized tool result. A 200-page document analysis might be 80k+ chars (~20k tokens) — larger than some OpenRouter model context windows.
**How to avoid:** This is explicitly accepted in D-04 for the three target providers (200k, 128k, 1M). OpenRouter small models remain best-effort. The APIError handler in `threads.py` already catches context-exceeded errors and produces a user-facing message.

## Code Examples

### Anthropic streaming event structure — full tool-use turn

```sse
event: message_start
data: {"type":"message_start","message":{"id":"msg_014p7g...","usage":{"input_tokens":472,"output_tokens":2},"stop_reason":null}}

event: content_block_start
data: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}

event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Okay, let's check"}}

event: content_block_stop
data: {"type":"content_block_stop","index":0}

event: content_block_start
data: {"type":"content_block_start","index":1,"content_block":{"type":"tool_use","id":"toolu_01T1x1fJ","name":"get_weather","input":{}}}

event: content_block_delta
data: {"type":"content_block_delta","index":1,"delta":{"type":"input_json_delta","partial_json":"{\"location\":"}}

event: content_block_delta
data: {"type":"content_block_delta","index":1,"delta":{"type":"input_json_delta","partial_json":" \"San Francisco, CA\"}"}}

event: content_block_stop
data: {"type":"content_block_stop","index":1}

event: message_delta
data: {"type":"message_delta","delta":{"stop_reason":"tool_use"},"usage":{"output_tokens":89}}

event: message_stop
data: {"type":"message_stop"}
```
[CITED: platform.claude.com/docs/en/api/messages-streaming]

### Anthropic tool_result message format

```json
{
  "role": "user",
  "content": [
    {
      "type": "tool_result",
      "tool_use_id": "toolu_01T1x1fJ",
      "content": "The weather in San Francisco is 15°C and cloudy."
    }
  ]
}
```

Multiple tool results (single round) — MUST be in ONE user message:
```json
{
  "role": "user",
  "content": [
    {"type": "tool_result", "tool_use_id": "toolu_01...", "content": "result 1"},
    {"type": "tool_result", "tool_use_id": "toolu_02...", "content": "result 2"}
  ]
}
```
[CITED: platform.claude.com/docs/en/agents-and-tools/tool-use/handle-tool-calls]

### Prompt caching — system + tools

```python
# System prompt with cache_control
system = [{
    "type": "text",
    "text": system_prompt_text,
    "cache_control": {"type": "ephemeral"}
}]

# Tools with cache_control on last item
tools = [
    {"name": "search_documents", "description": "...", "input_schema": {...}},
    # ... more tools ...
    {"name": "execute_code", "description": "...", "input_schema": {...},
     "cache_control": {"type": "ephemeral"}}  # last tool gets cache_control
]
```
[CITED: platform.claude.com/docs/en/build-with-claude/prompt-caching]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `anthropic` SDK 0.2x (early beta) | 0.97.0 (stable, typed) | 2024–2026 | Full type hints, streaming context manager, `messages.stream()` helper |
| `end_turn` ambiguity in compat layer | Native `stop_reason: "tool_use"` | Phase 54 | Eliminates need for buffer heuristic in finish_reason detection |
| Per-call token reduction | No reduction; model uses full budget | Phase 54 | Fixes `finish_reason=length` during execute_code |
| Character caps on tool results | Sliding-window trimming only | Phase 54 | Model gets full document analysis context |

**Deprecated/outdated:**
- `OpenAI(base_url="https://api.anthropic.com/v1")`: Compat layer approach — still works but misses native features (deterministic stop_reason, prompt caching, extended thinking). Being replaced for Anthropic by native SDK in this phase.
- `_CTX_LIMIT_SUBAGENT` / `_CTX_LIMIT_DEFAULT` character caps: Being removed. Replaced entirely by `trim_messages_to_fit()`.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `threads.py` async generator can iterate a sync `anthropic.Anthropic()` stream without blocking the event loop | Architecture Patterns, Pattern 7 | Could cause request timeouts on long streams; mitigation: use `AsyncAnthropic` instead | 
| A2 | System prompt (~3k chars) + tools list (~15 tools) totals >2048 tokens — above caching minimum for sonnet | Pitfall 5 | Caching doesn't fire; no functional breakage, just no cache savings. Low risk. |
| A3 | `resolve_context_budget()` does NOT need provider bypass for this phase (only `_resolve_max_tokens` needs it) | Pattern 4 | If context budget is over-capped for Anthropic by a stale env var, could under-trim. Low risk since `context_window_max_tokens` is separate from `llm_max_output_tokens`. |

## Open Questions

1. **Async vs. sync Anthropic client**
   - What we know: `threads.py` is `async def event_stream`. The existing OpenAI stream iteration is synchronous inside the async function (works fine with FastAPI's threadpool).
   - What's unclear: Whether `anthropic.Anthropic()` (sync) streaming inside an async FastAPI handler could cause event-loop blocking on very long streams.
   - Recommendation: Start with sync `anthropic.Anthropic()` for simplicity, matching the existing OpenAI pattern. If latency issues appear, switch to `AsyncAnthropic` with `async for`.

2. **`resolve_context_budget` bypass for native providers**
   - What we know: SPEC Req-11 only explicitly calls out `_resolve_max_tokens`. CONTEXT.md D-04 says "trust trim_messages_to_fit".
   - What's unclear: Whether `resolve_context_budget` also needs a provider bypass (it reads `settings.context_window_max_tokens` which could be stale).
   - Recommendation: Leave `resolve_context_budget` unchanged for this phase — the `context_window_max_tokens` setting is separate and not typically overridden in the same way. Add a comment explaining this is intentional.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `anthropic` Python SDK | GEN-02: AnthropicProvider | Not installed [VERIFIED: pip show] | — | Install in requirements.txt |
| Python venv | All backend tests | Available | Python 3.12 | — |
| `pytest` (venv) | Test suite | Available (venv) | latest | — |
| Anthropic API key | E2E acceptance test | Not verified (env-level) | — | Manual test requires key in `.env` |

**Missing with no fallback:** `anthropic` package not installed. Must be added to `backend/requirements.txt` before implementation.

**Missing with fallback:** Anthropic API key — unit tests can be fully mocked; acceptance test requires real key.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest 8.x + pytest-asyncio |
| Config file | `backend/pytest.ini` or pyproject-level (venv) |
| Quick run command | `cd backend && source venv/Scripts/activate && python -m pytest tests/unit/test_openai_service.py -x -q` |
| Full suite command | `cd backend && source venv/Scripts/activate && python -m pytest tests/ -x -q` |

**Current test count:** 496 tests collected [VERIFIED: venv pytest --collect-only 2026-04-26]

Note: SPEC references "327 existing unit tests" — the actual count is 496 as of 2026-04-26. The constraint means all 496 must continue to pass.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| GEN-01 | `_resolve_max_tokens` returns full value when `tool_choice=auto` (no 20% reduction) | unit | `pytest tests/unit/test_openai_service.py -x -q` | Existing file — new test cases |
| GEN-02 | `_resolve_max_tokens(explicit=None, user_settings=<anthropic, override=4096>)` returns 32768 for claude-sonnet-4-6 | unit | `pytest tests/unit/test_openai_service.py::TestResolveMaxTokensProviderBypass -x` | New test class |
| GEN-02 | `_convert_messages_to_anthropic` correctly handles system, tool, assistant+tool_calls message types | unit | `pytest tests/unit/test_anthropic_service.py -x -q` | New file — Wave 0 gap |
| GEN-02 | `_convert_tools_to_anthropic` produces `input_schema`, `cache_control` on last tool | unit | `pytest tests/unit/test_anthropic_service.py -x -q` | New file — Wave 0 gap |
| GEN-03 | After cap removal, `threads.py` does NOT truncate tool result content | unit/integration | Manual E2E test (automated would require mocked Anthropic stream) | Manual |
| GEN-04 | `max_iterations=15` for general, `=8` for explorer; `force_no_tools` fires on iteration 14 | unit | `pytest tests/unit/test_explorer_agent.py -x -q` | Existing — verify/update |
| GEN-05 | Settings UI shows no sliders when `activeProvider` is "openai"/"anthropic"/"google" | manual | Manual browser test per SPEC acceptance criteria | Manual |
| GEN-05 | OpenRouter slider round-trip: switch OpenRouter→Anthropic→OpenRouter preserves slider values | manual | Manual browser test | Manual |

### Sampling Rate
- **Per task commit:** `pytest tests/unit/test_openai_service.py tests/unit/test_anthropic_service.py -x -q`
- **Per wave merge:** `pytest tests/ -x -q` (full 496-test suite)
- **Phase gate:** Full suite green + manual E2E PPT generation test on 3 providers

### Wave 0 Gaps
- [ ] `tests/unit/test_anthropic_service.py` — covers GEN-02: message conversion, tool conversion, stop_reason mapping, cache_control placement
- [ ] New test class `TestResolveMaxTokensProviderBypass` in `tests/unit/test_openai_service.py` — covers GEN-02/GEN-05 backend bypass

*(Existing test files for `test_explorer_agent.py`, `test_openai_service.py` need new test cases but files exist)*

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No — API key routing unchanged | — |
| V3 Session Management | No | — |
| V4 Access Control | No — RLS unchanged | — |
| V5 Input Validation | Yes (minimal) | Tool result content is already sanitized; `_strip_nul` still applies |
| V6 Cryptography | No | Anthropic API key stored same as existing keys; no new crypto |

**Security note:** `settings.anthropic_api_key` is already stored in `settings_override.json` and accessed via Pydantic settings — no new secret handling code needed. The key is never logged or exposed in SSE events.

## Sources

### Primary (HIGH confidence)
- [CITED: platform.claude.com/docs/en/api/messages-streaming] — Complete streaming event taxonomy, SSE payloads, tool_use streaming sequence
- [CITED: platform.claude.com/docs/en/agents-and-tools/tool-use/handle-tool-calls] — tool_result format, multiple tool result grouping requirement, is_error
- [CITED: platform.claude.com/docs/en/build-with-claude/prompt-caching] — cache_control placement on system and tools, minimum token thresholds, usage fields
- [VERIFIED: pypi.org/project/anthropic] — Version 0.97.0 current as of 2026-04-26
- Codebase grep — `_resolve_max_tokens` at line 638, `_CTX_LIMIT_SUBAGENT` at line 711, `max_iterations` at lines 556/560, slider locations in SettingsPage.tsx

### Secondary (MEDIUM confidence)
- [CITED: platform.claude.com/docs/en/docs/build-with-claude/tool-use/implement-tool-use] — Tool schema format, `tool_choice` options, `input_schema` key name

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions verified on pypi.org
- Architecture: HIGH — streaming event format confirmed from official docs with SSE examples
- Message conversion: HIGH — native format confirmed from official handle-tool-calls docs
- Pitfalls: HIGH — most derived from official docs (400 error conditions documented explicitly)
- Settings UI: HIGH — existing `activeProvider` state pattern confirmed by reading SettingsPage.tsx source

**Research date:** 2026-04-26
**Valid until:** 2026-05-26 (Anthropic API stable; streaming format changes are announced via versioning policy)
