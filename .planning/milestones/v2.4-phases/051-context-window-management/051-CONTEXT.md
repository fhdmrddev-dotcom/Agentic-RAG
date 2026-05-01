# Phase 51: Context Window Management - Context

**Gathered:** 2026-04-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Add task-complexity routing to the sub-agent (cheap model for analysis, capable model for generation tasks), expose context/output token controls in the Settings UI, add per-model info cards to the chat model selector, and upgrade token counting accuracy for OpenAI models using tiktoken. No schema changes — all config-driven via existing env-var infrastructure.

</domain>

<decisions>
## Implementation Decisions

### Sub-Agent Task Routing (CTX-01, CTX-02)
- **D-01:** Escalation trigger: output-format keyword matching on the `task` string passed to `run_sub_agent()`. Keywords: `pptx`, `powerpoint`, `presentation`, `report`, `document`, `pdf`, `spreadsheet`, `excel`, `csv export`. Case-insensitive. No verb matching — format keywords are unambiguous.
- **D-02:** Escalated model: use `user_settings.llm_model` (same as main agent). No new env var needed — escalation simply skips the cheap-model auto-selection and uses the orchestrator model directly.
- **D-03:** Output ceiling for escalated tasks: 32k tokens (32768). The existing sub-agent hardcodes 8192 — that stays as the default for analysis tasks. Generation tasks override to 32768.
- **D-04:** Simple analysis tasks (no format keywords matched) continue using `_SUB_AGENT_MODEL_DEFAULTS` as before — no change to existing cheap-model routing.

### Settings UI — Context & Sub-Agent Controls (CTX-03)
- **D-05:** Placement: new "Context & Sub-Agent" section on the existing AI Model tab, below the provider/model cards. Saves adding a 6th tab.
- **D-06:** Control type: sliders (HTML range inputs) for the two numeric settings, consistent with CTX-03's specification. A new `SliderInput` component added to SettingsPage alongside the existing `NumberInput`.
- **D-07:** Context history depth slider: maps to `context_window_max_tokens` in config. Range: 0–200,000, step 1,000, default 0 (= auto). Display a hint showing the current model's auto-resolved limit when the value is 0.
- **D-08:** Sub-agent output token slider: maps to a new `sub_agent_max_output_tokens` setting (added to config.py and Settings API). Range: 4,096–65,536, step 1,024, default 8,192. Generation tasks override this with min(32,768, slider_value) — but the slider default keeps generation ceiling at 32k or higher if user sets it.
- **D-09:** Sub-agent model override dropdown: maps to `sub_agent_model` env var equivalent. Dropdown shows available models for the active provider (same source as main model selector). Empty/blank = auto (cheapest). Saved alongside other AI Model settings.
- **D-10:** Save button: new sub-section uses the existing AI Model tab's Save button. No separate save handler needed.

### Model Info Card Design (CTX-04)
- **D-11:** Presentation: small info icon (ℹ, `Info` from lucide-react) placed to the right of each model name in the chat model selector dropdown (`MessageInput.tsx`). Hovering the icon triggers a compact popover/tooltip.
- **D-12:** Card fields: context window size, max output tokens, best-for label. Skip cost tier — too volatile and provider-dependent. Data populated from a static `MODEL_INFO` lookup object in frontend, keyed by model ID. For unknown models, show only what's available (graceful degradation — no info icon if model not in lookup).
- **D-13:** `MODEL_INFO` lookup lives in `src/lib/model-info.ts` — single source of truth for the frontend. Keys mirror `MODEL_CONTEXT_DEFAULTS` from backend `config.py`.

### Token Counting — tiktoken (CTX-05)
- **D-14:** Add `tiktoken` to `backend/requirements.txt` as an optional dependency. If `import tiktoken` fails, fall back silently to chars/4 heuristic with a single logged warning on startup.
- **D-15:** Only modify `estimate_tokens()` in `context_window.py`. When the active model is identified as an OpenAI model (model ID starts with `gpt-` or `o1` / `o3`), use tiktoken `cl100k_base` encoding. All other providers use chars/4.
- **D-16:** Token counting for sub-agent char cap (`sub_agent_max_chars`) stays as a char-based limit — tiktoken not used there since 600k chars already leaves plenty of headroom.

### Claude's Discretion
- Exact popover styling and positioning for the model info icon (follow existing shadcn/ui Popover/Tooltip patterns)
- Slider visual design (track color, thumb style) — match Deep Midnight theme
- Range slider step granularity for context_window_max_tokens beyond 200k (cap at 200k in UI)
- How to display "auto" state on context depth slider when value = 0 (could be a separate "Auto" toggle or just a 0-value label)
- tiktoken encoding choice for newer GPT-4.1 models (o200k_base vs cl100k_base) — use cl100k_base as specified in CTX-05

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §CTX — CTX-01 through CTX-05: full acceptance criteria for this phase

### Backend — Context & Sub-Agent
- `backend/app/services/context_window.py` — existing token estimation (chars/4), trim logic; this is what gets the tiktoken upgrade
- `backend/app/services/sub_agent_service.py` — existing sub-agent model selection and 8192 output cap; task routing logic goes here
- `backend/app/services/openai_service.py` — `_resolve_max_tokens()`, `_MODEL_OUTPUT_DEFAULTS`; escalated output ceiling must respect this resolution chain
- `backend/app/config.py` — `Settings` class (env vars), `MODEL_CONTEXT_DEFAULTS`, `_SUB_AGENT_MODEL_DEFAULTS`; any new config fields added here

### Frontend — Settings & Model Selector
- `frontend/src/pages/SettingsPage.tsx` — 5-tab Settings page; Context & Sub-Agent section goes on AI Model tab
- `frontend/src/components/chat/MessageInput.tsx` — chat model selector dropdown; model info icon/popover added here

### API Layer
- `backend/app/api/settings.py` — Settings API; any new fields (sub_agent_max_output_tokens) must be added to request/response models
- `backend/app/models/user_settings.py` — UserEffectiveSettings; check if sub-agent output tokens need to live here

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `NumberInput` component in `SettingsPage.tsx` — use as reference for new `SliderInput` styling
- `Toggle` component in `SettingsPage.tsx` — same pattern for any boolean in the new section
- `_SUB_AGENT_MODEL_DEFAULTS` dict in `sub_agent_service.py` — routing logic sits alongside this dict
- `_resolve_max_tokens()` in `openai_service.py` — escalated task output ceiling should go through this function's priority chain
- `Info` icon available from `lucide-react` — already imported in other components

### Established Patterns
- All numeric settings saved via `updateSettings()` API call and hydrated back via `hydrate()` — new sub-agent settings follow this exact pattern
- Per-tab Save handlers (e.g., `handleSaveAIModel`) — new section reuses the existing AI Model tab Save handler
- Config env vars in `config.py` are Pydantic `BaseSettings` fields — new `sub_agent_max_output_tokens: int = 8192` follows this pattern
- Model selection in `MessageInput.tsx` iterates `models.map((m) => ...)` — info icon added inside this map

### Integration Points
- `run_sub_agent()` receives `task: str` — keyword detection on this string, before model selection
- `estimate_tokens()` called from `trim_messages_to_fit()` and `estimate_messages_tokens()` — tiktoken upgrade only touches `estimate_tokens()`
- Settings API `/api/settings` GET and PATCH — new fields flow through here

</code_context>

<specifics>
## Specific Ideas

- "Same model as main agent" for escalation means: when escalating, use `user_settings.llm_model` (or fall back to `settings.llm_model` if user_settings is None)
- Model info lookup should degrade gracefully for unknown models — if model ID not in `MODEL_INFO`, don't show the info icon at all (avoid showing broken/empty cards)
- tiktoken fallback: log once at startup "tiktoken not available, using char heuristic" — not per-call

</specifics>

<deferred>
## Deferred Ideas

- Cost tier lookup per model — too volatile (pricing changes); deferred indefinitely
- tiktoken for non-OpenAI providers — not worth the extra encoding logic; chars/4 is sufficient for Anthropic/Google/OpenRouter
- Sub-agent output token override via UI for generation-specific ceiling — the 32k ceiling is hardcoded in routing logic; the slider covers the baseline output cap, not generation-task override
- Dynamic model metadata from provider APIs — would require API calls per model; static lookup is sufficient for v2.4

</deferred>

---

*Phase: 051-context-window-management*
*Context gathered: 2026-04-23*
