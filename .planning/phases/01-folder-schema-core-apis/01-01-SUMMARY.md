---
phase: 01-folder-schema-core-apis
plan: 01
subsystem: database, api
tags: [postgres, supabase, fastapi, pydantic, rls, adjacency-list]

# Dependency graph
requires: []
provides:
  - folders table (adjacency list) with RLS, 2 indexes, cascade delete, updated_at trigger
  - FolderCreate, FolderUpdate, FolderResponse Pydantic models
  - 5 CRUD endpoints: GET /folders, GET /folders/{id}/children, POST /folders, PATCH /folders/{id}, DELETE /folders/{id}
  - Router registered in main.py
affects: [02-document-folder-integration, 03-ingestion-ui, 04-kb-navigation-tools, 05-search-tools, 06-explorer-subagent]

# Tech tracking
tech-stack:
  added: []
  patterns: [adjacency-list-self-referential-fk, rls-or-visibility, service-role-manual-ownership-filter]

key-files:
  created:
    - backend/supabase/migrations/013_folders.sql
    - backend/app/models/folder.py
    - backend/app/api/folders.py
  modified:
    - backend/app/main.py

key-decisions:
  - "Any authenticated user can create global folders — no admin concept in v1.0"
  - "GET /folders returns owned + global in one list with is_global field for frontend distinction"
  - "parent_id validation on create: verify parent is owned by user OR is_global before allowing nesting"
  - "Service-role key pattern maintained — ownership enforced via .eq(user_id) not RLS JWT"

patterns-established:
  - "Pattern: .or_() filter for OR visibility (user_id.eq.X,is_global.eq.true) with deduplication"
  - "Pattern: parent_id validation uses .maybe_single() + check not parent.data for 404"
  - "Pattern: rename returns updated row directly from update result (result.data[0])"

requirements-completed: [FOLDER-01, FOLDER-02, FOLDER-03, FOLDER-05]

# Metrics
duration: 2min
completed: 2026-03-21
---

# Phase 01 Plan 01: Folder Schema & Core APIs Summary

**Postgres adjacency-list folders table with RLS, 4 policies, cascade delete, and 5 FastAPI CRUD endpoints covering create/list/list-children/rename/delete with service-role ownership enforcement**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-03-21T12:33:26Z
- **Completed:** 2026-03-21T12:35:21Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Migration 013_folders.sql: adjacency-list schema with self-referential FK, 2 indexes, 4 RLS policies (SELECT/INSERT/UPDATE/DELETE), and updated_at trigger reusing existing set_updated_at() function
- Pydantic models (FolderCreate, FolderUpdate, FolderResponse) following thread.py pattern exactly
- 5 CRUD endpoints with OR visibility logic (.or_() filter), parent_id ownership validation on create, and manual user_id ownership enforcement on all mutable operations
- Router registered in main.py alongside existing thread/document/settings routers

## Task Commits

Each task was committed atomically:

1. **Task 1: Create migration SQL and Pydantic models** - `913b56f` (feat)
2. **Task 2: Create folder API router and register in main.py** - `f58ba5f` (feat)

## Files Created/Modified
- `backend/supabase/migrations/013_folders.sql` - Adjacency list table, RLS policies, indexes, trigger
- `backend/app/models/folder.py` - FolderCreate, FolderUpdate, FolderResponse Pydantic models
- `backend/app/api/folders.py` - 5 CRUD endpoints with service-role ownership enforcement
- `backend/app/main.py` - Added folders import and router registration

## Decisions Made
- Any authenticated user can mark a folder as `is_global=true` — no admin concept in v1.0. Can restrict in a future phase.
- Single `GET /folders` endpoint returns both owned and global folders (deduplicated), with `is_global` field for frontend to distinguish visually (Phase 3 UI work)
- `parent_id` validation on create checks that parent is accessible (owned OR global) — prevents cross-user nesting per must_have truth
- Used `result.data[0]` directly from update result (not a separate SELECT) matching threads.py rename pattern

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

**Migration must be applied to Supabase before using folder endpoints.** Apply via Supabase dashboard SQL editor or CLI:

```bash
supabase db push
# or manually run: backend/supabase/migrations/013_folders.sql
```

No new environment variables required.

## Next Phase Readiness
- Phase 2 (document-folder integration) can now add `folder_id` FK to documents table pointing to `public.folders(id)`
- All folder CRUD endpoints available at `/folders` prefix, ready for frontend integration in Phase 3
- Cascade delete from Phase 1 only cascades within folders; document cascade FK handled in Phase 2

## Self-Check: PASSED

- backend/supabase/migrations/013_folders.sql: FOUND
- backend/app/models/folder.py: FOUND
- backend/app/api/folders.py: FOUND
- .planning/phases/01-folder-schema-core-apis/01-01-SUMMARY.md: FOUND
- Commit 913b56f: FOUND
- Commit f58ba5f: FOUND

---
*Phase: 01-folder-schema-core-apis*
*Completed: 2026-03-21*
