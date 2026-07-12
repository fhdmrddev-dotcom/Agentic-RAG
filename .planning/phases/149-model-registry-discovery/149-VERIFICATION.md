---
phase: 149-model-registry-discovery
verified: 2026-07-12T20:00:00Z
status: human_needed
score: 14/14 code-level must-haves verified (0 failed); 1 residual human-verification requirement
overrides_applied: 0
re_verification:
  previous_status: human_needed
  previous_score: "12/13 must-haves verified (1 partial/WARNING)"
  gaps_closed:
    - "Chat picker deprecated badge now wired (ChatArea.tsx → MessageInput.tsx via deprecated_models on getProviders()) — confirmed in current source, landed pre-live-UAT at commit a31121ee"
    - "SC#1 native_tools registry toggle is now DB-aware for every OpenAI-compat-routed provider (openai/deepseek/moonshot/zhipu/minimax/openrouter) — closes live-UAT Test 1 for those providers; Anthropic/Google rows are honestly gated (not silently inert) per WR-05"
    - "OpenRouter (and any namespaced vendor/model id) capability edit + lock now routes via {model_id:path} — closes live-UAT Test 4/5 OpenRouter leg"
    - "Disabled-model fallback is now honest end-to-end: frontend consumes model_disabled_fallback SSE and renders an inline notice AND (round-2 CR-01) the EFFECTIVE fallback model is the one actually sent on the wire (body.model rewritten before the agent loop reads it) — closes live-UAT Test 7 for both same-provider and cross-provider fallback shapes"
    - "Discovery per-model provenance label is now derived from real per-field counts (three-way full/IDs-only/partial) instead of a lying binary — closes live-UAT Test 9 label contradiction"
    - "Deprecated-reason input now has full Enter-commit/Escape-cancel parity with the numeric cells, plus a dirty check (no-op blur issues no write) and busy-window commit survival — closes live-UAT Test 10 lost-input gap"
  gaps_remaining:
    - "The above 5 fixes are code-verified and unit/component-test-covered but have NOT been re-run against real provider accounts in a live browser (149-HUMAN-UAT.md / 149-VALIDATION.md still reflect the PRE-fix live-UAT pass). This is the disclosed residual human-verification requirement, not a code gap."
  regressions: []
human_verification:
  - test: "Re-run live-UAT Tests 1, 4, 5, 7 (and a light regression pass on 2/3/6/8/9/10/11) from 149-VALIDATION.md against real provider accounts, now that gap-closure plans 08/09/10 AND the round-2 code-review fixes (CR-01/WR-01..05) have landed"
    expected: "Test 1: toggling native_tools OFF on an OpenAI-compat-routed model (e.g. gpt-5.6, deepseek, openrouter) changes the next tool-carrying request's routing to the prompt-injected path within ~30s, no restart; on an Anthropic/Google row the toggle is now visibly GATED (grey, tooltip 'always native on this provider') instead of silently accepting a no-op write. Test 4/5: editing Timeout/Context/lock on an OpenRouter (slash-ID) model succeeds (no more in-row 404). Test 7: Thread A keeps streaming uninterrupted; Thread B on the just-disabled model shows the honest inline notice AND the run actually completes served by the fallback model/provider (verify runs.provider + runs.model in DB match the model that replied, including the cross-provider shape e.g. disabled Anthropic model → MiniMax fallback actually calls MiniMax)."
    why_human: "Live streaming turns against real provider accounts, a real concurrent two-thread scenario, and real TTL-cache timing cannot be substituted by unit mocks or static code inspection — this is the same disclosed SC#10 requirement the phase's own 149-VALIDATION.md documents as Manual-Only, and it has not been re-executed since the round-2 fixes landed (149-HUMAN-UAT.md's last update predates commits 46c09382..80946410)."
---

# Phase 149: Model Registry & Discovery Verification Report

**Phase Goal:** An operator can manage model capabilities from the admin shell and discover new provider models — without a server restart and without silently guessing capabilities the provider never returned. (MODEL-01, MODEL-02)
**Verified:** 2026-07-12T20:00:00Z
**Status:** human_needed
**Re-verification:** Yes — after gap-closure plans 08/09/10 + round-2 code review fixes (CR-01, WR-01..05)

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | ROADMAP SC#1 — operator can edit a model's capabilities and the change takes effect on the next request with no restart | ✓ VERIFIED | `PATCH /admin/models/{model_id:path}` (`admin.py:1061`) still allowlist-writes all 7 `_MODEL_CAP_COLUMNS`, invalidates the TTL cache. **Now additionally DB-aware for native_tools**: `resolve_calling_mode` (`openai_service.py`) reads `_resolve_db_native_tools` (mirrors the max-output-cap warm-cache pattern) — an operator's `native_tools=False` override short-circuits to STRUCTURED for every OpenAI-compat-routed provider. `pytest tests/test_149_native_tools_routing.py` 5/5 green. |
| 2 | ROADMAP SC#2 — live model discovery proposes new/changed/vanished models | ✓ VERIFIED | Unaffected by gap-closure; `pytest tests/test_149_discovery.py tests/test_149_discover_endpoint.py` 8/8 green. |
| 3 | ROADMAP SC#3 — discovery never auto-enables an un-returned capability (propose-only) | ✓ VERIFIED | `compute_diff` unchanged (still always `enabled=False` on `new`); **the per-model provenance LABEL is now honest** — `ModelDiscoveryPanel.tsx` `NewModelRow` derives a three-way suffix (`returned full capabilities ✓` / `returned IDs only` / `returned some capabilities`) from real per-field returned-vs-unknown counts, closing the Test-9 contradiction where a partial-provenance Google model read "IDs only" while its provider card said "capabilities ✓". `npm run test -- ModelDiscoveryPanel` 8/8 green (3 new provenance-state tests). |
| 4 | ROADMAP SC#4 — a non-operator cannot reach the model-write path | ✓ VERIFIED | Unaffected; router-level `Depends(require_operator)` still covers all routes incl. the two now-`:path` routes. `test_149_model_gate.py` 4/4 green. |
| 5 | Test-1 gap-closure — native_tools DB-aware routing (D-149-16) | ✓ VERIFIED (compat providers) / ⚠️ HONESTLY GATED (Anthropic/Google) | `openai_service.resolve_calling_mode` now sync-reads the warm `_model_overrides_cache` for `native_tools`, so an operator toggle changes the NEXT request's calling mode for every provider routed through the OpenAI-compat gateway (openai/deepseek/moonshot/zhipu/minimax/openrouter). Round-2 review (WR-05) found the toggle is inert for Anthropic/Google (native-SDK dispatch never reaches `resolve_calling_mode`) — **fixed by gating the UI control** (`ModelRegistryTab.tsx:326-327`, `gated={row.provider === "anthropic" || row.provider === "google"}` + explanatory tooltip), not by making it functionally route (scope decision, documented). `test_native_tools_gated_on_native_sdk_rows` component test green. |
| 6 | Test-4/5 gap-closure — namespaced (OpenRouter vendor/model) ids are editable/lockable | ✓ VERIFIED | `PATCH /models/{model_id:path}` + `PUT /models/{model_id:path}/lock` (`admin.py:1061,1236`) route the literal slash (post-uvicorn-decode) correctly; round-2 WR-04 closed the new empty-model_id matching hole the `:path` converter introduced (`if not model_id or not model_id.strip("/ \t\r\n"): 422`, both routes). `pytest tests/test_149_namespaced_model_routes.py` 7/7 green (incl. 3 new empty/whitespace-id 422 tests). |
| 7 | Test-7 gap-closure — disabled-model fallback is honest end-to-end, not just cosmetically (D-149-10) | ✓ VERIFIED | Frontend now consumes `model_disabled_fallback` (`api.ts` → `StreamsProvider.tsx:730` stamps `modelFallbackNotice` → `MessageItem.tsx:434` renders an inline amber notice naming both models). **Round-2 CR-01 (critical, now fixed):** the plan-09 fix alone left `body.model` un-rewritten, so the disabled model was still sent on the wire — a cross-provider fallback would hard-fail and a same-provider fallback would silently serve the disabled model under a now-false notice. `_apply_fallback_to_request` (`threads.py:278`) rewrites `body = body.model_copy(update={"model": _resolved_model})`, confirmed flowing into `RunContext(body=body, ...)` at `threads.py:1692` and the title-gen read at `:1382` — both post-date the rewrite at `:1280`. WR-01 (pattern-inferred provider guard) + WR-02 (provider recorded only when the credentials switch actually applied, via `switched is not user_settings` identity check against `override_provider`'s documented unchanged-on-refusal return) also fixed. `pytest tests/test_149_fallback_notice.py` 15/15 green (incl. `test_fallback_rewrites_outbound_body_model`, `test_gateway_receives_effective_model_from_body`, `test_unkeyed_fallback_provider_is_not_recorded`, `test_reresolve_provider_rejects_inferred_capability`). |
| 8 | Test-10 gap-closure — deprecated-reason input never silently loses a typed value (D-149-04) | ✓ VERIFIED | `ModelRegistryTab.tsx` `DeprecatedControl.commitReason` now has Enter-commit (`preventDefault`), Escape-cancel (revert, no write), and a one-shot `settled` guard. Round-2 WR-03 added: a dirty check (`if (next === (row.deprecated_reason ?? null)) return` — a no-op blur issues no PATCH/✎-receipt/refetch) and busy-window commit survival (`settled` is not set while a write is in flight, so a commit landing mid-busy-window is not permanently swallowed). `npm run test -- ModelRegistryTab` 12/12 green (incl. `test_reason_noop_blur_never_writes`, `test_reason_busy_commit_not_swallowed`). |
| 9 | Deprecated badge shown in BOTH the Settings picker AND the chat picker (D-149-05) | ✓ VERIFIED | Previously flagged PARTIAL/NOT_WIRED in the initial verification — confirmed FIXED (landed at commit `a31121ee`, predating that verification's own commit by ~24 min but merged in before the live UAT ran). Current source: `ChatArea.tsx:62,140-143,357` fetches `deprecated_models` from `getProviders()` and passes `deprecatedModels` into `MessageInput`; `SettingsPage.tsx` does the equivalent from `FullAppSettings`. Live-UAT Test 10 independently confirmed this live ("amber 'deprecated' badge rendered in the CHAT composer picker (IN-01 fix a31121ee confirmed live)"). |
| 10 | No SQLi/EoP/data-egress regression introduced by the `{model_id:path}` route change or the provider re-resolve | ✓ VERIFIED | `{model_id:path}` changes ROUTING ONLY — `model_id` still flows into the parameterized asyncpg upsert + code-constant `_MODEL_CAP_COLUMNS` allowlist (no new injection surface); both routes still inherit router-level `require_operator`. The fallback provider re-resolve (WR-01) now rejects pattern-INFERRED providers (`capability_source` must be `registry`/`db_override`), closing the BUG-260616-01-class data-egress risk (a slashed/garbage org-default id yanking live SDK routing to an inference bucket). |
| 11 | No backend/frontend regression from the full gap-closure + round-2-review diff | ✓ VERIFIED | `pytest tests/test_149_*.py` → **81 passed**, 0 failed. `npx vitest run` (4 phase-149 component/unit files) → **33 passed**. `npx vite build` → exit 0. `npx tsc -b` unchanged at the documented 30-error pre-existing baseline (0 new — verified per-plan SUMMARYs, not re-run here since no source outside the 149 diff was touched). |
| 12 | No debt markers (`TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER`) introduced in the gap-closure/round-2 diff | ✓ VERIFIED | Grepped all 9 touched files (`admin.py`, `threads.py`, `openai_service.py`, `ModelDiscoveryPanel.tsx`, `ModelRegistryTab.tsx`, `MessageItem.tsx`, `api.ts`, `StreamsProvider.tsx`, `types/index.ts`) — zero matches (2 false-positive substring hits on unrelated "TODOS"/"WRITE_TODOS_TOOL" feature names, not debt markers). |
| 13 | Round-2 Info-level findings are genuinely info (non-blocking), not disguised gaps | ✓ VERIFIED | IN-01 (empty-capabilities-map edge case in the provenance label) — confirmed present in source but genuinely unreachable (`_build_new_entry` always emits every `_CAP_FIELDS` key with the UNKNOWN sentinel, so `totalCount` is never 0 in practice). IN-02 (test coverage gap) — test-only. IN-03 (fallback notice vanishes on reload — no persisted column) — real UX gap but explicitly scoped-out, matches the `skill_activated` precedent, candidate for a follow-up seed. IN-04 (code duplication between the two DB-overlay resolvers) — refactor debt, no behavior impact. None are silently-dropped truths. |
| 14 | Requirements MODEL-01/MODEL-02 traceable to shipped code across all 10 plans | ✓ VERIFIED | `.planning/REQUIREMENTS.md:30-31` maps both to Phase 149; every plan that touches the write/discovery/routing/UI surface declares one or both in its `requirements:` frontmatter (01/03/04/05/06/07/08 declare both or MODEL-01; 09 declares MODEL-01; 10 intentionally declares none — false-green avoidance, closes only 2 UI-honesty cosmetic gaps, matches the documented 148/149 convention). No orphaned requirement IDs. |

**Score:** 14/14 code-level truths verified. The phase's SHIP-BLOCKING code gaps (from both the original live UAT and the round-2 code review) are closed and regression-tested. One disclosed residual: the fixes for Tests 1/4/5/7 have not yet been RE-RUN live against real providers (only unit/component-tested) — see Human Verification Required.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/app/services/openai_service.py` | `_resolve_db_native_tools` + DB-aware `resolve_calling_mode` | ✓ VERIFIED | Sync warm-cache read, mirrors `_resolve_db_max_output_cap`; explicit False wins for every provider (routing decision itself), function stays `def` (sync, no await on hot path). |
| `backend/app/api/admin.py` | `{model_id:path}` on PATCH + PUT lock, non-empty guard | ✓ VERIFIED | Both routes converted; both carry the WR-04 422 empty/whitespace guard as the first check in the handler body. |
| `backend/app/api/threads.py` | `_reresolve_fallback_provider`, `_apply_fallback_to_request`, wired at the seam | ✓ VERIFIED | Both functions present with full docstrings covering WR-01/WR-02/CR-01 rationale; wired into `send_message` between provider resolution (`:1230-1265`) and `register_run_start` (`:1293`), confirmed via source read (not just grep) at `:1279-1282`. |
| `frontend/src/components/admin/ModelDiscoveryPanel.tsx` | Truthful three-way provenance label | ✓ VERIFIED | `returnedCount`/`totalCount` derivation present at `:471-478`; IN-01 edge case documented-not-fixed (confirmed unreachable). |
| `frontend/src/components/admin/ModelRegistryTab.tsx` | Reason-input commit parity + native_tools honest gate | ✓ VERIFIED | `commitReason` dirty check + `settled` ref (`:522-540`); `RowToggle gated` prop wired for anthropic/google rows (`:326-327`) with `if (gated) return` click-guard (`:710`). |
| `frontend/src/components/chat/MessageItem.tsx` | Inline `model-fallback-notice` render | ✓ VERIFIED | `:434-441`, sibling of the content-gated block, renders `message.modelFallbackNotice.message`. |
| `frontend/src/providers/StreamsProvider.tsx` | `onModelDisabledFallback` stamps the streaming message | ✓ VERIFIED | `:730-734`, stamps only the streaming `assistantId` message, mirrors `onSkillActivated`. |
| `frontend/src/components/chat/ChatArea.tsx` | `deprecatedModels` threaded from `getProviders()` to `MessageInput` | ✓ VERIFIED | `:62,140-143,357` — confirmed FIXED since the initial verification (was NOT_WIRED there). |
| `backend/tests/test_149_native_tools_routing.py`, `test_149_namespaced_model_routes.py`, `test_149_fallback_notice.py` | Regression coverage for every gap-closure + round-2 fix | ✓ VERIFIED | 5 + 7 + 15 tests respectively, all green; test names map 1:1 to CR-01/WR-01/WR-02/WR-04 (e.g. `test_fallback_rewrites_outbound_body_model`, `test_reresolve_provider_rejects_inferred_capability`, `test_patch_empty_model_id_is_422`). |
| `frontend/src/components/admin/__tests__/ModelRegistryTab.test.tsx`, `ModelDiscoveryPanel.test.tsx`, `MessageItem.fallbackNotice.test.tsx` | Regression coverage for WR-03/WR-05/round-2 UI fixes | ✓ VERIFIED | `test_reason_noop_blur_never_writes`, `test_reason_busy_commit_not_swallowed`, `test_native_tools_gated_on_native_sdk_rows` all present and green. |
| `.planning/phases/149-model-registry-discovery/149-REVIEW.md` | Round-2 review findings + resolution | ✓ VERIFIED | `status: resolved`, `all_findings_fixed: false` (the 4 INs are intentionally left open, info-only), `fixed: [CR-01, WR-01..WR-05]` — all independently confirmed against source above. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `_resolve_enabled_model` (fallback fires) | `_apply_fallback_to_request` | `if _model_fallback_notice:` gate at `threads.py:1279` | ✓ WIRED | Confirmed the block only runs on a fired fallback; no-fallback path is byte-identical (D-14). |
| `_apply_fallback_to_request` rewritten `body` | `RunContext(body=body, ...)` | direct reassignment, same local variable | ✓ WIRED | Confirmed `body=body` at `:1692` and the title-gen `body.model` read at `:1382` both post-date the rewrite at `:1280-1282`; this is the exact CR-01 fix path. |
| `override_provider` refusal (no API key) | `_resolved_provider` commit | identity check `switched is not user_settings` | ✓ WIRED | Confirmed `override_provider` (`user_settings.py:712-722`) returns the SAME `effective` object unchanged on refusal — the identity check is sound, not a heuristic. |
| `model_disabled_fallback` SSE event | `MessageItem.tsx` inline notice | `api.ts` dispatch → `StreamsProvider.onModelDisabledFallback` → `modelFallbackNotice` message field | ✓ WIRED | Full chain confirmed in source; was NOT_WIRED (0 `rg` hits) before plan 09, now 4+ hits including the render call site. |
| `admin.py` `{model_id:path}` routes | the parameterized upsert / `_MODEL_CAP_COLUMNS` allowlist | routing-only change, handler body untouched | ✓ WIRED | Confirmed the SQL/allowlist code paths are byte-identical to before; only the route decorator's path converter + the new empty-id guard changed. |
| `ModelRegistryTab.tsx` native_tools `RowToggle` | the `gated` click-guard | `gated={row.provider === "anthropic" || row.provider === "google"}` | ✓ WIRED | Confirmed `if (gated) return` inside `RowToggle`'s click handler (`:710`) — an operator genuinely cannot fire a no-op write on these rows; this is a real gate, not cosmetic greying. |
| Discovery `NewModelRow` provenance suffix | the provider run card's own label | `returnedCount`/`totalCount` derived from the SAME `model.capabilities` object the provider card summarizes | ✓ WIRED | Confirmed the two labels can no longer contradict for the reproduced Test-9 shape (partial per-field provenance). |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `resolve_calling_mode`'s DB-aware branch | `db_native: bool \| None` | `_resolve_db_native_tools(model_id)` → the same warm `_model_overrides_cache` the max-output clamp reads (populated by the async request-path warm-up) | Yes — real DB-backed cache, not a static/empty fallback | ✓ FLOWING |
| `_apply_fallback_to_request`'s rewritten `body.model` | `_resolved_model` (the org default) | `_resolve_enabled_model` → `load_all_model_overrides()` (30s-TTL, real DB read) | Yes | ✓ FLOWING |
| `MessageItem.tsx` fallback notice | `message.modelFallbackNotice` | live SSE `model_disabled_fallback` event → `StreamsProvider` stamp; **NOT persisted** — a page reload has no source column to re-derive it from (round-2 IN-03, documented not fixed) | Live-session only, not on reload | ⚠️ STATIC (post-reload) / ✓ FLOWING (live session) |
| `ModelDiscoveryPanel.tsx` provenance suffix | `returnedCount`/`totalCount` | real per-model `capabilities` map returned by `runModelDiscovery()` → `POST /admin/models/discover` → live `httpx` fan-out | Yes | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All phase-149 backend tests (full set, incl. gap-closure + round-2 fixes) | `pytest tests/test_149_*.py -q` | `81 passed, 1 warning` | ✓ PASS |
| All 4 phase-149 frontend test files (scoped to the gap-closure diff) | `npx vitest run <4 files>` | `Test Files 4 passed (4)` / `Tests 33 passed (33)` | ✓ PASS |
| `vite build` succeeds independent of the pre-existing `tsc -b` baseline | `npx vite build` | `✓ built in 7.60s`, exit 0 | ✓ PASS |
| The CR-01 fix actually threads the effective model to the outbound request | source trace: `body.model_copy` (`:321`) → `body=body` (`:1692`) and `body.model` (title-gen, `:1382`) | both post-date the rewrite; no shadowing found | ✓ PASS |
| `override_provider`'s refusal-is-identity contract holds (the WR-02 fix's premise) | source read `user_settings.py:712-722` | returns `effective` object unchanged (no `.model_copy`) on no-key refusal | ✓ PASS |
| No debt markers in the 9 gap-closure/round-2-touched files | `grep -n -E "TBD\|FIXME\|XXX\|TODO\|HACK\|PLACEHOLDER"` per file | 0 real matches (2 false positives on "TODOS"/"WRITE_TODOS_TOOL" feature names) | ✓ PASS |
| Phase-149-relevant paths are fully committed (no uncommitted WIP) | `git status --short -- backend/app frontend/src .planning/phases/149-model-registry-discovery supabase/migrations` | empty output | ✓ PASS |

### Probe Execution

No `scripts/*/tests/probe-*.sh` probes declared or discovered for this phase. SKIPPED (no probes applicable) — unchanged from the initial verification.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| MODEL-01 | 149-01,03,04,05,06,07,08,09 | Operator can edit model capabilities from the admin shell; changes take effect without restart | ✓ SATISFIED | GET/PATCH `/admin/models` + `ModelRegistryTab.tsx` + TTL-cache invalidation + native_tools DB-aware routing (plan 08) + honest fallback (plan 09), all verified above. `.planning/REQUIREMENTS.md:30` marked `[x]`. |
| MODEL-02 | 149-01,02,04,06,07,08 | Operator can run live model discovery; propose-only, never auto-enables | ✓ SATISFIED | `model_discovery_service.py` + `POST /admin/models/discover` + `ModelDiscoveryPanel.tsx` (with the round-2-verified honest provenance label), all verified above. `.planning/REQUIREMENTS.md:31` still shows `[ ]` — this is the documented `phase.complete` stale-tracking-row quirk (project memory), a bookkeeping lag, not a code gap; the code-level evidence is unambiguous. |

No orphaned requirements — `.planning/REQUIREMENTS.md` maps only MODEL-01/MODEL-02 to Phase 149.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | No `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` markers found in any of the 9 gap-closure/round-2-touched files | — | None — clean |
| `frontend/src/types/index.ts`, `frontend/src/lib/api.ts` | n/a (absence) | `modelFallbackNotice` has no persisted source column — the notice is stream-transient and vanishes on page reload (round-2 IN-03) | ℹ️ Info | Documented, not fixed, this round. The swap stops being "silent" only for the live session that witnessed it; a user who reloads mid-thread or reads it later sees no notice. Candidate for a load-time-derivation follow-up (e.g. compare `runs.model` vs the persisted message's request model) or a message-metadata column. Not a regression — matches the pre-existing `skill_activated` precedent's scope. |
| `frontend/src/components/admin/ModelDiscoveryPanel.tsx` | 473-478 | The `returnedCount === totalCount` check runs first, so a (currently unreachable) zero-capabilities-map new-model entry would read "returned full capabilities ✓" instead of "returned IDs only" (round-2 IN-01) | ℹ️ Info | Confirmed present, confirmed unreachable in practice (`_build_new_entry` always emits every field with an UNKNOWN sentinel — `totalCount` is never 0). Defensive-ordering nit, not a live bug. |
| `backend/app/services/openai_service.py` | 1456-1494 vs 1416-1453 | `_resolve_db_native_tools` structurally duplicates `_resolve_db_max_output_cap` (round-2 IN-04) | ℹ️ Info | Refactor debt (extract a shared `_resolve_db_override_field` helper), no behavior impact, documented not fixed this round. |
| `.planning/REQUIREMENTS.md` | 90 | MODEL-02 tracking checkbox still `[ ]` despite code-level SATISFIED status | ℹ️ Info | Known `phase.complete` stale-tracking-row quirk (project memory) — bookkeeping only. |
| `.planning/STATE.md` | 25-32 | Stale tracking: "Phase: 149 ... EXECUTING / Plan: 10 of 10 (held for verify-work + secure-phase)" | ℹ️ Info | Accurate as of this re-verification's disposition (still held for the live-UAT re-run below) — not actually stale this time; orchestrator should update once the human item closes. |

### Human Verification Required

### 1. Re-run the live-UAT rows affected by the round-2 fixes

**Test:** Re-execute `149-VALIDATION.md` rows 1 (native_tools flip), 4/5 (OpenRouter edit/lock), and 7 (parallel-thread disabled-model fallback) against real provider accounts, now that the round-2 code-review fixes (CR-01 effective-model-on-the-wire, WR-01 pattern-inferred-provider guard, WR-02 provider-committed-only-on-applied-switch, WR-04 empty-model_id guard, WR-05 honest native_tools gate) have landed on top of the original gap-closure plans 08/09/10. A light regression pass on rows 2/3/6/8/9/10/11 is recommended since the touched files (`threads.py`, `admin.py`, `ModelRegistryTab.tsx`, `MessageItem.tsx`) are shared hot paths.
**Expected:** Test 1 — OpenAI-compat models (gpt-5.6, deepseek, openrouter, etc.) route through the toggle live; Anthropic/Google rows show the toggle visibly GATED (grey, tooltip) rather than silently accepting a no-op edit. Test 4/5 — OpenRouter capability edits and lock/unlock succeed with no 404. Test 7 — Thread A completes uninterrupted; Thread B shows the honest inline notice AND the DB `runs` row for Thread B records the model/provider that ACTUALLY served it (the fallback model), including the cross-provider case (e.g. a disabled Anthropic model falling back to a MiniMax org default should actually call MiniMax, not 400/404).
**Why human:** Requires live network calls to real LLM providers, real concurrent thread state, and real TTL-cache timing — none of which unit tests or static code inspection can substitute for. This is the same disclosed SC#10 Manual-Only design the phase's own `149-VALIDATION.md` documents; it has not been re-executed since the round-2 fixes landed (the last update to `149-HUMAN-UAT.md` predates commits `46c09382..80946410`).

### Gaps Summary

Both rounds of previously-identified gaps are closed in code and covered by dedicated regression tests:

- **Round 1 (original live UAT, Tests 1/4/7/9/10):** all 5 issues have code fixes in gap-closure plans 08 (native_tools DB-aware routing, `{model_id:path}` routes), 09 (frontend SSE consumption + inline notice + provider re-resolve), and 10 (truthful discovery provenance label, deprecated-reason commit parity). Confirmed present in source, not just claimed in SUMMARYs.
- **Round 2 (code review of the gap-closure diff):** found 1 Critical (CR-01 — the plan-09 fix alone never rewrote the outbound `body.model`, so a cross-provider fallback would have hard-failed and a same-provider fallback would have silently served the disabled model under a now-false notice) and 5 Warnings (WR-01 pattern-inferred-provider yank risk, WR-02 provider-recorded-on-refused-switch dishonesty, WR-03 deprecated-reason no-op-blur writes + busy-window swallow, WR-04 empty-model_id widened by the `:path` converter, WR-05 native_tools toggle silently inert for Anthropic/Google). **All 6 are confirmed fixed in the current source**, each with a dedicated regression test verified passing (81/81 backend `test_149_*`, 33/33 scoped frontend). The 4 remaining Info-level findings (IN-01..IN-04) are genuinely non-blocking: 2 are unreachable-in-practice edge cases, 1 is a documented UX scope decision (fallback notice doesn't survive reload), 1 is refactor debt.

**The one thing that remains unverified is live behavior of the fixes themselves.** Every fix above is proven correct by static source inspection and by unit/component tests that exercise the exact reproduced failure mode — but the actual live cross-provider re-run (real OpenAI/Anthropic/Google/OpenRouter accounts, real concurrent threads) that would close the loop on "the operator actually sees this work in the browser" has not happened since the round-2 fixes landed. `149-HUMAN-UAT.md` and `149-VALIDATION.md` are both frozen at their pre-round-2-fix state. Given the phase's own stated CLAUDE.md UAT-scoreboard mandate (SC#10) and the severity of what round-2 caught (a critical bug hiding behind green unit tests, twice — once in round 1's own CR-01 and again in round 2's CR-01), this verification declines to mark the phase `passed` on code evidence alone and routes to `human_needed` for the live re-run.

No regressions were found in the gap-closure + round-2-fix diff: full `test_149_*` suite (81/81), scoped frontend suite (33/33), `vite build` (exit 0), and no debt markers introduced.

---

_Verified: 2026-07-12T20:00:00Z_
_Verifier: Claude (gsd-verifier)_
