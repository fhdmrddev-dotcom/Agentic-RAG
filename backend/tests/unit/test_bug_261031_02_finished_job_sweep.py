"""BUG-261031-02 — a document whose ingestion job FINISHED but whose own status still reads
'processing' shows as ingesting forever.

Measured 2026-10-31 on the local DB: `ACME_MSA_2026.md` (uploaded 2026-09-28) read
`status='processing'` for a month while its one chunk was embedded, its metadata saved and its
ingestion job read `completed` with 0 retries. `reclaim_stale_ingestion_claims` reads JOBS only,
so nothing ever looked at that document again.

`reconcile_finished_job_documents` closes the gap:
- chunks exist  -> 'completed' (the work is there; only the label was wrong)
- no chunks     -> 'failed' with a sentence (calling it complete would claim text that is not there)
- any job for the document still pending/processing/paused/retry_queued -> left alone (a re-ingest owns it)
- the finished job is younger than the grace window -> left alone (do not race a live write)
"""
from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from app.db.ingestion_jobs import (
    STOPPED_BEFORE_FINISHING_SENTENCE,
    reconcile_finished_job_documents,
)
from app.services.ingestion_queue_service import IngestionQueueService

_DSN = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"


# ── §A — the loop runs it ─────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_tick_runs_the_finished_job_reconcile_beside_the_stale_sweep():
    pool = MagicMock()
    service = IngestionQueueService(pool=pool)
    with patch(
        "app.services.ingestion_queue_service.reclaim_stale_ingestion_claims",
        new_callable=AsyncMock,
        return_value=0,
    ), patch(
        "app.services.ingestion_queue_service.reconcile_finished_job_documents",
        new_callable=AsyncMock,
        return_value=1,
    ) as mock_reconcile, patch(
        "app.services.ingestion_queue_service.claim_due_ingestion_jobs",
        new_callable=AsyncMock,
        return_value=[],
    ):
        await service.tick()
    mock_reconcile.assert_awaited_once_with(pool)


@pytest.mark.asyncio
async def test_a_failing_reconcile_does_not_stop_the_loop():
    pool = MagicMock()
    service = IngestionQueueService(pool=pool)
    with patch(
        "app.services.ingestion_queue_service.reclaim_stale_ingestion_claims",
        new_callable=AsyncMock,
        return_value=0,
    ), patch(
        "app.services.ingestion_queue_service.reconcile_finished_job_documents",
        new_callable=AsyncMock,
        side_effect=RuntimeError("db down"),
    ), patch(
        "app.services.ingestion_queue_service.claim_due_ingestion_jobs",
        new_callable=AsyncMock,
        return_value=[],
    ) as mock_claim:
        await service.tick()
    mock_claim.assert_awaited()


# ── §B — live local DB (:54322) ───────────────────────────────────────────────


@pytest.fixture
async def live_pool():
    asyncpg = pytest.importorskip("asyncpg")
    try:
        pool = await asyncio.wait_for(asyncpg.create_pool(_DSN, min_size=1, max_size=2), timeout=3.0)
    except Exception as exc:  # noqa: BLE001
        pytest.skip(f"Postgres unavailable on {_DSN}: {exc}")
    try:
        yield pool
    finally:
        await pool.close()


async def _seed(pool, *, chunks: int, job_statuses: list[str], job_age_seconds: int) -> dict:
    async with pool.acquire() as con:
        user_id = await con.fetchval("SELECT user_id FROM documents LIMIT 1")
        if user_id is None:
            pytest.skip("No documents in local DB")
        doc_id = uuid4()
        await con.execute(
            """
            INSERT INTO documents (id, user_id, filename, file_path, file_size, mime_type, status, ingestion_step)
            VALUES ($1, $2, 'bug_261031_02.md', 'test/bug_261031_02.md', 10, 'text/markdown', 'processing', 'embedding')
            """,
            doc_id,
            user_id,
        )
        org_id = await con.fetchval("SELECT org_id FROM documents WHERE id = $1", doc_id)
        for i in range(chunks):
            await con.execute(
                "INSERT INTO document_chunks (document_id, user_id, org_id, content, chunk_index) VALUES ($1, $2, $3, 'x', $4)",
                doc_id,
                user_id,
                org_id,
                i,
            )
        for status in job_statuses:
            await con.execute(
                """
                INSERT INTO ingestion_jobs (document_id, user_id, org_id, status, stage, updated_at)
                VALUES ($1, $2, $3, $4, $5, now() - make_interval(secs => $6::double precision))
                """,
                doc_id,
                user_id,
                org_id,
                status,
                "completed" if status == "completed" else "pending",
                float(job_age_seconds),
            )
    return {"doc_id": doc_id}


async def _doc(pool, doc_id):
    async with pool.acquire() as con:
        return await con.fetchrow("SELECT status, error_message FROM documents WHERE id = $1", doc_id)


async def _cleanup(pool, doc_id):
    async with pool.acquire() as con:
        await con.execute("DELETE FROM ingestion_jobs WHERE document_id = $1", doc_id)
        await con.execute("DELETE FROM document_chunks WHERE document_id = $1", doc_id)
        await con.execute("DELETE FROM documents WHERE id = $1", doc_id)


@pytest.mark.asyncio
async def test_live_finished_job_with_chunks_completes_the_document(live_pool):
    seeded = await _seed(live_pool, chunks=1, job_statuses=["completed"], job_age_seconds=3600)
    try:
        assert await reconcile_finished_job_documents(live_pool) >= 1
        row = await _doc(live_pool, seeded["doc_id"])
        assert row["status"] == "completed"
        assert row["error_message"] is None
    finally:
        await _cleanup(live_pool, seeded["doc_id"])


@pytest.mark.asyncio
async def test_live_finished_job_with_no_chunks_fails_the_document_with_a_sentence(live_pool):
    seeded = await _seed(live_pool, chunks=0, job_statuses=["completed"], job_age_seconds=3600)
    try:
        await reconcile_finished_job_documents(live_pool)
        row = await _doc(live_pool, seeded["doc_id"])
        assert row["status"] == "failed"
        assert row["error_message"] == STOPPED_BEFORE_FINISHING_SENTENCE
    finally:
        await _cleanup(live_pool, seeded["doc_id"])


@pytest.mark.asyncio
@pytest.mark.parametrize("live_status", ["pending", "processing", "paused", "retry_queued"])
async def test_live_a_document_with_a_live_job_is_left_alone(live_pool, live_status):
    seeded = await _seed(live_pool, chunks=1, job_statuses=["completed", live_status], job_age_seconds=3600)
    try:
        await reconcile_finished_job_documents(live_pool)
        assert (await _doc(live_pool, seeded["doc_id"]))["status"] == "processing"
    finally:
        await _cleanup(live_pool, seeded["doc_id"])


@pytest.mark.asyncio
async def test_live_a_just_finished_job_is_inside_the_grace_window(live_pool):
    seeded = await _seed(live_pool, chunks=1, job_statuses=["completed"], job_age_seconds=5)
    try:
        await reconcile_finished_job_documents(live_pool)
        assert (await _doc(live_pool, seeded["doc_id"]))["status"] == "processing"
    finally:
        await _cleanup(live_pool, seeded["doc_id"])
