---
phase: 04-navigation-tools
plan: 01
subsystem: api
tags: [fastapi, pydantic, supabase, rls, pytest]

# Dependency graph
requires:
  - phase: 03-ingestion-ui
    provides: folder tree, folder_id on documents
  - phase: 02-document-folder-integration
    provides: documents.folder_id FK, full_markdown column
  - phase: 01-folder-schema-core-apis
    provides: folders table with adjacency list and RLS

provides:
  - GET /kb/ls endpoint with root and subfolder path navigation
  - Pydantic models: DocumentEntry, FolderEntry, LsResponse, TreeNode, TreeResponse
  - Shared helpers: _fetch_visible_folders, _build_tree_map, _resolve_path (reused by Plan 02 tree endpoint)
  - Tree endpoint skeleton registered at /kb/tree (implementation deferred to Plan 02)

affects: [04-02-tree-endpoint, future-kb-tools]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "kb router with /kb prefix separating navigation tools from CRUD APIs"
    - "Single-fetch all visible folders then build in-memory tree for path resolution"
    - "case-insensitive path segment matching in _resolve_path"
    - ".is_('folder_id', 'null') string form for Supabase IS NULL checks (not Python None)"
    - "side_effect list on mock_builder.execute for sequential DB call simulation in tests"

key-files:
  created:
    - backend/app/models/kb.py
    - backend/app/api/kb.py
    - backend/tests/integration/test_kb.py
  modified:
    - backend/app/main.py
    - backend/tests/conftest.py

key-decisions:
  - "Single-fetch all visible folders + in-memory tree build avoids N+1 queries for path resolution"
  - "ls endpoint implemented in same commit as skeleton (Tasks 1+2 combined) — no reason for partial state"
  - "conftest .is_ and .or_ wiring added globally (not per-test) — fixes Pitfall 3 for all current and future tests"
  - "Pre-existing test failures in test_threads, test_retrieval_service, test_module7_tools are out of scope — not caused by this plan"

patterns-established:
  - "Pattern: fetch all visible folders once, build tree map in Python, walk segments — used by ls and will be reused by tree"
  - "Pattern: or_(user_id.eq.{uid},is_global.eq.true) + dedup for RLS-safe folder fetching"

requirements-completed: [TOOL-01]

# Metrics
duration: 2min 27sec
completed: 2026-03-21
---

# Phase 4 Plan 1: ls Navigation Tool Summary

**FastAPI /kb/ls endpoint with in-memory tree path resolution, Pydantic response models, and 5 passing integration tests covering root listing, subfolder listing, 404, empty folder, and RLS filtering**

## Performance

- **Duration:** 2 min 27 sec
- **Started:** 2026-03-21T19:24:57Z
- **Completed:** 2026-03-21T19:27:24Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments
- Created all 5 Pydantic models (DocumentEntry, FolderEntry, LsResponse, TreeNode, TreeResponse) in backend/app/models/kb.py
- Implemented /kb/ls endpoint with root path (IS NULL document query) and subfolder path (404 on bad path, eq filter for documents) support
- Added shared helpers (_fetch_visible_folders, _build_tree_map, _resolve_path) that will be reused by the Plan 02 tree endpoint
- Updated conftest.py to wire .is_ and .or_ builder methods globally, fixing mock chaining for all tests
- 5 integration tests pass; no regressions in existing passing tests

## Task Commits

Each task was committed atomically:

1. **Task 1+2: Models, router skeleton, ls implementation, main.py registration** - `8af091b` (feat)
2. **Task 3: Integration tests for ls + conftest .is_/.or_ wiring** - `1c36f95` (test)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified
- `backend/app/models/kb.py` - DocumentEntry, FolderEntry, LsResponse, TreeNode, TreeResponse Pydantic models
- `backend/app/api/kb.py` - KB router with ls endpoint, tree skeleton, and 3 shared helper functions
- `backend/app/main.py` - Added kb router import and app.include_router(kb.router)
- `backend/tests/integration/test_kb.py` - TestLs with 5 integration tests
- `backend/tests/conftest.py` - Added .is_ and .or_ chain wiring to _make_builder and reset_mocks

## Decisions Made
- Single-fetch all visible folders + build in-memory tree avoids N+1 Supabase queries per path segment
- `.is_("folder_id", "null")` uses string "null" (not Python None) per Supabase PostgREST IS NULL syntax
- conftest .is_ and .or_ wiring added globally so future tests don't each need per-test setup
- Tasks 1 and 2 committed together since the ls implementation was part of the same file creation (no partial state reason to separate)

## Deviations from Plan

None — plan executed exactly as written. Tasks 1 and 2 were combined into a single commit since the ls implementation (Task 2) was included in the same file creation pass as the skeleton (Task 1).

## Issues Encountered

Pre-existing test failures (13 tests in test_threads, test_retrieval_service, test_module7_tools, test_openai_service, test_sql_service) are out of scope and were present before this plan began. Verified by stash check.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness
- /kb/ls endpoint fully functional with all tests passing
- Shared helpers (_fetch_visible_folders, _build_tree_map, _resolve_path) ready for Plan 02 tree endpoint
- Tree endpoint skeleton already registered at /kb/tree (returns None currently; Plan 02 implements it)

---
*Phase: 04-navigation-tools*
*Completed: 2026-03-21*
