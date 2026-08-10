---
phase: 187-business-vocabulary-ai-seeded-canvas
plan: 20
subsystem: ui
tags: [react, vitest, testing-library, copy-lock, governance, seed-receipt]

# Dependency graph
requires:
  - phase: 187-16
    provides: "the CR-01 count split and the carried paragraph whose own defects (CR-03, WR-09) this plan repairs"
  - phase: 187-13
    provides: "SeedReceipt, its suite, and the ?raw source-fence idiom the new coverage guard copies"
  - phase: 185
    provides: "groundingCauseOf — the ONE client grounding derivation, and the D-185-07 one-way detected lock"
provides:
  - "A carried paragraph with the same rigor its sibling already had: presence, COUNT, character-identity against the export, and both zero cases"
  - "A carried sentence that is true of BOTH causes it counts, because it attributes neither (WR-09, closed by deletion)"
  - "data-carried-count — the third fact exposed the same way its two siblings are"
  - "A STANDING testid-coverage guard: every static data-testid the component renders must be queried by the suite, enforced by a committed test rather than a one-off grep"
  - "Four falsification probes with raw output, for 187-21 to transcribe into VALIDATION.md"
affects: [187-21, 187-VALIDATION, 187-REVIEW, phase-188]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A test file importing its OWN source via `?raw` to sweep its own coverage — a string import evaluates no module, so the self-reference creates no cycle"
    - "A coverage guard whose needle is ASSEMBLED per-id at runtime, so the guard's own source cannot satisfy the guard"

key-files:
  created: []
  modified:
    - frontend/src/components/workflows/definitionOps.ts
    - frontend/src/components/workflows/definitionOps.test.ts
    - frontend/src/components/workflows/SeedReceipt.tsx
    - frontend/src/components/workflows/SeedReceipt.test.tsx

key-decisions:
  - "WR-09 closed by DELETING the ' by its own settings' clause, not by replacing it — the reviewer's proposed replacement was rejected on a measured objection (see Deviations)"
  - "The copy lock stays in ONE home. The component suite compares to the export; the exact-string literal lives only in definitionOps.test.ts. This is why PROBE C could not turn the component suite red, and why that is correct rather than a defect (see Deviations, D-20-A)"
  - "The pre-existing PublishGauntlet.test.tsx flake is OUT OF SCOPE and was reproduced at the pre-plan file state rather than assumed"

patterns-established:
  - "Falsification pairs: a probe that mutates the SUBJECT (PROBE C) and a probe that mutates the LINK (PROBE C2) answer different questions; an identity assertion can only ever see the second"
  - "A guard that names the specific id whose absence was the blocker, so it cannot pass by sweeping a set that quietly stopped containing it"

requirements-completed: [VOCAB-02]

# Metrics
duration: 27min
completed: 2026-08-03
---

# Phase 187 Plan 20: Close CR-03 and WR-09 — the carried paragraph, guarded and honest

**The seed receipt's carried sentence now attributes no cause (so it can no longer contradict the escalated row two lines below it on the same card), and the paragraph that rendered it — deletable, corruptible and drift-prone with all 452 tests green — is under presence / count / identity / zero-case guard plus a standing testid-coverage sweep proved by four falsification probes.**

## Performance

- **Duration:** ~27 min
- **Started:** 2026-08-03T17:50Z
- **Completed:** 2026-08-03T18:17Z
- **Tasks:** 3/3
- **Files modified:** 4

## Commits

| Task | Commit | Files |
|------|--------|-------|
| 1 — observe the RED | `debced07` | `SeedReceipt.test.tsx` |
| 2 — make the sentence true | `51a60299` | `definitionOps.ts`, `definitionOps.test.ts`, `SeedReceipt.tsx`, `SeedReceipt.test.tsx` |
| 3 — probes + standing guard | `7593fe8b` | `SeedReceipt.test.tsx` |

## Accomplishments

### CR-03 — the coverage gap, measured then closed

`grep -rn "seed-receipt-carried" frontend/src/` at HEAD (`f632f9b6`) returned **exactly one hit** — the component's own attribute at `SeedReceipt.tsx:276`. Re-measured this session, not inherited.

The paragraph now has presence, a count derived from the shipped fixture constants (`SEALED_SLUGS.length - DETECTED_SLUGS.length`, never a hand-typed `1`), character-identity against `seedReceiptCarriedLead`, and both zero cases (detected-only draft, and a draft with nothing sealed at all). `data-carried-count` joins its two siblings on the section element.

### WR-09 — one paragraph, two causes, no contradiction

`seedReceiptCarriedLead` counts `already-set` **and** `escalated`. It shipped ending `" by its own settings"` — true of the first, false of the second. On an escalated-only draft the card contradicted itself: the paragraph said the step's own settings held it, and `seedReceiptStepReason("escalated")` two lines below said *"you turned this on by hand"*.

Closed by **deletion**. The sentence is now `1 step was already set to must prove it.` / `N steps were already set to must prove it.` — what both causes genuinely share. Which cause is stated per row, by the one function that is actually handed the cause.

### The standing guard

`SeedReceipt.test.tsx` now reads **its own source** via `./SeedReceipt.test?raw` (which resolved cleanly — the plan's shell-command fallback was **not** needed) and asserts every static `data-testid` literal in `SeedReceipt.tsx` is queried by this suite. The needle is assembled per-id at runtime, so the guard's source contains no literal `ByTestId("seed-receipt-…")` and cannot satisfy itself. It also asserts the extracted set is non-empty (no vacuous pass) and names `seed-receipt-carried` explicitly.

## Raw output — for 187-21 to transcribe into VALIDATION.md

### Measurement 1 — the testid-coverage table, BEFORE any edit (the CR-03 falsification)

```
static data-testid in SeedReceipt.tsx -> ByTestId("id") count in SeedReceipt.test.tsx
------------------------------------------------------------------------------
  ok      15  seed-receipt
MISSING    0  seed-receipt-carried
  ok       2  seed-receipt-close
  ok       3  seed-receipt-dismiss
  ok       9  seed-receipt-grounded-list
  ok       2  seed-receipt-grounding
  ok       4  seed-receipt-heading
  ok       6  seed-receipt-lead
  ok       4  seed-receipt-one-way
  ok       3  seed-receipt-step-face
  ok       1  seed-receipt-step-reason
  ok       1  seed-receipt-step-seal
------------------------------------------------------------------------------
static ids: 12   uncovered: 1
EXIT=1
```

```
$ grep -rn "seed-receipt-carried" frontend/src/
frontend/src/components/workflows/SeedReceipt.tsx:276:          data-testid="seed-receipt-carried"
```

The dynamic `data-testid={`seed-receipt-step-${row.slug}`}` is a template literal, correctly excluded from a static extraction; its rows are covered by the per-slug queries in section 1 (`-emit`, `-contracts`, `-policy_check`, `-judgement`, `-archive`).

**AFTER (final):**

```
------------------------------------------------------------------------------
static ids: 12   uncovered: 0
SWEEP_EXIT=0
```

### Measurement 2 — pre-change baselines (re-measured, not inherited)

| Measure | Pre-plan value |
|---|---|
| Five-suite total | `5 passed` / `452 passed (452)` |
| `SeedReceipt.test.tsx` alone | `47 passed (47)` |
| `npx tsc -b` total errors | 33 |
| `npx tsc -b` errors in `src/components/workflows/` | 0 |
| Count-gate total (blast radius) | 2075, **1 failing** |

### Task 1 — the observed RED (the WR-09 cause fence, against the shipped sentence)

```
 FAIL  src/components/workflows/SeedReceipt.test.tsx > SeedReceipt — the carried paragraph > attributes the seal to NO CAUSE on the mixed draft
AssertionError: expected '1 step was already set to must prove …' not to contain 'by its own settings'

Expected: "by its own settings"
Received: "1 step was already set to must prove it by its own settings."

 FAIL  ... > nor on the already-set-only draft
 FAIL  ... > nor on the escalated-only draft, whose row says the opposite

 Test Files  1 failed (1)
      Tests  3 failed | 54 passed (57)
EXIT=1
```

**Honest split of the new cases at arrival**, as the plan required:

- **RED on arrival (3):** the three cause-honesty fence cases. These are the WR-09 falsifier.
- **GREEN on arrival (7):** presence / identity, alone-on-the-non-KB-draft, escalated-draft, both zero cases, the positive control, and the one-way-lock case. They cover behaviour that was already correct; the paragraph simply had nothing asserting it. **Their bite is proved by probes A, B and C2, not by a red here** — which is the whole reason those probes exist.

### PROBE A — delete the carried paragraph (`SeedReceipt.tsx`)

```
     × renders it, character for character, over the CARRIED count
     × renders ALONE on the typical non-KB draft — no detected paragraph above it
     × renders on the draft whose only seal the AUTHOR escalated by hand
     × attributes the seal to NO CAUSE on the mixed draft
     × nor on the already-set-only draft
     × nor on the escalated-only draft, whose row says the opposite
     × the one-way lock never travels with it (D-185-07)
     × renders each sentence identically to its definitionOps export
TestingLibraryElementError: Unable to find an element by: [data-testid="seed-receipt-carried"]   (×8)
 Test Files  1 failed (1)
EXIT=1
```

Reverted: `git checkout -- frontend/src/components/workflows/SeedReceipt.tsx` → `git diff --quiet -- frontend/` **exit 0**.

### PROBE B — corrupt the count (`carriedCount = rows.length`)

This is the substitution CR-03 named explicitly: the old suite could not see it at all.

```
     × marks the CARRIED count too — the seals this generation did NOT apply
     × the carried count reads 0 on a draft the AI grounded entirely by itself
     × renders it, character for character, over the CARRIED count
     × is ABSENT — no node at all — when every seal is one the AI detected
     × renders each sentence identically to its definitionOps export

AssertionError: expected '3 steps were already set to must prov…' to be '1 step was already set to must prove …' // Object.is equality
Expected: "1 step was already set to must prove it."
Received: "3 steps were already set to must prove it."
AssertionError: expected <p …(2)></p> to be null

 Test Files  1 failed (1)
      Tests  5 failed | 54 passed (59)
EXIT=1
```

Reverted: `git diff --quiet -- frontend/` **exit 0**; `SeedReceipt.tsx:213` back to `const carriedCount = rows.length - detectedCount`.

### PROBE C — drift the formatter text (`already set` → `already configured`, `definitionOps.ts`, no test touched)

```
     × the carried lead names the count and the SHIPPED governance words
     × ZERO carried steps yields NO carried paragraph — the same shape as its sibling
 FAIL  src/components/workflows/definitionOps.test.ts > definitionOps — the seed-receipt copy is a lock (sketch 150-B) > the carried lead names the count and the SHIPPED governance words
 FAIL  src/components/workflows/definitionOps.test.ts > ... > ZERO carried steps yields NO carried paragraph — the same shape as its sibling
 Test Files  1 failed | 4 passed (5)
      Tests  2 failed | 463 passed (465)
EXIT=1
```

**`SeedReceipt.test.tsx` stayed GREEN.** The plan predicted this might happen and prescribed "repair the identity assertion". That prescription is **refuted** — see Deviations D-20-A below, and PROBE C2, which is the probe that actually answers the question the plan was asking.

Reverted: `git diff --quiet -- frontend/` **exit 0**.

### PROBE C2 — drift the COMPONENT away from the export (added because PROBE C could not answer the question)

`{carriedLead}` → `{carriedLead.replace("already set", "already configured")}` in `SeedReceipt.tsx`.

```
     × renders it, character for character, over the CARRIED count
     × renders ALONE on the typical non-KB draft — no detected paragraph above it
     × renders on the draft whose only seal the AUTHOR escalated by hand
     × renders each sentence identically to its definitionOps export
Expected: "1 step was already set to must prove it."
Received: "1 step was already configured to must prove it."   (×4)
 Test Files  1 failed (1)
      Tests  4 failed | 55 passed (59)
EXIT=1
```

The identity assertion **is** doing its job. Reverted: `git diff --quiet -- frontend/` **exit 0**.

### PROBE D — remove every carried query from the test file (does the guard guard itself?)

```
     × every STATIC testid the component renders is queried by this suite (187-20)
AssertionError: expected '/**\n * Phase 187-13 Task 2 — Req 5\'…' to contain 'ByTestId("seed-receipt-carried")'
 Test Files  1 failed (1)
      Tests  1 failed | 49 passed (50)
EXIT=1
```

**Exactly one failure, and it is the guard.** The removed cases vanish rather than fail, so nothing else masks the signal. Reverted: `git diff --quiet -- frontend/` **exit 0**.

### Final gates

```
$ cd frontend && npx vitest run src/components/workflows/SeedReceipt.test.tsx \
    src/components/workflows/StepTypePicker.test.tsx \
    src/components/workflows/phaseVocabulary.test.ts \
    src/components/workflows/phaseVocabulary.corpus.test.ts \
    src/components/workflows/definitionOps.test.ts
 Test Files  5 passed (5)
      Tests  466 passed (466)
EXIT=0
```

`466 > 452` — strictly greater, so no suite was replaced rather than extended (the Phase-177 lesson). Per-file: `SeedReceipt.test.tsx` 47 → 60, `definitionOps.test.ts` 227 → 228.

```
$ node scripts/vitest-count-gate.cjs
  SeedReceipt.test.tsx                          —      60     new
  definitionOps.test.ts                         —     228     new
  total                                       415    2089   +1674
  total 2089  ·  failed 1  ·  pinned total 415
RESULT: COUNT GATE VIOLATED (1 reason(s))
  FAIL  [failing-tests] 1 test(s) failed — the gate requires 0.
```

**No `[count-decrease]`, no `[missing-file]`, no `[total-below-baseline]`.** The single reason is `[failing-tests]`, and it is pre-existing — see Deviations D-20-B. `scripts/vitest-count-gate.cjs` was **not** edited (`git status --porcelain scripts/vitest-count-gate.cjs` empty).

```
$ cd frontend && npx tsc -b
tsc -b total errors: 33          # == the re-measured pre-change baseline
tsc -b workflows errors: 0

$ cd frontend && npx vite build
✓ built in 4.33s
BUILD_EXIT=0
```

```
$ grep -n "own settings" frontend/src/components/workflows/definitionOps.ts
600: *     ending " by its own settings", which is a claim about WHICH cause holds the step,
```

Exactly one remaining hit, inside the repaired **docblock** (it quotes the removed clause to explain the defect). Zero inside `seedReceiptCarriedLead`'s return expressions. `GROUNDING_ALREADY_SET_NOTE` never contained the phrase — its wording is "that comes from its citation policy above, not from this dial", so it is untouched and was never a candidate.

```
$ grep -c "WR-09" frontend/src/components/workflows/definitionOps.ts
1
$ grep -c "seedReceiptCarriedLead" frontend/src/components/workflows/SeedReceipt.test.tsx
7
$ grep -c "seed-receipt-carried" frontend/src/components/workflows/SeedReceipt.test.tsx
12
$ grep -c "data-testid" frontend/src/components/workflows/SeedReceipt.test.tsx     # was 0 at 51a60299
2
```

### Scope proofs

```
$ git diff --stat 35261e96 HEAD -- supabase/migrations       ->  (empty)
$ git diff --numstat -- frontend/src/pages/WorkflowBuilderPage.tsx  ->  (empty)   # D-187-14 mount cap untouched
$ git diff --stat -- backend/                                 ->  (empty)
$ git diff --stat -- frontend/src/components/workflows/StepTypePicker.tsx \
                     frontend/src/components/workflows/StepTypePicker.test.tsx    ->  (empty)   # WR-08 stays out of scope
$ git diff --stat -- frontend/package.json frontend/package-lock.json  ->  (empty) # T-187-20-SC: no package installed
```

Per-commit file lists: Task 1 = 1 file; Task 2 = 4 files, all under `frontend/src/components/workflows/`; Task 3 = 1 file.

## Deviations from Plan

### D-20-A — [Rule 1 - measured refutation] PROBE C's component half is unsatisfiable by construction, and the plan's prescribed "repair" would be a regression

**Found during:** Task 3, PROBE C.

**The plan says:** PROBE C "MUST go RED in `definitionOps.test.ts` … AND in `SeedReceipt.test.tsx` (… if the component test stays green here, the identity assertion is not doing its job and must be repaired before this task can pass)."

**Observed:** RED in `definitionOps.test.ts` (2 cases). **GREEN** in `SeedReceipt.test.tsx`.

**Why that is correct, not a defect.** The component assertion is `textContent === seedReceiptCarriedLead(n)`. PROBE C mutates the formatter — i.e. **both sides of that equation at once**. No assertion of the form `rendered === export` can detect a change that moves `rendered` and `export` together; that is arithmetic, not a weakness in the assertion. What such an assertion IS the guard for is component↔formatter **disagreement**, and PROBE C2 (added for exactly this reason) turns it red on 4 cases including the section-4 identity case. The guard that sees PROBE C is the **exact-string unit lock** in `definitionOps.test.ts` — which fired, on both of its cases.

**Why the prescribed repair was not applied.** Making `SeedReceipt.test.tsx` bite on a formatter-internal word swap requires it to hold a **hand-typed literal of the copy**. That would:
1. contradict this file's own docblock — *"every sentence is compared character-for-character against its `definitionOps` export, **never against a hand-typed copy**, because a hand-typed copy drifts in exactly the same silence the copy module exists to break (T-187-13-05)"* — the very claim this plan's Task 2 was written to make TRUE; and
2. put the copy lock in **two homes**, which is the project's one-home-per-concern red line and the reason `definitionOps.ts` exists at all.

**Independent evidence that the component suite DOES bite on formatter-side change.** Task 1's RED is exactly that event: a **property** of the formatter's output (the cause clause) changed the component suite's verdict with no test edit. The component suite is blind only to changes that are *semantically neutral to every property it asserts* — which is the correct blindness for a suite whose copy lock lives elsewhere.

**Recorded for 187-21 / the reviewer:** if this reasoning is rejected, the repair is a one-line addition to `SeedReceipt.test.tsx`, but it should be accompanied by a deliberate decision to duplicate the copy lock, not slipped in as a test fix.

### D-20-B — [scope boundary] a pre-existing `PublishGauntlet.test.tsx` flake keeps the count gate at exit 1

**Found during:** Task 2 verification.

**Issue:** `node scripts/vitest-count-gate.cjs` exits 1 with a single `[failing-tests]` reason. The failures are:

```
 FAIL  src/components/workflows/PublishGauntlet.test.tsx > PublishGauntlet — form + verbatim verdict + judge hard wall > the 4 HTTP outcomes each render distinctly
 FAIL  src/components/workflows/PublishGauntlet.test.tsx > ... > named_failures key-detection: a MIXED list (lint dict + bare string) renders the lint row (lowercase code) AND the bare string as a block — the verdict is a block, never a pass
```

**Proved pre-existing rather than assumed.** The four modified files were copied aside, restored to `debced07~1` (the pre-plan state) with `git checkout`, and the gate re-run: **total 2075, failed 1**, and the blast-radius run named the same two `PublishGauntlet.test.tsx` cases. The files were then restored from the copies (no `git stash`, no `git clean` — both forbidden here).

**Also measured:** `PublishGauntlet.test.tsx` passes **green in isolation**; the failure count varies run to run (2, then 1), i.e. a parallel-execution flake, not a deterministic break. It imports nothing from `definitionOps` or `SeedReceipt` (`grep` returns zero).

**Action:** none. Out of scope per the executor scope boundary — not caused by this task's changes. Recorded to `deferred-items.md` for the phase. It does **not** mask this plan's own gates: the five named suites are `5 passed / 0 failed / 466`, and the gate reports no `[count-decrease]`, no `[missing-file]` and no `[total-below-baseline]`.

### D-20-C — [addition] PROBE C2 was added

Not in the plan. Added because PROBE C could not answer the question the plan wanted answered (D-20-A). Recorded here so the probe set on file is 5, not 4.

## Threat Flags

None. This plan opened no endpoint, no auth path, no file access and no schema surface. `T-187-20-SC` is discharged: `git diff --stat -- frontend/package.json frontend/package-lock.json` is empty; no package was installed.

## Known Stubs

None.

## Requirements

`VOCAB-02` is **advanced, not completed, by this plan.** No completion record was written: `requirements.mark-complete`, `state.advance-plan` and `roadmap.update-plan-progress` were **not** called (they write false records in this project). `STATE.md` and `ROADMAP.md` were not modified by this executor.

## Self-Check: PASSED

- `frontend/src/components/workflows/SeedReceipt.test.tsx` — FOUND
- `frontend/src/components/workflows/SeedReceipt.tsx` — FOUND
- `frontend/src/components/workflows/definitionOps.ts` — FOUND
- `frontend/src/components/workflows/definitionOps.test.ts` — FOUND
- `.planning/phases/187-business-vocabulary-ai-seeded-canvas/187-20-SUMMARY.md` — FOUND
- commit `debced07` — FOUND
- commit `51a60299` — FOUND
- commit `7593fe8b` — FOUND
