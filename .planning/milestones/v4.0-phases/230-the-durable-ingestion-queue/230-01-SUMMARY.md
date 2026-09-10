# Phase 230 Plan 01 Summary: Ingestion Jobs Schema & Atomic DB Access Layer (Wave 1)

## Delivered Objectives
1. **Durable Ingestion Jobs Schema (`supabase/migrations/153_ingestion_jobs.sql`):**
   - Created `ingestion_jobs` table with UUID primary key, `document_id`, `user_id`, `org_id`, `status`, `stage`, `progress`, `retry_count`, `max_retries`, `last_error`, `error_details`, `next_run_at`, `claimed_at`, and `claimed_by`.
   - Constrained status to `'pending', 'retry_queued', 'processing', 'completed', 'failed', 'paused'`.
   - Constrained stage to `'pending', 'extracting', 'tables_embedded', 'chunks_embedded', 'completed', 'failed'`.
   - Created 4 indexes: `idx_ingestion_jobs_due`, `idx_ingestion_jobs_document`, `idx_ingestion_jobs_org_status`, and `idx_ingestion_jobs_stale` (`(claimed_at) WHERE status = 'processing'`).
   - Enabled Row Level Security (RLS) with service-role and authenticated user/org policies.

2. **Atomic DB Access Layer (`backend/app/db/ingestion_jobs.py`):**
   - `claim_due_ingestion_jobs`: Atomic claim via `FOR UPDATE SKIP LOCKED` inside explicit transaction, with global concurrency bound via `pg_advisory_xact_lock(4230230)`.
   - `reclaim_stale_ingestion_claims`: Stale-claim sweeper (G-1 / SC#1) reclaiming jobs stranded in `status='processing'` older than lease timeout (300s). In the same transaction, marks exhausted documents failed with `'lease_timeout_exceeded'`.
   - `update_job_progress`: Incremental checkpoint writer for stage and batch offsets with self-healing `(CASE WHEN jsonb_typeof(...) = 'object' ... ELSE '{}'::jsonb END) || ($n::text)::jsonb` expression.
   - `record_job_success`: Terminal completion state writer.
   - `record_job_failure`: Handles transient retries with exponential backoff or marks permanently failed, updating `documents.status = 'failed'` and `documents.error_message` in the same transaction.
   - `pause_jobs_for_provider` & `resume_paused_jobs`: Queue outage pause with named refusal and auto-resume.

3. **Database Test Suite (`backend/tests/unit/test_230_ingestion_jobs_db.py`):**
   - 12/12 unit and live DB tests passing 100%:
     - Claim exclusivity and concurrency bounding.
     - Stale claim recovery with live Postgres lease timeout check.
     - Type-checked JSONB progress round-trip asserting `isinstance(prog, dict)` and self-healing.
     - Terminal failure and lease exhaustion document status synchronization.

## Verification Evidence
- `backend/venv/Scripts/pytest.exe backend/tests/unit/test_230_ingestion_jobs_db.py -v`: 12 passed.
