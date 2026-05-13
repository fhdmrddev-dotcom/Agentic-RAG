"""
One-time reference-fixture generator for Phase 069 extraction tests.

Synthesizes `reference.pdf` and `reference.docx` — license-clean, ~1-2 MB each,
containing body text + one simple table + one small embedded PNG image.

Committed for reproducibility: regenerating the fixtures via this script and
recapturing the golden JSON should produce equivalent outputs (modulo
non-deterministic PDF metadata, which the test's `_normalize` helper rounds away).

Run manually from `backend/`:

    venv/Scripts/python tests/fixtures/extraction/_generate_fixtures.py
"""
from __future__ import annotations

import io
from pathlib import Path

from PIL import Image as PILImage

HERE = Path(__file__).resolve().parent
PDF_PATH = HERE / "reference.pdf"
DOCX_PATH = HERE / "reference.docx"


def _make_synthetic_png(width: int = 100, height: int = 100) -> bytes:
    """Generate a deterministic 100x100 grey PNG as a fixture image."""
    img = PILImage.new("RGB", (width, height), color=(128, 128, 128))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def generate_reference_pdf() -> None:
    """Build a 2-page reference PDF: body text + one table + one image."""
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import LETTER
    from reportlab.lib.styles import getSampleStyleSheet
    from reportlab.platypus import (
        Image as RLImage,
        PageBreak,
        Paragraph,
        SimpleDocTemplate,
        Spacer,
        Table,
        TableStyle,
    )

    styles = getSampleStyleSheet()
    body_style = styles["BodyText"]
    heading_style = styles["Heading1"]

    doc = SimpleDocTemplate(str(PDF_PATH), pagesize=LETTER)
    elements: list = []

    # ---- Page 1 — heading + body + table ----
    elements.append(Paragraph("Reference PDF for Extraction Tests", heading_style))
    elements.append(Spacer(1, 12))
    elements.append(Paragraph(
        "Reference PDF for extraction tests. Page 1. Lorem ipsum dolor sit amet, "
        "consectetur adipiscing elit. This paragraph exists to give pypdf text-extraction "
        "non-trivial content to work with, so that the golden-output fixture is meaningful.",
        body_style,
    ))
    elements.append(Spacer(1, 12))
    elements.append(Paragraph(
        "Second paragraph. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. "
        "Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.",
        body_style,
    ))
    elements.append(Spacer(1, 12))

    table_data = [
        ["Col1", "Col2", "Col3"],
        ["a1", "b1", "c1"],
        ["a2", "b2", "c2"],
        ["a3", "b3", "c3"],
    ]
    tbl = Table(table_data)
    tbl.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.lightgrey),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.black),
    ]))
    elements.append(tbl)

    elements.append(PageBreak())

    # ---- Page 2 — body + image ----
    elements.append(Paragraph("Reference PDF for Extraction Tests — Page 2", heading_style))
    elements.append(Spacer(1, 12))
    elements.append(Paragraph(
        "Page 2. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum "
        "dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, "
        "sunt in culpa qui officia deserunt mollit anim id est laborum.",
        body_style,
    ))
    elements.append(Spacer(1, 24))

    png_bytes = _make_synthetic_png(100, 100)
    elements.append(RLImage(io.BytesIO(png_bytes), width=100, height=100))

    doc.build(elements)
    print(f"Wrote {PDF_PATH} ({PDF_PATH.stat().st_size} bytes)")


def generate_reference_docx() -> None:
    """Build a reference DOCX: 2 paragraphs + one table + one inline image."""
    from docx import Document as DocxDocument
    from docx.shared import Inches

    doc = DocxDocument()

    doc.add_heading("Reference DOCX for Extraction Tests", level=1)
    doc.add_paragraph(
        "Reference DOCX paragraph 1. Lorem ipsum dolor sit amet, "
        "consectetur adipiscing elit. This paragraph gives python-docx "
        "non-trivial content for the golden-output fixture."
    )
    doc.add_paragraph(
        "Reference DOCX paragraph 2. Sed do eiusmod tempor incididunt ut labore "
        "et dolore magna aliqua."
    )

    table = doc.add_table(rows=4, cols=3)
    table.style = "Table Grid"
    headers = ["Col1", "Col2", "Col3"]
    data = [
        ["a1", "b1", "c1"],
        ["a2", "b2", "c2"],
        ["a3", "b3", "c3"],
    ]
    for j, h in enumerate(headers):
        table.rows[0].cells[j].text = h
    for i, row_data in enumerate(data, start=1):
        for j, cell_val in enumerate(row_data):
            table.rows[i].cells[j].text = cell_val

    png_bytes = _make_synthetic_png(100, 100)
    doc.add_picture(io.BytesIO(png_bytes), width=Inches(1.0))

    doc.save(str(DOCX_PATH))
    print(f"Wrote {DOCX_PATH} ({DOCX_PATH.stat().st_size} bytes)")


def _normalize(o):
    """Match `_normalize` in `tests/unit/test_extraction_service.py`."""
    if isinstance(o, float):
        return round(o, 4)
    if isinstance(o, dict):
        return {k: _normalize(o[k]) for k in sorted(o)}
    if isinstance(o, list):
        return [_normalize(x) for x in o]
    return o


def write_golden_jsons() -> None:
    """Capture today's `LegacyExtractor.extract` output as canonical golden JSON.

    Run AFTER `generate_reference_pdf` + `generate_reference_docx` and AFTER
    `backend/app/services/extraction_service.py` exists. From that point on,
    the unit tests assert byte-equivalent extraction against these files.
    """
    import json
    import os
    import sys
    from dataclasses import asdict

    # `extraction_service._extract_tables/_images` lazily imports
    # `app.services.multimodal_service`, which transitively imports
    # `app.config.Settings()` (pydantic-settings). Settings requires
    # SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY at instantiation time.
    # Match conftest.py's test-env defaults so the golden capture runs
    # under the same conditions as the unit-test suite.
    os.environ.setdefault("SUPABASE_URL", "https://test.supabase.co")
    os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key")
    os.environ.setdefault("LLM_API_KEY", "test-llm-api-key")
    os.environ.setdefault("LANGSMITH_TRACING", "false")
    os.environ.setdefault("LANGSMITH_PROJECT", "test-project")

    # Backend root is two levels up from this script's parent.
    backend_root = HERE.parent.parent.parent
    if str(backend_root) not in sys.path:
        sys.path.insert(0, str(backend_root))

    from app.services.extraction_service import LegacyExtractor, PDF_MIME, DOCX_MIME

    pdf_out = _normalize(asdict(LegacyExtractor().extract(PDF_PATH.read_bytes(), PDF_MIME)))
    (HERE / "reference_pdf_golden.json").write_text(json.dumps(pdf_out, indent=2, sort_keys=True))

    docx_out = _normalize(asdict(LegacyExtractor().extract(DOCX_PATH.read_bytes(), DOCX_MIME)))
    (HERE / "reference_docx_golden.json").write_text(json.dumps(docx_out, indent=2, sort_keys=True))

    print(
        f"Golden written. "
        f"pdf(text_len={len(pdf_out['text'])}, tables={len(pdf_out['tables'])}, images={len(pdf_out['images'])}) "
        f"docx(text_len={len(docx_out['text'])}, tables={len(docx_out['tables'])}, images={len(docx_out['images'])})"
    )


if __name__ == "__main__":
    HERE.mkdir(parents=True, exist_ok=True)
    generate_reference_pdf()
    generate_reference_docx()
    write_golden_jsons()
