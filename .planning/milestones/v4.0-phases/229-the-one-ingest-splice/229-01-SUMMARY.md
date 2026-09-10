# Phase 229 Plan 01 Summary: Ingest Splice Core Service & Minting Foundation (Wave 1)

## Delivered Objectives
1. **Unified Minting and Pipeline Foundation (`backend/app/services/ingest_splice.py`):**
   - Defined immutable `MintResult` dataclass (`document`, `is_duplicate`, `storage_path`, `version_number`).
   - Implemented synchronous `mint_document_row()`:
     - Folder ownership validation enforcing strict byte-for-byte parity with `documents.py:610-617` (`folder.user_id != caller -> 403`, resolving G-1).
     - Deterministic content hashing via SHA-256.
     - Folder-scoped deduplication against completed, latest records (`status == 'completed' AND is_latest == True`).
     - User-scoped filename versioning with previous version retirement (`is_latest=False`).
     - Canonical storage path generation (`{user_id}/{document_id}/{filename}`).
     - Document INSERT with `status='pending'`, omitting `created_at`/`updated_at` to preserve Postgres column clock defaults (resolving G-4).
     - Unique index collision handling on `documents_dedup_idx` (Postgres `23505`): raises 409 Conflict when `on_conflict="raise"`; re-queries non-failed row and returns duplicate when `on_conflict="link"` (resolving G-2).
   - Implemented `async_mint_document_row()` via `run_in_threadpool` for non-blocking execution in FastAPI async handlers.
   - Implemented `splice_document()`:
     - Storage upload with non-blocking warning log on failure.
     - Status sequence progression: updates `status='processing', ingestion_step='extracting'` before extraction (resolving G-3).
     - Wall-clock timeout fail-safe (`130.0`s) for Layer 2 extraction.
     - Exception handling marking `status='failed', ingestion_step='failed'` with sanitized error message.
     - Seamless delegation to `ingest_document` for multimodal extraction and chunk recount.

2. **Unit Test Suite (`backend/tests/unit/test_ingest_splice.py`):**
   - 10 unit test cases passing 100% across all branches:
     - Fresh document minting and schema assertions (pending status, version 1, is_latest=True, DB timestamps preserved).
     - Exact completed duplicate detection without INSERT.
     - Strict folder ownership validation (404 on missing, 403 on unowned).
     - User-scoped filename versioning cascade.
     - 23505 unique collision raising 409 on `raise`.
     - 23505 unique collision linking existing pending/processing row on `link` (G-2).
     - `async_mint_document_row` threadpool execution parity.
     - `splice_document` happy path progression and delegation.
     - `splice_document` storage upload failure non-blocking resilience.
     - `splice_document` extraction failure marking `status='failed'`.

## Verification Evidence
- `backend/venv/Scripts/pytest.exe backend/tests/unit/test_ingest_splice.py -v`: 10 passed in 1.83s.

## Next Steps
Proceed to Wave 2 (Plan 229-02): Wire `upload_document` and `import_connection_file` to use `async_mint_document_row` and `splice_document`, resolving `PGRST204` column error and satisfying SC#1, SC#2, and SC#4.
