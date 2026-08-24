---
phase: 197-guided-authoring
plan: 05
subsystem: frontend
tags: [builder-store, zustand, meta-write, d-15, naming, g-5-honoured, red-driven]

# Dependency graph
requires:
  - phase: 197
    plan: 01
    provides: "the phase base SHA as a literal, the four numstat criteria, and the tsc/vitest baselines this plan compares against"
  - phase: 193.2
    provides: "setBusinessRequirement — the ONE-`set()` discipline and the no-second-copy-of-a-server-predicate rule this action inherits"
  - phase: 186
    provides: "setProjectFolder — the simpler sibling shape this action takes, and the `dirty`-in-the-same-`set()` reason"
provides:
  - "setName — the ONE write path for the workflow's name (D-15), the only store action Phase 197 creates"
  - "The D-15 slug fence, asserted over `selectDefinition`'s output rather than over `meta`"
  - "C-1's declined definition-level provenance mark, pinned mechanically so a later executor cannot half-implement it"
  - "A re-derived G-5 triple for builderStore.ts: 12 / 6 / 907 (was 11 / 5 / 837)"
affects: [197-06, 197-07, 197-08, 197-09, 197-10, 197-11, wave-merge, phase-close]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A fourth structural mirror inside a concern the store already owns — the G-5 honoured-by-construction test is a measurement (guard count 7 → 8, imports 6 → 6, `fetch(` 0 → 0, deletions 0), not an argument"
    - "A fence asserted over the object that SHIPS (`selectDefinition`'s output), never over the internal field it is built from"
    - "A needle token assembled at runtime from parts, so a test cannot be mistaken for an implementation carrying it"

key-files:
  created:
    - ".planning/phases/197-guided-authoring/197-05-SUMMARY.md"
  modified:
    - "frontend/src/components/workflows/builderStore.ts"
    - "frontend/src/components/workflows/builderStore.test.ts"

key-decisions:
  - "The word `slug` is spelled NOWHERE in the added source block — the plan's own acceptance criterion (`grep -c \"slug\"` over the added block == 0) contradicts the declaration snippet it supplied, and the criterion wins; the identity key is named by ROLE in the source and the token lives in the TEST, which is where the fence is"
  - "No provenance key is written and none is planned — C-1's decline, pinned by a case rather than left as prose"
  - "`docs/HOT-FILE-LEDGER.md` and `CLAUDE.md` are NOT edited by this plan despite the triple moving — four sibling agents are live and neither file is in `files_modified`; the re-derived triple is recorded here and owed at phase close"

patterns-established:
  - "Falsify before claiming: three plants, three DIFFERENT reds, so no case is carrying another's weight"

requirements-completed: [AUTH-02]

# Metrics
duration: 12min
completed: 2026-08-18
---

# Phase 197 Plan 05: `setName` — D-15's One Write Path Summary

**One store action, four `meta`-writing siblings where there were three, eight cases driving the five properties it inherits, and a D-15 fence asserted over the object that actually reaches the PATCH body — falsified with three plants that each red a different case.**

## Performance

- **Duration:** ~12 min (first commit 10:57, second 11:01, local time)
- **Tasks:** 2
- **Source files modified:** 2 — exactly the two declared, **zero deletions in either**

---

## What shipped

### `setName`, and the shape it takes

```ts
setName: (name) => {
  const s = get()
  if (s.builderPhase !== "drafted") return
  set({ meta: { ...s.meta, name }, dirty: true })
},
```

Three lines. `setProjectFolder`'s shape exactly — **not** `setBusinessRequirement`'s two-key one,
per the objective's decision 1. One `meta` key, one `set()`, `dirty` armed in the same write.

The declaration landed in the state interface beside its three siblings, naming itself **the FOURTH
`meta`-writing sibling** so the family is legible from the interface alone.

### The five inherited properties, each with its reason in the docblock

| # | Property | Reason recorded in the docblock |
|---|---|---|
| 1 | `builderPhase !== "drafted"` bail | the shipped guard shape every document-scoped action carries; keeps the write out of the composing beat where `meta` is deliberately empty |
| 2 | `dirty: true` in the SAME `set()` | the subscription arms `dirty` on a change to the **`phases`** reference and nothing else — a `meta`-only write that did not arm it is a genuine definition change the leave guard never notices |
| 3 | untracked | `partialize` narrows the undo stack to `phases`; `⌘Z` restores STEPS, never the workflow's identity. Field-level undo still works because the page's listener yields on `INPUT`/`TEXTAREA` (`WorkflowBuilderPage.tsx:742-744`) |
| 4 | no comparison, no diff, no debounce | a second copy of a server predicate is what D-182-06 forbids by name — and here there is no server predicate to be a copy OF, because this action carries no provenance concern at all |
| 5 | no trimming, no emptiness rule | the server owns emptiness (`grounding.py`); `setName("")` writes the empty string and that is correct |

---

## ⚠ THE ONE DEVIATION FROM THE PLAN'S LETTER, AND IT IS THE PLAN CONTRADICTING ITSELF

**The plan supplies a verbatim declaration containing the word `slug`, and an acceptance criterion
that `grep -c "slug"` over the added block returns `0`.** Both cannot hold. They are reproduced
here rather than silently reconciled:

> `<interfaces>`: *"`/** Set the workflow's name (D-15). … NEVER writes the slug. */`"*
> `<acceptance_criteria>`: *"`grep -c "slug"` over the added block returns `0` — no arm of this
> action mentions the slug."*

**Resolution taken — the CRITERION wins, and the token moves to the test.** The added source block
spells the word **zero times**; the identity key is named by ROLE in both the declaration and the
implementation docblock (*"the key identity, forks and versioning key off"*, *"minted once at
generation"*). Measured:

```bash
$ git diff -U0 <base> HEAD -- frontend/src/components/workflows/builderStore.ts \
    | grep '^+[^+]' | grep -c 'slug'
0
```

**Why this is the right way round rather than the convenient one.** A criterion of the form *"the
token appears zero times in the added block"* is only meaningful if it is checking for a CODE arm
that touches the key. Spelling it in prose would make the criterion fire on correct work — the
identical failure mode this file has already suffered twice (`DefinitionMeta`'s docblock note at
`:186-194` records an earlier draft that *"quoted the import form it was explaining and turned the
fence RED"*, and 194.1 tripped the `panel/` sweep twice on docblocks merely discussing the rules).
**The `slug` token now lives in the TEST — in a case TITLE and in three assertions — which is where
the fence is and where a grep should find it.**

---

## Task 1 — the action

**Commit `786283ba`** · `feat(197-05): setName — the fourth meta-writing sibling, and D-15's one write path` · **+70 / −0**

Acceptance, every criterion measured rather than asserted:

| Criterion | Command | Result |
|---|---|---|
| `setName` declared AND implemented | `grep -c "setName" builderStore.ts` | **2** (≥ 2 required) |
| exactly one new `meta` key | source read | `{ ...s.meta, name }` — no second key |
| no arm mentions the identity key | `grep -c 'slug'` over added lines | **0** |
| no emptiness rule, fallback or comparison | `grep -Ec 'trim\(\)\|\?\?\|=== *""'` over added lines | **0** |
| the store's own source sweep still green | full suite, BEFORE any case was added | **58 passed** |
| no new typecheck error | `npx tsc --noEmit -p tsconfig.app.json` | **33** — exactly `197-01`'s baseline |

⚠ **The fifth row is the load-bearing one and it is why the suite was run at Task 1 rather than
only at Task 2.** The shipped sweep reads the store's RAW source and fires on PROSE, so a docblock
that named the API client by specifier would have reddened a fence with nothing wrong in the code.
Measured green at 58 before a single case was written. The added block names no module specifier —
`grep -Ec 'from\s+["'"'"']@/lib/api["'"'"']'` over the added lines returns **0**.

## Task 2 — the cases

**Commit `383abd5c`** · `test(197-05): drive setName's five inherited properties and fence D-15 over the PATCH body` · **+153 / −0**

| Criterion | Required | Measured |
|---|---|---|
| suite green | pass | **66 passed** |
| case count | ≥ base + 7 | **58 → 66 = +8** |
| a case title contains `slug`, body asserts over `selectDefinition` | yes | *"leaves the slug identical and adds exactly one key to the PATCH body"* |
| `POSITIVE CONTROL` count increased | ≥ +1 | **0 → 3** |
| deletions in the test file | 0 | **`153  0`** |

**The suite's baseline was RE-DERIVED, not inherited.** The plan says the count-gate pin is `52`;
the pin is **52** and the actual is **58**, so the plan quoted the PIN rather than the count. *A pin
is a floor, never a census* — the same trap `WorkspacePanel.test.tsx`'s row records (pin stale by
twelve while the gate stayed satisfied, because its contract is *no DECREASE*). Base measured by
running the suite at the phase base SHA: **58**. New actual: **66**, against a pin of 52 — **no
per-file decrease**, so the gate's contract holds on this file. ⚠ **`scripts/vitest-count-gate.cjs`
was NOT edited** — it is outside `files_modified`, four siblings are live, and the pin is already
satisfied.

### The eight cases

1. **writes `meta.name` verbatim**
2. **⚠ THE D-15 FENCE** — the slug is captured before and compared after, on `meta` **and** on
   `selectDefinition`'s output; the added key set is exactly `["name"]`. **POSITIVE CONTROL inline:**
   the same comparison, run against a locally-constructed object carrying one extra key, reports
   `["name", "stray_key"]`.
3. **arms `dirty`** on a store whose `phases` reference is asserted unchanged by identity
4. **bails outside `drafted`** — `meta` unchanged **by reference**, still clean
5. **untracked** — three writes push zero entries; **POSITIVE CONTROL inline** (a structural edit
   pushes one); then an undo steps back over the STEP while the name survives
6. **no trimming, no emptiness rule** — `"  "` and `""` both written through verbatim
7. **no provenance key** — the added key set is exactly `["name"]` and none of it carries the
   seeded-by-AI token; **POSITIVE CONTROL** that the filter catches such a key when planted
8. **carries no other `meta` field away with it**

⚠ **Case 2 asserts over `selectDefinition` and NOT only over `meta`, and that is the whole point of
the fence.** `selectDefinition` spreads `meta` straight into the autosave PATCH body, and
`WorkflowDefinition` is `extra="forbid"` — so a stray key is a **422 that would destroy the write on
the very first autosave**, meaning it could never survive a reload. Fencing `meta` alone would guard
an internal field instead of the payload the server validates.

⚠ **The provenance token in case 7 is assembled at runtime — `["seeded","by","ai"].join("_")`.**
This suite sweeps the store's raw source for needles; a spelled-out token in a test is one grep away
from being read as an implementation that carries it.

---

## FALSIFICATION — three plants, three DIFFERENT reds

**These cases are evidence because they were made to fail, not because they passed.** Each plant was
applied to the shipped implementation and reverted with `git checkout -- <specific file>` (never
`git clean`, never `git stash`, never a blanket reset).

| Plant | Change | Verdict | Message |
|---|---|---|---|
| **P1** | `set({ ...s.meta, name, slug: name, … })` | **2 failed / 64 passed** | `AssertionError: expected 'Northwind QBR' to be 'risk-register'` |
| **P2** | `dirty: true` dropped from the `set()` | **1 failed / 65 passed** | `AssertionError: expected false to be true` |
| **P3** | `name: name.trim()` | **1 failed / 65 passed** | `AssertionError: expected '' to be '  '` |

**Each plant reds a DIFFERENT case, so no case is carrying another's weight** — the property Phase
194.1 named when a single-assertion version of a case would have shipped a regression while staying
green. P1 reds both the D-15 fence and the no-other-field case, which is the correct blast radius
for a write that corrupts the identity key.

Restored and re-run: **66 passed**, `git status --short` showing only the intended file.

---

## G-5 — `builderStore.ts` FIRES, and is honoured BY CONSTRUCTION

**The triple moved and is re-derived here rather than copied:**

| | `197-01` / the ledger | **measured at `383abd5c`** |
|---|---|---|
| commits | 11 | **12** |
| phases | 5 | **6** (`184 185 186 193 193.2 197`) |
| lines | 837 | **907** |

⚠ **The raw recipe prints SEVEN buckets; the seventh is `260809`, a DATED QUICK TASK, not a phase.**
That subtraction is the one this row's ledger section already documents as *"a DISPUTED FIGURE
RESOLVED BY MEASUREMENT"* — recorded again because the next reader will run the same command and see
the 7.

**Honoured by construction — the measured reason, a test rather than an argument.** The store
already owns the **`meta`-write concern** with three structural siblings; this plan added a
**fourth**, inside the same concern, in the same shape. Five figures a second concern would have
moved:

| needle | base | after |
|---|---|---|
| `fetch(` | 0 | **0** |
| `^import ` | 6 | **6** |
| `if (s.builderPhase !== "drafted") return` | 7 | **8** — the SAME guard, not a new shape |
| deletions in the file | — | **0** |
| `selectDefinition` | untouched | **untouched** (absent from the diff entirely) |

**No new import, no new dependency, no new state, no network seam, and not one shipped line
deleted.** The next phase adding a genuinely SECOND concern still owes the refactor recommendation
first; **the seam is unchanged and is named in the detail file — the canvas/undo (zundo) slice vs
the `meta`-write slice vs the save-state slot. It inherits `12 / 6 / 907`.**

⚠ **`docs/HOT-FILE-LEDGER.md` and `CLAUDE.md` were deliberately NOT edited, and this is a decision
rather than an omission.** Neither is in this plan's `files_modified`; four sibling executors are
live in their own worktrees; and the ledger's same-commit sync rule binds a ROW to its SECTION (it
forbids the two drifting from each other), which cannot happen when neither is touched. `197-01`
already hands this forward explicitly: *"Re-derive the six ledger triples at phase close… most of
these six will be touched during wave 2, so today's zero is not tomorrow's."* **The corrected triple
above is the input to that phase-close task.**

---

## Verification

| Check | Command | Result |
|---|---|---|
| the suite | `GSD_VITEST_MAX_WORKERS=2 npx vitest run src/components/workflows/builderStore.test.ts` | **1 file passed · 66 passed** |
| typecheck | `npx tsc --noEmit -p tsconfig.app.json` | **33 errors** — identical to `197-01`'s baseline, all pre-existing, none in scope |
| the store's source sweep | in-suite, `?raw` fence | **green** — the docblock names no module specifier |
| zero deletions | `git diff --numstat <base> HEAD -- <both files>` | `70  0` and `153  0` |
| scope | `git diff --numstat 7cf919f1 HEAD` | **exactly the two declared files** |

### The four standing D-05 numstat criteria — run at this plan's close

```bash
$ git diff --numstat 52e6bcdb8a28b2cda1e3fa06a1bc95b733dbee07 HEAD \
    -- frontend/src/pages/WorkflowBuilderPage.preDraft.baseline.test.tsx \
       frontend/src/components/workflows/WorkflowDoorSwitch.baseline.test.tsx \
       frontend/src/components/workflows/SeedReceipt.tsx \
       backend/app/services/harness/publish_service.py
                                                             [no output — exit 0]
```

**All four clean: 0 deletions, 0 insertions, none of the four files appears in the diff at all.**
The pre-draft describe screen is byte-unchanged on both doors, `SeedReceipt.tsx` is untouched, and
the publish gauntlet learned nothing new. ⚠ Per `197-01`'s standing instruction these run again at
the **wave merge** and at **phase close** — a clean reading here does not discharge those.

### ⚠ The full count gate was NOT run, and that is a decision with a reason

`197-01` measured `count gate OK · total 4291 · failed 0 · pinned total 4217 · 89/89` at the phase
base, and warns in the same breath that **`count gate OK` is not reliably reachable on demand**
(SEED-171, five known-flaky suites) and that wave 1 already saw a **fake** gate failure — an
`ENOSPC` inside `JsonReporter.writeReport` that exits 2 and carries **no test verdict at all**, on a
volume at ~98% with five agents live. Running a ~4300-case gate from a worktree with four siblings
mid-flight would produce a reading nobody could attribute.

**What is offered instead is the deterministic pair CLAUDE.md names:** the **per-file delta**
(`builderStore.test.ts` 58 → 66 against a pin of 52 — an INCREASE, which is the gate's contract) and
the **explicitly-run in-scope suite** (green, three times, including twice under plants). The gate
belongs to the wave merge.

---

## Deviations from Plan

**One, and it is the plan contradicting itself rather than a discovery.**

**1. [Rule 3 — Blocking] The plan's supplied declaration snippet violates the plan's own acceptance criterion**

- **Found during:** Task 1, before the first edit
- **Issue:** `<interfaces>` supplies a verbatim declaration ending *"NEVER writes the slug."*, while
  `<acceptance_criteria>` requires `grep -c "slug"` over the added block to return `0`. Taking the
  snippet literally fails the criterion on the very next line.
- **Fix:** The criterion was honoured. The added source block spells the token **zero** times and
  names the key by ROLE instead (*"the key identity, forks and versioning key off"*). The token was
  moved to the test file, where it appears in a case TITLE and three assertions — measurably where a
  fence-hunting grep should find it.
- **Files modified:** `frontend/src/components/workflows/builderStore.ts` (wording only; behaviour
  identical to the snippet's intent)
- **Verification:** `git diff -U0 … | grep '^+[^+]' | grep -c 'slug'` → **0**; the D-15 property
  itself proved by plant P1 reddening two cases
- **Committed in:** `786283ba`

**Total deviations:** 1 auto-fixed (blocking). **No scope creep** — the diff is exactly the two
declared files.

---

## Issues Encountered

None. No flaky suite was hit, no gate reddened, and the disk-pressure signature `197-01` warned
about did not appear (only one ~1-second suite was run, never the full gate).

---

## Next Phase Readiness

**Ready. `setName` exists and is the one write path any later plan should call.**

Obligations this plan hands forward:

1. ⚠ **The ledger owes an UPDATE, not a second row:** `frontend/src/components/workflows/builderStore.ts`
   is **`12 / 6 / 907`**, not `11 / 5 / 837`. It must be edited in **`docs/HOT-FILE-LEDGER.md` AND
   the `CLAUDE.md` table in the SAME commit** (the same-commit sync rule), at phase close, by
   whichever plan owns those files.
2. **The consumer is not built here.** `setName` has **zero call sites** in the app — the row-4
   surface is another plan's work. It reads `meta.name` off the index signature as `unknown` and
   narrows with `typeof meta.name === "string"`, the shipped idiom at `WorkflowBuilderPage.tsx:2158`;
   **`BuilderDefinition` is deliberately NOT widened** (objective decision 2), so no page type
   surface moves.
3. ⚠ **C-1's declined provenance mark has a RE-OPEN TRIGGER and it is now pinned by a test:** *any
   phase that adds a definition-level provenance field for another reason — row 4's mark comes along
   free at that point.* Until then, case 7 reds on a half-implemented mark. `name_seeded_by_ai` is a
   **`PhaseSpec`** field (a STEP-name flag); `WorkflowDefinition` has no definition-level equivalent.
4. **D-19's header work (`197-10`) is unaffected by this plan** — it renders `meta.name ?? meta.slug`
   and re-captures `FLAG_OFF_HEADER_MARKUP` band 3 as a declared, dated act. This plan wrote no
   render and touched no capture.

## Self-Check: PASSED

| Claim | Command | Result |
|---|---|---|
| SUMMARY exists | `ls .planning/phases/197-guided-authoring/197-05-SUMMARY.md` | FOUND |
| Task 1 commit exists | `git log --oneline` | FOUND `786283ba` |
| Task 2 commit exists | `git log --oneline` | FOUND `383abd5c` |
| `setName` in the store | `grep -c "setName" builderStore.ts` | **2** |
| suite green | vitest | **66 passed** |
| zero deletions, both files | `git diff --numstat` | `70 0` · `153 0` |
| no file outside `files_modified` | `git diff --numstat 7cf919f1 HEAD` | two paths, both declared |
| STATE.md / ROADMAP.md untouched | same diff | **absent** |

## Threat Flags

None new. The plan's four `mitigate` dispositions are all discharged:

| Threat ID | Disposition | Evidence |
|---|---|---|
| **T-197-05** — a key the model refuses | mitigated | the added key set over `selectDefinition`'s output is exactly `["name"]`; POSITIVE CONTROL proves the comparison can name a stray |
| **T-197-14** — writing the slug | mitigated | captured before / compared after on both `meta` and the PATCH body; **plant P1 reds it** |
| **T-197-01** — provenance laundering | mitigated | no provenance key is written; case 7 asserts none appears, with a positive control |
| **T-197-15** — a change the leave guard misses | mitigated | `dirty: true` in the same `set()`, driven on a store whose `phases` reference is asserted unchanged; **plant P2 reds it** |
| **T-197-SC** — package installs | vacuous | no package installed, none proposed |

---
*Phase: 197-guided-authoring*
*Completed: 2026-08-18*
