---
phase: 10-agent-skills-core
plan: 01
subsystem: database
tags: [supabase, postgres, pydantic, rls, storage, pytest, tdd]

# Dependency graph
requires:
  - phase: 09-persistent-tool-memory
    provides: working FastAPI backend with test infrastructure (conftest.py, fixtures)
  - phase: 01-folder-schema-core-apis
    provides: set_updated_at() trigger function reused by skills migration

provides:
  - skills table with 9 columns, RLS (4 policies), updated_at trigger
  - skill_files table with 8 columns, RLS (3 policies)
  - skill-files Storage bucket (private) with 3 storage.objects RLS policies
  - Pydantic models: SkillCreate, SkillUpdate, SkillResponse, SkillFileResponse
  - Test scaffold for all 10 Phase 10 requirements (RED state — router not yet built)

affects: [10-agent-skills-core, skills-router, skills-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Mirror folder.py pattern for Pydantic models — SkillCreate/SkillUpdate/SkillResponse
    - TDD wave 0 scaffold — test file created before router, tests fail RED until Plan 02
    - Storage RLS uses (storage.foldername(name))[1] = auth.uid()::text for path-based ownership
    - Global skill fallback in storage SELECT policy via JOIN on skill_files + skills tables

key-files:
  created:
    - supabase/migrations/017_skills.sql
    - backend/app/models/skill.py
    - backend/tests/integration/test_skills.py
  modified: []

key-decisions:
  - "skill_files has no updated_at column — SkillFileResponse omits updated_at to match schema"
  - "Storage RLS SELECT policy allows global skill file access via subquery JOIN on skill_files + skills"
  - "Test scaffold created in RED state — all 10 tests expected to fail until Plan 02 router is built"
  - "updated_at trigger on skills reuses existing set_updated_at() function from migration 014 (no duplication)"

patterns-established:
  - "Wave 0 TDD: test scaffold committed before any router code — confirms router absence causes 404s"
  - "Storage bucket creation uses ON CONFLICT (id) DO NOTHING for idempotent migrations"

requirements-completed: [SKIL-01, SKIL-02, SKIL-03, SKIL-04, SKIL-05, SKIL-06, FILE-01, FILE-02, FILE-03, FILE-06]

# Metrics
duration: 2min 3sec
completed: 2026-03-29
---

# Phase 10 Plan 01: Agent Skills Core — Database Foundation Summary

**Supabase migration with skills + skill_files tables, RLS, private Storage bucket, Pydantic type contracts, and failing TDD scaffold covering all 10 Phase 10 requirements**

## Performance

- **Duration:** 2min 3sec
- **Started:** 2026-03-29T15:39:39Z
- **Completed:** 2026-03-29T15:41:42Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments

- SQL migration 017 creates both tables with correct columns, indexes, RLS policies (10 total), updated_at trigger, and private skill-files Storage bucket
- Four Pydantic models (SkillCreate, SkillUpdate, SkillResponse, SkillFileResponse) import cleanly with field names exactly matching SQL column names
- TDD wave 0 scaffold covers all 8 test classes and 10 requirement IDs — tests fail RED confirming the router doesn't exist yet

## Task Commits

Each task was committed atomically:

1. **Task 1: SQL migration** - `85fcae5` (feat)
2. **Task 2: Pydantic models** - `b71d58d` (feat)
3. **Task 3: Test scaffold** - `50dc819` (test)

**Plan metadata:** committed after SUMMARY (docs)

## Files Created/Modified

- `supabase/migrations/017_skills.sql` - skills + skill_files tables, RLS, Storage bucket + storage RLS
- `backend/app/models/skill.py` - SkillCreate, SkillUpdate, SkillResponse, SkillFileResponse models
- `backend/tests/integration/test_skills.py` - TDD wave 0 scaffold: 8 test classes, 10 tests, all RED

## Decisions Made

- `skill_files` has no `updated_at` column — `SkillFileResponse` deliberately omits it to match the schema; no inconsistency with the model
- Storage RLS SELECT policy for global skill files uses a subquery `JOIN public.skill_files sf JOIN public.skills s ON s.id = sf.skill_id WHERE sf.file_path = name AND s.is_global = true` — allows all authenticated users to download files attached to global skills
- Test scaffold committed in RED state — this is intentional Wave 0 behavior; Plan 02 router implementation makes tests GREEN
- Trigger `skills_set_updated_at` reuses `public.set_updated_at()` defined in migration 014 — no duplication needed

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. All three tasks executed cleanly on first attempt.

## User Setup Required

None - no external service configuration required. Migration is applied via `supabase db push` (no changes to existing workflow).

## Next Phase Readiness

- Database schema and type contracts are fully established — Plan 02 can implement the skills router and make tests GREEN
- All 10 requirement IDs have stub tests; Plan 02 and Plan 03 will implement and verify them
- The `conftest.py` storage mock (`_supabase.storage.from_.return_value`) is already wired and used in upload/delete tests

---
*Phase: 10-agent-skills-core*
*Completed: 2026-03-29*

## Self-Check: PASSED

- FOUND: supabase/migrations/017_skills.sql
- FOUND: backend/app/models/skill.py
- FOUND: backend/tests/integration/test_skills.py
- FOUND: .planning/phases/10-agent-skills-core/10-01-SUMMARY.md
- FOUND commit: 85fcae5 (SQL migration)
- FOUND commit: b71d58d (Pydantic models)
- FOUND commit: 50dc819 (test scaffold)
