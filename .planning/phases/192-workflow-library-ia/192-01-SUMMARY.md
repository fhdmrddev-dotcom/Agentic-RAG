---
phase: 192-workflow-library-ia
plan: 01
subsystem: testing
tags: [vitest, count-gate, test-infrastructure, guardrail, wave-0]

# Dependency graph
requires:
  - phase: 190-external-connectors
    provides: "the two prior both-knobs adoptions (190-16 ConnectionsTab, 190-17 ConnectionFormPanel) whose comment shape this plan copies"
  - phase: 188-workflow-run-surface
    provides: "the 188-12 zero-slack pin doctrine — an unpinned suite is an UNGUARDED one, not a lightly-guarded one"
provides:
  - "Five WorkflowsPage-covering suites inside BOTH count-gate knobs (TARGETS + BASELINE): WorkflowsPage.test.tsx 23, RunModal.test.tsx 11, RunModal.a11y.test.tsx 8, PublishedCardDelete.test.tsx 7, WorkflowBuilderPage.session.test.tsx 23"
  - "A recorded DECLINE for ChatLayoutLaunch.test.tsx with its written reason (OQ3 resolved both ways)"
  - "A corrected BASELINE_TOTAL marker: 2775 (stale by 63) -> 2887 -> 2910"
  - "The stick that already existed: 92 previously-invisible tests are now deletion-visible BEFORE D-01's restructure touches one line of source"
affects: [192-03, 192-04, 192-05, 192-06, 192-07, 192-08, 192-09, 192-10, 192-11, 192-12, any-future-WorkflowsPage-work]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Both-knobs adoption: a TARGETS entry that NAMES which existing entry failed to cover the file, plus a BASELINE pin READ from the gate's own actual column"
    - "A decline is recorded with its reason in the same comment block as the adoption — a decline with no reason is indistinguishable from an oversight"
    - "A research assumption (A6) is written into the adoption comment BEFORE the pin, and confirmed by measurement before the pin lands"

key-files:
  created: []
  modified:
    - scripts/vitest-count-gate.cjs

key-decisions:
  - "ADOPT WorkflowBuilderPage.session.test.tsx (OQ3 half 1) — it renders the live WorkflowsPage three times and was pinned by nothing; an unpinned covering suite is an UNGUARDED one"
  - "DECLINE ChatLayoutLaunch.test.tsx (OQ3 half 2) — 2 tests owned by the layout concern, reaching the page only through ChatLayout, whose launch contract is already pinned by ChatLayout.launch.test.tsx (17)"
  - "FILE-LEVEL TARGETS entries for src/pages/__tests__/, never the bare directory — the same reasoning the script already records for the panel directory, src/lib, src/pages, src/components/layout and src/components/settings"
  - "The four pre-existing +24 drift rows are deliberately NOT re-pinned — folding an unrelated drift into a commit that did not cause it is what the script's own header argues against"

patterns-established:
  - "Two agreeing runs means byte-identical output, not merely equal totals — the Task 2 pair differ ONLY in the temp report path"
  - "A marker figure written as an expectation must be falsified against the printed column, and the sequence is recorded rather than implied"

requirements-completed: [LIB-01, LIB-02, LIB-03, LIB-04]

# Metrics
duration: 32min
completed: 2026-08-10
---

# Phase 192 Plan 01: Count-Gate Adoption Summary

**Five suites that render the live `WorkflowsPage` — 92 tests, previously invisible to both count-gate knobs — are now TARGETS-executed and BASELINE-pinned, in the two commits that open Phase 192 and change no source.**

## Performance

- **Duration:** ~32 min
- **Started:** 2026-08-10T22:47Z
- **Completed:** 2026-08-10T23:19Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments

- Closed the **eighth recorded two-knob trap**, and the first one that lands on the very file its phase exists to rewrite. Before this plan, `src/pages/WorkflowsPage.test.tsx` was in **neither** `TARGETS` nor `BASELINE`, and neither were the three `src/pages/__tests__/` suites nor `WorkflowBuilderPage.session.test.tsx`. RESEARCH measured the consequence: **74 of the 123 tests covering the surface Phase 192 rewrites were invisible to the gate**. D-01's restructure could have dropped an `it()` and left the gate green.
- **Pinned files 51 → 56; pinned total 2838 → 2910.** Every one of the five numbers was READ from the gate's own printed `actual` column, never hand-counted and never copied from a planning document.
- Resolved **OQ3 in both directions with written reasons** — adopt `session`, decline `ChatLayoutLaunch` — so neither half can later read as an oversight.
- Corrected the trailing `BASELINE_TOTAL` marker, which was **stale by 63** on an unmodified tree (read `2775`, reduce computed `2838`). That is the **ninth** time this note has gone stale by being computed rather than read; the correction is recorded in place rather than smoothed over.
- **No source file was touched.** `git diff --name-only` returned exactly `scripts/vitest-count-gate.cjs` for both commits — which is the property that makes this a stick that already existed.

## Task Commits

1. **Task 1: Adopt the four library-covering suites into TARGETS + BASELINE** — `e51f765c` (chore)
2. **Task 2: Decide and record the two open adoption questions (OQ3)** — `9b6b1c38` (chore)

## Files Created/Modified

- `scripts/vitest-count-gate.cjs` — five `TARGETS` entries + five `BASELINE` pins + the recorded decline + two `BASELINE_TOTAL` marker corrections (150 insertions across two commits; no other file touched)

## The measured numbers — both runs, per the plan's output requirement

**RESEARCH's expectation was 23 / 11 / 8 / 7 / 23. Every one of the five agreed with the measurement.** Stated plainly rather than presented as a read: these were treated as expectations to falsify, and the gate's printed `actual` column confirmed each. A prediction that survives a measurement is still worth only the measurement.

### Task 1 — the four

| Suite | Read as `new` (pre-pin run) | Run 1 (post-pin) | Run 2 (post-pin) | Pinned |
|---|---|---|---|---|
| `WorkflowsPage.test.tsx` | 23 | 23 (delta 0) | 23 (delta 0) | **23** |
| `RunModal.test.tsx` | 11 | 11 (delta 0) | 11 (delta 0) | **11** |
| `RunModal.a11y.test.tsx` | 8 | 8 (delta 0) | 8 (delta 0) | **8** |
| `PublishedCardDelete.test.tsx` | 7 | 7 (delta 0) | 7 (delta 0) | **7** |

- Pre-adoption baseline (unmodified tree): `51/51 pinned files · total 2862 · failed 0 · pinned total 2838`
- Post-adoption, both runs: `55/55 pinned files · total 2911 · failed 0 · pinned total 2887`
- **Adoption imported zero rot:** `failed 0` before, `failed 0` after.

### Task 2 — the fifth, plus the decline

| Suite | Read as `new` | Run 1 | Run 2 | Pinned |
|---|---|---|---|---|
| `WorkflowBuilderPage.session.test.tsx` | 23 | 23 (delta 0) | 23 (delta 0) | **23** |

- Post-adoption, both runs: `56/56 pinned files · total 2934 · failed 0 · pinned total 2910`, exit 0.
- **The two runs are byte-identical apart from the temp report path.** `diff` of the two captured outputs returns only the four lines carrying the `vitest-count-gate-<pid>-<ts>.json` filename — every per-file row, the total row and the verdict line match exactly. That is a stronger form of "two agreeing runs" than equal totals.

### The A6 measurement (required before the `session` pin)

RESEARCH assumption A6 held that `WorkflowBuilderPage.session.test.tsx > "pane click …"` timing out at **5060 ms against a 5000 ms limit** under `--maxWorkers=4` was a parallel-load flake, not latent rot.

**Confirmed before pinning.** Two standalone runs with `GSD_VITEST_MAX_WORKERS=4 npx vitest run --maxWorkers=4 src/pages/WorkflowBuilderPage.session.test.tsx`:

| Run | Result | Duration |
|---|---|---|
| 1 | `1 passed (1) / 23 passed (23)` — **0 failures** | 17.55 s |
| 2 | `1 passed (1) / 23 passed (23)` — **0 failures** | 17.44 s |

The flake did **not** reproduce on either run, and it did not appear in any of the four full-gate runs either. The plan's contingency ("if run 1 reds only on pane click, record both outcomes") did not fire. The standing instruction is written into the script itself: **if that case reds during the rest of Phase 192, re-run before declaring red — it is a pre-existing flake, not a regression to chase.**

### The `BASELINE_TOTAL` marker — two corrections, both recorded

| Point | Marker read | Reduce computed | Action |
|---|---|---|---|
| At HEAD (`17c30d4f`) | `2775 (190-15)` | **2838** | **Stale by 63.** Recorded in place as the ninth staleness event, not silently rewritten. |
| After Task 1 | — | 2887 | Marker set to `2887`, read from the printed `pinned total` across two runs. |
| After Task 2 | — | 2910 | Marker set to `2910`; the honest sequence (written as an expectation `2887 + 23`, then falsified against the printed column — it agreed) is stated in the comment itself. |

## Decisions Made

- **ADOPT `WorkflowBuilderPage.session.test.tsx`** (OQ3, half 1) — three live `WorkflowsPage` renders at `:482`, `:510`, `:768` (verified by grep at HEAD), pinned by nothing. Applied the 188-12 statement: an unpinned covering suite is an *unguarded* one, not a lightly-guarded one.
- **DECLINE `ChatLayoutLaunch.test.tsx`** (OQ3, half 2) — 2 tests (`grep -c "it("` → 2), owned by the layout concern, reaching the page only transitively through `ChatLayout`, whose own launch contract is already pinned via `ChatLayout.launch.test.tsx` (17, adopted at 188-09). Adopting it would make Phase 192 the owner of the layout directory's future rot for two tests that assert nothing about the library IA. The reason is written into the script beside the adoption, per its own rule.
- **FILE-LEVEL `TARGETS` entries, never the bare `src/pages/__tests__` directory** — the same reasoning the script already records for `src/components/panel/__tests__`, `src/lib`, `src/pages`, `src/components/layout` and `src/components/settings`. A later phase that wants the other suites in that directory should adopt them deliberately, with its own measured number.
- **Bare-name collision check performed before keying the pins.** A glob across `frontend/src/**` returned exactly one path for each of the five bare names, so every keyed pin is unambiguous.
- **The pre-existing +24 drift is deliberately NOT re-pinned** (see Issues below) — folding an unrelated drift into a commit that did not cause it is the thing the script's own header argues against.

## Deviations from Plan

None — plan executed exactly as written. Both tasks' acceptance criteria were met on the numbers the plan predicted, and no auto-fix rule fired.

One point of process worth naming, since it is a habit the script exists to enforce rather than a deviation: while updating the Task 2 marker I **wrote `2910` before running the gate** (as `2887 + 23`). Rather than leave that implied, the run was then used to falsify it — it agreed — and the comment in the script now states that sequence explicitly, including that the printed value is what would have stayed had the two disagreed.

## Issues Encountered

**1. The trailing `BASELINE_TOTAL` marker was stale by 63 at HEAD — the largest margin yet.**
It read `2775 (190-15)` while the reduce computed **2838** on an unmodified tree. Harmless to the gate (the reduce is what the gate reads; the marker is prose beside it) but exactly the failure the script's header documents. Corrected in place with the event recorded, per the house `⚠` rule.

**2. Four pre-existing count drifts, none caused by this plan, none re-pinned.**
The gate prints `+24` on the total, from four under-pinned files:

| File | Pinned | Actual | Delta | Status |
|---|---|---|---|---|
| `ExternalActionSection.test.tsx` | 25 | 34 | +9 | Owed since 190-12, unchanged |
| `PhaseTimeline.test.tsx` | 17 | 21 | +4 | Owed since 190-12, unchanged |
| `WorkflowBuilderPage.canvas.test.tsx` | 128 | 133 | +5 | **Newly observed here** — not previously recorded |
| `builderStore.test.ts` | 52 | 58 | +6 | **Newly observed here** — not previously recorded |

All four sit outside Phase 192's blast radius. Nine, four, five and six cases respectively are deletable with the gate green today. **Owed as its own edit** — recorded in the script's marker comment so the next reader inherits the measurement rather than re-deriving it.

## Known Stubs

None. This plan adds no runtime code, no UI, and no data path — it changes only test-infrastructure coverage.

## Threat Flags

None. No new network endpoint, auth path, file access pattern or schema touched. T-192-06 and T-192-07 (the plan's two `mitigate` dispositions) are both discharged: the five covering suites are inside both knobs, and every pin was read from the gate's own `actual` column across agreeing runs rather than computed. T-192-SC is `accept` and remains correct — **zero packages were installed**.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **The stick exists before the swing.** Every later Phase 192 commit is now measured against a gate that would report `[count-decrease]` if D-01's restructure drops an `it()`.
- **A standing instruction for the rest of the phase, written into the script:** any new suite Phase 192 creates must get its `TARGETS` entry **in the commit that creates the file** — an entry pointing at a path that does not exist makes the gate ERROR (exit 2), not fail.
- **A lowering is coming and is legitimate.** `WorkflowsPage.test.tsx` is pinned at 23; D-01 deletes the shelf-order cases. That pin must be lowered **in the same commit as the deletion**, at a number read from the `actual` column — never to make a red gate go quiet. This is stated in both the map entry and the TARGETS block so the plan that does it cannot miss the rule.
- **Not done here, deliberately:** the four drifted pins above. A future edit that adopts them should read its own numbers.

## Self-Check: PASSED

- `scripts/vitest-count-gate.cjs` — FOUND (modified; the plan creates no new file)
- `.planning/phases/192-workflow-library-ia/192-01-SUMMARY.md` — FOUND
- Commit `e51f765c` — FOUND
- Commit `9b6b1c38` — FOUND
- `grep -c "src/pages/WorkflowsPage.test.tsx"` → 1 · `src/pages/__tests__/RunModal.test.tsx` → 1 · `RunModal.a11y.test.tsx` → 1 · `PublishedCardDelete.test.tsx` → 1 · `src/pages/WorkflowBuilderPage.session.test.tsx` → 1
- `grep -c "ChatLayoutLaunch"` → 1, in a **comment**; absent from `TARGETS` and from the `BASELINE` keys
- `A6` and `5060` both present in the adoption comment block
- `node scripts/vitest-count-gate.cjs` → exit 0, twice, byte-identical apart from the temp report path
- `git diff --name-only HEAD~1` → exactly `scripts/vitest-count-gate.cjs`, for both commits
- STATE.md and ROADMAP.md untouched; no `state.*`, `requirements.mark-complete` or `roadmap.update-plan-progress` SDK verb called

---
*Phase: 192-workflow-library-ia*
*Completed: 2026-08-10*
