---
phase: 078-backpressure-json-primitive-code-quality-bundle
plan: 03
subsystem: api, admin
tags: [fastapi, backpressure, auth-gating, anyio, redis, asyncpg]

# Dependency graph
requires:
  - phase: 078-01
    provides: backpressure_admin_user_ids and environment Settings fields for auth gating
  - phase: 073-asyncpg-pool-integration
    provides: asyncpg pool at _pg_pool (pool stats for postgres_pool_in_use signal)
provides:
  - GET /admin/backpressure endpoint with 4 bottleneck signals (WORKER-LIFT-04)
  - Auth gating via BACKPRESSURE_ADMIN_USER_IDS allow-list (D-078-07)
  - 5 unit tests covering auth + response shape + resilience
affects: [v3.1-dashboard-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Admin endpoint auth: env-var allow-list with fail-closed production / fail-open dev"
    - "Late-bind import for RUN_TASKS inside endpoint body (avoids circular import with threads.py)"
    - "Redis resilience: catch Exception on zcard, report 0 instead of 500"

key-files:
  created:
    - backend/app/api/admin.py
    - backend/tests/unit/test_backpressure.py
  modified:
    - backend/app/main.py

key-decisions:
  - "Auth gating uses Depends chain: get_current_user (JWT) then _check_backpressure_auth (allow-list)"
  - "RUN_TASKS imported inside function body (late-bind) to avoid circular import with threads.py"
  - "JSON shape additive-only (D-078-08): 4 keys now, v3.1 adds without breaking consumers"

patterns-established:
  - "Admin router pattern: prefix=/admin, tags=[admin], separate from feature routers"
  - "Fail-closed/fail-open auth pattern for operator-gated endpoints"

requirements-completed: [WORKER-LIFT-04]

# Metrics
duration: 3min
completed: 2026-05-27
---

# Phase 078 Plan 03: Backpressure Endpoint Summary

**GET /admin/backpressure with 4 bottleneck signals (anyio threadpool, Redis active runs, asyncpg pool, RUN_TASKS count) and env-var allow-list auth gating**

## Performance

- **Duration:** 3 min
- **Started:** 2026-05-26T20:33:22Z
- **Completed:** 2026-05-26T20:36:11Z
- **Tasks:** 2/2
- **Files modified:** 3

## Accomplishments
- Created `GET /admin/backpressure` endpoint returning 4 bottleneck signals as JSON (D-078-06)
- Implemented auth gating via `BACKPRESSURE_ADMIN_USER_IDS` allow-list: fail-closed in production (403 when unset), fail-open in dev (D-078-07)
- Registered admin router in FastAPI app at `/admin` prefix
- Created 5 unit tests covering auth gating (3), response shape (1), and Redis resilience (1) -- all passing

## Task Commits

Each task was committed atomically:

1. **Task 1: Create admin.py endpoint + register router** - `12f571c` (feat)
2. **Task 2: Add backpressure endpoint unit tests** - `52f4c45` (test)

## Files Created/Modified
- `backend/app/api/admin.py` - New file: backpressure endpoint with auth gating and 4 signal keys
- `backend/app/main.py` - Added admin import and router registration
- `backend/tests/unit/test_backpressure.py` - New file: 5 unit tests for auth + shape + resilience

## Decisions Made
None - followed plan as specified

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required. The endpoint works out of the box in dev mode (fail-open). For production, set `BACKPRESSURE_ADMIN_USER_IDS` and `ENVIRONMENT=production` in `backend/.env`.

## Next Phase Readiness
- WORKER-LIFT-04 requirement is fully satisfied
- Endpoint ready for v3.1 dashboard UI consumption
- JSON shape is additive-only -- future signals can be added without breaking consumers

## Self-Check: PASSED

All files exist, all commits verified.

---
*Phase: 078-backpressure-json-primitive-code-quality-bundle*
*Plan: 03*
*Completed: 2026-05-27*
