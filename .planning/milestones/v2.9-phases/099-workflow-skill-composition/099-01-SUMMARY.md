---
phase: 099-workflow-skill-composition
plan: 01
subsystem: api
tags: [pydantic, harness, workflow, skills, tool-dispatcher, schema, tdd]

# Dependency graph
requires:
  - phase: 098-project-binding-server-side-kb-scope-governance
    provides: "the folder_scope additive-optional template + _StrictBase extra='forbid' + the WorkflowDefinition structural validator precedent that 099 mirrors"
provides:
  - "SkillSnapshot(_StrictBase) model — the materialized immutable skill copy (skill_id/name/description/instructions/files/storage_prefix)"
  - "skill_ref + skill_snapshot additive-optional fields on all 3 LLM phase configs (llm_single/llm_agent/llm_batch_agents)"
  - "_skill_snapshot_requires_ref structural validator (pure shape — rejects snapshot-without-ref)"
  - "ToolContext.skill_snapshot: Any = None dataclass field (Deep dispatch byte-identical)"
  - "backend/tests/test_099_skill_composition.py — the 10 Wave 0 cross-plan TDD stubs + the _FakeStorage recorder"
affects: [099-02 (_skill_block + auto-whitelist), 099-03 (gated read branch + publish gate + materializer), 099-04 (threads.py kickoff wiring)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Interface-first data contract — the types land in Plan 01 so Plans 02/03/04 import them, not via codebase archaeology"
    - "Cross-plan TDD scaffold — all SC-mapped stubs authored in Plan 01; downstream behavior marked xfail(strict=False) so the suite stays exit-0"
    - "Additive-optional zero-migration field pattern (Pitfall 2) — every new field defaults so a pre-099 published JSONB row still model_validate()s"
    - "Pure-shape @model_validator (no DB) — structural invariants in the model; DB-aware gates deferred to the service layer"

key-files:
  created:
    - backend/tests/test_099_skill_composition.py
  modified:
    - backend/app/models/harness.py
    - backend/app/services/tool_dispatcher.py

key-decisions:
  - "SkillSnapshot defined ABOVE the phase configs (not near AssetRef as the plan suggested) so the skill_snapshot: SkillSnapshot | None annotation resolves at class build under from __future__ import annotations — avoids a PydanticUndefinedAnnotation"
  - "Added a SIBLING @model_validator (_skill_snapshot_requires_ref) rather than extending _folder_scope_requires_project — keeps the two structural invariants independently readable"
  - "ToolContext.skill_snapshot typed Any (not SkillSnapshot) — avoids importing the harness model on the dispatcher hot path, mirroring per_run_task_semaphore: Any"

patterns-established:
  - "Snapshot-without-ref is structurally invalid: a materialized skill_snapshot cannot exist without the skill_ref it was copied from (T-099-06)"
  - "llm_single carries skill_ref + skill_snapshot for shape symmetry (D-07/D-08) — the file manifest is inert there"

requirements-completed: [WFSKILL-01]

# Metrics
duration: 25min
completed: 2026-06-09
---

# Phase 099 Plan 01: Workflow ↔ Skill Composition Data Contract Summary

**Additive-optional `skill_ref` + materialized `SkillSnapshot` on all 3 LLM phase configs, a snapshot-without-ref structural validator, `ToolContext.skill_snapshot` (Deep byte-identical), and the 10-stub cross-plan TDD scaffold — the typed contract Plans 02/03/04 implement against.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-06-09T23:00:12Z
- **Completed:** 2026-06-09T23:25:40Z
- **Tasks:** 3
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments

- **`SkillSnapshot(_StrictBase)` model** — the immutable, materialized copy of a referenced skill (`skill_id` / `name` / `description` / `instructions` / `files` manifest / `storage_prefix`), defined above the phase configs so the forward ref resolves under `from __future__ import annotations`. Lives inside the locked `WorkflowDefinition` JSONB so a later live-skill edit/delete cannot change a published run (D-01).
- **`skill_ref` + `skill_snapshot` additive-optional fields on all 3 LLM configs** (`LlmSinglePhaseConfig`, `LlmAgentPhaseConfig`, `LlmBatchAgentsPhaseConfig`) — both default `None`, so a pre-099 published JSONB row still `model_validate()`s (zero-migration, Pitfall 2). `extra="forbid"` rejects an injected/typo'd key (T-099-04).
- **`_skill_snapshot_requires_ref` structural validator** — pure shape, no DB: a phase carrying a `skill_snapshot` without a `skill_ref` raises `ValueError` naming the phase slug (T-099-06). The DB-aware publish gate (existence / visibility / `is_enabled`) is deferred to Plan 03's `skill_snapshot.py`.
- **`ToolContext.skill_snapshot: Any = None`** — the dispatch-context field (field only, no handler logic). `None` on every Deep / non-skill caller → the Plan 03 gated read branch is a literal no-op → byte-identical Deep behavior (SC#3 / T-099-05). `_handle_read_skill_file` left untouched.
- **`backend/tests/test_099_skill_composition.py`** — the 10 SC-mapped cross-plan TDD stubs (2 GREEN this plan + 8 `xfail(strict=False)` for Plans 02/03/04) plus a local `_FakeStorage` download/upload recorder modeled on the conftest `_FakeRedis` XADD recorder.

## Task Commits

Each task was committed atomically:

1. **Task 1: Author the 9+1 Wave 0 unit-test stubs** — `536a5cc5` (test)
2. **Task 2: Add skill_ref + SkillSnapshot + structural validator to harness.py** — `81d0c5d3` (feat, TDD GREEN)
3. **Task 3: Add ToolContext.skill_snapshot field (dataclass field only)** — `fcae5df0` (feat, TDD GREEN)

**Plan metadata:** (this SUMMARY + STATE + ROADMAP) committed separately.

_Note: this plan's TDD tasks (2, 3) reuse the Task 1 test scaffold as the RED gate (cross-plan TDD), so each GREEN task is a single `feat` commit rather than a test→feat pair._

## Files Created/Modified

- `backend/tests/test_099_skill_composition.py` (created) — 10 cross-plan TDD test stubs (SC#1/SC#2/SC#3) + `_FakeStorage` recorder + local skills-DB / live-skill query fakes for the downstream xfail rows.
- `backend/app/models/harness.py` (modified) — `SkillSnapshot` model; `skill_ref` + `skill_snapshot` on all 3 LLM configs; `_skill_snapshot_requires_ref` structural validator.
- `backend/app/services/tool_dispatcher.py` (modified) — `ToolContext.skill_snapshot: Any = None` at the dataclass tail; `_handle_read_skill_file` unchanged.

## Decisions Made

- **`SkillSnapshot` placed above the phase configs**, not "near `AssetRef`" as the plan text suggested — in this file `AssetRef` is defined *below* the configs, so a forward-referenced `SkillSnapshot | None` annotation there would risk a `PydanticUndefinedAnnotation` at class build. Defining it above the configs keeps the name resolvable.
- **Sibling validator over extending the existing one** — `_skill_snapshot_requires_ref` is a separate `@model_validator(mode="after")` from `_folder_scope_requires_project`, so the two structural invariants stay independently readable (the plan explicitly allowed either approach).
- **`ToolContext.skill_snapshot` typed `Any`** — avoids importing the harness model into the dispatcher module-load path (matches `per_run_task_semaphore: Any`).

## Deviations from Plan

None - plan executed exactly as written. (The `SkillSnapshot` placement above the configs is the plan's own primary instruction — "ABOVE the phase configs"; the prose "near `AssetRef`" was advisory and would have been incorrect for forward-ref resolution. No behavior changed; no scope added.)

## Issues Encountered

- **Full-suite pre-existing rot:** `cd backend && pytest tests/ -q` reports 114 failures at baseline (`tests/unit/test_sql_service.py`, `test_sandbox_service.py`, `test_streaming_reliability.py`, `test_retrieval_service.py`, `test_077_cross_cancel.py` — mock-driven service tests documented as rot in MEMORY.md). Verified **zero net-new failures**: failure count is 114 both before and after this plan; passing count rose 1189 → 1191 (the 2 GREEN 099 tests). The plan's "full suite stays green (baseline 81/81)" refers to the harness/098-scoped suites, which are 22/22 green here (`test_harness_whitelist` + `test_098_scope_governance` + `test_harness_models`).

## Self-Check: PASSED

- Files: `backend/tests/test_099_skill_composition.py`, `backend/app/models/harness.py`, `backend/app/services/tool_dispatcher.py`, `.planning/phases/099-workflow-skill-composition/099-01-SUMMARY.md` — all FOUND.
- Commits: `536a5cc5`, `81d0c5d3`, `fcae5df0` — all FOUND.
- `pytest tests/test_099_skill_composition.py -x` exits 0 (2 passed / 7 xfailed / 1 xpassed). No net-new full-suite failures (114 = 114).

## Next Phase Readiness

- **Plan 02** (`_skill_block` composition + `_build_phase_tool_context` auto-whitelist) can now import `SkillSnapshot` and read `phase.config.skill_ref` / `phase.config.skill_snapshot` and `ctx.skill_snapshot` — the typed contract exists. Its 2 stubs (`test_skill_block_compose`, `test_auto_whitelist`) are authored and xfail-ready to flip GREEN.
- **Plan 03** (gated read branch + publish gate + materializer) has `ToolContext.skill_snapshot` to branch on and `SkillSnapshot` to populate; its 5 stubs are authored (`test_deep_noop`, `test_snapshot_routing`, `test_publish_gate_rejects`, `test_snapshot_materialize`, `test_snapshot_immune_to_live_edit`) with the `_FakeStorage` / `_FakeSkillsDB` fakes in place.
- **Plan 04** (threads.py kickoff wiring) has `test_kickoff_snapshot_wiring` authored against a `_ensure_skill_snapshots` contract (validate → materialize-if-needed → `ValueError → 400`).
- No blockers.

---
*Phase: 099-workflow-skill-composition*
*Completed: 2026-06-09*
