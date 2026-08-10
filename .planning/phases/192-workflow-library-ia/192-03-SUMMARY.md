---
phase: 192-workflow-library-ia
plan: 03
subsystem: testing
tags: [vitest, testing-library, characterization-baseline, react, a11y, focus-trap, run-modal]

# Dependency graph
requires:
  - phase: 192-01
    provides: "RunModal.test.tsx (pinned at 11) and RunModal.a11y.test.tsx (pinned at 8) adopted into the vitest count gate's TARGETS + BASELINE — without that adoption these two suites run in no gate at all, and a baseline nothing runs is not a backstop"
provides:
  - "Six whole-`innerHTML` captures of the Run modal, read out of the LIVE WorkflowsPage at a commit where `components/workflows/library/RunModal.tsx` provably does not exist"
  - "Both sides of the `:1369` canvas-gate `run-destination` branch, captured through the REAL `useCanvasGate` (no module mock, no setting flipped)"
  - "The modal's focus/dialog CONTRACT pinned behaviourally — role, aria-modal, initial focus, Escape, Tab containment at both edges — each driven RED against a real source plant"
  - "A mechanical, re-runnable proof that the capture PREDATES the D-01 move"
affects: [192-06, 192-12]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Characterization capture by SCRIPT SUBSTITUTION from a dumped run — never hand-typed, never hand-edited"
    - "Canvas gate exercised through the real EffectiveFeaturesProvider rather than a vi.mock of useCanvasGate"
    - "Pure-insertion test blocks: dynamic `await import(…)` inside the block instead of widening an import line above it"

key-files:
  created: []
  modified:
    - frontend/src/pages/__tests__/RunModal.test.tsx
    - frontend/src/pages/__tests__/RunModal.a11y.test.tsx

key-decisions:
  - "The canvas gate is driven through the REAL EffectiveFeaturesProvider + real useCanvasGate, not a module mock — the plan allowed a mock, and the provider is strictly stronger because it exercises the shipped code path rather than replacing it"
  - "Captures read `run-modal`.innerHTML per the plan; the dialog ROOT's own attributes (role, aria-modal, aria-label) are therefore pinned behaviourally in the a11y file instead, so nothing about the modal is left unguarded by the innerHTML/outerHTML boundary"
  - "The mid-launch Escape guard is DOUBLE (modal `:1205` AND page `onCancel` `:648-651`); measured, only the page half is observable from a live-page drive, and the test says so rather than implying it isolates the modal"
  - "No count-gate pin edit: growth is informational, a decrease is the only failure, and 192-12 owns the pinning sweep"

patterns-established:
  - "Sentinel-substitution capture: baseline literals land as `\"__CAPTURE__KEY__\"`, a dumped run writes JSON, and a node script substitutes — the literals are provably not hand-authored"
  - "Two-kinds-of-evidence labelling: an innerHTML CAPTURE answers 'does it still render what it rendered'; a behavioural CONTRACT answers 'does it still do what it does'. Never answer a red contract by re-capturing a baseline"

requirements-completed: [LIB-03]

# Metrics
duration: 34min
completed: 2026-08-10
---

# Phase 192 Plan 03: RunModal Pre-Move Characterization Baseline Summary

**Six whole-`innerHTML` captures of the Run modal plus both canvas-gate destination strings and the dialog's focus contract, committed at a SHA where `library/RunModal.tsx` answers `fatal: … does not exist` — so the stick the D-01 verbatim move is measured against provably predates it.**

## Performance

- **Duration:** ~34 min
- **Started:** 2026-08-10T23:09Z
- **Completed:** 2026-08-10T23:43Z
- **Tasks:** 2
- **Files modified:** 2 (both test files; **zero source files**)

## Accomplishments

- **Six render states captured** off the live `WorkflowsPage`, byte for byte: a bound workflow with folders, an unbound workflow, `folders=[]` (the `:1250` guard that hides the scope select), a staged template file, a launch error, and a launch in flight.
- **Both sides of the canvas-gate branch captured** (`run-destination`, `WorkflowsPage.tsx:1369`) — and they measurably differ, so a move that collapsed the branch to one destination cannot pass by capturing only the shipped default.
- **Every literal read out of the DOM and written in by script**, from a dump observed **twice** in byte-for-byte agreement (`cmp cap1.json cap2.json` → identical, 20,065 bytes each).
- **The focus/dialog contract pinned as a CONTRACT**, explicitly distinguished in writing from the captures, and **all four assertions driven RED against real plants** in `WorkflowsPage.tsx` before the plants were reverted.
- **The predates-the-move proof recorded mechanically**, not asserted — see below.

## The predates-the-move proof (verbatim)

Run in the worktree at the capture commit, before either commit landed:

```
$ git rev-parse HEAD
14b309b4bd3b04ad5718caa821c24ddb613e2d3f

$ git show HEAD:frontend/src/components/workflows/library/RunModal.tsx
fatal: path 'frontend/src/components/workflows/library/RunModal.tsx' does not exist in 'HEAD'
EXIT=128

$ ls frontend/src/components/workflows/library
ls: cannot access 'frontend/src/components/workflows/library': No such file or directory
EXIT=2
```

Re-run at this plan's **final** commit `c692659e`, and it still holds:

```
$ git show HEAD:frontend/src/components/workflows/library/RunModal.tsx
fatal: path 'frontend/src/components/workflows/library/RunModal.tsx' does not exist in 'HEAD'
EXIT=128
```

Stronger than the bare requirement: the whole destination **directory** is absent, not just the file. Note that parallel plan `192-05` creates other modules under `library/`; it does **not** create `RunModal.tsx`, which is `192-06`'s job — so this proof survives the wave merge.

`CAPTURE_SHA = "14b309b4…"` is recorded as a const in **both** test files so a later reader re-runs the commands rather than trusting this document.

## The two agreeing runs

| Run | Command | Result |
|---|---|---|
| Baseline (pre-change) | `GSD_VITEST_MAX_WORKERS=4 npx vitest run --maxWorkers=4 …/RunModal.test.tsx …/RunModal.a11y.test.tsx` | `2 passed (2)` · `19 passed (19)` — 11 + 8, matching 192-01's pins |
| Capture dump #1 | same, `-t "__DUMP__"`, `GSD_DUMP_PATH=…/cap1.json` | `1 passed \| 27 skipped` |
| Capture dump #2 | same, `GSD_DUMP_PATH=…/cap2.json` | `1 passed \| 27 skipped` |
| Agreement | `cmp cap1.json cap2.json` | **byte-identical**, 20,065 B each |
| Post-substitution #1 | `…/RunModal.test.tsx` | `27 passed (27)` |
| Post-substitution #2 | `…/RunModal.test.tsx` | `27 passed (27)` |
| Both suites #1 | both files | `43 passed (43)` |
| Both suites #2 | both files | `43 passed (43)` |

Every vitest invocation in this plan carried `GSD_VITEST_MAX_WORKERS=4` and `--maxWorkers=4`.

**Captured lengths** (non-vacuity, in bytes): `BOUND_WITH_FOLDERS` 3156 · `UNBOUND_NO_PROJECT` 3177 · `NO_FOLDERS_SCOPE_HIDDEN` 2711 · `TEMPLATE_STAGED` 3403 · `LAUNCH_ERROR` 3281 · `SUBMITTING` 3181 · `GATE_OFF` 77 · `GATE_ON` 135.

## Task Commits

1. **Task 1: Capture six whole-innerHTML render states** — `9187b965` (test)
2. **Task 2: Pin the focus/a11y contract + prove the capture predates the move** — `c692659e` (test)

Scope over both commits: `git diff --stat HEAD~2 HEAD` → **2 files changed, 527 insertions(+), 0 deletions(-)**. `git diff --name-only HEAD~2 HEAD` lists exactly the two files in the plan's `files_modified` — **nothing under `WorkflowsPage.tsx` and nothing under `frontend/src/components/`**, which is the property T-192-10 exists to protect.

## Files Created/Modified

- `frontend/src/pages/__tests__/RunModal.test.tsx` — +348. The six-row capture table, the shared `runModalCapture` render→read→unmount helper, the two `run-destination` gate rows, the `RUN_MODAL_HTML_BASELINE` / `RUN_DESTINATION_BASELINE` literals, a non-vacuity guard and seven marker tests naming what each capture contains. 11 → **27** tests.
- `frontend/src/pages/__tests__/RunModal.a11y.test.tsx` — +179. The behavioural dialog/focus contract: role + aria-modal + accessible name, initial focus, Escape, Tab and Shift+Tab edge containment, plus two positive controls. 8 → **16** tests.

## Verification

| Check | Result |
|---|---|
| `RunModal.test.tsx` | 27 passed, twice |
| `RunModal.a11y.test.tsx` | 16 passed |
| Both together | 43 passed, twice |
| `node scripts/vitest-count-gate.cjs` | **exit 0** — `count gate OK`, 56/56 pinned files present, **no per-file decrease, 0 failing**, total 2958 vs pinned 2910 |
| `npx tsc -p tsconfig.app.json --noEmit` | **33** errors — the recorded project baseline, unmoved; **0** in either touched file |
| `npx eslint` on both files | clean, exit 0 |
| `grep -c "RUN_MODAL_HTML_BASELINE"` | 10 (≥ 2 required) |
| `grep -c "toBeGreaterThan(0)"` | 2 (≥ 1 required) |
| `grep -c "CAPTURE, NOT AN EXPECTATION"` | 1 |
| `grep -c "aria-modal"` (a11y file) | 3 (≥ 1 required) |
| `grep -ci "escape"` (a11y file) | 9 (≥ 1 required) |
| Capture table key count | exactly **6** |
| Post-commit deletion check | none |

### The RED drives (Task 2) — the fences are proved live, not assumed

Plants were made in `frontend/src/pages/WorkflowsPage.tsx`, observed, then reverted with
`git checkout -- frontend/src/pages/WorkflowsPage.tsx`. `git status --short` afterwards shows
the source file clean, and neither commit contains a source change.

| Plant | Effect |
|---|---|
| `void textareaRef` instead of `textareaRef.current?.focus()` | **initial focus** row RED |
| `if (1 > 0) return` before the Tab containment body | **Tab** and **Shift+Tab** rows RED |
| Escape branch stops calling `onCancel()` | **Escape closes** row RED (4 failures total) |
| Modal's `if (!submitting)` removed **alone** | mid-launch row stayed **GREEN** — see the finding below |
| Modal's guard **and** the page's `onCancel` guard removed | mid-launch row RED |

## Decisions Made

1. **The canvas gate is driven through real code, not a mock.** The plan permitted "mocking the gate rather than flipping any setting". `useCanvasGate` reads `useEffectiveFeaturesOptional()`, so wrapping the render in the shipped `EffectiveFeaturesProvider` (the idiom already used at `WorkflowBuilderPage.canvas.test.tsx:202`) flips the gate through the **real** hook while flipping no setting. That is strictly stronger than a `vi.mock` of the hook, which would have replaced the very code path the capture is supposed to observe.

2. **Captures read `.innerHTML` of `run-modal`, per the plan — and the root's own attributes are pinned in the a11y file instead.** `innerHTML` excludes the dialog root's `role`, `aria-modal`, `aria-label` and classes. Rather than silently widen to `outerHTML`, Task 2 pins those three attributes behaviourally, so the boundary between the two files leaves no attribute unguarded.

3. **No count-gate edit.** `RunModal.test.tsx` 11 → 27 and `RunModal.a11y.test.tsx` 8 → 16 are **increases**; the gate fails only on a per-file decrease and prints growth yellow. `scripts/vitest-count-gate.cjs` is not in this plan's `files_modified` and touching it would have raced plans 192-04/05 running beside this one.

4. **Two extra positive controls beyond the plan's four assertions.** A middle-Tab control (proving the trap is containment at the edges, not a hijack that forces focus on every Tab) and the mid-launch Escape control. Both are guards on the guards; neither adds surface.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] `CaptureRow.published` typed as `typeof boundPublished` rejected the unbound fixture**

- **Found during:** Task 1
- **Issue:** `typeof boundPublished` narrows `definition.project_folder_id` to `string`, so `unboundPublished` (`null`) was a `TS2322` — and the unbound state is one of the six being captured. Left unfixed the project typecheck read **34** against its recorded baseline of 33.
- **Fix:** widened to `typeof boundPublished | typeof unboundPublished`, with a comment saying why the union names both fixtures deliberately.
- **Files modified:** `frontend/src/pages/__tests__/RunModal.test.tsx`
- **Verification:** `tsc -p tsconfig.app.json --noEmit` back to **33** errors, **0** of them in this file.
- **Committed in:** `9187b965`

**2. [Rule 3 — Blocking] `waitFor` is not in the a11y file's RTL import line**

- **Found during:** Task 2 — two tests failed with `ReferenceError: waitFor is not defined`.
- **Issue:** `RunModal.a11y.test.tsx:27` imports `render, screen, within, fireEvent, cleanup` only. Widening that line would have edited code above the appended block and cost the pure-insertion property.
- **Fix:** a local `waitForRTL()` helper reaching `waitFor` through `await import("@testing-library/react")` — the same dynamic-import idiom the repo ships at `WorkflowBuilderPage.canvas.test.tsx:656`, and the same one Task 1 used for `EffectiveFeaturesProvider`.
- **Files modified:** `frontend/src/pages/__tests__/RunModal.a11y.test.tsx`
- **Verification:** 16/16 green; `git diff` for the file is one contiguous addition, 179 insertions / 0 deletions.
- **Committed in:** `c692659e`

---

**Total deviations:** 2 auto-fixed (both Rule 3 — blocking). **Impact:** none on scope. Both were mechanical unblocks inside the plan's own two files; no source file was touched and no new capability was added.

## Findings worth carrying forward

**F1 — The mid-launch dismissal guard is DOUBLE, and only the outer half is observable from a live-page drive.** `WorkflowsPage.tsx` refuses an in-flight dismissal in **two** places: the modal's own `if (!submitting) onCancel()` (`:1205`) **and** the page's `onCancel` prop (`:648-651`, `if (runSubmitting) return`). Measured by plant: deleting the modal's guard alone left the assertion **green**; deleting both turned it red.

**Why this matters to `192-06`:** the D-01 move takes the modal and **leaves `onCancel` on the page**. A move that dropped the modal's inner guard would not be caught by any assertion in this plan. This is recorded in the test's own comment as well as here, precisely so a later reader does not inherit the belief that the row isolates the modal. It is not a defect today (the outer guard holds), and closing it would mean testing `RunModal` in isolation — which is `192-06`'s natural moment, once the component has a module of its own to import.

**F2 — Confirmed at HEAD, unchanged from RESEARCH.md:** `function RunModal(` at `:1054`, closing `}` at `:1405`, `:1406` blank, `:1407` `export default WorkflowsPage`. A move range that includes `:1407` relocates the page's default export.

**F3 — The modal is deterministic under capture.** Two full dumps agreed byte for byte. The modal reads no clock, no randomness and no measurement API, so a future capture that differs between two runs is a real finding to report, not flake to re-roll.

## Issues Encountered

- **The worktree came up on the wrong base.** `HEAD` was `fda79214` (a `master` merge commit) rather than the dispatched `14b309b4`; `git merge-base` returned `3781a3fe`. The startup assertion caught it and it was corrected with `git reset --hard 14b309b4` per the branch-check protocol, then re-verified before any baseline was captured. This is the second wave in a row this has fired — the assertion is load-bearing, not ceremony.
- No other issues. No checkpoints, no auth gates, no architectural decisions.

## Owed to 192-12 (the pinning sweep)

The pin **RAISE** is owed, not waived — following the 188-12 precedent of leaving a suite unpinned while its count is still growing, then pinning once it settles:

| Suite | Pinned today (192-01) | Measured `actual` now | Delta |
|---|---|---|---|
| `RunModal.test.tsx` | 11 | **27** | +16 |
| `RunModal.a11y.test.tsx` | 8 | **16** | +8 |

Both figures were **read from the gate's own printed `actual` column** across the run recorded above — not computed by adding to a number in a comment, which is the documented way that note has gone stale eight times.

⚠ `192-06` will *reduce* both counts if it moves tests to a new `library/RunModal.test.tsx`. A per-file **decrease** is the one thing this gate fails on, so 192-06 and 192-12 must settle the pins together.

## User Setup Required

None — no external service configuration, no dependency, no migration, no env var. This plan adds test code only.

## Next Phase Readiness

- **`192-06` (the D-01 verbatim move) has its stick.** Eight captured strings and six behavioural assertions must hold through the move with **ZERO re-capture**. A red result there is a behaviour change to explain, never a test to update.
- **The one gap is named, not hidden:** F1 above — the modal's own in-flight Escape guard is not isolated by any assertion here.
- **Blocker:** none.

---
*Phase: 192-workflow-library-ia*
*Completed: 2026-08-10*
