---
phase: 152-workflow-run-inputs
plan: 06
subsystem: api
tags: [harness, workflow, folder-scope, retrieval, python, pytest]

# Dependency graph
requires:
  - phase: 152-01
    provides: "resolve_run_scope_root + the A4 composition guard in harness/scope.py (WFIN-02 backend)"
provides:
  - "Corrected A4 branch: resolve_run_scope_root resolves the OVERRIDE's own subtree and drops the override unless EVERY declared per-phase folder_scope still intersects it (WR-03 backend closed)"
  - "A P/A/B two-phase empty-intersection regression test proving the drop (override=A, phase2 folder_scope=[B] under project P -> author default P)"
affects: [152-07, verify-work, secure-phase]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Fail-safe scope degradation: an in-subtree override that would empty ANY phase's folder_scope intersection is dropped to the author default rather than silently emptying that phase's retrieval"

key-files:
  created: []
  modified:
    - "backend/app/services/harness/scope.py - A4 branch of resolve_run_scope_root now resolves resolve_project_subtree(override) and drops the override unless every phase folder_scope intersects it"
    - "backend/tests/test_152_folder_override.py - new test_a4_two_phase_empty_intersection_dropped (P/A/B) + _def_two_phase helper + root-aware mock update on the existing outside-subtree case"

key-decisions:
  - "A4 resolves the OVERRIDE's subtree, not the author subtree — project-subtree membership is necessary but not sufficient (phase_types.py:326 narrows per phase)"
  - "Drop-and-degrade to author default (never a silently-empty phase); a phase with no folder_scope imposes no constraint"
  - "WFIN-02 NOT marked complete at the requirement level (false-green avoidance, 148-151 convention) — this gap plan closes Warning WR-03-backend only; the requirement closes at verify-work/secure-phase after the live SC#10 UAT"

patterns-established:
  - "TDD gap closure: a RED P/A/B test that fails against the shipped (wrong) A4 branch and goes GREEN once the branch resolves the override's own subtree"

requirements-completed: []  # WFIN-02 deliberately left open per false-green-avoidance convention (this plan closes WR-03-backend, not the whole requirement)

# Metrics
duration: ~15min
completed: 2026-07-14
---

# Phase 152 Plan 06: WR-03 Backend — A4 Override-Subtree Intersection Guard Summary

**The per-run folder-scope resolver's A4 branch now resolves the OVERRIDE's own subtree and drops the override unless every declared per-phase `folder_scope` still intersects it — an in-subtree override can no longer silently empty a phase's retrieval.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-07-14T23:36:00Z (approx)
- **Completed:** 2026-07-14T23:45:04Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Closed Warning WR-03 (backend half): `resolve_run_scope_root`'s A4 branch (`scope.py`) now resolves `resolve_project_subtree(override)` and drops the override unless EVERY declared phase `folder_scope` intersects the override's subtree — honoring the per-phase narrowing at `phase_types.py:326-329` that project-subtree membership alone could not.
- Proved the gap with a RED P/A/B two-phase test: project P with two distinct children A, B; phase1 `folder_scope=[A]`, phase2 `folder_scope=[B]`; override=A is inside P's subtree but empties phase2's `[B] ∩ subtree(A)={A}` → must drop to author default P. RED against the shipped branch, GREEN after the fix.
- Kept the good path intact: an override whose subtree covers every phase scope (override=P) is honored; the D-05 owner-reachability gate and the `str | None` return (Pitfall 6) are unchanged.
- RED LINE honored: `threads.py` and `phase_types.py` untouched; no migration; only the two declared files changed.

## Task Commits

Each task was committed atomically (TDD RED → GREEN):

1. **Task 1: Add the failing P/A/B empty-intersection test (RED)** - `bd0053b2` (test)
2. **Task 2: A4 resolves the OVERRIDE subtree, drops it unless every phase scope intersects (GREEN)** - `3f1de56d` (fix)

**Plan metadata:** committed separately (docs: complete plan)

## Files Created/Modified
- `backend/app/services/harness/scope.py` - A4 branch of `resolve_run_scope_root` replaced: resolves `resolve_project_subtree(override)` into a set (None-guarded with `or []`), then iterates `definition.phases` and sets `override = None` if any phase's non-empty `folder_scope` fails to intersect the override subtree. Docstring A4 paragraph updated to describe the per-phase-intersection rule.
- `backend/tests/test_152_folder_override.py` - added `test_a4_two_phase_empty_intersection_dropped` (P/A/B, with a good-path override=P regression lock) + `_def_two_phase` helper; updated the existing `test_a4_override_outside_subtree_dropped` mock to be root-aware (returns `subtree(override)`, not a fixed author subtree) so it stays green under the corrected contract; refreshed the module docstring.

## Decisions Made
- **Resolve the OVERRIDE's subtree, not the author's.** The shipped A4 branch resolved `resolve_project_subtree(author_default)` and dropped the override only when it was OUTSIDE the whole project subtree. That is necessary-but-not-sufficient: `phase_types.py:326` intersects EACH phase's `folder_scope` with the resolved subtree, so an in-subtree override (child A of project P) can still empty a phase whose `folder_scope=[B]`. The fix resolves the override's own subtree and drops it unless every phase scope intersects it (verbatim per 152-REVIEW.md WR-03).
- **Degrade to the author default, never a silently-empty phase.** A dropped override falls through to `author_root` (the existing precedence tail), which is a non-empty declared scope — fail-safe.
- **WFIN-02 stays open at the requirement level** (false-green avoidance, matching every prior 152 plan) — this gap plan closes Warning WR-03-backend; the requirement closes at verify-work/secure-phase after the live SC#10 4-axis UAT. The frontend WR-03 mirror ships in 152-07.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Test-contract fidelity] Updated the existing `test_a4_override_outside_subtree_dropped` mock to be root-aware**
- **Found during:** Task 1 (adding the RED test) / verified in Task 2
- **Issue:** The WR-03 fix changes what the A4 branch resolves — from `resolve_project_subtree(author_default)` to `resolve_project_subtree(override)`. The pre-existing outside-subtree test stubbed `resolve_project_subtree` to return a fixed `[author, child]` list regardless of the root argument. Under the corrected code that stub would report `subtree(override) = {author, child}` (which intersects the phase's `[child]`), so the override would be wrongly honored and the test would flip red.
- **Fix:** Made that test's `_fake_subtree` dispatch on the root — `subtree(override) = {override}` (the isolated out-of-project leaf), author subtree stays `{author, child}`. The test's assertion (override dropped → author default) is unchanged and now matches the true contract. It stays GREEN against BOTH the old and the new code, so it introduced no spurious RED at Task 1.
- **Files modified:** `backend/tests/test_152_folder_override.py`
- **Verification:** Full `test_152_folder_override.py` suite = 8 passed at RED (this test among them) and 9 passed at GREEN.
- **Committed in:** `bd0053b2` (Task 1 commit)

**Note (formatting):** The A4 call is written as a single line (`resolve_project_subtree(override, supabase=supabase, user_id=user_id) or []`) so the WR-03 `grep 'resolve_project_subtree(override'` acceptance check matches. The repo has no black/ruff pre-commit hook (verified — no `.pre-commit-config.yaml`, no active git hooks, no formatter config), so the line is preserved as written.

---

**Total deviations:** 1 auto-fixed (1 test-contract fidelity)
**Impact on plan:** Necessary to keep the pre-existing A4 case valid under the corrected contract; the assertion and behavior it locks are unchanged. No scope creep — no source file beyond the declared `scope.py` was touched.

## Issues Encountered
- None. The plan's `<interfaces>` block and the 152-REVIEW.md WR-03 fix matched the live source exactly; the fix and test went in as specified.

## Verification
- `venv/Scripts/python -m pytest tests/test_152_folder_override.py -q` → **9 passed** (8 pre-existing + the new empty-intersection case; RED before Task 2, GREEN after).
- `grep -n 'resolve_project_subtree(override' backend/app/services/harness/scope.py` → line 162 (A4 branch resolves the override's subtree; no `resolve_project_subtree(author_default` in the A4 branch).
- Scope-consumer regressions green: `test_098_scope_governance` (6), `test_141_run_scope` + `test_098_schema_lock` (18).
- `git diff --name-only bd0053b2^ HEAD` (backend) lists ONLY `scope.py` + `test_152_folder_override.py` — no `threads.py`, no `phase_types.py`, no frontend, no migration.

## User Setup Required
None - no external service configuration required. No migration. **Operator: restart uvicorn** to load the changed `scope.py` module before the live SC#10 UAT.

## Next Phase Readiness
- WR-03 backend half closed and regression-locked. Ready for **152-07** (WR-05 truthful scope label + WR-03 FRONTEND mirror in `WorkflowsPage.tsx` + WR-04 best-effort `deleteThread`) — a disjoint file set, no collision with this plan.
- Phase verification (`/gsd:verify-work 152`) and the live SC#10 4-axis UAT remain the requirement-close gate for WFIN-02.

---
*Phase: 152-workflow-run-inputs*
*Completed: 2026-07-14*
