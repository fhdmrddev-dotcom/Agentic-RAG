---
phase: 189
plan: 10
subsystem: frontend-canvas-run-vocabulary
tags: [wave-4, d-16, d-07, d-17, wr-04, compiler-forced, whole-table-invariants, falsification-plants, greyscale-build-criterion]
requires:
  - "189-08 — `CanvasReading` widened, ARMING seven exhaustive tables as typecheck errors. This plan's worklist was compiler-generated, not hand-listed."
  - "189-UI-SPEC.md §4b — the eighth ring shape, DECIDED upstream with its reasoning. Implemented, not re-derived."
  - "frontend/src/components/workflows/runVocabulary.ts — the canvas vocabulary (188-06), and its BUILD CRITERION docblock"
  - "scripts/vitest-count-gate.cjs — `src/components/workflows` is a DIRECTORY target, so a new suite there runs on creation"
provides:
  - "RUN_READING_WORD['recorded-not-sent'] = 'Not sent — recorded' (D-16, byte-exact, em dash by codepoint)"
  - "STATIC_CLAUSE row = null, with the reason recorded at the table"
  - "RING_GEOMETRY's 8th row — dash .15 / gap .10 / repeats 4 / gapCentre .125 / spinning FALSE"
  - "RING_STROKE's 8th row — the muted token, the ONE typecheck-forced edit inside the fenced card subtree"
  - "RUN_READING_BORDER's FIFTH deliberate absence, recorded in the docblock AND pinned by a test"
  - "runVocabulary.test.ts — the module's FIRST suite (23 cases), carrying three whole-table invariants that existed nowhere"
  - "CARD_READING_SHAPES' 8th row — CAPTURED from the rendered DOM, observed twice, md5-identical"
affects:
  - "189-11 (the engine write that produces the slug this plan now words and draws)"
  - "189-16 (U3 — the DRIVEN greyscale row; this plan proves the attribute half only)"
  - "the tree's tsc baseline: 40 → 33. The seven armed errors are CLOSED."
tech-stack:
  added: []
  patterns:
    - "a compiler-generated worklist consumed to exhaustion — the seven TS2741 were the plan, and `tsc == 33` is the completion signal"
    - "whole-table invariants over row assertions, so the NINTH member inherits every guard without a pin being remembered"
    - "literal counts DERIVED from the union (five `7`s → `ALL_READINGS.length`), so growth reads as growth and not as regression"
    - "a DOM capture spliced programmatically from a twice-observed dump, so no captured value is ever retyped by a human"
    - "six wrong fixes planted into production source, each observed RED, each restored by md5"
decisions:
  - "The eighth ring was IMPLEMENTED, not designed. UI-SPEC §4b fixed all five numbers and its reasoning was preserved clause by clause in the table's docblock. Every number it predicted was independently recomputed before being trusted, and every one matched — including the dashoffset 16.022 and the four gap centres .125/.375/.625/.875, none of which is 0.75."
  - "⚠ `runVocabulary.test.ts` DID NOT EXIST. The plan lists it under `files_modified`; it is a NEW FILE. Created in `src/components/workflows`, which is a DIRECTORY entry in the gate's TARGETS — so it RAN on creation and TARGETS was NOT edited. Measured, not assumed. See Deviations #1."
  - "⚠ `PhaseNode.test.tsx` is a SEVENTH file the plan's `files_modified` omits, and it is NON-OPTIONAL: its `ALL_READINGS` is one of the seven armed TS2741. `tsc == 33` is unreachable without it. See Deviations #2."
  - "⚠ `WorkflowRunPage.test.tsx` IS listed in `files_modified` and needed NO edit. It has no `Record<CanvasReading, …>`; it drives readings as opaque strings through a stub. Touching it to satisfy the manifest would have been a change with no reason. See Deviations #3."
  - "Five literal `7`s were DERIVED from `ALL_READINGS.length` rather than re-pinned at 8. The property is one-shape-per-reading, not the number seven; a literal makes the ninth reading read as a regression. Beyond the plan, and the reason is recorded at each site."
  - "The card-subtree fence covers SIX NAMED SOURCE MODULES, not the directory. `runVocabulary.ts` itself already sits in that directory and outside the fence, so its suite is not a seventh fenced file. `CARD_SUBTREE_PATHS` is UNMOVED at 6 and its list has a zero-line diff across the whole plan."
metrics:
  duration: "~80 min"
  completed: 2026-08-07
  tasks: 2
  commits: 2
  files_created: 1
  files_modified: 5
  tests_added: 25
---

# Phase 189 Plan 10: The Canvas Word and the Eighth Ring Summary

**The governed not-sent terminal now has a word that cannot be read as success and a ring
that cannot be confused with the seven it joins — and the seven typecheck errors 189-08
armed are closed, `tsc` back to 33.** Six wrong fixes were planted into production source
and every one went RED, including a ring that spun, a gap that stole 12 o'clock, and a
stroke that claimed success.

## The two commits

| # | SHA | Task |
|---|---|---|
| 1 | `d240836f` | The D-16 word, the `null` clause, the recorded border absence |
| 2 | `5b2cc2e1` | The eighth ring, the muted stroke, three whole-table invariants |

**Whole-plan scope — six files, one of them new:**

```
$ git diff --stat d240836f~1..HEAD
 frontend/src/components/workflows/NodeRunOverlay.tsx    |   6 +
 frontend/src/components/workflows/PhaseNode.test.tsx    |  13 +-
 frontend/src/components/workflows/PhaseNodeCard.test.tsx| 202 +++++++++-
 frontend/src/components/workflows/runVocabulary.test.ts | 420 +++++++++++++++++
 frontend/src/components/workflows/runVocabulary.ts      |  91 ++++-
 scripts/vitest-count-gate.cjs                           |  54 ++-
 6 files changed, 765 insertions(+), 21 deletions(-)

$ git diff --diff-filter=D --name-only d240836f~1..HEAD   →  (empty; no deletions)
```

---

## ⚠ THE HEADLINE: the compiler-generated worklist, consumed to exhaustion

| Point | `npx tsc --noEmit -p tsconfig.app.json` |
|---|---|
| Inherited from 189-08 | **40** (re-derived before any edit) |
| After Task 1 (the two word tables) | **38** |
| After Task 2 (the remaining five) | **33 — THE BASELINE** |

```
$ npx tsc --noEmit -p tsconfig.app.json | grep -c "recorded-not-sent"
0
```

**All seven armed `TS2741` are closed**, and each was re-derived by symbol before being
touched — every one of 189-08's cited line numbers HELD:

| # | Site cited by 189-08 | Verified | Closed in |
|---|---|---|---|
| 1 | `runVocabulary.ts:61` `RUN_READING_WORD` | ✅ `:61` | Task 1 |
| 2 | `runVocabulary.ts:170` `STATIC_CLAUSE` | ✅ `:170` | Task 1 |
| 3 | `runVocabulary.ts:313` `RING_GEOMETRY` | ✅ `:313` | Task 2 |
| 4 | `NodeRunOverlay.tsx:134` `RING_STROKE` | ✅ `:134` | Task 2 |
| 5 | `PhaseNode.test.tsx:367` `ALL_READINGS` | ✅ `:367` | Task 2 |
| 6 | `PhaseNodeCard.test.tsx:178` `ALL_READINGS_TABLE` | ✅ `:178` | Task 2 |
| 7 | `PhaseNodeCard.test.tsx:2733` `CARD_READING_SHAPES` | ✅ `:2733` | Task 2 |

**189-08's undercount correction is confirmed from the other side.** RESEARCH §B9 counts
four forced sites; there are seven, and the two extra live in canvas TEST files. This plan
could not have reached 33 by following §B9.

---

## The eighth ring, implemented rather than designed

UI-SPEC §4b fixed the shape. **Every number it predicted was recomputed independently
before being trusted, and every one matched:**

```
C = 2π·34 = 213.62830044410595
dasharray  = 32.044 21.363 32.044 21.363 32.044 21.363 32.044 21.363
dashoffset = round3(32.044245 + 10.681415 − 26.703538) = 16.022
tiling     = 4 × (0.15 + 0.10) = 1   ← exactly 1 in IEEE754, verified
gap centres = 0.125 · 0.375 · 0.625 · 0.875   ← 0.75 (12 o'clock) is NOT among them
```

### The eight rendered geometries

| reading | pairs | `stroke-dasharray` | dashoffset | spins |
|---|---|---|---|---|
| `not-started` | 0 | *(no arc element)* | — | no |
| `running` | 1 | `55.543 158.085` | 0 | **yes** |
| `done` | 0 | *(none emitted)* | 0 | no |
| `failed` | 2 | `89.724 17.090 89.724 17.090` | 18.158 | no |
| `skipped` | 1 | `5 7` | 0 | no |
| `waiting-for-you` | 1 | `158.085 55.543` | 25.635 | no |
| `unknown` | 1 | `1.5 6` | 0 | no |
| **`recorded-not-sent`** | **4** | `32.044 21.363 32.044 21.363 32.044 21.363 32.044 21.363` | **16.022** | **no** |

**Four pairs is unclaimed, and the count is what a test asserts.** `failed` — the only
other multi-arc row — emits FOUR dash numbers where this emits EIGHT, so the two rendered
signatures cannot be confused even before arc length (32.0 px vs 89.7 px) is considered.

**Colour spent nothing.** The stroke-set size is **UNMOVED at 5** while the reading set
grew to 8, and that unmoved number is now an assertion rather than an observation.

---

## Three whole-table invariants that existed NOWHERE before

The plan's real deliverable, and each is stated over the table so the **ninth** reading
inherits it without a pin being remembered:

1. **Exact tiling** — `repeats × (dash + gap) === 1` for every `fraction` row. True of all
   seven shipped rows since 188-06 and asserted by nothing until now. It is what stops a
   seam where the pattern wraps, and it is precisely the property a plausible-looking
   `repeats: 3` row would have broken silently. Guarded by a non-vacuity floor so an
   emptied filter cannot satisfy it.
2. **Four-arc uniqueness** — asserted twice, once over the table (`ringDash` output) and
   once over the rendered DOM, with positive controls proving the counter returns 1, 2 and
   0 at every other row.
3. **Pairwise-distinct geometry** — over all eight, with the reading KEY deliberately
   excluded from the compare so distinctness cannot come from the key itself.

Plus a fourth, in the word layer: **pairwise-distinct words**, restated from the literal
`7` as `new Set(values).size === Object.keys(...).length`.

### ⚠ jsdom cannot prove greyscale distinguishability

It applies no CSS and paints nothing. Everything above is the **attribute-level**
distinction. The visual half is **U3, a driven Chrome MCP row in plan 189-16**, and it is
not discharged by this green suite. That sentence is in the test file, not only here.

---

## The captured row — measured, never typed

`CARD_READING_SHAPES` is a DOM capture, so its eighth row was **captured, observed twice,
and spliced programmatically** rather than hand-written:

```
$ md5sum cap1.json cap2.json
134b86c834f9b14c34f609cdd15d93e8  cap1.json
134b86c834f9b14c34f609cdd15d93e8  cap2.json     ← two independent runs, byte-identical
```

**It pins three ABSENCES nothing else in the tree reaches** — and absences are the kind
neither the compiler nor a presence-only fence can see:

| Absence | Captured evidence |
|---|---|
| The border is NOT claimed | the card div ends `border-border/50`, the DEFAULT branch — `RUN_READING_BORDER`'s omission, RENDERED |
| The ring does NOT spin | the arc's `class` is `null` — `spinning: false` reaches the DOM as a *missing attribute* |
| The pause chip is NOT borrowed | no `canvas-node-pause-chip` entry at all |

---

## ANTI-VACUITY: six plants, every one observed RED

All six driven into **production source**, observed, removed, and restored verified by
**md5 against pre-plant backups** with `grep -c "PLANT"` → **0** in both files.

| Plant | The wrong fix | RED |
|---|---|---|
| **P** | the word reads `Complete` | **6 failed** |
| **Q** | an EN dash where the em dash belongs | **3 failed** |
| **R** | the eighth ring SPINS | **5 failed** |
| **S** | `gapCentre: 0.75` — a gap at 12 o'clock | **4 failed** |
| **T** | `repeats: 2` — colliding with `failed` | **9 failed** |
| **U** | the stroke claims success | **2 failed** |

### PLANT P — the phase's stated failure mode, driven

```
AssertionError: the not-sent word must not be the success word:
  expected 'Complete' not to be 'Complete'
6 failed | 6 passed (12)
```

### PLANT Q — the difference a diff cannot show

`Not sent – recorded` (en dash) against `Not sent — recorded` (em dash). Visually near
identical, and **3 failed** — the codepoint assertion is why.

### PLANT T — both new invariants fired at once

```
AssertionError: recorded-not-sent does not tile the circle:
  expected 0.5 to be close to 1
AssertionError: expected [ 'failed', 'recorded-not-sent' ] to deeply equal [ 'failed' ]
9 failed | 144 passed (153)
```

The tiling invariant caught a row that no other check in the tree would have questioned.

### PLANT S — the UI-SPEC's own prediction, confirmed by falsification

`gapCentre: 0.75` produced `dashoffset = -117.496`. UI-SPEC §4b argues `0.125` was chosen
partly to keep the offset positive "like every shipped row"; the plant demonstrates the
alternative really does go negative. **4 failed.**

### ⚠ AND A REAL DEFECT THE PLANTS DID NOT FIND — the tests did

The first splice of the captured row landed in **`CARD_BORDER_SHAPES`**, not
`CARD_READING_SHAPES`: my anchor matched the last object before the target `describe`, and
the three shape matrices are declared in the order readings → verdicts → borders. It was
caught immediately by `expected [ … ] to deeply equal undefined`, then relocated with a
guard asserting the destination precedes `CARD_VERDICT_SHAPES`. **Recorded because the
lesson is general: an anchor chosen by proximity to a `describe` is not an anchor on the
declaration it appears to name.**

---

## Verification

**The plan's `<verification>` block, run:**

```
$ npx vitest run runVocabulary.test.ts PhaseNodeCard.test.tsx WorkflowRunPage.test.tsx PhaseNode.test.tsx
Test Files  4 passed (4)
     Tests  268 passed (268)

$ npx tsc --noEmit -p tsconfig.app.json | grep -c "error TS"
33
```

**The count gate — the COUNT columns, not the `failed` column (D-188.2-DEF-01):**

| Point | total | pinned | files |
|---|---|---|---|
| Baseline, re-derived | **2521** | 2521 | 45/45 |
| After Task 1 | **2533** | 2533 | 46/46 |
| After Task 2 | **2546** | 2546 | 46/46 |

```
count gate OK — 46/46 pinned files present, no per-file decrease, 0 failing.
```

**Pins moved in the SAME COMMIT as their tests, each from two agreeing runs:**

| File | Pin | Why |
|---|---|---|
| `runVocabulary.test.ts` | *new* → **12** → **23** | +12 the word/clause/border half; +11 the three ring invariants, the WR-04 probe and the fail-closed floor |
| `PhaseNodeCard.test.tsx` | 128 → **130** | the rendered four-arc uniqueness + the `EXPECTED_RING` falsification row |

⚠ **No per-file DECREASE anywhere.** `TARGETS` was **not** edited — measured, not assumed:
`src/components/workflows` is a DIRECTORY entry, so the new suite ran the moment it
existed (the gate printed `runVocabulary.test.ts — 12 new` before any pin was written).
This is the **first** entry in that table for which the two-knob trap did *not* apply, and
the note records why.

⚠ **The captured `CARD_READING_SHAPES` row adds ZERO cases** — it is a table existing loops
read. Its absence from the +2 is not an undercount.

### The fenced card subtree — UNMOVED

```
$ git diff --name-only d240836f~1..HEAD -- <the six fenced modules>
frontend/src/components/workflows/NodeRunOverlay.tsx        ← the ONE exception, as planned

$ git diff --stat -- NodeRunOverlay.tsx
 1 file changed, 6 insertions(+)                            ← acceptance was "< 8"

$ grep -o "CARD_SUBTREE_PATHS).toHaveLength(6)" PhaseNodeCard.test.tsx
CARD_SUBTREE_PATHS).toHaveLength(6)                          ← pin UNMOVED
```

`PhaseNodeCard.tsx`, `phaseNodeCardContract.ts`, `ownProperty.ts`, `NodeCornerMarks.tsx`
and `NodeIconWell.tsx` are **untouched**, and the `CARD_SUBTREE_PATHS` list has a
**zero-line diff** across the whole plan.

**On the "no new file in that directory" rule:** `runVocabulary.test.ts` was created there,
and it is **not** a seventh fenced module. The fence is six NAMED SOURCE modules, not the
directory — `runVocabulary.ts` itself already sits in that directory and outside the fence,
as do thirty-odd existing suites. Adding a test file to `CARD_SUBTREE_PATHS` would have
*moved the length pin the plan forbids moving*. The list stays at 6 and the seventeen
negative fences cover exactly what they covered.

### Acceptance greps

| Grep | Required | Got |
|---|---|---|
| `"Not connected"` in `runVocabulary.ts` | 0 | **0** |
| `recorded_not_sent` (snake, D-17) in `runVocabulary.ts` | 0 | **0** |
| `"Waits for you"` in `runVocabulary.ts` | 0 | **0** |
| `toContain("Not")` in the new suite | 0 | **0** — including the docblock |
| ring decimals (`32.044`) in either source module | 0 | **0 / 0** |
| removed lines in `runVocabulary.ts` | prose only | **5, all docblock** — no shipped word or row changed |

### Re-derived, not inherited

| Claim | How | Result |
|---|---|---|
| `tsc -p tsconfig.app.json` = 40 | run before any edit | ✅ **40** |
| count gate 2521 / 45 files | run before any edit | ✅ **2521 / 45** |
| the seven TS2741 line numbers | symbol search, each | ✅ **all seven HELD** |
| UI-SPEC's dasharray / dashoffset | recomputed from `C` | ✅ byte-identical |
| `4 × (0.15 + 0.10) === 1` | IEEE754 check | ✅ **exactly 1** |
| no gap at 12 o'clock | computed from the row | ✅ `.125 .375 .625 .875` |
| `CARD_SUBTREE_PATHS` at 6 | grep + `git diff` | ✅ **UNMOVED** |
| `WorkflowRunPage.test.tsx` is a forced site | grep for `CanvasReading` | ⚠ **IT IS NOT** — see Deviations #3 |
| `runVocabulary.test.ts` exists | `ls` | ⚠ **IT DID NOT** — see Deviations #1 |
| `BASELINE_TOTAL` note = 2508 | gate's own `pinned total` | ⚠ **STALE — 2521.** Corrected |

---

## Deviations from Plan

### 1. [Rule 3 — Blocking] `runVocabulary.test.ts` did not exist; it is a NEW FILE

- **Found during:** Task 1 setup.
- **Issue:** the plan lists it under `files_modified` and its `<verify>` runs it. No such
  file existed — `runVocabulary.ts` shipped in 188-06 with no suite at all; every assertion
  about it lived in `PhaseNodeCard.test.tsx`, reached through a rendered card.
- **Fix:** created. **The two-knob trap was checked rather than assumed**: the gate's
  `TARGETS` carries `src/components/workflows` as a DIRECTORY, so the suite ran on creation
  and `TARGETS` was NOT edited. Pinned in the commit that created it (12), re-pinned in
  Task 2's commit (23).
- **Commits:** `d240836f`, `5b2cc2e1`

### 2. [Rule 3 — Blocking] `PhaseNode.test.tsx` is a 7th file, absent from `files_modified`

- **Found during:** Task 2.
- **Issue:** the plan's `files_modified` names six files. `PhaseNode.test.tsx:367`
  `ALL_READINGS` is **one of the seven armed TS2741**, and the plan's own headline
  acceptance is `tsc == 33`. The two cannot both hold — the same shape 189-08 hit with
  `PhaseTimeline.test.tsx` and 189-07 with `runs.py`.
- **Fix:** the row was added; the file count is **six touched, one of them new**, stated
  rather than smoothed. The edit is one row plus a docblock note recording that the
  compiler-forcing mechanism the file describes actually fired.
- **Commit:** `5b2cc2e1`

### 3. [Documented, not auto-fixed] `WorkflowRunPage.test.tsx` was listed and needed NO edit

- **Found during:** the pre-work sweep.
- **Issue:** it appears in `files_modified` and in Task 2's `<files>`. Measured, it carries
  **no `Record<CanvasReading, …>`** — it drives readings as opaque strings through a stub
  (`reading-${slug}` text nodes) and asserts on named readings only.
- **Resolution:** **not touched.** It was run as part of the plan's `<verification>` and is
  green (268 across the four suites). Editing a file to satisfy a manifest, with no defect
  to fix and no guard to add, is a change with no reason.

### 4. [Rule 1 — Bug, self-caught] The captured row was spliced into the wrong matrix

- **Found during:** Task 2, immediately, by a failing test.
- **Issue:** my splice anchored on the text preceding the target `describe`. The three
  shape matrices are declared readings → verdicts → **borders**, so the object immediately
  before that `describe` is `CARD_BORDER_SHAPES`. The row landed there.
- **Fix:** relocated, with the relocation script asserting its destination sits **before**
  `CARD_VERDICT_SHAPES` rather than trusting a second text match. Verified: the row is at
  `:3392`, inside `CARD_READING_SHAPES` (`:2807`–`:3476`).
- **Commit:** `5b2cc2e1`

### 5. [Rule 2] An UNMEASURED `tsc` claim reached a commit message, and was corrected

- **Found during:** immediately after Task 1's commit.
- **Issue:** the message asserted `tsc 40 → 35`. I had not run it. The measured value is
  **38** (two tables filled, not five).
- **Fix:** amended before anything was built on it, with the correction stated *in* the
  message rather than silently rewritten. **Recorded because it is this project's most
  frequently repeated lesson and I reproduced it**: a number written from reasoning instead
  of from a run is a claim, and claims rot.

### 6. [Rule 2] The `BASELINE_TOTAL` note was stale before this plan opened

- **Found during:** moving the Task 1 pin.
- **Issue:** the marker read `⚠ 2508 (BUG-260807-01)` while the gate printed
  `pinned total 2521` on an unmodified tree — a drift of 13, from 189-08's two pins. The
  note is not what the gate reads (`BASELINE_TOTAL` is a `reduce`), which is exactly why
  nothing caught it. This is *correction #1 already recorded in that same comment block,
  recurring in the very next plan*.
- **Fix:** corrected to the measured figure and the recurrence recorded, because a
  hand-written total beside a derived one is a claim and not a check.

### 7. [Rule 2, beyond the plan] Five literal `7`s DERIVED rather than re-pinned at 8

The plan asked for the tables to be filled. Filling them turned five assertions red:
the seal loop's `toHaveLength(7)`, its card-distinctness set, the greyscale signature set,
the word set, and the matrix total. **Each was rewritten to read `ALL_READINGS.length`
rather than re-pinned at `8`**, with non-vacuity floors so a derived count cannot be
satisfied by an empty union. The property is *one shape per reading*; a literal makes the
ninth reading look like a regression until someone remembers to move it — and the seal
loop's own docblock already *promised* it would grow with the union.

### 8. [Rule 2, beyond the plan] `EXPECTED_RING` gained the eighth row

Not required by the plan. `EXPECTED_RING` is the one place in the repository the ring
decimals are written, and a fence asserts they appear in **neither** producing module. The
new row falsifies the dash formula at a repeat count no shipped row uses, and the fence
still passes (`grep -c "32.044"` → 0 / 0).

### 9. [Rule 2] `NodeRunOverlay.tsx` was trimmed from 9 insertions to 6

The acceptance is "fewer than 8 changed lines". My first comment was 8 lines + 1 row = 9.
The argument was condensed to 5 lines without losing a clause. **Measured after, not
assumed: 6 insertions.**

### 10. Out-of-scope, untouched

`scripts/_uat111*`, `scripts/pm-pack/out/`, `graphify-out/`, `backend/scripts/115_*.json`,
`supabase/` and ~38 `supabase/snippets/Untitled query *.sql` are pre-existing operator
artifacts. **Not staged, not modified, not deleted.** Every file in both commits was staged
individually by path. `supabase/` was not touched, per the executor's standing instruction.

---

## Deferred Issues

None new. Three constraints carried forward:

- **U3 (plan 189-16) is NOT discharged by this plan.** jsdom proves the attribute-level
  distinction only. The greyscale claim — that a person can tell eight rings apart with
  colour off — needs the driven Chrome MCP row.
- **`RUN_READING_BORDER`'s absence is now guarded, but only at the table.** The rendered
  half is pinned by the captured row's `border-border/50`; if the border ternary is ever
  refactored, both need to move together.
- `D-189-DEF-02` (the author-facing rail rendering a capability struck through) is untouched
  and still **189-13**'s.

## Authentication Gates

None.

## Known Stubs

None. Every value added is real and rendered: the word reaches the run line as real text,
the ring reaches the DOM as four measured arcs at a positive offset, and the stroke paints.
Nothing here is a placeholder and nothing is gated behind an unbuilt surface — this plan's
output is what a live run will paint the moment 189-11 writes the slug.

## Threat Flags

None. This plan adds presentational table rows. It opens no route, reads no credential,
makes no request and gains no privilege. Its register is addressed rather than deferred:

| Threat | Disposition | Evidence |
|---|---|---|
| **T-189-23** — Spoofing: a state that reads as success when it is not | **mitigated** | The word is asserted `!== Complete` (PLANT P drove it RED with D-07's own message). The ring is asserted distinct from `done` by arc count, and 40 % of the ring is measured missing from the rendered numbers. `ringSpecFor` still floors on the UNKNOWN ring — asserted `!== RING_GEOMETRY.done` and `.kind !== "solid"` for four inherited keys. The stroke is asserted equal to the muted token, and PLANT U (a success-claiming stroke) went RED. |
| **T-189-24** — Tampering: prototype pollution via `RING_GEOMETRY[reading]` (**WR-04**) | **mitigated** | `ringSpecFor("constructor")` → the unknown ring, with a POSITIVE CONTROL proving the inherited member really is reachable by index (`typeof … === "function"`). The word lookup is pinned the same way and asserted **not** to return the new word — an unrecognised reading must not be reported as a deliberate not-send. ⚠ `runVocabulary.ts` keeps its own module-private `own()` with a different second-parameter type; it was **NOT** merged with `ownProperty.ts`'s, exactly as the threat register requires. |
| **T-189-29** — Repudiation: a BUILD CRITERION silently reduced to seven-of-eight | **mitigated** | The eighth uniqueness bullet was added to the docblock's enumerated list, and the rendered "ONLY…" assertion joins its seven siblings in the greyscale block. The tiling and arc-count properties are asserted over the WHOLE table, not over the new row. |
| **T-189-30** — Tampering: the fenced subtree gaining a file or losing coverage | **mitigated** | `CARD_SUBTREE_PATHS` UNMOVED at 6 with a zero-line diff; only `NodeRunOverlay.tsx` touched inside the fence, at 6 insertions; the other five modules verified untouched by `git diff --name-only` over the whole plan. |
| **T-189-SC** — package installs | accept | This plan installed nothing. |

## Self-Check: PASSED

| Claim | Verified |
|---|---|
| `runVocabulary.ts` carries the word, the clause and the 8th ring row | FOUND |
| `NodeRunOverlay.tsx` carries the `RING_STROKE` row (6 insertions) | FOUND |
| `runVocabulary.test.ts` — 23 cases green | FOUND |
| `PhaseNodeCard.test.tsx` — 130 cases green, captured row at `:3392` | FOUND |
| `PhaseNode.test.tsx` — 26 cases green | FOUND |
| `scripts/vitest-count-gate.cjs` — both pins moved, total 2546 | FOUND |
| `.planning/phases/189-.../189-10-SUMMARY.md` | FOUND |
| commit `d240836f` | FOUND in `git log` |
| commit `5b2cc2e1` | FOUND in `git log` |
| `tsc --noEmit -p tsconfig.app.json` == 33 | **33** |
| no plant residue — `grep -c "PLANT"` over both sources | **0 / 0** |
| no probe residue — `grep -c "TEMP CAPTURE\|CAPTURE_OUT"` | **0** |
| `CARD_SUBTREE_PATHS` still six, pin unmoved | **CONFIRMED** |
