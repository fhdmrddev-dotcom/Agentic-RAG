# Phase 230: The Durable Ingestion Queue - Context

**Gathered:** 2026-09-05
**Status:** Ready for planning (Updated with Sketch 227 Winner & Pre-flight G-1..G-4 Resolutions)

<domain>
## Phase Boundary

Phase 230 delivers **The Durable Ingestion Queue** (`QUEUE-01`, `QUEUE-02`, `QUEUE-04`, `QUEUE-05`). It makes document ingestion survive a backend restart, a burst of hundreds of files, and an embedding provider outage — and when it cannot proceed, it surfaces the honest provider refusal on screen instead of producing an empty result.

Core Deliverables:
1. **Migration 153 (`153_ingestion_jobs.sql`)**: Introduces `ingestion_jobs` table with state machine, retry count, stage/progress tracking, `claimed_at`, and RLS.
2. **Durable Claim Worker & Stale Sweeper (`IngestionQueueService` & `db/ingestion_jobs.py`)**: Reuses the in-repo `FOR UPDATE SKIP LOCKED` claim pattern from `db/schedules.py:307` and implements the `claimed_at` stale-claim sweeper (copied from `main.py:426`) with `INGEST_LEASE_TIMEOUT_SECONDS` so uncompleted jobs survive lost workers/restarts without being stuck in `processing` (SC#1 / G-1).
3. **Queue Cutover on `/upload` FIRST (H-3)**: Proves the queue against the existing `/upload` endpoint with 30 phases of coverage before any connector or adapter touches it (`QUEUE-02`).
4. **Token-Aware & Input-Bounded Batcher (`QUEUE-04`, `SEED-197`)**: Batches embeddings inside `openai_service.embed_texts` respecting OpenAI's 300,000 token request ceiling and 2,048 input limit (conservative ceiling: 200k tokens / 512 chunks).
5. **Outage Resilience & Named Refusal (`QUEUE-05`, `BUG-260815-05`)**: Retries with backoff/jitter, fails over only to same-model endpoints (D-2 strict no-cross-provider substitution), trips `circuit_breaker.py`, pauses the queue, and presents the named provider refusal.
6. **Deploy Drift & G-5 Compliance (G-4)**: Synchronizes `INGEST_*` configuration across `config.py`, `docker-compose.prod.yml`, `deploy/onebox.env.example`, and `docs/OPERATOR.md`. G-5 hot files `main.py` and `config.py` updated in `230-03-PLAN.md` (same commit as the code changes).
7. **Phase 241 Recall Baseline Harness (G-3)**: Collected under `backend/tests/eval/test_retrieval_recall_baseline.py` and `scripts/measure-recall.py` measuring Hit@K / MRR over the 77 completed baseline documents.
8. **UI Ingestion Honesty (Sketch 227 Variant B - The Batch Lane)**: Mounted in `frontend/src/components/library/IngestionTab.tsx` and `frontend/src/components/ingestion/DocumentList.tsx` under the **In progress** sub-tab (D-12). Displays real file counts ("218 of 340 files", NO ETA per D-217-19) with verbatim mono provider error, countdown retry, and `--energy` motion tokens.

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

### 2. Claim Worker, Stale-Claim Sweeper & Concurrency Control (QUEUE-01, QUEUE-02, G-1)
- **D-03 (SKIP LOCKED Pattern Reuse)**: Copy the exact claim pattern from `backend/app/db/schedules.py:307`:
  - `SELECT ... FROM ingestion_jobs WHERE status IN ('pending', 'retry_queued') AND next_run_at <= COALESCE($2::timestamptz, now()) ORDER BY next_run_at LIMIT $1 FOR UPDATE SKIP LOCKED`.
  - In the same transaction: `UPDATE ingestion_jobs SET status = 'processing', claimed_at = now(), claimed_by = $2, updated_at = now() WHERE id = $1`.
  - Zero leader election needed; safe across multi-worker uvicorn processes.
- **D-04 (Stale-Claim Sweeper - G-1 / SC#1 Mechanism)**:
  - Implement `reclaim_stale_ingestion_claims(pool, lease_timeout_seconds)` in `db/ingestion_jobs.py` (copied from `main.py:426` orphan sweep pattern).
  - Finds rows where `status = 'processing' AND claimed_at < now() - lease_interval`.
  - If `retry_count + 1 < max_retries`: resets to `status = 'pending'`, increments `retry_count`, clears `claimed_by`.
  - If `retry_count + 1 >= max_retries`: sets `status = 'failed'`, `last_error = 'lease_timeout_exceeded'`.
  - Invoked periodically (at boot and on worker poll loop) so uncompleted jobs survive crashes/restarts without being stuck in `processing`.
- **D-05 (Concurrency, Polling & Lease Knobs)**:
  - `INGEST_MAX_CONCURRENT_JOBS = 3`
  - `INGEST_POLL_INTERVAL_SECONDS = 2.0`
  - `INGEST_LEASE_TIMEOUT_SECONDS = 300`
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
  - Asserts `len(embeddings) == len(texts)` in `embed_texts` and `multimodal_service.py` (SEED-197).

### 5. Outage Resilience, Same-Model Failover & Named Refusal (QUEUE-05, BUG-260815-05)
- **D-08 (Retry & Circuit Breaker Trip)**:
  - Transient error (e.g. 503, connection error): Exponential backoff with jitter (1s, 2s, 4s), re-queuing job with `status = 'retry_queued'` and `next_run_at = now() + delay`.
  - Rate limit (429) or quota exhaustion: Attempts failover to secondary credentials/endpoint for the **same model / same vector space** if configured (D-2 strict: NO cross-provider substitution).
  - If failover exhausted: Trips `CircuitBreaker` (`circuit_breaker.py`), pauses queue (`status = 'paused'`), sets named refusal specifying provider and verbatim error (e.g. `openai · 429 insufficient_quota — "Rate limit reached for text-embedding-3-small..."`). Closes `BUG-260815-05`.
  - Half-open auto-probe resumes the queue when provider recovers.

### 6. Endpoint Cutover on /upload FIRST (H-3, SC#5)
- **D-09 (/upload Direct Queue Integration)**:
  - `POST /documents/upload` calls `mint_document_row()` from `ingest_splice.py`, then immediately inserts an `ingestion_jobs` row (`status = 'pending'`), and returns HTTP 201.
  - Replaces `background_tasks.add_task(splice_document)`.
  - Preserves 100% of user-visible contract, stage names, counts, and response shapes (SC#5).

### 7. User Interface & G-2 Sketch Gate (SC#3, SC#5, Sketch 227)
- **D-10 (Sketch 227 Variant B - The Batch Lane)**:
  - Implements Variant B from `.planning/sketches/227-the-paused-queue-and-its-refusal/`:
    - Every ~10 files is a bar; wave progresses left to right; held amber column marks refusal site.
    - Energized by default with calm toggle (`--energy: 0`) and full `prefers-reduced-motion` support.
    - Motion tokens: `laneRise` (1.1s active column), `dotBounce` (1.4s retry dots), `brandPulse` (1.5s live file dot), `fadeSlideUp` (0.34s refusal entrance), `comet` (1.7s sweep).
- **D-11 (Honesty & No-ETA Rule - D-217-19 Compliance)**:
  - ⛔ Cut ETA: Zero time-estimate strings (no "about 7 min left").
  - Determinate file counting: "218 of 340 files are already added and stay added. The remaining 122 are queued, not lost."
  - Verbatim mono refusal copy + countdown retry ("Retrying automatically in 14s — nothing for you to do").
- **D-12 (Sub-Tab Placement - Open Decision Resolved)**:
  - A paused batch appears under **In progress** in `frontend/src/components/library/IngestionTab.tsx` (not "Needs attention"), because the work has not failed, resumes automatically, and requires zero user intervention.
  - Targets real files: `frontend/src/components/library/IngestionTab.tsx` and `frontend/src/components/ingestion/DocumentList.tsx` (G-2 path fix).

### 8. Recall Baseline Harness (Phase 241 Anchor / G-3)
- **D-13 (Harness Location & Gate Collection)**:
  - Authors `backend/tests/eval/test_retrieval_recall_baseline.py` and `scripts/measure-recall.py`.
  - Located under `backend/tests/` to be collected by pytest per `backend/pytest.ini` (`testpaths = tests`).
  - Measures Hit@K and MRR across the 77 baseline documents, establishing the ground truth benchmark for Phase 241.

### 9. Hot-File Ledger Alignment (G-4)
- **D-14 (Same-Commit Ledger Discharge in 230-03)**:
  - `CLAUDE.md` and `docs/HOT-FILE-LEDGER.md` updates for `main.py` and `config.py` are executed in `230-03-PLAN.md` (Wave 2) alongside the code changes, honouring the project's same-commit rule. Disposition cells strictly <= 200 chars.

</decisions>

<canonical_refs>
## Canonical References

### Requirements, Roadmap & Sketch
- `.planning/ROADMAP.md` § Phase 230 — Goal, success criteria (SC#1..SC#5), failure list, H-3 ordering rule.
- `.planning/REQUIREMENTS.md` § QUEUE-01, QUEUE-02, QUEUE-04, QUEUE-05 — Functional requirements.
- `.planning/sketches/227-the-paused-queue-and-its-refusal/` — Locked Sketch 227 (Variant B, Variant B index.html and README.md).
- `.agent-bus/OPEN.md` § BUS-109, BUS-110, BUS-111 — Briefings, pre-flight review, and sketch delivery.

### In-Repo Patterns to Reuse
- `backend/app/db/schedules.py:271-340` — `FOR UPDATE SKIP LOCKED` atomic claim pattern.
- `backend/app/main.py:421-443` — Stale run sweeper / orphan reconciler pattern.
- `backend/app/services/circuit_breaker.py` — `CircuitBreaker` and `CircuitBreakerTrippedError`.
- `backend/app/services/ingest_splice.py` — Ingest splice pipeline (`mint_document_row` & `splice_document`).
- `backend/app/services/openai_service.py:2129` — `embed_texts` embedding integration site.
- `frontend/src/components/library/IngestionTab.tsx` — Ingestion tab sub-tabs (`in-progress`).
- `frontend/src/components/ingestion/DocumentList.tsx` — Document table and row rendering.

### Guardrails & Policies
- `CLAUDE.md` — G-5 hot files, same-commit deploy drift rules, backend test baseline gate.
- `scripts/check-deploy-drift.sh` — Deployment drift gate for `INGEST_*` vars.
- `scripts/check-backend-unit-baseline.cjs` — Backend test ceiling (71 baseline).
- `scripts/check-claude-md-size.cjs` — CLAUDE.md size and disposition cell cap (<200 chars).

</canonical_refs>
