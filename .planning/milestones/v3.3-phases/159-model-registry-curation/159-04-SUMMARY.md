---
phase: 159
plan: 04
subsystem: frontend / model-registry client contract
tags: [model-registry, curation, client-seam, types, api-client, capability-defaults]
requires:
  - "159-01: DiscoveredNewModel now carries a display-only `utility` flag (model_discovery_service.is_utility_model)"
  - "159-02: POST /admin/models add-by-ID endpoint (enabled forced false) + filter-toggle key on PUT /admin/flags"
  - "159-03: GET /settings returns model_discovery_filter_enabled (default true, mig 103)"
provides:
  - "api.ts:addModelById(body) + AddModelBody type — the D-159-02 add-by-ID write seam (POST /admin/models, ApiError-on-!ok)"
  - "api.ts:DiscoveredNewModel.utility?: boolean — the D-159-01 display tag (client half)"
  - "api.ts:FullAppSettings.model_discovery_filter_enabled + FlagKey extension — the D-159-04 persisted toggle (client half)"
  - "model-defaults.ts:familyDefaults(idOrProvider) → {context, maxOutput, tools} — the D-159-03 per-family reviewed pre-fill table"
affects:
  - "159-05: the + Add model by ID form consumes addModelById + AddModelBody + familyDefaults"
  - "159-06: the discovery filter UI consumes DiscoveredNewModel.utility + model_discovery_filter_enabled + familyDefaults hand-fill"
tech-stack:
  added: []
  patterns:
    - "substring→family first-match-wins lookup mirroring providerLogo.tsx:MODEL_MARKS (model-defaults.ts)"
    - "ApiError(await errorDetail(res, fallback), res.status) client write seam mirroring setModelCapability"
key-files:
  created:
    - "frontend/src/lib/model-defaults.ts"
    - "frontend/src/lib/model-defaults.test.ts"
  modified:
    - "frontend/src/lib/api.ts"
    - "frontend/src/pages/__tests__/SettingsPage.a11y.test.tsx"
decisions:
  - "familyDefaults values follow the plan's prescribed sensible-modern family defaults verbatim (claude 200k/32768, google 600k/32768, openai 400k/32768, kimi 256k/65536, glm 128k/32768, minimax 200k/32768, deepseek 128k/16384); openrouter/unknown → all-null blank (SC#3 — reviewed pre-fills, never authoritative)"
  - "AddModelBody has NO enabled field — mirrors the backend AddModelRequest pydantic shape exactly (server forces enabled=false)"
  - "model_discovery_filter_enabled added as a NON-optional boolean on FullAppSettings (matches the backend settings.py `bool` field); DiscoveredNewModel.utility stays optional for backward-compat"
  - "MODEL-03 NOT marked complete — phase-spanning STRETCH requirement; plans 05/06 remain; closes at /gsd:verify-work 159"
metrics:
  duration: "~20 min"
  tasks: 2
  files: 4
  commits: 2
  completed: "2026-07-18"
---

# Phase 159 Plan 04: Frontend Client Seam + Per-Family Default Table Summary

**One-liner:** The interface-first client contract Plans 05/06 call — `addModelById` + `AddModelBody` write seam (D-159-02), the `utility` display tag on `DiscoveredNewModel` (D-159-01), `model_discovery_filter_enabled` on `FullAppSettings` + `FlagKey` (D-159-04), and a new `familyDefaults()` substring→family capability pre-fill table (D-159-03) — all mirroring the exact backend wire shapes shipped in Plans 01/02/03.

## What Was Built

This is a pure types/lib plan (no component logic) that prevents a cross-plan "scavenger hunt": Plans 05 (add-by-ID form) and 06 (discovery filter UI) now receive concrete, type-checked contracts. The two UI plans call `addModelById`, read `DiscoveredNewModel.utility` + `model_discovery_filter_enabled`, and pre-fill capability inputs from `familyDefaults`.

Before writing any TypeScript, the four backend contracts were verified against the actual shipped code (evidence-based, per CLAUDE.md provider-docs-first discipline):
- `POST /admin/models` = `add_model_by_id` (`admin.py:1123`), body `AddModelRequest` (`admin.py:1087`) — `{model_id, provider, context_window_tokens?, max_output_tokens?, native_tools?, deprecated?, deprecated_reason?}`, NO `enabled` field, 409/422/404 gated. `AddModelBody` mirrors it exactly.
- `model_discovery_service._build_new_entry` emits `"utility": is_utility_model(model_id)`.
- `model_discovery_filter_enabled` present in `settings.py` response (non-optional `bool`), `main._DIRECT_COLUMNS`, and `admin._FLAG_HUMAN_NAMES` (so `setFlag` rides `PUT /admin/flags`).

### Task 1 — api.ts client seam (commit `a0aba7b9`)

Five additive edits to `frontend/src/lib/api.ts`:
- **`AddModelBody`** interface (beside `ModelCapabilityPatch`) — NO `enabled` field.
- **`addModelById(body): Promise<void>`** — `POST ${API_BASE}/admin/models` with `getAuthHeaders()` + `JSON.stringify(body)`; on `!res.ok` throws `new ApiError(await errorDetail(res, "Failed to add the model."), res.status)` (mirrors `setModelCapability`, surfaces the 409/422 server detail for the form's plain-language refusal). CR-01 discipline preserved (client stays the only place, no envelope-unwrap leaks to a component).
- **`utility?: boolean`** on `DiscoveredNewModel` (optional, backward-compat).
- **`model_discovery_filter_enabled: boolean`** on `FullAppSettings` (beside the FLAG-01 booleans).
- **`"model_discovery_filter_enabled"`** added to the `FlagKey` union so `setFlag` types the write.

### Task 2 — model-defaults.ts family-default table (commit `82a10e37`)

New `frontend/src/lib/model-defaults.ts` exporting `familyDefaults(idOrProvider) → { context, maxOutput, tools }` (+ the `FamilyDefaults` type). An ordered substring→family array mirrors `providerLogo.tsx:MODEL_MARKS` (first-match-wins, most-specific-first) so a model resolves the same family its logo does (an OpenRouter-hosted Gemma → the Google family). A bare-provider fallback map handles plain provider names that don't contain their family substring (`google`/`openai`/`zhipu`/`anthropic`). Unrecognized ids → all-null (blank — the UI shows an empty "operator sets it" input). Header comment marks the values REVIEWED pre-fills, never authoritative (SC#3). `familyDefaults` returns a FRESH object each call (safe as mutable draft state). `model-defaults.test.ts` = 12 tests covering family resolution, bare-provider fallback, null-for-unknown, first-match-wins ordering (`deepseek-gpt-hybrid` → DeepSeek, proving the earlier needle wins), and case/whitespace/fresh-object hygiene.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Companion fix: SettingsPage.a11y.test.tsx mock updated for the new required settings field**
- **Found during:** Task 1 verification (`tsc -b`).
- **Issue:** Adding `model_discovery_filter_enabled` as a NON-optional field on `FullAppSettings` (the plan-mandated shape, matching the backend's non-optional `bool`) broke one otherwise-complete `FullAppSettings` literal constructor — the `mkSettings()` helper in `SettingsPage.a11y.test.tsx` (which provides `self_improve_enabled`/`workflows_enabled`/`maintenance_mode` but not the new field).
- **Fix:** Added `model_discovery_filter_enabled: true` to that mock (mirrors the backend default TRUE).
- **Files modified:** `frontend/src/pages/__tests__/SettingsPage.a11y.test.tsx` (committed with Task 1).
- **Commit:** `a0aba7b9`.
- **Evidence of net-zero impact:** measured the true baseline by temporarily restoring the committed HEAD versions of both changed files and running `tsc -b` — the baseline has exactly 29 errors at the identical 29 file:line locations as the post-change run. My change introduced **0 net-new type errors**. The other FullAppSettings constructor still erroring (`SettingsPage.test.tsx:61`) is PRE-EXISTING rot (its mock is missing the Phase-147 `self_improve_enabled` field — the reported error is identical before and after my edit); `JudgeModelPicker.test.tsx` + `ControlRoomPage.test.tsx` use `as unknown as FullAppSettings` casts (field-check suppressed). Pre-existing rot logged to `deferred-items.md`.

## Verification Results

- `cd frontend && npx tsc -b` — **0 net-new type errors** (29 errors, identical file:line set to the committed baseline; `diff` of the sorted error locations = empty). `model-defaults.ts` + `model-defaults.test.ts` are tsc-clean.
- `cd frontend && npx vitest run src/lib/model-defaults.test.ts` — **12/12 passed**.
- `grep -c "model_discovery_filter_enabled" src/lib/api.ts` — **4** (≥ 2 required: FullAppSettings field + FlagKey member + 2 comment refs).
- `grep -c "export async function addModelById" src/lib/api.ts` — **1**.

### Acceptance criteria (all met)
- `familyDefaults("kimi-k3")` → non-null context (256000) + maxOutput (65536) + `tools === true`. ✓
- `familyDefaults("claude-opus-4-8").tools === true` and `.context` = 200000 (positive). ✓
- `familyDefaults("gpt-5.4").context` = 400000 (positive). ✓
- `familyDefaults("google")` (bare provider) → context 600000 (non-null). ✓
- `familyDefaults("somevendor/opaque-xyz")` → `{ context: null, maxOutput: null, tools: null }`. ✓
- substring matching is first-match-wins mirroring the MODEL_MARKS order. ✓

## Known Stubs

None. `familyDefaults` returns `null` for unrecognized ids **by documented contract** (D-159-03 / SC#3 — a blank input the operator fills), not as an unwired placeholder. No hardcoded empty values flow to UI rendering (this plan ships no components).

## Threat Flags

None. Client-only plan — no new network endpoint, auth path, or trust-boundary surface is introduced (the seam calls the already-shipped, `require_operator`-404-gated Plan-02 endpoint; the client adds NO authority; `AddModelBody` carries no `enabled` field so an add can never client-force-enable).

## Self-Check: PASSED

- FOUND: `frontend/src/lib/api.ts` (modified)
- FOUND: `frontend/src/lib/model-defaults.ts` (created)
- FOUND: `frontend/src/lib/model-defaults.test.ts` (created)
- FOUND: `frontend/src/pages/__tests__/SettingsPage.a11y.test.tsx` (modified)
- FOUND commit: `a0aba7b9` (feat(159-04): add model-registry client seam)
- FOUND commit: `82a10e37` (feat(159-04): add familyDefaults per-family capability pre-fill table)
