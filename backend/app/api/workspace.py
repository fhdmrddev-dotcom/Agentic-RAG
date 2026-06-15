"""REST API endpoints for workspace file management (Phase 084, D-08).

Cold-path reads for the panel UI (Phase 087) and dev testing via curl.
All queries go through supabase-py with RLS enforcement (FK-chain policies
on workspace_files ensure users can only access files in their own threads).
"""
from __future__ import annotations

import base64
import io
import logging
import re
import zipfile
from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, File, HTTPException, Query, Response, UploadFile, status
from starlette.concurrency import run_in_threadpool
from supabase import Client

from app.db.workspace import get_file_by_id
from app.dependencies import get_current_user, get_pg_pool, get_supabase
from app.models.user_settings import load_app_settings_async
from app.services.workspace_service import (
    MAX_FILE_SIZE,
    FileTooLargeError,
    WorkspaceError,
    _get_file_content,
    write_file as ws_write_file,
)
from app.utils.db import aexec

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/threads/{thread_id}/workspace",
    tags=["workspace"],
)


async def _verify_thread_ownership(
    thread_id: str,
    current_user: dict,
    supabase: Client,
) -> None:
    """Verify the authenticated user owns this thread. Raises 404 on failure.

    Uses 404 not 403 to prevent existence-leak (D-062-12 convention).
    """
    resp = await aexec(
        supabase.table("threads")
        .select("id")
        .eq("id", thread_id)
        .eq("user_id", current_user["id"])
        .maybe_single()
    )
    row = resp.data if resp is not None else None
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Thread not found",
        )


def _decode_inline_content(value) -> str:
    """Decode workspace_files.content_inline (bytea) into a UTF-8 string.

    Handles every wire shape we've observed from supabase-py / asyncpg
    across the Phase 084 UAT:

    * bytes / bytearray / memoryview: direct UTF-8 decode.
    * str starting with ``\\x`` (PostgreSQL bytea hex literal): hex decode.
      This is the actual shape supabase-py returns in the v2.x client
      used by Phase 084 -- confirmed by runtime probe 2026-05-28
      (``content_inline_repr: '\\x68656c6c6f20776f726c64'`` for 'hello world').
    * dict ``{"type": "Buffer", "data": [int, ...]}``: some supabase-py
      builds wrap bytea this way. Defensive fallback for client drift.
    * str (base64-encoded): fall back to base64 decode for older
      client versions / direct JSON embedding.
    * None: returns "".

    Any decode failure returns "" but emits a warning log so future
    encoding drift is observable in the backend logs.
    """
    if value is None:
        return ""
    try:
        if isinstance(value, (bytes, bytearray, memoryview)):
            return bytes(value).decode("utf-8", errors="replace")
        if isinstance(value, dict):
            data = value.get("data")
            if isinstance(data, list):
                return bytes(data).decode("utf-8", errors="replace")
        if isinstance(value, str):
            # PostgreSQL hex-bytea literal: \xDEADBEEF (the shape supabase-py
            # v2.x actually returns -- confirmed by runtime probe 2026-05-28).
            if value.startswith(r"\x"):
                return bytes.fromhex(value[2:]).decode("utf-8", errors="replace")
            # Fallback: base64 (older supabase-py / direct json embedding).
            return base64.b64decode(value).decode("utf-8", errors="replace")
    except Exception as e:
        logger.warning(
            "_decode_inline_content failed for type=%s len=%s: %s",
            type(value).__name__,
            (len(value) if hasattr(value, "__len__") else "n/a"),
            e,
        )
        return ""
    return ""


# ── Phase 100 (TMPL-01) — ephemeral template upload (D-12) ────────────────────

_ALLOWED_EXT = {".docx", ".pptx", ".xlsx"}
# OOXML part-name prefix that distinguishes the three OOXML types (defense-in-depth).
_OOXML_MARKER = {".docx": "word/", ".pptx": "ppt/", ".xlsx": "xl/"}


def validate_ooxml(filename: str, raw: bytes) -> str:
    """Magic-byte gate for .docx/.pptx/.xlsx uploads (D-12, stdlib only).

    OOXML files are ZIP (PK) containers. ``zipfile.is_zipfile`` validates the
    End-of-Central-Directory record — so a renamed binary / truncated file /
    non-ZIP PDF fails even though a 4-byte sniff would pass. A per-extension
    part-name marker (``word/`` / ``ppt/`` / ``xl/``) plus ``[Content_Types].xml``
    rejects an arbitrary (non-Office) ZIP. A defense-in-depth size guard
    (workspace_service.MAX_FILE_SIZE) trips before any ZIP parsing — the route
    also pre-checks the declared part size before buffering (WR-04). Returns the
    canonical extension; raises HTTPException(422) on any failure (nothing is
    persisted).
    """
    ext = "." + filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext not in _ALLOWED_EXT:
        raise HTTPException(422, f"Unsupported type {ext}. Allowed: .docx, .pptx, .xlsx")
    if len(raw) > MAX_FILE_SIZE:
        raise HTTPException(422, "File too large. Maximum size is 10 MB.")
    bio = io.BytesIO(raw)
    if not zipfile.is_zipfile(bio):
        raise HTTPException(422, "File is not a valid Office document (not a ZIP/OOXML container)")
    with zipfile.ZipFile(bio) as zf:
        names = zf.namelist()
        if "[Content_Types].xml" not in names:
            raise HTTPException(422, "File is not a valid OOXML document")
        if not any(n.startswith(_OOXML_MARKER[ext]) for n in names):
            raise HTTPException(422, f"File contents do not match a {ext} document")
    return ext


@router.post("/files")
async def upload_template(
    thread_id: str,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """Upload an ephemeral .docx/.pptx/.xlsx template (TMPL-01, D-12/D-05).

    The single net-new workspace WRITE endpoint. Validates OOXML by magic bytes
    (D-12), reads the TTL from app_settings (D-05), and persists via write_file
    with kind='template_input' + expires_at = now + TTL. Bad files -> 422 at the
    door (nothing persisted); a thread the user does not own -> 404 (RLS half of
    SC#1 via _verify_thread_ownership). No SSE emit — the handler has no run
    context; the panel reconciles by upserting the returned row (Plan 100-06).
    """
    await _verify_thread_ownership(thread_id, current_user, supabase)  # 404 on non-owner
    # WR-04 (100-REVIEW): reject by the parser-declared part size BEFORE
    # materializing the body in one bytes object — uvicorn/FastAPI impose no body
    # cap, so .read() of a multi-GB part would otherwise buffer it all in RAM.
    if file.size is not None and file.size > MAX_FILE_SIZE:
        raise HTTPException(422, "File too large. Maximum size is 10 MB.")
    raw = await file.read()
    if len(raw) == 0:
        raise HTTPException(422, "File is empty")
    if len(raw) > MAX_FILE_SIZE:
        raise HTTPException(422, "File too large. Maximum size is 10 MB.")
    ext = validate_ooxml(file.filename or "", raw)  # D-12 magic-byte gate
    ttl_hours = (await load_app_settings_async()).template_ttl_hours  # D-05
    expires_at = datetime.now(timezone.utc) + timedelta(hours=ttl_hours)
    # WR-05 (100-REVIEW): sanitize the ORIGINAL filename to validate_path's charset
    # (^/[a-zA-Z0-9._/\- ]+$, no '..') so ordinary names — "Q3 Report (final).docx",
    # "P&L 2026.xlsx", "Übersicht.docx", "report..v2.docx" — don't surface a
    # confusing "invalid path characters" 422 to a user who never typed a path.
    stem = file.filename or f"template{ext}"
    safe_name = re.sub(r"[^a-zA-Z0-9._\- ]", "_", stem)
    safe_name = re.sub(r"\.{2,}", ".", safe_name).strip() or f"template{ext}"
    path = f"/{uuid4().hex[:8]}-{safe_name}"
    try:
        result = await ws_write_file(
            await get_pg_pool(),
            supabase,
            thread_id=UUID(thread_id),
            user_id=UUID(current_user["id"]),
            path=path,
            content=raw,
            kind="template_input",  # D-12
            expires_at=expires_at,  # D-05
        )
    except FileTooLargeError as e:
        raise HTTPException(422, str(e))
    except WorkspaceError as e:
        raise HTTPException(422, str(e))
    result["kind"] = "template_input"
    result["expires_at"] = expires_at.isoformat()
    return result


# Must-haves export alias: the route handler is named ``upload_template`` to
# satisfy the Plan 100-01 TDD contract (``from app.api.workspace import
# upload_template``); ``upload_workspace_template`` is the must_haves export name.
upload_workspace_template = upload_template


def _now_iso() -> str:
    """Current UTC time as an ISO-8601 string for the supabase-py expiry gate (D-06).

    The gated PostgREST ``.or_`` filter is applied to each of the 4 REST GET routes
    (D-06 / D-11): a NULL-expiry agent row matches the IS-NULL branch and is returned
    exactly as today (byte-identical); a template row passes only while its expiry is
    in the future. The 098 D-05a / 099 D-04 gated-no-op pattern.
    """
    return datetime.now(timezone.utc).isoformat()


@router.get("/files")
async def list_workspace_files(
    thread_id: str,
    prefix: str | None = Query(None, description="Path prefix filter"),
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """List workspace files for a thread (D-08, WS-03).

    RLS ensures only the thread owner can see files. Returns metadata list
    sorted by path. Optional prefix filter narrows results.
    """
    await _verify_thread_ownership(thread_id, current_user, supabase)

    query = (
        supabase.table("workspace_files")
        .select("id, path, size_bytes, mime_type, created_at, updated_at, kind, expires_at")
        .eq("thread_id", thread_id)
        .or_("expires_at.is.null,expires_at.gt." + _now_iso())  # D-06: exclude expired templates; agent files pass
        .order("path")
    )
    if prefix:
        query = query.like("path", f"{prefix}%")
    resp = await aexec(query)
    return resp.data or []


@router.get("/files/{file_id}/content")
async def get_workspace_file_content(
    thread_id: str,
    file_id: str,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """Get workspace file content (D-08).

    For inline files: returns content directly as JSON with text field.
    For bucket files: returns a signed URL (60s TTL) for download.
    """
    await _verify_thread_ownership(thread_id, current_user, supabase)

    # Pitfall 2: gate THIS row SELECT (before the 60s signed URL is minted below)
    # so an expired template's row reads as None -> 404 -> no URL ever minted (D-06).
    resp = await aexec(
        supabase.table("workspace_files")
        .select("id, path, size_bytes, mime_type, content_inline, content_storage_path, kind, expires_at")
        .eq("id", file_id)
        .eq("thread_id", thread_id)
        .or_("expires_at.is.null,expires_at.gt." + _now_iso())
        .maybe_single()
    )
    row = resp.data if resp is not None else None
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found",
        )

    if row.get("content_inline") is not None:
        content_text = _decode_inline_content(row["content_inline"])
        return {
            "id": row["id"],
            "path": row["path"],
            "size_bytes": row["size_bytes"],
            "mime_type": row["mime_type"],
            "storage_type": "inline",
            "content": content_text,
        }

    storage_path = row.get("content_storage_path")
    if not storage_path:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File content not available",
        )

    try:
        signed = await run_in_threadpool(
            supabase.storage.from_("workspace-files").create_signed_url,
            storage_path,
            60,
        )
        url = None
        if isinstance(signed, dict):
            url = (
                signed.get("signedURL")
                or signed.get("signed_url")
                or signed.get("signedUrl")
            )
            if not url and isinstance(signed.get("data"), dict):
                url = signed["data"].get("signedUrl")
    except Exception as e:
        logger.error(f"Failed to create signed URL for workspace file: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate download URL",
        )

    return {
        "id": row["id"],
        "path": row["path"],
        "size_bytes": row["size_bytes"],
        "mime_type": row["mime_type"],
        "storage_type": "bucket",
        "signed_url": url,
    }


def _safe_download_filename(path: str) -> str:
    """Derive a header-safe attachment filename from a workspace path basename.

    101.1-09 (gap 3): the Content-Disposition value is attacker-influenced (the
    path comes from a tool-written file). Strip the directory, then replace any
    char outside a conservative allow-list (the same charset validate_path
    accepts, minus the slash) so no CR/LF/quote can break out of the header.
    """
    base = path.rsplit("/", 1)[-1] or "download"
    safe = re.sub(r"[^A-Za-z0-9._\- ]", "_", base).strip()
    return safe or "download"


@router.get("/files/{file_id}/raw")
async def download_workspace_file_raw(
    thread_id: str,
    file_id: str,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """Stream the EXACT bytes of a workspace file as an attachment (101.1-09, gap 3).

    The existing /content route base64-DECODES inline content to TEXT (corrupts a
    binary docx) and only mints a signed URL for BUCKET files. A produced docx/pptx/
    xlsx deliverable is stored INLINE (size < DEFAULT_INLINE_THRESHOLD), so its bytes
    are NOT downloadable via /content — this route returns them verbatim.

    Bytes come from the pg pool (``get_file_by_id`` → ``_get_file_content``): asyncpg
    returns ``content_inline`` as raw ``bytes`` (NOT the hex-string the supabase-py
    client returns), so the inline round-trip is byte-exact; a bucket file is
    downloaded from Storage. SAME guards as /content: ``_verify_thread_ownership``
    (404 non-owner) + the expiry check (404 on an expired template, via the
    ``is_expired`` flag get_file_by_id computes) + the thread-scope check —
    missing-and-IDOR collapsed to 404 (the existence-leak rule, D-062-12).
    """
    await _verify_thread_ownership(thread_id, current_user, supabase)  # 404 on non-owner

    pool = await get_pg_pool()
    # 101.1 review WR-06: a malformed file_id (typo / crafted URL) must 404 like
    # every sibling route (which passes the string to PostgREST and degrades to
    # 404/empty) — never 500 on an unhandled ValueError from UUID().
    try:
        fid = UUID(file_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")
    row = await get_file_by_id(pool, fid)
    # Collapse missing / cross-thread / expired ALL to 404 (no existence leak).
    if (
        not row
        or str(row.get("thread_id")) != thread_id
        or row.get("is_expired")
    ):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")

    try:
        content_bytes = await _get_file_content(pool, supabase, row)
    except WorkspaceError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")

    filename = _safe_download_filename(row["path"])
    return Response(
        content=bytes(content_bytes),
        media_type=row.get("mime_type") or "application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/files/{file_id}/versions")
async def list_workspace_file_versions(
    thread_id: str,
    file_id: str,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """List all versions of a workspace file (D-08, WS-04).

    Returns version metadata sorted by version descending (newest first).
    """
    await _verify_thread_ownership(thread_id, current_user, supabase)

    file_resp = await aexec(
        supabase.table("workspace_files")
        .select("id")
        .eq("id", file_id)
        .eq("thread_id", thread_id)
        .or_("expires_at.is.null,expires_at.gt." + _now_iso())  # D-06: expired template versions not listable
        .maybe_single()
    )
    file_row = file_resp.data if file_resp is not None else None
    if not file_row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found",
        )

    resp = await aexec(
        supabase.table("workspace_file_versions")
        .select("id, version, size_bytes, created_at")
        .eq("workspace_file_id", file_id)
        .order("version", desc=True)
    )
    return resp.data or []


@router.get("/files/{file_id}/diff")
async def get_workspace_file_diff(
    thread_id: str,
    file_id: str,
    from_version: int = Query(..., alias="from", description="Version to diff from"),
    to_version: int = Query(..., alias="to", description="Version to diff to"),
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """Get diff between two versions of a workspace file (D-08, WS-04).

    Returns structured unified diff. For sequential versions, uses the
    pre-computed delta_from_prev when available.
    """
    await _verify_thread_ownership(thread_id, current_user, supabase)

    file_resp = await aexec(
        supabase.table("workspace_files")
        .select("id, path, thread_id")
        .eq("id", file_id)
        .eq("thread_id", thread_id)
        .or_("expires_at.is.null,expires_at.gt." + _now_iso())  # D-06: expired template diff not retrievable
        .maybe_single()
    )
    file_row = file_resp.data if file_resp is not None else None
    if not file_row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found",
        )

    if to_version == from_version + 1:
        ver_resp = await aexec(
            supabase.table("workspace_file_versions")
            .select("delta_from_prev")
            .eq("workspace_file_id", file_id)
            .eq("version", to_version)
            .maybe_single()
        )
        ver_row = ver_resp.data if ver_resp is not None else None
        if ver_row and ver_row.get("delta_from_prev"):
            delta = ver_row["delta_from_prev"]
            # Defensive: rows written before the 087-08 double-encoding fix stored
            # delta_from_prev as a JSON *string* (jsonb_typeof 'string'); PostgREST
            # returns those as str. Decode so delta.get(...) doesn't 500. Matches the
            # sibling guard in workspace_service.get_file_diff.
            if isinstance(delta, str):
                import json

                delta = json.loads(delta)
            return {
                "path": file_row["path"],
                "from_version": from_version,
                "to_version": to_version,
                "delta": delta,
                "stats": delta.get("stats", {}),
            }

    from_resp = await aexec(
        supabase.table("workspace_file_versions")
        .select("content_inline, content_storage_path")
        .eq("workspace_file_id", file_id)
        .eq("version", from_version)
        .maybe_single()
    )
    to_resp = await aexec(
        supabase.table("workspace_file_versions")
        .select("content_inline, content_storage_path")
        .eq("workspace_file_id", file_id)
        .eq("version", to_version)
        .maybe_single()
    )

    from_row = from_resp.data if from_resp is not None else None
    to_row = to_resp.data if to_resp is not None else None

    if not from_row or not to_row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Version {from_version if not from_row else to_version} not found",
        )

    from app.services.workspace_service import compute_diff

    old_text = _decode_inline_content(from_row.get("content_inline"))
    new_text = _decode_inline_content(to_row.get("content_inline"))
    delta = compute_diff(old_text, new_text, f"v{from_version}", f"v{to_version}")

    return {
        "path": file_row["path"],
        "from_version": from_version,
        "to_version": to_version,
        "delta": delta,
        "stats": delta["stats"],
    }
