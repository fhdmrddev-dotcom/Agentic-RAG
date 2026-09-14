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
from datetime import datetime
from typing import Any
from uuid import UUID

import asyncpg

from app.config import settings

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

# Phase 235 (SURF-02) — `connector_sync_runs` in TABLE ORDER (migration 172).
_SYNC_RUN_COLUMNS = (
    "id, org_id, user_id, watch_id, started_at, finished_at, status, failure_cause, "
    "last_error, listing_complete, count_new, count_modified, count_renamed, "
    "count_missing, count_restored, count_errors, created_at"
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
    counts: dict[str, int] | None = None,
    listing_complete: bool = False,
    failure_cause: str | None = None,
    started_at: datetime | None = None,
    user_id: UUID | None = None,
    org_id: UUID | None = None,
    retain: int | None = None,
) -> None:
    """Clear the lease, write the terminal outcome hint, and record ONE run row.

    Phase 235 (SURF-02 / D-235-06 / D-235-07 / D-235-08).

    ⭐ WHY THE RUN-ROW WRITE LIVES HERE AND NOT AT THE CALL SITES. `watch_service.py`
    releases a watch from FOUR places — `tick()`'s per-watch `except` (`:115`, which is
    outside `sync_watch` entirely), the connection-disabled arm (`:143`), the happy path
    (`:434`) and the VIS-04 403 arm (`:458`). Writing the row at each of them means a
    fifth arm added later silently stops recording history. Writing it HERE means all
    four get a row by construction and a fifth cannot forget.

    ⚠ THE RUN-ROW INSERT INHERITS THE SWALLOW, AND THAT IS THE POINT (T-235-05).
    Losing a history row must never turn a successful sync into a failed one. The
    visible consequence of a failed insert is a gap the history renders honestly, plus
    a `logger.exception`; the alternative — a real sync marked failed because its
    bookkeeping did not land — is strictly worse.

    ⚠ ASYNCPG ONLY. This module touches no Supabase client, so the threadpool wrapper
    D-v2.5-01 mandates for blocking supabase-py calls does not apply to any statement
    here — both are plain awaits. (The token itself is kept out of this file on purpose:
    its absence is a grep-able guard, and a mention in prose would read as a use.)

    All arguments after `error` are optional and net-new: the four existing call sites
    keep compiling unchanged, and a caller that supplies nothing still gets an honest
    zero-count row rather than no row at all.
    """
    keep = settings.watch_run_history_retention if retain is None else retain
    c = counts or {}
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

            # ── The run row + its bound, in ONE statement (D-235-08) ──────────────
            #
            # `retain` is BOUND as `$15`, never interpolated (T-235-04).
            #
            # ⚠ THE `- 1` IS DELIBERATE AND LOAD-BEARING. The DELETE and the CTE share
            # one snapshot, so the row just inserted is invisible to the sub-SELECT and
            # cannot itself be deleted. Keeping `retain - 1` of the pre-existing rows
            # therefore leaves exactly `retain` rows including the new one; keeping
            # `retain` would leave `retain + 1` and the bound would drift by one row on
            # every single tick. `GREATEST(..., 0)` makes `retain = 1` mean "only the
            # newest", not a negative LIMIT.
            #
            # `user_id` / `org_id` are read off the watch itself when the caller does
            # not supply them, so ownership is resolved in the same statement rather
            # than by a second round trip that could race a delete.
            await con.execute(
                """
                WITH ins AS (
                    INSERT INTO connector_sync_runs (
                        watch_id, user_id, org_id, started_at, finished_at,
                        status, failure_cause, last_error, listing_complete,
                        count_new, count_modified, count_renamed,
                        count_missing, count_restored, count_errors
                    )
                    SELECT w.id,
                           COALESCE($2::uuid, w.user_id),
                           COALESCE($3::uuid, w.org_id),
                           COALESCE($4::timestamptz, now()),
                           now(),
                           $5, $6, $7, $8,
                           $9, $10, $11, $12, $13, $14
                    FROM connector_watches w
                    WHERE w.id = $1
                    RETURNING watch_id
                )
                DELETE FROM connector_sync_runs
                WHERE watch_id = (SELECT watch_id FROM ins)
                  AND id NOT IN (
                      SELECT id
                      FROM connector_sync_runs
                      WHERE watch_id = (SELECT watch_id FROM ins)
                      ORDER BY started_at DESC
                      LIMIT GREATEST($15::int - 1, 0)
                  )
                """,
                _as_uuid(watch_id),
                _as_uuid(user_id) if user_id else None,
                _as_uuid(org_id) if org_id else None,
                started_at,
                status,
                failure_cause,
                error,
                bool(listing_complete),
                int(c.get("new", 0)),
                int(c.get("modified", 0)),
                int(c.get("renamed", 0)),
                int(c.get("missing", 0)),
                int(c.get("restored", 0)),
                int(c.get("errors", 0)),
                int(keep),
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


# ── Sync Run History (Phase 235 / SURF-02) ────────────────────────────────────
#
# ⛔ BOTH READS CARRY AN OWNER PREDICATE IN THE SQL ITSELF, AND THAT IS NOT OPTIONAL
# (T-235-01). The asyncpg pool path is NOT RLS-gated — the policies migration 172 adds
# protect PostgREST, not this connection. `get_watch_items` above deliberately has no
# owner predicate because its route checks ownership first; these two are reached from
# reads where a guessed `watch_id` must return zero rows rather than another tenant's
# history. The shape to match is `get_watch:96-103` / `update_watch` / `delete_watch`.


async def list_sync_runs(
    pool: asyncpg.Pool,
    watch_id: UUID,
    *,
    user_id: UUID,
    limit: int = 200,
) -> list[dict]:
    """The per-watch history: what each recent tick actually did, newest first.

    Served entirely by `idx_connector_sync_runs_watch_time` — the same index the
    consecutive-failure derivation uses.
    """
    async with pool.acquire() as con:
        rows = await con.fetch(
            f"""
            SELECT {_SYNC_RUN_COLUMNS}
            FROM connector_sync_runs
            WHERE watch_id = $1 AND user_id = $2
            ORDER BY started_at DESC
            LIMIT $3
            """,
            _as_uuid(watch_id),
            _as_uuid(user_id),
            max(1, limit),
        )
        return [dict(r) for r in rows]


async def recent_runs_by_watch(
    pool: asyncpg.Pool,
    watch_ids: list[UUID],
    *,
    user_id: UUID,
    per_watch: int = 5,
) -> dict[str, list[dict]]:
    """The last `per_watch` runs for MANY watches, in ONE query.

    ⭐ The health verdict asks "how are all my sources doing?" — one query per watch
    would be N round trips growing with the roster, which is the shape
    `_enrich_watch_rows` already suffers from. `ROW_NUMBER()` windows the whole set in
    a single pass.

    ⚠ The consecutive-failure count the verdict needs is DERIVED from these rows — count
    the leading entries whose `status <> 'success'`. There is deliberately no counter
    column: four release arms would each have to increment and reset it, and a fifth
    added later would drift undetectably from the history the user is looking at.
    An EMPTY list for a watch is not "zero failures" — it is "has not read yet", which
    is a different sentence.

    Returns `{str(watch_id): [row, ...]}`, newest first within each watch.
    """
    if not watch_ids:
        return {}

    async with pool.acquire() as con:
        rows = await con.fetch(
            f"""
            SELECT {_SYNC_RUN_COLUMNS}
            FROM (
                SELECT {_SYNC_RUN_COLUMNS},
                       ROW_NUMBER() OVER (PARTITION BY watch_id ORDER BY started_at DESC) AS rn
                FROM connector_sync_runs
                WHERE watch_id = ANY($1::uuid[]) AND user_id = $2
            ) ranked
            WHERE rn <= $3
            ORDER BY watch_id, started_at DESC
            """,
            [_as_uuid(w) for w in watch_ids],
            _as_uuid(user_id),
            max(1, per_watch),
        )

    grouped: dict[str, list[dict]] = {}
    for r in rows:
        record = dict(r)
        grouped.setdefault(str(record["watch_id"]), []).append(record)
    return grouped


async def last_success_by_watch(
    pool: asyncpg.Pool,
    watch_ids: list[UUID],
    *,
    user_id: UUID,
) -> dict[str, datetime]:
    """When each of these watches last read SUCCESSFULLY — UNBOUNDED, in ONE query.

    ⭐ THE ONE PROPERTY THAT MAKES THIS WORTH EXISTING BESIDE `recent_runs_by_watch`: that read
    is WINDOWED and this one is not, and the difference is exactly the gap it closes. The
    verdict only needs the LEADING failure streak, so it reads five rows per watch; a source
    that has failed more ticks than the window is deep therefore has no success inside it and
    the verdict can only answer `last_good_at = None`. Every surface then renders NOTHING, which
    is silence where the promised sentence is *"it last read successfully on X"*.

    ⚠ WHY THE WINDOW WAS NOT SIMPLY WIDENED INSTEAD. `recent_runs_by_watch` feeds an endpoint
    polled from every page by every signed-in user; widening it multiplies rows read on EVERY
    poll for EVERY healthy source, to answer a question only STOPPED sources ask. This runs only
    for watches the verdict has already called stopped — zero rows on a healthy instance, and no
    query at all when that list is empty.

    ⛔ `user_id = $2` is IN THE SQL, not merely at the call site. The asyncpg pool path is NOT
    RLS-gated (migration 172's policies protect PostgREST, not this connection), so this read
    carries the same owner predicate as `list_sync_runs` and `recent_runs_by_watch` above.

    Served by `idx_connector_sync_runs_watch_time` — the same `(watch_id, started_at DESC)`
    index the history page and the streak derivation already read; `MAX(started_at)` per
    `watch_id` is a bounded scan of that index, not of the table. ⚠ It deliberately does NOT
    reuse `_SYNC_RUN_COLUMNS`: this selects an AGGREGATE, and pulling seventeen columns to read
    one instant would be exactly the amplification the sibling docblock warns about.

    Returns `{str(watch_id): datetime}`. A watch with no successful tick is ABSENT — never
    present with a `None` value, so a caller cannot confuse "has never succeeded" with "was not
    asked about".
    """
    if not watch_ids:
        return {}

    async with pool.acquire() as con:
        rows = await con.fetch(
            """
            SELECT watch_id, MAX(started_at) AS last_success_at
            FROM connector_sync_runs
            WHERE watch_id = ANY($1::uuid[])
              AND user_id = $2
              AND status = 'success'
            GROUP BY watch_id
            """,
            [_as_uuid(w) for w in watch_ids],
            _as_uuid(user_id),
        )

    found: dict[str, datetime] = {}
    for r in rows:
        when = r["last_success_at"]
        # The status filter already makes a NULL aggregate unreachable; dropping it anyway is
        # what keeps ABSENCE the only way this mapping says "never succeeded".
        if when is not None:
            found[str(r["watch_id"])] = when
    return found


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
    clear_missing_since: bool = False,
) -> None:
    """Update lifecycle state of one tracked item (WATCH-05)."""
    async with pool.acquire() as con:
        await con.execute(
            """
            UPDATE connector_watch_items
            SET state = $2,
                missing_since = CASE
                    WHEN $5::boolean OR $2 = 'present' THEN NULL
                    WHEN $3 IS NOT NULL THEN $3
                    WHEN $2 = 'missing' AND missing_since IS NULL THEN now()
                    ELSE missing_since
                END,
                last_error = $4,
                updated_at = now()
            WHERE id = $1
            """,
            _as_uuid(item_id),
            state,
            missing_since,
            error,
            clear_missing_since,
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
                missing_since = CASE
                    WHEN $2 = 'present' THEN NULL
                    WHEN $3 IS NOT NULL THEN $3
                    WHEN $2 = 'missing' AND missing_since IS NULL THEN now()
                    ELSE missing_since
                END,
                updated_at = now()
            WHERE id = ANY($1::uuid[])
            """,
            [_as_uuid(i) for i in item_ids],
            state,
            missing_since,
        )
