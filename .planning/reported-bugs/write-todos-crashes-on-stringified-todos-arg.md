---
id: BUG-260529-01
title: write_todos crashes ('str' object has no attribute 'get') when a model sends the `todos` arg as a JSON string
reported: 2026-05-29
surface: Agentic-RAG
severity: major
status: open
affected_areas: [backend/tools, backend/agent-loop, cross-provider]
folded_into: null
verified_closed_by: null
related_seeds: []
re_open_trigger: null
reproduces_on:
  branch: v2.5-dev
  commit: f383f04
  date: 2026-05-29
---

# BUG-260529-01: write_todos crashes when `todos` arg arrives as a JSON string

## What we observed

During Phase 086 cross-provider UAT (Chrome MCP), an OpenRouter run on the **free** `meta-llama/llama-3.3-70b-instruct` model entered a 14-iteration loop calling `write_todos`, each call failing. Backend console (operator-provided):

```
Tool write_todos unexpected error: 'str' object has no attribute 'get'   (×14)
```

The run card showed each `write_todos` as "DONE" but the backend `/todos` for the thread returned **0**, and nothing persisted to the frontend store.

**DB evidence** (thread `6e284fb5`, `messages.tool_calls`): the assistant emitted the argument as a **stringified JSON array**, not a parsed array:

```json
{ "todos": "[{\"id\": \"t1\", \"content\": \"Create a 5k training plan\", \"status\": \"pending\", \"parent_id\": null, \"order_index\": 0}, ...]" }
```

`args["todos"]` is a `str`. In `_handle_write_todos` (`backend/app/services/tool_dispatcher.py:1207`):

```python
todos_in = args.get("todos") or []
for t in todos_in:                         # iterating a str yields single chars
    if not t.get("id") or not t.get("content"):   # char.get(...) -> AttributeError
```

Iterating the string yields characters; `char.get("id")` raises `'str' object has no attribute 'get'`. The same unguarded `.get()` exists again in `todos_service.replace_todos` (`backend/app/services/todos_service.py:61-62`).

**Cross-model confirmation (same prompt, DB-verified):**
- Crashes/loops: free `llama-3.3-70b` (OpenRouter) — stringified `todos`.
- Succeeds (todos persisted): OpenAI gpt-5.4-mini, Anthropic claude-opus-4-6, DeepSeek deepseek-v4-flash, Moonshot kimi-k2.6, and operator retries on OpenRouter **glm / gemma / deepseek-r1** and Google **gemini-3.5-flash** — all emit `todos` as a real array.
- Separate failure mode: Google **gemini-2.5-flash** did not emit the tool call at all (narrated instead) — model weakness, not this bug.

## Why it matters

`major`: any model that serializes nested tool arguments as a JSON string (common with weaker / OpenRouter-proxied / some open models) cannot use `write_todos` at all, and instead of getting a friendly, self-correcting error it triggers an opaque "Tool execution failed" that the model retries until the agent step cap — wasting a full run and tokens. As more native providers are added (GLM, MiniMax, etc.) and OpenRouter stays in the mix, arg-shape variance like this will recur. The tool should be robust to arg-shape, not assume a parsed array.

## Hypothesized cause

Confirmed (not just hypothesis): `_handle_write_todos` and `replace_todos` assume `todos` is already a `list[dict]` and call `.get()` on each element without an `isinstance` guard or a `json.loads` coercion for the stringified case. Some models return nested JSON arguments as strings; the dispatcher parses the top-level arguments object but leaves nested values as-is.

## Surface classification

`Agentic-RAG` — backend tool (Phase 085 `write_todos`) robustness gap, surfaced during Phase 086 frontend UAT. **Not a Phase 086 defect**: the frontend SSE routing/persistence behaved correctly throughout (no valid `todo_updated` ever fired because the tool errored server-side, so the store correctly persisted nothing — frontend matched backend state).

## Suggested routing

- **Fold into in-flight phase:** n/a (Phase 086 is frontend-only; this is backend tool hardening).
- **Defer to future phase / milestone:** small backend hardening — candidate for a `/gsd:quick` fix or fold into the next backend-tools phase. Fix is ~5 lines.
- **Plant as seed:** consider a broader "coerce stringified-JSON tool args centrally in tool_dispatcher" hardening pass if other tools share the assumption (task/workspace_write take structured args too).
- **External — note only:** no.

## Suggested fix (code-side)

In `_handle_write_todos` (and defensively in `replace_todos`), coerce + guard before the validation loop:

```python
import json
todos_in = args.get("todos") or []
if isinstance(todos_in, str):
    try:
        todos_in = json.loads(todos_in)
    except (ValueError, TypeError):
        return ToolResult(result="write_todos: 'todos' must be a JSON array of objects, not a string")
if not isinstance(todos_in, list):
    return ToolResult(result="write_todos: 'todos' must be a list of objects")
for t in todos_in:
    if not isinstance(t, dict):
        return ToolResult(result="write_todos: each todo must be an object with id, content, status")
    ...
```

This turns the crash into a friendly, model-readable error (enabling self-correction) and lets stringified-but-valid payloads through.

## Workarounds (prompt-side)

Use a capable model that emits structured tool args (OpenAI, Anthropic, Google **3.x**, DeepSeek, Moonshot, OpenRouter glm/gemma/deepseek-r1). Avoid free/weak OpenRouter models (e.g. free llama-3.3-70b) for tool-calling tasks.

## Reference / evidence links

- Tool handler: `backend/app/services/tool_dispatcher.py:1196-1215` (`_handle_write_todos`)
- Service: `backend/app/services/todos_service.py:61-66` (`replace_todos`)
- Catch site: `backend/app/api/threads.py:2687-2689`
- UAT: `.planning/phases/086-streamsprovider-extension-panel-hooks/086-UAT.md` (Test 3 provider matrix)
- DB: thread `6e284fb5` `messages.tool_calls` (stringified `todos`); threads with persisted todos confirm capable-model success.
