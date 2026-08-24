---
phase: 197-guided-authoring
plan: 09
subsystem: frontend
tags: [auth-02, guided-authoring, draft-arrival, mount, snapshot-vs-live, focus-seams, d-13, seed-171]

# Dependency graph
requires:
  - phase: 197-08
    provides: "DraftArrivalCard + DraftArrivalCardProps — the card this plan mounts"
  - phase: 197-07
    provides: "DecisionsList + DecisionsListProps — the five-row decisions object this mount fills"
  - phase: 197-06
    provides: "GenerateReadiness on api.ts and the onDrafted widening that carried the verdict to the hook boundary"
  - phase: 197-04
    provides: "terminalEmitSlug — the deliverable-step derivation, read here over the LIVE definition"
  - phase: 197-05
    provides: "setName — row 4's one write path"
provides:
  - "The arrival card mounted IN PLACE of SeedReceipt; graphColumn still exactly three children"
  - "`readiness` page state — D-13's verdict finally lands on the screen, captured as a SNAPSHOT beside receiptPhases"
  - "Two focus seams onto the SHIPPED project-folder-picker and business-requirement-input — display+jump, never a second control"
  - "+13 cases on the page suite: the three-child grid as a NUMBER, snapshot-vs-live over three real post-arrival edits, the two focus seams, the three verdict arms"
affects: [197-10, 197-11, phase-close]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Snapshot-vs-live kept apart at the mount: page state captured in the single onDrafted transition for past-tense claims, live store reads for present-tense answers, fenced in BOTH directions by paired cases"
    - "A focus seam: a ref on the control that already exists, focus() BEFORE scrollIntoView, the assist typeof-guarded so it can never eat the job"

key-files:
  created: []
  modified:
    - "frontend/src/pages/WorkflowBuilderPage.tsx (+235 / -6)"
    - "frontend/src/pages/WorkflowBuilderPage.canvas.test.tsx (+620 / -28)"

key-decisions:
  - "The drift disposition is DISPLAY+JUMP for rows 1/2/3/5 and an inline field for row 4 alone — the page's own rule at WorkflowBuilderPage.tsx:2085 ('A second, different answer to one question is drift')"
  - "Row 4's inline field is not a second answer but the FIRST — the workflow name has no existing control anywhere on this screen"
  - "D-01 and D-06 are satisfied by WHERE the mount sits, not by a guard: `open` is `showReceipt`, set in the onDrafted handler and nowhere else. No second gate was added and showReceipt's setters were not widened"
  - "The header identity span was NOT touched — D-19 and its FLAG_OFF_HEADER_MARKUP re-capture stay 197-10's, so a header byte-pin failure can never be confused with a mount failure"

patterns-established:
  - "Every hook in this page must sit ABOVE the pre-draft describe screen's early return — the invariant is now written down beside the memo that discovered it"
  - "A prose comment that spells a forbidden identifier trips the source fence guarding it — the 196-08 trap, hit three times inside this one plan"

requirements-completed: [AUTH-02]

# Metrics
completed: 2026-08-18
---

# Phase 197 Plan 09: The Page — the Card Mounted In Place Summary

**The arrival card now replaces `SeedReceipt` in `graphColumn` with the column still at exactly
three children, D-13's readiness verdict finally reaches the screen, and the two classes of value —
what the server said about ONE generation, and what the definition says NOW — are held apart by
paired fences that each fail if the other is satisfied by freezing.**

---

## THIS SUMMARY WAS RECONSTRUCTED AFTER A MACHINE CRASH, AND THAT CHANGES WHAT IT CAN CLAIM

The executor completed all three tasks and committed each one. **The host laptop froze and rebooted
before the completion commit was written and before the worktree was merged**, so this file is not
the executor's own narration of its session — it is a reconstruction, and every mechanical claim
below was **re-run at `36013a72` by the orchestrator** rather than inherited from the run that is
gone.

Two consequences, stated rather than hidden:

- **What the executor OBSERVED during execution is quoted from its own commit messages**, which are
  contemporaneous evidence written at the moment of each commit. Those passages are attributed as
  such. Where this file says *"measured here"*, the orchestrator ran the command after the reboot.
- **The RED-first evidence for the new cases exists only in those commit messages.** The failing
  runs themselves were not re-created. That is weaker than a summary written live, and it is the
  one thing the crash actually cost.

Nothing was lost from the tree: the worktree survived intact with both junctions attached and
`git status --short` **clean**.

---

## Performance

- **Tasks:** 3, each committed, plus one fix commit — 4 commits total
- **Files created:** 0 · **Files modified:** 2
- **Diff vs the dispatched base `655b9039`:** `+620 / -28` on the suite, `+235 / -6` on the page

---

## Task 1 — the mount and the snapshot · commit `f96a3ed1`

`readiness` lands as page state at `:797`, typed `GenerateReadiness | undefined`, initialised
`undefined`, and is set at `:886` inside the **one** `onDrafted` handler beside `setReceiptPhases`
— the same SNAPSHOT class the receipt's own contract defines (`SeedReceipt.tsx:147-172`). It is
**replaced per generation, never merged**, and reaches the card **straight through — `undefined`
and all, with no `?? {}` default** (`:1742`).

**The verdict was being silently dropped, and `tsc` could not see it.** From the executor's own
commit message:

> `onDrafted` names its SECOND parameter, so D-13's verdict stops being silently dropped: a
> one-argument inline callback assigns to a two-parameter signature with NO tsc error, which is why
> 197-06 could only carry it to the hook boundary and left this last hop owed.

The LIVE half is derived with **no `useState` mirror** — `boundFolderName` off `folderOptions`, the
ONE template-asset memo reusing the shipped read, the shipped `typeof === "string"` narrows for the
requirement and the name, and `terminalEmitSlug` over the live definition.

### Task 1 acceptance criteria — every one re-run here, verdicts verbatim

| Criterion | Required | Measured |
|---|---|---|
| `grep -c "<SeedReceipt"` on the page | `0` | **0** PASS |
| `grep -c "<DraftArrivalCard"` on the page | `1` | **1** PASS |
| `grep -Ec "s\.readiness"` — never a store selector | `0` | **0** PASS |
| `grep -c 'kind === "template"'` — read reused, not duplicated | unchanged | **1 → 1** PASS |
| The `identityGroup` block gains no node | no added node | **comments only — two lines, both explaining the placement rule** PASS |
| `WorkflowBuilderPage.header.test.tsx` | green | **green** PASS |
| `tsc --noEmit -p tsconfig.app.json` | no new error | **33 — the standing baseline, unmoved** PASS |

---

## Task 2 — the two focus seams · same commit `f96a3ed1`

Refs on the **shipped** `project-folder-picker` select and the **shipped**
`business-requirement-input`, with `focus()` plus a `typeof`-guarded `scrollIntoView`. Both refs sit
**inside the existing `canvasEnabled` affordances** — the 193.2-09 placement — so band 3 stays
unmovable by construction rather than by care.

### THE DRIFT DISPOSITION, NAMED AS THE PLAN REQUIRED

The page's own rule is at `WorkflowBuilderPage.tsx:2085` — *"A second, different answer to one
question is drift."* This plan's disposition:

- **Rows 1, 2, 3 and 5 — DISPLAY + JUMP.** The row shows the current answer and hands the author to
  the control already on the screen. One writer, one answer, one render.
- **Row 4 — an inline field, and it is the sole exception.** The workflow name has **no existing
  control anywhere on this screen**, so the row's field is not a second answer but the **first**.
  D-17 declines `ForkNameDialog` for exactly this reason: it names a copy that does not yet exist.

| Criterion | Required | Measured |
|---|---|---|
| No third mount of the KB picker | unchanged from base | **2 → 2** PASS |
| No second requirement input | unchanged from base | **1 → 1** PASS |
| The rows write nothing — they focus | `setProjectFolder`/`setBusinessRequirement` unchanged | **8 → 8** PASS |

### THE SEAMS SHIPPED DEAD ONCE, AND ONLY THE CASES CAUGHT IT

From the executor's commit `36013a72`, verbatim:

> **[Rule 1 — Bug] The focus seams did NOTHING and two cases caught it:** `scrollIntoView` ran
> FIRST, jsdom does not implement it, the throw ate the `focus()` on the next line and
> `activeElement` stayed on `<body>`. Focus is the seam's job and the scroll is an assist, so the
> assist can never eat the job — reordered, guarded by `typeof`, hoisted to module scope.
> **`tsc` was green through the whole defect.**

---

## Task 3 — the page suite · commits `4c16844e`, `36013a72`

**+13 cases** by vitest's own count (140 → 153; the plan required at least 8 over the base). What
they pin, from the executor's commit message:

- **The three-child grid as a NUMBER**, with a positive control proving the counting expression can
  report four — sketch 172 measured that a fourth child strands the graph at **0 px**, and
  `toBeInTheDocument()` cannot tell three from four. Dismissal takes it to two with the graph last.
- **SNAPSHOT:** three REAL post-arrival edits — a KB tool switched on, the grounding dial escalated,
  a step inserted — each with its own control proving the edit LANDED, and the card's heading, its
  grounding-fold sentence and the receipt's three count attributes all unmoved.
- **LIVE, the mirror:** re-binding the KB through the header picker moves row 1 in the same beat;
  the requirement input moves row 3. *"A card that froze everything to pass the snapshot fence fails
  here."*
- **THE VERDICT, three cases:** the server's `missing` sentence reaches row 3 **verbatim**; an
  absent key renders **no** verdict; and an explicit `present` renders **identically to absent** —
  which is what makes the absent case a measurement rather than a coincidence.
- **THE FOCUS SEAMS:** `document.activeElement` carries the shipped testid, exactly ONE of each
  control exists, and after the jump the header and the row read the same string (U5).

`grep -c "POSITIVE CONTROL"` on the suite: **14 → 19** (+5; the plan required at least +1).

### ONE TASK-3 ACCEPTANCE CRITERION FAILED AS WRITTEN, AND IT IS RECORDED AS A FAILURE

> *"`git diff --numstat <base-sha> HEAD -- …canvas.test.tsx` shows **zero deletions**."*

**Measured: 28 deletions against the dispatched base, 30 against the phase base. The criterion is
VIOLATED.**

It was not violated silently — the executor declared it on the commit that caused it (`4c16844e`),
and the reasoning is sound: the mount replacement is a **declared behaviour change**, so ten shipped
cases that read `seed-receipt` off the arrival DOM had to open the card's first fold before reading.
Its own account:

> Measured before anything was touched, from the gate's own JSON report: 10 failed / 130 passed,
> and the file is byte-changed by this plan, so "known SEED-171 flake" is NOT available to it and
> was not claimed. […] Nothing they asserted is dropped; each also pins that the fold reveals the
> REAL receipt.

Two fences were **re-scoped rather than loosened**, each on the commit that makes the new property
true — and one of the two had to be, because the alternative would have passed **vacuously**:

> the element extraction follows the mount to `<DraftArrivalCard`, because the old regex returned
> "" and `not.toContain(LIVE_SELECTOR)` would then have passed VACUOUSLY while its sibling shouted.

**The honest reading: the plan wrote a criterion its own declared behaviour change could not
satisfy.** A mount replacement necessarily edits the cases that read the old mount. The criterion
belonged on the *page* file — where it very nearly holds, at `-6`, all of them comment-block
extensions — and not on the suite. **It is left recorded as failed rather than reinterpreted into a
pass.** The phase-level D-05 deletion criteria, which are the ones actually protecting the pre-draft
baselines, all hold:

---

## THE FOUR D-05 NUMSTAT CRITERIA — RE-RUN HERE, VERDICTS VERBATIM

Base SHA as `197-01` recorded it (`52e6bcdb8a28b2cda1e3fa06a1bc95b733dbee07`).

| # | Path | Required | Verdict |
|---|---|---|---|
| 1 | `WorkflowBuilderPage.preDraft.baseline.test.tsx` | deletions = 0 | **PASS** — absent from the diff |
| 2 | `WorkflowDoorSwitch.baseline.test.tsx` | deletions = 0 | **PASS** — absent from the diff |
| 3 | `SeedReceipt.tsx` | `0 0` — must not appear at all | **PASS** — absent from the diff entirely |
| 4 | `publish_service.py` | `0 0` — must not appear at all | **PASS** — absent from the diff entirely |

**Criterion 3 is the interesting one: the receipt was REPLACED at its mount and its source file was
never opened.** That is D-02 holding through a composition change — the card composes the receipt
unmodified (197-08), and this plan only swapped which element `graphColumn` renders.

### The whole plan diff, so nothing hides outside the two declared paths

```
$ git diff --numstat 655b9039 HEAD
620     28      frontend/src/pages/WorkflowBuilderPage.canvas.test.tsx
235     6       frontend/src/pages/WorkflowBuilderPage.tsx
```

**Two paths, both declared in `files_modified`.** Nothing else moved.

---

## GATES AT `36013a72` — MEASURED AFTER THE REBOOT, BOTH READINGS PUBLISHED

| Gate | Result |
|---|---|
| `tsc --noEmit -p tsconfig.app.json` | **33 errors** — the standing baseline, unmoved, none naming this plan's files |
| `WorkflowBuilderPage.canvas.test.tsx` standalone | **153 passed / 0 failed** |
| `header.test.tsx` + `describe.test.tsx` | **62 passed / 0 failed** |
| `vitest-count-gate.cjs` run 1 | **COUNT GATE VIOLATED** — `total 4443 · failed 1 · pinned total 4217` |
| `vitest-count-gate.cjs` run 2 | **`count gate OK`** — 89/89 pinned present, no per-file decrease, 0 failing. `total 4443 · pinned total 4217` |

**`GSD_VITEST_MAX_WORKERS=2` on every run. The cap was never adjusted** — CLAUDE.md's 2026-08-17
correction is explicit that reaching for the cap is measured NOT to fix these failures.

### THE RED RUN, TRIAGED BY THE PROCEDURE AND NOT BY THE COLOUR

The filename was taken **from the gate's own persisted JSON before any re-run**, as
`197-VALIDATION.md` demands:

```
FILE:   frontend/src/pages/WorkflowBuilderPage.canvas.test.tsx
NAME:   WorkflowBuilderPage 184-11 — with the flag OFF the panel receives NO rails key (D-14)
        POSITIVE CONTROL — with the flag ON the very same read finds the key
MSG:    AssertionError: expected 0 to be greater than 0
```

That is **verbatim the fifth SEED-171 signature** — same suite, same assertion shape — recorded in
CLAUDE.md at plan `196-05`: *"failed a suite's own POSITIVE CONTROL with `AssertionError: expected 0
to be greater than 0`."*

**The file IS byte-changed by this plan, so "provably unmodified" is NOT available for the file, and
it is not claimed.** The plan's own `read_first` predicted exactly this ambiguity. What *can* be
said is narrower, and was measured:

- **The failing CASE is byte-unchanged by this plan.** `git diff 655b9039 HEAD` restricted to that
  file, grepped for the case's own describe text → **zero hits**. It is a shipped Phase 184-11
  positive control that this plan never opened.
- **The same suite passes 153/153 standalone**, and the second full gate run passed with the
  **identical total (4443)** — so nothing was added, dropped or renamed between the two runs.

**One green sample is not proof of innocence.** The correct record is: *a shipped case, provably
untouched by this plan's diff, failed once under the full gate and passed under both a standalone
run and a second full gate run, with the cap untouched.* Recorded as an observation, per the rule.

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `Rendered more hooks than during the previous render` — 11 failed cases, 8 uncaught exceptions**

- **Found during:** Task 1, by RUNNING the page suite — invisible to `tsc` and to the card's own suite
- **Issue:** The page returns the pre-draft describe screen from a branch several hundred lines above
  `graphColumn`, so **every hook in the file sits above it**. Declaring the decisions memo where it
  is CONSUMED put the file's first-ever hook *after* that return; the empty → drafted transition then
  grew the hook count and React threw.
- **Fix:** Moved above the return, **with the invariant written down beside it** so the next reader
  does not rediscover it the same way.
- **Commit:** `d0292223`

**2. [Rule 1 - Bug] Prose tripped a source fence — three times in one plan**

- **Issue:** A comment quoted the folder-fetch function by name, so the shipped *"no second fetch was
  added for the maps"* guard counted **4** where it pins **3**. Separately, a comment spelled the
  forbidden empty-object default and the new source fence fired on the prose explaining it.
- **Fix:** Re-named by role; the counts are back to their pins.
- **Commits:** `d0292223`, `4c16844e`
- **This is `196-08`'s trap and the executor logged it as the third occurrence inside this single
  plan.** A fence that reads source text cannot distinguish code from the comment describing it.

**3. [Rule 1 - Bug] The focus seams shipped dead** — see Task 2 above. Commit `36013a72`.

### Declared behaviour change

**Ten shipped cases were re-scoped, not deleted** — see the failed Task-3 criterion above. Declared
on its own commit, with each re-scoped case additionally pinning that the fold reveals the REAL
receipt.

---

## Known Stubs

**None.** Every row answer is read from a live store value or an imported derivation; the readiness
verdict is passed through exactly as received, including its absence.

---

## OWED

- **G-4 row U1, inherited from 197-08 and still owed.** jsdom applies no CSS, so no case in this plan
  or its parent proves the composed receipt *reads* as part of one card rather than a second card
  nested inside it. Geometry proves composition; only looking proves appearance.
- **U5's screen half.** The focus seams are pinned mechanically — `document.activeElement` carries
  the shipped testid, and the header and the row read the same string in the same beat — but whether
  the jump is *visible* to an author, that the control lights up where they are looking, has not
  been seen by a person.

## Threat Register — dispositions honoured

| Threat ID | Disposition | How it is discharged |
|---|---|---|
| T-197-27 | mitigate | `readiness` and `receiptPhases` captured in the single `onDrafted` transition, replaced per generation; `grep -Ec "s\.readiness"` → **0**; the snapshot fence drives three real post-arrival edits and the live fence proves the card did not pass it by freezing |
| T-197-03 | mitigate | The page passes `undefined` straight through with **no `?? {}`**; three verdict cases pin missing / absent / explicit-present, with absent and present rendering identically |
| T-197-21 | mitigate | Rows FOCUS the shipped controls; picker **2 → 2**, input **1 → 1**, store calls **8 → 8**, all byte-equal to the phase base |
| T-197-24 | mitigate | The mount replaces the receipt IN PLACE; the child count is asserted as **exactly 3** with a positive control proving the expression can report 4, and **2** after dismissal |
| T-197-28 | mitigate | Every addition sits inside the existing `canvasEnabled` affordances; `header.test.tsx` **green**, no re-capture forced. D-19 stays 197-10's |
| T-197-SC | accept | No package installed |

## Threat Flags

**None.** No endpoint, no auth path, no file access, no schema change.

---

## Commits

| Task | Commit | Subject |
|---|---|---|
| 1 + 2 | `f96a3ed1` | `feat(197-09): the arrival card replaces the receipt IN PLACE, and the verdict finally lands` |
| fix | `d0292223` | `fix(197-09): the decisions memo must sit ABOVE the describe screen's early return` |
| 3 | `4c16844e` | `test(197-09): re-scope the ten cases the mount swap reds — toward stronger properties, declared` |
| 3 | `36013a72` | `test(197-09): thirteen cases for the mount — the three-child grid, snapshot-vs-live, and the verdict tsc cannot see` |

## Self-Check: PASSED (with one criterion recorded FAILED)

| Claim | Command | Result |
|---|---|---|
| Card mounted once, receipt not mounted directly | `grep -c` ×2 | **1** and **0** |
| Readiness never a store selector | `grep -Ec "s\.readiness"` | **0** |
| No control duplicated, nothing new written | 3 × `grep -c` vs base | **2→2 · 1→1 · 8→8** |
| Nothing outside `files_modified` | `git diff --numstat 655b9039 HEAD` | two paths, both declared |
| Four D-05 criteria | `git diff --numstat <base> HEAD` ×4 | all four **absent from the diff** |
| Suite grew by at least 8 | vitest run | **140 → 153 (+13)** |
| Positive controls increased | `grep -c "POSITIVE CONTROL"` | **14 → 19** |
| Typecheck | `tsc -p tsconfig.app.json` | **33**, baseline unmoved |
| Suites green | vitest ×3 files | **215 passed / 0 failed** |
| Count gate | `vitest-count-gate.cjs` ×2 | run 1 **failed 1** (SEED-171, triaged) · run 2 **`count gate OK`** |
| Zero deletions on the canvas suite | `git diff --numstat` | **FAILED — 28. Declared, justified, recorded as failed** |
