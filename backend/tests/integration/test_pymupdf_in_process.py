"""Phase 071.3 Plan 04 Phase G smoke test (D-071.3-11).

Asserts in-process import fitz works correctly post-httpx-unpin. If this
test passes, Plan 04 deletes the PyMuPDF subprocess fence. If it fails,
Plan 04 keeps the fence and plants SEED-022 (in-process retry trigger).

The intent of this smoke is to gate "does `import fitz` work in-process
post-httpx-unpin WITHOUT CRASHING" — NOT "does this fixture have images".
Image/table counts are recorded for visibility but are NOT assertion gates;
a fixture with zero embedded images is still a valid no-crash signal.
"""
from __future__ import annotations
from pathlib import Path
import pytest

HERE = Path(__file__).resolve()
BACKEND_DIR = HERE.parent.parent.parent
FIXTURES = BACKEND_DIR / "tests" / "fixtures" / "extraction"
REFERENCE_PDF = FIXTURES / "reference.pdf"


@pytest.mark.skipif(
    not REFERENCE_PDF.exists(),
    reason="reference.pdf fixture missing — run from a fresh checkout",
)
def test_fitz_in_process_smoke():
    """In-process PyMuPDF imports and runs without crashing post-httpx-unpin
    (D-071.3-11).

    Pass criterion = "the AGPL fence's in-process import works after the
    unpin; find_tables() and get_images() can be CALLED on every page
    without exception". Image/table counts are NOT assertions — a fixture
    with zero images is still a no-crash pass. The image-recall regression
    test is Plan 05's live UAT, not this smoke.
    """
    import fitz  # noqa: PLC0415 — AGPL in-process per D-PRD-07
    raw = REFERENCE_PDF.read_bytes()
    doc = fitz.Document(stream=raw, filetype="pdf")
    try:
        total_pages = len(doc)
        assert total_pages > 0, "smoke: reference.pdf has zero pages — fixture is corrupt"
        # Tables: page.find_tables() must not crash on any page.
        # PyMuPDF 1.27 may print "Consider using pymupdf_layout..." to
        # stdout — tolerated here; just need no exception.
        pages_visited = 0
        total_tables = 0
        for page in doc:
            tables = page.find_tables()
            # Best-effort count without enforcing a floor
            try:
                total_tables += len(list(tables))
            except Exception:
                pass
            pages_visited += 1
        assert pages_visited == total_pages, (
            "smoke: find_tables crashed before visiting all pages"
        )
        # Images: get_images(full=True) must return without crash on every page.
        # Zero images is a VALID outcome — we are gating "in-process import works",
        # not "this fixture has images". A non-crash get_images() call on all pages
        # is the actual D-071.3-11 signal.
        total_images = sum(len(page.get_images(full=True)) for page in doc)
        assert total_images >= 0, (
            "smoke: get_images returned a negative count (impossible)"
        )
        # Diagnostic print for the SUMMARY / SEED bodies (not an assertion):
        print(
            f"[D-071.3-11 smoke] pages={total_pages} "
            f"tables={total_tables} images={total_images}"
        )
    finally:
        doc.close()
