# Phase 230 — Cross-Plan Seam Audit

Every file on the path between what one plan writes and another reads is mechanically traced below, with its data flow, direction, readers, and verification mechanism.

---

## Mechanical Field Derivation

For every field that Phase 230 introduces, normalizes, moves, or touches across the ingestion boundary:

| Field Name | Source / Producer | Queue & Storage Normalization (`ingestion_jobs` / `ingest_splice.py`) | Consumer(s) / Readers | Guarded Failure Mode |
|---|---|---|---|---|
| `ingestion_jobs.id` | Generated via `gen_random_uuid()` on job creation in `/upload` | Stored as UUID PRIMARY KEY in `ingestion_jobs` | `claim_due_ingestion_jobs`, worker logger, `update_job_progress` | Guarantees unique job identity and concurrency claim lock key |
| `ingestion_jobs.document_id` | Minted `documents.id` from `mint_document_row()` in `documents.py:520` | Stored as UUID NOT NULL REFERENCES `documents(id)` ON DELETE CASCADE | `IngestionQueueService._process_job`, `splice_document` | Eliminates orphaned jobs when a document is deleted; joins job to document |
| `ingestion_jobs.status` | Initialized `'pending'` in `/upload`; transitions to `'processing'`, `'retry_queued'`, `'completed'`, `'failed'`, `'paused'` | Atomic `FOR UPDATE SKIP LOCKED` claim sets `'processing'`; breaker trips to `'paused'`; success sets `'completed'` | Worker poller query (`status IN ('pending', 'retry_queued')`), `IngestionTab` and `DocumentList` UI badges | Prevents double-claiming across uvicorn workers; halts queue on outage (QUEUE-01, QUEUE-05) |
| `ingestion_jobs.claimed_at` | Written at claim time (`now()`) in `claim_due_ingestion_jobs` | TIMESTAMPTZ, indexed with `status='processing'` | **`reclaim_stale_ingestion_claims` (G-1)** in `db/ingestion_jobs.py` & `IngestionQueueService` | **Closes G-1 / SC#1**: Sweeps jobs abandoned by dead/restarted workers back to `pending`, guaranteeing no job is stuck in `processing` |
| `ingestion_jobs.stage` | Initialized `'pending'`; updated during pipeline execution | `splice_document` updates: `'extracting'` -> `'tables_embedded'` -> `'chunks_embedded'` -> `'completed'` | `splice_document` on retry/resume | Enables coarse skip of completed stages (e.g. table extraction) on resume (SC#4) |
| `ingestion_jobs.progress` | Checkpoint dictionary written after each batch of chunk embeddings | JSONB containing `{"chunk_offset": N, "total_chunks": M, ...}` merged via `update_job_progress` | `splice_document` on retry/resume | Prevents re-embedding prior chunks when an ingest fails 90% through (SC#4) |
| `ingestion_jobs.retry_count` | Incremented by `record_job_failure` and `reclaim_stale_ingestion_claims` in `db/ingestion_jobs.py` | Integer counter, checked against `max_retries` (default 3) | `record_job_failure` and `reclaim_stale_ingestion_claims` conditional branches | Prevents poison-pill infinite loops; converts to terminal `'failed'` after max retries |
| `ingestion_jobs.next_run_at` | Initialized `now()`; advanced on retry via `now() + backoff_delay` | TIMESTAMPTZ, indexed with `status` for fast poller scans | Poller claim predicate: `next_run_at <= now()` | Enforces exponential backoff with jitter on transient network failures (QUEUE-05) |
| `ingestion_jobs.last_error` & `error_details` | Captured in `IngestionQueueService` from caught provider or extraction exceptions | Sanitized string and JSONB error detail (e.g. `openai: insufficient_quota (429)`) | `IngestionPauseBanner.tsx`, `IngestionTab.tsx` | Closes `BUG-260815-05`: Outage surfaces honest provider refusal, never "0 sources" (SC#3) |
| `embed_texts` batch chunks | Chunks passed from `embedding_service`, `multimodal_service`, `reembed_service` | Sliced into sub-batches <= 200,000 tokens and <= 512 chunks in `openai_service.embed_texts` | External Embedding API (`client.embeddings.create`) | Prevents provider 400 rejection on requests exceeding 300,000 token limit (QUEUE-04, SEED-197) |
| `INGEST_*` env configuration | Defined in `backend/app/config.py` (`ingest_max_concurrent_jobs`, `ingest_poll_interval_seconds`, `ingest_lease_timeout_seconds`) | Synced across `backend/.env.example`, `deploy/onebox.env.example`, `docker-compose.prod.yml`, `docs/OPERATOR.md` | `IngestionQueueService`, `check-deploy-drift.sh` | Prevents deployment drift and worker process saturation during burst loads |
| Recall metrics (`Hit@K`, `MRR`) | Derived by `scripts/measure-recall.py` over 77 baseline documents | Validated by `backend/tests/eval/test_retrieval_recall_baseline.py` | Phase 241 benchmark target, `pytest tests` runner | Provides an immutable ground truth recall baseline collected by test runner before scale changes (G-3 / Phase 241) |

---

## Seam 1: Plan 230-01 (Wave 1) & Plan 230-02 (Wave 1) → Plan 230-03 (Wave 2)

| Component | Detail |
|---|---|
| **What 230-01 writes** | `supabase/migrations/153_ingestion_jobs.sql`, `backend/app/db/ingestion_jobs.py` (`claim_due_ingestion_jobs`, `reclaim_stale_ingestion_claims`, `update_job_progress`, `record_job_success`, `record_job_failure`, `pause_jobs_for_provider`, `resume_paused_jobs`), `backend/tests/unit/test_230_ingestion_jobs_db.py`. |
| **What 230-02 writes** | `backend/app/services/openai_service.py` (token-aware safe batching in `embed_texts`), `backend/app/services/multimodal_service.py` (length assertions), `backend/tests/unit/test_230_embed_texts_batcher.py`. |
| **What 230-03 reads** | `backend/app/services/ingestion_queue_service.py` imports and calls `claim_due_ingestion_jobs`, `reclaim_stale_ingestion_claims` (G-1 sweeper), `record_job_success`, `record_job_failure`, `pause_jobs_for_provider`, and `resume_paused_jobs`. The worker delegates chunk embedding to the batching-protected `embed_texts`. |
| **Files on the path in between** | 1. `backend/app/db/ingestion_jobs.py` (database claim/update/sweeper layer).<br>2. `backend/app/services/circuit_breaker.py` (`CircuitBreaker`, `CircuitBreakerTrippedError`).<br>3. `backend/app/services/openai_service.py` (`embed_texts`).<br>4. `backend/app/services/ingestion_queue_service.py` (worker daemon).<br>5. PostgreSQL `ingestion_jobs` table. |
| **Failure mode guarded against** | Worker crashing due to unhandled DB exceptions; in-flight jobs stranded forever after worker crash (G-1); race conditions during concurrent worker claims; exceeding provider token ceilings (300k); cross-provider vector space corruption (D-2). |
| **Verification mechanism** | `pytest backend/tests/unit/test_230_ingestion_jobs_db.py backend/tests/unit/test_230_embed_texts_batcher.py -v`. Exit code 0 required. |

---

## Seam 2: Plan 230-03 (Wave 2) → Plan 230-04 (Wave 3)

| Component | Detail |
|---|---|
| **What 230-03 writes** | `backend/app/services/ingestion_queue_service.py` (`IngestionQueueService` worker daemon with stale-claim sweeper), `backend/app/config.py` (ingest knobs), `backend/app/main.py` (lifespan hook), synchronized deployment artifacts (`docker-compose.prod.yml`, `deploy/onebox.env.example`, `docs/OPERATOR.md`), `CLAUDE.md` & `docs/HOT-FILE-LEDGER.md` (same-commit G-5 ledger discharge for `main.py` and `config.py` - G-4). |
| **What 230-04 reads** | `backend/app/api/documents.py` cuts over `POST /documents/upload` to enqueue jobs picked up by `IngestionQueueService`; `backend/app/services/ingest_splice.py` takes `job_id` and checkpoints batch progress via `update_job_progress`. |
| **Files on the path in between** | 1. `backend/app/api/documents.py` (HTTP upload handler).<br>2. `backend/app/services/ingest_splice.py` (splice pipeline).<br>3. `backend/app/db/ingestion_jobs.py` (job insertion and progress updates).<br>4. `backend/app/services/ingestion_queue_service.py` (queue worker).<br>5. PostgreSQL `documents` and `ingestion_jobs` tables. |
| **Failure mode guarded against** | Ambiguity between queue and new adapters (H-3); ephemeral `BackgroundTask` lost on worker crash (SEED-077); re-embedding already embedded chunks on retry (SC#4); upload response format regressions (SC#5); hot-file ledger drift across waves (G-4). |
| **Verification mechanism** | `pytest backend/tests/integration/test_230_upload_queue_cutover.py -v`. Exit code 0 required. |

---

## Seam 3: Plan 230-04 (Wave 3) → Plan 230-05 (Wave 4)

| Component | Detail |
|---|---|
| **What 230-04 writes** | `backend/app/api/documents.py` (live queue enqueueing), `backend/app/services/ingest_splice.py` (checkpointed resumption), `backend/tests/integration/test_230_upload_queue_cutover.py`. |
| **What 230-05 reads** | `frontend/src/components/library/IngestionTab.tsx` and `frontend/src/components/ingestion/DocumentList.tsx` (G-2 verified paths) read `status='paused'` and `last_error` from document/job records to render Sketch 227 Variant B (`IngestionBatchLane.tsx` & `IngestionPauseBanner.tsx`); recall harness measures against live database chunks. |
| **Files on the path in between** | 1. `backend/app/api/documents.py` (document listings and status endpoints).<br>2. `frontend/src/components/library/IngestionTab.tsx` (Ingestion subnav & In Progress sub-tab).<br>3. `frontend/src/components/ingestion/DocumentList.tsx` (document rows).<br>4. `frontend/src/components/ingestion/IngestionPauseBanner.tsx` (paused refusal banner).<br>5. `frontend/src/components/ingestion/IngestionBatchLane.tsx` (Variant B batch lane).<br>6. `backend/tests/eval/test_retrieval_recall_baseline.py` (recall benchmark - G-3).<br>7. `scripts/measure-recall.py` (eval script). |
| **Failure mode guarded against** | Targeting non-existent frontend directories (G-2); silent failure presenting as "0 sources returned" (`BUG-260815-05`); displaying invented ETAs (D-217-19); recall harness outside pytest collection (G-3). |
| **Verification mechanism** | `npm --prefix frontend run build`, `pytest backend/tests/eval/test_retrieval_recall_baseline.py -v`, `python scripts/measure-recall.py`. Exit code 0 required. |

---

## Seam 4: Plan 230-05 (Wave 4) → Reviewer Pre-Flight / Verification Gate

| Component | Detail |
|---|---|
| **What 230-05 writes** | Frontend components (`IngestionTab.tsx`, `DocumentList.tsx`, `IngestionPauseBanner.tsx`, `IngestionBatchLane.tsx`), `backend/tests/eval/test_retrieval_recall_baseline.py`, `scripts/measure-recall.py`, `230-VERIFICATION.md`, `230-SEAM-AUDIT.md`. |
| **What reviewer (Claude) reads** | Re-derived gate baselines: `check-backend-unit-baseline.cjs` (<= 71 failed, 0 errors), deploy drift `check-deploy-drift.sh` (0 drift), `check-claude-md-size.cjs` (< 120k chars, disposition <= 200 chars), TypeScript compilation (`tsc`). |
| **Files on the path in between** | 1. `CLAUDE.md` (project rules & hot-file ledger - updated in 230-03).<br>2. `docs/HOT-FILE-LEDGER.md` (ledger narrative - updated in 230-03).<br>3. `scripts/check-backend-unit-baseline.cjs` (unit gate).<br>4. `scripts/check-deploy-drift.sh` (deploy drift gate).<br>5. `scripts/check-claude-md-size.cjs` (size gate). |
| **Failure mode guarded against** | Hot-file ledger drift or disposition overflow (>200 chars); deployment drift from unclassified `INGEST_*` variables; backend test baseline degradation (>71 failures). |
| **Verification mechanism** | All mechanical gate scripts: `node scripts/check-backend-unit-baseline.cjs`, `bash scripts/check-deploy-drift.sh`, `node scripts/check-claude-md-size.cjs`, and `tsc`. |

---
*Authored: 2026-09-05 | Builder: Gemini | Phase 230: The Durable Ingestion Queue*
