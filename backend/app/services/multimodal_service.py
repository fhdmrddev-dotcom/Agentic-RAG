"""
Multi-modal extraction service for Phase 35-36.

Extracts tables (MODAL-01) and images with vision descriptions (MODAL-02)
from PDF and DOCX files during ingestion. All extractions are wrapped in
try/except — any failure silently continues ingestion.
"""
from __future__ import annotations

import base64
import io
import logging
from typing import TYPE_CHECKING

from supabase import Client

from app.services.embedding_service import embed_texts
from app.utils.db import aexec

if TYPE_CHECKING:
    from app.models.user_settings import UserEffectiveSettings
    from app.services.extraction_service import ExtractedDocument

log = logging.getLogger(__name__)

PDF_MIME = "application/pdf"
DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
CSV_MIMES: frozenset[str] = frozenset({"text/csv", "application/csv"})
EXCEL_MIMES: frozenset[str] = frozenset({
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
})

# Max edge length (px) for PIL.thumbnail() before vision-LLM call (D-072-02).
# OpenAI detail=low downsamples to 512px internally → no quality gain above 1024px.
# Anthropic caps base64 images at 5 MB; uniformly-small thumbnails (~50-200 KB)
# prevent provider rejections + reduce bandwidth. Hardcoded constant per
# CONTEXT.md (third app_setting deferred to v3.1 admin shell).
MULTIMODAL_THUMBNAIL_MAX_EDGE = 1024


def _downscale_b64_for_vision(
    b64_png: str,
    max_edge: int = MULTIMODAL_THUMBNAIL_MAX_EDGE,
) -> str:
    """Downscale b64-encoded PNG to max edge `max_edge` before vision-LLM call.

    D-072-02 invariant — shared between `extract_and_store_images` (Plan 01)
    and `_reextract_refill_empty_descriptions` (Plan 03) so both call sites
    honor the downscale from a single source. Per WARNING 3 of the Phase
    072 checker pass — avoids the regression where the retry path would
    silently bypass the downscale.

    Behavior:
      - PIL.thumbnail preserves aspect ratio; only shrinks (no-op when
        already <= max_edge on the longest edge).
      - Re-encodes to PNG and returns the base64-encoded result.
      - Best-effort: on any PIL decode failure (corrupted bytes, unsupported
        format), returns the input b64 UNCHANGED. Degrades, never raises.

    Args:
        b64_png: base64-encoded PNG (or any PIL-decodable image format).
        max_edge: pixel cap on the longest edge (default
            MULTIMODAL_THUMBNAIL_MAX_EDGE = 1024).

    Returns:
        base64-encoded PNG (possibly downscaled). Same encoding scheme as
        input.
    """
    try:
        from PIL import Image as PILImage  # noqa: PLC0415
        raw_img = base64.b64decode(b64_png)
        pil_img = PILImage.open(io.BytesIO(raw_img))
        if max(pil_img.width, pil_img.height) <= max_edge:
            return b64_png  # no-op
        pil_img.thumbnail((max_edge, max_edge))
        out_buf = io.BytesIO()
        fmt = pil_img.format or "PNG"
        pil_img.save(out_buf, format=fmt)
        return base64.b64encode(out_buf.getvalue()).decode("ascii")
    except Exception as exc:  # noqa: BLE001
        # Degrade to original on decode failure — never raise.
        log.debug(
            "_downscale_b64_for_vision: decode/encode failed: %s — using original", exc
        )
        return b64_png


# ---------------------------------------------------------------------------
# Content-hash dedup helper (D-072-06 EXTENDED — applies to PDF + DOCX paths)
# ---------------------------------------------------------------------------

def _dedup_images_by_hash(images: list) -> list:
    """Drop duplicate images by SHA1 of b64-encoded bytes (D-072-06 EXTENDED).

    Use cases:
      - DOCX templates embed the same logo in header + body + footer; the
        existing `zip_xpath_docx` media-path dedup misses the case where
        the same bytes live under DIFFERENT media paths.
      - PDF documents with repeating headers/footers (logos on every page)
        or figures spanning page boundaries can over-detect when the
        in-process PyMuPDF extractor (or the future `vision_sweep` engine)
        iterates pages independently.

    Hashing the b64-encoded string directly is equivalent to hashing the
    decoded bytes (b64 is a deterministic encoding) and saves a decode
    step. First occurrence wins — preserves the original `image_index`
    ordering downstream extraction relies on.

    Accepts any sequence of objects with a `b64_png` attribute (ImageData)
    OR `["b64_png"]` key (legacy dict). Returns the same type.
    """
    import hashlib  # noqa: PLC0415

    seen: set[str] = set()
    out: list = []
    for im in images:
        # Support both ImageData (attr) and legacy dict shape.
        b64 = getattr(im, "b64_png", None)
        if b64 is None and isinstance(im, dict):
            b64 = im.get("b64_png", "")
        if not b64:
            # Defensive: empty b64 = unique-by-definition; keep it.
            out.append(im)
            continue
        h = hashlib.sha1(b64.encode("ascii")).hexdigest()
        if h in seen:
            continue
        seen.add(h)
        out.append(im)
    return out


# ---------------------------------------------------------------------------
# Table extraction helpers (module-level so tests can patch them)
# ---------------------------------------------------------------------------

def extract_pdf_tables(raw: bytes) -> list[dict]:
    """Return list of table dicts extracted from PDF bytes via pdfplumber."""
    import pdfplumber

    results: list[dict] = []
    with pdfplumber.open(io.BytesIO(raw)) as pdf:
        for page_num, page in enumerate(pdf.pages, start=1):
            tables = page.extract_tables()
            for table_idx, table in enumerate(tables):
                if not table or not table[0]:
                    continue
                headers = [str(h or "") for h in table[0]]
                rows = [[str(cell or "") for cell in row] for row in table[1:]]
                results.append({
                    "page": page_num,
                    "table_index": table_idx,
                    "headers": headers,
                    "rows": rows,
                })
    return results


def extract_docx_tables(raw: bytes) -> list[dict]:
    """Return list of table dicts extracted from DOCX bytes via python-docx.

    Page numbers are unavailable in python-docx — page is always None.
    """
    from docx import Document as DocxDocument

    doc = DocxDocument(io.BytesIO(raw))
    results: list[dict] = []
    for table_idx, table in enumerate(doc.tables):
        rows_data = []
        for row in table.rows:
            rows_data.append([cell.text.strip() for cell in row.cells])
        if not rows_data:
            continue
        headers = rows_data[0]
        rows = rows_data[1:]
        results.append({
            "page": None,
            "table_index": table_idx,
            "headers": headers,
            "rows": rows,
        })
    return results


def _mime_to_extractor(mime: str) -> str:
    """Return a short extractor tag for the given MIME type (document_tables.extractor)."""
    if mime == PDF_MIME:
        return "pdfplumber"
    if mime == DOCX_MIME:
        return "python-docx"
    if mime in CSV_MIMES:
        return "csv-reader"
    if mime in EXCEL_MIMES:
        return "openpyxl"
    return "unknown"


def extract_csv_tables(raw: bytes) -> list[dict]:
    """Return a list of table dicts extracted from CSV bytes.

    Performs delimiter auto-detection via csv.Sniffer (comma/semicolon/tab/pipe).
    Normalises blank or purely-numeric header cells to 'Column N'.
    Filters trailing blank rows.
    Returns [] when the file has fewer than 2 non-empty rows (no usable header+data).
    """
    import csv as _csv  # noqa: PLC0415

    try:
        decoded = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        decoded = raw.decode("latin-1")

    try:
        dialect = _csv.Sniffer().sniff(decoded[:2048], delimiters=",;\t|")
    except _csv.Error:
        dialect = None

    reader_kwargs: dict = {"dialect": dialect} if dialect else {}
    all_rows = [
        r for r in _csv.reader(io.StringIO(decoded), **reader_kwargs)
        if any(cell.strip() for cell in r)
    ]
    if len(all_rows) < 2:
        return []

    raw_headers = all_rows[0]
    headers = [
        cell.strip() if cell.strip() and not cell.strip().lstrip("-").isnumeric()
        else f"Column {i + 1}"
        for i, cell in enumerate(raw_headers)
    ]
    data_rows = [[str(cell) for cell in row] for row in all_rows[1:]]
    return [{"page": 1, "table_index": 0, "headers": headers, "rows": data_rows}]


def extract_excel_tables(raw: bytes) -> list[dict]:
    """Return a list of table dicts extracted from Excel (.xlsx/.xls) bytes.

    Each sheet becomes one table dict with page = sheet number (1-based).
    Sheets with fewer than 2 non-empty rows are skipped.
    Header cells that are None/empty or purely numeric are normalised to 'Column N'.
    """
    import openpyxl  # noqa: PLC0415

    wb = openpyxl.load_workbook(io.BytesIO(raw), read_only=True, data_only=True)
    results: list[dict] = []
    for sheet_num, ws in enumerate(wb.worksheets, start=1):
        all_rows = [
            [str(c.value) if c.value is not None else "" for c in row]
            for row in ws.iter_rows()
        ]
        non_empty = [r for r in all_rows if any(cell.strip() for cell in r)]
        if len(non_empty) < 2:
            continue
        raw_headers = non_empty[0]
        headers = [
            cell.strip() if cell.strip() and not cell.strip().lstrip("-").isnumeric()
            else f"Column {i + 1}"
            for i, cell in enumerate(raw_headers)
        ]
        data_rows = non_empty[1:]
        results.append({
            "page": sheet_num,
            "table_index": 0,
            "headers": headers,
            "rows": data_rows,
        })
    return results


TABLE_CHUNK_MAX_ROWS = 25


def _sanitize_markdown_cell(val: object) -> str:
    """Sanitize cell value for clean Markdown table rendering."""
    s = str(val if val is not None else "").replace("\r\n", " ").replace("\n", " ").strip()
    return s.replace("|", "\\|")


def format_table_markdown_chunks(
    table: dict,
    max_rows: int = TABLE_CHUNK_MAX_ROWS,
) -> list[str]:
    """Format an extracted table into one or more Markdown chunks with schema header.

    Each chunk begins with a schema header:
      `[Table {table_index + 1} | Page {page} | Columns: {headers}]`
    followed by standard Markdown table syntax. Large tables are partitioned
    into batches of `max_rows`, repeating the column headers on every chunk split.
    """
    headers = [str(h) for h in table.get("headers") or []]
    rows = table.get("rows") or []
    if not headers:
        return []

    page_val = table.get("page")
    page_str = f"Page {page_val}" if page_val is not None else "Page N/A"
    table_idx = (table.get("table_index") or 0) + 1
    col_str = ", ".join(headers)
    prefix = f"[Table {table_idx} | {page_str} | Columns: {col_str}]"

    header_line = "| " + " | ".join(_sanitize_markdown_cell(h) for h in headers) + " |"
    delim_line = "| " + " | ".join(["---"] * len(headers)) + " |"

    if not rows:
        return [f"{prefix}\n{header_line}\n{delim_line}"]

    chunks: list[str] = []
    for i in range(0, len(rows), max_rows):
        batch = rows[i : i + max_rows]
        row_lines = [
            "| " + " | ".join(_sanitize_markdown_cell(cell) for cell in row) + " |"
            for row in batch
        ]
        chunk_body = "\n".join(row_lines)
        chunks.append(f"{prefix}\n{header_line}\n{delim_line}\n{chunk_body}")

    return chunks


def embed_and_store_table_chunks(
    document_id: str,
    user_id: str,
    table_dicts: list[dict],
    supabase: Client,
    app_settings: "UserEffectiveSettings | None" = None,
) -> list[dict]:
    """Format and embed extracted tables as document_chunks for semantic search (TAB-02).

    Offsets chunk_index from max(chunk_index) to prevent collisions with text chunks.
    Tags chunks with embedding_model, embedding_dimensions, and org_id.
    """
    if not table_dicts:
        return []

    if app_settings is None:
        try:
            from app.models.user_settings import load_app_settings  # noqa: PLC0415
            app_settings = load_app_settings()
        except Exception:
            app_settings = None

    all_table_chunks: list[str] = []
    for tbl in table_dicts:
        chunks = format_table_markdown_chunks(tbl, max_rows=TABLE_CHUNK_MAX_ROWS)
        all_table_chunks.extend(chunks)

    if not all_table_chunks:
        return []

    # Get current max chunk_index for this document
    max_idx_result = (
        supabase.table("document_chunks")
        .select("chunk_index")
        .eq("document_id", document_id)
        .order("chunk_index", desc=True)
        .limit(1)
        .execute()
    )
    base_idx = (
        (max_idx_result.data[0]["chunk_index"] + 1)
        if max_idx_result.data
        else 0
    )

    # Resolve org_id from documents table for multi-tenant isolation
    org_id = None
    try:
        doc_res = (
            supabase.table("documents")
            .select("org_id")
            .eq("id", document_id)
            .maybe_single()
            .execute()
        )
        if doc_res and doc_res.data:
            org_id = doc_res.data.get("org_id")
    except Exception:
        pass

    embeddings = embed_texts(all_table_chunks, user_settings=app_settings)
    _tbl_embedding_model = (
        getattr(app_settings, "embedding_model", None) or "text-embedding-3-small"
    )
    _tbl_embedding_dimensions = getattr(app_settings, "embedding_dimensions", None)

    chunk_rows = [
        {
            "document_id": document_id,
            "user_id": user_id,
            "content": chunk_text,
            "chunk_index": base_idx + i,
            "embedding": embedding,
            "embedding_model": _tbl_embedding_model,
            "embedding_dimensions": _tbl_embedding_dimensions,
            **({"org_id": org_id} if org_id else {}),
        }
        for i, (chunk_text, embedding) in enumerate(zip(all_table_chunks, embeddings))
    ]

    supabase.table("document_chunks").insert(chunk_rows).execute()
    log.info("Stored %d table chunk(s) for document %s", len(chunk_rows), document_id)
    return chunk_rows


def backfill_document_table_chunks(
    document_id: str,
    supabase: Client,
    user_id: str | None = None,
    app_settings: "UserEffectiveSettings | None" = None,
) -> int:
    """Backfill table chunks in document_chunks for a document with existing document_tables.

    Returns the number of generated table chunks.
    """
    if not user_id:
        doc_res = (
            supabase.table("documents")
            .select("user_id")
            .eq("id", document_id)
            .maybe_single()
            .execute()
        )
        if not doc_res or not doc_res.data:
            return 0
        user_id = str(doc_res.data["user_id"])

    tables_res = (
        supabase.table("document_tables")
        .select("page, table_index, headers, rows")
        .eq("document_id", document_id)
        .order("table_index")
        .execute()
    )
    if not tables_res.data:
        return 0

    # Skip if table chunks already present
    existing = (
        supabase.table("document_chunks")
        .select("id")
        .eq("document_id", document_id)
        .ilike("content", "[Table %")
        .limit(1)
        .execute()
    )
    if existing.data:
        return 0

    chunk_rows = embed_and_store_table_chunks(
        document_id=document_id,
        user_id=user_id,
        table_dicts=tables_res.data,
        supabase=supabase,
        app_settings=app_settings,
    )
    return len(chunk_rows)


def extract_and_store_tables(
    raw: bytes,
    mime_type: str,
    document_id: str,
    user_id: str,
    supabase: Client,
    extracted_doc: "ExtractedDocument | None" = None,   # Phase 071.2 D-071.2-08
) -> None:
    """Extract tables from raw bytes and INSERT rows into document_tables.

    Silently swallows all exceptions — never blocks ingestion.

    Phase 071.2 D-071.2-08: when `extracted_doc` is provided AND contains
    tables, those tables are used directly (Docling's bbox + structure
    preserved into document_tables.bbox). When None/empty, falls back to
    the legacy pdfplumber/python-docx pass over raw bytes — preserves
    backward-compat for tests + Phase 069 LegacyExtractor callers.
    """
    try:
        if extracted_doc is not None and extracted_doc.tables:
            table_dicts = [
                {
                    "page": t.page,
                    "table_index": t.table_index,
                    "headers": list(t.headers),
                    "rows": [list(r) for r in t.rows],
                    "bbox": t.bbox,
                }
                for t in extracted_doc.tables
            ]
        elif mime_type == PDF_MIME:
            table_dicts = extract_pdf_tables(raw)
            extractor_tag = "pdfplumber"
        elif mime_type == DOCX_MIME:
            table_dicts = extract_docx_tables(raw)
            extractor_tag = "python-docx"
        elif mime_type in CSV_MIMES:
            table_dicts = extract_csv_tables(raw)
            extractor_tag = "csv-reader"
        elif mime_type in EXCEL_MIMES:
            table_dicts = extract_excel_tables(raw)
            extractor_tag = "openpyxl"
        else:
            return  # Unsupported mime type — nothing to extract

        if not table_dicts:
            return

        # When extracted_doc provides the tag, prefer it (Docling has its own name).
        if extracted_doc is not None and extracted_doc.tables:
            extractor_tag = getattr(extracted_doc, "extractor_name", None) or "docling"
        elif "extractor_tag" not in dir():  # fallback safety — should never trigger
            extractor_tag = _mime_to_extractor(mime_type)

        rows = [
            {
                "document_id": document_id,
                "user_id": user_id,
                "page": t["page"],
                "table_index": t["table_index"],
                "headers": t["headers"],
                "rows": t["rows"],
                "extractor": extractor_tag,
                # Phase 071.2 D-071.2-08: conditional bbox spread — populate the
                # migration 042 column only when the upstream extractor produced one.
                # Skipping the key (rather than writing None) keeps the DB write clean
                # and matches the column's jsonb nullable default.
                **({"bbox": t["bbox"]} if t.get("bbox") is not None else {}),
            }
            for t in table_dicts
        ]
        supabase.table("document_tables").insert(rows).execute()
        log.info("Stored %d table(s) for document %s", len(rows), document_id)

        # TAB-02 / Phase 202: generate and embed table chunks into document_chunks
        try:
            from app.models.user_settings import load_app_settings  # noqa: PLC0415
            app_settings = load_app_settings()
            embed_and_store_table_chunks(
                document_id=document_id,
                user_id=user_id,
                table_dicts=table_dicts,
                supabase=supabase,
                app_settings=app_settings,
            )
        except Exception as chunk_exc:
            log.warning("Table chunk embedding failed for document %s: %s", document_id, chunk_exc)

    except Exception as exc:
        log.warning("Table extraction failed for document %s: %s", document_id, exc)


# ---------------------------------------------------------------------------
# Image extraction helpers (module-level so tests can patch them)
# ---------------------------------------------------------------------------

def extract_pdf_images(raw: bytes, min_px: int = 50) -> list[dict]:
    """Return list of image dicts from PDF bytes via pdfplumber.

    Each dict: {page, image_index, b64_png, width, height}
    Only images >= min_px in both dimensions are returned.
    """
    import pdfplumber
    from PIL import Image as PILImage

    results: list[dict] = []
    with pdfplumber.open(io.BytesIO(raw)) as pdf:
        for page_num, page in enumerate(pdf.pages, start=1):
            for img_idx, img_obj in enumerate(page.images):
                w = img_obj.get("width", 0)
                h = img_obj.get("height", 0)
                if w < min_px or h < min_px:
                    continue
                stream_obj = img_obj.get("stream")
                if stream_obj is None:
                    continue
                try:
                    img_bytes = stream_obj.get_data() if hasattr(stream_obj, "get_data") else bytes(stream_obj)
                except Exception:
                    continue
                if not img_bytes:
                    continue
                try:
                    pil_img = PILImage.open(io.BytesIO(img_bytes))
                    buf = io.BytesIO()
                    pil_img.save(buf, format="PNG")
                    b64 = base64.b64encode(buf.getvalue()).decode()
                except Exception:
                    continue
                results.append({
                    "page": page_num,
                    "image_index": img_idx,
                    "b64_png": b64,
                    "width": w,
                    "height": h,
                })
    return results


def extract_docx_images(raw: bytes, min_px: int = 50) -> list[dict]:
    """Return list of image dicts from DOCX inline shapes via python-docx.

    Page is always None (python-docx cannot determine page boundaries).
    Uses internal python-docx XML path for image blob — standard community pattern.
    """
    from docx import Document as DocxDocument
    from PIL import Image as PILImage

    doc = DocxDocument(io.BytesIO(raw))
    results: list[dict] = []
    for img_idx, shape in enumerate(doc.inline_shapes):
        try:
            # EMU to pixels: 914400 EMU per inch at 96 DPI = 9525 EMU/px
            w_px = (shape.width or 0) // 9525
            h_px = (shape.height or 0) // 9525
            if w_px < min_px or h_px < min_px:
                continue
            img_bytes = shape._inline.graphic.graphicData.pic.blipFill.blip.part.blob
            pil_img = PILImage.open(io.BytesIO(img_bytes))
            buf = io.BytesIO()
            pil_img.save(buf, format="PNG")
            b64 = base64.b64encode(buf.getvalue()).decode()
            results.append({
                "page": None,
                "image_index": img_idx,
                "b64_png": b64,
                "width": w_px,
                "height": h_px,
            })
        except Exception:
            continue
    return results


def describe_image(b64_png: str, app_settings: "UserEffectiveSettings", client=None) -> str:
    """Call vision LLM to produce a 1-2 sentence description of the image.

    Uses the active model. Returns empty string on any failure (model may
    not support vision — Pitfall 3).

    ``client`` is optional — callers can pass a pre-created OpenAI client for
    connection reuse. If None, a new client is created (fallback for direct use).
    """
    from openai import OpenAI

    if client is None:
        client = OpenAI(
            api_key=app_settings.llm_api_key,
            base_url=app_settings.llm_base_url or None,
        )
    from app.config import settings as env_settings
    vision_model = env_settings.vision_model or app_settings.llm_model
    resp = client.chat.completions.create(
        model=vision_model,
        messages=[{
            "role": "user",
            "content": [
                {
                    "type": "text",
                    "text": "Describe this image concisely in 1-2 sentences. Focus on the content, not style.",
                },
                {
                    "type": "image_url",
                    "image_url": {
                        "url": f"data:image/png;base64,{b64_png}",
                        "detail": "low",
                    },
                },
            ],
        }],
        max_tokens=150,
        stream=False,
    )
    return resp.choices[0].message.content or ""


def extract_and_store_images(
    raw: bytes,
    mime_type: str,
    document_id: str,
    user_id: str,
    supabase: Client,
    app_settings: "UserEffectiveSettings",
    extracted_doc: "ExtractedDocument | None" = None,   # Phase 071.2 D-071.2-08
) -> None:
    """Extract images from raw bytes, describe via vision LLM, INSERT to document_images.

    Silently swallows all exceptions — never blocks ingestion.
    Images below 50x50 px are skipped.
    Vision API failures store empty description rather than skipping the row
    (D-072-03 — persisted empty rows are eligible for lazy /reextract refill).
    Capped at `app_settings.multimodal_max_vision_calls` per document (D-072-08).

    Phase 071.2 D-071.2-08: when `extracted_doc` is provided AND contains
    images, those images are used directly (Docling's bbox preserved into
    document_images.bbox). The vision-LLM description loop still runs on
    the b64_png. When None/empty, falls back to the legacy
    pdfplumber/python-docx pass — preserves backward-compat.
    """
    try:
        if extracted_doc is not None and extracted_doc.images:
            image_dicts = [
                {
                    "page": im.page,
                    "image_index": im.image_index,
                    "b64_png": im.b64_png,
                    "width": im.width,
                    "height": im.height,
                    "bbox": im.bbox,
                }
                for im in extracted_doc.images
            ]
        elif mime_type == PDF_MIME:
            image_dicts = extract_pdf_images(raw)
        elif mime_type == DOCX_MIME:
            image_dicts = extract_docx_images(raw)
        else:
            return

        if not image_dicts:
            return

        from openai import OpenAI  # noqa: PLC0415
        openai_client = OpenAI(
            api_key=app_settings.llm_api_key,
            base_url=app_settings.llm_base_url or None,
        )

        rows: list[dict] = []
        for img in image_dicts[:app_settings.multimodal_max_vision_calls]:
            # Secondary size guard — extraction helpers filter too, but mocks bypass them in tests
            if img.get("width", 0) < 50 or img.get("height", 0) < 50:
                continue
            b64 = img["b64_png"]
            if len(b64) > app_settings.multimodal_max_b64_bytes_kb * 1024:
                log.debug(
                    "Skipping oversized image in %s (%d bytes b64)", document_id, len(b64)
                )
                continue
            # D-072-02: downscale to MULTIMODAL_THUMBNAIL_MAX_EDGE before vision LLM
            # call via the shared helper. Plan 03's retry path uses the SAME helper
            # so both call sites honor the invariant from a single source (WARNING 3).
            b64 = _downscale_b64_for_vision(b64)
            try:
                description = describe_image(b64, app_settings, client=openai_client)
            except Exception as exc:
                log.debug("Vision description failed for image in %s: %s", document_id, exc)
                description = ""
            rows.append({
                "document_id": document_id,
                "user_id": user_id,
                "page": img["page"],
                "image_index": img["image_index"],
                "description": description,
                # b64_png intentionally NOT stored
                # Phase 071.2 D-071.2-08: conditional bbox spread — populate the
                # migration 042 column only when the upstream extractor produced one.
                **({"bbox": img["bbox"]} if img.get("bbox") is not None else {}),
            })

        if not rows:
            return

        supabase.table("document_images").insert(rows).execute()
        log.info("Stored %d image description(s) for document %s", len(rows), document_id)

        # D-01/D-02/D-03: embed image descriptions as document_chunks for vector search
        # Pitfall 1: offset chunk_index from MAX to avoid collision with text chunks
        # Pitfall 2: skip rows where description is empty
        try:
            # Get current max chunk_index for this document
            max_idx_result = (
                supabase.table("document_chunks")
                .select("chunk_index")
                .eq("document_id", document_id)
                .order("chunk_index", desc=True)
                .limit(1)
                .execute()
            )
            base_idx = (
                (max_idx_result.data[0]["chunk_index"] + 1)
                if max_idx_result.data
                else 0
            )
            # Build (offset_index, content) pairs — skip empty descriptions
            descriptions: list[tuple[int, str]] = []
            for i, row in enumerate(rows):
                page = row.get("page")
                desc = (row.get("description") or "").strip()
                if not desc:
                    continue
                # D-072-06: derive location prefix for DOCX images (page is None);
                # PDF images keep the page-number prefix.
                bbox = row.get("bbox") or {}
                location = bbox.get("location") if isinstance(bbox, dict) else None
                if page is not None:
                    content = f"[Image p.{page}]: {desc}"
                elif location:
                    content = f"[Image {location}]: {desc}"
                else:
                    content = f"[Image]: {desc}"
                descriptions.append((i, content))
            if descriptions:
                texts = [d[1] for d in descriptions]
                embeddings = embed_texts(texts, user_settings=app_settings)
                # D-10 parity with the text-chunk path (documents.py): tag image
                # chunks with the embedding model + dims they were produced under.
                # Without this they land with embedding_model=NULL, which (a) strands
                # them in the re-embed "catching up" counter forever and (b) excludes
                # them from match_document_chunks (filtered on p_embedding_model) so
                # image descriptions become invisible to vector search.
                _img_embedding_model = (
                    getattr(app_settings, "embedding_model", None) or "text-embedding-3-small"
                )
                _img_embedding_dimensions = getattr(app_settings, "embedding_dimensions", None)
                chunk_rows = [
                    {
                        "document_id": document_id,
                        "user_id": user_id,
                        "content": content,
                        "chunk_index": base_idx + i,
                        "embedding": embedding,
                        "embedding_model": _img_embedding_model,
                        "embedding_dimensions": _img_embedding_dimensions,
                    }
                    for (i, content), embedding in zip(descriptions, embeddings)
                ]
                supabase.table("document_chunks").insert(chunk_rows).execute()
                log.info(
                    "Stored %d image chunk(s) for document %s",
                    len(chunk_rows),
                    document_id,
                )
        except Exception as exc:
            log.warning(
                "Image chunk embedding failed for document %s: %s",
                document_id,
                exc,
            )

    except Exception as exc:
        log.warning("Image extraction failed for document %s: %s", document_id, exc)


# ---------------------------------------------------------------------------
# query_tables tool service (MODAL-03, Phase 36)
# ---------------------------------------------------------------------------

async def _fetch_document_tables(doc_id: str, user_id: str, page_filter: int | None, supabase: "Client") -> list[dict]:
    """Query document_tables for a given document_id, optional page filter.

    Extracted as a module-level function so tests can patch it cleanly.
    Returns list of table dicts from Supabase: [{page, table_index, headers, rows}]
    """
    query = (
        supabase.table("document_tables")
        .select("page, table_index, headers, rows")
        .eq("document_id", doc_id)
        .eq("user_id", user_id)
    )
    if page_filter is not None:
        query = query.eq("page", page_filter)
    result = await aexec(query.order("table_index"))
    return result.data or []


async def handle_query_tables(args: dict, user_id: str, supabase: "Client") -> str:
    """Service function for the query_tables tool (D-04/D-05/D-06).

    Resolves document_name → document_id, queries document_tables,
    applies optional column_filter server-side (exact string match),
    caps at 50 rows per table, returns JSON string.

    Error cases return {"error": "..."} JSON consistent with existing tool patterns.
    """
    import json  # noqa: PLC0415
    from app.services.retrieval_service import resolve_document_id  # noqa: PLC0415

    document_name = (args.get("document_name") or "").strip()
    column_filter: dict | None = args.get("column_filter") or None
    page_filter: int | None = args.get("page")

    # Pitfall 7: must resolve document_name → UUID first
    doc_id = await resolve_document_id(document_name, user_id, supabase)
    if not doc_id:
        return json.dumps({"error": f"Document '{document_name}' not found."})

    tables = await _fetch_document_tables(doc_id, user_id, page_filter, supabase)
    if not tables:
        return json.dumps({"error": f"No tables found for document '{document_name}'."})

    output = []
    for tbl in tables:
        headers: list[str] = tbl.get("headers") or []
        rows: list[list] = tbl.get("rows") or []

        # Apply column_filter: keep rows where ALL named columns match (AND semantics)
        if column_filter:
            matched: list[list] = []
            for row in rows:
                match = True
                for col_name, col_val in column_filter.items():
                    try:
                        col_idx = headers.index(col_name)
                        if not (len(row) > col_idx and str(row[col_idx]) == str(col_val)):
                            match = False
                            break
                    except ValueError:
                        match = False
                        break
                if match:
                    matched.append(row)
            rows = matched

        # Skip tables with no rows after filter (avoids empty table entries in output)
        if not rows and column_filter:
            continue

        truncated = len(rows) > 50
        output.append({
            "document": document_name,
            "page": tbl.get("page"),
            "table_index": tbl["table_index"],
            "headers": headers,
            "rows": rows[:50],
            "truncated": truncated,
        })

    if not output:
        return json.dumps({
            "error": f"No matching rows found for the given column filter in '{document_name}'."
        })

    return json.dumps(output)
