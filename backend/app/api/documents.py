import asyncio
import csv
import hashlib
import io
import logging
import os
import time
import zipfile
from datetime import datetime, timezone
from typing import Literal
from uuid import uuid4

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, Query, Response, UploadFile, status
from pydantic import BaseModel
from starlette.concurrency import run_in_threadpool
from supabase import Client

from app.dependencies import get_current_user, get_supabase
from app.models.document import DocumentMetadata, DocumentMoveRequest, DocumentResponse
from app.models.user_settings import load_app_settings
from app.services.audit_service import write_audit_entry
from app.services.embedding_service import chunk_text, embed_chunks, extract_metadata, read_enabled_field_defs
from app.services.extraction_service import ExtractedDocument
from app.utils.folder_utils import get_globally_visible_folder_ids


def _parse_engines_hint(s: str | None) -> dict[str, str] | None:
    """Phase 071.2 D-071.2-03 — parse `?engines=` query param into composer engines dict.

    Format: 'text:docling,tables:docling_tf,images:pymupdf_full,equations:docling_formula'
    (comma-separated key:value; key from {text, tables, images, equations}; value is
    the engine name registered in the corresponding registry).

    Returns None when:
      - s is None or empty
      - app_settings.extraction_per_call_hints_enabled is False (admin disable)

    Unknown keys are silently dropped (defense in depth — composer raises
    KeyError on unknown engine names, so we cleanly drop bad input rather
    than leaking parser errors into the response).
    """
    if not s:
        return None
    from app.models.user_settings import load_app_settings  # noqa: PLC0415
    if not load_app_settings().extraction_per_call_hints_enabled:
        return None
    out: dict[str, str] = {}
    for pair in s.split(","):
        if ":" not in pair:
            continue
        k, v = pair.split(":", 1)
        k, v = k.strip(), v.strip()
        if k in ("text", "tables", "images", "equations") and v:
            out[k] = v
    return out or None

log = logging.getLogger(__name__)


class ReextractRequest(BaseModel):
    """POST /documents/{id}/reextract body schema (Phase 071 D-071-09).

    `engine` is REQUIRED — distinct from /reingest which uses the global default.
    Invalid values produce FastAPI auto-422 via Pydantic Literal validation
    (T-071-04-02 mitigation — invalid engine cannot crash downstream get_extractor).

    Phase 071.3 Plan 04 (D-071.3-09): 'docling' removed from the Literal —
    Docling adapters were hard-deleted; submitting 'docling' now returns 422.
    """

    engine: Literal["pymupdf", "legacy"]


class MetadataUpdateRequest(BaseModel):
    """PATCH /documents/{id}/metadata body schema (Phase 112 META-05, D-03).

    Single-field edit (D-03 contract). `value` is polymorphic — a built-in field
    is a string/date/list[str] and a custom field follows its def's type
    (string/date/number/boolean/enum) — so we accept any JSON value and let the
    VALIDATED `field` (allow-list checked in the route) constrain the shape
    (RESEARCH Open Question 1). The route NEVER reads a client-supplied `source`:
    there is deliberately no `source` field here — provenance is server-stamped.
    """

    field: str
    value: object | None = None


router = APIRouter(prefix="/documents", tags=["documents"])

ALLOWED_MIME_TYPES = {
    "text/plain",
    "text/markdown",
    "text/html",
    "text/csv",
    "application/csv",
    "application/pdf",
    "application/epub+zip",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
}

# Extension → canonical MIME type for formats browsers misreport
_EXT_MIME_OVERRIDES: dict[str, str] = {
    ".md":   "text/markdown",
    ".csv":  "text/csv",
    ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".epub": "application/epub+zip",
}


def _write_extraction_run_row(
    supabase: Client,
    document_id: str,
    user_id: str,
    engine: str,
    duration_ms: int,
    table_count: int,
    image_count: int,
    error: str | None,
) -> None:
    """Inline writer for `pdf_extraction_runs` from the /reextract fallback path
    (Phase 071.1 D-071.1-04).

    The happy-path writer lives inline in `ingest_document`; this helper is used
    ONLY by the /reextract route's exception handler when fallback fires.

    Telemetry-write failures are swallowed (T-071-02-07 pattern) — a telemetry
    hiccup must NOT block the user's extraction outcome.
    """
    try:
        supabase.table("pdf_extraction_runs").insert({
            "document_id": document_id,
            "user_id": user_id,
            "engine": engine,
            "started_at": datetime.now(timezone.utc).isoformat(),
            "duration_ms": duration_ms,
            "table_count": table_count,
            "image_count": image_count,
            "error": error[:1000] if error else None,
        }).execute()
    except Exception as exc:
        log.warning(
            "pdf_extraction_runs INSERT failed (engine=%s, doc=%s, from /reextract fallback): %s",
            engine, document_id, exc,
        )


def _upload_pipeline(
    document_id: str,
    raw: bytes,
    mime_type: str,
    filename: str,
    user_id: str,
    storage_path: str,
    supabase: Client,
    engines_dict: dict[str, str] | None = None,
) -> None:
    """Phase 071.2 D-071.2-05 — runs in BackgroundTask after /upload (or
    /reingest) returns 201/200.

    Steps:
      1. Storage upload (sync supabase call; ok inside BackgroundTask task body —
         not an async handler, so supabase-py runs on the BackgroundTask thread
         pool without blocking the event loop). Skipped if `storage_path` is
         empty / None (reingest path — file already in storage).
      2. Layer 2 wall-clock-wrapped extract via the per-aspect composer
         (`extract_composable`, Phase 071.2 D-071.2-01..04). When
         `engines_dict` is None, the composer reads defaults from
         `app_settings.extraction_*_engine_*`.
      3. Call existing ingest_document(document_id, text, user_id, supabase, raw,
         mime_type, filename, None, extracted_doc, extract_duration_ms) — keep
         signature byte-identical (Pitfall 2 — 071.1 tests stay green).
      4. On any unhandled exception: UPDATE documents SET status='failed',
         error_message=<short summary> (T-071.2-01-01 mitigation — don't echo
         supabase-py internals into error_message).
    """
    from app.services.extraction_service import extract_composable, get_extractor  # noqa: PLC0415

    # Step 1 — storage upload (only on the /upload path; /reingest path passes
    # an empty `storage_path` to signal "file already in storage, skip upload").
    if storage_path:
        try:
            supabase.storage.from_("documents").upload(
                path=storage_path,
                file=raw,
                file_options={"content-type": mime_type},
            )
        except Exception:
            # Storage upload failure doesn't block ingestion — same swallow shape
            # as the pre-071.2 inline call site at documents.py:330-331.
            pass

    # Step 2 — extract via the per-aspect composer with a wall-clock fail-safe.
    # Phase 071.3 Plan 04 (D-071.3-09): Docling auto-fallback path removed
    # entirely — non-timeout exceptions fail loud (status='failed' +
    # error_message); D-071-11 visibility intent preserved.
    extract_start = time.perf_counter()
    extracted_doc: ExtractedDocument | None = None
    engine_used: str | None = None
    text: str = ""

    # Wall-clock fail-safe for the per-aspect composer. Post-Docling-rip
    # (Phase 071.3 Plan 04 D-071.3-09), the only remaining heavy engines are
    # camelot tables + pymupdf fence subprocess; 130s upper bound matches the
    # legacy Layer 2 ceiling so behavior is unchanged for non-Docling stalls.
    wall_clock_s = 130.0

    try:
        # Phase 071.2 D-071.2-01..04 — route PDF/DOCX through the per-aspect
        # composer. Non-PDF/non-DOCX MIMEs still flow through the legacy
        # `extract_text` helper (composer is PDF/DOCX-only).
        from app.services.extraction_service import PDF_MIME as _PDF, DOCX_MIME as _DOCX  # noqa: PLC0415
        if mime_type not in (_PDF, _DOCX):
            text = extract_text(raw, mime_type)
        else:
            # We are inside a BackgroundTask thread (not an async handler), so
            # asyncio.wait_for is not directly usable. Use a small asyncio.run
            # bridge so the Layer 2 wall-clock pattern still applies. Mirrors
            # the /reextract Layer 2 shape (071.1 SP-2) but in sync context.
            # NOTE: extract_composable is sync; running inside BackgroundTask
            # thread, so no run_in_threadpool needed (test_071_1_threadpool_sweep
            # exempts _upload_pipeline because it's a sync def).
            async def _run_with_timeout() -> ExtractedDocument:
                from starlette.concurrency import run_in_threadpool  # noqa: PLC0415
                return await asyncio.wait_for(
                    run_in_threadpool(extract_composable, raw, mime_type, engines_dict),
                    timeout=wall_clock_s,
                )

            extracted_doc = asyncio.run(_run_with_timeout())
            text = extracted_doc.text
            engine_used = extracted_doc.extractor_name or None
    except Exception as exc:
        # Step 4 — surface a user-safe failure on the documents row + log full
        # detail server-side (T-071.2-01-01 mitigation).
        log.warning(
            "upload_pipeline failed for %s: %s",
            document_id,
            exc,
        )
        try:
            supabase.table("documents").update({
                "status": "failed",
                "error_message": str(exc)[:500],
            }).eq("id", document_id).execute()
        except Exception:
            pass  # don't double-fault on telemetry write failure
        return

    extract_duration_ms = int((time.perf_counter() - extract_start) * 1000)

    # Step 3 — hand off to the existing ingest_document (signature byte-identical).
    ingest_document(
        document_id,
        text,
        user_id,
        supabase,
        raw,
        mime_type,
        filename,
        engine_used,        # engine_override — extractor_name from composer or None for default
        extracted_doc,
        extract_duration_ms,
    )


def extract_text(raw: bytes, mime_type: str) -> str:
    """Extract text from non-PDF/non-DOCX MIME types.

    Phase 069: PDF + DOCX flow through `app.services.extraction_service.get_extractor()`
    instead of this function. The other 7 MIME types (PPTX, XLSX, CSV, EPUB, plain text,
    markdown, HTML) remain here per D-069-02 (no engine swap planned for them).
    """
    if mime_type == "application/vnd.openxmlformats-officedocument.presentationml.presentation":
        from pptx import Presentation  # noqa: PLC0415
        prs = Presentation(io.BytesIO(raw))
        lines: list[str] = []
        for slide_num, slide in enumerate(prs.slides, 1):
            slide_lines = [f"## Slide {slide_num}"]
            for shape in slide.shapes:
                if not shape.has_text_frame:
                    continue
                for para in shape.text_frame.paragraphs:
                    text = para.text.strip()
                    if text:
                        slide_lines.append(text)
            if len(slide_lines) > 1:  # skip blank slides
                lines.append("\n".join(slide_lines))
        return "\n\n".join(lines)

    if mime_type in (
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.ms-excel",
    ):
        from openpyxl import load_workbook  # noqa: PLC0415
        wb = load_workbook(io.BytesIO(raw), read_only=True, data_only=True)
        sheets: list[str] = []
        for sheet in wb.worksheets:
            rows: list[str] = [f"## Sheet: {sheet.title}"]
            for row in sheet.iter_rows(values_only=True):
                cells = [str(c) if c is not None else "" for c in row]
                if any(cells):
                    rows.append("\t".join(cells))
            if len(rows) > 1:
                sheets.append("\n".join(rows))
        return "\n\n".join(sheets)

    if mime_type in ("text/csv", "application/csv"):
        text = raw.decode("utf-8-sig")  # strip BOM if present
        reader = csv.reader(io.StringIO(text))
        return "\n".join("\t".join(row) for row in reader)

    if mime_type == "application/epub+zip":
        import ebooklib  # noqa: PLC0415
        from ebooklib import epub
        from html.parser import HTMLParser

        class _StripHTML(HTMLParser):
            def __init__(self) -> None:
                super().__init__()
                self._chunks: list[str] = []
            def handle_data(self, data: str) -> None:
                self._chunks.append(data)
            def get_text(self) -> str:
                return "".join(self._chunks)

        # ebooklib requires a file path — write to a temp file
        import tempfile, os  # noqa: PLC0415
        with tempfile.NamedTemporaryFile(suffix=".epub", delete=False) as tmp:
            tmp.write(raw)
            tmp_path = tmp.name
        try:
            book = epub.read_epub(tmp_path)
        finally:
            os.unlink(tmp_path)

        chapters: list[str] = []
        for item in book.get_items_of_type(ebooklib.ITEM_DOCUMENT):
            parser = _StripHTML()
            parser.feed(item.get_content().decode("utf-8", errors="ignore"))
            text = parser.get_text().strip()
            if text:
                chapters.append(text)
        return "\n\n".join(chapters)

    # plain text, markdown, html — decode as UTF-8
    return raw.decode("utf-8")


@router.post("/upload", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(
    response: Response,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    folder_id: str | None = Form(None),
    engines: str | None = Query(
        default=None,
        description=(
            "Phase 071.2 D-071.2-03 — per-call extraction engine override hint. "
            "Format: 'text:docling,tables:docling_tf,images:pymupdf_full,equations:docling_formula'. "
            "Subject to app_settings.extraction_per_call_hints_enabled flag."
        ),
    ),
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    # Normalize mime type (strip charset suffix)
    mime_type = (file.content_type or "").split(";")[0].strip()

    # Browsers / OS often misreport MIME types for these formats — normalise by extension
    filename = file.filename or ""
    ext = "." + filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if mime_type in ("text/plain", "application/octet-stream", "application/zip") and ext in _EXT_MIME_OVERRIDES:
        mime_type = _EXT_MIME_OVERRIDES[ext]

    if mime_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Unsupported file type: {mime_type}. Allowed: PDF, DOCX, Markdown, plain text.",
        )

    raw = await file.read()
    MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB
    if len(raw) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="File too large. Maximum size is 50 MB.",
        )
    if len(raw) == 0:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="File is empty",
        )

    # Validate folder ownership: only the folder owner may upload into it.
    # Phase 071.2 D-071.2-06: wrap sync supabase call in run_in_threadpool
    # (mirrors /reextract 618-626 lambda-wrap shape).
    if folder_id:
        folder_check = await run_in_threadpool(
            lambda: supabase.table("folders")
            .select("id, user_id")
            .eq("id", folder_id)
            .maybe_single()
            .execute()
        )
        if not folder_check.data:
            raise HTTPException(status_code=404, detail="Folder not found")
        if folder_check.data["user_id"] != current_user["id"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cannot upload to a folder you do not own",
            )

    content_hash = hashlib.sha256(raw).hexdigest()

    # Case 1: exact duplicate already completed (is_latest=True) in the same folder — skip re-ingestion
    # Dedup only matches the current latest version; stale versions do not short-circuit upload.
    # Duplicate check is folder-scoped: same file in different folders creates separate entries.
    dedup_query = (
        supabase.table("documents")
        .select("*")
        .eq("user_id", current_user["id"])
        .eq("content_hash", content_hash)
        .eq("status", "completed")
        .eq("is_latest", True)
    )
    if folder_id:
        dedup_query = dedup_query.eq("folder_id", folder_id)
    else:
        dedup_query = dedup_query.is_("folder_id", "null")
    # Phase 071.2 D-071.2-06: wrap dedup .execute() in run_in_threadpool.
    existing = await run_in_threadpool(lambda: dedup_query.limit(1).execute())
    if existing.data:
        response.status_code = status.HTTP_200_OK
        return existing.data[0]

    # Case 2: same filename → create new version instead of deleting stale document.
    # Old files are retained in storage for future restore (Phase 29).
    # Phase 071.2 D-071.2-06: wrap existing-versions SELECT in run_in_threadpool.
    existing_versions = await run_in_threadpool(
        lambda: supabase.table("documents")
        .select("id, version_number")
        .eq("user_id", current_user["id"])
        .eq("filename", file.filename)
        .order("version_number", desc=True)
        .limit(1)
        .execute()
    )
    if existing_versions.data:
        next_version = existing_versions.data[0]["version_number"] + 1
        # Retire all previous versions from retrieval (user-scoped, not folder-scoped).
        # Phase 071.2 D-071.2-06: wrap is_latest=False UPDATE cascade in run_in_threadpool.
        await run_in_threadpool(
            lambda: supabase.table("documents")
            .update({"is_latest": False})
            .eq("user_id", current_user["id"])
            .eq("filename", file.filename)
            .execute()
        )
    else:
        next_version = 1

    # Phase 071.2 D-071.2-05 — instant-201 BackgroundTask refactor.
    # INSERT documents row with status='pending' FIRST so Supabase Realtime broadcasts
    # the new row to the frontend immediately. Extract + chunk + multimodal moved into
    # `_upload_pipeline` BackgroundTask (closes "/upload blocks 1-120s before 201" UX
    # defect surfaced during Phase 072 discuss-phase setup).
    document_id = str(uuid4())
    storage_path = f"{current_user['id']}/{document_id}/{file.filename}"

    doc_data = {
        "id": document_id,
        "user_id": current_user["id"],
        "filename": file.filename,
        "file_path": storage_path,
        "file_size": len(raw),
        "mime_type": mime_type,
        "status": "pending",
        "content_hash": content_hash,
        "folder_id": folder_id,
        "version_number": next_version,
        "is_latest": True,
    }
    # Phase 078 CQ-DEDUP-01 D-078-04: catch unique-violation race at INSERT time.
    # The fast-path SELECT above handles the common case; this catches the narrow
    # race window where two concurrent uploads pass the SELECT simultaneously.
    try:
        result = await run_in_threadpool(
            lambda: supabase.table("documents").insert(doc_data).execute()
        )
        doc = result.data[0]
    except Exception as exc:
        # Detect PostgreSQL unique_violation (code 23505) from the partial index.
        # supabase-py surfaces this as an APIError whose message contains "23505".
        exc_str = str(exc)
        if "23505" in exc_str:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="File already exists in this folder",
            )
        raise

    # Phase 071.2 D-071.2-05 — schedule heavy work as BackgroundTask. The handler
    # returns 201 within ~1s; _upload_pipeline does storage upload + Layer 2
    # wall-clock-wrapped extract + ingest_document inside the BackgroundTask
    # thread (not the async handler), so the event loop stays unblocked.
    # Phase 071.2 D-071.2-03 — parse `?engines=` hint (admin-disable aware).
    engines_dict = _parse_engines_hint(engines)
    background_tasks.add_task(
        _upload_pipeline,
        doc["id"],
        raw,
        mime_type,
        file.filename,
        current_user["id"],
        storage_path,
        supabase,
        engines_dict,
    )
    background_tasks.add_task(
        write_audit_entry,
        user_id=current_user["id"],
        action_type="document.upload",
        metadata={"document_id": doc["id"], "filename": doc["filename"], "folder_id": folder_id},
        supabase=supabase,
    )

    return doc


@router.get("", response_model=list[DocumentResponse])
async def list_documents(
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    # Own documents — only show latest versions (VER-03)
    own_result = (
        supabase.table("documents")
        .select("*")
        .eq("user_id", current_user["id"])
        .eq("is_latest", True)
        .execute()
    )
    own_docs = own_result.data or []

    # Documents in globally visible folders (not owned by current user)
    global_folder_ids = await get_globally_visible_folder_ids(supabase, current_user["id"])
    global_docs = []
    if global_folder_ids:
        global_result = (
            supabase.table("documents")
            .select("*")
            .in_("folder_id", global_folder_ids)
            .eq("is_latest", True)
            .execute()
        )
        global_docs = global_result.data or []

    # Merge, deduplicate by id, sort by created_at desc
    seen: set[str] = set()
    merged: list[dict] = []
    for doc in own_docs + global_docs:
        if doc["id"] not in seen:
            seen.add(doc["id"])
            merged.append(doc)
    merged.sort(key=lambda d: d["created_at"], reverse=True)

    # D-09: aggregate table_count / image_count from document_tables and document_images
    # Pitfall 4: supabase-py has no native GROUP BY — fetch document_id rows, count in Python
    if merged:
        from collections import Counter  # noqa: PLC0415
        doc_ids = [d["id"] for d in merged]
        table_rows_res = (
            supabase.table("document_tables")
            .select("document_id")
            .in_("document_id", doc_ids)
            .execute()
        )
        image_rows_res = (
            supabase.table("document_images")
            .select("document_id")
            .in_("document_id", doc_ids)
            .execute()
        )
        tc = Counter(r["document_id"] for r in (table_rows_res.data or []))
        ic = Counter(r["document_id"] for r in (image_rows_res.data or []))
        for doc in merged:
            doc["table_count"] = tc.get(doc["id"], 0)
            doc["image_count"] = ic.get(doc["id"], 0)

    return merged


@router.get("/{document_id}/versions", response_model=list[DocumentResponse])
async def list_document_versions(
    document_id: str,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """Return all versions of a document ordered by version_number descending."""
    # 1. Verify doc exists and user has access
    doc = (
        supabase.table("documents")
        .select("filename, user_id, folder_id")
        .eq("id", document_id)
        .eq("user_id", current_user["id"])
        .maybe_single()
        .execute()
    )
    if not doc.data:
        raise HTTPException(status_code=404, detail="Document not found")
    # 2. Fetch all sibling versions
    result = (
        supabase.table("documents")
        .select("*")
        .eq("user_id", current_user["id"])
        .eq("filename", doc.data["filename"])
        .order("version_number", desc=True)
        .execute()
    )
    return result.data or []


@router.post("/{document_id}/restore", response_model=DocumentResponse)
async def restore_document_version(
    document_id: str,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """Restore a historical document version, making it the current latest."""
    # 1. Validate ownership
    doc = (
        supabase.table("documents")
        .select("*")
        .eq("id", document_id)
        .eq("user_id", current_user["id"])
        .maybe_single()
        .execute()
    )
    if not doc.data:
        raise HTTPException(status_code=404, detail="Document not found")
    target = doc.data
    folder_id = target["folder_id"]
    # 2. Retire all siblings
    siblings_q = (
        supabase.table("documents")
        .update({"is_latest": False})
        .eq("user_id", current_user["id"])
        .eq("filename", target["filename"])
    )
    if folder_id is None:
        siblings_q = siblings_q.is_("folder_id", "null")
    else:
        siblings_q = siblings_q.eq("folder_id", folder_id)
    siblings_q.execute()
    # 3. Promote target
    result = (
        supabase.table("documents")
        .update({"is_latest": True})
        .eq("id", document_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Document not found after restore")
    return result.data[0]


@router.post("/{document_id}/reingest", response_model=DocumentResponse)
async def reingest_document(
    document_id: str,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """Re-queue a document for ingestion by fetching from storage and scheduling
    background extraction.

    Phase 071.2 D-071.2-06 — port of the 071.1 /reextract threadpool sweep:
      1. Owner SELECT wrapped in run_in_threadpool.
      2. Storage download wrapped in run_in_threadpool (bound-method form).
      3. UPDATE status='pending' wrapped in run_in_threadpool.
      4. Extract MOVED into _upload_pipeline BackgroundTask (storage_path=""
         signals "skip storage upload — file already in storage"). Same Layer 2
         wall-clock + PyMuPDF fallback as /upload.
    """
    # 1. Verify ownership and confirm document is the latest version.
    # Phase 071.2 D-071.2-06: wrap owner SELECT in run_in_threadpool (port of
    # /reextract 618-626 pattern verbatim).
    doc = await run_in_threadpool(
        lambda: supabase.table("documents")
        .select("*")
        .eq("id", document_id)
        .eq("user_id", current_user["id"])
        .eq("is_latest", True)
        .maybe_single()
        .execute()
    )
    if not doc.data:
        raise HTTPException(status_code=404, detail="Document not found")

    target = doc.data

    # 2. Fetch raw bytes from storage so we can re-extract text.
    # Phase 071.2 D-071.2-06: wrap storage download in run_in_threadpool
    # (bound-method form — matches /reextract 634-636).
    try:
        raw = await run_in_threadpool(
            supabase.storage.from_("documents").download, target["file_path"]
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Could not retrieve stored file: {e}")

    # 3. Hard delete prior chunks + tables + images so reingest doesn't
    # accumulate (BUG-260516-04 closed /reingest -> /reingest on tables+images;
    # BUG-260517-01 closes /reextract -> /reingest on chunks AND adds chunks
    # to the steady-state cascade). /reextract does this at lines 1034-1042;
    # /reingest now has parity. The prior assumption — "_upload_pipeline
    # handles chunk cleanup downstream" — was wrong: ingest_document only
    # INSERTs chunks (line ~1361), never deletes prior ones, so any chunks
    # left over from a prior /reextract (or prior /reingest) survived.
    # Doc_id-scoped — catches ALL orphan chunks for this doc regardless of
    # which prior op created them. Order mirrors D-071-10 cascade (children
    # before parent).
    await run_in_threadpool(
        lambda: supabase.table("document_chunks").delete().eq("document_id", document_id).execute()
    )
    await run_in_threadpool(
        lambda: supabase.table("document_tables").delete().eq("document_id", document_id).execute()
    )
    await run_in_threadpool(
        lambda: supabase.table("document_images").delete().eq("document_id", document_id).execute()
    )

    # 4. Reset status to pending. Phase 071.2 D-071.2-06: wrap UPDATE in
    # run_in_threadpool. NB — version_number is NOT bumped; this is a
    # re-ingest of the same source bytes (D-25 versioning contract preserved).
    result = await run_in_threadpool(
        lambda: supabase.table("documents")
        .update({"status": "pending"})
        .eq("id", document_id)
        .eq("user_id", current_user["id"])
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Document not found after update")

    # 5. Schedule extract + ingest as BackgroundTask. Phase 071.2 D-071.2-06:
    # extract moved out of the async handler so /reingest no longer blocks the
    # event loop for the duration of Docling/PyMuPDF (closes D-v2.5-01 on the
    # last foreground-extract route after 071.1 closed /reextract). We pass
    # storage_path="" so _upload_pipeline skips the storage upload step — the
    # file is already in storage.
    background_tasks.add_task(
        _upload_pipeline,
        document_id,
        raw,
        target["mime_type"],
        target["filename"],
        current_user["id"],
        "",                  # storage_path="" → skip storage upload (file already there)
        supabase,
    )
    return result.data[0]


async def _reextract_refill_empty_descriptions(
    *,
    supabase: Client,
    document_id: str,
    user_id: str,
    app_settings: "UserEffectiveSettings",
    raw: bytes,
    mime_type: str,
) -> DocumentResponse:
    """Phase 072 D-072-04 — refill document_images.description='' rows WITHOUT
    running the full /reextract delete-cascade.

    Steps:
      1. SELECT empty-description rows older than 5 minutes (column = `created_at`
         per the live schema; see BLOCKER 1 below for the schema-confirmation
         provenance).
      2. Re-run the configured per-aspect image engine
         (`extract_composable(raw, mime_type, engines={"images": app_settings.extraction_image_engine_*})`).
         Phase 072.1 Gap 2 fix — the helper MUST use the same engine that
         originally populated the rows (legacy `extract_pdf_images` /
         `extract_docx_images` mismatch the dispatcher era; see Phase 072
         VERIFICATION.md Anti-Patterns). We need b64_png to call describe_image;
         D-04 from Phase 36 means b64_png is NOT stored in document_images,
         so re-extracting through the dispatcher is unavoidable.
      3. Match each empty row's `(image_index, page)` composite key to the
         freshly-extracted b64 (WARNING 4 — bare image_index can misalign across
         engines; composite key is robust). Rows that don't match stay empty.
      4. Downscale the fresh b64 via `_downscale_b64_for_vision` (shared D-072-02
         invariant — Plan 01's `extract_and_store_images` and this retry path
         share the SAME helper per WARNING 3).
      5. Call `describe_image`; if non-empty, UPDATE the row.
      6. Return DocumentResponse with the current doc state.

    app_settings is INJECTED (BLOCKER 3) — the caller (route handler) loads it
    ONCE in the retry-branch fork via `run_in_threadpool(load_app_settings, ...)`
    per D-v2.5-01. This helper does NOT call `load_app_settings()` itself —
    fewer threadpool boundaries inside the loop, cleaner test mocking, and it
    aligns with how `extract_and_store_images` already accepts `app_settings`
    as a parameter.

    Every `.execute()` is wrapped in `run_in_threadpool` per D-v2.5-01 (sync
    supabase-py calls inside an async handler would otherwise block the single
    uvicorn worker's event loop).

    Failure modes:
      - No empty rows: return current doc state (no-op).
      - Image re-extract raises: log warning, return current state (no UPDATE).
      - Row's `(image_index, page)` doesn't match any fresh image: skip
        (best-effort retry; operator can fall back to full /reextract).
      - `describe_image` returns '' again: skip UPDATE for that row.
    """
    from datetime import timedelta  # noqa: PLC0415

    from app.services.extraction_service import (  # noqa: PLC0415
        DOCX_MIME,
        PDF_MIME,
        ImageData,
        extract_composable,
    )
    from app.services.multimodal_service import (  # noqa: PLC0415
        _downscale_b64_for_vision,
        describe_image,
    )

    # 1. Fetch empty-description rows older than 5 minutes (threadpool-wrapped per D-v2.5-01).
    # BLOCKER 1: the live schema column is `created_at` (NOT the prose-stage name
    # used in CONTEXT.md). The 5-minute window prevents thrashing —
    # empty rows just-INSERTed are not retry candidates
    # (T-072-04-02 mitigation). Owner-only `.eq("user_id", user_id)` predicate
    # is preserved (T-072-04-01 — RLS still gates the retry branch).
    # PostgREST filter literals are NOT evaluated as SQL — the cutoff timestamp
    # must be computed client-side and passed as an ISO 8601 string. Surfaced
    # during Phase 072 Plan 03 UAT (the integration test mocked supabase-py
    # and never exercised the live PostgREST layer).
    cutoff_iso = (datetime.now(timezone.utc) - timedelta(minutes=5)).isoformat()
    empties_resp = await run_in_threadpool(
        lambda: supabase.table("document_images")
        .select("id, image_index, page")
        .eq("document_id", document_id)
        .eq("user_id", user_id)
        .eq("description", "")
        .lt("created_at", cutoff_iso)
        .execute()
    )
    empty_rows = empties_resp.data or []
    if not empty_rows:
        log.info(
            "retry_empty_descriptions_only: no empty rows for document %s",
            document_id,
        )
        doc_resp = await run_in_threadpool(
            lambda: supabase.table("documents")
            .select("*")
            .eq("id", document_id)
            .eq("user_id", user_id)
            .single()
            .execute()
        )
        return DocumentResponse(**doc_resp.data)

    # 2. Re-extract images via the per-aspect dispatcher (Phase 072.1 Gap 2 fix).
    # The retry helper MUST use the same engine that originally populated
    # `document_images` rows; otherwise the (image_index, page) composite key
    # cannot align (e.g., legacy `extract_docx_images` returns [] on docs
    # where all images are floating/header/footer caught only by
    # `zip_xpath_docx`). Resolve the engine name from `app_settings` and
    # call `extract_composable(engines={"images": ...})` so only the images
    # aspect runs through the configured engine.
    if mime_type == PDF_MIME:
        image_engine = app_settings.extraction_image_engine_pdf
    elif mime_type == DOCX_MIME:
        image_engine = app_settings.extraction_image_engine_docx
    else:
        image_engine = None

    fresh_images: list[ImageData] = []
    if image_engine is not None:
        try:
            extracted = await run_in_threadpool(
                extract_composable,
                raw,
                mime_type,
                {"images": image_engine},
            )
            if extracted.image_extraction_error:
                log.warning(
                    "retry_empty_descriptions_only: images engine %r reported "
                    "error for %s: %s",
                    image_engine, document_id, extracted.image_extraction_error,
                )
            fresh_images = list(extracted.images)
        except Exception as exc:  # noqa: BLE001 — silent-swallow + log per D-069-04
            log.warning(
                "retry_empty_descriptions_only: image re-extract via engine %r "
                "failed for %s: %s",
                image_engine, document_id, exc,
            )
            fresh_images = []

    if not fresh_images:
        log.info(
            "retry_empty_descriptions_only: no images re-extracted for %s; "
            "%d empty rows left untouched",
            document_id, len(empty_rows),
        )
        doc_resp = await run_in_threadpool(
            lambda: supabase.table("documents")
            .select("*")
            .eq("id", document_id)
            .eq("user_id", user_id)
            .single()
            .execute()
        )
        return DocumentResponse(**doc_resp.data)

    # WARNING 4 — composite (image_index, page) key to avoid cross-engine
    # misalignment. Rows whose (idx, page) tuple doesn't match a freshly-
    # extracted ImageData stay empty (best-effort retry). Phase 072.1 Gap 2
    # fix: matcher now consumes ImageData attribute access (was dict access
    # under legacy extractors).
    fresh_by_loc = {(img.image_index, img.page): img for img in fresh_images}
    refilled = 0

    # 3 + 4 + 5. For each empty row, find matching fresh b64 by composite key,
    # downscale via the shared D-072-02 helper, then describe.
    for row in empty_rows:
        key = (row["image_index"], row.get("page"))
        fresh = fresh_by_loc.get(key)
        if fresh is None:
            # Row stays empty (best-effort retry — WARNING 4).
            continue
        b64 = fresh.b64_png
        if not b64:
            continue
        # WARNING 3 — shared D-072-02 downscale invariant. Plan 01's
        # extract_and_store_images and this retry path call the SAME helper
        # so both call sites honor the invariant from a single source.
        b64_downscaled = _downscale_b64_for_vision(b64)
        try:
            desc = describe_image(b64_downscaled, app_settings)
        except Exception as exc:  # noqa: BLE001 — silent-swallow per D-069-04
            log.debug(
                "retry_empty_descriptions_only: describe_image failed on row %s: %s",
                row.get("id"), exc,
            )
            continue
        if not desc:
            continue
        # UPDATE this row (threadpool-wrapped per D-v2.5-01).
        await run_in_threadpool(
            lambda r=row, d=desc: supabase.table("document_images")
            .update({"description": d})
            .eq("id", r["id"])
            .execute()
        )
        refilled += 1

    log.info(
        "retry_empty_descriptions_only: refilled %d of %d empty rows for %s",
        refilled, len(empty_rows), document_id,
    )

    doc_resp = await run_in_threadpool(
        lambda: supabase.table("documents")
        .select("*")
        .eq("id", document_id)
        .eq("user_id", user_id)
        .single()
        .execute()
    )
    return DocumentResponse(**doc_resp.data)


@router.post("/{document_id}/reextract", response_model=DocumentResponse, status_code=202)
async def reextract_document(
    document_id: str,
    body: ReextractRequest,
    background_tasks: BackgroundTasks,
    engines: str | None = Query(
        default=None,
        description=(
            "Phase 071.2 D-071.2-03 — per-call extraction engine override hint. "
            "Format: 'text:docling,tables:docling_tf,images:zip_xpath,equations:docling_formula'. "
            "When set, overrides body.engine (which becomes the text-engine alias). "
            "Subject to app_settings.extraction_per_call_hints_enabled flag."
        ),
    ),
    retry_empty_descriptions_only: bool = Query(
        default=False,
        description=(
            "Phase 072 D-072-04 — when true, ONLY refill document_images rows "
            "where description='' AND created_at < now() - 5min. Skips the "
            "delete-cascade + re-extract entirely. Leaves text/tables and "
            "non-empty image rows untouched. Cost: re-runs PDF/DOCX image "
            "extraction and one vision-LLM call per empty row. When false "
            "(default), the legacy delete-cascade + re-extract path runs. "
            "NOTE: BLOCKER 1 — the live schema column is `created_at` (per "
            "supabase/migrations/030_missing_tables.sql:108-116 and "
            "supabase/full-schema.sql:312-321), even though the CONTEXT.md "
            "D-072-04 prose-stage name differs."
        ),
    ),
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """Re-extract a single document with an explicit engine override (Phase 071 D-071-09..12).

    Distinct from POST /reingest (which re-runs the global default extractor).
    Body: {engine: 'pymupdf' | 'legacy'} REQUIRED.
    Returns 202 Accepted + DocumentResponse.

    Behavior (D-071-10):
    1. Owner-only RLS check (eq user_id) — 404 (NOT 403) on miss to avoid leaking
       existence (T-071-04-01 information-disclosure mitigation).
    2. Fetch raw bytes from Storage.
    3. Hard delete chunks + tables + images for this document_id.
    4. UPDATE documents: status='pending', extractor=NULL, ingestion_step=NULL,
       error_message=NULL. (version_number NOT bumped — engine swap is not a
       source-bytes change; D-25 versioning contract preserved per D-071-10.)
    5. Extract text up-front using the chosen engine override (matches /reingest
       pattern so any extraction error surfaces synchronously as 422 rather than
       silently failing in the background task).
    6. Queue ingest_document with engine_override=body.engine.

    Wall-clock fail-safe (D-071.1-02): the per-aspect composer call is wrapped
    with `asyncio.wait_for(timeout=130s)`. On timeout, the underlying thread
    may leak (Python cannot kill threads stuck in native code — camelot/
    pymupdf C extensions); uvicorn restart heals leaks under D-v2.5-02
    single-worker. Post-Docling-rip (Phase 071.3 Plan 04 D-071.3-09), the
    auto-fallback path is no longer needed — non-timeout exceptions fail loud
    (status='failed' + error_message); D-071-11 visibility intent preserved.
    """
    from app.services.extraction_service import extract_composable, get_extractor  # noqa: PLC0415

    # 1. Owner-only RLS check (T-071-04-01) — mirrors /reingest at documents.py:447-458.
    # Phase 071.1 D-071.1-01: wrap in run_in_threadpool — sync supabase-py calls in async
    # handlers block the event loop and freeze the single uvicorn worker (CLAUDE.md /
    # D-v2.5-01). Only `.execute()` is wrapped — auth predicates stay verbatim so
    # T-071-04-01 (.eq user_id + 404-not-403) mitigation is preserved byte-identical.
    try:
        doc = await run_in_threadpool(
            lambda: supabase.table("documents")
            .select("*")
            .eq("id", document_id)
            .eq("user_id", current_user["id"])
            .eq("is_latest", True)
            .maybe_single()
            .execute()
        )
    except Exception:
        # Phase 071.2 D-071.2-10: is_latest=False from a prior failed cascade makes
        # supabase-py raise on .maybe_single() rather than returning data=None.
        # Treat empty-result-from-supabase-py as 404 — matches the `if not doc.data`
        # branch below. Bare HTTPException (no `from e`) keeps supabase-py internals
        # out of the response surface (T-071.2-04-01 information-disclosure constraint).
        raise HTTPException(status_code=404, detail="Document not found")
    if not doc.data:
        # 404 (not 403) — avoid leaking existence to non-owners (T-071-04-01).
        raise HTTPException(status_code=404, detail="Document not found")
    target = doc.data

    # 2. Fetch raw bytes from Storage (mirrors /reingest at documents.py:463-466)
    try:
        raw = await run_in_threadpool(
            supabase.storage.from_("documents").download, target["file_path"]
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Could not retrieve stored file: {e}")

    # Phase 072 D-072-04 — short-circuit retry path: SKIP the delete-cascade +
    # re-extract; ONLY refill `document_images` rows with description=''.
    # NOTE (BLOCKER 1): the live schema column is `created_at`. The route loads
    # `app_settings` ONCE here (scoped to the retry branch — non-retry callers
    # see no extra DB I/O) and injects it into the helper so the helper itself
    # never calls `load_app_settings()` (BLOCKER 3 + D-v2.5-01).
    # `load_app_settings` is already imported at line 20; `run_in_threadpool` at
    # line 15. No new imports needed.
    if retry_empty_descriptions_only:
        # D-v2.5-01: `load_app_settings` is sync supabase-py I/O — wrap in
        # `run_in_threadpool` inside this async handler.
        # Signature: `def load_app_settings() -> UserEffectiveSettings` (NO args
        # — loads global app_settings row). Verified at
        # backend/app/models/user_settings.py:261 and matches the existing
        # call site at documents.py:45 (the `_parse_engines_hint` helper).
        app_settings = await run_in_threadpool(load_app_settings)
        return await _reextract_refill_empty_descriptions(
            supabase=supabase,
            document_id=document_id,
            user_id=current_user["id"],
            app_settings=app_settings,
            raw=raw,
            mime_type=target["mime_type"],
        )

    # 3. Hard delete chunks + tables + images (D-071-10 cascade order — children before parent).
    # D-071.1-01: each .execute() wrapped in run_in_threadpool.
    await run_in_threadpool(
        lambda: supabase.table("document_chunks").delete().eq("document_id", document_id).execute()
    )
    await run_in_threadpool(
        lambda: supabase.table("document_tables").delete().eq("document_id", document_id).execute()
    )
    await run_in_threadpool(
        lambda: supabase.table("document_images").delete().eq("document_id", document_id).execute()
    )

    # 4. Reset doc status (D-071-10 step 4). version_number NOT bumped (D-25 preserved).
    result = await run_in_threadpool(
        lambda: supabase.table("documents")
        .update({
            "status": "pending",
            "extractor": None,
            "ingestion_step": None,
            "error_message": None,
        })
        .eq("id", document_id)
        .eq("user_id", current_user["id"])
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Document not found after update")

    # 5. Extract text up-front via the chosen engine (mirrors /reingest pattern).
    # Wall-clock fail-safe for the per-aspect composer. Post-Docling-rip
    # (Phase 071.3 Plan 04 D-071.3-09), the only remaining heavy engines are
    # camelot tables + pymupdf fence subprocess; 130s upper bound matches the
    # legacy Layer 2 ceiling so behavior is unchanged for non-Docling stalls.
    wall_clock_s = 130.0

    mime_type = target["mime_type"]
    extract_start = time.perf_counter()
    extracted_doc: ExtractedDocument | None = None
    engine_used: str = body.engine
    text: str = ""

    # Phase 071.2 D-071.2-03 — `?engines=` hint takes precedence over body.engine.
    # When hint is absent, body.engine (the legacy 071.1 API) becomes the
    # TEXT engine — preserves all existing UAT scripts / clients.
    engines_dict = _parse_engines_hint(engines)
    if engines_dict is None and body.engine:
        engines_dict = {"text": body.engine}

    from app.services.extraction_service import (  # noqa: PLC0415
        PDF_MIME as _PDF_MIME,
        DOCX_MIME as _DOCX_MIME,
    )

    try:
        if mime_type not in (_PDF_MIME, _DOCX_MIME):
            # Non-PDF/non-DOCX MIMEs flow through the legacy `extract_text` helper.
            text = await run_in_threadpool(extract_text, raw, mime_type)
        else:
            try:
                extracted_doc = await asyncio.wait_for(
                    run_in_threadpool(
                        extract_composable, raw, mime_type, engines_dict
                    ),
                    timeout=wall_clock_s,
                )
                text = extracted_doc.text
                engine_used = extracted_doc.extractor_name or body.engine
            except asyncio.TimeoutError:
                # Phase 071.3 Plan 04 (D-071.3-09): Docling auto-fallback path
                # deleted; non-Docling engines (camelot tables, pymupdf fence)
                # fail loud on timeout. Operator recovers via /reextract with
                # a different `?engines=` hint.
                raise HTTPException(
                    status_code=422,
                    detail=f"engine={body.engine} timed out after {wall_clock_s}s",
                )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=422,
            detail=f"Could not extract text via engine={body.engine}: {e}",
        )
    extract_duration_ms = int((time.perf_counter() - extract_start) * 1000)

    # 6. Schedule background ingestion with explicit engine_override (D-071-10 step 5).
    # Matches the ingest_document signature wired up by Plan 02 (positional kwargs
    # engine_override / extracted_doc / extract_duration_ms). Thread `engine_used`
    # (composer's extractor_name when available, else body.engine) so the
    # telemetry row written by `ingest_document` reflects the actual engine used.
    background_tasks.add_task(
        ingest_document,
        document_id,
        text,
        current_user["id"],
        supabase,
        raw,
        mime_type,
        target["filename"],
        engine_used,
        extracted_doc,
        extract_duration_ms,
    )
    return result.data[0]


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    document_id: str,
    background_tasks: BackgroundTasks,
    scope: str = Query(default="version", pattern="^(version|all)$"),
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    doc_resp = (
        supabase.table("documents")
        .select("*")
        .eq("id", document_id)
        .eq("user_id", current_user["id"])
        .maybe_single()
        .execute()
    )
    if not doc_resp.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    target = doc_resp.data
    folder_id = target.get("folder_id")

    if scope == "all":
        # D-07: find all sibling rows by (user_id, filename, folder_id)
        siblings_q = (
            supabase.table("documents")
            .select("id, file_path")
            .eq("user_id", current_user["id"])
            .eq("filename", target["filename"])
        )
        if folder_id is None:
            siblings_q = siblings_q.is_("folder_id", "null")
        else:
            siblings_q = siblings_q.eq("folder_id", folder_id)
        siblings = siblings_q.execute().data or []

        # D-10: delete all storage files; failures silently swallowed
        for sibling in siblings:
            if sibling.get("file_path"):
                try:
                    supabase.storage.from_("documents").remove([sibling["file_path"]])
                except Exception:
                    pass

        # Delete all sibling rows; ON DELETE CASCADE handles chunks/tables/images (D-09)
        # user_id guard redundant (sibling_ids from user-scoped SELECT) but added for defence-in-depth
        sibling_ids = [s["id"] for s in siblings]
        if sibling_ids:
            supabase.table("documents").delete().eq("user_id", current_user["id"]).in_("id", sibling_ids).execute()

    else:
        # scope == "version" (default) — D-06: delete only the targeted row + storage file
        # D-10: storage failure silently swallowed
        try:
            supabase.storage.from_("documents").remove([target["file_path"]])
        except Exception:
            pass

        supabase.table("documents").delete().eq("id", document_id).eq("user_id", current_user["id"]).execute()

        # D-06: if deleted row was is_latest, promote next-highest sibling
        if target.get("is_latest"):
            siblings_q = (
                supabase.table("documents")
                .select("id, version_number")
                .eq("user_id", current_user["id"])
                .eq("filename", target["filename"])
                .neq("id", document_id)
            )
            if folder_id is None:
                siblings_q = siblings_q.is_("folder_id", "null")
            else:
                siblings_q = siblings_q.eq("folder_id", folder_id)
            siblings = siblings_q.execute().data or []

            if siblings:
                # Sort descending by version_number; promote the highest
                siblings.sort(key=lambda s: s.get("version_number") or 0, reverse=True)
                next_latest_id = siblings[0]["id"]
                supabase.table("documents").update({"is_latest": True}).eq("id", next_latest_id).execute()

    # D-11: audit log for both paths — include scope in metadata
    background_tasks.add_task(
        write_audit_entry,
        user_id=current_user["id"],
        action_type="document.delete",
        metadata={
            "document_id": document_id,
            "filename": target.get("filename", ""),
            "scope": scope,
        },
        supabase=supabase,
    )


@router.patch("/{document_id}/move", response_model=DocumentResponse)
async def move_document(
    document_id: str,
    body: DocumentMoveRequest,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """Move a document to a different folder. folder_id=null moves to root."""
    # 1. Verify document ownership
    doc = (
        supabase.table("documents")
        .select("id")
        .eq("id", document_id)
        .eq("user_id", current_user["id"])
        .maybe_single()
        .execute()
    )
    if not doc.data:
        raise HTTPException(status_code=404, detail="Document not found")

    # 2. Validate target folder accessibility (if not moving to root)
    if body.folder_id:
        folder = (
            supabase.table("folders")
            .select("id")
            .eq("id", str(body.folder_id))
            .or_(f"user_id.eq.{current_user['id']},is_global.eq.true")
            .maybe_single()
            .execute()
        )
        if not folder.data:
            raise HTTPException(status_code=404, detail="Folder not found")

    # 3. Perform move
    result = (
        supabase.table("documents")
        .update({"folder_id": str(body.folder_id) if body.folder_id else None})
        .eq("id", document_id)
        .eq("user_id", current_user["id"])
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Document not found")
    return result.data[0]


# The immutable built-in metadata keys. IN-01: single-sourced from DocumentMetadata
# (under extra="allow", model_fields still returns ONLY the 7 declared built-ins, not
# extras) so a future built-in addition can't drift this allow-list out of lockstep.
# A PATCH `field` must be one of these OR an enabled custom field_key — and must
# NEVER start with '_' (provenance-forgery block).
_METADATA_BUILTINS = set(DocumentMetadata.model_fields)


@router.patch("/{document_id}/metadata", response_model=DocumentResponse)
async def update_document_metadata(
    document_id: str,
    body: MetadataUpdateRequest,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """Phase 112 META-05 (D-03) — audited single-field metadata edit.

    Persists one validated metadata field on a document the caller owns, hard-stamps
    `_source[field]='user'` (the client may NEVER assert provenance), drops any stale
    `_confidence[field]` (a human override has no model score), and writes a
    `metadata.update` audit row. Owner-scoped on BOTH the SELECT and the UPDATE →
    404 (never 403) on a non-owner miss (no existence leak), mirroring move_document.

    Every `.execute()` is wrapped in `run_in_threadpool` (D-v2.5-01) — move_document's
    raw `.execute()` predates that sweep and is deliberately NOT the threadpool template;
    the reextract_document owner-SELECT (documents.py:1033) is.
    """
    # 1. Owner SELECT (404 on miss, no existence leak) — threadpool-wrapped (D-v2.5-01).
    try:
        doc = await run_in_threadpool(
            lambda: supabase.table("documents")
            .select("metadata")
            .eq("id", document_id)
            .eq("user_id", current_user["id"])
            .eq("is_latest", True)
            .maybe_single()
            .execute()
        )
    except Exception:
        # is_latest=False / no-row makes supabase-py raise on .maybe_single() rather than
        # returning data=None — treat as 404 (matches reextract_document:1043-1049).
        raise HTTPException(status_code=404, detail="Document not found")
    # supabase-py .maybe_single().execute() on a no-row owner miss may return the whole
    # response object as None (not an object with .data=None) — guard both shapes so a
    # non-owner gets a clean 404, never an AttributeError 500 (no existence leak).
    if not doc or not getattr(doc, "data", None):
        raise HTTPException(status_code=404, detail="Document not found")

    # 2. Validate the field allow-list + reject any leading underscore (V5 input validation
    #    + provenance-forgery block — a client must not write _source/_confidence directly).
    field = body.field
    if field.startswith("_"):
        raise HTTPException(status_code=422, detail="Invalid metadata field")
    enabled_custom = {
        d["field_key"]
        for d in await run_in_threadpool(
            lambda: read_enabled_field_defs(supabase, current_user["id"])
        )
    }
    if field not in _METADATA_BUILTINS and field not in enabled_custom:
        raise HTTPException(status_code=422, detail="Unknown metadata field")

    # 3. Merge into the existing metadata blob; hard-stamp _source='user'.
    # WR-02: defensive-copy the fetched blob (+ the nested _source/_confidence dicts
    # we mutate) so the prior SELECT result stays pristine — a future refactor that
    # re-reads doc.data["metadata"] for an audit diff must see the PRIOR value, not
    # the post-merge state. Behavior is unchanged; this is purely defensive.
    meta = dict(doc.data.get("metadata") or {})
    if isinstance(meta.get("_source"), dict):
        meta["_source"] = dict(meta["_source"])
    if isinstance(meta.get("_confidence"), dict):
        meta["_confidence"] = dict(meta["_confidence"])
    value = body.value
    if field in ("document_type", "language") and isinstance(value, str):
        # Mirror ingest_document:1457-1461 so user-edited values still match `@>` filters.
        value = value.lower()
    meta[field] = value
    meta.setdefault("_source", {})[field] = "user"
    # Phase 112 D-03: a user override carries NO model score — the chip renders neutral
    # "Edited", never a fabricated number. Drop any stale _confidence entry for this field.
    if isinstance(meta.get("_confidence"), dict):
        meta["_confidence"].pop(field, None)

    # 4. Owner-scoped UPDATE — threadpool-wrapped (D-v2.5-01).
    result = await run_in_threadpool(
        lambda: supabase.table("documents")
        .update({"metadata": meta})
        .eq("id", document_id)
        .eq("user_id", current_user["id"])
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Document not found")

    # 5. Audit row (await inline; write_audit_entry swallows errors — the live round-trip
    #    is the real verification). metadata.update is in VALID_ACTION_TYPES + live CHECK.
    await write_audit_entry(
        user_id=current_user["id"],
        action_type="metadata.update",
        metadata={"document_id": document_id, "field": field},
        supabase=supabase,
    )
    return result.data[0]


def ingest_document(
    document_id: str,
    text: str,
    user_id: str,
    supabase: Client,
    raw: bytes = b"",
    mime_type: str = "",
    filename: str = "",
    engine_override: str | None = None,
    extracted_doc: "ExtractedDocument | None" = None,
    extract_duration_ms: int = 0,
) -> None:
    import logging, traceback
    log = logging.getLogger(__name__)

    # Phase 071 D-071-08 — resolve engine lineage tag once, reused for both
    # documents.extractor column and pdf_extraction_runs.engine telemetry.
    # Phase 071.3 Plan 04 (D-071.3-09): EXTRACTOR_PRIMARY env fallback removed;
    # default lineage tag is "legacy" when neither composer nor caller provides one.
    engine_used = (
        (extracted_doc.extractor_name if extracted_doc and extracted_doc.extractor_name else None)
        or engine_override
        or "legacy"
    )
    started_at_iso = datetime.now(timezone.utc).isoformat()

    try:
        supabase.table("documents").update({"status": "processing"}).eq("id", document_id).execute()
        # D-10/D-11 (Phase 56): granular ingestion_step for Realtime-driven UI badge.
        # status='processing' gates UI visibility; ingestion_step provides the label.
        supabase.table("documents").update({"ingestion_step": "extracting"}).eq("id", document_id).execute()

        # Phase 111 (META-01/03/04) — read effective settings ONCE, BEFORE the
        # metadata extract branch, so extraction_model / window_cap / enrichment_mode
        # are in scope. load_app_settings() is sync/cache-only and already used at
        # the embedding step below — this is the sync BackgroundTask, not an async
        # handler, so D-v2.5-01 does NOT fire (it's hoisted, not newly introduced).
        app_settings = load_app_settings()

        # Extract metadata FIRST so we can use it to enrich chunk embeddings.
        # This is best-effort — failures are logged but never block ingestion.
        #
        # Phase 111 (D-111-2/8) — branch on metadata_enrichment_mode:
        #   - 'enriched' (default; any non-'legacy' value fails safe to enriched):
        #       cross-provider forced_emit through extract_metadata_enriched, with a
        #       runtime create_model schema (built-ins + user custom fields), a
        #       head+tail window sample (NOT content[:3000]), and a nested per-field
        #       `_confidence` map attached AFTER the dump.
        #   - 'legacy': the untouched OpenAI json_object extract_metadata path runs
        #       byte-identical (the reversibility path).
        # Three graceful-degradation layers are preserved: (1) extract_metadata_enriched's
        # own except→None [Plan 02], (2) the call-site except below → emitted=None, and
        # (3) the outer try/except backstop at the function bottom. A None metadata_dict
        # is fine — the doc still reaches status=completed and flat `@>` filters still match.
        mode = app_settings.metadata_enrichment_mode
        if mode != "legacy":  # default-on 'enriched'; any non-'legacy' value fails safe to enriched
            from app.config import get_model_capability  # noqa: PLC0415
            from app.services.embedding_service import (  # noqa: PLC0415
                attach_confidence,
                build_metadata_model,
                extract_metadata_enriched,
                read_enabled_field_defs,
                resolve_extraction_model,
                sample_for_extraction,
            )

            # verify-work 111.1: the WHOLE enriched setup is inside the degrade try now.
            # build_metadata_model() raises ValueError on an unknown/typo'd custom
            # field_type (reachable only via a direct DB write — the CRUD API hard-validates
            # field_type), and resolve/read/sample can also fail; previously those sat
            # OUTSIDE the try so a metadata-config problem hard-FAILED the whole ingest
            # (status=failed, no chunks). The "metadata failure never breaks ingestion"
            # contract (D-111-8) requires ANY enriched failure to degrade to metadata=None.
            metadata_dict = None
            try:
                model = resolve_extraction_model(app_settings.extraction_model)  # env gpt-4o fallback
                # D-09 #1 (BUG-260616-01 / EMBED-01 data-egress cure): prefer the stored
                # explicit `extraction_provider`. When the operator pinned a provider in
                # Settings (e.g. `lmstudio`/`ollama`), trust it and SKIP name-inference
                # entirely — a slashed local id (`google/gemma-3-4b`) can no longer be
                # mis-inferred to `openrouter` and ship document text to the cloud.
                # Name-inference stays ONLY as the last-resort legacy fallback for pre-111.1
                # rows that never set `extraction_provider` (D-08 back-compat — byte-identical).
                provider = (getattr(app_settings, "extraction_provider", "") or "").strip().lower() \
                    or (get_model_capability(model) or {}).get("provider")
                defs = read_enabled_field_defs(supabase, user_id)  # Plan-02 explicit-scoped, fail-closed read
                DynModel = build_metadata_model(defs)
                emit_tool = {
                    "type": "function",
                    "function": {
                        "name": "emit_document_metadata",
                        "description": (
                            "Emit structured metadata for this document with a per-field "
                            "0-1 confidence."
                        ),
                        "parameters": DynModel.model_json_schema(),
                    },
                }
                sampled = sample_for_extraction(text, app_settings.extraction_window_cap)
                result = asyncio.run(extract_metadata_enriched(
                    sampled=sampled,
                    model=model,
                    provider=provider,
                    schema_model=DynModel,
                    emit_tool=emit_tool,
                    user_settings=app_settings,
                ))
                emitted = result.get("emitted")
                # D-111-3 (WR-01 fix): use the dedicated helper, which POPS the public
                # `confidence` field out of the dump and renames it to the nested
                # `_confidence` key. Hand-rolling `metadata_dict["_confidence"] = ...`
                # left the flat `confidence` key in the dump (the populated-dict default
                # survives exclude_none), polluting the `metadata @>` containment filter.
                metadata_dict = attach_confidence(emitted.model_dump(exclude_none=True)) if emitted else None
            except Exception:  # noqa: BLE001 — degrade layer 2: ANY enriched failure → metadata=None; doc still completes (D-111-8)
                log.warning("enriched metadata extraction failed; degrading to None", exc_info=True)
                metadata_dict = None
        else:
            metadata = extract_metadata(text)  # UNTOUCHED legacy path (byte-identical)
            metadata_dict = metadata.model_dump(exclude_none=True) if metadata else None
        # Normalize case-sensitive filter fields for consistent retrieval.
        # D-111-9: lowercase ONLY document_type + language; _confidence is nested and
        # is NEVER touched here, and is NEVER promoted to a flat filter field.
        if metadata_dict:
            if metadata_dict.get("document_type"):
                metadata_dict["document_type"] = metadata_dict["document_type"].lower()
            if metadata_dict.get("language"):
                metadata_dict["language"] = metadata_dict["language"].lower()

        # Phase 112 D-03 (META-05) — re-extract precedence merge guard.
        # Preserve any field a human marked _source='user' (via PATCH /documents/{id}/metadata,
        # Plan 01) across re-extraction, so a later extraction never silently destroys an edit.
        #
        # Pitfall 1 (single write site): this guard MUST live here at the SINGLE
        # ingest_document metadata-write site — NOT in a re-extract wrapper — so ALL THREE
        # re-extract entry points inherit it: /upload + /reingest (-> _upload_pipeline ->
        # ingest_document) and /reextract (-> background_tasks.add_task(ingest_document)).
        # A wrapper-placed guard would pass a /reextract-only test while still destroying
        # edits on /upload + /reingest. The guard reads the PRIOR doc's _source map (there
        # is no request-scoped `body` in this function's scope — Pitfall 1 is self-enforced).
        #
        # Pitfall 2 (degrade): enriched extraction can degrade to metadata_dict=None; we
        # promote None -> {} BEFORE the user-field loop so a degrade-with-prior-user-fields
        # yields {user fields + _source}, never None (a degrade must NOT wipe a human edit).
        #
        # sync .execute() — already inside the BackgroundTask thread (this function is a
        # sync def), so D-v2.5-01 (no blocking I/O in async handlers) does NOT fire here.
        prior = (
            supabase.table("documents").select("metadata")
            .eq("id", document_id).maybe_single().execute()
        )
        # WR-02: defensive-copy the fetched prior blob (+ the nested _source dict we
        # read) so the SELECT result stays pristine and restored values don't share a
        # mutable reference with the prior object. Behavior unchanged; purely defensive.
        prior_meta = dict((getattr(prior, "data", None) or {}).get("metadata") or {})
        user_fields = dict(prior_meta.get("_source") or {})  # {field: "user"}
        if user_fields:
            metadata_dict = metadata_dict or {}  # Pitfall 2: degrade None -> {} before the loop
            preserved_source = metadata_dict.setdefault("_source", {})
            for fld, src in user_fields.items():
                if src != "user":
                    continue
                if fld in prior_meta:
                    metadata_dict[fld] = prior_meta[fld]  # restore the human value
                else:
                    metadata_dict.pop(fld, None)          # human cleared it -> keep it cleared
                preserved_source[fld] = "user"            # keep the marker
                # a human override has no model score -> drop any fresh _confidence for it
                if isinstance(metadata_dict.get("_confidence"), dict):
                    metadata_dict["_confidence"].pop(fld, None)

        supabase.table("documents").update({"ingestion_step": "chunking"}).eq("id", document_id).execute()
        chunks = chunk_text(text)
        if not chunks:
            supabase.table("documents").update({
                "status": "failed",
                "error_message": "No text content could be extracted from the file.",
            }).eq("id", document_id).execute()
            return

        # Build a context header prepended to each chunk before embedding.
        # The header makes filename, title, date, and document type visible in the
        # vector space so queries like "amount paid on 17 Jan" can match a receipt
        # whose date appears only in the filename — not in its text content.
        # We embed the enriched text but store the raw chunk for clean display.
        header_parts = [f"Document: {filename}"] if filename else []
        if metadata_dict:
            if metadata_dict.get("title"):
                header_parts.append(f"Title: {metadata_dict['title']}")
            if metadata_dict.get("date"):
                header_parts.append(f"Date: {metadata_dict['date']}")
            if metadata_dict.get("document_type"):
                header_parts.append(f"Type: {metadata_dict['document_type']}")
        context_header = f"[{' | '.join(header_parts)}]\n" if header_parts else ""

        texts_to_embed = [context_header + chunk for chunk in chunks] if context_header else chunks

        # Phase 111 — app_settings was hoisted above the metadata extract branch; reuse it.
        supabase.table("documents").update({"ingestion_step": "embedding"}).eq("id", document_id).execute()
        # Phase 111.1 EMBED-04 / D-13: thread user_settings=app_settings so the chunk
        # path resolves the SAME get_embedding_client the query path uses
        # (retrieval_service.py:42-44). Without this, a configured non-default embedder
        # embedded chunks via env creds while queries used configured creds → two vector
        # spaces → silent retrieval failure.
        embeddings = embed_chunks(
            texts_to_embed,
            model=app_settings.embedding_model or None,
            user_settings=app_settings,
        )

        # Phase 111.1 D-10: tag each chunk with the embedding model + dims it was
        # produced under, so a half-finished re-embed never compares across vector
        # spaces (match_document_chunks filters on p_embedding_model). Default mirrors
        # the migration-073 backfill (text-embedding-3-small / 1536) for back-compat.
        _chunk_embedding_model = app_settings.embedding_model or "text-embedding-3-small"
        _chunk_embedding_dimensions = getattr(app_settings, "embedding_dimensions", None)
        chunk_rows = [
            {
                "document_id": document_id,
                "user_id": user_id,
                "content": chunk,        # raw text — clean for display and citations
                "chunk_index": i,
                "embedding": embedding,  # computed from context_header + chunk
                "embedding_model": _chunk_embedding_model,           # D-10 per-chunk tag
                "embedding_dimensions": _chunk_embedding_dimensions,  # D-10
            }
            for i, (chunk, embedding) in enumerate(zip(chunks, embeddings))
        ]
        supabase.table("document_chunks").insert(chunk_rows).execute()

        # --- Multi-modal extraction (Phase 35) ---
        if raw and mime_type:
            from app.services.multimodal_service import (  # noqa: PLC0415
                extract_and_store_tables,
                extract_and_store_images,
            )
            supabase.table("documents").update({"ingestion_step": "extracting_tables"}).eq("id", document_id).execute()
            # Phase 071.2 D-071.2-08: thread extracted_doc through so Docling's
            # pre-extracted tables (with bbox per migration 042) flow into
            # document_tables, replacing the silent pdfplumber re-extract.
            # When extracted_doc is None (legacy path), multimodal_service falls
            # back to the pdfplumber pass byte-identical to pre-071.2 behavior.
            extract_and_store_tables(
                raw, mime_type, document_id, user_id, supabase,
                extracted_doc=extracted_doc,
            )

            supabase.table("documents").update({"ingestion_step": "extracting_images"}).eq("id", document_id).execute()
            # Phase 071.2 D-071.2-08: thread extracted_doc through so Docling's
            # pre-extracted images (with bbox per migration 042) flow into
            # document_images. Vision-LLM description loop is preserved unchanged.
            extract_and_store_images(
                raw, mime_type, document_id, user_id, supabase, app_settings,
                extracted_doc=extracted_doc,
            )

        # Phase 071 D-071-08 — telemetry write (happy path).
        # Telemetry INSERT failure must NOT block document ingest completion (T-071-02-07).
        try:
            table_count = len(extracted_doc.tables) if extracted_doc else 0
            image_count = len(extracted_doc.images) if extracted_doc else 0
            supabase.table("pdf_extraction_runs").insert({
                "document_id": document_id,
                "user_id": user_id,
                "engine": engine_used,
                "started_at": started_at_iso,
                "duration_ms": extract_duration_ms,
                "table_count": table_count,
                "image_count": image_count,
                "error": None,
            }).execute()
        except Exception as exc:
            log.warning(
                "pdf_extraction_runs INSERT failed (engine=%s, doc=%s): %s",
                engine_used, document_id, exc,
            )

        supabase.table("documents").update({"ingestion_step": "metadata"}).eq("id", document_id).execute()

        # Phase 118 (CLASS-02 / D-118-2/3/4/8) — classification rule-eval pass.
        # Runs immediately BEFORE the single persist UPDATE below (metadata_dict is final
        # here — it is only READ for the chunk header above, never mutated). It writes ONE
        # `_classification` SUGGESTION into metadata_dict; the existing :metadata write below
        # carries it. It NEVER writes folder_id — the milestone anti-feature ("silent
        # autonomous auto-filing") is structurally impossible here; the move happens ONLY on
        # an explicit Accept (accept_classification).
        #
        # This is a sync def inside a BackgroundTask (NO request JWT — auth.uid() is NULL and
        # the service-role client BYPASSES RLS). The SOLE owner-scoping gate is the in-app
        # `.or_(user_id.eq.{uploader},is_global.eq.true)` predicate (Pitfall 3, D-118-8): an
        # unscoped select would return ALL users' rules. A global rule is evaluated against
        # the uploader's OWN metadata_dict only. sync .execute() — D-v2.5-01 does NOT fire.
        if metadata_dict:  # no metadata → nothing to match (never blocks ingest)
            try:
                from app.services import classification_matcher  # noqa: PLC0415
                rules = (
                    supabase.table("classification_rules").select("*")
                    .or_(f"user_id.eq.{user_id},is_global.eq.true")  # D-118-8 own + global
                    .eq("enabled", True)
                    .order("is_global").order("created_at")  # owner(false) before global(true); oldest first (D-118-4)
                    .execute()
                ).data or []
                whitelist = _METADATA_BUILTINS | {
                    d["field_key"] for d in read_enabled_field_defs(supabase, user_id)  # SYNC reader
                }
                for rule in rules:  # first-match-wins (D-118-3): ONE object, never an array
                    if classification_matcher.match_metadata(rule["match_expr"], metadata_dict, whitelist):
                        metadata_dict["_classification"] = classification_matcher.build_suggestion(
                            rule, supabase, user_id,
                        )
                        break
            except Exception:  # noqa: BLE001 — classification NEVER blocks ingestion (mirror the metadata degrade)
                log.warning("classification rule-eval failed; skipping suggestion", exc_info=True)

        supabase.table("documents").update({
            "status": "completed",
            # Phase 072.1 Gap 3 closure documentation — chunk_count is TEXT-chunks-only.
            # Image-description chunks (inserted by multimodal_service.extract_and_store_images
            # at line ~507) are NOT counted here. This is intentional: the UI's
            # documents-list "chunk count" represents the document's text density,
            # not its total searchable-row count. Operators wanting the total can
            # SELECT count(*) FROM document_chunks WHERE document_id=? directly.
            # Consistent across /upload, /reingest, /reextract (all paths hit this
            # ingest_document write site).
            "chunk_count": len(chunks),
            "metadata": metadata_dict,
            "full_markdown": text,
            # Phase 071 D-071-08 — populate extractor lineage column for new ingests.
            "extractor": engine_used,
        }).eq("id", document_id).execute()

    except Exception as e:
        log.error("ingest_document failed: %s\n%s", e, traceback.format_exc())
        # Phase 071 D-071-08 — telemetry write on failure (D-071-11 fail-loud).
        # Wrapped in its own try/except so a telemetry write failure cannot
        # escalate into a double-fault on an already-failed ingest (T-071-02-02).
        try:
            supabase.table("pdf_extraction_runs").insert({
                "document_id": document_id,
                "user_id": user_id,
                "engine": engine_used,
                "started_at": started_at_iso,
                "duration_ms": extract_duration_ms,
                "table_count": 0,
                "image_count": 0,
                "error": str(e)[:1000],
            }).execute()
        except Exception:
            pass  # telemetry never blocks status update
        supabase.table("documents").update({
            "status": "failed",
            "error_message": str(e)[:500],
        }).eq("id", document_id).execute()
