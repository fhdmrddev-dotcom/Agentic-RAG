---
phase: 091-harness-engine-5-phase-types-gates-whitelist
plan: 01
subsystem: testing
tags: [pydantic, pytest, harness, workflow, fixtures, asyncpg, redis]

# Dependency graph
requires:
  - phase: 090-harness-schema-rls-config-models
    provides: harness.py PROVISIONAL PhaseConfig discriminated union + extra='forbid' _StrictBase
provides:
  - Finalized 5 PhaseConfig models (input_keys, model/temperature overrides, wall_clock_seconds, ask_user options/timeout) with LOCKED structure intact
  - 5 shared pytest fixtures (mock_asyncpg_pool UPDATE-recorder, fake_redis pub/sub+XADD, make_tool_context with phase_whitelist, make_run_context, build_workflow_definition/four_seed_defs)
  - 7 Wave-0 harness test files (skeleton contracts mapped to every phase requirement; live model/seed anchors green, downstream contracts skipped with named owning plan)
affects: [091-02 engine, 091-03 executors, 091-04 resume, 091-05 gates, 091-06 whitelist+budget, 091-07 seeds]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Wave-0 contracts-first: skeleton test files with pytest.mark.skip(reason naming owning plan) + ≥1 live structural anchor per file; downstream plans flip their own skips live"
    - "Pure-Python fixture substrate: asyncpg UPDATE-order recorder + fake Redis pub/sub recorder run the deterministic proofs offline (no live DB/Redis)"
    - "Namespace ctx factory carries phase_whitelist BEFORE Plan 06 adds the field to the real ToolContext dataclass"

key-files:
  created:
    - backend/tests/test_harness_engine.py
    - backend/tests/test_harness_resume.py
    - backend/tests/test_harness_gates.py
    - backend/tests/test_harness_whitelist.py
    - backend/tests/test_tool_budget.py
    - backend/tests/test_harness_reachability.py
    - backend/tests/test_harness_templates.py
    - backend/tests/test_harness_conftest_smoke.py
  modified:
    - backend/app/models/harness.py
    - backend/tests/conftest.py

key-decisions:
  - "merge_strategy constrained to Literal['concat','concat_numbered'] (only Plan 03's implemented strategies); on_failure stays plain str so Plan 05 parses skip_to_phase:<slug> suffixes (D-11 no final_output field)"
  - "Conftest ctx factories return SimpleNamespace carrying all real ToolContext fields PLUS phase_whitelist — avoids a TypeError now while letting Plan 06 swap to the real dataclass once the field lands"
  - "four_seed_defs builder mirrors the migration-061 seed shapes so the 4 seeds cover all 5 phase types and are a real lint/end-to-end target for Plans 02/07"

patterns-established:
  - "Wave-0 skeleton: every requirement ID has a declared skipped contract that names its owning plan; live anchors keep each file non-trivial"
  - "Deterministic-proof fixtures: ordered .calls (asyncpg) + unified .events log (redis) enable index-comparison assertions (active<completed, subscribe<emit)"

requirements-completed: [HARNESS-01, HARNESS-03, HARNESS-04, HARNESS-05, HARNESS-07, TOOL-05]

# Metrics
duration: 7min
completed: 2026-05-31
---

# Phase 091 Plan 01: Harness Config Models + Wave-0 Test Scaffold Summary

**Finalized the 5 harness PhaseConfig Pydantic models against the engine's real reads (input_keys, model/temperature overrides, wall_clock_seconds, ask_user options/timeout) and stood up 8 test files + 5 shared fixtures so every downstream plan flips its own contracts live.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-05-31T04:58:37Z
- **Completed:** 2026-05-31T05:05:28Z
- **Tasks:** 3
- **Files modified:** 10 (2 modified, 8 created)

## Accomplishments
- Flipped `harness.py` per-field shapes from PROVISIONAL → FINALIZED: added `input_keys` (programmatic), `model`/`temperature` (llm_single), `wall_clock_seconds`+`model` (llm_agent, llm_batch_agents), constrained `merge_strategy` to a Literal, added `options`+`timeout_seconds` (llm_human_input). Discriminator, union, `extra='forbid'`, and the two Literal sets left LOCKED; no `final_output` field (D-11).
- Added 5 shared pytest fixtures to conftest.py: `mock_asyncpg_pool` (ordered UPDATE recorder for the 2-phase-write proof), `fake_redis` (XADD + pub/sub recorder with a unified `.events` log for subscribe-before-emit), `make_tool_context` (carries `phase_whitelist`), `make_run_context`, and `build_workflow_definition`/`four_seed_defs`. All 3 pre-existing fixtures (`client`, `redis_client`, `fk_aware_runs_factory`, etc.) preserved.
- Created 7 Wave-0 harness test files mapped to every phase requirement — 22 live anchors (model shapes + seed parse + 5-type coverage) green, 27 downstream contracts skipped each naming its owning plan. Full suite collects (1049 tests) with exit 0.

## Task Commits

Each task was committed atomically:

1. **Task 1: Finalize the 5 PhaseConfig models + ValidatorSpec** - `dbe96b15` (feat) — TDD RED (fixture-free model tests failed against PROVISIONAL models) → GREEN (model finalization), combined into one feat commit so the suite stays green per-commit.
2. **Task 2: Create shared test fixtures (conftest)** - `b266d9ee` (feat)
3. **Task 3: Create the 7 Wave-0 harness skeleton test files** - `3cc67f9e` (feat)

_Task 1's `test_harness_engine.py` was created in commit 1; the remaining 6 skeleton files in commit 3._

## Files Created/Modified
- `backend/app/models/harness.py` - Finalized the 5 PhaseConfig per-field shapes + module docstring; LOCKED structure untouched
- `backend/tests/conftest.py` - Added the 5 shared harness fixtures (no existing fixture removed)
- `backend/tests/test_harness_engine.py` - HARNESS-01: live `TestModelsFinalized` group + skipped dispatch/transition/completion contracts (Plan 02/03)
- `backend/tests/test_harness_conftest_smoke.py` - Proves the 5 fixtures import + compose (the conftest-smoke target)
- `backend/tests/test_harness_resume.py` - HARNESS-03: 2-phase write + sweep + ask_user resume contracts (Plan 02/04)
- `backend/tests/test_harness_gates.py` - HARNESS-04: 4 validator kinds + bounded retry + caps (Plan 05); live ValidatorSpec anchor
- `backend/tests/test_harness_whitelist.py` - HARNESS-05: refusal envelope + Deep-Mode no-op (Plan 06)
- `backend/tests/test_tool_budget.py` - TOOL-05: budget cap + whitelist retention (Plan 06)
- `backend/tests/test_harness_reachability.py` - HARNESS-07: orphan/unsatisfiable/no-terminal lint (Plan 02/07); live seed anchor
- `backend/tests/test_harness_templates.py` - HARNESS-07: seeds parse + 5-type coverage LIVE + end-to-end mocked (Plan 07)

## Decisions Made
- The smoke test for the 5 fixtures was placed in a dedicated `test_harness_conftest_smoke.py` module rather than inside `conftest.py` — pytest does not collect test functions defined in `conftest.py` (it's a plugin/fixture module), so a test there would silently never run. This satisfies the `-k "conftest_smoke or fixtures_importable"` quick target.
- `make_tool_context` returns a `SimpleNamespace` rather than the real `app.services.tool_dispatcher.ToolContext` dataclass: the real dataclass has no `phase_whitelist` field yet (Plan 06 adds it), and passing an unknown kwarg to a `@dataclass` raises `TypeError`. The namespace carries every real ToolContext field plus `phase_whitelist` so Plan 06 can swap to the real dataclass when the field lands.

## Deviations from Plan

None - plan executed exactly as written. The TDD RED→GREEN for Task 1 was folded into a single feat commit (rather than separate `test` then `feat` commits) because the test file as authored also carries fixture-dependent tests that only go green after Task 2; committing the harness change with its fixture-free model tests keeps the suite green at every commit. This is a commit-granularity choice within the plan, not a scope or behavior deviation.

## Issues Encountered
- The Task-2 verify target `-k "conftest_smoke or fixtures_importable"` initially matched 0 tests because the smoke test lived in `conftest.py` (uncollected). Resolved by moving it to `test_harness_conftest_smoke.py`.
- The Task-3 acceptance criterion "all 7 files import from `app.models.harness`" initially showed 6/7 — `test_harness_whitelist.py` only used a fixture. Resolved by sourcing the whitelist from a real `LlmAgentPhaseConfig.available_tools` in its live anchor (also a more faithful contract: the guard converts `available_tools` → `phase_whitelist`).

## TDD Gate Compliance
Task 1 was `tdd="true"`. RED was demonstrated (12 fixture-free model tests failed against the PROVISIONAL models — e.g. `AttributeError: 'LlmHumanInputPhaseConfig' object has no attribute 'options'`) before the model finalization made them GREEN. The plan itself is `type: execute` (not a plan-level `type: tdd` gate), so a single `feat` commit carrying both the tests and the implementation satisfies the per-task TDD flow; no separate test-only commit was required by the plan.

## User Setup Required
None - no external service configuration required. No migrations, no schema changes in this plan.

## Next Phase Readiness
- The harness config models are FIRM — Plans 02–07 can read `input_keys`, per-phase `model`/`temperature`/`wall_clock_seconds`, `merge_strategy`, and ask_user `options`/`timeout_seconds` without guessing.
- The 5 shared fixtures are importable by every `test_harness_*.py` and `test_tool_budget.py`; the deterministic-proof recorders (`mock_asyncpg_pool.calls`, `fake_redis.events`) are ready for the 2-phase-write and ask_user subscribe-before-emit proofs.
- All 27 Wave-0 contracts are declared and skipped with their owning plan named; each downstream plan flips its own set live.
- No blockers. Wave 2 (Plan 02 engine ‖ Plan 06 whitelist/budget) can proceed.

## Self-Check: PASSED

All 11 created/modified files verified on disk; all 3 task commits (`dbe96b15`, `b266d9ee`, `3cc67f9e`) present in git history.

---
*Phase: 091-harness-engine-5-phase-types-gates-whitelist*
*Completed: 2026-05-31*
