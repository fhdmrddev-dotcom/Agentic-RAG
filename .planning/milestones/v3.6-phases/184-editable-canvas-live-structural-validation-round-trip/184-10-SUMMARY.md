---
phase: 184-editable-canvas-live-structural-validation-round-trip
plan: 10
subsystem: workflows
tags: [canvas-editing, axis-split, keyboard-reorder, live-region, verdict-marks, controlled-flow, jsdom, wave-6]

# Dependency graph
requires:
  - phase: 184-02
    provides: "`resolveDrop` (the pure axis split) + `movePhase` / `renumber` — the ONE reorder op both gesture paths end in"
  - phase: 184-05
    provides: "`canvasModel.fromCanvas` — the sole canvas→definition serializer, which deliberately never renumbers"
  - phase: 184-07
    provides: "`canvasNudge.ts` — the browser-local `dy` home this canvas reads and writes THROUGH PROPS, never directly"
  - phase: 184-08
    provides: "`verdictModel.markFor`, `nodePresentation.VERDICT_MARK` / `VERDICT_DESTRUCTIVE_TOKEN`, and `PhaseNodeCard`'s rendered right-edge verdict slot"
  - phase: 184-01
    provides: "`scripts/vitest-count-gate.cjs` — the D-184-08 per-file count differential"
provides:
  - "`builderStore.commitCanvasNodes` — the canvas-originated order commit: `fromCanvas` in, `reorderPhase` out, four no-op bail-outs"
  - "`WorkflowCanvas`'s editing half: per-node drag, the D-184-10 axis split, the cosmetic `dy` merge, and the threaded verdict mark"
  - "D-184-09's keyboard path — `⌥←` / `⌥→` on the selected node, with a polite live-region position announcement"
  - "`ARIA_LABELS_EDITABLE` — the second node-description table, so the announced affordance is true in BOTH modes with NO pinned assertion edited"
  - "`WorkflowCanvas.editing.test.tsx` — 24 net-new assertions over the editing surface, `fireEvent`-only inside the plane"
affects: [184-11, 184-12, 184-13, 185, 186, 188]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A second constant TABLE rather than an edited one, when a shipped promise has to stay true in a new mode — the read-only table is byte-unchanged, so its pinned assertion still measures what it was written to measure"
    - "Reaching a component's outgoing prop by wrapping ONE export of a mocked module and re-rendering the real one, so every other assertion in the file still runs against a genuinely-rendered plane"
    - "A user-facing header promise treated as a docblock: '👁 View only · steps stay put' is swapped when the steps can move, because a lie in the UI is worse than a lie in a comment"
    - "Deriving the moved element by REMOVAL EQUALITY rather than by index arithmetic — the derivation and the op it feeds then agree by construction"

key-files:
  created:
    - frontend/src/components/workflows/WorkflowCanvas.editing.test.tsx
  modified:
    - frontend/src/components/workflows/builderStore.ts
    - frontend/src/components/workflows/builderStore.test.ts
    - frontend/src/components/workflows/WorkflowCanvas.tsx
    - frontend/src/components/workflows/PhaseNode.tsx

key-decisions:
  - "`ARIA_LABELS` was NOT changed. A SECOND table, `ARIA_LABELS_EDITABLE`, carries the alt-arrow promise, so the shipped WR-06 assertion stayed green and this plan edited ZERO pinned assertions — see the dedicated section below, which `<output>` requires"
  - "`editable` is OPTIONAL and defaults to `false`, not required as the plan wrote it — a required prop would have forced an edit to both the shipped page and the shipped 31-assertion suite to land a prop whose whole meaning is 'behave as before'"
  - "`onNudge` receives the RESULTING offset (previous + this drag's delta), not the raw delta — handing over the delta makes every second nudge discard the first and the card jump"
  - "The `👁 View only` header badge and the section's accessible name are swapped when editing; leaving them up would be the D-ITEM-183-02 trap in the one place a user actually reads"
  - "`WorkflowCanvas.test.tsx` was not touched at all — the read-only surface still exists, still has 31 assertions, and the new file absorbs none of them"

patterns-established:
  - "Falsify a component-level claim by breaking the ONE line it rests on: three probes (the alt requirement, the nudge merge, the axis-split branch) each turned exactly their own assertions red and nothing else"
  - "A duplicate-slug fixture must NOT be stored in render order, or a later bail-out masks the one under test and the assertion passes for the wrong reason"

requirements-completed: []  # CANVAS-02 is this plan's frontmatter requirement and it is NOT complete — nothing mounts the editing half yet. REQUIREMENTS.md deliberately untouched; the orchestrator marks all 5 at phase end.

# Metrics
duration: 40min
completed: 2026-07-27
---

# Phase 184 Plan 10: The Canvas Moves — Axis-Split Drag, Keyboard Reorder, Verdict Marks Summary

**One free drag now carries two meanings whose separation is structural rather than conditional — `resolveDrop` computes `reorderTo` from the x inputs ALONE, so the definition branch of `onNodeDragStop` is unreachable for a purely vertical drag and a nudge provably issues zero network calls and zero history entries; the same reorder op is reachable from `⌥←` / `⌥→` on the selected node with a spoken *"Step moved to position 3 of 5."*; and the server's verdict mark reaches the node face as threaded DATA. Both lying comments were corrected in the commit that falsified them, the user-facing "steps stay put" promise was swapped along with them, and `ARIA_LABELS` stayed byte-identical because a SECOND table — not an edited assertion — is what keeps the announced affordance true in both modes.**

## Performance

- **Duration:** ~40 min
- **Started:** 2026-07-27T07:32:00Z
- **Completed:** 2026-07-27T08:08:00Z
- **Tasks:** 3 (all `auto`, all committed atomically)
- **Files created:** 1 · **Files modified:** 4

## Task Commits

1. **Task 1: `commitCanvasNodes` — `fromCanvas` behind the one reorder op** — `68325bf4` (feat) — `builderStore.ts`, `builderStore.test.ts` (33 → 41)
2. **Task 2: the drag, the nudge and the verdict marks** — `da476e07` (feat) — `WorkflowCanvas.tsx`, `PhaseNode.tsx`
3. **Task 3: `⌥←` / `⌥→`, the live region and the editing proof suite** — `0be318eb` (feat) — `WorkflowCanvas.tsx`, `WorkflowCanvas.editing.test.tsx` (24, net-new)

No commit deletes a tracked file (`git diff --diff-filter=D --name-only 68325bf4~1 HEAD` is **empty**).

---

## `<output>` REQUIREMENT: did `ARIA_LABELS` change? **NO — and that was a decision, not luck.**

**`ARIA_LABELS` is byte-identical to its shipped form. No assertion in `WorkflowCanvas.test.tsx` was edited. `git status --porcelain` on that file returns 0 lines and it reports its pinned 31 on every gate run.**

The plan anticipated an edit here and pre-authorised one. The reason none was needed:

| | Read-only mode | Editing mode |
|---|---|---|
| Table | `ARIA_LABELS` — **unchanged** | `ARIA_LABELS_EDITABLE` — **new** |
| Sentence | *"Press enter or space to open this step's details."* | *"Press enter or space to open this step's details. Hold alt and press the left or right arrow key to move this step one position."* |
| Chosen by | `ariaLabelConfig={editable ? ARIA_LABELS_EDITABLE : ARIA_LABELS}` | |

Widening the single table would have announced a movement affordance on the read-only surface — the WR-06 defect in reverse — and would have turned the shipped assertion `expect(text).not.toMatch(/arrow keys/i)` red for a genuinely wrong reason. Omitting the binding entirely would have left a screen-reader user unable to reach the only structural affordance this canvas has, which is precisely the regression D-184-09 exists to prevent (183 shipped a real screen-reader pass; a drag-only reorder would have undone it). Two tables satisfies both, and the module docblock records why so nobody "simplifies" them back into one.

The new suite asserts both sides: the read-only description matches `/open this step's details/i` and NOT `/arrow key/i`, and the editable one matches `/alt/i` AND `/arrow key/i`.

---

## The other two comment-vs-behaviour traps, both fixed in the commit that falsified them

**1. `WorkflowCanvasProps.onSelectNode` (`:168`).** Its docblock denied, in capitals, that this surface could re-order or move a node. `da476e07` makes that false, so the same commit rewrites it to the narrower claim that is still true and still worth promising: reordering travels on `onCommitNodes` and the cosmetic offset on `onNudge`, never on `onSelectNode`. `grep -c 'NEVER reorders' WorkflowCanvas.tsx` → **0**.

**2. The file's own "THE READ-ONLY SHELL" framing.** The whole docblock opened by declaring that this component's job was to make read-only true. A ⚠ block now leads the file, states what 184-10 changed BEFORE anything else, and says explicitly that `editable` flips exactly one thing (per-node `draggable`, phase nodes only) while everything in the opt-out block stays off in both modes. Four further paragraphs were corrected rather than left: the view-copy paragraph (which now names `dy`, `draggable` and the verdict mark as the things merged into the copy), the scope-fence paragraph (which claimed no per-node verdict badge), the announced-affordance paragraph (see above) and the motion paragraph.

**3 — found, not planned: the same trap in the UI.** The header renders `👁 View only` and *"the plane pans · steps stay put"*. That is a promise to a person, and on an editable canvas it is false in the one place a user actually reads. Both the badge and the strapline are swapped when `editable` (`✎ Editing` · *"drag a step along the lane to reorder · or select one and press ⌥← / ⌥→"*), and the `<section>`'s accessible name moves with them. Recorded as Deviation 3 below.

---

## Falsifications — five probes, every one restored

An assertion that has only ever passed is not evidence. Every new claim in this plan was made to fail on purpose.

### Task 1 — the store

| Probe | Result | Restored |
|---|---|---|
| The "nothing moved" bail-out commented out | **1 failed** — *"a node array in the CURRENT order is a NO-OP"*, `expected [ Array(1) ] to have a length of +0` | 41/41 |
| The duplicate-slug bail-out commented out | **1 failed** — *"a source carrying DUPLICATE slugs is a no-op"* | 41/41 |

The duplicate-slug probe is the interesting one, and it produced a **finding that changed the test**. On the first attempt the probe went GREEN: the fixture stored its phases in render order, so `fromCanvas`'s fail-safe (`[...source]`) returned an array identical to the render order and the LATER "nothing moved" bail-out caught it. The assertion was passing for the wrong reason. The fixture was rewritten so the array order deliberately differs from the render order (`[other@2, dup@0, dup@1]`); the probe then turns it red, because without the bail-out `movePhase` picks the first `dup` and commits a reorder nobody performed. The comment in the test records this so it is not "simplified" back.

### Task 3 — the component

| Probe | Result | Restored |
|---|---|---|
| `if (!event.altKey) return` removed | **1 failed** — *"ALT IS REQUIRED — a bare ArrowRight moves nothing"*, `expected "vi.fn()" to not be called at all, but actually been called 1 times` | 24/24 |
| The nudge merge forced to `dy = 0` | **1 failed** — *"the rendered card carries the offset…"*, `expected 'translate(320px,0px)' to contain '48px'` | 24/24 |
| The axis-split branch made unconditional | **2 failed** — *"a PURELY VERTICAL drop nudges and does NOT touch the definition"* AND *"a drop SHORT of half a pitch is cosmetic only"* | 24/24 |

`grep -c "PROBE\|FALSIFICATION"` across both source files → **0** after each restore.

---

## Verification Results

| Gate | Required | Observed |
|---|---|---|
| `npx vitest run … builderStore.test.ts` | 0 failures | **41 passed** (33 → 41, +8) |
| `npx vitest run … WorkflowCanvas.test.tsx` | 31, **unmodified** | **31 passed, file untouched** |
| `npx vitest run … WorkflowCanvas.editing.test.tsx` | 0 failures **and exit 0** | **24 passed, exit code 0** |
| The full plan set (`src/components/workflows` + both Builder suites + `revertByteIdentical`) | 0 failures, exit 0 | **26 files / 933 tests passed, 0 failed, exit 0** |
| `node scripts/vitest-count-gate.cjs` | exit 0, no per-file decrease | **exit 0 on all three commits**; 909 → 909 → 933, **0 failing**, 16/16 pinned present, **every pinned delta 0** |
| `npx tsc -b \| grep -c "error TS"` | ≤ 33 (the `develop` differential) | **33** after every task |
| `npx vite build` | exit 0 | **exit 0**, built in 4.04 s |
| `git diff --exit-code -- 'frontend/src/**/__snapshots__/*'` | exit 0 | **exit 0 — byte-unchanged** (the snapshot is over `toCanvas`, and `canvasModel.ts` is untouched) |
| `revertByteIdentical.test.tsx` | green at its pinned 7 | **7/7** |
| `npx eslint` on all 5 files | clean | **zero problems** |
| `grep -cE 'workflows/validate\|grounding_mode\|localStorage\|MiniMap\|hideAttribution' WorkflowCanvas.tsx` | 0 | **0** |
| `grep -c 'showInteractive={false}' WorkflowCanvas.tsx` | ≥ 1 | **1** |
| The five kept opt-outs present | 5 | **5** — and additionally asserted at RUNTIME while `editable` is true |
| `grep -n 'change.type !== "position"' WorkflowCanvas.tsx` | ≥ 1, no other change type applied | **1**; `dimensions` / `select` / `remove` / `add` / `replace` are all dropped, with the reason written at the handler |
| `grep -c 'NEVER reorders' WorkflowCanvas.tsx` | 0 | **0** |
| `grep -c 'user-event' WorkflowCanvas.editing.test.tsx` | 0 | **0** (see Deviation 4) |
| `grep -c 'mockReactFlow' WorkflowCanvas.editing.test.tsx` | ≥ 1 | **2**; `src/setupTests.ts` **unchanged** |
| No focusable control inside any node | 0 | **0**, re-asserted with a verdict mark rendered on every node |
| `git diff --name-only -- backend/ \| wc -l` | 0 | **0** |
| `git diff --name-only -- supabase/migrations \| wc -l` | 0 | **0** — slot 114 stays RESERVED |
| `frontend/package.json` / lockfile in any commit | absent | **absent** |
| `.planning/REQUIREMENTS.md` | untouched, all 5 phase REQ-IDs Pending | **untouched** |
| Assertion edits in pre-existing test files | ideally 0 | **0** — `git diff --numstat` over both test files: **506 + 126 insertions, 0 deletions** |

### The acceptance criteria that needed reading rather than grepping

- **`⌥→` on a selected middle step** calls `onCommitNodes` exactly once with `["split", "deep_dive", "fanout", "confirm", "summarize"]` and the live region reads exactly `"Step moved to position 3 of 5."` (`toBe`, so a stray full stop fails). `⌥←` from `confirm` yields the mirror order and the same sentence — asserted separately, so the direction is not assumed from one case.
- **Four keyboard refusals**, each asserting `onCommitNodes` was not called: position 0 with `⌥←`, the last position with `⌥→`, a bare `ArrowRight`, and an `⌥→` whose `event.target` is an `<input>`. The two boundary cases additionally assert the announcer is still empty — a live region that repeats itself on a no-op teaches a person to ignore it.
- **Two more refusals the plan did not ask for**, because the gated-listener claim is otherwise untested: `⌥→` with nothing selected, and `⌥→` while read-only. Both commit nothing.
- **Auto-repeat**: one press plus two `repeat: true` presses is exactly **one** call.
- **The axis split at the component level**: a vertical drop calls `onNudge("fanout", 64)` and NOT `onCommitNodes`; a horizontal drop past half a pitch calls `onCommitNodes` with the expected order and NOT `onNudge` (a flat drop has no vertical component to write). A third case pins the boundary itself — 159 px of a 320 px pitch is cosmetic only.
- **The nudge accumulates**: with `nudges: { fanout: 40 }` a drag from `y: 40` to `y: 90` reports `90`, not `50`.
- **The colour budget**: three `incomplete` marks emit the destructive token **0** times across the whole rendered canvas; the positive control (one `error`) puts it back. The token is `nodePresentation.VERDICT_DESTRUCTIVE_TOKEN`, imported rather than re-spelled.
- **The model is not mutated**: `expect(evalCoverage).toStrictEqual(structuredClone(evalCoverage) taken before render)` after a nudged render, plus a walk over every node object handed to the library asserting no `dy` / `nudge` / `offset` key exists in its `data`.
- **`fromCanvas` still does not renumber**: `canvasModel.ts` is untouched by this plan (`git status --porcelain` → 0 lines) and `canvasModel.purity.test.ts`'s source guard over `fromCanvas`'s comment-stripped slice reports its 79 green on every gate run. The renumber happens in the store, through `definitionOps`.

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `editable` is OPTIONAL, not the required prop the plan specifies**

- **Found during:** Task 2
- **Issue:** the plan writes `editable: boolean`. Required, it is a typecheck error at every existing call site — `WorkflowBuilderPage.tsx:540` and the shipped suite's `renderCanvas` helper — pushing the `tsc` differential above the 33 baseline. Landing it would have forced an edit to a page this plan's `files_modified` does not list AND to the 31-assertion suite the same plan's acceptance criteria require to be untouched. The two instructions are not simultaneously satisfiable.
- **Fix:** `editable?: boolean` with a `= false` default in the destructure. Every behavioural requirement is unchanged — `editable === false` is still the pre-plan render, and the page still opts in explicitly when 184-12/13 wire it — while the shipped callers compile and render exactly as before. The prop's own docblock records why it is optional so nobody "tightens" it later without reading this.
- **Files modified:** `WorkflowCanvas.tsx`
- **Verification:** `tsc` holds at 33; `WorkflowCanvas.test.tsx` 31/31 and `WorkflowBuilderPage.canvas.test.tsx` 22/22 pass **unmodified**
- **Committed in:** `da476e07`

---

**2. [Rule 1 - Bug] `onNudge` hands over the RESULTING offset, not this drag's delta**

- **Found during:** Task 2
- **Issue:** the plan says *"call `onNudge(slug, dy)` with the y-component verbatim"*. `resolveDrop`'s `dy` is `dropped.y - origin.y` — a DELTA — while `canvasNudge.writeNudge` stores an ABSOLUTE offset and the view merges that absolute value into the node's y. Passing the delta through makes the second nudge of any card discard the first: a card already 40 px down, dragged 50 px further, would be stored at 50 and jump 40 px back up on the next render. The bug is invisible on the first nudge of a fresh session, which is exactly when a manual UAT would look at it.
- **Fix:** `onNudge(node.id, (nudges?.[node.id] ?? 0) + dy)`. The canvas already holds the current offset as a prop, so composing it here keeps the page's handler a plain write instead of an accumulation the page has to get right; the prop's docblock states the contract. The axis split is untouched — `dy` is still read from `resolveDrop` and still computed from the y inputs alone.
- **Files modified:** `WorkflowCanvas.tsx`
- **Verification:** *"the RESULTING offset is handed over, not this drag's delta (a nudge accumulates)"* — `nudges: { fanout: 40 }`, drag 40 → 90, asserts `90`
- **Committed in:** `da476e07`

---

**3. [Rule 2 - Missing Critical] The header's read-only promise is swapped when the canvas can be edited**

- **Found during:** Task 2
- **Issue:** the plan enumerates two comment-vs-behaviour traps. There is a third, and it is the worst of them because it is on screen: the header renders `👁 View only` and *"the plane pans · steps stay put"*, and the `<section>` is named *"Workflow canvas (read-only)"*. On an editable canvas all three are false, and unlike a docblock a user reads them. D-ITEM-183-02's rule is about promises, not about comments specifically.
- **Fix:** both header strings and the section's accessible name are chosen off `editable`. The editing strapline names BOTH gesture paths (*"drag a step along the lane to reorder · or select one and press ⌥← / ⌥→"*), which is also the only place the keyboard binding is discoverable without a screen reader. The read-only vocabulary is byte-unchanged and is still the shipped `👁 View only` wording, never invented a second time.
- **Files modified:** `WorkflowCanvas.tsx`
- **Verification:** the editing suite asserts `/view only/i` is still on screen in read-only mode; nothing pinned the header copy, so no assertion moved
- **Committed in:** `da476e07`

---

**4. [Rule 1 - Bug] Two acceptance greps were tripped by the prose that explains them (the self-match trap, instances 6 and 7)**

- **Found during:** Tasks 2 and 3
- **Issue:** twice more, an acceptance criterion of the form *"grep for token X and expect 0"* was failed by the very paragraph documenting the rule. (a) The rewritten `onSelectNode` docblock quoted the superseded wording verbatim, so `grep -c 'NEVER reorders'` returned **1** on a file that had correctly removed the claim. (b) The editing suite's driver-rule docblock named the forbidden test driver by its package identifier, so `grep -c 'user-event'` returned **1** on a file that uses `fireEvent` exclusively.
- **Fix:** the same fix both times, and the one this phase has now converged on — describe the CONCEPT in prose, leave the literal where the grep does not look, and say in-line that the omission is deliberate so a reader does not think the paragraph is being coy. Both greps now return **0** and both paragraphs still teach the rule.
- **Files modified:** `WorkflowCanvas.tsx`, `WorkflowCanvas.editing.test.tsx`
- **Committed in:** `da476e07`, `0be318eb`

---

**5. [Rule 3 - Blocking] The drag handlers are typed with the library's own `OnNodeDrag`, not React's `MouseEvent`**

- **Found during:** Task 2
- **Issue:** typing the handlers as `(event: React.MouseEvent, node: CanvasNode) => void` — the obvious reading of the library's docs — fails to satisfy `OnNodeDrag<CanvasNode>`: the library passes a **DOM** `MouseEvent | TouchEvent` (it has a touch drag path), and React's synthetic `MouseEvent` is not assignable from it. Two `TS2322`s, differential 33 → 35.
- **Fix:** `useCallback<OnNodeDrag<CanvasNode>>((_event, node) => …)`, which takes the signature from the library rather than restating it. This also documents, at the type level, that a drag can arrive from touch.
- **Files modified:** `WorkflowCanvas.tsx`
- **Verification:** `tsc` back to **33**
- **Committed in:** `da476e07`

---

**6. [Rule 2 - Missing Critical] The duplicate-slug test needed a fixture that is NOT stored in render order**

- **Found during:** Task 1, running the falsification
- **Issue:** described in full under Falsifications. The first fixture made the assertion pass through the wrong bail-out; the probe proved it. This is the same class as 184-07's Deviation 2 (a "no slug rendered" assertion that passed because the slug was a substring of a sentence): a negative assertion satisfied by an unrelated code path.
- **Fix:** the fixture's array order deliberately differs from its render order, and the test comment says why and what the probe showed.
- **Files modified:** `builderStore.test.ts`
- **Committed in:** `68325bf4`

---

**7. [Rule 2 - Missing Critical] `requirements.mark-complete` was NOT run**

- **Found during:** post-plan state updates
- **Issue:** this plan's frontmatter names `requirements: [CANVAS-02]`, and the verb flips it to Complete off the frontmatter alone. CANVAS-02 is *"a user can add, move, connect and delete phase-nodes…"*. **Nothing mounts the editing half** — `WorkflowBuilderPage.tsx` still renders the canvas with no `editable`, no `marks`, no `nudges` and no `onCommitNodes`, so no user can observe any of this yet. 184-12 and 184-13 do the wiring.
- **Fix:** the verb was not invoked. `.planning/REQUIREMENTS.md` is untouched; all five phase REQ-IDs (`VALID-02`, `VALID-03`, `CANVAS-02`, `CANVAS-03`, `CANVAS-04`) remain **Pending**. The orchestrator marks them at phase end. (Consistent with 184-02 through 184-09.)
- **Files modified:** none

---

**Total deviations:** 7 (2 bugs, 3 missing-critical, 2 blocking)
**Impact on plan:** none expands scope. The file set is FIVE files — one fewer than `files_modified` declares, because `WorkflowCanvas.test.tsx` turned out not to need touching at all. Deviations 1 and 5 are the plan's intent made to typecheck; 2 is a real defect the plan's literal wording would have shipped; 3, 4 and 6 are the plan's own anti-drift discipline applied to places the plan did not enumerate; 7 prevents a false completion claim in a planning artifact.

---

## Design decisions worth carrying forward

- **A second table beats an edited assertion.** When a shipped promise has to stay true in a new mode, adding a mode-specific constant leaves the old one — and its pinned guard — measuring exactly what it was written to measure. This is now the cheapest way out of the "the plan pre-authorised an assertion edit" situation, and it should be the first thing tried.
- **The axis split is enforced by what is NOT passed.** `onNodeDragStop` enters the definition branch only when `resolveDrop` hands back a non-null `reorderTo`, and `resolveDrop` computes that from the x inputs alone. There is no vertical-drag condition to get wrong, because there is no vertical-drag condition.
- **`nodesWithMove` is the single array-building rule.** The pointer path and the keyboard path both call it, and it splices out then inserts, in that order — the same shape `definitionOps.movePhase` uses — so the index the canvas means and the index the op applies cannot drift apart.
- **The moved element is derived by removal equality, not by arithmetic.** `commitCanvasNodes` finds the slug whose removal makes the two orders identical, which is by definition the slug `movePhase` will splice out. Any single move is explained correctly, in either direction, with no off-by-one to reason about.
- **`onNodesChange` is narrow on purpose.** Applying `remove` or `add` there would open a second, silent editing path beside the one this phase is chartered to build. The handler drops them and says so.
- **Mock ONE export, render the real component.** Wrapping `ReactFlow` to capture its props and then rendering the genuine one keeps every other assertion in the file honest — the marks, the nudge, the classes and the descriptions are all measured against a really-rendered plane.
- **The cosmetic offset is a prop in both directions.** The canvas never touches browser storage; `canvasNudge.ts` keeps its monopoly, and the canvas's own source fence stays trivially true.

## Known Stubs

**None.** Everything this plan adds is a complete implementation of its contract. The editing half is **unmounted**, which is different from stubbed: `WorkflowBuilderPage.tsx` is untouched by this plan, and 184-12 / 184-13 wire `editable`, `marks`, `nudges`, `onNudge` and `onCommitNodes`. That is the plan's own stated shape (*"the ＋ and ✕ affordances land in 184-12 — this plan moves what exists"*), not an omission.

## Threat Model Disposition

| Threat ID | Disposition | Status |
|---|---|---|
| T-184-10-01 (tampering — a cosmetic gesture silently changing what runs) | mitigate | **CLOSED.** Structural: `resolveDrop` returns `reorderTo: null` for a purely vertical drop, so the definition branch is never entered. Proven twice — as a pure-function sweep in 184-02, and here at the component level with the vertical case, the near-miss case (159 px of a 320 px pitch) and their positive control, the whole set FALSIFIED by making the branch unconditional |
| T-184-10-02 (tampering — layout keys leaking into the definition) | mitigate | **CLOSED for this layer.** `dy` is merged into a node COPY in the view; `canvasNudge.ts` owns the storage and `grep -cE 'localStorage' WorkflowCanvas.tsx` → 0. A nudged render leaves the input `phases` array `toStrictEqual` its pre-render clone, and a walk over every node object handed to the library finds no `dy` / `nudge` / `offset` key. The outgoing-payload key assertion remains 184-11's |
| T-184-10-03 (elevation of privilege — re-enabling free wiring by accident) | mitigate | **CLOSED.** Only `nodesDraggable` flips, per-node, on phase nodes; the shell prop stays `false`. The other five opt-outs plus `showInteractive={false}` are grep-asserted present AND asserted at runtime **while `editable` is true**, which the plan's source grep alone could not have shown. The end cap and the broken-reference stub are asserted non-draggable with both present as a positive control |
| T-184-10-04 (repudiation — a lying docblock or aria promise) | mitigate | **CLOSED, and wider than chartered.** Both named traps fixed in the falsifying commit; `ARIA_LABELS` needed no edit because a second table carries the editing promise; and a THIRD trap the plan did not name — the user-facing "View only · steps stay put" header — was found and fixed. **Zero pinned assertions were edited by this plan** |
| T-184-10-05 (info disclosure — verdict data reaching the node) | accept | **Honoured as accepted.** The mark arrives as an already-server-derived value threaded through node data, exactly as the ⌥ reveal is. No new data class, no new fetch: `grep -c 'workflows/validate'` → 0 |
| T-184-10-SC (tampering — npm installs) | accept | **Honoured — this plan installed nothing.** `frontend/package.json` and the lockfile appear in none of the three commits |

## Scope Fence Compliance

- **Frontend only.** All three commits touch exactly five files, all under `frontend/src/components/workflows/`. `git diff --name-only -- backend/ supabase/migrations` returns **0** lines.
- **No migration** (slot 114 stays RESERVED), **no env var**, **no dependency**, **no cloud parity owed**.
- **No production caller wired.** `WorkflowBuilderPage.tsx` is untouched, so no shipped surface can regress from this plan.
- **`__fixtures__/canvasFixtures.ts` untouched** (D-184-17). The editing suite imports `evalCoverage` and `unresolvableSkip` read-only.
- **No new colour.** The verdict marks are 184-08's two; the `incomplete` state spends zero destructive tokens, asserted. Phase 188's palette is untouched.
- **No motion added.** Motion keys off run state and 184 has no run state; neither the selected node nor the dragged one animates.
- **Only `--reporter=default` / the gate's own `--reporter=json`.** No watch flag committed. No scratch file inside `frontend/` or `backend/` — all five probes were in-place edits, each reverted and grep-verified.

## Issues Encountered

- **A `?raw`-style acceptance grep will be tripped by the paragraph that explains it — every time.** Two more instances here (7 across the phase). The cure is mechanical and should now be applied at authoring time: name the concept, put the literal where the grep does not look, and say the omission is deliberate.
- **A negative assertion can be satisfied by the wrong code path**, and only a probe reveals it. The duplicate-slug fixture is the third instance in this phase (after 184-07's slug-substring case and 184-08's clean-affordance regex). Probe every new bail-out individually, not the feature as a whole.
- **`@xyflow/react` passes a DOM event, not a React synthetic one**, to its drag callbacks. Reach for the library's own `OnNodeDrag` type rather than restating the signature.
- **`PublishGauntlet.test.tsx` remains slow** but reported its pinned 24 green on every gate run of this plan.

## User Setup Required

**None.** No env var, no migration, no dependency, no operator step.

Carried forward, unchanged: `__fixtures__/corpusDump.json` still needs regenerating against a running local Supabase before `/gsd:verify-work` (184-05), and the live in-app five-surface icon sweep remains a phase-verification G-4 row (184-01). Both need Docker up, so both can be done in one pass.

**New, and owned by phase verification:** UAT row **U-2** — the real pointer drag — is live-only. d3-drag is unusable in jsdom, so no automated check in this repo can exercise the gesture itself. What an operator must confirm: a card dragged sideways past half a lane re-orders and snaps to its lane x; a card dragged straight down stays where it is dropped and does NOT re-order; and a page reload restores the vertical offset but never changes the step order.

## Next Phase Readiness

- **184-12 and 184-13 have every prop they need, and none of them fetches.** The page passes `editable={canvasEnabled}`, `marks={groups.markFor}` (from `verdictModel`), `nudges={readNudges(draftId)}`, `onNudge={(slug, dy) => writeNudge(draftId, slug, dy)}` — a plain write, because the canvas hands over the resulting offset — and `onCommitNodes={store.commitCanvasNodes}`.
- **The per-node ＋ / ✕ affordances must stay on the BOTTOM edge.** The verdict mark now really does occupy the card's right edge (`-right-2 top-1.5`), and the top edge belongs to the floating 3D icon.
- **The keyboard binding is `⌥←` / `⌥→` and the sentence is locked**: `Step moved to position {n} of {N}.` Any later surface that reorders should reuse the wording rather than mint a second one.
- **Phase 185 adds data to the node, not code to this shell.** A graded-governance dial arrives on `data` through the same view-copy merge the ⌥ reveal and the verdict mark already use.
- **The zero-assertion-edit gate: this plan consumed NONE of it.** 184-08's two narrowings in `PhaseNodeCard.test.tsx` remain the only assertion edits in phase 184, and the 184-01 `soulData.test.ts` carve-out remains spent. A verifier should read 184-08 § (b) for those two and this section for the rest.

## Self-Check: PASSED

- `frontend/src/components/workflows/builderStore.ts` — FOUND
- `frontend/src/components/workflows/builderStore.test.ts` — FOUND
- `frontend/src/components/workflows/WorkflowCanvas.tsx` — FOUND
- `frontend/src/components/workflows/WorkflowCanvas.editing.test.tsx` — FOUND
- `frontend/src/components/workflows/PhaseNode.tsx` — FOUND
- Commit `68325bf4` — FOUND
- Commit `da476e07` — FOUND
- Commit `0be318eb` — FOUND
- `.planning/phases/184-editable-canvas-live-structural-validation-round-trip/184-10-SUMMARY.md` — FOUND

---
*Phase: 184-editable-canvas-live-structural-validation-round-trip*
*Completed: 2026-07-27*
