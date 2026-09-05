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


# -------------------------------------------------------------------------------------
# The "no text" message must describe the FILE's state, not the extractor's experience.
#
# An operator uploaded an .xlsx, got "No text content could be extracted from the file",
# and reasonably read it as a broken importer. It was not: the workbook was genuinely
# empty (<sheetData/> self-closed, no sharedStrings.xml). Proving the app was RIGHT cost
# more than the message would have.
# -------------------------------------------------------------------------------------
import pytest

from app.api.documents import (
    _EMPTY_TEXT_DEFAULT,
    empty_text_message,
)

XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"


@pytest.mark.parametrize(
    "mime,needle",
    [
        (XLSX, "spreadsheet is empty"),
        ("application/vnd.ms-excel", "spreadsheet is empty"),
        ("text/csv", "no rows"),
        ("application/pdf", "scan"),
        ("message/rfc822", "no readable message body"),
        ("application/vnd.ms-outlook", "no readable message body"),
        ("application/x-msg", "no readable message body"),
    ],
)
def test_named_formats_say_what_is_true_of_the_file(mime, needle):
    msg = empty_text_message(mime)
    assert needle in msg
    assert msg != _EMPTY_TEXT_DEFAULT


@pytest.mark.parametrize("mime", [DOCX, "text/markdown", "application/zip", "", None])
def test_everything_else_keeps_the_generic_sentence_word_for_word(mime):
    """A DOCX extracting to nothing could be a dozen things. A wrong SPECIFIC message is
    worse than a right VAGUE one, so the fallback is deliberate and byte-unchanged."""
    assert empty_text_message(mime) == _EMPTY_TEXT_DEFAULT


def test_the_generic_sentence_itself_has_not_been_reworded():
    assert _EMPTY_TEXT_DEFAULT == "No text content could be extracted from the file."


#: Markers standing in for "this sentence tells the reader what to DO, or explains WHY".
#:
#: ⚠ `"OCR"` WAS ONE OF THESE AND WAS REMOVED 2026-09-05 (SEED-226). It was accepted here as
#:   an explanation, and it was the opposite: the PDF sentence promised OCR while the backend
#:   contained no OCR engine of any kind. A marker list that rewards naming a capability the
#:   product lacks makes this fence complicit in the defect it exists to catch, so the promise
#:   left the message and the word left this list in the same commit.
#:
#: ⚠ THIS IS A PROXY, NOT THE PROPERTY. It is deliberately narrow — the generic sentence
#:   (`_EMPTY_TEXT_DEFAULT`, "No text content could be extracted from the file.") still fails
#:   it, which is the case the fence was written for.
_ACTIONABLE_OR_EXPLANATORY = (
    "again",              # xlsx / xls / csv — says what to do
    "body",               # the three email mimes — says which part was empty
    "scan or a drawing",  # pdf — says what the file probably IS
    "still stored",       # images — says the file was read and kept, not rejected
)


def test_every_message_is_actionable_or_explanatory_never_bare():
    """Each specific message must either tell the reader what to DO or explain WHY.
    A sentence that only restates the failure is what this change exists to remove."""
    from app.api.documents import _EMPTY_TEXT_MESSAGES

    for mime, msg in _EMPTY_TEXT_MESSAGES.items():
        assert len(msg) > 30, mime
        assert any(w in msg for w in _ACTIONABLE_OR_EXPLANATORY), (mime, msg)


def test_no_empty_text_message_promises_ocr():
    """⛔ SEED-226'S ROOT DEFECT, FENCED SO IT CANNOT RETURN.

    The product told users a file needed OCR before it could be searched while shipping no OCR
    engine at all. Vision transcription now runs on that case, so no message may name OCR as
    the missing step — reaching an empty-text message means transcription was already tried.
    """
    from app.api.documents import _EMPTY_TEXT_MESSAGES, _EMPTY_TEXT_DEFAULT

    for mime, msg in _EMPTY_TEXT_MESSAGES.items():
        assert "OCR" not in msg, (mime, msg)
    assert "OCR" not in _EMPTY_TEXT_DEFAULT
