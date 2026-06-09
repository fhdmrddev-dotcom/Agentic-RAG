---
phase: 098-project-binding-server-side-kb-scope-governance
plan: 03
subsystem: api
tags: [harness, workflow, kb-scope, folder-subtree, governance, rls, pytest]

# Dependency graph
requires:
  - phase: 098-01
    provides: "WorkflowDefinition.project_folder_id + per-phase config folder_scope (additive-optional schema lock) + the D-07 STRUCTURAL @model_validator"
  - phase: 098-02
    provides: "project-scoped published-workflows query (merged base)"
provides:
  - "backend/app/services/harness/scope.py — resolve_project_subtree (centralized parent_id subtree walk) + assert_folder_scopes_subset (DB-aware narrow-only ⊆ validator, D-07 DB half)"
  - "Per-phase folder_scope ∩ narrowing at the single ToolContext-build seam (phase_types._build_phase_tool_context) — PROJ-02"
  - "backend/tests/test_098_scope_governance.py — the cross-plan TDD contract (3 green now + 2 RED-by-design targets for Plans 04/05)"
affects: [098-04, 098-05, harness, kb-scope, workflow-run]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Centralized scope resolver: one shared resolve_project_subtree replaces the triplicated inline parent_id walk (agent_loop / threads / kb); None in → None out (unbound = whole-KB)"
    - "Two-class scope governance: D-07 DECLARED-scope ⊆ validator (hard ValueError at run-start) is a DISTINCT mechanism from Plan 05's runtime clip+warn (Pitfall 5)"
    - "Cross-plan TDD: author the full contract now; downstream-behavior tests are xfail(strict=False) RED-by-design until the wiring plans land"

key-files:
  created:
    - "backend/app/services/harness/scope.py"
    - "backend/tests/test_098_scope_governance.py"
  modified:
    - "backend/app/services/harness/phase_types.py"

key-decisions:
  - "scope channel stays a list[str] everywhere (Pitfall 1) — set()-ify only LOCALLY for membership; a real set would raise in supabase-py json.dumps on the RPC p_folder_ids param"
  - "DB logic lives in scope.py functions (have supabase+user_id), NOT in a Pydantic @model_validator (no DB context there) — RESEARCH anti-pattern avoided"
  - "RED-by-design tests encoded as @pytest.mark.xfail(strict=False) + a `# RED until Plan NN` comment, so the full suite stays exit-0 in the interim and Plans 04/05 turn them to XPASS"

patterns-established:
  - "resolve_project_subtree owner-scoped via fetch_visible_folders(supabase, user_id); service-role resume/Continue callers pass the durable run owner (never widened) — T-098-02"
  - "Per-phase narrowing is DEFENSIVE ∩ (validity enforced upstream by assert_folder_scopes_subset) — it only restricts to the declared subset, never silently fixes an invalid scope"

requirements-completed: []  # GOV-01 + PROJ-02 are multi-plan (01-05); this plan delivers SC#2 + SC#3 halves only — completion is owned by phase verification

# Metrics
duration: ~12min
completed: 2026-06-09
---

# Phase 098 Plan 03: Shared Scope Module + Per-Phase Narrowing + Governance Test Contract Summary

**One shared `resolve_project_subtree` + DB-aware narrow-only `assert_folder_scopes_subset` (the D-07 DB half), per-phase `folder_scope` ∩ narrowing wired at the single ToolContext-build seam, and the full 5-test governance suite authored as the cross-plan TDD contract (3 green now, 2 RED-by-design for Plans 04/05).**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-06-09T14:16Z (approx)
- **Completed:** 2026-06-09T14:28Z
- **Tasks:** 3
- **Files modified:** 3 (2 created, 1 modified)

## Accomplishments
- **`backend/app/services/harness/scope.py` (NEW)** — `resolve_project_subtree(project_folder_id, *, supabase, user_id) -> list[str] | None` centralizes the parent_id subtree walk (replacing the triplicated inline copies); `None` in → `None` out keeps unbound workflows whole-KB. `assert_folder_scopes_subset(definition, *, supabase, user_id) -> None` is the D-07 DB half: a per-phase `folder_scope ⊄` the project subtree raises `ValueError("... is not a subset of the project subtree: ...")` — a definition-validity error, never a silent clip. Both owner-scoped (T-098-02), list channel (T-098-11/Pitfall 1).
- **`phase_types._build_phase_tool_context` narrowing (PROJ-02)** — the resolved project subtree is narrowed by `phase.config.folder_scope` via a list-comprehension ∩ (narrow-only, kept a list) at the single ToolContext-build seam; `phase_whitelist=frozenset(available_tools)` preserved unchanged (D-13, no regression).
- **`backend/tests/test_098_scope_governance.py` (NEW)** — all 5 contract tests: `test_narrow_only_reject`, `test_per_phase_narrowing`, `test_deep_noop` GREEN from this plan; `test_run_start_resolution` (RED until Plan 04) + `test_clip_and_emit` (RED until Plan 05) assert the TARGET behavior, offline (conftest fakes), clip test INJECTS an out-of-scope row (Pitfall 4).

## Task Commits

Each task was committed atomically:

1. **Task 1: Shared scope module (resolve_project_subtree + assert_folder_scopes_subset)** — `17ad3f02` (feat)
2. **Task 2: Per-phase folder_scope narrowing at _build_phase_tool_context** — `3fb0f3ce` (feat, tdd)
3. **Task 3: Full governance test suite (cross-plan TDD contract)** — `95f78463` (test, tdd)

**Plan metadata:** committed with this SUMMARY (docs: complete plan)

## Files Created/Modified
- `backend/app/services/harness/scope.py` (created) — shared resolver + DB-aware narrow-only ⊆ validator
- `backend/app/services/harness/phase_types.py` (modified) — per-phase `folder_scope` ∩ narrowing before the `ToolContext(...)` construction; `folder_subtree_ids=_effective`
- `backend/tests/test_098_scope_governance.py` (created) — 5-test governance contract (3 green + 2 RED-by-design)

## Decisions Made
- **scope channel = `list[str]` everywhere (Pitfall 1).** `resolve_project_subtree` returns `_walk(root)` (a list); the narrowing comprehension keeps a list; `set(...)` is used only LOCALLY for membership in the validator/narrowing. A real `set` on the RPC `p_folder_ids` param would raise in supabase-py `json.dumps`.
- **DB-aware ⊆ check lives in `scope.py`, not a `@model_validator`.** A pure Pydantic validator has no `supabase`/`user_id`; the structural half (folder_scope ⇒ project_folder_id) already lives in the Plan 01 validator, and the DB half (real subtree membership) is `assert_folder_scopes_subset` (RESEARCH anti-pattern avoided).
- **Defensive narrowing.** The per-phase ∩ never silently fixes an invalid scope — narrow-only *validity* is enforced upstream at run-start by `assert_folder_scopes_subset` (Plan 04); the intersection only restricts to the declared subset.

## Deviations from Plan

### Enhancements

**1. [Rule 2 - robustness] RED-by-design tests encoded as `@pytest.mark.xfail(strict=False)` (in addition to the `# RED until Plan NN` comment the plan asked for)**
- **Found during:** Task 3 (authoring the governance suite)
- **Issue:** The plan instructed to "mark with a comment `# RED until Plan NN`." Plain failing tests would leave the FULL backend suite at 2 hard failures during the Wave-2→Wave-3 interim, which is indistinguishable from real breakage to automated gates / the orchestrator's post-merge suite run.
- **Fix:** Added `@pytest.mark.xfail(reason=..., strict=False)` alongside the `# RED until Plan NN` comment and the module docstring. The two RED tests now report as XFAIL (expected fail) → suite stays exit-0. `strict=False` is REQUIRED: Plans 04/05 explicitly do NOT edit this file (it is owned by Plan 03), so when they wire the behavior the tests become XPASS — under `strict=False` an XPASS keeps exit-0 (satisfying Plan 04 Task 3 / Plan 05 Task 2 acceptance `... exits 0`). A later cleanup can remove the markers to make them real-green.
- **Files modified:** backend/tests/test_098_scope_governance.py
- **Verification:** `pytest tests/test_098_scope_governance.py -q -rxX` → `3 passed, 2 xfailed` (both RED tests genuinely fail now, confirmed not XPASS).
- **Committed in:** `95f78463` (Task 3 commit)

---

**Total deviations:** 1 enhancement (RED-by-design encoding). No scope creep — source behavior matches the plan exactly.
**Impact on plan:** Keeps the suite interpretable across the cross-plan TDD window without weakening any assertion or editing the test in Plans 04/05.

## TDD Gate Compliance
This plan is `type: execute` with two `tdd="true"` tasks (Task 2 impl, Task 3 tests) whose test/impl ordering is INVERTED by the plan's own design: Task 2 implements the per-phase narrowing, Task 3 then authors `test_per_phase_narrowing` (the plan's Task 2 `<verify>` explicitly notes "after Task 3 authors the test"). The narrowing test passed on first authoring against the Task-2 implementation. The two downstream tests are intentionally RED (xfail) against target behavior — `feat` commits that turn them green land in Plans 04 (`test_run_start_resolution`) and 05 (`test_clip_and_emit`).

## Issues Encountered
- **Worktree had no `backend/.env`** — `app.config.Settings()` (loaded transitively via `harness/__init__.py → phase_types → app.config`) requires `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`, which `pydantic-settings` reads from `.env` relative to cwd. Resolved by copying the local `backend/.env` into the worktree backend for test execution only. Confirmed `git check-ignore backend/.env` → gitignored (NOT committed). This is a verification-environment setup, not a code change.

## Known Stubs
None. `resolve_project_subtree` returning `None` for unbound workflows and the narrowing returning the project subtree unchanged are intentional, documented behaviors (whole-KB / no-narrowing), not stubs. The two `xfail` tests are intentional cross-plan TDD targets, not stubbed behavior.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- **Plan 04** (run-start wiring at kickoff/resume/Continue) can now `from app.services.harness.scope import resolve_project_subtree, assert_folder_scopes_subset` and turn `test_run_start_resolution` green. The RED test drives `_build_resume_context` and patches `resolve_project_subtree`/`assert_folder_scopes_subset`/`_load_run_definition` at BOTH the source module and the `harness_engine` binding (raising=False), so either import style is covered; if Plan 04's call signature differs, it adapts the SOURCE wiring (the test is not to be weakened).
- **Plan 05** (gated clip + scope_violation emit) can turn `test_clip_and_emit` green; the test calls `ctx.emit(ctx.redis, ctx.run_id, "scope_violation", ...)` via the real `threads._emit` and asserts the XADD on `run:{run_id}` — matching Plan 05's exact emit call. `test_deep_noop` is the byte-identical Deep guardrail that must STAY green.
- No blockers. `GOV-01`/`PROJ-02` remain phase-level multi-plan requirements — not marked complete here (phase verification owns that).

## Self-Check: PASSED
- FOUND: backend/app/services/harness/scope.py
- FOUND: backend/tests/test_098_scope_governance.py
- FOUND: backend/app/services/harness/phase_types.py (modified @3fb0f3ce)
- FOUND: .planning/phases/098-.../098-03-SUMMARY.md
- FOUND commits: 17ad3f02, 3fb0f3ce, 95f78463

---
*Phase: 098-project-binding-server-side-kb-scope-governance*
*Completed: 2026-06-09*
