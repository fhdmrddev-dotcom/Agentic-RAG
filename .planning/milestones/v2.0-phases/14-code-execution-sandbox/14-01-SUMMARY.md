---
phase: 14-code-execution-sandbox
plan: 01
subsystem: api
tags: [python, sandbox, docker, llm-sandbox, fastapi, supabase, sql, rls]

# Dependency graph
requires:
  - phase: 13-skills-open-standard
    provides: skills system foundation and patterns for service modules
provides:
  - SandboxSessionManager service with lazy Docker import, TTL eviction, session lifecycle management
  - sandbox_enabled and sandbox_ttl_minutes config settings
  - 015_sandbox.sql migration with code_executions + sandbox_files tables, RLS policies, sandbox-outputs bucket
  - llm-sandbox[docker] installed in venv
affects: [14-02, 14-03, 14-04, 14-05]

# Tech tracking
tech-stack:
  added: [llm-sandbox[docker]>=0.3.37, docker>=7.1.0, pywin32>=311]
  patterns:
    - Lazy import guard pattern — llm_sandbox imported only inside get_or_create() so Docker SDK never loads when disabled
    - Module-level dict state for session registry with time-based TTL eviction
    - Singleton service exported as sandbox_manager for direct import by consumers

key-files:
  created:
    - backend/app/services/sandbox_service.py
    - backend/supabase/migrations/015_sandbox.sql
    - backend/tests/unit/test_sandbox_service.py
  modified:
    - backend/requirements.txt
    - backend/app/config.py

key-decisions:
  - "Lazy import of llm_sandbox inside get_or_create() ensures Docker SDK never loads when SANDBOX_ENABLED=false — prevents startup failures on machines without Docker"
  - "Module-level _sessions/_last_used dicts (not instance vars) allow tests to clear state between runs without reinstantiating the manager"
  - "TTL eviction is lazy (checked on get_or_create) rather than a background thread — simpler, no async complexity"
  - "sandbox_enabled defaults to False — opt-in flag, never breaks existing deployments"

patterns-established:
  - "Lazy import guard: from llm_sandbox import X inside function body (not module level) for optional heavy dependencies"
  - "Module-level singleton: sandbox_manager = SandboxSessionManager() exported for direct import"

requirements-completed: [SAND-02, SAND-03, SAND-11, SAND-13]

# Metrics
duration: 2min 11sec
completed: 2026-04-03
---

# Phase 14 Plan 01: Code Execution Sandbox Foundation Summary

**Docker sandbox session manager with lazy llm-sandbox import, module-level TTL eviction, and Supabase tables (code_executions + sandbox_files) with RLS policies**

## Performance

- **Duration:** 2 min 11 sec
- **Started:** 2026-04-03T11:55:35Z
- **Completed:** 2026-04-03T11:57:46Z
- **Tasks:** 2 (with TDD RED/GREEN commits for Task 2)
- **Files modified:** 5

## Accomplishments
- Installed llm-sandbox[docker]>=0.3.37 in venv; added to requirements.txt
- Added `sandbox_enabled: bool = False` and `sandbox_ttl_minutes: int = 30` to Settings
- Created 015_sandbox.sql with code_executions table, sandbox_files table, dual RLS policies each, and sandbox-outputs private storage bucket
- Implemented SandboxSessionManager with lazy Docker import, get_or_create, close_session, close_all, TTL eviction
- All 7 unit tests pass (TDD: RED commit first, then GREEN implementation)

## Task Commits

Each task was committed atomically:

1. **Task 1: Install llm-sandbox, add config settings, create SQL migration** - `f6a7521` (feat)
2. **Task 2 RED: Failing tests for SandboxSessionManager** - `3c7ce88` (test)
3. **Task 2 GREEN: Implement SandboxSessionManager** - `311374b` (feat)

_Note: Task 2 is TDD — test commit before implementation commit._

## Files Created/Modified
- `backend/requirements.txt` - Added llm-sandbox[docker]>=0.3.37
- `backend/app/config.py` - Added sandbox_enabled and sandbox_ttl_minutes settings
- `backend/supabase/migrations/015_sandbox.sql` - code_executions + sandbox_files tables with RLS + sandbox-outputs bucket
- `backend/app/services/sandbox_service.py` - SandboxSessionManager class with sandbox_manager singleton
- `backend/tests/unit/test_sandbox_service.py` - 7 unit tests covering all session lifecycle behaviors

## Decisions Made
- Lazy import of llm_sandbox (inside get_or_create body) means no Docker SDK import at module level — sandbox feature can be disabled without requiring Docker installed
- Module-level _sessions/_last_used dicts instead of instance vars — allows tests to clear state between runs by importing and calling .clear() directly
- TTL eviction is lazy (on each get_or_create call) rather than a background thread — avoids async complexity in an otherwise sync utility
- sandbox_enabled defaults to False — all existing deployments unaffected

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required for this plan. Users who want sandbox enabled must set `SANDBOX_ENABLED=true` in their .env (handled in later plans).

## Next Phase Readiness
- SandboxSessionManager ready for 14-02 to wire into execute_code tool
- SQL migration ready to apply to Supabase instance
- Config settings ready for 14-03 (SSE streaming) to reference
- No blockers.

## Self-Check: PASSED

All files present and all commits verified.

---
*Phase: 14-code-execution-sandbox*
*Completed: 2026-04-03*
