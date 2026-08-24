---
phase: 192-workflow-library-ia
plan: 15
subsystem: ui
tags: [react, vitest, fork, gap-closure, tdd, u5-blocker, honest-failure, a11y]

# Dependency graph
requires:
  - phase: 192 (plan 13)
    provides: "`forkFailedMessage(name, conflict)` in `libraryVocabulary.ts` — authored with no caller, waiting for this plan"
  - phase: 192 (plan 14)
    provides: "`onTweak`'s existing-draft branch, which REMOVED the collision on 16 of 18 slugs and named the 2 residual ones in source"
  - phase: 143 / 186 (inherited)
    provides: "`onUseStarter`'s single 409 retry, and 186-07's opaque concurrency token threading"
provides:
  - "`forkFailed` page state — a display NAME and a BOOLEAN, never the error"
  - "`isForkConflict(e)` — the 409 classification with ONE home instead of two, and WR-08 recorded honestly with a re-open trigger"
  - "`library-fork-failed` — one `role=\"status\"` notice in the region that already hosts this page's failure vocabulary"
  - "4 new pinned cases (48 total) — the first tests in this repo that ever drive a FAILING fork on either handler"
affects: [192-16 (owes the count-gate pin raise 40 → 48, up from 192-14's owed 44)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A user-facing failure carries a display NAME and a BOOLEAN, never the error object — the SIGNATURE is the information-disclosure mitigation, not a rule someone has to remember at the call site"
    - "The log and the sentence are two different artefacts for two different readers, and one never replaces the other (the `WorkflowDraftUnreadableError` posture)"
    - "When `asyncUtilTimeout` exceeds vitest's per-test budget, a `findBy*` on an absent node reports as a BARE TIMEOUT — wait first on something true on both paths, then assert the new node under an explicit sub-budget"

key-files:
  created: []
  modified:
    - "frontend/src/pages/WorkflowsPage.tsx"
    - "frontend/src/pages/WorkflowsPage.test.tsx"

key-decisions:
  - "The RED was driven by authoring the tests BEFORE the source edit (the 192-13 / 192-14 precedent), so it ran against the genuinely shipped blob with nothing to restore; md5 `f2d2af05…` recorded identical before and after either way."
  - "Every new case waits FIRST on the `createWorkflowDraft` call count — true on BOTH the pre- and post-fix path — and only then asserts the notice under an explicit 2 s `waitFor` budget. This file sets `asyncUtilTimeout: 15000`, which is LONGER than vitest's 5 s per-test budget, so a bare `findByTestId` on the absent notice would have blown the test timeout before Testing Library ever reported what it could not find. All four REDs are real `AssertionError`s naming the missing node."
  - "`onUseStarter`'s retry was PRESERVED and is now pinned from the inside at exactly two calls — measured RED-side too, which is what proves this plan neither introduced it nor can quietly delete it."
  - "`isForkConflict` is a re-home, not a fix. WR-08 (control flow keyed on error prose) is recorded honestly in its docblock with a named re-open trigger rather than 'fixed' by giving the substring test a nicer name — the real fix is a typed error at `createWorkflowDraft`'s throw site, an `api.ts` change with callers outside this page, which G-7 puts out of scope for a gap round."
  - "`ROADMAP.md`, `CLAUDE.md` and `192-UAT.md` were deliberately NOT written: plan `192-16` owns those files per this round's execution constraints. Recorded so their absence reads as ownership, not oversight."

patterns-established:
  - "Fix BOTH siblings behind one shared word, not the one that was clicked — a surface that reports only half its failures is not honest, and D-12 means the user cannot tell the two apart anyway."

requirements-completed: [LIB-03]

# Metrics
duration: 19min
completed: 2026-08-11
---

# Phase 192 Plan 15: The Click That Failed Now Says So Summary

**Both fork handlers now render a user-visible sentence when they fail — naming the workflow and stating that nothing was written — and the starter's single 409 retry is provably still there.**

## Performance

- **Duration:** 19 min
- **Started:** 2026-08-11T19:26:00Z
- **Completed:** 2026-08-11T19:45:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- **The U5 blocker's second half is closed.** The operator's report — *"nothing happened, even the card's still the same"* — was **literally accurate**: `catch (e) { console.error(…) }` and no more. A fork that fails now renders `library-fork-failed` above the fold, with `role="status"` so it is announced rather than merely present.
- **It fires on the path that actually still fails.** `192-14` removed the collision on every row with a draft to open; the **2 measured `published + published` residual slugs** have none, so the create path runs and 409s deterministically. Test A drives exactly that shape — a published `vendor-risk` with **no** matching draft in the feed — so the notice is proved on the residual's own path rather than on a convenient one.
- **BOTH handlers, because a user cannot tell which one they clicked.** `onTweak` and `onUseStarter` share ONE WORD on the card face (D-12). Fixing only the reported one would have left half the surface silent.
- **The retry that needed reporting was not deleted to silence the report.** `onUseStarter`'s single 409 retry is untouched and is now pinned from the inside at **exactly two `createWorkflowDraft` calls** — asserted on the PRE-fix source as well (T-192-42).
- **The message cannot leak server prose by construction.** `forkFailed` holds `{ name, conflict }`; `forkFailedMessage(name, conflict)` takes a display name and a boolean. There is no shape in which a status code, a server body or an id reaches the surface (T-192-40). Both `console.error` calls survive for the developer.
- **No dependency was acquired.** This repo has no toast library (zero `sonner` imports, no `ui/toast`), and a gap-closure round is the wrong place to add one. The shipped page-level failure-banner pattern was extended, in the region that already hosts it.

## Task Commits

1. **Task 1: four failure-visibility cases, driven RED against the swallowing catch** — `47c23baf` (test)
2. **Task 2: the notice — one state, one node, two catch blocks** — `cfea0e54` (feat)

**Plan metadata:** see the final `docs(192-15)` commit.

_TDD note: the RED was driven **before** the Task 2 source edit, so both commits are individually meaningful; Task 2 turned all four green in one move._

## The RED, verbatim (Task 1 acceptance)

Driven against the **genuinely unedited** page — the tests were authored first, so no restore was needed and the shipped blob was never touched:

```
md5 BEFORE RED: f2d2af055726671b09ff76b8f9af7cba *src/pages/WorkflowsPage.tsx

 FAIL  src/pages/WorkflowsPage.test.tsx > 192-15 (WR-03) — a fork click that fails says so
       > A — the 409 on the residual published+published shape refuses OUT LOUD, and writes nothing
AssertionError: the fork failed and the surface said NOTHING — the error reached
console.error and nowhere else (WR-03): expected null not to be null

 FAIL  … > B — a NON-conflict failure says the other true thing: nothing was created
AssertionError: the fork failed and the surface said NOTHING — the error reached
console.error and nowhere else (WR-03): expected null not to be null

 FAIL  … > C — the STARTER fork's TERMINAL failure is visible, and its single 409 retry is still there
AssertionError: the fork failed and the surface said NOTHING — the error reached
console.error and nowhere else (WR-03): expected null not to be null

 FAIL  … > D — a later SUCCESSFUL fork clears the notice: a stale failure over a success is its own lie
AssertionError: the fork failed and the surface said NOTHING — the error reached
console.error and nowhere else (WR-03): expected null not to be null

 ❯ waitFor.timeout src/pages/WorkflowsPage.test.tsx:1036:15
   1034|           screen.queryByTestId("library-fork-failed"),
   1035|           "the fork failed and the surface said NOTHING — the error re…
   1036|         ).not.toBeNull()
      |               ^
   1038|       { timeout: 2000 },

 Test Files  1 failed (1)
      Tests  4 failed | 44 passed (48)
   Duration  41.45s

md5 AFTER  RED: f2d2af055726671b09ff76b8f9af7cba *src/pages/WorkflowsPage.tsx
```

**The two md5s are IDENTICAL**, and every RED is a real assertion error naming the missing node — `expected null not to be null` on `library-fork-failed` — never a bare timeout.

**⚠ That property was DESIGNED IN, not lucky, and it is 192-14's lesson applied one layer further.** This file sets `configure({ asyncUtilTimeout: 15000 })`, which is **longer than vitest's 5 s per-test budget**. A bare `await screen.findByTestId("library-fork-failed")` would therefore have blown the *test* timeout at 5 s before Testing Library ever rejected at 15 s — producing exactly the bare `Test timed out in 5000ms` that in THIS file is indistinguishable from the `D-192-DEF-01` class and would have proved nothing. Each case instead waits first on the `createWorkflowDraft` **call count** (true on both the pre- and post-fix path) and then asserts the notice under an explicit `{ timeout: 2000 }`, which is why all four report an assertion rather than a stopwatch.

### Test C's PRE-fix call count was 2 — the required evidence

Test C's RED is the **notice** assertion at `:1036`, **not** its preceding `await waitFor(() => expect(mockCreateDraft).toHaveBeenCalledTimes(2))`. A `waitFor` that fails aborts the case at its own line; C got past that line and failed on the next one. So on the **unedited** source `createWorkflowDraft` was already called **exactly twice** on a starter whose fork 409s both times.

That is the whole point of measuring it RED-side: **the retry pre-dates this plan and was not introduced by it**, and the same assertion now stands in the way of anyone deleting it under cover of this repair (T-192-42).

## Verification measured

| Gate | Required | Measured |
|---|---|---|
| `npx tsc -p tsconfig.app.json --noEmit \| grep -c "error TS"` | 33 | **33** (baseline, after Task 1, after Task 2) |
| `npx eslint src/pages/WorkflowsPage.tsx` | no output | **clean** (exit 0) |
| `npx eslint src/pages/WorkflowsPage.tsx -c eslint.a11y.config.js` | no output | **clean** (exit 0) |
| `npx eslint src/pages/WorkflowsPage.test.tsx` | no output | **clean** (exit 0) |
| `WorkflowsPage.test.tsx` standalone | 48 (44 + 4) | **48 passed / 0 failed** |
| `src/pages/WorkflowsPage.test.tsx src/components/workflows/library` | green | **5 files / 223 passed** (was 219 + 4) |
| `librarySubtree.fences.test.ts` (F1 / F4 / F5) | 64 passed | **64 passed** |
| `grep -c 'data-testid="library-fork-failed"'` | 1 | **1** |
| `grep -c "setForkFailed"` | 5 | **5** |
| `grep -c 'String(e).includes("409")'` | 1 | **1** |
| `grep -c 'console.error("\[WorkflowsPage\]'` | ≥ 2 | **2** |
| `git diff \| grep -c "^-.*\bit("` on the test file | 0 | **0** (+139 insertions, 0 deletions) |
| `node scripts/vitest-count-gate.cjs` (capped) | exit 0 | **exit 0** — `total 3188 · failed 0 · 60/60 pinned files present, no per-file decrease` |

### The two named shipped fork tests, quoted from the runner

```
 ✓ src/pages/WorkflowsPage.test.tsx > WorkflowsPage — Tweak forks a v(N+1) draft (INSERT, never UPDATE)
   > Tweak calls createWorkflowDraft with version = def.version + 1, same slug, status 'draft' 268ms
 ✓ src/pages/WorkflowsPage.test.tsx > WorkflowsPage — the starter row and its fresh-copy fork (WF-01, D-143-1/2/8)
   > onUseStarter forks a FRESH copy: new suffixed slug + v1 + draft (INSERT, never UPDATE the frozen starter) 214ms
 ✓ src/pages/WorkflowsPage.test.tsx > 192-14 (U5 blocker) — forking a slug you ALREADY have a draft of opens that draft
   > the fork verb creates NOTHING and opens the copy you already started 189ms
```

The starter case is the one the plan named explicitly, and it is green **because the retry was preserved rather than removed** — it seeds a resolving `mockCreateDraft`, so it never reaches the retry branch, but the branch it does reach is byte-equivalent (`isForkConflict(e)` is `String(e).includes("409")` with a name).

### The count gate

`node scripts/vitest-count-gate.cjs`, run with `GSD_VITEST_MAX_WORKERS=4` per CLAUDE.md rule 2 and `192-14`'s measured correction to `D-192-DEF-01`: **exit 0**, `failed 0`, no `[count-decrease]`, `total 3184 → 3188 (+4)`.

`WorkflowsPage.test.tsx` reads **40 pinned → 48 actual (+8)** — an increase above the pin, which is safe until pinned. **⚠ The pin raise owed to `192-16` is therefore `40 → 48`, not the `40 → 44` `192-14` recorded** (its 44 plus this plan's 4), on top of `192-13`'s owed `WorkflowCard.test.tsx` **35 → 39**. The gate was NOT edited here.

## What the source change actually is

Five edits, one concern, in a render region that already hosted it:

1. **`forkFailed` state** (`{ name, conflict } | null`), declared next to `runCta` — the page's other page-level notice. Its docblock states why it holds a name and a boolean rather than the error: a shape that cannot carry server prose cannot leak it.
2. **`isForkConflict(e)`** at module scope, beside `freshHash` (the fork's other module-scope helper). Behaviour-identical; it gives one question one home. Its docblock records **WR-08** honestly — keying control flow on error prose is fragile, `createWorkflowDraft` throws a bare `Error` whose *message* carries the status, and the typed-error fix is an `api.ts` change with callers outside this page (notably `useDraftPersistence`) — and names the **re-open trigger**: the next phase that touches `createWorkflowDraft`'s throw site.
3. **`onTweak`** — `setForkFailed(null)` before the create attempt (below `192-14`'s existing-draft branch, which returns early and creates nothing), and `setForkFailed({ name: wf.name, conflict: isForkConflict(e) })` in the catch **alongside** the surviving `console.error`.
4. **`onUseStarter`** — `setForkFailed(null)` **before the loop** (the retry is one attempt from the person's point of view), the inline `String(e).includes("409")` replaced by `isForkConflict(e)` in the retry condition, and the notice set on the **terminal** branch only. The retry itself is untouched.
5. **The notice** — one `<p data-testid="library-fork-failed" role="status">` immediately after `failedSources.map(...)` and before `<LibraryToolbar>`, with the source-failed banner's own warning classes. `role="status"` is the shipped `draft-delete-error` precedent from the card, which is what makes a message appearing *after* a click announced rather than merely present.

Nothing else changed. No merge, chip, empty-state, delete-grade or Run-path edit; no card-density change (U5-b stays out, D-192-DEF-02).

## Decisions Made

1. **Both handlers, not the one that was reported.** D-12 gives them one word on the card face; a person cannot tell which they clicked, so a surface that reports only half its failures is not honest.
2. **The retry is preserved and pinned rather than removed.** Deleting it would have been "fixing" the silence by deleting the behaviour that needed reporting. Test C asserts exactly two calls, from both sides of the fix.
3. **Both `console.error` calls survive.** The raw error is the developer's evidence and the sentence is the person's; one does not replace the other. This is the shipped `WorkflowDraftUnreadableError` posture.
4. **`isForkConflict` is a re-home, not a fix, and says so.** Naming WR-08 with a trigger is the honest middle: the fragility now has exactly one place to be fixed instead of two, without a gap round acquiring an `api.ts` surface it has no business touching (G-7).
5. **No toast library.** Verified absent; the shipped page-level notice pattern was extended in the region that already carries this page's failure vocabulary (G-5: `WorkflowsPage.tsx` is on the hot-file ledger and gains no second concern).
6. **`ROADMAP.md` / `CLAUDE.md` / `192-UAT.md` were NOT written** — `192-16` owns them.

## Deviations from Plan

**None affecting scope.** Two deviations of method, both documented rather than applied silently:

- **The plan's Test A/B/C wording implies `findByTestId` on the notice; every case instead waits on the call count first and asserts the notice under an explicit `{ timeout: 2000 }`.** The reason is measured, not stylistic: `asyncUtilTimeout` (15 s) exceeds vitest's per-test budget (5 s) in this file, so the straightforward wait would have produced a bare timeout — the exact RED the plan forbids by name. The assertion checked is unchanged.
- **`isForkConflict` is placed at module scope beside `freshHash`** rather than physically adjacent to the handlers (which live inside the component). The plan asked for "one module-scope helper beside the handlers"; module scope and adjacency to the handlers are mutually exclusive, and module scope is the half the plan specified mechanically. `freshHash` is the fork's other module-scope helper, so the two now sit together.

**Total deviations:** 0 auto-fixes (no Rule 1/2/3 fix was required beyond the plan's own subject).
**Impact on plan:** none. No scope creep; no capability added; card density untouched.

## Issues Encountered

One, trivial and worth recording only because the path is easy to get wrong: `scripts/vitest-count-gate.cjs` lives at the **repo root**, not under `frontend/` — running it from the frontend directory fails with `MODULE_NOT_FOUND`, which is not a gate failure. Re-run from the root, capped, it exits 0.

## Threat Flags

None. This round adds no network endpoint, no auth path, no file access and no schema surface — it adds one piece of local component state and one text node.

Threat register dispositions, as executed:

- **T-192-40** (information disclosure) — **mitigated by signature.** `forkFailed` is `{ name: string; conflict: boolean }` and `forkFailedMessage` takes exactly those two. There is no code path by which a status code, a server body, an id or stack text can reach the notice. The raw error stays in `console.error`.
- **T-192-41** (repudiation — a click with no outcome) — **mitigated.** Both handlers set the notice on every terminal failure; tests A–D pin all four exits (tweak-conflict, tweak-other, starter-terminal, recovery).
- **T-192-42** (tampering — the retry) — **mitigated, and measured on both sides.** Test C asserts exactly two `createWorkflowDraft` calls, and the PRE-fix run reached that assertion successfully.
- **T-192-43** (spoofing — a stale notice over a later success) — **mitigated.** `setForkFailed(null)` at the top of both attempts; Test D DRIVES the recovery (fail, then succeed) rather than assuming it.
- **T-192-SC** — n/a: no package installs, no `package.json` change; explicitly no toast library added.

## Known Stubs

**None, and one seam is now closed.** `192-13` authored `forkFailedMessage` with no caller and `hasExistingFork` with no caller; `192-14` consumed the second and this plan consumes the first. Every export authored by this gap-closure round now has a live caller.

## User Setup Required

None.

## Next Phase Readiness

- **`192-16`** owes, updated by this plan's measurements:
  - the count-gate pin raise `WorkflowsPage.test.tsx` **40 → 48** (⚠ **not** the `40 → 44` `192-14` recorded — its 44 plus this plan's 4; read from the gate's own `actual` column across two agreeing capped runs today), on top of `192-13`'s `WorkflowCard.test.tsx` **35 → 39**;
  - the `ROADMAP.md`, `CLAUDE.md` and `192-UAT.md` writes;
  - a decision on `D-192-DEF-01` with `192-14`'s four measurements plus this plan's two — the gate is green under the project's own mandated invocation.
- **Still open, and NOT closed by this plan:** the U5 UAT row itself, and the ten other owed G-4 rows. The code half of U5 is now complete on both sides — the collision is removed where a draft exists (`192-14`) and refused out loud where it does not (this plan) — but the operator's click still needs re-driving on the live surface. The two residual slugs to drive it against are named in `WorkflowsPage.tsx`: `meridian-risk-summary-good-07aedc33` and `readonly_refusal_098uat`.
- **`D-192-DEF-02` (U5-b, card density)** remains deferred and untouched, as G-7 requires.

## Self-Check

- `frontend/src/pages/WorkflowsPage.tsx` — FOUND (`library-fork-failed` ×1, `setForkFailed` ×5, `isForkConflict` present, both `console.error` intact)
- `frontend/src/pages/WorkflowsPage.test.tsx` — FOUND (48 cases green, +139/−0)
- `.planning/phases/192-workflow-library-ia/192-15-SUMMARY.md` — FOUND
- Commits `47c23baf`, `cfea0e54` — FOUND in `git log`

## Self-Check: PASSED

---
*Phase: 192-workflow-library-ia*
*Completed: 2026-08-11*
