---
phase: 149-model-registry-discovery
plan: 07
subsystem: ui
tags: [model-registry, operator-gated, control-room, instrument-table, propose-confirm, sc3-propose-only, two-layer-coupling, sketch-070a, sketch-071a, no-restart, sc10-uat]

# Dependency graph
requires:
  - phase: 149-04
    provides: "api.ts seams getModelRegistry/setModelCapability/setModelLock/runModelDiscovery + ModelRegistryRow/ModelCapabilityPatch/DiscoveryResult types + providerLogo() + the deprecated badge"
  - phase: 149-05
    provides: "GET /admin/models full-union read (capability_source OVR/DEF + enabled + deprecated + is_default/is_locked + overridden_fields) + PATCH /admin/models/{id} allowlist write (null-clears-to-DEF Reset) + deprecated column (mig 099)"
  - phase: 149-06
    provides: "PUT /admin/models/{id}/lock (lock/unlock) + POST /admin/models/discover (ephemeral propose-only diff {new,changed,vanished}+providers) + the two-part no-dead-default 409 guard + the disabled-model fallback notice"
  - phase: 146-148
    provides: "ControlRoomPage operator shell (band+tabs, LANG-01 ⌥ Technical-names, write-then-refetch + pulseRecording, the FeatureVisibility/CapabilityGrid/UsersAndAccess leaf patterns + the self-row disabled-affordance)"
provides:
  - "ModelRegistryTab.tsx — the 070-A capability instrument table: provider-grouped collapsible sections, inline click-to-edit numeric cells with OVR/DEF + null-clears Reset, a deprecated toggle (+reason) that stays enabled/selectable (D-149-04), the derived enabled→picker coupling chip (D-149-01), and a lock gated on disabled rows (courtesy over the Plan-06 409 wall) + in-row 409 refusal"
  - "ModelDiscoveryPanel.tsx — the 071-A propose→confirm panel: per-provider run cards (capabilities ✓ / IDs only / no-key / verbatim error), New/Changed/Vanished groups, amber unknown-you-set-it inputs (SC#3), enable-now gated on completeness (never auto-enabled), vanished flagged-not-deleted, ephemeral diff"
  - "ControlRoomPage: the Model Registry tab UNLOCKED (locked:false) + wired write-then-refetch (lazy fetch on tab-open, handleSetCapability/handleLock/handleRunDiscovery/handleConfirmDiscovery, pulseRecording on recorded writes)"
  - "api.ts: ModelRegistryRow.overridden_fields (the Plan-07 type extension) + DiscoveryResult reconciled to the real Plan-06 backend shape (the 149-06 handoff)"
  - "149-VALIDATION.md — the SC#10 4-axis cross-provider UAT rows (incl. the D-149-16 gpt-5.6 native_tools no-restart proof) + the filled Per-Task map, nyquist_compliant:true"
affects: [model-registry-tab, control-room, verify-work]

# Tech tracking
tech-stack:
  added: []  # zero new packages (@lobehub/icons + testing libs already present — T-149-SC)
  patterns:
    - "Pure-leaf props-in/DOM-out registry surfaces (FeatureVisibility lineage): the shell owns fetch + writes; leaves own only transient busy/receipt/error state — no optimistic flip, the shell re-fetches (server = source of truth, SC#1)"
    - "Panel-owned discovery→patch field-name mapping: the 071-A panel maps the discovery-service field names (context/max_output/native_tools) → the PATCH column names and hands the shell a flat {modelId,patch}[] to loop through setModelCapability (the plan-delegated onConfirm contract)"
    - "Client-side CAPS_PROVIDERS constant mirrors the backend _CAPS_PROVIDERS: the per-provider providers_summary carries names+status only (no capabilities_returned echo, T-149-04), so the 'capabilities ✓ / IDs only' badge derives from the documented google+openrouter matrix — per-field unknown still falls out of the UNKNOWN sentinel"
    - "The UNKNOWN sentinel string drives the SC#3 amber input per-field — a Google new model's native_tools is amber even though its token limits are green (RESEARCH Pitfall 2)"

key-files:
  created:
    - frontend/src/components/admin/ModelRegistryTab.tsx
    - frontend/src/components/admin/ModelDiscoveryPanel.tsx
    - frontend/src/components/admin/__tests__/ModelRegistryTab.test.tsx
    - frontend/src/components/admin/__tests__/ModelDiscoveryPanel.test.tsx
  modified:
    - frontend/src/lib/api.ts
    - frontend/src/components/admin/ControlRoomPage.tsx
    - frontend/src/components/admin/__tests__/ControlRoomPage.test.tsx
    - .planning/phases/149-model-registry-discovery/149-VALIDATION.md

key-decisions:
  - "onConfirm contract = (changes: {modelId, patch}[]) => Promise<void>: the panel owns the discovery→patch field-name mapping + the propose-only/completeness logic; the shell just loops setModelCapability + re-fetches (the plan delegated 'the shell routes to setModelCapability per model')."
  - "CAPS_PROVIDERS is a client constant (google+openrouter) mirroring the backend _CAPS_PROVIDERS, because the providers_summary omits capabilities_returned (T-149-04 no-echo); adding it to the backend would be out-of-plan scope."
  - "ModelRegistryTab takes rows: ModelRegistryRow[] | null — a null loading state (honest, mirrors UsersAndAccess) since the shell fetches lazily on tab-open."
  - "NumericCell uses a one-shot settled ref so an Enter-commit isn't re-fired by the blur that follows it (and an Escape-cancel isn't turned into a commit) — a single write per edit."

patterns-established:
  - "The two-layer pattern made visible (D-149-01): the derived ✓ in picker / ✕ hidden chip + the gated-on-disabled lock render the operator allowed-set → user-picker coupling as a first-class instrument column."

requirements-completed: [MODEL-01, MODEL-02]

# Metrics
duration: ~40min
completed: 2026-07-12
---

# Phase 149 Plan 07: Operator Model Registry Surfaces (070-A + 071-A) Summary

**The Model Registry tab is live: the 070-A capability instrument table edits every model's real columns inline (OVR-vs-DEF honesty + a null-clears Reset, a deprecated toggle that stays selectable, and the derived enabled→picker coupling chip with a lock gated on disabled rows), the 071-A discovery panel makes SC#3 propose-only the visible hero (un-returned capabilities are amber "unknown — you set it" inputs, a new model is never auto-enabled, vanished is flagged-not-deleted), the tab is unlocked + wired write-then-refetch in ControlRoomPage, and the SC#10 4-axis cross-provider UAT contract — including the D-149-16 gpt-5.6 "no restart" proof — is authored in 149-VALIDATION.md.**

## Performance

- **Duration:** ~40 min
- **Tasks:** 3 (Tasks 1 + 2 `tdd="true"`; Task 3 `auto`)
- **Files:** 8 (4 created, 4 modified)

## Accomplishments

- **Task 1 — `ModelRegistryTab.tsx` (070-A):** provider-grouped collapsible sections over a semantic instrument table; the three numeric columns (context / max-out / timeout) are inline click-to-edit cells writing the field patch through `onSetCapability`, each with an OVR (stored, primary) vs dim+italic DEF (inherited) tag and a **Reset** that appears only on an overridden field and sends an explicit `null` (clears to DEF, Plan 05 Task 3). native_tools + enabled are toggles; a **deprecated** toggle (+ optional reason) writes `{ deprecated }` through the SAME per-row busy→✎ receipt path and NEVER touches `enabled` (deprecated ≠ disabled, D-149-04 — the row stays selectable, the coupling chip unchanged). The derived **`✓ in picker` / `✕ hidden`** coupling chip is the two-layer pattern made visible (D-149-01); the 🔓/🔒 lock is **gated on a `✕ hidden` row** with a courtesy tooltip (the 148 self-row disabled-affordance — the Plan-06 lock-path 409 is the real wall). A rejected write surfaces its `ApiError` `detail` **in-row** (the 409 plain refusal — never a silent failure, D-149-09).
- **Task 2 — `ModelDiscoveryPanel.tsx` (071-A):** "Run discovery" → per-provider run cards from `result.providers` (capabilities ✓ for google/openrouter · IDs only for other ok providers · no key — skipped · the VERBATIM error status, excluded-not-failed). ✚ New / ± Changed / ⊘ Vanished groups; any capability equal to the `DISCOVERY_UNKNOWN` sentinel renders as an amber **"unknown — you set it"** input (a number input, or a native/none select for tools) — never a guessed value (SC#3). A new model's **Enable now** tick is disabled until every capability is provider-returned or hand-filled (never auto-enabled). Vanished models carry **mark-deprecated / disable / keep** — never a delete. The diff is ephemeral (D-149-12): Discard / navigate-away drops it; confirming maps the discovery field names to the PATCH columns and hands the shell a `{modelId,patch}[]`.
- **Task 3 — unlock + wire + VALIDATION:** flipped the `model-registry` tab def `locked:true → false` (dropped `lockedDescription`); added the lazy `fetchRegistry` on tab-open (alive.current guard, honest-degrade catch), and `handleSetCapability` / `handleLock` / `handleRunDiscovery` / `handleConfirmDiscovery` — each calls the api.ts seam, `pulseRecording()` after a recorded write, and re-fetches the registry (server = source of truth). Rendered `<ModelRegistryTab>` + `<ModelDiscoveryPanel>` in the mirrored branch. Authored the SC#10 4-axis UAT rows into `149-VALIDATION.md`.

## Task Commits

1. **Task 1: ModelRegistryTab 070-A capability instrument table** — `e668ed28` (feat) (test + impl together per the phase precedent; includes the api.ts type reconciliation)
2. **Task 2: ModelDiscoveryPanel 071-A propose-confirm (SC#3 hero)** — `5ec43b58` (feat) (test + impl together)
3. **Task 3: unlock + wire the Model Registry tab; author SC#10 UAT rows** — `3ba37266` (feat)

**Plan metadata:** committed by the orchestrator (SUMMARY.md + shared tracking files).

## Files Created/Modified

- `frontend/src/components/admin/ModelRegistryTab.tsx` — the 070-A instrument table leaf (created).
- `frontend/src/components/admin/ModelDiscoveryPanel.tsx` — the 071-A propose→confirm leaf (created).
- `frontend/src/components/admin/__tests__/ModelRegistryTab.test.tsx` — 7 tests: coupling chip, numeric-edit patch, deprecated-stays-selectable, gated-lock-on-disabled, enabled-lock-clickable, in-row 409, Reset-sends-null (created).
- `frontend/src/components/admin/__tests__/ModelDiscoveryPanel.test.tsx` — 5 tests: amber-unknown-input, run-card badges, enable-now disabled, vanished-no-delete, confirm routes onConfirm (created).
- `frontend/src/lib/api.ts` — `ModelRegistryRow.overridden_fields` (the Plan-07 type extension) + `DiscoveryResult` reconciled to the real Plan-06 shape (`{new,changed,vanished,providers}` + the `DISCOVERY_UNKNOWN` sentinel export).
- `frontend/src/components/admin/ControlRoomPage.tsx` — model-registry tab unlocked + wired (state, lazy fetch, 4 handlers, render branch).
- `frontend/src/components/admin/__tests__/ControlRoomPage.test.tsx` — moved the LockedTab assertion to the still-locked Secrets tab; added the unlocked-Model-Registry test.
- `.planning/phases/149-model-registry-discovery/149-VALIDATION.md` — filled Per-Task map + `nyquist_compliant:true` + the SC#10 4-axis Manual-Only rows.

## Decisions Made

- **`onConfirm({modelId,patch}[])`:** the panel owns the discovery→patch field-name mapping (`context`→`context_window_tokens`, `max_output`→`max_output_tokens`, `native_tools`→`native_tools`) + the propose-only/completeness logic; the shell just loops `setModelCapability` + re-fetches (the plan delegated the routing).
- **`CAPS_PROVIDERS` client constant:** the per-provider `providers_summary` carries names+status only (T-149-04 no-echo), so the "capabilities ✓ / IDs only" badge derives from the documented google+openrouter matrix; per-field unknowns still fall out of the `DISCOVERY_UNKNOWN` sentinel (so Google's native_tools is amber while its token limits are green — RESEARCH Pitfall 2).
- **`rows: … | null` loading state** + a **one-shot `settled` ref** in the numeric cell (one write per edit, no Enter+blur double-fire).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `api.ts ModelRegistryRow` extended with `overridden_fields`**
- **Found during:** Task 1 — the 070-A per-field OVR/DEF + Reset needs the field-level override list, but the Plan-04 `ModelRegistryRow` stub only carried the seven core fields.
- **Fix:** added `overridden_fields: string[]` (the exact `_MODEL_CAP_COLUMNS` names the Plan-05 `_registry_row` already emits). This is the extension the 149-04 + 149-05 SUMMARYs explicitly anticipated ("Plan 07 extends the TS type").
- **Committed in:** `e668ed28`

**2. [Rule 3 - Blocking] `api.ts DiscoveryResult` reconciled to the real Plan-06 backend shape**
- **Found during:** Task 2 — the Plan-04 stub (`{providers:[{new_models,…}]}`) was an interface-first placeholder; the Plan-06 backend actually returns `compute_diff`'s top-level `{new,changed,vanished}` + a per-provider `providers` outcome summary.
- **Fix:** replaced the stub types with `DiscoveredNewModel` / `DiscoveredChangedModel` / `DiscoveredVanishedModel` / `DiscoveryProviderOutcome` mirroring the wire, and exported the `DISCOVERY_UNKNOWN` sentinel. The 149-06 SUMMARY explicitly said "Plan 07's consuming tab reconciles the exact render shape." Nothing else imported the old types (verified).
- **Committed in:** `e668ed28`

**3. [Rule 1 - Bug/test] `ControlRoomPage.test.tsx` LockedTab assertion moved off the now-unlocked tab**
- **Found during:** Task 3 — the existing "a locked tab renders LockedTab" test clicked "Model Registry" (which this plan unlocks) and would now fail.
- **Fix:** re-pointed that assertion at the still-locked **Secrets** tab, and added a new test proving the Model Registry tab renders the editor + discovery (not a LockedTab) and lazily fetches the registry. Added `getModelRegistry` (+ the other three seams) to the test's `@/lib/api` factory mock.
- **Committed in:** `3ba37266`

**Total deviations:** 3 auto-fixed (2 pre-sanctioned type reconciliations + 1 test update). No scope creep — zero new packages, no backend touch, no new endpoints.

## Security (threat model)

- **T-149-18 (EoP):** the tab lives inside the operator-only Control Room shell (every /admin route is server 404-gated); the leaves render API-supplied data only, adding no authority.
- **T-149-19 (routing integrity / SC#3):** the discovery "enable now" tick is disabled unless capabilities are complete; un-returned fields are amber inputs — the UI cannot auto-enable a guessed capability (tested).
- **T-149-20 (repudiation):** every write flashes a ✎ receipt in-row and pulses the band recording marker; the server records the ledger row (Plan 05/06).
- **T-149-22 (dead default):** the lock control is gated + tooltipped on a `✕ hidden` row (courtesy) AND the server refuses 409 (Plan 06 lock-path guard) — the UI cannot pin a disabled model as the org default (tested + authored as UAT row 11).
- **T-149-SC:** zero new packages.

## Threat Flags

None. No new endpoints, auth paths, or trust boundaries — the leaves consume the existing operator-gated `/admin/models*` seams (Plan 05/06).

## Known Stubs

None. All four surfaces are wired end-to-end to the real api.ts seams. The SC#10 Manual-Only UAT rows are `status: pending` because they are LIVE cross-provider verifications executed at `/gsd:verify-work` — that is the manual-UAT contract, not a stub.

## TDD Gate Compliance

Tasks 1 + 2 are `tdd="true"`. Per the Plan-05/06 phase precedent, each task's test + implementation were committed together after the task's verify block ran green (component tests mock the api). This is a `type: execute` plan (no plan-level `type: tdd` gate), and no MVP+TDD runtime gate mode was passed by the orchestrator.

## Verification

- `npm run test -- ModelRegistryTab` → **7 passed**; `npm run test -- ModelDiscoveryPanel` → **5 passed**; `npm run test -- ControlRoomPage` → **7 passed**; `SettingsModelBadge` (149-04 regression) → **9 passed** (28 in the admin batch).
- `tsc -b` baseline **unchanged at 30** (21 SEED-056 `__tests__` rot + 9 React-19 `@types` drift); the touched files (ModelRegistryTab, ModelDiscoveryPanel, ControlRoomPage, api.ts + the tests) add **zero new errors**. `vite build` **exit 0** (green).
- `149-VALIDATION.md` grep gates pass: contains `gpt-5.6` + `parallel`/`long-message`/`multi-tool`.

## Self-Check: PASSED

- Created files verified present: `ModelRegistryTab.tsx`, `ModelDiscoveryPanel.tsx`, `ModelRegistryTab.test.tsx`, `ModelDiscoveryPanel.test.tsx`, `149-07-SUMMARY.md`.
- Modified files verified present: `api.ts`, `ControlRoomPage.tsx`, `ControlRoomPage.test.tsx`, `149-VALIDATION.md`.
- Commits verified in git log: `e668ed28` (Task 1), `5ec43b58` (Task 2), `3ba37266` (Task 3).
- STATE.md / ROADMAP.md NOT modified by this executor (orchestrator owns those writes).

---
*Phase: 149-model-registry-discovery*
*Completed: 2026-07-12*
