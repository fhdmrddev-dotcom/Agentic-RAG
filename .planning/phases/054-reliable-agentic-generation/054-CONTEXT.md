# Phase 54: Reliable Agentic Generation - Context

**Gathered:** 2026-04-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix the agentic generation pipeline so complex end-to-end tasks (PPT, PDF, report generation from documents) complete reliably across Anthropic, OpenAI, and Google. Root cause: artificial token reductions, character caps on tool results, and the OpenAI compat layer for Anthropic. This phase replaces the Anthropic compat path with the native SDK, removes all artificial constraints, and hides native-provider settings sliders that could silently cap output.

</domain>

<spec_lock>
## Requirements (locked via SPEC.md)

**11 requirements are locked.** See `054-SPEC.md` for full requirements, boundaries, and acceptance criteria.

Downstream agents MUST read `054-SPEC.md` before planning or implementing. Requirements are not duplicated here.

**In scope (from SPEC.md):**
- Remove 20% token reduction from `create_adaptive_streaming_chat`
- Native Anthropic SDK provider class in new `anthropic_service.py`
- Anthropic prompt caching via `cache_control` on system prompt + tools
- Remove `_CTX_LIMIT_SUBAGENT` and `_CTX_LIMIT_DEFAULT` character caps
- Increase `max_iterations` general → 15, explorer → 8
- Two distinct fallback messages (context overflow vs empty model response)
- Google: OpenAI compat confirmed working with an end-to-end test (native Google SDK deferred)
- Provider-parity test procedure (manual or automated)
- Settings UI: hide output/context sliders for OpenAI, Anthropic, Google; keep for OpenRouter and Ollama
- `_resolve_max_tokens` + `resolve_context_budget` bypass user overrides for native providers
- Read-only info rows showing active model limits when sliders are hidden

**Out of scope (from SPEC.md):**
- LiteLLM migration
- Native Google SDK (deferred — see D-04 below)
- Extended thinking / Claude computer use
- Frontend streaming UI changes
- Sub-agent architecture redesign
- Automated CI integration tests

</spec_lock>

<decisions>
## Implementation Decisions

### D-01: Google SDK — Confirm Compat, Defer Native
Google uses the existing OpenAI compat path. Phase 53 already fixed the two known Google compat issues: `parallel_tool_calls` skipped for Google, and `finish_reason` normalization in `_FINISH_REASON_MAP` (`STOP→stop`, `MAX_TOKENS→length`). A verified end-to-end generation test (gemini-2.5-flash, "generate PPT from document") confirms the compat path works and documents the decision. Native `google-generativeai` SDK is deferred to a future phase once the `AnthropicProvider` adapter pattern is proven.

### D-02: AnthropicProvider — New File `anthropic_service.py`
The native Anthropic provider lives in a new `backend/app/services/anthropic_service.py`. `openai_service.py` is already 849 lines; adding the provider class (message format conversion, streaming event adapter, prompt caching, `tool_result` block handling) would push it past 1,100 lines and mix two SDK namespaces. `threads.py` imports from both files.

### D-03: threads.py Integration — Adapter Pattern
`anthropic_service.py` yields normalized event dicts that the existing agent loop in `threads.py` already knows how to process. The agent loop itself is **unchanged**. All translation from native Anthropic streaming events to the internal event format is encapsulated inside `anthropic_service.py`. Pattern:

```python
# anthropic_service.py — yields normalized events
def stream_anthropic(messages, tools, ...):
    for event in native_sdk_stream:
        if event.type == 'content_block_delta':
            yield {"type": "delta", "content": event.delta.text}
        elif event.type == 'content_block_start' and is_tool:
            yield {"type": "tool_start", "name": ..., "id": ...}
        ...

# threads.py — agent loop unchanged, handles same event dicts
for event in provider.stream(...):
    handle_event(event)
```

### D-04: Context Trimming — Fully Remove Caps, Trust trim_messages_to_fit
`_CTX_LIMIT_SUBAGENT` (8k chars) and `_CTX_LIMIT_DEFAULT` (3k chars) are removed entirely. No replacement cap. This replicates what Anthropic, OpenAI, and Google do in their own products: tool results are stored in full in the messages array; context is managed by sliding-window trimming that drops the oldest messages when total context exceeds the model budget. `trim_messages_to_fit()` already runs pre-loop and per-iteration using `resolve_context_budget(active_provider, model)`. For the three target providers (Anthropic 200k, OpenAI 128k, Gemini 1M), a full `analyze_document` result is ~25k tokens — comfortably within budget. OpenRouter small models remain best-effort (not a target for this phase). User explicitly does not want budget constraints; accuracy and reliability take priority.

### D-05: Prompt Caching Scope — System Prompt + Tools Only
Anthropic prompt caching (`cache_control: {"type": "ephemeral"}`) applied to the system prompt block and the tools list on every Anthropic call. Message history caching (multi-turn caching of recent messages) is out of scope for this phase — system prompt + tools is the high-value prefix that is constant across all turns.

### Claude's Discretion
- Exact internal event dict schema for the adapter (field names, event types) — match whatever `threads.py` currently processes to minimize loop changes
- How `_resolve_max_tokens` detects active provider — read from `user_settings.active_provider` (same pattern already used in `create_adaptive_streaming_chat`)
- Read-only info row copy/formatting in Settings UI — follow existing label row patterns in SettingsPage.tsx

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Locked Specification
- `.planning/phases/054-reliable-agentic-generation/054-SPEC.md` — Locked requirements, boundaries, constraints, 15 acceptance criteria. MUST read before planning.

### Existing Code — Files That Change
- `backend/app/services/openai_service.py` — Contains `_resolve_max_tokens` (line 638), `create_adaptive_streaming_chat` with 20% reduction at line 799, `_MODEL_OUTPUT_DEFAULTS`, `_PROVIDER_DEFAULT_MAX_TOKENS`. Remove reduction; add provider bypass to `_resolve_max_tokens`.
- `backend/app/api/threads.py` — Contains `max_iterations` (lines 556, 560), `_CTX_LIMIT_SUBAGENT`/`_CTX_LIMIT_DEFAULT` (lines 711–712), cap application (lines 1448–1455). Remove caps; increase iterations.
- `frontend/src/pages/SettingsPage.tsx` — Contains `contextWindowMaxTokens`, `subAgentMaxOutputTokens`, `llmMaxOutputTokens` sliders (lines 559–563). Hide for native providers; add read-only info rows.

### Existing Code — Files That Inform (No Changes)
- `backend/app/services/context_window.py` — `trim_messages_to_fit()` and `resolve_context_budget()`. Already wired in correctly; no changes needed.
- `backend/app/config.py` — `get_model_capability()`, `MODEL_CAPABILITIES` registry. Anthropic key routing already in `settings.anthropic_api_key`.

### New File
- `backend/app/services/anthropic_service.py` — To be created. Native `anthropic` Python SDK integration.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `trim_messages_to_fit()` + `resolve_context_budget()`: Already called at `threads.py:639` (pre-loop) and `threads.py:732` (per-iteration). No changes needed — just removing the character caps lets full results flow through.
- `_FINISH_REASON_MAP` in `openai_service.py`: Already maps Anthropic and Google compat `finish_reason` values. The Anthropic native SDK returns `stop_reason` values (`end_turn`, `tool_use`, `max_tokens`) — map these to canonical values in `anthropic_service.py`.
- `get_model_capability()` / `MODEL_CAPABILITIES` registry: Already identifies `active_provider`. Reuse for provider bypass logic in `_resolve_max_tokens`.
- `_PROVIDER_DEFAULT_MAX_TOKENS` + `_MODEL_OUTPUT_DEFAULTS` in `openai_service.py`: The registry values that `_resolve_max_tokens` should return for native providers (bypassing user overrides).

### Established Patterns
- Provider detection: `user_settings.active_provider` (string: "openai", "anthropic", "google", "openrouter", "ollama") — already used throughout `threads.py` and `openai_service.py`.
- Adapter event dicts: `threads.py` currently processes dicts from the OpenAI streaming loop. Match this schema in `anthropic_service.py` so the loop is unchanged.
- Settings slider visibility: Other conditional UI in `SettingsPage.tsx` uses `activeProvider` state to show/hide sections — use same pattern for slider visibility.

### Integration Points
- `threads.py` imports `create_adaptive_streaming_chat` from `openai_service.py` — add a parallel `stream_anthropic()` or similar from `anthropic_service.py`; `threads.py` dispatches based on `active_provider`.
- `backend/requirements.txt` — add `anthropic` package.
- `SettingsPage.tsx:529–563` — hydrate function sets slider state; add provider-awareness here and at the render site.

</code_context>

<specifics>
## Specific Ideas

- **"No budget constraints"**: User explicitly said budget is not a problem and they want to replicate what Anthropic/OpenAI/Google do in their own products. Do not add any artificial limits. Full output tokens, full tool results, proper sliding-window trimming only.
- **Anthropic API key**: Already stored in `settings.anthropic_api_key` — reuse in `anthropic_service.py`; do not add a duplicate key field.
- **SSE event types preserved**: The `anthropic_service.py` adapter must yield the same SSE event types that `threads.py` already emits to the frontend (`delta`, `tool_start`, `tool_end`, `planning`, etc.) so no frontend changes are needed.

</specifics>

<deferred>
## Deferred Ideas

- **Native google-generativeai SDK**: Deferred to a future phase. Pattern from `AnthropicProvider` adapter should be replicated when ready. Phase 53 compat fixes (parallel_tool_calls, finish_reason normalization) remain in place as the Google path.
- **Multi-turn prompt caching** (message history): Caching the last few messages in Anthropic calls for cross-turn reuse — more complex; not needed for the core fix.
- **Sub-agent architecture redesign** (dedicated code-generation agent): Out of scope per SPEC.md.
- **LiteLLM migration**: Explicitly rejected in SPEC.md; native per-provider is the chosen approach.

</deferred>

---

*Phase: 054-reliable-agentic-generation*
*Context gathered: 2026-04-26*
