---
phase: 149-model-registry-discovery
plan: 04
subsystem: ui
tags: [react, typescript, model-registry, lobehub-icons, settings, chat-picker, api-client]

# Dependency graph
requires:
  - phase: 075.3
    provides: ModelPillRow component + verified/unverified badge + FullAppSettings.verified_models/inferred_provider_for
  - phase: 128
    provides: providerLogo() single-source @lobehub deep-subpath helper (ICON CONVENTION)
  - phase: 147
    provides: api.ts admin-seam shape (getAuthHeaders + ApiError + {runs} envelope-unwrap precedent)
provides:
  - api.ts model-registry client seams (getModelRegistry / setModelCapability / setModelLock / runModelDiscovery)
  - ModelRegistryRow / ModelCapabilityPatch / DiscoveryResult TS types (the Plan-07 interface-first contract)
  - FullAppSettings.deprecated_models?: string[] field (Plan-05 payload target)
  - deprecated model badge + provider-logo grouping + demoted capability info in both pickers
affects: [149-05, 149-06, 149-07, model-registry-tab, settings-model-picker, chat-model-picker]

# Tech tracking
tech-stack:
  added: []  # zero new packages — @lobehub/icons already in package.json
  patterns:
    - "Interface-first api.ts contract — client seams + types defined in the Wave-1 plan, consumed by the later admin-tab plan"
    - "Envelope-unwrap in the client, never in the component (getModelRegistry returns .models — CR-01 precedent)"
    - "Dedicated PUT lock endpoint (D-149-07) SEPARATE from the PATCH capability seam"
    - "409 server-detail preservation via errorDetail() string helper for plain-language refusals"
    - "Optional + defensively-defaulted picker props (absent → empty set → renders exactly as before)"

key-files:
  created:
    - .planning/phases/149-model-registry-discovery/149-04-SUMMARY.md
  modified:
    - frontend/src/lib/api.ts
    - frontend/src/components/settings/ModelPillRow.tsx
    - frontend/src/components/chat/MessageInput.tsx
    - frontend/src/pages/SettingsPage.tsx
    - frontend/src/__tests__/components/SettingsModelBadge.test.tsx

key-decisions:
  - "setModelLock targets a dedicated PUT /admin/models/{id}/lock endpoint, separate from the PATCH capability seam (D-149-07)"
  - "getModelRegistry unwraps the {models} envelope in the client (CR-01 precedent), not in the component"
  - "Added errorDetail() string helper (mirrors proposalError) so the write seams surface the server 409 detail for plain-language refusals"
  - "deprecated + unverified badges share the amber-chip styling; a model can carry both; the pill stays selectable (badge only, no refusal)"
  - "MessageInput capability info demoted from two inline secondary lines to a single hover tooltip so the model name is primary (D-149-17)"

patterns-established:
  - "Interface-first: the Wave-1 plan ships the typed contract; the admin-tab plan (07) imports it"
  - "Defensive optional picker props keep the per-task build green before the backend payload lands"

requirements-completed: [MODEL-01, MODEL-02]

# Metrics
duration: ~30min
completed: 2026-07-12
---

# Phase 149 Plan 04: Frontend Registry Contract + Picker Visual Polish Summary

**Typed api.ts model-registry seams (read / capability-PATCH / dedicated lock-PUT / discover) + ModelRegistryRow/ModelCapabilityPatch/DiscoveryResult types + a FullAppSettings.deprecated_models field, plus a visual-only picker pass adding @lobehub provider logos, a selectable amber `deprecated` badge, and demoted capability info in both the Settings and chat model pickers.**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-07-12T06:42:00Z (approx)
- **Completed:** 2026-07-12T07:12:18Z
- **Tasks:** 2
- **Files modified:** 5 (4 source + 1 test)

## Accomplishments
- Four interface-first api.ts client seams (`getModelRegistry`, `setModelCapability`, `setModelLock`, `runModelDiscovery`) + three exported types — the contract Plan 07's Model Registry tab imports and Task 2's picker reads.
- `FullAppSettings.deprecated_models?: string[]` declared so the picker reads it defensively and Task 2 compiles clean before Plan 05 ships the backend payload.
- Both model pickers (Settings `ModelPillRow` + chat `MessageInput`) now show the active provider's single-source `@lobehub` logo, demote context/output info off the primary line, and light up a selectable `deprecated` badge — a bounded visual pass on the same components, no redesign (D-149-17 / D-149-05).

## Task Commits

Each task was committed atomically:

1. **Task 1: api.ts registry client seams + types + FullAppSettings.deprecated_models** - `3d32473f` (feat)
2. **Task 2 (RED): failing test for deprecated model badge** - `948db2e7` (test)
3. **Task 2 (GREEN): picker visual polish — provider logos, deprecated badge, demoted info** - `d077d680` (feat)

**Plan metadata:** committed separately with this SUMMARY.

_Task 2 is a TDD task (test → feat cycle; no refactor commit needed — the GREEN implementation was already clean)._

## Files Created/Modified
- `frontend/src/lib/api.ts` - Added the four `/admin/models*` client seams, `ModelRegistryRow`/`ModelCapabilityPatch`/`DiscoveryResult` types, the `errorDetail()` string helper, and `FullAppSettings.deprecated_models?`.
- `frontend/src/components/settings/ModelPillRow.tsx` - Added optional `deprecatedModels?: Set<string>` (amber `deprecated` chip, still selectable) + optional `providerId` logo-group header via `providerLogo()`.
- `frontend/src/components/chat/MessageInput.tsx` - Per-row provider logo (Cpu fallback) + capability info demoted from inline lines to a hover tooltip + optional `deprecatedModels` badge.
- `frontend/src/pages/SettingsPage.tsx` - New `deprecatedModels` state seeded defensively from `FullAppSettings.deprecated_models`; passes `deprecatedModels` + `providerId={activeProvider}` to `ModelPillRow`.
- `frontend/src/__tests__/components/SettingsModelBadge.test.tsx` - Extended with the `deprecated` badge matrix (member → badge + clickable; non-member → none; undefined set → no error).

## Decisions Made
- **Dedicated lock endpoint:** `setModelLock` → `PUT /admin/models/{id}/lock` with `{ locked }`, kept separate from the `PATCH` capability seam (D-149-07); both surface a 409 as `ApiError` with the server `detail`.
- **Client-side envelope unwrap:** `getModelRegistry` returns `.models` in the client (CR-01 precedent) so components never receive a `{models}` wrapper.
- **`errorDetail()` helper:** added a string-returning sibling of `proposalError` so the write seams preserve the server's plain-language 409 refusal instead of a generic message.
- **Badge styling:** the `deprecated` chip reuses the amber `unverified` chip classes; a model can carry both; the pill stays a clickable `<button>` (no `disabled`).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Test file lives at a different path than the plan's frontmatter**
- **Found during:** Task 2 (test extension)
- **Issue:** The plan's `files_modified` + `<files>` name `frontend/src/components/settings/__tests__/SettingsModelBadge.test.tsx`, but the existing badge test actually lives at `frontend/src/__tests__/components/SettingsModelBadge.test.tsx`. Creating a new file at the plan's path would have produced a duplicate test module for the same component.
- **Fix:** Extended the real existing test file in place (the plan's intent was "extend the existing badge test").
- **Files modified:** frontend/src/__tests__/components/SettingsModelBadge.test.tsx
- **Verification:** `npx vitest run src/__tests__/components/SettingsModelBadge.test.tsx` → 9/9 green.
- **Committed in:** 948db2e7 (RED) + assertions satisfied at d077d680 (GREEN)

**2. [Rule 3 - Blocking] SettingsPage.tsx (coupled caller) modified though absent from frontmatter files_modified**
- **Found during:** Task 2 (wiring the new props)
- **Issue:** The plan's Task 2 action explicitly instructs updating the `ModelPillRow` caller (SettingsPage) to pass `deprecatedModels`, but `SettingsPage.tsx` is not listed in the plan frontmatter's `files_modified`. `noUnusedLocals`/prop-wiring require the caller change to co-commit with the component change for a green per-task build.
- **Fix:** Added a `deprecatedModels` state seeded defensively in `hydrate()` and passed `deprecatedModels` + `providerId` to `ModelPillRow`, co-committed in the GREEN commit.
- **Files modified:** frontend/src/pages/SettingsPage.tsx
- **Verification:** `tsc -b` baseline unchanged (30, zero new in touched files); `vite build` exit 0.
- **Committed in:** d077d680 (Task 2 GREEN commit)

---

**Total deviations:** 2 auto-fixed (both Rule 3 - blocking/path corrections)
**Impact on plan:** Both are path/wiring corrections required to honor the plan's own action text and keep the build green. No scope creep — no new files, no new packages, no behavior beyond the plan's contract + visual pass.

## Known Stubs / Intentional Forward-Contracts

These are NOT defects — they are deliberate cross-plan handoffs matching the plan's interface-first design:

- **api.ts registry seams unconsumed yet.** `getModelRegistry`/`setModelCapability`/`setModelLock`/`runModelDiscovery` are the typed contract; Plan 07's Model Registry tab imports them, and Plans 05/06 own the backend routes. Interface-first by design (the plan's objective).
- **`deprecated` badge dark until Plan 05.** The badge reads `FullAppSettings.deprecated_models`, which Plan 05 populates in the backend settings payload. Absent → empty set → no badge (defensive). Wired end-to-end for the Settings picker; lights up once Plan 05 ships the field.
- **MessageInput `deprecatedModels` prop unwired.** The optional prop + badge render logic are present (symmetric treatment), but ChatArea is not in this plan's `files_modified`, so the prop is left unwired (defensive default → no badge). A future wire from ChatArea lights it up — mirrors the ModelPillRow-waits-on-Plan-05 pattern.

## Threat Flags

None. The api.ts seams call the operator-gated `/admin/models*` routes covered by the plan's threat register (T-149-08 mitigate — the client adds no authority; the backend `require_operator` 404 gate is the sole wall). No new client-side authority, no new endpoints beyond the enumerated contract.

## Issues Encountered
None — planned work proceeded cleanly. The `tsc -b` gate carries the known 30-error baseline (21 SEED-056 `__tests__` rot + 9 React-19 `@types` drift); confirmed the touched files add zero new errors (baseline unchanged at 30) and `vite build` stays green (exit 0), per the phase build-gate lesson.

## User Setup Required
None — no external service configuration required.

## Next Phase Readiness
- The api.ts contract is ready for Plan 07's Model Registry tab to import (seams + types + lock endpoint path aligned with Plans 05/06).
- The `deprecated_models` field is ready for Plan 05 to populate; the picker badge lights up automatically once the payload lands.
- No blockers.

## Self-Check: PASSED

- Files exist: FOUND api.ts, ModelPillRow.tsx, MessageInput.tsx, SettingsPage.tsx, SettingsModelBadge.test.tsx
- Commits exist: FOUND 3d32473f, 948db2e7, d077d680
- api.ts exports all 4 registry seams (seam-count = 4)
- SettingsModelBadge tests: 9/9 green
- tsc -b baseline unchanged (30, zero new in touched files); vite build exit 0

---
*Phase: 149-model-registry-discovery*
*Completed: 2026-07-12*
