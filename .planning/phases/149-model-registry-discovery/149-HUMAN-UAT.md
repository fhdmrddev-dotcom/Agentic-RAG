---
status: diagnosed
phase: 149-model-registry-discovery
source: [149-VERIFICATION.md, 149-VALIDATION.md]
started: 2026-07-12
updated: 2026-07-12
---

## Current Test

[testing complete — 11/11 executed live via Chrome-MCP + DB/Redis evidence, 2026-07-12. All 3 issues root-caused during the session (diagnosis embedded). Registry state fully restored post-UAT: org default MiniMax-M2.5-highspeed unlocked; all Test toggles reset; only two benign context OVRs remain (gemini-3.5-flash=100k, gpt-5.4=150k) + gpt-4.1's preserved deprecated_reason.]

> Full step-by-step instructions for every row live in **`149-VALIDATION.md` → Manual-Only Verifications**.
> This file is the tracking surface (surfaces in `/gsd:progress` + `/gsd:audit-uat`); run it via `/gsd:verify-work 149`.
> **Prerequisite:** log in at `http://localhost:5173/` as an operator, open **Control Room → Model Registry** (now unlocked), keys for all 4 providers configured in Settings.

## Tests

### 1. Cross-provider · OpenAI — gpt-5.6 `native_tools` flip (no-restart proof, SC#1)
expected: toggling `native_tools` OFF in the tab makes the next tool-carrying chat route through the prompt-injected path (still works) within ~30s TTL, no backend restart; toggle back ON → native tools again.
result: issue
reported: "I chose GPT 5.4 mini and took Tools OFF, but it still called folder search + querying documents + executing code — the toggle appears to have no effect on routing."
severity: major
root_cause: "resolve_calling_mode (openai_service.py:1518) calls the SYNC get_model_capability (config.py:515), which has NO DB tier — it reads only the static MODEL_CAPABILITIES dict. gpt-5.4-mini is in that dict with native_tools=True (config.py:256), so the NATIVE path is chosen regardless of the DB override (model_capabilities_overrides.native_tools=False, confirmed persisted). The async, DB-aware get_model_capability_async (config.py:686) DOES overlay native_tools, but threads.py:1163 only uses it to resolve the PROVIDER, never the calling mode. Net: an operator toggling native_tools has zero effect on the next request's tool-calling path — SC#1's central 'no-restart proof' fails for native_tools specifically. Other caps (max_output clamp, timeout, enabled, deprecated) DO take effect via async/cache-aware paths; only native_tools routing is DB-blind."

### 2. Cross-provider · Anthropic — capability edit affects next request
expected: a smaller `max_output_tokens` caps the very next answer; Reset clears to built-in DEF and the cap lifts.
result: pass
evidence: "Chrome-MCP driven live: set claude-haiku-4-5-20251001 max_output=2000 (OVR tag + ✎ recorded receipt + DB row confirmed). Next request: essay truncated at output_tokens=2001 (runs table) with honest '[Response truncated — output token limit reached]' notice. Reset → 64k DEF (DB max_output_tokens=NULL). Same ask again: output_tokens=4611, full essay with conclusion — cap lifted, no restart either way."

### 3. Cross-provider · Google — capability edit affects next request
expected: edited `gemini-*` capability honored on the next chat; picker shows the model per its `enabled` state.
result: pass
evidence: "Chrome-MCP driven live: set gemini-3.5-flash Context=100000 (100k OVR + ✎ recorded; DB context_window_tokens=100000). Next chat on google/gemini-3.5-flash streamed to completion (runs: completed, 63 output tokens); model shown in chat picker per enabled state."

### 4. Cross-provider · OpenRouter — capability edit affects next request
expected: edited `llm_call_timeout_seconds` honored; disabling the model removes it from BOTH pickers on next fetch.
result: issue
reported: "Chrome-MCP driven live: editing deepseek/deepseek-chat Timeout→450 fails — red 'Not Found' renders in-row, value stays 600s DEF. Write never lands."
severity: major
root_cause: "OpenRouter model IDs are namespaced (vendor/model — contain a slash). Frontend correctly sends encodeURIComponent(modelId) → /admin/models/deepseek%2Fdeepseek-chat, but per the ASGI spec uvicorn hands Starlette the DECODED path (deepseek/deepseek-chat), and the routes PATCH /models/{model_id} + PUT /models/{model_id}/lock match a single path segment only → no route → FastAPI default 404 'Not Found'. Proven via TestClient probe: gpt-4o route-matches; deepseek%2Fdeepseek-chat and the lock route both 404. ALL 9 OpenRouter rows are uneditable/unlockable/undisableable; discovery-confirm writes for namespaced IDs would fail identically."

### 5. Enable/disable coupling is REAL across the picker (two-layer pattern)
expected: disabling a model per provider flips its chip to `✕ hidden` and removes it from chat + Settings pickers; re-enable returns it; no disabled model is ever selectable.
result: pass
evidence: "Chrome-MCP driven live for OpenAI (gpt-4o-mini), Anthropic (claude-opus-4-6), Google (gemini-2.5-flash-lite): each disable flipped the chip to ✕ hidden + greyed the row's lock control + updated the group header count (17→16 shown); /settings/providers (the single seam feeding BOTH chat + Settings pickers) confirmed all 3 excluded; chat dropdown visually confirmed gpt-4o-mini gone. Re-enable returned all 3 (payload re-verified). CAVEAT: the OpenRouter leg is untestable — its Enabled toggle hits the slash-ID 404 (see Test 4 gap); fold into that fix."

### 6. Multi-tool — 2+ tools in one prompt after a capability edit
expected: `search_documents` + `execute_code` both fire in one turn; edited capability honored; no tool dropped.
result: pass
evidence: "Chrome-MCP driven live: edited gpt-5.4 Context=150000 (150k OVR + ✎ recorded), then ONE prompt on gpt-5.4 fired write_todos → search_documents → write_todos → execute_code → write_todos (messages.tool_calls, thread cdb3a21b); run completed (840 out tokens, 5 steps, 1m28s run card ✓ done); answer synthesized both tool results (5 hits, avg title length 69.00); no tool dropped."

### 7. Parallel-thread — Thread A streaming while Thread B hits a just-disabled model (D-149-10)
expected: Thread A completes uninterrupted; Thread B falls back to the org default with the honest inline `model_disabled_fallback` notice naming both models; no silent swap.
result: issue
reported: "Live scenario driven end-to-end: Thread A (haiku long essay) kept streaming and completed uninterrupted (3390 out tokens) after haiku was disabled mid-flight; Thread B (sent on the just-disabled haiku) fell back to the org default MiniMax-M2.5-highspeed and answered fine — but NO fallback notice appeared anywhere in the chat. The swap was silent."
severity: major
root_cause: "Backend half of D-149-10 works: Redis run stream carries the emitted event {type:'model_disabled_fallback', disabled_model:'claude-haiku-4-5-20251001', fallback_model:'MiniMax-M2.5-highspeed', message:'…disabled by your administrator…'} (run 1c4c7b4a). Frontend has ZERO handler: rg 'model_disabled_fallback' over frontend/src returns nothing — the SSE event is silently dropped by the stream consumer, so the user sees a silent model swap, the exact outcome D-149-10 bans. Secondary wart: B's runs row recorded provider='anthropic' with model='MiniMax-M2.5-highspeed' — provider bookkeeping not re-resolved after fallback (routing itself was correct)."

### 8. Long-message — ≥50 prior messages / ≥5 KB prompt on an edited model
expected: long turn streams to completion honoring the edited capability; no truncation surprise beyond the configured limit; elapsed status never vanishes.
result: pass
evidence: "Chrome-MCP driven live: 7.7 KB (7,860-char) prompt on gpt-5.4 (carrying the Test-6 150k Context OVR). Run completed: 9,387 input tokens / 121 out; 3-bullet answer + follow-ups rendered; long user prompt clamped with 'Read more' (Phase 128 clamp); running pill + stop control present during stream, clean idle on completion. No truncation surprise, no vanished status."

### 9. Discovery propose-only (SC#3) — capabilities ✓ vs IDs-only amber "you set it"
expected: Google + OpenRouter = "capabilities ✓"; OpenAI/Anthropic/others = "IDs only"; every un-returned field is an amber "unknown — you set it" input; errored provider shows verbatim error (excluded-not-failed); no-key = "no key — skipped"; a NEW model's Enable-now is disabled until every capability is filled — never auto-enabled.
result: pass
evidence: "Live Run discovery against all 8 keyed providers → 418 changes (402 new · 16 changed · 2 vanished), nothing applied until confirm. Provider run cards: google + openrouter = 'capabilities ✓' (highlighted), openai/anthropic/deepseek/moonshot/zhipu/minimax = 'IDs only' — the exact SC#3 asymmetry. New-model cards: empty 'set…' context/max-out inputs + tools 'unknown' dropdown + Enable-now DISABLED with '⚠ set the unknown fields — it will NOT be auto-enabled'. Changed group shows honest old→new diffs from OpenRouter-returned caps (65,536→384k; tools none→✓native). Vanished = 'No longer offered' flagged-not-deleted with Mark-deprecated/Disable/Keep-as-is + 'never auto-deleted — you decide' footnote. Discarded without applying. (No-key/errored-provider legs unobservable live — all 8 keyed, none errored; unit-covered.) COSMETIC: google per-model cards read 'returned IDs only' while their token limits ARE auto-filled green — per-model suffix contradicts the provider card; label-only bug."

### 10. Deprecated marker stays selectable (deprecated ≠ disabled, D-149-04)
expected: toggling `deprecated` ON shows the badge in BOTH Settings AND the chat composer picker (chat-badge wiring landed post-verification, commit `a31121ee`) yet the model stays selectable (`✓ in picker`); toggle OFF clears the badge.
result: pass
evidence: "Chrome-MCP driven live: gpt-4.1 deprecated ON → ✎ recorded, reason input appears, coupling chip UNCHANGED (✓ in picker), amber 'deprecated' badge rendered in the CHAT composer picker (IN-01 fix a31121ee confirmed live — /settings/providers carries deprecated_models:['gpt-4.1']), and the model remained SELECTABLE (selected it in the composer). Toggle OFF → deprecated_models:[] (badge clears) AND IN-02 confirmed: deprecated_reason 'superseded by gpt-5.x' PRESERVED in DB after toggle-off. Settings-picker leg verified via the same FullAppSettings channel (active-provider-scoped pill row not flipped to OpenAI to avoid churning the org active provider). NIT (cosmetic): the reason input commits on blur only — Enter does not commit (numeric cells do); first Enter-typed reason was silently lost."

### 11. Lock-a-disabled-model refusal (no dead default, D-149-09 lock path)
expected: 🔓 lock is gated on a disabled row (courtesy tooltip); locking a model then disabling it is refused with an in-row 409 ("unlock it first" / "pick a new default first"); locking a disabled model via the seam is refused 409 ("enable it first").
result: pass
evidence: "Chrome-MCP driven live: (a) courtesy gate observed in Test 5 — disabled gpt-4o-mini row's lock control greyed/inert; (b) locked gpt-4o as org default (ORG DEFAULT tag + '✓ in picker · locked' chip + ✎ recorded; app_settings llm_model='gpt-4o', llm_model_locked=true) then clicked its Enabled toggle → in-row red refusal 'This model is locked as the org default — unlock it first.', toggle unchanged, nothing written; (c) seam leg: disabled gpt-4o-mini then PUT .../lock → 409 {'detail':'This model is disabled — enable it first.'}. Unlock (204) + full state restore verified (org default back to MiniMax-M2.5-highspeed, all toggles restored)."

## Summary

total: 11
passed: 8
issues: 3
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "SC#1 — toggling native_tools in the registry changes the next request's tool-calling path (native ↔ prompt-injected) with no restart"
  status: failed
  reason: "User reported: toggled Tools OFF on gpt-5.4-mini; tools still fired natively — no routing change. Confirmed via DB (override persisted native_tools=false) + source trace."
  severity: major
  test: 1
  root_cause: "resolve_calling_mode() → sync get_model_capability() reads only static MODEL_CAPABILITIES (DB-blind). gpt-5.4-mini static native_tools=True wins; the DB override is never consulted for the calling-mode decision. The async DB-aware get_model_capability_async overlays native_tools but is used only for provider resolution (threads.py:1163), not routing."
  artifacts:
    - path: "backend/app/services/openai_service.py"
      issue: "resolve_calling_mode (line 1518) calls sync get_model_capability (line 1520) + drives native-vs-structured tools at line ~1702"
    - path: "backend/app/config.py"
      issue: "sync get_model_capability (line 515) has no DB tier; async overlay (686-718) is DB-aware but not used for calling mode"
    - path: "backend/app/api/threads.py"
      issue: "get_model_capability_async result (line 1163) used only for provider, not calling mode; resolve_calling_mode called sync inside create_adaptive_streaming_chat"
  missing:
    - "Make the calling-mode decision DB-aware: either resolve the mode via get_model_capability_async in threads.py and thread it into create_adaptive_streaming_chat, OR give resolve_calling_mode an async DB-aware variant that consults model_capabilities_overrides.native_tools."
  debug_session: ""

- truth: "OpenRouter (namespaced vendor/model IDs) rows are editable/lockable like every other provider's rows"
  status: failed
  reason: "User-visible: in-row red 'Not Found' on any OpenRouter capability edit; value never changes. Confirmed via TestClient probe — %2F-encoded id 404s on both PATCH and PUT lock routes."
  severity: major
  test: 4
  root_cause: "PATCH /admin/models/{model_id} and PUT /admin/models/{model_id}/lock use single-segment path params. Uvicorn decodes %2F→/ before Starlette routing (ASGI spec), so namespaced IDs never match. Needs the Starlette {model_id:path} converter (works with a trailing /lock literal) or an id-in-body/query redesign."
  artifacts:
    - path: "backend/app/api/admin.py"
      issue: "route decorators at lines 1061 (@router.patch('/models/{model_id}')) and 1224 (@router.put('/models/{model_id}/lock'))"
    - path: "frontend/src/lib/api.ts"
      issue: "setModelCapability/setModelLock already encodeURIComponent correctly (line 4168) — no frontend change needed, but re-verify after backend fix"
  missing:
    - "Change both routes to {model_id:path}; add regression tests with a namespaced id (deepseek/deepseek-chat) exercising PATCH + lock + the discovery-confirm write path."
  debug_session: ""

- truth: "D-149-10 — Thread B on a just-disabled model shows the honest inline model_disabled_fallback notice naming BOTH models (no silent swap)"
  status: failed
  reason: "User-visible: no notice rendered; swap was silent. Backend emit verified present in Redis run stream (run 1c4c7b4a) with both model names + admin message."
  severity: major
  test: 7
  root_cause: "Frontend never consumes the model_disabled_fallback SSE event — no handler exists anywhere in frontend/src (rg returns 0 hits). The stream consumer drops unknown event types silently. Secondary: runs.provider not re-resolved after fallback (row says anthropic for a MiniMax-served run)."
  artifacts:
    - path: "frontend/src/providers/StreamsProvider.tsx"
      issue: "run-stream event consumer has no model_disabled_fallback case (exact consumer seam to confirm at fix time)"
    - path: "frontend/src/components/chat/MessageItem.tsx"
      issue: "no inline-notice rendering for the fallback event"
    - path: "backend/app/api/threads.py"
      issue: "register_run_start records the pre-fallback provider; re-resolve provider for the effective model (minor)"
  missing:
    - "Wire the SSE event through the stream consumer into an inline chat notice naming both models (per sketch/DECISIONS wording); component test + a live UAT re-run."
    - "Record the post-fallback provider on the runs row (minor honesty fix)."
  debug_session: ""

- truth: "Discovery per-model cards label capability provenance consistently with the provider run card"
  status: failed
  reason: "Google new-model cards read 'returned IDs only' while their token limits ARE provider-returned and auto-filled green; the google provider card correctly says 'capabilities ✓'. Label-only contradiction."
  severity: cosmetic
  test: 9
  root_cause: "Per-model provenance suffix appears hardcoded/uniform instead of derived from which fields were provider-returned."
  artifacts:
    - path: "frontend/src/components/admin/ModelDiscoveryPanel.tsx"
      issue: "per-model card suffix text"
  missing:
    - "Derive the per-model suffix from actual field provenance (or drop it and rely on the provider card + green fills)."
  debug_session: ""

- truth: "The deprecated-reason input commits like the numeric cells do"
  status: failed
  reason: "Enter in the reason input does NOT commit (typed reason silently lost); only blur commits. Numeric cells commit on Enter."
  severity: minor
  test: 10
  root_cause: "Reason input lacks the Enter-to-commit keydown handler the numeric inline-edit cells have."
  artifacts:
    - path: "frontend/src/components/admin/ModelRegistryTab.tsx"
      issue: "deprecated_reason input onKeyDown"
  missing:
    - "Add Enter-commits (and Esc-cancels) to the reason input, matching the numeric cell behavior."
  debug_session: ""
