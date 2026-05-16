"""Text-aspect adapters for the per-aspect extraction dispatcher
(Phase 071.2 Plan 05, D-071.2-02).

Each function takes (raw_bytes, mime) and returns (text, full_markdown_or_None).
None markdown signals legacy engines (no layout-preserving export). Lazy imports
inside function bodies keep module-import cost minimal (Pattern SP-4).

Phase 071.3 Plan 04 Phase G (D-071.3-11): the PyMuPDF subprocess fence was
retired after the in-process smoke test verified `import fitz` works
post-httpx-unpin. PyMuPDF AGPL-3.0 in-process imports are permitted per
D-PRD-07.
"""
from __future__ import annotations

import io
import logging

from app.services.extraction_service import PDF_MIME, DOCX_MIME

log = logging.getLogger(__name__)


def legacy_text(raw: bytes, mime: str) -> tuple[str, str | None]:
    """pypdf for PDF text, python-docx for DOCX text. Returns (text, None).

    Mirrors LegacyExtractor._extract_text byte-identically — backward-compat
    path for callers that want the cheapest text engine.
    """
    if mime == PDF_MIME:
        from pypdf import PdfReader  # noqa: PLC0415 — lazy heavy import
        reader = PdfReader(io.BytesIO(raw))
        text = "\n\n".join(page.extract_text() or "" for page in reader.pages)
        return (text, None)
    if mime == DOCX_MIME:
        from docx import Document as DocxDocument  # noqa: PLC0415
        doc = DocxDocument(io.BytesIO(raw))
        text = "\n\n".join(p.text for p in doc.paragraphs if p.text.strip())
        return (text, None)
    raise ValueError(f"legacy_text: unsupported mime {mime!r}")


def pymupdf_text(raw: bytes, mime: str) -> tuple[str, str | None]:
    """PyMuPDF-backed text extraction via in-process `import fitz`.

    Returns (text, None) — PyMuPDF does not produce a separate
    layout-preserving markdown export (that was Docling's role; gone after
    the rip). Callers that need markdown should use a markdown-capable
    engine in the text aspect (currently only `legacy` is shipped and it
    also returns None markdown).

    AGPL: PyMuPDF is AGPL-3.0; in-process import is permitted per D-PRD-07 +
    D-071.3-11.
    """
    import fitz  # noqa: PLC0415 — AGPL in-process per D-PRD-07

    filetype = "pdf" if mime == PDF_MIME else "docx"
    doc = fitz.Document(stream=raw, filetype=filetype)
    try:
        text_parts = [page.get_text() for page in doc]
        text = "\n\n".join(text_parts)
        return (text, None)
    finally:
        doc.close()
