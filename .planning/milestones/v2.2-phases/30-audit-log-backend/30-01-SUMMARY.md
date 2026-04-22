---
phase: 30-audit-log-backend
plan: 01
subsystem: database
tags: [postgres, supabase, rls, audit-log, python, pytest]

# Dependency graph
requires:
  - phase: 29-document-versioning-ui
    provides: "Completed v2.2 versioning UI, stable schema baseline for Phase 30 audit additions"
provides:
  - "audit_log table with INSERT-only RLS and CHECK constraint for 8 action types"
  - "audit_service.write_audit_entry async coroutine (fire-and-forget, exception-swallowing)"
  - "Unit tests verifying insert behavior, all action types, exception swallowing, and metadata shape"
affects: [30-02, 31-audit-log-frontend]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Fire-and-forget audit writes via BackgroundTasks.add_task() — never awaited in request handler"
    - "INSERT-only RLS: users may write their own rows but cannot read/update/delete"
    - "Exception swallowing in audit writes: caught, logged to stderr, never re-raised"

key-files:
  created:
    - backend/supabase/migrations/017_audit_log.sql
    - backend/app/services/audit_service.py
    - backend/tests/unit/test_audit_service.py
  modified: []

key-decisions:
  - "audit_log uses INSERT-only RLS (no SELECT for users) — log immutability enforced at DB layer"
  - "write_audit_entry swallows all exceptions to prevent audit failures from impacting request flow"
  - "VALID_ACTION_TYPES frozenset in service layer mirrors CHECK constraint — dual validation"
  - "Unit tests use inline MagicMock factories (not conftest _supabase import) — simpler isolation without cross-module import issues"

patterns-established:
  - "Audit mock pattern: _make_supabase_mock() returns (sb, builder, execute_result) tuple — each test gets a fresh mock"
  - "TDD for audit service: tests written inline with implementation (GREEN from the start since implementation was specified)"

requirements-completed: [AUDIT-01, AUDIT-03, AUDIT-06]

# Metrics
duration: 2min 3sec
completed: 2026-04-14
---

# Phase 30 Plan 01: Audit Log Backend Summary

**audit_log Postgres table with INSERT-only RLS, 8-action CHECK constraint, composite index, and write_audit_entry async coroutine with exception swallowing**

## Performance

- **Duration:** 2min 3sec
- **Started:** 2026-04-14T14:17:46Z
- **Completed:** 2026-04-14T14:19:49Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Migration 017 creates audit_log table with id/user_id/action_type/metadata/created_at columns, CHECK constraint for all 8 action types, composite index for Phase 31 pagination, and INSERT-only RLS policy
- audit_service.py exports write_audit_entry as async coroutine — fire-and-forget, exceptions swallowed to prevent audit failures from affecting request flow
- 4 unit tests verify insert behavior, all 8 VALID_ACTION_TYPES, exception swallowing (AUDIT-06), and search.query metadata shape (AUDIT-02)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create audit_log SQL migration and audit_service.py** - `3c96251` (feat)
2. **Task 2: Unit tests for audit_service.py** - `3bd7d8a` (test)

**Plan metadata:** _(docs commit follows)_

## Files Created/Modified
- `backend/supabase/migrations/017_audit_log.sql` - audit_log table, CHECK constraint, index, INSERT-only RLS
- `backend/app/services/audit_service.py` - write_audit_entry coroutine, VALID_ACTION_TYPES frozenset
- `backend/tests/unit/test_audit_service.py` - 4 unit tests (insert, all types, swallow, metadata shape)

## Decisions Made
- INSERT-only RLS enforces log immutability at the database layer — users cannot query or modify their own audit entries
- write_audit_entry swallows all exceptions and logs to stderr — audit failure must never cascade into request failure
- VALID_ACTION_TYPES frozenset in service layer mirrors the DB CHECK constraint — provides a dual validation point for Plan 02 callers
- Unit tests use an inline `_make_supabase_mock()` helper rather than importing `_supabase` from conftest — `from conftest import` fails from tests/unit/ subdirectory, inline mocks are simpler and more isolated

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Changed test pattern from `from conftest import _supabase` to inline mock factory**
- **Found during:** Task 2 (unit test RED phase)
- **Issue:** Plan spec said to use `from conftest import _supabase` but this raises `ModuleNotFoundError` when running from the `tests/unit/` subdirectory — pytest sys.path does not add the `tests/` parent to `sys.path` by default
- **Fix:** Created an inline `_make_supabase_mock()` helper in the test file; each test gets a fresh mock tuple `(sb, builder, execute_result)` — cleaner isolation than the shared conftest singleton
- **Files modified:** backend/tests/unit/test_audit_service.py
- **Verification:** `pytest tests/unit/test_audit_service.py` — 4 passed
- **Committed in:** `3bd7d8a` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — bug in plan's import pattern)
**Impact on plan:** No scope change. Tests verify identical behavior to what the plan specified. Import pattern adjusted to match project's actual test directory layout.

## Issues Encountered
- `from conftest import _supabase` pattern in plan spec fails from tests/unit/ — ModuleNotFoundError on `conftest` module. Resolved with inline mock factory (same approach used by test_context_window.py and other pure-unit tests in this project).

## User Setup Required
None — migration SQL is applied via the standard Supabase migration process. No new environment variables or external services.

## Next Phase Readiness
- audit_log table and write_audit_entry service are ready for Plan 02 instrumentation
- Plan 02 can call `write_audit_entry` from document upload, delete, search, code execution, and skill load routers
- VALID_ACTION_TYPES is importable for route validation if needed

---
*Phase: 30-audit-log-backend*
*Completed: 2026-04-14*
