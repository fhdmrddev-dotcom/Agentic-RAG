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

# Phase 071 D-071-16 — synthetic academic fixtures (≥ 5 tables + 5 images each).
# License-clean: programmatically generated via reportlab + python-docx + PIL.
ACADEMIC_PDF_PATH = HERE / "academic_synth.pdf"
ACADEMIC_DOCX_PATH = HERE / "academic_synth.docx"


def _make_synthetic_png(width: int = 100, height: int = 100) -> bytes:
    """Generate a deterministic 100x100 grey PNG as a fixture image."""
    img = PILImage.new("RGB", (width, height), color=(128, 128, 128))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def _make_colored_png(
    width: int = 200,
    height: int = 150,
    color: tuple[int, int, int] = (128, 128, 128),
    label: str = "",
) -> bytes:
    """Generate a deterministic colored PNG with an optional label.

    Used by the Phase 071 D-071-16 academic_synth fixtures to give Docling's
    layout analyzer ≥ 5 distinct images to detect per sibling.
    """
    img = PILImage.new("RGB", (width, height), color=color)
    # Optional: stamp a label so Docling's PictureItem can hook on visually
    # distinct content. We skip ImageDraw import to keep the generator slim;
    # the bare colored rectangle is enough for layout detection.
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


def generate_academic_pdf() -> None:
    """Phase 071 D-071-16 — synthetic academic-style PDF with ≥ 5 tables + ≥ 5 images.

    License-clean (no copyrighted source content). Used as a regression net
    for DoclingExtractor — NOT the binding SC#1 gate (that's the live UAT
    on the user's `551f03f9-...` thesis). Generated via reportlab + PIL.
    """
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
    h1 = styles["Heading1"]
    h2 = styles["Heading2"]

    doc = SimpleDocTemplate(str(ACADEMIC_PDF_PATH), pagesize=LETTER)
    elements: list = []

    # --- Title + abstract ---
    elements.append(Paragraph("Synthetic Experimental Results: A Regression Fixture", h1))
    elements.append(Spacer(1, 12))
    elements.append(Paragraph(
        "Abstract. This document is a license-clean synthetic academic-style fixture "
        "generated for Phase 071's DoclingExtractor regression net (D-071-16). It "
        "contains five tables of synthetic experimental data and five embedded figures, "
        "designed to exercise Docling's layout-analysis pipeline. The content is "
        "deterministically generated and contains no real-world or copyrighted data.",
        body_style,
    ))
    elements.append(Spacer(1, 12))

    # Color palette for 5 distinct figures
    palette = [
        (200, 80, 80),    # red
        (80, 160, 80),    # green
        (80, 100, 200),   # blue
        (200, 180, 60),   # gold
        (180, 100, 200),  # violet
    ]

    # Generate 5 sections, each with a table + figure pair so Docling sees both
    # repeatedly across multiple pages and surfaces ≥ 5 tables + ≥ 5 images.
    for i in range(1, 6):
        elements.append(PageBreak() if i > 1 else Spacer(1, 6))
        elements.append(Paragraph(f"Section {i}: Experimental Condition {i}", h2))
        elements.append(Spacer(1, 8))
        elements.append(Paragraph(
            f"We report the results of Experimental Condition {i}. Mean values "
            f"are presented with standard deviation across five trial repetitions. "
            f"Statistical significance was assessed via a two-tailed t-test against "
            f"the control baseline (p < 0.05).",
            body_style,
        ))
        elements.append(Spacer(1, 10))

        # Table — synthetic academic-style results
        table_data = [
            [f"Metric {i}", "Mean", "SD", "n", "p-value"],
            [f"Treatment A", f"{1.20 + i * 0.1:.2f}", f"{0.05 + i * 0.01:.3f}", "5", f"{0.001 * i:.3f}"],
            [f"Treatment B", f"{0.95 + i * 0.1:.2f}", f"{0.07 + i * 0.01:.3f}", "5", f"{0.002 * i:.3f}"],
            [f"Treatment C", f"{1.45 + i * 0.1:.2f}", f"{0.06 + i * 0.01:.3f}", "5", f"{0.001 * i:.3f}"],
            [f"Control",     f"{1.00:.2f}",            f"{0.04:.3f}",            "5", "—"],
        ]
        tbl = Table(table_data, hAlign="LEFT")
        tbl.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.lightgrey),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.black),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ]))
        elements.append(tbl)
        elements.append(Spacer(1, 14))

        # Figure — distinct colored rectangle per section so Docling sees 5 distinct images
        png_bytes = _make_colored_png(
            width=220,
            height=160,
            color=palette[(i - 1) % len(palette)],
            label=f"Figure {i}",
        )
        elements.append(Paragraph(f"Figure {i}: Visualisation of Condition {i} results.", body_style))
        elements.append(RLImage(io.BytesIO(png_bytes), width=220, height=160))
        elements.append(Spacer(1, 12))

    doc.build(elements)
    print(f"Wrote {ACADEMIC_PDF_PATH} ({ACADEMIC_PDF_PATH.stat().st_size} bytes)")


def generate_academic_docx() -> None:
    """Phase 071 D-071-16 — sibling DOCX with ≥ 5 tables + ≥ 5 images.

    License-clean (no copyrighted source content). Mirrors generate_academic_pdf
    structurally so Docling's PDF and DOCX pipelines both surface the same
    extraction-count assertions.
    """
    from docx import Document as DocxDocument
    from docx.shared import Inches

    doc = DocxDocument()

    doc.add_heading("Synthetic Experimental Results: A Regression Fixture", level=1)
    doc.add_paragraph(
        "Abstract. This document is a license-clean synthetic academic-style "
        "fixture generated for Phase 071's DoclingExtractor regression net "
        "(D-071-16). It contains five tables of synthetic experimental data and "
        "five embedded figures, designed to exercise Docling's layout-analysis "
        "pipeline."
    )

    palette = [
        (200, 80, 80),
        (80, 160, 80),
        (80, 100, 200),
        (200, 180, 60),
        (180, 100, 200),
    ]

    for i in range(1, 6):
        doc.add_heading(f"Section {i}: Experimental Condition {i}", level=2)
        doc.add_paragraph(
            f"We report the results of Experimental Condition {i}. Mean values "
            f"are presented with standard deviation across five trial repetitions. "
            f"Statistical significance was assessed via a two-tailed t-test against "
            f"the control baseline (p < 0.05)."
        )

        # Table — 5 rows × 5 cols
        table = doc.add_table(rows=5, cols=5)
        table.style = "Table Grid"
        headers = [f"Metric {i}", "Mean", "SD", "n", "p-value"]
        rows_data = [
            [f"Treatment A", f"{1.20 + i * 0.1:.2f}", f"{0.05 + i * 0.01:.3f}", "5", f"{0.001 * i:.3f}"],
            [f"Treatment B", f"{0.95 + i * 0.1:.2f}", f"{0.07 + i * 0.01:.3f}", "5", f"{0.002 * i:.3f}"],
            [f"Treatment C", f"{1.45 + i * 0.1:.2f}", f"{0.06 + i * 0.01:.3f}", "5", f"{0.001 * i:.3f}"],
            [f"Control",     f"{1.00:.2f}",            f"{0.04:.3f}",            "5", "—"],
        ]
        for j, h in enumerate(headers):
            table.rows[0].cells[j].text = h
        for ri, row_data in enumerate(rows_data, start=1):
            for cj, cell_val in enumerate(row_data):
                table.rows[ri].cells[cj].text = cell_val

        # Figure — distinct colored rectangle per section
        png_bytes = _make_colored_png(
            width=220,
            height=160,
            color=palette[(i - 1) % len(palette)],
            label=f"Figure {i}",
        )
        doc.add_paragraph(f"Figure {i}: Visualisation of Condition {i} results.")
        doc.add_picture(io.BytesIO(png_bytes), width=Inches(2.5))

    doc.save(str(ACADEMIC_DOCX_PATH))
    print(f"Wrote {ACADEMIC_DOCX_PATH} ({ACADEMIC_DOCX_PATH.stat().st_size} bytes)")


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
    generate_academic_pdf()
    generate_academic_docx()
    write_golden_jsons()
    print("OK academic_synth.{pdf,docx} + reference goldens written")
