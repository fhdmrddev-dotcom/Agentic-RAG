---
phase: 02-document-folder-integration
plan: 02
subsystem: testing
tags: [pytest, integration-tests, fastapi, mock, supabase]

# Dependency graph
requires:
  - phase: 02-document-folder-integration
    provides: Upload with folder_id endpoint, PATCH /documents/{id}/move, PATCH /folders/{id}/move, full_markdown stored in ingest

provides:
  - Integration tests for upload with folder_id (valid and invalid)
  - TestMoveDocument: 4 tests covering move to folder, root, doc not found, invalid folder
  - TestMoveFolder: 4 tests covering move to parent, root, invalid parent, not owned
  - TestFullMarkdown: verifies full_markdown stored in ingest completion update
  - Updated _doc_row helper with folder_id and content_hash fields
  - Fixed conftest builder mock to wire .neq() and .limit() methods
affects: [03-ingestion-ui, 04-kb-tools-ls-tree, 05-kb-tools-grep-glob-read]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Upload tests using folder_id must use mock_builder side_effect (sequential: folder validation -> dedup -> stale -> insert)"
    - "Move endpoint tests: 3-step side_effect for move-to-folder (ownership check -> folder validation -> update)"
    - "Move-to-root tests: 2-step side_effect (ownership check -> update, no folder validation)"
    - "or_() tests must restore chain: mock_builder.or_.return_value = mock_builder"

key-files:
  created: []
  modified:
    - backend/tests/integration/test_documents.py
    - backend/tests/integration/test_folders.py
    - backend/tests/conftest.py

key-decisions:
  - "Upload tests converted to mock_builder side_effect (multi-query flow: dedup+stale+insert cannot share single execute result)"
  - ".neq() and .limit() added to conftest builder wiring — required by dedup/stale queries added in Plan 01"

patterns-established:
  - "Multi-query endpoint tests always use mock_builder.execute.side_effect list rather than mock_execute_result"
  - "side_effect order must mirror actual code execution order — comments document each call"

requirements-completed: [FOLDER-04, DOC-01, DOC-02, DOC-03]

# Metrics
duration: 8min
completed: 2026-03-21
---

# Phase 02 Plan 02: Integration Tests for Document-Folder Features Summary

**51 passing integration tests covering upload-with-folder, document move, folder move, and full_markdown storage — with conftest builder fix enabling multi-query mock patterns.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-03-21T14:36:00Z
- **Completed:** 2026-03-21T14:44:26Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Updated `_doc_row` helper with `folder_id` parameter and `content_hash` field to match updated `DocumentResponse` model
- Added `TestMoveDocument` (4 tests) and `TestFullMarkdown` (1 test) to `test_documents.py`; added `TestUploadDocument` upload-with-folder tests (2 tests)
- Added `TestMoveFolder` (4 tests) to `test_folders.py` covering full move-folder lifecycle
- Fixed conftest builder mock to wire `.neq()` and `.limit()` — required by dedup/stale queries added in Plan 01 that were silently breaking existing upload tests
- All 51 tests pass (24 document + 27 folder)

## Task Commits

Each task was committed atomically:

1. **Task 1: Update _doc_row and add upload/move document/full_markdown tests** - `a7fa36b` (feat)
2. **Task 2: Add TestMoveFolder tests** - `b262832` (feat)

## Files Created/Modified

- `backend/tests/integration/test_documents.py` - Updated _doc_row helper, converted existing upload tests to mock_builder side_effect, added TestMoveDocument (4 tests), TestFullMarkdown (1 test), and 2 upload-with-folder tests
- `backend/tests/integration/test_folders.py` - Added TestMoveFolder class with 4 tests
- `backend/tests/conftest.py` - Added .neq() and .limit() to builder mock wiring in both _make_builder and reset_mocks fixture

## Decisions Made

- Converted existing `TestUploadDocument` tests from `mock_execute_result` to `mock_builder` with `side_effect`: the upload endpoint now makes 3 sequential DB calls (dedup check, stale check, insert) — a shared single execute result cannot service this pattern correctly
- Added `.neq()` and `.limit()` to conftest builder wiring as a Rule 1 bug fix: Plan 01 introduced these method calls in the dedup/stale queries but the conftest was never updated, causing `.limit()` to break the mock chain and return untyped MagicMock objects instead of the configured result

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed upload tests broken by Plan 01 dedup/stale queries**
- **Found during:** Task 1 (running tests after updating _doc_row)
- **Issue:** Existing `TestUploadDocument` tests using `mock_execute_result` returned 200 instead of 201 because the dedup check `.limit().execute()` returned the same `mock_execute_result` that had `data = [_doc_row()]` set for the insert — making the endpoint think a duplicate existed and short-circuit to 200
- **Fix:** Converted all basic upload tests to use `mock_builder.execute.side_effect` with sequential results; added `.neq()` and `.limit()` wiring to conftest
- **Files modified:** backend/tests/integration/test_documents.py, backend/tests/conftest.py
- **Verification:** All 24 document tests pass including previously-failing tests
- **Committed in:** a7fa36b (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug)
**Impact on plan:** Required to achieve "existing tests still pass" acceptance criterion. Pre-existing regression introduced by Plan 01 endpoint changes. No scope creep.

## Issues Encountered

The plan's comment in `test_upload_with_valid_folder_id_returns_201` listed execute order as "1=dedup, 2=stale, 3=folder validation, 4=insert" but the actual implementation validates folder FIRST (before dedup/stale). Tests were written to match the actual code order: folder validation → dedup → stale → insert.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All Phase 2 integration tests complete and passing (51 total)
- Backend document-folder integration fully verified
- Phase 03 (ingestion UI) can now build against validated endpoints

---
*Phase: 02-document-folder-integration*
*Completed: 2026-03-21*

## Self-Check: PASSED

- backend/tests/integration/test_documents.py: FOUND
- backend/tests/integration/test_folders.py: FOUND
- .planning/phases/02-document-folder-integration/02-02-SUMMARY.md: FOUND
- Commit a7fa36b: FOUND
- Commit b262832: FOUND
