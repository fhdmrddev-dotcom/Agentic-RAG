"""Phase 230 (QUEUE-01 / QUEUE-02 / QUEUE-04 / SC#1 / SC#2 / SC#4 / SC#5 / G-1 / H-3)
Integration tests for /documents/upload queue cutover and worker crash recovery.

Key tests:
1. test_upload_creates_durable_ingestion_job:
   POST /documents/upload returns HTTP 201, saves bytes to Storage, and enqueues
   an ingestion_jobs row at status='pending' with no background task reliance (H-3).
2. test_lost_worker_crash_recovery:
   Simulates worker crash mid-ingest. Stale claim sweeper reclaims job from 'processing'
   to 'pending', and active worker completes it. Zero rows stuck in 'processing' (SC#1 / G-1).
3. test_burst_throttling_semaphore:
   Verifies that concurrent active ingest tasks never exceed INGEST_MAX_CONCURRENT_JOBS (3)
   under burst load (SC#2).
4. test_checkpointed_chunk_resumption:
   Verifies that a job interrupted mid-embedding resumes from progress.chunk_offset
   without re-embedding chunks already in document_chunks (SC#4).
5. test_upload_contract_preservation_and_no_eta:
   Ensures 201 response schema, stages, and countable fields are preserved,
   and NO fake ETA or percentage is introduced (SC#5 / D-217-19).
"""
from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID, uuid4

import asyncpg
from fastapi.testclient import TestClient
import pytest

from app.db.ingestion_jobs import (
    claim_due_ingestion_jobs,
    get_ingestion_job_by_document_id,
    insert_ingestion_job,
    reclaim_stale_ingestion_claims,
    record_job_success,
    update_job_progress,
)
from app.dependencies import get_current_user, get_pg_pool, get_supabase, get_user_supabase_client
from app.main import app
from app.models.document import DocumentResponse
from app.services.ingest_splice import MintResult, splice_document
from app.services.ingestion_queue_service import IngestionQueueService

_DSN = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"

MOCK_USER_ID = "00000000-0000-0000-0000-000000000001"
MOCK_USER = {
    "id": MOCK_USER_ID,
    "email": "tester@example.com",
    "org_id": None,
    "role": "authenticated",
}


@pytest.fixture
async def pg_pool():
    """Create a clean asyncpg connection pool connected to local Postgres."""
    pool = await asyncpg.create_pool(_DSN, min_size=1, max_size=5)
    try:
        yield pool
    finally:
        await pool.close()


async def _insert_test_document(pool: asyncpg.Pool, doc_id: UUID, user_id: UUID, filename: str = "test.txt"):
    """Helper to insert parent row in documents table satisfying ingestion_jobs foreign key."""
    async with pool.acquire() as con:
        await con.execute(
            """
            INSERT INTO documents (
                id, user_id, filename, file_path, file_size, mime_type, status, content_hash
            ) VALUES (
                $1, $2, $3, $4, 100, 'text/plain', 'pending', $5
            )
            ON CONFLICT (id) DO NOTHING
            """,
            doc_id,
            user_id,
            filename,
            f"{user_id}/{doc_id}/{filename}",
            f"hash_{doc_id.hex[:8]}",
        )


async def _delete_test_document(pool: asyncpg.Pool, doc_id: UUID):
    """Clean up test document and cascaded jobs/chunks."""
    async with pool.acquire() as con:
        await con.execute("DELETE FROM documents WHERE id = $1", doc_id)


@pytest.fixture
def mock_supabase_storage():
    """Mock Supabase client providing storage and tables."""
    client = MagicMock()
    storage_bucket = MagicMock()
    client.storage.from_.return_value = storage_bucket
    storage_bucket.upload.return_value = {"Key": "documents/mock"}
    storage_bucket.download.return_value = b"Hello world content for durable queue testing"
    return client


# ─────────────────────────────────────────────────────────────────────────────
# Test 1: Upload Endpoint Enqueues Durable Job (H-3)
# ─────────────────────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_upload_creates_durable_ingestion_job(pg_pool, mock_supabase_storage):
    """POST /documents/upload creates a row in ingestion_jobs and returns 201 immediately."""
    doc_uuid = uuid4()
    doc_id = str(doc_uuid)
    inserted_doc = {
        "id": doc_id,
        "user_id": MOCK_USER_ID,
        "filename": "durable_test.txt",
        "file_path": f"{MOCK_USER_ID}/{doc_id}/durable_test.txt",
        "file_size": 45,
        "mime_type": "text/plain",
        "status": "pending",
        "content_hash": "hash_durable_01",
        "folder_id": None,
        "version_number": 1,
        "is_latest": True,
        "error_message": None,
        "chunk_count": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }

    # Ensure parent document row exists in Postgres for FK
    await _insert_test_document(pg_pool, doc_uuid, UUID(MOCK_USER_ID), "durable_test.txt")

    mint_result = MintResult(
        document=inserted_doc,
        is_duplicate=False,
        storage_path=f"{MOCK_USER_ID}/{doc_id}/durable_test.txt",
        version_number=1,
    )

    app.dependency_overrides[get_current_user] = lambda: MOCK_USER
    app.dependency_overrides[get_user_supabase_client] = lambda: mock_supabase_storage
    app.dependency_overrides[get_supabase] = lambda: mock_supabase_storage
    app.dependency_overrides[get_pg_pool] = lambda: pg_pool

    try:
        with patch("app.services.ingest_splice.async_mint_document_row", return_value=mint_result):
            with TestClient(app) as client:
                file_bytes = b"Hello world content for durable queue testing"
                resp = client.post(
                    "/documents/upload",
                    files={"file": ("durable_test.txt", file_bytes, "text/plain")},
                )

        assert resp.status_code == 201, f"Expected 201, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert data["id"] == doc_id
        assert data["status"] == "pending"
        assert data["filename"] == "durable_test.txt"

        # Verify raw bytes uploaded to Supabase Storage
        mock_supabase_storage.storage.from_().upload.assert_called_once()

        # Verify durable ingestion_jobs record inserted in Postgres
        job = await get_ingestion_job_by_document_id(pg_pool, doc_uuid)
        assert job is not None, f"ingestion_jobs row not found for document_id={doc_id}"
        assert job["status"] in ("pending", "processing"), f"Unexpected status: {job['status']}"
        assert str(job["user_id"]) == MOCK_USER_ID

    finally:
        app.dependency_overrides.clear()
        await _delete_test_document(pg_pool, doc_uuid)


# ─────────────────────────────────────────────────────────────────────────────
# Test 2: Lost Worker Crash Recovery (SC#1 / G-1)
# ─────────────────────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_lost_worker_crash_recovery(pg_pool):
    """Simulates a worker crash mid-ingest.

    A job stranded in 'processing' whose lease expired is swept back to 'pending'
    and completed by a surviving worker with ZERO stuck rows (SC#1 / G-1).
    """
    doc_id = uuid4()
    await _insert_test_document(pg_pool, doc_id, UUID(MOCK_USER_ID))

    job = await insert_ingestion_job(
        pg_pool,
        document_id=doc_id,
        user_id=UUID(MOCK_USER_ID),
    )
    job_id = job["id"]

    try:
        # Simulate worker claiming job and then dying (lease timeout simulated by setting claimed_at in the past)
        async with pg_pool.acquire() as con:
            await con.execute(
                """
                UPDATE ingestion_jobs
                SET status = 'processing',
                    claimed_at = now() - interval '350 seconds',
                    claimed_by = 'crashed-worker-pid-99999'
                WHERE id = $1
                """,
                job_id,
            )

        # 1. Stale claim sweeper runs (G-1 mechanism)
        swept = await reclaim_stale_ingestion_claims(pg_pool, lease_timeout_seconds=300)
        assert swept >= 1, "Stale claim sweeper should have rescued at least 1 job"

        # Verify job returned to pending with retry_count incremented
        async with pg_pool.acquire() as con:
            row = await con.fetchrow("SELECT status, retry_count, claimed_at FROM ingestion_jobs WHERE id = $1", job_id)
            assert row["status"] == "pending"
            assert row["retry_count"] == 1
            assert row["claimed_at"] is None

        # 2. Live worker claims and processes to completion
        worker_id = f"live-worker-{uuid4().hex[:6]}"
        claimed = await claim_due_ingestion_jobs(pg_pool, limit=1, worker_id=worker_id)
        assert len(claimed) == 1
        assert claimed[0]["id"] == job_id

        # Record success
        await record_job_success(pg_pool, job_id)

        # 3. Assert zero rows stuck in processing
        async with pg_pool.acquire() as con:
            stuck_count = await con.fetchval(
                "SELECT count(*) FROM ingestion_jobs WHERE id = $1 AND status = 'processing'",
                job_id,
            )
            assert stuck_count == 0

            final_status = await con.fetchval("SELECT status FROM ingestion_jobs WHERE id = $1", job_id)
            assert final_status == "completed"

    finally:
        await _delete_test_document(pg_pool, doc_id)


# ─────────────────────────────────────────────────────────────────────────────
# Test 3: Burst Throttling Semaphore (SC#2)
# ─────────────────────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_burst_throttling_semaphore(pg_pool):
    """Verifies that concurrent execution is capped by asyncio.Semaphore (default 3)."""
    max_concurrency = 3
    service = IngestionQueueService(
        pool=pg_pool,
        max_concurrent_jobs=max_concurrency,
        poll_interval_seconds=0.1,
    )

    concurrent_active = 0
    max_observed_concurrency = 0
    lock = asyncio.Lock()

    async def mock_process(job):
        nonlocal concurrent_active, max_observed_concurrency
        async with lock:
            concurrent_active += 1
            if concurrent_active > max_observed_concurrency:
                max_observed_concurrency = concurrent_active
        await asyncio.sleep(0.05)
        async with lock:
            concurrent_active -= 1

    service._process_job = mock_process

    # Seed 10 documents and jobs in database
    doc_ids = []
    job_ids = []
    for _ in range(10):
        doc_id = uuid4()
        doc_ids.append(doc_id)
        await _insert_test_document(pg_pool, doc_id, UUID(MOCK_USER_ID))
        job = await insert_ingestion_job(
            pg_pool,
            document_id=doc_id,
            user_id=UUID(MOCK_USER_ID),
        )
        job_ids.append(job["id"])

    try:
        # Tick service multiple times until all jobs claimed
        for _ in range(10):
            await service.tick()
            await asyncio.sleep(0.02)

        # Wait for all active tasks to drain
        if service.active_tasks:
            await asyncio.gather(*service.active_tasks, return_exceptions=True)

        assert max_observed_concurrency <= max_concurrency, (
            f"Concurrency exceeded cap: observed {max_observed_concurrency} > {max_concurrency}"
        )
    finally:
        for doc_id in doc_ids:
            await _delete_test_document(pg_pool, doc_id)


# ─────────────────────────────────────────────────────────────────────────────
# Test 4: Checkpointed Chunk Resumption (SC#4)
# ─────────────────────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_checkpointed_chunk_resumption(pg_pool, mock_supabase_storage):
    """Files interrupted mid-embedding resume from progress.chunk_offset without re-embedding prior chunks."""
    doc_uuid = uuid4()
    doc_id = str(doc_uuid)
    await _insert_test_document(pg_pool, doc_uuid, UUID(MOCK_USER_ID), "sample.txt")

    job = await insert_ingestion_job(
        pg_pool,
        document_id=doc_uuid,
        user_id=UUID(MOCK_USER_ID),
    )
    job_id = job["id"]

    try:
        # Initial checkpoint at chunk_offset = 40 (meaning chunks 0..39 already embedded)
        await update_job_progress(
            pg_pool,
            job_id,
            stage="chunks_embedded",
            progress_patch={"chunk_offset": 40},
        )

        # Prepare document text with multiple paragraphs (producing ~80 chunks)
        paragraphs = [f"Paragraph {i}: This is sample text for chunk verification testing." for i in range(80)]
        full_text = "\n\n".join(paragraphs)

        builder = MagicMock()
        mock_supabase_storage.table.return_value = builder
        builder.select.return_value = builder
        builder.eq.return_value = builder
        builder.maybe_single.return_value = builder
        builder.execute.return_value = MagicMock(data={"full_markdown": full_text, "filename": "sample.txt"})

        embedded_batches = []

        def mock_embed_chunks(chunks, model=None, user_settings=None):
            embedded_batches.append(chunks)
            return [[0.01 * (i + 1)] * 8 for i in range(len(chunks))]

        with patch("app.services.embedding_service.chunk_text", return_value=[f"Chunk {i}" for i in range(100)]), \
             patch("app.services.embedding_service.embed_chunks", side_effect=mock_embed_chunks):
            await splice_document(
                document_id=doc_id,
                raw=full_text.encode("utf-8"),
                mime_type="text/plain",
                filename="sample.txt",
                user_id=MOCK_USER_ID,
                supabase=mock_supabase_storage,
                job_id=job_id,
                initial_progress={"stage": "chunks_embedded", "chunk_offset": 40},
                pool=pg_pool,
            )

        # SC#4: Total chunks embedded in this resumption pass should only embed from chunk 40 onwards (60 chunks)
        total_embedded_this_run = sum(len(b) for b in embedded_batches)
        assert total_embedded_this_run == 60
        assert embedded_batches[0][0] == "Chunk 40"

        # Verify that the job's final progress reaches completed
        async with pg_pool.acquire() as con:
            final_job = await con.fetchrow("SELECT stage, progress FROM ingestion_jobs WHERE id = $1", job_id)
            assert final_job["stage"] == "completed"

    finally:
        await _delete_test_document(pg_pool, doc_uuid)


# ─────────────────────────────────────────────────────────────────────────────
# Test 5: Upload Contract Preservation & No Fake ETA (SC#5 / D-217-19)
# ─────────────────────────────────────────────────────────────────────────────
def test_upload_contract_preservation_and_no_eta():
    """Verify that DocumentResponse contract is preserved and NO fake ETA exists."""
    schema = DocumentResponse.model_json_schema()
    properties = schema.get("properties", {})

    # Existing contract fields MUST exist
    assert "id" in properties
    assert "filename" in properties
    assert "status" in properties
    assert "file_size" in properties
    assert "mime_type" in properties
    assert "version_number" in properties
    assert "is_latest" in properties

    # ⛔ D-217-19: NO fake ETA and NO fake percentage fields
    forbidden_tokens = ["eta", "estimated_time", "progress_percentage", "percent_complete"]
    for token in forbidden_tokens:
        assert token not in properties, f"Forbidden fake metric '{token}' found in DocumentResponse schema"
