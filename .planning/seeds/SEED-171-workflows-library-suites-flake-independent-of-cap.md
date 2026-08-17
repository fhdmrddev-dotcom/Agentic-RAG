---
seed_id: SEED-171
title: THREE suites flake non-deterministically, independent of GSD_VITEST_MAX_WORKERS and of machine load, and not every failure is a timeout — the count gate cannot reach 0 failing on demand
created: 2026-08-17
planted_during: Phase 195 Wave 1 post-merge gate (orchestrator)
status: planted
priority: high
relates_to:
  - SEED-056 (vitest unit baseline cluster triage) — ⚠ **THIS IS THE SAME FAMILY, BUT THE DIAGNOSIS
    HERE IS DIFFERENT AND STRONGER.** 056 triaged a rot SET. This seed records that THREE named suites
    fail NON-DETERMINISTICALLY, which no per-file baseline can absorb, because the failing set is
    never the same twice.
  - CLAUDE.md § "Parallel execution" rule 2 — the `GSD_VITEST_MAX_WORKERS` rule. ⚠ **Its stated
    causal model is REFUTED by the measurements below.** The rule says oversubscription causes the
    `STACK_TRACE_ERROR` timeouts and that capping fixes it. Capping does NOT fix it.
  - Phase 195 plan 195-02 — measured 8 gate runs and concluded cap 1 was clean. That conclusion was
    LUCK, not a fix; two cap-1 runs at wave close were red.
  - Phase 195 plan 195-08 — owns the CLAUDE.md numbers, and inherits the correction this seed records.
trigger_when: >
  Any phase needs `count gate OK` as a pass condition, OR anyone proposes to raise/lower
  `GSD_VITEST_MAX_WORKERS` as a remedy for red gate runs, OR `WorkflowsPage.test.tsx` /
  `WorkflowCard.test.tsx` / `WorkflowBuilderPage.session.test.tsx` are edited for any reason.
---

# The flake is in the suites, not in the cap

## What was measured (2026-08-17, Phase 195 Wave 1 close)

The tree at this point had **no production source change at all** — the entire phase to date had
touched six files: three `.planning/` documents, two test files (neither of them the failing ones),
and `scripts/vitest-count-gate.cjs`. `WorkflowsPage.tsx`, `WorkflowsPage.test.tsx`,
`WorkflowCard.tsx` and `WorkflowCard.test.tsx` were all **byte-identical to the phase's base commit
`f2eef045`**, at which 195-01 had measured `count gate OK … 0 failing`.

| Run | Cap | Scope | failed | The failing set |
|---|---|---|---|---|
| Post-merge | **1** | full gate | **4** | `WorkflowsPage.test.tsx` — D-17 ×2, D-04 ×2 |
| Retry | **2** | full gate | **4** | `WorkflowsPage.test.tsx` — **LIB-01 + D-17 (a DIFFERENT pair)** · `WorkflowCard.test.tsx` ×2 |
| Isolated | **1** | `WorkflowsPage.test.tsx` alone | **2** | 53 passed / 55 — **flakes with nothing else running** |

Plus 195-02's own eight runs earlier the same day: cap 2 gave `0, 0, 3, 2, 8`; cap 1 gave `0, 0`.

**Every single failure across all eleven runs was `STACK_TRACE_ERROR`.**

## The four conclusions, and why each is load-bearing

1. **The cap is not the variable.** Cap 1 and cap 2 both produce clean runs and red runs on the same
   tree. CLAUDE.md's rule attributes these timeouts to worker oversubscription and prescribes a lower
   cap; the prescription does not work. ⚠ The rule is not *wrong to exist* — a cap still matters for
   two concurrent agents — but **"lower the cap" is not a remedy for a red gate**, and a plan that
   lowers the cap and gets green has learned nothing.
2. **Machine load is not the variable either.** The isolated run had one suite and nothing else on the
   box, and still failed 2 of 55.
3. **The failing SET is never the same twice.** This is what makes it unabsorbable by the gate's
   design: the gate pins per-file COUNTS (D-184-08) and requires **0 failing**. A per-file baseline
   can absorb a stable count; it cannot absorb a suite that fails a different two-to-eight cases each
   run. **There is no number to pin.**
4. **The grand total is invariant at 4044 across every run, and every per-file delta is ≥ 0.** The
   gate's *first* clause — no per-file decrease — has held in all eleven runs. Only the
   *zero-failing* clause trips.

## ⚠ AMENDMENT 2026-08-17 (Phase 195-03) — a THIRD file, and it is NOT a timeout

The two suites named above are not the whole set, and the failure mode is broader than
`STACK_TRACE_ERROR`. Phase 195-03's run 4 of 5 was red at **`failed 9`**, filenames captured from the
gate's persisted JSON **before** any re-run:

| File | Count | Error kind |
|---|---|---|
| `WorkflowsPage.test.tsx` | 6 | `STACK_TRACE_ERROR` |
| `WorkflowCard.test.tsx` | 2 | `STACK_TRACE_ERROR` |
| **`WorkflowBuilderPage.session.test.tsx`** | **1** | ⚠ **`AssertionError` — NOT a timeout** |

⚠ **The `AssertionError` matters more than the count.** Every failure recorded in the original
eleven runs was `STACK_TRACE_ERROR`, which made "slow suite near a timeout boundary" a clean
hypothesis. A genuine assertion failure on a byte-identical tree does not fit that shape, so **the
hypothesis in the next section is now known to be incomplete** rather than merely unproven.

**It also produced a false causal signal, which is the part worth not repeating.** Restoring the base
`fileIcon.tsx` made the case pass — which *looked* like causation. It was not: four consecutive
isolated runs with the modified file were **23/23 each**, so 7 of 8 samples were green and the file was
byte-identical to base in the merged result. ⚠ **A single "revert made it pass" observation is not
evidence against a flaky suite** — the sample size has to beat the flake rate before the direction of
causation means anything.

⚠ Note the count-gate script **already documents this exact file** at `:2401-2411` as a measured
parallel-load flake, with a standing instruction to re-run before declaring red. That instruction
covers the `pane click` case; whether this is the same case is **not yet checked**.

---

## The shape of the defect, on the evidence available

`WorkflowsPage.test.tsx` takes **92.67 s for one file** (83.64 s of it test time) at cap 1 in
isolation. The failures are `STACK_TRACE_ERROR`, which is what vitest emits when it cannot serialise
an error — commonly accompanying a timeout. A suite this slow sitting near a per-test timeout boundary
would fail a *randomly varying* subset on each run, which is exactly the observed signature.

⚠ **This is a HYPOTHESIS consistent with the measurements, not a diagnosis.** Nothing here has
identified the actual slow operation, and no timeout value has been read or changed. Do not record it
as the cause without doing that work.

## Why this matters beyond one red run

**A gate that cannot be made green on demand stops functioning as a gate.** The failure mode is not
that it blocks work — it is that everyone learns the red is "just the flake", and a *real* regression
in a *different* suite then arrives wearing the same clothes. The eleven runs above are the only thing
currently separating the two, and that separation cost roughly forty minutes of wall-clock to
establish for a single wave.

## What a fix would have to do

- Identify the actual slow operation in `WorkflowsPage.test.tsx` (92 s for 55 cases is ~1.7 s/case —
  find what is being awaited).
- Decide deliberately between: making the suite fast, raising its timeout with a recorded reason, or
  **removing it from the gate with its reason written down** — the last being legitimate, and far
  better than a permanently-red gate nobody reads.
- ⚠ Whatever is chosen, **correct CLAUDE.md's causal claim in the same commit**, because the current
  text sends the next reader to adjust the cap, which is measured not to work.

## Interim contract (what Phase 195 actually did)

Wave 1 was marked complete with the red gate **stated, not hidden**, on this evidence: no production
source changed; no per-file count decreased; all five Phase-195 suites green
(`OutputFileCard.baseline` 21/21, `WorkflowRunPage` 105/105, `fileIcon` 11/11, `FilesSection` 11/11,
`MessageItem.finalOutputs` 11/11); and the failing set traced to two suites the phase never touched.

**Later plans in Phase 195 verify on per-file counts plus their own suites, NOT on a green grand
verdict.** Any plan that reports `count gate OK` should say which run number it was, and any plan that
reports red must name the failing files before re-running.
