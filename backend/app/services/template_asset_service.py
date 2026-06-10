"""Phase 101 (TMPL-02 / D-09) — template byte resolution by PROVENANCE.

The seam the fill tool (Plan 04) calls to obtain the template bytes BEFORE shipping
them into the sandbox. Two mutually-exclusive sources, each carrying a provenance tag
that Plan 02's ``template_render_service.select_engine`` consumes to pick the render
engine — this module never re-implements that routing, it only RETURNS the tag:

  - **Library ``AssetRef`` (trusted → docxtpl):** a published, immutable
    ``WorkflowDefinition.assets[]`` ref whose ``asset_id`` is a Storage path in the
    ``workspace-files`` bucket (no-TTL row, D-09). Bytes fetched via the existing
    ``workspace_service._read_from_storage`` (run_in_threadpool-wrapped — CLAUDE.md
    D-v2.5-01). Provenance ``"library"``.
  - **Ephemeral upload (untrusted → run_replace):** the newest non-expired
    ``kind='template_input'`` ``workspace_files`` row for this thread+user
    (newest-wins per 100/D-14). Bytes fetched via ``workspace_service._get_file_content``
    (inline-or-Storage). Provenance ``"template_input"``.

Security posture (STRIDE register T-101-03-01..04):
  - Every ephemeral query is user-scoped on ``created_by`` (the RLS backstop column
    set by ``write_file``). A cross-user thread → no matching row → the clean
    "no template" error, NEVER another user's bytes (V4 / 404-not-403).
  - The expiry read gate ``(expires_at IS NULL OR expires_at > now())`` (100 D-10)
    keeps an expired template unreadable; an expired row → a relay-able "expired"
    error, never stale bytes.
  - On ANY failure (download error, no row, expired, cross-user) the function
    returns ``bytes=None`` + a relay-able ``error`` STRING — it NEVER raises a raw
    404 / never leaks a traceback to the agent context (D-05 clean error).
  - Blocking ``supabase-py`` Storage calls are wrapped via the reused
    ``_read_from_storage`` / ``_get_file_content`` helpers (run_in_threadpool).

This module does NOT import ``template_render_service`` (no circular import — Plan 04
composes the two) and adds NO query/Storage logic to ``threads.py`` (G-5 hot file).
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any

from app.services.workspace_service import (  # reuse — do NOT hand-roll Storage I/O
    BUCKET_NAME,
    _get_file_content,
    _read_from_storage,
)

if TYPE_CHECKING:
    import asyncpg
    from supabase import Client

logger = logging.getLogger(__name__)

# The two-bucket envelope the resolver always returns. Keys are stable so the Plan-04
# tool handler can destructure without guessing.
_EMPTY: dict[str, Any] = {
    "bytes": None,
    "filename": None,
    "provenance": None,
    "mime": None,
    "error": None,
}


def _result(**overrides: Any) -> dict[str, Any]:
    """Build a complete result envelope from defaults + overrides (never a partial dict)."""
    out = dict(_EMPTY)
    out.update(overrides)
    return out


def _filename_from_path(path: str | None) -> str | None:
    """Derive a display filename from a workspace_files.path (e.g. '/template.docx').

    workspace_files has no dedicated `filename` column — `path` carries it. Strip the
    leading slash + any directory segments so the agent sees a clean name.
    """
    if not path:
        return None
    return path.rstrip("/").rsplit("/", 1)[-1] or path


async def resolve_template_source(
    *,
    pool: "asyncpg.Pool",
    supabase: "Client",
    thread_id: str,
    user_id: str,
    asset_ref: Any | None = None,  # AssetRef | None — library path (trusted)
) -> dict:
    """Resolve template bytes by PROVENANCE (D-02/D-09).

    Returns ``{"bytes": bytes|None, "filename": str|None,
    "provenance": "library"|"template_input"|None, "mime": str|None,
    "error": str|None}``. On any failure returns ``bytes=None`` + a relay-able error
    string — NEVER raises a raw 404 / never returns another user's bytes.

    Branch selection is by source, NOT by content (D-02): an ``asset_ref`` resolves the
    trusted library path; ``asset_ref is None`` resolves the untrusted ephemeral upload.
    """
    # ── Branch 1: Library AssetRef (trusted → docxtpl) ──────────────────────────────
    if asset_ref is not None:
        filename = getattr(asset_ref, "filename", None)
        mime = getattr(asset_ref, "mime", None)
        asset_id = getattr(asset_ref, "asset_id", None)
        if not asset_id:
            return _result(
                provenance="library",
                filename=filename,
                mime=mime,
                error=f"Library template '{filename or 'unknown'}' is missing its storage reference.",
            )
        try:
            # asset_id is the Storage path in the workspace-files bucket (RESEARCH Q1:
            # the seeded fixture lives at {user_id}/_library/...). Blocking download is
            # run_in_threadpool-wrapped inside _read_from_storage (D-v2.5-01).
            data = await _read_from_storage(supabase, asset_id)
        except Exception:
            # NEVER surface a raw 404 / traceback — relay a clean message (D-05).
            logger.warning(
                "Library template download failed for asset_id=%s (relaying clean error)",
                asset_id,
            )
            return _result(
                provenance="library",
                filename=filename,
                mime=mime,
                error=f"Library template '{filename or asset_id}' could not be loaded.",
            )
        return _result(
            bytes=data,
            provenance="library",
            filename=filename,
            mime=mime,
            error=None,
        )

    # ── Branch 2: Ephemeral upload (untrusted → run_replace) ────────────────────────
    # Newest-wins per 100/D-14. User-scoped on created_by (RLS backstop, V4): a
    # cross-user thread yields no row → the clean "no template" error below, never
    # another user's bytes. Mirror template_service.py:105 WHERE clause + the 100 D-10
    # read gate (expires_at IS NULL OR expires_at > now()).
    row = await pool.fetchrow(
        """
        SELECT id, thread_id, path, mime_type, content_inline,
               content_storage_path, created_by, created_at, kind, expires_at
        FROM workspace_files
        WHERE thread_id = $1
          AND created_by = $2
          AND kind = 'template_input'
          AND (expires_at IS NULL OR expires_at > now())
        ORDER BY created_at DESC
        LIMIT 1
        """,
        thread_id,
        user_id,
    )

    if row is None:
        # Distinguish "expired" from "never uploaded" by dropping the expiry gate (D-10):
        # a row that exists but is gated-out is expired; truly no row → not uploaded.
        # Still user-scoped (cross-user → no row here either → "no template", never 403).
        expired_row = await pool.fetchrow(
            """
            SELECT id, path
            FROM workspace_files
            WHERE thread_id = $1
              AND created_by = $2
              AND kind = 'template_input'
            ORDER BY created_at DESC
            LIMIT 1
            """,
            thread_id,
            user_id,
        )
        if expired_row is not None:
            return _result(
                provenance="template_input",
                filename=_filename_from_path(expired_row.get("path")),
                error="This template has expired. Upload it again.",
            )
        return _result(
            provenance="template_input",
            error=(
                "No template uploaded to this thread. "
                "Upload a .docx/.pptx/.xlsx first."
            ),
        )

    file_row = dict(row)
    filename = _filename_from_path(file_row.get("path"))
    mime = file_row.get("mime_type")
    try:
        data = await _get_file_content(pool, supabase, file_row)
    except Exception:
        logger.warning(
            "Ephemeral template read failed for workspace_file=%s (relaying clean error)",
            file_row.get("id"),
        )
        return _result(
            provenance="template_input",
            filename=filename,
            mime=mime,
            error=f"Uploaded template '{filename or 'file'}' could not be read.",
        )
    return _result(
        bytes=data,
        provenance="template_input",
        filename=filename,
        mime=mime,
        error=None,
    )
