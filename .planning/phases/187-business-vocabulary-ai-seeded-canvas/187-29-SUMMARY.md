---
phase: 187-business-vocabulary-ai-seeded-canvas
plan: 29
subsystem: test-infrastructure-and-validation-record
tags: [gap-closure, round-5, wr-16, count-pin, validation-record, g-4, probe-ledger-correction]
gap_closure: true
gap_closure_round: 5
gap_closure_base: 15339441

requires:
  - "scripts/vitest-count-gate.cjs — the D-184-08 per-file count gate, its BASELINE map and the derived success line 187-25 left"
  - "187-26 / 187-27 / 187-28 — the three suites this plan pins and the figures it checks rather than copies"
  - "187-VALIDATION.md — the shipped round-2/3/4 sections, whose shape the round-5 section follows"
provides:
  - "three new per-file pins (DescribeKbPicker 30, ProblemsTray 30, verdictModel 29), each observed catching a deletion"
  - "the round-5 section of 187-VALIDATION.md — per-task rows, 18 probe mutations, every gate re-measured here"
  - "M15/M16/M17 — three lived-experience rows for what round 5 built, none performed"
  - "the seeded-rows caveat recorded as a BINDING rule rather than a footnote"
  - "a corrected probe ledger — three separate count claims measured false and both readings recorded"
affects:
  - "the count gate: 18 pinned files -> 21, pinned total 715 -> 804"
  - "the phase record only — zero product code, zero migration, zero backend file, zero mount-cap spend"

tech-stack:
  added: []
  patterns:
    - "a pin's number comes from the gate's own `actual` column, never from a hand count of `it(` literals — a pin below the real count can never fire"
    - "an EXTENSION of the pin map needs no deletion behind it; only a LOWERING does — and the header history block says so in those terms"
    - "apply the probe and run the measurement in ONE tool call (the 187-27 rule) — a probe measured in a later call is a green light with nothing behind it"
    - "a SUMMARY's figure is a claim to CHECK, not a number to copy; a disagreement records both with the re-run as the measurement"
    - "repair, never soften: a stale manual-row expectation is struck through with the shipped sentence named — and when NOTHING is stale, the grep that establishes it is recorded too"

key-files:
  created:
    - .planning/phases/187-business-vocabulary-ai-seeded-canvas/187-29-SUMMARY.md
  modified:
    - scripts/vitest-count-gate.cjs
    - .planning/phases/187-business-vocabulary-ai-seeded-canvas/187-VALIDATION.md
    - .planning/phases/187-business-vocabulary-ai-seeded-canvas/deferred-items.md
    - .planning/ROADMAP.md
    - .planning/STATE.md

decisions:
  - "D-187-29-01: this plan's three deletion probes are numbered P-28/P-29/P-30, NOT the P-23/P-24/P-25 its own task table names — 187-28 had already spent those three identifiers, and reusing them would put two different mutations behind one identifier in the same round's record"
  - "D-187-29-02: the probe ledger is corrected in THREE places rather than reconciled to any one plan's wording — this plan's 'ten probes / P-16..P-25', its identifier collision, and 187-28's own 'seven probes' heading over an eight-row table. The measured set is recorded, the planned one is not"
  - "D-187-29-03: 187-27's `contains: \"unchecked\"` artifact criterion is recorded as a DEVIATION from the planned artifact contract, with letter and intent stated separately — not folded into a green tick under the `not-run` rename"
  - "D-187-29-04: the round-5 per-task rows live INSIDE the round-5 section (§(aj)), following round 4's §(ae) shape, rather than being appended to the phase's main Per-Task Verification Map — so the section stays a pure insertion and the main map keeps meaning 'the phase as it closed'"
  - "D-187-29-05: M8 gains a clarifying NOTE with its expectation byte-unchanged, rather than a new row or an amendment. The door's flag-blindness is a DIFFERENT surface from M8's subject; a note prevents a false failure, a new row would have put an operator on a question nobody has decided (logged as D-ITEM-187-29-01 instead)"

metrics:
  duration_minutes: 46
  tasks_completed: 2
  files_created: 1
  files_modified: 5
  tests_added: 0
  commits: 2
  completed: 2026-08-04
---

# Phase 187 Plan 29: The Round-5 Pins and the Round-5 Record Summary

Round 5's guards can no longer be deleted with the gate green, and the round's figures are on the
record with the commands that produced them — including three probe-count claims, one artifact
criterion and one backend file-list expectation that were **measured false and recorded as
corrections** rather than reconciled away.

## What shipped

| # | Task | Commit |
|---|---|---|
| 1 | pin the three suites, from the gate's own output, and watch each pin bite | `51c44f37` |
| 2 | the round is on the record, and the board grows by three | `639e69cf` |

**Zero product code.** No component, no route, no migration, no backend file, no mount-cap spend.
This plan writes a pin map and planning records.

## The pins — from the gate's own `actual` column, each observed biting

Sampled **twice before** touching the map. The two samples were identical, which is what makes the
numbers a reading rather than a guess:

| suite | pinned | actual | delta |
|---|---|---|---|
| `DescribeKbPicker.test.tsx` | **30** | 30 | 0 |
| `ProblemsTray.test.tsx` | **30** | 30 | 0 |
| `verdictModel.test.ts` | **29** | 29 | 0 |

```
count gate OK — 21/21 pinned files present, no per-file decrease, 0 failing.
  total                                       804    2168   +1364
```

**Pinned total 715 → 804.** The success line moved **18/18 → 21/21 on its own**, because 187-25 made
that count derived from the map; `BASELINE_TOTAL` is still a `reduce`. Neither can print a false
figure on a green gate — which is the same stale-claim class the pin itself exists to catch.

**No existing pin was lowered by a single test**, and none needed to be: this is an **EXTENSION**, and
the script's header history block now records all three pin events in those terms. Only a **LOWERING**
requires a deliberate, plan-authorised deletion riding in the same commit (185-08's precedent). An
extension has no deletion behind it and needs none.

**Why a hand count was forbidden, restated because it is not fastidiousness:** `definitionOps.test.ts`
declares ~122 `it(` literals and runs **232** cases because of `it.each`. A hand count would have
pinned a fiction by ~110 — **and a pin below the real count can never fire.**

### The three deletion probes

Each applied, measured and reverted **inside a single tool call** (the 187-27 rule), with a sidecar
copy reversing exactly what it applied. `git checkout --` was **not** used (the 187-24 lesson).
`it.skip` was explicitly rejected: the gate counts `assertionResults.length`, which **includes**
skipped cases, so a skip leaves the count unmoved and probes nothing.

| # | File | Block deleted | Observed | `failed` | Restore |
|---|---|---|---|---|---|
| **P-28** | `DescribeKbPicker.test.tsx` | lines 447-449, `it("the fetch spy recorded exactly 0 calls", …)` | `DescribeKbPicker.test.tsx  30  29  -1` · `FAIL [count-decrease] … pinned 30, ran 29 (-1). A test was deleted or skipped away.` | **1** ⚠ see below | `sha256sum -c` → `OK`; `git diff --numstat` empty |
| **P-29** | `ProblemsTray.test.tsx` | lines 516-528, `it("held-stale findings still render under \`not-run\`…", …)` | `ProblemsTray.test.tsx  30  29  -1` · `RESULT: COUNT GATE VIOLATED (1 reason(s))` | **0** | `OK`; empty |
| **P-30** | `verdictModel.test.ts` | lines 377-393, `it("the CONTROLS — the class speaks about WORDS…", …)` | `verdictModel.test.ts  29  28  -1` · `RESULT: COUNT GATE VIOLATED (1 reason(s))` | **0** | `OK`; empty |

**P-29 and P-30 each ran at `failed 0` with exactly ONE reason — the count decrease was the only
signal.** That is the entire reason this gate exists: a failures-only differential cannot see a
deleted test.

**P-28's sample reported `failed 1`, and it was diagnosed rather than waved past.** The FULLNAME was
extracted from the gate's own JSON report:

```
FILE:     WorkflowBuilderPage.canvas.test.tsx
FULLNAME: WorkflowBuilderPage 184-11 — with the flag OFF the panel receives NO rails key (D-14)
          > POSITIVE CONTROL — with the flag ON the very same read finds the key
MSG:      AssertionError: expected 0 to be greater than 0
```

That is **`D-ITEM-187-25-01` verbatim** — a *different file* from the probed one, per-file count
**128** in that sample as in every other, and P-29/P-30 reported `failed 0` minutes later on the same
tree. A `[failing-tests]` reason, never a count reason. **No pin was lowered for it.**

## Every gate, re-measured here

| # | Gate | Result |
|---|---|---|
| 1 | `node scripts/vitest-count-gate.cjs` | **exit 0** — `21/21 pinned files present, no per-file decrease, 0 failing`, total 2168, pinned total 804, all three new pins at delta **0** |
| 2 | the round-5 named set (7 suites, ISOLATED) | **292 passed, 0 failed.** The seven per-file counts the gate reports (30+21+29+30+35+19+128) sum to 292 exactly — two independent readings agreeing |
| 3 | per-file literal deltas, base → HEAD | +30 / +8 / +4 / +4 / 0 / +3 / +11 = **+60**, every delta non-negative. Derived at this commit from `git show 15339441:<path>`, never inherited |
| 4 | D-187-14 mount cap | **15 ins / 3 del** = the round cap. 187-26's 6/1 + 187-27's 9/2; 187-28 spent zero. **0 new JSX elements, 0 new props on any JSX element, 0 new declarations** |
| 5 | zero migrations, three ways | `git diff --stat 35261e96 HEAD`, `git diff --stat 15339441 HEAD`, `git status --porcelain` — **all empty** |
| 6 | backend | `pytest tests/unit -q` → **62 failed / 1700 passed / 2 xfailed / 2 xpassed**. Failures unchanged at the pre-existing-rot baseline; collection 1766, and `1766 − 7 = 1759` matches 187-28's independently-derived base exactly. Both edited backend files are **comment-only** (0 non-`#` added/removed lines each) |
| 7 | `npx tsc --noEmit -p tsconfig.app.json` | **33 `error TS` lines** (61 raw), **0** in `src/components/workflows/`, **0** in `src/pages/WorkflowBuilderPage*`, **0** in `scripts/`. Bare form re-confirmed **VACUOUS** — exit 0, zero output (`D-ITEM-187-23-02`) |
| 8 | `npx vite build` | **exit 0** — `✓ built in 4.44s` |
| 9 | no false completion record | `git status --porcelain` over `REQUIREMENTS.md` / `STATE.md` / `ROADMAP.md` **empty** at measurement time |
| 10 | `187-UAT.md` byte-untouched | `git status --porcelain` and `git diff --numstat` both **empty** |

### The record is a pure insertion, proved by the hunk list

```
$ git diff --numstat -- 187-VALIDATION.md
795	2

$ git diff -U0 -- 187-VALIDATION.md | grep -E '^@@'
@@ -22 +22,5 @@          ← frontmatter: the round-5 keys + manual_rows 14 → 17
@@ -1603,0 +1608,652 @@   ← THE ROUND-5 SECTION — pure insertion, after round 4's last line
@@ -1637 +2293 @@        ← M8's row, with a clarifying note appended (expectation unchanged)
@@ -1646,0 +2303,4 @@     ← M15 / M16 / M17 — pure insertion
@@ -1761,0 +2422,46 @@    ← the round-5 board status — pure insertion
@@ -1962,0 +2669,87 @@    ← the round-5 sign-off — pure insertion
```

**795 insertions, 2 deletions**, and both deletions are named: `manual_rows: 14` (replaced by 17) and
M8's row (re-emitted with an appended note, its expectation byte-identical).

## Corrections — three claims measured false, both readings recorded each time

The plan's own instruction was that a SUMMARY's figure is a claim to CHECK, not a number to copy.
Applied honestly, it caught this plan's own text three times.

### 1. The probe ledger — the plan's "ten probes / P-16…P-25" is refuted, and its own probe numbers collide

| Plan | Identifiers actually spent | Mutations |
|---|---|---|
| 187-26 | P-16, P-17, P-18 | 3 |
| 187-27 | P-19, P-20, P-21, P-22 | 4 |
| 187-28 | P-23, P-24, **P-25a–d**, P-26, P-27 | **8** |
| 187-29 | **P-28, P-29, P-30** | 3 |
| **round** | **P-16 … P-30** | **18** |

`187-29-PLAN.md`'s Task-1 table names this plan's three probes **P-23 / P-24 / P-25** — all three
**already spent by 187-28**. Renumbered to P-28/P-29/P-30, and the renumbering is recorded rather than
applied silently, because a reader following the plan's table would otherwise look for the wrong rows.

⚠ **187-28's own SUMMARY heading says *"seven probes"* over an EIGHT-row table.** Neither reading
yields seven: five probe *identifiers* (counting P-25a–d as one site) or eight applied *mutations*.
Both figures are recorded in §(ak) so a later reader does not quietly pick one. This is the same
correction round 3 §(q) and round 4 §(af) each made to their own rounds — **the correction is the
pattern, not the exception.**

### 2. The backend file list — the plan expected two files, there are three

The plan's §C.7 says the backend diff shows *"exactly the one comment-only file plus round 5's test
file"*. Measured: **three**. The third is `backend/tests/unit/test_182_severity_codes.py`, added by
187-28's own Deviation 1 — that file's D-187-11 comment carried the *same* stale `canvas-only` claim,
in the file the corrected comment cites as the existing membership guard. **Both** edited files are
comment-only, proved at 0 non-comment added/removed lines each.

### 3. `PublishGauntlet.test.tsx` — red for 187-28, green five times here

187-28 measured it red on both its samples and proved non-attribution by rolling the canvas suite back
to `67b8025d`. The orchestrator then measured it **46/46 green in isolation** at HEAD. **This plan's
five whole-glob samples all reported `PublishGauntlet` at 46 with `failed 0`.** Both readings are on
the record. Four parties' worth of evidence now says load-dependent race, so the deferred item carries
a **standing recommendation: fix it rather than prove it a fourth time.** No pin was moved, and none
may be moved to make this gate green — the reason is `[failing-tests]`, which lowering a pin would not
even silence.

## Deviations from Plan

### 1. [Rule 3 — blocking] This plan's three probes could not use the identifiers the plan assigned

- **Found during:** Task 1, step 4, while reading 187-28's SUMMARY for the round's probe set
- **Issue:** the plan's probe table names P-23, P-24 and P-25 for the three deletion probes. 187-28
  spent exactly those three identifiers (`P-23` grounding constant, `P-24` collector emit, `P-25a–d`
  the four source-pin restorations). Following the plan literally would have put two different
  mutations behind one identifier inside a single round's record — the class of ambiguity this whole
  round exists to remove.
- **Fix:** renumbered **P-28 / P-29 / P-30**, with the collision and the full measured ledger recorded
  in §(ak) as a correction, alongside the refutation of the plan's "ten probes".
- **Commit:** `639e69cf`

### 2. [observation, no change] 187-27's `unchecked` artifact criteria do not hold literally

- **Found during:** Task 2, section A of the record
- **Issue:** `187-27-PLAN.md` requires the literal string `unchecked` in three files
  (`contains: "unchecked"`) and a key-link `pattern: "unchecked"`. That word is on the shipped
  graded-governance never-say list, and `governanceVocabulary.test.ts` builds `BANNED_WORDS` from
  assembled fragments (`tok("Unch","ecked")`) and sweeps every string literal in the workflows tree —
  so the discriminant reddened it. The member shipped as **`not-run`**.
- **Recorded, not resolved:** §(am) states the letter and the intent **separately** — ❌ the literal
  token does not appear; ✅ the intent (a named third member reaching all three files, and a page→tray
  link carrying it) holds under `not-run`; ✅ the user-facing sentence *"Not checked yet."* is
  unaffected. It is a deviation from the planned artifact contract, **not** a satisfied criterion, and
  it is not folded into a green tick anywhere in the record.
- **Commit:** `639e69cf`

### 3. [Rule 2 — a discovery the sweep surfaced] `WorkflowDoorSwitch` reads no feature flag

- **Found during:** Task 2, section F (the stale-manual-row sweep for M8)
- **Issue:** `WorkflowDoorSwitch.tsx:82` states outright *"This shell does NOT read the canvas flag at
  all"*, and 187-26's `<DescribeKbPicker>` mount at line 257 is unconditional. So a flag-OFF user meets
  the new knowledge-base picker on the loose *"Describe & run"* door.
- **Why it is not a D-181-01 violation:** that decision's subject is the **Builder** page, which 187-26
  leaves byte-identical when the prop is absent, and the door's flag-blindness **predates** round 5 —
  187-26 added a control to an already-ungated screen rather than ungating anything.
- **Logged, not fixed** (scope boundary): **`D-ITEM-187-29-01`**, with a re-open trigger naming the
  concrete moment it will matter — any plan that must revert the v3.6 surfaces from the flag alone.
  M8 gained a clarifying note so an operator running it does not meet the door's picker on the way and
  conclude D-181-01 has broken; **M8's expectation is byte-unchanged and the row is still owed.**
- **Commit:** `639e69cf`

## G-4 — the board grew and nothing softened

**14 → 17 rows. `manual_rows_performed: 0`.**

| Row | What it is for | Why no test can discharge it |
|---|---|---|
| **M15** | you can say what the workflow is ABOUT before the AI drafts it, and the draft is bound to what you said | the wire is proved by P-16/P-17; whether a person was genuinely *offered* the choice is not on the wire. A picker that is present but reads as decoration reproduces the defect with a green suite |
| **M16** | a draft you just opened claims no check nobody ran — **watch the FIRST SECOND** | jsdom proves the state machine and cannot see a flash. A card that shows the old all-clear for 200 ms passes every assertion and is exactly the lie the operator caught |
| **M17** | the fast path is still fast — ignore the picker entirely and nothing costs you anything | the suite asserts the CTA is enabled by text alone and that no key is sent. It cannot measure *friction*, and speed was the fast path's only promise |

**All three are bound by the operator's seeded-rows caveat**, recorded in §(an) as a **rule** rather
than a footnote, with the reason spelled out per row: the 73 drafts / 68 published rows are test data
of unknown vintage, so an assertion made only against a legacy row is not evidence about what the
current authoring path produces.

**No shipped row was made stale, and that is MEASURED.** The sweep over the whole Manual-Only table
returned exactly one hit for `publish`, inside M13's quotation of the receipt card's own closing
line — a string round 5 did not touch (`SeedReceipt.tsx` and `definitionOps.ts` are both absent from
the round's file list). Round 4 had to strike through two stale strings; round 5 had none, and the
grep is recorded **because round 4's plan asserted two stale rows that did not exist.**

Nothing was ticked, softened, re-scoped or dropped.

## State writes — what was and was not done

Per the standing false-completion guard, recorded so the next reader can audit it:

- **`requirements.mark-complete` was NOT called.** `VOCAB-02` and `VOCAB-03` remain unmarked;
  `git status --porcelain .planning/REQUIREMENTS.md` is EMPTY. Several of their truths are gated on
  manual rows that have not been run.
- **`state.advance-plan` was NOT called.** Verification has not run; the phase is **not** complete.
- **`roadmap.update-plan-progress` was NOT called.** The two ROADMAP edits are hand-made and each
  individually true: the wave-16 checkbox for `187-29` is ticked (this plan did complete), and the
  phase progress-table row moves `28/29` → `29/29`, which it demonstrably is. **The PHASE itself is
  NOT marked complete** — the row says so in as many words, and the added sentence states that all 17
  manual rows are unperformed.
- `completed_plans` incremented 99 → 100, a single honest step for this one plan. `last_activity` and
  `last_updated` rewritten to statements that are true of this plan.

## Known Stubs

None. This plan ships no runtime code at all — a pin map, three planning documents and two tracking
files. No value flows to a rendered element, no placeholder copy, no hardcoded empty reaches a surface.

## Threat surface

No new surface beyond the plan's register. `scripts/vitest-count-gate.cjs` imports nothing from
`frontend/src`, needs no database, no backend and no network, and still refuses to write its report
inside a reload-watched tree.

- **T-187-R5-15** (tampering, round 5's new suites) — **mitigated.** All three pinned; each pin
  observed producing a `[count-decrease]` on a genuinely deleted `it(` block, two of the three with
  `failed 0` so the count decrease was the only signal.
- **T-187-R5-16** (spoofing of a number) — **mitigated.** Every number read from the gate's own
  `actual` column over two agreeing samples, both raw tables transcribed into the record; the hand
  count is forbidden in the script's own comment with its measured error (~110) stated.
- **T-187-R5-17** (repudiation, a red gate) — **mitigated.** P-28's red was diagnosed by extracting
  the failing FULLNAME from the gate's own JSON report and matching it against `D-ITEM-187-25-01`'s
  recorded signature. Both the recurrence and the five clean `PublishGauntlet` samples are recorded.
  **No pin was lowered.**
- **T-187-R5-18** (repudiation, the manual board) — **mitigated.** Board grew 14 → 17, nothing ticked
  or softened; the stale sweep's result is recorded **with its grep** rather than asserted; the
  seeded-rows caveat is binding on every new row.
- **T-187-R5-19** (repudiation, the record's figures) — **mitigated.** Every "before" derived at this
  commit; three plan/SUMMARY claims measured false and recorded with both readings.
- **T-187-R5-SC** — **held: ZERO package-manager installs**, zero new dependencies.

## Verification against the plan's success criteria

- [x] The three suites are pinned from the gate's own `actual` column; **no existing pin lowered**;
      `BASELINE_TOTAL` and the success count stay derived (18/18 → 21/21 moved on its own)
- [~] Three deletion probes each observed producing `[count-decrease]`, each restore proved from a
      sidecar — **numbered P-28/P-29/P-30, not the plan's P-23/P-24/P-25** (Deviation 1)
- [x] The round-5 section is a **pure insertion** (`@@ -1603,0 +1608,652 @@`); base `15339441` stated
      and verified with `git rev-parse --short f5a28e7e~1`; every "before" derived here
- [x] The mount cap re-measured at **15 / 3**, the third deletion recorded as a **NAMED spend** claimed
      in advance in `187-27-PLAN.md`, and the render-body property proved (0 / 0 / 0)
- [x] Zero migrations proved three ways; `tsc` 33 with the vacuous-form warning restated;
      `vite build` exit 0
- [x] Board reads M1…M17, `manual_rows_performed: 0`, nothing ticked or softened, the seeded-rows
      caveat recorded as binding on every new row
- [x] `187-UAT.md` byte-untouched; **no SDK completion verb called by any task in this round**

## What this does NOT close

`187-29` closes WR-16-for-round-5 and writes the record. It closes **no** finding a user can see.

- **The phase is NOT complete.** 29/29 plans have shipped; verification has not run.
- **All seventeen manual rows are UNPERFORMED**, and three of them are this plan's own. **Authoring a
  row is not performing it.**
- **`BUG-260731-03` still cannot close** — its trigger needs both halves observed live.
- **`WR-08` is still Phase 188's**; `D-ITEM-187-23-01`, `D-ITEM-187-24-01`, `D-ITEM-187-25-01`,
  `D-ITEM-187-20-01` and the net-new `D-ITEM-187-29-01` are all open.
- **`VOCAB-01` / `VOCAB-02` / `VOCAB-03` are deliberately unmarked.** That is the orchestrator's call
  at phase end, once behaviour is genuinely observable.

## Self-Check: PASSED

- All 5 modified files and the 1 created file exist on disk.
- Both claimed commits resolve in `git log`: `51c44f37` (`test(187-29): pin round 5's three suites`),
  `639e69cf` (`docs(187-29): the round-5 record, and the board grows to seventeen`).
- `.planning/REQUIREMENTS.md` is clean; `VOCAB-02` and `VOCAB-03` carry no completion mark.
- `.planning/phases/187-…/187-UAT.md` is byte-untouched.
- In the ROADMAP's round-5 waves, `187-26`, `187-27`, `187-28` and `187-29` are all ticked and the
  progress row reads `29/29`; the **phase itself is not marked complete**.
