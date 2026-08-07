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

## Resolved — the clipping half (2026-08-08, `/gsd:quick 260807-x9p`)

> ⚠ **The report stays `open`.** Only the CLIPPING half is closed. The KEYBOARD defect
> (item 3 above — `ArrowDown`/`Tab` never move focus into the menu, the menuitems carry no
> `tabindex`) was NOT touched by this work and is why `status` is unchanged. `role="menu"`
> with `role="menuitem"` children is a WAI-ARIA pattern that REQUIRES arrow-key roving
> focus, and the shape to copy is the one `ExternalActionSection` already ships as review
> finding WR-04 (roving tabindex `0,-1,-1`, working `ArrowDown`/`ArrowUp`).

### What shipped

Not a static `max-height` — that was tried, measured, and reverted (section above). The
bound is now **measured from the live container box and viewport transform on every
render**, by a pure function `pickerPlacement` in `editAffordance.ts`:

- it picks the SIDE with more room and flips the panel **up** when that is above the `＋`;
- its height budget is the space actually available to `.react-flow`'s edge, less an 8px
  margin, floored at 120px;
- it clamps the panel **horizontally** into the container;
- the panel carries `nowheel` / `nopan` — `@xyflow/system`'s own opt-out classes, which
  `isWrappedWithClass` finds by an ancestor walk from the event target — plus
  `overflow-y-auto overscroll-contain`. `nowheel` is the half that works; React's
  synthetic `onWheel` is delegated to the root and fires after the native event has
  already passed d3-zoom, so it ships as belt-and-braces only.

Re-measurement on resize and on zoom is free and has no listener of ours: `width`,
`height` and `transform` are read from `@xyflow`'s store, whose size is maintained by the
library's own ResizeObserver.

### Driven evidence — three doors × seven rows, `elementFromPoint` at each row's centre

Chrome (Playwright/CDP) at viewport **1280 × 666**, on a live 3-phase draft in the Builder
canvas. `.react-flow` measured at `top 177.5 / bottom 589.3 / left 58 / right 1236`. The
live viewport transform was `scale(1.57647)` — **a real zoom ≠ 1**, so the counter-scale
path is exercised, not merely reasoned about. **Two runs, byte-identical figures.**

| Door | testid | panel rect | contained | maxHeight | scrollable | rows reachable |
|---|---|---|---|---|---|---|
| before step 1 | `canvas-insert-0` | `370.9..581.5` × `66..366` | ✅ | `210.612px` | ✅ `377 > 209` | **7 / 7** |
| before step 2 | `canvas-insert-1` | `370.9..581.5` × `331.7..631.7` | ✅ | `210.612px` | ✅ `377 > 209` | **7 / 7** |
| at the end | `canvas-insert-2` | `370.9..581.5` × `836.2..1136.2` | ✅ | `210.612px` | ✅ `472 > 209` | **7 / 7** |

Row 7 (`external_action`) on door 1, the row this bug is named for: probed at `526..574`,
**reachable**. Every row on every door returned itself or a descendant from
`document.elementFromPoint`.

The height budget is a SCREEN-px gap and is correctly NOT scaled: `589.3 − 370.9 − 8 =
210.4`, against a measured `max-height: 210.612px`, at zoom 1.576.

⚠ **THE PROBE HAD TO BE CORRECTED MID-SESSION, and the correction is the finding.** The
first version used `row.scrollIntoView({ block: "nearest" })`, as planned. That walks up
and scrolls the **nearest scrollable ancestor** — and `.react-flow` is `overflow: hidden`,
which is *programmatically* scrollable even though it has no scrollbar and no user gesture
can move it. It manufactured reachability a real user cannot get, and the tell was that
**the falsification control refused to swing**. The probe now scrolls the PANEL and only
the panel, and captures `scrollTop`/`scrollLeft` on `.react-flow`, `.react-flow__viewport`,
`.react-flow__viewport-portal` and `document.scrollingElement` before and after every
door: all four measured `0,0 → 0,0` on all three doors. A probe that can cheat proves
nothing, and this one nearly did.

### The falsification control, observed swinging BOTH ways

With door 1 open, `panel.style.maxHeight = "none"` and `overflowY = "visible"` set on the
live element, then restored — ancestors unmoved throughout:

| | state | panel rect | contained | reachable |
|---|---|---|---|---|
| a | as shipped | `370.9..581.5` | ✅ | **7 / 7** |
| b | **bound removed** | `370.9..749.9` | ❌ (`749.9 > 589.3`) | **4 / 7** — `llm_human_input`, `llm_emit`, **`external_action`** unreachable (`hit: null` for rows 6 and 7) |
| c | bound restored | `370.9..581.5` | ✅ | **7 / 7** |

### The wheel, and its own control

| | before | after | verdict |
|---|---|---|---|
| wheel over the MENU (real CDP wheel, +220) | viewport `translate(53px, 114.565px) scale(1.57647)` · `scrollTop 0` | viewport `translate(53px, 114.565px) scale(1.57647)` · `scrollTop 168` | viewport **byte-identical**, menu **scrolled** |
| CONTROL — same wheel over `.react-flow__pane` | `translate(53px, 114.565px) scale(1.57647)` | `translate(193.896px, 94.8328px) scale(1.16207)` | canvas **still zooms** |

### Door 1's horizontal relationship — the reverted attempt's unexplained all-7 failure

The report recorded that the reverted static-`max-height` attempt made door 1 *worse*
(2 clipped rows → all 7) and could not say why. **Measured, it was HORIZONTAL, not
vertical**, and the x clamp is what closes it: door 1's wrapper transform carries a
trailing `translate(238.765px, 0px)` correction, and the panel's clamped left edge sits at
`66` — exactly `.react-flow`'s left (`58`) plus the 8px margin. Without the correction the
left edge would sit at `66 − 238.765 = −172.8`, i.e. **231px off the container's left
edge**, with the panel almost entirely outside it. That is a whole-panel horizontal
overflow, which is precisely what "all seven rows clipped" looks like.

### Gates

- `npx tsc --noEmit -p tsconfig.app.json` — **33 errors, unchanged** from the pre-change
  measurement taken before any file was edited.
- `node scripts/vitest-count-gate.cjs` — exit 0, **zero `[count-decrease]`**. Two pins
  EXTENDED (never lowered): `StepTypePicker.test.tsx` 46 → 52 and the net-new
  `editAffordance.test.ts` at 31, both read from the script's own `actual` column across
  two agreeing runs.
- `eslint src/components/workflows/` — **5 errors, unchanged** (all pre-existing:
  `BuilderStoreProvider.tsx` ×3, `FlowEdge.tsx` ×1, and the shipped `pane` stand-in's
  `onMouseDown` in `StepTypePicker.test.tsx`).
- `WorkflowCanvas.editing.test.tsx`'s `AFFORDANCE_SHAPE_BASELINE` — **not re-captured.**
  The corrections are appended to the wrapper transform only when they are not the
  identity, so an unmeasured container still emits the shipped string byte-for-byte.

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
