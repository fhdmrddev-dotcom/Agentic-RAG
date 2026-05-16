"""Text-aspect adapters for the per-aspect extraction dispatcher
(Phase 071.2 Plan 05, D-071.2-02).

Each function takes (raw_bytes, mime) and returns (text, full_markdown_or_None).
None markdown signals legacy engines (no layout-preserving export). Lazy imports
inside function bodies keep module-import cost minimal (Pattern SP-4) and
preserve the Phase 071 AGPL fence (no `import fitz` at module top).
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
    """PyMuPDF-backed text extraction via the AGPL-fenced subprocess child.

    Calls `_run_pymupdf_subprocess` (parent wrapper at
    `backend/app/services/extractors/pymupdf.py`) which spawns
    `python -m extractors.pymupdf_isolated`. No `import fitz` happens in
    this process — AGPL fence preserved (Phase 071 D-PRD-07 Appendix).
    """
    from app.services.extractors.pymupdf import _run_pymupdf_subprocess  # noqa: PLC0415

    ed = _run_pymupdf_subprocess(raw, mime)
    return (ed.text, ed.full_markdown)
