---
phase: 197-guided-authoring
plan: 03
subsystem: frontend
tags: [vocabulary-module, copy-home, true-leaf, d-07, d-09, d-10, d-16, d-20, positive-control, character-identity]

# Dependency graph
requires:
  - phase: 197
    plan: 01
    provides: "The phase base SHA as a literal, the 33-error tsc baseline, and the four standing numstat criteria"
  - phase: 193.1
    provides: "templateFirstVocabulary.ts — the measured reason doorVocabulary.ts cannot hold a function export, and the TRUE LEAF property asserted rather than documented"
  - phase: 187
    provides: "definitionOps.ts SeedReceipt copy home — wholeCount, the empty-string-at-zero formatter shape, and the `const _never: never` exhaustiveness binding"
  - phase: 193
    provides: "doorVocabulary.test.ts:527-561 — the zero-import-leaf fence whose non-vacuity is anchored on declarations, not on a positive import"
provides:
  - "decisionsVocabulary.ts — the ONE copy home for the arrival card's decisions half"
  - "DECISION_ROW_ORDER — D-07's five-row order as exported DATA, so 'always five, always the same order' is a module-level fact"
  - "decisionRowLabel — total over DecisionRowKey with a never-binding, so a 6th row is a typecheck error"
  - "groundingFoldSummary / decisionsFoldSummary — the sketch-174 fold lines, empty at zero"
  - "The four absence constants, row 5's two answers, the three row actions and D-03's stated limit"
  - "A 22-case suite fencing order, totality, exhaustiveness, distinctness, leafness and D-20 — every fence with a positive control"
affects: [197-06, 197-07, 197-11]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Vocabulary module as a TRUE LEAF: zero imports, asserted by a `?raw` sweep whose non-vacuity is anchored on what the file DECLARES (a zero-import leaf cannot have a positive import)"
    - "A copy fence that sweeps FUNCTION output, not only string constants — the values that interpolate a count are most of the module's risk and a `typeof === 'string'` filter sweeps none of them"
    - "A totality guard over the exported function SET, so a 4th function cannot silently escape the copy sweep (property, not deny-list)"

key-files:
  created:
    - "frontend/src/components/workflows/decisionsVocabulary.ts"
    - "frontend/src/components/workflows/decisionsVocabulary.test.ts"
  modified: []

key-decisions:
  - "groundingFoldSummary deliberately does NOT reach for GOVERNANCE_SEAL_LABEL's vocabulary — a leaf cannot compose it, and a near-spelling is still a second spelling of a locked string"
  - "The D-20 fence bans the gate-claim token TOTALLY across the module rather than per-row, because row 3's verdict is the server's sentence and is not authored in this repository"
  - "DECISION_TEMPLATE_NONE deliberately avoids templateFirstVocabulary's shipped FOOTING_* tail, which belongs to the pre-draft screen"
  - "The two named seams (the three page-owned header constants; row 3's publish verdict) are DECLINED with re-open triggers, per the plan"

patterns-established:
  - "Drive the never-binding at RUNTIME as well as asserting it in source — the source regex proves the guard is written, the runtime call proves it resolves instead of throwing"
  - "Assemble a searched token from parts even when the fence is over runtime VALUES, so the guard file cannot trip a future whole-tree grep"

requirements-completed: [AUTH-02]

# Metrics
duration: 47min
completed: 2026-08-18
---

# Phase 197 Plan 03: The Decisions Copy Home + Its Fences Summary

**A 226-line zero-import leaf carrying every word the arrival card's decisions half shows an author, with D-07's five-row order exported as data — and a 22-case suite in which no negative assertion ships without a positive control proving its detector fires.**

## Performance

- **Duration:** 47 min
- **Tasks:** 2
- **Source files created:** 2 · **modified:** 0
- **Test cases added:** 22 (all passing)

---

## What shipped

### `frontend/src/components/workflows/decisionsVocabulary.ts` — 226 lines, 17 exports, 0 imports

Every identifier named in the plan's `<interfaces>` block, spelled exactly:

| Export | Kind | Notes |
|---|---|---|
| `DecisionRowKey` | type | the five-member union |
| `DECISION_ROW_ORDER` | `readonly` tuple | D-07's order **as data** — `as const satisfies readonly DecisionRowKey[]` |
| `decisionRowLabel` | function | total, `const _never: never` in the default arm |
| `groundingFoldSummary` | function | `""` at zero |
| `decisionsFoldSummary` | function | `""` at zero |
| `GROUNDING_FOLD_ACTION` · `DECISIONS_FOLD_ACTION` | const | the sketch's `why` / `review` |
| `DECISION_KB_NONE` · `_TEMPLATE_NONE` · `_REQUIREMENT_NONE` · `_NAME_NONE` | const | the four absences |
| `DECISION_DELIVERABLE_FILE` · `_CHAT` | const | row 5's two honest answers |
| `DECISION_CHANGE_ACTION` · `_OPEN_STEP_ACTION` · `_NAME_FIELD_LABEL` | const | the row actions + D-17's aria-label |
| `DECISION_EDIT_LIMIT_NOTE` | const | D-03's limit, one line |

The five row labels, verbatim, so a later plan can assert them by character-identity without
opening the file: *The documents it can read* · *The document it fills in* · *The requirement it
works to* · *What this workflow is called* · *What it hands back*.

### `frontend/src/components/workflows/decisionsVocabulary.test.ts` — 371 lines, 22 cases

```
 Test Files  1 passed (1)
      Tests  22 passed (22)
```

---

## ⚠ THE ONE DESIGN DECISION THAT IS NOT THE SKETCH'S WORDING, AND WHY

**Sketch 174 draws the grounding fold line as `▸ 3 steps must prove their sources`. It did not
ship that sentence, and the reason is a collision between two rules this plan is bound by at
once.**

- `GOVERNANCE_SEAL_LABEL = "Must prove it"` (`definitionOps.ts:505`) is a **locked** string with
  its own substitution audit. **Every shipped sentence that reaches for it COMPOSES it** —
  `seedReceiptGroundingLead` and `seedReceiptStepReason` both do
  `GOVERNANCE_SEAL_LABEL.toLowerCase()` rather than re-typing the words.
- **This module is a TRUE LEAF** — a hard acceptance criterion of this plan
  (`grep -c "^import " → 0`) and a `key_links` entry. **A leaf cannot compose what it cannot
  import.**

So the two available moves were (a) break the leaf property to import the locked label, or
(b) re-type a grammatical variation of it — *"must prove their sources"* — one directory from
the module that owns it. **(b) is exactly the failure `builderStore.ts:147` names**: *two
spellings of a locked string is how a locked string stops being locked*, and a near-spelling is
still a second spelling.

**Taken instead:** the summary line states a plain fact and **does not reach for the governance
vocabulary at all** —

```
groundingFoldSummary(1) === "1 step depends on your documents"
groundingFoldSummary(3) === "3 steps depend on your documents"
```

— and the seal sentence stays where it already lives, inside the fold, on the receipt that owns
it and composes it from the locked identifier. **The `why` action word is what carries the
reader there**, which is the sketch's own composition.

⚠ A second near-duplication was avoided for the same reason: *"reads your documents"* is the
first half of the shipped `seedReceiptGroundingLead` sentence, so `depends on` was chosen over
`reads`. And `DECISION_TEMPLATE_NONE` deliberately avoids `templateFirstVocabulary`'s shipped
`FOOTING_*` tail (*"written from your description alone"*), which belongs to the pre-draft
screen.

---

## D-20, and why the fence is TOTAL rather than per-row

D-20 narrows D-11: `business_requirement_missing` (`grounding.py:1007`) is the **only**
definition-level predicate, so rows 1, 2, 4 and 5 saying otherwise would be **four false claims
about what the gate does**. The obvious fence is per-row. **A total ban is both simpler and
strictly stronger here**, and it is available for a structural reason rather than a stylistic
one: **row 3's verdict is not authored in this repository.** Per D-12 it is the server's
`BUSINESS_REQUIREMENT_MISSING_MESSAGE`, travelling on the D-13 payload and rendered verbatim
(`grounding.py:995-997` — *"this string IS the UI copy"*). With nothing in this module needing to
say it, **no value may say it**, and the fence has no exception to encode.

**The fence sweeps FUNCTION OUTPUT, not only string constants.** A `typeof === "string"` filter
would sweep 12 of the 17 exports and **none of the three values that interpolate a count** —
which is where a sentence is most likely to be assembled wrongly. `ALL_COPY` is the 12 constants
**plus** the five `decisionRowLabel` outputs **plus** both formatters driven at 0/1/2/7 = 25
strings, with a non-vacuity floor asserted before the negative.

**And the corpus cannot silently stop being total.** A fourth exported function would carry copy
`ALL_COPY` never calls, so the sweep would quietly narrow. That is a red test:

```ts
const fns = Object.entries(decisionsVocabulary)
  .filter(([, value]) => typeof value === "function").map(([id]) => id)
expect(fns.sort()).toEqual([...FUNCTION_EXPORTS].sort())
```

This is the **property, not the deny-list** — the Phase-185 lesson that a deny-list cannot be
made fail-closed by extension.

---

## The two named seams — DECLINED, with re-open triggers

The plan required take-it-or-name-it, never neither. Both are declined as instructed, and neither
was re-declared:

1. **`REQUIREMENT_INVITATION` (`WorkflowBuilderPage.tsx:388`), `REQUIREMENT_AI_MARK_LABEL`
   (`:428`) and `REQUIREMENT_AI_MARK_EXPLANATION` (`:432`) stay on the page.** Moving them is a
   real G-5-honouring extraction; it is declined because a vocabulary module importing from a
   *page* inverts the dependency direction the whole `components/workflows` tree depends on, and
   this module's leaf property is a hard criterion. **Re-declaring them here is forbidden and is
   now FENCED**, with the detector shown firing on a plant.
   **Re-open trigger:** the next phase that touches the header affordance copy.
2. **No sentence is authored for row 3's verdict.** It is the server's constant, travelling on
   the D-13 payload (D-12). There is no mechanism in this repository that generates TS copy from
   a Python constant, and a test asserting the two match is precisely what D-12 rejected.
   **Re-open trigger:** any phase that introduces a generated-contract artifact spanning the
   Python/TS boundary for user-visible copy.

---

## Verification — every command run, every verdict quoted

### The plan's two `<verify>` blocks

```bash
$ cd frontend && GSD_VITEST_MAX_WORKERS=2 npx vitest run \
    src/components/workflows/decisionsVocabulary.test.ts

 Test Files  1 passed (1)
      Tests  22 passed (22)
   Duration  1.16s
```

```bash
$ cd frontend && npx tsc --noEmit -p tsconfig.app.json | grep -cE '^src/.*error TS'
33
```

**33 — character-identical to `197-01`'s recorded baseline.** Zero new errors, and
`grep decisionsVocabulary` over the full tsc output returns **nothing**. Run twice: once after
Task 1, once after Task 2. ⚠ The `-p tsconfig.app.json` is load-bearing — a bare `tsc --noEmit`
checks ZERO files in this repo.

### Task acceptance criteria, mechanically

| Criterion | Command | Result |
|---|---|---|
| zero imports | `grep -c "^import " …/decisionsVocabulary.ts` | **0** |
| module size ≥ 120 lines | `wc -l` | **226** |
| all 17 exports present | `grep -nE "^export (const\|function\|type) "` | **17** |
| `POSITIVE CONTROL` ≥ 3 | `grep -c "POSITIVE CONTROL" …test.ts` | **10** |
| D-20 token not contiguous in the suite | `grep -ci "<token>" …test.ts` | **0** |
| …nor anywhere in the module | `grep -ci "<token>" …decisionsVocabulary.ts` | **0** |
| ≥ 7 tests | vitest verdict | **22** |
| totality inputs | `NaN`, `±Infinity`, `-1`, `0`, `1`, `2`, `1.5`, `7` | **8 driven** |

### ⚠ THE COLLATERAL CHECK THE PLAN DID NOT ASK FOR, RUN BECAUSE THE RISK IS REAL

**A new `.ts` file in `components/workflows/` silently joins nine sibling suites' `?raw`
directory globs** (`import.meta.glob("./*.{ts,tsx}")`) — `governanceVocabulary.test.ts` sweeps
that glob for banned governance words, and `ExternalActionSection.test.tsx` sweeps
`/src/**/*.{ts,tsx}`. A module authored without checking those could red four suites it never
imports. Enumerated from source, then run:

```
 Test Files  5 passed (5)        Tests  181 passed (181)
   governanceVocabulary · doorVocabulary · WorkflowDoorSwitch · PhaseFormPanel.rails · ExternalActionSection

 Test Files  4 passed (4)        Tests  273 passed (273)
   WorkflowCanvas · WorkflowCanvas.composition · PhaseNodeCard · SeedReceipt
```

**454 sibling assertions green.** The copy was authored against `governanceVocabulary`'s banned
set deliberately, not by luck — the retired badge phrases and the six never-say words were read
off `:125-146` before any string was written.

### The four standing D-05 numstat criteria (`197-01`, run at wave merge)

```bash
$ git diff --numstat 52e6bcdb8a28b2cda1e3fa06a1bc95b733dbee07 HEAD \
    -- frontend/src/pages/WorkflowBuilderPage.preDraft.baseline.test.tsx \
       frontend/src/components/workflows/WorkflowDoorSwitch.baseline.test.tsx \
       frontend/src/components/workflows/SeedReceipt.tsx \
       backend/app/services/harness/publish_service.py
                                                                   [no output — exit 0]
```

**All four rows absent from the diff: 0 insertions, 0 deletions.** D-05's fast door is
byte-unchanged, D-02's `SeedReceipt` charter is untouched, and D-11/D-20's gauntlet learned
nothing new.

### The whole diff, against the dispatched base

```bash
$ git diff --numstat 7cf919f1438ad92d597f9749acba22bb1e8fab43 HEAD
371     0       frontend/src/components/workflows/decisionsVocabulary.test.ts
226     0       frontend/src/components/workflows/decisionsVocabulary.ts
```

**Exactly the two declared `files_modified`, zero deletions, nothing else touched.** No
`STATE.md`, no `ROADMAP.md`, no sibling's file.

---

## Task Commits

1. **Task 1: the module** — `6a8157a7` · `feat(197-03): the decisions half gets one copy home, and D-07's order becomes data`
2. **Task 2: the fences** — `45de767f` · `test(197-03): fence the decisions copy home, and show every fence firing`

---

## Deviations from Plan

### Auto-fixed / auto-decided

**1. [Rule 2 — Missing Critical] The sketch's grounding fold sentence would have been a second spelling of a locked string**

- **Found during:** Task 1
- **Issue:** Sketch 174's line *"3 steps must prove their sources"* is a grammatical variation of
  `GOVERNANCE_SEAL_LABEL = "Must prove it"`, a locked string every shipped consumer COMPOSES
  rather than re-types. The plan's leaf criterion forbids importing it, so shipping the sketch's
  wording verbatim would have put a second, uncomposable home for a governed concept in a module
  whose entire purpose is to make copy assertable by character-identity.
- **Fix:** Authored a line that does not reach for the governance vocabulary at all
  (*"N steps depend on your documents"*), recorded the reason in the module docblock beside the
  leaf note, and left the seal sentence to the receipt inside the fold. The `why` action word is
  what carries the reader there — the sketch's own composition, preserved.
- **Files modified:** `decisionsVocabulary.ts` only
- **Committed in:** `6a8157a7`

**2. [Rule 2 — Missing Critical] The D-20 fence as specified would have swept 12 of 17 exports and none of the three riskiest**

- **Found during:** Task 2
- **Issue:** The plan says *"lower-case every exported string value"*. Read literally that is a
  `typeof === "string"` filter, which sweeps the 12 plain constants and **excludes all three
  functions** — i.e. every value that interpolates a count or switches on a row key, which is
  where a sentence is most likely to be assembled wrongly.
- **Fix:** The corpus is the 12 constants **plus** the five `decisionRowLabel` outputs **plus**
  both formatters driven at four counts (25 strings), with a non-vacuity floor asserted before
  the negative — **plus** a totality case pinning the exported-function SET, so a fourth function
  cannot silently narrow the sweep. Strengthens the plan's stated criterion; does not depart from
  its intent.
- **Files modified:** `decisionsVocabulary.test.ts` only
- **Committed in:** `45de767f`

**3. [Rule 3 — Blocking, caught before it blocked] The worktree forked from the WRONG base — the known reproducing defect**

- **Found during:** startup, at the dispatched-base assertion
- **Issue:** `git rev-parse HEAD` read **`fda79214`**, not the dispatched
  `7cf919f1438ad92d597f9749acba22bb1e8fab43`; `git merge-base` against the dispatched SHA
  returned a third commit (`3781a3fe`), i.e. the two had genuinely diverged. This is the defect
  the orchestrator's prompt names, **reproducing exactly** — and it reproduced with the identical
  wrong SHA (`fda79214`) that wave 1 measured.
- **Fix:** `git reset --hard 7cf919f1…`, then re-read `git rev-parse HEAD` to confirm. The
  assertion is what caught it; without it this plan would have been authored against a tree
  missing wave 1's tracking commit.
- **Files modified:** none
- **Verification:** `git rev-parse HEAD` → `7cf919f1438ad92d597f9749acba22bb1e8fab43`

---

**Total deviations:** 3 (2 strengthenings, 1 environment correction)
**Impact on plan:** No scope creep. Zero files outside `files_modified` touched.

## Issues Encountered

**None.** ⚠ Notably, **the `ENOSPC` reporter failure `197-01` recorded did NOT recur** — every
vitest invocation in this plan wrote its report cleanly on the first attempt. Recorded because
wave 1's finding was that the signature *reads like a gate failure and carries no test verdict at
all*; a later wave should know it is intermittent rather than persistent.

## Deferred Issues

⚠ **ONE OBLIGATION IS OWED AND IS DELIBERATELY NOT DISCHARGED HERE — it must not be lost.**

**`decisionsVocabulary.ts` is not in the D-24(a) copy fence's `SWEPT_SOURCES` list**
(`WorkflowDoorSwitch.test.tsx:552-559`). That suite's own docblock states the rule in the
strongest terms available:

> *"**any new module on this surface, whether or not it imports `doorVocabulary` yet**"* belongs
> in the list — and *"a fence cannot see a file that is not in its list"*, the same structural
> blindness that let `WorkflowsPage.tsx` escape G-5 for ten phases. It names **vocabulary
> modules specifically** as *"the single most likely place in this repository for a governed
> sentence to be re-typed, because re-typing strings is literally what the file is for."*

**Why it was not done here:** the list lives in `WorkflowDoorSwitch.test.tsx`, which is **outside
this plan's `files_modified`**, and the wave dispatched four sibling executors under a hard
instruction not to touch undeclared files. The suite also asserts `SWEPT_SOURCES` has length
**6** in the same commit as its entries — deliberately, so *"a count that moved on its own is a
list nobody checked"* — so the edit is a two-line coupled change that a second concurrent agent
could conflict on.

**Mitigating measurement, not a substitute for it:** the module was checked by hand against all
22 `doorVocabulary` values and carries **none** of them, in a value or in prose.

**Owed to:** `197-06` / `197-07` (the first plans to import this module) or `197-11`.
**The change:** add `{ path: "./decisionsVocabulary.ts", source: decisionsVocabularySource }` and
bump the asserted length `6 → 7` in the same commit.

## Next Plan Readiness

**Ready.** `197-06` and `197-07` can be written against the contract without exploring:

- Every identifier in the plan's `<interfaces>` block ships spelled exactly.
- `DECISION_ROW_ORDER` is the render order — **map it, never re-type it.** A component that
  hardcodes five rows in JSX re-introduces exactly the drift this module removes.
- Both fold formatters return `""` at zero: the card renders **one conditional line per fold**,
  never a sentence claiming zero of something.
- **The gate pin for this new suite is deliberately NOT added here** — it lands with the other two
  in `197-11`, so no two plans contend for `scripts/vitest-count-gate.cjs`. Its contribution when
  pinned is **+22**.

## Self-Check: PASSED

| Claim | Command | Result |
|---|---|---|
| module exists | `ls frontend/src/components/workflows/decisionsVocabulary.ts` | FOUND (226 lines) |
| suite exists | `ls frontend/src/components/workflows/decisionsVocabulary.test.ts` | FOUND (371 lines) |
| Task 1 commit exists | `git log --oneline` | FOUND `6a8157a7` |
| Task 2 commit exists | `git log --oneline` | FOUND `45de767f` |
| suite green | `vitest run …decisionsVocabulary.test.ts` | 22 passed / 0 failed |
| typecheck at baseline | `tsc -p tsconfig.app.json` | 33 errors = baseline, 0 in scope |
| leaf property | `grep -c "^import "` | 0 |
| D-05 red line intact | the four `numstat` commands | no output — 0 deletions, 0 insertions |
| diff scope | `git diff --numstat <base> HEAD` | exactly the 2 declared files |
| orchestrator artifacts untouched | same numstat | `STATE.md` / `ROADMAP.md` absent |

## Threat Flags

None new. The plan's register is discharged as written:

| Threat ID | Disposition | Evidence |
|---|---|---|
| **T-197-09** (Repudiation — four false gate claims) | **mitigated** | the D-20 fence over 25 strings incl. function output, with a planted-corpus positive control and a function-set totality guard |
| **T-197-10** (Tampering — the locked header strings) | **mitigated** | the declaration fence over comment-stripped source, needles from parts, detector shown firing on a plant |
| **T-197-11** (Repudiation — a 6th row) | **mitigated** | `const _never: never = key` asserted in source **and** driven at runtime with an unmodelled key |
| **T-197-SC** (Tampering — npm installs) | **vacuous, as planned** | no package installed, none proposed |

This plan crossed no trust boundary. The module is a pure zero-import leaf: it reads no input,
opens no request and renders nothing.

---
*Phase: 197-guided-authoring*
*Completed: 2026-08-18*
