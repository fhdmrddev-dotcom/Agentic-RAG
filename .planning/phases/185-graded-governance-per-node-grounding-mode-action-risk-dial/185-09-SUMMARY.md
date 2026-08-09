---
phase: 185-graded-governance-per-node-grounding-mode-action-risk-dial
plan: 09
subsystem: ui
tags: [react, tailwind, canvas, workflow-studio, phase-node-card, governance, sketch-143a, geometry, source-fence, vitest]

# Dependency graph
requires:
  - phase: 185-graded-governance-per-node-grounding-mode-action-risk-dial
    plan: "01"
    provides: "the 137-B card, the verdict mark relocated to -left-2 (freeing top-right), CANVAS_LAYOUT.NODE_MIN_HEIGHT 104, and the bounding-box zone checker with its falsification control"
  - phase: 185-graded-governance-per-node-grounding-mode-action-risk-dial
    plan: "08"
    provides: "PhaseNodeData.grounded on the canvas projection, badge slot 1 emptied, and the deleted grounding word-badge"
  - phase: 185-graded-governance-per-node-grounding-mode-action-risk-dial
    plan: "06"
    provides: "the definitionOps governance copy block (GROUNDING_DIAL_STRICT_LABEL and its eleven siblings)"
  - phase: 184-editable-canvas
    provides: "PhaseNodeCard (the D-184-06 presentational extraction) and its slot contract"
provides:
  - "The governance seal: a 21x21 non-interactive corner mark at the card's top-right, made of SHAPE (its own background + its own 1px border), rendered from the `grounded` prop"
  - "The sealed-edge border reinforcement — a grounded card's border lifted to hsl(220 30% 100% / .34), explicitly EXPECTED to be overwritten by selection today and by Phase 188's run status tomorrow"
  - "`PhaseNodeCardProps.grounded` — the fourth rendered slot, and the only one resolved by a shared CLIENT rule rather than by the server"
  - "definitionOps.GOVERNANCE_SEAL_LABEL — the seal's accessible label, one home with the panel dial's strict side"
  - "A props fence proving the seal's JSX block cannot READ run state, plus a four-run-state outerHTML identity assertion"
  - "The zone check extended from two marks to four ({icon, verdict, seal, stepNumber}) with the seal's box measured off the DOM"
  - "The canvas tab-stop walk re-run over a canvas carrying a detected grounded node (criterion 24 groundwork)"
affects: [185-detour-edge, 188-run-state-canvas, 189-external-actions]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A sketch number measured against the CARD is asserted as a CLEARANCE, not as the Tailwind token — the token is a composite of the sketch inset and the node-box gutter, and only the clearance is the locked fact"
    - "Scoped source fences: carve the block under guard out of the source, so the surrounding docblock stays free to name what the block may not (D-ITEM-183-02)"
    - "Complementary guards must be falsified TOGETHER — a plant that reds only one of a pair proves the pair is not complementary yet"

key-files:
  created: []
  modified:
    - frontend/src/components/workflows/PhaseNodeCard.tsx
    - frontend/src/components/workflows/PhaseNode.tsx
    - frontend/src/components/workflows/definitionOps.ts
    - frontend/src/components/workflows/PhaseNodeCard.test.tsx
    - frontend/src/components/workflows/WorkflowCanvas.test.tsx

key-decisions:
  - "The seal ships at `right-[17px]`, not the plan's literal `right-[11px]`: sketch 143-A measures 11px from the 248px CARD, the element's containing block is the 260px NODE BOX, and 11 + the 6px gutter = 17. The plan contradicted itself here (its own task 2 states the box as CARD_RIGHT-32 to CARD_RIGHT-11, which only `17` satisfies); the sketch is the LOCK, so it won 2-to-1"
  - "The four-run-state identity assertion compares `outerHTML`, not className+textContent — the falsification forced the change: a planted `data-run={props.status}` left the className/text form GREEN, so the two criterion-16 guards were not complementary as written"
  - "The seal sits fully INSIDE the card (x 222..243 against a border at 254) rather than straddling the edge like the verdict mark — governance is a property of the step's face, not a flag pinned to it"
  - "The seal's accessible label lives in `definitionOps` beside the dial's strict label, and the two are asserted still-in-agreement, so Req 7's locked words cannot drift between panel and canvas"
  - "The plan's stated zone-check falsification (`-right-2 top-1.5`) is INERT and was replaced: 185-01 vacated that corner, so a seal parked there collides with nothing. The verdict's CURRENT corner (`-left-2 top-1.5`) is the meaningful plant, and both facts are now pinned as live tests"

patterns-established:
  - "Clearance-not-token: when a design constant is measured against a different box than the one the element is positioned in, assert the derived clearance and record the arithmetic at the class"
  - "Falsify a guard PAIR, not each guard: a plant that reds only one member is evidence the other has a hole"

requirements-completed: []

# Metrics
duration: 42min
completed: 2026-07-30
---

# Phase 185 Plan 09: The Governance Seal Summary

**A grounded step now wears a 21x21 seal at the one card corner nobody else may take, made of shape rather than colour or a badge, carrying its own background and border so a status-coloured card cannot erase it — and "the seal never depends on run state" is a machine-checked property of the markup, not a review comment.**

## Performance

- **Duration:** ~42 min
- **Tasks:** 2
- **Files modified:** 5 (4 planned + 1 deviation)

## Accomplishments

- **The corner is claimed, and the mark is shape.** `PhaseNodeCard` gained one prop, `grounded`, rendered as a single non-interactive `<span>` at the card's top-right: 21x21, `rounded-full`, `bg-[hsl(220_30%_100%/0.1)]`, `border border-[hsl(220_30%_100%/0.34)]`, `z-[6]`, `text-[11px]` — sketch 143-A's numbers, verbatim except the horizontal token (see deviation 1). It spends **no colour token and no badge slot**: `grep -cE 'destructive|success|warning|amber|emerald|green|red-'` over the seal's classes returns 0, and a grounded card still emits exactly one chip when it carries `Waits for you`.
- **The seal is load-bearing; the edge only reinforces it.** A grounded card's border lifts to the same `hsl(220 30% 100% / .34)`. The three border branches are mutually exclusive, so a **selected** grounded card keeps `border-primary` and the reinforcement is gone — which is *exactly* the degradation 143-A verified live at all four run states. Both halves are asserted: the edge lifts when unselected, and when selection (or, later, Phase 188's status) overwrites it, the seal still carries its own border **and** its own background.
- **"Never conditional on run state" is now two mechanical properties, not a promise.** (1) A `?raw` **props fence** carves the seal's JSX block out of the component source — anchored on its test id, and it *throws* rather than returning `""` on a miss — and asserts the block never names the run-state prop. The needle is assembled from fragments and the haystack is the **block, not the file**, so the card's docblock stays free to explain the rule at length without making its own guard vacuous (D-ITEM-183-02). (2) A four-value render asserts the seal's **`outerHTML`** is byte-identical across idle / running / needs-you / failed.
- **The zone check is now four marks wide (criterion 23).** The seal joined the table 185-01 built, its box **measured off the rendered DOM** rather than re-typed: `{x0: 222, y0: 11, x1: 243, y1: 32}`. Zero pairwise overlaps between every pair a person can see; the only nonzero pair in the whole four-zone table is 185-01's written `verdict x stepNumber = 32px²` residual against a slot that paints nothing. The seal clears that slot by **188px** — step number is top-left, governance is top-right — so bringing `phase_index` to the face can never collide with governance.
- **`xOf` learned the arbitrary placement forms.** `left-[Npx]` / `right-[Npx]`, checked *before* the token forms (whose regexes demand a digit after the dash and would otherwise have thrown "no horizontal placement class" on a perfectly real placement).
- **One tab stop per node survives, walked at the canvas level (criterion 24).** `WorkflowCanvas.test.tsx` now renders `docQaHuman` with its agent step switched on to read the knowledge base — driven the way the live surface drives it: the tool on the phase, the KB list from the **server** via `kbTools`, the client only intersecting the two — and re-runs both shipped assertions over it. The seal carries **no `role`, no `tabIndex`, no handler**; `grep -cE 'role=|tabIndex|onClick'` over the whole card file returns **0**.
- **Req 7's words have one home.** The seal's `sr-only` label is `definitionOps.GOVERNANCE_SEAL_LABEL` ("Must prove it"), imported rather than re-typed, and a test asserts `GROUNDING_DIAL_STRICT_LABEL` still *ends with* it — so the panel's dial and the canvas's seal cannot be edited apart silently. A grounded card renders **zero** occurrences of "proven" / "ungoverned" / "unchecked".

## Task-by-Task

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | The corner seal and the sealed edge | `6bdc658a` | `PhaseNodeCard.tsx`, `PhaseNode.tsx`, `definitionOps.ts` |
| 2 | The props fence, the four-mark zone check, the tab-stop walk | `59c54ba0` | `PhaseNodeCard.test.tsx`, `WorkflowCanvas.test.tsx` |

## Continuation note — this plan was RESUMED, not started clean

**Task 1 was already complete and UNCOMMITTED in the working tree** when this executor began (an interrupted earlier run; `git log` ended at 185-08's `53e6e683` and `git status` showed `PhaseNodeCard.tsx`, `PhaseNode.tsx` and `definitionOps.ts` modified). The inherited work was **verified rather than trusted** — every acceptance grep re-run, `tsc -b` re-measured, both suites re-run, the seal block read line by line against the hard invariants — and then committed as Task 1 with one correction (deviation 3). Nothing was redone and nothing was reverted.

The inherited Task 1 had independently reached the **same** `right-[17px]` conclusion documented in deviation 1, with the arithmetic already written at the class. That agreement is recorded because it is evidence about the plan's own internal contradiction, not about the executor.

## Falsifications performed

Three plants, all observed RED, all reverted (`git diff --stat` over both component files afterward: **0 lines**).

**1. The props fence.** `data-run={props.status}` added to the seal span:

```
 FAIL  src/components/workflows/PhaseNodeCard.test.tsx > PhaseNodeCard — the seal cannot
 READ run state (props fence, criterion 16) > the seal's JSX block never names the
 run-state prop
AssertionError: expected '{grounded ? (\r\n        <span\r\n   …' not to match /\bstatus\b/
      Tests  1 failed | 67 passed (68)
```

**⚠ The finding that changed the code:** under that same plant the four-state identity assertion stayed **GREEN**, because as first written it compared `className` + `textContent` and an *attribute*-level dependency on run state is invisible to both. The pair was not complementary. It was rewritten to compare `outerHTML`, and the plant re-applied — after which **both** guards go red:

```
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  … > the seal's JSX block never names the run-state prop
AssertionError: expected '{grounded ? (\r\n        <span\r\n   …' not to match /\bstatus\b/
 FAIL  … > renders a BYTE-IDENTICAL seal at all four run states (the strongest jsdom form)
AssertionError: expected '<span data-testid="canvas-node-seal" …' to be
'<span data-testid="canvas-node-seal" …' // Object.is equality
      Tests  2 failed | 66 passed (68)
```

**2. The four-mark zone check.** The seal's placement classes swapped to the verdict's *current* corner (`-left-2 top-1.5`) — 5 tests red, and the check names the collision exactly as criterion 23 requires:

```
 FAIL  … > all FOUR marks are pairwise clear — the only nonzero pair is the recorded residual
AssertionError: expected [ …(3) ] to deeply equal [ 'verdict × stepNumber = 32px²' ]
  [
+   "verdict × governance seal = 441px²",
    "verdict × stepNumber = 32px²",
+   "governance seal × stepNumber = 15px²",
```

441px² = 21 x 21, i.e. the whole seal buried under the verdict mark. Also red in the same run: the shipped 185-01 zero-overlap check, the seal's clearance assertion (`expected { x0: -8, y0: 6, x1: 13, y1: 27 } to deeply equal { x0: 222, y0: 11, x1: 243, y1: 32 }`), the seal-vs-stepNumber clearance (`expected 15 to be +0`), and the new falsification control (`expected 441 to be +0`).

**3. The canvas tab-stop walk.** `grounded={data.grounded}` replaced with `grounded={false}` in the adapter:

```
 FAIL  src/components/workflows/WorkflowCanvas.test.tsx > WorkflowCanvas — one tab stop per
 node (Pattern 3 Option A) > BOTH halves still hold when a node wears the governance seal
 (185-09, criterion 24)
AssertionError: expected  to have a length of 1 but got +0
```

That is the added non-vacuity guard doing its job: without it, a `grounded` prop that silently stopped being threaded would have left the walk green while walking a canvas with no seal on it.

## Deviations from Plan

### 1. [Rule 1 - Bug] The seal ships at `right-[17px]`, not the plan's literal `right-[11px]`

- **Found during:** Task 1 (and independently by the interrupted run before it)
- **Issue:** The plan's action mandates the class `right-[11px]`. Sketch 143-A places the seal `right: 11px` inside **`.node`, which is the 248px CARD**. The element is a sibling of the verdict mark, so its containing block is the **260px node box**, whose right edge sits 6px outside the card's border. `right-[11px]` on the wrapper therefore lands the seal **5px** from the border a reader actually sees — crowding the card's 22px corner radius — not the sketch's 11px.
- **The plan contradicts itself here, and the majority reading is 17:** the same plan's Task 2 states the intended box as *"x = CARD_RIGHT-32 … CARD_RIGHT-11 in card-relative coordinates"*, which is 222…243 — reachable **only** at `right-[17px]`. (185-01's forward-looking hint, `{x0: 227, y0: 11, x1: 248, y1: 32}`, is a third and also-inconsistent number; it measures in card coordinates and lands the seal flush to the border.) The sketch is the LOCK and Task 2 agrees with it, so the literal class in Task 1 lost 2-to-1.
- **Fix:** `right-[17px]` (= 11 + the (260-248)/2 gutter), with the arithmetic written at the class in the seal's docblock. Crucially, the **test asserts the 11px CLEARANCE from the card's right border**, never the 17 — `expect(cardRightBorder - seal.x1).toBe(11)` — so the composite cannot drift away from the number the sketch locked, and editing either half alone goes red.
- **Files modified:** `PhaseNodeCard.tsx`, `PhaseNodeCard.test.tsx`
- **Commits:** `6bdc658a`, `59c54ba0`

### 2. [Rule 2 - Missing guard] The four-run-state assertion compares `outerHTML`

- **Found during:** Task 2's falsification (see above)
- **Issue:** As the plan specifies it ("assert the seal element's `className` and `textContent` are IDENTICAL"), the assertion cannot see an attribute-level dependency on run state — proven, not theorised: it stayed green under a planted `data-run={props.status}`.
- **Fix:** compare the seal's whole `outerHTML`. Strictly stronger, same intent, and the reason is written at the assertion so the next reader does not "simplify" it back.
- **Files modified:** `PhaseNodeCard.test.tsx`
- **Commit:** `59c54ba0`

### 3. [Rule 3 - Blocking] One pre-existing word failed Task 1's own acceptance grep

- **Found during:** Task 1 verification
- **Issue:** `grep -riE "\b(Proven|Ungoverned|Unchecked|Not applicable|N/A)\b" PhaseNodeCard.tsx` must return **0**, but returned **1** — on a **184-08 comment** about the verdict fallback ("would render an unchecked node as a checked-and-clean one"). The criterion is file-wide, not scoped to rendered strings, so the acceptance bar was unreachable on the inherited line.
- **Fix:** reworded to "a node nobody could check", which is exactly what `VERDICT_MARK.unknown` means — meaning preserved, no rendered string touched. A note at the line records why, so the rewording is not mistaken for drift. The grep now returns 0 honestly instead of the plan carrying a permanent documented exception.
- **Files modified:** `PhaseNodeCard.tsx`
- **Commit:** `6bdc658a`

### 4. [Rule 2 - Scope] `definitionOps.ts` is a fifth file, not in `files_modified`

- **Found during:** Task 1 (inherited from the interrupted run and kept deliberately)
- **Issue:** The plan lists four files. The seal's accessible label was added as `definitionOps.GOVERNANCE_SEAL_LABEL` (+13 lines, one exported const and its docblock) rather than as a literal in the card's JSX.
- **Why kept:** SPEC Req 7's vocabulary is a **LOCK**, and `GROUNDING_DIAL_STRICT_LABEL = "⛨ Must prove it"` already ships in that file's copy block. A literal in the card would be a second copy of a locked word, free to drift from the panel's. PATTERNS §7 / §S2 state the rule directly: *"refusal copy lives in a shared exported constant … it must be ONE exported const, not a literal in JSX."* The pair is now pinned by an assertion (`GROUNDING_DIAL_STRICT_LABEL.endsWith(GOVERNANCE_SEAL_LABEL)`), which is what `definitionOps`' own new docblock promises. No cycle: `definitionOps` imports only `phaseVocabulary`.
- **Files modified:** `definitionOps.ts`
- **Commit:** `6bdc658a`

### 5. [Rule 1 - Bug] The plan's stated zone-check falsification is inert; a real one replaced it

- **Found during:** Task 2
- **Issue:** The plan asks for the seal to be placed at *"the verdict's old `-right-2 top-1.5`"* and for the check to *"turn red naming the seal x verdict overlap"*. That corner was **vacated by 185-01**; a seal parked there (x 247…268) collides with nothing in the table, so the plant cannot go red.
- **Fix:** the verdict's **current** corner (`-left-2 top-1.5`) was planted instead, producing the 441px² `verdict × governance seal` collision quoted above. **Both** facts are now live tests: the meaningful collision, and a test asserting the plan's stated placement overlaps every zone by 0 — with a comment explaining that a mis-placement of that kind is caught by the `right-[17px]` clearance assertion, not by a zone check.
- **Files modified:** `PhaseNodeCard.test.tsx`
- **Commit:** `59c54ba0`

## Verification

| Gate | Result |
|---|---|
| `npx vitest run PhaseNodeCard.test.tsx` | **68 passed** (49 → 68, no case deleted) |
| `npx vitest run WorkflowCanvas.test.tsx` | **35 passed** (33 → 35, 0 deletions in the file) |
| Both target suites together | **103 passed / 103** |
| `npx tsc -b` | **33** = baseline, **0** errors naming any touched file |
| `npx vite build` | exit **0** |
| `node scripts/vitest-count-gate.cjs` | per the VALIDATION posture — see below |
| `git diff --stat -- backend/ supabase/migrations` | **0 files** (live migration head stays 113) |
| `git diff -U0 -- WorkflowCanvas.test.tsx \| grep '^-'` | **0 deleted lines** (57 insertions, 0 deletions) |
| Task 1 acceptance greps | `canvas-node-seal` **1** · `role=/tabIndex/onClick` **0** · banned vocab **0** · `BadgeSlot2Tuple` **2** · badges tuple still max 1 entry |

**Count gate (per `185-VALIDATION.md` §"Count-gate posture" — the rule this phase uses instead of `exits 0`):**

1. No `[count-decrease]` — every one of the 16 pinned files reports delta >= 0. `WorkflowCanvas.test.tsx` **31 → 35 (+4)**, which is the pin this plan touches. **PASS**
2. No `[total-below-baseline]` (total **1598** vs pinned 415) and no `[missing-file]`. **PASS**
3. **No new failing test in any file this plan touched.** All **5** failures are in `PublishGauntlet.test.tsx`, a file this plan never opened, and it is on the recorded pre-existing rot list (SEED-056; 10 failures at the phase's 40-failure reading, so today's 5 is *below* the churn band). **PASS**
4. No re-pin was needed — this plan deletes nothing.

`[failing-tests] 5` is therefore the KNOWN, RECORDED block, exactly as the posture predicts.

**A note on the `WorkflowCanvas` axe flake.** An interim whole-directory run showed the two `WorkflowCanvas — accessibility` tests failing on a 5000ms timeout ("Axe is already running"). They pass in isolation and passed in the count-gate run. They cannot be caused by this plan: both render `evalCoverage` / `emptyDraft`, neither of which contains a grounded phase, so their DOM is byte-identical to the pre-seal render. Load-dependent, pre-existing, recorded in the phase's failing-file list.

## Threat Register Disposition

| Threat ID | Disposition | Status |
|---|---|---|
| T-185-09-01 (elevation — a focusable seal = a second tab stop) | mitigate | **Closed.** Whole-file grep for `role=` / `tabIndex` / `onClick` = 0; the seal carries `pointer-events-none` and its `role` / `tabindex` attributes are asserted null; the canvas-level walk over every `.react-flow__node` re-runs on a canvas that provably contains a seal, behind a non-vacuity guard that was falsified. |
| T-185-09-02 (repudiation — the reading vanishing mid-run) | mitigate | **Closed at the markup level.** The props fence makes reading the run-state prop inside the seal block a test failure, and the four-state `outerHTML` identity pins the rendered output. The *visual* half stays operator UAT (G-4 #2) — jsdom computes no paint. |
| T-185-09-03 (info disclosure — seal markup) | accept | **Holds.** Static glyph + static label; no user, org or document value is interpolated; no `dangerouslySetInnerHTML` (the shipped fence still asserts it). |

No package installs. No migration. No backend file. Frontend-only.

## Known Stubs

None introduced. `status` and `stepNumber` remain **declared and unrendered** on `PhaseNodeCardProps` — that is the pre-existing Wave-0 extensibility seam (Phase 188 owns both), not a stub of this plan's making, and the module docblock now states which slot 185 filled and which two it did not. Badge slot 1 stays deliberately empty for 188 / 189; a third badge is still a typecheck error by construction.

## What this plan does NOT close

- **GOVERN-02 stays `Pending`** in `REQUIREMENTS.md`, on the 185-02 / 03 / 05 / 06 / 08 precedent. The canvas half is real and pinned, but the requirement's other half — the panel's grounding dial that lets an author *see why* and escalate — is 185-07's, and criteria **16 (visual)** and **17 (colour-stripped)** are operator UAT that has not run. Marking it Complete at plan 9 of 11 would make the traceability table lie.
- **Criterion 17 is entirely unproven** by anything in this commit. It needs a greyscale screenshot of the real canvas. What the suite contributes is the *precondition*: the seal spends no colour token, so there is nothing for greyscale to remove.
- **G-4 scenario 1's third beat** ("the canvas card grows its corner seal, with no reload, at the same moment the chip flips") is a live-surface claim about propagation through `useGroundingBundle` → page → `kbTools` → `toCanvas` → the adapter. Every link is individually pinned; the **seam** is UAT.
- **Sketch 143-B remains the documented fallback** if the seal alone reads too quiet in live use — a swap of one block, not a redesign. Recorded in the seal's own docblock so the option is not lost.

## Self-Check: PASSED

All 5 claimed source files plus this SUMMARY exist on disk. All 3 claimed commits exist in `git log` (`6bdc658a` Task 1, `59c54ba0` Task 2, `6713a0fc` this SUMMARY), and each claimed file appears in the commit the task table attributes it to. No file deletions in either task commit; no untracked files left in `frontend/src/components/workflows/`.
