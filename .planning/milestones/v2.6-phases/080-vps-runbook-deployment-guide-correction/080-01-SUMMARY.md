---
phase: 080-vps-runbook-deployment-guide-correction
plan: 01
subsystem: docs
tags: [deployment, redis, systemd, asyncpg, multi-worker, uvicorn, upstash]

# Dependency graph
requires:
  - phase: 079-d-v2-5-02-supersession-multi-worker-enable
    provides: "D-PRD-12 ADR, WORKER_COUNT=2 default, multi-worker CLAUDE.md rule"
  - phase: 061-run-backed-streaming-backend
    provides: "Redis as runtime dependency for run-backed streaming"
  - phase: 073-asyncpg-pool-integration
    provides: "asyncpg pool with POSTGRES_DSN, POSTGRES_POOL_MIN/MAX env vars"
provides:
  - "Updated VPS deployment guide with Redis, workers, pool tuning, struck postgrest-py patch"
  - "Updated Hostinger deployment guide with matching Redis, workers, pool tuning content"
  - "Zero stale prescriptive single-worker references in active planning codebase docs"
affects: [deployment-guides, operator-onboarding]

# Tech tracking
tech-stack:
  added: []
  patterns: ["EnvironmentFile systemd pattern for WORKER_COUNT", "Redis localhost-only binding for VPS security"]

key-files:
  created: []
  modified:
    - ".planning/research/recovered/RECOVERED_VPS_Deployment_Guide.md"
    - ".planning/research/recovered/RECOVERED_Deploy_Hostinger_Supabase_Cloud.md"
    - ".planning/codebase/ARCHITECTURE.md"
    - ".planning/codebase/CONCERNS.md"

key-decisions:
  - "Renumber steps cleanly after Step 7 strike (not gap) -- guides are for new operators, not historical records"
  - "Use ${WORKER_COUNT} without :-default in systemd -- .env always has it via .env.example"
  - "Fix document encoding (single-line recovered files to proper markdown with line breaks)"
  - "Updated ARCHITECTURE.md and CONCERNS.md prescriptive single-worker references to D-PRD-12 multi-worker"

patterns-established:
  - "Deployment guides use EnvironmentFile + env var pattern for configurable worker count"
  - "Redis deployment documented with 3 options: Docker run, Docker Compose, Upstash cloud"

requirements-completed: [WORKER-LIFT-01, WORKER-LIFT-03]

# Metrics
duration: 7min
completed: 2026-05-27
---

# Phase 080 Plan 01: VPS Runbook + Deployment Guide Correction Summary

**Both deployment guides updated with Redis container deployment (3 options), EnvironmentFile+WORKER_COUNT systemd pattern, asyncpg pool tuning section, struck postgrest-py manual patch, and stale single-worker references fixed in ARCHITECTURE.md/CONCERNS.md**

## Performance

- **Duration:** 7 min
- **Started:** 2026-05-26T23:18:15Z
- **Completed:** 2026-05-26T23:25:10Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments

- VPS deployment guide fully updated with all 6 content blocks: Redis (Docker run + Compose + Upstash walkthrough), auto-patch note replacing old Step 7, EnvironmentFile systemd pattern with WORKER_COUNT, Connection Pool Tuning section, deploy script Redis health check, common errors table fix
- Hostinger deployment guide updated with matching content (4 content blocks): Redis section (Step 3.5), REDIS_URL/WORKER_COUNT/POSTGRES_DSN in .env example, EnvironmentFile systemd pattern, Connection Pool Tuning section, Redis ping in update instructions
- Stale prescriptive single-worker references fixed in ARCHITECTURE.md (2 references) and CONCERNS.md (1 reference); grep audit confirms 0 prescriptive hits remain in active codebase docs
- Both recovered documents fixed from single-line encoding to proper multi-line markdown

## Task Commits

Each task was committed atomically:

1. **Task 1: Update VPS Deployment Guide** - `5da349e` (docs)
2. **Task 2: Update Hostinger Deployment Guide** - `63f0df3` (docs)
3. **Task 3: Stale single-worker reference audit** - `30b805a` (docs)

## Files Created/Modified

- `.planning/research/recovered/RECOVERED_VPS_Deployment_Guide.md` - VPS deployment guide: Redis section, EnvironmentFile systemd, pool tuning, struck Step 7, deploy script health check, common errors fix
- `.planning/research/recovered/RECOVERED_Deploy_Hostinger_Supabase_Cloud.md` - Hostinger deployment guide: Redis section, WORKER_COUNT systemd, pool tuning, .env updates
- `.planning/codebase/ARCHITECTURE.md` - Updated entry point and threading constraint from single-worker to multi-worker (D-PRD-12)
- `.planning/codebase/CONCERNS.md` - Updated sandbox session manager status from moot-under-D-v2.5-02 to active-under-D-PRD-12

## Decisions Made

- **Clean renumbering over gap:** Steps renumbered sequentially after replacing old Step 7 (postgrest-py patch) with new Step 7 (Redis). Guides are for new operators, not historical records.
- **Plain ${WORKER_COUNT} over ${WORKER_COUNT:-2}:** Since .env always ships with WORKER_COUNT=2 via .env.example, the bash-default-substitution syntax is unnecessary and avoids systemd version compatibility questions.
- **Encoding fix applied:** Both recovered documents were single-line files with no newlines. Rewrote both with proper markdown formatting while preserving all original content and adding new sections.
- **Phase artifacts left as-is:** 124 grep hits remain in phase-level artifacts (070-077), PRDs, seeds, and roadmap. All are historical narrative describing the state when D-v2.5-02 was in force, not prescriptive. Only ARCHITECTURE.md and CONCERNS.md contained prescriptive language needing updates.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed single-line document encoding in both recovered guides**
- **Found during:** Task 1 and Task 2
- **Issue:** Both recovered guide files had zero newlines (entire document on a single line), making targeted edits impossible
- **Fix:** Rewrote both files with proper markdown formatting, preserving all original content and applying all planned edits
- **Files modified:** RECOVERED_VPS_Deployment_Guide.md, RECOVERED_Deploy_Hostinger_Supabase_Cloud.md
- **Verification:** Both files now render correctly as multi-line markdown
- **Committed in:** `5da349e` (Task 1), `63f0df3` (Task 2)

**2. [Rule 2 - Missing Critical] Added docker.io to system packages in both guides**
- **Found during:** Task 1 and Task 2
- **Issue:** Redis deployment requires Docker, but `docker.io` was not in the apt install list in Step 2 (VPS) / Step 3.2 (Hostinger)
- **Fix:** Added `docker.io` to the system packages installation command
- **Files modified:** RECOVERED_VPS_Deployment_Guide.md, RECOVERED_Deploy_Hostinger_Supabase_Cloud.md
- **Committed in:** `5da349e` (Task 1), `63f0df3` (Task 2)

**3. [Rule 2 - Missing Critical] Added Redis connection error row to VPS common errors table**
- **Found during:** Task 1
- **Issue:** No troubleshooting entry for Redis connection failures, which operators will encounter if Redis is not running
- **Fix:** Added `Redis connection refused` row with diagnosis steps
- **Files modified:** RECOVERED_VPS_Deployment_Guide.md
- **Committed in:** `5da349e` (Task 1)

---

**Total deviations:** 3 auto-fixed (1 bug, 2 missing critical)
**Impact on plan:** All auto-fixes necessary for correctness. No scope creep.

## Issues Encountered

None.

## User Setup Required

None - documentation-only phase.

## Verification Results

| SC | Description | Result |
|----|-------------|--------|
| SC#1 | VPS guide: WORKER_COUNT >= 4, redis:7-alpine >= 2, EnvironmentFile >= 1, asyncpg/POSTGRES_POOL >= 2, _patch_postgrest >= 1, REDIS_URL >= 2 | PASS (5, 2, 2, 7, 2, 4) |
| SC#2 | Hostinger guide: WORKER_COUNT >= 3, redis:7-alpine >= 2, EnvironmentFile >= 1, REDIS_URL >= 2, Connection Pool/asyncpg >= 2 | PASS (4, 2, 2, 4, 5) |
| SC#3 | Pool sizing in both docs | PASS (VPS: 7, Hostinger: 7) |
| SC#4 | Zero stale prescriptive single-worker in codebase docs | PASS (0 hits) |

## Next Phase Readiness

- Phase 080 is complete -- deployment guides now accurately reflect post-v2.6 reality
- No blockers for subsequent phases

---
*Phase: 080-vps-runbook-deployment-guide-correction*
*Completed: 2026-05-27*
