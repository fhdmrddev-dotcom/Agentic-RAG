# Phase 52: Multi-Provider Model Routing - Context

**Gathered:** 2026-04-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Make all LLM roles (main chat, sub-agent, title drafter, follow-up suggester) provider-aware and resilient: eliminate cross-provider 404 errors via save-time validation, add graceful fallback with user notification for unavailable models, and expose resolved model names for each agent role in Settings. No schema changes. Config-driven via existing settings_override.json infrastructure.

</domain>

<decisions>
## Implementation Decisions

### Cross-Provider Sub-Agent Model Fix (MDL-01)

- **D-01:** **Enforcement mechanism: validate on Settings save.** When the user saves `sub_agent_model` in the Settings UI, the backend validates that the model ID exists in the active provider's `available_models` list (as configured in `{provider}_models` env var or override). If the model is not in that list, the save is rejected.
- **D-02:** **Error display: block save + inline error.** The Settings UI shows an inline error under the sub-agent model dropdown field: "Model [X] is not available for provider [Y]." The Save button stays disabled until the field is corrected or cleared. Pattern matches existing API key validation in the Settings page.
- **D-03:** **No runtime guard.** Only save-time validation — the assumption is that valid state in `settings_override.json` means the override is always provider-appropriate. No additional call-site check needed.
- **D-04:** **Provider switch does NOT auto-clear the field.** The user explicitly chose to override — clearing it silently on provider switch would be unexpected. The validation error at the next Save is sufficient.

### Fallback Behavior for Unavailable Models (MDL-04)

- **D-05:** **Trigger: 404 errors only.** Fallback fires when the provider returns HTTP 404 or a "model not found" / "invalid model" error. Auth errors (401/403), rate limits (429), and server errors (5xx) surface directly — they indicate a different problem requiring user action.
- **D-06:** **Fallback model: `_SUB_AGENT_MODEL_DEFAULTS[active_provider]`.** On 404, retry the call using the provider's default cheap model. If `_SUB_AGENT_MODEL_DEFAULTS[provider]` is empty (e.g., openrouter, ollama), fall back to `user_settings.llm_model` (same as main model).
- **D-07:** **User notification: `fallback_model` SSE event.** Emit a new `fallback_model` event with payload `{original_model, fallback_model}`. Frontend shows a brief toast: "Model [X] unavailable — using [Y]." Follows the existing `skill_activated` SSE event pattern.
- **D-08:** **Scope: sub-agent calls only.** Fallback applies to `run_sub_agent()`, `generate_suggestions()`, and `generate_thread_title()`. The main chat model (in `event_stream()`) errors surface directly — the user actively chose that model and should see the failure.

### Settings UI — Model Role Visibility (MDL-05)

- **D-09:** **Display: two read-only info rows** under the existing sub-agent model dropdown on the AI Model tab's "Context & Sub-Agent" section (Phase 51 placement). Rows are:
  - `Title drafting: [resolved model] (auto)` when sub_agent_model is blank
  - `Follow-up suggestions: [resolved model] (auto)` when sub_agent_model is blank
  - Shows the actual model name when an override is set: `Title drafting: gpt-4.1-nano`
- **D-10:** **Resolved model name in Settings GET.** The `GET /api/settings` response must include a new `resolved_sub_agent_model` field exposing what model would be used if a call happened now (accounting for override, provider defaults, and fallthrough to main model). Frontend uses this to populate the labels.
- **D-11:** **No separate dropdowns for title/follow-up.** They share the sub-agent model — per-role controls would add complexity without meaningfully different use cases. Read-only labels are sufficient.

### MDL Requirements Definition

- **D-12:** **MDL-01** (save-time): Sub-agent model override cannot be saved if the model ID is not in the active provider's configured model list — Settings blocks save with inline error.
- **D-13:** **MDL-02** (verification): Title-drafter and follow-up-suggester already use `_SUB_AGENT_MODEL_DEFAULTS[active_provider]`. Verify they are functioning correctly across all configured providers. No new code unless a bug is found.
- **D-14:** **MDL-03** (verification only): Message history is preserved when the user switches chat models mid-conversation. Messages are stored in DB by thread_id — no code change needed; planner writes a verification test confirming this.
- **D-15:** **MDL-04**: 404-triggered fallback with `fallback_model` SSE event (as described above).
- **D-16:** **MDL-05**: Read-only label rows showing resolved model for title/follow-up, backed by `resolved_sub_agent_model` field in Settings GET response.
- **D-17:** **OpenRouter unchanged**: `_SUB_AGENT_MODEL_DEFAULTS["openrouter"] = ""` stays empty — falls through to main model. No hardcoded cheap model added (varies per user's OpenRouter subscription).

### Claude's Discretion

- Toast notification styling for the `fallback_model` SSE event (follow existing toast/notification patterns in the frontend)
- Exact inline error message wording for the Settings save validation
- Whether to expose `resolved_sub_agent_model` as a top-level field or nested under a new `agent_roles` object in the settings response
- How to detect "model not found" vs other 404s across providers (OpenAI, Anthropic, Google error shapes differ slightly — use message string matching as fallback to status code)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — MDL-01 through MDL-05 need to be added here before or during planning

### Backend — Model Routing
- `backend/app/services/sub_agent_service.py` — `run_sub_agent()`, `_SUB_AGENT_MODEL_DEFAULTS`, `_is_generation_task()`. The cross-provider fix (D-01 validation) and 404 fallback (D-06/D-07) land here.
- `backend/app/services/suggestion_service.py` — `generate_suggestions()`. Same fallback pattern applies.
- `backend/app/api/threads.py` — `generate_thread_title()`. Same fallback pattern applies.
- `backend/app/services/openai_service.py` — `get_llm_client()`, `_resolve_max_tokens()`, `_uses_max_completion_tokens()`. Fallback retry uses the same client.
- `backend/app/config.py` — `_SUB_AGENT_MODEL_DEFAULTS`, `PROVIDER_CONTEXT_DEFAULTS`. Reference for provider defaults.

### Backend — Settings
- `backend/app/models/user_settings.py` — `UserEffectiveSettings`, `load_app_settings()`, `save_override()`. The new `resolved_sub_agent_model` field (D-10) and save-time validation (D-01) touch this layer.
- `backend/app/api/settings.py` — Settings GET/PATCH routes. The new `resolved_sub_agent_model` field in the GET response and validation logic in the PATCH route land here.

### Frontend
- `frontend/src/pages/SettingsPage.tsx` — AI Model tab, "Context & Sub-Agent" section. Read-only label rows (D-09) go here, under the existing sub-agent model dropdown added in Phase 51.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `_SUB_AGENT_MODEL_DEFAULTS` in `sub_agent_service.py` — already maps `active_provider` to cheap model; fallback uses this same dict
- `skill_activated` SSE event pattern in `threads.py` — `fallback_model` SSE event follows the same `data: {json}\n\n` shape
- `save_override()` in `user_settings.py` — all settings writes go here; validation before this call
- `override_provider()` in `user_settings.py` — shows how provider-scoped credential switching works
- `NumberInput` / `Toggle` components in `SettingsPage.tsx` — styling reference for new read-only label rows

### Established Patterns
- 404 detection: the OpenAI Python SDK raises `openai.NotFoundError` for 404s — catch this specific exception class, not generic `Exception`
- SSE event emission: `yield f"data: {json.dumps({'type': 'fallback_model', ...})}\n\n"` in `event_stream()`
- Settings save: PATCH `/api/settings` with partial update dict → `save_override(updates)` in `user_settings.py`
- Provider validation: `available_models` list on `LLMProvider` already holds the per-provider model list — use this for save-time validation

### Integration Points
- `GET /api/settings` → must return `resolved_sub_agent_model` (new field) for the frontend labels
- `PATCH /api/settings` → sub_agent_model field validation against `available_models` for active provider
- `run_sub_agent()` / `generate_suggestions()` / `generate_thread_title()` → try/except `openai.NotFoundError` → retry with fallback model → yield fallback SSE event (or return for non-streaming callers)
- `event_stream()` in `threads.py` → receives and re-yields the `fallback_model` event from sub-agent calls

</code_context>

<specifics>
## Specific Ideas

- "Resolved model" for labels: when `sub_agent_model` override is blank, call the same resolution logic used in `run_sub_agent()` and return the result as `resolved_sub_agent_model` in settings GET. This avoids duplicating logic.
- For `generate_thread_title()` and `generate_suggestions()` fallback: these are non-streaming callers, so they can't yield SSE events directly. The fallback + notification should be handled by the streaming `event_stream()` in `threads.py` that wraps the sub-agent call — or the non-streaming functions return a `(result, fallback_used)` tuple so the caller can emit the SSE event.
- Validation at save: the active provider's model list (`LLMProvider.models`) is already built in `_build_providers()`. Re-use it in the PATCH handler to validate `sub_agent_model`.

</specifics>

<deferred>
## Deferred Ideas

- Per-provider sub_agent_model storage (keyed dict in settings_override.json) — cleaner long-term but requires schema migration; deferred until Settings page gets a more substantial redesign
- Separate title_model and followup_model dropdowns — would allow per-role tuning; deferred (read-only labels are sufficient for v2.4)
- Fallback for main chat model (extend to MDL-04 scope) — user decision: sub-agent only for this phase
- Hardcoded cheap model for OpenRouter `_SUB_AGENT_MODEL_DEFAULTS` — varies by user subscription; left as ""
- Runtime provider-mismatch guard at call time — save-time validation is sufficient; no second line of defense

</deferred>

---

*Phase: 052-multi-provider-model-routing*
*Context gathered: 2026-04-25*
