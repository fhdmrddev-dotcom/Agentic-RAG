---
phase: 286-seams-before-features
plan: 05
subsystem: gates / hot-file ledger
tags: [gates, ledger, g5, closeout]
requires: ["286-01", "286-02", "286-03", "286-04"]
provides:
  - "286-05-GATES.md: every wave gate with its command, verdict and base-vs-after set diff"
  - "Count-gate adoption of the three seam286 pins (both knobs) plus two SEED-280 suites"
  - "Ledger rows + sections for the 4 extracted files, 6 new modules, ChatLaunchForm.tsx and 15 SC#1 forecasts"
affects:
  - "Phases 287-293 plan from these rows (workflows.py re-open trigger FIRED for 287)"
tech-stack:
  added: []
  patterns:
    - "Inherited-vs-new proved by running the BASE (git-archive extract), never by a quoted number"
key-files:
  created:
    - .planning/phases/286-seams-before-features/286-05-GATES.md
  modified:
    - scripts/vitest-count-gate.cjs
    - CLAUDE.md
    - docs/HOT-FILE-LEDGER.md
decisions:
  - "librarySubtree.fences pin raised 118 -> 133: +5 is 286-04's, +10 measured at base (predates the phase); folded because raising a pin only tightens it, split stated in the comment"
  - "toolReadOnlyMap (7) and automationFacts (11) adopted: the two SEED-222/SEED-280 suites that guard a file in 286's diff; the other three stay unpinned"
  - "PublishedCardDelete (42) and WorkflowBuilderPage.canvas (154) NOT re-pinned: both read the same at base, so their drift is not this phase's"
  - "Forecast sections live in a dated '## Phase 286 close' block at the end of the ledger (the 284/285 house pattern); ChatLaunchForm's note went into its EXISTING section as the plan asked"
  - "graphify update not run: the orchestrator's directive said it is not required of this executor"
metrics:
  duration: "~45 min"
  completed: 2026-10-18
  tasks: 2
  files: 4
requirements: [REG-07]
---

# Phase 286 Plan 05: closing gates and ledger Summary

The whole phase passes its gates against its own base (`d45bef9e2`), the three characterization pins
are now inside the count gate where deleting a case reds it, and the ledger tells phases 287-293 what
286 cut, what is still owed, and what each remaining firing file is expected to absorb.

## Gate table (full detail and commands in `286-05-GATES.md`)

| Gate | Result | Against base |
|---|---|---|
| vitest count gate (`GSD_VITEST_MAX_WORKERS=2`) | `count gate OK — 455/455 pinned files present, no per-file decrease, 0 failing` · total 10571 | n/a (per-file, no decrease) |
| `tsc -p tsconfig.app.json --noEmit` | 63 errors | 63 at base, **set diff empty** |
| `check-react-hooks-rules.cjs` | OK, no new violation | 2 inherited (`ToolCallPanel.tsx`) |
| backend `pytest tests/unit` | **71 failed**, 7757 passed, 0 collection errors | **HEAD set ⊆ base set** (`comm -23` empty) |
| wholesale outside `tests/unit` (6 files) | 21 failed / 69 passed | **identical** to base (all 21 in `test_dual_mode_wiring.py`) |
| closed core (`test_259` + `test_261`) | 12 passed; live registries print `7 1 30` | unchanged |
| `check-extension-contract.cjs` | OK, 17 files, 0 violations | — |
| `check-claude-md-size.cjs` | OK, CLAUDE.md 95,032 chars (63.4%) | — |
| `check-hot-file-ledger.cjs 286` | `ledger gate OK — every watched file has a row` (was 6 `[no-row]`) | — |

### Reds, each with its inherited proof

- **Backend, 71 failures.** Each HEAD id was re-run on the base extract by itself: 69 failed and 2
  passed. The 2 are `test_cross_worker_cancellation.py` cases. They are order-dependent: the file passes
  alone at both HEAD and base (28/28), and both cases fail in the full base run. The full base run's
  failing set contains every HEAD id. None of the 71 is in a file Phase 286 touched.
- **Wholesale, 21 failures.** All in `tests/test_dual_mode_wiring.py`, and the failing sets at base and
  HEAD are identical.
- **Count gate.** No reds.

⚠ The base was an archive extract, not a checkout. Suites that read git history or
`.planning/milestones/` red there (35 failures and 6 setup errors). That only enlarges the base set, and
it cannot hide a new HEAD failure, because every HEAD id was also re-run at base on its own.

## Count-gate adoption (Task 1, `d06bbfbdf`)

- TARGETS: `src/pages/__tests__/WorkflowBuilderPage.seam286.pin.test.tsx` and
  `src/pages/__tests__/WorkflowRunPage.seam286.pin.test.tsx`, both named files.
- BASELINE, from the gate's printed actuals: Builder pin **11**, RunPage pin **10**, Card pin **21** (the
  Card pin runs under the `src/components/workflows` directory entry, confirmed from the first run).
- `librarySubtree.fences.test.ts` 118 → **133**. Measured at base: 128.
- Adopted `toolReadOnlyMap.test.ts` **7** and `automationFacts.test.ts` **11**. Both read the same at base.
- `grep -c "seam286.pin" scripts/vitest-count-gate.cjs` reads 6.

## Ledger rows changed (Task 2, `f0630613f`, CLAUDE.md + docs/HOT-FILE-LEDGER.md in ONE commit)

**Four extracted files.** Each has a FIRING row, a scan-list row and a `Phase 286 (286-0N) — seam taken`
section that records what moved, the line counts, the pin with its empty-numstat proof (re-run on the
merged tree), the tests edited and why, and what is still owed.

| File | Triple (was) | Verdict |
|---|---|---|
| `backend/app/api/workflows.py` | 45 / 23 / 1647 (`43 / 23 / 2261`) | seam TAKEN (286-01). ⚠ **D-05's 1,200-1,400 target MISSED.** **CONTEXT's > 1,500-line re-open trigger FIRED**, because 287 edits it. The patched-handler split is OWED |
| `frontend/src/pages/WorkflowBuilderPage.tsx` | 58 / 23 / 2803 (`57 / 22 / 2993`) | seam TAKEN (286-02) |
| `frontend/src/pages/WorkflowRunPage.tsx` | 30 / 11 / 1578 (`28 / 9 / 1670`) | seam TAKEN (286-03). OWED: phase/spec join, canvas mount. The elapsed anchor stays because two fences pin it |
| `frontend/src/components/workflows/library/WorkflowCard.tsx` | 22 / 8 / 1354 (`19 / 6 / 1616`) | seam TAKEN (286-04). The card holds 0 `useState` |

**Six new modules.** Each has a young scan-list row and a section with its inherited invariants. None has
a CLAUDE.md row, because none fires.
- `workflow_wire.py` 1/1/418
- `workflow_authoring_doors.py` 1/1/403
- `useBuilderNameMaps.ts` 1/1/141
- `builderCopy.ts` 1/1/174
- `hooks/useWorkflowRun.ts` 1/1/218
- `library/WorkflowCardMenu.tsx` 1/1/473

**`ChatLaunchForm.tsx`.**
- A CLAUDE.md row was added (D-15).
- The EXISTING scan-list row was updated in place, so it still has exactly one row.
- A dated 286 note was appended to its EXISTING section, carrying the `components/layout/` path correction.

**15 forecasts.** `grep -c "Phase 286 forecast (SC#1)" docs/HOT-FILE-LEDGER.md` reads 15. Fourteen of the
files had their CLAUDE.md cell (≤ 80 chars) and scan-list cell (≤ 200) rewritten. RunReceipt has a
scan-list cell and a section only. Every replaced cell is quoted verbatim in its section.

The triples were re-derived with the recipe. The ones that moved:
- `phase_types` 56/28/3027
- `workflow_runs` 13/10/1108
- `PhaseSpineGraph` 8/6/723
- `PhaseNodeCard` 18/9/490
- `libraryVocabulary` 11/5/766
- `useTemplateFirstDraft` 8/4/684

## Seeds re-run observation

`check-seeds-register.cjs --phase 286`: 13 seeds matched by path, mostly through broad globs. The gate is
OK at 366/366. `git diff --stat d45bef9e2 HEAD -- .planning/seeds/` is empty.

⚠ **SEED-280 is genuinely affected.** Its trigger is "the next phase that edits vitest-count-gate.cjs".
This plan adopted 2 of its 5 suites, so the seed is now partially answered. Its file was left unchanged,
as the plan requires, and the status flip is owed to the orchestrator or verifier.

## Deviations from Plan

1. **[Rule 3 - Blocking] There was no base backend failing set to compare against.** The plan says to diff
   against 286-01-BASE.md's set, but 286-01 deferred the full and wholesale runs to this plan, so
   BASE.md has no such set. I measured the base instead: the full run on a `git archive d45bef9e2`
   extract, plus each HEAD id re-run there by itself. This is recorded in GATES.md.
2. **[Rule 2 - Coverage] Two unpinned suites were adopted** (`toolReadOnlyMap`, `automationFacts`).
   The plan named `toolReadOnlyMap` as wave-1-touched. `automationFacts` reads the card source that
   286-04 cut. Both guard 286's diff, which is the re-open condition every earlier decline named.
3. **Process incident, no lasting effect.** My first isolation attempt passed a relative ids-file path to a
   helper that `cd`s first. `mapfile` failed, and pytest ran the WHOLE `tests/` tree three times. I
   killed all three process trees (PIDs 2784, 26736, 26952, only my own) and deleted two stray output
   files in `backend/`. The runs were cut short while the DB lock was held. The later wholesale and
   isolation runs were clean, and their results match base.
4. **`graphify update .` was not run.** The orchestrator's directive said it is not required of this
   executor.

## Known Stubs

None.

## Self-Check: PASSED

- FOUND: `.planning/phases/286-seams-before-features/286-05-GATES.md`
- FOUND commits: `d06bbfbdf` (Task 1), `f0630613f` (Task 2: CLAUDE.md + docs only)
- No STATE.md or ROADMAP.md modification. No seed file modified.
