---
phase: 152-workflow-run-inputs
plan: 01
subsystem: api
tags: [workflow, folder-scope, retrieval, harness, fastapi, pydantic, rls]

# Dependency graph
requires:
  - phase: 098-scope-governance
    provides: resolve_project_subtree / assert_folder_scopes_subset server-side scope resolver + fetch_visible_folders owner gate
  - phase: 092-harness-mode
    provides: create_workflow_run.inputs jsonb channel + kickoff/resume/Continue run-start sites
provides:
  - MessageCreate.folder_id optional per-run KB folder override field (WFIN-02)
  - scope.resolve_run_scope_root() precedence helper (owned-override > author default > thread) + D-05 owner gate + A4 composition guard
  - kickoff persistence of the override into workflow_runs.inputs + helper-delegated scope resolution (threads.py shrink-not-grow)
  - resume + Continue honoring the durable override (Pitfall 5 — no silent revert)
affects: [152-03 Run-modal folder <select> frontend, WFIN-02 SC#10 cross-provider live UAT, 152-VALIDATION]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Precedence-in-a-helper: run-start scope precedence lives in scope.py, callers stay thin (G-5 delegation)"
    - "Owner-reachability gate on untrusted client folder_id (fetch_visible_folders membership; drop-not-trust)"
    - "Durable per-run override read from workflow_runs.inputs at all 3 run-start sites"

key-files:
  created:
    - backend/tests/test_152_folder_override.py
  modified:
    - backend/app/models/message.py
    - backend/app/services/harness/scope.py
    - backend/app/api/threads.py
    - backend/app/services/harness_engine.py
    - backend/app/api/runs.py
    - backend/tests/test_dual_mode_wiring.py

key-decisions:
  - "Override travels in the existing create_workflow_run.inputs jsonb — no migration (D-01)"
  - "project_folder_id stays the author-time retrieval default, unchanged (D-03)"
  - "A never-owned/unreachable override is dropped (no narrowing / refuse), never trusted (D-05)"
  - "Precedence delegated to scope.resolve_run_scope_root so threads.py shrinks, not grows (G-5)"
  - "Override honored identically at kickoff, resume, and Continue via the durable inputs (Pitfall 5)"

patterns-established:
  - "resolve_run_scope_root(definition, *, run_inputs, thread_folder_id, supabase, user_id) -> str | None — returns a scope ROOT, callers still call resolve_project_subtree"
  - "A4 composition guard: for workflows declaring per-phase folder_scope, an override must be within the project subtree or it is dropped"

requirements-completed: [WFIN-02]

# Metrics
duration: 40min
completed: 2026-07-14
---

# Phase 152 Plan 01: WFIN-02 Per-Run Folder-Scope Override (Backend) Summary

**A client-selected `folder_id` now overrides a workflow run's retrieval scope — owner-reachability-gated, layered on the definition's `project_folder_id` author default, resolved server-side so the model cannot widen it, and honored identically at kickoff, resume, and Continue — with no migration.**

## Performance

- **Duration:** ~40 min
- **Started:** 2026-07-14T16:38:00Z
- **Completed:** 2026-07-14T17:17:46Z
- **Tasks:** 3 (+1 deviation fix)
- **Files modified:** 5 modified + 1 created

## Accomplishments
- `MessageCreate.folder_id: UUID | None` — the optional per-run override channel (malformed UUID → FastAPI 422 for free); absence is the byte-identical D-06 path.
- `scope.resolve_run_scope_root()` — a new helper owning the `owned-override > author default > thread` precedence, the D-05 owner-reachability gate (drops a never-owned/unreachable folder_id), and the A4 composition guard (drops an out-of-subtree override for workflows declaring per-phase `folder_scope`). Returns `str | None` (never a set — Pitfall 6).
- Kickoff (`threads.py`) persists the override into `workflow_runs.inputs` jsonb (only when present) and resolves the scope root through the helper — the inline author-default/thread-fallback branch was removed, so `threads.py` **shrank** (G-5 shrink-not-grow gate satisfied). `agent_loop.py` untouched (Landmine 2 RED LINE).
- Resume (`harness_engine._build_resume_context`) and Continue (`runs.py`) now read the override from the durable `workflow_runs.inputs` and route through the same helper — closing Pitfall 5 (a stranded/Continued run no longer silently reverts to the author default). The owner gate re-validates on re-drive, so a since-deleted folder degrades safely.

## Task Commits

1. **Task 1 (RED): failing test for the override resolver** - `219ea5d0` (test)
2. **Task 1 (GREEN): resolve_run_scope_root + MessageCreate.folder_id** - `f700d7a2` (feat)
3. **Task 2: wire the override at kickoff (threads.py)** - `b1e6d18a` (feat)
4. **Task 3: honor the durable override on resume + Continue** - `bc94c4d3` (feat)
5. **Deviation: update F8 source-inspection assertion for the folder_id merge** - `ab84c24e` (test)

_Task 1 followed TDD (RED `219ea5d0` → GREEN `f700d7a2`)._

## Files Created/Modified
- `backend/tests/test_152_folder_override.py` (created) - 8 cases: override-owned, D-05 unowned-refused, D-06 absent-default + unbound whole-KB, A4 in/out-of-subtree, str|None + fetch-once, MessageCreate.folder_id optional.
- `backend/app/models/message.py` - added `folder_id: UUID | None = None` to MessageCreate (WFIN-02, D-01).
- `backend/app/services/harness/scope.py` - added `resolve_run_scope_root()` + `_definition_has_phase_folder_scope()` helper; existing `resolve_project_subtree` / `assert_folder_scopes_subset` untouched.
- `backend/app/api/threads.py` - kickoff persists `folder_id` into `create_workflow_run.inputs`, resolves scope root via the helper (removed inline branch), mirrors `folder_id` into the `wf_ctx` inputs. Net line count decreased (2445 → 2444).
- `backend/app/services/harness_engine.py` - resume `_build_resume_context` parses `run.inputs` up front and layers the override via the helper before `resolve_project_subtree`.
- `backend/app/api/runs.py` - Continue scope block layers the override via the helper; the `scope_resolution_failed` emit gate is now bound-workflow-scoped.
- `backend/tests/test_dual_mode_wiring.py` - updated the F8 source-inspection assertion (see Deviations).

## Decisions Made
- Followed the plan's locked decisions D-01 (inputs jsonb, no migration), D-03 (project_folder_id author default), D-04 (server-side bind), D-05 (owner gate), D-06 (absent = today), Pitfall 5 (all 3 sites), and the G-5 shrink-not-grow gate exactly.
- Kept the thread-folder read unconditional at kickoff (previously lazy in the else-branch) so the helper receives `thread_folder_id` cleanly — a negligible extra query at run start, inside the existing fail-closed envelope.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated a stale source-inspection assertion broken by the Task 2 inputs-dict extension**
- **Found during:** Full-suite baseline delta verification (after Task 3)
- **Issue:** `test_dual_mode_wiring.py::test_live_wf_ctx_sets_inputs_kickoff_prompt_in_source` asserted the exact literal `inputs={"kickoff_prompt": body.content}` in threads.py source. Task 2 extended that dict at both the `create_workflow_run` and `wf_ctx` sites with the `**({"folder_id": ...} if body.folder_id else {})` merge, so the exact literal (with its closing brace) no longer matched. The F8 invariant the test guards (kickoff_prompt wired to body.content at both sites) is still fully satisfied.
- **Fix:** Changed the assertion to require the `"kickoff_prompt": body.content` substring appears at both sites (`src.count(...) >= 2`), preserving the F8 mirror-invariant guard while accommodating the additive folder_id key. Docstring updated to explain the WFIN-02 extension.
- **Files modified:** backend/tests/test_dual_mode_wiring.py
- **Verification:** The updated test + the two related F8 resume tests + the full test_152 suite pass (11 passed). Confirmed this was the ONLY new failure vs the pre-152 base via a controlled non-integration full-suite diff (base 95 → head 96 → this fix → 95; delta 0).
- **Committed in:** ab84c24e

---

**Total deviations:** 1 auto-fixed (1 test-assertion update directly caused by the in-scope Task 2 source change)
**Impact on plan:** No scope creep. The test now faithfully guards the same F8 invariant against the extended dict.

## Issues Encountered
- **Baseline flakiness (not a code issue):** the full backend suite is dominated by `tests/integration/*` that require live Supabase/Redis/workers and are environmentally flaky (a full HEAD run showed 195 failures when services were degraded; the deterministic non-integration tier showed 96 at HEAD vs 95 at the pre-152 base). To get a reliable regression signal I ran a controlled non-integration full-suite diff between HEAD and the pre-152 base (`205d9bcd`) with the new test file excluded at base (its import would otherwise abort the base session). Result: exactly ONE new failure, which was the source-inspection test above — now fixed → 0 net-new failures. The pre-existing `test_harness_gates::test_bounded_retry_reaches_failed_after_3_attempts` (ask_user `tool_call_id` KeyError) was confirmed failing at base too (SEED-056 rot, unrelated to folder scope).

## User Setup Required
None - no external service configuration required. **No migration** (D-01/D-03 — `project_folder_id` has been the retrieval default since Phase 098). Backend restart: the operator should restart uvicorn to pick up the changed modules before live UAT.

## Next Phase Readiness
- The backend override channel is complete and server-enforced end-to-end. **152-03** (Run-modal frontend) can now send `folder_id` on the launch `postMessage` and render the folder `<select>`; the field is accepted and gated.
- **SC#10 cross-provider proof** stays a LIVE UAT authored in `152-VALIDATION.md` (not duplicated as a task here) — the constraint lives at the RPC/tool boundary so provider-uniformity is structural.
- **WFIN-02 NOT marked complete** at the requirement level — it closes at verify-work/secure-phase after the live 4-axis SC#10 UAT (mirrors the 148/149/150/151 false-green-avoidance convention).

## Self-Check: PASSED

All 6 source files + the SUMMARY exist on disk; all 5 task commits (`219ea5d0`, `f700d7a2`, `b1e6d18a`, `bc94c4d3`, `ab84c24e`) are present in history.

---
*Phase: 152-workflow-run-inputs*
*Completed: 2026-07-14*
