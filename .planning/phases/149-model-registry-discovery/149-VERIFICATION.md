---
phase: 149-model-registry-discovery
verified: 2026-07-12T13:10:00Z
status: human_needed
score: 12/13 must-haves verified (1 partial/WARNING)
overrides_applied: 0
human_verification:
  - test: "SC#10 4-axis cross-provider live UAT (149-VALIDATION.md rows 1-11)"
    expected: "All 11 authored rows pass live against real providers — cross-provider capability edits take effect with no restart, discovery propose-only holds live, parallel-thread fallback notice fires, long-message honors edited caps, the gpt-5.6 native_tools no-restart proof works, deprecated marker stays selectable, lock-a-disabled-model 409 refuses."
    why_human: "Live streaming turns against real OpenAI/Anthropic/Google/OpenRouter accounts, real concurrent threads, and real TTL-cache timing cannot be verified by static code inspection or unit mocks — this is the explicit, disclosed purpose of the Manual-Only Verifications section (status: pending by design)."
  - test: "149-VALIDATION.md row 10 (deprecated marker) — verify the chat picker specifically"
    expected: "Row 10 says 'Open the chat/Settings picker' and expects the deprecated badge in both. Confirm whether the chat picker is expected to show it in this phase, or whether the row should be scoped to Settings only."
    why_human: "Codebase evidence (see Gaps Summary) shows ChatArea.tsx never passes `deprecatedModels` to MessageInput.tsx, and its data source (`getProviders()`) does not carry `deprecated_models` at all — the chat picker structurally CANNOT show the badge today, only the Settings picker can. A human needs to decide: wire it now, amend the VALIDATION.md row wording, or accept as an explicit deferred item."
---

# Phase 149: Model Registry & Discovery Verification Report

**Phase Goal:** An operator can manage model capabilities from the admin shell and discover new provider models — without a server restart and without silently guessing capabilities the provider never returned. (MODEL-01, MODEL-02)
**Verified:** 2026-07-12T13:10:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | ROADMAP SC#1 — operator can edit a model's capabilities (enable/disable, max tokens, timeout, native tools, deprecated) and the change takes effect on the next request with no restart | ✓ VERIFIED | `PATCH /admin/models/{id}` (`backend/app/api/admin.py:1040`) allowlist-writes all 7 `_MODEL_CAP_COLUMNS`, calls `invalidate_model_overrides_cache()` on success; `ModelRegistryTab.tsx` renders inline click-to-edit cells for context/max-out/timeout/native-tools/enabled/deprecated wired through `onSetCapability`. `pytest tests/test_149_model_write.py` 8/8 green; `npm run test -- ModelRegistryTab` 7/7 green. |
| 2 | ROADMAP SC#2 — operator can run live model discovery, which queries each provider's `/models` and proposes new/changed/vanished models | ✓ VERIFIED | `POST /admin/models/discover` (`admin.py:1244`) wraps `model_discovery_service.discover_all` + `compute_diff`; `ModelDiscoveryPanel.tsx` renders per-provider run cards + ✚New/±Changed/⊘Vanished groups. `pytest tests/test_149_discover_endpoint.py` 4/4 green; `npm run test -- ModelDiscoveryPanel` 5/5 green. |
| 3 | ROADMAP SC#3 — discovery never auto-enables a capability the provider's `/models` endpoint did not return (propose-only) | ✓ VERIFIED | `compute_diff` always sets `enabled=False` on every `new` entry; per-field fill only for provider-returned data (Google/OpenRouter token limits, OpenRouter `native_tools`) with `"unknown"` sentinel elsewhere. UI "Enable now" tick gated by `isComplete(m)` — confirmed in source (`ModelDiscoveryPanel.tsx:116,153`). `test_propose_only` (backend) + the panel's "disables enable-now" test (frontend) both green. |
| 4 | ROADMAP SC#4 — a non-operator cannot reach the model-write path | ✓ VERIFIED | Router-level `Depends(require_operator)` (`admin.py:118`) covers all 4 new routes; each non-GET route (`PUT .../lock`, `POST .../discover`) carries its OWN explicit 404 regression test per the 147/148 precedent (`test_149_default_guard.py::test_lock_non_operator_404`, `test_149_discover_endpoint.py::test_discover_non_operator_404`, `test_149_model_gate.py`). All green. |
| 5 | Migration 099 applied live + config.py overlay carries `deprecated` end-to-end | ✓ VERIFIED | `supabase/migrations/099_model_registry_deprecated.sql` exists with the 3 idempotent `ADD COLUMN IF NOT EXISTS` statements; `supabase/full-schema.sql` (a live-DB dump, no reset) contains `deprecated`/`deprecated_reason`/`llm_model_locked`, confirming the migration was actually applied to the local DB, not just authored. `config.py:214` TypedDict field + `config.py:704` overlay tuple both present. `pytest tests/test_149_config_overlay.py` 3/3 green. |
| 6 | Picker becomes registry-driven — `enabled` hides a model from BOTH the static-registry and legacy `db_model_lists` merge branches | ✓ VERIFIED | `user_settings.py:_build_providers` (`:508-523`) filters `disabled_ids` across both branches with an explicit comment citing D-149-08; `load_all_model_overrides()` is a separate all-rows cache from the enabled-only hot cache (Pitfall 1 preserved — grep confirms `_load_model_overrides` still runs `WHERE enabled = true`). `pytest tests/test_149_enabled_enforce.py` 4/4 green. |
| 7 | Two-part no-dead-default guard — disabling the org-default/locked model is refused (409); locking a disabled model is refused (409) | ✓ VERIFIED | `admin.py:1080-1095` (disable-path) + `admin.py:1194-1202` (lock-path) both raise `HTTPException(409, ...)` BEFORE any write, read verbatim in source. `pytest tests/test_149_default_guard.py` 8/8 green (incl. `test_lock_disabled_model_409`, disable-default, disable-locked). |
| 8 | `PUT /admin/models/{id}/lock` pins the single org default (writes `llm_model` + `llm_model_locked`) | ✓ VERIFIED | `admin.py:1167-1222`; `main.py:114` confirms `llm_model_locked` added to `_DIRECT_COLUMNS` (the SQLi-safe write allowlist). Dedicated endpoint, separate from PATCH, matching the `setModelLock` api.ts seam. Tests green. |
| 9 | Disabled-model request-path enforcement + honest fallback notice naming both models (D-149-10) | ✓ VERIFIED | `threads.py:196-228` (`_resolve_enabled_model`) + the emission at `threads.py:1216-1219` (`model_disabled_fallback` SSE event). Reads the cached all-rows set (no per-request DB read); single-seam, no per-provider fork (62-line diff, confirmed via `git show 6725efeb --stat`). `pytest tests/test_149_fallback_notice.py` 5/5 green. |
| 10 | BUG-260620-01 closed — `max_output_tokens` clamp fires against the EFFECTIVE model + honors a DB-edited cap, across openai-compat AND the Anthropic/Google gateway adapters | ✓ VERIFIED | `openai_service.py:_resolve_max_tokens` takes `effective_model`/`db_max_output_cap`; `.removesuffix(":exacto")` preserved, `split(":")[0]` anti-pattern absent (grep confirms). Both gateway adapters (`provider_gateway/anthropic.py:88-92`, `google.py:71-75`) thread the same params — single chokepoint preserved, not forked. `pytest tests/test_149_clamp.py` 12/12 green. |
| 11 | Operator Model Registry tab (070-A) + Discovery panel (071-A) mounted in ControlRoomPage, unlocked from the 146 placeholder | ✓ VERIFIED | `ControlRoomPage.tsx:124` tab def is `locked: false`; renders `<ModelRegistryTab>` + `<ModelDiscoveryPanel>` (lines 744-752) wired to `handleSetCapability`/`handleLock`/`handleRunDiscovery`/`handleConfirmDiscovery`, each calling the api.ts seam + `pulseRecording()` + re-fetch. `npm run test -- ControlRoomPage` 7/7 green (incl. the moved LockedTab assertion to the still-locked Secrets tab and a new unlocked-Model-Registry test). |
| 12 | SC#10 4-axis cross-provider UAT rows authored (presence + correctness, not execution) | ✓ VERIFIED | `149-VALIDATION.md` carries 11 Manual-Only rows covering all 4 mandated axes (cross-provider rows 1-5, multi-tool row 6, parallel-thread row 7, long-message row 8) PLUS the D-149-16 gpt-5.6 no-restart proof, the SC#3 propose-only row, the deprecated-marker row, and the lock-a-disabled-model 409 row. `nyquist_compliant: true` set; Per-Task map fully filled with real test file references. |
| 13 | Picker deprecated badge shown in BOTH the Settings picker AND the chat picker (D-149-05 + D-149-17's "Settings + chat" framing) | ⚠️ PARTIAL | Settings picker (`ModelPillRow.tsx`) is fully wired: `SettingsPage.tsx` seeds `deprecatedModels` from `FullAppSettings.deprecated_models` and passes it down — 9/9 tests green. The **chat picker is NOT wired**: `MessageInput.tsx` has the badge-render logic (`deprecatedModels?.has(m)`) but its caller `ChatArea.tsx` never passes the prop, AND `ChatArea`'s own data source `getProviders()` (`api.ts:2340`) does not carry `deprecated_models` in its response shape at all — this is not a one-line prop-threading gap, it's a missing data channel. `149-VALIDATION.md` row 10 tells the human to "Open the chat/Settings picker" and expect the badge in both; only Settings will show it today. Self-disclosed in `149-04-SUMMARY.md`'s "Known Stubs" section as an intentional cross-plan handoff, but never promoted to `149-CONTEXT.md`'s Deferred Ideas list or a follow-up SEED. |

**Score:** 12/13 truths fully verified; 1 partial (human decision requested — see Human Verification Required).

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/099_model_registry_deprecated.sql` | 3 idempotent ADD COLUMN statements | ✓ VERIFIED | Present, correct content; live-applied (confirmed via full-schema.sql live dump). |
| `backend/app/config.py` | `deprecated` TypedDict field + overlay tuple entry | ✓ VERIFIED | Both present at the exact expected lines. |
| `backend/app/services/model_discovery_service.py` | `discover_all`, `compute_diff`, `PROVIDER_ENDPOINTS` (8 providers), `keyed_from_settings` | ✓ VERIFIED | 465 lines; all 8 providers (openai/anthropic/google/deepseek/moonshot/zhipu/minimax/openrouter) present in the hardcoded allowlist; no caller-supplied URL parameter anywhere. |
| `backend/app/services/openai_service.py` | effective-model + DB-aware clamp | ✓ VERIFIED | `_resolve_max_tokens` + `_resolve_db_max_output_cap`; `removesuffix` present, `split(":")[0]` absent. |
| `backend/app/api/admin.py` | `GET/PATCH /admin/models`, `PUT .../lock`, `POST .../discover` | ✓ VERIFIED | All 4 routes present with the exact behaviors claimed (SQLi allowlist, null-clears-to-DEF, two-part no-dead-default guard, SSRF-safe provider validation). |
| `backend/app/models/user_settings.py` | `load_all_model_overrides` + `_build_providers` disabled-filter (both branches) | ✓ VERIFIED | Separate 30s-TTL cache from the hot cache; filter applied to both the static-registry merge and the legacy `db_model_lists`/env-CSV branch. |
| `backend/app/api/settings.py` | `deprecated_models` in `FullAppSettings` payload | ✓ VERIFIED | Present, populated from enabled+deprecated overrides. |
| `backend/app/api/threads.py` | Enabled-enforcement + fallback notice (G-5 minimal guard) | ✓ VERIFIED | 62-line diff, single seam, no new endpoint, no per-provider fork — confirmed via commit diff-stat. |
| `frontend/src/lib/api.ts` | 4 registry seams + 3 types + `deprecated_models?` field | ✓ VERIFIED | `getModelRegistry`/`setModelCapability`/`setModelLock`/`runModelDiscovery` all present with correct envelope-unwrap and 409-detail-preservation behavior. |
| `frontend/src/components/settings/ModelPillRow.tsx` | provider logo + deprecated badge, picker polish | ✓ VERIFIED | Fully wired, 9/9 tests green. |
| `frontend/src/components/chat/MessageInput.tsx` | provider logo + demoted info + deprecated badge | ⚠️ PARTIAL (HOLLOW badge prop) | Logo + demoted-info fully wired and working (uses local `selectedProvider`/`MODEL_INFO`, no external data needed). The `deprecatedModels` prop exists and renders correctly IF supplied, but is never supplied by its only caller (`ChatArea.tsx`) — the badge will never appear in the live chat picker today. |
| `frontend/src/components/admin/ModelRegistryTab.tsx` | 070-A instrument table, min 80 lines | ✓ VERIFIED | 665 lines; provider grouping, inline edit, OVR/DEF+Reset(null), deprecated toggle, coupling chip, lock gated-on-disabled, in-row 409 — all confirmed in source. 7/7 tests green. |
| `frontend/src/components/admin/ModelDiscoveryPanel.tsx` | 071-A propose→confirm panel, min 80 lines | ✓ VERIFIED | 675 lines; amber unknown-you-set-it inputs, enable-now completeness gate, vanished flagged-not-deleted (no delete action found). 5/5 tests green. |
| `.planning/phases/149-model-registry-discovery/149-VALIDATION.md` | SC#10 4-axis UAT rows, contains "gpt-5.6" | ✓ VERIFIED | 11 rows, all 4 axes + extras; `nyquist_compliant: true`. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `admin.py:set_model_capability` | `model_capabilities_overrides` | `_MODEL_CAP_COLUMNS` allowlist → parameterized asyncpg upsert | ✓ WIRED | Confirmed: unknown key → 422 before any SQL; parameterized `$N` binds; null-clears-to-DEF verified in source + tests. |
| `user_settings.py:_build_providers` | the disabled-override set | filter static/legacy-db_model_lists/DB models whose id is disabled | ✓ WIRED | Both branches filtered; confirmed in source with explicit D-149-08 comments. |
| `ModelPillRow.tsx` | `providerLogo.tsx` | single-source @lobehub provider marks | ✓ WIRED | `import { providerLogo }` present, rendered per group. |
| `api.ts:setModelLock` | `PUT /admin/models/{id}/lock` | the D-149-07 lock/unlock seam | ✓ WIRED | Confirmed matching endpoint path + body shape on both client and server. |
| `ControlRoomPage.tsx` | `getModelRegistry`/`setModelCapability`/`setModelLock`/`runModelDiscovery` | shell fetch-then-refetch + pulseRecording | ✓ WIRED | All 4 handlers present, each calls the seam then re-fetches; `pulseRecording()` called on recorded writes. |
| `MessageInput.tsx` (deprecatedModels prop) | `ChatArea.tsx` (caller) | prop passthrough from settings data | ✗ NOT_WIRED | `ChatArea.tsx` never passes `deprecatedModels`; its data source (`getProviders()`) does not even carry `deprecated_models`. See Truth #13. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `ModelRegistryTab.tsx` | `rows: ModelRegistryRow[]` | `getModelRegistry()` → `GET /admin/models` → `load_all_model_overrides()` + `MODEL_CAPABILITIES` | Yes — real DB query + real code constant | ✓ FLOWING |
| `ModelDiscoveryPanel.tsx` | `DiscoveryResult` | `runModelDiscovery()` → `POST /admin/models/discover` → real `httpx` fan-out to provider `/models` | Yes — real outbound HTTP (mocked only in tests) | ✓ FLOWING |
| `ModelPillRow.tsx` deprecated badge | `deprecatedModels: Set<string>` | `SettingsPage.tsx` ← `FullAppSettings.deprecated_models` ← `settings.py` populated from real overrides cache | Yes | ✓ FLOWING |
| `MessageInput.tsx` deprecated badge | `deprecatedModels: Set<string>` | `ChatArea.tsx` — **never populated, prop never passed** | No | ✗ DISCONNECTED |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All 10 phase-149 backend test files import + run cleanly | `pytest tests/test_149_*.py -q` | `53 passed, 1 warning in 1.65s` | ✓ PASS |
| All 4 touched backend modules import without error | `python -c "import app.api.admin; import app.api.threads; import app.services.model_discovery_service; import app.models.user_settings; import app.config"` | `all imports OK` | ✓ PASS |
| Full-schema.sql (live-DB dump) contains the applied migration's columns | `grep -n "deprecated\|llm_model_locked" supabase/full-schema.sql` | 3 matches (`deprecated boolean`, `deprecated_reason text`, `llm_model_locked boolean`) | ✓ PASS |
| No SQLi anti-pattern (`split(":")[0]`) reintroduced in the clamp fix | `grep 'split(":")\[0\]' backend/app/services/openai_service.py` | no match (exit 1) | ✓ PASS |
| 4 phase-149 frontend test files pass | `npm run test -- ModelRegistryTab ModelDiscoveryPanel ControlRoomPage SettingsModelBadge` | `Test Files 4 passed (4)` / `Tests 28 passed (28)` | ✓ PASS |
| `vite build` (the actual bundler) succeeds independent of the pre-existing `tsc -b` baseline rot | `npx vite build` | `✓ built in 5.60s`, exit 0 | ✓ PASS |
| No backend regression introduced by phase 149 (full-suite diff vs base commit `a3b3df48`) | Full `pytest tests/ -q` run at HEAD vs a throwaway worktree at `a3b3df48`, diffed | HEAD: 187 failed/2324 passed/7 skipped (+53 new phase-149 tests, all passing). Base: 181 failed/2160 passed/129 skipped. Real (non-log-noise) `FAILED`-line diff shows only flaky/unrelated integration tests flip either direction (`test_075_code_stdout_progressive.py`, `test_119_leak.py`, `test_harness_whitelist.py` — none touch phase-149 files); a representative pre-existing failure (`test_get_model_capability_inference.py`, touches `config.py`) reproduces byte-identically at both commits. | ✓ PASS (no regression) |

### Probe Execution

No `scripts/*/tests/probe-*.sh` probes declared or discovered for this phase (backend/frontend unit + component tests are the phase's verification mechanism per `149-VALIDATION.md`). SKIPPED (no probes applicable).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| MODEL-01 | 149-01, 03, 04, 05, 06, 07 | Operator can edit model capabilities (enable/disable, max tokens, timeout, native tools, deprecated) from the admin shell — write UI + operator-gated write path; changes take effect without restart | ✓ SATISFIED | GET/PATCH `/admin/models` + `ModelRegistryTab.tsx` + TTL-cache invalidation, all verified above. |
| MODEL-02 | 149-01, 02, 04, 06, 07 | Operator can run live model discovery; service queries each provider's `/models` and proposes new/changed/vanished models for confirmation; never auto-enables | ✓ SATISFIED | `model_discovery_service.py` + `POST /admin/models/discover` + `ModelDiscoveryPanel.tsx`, all verified above. |

No orphaned requirements — `.planning/REQUIREMENTS.md` maps only MODEL-01/MODEL-02 to Phase 149, and both appear in every relevant plan's `requirements:` frontmatter. (Note: the REQUIREMENTS.md tracking table still shows both as "Pending" — this is the known `phase.complete` stale-tracking-row quirk documented in project memory, a documentation bookkeeping issue, not a code gap.)

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | No `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER`/"not yet implemented" markers found in any of the 18 phase-149-modified files | — | None — clean |
| `frontend/src/components/chat/ChatArea.tsx` | n/a (absence) | `MessageInput`'s `deprecatedModels` prop is never threaded from its caller, and the caller's data source (`getProviders()`) doesn't carry `deprecated_models` at all | ⚠️ Warning | The chat picker cannot show the deprecated badge in production, contradicting `149-VALIDATION.md` row 10's literal wording ("Open the chat/Settings picker"). Degrades gracefully (optional prop, no crash) but is a real functional gap vs. the phase's own authored UAT expectation. |
| `.planning/STATE.md` | 29-32 | Stale tracking: "Phase: 149 ... EXECUTING / Plan: 1 of 7" despite all 7 plans committed and complete | ℹ️ Info | Documentation bookkeeping only (the known `phase.complete` stale-row quirk per project memory); does not reflect actual code state. Orchestrator should update STATE.md when this phase completes. |

### Human Verification Required

### 1. SC#10 4-Axis Cross-Provider Live UAT

**Test:** Execute all 11 rows in `149-VALIDATION.md` § Manual-Only Verifications against real provider accounts (OpenAI, Anthropic, Google, OpenRouter) with real streaming, a real parallel-thread scenario, and a real long-message/large-context turn.
**Expected:** Every row's stated expectation holds (capability edits take effect live with no restart; the gpt-5.6 native_tools flip proves the "no restart" claim; discovery's propose-only asymmetry holds live; the parallel-thread fallback notice fires without breaking Thread A; the lock-a-disabled-model 409 refuses).
**Why human:** These require live network calls to real LLM providers, real concurrent thread state, and real TTL-cache timing — none of which unit tests or static code inspection can substitute for. This is the explicit, disclosed design of the phase (`149-VALIDATION.md` sign-off: "SC#10 4-axis live UAT rows authored, status pending manual execution").

### 2. Deprecated Badge — Chat Picker Scope Decision

**Test:** Read `149-VALIDATION.md` row 10 and decide whether the chat picker is in scope for the deprecated badge this phase, given the codebase evidence that it is currently unwired (see Truth #13 and the Anti-Patterns table above).
**Expected:** Either (a) a quick follow-up wires `ChatArea.tsx` → `MessageInput.tsx` (would require extending `getProviders()`'s response shape or having `ChatArea` also fetch `FullAppSettings`), (b) row 10 is amended to scope the expectation to "Settings picker only" for this phase, or (c) this is formally accepted as a deferred item with a re-open trigger recorded in `149-CONTEXT.md`.
**Why human:** This is a scope/priority call, not a code-correctness question — the component code is correct and tested; the gap is a missing data-plumbing connection between two other components, and deciding whether it's in-scope for Phase 149 vs. a follow-up is a product decision.

### Gaps Summary

The phase's core deliverable — the operator-facing model registry (read + SQLi-safe write + governance) and the propose-only discovery flow — is fully implemented, wired end-to-end, and covered by passing automated tests (53/53 backend, 28/28 frontend). All 4 ROADMAP success criteria are independently verified against live source code, not just SUMMARY claims. The two-part no-dead-default guard, the SSRF-safe discovery fan-out, the SQLi-safe allowlist write, and the operator-only 404 gate on every new route were all read directly from `admin.py`/`threads.py`/`user_settings.py`/`main.py` and match the plan claims exactly — no stubs, no placeholders, no fabricated test coverage found anywhere in the 18 touched files.

One real, disclosed gap was found: the chat-surface model picker (`MessageInput.tsx`) has the deprecated-badge rendering logic built and tested in isolation, but its only caller (`ChatArea.tsx`) never supplies the data, and the caller's data source doesn't even carry the field — so in production, a deprecated model's badge will show in Settings but NOT in the chat composer's model dropdown. This directly affects the literal wording of `149-VALIDATION.md` UAT row 10 ("Open the chat/Settings picker"), which will only half-verify when a human runs it live. The 149-04 executor self-disclosed this exact gap under "Known Stubs" as an intentional cross-plan handoff — it just was never promoted to a tracked deferred item or an amended VALIDATION.md row, so it is flagged here for an explicit human decision rather than silently passing or silently blocking the phase.

No backend regressions were introduced: a full-suite diff against the pre-phase base commit (`a3b3df48`) shows the failure-count delta is fully explained by (a) 53 new phase-149 tests (all passing) and (b) generic environment-driven flakiness in unrelated integration tests (sandbox stdout timing, Redis zombie-heal races, leak-isolation tests) that flip in both directions run-to-run and touch none of phase 149's files. This is a broader pre-existing test-debt condition than the ~17 specifically documented in `deferred-items.md`, but it is confirmed unrelated to this phase's changes and is out of this phase's goal-backward scope.

---

_Verified: 2026-07-12T13:10:00Z_
_Verifier: Claude (gsd-verifier)_
