---
phase: 197-guided-authoring
plan: 04
subsystem: frontend
tags: [pure-derivation, soul-data, tdd-red-first, defensive-ladder, d-18, auth-02]

# Dependency graph
requires:
  - phase: 197
    plan: 01
    provides: "The phase base SHA as a literal, the four standing numstat criteria, and the tsc baseline of 33"
  - phase: 124
    provides: "soulData.ts — the single shared soul-data module and `soulDeliverable`, the derivation this one sits beside without duplicating"
  - phase: 193
    plan: 02
    provides: "templateAdmission — the arm-per-reason defensive-shape ladder copied here, and the no-second-derivation rule quoted verbatim"
provides:
  - "terminalEmitSlug(def) — the one derivation naming WHICH step produces the deliverable, `string | null`"
  - "A DECLARED tie-break (greatest phase_index; ties and unusable indices fall to last-in-array-order) pinned by cases rather than left to sort stability"
  - "The row-4/row-5 coupling made mechanically checkable instead of remembered"
  - "The slug rows 2 and 5 both hand to the page's shipped jumpToStep seam — making them ONE mechanism"
affects: [197-06, 197-07, wave-merge, phase-close]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Net-new ordering logic driven RED-FIRST twice: once against absence, once against a deliberate wrong-implementation plant"
    - "Non-duplication of a sibling derivation proved by DISAGREEMENT on a real shape, not by assertion in a docblock"
    - "A candidate whose identifier cannot select anything is excluded rather than returned — an honest null over a dead jump target"

key-files:
  created:
    - ".planning/phases/197-guided-authoring/197-04-SUMMARY.md"
  modified:
    - "frontend/src/components/workflows/soulData.ts"
    - "frontend/src/components/workflows/soulData.test.ts"

key-decisions:
  - "The MIXED case (one candidate indexed, one not) resolves to ARRAY ORDER, not to treating a missing index as 0 — a numeric comparison in which one operand does not exist is not a comparison"
  - "An llm_emit phase with an unusable slug is excluded from candidacy, so a definition can make a file and still answer null — the two functions are allowed to disagree, and that disagreement is the non-duplication proof"
  - "soulDeliverable was NOT refactored to route through the new export; its order-independent .some() is correct for its own question and is under a shipped suite"
  - "The full count gate was NOT run: the change provably cannot affect another suite (zero mocks of soulData, zero consumers of the new export), and the deterministic per-file delta is recorded instead"

patterns-established:
  - "A tie-break is a declared contract with its own case, never an artefact of sort stability"
  - "An existence-RED is not an ordering-RED — plant the plausible wrong implementation and quote its verdict too"

requirements-completed: [AUTH-02]

# Metrics
duration: 26min
completed: 2026-08-18
---

# Phase 197 Plan 04: terminalEmitSlug Summary

**One pure `string | null` derivation naming WHICH step produces the deliverable — with a declared tie-break, `templateAdmission`'s defensive ladder copied arm for arm, and thirteen cases including the array-order plant that proves the ordering case pins ordering rather than existence.**

## Performance

- **Duration:** 26 min
- **Tasks:** 2
- **Files modified:** 2 (exactly the declared `files_modified`)
- **Insertions / deletions:** 302 / **0**

---

## ⚠ THE DISPATCHED-BASE DEFECT REPRODUCED, AND THE ASSERTION CAUGHT IT

Recorded first because it is the second consecutive wave to hit it and it is silent when unasserted.

```
$ git merge-base HEAD 7cf919f1438ad92d597f9749acba22bb1e8fab43
3781a3fe4690a9619e619f4cc412bd37a7dafc52
$ git rev-parse HEAD
fda792141b0129de7b15dd40ddc1082e76f95a2a
```

The worktree was created at **`fda79214`** — not the dispatched `7cf919f1`, and not even an ancestor
of it (their merge-base is a third commit, `3781a3fe`). This is the **same wrong SHA `fda79214`**
that CLAUDE.md records wave 1's worktree forking from. `git reset --hard` to the dispatched base
corrected it; every number in this SUMMARY is measured on the correct base.

**Standing implication:** the base assertion is not ceremony here — it is load-bearing, it fires,
and without it this plan would have measured a baseline and a diff against the wrong tree.

---

## Task 1 — `terminalEmitSlug`, a pure addition beside `soulDeliverable`

**Commit `abb0a7fb`** · `frontend/src/components/workflows/soulData.ts` · **97 insertions, 0 deletions**

The objective's premise was verified rather than assumed before writing anything:

```
$ grep -rn "terminalEmitSlug" frontend/src
                                                    [no matches — 0 occurrences]
```

### The shape

```ts
export function terminalEmitSlug(def: DefShape | null | undefined): string | null
```

Four arms, each carrying its reason, copying `templateAdmission`'s arm-per-reason ladder:

| Arm | Condition | Answer | Reason |
|---|---|---|---|
| (1) | `!def \|\| !Array.isArray(def.phases)` | `null` | The wire did not say — **including the jsonb STRING SCALAR** shape 194 of 223 live rows carry |
| (2) | candidate set = `llm_emit` phases **with a usable slug** | — | A slug that is absent, non-string or empty after trim is **not a candidate** (T-197-13) |
| (3) | `candidates.length === 0` | `null` | Nothing this card could point at |
| (4) | greatest `phase_index`; `>=` in the fold | slug | Ties fall to **last in array order**; so does any candidate lacking a usable numeric index |

### The three things the docblock is required to carry, and does

1. **The no-second-derivation rule, quoted verbatim** from `soulData.ts:236-240` — *"a second answer
   to one question is the drift this module exists to forbid. Nothing here re-implements a derivation
   `soulDeliverable` or `tierForDefinition` already owns."* The docblock states that `soulDeliverable`
   remains the ONE owner of *whether*, that its `.some()` is **correct** for that question, and that a
   caller wanting both facts asks both functions.
2. **The declared tie-break**, with the mixed case resolved explicitly rather than left implicit.
3. **The row-4/row-5 coupling** — `soulDeliverable`'s label interpolates the workflow **NAME**, so the
   deliverable row's *label* moves when the name row is edited, while `terminalEmitSlug` is
   name-independent **by construction** (it reads `slug` / `phase_index` / `phase_type` and never
   touches `def.name`). The jump target must not move when the author renames the workflow.

### Acceptance criteria — every one measured

| Criterion | Command | Result |
|---|---|---|
| Exactly one export | `grep -c "export function terminalEmitSlug" …/soulData.ts` | **1** |
| No call to `soulDeliverable`, returns only `string \| null` | read + signature | ✅ — no `{kind:…}` shape anywhere in the body |
| **Zero deletions** — pure addition | `git diff --numstat <base> -- soulData.ts` | **`97  0`** |
| No NEW tsc error vs `197-01`'s baseline | `npx tsc --noEmit -p tsconfig.app.json` | **33** — identical to the recorded baseline |
| No tsc error in the touched module | same, filtered to `soulData` | **zero lines** |

⚠ The `-p tsconfig.app.json` is load-bearing — a bare `tsc --noEmit` checks ZERO files in this repo.

---

## Task 2 — thirteen additive cases, and the RED evidence

**Commit `0a6171f6`** · `frontend/src/components/workflows/soulData.test.ts` · **205 insertions, 0 deletions**

### The suite baseline, RE-DERIVED (the plan explicitly forbids inheriting `36`)

```
$ GSD_VITEST_MAX_WORKERS=2 npx vitest run src/components/workflows/soulData.test.ts
 Test Files  1 passed (1)
      Tests  36 passed (36)
```

**36 at the dispatched base.** It agrees with the inherited pin — and was still measured, because the
only way to know which case you are in is to run the command. Final: **49**, a delta of **+13**
against the required ≥ 10.

### ⚠ THE RED EVIDENCE — TWO VERDICTS, AND THE SECOND IS THE ONE THAT MATTERS

**RED 1 — the descending-order case against an ABSENT implementation.** Taken before a single byte of
`soulData.ts` moved:

```
 FAIL  src/components/workflows/soulData.test.ts > soulData.terminalEmitSlug — RED-FIRST PROBE >
       two emit phases with DESCENDING phase_index in array order → the greater index's slug
TypeError: terminalEmitSlug is not a function
 ❯ src/components/workflows/soulData.test.ts:429:7

 Test Files  1 failed (1)
      Tests  1 failed | 36 passed (37)
```

**RED 2 — the same case against a PLAUSIBLE WRONG IMPLEMENTATION.** ⚠ **RED 1 alone does not earn
what the plan claims for this case.** "The function does not exist yet" is a weaker statement than
"this case distinguishes the new logic from `soulDeliverable`'s order-independent `.some()`" — an
existence-RED would be produced by *any* new export, including one that blindly returned the last
filtered element. So the array-order implementation was **planted deliberately** and the case re-run:

```
 FAIL  src/components/workflows/soulData.test.ts > … DESCENDING phase_index …
AssertionError: expected 'draft' to be 'final' // Object.is equality

Expected: "final"
Received: "draft"
```

**That is an ORDERING failure, not an existence failure** — the plant was reverted immediately and is
not in either commit. This is the verdict that proves the case is falsifiable against the wrong
answer a reasonable implementer would actually write.

**GREEN** after the real implementation: `Tests  37 passed (37)`, then `49 passed (49)` with the full
describe.

### The cases

| # | Case | Arm driven |
|---|---|---|
| 1 | Two emits, `phase_index` **ascending** → greater index's slug | (4) |
| 2 | Two emits, `phase_index` **DESCENDING in array order** → still the greater index's slug | (4) — **the RED-first case**; title carries the `phase_index` token |
| 3 | **Equal** `phase_index` → LAST in array order | (4) tie-break |
| 4 | **Missing** index, and a non-numeric / `NaN` index → LAST in array order | (4) fallback + `Number.isFinite` guard |
| 5 | **MIXED** — one candidate indexed, one not → array order | (4) — its own case on purpose (below) |
| 6 | One `llm_emit` **mid-array** among four phases → the emit's slug | (2) — the filter proven to filter |
| 7 | No emit phase → `null` | (3) |
| 8 | `null` / `undefined` → `null`, never throws | (1) |
| 9 | `{}` · `phases: null` · non-array · `[]` · **jsonb string scalar** → `null` | (1) |
| 10 | Slug absent / non-string / empty-after-trim → `null`; **and a usable sibling still wins** | (2) / T-197-13 |
| 11 | Phase list with no `config`, and `config: {}` → `null` | (2), the WR-05 silence |
| 12 | **Disagrees with `soulDeliverable`** on an unusable-slug definition | non-duplication |
| 13 | **Name-independence** — renaming moves the label, not the target | the row-4/row-5 coupling |

### Two cases that are more than coverage

**Case 5 — the MIXED arm gets its own `it()`** because it is the arm a later reader is most likely to
"simplify" into *"greatest index wins, treat a missing index as 0"*. That simplification answers
`"indexed"` where the declared contract answers `"unindexed"`, and it would silently change the jump
target on a real draft. The decision recorded in the docblock: **a numeric comparison in which one
operand does not exist is not a comparison**, and the array is the definition's own serialised order.

**Case 12 — the non-duplication proof is a DISAGREEMENT, not an assertion.** On a definition whose
sole emit phase carries an unusable slug, `soulDeliverable(def).kind === "file"` (correct — it *does*
make a file) while `terminalEmitSlug(def) === null` (correct — there is no step to point at). This
mirrors the shipped `templateAdmission` precedent exactly: *"If templateAdmission agreed with it on
every shape, the new mark would be a second word for a fact this surface already states."* A docblock
claiming the questions differ proves nothing; two functions measurably disagreeing does.

**Case 13 carries a non-vacuity assertion.** It asserts the label genuinely **moved**
(`expect(after.label).not.toBe(before.label)`) alongside the slug staying equal — otherwise the
invariance claim would be two reads of something that never changes, which is the shape of a test
that passes for the wrong reason.

### Acceptance criteria — measured

| Criterion | Result |
|---|---|
| Suite passes | **`Tests  49 passed (49)`** |
| ≥ 10 more than the re-derived base value | **36 → 49 = +13** ✅ |
| Descending case exists, title contains `phase_index` | ✅ *"two emit phases with DESCENDING **phase_index** in array order → still the greater **phase_index**'s slug"* |
| RED output of the descending case quoted, taken before the implementation | ✅ both verdicts above |
| **Zero deletions** — additive describe, no existing case edited | **`205  0`** |

---

## Verification

| Check | Command | Result |
|---|---|---|
| In-scope suite | `GSD_VITEST_MAX_WORKERS=2 npx vitest run src/components/workflows/soulData.test.ts` | **49 passed / 0 failed** |
| Typecheck | `npx tsc --noEmit -p tsconfig.app.json` | **33** — identical to `197-01`'s baseline, zero in `soulData` |
| Zero deletions, both files | `git diff --numstat <base> HEAD` | `205 0` and `97 0` |
| **Scope fence** | `git diff --numstat <base> HEAD` (whole diff) | **exactly the two declared files** |

### The four standing D-05 numstat criteria — run, as the wave-merge obligation requires

```
$ git diff --numstat 52e6bcdb8a28b2cda1e3fa06a1bc95b733dbee07 HEAD \
    -- frontend/src/pages/WorkflowBuilderPage.preDraft.baseline.test.tsx \
       frontend/src/components/workflows/WorkflowDoorSwitch.baseline.test.tsx \
       frontend/src/components/workflows/SeedReceipt.tsx \
       backend/app/services/harness/publish_service.py
                                                                   [no output — exit 0]
```

**All four clean: 0 insertions, 0 deletions.** The pre-draft describe screen is byte-unchanged on both
doors, `SeedReceipt.tsx` does not appear in the diff at all, and the publish gauntlet learned nothing.
Run despite this plan touching none of those paths, because the criterion is *run at every wave
merge*, not *run when you suspect a problem*.

### ⚠ Why the full count gate was NOT run, stated as a decision rather than omitted

The plan's `<verification>` block asks for three things — the in-scope suite, `tsc`, and zero
deletions — and all three are green above. The full gate was deliberately skipped, and the reasoning
is recorded because "we skipped a gate" must never be silent:

1. **The change provably cannot affect another suite.** `grep "vi\.mock\(…soulData"` over
   `frontend/src` returns **zero matches**, so the Phase 196-08 failure mode (249 real failures from
   `@/lib/api` mock factories missing a newly-added runtime export) has no mechanism here. And **no
   consumer calls `terminalEmitSlug` yet** — `197-06` is the plan that wires it.
2. **Both modified files are additive with zero deletions**, so no existing assertion changed.
3. **The gate is not reliably reachable on demand** (CLAUDE.md CORRECTION 2026-08-17 / SEED-171), and
   wave 1 measured a **fake** gate failure on this very box — vitest's reporter dying with `ENOSPC`
   inside `JsonReporter.writeReport`, exit 2, **carrying no test verdict at all** — with four sibling
   agents live. Spending a full-gate run under that condition risks manufacturing exactly that
   signature.
4. **CLAUDE.md's own guidance prefers the deterministic signal:** *"pair it with the per-file deltas
   and the explicitly-run in-scope suites, which are deterministic."* Both are recorded: `soulData.test.ts`
   **36 → 49**, a per-file **increase**, which is the gate's contract satisfied (no per-file DECREASE,
   zero failing).

⚠ **`scripts/vitest-count-gate.cjs` pins `soulData.test.ts: 36` and was deliberately NOT edited** — it
is outside this plan's `files_modified`, a sibling wave-2 agent may own it, and `197-01` names it as an
**explicit exclusion** from the zero-deletion rule for exactly this reason (raising a pin necessarily
deletes the line carrying the old number). **49 > 36 is an increase, which the gate accepts.** Whoever
raises the pin does so in the plan that owns that file.

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 — Missing Critical] The plan's RED evidence, as specified, would not have earned the claim it is made to support**

- **Found during:** Task 2
- **Issue:** The plan's acceptance criterion asks only that the SUMMARY *"quotes the RED output of the
  descending-order case taken before the implementation satisfied it."* Taken literally that is
  satisfied by `TypeError: terminalEmitSlug is not a function` — an **existence**-RED, which *any*
  new export produces, including one that blindly returns the last filtered element. But the claim the
  case is written to support is stronger and is stated twice in the plan: this case *"distinguishes the
  new logic from `soulDeliverable`'s order-independent `.some()`."* An existence-RED is evidence for a
  different proposition than the one being asserted, and this project's own recorded lesson (192 CR-01)
  is precisely that *both failure tests pinned the correct branch without ever entering the wrong one*.
- **Fix:** Captured a **second** RED by planting the plausible wrong implementation (selection by array
  order) and re-running the case, yielding `AssertionError: expected 'draft' to be 'final'`. The plant
  was reverted immediately and appears in no commit. Both verdicts are quoted above.
- **Files modified:** none beyond the plan's declared two (the plant was transient)
- **Verification:** the two RED verdicts and the subsequent `49 passed (49)` GREEN
- **Committed in:** `0a6171f6` (the case and its comment naming the plant)

**2. [Rule 3 — Blocking] The worktree forked from the wrong base**

- **Found during:** startup, before any file was read
- **Issue:** HEAD was `fda792141b0129de7b15dd40ddc1082e76f95a2a`, not the dispatched
  `7cf919f1438ad92d597f9749acba22bb1e8fab43`; their merge-base is a third commit `3781a3fe`, so the
  dispatched base was not even an ancestor. Every baseline and every numstat criterion would have been
  measured against the wrong tree.
- **Fix:** `git reset --hard` to the dispatched SHA, per the sanctioned recovery in the assertion block
  (the one place a hard reset is permitted). Verified `git rev-parse HEAD` afterwards.
- **Files modified:** none
- **Verification:** `git rev-parse HEAD` → `7cf919f1438ad92d597f9749acba22bb1e8fab43`; `git status --short` empty
- **Committed in:** n/a — a pre-work correction

---

**Total deviations:** 2 auto-fixed (1 missing critical, 1 blocking)
**Impact on plan:** Neither changed the plan's scope. Deviation 1 strengthens the evidence behind the
plan's own headline claim; deviation 2 is the difference between measuring this plan and measuring a
different tree. No file outside `files_modified` was touched.

## Issues Encountered

None beyond the two deviations. No disk-pressure failure was observed in this worktree — every vitest
run completed and wrote its report, unlike wave 1's `ENOSPC` reporter death.

## Next Phase Readiness

**Ready. `197-06` can now build rows 2 and 5 as ONE mechanism.**

Obligations and facts handed forward:

1. **`terminalEmitSlug(def)` is importable from `@/components/workflows/soulData`** and returns
   `string | null`. It is **not yet called anywhere** — `197-06` is its first consumer.
2. ⚠ **`null` has two distinct causes and the caller must not conflate them:** *no emit step exists*
   and *an emit step exists but its slug cannot select anything*. Both mean "render no jump control",
   which is why one return value is correct — but a caller wanting *"does this make a file"* must ask
   **`soulDeliverable`**, which answers `file` in the second case. Case 12 pins that they disagree.
3. ⚠ **Do not derive the jump target from the deliverable LABEL.** The label carries the workflow name
   and moves when row 4 is edited; the target must not. Case 13 pins it.
4. **`scripts/vitest-count-gate.cjs` still pins `soulData.test.ts: 36` against an actual 49.** That is
   an increase and the gate accepts it, but whichever plan owns that file may raise the pin — and per
   `197-01`'s **EXCLUSION 2**, doing so necessarily deletes a line, so a `grep -c '^-[^-]'` expecting
   `0` on that file is wrong by construction.
5. **The dispatched-base defect reproduced again** (`fda79214`, the same wrong SHA as wave 1). Keep
   asserting it in every executor prompt.

## Self-Check: PASSED

| Claim | Command | Result |
|---|---|---|
| SUMMARY exists | `ls .planning/phases/197-guided-authoring/197-04-SUMMARY.md` | FOUND |
| Task 1 commit exists | `git log --oneline` | FOUND `abb0a7fb` |
| Task 2 commit exists | `git log --oneline` | FOUND `0a6171f6` |
| `terminalEmitSlug` exported exactly once | `grep -c "export function terminalEmitSlug"` | **1** |
| Suite green | `vitest run soulData.test.ts` | **49 passed / 0 failed** |
| Typecheck at baseline | `tsc -p tsconfig.app.json` | **33**, zero in `soulData` |
| Zero deletions, both files | `git diff --numstat <base> HEAD` | `205 0` · `97 0` |
| No file outside `files_modified` | `git diff --numstat <base> HEAD` | exactly 2 paths |
| STATE.md / ROADMAP.md untouched | same | absent from the diff |
| D-05 red line intact | the four-path numstat | **no output** |
| Working tree clean | `git status --short` | empty |

## Threat Flags

None — no new security-relevant surface. This plan crossed no trust boundary at runtime, installed no
package, opened no route and touched no backend file.

The register's three entries, each with its disposition discharged:

| Threat ID | Disposition | Evidence |
|---|---|---|
| **T-197-12** — Tampering, a malformed definition | **mitigated** | `templateAdmission`'s ladder copied arm for arm; every non-conforming shape resolves to `null` rather than throwing. Cases 8-11 drive each arm, including the **jsonb string scalar** that 194 of 223 live rows carry |
| **T-197-13** — Repudiation, a slug that names no step | **mitigated** | A candidate with an absent, non-string or empty-after-trim slug is excluded, so the value handed to `jumpToStep` either selects a real step or is `null`. Case 10 drives it — **and additionally proves an unusable slug does not disqualify a usable sibling** |
| **T-197-SC** — Tampering, npm installs | **vacuous with reason** | No package was installed and none was proposed |

---
*Phase: 197-guided-authoring*
*Completed: 2026-08-18*
