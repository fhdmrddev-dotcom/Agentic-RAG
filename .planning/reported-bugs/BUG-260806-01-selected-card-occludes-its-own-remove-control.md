---
id: BUG-260806-01
title: A selected phase card occludes its own ✕ remove control on the editable canvas
reported: 2026-08-06
surface: Agentic-RAG
severity: major
status: open
affected_areas: [frontend/workflow-canvas, frontend/editing-affordances]
folded_into: null
verified_closed_by: null
related_seeds: []
re_open_trigger: null
reproduces_on:
  branch: develop
  commit: 42b9cec9
  date: 2026-08-06
---

# BUG-260806-01: A selected phase card occludes its own ✕ remove control

## What we observed

On the editable Workflow Builder canvas (draft `compliance-gap-report-1u9vcs`,
viewport 1522 × 522, canvas zoom 1.69), hit-testing each editing affordance at
its own centre with `document.elementFromPoint`:

| Affordance | Reachable | What actually sits at that pixel |
|---|---|---|
| `＋ Add a step before step 1` | yes | the `＋` button |
| `＋ Add a step before step 2` | yes | the `＋` button |
| `＋ Add a step at the end` | yes | the `＋` button |
| `✕ Remove step 1` | yes | the `✕` button |
| `✕ Remove step 2` | **no** | `DIV.mx-auto block w-[248px] rounded-[22px] …` — the `PhaseNodeCard` |

The distinguishing variable is **selection**, not position. Measured node state
at the moment of the failing hit-test:

```
Work out how to do it        selected: false   z-index: 0
Fill compliance-gap-report   selected: TRUE    z-index: 1000
○ (end cap)                  selected: false   z-index: 0
```

Deselecting (all nodes return to `z-index: 0`) and re-running the identical
hit-test returns the `✕` button. Reachable flips **false → true** with no other
change.

The `✕` itself is not at fault: computed `opacity: 1`, `pointer-events: auto`,
correctly positioned, and it moves with its card under drag (measured: card
+76 y, `✕` +76 y). It is simply painted under the card.

## Why it matters

Clicking a card is *how* a card becomes selected. So the natural user flow —
click the phase you want to delete, then click its `✕` — is not completable
with a real pointer. The user sees an enabled, fully-revealed control that does
not respond.

Severity **major** rather than minor: the control is not merely awkward, it is
unreachable in the state a user most likely reaches it from, and the failure is
silent (no error, the click lands on the card and selects it again).

This defect class is invisible to the entire automated suite:

- `.click()` and `fireEvent.click()` dispatch directly to the element and bypass
  hit-testing entirely, so every unit test passes.
- jsdom applies no CSS and computes no stacking contexts.

`WorkflowCanvas.tsx:390-410` records a prior incident of exactly this class (a
`pointer-events` rule once shipped an unreachable `＋` while every unit test was
green). This is the same class, a different mechanism.

## Hypothesized cause

Hypothesis, not yet confirmed by a fix:

`@xyflow/react` elevates a selected node to `z-index: 1000`. The editing
affordances render through the library's `<ViewportPortal>`, whose container
`.react-flow__viewport-portal` carries `z-index: auto` — so the portal's
children participate in the stacking context at effectively `auto` and lose to
any node at 1000.

Likely fix shapes (untested): give the portal container a stacking context above
the selected-node elevation, or render the affordance layer above the node
renderer rather than in the viewport portal. Either needs care — the portal is
what makes the affordances pan and zoom with the plane, which is load-bearing.

## Not introduced by Phase 188.1

Phase 188.1 extracted `PlaneEditingLayer` and `EDIT_AFFORDANCE` out of
`WorkflowCanvas.tsx`. Evidence this defect predates that move:

- `git show 14917821^:frontend/src/components/workflows/WorkflowCanvas.tsx`
  (the pre-extraction tree) and the shipped `PlaneEditingLayer.tsx` **both**
  render through `<ViewportPortal>`, and **neither sets any `zIndex`**.
- `188.1-02`'s `AFFORDANCE_SHAPE_BASELINE`, captured from the pre-move tree,
  still deep-equals after the extraction — the rendered geometry is unchanged.

Found *during* 188.1's operator UAT, caused by something older.

## Surface classification

`Agentic-RAG` — this app's own Workflow Builder canvas. A routing candidate at
`/gsd:discuss-phase`, `/gsd:new-milestone`, and `/gsd:complete-milestone`.

Natural home: the next phase touching `PlaneEditingLayer.tsx`, the viewport
portal, or node z-index/selection. Note that `PhaseNodeCard.tsx`'s hot-file
ledger row now reads **G-5 fires — extraction due**, so a refactor phase on that
file is already owed; this bug is a candidate to fold into it.
