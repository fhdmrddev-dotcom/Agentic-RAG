---
phase: 28-document-versioning-schema-ingestion
plan: "01"
subsystem: backend
tags: [versioning, schema, migration, upload, retrieval]
dependency_graph:
  requires: []
  provides: [document-versioning-schema, version-aware-retrieval, version-aware-upload]
  affects: [upload-endpoint, retrieval-rpcs, document-model]
tech_stack:
  added: []
  patterns: [TDD-red-green, version-creation-not-delete, is_latest-partial-index]
key_files:
  created:
    - supabase/migrations/025_document_versioning.sql
    - backend/tests/unit/test_document_versioning.py
  modified:
    - backend/app/api/documents.py
    - backend/app/models/document.py
    - backend/app/services/retrieval_service.py
decisions:
  - "Re-upload creates new version row (version_number incremented); old row retires via is_latest=False — no delete for Phase 29 restore"
  - "Dedup check scoped to is_latest=True so stale hash matches do not short-circuit upload"
  - "Version retirement is user+filename scoped (not folder-scoped) per research decision"
  - "resolve_document_id adds is_latest=True to both exact and partial match queries"
  - "fetch_full_document adds version_number to select for caller context"
metrics:
  duration: "258s"
  completed: "2026-04-12"
  tasks_completed: 2
  files_modified: 5
---

# Phase 28 Plan 01: Document Versioning Schema + Ingestion Summary

## One-liner

SQL migration adds version_number/is_latest columns; upload endpoint creates version rows instead of deleting stale documents; both retrieval RPCs now exclude non-latest chunks.

## What Was Built

### Task 1: TDD RED + SQL Migration
- Created `backend/tests/unit/test_document_versioning.py` with 4 tests in `TestDocumentVersioning`:
  - `test_reupload_creates_new_version` — asserts version_number=2, is_latest=True in insert, update(is_latest=False) called
  - `test_first_upload_gets_version_1` — asserts version_number=1 in insert for new filename
  - `test_dedup_ignores_stale_version` — dedup returns empty (is_latest=True filter excludes stale), upload proceeds
  - `test_dedup_matches_latest_version` — dedup returns is_latest=True row, returns 200 early, no insert
- Created `supabase/migrations/025_document_versioning.sql`:
  - `ALTER TABLE documents ADD COLUMN IF NOT EXISTS version_number integer NOT NULL DEFAULT 1`
  - `ALTER TABLE documents ADD COLUMN IF NOT EXISTS is_latest boolean NOT NULL DEFAULT true`
  - Partial index `documents_latest_idx` on (user_id, filename, is_latest) WHERE is_latest=true
  - DROP + CREATE `match_document_chunks` with `AND d.is_latest = true` filter
  - DROP + CREATE `keyword_search_chunks` with `AND d.is_latest = true` filter

### Task 2: GREEN Implementation
- **`backend/app/api/documents.py`**: 
  - Added `.eq("is_latest", True)` to dedup query — dedup only matches current latest version
  - Replaced stale-delete branch with version creation: query `existing_versions` by filename (ORDER BY version_number DESC LIMIT 1), compute `next_version`, call `update({"is_latest": False})` scoped to user+filename, add `version_number` and `is_latest` to `doc_data`
  - Removed `storage.from_("documents").remove()` call — old files retained for Phase 29 restore
- **`backend/app/models/document.py`**: Added `version_number: int = 1` and `is_latest: bool = True` to `DocumentResponse`
- **`backend/app/services/retrieval_service.py`**:
  - `resolve_document_id`: added `.eq("is_latest", True)` to both exact and partial match queries
  - `fetch_full_document`: added `version_number` to `.select("id, filename, metadata, version_number")`

## Verification

- All 4 new versioning tests pass
- All 13 retrieval_service tests pass
- No regressions in other unit tests (pre-existing failures in test_explorer_agent, test_infrastructure, test_sql_service are unrelated to these changes)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Upload endpoint uses /documents/upload not /documents**
- **Found during:** Task 1 (TDD RED) — test returned 405
- **Issue:** Test helper used POST /documents; actual route is POST /documents/upload
- **Fix:** Updated `_upload_file()` helper and inline POST call in test to use correct path
- **Files modified:** `backend/tests/unit/test_document_versioning.py`
- **Commit:** included in 042fa90

**2. [Rule 1 - Bug] Fake doc IDs failed Pydantic UUID validation**
- **Found during:** Task 1 (TDD RED) — response returned 500 ResponseValidationError
- **Issue:** Mock return data used shorthand IDs like "doc-v1-id" which Pydantic rejected as invalid UUID
- **Fix:** Replaced all fake IDs with proper UUID-format constants (DOC_V1_ID, DOC_V2_ID, etc.)
- **Files modified:** `backend/tests/unit/test_document_versioning.py`
- **Commit:** included in 042fa90

**3. [Rule 1 - Bug] PDF content extraction failed on fake bytes**
- **Found during:** Task 1 (TDD RED) — test returned 422 "Could not extract text"
- **Issue:** Test used `application/pdf` MIME with fake bytes; pypdf rejected them
- **Fix:** Changed test files to `text/plain` MIME type with FILENAME changed to `.txt` — no real PDF parsing needed for unit tests of versioning logic
- **Files modified:** `backend/tests/unit/test_document_versioning.py`
- **Commit:** included in 042fa90

## Known Stubs

None — all version fields are wired through to database insert and Pydantic model. The migration SQL is the source of truth for the schema.

## Self-Check: PASSED
