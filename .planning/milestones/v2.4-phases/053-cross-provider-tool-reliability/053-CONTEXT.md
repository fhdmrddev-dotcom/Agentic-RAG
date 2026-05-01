# Phase 53: Cross-Provider Tool Calling Reliability - Context

**Gathered:** 2026-04-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Eliminate the cross-provider tool-calling gap where non-OpenAI models (GLM 5.1, DeepSeek, Kimi via OpenRouter) output planning text instead of emitting proper `tool_calls`. Deliver a capability registry that routes each model to its optimal tool-calling strategy — native API tools for proven models, structured JSON-in-prompt for everything else — while giving the user explicit control over OpenRouter behavior via a Settings UI toggle. Zero regression for OpenAI paths.

</domain>

<decisions>
## Implementation Decisions

### Tool Calling Strategy per Model (TOOL-01)

- **D-01:** Two calling modes, selected by model capability registry:
  - **Native mode**: Pass `tools` + `tool_choice` parameters in the API call (OpenAI, verified Anthropic, verified Google). Uses `parallel_tool_calls=False` for maximum cross-provider reliability.
  - **Structured/JSON mode**: Inject tool schemas into the system prompt as structured JSON examples. Parse ` ```json\n{"tool": "...", "arguments": {...}}\n``` ` blocks from response text. No `tools` parameter sent to API.
- **D-02:** Capability registry lives in `config.py` as `MODEL_CAPABILITIES: dict[str, ModelCapability]`. User-extensible; unknown models default to structured mode (`native_tools: false`).
- **D-03:** Registry initial entries based on proven behavior:
  - `gpt-*`, `o1`, `o3`, `o4` → `native_tools: true` (OpenAI proven)
  - `claude-*` → `native_tools: true` (Anthropic native tool_use)
  - `gemini-*` → `native_tools: true` (Google native function calling)
  - `deepseek/*`, `z-ai/*`, `moonshotai/*`, `minimax/*` → `native_tools: false` (OpenRouter mixed, start safe)
  - Any unknown model ID → `native_tools: false` (safe default)
- **D-04:** No retries, no correction loops. Structured mode is one-shot deterministic. If parsing fails, response is treated as regular text — conversation continues gracefully.

### OpenRouter Strategy Setting (TOOL-02)

- **D-05:** Global setting `openrouter_tool_strategy` with three modes:
  - `quality` (default): Appends `:exacto` to OpenRouter model slugs, enables Auto Exacto quality routing, adds `parallel_tool_calls=False`, enables Response Healing plugin
  - `native`: Assumes the selected OpenRouter model supports native tools; sends `tools` param normally without `:exacto`
  - `xml`: Forces structured/JSON mode for all OpenRouter models regardless of registry setting
- **D-06:** Setting is persisted in `settings_override.json` via existing settings infrastructure. Backend default is `quality`.
- **D-07:** UI placement: AI Model Settings tab, under "Context & Sub-Agent" section (below sub-agent model dropdown). Dropdown with tooltips explaining each mode.
- **D-08:** The setting only affects OpenRouter provider. Other providers (OpenAI direct, Anthropic direct, Google direct) ignore it and use their registry capability flags directly.

### JSON Tool Call Parser (TOOL-03)

- **D-09:** Structured mode system prompt appendix: appends a "Tool Usage Instructions" block after the main SYSTEM_PROMPT. Contains:
  - List of available tools with descriptions
  - JSON format example: ` ```json\n{"tool": "search_documents", "arguments": {"query": "..."}}\n``` `
  - Instruction: "When you need to use a tool, output ONLY the JSON block. Do not describe your plan."
- **D-10:** Parser function `parse_structured_tool_calls(content: str) -> list[ToolCall]`:
  - Regex extracts markdown JSON blocks: ` ```json\s*(\{.*?\})\s*``` `
  - Falls back to inline JSON object if no markdown fences
  - Validates `tool` name against known tool names
  - Validates `arguments` is a dict
  - Normalizes to OpenAI `ToolCall` dataclass (id, type, function.name, function.arguments)
- **D-11:** Parsed tool calls feed into the **same** `tool_calls_buffer` and execution loop as native mode. Zero changes to tool dispatch or execution.

### Observability & Graceful Degradation (TOOL-04)

- **D-12:** Structured mode logs a warning on parse failure:
  ```python
  logger.warning("structured_tool_parse_failed", extra={"model": model_id, "content_preview": content[:200]})
  ```
- **D-13:** No SSE event for parse failure — conversation simply continues with the text response. No user-facing error.
- **D-14:** Per-model tool call success rate is NOT tracked in this phase. Deferred to future analytics phase.

### Performance & Safety

- **D-15:** OpenAI path is **identical** to current code. Capability check is O(1) dict lookup. No additional latency.
- **D-16:** Structured mode adds ~500-800 tokens to system prompt (tool schemas as text). This is acceptable for models with large context windows (GLM 5.1: 128k, Kimi: 200k+, DeepSeek: 128k).
- **D-17:** No schema changes. No database migrations. No new tables.
- **D-18:** No frontend changes except the Settings dropdown. Chat UI, tool call display, and SSE events are unchanged.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/milestones/v2.4-REQUIREMENTS.md` — TOOL-01 through TOOL-04

### Backend — Tool Calling Core
- `backend/app/services/openai_service.py` — `get_llm_client()`, `create_streaming_chat()`, tool schema constants, `get_tools()`
- `backend/app/api/threads.py` — `event_stream()` agent loop, `SYSTEM_PROMPT`, tool call buffering, tool execution dispatch
- `backend/app/config.py` — provider configs, model defaults, settings class

### Backend — Settings
- `backend/app/models/user_settings.py` — `UserEffectiveSettings`, `load_app_settings()`, `save_override()`
- `backend/app/api/settings.py` — Settings GET/PATCH routes

### Frontend
- `frontend/src/pages/SettingsPage.tsx` — AI Model tab, "Context & Sub-Agent" section
- `frontend/src/lib/api.ts` — `FullAppSettings` interface, settings API functions

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Tool schema constants in `openai_service.py` (lines 12-472) — used for both native and structured mode
- `create_streaming_chat()` in `openai_service.py` (lines 684-707) — single point of modification for calling mode selection
- `event_stream()` in `threads.py` (lines 437-1495) — tool call buffering and execution loop; only the parsing step changes
- Settings infrastructure in `user_settings.py` and `settings.py` — existing pattern for adding new fields

### Established Patterns
- Settings field addition: add to `UserEffectiveSettings` Pydantic model, add to `FullSettingsResponse`, add to `_build_response()`, add validation in PATCH handler
- System prompt augmentation: `SYSTEM_PROMPT` + dynamic append (folder scope, skills, memory) in `event_stream()`
- Tool call accumulation: `tool_calls_buffer` dict indexed by `tc.index`, accumulated across SSE deltas
- SSE event emission: `yield f"data: {json.dumps({'type': '...', ...})}\n\n"`

### Integration Points
- `create_streaming_chat()` → must accept `model_id` and `calling_mode` to determine native vs structured
- `event_stream()` → after LLM response, check `calling_mode` and route to native parser or `parse_structured_tool_calls()`
- Settings GET/PATCH → new `openrouter_tool_strategy` field
- Frontend Settings page → new dropdown for `openrouter_tool_strategy`

</code_context>

<specifics>
## Specific Ideas

- **Capability registry format**: `{"gpt-4o": {"native_tools": true, "provider": "openai"}, "z-ai/glm-5.1": {"native_tools": false, "provider": "openrouter"}}`. Provider field is for documentation; actual provider resolution comes from user settings.
- **Structured mode prompt appendix**: Can reuse the existing `get_tools()` function to generate the tool list dynamically, ensuring new tools automatically appear.
- **Parse failure graceful handling**: If `parse_structured_tool_calls` returns empty list, the agent loop treats it as a text response (same as when native mode returns no tool_calls). No special handling needed.
- **OpenRouter `:exacto` appending**: Only for `quality` strategy. Must not double-append if user already included `:exacto` in their model ID. Check with `":exacto" not in model_id`.

</specifics>

<deferred>
## Deferred Ideas

- Per-model tool call success rate tracking and analytics dashboard
- Automatic capability detection via A/B testing (run both modes, compare success rates)
- Structured mode for non-OpenRouter providers (currently only OpenRouter models default to structured; direct Anthropic/Google use native)
- XML format alternative (currently using JSON-in-markdown; XML could be added as a third format option)
- Tool call batching/parallel execution in structured mode (currently sequential only)

</deferred>

---

*Phase: 053-cross-provider-tool-reliability*
*Context gathered: 2026-04-26*
