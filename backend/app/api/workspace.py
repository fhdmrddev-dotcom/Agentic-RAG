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

from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, Response, UploadFile, status
from starlette.concurrency import run_in_threadpool
from supabase import Client

from app.db.workspace import get_file_by_id
# Phase 163 (D-02/D-03): the workspace REST reads/writes are request-scoped → the
# RLS-enforced per-request user-JWT client (supabase) + get_user_pg_connection for the
# asyncpg-backed write/read (passed as the duck-typed `pool` into workspace_service /
# db.workspace, which run under SET LOCAL ROLE authenticated). No producer path here.
from app.dependencies import (
    get_active_org_id,
    get_current_user,
    get_user_pg_connection,
    get_user_supabase_client,
)
from app.models.user_settings import load_app_settings_async
# Phase 244 (SHELL-04 / D-244-05) — the composer's cloud door lands HERE, not in the Library.
from app.models.workspace import WorkspaceConnectionAttachRequest
from app.security.egress import EgressResponseTooLarge
from app.services import connector_service
from app.services.sources.base import SourceConnectionDisabled
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

# Phase 151 (FILE-01 / SC#3, D-09) — the allowlist widened beyond OOXML so a user
# can hand the agent real skill assets mid-chat. Three categories, three gates:
_OOXML_EXT = {".docx", ".pptx", ".xlsx"}
# Text-ish skill assets — validated as utf-8-decodable + NUL-free (D-09).
_TEXT_EXT = {".md", ".json", ".csv", ".txt", ".py", ".js", ".sh"}
# Images — validated by leading magic bytes (D-09).
_IMAGE_EXT = {".png", ".jpg", ".jpeg", ".gif", ".webp"}
# Phase 244 (SHELL-04 / D-244-24) — PDF, validated by leading magic bytes (%PDF-).
# Its OWN category on purpose: a PDF is a NUL-bearing binary, so `_TEXT_EXT` would refuse it at
# `_looks_like_text`, and a bare add to `_ALLOWED_EXT` would fall through all three category
# branches to the belt-and-braces 422 at the bottom of validate_upload.
_PDF_EXT = {".pdf"}
# The full set the door accepts. ⭐ Phase 244: the lockstep with the frontend's accept= is now a
# MECHANISM, not this comment — `frontend/src/lib/workspaceAllowedExt.ts` is the single frontend
# source and `src/lib/__tests__/workspaceAllowedExt.lockstep.test.ts` parses these four set
# literals out of this file and asserts set equality against it.
_ALLOWED_EXT = _OOXML_EXT | _TEXT_EXT | _IMAGE_EXT | _PDF_EXT
# OOXML part-name prefix that distinguishes the three OOXML types (defense-in-depth).
_OOXML_MARKER = {".docx": "word/", ".pptx": "ppt/", ".xlsx": "xl/"}


def _validate_ooxml_container(ext: str, raw: bytes) -> None:
    """The strict OOXML magic-byte gate (verbatim from the pre-151 ``validate_ooxml``).

    OOXML files are ZIP (PK) containers. ``zipfile.is_zipfile`` validates the
    End-of-Central-Directory record — so a renamed binary / truncated file /
    non-ZIP PDF fails even though a 4-byte sniff would pass. A per-extension
    part-name marker (``word/`` / ``ppt/`` / ``xl/``) plus ``[Content_Types].xml``
    rejects an arbitrary (non-Office) ZIP. Raises HTTPException(422) on failure.
    """
    bio = io.BytesIO(raw)
    if not zipfile.is_zipfile(bio):
        raise HTTPException(422, "File is not a valid Office document (not a ZIP/OOXML container)")
    with zipfile.ZipFile(bio) as zf:
        names = zf.namelist()
        if "[Content_Types].xml" not in names:
            raise HTTPException(422, "File is not a valid OOXML document")
        if not any(n.startswith(_OOXML_MARKER[ext]) for n in names):
            raise HTTPException(422, f"File contents do not match a {ext} document")


def _looks_like_text(raw: bytes) -> bool:
    """True when ``raw`` is a plausible utf-8 text payload (NUL-free, decodable).

    A renamed binary (embedded NUL bytes / invalid utf-8 sequences) fails this
    check, so the magic-byte gate survives the D-09 widen for text-ish types
    (T-151-03-01). Called only after the size guard, so the decode is bounded.
    """
    if b"\x00" in raw:
        return False
    try:
        raw.decode("utf-8")
    except UnicodeDecodeError:
        return False
    return True


def _image_magic_ok(ext: str, raw: bytes) -> bool:
    """Verify an image payload's leading magic bytes match its extension (D-09)."""
    if ext == ".png":
        return raw[:4] == b"\x89PNG"
    if ext in (".jpg", ".jpeg"):
        return raw[:3] == b"\xff\xd8\xff"
    if ext == ".gif":
        return raw[:4] == b"GIF8"  # GIF87a and GIF89a both start GIF8
    if ext == ".webp":
        return raw[:4] == b"RIFF" and raw[8:12] == b"WEBP"
    return False


def _pdf_magic_ok(raw: bytes) -> bool:
    """Verify a PDF payload's leading magic bytes (Phase 244, D-244-24).

    Mirrors ``_image_magic_ok``'s shape. Every PDF begins with the five-byte header
    ``%PDF-`` followed by its version (``%PDF-1.7``, ``%PDF-2.0``). A renamed ``.exe`` /
    ``.zip`` / arbitrary blob fails, so the extension alone never admits a payload
    (T-244-02-01). Deliberately NOT a full container parse: the bytes are never handed to a
    PDF library by this door — they are stored and later read by the agent inside the
    sandbox — so the check that matters here is "this is not something else wearing a
    ``.pdf`` name".
    """
    return raw[:5] == b"%PDF-"


def validate_upload(filename: str, raw: bytes) -> str:
    """Magic-byte / content gate for the widened skill-asset allowlist (D-09, stdlib only).

    Generalizes the Phase-100 OOXML-only ``validate_ooxml``: keeps the strict
    ZIP/OOXML branch for ``.docx/.pptx/.xlsx`` and ADDS per-category branches for
    text-ish assets (``.md/.json/.csv/.txt/.py/.js/.sh`` — utf-8-decodable + NUL
    reject) and images (``.png/.jpg/.jpeg/.gif/.webp`` — leading magic bytes).

    Phase 244 (SHELL-04 / D-244-24) adds a FOURTH category, ``.pdf`` (``%PDF-`` magic
    bytes). It is ruled in rather than discovered: sketch 236 measured that a signed
    contract PDF is the likeliest first thing anyone attaches to a chat, and the same
    phase gives ``execute_code`` reach to these bytes at ``/sandbox/attachments/`` where
    ``pypdf`` already ships in the sandbox image — so a ``.pdf`` is genuinely USABLE, not
    merely accepted.

    The ``len(raw) > MAX_FILE_SIZE`` DoS/office-bomb guard trips BEFORE any parse
    for EVERY type (T-151-03-02) — the route also pre-checks the declared part
    size before buffering (WR-04). Returns the canonical extension; raises
    HTTPException(422) on any failure (nothing is persisted). Files that pass are
    stamped ``kind='template_input'`` by the route (untrusted provenance) and are
    NEVER routed to the docxtpl Jinja engine (T-151-03-03).
    """
    ext = "." + filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext not in _ALLOWED_EXT:
        raise HTTPException(
            422, f"Unsupported type {ext or '(none)'}. Allowed: {', '.join(sorted(_ALLOWED_EXT))}"
        )
    # DoS/office-bomb guard FIRST — before any decode/parse of the body (T-151-03-02).
    if len(raw) > MAX_FILE_SIZE:
        raise HTTPException(422, "File too large. Maximum size is 10 MB.")
    if ext in _OOXML_EXT:
        _validate_ooxml_container(ext, raw)
        return ext
    if ext in _TEXT_EXT:
        if not _looks_like_text(raw):
            raise HTTPException(422, f"File does not look like valid text for a {ext} upload")
        return ext
    if ext in _IMAGE_EXT:
        if not _image_magic_ok(ext, raw):
            raise HTTPException(422, f"File contents do not match a {ext} image")
        return ext
    # Phase 244 (SHELL-04 / D-244-24) — the FOURTH category. Same voice as the image branch.
    if ext in _PDF_EXT:
        if not _pdf_magic_ok(raw):
            raise HTTPException(422, f"File contents do not match a {ext} document")
        return ext
    # Unreachable (ext already gated against _ALLOWED_EXT); belt-and-braces.
    raise HTTPException(422, f"Unsupported type {ext}")


# Backward-compat alias: Phase-100 tests (test_workspace_template.py) and any
# external caller import ``validate_ooxml``. ``validate_upload`` is a strict
# superset for the three OOXML types (same return + 422 semantics), so the alias
# is behavior-preserving. Mirrors the ``upload_workspace_template`` alias below.
validate_ooxml = validate_upload


@router.post("/files")
async def upload_template(
    thread_id: str,
    request: Request,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_user_supabase_client),
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
    return await _persist_workspace_upload(
        thread_id=thread_id,
        request=request,
        current_user=current_user,
        supabase=supabase,
        filename=file.filename or "",
        raw=raw,
    )


async def _persist_workspace_upload(
    *,
    thread_id: str,
    request: Request,
    current_user: dict,
    supabase: Client,
    filename: str,
    raw: bytes,
) -> dict:
    """The ONE writer of an ephemeral ``kind='template_input'`` workspace file.

    ⭐ Phase 244 (SHELL-04 / D-244-05) extracted this from ``upload_template`` so the CLOUD
    door (``attach_connection_file`` below) cannot drift from the LOCAL one on validation, on
    the TTL or on filename sanitisation. ⛔ Two writers is how a second door quietly grows a
    laxer gate; there is one, and both routes call it. Behaviour is byte-identical to the
    Phase-100 inline version — the caller still owns the pre-read ``file.size`` short-circuit,
    because only a multipart part declares a size before it is materialised (WR-04).
    """
    if len(raw) == 0:
        raise HTTPException(422, "File is empty")
    if len(raw) > MAX_FILE_SIZE:
        raise HTTPException(422, "File too large. Maximum size is 10 MB.")
    ext = validate_upload(filename, raw)  # D-12/D-09 magic-byte + content gate
    ttl_hours = (await load_app_settings_async()).template_ttl_hours  # D-05
    expires_at = datetime.now(timezone.utc) + timedelta(hours=ttl_hours)
    # WR-05 (100-REVIEW): sanitize the ORIGINAL filename to validate_path's charset
    # (^/[a-zA-Z0-9._/\- ]+$, no '..') so ordinary names — "Q3 Report (final).docx",
    # "P&L 2026.xlsx", "Übersicht.docx", "report..v2.docx" — don't surface a
    # confusing "invalid path characters" 422 to a user who never typed a path.
    # ⚠ Phase 244: a CLOUD provider's filename is equally untrusted, and lands here too.
    stem = filename or f"template{ext}"
    safe_name = re.sub(r"[^a-zA-Z0-9._\- ]", "_", stem)
    safe_name = re.sub(r"\.{2,}", ".", safe_name).strip() or f"template{ext}"
    path = f"/{uuid4().hex[:8]}-{safe_name}"
    try:
        # Phase 163 (D-02): the template write runs under RLS on the per-request
        # user-JWT connection (SET LOCAL ROLE authenticated). `conn` is passed as the
        # duck-typed "pool" into ws_write_file — the whole upsert+version write is one
        # RLS-scoped transaction. The AGENT workspace_write path keeps ctx.pool (D-05).
        async with get_user_pg_connection(request, current_user) as conn:
            result = await ws_write_file(
                conn,
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


@router.post("/files/from-connection")
async def attach_connection_file(
    thread_id: str,
    request: Request,
    body: WorkspaceConnectionAttachRequest,
    active_org: str = Depends(get_active_org_id),
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_user_supabase_client),
):
    """Attach ONE connected-cloud file to THIS THREAD (Phase 244 / SHELL-04 / D-244-05).

    ⛔ **THIS ROUTE MINTS NO ``documents`` ROW.** It is the un-inversion of `BUG-260905-01`:
    the composer's cloud door used to call the LIBRARY's single-file import, so a file picked
    mid-chat was written permanently into the Library root. The bytes now land in
    ``workspace_files`` under the same 24h TTL read gate as a local attach, and both composer
    doors mean the same thing — *this conversation* (D-244-05).

    ⭐ It lives HERE, not in ``connectors.py``, and the placement is the guarantee: this module
    imports neither ``import_single_file`` nor ``ingest_splice``, so *"the chat writes nothing
    to the KB"* is structural rather than a promise a future edit can quietly break.

    The provider's bytes are untrusted and go through the SAME ``_persist_workspace_upload``
    the local door uses — ``validate_upload``'s magic-byte / container gate, the 10 MB cap and
    the filename sanitiser. ⛔ No second, laxer gate for "our own" cloud.
    """
    from app.services.sources.import_service import fetch_cloud_file

    await _verify_thread_ownership(thread_id, current_user, supabase)  # 404 on non-owner

    conn = await connector_service.get_connection(
        connection_id=str(body.connection_id),
        org_id=str(active_org),
        supabase=supabase,
    )
    if not conn:
        # D-062-12: absence, not refusal — a 403 would confirm the id names a real row.
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Connection not found")

    try:
        # ⛔ 244-08 (T-244-06-07 / OPEN-3) — THE CAP GOES IN, IT IS NOT MEASURED ON THE WAY OUT.
        #
        # This call used to pass no bound at all, and `_persist_workspace_upload` then applied
        # `len(raw) > MAX_FILE_SIZE` — a refusal issued AFTER the whole body was resident in a
        # worker. The declared mitigation for this route reads *"the workspace cap is enforced
        # before body materialisation"*, and it was not.
        #
        # ⚠ THE AUDIT'S "MULTI-GB" FRAMING WAS OVERSTATED AND THE CORRECTION IS RECORDED HERE
        # RATHER THAN QUIETLY DROPPED: `send_pinned_http` already refused a declared over-cap
        # `content-length` before reading a byte and abandoned the wire read past `max_bytes`,
        # and both first-party adapters already passed `source_max_file_bytes()`. So residency
        # was bounded by the SOURCE ceiling (1-50 MB, default 25), not unbounded — a real gap
        # of 2.5-5x the declared 10 MB cap. Fixed for its actual size.
        #
        # ⚠ A caller can only TIGHTEN: `clamp_read_cap` mins this against the operator ceiling.
        filename, raw, _mime = await fetch_cloud_file(conn, body.file_id, max_bytes=MAX_FILE_SIZE)
    # ⚠ BEFORE the broad handler below, exactly as `connectors.py`'s import route orders them
    # (BUG-260907-03): a disabled connection is not a provider error, and wording it that way
    # is how a control that failed to stop something reads as the provider's fault.
    except SourceConnectionDisabled as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"reason_code": "connection_disabled", "message": str(exc)},
        ) from None
    except HTTPException:
        raise
    # ⛔ OUR OWN SIZE REFUSAL IS NOT THE PROVIDER'S FAULT (244-08). The cap above is enforced
    # by the transport, which signals it as `EgressResponseTooLarge`; swallowed by the broad
    # handler below it became `502 Failed to download cloud file`, telling a person their
    # Drive is broken when their file is simply too big. Same rule `T-244-06-04` closed on,
    # applied to the guard this round added — and it answers the SAME 422 sentence the local
    # door does, because the two doors must not word one refusal two ways.
    except EgressResponseTooLarge:
        raise HTTPException(422, "File too large. Maximum size is 10 MB.") from None
    except Exception as exc:
        logger.error(
            "Failed to fetch file %s from connection %s: %s", body.file_id, body.connection_id, exc
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to download cloud file: {exc}",
        )

    return await _persist_workspace_upload(
        thread_id=thread_id,
        request=request,
        current_user=current_user,
        supabase=supabase,
        filename=filename,
        raw=raw,
    )


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
    supabase: Client = Depends(get_user_supabase_client),
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
    supabase: Client = Depends(get_user_supabase_client),
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
    request: Request,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_user_supabase_client),
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

    # 101.1 review WR-06: a malformed file_id (typo / crafted URL) must 404 like
    # every sibling route (which passes the string to PostgREST and degrades to
    # 404/empty) — never 500 on an unhandled ValueError from UUID().
    try:
        fid = UUID(file_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")

    # Phase 163 (D-02): the file-row read + content read run under RLS on the
    # per-request user-JWT connection (conn passed as the duck-typed workspace "pool").
    async with get_user_pg_connection(request, current_user) as conn:
        row = await get_file_by_id(conn, fid)
        # Collapse missing / cross-thread / expired ALL to 404 (no existence leak).
        if (
            not row
            or str(row.get("thread_id")) != thread_id
            or row.get("is_expired")
        ):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")

        try:
            content_bytes = await _get_file_content(conn, supabase, row)
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
    supabase: Client = Depends(get_user_supabase_client),
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
    supabase: Client = Depends(get_user_supabase_client),
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
