from __future__ import annotations

import difflib
import logging
import mimetypes
import re
from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID

from starlette.concurrency import run_in_threadpool

from app.db.workspace import (
    count_files_in_thread,
    delete_file_by_path,
    get_file_by_path,
    get_latest_version_number,
    get_previous_version_content,
    get_storage_paths_for_file,
    get_version_content,
    insert_version,
    list_files_in_thread,
    list_versions,
    upsert_workspace_file,
    get_next_version,
)

if TYPE_CHECKING:
    import asyncpg
    from supabase import Client

logger = logging.getLogger(__name__)

MAX_FILE_SIZE = 10 * 1024 * 1024
DEFAULT_INLINE_THRESHOLD = 256 * 1024
SOFT_FILE_LIMIT = 100
DEFAULT_READ_CAP = 8192
MAX_PATH_LENGTH = 500

_PATH_PATTERN = re.compile(r"^/[a-zA-Z0-9._/\- ]+$")
BUCKET_NAME = "workspace-files"

_BINARY_MIME_PREFIXES = (
    "image/",
    "audio/",
    "video/",
    "application/pdf",
    "application/zip",
    "application/gzip",
    "application/octet-stream",
    # Phase 100 (TMPL-01) — A1 hygiene: a workspace_read of an uploaded OOXML
    # template (docx/pptx/xlsx) must return the clean binary stub. Without this
    # the OOXML ZIP bytes would be UTF-8-decoded into garbage in the read_file
    # text branch (and raw ZIP bytes would leak into the agent context).
    "application/vnd.openxmlformats-officedocument",
)


class WorkspaceError(Exception):
    """Base error for workspace operations."""


class PathValidationError(WorkspaceError):
    pass


class FileTooLargeError(WorkspaceError):
    pass


class FileNotFoundError_(WorkspaceError):
    """Workspace file not found (distinct from builtins.FileNotFoundError)."""


def validate_path(path: str) -> str:
    """Validate and normalize a workspace file path.

    Per D-02: no leading/trailing whitespace, no double slashes, no '..',
    max 500 chars, must start with '/'.
    """
    path = path.strip()
    if not path:
        raise PathValidationError("Path cannot be empty")
    if not path.startswith("/"):
        raise PathValidationError("Path must start with /")
    if len(path) > MAX_PATH_LENGTH:
        raise PathValidationError(f"Path exceeds {MAX_PATH_LENGTH} character limit")
    if ".." in path:
        raise PathValidationError("Path cannot contain '..' (directory traversal)")
    if "//" in path:
        raise PathValidationError("Path cannot contain double slashes")
    if not _PATH_PATTERN.match(path):
        raise PathValidationError(
            "Path contains invalid characters. Allowed: letters, digits, '.', '_', '-', ' ', '/'"
        )
    return path


def guess_mime_type(path: str) -> str:
    """Detect MIME type from file path extension."""
    mime, _ = mimetypes.guess_type(path)
    return mime or "application/octet-stream"


def compute_diff(old_text: str, new_text: str, from_label: str, to_label: str) -> dict:
    """Compute structured unified diff between two text strings.

    Per D-07: unified text diff stored as JSONB.
    """
    old_lines = old_text.splitlines(keepends=True)
    new_lines = new_text.splitlines(keepends=True)

    diff_lines = list(
        difflib.unified_diff(
            old_lines,
            new_lines,
            fromfile=from_label,
            tofile=to_label,
        )
    )

    additions = sum(
        1 for l in diff_lines if l.startswith("+") and not l.startswith("+++")
    )
    deletions = sum(
        1 for l in diff_lines if l.startswith("-") and not l.startswith("---")
    )

    truncated = len(diff_lines) > 500
    if truncated:
        diff_lines = diff_lines[:500]

    return {
        "format": "unified",
        "diff": "".join(diff_lines),
        "stats": {"additions": additions, "deletions": deletions},
        "truncated": truncated,
    }


async def _read_from_storage(supabase: "Client", storage_path: str) -> bytes:
    """Download file content from Supabase Storage bucket."""
    return await run_in_threadpool(
        supabase.storage.from_(BUCKET_NAME).download, storage_path
    )


async def _get_file_content(pool: "asyncpg.Pool", supabase: "Client", file_row: dict) -> bytes:
    """Read file content from inline storage or Storage bucket."""
    if file_row.get("content_inline") is not None:
        return file_row["content_inline"]
    if file_row.get("content_storage_path"):
        return await _read_from_storage(supabase, file_row["content_storage_path"])
    raise WorkspaceError(
        f"No content available for file {file_row.get('path', file_row.get('id'))}"
    )


async def _get_version_content_bytes(
    pool: "asyncpg.Pool",
    supabase: "Client",
    file_id: UUID,
    version: int,
) -> bytes | None:
    """Fetch version content bytes from inline or bucket."""
    ver = await get_version_content(pool, file_id, version)
    if ver is None:
        return None
    if ver.get("content_inline") is not None:
        return ver["content_inline"]
    if ver.get("content_storage_path"):
        try:
            return await _read_from_storage(supabase, ver["content_storage_path"])
        except Exception:
            return None
    return None


async def _compute_delta_from_prev(
    pool: "asyncpg.Pool",
    supabase: "Client",
    file_id: UUID,
    current_version: int,
    new_content: bytes,
    path: str,
) -> dict | None:
    """Compute structured diff from previous version to new content."""
    prev_inline = await get_previous_version_content(pool, file_id, current_version)
    if prev_inline is not None:
        old_text = prev_inline.decode("utf-8", errors="replace")
    else:
        prev_ver = await get_version_content(pool, file_id, current_version - 1)
        if prev_ver is None:
            return None
        if prev_ver.get("content_storage_path"):
            try:
                old_bytes = await _read_from_storage(
                    supabase, prev_ver["content_storage_path"]
                )
                old_text = old_bytes.decode("utf-8", errors="replace")
            except Exception:
                logger.warning("Failed to read previous version from storage for diff")
                return {"format": "error", "note": "Previous version unavailable for diff"}
        else:
            return None

    try:
        new_text = new_content.decode("utf-8", errors="replace")
    except Exception:
        return {"format": "binary", "note": "Binary file changed"}

    return compute_diff(old_text, new_text, f"v{current_version - 1}", f"v{current_version}")


async def write_file(
    pool: "asyncpg.Pool",
    supabase: "Client",
    *,
    thread_id: UUID,
    user_id: UUID,
    path: str,
    content: bytes,
    inline_threshold: int = DEFAULT_INLINE_THRESHOLD,
    kind: str | None = None,
    expires_at: datetime | None = None,
) -> dict:
    """Write or update a workspace file with auto-versioning.

    Returns dict with keys: file_id, path, version, size_bytes, mime_type,
    kind, expires_at, warning.

    Phase 100 (TMPL-01): ``kind`` / ``expires_at`` thread through to the row. The
    template upload handler (Plan 100-04) passes kind='template_input' + a future
    expiry (D-12); every existing agent caller passes neither -> both default None
    -> NULL/NULL -> byte-identical (D-11).
    """
    path = validate_path(path)
    size = len(content)

    if size > MAX_FILE_SIZE:
        raise FileTooLargeError(
            f"File size {size:,} bytes exceeds maximum of {MAX_FILE_SIZE:,} bytes (10MB)"
        )

    mime = guess_mime_type(path)
    is_inline = size <= inline_threshold

    file_id, is_new = await upsert_workspace_file(
        pool,
        thread_id=thread_id,
        path=path,
        size_bytes=size,
        mime_type=mime,
        content_inline=content if is_inline else None,
        content_storage_path=None,
        created_by=user_id,
        kind=kind,
        expires_at=expires_at,
    )

    storage_path: str | None = None
    if not is_inline:
        version_num = await get_next_version(pool, file_id)
        storage_path = f"{user_id}/{thread_id}/{file_id}/v{version_num}"
        await run_in_threadpool(
            supabase.storage.from_(BUCKET_NAME).upload,
            storage_path,
            content,
            {"content-type": mime, "upsert": "true"},
        )
        await pool.execute(
            "UPDATE workspace_files SET content_storage_path = $1 WHERE id = $2",
            storage_path, file_id,
        )
    else:
        version_num = await get_next_version(pool, file_id)

    delta = None
    if version_num > 1:
        delta = await _compute_delta_from_prev(
            pool, supabase, file_id, version_num, content, path
        )

    await insert_version(
        pool,
        workspace_file_id=file_id,
        version=version_num,
        content_inline=content if is_inline else None,
        content_storage_path=storage_path,
        size_bytes=size,
        delta_from_prev=delta,
    )

    warning = None
    file_count = await count_files_in_thread(pool, thread_id)
    if file_count > SOFT_FILE_LIMIT:
        warning = (
            f"Warning: {file_count}/{SOFT_FILE_LIMIT} files in workspace. "
            "Consider deleting unused files."
        )

    return {
        "file_id": str(file_id),
        "path": path,
        "version": version_num,
        "size_bytes": size,
        "mime_type": mime,
        "kind": kind,
        "expires_at": expires_at.isoformat() if expires_at is not None else None,
        "is_new": is_new,
        "warning": warning,
    }


async def read_file(
    pool: "asyncpg.Pool",
    supabase: "Client",
    *,
    thread_id: UUID,
    path: str,
    start_line: int | None = None,
    end_line: int | None = None,
    max_chars: int = DEFAULT_READ_CAP,
) -> dict:
    """Read a workspace file.

    Returns content capped at max_chars for text, metadata for binary.
    """
    path = validate_path(path)
    file_row = await get_file_by_path(pool, thread_id, path)
    if not file_row:
        raise FileNotFoundError_(f"File not found: {path}")
    if file_row.get("is_expired"):
        # D-10: an expired template is present in the row but past its TTL. Name
        # expiry explicitly so the model can relay honestly (run-honesty) rather
        # than confabulating about a file the user knows they uploaded — NOT a
        # generic not-found. NULL-expiry agent rows never set is_expired (D-11).
        raise FileNotFoundError_("template expired")

    mime = file_row["mime_type"]

    if any(mime.startswith(p) for p in _BINARY_MIME_PREFIXES):
        return {
            "path": path,
            "mime_type": mime,
            "size_bytes": file_row["size_bytes"],
            "content": None,
            "is_binary": True,
            "note": (
                f"Binary file ({mime}, {file_row['size_bytes']:,} bytes). "
                "Content available via REST API."
            ),
        }

    content_bytes = await _get_file_content(pool, supabase, file_row)
    text = content_bytes.decode("utf-8", errors="replace")

    if start_line is not None or end_line is not None:
        lines = text.splitlines(keepends=True)
        start = (start_line or 1) - 1
        end = end_line or len(lines)
        text = "".join(lines[start:end])

    total_chars = len(text)
    is_truncated = total_chars > max_chars
    if is_truncated:
        text = text[:max_chars]

    return {
        "path": path,
        "mime_type": mime,
        "size_bytes": file_row["size_bytes"],
        "content": text,
        "is_binary": False,
        "is_truncated": is_truncated,
        "total_chars": total_chars,
    }


async def list_files(
    pool: "asyncpg.Pool",
    *,
    thread_id: UUID,
    prefix: str | None = None,
) -> list[dict]:
    """List workspace files in a thread."""
    return await list_files_in_thread(pool, thread_id, prefix)


async def delete_file(
    pool: "asyncpg.Pool",
    supabase: "Client",
    *,
    thread_id: UUID,
    path: str,
) -> dict:
    """Delete a workspace file and all its versions.

    Cleans up Storage bucket objects best-effort.
    """
    path = validate_path(path)

    file_row = await get_file_by_path(pool, thread_id, path)
    if not file_row:
        raise FileNotFoundError_(f"File not found: {path}")

    file_id = file_row["id"]

    storage_paths = await get_storage_paths_for_file(pool, file_id)

    await delete_file_by_path(pool, thread_id, path)

    for sp in storage_paths:
        try:
            await run_in_threadpool(
                supabase.storage.from_(BUCKET_NAME).remove, [sp]
            )
        except Exception:
            logger.warning(f"Failed to clean up storage object: {sp}")

    return {"path": path, "deleted": True}


async def get_diff(
    pool: "asyncpg.Pool",
    supabase: "Client",
    *,
    thread_id: UUID,
    path: str,
    from_version: int | None = None,
    to_version: int | None = None,
) -> dict:
    """Compute diff between two versions of a workspace file."""
    path = validate_path(path)
    file_row = await get_file_by_path(pool, thread_id, path)
    if not file_row:
        raise FileNotFoundError_(f"File not found: {path}")
    if file_row.get("is_expired"):
        # D-10 (WR-02, 100-REVIEW): mirror the read_file gate — an expired template
        # must be hidden from ALL read paths, including the workspace_diff tool
        # (ws_get_diff). NULL-expiry agent rows never set is_expired (D-11).
        raise FileNotFoundError_("template expired")

    file_id = file_row["id"]
    latest = await get_latest_version_number(pool, file_id)
    if latest is None:
        raise WorkspaceError("File has no versions")

    to_v = to_version or latest
    from_v = from_version if from_version is not None else max(1, to_v - 1)

    if from_v == to_v:
        return {
            "path": path,
            "from_version": from_v,
            "to_version": to_v,
            "delta": {
                "format": "unified",
                "diff": "",
                "stats": {"additions": 0, "deletions": 0},
                "truncated": False,
            },
            "stats": {"additions": 0, "deletions": 0},
        }

    if to_v == from_v + 1:
        to_ver = await get_version_content(pool, file_id, to_v)
        if to_ver and to_ver.get("delta_from_prev"):
            delta = to_ver["delta_from_prev"]
            if isinstance(delta, str):
                import json
                delta = json.loads(delta)
            return {
                "path": path,
                "from_version": from_v,
                "to_version": to_v,
                "delta": delta,
                "stats": delta.get("stats", {}),
            }

    from_content = await _get_version_content_bytes(pool, supabase, file_id, from_v)
    to_content = await _get_version_content_bytes(pool, supabase, file_id, to_v)

    if from_content is None or to_content is None:
        raise WorkspaceError(
            f"Version content not available for diff (v{from_v} -> v{to_v})"
        )

    old_text = from_content.decode("utf-8", errors="replace")
    new_text = to_content.decode("utf-8", errors="replace")
    delta = compute_diff(old_text, new_text, f"v{from_v}", f"v{to_v}")

    return {
        "path": path,
        "from_version": from_v,
        "to_version": to_v,
        "delta": delta,
        "stats": delta["stats"],
    }


async def get_versions(
    pool: "asyncpg.Pool",
    *,
    file_id: UUID,
) -> list[dict]:
    """List all versions of a workspace file."""
    return await list_versions(pool, file_id)
