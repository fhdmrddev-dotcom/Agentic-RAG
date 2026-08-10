---
phase: 188
plan: 06
subsystem: canvas-run-reading
tags: [wave-5, RUNVIZ-01, ring-geometry, greyscale-clause, seal-invariance, zero-glyphs, card-budget]
requires:
  - "188-05 — `CanvasReading` and `canvasReading()` are imported, never re-typed; the prototype-key lesson it measured is applied again here, in the same shape, before it could bite"
  - "185-09 — the ⛨ seal block, its `?raw` props fence and its byte-identical render loop; this plan widened the loop and left the block byte-unchanged"
  - "184-03 — the `status` slot, declared opaque on purpose so 188 could narrow it without breaking a caller"
provides:
  - "frontend/src/components/workflows/runVocabulary.ts — the canvas's OWN words: RUN_READING_WORD, runReadingWord, runReadingClause, runReadingLabel, RUN_READING_BORDER/runReadingBorder, RingSpec + RING_GEOMETRY + ringSpecFor + ringDash"
  - "NodeRunStatus narrowed from `string` to `CanvasReading` — the 184 seam paid off with zero broken callers"
  - "The status ring: seven readings, seven distinct arc SHAPES, all separable with colour switched off"
  - "The run line: one <p> at every reading, so no card changes height mid-run"
  - "The pause chip: two 3×9px rectangles — the phase ships ZERO net-new glyphs anywhere"
  - "The ⛨ seal proved byte-identical at all SEVEN readings, including `unknown`"
  - "frontend/src/index.css — one `ringspin` keyframe + `.canvas-ring-spin`, animation guarded behind prefers-reduced-motion"
affects:
  - "188-07 — `PhaseNode` threads `status` + `emitFailure`; both props are typed and documented, and `RUN_MODE_NODE_MIN_HEIGHT` is card-local so the adapter passes nothing extra"
  - "The `WorkflowCanvas` aria-label append — `runReadingLabel` is the one function the page should call, so the canvas stays a pass-through with no vocabulary import"
  - "Phase 189 — badge slot 1, `technicalLine` and `stepNumber` are ALL still unspent; 188 declined `technicalLine` explicitly rather than leaving it ambiguous"
tech-stack:
  added: []
  patterns:
    - "Describe an arc as FRACTIONS of the circumference plus a gap-centre path position, and compute every emitted decimal — the expected decimals then live only in the test, where they falsify the formula instead of copying it"
    - "Place an SVG gap with `stroke-dashoffset`, never with a rotation: an attribute transform composes with `transform-box`/`transform-origin` and pivots about a DOUBLED offset (the falsification below reproduces exactly 0.5C of error)"
    - "Exclude colour from the signature a distinctness assertion compares — that omission IS the greyscale acceptance clause, expressed as a type"
    - "A discriminated `RingSpec` union keeps `{kind:\"none\"}` and `{kind:\"solid\"}` apart at compile time, so *Not started* and *Complete* cannot collapse into each other"
    - "Strip comments before a source fence, so a docblock may name the utility it forbids while the class lists may not (the 187-24 trap, solved instead of dodged)"
    - "Name a concentric pair and skip it explicitly in a bounding-box zone check, then assert the RADIAL clearance a rectangle cannot express — never loosen the check"
    - "Widen a shipped 4-value invariance loop by DERIVING the list from a compiler-forced `Record<Union, true>`, so the next union member cannot be under-covered"
key-files:
  created:
    - frontend/src/components/workflows/runVocabulary.ts
  modified:
    - frontend/src/components/workflows/PhaseNodeCard.tsx
    - frontend/src/components/workflows/PhaseNodeCard.test.tsx
    - frontend/src/index.css
decisions:
  - "D-188-06-A: `runReadingClause` uses an exhaustive `Record<CanvasReading, string|null>` for the fixed clauses rather than a `switch` with a `default:` arm. Forced by an acceptance grep and kept because it is strictly better — an eighth reading is now a TYPECHECK ERROR here, where a `default:` would have silently absorbed it as 'no clause'."
  - "D-188-06-B: the arc's stroke table (`RING_STROKE`) lives in `PhaseNodeCard.tsx`, not in `runVocabulary.ts`. The vocabulary module holds what a reading MEANS — word, clause, arc shape — all of which survive colour being switched off. A stroke is a paint detail of one SVG. The BORDER table is the one colour value that does live there, because what needed a documented home was not its three tokens but its four ABSENCES."
  - "D-188-06-C: the ring/well pair is recorded in the occupancy table as CONCENTRIC BY DESIGN and skipped by name in the zero-overlap loop, with its exact 3844px² rectangle intersection pinned in the five-mark check and a 3px RADIAL clearance asserted separately. The plan's 'assert zero overlaps' is not achievable for an annulus around a disc, and loosening the check would have opened the same door for everything else."
  - "D-188-06-D: `technicalLine` is DECLINED, and the decline carries a positive control proving the slot is still wired — 'declined' means the adapter does not pass it, not that the card lost the ability."
metrics:
  duration: ~75 min
  completed: 2026-08-05
  tasks: 3
  commits: 3
---

# Phase 188 Plan 06: The Status Ring and the Run Line Summary

The 62px icon well is now the status dial, every node states its own truth in its own card, and the seven readings are proved separable **with colour switched off** — by shape properties a machine asserts, not by a screenshot anyone eyeballed.

## What Was Built

### Task 1 — `frontend/src/components/workflows/runVocabulary.ts` (`fe231911`, +371 / −0)

The canvas's own words, and nothing else. Two type-only imports; zero derivation; zero glyphs.

| Export | What it is |
|---|---|
| `RUN_READING_WORD` | the seven LOCKED words (D-188-04) |
| `runReadingWord` | the TOTAL accessor over that table |
| `runReadingClause` | the clause layer — three fixed clauses plus `failed`'s closed set of three |
| `runReadingLabel` | word + clause, **one function for both the visible line and the accessible-name suffix**, so the two cannot disagree |
| `RUN_READING_BORDER` / `runReadingBorder` | the three readings that claim the border; the four absences carry the reason |
| `RingSpec` / `RING_GEOMETRY` / `ringSpecFor` / `ringDash` | the arc as fractions of `C` plus a gap-centre, and the function that computes every emitted decimal |

**The prototype-key lesson was applied before it could bite.** Every table here is a plain object literal, so `TABLE[key] ?? fallback` is not total — 188-05 measured `phaseStatusFromDb("constructor")` returning `[Function Object]`. All four lookups in this module go through one `own()` guard, and the docblock records the observed value rather than the abstract rule.

**The failure clause is an exhaustive `switch` over `EmitFailure`** with a `default` arm returning the weakest of the three claims, so a sixth enum member is a visible decision. `Phase.error` is not a source and does not reach this surface at all.

### Task 2 — the ring, the run line, the border (`c635e39f`, +364 / −39)

`NodeRunStatus` went from `export type NodeRunStatus = string` to `= CanvasReading`. **The 184 seam paid off exactly as D-184-06 predicted: narrowing it broke no caller, because 184 shipped none.**

- **The ring** — a 72×72 sibling of the 3D mark, rendered immediately before it, concentric with the 62px well at `top-[-31px]` (`−26 − (72−62)/2`). A track for every reading; an arc for six of seven. `overflow-visible` on the `<svg>`; `aria-hidden`; `pointer-events-none`; `z-[5]` below the seal and the verdict.
- **The pause chip** — two `<span>` rectangles of 3×9px inside the 12-o'clock gap, for the waiting reading only. **Not the double-bar character.** The suite asserts its text content is the empty string, so a glyph could not sneak in.
- **The run line** — one `<p>`, `line-clamp-2`, rendered whenever a reading is supplied *including* `not-started`, with `RUN_MODE_NODE_MIN_HEIGHT = 120` applied for the whole run view. `CANVAS_LAYOUT` untouched.
- **The border** — one prepended branch, three readings; `done`, `not-started`, `skipped`, `unknown` fall through unchanged.
- **`index.css`** — `@keyframes ringspin` beside its siblings; `.canvas-ring-spin` (with `transform-box: view-box` and `transform-origin: 36px 36px`) in `@layer utilities`; the animation itself inside `prefers-reduced-motion: no-preference`.

The ⛨ seal block is **byte-unchanged** — verified by extracting the `{grounded ? ( … ) : null}` slice from `HEAD` and from the working tree and diffing: 14 lines, no difference.

### Task 3 — the guards (`60cddc78`, +728 / −34)

`PhaseNodeCard.test.tsx`: **68 → 105 cases.** Six blocks, appended not woven in.

1. **Seal at SEVEN** — driven off a compiler-forced `Record<CanvasReading, true>`, so an eighth reading cannot be added without this loop growing. It now also asserts the seven **cards** are all different, which is what makes the seven identical seals a measurement rather than a tautology.
2. **The greyscale clause** — a `RingSignature` type that deliberately has **no `stroke` member**. Seven signatures, pairwise distinct, plus the unique property per reading: only `not-started` has no arc, only `done` has an arc with no dash pattern, only `running` spins, only `waiting-for-you` carries the chip, only `failed` has four dash numbers, and `skipped`/`unknown` differ by dash ratio. A separate test proves colour *also* differs — asserted apart, so deleting it would not weaken the greyscale block.
3. **Geometry falsification** — the UI-SPEC decimals, spelled literally, in the only place in the repository they appear. Plus: each pattern sums to `C`; the waiting offset re-derives 12 o'clock from the DOM's own numbers; and a fence proves neither producing module contains any of the decimals, with four positive controls.
4. **The build rules** — a comment-stripping fence for the clipping ban and the no-rotation rule.
5. **The card budget** — zero badge slots (the badge row is byte-identical at all seven readings), `technicalLine` declined *with* a control that the slot still works, `stepNumber` unrendered in run mode, one tab stop per node at every reading, the ring announcing nothing.
6. **Concentricity** — the ring/well pair recorded, its 3844px² rectangle intersection pinned, and the 3px radial clearance asserted from the DOM's own `r` and the well's own width class.

## THE FALSIFICATIONS — three, all observed RED, all reverted

A guard nobody has watched fail is a gesture. Verbatim output (ANSI stripped):

**A. Two readings given the same ring shape** (`unknown` set to `skipped`'s `5 7`):

```
 × the seven signatures are PAIRWISE DISTINCT with colour excluded from the compare
 × `skipped` and `unknown` are both fully patterned, at DIFFERENT dash/gap ratios
AssertionError: expected 6 to be 7 // Object.is equality
AssertionError: expected 5 to be less than 5
Tests  2 failed | 103 passed (105)
```

**B. The waiting gap moved from 12 o'clock to 6 o'clock** (`gapCentre: 0.75 → 0.25`):

```
 × `waiting-for-you` emits the dasharray/dashoffset the formula predicts
 × the waiting gap really is centred at 12 o'clock, computed not eyeballed
AssertionError: expected '132.45' to be '25.635'
AssertionError: expected 53.40650000000002 to be close to 160.22122533307947,
                received difference is 106.81472533307945, but expected 0.005
Tests  2 failed | 103 passed (105)
```

**Read that difference: `106.815` is exactly `0.5C`.** A gap placed half a circumference from where it belongs is precisely the signature of the composed-transform bug D-188-07 exists to prevent, reproduced here from a one-token change — which is why the offset assertion earns its place.

**C. The seal dimmed at ONE reading only** (`reading === "unknown" ? "opacity-40" : ""` planted on the seal):

```
 × renders a BYTE-IDENTICAL seal at ALL SEVEN readings (the strongest jsdom form)
AssertionError: expected '<span data-testid="canvas-node-seal" …' to be '<span data-testid="canvas-node-seal" …'
Tests  1 failed | 104 passed (105)
```

**This is the one that justifies D-188-04.** The planted condition fires only at `unknown`, so the shipped FOUR-value loop — `idle / running / needs-you / failed` — would have stayed green through it. Widening to seven is not bookkeeping: `unknown` is exactly the reading a fail-open hides behind, and the guard was blind to it until this plan.

All three files were restored (`git diff --stat` empty against the committed state) and the suite re-run green at 105 before committing.

## Verification

| Criterion | Result |
|---|---|
| `grep -c 'Paused for your answer' runVocabulary.ts` = 1 | ✅ **1** (after a reword — § Deviations 1) |
| `grep -c 'Waits for you' runVocabulary.ts` = 0 | ✅ **0** (ditto) |
| `grep -Ec '⤳\|‖\|⋯' runVocabulary.ts` = 0 | ✅ **0** — zero net-new glyphs, and the branch arrow is never spelled |
| No raw DB status literal / `phase_index` | ✅ **0** (after a restructure — § Deviations 1) |
| The UI-SPEC decimals absent from the source | ✅ **0** in `runVocabulary.ts` AND `PhaseNodeCard.tsx`, asserted in the suite too |
| `runVocabulary.ts` imports = exactly 2, both type-only | ✅ `@/lib/phaseState`, `@/types` |
| Arithmetic reproduces the expected decimals | ✅ `55.543 158.085` · `158.085 55.543` / `25.635` · `89.724 17.090 89.724 17.090` / `18.158` |
| `grep -c 'export type NodeRunStatus = string'` = 0 | ✅ **0** |
| `grep -Ec 'rotate(\|transform='` on the card = 0 | ✅ **0**, plus a source fence with both positive controls |
| `grep -c 'phase.error\|{error}'` on the card = 0 | ✅ **0** |
| `grep -Ec 'tabIndex\|onClick\|<button'` on the card = 0 | ✅ **0**, and the DOM walk is green at all seven readings |
| `grep -c 'canvas-node-seal'` = 1, seal block byte-unchanged | ✅ **1**; the extracted 14-line block diffs clean against `HEAD` |
| `grep -c 'ringspin' index.css` ≥ 1, animation reduced-motion guarded | ✅ **2** — the keyframe, and the class inside `prefers-reduced-motion: no-preference` |
| `npx tsc --noEmit -p tsconfig.app.json` = 33 | ✅ **33** at every task, and the error **set** is byte-identical to the pre-edit baseline (`diff` empty) |
| `npx vitest run src/components/workflows/PhaseNodeCard.test.tsx` | ✅ **105 passed (105)**, up from the 68 pinned |
| `npx vitest run src/components/workflows/` | ✅ **34 files / 2037 passed** |
| `node scripts/vitest-count-gate.cjs` | ✅ exit **0** · total **2287** · **failed 0** · 26/26 pinned · `PhaseNodeCard.test.tsx 68 → 105 (+37)`, no per-file decrease |
| Seal loop iterates 7 readings incl. `unknown` | ✅ derived from a 7-member exhaustive table; both asserted in-test |
| Suite contains `55.543` `158.085` `25.635` `89.724` `17.090` `18.158` | ✅ all six |
| Every `?raw` absence has a positive control | ✅ 9 controls across the three fence blocks |
| `git diff --name-only HEAD -- supabase/migrations/` empty | ✅ zero migrations |
| No file deleted | ✅ `git diff --diff-filter=D --name-only HEAD~3 HEAD` empty |
| No `git add -A`; `.planning/STATE.md` untouched | ✅ every commit staged by explicit path; the pre-existing `.claude/**` dirt untouched |
| No `git stash` | ✅ the `tsc` baseline was captured BEFORE any edit; falsifications used file copies and were restored by copy-back |

## Deviations from Plan

### 1. [Rule 3 — blocking] The acceptance greps for `runVocabulary.ts` failed on this plan's own prose, four times

The first draft returned `Paused for your answer: 3`, `Waits for you: 1`, `db literals: 3`, `decimals: 1` — every one of them a docblock, not code. **This is the 187-24 lesson recurring for the fourth time in this phase**, and two of the four are worth naming because they are not obvious:

- `spending` **contains** `pending`. Two sentences about the accent budget tripped the DB-status grep.
- `case "skipped":` matches `skipped["']\s*:`. That arm was a `CanvasReading` switch, not a DB literal — but the fix is better than the grep asked for: the fixed clauses now live in an exhaustive `Record<CanvasReading, string|null>`, so **an eighth reading is a typecheck error** where a `switch` with a `default:` would have silently absorbed it (D-188-06-A).

Every fence now returns its number honestly rather than by exemption, and each reworded comment says in-line why it is worded that way, so the next author does not "improve" it back.

### 2. [Rule 3 — blocking] Two shipped assertions were forced by Task 2 and edited there, not in Task 3

Task 2's acceptance says *"the shipped 68 cases still pass"*. **That is not achievable, and could not have been**, because Task 2 is the plan chartered to make the card render for `status`:

- **A runtime failure.** `renders BYTE-IDENTICAL DOM whether status / stepNumber are passed or not` passed `status: "running"` and asserted the HTML was unchanged. Its RED output is the best single record of what this plan did, and the diff is quoted in the commit: `min-height: 104px → 120px`, `border-border/50 → border-primary`, a run line reading `Running`, and the whole ring subtree with `stroke-dasharray="55.543 158.085"` and `class="canvas-ring-spin"`. Narrowed to `stepNumber` only, on 184-08's exact terms and in its voice.
- **A typecheck failure.** The seal loop's `"idle"` and `"needs-you"` are not readings, so narrowing `NodeRunStatus` broke them (`error TS2322`, exactly one new error against the 33 baseline). Re-spelled as the union members they always meant, keeping the loop at four; Task 3 then widened it to seven for its own, separate reason.

Both are recorded at the assertions themselves rather than only here.

### 3. Measured correction — `grep -c 'overflow-hidden'` on the card was **1 at HEAD**, not 0

The plan's acceptance ("returns 0") and its verification block (`grep -rn` over the card and the adapter "returns nothing") were **false before this plan started**:

```
$ git show HEAD:frontend/src/components/workflows/PhaseNodeCard.tsx | grep -c 'overflow-hidden'
1
```

The single occurrence is inside the shipped comment that **forbids** the utility. So the criterion could only be satisfied by deleting the rule — the D-ITEM-183-02 trap this file's own docblocks name half a dozen times.

Resolved the way the file already resolves it for `dangerouslySetInnerHTML` and the tint identifiers: the fence is anchored on the USE FORM. `stripComments()` removes block and line comments, and the fence asserts the token appears zero times in the remaining CODE of **both** the card and the adapter, with a control proving the stripper strips and the needle matches. A second test pins the prose count at exactly **1** — so the rule is now as hard to delete as the utility is to add. This plan added no second mention: its own ring comment points at the existing rule instead of restating it.

### 4. [Rule 2 — completeness] The occupancy table's new row could not assert "zero overlaps" as written

The plan says *"The ring spans x 94…166; the seal 222…243; the verdict −8…14 — assert zero overlaps."* True of those three. But the table also contains the **icon well** at 99…161 × −26…36, which the ring's box (94…166 × −31…41) **completely encloses** — because the ring is an annulus and the well sits in its hole. The measured intersection is 62 × 62 = **3844px²**, and it is not a collision in any sense a reader would recognise.

Handled as a named exception with its own assertions (D-188-06-C), never by loosening the check:

- the zero-overlap loop skips the pair **by name** (`CONCENTRIC_BY_DESIGN`), so nothing else can slip through the same door;
- the five-mark check **lists it with its exact area**, so the ring drifting off-centre changes that number;
- a dedicated test asserts the 5px inset on all four sides and the **3px radial clearance** between the arc's stroke circle (`d = 68`, read from the DOM's own `r`) and the well (`62`, read from its own size class) — the check a rectangle cannot make.

### 5. [Rule 1 — house rule] Two card docblock paragraphs still claimed `status` renders nothing

`EXTENSIBILITY SEAM #1` and `WHAT 184-08 CHANGED` both asserted that `status` is declared and paints nothing. `PhaseNode.tsx:182-186` states the standing rule for exactly this: *a comment that still names a slot the component now fills is the same defect as a false docblock.* Both corrected in Task 3's commit, with the superseded sentence quoted so the correction is legible rather than invisible.

### 6. `RING_STROKE` sited in the card, not in the vocabulary module

The plan lists five exports for `runVocabulary.ts` and the arc's stroke colour is not among them. Rather than silently widening that contract, the table lives beside the one element it paints, with the boundary stated in both files (D-188-06-B). The reasoning is the greyscale clause itself: the vocabulary module holds what survives colour being switched off.

## Known Stubs

None. Every line is live: the card renders the ring, the chip and the run line from the vocabulary module's real functions, and all 105 cases drive the real component with no mock anywhere in the file. The one thing NOT yet wired is the adapter — `PhaseNode` does not pass `status` or `emitFailure` until plan 188-07, which is that plan's whole subject and is stated as such in the props docblock.

## Threat Flags

None. Every register entry was handled as specified:

- **T-188-06-01** (tampering — the ⛨ seal) — **mitigated, and the mitigation bit.** The block is byte-unchanged (verified by slice diff), the props fence and its positive control are untouched, and the identity render went 4 → 7. Falsification C proves the widening is load-bearing: the planted defect fires only at `unknown`, which the old four-value loop did not visit.
- **T-188-06-02** (information disclosure — the run line) — **mitigated.** The line renders `runReadingLabel(...)`, a closed set of fixed strings. The harness's free-form failure text is not a source anywhere in the render path; `grep -c 'phase.error\|{error}'` is 0, and the closed-set-of-three clause behaviour is asserted over all five enum members plus the null case.
- **T-188-06-03** (tampering / XSS — authored title and subtitle) — **accepted as planned.** No `dangerouslySetInnerHTML`, no `innerHTML`; the shipped house fence still applies and is still green.
- **T-188-06-04** (usability DoS — the ring animation) — **mitigated.** One keyframe behind `prefers-reduced-motion: no-preference`. Safety is by construction, not by fallback, and it is asserted: with motion suppressed `running` covers 26% of the ring and `waiting-for-you` 74% plus a chip — both pinned to three decimal places.
- **T-188-SC** (supply chain) — **accepted.** Zero packages installed; `package.json` and both lockfiles untouched; no registry component added.

No security-relevant surface outside the register was introduced: no endpoint, no auth path, no file access, no schema change.

## Commits

| Task | Commit | Files | Diff |
|---|---|---|---|
| 1 | `fe231911` | `workflows/runVocabulary.ts` | +371 / −0 |
| 2 | `c635e39f` | `workflows/PhaseNodeCard.tsx`, `index.css`, `workflows/PhaseNodeCard.test.tsx` | +364 / −39 |
| 3 | `60cddc78` | `workflows/PhaseNodeCard.test.tsx`, `workflows/PhaseNodeCard.tsx` | +728 / −34 |

## Notes for the Next Plan

- **`runReadingLabel` is the only door for words.** The UI contract's aria-label append (`${node.ariaLabel} — ${run.label}`) must receive an ALREADY-WORDED string from the page, so `WorkflowCanvas` imports no vocabulary and derives nothing. Calling `runReadingLabel` inside the canvas would put a second vocabulary consumer inside the G-5-capped file.
- **`emitFailure` is a NEW prop and 188-07 must thread it**, or every failed node reads *"Failed — this step did not finish"* — which is honest but is the weakest of the three clauses, so a real emit failure would be under-reported.
- **Do not `useCallback`-forget the run lookup.** The `settledNodes` memo is split from the drag overlay on purpose; an inline arrow at the call site is a new identity every render and defeats it (PATTERNS § WorkflowCanvas).
- **`PhaseNodeCard.test.tsx` is pinned at 68 and now runs 105 — re-pin it at 105 in 188-11**, read from the gate's `actual` column across two agreeing runs. The still-outstanding stale-low pins flagged by 188-02/04/05 remain owed: `PhaseReconcile.test.tsx` reads 12 against a pin of 2, and several `src/components/workflows` suites now run far above their pins (`canvasModel.purity` 143 vs 69, `phaseVocabulary` 96 vs 33, `canvasModel.roundtrip` 517 unpinned).
- **The concentric exception is named, not implicit.** If a later phase adds a mark inside the ring, it joins `CONCENTRIC_BY_DESIGN` **with its own radial assertion** — the skip list is not a tolerance and must never become one.
- **Colour is the fourth carrier and must stay fourth.** The greyscale block's `RingSignature` has no `stroke` member by design. A future author who "simplifies" it by folding the stroke in would silently retire the build criterion sketch 153-A won on.
- **Badge slot 1, `technicalLine` and `stepNumber` are all still unspent.** 189 inherits three free slots and a card that is now type-forbidden from growing a third badge.

## Self-Check: PASSED

- All four files exist on disk: `frontend/src/components/workflows/runVocabulary.ts`, `frontend/src/components/workflows/PhaseNodeCard.tsx`, `frontend/src/components/workflows/PhaseNodeCard.test.tsx`, `frontend/src/index.css` — plus this summary.
- All three commits resolve in `git log`: `fe231911`, `c635e39f`, `60cddc78`.
- `git diff --diff-filter=D --name-only HEAD~3 HEAD` is empty — this plan deleted no file.
