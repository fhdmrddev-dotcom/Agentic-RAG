---
phase: 230
slug: the-durable-ingestion-queue
status: ready_for_execution
nyquist_compliant: true
wave_0_complete: false
created: 2026-09-05
updated: 2026-09-05
---

# Phase 230 — Validation Strategy & Matrix

> Validation contract and verification requirements for The Durable Ingestion Queue (`QUEUE-01`, `QUEUE-02`, `QUEUE-04`, `QUEUE-05`).

---

## 1. Requirement Validation Matrix

| Requirement / Criterion | Behavior / Truth to Prove | Validation Method | Automated Test Suite |
|---|---|---|---|
| **QUEUE-01 / SC#1** | Batch upload part-way through backend restart completes all files; zero files stuck in `processing` | Integration Test | `pytest backend/tests/integration/test_230_upload_queue_cutover.py -k test_restart_survival` |
| **QUEUE-01 & QUEUE-04 / SC#2** | Several hundred files uploaded at once complete steadily under semaphore cap (max 3 concurrent jobs) without saturating worker or provider | Integration Test | `pytest backend/tests/integration/test_230_upload_queue_cutover.py -k test_burst_throttling` |
| **QUEUE-05 / SC#3** | On embedding provider rate-limit (429) or outage, user is told the provider failed and which one — never "your documents returned nothing"; queue pauses with refusal copy | Unit & Frontend Tests | `pytest backend/tests/unit/test_230_ingestion_queue_service.py -k test_outage_circuit_breaker` |
| **QUEUE-01 & QUEUE-05 / SC#4** | File failed 90% through resumes from chunk offset; prior batches are skipped and not re-embedded from zero | Unit & Integration Tests | `pytest backend/tests/integration/test_230_upload_queue_cutover.py -k test_checkpointed_resumption` |
| **QUEUE-02 / SC#5** | Existing upload experience unchanged (same screen, stages, counts); proven on `/upload` FIRST before connectors | Integration Test | `pytest backend/tests/integration/test_230_upload_queue_cutover.py -k test_upload_contract_preservation` |
| **QUEUE-04 / SEED-197** | Embedding calls partitioned under 200,000 tokens and 512 inputs per request; `len(embeddings) == len(texts)` asserted | Unit Tests | `pytest backend/tests/unit/test_230_embed_texts_batcher.py` |
| **Phase 241 Recall Anchor** | Ground truth Hit@K and MRR baseline established over clean 77-document corpus | Evaluation Test | `pytest tests/eval/test_retrieval_recall_baseline.py` & `python scripts/measure-recall.py` |
| **Deploy Drift** | `INGEST_*` environment knobs synchronized across all deploy artifacts in same commit | Drift Check Script | `bash scripts/check-deploy-drift.sh` |
| **G-5 Discharge** | `main.py` and `config.py` hot-file ledgers updated in same commit with disposition cells <= 200 chars | Size & Ledger Gate | `node scripts/check-claude-md-size.cjs` |

---

## 2. Mechanical Gate Baselines

| Gate | Command | Passing Threshold |
|---|---|---|
| **Backend Unit Gate** | `node scripts/check-backend-unit-baseline.cjs` | `failed <= 71`, `errors == 0` |
| **Phase 230 Ingestion DB Suite** | `pytest backend/tests/unit/test_230_ingestion_jobs_db.py -v` | 100% pass |
| **Phase 230 Embedding Batcher Suite** | `pytest backend/tests/unit/test_230_embed_texts_batcher.py -v` | 100% pass |
| **Phase 230 Queue Service Suite** | `pytest backend/tests/unit/test_230_ingestion_queue_service.py -v` | 100% pass |
| **Phase 230 Upload Integration Suite** | `pytest backend/tests/integration/test_230_upload_queue_cutover.py -v` | 100% pass |
| **Phase 230 Recall Baseline Suite** | `pytest tests/eval/test_retrieval_recall_baseline.py -v` | 100% pass |
| **Deploy Drift Gate** | `bash scripts/check-deploy-drift.sh` | 0 drift |
| **CLAUDE.md Size Gate** | `node scripts/check-claude-md-size.cjs` | < 120,000 characters |
| **Frontend Build & Typecheck** | `npm --prefix frontend run build` | Clean build, 0 new errors |
