"""Phase 234 (LIB-08 / QUEUE-03 / D-234-01..10) — Data-access home for connector_watches.

The ONE data-access module for reads and writes of `public.connector_watches` and
`public.connector_watch_items`.

Key invariants:
1. `claim_due_watches` uses `SELECT ... FOR UPDATE SKIP LOCKED` inside an explicit transaction
   (`con.transaction()`), setting `leased_until` and advancing `next_run_at` before commit.
   This guarantees atomic claim exclusivity with zero concurrent collision across uvicorn workers (QUEUE-03).
2. Service-role queries carry explicit tenant/owner predicates (`org_id`, `user_id`) on all user-facing
   endpoints. `claim_due_watches` is the sole background poller read without caller identity.
3. Every external item is tracked in `connector_watch_items` to compute honest diffs against source listings.
"""
from __future__ import annotations

import logging
from typing import Any
from uuid import UUID

import asyncpg

logger = logging.getLogger(__name__)

_WATCH_COLUMNS = (
    "id, org_id, user_id, connection_id, source_folder_id, source_folder_name, "
    "source_drive_id, library_folder_id, interval_minutes, next_run_at, leased_until, "
    "is_active, last_run_at, last_status, last_error, created_at, updated_at"
)

_WATCH_CLAIM_COLUMNS = (
    "id, org_id, user_id, connection_id, source_folder_id, source_folder_name, "
    "source_drive_id, library_folder_id, interval_minutes, next_run_at, leased_until"
)

_WATCH_ITEM_COLUMNS = (
    "id, org_id, watch_id, user_id, external_id, name, path_hint, source_version, "
    "source_modified_at, content_hash, document_id, state, first_seen_at, last_seen_at, "
    "missing_since, last_error, created_at, updated_at"
)


def _as_uuid(value: Any) -> UUID:
    return value if isinstance(value, UUID) else UUID(str(value))


# ── Watch CRUD ────────────────────────────────────────────────────────────────


async def create_watch(
    pool: asyncpg.Pool,
    *,
    user_id: UUID,
    connection_id: UUID,
    source_folder_id: str,
    source_folder_name: str,
    org_id: UUID | None = None,
    source_drive_id: str | None = None,
    library_folder_id: UUID | None = None,
    interval_minutes: int = 30,
) -> dict:
    """Insert one scheduled watch with next_run_at = now()."""
    async with pool.acquire() as con:
        row = await con.fetchrow(
            f"""
            INSERT INTO connector_watches (
                user_id, org_id, connection_id, source_folder_id, source_folder_name,
                source_drive_id, library_folder_id, interval_minutes, next_run_at, is_active
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, now(), true
            )
            RETURNING {_WATCH_COLUMNS}
            """,
            _as_uuid(user_id),
            _as_uuid(org_id) if org_id else None,
            _as_uuid(connection_id),
            source_folder_id,
            source_folder_name,
            source_drive_id,
            _as_uuid(library_folder_id) if library_folder_id else None,
            max(5, interval_minutes),
        )
        return dict(row) if row else {}


async def get_watch(
    pool: asyncpg.Pool,
    watch_id: UUID,
    *,
    user_id: UUID | None = None,
    org_id: UUID | None = None,
) -> dict | None:
    """Read a watch by ID, optionally scoped to owner or org."""
    conditions = ["id = $1"]
    args: list[Any] = [_as_uuid(watch_id)]

    if user_id is not None:
        args.append(_as_uuid(user_id))
        conditions.append(f"user_id = ${len(args)}")
    if org_id is not None:
        args.append(_as_uuid(org_id))
        conditions.append(f"org_id = ${len(args)}")

    query = f"SELECT {_WATCH_COLUMNS} FROM connector_watches WHERE {' AND '.join(conditions)}"
    async with pool.acquire() as con:
        row = await con.fetchrow(query, *args)
        return dict(row) if row else None


async def list_watches(
    pool: asyncpg.Pool,
    *,
    user_id: UUID | None = None,
    org_id: UUID | None = None,
    connection_id: UUID | None = None,
) -> list[dict]:
    """List watches matching criteria."""
    conditions = []
    args: list[Any] = []

    if user_id is not None:
        args.append(_as_uuid(user_id))
        conditions.append(f"user_id = ${len(args)}")
    if org_id is not None:
        args.append(_as_uuid(org_id))
        conditions.append(f"org_id = ${len(args)}")
    if connection_id is not None:
        args.append(_as_uuid(connection_id))
        conditions.append(f"connection_id = ${len(args)}")

    where = f"WHERE {' AND '.join(conditions)}" if conditions else ""
    query = f"SELECT {_WATCH_COLUMNS} FROM connector_watches {where} ORDER BY created_at DESC"
    async with pool.acquire() as con:
        rows = await con.fetch(query, *args)
        return [dict(r) for r in rows]


async def update_watch(
    pool: asyncpg.Pool,
    watch_id: UUID,
    *,
    user_id: UUID,
    interval_minutes: int | None = None,
    is_active: bool | None = None,
    library_folder_id: UUID | None = None,
    clear_library_folder: bool = False,
) -> dict | None:
    """Update watch parameters owner-scoped."""
    sets = ["updated_at = now()"]
    args: list[Any] = [_as_uuid(watch_id), _as_uuid(user_id)]

    if interval_minutes is not None:
        args.append(max(5, interval_minutes))
        sets.append(f"interval_minutes = ${len(args)}")
    if is_active is not None:
        args.append(is_active)
        sets.append(f"is_active = ${len(args)}")
    if clear_library_folder:
        sets.append("library_folder_id = NULL")
    elif library_folder_id is not None:
        args.append(_as_uuid(library_folder_id))
        sets.append(f"library_folder_id = ${len(args)}")

    query = f"""
        UPDATE connector_watches
        SET {', '.join(sets)}
        WHERE id = $1 AND user_id = $2
        RETURNING {_WATCH_COLUMNS}
    """
    async with pool.acquire() as con:
        row = await con.fetchrow(query, *args)
        return dict(row) if row else None


async def delete_watch(
    pool: asyncpg.Pool,
    watch_id: UUID,
    *,
    user_id: UUID,
) -> bool:
    """Delete one watch owner-scoped."""
    async with pool.acquire() as con:
        tag = await con.execute(
            "DELETE FROM connector_watches WHERE id = $1 AND user_id = $2",
            _as_uuid(watch_id),
            _as_uuid(user_id),
        )
        return tag.rsplit(" ", 1)[-1] != "0"


# ── Poller Claim & Outcome (QUEUE-03) ─────────────────────────────────────────


async def claim_due_watches(
    pool: asyncpg.Pool,
    *,
    limit: int = 10,
    lease_seconds: int = 600,
    now: Any = None,
) -> list[dict]:
    """Atomically claim due watches using FOR UPDATE SKIP LOCKED.

    Inside the transaction:
    1. Locks candidate due watches whose leased_until is expired or null.
    2. Sets leased_until to now() + lease_seconds to prevent concurrent worker execution.
    3. Advances next_run_at to now() + interval_minutes to prevent duplicate firing.
    4. Sets last_run_at = now(), last_status = 'running'.
    Returns claimed watch records.
    """
    claimed: list[dict] = []
    async with pool.acquire() as con:
        async with con.transaction():
            due = await con.fetch(
                f"""
                SELECT {_WATCH_CLAIM_COLUMNS}
                FROM connector_watches
                WHERE is_active = true
                  AND next_run_at <= COALESCE($2::timestamptz, now())
                  AND (leased_until IS NULL OR leased_until < COALESCE($2::timestamptz, now()))
                ORDER BY next_run_at
                LIMIT $1
                FOR UPDATE SKIP LOCKED
                """,
                limit,
                now,
            )
            for row in due:
                record = dict(row)
                wid = record["id"]
                interval_min = record.get("interval_minutes") or 30

                # Advance next_run_at and set lease inside the claim transaction
                await con.execute(
                    """
                    UPDATE connector_watches
                    SET leased_until = now() + ($2 || ' seconds')::interval,
                        next_run_at = now() + ($3 || ' minutes')::interval,
                        last_run_at = now(),
                        last_status = 'running'
                    WHERE id = $1
                    """,
                    wid,
                    str(lease_seconds),
                    str(interval_min),
                )
                claimed.append(record)
    return claimed


async def release_watch(
    pool: asyncpg.Pool,
    watch_id: UUID,
    *,
    status: str,
    error: str | None = None,
) -> None:
    """Clear lease and write terminal outcome hint."""
    try:
        async with pool.acquire() as con:
            await con.execute(
                """
                UPDATE connector_watches
                SET leased_until = NULL,
                    last_status = $2,
                    last_error = $3,
                    updated_at = now()
                WHERE id = $1
                """,
                _as_uuid(watch_id),
                status,
                error,
            )
    except Exception:  # noqa: BLE001
        logger.exception("release_watch failed for %s", watch_id)


async def record_skipped_still_running(
    pool: asyncpg.Pool,
    watch_id: UUID,
) -> None:
    """Record that a scheduled tick skipped this watch because a prior lease is active."""
    try:
        async with pool.acquire() as con:
            await con.execute(
                """
                UPDATE connector_watches
                SET last_status = 'skipped_still_running',
                    updated_at = now()
                WHERE id = $1
                """,
                _as_uuid(watch_id),
            )
    except Exception:  # noqa: BLE001
        logger.exception("record_skipped_still_running failed for %s", watch_id)


# ── Watch Items Mirror Table ──────────────────────────────────────────────────


async def get_watch_items(
    pool: asyncpg.Pool,
    watch_id: UUID,
) -> list[dict]:
    """List all tracked items for a given watch."""
    async with pool.acquire() as con:
        rows = await con.fetch(
            f"""
            SELECT {_WATCH_ITEM_COLUMNS}
            FROM connector_watch_items
            WHERE watch_id = $1
            ORDER BY name ASC
            """,
            _as_uuid(watch_id),
        )
        return [dict(r) for r in rows]


async def get_watch_item_by_external_id(
    pool: asyncpg.Pool,
    watch_id: UUID,
    external_id: str,
) -> dict | None:
    """Get single tracked item by (watch_id, external_id)."""
    async with pool.acquire() as con:
        row = await con.fetchrow(
            f"""
            SELECT {_WATCH_ITEM_COLUMNS}
            FROM connector_watch_items
            WHERE watch_id = $1 AND external_id = $2
            """,
            _as_uuid(watch_id),
            external_id,
        )
        return dict(row) if row else None


async def upsert_watch_item(
    pool: asyncpg.Pool,
    *,
    watch_id: UUID,
    external_id: str,
    name: str,
    user_id: UUID,
    org_id: UUID | None = None,
    path_hint: str = "",
    source_version: str | None = None,
    source_modified_at: Any = None,
    content_hash: str | None = None,
    document_id: UUID | None = None,
    state: str = "present",
    last_error: str | None = None,
) -> dict:
    """Upsert tracked item on unique (watch_id, external_id)."""
    async with pool.acquire() as con:
        row = await con.fetchrow(
            f"""
            INSERT INTO connector_watch_items (
                watch_id, external_id, name, user_id, org_id, path_hint,
                source_version, source_modified_at, content_hash, document_id,
                state, last_seen_at, last_error
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, now(), $12
            )
            ON CONFLICT (watch_id, external_id) DO UPDATE
            SET name = EXCLUDED.name,
                path_hint = EXCLUDED.path_hint,
                source_version = COALESCE(EXCLUDED.source_version, connector_watch_items.source_version),
                source_modified_at = COALESCE(EXCLUDED.source_modified_at, connector_watch_items.source_modified_at),
                content_hash = COALESCE(EXCLUDED.content_hash, connector_watch_items.content_hash),
                document_id = COALESCE(EXCLUDED.document_id, connector_watch_items.document_id),
                state = EXCLUDED.state,
                last_seen_at = now(),
                last_error = EXCLUDED.last_error,
                updated_at = now()
            RETURNING {_WATCH_ITEM_COLUMNS}
            """,
            _as_uuid(watch_id),
            external_id,
            name,
            _as_uuid(user_id),
            _as_uuid(org_id) if org_id else None,
            path_hint,
            source_version,
            source_modified_at,
            content_hash,
            _as_uuid(document_id) if document_id else None,
            state,
            last_error,
        )
        return dict(row) if row else {}


async def update_item_state(
    pool: asyncpg.Pool,
    item_id: UUID,
    *,
    state: str,
    missing_since: Any = None,
    error: str | None = None,
) -> None:
    """Update lifecycle state of one tracked item."""
    async with pool.acquire() as con:
        await con.execute(
            """
            UPDATE connector_watch_items
            SET state = $2,
                missing_since = COALESCE($3, missing_since),
                last_error = $4,
                updated_at = now()
            WHERE id = $1
            """,
            _as_uuid(item_id),
            state,
            missing_since,
            error,
        )


async def bulk_update_item_states(
    pool: asyncpg.Pool,
    item_ids: list[UUID],
    *,
    state: str,
    missing_since: Any = None,
) -> None:
    """Bulk update lifecycle state for absent or unauthorized items."""
    if not item_ids:
        return
    async with pool.acquire() as con:
        await con.execute(
            """
            UPDATE connector_watch_items
            SET state = $2,
                missing_since = CASE WHEN $2 = 'missing' AND missing_since IS NULL THEN now() ELSE missing_since END,
                updated_at = now()
            WHERE id = ANY($1::uuid[])
            """,
            [_as_uuid(i) for i in item_ids],
            state,
        )
