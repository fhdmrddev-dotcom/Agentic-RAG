# Phase 083: Foundation -- Tool-Dispatch Extraction + Bug Fixes - Pattern Map

**Mapped:** 2026-05-28
**Files analyzed:** 6 (1 new, 5 modified)
**Analogs found:** 6 / 6

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `backend/app/services/tool_dispatcher.py` (NEW) | service | request-response (dispatch) | `backend/app/api/threads.py` lines 2548-3394 (source being extracted) + `backend/app/services/tool_parser.py` (dataclass pattern) | exact (self-extract) |
| `backend/app/api/threads.py` (MODIFY: remove dispatch chain) | controller | streaming + request-response | Self — extraction point is lines 2548-3394 | exact |
| `frontend/src/lib/api.ts` (MODIFY: _mapMessageResponse output_files) | utility | transform | Self — `_mapMessageResponse` at line 60-97 | exact |
| `backend/app/api/threads.py` (MODIFY: chunk handler Kimi filter) | controller | streaming | Self — `_on_chunk_openai` at line 2194-2228 (DeepSeek reasoning_content pattern) | exact |
| `frontend/src/components/chat/MessageList.tsx` (MODIFY: key prop) | component | event-driven (React render) | Self — line 118 `key={msg.id}` | exact |
| `backend/app/api/threads.py` (MODIFY: generate_thread_title) | controller | request-response | Self — `generate_thread_title` at lines 975-1047 + `backend/app/config.py` `_SUB_AGENT_MODEL_DEFAULTS` at line 546 | exact |

## Pattern Assignments

### `backend/app/services/tool_dispatcher.py` (NEW — service, dispatch)

**Analog:** Extracted from `backend/app/api/threads.py` lines 2548-3394 + dataclass pattern from `backend/app/services/tool_parser.py`

**Imports pattern** — follow existing services (e.g., `tool_parser.py` lines 1-12, `retrieval_service.py` lines 1-16):
```python
from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from typing import TYPE_CHECKING, Callable, Awaitable
from uuid import UUID

if TYPE_CHECKING:
    import asyncpg
    import redis.asyncio as aioredis
    from supabase import Client
    from app.models.user_settings import UserEffectiveSettings

logger = logging.getLogger(__name__)
```

**Dataclass pattern** — follow `tool_parser.py` lines 14-27 (plain `@dataclass`, not Pydantic):
```python
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
```

**ToolContext dataclass** should follow this exact pattern. Per CONTEXT.md D-01, carry:
- `redis`, `run_id`, `thread_id`, `supabase`, `pool`, `user_settings`, `current_user`
- `folder_subtree_ids`, `scoped_folder_path`
- `_emit` ref (the `_emit` function from threads.py line 115)

**Core dispatch pattern** — the existing chain at `threads.py` lines 2548-3325 follows this structure per tool:
```python
# Simple tool (e.g., "ls" — threads.py:2555-2558):
if tool_name == "ls":
    path = args.get("path") or (scoped_folder_path if scoped_folder_path else "/")
    result = await ls_path(path, current_user["id"], supabase)
    tool_result = json.dumps(result)

# Tool with side effects + audit (e.g., "remember" — threads.py:3236-3276):
elif tool_name == "remember":
    key = (args.get("key", "") or "").strip().lower()
    value = args.get("value", "") or ""
    if not key:
        tool_result = json.dumps({"error": "key cannot be empty"})
    else:
        tool_result = json.dumps({"status": "remembered", "key": key})
        # fire-and-forget DB write
        _spawn(_write_memory())
        _spawn(write_audit_entry(...))
```

**Error handling pattern** — `threads.py` lines 3326-3334 (the try/except wrapping each tool):
```python
try:
    args = json.loads(tc["arguments"])
    await _emit(redis, run_id, 'tool_start', name=tool_name, args=args)
    # ... tool dispatch ...
except json.JSONDecodeError:
    tool_result = "Error parsing tool arguments"
    args = {}
except (ValueError, RuntimeError) as e:
    logger.error("Tool %s failed: %s", tool_name, e)
    tool_result = f"Tool error: {e}"
except Exception as e:
    logger.error("Tool %s unexpected error: %s", tool_name, e)
    tool_result = f"Tool execution failed: {e}"
```

**_emit helper** — `threads.py` lines 115-129. The dispatcher needs a reference to this:
```python
async def _emit(redis, run_id: _uuid_mod.UUID, type: str, **fields) -> None:
    """One canonical XADD shape for all producer-side events (D-061-10)."""
    await redis.xadd(
        f"run:{run_id}",
        {"data": json.dumps({"type": type, **fields})},
        maxlen=10000,
        approximate=True,
    )
```

**Fire-and-forget pattern** — `threads.py` lines 65-79 (`_spawn` + `_BACKGROUND_TASKS`):
```python
_BACKGROUND_TASKS: set[asyncio.Task] = set()

def _spawn(coro) -> asyncio.Task:
    """Schedule a fire-and-forget coroutine and retain a strong reference."""
    t = asyncio.create_task(coro)
    _BACKGROUND_TASKS.add(t)
    t.add_done_callback(_BACKGROUND_TASKS.discard)
    return t
```

**Post-dispatch per-tool persistence** — `threads.py` lines 3336-3394 (tool_end emit + persisted_tool_calls append + execute_code special casing):
```python
await _emit(redis, run_id, 'tool_end', name=tool_name, result=tool_result[:2000])

# Full tool result for LLM context (no char cap)
_tool_message_content = llm_tool_content if llm_tool_content is not None else tool_result
messages.append({
    "role": "tool",
    "tool_call_id": tc["id"],
    "content": _tool_message_content,
})

# Persist tool call — execute_code special handling for output_files
if tool_name == "execute_code":
    try:
        _r = json.loads(tool_result)
        persisted_result = json.dumps({
            "status": _r.get("status", "done"),
            "exit_code": _r.get("exit_code", 0),
            "duration_ms": _r.get("duration_ms", 0),
            "output_files": _r.get("output_files", []),
            "stdout": (_r.get("stdout", ""))[:800],
            "stderr": (_r.get("stderr", ""))[:200],
        })
    except (json.JSONDecodeError, AttributeError):
        persisted_result = tool_result[:2000]
else:
    persisted_result = tool_result[:2000]

persisted_tool_calls.append({
    "tool_call_id": tc["id"],
    "name": tool_name,
    "args": args,
    "result": persisted_result,
    "status": "done",
})
```

**Key decision:** The dispatcher returns the `tool_result` string. The caller (`agent_runner` in `threads.py`) handles `_emit('tool_end', ...)`, message append, and `persisted_tool_calls` append. This keeps the dispatcher pure (no side effects beyond tool execution itself) and preserves the existing post-dispatch logic without duplication.

---

### `backend/app/api/threads.py` — Tool Dispatch Extraction (MODIFY)

**Analog:** Self — the refactored call site at line ~2548

**Before pattern** (lines 2548-3325 — ~780 LOC of `elif tool_name ==` chain):
```python
for tool_index, tc in enumerate(tool_calls):
    tool_name = tc["name"]
    sub_agent_record: dict | None = None
    llm_tool_content: str | None = None
    try:
        args = json.loads(tc["arguments"])
        await _emit(redis, run_id, 'tool_start', name=tool_name, args=args)
        if tool_name == "ls":
            # ... 15 more elif branches ...
        else:
            tool_result = f"Unknown tool: {tool_name}"
    except json.JSONDecodeError:
        tool_result = "Error parsing tool arguments"
        args = {}
    # ... error handling + post-dispatch ...
```

**After pattern** — replace the `if/elif` chain with a single `dispatch_tool()` call:
```python
for tool_index, tc in enumerate(tool_calls):
    tool_name = tc["name"]
    sub_agent_record: dict | None = None
    llm_tool_content: str | None = None
    try:
        args = json.loads(tc["arguments"])
        await _emit(redis, run_id, 'tool_start', name=tool_name, args=args)
        tool_result = await dispatch_tool(tool_name, args, tool_ctx)
    except json.JSONDecodeError:
        tool_result = "Error parsing tool arguments"
        args = {}
    except (ValueError, RuntimeError) as e:
        logger.error("Tool %s failed: %s", tool_name, e)
        tool_result = f"Tool error: {e}"
    except Exception as e:
        logger.error("Tool %s unexpected error: %s", tool_name, e)
        tool_result = f"Tool execution failed: {e}"
    # ... post-dispatch emit + persist stays here ...
```

**ToolContext construction** — built once before the agent loop's tool dispatch, from the enclosing `agent_runner` closure variables:
```python
from app.services.tool_dispatcher import ToolContext, dispatch_tool

tool_ctx = ToolContext(
    redis=redis,
    run_id=run_id,
    thread_id=thread_id,
    supabase=supabase,
    pool=pool,
    user_settings=user_settings,
    current_user=current_user,
    folder_subtree_ids=folder_subtree_ids,
    scoped_folder_path=scoped_folder_path,
    emit=_emit,
)
```

---

### `frontend/src/lib/api.ts` — _mapMessageResponse output_files (MODIFY, BUG-260526-03)

**Analog:** Self — `_mapMessageResponse` at lines 60-97

**Current pattern** (lines 60-97):
```typescript
function _mapMessageResponse(m: MessageResponseDTO): Message {
  const {
    source_refs,
    confidence_level,
    confidence_avg_similarity,
    confidence_disclaimer,
    run_id,
    run_status,
    reasoning_content,
    ...rest
  } = m
  const mapped: Message = {
    ...rest,
    citations: (source_refs ?? []) as Citation[],
    runId: run_id ?? undefined,
    runStatus: run_status ?? undefined,
    reasoningContent: reasoning_content ?? undefined,
  }
  if (confidence_level) {
    mapped.confidence = {
      level: confidence_level as "high" | "medium" | "low",
      avg_similarity: confidence_avg_similarity ?? 0,
      disclaimer: confidence_disclaimer ?? null,
    }
  }
  return mapped
}
```

**Fix pattern** — after the existing `if (confidence_level)` block, add `finalOutputFiles` reconstruction from `tool_calls` JSONB. The persisted `tool_calls` array for `execute_code` contains `output_files` (see `threads.py` lines 3357-3369):
```typescript
// BUG-260526-03: reconstruct finalOutputFiles from persisted tool_calls
// so reloaded messages display output file download links.
if (mapped.tool_calls?.length) {
  const outputFiles: { filename: string; url?: string }[] = []
  for (const tc of mapped.tool_calls) {
    if (tc.name === "execute_code" && tc.result) {
      try {
        const r = JSON.parse(tc.result)
        if (Array.isArray(r.output_files)) {
          for (const f of r.output_files) {
            outputFiles.push({ filename: f.filename, url: f.url })
          }
        }
      } catch { /* ignore parse errors */ }
    }
  }
  if (outputFiles.length > 0) {
    mapped.finalOutputFiles = outputFiles
  }
}
```

**Data shape reference** — persisted `execute_code` result in tool_calls JSONB (`threads.py` lines 3359-3367):
```python
persisted_result = json.dumps({
    "status": _r.get("status", "done"),
    "exit_code": _r.get("exit_code", 0),
    "duration_ms": _r.get("duration_ms", 0),
    "output_files": _r.get("output_files", []),   # <-- this array
    "stdout": (_r.get("stdout", ""))[:800],
    "stderr": (_r.get("stderr", ""))[:200],
})
```

---

### `backend/app/api/threads.py` — Kimi Thinking Content Filter (MODIFY, BUG-260526-02)

**Analog:** Self — DeepSeek `reasoning_content` pattern at `_on_chunk_openai` lines 2224-2228

**Existing reasoning_content pattern** (lines 2224-2228):
```python
# DeepSeek thinking mode: accumulate reasoning_content + emit SSE
_rc = getattr(delta, 'reasoning_content', None)
if _rc:
    full_reasoning_content += _rc
    await _emit(redis, run_id, 'reasoning_delta', content=_rc)
```

**Content gate pattern** — the Kimi fix needs to detect thinking content in the regular `delta.content` field (Kimi uses `<think>` tags in content, not a separate field). Add a provider-gated filter BEFORE the `delta.content` accumulator at line 2220:
```python
if delta.content:
    # BUG-260526-02: Kimi/Moonshot thinking content leak filter.
    # Kimi wraps reasoning inside <think>...</think> tags in delta.content
    # instead of using a separate reasoning_content field. Strip thinking
    # content from full_content and accumulate into full_reasoning_content.
    _content = delta.content
    if active_provider_name in ("moonshot", "deepseek"):
        # ... provider-gated thinking tag detection + stripping ...
    full_content += _content
    await _emit(redis, run_id, 'delta', content=_content)
```

**Provider name reference** — `active_provider_name` is already in scope in the `_on_chunk_openai` closure (set earlier in `agent_runner`).

---

### `frontend/src/components/chat/MessageList.tsx` — Key Prop Fix (MODIFY, BUG-260526-04)

**Analog:** Self — line 118

**Current pattern** (line 113-124):
```tsx
messages.map((msg, idx) => {
  const isLastAssistant =
    msg.role === "assistant" && idx === messages.length - 1
  return (
    <MessageItem
      key={msg.id}                           // <-- unstable when temp-id swaps to DB UUID
      message={msg}
      isStreaming={isStreaming && isLastAssistant}
      onSendMessage={showSuggestions && isLastAssistant ? onSendMessage : undefined}
      onResume={onResume}
    />
  )
})
```

**Fix pattern** — use `runId` as stable key for streaming assistant messages, fall back to `msg.id` for everything else:
```tsx
<MessageItem
  key={msg.role === "assistant" && msg.runId ? `run-${msg.runId}` : msg.id}
  message={msg}
  // ...
/>
```

**Message type reference** — `runId` is `string | undefined` (types/index.ts line 144). It's set by the reconcile path and the `sendMessage` path. For user messages and pre-run-backed assistant messages, it is `undefined`, so the fallback to `msg.id` is safe.

---

### `backend/app/api/threads.py` — generate_thread_title Fix (MODIFY, BUG-260527-01)

**Analog:** Self — `generate_thread_title` at lines 975-1047 + `_SUB_AGENT_MODEL_DEFAULTS` at `config.py` line 546

**Current model routing** (lines 987-998):
```python
override = (
    (user_settings.sub_agent_model if user_settings else "")
    or settings.sub_agent_model
)
if override:
    model = override
else:
    provider = user_settings.active_provider if user_settings else ""
    model = (
        _SUB_AGENT_MODEL_DEFAULTS.get(provider, "")
        or (user_settings.llm_model if user_settings else settings.llm_model)
    )
```

**Current _SUB_AGENT_MODEL_DEFAULTS** (`config.py` lines 546-551):
```python
_SUB_AGENT_MODEL_DEFAULTS: dict[str, str] = {
    "anthropic":  "claude-haiku-4-5-20251001",
    "openai":     "gpt-5.4-mini",
    "google":     "gemini-2.5-flash",
    "openrouter": "",   # Unknown routing — fall back to user's selected model
    "ollama":     "",   # Local, user manages their own models
}
```

**Fix pattern** — single-model providers (DeepSeek, Moonshot, MiniMax, GLM) have empty entries in `_SUB_AGENT_MODEL_DEFAULTS` and fall through to `user_settings.llm_model`, which is correct. The bug is that:
1. Google may truncate output due to `max_tokens` being too low (30 tokens).
2. The function uses the OpenAI client for all providers, which fails for providers that don't support the OpenAI-compatible API through the same client.

The fix should:
- Check if the resolved model actually works with the active client (same cross-provider safety net pattern as `sub_agent_service.py` lines 62-89).
- Ensure single-model providers (deepseek, moonshot, minimax, glm) short-circuit to the user's main model without attempting a sub-agent model lookup.

**Sub-agent cross-provider safety pattern** (`sub_agent_service.py` lines 62-89):
```python
_active_provider = (user_settings.active_provider if user_settings else "") or ""
_active_models = (user_settings.llm_models if (user_settings and getattr(user_settings, "llm_models", None)) else "")
_active_models_list = [m.strip() for m in _active_models.split(",") if m.strip()] if _active_models else []
_provider_default = _SUB_AGENT_MODEL_DEFAULTS.get(_active_provider, "")

if override_model and _active_models_list and override_model not in _active_models_list:
    logger.warning(
        "sub_agent_model=%r is not in active provider=%r's model list — "
        "falling back to default to avoid cross-provider call. ...",
        override_model, _active_provider,
    )
    effective_model = (
        _provider_default
        or (user_settings.llm_model if user_settings else None)
        or model
        or settings.llm_model
    )
```

---

## Shared Patterns

### SSE Event Emission
**Source:** `backend/app/api/threads.py` lines 115-129
**Apply to:** `tool_dispatcher.py` (via `ToolContext.emit` callback reference)
```python
async def _emit(redis, run_id: _uuid_mod.UUID, type: str, **fields) -> None:
    await redis.xadd(
        f"run:{run_id}",
        {"data": json.dumps({"type": type, **fields})},
        maxlen=10000,
        approximate=True,
    )
```

### Fire-and-Forget Task Spawning
**Source:** `backend/app/api/threads.py` lines 65-79
**Apply to:** `tool_dispatcher.py` — several tools use `_spawn()` for audit writes and memory upserts
```python
_BACKGROUND_TASKS: set[asyncio.Task] = set()

def _spawn(coro) -> asyncio.Task:
    t = asyncio.create_task(coro)
    _BACKGROUND_TASKS.add(t)
    t.add_done_callback(_BACKGROUND_TASKS.discard)
    return t
```

### Async DB Wrapper (Cold-Path)
**Source:** `backend/app/utils/db.py` lines 32-44
**Apply to:** Tool handlers in `tool_dispatcher.py` that use supabase-py (remember, recall, search_documents, etc.)
```python
async def aexec(query):
    return await run_in_threadpool(query.execute)
```

### asyncpg Direct (Hot-Path)
**Source:** `backend/app/db/runs.py` lines 26-59
**Apply to:** Future hot-path tool handlers; current Phase 083 tools all use `aexec` (cold-path)
```python
await pool.execute(
    "INSERT INTO ... VALUES ($1, $2, $3, ...)",
    arg1, arg2, arg3,
)
```

### Audit Entry Pattern
**Source:** `backend/app/services/audit_service.py` — used throughout `threads.py` tool handlers
**Apply to:** `tool_dispatcher.py` — tools that fire audit events (search_documents, remember, recall)
```python
_spawn(write_audit_entry(
    user_id=current_user["id"],
    action_type="search.query",
    metadata={"query_text": args["query"], "document_ids": _audit_doc_ids},
    supabase=supabase,
))
```

### Provider-Gated Content Handling
**Source:** `backend/app/api/threads.py` lines 2224-2228 (DeepSeek reasoning_content)
**Apply to:** The Kimi thinking content filter fix — same approach of checking `active_provider_name` before special-case content processing
```python
_rc = getattr(delta, 'reasoning_content', None)
if _rc:
    full_reasoning_content += _rc
    await _emit(redis, run_id, 'reasoning_delta', content=_rc)
```

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| (none) | — | — | All files have exact analogs — either self-modification or extraction from existing code |

All 6 files have exact matches. The tool dispatcher is a pure extraction (the code already exists in threads.py), and the 4 bug fixes are modifications to existing patterns already present in the codebase.

## Metadata

**Analog search scope:** `backend/app/api/`, `backend/app/services/`, `backend/app/db/`, `backend/app/utils/`, `frontend/src/lib/`, `frontend/src/components/chat/`, `frontend/src/types/`
**Files scanned:** 25+ (threads.py, api.ts, MessageList.tsx, tool_parser.py, retrieval_service.py, sub_agent_service.py, sandbox_service.py, openai_service.py, db/runs.py, utils/db.py, config.py, types/index.ts)
**Pattern extraction date:** 2026-05-28
