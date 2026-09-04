# Phase 230: The Durable Ingestion Queue - Context

**Gathered:** 2026-09-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 230 delivers **The Durable Ingestion Queue** (`QUEUE-01`, `QUEUE-02`, `QUEUE-04`, `QUEUE-05`). It makes document ingestion survive a backend restart, a burst of hundreds of files, and an embedding provider outage — and when it cannot proceed, it surfaces the honest provider refusal on screen instead of producing an empty result.

Core Deliverables:
1. **Migration 153 (`153_ingestion_jobs.sql`)**: Introduces `ingestion_jobs` table with state machine, retry count, stage/progress tracking, and RLS.
2. **Durable Claim Worker (`IngestionQueueService` & `db/ingestion_jobs.py`)**: Reuses the in-repo `FOR UPDATE SKIP LOCKED` claim pattern from `db/schedules.py:307` in an explicit transaction without an external broker or new process.
3. **Queue Cutover on `/upload` FIRST (H-3)**: Proves the queue against the existing `/upload` endpoint with 30 phases of coverage before any connector or adapter touches it (`QUEUE-02`).
4. **Token-Aware & Input-Bounded Batcher (`QUEUE-04`, `SEED-197`)**: Batches embeddings inside `openai_service.embed_texts` respecting OpenAI's 300,000 token request ceiling and 2,048 input limit.
5. **Outage Resilience & Named Refusal (`QUEUE-05`, `BUG-260815-05`)**: Retries with backoff/jitter, fails over only to same-model endpoints (D-2 strict no-cross-provider substitution), trips `circuit_breaker.py`, pauses the queue, and presents the named provider refusal.
6. **Deploy Drift & G-5 Compliance**: Synchronizes all new `INGEST_*` configuration across `config.py`, `docker-compose.prod.yml`, `deploy/onebox.env.example`, and `docs/OPERATOR.md`. G-5 hot files `main.py` and `config.py` honoured by construction.
7. **Phase 241 Recall Baseline Harness**: `tests/eval/test_retrieval_recall_baseline.py` and `scripts/measure-recall.py` measuring Hit@K / MRR over the 77 completed baseline documents.
8. **G-2 Sketch Handover**: BUS-110 opened to Claude for `/gsd:sketch` to mockup the user-visible paused state and named refusal surfaces for the DocumentList.

</domain>

<decisions>
## Implementation Decisions

### 1. Database Schema & Migration 153 (QUEUE-01)
- **D-01 (Table Structure)**: Migration `supabase/migrations/153_ingestion_jobs.sql` creates `ingestion_jobs`:
  - `id`: UUID PRIMARY KEY DEFAULT gen_random_uuid()
  - `document_id`: UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE
  - `user_id`: UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
  - `org_id`: UUID REFERENCES orgs(id) ON DELETE SET NULL
  - `status`: TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'paused', 'retry_queued'))
  - `stage`: TEXT NOT NULL DEFAULT 'pending' CHECK (stage IN ('pending', 'extracting', 'tables_embedded', 'chunks_embedded', 'completed', 'failed'))
  - `progress`: JSONB NOT NULL DEFAULT '{}'::jsonb (stores `chunk_offset`, `total_chunks`, `table_count`, `image_count`)
  - `retry_count`: INT NOT NULL DEFAULT 0
  - `max_retries`: INT NOT NULL DEFAULT 3
  - `last_error`: TEXT
  - `error_details`: JSONB
  - `next_run_at`: TIMESTAMPTZ NOT NULL DEFAULT now()
  - `claimed_at`: TIMESTAMPTZ
  - `claimed_by`: TEXT
  - `created_at`: TIMESTAMPTZ NOT NULL DEFAULT now()
  - `updated_at`: TIMESTAMPTZ NOT NULL DEFAULT now()
- **D-02 (RLS Security)**: Row Level Security enabled. Policy allows users to SELECT their own jobs (`auth.uid() = user_id`). Backend worker accesses via service role client or asyncpg pool connection.

### 2. Claim Worker & Concurrency Control (QUEUE-01, QUEUE-02)
- **D-03 (SKIP LOCKED Pattern Reuse)**: Copy the exact claim pattern from `backend/app/db/schedules.py:307`:
  - `SELECT ... FROM ingestion_jobs WHERE status IN ('pending', 'retry_queued') AND next_run_at <= now() ORDER BY next_run_at LIMIT $1 FOR UPDATE SKIP LOCKED`.
  - In the same transaction: `UPDATE ingestion_jobs SET status = 'processing', claimed_at = now(), claimed_by = $2 WHERE id = $1`.
  - Zero leader election needed; safe across multi-worker uvicorn processes.
- **D-04 (Worker Loop Lifecycle)**: `IngestionQueueService` runs in `backend/app/services/ingestion_queue_service.py` with background poll task started in `main.py` lifespan (matching `SchedulerService`).
- **D-05 (Concurrency & Polling Knobs)**:
  - `INGEST_MAX_CONCURRENT_JOBS = 3`
  - `INGEST_POLL_INTERVAL_SECONDS = 2.0`
  - Registered in `config.py`, `docker-compose.prod.yml`, `deploy/onebox.env.example`, and `docs/OPERATOR.md` in the same commit to satisfy `check-deploy-drift.sh`.

### 3. Stage & Chunk Resume Granularity (QUEUE-01, SC#4)
- **D-06 (Granular Resume Checkpoint)**: Ingestion pipeline stores stage transitions and batch offsets in `ingestion_jobs.progress`:
  - Stage 1: File extraction completed -> writes `progress.extracted_text_path` or extracted length.
  - Stage 2: Table chunks embedded -> writes `stage = 'tables_embedded'`.
  - Stage 3: Text chunks embedded in batches -> writes `progress.chunk_offset` after each successful batch.
  - On restart or retry: Resumes from `chunk_offset`, avoiding re-embedding thousands of already-processed chunks.

### 4. Embedding Batcher & Token Ceiling (QUEUE-04, SEED-197)
- **D-07 (Transparent Batching in embed_texts)**:
  - `openai_service.embed_texts` transparently batches texts to stay strictly below OpenAI limits:
    - Max tokens per request: 200,000 (conservative margin below 300,000 limit).
    - Max texts per request: 512 (well below 2,048 limit).
  - Token estimation: Uses `tiktoken` (cl100k_base or model-specific) with fallback heuristic `len(text) // 3.5 + 4`.
  - All callers (`embedding_service`, `multimodal_service`, `reembed_service`) inherit protection automatically.

### 5. Outage Resilience, Same-Model Failover & Named Refusal (QUEUE-05, BUG-260815-05)
- **D-08 (Retry & Circuit Breaker Trip)**:
  - Transient error (e.g. 503, connection error): Exponential backoff with jitter (1s, 2s, 4s), re-queuing job with `status = 'retry_queued'` and `next_run_at = now() + delay`.
  - Rate limit (429) or quota exhaustion: Attempts failover to secondary credentials/endpoint for the **same model / same vector space** if configured (D-2 strict: NO cross-provider substitution).
  - If failover exhausted: Trips `CircuitBreaker` (`circuit_breaker.py`), pauses queue (`status = 'paused'`), sets named refusal specifying provider (e.g. "openai: insufficient_quota (429)"). Closes `BUG-260815-05`.
  - Half-open auto-probe resumes the queue when provider recovers.

### 6. Endpoint Cutover on /upload FIRST (H-3, SC#5)
- **D-09 (/upload Direct Queue Integration)**:
  - `POST /documents/upload` calls `mint_document_row()` from `ingest_splice.py`, then immediately inserts an `ingestion_jobs` row (`status = 'pending'`), and returns HTTP 201.
  - Replaces `background_tasks.add_task(splice_document)`.
  - Preserves 100% of user-visible contract, stage names, counts, and response shapes (SC#5).

### 7. User Interface & G-2 Sketch Gate (SC#3, SC#5)
- **D-10 (G-2 Sketch Handover)**:
  - Opened BUS-110 requesting Claude to generate `/gsd:sketch` for the DocumentList paused banner, status badge, and named refusal copy.
  - Plan 04 will implement the UI components aligned with the approved sketch and Aether Deep Midnight theme tokens.

### 8. Recall Baseline Harness (Phase 241 Anchor)
- **D-11 (Harness Implementation)**:
  - Authors `tests/eval/test_retrieval_recall_baseline.py` and `scripts/measure-recall.py`.
  - Measures Hit@K and MRR across the 77 baseline documents, establishing the ground truth benchmark for Phase 241.

</decisions>

<canonical_refs>
## Canonical References

### Requirements & Roadmap
- `.planning/ROADMAP.md` § Phase 230 — Goal, success criteria (SC#1..SC#5), failure list, H-3 ordering rule.
- `.planning/REQUIREMENTS.md` § QUEUE-01, QUEUE-02, QUEUE-04, QUEUE-05 — Functional requirements.
- `.agent-bus/OPEN.md` § BUS-109 & BUS-110 — Clear-to-start briefing, preconditions, and G-2 sketch request.

### In-Repo Patterns to Reuse
- `backend/app/db/schedules.py:271-340` — `FOR UPDATE SKIP LOCKED` atomic claim pattern.
- `backend/app/services/scheduler_service.py` — Multi-worker safe poll loop and lifecycle.
- `backend/app/services/circuit_breaker.py` — `CircuitBreaker` and `CircuitBreakerTrippedError`.
- `backend/app/services/ingest_splice.py` — Ingest splice pipeline (`mint_document_row` & `splice_document`).
- `backend/app/services/openai_service.py:2129` — `embed_texts` embedding integration site.

### Guardrails & Policies
- `CLAUDE.md` — G-5 hot files, same-commit deploy drift rules, backend test baseline gate.
- `scripts/check-deploy-drift.sh` — Deployment drift gate for `INGEST_*` vars.
- `scripts/check-backend-unit-baseline.cjs` — Backend test ceiling (71 baseline).

</canonical_refs>
