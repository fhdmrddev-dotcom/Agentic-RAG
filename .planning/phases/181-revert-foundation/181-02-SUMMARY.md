---
phase: 181-revert-foundation
plan: 02
subsystem: ui
tags: [feature-flag, feature-visibility, react, typescript, vitest, revert, governance, control-room]

# Dependency graph
requires:
  - phase: 181-01 (revert-foundation, backend)
    provides: the backend visual_workflow_canvas key + "off" audience enum + PUT /admin/visibility off-allowlist + GET /features off-bypass + require_canvas 404 gate — the contract this frontend wires to
  - phase: 148-feature-visibility (v3.3)
    provides: the GovernedFeature union, FeatureAudience enum, the FeatureVisibility card (069-A) + AudienceSegments/SegButton primitives, DEFAULT_VISIBILITY seed, visibleNavItems filter, and getFeatureVisibility WR-05 server-seed — reused ~95% verbatim
provides:
  - "GovernedFeature += visual_workflow_canvas and FeatureAudience += \"off\" (the SEED-115 enum-not-boolean contract) — the canvas key joins the GET /features effective map + the nav filter automatically"
  - "A 5th FeatureDef in the FeatureVisibility card that, for this key ONLY, renders a two-position Off | On operator control (On writes audience \"everyone\", Off writes \"off\") instead of the Everyone|Operators|By-role triad"
  - "DEFAULT_VISIBILITY + the greenlist seed carry the canvas key at cold-default \"off\" (byte-identical to the backend _GOVERNED_FEATURES); handleSetVisibility routes off/everyone through the existing setFeatureVisibility writer unchanged"
  - "revertByteIdentical.test.tsx — the frontend half of the D-181-06 acceptance gate: nav-set byte-identity (REVERT-01) + the Off|On operator-control contract (D-181-03), riding the existing frontend-tests.yml (REVERT-02, no new CI job)"
affects: [182-server-validation-seam, 183-read-only-canvas, 184-editable-canvas, every-later-v3.6-canvas-nav-entry]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "The \"off\" audience is a 5th FeatureAudience enum member threaded through the FE via the type union (never a boolean, SEED-115); AudienceValue = FeatureAudience | \"role\" picks it up automatically"
    - "Per-key control variant: AudienceSegments branches on a single `offOn` flag (def.key === visual_workflow_canvas) to swap the triad for a two-position Off|On, reusing the SegButton primitive + onFlip plumbing verbatim — the one net-new UI shape"
    - "Nav byte-identity by construction: no NAV_ITEMS entry is tagged with the canvas key in 181 (it lands WITH the view in 183), so visibleNavItems is provably unchanged whether the canvas key is present-false, present-true, or absent"

key-files:
  created:
    - frontend/src/components/admin/revertByteIdentical.test.tsx
  modified:
    - frontend/src/lib/api.ts
    - frontend/src/components/admin/FeatureVisibility.tsx
    - frontend/src/components/admin/ControlRoomPage.tsx
    - frontend/src/components/admin/__tests__/FeatureVisibility.a11y.test.tsx
    - frontend/src/components/admin/__tests__/ControlRoomPage.test.tsx

key-decisions:
  - "D-181-03 (FE): the visual_workflow_canvas operator control is a two-position Off | On toggle (On writes audience \"everyone\", Off writes \"off\") reusing the FeatureVisibility card + SegButton primitive verbatim — NOT the Everyone|Operators|By-role triad. Implemented by branching AudienceSegments on an `offOn` prop."
  - "D-181-01 (FE half): GovernedFeature += visual_workflow_canvas and FeatureAudience += \"off\" (SEED-115 enum-not-boolean); the canvas cold-defaults \"off\" and joins the GET /features map + the nav filter automatically."
  - "REVERT-01 (FE): visibleNavItems stays byte-identical with the canvas key present because no NAV_ITEMS entry is tagged visual_workflow_canvas until 183; the ChatLayout render-guard vitest is DEFERRED to land WITH the first canvas ActiveView render branch in 182/183 (there is no canvas view to guard in 181)."

patterns-established:
  - "A per-key control variant inside FeatureVisibility: pass `offOn={def.key === \"visual_workflow_canvas\"}` to AudienceSegments to render Off|On; every OTHER key keeps the triad. Future single-master-switch features reuse this flag rather than forking the card."
  - "Every future canvas nav entry (183+) tags a NAV_ITEMS row with `feature: \"visual_workflow_canvas\"`; until then revertByteIdentical.test.tsx asserts the tag is ABSENT so nav parity is provable."

requirements-completed: [REVERT-01, REVERT-02]

# Metrics
duration: 17min
completed: 2026-07-24
---

# Phase 181 Plan 02: Revert Foundation (frontend off-switch) Summary

**The `visual_workflow_canvas` governed key + `"off"` audience threaded through the frontend feature machinery, a two-position Off | On operator control in the reused Phase-148 FeatureVisibility card, and the `revertByteIdentical` vitest locking flag-off nav byte-identity — frontend-only, zero backend/migration/package, riding the existing CI.**

## Performance

- **Duration:** ~17 min
- **Started:** 2026-07-24T15:34:39Z
- **Completed:** 2026-07-24T15:51:52Z
- **Tasks:** 2
- **Files modified:** 6 (1 created, 5 modified)

## Accomplishments
- Extended `GovernedFeature` (+ `visual_workflow_canvas`) and `FeatureAudience` (+ `"off"`) in `api.ts` (D-181-01, SEED-115 enum-not-boolean). `EffectiveFeatures`, `AudienceValue`, `getFeatureVisibility`, and the nav filter pick up the additions automatically — no generic-plumbing edits.
- Appended the 5th `FeatureDef` and, for THIS key only, a two-position **Off | On** control (D-181-03): `AudienceSegments` branches on an `offOn` flag to render two `SegButton`s (On → `onFlip("everyone")`, Off → `onFlip("off")`) reusing the primitive verbatim; the other 4 keys keep the Everyone|Operators|By-role triad. Added an `"off"` receipt case so an Off flip reads "Turned Off · recorded".
- Seeded the canvas key at cold-default `"off"` in `DEFAULT_VISIBILITY` + the greenlist map; `handleSetVisibility`'s non-`role` branch routes `"off"`/`"everyone"` through the existing `setFeatureVisibility` writer unchanged; `fetchVisibility` (WR-05 server-seed) honors an `"off"` record type-safely.
- Shipped `revertByteIdentical.test.tsx` (7 tests, all green): nav-set byte-identity under `visual_workflow_canvas: false|true` + a scope-freeze guard that no `NAV_ITEMS` entry is tagged with the canvas key, plus the Off|On operator-control contract (exactly two radios, On→`"everyone"`, Off→`"off"`). Rides `frontend-tests.yml` (`npm test`) — no new CI job (REVERT-02).

## Task Commits

Each task was committed atomically:

1. **Task 1: extend the feature types + the 5th FeatureDef with an Off|On control** — `4e1d1657` (feat)
2. **Task 2: revertByteIdentical.test.tsx — nav-set parity + the Off|On card gate** — `d29b955c` (test)

**Plan metadata:** _(this commit)_ (docs: complete plan)

## Files Created/Modified
- `frontend/src/lib/api.ts` — `GovernedFeature` += `visual_workflow_canvas`; `FeatureAudience` += `"off"` (+ doc comments). Type-only, runtime-inert.
- `frontend/src/components/admin/FeatureVisibility.tsx` — 5th `FeatureDef`; `AudienceSegments` gains an `offOn` branch (two `SegButton`s Off|On for the canvas key); an `"off"` receipt case; the `AudienceValue` type picks up `"off"` automatically.
- `frontend/src/components/admin/ControlRoomPage.tsx` — `DEFAULT_VISIBILITY` + the greenlist init seed the canvas key (cold-default `"off"`).
- `frontend/src/components/admin/revertByteIdentical.test.tsx` — the frontend acceptance gate (nav parity + Off|On card).
- `frontend/src/components/admin/__tests__/FeatureVisibility.a11y.test.tsx` — `ALL_EVERYONE` map gains the canvas key (Rule 3 type fix under the widened union).
- `frontend/src/components/admin/__tests__/ControlRoomPage.test.tsx` — the `getFeatureVisibility` mock gains the canvas record (Rule 3 type fix).

## Decisions Made
None beyond the plan — followed the locked D-181-01/D-181-03 decisions as specified. The `"off"` audience type + the Off|On two-position variant for the one canvas key are the sole net-new frontend logic; everything else is ~95% verbatim reuse of the shipped Phase-148 feature-visibility surface.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added the canvas key to the two governed-feature test maps under the widened union**
- **Found during:** Task 1 (type-check)
- **Issue:** Widening `GovernedFeature` with a 5th key makes every full `Record<GovernedFeature, …>` object literal a missing-property type error. Two test files enumerate all keys: `FeatureVisibility.a11y.test.tsx` (`ALL_EVERYONE`) and `ControlRoomPage.test.tsx` (the `getFeatureVisibility` mock). Under `tsc -b`/build they would fail to compile.
- **Fix:** Added `visual_workflow_canvas` to both maps (`ALL_EVERYONE: "everyone"`; the mock: `{ audience: "off", roles: [] }`). Both suites stay green (22 tests across the touched suites).
- **Files modified:** `FeatureVisibility.a11y.test.tsx`, `ControlRoomPage.test.tsx`
- **Verification:** `npx tsc --noEmit` exits 0; the touched suites + `revertByteIdentical` all pass.
- **Committed in:** `4e1d1657` (Task 1 commit)

**2. [Rule 1 - Bug] Added an `"off"` case to the FeatureVisibility flip receipt**
- **Found during:** Task 1 (FeatureVisibility Off|On control)
- **Issue:** The shared `write()` receipt ternary mapped any non-`operators`/non-`role` audience to "Set to Everyone · recorded". An Off flip (`next === "off"`) would falsely announce "Set to Everyone".
- **Fix:** Added a `next === "off" → "Turned Off · recorded"` branch. The On flip (`"everyone"`) keeps "Set to Everyone" (accurate — audience is literally everyone).
- **Files modified:** `FeatureVisibility.tsx`
- **Verification:** No regression — the branch only fires for `"off"` (canvas-only); a11y + card tests green.
- **Committed in:** `4e1d1657` (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking type fix, 1 receipt bug). Both in-scope — directly caused by the task's type widening + the new Off|On control. No scope creep; the 6 planned files are the only source touched.

## Issues Encountered
- The `gsd-sdk` `state.record-metric` / `state.add-decision` / `state.record-session` verbs rejected both positional and flag args ("summary required" / "phase, plan, and duration required") — the documented gsd-sdk verb-arg gap. `state.advance-plan`, `roadmap.update-plan-progress`, and `requirements.mark-complete` succeeded. STATE.md frontmatter `completed_plans` (1→2) + the Current Position block were hand-edited surgically (the durable decision/metric record lives in this SUMMARY's frontmatter).

## Deferred Issues (out of scope — logged, NOT fixed)
The wave-merge full `npx vitest run` showed **31 pre-existing failures across 10 files** (1846 passing / 205 files) and `npx tsc -b` shows 33 pre-existing type errors — ALL in unrelated subsystems (`streamsProvider*`, `MessageItem`, `IngestionPage`, `useMessages`, `PublishGauntlet`, `soulData`, `model-info`, `api.test.ts`, chat/panel/skills). This plan's only runtime-source edits are admin-only (`FeatureVisibility`/`ControlRoomPage`, imported by no failing file) and **type-only** union additions in `api.ts` (erased at runtime) — so no importing file's behavior changed. All 4 touched/created suites are GREEN. Documented SEED-056 frontend-vitest rot + streaming-reliability rot. Details in `deferred-items.md`. Phase 181 Plan 02 introduces **zero net-new failures**.

## Scope-Freeze Verification (D-181-08)
`git diff --name-only HEAD~2..HEAD` touches only the 6 planned files. The FROZEN files (`WorkflowDoorSwitch.tsx`, `WorkflowBuilderPage.tsx`, `WorkflowsPage.tsx`, `PhaseTimeline.tsx`, `PhaseCard.tsx`, the harness engine) and ALL of `backend/` are ABSENT from the diff. No `supabase/migrations/*`, no `package.json` delta (zero migration, zero package — D-181-05).

## User Setup Required
None — no external service configuration required.

## Next Phase Readiness
- The frontend now knows the `visual_workflow_canvas` key + `"off"` audience end-to-end, and an operator has a working Off | On toggle in the reused FeatureVisibility card.
- **Plan 03** (the phase scope-freeze diff gate) remains for Phase 181.
- **182/183** land the deferred `ChatLayout` render-guard vitest WITH the first canvas `ActiveView` render branch, and tag the first `NAV_ITEMS` canvas entry (at which point `revertByteIdentical`'s "no canvas nav entry" guard is intentionally superseded by the render-guard).
- Every later canvas nav entry tags its `NAV_ITEMS` row with `feature: "visual_workflow_canvas"`; the effective-map filter (`visibleNavItems`) already handles it generically.

## Self-Check: PASSED
- Created file exists on disk: `frontend/src/components/admin/revertByteIdentical.test.tsx`.
- Both task commits exist in git history: `4e1d1657` (feat), `d29b955c` (test).

---
*Phase: 181-revert-foundation*
*Completed: 2026-07-24*
