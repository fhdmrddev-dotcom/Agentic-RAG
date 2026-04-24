---
phase: 039-user-feedback-loop-backend
plan: 01
subsystem: api
tags: [feedback, fastapi, supabase, rls, audit, postgresql, pydantic]

requires:
  - phase: 037-knowledge-health-dashboard-backend
    provides: knowledge_health.py router pattern used as analog for feedback.py structure

provides:
  - message_feedback Supabase table with RLS, UNIQUE(message_id, user_id), and index
  - POST /feedback endpoint (201 on success, 409 on duplicate)
  - GET /feedback/stats endpoint (all-time positive rate + 30-day downvoted documents)
  - feedback.submit in VALID_ACTION_TYPES for audit trail

affects:
  - 040-user-feedback-loop-frontend

tech-stack:
  added: []
  patterns:
    - "Immutable rating pattern: INSERT + SELECT RLS only, no UPDATE/DELETE policies or endpoints (D-01)"
    - "Fire-and-forget audit: asyncio.create_task(write_audit_entry(...)) — never await in request handler (D-07)"
    - "Python-side JSONB aggregation for source_refs document attribution (same pattern as knowledge_health.py)"
    - "Duplicate detection via 23505 Postgres error code + 'unique'/'duplicate' string in exception message"

key-files:
  created:
    - supabase/migrations/028_message_feedback.sql
    - backend/app/api/feedback.py
  modified:
    - backend/app/services/audit_service.py
    - backend/app/main.py

key-decisions:
  - "VARCHAR + CHECK constraints for rating/reason — not Postgres ENUM types (simpler migration, consistent with codebase pattern)"
  - "user_id always from JWT current_user['id'], never from request body (T-039-01 tampering prevention)"
  - "All stats queries use .eq('user_id', user_id) redundant filter alongside RLS for defense-in-depth (T-039-02)"
  - "30-day window for downvoted documents; all-time window for positive_rate (D-03/D-04 asymmetry)"
  - "supabase db push skipped (non-blocking): local instance auto-applies custom-named migrations on startup; table verified present via REST API"

patterns-established:
  - "feedback.py follows knowledge_health.py structure exactly: _now_utc(), _window_cutoff(), APIRouter with prefix"
  - "Source_refs iteration for document attribution: defensive isinstance(entry, dict) + doc_id guard before counting"

requirements-completed: [FB-01, FB-02, FB-03]

duration: 12min
completed: 2026-04-18
---

# Phase 039 Plan 01: User Feedback Loop Backend Summary

**message_feedback table with RLS + UNIQUE constraint, POST /feedback (201/409) and GET /feedback/stats endpoints with source_refs-based document attribution, fire-and-forget audit writes**

## Performance

- **Duration:** 12 min
- **Started:** 2026-04-18T07:41:51Z
- **Completed:** 2026-04-18T07:54:15Z
- **Tasks:** 3 (Task 1 already done; Tasks 2-3 executed this session)
- **Files modified:** 4

## Accomplishments

- Verified message_feedback table already applied to local Supabase (migration 028 confirmed via REST API)
- Created feedback.py with submit_feedback (POST /feedback, 201/409) and get_feedback_stats (GET /feedback/stats) following knowledge_health.py pattern
- Added "feedback.submit" to VALID_ACTION_TYPES in audit_service.py and registered feedback.router in main.py
- All Python imports and route registrations verified clean

## Task Commits

1. **Task 1: Migration 028 — message_feedback table, RLS, UNIQUE, index** - `fb1c542` (feat) — completed prior session
2. **Task 2: Push schema to Supabase** — no commit (verification only; table confirmed present via REST API)
3. **Task 3: feedback.py router + audit_service update + main.py registration** - `b19de66` (feat)

**Plan metadata:** (docs commit below)

## Files Created/Modified

- `supabase/migrations/028_message_feedback.sql` — message_feedback table with RLS, UNIQUE(message_id, user_id), index (prior session)
- `backend/app/api/feedback.py` — POST /feedback and GET /feedback/stats with source_refs document attribution
- `backend/app/services/audit_service.py` — "feedback.submit" added to VALID_ACTION_TYPES frozenset
- `backend/app/main.py` — feedback import added to from-app-api line; app.include_router(feedback.router) added

## Decisions Made

- **supabase db push approach**: The project uses custom-named migration files (001_xxx through 028_xxx) which are not tracked by the Supabase timestamped migration system. `supabase db push` errors with "Remote migration versions not found in local migrations directory". The local Supabase instance auto-applies all migrations from the `supabase/migrations/` directory on startup (verified via `supabase db push --local` showing "Remote database is up to date" and REST API confirming table exists). Task 2 recorded as verification-only, no separate commit needed.
- **Threat model compliance**: T-039-01 (tampering) mitigated — user_id always from JWT, never request body. T-039-02 (RLS bypass) mitigated — redundant `.eq("user_id", user_id)` on all queries. T-039-03 (mass assignment) mitigated — FeedbackRequest accepts only message_id, rating, reason.

## Deviations from Plan

None — plan executed as written. The `supabase db push` step in Task 2 was verified via REST API rather than CLI output (the CLI errors on this project due to custom migration naming), which is equivalent confirmation that the migration is applied.

## Issues Encountered

- `supabase db push` exits with error on this project because custom-named migration files (001_xxx pattern) are not recognized by Supabase CLI's timestamp-based migration tracking. This is a pre-existing project characteristic. Resolved by verifying table existence directly via REST API and `supabase db push --local` (which shows "Remote database is up to date" — confirming the local instance runs all migrations automatically).

## Known Stubs

None — both endpoints query real Supabase tables. No hardcoded values or placeholder data.

## Threat Flags

None — all trust boundaries from the plan's threat model are mitigated as documented in Decisions Made above.

## Next Phase Readiness

- Backend infrastructure complete: message_feedback table, POST /feedback, GET /feedback/stats
- Phase 040 (frontend) can implement thumbs up/down UI calling POST /feedback and read stats from GET /feedback/stats
- No blockers

## Self-Check

- [x] `backend/app/api/feedback.py` exists
- [x] `backend/app/services/audit_service.py` contains "feedback.submit"
- [x] `backend/app/main.py` contains "feedback.router"
- [x] `supabase/migrations/028_message_feedback.sql` exists with UNIQUE(message_id, user_id)
- [x] message_feedback table verified present in local Supabase via REST API
- [x] Python import check passed: `from app.main import app` — routes ['/feedback', '/feedback/stats'] confirmed
- [x] Task 3 commit exists: b19de66

## Self-Check: PASSED

---
*Phase: 039-user-feedback-loop-backend*
*Completed: 2026-04-18*
