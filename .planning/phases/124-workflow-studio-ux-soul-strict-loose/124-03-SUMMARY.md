---
phase: 124-workflow-studio-ux-soul-strict-loose
plan: 03
subsystem: ui
tags: [react, vitest, workflows, soul, run-header, publish-summary, g-5, additive-sibling, deriveTier, phase-spine]

# Dependency graph
requires:
  - phase: 124-01
    provides: "soulData.ts (DefShape + tierForDefinition + PHASE_GLYPHS + soulDeliverable), WorkflowSoul.tsx (scale-keyed 5-atom soul), PhaseSpine.tsx (glyph-dot row)"
provides:
  - "WorkspacePanel run-soul section — a new 'This workflow' <PanelSection> sibling rendering <WorkflowSoul scale='run'> ABOVE the live PhaseTimeline section, gated to harness runs (D-07/D-08)"
  - "RunSoul helper — the additive by-id read (getThreadWorkflow → definition_slug, listPublishedWorkflows → PublishedWorkflow.definition) that sources the published definition for the run soul (A2)"
  - "PublishGauntlet pub-scale soul block — <WorkflowSoul scale='pub'> PREPENDED above the 8-stage gauntlet ladder (D-06)"
  - "PublishGauntlet optional additive `definition` prop, threaded from the Builder's renderPublish"
affects: [124 phase-gate manual sketch-match UAT against 046-A, WUX-03/Phase-127 gauntlet ladder re-skin]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Additive-sibling mount (G-5 / D-07): the run soul is a NEW <PanelSection> sibling above the live timeline — PhaseTimeline.tsx / PhaseCard.tsx stay byte-identical (empty git diff --stat + pinned blob hashes), no new PhaseCard prop, no usePhases-driven soul"
    - "Sibling-only by-id definition read (A2): the run frame names the workflow (definition_slug); the full authored definition is recovered from the SAME owner-scoped PublishedWorkflow.definition the library card reads — no new endpoint, no widened fields"
    - "Harness-gated run surface (D-08): the run soul section reuses the existing showTimeline gate so Deep / no-run threads render no soul — Deep stays byte-identical, no shared-path fork"
    - "Prepend-only mount (D-06): the pub soul block is the first child above the resting publish form; the 8-stage ladder + verdict are byte-behavior-identical (existing honesty tests stay green)"

key-files:
  created: []
  modified:
    - frontend/src/components/panel/WorkspacePanel.tsx
    - frontend/src/components/panel/__tests__/WorkspacePanel.test.tsx
    - frontend/src/components/workflows/PublishGauntlet.tsx
    - frontend/src/components/workflows/PublishGauntlet.test.tsx
    - frontend/src/pages/WorkflowsPage.tsx
    - frontend/src/pages/WorkflowBuilderPage.tsx

key-decisions:
  - "RunSoul sources the published definition via getThreadWorkflow (definition_slug) → listPublishedWorkflows (match by slug) — the SAME owner-scoped read the card uses; a sibling-only additive read, never usePhases / PhaseCard internals (A2 / T-124-12 accept)"
  - "The run soul section is isolated in a small RunSoul helper component inside WorkspacePanel.tsx so the fetch effect is self-contained and the WorkspacePanel diff stays additive (the artifact's <WorkflowSoul> mount lives in WorkspacePanel.tsx as required)"
  - "WorkflowBuilderPage.tsx is touched ONLY to document the additive renderPublish forward — its renderPublish signature already passes state.definition (a BuilderDefinition), so zero behavior change to the describe/draft/publish flow; the WorkflowsPage call site casts the forwarded def to DefShape"
  - "data-tier renders the uppercase tier id (STRICT/MIDDLE/LOOSE) — the pub soul-block test asserts data-tier='STRICT' (not lowercase)"

patterns-established:
  - "Run/pub soul mounts reuse the Plan-01 WorkflowSoul + PhaseSpine verbatim (no per-size duplication) — the SC#1+SC#2 cross-size consistency invariant now spans all three sizes (card from Plan 02, run + pub here)"
  - "G-5 source-grep on the WorkspacePanel source: the run-soul wiring must not import ./PhaseCard nor thread a soul atom into PhaseTimeline (only the unchanged <PhaseTimeline threadId={threadId} /> mount is allowed)"

requirements-completed: [WUX-01]

# Metrics
duration: ~16min
completed: 2026-06-27
---

# Phase 124 Plan 03: Run Header + Publish Summary Soul Summary

**The 2nd and 3rd soul sizes mounted on their host surfaces: a `<WorkflowSoul scale="run">` additive-sibling `<PanelSection>` above the live workspace timeline (sourced by an additive by-id read of the published definition, harness-gated so Deep is byte-identical), and a `<WorkflowSoul scale="pub">` block prepended above the publish gauntlet's untouched 8-stage ladder — with `PhaseTimeline.tsx` / `PhaseCard.tsx` proven byte-identical (the G-5 red line) and the gauntlet ladder + verdict byte-behavior-identical (D-06).**

## Performance

- **Duration:** ~16 min
- **Tasks:** 2 (both `type="auto"`)
- **Files modified:** 6 (0 created)

## Accomplishments

- **Task 1 — run-surface soul (D-07/D-08, sketch 046-A ②).** Added a new `"This workflow"` `<PanelSection>` ABOVE the existing `title="Workflow"` PhaseTimeline section in `WorkspacePanel.tsx`, rendering `<WorkflowSoul scale="run">`. It is an ADDITIVE SIBLING: `PhaseTimeline.tsx` / `PhaseCard.tsx` are byte-identical (empty `git diff --stat`, pinned blob hashes `9bf88c9…` / `a489492…` unchanged), no new PhaseCard prop, no soul atom threaded into the timeline.
- The run soul sources its definition ADDITIVELY by id (A2): a small `RunSoul` helper calls `getThreadWorkflow` for the run frame's `definition_slug`, then `listPublishedWorkflows` (the SAME owner-scoped read the library card uses) and matches by slug to recover the full `PublishedWorkflow.definition` JSONB. It reads the DEFINITION only — no `usePhases`, no elapsed timer, no per-phase slug (so BUG-260610-01 / BUG-260609-04 stay closed).
- The run soul section reuses the existing `showTimeline` gate (harness runs only) so Deep / no-run threads render no soul — Deep stays byte-identical, no shared-path fork (D-08). A draft test-run with a null `business_requirement` is covered by the soul's honest "draft · purpose not declared yet" empty-state.
- **Task 2 — publish-summary soul (D-06, sketch 046-A ③).** Added an optional additive `definition?: DefShape` prop to `PublishGauntlet`, threaded it to `GauntletContent`, and PREPENDED `<WorkflowSoul scale="pub">` as the first child above the resting publish form. The 8-stage `STAGES` ladder, `GauntletSpine`, `PublishingNotice`, the 4 HTTP outcomes, and the verbatim verdict grid are byte-behavior-identical — the ladder re-skin is explicitly WUX-03 / Phase 127.
- Threaded the definition from the Builder's `renderPublish(state.definition, draftId)` through the `WorkflowsPage` call site (`definition={_def as DefShape}`); `WorkflowBuilderPage.tsx` touched only to document the additive forward (its signature already passes the working definition — zero flow change).
- All three soul sizes (card from Plan 02, run + pub here) now render a consistent tier / spine / needs / output for one workflow from the single shared `soulData` + `WorkflowSoul` (the SC#1+SC#2 invariant spans the full set).

## Task Commits

1. **Task 1: Mount the run-surface soul as an additive sibling PanelSection (G-5)** — `46dc15c0` (feat) — WorkspacePanel + 6 new tests (31/31)
2. **Task 2: Prepend the soul block on the publish summary (D-06)** — `375898d8` (feat) — PublishGauntlet + WorkflowsPage + WorkflowBuilderPage + 2 new tests (19/19)

**Plan metadata:** _(this docs commit)_

## Files Modified

- `frontend/src/components/panel/WorkspacePanel.tsx` — new imports (`WorkflowSoul`, `DefShape`, `getThreadWorkflow`, `listPublishedWorkflows`); a `RunSoul` helper component doing the additive by-id read; a new `"This workflow"` `<PanelSection>` (gated to `showTimeline`) rendering `<WorkflowSoul scale="run">` ABOVE the unchanged Workflow timeline section.
- `frontend/src/components/panel/__tests__/WorkspacePanel.test.tsx` — `@/lib/api` mock (`getThreadWorkflow` + `listPublishedWorkflows`) + a published-definition fixture; 6 new tests: run soul mounts on a harness run, DOM order above the timeline, the by-id read path, no soul for a Deep / no-run thread (D-08 gate), the draft honest empty-state, and a `?raw` G-5 source-grep forbidding a `./PhaseCard` import / soul thread.
- `frontend/src/components/workflows/PublishGauntlet.tsx` — optional additive `definition?: DefShape` prop threaded to `GauntletContent`; `<WorkflowSoul scale="pub">` PREPENDED as the first child of the top-level `<div className="w-full">` above the resting publish form. Ladder/verdict untouched.
- `frontend/src/components/workflows/PublishGauntlet.test.tsx` — 2 new tests: the pub soul block renders (pub scale + tier chip `data-tier="STRICT"`) ABOVE the gauntlet spine (DOM order), and an absent-definition honest draft empty-state that does not crash.
- `frontend/src/pages/WorkflowsPage.tsx` — threads `definition={_def as DefShape}` into the `PublishGauntlet` mount in the Builder host's `renderPublish` (additive only).
- `frontend/src/pages/WorkflowBuilderPage.tsx` — doc-only: extended the `renderPublish` prop JSDoc to record the additive soul-source forward (no code/flow change).

## Decisions Made

- **RunSoul does a two-step sibling-only read (A2).** `getThreadWorkflow(threadId)` → `definition_slug`, then `listPublishedWorkflows()` → match by `slug` → `PublishedWorkflow.definition`. This is the SAME owner-scoped published read the library card already consumes (no new endpoint, no widened fields, RLS unchanged — T-124-12 accept). A list/reconcile miss is non-fatal: the soul falls back to its honest empty-states rather than crashing the panel.
- **The run-soul fetch is isolated in a small `RunSoul` helper inside `WorkspacePanel.tsx`** so the effect is self-contained and the WorkspacePanel diff stays purely additive, while the artifact requirement (`<WorkflowSoul>` rendered in `WorkspacePanel.tsx`) is satisfied.
- **`WorkflowBuilderPage.tsx` is doc-only.** Its `renderPublish` signature already passes `state.definition` (a `BuilderDefinition`, structurally a `DefShape`), so the definition already reaches the call site — the only change is a JSDoc note documenting the additive forward. Zero behavior change; the describe/draft/publish flow tests stay green.

## Deviations from Plan

**1. [Rule 1 - Bug] Test fixture asserted lowercase tier id**
- **Found during:** Task 2 (the pub soul-block test).
- **Issue:** The first draft of the new PublishGauntlet test asserted `data-tier="strict"`, but `WorkflowSoul` renders the tier id as the uppercase `TIERS.*.id` (`"STRICT"`). The test failed on the case mismatch.
- **Fix:** Changed the assertion to `data-tier="STRICT"` (the real rendered value).
- **Files modified:** `frontend/src/components/workflows/PublishGauntlet.test.tsx`
- **Verification:** `npx vitest run PublishGauntlet.test.tsx` → 19/19 green.
- **Committed in:** `375898d8` (Task 2 commit).

---

**Total deviations:** 1 auto-fixed (1 Rule 1 bug — test-data self-consistency).
**Impact on plan:** None — a test-only fixup; no source/behavior/scope change.

## Issues Encountered

None beyond the deviation above. The `@/lib/api` partial mock (spreading `importOriginal`) let the run-soul reads resolve deterministically without stubbing the rest of the API surface; the `?raw` loader + `@` alias worked as in the PhaseSpineGraph / PublishGauntlet precedents.

## Verification Run

- `npx vitest run WorkspacePanel.test.tsx PublishGauntlet.test.tsx` → **50/50 pass** (31 + 19).
- `git diff --stat -- PhaseTimeline.tsx PhaseCard.tsx` → **EMPTY** (G-5 byte-identical proof, D-07). Blob hashes `9bf88c9…` / `a489492…` unchanged.
- `npx vitest run src/components/panel src/components/workflows` → **258/258 pass** (no regression in panel/ or workflows/).
- `npx tsc --noEmit` → **0 errors** project-wide; the 6 changed files are type-clean.

## Manual UAT Flag (phase gate, before /gsd:verify-work)

Per the plan's output note, the following are flagged for the phase-gate manual sketch-match UAT against **046-A** (not hard assertions):

- **A1 — the deliverable-label string.** `WorkflowSoul`'s output atom renders `"<workflow name> · file"` (honest, name-derived). The exact friendly label copy is operator-confirmed against 046-A at UAT (mechanism locked in Plan 01).
- **Full 3-size sketch-match.** With one workflow selected, the card (Plan 02), the run header, and the publish summary must show the SAME tier chip (🔒/◐/○ + WORD), spine shape, needs, and output in lockstep; switching the workflow changes all three in step — confirm visually against 046-A across the three sizes.

## Next Phase Readiness

- All three soul sizes are now mounted (card / run / pub). WUX-01's run header + publish summary are complete.
- `PhaseTimeline.tsx` / `PhaseCard.tsx` remain byte-identical (G-5 / D-07); the gauntlet ladder + verdict remain byte-behavior-identical (D-06 — the ladder re-skin is WUX-03 / Phase 127).
- No blockers. STATE.md / ROADMAP.md intentionally NOT touched (the orchestrator owns those writes after the wave).

## Self-Check: PASSED

- All 6 modified files exist on disk and carry this plan's changes (WorkspacePanel.tsx + its test, PublishGauntlet.tsx + its test, WorkflowsPage.tsx, WorkflowBuilderPage.tsx).
- Both task commits present in git log: `46dc15c0` (Task 1), `375898d8` (Task 2).
- `PhaseTimeline.tsx` / `PhaseCard.tsx` byte-identical (`git diff --stat` empty; pinned blob hashes unchanged) — G-5 / D-07 held.
- STATE.md / ROADMAP.md NOT in either task commit (verified via `git diff --name-only`).
- No accidental file deletions in either commit (`git diff --diff-filter=D` empty).

---
*Phase: 124-workflow-studio-ux-soul-strict-loose*
*Completed: 2026-06-27*
