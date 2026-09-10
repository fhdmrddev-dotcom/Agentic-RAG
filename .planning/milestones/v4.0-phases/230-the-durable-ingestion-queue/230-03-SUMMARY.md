# Phase 230 Plan 03 Summary: IngestionQueueService Daemon & Lifespan Integration (Wave 2)

## Delivered Objectives
1. **Queue Daemon Service (`backend/app/services/ingestion_queue_service.py`):**
   - Implemented `IngestionQueueService` with background polling loop and concurrency bounding via `asyncio.Semaphore`.
   - Wired `reclaim_stale_ingestion_claims` to run at boot and periodically every 60s in the tick loop (G-1 / SC#1).
   - Integrated `CircuitBreaker` for 429 rate limit / quota exhaustion detection, recording refusal reason and pausing queue.
   - Built half-open probe testing the provider every probe interval and auto-resuming paused jobs upon recovery.
   - Enforced D-2: strictly no cross-provider embedding substitution.

2. **Configuration Synchronization & Lifespan Integration (`config.py`, `main.py`):**
   - Added `ingest_max_concurrent_jobs` (default 3), `ingest_poll_interval_seconds` (default 2.0), `ingest_lease_timeout_seconds` (default 300), and `ingest_probe_interval_seconds` (default 60.0) to `backend/app/config.py`.
   - Synchronized `backend/.env.example`, `deploy/onebox.env.example`, `docker-compose.prod.yml`, and `docs/OPERATOR.md` with 0 drift.
   - Integrated queue start/stop into FastAPI lifespan in `backend/app/main.py` with `run_stale_sweep()` executed before `start()`.
   - Updated `CLAUDE.md` and `docs/HOT-FILE-LEDGER.md` for `main.py` and `config.py` in the same commit (G-4).

3. **Unit Test Suite (`backend/tests/unit/test_230_ingestion_queue_service.py`):**
   - 6/6 unit tests passing 100%:
     - 429 rate-limit and quota exhaustion detection.
     - Concurrency semaphore bounding.
     - Stale claim sweeper execution.
     - Circuit breaker trip and queue pause.
     - Half-open probe auto-resume.
     - Exponential backoff retry scheduling.

## Verification Evidence
- `backend/venv/Scripts/pytest.exe backend/tests/unit/test_230_ingestion_queue_service.py -v`: 6 passed.
