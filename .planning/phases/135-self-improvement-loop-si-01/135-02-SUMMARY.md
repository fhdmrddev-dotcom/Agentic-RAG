---
phase: 135-self-improvement-loop-si-01
plan: 02
subsystem: api
tags: [skills, eval, agent-loop, tool-dispatch, self-improvement, additive-seam]

# Dependency graph
requires:
  - phase: 133-eval-runner-with-skill-vs-without-skill
    provides: "RunContext.skill_catalog_override additive default-off precedent + run_eval_job A/B engine (_run_arm/_run_arm_body)"
  - phase: 099-workflow-skill-composition
    provides: "task_service sub_ctx skill_snapshot propagation (the structural-unreachability fix class this clones)"
provides:
  - "Additive default-off skill_instructions_override seam threaded RunContext -> both ToolContext builds (primary :2279 + resume :1501) -> _handle_load_skill -> the DRAFT re-eval reads the proposed instructions, not the live skills row"
  - "task_service sub-agent ctx propagates parent_ctx.skill_instructions_override (task-tool corner case)"
  - "run_eval_job additive optional param carrying {skill_name: proposed_instructions} into the WITH-arm RunContext build"
  - "Guard test proving override-honored + None => live-body (Deep byte-identical)"
affects: [135-self-improvement-loop-si-01, skill-publish-gate, re-eval, promotion-gate]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Additive default-off context field cloned from skill_catalog_override/phase_whitelist/workflow_run_id/skill_snapshot — None on every existing caller => shared path byte-identical (no fork)"
    - "getattr-guarded ctx read in the tool handler so a duck-typed stub predating the field still works (096 workflow_run_id precedent)"

key-files:
  created:
    - backend/tests/test_load_skill_override.py
  modified:
    - backend/app/services/agent_loop.py
    - backend/app/services/tool_dispatcher.py
    - backend/app/services/task_service.py
    - backend/app/services/eval_runner_service.py

key-decisions:
  - "skill_instructions_override passed to the WITH arm ONLY in run_eval_job; the WITHOUT arm stays default None (semantic clarity — the WITHOUT arm loads no skill anyway)"
  - "Override keys on skill NAME (the arg _handle_load_skill looks up via .eq(name, ...)); a name absent from the map falls through to the live DB row"
  - "Resume ToolContext build (:1501) carries the override too — a resumed re-eval must keep measuring the DRAFT, not silently revert to the live skill (D-05)"

patterns-established:
  - "Instructions-override seam mirrors the shipped catalog-override discipline end-to-end: RunContext field + unpack + both loop build sites + sub-agent copy + handler branch, all default-off"

requirements-completed: [SI-01]

# Metrics
duration: 13min
completed: 2026-07-02
---

# Phase 135 Plan 02: skill_instructions_override Seam Summary

**Additive default-off skill_instructions_override threaded RunContext -> both ToolContext builds + task-tool sub-agent -> _handle_load_skill, plus one run_eval_job param, so the D-05 draft re-eval measures the DRAFT's instructions without touching the live skill (RESEARCH Pitfall #1 closed) while Deep Mode stays byte-identical.**

## Performance

- **Duration:** ~13 min
- **Started:** 2026-07-02T03:00:00Z (approx)
- **Completed:** 2026-07-02T03:13:00Z
- **Tasks:** 3
- **Files modified:** 5 (4 modified + 1 created)

## Accomplishments
- Closed the load-bearing correctness gap (Pitfall #1): `_handle_load_skill` (`tool_dispatcher.py:656`) resolved a skill's instructions from the LIVE `skills` table by name, so a re-eval of a DRAFT version would silently measure the OLD instructions — making the auto re-eval gate a no-op. It now returns the DRAFT body when the re-eval passes an override map keyed on the skill name.
- Threaded the seam through EVERY wiring site: `RunContext` field (frozen, default-off), the unpack in `run_agent_loop`, the PRIMARY ToolContext build (`:2279`), the RESUME ToolContext build (`:1501`), and the task-tool sub-agent `sub_ctx` in `task_service.py`.
- Added one additive optional param to `run_eval_job` forwarded down `_run_arm -> _run_arm_body` into the WITH-arm RunContext build — an extension, not a fork (D-12).
- Deep Mode proven byte-identical: `test_deep_mode_unchanged` stays green; the new None-path test re-affirms the live-body return (D-16 red line).

## Task Commits

Each task was committed atomically:

1. **Task 1: RunContext + both ToolContext builds + sub-agent ctx + _handle_load_skill** - `e1252d33` (feat)
2. **Task 2: Thread skill_instructions_override through run_eval_job WITH arm** - `f141a4de` (feat)
3. **Task 3: test_load_skill_override.py (override + None guards)** - `2d381897` (test)

## Files Created/Modified
- `backend/app/services/agent_loop.py` - `RunContext.skill_instructions_override` field + docstring; unpack at the catalog-override site; kwarg passed into BOTH the primary (`:2279`) and resume (`:1501`) ToolContext builds.
- `backend/app/services/tool_dispatcher.py` - `ToolContext.skill_instructions_override` field; `_handle_load_skill` returns the override instructions when the map contains the skill name (getattr-guarded), else the live DB row's body.
- `backend/app/services/task_service.py` - sub-agent `sub_ctx` propagates `parent_ctx.skill_instructions_override` beside `phase_whitelist`/`workflow_run_id`/`skill_snapshot`.
- `backend/app/services/eval_runner_service.py` - additive optional `skill_instructions_override` param on `run_eval_job` -> `_run_arm` -> `_run_arm_body`, forwarded into the `_run_arm_body` RunContext build; passed to the WITH arm only.
- `backend/tests/test_load_skill_override.py` - two async unit tests (override => DRAFT body; None => LIVE body) over `_handle_load_skill` with a pure in-memory supabase fake + stubbed emits.

## Verification
- `pytest tests/test_agent_loop_catalog_override.py` — 3 passed (Deep byte-identical re-affirmed).
- `pytest tests/test_eval_runner.py` — 13 passed (no fork; None-default unchanged).
- `pytest tests/test_load_skill_override.py` — 2 passed (override honored + None => live body).
- Combined run: **18 passed**.
- Source assertions (the wiring the direct-ToolContext unit test cannot reach):
  - `agent_loop.py` non-comment `skill_instructions_override` occurrences = 4 (field + unpack + 2 build kwargs at `:2279`/`:1501`).
  - `tool_dispatcher.py` occurrences = 3 (field + branch).
  - `eval_runner_service.py` non-comment occurrences = 6 (param chain + RunContext build).
  - `task_service.py` carries `skill_instructions_override=parent_ctx.skill_instructions_override`.

## Decisions Made
- Passed the override to the WITH arm ONLY in `run_eval_job` (the WITHOUT arm loads no skill, so it stays default `None`) — clearer intent and defends the pathological case where a WITHOUT-arm LLM guesses the skill name.
- Kept the override keyed on the skill NAME (the arg value `.eq("name", ...)` looks up), matching the plan's Test A (`{"my-skill": "DRAFT BODY"}`).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Worktree carries source but no `venv` (gitignored). Ran the test gates with the main checkout's venv python (`backend/venv/Scripts/python.exe`) executed from the worktree `backend/` dir so `import app...` resolves to the worktree source while third-party deps come from the installed venv. All three gates ran green this way. No code impact.

## Next Phase Readiness
- The override seam is the correctness precondition for the D-05 draft-version-first re-eval and the entire promotion gate. Plan 04 (`PromotionGate`) can now drive a re-eval that measures the DRAFT instructions without touching the live skill.
- SC#10 UAT U5 (135-VALIDATION.md) remains the end-to-end proof that the build-site threading (not just the handler branch) works on the live path.

---
*Phase: 135-self-improvement-loop-si-01*
*Completed: 2026-07-02*
