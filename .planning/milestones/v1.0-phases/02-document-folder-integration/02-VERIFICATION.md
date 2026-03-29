---
phase: 02-document-folder-integration
verified: 2026-03-21T15:00:00Z
status: passed
score: 4/4 must-haves verified
re_verification: false
---

# Phase 02: Document-Folder Integration Verification Report

**Phase Goal:** Documents can be organized into folders — upload to folder, move between folders, folder hierarchy supported
**Verified:** 2026-03-21
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| #   | Truth                                                                                  | Status     | Evidence                                                                                                  |
| --- | -------------------------------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------- |
| 1   | User can upload a file targeting a specific folder and the document row has correct folder_id | VERIFIED | `upload_document` accepts `folder_id: str | None = Form(None)`, validates with `.or_()`, persists in `doc_data` dict; test `test_upload_with_valid_folder_id_returns_201` PASSED |
| 2   | User can move a document to a different folder and the folder_id is updated            | VERIFIED   | `PATCH /{document_id}/move` endpoint exists, verifies ownership, validates target folder, updates `folder_id`; `TestMoveDocument` (4 tests) all PASSED |
| 3   | User can move a folder to a different parent and the parent_id is updated              | VERIFIED   | `PATCH /{folder_id}/move` endpoint exists, validates parent accessibility, updates `parent_id`, returns 404 for non-owned; `TestMoveFolder` (4 tests) all PASSED |
| 4   | Every completed document has full_markdown populated with the extracted text           | VERIFIED   | `ingest_document` completion update dict includes `"full_markdown": text` at line 272; `TestFullMarkdown::test_ingest_stores_full_markdown` PASSED |

**Score:** 4/4 truths verified

---

### Required Artifacts

| Artifact                                                          | Provides                                                   | Status     | Details                                                                                                   |
| ----------------------------------------------------------------- | ---------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------- |
| `backend/supabase/migrations/014_document_folder_integration.sql` | folder_id FK (ON DELETE SET NULL) and full_markdown column | VERIFIED   | Contains `ADD COLUMN IF NOT EXISTS folder_id uuid REFERENCES public.folders(id) ON DELETE SET NULL`, `ADD COLUMN IF NOT EXISTS full_markdown text`, and `CREATE INDEX IF NOT EXISTS documents_folder_id_idx` |
| `backend/app/models/document.py`                                  | DocumentResponse with folder_id, DocumentMoveRequest model | VERIFIED   | `DocumentResponse` has `folder_id: UUID | None = None`; `DocumentMoveRequest` has `folder_id: UUID | None`; `full_markdown` correctly absent from response model |
| `backend/app/models/folder.py`                                    | FolderMoveRequest model                                    | VERIFIED   | `FolderMoveRequest` has `parent_id: UUID | None`                                                         |
| `backend/app/api/documents.py`                                    | Upload with folder_id, move_document endpoint, full_markdown storage | VERIFIED | `Form` imported, `folder_id` param on upload, folder accessibility validation, `folder_id` in `doc_data`, `full_markdown` in completion update, `move_document` at `PATCH /{document_id}/move` |
| `backend/app/api/folders.py`                                      | move_folder endpoint                                       | VERIFIED   | `FolderMoveRequest` imported, `move_folder` at `PATCH /{folder_id}/move` with parent validation and ownership check |
| `backend/tests/integration/test_documents.py`                     | Tests for upload with folder_id, move document, full_markdown | VERIFIED | `TestMoveDocument` (4 tests), `TestFullMarkdown` (1 test), 2 upload-with-folder tests; `_doc_row` updated with `folder_id` and `content_hash` |
| `backend/tests/integration/test_folders.py`                       | Tests for move folder                                      | VERIFIED   | `TestMoveFolder` (4 tests) covering valid parent, root, invalid parent, not owned                         |

---

### Key Link Verification

| From                                      | To                        | Via                                                       | Status   | Details                                                                                                                      |
| ----------------------------------------- | ------------------------- | --------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `backend/app/api/documents.py`            | `backend/app/models/document.py` | `from app.models.document import DocumentMoveRequest, DocumentResponse` | WIRED    | Import confirmed at line 11                                                                                                  |
| `backend/app/api/documents.py`            | `documents` table         | `folder_id` persisted on insert and in ingest completion  | WIRED    | `"folder_id": folder_id` in `doc_data` dict (line 132); `"full_markdown": text` in completion update (line 272)             |
| `backend/app/api/documents.py`            | `folders` table           | folder accessibility validation on upload and move        | WIRED    | `.table("folders")` with `.or_(f"user_id.eq.{current_user['id']},is_global.eq.true")` in both `upload_document` and `move_document` |
| `backend/app/api/folders.py`              | `folders` table           | `parent_id` update on move                                | WIRED    | `.update({"parent_id": str(body.parent_id) if body.parent_id else None})` at line 143                                       |
| `backend/tests/integration/test_documents.py` | `backend/app/api/documents.py` | HTTP requests to `/documents/upload` and `/{id}/move` | WIRED    | `client.patch(f"/documents/{DOC_ID}/move", ...)` present in `TestMoveDocument`; upload tests use `client.post("/documents/upload", data={"folder_id": ...})` |
| `backend/tests/integration/test_folders.py`   | `backend/app/api/folders.py`   | HTTP requests to `/{id}/move`                         | WIRED    | `client.patch(f"/folders/{FOLDER_ID}/move", ...)` present in `TestMoveFolder`                                               |

---

### Requirements Coverage

| Requirement | Source Plan | Description                                                         | Status    | Evidence                                                                                                    |
| ----------- | ----------- | ------------------------------------------------------------------- | --------- | ----------------------------------------------------------------------------------------------------------- |
| FOLDER-04   | 02-01, 02-02 | User can move folders to a different parent folder                 | SATISFIED | `move_folder` endpoint at `PATCH /{folder_id}/move` updates `parent_id` with ownership check; 4 tests PASS |
| DOC-01      | 02-01, 02-02 | User can upload files into a specific folder                       | SATISFIED | `upload_document` accepts `folder_id` Form field, validates accessibility, persists to DB; 2 tests PASS     |
| DOC-02      | 02-01, 02-02 | User can move files between folders                                | SATISFIED | `move_document` endpoint at `PATCH /{document_id}/move` updates `folder_id` with ownership + folder checks; 4 tests PASS |
| DOC-03      | 02-01, 02-02 | System stores full extracted markdown alongside chunks for each document | SATISFIED | `ingest_document` includes `"full_markdown": text` in completion update; TestFullMarkdown PASSES            |

**Orphaned requirements check:** REQUIREMENTS.md Traceability table maps FOLDER-04, DOC-01, DOC-02, DOC-03 to Phase 2 — all four appear in plan frontmatter. No orphaned requirements.

---

### Anti-Patterns Found

None. Scanned `documents.py`, `folders.py`, `models/document.py`, `models/folder.py` for TODO/FIXME/placeholder/stub patterns — zero matches.

---

### Human Verification Required

#### 1. Migration applied to Supabase

**Test:** Apply migration 014 to the Supabase project and verify `folder_id` and `full_markdown` columns exist on the `documents` table.
**Expected:** `\d documents` in psql shows `folder_id uuid REFERENCES folders(id)` and `full_markdown text`, both nullable.
**Why human:** Cannot connect to live Supabase from this environment. Migration SQL is correct but application to the live DB is a deployment step.

#### 2. End-to-end upload-to-folder via running server

**Test:** Start the backend server, upload a file with a `folder_id` form field set to a real folder ID, then query `GET /documents` and verify `folder_id` is set on the returned document.
**Expected:** `folder_id` matches the submitted value; document appears in folder-scoped queries.
**Why human:** Integration tests mock Supabase. Live DB behavior (RLS, FK constraint) cannot be verified programmatically here.

---

### Gaps Summary

No gaps. All four observable truths verified. All artifacts exist, are substantive (non-stub), and are wired. All key links confirmed. All four requirement IDs (FOLDER-04, DOC-01, DOC-02, DOC-03) satisfied with implementation evidence. 51 integration tests pass (24 document + 27 folder). Two items flagged for human verification are deployment/live-server checks, not implementation gaps.

---

_Verified: 2026-03-21T15:00:00Z_
_Verifier: Claude (gsd-verifier)_
