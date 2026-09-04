---
phase: 210-ground-truth-operability-and-failure-honesty
plan: 01
subsystem: ui
tags: [CONN-09, frontend, admin, control-room, live-connectors, governed-features, type-safety]
requires: []
provides:
  - "GovernedFeature type union contains 'live_connectors'"
  - "Control Room FeatureVisibility card for live_connectors with Off|On binary control"
  - "DEFAULT_VISIBILITY and greenlist state maps updated with live_connectors"
  - "Frontend typecheck at baseline 34 errors, count gate OK 114/114 total 5793"
affects: [210-02, 210-03, 211]
tech-stack:
  added: []
  patterns:
    - "Off|On binary control for global kill-switches (visual_workflow_canvas, live_connectors)"
key-files:
  created: []
  modified:
    - frontend/src/lib/api/_core.ts
    - frontend/src/components/admin/FeatureVisibility.tsx
    - frontend/src/components/admin/ControlRoomPage.tsx
    - frontend/src/components/admin/__tests__/FeatureVisibility.a11y.test.tsx
    - frontend/src/components/admin/__tests__/ControlRoomPage.test.tsx
    - frontend/src/components/admin/revertByteIdentical.test.tsx
key-decisions:
  - "D-210-01: Restrict live_connectors card in Control Room to an Off | On binary toggle (writing 'off' and 'everyone')."
  - "D-210-02: Widen GovernedFeature type union in frontend/src/lib/api/_core.ts, fulfilling D-190-DEF-09."
  - "D-210-03: Update all exhaustive Record<GovernedFeature, ...> maps across admin page, feature visibility, and test fixtures in lockstep."
patterns-established:
  - "Binary kill-switches in FeatureVisibility reuse the Off|On SegButton control rather than the 3-audience triad."
requirements-completed: [CONN-09]
duration: 15min
completed: 2026-08-26
---

# Phase 210 Plan 01: Operator Control Room `live_connectors` Card & Type Union Summary

**`live_connectors` is formally added to `GovernedFeature`, given an Off|On binary control card in the operator Control Room, and synchronized across all exhaustive maps at the clean 34-error typecheck baseline and 114/114 count gate.**

## Performance
- **Tasks:** 2 tasks completed
- **Files modified:** 6 files
- **Typecheck:** 34 errors (exact baseline, 0 in touched files)
- **Count Gate:** OK (114/114 pinned, 0 failing, total 5793)

## Accomplishments
1. **Widened `GovernedFeature` Union:** Added `"live_connectors"` to `GovernedFeature` in `frontend/src/lib/api/_core.ts`, fulfilling `D-190-DEF-09`.
2. **Added Control Room Card:** Created the `live_connectors` card with `Plug` glyph and description in `FeatureVisibility.tsx`, wired to the binary `Off | On` `AudienceSegments` control.
3. **Synchronized Exhaustive Maps:** Updated `DEFAULT_VISIBILITY` (`live_connectors: "off"`) and `greenlist` in `ControlRoomPage.tsx`, plus test fixtures in `FeatureVisibility.a11y.test.tsx`, `ControlRoomPage.test.tsx`, and `revertByteIdentical.test.tsx`.
4. **Respected 211 Boundary:** Kept `connectionsCopy.ts` untouched within Phase 211's fence; its existing cast continues to work seamlessly.

## Verification
- `npx tsc --noEmit -p tsconfig.app.json`: 34 errors (baseline).
- `npm test -- src/components/admin/__tests__/FeatureVisibility.a11y.test.tsx src/components/admin/revertByteIdentical.test.tsx src/components/admin/__tests__/ControlRoomPage.test.tsx`: 20/20 tests passed.
- `node scripts/vitest-count-gate.cjs`: OK 114/114 pinned, 0 failing, total 5793.
