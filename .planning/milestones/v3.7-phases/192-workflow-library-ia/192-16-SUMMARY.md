---
phase: 192-workflow-library-ia
plan: 16
subsystem: tooling
tags: [vitest, count-gate, gap-closure, roadmap, hot-file-ledger, g5, g7, checkpoint]

# Dependency graph
requires:
  - phase: 192 (plan 13)
    provides: "4 new `WorkflowCard.test.tsx` cases — the state-aware consequence sentence"
  - phase: 192 (plan 14)
    provides: "4 new `WorkflowsPage.test.tsx` cases — the fork-collision branch 3176 tests never entered"
  - phase: 192 (plan 15)
    provides: "4 new `WorkflowsPage.test.tsx` cases — WR-03 failure visibility on both handlers"
provides:
  - "`WorkflowsPage.test.tsx` pinned at 48 and `WorkflowCard.test.tsx` at 39 — deleting a regression test for a LIVE BLOCKER now reds the gate"
  - "The `[count-decrease]` guard DEMONSTRATED against a real deletion, not asserted"
  - "The +36 gate delta DECOMPOSED and proved: +12 this round, +24 four pre-existing drifts"
  - "ROADMAP round-1 close block + the `WorkflowsPage.tsx` hot-file ledger cell, both corrected on measurement"
affects: [193 (inherits a measured ledger row instead of re-deriving it)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A pin is only a guard once it has been observed catching a real deletion — the positive control is part of the pin, not a nicety"
    - "When a gate's total delta exceeds what your own change explains, decompose it BEFORE pinning: the gate's own highlighted rows are the decomposition, and the post-pin delta is the proof"
    - "A figure written at a phase's close goes stale on that phase's OWN fix commit — CR-01 falsified the ledger's line count four commits after 192-12 wrote it"

key-files:
  created: [".planning/phases/192-workflow-library-ia/192-16-SUMMARY.md"]
  modified:
    - "scripts/vitest-count-gate.cjs"
    - ".planning/ROADMAP.md"
    - "CLAUDE.md"

key-decisions:
  - "The pins were READ from the gate's own `actual` column across two agreeing capped runs (48 / 39), NOT taken from either predecessor SUMMARY — and that mattered: `192-14` recorded the owed raise as `40 → 44`, which was true when written and stale four cases later."
  - "`192-UAT.md` was deliberately NOT written. Task 3 is a blocking human-verify checkpoint; flipping U5 from the unit suite's evidence is precisely the failure that let the blocker ship. Its absence is ownership, not oversight."
  - "The four pre-existing count-gate drifts (+24) were NOT absorbed. Re-pinning suites this round did not author would fold unrelated drift into a commit that did not cause it."
  - "D-192-DEF-01 is recorded with the HONEST characterization the orchestrator measured — capping REDUCES the flake, it does not eliminate it — rather than `192-14`'s 'green when capped'."

patterns-established:
  - "Decompose a gate delta with the gate itself: pin your own contribution, re-run, and require the residual to fall by exactly what you pinned."

requirements-completed: []

# Metrics
duration: 47min
completed: 2026-08-12
---

# Phase 192 Plan 16: The Regression Tests Stop Being Deletable Summary

**The eight tests that are the only mechanical memory of a live blocker are now pinned at numbers read from the gate, the guard was driven RED against a real deletion, and nothing this round did moved a rendering contract.**

## Performance

- **Duration:** 47 min
- **Tasks:** 2 of 3 executed — **Task 3 is a blocking human-verify checkpoint, handed back, NOT self-satisfied**
- **Files modified:** 3 (`192-UAT.md` deliberately untouched — see Decisions)

## Task Commits

1. **Task 1: pin this round's eight regression cases at READ numbers** — `91a98705` (test)
2. **Task 2: record gap-closure round 1 with re-derivable figures** — `2aebd7b6` (docs)
3. **Task 3: re-drive U5** — ⛔ **CHECKPOINT, awaiting the operator. No commit, and none is owed until a human answers.**

## Task 1 — the pins, and the guard actually firing

### Two agreeing runs, both quoted from the gate's own `actual` column

`GSD_VITEST_MAX_WORKERS=4 node scripts/vitest-count-gate.cjs`, run twice on the same tree:

```
  file                                     pinned  actual   delta
  WorkflowsPage.test.tsx                       40      48      +8
  WorkflowCard.test.tsx                        35      39      +4
  total                                      3152    3188     +36
  total 3188  ·  failed 0  ·  pinned total 3152
count gate OK — 60/60 pinned files present, no per-file decrease, 0 failing.
```

**Run 1 and run 2 printed those lines identically**, including the total. The pins were raised to **48** and **39** — the READ numbers.

**They agree with the planning expectation (40 → 48, 35 → 39), and the agreement is worth exactly nothing on its own.** The measurement is the source; the expectation merely survived it. ⚠ **`192-14`'s SUMMARY recorded this raise as owed at `40 → 44`** — true the moment it was written, stale four cases later when `192-15` landed. `192-15` caught and corrected it to 48. Had either number been transcribed from prose rather than read from the column, the pin would have shipped four cases below the real count, which is not a weaker guard but **no guard at all for the four in the gap** — the exact 188-12 lesson.

### Both raises are EXTENSIONS, measured

| File | insertions / deletions over the round | `grep -c '^-.*\bit('` |
|---|---|---|
| `WorkflowsPage.test.tsx` | **291 / 0** | **0** |
| `WorkflowCard.test.tsx` | **50 / 1** | **0** |

The single deleted line in `WorkflowCard.test.tsx` is an **import** (`FORK_CONSEQUENCE, FORK_VERB`), not an `it(`. So nothing was deleted, renamed or moved out, and no plan-authorised deletion needs to ride along. **No pin was lowered by this plan.**

### The `[count-decrease]` guard, DRIVEN RED — the acceptance criterion in full

A pin nobody has seen fire is a claim. One whole `it(` block was removed from the `192-14` describe — *"the publish gauntlet mounts on the EXISTING draft, not on a fork that was never created"*, 17 lines — and the gate run against the mutilated file:

```
  WorkflowsPage.test.tsx                       48      47      -1
  total 3187  ·  failed 0  ·  pinned total 3164
RESULT: COUNT GATE VIOLATED (1 reason(s))
  FAIL  [count-decrease] WorkflowsPage.test.tsx — pinned 48, ran 47 (-1). A test was deleted or skipped away.
```

**Exit 1, at `failed 0`.** The count decrease being the ONLY signal is the entire point — a failures-only differential sees nothing here.

**Restored md5-identical:**

```
md5 BEFORE deletion: fac6e8ecf791e065507a853f4ef6f23c *src/pages/WorkflowsPage.test.tsx
md5 AFTER  restore : fac6e8ecf791e065507a853f4ef6f23c *src/pages/WorkflowsPage.test.tsx
```

`git diff --stat` on the file is empty. Restore was by **explicit path** (`git checkout -- src/pages/WorkflowsPage.test.tsx`), never a blanket reset.

**Post-restore gate run: exit 0**, `WorkflowsPage.test.tsx 48 48 0`, `WorkflowCard.test.tsx 39 39 0`, `total 3188 · failed 0 · pinned total 3164`.

## The +36 discrepancy — decomposed, and proved by the gate itself

The handoff flagged that **+36 is larger than the +12 those two files explain**, and asked what the other 24 are before anything was pinned. Answered from the gate's own highlighted rows, which name every drifting file:

| File | pinned | actual | delta | whose |
|---|---|---|---|---|
| `WorkflowsPage.test.tsx` | 40 | 48 | **+8** | **this round** (192-14 ×4, 192-15 ×4) |
| `WorkflowCard.test.tsx` | 35 | 39 | **+4** | **this round** (192-13 ×4) |
| `ExternalActionSection.test.tsx` | 25 | 34 | +9 | pre-existing, owed since **190-12** |
| `PhaseTimeline.test.tsx` | 17 | 21 | +4 | pre-existing, owed since **190-12** |
| `WorkflowBuilderPage.canvas.test.tsx` | 128 | 133 | +5 | pre-existing, first seen at **192-01** |
| `builderStore.test.ts` | 52 | 58 | +6 | pre-existing, first seen at **192-01** |
| | | | **= 36** | **12 mine + 24 inherited** |

**And it was PROVED rather than reasoned.** After the two pins landed, the same tree printed:

```
  total                                      3164    3188     +24
```

The residual delta fell by **exactly the 12 that were pinned**. That is the measurement that closes the question — arithmetic agreeing with a table is not the same as the gate agreeing with itself.

**The +24 was deliberately NOT absorbed. 24 cases remain deletable with this gate green today**, and they are recorded as owed rather than folded into a commit that did not cause them — the same call 190-12, 190-15, 190-16, 192-01 and 192-12 each made on the same four files.

### One further correction, found while reading

`BASELINE_TOTAL`'s trailing note read `⚠ 3151 (192-12)` while the gate printed `pinned total 3152` on an unmodified tree — **the eleventh time that note has gone stale, and again by one.** The missing case is CR-01's own (`WorkflowsPage.test.tsx` 39 → 40, commit `60b8842f`), raised in the fix's commit after 192-12 wrote the line. Corrected to the READ figure **3164**, stated rather than smoothed.

## Task 2 — the contracts, measured and unmoved

Every figure below was re-run in this plan. **Zero baselines were re-captured.**

| Gate | Required | Measured |
|---|---|---|
| `librarySubtree.fences.test.ts` (F1–F5) | 64 | **64 passed / 0 failed** |
| `RunModal.test.tsx` | *(plan said 11)* | **32 passed** — pin 32, **delta 0** |
| `RunModal.a11y.test.tsx` | *(plan said 8)* | **16 passed** — pin 16, **delta 0** |
| `PublishedCardDelete.test.tsx` | *(plan said 7)* | **32 passed** — pin 32, **delta 0** |
| `npx vitest run src/pages src/components/workflows/library` | green | **22 files / 676 passed / 0 failed** |
| `npx tsc -p tsconfig.app.json --noEmit \| grep -c "error TS"` | 33 | **33** |
| `npx eslint src/pages/WorkflowsPage.tsx src/pages/WorkflowsPage.test.tsx src/components/workflows/library` | no output | **clean, exit 0** |
| …same with `-c eslint.a11y.config.js` | no output | **clean, exit 0** |

### ⚠ A discrepancy in the PLAN's own acceptance criteria, stated rather than reconciled silently

Task 2's acceptance criteria require *"`RunModal.test.tsx` **11**, `RunModal.a11y.test.tsx` **8**, `PublishedCardDelete.test.tsx` **7**"*. **Those three numbers are stale by a whole phase.** They are `192-01`'s adoption figures, superseded by `192-12`'s raises to **32 / 16 / 32** (argued in the gate's own 192-12 map block: *"the four RAISES owed by suites it GREW"*). Measured today the three suites run 32 / 16 / 32 and sit at **delta 0** against their pins.

**The contract the criterion actually protects is satisfied, and more strongly than the literal numbers would have shown:** each baseline is at its pinned count with zero re-capture, which is the "unmoved" property. Had the literal 11 / 8 / 7 been treated as the bar, the correct behaviour would have read as a failure. Recorded here because inheriting an unmeasured number is the single most repeated defect in this phase's paperwork — the plan text is one more place it happens.

### ROADMAP

- The four round-1 plan lines are checked.
- The phase checklist entry now says the phase **re-opened for gap-closure round 1 and re-closed**, with the reason stated as a fact rather than bookkeeping: **SC#3 was found UNMET in lived experience by a human on the first real click.** 12 plans + 4 = **16**.
- A close block records what the round closed (the dead fork verb, on all three fronts) with the gates measured, and **names what it did NOT close**: U5-b card density (routed to a sketch under G-2), the **2 of 18** `published + published` slugs whose fork still refuses *out loud*, WR-08 with its re-open trigger, the +24 drift, and `D-192-DEF-01`.

### CLAUDE.md hot-file ledger — corrected on measurement

Re-derived, not inherited:

```
git log --oneline -- frontend/src/pages/WorkflowsPage.tsx | wc -l   →  30
wc -l frontend/src/pages/WorkflowsPage.tsx                         →  1180
git show 6bdc4684:frontend/src/pages/WorkflowsPage.tsx | wc -l      →  1407
git show 60b8842f:frontend/src/pages/WorkflowsPage.tsx | wc -l      →  1027
```

The cell read **26 commits · 1407 → 1007**. Both figures are corrected to **30** and **1180**.

**⚠ The line count was stale in TWO independent ways, and the second is the one worth keeping.** (a) Round 1 added 153 lines (`1027 → 1180`). (b) The cell's `1007` was **already wrong before this round opened**: CR-01 (`60b8842f`) took the file to **1027** four commits after `192-12` wrote the row. *A figure written at a phase's close goes stale on that phase's own fix commit.* The PHASE list is unchanged at 11 — round 1 is Phase 192's own re-open, not a twelfth phase.

**The row stays *satisfied*, and the reason is measured rather than argued.** Round 1 added **no second concern**: every line lands inside the two fork handlers and the page-level failure-notice region *the cell already names as remaining* — an open-the-existing-draft branch reusing the shipped `onOpenDraft` seam, one `forkFailed` state, one module-scope `isForkConflict` beside the existing `freshHash`, and ONE `<p role="status">` in the region that already hosts `failedSources`. No dependency was acquired (no toast library — verified absent, not assumed). The G-5 obligation is inherited forward unchanged, with the next seam named.

## Decisions Made

1. **The pins were read from the gate, across two agreeing runs, and from neither predecessor SUMMARY.** `192-14` said 44; the column said 48.
2. **The positive control is part of the pin.** A guard that has never been observed firing is a claim; this one was driven RED against a real deletion and the file restored md5-identical.
3. **The +24 pre-existing drift is left owed, not absorbed.** Naming it is the honest half; folding it into this commit would hide four unrelated files' rot inside a gap-closure round.
4. **`192-UAT.md` was NOT written.** See the checkpoint section — this is the whole point of the row.
5. **`D-192-DEF-01` is recorded as *capping reduces but does not eliminate*.** `192-14` concluded "green when capped" from four measurements; the orchestrator measured `failed 0 / 0 / 1` across three CAPPED runs on one tree. This plan's own four capped gate runs were all `failed 0`, which is consistent with a reduced-but-live flake and is **not** evidence that it is gone. The COUNT columns remain the regression backstop; the `failed` line, on this machine, is not.

## Deviations from Plan

**None affecting scope.** Two of record:

- **Task 2's acceptance numbers for the three characterization suites (11 / 8 / 7) are stale** and were not treated as the bar. Measured 32 / 16 / 32, all at delta 0 against their shipped pins. Documented above rather than reconciled silently, per the plan's own instruction to report a discrepancy instead of making figures agree.
- **`BASELINE_TOTAL`'s trailing note was corrected from 3151 to the read 3164**, which the plan did not ask for. It rides here because the gate printed `pinned total 3152` on the unmodified tree — a pre-existing drift of one, caused by CR-01 — and leaving it would have made this plan's own note wrong on arrival.

**Total deviations:** 0 auto-fixes (no Rule 1/2/3 fix was required). **No product code was written by this plan at all**, as G-7 requires of a closure round.

## Issues Encountered

None blocking. Untracked scratch under `scripts/_uat111*`, `scripts/pm-pack/out/` and `scripts/.sse_after_run1/` predates this plan and belongs to earlier UAT sessions — left alone (out of scope; not this commit's to gitignore).

## Threat Flags

None. This plan adds no network endpoint, no auth path, no file access and no schema surface — it edits one committed script's constant map and two documents.

Threat register dispositions, as executed:

- **T-192-44** (tampering — the four/eight new regression tests) — **mitigated, and demonstrated.** Pinned at READ numbers; the guard observed RED against a real deletion with `[count-decrease]` naming the file, restored md5-identical.
- **T-192-45** (repudiation — this round's own claims) — **mitigated.** Every figure in this SUMMARY, the ROADMAP block and the ledger cell is quoted from a command run inside this plan. Where a number was inherited it is named as inherited and then re-measured (the ledger's 26/1007, `192-14`'s 44, the plan's own 11/8/7).
- **T-192-46** (spoofing of coverage — fences + baselines) — **mitigated.** All four re-run and required UNMOVED; **zero re-capture**. Nothing moved, so the stop condition was never reached.
- **T-192-SC** — n/a: no package installs, no `package.json` change.

## Known Stubs

None. This plan authors no code.

## G-7 position

Gap-closure **round 1**. **No capability was added** — this plan wrote no product code. `U5-b` (card density) remains deferred to a G-2 sketch and was not touched, which is the specific thing G-7 forbids a closure round from smuggling in.

## ⛔ Task 3 — CHECKPOINT, HANDED BACK

**Not attempted, not inferred, not marked.** The row exists precisely because ten rows of machine-driven evidence passed and the one row that required a person found a dead primary action. Satisfying it from this session's 3188 green tests would reproduce the original failure exactly.

`192-UAT.md` is therefore **unmodified** — U5 still reads `result: issue / severity: blocker` with its full diagnosis. The orchestrator owns driving the browser and the operator owns the verdict; whichever way it goes (pass, fail, or ⛔ owed as a dated decision), that write is the checkpoint's.

## Next Phase Readiness

- **Blocked on the checkpoint only.** Both code halves of U5 are complete and pinned: the collision is removed where a draft exists (`192-14`) and refused out loud where it does not (`192-15`).
- **Still owed after this round, unchanged:** the eleven G-4 UAT rows (**U6 first**), the +24 count-gate drift, WR-08's typed-error fix, and the U5-b density sketch.
- **`193` inherits a measured ledger row** rather than re-deriving one — and inherits the G-5 obligation on `WorkflowsPage.tsx` intact.

## Self-Check

- `scripts/vitest-count-gate.cjs` — FOUND (`"WorkflowsPage.test.tsx": 48`, `"WorkflowCard.test.tsx": 39`, `BASELINE_TOTAL` note 3164)
- `.planning/ROADMAP.md` — FOUND (four `[x]` round-1 plan lines, the round-1 close block)
- `CLAUDE.md` — FOUND (ledger row: 30 commits, 1180 L, row `satisfied`, table structure intact at 4 bare pipes)
- `.planning/phases/192-workflow-library-ia/192-UAT.md` — **unmodified, by design**
- Commits `91a98705`, `2aebd7b6` — FOUND in `git log`

## Self-Check: PASSED

---
*Phase: 192-workflow-library-ia*
*Completed: 2026-08-12 (Tasks 1–2; Task 3 awaiting operator)*
