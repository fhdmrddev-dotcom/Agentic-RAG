---
phase: 195-show-the-deliverable
plan: 08
wave: 4
subsystem: records + guardrails + G-4 acceptance
tags: [D-11, D-17, D-20, G-4, G-5, hot-file-ledger, same-commit-sync, seeds, uat, corrections-beside]

# Dependency graph
requires:
  - phase: 195-04
    provides: "chat converted onto the shared row — the OutputFileCard triple this ledger sync records"
  - phase: 195-05
    provides: "panel converted — the FilesSection triple, and the deleted duplication this ledger section records"
  - phase: 195-06
    provides: "run page converted + the D-02 relabel this UAT reads back live"
  - phase: 195-07
    provides: "the SC#2 source sweep whose tree this plan must not disturb (no frontend/ or backend/ path in files_modified)"
  - phase: 195-01
    provides: "195-BASELINE.md — the PRE-change readings every UAT row is compared against"
provides:
  - "ROADMAP SC#3 corrected — no longer instructs a pattern Phase 095.1 retired; original quoted verbatim"
  - "The design record corrected at NINE sites plus the icon rule — so the next UI phase cannot build a hero block from it"
  - "195-CONTEXT.md and BUG-260816-05 corrected beside their originals, the bug's YAML frontmatter byte-unchanged"
  - "Hot-file ledger sync under the same-commit rule: 2 new sections, 1 updated, 3 young-file bullets, rows in CLAUDE.md"
  - "SEED-169 and SEED-170 — the two measured lies this phase declines, each with a concrete re-open trigger"
  - "195-VALIDATION.md signed off (conditional) then AMENDED post-drive, both preserved"
  - "195-UAT.md — the driven G-4 evidence: 4 PASS / 0 FAIL / 2 ⛔"
  - "A visual regression on two live surfaces that every fence in the phase passed — found, fixed, re-measured"
affects: [196, 197, 198, hot-file-ledger, sketch-findings-agentic-rag, G-4-policy, G-5-audits]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Correct BESIDE the original, never over it — applied to 7 records in this plan alone"
    - "The ABSENCE of a guardrail override recorded as a MEASUREMENT, so 'declined' can be told from 'forgotten'"
    - "A blocked UAT row carries its blocking condition AND the row to run first — never omitted"
    - "An owed row with NO blocker is written as a scheduling debt, not dressed up as a blocker"

key-files:
  created:
    - .planning/phases/195-show-the-deliverable/195-UAT.md
    - .planning/seeds/SEED-169-runcard-file-badge-reads-zero-for-a-workflow-deliverable.md
    - .planning/seeds/SEED-170-records-that-name-outputfilecard-for-work-it-does-not-do.md
  modified:
    - .planning/ROADMAP.md
    - .claude/skills/sketch-findings-agentic-rag/references/chat-tool-card-unification.md
    - .planning/phases/195-show-the-deliverable/195-CONTEXT.md
    - .planning/reported-bugs/BUG-260816-05-canvas-run-surface-cannot-answer-human-step.md
    - CLAUDE.md
    - docs/HOT-FILE-LEDGER.md
    - .planning/phases/195-show-the-deliverable/195-VALIDATION.md
    - frontend/src/components/files/FileRow.tsx

key-decisions:
  - "D-195-08-A: the height defect is a G-3 FAST-FIX, not a gap-closure round — 1 file, 1 changed line, no schema and no API surface; Phase 195 still has ZERO gap-closure rounds and G-7 is not in play"
  - "D-195-08-B: the phase CLOSES WITH TWO OWED UAT ROWS (U1b, U4), stated as a DECISION with the first row to run named — never as a claim that everything ran"
  - "D-195-08-C: nyquist_compliant STAYS false; the amendment sits beside the task-2 sign-off, which was true when written and is preserved verbatim"
  - "D-195-08-D: no Phase 195 entry under STATE.md → Guardrail overrides — the ABSENCE is a measurement, the sixth consecutive phase to decline one"
  - "D-195-08-E: the U3 glyph delta and the new trailing download glyph were put to the operator and ACCEPTED — recorded as asked-and-answered, not as told"

patterns-established:
  - "A plant proves a fence CAN fire; it cannot prove the fence is watching the right property"
  - "Count CLAUSES, not claims, when estimating plants — `expect` short-circuits"
  - "A bare `grep -c` over a file that documents itself is not an acceptance criterion (F-d, four instances)"

requirements-completed: [RUN-02, RUN-03]

# Metrics
duration: 41min
completed: 2026-08-17
---

# Phase 195 Plan 08: Close the record, and finish real work on the canvas — Summary

**Seven stale records corrected beside their originals, the hot-file ledger taught to see all five
files this phase touched, two measured lies filed with triggers — and a browser found, in the first
five minutes of the G-4 drive, a visual regression on two live surfaces that 75 RED-driven plants, a
20-case source sweep, `tsc` at 33 and a green count gate had all passed.**

Executed **sequentially on the main working tree** (`develop`), not in a worktree — task 3 needs a
browser and a `.docx` reader, which the worktree executor has neither of.

---

## Performance

- **Duration:** ~41 min (first task commit `21:04:21 +0400` → UAT commit `~21:35 +0400`), plus the
  orchestrator's browser drive between task 2 and the write-up
- **Started:** 2026-08-17T17:00:00Z (approx., first task commit at 17:04:21Z)
- **Completed:** 2026-08-17T17:35:00Z
- **Tasks:** 3 of 3 — task 3 was a **blocking** `checkpoint:human-verify` driven by the orchestrator
- **Files modified:** 12 (11 records + **1 source file**, the deviation below)

---

## Commits

| # | Hash | Subject | Task |
|---|---|---|---|
| 1 | `945b8b61` | `docs(195-08): correct four stale records — every original preserved beside its correction` | 1 |
| 2 | `1ff680b4` | `docs(195-08): ledger sync under the same-commit rule, two seeds, the validation sign-off` | 2 |
| 3 | `9c985537` | `fix(195): restore the shared row's height — the icon wrapper inherited the row's leading` | ⚠ **deviation, found by task 3** |
| 4 | `70000590` | `docs(195-08): the D-20 UAT scoreboard — 4 PASS, 2 owed, and one defect no fence could see` | 3 |

---

## What shipped

### Task 1 — four stale records, each corrected BESIDE its original (`945b8b61`)

| Record | What was wrong | What it says now |
|---|---|---|
| `.planning/ROADMAP.md` **SC#3** | Instructed the **hero/working split** — a pattern Phase **095.1 (D-095.1-06)** reversed by operator-approved decision. **The criterion could not be satisfied** | ONE uniform quiet row, no hero, newest-first — with the original sentence quoted verbatim, the reversal cited, and the scale fact (**60 of 61 file-bearing runs have exactly ONE file**) that makes it right |
| `chat-tool-card-unification.md` (design record) | Listed sketch 016-A *"Hero block"* as the **winner** at **nine** sites, and forbade *"a flat, index-ordered output list with no hero"* — **which is exactly what ships** | A top banner + SUPERSEDED markers at all nine sites; the ❌ anti-pattern **inverted in place** with its original quoted; the icon rule corrected with `ribbon` / `tone` / `className` / `mimeType` and the four-item glyph delta |
| `195-CONTEXT.md` `<code_context>` | Claimed `fileIcon.tsx` *"needs consumers, not changes"* | A dated correction quoting the bullet: Phase 195 changed it **additively**, because adopting it unparameterised would have discarded a Phase 088-05 AA decision and regressed **nine** code extensions |
| `BUG-260816-05` | Capability table read *"see produced output files \| canvas run surface ❌"* — **measurably wrong since Phase 188-10** | Corrected beside the original, FILE half marked delivered. ⚠ **YAML frontmatter byte-unchanged**, `status:` still `deferred` — a `folded` record is invisible to the open-report routing scan, and the ask-responder half must still reach Phase 198 / NODE-02 |

### Task 2 — the ledger under the same-commit rule, two seeds, the sign-off (`1ff680b4`)

**Every triple re-derived at that commit** with `CLAUDE.md`'s three-command recipe, the derivation
printed, dated quick-task buckets checked for and named. **Not copied from `195-BASELINE.md`** — this
phase's own commits had landed since.

- **ADDED** full sections for `OutputFileCard.tsx` and `FilesSection.tsx` — ⚠ **both were invisible to
  the ledger entirely**, while `OutputFileCard.tsx` had been firing G-5 at **6 phases** unseen.
- **UPDATED** `WorkflowRunPage.tsx` — 195 makes it the **4th** phase. Its existing section *predicted*
  this extraction (*"five concerns in one 1101-line component"*); the seam is recorded **TAKEN beside
  the prediction**, never over it, with the remaining four named.
- **ADDED** young-file bullets for `FileRow.tsx`, `fileRowUtils.ts` and `lib/fileIcon.tsx`, each owing a
  full section at a third phase — with the ledger's own lesson as the reason (`WorkflowsPage.tsx`
  escaped G-5 for ten phases purely by not being written down).
- **RECORDED WHY** `MessageItem.tsx` and `RunCard.tsx` owe nothing: `OutputFileCard`'s public prop shape
  stayed **byte-identical**, so neither call site was opened. A **structural claim, not luck** — and if a
  future plan widens those props, `MessageItem.tsx` (29 phases, extraction due, obligation
  **UNDISCHARGED**) is opened and a refactor recommendation is owed FIRST.
- **`SEED-169`** — `RunCard`'s badge reads **0** for a real 38-40 KB deliverable, and `ThreadRunLine`
  shows no file at all. **`SEED-170`** — two shipped records name `OutputFileCard` for work it does not
  do (`tool_dispatcher.py:3570`, `panel/SeamCard.tsx:10`), plus `SeamCard` declared the **FIFTH**
  presentation and explicitly OUT of scope, converting a future SC#2 dispute into a recorded boundary.
  Both carry re-open triggers that name a **file or an observable user report** — never a date.
- **`195-VALIDATION.md`** signed off **CONDITIONAL**, with `nyquist_compliant` deliberately `false` and
  its condition named.

### Task 3 — D-20 driven, and written up (`70000590`)

`.planning/phases/195-show-the-deliverable/195-UAT.md`:

| Row | Verdict |
|---|---|
| U1a — empty → populated **LIVE, no reload**; **35.9 ms** before terminal (baseline: 35.7 ms — *preserved*, not merely present) | ✅ **PASS** |
| U1b — download the deliverable and **OPEN** it, POST-change | ⛔ **OWED — the first row to run when UAT resumes** |
| U2 — `Files in this run's workspace` (was `What this run produced`) | ✅ **PASS** |
| U3 — three surfaces read as one row; **operator ASKED and accepted** both the glyph delta and the new trailing download glyph | ✅ **PASS** (two live surfaces + one fixture) |
| U4 — multi-file newest-first, incl. the mid-run no-`created_at` regime | ⛔ **UNDRIVABLE — premise refuted** |
| U5 — panel roving focus / Enter / focus restore, all five clauses | ✅ **PASS** |
| U6 — the terminal empty state (161 of 222 runs) | ✅ **PASS** |

**4 PASS · 0 FAIL · 2 ⛔.** Both ⛔ rows carry a blocking condition and the row to run first.

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] The shared row grew on every surface; the icon wrapper inherited the row's leading**

- **Found during:** Task 3 (the D-20 UAT), in a browser, in the first five minutes
- **Issue:** `FileRow.tsx:223`'s icon wrapper `<span>` was a **block box** inheriting the row's
  `line-height: 24px`, so a 16 px glyph sat in a 24 px line box. Measured against
  `195-BASELINE.md`'s pre-change readings: **run page 33 → 40 px (+7)**, **panel 38 → 42 px (+4)**.
  The wrapper's own computed height read **24** on both surfaces while the glyph read **16**. Before
  the conversion each surface rendered the glyph as a **direct child** at `h-4 w-4`, with no wrapper to
  inherit leading from. ⚠ **This breaks `195-03`'s own `must_have` — *"without any of them changing
  visually."***
- **Fix:** `inline-flex items-center` on the wrapper, so the box shrink-wraps its glyph and is immune to
  inherited leading. The reason is written into the file beside the fix so the next reader cannot delete
  it as styling.
- **Files modified:** `frontend/src/components/files/FileRow.tsx` (1 changed line + a docblock)
- **Verification:** Re-measured **live** after the fix — run page **33 px**, panel **38 px**, icon
  wrapper **16 px** on both: **byte-exact with the baseline**. Tokens, padding, basename-vs-full-path
  and activation all unchanged. `tsc --noEmit -p tsconfig.app.json` → **33, unmoved**. The six affected
  suites → **233/233 green**. Safe against the phase's fences **by construction**: every token assertion
  uses `classList.contains()` or `innerHTML.toContain()`, both **additive**
- **Committed in:** `9c985537`
- ⚠ **Classified as a G-3 fast-fix, operator-approved — NOT a gap-closure round.** 1 file, ≤ 10 lines of
  source change, no schema and no API surface. **Phase 195 therefore still has ZERO gap-closure rounds
  and G-7 is not in play** (D-19 holds)
- ⚠ **It contradicts this plan's own `<context>` claim that *"this plan writes NO source code"*** and its
  `files_modified` list, which contains no path under `frontend/`. The rule that claim protected —
  *`195-07`'s SC#2 sweep must not measure a tree that changed afterwards* — is **not violated**: the
  sweep asserts *how many* byte formatters, icon paths and row markups exist, and this edit adds a class
  to an existing `className`. Verified rather than argued: the sweep and all five in-scope suites are
  green at `9c985537`. **Stated as a deviation rather than smoothed over**

**2. [Rule 2 — Missing critical] `195-VALIDATION.md` amended after the drive**

- **Found during:** Task 3 write-up
- **Issue:** The task-2 sign-off's reason for `nyquist_compliant: false` said D-20 *"had not been driven
  when this sign-off was written"*. After the drive that sentence is stale — and **a record that is
  present and WRONG answers the auditor and stops the audit** is this plan's entire thesis
- **Fix:** A dated **AMENDMENT** appended beside the sign-off (which is preserved verbatim, because it
  was true when written), naming the two uncovered rows and the flag's unchanged value; plus a frontmatter
  comment added beneath — not over — the original two
- **Files modified:** `.planning/phases/195-show-the-deliverable/195-VALIDATION.md` (in `files_modified`)
- **Committed in:** `70000590` (with `195-UAT.md`)

---

**Total deviations:** 2 auto-fixed (1 bug, 1 missing-critical record correction).
**Impact:** the bug fix was necessary for correctness and restores a `must_have` the phase had silently
broken. No scope creep — no new capability, no new surface, no schema.

---

## ⚠ HEADLINE LEARNINGS — the five worth carrying out of this phase

### 1. A visual regression that EVERY unit test passed — the strongest G-4 evidence this project has produced

**Green throughout the defect's life:** 75 plants driven RED against production source · a 20-case
source sweep over four files · `tsc` at 33 · the count gate at `failed 0` · 233/233 in the six affected
suites. **And every row on two live surfaces was the wrong height.**

The reason is **structural, not a lapse in diligence**:

| What the fences assert | Still correct while the defect shipped? |
|---|---|
| class names (`classList.contains()`) | ✅ yes |
| design tokens (`text-muted-foreground` / `text-panel-muted-foreground`) | ✅ yes |
| glyph sizes (16×16) | ✅ yes |
| padding (`8px` / `8px 10px`) | ✅ yes |
| **the computed line box** | ❌ **wrong — and jsdom does not resolve geometry** |

> ⚠ **THE GENERALISABLE RULE: a plant proves a fence CAN fire; it cannot prove the fence is watching
> the right property.** Every geometric property of these three surfaces was asserted by class name —
> correct, deliberate (`D-195-05-B`, so the light-theme AA property stays visible) and **blind to
> layout**. G-4 is not ceremony on top of the fences. **Here it was the only instrument that could see.**

Recorded because `CLAUDE.md` G-4 has, until now, been argued from lived-experience *misses*
(075.x, 192, 194). **This is the first time the argument is a single measurement: `33 → 40` and
`38 → 42`, found by a human looking at a browser.**

### 2. The wrong-base fork — **19 consecutive dispatches**, caught only by an assertion that MEASURES

Every worktree plan in this phase forked from the wrong base and said so:

| Plan | Expected base | Actually forked from |
|---|---|---|
| `195-02` | `35a16bc1` | `fda79214` (a `master` merge commit; `merge-base` read `3781a3fe`) |
| `195-03` | — | corrected to `3e43f24b` — *the assertion FIRED* |
| `195-04` | — | corrected to `57601b6f` — *fired* |
| `195-05` | — | `57601b6f` — *fired* |
| `195-06` | — | `337a1227` — *fired, the **19th consecutive** time* |
| `195-07` | — | `fda79214` → reset → `1c027f49` — *fired* |

**7/7 in Phase 194, 8/8 in 194.1, and every worktree plan in 195.** ⚠ **The defect is in the dispatch,
not in the executors** — and the only thing standing between it and a silently-wrong phase is that each
dispatch **measures** `git rev-parse HEAD` rather than assuming it. `195-BASELINE.md` records why this
matters concretely: **a `git diff --numstat <base> HEAD` emptiness check passes TRIVIALLY when the base
SHA is wrong.** The phase's central byte-identity claim (D-13, chat gains no capability) would have been
vacuous.

### 3. The self-tripping grep — **four instances in one phase**, recorded as `F-d`

| # | Where | What tripped |
|---|---|---|
| 1 | `195-03` | The `FileRow` docblock **red its own acceptance greps** by explaining the constraints in prose that named the forbidden identifiers — and `fileIcon()` in a comment matches `fileIcon(` |
| 2 | `195-06` | `grep -c "toMatch(/function formatBytes/)"` reads **3, not 0** — a substring grep cannot tell `not.toMatch(` from `toMatch(` |
| 3 | `195-07` (**D-195-07-D**) | `grep -n '"src/components/files"'` matched **its own explanation** — then the stricter regex written to replace it matched **that** too |
| 4 | **this plan, task 2** | The criterion *"zero `⬜` remaining"* reads **2** — **both hits are prose ABOUT the marker**, including the sentence explaining the convention. The map itself contains none |

⚠ **Four independent instances in one phase is a PATTERN, not bad luck** — the 187-24 trap (*prose is
never exempt*) on its seventh recorded appearance in this repository.

**The shapes that work, both driven here:** an **anchored array-element regex** (`^\s*"<path>",\s*$`)
or a **column-anchored table check** (`grep -cE '^\|.*⬜'` → 0) — positions prose **structurally cannot
occupy**; and the deeper fix the whole SC#2 sweep rests on: **read STRIPPED code, never raw bytes.**

> **THE RULE: a bare `grep -c` over a file that documents itself is not an acceptance criterion.**

### 4. `SEED-171` — the count gate **cannot be made green on demand**

Measured at this phase's Wave 1 close, on a tree whose production source was **byte-identical to the
base commit**: three suites (`WorkflowsPage.test.tsx`, `WorkflowCard.test.tsx`,
`WorkflowBuilderPage.session.test.tsx`) fail **non-deterministically, independent of
`GSD_VITEST_MAX_WORKERS` and of machine load** — and the failing set is **never the same twice**, so no
per-file baseline can absorb it. ⚠ `CLAUDE.md` § Parallel execution's stated causal model
(*oversubscription → timeouts; capping fixes it*) is **refuted**: capping does not fix it. `195-02`
concluded cap 1 was clean after 8 runs; **that was luck** — two cap-1 runs at wave close were red.

> ⚠ **THE CONSEQUENCE FOR PLAN AUTHORS, which is the reason this belongs in a summary and not only in a
> seed: a plan whose acceptance criterion is *"the count gate is green"* has written a criterion that
> can fail for reasons no plan controls.** Write the criterion against the property the gate actually
> guarantees — **no per-file DECREASE**, plus the *named* failing files compared against the seed's
> known set — never against `failed 0` as a bare number.

### 5. The plant estimate ran low by **2.9×**, and the cause is fixable

| | Plants |
|---|---|
| Estimated in `195-VALIDATION.md` | **26** |
| The adopted 27th (the stripper non-vacuity plant) | **27** |
| ⚠ **Actually driven RED against production source** | **75** |

Per plan: `195-01` 0 · `195-02` **9** · `195-03` **19** · `195-04` **7** · `195-05` **10** ·
`195-06` **15** · `195-07` **15**.

**The dominant cause is the same in every case: `expect` short-circuits**, so a case with N substantive
clauses needs **N plants, not one**. An estimate that counts **claims** will always undercount
**plants**. (194-10 needed six where two were named; 194-12 needed eleven — this phase is the largest
gap yet.)

> **THE CHEAP FIX FOR THE NEXT VALIDATION AUTHOR: count CLAUSES, not claims.**

---

## Guardrails

- **G-5 FIRES on five files** (`WorkflowRunPage.tsx` 4 phases, `OutputFileCard.tsx` 6,
  `FilesSection.tsx` 3, plus the two ledger rows updated) and is **HONOURED BY CONSTRUCTION** — the
  extraction (D-05) **IS** the requirement (RUN-03), and it shipped as the phase's structural first
  move rather than after a feature.
- ⚠ **NO Phase 195 entry was added under `STATE.md → Guardrail overrides`, and THE ABSENCE IS A
  MEASUREMENT.** An override was offered and **DECLINED** — the **sixth consecutive phase** to decline
  one. Stated here explicitly so a later reader can tell **"declined"** from **"forgotten"**, which an
  empty section cannot.
- **G-7 is NOT in play.** Phase 195 ran **zero** gap-closure rounds (D-19). The height fix is a **G-3
  fast-fix**, not a round — 1 file, 1 changed line, no schema, no API surface, no new capability.
- **G-2 was deliberately DECLINED** (D-18): RUN-03 exists specifically to forbid new file UI, and the
  single genuinely-open visual question (what many files read like post-095.1) was decided in discussion
  as D-10. Recorded as a choice, not an omission.
- **G-4 was DRIVEN, not owed** — and it is the only reason this phase did not ship a visual regression.

---

## Phase 195 — closing record

**8 plans across 4 waves, all executed. 41 commits off base `f2eef045`.** Fourteen source/tooling files
touched: 3 surfaces converted, 1 shared row + its helpers created, 1 icon module widened, 6 test suites
grown, 1 gate script taught to see 9 suites where it saw 1.

| Success criterion | Verdict |
|---|---|
| **SC#1** — a completed workflow that produced a file shows that file from the run surface | ✅ **CONFIRMED TWICE** — pre-change at `BASE_SHA` (`195-BASELINE.md`, two runs, bytes byte-exact and CRC-clean on disk) and post-change live (U1a: empty → populated, no reload, 35.9 ms before terminal). ⚠ The *finish* half (open the file post-change) is **U1b, ⛔ OWED** |
| **SC#2** — the presentation reuses the shipped file UI; **no second file UI** | ✅ **MEASURED, not believed** — `195-07`'s 20-case source sweep proves exactly ONE byte formatter, ONE per-extension icon path and ONE row markup across four files, over a comment stripper with four non-vacuity guards. Corroborated visually by U3 |
| **SC#3** — many files handled by the ONE uniform quiet row, newest-first *(**corrected by this phase** — the original named a retired pattern)* | ⚠ **UNEXERCISED BY OBSERVATION** — **no workflow run in the live DB has ever produced 2+ files** (U4). Fence-covered in **both** `created_at` regimes, including the mid-run one the deliverable actually arrives in |

**Requirements completed:** `RUN-02`, `RUN-03`.

### ⚠ What Phase 195 owes, stated as a DECISION

**Two UAT rows.** Neither is a failure; neither is hidden. Full detail, blocking conditions and
run-order in `195-UAT.md` § "DECISION — the phase closes with two owed rows":

1. **U1b — download the deliverable and OPEN it, on the POST-change surface.** ⚠ **No blocking
   condition exists** — the reader is present, the control is live, the identical journey was driven
   end-to-end pre-change. It was simply not run. **Recorded as a scheduling debt, not dressed up as a
   blocker. It is the FIRST row to run when UAT resumes.**
2. **U4 — multi-file newest-first.** Blocked on a workflow run that produces **2 or more** files, which
   has never happened. **The row's own premise is refuted by the data.**

**`nyquist_compliant` stays `false`** with both rows named. **A compliance flag set on an undriven row
is the "scoreboard that lists only what passed" failure with a boolean on it.**

### Open items carried forward

| Item | Where | Trigger |
|---|---|---|
| `RunCard`'s badge reads 0 for a workflow deliverable; `ThreadRunLine` shows no file | `SEED-169` | Any phase opening `RunCard.tsx` or `MessageItem.tsx`, or a user reporting *"chat says my workflow made nothing"* |
| Two shipped records name `OutputFileCard` for work it does not do; `SeamCard` is a FIFTH presentation, declared OUT of scope | `SEED-170` | The next phase opening either file, or any reader citing `SeamCard`'s docblock as evidence the chip shares the file presentation |
| Three suites flake independent of the worker cap; the gate cannot reach `failed 0` on demand | `SEED-171` | Any phase needing `count gate OK` as a pass condition |
| The `tsc` floor stays **33** though three of its errors are one import away from gone | `195-VALIDATION.md` § "THE `tsc` FLOOR" | The next phase that opens `FilesSection.test.tsx` for any reason adds the `WorkspaceFile` import in the same commit and records **30 beside the 33** |
| `MessageItem.tsx` — 29 phases, extraction due, obligation **UNDISCHARGED** | `docs/HOT-FILE-LEDGER.md` | Any plan widening `OutputFileCardProps` opens it, and owes a refactor recommendation FIRST |
| `WorkflowRunPage.tsx` — 195 took **one of the five** concerns its ledger section named | `docs/HOT-FILE-LEDGER.md` | The remaining four are named there for the next phase |
| The ask-responder mount on the run surface (`BUG-260816-05`'s second half) | `BUG-260816-05`, `status: deferred` | Phase 198 / NODE-02 — deliberately left `deferred`, never `folded`, so it stays visible to the routing scan |

---

## Issues Encountered

- **U5 read a FALSE FAILURE on its first attempt** — focus landed on `BODY` and looked exactly like a
  broken focus restore. It was a **driving artifact**: two buttons match the text `Files`, and the
  ambiguous selector activated the wrong one. Source confirms `handleBack` restores focus via
  `requestAnimationFrame`, **structurally identical before and after the conversion**. **Both the false
  reading and its resolution are published in `195-UAT.md`** — a UAT that silently retries until it
  gets the answer it wanted has measured nothing.
- **Chat renders no file card for a workflow deliverable**, re-confirmed post-change
  (`[data-testid="output-file-card"]` → `null` on the owning thread). D-20's three-surface bar is
  therefore discharged as **two live surfaces + one fixture**, as a recorded decision with its reason
  (D-14 is the cause: a workflow emit returns `path`; `RunCard` parses `output_files` out of
  `tool_calls`).

## User Setup Required

None — no external service configuration. The phase writes no Python, ships no migration and adds no
dependency.

## Next Phase Readiness

- **Phase 196 (Registry-Backed Model Picker)** is unblocked — no shared surface with this phase.
- ⚠ **Any phase touching `frontend/src/components/files/`** must read `FileRow.tsx:220-233` first: the
  `inline-flex items-center` on the icon wrapper is **load-bearing, not styling**, and the docblock says
  why in the file.
- ⚠ **Any phase opening `MessageItem.tsx` or `RunCard.tsx`** inherits `SEED-169` and, for
  `MessageItem.tsx`, an **undischarged G-5 extraction obligation** — a refactor recommendation is owed
  FIRST.
- ⚠ **Any phase whose gate is `failed 0`** should read `SEED-171` before writing that criterion.
- **U1b is the first UAT row to run** the next time a browser is in hand.

## Self-Check: PASSED

Verified by command, not asserted:

| Claim | Command | Result |
|---|---|---|
| `195-UAT.md` exists | `[ -f … ]` | ✅ FOUND |
| `195-08-SUMMARY.md` exists | `[ -f … ]` | ✅ FOUND |
| All five commits exist | `git log --oneline --all \| grep -q <hash>` | ✅ `945b8b61` · `1ff680b4` · `9c985537` · `70000590` · this commit |
| `.planning/STATE.md`, `.planning/ROADMAP.md`, `frontend/`, `backend/`, `scripts/` untouched **after** the deviation fix | `git diff --numstat 9c985537 HEAD -- …` | ✅ **0 lines** |
| Files changed after `9c985537` | `git diff --name-only 9c985537 HEAD` | ✅ exactly three, all under `.planning/phases/195-show-the-deliverable/`: `195-UAT.md`, `195-08-SUMMARY.md`, `195-VALIDATION.md` |

⚠ **The pre-existing uncommitted modifications under `.claude/agents/` and `.claude/commands/gsd/`, and
the untracked `docs/DEPLOYMENT-PIPELINE.md`, are NOT this plan's and were never staged.** Every commit
staged named files individually; no `git add .` or `git add -A` was run.

---
*Phase: 195-show-the-deliverable*
*Completed: 2026-08-17*
