---
id: BUG-260807-02
title: The StepTypePicker's last rows are clipped away inside the overflow-hidden react-flow container — the 7th step type (external_action) is unreachable by mouse or keyboard from every insertion door
reported: 2026-08-07
surface: Agentic-RAG
severity: blocker
status: closed
affected_areas: [frontend/workflow-canvas, frontend/step-type-picker, a11y/keyboard-nav]
folded_into: null
verified_closed_by: 260808-148
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

~~⚠ **Also fix the keyboard path**~~ — **DONE, 2026-08-08 (`/gsd:quick 260808-148`). See
*Resolved — the keyboard half* below.** It was a second, independent defect surfaced by the same
investigation: `role="menu"` with `role="menuitem"` children is a WAI-ARIA pattern that REQUIRES
arrow-key roving focus, and focus never entered the menu. `ExternalActionSection`'s WR-04 roving
tabindex was the shape copied — with ONE deliberate divergence, since that component is a
`radiogroup` (where APG makes Left/Right synonyms of Up/Down) and this one is a vertical `menu`
(where they are not). That divergence is the driven falsification control below.

⚠ **jsdom cannot see this defect.** It applies no CSS, computes no stacking contexts or overflow
clipping, and `.click()` bypasses hit-testing — which is exactly why the picker's unit tests are green
while the row is unreachable. The regression check must be a driven `elementFromPoint` row at a small
viewport, with a falsification control observed swinging both ways.

## Resolved — the clipping half (2026-08-08, `/gsd:quick 260807-x9p`)

> ⚠ ~~**The report stays `open`.**~~ **SUPERSEDED 2026-08-08** — this caveat was true when
> written and is no longer. The KEYBOARD defect it names (item 3 above) was closed the
> next day by `/gsd:quick 260808-148`; see *Resolved — the keyboard half* below, and the
> frontmatter, which now reads `status: closed` / `verified_closed_by: 260808-148`. It is
> struck rather than deleted so the report cannot read as owing work that shipped, and so
> the two halves stay legible as the two separate pieces of work they were.

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

## Resolved — the keyboard half (2026-08-08, `/gsd:quick 260808-148`)

Every number below was DRIVEN: real key presses through CDP `Input.dispatchKeyEvent`
(Playwright `keyboard.press`), never `dispatchEvent`, on the live app at **1280 × 666**, on
the `Compliance Gap Report` draft (2 phases, 3 insertion doors) in the Builder canvas.
State read with `evaluate`; no screenshot (it times out in this estate).

### The RED, measured on this build before a line was written

Not quoted from the report above — re-measured, because a before-state taken from a
document is not evidence about the build being changed.

| after | `document.activeElement` | `panel.contains(active)` | menuitems | with `tabindex` |
|---|---|---|---|---|
| opening door `canvas-insert-0` | `canvas-insert-0` (the `＋`) | **false** | 7 | **0** |
| a REAL `ArrowDown` | `canvas-insert-0` — **unmoved** | false | 7 | 0 |
| a REAL `Tab` | **`canvas-insert-1`** — the NEXT door | false | 7 | 0 |

The `Tab` row is sharper than the original report: focus does not merely stay put, it
jumps straight **past the open menu** to the next `＋`. All seven `tabindex` read `null`.

### The same seven readings after the fix

| # | Reading | Measured |
|---|---|---|
| 0 | panel genuinely scrollable | `scrollHeight 377 > clientHeight 209`, `max-height 210.612px` — a walk that never needs to scroll would prove nothing |
| 1 | **focus enters** | `document.activeElement` = `step-type-choice-programmatic`, `panel.contains(active)` = **true** — the exact inverse of the RED |
| 2 | the roving array | `["0","-1","-1","-1","-1","-1","-1"]` over the seven rows in DOM order |
| 3 | the walk | `ArrowDown` ×6 → `llm_single`, `llm_agent`, `llm_batch_agents`, `llm_human_input`, `llm_emit`, **`external_action`**; a 7th WRAPS to `programmatic`; `ArrowUp` from row 1 wraps to `external_action`; `Home` → row 1; `End` → row 7 with roving `[…,"0"]` |
| 4 | **the ancestor fence** | `.react-flow`, `.react-flow__viewport`, `.react-flow__viewport-portal`, `document.scrollingElement` all **`0,0 → 0,0`**; viewport transform `translate(53px, 114.565px) scale(1.57647)` **byte-identical** before and after; the PANEL's own `scrollTop` **0 → 18 → 66 → 114 → 162** |
| 5 | reachability, unregressed | row 7 focused, rect `531.9..579.9`, `elementFromPoint` at its centre returns a descendant — **reaches: true** |
| 6 | the refused row | door 2 (after the terminal `llm_emit`) refuses **all seven**; `End` lands focus on `external_action` with `aria-disabled="true"`, **no native `disabled`**, `tabindex="0"`, `aria-describedby` → real DOM text *"This would come after the deliverable, so the workflow would no longer end with it."* `Enter`, `Space` and a **real pointer click at (986.2, 549.5)** each left the menu open and the node count at **3 → 3 → 3 → 3** |
| 7 | dismissal | see the three routes below |

Note the panel `scrollTop` column in row 4: it stays `0` for the first two presses (rows 2
and 3 are already visible) and then moves only as far as each row needs. That is the
reveal arithmetic working, not a blanket jump — and `162` is the panel's own maximum.

### The three dismissal routes — focus is never stranded on `document.body`

| route | menu | `document.activeElement` after |
|---|---|---|
| `Escape` | closed | **`canvas-insert-0`** — the `＋` that opened it |
| choosing a row (`ArrowDown`, `Enter`) | closed | **`canvas-insert-0`**, and the canvas went **3 → 4 nodes**, so the choice really landed |
| clicking the BARE `.react-flow__pane` (1206, 569) | closed | **`canvas-insert-0`** — the press focuses nothing, so the restore correctly fires |
| clicking a phase CARD (900, 300) | closed | `rf__node-emit` — React Flow's own focusable node wrapper. The restore correctly **stood down**: the user deliberately moved focus, and the contract that binds is the weaker, honest one — never `document.body`. |

### Both controls, observed swinging BOTH ways

**Keyboard — vertical `menu`, not `radiogroup`.** In one session, from row 1:
`ArrowRight` → `programmatic` (unmoved) · `ArrowLeft` → `programmatic` (unmoved) ·
`ArrowDown` → `llm_single` (**moved**).

**Scroll.** Door 0 open, focus in the menu, walking `Home` → `End`:

| | state | panel `scrollTop` | row 7 rect | `elementFromPoint` |
|---|---|---|---|---|
| a | as shipped | `0 → 162` (**moves**) | `531.9..579.9` | **reaches** |
| b | `maxHeight:none` + `overflowY:visible` set live | `0 → 0` (**does not move**) | `693.9..741.9` | **`hit: null`** |
| c | restored | `35 → 162` (**moves**) | `531.9..579.9` | **reaches** |

Ancestors read `0,0` throughout all three legs.

⚠ **THE FIRST PROBE'S LEG (c) DID NOT RESTORE, AND THE FAULT WAS THE PROBE'S.** It cleared
`p.style.maxHeight`, but React had set that `max-height` as an **inline** style — clearing
it removes React's own declaration, and React does not re-apply it without a re-render. So
the panel stayed unbounded and leg (c) read as a failure of the fix. The probe now
restores by re-assigning the captured value (`210.612px`). Recorded because a control that
appears not to swing back is exactly the shape of a real regression, and the difference
between the two is a measurement rather than a judgement call.

### ⚠ THE DEFECT THE UNIT SUITE COULD NOT SEE, found by driving

The first driven run reported `Escape` closing the menu and leaving
`document.activeElement` on **`document.body`** — five samples out to 1000 ms, with the
real `＋` still in the DOM and still the same node throughout. Fifteen jsdom cases,
including two dedicated focus-return cases, were green against that build.

Instrumented rather than guessed: `main.tsx` wraps the app in `<StrictMode>`, so React
double-invokes effects in dev. The two captures read
**`["canvas-insert-0", "step-type-choice-programmatic"]`** — the first is the real `＋`,
and the second is *the picker's own first row*, which the first invocation had just
focused. The surviving closure was the second one, whose "opener" is removed on unmount,
so `isConnected` was false and the restore stood down.

The capture now rejects any candidate inside the panel and falls back to the previously
captured opener. A jsdom case reproduces it — and **only** after the harness was changed
to MOUNT and UNMOUNT the picker as both real callers do: React double-invokes on MOUNT,
not on a dependency change, so a harness that merely toggled `open` was measured GREEN
against the exact pre-fix capture.

### The decision this took, and its stated consequence

`disabled={refused}` is **gone**; refused rows carry `aria-disabled` only. The component's
own rule required it — *"an option that vanishes teaches nothing, and an option greyed out
mutely is worse"* — because a natively disabled button cannot take focus, so the author
who most needs the reason read aloud could never reach it. WAI-ARIA APG says a disabled
menu item SHOULD stay focusable for exactly this reason.

⚠ **The consequence: `onClick`'s `if (refused) return` is now the ONLY thing preventing a
refused choice, for mouse and keyboard alike.** Before, the browser swallowed the click and
React's `shouldPreventMouseEvent` filtered `onClick` on top of that — the shipped test that
"proved" the guard used a click that could not even dispatch. Three cases now drive it with
positive controls proving the event genuinely reaches the row, and it is confirmed live
above against `Enter`, `Space` and a real pointer.

### jsdom's honest limit, stated because it was measured

Four wrong fixes were planted, run, and reverted. Three were caught behaviourally:

| plant | caught by |
|---|---|
| **A** keep the native `disabled` | 5 cases across two files, including the arrow-walk reachability case — and both positive-control cases, which is the vacuity trap demonstrated live |
| **C** move focus without updating `activeIndex` | the three tabindex-ARRAY assertions only; every `activeElement` assertion stayed green |
| **D** `preventDefault()` unconditionally | 7 cases, including the do-not-regress Escape-with-focus-inside case |
| **B** swap the panel scroll for `row.scrollIntoView({ block: "nearest" })` | **every behavioural case stayed GREEN.** Only the `?raw` SOURCE fence caught it — a text grep, not a measurement. |

Plant B is the whole reason the driven session exists, and it is stated rather than passed
over: jsdom applies no CSS and computes no layout, so no unit test in this estate can
observe the ancestor-scrolling cheat. The ancestor fence in reading 4 is what actually
proves it.

### Gates

- `npx tsc --noEmit -p tsconfig.app.json` — **33 errors, unchanged** from the pre-change
  measurement taken before any file was edited. (It went to 35 mid-work: importing React's
  `KeyboardEvent` type under its own name SHADOWED the global DOM one the shipped `window`
  Escape listener is typed against. Aliased, and back to 33.)
- `node scripts/vitest-count-gate.cjs` — exit 0, **zero `[count-decrease]`**, 48/48 files.
  Two pins EXTENDED, never lowered: `StepTypePicker.test.tsx` 52 → 68 and
  `editAffordance.test.ts` 31 → 63, both read from the script's own `actual` column across
  two agreeing runs. Pinned total 2664 → **2712**, re-derived from the script's own printed
  `total` after the edit rather than by addition.
- `eslint src/components/workflows/` — **5 errors, unchanged** (all pre-existing). It went
  to 7 and then 6 mid-work — `react-hooks/set-state-in-effect`,
  `jsx-a11y/interactive-supports-focus` and `react-hooks/refs` were each mine, each real,
  and each fixed rather than suppressed.
- **Two `toBeDisabled()` assertions REWRITTEN in place, never deleted** — one in
  `StepTypePicker.test.tsx` and one in `WorkflowCanvas.editing.test.tsx`. Both sit inside
  existing `it()` blocks and change no count; `jest-dom`'s matcher does not consult
  `aria-disabled`, which is why they went red and had to be re-stated rather than passing
  by accident.
- Six suites green: **289/289** (`StepTypePicker`, `WorkflowCanvas`, `.editing`,
  `.composition`, `FlowEdge`, `editAffordance`).

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
