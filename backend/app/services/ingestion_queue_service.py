"""Phase 230 (QUEUE-01 / QUEUE-05 / SC#1 / SC#3 / D-03..D-05, D-08) — IngestionQueueService.

The background ingestion queue poller daemon.
One instance per uvicorn worker; workers cooperate safely through PostgreSQL FOR UPDATE SKIP LOCKED.

Key responsibilities:
1. Concurrency bounded by asyncio.Semaphore (default: INGEST_MAX_CONCURRENT_JOBS = 3).
2. Stale-claim recovery via reclaim_stale_ingestion_claims (G-1 / SC#1 mechanism).
3. Provider outage resilience (QUEUE-05 / SC#3 / BUG-260815-05):
   - Tripping circuit_breaker.py on 429 / rate limit / quota exhaustion.
   - Halting the queue and stamping named provider refusal (openai · 429 insufficient_quota).
   - ⛔ NEVER cross-provider embedding substitution (vector space mismatch, D-2).
   - Half-open probe auto-resumes queue when provider recovers.
"""
from __future__ import annotations

import asyncio
from datetime import datetime, timezone
import logging
import time
from typing import Any, Callable
from uuid import UUID, uuid4

import asyncpg
from supabase import Client

from app.config import settings
from app.db.ingestion_jobs import (
    claim_due_ingestion_jobs,
    pause_jobs_for_provider,
    reclaim_stale_ingestion_claims,
    record_job_failure,
    record_job_success,
    resume_paused_jobs,
    update_job_progress,
)
from app.services.circuit_breaker import CircuitBreaker

logger = logging.getLogger(__name__)


def is_provider_rate_limit(exc: Exception) -> tuple[bool, str, int, str]:
    """Inspect exception for 429 rate limit or quota exhaustion signals.

    Returns (is_outage, provider_name, status_code, verbatim_error).
    """
    msg = str(exc)
    exc_type = type(exc).__name__
    status_code = getattr(exc, "status_code", None) or getattr(exc, "code", None)

    is_429 = (
        status_code == 429
        or "429" in msg
        or "RateLimitError" in exc_type
        or "rate_limit" in msg.lower()
        or "insufficient_quota" in msg.lower()
        or "quota exceeded" in msg.lower()
    )

    if not is_429:
        return False, "", 0, ""

    provider = getattr(settings, "llm_provider", "openai") or "openai"
    msg_lower = msg.lower()
    if "anthropic" in msg_lower:
        provider = "anthropic"
    elif "google" in msg_lower or "gemini" in msg_lower:
        provider = "google"
    elif "openrouter" in msg_lower:
        provider = "openrouter"
    elif "openai" in msg_lower:
        provider = "openai"

    return True, provider, 429, msg


class IngestionQueueService:
    """Worker daemon polling due ingestion jobs under concurrency limits and outage protection."""

    def __init__(
        self,
        *,
        pool: asyncpg.Pool,
        supabase_factory: Callable[[], Client] | None = None,
        max_concurrent_jobs: int | None = None,
        poll_interval_seconds: float | None = None,
        lease_timeout_seconds: int | None = None,
        worker_id: str | None = None,
        probe_interval_seconds: float = 15.0,
    ) -> None:
        self.pool = pool
        self._supabase_factory = supabase_factory
        self.max_concurrent_jobs = (
            max_concurrent_jobs
            if max_concurrent_jobs is not None
            else getattr(settings, "ingest_max_concurrent_jobs", 3)
        )
        self.poll_interval_seconds = (
            poll_interval_seconds
            if poll_interval_seconds is not None
            else getattr(settings, "ingest_poll_interval_seconds", 2.0)
        )
        self.lease_timeout_seconds = (
            lease_timeout_seconds
            if lease_timeout_seconds is not None
            else getattr(settings, "ingest_lease_timeout_seconds", 300)
        )
        self.worker_id = worker_id or f"worker-{uuid4().hex[:8]}"
        self.probe_interval_seconds = probe_interval_seconds

        self.semaphore = asyncio.Semaphore(self.max_concurrent_jobs)
        self.circuit_breaker = CircuitBreaker()
        self.refusal_reason: str | None = None
        self.last_error_details: dict[str, Any] | None = None

        self._stopping = asyncio.Event()
        self._loop_task: asyncio.Task | None = None
        self.active_tasks: set[asyncio.Task] = set()

        self.last_stale_sweep_at: float = 0.0
        self.last_probe_at: float = 0.0
        self.ticks = 0
        self.jobs_processed = 0

    @property
    def is_paused(self) -> bool:
        return self.circuit_breaker.tripped

    async def run_stale_sweep(self) -> int:
        """Run stale claim sweeper to rescue jobs stranded by dead/restarted workers (G-1 / SC#1)."""
        swept = await reclaim_stale_ingestion_claims(
            self.pool, lease_timeout_seconds=self.lease_timeout_seconds
        )
        self.last_stale_sweep_at = time.monotonic()
        return swept

    async def probe_provider(self) -> bool:
        """Half-open probe: verify if the embedding provider has recovered from rate-limiting."""
        try:
            from app.services.openai_service import embed_texts

            # Probe with a minimal 1-token text
            embed_texts(["probe"])
            # Provider accepted request! Reset circuit breaker and resume paused jobs
            self.circuit_breaker._tripped = False
            self.refusal_reason = None
            self.last_error_details = None
            resumed = await resume_paused_jobs(self.pool)
            logger.info(
                "Embedding provider recovered! Resumed %d paused ingestion job(s).", resumed
            )
            return True
        except Exception as exc:
            is_outage, _, _, _ = is_provider_rate_limit(exc)
            if is_outage:
                logger.info(
                    "Provider probe still rate-limited: %s (will retry in %.0fs)",
                    exc,
                    self.probe_interval_seconds,
                )
            else:
                logger.warning("Provider probe returned unexpected error: %s", exc)
            return False

    async def tick(self) -> int:
        """Single polling tick: check sweep, probe if paused, and claim due jobs."""
        self.ticks += 1
        now_mono = time.monotonic()

        # 1. Periodic stale-claim sweep every 60s (G-1 / SC#1)
        if now_mono - self.last_stale_sweep_at >= 60.0:
            try:
                await self.run_stale_sweep()
            except Exception:
                logger.exception("Ingestion stale-claim sweep failed (loop continues)")

        # 2. Outage probe when breaker is tripped
        if self.circuit_breaker.tripped:
            if now_mono - self.last_probe_at >= self.probe_interval_seconds:
                self.last_probe_at = now_mono
                recovered = await self.probe_provider()
                if not recovered:
                    return 0
            else:
                return 0

        # 3. Check available concurrency capacity
        available = self.semaphore._value
        if available <= 0:
            return 0

        limit = min(available, self.max_concurrent_jobs)
        try:
            claimed = await claim_due_ingestion_jobs(
                self.pool,
                limit=limit,
                worker_id=self.worker_id,
                max_concurrent=self.max_concurrent_jobs,
            )
        except Exception:
            logger.exception("Failed claiming due ingestion jobs (loop continues)")
            return 0

        for job in claimed:
            task = asyncio.create_task(self._safe_process_job(job))
            self.active_tasks.add(task)
            task.add_done_callback(self.active_tasks.discard)

        return len(claimed)

    async def _safe_process_job(self, job: dict[str, Any]) -> None:
        """Run job inside semaphore and handle completions, outages, and retries."""
        await self.semaphore.acquire()
        try:
            await self._process_job(job)
            self.jobs_processed += 1
        except Exception as exc:
            await self._handle_job_error(job, exc)
        finally:
            self.semaphore.release()

    async def _process_job(self, job: dict[str, Any]) -> None:
        """Execute document splice pipeline for claimed job with checkpointed recovery."""
        from app.services.ingest_splice import splice_document

        supabase = self._supabase_factory() if self._supabase_factory else None

        # Call splice_document passing job_id and progress checkpoint
        await splice_document(
            document_id=str(job["document_id"]),
            supabase=supabase,
            pool=self.pool,
            job_id=job["id"],
            initial_progress=job.get("progress") or {},
        )

        # Mark completed
        await record_job_success(self.pool, job["id"])

    async def _handle_job_error(self, job: dict[str, Any], exc: Exception) -> None:
        """Classify job failure into outage pause (QUEUE-05) or transient/terminal failure."""
        is_outage, provider, status_code, verbatim = is_provider_rate_limit(exc)

        if is_outage:
            # Trip circuit breaker and pause queue with named refusal (SC#3 / BUG-260815-05)
            self.circuit_breaker._tripped = True
            self.last_probe_at = time.monotonic()
            refusal = f"{provider} · {status_code} — {verbatim}"
            self.refusal_reason = refusal
            self.last_error_details = {
                "provider": provider,
                "status_code": status_code,
                "verbatim_error": verbatim,
            }

            logger.warning(
                "Embedding provider outage detected: %s. Tripping circuit breaker and pausing queue.",
                refusal,
            )
            await pause_jobs_for_provider(
                self.pool,
                refusal_reason=refusal,
                error_details=self.last_error_details,
            )
        else:
            # Transient vs terminal determination
            err_str = str(exc)
            # Transient: timeouts, 5xx, network resets
            is_transient = any(
                term in err_str.lower()
                for term in ("timeout", "503", "502", "504", "connection", "reset by peer")
            )
            retry_count = job.get("retry_count", 0)
            backoff_delay = min(60.0, float(2**retry_count) + 1.0)

            status = await record_job_failure(
                self.pool,
                job["id"],
                error_message=err_str,
                error_details={"error_type": type(exc).__name__, "error": err_str},
                is_transient=is_transient,
                retry_delay_seconds=backoff_delay,
            )
            logger.warning(
                "Ingestion job %s failed (%s): %s",
                job["id"],
                status,
                err_str,
            )

    async def _loop(self) -> None:
        """Continuous polling loop."""
        while not self._stopping.is_set():
            try:
                await self.tick()
            except Exception:
                logger.exception("Ingestion queue tick unhandled exception")

            try:
                await asyncio.wait_for(
                    self._stopping.wait(), timeout=self.poll_interval_seconds
                )
            except asyncio.TimeoutError:
                pass

    def start(self) -> None:
        """Start the background queue worker."""
        if self._loop_task is not None:
            return
        self._stopping.clear()
        self._loop_task = asyncio.create_task(self._loop())
        logger.info(
            "IngestionQueueService started (worker_id=%s, max_concurrency=%d, poll_interval=%.1fs)",
            self.worker_id,
            self.max_concurrent_jobs,
            self.poll_interval_seconds,
        )

    async def stop(self) -> None:
        """Stop the background worker and await active jobs."""
        self._stopping.set()
        task, self._loop_task = self._loop_task, None
        if task is not None:
            task.cancel()
            try:
                await task
            except (asyncio.CancelledError, Exception):
                pass

        if self.active_tasks:
            logger.info("Waiting for %d active ingestion task(s) to finish...", len(self.active_tasks))
            await asyncio.gather(*self.active_tasks, return_exceptions=True)
        logger.info("IngestionQueueService stopped.")
