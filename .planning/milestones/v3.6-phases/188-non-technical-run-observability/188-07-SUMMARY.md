---
phase: 188
plan: 07
subsystem: canvas-run-passthrough
tags: [wave-6, RUNVIZ-01, g-5-cap, req-2-fence, req-5-separation, accessible-name, zero-badge-slots]
requires:
  - "188-06 — `runReadingLabel`, `NodeRunStatus = CanvasReading` and the card's `status` / `emitFailure` props; this plan is the adapter half its Known Stubs section named"
  - "188-05 — `CanvasReading`, imported as a type and never re-spelled; its prototype-key lesson already applied inside `runVocabulary`'s `own()` guard, so nothing new was needed here"
  - "184-03 / 184-06 — the `PhaseNode` → `PhaseNodeCard` adapter split, and the `settledNodes` / `dragOverlay` memo split the run merge had to land inside"
provides:
  - "frontend/src/components/workflows/runVocabulary.ts — `NodeRunState { reading, label, emitFailure? }`, the shell↔page contract, with `label` PRECOMPUTED so the canvas can join it to an accessible name while importing no vocabulary"
  - "frontend/src/components/workflows/PhaseNode.tsx — reads ONE `data` field and forwards `status` + `emitFailure`; zero badge slots spent; the slot-contract comment true again"
  - "frontend/src/components/workflows/WorkflowCanvas.tsx — the `runState?:` prop mirror and the `ariaLabel` join, inside a MEASURED 13-insertion / 2-deletion diff against a pinned ≤15/≤4 cap"
  - "PhaseNode.test.tsx 13 → 25 · WorkflowCanvas.test.tsx 35 → 46 — Req 2's fence, Req 5's separation, and the canvas's derives-nothing property, all with positive controls"
affects:
  - "188-08 — the page owns the `phase_index → slug` join, calls `canvasReading()` once and `runReadingLabel()` once, and MUST `useCallback` the `runState` lookup (an inline arrow is a new identity every render and defeats the settled memo)"
  - "Phase 189 — badge slot 1, `technicalLine` and `stepNumber` all still unspent; `technicalLine` is now DECLINED in writing, not merely unused"
  - "The next `WorkflowCanvas.tsx` feature touch — the `PlaneEditingLayer` / `EDIT_AFFORDANCE` extraction remains OWED (see § The G-5 debt that stays owed)"
tech-stack:
  added: []
  patterns:
    - "Carry a PRECOMPUTED label across a diff-capped boundary: the words travel as a field, so the file in the middle imports a type and nothing else — the cap stays honest because the vocabulary genuinely cannot enter"
    - "Split a fence when two vocabularies share a spelling: assert absence for the values that exist in only ONE of them, and prove the shared spellings are the other vocabulary's members — never loosen the check, never delete the words to satisfy it"
    - "Assert 'not a tense variant' as a STEM-set difference in both directions, not as a hand-written inequality — two sentences differing only by inflection have equal stem sets"
    - "Read the needle off the DOM instead of typing it, so a string fence cannot pass because the author typed two matching literals"
    - "Pin a memo SPLIT by slicing the source between the two `useMemo` declarations and asserting the lookup appears in one slice and not the other — a dependency-array grep alone cannot see which memo it landed in"
key-files:
  created: []
  modified:
    - frontend/src/components/workflows/runVocabulary.ts
    - frontend/src/components/workflows/PhaseNode.tsx
    - frontend/src/components/workflows/WorkflowCanvas.tsx
    - frontend/src/components/workflows/PhaseNode.test.tsx
    - frontend/src/components/workflows/WorkflowCanvas.test.tsx
decisions:
  - "D-188-07-A: `NodeRunState` carries `emitFailure` as a third field rather than folding the failure clause into `label` alone. `label` is what the CANVAS needs (one already-worded string for the aria join); `emitFailure` is what the CARD needs (it selects the clause at render). Collapsing them would either force the canvas to word something or force the card to re-derive one — both are the boundary this plan exists to keep."
  - "D-188-07-B: the Req-2 fence is SPLIT rather than weakened. Two of the five raw DB statuses (`fai`+`led`, `skip`+`ped`) are spelled identically to `CanvasReading` members, so 'zero occurrences in the render path' is unachievable in `runVocabulary.ts` without deleting the vocabulary. The four DB-ONLY values are asserted absent from both files; the two shared spellings are asserted absent from the ADAPTER's code (which names no reading at all) and proved to be readings in the words module; and a RENDER fence at all seven readings proves none of the five reaches a person's eyes."
  - "D-188-07-C: the `phase_index` fence on `WorkflowCanvas.tsx` is anchored on stripped-comment CODE with the prose count PINNED at exactly 1. The plan's acceptance grep ('returns 0') was FALSE at HEAD — the shipped `onInsertAt` docblock has named the field since 184-12 — so the literal criterion could only have been met by deleting an explanation. Same resolution 188-06 reached for `overflow-hidden`."
  - "D-188-07-D: `technicalLine` is DECLINED in the adapter's own comment, not merely left unpassed. 188-06 declined it in the card; this records the decision at the one place that would have to spend it."
metrics:
  duration: ~70 min
  completed: 2026-08-05
  tasks: 3
  commits: 3
---

# Phase 188 Plan 07: The Capped Run-State Pass-Through Summary

Run state now reaches the card and the screen reader, and the file it crosses learned nothing:
`WorkflowCanvas.tsx` gained **13 insertions and 2 deletions** against a pinned ≤15/≤4 cap, spells none
of the seven reading words, imports the run type and nothing else, and its suite would go red if any of
that changed.

## THE MEASUREMENT THIS PLAN EXISTS TO PRODUCE

```
$ git diff --numstat -- frontend/src/components/workflows/WorkflowCanvas.tsx
13	2	frontend/src/components/workflows/WorkflowCanvas.tsx
```

Raw, as measured at the end of Task 2 (and reproducible post-commit with
`git diff --numstat def6cddd~1 def6cddd -- frontend/src/components/workflows/WorkflowCanvas.tsx`).
The file was **0/0 for this phase** before Task 2, so the whole budget was available and 13/2 is the
total spend, not an increment. Against the plan's stated minimum of 11/2, the two extra insertions are
`const run = runState?.(node.id)` — hoisted because the value is needed twice, by the `data` merge and
by the `ariaLabel` join — and one docblock line. A first draft measured **14/2**; the prop's docblock
was tightened from five content lines to four rather than spending the headroom, because the cap is
only a guardrail if it is not run to the edge.

## What Was Built

### Task 1 — the shape and the adapter (`b46d988b`, +69 / −9)

**`runVocabulary.ts`** gained exactly one export, `NodeRunState { reading, label, emitFailure? }`.
`label` is `runReadingLabel(reading, emitFailure)` **computed by the page**, and the docblock states the
structural reason it is a field rather than a recomputation: the canvas has to join the sentence to the
node's accessible name, and carrying the words is what lets it do that while importing a type and
nothing else. Because the label is computed once, the visible run line and the announced one are the
same bytes from the same call.

**`PhaseNode.tsx`** reads `const run = data.run as NodeRunState | undefined` — the identical
cast-with-docblock shape `verdict` uses one line above, priced by `PhaseNodeData`'s
`[k: string]: unknown` index signature — and forwards `status={run?.reading}` and
`emitFailure={run?.emitFailure}`. Nothing else in the card call moved.

Two comments were corrected rather than left, which is this file's own standing rule
(*"a comment that still names a slot the component now fills is the same defect as a false docblock"*):

- the badge-slot comment said the freed slot *"belongs to Phase 188 (run state) and Phase 189"*. **188
  has now landed and declined it** — the run channel is the ring's geometry plus a sentence in the body,
  which is exactly why sketch 153-A won — so slot 1 belongs to Phase 189 alone;
- the slot-contract comment listed `status` as *"deliberately NOT passed"*. `status` is removed from
  that list, and `technicalLine` is recorded as **DECLINED** by 188 (UI-SPEC card-budget rule 2), with
  `stepNumber` still unspent and still additionally guarded by D-183-07.

`badges`, the `Waits for you` literal and the `⤳` branch-edge marker are **byte-unchanged** — the diff
over those regions contains only comment lines.

### Task 2 — the capped pass-through (`def6cddd`, +13 / −2)

Five edits, no others:

| # | Edit | Cost |
|---|---|---|
| 1 | `import type { NodeRunState }`, folded into the existing block in alphabetical position | 1 ins |
| 2 | `runState?: (slug: string) => NodeRunState \| undefined` + a 6-line docblock in the `marks` voice | 7 ins |
| 3 | `runState` added to the destructure list | 1 ins |
| 4 | `const run = runState?.(node.id)` and `run` appended to the `data` merge; `runState` added to the dep array | 3 ins / 2 del |
| 5 | `ariaLabel: run === undefined ? node.ariaLabel : \`${node.ariaLabel} — ${run.label}\`` | 1 ins |

Everything lands inside **`settledNodes`**, which excludes `dragOverlay`. The split is the anti-blink
fix and is now pinned by a test that slices the source between the two `useMemo` declarations
(§ Falsification B reproduced the flicker path from a mechanical move and the fence caught it).

The import is **type-only**, so the file's runtime graph is unchanged and the live ESM cycle
(`edgeTypes` holds `FlowEdge`'s VALUE at module scope) is untouched. `runVocabulary` is a leaf with two
type-only imports of its own and imports nothing back.

### Task 3 — the fences (`e48a5fe9`, +508 / −2)

`PhaseNode.test.tsx` **13 → 25**; `WorkflowCanvas.test.tsx` **35 → 46**. Appended as their own blocks,
never woven into the shipped cases, so 187-09's and 183-06's assertions stay legible.

**Req 2 — the render path names no database status.** A stripped-comment `?raw` fence over
`PhaseNode.tsx` and `runVocabulary.ts`, every needle assembled from parts (`["comp","leted"].join("")`),
every absence with a positive control — plus a **render** fence driving all seven readings and asserting
no DB word, no `phase_index` and no slug reaches any card's text with the ⌥ reveal off.

**Req 5 — two facts on one node.** The `llm_human_input` step renders BOTH the shipped design-time badge
and the run-time reading. Both strings are **read off the DOM, never typed**, then asserted unequal,
asserted to differ in words in both directions, and asserted to differ in **stems** in both directions —
which is what makes "not merely a tense variant" a measurement instead of a claim. A source fence adds
that the words module does not carry the badge's literal, with the needle again taken from the DOM.

**The canvas derives nothing.** Zero of the seven reading words in the whole file; the vocabulary
imported type-only and provably not as a value; `@/lib/phaseState` not imported in any form; the step
ordinal absent from CODE with its prose count pinned at one; the memo split pinned by slice; and the
aria join asserted both ways — appended when a reading exists, byte-identical when it does not.

## THE FALSIFICATIONS — five planted defects, all observed RED, all reverted

A fence nobody has watched fail is a gesture. Verbatim (ANSI stripped):

**A. A reading word planted in the canvas's own docblock** (`… a step in flight reads Running`):

```
 × spells NONE of the seven reading words — the vocabulary never entered this file
AssertionError: expected '/**\n * Phase 183-06 Task 2 (CANVAS-0…' not to contain 'Running'
Tests  1 failed | 45 passed (46)
```

**B. The run lookup MOVED into the drag-overlay memo** — the mechanical form of collapsing the split:

```
 × hands each node exactly what the lookup returned for ITS slug, and nothing to the rest
 × distinct readings reach distinct nodes — the lookup is per-slug, not per-canvas
 × merges the run inside the SETTLED memo, never in the drag overlay (the anti-blink split)
 × appends the page's sentence to the shipped label, and leaves other nodes untouched
 × the announced sentence IS the visible one — one function, so they cannot drift
AssertionError: expected 'const settledNodes = useMemo<CanvasNo…' to match /const run = runState\?\.\(node\.id\)/
Tests  5 failed | 41 passed (46)
```

Five assertions, from one relocation — and note the aria tests fell with it. That is the pairing the
`PhaseNode` memo docblock warns about, made visible: the split is not an optimisation, it is where the
run state has to live for the surface to work at all.

**C. The run wording set equal to the design-time badge** (`waiting-for-you` → the badge's two words,
clause dropped) — the exact Req 5 violation:

```
 × the two strings are NOT equal and NOT tense variants of each other
 × the vocabulary module does not carry the badge's literal (source fence)
AssertionError: expected 'Waits for you' not to be 'Waits for you' // Object.is equality
AssertionError: expected '/**\n * Phase 188 Plan 06 (RUNVIZ-01 …' not to contain 'Waits for you'
Tests  2 failed | 23 passed (25)
```

**D. A raw DB word leaked into the vocabulary** (`done: "Complete"` → the database's own past
participle) — caught on BOTH channels, which is the point of having both:

```
 × the VOCABULARY's code names no DB-only status, no ordinal and no derivation
 × renders no database word and no step ordinal, at all seven readings
AssertionError: expected '\nimport type { CanvasReading } from …' not to contain 'completed'
AssertionError: expected 'Search Supplier ContractsSearches and…' not to contain 'completed'
Tests  2 failed | 23 passed (25)
```

**E. The `emitFailure` thread cut** from the adapter — 188-06's explicit warning to this plan:

```
 × the failure clause follows the typed enum, never free-form harness text
AssertionError: expected 'Failed — this step did not finish' to be 'Failed — its answer did not pass the …'
Tests  1 failed | 24 passed (25)
```

The observed wrong value is exactly what 188-06 predicted: the weakest of the three claims, reported for
a real emit failure. Every source file was restored (`git status --short` clean over
`src/components/workflows/` except the two test files) and the suite re-run green before committing.

## Verification

| Criterion | Result |
|---|---|
| `git diff --numstat -- WorkflowCanvas.tsx` ≤ 15 ins / ≤ 4 del | ✅ **13 / 2**, raw line pasted above |
| `grep -c 'NodeRunState' runVocabulary.ts` ≥ 1 | ✅ **1** |
| `grep -c 'data.run' PhaseNode.tsx` = 1 | ✅ **1** |
| `grep -c 'status={' PhaseNode.tsx` = 1 | ✅ **1** |
| `badges` assembly + `Waits for you` byte-unchanged | ✅ the diff over that region is comment lines only |
| `:182-186` comment no longer lists `status`; names `technicalLine` as DECLINED | ✅ both |
| `grep -c 'phase_index\|phaseIndex' WorkflowCanvas.tsx` = 0 | ⚠️ **1 — and it was 1 at HEAD.** Shipped `onInsertAt` prose. Fence re-anchored on CODE (0) with the prose count pinned at 1 — § Deviations 1 |
| `grep -Ec '<the seven reading words>' WorkflowCanvas.tsx` = 0 | ✅ **0**, asserted in-suite over the whole source with positive controls |
| `grep -c 'runState' WorkflowCanvas.tsx` = 5 | ⚠️ **4** — the import spells `NodeRunState`, which a case-sensitive needle does not match. § Deviations 2. Four < five, so no logic leaked |
| No change inside the `dragOverlay` memo | ✅ `git diff` contains no `dragOverlay` line; also pinned by an in-suite source slice |
| `npx tsc --noEmit -p tsconfig.app.json` = 33 | ✅ **33** at baseline and after every task |
| `npx vitest run src/components/workflows/PhaseNode.test.tsx` > 13 | ✅ **25 passed (25)** |
| `npx vitest run src/components/workflows/WorkflowCanvas.test.tsx` > 35 | ✅ **46 passed (46)** |
| `npx vitest run src/components/workflows/` | ✅ **34 files / 2060 passed**, up from 2037 |
| `node scripts/vitest-count-gate.cjs` | ✅ exit **0** · total **2310** · **failed 0** · 26/26 pinned · `PhaseNode.test.tsx 13 → 25 (+12)`, `WorkflowCanvas.test.tsx 31 → 46 (+15)`, no per-file decrease |
| Every `not.toContain` / `not.toMatch` has a positive control | ✅ 14 controls across the five fence blocks |
| `git diff --name-only HEAD -- supabase/migrations/` empty | ✅ zero migrations |
| No file deleted | ✅ `git diff --diff-filter=D --name-only HEAD~3 HEAD` empty |
| No `git add -A`; `.planning/STATE.md` and `.claude/**` untouched | ✅ every commit staged by explicit path |
| No `git stash` | ✅ the `tsc` baseline was taken BEFORE any edit; falsifications were reverted with `git checkout -- <one file>` |

## Deviations from Plan

### 1. [Measured correction] `grep -c 'phase_index' WorkflowCanvas.tsx` was **1 at HEAD**, not 0

The plan's acceptance asks for zero. The shipped `onInsertAt` docblock has named the field since
184-12, explaining what `builderStore.insertPhaseOfTypeAt` renumbers:

```
$ git show HEAD:frontend/src/components/workflows/WorkflowCanvas.tsx | grep -c 'phase_index'
1
```

So the criterion was false before this plan began, and the only way to satisfy it literally would have
been to delete an explanation — the D-ITEM-183-02 trap, and the identical shape 188-06 hit with
`overflow-hidden`. Resolved the same way: the fence asserts zero occurrences in **stripped-comment
code**, and a second assertion **pins the prose count at exactly 1**, so the explanation is now as hard
to delete as the field is to introduce. This plan added no second mention.

### 2. [Measured correction] `grep -c 'runState'` returns **4**, not the acceptance's 5

The plan enumerates the five as *"import type usage, declaration, destructure, merge, dep array"*. The
import line reads `import type { NodeRunState } …` — capital `R` — so a case-sensitive `runState` needle
does not match it, and the honest count is four:

```
815:  runState?: (slug: string) => NodeRunState | undefined
882:  runState,
947:        const run = runState?.(node.id)
966:    [projection.nodes, selectedSlug, showTechnical, editable, marks, runState, nudges, measuredById],
```

The criterion's stated purpose is *"a sixth occurrence means logic leaked in"*. Four is strictly on the
safe side of that, and the four are exactly the four sites the plan names. Recorded rather than
engineered around: adding a comment that spelled the prop would have made the number read 5 without
changing a thing, which is precisely the kind of grep-satisfaction this phase keeps refusing.

### 3. [Rule 2 — completeness] Req 2's fence could not be written as one grep, and was split

The plan asks for *"zero occurrences of the raw DB status literals (`pending`, `active`, `completed`,
`failed`, `skipped` as DB values)"*. Measured at HEAD, `runVocabulary.ts` contains the failure spelling
**10 times** and the bypass spelling **6 times** — every one of them a `CanvasReading` member, because
the two vocabularies share those spellings exactly. A flat grep can only be satisfied by deleting the
words the phase exists to add.

Handled as D-188-07-B, never by loosening:

- the **four DB-only** values (`pen`+`ding`, `act`+`ive`, `comp`+`leted`, `retry`+`ing`) are asserted
  absent from both files' code — none is a reading, so the claim is clean and decidable;
- the **two shared** spellings are asserted absent from the ADAPTER's code (which, measured, names no
  reading at all outside a docblock) and asserted PRESENT in the words module, alongside an assertion
  that no status-mapping symbol (`phaseStatusFromDb`, `DB_PHASE_STATUS`, `canvasReading(`) appears
  there — a DB→reading map is what would have forced the four DB-only needles back in;
- a **render** fence drives all seven readings and asserts none of the five reaches a card's text.

Falsification D confirms the split still bites on both channels from a single planted word.

### 4. [Rule 2 — completeness] The `⌥`-reveal test note: `data.run` is merged on EVERY node in the harness

`renderNodes` now merges `run: opts.run?.(node.id)` unconditionally, mirroring the shell. With `run`
omitted the value is `undefined` on every node, so all 13 shipped 187-09 cases render exactly as before
(verified green immediately after the Task-1 edit, before any new case existed).

### 5. The `PhaseNode.test.tsx` reading list is DERIVED, not typed

The plan says "render a node at each of the seven readings". Implemented off a compiler-forced
`Record<CanvasReading, true>` and `Object.keys`, mirroring 188-06's seal loop, so an eighth
`CanvasReading` member is a typecheck error here rather than a silently under-covered loop.

## The G-5 debt that stays owed

**The `PlaneEditingLayer` / `EDIT_AFFORDANCE` extraction named by `185-10` was deliberately NOT
attempted, and deferring it is a decision, not a closure.** It serves *editing*, which run-viz never
touches; lifting it would risk the live ESM cycle for zero run-viz payoff, and it would have consumed
the very diff budget this plan exists to protect. G-5 is honoured here by the extraction the ledger's
188 row actually names (done in 188-05) plus this pinned cap.

**It is due at the next `WorkflowCanvas.tsx` FEATURE touch.** The seam is unchanged since 185-10 named
it: lift `PlaneEditingLayer` and the exported `EDIT_AFFORDANCE` table into their own module, and the
extracted module must not import back — `WorkflowCanvas` imports `FlowEdge`'s VALUE at module scope for
the `edgeTypes` map.

## Known Stubs

None. Every line added is live and exercised by a real render: the adapter forwards a real reading to
the real card, the canvas hands a real lookup's result to a real node object, and the aria join is
asserted against the DOM React Flow actually produces. The one thing NOT yet wired is the **producer** —
nothing in the app supplies `runState` until the page lands in 188-08, which is that plan's whole
subject and is stated as such in the prop's docblock (`Optional and inert when absent`).

## Threat Flags

None. Both register entries were handled as specified:

- **T-188-07-01** (tampering — canvas scope creep) — **mitigated, and the mitigation bit.** The
  `--numstat` cap is measured at 13/2 and recorded as an acceptance criterion; the `?raw` fence asserts
  zero reading words, a type-only vocabulary import, no derivation-module import and no step ordinal in
  code; the memo split is pinned by source slice. Falsifications A and B prove all three fences fail on
  a planted change.
- **T-188-07-02** (information disclosure — harness identifiers on a business surface) — **mitigated on
  two channels.** Source fences over the adapter and the words module, plus a render fence at all seven
  readings proving no DB word, no ordinal and no slug reaches the face. Every needle is assembled from
  parts so the fence cannot be satisfied by its own source. Falsification D goes red on both.
- **T-188-07-03** (tampering / XSS — authored strings reaching the aria label) — **accepted as planned.**
  `ariaLabel` is a string property on a node object rendered by React Flow as an attribute; no HTML is
  constructed and `run.label` is a closed set of fixed strings, not user input.
- **T-188-SC** (supply chain) — **accepted.** Zero packages installed; `package.json` and both lockfiles
  untouched.

No security-relevant surface outside the register was introduced: no endpoint, no auth path, no file
access, no schema change.

## Commits

| Task | Commit | Files | Diff |
|---|---|---|---|
| 1 | `b46d988b` | `workflows/runVocabulary.ts`, `workflows/PhaseNode.tsx` | +69 / −9 |
| 2 | `def6cddd` | `workflows/WorkflowCanvas.tsx` | **+13 / −2** |
| 3 | `e48a5fe9` | `workflows/PhaseNode.test.tsx`, `workflows/WorkflowCanvas.test.tsx` | +508 / −2 |

## Notes for the Next Plan (188-08, the page)

- **`useCallback` the `runState` lookup.** An inline arrow at the call site is a new identity every
  render, which invalidates `settledNodes` on every parent render and defeats the split this plan just
  pinned. `SkillStudioPage.tsx:104-129` is the in-tree shape.
- **The page builds the whole `NodeRunState`, including `label`.** Call `canvasReading()` once and
  `runReadingLabel(reading, emitFailure)` once, per node. Calling `runReadingLabel` inside the canvas
  would put a second vocabulary consumer inside the G-5-capped file and break the fence at
  `WorkflowCanvas.test.tsx`'s type-only-import assertion.
- **`emitFailure` must reach the page's `NodeRunState`.** Falsification E is the receipt: without it,
  every failed node reads the weakest of the three claims and a real emit failure is under-reported.
- **The `phase_index → slug` join belongs to the page and is fenced out of the canvas.** The canvas's
  suite pins the field's absence from code with the prose count at 1; a join written there goes red.
- **Re-pin the two suites in 188-11 from the gate's `actual` column** across two agreeing runs:
  `WorkflowCanvas.test.tsx` 31 → **46**, `PhaseNode.test.tsx` (unpinned) → **25**. The still-outstanding
  stale-low pins flagged by 188-02/04/05/06 remain owed: `PhaseNodeCard.test.tsx` 68 vs 105,
  `PhaseReconcile.test.tsx` 2 vs 12, `canvasModel.purity` 69 vs 143, `phaseVocabulary` 33 vs 96,
  `canvasModel.roundtrip` 517 unpinned.
- **The aria-label residual is unchanged and still recorded, not fixed.** The shipped
  `ariaLabelFor` prefix still exposes the raw `phase_type` and the ordinal; it is Phase-183 vocabulary
  shared with `PhaseSpineGraph`, Req 2's grep is scoped to the run-state render path, and re-cutting it
  is out of SPEC scope. Re-open trigger: the first phase that touches `ariaLabelFor`.

## Self-Check: PASSED

- All five files exist on disk: `frontend/src/components/workflows/runVocabulary.ts`,
  `.../PhaseNode.tsx`, `.../WorkflowCanvas.tsx`, `.../PhaseNode.test.tsx`,
  `.../WorkflowCanvas.test.tsx` — plus this summary.
- All three commits resolve in `git log`: `b46d988b`, `def6cddd`, `e48a5fe9`.
- `git diff --diff-filter=D --name-only HEAD~3 HEAD` is empty — this plan deleted no file.
