"""REST API endpoints for workspace file management (Phase 084, D-08).

Cold-path reads for the panel UI (Phase 087) and dev testing via curl.
All queries go through supabase-py with RLS enforcement (FK-chain policies
on workspace_files ensure users can only access files in their own threads).
"""
from __future__ import annotations

import base64
import io
import logging
import zipfile
from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from starlette.concurrency import run_in_threadpool
from supabase import Client

from app.dependencies import get_current_user, get_pg_pool, get_supabase
from app.models.user_settings import load_app_settings_async
from app.services.workspace_service import (
    FileTooLargeError,
    WorkspaceError,
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
    rejects an arbitrary (non-Office) ZIP. Returns the canonical extension;
    raises HTTPException(422) on any failure (nothing is persisted).
    """
    ext = "." + filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext not in _ALLOWED_EXT:
        raise HTTPException(422, f"Unsupported type {ext}. Allowed: .docx, .pptx, .xlsx")
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
    raw = await file.read()
    if len(raw) == 0:
        raise HTTPException(422, "File is empty")
    if len(raw) > 10 * 1024 * 1024:
        raise HTTPException(422, "File too large. Maximum size is 10 MB.")
    ext = validate_ooxml(file.filename or "", raw)  # D-12 magic-byte gate
    ttl_hours = (await load_app_settings_async()).template_ttl_hours  # D-05
    expires_at = datetime.now(timezone.utc) + timedelta(hours=ttl_hours)
    safe_name = (file.filename or f"template{ext}").replace("/", "_").replace("\\", "_")
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
