# Phase 205: Stateful & Incremental Workflows - Context

**Gathered:** 2026-08-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 205 delivers stateful and incremental execution memory for workflows (STATE-01, STATE-02). It enables a workflow run to query and read the deliverable output of its own most recent completed execution (owner- and definition-scoped), allowing recurring unattended and manual runs to maintain living registers (e.g., risk logs, compliance trackers, weekly diff digests) and render explicit state deltas (added, updated, resolved/closed items) without starting from zero on every run.

</domain>

<decisions>
## Implementation Decisions

### Prior Run Resolution & Cold-Start Baseline
- **D-01 (Resolution Query):** The previous run baseline is resolved strictly as the most recent `status = 'completed'` run for the exact same published `definition_id` and tenant (`user_id` / `org_id`). Runs with `status` in (`'failed'`, `'cancelled'`, `'active'`) are ignored so that interrupted or broken runs do not corrupt state.
- **D-02 (Cold-Start Initial Baseline):** On the first execution of a stateful workflow (or when no prior completed run exists in the database), `prior_run` resolves to `None` / empty dict. The workflow executes in initialization mode, treating all detected items as baseline / initial entries.

### State Injection & Execution Context
- **D-03 (Template Variable Injection):** The prior run's final deliverable output (from the last phase of the prior completed run) is automatically decoded and exposed as template substitution variables:
  - `{{prior_run.output}}` (full deliverable text/payload)
  - `{{prior_run.id}}` (prior run UUID)
  - `{{prior_run.created_at}}` (timestamp of prior baseline)
- **D-04 (Anti-Trap Defenses & JSONB Safety):** The read path defends against the jsonb string-scalar trap at the point of read (handling both parsed `dict` and json-encoded `str` gracefully), and ensures the write path never double-encodes with `json.dumps` against asyncpg jsonb codecs. Owner scoping is strictly enforced on the service-role pool query (`created_by = $N` or org isolation) to ensure zero cross-tenant leakage.

### Delta Structure & Deliverable Presentation (STATE-02)
- **D-05 (Markdown Badges & Structured Deltas):** Living register deliverables format state changes using clear markdown summary sections with standardized status badges:
  - `[NEW]` — newly identified items
  - `[UPDATED]` — existing items with modified status, score, or details
  - `[RESOLVED]` / `[CLOSED]` — items from the previous register that are no longer active
- **D-06 (Machine-Readable Output Schema):** The phase executor optionally emits a structured `deltas` block (`{"added": [...], "modified": [...], "closed": [...], "unchanged": [...]}`) in the phase/run output JSON payload for automated consumption and downstream reporting.

### Authoring Controls & Workflow Studio
- **D-07 (Workflow-Level Stateful Toggle):** In Workflow Studio, authors can enable "Stateful / Living Register Mode" via a setting on the workflow definition.
- **D-08 (Prompt Editor Variable Chips):** When stateful mode is enabled, `{{prior_run.output}}` appears as a first-class variable insertion chip in the phase prompt template editor.

### Claude's Discretion
- Exact SQL query optimization and index additions for `(definition_id, user_id, status, created_at DESC)` on `workflow_runs`.
- Exact frontend badge styling and UI toggle placement in the Workflow Settings panel.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Roadmap
- `.planning/REQUIREMENTS.md` § STATE-01, STATE-02 — Core requirements for stateful living registers and delta reporting.
- `.planning/ROADMAP.md` § Phase 205 — Phase goals, known traps (jsonb string-scalar trap, G-5 hot files `db/workflows.py` & `task_service.py`), and process lessons from Phase 204.

### Database & Harness Execution
- `backend/app/db/workflows.py` — `workflow_runs`, `workflow_phases`, `create_workflow_run`, `load_run_phases`, `finish_run`.
- `backend/app/services/harness_engine.py` — `run_workflow`, `_persist_output`, phase context resolution and execution lifecycle.
- `backend/app/services/scheduler_service.py` — Unattended recurring scheduler driving recurring stateful runs.

### Frontend Studio & Variable Chips
- `frontend/src/components/workflows/builder/` — Workflow definition schema, settings panels, and prompt variable pickers.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `backend/app/db/workflows.py`: Query infrastructure for `workflow_runs` and `workflow_phases`.
- `backend/app/services/harness_engine.py`: `run_workflow` context dictionary (`ctx`) which can carry `prior_run` state directly into phase template rendering.
- `backend/app/services/scheduler_service.py`: Dispatches unattended recurring runs which immediately benefit from stateful prior run injection.

### Established Patterns & Guardrails
- **Owner-Scoped Queries:** All service-role queries against `workflow_runs` must include `created_by = $N` / `org_id` to prevent cross-tenant exposure.
- **JSONB Deserialization Safety:** `isinstance(raw, dict)` or `json.loads(raw) if isinstance(raw, str)` defensive parsing pattern (as established in `load_run_budget`).
- **G-5 Hot Files:** `backend/app/db/workflows.py` is a hot file; edits must strictly preserve existing query semantics and update `docs/HOT-FILE-LEDGER.md` if modified.

</code_context>

<specifics>
## Specific References

- Living register use cases: SEED-167 (Weekly delta reports & living risk registers), SEED-168 (Incremental compliance monitoring).
- Single-plan execution constraint: Recommended by Phase 204 process lessons to prevent parallel wave seam defects.

</specifics>
