---
phase: 01-folder-schema-core-apis
plan: 02
subsystem: testing, api
tags: [pytest, integration-tests, fastapi, mocking, supabase]

# Dependency graph
requires:
  - folders table (from 01-01)
  - FolderCreate, FolderUpdate, FolderResponse Pydantic models (from 01-01)
  - 5 CRUD endpoints at /folders (from 01-01)
provides:
  - Integration tests for all 5 folder CRUD endpoints (23 test cases)
  - Test coverage for ownership enforcement, visibility rules, and edge cases
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - mock_builder.or_.return_value = mock_builder pattern to restore or_() chain in tests
    - side_effect list pattern for multi-query endpoints

key-files:
  created:
    - backend/tests/integration/test_folders.py
  modified: []

key-decisions:
  - "or_() breaks the MagicMock chain by default — restore with mock_builder.or_.return_value = mock_builder in tests that need it"
  - "Pre-existing test failures in test_documents.py and other test files are out of scope — documented as deferred"

requirements-completed: [FOLDER-01, FOLDER-02, FOLDER-03, FOLDER-05]

# Metrics
duration: ~3min
completed: 2026-03-21
---

# Phase 01 Plan 02: Folder CRUD Integration Tests Summary

**23 integration tests across 5 test classes verifying folder create/list/rename/delete endpoints with ownership enforcement, global visibility, whitespace stripping, and parent_id validation**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-03-21T12:29:48Z
- **Completed:** 2026-03-21T12:32:51Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- 23 test cases in `backend/tests/integration/test_folders.py` organized into 5 classes:
  - `TestCreateFolder` (6 tests): root folder, nested folder, whitespace stripping, invalid parent 404, global folder, user_id injection
  - `TestListFolders` (5 tests): 200 response, returns data, empty list, or_() filter assertion, deduplication
  - `TestListChildren` (3 tests): 200 response, returns child rows, parent_id eq filter
  - `TestRenameFolder` (4 tests): success with updated name, update called with stripped name, not found 404, ownership enforcement
  - `TestDeleteFolder` (4 tests): 204 response, delete called, ownership enforcement, folder_id filter
- All 23 tests pass; no regressions introduced

## Task Commits

1. **Task 1: Write integration tests for folder CRUD endpoints** - `2722c76` (test)

## Files Created/Modified

- `backend/tests/integration/test_folders.py` - 302 lines, 23 integration tests

## Decisions Made

- `or_()` in the MagicMock builder chain breaks off to a new auto-generated MagicMock by default (since `or_` is not in the explicit chain setup in conftest.py). Tests that rely on the or_() result flowing back through `_builder` (create with parent_id validation, invalid parent 404) restore the chain with `mock_builder.or_.return_value = mock_builder` inline in the test.
- Pre-existing test failures in `test_documents.py` (content_hash field missing), `test_threads.py`, and unit tests are confirmed pre-existing and out of scope for this plan.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed or_() chain detachment in mock tests**
- **Found during:** Task 1 (test execution)
- **Issue:** `test_create_nested_folder` failed with `KeyError: 0` because the `or_()` call on the Supabase mock builder creates a new detached MagicMock, causing side_effect ordering to misalign. The insert result landed at `side_effect[0]` but was being treated as a dict not a list.
- **Fix:** Added `mock_builder.or_.return_value = mock_builder` in the two tests that require proper chaining (`test_create_nested_folder`, `test_create_folder_invalid_parent_404`) to restore the fluent chain through `_builder`.
- **Files modified:** `backend/tests/integration/test_folders.py`
- **Commit:** 2722c76

## Known Stubs

None — test file only, no UI or data stubs.

## Issues Encountered

Pre-existing test failures confirmed in: `test_documents.py` (missing `content_hash` field), `test_threads.py` (SSE stream tests), `test_module7_tools.py`, `test_openai_service.py`, `test_retrieval_service.py`, `test_sql_service.py`. All confirmed pre-existing via git stash verification. None caused by this plan.

## Self-Check: PASSED

- backend/tests/integration/test_folders.py: FOUND
- Commit 2722c76: FOUND
- Test count: 23 (> 10 required)
- All required test functions present: test_create_root_folder, test_create_nested_folder, test_create_folder_invalid_parent_404, test_create_global_folder, test_list_folders_returns_200, test_list_children_returns_200, test_rename_folder, test_rename_folder_not_found, test_delete_folder_returns_204

---
*Phase: 01-folder-schema-core-apis*
*Completed: 2026-03-21*
