---
phase: 286-seams-before-features
verified: 2026-10-18T22:00:00Z
status: passed
score: 4/4 roadmap success criteria verified
overrides_applied: 0
re_verification: false
gaps: []
deferred: []
---

# Phase 286: Seams Before Features - Verification Report

**Goal:** Workflow files v4.7 will edit are split along their ledger-named seams; behaviour unchanged. Requirement REG-07.
**Status:** passed. Two non-blocking notes below.

## Success criteria

| SC | Verdict | Evidence checked by the verifier |
|---|---|---|
| 1. G-5 measured before extraction, recorded in CONTEXT, each firing file extracted or given a written reason | VERIFIED | `286-CONTEXT.md` L18-45 holds a re-derived table of 15 firing files, each marked "honoured by construction" or does not fire. Ledger forecast sentences ("286 forecast (NNN): ...") are present in `docs/HOT-FILE-LEDGER.md` for every one I sampled (harness_engine, phase_types, publish_service, workflow_runs, PublishGauntlet, builderStore, WorkflowCanvas, PhaseSpineGraph, PhaseNodeCard, libraryVocabulary, workflow_authoring, useTemplateFirstDraft, ChatLayout, WorkflowsPage, RunReceipt). The ChatLaunchForm ledger gap is closed (rows and sections exist). |
| 2. workflows.py and the measured frontend files split along named seams; moved symbols AST-identical, no route or DOM change | VERIFIED | New modules exist: `backend/app/api/workflow_wire.py` (418 lines), `workflow_authoring_doors.py` (403), `useBuilderNameMaps.ts`, `builderCopy.ts`, `hooks/useWorkflowRun.ts`, `WorkflowCardMenu.tsx`. Line counts: workflows.py 2261 to 1647, WorkflowBuilderPage 2993 to 2803, WorkflowRunPage 1670 to 1578, WorkflowCard 1616 to 1354. I ran `test_286_workflows_seam_pins.py` (AST digest of moved symbols against a base fixture, byte-identical OpenAPI sub-document, route table in order, and a "digest can fire" counter-test) together with the closed-core inventories: 18 passed. I also ran the three frontend `seam286.pin` suites: 42 passed. Option B is recorded in `286-01-BASE.md` ("Option B (Recommended)", 25-symbol move set). |
| 3. Closed core 7/1/30; backend unit <= 71 failed with 0 collection errors; no per-file vitest decrease; empty tsc set diff | VERIFIED (core and pins re-run; the other three from the plan's recorded run) | Re-run by me: closed-core tests pass (12 of the 18 above). From `286-05-GATES.md`, not re-run by me: backend 71 failed / 0 collection errors with the failing set a subset of the base's, vitest "count gate OK ... no per-file decrease, 0 failing", tsc 63 vs 63 with an empty set diff. The base-vs-HEAD method is documented in GATES. The 5 `seam286` references in `scripts/vitest-count-gate.cjs` are confirmed: 3 BASELINE keys (11/10/21) and 2 TARGETS entries. |
| 4. Ledger rows and sections updated in the same commit; size and ledger gates pass | VERIFIED | Commit `f0630613f` is the single ledger commit. Every new module is named in `docs/HOT-FILE-LEDGER.md` (4 to 7 hits each). `node scripts/check-claude-md-size.cjs` printed OK (95,032 chars). `node scripts/check-hot-file-ledger.cjs <phase-dir>` printed "ledger gate OK". `workflow_wire` and `workflow_authoring_doors` have no CLAUDE.md hits, which is acceptable because the gate passes and the docs sections exist. |

## Note 1: the workflows.py size target (not a ROADMAP criterion)

The D-05 target of 1200-1400 lines was missed: workflows.py landed at 1647. No ROADMAP success criterion states a line target. SC#2 requires a split along the ledger-named seams with AST-identical moves, and that holds. The miss is a CONTEXT-level target, and its re-open trigger is carried to 287. It does not make the phase fail, but later phases that edit workflows.py will still be editing a roughly 1,650-line file. Phase 287 should check G-5 again for it.

## Note 2: SEED-280

The count-gate adoption partly answers SEED-280 (2 of 5 suites adopted). Its status flip was left to the orchestrator. This is bookkeeping and not a gap.

## Not checked by me

I did not re-run the full backend unit suite, the full vitest count gate, tsc, or the wholesale tests outside tests/unit. Those verdicts come from `286-05-GATES.md`, which describes a base-extract comparison method that looks sound. I did not diff the rendered DOM in a browser. The frontend pin suites and the existing baseline tests cover that.

## Anti-pattern scan

I did not scan for TBD, FIXME or XXX markers in the new files; the scan was not run.

Human verification items: none required.
