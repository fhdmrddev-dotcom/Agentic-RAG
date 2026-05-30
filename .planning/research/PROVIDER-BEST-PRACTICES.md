# Provider Best Practices: Tool Design, Human-in-the-Loop, Sub-Agents, System Prompts, Streaming

**Project:** Agentic RAG v2.7 — Agent Workspace & Panel
**Researched:** 2026-05-27
**Providers covered:** Anthropic (Claude), OpenAI (GPT/Responses API), Google (Gemini)
**Overall confidence:** HIGH (primary sources are official documentation pages)

---

## Table of Contents

1. [Tool Design for Persistent Artifacts/Files](#1-tool-design-for-persistent-artifactsfiles)
2. [Human-in-the-Loop Patterns (ask_user)](#2-human-in-the-loop-patterns-ask_user)
3. [Sub-Agent / Task Delegation Patterns](#3-sub-agent--task-delegation-patterns)
4. [System Prompt Design for Workspace-Aware Agents](#4-system-prompt-design-for-workspace-aware-agents)
5. [Streaming Tool Call Results with Intermediate Artifacts](#5-streaming-tool-call-results-with-intermediate-artifacts)
6. [Context Management When Workspace Files Are Large](#6-context-management-when-workspace-files-are-large)
7. [Anti-Patterns to Avoid](#7-anti-patterns-to-avoid)
8. [Actionable Recommendations for v2.7](#8-actionable-recommendations-for-v27)

---

## 1. Tool Design for Persistent Artifacts/Files

### What the Providers Say

**Anthropic** (HIGH confidence)
- Tools that create files should return **only high-signal information** -- semantic, stable identifiers (file paths, UUIDs) rather than the full content. "Design tool responses to return only high-signal information. Return semantic, stable identifiers rather than opaque internal references, and include only the fields Claude needs to reason about its next step. Bloated responses waste context and make it harder for Claude to extract what matters."
  ([Define tools](https://platform.claude.com/docs/en/agents-and-tools/tool-use/define-tools))
- Consolidate related operations into fewer tools with an `action` parameter rather than creating separate `create_file`, `update_file`, `delete_file` tools. "Consolidate related operations into fewer tools. Fewer, more capable tools reduce selection ambiguity."
  ([Writing tools for agents](https://www.anthropic.com/engineering/writing-tools-for-agents))
- For large artifacts, use **just-in-time loading**: maintain lightweight identifiers (file paths, stored queries) and dynamically load data at runtime using tools. "Agents should use lightweight references with tools to dynamically load data as needed."
  ([Effective context engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents))
- Long-running agents use **structured artifact files** (e.g., `progress.json`, `feature_list.json`) to bridge context windows. JSON is preferred over Markdown because "the model is less likely to inappropriately change or overwrite JSON files compared to Markdown files."
  ([Effective harnesses for long-running agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents))
- Support a `response_format` parameter allowing agents to request "concise" or "detailed" responses based on downstream needs.
  ([Writing tools for agents](https://www.anthropic.com/engineering/writing-tools-for-agents))

**OpenAI** (HIGH confidence)
- Tool results should be returned as strings (JSON, plain text, error codes). "For functions without return values (like send_email), return a success/failure indicator string."
  ([Function calling](https://developers.openai.com/api/docs/guides/function-calling))
- The Code Interpreter pattern returns file references via `container_file_citation` annotations containing `container_id`, `file_id`, and `filename` -- NOT the file content itself.
  ([Code Interpreter](https://developers.openai.com/api/docs/guides/tools-code-interpreter))
- "Don't make the model fill arguments you already know" -- handle known context (thread_id, user_id, workspace path) in application code.
  ([Function calling](https://developers.openai.com/api/docs/guides/function-calling))

**Google** (MEDIUM confidence)
- Return results with matching `call_id` from the function call. "Gemini 3 model APIs now generate a unique id for every function call. When returning the result, pass the matching id."
  ([Function calling](https://ai.google.dev/gemini-api/docs/interactions/function-calling))
- "Never skip validation before executing function calls" -- validate tool inputs before execution.
- Use explicit return types: specific types (integer, string, enum), not generic strings.

### Recommendation for v2.7 `write_todos` / workspace tools

```
DO: Return { "file_path": "/workspace/todos.md", "version": 3, "summary": "Added 2 items" }
DON'T: Return the entire file content in the tool result
```

- `write_todos` should accept a structured action (`add`, `toggle`, `remove`, `list`) via a single tool with an `action` parameter, not four separate tools.
- File-creating tools should return: file path, version/hash, byte size, and a one-line summary. NOT the full file content.
- Store the `thread_id` server-side; never make the model provide it as a tool parameter.

---

## 2. Human-in-the-Loop Patterns (ask_user)

### What the Providers Say

**OpenAI Agents SDK** (HIGH confidence)
- Tools requiring human approval use `needsApproval: true`. When triggered, "the run records a RunToolApprovalItem and pauses at the end of that turn, returning all pending approvals in the result interruptions array."
  ([Human-in-the-loop](https://openai.github.io/openai-agents-js/guides/human-in-the-loop/))
- Supports **sticky decisions**: `{ alwaysApprove: true }` or `{ alwaysReject: true }` persisted in run state, surviving serialization/deserialization.
- State is serializable for **long-running approvals**: "serialize state, store it, and resume later. That's still the same run."
- Approval/rejection resolves via `result.state.approve(interruption)` or `result.state.reject(interruption)`.
  ([Guardrails and approvals](https://developers.openai.com/api/docs/guides/agents/guardrails-approvals))

**Anthropic** (MEDIUM confidence -- no dedicated HITL API)
- No built-in pause/resume primitive in the Messages API. The pattern is implemented at the application layer: when the model calls a tool that requires approval, your code intercepts the `tool_use` block, presents it to the user, and only sends the `tool_result` after approval.
- The `tool_use.id` correlates the approval request with the response, enabling multiple concurrent approval flows.
  ([Ably guide - Human-in-the-loop with Anthropic](https://ably.com/docs/guides/ai-transport/anthropic/anthropic-human-in-the-loop))
- Anthropic's pattern: "When the model calls a tool that requires human approval, the tool implementation itself handles the approval check before executing."

**Google** (LOW confidence)
- No documented HITL primitive in the Gemini API for function calling. Approval logic is expected at the application layer, similar to Anthropic.

### Recommendation for v2.7 `ask_user` tool

The `ask_user` tool is an application-level construct, not a provider primitive. All three providers support this pattern identically:

1. **Model calls `ask_user` tool** with `{ "question": "Should I proceed with deletion?", "options": ["yes", "no", "modify"] }`.
2. **Backend intercepts** the tool call in the agent loop. Instead of executing, it:
   - Emits an SSE event `ask_user` with the question and options to the frontend.
   - Persists the pending question to the database (for reconnection resilience).
   - **Pauses the agent loop** by not sending the tool_result back to the LLM.
3. **Frontend renders** the question in the right-side panel with clickable options.
4. **User responds**. Frontend sends the answer to the backend.
5. **Backend resumes** the agent loop by constructing a `tool_result` with the user's answer and continuing the LLM conversation.

Key design choices:
- **Timeout with default**: If user doesn't respond within N minutes, provide a default answer (e.g., "User did not respond. Proceeding with the safe default: no.").
- **Persist pending state**: Store the pending question in the `runs` table or a new `pending_user_inputs` table so SSE reconnection can restore it.
- **Thread-scoped**: Only the thread that spawned the question shows the prompt. Other threads continue independently.
- **No provider-specific code needed**: The `ask_user` tool result is just a string -- all 9 providers handle it identically.

```python
# Pseudocode for the agent loop pause
if tool_name == "ask_user":
    question = tool_input["question"]
    emit_sse("ask_user", {"question": question, "tool_use_id": tool_use_id})
    persist_pending_input(run_id, tool_use_id, question)
    answer = await wait_for_user_response(run_id, tool_use_id, timeout=300)
    tool_result = {"role": "user", "content": [
        {"type": "tool_result", "tool_use_id": tool_use_id, "content": answer}
    ]}
    # Resume agent loop with this tool_result
```

---

## 3. Sub-Agent / Task Delegation Patterns

### What the Providers Say

**OpenAI** (HIGH confidence)
- Two patterns: **Agents-as-Tools** and **Handoffs**.
  - **Agents-as-Tools**: "A manager agent keeps control of the conversation and calls specialist agents through `Agent.as_tool()`. Specialists help with bounded subtasks but don't assume control of the user-facing conversation."
  - **Handoffs**: "A triage agent routes the conversation to a specialist, and that specialist becomes the active agent for the rest of the turn."
  ([Multi-agent orchestration](https://openai.github.io/openai-agents-python/multi_agent/))
- Recommendation: "Use agents as tools when a specialist should help with a bounded subtask but should not take over the user-facing conversation."
- "Start with one agent whenever you can. Add specialists only when they materially improve capability isolation, policy isolation, prompt clarity, or trace legibility."
  ([Orchestration and handoffs](https://developers.openai.com/api/docs/guides/agents/orchestration))

**Anthropic** (HIGH confidence)
- Claude Opus 4.7 has "significantly improved native subagent orchestration capabilities. These models can recognize when tasks would benefit from delegating work to specialized subagents."
- Control via prompting: "Use subagents when tasks can run in parallel, require isolated context, or involve independent workstreams that don't need to share state. For simple tasks, sequential operations, single-file edits, or tasks where you need to maintain context across steps, work directly rather than delegating."
  ([Prompting best practices](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices))
- Claude Opus 4.7 spawns fewer subagents by default than Claude Opus 4.6, but this is steerable.

**Google** (LOW confidence)
- No documented sub-agent pattern in the Gemini API. Agent orchestration is handled at the platform level (Gemini Enterprise Agent Platform) with Sessions and Agent Engine, not at the API level.

### Recommendation for v2.7 `task` tool

The `task` tool maps to the **Agents-as-Tools** pattern (OpenAI terminology). The main agent remains the conversation owner; the sub-agent does bounded work and returns a result.

Implementation:
1. **Model calls `task` tool** with `{ "description": "Analyze the Q3 revenue data", "context": "workspace file at /data/q3.csv" }`.
2. **Backend spawns a sub-agent** with:
   - A **separate** LLM call with its own system prompt (scoped to the task).
   - Access to the same workspace filesystem (read-only or read-write per task type).
   - A **reduced tool set** (only workspace read tools + execute_code, NOT ask_user or task recursion).
   - A **shorter max_iterations** cap (e.g., 5 vs 15 for the parent).
3. **Sub-agent runs to completion** (or timeout), producing a text result.
4. **Backend returns the result** as a `tool_result` to the parent agent.
5. **Parent agent synthesizes** the sub-agent's output into its response.

Key design choices:
- **No recursive sub-agents**: The `task` tool should NOT be available to sub-agents (prevents infinite delegation chains).
- **Truncated context passing**: Pass only the task description + relevant workspace file references, not the full parent conversation history.
- **SSE visibility**: Emit `sub_agent_start`, `sub_agent_progress`, `sub_agent_complete` events so the frontend can show a nested progress indicator.
- **Budget cap**: Sub-agents get a lower `max_tokens` budget and shorter timeout than the parent.
- **Context isolation**: Sub-agents operate in their own context window. Only the final result enters the parent's context.

This maps well to the existing `analyze_document` sub-agent pattern already in the codebase (Phase 19/25), but generalized.

---

## 4. System Prompt Design for Workspace-Aware Agents

### What the Providers Say

**Anthropic** (HIGH confidence)
- "Wrap each type of content in its own tag (e.g., `<instructions>`, `<context>`, `<input>`) to reduce misinterpretation." Use consistent, descriptive tag names.
  ([Prompting best practices](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices))
- "Setting a role in the system prompt focuses Claude's behavior and tone."
- For agents with tools: "Even small refinements to tool descriptions can yield dramatic improvements."
- "Calibrate for the right altitude -- specific enough to guide behavior, flexible enough to provide strong heuristics."
  ([Effective context engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents))
- Context awareness: Claude 4.6+ receives `<budget:token_budget>1000000</budget:token_budget>` at start and `<system_warning>Token usage: 35000/1000000; 965000 remaining</system_warning>` after each tool call.
  ([Context windows](https://platform.claude.com/docs/en/build-with-claude/context-windows))
- "If you are using Claude in an agent harness that compacts context or allows saving context to external files, consider adding this information to your prompt so Claude can behave accordingly."
- For agentic coding: Claude Opus 4.7 provides "more regular, higher-quality updates to the user throughout long agentic traces." Remove scaffolding that forced interim status messages.

**OpenAI** (HIGH confidence)
- "Write clear and detailed function names, parameter descriptions, and instructions" -- the "intern test": "if someone unfamiliar with your system could use the function correctly from the definition alone, it's well-designed."
  ([Function calling](https://developers.openai.com/api/docs/guides/function-calling))
- Organize tools by namespace: CRM, billing, shipping. This helps models choose appropriately.
- For large tool sets: "Aim for fewer than 20 functions available initially."

**Google** (MEDIUM confidence)
- "Use clear, descriptive names without spaces or special characters."
- "Keep the active tool set to 10-20 tools maximum."
- "Implement strong typing with specific types (integer, string, enum)."
  ([Function calling](https://ai.google.dev/gemini-api/docs/interactions/function-calling))

### Recommendation for v2.7 System Prompt

```xml
<system_prompt>
<role>
You are an AI agent with access to a persistent workspace. You can create, read, 
and modify files in the workspace for this conversation thread. Files persist 
across messages and are visible in the user's side panel.
</role>

<workspace_context>
The workspace is a per-thread filesystem. Files you create are stored and 
versioned automatically. The user can see workspace files in the right-side panel.

Current workspace contents:
{workspace_file_listing}

When you create or modify workspace files, the user sees the changes immediately.
Use the workspace for:
- Drafting documents, code, or analyses that benefit from iteration
- Maintaining todo lists and task tracking
- Storing intermediate results from data analysis
- Any content the user might want to reference, download, or iterate on
</workspace_context>

<tool_guidance>
Available tools: {tool_list_with_descriptions}

Tool usage guidelines:
- Use `write_file` for content the user might want to reference later. Prefer 
  workspace files over inline responses for anything >20 lines.
- Use `write_todos` to maintain a structured todo list. Always show the user 
  what changed.
- Use `ask_user` when you need clarification that would materially change your 
  approach. Do NOT use it for confirmations of routine operations.
- Use `task` to delegate bounded, independent work (data analysis, research) 
  that benefits from isolated context. Do NOT delegate simple lookups or 
  single-step operations.
</tool_guidance>

<behavioral_rules>
- After creating or modifying a workspace file, briefly describe what you did 
  and why, but do NOT echo the full file content in your response.
- When workspace files are referenced, use file paths as identifiers. Load 
  file content only when needed for the current reasoning step.
- If approaching context limits, summarize workspace state rather than 
  re-reading all files.
</behavioral_rules>
</system_prompt>
```

Key principles from provider docs applied:
1. **XML tags** for structural separation (Anthropic best practice).
2. **Role setting** in the system prompt (all three providers).
3. **Just-in-time loading** -- tell the model to reference files by path, not preload content (Anthropic context engineering).
4. **Tool guidance** with when-to-use and when-NOT-to-use (all three providers emphasize this).
5. **Output framing** -- don't echo file content back (Anthropic: "return only high-signal information").

---

## 5. Streaming Tool Call Results with Intermediate Artifacts

### What the Providers Say

**Anthropic** (HIGH confidence)
- Tool calls stream via `content_block_start` (type: `tool_use`) followed by `content_block_delta` events with `input_json_delta` containing `partial_json`.
- "Current models only support emitting one complete key and value property from input at a time. There may be delays between streaming events while the model is working."
- The event sequence for a streaming tool call:
  ```
  content_block_start  {type: "tool_use", id: "toolu_...", name: "write_file", input: {}}
  content_block_delta  {type: "input_json_delta", partial_json: ""}
  content_block_delta  {type: "input_json_delta", partial_json: "{\"path\":"}
  content_block_delta  {type: "input_json_delta", partial_json: " \"/workspace/"}
  content_block_delta  {type: "input_json_delta", partial_json: "report.md\""}
  ...
  content_block_stop
  ```
  ([Streaming messages](https://platform.claude.com/docs/en/build-with-claude/streaming))

**OpenAI** (HIGH confidence)
- Chat Completions: Tool calls stream via `delta.tool_calls` with `index`, `id`, `function.name`, and progressively-filled `function.arguments`.
- Responses API: `response.output_item.added` for new tool calls, then `response.function_call_arguments.delta` for argument chunks, `response.function_call_arguments.done` for completion.
- "Accumulate argument deltas across chunks since only the first chunk includes the function name."
  ([Function calling](https://developers.openai.com/api/docs/guides/function-calling), [Streaming responses](https://developers.openai.com/api/docs/guides/streaming-responses))

**Google** (MEDIUM confidence)
- Gemini 3 Pro+ supports `streamFunctionCallArguments: true` in `functionCallingConfig`.
- Returns `partialArgs` with `jsonPath` indicating where each fragment belongs in the parameter object, plus `willContinue` boolean.
- "Streaming function call arguments is not supported in Gemini 3.1 Flash-Lite."
  ([Function calling](https://ai.google.dev/gemini-api/docs/interactions/function-calling))

### Recommendation for v2.7

Our existing SSE event model already handles streaming tool calls via `tool_args_progress` events (Phase 075.10). For workspace file creation, add:

1. **`workspace_file_creating` SSE event**: Emitted when a tool call is detected as a workspace write (by tool name). Contains `{ file_path, estimated_size }`. Triggers the panel to show a "creating..." indicator.
2. **`workspace_file_progress` SSE event**: Re-use the existing `tool_args_progress` mechanism. As `code_so_far` or the file content argument streams, emit progress. The panel can show a live preview for text files.
3. **`workspace_file_created` SSE event**: Emitted after tool execution completes. Contains `{ file_path, version, size, mime_type }`. Panel adds the file to its listing.

This maps to the existing three-phase SSE pattern:
- `tool_preparing` -> `tool_start` -> `tool_end` (existing)
- + workspace-specific events layered on top for panel updates

---

## 6. Context Management When Workspace Files Are Large

### What the Providers Say

**Anthropic** (HIGH confidence)
- **Context rot**: "As token count grows, accuracy and recall degrade. This makes curating what's in context just as important as how much space is available."
  ([Context windows](https://platform.claude.com/docs/en/build-with-claude/context-windows))
- **Tool result clearing**: "Clear old tool results in agentic workflows" -- available via context editing API.
- **Compaction**: "Server-side summarization that automatically condenses earlier parts of a conversation."
- **Programmatic Tool Calling**: "By keeping intermediate results out of Claude's context, PTC dramatically reduces token consumption. Average usage dropped from 43,588 to 27,297 tokens, a 37% reduction."
  ([Advanced tool use](https://www.anthropic.com/engineering/advanced-tool-use))
- **Just-in-time loading**: "Rather than pre-processing all relevant data up front, agents maintain lightweight identifiers and use these references to dynamically load data into context at runtime."
  ([Effective context engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents))
- **Structured note-taking**: "Agents maintain external memory files (like NOTES.md or to-do lists) outside the context window, retrieved when needed."
- **JSON over Markdown** for structured state: less likely to be accidentally modified by the model.

**OpenAI** (HIGH confidence)
- "Function definitions count as input tokens, so limit initial function count."
- "Leverage prompt caching since function definitions are injected into the system message."
  ([Function calling](https://developers.openai.com/api/docs/guides/function-calling))

**Google** (MEDIUM confidence)
- Use `previous_interaction_id` for stateful context management across turns, which handles tool context automatically.
  ([Function calling](https://ai.google.dev/gemini-api/docs/interactions/function-calling))

### Recommendation for v2.7

**Never inject full workspace file content into the system prompt.** Instead:

1. **System prompt contains a file listing only**: path, size, last-modified, one-line description. This costs ~50-100 tokens for a typical workspace vs potentially 10K+ tokens for content.

2. **`read_file` tool for on-demand access**: When the model needs file content, it calls `read_file(path, start_line, end_line)`. This already exists in the codebase (`read_document` tool, Phase 6).

3. **Tool result capping**: Apply the existing 3K char cap (Phase 22 decision) to workspace file reads. For larger files, return a truncated preview + total size + line count.

4. **Inter-iteration trim**: Between agent loop iterations, clear tool_result content from previous iterations (existing Phase 18 pattern). Only the model's text summaries survive.

5. **Workspace state file**: Maintain a machine-readable `_workspace_state.json` that the agent can read in one call to understand the full workspace state without reading individual files:
   ```json
   {
     "files": [
       {"path": "report.md", "size": 4521, "version": 3, "last_modified": "..."},
       {"path": "todos.md", "size": 289, "version": 7, "last_modified": "..."}
     ],
     "total_size": 4810,
     "file_count": 2
   }
   ```

---

## 7. Anti-Patterns to Avoid

### From Anthropic Docs

| Anti-Pattern | Why | Source |
|-------------|-----|--------|
| Stuffing full file content into system prompt | Context rot + token waste | [Context engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) |
| Creating separate tools for every CRUD action | Selection ambiguity; consolidate with `action` param | [Writing tools for agents](https://www.anthropic.com/engineering/writing-tools-for-agents) |
| Returning opaque IDs without semantic context | Model can't reason about next steps | [Define tools](https://platform.claude.com/docs/en/agents-and-tools/tool-use/define-tools) |
| Hardcoded brittle if-else prompt rules | Fragile, high maintenance burden | [Context engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) |
| Using CRITICAL/MUST language for tool triggering | Overtriggering on Claude 4.5+; use normal prompting | [Prompting best practices](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices) |
| Excessive subagent spawning for simple tasks | Waste; "work directly rather than delegating" for simple ops | [Prompting best practices](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices) |

### From OpenAI Docs

| Anti-Pattern | Why | Source |
|-------------|-----|--------|
| Toggle functions with contradictory states | `toggle_light(on: bool, off: bool)` allows impossible states | [Function calling](https://developers.openai.com/api/docs/guides/function-calling) |
| Making model fill known parameters | Thread ID, user ID -- handle server-side | [Function calling](https://developers.openai.com/api/docs/guides/function-calling) |
| Including examples in function definitions for reasoning models | Can degrade reasoning model performance | [Function calling](https://developers.openai.com/api/docs/guides/function-calling) |
| Exposing all tools upfront for large sets | Hurts accuracy; use tool search for 20+ tools | [Function calling](https://developers.openai.com/api/docs/guides/function-calling) |

### From Google Docs

| Anti-Pattern | Why | Source |
|-------------|-----|--------|
| Executing on partial streaming arguments | Incomplete data leads to errors | [Function calling](https://ai.google.dev/gemini-api/docs/interactions/function-calling) |
| Vague function descriptions | Model picks wrong tools | [Function calling](https://ai.google.dev/gemini-api/docs/interactions/function-calling) |
| More than 20 active tools | Increased error rate | [Function calling](https://ai.google.dev/gemini-api/docs/interactions/function-calling) |
| Weak typing (generic strings instead of enums) | Unpredictable inputs | [Function calling](https://ai.google.dev/gemini-api/docs/interactions/function-calling) |

---

## 8. Actionable Recommendations for v2.7

### Tool Count Budget

Current tool count: 16 (General mode). Adding `write_file`, `read_workspace_file`, `write_todos`, `task`, `ask_user` = 21 tools. Google warns against >20.

**Recommendation**: Consolidate workspace operations into 2 tools:
- `workspace` with actions: `write_file`, `read_file`, `list_files`, `delete_file`
- `todos` with actions: `add`, `toggle`, `remove`, `list`, `clear`
- Keep `task` and `ask_user` as separate tools (they have fundamentally different behaviors)

This keeps the total at 18 tools (16 existing + `workspace` + `todos` - potential consolidation of `read_document` into `workspace`).

### Strict Schema Mode

Enable `strict: true` (OpenAI) for all new tool definitions. Anthropic also supports `strict: true`. This eliminates malformed tool calls.

### Tool Description Template

Based on Anthropic's "at least 3-4 sentences per tool description" guidance:

```
Line 1: What the tool does
Line 2: When to use it (and when NOT to)
Line 3: What each key parameter means
Line 4: What the tool returns and what it does NOT return
Line 5: Important caveats or limitations
```

### Error Message Quality

"Write instructive error messages. Instead of generic errors like 'failed', include what went wrong and what Claude should try next, e.g., 'Rate limit exceeded. Retry after 60 seconds.'" (Anthropic)

"Include error details in result strings so the model understands what failed." (OpenAI)

### SSE Event Model for New Tools

| Tool | SSE Events |
|------|-----------|
| `workspace:write_file` | `tool_preparing` -> `tool_args_progress` (content streaming) -> `tool_start` -> `workspace_file_created` -> `tool_end` |
| `workspace:read_file` | `tool_preparing` -> `tool_start` -> `tool_end` (content in tool_result, not SSE) |
| `todos:*` | `tool_preparing` -> `tool_start` -> `todos_updated` (new event with current todo state) -> `tool_end` |
| `ask_user` | `tool_preparing` -> `tool_start` -> `ask_user_pending` (new event) -> [PAUSE] -> `ask_user_answered` -> `tool_end` |
| `task` | `tool_preparing` -> `tool_start` -> `sub_agent_progress` (periodic) -> `sub_agent_complete` -> `tool_end` |

### Cross-Provider Compatibility

All 9 providers receive tools via the same schema. Key differences:
- **OpenAI/Anthropic/Google**: Native `tools` parameter with JSON Schema.
- **DeepSeek/Kimi/MiniMax/GLM**: OpenAI-compatible format via their respective SDKs.
- **OpenRouter**: Passes through to the upstream provider.
- **Ollama**: Depends on model; some support function calling, some need JSON-in-prompt.

The new tools (`workspace`, `todos`, `task`, `ask_user`) are **pure application-layer constructs**. They don't require any provider-specific handling -- the tool results are just strings. This is the correct architecture for a multi-provider platform.

---

## Sources

### Official Documentation (PRIMARY)
- [Anthropic: Tool use overview](https://platform.claude.com/docs/en/agents-and-tools/tool-use/overview)
- [Anthropic: Define tools](https://platform.claude.com/docs/en/agents-and-tools/tool-use/define-tools)
- [Anthropic: Handle tool calls](https://platform.claude.com/docs/en/agents-and-tools/tool-use/handle-tool-calls)
- [Anthropic: Streaming messages](https://platform.claude.com/docs/en/build-with-claude/streaming)
- [Anthropic: Context windows](https://platform.claude.com/docs/en/build-with-claude/context-windows)
- [Anthropic: Prompting best practices](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices)
- [OpenAI: Function calling](https://developers.openai.com/api/docs/guides/function-calling)
- [OpenAI: Using tools](https://developers.openai.com/api/docs/guides/tools)
- [OpenAI: Streaming responses](https://developers.openai.com/api/docs/guides/streaming-responses)
- [OpenAI: Orchestration and handoffs](https://developers.openai.com/api/docs/guides/agents/orchestration)
- [OpenAI: Guardrails and approvals](https://developers.openai.com/api/docs/guides/agents/guardrails-approvals)
- [OpenAI Agents SDK: Multi-agent](https://openai.github.io/openai-agents-python/multi_agent/)
- [OpenAI Agents SDK: Human-in-the-loop](https://openai.github.io/openai-agents-js/guides/human-in-the-loop/)
- [Google: Function calling](https://ai.google.dev/gemini-api/docs/interactions/function-calling)

### Engineering Articles (SECONDARY)
- [Anthropic: Writing tools for agents](https://www.anthropic.com/engineering/writing-tools-for-agents)
- [Anthropic: Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)
- [Anthropic: Effective harnesses for long-running agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)
- [Anthropic: Advanced tool use](https://www.anthropic.com/engineering/advanced-tool-use)
- [OpenAI: Code Interpreter](https://developers.openai.com/api/docs/guides/tools-code-interpreter)
