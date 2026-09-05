"""Phase 230 (QUEUE-01 / SC#1 / G-1) — Unit and live tests for app.db.ingestion_jobs.

Tests:
1. SQL query composition, parameter binding, and transaction boundary handling.
2. Atomic claim via FOR UPDATE SKIP LOCKED.
3. Stale-claim sweeper (G-1 / SC#1): expired claimed_at swept to pending or failed.
4. Progress updates and stage transitions.
5. Transient vs terminal failure handling with backoff.
6. Outage pause and auto-resume mechanics.
"""
from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock
from uuid import UUID, uuid4

import pytest

from app.db.ingestion_jobs import (
    claim_due_ingestion_jobs,
    get_ingestion_job_by_document_id,
    get_ingestion_job_by_id,
    insert_ingestion_job,
    pause_jobs_for_provider,
    reclaim_stale_ingestion_claims,
    record_job_failure,
    record_job_success,
    resume_paused_jobs,
    update_job_progress,
)

_DSN = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"


# ══════════════════════════════════════════════════════════════════════════════
# §A — Unit Tests with Mocked Pool & Connection
# ══════════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
async def test_insert_ingestion_job_mock():
    pool = MagicMock()
    con = AsyncMock()
    pool.acquire.return_value.__aenter__.return_value = con

    doc_id = uuid4()
    user_id = uuid4()
    org_id = uuid4()
    expected_row = {
        "id": uuid4(),
        "document_id": doc_id,
        "user_id": user_id,
        "org_id": org_id,
        "status": "pending",
        "stage": "pending",
        "progress": {},
        "retry_count": 0,
        "max_retries": 3,
        "last_error": None,
        "error_details": None,
        "next_run_at": datetime.now(timezone.utc),
        "claimed_at": None,
        "claimed_by": None,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
    con.fetchrow.return_value = expected_row

    result = await insert_ingestion_job(
        pool,
        document_id=doc_id,
        user_id=user_id,
        org_id=org_id,
        max_retries=3,
    )

    assert result["document_id"] == doc_id
    assert result["status"] == "pending"
    assert con.fetchrow.called
    query, *params = con.fetchrow.call_args[0]
    assert "INSERT INTO ingestion_jobs" in query
    assert params == [doc_id, user_id, org_id, 3]


@pytest.mark.asyncio
async def test_claim_due_ingestion_jobs_executes_in_transaction_with_skip_locked():
    pool = MagicMock()
    con = AsyncMock()
    txn = MagicMock()
    txn.__aenter__ = AsyncMock()
    txn.__aexit__ = AsyncMock()
    con.transaction = MagicMock(return_value=txn)
    pool.acquire.return_value.__aenter__.return_value = con

    job_id = uuid4()
    due_row = {
        "id": job_id,
        "document_id": uuid4(),
        "user_id": uuid4(),
        "org_id": None,
        "status": "pending",
        "stage": "pending",
        "progress": {},
        "retry_count": 0,
        "max_retries": 3,
        "last_error": None,
        "error_details": None,
        "next_run_at": datetime.now(timezone.utc),
        "claimed_at": None,
        "claimed_by": None,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
    con.fetch.return_value = [due_row]

    claimed = await claim_due_ingestion_jobs(
        pool,
        limit=2,
        worker_id="worker-test-1",
    )

    assert len(claimed) == 1
    assert claimed[0]["id"] == job_id
    assert claimed[0]["status"] == "processing"
    assert claimed[0]["claimed_by"] == "worker-test-1"

    # In-transaction verification
    con.transaction.assert_called_once()
    assert con.fetch.called
    fetch_query = con.fetch.call_args[0][0]
    assert "FOR UPDATE SKIP LOCKED" in fetch_query
    assert "status IN ('pending', 'retry_queued')" in fetch_query

    # Verify status update happened in same connection
    assert con.execute.called
    update_query, u_id, u_worker = con.execute.call_args[0]
    assert "UPDATE ingestion_jobs" in update_query
    assert "status = 'processing'" in update_query
    assert u_id == job_id
    assert u_worker == "worker-test-1"


@pytest.mark.asyncio
async def test_claim_due_ingestion_jobs_enforces_global_concurrency_bound():
    pool = MagicMock()
    con = AsyncMock()
    txn = MagicMock()
    txn.__aenter__ = AsyncMock()
    txn.__aexit__ = AsyncMock()
    con.transaction = MagicMock(return_value=txn)
    pool.acquire.return_value.__aenter__.return_value = con

    # Active count is 2, max_concurrent is 3 -> available slots = 1
    con.fetchval.return_value = 2
    job_id = uuid4()
    con.fetch.return_value = [{"id": job_id, "document_id": uuid4()}]

    claimed = await claim_due_ingestion_jobs(
        pool,
        limit=5,
        worker_id="worker-test-1",
        max_concurrent=3,
    )

    assert len(claimed) == 1
    # Check advisory lock was acquired to serialize claim
    execute_calls = [c[0][0] for c in con.execute.call_args_list]
    assert any("pg_advisory_xact_lock" in q for q in execute_calls)
    # Check limit passed to query was capped to available (1), not original limit (5)
    fetch_call_args = con.fetch.call_args[0]
    assert fetch_call_args[1] == 1  # effective_limit is 1


@pytest.mark.asyncio
async def test_claim_due_ingestion_jobs_returns_empty_when_concurrency_saturated():
    pool = MagicMock()
    con = AsyncMock()
    txn = MagicMock()
    txn.__aenter__ = AsyncMock()
    txn.__aexit__ = AsyncMock()
    con.transaction = MagicMock(return_value=txn)
    pool.acquire.return_value.__aenter__.return_value = con

    # Active count is 3, max_concurrent is 3 -> available slots = 0
    con.fetchval.return_value = 3

    claimed = await claim_due_ingestion_jobs(
        pool,
        limit=5,
        worker_id="worker-test-1",
        max_concurrent=3,
    )

    assert claimed == []
    # con.fetch for due jobs should not even be called
    con.fetch.assert_not_called()


@pytest.mark.asyncio
async def test_reclaim_stale_ingestion_claims_mock():
    pool = MagicMock()
    con = AsyncMock()
    pool.acquire.return_value.__aenter__.return_value = con

    # Recoverable jobs
    con.fetch.side_effect = [
        [{"id": uuid4()}, {"id": uuid4()}],  # 2 reclaimed to pending
        [{"id": uuid4()}],                   # 1 terminal failed
    ]

    total = await reclaim_stale_ingestion_claims(pool, lease_timeout_seconds=120)
    assert total == 3

    assert con.fetch.call_count == 2
    q1 = con.fetch.call_args_list[0][0][0]
    assert "status = 'pending'" in q1
    assert "retry_count + 1 < max_retries" in q1

    q2 = con.fetch.call_args_list[1][0][0]
    assert "status = 'failed'" in q2
    assert "retry_count + 1 >= max_retries" in q2
    assert "lease_timeout_exceeded" in q2


@pytest.mark.asyncio
async def test_update_job_progress_mock():
    pool = MagicMock()
    con = AsyncMock()
    pool.acquire.return_value.__aenter__.return_value = con

    job_id = uuid4()
    await update_job_progress(
        pool,
        job_id,
        stage="chunks_embedded",
        progress_patch={"chunk_offset": 50, "total_chunks": 100},
    )

    import json
    assert con.execute.called
    q, j_id, stage, patch = con.execute.call_args[0]
    assert "stage = $2" in q
    assert "progress = progress || $3" in q
    assert j_id == job_id
    assert stage == "chunks_embedded"
    if isinstance(patch, str):
        assert json.loads(patch) == {"chunk_offset": 50, "total_chunks": 100}
    else:
        assert patch == {"chunk_offset": 50, "total_chunks": 100}


@pytest.mark.asyncio
async def test_record_job_failure_transient_vs_terminal():
    pool = MagicMock()
    con = AsyncMock()
    pool.acquire.return_value.__aenter__.return_value = con

    job_id = uuid4()

    # Case 1: Transient and retry_count < max_retries -> retry_queued
    con.fetchrow.return_value = {"retry_count": 1, "max_retries": 3}
    status = await record_job_failure(
        pool,
        job_id,
        error_message="503 Service Unavailable",
        error_details={"code": 503},
        is_transient=True,
        retry_delay_seconds=10.0,
    )
    assert status == "retry_queued"
    q = con.execute.call_args[0][0]
    assert "status = 'retry_queued'" in q

    # Case 2: Transient but retries exhausted -> failed
    con.fetchrow.return_value = {"retry_count": 2, "max_retries": 3}
    status = await record_job_failure(
        pool,
        job_id,
        error_message="503 Service Unavailable",
        is_transient=True,
    )
    assert status == "failed"
    q = con.execute.call_args[0][0]
    assert "status = 'failed'" in q

    # Case 3: Non-transient error -> failed immediately
    con.fetchrow.return_value = {"retry_count": 0, "max_retries": 3}
    status = await record_job_failure(
        pool,
        job_id,
        error_message="400 Bad Request",
        is_transient=False,
    )
    assert status == "failed"


@pytest.mark.asyncio
async def test_pause_and_resume_jobs():
    pool = MagicMock()
    con = AsyncMock()
    pool.acquire.return_value.__aenter__.return_value = con

    con.fetch.return_value = [{"id": uuid4()}, {"id": uuid4()}]

    paused_count = await pause_jobs_for_provider(
        pool,
        refusal_reason="openai: 429 Insufficient Quota",
        error_details={"provider": "openai", "code": 429},
    )
    assert paused_count == 2
    q_pause = con.fetch.call_args[0][0]
    assert "status = 'paused'" in q_pause

    con.fetch.return_value = [{"id": uuid4()}, {"id": uuid4()}]
    resumed_count = await resume_paused_jobs(pool)
    assert resumed_count == 2
    q_resume = con.fetch.call_args[0][0]
    assert "status = 'retry_queued'" in q_resume


# ══════════════════════════════════════════════════════════════════════════════
# §B — Live DB Tests (Local Postgres :54322)
# ══════════════════════════════════════════════════════════════════════════════


@pytest.fixture
async def live_pg_pool():
    """Acquire real asyncpg pool against local Supabase DB (:54322). Skips if down."""
    asyncpg = pytest.importorskip("asyncpg")
    import json as _json

    async def _init(conn):
        await conn.set_type_codec(
            "jsonb", encoder=_json.dumps, decoder=_json.loads, schema="pg_catalog"
        )

    try:
        pool = await asyncio.wait_for(
            asyncpg.create_pool(
                _DSN,
                min_size=1,
                max_size=3,
                init=_init,
            ),
            timeout=3.0,
        )
    except Exception as exc:
        pytest.skip(f"Postgres unavailable on {_DSN}: {exc}")

    try:
        yield pool
    finally:
        await pool.close()


@pytest.mark.asyncio
async def test_live_claim_exclusivity_and_stale_recovery(live_pg_pool):
    """Verify live FOR UPDATE SKIP LOCKED claim and G-1 stale claim sweeper against real DB."""
    pool = live_pg_pool

    # Fetch an existing document and user ID from the baseline 77 docs
    async with pool.acquire() as con:
        doc_row = await con.fetchrow("SELECT id, user_id, org_id FROM documents LIMIT 1")
        if not doc_row:
            pytest.skip("No documents in local DB")
        doc_id = doc_row["id"]
        user_id = doc_row["user_id"]
        org_id = doc_row["org_id"]

    # 1. Insert 2 test jobs
    j1 = await insert_ingestion_job(pool, document_id=doc_id, user_id=user_id, org_id=org_id)
    j2 = await insert_ingestion_job(pool, document_id=doc_id, user_id=user_id, org_id=org_id)
    assert j1["id"] and j2["id"]

    try:
        # 2. Worker A claims 1 job
        claimed_a = await claim_due_ingestion_jobs(pool, limit=1, worker_id="worker-A")
        assert len(claimed_a) == 1
        job_a = claimed_a[0]

        # Worker B claims 1 job concurrently (must not claim Worker A's job)
        claimed_b = await claim_due_ingestion_jobs(pool, limit=1, worker_id="worker-B")
        assert len(claimed_b) == 1
        job_b = claimed_b[0]

        assert job_a["id"] != job_b["id"]

        # 3. Simulate Worker A dying/crashing: job_a is left at 'processing' with old claimed_at
        async with pool.acquire() as con:
            await con.execute(
                """
                UPDATE ingestion_jobs
                SET claimed_at = now() - interval '400 seconds'
                WHERE id = $1
                """,
                job_a["id"],
            )

        # 4. Run stale sweeper (lease_timeout = 300s)
        swept = await reclaim_stale_ingestion_claims(pool, lease_timeout_seconds=300)
        assert swept >= 1

        # Check job_a was rescued back to 'pending' with retry_count incremented
        rescued = await get_ingestion_job_by_id(pool, job_a["id"])
        assert rescued["status"] == "pending"
        assert rescued["retry_count"] == 1
        assert rescued["claimed_at"] is None
        assert rescued["claimed_by"] is None

        # 5. Complete job_b cleanly
        await record_job_success(pool, job_b["id"])
        completed = await get_ingestion_job_by_id(pool, job_b["id"])
        assert completed["status"] == "completed"

    finally:
        # Cleanup test rows
        async with pool.acquire() as con:
            await con.execute(
                "DELETE FROM ingestion_jobs WHERE id IN ($1, $2)",
                j1["id"],
                j2["id"],
            )
