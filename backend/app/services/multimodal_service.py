"""
Multi-modal extraction service for Phase 35.

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

if TYPE_CHECKING:
    from app.models.user_settings import UserEffectiveSettings

log = logging.getLogger(__name__)

PDF_MIME = "application/pdf"
DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

# Maximum vision API calls per document (Pitfall 6: large PDFs)
_MAX_VISION_CALLS = 20


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
                img_bytes = img_obj.get("stream", b"")
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


def describe_image(b64_png: str, app_settings: "UserEffectiveSettings") -> str:
    """Call vision LLM to produce a 1-2 sentence description of the image.

    Uses the active model. Returns empty string on any failure (model may
    not support vision — Pitfall 3).
    """
    from openai import OpenAI

    client = OpenAI(
        api_key=app_settings.llm_api_key,
        base_url=app_settings.llm_base_url or None,
    )
    resp = client.chat.completions.create(
        model=app_settings.llm_model,
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

        rows: list[dict] = []
        for img in image_dicts[:_MAX_VISION_CALLS]:
            try:
                description = describe_image(img["b64_png"], app_settings)
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
            })

        if not rows:
            return

        supabase.table("document_images").insert(rows).execute()
        log.info("Stored %d image description(s) for document %s", len(rows), document_id)

    except Exception as exc:
        log.warning("Image extraction failed for document %s: %s", document_id, exc)
