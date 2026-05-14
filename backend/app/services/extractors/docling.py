# backend/app/services/extractors/docling.py
# Source: Verified live against Docling 2.93.0 + reference.pdf 2026-05-14
"""Docling-backed PdfExtractor (Phase 071 D-071-05..08)."""
from __future__ import annotations

import base64
import io
import logging
import threading
from typing import TYPE_CHECKING

from app.services.extraction_service import (
    DOCX_MIME,
    ExtractedDocument,
    ImageData,
    PdfExtractor,
    PDF_MIME,
    TableData,
)

if TYPE_CHECKING:
    from docling.document_converter import DocumentConverter
    from docling_core.types.doc.document import DoclingDocument, PictureItem, TableItem

log = logging.getLogger(__name__)

_CONVERTER: "DocumentConverter | None" = None
_CONVERTER_LOCK = threading.Lock()


def _get_converter() -> "DocumentConverter":
    """Lazy module-level singleton, double-checked-locked (D-071-06).

    First call downloads ~600 MB of Docling models to ~/.cache/docling.
    Subsequent calls are fast. T-071-02-01 mitigation: re-check inside
    the lock prevents two threads from both seeing None and racing to
    construct two converters.
    """
    global _CONVERTER
    if _CONVERTER is None:
        with _CONVERTER_LOCK:
            if _CONVERTER is None:
                from docling.document_converter import DocumentConverter, PdfFormatOption  # noqa: PLC0415
                from docling.datamodel.base_models import InputFormat  # noqa: PLC0415
                from docling.datamodel.pipeline_options import PdfPipelineOptions  # noqa: PLC0415

                opts = PdfPipelineOptions()
                opts.generate_picture_images = True   # required for p.get_image(doc) — RESEARCH Pitfall 3
                opts.images_scale = 2.0
                opts.document_timeout = 120.0         # T-071-02-03 mitigation
                # Plan 04 Rule-1 inline fix: disable OCR by default — RapidOCR preprocess
                # raised std::bad_alloc on the 551f03f9 thesis pair under Windows during
                # SC#1 UAT (pages 26-31 OOM, crashed worker). Theses + most ingested PDFs
                # have a text layer already; OCR is wasted work + the OOM source. Future
                # work (Phase 072 / Skill Studio milestone): user-tunable do_ocr flag.
                opts.do_ocr = False
                log.info(
                    "DoclingExtractor: lazy-instantiating DocumentConverter "
                    "(first call downloads ~600MB; subsequent calls are fast)."
                )
                _CONVERTER = DocumentConverter(
                    format_options={InputFormat.PDF: PdfFormatOption(pipeline_options=opts)}
                )
    return _CONVERTER


def _to_table_data(t: "TableItem", ti: int) -> TableData:
    """Map Docling TableItem -> ExtractedDocument.TableData (per adapter mapping)."""
    page = t.prov[0].page_no if t.prov else None
    bbox: dict | None = None
    if t.prov:
        bbox = t.prov[0].bbox.model_dump()
        bbox["page"] = page
        # coord_origin is a CoordOrigin enum - convert to str for JSON serializability
        if "coord_origin" in bbox and hasattr(bbox["coord_origin"], "value"):
            bbox["coord_origin"] = bbox["coord_origin"].value

    # Use grid traversal for explicit header detection; falls back to empty if grid is empty.
    if t.data and t.data.grid and t.data.grid[0]:
        headers = [cell.text for cell in t.data.grid[0]]
        rows = [[cell.text for cell in row] for row in t.data.grid[1:]]
    else:
        headers, rows = [], []

    return TableData(
        page=page,
        table_index=ti,
        headers=headers,
        rows=rows,
        bbox=bbox,
    )


def _to_image_data(p: "PictureItem", pi: int, doc: "DoclingDocument") -> ImageData | None:
    """Map Docling PictureItem -> ExtractedDocument.ImageData.

    Returns None if the image isn't extractable (e.g., when
    generate_picture_images=False or the underlying bytes are missing).
    """
    img = p.get_image(doc)  # PIL Image or None (None if generate_picture_images=False)
    if img is None:
        return None
    buf = io.BytesIO()
    img.convert("RGB").save(buf, format="PNG")
    b64 = base64.b64encode(buf.getvalue()).decode("ascii")
    page = p.prov[0].page_no if p.prov else None
    bbox: dict | None = None
    if p.prov:
        bbox = p.prov[0].bbox.model_dump()
        bbox["page"] = page
        if "coord_origin" in bbox and hasattr(bbox["coord_origin"], "value"):
            bbox["coord_origin"] = bbox["coord_origin"].value
    return ImageData(
        page=page,
        image_index=pi,
        b64_png=b64,
        width=img.width,
        height=img.height,
        bbox=bbox,
    )


class DoclingExtractor(PdfExtractor):
    """Layout-aware PDF + DOCX extractor (D-071-05..08).

    Wraps Docling's DocumentConverter via a module-level singleton
    (D-071-06). Populates the Phase 071 D-071-08 extended
    ExtractedDocument fields: `full_markdown`, `extractor_name='docling'`,
    and per-table/per-image `bbox`.
    """

    def supports(self, mime: str) -> bool:
        return mime in (PDF_MIME, DOCX_MIME)

    def extract(self, raw: bytes, mime: str) -> ExtractedDocument:
        if not self.supports(mime):
            raise ValueError(f"DoclingExtractor does not support {mime!r}")

        import tempfile  # noqa: PLC0415
        # Docling 2.x's convert() takes a path; write raw bytes to a temp file.
        # (probe_multimodal.py:196-200 uses the same pattern.)
        suffix = ".pdf" if mime == PDF_MIME else ".docx"
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tf:
            tf.write(raw)
            tmp_path = tf.name

        try:
            converter = _get_converter()
            result = converter.convert(tmp_path)
            doc = result.document

            text = doc.export_to_text()
            try:
                full_markdown = doc.export_to_markdown()
            except Exception as exc:  # noqa: BLE001
                log.warning("Docling export_to_markdown failed: %s", exc)
                full_markdown = None

            tables: list[TableData] = []
            table_error: str | None = None
            try:
                tables = [_to_table_data(t, ti) for ti, t in enumerate(doc.tables)]
            except Exception as exc:  # noqa: BLE001
                table_error = str(exc)
                log.warning("Docling table mapping failed: %s", exc)

            images: list[ImageData] = []
            image_error: str | None = None
            try:
                for pi, p in enumerate(doc.pictures):
                    im = _to_image_data(p, pi, doc)
                    if im is not None:
                        images.append(im)
            except Exception as exc:  # noqa: BLE001
                image_error = str(exc)
                log.warning("Docling image mapping failed: %s", exc)

            return ExtractedDocument(
                text=text,
                tables=tuple(tables),
                images=tuple(images),
                table_extraction_error=table_error,
                image_extraction_error=image_error,
                full_markdown=full_markdown,
                extractor_name="docling",
            )
        finally:
            try:
                import os  # noqa: PLC0415
                os.unlink(tmp_path)
            except Exception:
                pass
