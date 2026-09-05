"""Phase 230 (QUEUE-01 / QUEUE-05 / SC#1 / SC#3) — Unit tests for IngestionQueueService.

Tests:
1. Concurrency limit enforced via asyncio.Semaphore (max_concurrent_jobs).
2. Poller tick claims and launches jobs.
3. Stale claim sweeper (G-1 / SC#1) rescue mechanics.
4. Outage detection: 429 / quota error trips circuit breaker and pauses queue (SC#3 / BUG-260815-05).
5. Half-open probe recovers and resumes paused queue.
6. Transient vs terminal failure handling with exponential backoff.
"""
from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from app.services.ingestion_queue_service import (
    IngestionQueueService,
    is_provider_rate_limit,
)


def test_is_provider_rate_limit_detection():
    """Inspect exceptions for 429 rate limit and quota exhaustion signals."""
    # Case 1: Standard 429 exception
    exc_429 = Exception("Rate limit reached for text-embedding-3-small (429)")
    is_outage, provider, code, verbatim = is_provider_rate_limit(exc_429)
    assert is_outage is True
    assert code == 429
    assert provider == "openai"
    assert "Rate limit" in verbatim

    # Case 2: Insufficient quota message
    exc_quota = Exception("insufficient_quota: You exceeded your current quota")
    is_outage, provider, code, verbatim = is_provider_rate_limit(exc_quota)
    assert is_outage is True
    assert code == 429

    # Case 3: Transient 503 error (NOT an outage/breaker trip)
    exc_503 = Exception("503 Service Unavailable")
    is_outage, _, _, _ = is_provider_rate_limit(exc_503)
    assert is_outage is False

    # Case 4: Anthropic provider mention
    exc_anthropic = Exception("anthropic rate_limit error 429")
    is_outage, provider, code, _ = is_provider_rate_limit(exc_anthropic)
    assert is_outage is True
    assert provider == "anthropic"


@pytest.mark.asyncio
async def test_concurrency_bounding_with_semaphore():
    """Verify that IngestionQueueService does not claim more jobs than available semaphore slots."""
    pool = MagicMock()
    service = IngestionQueueService(
        pool=pool,
        max_concurrent_jobs=2,
        poll_interval_seconds=1.0,
    )

    assert service.semaphore._value == 2

    # Simulate 2 jobs already running (holding the semaphore)
    await service.semaphore.acquire()
    await service.semaphore.acquire()
    assert service.semaphore._value == 0

    # Tick should claim 0 jobs because no slots available
    with patch("app.services.ingestion_queue_service.claim_due_ingestion_jobs") as mock_claim:
        claimed_count = await service.tick()
        assert claimed_count == 0
        mock_claim.assert_not_called()

    # Release 1 slot
    service.semaphore.release()
    assert service.semaphore._value == 1

    # Tick should now claim up to 1 job
    with patch(
        "app.services.ingestion_queue_service.claim_due_ingestion_jobs",
        return_value=[{"id": uuid4(), "document_id": uuid4(), "progress": {}}],
    ) as mock_claim:
        with patch.object(service, "_safe_process_job", new_callable=AsyncMock):
            claimed_count = await service.tick()
            assert claimed_count == 1
            mock_claim.assert_called_once_with(
                pool, limit=1, worker_id=service.worker_id, max_concurrent=2
            )


@pytest.mark.asyncio
async def test_stale_claim_sweeper_runs():
    """Verify run_stale_sweep invokes reclaim_stale_ingestion_claims with configured lease."""
    pool = MagicMock()
    service = IngestionQueueService(
        pool=pool,
        lease_timeout_seconds=240,
    )

    with patch(
        "app.services.ingestion_queue_service.reclaim_stale_ingestion_claims",
        new_callable=AsyncMock,
        return_value=5,
    ) as mock_sweep:
        swept = await service.run_stale_sweep()
        assert swept == 5
        mock_sweep.assert_called_once_with(pool, lease_timeout_seconds=240)


@pytest.mark.asyncio
async def test_provider_outage_trips_breaker_and_pauses_queue():
    """When a 429 occurs, breaker trips, refusal reason is recorded, and queue pauses (QUEUE-05 / SC#3)."""
    pool = MagicMock()
    service = IngestionQueueService(
        pool=pool,
        max_concurrent_jobs=2,
        probe_interval_seconds=60.0,
    )

    job = {
        "id": uuid4(),
        "document_id": uuid4(),
        "retry_count": 0,
        "progress": {},
    }

    rate_limit_exc = Exception(
        "openai · 429 insufficient_quota — Rate limit reached for text-embedding-3-small"
    )

    with patch("app.services.ingestion_queue_service.pause_jobs_for_provider", new_callable=AsyncMock) as mock_pause:
        await service._handle_job_error(job, rate_limit_exc)

        # Breaker must be tripped
        assert service.circuit_breaker.tripped is True
        assert service.is_paused is True
        assert "openai" in service.refusal_reason
        assert "429" in service.refusal_reason
        mock_pause.assert_called_once()

    # When paused, tick() must refuse to claim new jobs
    with patch("app.services.ingestion_queue_service.claim_due_ingestion_jobs") as mock_claim:
        count = await service.tick()
        assert count == 0
        mock_claim.assert_not_called()


@pytest.mark.asyncio
async def test_probe_provider_auto_resumes_paused_queue():
    """Half-open probe succeeds: resets circuit breaker and calls resume_paused_jobs."""
    pool = MagicMock()
    service = IngestionQueueService(
        pool=pool,
    )

    # Trip breaker manually
    service.circuit_breaker._tripped = True
    service.refusal_reason = "openai · 429"
    assert service.is_paused is True

    # Mock successful probe embedding
    with patch("app.services.openai_service.embed_texts", return_value=[[0.1, 0.2]]):
        with patch("app.services.ingestion_queue_service.resume_paused_jobs", new_callable=AsyncMock, return_value=3) as mock_resume:
            recovered = await service.probe_provider()
            assert recovered is True
            assert service.circuit_breaker.tripped is False
            assert service.is_paused is False
            assert service.refusal_reason is None
            mock_resume.assert_called_once_with(pool)


@pytest.mark.asyncio
async def test_transient_failure_records_backoff_retry():
    """Transient network error schedules a retry_queued failure with backoff."""
    pool = MagicMock()
    service = IngestionQueueService(pool=pool)

    job = {
        "id": uuid4(),
        "document_id": uuid4(),
        "retry_count": 1,
        "progress": {},
    }

    timeout_exc = TimeoutError("Connection timeout while embedding chunks")

    with patch("app.services.ingestion_queue_service.record_job_failure", new_callable=AsyncMock) as mock_record:
        await service._handle_job_error(job, timeout_exc)

        assert service.circuit_breaker.tripped is False
        mock_record.assert_called_once()
        _, _, kwargs = mock_record.mock_calls[0]
        assert kwargs["is_transient"] is True
        assert kwargs["retry_delay_seconds"] > 0
