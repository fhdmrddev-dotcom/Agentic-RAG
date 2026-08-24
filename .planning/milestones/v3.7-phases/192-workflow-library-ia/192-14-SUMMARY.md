---
phase: 192-workflow-library-ia
plan: 14
subsystem: ui
tags: [react, vitest, fork, gap-closure, tdd, u5-blocker]

# Dependency graph
requires:
  - phase: 192 (plan 13)
    provides: "`WorkflowCard`'s optional `hasExistingFork` prop and the `FORK_CONSEQUENCE_EXISTING` sentence — authored with no caller, waiting for this plan"
  - phase: 103 / 186 (inherited)
    provides: "`onTweak`, `onOpenDraft` and 186-07's opaque concurrency token threading"
provides:
  - "`draftBySlug` — the owner-scoped drafts feed keyed by slug, highest version wins"
  - "`onTweak`'s existing-draft branch: a fork click on a slug you already have a draft of OPENS that draft and writes nothing"
  - "`hasExistingFork` wired from the page, so the card's sentence and the verb agree in the same render"
  - "4 new pinned cases (44 total) — the first tests in this repo that ever fork a slug which already carries the colliding version"
affects: [192-15 (renders the never-silent notice for the 2 residual published+published slugs), 192-16 (owes the count-gate pin raise 40 → 44)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Reuse the shipped seam (`onOpenDraft`) instead of adding a third `setBuilderInitial` call site — the 186-07 token is then threaded BY CONSTRUCTION rather than by remembering to"
    - "A relocation required by the temporal dead zone is proved with an extracted-function diff, not asserted in prose"
    - "The residual a fix does NOT close is named in source with its measured slugs, so '18 minus 16' can never later read as 'the class is gone'"

key-files:
  created: []
  modified:
    - "frontend/src/pages/WorkflowsPage.tsx"
    - "frontend/src/pages/WorkflowsPage.test.tsx"

key-decisions:
  - "The plan's residual figures were RE-MEASURED against the live DB rather than inherited, and came back EXACT: 18 multi-version slugs, exactly 2 of them (`meridian-risk-summary-good-07aedc33`, `readonly_refusal_098uat`) `published + published` with no draft. 192-13's correction of 16 → 14 exact-shape rows is also confirmed by the same query."
  - "The RED was driven by authoring the tests BEFORE the source edit (the 192-13 precedent), so it ran against the genuinely shipped blob with nothing to restore; md5 recorded identical either way."
  - "Every new case was authored to fail with a REAL assertion error rather than a bare timeout — a timeout RED in THIS file is indistinguishable from D-192-DEF-01 and would have proved nothing."
  - "`ROADMAP.md` was deliberately NOT written: plan `192-16` owns that file (with `CLAUDE.md` and `192-UAT.md`) per this round's execution constraints."
  - "⚠ D-192-DEF-01 is REFINED by measurement: the count gate exits 0 when run WITH `GSD_VITEST_MAX_WORKERS=4`, and reds (`failed 1`, then `failed 2`) when run without it. The cap is a CLAUDE.md rule, not an optional flag."

patterns-established:
  - "Pick the wait that succeeds on BOTH the pre-fix and post-fix path, then assert which one you are on — a wait that only succeeds after the fix fails as a timeout and cannot be told apart from flake."

requirements-completed: [LIB-03]

# Metrics
duration: 23min
completed: 2026-08-11
---

# Phase 192 Plan 14: The Fork Verb Stops Being a Dead Button Summary

**A fork click on a published row you already have a draft of now OPENS that draft — nothing is created, so nothing can 409 — and the card said so before the click.**

## Performance

- **Duration:** 23 min
- **Started:** 2026-08-11T19:03:00Z
- **Completed:** 2026-08-11T19:26:00Z
- **Tasks:** 3
- **Files modified:** 2

## Accomplishments

- **The U5 blocker's first half is closed.** The operator's click that produced *"HTTP 409 twice and nothing on screen"* now lands them in the Builder on the copy they already started. The failure class is REMOVED on those rows rather than made rarer: the branch creates nothing, so there is no request that can collide.
- **The branch 3176 passing tests could not reach is now pinned, and it was observed RED first.** The only difference between the new describe and the shipped one above it is **one extra row in the drafts feed** — that is the entire reason this defect survived a 12-plan phase, a code review, a 6/6 verification and the whole suite. Same shape as this phase's CR-01.
- **186-07's concurrency token is threaded by construction, not by discipline.** The new branch calls the shipped `onOpenDraft` rather than adding a third `setBuilderInitial` call site, so a dropped token — a silent-clobber bug that typechecks — is not reachable on this path (T-192-36).
- **The residual is named in source with its measured slugs.** 2 of the 18 multi-version slugs are `published + published` with no draft and their fork still 409s. The comment says so, in `WorkflowsPage.tsx`, next to the code that will do it.
- **The card and the verb agree in the same render** (D-14) — and only where the behaviour differs, which is why `hasExistingFork` is gated on `provenance === "published"`.

## Task Commits

1. **Task 1: the regression test, driven RED first** — `0307cacc` (test)
2. **Task 2: `onTweak` opens the existing draft** — `ed0b8809` (feat)
3. **Task 3: the page tells the card which rows already have a copy** — `04310995` (feat)

**Plan metadata:** see the final `docs(192-14)` commit.

_TDD note: the RED was driven **before** the Task 2 source edit, so the source commits are each individually meaningful; Task 2's commit left exactly one case red (the sentence), which is Task 3's, and Task 3 closed it._

## The RED, verbatim (Task 1 acceptance)

Driven against the **genuinely unedited** page — the tests were authored first, so no restore was needed and the shipped blob was never touched:

```
md5 BEFORE RED: b77998127719d740f1bd5036414b913c *src/pages/WorkflowsPage.tsx

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 3 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/pages/WorkflowsPage.test.tsx > 192-14 (U5 blocker) — forking a slug you ALREADY
       have a draft of opens that draft > the fork verb creates NOTHING and opens the copy
       you already started
AssertionError: expected "vi.fn()" to not be called at all, but actually been called 1 times

Received:

  1st vi.fn() call:

    Array [
      Object {
        …
        "project_folder_id": "folder-aaa",
        "slug": "vendor-risk",
        "status": "draft",
        "version": 3,
      },
    ]

Number of calls: 1

 ❯ src/pages/WorkflowsPage.test.tsx:910:33
    910|     expect(mockCreateDraft).not.toHaveBeenCalled()

 FAIL  … > the publish gauntlet mounts on the EXISTING draft, not on a fork that was never created
TestingLibraryElementError: Unable to find an element with the text: /Edit · Vendor-risk review v2/.

 FAIL  … > the card SAID so before the click — and only on the row where the behaviour differs
Error: expect(element).toHaveTextContent()
Expected element to have text content:
  You already have your own copy of this. Opens the copy you started. The published version stays live and unchanged.
Received:
  Opens a new private copy you can edit. The published version stays live and unchanged.

 Test Files  1 failed (1)
      Tests  3 failed | 1 passed | 40 skipped (44)

md5 AFTER RED:  b77998127719d740f1bd5036414b913c *src/pages/WorkflowsPage.tsx
```

**The two md5s are IDENTICAL**, and the RED names exactly what the plan predicted: the shipped code reaches `createWorkflowDraft` with `{slug: "vendor-risk", version: 3, status: "draft"}` — the write that 409s deterministically on any slug already carrying that version.

**Three failed, one passed, by design.** The fourth case (a starter is unaffected even when a draft shares its slug) is a REGRESSION PIN and is green pre-fix — the same shape as `192-13`'s cases C/D.

**⚠ One RED was re-authored before it counted, and the reason is worth keeping.** The gauntlet case first waited on `gauntlet-spine`, which lives inside the modal the trigger opens, not in the resting view — so it failed as a bare `Test timed out in 5000ms`. In THIS file that signal is indistinguishable from `D-192-DEF-01`'s ~5 s timeout class, i.e. it would have proved nothing. It now waits on `publish-trigger`, which mounts on **both** the pre-fix and post-fix path (the gauntlet is gated on a non-null `draftId`, and both paths supply one), and then asserts WHICH draft the Builder is holding. All three REDs are now real assertion errors, in 3.95 s.

## Verification measured

| Gate | Required | Measured |
|---|---|---|
| `npx tsc -p tsconfig.app.json --noEmit \| grep -c "error TS"` | 33 | **33** (baseline, after Task 1, after Task 2, after Task 3) |
| `npx eslint src/pages/WorkflowsPage.tsx` | no output | **clean** (exit 0) |
| `npx eslint src/pages/WorkflowsPage.tsx -c eslint.a11y.config.js` | no output | **clean** (exit 0) |
| `npx eslint src/pages/WorkflowsPage.test.tsx` | no output | **clean** (exit 0) |
| `WorkflowsPage.test.tsx` standalone | 44 | **44 passed / 0 failed** in 29.4 s (baseline was 40 in 32.0 s) |
| `src/pages/WorkflowsPage.test.tsx src/components/workflows/library` | green | **5 files / 219 passed** |
| `librarySubtree.fences.test.ts` (F1 / F4 / F5) | 64 passed | **64 passed** |
| `grep -c "draftBySlug"` on the page | ≥ 3 | **4** (memo, loop write, lookup, dep — plus the card mount) |
| `grep -c "hasExistingFork"` on the page | 1 | **1** |
| `onOpenDraft` relocation is verbatim | empty function diff | **IDENTICAL** — see below |
| `git diff \| grep -c "^-.*\bit("` on the test file | 0 | **0** (+152 insertions, 0 deletions) |
| `node scripts/vitest-count-gate.cjs` | exit 0 | **exit 0** — with the worker cap set; see below |

### The two named shipped fork tests, quoted from the runner

```
 ✓ src/pages/WorkflowsPage.test.tsx > WorkflowsPage — Tweak forks a v(N+1) draft (INSERT, never UPDATE)
   > Tweak calls createWorkflowDraft with version = def.version + 1, same slug, status 'draft' 182ms
 ✓ src/pages/WorkflowsPage.test.tsx > WorkflowsPage — the starter row and its fresh-copy fork (WF-01, D-143-1/2/8)
   > onUseStarter forks a FRESH copy: new suffixed slug + v1 + draft (INSERT, never UPDATE the frozen starter) 234ms
```

Both are safe by construction — `beforeEach` seeds `mockListDrafts` with `draftRow` alone (slug `contract-clause`), which matches neither `vendor-risk` nor `risk-register` — and the new block seeds its extra draft **per test** rather than in the shared `beforeEach`, precisely so those two keep running against the fixture they always did. That was **re-verified rather than assumed**, and both are green above.

### `onOpenDraft` moved verbatim — proved, not asserted

The function was extracted from `HEAD` and from the working tree with the same `awk` range and diffed:

```
=== HEAD extraction (13 lines) ===
  const onOpenDraft = useCallback((draft: WorkflowDraftRow) => { … }, [])
=== diff HEAD vs WORKING ===
IDENTICAL — the move is verbatim
```

The move is **required, not stylistic**: `onTweak`'s dep array now lists `onOpenDraft`, and a dep array is evaluated at RENDER time, so a `const` declared 75 lines further down is a temporal-dead-zone `ReferenceError` on every render — a crash, not a lint warning. The reason is written into the source above the declaration so a future reader cannot "tidy" it back.

## The residual — re-measured, and it came back exact

The plan supplied the residual slugs; the standing project rule is not to inherit an unmeasured claim, so they were re-derived against the live local DB (`psycopg2`, `127.0.0.1:54322`, 2026-08-11):

```sql
select slug, count(*),
       count(*) filter (where status='draft'),
       array_agg(version||':'||status order by version)
from workflow_definitions group by slug having count(*) > 1;
```

- **18 slugs carry more than one version** — confirmed.
- **Exactly 2 have NO draft at all**, both `published + published`: **`meridian-risk-summary-good-07aedc33`** and **`readonly_refusal_098uat`**. Their fork still 409s; `192-15` is what makes that refusal visible instead of silent. Both are named verbatim in `WorkflowsPage.tsx`'s create-path comment.
- **14 are exactly `1:published + 2:draft`** — independently reproducing `192-13`'s correction of the plan's "16".
- **`pm-weekly-status-report` carries `1:published, 2:draft, 3:published, 4:draft`** — TWO drafts under one slug, which is why `draftBySlug` states a highest-version rule instead of letting insertion order decide (T-192-39).
- Note `meridian-risk-summary-good-cc99c1b7` (`1:pub, 2:pub, 3:draft`) is **not** a residual: it has a draft, so the new branch opens it.

## The count gate — and a correction to D-192-DEF-01

`node scripts/vitest-count-gate.cjs` **exits 0**, with `failed 0` and no `[count-decrease]`. `WorkflowsPage.test.tsx` reads **40 → 44 (+4)**, an increase above the pin, which is safe until pinned. **The pin raise is owed to `192-16`** and was deliberately not taken here.

⚠ **But it only exits 0 when the worker cap is set, and that is a measured correction to `D-192-DEF-01` rather than a lucky run.** Four measurements today:

| # | how it was run | result |
|---|---|---|
| 1 | `node scripts/vitest-count-gate.cjs` (uncapped) | `failed 1` → VIOLATED |
| 2 | `node scripts/vitest-count-gate.cjs` (uncapped) | `failed 2` → VIOLATED |
| 3 | the gate's **own 19-file argv**, run directly with `GSD_VITEST_MAX_WORKERS=4 --maxWorkers=4` | **60 files / 3184 passed / 0 failed** |
| 4 | `GSD_VITEST_MAX_WORKERS=4 node scripts/vitest-count-gate.cjs` | **`failed 0` · exit 0** |

The gate script reads `GSD_VITEST_MAX_WORKERS` and appends `--maxWorkers` only when it is set (`vitest-count-gate.cjs:1518`). Uncapped on this 16-core box the run oversubscribes and the ~5 s `testTimeout` class appears — exactly the failure mode CLAUDE.md's rule 2 documents. `192-13` logged the red as `D-192-DEF-01` after uncapped runs; the deferred item is **not** retired here (that is not this plan's file to close), but the finding is recorded so `192-16` can decide with evidence: **the gate is green under the project's own mandated invocation.**

## Decisions Made

1. **Reuse `onOpenDraft`; do not build a third `setBuilderInitial` call site.** This is what makes T-192-36 (silent token clobber) unreachable on the new path by construction. It is also why the relocation was necessary.
2. **The create path below the branch is untouched, including the `def.version` read.** `PublishedWorkflow` carries no `version` on the wire (root cause C), so a "smarter" next-version would only make the collision rarer — which is what the operator's decision rejected. The comment says this rather than leaving the untouched line to read as an oversight.
3. **`hasExistingFork` is gated on `provenance === "published"`.** A starter's fork runs `onUseStarter`, which always mints a fresh auto-suffixed slug at v1 and therefore always makes a genuinely new copy, so the "you already have one" sentence would be FALSE on a starter row even when a draft shares its slug. Pinned by the fourth new case from both sides — the sentence and the minted slug.
4. **Every new case fails with a real assertion error, never a timeout.** See the RED section: one case was re-authored to hold this property before its RED was accepted.
5. **`ROADMAP.md` was NOT written** — `192-16` owns it. Recorded so its absence reads as ownership, not oversight.

## Deviations from Plan

**None affecting scope.** Three deviations of method, all documented above rather than applied silently:

- **The gauntlet marker changed from `gauntlet-spine` to `publish-trigger`** (Task 1). `gauntlet-spine` renders only inside the modal the trigger opens (`PublishGauntlet.tsx:942-997`), so waiting on it produced a bare timeout instead of the informative RED the plan requires. The case still mirrors the shipped "gauntlet mounts on that id" assertion — trigger present ⇒ `renderPublish`'s non-null-`draftId` gate passed — and then pins WHICH draft via the caption.
- **One prose cross-reference was reworded** so `grep -c "hasExistingFork"` reads exactly **1** as the plan's acceptance criterion requires. Task 2's `onTweak` header had named the prop; it now names the constant the reader will actually see on the card (`FORK_CONSEQUENCE_EXISTING`), which is a better pointer anyway.
- **`git checkout --` on one file.** `frontend/src/components/workflows/__snapshots__/canvasModel.fixtures.test.ts.snap` was marked modified after a test run with an EMPTY `git diff` — a pure CRLF/LF re-write, no content change. Restored by explicit path (never a blanket reset). The frontend working tree is clean.

**Total deviations:** 0 auto-fixes (no Rule 1/2/3 fix was required beyond the plan's own subject).
**Impact on plan:** none. No scope creep; no capability added; card density (U5-b) untouched.

## Issues Encountered

The count gate was red on entry, as `192-13` recorded. Resolved by **measurement rather than assumption**: running the gate's own 19-file argv directly with the mandated worker cap returned **3184/3184 green**, and re-running the gate itself with `GSD_VITEST_MAX_WORKERS=4` returned `failed 0` / exit 0. Nothing was chased, nothing was fixed, and the finding is handed to `192-16` with its four measurements.

## Threat Flags

None. This round adds no network endpoint, no auth path, no file access and no schema surface — it REMOVES a write from one path.

Threat register dispositions, as executed:

- **T-192-36** (silent clobber) — mitigated as planned: `onOpenDraft` is reused verbatim, so the 186-07 token reaches the Builder by construction. Pinned by the case that asserts the Builder holds the existing draft (`Edit · Vendor-risk review v2`) with the publish trigger mounted on it.
- **T-192-37** (elevation) — accepted as planned: `draftBySlug` is built from `GET /workflows/drafts`, which is owner-scoped server-side. No new endpoint, no widened scope; a slug match can only resolve to a row the caller already owns. The memo's docblock says so.
- **T-192-38** (repudiation) — mitigated: both residual slugs named verbatim in source, re-measured rather than inherited.
- **T-192-39** (which draft) — mitigated: the highest-version rule is stated in the memo's docblock with the measured `pm-weekly-status-report` shape that makes it necessary.
- **T-192-SC** — n/a: no package installs, no `package.json` change.

## Known Stubs

None. Both of `192-13`'s waiting seams are now half-consumed: `hasExistingFork` has its caller as of this plan; `forkFailedMessage` still waits for `192-15`, by design.

## User Setup Required

None.

## Next Phase Readiness

- **`192-15`** — the never-silent fork failure. It is now scoped to a genuinely smaller surface: with this branch in place, the only fork clicks that can still fail on a collision are the **2 measured `published + published` slugs** (named in source), plus any real network/permission error on either handler. `forkFailedMessage(name, conflict)` is waiting for it. ⚠ It edits **both** files this plan touched — serialize.
- **`192-16`** — owes the count-gate pin raise **40 → 44** for `WorkflowsPage.test.tsx` (read from the gate's own `actual` column; measured 44 in five runs today: the RED run, two standalone greens, the direct 19-file run and the capped gate run), **on top of** `192-13`'s owed `WorkflowCard.test.tsx` **35 → 39** — plus the ROADMAP / CLAUDE.md / UAT writes. It should also read the D-192-DEF-01 finding above before deciding what to do with that deferred item.
- **Still open, and NOT closed by this plan:** the U5 UAT row itself. The operator's click needs re-driving on the live surface against a row with an existing draft (`compliance-gap-report-1u9vcs` is the one they hit). This plan closes the code half.

## Self-Check

- `frontend/src/pages/WorkflowsPage.tsx` — FOUND (`draftBySlug` ×4, `hasExistingFork` ×1, both residual slugs present)
- `frontend/src/pages/WorkflowsPage.test.tsx` — FOUND (44 cases green, +152/−0)
- `.planning/phases/192-workflow-library-ia/192-14-SUMMARY.md` — FOUND
- Commits `0307cacc`, `ed0b8809`, `04310995` — FOUND in `git log`

## Self-Check: PASSED

---
*Phase: 192-workflow-library-ia*
*Completed: 2026-08-11*
