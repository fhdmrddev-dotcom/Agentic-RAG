---
phase: 133-eval-runner-with-skill-vs-without-skill
plan: 02
subsystem: agent-loop / eval-substrate
tags: [eval, agent-loop, skill-catalog, additive-field, G-5, SC#4]
requires:
  - "RunContext + skill-catalog injection block (agent_loop.py, Phase 089/092)"
provides:
  - "RunContext.skill_catalog_override — additive default-off A/B catalog control (None=DB, ()=none, (skill,)=only)"
affects:
  - "backend/app/services/agent_loop.py (the shared Deep/agent-loop path — G-5 hot file)"
tech-stack:
  added: []
  patterns:
    - "Additive default-off RunContext field (092 resume_dropped_tool_calls precedent) — Deep Mode byte-identical"
    - "Single read-site data-source branch (no path fork — D-14)"
key-files:
  created:
    - "backend/tests/test_agent_loop_catalog_override.py"
  modified:
    - "backend/app/services/agent_loop.py"
decisions:
  - "D-03/D-04: one additive field skill_catalog_override controls the A/B (None=DB query, ()=inject nothing, (skill,)=inject only that skill)"
  - "D-14/SC#4: the None path runs the IDENTICAL DB query + builds the IDENTICAL catalog note — proven by test_deep_mode_unchanged"
metrics:
  duration: ~25 min
  completed: 2026-06-30
  tasks: 2
  files: 2
---

# Phase 133 Plan 02: Skill-Catalog Override Field Summary

One additive, default-off `RunContext.skill_catalog_override` field that makes the honest WITH-skill vs WITHOUT-skill eval A/B possible, guarded by a Deep-Mode-byte-identical regression test (SC#4) on the G-5 agent-loop hot file.

## What Shipped

- **`RunContext.skill_catalog_override: tuple[dict, ...] | None = None`** — appended immediately after the Phase 092 `dropped_tool_calls` field, same default-off discipline. Because it defaults to `None`, the only existing construction site (threads.py:1490-1500, Deep branch) is byte-unchanged.
- **Single read-site branch** in the skill-injection block (agent_loop.py:1174-1195), inside `if body.agent_mode != "explorer":`:
  - `None` → the existing `skills` DB query runs unchanged (Deep Mode byte-identical, D-14).
  - `()` → `enabled_skills = []` → the `if enabled_skills:` guard short-circuits → no `## Available Skills` note (WITHOUT arm, D-04).
  - `(skill, ...)` → `enabled_skills = list(override)` → catalog note built from exactly those skills, no DB query (WITH arm, D-03).
  - The `## Available Skills` catalog_note build below the branch is byte-identical.
  - The field is aliased once near :1093 (`skill_catalog_override = ctx.skill_catalog_override`) so the loop body reads it by local name like every other ctx input.
- **`test_agent_loop_catalog_override.py`** (TDD RED→GREEN) — three tests driving `run_agent_loop` directly with a mocked LLM (pattern mirrors `test_089_agent_loop_result_seam.py`), capturing the system prompt via the `create_adaptive_streaming_chat` patch:
  - `test_deep_mode_unchanged` (SC#4 truth): `None` → skills DB query IS issued AND the catalog note is built from the query rows.
  - `test_with_arm_injects_only_target` (D-03): `(skill,)` → NO DB query, note contains only that skill, decoy DB rows shadowed.
  - `test_without_arm_injects_nothing` (D-04): `()` → NO DB query, no `## Available Skills` note.

## Tasks & Commits

| Task | Name | Commit |
| ---- | ---- | ------ |
| 1 | RED — catalog-override + Deep-unchanged regression test | `13256ffa` |
| 2 | GREEN — additive field + single read-site branch | `4b33e3ae` |

## Verification

- RED confirmed: constructing `RunContext(skill_catalog_override=...)` raised `TypeError: unexpected keyword argument` before Task 2.
- GREEN: `pytest tests/test_agent_loop_catalog_override.py` → 3 passed.
- Acceptance greps: `skill_catalog_override` count = 4 (field decl + comment ref + alias + read-site); `agent_mode` count = 10 (unchanged — explorer branch untouched).
- Regression slice `pytest tests/ -k "agent_loop or threads or tuner"`: 14 failures, **all pre-existing baseline rot** — verified by reverting the GREEN edit (`git stash`) and re-running: the identical 14 tests fail at the committed baseline too (`test_threads_skills.py` suite, two `test_threads.py` SSE tests, `test_phase56_iteration_start`). **Zero NEW failures** from this change.

## Deviations from Plan

None — plan executed exactly as written (TDD RED→GREEN, field + single read-site branch, no helper extraction, explorer/prompt/toolset/max_iterations untouched).

## Threat Surface

No new threat surface beyond the plan's `<threat_model>`. T-133-05 (G-5 tampering) is mitigated exactly as planned: additive default-off field, single data-source branch, `test_deep_mode_unchanged` proving the None path is byte-identical.

## Known Stubs

None — the field is fully wired; the eval service (Plan 03) is the consumer that will source the override tuples from owner-scoped version snapshots.

## Self-Check: PASSED

- FOUND: `backend/app/services/agent_loop.py` (skill_catalog_override present, count 4)
- FOUND: `backend/tests/test_agent_loop_catalog_override.py` (defines all three named tests)
- FOUND commit: `13256ffa` (test RED)
- FOUND commit: `4b33e3ae` (feat GREEN)
