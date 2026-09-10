# Phase 229 Plan 02 Summary: Connectors & Upload Door Integration (Wave 2)

## Delivered Objectives
1. **Upload Door Ingest Splice Integration (`backend/app/api/documents.py`):**
   - Refactored `_upload_pipeline` into a lightweight delegate calling `splice_document()`, preserving backwards compatibility for internal and external callers.
   - Refactored `upload_document` (`POST /documents/upload`) to delegate row minting, deduplication, and versioning to `async_mint_document_row()`.
   - Preserved exact HTTP 200/201 contract: returns HTTP 200 OK on existing completed duplicate; returns HTTP 201 Created on brand new file or incremented version.
   - Eliminated redundant inline queries in `upload_document` while maintaining file size validation, audit log writing, and detached BackgroundTask execution.

2. **Connector Import Ingest Splice Integration (`backend/app/api/connectors.py`):**
   - Refactored `import_connection_file` (`POST /connectors/connections/{id}/files/{file_id}/import`) to delegate row creation to `async_mint_document_row()` and background processing to `splice_document()`.
   - **Resolved `PGRST204` storage_path column error (SC#1):** Removed nonexistent `storage_path` column from insert payload; canonical `file_path`, `content_hash`, `version_number=1`, `is_latest=True`, and `status='pending'` are now correctly populated.
   - **Guaranteed Library Parity (SC#2):** Files imported via cloud connection now undergo identical deduplication and versioning as manual uploads. If an exact duplicate already exists in the Library, returns the existing record immediately without duplicate insert or processing.

3. **Integration Test Suite (`backend/tests/integration/test_connector_import_splice.py`):**
   - Proved SC#1: Cloud file import creates valid documents row with `file_path`, `content_hash`, `version_number=1`, without `storage_path` column error, and queues `splice_document`.
   - Proved SC#2: Re-importing an existing file matches completed row, returns HTTP 200, and avoids duplicate background execution.
   - Proved SC#4: `/documents/upload` retains exact observable behavior: 200 OK on duplicate, 201 Created on new version, with previous version retired to `is_latest=False`.

## Verification Evidence
- `backend/venv/Scripts/pytest.exe backend/tests/integration/test_connector_import_splice.py -v`: 3 passed in 3.00s.
- `backend/venv/Scripts/pytest.exe backend/tests/unit/test_ingest_splice.py backend/tests/unit/test_document_versioning.py -v`: 20 passed in 1.67s.

## Next Steps
Proceed to Wave 3 (Plan 229-03): Refactor email attachment cascade in `documents.py`, pass `on_conflict="link"` to `mint_document_row` to eliminate 23505 collision drops, record attachment manifest in metadata, and verify chunk-write sites.
