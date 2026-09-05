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
    worker_id: str,
    limit: int = 3,
    now: datetime | None = None,
    max_concurrent: int | None = None,
) -> list[dict]:
    """Atomically claim due ingestion jobs using FOR UPDATE SKIP LOCKED.

    Inside an explicit transaction, claims up to `limit` rows where status IN ('pending', 'retry_queued')
    and next_run_at <= now, updates their status to 'processing', stamps claimed_at=now() and
    claimed_by=worker_id, and commits.

    If `max_concurrent` is provided, enforces a global cross-process concurrency bound (SC#2 / QUEUE-05).
    Using pg_advisory_xact_lock(4230230) to serialize claim decisions across all worker processes,
    it counts active jobs with status='processing' and only claims up to the remaining global slots.
    """
    claimed: list[dict] = []
    async with pool.acquire() as con:
        async with con.transaction():
            claim_limit = limit
            if max_concurrent is not None:
                await con.execute("SELECT pg_advisory_xact_lock(4230230)")
                active_count = await con.fetchval(
                    "SELECT count(*) FROM ingestion_jobs WHERE status = 'processing'"
                )
                available = max_concurrent - (active_count or 0)
                if available <= 0:
                    return []
                claim_limit = min(limit, available)

            due = await con.fetch(
                f"""
                SELECT {_CLAIM_COLUMNS} FROM ingestion_jobs
                WHERE status IN ('pending', 'retry_queued')
                  AND next_run_at <= COALESCE($2::timestamptz, now())
                ORDER BY next_run_at ASC
                LIMIT $1
                FOR UPDATE SKIP LOCKED
                """,
                claim_limit,
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
    - Else: transition to terminal status='failed' with last_error='lease_timeout_exceeded' and mark
      the document status='failed' in the same transaction (Defect B).
    """
    async with pool.acquire() as con:
        async with con.transaction():
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
            # 2. Exhausted jobs -> failed (and fail documents atomically)
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
                RETURNING id, document_id
                """,
                float(lease_timeout_seconds),
            )
            if exhausted_rows:
                doc_ids = [r["document_id"] for r in exhausted_rows if r.get("document_id")]
                if doc_ids:
                    await con.execute(
                        """
                        UPDATE documents
                        SET status = 'failed',
                            error_message = 'lease_timeout_exceeded',
                            updated_at = now()
                        WHERE id = ANY($1::uuid[])
                        """,
                        doc_ids,
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
    import json  # noqa: PLC0415
    patch_json = json.dumps(progress_patch) if progress_patch is not None else None

    # Self-healing jsonb merge expression: handles object merge, heals any corrupted array, and handles NULL
    _MERGE_SQL = (
        "(CASE WHEN jsonb_typeof(COALESCE(progress, '{}'::jsonb)) = 'object' "
        "THEN COALESCE(progress, '{}'::jsonb) ELSE '{}'::jsonb END) || ($%d::text)::jsonb"
    )

    async with pool.acquire() as con:
        if stage is not None and patch_json is not None:
            await con.execute(
                f"""
                UPDATE ingestion_jobs
                SET stage = $2,
                    progress = {_MERGE_SQL % 3},
                    updated_at = now()
                WHERE id = $1
                """,
                job_id,
                stage,
                patch_json,
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
        elif patch_json is not None:
            await con.execute(
                f"""
                UPDATE ingestion_jobs
                SET progress = {_MERGE_SQL % 2},
                    updated_at = now()
                WHERE id = $1
                """,
                job_id,
                patch_json,
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
    Otherwise, marks permanently failed (status='failed') and marks the associated document
    failed with error_message in the same transaction (Defect B).
    """
    import json  # noqa: PLC0415
    details_json = json.dumps(error_details) if error_details is not None else None

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
                    error_details = ($4::text)::jsonb,
                    claimed_at = NULL,
                    claimed_by = NULL,
                    updated_at = now()
                WHERE id = $1
                """,
                job_id,
                float(retry_delay_seconds),
                error_message,
                details_json,
            )
            return "retry_queued"
        else:
            async with con.transaction():
                doc_id = await con.fetchval(
                    """
                    UPDATE ingestion_jobs
                    SET status = 'failed',
                        stage = 'failed',
                        retry_count = retry_count + 1,
                        last_error = $2,
                        error_details = ($3::text)::jsonb,
                        claimed_at = NULL,
                        claimed_by = NULL,
                        updated_at = now()
                    WHERE id = $1
                    RETURNING document_id
                    """,
                    job_id,
                    error_message,
                    details_json,
                )
                if doc_id:
                    await con.execute(
                        """
                        UPDATE documents
                        SET status = 'failed',
                            error_message = $2,
                            updated_at = now()
                        WHERE id = $1
                        """,
                        doc_id,
                        error_message,
                    )
            return "failed"


async def pause_jobs_for_provider(
    pool: asyncpg.Pool,
    *,
    refusal_reason: str,
    error_details: dict[str, Any] | None = None,
) -> int:
    """Pause pending and processing jobs when an embedding provider outage/rate-limit occurs."""
    import json  # noqa: PLC0415
    details_json = json.dumps(error_details) if error_details is not None else None

    async with pool.acquire() as con:
        paused = await con.fetch(
            """
            UPDATE ingestion_jobs
            SET status = 'paused',
                last_error = $1,
                error_details = ($2::text)::jsonb,
                claimed_at = NULL,
                claimed_by = NULL,
                updated_at = now()
            WHERE status IN ('pending', 'retry_queued', 'processing')
            RETURNING id
            """,
            refusal_reason,
            details_json,
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


def _normalize_job_record(row: asyncpg.Record | None) -> dict | None:
    if not row:
        return None
    rec = dict(row)
    # Ensure progress is always a dict, even if decoded as a string or empty
    if isinstance(rec.get("progress"), str):
        import json  # noqa: PLC0415
        try:
            parsed = json.loads(rec["progress"])
            rec["progress"] = parsed if isinstance(parsed, dict) else {}
        except Exception:
            rec["progress"] = {}
    elif not isinstance(rec.get("progress"), dict):
        rec["progress"] = {}

    if isinstance(rec.get("error_details"), str):
        import json  # noqa: PLC0415
        try:
            rec["error_details"] = json.loads(rec["error_details"])
        except Exception:
            pass
    return rec


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
        return _normalize_job_record(row)


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
        return _normalize_job_record(row)
