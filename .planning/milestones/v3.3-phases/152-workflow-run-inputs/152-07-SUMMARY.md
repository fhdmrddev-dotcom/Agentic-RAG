---
phase: 152-workflow-run-inputs
plan: 07
subsystem: ui
tags: [react, workflows, run-modal, folder-scope, honesty-ui, orphan-cleanup, tdd, vitest]

# Dependency graph
requires:
  - phase: 152-03
    provides: The shipped RunModal <select> + doRun launch path this plan corrects (WR-05/WR-03/WR-04 build ON TOP; 03's code stays)
  - phase: 152-06
    provides: The backend A4 override-subtree per-phase guard (scope.py resolve_run_scope_root) that WR-03's frontend mirror matches byte-for-intent
provides:
  - Truthful bound/unbound KB-scope label in the RunModal (WR-05) — bound reads "Workflow default", only unbound reads "All documents"
  - Frontend A4 per-phase override filter (WR-03 mirror) — drops any override whose subtree empties a declared phase folder_scope
  - Best-effort deleteThread on a failed launch (WR-04) — no orphan thread per retry, verbatim-422 surfacing preserved
affects: [verify-work-152, WorkflowsPage, RunModal, ChatLayout, workflow-run-scope]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Honesty-first scope label: the '' option truthfully names the server-applied scope (bound=workflow default, unbound=whole-KB) — never a widen lie the narrow-only resolver can't honor"
    - "Client mirror of a server composition guard: per-candidate subtree ∩ every declared phase folder_scope (mirrors scope.py A4), computed client-side from the folders prop"
    - "Best-effort launch cleanup: try/catch around the post-create launch steps, fire-and-forget deleteThread().catch(()=>{}) then re-throw so the user-facing error surface is never masked"

key-files:
  created: []
  modified:
    - frontend/src/pages/WorkflowsPage.tsx
    - frontend/src/components/layout/ChatLayout.tsx
    - frontend/src/pages/__tests__/RunModal.test.tsx
    - frontend/src/components/layout/__tests__/ChatLayoutLaunch.test.tsx
    - frontend/src/pages/WorkflowsPage.test.tsx

key-decisions:
  - "WR-05: distinguish bound vs unbound by authorDefaultFolderId truthiness (NOT authorDefaultExists) — authorDefaultExists is false when the author folder is merely invisible, which was the exact mislabel source (invisible author folder → old code defaulted to 'All documents' while the run was author-scoped)"
  - "WR-05: initial selectedFolderId is '' in EVERY case — for a bound workflow '' now truthfully IS the workflow default; the duplicate explicit author-default <option> is removed"
  - "WR-03 mirror: the frontend now intersects each phase folder_scope with the CANDIDATE folder's OWN subtree (not the author subtree) — matching the backend 152-06 fix; membership in the author subtree is necessary but not sufficient"
  - "WR-04: cleanup is fire-and-forget (deleteThread(...).catch(()=>{})) and the original error is re-thrown, so the modal's verbatim-422 role='alert' surface never regresses"
  - "Requirements WFIN-01/WFIN-02 stay OPEN at the requirement level (false-green avoidance, 148-151 + 152-01..06 convention) — they close at verify-work/secure-phase after the live SC#10 4-axis UAT"

patterns-established:
  - "Truthful scope label pattern: label the '' option by the server-applied scope, guarded on the binding's truthiness"
  - "Per-candidate subtree composition filter as the client mirror of a backend narrow-only guard"

requirements-completed: []  # WFIN-01/02 intentionally NOT closed here — false-green avoidance; close at verify-work/secure-phase

# Metrics
duration: ~20min
completed: 2026-07-15
---

# Phase 152 Plan 07: Run-modal honesty + launch hygiene (WR-05 / WR-03 frontend / WR-04) Summary

**Closed three shipped-Run-modal Warnings frontend-only: the KB-scope select now tells the truth (bound reads "Workflow default", only unbound reads "All documents"), the override list mirrors the backend A4 per-phase folder_scope guard, and a failed launch best-effort deletes its created thread instead of orphaning one per retry.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-07-14T23:53:00Z
- **Completed:** 2026-07-15T00:03:19Z
- **Tasks:** 3 (Task 1 TDD → RED + GREEN)
- **Files modified:** 5 (all frontend; no backend, no migration, no new packages)

## Accomplishments
- **WR-05 (truthful scope label):** the RunModal `<select>`'s `""` option now labels the actual server-applied scope. A bound workflow reads `Workflow default — 📁 {folder}` (bare `Workflow default` when the author folder is invisible — the exact mislabel case), and only an unbound workflow (no `project_folder_id`) reads `All documents`, where `folderId:null` genuinely means whole-KB. The duplicate explicit author-default option is gone; initial selection is `""` in every case.
- **WR-03 (frontend A4 mirror):** `overrideOptions` now resolves each candidate folder's OWN subtree and keeps it only when EVERY declared phase `folder_scope` still intersects it — mirroring the backend `scope.py resolve_run_scope_root` (152-06). An override that would silently empty a declared phase is never offered; no-scope workflows are unchanged.
- **WR-04 (orphan cleanup):** `doRun` wraps the post-create launch steps (upload + postMessage) in try/catch; on failure it best-effort `deleteThread(thread.id)` (fire-and-forget) then re-throws the original error, so no orphan thread accrues per retry and the modal still renders the server's 422 verbatim.
- Each behavior is test-locked: 35/35 across `RunModal.test` (10), `WorkflowsPage.test` (23), `ChatLayoutLaunch.test` (2). `npx vite build` exit 0; **0 net-new tsc errors** vs the captured 30-error SEED-056/049 baseline.

## Task Commits

Each task was committed atomically:

1. **Task 1 (WR-05) — RED: truthful bound/unbound scope label test** - `48fce37b` (test)
2. **Task 1 (WR-05) — GREEN: truthful scope label in RunModal** - `8e1f06b9` (feat, incl. the WorkflowsPage.test deviation fix)
3. **Task 2 (WR-03) — A4 per-phase override filter mirror** - `42e15e13` (feat)
4. **Task 3 (WR-04) — best-effort deleteThread on failed launch** - `a052d30d` (feat)

**Plan metadata:** (final metadata commit — SUMMARY + STATE + ROADMAP)

## Files Created/Modified
- `frontend/src/pages/WorkflowsPage.tsx` — WR-05 truthful `""` scope label (conditional on `authorDefaultFolderId` truthiness) + removed duplicate author-default option + initial `selectedFolderId=""`; WR-03 `overrideOptions` per-candidate subtree ∩ every phase `folder_scope` (removed the unused `subtreeIds` author-subtree walk, added `phaseFolderScopes`); updated the handleRun honesty comment.
- `frontend/src/components/layout/ChatLayout.tsx` — WR-04 `doRun` try/catch around upload+postMessage, fire-and-forget `deleteLaunchThread(thread.id)` in the catch then re-throw; success path (loadThreads → selectThread → onNavigate) kept OUTSIDE the try; imports the raw `deleteThread` aliased to avoid shadowing the `useThreads()` binding.
- `frontend/src/pages/__tests__/RunModal.test.tsx` — WR-05 bound-visible / bound-invisible / unbound label cases (+ `unboundPublished` fixture); WR-03 P/A/B two-phase case (neither A nor B offered, P kept) (+ `phaseScopedFolders`/`phaseScopedPublished` fixtures).
- `frontend/src/components/layout/__tests__/ChatLayoutLaunch.test.tsx` — WR-04 failed-launch cleanup assertion (deleteThread called with the created id + verbatim error still surfaces) + no-cleanup-on-success invariant; added `deleteThread`/`uploadWorkspaceTemplate` to the api mock.
- `frontend/src/pages/WorkflowsPage.test.tsx` — **[deviation]** updated the select-order case that locked the old `All documents`-first contract to the new WR-05 truthful-label contract.

## Decisions Made
- Bound-vs-unbound is keyed on `authorDefaultFolderId` truthiness, not `authorDefaultExists` — the latter is false for an *invisible* author folder, which is precisely the state the old code mislabelled as whole-KB. This makes the bound-invisible case read a bare `Workflow default` (still truthful) rather than the `All documents` lie.
- The WR-03 frontend filter intersects against each **candidate's** own subtree (not the author subtree), exactly matching the backend 152-06 semantics; the `subtreeIds` author-subtree walk it replaced was removed to avoid a net-new unused-local tsc error.
- WFIN-01/WFIN-02 are NOT marked complete at the requirement level — false-green avoidance per the 148-151 + 152-01..06 convention; they close at verify-work/secure-phase after the live SC#10 4-axis cross-provider UAT (`152-VALIDATION.md`).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated the pre-existing WorkflowsPage.test.tsx select-order case that locked the obsolete "All documents"-first contract**
- **Found during:** Task 1 (WR-05 GREEN)
- **Issue:** `WorkflowsPage.test.tsx:305-324` asserted the old contract (`scope.value === "folder-aaa"`, `optionText[0] === "All documents"`, a separate `workflow default`-tagged option) that the WR-05 source change correctly obsoletes. Left unchanged it would fail red against correct new behavior. `WorkflowsPage.test.tsx` is not in the plan's declared `files_modified`, but the source change is correct and the test locked the now-wrong contract (same class as the 152-03 test-contract deviation).
- **Fix:** Rewrote the assertions to the new WR-05 contract — bound `""` option reads `Workflow default — 📁 DBA Chapters`, is the resting selection (`scope.value === ""`), and no `All documents` option exists.
- **Files modified:** frontend/src/pages/WorkflowsPage.test.tsx
- **Verification:** `WorkflowsPage.test.tsx` 23/23 green; 0 net-new tsc errors.
- **Committed in:** `8e1f06b9` (part of the Task 1 GREEN commit)

---

**Total deviations:** 1 auto-fixed (1 bug — obsolete test contract).
**Impact on plan:** The deviation is the expected consequence of a truthful-label source change on a test that locked the old label; no scope creep, no backend touch, no new files beyond the declared four + this one test.

## Issues Encountered
- None. The TDD RED for Task 1 produced a genuine 2-failure red (the two bound cases; the unbound case is stable across old/new by design). The known SEED-056/049 pre-existing tsc baseline (30 errors, incl. a pre-existing `ChatLayoutLaunch.test.tsx` missing-props error) was left untouched — verified 0 net-new after normalizing line-number shifts.

## User Setup Required
None — no external service configuration, no migration, no new packages.

## Next Phase Readiness
- All three gap-closure plans (152-05 backend CR-01/WR-01, 152-06 backend WR-03, 152-07 frontend WR-05/WR-03/WR-04) are executed. The phase is ready for `/gsd:verify-work 152`.
- **Operator note:** these are frontend-only changes — no uvicorn restart needed for 152-07 (the 152-05/06 backend changes still require the restart flagged in their notes before the live UAT).
- **Live proof still pending:** WFIN-01/02/03 close at verify-work/secure-phase after the live SC#10 4-axis cross-provider destructive-delete + scope-override UAT authored in `152-VALIDATION.md`. This plan is honesty + hygiene test-locked; the lived-experience verification is the backstop.

## Self-Check: PASSED
- Files exist on disk: WorkflowsPage.tsx, ChatLayout.tsx, RunModal.test.tsx, ChatLayoutLaunch.test.tsx, WorkflowsPage.test.tsx — all FOUND.
- Commits exist: `48fce37b`, `8e1f06b9`, `42e15e13`, `a052d30d` — all FOUND.
- Gates: touched-surface suites 35/35 green; `npx vite build` exit 0; 0 net-new tsc errors vs the 30-error baseline; `git diff --name-only` = 5 frontend files, no backend.

---
*Phase: 152-workflow-run-inputs*
*Completed: 2026-07-15*
