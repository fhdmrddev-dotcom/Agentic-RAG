---
phase: 181-revert-foundation
plan: 01
subsystem: api
tags: [feature-flag, feature-visibility, fastapi, dependency-gate, pytest, revert, governance]

# Dependency graph
requires:
  - phase: 148-feature-visibility (v3.3)
    provides: the _GOVERNED_FEATURES cold-default map, feature_audience/resolve_feature_access resolvers, the require_operator 404 posture + require_visible factory, GET /features effective map, and the PUT /admin/visibility write allowlists — all reused ~95% verbatim
provides:
  - "A 5th governed feature key visual_workflow_canvas with a new \"off\" audience enum member (cold default OFF for everyone, operators included)"
  - "require_canvas() — a 404-when-off dependency gate factory that resolves \"off\" BEFORE the operator no-op and reuses the shared _NOT_FOUND (404, never 403)"
  - "GET /features off-bypass: an \"off\" feature hides from EVERYONE incl. operators"
  - "A temporary GET /canvas/ping canary route proving the 404 gate end-to-end via TestClient (removed/repurposed in 182/183)"
  - "The backend byte-identical acceptance gate test_revert_byte_identical.py (D-181-06) riding the existing backend-tests CI"
affects: [182-server-validation-seam, 183-read-only-canvas, 184-editable-canvas, every-later-v3.6-canvas-route]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "The \"off\" audience is a 5th enum member threaded through every layer that pattern-matches on audience (model resolver, admin write allowlist, GET /features guard) — never a boolean (SEED-115 enum-not-boolean)"
    - "404-not-403 byte-identical non-discoverability for canvas routes: reuse the module _NOT_FOUND constant; a 403 would leak route existence"
    - "Resolve \"off\" BEFORE the operator short-circuit in BOTH the gate and the /features map so the master switch hides from operators too"
    - "Fail-closed settings read (feature_audience never raises -> cold default \"off\" -> 404/hidden) — reused from Phase 148, no net-new fail-closed logic"

key-files:
  created:
    - backend/app/api/canvas_canary.py
    - backend/tests/test_181_off_audience.py
    - backend/tests/test_181_flip_on.py
    - backend/tests/test_revert_byte_identical.py
  modified:
    - backend/app/models/user_settings.py
    - backend/app/api/admin.py
    - backend/app/dependencies.py
    - backend/app/api/features.py
    - backend/app/main.py
    - backend/tests/test_148_effective_features.py

key-decisions:
  - "\"off\" cold default lives ONLY in _GOVERNED_FEATURES (no migration) — an unseeded feature_visibility key falls through to it; the flip persists via set_feature_visibility's atomic || merge (D-181-05)"
  - "require_canvas mirrors require_operator's 404 (never require_visible's 403); resolves \"off\" first so an operator gets the same 404 as an end user (D-181-01/D-181-02)"
  - "byte-identical defined OBSERVABLY (nav set + reachable-route set + responses + /features map + two doors + run surface), NOT a bundle hash (D-181-07)"

patterns-established:
  - "Every future canvas route attaches dependencies=[Depends(require_canvas())] and appends its own 404-when-off probe to test_revert_byte_identical.py so the reachable-route set stays provably empty while off"

requirements-completed: [REVERT-01, REVERT-02]

# Metrics
duration: 37min
completed: 2026-07-24
---

# Phase 181 Plan 01: Revert Foundation (backend off-switch) Summary

**A governed `visual_workflow_canvas` feature flag defaulting OFF for everyone (operators included), a 404-when-off `require_canvas` gate reusing the shared `_NOT_FOUND`, a temporary canary route proving the gate end-to-end, and the `test_revert_byte_identical` backend acceptance gate — zero migration, zero new package.**

## Performance

- **Duration:** ~37 min
- **Started:** 2026-07-24T14:50:00Z (approx)
- **Completed:** 2026-07-24T15:27:23Z
- **Tasks:** 3 (+1 auto-fix deviation)
- **Files modified:** 10 (4 created, 6 modified)

## Accomplishments
- Threaded the new `"off"` audience through the model resolver (`feature_audience` accepted-enum tuple + explicit `resolve_feature_access` off-deny) and the `PUT /admin/visibility` write allowlist (`_VISIBILITY_FEATURES` += canvas, `_VISIBILITY_AUDIENCES` += off) — a crafted off-allowlist audience still 400s (T-181-03).
- Added `require_canvas()` — a 404-when-off dependency-gate factory that resolves `"off"` BEFORE the operator no-op and raises the shared `_NOT_FOUND` (404, never 403), so flag-off is byte-identical to a route that was never built.
- Added the leading `feature_audience(f) != "off"` guard to the `GET /features` comprehension so the canvas key hides from EVERYONE incl. operators (D-181-01), with no Phase-148 regression on the 4 shipped keys.
- Shipped the temporary `GET /canvas/ping` canary (mounted in `main.py`) so the 404 gate is testable NOW, and the `test_revert_byte_identical.py` acceptance gate (map-hides + 404-never-403 + no-regression), all riding the existing `backend-tests.yml`.

## Task Commits

Each task was committed atomically (TDD tasks split RED → GREEN):

1. **Task 1 (RED): off-audience + admin-allowlist tests** — `bfa5df6c` (test)
2. **Task 1 (GREEN): thread "off" through model + admin allowlist** — `b9c5012d` (feat)
3. **Task 2 (RED): require_canvas 404 + features off-bypass + flip-on tests** — `5152dea4` (test)
4. **Task 2 (GREEN): require_canvas gate + canary route + features off-bypass** — `4e40d6f9` (feat)
5. **Task 3: test_revert_byte_identical acceptance gate** — `fdc3bf71` (test)
6. **[Rule 1 deviation] update Phase-148 operator-map test** — `83562caa` (test)

**Plan metadata:** _(this commit)_ (docs: complete plan)

## Files Created/Modified
- `backend/app/models/user_settings.py` — `_GOVERNED_FEATURES` gains `visual_workflow_canvas: "off"`; `feature_audience` honors a stored `"off"` record; `resolve_feature_access` gains an explicit off-deny.
- `backend/app/api/admin.py` — `_VISIBILITY_FEATURES` += `visual_workflow_canvas`; `_VISIBILITY_AUDIENCES` += `off`.
- `backend/app/dependencies.py` — new `require_canvas()` 404 gate factory.
- `backend/app/api/features.py` — leading `"off"` guard on the effective-map comprehension.
- `backend/app/api/canvas_canary.py` — TEMPORARY `GET /canvas/ping` behind `require_canvas()` (D-181-04).
- `backend/app/main.py` — mount `canvas_canary.router`.
- `backend/tests/test_181_off_audience.py` / `test_181_flip_on.py` / `test_revert_byte_identical.py` — the off-audience, gate/flip-on, and byte-identical acceptance suites.
- `backend/tests/test_148_effective_features.py` — updated the operator-map test for the new 5th `off` key (Rule 1 deviation).

## Decisions Made
None beyond the plan — followed the locked D-181-01..08 decisions as specified. The `"off"` audience is the sole net-new semantic; everything else is ~95% verbatim reuse of the shipped Phase-148 feature-visibility pattern.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated the Phase-148 operator-map test for the new governed key**
- **Found during:** wave-merge full-suite run (after Task 3)
- **Issue:** `test_148_effective_features.py::test_operator_sees_all_features_true` hard-coded `set(feats) == {the 4 governed keys}` + `all True`. Phase 181 intentionally adds a 5th governed key (`visual_workflow_canvas`) whose cold default is `"off"` (hidden from operators too, D-181-01), so the exact-set + all-True assertions no longer hold. The sibling `test_end_user_sees_only_everyone_features` passed, confirming the file was green at baseline and only this assertion broke.
- **Fix:** Assert the 4 shipped keys remain present + all-True for an operator (no Phase-148 regression, REVERT-02) and that `visual_workflow_canvas` is `False` for an operator (the master switch).
- **Files modified:** `backend/tests/test_148_effective_features.py`
- **Verification:** all 29 Phase-148/167 visibility tests green.
- **Committed in:** `83562caa`

---

**Total deviations:** 1 auto-fixed (1 Rule 1 test-contract update).
**Impact on plan:** In-scope and required — the change makes the Phase-148 test reflect the intended new contract. No scope creep; the 9 planned files are the only source touched (+1 pre-existing sibling test).

## Issues Encountered
- The two `test_181_*` "404 when off" assertions pass even in RED because an absent route also 404s — this is the phase's core property (off is indistinguishable from never-built), so the RED signal came from the flip-on 200 assert + the features operator-hide assert instead. Noted, not a problem.

## Deferred Issues (out of scope — logged, NOT fixed)
The wave-merge full run showed **202 pre-existing backend test failures** (2957 passing). The full 203-failure list was grepped for every keyword in the Phase-181 touched surface; the only real overlap was the one regression fixed above. The remaining failures are documented repo-wide rot (SEED-049 e2e rot, SEED-056 vitest rot, Phase-162.5 source-drift) in service-unit files the feature-visibility subsystem never touches (`test_retrieval_service`, `test_sql_service`, `test_sandbox_service`, `test_multimodal_query`, `test_streaming_reliability`, …). Details in `deferred-items.md`. Phase 181 introduces **zero net-new failures** and **+19 passing** tests.

## Scope-Freeze Verification (D-181-08)
`git diff --name-only HEAD~6..HEAD` touches only the 9 planned files + the one Rule-1 test. The FROZEN files (`WorkflowDoorSwitch.tsx`, `WorkflowBuilderPage.tsx`, `WorkflowsPage.tsx`, `PhaseTimeline.tsx`, `PhaseCard.tsx`, the harness engine) are ABSENT from the diff. No `supabase/migrations/*`, no `requirements.txt` / `package.json` delta (zero migration, zero package — D-181-05).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Every later v3.6 canvas route now inherits a tested off-switch: attach `dependencies=[Depends(require_canvas())]` and append a "404 when off" probe to `test_revert_byte_identical.py`.
- **Plan 02 / 03** (frontend nav-parity + ChatLayout render-guard `revertByteIdentical.test.tsx`, and the FeatureVisibility Off|On card / api.ts union / ControlRoomPage seed) remain for this phase.
- The canary `GET /canvas/ping` is explicitly TEMPORARY — 182/183 remove/repurpose it once a real `/canvas` route can exercise `require_canvas`.

## Self-Check: PASSED
- All 4 created files exist on disk.
- All 6 task commits (`bfa5df6c`, `b9c5012d`, `5152dea4`, `4e40d6f9`, `fdc3bf71`, `83562caa`) exist in git history.

---
*Phase: 181-revert-foundation*
*Completed: 2026-07-24*
