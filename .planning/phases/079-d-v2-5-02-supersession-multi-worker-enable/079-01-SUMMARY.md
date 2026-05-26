---
phase: 079-d-v2-5-02-supersession-multi-worker-enable
plan: 01
subsystem: infra
tags: [multi-worker, uvicorn, adr, migration, asyncpg, d-prd-12]

# Dependency graph
requires:
  - phase: 077-multi-worker-validation-harness
    provides: "4/4 multi-worker safety truths (50-run load, cross-cancel, sandbox re-attach, singleton isolation)"
  - phase: 078-backpressure-json-primitive-code-quality-bundle
    provides: "GET /admin/backpressure endpoint with per_worker_run_count"
  - phase: 073-asyncpg-pool-integration
    provides: "asyncpg pool in hot paths replacing sync supabase-py"
provides:
  - "D-PRD-12 ADR formally superseding D-v2.5-02 single-worker constraint"
  - "CLAUDE.md multi-worker rule replacing single-worker rule"
  - "Migration 052 adding runs.spawned_by_worker column"
  - "PID write at run INSERT for post-mortem correlation"
  - "WORKER_COUNT=2 env var + restart-backend.ps1 multi-worker support"
affects: ["080-prod-deployment-docs", "082-cross-cutting-verify"]

# Tech tracking
tech-stack:
  added: []
  patterns: ["WORKER_COUNT env var for uvicorn worker count", "spawned_by_worker PID at run INSERT"]

key-files:
  created:
    - "supabase/migrations/052_runs_worker_id.sql"
  modified:
    - ".planning/prd-reset/DECISIONS.md"
    - ".planning/PROJECT.md"
    - "CLAUDE.md"
    - "backend/.env.example"
    - "scripts/restart-backend.ps1"
    - "backend/app/db/runs.py"
    - "backend/app/api/threads.py"

key-decisions:
  - "D-PRD-12 ADR authored with singleton audit table (8 entries), scaling triggers (backpressure-based), and re-trigger clause (immediate revert for data corruption, diagnostic-first for non-user-visible issues)"
  - "WORKER_COUNT=2 default with 1-16 clamp in restart script (T-079-01 mitigation)"
  - "restart-backend.ps1 conditional: --reload for dev (workers=1), --workers for production (workers>1)"

patterns-established:
  - "New module-level singletons MUST be added to D-PRD-12 singleton audit table before merging"
  - "WORKER_COUNT is the sole worker-count control surface (no gunicorn/circus/supervisor)"

requirements-completed: [WORKER-LIFT-03, WORKER-LIFT-01]

# Metrics
duration: 4min
completed: 2026-05-27
---

# Phase 079 Plan 01: D-PRD-12 ADR + Multi-Worker Config Flip + Migration 052 Summary

**D-PRD-12 ADR formally supersedes D-v2.5-02 single-worker constraint; WORKER_COUNT=2 default; migration 052 adds runs.spawned_by_worker PID column; CLAUDE.md rule updated**

## Performance

- **Duration:** 4 min
- **Started:** 2026-05-26T21:46:42Z
- **Completed:** 2026-05-26T21:50:53Z
- **Tasks:** 2
- **Files modified:** 8 (1 created, 7 modified)

## Accomplishments
- D-PRD-12 ADR authored in DECISIONS.md with singleton audit table (8 singletons, each with per-worker safety mechanism and Phase 077 test reference), scaling triggers (backpressure-based), and re-trigger clause (immediate/diagnostic revert paths)
- CLAUDE.md single-worker rule replaced with multi-worker default + D-PRD-12 reference
- Migration 052 adds nullable TEXT `spawned_by_worker` column to `runs` table for post-mortem worker-PID correlation
- `insert_run` now writes `os.getpid()` for every new run
- `WORKER_COUNT=2` documented in `.env.example` with D-PRD-12 reference
- `restart-backend.ps1` reads `WORKER_COUNT` with --reload/--workers conditional and 1-16 clamp

## Task Commits

Each task was committed atomically:

1. **Task 1: Author D-PRD-12 ADR + Update PROJECT.md Key Decisions** - `0735444` (docs)
2. **Task 2: Update CLAUDE.md + .env.example + restart-backend.ps1 + Migration 052 + insert_run** - `eb6aa8e` (feat)

## Files Created/Modified
- `.planning/prd-reset/DECISIONS.md` - D-PRD-12 ADR with singleton audit table, scaling triggers, re-trigger clause
- `.planning/PROJECT.md` - New D-PRD-12 row in Key Decisions table
- `CLAUDE.md` - Replaced single-worker rule with multi-worker D-PRD-12 reference
- `backend/.env.example` - New Server section with WORKER_COUNT=2
- `scripts/restart-backend.ps1` - WORKER_COUNT reading, --reload/--workers conditional, T-079-01 clamp
- `supabase/migrations/052_runs_worker_id.sql` - spawned_by_worker nullable TEXT column
- `backend/app/db/runs.py` - spawned_by_worker param added to insert_run signature + SQL
- `backend/app/api/threads.py` - spawned_by_worker=str(os.getpid()) at run INSERT call site

## Decisions Made
- D-PRD-12 ADR authored per 079-CONTEXT.md decisions D-01 through D-04 (singleton audit table, scaling triggers, evidence references, re-trigger clause severity)
- restart-backend.ps1 uses conditional branching: --reload for WORKER_COUNT=1 (dev), --workers for WORKER_COUNT>1 (production) -- because uvicorn's --reload and --workers>1 are mutually exclusive
- T-079-01 threat mitigation: WORKER_COUNT clamped to 1-16 in restart script to prevent accidental fork-bomb
- Forward-reference comment in restart-backend.ps1 removed (Phase 079 is now executing)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added WORKER_COUNT clamp in restart-backend.ps1**
- **Found during:** Task 2 (restart-backend.ps1 update)
- **Issue:** Threat model T-079-01 identifies WORKER_COUNT as a DoS vector if set to an unreasonable value
- **Fix:** Added `[int]` cast + clamp to 1-16 range before passing to uvicorn
- **Files modified:** scripts/restart-backend.ps1
- **Verification:** Script syntax valid; clamp logic covers both underflow and overflow
- **Committed in:** eb6aa8e (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical per threat model)
**Impact on plan:** Essential security mitigation per T-079-01. No scope creep.

## Issues Encountered
None

## User Setup Required

**Migration 052 must be applied to the live local DB.** Paste `supabase/migrations/052_runs_worker_id.sql` into the Supabase SQL editor (per CLAUDE.md migration rule). Then regenerate the bootstrap artifact: `bash scripts/regenerate-full-schema.sh`.

## Next Phase Readiness
- Plan 01 deliverables complete: D-PRD-12 ADR, migration 052, code wiring, docs
- Plan 02 (live verification) can proceed: apply migration, start with WORKER_COUNT=2, run Phase 077 test suite, two-tab smoke test, backpressure spot-check

---
*Phase: 079-d-v2-5-02-supersession-multi-worker-enable*
*Completed: 2026-05-27*
