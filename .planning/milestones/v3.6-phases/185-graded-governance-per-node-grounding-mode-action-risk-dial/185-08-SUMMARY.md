---
phase: 185-graded-governance-per-node-grounding-mode-action-risk-dial
plan: 08
subsystem: frontend
tags: [react, typescript, workflow-canvas, governance, grounding, deletion, vitest, count-gate, frontend-only]

# Dependency graph
requires:
  - phase: 185-07
    provides: "GovernanceSection + PhaseFormPanelProps.onGovernanceChange? + PhaseFormRails.kbTools? — the panel half this plan finally supplies from the page"
  - phase: 185-06
    provides: "GOVERNANCE_GATE_ROW_LABEL and the other 11 copy constants, PhaseSpecJSON.grounding_escalated / .action_risk_armed, GroundingBundleState.kbTools, builderStore.setGovernance"
  - phase: 185-02
    provides: "grounding_cause()'s branch order (detected → already-set → escalated) and the server's 5-name KB_TOOLS list, served as kb_tools"
  - phase: 184-09
    provides: "PhaseFormRails / PhaseGateRow, the GatesRail frame, and the rails-absent byte-identity contract (D-14 / D-181-01)"
  - phase: 183-02
    provides: "phaseVocabulary as the ONE shared vocabulary module both graph views read, and the groundingFor() this plan deletes"
provides:
  - "PhaseNodeData.grounded: boolean — the canvas's governance signal, resolved once in buildPhaseData. THE FIELD PLAN 185-09's CORNER SEAL READS."
  - "PhaseNodeData.armed: boolean — the action-risk signal, read-only on the canvas. THE FIELD PLAN 185-10's DETOUR EDGE READS."
  - "phaseVocabulary.groundingCause(inputs) / groundingCauseOf(phase, kbTools) / GroundingCause / GROUNDING_DIAL_TYPES — the ONE client home for the cause and its total order"
  - "phaseVocabulary.actionRiskArmed(phase) — the armed read"
  - "toCanvas(definition, { kbTools }) — an optional KB list; omitted marks NOTHING (D-185-09)"
  - "WorkflowCanvas kbTools? prop — the page hands one value to three readers"
  - "WorkflowBuilderPage.gatesFor(phase, kbTools) — the CLIENT-synthesized locked 🔒 row (D-185-19)"
  - "WorkflowBuilderPage.onGovernanceChange — the page useCallback closing the four-layer write chain, passed inside the canvasEnabled spread-conditional"
  - "A re-measured count-gate baseline: phaseVocabulary.test.ts 42 → 33, pinned total 424 → 415"
  - "DELETED and gone from the tree: GROUNDINGS, groundingFor, the Grounding interface, nodePresentation.GROUNDING_TONE, and all three retired badge strings"
affects: [185-09-corner-seal, 185-10-detour-edge, 188-run-surface, 189-external-actions]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Move the rule DOWN rather than copy it sideways: when a second consumer needs a derivation, it lands in the shared module both consumers already import, with a flat-input core plus a phase-shaped adapter so neither owns a branch order"
    - "Delete the colour table with the badge it coloured: a tone map whose consumer is gone is not harmless dead code, it is a live exported reading a later phase can pick up — so its source guard flips from asserting presence to asserting absence, same test count, stronger claim"
    - "A pin is lowered ONLY alongside a plan-authorized deletion, in the SAME commit, with the number read from the gate's own output column — never hand-computed, never to quiet a red gate"

key-files:
  created: []
  modified:
    - frontend/src/components/workflows/phaseVocabulary.ts
    - frontend/src/components/workflows/phaseVocabulary.test.ts
    - frontend/src/components/workflows/canvasModel.ts
    - frontend/src/components/workflows/canvasModel.test.ts
    - frontend/src/components/workflows/PhaseNode.tsx
    - frontend/src/components/workflows/WorkflowCanvas.tsx
    - frontend/src/components/workflows/WorkflowCanvas.test.tsx
    - frontend/src/components/workflows/__snapshots__/canvasModel.fixtures.test.ts.snap
    - frontend/src/components/workflows/nodePresentation.ts
    - frontend/src/components/workflows/PhaseNodeCard.tsx
    - frontend/src/components/workflows/PhaseNodeCard.test.tsx
    - frontend/src/components/workflows/PhaseFormPanel.tsx
    - frontend/src/components/workflows/PhaseFormPanel.rails.test.tsx
    - frontend/src/pages/WorkflowBuilderPage.tsx
    - frontend/src/pages/WorkflowBuilderPage.canvas.test.tsx
    - frontend/src/pages/WorkflowBuilderPage.header.test.tsx
    - scripts/vitest-count-gate.cjs

key-decisions:
  - "nodePresentation.GROUNDING_TONE was DELETED, not merely re-typed off the dead Grounding type — it had zero remaining consumers and Req 6 says governance spends no colour, so keeping an exported strict→green / flag→indigo table was the exact partial-deletion hazard T-185-08-02 names"
  - "The deriveTier cross-module glyph-band pin was deleted with the block it lived in: it had a subject only while the canvas rendered a strictness WORD beside the workflow soul's, and graded governance derives from the tool intersection instead. deriveTier's own band mapping stays pinned in deriveTier.test.ts"
  - "ONLY phaseVocabulary.test.ts was re-pinned. The three stale POSITIVE pins the gate reports are deferred against SEED-056 by 185-VALIDATION.md and were left alone — raising a floor is a separate decision from lowering one"
  - "The cause derivation moved DOWN into phaseVocabulary rather than being re-typed beside canvasModel — 185-07's hand-off note makes one client home a hard constraint"
  - "kbTools is threaded as an OPTIONAL toCanvas option defaulting to a module-scope frozen empty list, so an omitted palette marks NOTHING and hands the same reference every call"

patterns-established:
  - "Absence-asserting source guard: when a deletion removes something a ?raw guard pinned as PRESENT, invert the assertion in place (with a positive control) rather than deleting the it() — the coverage count holds and the guard now protects the deletion"

requirements-completed: []

# Metrics
duration: 57min active, across two runs separated by a ~3h40m interruption
completed: 2026-07-30
---

# Phase 185 Plan 08: The Word-Badge Deletion and the Page Wiring Summary

**The shipped 3-face grounding word-badge is gone from the tree — function, type, colour table, all ten call sites and all three retired strings — badge slot 1 is empty and reserved for 188/189, the canvas node data now carries governance as two flat booleans resolved once, the author's 🔒 gate row is synthesized client-side from a route that could never have answered, and the measuring stick was re-pinned 42 → 33 in the same commit as the deletion with the number read from the gate's own output.**

## ⚠ THIS PLAN WAS EXECUTED ACROSS AN INTERRUPTION

A first executor completed Tasks 2 and 3 and was interrupted partway through Task 1, leaving
`phaseVocabulary.ts` modified but uncommitted and its test file broken. A second executor finished Task 1.
**Which commit came from which run:**

| Commit | Task | Run | Timestamp (+0400) |
|---|---|---|---|
| `814879b3` | **Task 2** — the canvas carries `grounded` and `armed`; badge slot 1 is freed | Run 1 (interrupted) | 2026-07-29 21:39:47 |
| `d3b19858` | **Task 3** — synthesize the locked gate row and close the governance write | Run 1 (interrupted) | 2026-07-29 22:01:41 |
| `30cb77f9` | **Task 1** — delete the word-badge and re-pin the gate | Run 2 (this one) | 2026-07-30 02:25:08 |

Tasks therefore committed **out of numerical order** (2 → 3 → 1), which is safe only because Task 1 is
purely subtractive and Tasks 2/3 had already removed every consumer. It is recorded here because
`git log` alone reads as if the plan ran backwards.

**What Run 2 inherited as uncommitted work-in-progress**, reviewed and kept: the `groundingFor()` /
`Grounding` / `GROUNDINGS` deletion from `phaseVocabulary.ts`, replaced by a docblock explaining that
Req 6 leaves slot 1 empty. That edit was correct and was finished rather than redone.

**What Run 2 still had to do** — the three outstanding items, plus one the plan's inventory missed:

1. `phaseVocabulary.test.ts` still imported and exercised `groundingFor` — **the suite was broken at
   the inherited state.** Deleted the stale import, the stale docblock bullet and the whole
   `describe("phaseVocabulary.groundingFor …")` block (9 `it()`s), plus the `deriveTier` / `TIERS`
   import that existed only to serve that block's cross-module pin.
2. `scripts/vitest-count-gate.cjs` had not been re-pinned — the deletion was sitting on a live
   `[count-decrease]`.
3. `PhaseFormPanel.tsx:98`'s docblock still named the deleted function.
4. **NOT IN THE PLAN'S INVENTORY:** `nodePresentation.ts` imported the deleted `Grounding` type and
   HEAD was red on typecheck (34 errors vs the 33 baseline). See Deviations.

## THE PIN — old, new, and where the number came from

| | Value |
|---|---|
| **OLD pin** (`phaseVocabulary.test.ts`) | **42** |
| **NEW pin** | **33** |
| **Pinned total** | **424 → 415** |
| **Where the new number came from** | **The gate's own `actual` column**, printed by `node scripts/vitest-count-gate.cjs` run BEFORE the pin edit. It reported the file at `pinned 42 · actual 33 · delta -9` and named the violation `[count-decrease] phaseVocabulary.test.ts — pinned 42, ran 33 (-9)`. The `33` was copied out of that output. It was **not** hand-computed, and the 9 deleted `it()` blocks were never counted by eye to derive it. |

The gate's before/after per-file readings for the file in question:

```
BEFORE the pin edit (deletion in place):
  phaseVocabulary.test.ts                      42      33      -9      ← [count-decrease], gate exit 1
AFTER the pin edit:
  phaseVocabulary.test.ts                      33      33       0
  -------------------------------------------------------------
  total                                       415    1577   +1162
```

`WorkflowCanvas.test.tsx` was **not** re-pinned — see Deviations, item 2.

## THE L-9 ACCEPTANCE PROOF — `git show --stat` for the deletion commit

The plan's own criterion is that the commit lists **both** `phaseVocabulary.ts` **and**
`scripts/vitest-count-gate.cjs`. Quoted verbatim:

```
$ git show --stat --format="%h %s" HEAD
30cb77f9 feat(185-08): delete the grounding word-badge and re-pin the gate

 .../src/components/workflows/PhaseFormPanel.tsx    |  9 ++-
 .../components/workflows/PhaseNodeCard.test.tsx    | 14 +++-
 .../src/components/workflows/PhaseNodeCard.tsx     | 12 +--
 .../src/components/workflows/nodePresentation.ts   | 61 +++++++--------
 .../components/workflows/phaseVocabulary.test.ts   | 87 +++-------------------
 .../src/components/workflows/phaseVocabulary.ts    | 87 +++++-----------------
 scripts/vitest-count-gate.cjs                      | 20 ++++-
 7 files changed, 94 insertions(+), 196 deletions(-)

$ git show --stat --name-only --format="" HEAD | grep -E "phaseVocabulary\.ts|vitest-count-gate\.cjs"
frontend/src/components/workflows/phaseVocabulary.ts
scripts/vitest-count-gate.cjs
```

✅ Both present in ONE commit. A deletion that landed without its pin edit would leave HEAD red; a pin
edit that landed without the deletion would leave the gate blind to the *next* deleted test.

## THE FIELDS PLANS 185-09 AND 185-10 CONSUME

Both live on `PhaseNodeData` in `frontend/src/components/workflows/canvasModel.ts`, resolved **once** in
`buildPhaseData` through named total helpers (`isGrounded` / `isArmed`), values **copied** never spread
(`canvasModel.purity.test.ts` pins that node data must not alias the phase object):

| Plan | Field | Line | Resolver | Notes for the consumer |
|---|---|---|---|---|
| **185-09** (corner seal) | **`PhaseNodeData.grounded: boolean`** | `canvasModel.ts:131` | `isGrounded(phase, kbTools)` → `groundingCauseOf(phase, kbTools) !== null` | Render as **SHAPE at top-right**, never colour, never a word-badge. Must **not** read `status` — the seal is identical across idle / running / needs-you / failed (criterion 16). |
| **185-10** (detour edge) | **`PhaseNodeData.armed: boolean`** | `canvasModel.ts:139` | `isArmed(phase)` → `actionRiskArmed(phase)` | **READ-ONLY on the canvas.** No `role="button"`, no `tabIndex`, no click handler — `PhaseNodeCard` forbids any focusable control inside the card (criterion 24). Arming happens in the panel only. |

**A gap 185-10 must plan for:** `CanvasEdgeData` still carries only `{ kind: CanvasEdgeKind }`. There is
no `armed` on the EDGE. The detour renderer must read `armed` off the **target node's** `PhaseNodeData`,
or 185-10 adds the field to `CanvasEdgeData` itself. Nothing in this plan reserved it.

Supporting plumbing this plan added, which both consumers depend on:

- **`toCanvas(definition, { kbTools })`** — `kbTools` is **optional**; omitted resolves to a module-scope
  frozen empty list, so an unread palette marks **NOTHING** rather than un-marking a locked step
  (D-185-09; the run-time gate is server-side and unconditional either way).
- **`<WorkflowCanvas kbTools={…} />`** — the page hands **one** value to **three** readers (`gatesFor`,
  `rails.kbTools`, the canvas prop), read off `useGroundingBundle` on **both** honest readings
  (`ready` **and** `unavailable`).
- **`phaseVocabulary.groundingCause` / `groundingCauseOf` / `GroundingCause` / `GROUNDING_DIAL_TYPES`** —
  the ONE client home for the cause and its total order. **Do not re-derive the intersection anywhere
  else**; thread the boolean or call the adapter.

## Performance

- **Duration:** ~57 min active (Run 1 ≈ 22 min to `d3b19858`; Run 2 ≈ 35 min), separated by a ~3 h 40 m
  interruption
- **Completed:** 2026-07-30T02:25:08+04:00
- **Tasks:** 3
- **Files modified:** 17 (0 created)
- **Net:** the deletion commit alone is **−196 / +94 lines**

## Accomplishments

- **The deletion is TOTAL, and it is greppable.** `grep -rn "groundingFor\|GROUNDINGS" frontend/src`
  returns **0**, including docblocks and test prose. `grep -rn "Must cite its sources\|Flags uncited
  claims\|No sources needed" frontend/src` returns **0** — SPEC criterion 14. Four dangling docblock
  references that a function-name grep would have left behind were each rewritten rather than left to rot
  (`phaseVocabulary.ts`'s section header, `PhaseFormPanel.tsx:98`, `PhaseNodeCard.tsx`'s `BadgeSlot`, and
  `nodePresentation.ts`'s module docblock).
- **The colour table went with the badge it coloured.** `nodePresentation.GROUNDING_TONE` mapped
  `strict → success (green)` / `flag → primary` / `open → muted` for the deleted chip and had **zero**
  remaining consumers. Req 6 says governance spends **no colour**; leaving a live exported
  three-face-in-colour table would have been a reading 188/189 could pick up — precisely the
  partial-deletion hazard **T-185-08-02** frames. Its `?raw` source guard was **inverted in place** to
  assert the absence, with a positive control, so `PhaseNodeCard.test.tsx` held at **49** tests.
- **Badge slot 1 is empty and reserved, and a third badge is still a typecheck error.** `PhaseNode.tsx`'s
  assembly is now `data.waitsForYou ? [waitsForYou] : []`, with a comment naming who the freed slot
  belongs to. `BadgeSlots`' max-2 tuple union is intact — governance *physically cannot* spend this
  surface's badge budget.
- **The author now sees the consequence of their tool choice before running, from data the client already
  held.** `gatesFor(phase, kbTools)` emits one locked `GOVERNANCE_GATE_ROW_LABEL` row when the cause is
  `detected` or `escalated`, and nothing for `already-set` (that gate belongs to the citation-policy
  control). **Nothing waits on `/workflows/validate`** — D-185-19 recorded verbatim in the docblock and
  guarded by a test with a positive control, because `ValidateResponse(ok, verdicts)` carries a list of
  PROBLEMS with no channel for "here is a gate that will run", and a passing gate produces nothing.
- **The write chain is closed end to end.** `onGovernanceChange` is a `useCallback` in `onPhaseChange`'s
  exact shape, passed **inside** the existing `{...(canvasEnabled ? { rails } : {})}` spread-conditional —
  the D-14 mechanism — so the flag-off Spine surface is unchanged by construction rather than by promise.
- **The measuring stick moved honestly, once, for a documented reason.** The pin edit rode in the
  deletion's commit, the number came out of the gate's own output column, and the script's header now
  carries the rule in prose: *a pin is lowered ONLY alongside a deliberate, plan-authorized deletion —
  never to make a red gate go quiet.*

## Task Commits

1. **Task 1: Delete the word-badge and re-pin the gate, in ONE commit** — `30cb77f9` (feat) — *Run 2*
2. **Task 2: Thread `grounded` and `armed` onto the node data; free badge slot 1** — `814879b3` (feat) — *Run 1*
3. **Task 3: The page — synthesize the locked row and close the write chain** — `d3b19858` (feat) — *Run 1*

## Files Created/Modified

**Task 1 (`30cb77f9`, this run) — 7 files, −196 / +94:**

- **`phaseVocabulary.ts`** — `GROUNDINGS`, `groundingFor` and the `Grounding` interface deleted (−65
  lines), replaced by an 8-line comment stating that Req 6 leaves slot 1 empty, who it belongs to, and
  that the signal still reaches the face as `PhaseNodeData.grounded`. `waitsForYou` untouched. The
  section header's "This section REPLACES `groundingFor`" rewritten so no deleted identifier is named.
- **`phaseVocabulary.test.ts`** — the `groundingFor` describe (9 `it()`s) deleted, the `groundingFor`
  import and the `deriveTier` / `TIERS` import removed, the docblock's slot-1 bullet removed and replaced
  by a paragraph recording *why* the cross-module pin went and where `deriveTier`'s band mapping is still
  pinned. **42 → 33 tests.**
- **`nodePresentation.ts`** — `GROUNDING_TONE`, the `Grounding` import and the now-unused `ChipTone`
  import deleted; the module docblock's four stale claims rewritten (it no longer advertises a tone
  mapping, and the 184-03 extraction paragraph now says three, not four).
- **`PhaseNodeCard.test.tsx`** — the `:389` presence assertion inverted to an absence assertion with a
  positive control; the describe renamed "all four" → "the surviving three"; a comment explaining that
  `GROUNDING_TONE` stays in the `:377` no-second-copy regex because the guard's job flips to
  *no-resurrection*. **49 → 49 tests.**
- **`PhaseNodeCard.tsx`** — docblock only: `BadgeSlot.testId`'s example and the `tone` field's
  domain→tone note no longer name the deleted table or the deleted `[data-grounding]` wrapper.
- **`PhaseFormPanel.tsx`** — docblock only, **1 prose bullet**: `gates` is now described as derived from
  the grounding CAUSE and synthesized client-side per D-185-19. **Zero logic entered the file** — the
  G-5 mount-point-only budget is intact.
- **`scripts/vitest-count-gate.cjs`** — the pin `42 → 33` with a 2-line why-comment, `BASELINE_TOTAL`'s
  trailing comment `424 → 415`, a 12-line header paragraph recording the re-pin and the never-to-quiet-a-
  red-gate rule, and `[total-below-baseline] numTotalTests < 424` corrected to `< BASELINE_TOTAL`.

**Tasks 2 and 3 (`814879b3`, `d3b19858`, Run 1) — 11 files.** Read from their diffs and commit messages:

- **`canvasModel.ts`** — `PhaseNodeData.grounding: Grounding` → `grounded: boolean` + `armed: boolean`,
  resolved in `buildPhaseData` via `isGrounded` / `isArmed`; `toCanvas` gained
  `options.kbTools?: readonly string[]` defaulting to a module-scope frozen empty list. **`fromCanvas`
  needed zero changes** — it carries phases through by reference.
- **`phaseVocabulary.ts`** (+134 lines in `814879b3`) — the cause derivation moved DOWN here as the ONE
  client home: `GroundingCause`, `GROUNDING_DIAL_TYPES`, `GroundingInputs`, `groundingCause` (flat-input
  core, branch order `detected → already-set → escalated`), `groundingCauseOf` (phase-shaped adapter,
  reading `available_tools` / `citation_policy` defensively off the loose JSONB shape), and
  `actionRiskArmed`.
- **`PhaseNode.tsx`** — grounding badge removed from the `badges` tuple; slot 1 documented as
  deliberately empty.
- **`WorkflowCanvas.tsx`** — optional `kbTools` prop, handed down by the page.
- **`canvasModel.test.ts`** (26 → 33), **`WorkflowCanvas.test.tsx`** (31 → 33, incl. *"NO phase node
  carries a grounding chip — slot 1 is empty and reserved"*), **`canvasModel.fixtures.test.ts.snap`**
  (−252/+ lines as the 3-face object left every fixture node).
- **`WorkflowBuilderPage.tsx`** — `groundingFor` import dropped; `gatesFor(phase, kbTools)` rewritten
  with D-185-19 verbatim in its docblock; `kbTools` on the `rails` `useMemo` read off **both** honest
  bundle readings; `onGovernanceChange` added and passed inside the `canvasEnabled` spread-conditional.
- **`WorkflowBuilderPage.canvas.test.tsx`** (22 → 77, +174 lines) — 5 new page cases including the
  D-185-19 no-`/validate` guard with a positive control; **`WorkflowBuilderPage.header.test.tsx`** and
  **`PhaseFormPanel.rails.test.tsx`** — two shipped source guards re-anchored on the conditional rather
  than on the rails object being one key wide, and the `"Must cite its sources"` fixture labels replaced
  with the imported `GOVERNANCE_GATE_ROW_LABEL`.

## Decisions Made

- **`GROUNDING_TONE` was deleted, not re-typed.** The one-line fix for the typecheck break was
  `Record<"strict" | "flag" | "open", ChipTone>`. Rejected: the table's only purpose was colouring the
  deleted badge, it had no consumers left, and Req 6 states governance spends no colour. A surviving
  exported three-face colour reading is the drift T-185-08-02 exists to prevent, and it would have sat
  there looking usable to 188/189.
- **The `deriveTier` cross-module pin died with its subject.** It asserted that the canvas grounding
  glyph and the workflow-soul strictness glyph agree on the MIDDLE band. Graded governance renders no
  strictness word on the canvas at all and derives from the tool intersection rather than
  `citation_policy`, so there is no second reading left to agree with. `deriveTier`'s own band mapping
  stays pinned in `deriveTier.test.ts` (9 tests, delta 0), and the test file's docblock records the
  removal and its reason so a later reader does not read the gap as an oversight.
- **Only one pin moved.** See Deviations item 2.
- **The absence-asserting guard keeps its `it()`.** Deleting the `:386` test would have dropped
  `PhaseNodeCard.test.tsx` from 49 to 48 — invisible to the gate (the file is unpinned, reporting as
  `new`) and a silent coverage loss of exactly the kind D-184-08 exists to catch. Inverting the assertion
  in place holds the count and converts the guard into protection *for* the deletion.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `nodePresentation.ts` imported the deleted `Grounding` type — HEAD was red on typecheck, and the file is NOT in the plan's deletion inventory**

- **Found during:** Task 1 verification (`npx tsc -b`)
- **Issue:** The plan's `<interfaces>` block presents itself as "THE COMPLETE DELETION INVENTORY
  (re-verified 2026-07-29)" and lists nine files. It **misses a tenth**:
  `frontend/src/components/workflows/nodePresentation.ts:55` carries
  `import type { Grounding } from "@/components/workflows/phaseVocabulary"`, consumed at `:87` by
  `export const GROUNDING_TONE: Record<Grounding["mode"], ChipTone>`. With `Grounding` deleted, `tsc -b`
  reported **34** errors against the **33**-error baseline — a NEW error naming a workflow file:
  `nodePresentation.ts(55,15): error TS2305: Module '"@/components/workflows/phaseVocabulary"' has no
  exported member 'Grounding'`. The plan's own acceptance grep (`groundingFor|GROUNDINGS`) could never
  have caught this, because the dangling symbol is the **type**, whose name matches neither needle.
- **Fix:** Deleted `GROUNDING_TONE`, the `Grounding` import and the orphaned `ChipTone` import; rewrote
  the module docblock's four stale claims; inverted the `PhaseNodeCard.test.tsx` guard that pinned
  `GROUNDING_TONE`'s presence; corrected two stale docblock lines in `PhaseNodeCard.tsx`.
- **Files modified:** `nodePresentation.ts`, `PhaseNodeCard.test.tsx`, `PhaseNodeCard.tsx`
- **Commit:** `30cb77f9` (the same commit — a split would have left HEAD red)
- **Note for the verifier:** `tsc -b` is back to **33**, byte-identical to the pre-plan baseline, with
  **0** errors naming any file in `files_modified` or any file this plan touched.

**2. [Scoped reading, not a substantive deviation] `WorkflowCanvas.test.tsx` was NOT re-pinned, though the plan's artifact contract asks for it**

- **Found during:** Task 1, reading the gate output
- **Issue:** The plan's `must_haves.artifacts` entry for `scripts/vitest-count-gate.cjs` says
  *"re-measured pins for phaseVocabulary.test.ts **and WorkflowCanvas.test.tsx**"*, and its Task-1 action
  repeats it. But `185-VALIDATION.md` §"Count-gate posture" lists `WorkflowCanvas.test.tsx` 31 → 33 among
  **three stale POSITIVE pins explicitly deferred** and tracked against SEED-056, alongside
  `canvasModel.purity.test.ts` 69 → 79 and `WorkflowBuilderPage.canvas.test.tsx` 22 → 77. Those pins were
  already stale **before** this phase began.
- **Resolution:** `185-VALIDATION.md` §"Count-gate posture" governs — it is the document that defines
  what "pass" means for this gate in this phase, and it defers these three by name with a re-open
  trigger. Only `phaseVocabulary.test.ts` was re-pinned. It is also the only one whose edit is
  **load-bearing**: it is the sole pin that would otherwise leave a live `[count-decrease]` in HEAD.
  Lowering a pin (this plan) and raising a floor (the deferred three) are different decisions with
  different risk.
- **Residual cost, recorded so the deferral carries its price:** leaving `WorkflowCanvas.test.tsx` pinned
  at 31 while it runs 33 means a future deletion of up to **2** tests in that file would go unseen; the
  equivalent blind spots are 10 tests (`canvasModel.purity`) and 55 tests
  (`WorkflowBuilderPage.canvas`). Recommend the next phase touching this suite raise all three.

No Rule 1 fix, no Rule 2 fix and no Rule 4 question arose in Run 2. No package was installed, no
migration was written, no architectural change was made.

## Authentication Gates

None.

## Verification Evidence

| Check | Result |
|---|---|
| `grep -rn "groundingFor\|GROUNDINGS" frontend/src` | **0 lines** ✅ |
| `grep -rn "Must cite its sources\|Flags uncited claims\|No sources needed" frontend/src` | **0 lines** ✅ (SPEC criterion 14) |
| `grep -c "waitsForYou" phaseVocabulary.ts` | **1** ✅ (criterion: ≥ 1 — badge slot 2 untouched) |
| `grep -rn "GROUNDING_TONE" frontend/src` | only the two guard assertions + one docblock note; **0 declarations** ✅ |
| `git show --stat HEAD` lists `phaseVocabulary.ts` AND `scripts/vitest-count-gate.cjs` | ✅ **both, one commit** (quoted above) |
| `npx vitest run phaseVocabulary.test.ts` | **33 passed / 0 failed** ✅ |
| `npx vitest run PhaseNodeCard.test.tsx phaseVocabulary.test.ts` | **82 passed / 0 failed** ✅ (49 + 33 — `PhaseNodeCard` count held) |
| `npx vitest run WorkflowCanvas.test.tsx canvasModel.test.ts PhaseFormPanel.rails.test.tsx canvasModel.purity.test.ts` | **170 passed / 2 failed** — both pre-existing axe failures, see below |
| `npx vitest run WorkflowBuilderPage.canvas.test.tsx WorkflowBuilderPage.header.test.tsx` | **91 passed / 1 failed** — `header` **15/15 green**; the 1 is a pre-existing 5 s timeout, see below |
| `npx tsc -b` (whole repo) | **33 errors — byte-identical to the pre-plan baseline; 0 name any file this plan touched** ✅ |
| `npx eslint` over all 6 source files touched in Run 2 | **clean, exit 0** ✅ |
| `npx vite build` | **exit 0**, built in 24.26 s ✅ |
| `git diff --stat -- backend/ supabase/migrations` | **0 files** ✅ (ZERO migrations; live head stays **113**) |
| `git diff --name-only 66326244..HEAD -- agent_loop.py tool_dispatcher.py openai_service.py anthropic_service.py` | **0 files** ✅ (the L-10 / D-14 Deep-path fence) |
| `git diff --diff-filter=D HEAD~1 HEAD` | **no file deletions** ✅ |

### Binding vocabulary — criterion 15, word-boundary anchored

Anchored with `\b…\b` because bare `Proven` false-hits inside *improvement* and bare `N/A` hits inside
paths. Exactly what was run:

```
for t in Proven Ungoverned Unchecked "Not applicable" "N/A"; do
  grep -rioE "\b${t}\b" frontend/src/components/workflows frontend/src/pages/WorkflowBuilderPage.tsx | wc -l
done
```

| Banned term | Raw hits | In a USER-VISIBLE string? |
|---|---|---|
| *Proven* | 4 | **0** — ordinary English in 3 comments/docblocks (`"…is proven to have been necessary"`, `"Two claims are proven here"`, `"one-shot emission is proven — spike-097"`) |
| *Ungoverned* | **0** | 0 ✅ |
| *Unchecked* | 1 | **0** — `PhaseNodeCard.tsx:241` code comment (`"…would render an unchecked node as a checked-and-clean one"`) |
| *Not applicable* | **0** | 0 ✅ |
| *N/A* | 1 | **0** — `GovernanceSection.test.tsx:411`, inside the guard's **own** `BANNED_TERMS` list |

**0 in user-visible strings for all five.** ✅ Required terms, `grep -rF` over `frontend/src`:
**Must prove it → 5** · **Free to think → 4** · **Nothing to prove here → 3** — all ≥ 1 ✅

### Count gate

`node scripts/vitest-count-gate.cjs` — **total 1577 · failed 38 · pinned total 415**.

Applying `185-VALIDATION.md` §"Count-gate posture" rather than `exits 0`:

1. **No `[count-decrease]`** ✅ — the load-bearing one. `phaseVocabulary.test.ts` at **33/33, delta 0**.
2. **No `[total-below-baseline]`, no `[missing-file]`** ✅ — 16/16 pinned files present; total 1577 vs
   pinned 415.
3. **No NEW failing test in any file this plan touched** ✅ — established by isolation runs, because the
   full-suite reading is not trustworthy here (below).
4. **The re-pin landed in the same commit as the deletion, number read from the gate's output** ✅ —
   proven by the `--stat` above.

`[failing-tests]` is the sole remaining reason and is the KNOWN pre-existing block (SEED-056). **Not
chased — out of scope.**

### The full-suite failure count is not a usable signal, measured three times this session

| Run | Tree | total failed |
|---|---|---|
| before the pin edit | deletion in place | **23** |
| after the pin edit | *identical except one integer in a `.cjs` file* | **54** |
| final | + the `nodePresentation` fix | **38** |

A pin number cannot change a test outcome, so **23 → 54 on an effectively identical tree** is direct
evidence of the churn `185-VALIDATION.md` already records (34 → 35 → 40 → 24 → 22). Isolation runs are
therefore the signal that was used. Every failure observed in isolation is a **timeout or an
infrastructure error, never an assertion failure**:

- `WorkflowCanvas.test.tsx` — 2: *"has no axe violations on a rendered canvas"* times out at 5000 ms
  (axe takes 8500 ms under jsdom), and *"…on the empty state"* then fails with **"Axe is already
  running"** — a pure cascade of the first leaving axe's global lock held. The Req-6 load-bearing case,
  *"NO phase node carries a grounding chip"*, **passes**.
- `WorkflowBuilderPage.canvas.test.tsx` — 1: *"clicking Canvas flips aria-selected…"* (`:244`) times out
  at 5000 ms. This is a **pre-existing** flag-ON door test from 183/184, not one of `d3b19858`'s five new
  cases, and `185-07-SUMMARY.md` already recorded this file at exactly **1** failure. The file did grow
  22 → 77 tests, which lengthens the run (161 s) and raises timeout pressure on every case in it —
  recorded honestly as an indirect cost rather than claimed as unrelated.
- `WorkflowBuilderPage.header.test.tsx` — **15/15 green in isolation**; its 4 failures in the full run
  were load artefacts.
- `canvasModel.test.ts` (33), `PhaseFormPanel.rails.test.tsx` (27), `canvasModel.purity.test.ts` (79),
  `phaseVocabulary.test.ts` (33), `PhaseNodeCard.test.tsx` (49) — **all fully green**.

## Issues Encountered

**The plan's "COMPLETE DELETION INVENTORY" was not complete** — see Deviation 1. It cost the typecheck
differential and one extra file pair. The general lesson: an inventory built by grepping a *function*
name misses call sites that import only the *type*, and the acceptance criteria inherited the same blind
spot. `npx tsc -b` was the only check that caught it.

**The frontend suite is not green and was not green before this plan** — SEED-056 rot, 38 failures at the
final reading across `PublishGauntlet` (18), `WorkflowBuilderPage.canvas` (10 in-suite / 1 isolated),
`WorkflowBuilderPage` (5), `WorkflowCanvas.composition` (5), `WorkflowBuilderPage.header` (4 / 0
isolated), `WorkflowCanvas` (4 / 2 isolated), `WorkflowCanvas.editing` (3), `PhaseSpineGraph` (2),
`StepTypePicker` (2), `revertByteIdentical` (1). Nothing added, nothing fixed (executor scope boundary).

**The suite was broken at the inherited state.** `phaseVocabulary.test.ts` could not compile against the
uncommitted `phaseVocabulary.ts`. Recorded because it means the interruption left the tree in a state
where a naive `git stash` or a partial commit would have shipped a red HEAD.

## Known Stubs

None. Every value introduced is a real field, a real total function or a real prop, and every one is
consumed: `grounded` and `armed` are resolved in `buildPhaseData` and asserted in `canvasModel.test.ts`;
`kbTools` flows page → `gatesFor` + `rails` + canvas; `onGovernanceChange` reaches
`builderStore.setGovernance` and writes the definition.

**One deliberate emptiness, by the plan's own design:** **badge slot 1 renders nothing**, and
`PhaseNodeData.grounded` / `.armed` are carried but **not yet drawn**. That is Req 6 (governance spends no
badge slot) plus this plan's explicit objective — *"This plan renders NO new canvas mark. The seal lands
in plan 185-09; the detour in 185-10."* The fields are asserted in the model suite, so a dropped wire is
observable before either surface exists.

## Threat Flags

None. No new network endpoint, no auth path, no file access pattern, no schema change at a trust
boundary. Frontend only; `git diff --stat -- backend/ supabase/migrations` is **0 files**.

- **T-185-08-01** (the client-synthesized locked row, `accept by design`) — delivered as framed. The row
  is a **prediction** rendered to the author; it authorizes nothing and blocks nothing. The gate that
  runs is synthesized server-side at the run seam and is unreachable from the page. A wrong prediction is
  a display bug.
- **T-185-08-02** (the removed word-badge, `mitigate`) — delivered, and **the threat fired**. The
  register named partial deletion as "the real hazard"; the plan's inventory then missed
  `nodePresentation.ts`, and only `tsc -b` caught it. Both the function/string greps **and** a clean
  typecheck differential are now the evidence. `GROUNDING_TONE`'s removal closes the colour half.
- **T-185-08-03** (the flag-off Spine surface, `mitigate`) — delivered. `onGovernanceChange` rides the
  existing `{...(canvasEnabled ? { rails } : {})}` spread-conditional, so a flag-off render is unchanged
  by construction (D-181-01 / D-14). `PhaseFormPanel.rails.test.tsx` (27) and
  `revertByteIdentical.test.tsx` (7, delta 0) both green.
- **T-185-08-04** (the test measuring stick, `mitigate`) — delivered exactly as specified: the pin edit
  is in the deletion's commit, verified by `--stat`, and the number was read from the gate's output. The
  script's header now states the rule so the next reader cannot mistake a quiet-the-gate edit for this
  one. **Residual, recorded above:** three deferred positive pins leave 2 / 10 / 55 tests of blind spot
  in three other files (SEED-056).

## User Setup Required

None — frontend only, no environment variable, no migration. Live migration head stays at **113**.

## Next Phase Readiness

- **185-09 (the corner seal) reads `PhaseNodeData.grounded`.** Top-right of the card is CLAIMED for
  governance. Two hard invariants from the shipped card: **no focusable control inside `PhaseNodeCard`**
  (the ✕ and ＋ live on the lane), and **a third badge is a typecheck error** — the seal is neither a
  badge nor a control. The seal markup must **not** read `status` (criterion 16).
- **185-09 still carries the 137-B rebuild as a blocker for acceptance criterion 23** (D-185-17). The
  verdict mark moves to `-left-2 top-1.5` so the seal can keep top-right; `padding-top` 34 → 42 and
  `NODE_MIN_HEIGHT` 96 → 104. **Nothing in plan 185-08 touched `PhaseNodeCard.tsx` beyond two docblock
  lines**, so that geometry work is entirely still owed.
- **185-10 (the detour edge) reads `PhaseNodeData.armed`** — and must resolve the gap named above:
  `CanvasEdgeData` carries only `{ kind }`, so read `armed` off the target node or add the field. The
  edge rides the `edgeTypes` entry `flow` that `WorkflowCanvas.tsx` already registers; no net-new canvas
  infrastructure. The mark is **read-only**: no `role="button"`, no `tabIndex`, no click handler
  (criterion 24).
- **Do not re-derive the KB intersection anywhere.** `phaseVocabulary.groundingCause` /
  `groundingCauseOf` is the ONE client home. Thread the boolean, call the adapter, or read the panel's
  `data-cause` off `[data-testid="rail-governance"]`.
- **`toCanvas`'s `kbTools` is optional and omitting it marks NOTHING.** Any new `toCanvas` call site that
  needs the seal to appear must pass the list; a forgotten argument silently un-seals every node. The
  page already threads one value to all three readers.
- **The count-gate pin for `phaseVocabulary.test.ts` is now 33.** Any further deletion in that file needs
  the same same-commit re-measure. The three deferred positive pins (SEED-056) are the recommended first
  chore for the next phase that opens this suite.
- **`GROUNDING_TONE` is gone.** If 188/189 needs a node-level tone table, it authors its own for its own
  domain — reviving this one would restore a three-face-in-colour governance reading Req 6 deleted.

## Self-Check: PASSED

Files:
- `frontend/src/components/workflows/phaseVocabulary.ts` — FOUND
- `frontend/src/components/workflows/phaseVocabulary.test.ts` — FOUND
- `frontend/src/components/workflows/nodePresentation.ts` — FOUND
- `frontend/src/components/workflows/PhaseNodeCard.tsx` — FOUND
- `frontend/src/components/workflows/PhaseNodeCard.test.tsx` — FOUND
- `frontend/src/components/workflows/PhaseFormPanel.tsx` — FOUND
- `frontend/src/components/workflows/canvasModel.ts` — FOUND
- `frontend/src/components/workflows/PhaseNode.tsx` — FOUND
- `frontend/src/pages/WorkflowBuilderPage.tsx` — FOUND
- `scripts/vitest-count-gate.cjs` — FOUND

Commits:
- `30cb77f9` — FOUND (Task 1, Run 2)
- `814879b3` — FOUND (Task 2, Run 1)
- `d3b19858` — FOUND (Task 3, Run 1)

---
*Phase: 185-graded-governance-per-node-grounding-mode-action-risk-dial*
*Completed: 2026-07-30*
