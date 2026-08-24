---
phase: 183-read-only-canvas
plan: 09
subsystem: workflow-builder-frontend
tags: [gap-closure, a11y, canvas, builder, tdd]
requires:
  - "183-06/07/08 (WorkflowCanvas, the Builder canvas door, the CR-01 keyboard path)"
  - "The shipped PhaseFormPanel + PhaseSpineGraph selection pair (Phase 103)"
provides:
  - "A discoverable close (✕) on the step detail panel, driven by a REQUIRED onClose prop"
  - "Escape-to-dismiss, view-agnostic and flag-independent"
  - "Canvas pane-click-to-deselect via a REQUIRED onClearSelection prop"
  - "An auto-repeat-proof keyboard activation (event.repeat guard)"
  - "Two genuinely silent inert nodes (end cap + unresolved-skip stub)"
affects:
  - "frontend/src/components/workflows/PhaseFormPanel.tsx (new required prop — all call sites)"
  - "frontend/src/components/workflows/WorkflowCanvas.tsx (new required prop — all call sites)"
  - "Phase 184, which inherits this surface as its authoring door"
tech-stack:
  added: []
  patterns:
    - "Required-prop-as-invariant: an unclosable panel is a typecheck error, not a UX regression"
    - "domAttributes to clear a library-attached aria-describedby per node"
    - "panelOpen-gated window keydown listener (no listener at rest)"
key-files:
  created: []
  modified:
    - frontend/src/components/workflows/PhaseFormPanel.tsx
    - frontend/src/components/workflows/PhaseFormPanel.test.tsx
    - frontend/src/pages/WorkflowBuilderPage.tsx
    - frontend/src/pages/WorkflowBuilderPage.canvas.test.tsx
    - frontend/src/components/workflows/WorkflowCanvas.tsx
    - frontend/src/components/workflows/WorkflowCanvas.test.tsx
    - frontend/src/components/workflows/canvasModel.ts
    - frontend/src/components/workflows/__snapshots__/canvasModel.fixtures.test.ts.snap
    - .planning/phases/183-read-only-canvas/183-VALIDATION.md
decisions:
  - "GAP-1 fixed in BOTH views and flag-independently — the defect lives on the shipped Spine surface, not on the canvas (D-183-13 precedent)"
  - "onClose and onClearSelection are REQUIRED, not optional — the type system, not a test, is what forbids an unclosable panel"
  - "The Spine's empty-area click-away is deliberately NOT implemented; the honest reason is implementation cost and G-5 blast radius, NOT the jsx-a11y gate"
metrics:
  duration: ~50 min
  tasks: 3
  completed: 2026-07-26
---

# Phase 183 Plan 09: Gap Closure — Panel Dismissal, Key Auto-Repeat, Inert-Node ARIA Summary

The step detail panel can now be closed the obvious way — a ✕ where the user is already looking, plus Escape and canvas click-away — in both the Spine and the Canvas view; a held Enter activates once instead of coin-flipping the panel; and the two inert nodes stopped promising an interaction they refuse.

## What Shipped

Three defects confirmed LIVE in the Phase 183 Chrome UAT, paid down while the surface is still read-only and small.

| Gap | Defect | Fix |
|---|---|---|
| **GAP-1** (major, operator-reported) | The panel's only exit was re-activating the same node — zero buttons in the subtree, Escape inert, pane click unwired | A `<button>` ✕ in the open panel's header (required `onClose`), a `panelOpen`-gated window Escape listener, and `onPaneClick → onClearSelection` on the canvas |
| **GAP-2** (WR-08-01) | No `event.repeat` guard — a held Enter/Space rapid-toggled the panel, terminal state decided by repeat-count parity | An `event.repeat` early return in `activateFromKeyboard` |
| **GAP-3** (WR-08-04) | The end cap and unresolved-skip stub inherited `aria-describedby` → "Press enter or space to open this step's details" | `domAttributes: { "aria-describedby": undefined }` on both node types in the model |

**GAP-1 is NOT a Phase 183 regression.** It is pre-existing Spine debt the canvas inherited via the shared `handleSelectNode`. The fix therefore lands for both views, and every dismissal test asserts in both — with the Spine half running with `visual_workflow_canvas` **OFF**, on the shipped surface where the defect actually lives.

## Task Commits

| Task | Name | Commit |
|---|---|---|
| 1 | RED — dismissal, auto-repeat and inert-ARIA gates in BOTH views | `3dc0671e` |
| 2 | GREEN — GAP-1: ✕, Escape, canvas click-away | `4e997f03` |
| 3 | GREEN — GAP-2 repeat guard, GAP-3 silent inert nodes | `45633371` |

## Re-measured Baselines (before → after)

Every row was re-measured at HEAD before Task 1. **All eight agreed with the plan's table** — no disagreement to report.

| Gate | Baseline (measured) | After |
|---|---|---|
| Phase-file suite (`vitest run src/components/workflows`) | 13 files / **376 passed** / 0 failed | 13 files / **380 passed** / 0 failed |
| Phase-scoped superset | 17 files / **429 passed** / 0 failed | 17 files / **438 passed** / 0 failed |
| Typecheck (`tsc -b --force`, `error TS` count) | **33** | **33** (≤ 33 ✓) |
| Typecheck naming a phase file | **0** | **0** |
| a11y lint (CI-gated, 4 files) | clean, exit 0 | clean, exit 0 |
| Lint `PhaseNode.tsx` | 0 problems | 0 problems |
| Build | exit 0; `WorkflowCanvas-*.js` own lazy chunk ~174 kB; main entry 1,726 kB | exit 0; `WorkflowCanvas-B3fMrdyb.js` **174.73 kB** own lazy chunk; main entry **1,726.90 kB** (≤ 1,740 ✓) |
| Snapshot inert-node census | 14 endCap + 1 unresolvedSkip = **15** | 15 `domAttributes` keys added |
| Backend parity (`test_183_skip_parse_parity.py`) | — | **13 passed** |

## The RED Gate (Task 1) — verbatim

`cd frontend && npx vitest run src/pages/WorkflowBuilderPage.canvas.test.tsx src/components/workflows/PhaseFormPanel.test.tsx src/components/workflows/WorkflowCanvas.test.tsx`

```
 FAIL  src/pages/WorkflowBuilderPage.canvas.test.tsx > … > the header ✕ closes the panel — CANVAS view
TestingLibraryElementError: Unable to find an element by: [data-testid="phase-form-close"]
 FAIL  src/pages/WorkflowBuilderPage.canvas.test.tsx > … > the header ✕ closes the panel — SPINE view with the canvas flag OFF
TestingLibraryElementError: Unable to find an element by: [data-testid="phase-form-close"]
 FAIL  src/pages/WorkflowBuilderPage.canvas.test.tsx > … > Escape closes the panel — CANVAS view
TestingLibraryElementError: Unable to find an element by: [data-testid="phase-form-rail"]
 FAIL  src/pages/WorkflowBuilderPage.canvas.test.tsx > … > Escape closes the panel — SPINE view with the canvas flag OFF
TestingLibraryElementError: Unable to find an element by: [data-testid="phase-form-rail"]
 FAIL  src/pages/WorkflowBuilderPage.canvas.test.tsx > … > clicking the empty canvas pane clears the selection
TestingLibraryElementError: Unable to find an element by: [data-testid="phase-form-rail"]
 FAIL  src/components/workflows/PhaseFormPanel.test.tsx > … > the open panel header carries exactly one announced close control
TestingLibraryElementError: Unable to find an element by: [data-testid="phase-form-close"]
 FAIL  src/components/workflows/WorkflowCanvas.test.tsx > … > a HELD Enter activates exactly once — auto-repeat cannot rapid-toggle (WR-08-01)
AssertionError: expected "vi.fn()" to be called 1 times, but got 3 times
 FAIL  src/components/workflows/WorkflowCanvas.test.tsx > … > the two INERT nodes do not inherit the activation description (WR-08-04)
AssertionError: expected 'react-flow__node-desc-1' not to be 'react-flow__node-desc-1' // Object.is equality

 Test Files  3 failed (3)
      Tests  8 failed | 64 passed (72)
EXIT=1
```

**Exactly 8 failed, and the exit status agrees with the count** — no d3-drag trap (the pane-click test uses `fireEvent`, never `user-event`). Every failure is an unmet DOM expectation or a concrete assertion mismatch; no `TypeError`, no unhandled rejection.

**The auto-repeat call count at RED was 3** — exactly as predicted. All three dispatched events (one real + two `repeat: true`) reached the handler, because `activateFromKeyboard` filtered on `event.key` alone. A count of 1 would have meant the test was testing nothing.

**Why Test 7 passed at RED, and why it is still a real guard.** "The resting rail renders NO close control" is not a GAP-1 reproduction — it is a guard against the *fix over-reaching* into the collapsed 44 px rail. It was declared as an expected-pass before the run, so the honest RED signature is 8 failures out of 9 new tests, not 9.

### One deviation inside Task 1 (self-corrected before commit)

My first `expectDismissed` helper borrowed the suite's `LAZY = { timeout: 10_000 }` budget. That outlives vitest's 5 s test timeout, so the three Escape/pane tests reported `Test timed out in 5000ms` instead of the DOM expectation that actually went unmet — which would have failed the plan's own acceptance criterion. Dismissal is a synchronous state update on an already-mounted tree, so the helper now uses the default wait budget and the failures read honestly. No assertion changed.

## Per-File Test-Count Differential (the Phase 177 lesson)

A failures-only differential provably cannot see a replaced or dropped suite. These are exact equalities, verified after **every** task including Task 2's 16-call-site churn:

| File | Before | Target | After |
|---|---|---|---|
| `PhaseFormPanel.test.tsx` | 17 | 19 | **19** ✓ |
| `WorkflowCanvas.test.tsx` | 29 | 31 | **31** ✓ |
| `WorkflowBuilderPage.canvas.test.tsx` | 17 | 22 | **22** ✓ |

No test was renamed, merged, deleted or re-scoped. The 16 mechanical `onClose={noop}` additions and the `renderCanvas` helper edit added and removed nothing.

## Snapshot Gate (Task 3)

The single authorized `vitest -u` in this phase, on one file only:

- **0 deleted or changed lines** (`git diff -U0 | grep -cE "^-[^-]"` → 0) — no node's identity moved
- **0 added lines outside the ARIA suppression** allow-list
- **exactly 15** `domAttributes` keys added (14 end caps + 1 unresolved-skip stub — the HEAD census)
- **no other file under `__snapshots__/`** appears in `git status --porcelain`
- `canvasModel.purity.test.ts` passes **UNMODIFIED** (69/69) — `git diff --stat` on it prints nothing

## Verification Results

| # | Gate | Result |
|---|---|---|
| 1 | Phase-file suite | **0 failed / 380 passed** (376 + 4) ✓ |
| 2 | Phase-scoped superset | **0 failed / 438 passed** (429 + 9) ✓; `revertByteIdentical.test.tsx` byte-identical |
| 3 | Per-file test-count guard | 19 / 31 / 22 — all exact ✓ |
| 4 | Backend parity | **13 passed**; no backend source touched (see note below) |
| 5 | Typecheck differential | **33** errors (≤ 33), **0** naming a phase file ✓ |
| 6 | Build + bundle contract | exit **0**; canvas still its own lazy chunk (174.73 kB); main entry 1,726.90 kB ✓ |
| 7 | Lint | a11y config clean exit 0; `PhaseNode.tsx` 0 problems ✓ |
| 8 | Snapshot gate | 0 deletions / 15 keys / one file ✓ |
| 9 | Scope fence | Exactly the 8 frontend files in `files_modified` ✓ |

**Behavioural assertions confirmed:** ✕, Escape and pane-click each return `phase-form-rail` to the document; the flag-OFF Spine render does all of it with `container.querySelector(".react-flow")` null; `mockCreate` / `mockUpdate` / `mockGenerate` are each called **0** times across the dismissal tests (T-183-12); a held Enter calls `onSelectNode` exactly once while discrete Enter and Space each still call it once (183-08 tests green, unmodified); a real phase node still carries the activation description while both inert wrappers do not.

**Read-only survives:** `grep -cE "onNodesChange|disableKeyboardA11y"` → 0, and all seven opt-out flags (`showInteractive` / `nodesDraggable` / `nodesConnectable` / `edgesReconnectable` / `connectOnClick` / `edgesFocusable` / `deleteKeyCode={null}`) are still present.

**Note on `git status --porcelain -- backend/`:** it is not literally empty, but the four entries (`RUN-BACKEND.md`, two `scripts/115_*.json`, `settings_override.json.migrated`) are **pre-existing untracked files present at session start** — they appear in the session's opening git snapshot. This plan touched no backend path: `git diff --stat HEAD~3 HEAD` lists frontend files only. No migration, no cloud parity owed.

## Deviations from Plan

**None** beyond the self-corrected `expectDismissed` wait-budget adjustment described under the RED gate (no rule-triggered deviation — it was a defect in a test I had just written, corrected before that task's commit). No Rule 1–4 deviations. No package installed (T-183-SC: `package.json` / `package-lock.json` untouched).

## Decisions Recorded

### This fix is FLAG-INDEPENDENT by design

The ✕ and Escape appear whether `visual_workflow_canvas` is on or off, because the defect lives on the shipped Spine surface. This is the same accepted shape as **D-183-13** (the Spine unconditionally gained the 3D marks and the ⌥ reveal): flag-off means *no canvas*, not *no shipped-surface bug fixes*.

**This is not a D-181-01 violation.** What D-181-01 freezes is untouched: no nav entry is added, the `"off"` audience stays byte-identical including for operators, and `require_canvas` still 404s **pre-auth**. All five flag-off render variants in `WorkflowBuilderPage.canvas.test.tsx` remain unmodified and green, and the new Spine tests positively assert `container.querySelector(".react-flow")` is null.

### The Spine's empty-area click-away is deliberately NOT implemented — and the reason is cost, not lint

Stated plainly so nobody re-derives a wrong reason: **`jsx-a11y` is NOT what stops it.** That rule set scans JSX attributes, not `addEventListener`, so the same imperative `useEffect` pattern this plan already uses for Escape would sidestep it entirely.

What actually stops it: React Flow hands you a distinct pane element, so "the user clicked empty space" is free and unambiguous. The Spine has no pane — a correct click-outside there must positively **exclude** every interactive child of its scroll list (each `spine-node-*` button, each ⓘ hint, the skip-branch rows) plus the page header's Save/Publish controls. That is ref + containment logic and a judgment call per control, landing in `WorkflowBuilderPage.tsx` — a G-5 ledger file Phase 184 is about to reopen as the 3rd authoring door — to buy a **third** redundant dismissal path on a surface where the ✕ and Escape already deliver the capability in full.

**This is overturnable, not a dropped capability.** If the operator wants it, it is a small follow-up modelled directly on the Escape effect.

### Accepted interaction, recorded rather than engineered around

If a modal is open above the Builder, Escape will both dismiss the modal and release the panel selection. Harmless — deselection is non-destructive and persistence is on field blur, not on selection — and preferable to a fragile is-a-modal-open probe.

## Explicitly Left Untouched

Confirmed by diff and by grep — all recorded, accepted debt with no operator decision to close it:

**WR-08-02** (the `groundingFor` docblock overclaim / gate-promotion disagreement) · **WR-08-03** (`ARIA_LABELS` untyped — no `satisfies`) · **WR-02** (hardcoded `colorMode="dark"`) · **WR-03 / WR-04** (slug-collision and colon-bearing-slug id collisions) · **IN-01 … IN-07**.

Nothing editable was added: no write path, no drag, no node mutation, no authoring affordance. `PhaseSpineGraph.tsx`, `phaseVocabulary.ts`, `PhaseNode.tsx`, `deriveTier.ts`, `soulData.ts`, `revertByteIdentical.test.tsx`, `canvasModel.purity.test.ts` and `package.json` are all byte-identical.

## Still Outstanding After This Plan

- **Live re-UAT of the dismissal.** jsdom proves the callback and the DOM; only a live pass proves the ✕ is *findable*, which is the operator's original complaint. Two rows added to `183-VALIDATION.md` — **U-5** (Canvas view) and **U-6** (Spine view, flag OFF) — for the operator to drive.
- **The Spine click-away**, deferred as above and surfaced as overturnable.
- **U-3's premise is still wrong** — the zero-phase state is UI-unreachable until Phase 184 ships step deletion. Re-point that row in 184, not here.

## Threat Flags

None. No new security-relevant surface: no network endpoint, no auth path, no file access, no schema change. Every net-new path (✕, Escape, pane click, the repeat guard) terminates in `setSelectedSlug(null)` — a pure state update.

## Self-Check: PASSED

All modified files verified present on disk; all three task commits verified in `git log`:

- `3dc0671e` test(183-09): RED gate — FOUND
- `4e997f03` fix(183-09): discoverable close in both views — FOUND
- `45633371` fix(183-09): repeat guard + silent inert nodes — FOUND
