from __future__ import annotations

from datetime import datetime
from uuid import UUID

import asyncpg


async def upsert_workspace_file(
    pool: asyncpg.Pool,
    *,
    thread_id: UUID,
    path: str,
    size_bytes: int,
    mime_type: str,
    content_inline: bytes | None,
    content_storage_path: str | None,
    created_by: UUID,
    kind: str | None = None,
    expires_at: datetime | None = None,
) -> tuple[UUID, bool]:
    """Upsert a workspace file. Returns (file_id, is_new).

    Phase 100 (TMPL-01): ``kind`` / ``expires_at`` are nullable ephemeral-template
    columns (migration 068). Agent callers omit both -> NULL/NULL -> the gated read
    seams treat NULL expiry as never-expires (D-11 byte-identical). Only the template
    upload caller (Plan 100-04) passes ``kind='template_input'`` + a future expiry.

    WR-01 (100-REVIEW): the ON CONFLICT path COALESCEs ``kind``/``expires_at`` so an
    agent overwrite of a template path (kind=None/expires_at=None) PRESERVES the
    row's template lifecycle instead of NULLing it — otherwise the row never expires,
    the sweep never touches it, and the original template bytes leak permanently in
    workspace_file_versions. Agent rows stay byte-identical: COALESCE(NULL, NULL) is
    NULL, and a template re-upload's non-NULL EXCLUDED values still win.
    """
    row = await pool.fetchrow(
        """
        INSERT INTO workspace_files
            (thread_id, path, size_bytes, mime_type,
             content_inline, content_storage_path, created_by,
             kind, expires_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (thread_id, path) DO UPDATE SET
            size_bytes = EXCLUDED.size_bytes,
            mime_type = EXCLUDED.mime_type,
            content_inline = EXCLUDED.content_inline,
            content_storage_path = EXCLUDED.content_storage_path,
            kind = COALESCE(EXCLUDED.kind, workspace_files.kind),
            expires_at = COALESCE(EXCLUDED.expires_at, workspace_files.expires_at),
            updated_at = now()
        RETURNING id, (xmax = 0) AS is_new
        """,
        thread_id, path, size_bytes, mime_type,
        content_inline, content_storage_path, created_by,
        kind, expires_at,
    )
    return row["id"], row["is_new"]


async def insert_version(
    pool: asyncpg.Pool,
    *,
    workspace_file_id: UUID,
    version: int,
    content_inline: bytes | None,
    content_storage_path: str | None,
    size_bytes: int,
    delta_from_prev: dict | None,
) -> None:
    """Insert a new version row."""
    # delta_from_prev is a JSONB column and the asyncpg pool registers a jsonb
    # codec (encoder=json.dumps — see dependencies._init_pg_connection), so pass
    # the dict through directly. json.dumps'ing here too double-encodes into a
    # JSON *string* (jsonb_typeof -> 'string'), which made the /diff endpoint's
    # delta.get(...) raise on read → HTTP 500 (087-08 UAT finding).
    delta_json = delta_from_prev
    await pool.execute(
        """
        INSERT INTO workspace_file_versions
            (workspace_file_id, version, content_inline,
             content_storage_path, size_bytes, delta_from_prev)
        VALUES ($1, $2, $3, $4, $5, $6)
        """,
        workspace_file_id, version, content_inline,
        content_storage_path, size_bytes, delta_json,
    )


async def get_next_version(pool: asyncpg.Pool, workspace_file_id: UUID) -> int:
    """Return the next version number (max existing + 1, or 1 if none)."""
    return await pool.fetchval(
        "SELECT COALESCE(MAX(version), 0) + 1 FROM workspace_file_versions WHERE workspace_file_id = $1",
        workspace_file_id,
    )


async def get_previous_version_content(
    pool: asyncpg.Pool,
    workspace_file_id: UUID,
    current_version: int,
) -> bytes | None:
    """Fetch inline content of the version immediately before current_version.

    Returns None if no previous version or if content was in Storage bucket.
    """
    return await pool.fetchval(
        """
        SELECT content_inline FROM workspace_file_versions
        WHERE workspace_file_id = $1 AND version = $2
        """,
        workspace_file_id, current_version - 1,
    )


async def count_files_in_thread(pool: asyncpg.Pool, thread_id: UUID) -> int:
    """Count workspace files in a thread (for D-04 soft limit)."""
    return await pool.fetchval(
        "SELECT COUNT(*) FROM workspace_files WHERE thread_id = $1",
        thread_id,
    )


async def get_file_by_path(pool: asyncpg.Pool, thread_id: UUID, path: str) -> dict | None:
    """Fetch a workspace file row by thread_id + path. Returns dict or None.

    Phase 100 (TMPL-01): deliberately UNFILTERED on expiry — the D-10 'template
    expired' error needs to distinguish an expired-but-present row from a truly
    absent one. The computed ``is_expired`` flag carries that distinction; the
    service layer raises FileNotFoundError_('template expired') on it. NULL-expiry
    (agent) rows get is_expired = False (byte-identical, D-11).
    """
    row = await pool.fetchrow(
        """
        SELECT id, thread_id, path, size_bytes, mime_type,
               content_inline, content_storage_path,
               created_by, created_at, updated_at,
               kind, expires_at,
               (expires_at IS NOT NULL AND expires_at <= now()) AS is_expired
        FROM workspace_files
        WHERE thread_id = $1 AND path = $2
        """,
        thread_id, path,
    )
    return dict(row) if row else None


async def get_file_by_id(pool: asyncpg.Pool, file_id: UUID) -> dict | None:
    """Fetch a workspace file row by id. Returns dict or None.

    Phase 100 (TMPL-01): same D-10 distinction as get_file_by_path — kept UNFILTERED
    so the REST content route (Plan 100-04) can tell expired-present from absent and
    404 on either. NULL-expiry rows -> is_expired = False (byte-identical, D-11).
    """
    row = await pool.fetchrow(
        """
        SELECT id, thread_id, path, size_bytes, mime_type,
               content_inline, content_storage_path,
               created_by, created_at, updated_at,
               kind, expires_at,
               (expires_at IS NOT NULL AND expires_at <= now()) AS is_expired
        FROM workspace_files
        WHERE id = $1
        """,
        file_id,
    )
    return dict(row) if row else None


async def list_files_in_thread(
    pool: asyncpg.Pool,
    thread_id: UUID,
    prefix: str | None = None,
) -> list[dict]:
    """List workspace files in a thread, optionally filtered by path prefix.

    Phase 100 (TMPL-01): GATED on expiry — expired template rows
    (``expires_at <= now()``) are hidden from the listing, while NULL-expiry agent
    files always pass (``expires_at IS NULL`` short-circuits the OR). This is the
    SC#3-critical consumer (Pitfall 1 — a filter on the REST layer is invisible
    here). The gate is a literal no-op for agent files (D-11 byte-identical).
    """
    if prefix:
        rows = await pool.fetch(
            """
            SELECT id, path, size_bytes, mime_type, created_at, updated_at,
                   kind, expires_at
            FROM workspace_files
            WHERE thread_id = $1 AND path LIKE $2
              AND (expires_at IS NULL OR expires_at > now())
            ORDER BY path
            """,
            thread_id, f"{prefix}%",
        )
    else:
        rows = await pool.fetch(
            """
            SELECT id, path, size_bytes, mime_type, created_at, updated_at,
                   kind, expires_at
            FROM workspace_files
            WHERE thread_id = $1
              AND (expires_at IS NULL OR expires_at > now())
            ORDER BY path
            """,
            thread_id,
        )
    return [dict(r) for r in rows]


async def delete_file_by_path(pool: asyncpg.Pool, thread_id: UUID, path: str) -> dict | None:
    """Delete a workspace file by thread_id + path.

    Returns the deleted row (for cleanup) or None.
    """
    row = await pool.fetchrow(
        """
        DELETE FROM workspace_files
        WHERE thread_id = $1 AND path = $2
        RETURNING id, content_storage_path
        """,
        thread_id, path,
    )
    return dict(row) if row else None


async def get_version_content(
    pool: asyncpg.Pool,
    workspace_file_id: UUID,
    version: int,
) -> dict | None:
    """Fetch a specific version row."""
    row = await pool.fetchrow(
        """
        SELECT id, version, content_inline, content_storage_path,
               size_bytes, delta_from_prev, created_at
        FROM workspace_file_versions
        WHERE workspace_file_id = $1 AND version = $2
        """,
        workspace_file_id, version,
    )
    return dict(row) if row else None


async def list_versions(pool: asyncpg.Pool, workspace_file_id: UUID) -> list[dict]:
    """List all versions of a workspace file (newest first)."""
    rows = await pool.fetch(
        """
        SELECT id, version, size_bytes, created_at
        FROM workspace_file_versions
        WHERE workspace_file_id = $1
        ORDER BY version DESC
        """,
        workspace_file_id,
    )
    return [dict(r) for r in rows]


async def get_latest_version_number(pool: asyncpg.Pool, workspace_file_id: UUID) -> int | None:
    """Return the latest version number, or None if no versions."""
    return await pool.fetchval(
        "SELECT MAX(version) FROM workspace_file_versions WHERE workspace_file_id = $1",
        workspace_file_id,
    )


async def get_storage_paths_for_file(pool: asyncpg.Pool, workspace_file_id: UUID) -> list[str]:
    """Get all non-null storage paths for a file's versions (for cleanup on delete)."""
    rows = await pool.fetch(
        """
        SELECT content_storage_path FROM workspace_file_versions
        WHERE workspace_file_id = $1 AND content_storage_path IS NOT NULL
        UNION
        SELECT content_storage_path FROM workspace_files
        WHERE id = $1 AND content_storage_path IS NOT NULL
        """,
        workspace_file_id,
    )
    return [r["content_storage_path"] for r in rows]
