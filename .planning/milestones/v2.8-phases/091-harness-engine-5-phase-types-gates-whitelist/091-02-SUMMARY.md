---
phase: 091-harness-engine-5-phase-types-gates-whitelist
plan: 02
subsystem: harness-engine
tags: [harness, workflow, asyncpg, state-machine, 2-phase-write, reachability, resumability]

# Dependency graph
requires:
  - phase: 091-harness-engine-5-phase-types-gates-whitelist
    plan: 01
    provides: finalized PhaseConfig models + 5 shared pytest fixtures (mock_asyncpg_pool, fake_redis, build_workflow_definition/four_seed_defs)
  - phase: 090-harness-schema-rls-config-models
    provides: workflow_runs / workflow_phases / harness_audit tables (migrations 056-060) live in the DB
provides:
  - "harness_engine.run_workflow — hand-rolled async transition loop (phase_index order; LLM never picks next phase) + 2-phase write + completion semantics (D-10)"
  - "db/workflows.py — 9 typed asyncpg helpers (load_run_phases, mark_phase_active, complete_phase, fail_phase, skip_phase, advance_current_phase, finish_run, claim_run, write_audit) with the workflow_run_id column contract"
  - "harness/reachability.py — lint_workflow pure function (orphan / unsatisfiable_skip / no_terminal / bad_index)"
  - "PHASE_TYPE_REGISTRY dispatch seam (Plan 03 fills) + _run_gates seam (Plan 05 fills)"
affects: [091-03 executors, 091-04 resume, 091-05 gates, 091-07 seeds, 092 publish endpoint]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "2-phase write delegated to db/workflows.py: mark_phase_active (durable active BEFORE work) then complete_phase (status flip + output in ONE atomic UPDATE, only after durable)"
    - "Dispatch-by-phase_type via a module-level PHASE_TYPE_REGISTRY dict — the SEAM Plan 03 fills; empty here raises PhaseTypeNotRegistered; tests inject stubs"
    - "Reachability lint edge model: sequential edges by phase_index VALUE (i -> i+1), not sorted position, so a non-contiguous index gap genuinely orphans / strands the terminal"
    - "write-before-emit on every transition (D-v2.5-03): durable DB write precedes the run:{run_id} _emit XADD"

key-files:
  created:
    - backend/app/db/workflows.py
    - backend/app/services/harness_engine.py
    - backend/app/services/harness/__init__.py
    - backend/app/services/harness/reachability.py
  modified:
    - backend/tests/test_harness_engine.py
    - backend/tests/test_harness_resume.py
    - backend/tests/test_harness_reachability.py

key-decisions:
  - "run_workflow iterates the DURABLE workflow_phases rows (load_run_phases) in phase_index order and maps each to its typed PhaseSpec by slug — the durable row is the source of truth for resume, the parsed definition supplies the typed config to dispatch on"
  - "run_completed _emit field renamed status='completed' (not run_id=) because _emit's signature already binds run_id positionally — a run_id kwarg collides (TypeError)"
  - "Reachability sequential edges link by phase_index VALUE +1 (not sorted adjacency) so the lint can actually detect orphans/no-terminal; a contiguous well-formed graph is always fully connected, broken graphs (index gaps) are flagged"
  - "_persist_output keeps the 64KB size gate + path-only spill CONTRACT this plan; the concrete workspace-files bucket write is supplied by the Plan 03 executors that produce large blobs (placeholder path 'workspace-files://pending')"

requirements-completed: [HARNESS-01, HARNESS-03]

# Metrics
duration: 7min
completed: 2026-05-31
---

# Phase 091 Plan 02: Harness Engine Core + 2-Phase Write + Reachability Lint Summary

**Built the hand-rolled async harness state machine (`run_workflow`) that drives a published WorkflowDefinition through its phases in phase_index order — the LLM never picks the next phase — with the strict 2-phase write (mark active before work, complete only after durable output, crash leaves active) delegated to 9 typed asyncpg helpers, plus a pure publish-time reachability lint that the 4 seed shapes pass clean.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-05-31T05:08:58Z
- **Completed:** 2026-05-31T05:15:22Z
- **Tasks:** 3
- **Files modified:** 7 (4 created, 3 modified)

## Accomplishments
- **db/workflows.py (Task 1):** 9 typed asyncpg helpers mirroring `db/runs.py` (pool, `$N` params, no supabase-py in the hot path). The BLOCKER column-name contract is honoured — every run-keyed `workflow_phases` read uses `workflow_run_id` (NOT a bare `run_id`, which would raise Postgres 42703); phase-keyed writes filter `WHERE id=$1`. The 2-phase write is two ordered atomic UPDATEs: `mark_phase_active` (status='active') then `complete_phase` (status='completed' + output in ONE UPDATE). `claim_run` is a CAS for single-producer discipline (Pitfall 7). `write_audit` validates event_type against a 9-kind `_AUDIT_EVENT_TYPES` frozenset before INSERT (Pitfall 6 — fail fast, not a Postgres 23514 mid-run).
- **harness_engine.run_workflow (Task 2):** the transition loop loads the durable phase rows, seeds `accumulated_outputs` from already-completed rows (resume substrate), iterates in phase_index order skipping completed/skipped rows, and per to-run phase: marks active → audit+emit `phase_started` → dispatches via `PHASE_TYPE_REGISTRY` under an `asyncio.wait_for` wall-clock cap → runs the `_run_gates` no-op seam → completes (after `_persist_output` spills >64KB path-only) → advances current_phase → audit+emit `phase_completed`/`phase_transition`. On completion the FINAL phase output is set as `ctx.final_output` (the chat message verbatim, D-10) with NO extra synthesis LLM call, then `finish_run` + `run_completed` emit (durable status before terminal sentinel, mirroring `_shielded_finalize`). A phase that raises mid-work is left `active` (the exception propagates; the engine never marks it completed/failed) — the crash-leaves-active resume invariant.
- **harness/reachability.py (Task 3):** `lint_workflow` pure function flagging `orphan_phase`, `unsatisfiable_skip`, `no_terminal`, and a `bad_index` well-formedness floor (duplicate slug / non-contiguous index). Edges = sequential (phase_index value +1) + every `skip_to_phase:<slug>` parsed from `validators[].on_failure` via `parse_skip_target`. The 4 canonical seed shapes lint clean.

## Task Commits

Each task was committed atomically:

1. **Task 1: Typed asyncpg DB helpers (db/workflows.py)** — `f3c3e61b` (feat)
2. **Task 3: Publish-time reachability lint (harness/reachability.py)** — `11b9eb56` (feat)  _(Task 3 is order-independent of T1/T2 per the plan's scope_sanity note; committed second after the independent pure function was done)_
3. **Task 2: run_workflow transition loop + 2-phase write + completion (harness_engine.py)** — `7a24ded5` (feat)

## Files Created/Modified
- `backend/app/db/workflows.py` — 9 typed asyncpg helpers + `_AUDIT_EVENT_TYPES` frozenset (created)
- `backend/app/services/harness_engine.py` — `run_workflow` loop + `PHASE_TYPE_REGISTRY`/`_run_gates`/wall-clock seams + `_persist_output` spill + completion semantics (created)
- `backend/app/services/harness/__init__.py` — package marker re-exporting `lint_workflow`/`LintError`/`parse_skip_target` (created)
- `backend/app/services/harness/reachability.py` — `lint_workflow` pure function (created)
- `backend/tests/test_harness_engine.py` — flipped `engine_drives_ordered_transitions` + `completion_final_phase_output_is_chat_message` live (dispatch-routes-5-types stays skipped for Plan 03)
- `backend/tests/test_harness_resume.py` — flipped `two_phase_write_active_before_completed` + `crash_leaves_phase_active_not_completed` live (sweep/ask_user contracts stay skipped for Plan 04)
- `backend/tests/test_harness_reachability.py` — flipped orphan / unsatisfiable_skip / missing_terminal / 4-seeds-clean + `parse_skip_target` live

## Decisions Made
- **run_completed emit field renamed:** `_emit(redis, run_id, "run_completed", ...)` already binds `run_id` positionally; passing a `run_id=` kwarg raised `TypeError: got multiple values for argument 'run_id'`. The completion event now carries `status="completed"` (the run_id is already implicit in the `run:{run_id}` stream key). Caught and fixed during the first test run.
- **Reachability edge model by index VALUE, not sorted position:** linking consecutive *sorted positions* would make every graph fully connected (orphans/no-terminal undetectable). Linking by `phase_index + 1` *value* means a non-contiguous gap genuinely orphans the phase after the gap and can strand the terminal — so the lint actually catches the failure classes the plan requires. A well-formed contiguous graph stays clean.
- **Engine iterates durable rows, dispatches on typed config:** `run_workflow` walks the `load_run_phases` rows (the resume source of truth) and looks up each row's `PhaseSpec` by slug from the parsed definition to get the typed `config` for dispatch. This keeps the durable DB state authoritative for resume while still dispatching on the strict Pydantic config.

## Deviations from Plan
None — plan executed exactly as written. The `run_completed` emit-field rename was a Rule-1 bug fix caught by the engine's own test on first run (a kwarg/positional collision in the `_emit` call), fixed inline before the Task 2 commit; it is a one-line correction within the task, not a scope or behavior deviation.

## Known Stubs
The following are intentional, plan-mandated SEAMS (not blocking stubs) — each is documented in the plan and owned by a named downstream plan:
- `PHASE_TYPE_REGISTRY: dict[str, Callable] = {}` (harness_engine.py) — empty dispatch registry; **Plan 03** registers the 5 real executors and flips `test_phase_dispatch_routes_each_of_5_types` live. Empty registry raises `PhaseTypeNotRegistered` (no silent no-op).
- `_run_gates(...) -> True` (harness_engine.py) — validation-gate no-op; **Plan 05** implements the 4 validator kinds + bounded retry.
- `_persist_output` placeholder spill path `'workspace-files://pending'` (harness_engine.py) — the 64KB size gate + path-only contract are live; **Plan 03** executors that produce large blobs supply the concrete bucket path.
The plan goal (HARNESS-01 ordered transitions + HARNESS-03 2-phase-write durability + reachability lint) is fully achieved this plan; the seams are the explicit Wave-2 boundary.

## Verification
- `pytest tests/test_harness_engine.py tests/test_harness_resume.py tests/test_harness_reachability.py -q` → **26 passed, 4 skipped** (the 4 skips are Plan 03/04 contracts).
- Full harness suite (8 files) → **32 passed, 19 skipped** — no collateral breakage.
- Import smoke: `from app.services.harness_engine import run_workflow, PHASE_TYPE_REGISTRY; from app.services.harness import lint_workflow; from app.db.workflows import mark_phase_active, complete_phase, claim_run` → ok, 9 audit kinds.
- `grep -nE "FROM workflow_phases[^;]*WHERE[^;]*[^_]run_id" db/workflows.py` → CLEAN (no bare run_id predicate; the 42703 guard holds).
- `git status` confirms ZERO edits to any `backend/app/services/*_service.py` or `agent_loop.py` — all harness logic is above the loop / in new modules.

## TDD Gate Compliance
This plan is `type: execute` (not a plan-level `type: tdd` gate). Each task flipped its Wave-0 skeleton contracts to live tests in the same `feat` commit as the implementation (the Wave-0 skeletons were the pre-authored RED; the implementation makes them GREEN). Per-task verification gates passed before each commit.

## User Setup Required
None — no migrations, no schema changes, no external service config. This plan operates over the Phase 090 tables (already live in the DB).

## Next Phase Readiness
- **Plan 03 (executors):** registers the 5 real executors into `PHASE_TYPE_REGISTRY` and flips `test_phase_dispatch_routes_each_of_5_types`; the dispatch seam + `_execute_phase(phase, accumulated_outputs, ctx)` signature are firm.
- **Plan 04 (resume):** `claim_run` CAS + `load_run_phases` + the crash-leaves-active invariant are in place; the startup sweep + ask_user re-subscribe contracts in `test_harness_resume.py` are still skipped and owned by Plan 04.
- **Plan 05 (gates):** `_run_gates(phase, output, ctx)` no-op seam + `fail_phase`/`skip_phase` helpers are ready; Plan 05 wires the bounded retry around the execute call and the deliberate fail_run path.
- **Plan 07 / Phase 092 (publish):** `lint_workflow` is the pure publish-time gate; the HTTP publish endpoint is deferred to 092 per Open Question 5.

## Self-Check: PASSED

All 4 created files + 3 modified test files verified on disk; all 3 task commits (`f3c3e61b`, `11b9eb56`, `7a24ded5`) present in git history.

---
*Phase: 091-harness-engine-5-phase-types-gates-whitelist*
*Completed: 2026-05-31*
