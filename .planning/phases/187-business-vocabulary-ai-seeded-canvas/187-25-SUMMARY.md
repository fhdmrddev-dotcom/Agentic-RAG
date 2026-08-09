---
phase: 187-business-vocabulary-ai-seeded-canvas
plan: 25
subsystem: test-infrastructure + phase-record
tags: [WR-16, count-gate, pin, falsification, G-4, validation-record, round-4]
requires:
  - "184 Wave 0 (scripts/vitest-count-gate.cjs — the D-184-08 per-file count gate)"
  - "185-08 (the one prior re-pin, and the read-it-from-the-actual-column rule)"
  - "187-22 / 187-23 / 187-24 (the three fix plans this record transcribes and whose guards this pins)"
provides:
  - "per-file pins for definitionOps.test.ts (232) and SeedReceipt.test.tsx (68) — the two suites carrying the whole Req-5 governance-honesty estate"
  - "a derived success-line count, replacing the hard-coded 16/16 that would have printed a false figure"
  - "the round-4 record: 9 per-task rows, 14 transcribed probes, 5 re-measured gates, all with commands"
  - "M14 — the CR-04 lived-experience row; M3/M9/M13 notes repaired"
  - "D-ITEM-187-25-01 — a second parallel-execution flake, diagnosed and NOT pinned around"
affects:
  - scripts/vitest-count-gate.cjs
  - frontend/src/components/workflows/SeedReceipt.test.tsx
tech-stack:
  added: []
  patterns:
    - "a pin's number comes from the gate's own `actual` column, never a hand count of `it(` literals"
    - "a pin never observed catching a deletion is not known to be a pin"
    - "a red gate is diagnosed and logged, never quieted by lowering a pin"
    - "revert an uncommitted probe from a sidecar copy, never `git checkout --` (the 187-24 lesson)"
    - "a stale instruction is repaired in the SAME commit that makes it false"
key-files:
  created: []
  modified:
    - scripts/vitest-count-gate.cjs
    - frontend/src/components/workflows/SeedReceipt.test.tsx
    - .planning/phases/187-business-vocabulary-ai-seeded-canvas/187-VALIDATION.md
    - .planning/phases/187-business-vocabulary-ai-seeded-canvas/deferred-items.md
decisions:
  - "BASELINE_TOTAL stays COMPUTED; only its trailing note moved 415 -> 715. The success line's `16/16` became derived, because a literal there prints a false count on a GREEN gate — the same stale-claim class the pin exists to catch"
  - "The plan's `grep \"must NOT be added to\" returns nothing` criterion and its `explain why the earlier choice was right` action CONFLICT if the old sentence is quoted. Resolved by paraphrasing the old instruction and saying so in-source — history preserved, needle absent"
  - "The plan's claim that M3 and M9 carry CR-04 warnings is FALSE (zero CR-04 mentions in the file). The genuinely stale text is M9(5) and M13(2), stale from 187-23 — repaired instead"
  - "M13 was EXTENDED rather than duplicated: it is the only shipped row that isolates the escalated-only card, which is exactly where 187-23's changed sentence renders"
  - "187-24's probe count is EIGHT, not the nine its own SUMMARY and this plan state — the sibling-attribute probe IS sweep probe 5"
metrics:
  duration: ~70 min
  tasks: 2
  commits: 2
  completed: 2026-08-04
---

# Phase 187 Plan 25: the guards are pinned, and the round is on the record Summary

The thirteen tests that closed CR-03 and every test round 4 added to close CR-04, WR-11, WR-12,
WR-13, WR-14 and WR-15 could all be deleted with the count gate green, because neither owning
suite carried a per-file pin. Both are pinned now, from numbers the gate printed, and each pin has
been **observed catching a deletion**.

## Task-by-task

| Task | Name | Commit | Files |
|---|---|---|---|
| 1 | Pin both suites from the gate's own output; repair the docblock that said not to | `4541a936` | `vitest-count-gate.cjs` (+40/−9), `SeedReceipt.test.tsx` (+29/−3, docblock only), `deferred-items.md` (+43) |
| 2 | Record round 4 — every figure with its command, the board amended never softened | `61ffd0b1` | `187-VALIDATION.md` (+503/−4) |

**No manual row was performed. No SDK completion verb was called.**

---

## 1. The pre-pin gate table — RAW

⚠ **Four samples were taken, and the first one was RED.** Both tables below are transcribed in
full, as the plan requires.

### Sample 1 (pre-pin) — `failed 1`

```
  file                                     pinned  actual   delta
  -------------------------------------------------------------
  canvasModel.fixtures.test.ts                100     100       0
  canvasModel.purity.test.ts                   69     143     +74
  phaseVocabulary.test.ts                      33      96     +63
  WorkflowCanvas.test.tsx                      31      35      +4
  canvasModel.test.ts                          26      49     +23
  PublishGauntlet.test.tsx                     24      46     +22
  WorkflowBuilderPage.canvas.test.tsx          22     117     +95
  PhaseFormPanel.test.tsx                      19      19       0
  WorkflowBuilderPage.test.tsx                 15      15       0
  PhaseSpineGraph.test.tsx                     14      20      +6
  soulData.test.ts                             14      14       0
  WorkflowDoorSwitch.test.tsx                  13      13       0
  PhaseSpine.test.tsx                          11      11       0
  deriveTier.test.ts                            9       9       0
  WorkflowSoul.test.tsx                         8       8       0
  revertByteIdentical.test.tsx                  7       7       0
  BuilderSaveRegion.test.tsx                    —      11     new
  CanvasToolbar.test.tsx                        —      14     new
  FlowEdge.test.tsx                             —      22     new
  GovernanceSection.test.tsx                    —      42     new
  PhaseFormPanel.rails.test.tsx                 —      27     new
  PhaseNode.test.tsx                            —      13     new
  PhaseNodeCard.test.tsx                        —      68     new
  ProblemsTray.test.tsx                         —      26     new
  SeedReceipt.test.tsx                          —      68     new     ← the number the pin needs
  StarterTemplatePicker.test.tsx                —      40     new
  StepTypePicker.test.tsx                       —      43     new
  WorkflowBuilderPage.header.test.tsx           —      27     new
  WorkflowCanvas.composition.test.tsx           —      19     new
  WorkflowCanvas.editing.test.tsx               —      57     new
  builderStore.test.ts                          —      52     new
  canvasModel.roundtrip.test.ts                 —     517     new
  canvasNudge.test.ts                           —      31     new
  definitionOps.test.ts                         —     232     new     ← the number the pin needs
  governanceVocabulary.test.ts                  —      30     new
  phaseVocabulary.corpus.test.ts                —      45     new
  verdictModel.test.ts                          —      25     new
  -------------------------------------------------------------
  total                                       415    2111   +1696
  total 2111  ·  failed 1  ·  pinned total 415
RESULT: COUNT GATE VIOLATED (1 reason(s))
  FAIL  [failing-tests] 1 test(s) failed — the gate requires 0.
GATE_EXIT=1
```

### Sample 2 (pre-pin) — `failed 0`, every per-file count IDENTICAL

Byte-for-byte the same table, with `total 2111 · failed 0 · pinned total 415` and
`count gate OK — 16/16 pinned files present, no per-file decrease, 0 failing.` **Not one per-file
count differed between the two samples**, which is what makes the difference a flake rather than a
tree change.

---

## 2. The red gate was DIAGNOSED, not pinned around

The plan predicted that a red would be the known `PublishGauntlet.test.tsx` parallel flake
(`D-ITEM-187-20-01`). **It was a different file.** Extracted from sample 1's own JSON report
(the gate prints its path, and `--json` replays it):

```
FILE:     WorkflowBuilderPage.canvas.test.tsx
FULLNAME: WorkflowBuilderPage 184-11 — with the flag OFF the panel receives NO rails key (D-14)
          > POSITIVE CONTROL — with the flag ON the very same read finds the key
MSG:      AssertionError: expected 0 to be greater than 0
```

Isolated re-run, per the task's stop-and-report rule:

```
$ cd frontend && npx vitest run src/pages/WorkflowBuilderPage.canvas.test.tsx
 Test Files  1 passed (1)
      Tests  117 passed (117)
EXIT=0
```

| Sample | `failed` | `WorkflowBuilderPage.canvas` | `PublishGauntlet` |
|---|---|---|---|
| 1 (pre-pin) | **1** | 117 | 46 |
| 2 (pre-pin) | 0 | 117 | 46 |
| 3 (post-pin) | 0 | 117 | 46 |
| 4 (final, shipped tree) | 0 | 117 | 46 |
| isolation | 0 | **117 passed, exit 0** | — |

**`PublishGauntlet.test.tsx` did NOT flake this round** — 46 passing in all four samples, so
`D-ITEM-187-20-01`'s own file stayed quiet and a sibling took its place. Same class, different
file, logged separately as **`D-ITEM-187-25-01`**.

**No pin was lowered.** A pin moves down only alongside a deliberate, plan-authorised deletion —
and it would have been meaningless here anyway: the flake is a `[failing-tests]` reason, and the
file's per-file count was **117 in every sample**, never a `[count-decrease]`.

---

## 3. The post-pin gate table — RAW, exit 0

```
  file                                     pinned  actual   delta
  -------------------------------------------------------------
  definitionOps.test.ts                       232     232       0    ← NEW PIN
  canvasModel.fixtures.test.ts                100     100       0
  canvasModel.purity.test.ts                   69     143     +74
  SeedReceipt.test.tsx                         68      68       0    ← NEW PIN
  phaseVocabulary.test.ts                      33      96     +63
  WorkflowCanvas.test.tsx                      31      35      +4
  canvasModel.test.ts                          26      49     +23
  PublishGauntlet.test.tsx                     24      46     +22
  WorkflowBuilderPage.canvas.test.tsx          22     117     +95
  PhaseFormPanel.test.tsx                      19      19       0
  WorkflowBuilderPage.test.tsx                 15      15       0
  PhaseSpineGraph.test.tsx                     14      20      +6
  soulData.test.ts                             14      14       0
  WorkflowDoorSwitch.test.tsx                  13      13       0
  PhaseSpine.test.tsx                          11      11       0
  deriveTier.test.ts                            9       9       0
  WorkflowSoul.test.tsx                         8       8       0
  revertByteIdentical.test.tsx                  7       7       0
  BuilderSaveRegion.test.tsx                    —      11     new
  CanvasToolbar.test.tsx                        —      14     new
  FlowEdge.test.tsx                             —      22     new
  GovernanceSection.test.tsx                    —      42     new
  PhaseFormPanel.rails.test.tsx                 —      27     new
  PhaseNode.test.tsx                            —      13     new
  PhaseNodeCard.test.tsx                        —      68     new
  ProblemsTray.test.tsx                         —      26     new
  StarterTemplatePicker.test.tsx                —      40     new
  StepTypePicker.test.tsx                       —      43     new
  WorkflowBuilderPage.header.test.tsx           —      27     new
  WorkflowCanvas.composition.test.tsx           —      19     new
  WorkflowCanvas.editing.test.tsx               —      57     new
  builderStore.test.ts                          —      52     new
  canvasModel.roundtrip.test.ts                 —     517     new
  canvasNudge.test.ts                           —      31     new
  governanceVocabulary.test.ts                  —      30     new
  phaseVocabulary.corpus.test.ts                —      45     new
  verdictModel.test.ts                          —      25     new
  -------------------------------------------------------------
  total                                       715    2111   +1396
  total 2111  ·  failed 0  ·  pinned total 715
count gate OK — 18/18 pinned files present, no per-file decrease, 0 failing.
GATE_EXIT=0
```

**Both new files are PINNED rows at delta `0`, not `new`.** Pinned total **415 → 715**. Every
previously-pinned file reports delta **≥ 0** — not one decreased.

**Why the numbers had to come from this table.** `definitionOps.test.ts` declares **122** `it(`
literals and runs **232** cases (`it.each` expands one literal into several), so a hand count would
have pinned a fiction by ~110 — a pin below the real count is a pin that can never fire.

---

## 4. The two deletion probes — a pin never seen biting is a gesture

### PROBE P-14 — delete one `it(` block from `SeedReceipt.test.tsx`

Mutation: the `renders every authored string as a text child (T-187-13-04)` block removed.

```
  definitionOps.test.ts                       232     232       0
  SeedReceipt.test.tsx                         68      67      -1
  total                                       715    2110   +1395
  total 2110  ·  failed 0  ·  pinned total 715
RESULT: COUNT GATE VIOLATED (1 reason(s))
  FAIL  [count-decrease] SeedReceipt.test.tsx — pinned 68, ran 67 (-1). A test was deleted or skipped away.
GATE_EXIT=1
```

**`failed 0`.** The count decrease is the *only* signal — which is the entire reason this gate
exists: a failures-only differential cannot see a deleted test (the Phase-177 lesson).

Restore, and the restore proved:

```
$ node probe.cjs unplant seedreceipt        → restored byte-for-byte from sidecar
$ grep -c "renders every authored string as a text child"   → 1
$ git diff --numstat -- .../SeedReceipt.test.tsx            → 29  3
$ git diff -U0 | <strip comment lines> | count              → 0 non-comment changed lines
```

The 29/3 is **Task 1's own docblock edit and nothing else** — checked against what it *should* be
rather than against zero, per 187-24's recorded lesson.

### PROBE P-15 — delete one `it(` block from `definitionOps.test.ts`

Mutation: the `is pure — the same drag resolves identically every time` block removed.

```
  definitionOps.test.ts                       232     231      -1
  SeedReceipt.test.tsx                         68      68       0
  total 2110  ·  failed 0  ·  pinned total 715
RESULT: COUNT GATE VIOLATED (1 reason(s))
  FAIL  [count-decrease] definitionOps.test.ts — pinned 232, ran 231 (-1). A test was deleted or skipped away.
GATE_EXIT=1
```

```
$ node probe.cjs unplant defops             → restored byte-for-byte from sidecar
$ grep -c "is pure — the same drag resolves identically every time"   → 1
$ git diff --stat -- .../definitionOps.test.ts                        → (empty)
```

**`definitionOps.test.ts` is byte-identical to HEAD** — this plan only probed it, never edited it.

⚠ **`git checkout --` was deliberately NOT used to revert either probe.** Both files sat in a tree
with uncommitted Task-1 edits, and `git checkout --` restores to HEAD — which is exactly how 187-24
silently wiped a task's own work mid-probe. A sidecar copy that reverses precisely what it applied
is the instrument.

⚠ **`it.skip` would NOT have been a valid probe.** The gate counts `assertionResults.length`, which
includes skipped cases, so a skip leaves the count unmoved. The block had to be genuinely deleted.

---

## 5. The suite after the docblock edit — the sweep is unaffected by prose

```
$ cd frontend && npx vitest run src/components/workflows/SeedReceipt.test.tsx
 Test Files  1 passed (1)
      Tests  68 passed (68)
EXIT=0

$ grep -n "must NOT be added to" src/components/workflows/SeedReceipt.test.tsx
(no hits, exit 1)
```

**68, the same count the pin records.** The file `?raw`-imports its own source, so its docblock is
part of `testSource` — but WR-13's sweep strips comments before its substring check, so a prose edit
can neither satisfy nor break it. **Confirmed by re-running the suite, not asserted from the plan.**

---

## 6. The five re-measured gates

| # | Gate | Command | Result |
|---|---|---|---|
| 1 | the five-suite named set | `npx vitest run SeedReceipt.test.tsx StepTypePicker.test.tsx phaseVocabulary.test.ts phaseVocabulary.corpus.test.ts definitionOps.test.ts` | **5 files · 484 passed · 0 failed**, exit 0 |
| 2 | the count gate | `node scripts/vitest-count-gate.cjs` | **exit 0**, 18/18, both new pins at delta 0 |
| 3 | zero migrations | `git diff --stat 35261e96 HEAD -- supabase/migrations` · `git diff --stat 7a1b427e HEAD -- supabase/migrations` · `git status --porcelain supabase/migrations` | **all three empty** |
| 4 | backend untouched | `git diff --name-only 7a1b427e HEAD -- backend/` | **empty** |
| 5 | D-187-14 mount cap | `git diff --numstat 7a1b427e HEAD -- frontend/src/pages/WorkflowBuilderPage.tsx` | **`8	1`** — 8 insertions against the ≤ 15 budget |
| 6 | typecheck | `npx tsc --noEmit -p tsconfig.app.json` | **33 error lines, exit 2** — 0 in `components/workflows/`, 0 in `pages/WorkflowBuilderPage*` |

### The five-suite total, before and after — the "before" is DERIVED, not inherited

**484 now.** Round 3's §(t) recorded **466** for the identical command. The delta is re-derived by
counting declared case literals in the round-4 base blob and the HEAD blob:

| Suite | literals `7a1b427e` → `HEAD` | Δ |
|---|---|---|
| `SeedReceipt.test.tsx` | 60 → 68 | **+8** |
| `definitionOps.test.ts` | 118 → 122 | **+4** |
| `phaseVocabulary.test.ts` | 78 → 84 | **+6** |
| `StepTypePicker.test.tsx` | 36 → 36 | 0 |
| `phaseVocabulary.corpus.test.ts` | 17 → 17 | 0 |
| **total** | | **+18** |

`484 − 18 = 466` — it **independently reproduces** round 3's recorded figure, so the "before" is a
measurement taken now rather than a transcription. **The total ROSE, by +18.**

### The typecheck trap, re-confirmed by measurement

```
$ cd frontend && npx tsc --noEmit -p tsconfig.app.json ; echo $?    → 33 error lines, exit 2
$ cd frontend && npx tsc --noEmit                      ; echo $?    → ZERO output, exit 0
```

**`D-ITEM-187-23-02` holds at the round-4 tip.** The bare form is **vacuous** — the root
`tsconfig.json` is a solution file with `files: []`, so it checks zero files and cannot detect a new
error either. 33 → 33 against the `D-ITEM-01` baseline, 0 in this round's touched files.

---

## 7. Deviations from Plan

### 1. [Rule 1 — inherited claim FALSIFIED] the plan's predicted red file was wrong

**Claim:** *"A `PublishGauntlet.test.tsx` red is the known pre-existing parallel-execution flake
(`D-ITEM-187-20-01`)."*
**Measured:** the red was in **`WorkflowBuilderPage.canvas.test.tsx`**; `PublishGauntlet.test.tsx`
passed 46/46 in all four samples. The plan's *rule* was applied exactly as written (re-run in
isolation, record both results, never lower the pin, log it) — only its predicted subject was wrong.
Logged as `D-ITEM-187-25-01` rather than folded into `D-ITEM-187-20-01`, because a deferred item that
names the wrong file sends the next reader to the wrong place. Not a stop-and-report: the plan's
stop rule is for a red that is **not** a flake, and this one is green in isolation, green in three of
four samples, and count-stable at 117 in all four.

### 2. [Rule 1 — inherited claim FALSIFIED] M3 and M9 carry NO CR-04 warnings

**Claim:** *"M3 and M9 already carry CR-04 warnings that this round's fix makes stale… Both
currently tell the operator to try leaving the receipt open and editing a step, warning that the card
may start lying."*
**Measured at HEAD, before any edit:**

```
$ grep -n "CR-04" 187-VALIDATION.md                                          → (no hits, exit 1)
$ grep -n "leaving the receipt open\|editing a step\|start lying" …          → (no hits, exit 1)
```

**Zero CR-04 mentions in the entire file.** They cannot exist: CR-04 was found by the round-3
*re-review*, after this file's round-3 section was written.

**What IS genuinely stale is different, and worse.** **M9's check (5) and M13's check (2) both quote
`"you turned this on by hand"` as the row the operator should expect — a sentence 187-23 REMOVED.**
Left alone, both rows would have failed for the wrong reason and trained an operator to distrust a
surface that is now correct. Repaired: the old wording is **struck through, not deleted** (a silently
vanishing expectation reads as one that was never true), the shipped sentence
(`it was set to must prove it by hand`) is named, and the reason is given — the formatter is handed a
`GroundingCause` and never an actor. M3 was amended for the snapshot separately, since 187-22 gives
its *"nothing reads as still-deciding"* clause a second, sharper meaning.

### 3. [Rule 3 — two plan criteria CONFLICT; resolved and stated] the docblock grep vs. the docblock history

The plan's action says to explain *"why the earlier choice was right and stopped being right"*; its
acceptance criterion says `grep -n "must NOT be added to" … returns nothing`. Quoting the old
sentence to explain it **satisfies the grep and fails the criterion**. Resolved by paraphrasing the
former instruction (*"instructed the next reader to keep the file OUT of the gate's `BASELINE` map"*)
and **saying in-source why the verbatim wording is not reproduced**, with a pointer to the commit
where it lives. History preserved, needle absent, and the next reader is not left guessing.

### 4. [Rule 2 — a stale claim the plan did not name] the gate's hard-coded `16/16`

`console.log("count gate OK — 16/16 pinned files present…")` was a literal. Adding two pins would
have made a **green** gate print a false count — precisely the stale-claim class the pin exists to
catch, in the pin's own success message. Changed to derive from `pinnedNames.length`; it now prints
`18/18`. The header's `RE-PINNED ONCE` block was likewise rewritten, since this is a second move —
and the two are recorded as **different in kind** (185-08 *lowered* a pin alongside a deletion;
187-25 *extended* the map with no deletion), because collapsing them would blur the one rule that
matters: only a lowering needs an authorised deletion behind it.

### 5. [Rule 1 — measured correction to a figure BOTH the plan and 187-24's SUMMARY state] eight probes, not nine

187-24's SUMMARY says *"Nine observed falsifications were required… and nine were run"*, then
enumerates *"two in Task 1, one in Task 2, five in Task 3"* — which sums to **eight**. This plan's
task action repeats the nine as *"two agreement/source, one WR-12 wording, five WR-13 sweep probes,
and the sibling-attribute probe"*, double-counting the sibling-attribute probe, which **is** probe 5
of the five sweep probes (`data-row-tally`). The record carries the **measured** set, exactly as
round 3's §(q) did when its own probe count was misstated in three places.

### 6. [Scope — beyond `files_modified`, logged rather than dropped] `deferred-items.md`

`D-ITEM-187-25-01` was appended to `deferred-items.md`, which this plan's `files_modified` does not
declare. The standing executor rule is that out-of-scope discoveries are logged there rather than
fixed or forgotten, and both prior plans in this round wrote to the same file. Committed with Task 1.

---

## 8. Known Stubs

None. This plan writes no code that runs in the product. The changes are: a pin map, one derived
`console.log` count, a docblock, and planning records.

## 9. Threat Flags

None new. No endpoint, no request, no auth path, no file access, no persisted field, no schema
change. `scripts/vitest-count-gate.cjs` still imports nothing from `frontend/src`, needs no database,
no backend and no network, and still refuses to write its report inside a reload-watched tree.

| Threat ID | Disposition | Outcome |
|---|---|---|
| T-187-R4-14 | mitigate | **CLOSED** — both owning suites pinned; each observed producing `[count-decrease]` on a deleted `it(` block (P-14, P-15) |
| T-187-R4-15 | mitigate | **CLOSED** — both numbers read from the script's `actual` column over two agreeing runs, raw tables transcribed; a hand count would have pinned 122 instead of 232 |
| T-187-R4-16 | mitigate | **CLOSED, on a file the register did not predict** — the flake was re-run in isolation (117 green), both results recorded, no pin lowered, logged as `D-ITEM-187-25-01` |
| T-187-R4-17 | mitigate | **CLOSED** — board 13 → **14**; no row ticked, softened, re-scoped or dropped; `manual_rows_performed: 0`; three stale notes **rewritten with strike-through**, never deleted |
| T-187-R4-18 | accept | Unchanged — the script's stated purity properties are untouched by this plan |
| T-187-R4-SC | accept | Not engaged — zero package-manager installs, zero new dependencies |

## 10. Requirements

`VOCAB-02` is exercised by this plan but is **NOT** marked complete here. Per the project's standing
rule, `requirements.mark-complete`, `state.advance-plan` and `roadmap.update-plan-progress` write
false completion records and were **not called by any task in this plan**. The orchestrator owns
those writes. Verified for the whole round:

```
$ grep -rn "gsd-sdk\|sdk query" .planning/phases/187-.../187-2[2345]-*.md   → (no hits, exit 1)
$ git status --porcelain .planning/REQUIREMENTS.md .planning/ROADMAP.md     → (empty)
```

Every textual occurrence of those three verb names across the round's four plans and four summaries
is **prohibition prose**, never an invocation.

## 11. Self-Check: PASSED

```
$ [ -f scripts/vitest-count-gate.cjs ]                                    → FOUND
$ [ -f frontend/src/components/workflows/SeedReceipt.test.tsx ]           → FOUND
$ [ -f .planning/phases/187-.../187-VALIDATION.md ]                       → FOUND
$ [ -f .planning/phases/187-.../deferred-items.md ]                       → FOUND

$ git log --oneline -2
61ffd0b1 docs(187-25): record round 4 — every figure with its command, board +1 row
4541a936 test(187-25): pin the two suites carrying the Req-5 governance estate (WR-16)
```

Both commit hashes exist. Declared artifacts carry their required `contains` tokens:
`scripts/vitest-count-gate.cjs` → `SeedReceipt.test.tsx` ✅; `187-VALIDATION.md` → `187-22-T1` ✅.
The declared `key_link` holds: `BASELINE` now contains `definitionOps.test.ts` and both pins were
read from the script's own `actual` column.

Round-3 section byte-unchanged apart from the note repairs — proved by the diff hunk list
(`-18`, `-1202,0`, `-1231`, `-1237`, `-1242`, `-1309,0`, `-1463,0`): the round-4 section is a **pure
insertion** after round 3's last line, and the only modified lines anywhere below it are the three
manual rows and the frontmatter counter. Manual board reads `M1 … M14`, `manual_rows_performed: 0`.

```
$ git diff --name-only -- backend/ supabase/migrations   → (empty)
$ git status --porcelain supabase/migrations             → (empty)
```
