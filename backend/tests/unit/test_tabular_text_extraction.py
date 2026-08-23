"""
Unit tests for header-anchored CSV/Excel text output from extract_text in documents.py.
Phase 201 SEED-060 -- validates that semantic chunks always carry column schema context.
"""
from __future__ import annotations

import io


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_xlsx(sheets: dict) -> bytes:
    """Build xlsx bytes from {sheet_title: [[row_cells], ...]} dict."""
    import openpyxl
    wb = openpyxl.Workbook()
    first = True
    for title, rows in sheets.items():
        if first:
            ws = wb.active
            ws.title = title
            first = False
        else:
            ws = wb.create_sheet(title)
        for row in rows:
            ws.append(row)
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


# ---------------------------------------------------------------------------
# CSV tests
# ---------------------------------------------------------------------------

def test_extract_text_csv_contains_column_header():
    from app.api.documents import extract_text
    result = extract_text(b"Name,Age\nAlice,30\nBob,25", "text/csv")
    assert "[Columns: Name | Age]" in result
    assert "Alice" in result
    assert "Bob" in result


def test_extract_text_csv_header_anchored_blocks_for_large_files():
    from app.api.documents import extract_text, _TABLE_ROWS_PER_CHUNK
    lines = ["Name,Score"]
    for i in range(120):
        lines.append(f"Person{i},{i}")
    csv_bytes = "\n".join(lines).encode()
    result = extract_text(csv_bytes, "text/csv")
    blocks = result.split("\n\n")
    assert len(blocks) >= 3
    for block in blocks:
        assert block.strip().startswith("[Columns:")


def test_extract_text_csv_empty_rows_filtered():
    from app.api.documents import extract_text
    result = extract_text(b"Name,Age\nAlice,30\n\n\n\n", "text/csv")
    assert result.count("[Columns:") == 1


def test_extract_text_csv_single_row_header_only():
    from app.api.documents import extract_text
    result = extract_text(b"Name,Age,Role", "text/csv")
    assert result == "" or (result.startswith("[Columns:") and "\n" not in result.strip())


def test_extract_text_csv_application_csv_mime():
    from app.api.documents import extract_text
    result = extract_text(b"X,Y\n1,2", "application/csv")
    assert "[Columns: X | Y]" in result


def test_extract_text_csv_empty_bytes_returns_empty():
    from app.api.documents import extract_text
    assert extract_text(b"", "text/csv") == ""


# ---------------------------------------------------------------------------
# Excel tests
# ---------------------------------------------------------------------------

def test_extract_text_excel_contains_sheet_and_columns():
    from app.api.documents import extract_text
    xlsx = _make_xlsx({"Revenue": [["Year", "Q1"], [2023, 100], [2024, 200]]})
    result = extract_text(xlsx, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    assert "## Sheet: Revenue" in result
    assert "Columns: Year | Q1" in result


def test_extract_text_excel_multi_sheet_each_has_columns():
    from app.api.documents import extract_text
    xlsx = _make_xlsx({
        "Sales": [["Product", "Units"], ["Widget", 10]],
        "Budget": [["Category", "Amount"], ["R&D", 50000]],
    })
    result = extract_text(xlsx, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    assert "## Sheet: Sales" in result
    assert "## Sheet: Budget" in result
    parts = result.split("## Sheet:")
    for part in parts[1:]:
        assert "Columns:" in part


def test_extract_text_excel_empty_sheet_skipped():
    from app.api.documents import extract_text
    xlsx = _make_xlsx({"Empty": [], "Data": [["A", "B"], ["1", "2"]]})
    result = extract_text(xlsx, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    assert "## Sheet: Empty" not in result
    assert "## Sheet: Data" in result


def test_extract_text_excel_vnd_ms_excel_mime():
    from app.api.documents import extract_text
    xlsx = _make_xlsx({"Sheet1": [["Col"], ["val"]]})
    result = extract_text(xlsx, "application/vnd.ms-excel")
    assert "## Sheet:" in result
    assert "Columns:" in result
