"""PDF image-aspect adapters for the per-aspect extraction dispatcher
(Phase 071.2 Plan 05, D-071.2-02).

Each function takes (raw_bytes,) and returns list[ImageData]. The PyMuPDF
adapter goes through the AGPL-fenced subprocess wrapper — NO `import fitz`
in this module (parent-process invariant preserved).
"""
from __future__ import annotations

import logging

from app.services.extraction_service import ImageData

log = logging.getLogger(__name__)


def pdfplumber_images_pdf(raw: bytes) -> list[ImageData]:
    """Legacy pdfplumber-based PDF image extraction.

    Wraps multimodal_service.extract_pdf_images — only finds inline page
    images, MISSES Form-XObject-embedded images and rotated/scaled
    images. Use pymupdf_full for thesis-class PDFs.
    """
    from app.services.multimodal_service import extract_pdf_images  # noqa: PLC0415

    dicts = extract_pdf_images(raw)
    return [ImageData(**d) for d in dicts]


def pymupdf_full_images_pdf(raw: bytes) -> list[ImageData]:
    """Full PyMuPDF image extraction via the AGPL-fenced subprocess.

    Uses `page.get_images(full=True)` semantics inside the child — covers
    Form-XObject-embedded images that pdfplumber misses. This is the
    Phase 071.2 default PDF image engine (D-071.2-02 strict-wins).

    AGPL FENCE: this function does NOT import fitz. It calls into
    `_run_pymupdf_subprocess` (parent wrapper at
    backend/app/services/extractors/pymupdf.py) which spawns
    `python -m extractors.pymupdf_isolated` as a subprocess.
    """
    from app.services.extraction_service import PDF_MIME  # noqa: PLC0415
    from app.services.extractors.pymupdf import _run_pymupdf_subprocess  # noqa: PLC0415

    ed = _run_pymupdf_subprocess(raw, PDF_MIME)
    return list(ed.images)
