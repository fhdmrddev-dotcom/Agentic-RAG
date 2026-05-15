"""Unit tests for backend/app/services/extractors/aspects/images_docx.py.

Test 8 — CRITICAL for RAG-MM-LIFT-02 CLOSURE:
   On a DOCX whose only picture is a floating `<wp:anchor>` (not an inline
   shape), inline_shapes_docx returns 0 AND zip_xpath_docx returns >= 1.

Test 9: zip_xpath dedups by media path — same image referenced twice via
   DrawingML yields one ImageData.

The anchor-only DOCX fixture is generated programmatically inside this test
module via python-docx + lxml (preferred over committing a binary fixture).
"""
from __future__ import annotations

import io
import zipfile

import pytest


# ---------------------------------------------------------------------------
# Fixture helpers — programmatic anchor-only DOCX generation
# ---------------------------------------------------------------------------


def _build_anchor_only_docx_bytes(*, duplicate_blip: bool = False) -> bytes:
    """Hand-craft a minimal DOCX whose only picture is a floating
    `<wp:anchor>` (not inline). When `duplicate_blip=True`, two blips
    reference the SAME image relationship — used to assert dedup.

    Layout (ZIP entries):
      [Content_Types].xml
      _rels/.rels
      word/document.xml         (contains the anchor)
      word/_rels/document.xml.rels (maps rId7 → media/image1.png)
      word/media/image1.png      (a tiny PNG)
    """
    # Minimal 1x1 transparent PNG
    png_1x1 = bytes.fromhex(
        "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4"
        "890000000d49444154789c63f80f000001010100"
        "5a4d8a5a"  # CRC (approximate — minimal-fake; PIL is tolerant on size_filter path)
        "0000000049454e44ae426082"
    )
    # Use a known-good 1x1 PNG instead — the bytes above are fragile.
    png_1x1 = (
        b"\x89PNG\r\n\x1a\n"
        b"\x00\x00\x00\rIHDR"
        b"\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00"
        b"\x1f\x15\xc4\x89"
        b"\x00\x00\x00\rIDATx\x9cc\xf8\x0f\x00\x00\x01\x01\x01\x00\x5a\x4d\x8a\x5a"
        b"\x00\x00\x00\x00IEND\xaeB`\x82"
    )

    # Two anchor blips share rId7 if duplicate_blip=True
    second_blip_xml = ""
    if duplicate_blip:
        second_blip_xml = (
            '<w:p><w:r><w:drawing>'
            '<wp:anchor distT="0" distB="0" distL="0" distR="0" simplePos="0" '
            'relativeHeight="2" behindDoc="0" locked="0" layoutInCell="0" allowOverlap="1">'
            '<wp:positionH relativeFrom="column"><wp:posOffset>0</wp:posOffset></wp:positionH>'
            '<wp:positionV relativeFrom="paragraph"><wp:posOffset>0</wp:posOffset></wp:positionV>'
            '<wp:extent cx="914400" cy="914400"/>'
            '<wp:effectExtent l="0" t="0" r="0" b="0"/>'
            '<wp:wrapNone/><wp:docPr id="2" name="Picture 2"/><wp:cNvGraphicFramePr/>'
            '<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">'
            '<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">'
            '<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">'
            '<pic:nvPicPr><pic:cNvPr id="2" name="P2"/><pic:cNvPicPr/></pic:nvPicPr>'
            '<pic:blipFill><a:blip xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:embed="rId7"/>'
            '<a:stretch><a:fillRect/></a:stretch></pic:blipFill>'
            '<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="914400" cy="914400"/></a:xfrm>'
            '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic>'
            '</a:graphicData></a:graphic></wp:anchor></w:drawing></w:r></w:p>'
        )

    document_xml = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" '
        'xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" '
        'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" '
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" '
        'xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">'
        '<w:body><w:p><w:r><w:drawing>'
        '<wp:anchor distT="0" distB="0" distL="0" distR="0" simplePos="0" '
        'relativeHeight="1" behindDoc="0" locked="0" layoutInCell="0" allowOverlap="1">'
        '<wp:simplePos x="0" y="0"/>'
        '<wp:positionH relativeFrom="column"><wp:posOffset>0</wp:posOffset></wp:positionH>'
        '<wp:positionV relativeFrom="paragraph"><wp:posOffset>0</wp:posOffset></wp:positionV>'
        '<wp:extent cx="914400" cy="914400"/>'
        '<wp:effectExtent l="0" t="0" r="0" b="0"/>'
        '<wp:wrapNone/><wp:docPr id="1" name="Picture 1"/><wp:cNvGraphicFramePr/>'
        '<a:graphic>'
        '<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">'
        '<pic:pic>'
        '<pic:nvPicPr><pic:cNvPr id="1" name="P1"/><pic:cNvPicPr/></pic:nvPicPr>'
        '<pic:blipFill><a:blip r:embed="rId7"/>'
        '<a:stretch><a:fillRect/></a:stretch></pic:blipFill>'
        '<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="914400" cy="914400"/></a:xfrm>'
        '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic>'
        '</a:graphicData></a:graphic></wp:anchor></w:drawing></w:r></w:p>'
        + second_blip_xml +
        '</w:body></w:document>'
    )

    document_rels = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId7" '
        'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" '
        'Target="media/image1.png"/>'
        '</Relationships>'
    )

    content_types = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        '<Default Extension="xml" ContentType="application/xml"/>'
        '<Default Extension="png" ContentType="image/png"/>'
        '<Override PartName="/word/document.xml" '
        'ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
        '</Types>'
    )

    root_rels = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" '
        'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" '
        'Target="word/document.xml"/>'
        '</Relationships>'
    )

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("[Content_Types].xml", content_types)
        zf.writestr("_rels/.rels", root_rels)
        zf.writestr("word/document.xml", document_xml)
        zf.writestr("word/_rels/document.xml.rels", document_rels)
        zf.writestr("word/media/image1.png", png_1x1)
    return buf.getvalue()


@pytest.fixture(scope="module")
def anchor_only_docx_bytes() -> bytes:
    return _build_anchor_only_docx_bytes(duplicate_blip=False)


@pytest.fixture(scope="module")
def duplicate_blip_docx_bytes() -> bytes:
    return _build_anchor_only_docx_bytes(duplicate_blip=True)


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


def test_inline_shapes_zero_zip_xpath_nonzero_on_anchor_only(anchor_only_docx_bytes):
    """RAG-MM-LIFT-02 binding gate: anchor-only DOCX yields 0 inline_shapes
    AND >=1 zip_xpath images."""
    from app.services.extractors.aspects import images_docx

    inline = images_docx.inline_shapes_docx(anchor_only_docx_bytes)
    zip_xp = images_docx.zip_xpath_docx(anchor_only_docx_bytes)

    assert len(inline) == 0, "inline_shapes should return 0 on anchor-only DOCX"
    assert len(zip_xp) >= 1, "zip_xpath should detect the floating-anchor image"


def test_zip_xpath_dedups_by_media_path(duplicate_blip_docx_bytes):
    """Same `word/media/image1.png` referenced twice yields ONE ImageData."""
    from app.services.extractors.aspects import images_docx

    zip_xp = images_docx.zip_xpath_docx(duplicate_blip_docx_bytes)
    assert len(zip_xp) == 1, (
        f"Expected dedup to collapse 2 references → 1; got {len(zip_xp)}"
    )
