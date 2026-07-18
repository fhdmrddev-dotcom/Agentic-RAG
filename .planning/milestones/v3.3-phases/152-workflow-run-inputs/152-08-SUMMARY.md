---
phase: 152-workflow-run-inputs
plan: 08
subsystem: api
tags: [workflow, folder-scope, retrieval, harness, scope-resolver, react, tdd]

# Dependency graph
requires:
  - phase: 152-01
    provides: resolve_run_scope_root + the A4 composition branch this plan corrects
  - phase: 152-06
    provides: the WR-03 per-phase intersection check (this plan restores the membership check 152-06 dropped alongside it)
  - phase: 152-07
    provides: the WorkflowsPage overrideOptions client mirror this plan corrects
provides:
  - "resolve_run_scope_root A4 branch enforces BOTH author-project-subtree membership (necessary) AND per-phase folder_scope intersection (sufficient) — a strict-ancestor/sibling override is dropped server-side"
  - "WorkflowsPage overrideOptions mirrors the author-subtree containment — the Run modal never offers an escaping folder for a folder_scope-declaring bound workflow"
  - "committed strict-ancestor regression tests on both the backend resolver and the frontend option filter"
affects: [152-verification, WFIN-02, folder-scope, workflow-run, retrieval-scope]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Two-condition scope guard: NECESSARY author-subtree membership + SUFFICIENT per-phase intersection, code matching the docstring's 'necessary but NOT sufficient' claim"
    - "Client filter mirrors the server resolver's semantics exactly (defense-in-depth; server remains the authority)"

key-files:
  created: []
  modified:
    - backend/app/services/harness/scope.py
    - backend/tests/test_152_folder_override.py
    - frontend/src/pages/WorkflowsPage.tsx
    - frontend/src/pages/__tests__/RunModal.test.tsx

key-decisions:
  - "Fix ONLY the folder_scope (A4) path; leave the no-per-phase-folder_scope bound path as shipped (152-VERIFICATION truth #2 blessed it, test-locked both sides). Extending containment there would revert deliberately-shipped 152-01 design and break >=4 tests."
  - "Restore the author-project-subtree membership check ALONGSIDE (not replacing) the per-phase intersection — both are necessary."
  - "Use author_root (the str-normalized author default) as the membership root, per the plan's action note."

patterns-established:
  - "A per-run KB-scope override on a scoped bound workflow can never widen retrieval beyond the author project subtree — restores the D-04/WFIN-02 narrow-only contract."

requirements-completed: []  # WFIN-02's BLOCKER is closed, but the requirement stays OPEN at the requirement level per the 148-151 + 152-01..07 false-green-avoidance convention — it closes at re-verification + live SC#10 UAT.

# Metrics
duration: ~15min
completed: 2026-07-15
---

# Phase 152 Plan 08: Author-Project-Subtree Containment Restore Summary

**Restored the "override ⊆ author project subtree" NECESSARY check in resolve_run_scope_root's A4 branch (alongside the per-phase intersection), mirrored it in the Run modal's overrideOptions, and added strict-ancestor regression tests both sides — closing the same-account cross-project scope-widen BLOCKER 152-06's own WR-03 fix introduced.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-07-15T01:04:00Z (approx)
- **Completed:** 2026-07-15T01:08:00Z (approx)
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- **Backend (Task 1):** `resolve_run_scope_root`'s A4 branch now resolves the AUTHOR's project subtree via `resolve_project_subtree(author_root)` and DROPS the override when `override not in project_subtree`, BEFORE the existing per-phase `override_subtree` intersection loop. A strict-ancestor override (e.g. a workspace root holding both the bound project and an unrelated sibling) is dropped server-side and the run resolves to the author default — no sibling-project leak. Docstring updated to name BOTH the NECESSARY (author-subtree membership) and SUFFICIENT (per-phase intersection) conditions so code matches docs.
- **Frontend (Task 2):** `WorkflowsPage` `overrideOptions` intersects candidates with `subtreeOf(authorDefaultFolderId)` (author-subtree membership) before the per-phase filter, so the Run modal's scope `<select>` no longer OFFERS the escaping ancestor/sibling for a folder_scope-declaring bound workflow. The unbound + folder_scope path is unchanged (no author default → containment skipped).
- **Tests:** Committed strict-ancestor regression tests replace the verifier's ad-hoc probe — `test_a4_ancestor_override_dropped` (backend) and the "ancestor override not offered" describe (frontend). Both were confirmed RED against the shipped buggy code, then GREEN after the fix.

## Task Commits

Each task was committed atomically (TDD RED→GREEN verified within each task, one commit per task):

1. **Task 1: Restore author-project-subtree containment in scope.py A4 branch + backend ancestor regression test** — `59c8968b` (fix)
2. **Task 2: Mirror the author-subtree containment in WorkflowsPage overrideOptions + frontend ancestor regression test** — `a6edab25` (fix)

**Plan metadata:** (this SUMMARY + STATE.md + ROADMAP.md commit)

## Files Created/Modified
- `backend/app/services/harness/scope.py` — A4 branch restores `resolve_project_subtree(author_root)` membership check + drops out-of-subtree override before the per-phase loop; docstring names both conditions.
- `backend/tests/test_152_folder_override.py` — added `test_a4_ancestor_override_dropped` (override=R ancestor of P with sibling P2 in R's subtree → resolves to author default P).
- `frontend/src/pages/WorkflowsPage.tsx` — `overrideOptions` adds author-subtree containment (`subtreeOf(authorDefaultFolderId)`) before the per-phase filter; guards `authorDefaultFolderId == null`.
- `frontend/src/pages/__tests__/RunModal.test.tsx` — added the ancestor-override-not-offered describe (bound to P, phase scope [A1]: R and P2 not offered, A1 offered).

## Verification Results
- `cd backend && venv/Scripts/python.exe -m pytest tests/test_152_folder_override.py -q` → **10 passed** (9 existing + new ancestor test).
- Scope-consumer regressions `test_098_scope_governance.py tests/test_141_run_scope.py` → **21 passed** (no regression from the scope.py change).
- `cd frontend && npx vitest run RunModal.test.tsx` → **11 passed** (10 existing + new ancestor test).
- `cd frontend && npm run build` (`tsc -b && vite build`): `tsc -b` surfaces exactly **30** pre-existing SEED-056/049 baseline errors, **0 in the two changed files** (0 net-new); `npx vite build` exits **0**.
- RED LINE check: `git diff --name-only 59c8968b^ HEAD` = exactly the 4 files in `files_modified`; `threads.py`, `agent_loop.py`, and any migration are **UNTOUCHED**.

## Decisions Made
- **Folder_scope-path-only fix (per the plan's `<decision_general_bound_path>`):** corrected only the A4 (folder_scope-declaring) branch; the no-per-phase-folder_scope bound path is intentionally left as-shipped (152-VERIFICATION truth #2 blessed the D-05-owner-gated override there; test-locked on both sides). Extending containment there would revert deliberately-shipped 152-01 design and break >=4 tests.
- **Membership restored alongside (not replacing) the per-phase check** — both are necessary, matching the docstring at scope.py.
- **`author_root` as the membership root** — the already-computed `str(...)`-normalized author default, per the plan action note (the 152-REVIEW block wrote `author_default`; `author_root` is its normalized form).

## Deviations from Plan

None - plan executed exactly as written. Both tasks followed the ready-to-apply fix in 152-REVIEW.md CR-01 and the plan's action blocks verbatim. No auth gates, no package installs, no architectural changes.

## Known Stubs
None — no hardcoded/placeholder values introduced. The fix is pure logic + tests.

## Threat Flags
None new. This plan MITIGATES the T-152-08-01/02/03 register entries (the same-account cross-project retrieval leak) and introduces no new network endpoint, auth path, or schema surface. No migration.

## Pending Follow-up (ORCHESTRATOR ACTION REQUIRED)
Per the plan's `<decision_general_bound_path>` item 4 and STATE.md's existing FOLLOW-UP note: after this fix lands, the orchestrator (not the executor) should ensure a SEED is planted at the next milestone sweep — **"uniform bound-workflow override containment"** — proposing whether ALL bound-workflow overrides (including the no-per-phase-folder_scope path this plan intentionally left as-shipped) should be contained to the author project subtree. That is a genuine product change deserving its own discuss-phase; do NOT lose it. STATE.md already carries this FOLLOW-UP note under Current Position; this SUMMARY re-flags it so it is actioned.

## Issues Encountered
None. The two `LF will be replaced by CRLF` git warnings on the touched files are cosmetic (Windows line-ending normalization), not errors.

## User Setup Required
None - no external service configuration required. **Operator: restart uvicorn** to load the changed `scope.py` before any live UAT (the backend caches the module).

## Next Phase Readiness
- The 152-VERIFICATION.md Gap #1 BLOCKER (WFIN-02 / D-04 narrow-only contract) is closed at both the backend resolver and the frontend option filter, with committed regression tests replacing the verifier's ad-hoc probe.
- **Ready for re-verification:** `/gsd:verify-work 152` (or `--gaps-only`). WFIN-02 stays OPEN at the requirement level until re-verification passes and the live SC#10 4-axis cross-provider UAT (including a scoped-workflow-with-ancestor-override case, per 152-VERIFICATION.md's recommendation) confirms the fix live.
- Two residual WARNINGs (WR-01 TOCTOU, WR-02 `cap_paused` producer match in `workflows.py`) remain deliberately OUT of scope (blocker-first) — deferred per 152-REVIEW.md's own non-blocking classification.

## Self-Check: PASSED

- FOUND: `.planning/phases/152-workflow-run-inputs/152-08-SUMMARY.md`
- FOUND: `backend/app/services/harness/scope.py`, `frontend/src/pages/WorkflowsPage.tsx`
- FOUND commit: `59c8968b` (Task 1), `a6edab25` (Task 2)

---
*Phase: 152-workflow-run-inputs*
*Completed: 2026-07-15*
