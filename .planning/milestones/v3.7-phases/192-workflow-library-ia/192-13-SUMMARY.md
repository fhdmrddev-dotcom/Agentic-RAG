---
phase: 192-workflow-library-ia
plan: 13
subsystem: ui
tags: [react, vitest, vocabulary, a11y, aria-describedby, gap-closure]

# Dependency graph
requires:
  - phase: 192 (plans 05 / 09)
    provides: "`libraryVocabulary.ts` (the one copy home + its F5 fence) and `library/WorkflowCard.tsx` with its single `fork-consequence` node wired by `aria-describedby`"
provides:
  - "`FORK_CONSEQUENCE_EXISTING` — the true consequence sentence for a row the user has already forked"
  - "`forkFailedMessage(name, conflict)` — the never-silent page notice for a failed fork (consumed by 192-15)"
  - "`WorkflowCard`'s optional `hasExistingFork` prop: one node, two sentences, default byte-identical to what shipped"
  - "4 new pinned cases (39 total), including the aria-describedby round trip driven on the NEW variant"
affects: [192-14 (the fork verb's new behaviour), 192-15 (renders forkFailedMessage), 192-16 (owes the count-gate pin raise 35 → 39)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A consequence sentence is SELECTED from the row's real state, never appended — the node count is invariant, so a truth fix cannot smuggle in a card atom (G-7 / U5-b)"
    - "A vocabulary FUNCTION for interpolated copy (the `sourceFailedMessage` shape), so a template cannot be assembled at a call site outside the fences"

key-files:
  created: [".planning/phases/192-workflow-library-ia/deferred-items.md"]
  modified:
    - "frontend/src/components/workflows/library/libraryVocabulary.ts"
    - "frontend/src/components/workflows/library/WorkflowCard.tsx"
    - "frontend/src/components/workflows/library/WorkflowCard.test.tsx"

key-decisions:
  - "The plan's '16 of the 18 slugs' was re-measured against the live DB rather than inherited: 18 is CONFIRMED, but the exact-shape count is 14 (15 under a loose predicate). The docblock states the corrected figure and names the correction."
  - "The RED was driven by authoring the tests BEFORE Task 2's source edit rather than by `git stash` — strictly stronger evidence (the real shipped blob, not a restored one) and it avoids the shared-stash hazard; md5 recorded identical either way."
  - "The count gate is RED at HEAD and was RED at the pre-plan base too (failed 2 with all three files reverted). Logged as `D-192-DEF-01`, NOT fixed — it is a ~5 s timeout class in a suite this plan does not touch."
  - "ROADMAP.md was deliberately NOT written: plan 192-16 owns that file (and CLAUDE.md and 192-UAT.md) per this round's execution constraints."

patterns-established:
  - "Date the gate: when a shared gate is red, revert THIS plan's files to their shipped bytes and re-run before attributing the failure (run 3 here found the base strictly worse)."

requirements-completed: [LIB-03]

# Metrics
duration: 34min
completed: 2026-08-11
---

# Phase 192 Plan 13: The Words the Library Could Not Say Summary

**A published row you have already forked now SAYS SO before the click — one node, two sentences, selected by state — and the never-silent copy for a failed fork exists in the vocabulary home, ready for `192-15`.**

## Performance

- **Duration:** 34 min
- **Started:** 2026-08-11T22:44:00Z
- **Completed:** 2026-08-11T23:18:00Z
- **Tasks:** 3
- **Files modified:** 3 (+1 created: `deferred-items.md`)

## Accomplishments

- **The quiet lie is closed before it could ship.** `FORK_CONSEQUENCE` promises *a new private copy*; under the operator's 2026-08-11 decision a row you already forked opens your EXISTING draft instead. `192-14` changes what the verb does, and the card would have gone on stating a consequence that is false. It no longer can.
- **`forkFailedMessage(name, conflict)`** — both branches assert the same load-bearing fact, *nothing was written*, because the operator's U5 report (*"nothing happened"*) was literally accurate and a message that leaves that ambiguous is barely better than none.
- **The default did not drift, and that is pinned rather than assumed** — new case C renders a published row with the prop absent and asserts the shipped constant byte-for-byte.
- **The a11y round trip was driven on the NEW variant** (case B), not inherited from case A — `192-09`'s plant 5 proved that contract can break while every presence and text check stays green.
- **A plan-supplied number was re-measured and corrected in the open** (18 confirmed, 16 → 14).

## Task Commits

1. **Task 1: The two sentences the surface cannot currently say** — `5bbe0a8a` (feat)
2. **Task 2: The card's sentence becomes state-aware** — `efbd57e3` (feat)
3. **Task 3: Pin both variants, driven RED first** — `f085c29d` (test)

**Plan metadata:** see the final `docs(192-13)` commit.

_TDD note: the RED for tasks 2/3 was driven **before** the Task 2 source edit — see below — so the source commit and the test commit are each individually green._

## Files Created/Modified

- `frontend/src/components/workflows/library/libraryVocabulary.ts` — +61 lines, two new exports placed in the fork's own section; no existing export touched.
- `frontend/src/components/workflows/library/WorkflowCard.tsx` — +25/−3: one optional prop, one destructured default, one imported constant, one ternary at the single render site.
- `frontend/src/components/workflows/library/WorkflowCard.test.tsx` — +50/−1, the single deletion being the import line.
- `.planning/phases/192-workflow-library-ia/deferred-items.md` — new; `D-192-DEF-01` (the pre-existing gate timeouts) and `D-192-DEF-02` (U5-b).

## The RED, verbatim (Task 3 acceptance)

Driven against the **genuinely unedited** card — the tests were authored first, so no restore was needed and the shipped blob was never touched:

```
md5 BEFORE RED : b3326479c072a3060f78069a93f8eef5 *src/components/workflows/library/WorkflowCard.tsx
Tests  2 failed | 37 passed (39)

FAIL > 192-13 … > a published row the user has ALREADY forked says so, before the click
AssertionError: expected 'Opens a new private copy you can edit…' to be 'You already have your own copy of thi…' // Object.is equality
Expected: "You already have your own copy of this. Opens the copy you started. The published version stays live and unchanged."
Received: "Opens a new private copy you can edit. The published version stays live and unchanged."
  ❯ WorkflowCard.test.tsx:355:64

FAIL > 192-13 … > the aria-describedby round trip holds on the NEW variant too
AssertionError: expected 'Opens a new private copy you can edit…' to be 'You already have your own copy of thi…' // Object.is equality
Expected: "You already have your own copy of this. Opens the copy you started. The published version stays live and unchanged."
Received: "Opens a new private copy you can edit. The published version stays live and unchanged."
  ❯ WorkflowCard.test.tsx:368:35

md5 AFTER RED  : b3326479c072a3060f78069a93f8eef5 *src/components/workflows/library/WorkflowCard.tsx
```

**The two md5s are IDENTICAL**, and the RED is the meaningful one the plan demanded: both failures name the received value as the shipped `FORK_CONSEQUENCE` string — they failed on the SENTENCE, not because the prop was unknown (React ignores an extra prop, which is exactly why this RED proves something). Cases C and D were green pre-fix by design: they are regression pins, and 37 = 35 shipped + those two.

## Verification measured

| Gate | Required | Measured |
|---|---|---|
| `npx tsc -p tsconfig.app.json --noEmit \| grep -c "error TS"` | 33 | **33** (baseline, after Task 1, after Task 2) |
| `npx eslint` on all three files | no output | **clean** (exit 0), incl. `-c eslint.a11y.config.js` on the card |
| `librarySubtree.fences.test.ts` (F1 + F5) | 64 passed | **64 passed** (baseline and after the new copy) |
| `WorkflowCard.test.tsx` | 39 | **39 passed / 0 failed** |
| `src/components/workflows/library` (whole subtree) | green | **4 files / 175 passed** |
| `grep -c 'data-testid="fork-consequence"'` on the card | 1 | **1** |
| `grep -c "title="` on the card | 0 | **0** |
| `FORK_CONSEQUENCE` value byte-unchanged | 0 removed lines | **0** |
| test-file diff | insertions only, deletions on the import line | **+50 / −1**, the one deletion being the import |
| `node scripts/vitest-count-gate.cjs` | exit 0 | ⚠ **exit 1 — pre-existing, see below** |

## The count gate — stated rather than smoothed

**The gate does not exit 0 at this HEAD, and it did not at the pre-plan base either.** Four runs, alternating the source state:

| # | source state | `failed` | which |
|---|---|---|---|
| 1 | 192-13 HEAD | 1 | `WorkflowsPage.test.tsx` D-08 paraphrase (5127 ms) |
| 2 | 192-13 HEAD | 1 | the same case |
| 3 | **base `7e4abd25`** — all three files reverted, `WorkflowCard.tsx` md5 back to `b3326479…` | **2** | that case **+** `WorkflowBuilderPage.session` "pane click" |
| 4 | 192-13 HEAD | 4 | 3 × `WorkflowsPage` (5071/5445/5521 ms) + `WorkflowBuilderPage.session` |

Every failure reports `STACK_TRACE_ERROR` at **~5000–5500 ms** — vitest's default 5 s `testTimeout` — and all the `WorkflowsPage` ones sit inside its `search finds a row among 200` describe. **Standalone that file is 40 passed / 0 failed in 32 s (29 s of it test time)**: the 200-row suite is simply slow enough to tip over the per-test timeout under the gate's concurrent load. Run 3 is the load-bearing measurement — with this plan's three files reverted to their shipped bytes the gate was **strictly worse** — so the failure is dated to before this round and logged as `D-192-DEF-01` rather than fixed (SCOPE BOUNDARY; and G-7 forbids a closure round wandering into a suite it does not touch).

**The gate's PIN dimension is clean:** no `[count-decrease]`, `pinned total` unchanged at 3152, and `WorkflowCard.test.tsx` reads **35 → 39 (+4)** — an increase above the pin, which is safe until pinned. **The raise is owed to `192-16`** and was deliberately not taken here, exactly as the plan instructs.

## Decisions Made

1. **The plan's "16 of the 18" was re-measured, and corrected in the docblock.** Live local DB, 2026-08-11: **18 slugs carry more than one version** (confirmed), but **14** are the exact shape *published v1 + draft v2 and nothing else*, and **15** merely CONTAIN a published v1 and a draft v2 (that admits `pm-weekly-status-report`, which carries four). No predicate yields 16. Re-derive: `select slug from workflow_definitions group by slug having count(*) > 1`. This follows the standing project rule — do not inherit an unmeasured claim, even from your own plan.
2. **RED before the source edit, not `git stash`.** The plan offered stashing `WorkflowCard.tsx` as a fallback; authoring the tests first drives the RED against the real shipped blob with nothing to restore, which is strictly stronger evidence, and it avoids `git stash` entirely (its stack is shared across worktrees). The md5 requirement is satisfied and recorded.
3. **`ROADMAP.md` was NOT written.** This round's constraints assign that file — with `CLAUDE.md` and `192-UAT.md` — to plan `192-16`. Recorded here so its absence reads as ownership, not as an oversight.
4. **Only the sentence changed.** No atom added, removed or re-ordered; the `<p>` keeps its `id`, its `data-testid`, its `NOTE_CLASSES` and its position, and both fork controls keep their `aria-describedby`. U5-b (density) stays out of this round.

## Deviations from Plan

**None affecting scope.** One correction and one out-of-scope discovery, both documented above rather than acted on silently:

- The plan's `16 of the 18` figure was **corrected to 14/15** on re-measurement (18 confirmed). The docblock names the correction rather than repeating the plan.
- The count gate's red was **dated to the pre-plan base** and logged as `D-192-DEF-01` in `deferred-items.md`. **Not fixed** — SCOPE BOUNDARY, and fixing a 184/192-11-class timeout inside a gap-closure round is precisely what G-7 exists to prevent.

**Total deviations:** 0 auto-fixes (no Rule 1/2/3 fix was required — nothing this plan touched was broken).
**Impact on plan:** none. No scope creep; no capability added.

## Issues Encountered

The shared count gate was red on entry and stayed red. Resolved by **measurement rather than assumption**: reverting this plan's three files to their shipped bytes (`git checkout 7e4abd25 -- …`, md5 verified back to `b3326479…`) and re-running showed the base is strictly worse (2 failures vs 1). Files were restored from HEAD immediately afterwards and the working tree re-verified clean.

## Threat Flags

None. This round adds no network endpoint, no auth path, no file access and no schema surface. `T-192-34` (information disclosure via `forkFailedMessage`) is mitigated as planned: the message names only the workflow's own display name and the fact nothing was written — no status codes, no server prose, no ids; the raw error stays in `console.error` at the boundary.

## Known Stubs

None in this plan's own output. **One dependency is deliberately not yet wired, by design:** `hasExistingFork` has no caller until `192-14`, and `forkFailedMessage` has no caller until `192-15`. Both are named in the plan as this round's deliverable — the WORDS and the seam — and both default to the shipped behaviour byte-for-byte while they wait, so nothing user-visible changes until the plan that owns the behaviour ships.

## User Setup Required

None.

## Next Phase Readiness

- **`192-14`** has the sentence it needs: pass `hasExistingFork` from the page (which alone holds the merged drafts feed) when a published row's slug already has a draft the caller owns.
- **`192-15`** has `forkFailedMessage(name, conflict)` — `conflict` is the 409.
- **`192-16`** owes: the `WorkflowCard.test.tsx` count-gate pin raise **35 → 39**, read from the gate's own `actual` column across two agreeing runs (this plan measured 39 three times: the RED run, the standalone green run and two gate runs), plus the ROADMAP/CLAUDE.md/UAT writes.
- **Open, not this plan's:** `D-192-DEF-01` — the gate's ~5 s timeouts in `WorkflowsPage.test.tsx`, with a re-open trigger recorded.

## Self-Check

- `frontend/src/components/workflows/library/libraryVocabulary.ts` — FOUND (`FORK_CONSEQUENCE_EXISTING` ×1, `export function forkFailedMessage` ×1)
- `frontend/src/components/workflows/library/WorkflowCard.tsx` — FOUND (`hasExistingFork` ×3)
- `frontend/src/components/workflows/library/WorkflowCard.test.tsx` — FOUND (39 cases green)
- `.planning/phases/192-workflow-library-ia/deferred-items.md` — FOUND
- Commits `5bbe0a8a`, `efbd57e3`, `f085c29d` — FOUND in `git log`

## Self-Check: PASSED

---
*Phase: 192-workflow-library-ia*
*Completed: 2026-08-11*
