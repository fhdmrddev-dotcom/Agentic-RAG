---
phase: 205-stateful-and-incremental-workflows
plan: 01
subsystem: backend/harness + frontend/workflows
tags: [STATE-01, STATE-02, living-register, incremental-updates, prompt-variables, deliverable-resolution, preflight-fixes]
requires:
  - "Phase 200.2 deliverable resolution rules (shipped)"
  - "Phase 204 scheduled & unattended execution (shipped)"
  - "harness_engine.run_workflow (shipped)"
  - "builderStore & PhaseFormPanel (shipped)"
provides:
  - "is_stateful boolean field on WorkflowDefinition (additive, zero migration)"
  - "get_latest_completed_workflow_run db resolver (slug-scoped, owner-scoped, string-scalar safe)"
  - "{{prior_run.output}}, {{prior_run.id}}, {{prior_run.created_at}} prompt variable interpolations"
  - "Living Register delta prompt framing with [NEW], [UPDATED], [RESOLVED] badges"
  - "PromptVariableChips leaf component in phase forms (preserving zero-hook pin in PhaseFormPanel)"
  - "Living Register toggle in builder header bar"
affects:
  - "backend/app/models/harness.py"
  - "backend/app/db/workflows.py"
  - "backend/app/services/harness_engine.py"
  - "backend/app/services/harness/phase_types.py"
  - "docs/HOT-FILE-LEDGER.md"
  - "frontend/src/components/workflows/builderStore.ts"
  - "frontend/src/components/workflows/builderStore.test.ts"
  - "frontend/src/components/workflows/PromptVariableChips.tsx"
  - "frontend/src/components/workflows/PromptVariableChips.test.tsx"
  - "frontend/src/components/workflows/PhaseFormPanel.tsx"
  - "frontend/src/pages/WorkflowBuilderPage.tsx"
  - "frontend/src/pages/WorkflowBuilderPage.header.test.tsx"
  - "backend/tests/unit/test_stateful_workflows.py"
decisions:
  - "G-1: Scope prior run resolution on stable workflow identity (slug) + owner (wr.user_id), surviving republishes"
  - "G-4: Reuse Phase 200.2 shipped deliverable resolution (last completed phase with non-empty text, skipping confirm/questions & empty file steps)"
  - "N-1: Direct wr.user_id query on workflow_runs (populated on 100% of rows), dropping thread join"
  - "N-2: Zero-hook pin in PhaseFormPanel.tsx strictly preserved by isolating PromptVariableChips as a leaf component"
  - "N-3: Safe JSON unwrap for workflow_phases.output string scalars (87% live DB reality), distinguishing genuine cold starts from decode failures"
  - "N-4: STATE-02 satisfied via prompt-framing and markdown badges ([NEW], [UPDATED], [RESOLVED]), deferring structured JSON deltas"
  - "N-5: is_stateful field survives WorkflowDefinition serialization, validation, and publishing"
metrics:
  tasks: 4
  completed: 2026-08-24
---

# Phase 205: Stateful & Incremental Workflows (STATE-01 / STATE-02) Summary

Stateful and incremental workflow capabilities are fully implemented and verified across both backend and frontend layers. Recurring scheduled and manual workflow runs can now read the deliverable output and metadata of previous runs to maintain living registers and produce clear incremental deltas.

---

## What Shipped

### 1. Preflight Directives & Scoping (G-1, G-4, N-1..N-5)
- **Stable Identity Scoping (G-1)**: `get_latest_completed_workflow_run` scopes previous completed runs on `workflow_definitions.slug = $1` and `workflow_runs.user_id = $2 AND ($3::uuid IS NULL OR workflow_runs.org_id = $3)`. Living registers survive republishes and new definition IDs.
- **Phase 200.2 Deliverable Resolution (G-4)**: Iterates `workflow_phases` ordered by `phase_index DESC, created_at DESC`, skipping question/confirmation prompts (`ask_user`, `options`, `confirm`, `question`) and empty file steps, extracting the last server-ordered row with non-empty deliverable text.
- **JSONB String-Scalar Safety (N-3)**: Handles live database string scalars (`isinstance(raw, str)` -> `json.loads`) safely to prevent false cold starts and decode crashes.

### 2. Backend Execution Engine & Prompt Interpolation (STATE-01 / STATE-02)
- Added `is_stateful: bool = False` to `WorkflowDefinition` in `backend/app/models/harness.py`.
- In `backend/app/services/harness_engine.py`, hydrated `ctx.prior_run` when `is_stateful=True` or prior run is resolved.
- In `backend/app/services/harness/phase_types.py`:
  - Added `_interpolate_prior_run_variables` supporting `{{prior_run.output}}`, `{{prior_run.id}}`, and `{{prior_run.created_at}}` (evaluating to `"[Initial Run - No Prior State]"` on cold start).
  - Added `_stateful_framing_block` injecting living register instructions with markdown badges (`[NEW]`, `[UPDATED]`, `[RESOLVED]`) across `_exec_llm_single`, `_exec_llm_agent`, and `_exec_llm_batch_agents`.

### 3. Frontend Authoring Surface & Zero-Hook Pin (N-2)
- **Zero-Hook Pin Preserved**: `frontend/src/components/workflows/PhaseFormPanel.tsx` remains strictly at **0** hooks (`useState`/`useMemo`/`useEffect`).
- **PromptVariableChips Leaf Component**: `frontend/src/components/workflows/PromptVariableChips.tsx` created for one-click insertion of `{{prior_run.output}}`, `{{prior_run.id}}`, and `{{prior_run.created_at}}`.
- **Builder Store & Header Affordance**: Added `setIsStateful` in `frontend/src/components/workflows/builderStore.ts` and interactive "Living Register" toggle in the merged header bar of `frontend/src/pages/WorkflowBuilderPage.tsx`.

---

## Verification & Tests

- **Backend Pytest (`backend/tests/unit/test_stateful_workflows.py`)**: 9/9 tests passed
  - Scoping by slug across multiple definition IDs
  - Owner & org isolation (threat model `T-205-01`)
  - Phase 200.2 deliverable resolution skipping confirm & file steps
  - JSON string-scalar unwrapping
  - Template interpolation (populated & cold start)
  - Stateful framing markdown delta badge injection
  - Model serialization & validation preservation
- **Frontend Vitest Suites**: 249/249 tests passed
  - `PromptVariableChips.test.tsx` (3 tests)
  - `builderStore.test.ts` (69 tests)
  - `PhaseFormPanel.test.tsx` (74 tests — zero-hook pin asserted green)
  - `PhaseFormPanel.rails.test.tsx` (32 tests)
  - `WorkflowBuilderPage.header.test.tsx` (71 tests)
