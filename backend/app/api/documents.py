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

from app.api.kb import read_path
from app.dependencies import get_current_user, get_supabase, get_user_supabase_client
from app.models.document import (
    DocumentChunkRow,
    DocumentContentResponse,
    DocumentImageRow,
    DocumentMetadata,
    DocumentMoveRequest,
    DocumentResponse,
    DocumentTableRow,
)
from app.models.user_settings import load_app_settings
from app.services.audit_service import write_audit_entry
from app.services.embedding_service import chunk_text, embed_chunks, extract_metadata, read_enabled_field_defs
from app.services.ingest_enrich import enrich_for_ingest
from app.services.extraction_service import ExtractedDocument
from app.utils.db import aexec
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

#: Image types the upload gate accepts and `extract_text` sends to vision transcription.
#: ⚠ Kept as its own named set so the routing test and the gate read the SAME list — a
#: second hand-typed copy is how a format gets a door with no sign on it, or a sign with no
#: door. `image/gif` is included (Pillow reads frame 1) but is not advertised by the
#: frontend: an animation transcribes as its first frame, which is honest but rarely useful.
IMAGE_MIME_TYPES = frozenset({
    "image/png",
    "image/jpeg",
    "image/webp",
    "image/tiff",
    "image/bmp",
    "image/gif",
})

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
    "message/rfc822",
    "application/vnd.ms-outlook",
    "application/x-msg",
    "application/dxf",
    "image/vnd.dxf",
    "application/x-dxf",
    # ── SEED-226 / 233-UAT item 8 — images become searchable documents.
    #
    # ⚠ Until now an uploaded `.png` was refused at this gate, so the vision machinery that
    #   already describes images pulled OUT of a PDF could never be reached by an image
    #   uploaded on its own. These entries are the door; `extract_text` routes them into
    #   `vision_text.transcribe_pages`, which TRANSCRIBES rather than captions.
    #
    # ⛔ `image/vnd.dxf` is NOT an image and is handled by the DXF branch above it — the DXF
    #   arm is checked FIRST in `extract_text` for exactly that reason.
    *IMAGE_MIME_TYPES,
}

# Extension → canonical MIME type for formats browsers misreport
_EXT_MIME_OVERRIDES: dict[str, str] = {
    ".md":   "text/markdown",
    ".csv":  "text/csv",
    ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".epub": "application/epub+zip",
    ".eml":  "message/rfc822",
    ".msg":  "application/vnd.ms-outlook",
    ".dxf":  "application/dxf",
    # Images. ⚠ `.jpg` is the one browsers most often announce as octet-stream from a
    # drag-and-drop, and `.tif`/`.tiff` are reported inconsistently across platforms.
    ".png":  "image/png",
    ".jpg":  "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".tif":  "image/tiff",
    ".tiff": "image/tiff",
    ".bmp":  "image/bmp",
    ".gif":  "image/gif",
    # ⚠ BUG-260825-01 — `.docx` and `.pdf` WERE ABSENT, AND THAT IS THE OBSERVED SPLIT.
    #   Measured 2026-08-25 against the real endpoint: a `.docx` announced as
    #   `application/octet-stream`, `application/zip`, `application/msword` or with NO
    #   Content-Type at all got a **422 "Unsupported file type"** — as did a `.pdf` announced
    #   as octet-stream or with none. `.md`, `.csv`, `.pptx` and `.xlsx` all sailed through the
    #   same announcements BECAUSE THEY WERE ALREADY IN THIS DICT. A client that reports
    #   octet-stream for binaries therefore fails exactly docx + pdf and succeeds on md, which
    #   is the operator's report character for character.
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".pdf":  "application/pdf",
}

#: Content-Types that mean "the client did not really know" and may be corrected by extension.
#: ⚠ `application/msword` and the EMPTY string are here on MEASUREMENT, not on principle — both
#:   were observed 422-ing a real `.docx` above. Correction stays keyed on the EXTENSION, so a
#:   genuine legacy `.doc` (ext not in the dict) is still refused rather than mislabelled.
_UNRELIABLE_MIME_TYPES: tuple[str, ...] = (
    "text/plain",
    "application/octet-stream",
    "application/zip",
    "application/msword",
    "",
)


#: Formats whose "no text" case has a CONCRETE cause a person can act on. Anything not
#: listed here falls through to the generic sentence, which is deliberately vague because
#: for those formats we genuinely do not know why the extractor came back empty.
#: One sentence, six mimes — written once so the six image rows below cannot drift apart.
_IMAGE_EMPTY_TEXT = (
    "This image was read, but no text could be found in it. It is still stored, and it can "
    "still be opened — there is just nothing written on it to search."
)

#: ⚠ THE COUNTERPART TO `_IMAGE_EMPTY_TEXT`, AND THE DISTINCTION IS THE WHOLE POINT.
#: "read, found nothing" and "never looked at" are different facts about a file, and only one
#: of them is the person's to fix. Saying the first when the second is true is the lie that
#: five of the operator's images told on 2026-09-05 — see `vision_text.resolve_vision_model`.
_IMAGE_NO_VISION_MODEL = (
    "No vision model is set, so this image was not read. Nothing was stored about its "
    "contents. Choose a vision model in Settings, then upload it again."
)

_EMPTY_TEXT_MESSAGES: dict[str, str] = {
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
        "This spreadsheet is empty — none of its sheets contain any data. "
        "Add rows and upload it again.",
    "application/vnd.ms-excel":
        "This spreadsheet is empty — none of its sheets contain any data. "
        "Add rows and upload it again.",
    "text/csv":
        "This CSV has no rows — only a header, or nothing at all. "
        "Add rows and upload it again.",
    # ⭐ REWRITTEN 2026-09-05 (SEED-226 L1). The old sentence ended with a promise that this
    #   file needed OCR before it could be searched — naming a capability the product did not
    #   have, which is what SEED-226 was planted on. Vision transcription now RUNS on this
    #   case before the document is ever declared empty, so reaching this message means the
    #   transcription was attempted and yielded nothing either.
    #
    # ⛔ NO DOUBLE QUOTES IN THIS BLOCK, and that is a real constraint rather than a style
    #   preference: `ingestionFailureCopy.test.ts` extracts every string literal inside this
    #   dict to prove each sentence survives `classifyIngestionError` unchanged, and its
    #   walker cannot tell a quoted phrase in a COMMENT from a value. A quoted aside here
    #   reds that fence — measured, 2026-09-05.
    "application/pdf":
        "No text could be read from this PDF. It looks like a scan or a drawing, and "
        "reading it as an image produced nothing legible either.",
    "message/rfc822":
        "This email has no readable message body.",
    "application/vnd.ms-outlook":
        "This email has no readable message body.",
    "application/x-msg":
        "This email has no readable message body.",
    # SEED-226 / 233-UAT item 8. An image reaching here was readable as an image and simply
    # had no text on it — a photograph of a landscape, say. That is not a failure of the
    # importer and the sentence should not imply one.
    "image/png": _IMAGE_EMPTY_TEXT,
    "image/jpeg": _IMAGE_EMPTY_TEXT,
    "image/webp": _IMAGE_EMPTY_TEXT,
    "image/tiff": _IMAGE_EMPTY_TEXT,
    "image/bmp": _IMAGE_EMPTY_TEXT,
    "image/gif": _IMAGE_EMPTY_TEXT,
}

#: The fallback. Kept WORD-FOR-WORD as it shipped, so the generic case is unchanged.
_EMPTY_TEXT_DEFAULT = "No text content could be extracted from the file."


def empty_text_message(mime_type: str | None) -> str:
    """The sentence shown when extraction succeeded but produced nothing to chunk.

    ⚠ WRITTEN BECAUSE THE GENERIC SENTENCE WAS TRUE AND USELESS. An operator uploaded an
    `.xlsx`, saw "No text content could be extracted from the file", and reasonably read it
    as a broken importer. It was not: the workbook was genuinely empty (`<sheetData/>`,
    self-closed, no sharedStrings.xml). Two hours of the release went into proving the app
    was right, which is the cost of a message that describes the CODE'S experience instead
    of the FILE'S state.

    ⚠ ONLY formats whose empty case has ONE plausible cause get a specific sentence. A DOCX
    that extracts to nothing could be a dozen things, so it keeps the vague wording rather
    than being handed a confident guess — a wrong specific message is worse than a right
    vague one.
    """
    return _EMPTY_TEXT_MESSAGES.get(mime_type or "", _EMPTY_TEXT_DEFAULT)


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


async def _upload_pipeline(
    document_id: str,
    raw: bytes,
    mime_type: str,
    filename: str,
    user_id: str,
    storage_path: str,
    supabase: Client,
    engines_dict: dict[str, str] | None = None,
) -> None:
    """Phase 229 (TRUST-01) — delegates to unified splice_document pipeline."""
    from app.services.ingest_splice import splice_document  # noqa: PLC0415

    await splice_document(
        document_id=document_id,
        raw=raw,
        mime_type=mime_type,
        filename=filename,
        user_id=user_id,
        storage_path=storage_path,
        supabase=supabase,
        engines_dict=engines_dict,
    )


# Number of data rows per header-anchored chunk block (Phase 201 SEED-060).
# Blocks are \n\n-separated → chunk_text treats each block as a paragraph unit,
# keeping the [Columns: ...] prefix with its data rows on every split.
_TABLE_ROWS_PER_CHUNK = 50


def _tabular_text_blocks(
    headers: list[str],
    rows: list[list[str]],
    prefix: str = "",
) -> str:
    """Produce header-anchored text blocks for CSV/Excel data (Phase 201 SEED-060).

    Each block of _TABLE_ROWS_PER_CHUNK data rows is prefixed with:
      [Columns: Header1 | Header2 | ...]
    Blocks are separated by \\n\\n so chunk_text treats them as paragraph-level
    units and will not split a data row away from its column context.

    Args:
        headers: Column names for this table.
        rows:    Data rows (list of string lists).
        prefix:  Optional text prepended inside the [Columns: ...] bracket
                 (e.g. "Sheet: Revenue | ").
    """
    if not headers:
        return ""
    col_label = " | ".join(headers)
    if prefix:
        col_line = f"[{prefix}Columns: {col_label}]"
    else:
        col_line = f"[Columns: {col_label}]"
    blocks: list[str] = []
    for i in range(0, max(len(rows), 1), _TABLE_ROWS_PER_CHUNK):
        batch = rows[i : i + _TABLE_ROWS_PER_CHUNK]
        row_text = "\n".join("\t".join(str(c) for c in row) for row in batch)
        blocks.append(f"{col_line}\n{row_text}" if row_text else col_line)
    return "\n\n".join(blocks)


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
        sheet_blocks: list[str] = []
        for ws in wb.worksheets:
            all_ws_rows = [
                [str(c.value) if c.value is not None else "" for c in row]
                for row in ws.iter_rows()
            ]
            non_empty = [r for r in all_ws_rows if any(cell.strip() for cell in r)]
            if len(non_empty) < 2:
                continue
            ws_headers = [
                cell.strip() if cell.strip() and not cell.strip().lstrip("-").isnumeric()
                else f"Column {i + 1}"
                for i, cell in enumerate(non_empty[0])
            ]
            ws_data_rows = non_empty[1:]
            prefix = f"Sheet: {ws.title} | "
            body = _tabular_text_blocks(ws_headers, ws_data_rows, prefix=prefix)
            sheet_blocks.append(f"## Sheet: {ws.title}\n{body}")
        return "\n\n".join(sheet_blocks)

    if mime_type in ("text/csv", "application/csv"):
        try:
            decoded_csv = raw.decode("utf-8-sig")
        except UnicodeDecodeError:
            decoded_csv = raw.decode("latin-1")
        try:
            csv_dialect = csv.Sniffer().sniff(decoded_csv[:2048], delimiters=",;\t|")
        except csv.Error:
            csv_dialect = None
        csv_kwargs: dict = {"dialect": csv_dialect} if csv_dialect else {}
        csv_all_rows = [
            r for r in csv.reader(io.StringIO(decoded_csv), **csv_kwargs)
            if any(cell.strip() for cell in r)
        ]
        if not csv_all_rows:
            return ""
        csv_headers = [
            cell.strip() if cell.strip() and not cell.strip().lstrip("-").isnumeric()
            else f"Column {i + 1}"
            for i, cell in enumerate(csv_all_rows[0])
        ]
        csv_data_rows = csv_all_rows[1:]
        return _tabular_text_blocks(csv_headers, csv_data_rows)

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

    if mime_type in ("message/rfc822", "application/vnd.ms-outlook", "application/x-msg"):
        from app.services.email_extraction_service import (  # noqa: PLC0415
            parse_eml_bytes,
            parse_msg_bytes,
            format_email_text_for_retrieval,
        )
        if mime_type == "message/rfc822":
            parsed_email = parse_eml_bytes(raw)
        else:
            parsed_email = parse_msg_bytes(raw)
        return format_email_text_for_retrieval(parsed_email)

    if mime_type in ("application/dxf", "image/vnd.dxf", "application/x-dxf"):
        from app.services.extractors.aspects.dxf import extract_dxf_takeoff  # noqa: PLC0415
        try:
            takeoff = extract_dxf_takeoff(raw)
            return takeoff.get("text_summary", "")
        except Exception as exc:
            return f"CAD Drawing (unparsed DXF: {exc})"

    # ── SEED-226 / 233-UAT item 8 — an uploaded image IS its text.
    #
    # ⚠ THIS ARM MUST STAY BELOW THE DXF ARM. `image/vnd.dxf` is one of the three mimes
    #   Windows reports for an AutoCAD drawing; it is a CAD file wearing an `image/*` label,
    #   and sending it to a vision model would transcribe nothing while the real parser sat
    #   one branch away.
    #
    # ⚠ It returns "" rather than raising when the model yields nothing, so the caller's
    #   normal empty-text path runs and `_IMAGE_EMPTY_TEXT` explains it.
    if mime_type in IMAGE_MIME_TYPES:
        from app.services.extractors.aspects import vision_text  # noqa: PLC0415
        try:
            page = vision_text.image_to_png_b64(raw)
        except ValueError:
            # Bytes that are not a readable image at all. Say so as the document's text so
            # the failure is legible in the UI rather than an empty chunk list.
            return ""
        # load_app_settings is sync/cache-only — the same call the ingest path makes.
        _image_settings = load_app_settings()
        # ⚠ "no text was found" and "nothing looked at it" are DIFFERENT FACTS and this is the
        #   only place that can still tell them apart. Below, both arrive as "" and collapse
        #   into `_IMAGE_EMPTY_TEXT` — which says the image was READ, and would be a lie.
        #   A plain ValueError is the right shape: `splice_document` catches any exception from
        #   here and writes it verbatim into `error_message` with status `failed`, so the
        #   sentence below is what the person actually reads on the row.
        if not vision_text.resolve_vision_model(_image_settings):
            raise ValueError(_IMAGE_NO_VISION_MODEL)
        return vision_text.transcribe_pages([page], "scan", _image_settings)

    # plain text, markdown — decode as UTF-8
    decoded = raw.decode("utf-8")

    # ── BUG-260825-02 — HTML WAS RETURNED UNCHANGED, TAGS AND ALL.
    #
    # ⚠ MEASURED: `extract_text(raw, "text/html")` returned its input BYTE-IDENTICAL, so every
    #   `<h1>`/`<p>`/`<script>` flowed into the chunk text, into the embeddings, and into
    #   whatever the agent later quoted to a person. It is a SILENT quality defect — the upload
    #   succeeds, the chunk count looks sane, nothing errors — which is why nothing caught it.
    #
    # ⚠ THE CONVERTER IS THE EMAIL PARSER'S, NOT A SECOND ONE. `html_to_plain_text` is stdlib
    #   `html.parser` only: it drops `<script>`/`<style>`/`<head>` bodies, turns block tags into
    #   newlines and unescapes entities. Reaching for `beautifulsoup4` instead would have
    #   shipped a CLOUD-ONLY `ImportError` — bs4 is installed in the local venv but is NOT
    #   declared in `backend/requirements.txt`, so the deployed image does not have it.
    if mime_type == "text/html":
        from app.services.email_extraction_service import html_to_plain_text  # noqa: PLC0415
        return html_to_plain_text(decoded)

    return decoded


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
    supabase: Client = Depends(get_user_supabase_client),
    # D-05 carve-out: the detached BackgroundTask writers below (`_upload_pipeline` +
    # `write_audit_entry`) stay service-role — the ingest pipeline writes `pdf_extraction_runs`,
    # which has RLS enabled but NO `authenticated` INSERT policy, so a user-JWT client would be
    # silently denied. Request-scoped work above uses the RLS-enforced `supabase`.
    service_supabase: Client = Depends(get_supabase),
):
    # Normalize mime type (strip charset suffix)
    mime_type = (file.content_type or "").split(";")[0].strip()

    # Browsers / OS often misreport MIME types for these formats — normalise by extension
    filename = file.filename or ""
    ext = "." + filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if mime_type in _UNRELIABLE_MIME_TYPES and ext in _EXT_MIME_OVERRIDES:
        mime_type = _EXT_MIME_OVERRIDES[ext]

    if mime_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            # D-217-18 class of lie: the prose list named four formats while
            # ALLOWED_MIME_TYPES (:91) holds fifteen. Derive it, never re-type it.
            detail=(
                f"Unsupported file type: {mime_type}. "
                f"Allowed: {', '.join(sorted(ALLOWED_MIME_TYPES))}."
            ),
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

    # Phase 229 (TRUST-01) — unified minting via async_mint_document_row
    from app.services.ingest_splice import async_mint_document_row  # noqa: PLC0415

    mint_result = await async_mint_document_row(
        raw=raw,
        filename=filename,
        mime_type=mime_type,
        user_id=current_user["id"],
        supabase=supabase,
        folder_id=folder_id,
    )
    doc = mint_result.document

    if mint_result.is_duplicate:
        response.status_code = status.HTTP_200_OK
        return doc

    # Phase 230 (QUEUE-01 / H-3): Cut over /documents/upload to durable ingestion_jobs
    # 1. Store raw uploaded bytes durably in Supabase Storage immediately
    try:
        service_supabase.storage.from_("documents").upload(
            path=mint_result.storage_path,
            file=raw,
            file_options={"content-type": mime_type},
        )
    except Exception as up_exc:
        # ── BUG-260905-08 — NO BYTES MEANS NO DOCUMENT. STOP HERE. ──────────────────────
        #
        # ⛔ THIS USED TO LOG A WARNING AND CARRY ON, and the result was a document row that
        #    reported `completed` while its file did not exist. MEASURED on the operator's
        #    library: `Screenshot 2026-05-29 042925.png` uploaded at 19:56, reached
        #    `status=completed` with `chunk_count=0`, an EMPTY `error_message`, and a 404 from
        #    storage on its own `file_path`. It looks like a successful upload on the shelf and
        #    is unusable by everything downstream — re-ingest, preview, download, and the
        #    SEED-226 vision pass all need the bytes this step was supposed to keep.
        #
        # ⚠ ENQUEUEING AFTER THIS FAILS IS WORSE THAN NOT ENQUEUEING. The worker fetches the
        #   file from storage; with nothing there it produces an empty document that still
        #   completes. A visible refusal is the only outcome a person can act on.
        log.error(
            "Storage upload during /upload FAILED for %s (%s): %s — marking the document "
            "failed rather than ingesting a file that does not exist",
            doc["id"],
            mint_result.storage_path,
            up_exc,
        )
        try:
            service_supabase.table("documents").update({
                "status": "failed",
                "ingestion_step": "failed",
                "error_message": (
                    "This file could not be stored, so nothing was read from it. "
                    "Please try uploading it again."
                ),
            }).eq("id", doc["id"]).execute()
        except Exception:  # noqa: BLE001 — the refusal write must not double-fault
            log.exception("could not mark %s failed after a storage failure", doc["id"])
        response.status_code = status.HTTP_201_CREATED
        return {**doc, "status": "failed"}

    # 2. Enqueue durable job into ingestion_jobs
    from app.db.ingestion_jobs import insert_ingestion_job  # noqa: PLC0415
    from uuid import UUID  # noqa: PLC0415
    from app.config import settings  # noqa: PLC0415

    raw_user_id = current_user.get("id")
    raw_org_id = current_user.get("org_id")
    user_uuid = UUID(str(raw_user_id)) if raw_user_id else None
    org_uuid = UUID(str(raw_org_id)) if raw_org_id else None
    doc_uuid = UUID(str(doc["id"]))

    try:
        from app.dependencies import get_pg_pool  # noqa: PLC0415
        pool = await get_pg_pool()
        if user_uuid is not None:
            await insert_ingestion_job(
                pool,
                document_id=doc_uuid,
                user_id=user_uuid,
                org_id=org_uuid,
            )
        else:
            raise ValueError("user_uuid is None")
    except Exception as q_exc:
        log.warning(
            "Asyncpg enqueue failed for %s (%s); inserting via service_supabase",
            doc["id"],
            q_exc,
        )
        try:
            service_supabase.table("ingestion_jobs").insert({
                "document_id": str(doc_uuid),
                "user_id": str(user_uuid) if user_uuid else str(raw_user_id),
                "org_id": str(org_uuid) if org_uuid else None,
                "status": "pending",
                "stage": "pending",
                "progress": {},
                "max_retries": 3,
            }).execute()
        except Exception as sb_exc:
            log.error("Failed to insert ingestion_job via supabase: %s", sb_exc)

    # 3. Fallback to BackgroundTask ONLY if ingest_worker_enabled is explicitly False
    if not getattr(settings, "ingest_worker_enabled", True):
        engines_dict = _parse_engines_hint(engines)
        background_tasks.add_task(
            _upload_pipeline,
            doc["id"],
            raw,
            mime_type,
            filename,
            current_user["id"],
            mint_result.storage_path,
            service_supabase,
            engines_dict,
        )

    background_tasks.add_task(
        write_audit_entry,
        user_id=current_user["id"],
        action_type="document.upload",
        metadata={"document_id": doc["id"], "filename": doc["filename"], "folder_id": folder_id},
        supabase=service_supabase,
    )

    response.status_code = status.HTTP_201_CREATED
    return doc


@router.get("", response_model=list[DocumentResponse])
async def list_documents(
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_user_supabase_client),
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
    supabase: Client = Depends(get_user_supabase_client),
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


# ── Phase 217 · LIB-04 — the four buried facts, put on the wire ───────────────────────
#
# The parsed text, the chunks, the tables and the images have been in Postgres since
# migration 002 and no route ever read any of them. All four are user-JWT + RLS, all four
# 404 before they read, and every query goes through `aexec` (D-v2.5-01) — the two nearest
# neighbours above run the sync builder bare inside an `async def` and are the OUTLIERS, not
# the house style (`run_in_threadpool` is used 55 times elsewhere in this file).
# ⚠ The literal token is deliberately not written here: the fence that proves no new bare
# call was added counts occurrences file-wide, so a comment naming it would dilute it.

# T-217-07 — the paging bound, chosen from a MEASURED worst case rather than a round
# number. Local DB, 2026-08-29: 64 documents / 61 with text; MAX 266,773 chars and MAX
# 6,402 lines in a single document; mean 14,684 chars / 201 lines.
CONTENT_PAGE_LINES = 500   # default page when `end_line` is omitted — one request covers
                           # the mean document (201 lines) whole.
CONTENT_MAX_LINES = 2000   # hard cap on ANY explicitly requested span, so a caller cannot
                           # ask for an unbounded body. The measured worst case needs 4
                           # requests; `has_more` tells the client there is more.


async def _assert_document_visible(document_id: str, user_id: str, supabase: Client) -> dict:
    """Shared 404-before-read gate for the four Phase 217 detail routes.

    Mirrors `list_documents`' visibility rule — OWNER **or** a globally-visible folder —
    so the detail panel cannot 404 a document the list just rendered. Returns the parent
    row; raises 404 with the shipped `detail` string when the caller cannot see it.

    T-217-04 / T-217-05: `document_id` is never trusted as an authorization claim. It
    selects a row the ownership filter must ALSO match, and an invisible document is a
    404 — never an empty 200, which would confirm the id exists.
    """
    try:
        res = await aexec(
            supabase.table("documents")
            .select("id, filename, user_id, folder_id")
            .eq("id", document_id)
            .eq("user_id", user_id)
            .maybe_single()
        )
    except Exception:
        log.debug("visibility check raised on the owner arm for document %s", document_id)
        res = None
    if res is not None and getattr(res, "data", None):
        return res.data

    global_folder_ids = await get_globally_visible_folder_ids(supabase, user_id)
    if global_folder_ids:
        try:
            res = await aexec(
                supabase.table("documents")
                .select("id, filename, user_id, folder_id")
                .eq("id", document_id)
                .in_("folder_id", global_folder_ids)
                .maybe_single()
            )
        except Exception:
            log.debug("visibility check failed for document %s (global-folder arm)", document_id)
            res = None
        if res is not None and getattr(res, "data", None):
            return res.data

    raise HTTPException(status_code=404, detail="Document not found")


@router.get("/{document_id}/content", response_model=DocumentContentResponse)
async def get_document_content(
    document_id: str,
    start_line: int = Query(1, ge=1, description="First line to return (1-based, inclusive)"),
    end_line: int | None = Query(
        None, ge=1,
        description="Last line to return (1-based, inclusive). Omitted = one page of 500 lines.",
    ),
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_user_supabase_client),
):
    """The document's parsed text, sliced to a line range, WITHOUT line numbers.

    Three deliberate divergences from `GET /kb/read`, each of which is the point:

    1. `numbered=False` — `read_path` glues `42: ` onto every line for the AGENT, which
       needs addressable lines to cite. A PERSON reading their own document must not get
       that, and it breaks Markdown rendering outright (D-217-05).
    2. An EMPTY document is `200` with `content=""` / `total_lines=0`. `kb.py`'s route
       folds "No content available for this document." into a 404; an empty-text document
       is not a MISSING document, and the Library section renders its own empty arm.
    3. The envelope carries `has_more`, so the client's "Load more" condition is
       unambiguous rather than re-derived.

    A document that genuinely is not visible to the caller is still 404 with the shipped
    `detail="Document not found"`.
    """
    # 1. 404 before read — the shared gate, not a per-route variant.
    doc = await _assert_document_visible(document_id, current_user["id"], supabase)

    # 2. Bound the slice (T-217-07). An omitted end_line is ONE page, not the whole
    #    document; an explicit span is capped, so no request can be unbounded.
    requested_end = end_line if end_line is not None else start_line + CONTENT_PAGE_LINES - 1
    requested_end = max(requested_end, start_line)
    effective_end = min(requested_end, start_line + CONTENT_MAX_LINES - 1)

    # 3. ONE slicer, two callers (D-217-05).
    result = await read_path(
        document_id, current_user["id"], supabase, start_line, effective_end, numbered=False
    )

    if "error" in result:
        if result.get("error_kind") == "not_found":
            # Defence in depth — the gate above already answered this.
            raise HTTPException(status_code=404, detail="Document not found")
        # "empty" (no parsed text at all) and "range" (a page that starts past the end)
        # are BOTH honest 200s. Only an invisible document is a 404.
        return DocumentContentResponse(
            document_id=document_id,
            filename=result.get("filename") or doc["filename"],
            total_lines=result.get("total_lines", 0),
            content="",
            start_line=None,
            end_line=None,
            has_more=False,
        )

    total_lines = result["total_lines"]
    served_end = result["end_line"]
    return DocumentContentResponse(
        document_id=document_id,
        filename=result["filename"],
        total_lines=total_lines,
        content=result["content"],
        start_line=result["start_line"],
        end_line=served_end,
        has_more=served_end < total_lines,
    )


@router.get("/{document_id}/chunks", response_model=list[DocumentChunkRow])
async def list_document_chunks(
    document_id: str,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_user_supabase_client),
):
    """The chunks this document was split into, in index order.

    `embedding_model` / `embedding_dimensions` ride this route because their PER-CHUNK
    variation mid-re-embed is the whole point (D-217-08): a half-re-embedded document is
    a fact the Library can show and nothing else can.
    """
    # 1. Verify doc exists and user has access
    await _assert_document_visible(document_id, current_user["id"], supabase)
    # 2. Fetch the chunks — an empty result is 200 + [], never a 404.
    res = await aexec(
        supabase.table("document_chunks")
        .select("id, chunk_index, content, embedding_model, embedding_dimensions")
        .eq("document_id", document_id)
        .order("chunk_index")
    )
    return res.data or []


# ⚠ THE RLS ASYMMETRY BELOW IS CORRECT BEHAVIOUR, NOT A DEFECT — encode it, do not "fix" it.
#
# `document_chunks` SELECT was WIDENED to owner-OR-globally-visible-folder by migration
# 110 (`110_secdef_org_scope_audit.sql:215-223`, PRAG-01 / D-164-07). `document_tables` and
# `document_images` were left owner-only by migration 108
# (`108_rls_membership_rewrite.sql:180-189` — a single `FOR ALL` policy, `user_id = auth.uid()`,
# with no folder branch).
#
# So a document visible only through SOMEONE ELSE'S globally-visible folder returns text and
# chunks, and an EMPTY LIST of tables and images. The panel does not lie about it: the shipped
# `table_count` / `image_count` aggregate in `list_documents` is computed through the same
# user-JWT client, so the row's count badge already reads 0 and the section agrees with it.
# Widening those two policies is a migration and a security decision — out of this phase.


@router.get("/{document_id}/tables", response_model=list[DocumentTableRow])
async def list_document_tables(
    document_id: str,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_user_supabase_client),
):
    """The tables extracted from this document, in extraction order.

    Owner-only by migration 108 — see the asymmetry note above. An empty list is a normal
    200: this document has no tables, or the caller reaches it through a shared folder.
    """
    # 1. Verify doc exists and user has access
    await _assert_document_visible(document_id, current_user["id"], supabase)
    # 2. Fetch the tables — an empty result is 200 + [], never a 404.
    res = await aexec(
        supabase.table("document_tables")
        .select("id, page, table_index, headers, rows, extractor")
        .eq("document_id", document_id)
        .order("table_index")
    )
    return res.data or []


@router.get("/{document_id}/images", response_model=list[DocumentImageRow])
async def list_document_images(
    document_id: str,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_user_supabase_client),
):
    """The image DESCRIPTIONS extracted from this document, in extraction order.

    ⚠ The table stores no picture — the encoded PNG is handed to the vision model and
    discarded — so the description IS the image here and the select names only the columns
    that exist. Owner-only by migration 108, same asymmetry note as tables.
    """
    # 1. Verify doc exists and user has access
    await _assert_document_visible(document_id, current_user["id"], supabase)
    # 2. Fetch the image descriptions — an empty result is 200 + [], never a 404.
    res = await aexec(
        supabase.table("document_images")
        .select("id, page, image_index, description")
        .eq("document_id", document_id)
        .order("image_index")
    )
    return res.data or []


@router.post("/{document_id}/restore", response_model=DocumentResponse)
async def restore_document_version(
    document_id: str,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_user_supabase_client),
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
    supabase: Client = Depends(get_user_supabase_client),
    # D-05 carve-out: the detached `_upload_pipeline` BackgroundTask stays service-role — it
    # writes `pdf_extraction_runs` (RLS-enabled, NO `authenticated` INSERT policy). The
    # request-scoped owner SELECT / storage download / chunk-cascade delete / status UPDATE
    # above run on the RLS-enforced `supabase`.
    service_supabase: Client = Depends(get_supabase),
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
        service_supabase,    # D-05: detached pipeline stays service-role (pdf_extraction_runs INSERT)
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
    supabase: Client = Depends(get_user_supabase_client),
    # D-05 carve-out: the detached `ingest_document` BackgroundTask stays service-role — it
    # writes `pdf_extraction_runs` (RLS-enabled, NO `authenticated` INSERT policy) + runs the
    # global-rule classification splice. The request-scoped owner SELECT / storage download /
    # delete-cascade / status UPDATE / the awaited `_reextract_refill_empty_descriptions` above
    # run on the RLS-enforced `supabase`.
    service_supabase: Client = Depends(get_supabase),
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
        service_supabase,    # D-05: detached ingest writer stays service-role (pdf_extraction_runs INSERT)
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
    supabase: Client = Depends(get_user_supabase_client),
    # D-05 carve-out: the detached `write_audit_entry` BackgroundTask stays service-role
    # (uniform with the other BackgroundTask-spawning handlers). The request-scoped owner
    # SELECT / storage remove / owner-scoped DELETE / sibling-promote above run on the
    # RLS-enforced `supabase`.
    service_supabase: Client = Depends(get_supabase),
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
        supabase=service_supabase,   # D-05: detached audit writer stays service-role
    )


@router.patch("/{document_id}/move", response_model=DocumentResponse)
async def move_document(
    document_id: str,
    body: DocumentMoveRequest,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_user_supabase_client),
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
            .or_(f"user_id.eq.{current_user['id']},is_org_shared.eq.true")
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
    supabase: Client = Depends(get_user_supabase_client),
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


@router.patch("/{document_id}/classification/accept", response_model=DocumentResponse)
async def accept_classification(
    document_id: str,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_user_supabase_client),
):
    """Phase 118 CLASS-03 — accept a classification suggestion (reversible move + audit).

    Records the doc's PRIOR folder_id into the suggestion object (for Undo, D-118-6),
    re-validates the suggested target folder is still readable (own+global; the FK is
    ON DELETE SET NULL — Pitfall 5), moves the doc, marks status="accepted", and writes
    a `classification.apply` audit row ONLY after the move succeeds (the 112/116 honesty
    discipline — never optimistic). Owner-scoped on BOTH the SELECT and the UPDATE → 404
    (never the forbidden status) on a non-owner / absent / no-active-suggestion miss (no
    existence leak).

    Undo needs NO endpoint — the frontend reverses via the EXISTING PATCH
    /documents/{id}/move with the stamped prior_folder_id. Every `.execute()` is
    threadpool-wrapped (D-v2.5-01 — this is an async handler; follow update_document_metadata,
    not move_document's raw .execute()).
    """
    # 1. Owner SELECT (404 on miss, never the forbidden status) — threadpool-wrapped (D-v2.5-01).
    try:
        doc = await run_in_threadpool(
            lambda: supabase.table("documents")
            .select("folder_id, metadata")
            .eq("id", document_id)
            .eq("user_id", current_user["id"])
            .maybe_single()
            .execute()
        )
    except Exception:
        raise HTTPException(status_code=404, detail="Document not found")
    if not doc or not getattr(doc, "data", None):
        raise HTTPException(status_code=404, detail="Document not found")

    # 2. Require an ACTIVE "suggested" suggestion with a target folder (else 404 — no
    #    over-broad accept; never reveals whether the doc exists vs has no suggestion).
    sugg = (doc.data.get("metadata") or {}).get("_classification") or {}
    target = sugg.get("suggested_folder_id")
    if not target or sugg.get("status") != "suggested":
        raise HTTPException(status_code=404, detail="No active suggestion")

    # 3. Re-validate the target folder is readable (own+global) — Pitfall 5 (clone
    #    move_document:1325-1335). A deleted/unreadable folder → uniform 404.
    from app.utils.db import coerce_uid  # noqa: PLC0415
    caller_uid = coerce_uid(current_user["id"])  # AR-118-01: coerced owner-scoping gate
    try:
        folder = await run_in_threadpool(
            lambda: supabase.table("folders")
            .select("id")
            .eq("id", str(target))
            .or_(f"user_id.eq.{caller_uid},is_org_shared.eq.true")
            .maybe_single()
            .execute()
        )
    except Exception:
        raise HTTPException(status_code=404, detail="Folder not found")
    if not folder or not getattr(folder, "data", None):
        raise HTTPException(status_code=404, detail="Folder not found")

    # 4. Record the prior folder (Undo, D-118-6), mark accepted, ONE owner-scoped UPDATE
    #    writing folder_id + the marked metadata (the move + the suggestion stamp together).
    prior_folder = doc.data.get("folder_id")
    meta = dict(doc.data.get("metadata") or {})
    meta["_classification"] = {**sugg, "status": "accepted", "prior_folder_id": prior_folder}
    result = await run_in_threadpool(
        lambda: supabase.table("documents")
        .update({"folder_id": str(target), "metadata": meta})
        .eq("id", document_id)
        .eq("user_id", current_user["id"])
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Document not found")

    # 5. Audit ONLY after the move succeeds (never optimistic). classification.apply is
    #    LIVE in VALID_ACTION_TYPES — write_audit_entry swallows errors so the live
    #    round-trip is the verification.
    await write_audit_entry(
        user_id=current_user["id"],
        action_type="classification.apply",
        metadata={
            "document_id": document_id,
            "rule_id": sugg.get("rule_id"),
            "from_folder": prior_folder,
            "to_folder": str(target),
        },
        supabase=supabase,
    )
    return result.data[0]


@router.patch("/{document_id}/classification/dismiss", response_model=DocumentResponse)
async def dismiss_classification(
    document_id: str,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_user_supabase_client),
):
    """Phase 118 CLASS-03 — dismiss a classification suggestion (clear, no move, no audit).

    Owner-scoped SELECT of the metadata → pop `_classification` → owner-scoped UPDATE of
    the metadata. NO folder move, NO audit (dismiss is a non-action that clears a
    suggestion; the rule itself is untouched). Owner-scoped on BOTH the SELECT and the
    UPDATE → 404 (never the forbidden status) on a non-owner / absent miss.
    Threadpool-wrapped (D-v2.5-01).
    """
    # 1. Owner SELECT (404 on miss, never the forbidden status) — threadpool-wrapped (D-v2.5-01).
    try:
        doc = await run_in_threadpool(
            lambda: supabase.table("documents")
            .select("metadata")
            .eq("id", document_id)
            .eq("user_id", current_user["id"])
            .maybe_single()
            .execute()
        )
    except Exception:
        raise HTTPException(status_code=404, detail="Document not found")
    if not doc or not getattr(doc, "data", None):
        raise HTTPException(status_code=404, detail="Document not found")

    # 2. Pop _classification → owner-scoped UPDATE of the metadata (no move, no audit).
    meta = dict(doc.data.get("metadata") or {})
    meta.pop("_classification", None)
    result = await run_in_threadpool(
        lambda: supabase.table("documents")
        .update({"metadata": meta})
        .eq("id", document_id)
        .eq("user_id", current_user["id"])
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Document not found")
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

    # ── BUG-260825-01 — STRIP THE CHARACTERS POSTGRES CANNOT STORE, ONCE, HERE.
    #
    # ⚠ MEASURED 2026-08-25 through the real `POST /documents/upload`: a `.txt` and a `.csv`
    #   carrying a single NUL both reached `status=failed` / `ingestion_step=embedding` with
    #   `22P05: unsupported Unicode escape sequence — a NUL cannot be converted to text`.
    #   That is the Phase 203 `.msg` failure exactly, one path over: three other paths in this
    #   codebase strip NUL (`agent_loop.py`, `tool_dispatcher.py` x2, and the email parser via
    #   `scrub_text`) and the DOCUMENT path stripped nothing at all.
    #
    # ⚠ THIS IS THE FUNNEL, WHICH IS WHY IT IS THE ONLY SITE. `/upload`, `/reingest`,
    #   `/reextract` and the email-attachment cascade ALL call `ingest_document` — scrubbing at
    #   `extract_text` instead would miss the PDF/DOCX composer branch, which does not go
    #   through it. Everything downstream (chunks, embeddings, and the metadata sample, which is
    #   derived from `text`) reads the scrubbed value.
    #
    # ⚠ IT CANNOT SAVE EVERY FILE AND MUST NOT BE READ AS IF IT COULD: a `.docx` carrying a NUL
    #   dies earlier inside `python-docx` (`Char 0x0 out of allowed range` — XML forbids NUL),
    #   so no text is ever produced for this to clean. Measured the same day.
    from app.services.text_sanitize import scrub_text  # noqa: PLC0415
    text = scrub_text(text)

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

        # ── BUG-260905-06 — ONE ENRICHMENT STEP, SHARED WITH THE QUEUE ──────────────────
        #
        # ⛔ THIS BLOCK USED TO LIVE INLINE HERE, AND THAT IS EXACTLY WHY IT WENT MISSING.
        #   Phase 230's durable queue does not call this function at all — `splice_document`
        #   returns early into its own chunk/embed loop when it has a `job_id` — so every
        #   uploaded document since that cutover reached `completed` with no metadata, no
        #   chunk header and no vision transcription. Moving the logic to
        #   `services/ingest_enrich.py` is what makes both paths run the same code rather
        #   than two copies that drift.
        enriched = enrich_for_ingest(
            document_id=document_id,
            text=text,
            raw=raw,
            mime_type=mime_type,
            filename=filename,
            user_id=user_id,
            supabase=supabase,
            app_settings=app_settings,
        )
        text = enriched.text
        metadata_dict = enriched.metadata
        supabase.table("documents").update({"ingestion_step": "chunking"}).eq("id", document_id).execute()
        chunks = chunk_text(text)
        if not chunks:
            supabase.table("documents").update({
                "status": "failed",
                # 203 follow-up — say what is true of the FILE, not of the extractor.
                "error_message": empty_text_message(mime_type),
            }).eq("id", document_id).execute()
            return

        context_header = enriched.context_header

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
                # BE-1 (217.1): the honest "when the vector was written" timestamp.
                # created_at is the CHUNKING time and never moves on a re-embed —
                # printing it as "last indexed" would be a lie after the first re-index.
                "embedded_at": datetime.now(timezone.utc).isoformat(),
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

        # Phase 203 (EML-02) / Phase 229 (TRUST-01, SC#3, G-2): Email attachment extraction & isolated cascade
        if mime_type in ("message/rfc822", "application/vnd.ms-outlook", "application/x-msg"):
            try:
                from app.services.email_extraction_service import parse_eml_bytes, parse_msg_bytes  # noqa: PLC0415
                from app.services.ingest_splice import mint_document_row  # noqa: PLC0415

                parsed_email = parse_eml_bytes(raw) if mime_type == "message/rfc822" else parse_msg_bytes(raw)
                attachment_manifest = []

                for att in parsed_email.attachments:
                    if not att.raw or not att.filename:
                        continue

                    att_doc_id: str | None = None
                    try:
                        att_ext = "." + att.filename.rsplit(".", 1)[-1].lower() if "." in att.filename else ""
                        att_mime = att.content_type
                        if att_mime in _UNRELIABLE_MIME_TYPES and att_ext in _EXT_MIME_OVERRIDES:
                            att_mime = _EXT_MIME_OVERRIDES[att_ext]

                        if att_mime not in ALLOWED_MIME_TYPES:
                            attachment_manifest.append({
                                "filename": att.filename,
                                "status": "skipped",
                                "error": f"MIME type {att_mime} not allowed",
                            })
                            continue

                        # Mint row with on_conflict="link" (G-2):
                        # Handles exact duplicate attachment or concurrent ingest collision without failing
                        mint_result = mint_document_row(
                            raw=att.raw,
                            filename=att.filename,
                            mime_type=att_mime,
                            user_id=user_id,
                            supabase=supabase,
                            folder_id=None,
                            on_conflict="link",
                        )
                        att_doc = mint_result.document
                        att_doc_id = att_doc["id"]

                        # Link relationship ('attached_to')
                        try:
                            supabase.table("document_relationships").insert({
                                "user_id": user_id,
                                "source_doc_id": att_doc_id,
                                "target_doc_id": document_id,
                                "rel_type": "attached_to",
                            }).execute()
                        except Exception as rel_err:
                            log.warning("Failed to link attachment %s -> %s: %s", att_doc_id, document_id, rel_err)

                        if mint_result.is_duplicate:
                            attachment_manifest.append({
                                "filename": att.filename,
                                "status": "linked",
                                "document_id": att_doc_id,
                                "is_duplicate": True,
                            })
                            continue

                        # New document: upload to storage
                        supabase.storage.from_("documents").upload(
                            path=mint_result.storage_path,
                            file=att.raw,
                            file_options={"content-type": att_mime},
                        )

                        # Extract and ingest child document
                        att_text = extract_text(att.raw, att_mime)
                        ingest_document(
                            document_id=att_doc_id,
                            text=att_text,
                            user_id=user_id,
                            supabase=supabase,
                            raw=att.raw,
                            mime_type=att_mime,
                            filename=att.filename,
                            engine_override="legacy",
                        )
                        attachment_manifest.append({
                            "filename": att.filename,
                            "status": "completed",
                            "document_id": att_doc_id,
                        })

                    except Exception as att_err:
                        log.warning(
                            "Email attachment '%s' processing failed for parent %s: %s",
                            att.filename,
                            document_id,
                            att_err,
                        )
                        if att_doc_id:
                            try:
                                supabase.table("documents").update({
                                    "status": "failed",
                                    "ingestion_step": "failed",
                                    "error_message": str(att_err)[:250],
                                }).eq("id", att_doc_id).execute()
                            except Exception:
                                pass
                        attachment_manifest.append({
                            "filename": att.filename,
                            "status": "failed",
                            "error": str(att_err)[:250],
                        })

                if attachment_manifest:
                    metadata_dict = metadata_dict or {}
                    metadata_dict["attachments"] = attachment_manifest

            except Exception as att_exc:
                log.warning("Email attachment extraction loop warning for %s: %s", document_id, att_exc)

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
        # `.or_(user_id.eq.{uploader},is_system_global.eq.true)` predicate (Pitfall 3, D-118-8): an
        # unscoped select would return ALL users' rules. A global rule is evaluated against
        # the uploader's OWN metadata_dict only. sync .execute() — D-v2.5-01 does NOT fire.
        if metadata_dict:  # no metadata → nothing to match (never blocks ingest)
            try:
                from app.services import classification_matcher  # noqa: PLC0415
                from app.utils.db import coerce_uid  # noqa: PLC0415
                rules = (
                    supabase.table("classification_rules").select("*")
                    # AR-118-01: coerce the interpolated uploader id (service-role read,
                    # RLS bypassed — this app-code predicate is the SOLE owner gate).
                    .or_(f"user_id.eq.{coerce_uid(user_id)},is_system_global.eq.true")  # D-118-8 own + global
                    .eq("enabled", True)
                    .order("is_system_global").order("created_at")  # owner(false) before global(true); oldest first (D-118-4)
                    .execute()
                ).data or []
                # AR-118-02: fail-closed Python re-filter — the same defense-in-depth the
                # sibling service-role own+global reads carry (read_enabled_field_defs,
                # list_rules). `(A OR B) AND enabled` is correct today, but this guarantees
                # a malformed/over-broad result can NEVER evaluate another user's rule
                # against this uploader's metadata (the phase's highest-stakes leak site).
                rules = [r for r in rules if r.get("is_system_global") or str(r.get("user_id")) == str(user_id)]
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

        # chunk_count = TOTAL searchable rows for the document (text chunks +
        # image-description chunks inserted by multimodal_service.extract_and_store_images).
        # This write happens AFTER multimodal insert, so a count(*) is authoritative and
        # self-correcting regardless of how many image chunks were added — the UI now
        # reflects the real chunk total (e.g. 433), not text-only density (410). Falls
        # back to len(chunks) if the count read fails so it can NEVER block completion.
        # Consistent across /upload, /reingest, /reextract (all hit this write site).
        try:
            _count_resp = (
                supabase.table("document_chunks")
                .select("id", count="exact", head=True)
                .eq("document_id", document_id)
                .execute()
            )
            _total_chunk_count = _count_resp.count if _count_resp.count is not None else len(chunks)
        except Exception:  # noqa: BLE001 — count read NEVER blocks completion
            log.warning("chunk_count total recount failed; using text-chunk count", exc_info=True)
            _total_chunk_count = len(chunks)

        # ── BUG-260905-07 — A FAILED EXTRACTION MUST NOT DESTROY A GOOD ONE ──────────────
        #
        # ⛔ THIS WRITE USED TO PASS `"metadata": metadata_dict` UNCONDITIONALLY, AND THAT IS
        #    DATA LOSS ON RE-INGEST. Enrichment degrades to None on ANY failure — a provider
        #    error, a timeout, a model that would not emit — and every one of those is
        #    swallowed by design (D-111-8: "a metadata failure never breaks ingestion").
        #    Writing that None over an existing row turned a transient provider blip into the
        #    permanent erasure of a title, date, type and every custom field the document had.
        #
        # ⚠ OBSERVED BY THE OPERATOR, not by a test: re-ingesting a document that HAD metadata
        #   left it with none. The degradation contract says a metadata failure must not break
        #   the ingestion; it never said it may delete what was already there.
        #
        # ⚠ THE QUEUE PATH ALREADY GOT THIS RIGHT (`if enriched.metadata is not None`), so
        #   leaving this arm unguarded would have re-opened the same two-paths-disagree gap
        #   BUG-260905-06 was just closed to end — in the opposite direction.
        #
        # ⚠ A DELIBERATE CLEAR STILL WORKS. `PATCH /documents/{id}/metadata` writes the field
        #   directly and is unaffected; this guard only stops an ingest from clearing it as a
        #   side effect of failing.
        # ⚠ THE DICT STAYS INLINE, AND THAT IS A CONSTRAINT RATHER THAN A STYLE CHOICE.
        #   `renameFence.test.ts` extracts every status-bearing payload in this file with
        #   `/supabase\.table\("documents"\)\s*\.update\(\{/` and asserts no terminal write
        #   nulls `ingestion_step`. Hoisting this payload into a variable made the ONE
        #   `completed` write invisible to it — the fence went red on a refactor that changed
        #   no behaviour, which is the fence working. The conditional key is therefore spliced
        #   with `**`, keeping the literal where the extractor can see it.
        if metadata_dict is None:
            log.warning(
                "document %s completed with no metadata derived — KEEPING any existing "
                "metadata rather than clearing it",
                document_id,
            )
        supabase.table("documents").update({
            "status": "completed",
            "chunk_count": _total_chunk_count,
            "full_markdown": text,
            # Phase 071 D-071-08 — populate extractor lineage column for new ingests.
            "extractor": engine_used,
            **({"metadata": metadata_dict} if metadata_dict is not None else {}),
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
