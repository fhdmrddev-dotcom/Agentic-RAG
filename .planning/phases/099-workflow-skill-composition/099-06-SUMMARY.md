---
phase: 099-workflow-skill-composition
plan: 06
subsystem: api
tags: [harness, workflow, skill-snapshot, tool-dispatcher, sub-agent, regression-test, pytest]

# Dependency graph
requires:
  - phase: 099-workflow-skill-composition
    provides: "ToolContext.skill_snapshot field (Plan 099-01), the materializer + gated read_skill_file snapshot gate (Plan 099-03), and _build_phase_tool_context attaching skill_snapshot onto the parent phase ctx (phase_types.py:271)"
  - phase: 096
    provides: "the 096-02 phase_whitelist sub_ctx wiring fix (the exact structural-unreachability precedent) and the test_096_ci_workflow_regression live-chain harness (ScriptedGateway + _make_workflow_ctx + _TOOL_REGISTRY leaf-substitution pattern)"
provides:
  - "run_task_sub_agent propagates parent_ctx.skill_snapshot onto the sub_ctx ToolContext, making the snapshot-routing gate at tool_dispatcher.py:479 reachable on the live harness path"
  - "test_099_snapshot_routing_live_chain — a live-chain regression lock proving read_skill_file resolves against the immutable snapshot copies on the real run_task_sub_agent -> dispatch_tool chain"
affects: [099-verification, workflow-skill-composition, harness-skill-phases]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Sub-agent ctx field propagation: every harness-relevant ToolContext field that the parent phase ctx carries must be re-propagated onto the fresh sub_ctx in run_task_sub_agent (the dispatch actually runs on sub_ctx) — None-default keeps Deep dispatch byte-identical"
    - "Live-chain regression lock via leaf-substitution + ctx-capture sentinel: assert WHAT CTX the real dispatch chain handed the leaf, never patching run_task_sub_agent"

key-files:
  created: []
  modified:
    - "backend/app/services/task_service.py — added skill_snapshot=parent_ctx.skill_snapshot to the run_task_sub_agent sub_ctx ToolContext construction"
    - "backend/tests/test_096_ci_workflow_regression.py — added test_099_snapshot_routing_live_chain"

key-decisions:
  - "Used direct attribute access parent_ctx.skill_snapshot (matching the adjacent phase_whitelist / workflow_run_id style) — the parent IS a ToolContext carrying the field with a None default since Plan 099-01, so attribute access is safe and the propagation is a literal no-op for every Deep/tasks caller"
  - "Regression-test approach: substitute only the read_skill_file leaf (via _TOOL_REGISTRY) and capture ctx.skill_snapshot, keeping the real dispatch_tool routing/whitelist guard and the real run_task_sub_agent executor seam intact — mirrors the 096 handler_reached sentinel pattern rather than routing through _handle_read_skill_file (which would require a fake Storage ctx)"
  - "Single-branch llm_batch_agents phase: with no upstream split_topic sub-questions, _exec_llm_batch_agents degrades to one sub-agent on the prompt — sufficient to exercise the run_task_sub_agent -> dispatch_tool chain"

patterns-established:
  - "Pattern: sub_ctx field-propagation completeness — when adding a harness-routing field to ToolContext, audit run_task_sub_agent for the propagation; the dispatch gate runs on sub_ctx, not the parent phase ctx"
  - "Pattern: snapshot-passed-as-JSON-dict — phase config skill_snapshot is supplied to build_workflow_definition as snap.model_dump(mode='json'); WorkflowDefinition.model_validate coerces it back to the SkillSnapshot model"

requirements-completed: [WFSKILL-01]

# Metrics
duration: 22min
completed: 2026-06-10
---

# Phase 099 Plan 06: Skill-Snapshot Sub-Agent Propagation (CR-02 Gap Closure) Summary

**run_task_sub_agent now propagates parent_ctx.skill_snapshot onto the sub_ctx ToolContext, making the snapshot-routing gate at tool_dispatcher.py:479 reachable on the live harness path — read_skill_file resolves against the immutable snapshot copies (restoring D-01 immutability), regression-locked by a live-chain test that fails pre-fix and passes post-fix.**

## Performance

- **Duration:** 22 min
- **Started:** 2026-06-10T06:11:00Z
- **Completed:** 2026-06-10T06:34:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- **CR-02 closed (verification truth #6, BLOCKER):** added a single `skill_snapshot=parent_ctx.skill_snapshot` field to the `sub_ctx = ToolContext(...)` construction in `run_task_sub_agent`. The harness phase-ctx builder set the snapshot on the PARENT phase ctx only (`phase_types.py:271`), but every harness tool call dispatches with `sub_ctx` — so the snapshot gate at `tool_dispatcher.py:479` was structurally dead code on the live path (the same unreachability class as the 096-02 `phase_whitelist` fix).
- **Live-chain regression lock added:** `test_099_snapshot_routing_live_chain` drives the REAL `harness_engine.run_workflow` -> REAL `run_task_sub_agent` -> REAL `dispatch_tool` through the `ScriptedGateway`, scripts a `read_skill_file` tool call in a skill-bearing `llm_batch_agents` phase, and asserts the substituted leaf received a non-None `ctx.skill_snapshot` matching the materialized snapshot's `storage_prefix`.
- **Regression lock empirically verified to bite:** temporarily reverting the Task-1 line made ONLY the new test fail with `captured["snapshot"] is None` and the CR-02 message; the leaf-reached guard (`!= "UNSET"`) still passed, proving the lock isolates the propagation defect, not dispatch reachability.
- **Deep dispatch byte-identical confirmed:** `parent_ctx.skill_snapshot` is `None` for every Deep-Mode / tasks caller (the dataclass default), so the propagation is a literal no-op outside workflow skill phases. The existing 096 + 085 task_service suites pass unchanged.

## Task Commits

Each task was committed atomically:

1. **Task 1: Propagate skill_snapshot onto the sub_ctx in run_task_sub_agent** — `75b67eff` (fix)
2. **Task 2: Add a live-chain regression test proving the snapshot reaches dispatch_tool** — `c13e7e74` (test)

_Plan metadata commit (SUMMARY.md) follows this summary._

## Files Created/Modified
- `backend/app/services/task_service.py` — added `skill_snapshot=parent_ctx.skill_snapshot` (with a CR-02 / 096-02-precedent comment) to the `run_task_sub_agent` sub_ctx ToolContext construction, immediately after `workflow_run_id=parent_ctx.workflow_run_id,`. +11 lines.
- `backend/tests/test_096_ci_workflow_regression.py` — added `test_099_snapshot_routing_live_chain` after `test_096_whitelist_refusal`. +138 lines. Reuses the file's existing infra (`ScriptedGateway`, `_make_workflow_ctx`, `_tool_call_events`, `_final_events`, `_has_tool_result`, `_make_get_pool`, `_fake_capability`, `_TOOL_REGISTRY`, the `_ensure_real_executors` autouse fixture, the `build_workflow_definition` fixture). Imports `SkillSnapshot` from `app.models.harness` locally inside the test.

## Decisions Made
- Direct attribute access `parent_ctx.skill_snapshot` (not `getattr`) — the parent is a `ToolContext` with the field defaulted `None` since Plan 099-01, matching the adjacent `phase_whitelist` / `workflow_run_id` style.
- Sentinel-captures-ctx regression approach over routing through the real `_handle_read_skill_file` gate (which would need a fake Storage on the ctx) — the cleaner lock that directly mirrors the 096 `handler_reached` sentinel and asserts on the exact sub_ctx the fix populates.
- Pass the phase-config `skill_snapshot` as `snap.model_dump(mode="json")` — `WorkflowDefinition.model_validate` coerces the dict back to the `SkillSnapshot` model.
- Single-branch `llm_batch_agents` phase (no upstream `split_topic`) — `_exec_llm_batch_agents` degrades to one sub-agent on the prompt, sufficient to exercise the chain (mirrors the `max_parallel_agents: 5` shape of `test_096_whitelist_refusal`).

## Deviations from Plan

None - plan executed exactly as written. The fix landed at the exact location the plan's `<interfaces>` specified (after `workflow_run_id`, before the closing `)`); the test follows the prescribed 7-step build precisely.

## Issues Encountered
- **Worktree stale base:** the worktree branch was forked from an older base (a v2.7 merge commit) rather than the feature branch HEAD `d96ef865`. The expected base was NOT an ancestor of HEAD. Corrected with `git reset --hard d96ef865...` per the worktree branch-check protocol (safe — fresh worktree, no user changes), verified the reset landed before doing any work.
- **No venv in worktree:** the worktree does not carry the gitignored `backend/venv`. Ran pytest with the main checkout's interpreter (`C:/Vibe Apps/Agentic RAG/backend/venv/Scripts/python.exe`) from the worktree's `backend/` CWD; confirmed via `app.services.task_service.__file__` that Python resolved the worktree copy (with the fix), so all test runs exercised the worktree source.

## Verification

All commands run from the worktree `backend/` with the main venv interpreter:

- `pytest tests/test_096_ci_workflow_regression.py -q` → **5 passed** (4 original + the new test)
- `pytest tests/unit/test_085_task_service.py tests/test_099_skill_composition.py -q` → **53 passed**
- New test in isolation → **1 passed**
- Regression-lock proof (Task-1 line temporarily reverted) → **1 failed** with `assert None is not None` / the CR-02 message; restored and re-confirmed green.

Net-new failures vs the plan's stated baseline: **0**. No pre-existing rot touched.

## Threat Model Disposition
- **T-099-CR02-01 (Tampering/Integrity, D-01) — mitigated:** snapshot now reaches `sub_ctx`, the gate is reachable, reads resolve against the immutable snapshot copies. Regression-locked by `test_099_snapshot_routing_live_chain`.
- **T-099-CR02-02 (red line — Deep byte-identical) — mitigated:** `parent_ctx.skill_snapshot` is `None` for every Deep/tasks caller; the existing 096 + 085 suites pass unchanged.
- **T-099-CR02-03 (wrong-skill routing) — accepted:** pre-existing IN-02, out of scope for this gap closure (the snapshot manifest membership check still rejects unknown filenames).

No new security surface introduced (no new endpoints, auth paths, file access, or schema changes).

## Next Phase Readiness
- Verification truth #6 ("read_skill_file routes to snapshot copies when ctx.skill_snapshot is present on the live harness path") is now satisfied — ready for 099 re-verification.
- The companion CR-01 gap is plan 099-05 (separate worktree); the orchestrator owns STATE.md / ROADMAP.md updates after all wave agents complete.

## Self-Check: PASSED

- FOUND: `.planning/phases/099-workflow-skill-composition/099-06-SUMMARY.md`
- FOUND: commit `75b67eff` (Task 1 — fix)
- FOUND: commit `c13e7e74` (Task 2 — test)
- FOUND: `skill_snapshot=parent_ctx.skill_snapshot` in `task_service.py` at the Task 1 commit
- FOUND: `def test_099_snapshot_routing_live_chain` in `test_096_ci_workflow_regression.py` at the Task 2 commit

---
*Phase: 099-workflow-skill-composition*
*Completed: 2026-06-10*
