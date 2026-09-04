"""Phase 230 (QUEUE-01 / QUEUE-05 / SC#1 / D-01..D-04) — Data-access home for ingestion_jobs.

The ONE home for reads and writes of public.ingestion_jobs.

Key invariants:
1. claim_due_ingestion_jobs uses SELECT ... FOR UPDATE SKIP LOCKED inside an explicit
   transaction (con.transaction()) and advances status to 'processing' with claimed_at = now()
   before commit. This ensures worker exclusivity with zero double-claims across processes.
2. reclaim_stale_ingestion_claims (G-1 / SC#1 sweeper) sweeps rows stranded in 'processing'
   whose claimed_at is older than lease_timeout_seconds back to 'pending' (incrementing retry_count),
   or marks them 'failed' if max_retries is reached. This guarantees restart survival for in-flight jobs.
3. progress and error_details are bound as Python dicts, relying on asyncpg's registered jsonb codec.
"""
from __future__ import annotations

from datetime import datetime
import logging
from typing import Any
from uuid import UUID

import asyncpg

logger = logging.getLogger(__name__)

_CLAIM_COLUMNS = (
    "id, document_id, user_id, org_id, status, stage, progress, retry_count, max_retries, "
    "last_error, error_details, next_run_at, claimed_at, claimed_by, created_at, updated_at"
)


async def insert_ingestion_job(
    pool: asyncpg.Pool,
    *,
    document_id: UUID,
    user_id: UUID,
    org_id: UUID | None = None,
    max_retries: int = 3,
) -> dict:
    """Enqueue a new document ingestion job (status='pending', next_run_at=now())."""
    async with pool.acquire() as con:
        row = await con.fetchrow(
            f"""
            INSERT INTO ingestion_jobs (
                document_id, user_id, org_id, status, stage, progress, max_retries, next_run_at
            ) VALUES (
                $1, $2, $3, 'pending', 'pending', '{{}}'::jsonb, $4, now()
            )
            RETURNING {_CLAIM_COLUMNS}
            """,
            document_id,
            user_id,
            org_id,
            max_retries,
        )
        return dict(row) if row else {}


async def claim_due_ingestion_jobs(
    pool: asyncpg.Pool,
    *,
    limit: int = 3,
    worker_id: str,
    now: datetime | None = None,
) -> list[dict]:
    """Atomically claim due ingestion jobs using FOR UPDATE SKIP LOCKED.

    Inside an explicit transaction, claims up to `limit` rows where status IN ('pending', 'retry_queued')
    and next_run_at <= now, updates their status to 'processing', stamps claimed_at=now() and
    claimed_by=worker_id, and commits.
    """
    claimed: list[dict] = []
    async with pool.acquire() as con:
        async with con.transaction():
            due = await con.fetch(
                f"""
                SELECT {_CLAIM_COLUMNS} FROM ingestion_jobs
                WHERE status IN ('pending', 'retry_queued')
                  AND next_run_at <= COALESCE($2::timestamptz, now())
                ORDER BY next_run_at ASC
                LIMIT $1
                FOR UPDATE SKIP LOCKED
                """,
                limit,
                now,
            )
            for row in due:
                record = dict(row)
                await con.execute(
                    """
                    UPDATE ingestion_jobs
                    SET status = 'processing',
                        claimed_at = now(),
                        claimed_by = $2,
                        updated_at = now()
                    WHERE id = $1
                    """,
                    record["id"],
                    worker_id,
                )
                record["status"] = "processing"
                record["claimed_by"] = worker_id
                claimed.append(record)
    return claimed


async def reclaim_stale_ingestion_claims(
    pool: asyncpg.Pool,
    *,
    lease_timeout_seconds: int = 300,
) -> int:
    """Rescue in-flight jobs stranded in status='processing' by a dead/restarted worker (G-1 / SC#1).

    Jobs whose claimed_at is older than lease_timeout_seconds are reclaimed:
    - If retry_count + 1 < max_retries: reset to status='pending', increment retry_count, clear claim.
    - Else: transition to terminal status='failed' with last_error='lease_timeout_exceeded'.
    """
    async with pool.acquire() as con:
        # 1. Recoverable jobs -> pending
        reclaimed_rows = await con.fetch(
            """
            UPDATE ingestion_jobs
            SET status = 'pending',
                retry_count = retry_count + 1,
                claimed_at = NULL,
                claimed_by = NULL,
                updated_at = now()
            WHERE status = 'processing'
              AND claimed_at < now() - make_interval(secs => $1::double precision)
              AND retry_count + 1 < max_retries
            RETURNING id
            """,
            float(lease_timeout_seconds),
        )
        # 2. Exhausted jobs -> failed
        exhausted_rows = await con.fetch(
            """
            UPDATE ingestion_jobs
            SET status = 'failed',
                stage = 'failed',
                retry_count = retry_count + 1,
                last_error = 'lease_timeout_exceeded',
                claimed_at = NULL,
                claimed_by = NULL,
                updated_at = now()
            WHERE status = 'processing'
              AND claimed_at < now() - make_interval(secs => $1::double precision)
              AND retry_count + 1 >= max_retries
            RETURNING id
            """,
            float(lease_timeout_seconds),
        )
        total = len(reclaimed_rows) + len(exhausted_rows)
        if total > 0:
            logger.warning(
                "Reclaimed %d stale ingestion job claim(s) (%d reset to pending, %d marked failed)",
                total,
                len(reclaimed_rows),
                len(exhausted_rows),
            )
        return total


async def update_job_progress(
    pool: asyncpg.Pool,
    job_id: UUID,
    *,
    stage: str | None = None,
    progress_patch: dict[str, Any] | None = None,
) -> None:
    """Merge stage and batch offset progress into ingestion_jobs.progress."""
    async with pool.acquire() as con:
        if stage is not None and progress_patch is not None:
            await con.execute(
                """
                UPDATE ingestion_jobs
                SET stage = $2,
                    progress = progress || $3,
                    updated_at = now()
                WHERE id = $1
                """,
                job_id,
                stage,
                progress_patch,
            )
        elif stage is not None:
            await con.execute(
                """
                UPDATE ingestion_jobs
                SET stage = $2,
                    updated_at = now()
                WHERE id = $1
                """,
                job_id,
                stage,
            )
        elif progress_patch is not None:
            await con.execute(
                """
                UPDATE ingestion_jobs
                SET progress = progress || $2,
                    updated_at = now()
                WHERE id = $1
                """,
                job_id,
                progress_patch,
            )


async def record_job_success(
    pool: asyncpg.Pool,
    job_id: UUID,
) -> None:
    """Mark an ingestion job completed."""
    async with pool.acquire() as con:
        await con.execute(
            """
            UPDATE ingestion_jobs
            SET status = 'completed',
                stage = 'completed',
                claimed_at = NULL,
                claimed_by = NULL,
                updated_at = now()
            WHERE id = $1
            """,
            job_id,
        )


async def record_job_failure(
    pool: asyncpg.Pool,
    job_id: UUID,
    *,
    error_message: str,
    error_details: dict[str, Any] | None = None,
    is_transient: bool = True,
    retry_delay_seconds: float = 5.0,
) -> str:
    """Record an ingestion job failure.

    If transient and retry_count + 1 < max_retries, schedules a retry (status='retry_queued').
    Otherwise, marks permanently failed (status='failed').
    """
    async with pool.acquire() as con:
        row = await con.fetchrow(
            "SELECT retry_count, max_retries FROM ingestion_jobs WHERE id = $1",
            job_id,
        )
        if not row:
            return "not_found"

        retry_count = row["retry_count"]
        max_retries = row["max_retries"]

        if is_transient and (retry_count + 1 < max_retries):
            await con.execute(
                """
                UPDATE ingestion_jobs
                SET status = 'retry_queued',
                    retry_count = retry_count + 1,
                    next_run_at = now() + make_interval(secs => $2::double precision),
                    last_error = $3,
                    error_details = $4,
                    claimed_at = NULL,
                    claimed_by = NULL,
                    updated_at = now()
                WHERE id = $1
                """,
                job_id,
                float(retry_delay_seconds),
                error_message,
                error_details,
            )
            return "retry_queued"
        else:
            await con.execute(
                """
                UPDATE ingestion_jobs
                SET status = 'failed',
                    stage = 'failed',
                    retry_count = retry_count + 1,
                    last_error = $2,
                    error_details = $3,
                    claimed_at = NULL,
                    claimed_by = NULL,
                    updated_at = now()
                WHERE id = $1
                """,
                job_id,
                error_message,
                error_details,
            )
            return "failed"


async def pause_jobs_for_provider(
    pool: asyncpg.Pool,
    *,
    refusal_reason: str,
    error_details: dict[str, Any] | None = None,
) -> int:
    """Pause pending and processing jobs when an embedding provider outage/rate-limit occurs."""
    async with pool.acquire() as con:
        paused = await con.fetch(
            """
            UPDATE ingestion_jobs
            SET status = 'paused',
                last_error = $1,
                error_details = $2,
                claimed_at = NULL,
                claimed_by = NULL,
                updated_at = now()
            WHERE status IN ('pending', 'retry_queued', 'processing')
            RETURNING id
            """,
            refusal_reason,
            error_details,
        )
        return len(paused)


async def resume_paused_jobs(
    pool: asyncpg.Pool,
) -> int:
    """Resume all paused jobs into retry_queued for immediate pickup."""
    async with pool.acquire() as con:
        resumed = await con.fetch(
            """
            UPDATE ingestion_jobs
            SET status = 'retry_queued',
                next_run_at = now(),
                updated_at = now()
            WHERE status = 'paused'
            RETURNING id
            """,
        )
        return len(resumed)


async def get_ingestion_job_by_id(
    pool: asyncpg.Pool,
    job_id: UUID,
) -> dict | None:
    """Retrieve an ingestion job by ID."""
    async with pool.acquire() as con:
        row = await con.fetchrow(
            f"SELECT {_CLAIM_COLUMNS} FROM ingestion_jobs WHERE id = $1",
            job_id,
        )
        return dict(row) if row else None


async def get_ingestion_job_by_document_id(
    pool: asyncpg.Pool,
    document_id: UUID,
) -> dict | None:
    """Retrieve the latest ingestion job for a document."""
    async with pool.acquire() as con:
        row = await con.fetchrow(
            f"SELECT {_CLAIM_COLUMNS} FROM ingestion_jobs WHERE document_id = $1 ORDER BY created_at DESC LIMIT 1",
            document_id,
        )
        return dict(row) if row else None
