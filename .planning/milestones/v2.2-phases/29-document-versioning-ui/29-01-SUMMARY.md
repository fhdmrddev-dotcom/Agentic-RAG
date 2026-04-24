---
phase: 29-document-versioning-ui
plan: 01
subsystem: api
tags: [fastapi, documents, versioning, rest, pytest, tdd]

# Dependency graph
requires:
  - phase: 28-document-versioning-schema-ingestion
    provides: version_number and is_latest columns on documents table; re-upload creates new version row

provides:
  - GET /documents filtered to is_latest=True only (hides stale versions from library)
  - GET /documents/{id}/versions — all sibling versions ordered by version_number desc
  - POST /documents/{id}/restore — promotes historical version, retires all siblings
  - 6 unit tests covering list filter, versions endpoint, restore endpoint including NULL folder edge case

affects:
  - 29-02 (frontend versioning UI depends on these three backend endpoints)
  - test_document_versioning.py (extended with TestDocumentVersioningUI class)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - TDD (RED/GREEN): failing tests written before implementation
    - Route ordering: /{id}/versions and /{id}/restore placed BEFORE /{id} DELETE to prevent FastAPI path parameter shadowing

key-files:
  created: []
  modified:
    - backend/app/api/documents.py
    - backend/tests/unit/test_document_versioning.py

key-decisions:
  - "Route ordering: /{document_id}/versions and /{document_id}/restore must appear before /{document_id} DELETE to prevent FastAPI matching 'versions'/'restore' as a document_id parameter"
  - "is_latest filter added to BOTH own_docs and global_docs queries in list_documents (VER-03)"
  - "restore endpoint uses .is_('folder_id', 'null') for NULL folder_id guard to correctly scope sibling query in Supabase"
  - "Test data: folder_id must be a valid UUID string when testing restore endpoint due to DocumentResponse Pydantic validation"

patterns-established:
  - "NULL folder sibling query pattern: if folder_id is None use .is_('folder_id', 'null') else .eq('folder_id', folder_id)"

requirements-completed:
  - VER-03
  - VER-04
  - VER-05

# Metrics
duration: 8min
completed: 2026-04-13
---

# Phase 29 Plan 01: Document Versioning UI Backend Summary

**FastAPI document versioning endpoints — is_latest list filter, GET /{id}/versions, and POST /{id}/restore with NULL folder guard and 6 TDD-verified unit tests**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-04-13T14:02:36Z
- **Completed:** 2026-04-13T14:10:00Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments

- Added `.eq("is_latest", True)` to both own_docs and global_docs queries in `list_documents` so the document library hides stale versions
- Added `GET /documents/{document_id}/versions` endpoint that verifies ownership then returns all sibling versions ordered by version_number desc
- Added `POST /documents/{document_id}/restore` endpoint that retires all siblings (is_latest=False) then promotes the target (is_latest=True), with correct NULL folder_id handling via `.is_("folder_id", "null")`
- Registered new routes before `DELETE /{document_id}` to prevent FastAPI path-parameter shadowing of "versions"/"restore"
- Wrote 6 unit tests in `TestDocumentVersioningUI` class covering: list filter assertion, versions returned, 404 not-found, restore promotes target, NULL folder uses is_null, unauthorized 404

## Task Commits

1. **Task 1: Add is_latest filter, versions endpoint, restore endpoint** - `83056a3` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `backend/app/api/documents.py` - Added is_latest filter to list_documents, added list_document_versions and restore_document_version endpoints
- `backend/tests/unit/test_document_versioning.py` - Added TestDocumentVersioningUI class with 6 unit tests

## Decisions Made

- Route ordering: New `GET /{document_id}/versions` and `POST /{document_id}/restore` placed after `GET ""` list endpoint but before `DELETE /{document_id}` to prevent FastAPI treating "versions" as a document_id value
- NULL folder sibling query uses `.is_("folder_id", "null")` not `.eq("folder_id", None)` — Supabase requires explicit IS NULL syntax
- Test mock uses valid UUID string for folder_id since DocumentResponse Pydantic model validates UUID format on serialize

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed test mock folder_id to use valid UUID**
- **Found during:** Task 1 (GREEN phase - test_restore_promotes_target)
- **Issue:** Test used `folder_id="folder-1"` which is not a valid UUID; FastAPI's ResponseValidationError was raised because DocumentResponse.folder_id is `UUID | None`
- **Fix:** Changed `folder_id="folder-1"` to `folder_id="00000000-0000-0000-0000-000000000099"` in test mock data
- **Files modified:** backend/tests/unit/test_document_versioning.py
- **Verification:** test_restore_promotes_target passes with 200 response
- **Committed in:** 83056a3 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug in test data)
**Impact on plan:** Minor test data fix. No scope creep. No implementation changes.

## Issues Encountered

None beyond the test UUID fix documented above.

## Next Phase Readiness

- All three backend endpoints are live and tested; Plan 29-02 (frontend version history UI) can proceed
- Version badge in document library requires is_latest-filtered list (now available)
- History drawer requires GET /{id}/versions (now available)
- Restore button requires POST /{id}/restore (now available)

---
*Phase: 29-document-versioning-ui*
*Completed: 2026-04-13*
