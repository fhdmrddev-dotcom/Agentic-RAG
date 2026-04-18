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

if TYPE_CHECKING:
    from app.models.user_settings import UserEffectiveSettings

log = logging.getLogger(__name__)

PDF_MIME = "application/pdf"
DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

# Maximum vision API calls per document (Pitfall 6: large PDFs)
_MAX_VISION_CALLS = 20

# Maximum base64 payload size per image — prevents uncapped vision API calls
# 512 KB is sufficient for any low-detail vision call
_MAX_B64_BYTES = 512 * 1024


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


def extract_and_store_tables(
    raw: bytes,
    mime_type: str,
    document_id: str,
    user_id: str,
    supabase: Client,
) -> None:
    """Extract tables from raw bytes and INSERT rows into document_tables.

    Silently swallows all exceptions — never blocks ingestion.
    """
    try:
        if mime_type == PDF_MIME:
            table_dicts = extract_pdf_tables(raw)
        elif mime_type == DOCX_MIME:
            table_dicts = extract_docx_tables(raw)
        else:
            return  # Unsupported mime type — nothing to extract

        if not table_dicts:
            return

        rows = [
            {
                "document_id": document_id,
                "user_id": user_id,
                "page": t["page"],
                "table_index": t["table_index"],
                "headers": t["headers"],
                "rows": t["rows"],
            }
            for t in table_dicts
        ]
        supabase.table("document_tables").insert(rows).execute()
        log.info("Stored %d table(s) for document %s", len(rows), document_id)

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
) -> None:
    """Extract images from raw bytes, describe via vision LLM, INSERT to document_images.

    Silently swallows all exceptions — never blocks ingestion.
    Images below 50x50 px are skipped.
    Vision API failures store empty description rather than skipping the row.
    Capped at _MAX_VISION_CALLS per document.
    """
    try:
        if mime_type == PDF_MIME:
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
        for img in image_dicts[:_MAX_VISION_CALLS]:
            # Secondary size guard — extraction helpers filter too, but mocks bypass them in tests
            if img.get("width", 0) < 50 or img.get("height", 0) < 50:
                continue
            b64 = img["b64_png"]
            if len(b64) > _MAX_B64_BYTES:
                log.debug(
                    "Skipping oversized image in %s (%d bytes b64)", document_id, len(b64)
                )
                continue
            try:
                description = describe_image(b64, app_settings, client=openai_client)
            except Exception as exc:
                log.debug("Vision description failed for image in %s: %s", document_id, exc)
                description = ""
            if not description:
                log.debug("Skipping image with no description in %s", document_id)
                continue
            rows.append({
                "document_id": document_id,
                "user_id": user_id,
                "page": img["page"],
                "image_index": img["image_index"],
                "description": description,
                # b64_png intentionally NOT stored
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
                content = (
                    f"[Image p.{page}]: {desc}"
                    if page is not None
                    else f"[Image]: {desc}"
                )
                descriptions.append((i, content))
            if descriptions:
                texts = [d[1] for d in descriptions]
                embeddings = embed_texts(texts, user_settings=app_settings)
                chunk_rows = [
                    {
                        "document_id": document_id,
                        "user_id": user_id,
                        "content": content,
                        "chunk_index": base_idx + i,
                        "embedding": embedding,
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

def _fetch_document_tables(doc_id: str, user_id: str, page_filter: int | None, supabase: "Client") -> list[dict]:
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
    result = query.order("table_index").execute()
    return result.data or []


def handle_query_tables(args: dict, user_id: str, supabase: "Client") -> str:
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
    doc_id = resolve_document_id(document_name, user_id, supabase)
    if not doc_id:
        return json.dumps({"error": f"Document '{document_name}' not found."})

    tables = _fetch_document_tables(doc_id, user_id, page_filter, supabase)
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
