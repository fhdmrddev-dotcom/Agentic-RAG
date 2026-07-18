---
phase: 155-accessibility-sweep-wcag-aa
plan: 04
subsystem: ui
tags: [a11y, wcag, vitest-axe, aria, keyboard, react, admin, control-room]

# Dependency graph
requires:
  - phase: 155-03
    provides: jsx-a11y fix-to-zero + icon-button aria-label sweep (the source-level a11y fixes these suites assert as the frozen contract)
provides:
  - "vitest-axe zero-STRUCTURAL-violations regression gate on the Control Room Control-Plane sub-components (OperatorBand / HealthSignals / RecentActionsCard / LockedTab / TechnicalNamesToggle / ActiveRunsSection / CapabilityGrid / MaintenancePanel)"
  - "D-09 scenario-3 (automatable half): the kill-switch / Kill / arm-to-confirm destructive guards are asserted keyboard-operable by role + accessible-name"
  - "per-sub-component isolation (D-12 / Pitfall 3) — the custom tablist never renders inactive panels, so a page-level scan misses 4 of 5 tabs; these suites scan each leaf directly"
affects: [155-05, 155-06, 155-verify-work, future-wcag-aa-sweep]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "pure-presentational admin leaf a11y suite = render across props-driven honest states → settle (findBy) → expect(await axe(container)).toHaveNoViolations() + named role/name asserts (STRUCTURAL only; no provider/api mock needed — these leaves take showTechnical/enabled as props, not context)"
    - "destructive-guard a11y contract = role+accessible-name reachability (Kill button, role=switch kill-switches, arm-to-confirm Confirm/Cancel buttons) so the live keyboard drive can succeed"

key-files:
  created:
    - frontend/src/components/admin/__tests__/OperatorBand.a11y.test.tsx
    - frontend/src/components/admin/__tests__/HealthSignals.a11y.test.tsx
    - frontend/src/components/admin/__tests__/RecentActionsCard.a11y.test.tsx
    - frontend/src/components/admin/__tests__/LockedTab.a11y.test.tsx
    - frontend/src/components/admin/__tests__/TechnicalNamesToggle.a11y.test.tsx
    - frontend/src/components/admin/__tests__/ActiveRunsSection.a11y.test.tsx
    - frontend/src/components/admin/__tests__/CapabilityGrid.a11y.test.tsx
    - frontend/src/components/admin/__tests__/MaintenancePanel.a11y.test.tsx
  modified: []

key-decisions:
  - "Assert REAL contracts, not the plan's assumed vocabulary: HealthSignals loading = aria-busy (NOT role=status) and has NO error branch (the shell owns fetch/error); TechnicalNamesToggle = toggle-BUTTON (aria-pressed), NOT role=switch — both asserted as they exist NOW"
  - "The arm-to-confirm guard the plan attributed to CapabilityGrid actually lives on MaintenancePanel (CapabilityGrid flips DIRECTLY, 065-A) — the confirm-button contract is asserted on MaintenancePanel; CapabilityGrid asserts role=switch + aria-checked + never-colour-alone"
  - "No D-13 additive fixes needed — every leaf is already structurally axe-clean (155-03 did the source work); no D-14 exclusions needed — zero false positives surfaced"
  - "Radix Sheet open-state axe scan deliberately NOT run (the plan frames the sheet as the roles/names proof, not a structural scan of Radix internals); the three non-portal honest states carry the structural bar"

requirements-completed: []

# Metrics
duration: 4min
completed: 2026-07-15
---

# Phase 155 Plan 04: Control-Plane a11y suites Summary

**Eight vitest-axe `*.a11y.test.tsx` suites (44 tests) lock a zero-STRUCTURAL-violations regression gate on the Control Room Control-Plane admin leaves — including the keyboard-operable role+name contract on the kill-switch / Kill / arm-to-confirm destructive guards (D-09 scenario 3's automatable half) — asserting the components' ACTUAL contracts as shipped post-155-03, with zero component-source changes.**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-07-15T22:05:16Z
- **Completed:** 2026-07-15T22:09:xxZ
- **Tasks:** 2 (both `type=auto`)
- **Files created:** 8 (test-only)

## Accomplishments

- **Task 1 — shell + status leaves (5 suites, 24 tests):** `OperatorBand` (identity resolved / null / recording-pulse; role=status ledger marker; "Back to app" button; OPERATOR word), `HealthSignals` (resolved / loading / ⌥ technical; aria-busy loading; never-colour-alone status words), `RecentActionsCard` (populated / empty; sr-only "Change:" word for write rows), `LockedTab` (default / description; locked state = visible WORD; heading), `TechnicalNamesToggle` (unpressed / pressed; accessible name + aria-pressed reachable by role).
- **Task 2 — destructive-action guards (3 suites, 20 tests):** `ActiveRunsSection` (loading / empty / populated; Kill control role+name; bounded-run no-kill; confirm sheet role=dialog + named "End it now"/"Keep running"; aria-busy loading), `CapabilityGrid` (all-on / armed-off + count / ⌥ technical; 4× role=switch + accessible-name + aria-checked; never-colour-alone armed consequence words), `MaintenancePanel` (off / armed / on; region landmark; guarded trigger; arm-to-confirm Confirm/Cancel buttons; role=status ON banner).
- **Zero component source modified** — this was a test-only authoring pass; every leaf is already structurally axe-clean (155-03 shipped the source-level a11y fixes), so no D-13 additive fix and no D-14 exclusion was required.
- **D-12 / Pitfall 3 honored** — per-sub-component isolation (the custom Control Room tablist hides inactive panels, so a page-level scan misses 4 of 5 tabs); each leaf is scanned directly, matching the shipped DocumentDetailPanel/RelationshipsSection precedent.

## Task Commits

1. **Task 1: shell + status leaf a11y suites** — `b74481a9` (test)
2. **Task 2: destructive-action guard a11y suites** — `54aea02e` (test)

**Plan metadata:** this commit (docs: complete plan)

## Files Created

- `frontend/src/components/admin/__tests__/OperatorBand.a11y.test.tsx`
- `frontend/src/components/admin/__tests__/HealthSignals.a11y.test.tsx`
- `frontend/src/components/admin/__tests__/RecentActionsCard.a11y.test.tsx`
- `frontend/src/components/admin/__tests__/LockedTab.a11y.test.tsx`
- `frontend/src/components/admin/__tests__/TechnicalNamesToggle.a11y.test.tsx`
- `frontend/src/components/admin/__tests__/ActiveRunsSection.a11y.test.tsx`
- `frontend/src/components/admin/__tests__/CapabilityGrid.a11y.test.tsx`
- `frontend/src/components/admin/__tests__/MaintenancePanel.a11y.test.tsx`

## Decisions Made

- **Assert real contracts (critical_rules), not the plan's assumed honest-state vocabulary.** The plan's Task-1 action and acceptance criteria assumed `HealthSignals` exposes `role="status"` (loading) + `role="alert"` (error). The actual shipped component is a **pure presentational leaf**: loading is marked with `aria-busy` on its grids (not `role="status"`), and it has **no error branch at all** — the shell (`ControlRoomPage`) owns the fetch and error surfacing. The suite asserts the leaf's ACTUAL contract (`aria-busy` + absence of `role="alert"`) rather than inventing a role the component does not render. Adding `role=status/alert` to `HealthSignals` would be non-additive source scope creep and is not an axe violation (aria-busy is a valid loading pattern), so it was correctly NOT done.
- **`TechnicalNamesToggle` is a toggle-BUTTON, not a switch.** It renders `<button aria-pressed>` (not `role="switch"`). The suite asserts the accessible name ("Technical names", with the ⌥ glyph `aria-hidden`) + `aria-pressed` reflecting state — the real contract, not the plan's "switch/aria-pressed" phrasing.
- **The arm-to-confirm guard lives on `MaintenancePanel`, not `CapabilityGrid`.** Per 065-A, `CapabilityGrid` switches flip **directly** (emergency speed, no confirm dialog); only the platform-wide `MaintenancePanel` arms-to-confirm. So the plan's "CapabilityGrid kill-switch confirm step is a button" acceptance maps to `MaintenancePanel` (asserted there: the Confirm/Cancel buttons are queryable by role+name). `CapabilityGrid`'s real contract — `role="switch"` + accessible-name + `aria-checked` + never-colour-alone armed words — is asserted in its own suite.
- **No provider/api/supabase mocking.** All 8 components are pure presentational leaves that take `showTechnical`/`enabled`/`rows`/`signals`/`runs`/`flags` as props (none call `useTechnicalNames()`), so no `TechnicalNamesProvider` wrap and no `@/lib/api` / `@/lib/supabase` mock is needed (confirmed by the existing non-a11y suites rendering them directly).

## Deviations from Plan

### Assert-real-contract adjustments (not auto-fixes — no source touched)

These are documented departures from the plan's ASSUMED component contracts, resolved per the executor critical-rule "assert the ACTUAL current contracts, do not invent." No component source was modified; no test assertion was weakened to force green.

**1. HealthSignals honest-state vocabulary (plan assumed role=status/alert; reality = aria-busy + no error branch)**
- **Found during:** Task 1 (reading `HealthSignals.tsx` before writing its suite)
- **Detail:** The plan's acceptance criterion "HealthSignals suite asserts distinct `role="status"` (loading) and `role="alert"` (error)" does not match the shipped leaf — loading = `aria-busy`, and there is no error branch (shell-owned). Asserted `aria-busy` loading + `queryByRole("alert")` absent instead.
- **Resolution:** Test asserts the real contract; component untouched. This is the honest a11y contract of a presentational leaf.

**2. CapabilityGrid confirm step (plan expected a confirm button; reality = direct flip, 065-A)**
- **Found during:** Task 2 (reading `CapabilityGrid.tsx`)
- **Detail:** The plan's acceptance "CapabilityGrid suite asserts the kill-switch confirm step is a button" assumes an arm-to-confirm on the grid; the grid flips directly. The arm-to-confirm confirm-button contract is asserted on `MaintenancePanel` (the component that actually owns it); CapabilityGrid asserts `role=switch` + `aria-checked` + never-colour-alone.
- **Resolution:** Contract asserted on the correct component; both components untouched.

**No axe violations surfaced** — no D-13 additive fix and no D-14 per-rule exclusion was needed. Every leaf is structurally axe-clean as shipped by 155-03.

## Real a11y Findings (D-13 / D-14)

- **D-13 additive fixes:** NONE. No shared `ui/*` primitive or admin component needed an aria fix — all eight leaves pass the structural axe scan across every honest state as they exist post-155-03.
- **D-14 documented exclusions:** NONE. No confirmed Radix false positive or unfixable rule required a per-rule/per-selector `enabled:false` exclusion. "Zero violations" here = zero violations, full stop (no exclusions to mirror into VALIDATION.md).

## Verification Results

- `cd frontend && npx vitest run src/components/admin/__tests__/{OperatorBand,HealthSignals,RecentActionsCard,LockedTab,TechnicalNamesToggle,ActiveRunsSection,CapabilityGrid,MaintenancePanel}.a11y.test.tsx` → **8 files / 44 tests, all GREEN** (run individually per task and all-together).
- Each suite calls `expect(await axe(container)).toHaveNoViolations()` after a settled render; STRUCTURAL rules only — **no "contrast" assertion anywhere** (jsdom cannot compute contrast; the D-03 live Chrome scan owns that half).
- Destructive guards asserted keyboard-reachable by role+name: ActiveRunsSection Kill (`role=button` "End run — …") + confirm dialog "End it now"; CapabilityGrid 4× `role=switch` + `aria-checked`; MaintenancePanel arm-to-confirm Confirm/Cancel buttons + `role=status` banner.
- No component source modified: `git diff --name-only b74481a9^..54aea02e` = only the 8 new `__tests__/*.a11y.test.tsx` files.

## Known Stubs

None — these are complete, green test suites, not stubs.

## User Setup Required

None — frontend test-only, no external service, no migration, no backend, no new package (`vitest-axe` already wired in `setupTests.ts`).

## Next Phase Readiness

- The Control-Plane cluster now has a permanent vitest-axe regression gate; a future structural a11y regression on these leaves fails CI.
- **155-05** (Governance/Registry: AuditTab / users / FeatureVisibility / ModelRegistryTab) and **155-06** (Run modal / Citation UI / 154 surfaces) extend the same per-sub-component isolation pattern.
- The LIVE D-03 Chrome color-contrast + button-name scan and the D-08/D-09 operator keyboard walkthrough (incl. scenario 3's live half — the operator personally keyboard-drives the `/admin` tab switch → kill-switch arm-to-confirm → audit receipt) remain the verify-work bar; these suites prove the roles/names exist so that live drive can succeed.

## Self-Check: PASSED

- Created files verified on disk: all 8 `frontend/src/components/admin/__tests__/*.a11y.test.tsx` (FOUND).
- Task commits verified in git: `b74481a9` (Task 1), `54aea02e` (Task 2) (FOUND).

---
*Phase: 155-accessibility-sweep-wcag-aa*
*Completed: 2026-07-15*
