"""Build a minimal DOCX fixture containing floating-anchor images
(NOT inline_shapes). Used by test_reextract_dispatcher.py to verify
Phase 072.1 Gap 2 fix — `zip_xpath_docx` engine reaches floating shapes
that the legacy `extract_docx_images` (inline_shapes-only) misses.

Output: backend/tests/fixtures/extraction/floating_shapes.docx
"""
from __future__ import annotations

import io
from pathlib import Path

from docx import Document
from docx.shared import Inches
from PIL import Image


OUT_PATH = Path(__file__).resolve().parents[1] / "tests" / "fixtures" / "extraction" / "floating_shapes.docx"


def build() -> None:
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)

    # Build a small DOCX with text + two embedded images via add_picture.
    # By default add_picture emits a wp:inline shape; we then patch the XML
    # to convert each wp:inline to a wp:anchor (floating) so the test
    # exercises the same path that python-docx inline_shapes silently skips
    # but zip_xpath_docx MUST find.
    doc = Document()
    doc.add_paragraph(
        "Phase 072.1 Gap 2 test fixture — floating shape DOCX."
    )
    doc.add_paragraph(
        "This document contains floating-anchor images that python-docx "
        "inline_shapes cannot find but the zip_xpath_docx engine MUST find."
    )

    # Two distinct PNGs (different colors → different SHA1 → not deduped).
    img1 = Image.new("RGB", (220, 220), color=(120, 180, 220))
    buf1 = io.BytesIO()
    img1.save(buf1, format="PNG")
    buf1.seek(0)
    doc.add_picture(buf1, width=Inches(2.0))

    img2 = Image.new("RGB", (220, 220), color=(220, 120, 180))
    buf2 = io.BytesIO()
    img2.save(buf2, format="PNG")
    buf2.seek(0)
    doc.add_picture(buf2, width=Inches(2.0))

    # Convert each `<wp:inline>` shape to `<wp:anchor>` so they become
    # floating. wp:anchor requires extra attributes that wp:inline does not;
    # set the minimal set so Word + lxml accept the shape and the
    # zip_xpath_docx engine reaches the embedded a:blip.
    WP = "http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
    for inline in list(doc.element.body.iter(f"{{{WP}}}inline")):
        inline.tag = f"{{{WP}}}anchor"
        # Minimum required attributes for a wp:anchor:
        for attr, val in (
            ("distT", "0"), ("distB", "0"),
            ("distL", "0"), ("distR", "0"),
            ("simplePos", "0"),
            ("relativeHeight", "0"), ("behindDoc", "0"),
            ("locked", "0"), ("layoutInCell", "1"),
            ("allowOverlap", "1"),
        ):
            inline.set(attr, val)

    doc.save(OUT_PATH)
    print(f"Wrote fixture: {OUT_PATH} ({OUT_PATH.stat().st_size} bytes)")


if __name__ == "__main__":
    build()
