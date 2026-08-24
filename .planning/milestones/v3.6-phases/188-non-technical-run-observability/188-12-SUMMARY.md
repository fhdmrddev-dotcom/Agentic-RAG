---
phase: 188
plan: 12
subsystem: verification-record
tags: [wave-10, count-gate, pins, phase-gates, non-attribution, g-5-cap, zero-migrations]
requires:
  - "188-01 — the two-knob discipline, the four Wave-0 pins, and the six pre-edit baselines this plan diffs against"
  - "188-05 / 188-08 / 188-09 / 188-10 — each added its suite to TARGETS in the commit that created it, and each deliberately left BASELINE for this plan"
  - "188-07 — the 13/2 WorkflowCanvas.tsx budget this plan measures over the whole phase"
provides:
  - "scripts/vitest-count-gate.cjs — BASELINE pinning EVERY file the gate executes, at its measured actual: 1037 → 2421 across 26 → 45 files, pinned total == total (zero slack)"
  - "The stale-low PhaseReconcile.test.tsx pin closed: 2 → 12, the ten-case gap that held every falsification this phase wrote"
  - ".planning/phases/188-non-technical-run-observability/188-VALIDATION.md — nine phase gates with their literal commands, the filled per-task map, the 211-failure fingerprint by file, and an explicit OWED table"
  - "A name-level backend failure record (70 files → 211) — Plan 01 recorded only totals"
affects:
  - "188-13 and phase verification — every gate they read is now measured rather than asserted"
  - "Every future plan touching frontend tests — the gate has ZERO slack, so a deletion must move its pin in the same commit"
tech-stack:
  added: []
  patterns:
    - "TARGETS and BASELINE are two knobs; the reason to leave a suite unpinned ('its count is free to grow') expires when the suite stops growing, and nothing ever expires it — so the exemption outlives its reason"
    - "Pin values read from the script's printed `actual` column across two agreeing runs, never hand-counted (unsound under it.each)"
    - "A pin is not trusted until it has been observed producing [count-decrease] on a real deletion"
    - "Non-attribution by DIFFING the failure set + proving the diff is strictly additive — never by a rollback run"
    - "Measure a diff cap over the WHOLE PHASE range, so a later plan cannot quietly widen what an earlier one pinned"
    - "Correct a now-false comment in the same commit that falsifies it — a note claiming a shape the code no longer has is the same defect as a false docblock"
key-files:
  created:
    - .planning/phases/188-non-technical-run-observability/188-12-SUMMARY.md
  modified:
    - scripts/vitest-count-gate.cjs
    - .planning/phases/188-non-technical-run-observability/188-VALIDATION.md
decisions:
  - "D-188-12-A: pinned EVERY file the gate executes, not only the suites Phase 188 authored or grew. Fifteen inherited files ran inside TARGETS with no pin at all (canvasModel.roundtrip.test.ts alone at 517 — more cases than the original 424 pin) and five carried stale-low pins. Adopting them into BASELINE imports NO rot, because TARGETS already required them to pass; the only thing that changes is that deleting one becomes visible. Contrast 188-01's blast-radius argument for declining a bare TARGETS directory — that adds files the gate must keep green forever, which is a real cost. A BASELINE entry for a file already in TARGETS is not."
  - "D-188-12-B: BASELINE_TOTAL is now equal to the measured total, i.e. the gate carries ZERO slack. Stated as a consequence in the script header rather than left to be discovered: a legitimate deletion must now move its pin in the SAME commit, which is the rule the script always documented and never actually enforced."
  - "D-188-12-C: four now-false comments in the script were corrected in the same commit. Three said '188-11 pins it' (the pinning plan is 188-12); one said WorkflowBuilderPage.header.test.tsx was deliberately unpinned. Leaving them would make the script's own prose disagree with its data — the class of stale claim the pin exists to catch."
  - "D-188-12-D: the phase base is 93bbfc87 (parent of 42d517b9, the first Phase-188 commit), not the db086240 baseline commit. Both were measured; they give byte-identical numstat and migration results, so the choice does no work — recorded so a reader does not have to wonder."
  - "D-188-12-E: nyquist_compliant set to true, with the caveat written INTO the document. It means every requirement is sampled by a command that has actually run — not that manual UAT is complete. Five Manual-Only rows and the eight-row SC#10 board are named as OWED in their own table."
metrics:
  duration: ~65 min
  completed: 2026-08-05
  tasks: 2
  commits: 2
---

# Phase 188 Plan 12: Pin What This Phase Built, and Prove the Gates Summary

The count gate went from 1037 pinned across 26 files to **2421 across 45** — `pinned total == total`, zero
slack — the stale-low `PhaseReconcile.test.tsx` pin that held every falsification this phase wrote was closed
2 → 12, one pin was watched failing on a real deletion, and nine phase gates were measured and recorded with
their literal commands rather than asserted.

## What Was Built

### Task 1 — every suite the gate runs is now pinned (`37b8cb49`)

`TARGETS` decides what **runs**; `BASELINE` decides what is **pinned**. Phase 188 put four suites into the
first and none into the second, and inherited nine more sitting on pins below their real counts.

**⚠ The one that mattered.** `PhaseReconcile.test.tsx` was pinned at **2** while running **12**. The ten cases
in that gap were 188-02's falsification of the *reachable* fail-open (`finalizeAllPhasesForThread` sweeping
`pending` → `done`) and 188-04's identity-overlay cases — i.e. **every falsification test this phase wrote sat
in gate slack, deletable with the gate green.** That is verbatim the Phase-187 "verification truth 14" failure,
reproduced in the guard rather than in the product, and five separate plans (188-02/04/05/06/07/08) flagged it
as owed before this one closed it.

| Group | Suites | Movement |
|---|---|---|
| **Authored by 188, never pinned** | `WorkflowRunPage.test.tsx` 60 · `WorkspacePanel.test.tsx` 39 · `phaseState.test.ts` 34 · `ChatLayout.launch.test.tsx` 12 | first pin |
| **Grown by 188, pin left behind** | `PhaseNodeCard` 68→105 · `PhaseNode` 13→25 · `WorkflowCanvas` 31→46 · `PhaseReconcile` 2→12 · (`PhaseTimeline` measured, still 8) | raised |
| **Inherited stale-low** | `canvasModel.purity` 69→143 · `phaseVocabulary` 33→96 · `canvasModel` 26→49 · `PublishGauntlet` 24→46 · `PhaseSpineGraph` 14→20 | raised |
| **Inherited, running, pinned by nothing** | `canvasModel.roundtrip` 517 · `WorkflowCanvas.editing` 57 · `builderStore` 52 · `phaseVocabulary.corpus` 45 · `StepTypePicker` 43 · `GovernanceSection` 42 · `StarterTemplatePicker` 40 · `canvasNudge` 31 · `governanceVocabulary` 30 · `PhaseFormPanel.rails` 27 · `WorkflowBuilderPage.header` 27 · `FlowEdge` 22 · `WorkflowCanvas.composition` 19 · `CanvasToolbar` 14 · `BuilderSaveRegion` 11 | first pin |

**Nothing was lowered.** Every movement is an increase or a first pin, so no deliberate deletion needed to ride
along (the LOWERED-vs-EXTENDED distinction in the script's own header).

**Every value came from the script's printed `actual` column across two agreeing runs** (2026-08-05,
`total 2421 · failed 0`, per-file columns identical between runs) — never hand-counted from `it(` literals,
which is unsound under `it.each`.

`WorkflowBuilderPage.session.test.tsx` — the flake the orchestrator named — **is not in `TARGETS`** and
therefore never entered this measurement. Recorded so a reader does not go looking for it in the table.

### The pin observed BITING — raw output

One whole `it(` block (`"lets a pending ask outrank a done status"`) deleted from
`frontend/src/lib/phaseState.test.ts`:

```
  total                                      2421    2420      -1
  total 2420  ·  failed 0  ·  pinned total 2421
--------------------------------------------------------------
RESULT: COUNT GATE VIOLATED (2 reason(s))
  FAIL  [total-below-baseline] total 2420 < pinned 2421.
  FAIL  [count-decrease] phaseState.test.ts — pinned 34, ran 33 (-1). A test was deleted or skipped away.

        D-184-08 pins per-FILE counts because a failures-only
        differential cannot see a DELETED test (the Phase-177 lesson).
```

Gate exit **1** at `failed 0` — the count decrease was the *only* signal, which is the entire point. Restored
with `git checkout -- frontend/src/lib/phaseState.test.ts`; `git status --porcelain` on that path prints
nothing and the gate is green again at **2421 / 2421 / failed 0 / 45-45**.

Note the zero-slack pin fires **two** reasons where 188-01's fired one: `[total-below-baseline]` has become a
live signal instead of a formality, because `BASELINE_TOTAL` now equals the measured total.

### Task 2 — nine gates measured and recorded (`0d09a879`)

A `## Phase gates — measured at plan 188-12` section was added to `188-VALIDATION.md`, each gate with its
literal command and its own printed output.

| # | Gate | Result |
|---|---|---|
| 1 | `node scripts/vitest-count-gate.cjs` | exit 0 · `total 2421 · failed 0 · pinned total 2421` · **45/45** |
| 2 | `cd frontend && npx tsc --noEmit -p tsconfig.app.json` | **33** — exactly the Plan-01 baseline, unmoved |
| 3 | `cd frontend && npx vite build` | exit 0, `✓ built in 6.88s` |
| 4 | `pytest tests/test_188_workflow_run_read.py tests/test_182_canvas_gate.py tests/test_revert_byte_identical.py -q` | **20 passed**, exit 0 (6 + 8 + 6) |
| 5 | `pytest tests/ -q -p no:randomly` | **211 failed · 3304 passed · 19 skipped · 5 xfailed · 9 xpassed · 1 error** in 337.11 s |
| 6 | `git diff --numstat 93bbfc87..HEAD -- …/WorkflowCanvas.tsx` | `13	2` against ≤ 15 / ≤ 4 |
| 7 | `git diff --name-only 93bbfc87..HEAD -- supabase/migrations/` | *(empty)* |
| 8 | `bash scripts/check-deploy-drift.sh` | exit 0 — `RESULT: PASS` |
| 9 | `node scripts/check-gap-closure-rounds.cjs 188` | exit 0 — `13 total · 0 gap-closure`, clear |

**Gate 2 is "still 33", not 0.** `-p tsconfig.app.json` is load-bearing: the root `tsconfig.json` is
`{"files": [], "references": [...]}` and checks **zero** files, so a bare `npx tsc --noEmit` reports 0 errors
while checking nothing. The tail error is still the `StreamsState` / `viewedThreadId: string | null` vs `null`
widening, verbatim as 188-01 recorded it.

**Gate 3 is recorded apart from gate 2 on purpose** — `vite` skips `tsc`, so "the build passed" is never a
typecheck claim in this project.

### Gate 6 — the whole-phase `WorkflowCanvas.tsx` numstat, raw

```
$ git diff --numstat 93bbfc87..HEAD -- frontend/src/components/workflows/WorkflowCanvas.tsx
13	2	frontend/src/components/workflows/WorkflowCanvas.tsx
```

**13 insertions / 2 deletions against ≤ 15 / ≤ 4** — within cap, with 2 insertions and 2 deletions unspent.
Measured over the **whole phase range**, which is the point: 188-07 spent the budget, and a later plan that had
quietly widened the file would show here and nowhere else. It does not. The same range from `db086240` gives
byte-identical output, so the choice of base does no work.

### Gate 5 — non-attribution by DIFFING the failure set

**No rollback run was performed, and one would not have been accepted as evidence** (T-188-01-02 /
T-188-12-02).

| Outcome | Plan-01 baseline | Now | Δ |
|---|---|---|---|
| failed | 211 | **211** | **0** |
| passed | 3296 | **3304** | **+8** |
| skipped / xfailed / xpassed / error | 19 / 5 / 9 / 1 | 19 / 5 / 9 / 1 | 0 |

Five independent checks:

1. **211 unique `FAILED tests/…` node ids** extracted, plus exactly **1** `ERROR tests/…`
   (`test_077_cross_cancel.py::test_cross_worker_cancel_via_zombie_heal`) — matching the baseline's 1 error.
2. **Zero failures or errors in any file this phase created or modified.** Grepping the failure set for
   `test_188_workflow_run_read` / `test_182_canvas_gate` / `test_revert_byte_identical` returns nothing.
3. **The `+8` is fully accounted for with no residue.** Gate 4 measures those same three files at 12 → 20 = +8;
   the whole-suite passed delta is +8. Every test this phase added passes and nothing else changed verdict in
   aggregate. (Arithmetic alone still admits a hypothetical red→green + green→red swap; check 5 closes it.)
4. **The four named pre-existing reds are present by exact node id**, unchanged from the Plan-01 record —
   `test_thread_workflow_endpoint.py::test_thread_workflow_state_shape` (still exactly 1 of 7),
   `test_181_flip_on.py::test_canvas_ping_200_after_flip_on`, and both `test_182_grounding_bundle.py` reds.
5. **The backend diff is strictly ADDITIVE**, so no pre-existing path *can* have changed behaviour: one net-new
   module (`workflow_runs.py` 247/0), a router mounted at a **new prefix** (`main.py` 2/1), and one new
   **template** member of `CANVAS_GATED_PATHS` for a path that did not previously exist (`canvas_gate.py` 20/2,
   the rest comments). `canvas_gate.py` appears in failing tracebacks only at line 194 (`__call__`) — an
   unchanged ASGI pass-through frame present for every request in every suite. A stack frame, not a cause.

**A name-level record now exists.** Plan 01 recorded only the totals, which is *why* this diff had to lean on
check 5. The 211 failures are now fingerprinted by file (70 files → 211) in `188-VALIDATION.md`; the next phase
diffs against a set, not a number.

### The "~62-red" question, settled by measurement

The seventeen `tests/unit/…` rows in that fingerprint sum to **exactly 62**
(1+1+1+4+3+6+2+1+1+3+2+5+1+15+3+12+1 = 62).

The Phase-187-round-5 figure was `pytest tests/unit -q`; the 211 figure is the whole `tests/` tree. They are not
merely *consistent* — they are the **same failures counted over two different scopes**. The word **REFUTED** is
wrong and is not used anywhere in this plan's output. This is now a measurement, not an argument.

## Measured Results

| Criterion | Result |
|---|---|
| Gate exits 0 twice with identical per-file `actual` values | ✅ two agreeing runs, 2026-08-05 |
| `grep -c '"phaseState.test.ts"'` = 1 · `"WorkflowRunPage.test.tsx"` = 1 · `"ChatLayout.launch.test.tsx"` = 1 | ✅ 1 / 1 / 1 (also `"WorkspacePanel.test.tsx"` 1) |
| `"WorkflowCanvas.test.tsx"` pin equals its printed `actual` — no slack | ✅ 46 / 46, delta 0 |
| Printed `N/N pinned files present` equals the number of `BASELINE` entries | ✅ `45/45` (derived from `pinnedNames.length`) |
| `[count-decrease]` naming `phaseState.test.ts` observed, then path clean | ✅ raw output above; `git status --porcelain` empty |
| Nine gates recorded with literal commands | ✅ § Phase gates 1–9 |
| Backend line shows an explicit failure-set DIFF, not just a total | ✅ five checks + the 70-file fingerprint |
| `WorkflowCanvas.tsx` whole-phase numstat within ≤ 15 / ≤ 4 | ✅ `13	2` |
| Migrations line shows the command and its empty output | ✅ zero migrations |
| Every per-task map row has a non-TBD `Plan` and a ✅ or ⬜-with-UAT-pointer | ✅ 18 rows ✅, 1 row ⬜ → `188-UAT.md` / 188-13 |
| `nyquist_compliant` set from measurement | ✅ `true`, with the caveat written into the document |
| No file deleted by either commit | ✅ `git diff --diff-filter=D` empty on both |

## Deviations from Plan

### 1. [Scope extension, orchestrator-directed] Pinned every file the gate runs, not only Phase 188's own

- **Found during:** Task 1, reading the gate's two agreeing runs.
- **Plan text:** "every suite this phase authored or grew". **Orchestrator brief:** "…and any others the gate
  prints as unpinned."
- **What was found:** fifteen files ran inside `TARGETS` with **no pin at all**, and five more carried pins
  below their real counts. `canvasModel.roundtrip.test.ts` alone runs **517** cases — more than the entire
  original 424-test pin — guarded by nothing.
- **What was done:** all twenty pinned/raised at their measured `actual` (D-188-12-A). This imports no rot:
  every one was already inside `TARGETS`, so the gate already required it to pass. Only deletion becomes
  visible.
- **Files modified:** `scripts/vitest-count-gate.cjs`. **Commit:** `37b8cb49`.

### 2. [Rule 2 — missing critical correctness] Four now-false comments in the script corrected

- **Found during:** Task 1.
- **Issue:** three `TARGETS` comments said "188-11 pins it from this script's printed `actual`" (the pinning
  plan is **188-12**; 188-11 authored the SC#10 board and pinned nothing), and
  `WorkflowBuilderPage.header.test.tsx`'s comment said it was *deliberately* left unpinned — which this commit
  falsifies.
- **Fix:** all four rewritten to state what is now true, with the correction named (D-188-12-C). A comment that
  claims a shape the code no longer has is the same class of defect the pin itself exists to catch — the
  script's own header makes that argument about the `16/16` literal it once printed.
- **Commit:** `37b8cb49`.

### 3. [Recorded, not fixed] A phase-attributable bundle-split regression found by gate 3

```
[INEFFECTIVE_DYNAMIC_IMPORT] Warning: src/components/workflows/WorkflowCanvas.tsx is dynamically
imported by src/pages/WorkflowBuilderPage.tsx but also statically imported by
src/pages/WorkflowRunPage.tsx, dynamic import will not move module into another chunk.
```

`WorkflowRunPage.tsx` (188-08) imports `WorkflowCanvas` **statically**, defeating the lazy split
`WorkflowBuilderPage` had — the canvas now ships in the main chunk for every user, including those who never
open a workflow. Not a correctness defect, not a gate failure, and out of this plan's mandate (the fix is a
`lazy()` at the run page, a render-path change). Recorded in `188-VALIDATION.md` with a **re-open trigger**:
the next plan touching `WorkflowRunPage.tsx`'s imports, or any bundle-size work.

### 4. [Delegated judgement, recorded] Phase base = `93bbfc87`, cross-checked against `db086240`

The plan wrote `<phase-base-commit>` without naming one. `93bbfc87` is the parent of `42d517b9`, the first
Phase-188 commit, and is therefore the strictest choice. Both bases were measured and give **byte-identical**
numstat and migration output, so the choice does no work in these figures (D-188-12-D).

## Still OWED — recorded as debt, not as done

| Owed | Where | Who closes it |
|---|---|---|
| The 8-row **SC#10** cross-provider board — script and board authored (188-11), rows **not driven** | `188-UAT.md` · `scripts/sc10_188_run_board.py` | plan **188-13** |
| Five **Manual-Only** verifications: colour-off legibility, the G-4 lived-experience run watch, the `🕐 Tomorrow` moment, `.docx` download-only, SC#10 | `188-VALIDATION.md` § Manual-Only | operator UAT |
| **`PlaneEditingLayer` / `EDIT_AFFORDANCE` extraction from `WorkflowCanvas.tsx`** | 185-10, deferred by 188-07 | next **feature** touch of that file |
| The `WorkflowCanvas` bundle-split regression (deviation 3) | `WorkflowRunPage.tsx` | next import / bundle-size touch |
| The run band does not re-read after mount (188-10's note) | `WorkflowRunPage.tsx` | a later plan, if the band should follow the stream's terminal event |

**On the extraction specifically:** 188-07 deferred it *deliberately* — `PlaneEditingLayer` serves **editing**,
which run-visualisation never touches, and lifting it risks the live ESM cycle (`WorkflowCanvas` imports
`FlowEdge`'s **value** at module scope for the `edgeTypes` map, so the extracted module must not import back).
**Deferring is a decision, not a closure.** It is due at the next `WorkflowCanvas.tsx` feature touch, and the
2 insertions / 2 deletions still unspent under the cap are not an invitation to spend them instead.

## Known Stubs

None. This plan writes no production code — it modifies one committed tooling script and one planning document.

## Threat Flags

None. No network endpoint, no auth path, no file-access pattern and no schema change. `scripts/check-deploy-drift.sh`
was **run** (exit 0, PASS) rather than assumed, per T-188-SC.

## Notes for the Next Plan

- **The gate has ZERO slack.** `BASELINE_TOTAL == total == 2421`. Any deletion or skip anywhere in the 45-file
  blast radius now reds the gate with **two** reasons. A legitimate deletion must move its pin in the **same
  commit**, read from the script's own printed `actual` — never hand-counted.
- **A pin may be LOWERED only alongside a deliberate, plan-authorised deletion**, never to quiet a red gate.
  Raising or adding a pin needs no deletion.
- **188-13 drives the SC#10 board.** Re-run the key probe at gate time — all eight providers had keys on
  2026-08-05, and a key that disappears turns a ⛔ into a false PASS. A `failed` terminal status is ⛔, not a
  pass. No `skip_to_phase` fixture exists yet (measured: 0 rows).
- **G-7 stands at 0 rounds of 2.** Recorded from the repository at gate 9, so the number at any future
  `gaps_found` is derived rather than eyeballed under pressure.
- **`188-VALIDATION.md` now carries a name-level failure fingerprint.** Diff against the 70-file table, not
  against the number 211 — a swap between two files is invisible to a total and visible to the table.

## Commits

| Task | Commit | Files |
|---|---|---|
| 1 | `37b8cb49` | `scripts/vitest-count-gate.cjs` (+141 / −23) |
| 2 | `0d09a879` | `.planning/phases/188-non-technical-run-observability/188-VALIDATION.md` (+373 / −30) |

## Scope Note

The working tree carries a large pre-existing dirty set (`.claude/agents/*`, `.claude/commands/gsd/*`) plus
orchestrator-owned `.planning/STATE.md`, from a GSD tooling update unrelated to this phase, and untracked
scratch under `scripts/_uat111*`, `backend/scripts/*.json` and similar. **Both commits staged only their own
explicitly-named path.** Nothing pre-existing was staged, reverted, deleted or stashed; `git add -A` / `git add .`
were never used, and `STATE.md`, `ROADMAP.md` and `REQUIREMENTS.md` were not touched — the orchestrator owns
those, and `requirements.mark-complete` / `state.advance-plan` / `roadmap.update-plan-progress` were not called.

## Self-Check: PASSED

Files verified present on disk:

- `FOUND: scripts/vitest-count-gate.cjs`
- `FOUND: .planning/phases/188-non-technical-run-observability/188-VALIDATION.md`
- `FOUND: .planning/phases/188-non-technical-run-observability/188-12-SUMMARY.md`

Commits verified in `git log`:

- `FOUND: 37b8cb49` — test(188-12): pin every suite the gate runs, at its measured actual
- `FOUND: 0d09a879` — docs(188-12): nine phase gates measured, and the per-task map filled from measurement

`git diff --diff-filter=D --name-only` is empty across both commits — this plan deleted no file. The one
deliberate deletion (an `it(` block, to watch the pin bite) was restored before either commit;
`git status --porcelain frontend/src/lib/phaseState.test.ts` prints nothing.
