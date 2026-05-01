# Phase 54: Reliable Agentic Generation — Specification

**Created:** 2026-04-26
**Ambiguity score:** 0.10 (gate: ≤ 0.20)
**Requirements:** 11 locked

## Goal

The agent handles complex end-to-end tasks (PPT, PDF, Word, report generation from documents) the same way Claude.ai, ChatGPT, and Gemini handle them in their own products: no artificial token reductions, no arbitrary iteration caps, provider-native API integration for Anthropic, and context managed by sliding-window trimming rather than character caps on tool results.

## Background

### How the three providers handle this in their own products

**Claude.ai (Anthropic)**
- Uses the native `anthropic` Python SDK — NOT the OpenAI compat layer
- `finish_reason` is deterministic: `"end_turn"` = text stop, `"tool_use"` = tool call pending — no ambiguity
- Full `max_tokens` given to the model (e.g., 64k for claude-sonnet-4-6) — no reductions
- Tool results are stored as native `tool_result` blocks in the Anthropic message format
- Context managed by infrastructure: long tool results are summarized at the API level, not truncated with character caps
- No hardcoded iteration limit — Claude decides when it's done based on the task
- Supports `extended_thinking` for complex multi-step tasks (beta)
- Supports prompt caching (`cache_control`) to reduce latency on repeated context

**ChatGPT (OpenAI)**
- Native OpenAI SDK — already what we use
- Full `max_completion_tokens` for o-series; full `max_tokens` for GPT-4.x — no reductions
- Code Interpreter (equivalent to execute_code) iterates autonomously — model decides when code is done
- Context trimmed via sliding window managed by the API, not by the application layer
- No artificial iteration limit

**Gemini (Google)**
- Native `google.generativeai` SDK — OR the OpenAI compat endpoint which is well-maintained for basic use
- 1M token context window — context management is rarely needed
- Full output token budget (up to 65k for Gemini 2.5)
- Native function calling via `tools=` parameter in the native SDK
- `finish_reason` maps cleanly: `"STOP"`, `"MAX_TOKENS"`, `"SAFETY"` — no ambiguity

### What this app does instead (the problems)

1. **OpenAI SDK for ALL providers via `base_url` override**: Works for OpenAI. For Anthropic, the compat layer returns `finish_reason="end_turn"` for BOTH text stops AND tool calls — indistinguishable without checking the buffer. We fixed the buffer check (Phase 53 session), but this is a symptom of using the wrong API.

2. **20% token reduction**: `effective_tokens = int(resolved_tokens * 0.8)` on every tool-choice=auto call. This was added to "reserve budget for tool arguments" but it directly causes `finish_reason=length` when execute_code Python code exceeds the reduced budget. None of the three providers do this.

3. **`_CTX_LIMIT_SUBAGENT` character cap**: Capping analyze_document results to 8k chars in messages causes the model to feel it has insufficient context → 3–5 extra search_documents calls → iterations exhausted before execute_code. Providers manage context via proper sliding-window trimming, not by truncating individual tool results.

4. **`max_iterations=8`**: Complex generation tasks (locate → analyze → execute → iterate) legitimately require more than 8 iterations. Providers don't impose this limit — the model decides when it's done.

5. **No prompt caching**: Anthropic supports `cache_control` on system prompt and tool definitions. Without it, every call re-sends 3k+ tokens of system prompt and 15+ tool schemas. This inflates costs and latency without benefit.

### Confirmed failure evidence (2026-04-26)

- **Supabase record**: search → query → analyze_document (full analysis) → next call returns `content: "*I wasn't able to generate a response.*"` — empty response after large tool result
- **Screenshots**: "Response cut off mid-tool-call (output length limit)" after "Now let me build the PPT..." — execute_code JSON truncated
- **LangSmith**: 91s latency traces, multiple search-documents calls after analyze_document, ChatOpenAI call returning no output
- **Code**: `finish_reason=length` with non-empty `tool_calls_buffer` → the Python code was generating but hit 26,214-token effective limit

## Requirements

1. **Remove artificial token reduction**: The 20% token reduction is removed entirely.
   - Current: `effective_tokens = int(resolved_tokens * 0.8)` applied to every tool_choice=auto call
   - Target: `effective_tokens = resolved_tokens` — the model receives its full configured output budget; no reduction applied at the application layer
   - Acceptance: A `execute_code` call with 300-line Python code (≈4,000 tokens) completes without `finish_reason=length` on a 32k-token model

2. **Native Anthropic SDK integration**: Anthropic models use the `anthropic` Python SDK directly, not the OpenAI compat endpoint.
   - Current: Anthropic accessed via `OpenAI(base_url="https://api.anthropic.com/v1", api_key=...)` — compat layer with ambiguous finish_reason and missing features
   - Target: A new `AnthropicProvider` class wraps `anthropic.Anthropic()`, handles native `tool_use` / `text` content blocks, maps Anthropic streaming events to the same internal format the agent loop already uses, and returns canonical `finish_reason` values (`"stop"`, `"tool_calls"`, `"length"`)
   - Acceptance: claude-sonnet-4-6 and claude-opus-4-6 route through the native SDK; `finish_reason` is always one of the three canonical values; existing OpenAI/Google paths are unaffected

3. **Context via sliding-window, not tool-result caps**: analyze_document results are stored in full in the messages array; context is managed by the existing `trim_messages_to_fit` function.
   - Current: `_CTX_LIMIT_SUBAGENT = 8000` chars caps analyze_document result in messages; causes model to perform extra searches; `_CTX_LIMIT_DEFAULT = 3000` caps all other tool results
   - Target: `_CTX_LIMIT_SUBAGENT` and `_CTX_LIMIT_DEFAULT` caps are removed; `trim_messages_to_fit` handles context budget by dropping older messages when needed; the model sees complete, uncapped tool results
   - Acceptance: After analyze_document on a 100-page document, the full result is in messages; `trim_messages_to_fit` drops older turns if context exceeds budget; the model does not perform extra searches before execute_code

4. **Increased iteration limit**: Agent loop allows enough iterations for complex generation workflows.
   - Current: `max_iterations=8` for general mode, `max_iterations=6` for explorer mode
   - Target: `max_iterations=15` for general mode; `max_iterations=8` for explorer mode; the force_no_tools last-iteration safety net is preserved
   - Acceptance: A workflow that legitimately requires search → query → ls → analyze → search → execute_code → text (7 tool steps) completes without force_no_tools firing early

5. **Anthropic prompt caching**: System prompt and tool definitions are cached on Anthropic calls to reduce latency and cost.
   - Current: No `cache_control` headers; every Anthropic call re-sends full system prompt and all tool schemas
   - Target: The native Anthropic SDK call adds `cache_control: {"type": "ephemeral"}` to the system prompt block and the tools list; subsequent calls in the same session reuse the cached prefix
   - Acceptance: LangSmith shows cache hit on the second+ Anthropic call in a conversation; system prompt tokens show as cached_input_tokens, not input_tokens

6. **Generation-context system prompt**: Agent calls execute_code immediately after document analysis for generation tasks, without intermediate retrieval.
   - Current: System prompt says "After analyze_document (generation task): Call execute_code IMMEDIATELY" but the analyze_document result cap causes insufficient context, leading to more searches
   - Target: With full analyze_document context available (Requirement 3), the system prompt instruction is respected; agent proceeds to execute_code within 1 iteration of analyze_document for generation tasks
   - Acceptance: "Generate a PPT from my dissertation" results in ≤1 search_documents after analyze_document; execute_code is called within 2 iterations of analyze_document returning

7. **Accurate fallback messages**: Empty-response fallback identifies the technical cause.
   - Current: `"*I wasn't able to generate a response. Please try rephrasing your question.*"` — misleading; suggests user error when the issue is technical
   - Target: Two distinct messages: context overflow → `"*The conversation grew too large for this model's context window. Start a new chat and try the generation request again.*"`; empty model response → `"*The model returned an empty response after [N] tool calls. Try breaking the request into smaller steps.*"`
   - Acceptance: Neither message contains "Please try rephrasing your question"; each cause produces a different, actionable message

8. **Google native SDK or verified compat**: Google models use a confirmed-working tool calling path.
   - Current: Google via OpenAI compat — `parallel_tool_calls` is skipped (fixed this session), but `finish_reason` mapping is untested end-to-end
   - Target: Either (a) native `google.generativeai` SDK wrapping, identical to Anthropic approach in Requirement 2, OR (b) OpenAI compat confirmed working with a test — a deliberate verified decision is documented in the phase context; `finish_reason` normalization already in place covers the compat path
   - Acceptance: gemini-2.5-flash completes a "generate PPT from document" request successfully; the implementation decision (native vs compat) is documented in 054-CONTEXT.md

9. **Provider-parity acceptance test**: One end-to-end generation test covers all three primary providers.
   - Current: No automated end-to-end test for generation workflows; failures only caught in manual testing
   - Target: A documented manual test procedure (or automated integration test if sandbox available) verifies PPT generation succeeds on claude-sonnet-4-6, gpt-4.1, gemini-2.5-flash
   - Acceptance: Test procedure exists in 054-VERIFICATION.md; all three providers pass

10. **Provider-aware Settings UI — native providers use hardcoded recommendations**: The three output/context sliders (`llm_max_output_tokens`, `context_window_max_tokens`, `sub_agent_max_output_tokens`) are hidden for OpenAI, Anthropic, and Google; values come from the model registry, not user input.
    - Current: All three sliders are shown for every provider; a stale `llm_max_output_tokens: 4096` in `settings_override.json` from a previous OpenRouter session silently caps Anthropic output to 4,096 tokens
    - Target: For `active_provider ∈ {openai, anthropic, google}` — sliders are hidden; `_resolve_max_tokens` ignores any stored override and returns the model's registry value; a read-only info row shows the active value (e.g., "Output tokens: 64,000 (model maximum)"). For `active_provider = openrouter` — all three sliders remain with full user control. For Ollama — sliders remain (hardware varies)
    - Acceptance: With Anthropic active, Settings AI Model tab shows no output-token slider and no context-depth slider; `_resolve_max_tokens("claude-sonnet-4-6", user_settings)` returns 32,768 (registry value) even when `settings_override.json` has `llm_max_output_tokens: 4096`; switching to OpenRouter restores all sliders

11. **Stored overrides ignored for native providers at runtime**: `_resolve_max_tokens` and `resolve_context_budget` bypass user overrides when the active provider is OpenAI, Anthropic, or Google.
    - Current: `_resolve_max_tokens` checks `user_settings.llm_max_output_tokens` first — a stale override from any previous session caps all providers including native ones
    - Target: Both functions check `active_provider` first; if provider is `openai`, `anthropic`, or `google`, skip the user override and go directly to model registry lookup; only fall through to user override when provider is `openrouter` or `ollama`
    - Acceptance: Unit test confirms that `_resolve_max_tokens(explicit=None, user_settings=<anthropic settings with override=4096>)` returns 32,768 for claude-sonnet-4-6; same user_settings object with provider=openrouter returns 4,096

## Boundaries

**In scope:**
- Remove 20% token reduction from `create_adaptive_streaming_chat`
- Native Anthropic SDK provider class (`AnthropicProvider` or equivalent in `openai_service.py` / new `anthropic_service.py`)
- Anthropic prompt caching via `cache_control` on system prompt + tools
- Remove `_CTX_LIMIT_SUBAGENT` and `_CTX_LIMIT_DEFAULT` character caps
- Increase `max_iterations` general → 15, explorer → 8
- Fallback message improvements (2 distinct causes)
- Google: verified compat OR native SDK (discuss-phase decides)
- Provider-parity test procedure
- Settings UI: hide output/context sliders for OpenAI, Anthropic, Google; keep for OpenRouter and Ollama
- `_resolve_max_tokens` + `resolve_context_budget` bypass user overrides for native providers
- Read-only info rows showing active model limits when sliders are hidden

**Out of scope:**
- LiteLLM migration — native per-provider integration is the chosen approach; LiteLLM is deferred
- OpenRouter native SDK — OpenRouter is explicitly accepted as best-effort; some models will still fail
- Extended thinking / Claude computer use — separate capability phase
- Frontend streaming UI changes — no UI work in this phase
- Sub-agent architecture redesign (dedicated code-generation agent) — deferred
- Changing how `run_sub_agent` works — only the main agent loop is in scope
- Automated CI integration tests — manual test procedure is sufficient for this phase

## Constraints

- `anthropic` Python package must be added to backend requirements
- All changes to `threads.py` agent loop must be backward-compatible — OpenAI and OpenRouter paths unchanged
- The 327 existing unit tests must continue to pass
- The Anthropic provider class must produce the same SSE event types that `threads.py` already consumes (`delta`, `tool_start`, `tool_end`, `planning`, etc.) — no frontend changes needed
- Anthropic API key routing: already stored in `settings.anthropic_api_key` — must be reused, not duplicated

## Acceptance Criteria

- [ ] "Generate a professional PPT from my dissertation" completes end-to-end with claude-sonnet-4-6 — `.pptx` file downloadable
- [ ] Same request completes with gpt-4.1
- [ ] Same request completes with gemini-2.5-flash
- [ ] `finish_reason=length` during execute_code JSON does NOT occur on a 300-line Python payload with claude-sonnet-4-6
- [ ] LangSmith shows cache hit (cached_input_tokens > 0) on Anthropic calls after the first turn
- [ ] After analyze_document, ≤1 additional search_documents call before execute_code
- [ ] max_iterations=15 for general mode; force_no_tools fires only on iteration 14
- [ ] Fallback message never contains "Please try rephrasing your question"
- [ ] Settings AI Model tab with Anthropic active shows no output-token or context-depth sliders
- [ ] Settings AI Model tab with OpenRouter active shows all three sliders (no regression)
- [ ] `_resolve_max_tokens` with Anthropic provider + stale `llm_max_output_tokens=4096` returns 32,768 for claude-sonnet-4-6 (unit test)
- [ ] Switching provider from OpenRouter→Anthropic→OpenRouter round-trip in Settings does not lose the OpenRouter slider values
- [ ] 327 existing unit tests pass
- [ ] OpenAI (gpt-4.1) behavior and latency is unchanged — no regression on retrieval-only Q&A

## Ambiguity Report

| Dimension           | Score | Min  | Status | Notes                                                              |
|---------------------|-------|------|---------|--------------------------------------------------------------------|
| Goal Clarity        | 0.97  | 0.75 | ✓      | Explicit provider comparison; 11 requirements; settings principle clear |
| Boundary Clarity    | 0.95  | 0.70 | ✓      | Native=hardcoded, OpenRouter/Ollama=user control — explicit rule   |
| Constraint Clarity  | 0.90  | 0.65 | ✓      | anthropic package; 327 tests; same SSE interface; no UI regression |
| Acceptance Criteria | 0.95  | 0.70 | ✓      | 15 pass/fail checks; round-trip settings test named                |
| **Ambiguity**       | 0.06  | ≤0.20| ✓      |                                                                    |

## Interview Log

| Round | Perspective      | Question                                              | Decision locked                                                                       |
|-------|------------------|------------------------------------------------------|---------------------------------------------------------------------------------------|
| auto  | Researcher       | What do providers do in their own products?          | No token reduction; native SDK; context via sliding window; no iteration limit        |
| auto  | Researcher       | What failure modes are confirmed?                    | Mode A: token truncation; Mode B: empty response after large tool result              |
| auto  | Simplifier       | What is the irreducible core fix?                    | Remove 20% reduction + native Anthropic SDK + remove tool result character caps       |
| auto  | Boundary Keeper  | What is explicitly NOT this phase?                   | LiteLLM, OpenRouter parity, sub-agent redesign, frontend changes                     |
| auto  | Failure Analyst  | What regresses if we get this wrong?                 | OpenAI Q&A path; must test retrieval-only tasks unchanged                             |
| user  | Direction        | "We should not care about budget"                    | No artificial token reductions; replicate provider-native behavior; accuracy first   |

---

*Phase: 054-reliable-agentic-generation*
*Spec created: 2026-04-26*
*Next step: /gsd-discuss-phase 54 — implementation decisions (AnthropicProvider class design, streaming event mapping, Google native vs compat decision, context trimming tuning)*
