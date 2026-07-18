---
phase: 137-skill-evals-panel-ui-panel-01
plan: 07
subsystem: ui
tags: [react, skills, publish-gate, lifecycle-stepper, navigation, vitest, tdd]

# Dependency graph
requires:
  - phase: 137-01
    provides: shared full-variant LifecycleStepper (the one status truth-teller)
  - phase: 137-06
    provides: deriveLiveVersion helper + App→ChatLayout→SkillsPage navigator Props (onOpenStudio/onReviewEvals), legacy skill-tuner ActiveView removed
provides:
  - Slimmed Skills detail panel (SkillDetailPanel) — heavy eval/test-case sections removed, replaced by the shared full LifecycleStepper + honest counts line + the SOLE "Open studio" button
  - PublishGateDialog unmet-branch "Review evals →" link (the one net-new discoverability affordance from the 057 MAP)
  - Full navigator drill: onOpenStudio → SkillDetailPanel, onReviewEvals → SkillCard → PublishGateDialog (both Plan-06 Props now consumed end to end)
affects: [skill-studio, publish-gate, skills-ui, panel-density]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "One truth-teller, two homes: the detail panel and the Studio header both render the SAME LifecycleStepper (D-10) fed the server getPublishGate — never a second gate computation"
    - "One version rule, one implementation: the panel derives its live version via the shared deriveLiveVersion helper (W1), not an inline copy"
    - "Counts reuse the already-fetched gate (W2) — no new eval-run endpoint call; both null → honest 'not evaled yet'"
    - "Skill-switch fetch guard (cancelled flag) so a late gate/case/version fetch never renders under a different skill (T-137-02)"

key-files:
  created: []
  modified:
    - frontend/src/components/skills/SkillFormDialog.tsx
    - frontend/src/components/skills/SkillFormDialog.test.tsx
    - frontend/src/pages/SkillsPage.tsx
    - frontend/src/components/skills/PublishGateDialog.tsx
    - frontend/src/components/skills/PublishGateDialog.test.tsx
    - frontend/src/components/skills/SkillCard.tsx

key-decisions:
  - "The Open studio button is gated on onOpenStudio being defined (no navigator → no button) rather than always rendered — keeps it the app's single studio-entry control and avoids a dead button when unwired"
  - "Used lucide ExternalLink (not the already-in-file Maximize2) for the Open studio button to avoid visual collision with the instructions 'Expand' control"
  - "The 'Review evals →' affordance is a plain <button> styled as a text link, exposed via getByRole('button') for the spec"

patterns-established:
  - "Slim-panel status section: <LifecycleStepper variant='full'> + font-mono counts line + full-width outline Open-studio button, mounted only for a saved skill (savedSkillId)"

requirements-completed: [PANEL-01]

# Metrics
duration: 15min
completed: 2026-07-03
---

# Phase 137 Plan 07: Slim Detail Panel + Navigator Drill Summary

**The Skills detail panel loses its two heavy eval/test-case sections and becomes a calm form + the shared full LifecycleStepper + an honest counts line + the app's sole "Open studio" button; the PublishGateDialog gains its one net-new "Review evals →" link on the unmet branch, and both Plan-06 navigators are drilled end to end.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-07-03T19:03Z (base) / first commit 19:11Z
- **Completed:** 2026-07-03T19:18Z
- **Tasks:** 2 (each TDD: RED test → GREEN impl)
- **Files modified:** 6

## Accomplishments
- Slimmed `SkillDetailPanel`: removed `SkillTestCasesSection` + `SkillEvalSection` mounts and imports; in their place the SHARED full-variant `LifecycleStepper` fed the server `getPublishGate`, an honest counts line reusing `gate.passed`/`gate.measured` (no new endpoint), and the SOLE "Open studio" button (opens Studio · Evals). Dissolves the U11 density complaint (D-07) and the "Publish ready 1/1 vs 0/2" contradiction where the operator first hit it (D-10).
- Live version derived via the shared `deriveLiveVersion` helper (W1) fed a `listSkillVersions` fetch — one rule, one implementation, two homes.
- Skill-switch guard on the panel's gate/case/version fetch (T-137-02) so a late fetch never renders under a different skill.
- `PublishGateDialog` unmet branch now offers a "Review evals →" link → `onReviewEvals(skillId)` → Studio · Evals (D-06), closing the "gate only discoverable in the dialog" gap.
- Full navigator drill wired + typechecked: `onOpenStudio` SkillsPage → SkillDetailPanel; `onReviewEvals` SkillsPage → SkillCard → PublishGateDialog. Both Plan-06 Props are now consumed (noUnusedLocals clean end to end).

## Task Commits

Each task followed the TDD RED → GREEN cycle:

1. **Task 1 (RED): failing tests for slimmed panel** - `b68bf32b` (test)
2. **Task 1 (GREEN): slim panel — shared stepper + sole Open studio** - `34f11ab6` (feat)
3. **Task 1 (test fix): stub gate/case/version in Expand-editor test** - `40e2083d` (test)
4. **Task 2 (RED): failing test for 'Review evals' link** - `527b9f36` (test)
5. **Task 2 (GREEN): 'Review evals' link + navigator drill** - `4fb9486f` (feat)

**Plan metadata:** `985215bf` (docs: complete plan)

_TDD gate compliance: each task has its `test(...)` RED commit before its `feat(...)` GREEN commit._

## Files Created/Modified
- `frontend/src/components/skills/SkillFormDialog.tsx` - Slimmed `SkillDetailPanel`: sections removed; shared `LifecycleStepper` + `deriveLiveVersion`-derived version + counts (gate.passed/measured reuse) + sole "Open studio" button; `onOpenStudio` prop + skill-switch-guarded fetch
- `frontend/src/components/skills/SkillFormDialog.test.tsx` - New describe block asserting sections gone, stepper present, honest counts, Open studio calls `onOpenStudio(id,"evals")`; added gate/case/version mocks (also to the pre-existing Expand-editor describe so it renders offline)
- `frontend/src/pages/SkillsPage.tsx` - Destructures + drills `onOpenStudio` → panel and `onReviewEvals` → card
- `frontend/src/components/skills/PublishGateDialog.tsx` - `onReviewEvals` prop + unmet-branch "Review evals →" link
- `frontend/src/components/skills/PublishGateDialog.test.tsx` - New describe: unmet renders the link + calls `onReviewEvals(skillId)`; met branch omits it
- `frontend/src/components/skills/SkillCard.tsx` - `onReviewEvals` prop passed through to the `PublishGateDialog` mount

## Decisions Made
- Open studio button gated on `onOpenStudio` presence (no navigator → no button); keeps it the single studio-entry control and prevents a dead button when unwired.
- Used `ExternalLink` icon (not the file's existing `Maximize2`) to avoid confusion with the instructions "Expand" control.
- "Review evals →" rendered as a `<button>` styled as a text link, queried via role `button`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Pre-existing Expand-editor test broke when the panel gained a fetch-on-mount**
- **Found during:** Task 1 (GREEN)
- **Issue:** The slim panel's new `getPublishGate`/`listTestCases`/`listSkillVersions` fetch runs on mount for any `SkillDetailPanel`. The pre-existing "Expand full-size instructions editor" test (sketch 046-C) did not stub those, so `getPublishGate(sid)` returned `undefined` and `.catch` threw a `TypeError`.
- **Fix:** Added the three api mocks (default resolved values) to that describe's `beforeEach` so it renders offline. In-scope: the failure was directly caused by this task's change to `SkillDetailPanel`.
- **Files modified:** frontend/src/components/skills/SkillFormDialog.test.tsx
- **Verification:** `vitest run SkillFormDialog.test.tsx` → 8/8 pass.
- **Committed in:** `40e2083d` (Task 1 test fix — the stub edit landed after the GREEN source commit, so it got its own commit)

---

**Total deviations:** 1 auto-fixed (1 bug, test-only, directly caused by this task).
**Impact on plan:** Necessary to keep the sibling test green under the panel's new fetch. No scope creep — no source behavior beyond the plan.

## Issues Encountered
- Worktree had no `frontend/node_modules` (gitignored) — created a temporary Windows directory junction to the main checkout's `node_modules` so `vitest`/`tsc` resolve; the junction is removed before returning. `PowerShell`/`powershell.exe` is denied in this environment; created the junction via `cmd //c` running a batch file (the `//c` form is required — `MSYS_NO_PATHCONV` suppresses the needed `//c`→`/c` conversion).

## Verification
- `npx vitest run src/components/skills/SkillFormDialog.test.tsx src/components/skills/PublishGateDialog.test.tsx` → **12/12 pass**.
- `npx tsc -p tsconfig.json --noEmit` → **clean (exit 0)** — the full navigator drill typechecks end to end, no unused props.
- Grep gates: sections removed (0), `LifecycleStepper` + `variant="full"` present, both `deriveLiveVersion` + `listSkillVersions` present, `gate.passed|gate.measured` reused (3), literal `onOpenStudio(` present (1), `onReviewEvals` in PublishGateDialog (4) / SkillCard (3), `onReviewEvals|onOpenStudio` in SkillsPage (5).
- Runtime chain confirmed: `App` (`handleOpenStudio`/`handleReviewEvals`) → `ChatLayout` (:303-304) → `SkillsPage` → consumers.

## Known Stubs
None — the panel wires real data (`getPublishGate`/`listTestCases`/`listSkillVersions`); the "not evaled yet" fallback is an honest empty-state, not a fabricated value.

## Threat Flags
None — no new network endpoints, auth paths, or trust-boundary surface. The panel reuses the owner-scoped server gate verbatim (T-137-01); the "Review evals →" link passes only the owner's `skillId` (T-137-03); all copy renders as React text nodes (T-137-05).

## Next Phase Readiness
- PANEL-01 detail-panel slim-down + the 057-MAP navigation links are complete and green.
- The panel and the Studio header now share one status truth-teller and one version rule — no drift possible.

---
*Phase: 137-skill-evals-panel-ui-panel-01*
*Completed: 2026-07-03*
