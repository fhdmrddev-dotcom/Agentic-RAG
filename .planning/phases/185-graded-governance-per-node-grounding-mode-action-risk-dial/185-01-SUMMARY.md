---
phase: 185-graded-governance-per-node-grounding-mode-action-risk-dial
plan: 01
subsystem: ui
tags: [react, tailwind, xyflow, canvas, workflow-studio, phase-node-card, sketch-137b, geometry, vitest]

# Dependency graph
requires:
  - phase: 184-editable-canvas
    provides: "PhaseNodeCard (the D-184-06 presentational extraction), its slot contract, the 184-08 verdict mark, and the CANVAS_LAYOUT frozen table"
  - phase: 183-read-only-canvas
    provides: "canvasModel.toCanvas, CANVAS_LAYOUT, the one-tab-stop-per-node invariant"
provides:
  - "The shipped PhaseNodeCard now renders sketch 137-B: a 248px centre-aligned card inside the 260px node box, with the 3D mark floating above its top edge"
  - "CANVAS_LAYOUT.NODE_MIN_HEIGHT raised 96 -> 104 (the 137-B floor giving the floating mark 11px of title clearance)"
  - "The VALID-03 verdict mark relocated to the card's LEFT (-left-2 top-1.5), freeing the top-right corner for plan 185-09's governance seal"
  - "A falsified bounding-box zone check pinning SPEC acceptance criterion 23 (0 overlaps between rendered marks)"
  - "Three docblocks (PhaseNodeCard module + verdict mark, WorkflowCanvas PlaneEditingLayer) corrected from 137-B-on-a-137-D-component to the shipped truth"
affects: [185-09-governance-seal, 185-detour-edge, 188-run-state-canvas, 189-external-actions]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Geometry assertions parse the component's OWN Tailwind placement classes off the rendered DOM, never re-typed literals"
    - "Every zone check ships with a falsification control that reproduces a known-red case through the same checker"

key-files:
  created: []
  modified:
    - frontend/src/components/workflows/PhaseNodeCard.tsx
    - frontend/src/components/workflows/canvasModel.ts
    - frontend/src/components/workflows/WorkflowCanvas.tsx
    - frontend/src/components/workflows/PhaseNodeCard.test.tsx
    - frontend/src/components/workflows/canvasModel.test.ts

key-decisions:
  - "The zone check runs over RENDERED marks only; the declared-but-unrendered stepNumber slot sits in the same table flagged rendered:false, with its 2x16px graze against the relocated verdict pinned as a written residual rather than silently tolerated"
  - "Mark boxes are derived by parsing the component's own placement classes off the DOM, so editing a class moves the boxes — a re-typed literal table would have been a second copy of the geometry, free to drift"
  - "The falsification was physically performed (card reverted to the 137-D icon well + NODE_MIN_HEIGHT 96), observed RED at exactly 112px2, and is ALSO encoded as a live positive control so it can never become vacuous"
  - "The prior 137-D class names are deliberately NOT quoted anywhere in PhaseNodeCard.tsx — the acceptance greps assert they are gone, and a docblock spelling them would make its own guard vacuous (the D-ITEM-183-02 trap)"

patterns-established:
  - "Falsification-before-green: a geometry gate is only evidence once it has been observed red on the pre-change state, with the observed output quoted"
  - "Residual-with-remedy: a known non-collision graze is pinned to its exact area alongside the one-line fix that clears it, instead of being written off in prose"

requirements-completed: [GOVERN-02]

# Metrics
duration: 33min
completed: 2026-07-29
---

# Phase 185 Plan 01: The 137-B Card Rebuild Summary

**PhaseNodeCard rebuilt from the shipped 137-D geometry to the operator-locked 137-B — a 248px centred card with the 3D mark floating above its top edge — and the VALID-03 verdict mark moved to the card's left, freeing top-right for the governance seal, with a falsified zone check pinning zero overlap between rendered marks.**

## Performance

- **Duration:** 33 min
- **Started:** 2026-07-29T13:51:54Z
- **Completed:** 2026-07-29T14:24:39Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- **The card is 137-B.** The frosted card is now a 248px centre-aligned block (`mx-auto block w-[248px] … rounded-[22px] pt-[42px] px-5 pb-5 text-center`) horizontally centred inside the 260px node box, and the 3D mark floats above its top edge at `left-1/2 top-[-26px]`, 62×62. Every constant except `pt-[42px]` is `themes/canvas-184.css` `body.card-b`, verbatim.
- **`NODE_MIN_HEIGHT` 96 → 104.** D-185-17's amendment, applied in the one frozen table both halves read, with the reason (11px of clearance instead of 3) written at the constant.
- **The verdict mark moved to `-left-2 top-1.5`.** Top-right of the card is now empty and available to plan 185-09. On the rebuilt card the mark straddles the card's left border (border at x=6, mark spans x −8…14) — which was *not reachable at all* on 137-D, where the border sat at x=24.
- **SPEC acceptance criterion 23 has a green, falsified automated proof.** The zone check reports 0 overlaps between the two rendered marks, and the same checker was observed reporting `icon well × verdict = 112px²` on the pre-rebuild placement.
- **Three lying docblocks corrected.** `PhaseNodeCard.tsx`'s module block, its verdict-mark block, and `WorkflowCanvas.tsx`'s `PlaneEditingLayer` block all reasoned from 137-B on a component that rendered 137-D. They now state the shipped truth and name which corner is claimed by what.
- **No governance signal was added.** No seal, no grounded state, no armed mark, no new vocabulary. The two-badge budget is untouched (`BadgeSlot2Tuple` is still a max-2 tuple) and slot 1 was not filled.

## Task Commits

1. **Task 1: Rebuild the card to 137-B and move the verdict mark left** — `c31c3811` (refactor)
2. **Task 2: Pin the geometry — the zone-overlap test and the layout-table assertion** — `5c43702d` (test)

## Files Created/Modified

- `frontend/src/components/workflows/PhaseNodeCard.tsx` — the 137-B card body, the top-edge floating icon well, the verdict mark at `-left-2`, and three rewritten docblocks
- `frontend/src/components/workflows/canvasModel.ts` — `CANVAS_LAYOUT.NODE_MIN_HEIGHT` 96 → 104, with D-185-17 named at the constant
- `frontend/src/components/workflows/WorkflowCanvas.tsx` — `PlaneEditingLayer` docblock only; no code changed
- `frontend/src/components/workflows/PhaseNodeCard.test.tsx` — the mark-occupancy zone check (+7 tests: 42 → 49) and the falsification control
- `frontend/src/components/workflows/canvasModel.test.ts` — the frozen-table literal follows to 104; `it()` count unchanged at the pinned 26

## The falsification (SPEC criterion 23 evidence)

**The check was physically driven red before it was accepted green.** The component was temporarily
reverted to the 137-D icon well (`left-0 top-1/2 h-14 w-14 -translate-y-1/2`) with
`CANVAS_LAYOUT.NODE_MIN_HEIGHT` restored to 96 — the well's `top-1/2` placement is a function of it —
while keeping SPEC Req 6's left verdict. `npx vitest run src/components/workflows/PhaseNodeCard.test.tsx`
then reported, verbatim:

```
 FAIL  src/components/workflows/PhaseNodeCard.test.tsx > PhaseNodeCard — 137-B mark occupancy (SPEC criterion 23) > every pair of RENDERED marks reports ZERO overlap (acceptance criterion 23)
AssertionError: expected [ 'icon well × verdict = 112px²' ] to deeply equal []

 FAIL  src/components/workflows/PhaseNodeCard.test.tsx > PhaseNodeCard — 137-B mark occupancy (SPEC criterion 23) > the icon well FLOATS above the card's top edge, centred on the 260px node box
AssertionError: expected { x0: +0, y0: 20, x1: 56, y1: 76 } to deeply equal { x0: 99, y0: -26, x1: 161, y1: 36 }

 Test Files  1 failed (1)
      Tests  3 failed | 46 passed (49)
```

`112px² = 14 × 8` is **exactly** the overlap `185-CONTEXT.md` §F D-185-17 computed by hand against the
shipped card, and `{x0: 0, y0: 20, x1: 56, y1: 76}` is exactly the icon well it computed it from. The
plan files were then restored, the suite went green at 49/49, and the same pre-rebuild boxes were
encoded as a permanent positive control (`describe("PhaseNodeCard — the occupancy check CAN go red
(falsification control)")`) so the green check can never become vacuous.

## Decisions Made

- **The zone check covers RENDERED marks; `stepNumber` is in the table but flagged `rendered: false`.**
  The plan's Task-2 prose asked for "every pair of boxes among {icon, verdict, stepNumber}" to have zero
  intersection, but its own Task-1 prose simultaneously required recording that "the moved verdict grazes
  the `stepNumber` slot by 2×16px". Those two sentences cannot both hold — verdict spans x −8…14 and the
  137-B `.stepn` spans x 12…34, so they intersect on x [12,14] × y [12,28] = 32px². The plan's
  `must_haves` and SPEC criterion 23 both say **"0 overlaps between rendered marks"**, and D-183-07 keeps
  `phase_index` off the face, so `stepNumber` renders nothing. Resolution: the zero-overlap assertion runs
  over rendered marks; the graze is pinned to its exact 32px² alongside an assertion that the slot really
  does paint nothing and that moving it to `left:16` clears it. See Deviations.
- **Boxes are parsed from the component, not re-typed.** `boxOf` reads the Tailwind placement classes off
  the rendered elements and the container dimensions off `CANVAS_LAYOUT`. Editing a placement class in
  `PhaseNodeCard.tsx` therefore moves the boxes — which is the only version of this check that is
  falsifiable rather than a second copy of the geometry free to drift from it. The size parser throws
  rather than defaulting, because a silent `0` would make every overlap vanish and the whole check pass by
  accident.
- **The 137-D class names are not quoted anywhere in `PhaseNodeCard.tsx`.** The acceptance criteria grep
  the component for the removed tokens; a docblock spelling them to explain the history would have made
  the guard vacuous. The prior shape is described in words instead, with a sentence saying why.
- **Inner icon-well layers were kept byte-unchanged in kind.** The radial tint, the `inset-1` blur disc,
  the contact shadow and the `text-[20px]` glyph wrapper were not resized for the 62px well, per the
  plan's "unchanged in kind" instruction. Only the well's own position and size changed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Resolved a self-contradiction in Task 2's zone-check specification**

- **Found during:** Task 2 (Pin the geometry)
- **Issue:** The plan's Task-2 action says *"Assert that every pair of boxes among {icon, verdict,
  stepNumber} has zero intersection area"*, while its Task-1 action says *"Record the residual verbatim:
  the moved verdict grazes the `stepNumber` slot by 2×16px"*. The coordinates the plan itself supplies
  (verdict x −8…14 / y 6…28; stepNumber x 12…34 / y 12…34) intersect on 2×16 = 32px², so an
  all-three-pairs assertion is mathematically unsatisfiable. Written literally, Task 2 could not pass.
- **Fix:** Followed the plan's own `must_haves` and SPEC criterion 23, which both scope the check to
  **rendered** marks. The mark table carries a `rendered` flag; the zero-overlap assertion iterates
  rendered pairs; the `stepNumber` graze is asserted to be exactly 32px², accompanied by a live assertion
  that the slot paints nothing (`stepNumber: 3` produces no matching text) and by an assertion that the
  documented `left:16` remedy drives it to 0. Nothing was weakened — the residual is now pinned to a
  number instead of described in prose.
- **Files modified:** `frontend/src/components/workflows/PhaseNodeCard.test.tsx`
- **Verification:** `npx vitest run src/components/workflows/PhaseNodeCard.test.tsx` → 49/49 green;
  the residual assertion is a hard `toBe(32)`, not a tolerance.
- **Committed in:** `5c43702d` (Task 2 commit)

**2. [Rule 1 - Bug] Corrected two further docblocks that the rebuild made false**

- **Found during:** Task 1 (Rebuild the card)
- **Issue:** The plan named three docblocks to rewrite. Two more in the same file stated things the
  rebuild made untrue: the `BadgeSlot2Tuple` type docblock headed *"THE 137-D TWO-BADGE BUDGET"*, and the
  `verdict` prop's JSDoc said *"rendered on the card's RIGHT edge by 184-08"*. Leaving them would have
  reproduced, inside the same file, the exact defect this plan exists to remove — a docblock that reasons
  from a geometry the component does not have.
- **Fix:** `137-D` → `137-B` in the budget heading (the budget itself is untouched — still a max-2 tuple),
  and the `verdict` prop's JSDoc now says it was rendered by 184-08 and relocated to the LEFT edge by
  185-01 (D-185-17), naming why.
- **Files modified:** `frontend/src/components/workflows/PhaseNodeCard.tsx`
- **Verification:** `grep -c -- '-right-2'` returns 0; `npx tsc -b` reports no error naming the file.
- **Committed in:** `c31c3811` (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking spec contradiction, 1 docblock correctness bug)
**Impact on plan:** Neither expands scope. Deviation 1 was required for Task 2 to be executable at all and
resolves in the direction the plan's own `must_haves` and the SPEC both state. Deviation 2 finishes the
job the plan chartered — removing docblocks that reason from an unbuilt card — inside the same file.

## Issues Encountered

**The `vitest-count-gate.cjs` acceptance criterion is unsatisfiable at baseline — pre-existing, proven.**

Task 2's acceptance criteria ask for `node scripts/vitest-count-gate.cjs` to exit 0 with all 16 pinned
files at delta 0. **The gate was already violated before this plan started.** Both halves were measured
directly, by reverting all five files to `59c32a06` (the commit before Task 1) and running the gate:

| Run | total | failed | pinned files at non-zero delta |
|---|---|---|---|
| Baseline (`59c32a06` content) | 1497 | **34** | `canvasModel.purity.test.ts` +10 · `WorkflowCanvas.test.tsx` +2 · `WorkflowBuilderPage.canvas.test.tsx` +50 |
| After this plan | 1504 | 35 | the same three, at the same deltas |

The +7 total is exactly this plan's 7 new tests (`PhaseNodeCard.test.tsx` 42 → 49; it is not a pinned
file, so it reports as `new` and is free to grow). The three non-zero pinned deltas are all **positive**
and identical in both runs — pre-existing suite growth that was never re-pinned, not a deletion.

Diffing the failing-test *names* between the two reports shows 5 "new" and 4 "fixed" failures, **all in
files this plan does not touch** (`ProblemsTray`, `PublishGauntlet`, `WorkflowBuilderPage*`,
`revertByteIdentical`, `PhaseFormPanel`) and with **no test appearing in both lists**. That is flake
churn in a heavily parallel jsdom suite — consistent with the documented pre-existing frontend vitest rot
(SEED-056) and with the `Axe is already running` / 5s-timeout cross-file pollution in
`WorkflowCanvas.test.tsx`, which fails 1–2 axe tests non-deterministically at baseline too (verified by
running that file alone on pristine `59c32a06`: 2 failed / 31 passed).

**What IS satisfied, and is the half this plan owns:** `canvasModel.test.ts` reports exactly **26** tests,
all passing, delta 0 — the pin the plan was explicitly told not to move. No `it()` block was added to or
removed from that file.

**Out of scope, logged not fixed:** the three stale pins and the axe cross-file pollution. Fixing them
would mean re-pinning `BASELINE` for suites this plan has no claim on, and chasing ~34 pre-existing
failures across `PublishGauntlet`, `StepTypePicker`, `ProblemsTray` and `WorkflowBuilderPage`.

## Verification Results

| Check | Result |
|---|---|
| `grep -n "NODE_MIN_HEIGHT: 104" canvasModel.ts` | 1 line ✅ |
| `grep -c "NODE_MIN_HEIGHT: 96" canvasModel.ts` | 0 ✅ |
| `grep -n '\-left-2 top-1.5' PhaseNodeCard.tsx` | 1 line ✅ |
| `grep -c '\-right-2' PhaseNodeCard.tsx` | 0 ✅ |
| `grep -c 'ml-6' PhaseNodeCard.tsx` | 0 ✅ |
| `grep -c 'w-\[248px\]' PhaseNodeCard.tsx` | 1 ✅ |
| `grep -c 'left-0 top-1/2' PhaseNodeCard.tsx` | 0 ✅ |
| `grep -c 'pt-\[42px\]' PhaseNodeCard.tsx` | 2 ✅ |
| `grep -cE '<(button\|a)\b\|tabIndex\|onClick' PhaseNodeCard.tsx` | 0 ✅ (no focusable control in the card) |
| `npx tsc -b` | 33 errors — the documented baseline; **0** name any of the plan's files ✅ |
| `npx vitest run PhaseNodeCard.test.tsx` | 49/49 green ✅ |
| `npx vitest run canvasModel.test.ts` | 26/26 green, count pin held ✅ |
| `npx vite build` | `✓ built in 21.08s` ✅ |
| `git diff --stat -- supabase/migrations` | 0 files ✅ |
| `git diff --stat -- backend/` | 0 files ✅ |
| `node scripts/vitest-count-gate.cjs` | ⚠️ violated — **pre-existing**, see Issues Encountered |

## Threat Model Compliance

| Threat ID | Disposition | Status |
|---|---|---|
| T-185-01-01 (info disclosure, authored strings) | accept | Unchanged. No `dangerouslySetInnerHTML` added; the shipped XSS clause and its grep guard (`PhaseNodeCard.test.tsx`) are untouched and green. |
| T-185-01-02 (EoP, node focus surface) | mitigate | Held. `grep -cE '<(button\|a)\b\|tabIndex\|onClick'` on the card returns 0; the leaf-level walk (`container.querySelectorAll("button, a, [tabindex]")` → 0) and the canvas-level walk at `WorkflowCanvas.test.tsx:231-238` both pass. |

No package installs. No migration. No new dependency. Live migration head stays at 113.

## Known Stubs

None. This plan renders no placeholder and wires no empty data source. The `stepNumber` and `status`
slots still render nothing, but that is their **shipped, deliberate** state (D-183-07 for `stepNumber`;
Phase 188 owns `status`) — declared seams, not stubs, and both are asserted to render nothing.

## User Setup Required

None — no external service configuration required. This plan is frontend-only and flag-neutral.

## Next Phase Readiness

- **185-09 can place the governance seal.** The card's top-right corner is empty. Adding the seal box to
  the occupancy table is a one-line edit, and the exact line is written in the test file's docblock:
  `{ name: "governance seal", rendered: true, box: { x0: 227, y0: 11, x1: 248, y1: 32 } }`. The
  assertions then cover it with no other change.
- **Phase 188's run-state slot inherits the same table** — same one-line extension.
- **Marks must not take `overflow-hidden`.** The icon well now overflows the node box upward by 26px, the
  same overflow the verdict mark already relied on. This is stated at the markup so a later phase cannot
  clip it accidentally.
- **Concern for the phase verifier:** operator UAT should confirm the card *reads* right at real zoom —
  a jsdom zone check proves marks do not collide, it does not prove the 42px top padding feels correct
  under the 62px well. Guardrail G-4 applies (this is a user-visible canvas surface).
- **Not a blocker, but owed:** the three stale `vitest-count-gate.cjs` pins
  (`canvasModel.purity.test.ts` 69→79, `WorkflowCanvas.test.tsx` 31→33,
  `WorkflowBuilderPage.canvas.test.tsx` 22→72) and the axe cross-file pollution should be re-pinned/fixed
  by a dedicated pass. Until then the gate cannot exit 0 for any plan in this phase.

## Requirement Status — GOVERN-02 deliberately left Pending

This plan's frontmatter carries `requirements: [GOVERN-02]`, but **`requirements.mark-complete` was NOT
run and GOVERN-02 stays `Pending` in `REQUIREMENTS.md`.**

GOVERN-02 reads: *"The canvas **visibly marks** each node's governance state … so a business user can see
which steps are trustworthy/cited vs exploratory."* This plan adds **no governance mark at all** — that is
its defining constraint. Marking the requirement Complete here would create exactly the false traceability
record that fired through Phase 183 and all 13 plans of Phase 184 (`CANVAS-02` was almost marked Complete
at plan 1 of 13 with no canvas editing code in existence), and it is the same failure class as
D-ITEM-183-02: an artifact that only passes by making a neighbouring claim lie.

GOVERN-02 becomes observable when 185-09 places the seal. **Mark it at phase end, after verification.**

## Self-Check: PASSED

All 5 modified files exist on disk. Both task commits (`c31c3811`, `5c43702d`) resolve in `git log`.
No file claimed by this summary is missing.

---
*Phase: 185-graded-governance-per-node-grounding-mode-action-risk-dial*
*Completed: 2026-07-29*
