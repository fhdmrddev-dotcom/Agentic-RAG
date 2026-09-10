# Phase 230 Plan 04 Summary: Upload Route Cutover & Checkpointed Resumption (Wave 3)

## Delivered Objectives
1. **Upload Route Durable Queue Cutover (`backend/app/api/documents.py`):**
   - Replaced ephemeral `background_tasks.add_task(splice_document)` with durable `ingestion_jobs` row insertion on `POST /documents/upload`.
   - Preserved 100% of existing upload contracts: returns HTTP 201 Created with identical document payload schema, status `'pending'`, deduplication parity (HTTP 200 on duplicate hash), and audit log enqueueing (SC#5).
   - Proven on `/upload` first (H-3) with 30 phases of existing test coverage prior to connector cutovers.

2. **Checkpointed Resumption (`backend/app/services/ingest_splice.py`):**
   - Extended `splice_document` with `job_id` and `progress` parameters for incremental checkpointing.
   - Resumes chunk embedding from `progress.chunk_offset` without re-embedding previously completed chunks (SC#4).
   - Defensive normalization ensures `progress` is always handled as a dict, preventing `AttributeError` during resumption.
   - Updates `ingestion_jobs.progress` via `update_job_progress` after each chunk batch and synchronizes document completion state upon pipeline finish.

3. **Integration Test Suite (`backend/tests/integration/test_230_upload_queue_cutover.py`):**
   - 5/5 integration tests passing 100%:
     - `test_upload_creates_durable_ingestion_job`: Enqueues pending job on upload and executes through to completion.
     - `test_lost_worker_crash_recovery`: Simulates hard worker drop mid-batch, stale sweeper reclaim, and recovery to completed with 0 stranded rows (SC#1 / G-1).
     - `test_burst_throttling_semaphore`: Verifies concurrent job execution respects concurrency limits.
     - `test_checkpointed_chunk_resumption`: Validates skipping already-embedded chunks from saved chunk offset (SC#4).
     - `test_upload_contract_preservation_and_no_eta`: Asserts response schema parity and strict absence of time-based ETAs.

## Verification Evidence
- `backend/venv/Scripts/pytest.exe backend/tests/integration/test_230_upload_queue_cutover.py -v`: 5 passed.
