"""Unit tests for backend/app/services/extractors/aspects/images_pdf.py.

Phase 071.2 D-071.2-12: TEXT_ENGINES default is pymupdf_full for PDF images
specifically because pdfplumber misses Form-XObject-embedded images.

Phase 071.3 Plan 04 Phase G (D-071.3-11): the subprocess fence was retired
in favor of in-process `import fitz` (AGPL permitted per D-PRD-07). Tests
now mock `fitz.Document` directly instead of the deleted
`_run_pymupdf_subprocess` parent wrapper.
"""
from __future__ import annotations

from unittest.mock import MagicMock, patch

from app.services.extraction_service import ImageData


def test_pymupdf_full_returns_more_than_pdfplumber():
    """With pymupdf_full mocked to walk a fake Document yielding 5 images and
    pdfplumber mocked to return 2, the assertion
    `pymupdf_full > pdfplumber` holds — wiring proves the dispatch
    differentiates the two engines.
    """
    from app.services.extractors.aspects import images_pdf

    # Fake fitz.Document iterator: 3 pages with image lists summing to 5
    page1 = MagicMock()
    page1.get_images.return_value = [(101, 0), (102, 0)]
    page2 = MagicMock()
    page2.get_images.return_value = [(201, 0), (202, 0)]
    page3 = MagicMock()
    page3.get_images.return_value = [(301, 0)]
    fake_doc = MagicMock()
    fake_doc.__iter__.return_value = iter([page1, page2, page3])
    fake_doc.extract_image.return_value = {
        # 1x1 PNG bytes — Pillow can decode this minimal payload
        "image": (
            b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00"
            b"\x01\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc"
            b"```\x00\x00\x00\x04\x00\x01]\xcc\xdb\xe0\x00\x00\x00\x00IEND"
            b"\xaeB`\x82"
        ),
        "width": 1,
        "height": 1,
    }

    plumber_imgs = [
        ImageData(
            page=p, image_index=i, b64_png="", width=100, height=100, bbox=None
        )
        for p, i in [(1, 0), (2, 0)]
    ]

    with patch("fitz.Document", return_value=fake_doc):
        full_out = images_pdf.pymupdf_full_images_pdf(b"%PDF")

    with patch(
        "app.services.multimodal_service.extract_pdf_images",
        return_value=[
            {
                "page": im.page,
                "image_index": im.image_index,
                "b64_png": im.b64_png,
                "width": im.width,
                "height": im.height,
            }
            for im in plumber_imgs
        ],
    ):
        plumber_out = images_pdf.pdfplumber_images_pdf(b"%PDF")

    assert len(full_out) > len(plumber_out)
    assert all(isinstance(im, ImageData) for im in full_out)
    assert all(isinstance(im, ImageData) for im in plumber_out)
