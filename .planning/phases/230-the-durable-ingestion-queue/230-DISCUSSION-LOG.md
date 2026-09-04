# Phase 230: The Durable Ingestion Queue - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-05
**Phase:** 230-the-durable-ingestion-queue
**Areas discussed:** G-2 Sketch Gate for Paused Ingestion & Named Refusal, Resume Granularity, Embedding Batching & Token Ceiling, Ingestion Concurrency & Polling Configuration, Recall Harness for Phase 241

---

## 1. G-2 Sketch Gate for Paused Ingestion & Named Refusal Surfaces

| Option | Description | Selected |
|--------|-------------|----------|
| Hand off to Claude for `/gsd:sketch` (Recommended) | Open agent bus item to Claude for `/gsd:sketch` to create UI mockups for the DocumentList paused banner, status badge, and named refusal copy, while Gemini plans backend/queue plans 01..03 in parallel. | ✓ |
| In-place spec in Phase 230 | Proceed directly with an in-place spec using Aether Deep Midnight tokens without a separate Claude sketch session. | |

**User's choice:** Hand off to Claude for `/gsd:sketch` (via agent bus).
**Notes:** G-2 is honoured by delegating the visual surface sketch to Claude, opening BUS-110.

---

## 2. Resume Granularity (QUEUE-01 & SC#4)

| Option | Description | Selected |
|--------|-------------|----------|
| Stage-level + chunk-batch offset checkpointing (Recommended) | Record stages ('extracted', 'tables_embedded', 'chunks_embedded') and chunk offset in `ingestion_jobs.progress`, so restart/retry picks up exactly at the un-embedded batch. | ✓ |
| Stage-level checkpointing only | Record stage completion ('extracting', 'embedding', 'completed'), re-running the embedding pass for the document if interrupted. | |

**User's choice:** Stage-level + chunk-batch offset checkpointing.
**Notes:** Ensures SC#4 is met: a file failing 90% through does not re-embed from zero.

---

## 3. Embedding Batching & Token Ceiling Safety Floor (QUEUE-04, SEED-197)

| Option | Description | Selected |
|--------|-------------|----------|
| Conservative ceiling of 200,000 tokens and 512 chunks (Recommended) | 200,000 token ceiling and 512 chunks max per batch using `tiktoken` (fallback `len(t) // 3.5`), batching transparently inside `openai_service.embed_texts`. | ✓ |
| Max 250,000 tokens and 1024 chunks | Strict count + token cap: 1024 texts max and 250,000 tokens per batch using `tiktoken`. | |

**User's choice:** Conservative ceiling of 200,000 tokens and 512 chunks per batch.
**Notes:** Closes SEED-197 and respects OpenAI 300,000 token limit with comfortable safety headroom.

---

## 4. Ingestion Concurrency & Polling Configuration (QUEUE-01 & Deploy Drift)

| Option | Description | Selected |
|--------|-------------|----------|
| `INGEST_MAX_CONCURRENT_JOBS=3`, `INGEST_POLL_INTERVAL_SECONDS=2` (Recommended) | Balanced defaults synced across `config.py`, `docker-compose.prod.yml`, `deploy/onebox.env.example`, and `docs/OPERATOR.md`. | ✓ |
| `INGEST_MAX_CONCURRENT_JOBS=5`, `INGEST_POLL_INTERVAL_SECONDS=1` | Aggressive throughput defaults. | |

**User's choice:** `INGEST_MAX_CONCURRENT_JOBS=3`, `INGEST_POLL_INTERVAL_SECONDS=2`.
**Notes:** Guarantees no deploy drift (`check-deploy-drift.sh`) while preventing worker saturation during bursts.

---

## 5. Recall Harness for Phase 241 Baseline

| Option | Description | Selected |
|--------|-------------|----------|
| `tests/eval/test_retrieval_recall_baseline.py` + `scripts/measure-recall.py` (Recommended) | Dedicated script and test measuring Hit@K / MRR over the 77 baseline documents. | ✓ |
| `backend/app/services/eval/recall_harness.py` | Integrated backend service module. | |

**User's choice:** `tests/eval/test_retrieval_recall_baseline.py` + `scripts/measure-recall.py`.
**Notes:** Establishes the baseline recall required for Phase 241 without premature coupling to runtime services.
