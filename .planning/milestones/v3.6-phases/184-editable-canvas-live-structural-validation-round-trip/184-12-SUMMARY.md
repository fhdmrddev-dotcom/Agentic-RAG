---
phase: 184-editable-canvas-live-structural-validation-round-trip
plan: 12
subsystem: workflows
tags: [canvas-editing, viewport-portal, insert-affordance, delete-with-undo, refusal-not-confirm, empty-state, r10a, r10b, wave-8]

# Dependency graph
requires:
  - phase: 184-02
    provides: "`canRemovePhase` (R10a), `allowedTypesAt` (R10b, with its corrected strictly-after boundary), `slugForType`, `minimalPhaseFor` — every predicate and every refusal sentence this plan renders"
  - phase: 184-07
    provides: "`StepTypePicker` — built, tested and UNMOUNTED until this plan; it authors no reason of its own"
  - phase: 184-08
    provides: "the verdict mark's home on the card's RIGHT edge, which is why the per-node action sits on the BOTTOM edge"
  - phase: 184-10
    provides: "`WorkflowCanvas`'s editing half (`editable` / `marks` / `nudges` / `onNudge` / `onCommitNodes`) and the polite announcer"
  - phase: 184-11
    provides: "the composed session — the store-driven `hasEdited`, `blockedReason`'s empty-draft invitation, and the page as the ONE composition point"
provides:
  - "`WorkflowCanvasProps.onInsertAt` / `onRequestRemove` / `notice` — the grow-the-flow half of the editing surface"
  - "`CanvasNotice` — the two-member union that makes 'an act happened' and 'an edit was refused' structurally different things"
  - "The `＋` / `✕` plane layer, drawn through `<ViewportPortal>` so it pans and zooms with the cards while living outside every node's DOM subtree"
  - "U-1's named empty-draft invitation — 'Add your first step', editable-only"
  - "R10a and R10b visible in the UI, both proven network-free"
affects: [184-13, 185, 186, 188]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A plane-level overlay through the library's own `<ViewportPortal>` when a control must share the nodes' coordinate system but must NOT be a descendant of a node"
    - "Counter-scaling a menu by `1/zoom` inside a zooming portal, so a popover stays screen-constant while its anchor stays flow-anchored"
    - "Reading measured node heights out of the flow store as ONE joined primitive, so the selector's result is reference-stable and cannot re-render on every unrelated store write"
    - "A refusal and an action as two members of a union rather than one string plus a flag — different testids, different roles, and 'a refusal with an Undo button' is not representable"
    - "Splitting a plan's proof by WHERE THE BEHAVIOUR LIVES rather than by which file the plan named: component assertions against the component, store-backed behaviour against the page"

key-files:
  created: []
  modified:
    - frontend/src/components/workflows/WorkflowCanvas.tsx
    - frontend/src/pages/WorkflowBuilderPage.tsx
    - frontend/src/components/workflows/WorkflowCanvas.editing.test.tsx
    - frontend/src/pages/WorkflowBuilderPage.canvas.test.tsx

key-decisions:
  - "An insertion boundary exists at EVERY gap including index 0 — the plan enumerated 'connectors plus one at the end', which leaves a flow with no way to prepend a step"
  - "The ✕'s hover red is a raw hsl literal, NOT the `destructive` design token: R9 reserves that token for the `error` verdict mark and PROVES it by scanning the emitted HTML, so reusing it made a shipped scan fail for a reason it was never written to measure"
  - "Store-backed behaviour (index arithmetic, the moved count, the refusal, Undo) is asserted in the PAGE suite against the real store, not re-implemented inside the component suite"
  - "The delete message's zero case reads 'nothing else moved' rather than '0 steps renumbered' — the message exists to say what the edit did to the rest of the flow, and a zero makes a person parse a number to learn that nothing happened"
  - "`CanvasNotice` carries `lead` / `subject` / `detail` rather than one string, so the step's title is really `<strong>` rather than markdown asterisks rendered as text"

patterns-established:
  - "A positive control on a `closest(...)` negative assertion: something in the same render MUST report a non-null ancestor, or a misspelled selector passes every line"
  - "Falsify a refusal by disabling its gate, not by editing its test — four source probes produced eight distinct reds across the two suites"

requirements-completed: []  # CANVAS-02 and VALID-02 are this plan's frontmatter requirements. CANVAS-02's add/delete half lands here, but the canvas toolbar + problems tray (184-13) are still unbuilt, and VALID-02 spans the whole live-validation surface. REQUIREMENTS.md deliberately untouched; the orchestrator marks all 5 at phase end.

# Metrics
duration: 21min
completed: 2026-07-27
---

# Phase 184 Plan 12: The ＋ on the Line and the ✕ that Re-stitches Summary

**The canvas can now grow: a `＋` sits on the connector where the step will land and opens the six plain-language types there, a `✕` on each card's bottom edge deletes IMMEDIATELY with an inline Undo and no modal anywhere, both refusals state their reason and provably never touch the server, and an empty draft opens with a named invitation instead of a bare control — with every affordance living outside the node DOM, so the shipped one-tab-stop-per-node invariant holds by construction rather than by care.**

## Performance

- **Duration:** ~21 min
- **Started:** 2026-07-27T09:04:58Z
- **Completed:** 2026-07-27T09:25:31Z
- **Tasks:** 3 (all `auto`)
- **Files created:** 0 · **Files modified:** 4

## Task Commits

| # | Commit | Type | What |
|---|---|---|---|
| 1 | `224f72e5` | feat | Tasks 1 and 2's SOURCE — the affordances, the picker mount, the notice region, both refusals, the empty-draft invitation |
| 2 | `4c7a7d13` | test | Task 3's canvas half — 25 net-new assertions appended to `WorkflowCanvas.editing.test.tsx` |
| 3 | `f24e90cd` | test | Task 3's page half — 17 net-new assertions appended to `WorkflowBuilderPage.canvas.test.tsx` |

**Why the source is one commit and not two.** Tasks 1 and 2 edit the same two files, and a commit is a whole-file snapshot. Splitting them would have meant two commit messages each describing a fraction of what the tree actually contained at that commit — a lie about the working state, which is worse than a coarse-grained but accurate commit. This is the 184-11 precedent, applied for the same reason.

No commit deletes a tracked file (`git diff --diff-filter=D --name-only` is empty on all three).

---

## `<output>` REQUIREMENT 1: the exact strings, as rendered

**The delete message** — `data-testid="canvas-notice-action"`, `role="status"`, `aria-live="polite"`, with the step's title in a real `<strong>`:

```
Removed Work out how to do it · 2 steps renumbered
```

(that is `evalCoverage`'s `deep_dive`, an `llm_agent` with no authored name, so `nodeTitle` resolves to the D-183-06 sentence — the slug never appears). The locked example from `184-CONTEXT.md` renders character-for-character in the same shape: *"Removed **Write a section** · 2 steps renumbered"*.

The three `detail` forms, all counted from an actual before/after `phase_index` comparison:

| Moved | Rendered detail | When |
|---|---|---|
| 2 | `2 steps renumbered` | a middle step deleted from a 5-step flow |
| 1 | `1 step renumbered` | the singular, so the sentence is not ungrammatical |
| 0 | `nothing else moved` | the LAST step deleted — see Deviation 4 |

**The insert message**, same region, same vocabulary:

```
Added Write it up · 3 steps renumbered
```

**R10a's refusal** — `data-testid="canvas-notice-refusal"`, `role="alert"`, zero buttons inside it. Verbatim from `definitionOps.canRemovePhase`, which the page renders and does not compose:

```
"Write it up" sends failures to this step. Remove that fallback first.
```

**R10b's refusal**, rendered inline under every one of the six menu rows, asserted **character-identical** to `definitionOps.STRANDING_REASON`:

```
This would come after the deliverable, so the workflow would no longer end with it.
```

**U-1's invitation** — `data-testid="canvas-add-first-step"`, editable-only:

```
＋ Add your first step
Pick what it should do — you can change the details afterwards.
```

## `<output>` REQUIREMENT 2: both affordances' null `.react-flow__node` ancestor

**Confirmed, structurally, for every instance — not for a sample.**

```
it("every ＋ and every ✕ has a NULL `.react-flow__node` ancestor")
  → for index 0..5:  screen.getByTestId(`canvas-insert-${index}`).closest(".react-flow__node")  === null
  → for all 5 slugs: screen.getByTestId(`canvas-remove-${slug}`).closest(".react-flow__node")   === null
  → POSITIVE CONTROL: screen.getByTestId("canvas-node-split").closest(".react-flow__node")      !== null
```

The positive control is load-bearing: `closest` also returns null for a misspelled selector or a library that stopped emitting that class, in which case every line above would pass while measuring nothing.

And the shipped invariant itself is re-asserted **with both affordances mounted**, which `WorkflowCanvas.test.tsx:231-238` cannot do because that suite never renders the editable surface:

```
for every .react-flow__node:  node.querySelectorAll("button, a, [tabindex]").length === 0
POSITIVE CONTROL:             container.querySelectorAll("[data-canvas-affordance]").length > 0
```

**How that is achieved.** The `＋`, the `✕` and the menu are drawn through the library's own `<ViewportPortal>`, which portals into `.react-flow__viewport-portal` — a sibling of the node renderer, inside the transformed viewport. They therefore pan and zoom with the cards they belong to while being descendants of no node. This was verified to render under jsdom before the design was committed to.

---

## Accomplishments

- **The `＋` sits ON the line, not near it.** Its y is `CANVAS_LAYOUT.LANE_Y + EDGE_ANCHOR_Y` — the exact height `canvasModel` anchors every edge at — and its x is the midpoint of the connector, computed from `PITCH_X - NODE_WIDTH`. Every number reads from the one frozen layout table the projection and the CSS already share, at module scope per the Pattern-4 rule.
- **The `✕` is on the BOTTOM edge, and it reads the measured height.** 137-B gives the card's top to the floating icon and 184-08 gives its right edge to the verdict mark, so the bottom is what is left. A fixed offset from `NODE_MIN_HEIGHT` would drift into the body of a two-line title, so the height comes from the flow store's own measurement with the layout floor as the fallback.
- **Delete is immediate and there is no modal.** Asserted at both levels: no `role="dialog"` and no `role="alertdialog"` before the press, during the delete, or after the definition settles.
- **Undo restores exactly.** `toStrictEqual` against a `structuredClone` of the pre-delete phases, and the probe that removes the temporal `undo()` call turns it red.
- **The two refusals are structurally different acts.** Different testids, different roles, and the union makes "a refusal carrying an Undo button" unrepresentable rather than merely unwritten.
- **Neither refusal touches the network.** R10b: a whole-suite `fetch` spy at 0 across three refused-choice interactions. R10a: `validateWorkflow` at exactly 0, asserted **700 ms after** the refusal — well past the live loop's 500 ms debounce, so "zero" is not "not yet".
- **The strictly-after boundary is preserved and visible.** Index 2 (the emit's own position) offers all six types enabled with no reason node; index 3 disables all six with the reason. 184-02's Deviation 1 was consumed, not re-derived.
- **The flag-off surface cannot have moved.** `revertByteIdentical.test.tsx` is green at its pinned 7, the canvas snapshot is byte-unchanged, and `editable=false` renders neither affordance, no notice region (asserted **while a notice prop is supplied**) and the shipped "No steps yet" empty state.

## Verification Results

| Gate | Required | Observed |
|---|---|---|
| `npx vitest run` on the full plan set (27 files) | 0 failures AND exit 0 | **27 files / 1007 tests passed**, exit 0 |
| `node scripts/vitest-count-gate.cjs` | exit 0, no per-file decrease | **exit 0** on every commit; 16/16 pinned present, **every pinned delta 0** |
| Suite totals | — | 948 → **973** (commit 2) → **990** (commit 3), **0 failing** throughout |
| `WorkflowCanvas.editing.test.tsx` | append only | **24 → 49 tests**; `git diff --numstat` = **405 insertions, 0 deletions** |
| `WorkflowBuilderPage.canvas.test.tsx` | append only | **37 → 54 tests**; `git diff --numstat` = **291 insertions, 0 deletions** |
| `WorkflowCanvas.test.tsx` | 31, file untouched | **31 passed**, `git diff` on it is **empty** |
| `npx tsc -b \| grep -c "error TS"` | ≤ 33 (the `develop` differential) | **33** — equal to baseline |
| `npx vite build` | exit 0 | **exit 0**, built in 4.07 s |
| `git diff --exit-code -- 'src/**/__snapshots__/*'` | exit 0 | **exit 0 — byte-unchanged** |
| `revertByteIdentical.test.tsx` | green at its pinned 7 | **7/7** |
| `npx eslint` on all four files | clean | **zero problems** |
| `grep -cE 'workflows/validate\|grounding_mode' WorkflowCanvas.tsx` | 0 | **0** |
| `grep -cE 'would (strand\|come after)' WorkflowCanvas.tsx` | 0 | **0** — no reason authored here |
| `grep -c 'deleteKeyCode={null}' WorkflowCanvas.tsx` | ≥ 1 | **1**, and re-asserted through the captured props |
| `grep -c 'showInteractive={false}' WorkflowCanvas.tsx` | ≥ 1 | **1** |
| `grep -c 'onInsertAt' WorkflowCanvas.tsx` | ≥ 1 (the artifact contract) | **5** |
| `git diff --name-only -- backend/` | 0 | **0** |
| `git diff --name-only -- supabase/migrations` | 0 | **0** — slot 114 stays RESERVED |
| `.planning/REQUIREMENTS.md` | untouched, all 5 REQ-IDs Pending | **untouched** |

---

## Falsifications — 6 probes, 15 distinct reds, every one restored

An assertion that has only ever passed is not evidence. Every probe was applied in place to the source and reverted in place; `git diff --stat` on each probed file is **empty** afterwards.

| Probe | Reds | Restored |
|---|---|---|
| `allowedTypesAt`'s boundary shifted from `at > lastEmit` to `at > lastEmit + 1` | **3** — the past-the-deliverable disable row, the refused-row-inserts-nothing row, the zero-network row | ✓ |
| The `＋`'s base `opacity-100` removed from `REVEAL_ON_HOVER` | **1** — the present-without-a-hover-event row | ✓ |
| The page's `if (!outcome.ok)` refusal gate disabled | **3** — all three R10a rows (the phases-unchanged row, the stated-reason row, and the zero-network row, which went red because a delete that PROCEEDS starts the live loop) | ✓ |
| `countMoved`'s increment changed to `+= 0` | **2** — both moved-count rows | ✓ |
| The post-delete `setSelectedSlug(...)` replaced with `null` | **2** — the following-step and preceding-step rows | ✓ |
| The temporal `undo()` call removed | **2** — the restore row and the zero-write row | ✓ |

**The most informative probe** is the third. Disabling the refusal gate turned the *zero-network* row red as well as the two obvious ones — because a delete that actually proceeds flips `hasEdited` and starts the live loop. That means the R10 network claim is not green-by-construction on a page that never validates; it is measuring the difference between an edit that happened and one that did not.

**A note on the boundary probe's third red.** It fired because choosing an (incorrectly) enabled row closes the menu, so the next `getByTestId` in that test throws. That is an adjacent cause rather than the assertion's own subject — recorded here so nobody reads it as stronger evidence than it is. The first two reds are the direct ones.

---

## Assertion edits: ZERO. Import lines: two, enumerated

**This plan edited ZERO assertions in any pre-existing test file, and made ZERO changes to any existing line of either test file.**

```
$ git diff --numstat 224f72e5~1 HEAD -- 'frontend/src/**/*.test.ts' 'frontend/src/**/*.test.tsx'
405  0  frontend/src/components/workflows/WorkflowCanvas.editing.test.tsx
291  0  frontend/src/pages/WorkflowBuilderPage.canvas.test.tsx
```

**Both diffs are 0-deletion.** That was not free: the appended blocks need four imported symbols, and the natural way to get them — widening the existing `import { WorkflowCanvas } from "./WorkflowCanvas"` line — costs one deletion. They are on their own new lines instead, with a comment saying why, so the additive property is exact rather than approximate:

```diff
+import type { CanvasNotice } from "./WorkflowCanvas"
+import { STRANDING_REASON, type PhaseTypeId } from "./definitionOps"
```
```diff
+import { branching, evalCoverage } from "@/components/workflows/__fixtures__/canvasFixtures"
+import { nodeTitle } from "@/components/workflows/phaseVocabulary"
```

The 184-01 `soulData.test.ts` carve-out remains spent and unconsumed by this plan (it reported its pinned **14** on every gate run). Together with 184-08's two narrowings and 184-11's one forced literal, the phase's assertion-edit ledger is unchanged.

### One stale title left deliberately, and recorded in the file

`WorkflowCanvas.editing.test.tsx`'s 184-10 block is named *"editable is the switch, and it flips exactly one thing"*. As of this plan that count is **four** (per-node drag, the `＋`/`✕` layer, the notice region, the empty-draft invitation). Every **assertion** in that block is still exactly true and still measures what it was written to measure, so rewording it would spend an edit on a pre-existing file for a comment rather than a behaviour. The appended block carries a `⚠` paragraph naming the drift, and the component's own docblock enumerates the four — so a reader is not misled, and nobody "discovers" the staleness and quietly widens the old block instead of appending to the new one.

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] An insertion boundary exists at index 0 too — the plan's set leaves a flow with no way to prepend**

- **Found during:** Task 1
- **Issue:** The plan specifies the `＋` "positioned against the connector between two adjacent lane slots … plus one at the end of the flow". On an `n`-step flow that is `n-1` connectors plus one end cap = boundaries `1..n`. **Index 0 is unreachable**, so an author cannot add a step before the first one — on a surface whose stated purpose is "grow a flow step-by-step", and where the most common shape starts with a `programmatic` prepare step someone will want to precede. The store, the ops and the picker all support index 0 (`insertPhaseAt` clamps to `[0, n]`, `allowedTypesAt` is tested at index 0); only the affordance set omitted it.
- **Fix:** boundaries are `0..n` — one on each connector, plus one at each end. `insertPointX` returns `lanes[0] - GAP/2` for index 0, the mirror of the end cap's `lanes[n-1] + NODE_WIDTH + GAP/2`. The `＋` still sits in the empty space where the card will land, so sketch 138-A's "the question *where does this go?* is answered before you pick anything" holds at both ends.
- **Files modified:** `frontend/src/components/workflows/WorkflowCanvas.tsx`
- **Verification:** the affordance-count assertion is `phases.length + 1`, and a dedicated test drives `canvas-insert-0` end to end (`onInsertAt` called with `(0, "llm_agent")`)
- **Committed in:** `224f72e5`

---

**2. [Rule 1 - Bug] The `✕` must not wear the `destructive` design token — a shipped scan reserves it**

- **Found during:** Task 1
- **Issue:** the `✕`'s first hover treatment used `hover:border-destructive/60 hover:text-destructive`, the app's normal way to say "this is dangerous". It turned a **shipped 184-08/184-10 assertion red on the first run**: `VERDICT_DESTRUCTIVE_TOKEN` is exported specifically so R9's colour budget can be *scanned* rather than eyeballed, and the editing suite renders an all-`incomplete` draft and asserts the literal `"destructive"` appears in the emitted HTML **exactly zero times**. Five `✕` buttons × two classes put it there ten times. The scan was not wrong — the button was.
- **Fix:** the hover red is `canvas-184.css`'s own `.acts button.danger:hover` values as raw literals (`hsl(0 72% 51% / .6)` border, `hsl(0 85% 74%)` text). The control still reads as destructive on hover; the design token stays reserved for the `error` verdict mark. A `⚠` paragraph at the call site says why, so nobody "tidies" it back into the token.
- **Files modified:** `frontend/src/components/workflows/WorkflowCanvas.tsx`
- **Verification:** the shipped `an incomplete mark renders the dashed grey ○ and spends ZERO destructive tokens` assertion is green, unmodified
- **Committed in:** `224f72e5`

---

**3. [Rule 3 - Blocking] Store-backed behaviour is proven in the PAGE suite, not the component suite**

- **Found during:** Task 3
- **Issue:** the plan assigns ten assertions to `WorkflowCanvas.editing.test.tsx`, four of which are not behaviours of that component at all: the resulting `phase_index` array after an insert (item 1), the delete's moved count (item 2), the orphaning refusal (item 3) and the Undo restore (item 7). `WorkflowCanvas` holds no store, evaluates no predicate and computes no message — it reports a gesture and renders what the page hands back. Asserting those there would require standing up a store and re-implementing both page handlers **inside the test file**, and then measuring the copy: a suite that stays green while the real page handler rots. That is the "a gate that lies" failure this phase has now named in five plans.
- **Fix:** the proof is split by where the behaviour lives. The component suite gets the affordance assertions (DOM ancestry, editable gating, what the `＋` opens, R10b on both sides, the two notice treatments, no dialog, the empty draft, touch visibility) — **25 net-new**. The page suite gets the store-backed ones, driven through the real DOM against the real store, the real `definitionOps` predicates and the real canvas — **17 net-new**. The page's live definition is read through the **shipped `renderPublish` seam**, so no private field is reached into and the assertions observe the same object the Workflows shell receives in production. Both files carry a header paragraph stating the split and why.
- **Files modified:** `WorkflowCanvas.editing.test.tsx`, `WorkflowBuilderPage.canvas.test.tsx`
- **Verification:** every acceptance criterion the plan lists is met — only its file assignment moved. The four probes above prove the page-level rows are live
- **Committed in:** `4c7a7d13`, `f24e90cd`

---

**4. [Rule 2 - Missing Critical] The zero-moved case gets its own sentence**

- **Found during:** Task 2
- **Issue:** the locked pattern is *"Removed **X** · N steps renumbered"*. Deleting the LAST step renumbers nothing, and the literal pattern then renders `0 steps renumbered` — a sentence that makes a person stop and parse a number to learn that nothing happened. `1 steps renumbered` is also ungrammatical.
- **Fix:** `renumberedPhrase` returns `nothing else moved` at zero and the singular `1 step renumbered` at one; the locked plural form is reproduced verbatim for everything else. Exact wording of user-facing strings is explicitly Claude's discretion in CONTEXT, anchored to the sketch vocabulary. Both variants are asserted.
- **Files modified:** `frontend/src/pages/WorkflowBuilderPage.tsx`
- **Committed in:** `224f72e5`

---

**5. [Rule 3 - Blocking] The two message helpers are module-private, not exported**

- **Found during:** Task 1
- **Issue:** `renumberedPhrase` and `countMoved` were first written as exports, and `eslint` failed with two `react-refresh/only-export-components` errors — a page module may export components and constants but not helper functions, or Fast Refresh stops working for the whole file.
- **Fix:** both are module-private. Nothing imports them: the assertions read the RENDERED sentence, which is the stronger claim anyway — a helper unit test would pass on a page that never called it.
- **Files modified:** `frontend/src/pages/WorkflowBuilderPage.tsx`
- **Committed in:** `224f72e5`

---

**6. [Rule 1 - Bug] The test helper's `type: never` parameter added a 34th `tsc` error**

- **Found during:** Task 3
- **Issue:** the appended render helper first typed its `onInsertAt` as `(index: number, type: never) => void` to avoid an import. That is not assignable to the prop's `(index: number, type: PhaseTypeId) => void` and pushed the differential from 33 to **34** — a real regression against the `develop` baseline, caught only because the count is checked rather than glanced at.
- **Fix:** `PhaseTypeId` is imported (on the same new line as `STRANDING_REASON`, so the diff stays 0-deletion) and the helper is typed properly. Back to **33**.
- **Files modified:** `frontend/src/components/workflows/WorkflowCanvas.editing.test.tsx`
- **Committed in:** `4c7a7d13`

---

### Anti-drift corrections applied while writing (not defects)

**7. [Rule 2 - Missing Critical] The component docblock said `editable` "flips ONE thing and only one"**

- **Found during:** Task 1
- **Issue:** 184-10 wrote that sentence and it was true then. This plan adds three more things to that switch (the affordance layer, the notice region, the empty-draft invitation), which would have made the file's own opening paragraph false — the D-ITEM-183-02 trap, in the place a maintainer reads first.
- **Fix:** the docblock now enumerates **four**, numbered, each tagged with the plan that added it, and says explicitly that the count is written out *because* it used to be one. The `editable` prop's own docblock is corrected in the same way. A new `D-184-12` section states the delete-without-modal decision and the shape-rule-vs-verdict boundary at the top of the file.
- **Files modified:** `frontend/src/components/workflows/WorkflowCanvas.tsx`
- **Committed in:** `224f72e5`

---

**Total deviations:** 7 (2 bugs, 3 missing-critical, 2 blocking)
**Impact on plan:** none expands scope. The file set is exactly the four in `files_modified`. Deviations 1, 3 and 4 are the only departures from the plan's literal text; each is strictly more correct or more honest than what it wrote.

---

## Design decisions worth carrying forward

- **`<ViewportPortal>` is the answer whenever a control must share the nodes' coordinate system without being a node's child.** 184-13's toolbar does NOT want it (a toolbar must not zoom), but anything anchored to a card does. The counter-scale trick (`scale(1/zoom)` with `transform-origin: top left`) is how a popover stays readable at 0.3× while staying flow-anchored.
- **Measured heights come out of the flow store as one joined primitive.** `phaseOrder.map(...).join(",")` gives the selector a reference-stable result, so the layer does not re-render on every unrelated store write. A selector returning a fresh array or object would need an equality function, and the equality function is the thing people forget.
- **A refusal and an action are two union members, not one string with a flag.** "A refusal that carries an Undo button" and "a delete message with no way back" are both unrepresentable. That is a stronger guarantee than any assertion about them, and it is free.
- **The moved count is COUNTED.** "Everything downstream" is the intuitive answer and it is wrong at both ends — deleting the last step moves nothing, and the shipped `indexGap` shape can move a step that is not downstream of the edit. The comparison is index by index against the before order.
- **The page reads back the slug the store minted rather than deriving it again.** `slugForType` is pure, so a second call would agree *today* — and would be a second copy of the slug rule, which is exactly how two copies silently disagree the first time either grows a condition.

## Threat Model Disposition

| Threat ID | Disposition | Status |
|---|---|---|
| T-184-12-01 (tampering — an accidental irreversible delete) | mitigate | **CLOSED.** Delete is immediate but always recoverable: the message carries an inline Undo backed by the `zundo` history, and the restore is asserted `toStrictEqual` against a `structuredClone` of the pre-delete array. The probe that removes the `undo()` call turns it red, so the safety net is measured rather than assumed. No modal ships |
| T-184-12-02 (repudiation — a client refusal read as a server verdict) | mitigate | **CLOSED.** Both refusals are pure shape predicates from `definitionOps`; `grep -cE 'workflows/validate\|grounding_mode'` and `grep -cE 'would (strand\|come after)'` on `WorkflowCanvas.tsx` both return **0**, so the canvas neither names the seam nor authors a reason. R10b's rendered sentence is asserted character-identical to `STRANDING_REASON`. The two notices use different testids AND different roles, and the union makes conflating them unrepresentable. Network: the whole-suite `fetch` spy is at 0 across every refusal path, and `validateWorkflow` is at 0 seven hundred milliseconds after a refused delete |
| T-184-12-03 (EoP — Backspace deleting a node via the library) | mitigate | **CLOSED.** `deleteKeyCode={null}` is grep-asserted in source **and** re-read off the props the component hands the library, on the editable surface. The `✕` is the only delete path |
| T-184-12-04 (tampering — an affordance breaking the node tab-stop contract) | mitigate | **CLOSED.** Every `＋` and every `✕` reports a null `.react-flow__node` ancestor, with a positive control proving the query is live, and the shipped one-tab-stop invariant is re-asserted with both mounted |
| T-184-12-05 (tampering — slug injection through the add path) | mitigate | **CLOSED.** The canvas passes only a `PhaseTypeId` from the closed 6-member set; the slug is generated by `slugForType` inside the store and READ BACK by the page. The picker has no slug field (asserted in 184-07), and a test asserts the input `phases` array is byte-unchanged by a choice |
| T-184-12-SC (supply chain — npm installs) | accept | **Honoured — this plan installed nothing.** `frontend/package.json` and the lockfile appear in none of the three commits |

## Scope Fence Compliance

- **Frontend only.** `git diff --name-only -- backend/ supabase/migrations` returns **0** lines across all three commits. Slot 114 stays RESERVED.
- **No env var, no dependency, no migration, no new endpoint, no cloud parity owed.**
- **No new file.** Exactly the four files in `files_modified` are touched.
- **`__fixtures__/canvasFixtures.ts` untouched** (D-184-17). The `llm_emit`-terminated shape R10b needs is hand-authored inline in the appended block, with slugs (`zx-gather`, `zx-review`, `zx-emit`) chosen so they cannot be substrings of the plain-language vocabulary — 184-07's Deviation 2 lesson applied.
- **Phase 185 is not pre-empted.** `grep -c 'grounding_mode'` on both touched source files → 0. `allowedTypesAt`'s row shape is untouched, so a graded-governance dial still adds data to the row rather than a new return shape.
- **Phase 186's seam is intact.** `draftIdRef`, `creatingRef`, `onPersist`, `onSaveDraft` and the create-once-then-PATCH branch are byte-unchanged. Neither new handler writes anything.
- **Only `--reporter=default` / the gate's own `--reporter=json`.** No watch flag committed. The one throwaway probe file written under `frontend/src` was deleted before the first commit and never staged; every source probe was applied and reverted in place with `git diff --stat` verified empty afterwards.

## Known Stubs

**None.** Everything this plan adds is a complete implementation of its contract.

Two things remain deliberately UNBUILT and are named in the plan set, not stubbed: the canvas toolbar (undo/redo + the save state) and the problems tray are **184-13**. The verdict data is already mirrored into the store and needs no page change for the tray.

## Issues Encountered

- **A design-token class can fail a colour-budget scan it has nothing to do with.** Deviation 2 — worth remembering for 184-13 and 188: `VERDICT_DESTRUCTIVE_TOKEN` is scanned across the WHOLE emitted HTML, so any new control that wants to look dangerous must use a raw literal, not the token.
- **The plan's file assignment for tests can be wrong even when its assertions are right.** Deviation 3. When a plan asks a component suite to assert store behaviour, the honest move is to relocate the assertion, not to build a store inside the component test.
- **`PublishGauntlet.test.tsx` still flakes under a fully parallel run** while passing 24/24 in isolation and reporting its pinned 24 with 0 failing on every gate run. Fourth plan in a row to record it; a `testTimeout` bump belongs in a later cleanup, not here.
- **One pre-existing `vi.resetModules` test went red under an unrelated source probe** (the 184-11 `rails` positive control). It is green on every clean run, before and after this plan. Recorded because a probe's collateral reds are worth naming rather than quietly ignoring.

## User Setup Required

**None.** No env var, no migration, no dependency, no operator step.

**Owned by phase verification (live-only), added to the existing G-4 rows:**
- **The `＋` on a real pointer.** Hover the connector above 1024 px and confirm the `＋` fades in on the line rather than beside it; narrow the window under 1024 px (or use a touch device) and confirm it is permanently visible. jsdom applies no CSS, so the reveal itself is a live row.
- **The `✕` on a tall card.** Give a step a long enough title to wrap onto two lines and confirm the `✕` still straddles the card's bottom border rather than sitting inside it — the measured-height path only has its fallback exercised under jsdom.
- **The menu at zoom.** Zoom out to the minimum and open a `＋`; the menu must stay readable (it counter-scales) while staying anchored to the connector.
- **Delete then Undo, as a person.** Delete a middle step, read the message, press Undo, and confirm the step returns in its old position with the flow re-stitched.

## Next Phase Readiness

- **184-13 has the surface it needs.** The notice region is a shared, editable-only strip immediately under the header — the toolbar and the problems tray must compose with it inside R12's one-bottom-region, two-rows-max rule. `SAVED_STILL_A_DRAFT` is still exported from the page for the toolbar's save state; two spellings of a locked string is how a locked string stops being locked.
- **CANVAS-02 is now functionally complete on the canvas** (add, move, delete), but its REQ-ID is deliberately NOT marked — the toolbar and tray that make the session legible are 184-13, and the orchestrator marks all five at phase end.
- **Phase 185 lands on an untouched row shape.** `TypeChoice` still carries a per-type reason slot and the picker renders whatever reason it is handed.
- **The assertion-edit ledger is unchanged.** This plan spent none: 184-08's two narrowings, 184-11's one forced literal and the 184-01 carve-out remain the complete list for phase 184.

## Self-Check: PASSED

- `frontend/src/components/workflows/WorkflowCanvas.tsx` — FOUND
- `frontend/src/pages/WorkflowBuilderPage.tsx` — FOUND
- `frontend/src/components/workflows/WorkflowCanvas.editing.test.tsx` — FOUND
- `frontend/src/pages/WorkflowBuilderPage.canvas.test.tsx` — FOUND
- Commit `224f72e5` — FOUND
- Commit `4c7a7d13` — FOUND
- Commit `f24e90cd` — FOUND
- `.planning/phases/184-editable-canvas-live-structural-validation-round-trip/184-12-SUMMARY.md` — FOUND

---
*Phase: 184-editable-canvas-live-structural-validation-round-trip*
*Completed: 2026-07-27*
