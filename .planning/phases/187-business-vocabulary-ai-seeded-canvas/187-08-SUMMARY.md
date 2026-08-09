---
phase: 187-business-vocabulary-ai-seeded-canvas
plan: 08
subsystem: frontend/canvas-projection
tags: [vocab-01, d-187-05, d-185-09, canvas-01, pure-projection, g-5-capped, tdd]
requires:
  - "phaseVocabulary.NameContext / nodeTitle(phase, ctx?) — the 4-tier ladder landed by plan 187-04"
  - "canvasModel ToCanvasOptions.kbTools + NO_KB_TOOLS — the frozen module-scope safe-default idiom (D-185-09)"
  - "the toCanvas PURE contract (D-183-12) and the CANVAS-01 totality contract"
  - "the shipped ProblemsTray, already mounted by WorkflowCanvas and already fed `phases`"
provides:
  - "ToCanvasOptions.nameContext — the OPTIONAL injected id→name lookup, byte-identical when omitted"
  - "canvasModel NO_NAME_CONTEXT — the frozen module-scope default every omitted call shares"
  - "buildPhaseData(phase, kbTools, nameContext) — the thread, reaching nodeTitle ONLY"
  - "WorkflowCanvasProps.nameContext — the single production pass-through, 7 insertions / 2 deletions"
  - "ProblemsTrayProps.nameContext — the tray half of the card↔row naming agreement (RESEARCH Open Q6)"
affects:
  - "187-15 — still owes the definition-level `assets[] where kind === 'template'` → ctx.templateFilename resolution at the PAGE; this plan threads the context, it does not build it"
  - "any caller of WorkflowCanvas that wants derived faces — one prop, no other change"
  - "187-09 / 187-10 / 187-12 — the canvas now reaches the derived tier; the reveal work lands on a specific title, not a generic one"
tech-stack:
  added: []
  patterns:
    - "injected optional lookup with a frozen module-scope default (the kbTools precedent, applied twice)"
    - "field-by-field assertion instead of a snapshot when the claim is WHICH field moved"
    - "source guards for a property that is not observable from outside the module"
    - "a diff cap as an acceptance criterion on a G-5 hot file — measured, not asserted"
key-files:
  created: []
  modified:
    - frontend/src/components/workflows/canvasModel.ts
    - frontend/src/components/workflows/canvasModel.test.ts
    - frontend/src/components/workflows/canvasModel.purity.test.ts
    - frontend/src/components/workflows/WorkflowCanvas.tsx
    - frontend/src/components/workflows/ProblemsTray.tsx
    - frontend/src/components/workflows/ProblemsTray.test.tsx
decisions:
  - "The tray relies on `nodeTitle`'s OWN default parameter rather than re-declaring a frozen empty context — `phaseVocabulary.NO_NAME_CONTEXT` is module-private, and the default parameter IS that same frozen reference. A fourth copy would have bought nothing and cost a line inside the diff cap."
  - "The `ariaLabel` is the one deliberate exception to 'only the title moved' — it is derived FROM the title, so a face that moves and a label that does not would BE the screen-reader disagreement this plan closes. Pinned by its own test."
  - "The 'same frozen reference' property is pinned by SOURCE guards with controls, because nothing returns the default and it is not observable from outside the module."
  - "The card↔row agreement test compares the tray against the CANVAS PROJECTION (`toCanvas(...).nodes[0].data.title`), not only against `nodeTitle` — two surfaces compared, not two calls of one function."
metrics:
  duration: ~40 min
  tasks: 2
  commits: 3
  completed: 2026-08-02
---

# Phase 187 Plan 08: Threading the name context to the canvas — Summary

`toCanvas` gained an optional injected name-lookup context and the one production call site
now passes it — to the projection AND to the problems tray it already mounts, so a card and
the row pointing at it can never name one step two different ways.

## What Was Built

**Task 1 — the projection option (`a4cd1101` RED → `73d78491` GREEN).** `ToCanvasOptions`
gained `nameContext?: NameContext`, resolved exactly as `kbTools` is
(`options.nameContext ?? NO_NAME_CONTEXT`) against a new frozen module-scope
`const NO_NAME_CONTEXT: NameContext = Object.freeze({})` sitting beside `NO_KB_TOOLS` and
carrying the same reasoning in its comment: an omitted option must hand the SAME reference on
every call, because the projection has to be deterministic to the byte and a fresh `{}` per
call is a needless identity change the snapshot gate would see.

`buildPhaseData` widened to a third parameter and hands it to **`nodeTitle` only**.
`technicalTitle(phase)` keeps its single argument, deliberately: the reveal-ON form is
`label · slug`, and putting a derived face behind the ⌥ toggle would hide the one genuinely
technical token the toggle exists to show.

The `ToCanvasOptions` docblock was extended in the register of the shipped `kbTools`
paragraph — the maps are passed IN so the module stays PURE (it fetches nothing, hardcodes
nothing), the option is OPTIONAL and defaults to EMPTY, and that default is the safe
direction stated out loud: an absent map makes the derived tier **miss** and renders the
generic type sentence, never a fabricated or id-shaped face.

**Task 2 — the pass-through and the tray (`9a48e1cd`).** `WorkflowCanvas.tsx` received the
three `kbTools`-shaped lines (prop + 2-line JSDoc, destructure, the `useMemo` and its
dependency array) plus **one** `nameContext={nameContext}` prop on the `ProblemsTray` it
already mounts at `:1383`. `ProblemsTray.tsx` gained the optional prop and passes it to the
single row-name `nodeTitle` call; the reveal-ON `technicalTitle(phase)` line at `:252` was
left exactly as shipped.

### G-5, measured rather than promised

`WorkflowCanvas.tsx` is a G-5-firing hot file (1574 L, 9 plans across 3 phases) whose
extraction is due in **Phase 188**, and `187-RESEARCH.md` recommended not touching it at all.
It could not be avoided: `toCanvas` has exactly one production call site and it is here, so
Req 1's canvas face is unreachable without a pass-through. The diff was therefore capped as
an acceptance criterion and the caps were **hit exactly, not approximately**:

| File | Cap | Measured |
|---|---|---|
| `WorkflowCanvas.tsx` | ≤ 7 insertions / ≤ 2 deletions | **7 / 2** |
| `ProblemsTray.tsx` | ≤ 8 insertions / ≤ 1 deletion | **8 / 1** |

`git diff -U0 -- WorkflowCanvas.tsx | grep -cE '^\+.*(function |useState|useEffect|useCallback)'`
returns **0** — no new logic, state, effect or component. `PhaseNodeCard.tsx` and every file
under `__snapshots__/` are untouched (`git status --porcelain` empty for both), so neither
card invariant — a third badge is a typecheck error, no focusable control inside the card —
was approached.

The 2-line JSDoc on the canvas prop is the shape the cap forced, and it is the right shape:
a first draft ran 4 lines of prose and was cut to the two facts a reader needs (who owns the
maps, and what an absent one does).

## Verification

| Gate | Bar | Result |
|---|---|---|
| 8-file vocabulary/canvas set (Set A) | ≥ 863 passed, 0 failed | **974 passed, 0 failed** |
| 5-file consumer set (Set B) | ≥ 381 passed, 0 failed | **384 passed, 0 failed** |
| `canvasModel.test.ts` | > HEAD's 41 | **49** |
| `canvasModel.purity.test.ts` | > HEAD's 79 | **143** |
| `canvasModel.fixtures.test.ts` | unchanged 100 | **100** |
| `canvasModel.roundtrip.test.ts` | unchanged 517 | **517** |
| `ProblemsTray.test.tsx` | > HEAD's 23 | **26** |
| `WorkflowCanvas.test.tsx` / `.composition` / `.editing` | unchanged | **35 / 19 / 57**, 0 failed |
| `git status --porcelain .../__snapshots__` | empty | **empty** |
| `grep -n "NO_NAME_CONTEXT" canvasModel.ts` | `Object.freeze({})` at module scope | **`:352`** |
| `grep -cE "@/lib/api\|fetch\(" canvasModel.ts` | 0 | **0** |
| `grep -n "technicalTitle(phase" canvasModel.ts` | one argument | **`:296` `technicalTitle(phase)`** |
| `grep -c "technicalTitle(phase)" ProblemsTray.tsx` | 1 | **1** |
| `grep -cE "…fetch\|useState\|useEffect" ProblemsTray.tsx` | unchanged from HEAD | **3 → 3** |
| `npx tsc -b` | see Deviations | **33 errors, 0 in `components/workflows`, identical before and after** |

**RED was observed for both halves, not inferred.** Task 1's tests were committed failing
(`a4cd1101`: 6 failed / 186 passed) — the three behavioural cases that need the option and
the three source guards. Task 2 is not a TDD task, so its control was proved the other way:
the `nodeTitle(phase, nameContext)` call in the tray was momentarily reverted to
`nodeTitle(phase)` and the new card↔row agreement test went **red** (1 failed / 25 passed)
before the thread was restored. A test that has never failed is a comment.

## Deviations from Plan

### 1. [Rule 3 — blocking] The tray relies on `nodeTitle`'s own default, not a re-declared one

- **Found during:** Task 2.
- **Plan text:** *"Destructure it with the `NO_NAME_CONTEXT` default."*
- **Issue:** plan 187-04 kept `NO_NAME_CONTEXT` **module-private** in `phaseVocabulary.ts` —
  it is not exported. The three ways to honour the sentence literally were: export it (an
  edit to a file outside `files_modified`, for a leaf component's default), import
  `canvasModel`'s copy into a component that has no other reason to know the projection
  exists, or declare a **fourth** frozen empty object.
- **Resolution:** none of them. `ProblemsTray` destructures `nameContext` with no default and
  passes it straight through; `undefined` triggers `nodeTitle`'s own default parameter, which
  **is** `NO_NAME_CONTEXT` — the identical frozen reference the plan asked for, reached
  without a new copy or a new export. The prop's JSDoc says so in one clause so the next
  reader does not have to re-derive it.
- **Effect on the acceptance criteria:** none. The "omitting the prop renders what HEAD
  rendered" test asserts it directly.
- **Commit:** `9a48e1cd`.

### 2. [Rule 1 — inherited claim, already logged] `npx tsc -b` does not exit 0

- Both tasks carry *"`npx tsc -b` exits 0"*. Measured again at this plan's HEAD: **exit 2, 33
  `error TS` lines, zero of them in `src/components/workflows/`**. Identical count before and
  after this plan's edits, so the delta is provably zero.
- Already logged by plan 187-04 as `D-ITEM-01` in the phase's `deferred-items.md`, with the
  correct reading of the criterion (*no NEW error, none in the touched files*). Nothing new is
  added there — this plan simply re-measured rather than inheriting 187-04's number.

### 3. [In scope, worth naming] Item 4 landed here rather than being deferred

The plan already argued this and it held up under execution: `ProblemsTray` is mounted
**inside `WorkflowCanvas.tsx`**, not by the page, so closing the tray half of RESEARCH Open Q6
cost **zero lines in `WorkflowBuilderPage.tsx`** and could not widen the D-187-14 page gate.
Its price was one prop line on an element that already exists, passing a prop the same task
already added. Leaving it out would have shipped a card reading *"Run the pricing policy
check"* beside a tray row reading *"Work out how to do it"* for the same step.

## Known Stubs

None in the code this plan touched. One **open item is handed forward, not stubbed**:
`ctx.templateFilename` is threaded end-to-end but nothing currently populates it, because
`derivedFaceOf` deliberately does not read `assets` (the template is definition-level) and
this plan does not hold a `WorkflowDefinition` — `WorkflowCanvas` receives `phases`, not the
definition. **187-15 owes that resolution at the page:** find the `assets[]` entry where
`kind === "template"` and pass its `filename` as `ctx.templateFilename` on the same prop this
plan added. The `llm_emit` gate is already inside `derivedFace`, so no caller can paint a
definition-level filename on every step. The purity suite exercises the member on all
fixtures so the path is covered before its producer exists.

## Threat Flags

None. No new network surface, auth path, file access or schema — this plan adds one optional
function parameter and two optional props.

Each of the plan's five register entries has a control that fires:

| Threat | Disposition |
|---|---|
| T-187-08-01 `toCanvas` purity | mitigated — the option is injected with a frozen default; the API-client / `fetch` / `useState` / `useEffect` greps return 0 and the snapshot is untouched |
| T-187-08-02 an id on the node face | mitigated — an unresolved id falls through, asserted as the type sentence AND as `JSON.stringify(projection)` not containing the id |
| T-187-08-03 `WorkflowCanvas.tsx` maintainability (G-5) | mitigated — 7/2 measured against a 7/2 cap, 0 new functions/state/effects; extraction stays Phase 188's |
| T-187-08-04 `PhaseNodeCard` invariants | mitigated — `git status --porcelain` on that file is empty |
| T-187-08-05 card ↔ tray disagreement | mitigated — both resolve through the same `nodeTitle` and the same object; the test compares the row against the canvas projection, and was observed RED with the thread removed |

## For the Next Plan

- **The prop is `nameContext` on `WorkflowCanvas`, and it feeds two surfaces.** Passing it
  once names the cards, the aria labels and the tray rows. There is nothing else to wire.
- **`ctx.templateFilename` has no producer yet** — see Known Stubs. That is 187-15's line.
- **Do not add a second `nodeTitle` call site inside `canvasModel`.** `buildPhaseData` is the
  one place every face value resolves, and a purity source guard now pins
  `nodeTitle(phase, nameContext)` / `technicalTitle(phase)` as the exact shapes.
- **`ariaLabelFor` derives from the resolved title**, so any future tier automatically reaches
  the screen-reader announcement. That is asserted, not incidental.
- **Do not gate acceptance on `tsc -b` exiting 0** — `deferred-items.md` D-ITEM-01.

## Self-Check: PASSED

- `frontend/src/components/workflows/canvasModel.ts` — FOUND (modified)
- `frontend/src/components/workflows/canvasModel.test.ts` — FOUND (modified)
- `frontend/src/components/workflows/canvasModel.purity.test.ts` — FOUND (modified)
- `frontend/src/components/workflows/WorkflowCanvas.tsx` — FOUND (modified)
- `frontend/src/components/workflows/ProblemsTray.tsx` — FOUND (modified)
- `frontend/src/components/workflows/ProblemsTray.test.tsx` — FOUND (modified)
- commits `a4cd1101`, `73d78491`, `9a48e1cd` — all FOUND in `git log`
