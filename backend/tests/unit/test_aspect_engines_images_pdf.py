"""Unit tests for backend/app/services/extractors/aspects/images_pdf.py.

Test 7: pymupdf_full_images_pdf returns MORE images than pdfplumber_images_pdf
on the same fixture (D-071.2-12 floor justification — TEXT_ENGINES default is
pymupdf_full for PDF images specifically because pdfplumber misses
Form-XObject-embedded images).

We use controlled fake returns rather than real binaries — the contract proven
here is the ADAPTER WIRING, not the image-detection engine itself.
"""
from __future__ import annotations

from unittest.mock import patch

from app.services.extraction_service import ExtractedDocument, ImageData


def test_pymupdf_full_returns_more_than_pdfplumber():
    """With pymupdf_full mocked to return 5 images and pdfplumber mocked to
    return 2, the assertion `pymupdf_full > pdfplumber` holds — wiring proves
    the dispatch differentiates the two engines."""
    from app.services.extractors.aspects import images_pdf

    pymupdf_imgs = [
        ImageData(
            page=p, image_index=i, b64_png="", width=100, height=100, bbox=None
        )
        for p, i in [(1, 0), (1, 1), (2, 0), (2, 1), (3, 0)]
    ]
    plumber_imgs = [
        ImageData(
            page=p, image_index=i, b64_png="", width=100, height=100, bbox=None
        )
        for p, i in [(1, 0), (2, 0)]
    ]

    # Mock the subprocess wrapper for pymupdf_full
    fake_extracted = ExtractedDocument(
        text="",
        tables=(),
        images=tuple(pymupdf_imgs),
        extractor_name="pymupdf",
    )
    with patch(
        "app.services.extractors.pymupdf._run_pymupdf_subprocess",
        return_value=fake_extracted,
    ):
        full_out = images_pdf.pymupdf_full_images_pdf(b"%PDF")

    # Mock multimodal_service.extract_pdf_images for pdfplumber path
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
