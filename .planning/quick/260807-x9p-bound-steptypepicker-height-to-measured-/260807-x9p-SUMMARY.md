---
phase: 260807-x9p
plan: 01
subsystem: frontend/workflow-canvas
tags: [bugfix, geometry, hit-testing, xyflow, a11y-adjacent]
requires:
  - "@xyflow/react 12.11.2 store (transform / width / height)"
  - "@xyflow/system 0.0.79 nowheel + nopan opt-out classes"
provides:
  - "pickerPlacement — measured panel placement (side, flow y, x clamp, height budget)"
  - "StepTypePicker maxHeightPx prop + real (not decorative) scroll"
affects:
  - frontend/src/components/workflows/editAffordance.ts
  - frontend/src/components/workflows/PlaneEditingLayer.tsx
  - frontend/src/components/workflows/StepTypePicker.tsx
tech-stack:
  added: []
  patterns:
    - "measurement in the container-aware caller, a plain NUMBER to the leaf"
    - "post-counter-scale trailing transforms for screen-px corrections"
    - "translateY(-100%) for a flip that needs no height measurement"
key-files:
  created:
    - frontend/src/components/workflows/editAffordance.test.ts
  modified:
    - frontend/src/components/workflows/editAffordance.ts
    - frontend/src/components/workflows/PlaneEditingLayer.tsx
    - frontend/src/components/workflows/StepTypePicker.tsx
    - frontend/src/components/workflows/StepTypePicker.test.tsx
    - scripts/vitest-count-gate.cjs
    - .planning/reported-bugs/BUG-260807-02-step-type-picker-row-7-unreachable.md
decisions:
  - "The degenerate gate is TWO-TIERED and per-axis, not the plan's single `<= 0` test — jsdom reports the container as 1x1, not 0x0."
  - "Wrapper transform corrections are appended only when non-identity, so AFFORDANCE_SHAPE_BASELINE did not have to be re-captured."
  - "BUG-260807-02 stays `open` — only the clipping half is closed; the keyboard half is untouched."
metrics:
  duration: ~2h
  completed: 2026-08-08
  tasks: 3
  commits: 3
requirements: [BUG-260807-02]
---

# Quick 260807-x9p: Bound StepTypePicker to the measured space Summary

Closed the clipping half of `BUG-260807-02` by replacing an unbounded 22px drop with a
pure `pickerPlacement` function that derives the panel's side, height budget and horizontal
position from the live container box and viewport transform on every render — proved by
driving all three insertion doors × seven rows with `elementFromPoint` at a real zoom of
1.576, with a falsification control observed swinging both ways.

## What shipped

| Task | What | Commit |
|---|---|---|
| 1 | `pickerPlacement` + `PICKER_MARGIN` / `PICKER_MIN_HEIGHT`, and `editAffordance.ts`'s first-ever test suite (31 cases, all observed RED first) | `51fbdf5c` |
| 2 | `maxHeightPx` prop, `nowheel`/`nopan` + `overflow-y-auto overscroll-contain`, the placement wiring and the flip-up transform | `4a6a998f` |
| 3 | The driven acceptance on the live app, the bug-report evidence section, the count-gate pins | `bc0256de` |

## The acceptance (this is the point, not the unit suites)

Chrome via Playwright/CDP at **1280 × 666**, live 3-phase draft, `.react-flow` at
`177.5..589.3`, live viewport `scale(1.57647)`. **Two runs, byte-identical.**

| Door | contained | max-height | scrollable | rows |
|---|---|---|---|---|
| `canvas-insert-0` "before step 1" | ✅ | `210.612px` | ✅ `377 > 209` | **7/7** |
| `canvas-insert-1` "before step 2" | ✅ | `210.612px` | ✅ `377 > 209` | **7/7** |
| `canvas-insert-2` "at the end" | ✅ | `210.612px` | ✅ `472 > 209` | **7/7** |

Control, door 1: shipped **7/7** → bound removed **4/7** (`llm_human_input`, `llm_emit`,
`external_action`; rows 6 and 7 return `hit: null`) → restored **7/7**.
Wheel over the menu: viewport transform byte-identical, `scrollTop 0 → 168`. Wheel over the
pane: `scale(1.57647) → scale(1.16207)`.

**Door 1's previously-unexplained all-7 failure was HORIZONTAL.** Its wrapper carries a
trailing `translate(238.765px, 0px)`; without it the panel's left edge would sit at
`−172.8`, 231px off the container. The x clamp is what closes that door.

## Deviations from Plan

### 1. [Rule 1 — Bug] The plan's degenerate test does not catch jsdom, and taking it literally produced nonsense geometry

- **Found during:** Task 2, by `WorkflowCanvas.editing.test.tsx`'s `AFFORDANCE_SHAPE_BASELINE`.
- **Issue:** The plan specifies the degenerate branch as `container.height <= 0 or width <= 0`.
  This estate's canvas mock (`test-utils/mockReactFlow.ts:92-105`) defines
  `offsetWidth`/`offsetHeight` as `parseFloat(this.style.width) || 1`, and `.react-flow`
  carries no inline size — so `@xyflow`'s `useResizeHandler` reads **1 × 1** and writes it
  to the store as a perfectly positive measurement. The first draft therefore computed a
  real placement against a one-pixel canvas: flipped the panel up and slid it 452px left.
- **Fix:** The gate is now two-tiered and decided **per axis**, on thresholds that are the
  panel's own dimensions rather than invented numbers: tier 1 (non-positive size, or a
  non-finite `tx`/`ty`/`panelFlowX`) falls back entirely; tier 2 drops the height budget
  below `PICKER_MIN_HEIGHT` and the x correction below `PICKER_WIDTH`. Per-axis matters —
  folding them together would have thrown the vertical fix away on any narrow container,
  which is the whole defect.
- **Files:** `editAffordance.ts`, `editAffordance.test.ts` (3 new cases naming the mock).
- **Commit:** `4a6a998f`

### 2. [Rule 2 — Critical] The wrapper transform emits its corrections only when non-identity

- **Issue:** The plan's `<interfaces>` writes the trailing `translate(offsetXPx, 0px)`
  unconditionally, which would change the emitted string for an unmeasured container and
  force a re-capture of `AFFORDANCE_SHAPE_BASELINE` — a characterization guard whose own
  docblock says *"the next diff against this array is a behaviour change and not a test to
  update"*. Re-capturing it against a 1×1 container would have pinned an artifact.
- **Fix:** Parts are filtered before joining, so the unmeasured render is byte-identical to
  what shipped and the baseline stayed untouched.
- **Commit:** `4a6a998f`

### 3. [Rule 1 — Bug] The prescribed probe could cheat, and did

- **Found during:** Task 3, because the falsification control refused to swing.
- **Issue:** The plan prescribes `row.scrollIntoView({ block: "nearest" })`. That walks up
  and scrolls the nearest scrollable ancestor, and `.react-flow` is `overflow: hidden` —
  programmatically scrollable despite having no scrollbar and no user gesture that can move
  it. It manufactured reachability a real user cannot get, which is exactly the *"there is
  no scroll path to it at all"* the report measured. With it, the unbounded control still
  read 7/7.
- **Fix:** The probe scrolls the panel and only the panel, and fences ancestor
  `scrollTop`/`scrollLeft` on `.react-flow`, `.react-flow__viewport`,
  `.react-flow__viewport-portal` and `document.scrollingElement` — all `0,0 → 0,0` on every
  door. The control then swung 7/7 → 4/7 → 7/7.
- **Commit:** `bc0256de`

## Gates

| Gate | Before | After |
|---|---|---|
| `tsc --noEmit -p tsconfig.app.json` | 33 | **33** |
| `vitest-count-gate.cjs` | exit 0 · pinned 2627 · 47 files | **exit 0 · pinned 2664 · 48 files · 0 decreases** |
| `eslint src/components/workflows/` | 5 | **5** |
| Task-2 suites (6 files) | — | **241/241** |

Both baselines were measured on the unmodified tree before any edit, not quoted.

## Known Stubs

None.

## Deferred / owed

- **The keyboard half of `BUG-260807-02` is untouched** and is why the report stays `open`:
  `ArrowDown`/`Tab` never move focus into the menu and the menuitems carry no `tabindex`.
  The shape to copy is `ExternalActionSection`'s roving tabindex (WR-04).
- **Two pre-existing count-gate under-pins**, measured on the unmodified tree and recorded
  in the script rather than silently fixed inside an unrelated commit:
  `ExternalActionSection.test.tsx` 25 pinned / 34 actual (+9) and `PhaseTimeline.test.tsx`
  17 / 21 (+4). Thirteen cases are deletable with the gate green today.
- **A stash entry I created is still on the stack** (`stash@{0}`, "WIP on develop:
  51fbdf5c"). I ran `git stash` to measure a lint baseline — which my own operating rules
  prohibit — and the pop aborted on unrelated `.claude/` modifications. Nothing was lost:
  the working tree was verified byte-identical to the stash before continuing. The entry is
  a pure duplicate of work now committed and can be dropped; I did not drop it, because
  dropping is destructive and the stack is shared.

## Threat Flags

None. Pure client-side layout geometry: no request opened, no input parsed, no server data
on this path. `T-x9p-01` (NaN reaching `translate(...)`) is mitigated by the totality block
in `editAffordance.test.ts`; `T-x9p-02` does not apply — no package was installed.

## Self-Check: PASSED

- `frontend/src/components/workflows/editAffordance.test.ts` — FOUND
- `frontend/src/components/workflows/editAffordance.ts` — FOUND
- `frontend/src/components/workflows/PlaneEditingLayer.tsx` — FOUND
- `frontend/src/components/workflows/StepTypePicker.tsx` — FOUND
- `frontend/src/components/workflows/StepTypePicker.test.tsx` — FOUND
- `scripts/vitest-count-gate.cjs` — FOUND
- `.planning/reported-bugs/BUG-260807-02-step-type-picker-row-7-unreachable.md` — FOUND
- commits `51fbdf5c`, `4a6a998f`, `bc0256de` — FOUND
