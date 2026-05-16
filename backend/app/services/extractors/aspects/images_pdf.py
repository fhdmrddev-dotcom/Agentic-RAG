"""PDF image-aspect adapters for the per-aspect extraction dispatcher
(Phase 071.2 Plan 05, D-071.2-02).

Phase 071.3 Plan 04 Phase G (D-071.3-11): the PyMuPDF subprocess fence was
retired after the in-process smoke test verified `import fitz` works
post-httpx-unpin. PyMuPDF AGPL-3.0 in-process imports are permitted per
D-PRD-07; AGPL disclosure remains in `backend/requirements.txt`.
"""
from __future__ import annotations

import base64
import io
import logging

from PIL import Image as PILImage

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
    """Full PyMuPDF image extraction via in-process `import fitz`.

    Uses `page.get_images(full=True)` semantics — covers Form-XObject-embedded
    images that pdfplumber misses. This is the Phase 071.2 default PDF image
    engine (D-071.2-02 strict-wins).

    AGPL: PyMuPDF is AGPL-3.0; in-process import is permitted per D-PRD-07 +
    D-071.3-11 (in-process smoke test verified compatibility with unpinned
    httpx). The subprocess fence shipped in Phase 071 has been retired.

    Per-image failure mode (matches the deleted child entrypoint): a single
    image that fails to extract is logged + skipped; the rest of the document
    proceeds. Errors above page-iteration level bubble to extract_composable.
    """
    import fitz  # noqa: PLC0415 — AGPL in-process per D-PRD-07

    doc = fitz.Document(stream=raw, filetype="pdf")
    try:
        images: list[ImageData] = []
        global_idx = 0
        for page_num, page in enumerate(doc, start=1):
            for (xref, *_) in page.get_images(full=True):
                try:
                    info = doc.extract_image(xref)
                    raw_img = info["image"]
                    img = PILImage.open(io.BytesIO(raw_img)).convert("RGB")
                    buf = io.BytesIO()
                    img.save(buf, format="PNG")
                    b64 = base64.b64encode(buf.getvalue()).decode("ascii")
                    images.append(
                        ImageData(
                            page=page_num,
                            image_index=global_idx,
                            b64_png=b64,
                            width=info.get("width") or img.width,
                            height=info.get("height") or img.height,
                            bbox=None,
                        )
                    )
                    global_idx += 1
                except Exception as e:  # noqa: BLE001
                    log.warning(
                        "pymupdf_full_images_pdf: image extraction failed "
                        "(xref=%s, page=%s): %s",
                        xref, page_num, e,
                    )
        return images
    finally:
        doc.close()
