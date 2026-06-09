---
phase: 098-project-binding-server-side-kb-scope-governance
plan: 01
subsystem: database
tags: [pydantic, harness, workflow-definition, schema-lock, jsonb, zero-migration, project-binding, folder-scope]

# Dependency graph
requires:
  - phase: 097-spike-risk-register-template-fill
    provides: "CONCLUSION.md §3 verbatim additive-optional schema recommendation (InputFieldSpec / AssetRef / folder_scope shapes; 3 open questions settled)"
provides:
  - "WorkflowDefinition.project_folder_id (PROJ-01) — optional project=folder binding on the definition"
  - "Per-phase folder_scope: list[UUID] | None on LlmAgent / LlmBatchAgents / LlmSingle configs (PROJ-02) — bound resolved-id list, not a prompt hint"
  - "Output-side shape lock: output_target_folder / reingest_output / version_policy / provenance (D-08, behavior deferred)"
  - "Co-locked InputFieldSpec + AssetRef strict models (Phase 100/103 behavior)"
  - "D-07 structural narrow-only @model_validator (phase folder_scope requires a project_folder_id)"
affects: [099-workflow-skill-composition, 100-ephemeral-template-upload, 101-template-fill-integrity, 102-validation-gate-library, 103-workflows-page-authoring, scope.py-plan-03, threads.py-kickoff, harness_engine-resume]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Additive-optional-on-extra=forbid (zero-migration immutability): every new field is optional-with-default so old JSONB rows model_validate() to defaults while unknown keys still raise"
    - "Structural-only @model_validator: pure in-model invariant (folder_scope ⇒ project_folder_id present); DB-aware ⊆ check deferred to a dedicated resolver (scope.py)"
    - "Co-lock shapes early when JSONB makes it free: InputFieldSpec/AssetRef added now to avoid re-touching the model in Phases 100/103"

key-files:
  created:
    - backend/tests/test_098_schema_lock.py
  modified:
    - backend/app/models/harness.py

key-decisions:
  - "folder_scope carried on all three retrieval-family configs (LlmAgent + LlmBatchAgents load-bearing; LlmSingle inert, for shape symmetry) per D-02 + RESEARCH A2"
  - "Structural validator checks ONLY the project_folder_id-present invariant; the DB-aware subtree ⊆ check stays in Plan 03's scope.py (no DB logic in a pure Pydantic validator)"
  - "Old-row test filters migration ::jsonb blobs to full definitions (dict carrying 'phases') because migration 065 ships jsonb_set fragments, not WorkflowDefinitions"

patterns-established:
  - "Zero-migration schema lock on a single JSONB column via additive-optional Pydantic fields"
  - "Provenance lives in run OUTPUT only — no Cited field on InputFieldSpec (open-Q ii / D-11)"

requirements-completed: [PROJ-01, PROJ-02]

# Metrics
duration: 9min
completed: 2026-06-09
---

# Phase 098 Plan 01: Project-Binding Schema Lock Summary

**Additive-optional, zero-migration Pydantic schema lock on `WorkflowDefinition` — adds `project_folder_id` (PROJ-01), a bound per-phase `folder_scope` resolved-id list (PROJ-02), the D-08 output-side shapes, co-locked `InputFieldSpec`/`AssetRef`, and a structural narrow-only `@model_validator` — while every old seeded JSONB row still `model_validate()`s to defaults.**

## Performance

- **Duration:** ~9 min
- **Started:** 2026-06-09T14:00:00Z (approx)
- **Completed:** 2026-06-09T14:08:45Z
- **Tasks:** 2
- **Files modified:** 2 (1 modified, 1 created)

## Accomplishments
- Locked the 098 additive-optional schema on `WorkflowDefinition`: `project_folder_id`, `output_target_folder`, `reingest_output`, `version_policy`, `provenance`, `inputs`, `assets` — all optional-with-default so existing published rows (migrations 061/065) validate unchanged (SC#1).
- Added bound `folder_scope: list[UUID] | None` to the retrieval-config family (`LlmAgentPhaseConfig`, `LlmBatchAgentsPhaseConfig`, `LlmSinglePhaseConfig`) — a resolved id list the engine binds, NOT a free-text prompt hint the model could widen (PROJ-02).
- Co-locked the `InputFieldSpec` and `AssetRef` strict models verbatim from the spike CONCLUSION.md §3 (JSONB makes the co-lock free; avoids re-touching the model in Phases 100/103).
- Added the D-07 STRUCTURAL narrow-only `@model_validator` — a phase that declares a `folder_scope` while the workflow has no `project_folder_id` is a hard `ValidationError`. The DB-aware ⊆ subtree check is explicitly left to Plan 03's `scope.py`.
- Authored 3 offline/pure schema-lock tests (old-row validate, new-field round-trip via `model_dump(mode="json")`, structural reject) — all green.

## Task Commits

Each task was committed atomically:

1. **Task 1: Lock additive-optional schema fields + structural validator on harness.py** - `47ee6520` (feat)
2. **Task 2: Schema-lock tests (old-row validate + new-field round-trip + structural reject)** - `5116730e` (test)

_Note: per-task verifies — Task 1 import smoke test (`from app.models.harness import WorkflowDefinition, InputFieldSpec, AssetRef`) exits 0; Task 2 `pytest tests/test_098_schema_lock.py -x` → 3 passed._

## Files Created/Modified
- `backend/app/models/harness.py` - Added `from uuid import UUID` + `model_validator` import; `folder_scope` on the 3 retrieval-family configs; `InputFieldSpec`/`AssetRef` co-lock models; 7 additive-optional `WorkflowDefinition` fields; the D-07 structural `@model_validator`.
- `backend/tests/test_098_schema_lock.py` - 3 pure-Pydantic tests: `test_old_rows_validate`, `test_new_fields_roundtrip`, `test_structural_scope_requires_project`.

## Decisions Made
- **folder_scope on all three retrieval-family configs** (not just the two D-02 named): RESEARCH A2 identified `llm_batch_agents` as the OTHER retrieval phase; `llm_single` carries it inert for shape symmetry. Documented inline.
- **Validator scope = structural only**: the `@model_validator(mode="after")` enforces only "folder_scope ⇒ project_folder_id present" using `getattr(phase.config, "folder_scope", None)` (so `ProgrammaticPhaseConfig`/`LlmHumanInputPhaseConfig`, which lack the field, are skipped). No DB/`supabase`/`user_id` logic — that belongs in Plan 03's `scope.py`.
- **No SQL migration**: `workflow_definitions.definition` is a single JSONB column; the entire lock is Pydantic-only (CLAUDE.md zero-migration intent for this plan honored).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Old-row test must filter migration blobs to full definitions**
- **Found during:** Task 2 (schema-lock tests)
- **Issue:** The plan instructs parsing the seeded-template JSONB "straight out of migrations 061 + 065" with `r"'((?:[^']|'')*)'::jsonb"` and `model_validate()`-ing each. Migration 065, however, patches the seeds via `jsonb_set` and its two `::jsonb` literals are FRAGMENTS (`["topic","kickoff_prompt"]` and `[]`) — NOT `WorkflowDefinition` blobs. Feeding those straight to `WorkflowDefinition.model_validate()` would raise and break the test.
- **Fix:** `_extract_definition_blobs(*sql_files)` parses both 061 and 065 (honoring the "061 + 065" intent and referencing both file paths) but keeps only blobs that are a `dict` carrying a `phases` key — i.e. real definitions. Migration 061 yields the 4 canonical seed definitions; 065's fragments are filtered out.
- **Files modified:** backend/tests/test_098_schema_lock.py
- **Verification:** `pytest tests/test_098_schema_lock.py -x` → 3 passed; `test_old_rows_validate` asserts ≥4 definitions parsed and that every 098 field defaults.
- **Committed in:** `5116730e` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug — incorrect test input assumption in the plan).
**Impact on plan:** The fix is faithful to the plan's stated intent ("parse the seeded-template DEFINITION JSONB") and references both migration files as the acceptance criterion requires. No scope creep.

## Issues Encountered
- The git worktree has no Python `venv` (gitignored, so not checked out). Resolved by running the main checkout's interpreter (`C:/Vibe Apps/Agentic RAG/backend/venv/Scripts/python.exe`) from the worktree `backend/` dir, so both the import smoke test and pytest exercise the worktree's `app.models.harness`. pytest `rootdir` resolved to the worktree backend (confirmed by `test_new_fields_roundtrip` — which requires the new fields — passing).

## User Setup Required
None - no external service configuration required. Zero-migration, Pydantic-only change.

## Next Phase Readiness
- The schema foundation every later 098 plan reads from is locked. Plan 02 (retrieval enrich + clip/emit in `tool_dispatcher.py`), Plan 03 (`scope.py` resolver + DB-aware ⊆ assert + the 3 ctx-build sites), Plan 04/05 (library filter + UAT) can build on `project_folder_id` / `folder_scope` / the structural validator.
- Explicit hand-off to Plan 03: the DB-aware subtree ⊆ check (`assert_folder_scopes_subset`) and the `resolve_project_subtree` resolver live in `scope.py` — NOT in this model's validator.

---
*Phase: 098-project-binding-server-side-kb-scope-governance*
*Completed: 2026-06-09*

## Self-Check: PASSED

- FOUND: backend/app/models/harness.py
- FOUND: backend/tests/test_098_schema_lock.py
- FOUND: .planning/phases/098-project-binding-server-side-kb-scope-governance/098-01-SUMMARY.md
- FOUND commit: 47ee6520 (Task 1, feat)
- FOUND commit: 5116730e (Task 2, test)
