"""Table-aspect adapters for the per-aspect extraction dispatcher
(Phase 071.2 Plan 05, D-071.2-02).

Each function takes (raw_bytes, mime) and returns list[TableData].
Lazy imports keep Docling out of FastAPI startup (Pattern SP-4).
"""
from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from app.services.extraction_service import PDF_MIME, DOCX_MIME, TableData

if TYPE_CHECKING:
    from docling_core.types.doc.document import TableItem

log = logging.getLogger(__name__)


def pdfplumber_tables(raw: bytes, mime: str) -> list[TableData]:
    """Legacy pdfplumber/python-docx table extraction — wraps
    multimodal_service.extract_pdf_tables / extract_docx_tables.

    Returns list[TableData] with bbox=None (pdfplumber doesn't expose
    layout coordinates in the dicts it returns).
    """
    from app.services.multimodal_service import (  # noqa: PLC0415
        extract_pdf_tables,
        extract_docx_tables,
    )
    if mime == PDF_MIME:
        dicts = extract_pdf_tables(raw)
    elif mime == DOCX_MIME:
        dicts = extract_docx_tables(raw)
    else:
        return []
    return [TableData(**d) for d in dicts]


def docling_tf_tables(raw: bytes, mime: str) -> list[TableData]:
    """Docling TableFormer table extraction — high-recall layout-aware
    structure detection. Returns list[TableData] with bbox populated
    when prov info is available.

    Reuses the existing `_get_converter` singleton (Pattern SP-6) — no
    second DocumentConverter instance is constructed.
    """
    import tempfile  # noqa: PLC0415
    import os  # noqa: PLC0415
    from app.services.extractors.docling import (  # noqa: PLC0415
        _get_converter,
        _to_table_data,
    )

    suffix = ".pdf" if mime == PDF_MIME else ".docx"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tf:
        tf.write(raw)
        tmp_path = tf.name
    try:
        converter = _get_converter()
        result = converter.convert(tmp_path)
        doc = result.document
        return [_to_table_data(t, ti) for ti, t in enumerate(doc.tables)]
    finally:
        try:
            os.unlink(tmp_path)
        except Exception:
            pass
