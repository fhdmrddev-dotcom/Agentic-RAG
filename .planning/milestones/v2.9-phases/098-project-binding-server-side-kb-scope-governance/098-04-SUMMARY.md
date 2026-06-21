---
phase: 098-project-binding-server-side-kb-scope-governance
plan: 04
subsystem: api
tags: [harness, workflow, kb-scope, folder-scope, governance, gov-01, proj-02, resume, continue, retrieval]

# Dependency graph
requires:
  - phase: 098-03
    provides: "backend/app/services/harness/scope.py — resolve_project_subtree + assert_folder_scopes_subset (shared run-start scope resolver + D-07 DB-aware ⊆ validator) and the cross-plan governance contract test (test_098_scope_governance.py)"
  - phase: 092
    provides: "create_workflow_run (persists definition + inputs); _build_resume_context + _harness_continuation ctx-build sites"
  - phase: 092.5
    provides: "provider gateway boundary — shared retrieval path the bound scope feeds"
provides:
  - "Run-start retrieval scope sourced server-side from the workflow's project binding at all THREE harness ctx-build sites (live kickoff, resume sweep, Continue) — the model can never widen it"
  - "Resume + Continue scope-bypass closed: folder_subtree_ids=None whole-KB gap (harness_engine.py:1199 + runs.py:915) now resolves from definition.project_folder_id"
  - "D-07 narrow-only declared-scope enforcement at run-start (assert_folder_scopes_subset) at each site — non-⊆ kickoff definition fails loudly as 400"
  - "threads.py shrunk: inline recursive _wf_get_subtree walk removed in favor of the shared helper (G-5)"
  - "test_harness_resume.py resume project-scope coverage (bound resolves subtree; unbound stays None)"
affects: [099, 101, 102, 103, 104, harness-retrieval, kb-scope]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Run-start scope resolution: server resolves the allowed subtree from the binding BEFORE any retrieval; the model never supplies folder_subtree_ids"
    - "Lazy import of app.services.harness.scope inside functions (harness-package cycle-safe pattern, harness_engine.py:104-109) — the governance test patches the source module so the fake is still picked up"
    - "Owner-scoped service-role resolution: resume/Continue pass the durable run owner (str(run user_id) / verified current_user) to fetch_visible_folders so the RLS-bypassed path can't reach another user's folders"
    - "Defensive getattr(definition, 'project_folder_id', None) so stubbed sentinel definitions in tests and real WorkflowDefinitions both flow through one path"

key-files:
  created: []
  modified:
    - "backend/app/api/threads.py — kickoff (site 1): sources scope from _kickoff_definition.project_folder_id; D-07 assert at parse; inline _wf_get_subtree removed"
    - "backend/app/services/harness_engine.py — resume (site 2): _build_resume_context resolves the project subtree instead of None (owner-scoped, best-effort)"
    - "backend/app/api/runs.py — Continue (site 3): _harness_continuation pre-resolves _cont_subtree from definition.project_folder_id (never blocks the Continue)"
    - "backend/tests/test_harness_resume.py — resume project-scope tests (bound → subtree; unbound → None)"

key-decisions:
  - "All three ctx-build sites resolve run-start scope from the binding via the shared scope.py helper; unbound/legacy workflows keep prior behavior (thread-folder at kickoff, None elsewhere) — SC#1 byte-compatibility"
  - "D-07 is enforced loudly (400) only at kickoff; resume + Continue re-assert defensively inside best-effort try/except so a resolution failure never strands the resume sweep / blocks the Continue"
  - "Lazy-import the scope helpers in harness_engine (not module-level) to respect the established harness-package circular-import guard; the governance test patches the source module so wiring is still exercised"

patterns-established:
  - "Run-start KB scope is a server-resolved binding, not a prompt/model input — applies to every future workflow-run-bearing phase"
  - "Service-role retrieval paths MUST pass the durable run owner to the scope resolver (owner-scope is the only guard when RLS is bypassed)"

requirements-completed: [GOV-01, PROJ-02]

# Metrics
duration: 11min
completed: 2026-06-09
---

# Phase 098 Plan 04: Run-Start KB Scope from the Project Binding (All Three Harness Sites) Summary

**Server-side run-start retrieval scope is now resolved from the workflow's project binding at live kickoff, resume sweep, and Continue — closing the post-restart whole-KB scope-bypass (GOV-01) and binding retrieval to the project the model cannot widen (PROJ-02).**

## Performance

- **Duration:** ~11 min
- **Started:** 2026-06-09T18:38:03+04:00
- **Completed:** 2026-06-09T18:48:33+04:00
- **Tasks:** 3 (Task 3 verification-only)
- **Files modified:** 4 (+ 1 deferred-items log)

## Accomplishments
- **Site 1 (kickoff, threads.py):** a bound workflow's run-start scope is sourced from `_kickoff_definition.project_folder_id` (not the thread folder); unbound/legacy workflows keep thread-folder scope. Declared per-phase `folder_scope` is validated ⊆ the project subtree at parse (D-07) — a non-⊆ definition fails loudly as a 400. The inline recursive `_wf_get_subtree` walk was removed in favor of `scope.resolve_project_subtree` (G-5: threads.py shrank).
- **Site 2 (resume, harness_engine.py):** `_build_resume_context` resolves `folder_subtree_ids` from the run's `definition.project_folder_id` (was hard-coded `None` → whole-KB). Owner-scoped via the durable run owner on the service-role path; best-effort so a resolution failure never strands the resume sweep.
- **Site 3 (Continue, runs.py):** `_harness_continuation` pre-resolves `_cont_subtree` from the definition before the background-task closure (was `None`). Wrapped to never block the Continue.
- **Governance contract green:** the Plan 03 RED `test_run_start_resolution` now passes (XPASS, strict=False) via the source wiring — with **zero edits** to `test_098_scope_governance.py`. New `test_harness_resume.py` tests pin the resume bound→subtree / unbound→None behavior.

## Task Commits

1. **Task 1: Kickoff (site 1) — source run-start scope from the binding** — `8c4922c8` (feat)
2. **Task 2: Close resume + Continue scope gaps** (TDD):
   - RED: `cf7d7dee` (test) — failing resume project-scope tests
   - GREEN: `a1bd6c5b` (feat) — sites 2+3 wired
   - Fix: `fc31bcf2` (fix) — defensive `getattr` for sentinel definitions (Rule 1)
3. **Task 3: Green the run-start governance test** — verification-only (no new commit; satisfied by Tasks 1+2 wiring)

**Out-of-scope log:** `d9aa2bfb` (docs: deferred-items)

## Files Created/Modified
- `backend/app/api/threads.py` — kickoff scope from binding + D-07 assert at parse; inline subtree walk removed
- `backend/app/services/harness_engine.py` — `_build_resume_context` resolves project subtree (owner-scoped, lazy-imported helpers)
- `backend/app/api/runs.py` — `_harness_continuation` pre-resolves `_cont_subtree`; never blocks the Continue
- `backend/tests/test_harness_resume.py` — resume project-scope coverage
- `.planning/phases/098-.../deferred-items.md` — logged a pre-existing out-of-scope test failure

## Decisions Made
- **Lazy-import the scope helpers in harness_engine** rather than module-level: a top-level import of anything under `app.services.harness` runs the package `__init__` → `phase_types.register_all()` → imports back `PHASE_TYPE_REGISTRY` before it is bound (circular import; documented at harness_engine.py:104-109). The governance test patches the source module `app.services.harness.scope.*`, so the lazy import still picks up the fake. The plan's suggested module-level import was tried first and reverted when it triggered exactly this cycle.
- **D-07 loud-vs-best-effort split:** kickoff surfaces a non-⊆ definition as a 400 (a definition-validity error); resume/Continue re-assert inside best-effort try/except (the definition was already validated at save time, and the overriding constraint is "never strand the sweep / never block the Continue").
- **getattr for `project_folder_id`** at both resume + Continue so stubbed sentinel definitions (tests) and real `WorkflowDefinition`s share one code path.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Defensive `getattr` for sentinel definitions at the Continue + resume sites**
- **Found during:** Task 2 (regression sweep)
- **Issue:** Several harness tests stub `_load_run_definition` to return a bare `object()` sentinel (no `project_folder_id`). The Continue site read `definition.project_folder_id` directly OUTSIDE its try/except → `AttributeError`, breaking the pre-existing `test_continue_accepts_workflow_run_id_post_reload_no_404`.
- **Fix:** `getattr(definition, 'project_folder_id', None)` at both the Continue and resume sites (resume was already shielded by its try/except but the same change removes spurious error-log noise on sentinel definitions).
- **Files modified:** backend/app/api/runs.py, backend/app/services/harness_engine.py
- **Verification:** `test_continue_accepts_workflow_run_id_post_reload_no_404` + the full harness sweep (88 passed) green.
- **Committed in:** `fc31bcf2`

**2. [Plan note] Module-level scope import reverted to a lazy import**
- **Found during:** Task 2 (import verification)
- **Issue:** The plan's interface snippet imported `resolve_project_subtree`/`assert_folder_scopes_subset` at module scope in harness_engine; this triggered the documented `app.services.harness` package circular import (`cannot import name 'PHASE_TYPE_REGISTRY'`).
- **Fix:** Moved to a lazy import inside `_build_resume_context` (the established harness-package pattern) and patched the test at the source module to match. Behavior + governance-test outcome unchanged.
- **Files modified:** backend/app/services/harness_engine.py, backend/tests/test_harness_resume.py
- **Verification:** `import app.services.harness_engine` exits 0; governance + resume tests green.
- **Committed in:** `a1bd6c5b`

---

**Total deviations:** 1 Rule-1 auto-fix + 1 plan-interface adjustment (circular-import-safe import style).
**Impact on plan:** No scope creep — both are correctness/wiring adjustments needed to land the planned behavior cleanly. All three sites source scope from the binding exactly as specified.

## Issues Encountered
- **Pre-existing, out-of-scope:** `test_harness_gates.py::test_bounded_retry_reaches_failed_after_3_attempts` fails (`KeyError: 'tool_call_id'` in `_expire_pending_ask_user`). Proven to fail at the plan base commit `1d2fd7cd` via a throwaway base worktree — NOT caused by 098-04 (which never touches `_expire_pending_ask_user`, the retry-audit path, or the `test_harness_gates` fixtures). Logged to `deferred-items.md`; not fixed.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- GOV-01 (server-side run-start scope resolution) + PROJ-02 (scope-from-binding across restart) are satisfied at all three sites. SC#3 (run-start half of GOV-01) holds.
- Plan 05 owns the runtime `scope_violation` clip + emit in `_handle_search_documents` (`test_clip_and_emit` is still xfail/RED by design) — this plan's `folder_subtree_ids` is the value Plan 05 clips against.
- Phase 099+ workflow-run-bearing phases inherit the bound run-start scope automatically.

## Self-Check: PASSED

All claimed files exist on disk and all task commits are present in the worktree branch history:
- Files: `098-04-SUMMARY.md`, `deferred-items.md`, `threads.py`, `harness_engine.py`, `runs.py`, `test_harness_resume.py` — all FOUND
- Commits: `8c4922c8`, `cf7d7dee`, `a1bd6c5b`, `fc31bcf2`, `d9aa2bfb` — all FOUND
- Governance contract: `test_run_start_resolution` XPASS (exit 0); `test_098_scope_governance.py` unmodified by this plan (empty diff vs base)
- Final verification: `pytest tests/test_harness_resume.py tests/test_098_scope_governance.py -k "not clip_and_emit"` → 20 passed, 1 xpassed, exit 0

---
*Phase: 098-project-binding-server-side-kb-scope-governance*
*Completed: 2026-06-09*
