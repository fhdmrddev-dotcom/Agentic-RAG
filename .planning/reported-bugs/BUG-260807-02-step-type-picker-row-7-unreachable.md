---
id: BUG-260807-02
title: The StepTypePicker's last rows are clipped away inside the overflow-hidden react-flow container — the 7th step type (external_action) is unreachable by mouse or keyboard from every insertion door
reported: 2026-08-07
surface: Agentic-RAG
severity: blocker
status: open
affected_areas: [frontend/workflow-canvas, frontend/step-type-picker, a11y/keyboard-nav]
folded_into: null
verified_closed_by: null
related_seeds: []
re_open_trigger: null
reproduces_on:
  branch: develop
  commit: HEAD at 189-16 Task 3 live UAT (post 4710aa08)
  date: 2026-08-07
---

# BUG-260807-02: the step-type picker's last rows are unreachable — including the 7th type Phase 189 ships

> Found by DRIVING, at `189-16` Task 3, as the **first action of the session**. Every number below was
> executed against the live app via Chrome MCP, not inherited. Reproduced on two independent workflows.

## What we observed

The `StepTypePicker` menu renders **inside** the `.react-flow` container, which has
`overflow-y: hidden`. The menu itself is `position: static`, `z-index: auto`, `maxHeight: none`, and
**is not scrollable** (`scrollHeight === clientHeight`). The document does not scroll either
(`scrollHeight === clientHeight === 666`). Any row that extends past the container's bottom edge is
therefore clipped away, and **there is no scroll path to it at all**.

Measured at the default window (`innerHeight` 666, `.react-flow` bottom **656**), via
`document.elementFromPoint` at each row's own centre:

| Row | Label | y range | reachable |
|---|---|---|---|
| 1 | Prepare the inputs | 404..452 | ✅ |
| 2 | Write it up | 452..500 | ✅ |
| 3 | Work out how to do it | 500..548 | ✅ |
| 4 | Work on the parts together | 548..596 | ✅ |
| 5 | Wait for your approval | 596..644 | ✅ |
| 6 | Produce the deliverable | 644..692 | ⛔ |
| **7** | **Sends an email** (`external_action`) | **692..740** | ⛔ |

**All three insertion doors fail identically** — `Add a step before step 1`, `Add a step before
step 2`, and `Add a step at the end`. The last is worst: **3** rows clipped instead of 2.

## Four user actions were tried. All four fail.

1. **Window resize** — this estate caps `innerHeight` at 732. Row 7 still clipped.
2. **Browser zoom** at `0.67` and `0.5` — the affordance anchor sits at a fixed fraction of the
   container height, so the overflow is **scale-invariant**. At `0.67` row 6 came back; **row 7 never
   did**, at any zoom level tried.
3. **Keyboard** — `ArrowDown` and `Tab` both leave `document.activeElement` on the `＋` button. Focus
   never enters the menu. The menuitems carry no `tabindex`. **So there is no keyboard path either**,
   which also means the picker is not operable by a keyboard-only or screen-reader user at all.
4. **React Flow's own Zoom Out control** — moves the affordance *down* (306 → 325), making it worse.

## Why it matters

**The 7th row is `external_action` — the entire capability Phase 189 exists to deliver.** A user
cannot place it with a mouse, and cannot reach it with a keyboard. Row 6 (`llm_emit`, "Produce the
deliverable") is also unreachable, so this is not solely a 189 regression — but 189 is what pushed the
menu one row taller, and 189's own type is the one that fell off the end.

Severity is **blocker** rather than major on that basis: the phase's headline feature is not reachable
through the UI at the default viewport. During the 189-16 UAT both placements had to be made with a
synthetic `element.click()`, which bypasses hit-testing — i.e. the session drove a workflow **a real
user could not have built**.

## Hypothesized cause

*(Finding, not hypothesis — each property was read off the live DOM.)* The menu is rendered as a
normal child inside the canvas subtree instead of being portalled to `document.body`, and it has no
`max-height` + `overflow:auto`, no flip-up-when-it-would-overflow, and no collision detection. The
`.react-flow` container's `overflow-y: hidden` is standard for xyflow and is not itself the bug; the
bug is putting an overlay inside a clipping container.

## ⚠ ATTEMPTED AND REVERTED — `max-height` + `overflow-y: auto` alone DOES NOT CLOSE THIS

A `/gsd:fast` attempt on 2026-08-07 added `max-h-[min(46vh,340px)] overflow-y-auto
overscroll-contain` plus an `onWheel` `stopPropagation` to the panel's own className. **It was
driven, measured, found insufficient, and reverted** — the tree is unchanged. Recorded here so the
next person does not spend the same hour.

The CSS took effect exactly as intended — `overflowY: auto`, `maxHeight: 309.856px`,
`scrollHeight > clientHeight` — **and the rows were still unreachable**, because bounding the
panel's HEIGHT does nothing about where its TOP sits:

```
panelBottom 682  >  reactFlowBottom 597      (innerHeight 674)
unreachable rows — door 1: [1,2,3,4,5,6,7] · door 2: [1,7] · door 3: [1,2,7]
```

Door 1 got **worse**: the shorter panel repositioned and all seven rows ended up clipped. The
lesson is that the panel's top is already low enough that even a bounded panel overflows the
container, so **no static `max-height` can be correct** — the bound has to be *the space actually
available below the anchor*, which is a measured quantity, not a constant.

⚠ **This also means the `onWheel` half is necessary but not sufficient**, and it should be kept in
whatever the real fix turns out to be: without it the wheel bubbles to react-flow's d3-zoom and
zooms the canvas instead of scrolling the menu, which would make any scrollbar decorative.

**Consequence for routing: this is NOT `/gsd:fast` work.** Any correct fix needs a render-time
measurement plus a re-measure on resize/zoom, which exceeds G-3's ≤1-file / ≤10-line cap. Route to
`/gsd:quick` or fold into a phase.

## Fix sketch

Any one of these closes it; the first is the standard fix — and note the second is the one that was
tried in isolation and **failed**:

- **Portal the menu to `document.body`** (a floating-ui / Radix `Portal` + `position: fixed`), so the
  canvas's `overflow: hidden` cannot clip it. This is what the rest of the app's popovers already do —
  the KB `combobox` on the same screen opens fine because it is not inside `.react-flow`.
- **~~Add `max-height` + `overflow-y: auto`~~ — TRIED IN ISOLATION, DOES NOT WORK.** See the
  attempted-and-reverted section above: a *static* bound cannot help, because the panel's top is
  already below the container's usable region. It only works if the max-height is computed from the
  measured space between the anchor and `.react-flow`'s bottom edge — and if it is, the `onWheel`
  guard must ship with it.
- **Flip up when the menu would overflow the container**, the usual collision behaviour.

⚠ **Also fix the keyboard path** — it is a second, independent defect surfaced by the same
investigation. `role="menu"` with `role="menuitem"` children is a WAI-ARIA pattern that REQUIRES
arrow-key roving focus; today focus never enters the menu. Note the *capability* picker
(`ExternalActionSection`) got exactly this treatment as review finding WR-04 and now has a correct
roving tabindex (`0,-1,-1`) with working `ArrowDown`/`ArrowUp` — that is the shape to copy.

⚠ **jsdom cannot see this defect.** It applies no CSS, computes no stacking contexts or overflow
clipping, and `.click()` bypasses hit-testing — which is exactly why the picker's unit tests are green
while the row is unreachable. The regression check must be a driven `elementFromPoint` row at a small
viewport, with a falsification control observed swinging both ways.

## Surface classification

`Agentic-RAG` — this app's own frontend. Routes at the four GSD touchpoints.

## Suggested routing

- **Fold into in-flight phase:** Phase 189 is at its close gate with all four success criteria met.
  Folding a fix here would be new work inside a closure step — the shape G-7 exists to stop.
- **Defer to future phase:** **`/gsd:fast` or a small dedicated phase, BEFORE Phase 190.** Sizing is
  small (one component, portal or max-height), but the keyboard half may warrant its own task, and
  190 will add connector UI to the same canvas.
- **Plant as seed:** n/a — concrete and local.
- **External — note only:** no

## Reference / evidence links

- `frontend/src/components/workflows/StepTypePicker.tsx` — the menu
- `frontend/src/components/workflows/WorkflowCanvas.tsx` — the `.react-flow` host with `overflow: hidden`
- `frontend/src/components/workflows/ExternalActionSection.tsx` — the roving-tabindex pattern to copy (WR-04)
- `189-VALIDATION.md` § *DRIVEN SESSION — 189-16 Task 3* — the full measurement table and the four failed workarounds
- `BUG-260806-01` / `BUG-260807-01` — the two prior occlusion/hit-test defects that survived into shipped code for the same reason: jsdom cannot see them
