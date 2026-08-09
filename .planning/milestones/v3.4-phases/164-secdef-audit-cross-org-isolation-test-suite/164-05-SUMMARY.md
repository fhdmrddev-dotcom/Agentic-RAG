---
phase: 164-secdef-audit-cross-org-isolation-test-suite
plan: 05
subsystem: testing
tags: [text-to-sql, folder-scope, rls, org-isolation, pytest, xfail, tenancy]

# Dependency graph
requires:
  - phase: 164-04
    provides: "producer client-swap + deletion of _inject_user_id/_inject_user_id_for_grep (the WR-02 regression source)"
  - phase: 164-03
    provides: "migration 110 DEFINER org gate + the test_v3_4_org_isolation.py exit-gate suite this plan extends"
provides:
  - "WR-02 fix: _inject_folder_scope splices the folder filter BEFORE trailing ORDER BY/GROUP BY/HAVING/LIMIT/OFFSET (valid SQL for folder-scoped query_documents)"
  - "CR-01/SEED-124 known-open xfail(strict) marker covering the KB browse-tool service-role cross-org leak surface in the exit gate"
affects: [165, is_global-retirement, folder_utils, phase-165-xfail-flip]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Tracked-known-open: xfail(strict=True) marker documents a folded leak; Phase 165 fix → XPASS-strict fails → forces marker removal"
    - "Read local Supabase URL/key from backend/.env directly in tests (root conftest pollutes SUPABASE_URL with a mock host)"

key-files:
  created: []
  modified:
    - backend/app/services/sql_service.py
    - backend/tests/integration/test_v3_4_org_isolation.py

key-decisions:
  - "WR-02 fixed in-phase (valid-SQL regression, not a leak); CR-01/WR-01 CODE fix deferred to Phase 165 per operator — folder_utils.py left UNTOUCHED"
  - "CR-01 tracked via xfail(strict) marker referencing SEED-124 rather than a code fix, so the exit gate covers the surface + the suite stays green"
  - "Service-role client for the xfail test built from backend/.env (not get_supabase(), which the root conftest points at a mock host under pytest)"

patterns-established:
  - "xfail(strict) known-open marker + SEED cross-reference is the honest way to keep an exit gate green while a folded leak is tracked to its fixing phase"

requirements-completed: []

# Metrics
duration: 5min
completed: 2026-07-20
---

# Phase 164 Plan 05: Code-review gap closure (WR-02 fix + CR-01 known-open marker) Summary

**`_inject_folder_scope` now splices the folder filter into the WHERE before any trailing ORDER BY/LIMIT (fixing invalid SQL from the 164-04 `_inject_user_id` deletion), and the exit gate gains an `xfail(strict)` SEED-124 marker that exercises + documents the KB browse-tool service-role cross-org leak folded to Phase 165.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-07-20T17:34:25Z
- **Completed:** 2026-07-20T17:38:57Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- **WR-02 fixed:** `_inject_folder_scope` (`sql_service.py`) locates the first trailing `ORDER BY`/`GROUP BY`/`HAVING`/`LIMIT`/`OFFSET` keyword and splices `WHERE`/`AND <folder condition>` into the head before it — so folder-scoped `query_documents` emits valid SQL for any LLM query shape. `_detect_alias` + the documents-vs-folders ref selection + the SELECT-only/no-`;` guards are preserved verbatim.
- **4 folder_scope unit assertions added** (ORDER BY+LIMIT tail, WHERE+LIMIT AND-splice, no-tail append, GROUP BY+HAVING placement) — all green.
- **CR-01/SEED-124 known-open marker added:** `test_browse_tools_cross_org_leak_KNOWN_OPEN_seed124` drives the REAL service-role `get_globally_visible_folder_ids` as user B against user A's `is_global` folder and asserts no cross-org leak. The leak is live, so it FAILS → `xfail(strict)` (XFAIL). When Phase 165 org-scopes `folder_utils.py`, the test XPASSes → strict xfail fails → forces the marker's removal.
- **`folder_utils.py` left untouched** — CR-01/WR-01 code fix deferred to Phase 165 (SEED-124) per operator.
- Full exit-gate suite: **22 passed, 1 xfailed, exit 0.**

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix WR-02 — folder-scope clause placement** - `e8eb85a9` (fix)
2. **Task 2: Add CR-01 known-open xfail marker to the exit gate** - `1895e178` (test)

**Plan metadata:** _(final docs commit — see below)_

## Files Created/Modified
- `backend/app/services/sql_service.py` - `_inject_folder_scope` rewritten to splice the folder condition before trailing clauses (WR-02).
- `backend/tests/integration/test_v3_4_org_isolation.py` - 4 folder_scope unit legs + the `test_browse_tools_cross_org_leak_KNOWN_OPEN_seed124` xfail(strict) marker + `_read_local_supabase_env`/`_service_role_supabase_or_skip` helpers.

## Decisions Made
- **WR-02 fixed in-phase, CR-01/WR-01 deferred:** WR-02 is a pure valid-SQL regression (RLS still isolates), so it ships here; the CR-01 service-role folder-visibility leak is a real cross-org data exposure whose fix touches `folder_utils.py` — folded to Phase 165 (`is_global` retirement) per operator, tracked via the xfail marker.
- **Marker over silent deferral:** the exit gate must not claim "zero cross-org leakage" while a live browse-tool leak exists unexercised, so the surface is now covered by an honest `xfail(strict)` that flips when Phase 165 closes it.
- **Service-role client from `.env`, not `get_supabase()`:** the root `conftest.py` does `os.environ.setdefault("SUPABASE_URL", "https://test.supabase.co")`, so `settings.supabase_url`/`get_supabase()` point at an unreachable mock host under pytest. The test reads the real local URL/key from `backend/.env` (mirroring `test_115_tool_global_leak`) so the leak is genuinely exercised (XFAIL) instead of skipped.

## Deviations from Plan

None - plan executed exactly as written. (The `.env`-based service-role client build was an implementation detail required by the plan's own instruction to exercise the SERVICE-ROLE folder helper under pytest; the plan named `get_supabase()` only as an example — `e.g.` — of the service-role path.)

## Issues Encountered
- **First xfail attempt SKIPPED instead of XFAILED:** building the service-role client via `get_supabase()` failed with `getaddrinfo failed` because the root conftest overrides `SUPABASE_URL` with a mock host at import time. Resolved by reading `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` straight from `backend/.env` (the `test_115` pattern) → the client hits the real `http://127.0.0.1:54321` gate → the leak manifests → XFAIL.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 164 exit gate is green (22 passed, 1 xfailed) and now covers the KB browse-tool surface.
- **Phase 165 (`is_global` retirement) inherits a hard hand-off:** org-scope the `folder_utils.py` helpers (`fetch_visible_folders` / `get_globally_visible_folder_ids` / `is_in_global_subtree`) + fix WR-01 (`_null_foreign_global_owner` descendant-owner leak). When done, `test_browse_tools_cross_org_leak_KNOWN_OPEN_seed124` will XPASS → strict xfail fails → the marker MUST be removed and SEED-124 flipped to closed.

## Self-Check: PASSED

- FOUND: `backend/app/services/sql_service.py`
- FOUND: `backend/tests/integration/test_v3_4_org_isolation.py`
- FOUND: `.planning/phases/164-secdef-audit-cross-org-isolation-test-suite/164-05-SUMMARY.md`
- FOUND commit: `e8eb85a9` (Task 1 — WR-02 fix)
- FOUND commit: `1895e178` (Task 2 — CR-01 xfail marker)

---
*Phase: 164-secdef-audit-cross-org-isolation-test-suite*
*Completed: 2026-07-20*
