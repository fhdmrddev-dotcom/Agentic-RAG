---
phase: 078-backpressure-json-primitive-code-quality-bundle
plan: 01
subsystem: api, config
tags: [fastapi, lifespan, supabase, pydantic-settings, logging]

# Dependency graph
requires:
  - phase: 073-asyncpg-pool-integration
    provides: asyncpg pool close in lifespan shutdown (ordering reference)
provides:
  - backpressure_admin_user_ids and environment Settings fields for Plan 03 auth gating
  - Supabase singleton aclose in lifespan shutdown (eliminates RuntimeWarning)
  - title-generation failure logging with exc_info for observability
affects: [078-03-backpressure-endpoint]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Lifespan shutdown ordering: RUN_TASKS cancel -> Redis aclose -> asyncpg pool close -> Supabase aclose -> sandbox close"
    - "Late-bind import pattern for _supabase in lifespan shutdown (avoids circular import)"

key-files:
  created:
    - backend/tests/unit/test_threads_title_gen.py
  modified:
    - backend/app/config.py
    - backend/app/main.py
    - backend/app/api/threads.py
    - backend/tests/unit/test_lifespan.py

key-decisions:
  - "Supabase aclose placed after asyncpg pool close, before sandbox close (D-078-09 ordering)"
  - "Title-gen warning uses exc_info=True for full stack trace in server logs (T-078-01-01 mitigation)"

patterns-established:
  - "Lifespan shutdown: new resource teardown inserts between asyncpg and sandbox blocks"

requirements-completed: [CQ-SUPA-01, CQ-TITLE-01, WORKER-LIFT-04]

# Metrics
duration: 3min
completed: 2026-05-27
---

# Phase 078 Plan 01: Config Fields + Supabase aclose + Title-Gen Warning Summary

**Settings fields for backpressure auth, Supabase client aclose in lifespan shutdown, and title-generation failure logging with exc_info**

## Performance

- **Duration:** 3 min
- **Started:** 2026-05-26T20:16:50Z
- **Completed:** 2026-05-26T20:19:41Z
- **Tasks:** 2/2
- **Files modified:** 5

## Accomplishments
- Added `backpressure_admin_user_ids` and `environment` fields to the Settings class, prerequisite for Plan 03's backpressure endpoint auth gating (D-078-07)
- Inserted `_supabase.aclose()` in the FastAPI lifespan shutdown sequence after asyncpg pool close and before sandbox close, eliminating the RuntimeWarning on shutdown (CQ-SUPA-01, D-078-09)
- Added `logger.warning("title_generation_failed: ...")` with `exc_info=True` to the previously silent `except Exception` block in `generate_thread_title`, making LLM failures observable (CQ-TITLE-01, D-078-10)
- Created 3 new unit tests: 2 lifespan ordering tests + 1 title-gen log-capture test, all passing

## Task Commits

Each task was committed atomically:

1. **Task 1: Add Settings fields + Supabase aclose + title-gen warning** - `97e3b9e` (feat)
2. **Task 2: Add lifespan + title-gen unit tests** - `0c04d6e` (test)

## Files Created/Modified
- `backend/app/config.py` - Added backpressure_admin_user_ids and environment Settings fields
- `backend/app/main.py` - Inserted _supabase.aclose() in lifespan shutdown between asyncpg and sandbox
- `backend/app/api/threads.py` - Added logger.warning to generate_thread_title except block
- `backend/tests/unit/test_lifespan.py` - Added 2 new tests: aclose called + ordering after pg_pool
- `backend/tests/unit/test_threads_title_gen.py` - New file: title-gen warning log-capture test

## Decisions Made
- Supabase aclose positioned after asyncpg pool close, before sandbox close (matches D-078-09 startup-reverse teardown pattern)
- Title-gen warning uses parameterized logging (`%s`) not f-strings, consistent with existing codebase patterns

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed title-gen test to match actual function signature**
- **Found during:** Task 2 (unit test creation)
- **Issue:** Plan's test called `generate_thread_title(messages=..., model=..., supabase=...)` but the actual function signature is `generate_thread_title(first_user_message: str, user_settings=None)` -- a sync function, not async
- **Fix:** Rewrote test to mock `get_llm_client` (raising RuntimeError) and call the function with its actual signature, keeping the test as a regular sync test since `generate_thread_title` is synchronous
- **Files modified:** backend/tests/unit/test_threads_title_gen.py
- **Verification:** Test passes and correctly verifies the warning log
- **Committed in:** 0c04d6e (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug in plan's test specification)
**Impact on plan:** Test adapted to match actual function interface. No scope creep. All acceptance criteria met.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Settings fields `backpressure_admin_user_ids` and `environment` are ready for Plan 03's backpressure endpoint auth gating
- Lifespan shutdown sequence is complete and tested
- Title-gen failures are now observable in server logs

## Self-Check: PASSED

All files exist, all commits verified.

---
*Phase: 078-backpressure-json-primitive-code-quality-bundle*
*Plan: 01*
*Completed: 2026-05-27*
