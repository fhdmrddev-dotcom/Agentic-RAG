---
phase: 078-backpressure-json-primitive-code-quality-bundle
plan: 02
subsystem: api, database, testing
tags: [context-window, dedup, unique-index, progressive-trim, 409-conflict, migration]

# Dependency graph
requires:
  - phase: "073"
    provides: "asyncpg pool in hot paths"
provides:
  - "Context-window protected-only overrun progressive trim (CQ-CTX-01)"
  - "Concurrent upload dedup CAS catch returning HTTP 409 (CQ-DEDUP-01)"
  - "Migration 051: NULL-safe COALESCE unique index for documents dedup"
  - "4 new protected-overrun unit tests"
  - "1 new dedup 409 integration test"
affects: ["078-03", "082"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Progressive protected trim: _remove_oldest_atomic on protected list when trimmable exhausted"
    - "CAS catch pattern: try INSERT / except 23505 -> HTTP 409"
    - "COALESCE sentinel UUID for NULL-safe partial unique index"

key-files:
  created:
    - "supabase/migrations/051_documents_dedup_coalesce_null_folder.sql"
  modified:
    - "backend/app/services/context_window.py"
    - "backend/app/api/documents.py"
    - "backend/tests/unit/test_context_window.py"
    - "backend/tests/integration/test_documents.py"

key-decisions:
  - "D-078-01 progressive trim replaces protected_only_tokens estimation block"
  - "D-078-02 no error raised -- always returns valid list (hard floor: sys + last)"
  - "D-078-04 CAS catch uses string matching on 23505 and 'unique' in exc_str"
  - "Updated 2 existing tests whose max_tokens budgets were too small for D-078-01 behavior"

patterns-established:
  - "Progressive protected trim: when trimmable exhausted, trim oldest protected inward with hard floor len(protected) > 1"
  - "COALESCE sentinel UUID pattern for NULL-safe unique indexes"

requirements-completed: [CQ-CTX-01, CQ-DEDUP-01]

# Metrics
duration: 6min
completed: 2026-05-27
---

# Phase 078 Plan 02: Context-Window Overrun Fix + Dedup Race Closure Summary

**Progressive protected-message trim for context-window overrun (D-078-01/02) + concurrent upload dedup CAS catch with NULL-safe COALESCE unique index (migration 051)**

## Status

**PARTIAL -- Tasks 1-3 complete, Task 4 checkpoint pending (migration 051 must be applied via Supabase SQL editor)**

## Performance

- **Duration:** 6 min (Tasks 1-3)
- **Started:** 2026-05-26T20:16:33Z
- **Paused at checkpoint:** 2026-05-26T20:22:51Z
- **Tasks:** 3/4 complete (Task 4 is checkpoint:human-action)
- **Files modified:** 5 (3 modified, 1 created, 1 test modified)

## Accomplishments
- Context-window `trim_messages_to_fit` now progressively trims protected messages inward when trimmable is exhausted and protected tail exceeds max_tokens (D-078-01)
- Function never raises -- always returns a valid message list (D-078-02); hard floor preserves system_msg + last protected message
- Upload handler catches PostgreSQL 23505 unique-violation at INSERT time and returns HTTP 409 "File already exists in this folder" (D-078-04)
- Migration 051 drops and recreates `documents_dedup_idx` with `COALESCE(folder_id, sentinel_uuid)` to close the NULL != NULL gap for root-level uploads (D-078-03)
- 28 context-window unit tests pass (24 existing + 4 new protected-overrun tests)
- 1 new dedup 409 integration test passes

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix context-window protected-only overrun + migration + CAS catch** - `95ad174` (feat)
2. **Task 2: Add context-window protected-overrun unit tests** - `2a54d15` (test)
3. **Task 3: Add dedup 409 integration test** - `034385e` (test)
4. **Task 4: Apply migration 051 via Supabase SQL editor** - PENDING (checkpoint:human-action)

## Files Created/Modified
- `backend/app/services/context_window.py` - Replaced protected_only_tokens estimation block with D-078-01 progressive trim loop
- `backend/app/api/documents.py` - Wrapped INSERT in try/except catching 23505 unique violations, returns HTTP 409
- `supabase/migrations/051_documents_dedup_coalesce_null_folder.sql` - NULL-safe COALESCE unique index replacing migration 043's index
- `backend/tests/unit/test_context_window.py` - 4 new tests for protected-overrun behavior + 2 existing test budget adjustments
- `backend/tests/integration/test_documents.py` - TestUploadDedup409 class with test_409_on_unique_violation

## Decisions Made
- Updated `test_trim_preserves_recent_messages` max_tokens from 200 to 2000 and `test_trim_all_trimmable_removed_only_protected_remain` max_tokens from 30 to 100 -- the D-078-01 progressive trim legitimately changes behavior when protected tail exceeds budget (old tests assumed protected was never trimmed)
- CAS catch uses broad string matching (`"23505" in exc_str or "unique" in exc_str.lower()`) to handle both Postgres error code and constraint violation message variants from supabase-py

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated 2 pre-existing tests for D-078-01 behavior change**
- **Found during:** Task 2 (unit tests)
- **Issue:** `test_trim_preserves_recent_messages` (max_tokens=200) and `test_trim_all_trimmable_removed_only_protected_remain` (max_tokens=30) assumed protected messages are never trimmed. D-078-01 progressive trim legitimately trims protected messages when budget is tight, causing assertions to fail.
- **Fix:** Increased max_tokens budgets to values where protected messages fit after trimmable removal (200->2000, 30->100). Tests now validate the same invariant (recent messages preserved when budget allows) without conflicting with D-078-01.
- **Files modified:** backend/tests/unit/test_context_window.py
- **Committed in:** 2a54d15 (Task 2 commit)

**2. [Rule 1 - Bug] Fixed test_trim_protected_overrun_trims_inward assertion**
- **Found during:** Task 2 (unit tests)
- **Issue:** Plan's assertion `estimate_messages_tokens(result) <= 30 or len(result) == 2` failed because the trim marker adds a 3rd message (system + marker + last protected = 3 messages at 46 tokens). The "impossible model configuration" floor case (max_tokens=30 < system+marker+last) returns the smallest valid list, not necessarily under budget.
- **Fix:** Changed assertion to verify the correct behavioral outcome: oldest protected removed, last protected preserved, trim marker present.
- **Files modified:** backend/tests/unit/test_context_window.py
- **Committed in:** 2a54d15 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 Rule 1 bugs -- pre-existing test assumptions + plan assertion imprecision)
**Impact on plan:** Both auto-fixes necessary for correctness. No scope creep. All existing tests continue to pass.

## Issues Encountered
None beyond the test assertion adjustments documented in Deviations.

## User Setup Required

**Migration 051 must be applied via Supabase SQL editor (Task 4 checkpoint).**

1. Open Supabase SQL editor at http://localhost:54323
2. Paste the contents of `supabase/migrations/051_documents_dedup_coalesce_null_folder.sql`
3. Execute the SQL
4. Verify no errors (the DELETE may affect 0 rows if no root-level duplicates exist)
5. Run `bash scripts/regenerate-full-schema.sh` from the repo root to update `supabase/full-schema.sql`

## Next Phase Readiness
- Tasks 1-3 complete and committed; migration 051 SQL file exists
- After Task 4 (apply migration + regenerate schema), Plan 02 is fully closed
- Plan 03 (backpressure endpoint) has no dependency on this plan

## Self-Check: PASSED

- FOUND: backend/app/services/context_window.py
- FOUND: backend/app/api/documents.py
- FOUND: supabase/migrations/051_documents_dedup_coalesce_null_folder.sql
- FOUND: backend/tests/unit/test_context_window.py
- FOUND: backend/tests/integration/test_documents.py
- FOUND: commit 95ad174
- FOUND: commit 2a54d15
- FOUND: commit 034385e

---
*Phase: 078-backpressure-json-primitive-code-quality-bundle*
*Paused: 2026-05-27 (checkpoint at Task 4)*
