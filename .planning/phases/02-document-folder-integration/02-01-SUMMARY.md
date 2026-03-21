---
phase: 02-document-folder-integration
plan: 01
subsystem: api
tags: [fastapi, pydantic, postgres, supabase, migration, sql]

# Dependency graph
requires:
  - phase: 01-folder-schema-core-apis
    provides: folders table with RLS, FolderResponse model, folder CRUD endpoints
provides:
  - Migration 014 adding folder_id FK (ON DELETE SET NULL) and full_markdown columns to documents
  - DocumentResponse with folder_id field for folder-aware document listing
  - DocumentMoveRequest and FolderMoveRequest Pydantic models
  - Upload endpoint accepting optional folder_id Form field with folder accessibility validation
  - PATCH /documents/{id}/move endpoint for moving documents between folders
  - PATCH /folders/{id}/move endpoint for moving folders between parents
  - full_markdown stored during ingest completion for future grep/read tools
affects: [03-ingestion-ui, 04-kb-tools-ls-tree, 05-kb-tools-grep-glob-read]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "folder accessibility validation uses .or_(f'user_id.eq.{user_id},is_global.eq.true') pattern"
    - "move endpoints verify ownership via .eq('user_id', current_user['id']) then update"
    - "folder_id persisted as nullable string on document insert; None = root"

key-files:
  created:
    - backend/supabase/migrations/014_document_folder_integration.sql
  modified:
    - backend/app/models/document.py
    - backend/app/models/folder.py
    - backend/app/api/documents.py
    - backend/app/api/folders.py

key-decisions:
  - "ON DELETE SET NULL on folder_id FK: deleting a folder orphans documents to root rather than destroying them"
  - "full_markdown not included in DocumentResponse: too large for list responses; Phase 6 read tool retrieves it directly"
  - "folder_id accepted as Form field (not JSON) because upload endpoint uses multipart/form-data for file upload"
  - "move_document uses maybe_single ownership check then separate update — avoids leaking existence of other users' documents"

patterns-established:
  - "Form field injection alongside File upload: add Form import, add param with = Form(None) after file param"
  - "Move endpoint pattern: verify ownership -> validate target accessibility -> perform update -> return result.data[0]"

requirements-completed: [FOLDER-04, DOC-01, DOC-02, DOC-03]

# Metrics
duration: 2min
completed: 2026-03-21
---

# Phase 02 Plan 01: Document-Folder Integration — Backend Summary

**Migration 014 adds folder_id FK and full_markdown to documents; upload and move endpoints wire documents and folders together with ownership-enforced PATCH /move routes.**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-21T14:36:05Z
- **Completed:** 2026-03-21T14:37:59Z
- **Tasks:** 2
- **Files modified:** 4 (+ 1 created)

## Accomplishments

- Migration 014 SQL ready: folder_id nullable FK to folders (ON DELETE SET NULL), full_markdown text column, index on folder_id
- DocumentResponse gains folder_id field; DocumentMoveRequest and FolderMoveRequest models created
- Upload endpoint now accepts optional folder_id Form field, validates folder accessibility, and persists it to the documents row
- PATCH /documents/{id}/move and PATCH /folders/{id}/move endpoints added with full ownership and accessibility validation
- full_markdown stored in ingest_document completion update, making document content available for future grep/read KB tools

## Task Commits

Each task was committed atomically:

1. **Task 1: Create migration SQL and update Pydantic models** - `c031073` (feat)
2. **Task 2: Extend upload endpoint, add move endpoints, store full_markdown** - `15e8455` (feat)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified

- `backend/supabase/migrations/014_document_folder_integration.sql` - Adds folder_id FK (ON DELETE SET NULL), full_markdown, and folder_id index to documents table
- `backend/app/models/document.py` - Added folder_id field to DocumentResponse; new DocumentMoveRequest model
- `backend/app/models/folder.py` - Added FolderMoveRequest model with parent_id field
- `backend/app/api/documents.py` - Form import, folder_id param on upload, folder validation, folder_id in doc_data, full_markdown in completion update, move_document endpoint
- `backend/app/api/folders.py` - FolderMoveRequest import, move_folder endpoint

## Decisions Made

- ON DELETE SET NULL on folder_id FK: deleting a folder orphans documents to root rather than destroying them
- full_markdown intentionally excluded from DocumentResponse (too large for list responses; Phase 6 read tool retrieves it directly via dedicated query)
- folder_id accepted as Form field because upload is multipart/form-data — cannot mix JSON body with file upload
- move_document uses maybe_single for ownership check then a separate filtered update, preventing cross-user document existence leakage

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

Minor: The plan's verification command used `/{document_id}/move` but FastAPI routes include the router prefix, making the actual path `/documents/{document_id}/move`. Verified with correct path — both endpoints confirmed present.

## User Setup Required

None - no external service configuration required. Migration 014 must be applied to Supabase before the new folder_id and full_markdown columns are available.

## Next Phase Readiness

- All backend document-folder integration complete
- Migration 014 is ready to apply to Supabase (local or cloud)
- Phase 03 (ingestion UI) can now wire folder selection and document move UI against these endpoints
- KB tool phases (grep/read) can access full_markdown via direct column query once documents are re-ingested

---
*Phase: 02-document-folder-integration*
*Completed: 2026-03-21*
