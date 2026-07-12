---
status: complete
phase: 149-model-registry-discovery
source: [149-VERIFICATION.md, 149-VALIDATION.md]
started: 2026-07-12
updated: 2026-07-12
---

## Current Test

[round-2 re-test complete 2026-07-13 — rows 4/5/7/12 pass live; row 1 = 1 major issue (structured-path injection gap, diagnosed); +1 incidental minor (suggestion think-leak). Registry state fully restored: claude-haiku re-enabled, gpt-4.1 deprecated=false + reason preserved, discovery proposals discarded, org default MiniMax-M2.5-highspeed untouched.]

> Full step-by-step instructions for every row live in **`149-VALIDATION.md` → Manual-Only Verifications**.
> This file is the tracking surface (surfaces in `/gsd:progress` + `/gsd:audit-uat`); run it via `/gsd:verify-work 149`.
> **Prerequisite:** log in at `http://localhost:5173/` as an operator, open **Control Room → Model Registry** (now unlocked), keys for all 4 providers configured in Settings.

## Tests

### 1. Cross-provider · OpenAI — gpt-5.6 `native_tools` flip (no-restart proof, SC#1)
expected: toggling `native_tools` OFF in the tab makes the next tool-carrying chat route through the prompt-injected path (still works) within ~30s TTL, no backend restart; toggle back ON → native tools again.
result: issue
reported: "Routing half PASSES (verified: override persisted, live seam returns STRUCTURED for gpt-5.4-mini vs NATIVE control, no restart). But 'still works' half FAILS: 'list the top-level folders' produced a hallucinated non-answer ('No folder listing is available from the current context') with ZERO tool calls fired (runs 6eaeac19/af51b538: tool_calls NULL, 54 output tokens, no error)."
severity: major
note: "Toggle-back-ON half PASSES — native tool call fired (folder list, 1 step, 66ms) after re-enable. Regression contained to the OFF direction on compat providers; default path intact."
round1: issue (fix landed: 56945cca DB-aware resolve_calling_mode — routing now works; NEW gap found in the structured path itself)
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
result: pass
evidence: "Round-2 live (user-driven): deepseek/deepseek-chat Timeout edit lands (OVR + receipt, no red Not Found); Reset returns to 600s DEF."
round1: issue (fixed: 3afc53e3 {model_id:path} routes + e41195ce empty-id 422)
reported: "Chrome-MCP driven live: editing deepseek/deepseek-chat Timeout→450 fails — red 'Not Found' renders in-row, value stays 600s DEF. Write never lands."
severity: major
root_cause: "OpenRouter model IDs are namespaced (vendor/model — contain a slash). Frontend correctly sends encodeURIComponent(modelId) → /admin/models/deepseek%2Fdeepseek-chat, but per the ASGI spec uvicorn hands Starlette the DECODED path (deepseek/deepseek-chat), and the routes PATCH /models/{model_id} + PUT /models/{model_id}/lock match a single path segment only → no route → FastAPI default 404 'Not Found'. Proven via TestClient probe: gpt-4o route-matches; deepseek%2Fdeepseek-chat and the lock route both 404. ALL 9 OpenRouter rows are uneditable/unlockable/undisableable; discovery-confirm writes for namespaced IDs would fail identically."

### 5. Enable/disable coupling is REAL across the picker (two-layer pattern) — regression re-check
expected: disabling a model per provider flips its chip to `✕ hidden` and removes it from chat + Settings pickers; re-enable returns it; no disabled model is ever selectable.
result: pass
evidence: "Round-2 live (user-driven): disable removes from both pickers, re-enable restores. Also exercised live during row 7 (claude-haiku hidden/in-picker coupling + 6-shown-to-users count)."
round1: pass
evidence: "Chrome-MCP driven live for OpenAI (gpt-4o-mini), Anthropic (claude-opus-4-6), Google (gemini-2.5-flash-lite): each disable flipped the chip to ✕ hidden + greyed the row's lock control + updated the group header count (17→16 shown); /settings/providers (the single seam feeding BOTH chat + Settings pickers) confirmed all 3 excluded; chat dropdown visually confirmed gpt-4o-mini gone. Re-enable returned all 3 (payload re-verified). CAVEAT: the OpenRouter leg is untestable — its Enabled toggle hits the slash-ID 404 (see Test 4 gap); fold into that fix."

### 6. Multi-tool — 2+ tools in one prompt after a capability edit
expected: `search_documents` + `execute_code` both fire in one turn; edited capability honored; no tool dropped.
result: pass
evidence: "Chrome-MCP driven live: edited gpt-5.4 Context=150000 (150k OVR + ✎ recorded), then ONE prompt on gpt-5.4 fired write_todos → search_documents → write_todos → execute_code → write_todos (messages.tool_calls, thread cdb3a21b); run completed (840 out tokens, 5 steps, 1m28s run card ✓ done); answer synthesized both tool results (5 hits, avg title length 69.00); no tool dropped."

### 7. Parallel-thread — Thread A streaming while Thread B hits a just-disabled model (D-149-10) — CRITICAL re-test
expected: Thread A completes uninterrupted; Thread B falls back to the org default with the honest inline `model_disabled_fallback` notice naming both models; no silent swap.
result: pass
evidence: "Round-2 live (Claude-driven via Chrome, 2026-07-12 20:23Z): Thread B (pill=claude-haiku-4-5, model disabled mid-flight, 65s TTL wait) got a real answer WITH the inline amber notice naming both models (claude-haiku-4-5-20251001 was disabled by your administrator — this reply used MiniMax-M2.5-highspeed). Wire proof: runs c750bd38 = model MiniMax-M2.5-highspeed / provider minimax / completed / no error (round-1 recorded anthropic). Thread A (deepseek-v4-flash, 4-step run w/ doc+web search) streamed and completed simultaneously, untouched (runs 88864ef0). Registry state restored after test."
note: "NEW minor issue observed during this row: follow-up suggestion chips leaked raw <think> reasoning from MiniMax — recorded as its own gap below."
round1: issue (fixed: 6dc1a8dd + 464ac9c1 + CR-01 46c09382 effective model on the wire)
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

### 12. Light regression sweep — rows 2/3/6/8/9/10/11 spot-check
expected: one representative action from each previously-passing row still behaves (Anthropic cap edit honored; Google edit honored; multi-tool prompt works; long-thread works; discovery provenance labels truthful — a partial-provenance Google model now reads "returned some capabilities" not "IDs only"; deprecated-reason input commits on Enter and cancels on Escape; lock-disabled-model still refused). No need to re-drive all evidence — quick pass through the registry tab + one chat.
result: pass
evidence: "Round-2 live (Claude-driven): Discovery run = propose-only banner + 418 changes (402 new/16 changed/2 vanished) held for confirm, DISCARDED clean; per-model provenance three-way label all present in one run (openrouter returned-full-capabilities, openrouter returned-some-capabilities, openai returned-IDs-only); provider run cards honest (only google+openrouter capabilities-check); new models never auto-enabled. Deprecated-reason: preserved reason read back on re-check (gpt-4.1 superseded-by-gpt-5.x), Enter commits (DB row confirmed exact string + recorded receipt), deprecated-not-disabled held (enabled stayed true), state restored exactly. Registry sanity: OVR chips + Reset (gemini-3.5-flash 100k, gpt-5.4 150k), DEF tags, WR-05 honest-lock Tools gated on anthropic/google rows. Chat coverage this session: openai native (folder tool), deepseek 4-step multi-tool run, minimax fallback — 3 providers live."


## Summary

total: 12
passed: 11 (rows 2/3/6/8/9/10/11 round-1 retained; rows 4/5/7/12 round-2 live)
issues: 1 major (row 1: structured path never pre-injects tool instructions for DB-flipped models) + 1 incidental minor (suggestion think-leak, gap below)
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "SC#1 — toggling native_tools in the registry changes the next request's tool-calling path (native ↔ prompt-injected) with no restart"
  status: fix-landed
  fix: "plan 08 (56945cca DB-aware resolve_calling_mode) — re-test live"
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
  status: fix-landed
  fix: "plan 08 (3afc53e3 {model_id:path} converter) + review fix e41195ce (empty-id 422) — re-test live"
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
  status: fix-landed
  fix: "plan 09 (6dc1a8dd provider re-resolve + 464ac9c1 inline notice) + review fixes 46c09382 (CR-01 effective model on the wire) / 7b3e82de / beb32917 — re-test live"
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
  status: fix-landed
  fix: "plan 10 (85ebf452 per-field provenance suffix) — re-test live"
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
  status: fix-landed
  fix: "plan 10 (33a90f26 Enter-commit/Escape-cancel) + review fix 3214bbbf (dirty check + busy-window) — re-test live"
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

- truth: "SC#1 second half — with native_tools OFF the chat STILL WORKS via the prompt-injected (structured) path"
  status: failed
  reason: "User reported: 'list the top-level folders' → hallucinated 'No folder listing is available from the current context'; DB shows zero tool_calls on both turns (runs af51b538 20:00Z + 6eaeac19 20:04Z, gpt-5.4-mini, completed, no error). Routing itself verified STRUCTURED (override row native_tools=false source=db_override; live resolve_calling_mode seam returns STRUCTURED vs NATIVE control)."
  severity: major
  test: 1
  round: 2
  root_cause: "agent_loop.py pre-injection gate `_needs_pre_injection` (line ~1560) is `active_provider == 'openrouter' AND openrouter_tool_strategy == 'xml'` ONLY. A DB-override-flipped model on any other compat provider (openai here) gets NO TOOL_USAGE_INSTRUCTIONS injected before the first stream, and open_stream's STRUCTURED branch (openai_service.py ~1810) deliberately omits the native tools param — so the model has NO tool mechanism at all on the first call. The post-stream fallback injection (agent_loop.py ~2046) only takes effect 'next iteration', but with no parsed tool call there IS no next iteration — circular, never activates for a fresh run. Net: native_tools=False on an openai/compat model silently strips ALL tools + invites hallucinated answers."
  artifacts:
    - path: "backend/app/services/agent_loop.py"
      issue: "_needs_pre_injection (~1560) hardcodes openrouter+xml; fallback injection (~2046) is post-first-call and circular for fresh runs"
    - path: "backend/app/services/openai_service.py"
      issue: "STRUCTURED branch in create_adaptive_streaming_chat (~1810) omits tools param by design — correct, but relies on caller pre-injection that never happens for DB-flipped models"
  missing:
    - "Compute the effective calling mode BEFORE the first stream call and pre-inject TOOL_USAGE_INSTRUCTIONS when it resolves STRUCTURED for a compat-path provider: extend _needs_pre_injection to consult resolve_calling_mode(effective_model, user_settings) (the cache is warm — agent_loop already awaits get_model_capability_async before open_stream). Must EXCLUDE anthropic/google native-SDK dispatch (mirror the WR-05 boundary) and keep openrouter+xml behavior byte-identical. Add a test: DB native_tools=False on an openai model → first request's system prompt contains TOOL_USAGE_INSTRUCTIONS and parse_structured_tool_calls path can fire on iteration 1."
  debug_session: ""

- truth: "Follow-up suggestion chips contain only clean questions regardless of which model served the reply"
  status: failed
  reason: "Observed live during row 7: the MiniMax-served fallback reply follow-up chips rendered raw reasoning markup — chips read <think>, then two chain-of-thought sentences."
  severity: minor
  test: 7
  round: 2
  root_cause: "backend/app/services/suggestion_service.py generate_suggestions parses the raw completion content line-by-line (~line 97: content.split newline) with NO think/reasoning-markup stripping. Reasoning models served via the compat path (MiniMax here — the effective model after the disabled-model fallback, but equally any direct MiniMax/DeepSeek chat) emit think blocks inline in content; each think line becomes a question chip. The chat path separates reasoning via the compat adapter; the suggestion path bypasses that separation."
  artifacts:
    - path: "backend/app/services/suggestion_service.py"
      issue: "line-parse at ~97-98 has no think/reasoning strip before clamping to 3 questions"
  missing:
    - "Strip think blocks (and DSML-class reasoning residue) from suggestion completions before the line-parse — or reuse the compat adapter reasoning separation for the suggestion call. Add a unit test with a MiniMax-style think completion asserting only clean questions survive."
  debug_session: ""
