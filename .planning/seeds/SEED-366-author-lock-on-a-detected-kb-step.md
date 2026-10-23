---
seed_id: SEED-366
title: Authors cannot lock a knowledge-base step against "continue without sources"
created: 2026-10-20
surface: Agentic-RAG
status: planted
partial: false
status_note:
trigger_when: "An author or operator asks to forbid 'continue without sources' on a KB step. Or a phase changes the grounding dial on detected steps (GovernanceSection.tsx). Or the 295 G-4 sign-off finds the '⛨ Must prove it' label misleading beside the continue choice."
trigger_paths: ["frontend/src/components/workflows/GovernanceSection.tsx", "backend/app/services/harness/grounding.py", "frontend/src/components/workflows/definitionOps.ts"]
trigger_surfaces: []
migration_note:
relates_to: [".planning/phases/295-runs-that-don-t-dead-end/295-CONTEXT.md (D-36)", ".planning/phases/295-runs-that-don-t-dead-end/295-RESEARCH.md (R1)", "sketch 142 (one-way grounding dial)", "SEED-137"]
folded_into: null
renumbered_from: null
renumbered_because: null
---

# SEED-366: authors cannot lock a knowledge-base step against "continue without sources"

## What is true after Phase 295

When a KB step finds nothing, the run pauses. It offers to search another folder, to continue without sources (the output is marked unsourced), or to stop. A **locked** step does not offer continue (RUN-01).

295 D-36 defines "locked" as the stored `grounding_escalated` bit. `grounding_cause()` reads `detected` on every KB step, so it cannot carry the lock (295 RESEARCH R1).

## The gap

The UI cannot set that bit on a detected step. Sketch 142, which the operator approved, says a detected step has **no switch** (`GovernanceSection.tsx` header). An author can lock a KB step only by escalating it *before* adding a KB tool. So in practice every KB step offers continue.

Every KB step's canvas also reads "⛨ Must prove it / Because this step reads your documents" (`definitionOps.ts:492, 515`). Beside a "continue without sources" choice, that label may read as untrue, even though the output is then marked unsourced in three places.

## Decision taken (operator, 2026-10-20: "proceed with what you recommend")

The switch is not added in 295, because it would reverse sketch 142 and add canvas scope. This seed holds it for later.

## Options when it fires

- A "Never continue without sources" switch on detected steps, in the existing dial vocabulary ("you can only undo a lock you created"). It writes `grounding_escalated`.
- Or a workflow-level strict setting.
- Re-word the detected label in either case, so it never promises more than the run does.
