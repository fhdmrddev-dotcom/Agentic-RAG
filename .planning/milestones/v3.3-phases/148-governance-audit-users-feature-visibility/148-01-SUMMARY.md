---
phase: 148-governance-audit-users-feature-visibility
plan: 01
subsystem: testing
tags: [pytest, nyquist, red-scaffold, asyncpg-mock, operator-governance, feature-visibility, gotrue-ban]

# Dependency graph
requires:
  - phase: 147-operator-control-plane
    provides: operator gate (require_operator, byte-identical 404), operator_audit_floor, mock_asyncpg_pool + _supabase conftest fixtures, _cancel_run_internals kill discipline
provides:
  - 14 RED test_148_*.py files — one failing pytest node per 148-VALIDATION Per-Task row, scoped to its implementing plan/wave
  - conftest banned_user + feature_visibility Wave-0 fixtures
  - the acceptance contract every downstream 148 backend plan turns GREEN in its own wave
affects: [148-02, 148-04, 148-05, 148-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Wave-ownership test split: service-level assertions (csv_export/operator_grant → 148-04 wave 3) live in different files than controller-level assertions (view_platform_recorded/disable → 148-06 wave 4), so each plan's <verify> is satisfiable in its own wave"
    - "Guarded-target imports inside test bodies: collection succeeds against unbuilt targets, tests fail RED at runtime"
    - "asyncpg pool-mock capture (.calls recorder) + shared supabase mock (mock_builder) for parameterized-SQL and audit-floor assertions with no live DB"

key-files:
  created:
    - backend/tests/test_148_require_visible.py
    - backend/tests/test_148_effective_features.py
    - backend/tests/test_148_visibility_cold_default.py
    - backend/tests/test_148_carveouts.py
    - backend/tests/test_148_platform_audit_filters.py
    - backend/tests/test_148_platform_audit_scope.py
    - backend/tests/test_148_csv_export.py
    - backend/tests/test_148_view_platform_recorded.py
    - backend/tests/test_148_roster.py
    - backend/tests/test_148_disable.py
    - backend/tests/test_148_ban_enforcement.py
    - backend/tests/test_148_ban_fail_open.py
    - backend/tests/test_148_enable.py
    - backend/tests/test_148_operator_grant.py
  modified:
    - backend/tests/conftest.py

key-decisions:
  - "Self-disable-409 assertion authored in test_148_disable.py (148-06 controller), NOT test_148_operator_grant.py — the guard lives in the admin.py disable endpoint"
  - "CSV service file (test_148_csv_export.py) carries zero audit.export/view_platform tokens; the ledger receipt assertions live only in test_148_view_platform_recorded.py"
  - "Ban tests target _is_banned directly (fail-open proof) so fail-open behavior is distinguishable from behaving-like-no-check"

patterns-established:
  - "Every 148-VALIDATION Per-Task row maps 1:1 to a RED pytest node scoped to its implementing plan"

requirements-completed: []

# Metrics
duration: ~40min
completed: 2026-07-11
---

# Phase 148 Plan 01: Nyquist Wave-0 Test Scaffold Summary

**14 RED test_148_*.py files (31 pytest nodes) encoding the ADMIN-03 + VIS-01 acceptance contract — wave-ownership-split so each downstream plan's `<verify>` passes in its own wave — plus the shared `banned_user` + `feature_visibility` conftest fixtures. No production code.**

## Performance

- **Duration:** ~40 min
- **Completed:** 2026-07-11T17:05Z
- **Tasks:** 3
- **Files modified:** 15 (14 created + conftest.py)

## Accomplishments
- 14 RED test files with 31 collected nodes; whole-suite `pytest --collect-only -q` exits 0 (2480 tests, unbroken); all 30 new behavior nodes are RED (targets unbuilt), the sole pass is the `threads`-launch carve-out guard that is correct today and after wave 3.
- Wave-ownership split honored exactly: `test_148_csv_export.py` + `test_148_operator_grant.py` carry ONLY service-level assertions (148-04 wave 3); the controller-level `audit.export`-recorded / refused-writes-nothing lives in `test_148_view_platform_recorded.py` and the self-disable-409 guard lives in `test_148_disable.py` (both 148-06 wave 4). Verified via grep: csv_export has 0 `audit.export`/`view_platform` tokens; operator_grant has 0 `disable` tokens; view_platform_recorded carries both required tokens.
- `conftest.py` extended (append-only) with the `banned_user` asyncpg-pool fixture and the `feature_visibility` enum-record app_settings fixture; 146/147 regression backstop stays green (24/24).
- Security-critical contracts pinned at Wave 0 so later plans cannot silently skip them: 403-not-404 (D-03), no-full-tenant-leak (parameterized/scoped/paginated + page_size≤100), CSV over-cap refuse (50000, exact count), ban-window closure + fail-open, self-lockout guards (self-revoke + self-disable), cold-read per-feature polarity (D-06).

## Task Commits

Each task was committed atomically:

1. **Task 1: VIS-01 stubs (require_visible, effective-features, cold-default, carve-outs)** - `dd253033` (test)
2. **Task 2: Audit-browse stubs — service vs controller split** - `0bc62906` (test)
3. **Task 3: Users stubs + conftest fixtures — service vs controller self-guard split** - `ec40ea51` (test)

**Plan metadata:** _(this commit)_ (docs: complete plan)

## Files Created/Modified
- `test_148_require_visible.py` — `test_non_operator_403` (403+exact body, NOT 404), `test_operator_noop`, `test_everyone_noop`
- `test_148_effective_features.py` — GET /features per-user map (operator all-true; end user Everyone-only)
- `test_148_visibility_cold_default.py` — D-06 per-feature cold-read polarity + safe-deny unknown + stored enum record honored
- `test_148_carveouts.py` — settings/workflows authoring gated vs providers/published/starters/threads-launch ungated (route-dependency introspection)
- `test_148_platform_audit_filters.py` — action_type=ANY + half-open date window as bound params (SERVICE/148-04)
- `test_148_platform_audit_scope.py` — page_size clamp ≤100 + user-scoped-or-all, no SELECT * (SERVICE/148-04)
- `test_148_csv_export.py` — over-cap refuse + exact count, NO ledger assertion (SERVICE/148-04)
- `test_148_view_platform_recorded.py` — audit.view_platform + audit.export-recorded + refused-writes-nothing (CONTROLLER/148-06)
- `test_148_roster.py` — `test_last_active_honesty` (NULL last_sign_in_at preserved) (SERVICE/148-04)
- `test_148_disable.py` — ban 876600h + `_cancel_run_internals` call + user.disable + self-disable-409 (CONTROLLER/148-06)
- `test_148_ban_enforcement.py` — banned live-token → 403 via get_current_user (SUBSTRATE/148-02)
- `test_148_ban_fail_open.py` — `_is_banned` fail-OPEN on DB error + true/false polarity (SUBSTRATE/148-02)
- `test_148_enable.py` — ban_duration='none' + user.enable (CONTROLLER/148-06)
- `test_148_operator_grant.py` — grant granted_by + self-revoke-409 ONLY (SERVICE/148-04)
- `conftest.py` — appended `banned_user` + `feature_visibility` Wave-0 fixtures (reuse mock_asyncpg_pool + _supabase)

## Decisions Made
- None beyond the plan — the wave-ownership split (self-disable-409 in disable.py, service-only assertions in csv_export/operator_grant) was executed exactly as the revised plan specifies.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Initial `test_148_csv_export.py` docstring referenced `audit.export` and the sibling filename `test_148_view_platform_recorded.py` (which contains the substring `view_platform`), tripping the acceptance grep that requires zero such tokens in the service file. Reworded the docstring to name neither the action codes nor the sibling filename; re-verified grep count = 0. (Not a code deviation — a wording fix inside the Task-2 authoring loop, folded into commit `0bc62906`.)

## Honest pytest claims (real collected counts)
- `pytest tests/test_148_*.py --collect-only -q` → **31 nodes across 14 files, exit 0**.
- `pytest tests/test_148_*.py -q` → **30 failed (RED), 1 passed** (the threads carve-out guard — correct now and post-wave-3).
- Whole-suite `pytest --collect-only -q` → exit 0 (2480 tests, collection unbroken).
- 146/147 backstop spot-run → 24 passed (conftest append caused no regression).

## Next Phase Readiness
- 148-02 (wave 2) has GREEN targets for: `require_visible` (require_visible.py), `feature_audience`/`_GOVERNED_FEATURES` (visibility_cold_default.py), `_is_banned` + ban check (ban_enforcement.py, ban_fail_open.py).
- 148-04 (wave 3): `query_platform_audit`, `export_platform_audit_csv`, `list_users_roster`, `grant_operator`/`revoke_operator` (platform_audit_filters/scope, csv_export, roster, operator_grant).
- 148-05 (wave 3): `GET /features` + require_visible wiring (effective_features, carveouts).
- 148-06 (wave 4): 8 admin.py endpoints (view_platform_recorded, disable, enable).
- Mock-completeness note for the owning waves: the controller tests (disable/enable/view_platform_recorded) mock the service + GoTrue + Redis + `_cancel_run_internals`; the exact fetch/fetchrow query sequence the disable endpoint chooses may require the 148-06 executor to reconcile the pool-mock setup — the CONTRACT assertions (876600h literal, `_cancel_run_internals` call, user.disable, self-409) are the load-bearing part. csv_export's COUNT probe assumes fetchval/fetchrow; 148-04 reconciles if it uses a different count shape.

## Self-Check: PASSED

All 14 `test_148_*.py` files + `148-01-SUMMARY.md` exist on disk; all three task commits (`dd253033`, `0bc62906`, `ec40ea51`) present in git history.

---
*Phase: 148-governance-audit-users-feature-visibility*
*Completed: 2026-07-11*
