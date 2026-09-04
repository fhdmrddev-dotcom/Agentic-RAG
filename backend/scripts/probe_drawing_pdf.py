"""What does this app actually SEE inside a PDF? — the SEED-226 probe.

    cd backend && ./venv/Scripts/python.exe scripts/probe_drawing_pdf.py <file.pdf> ...

Written because the drawing-to-BOQ business case turns on a question nobody had put a
number to: given a construction PDF, what reaches the index? The answer splits into two
completely different failure modes that share one file extension, and only one of them
announces itself.

⚠ IT CALLS THE APP'S OWN EXTRACTION PATH AND THAT DISTINCTION IS LOAD-BEARING. The first
draft of this probe read `multimodal_service.extract_pdf_images`, which is the LEGACY
pdfplumber fallback. Real ingestion calls `extract_composable` (`api/documents.py:303`),
which resolves `extraction_image_engine_pdf` — default `pymupdf_full`. On a scanned page
the two DISAGREE: the fallback finds 0 images, the real path finds 1. A probe reading the
fallback would have reported that a scan yields nothing whatsoever, which is false.

⚠ WINDOWS: run with `PYTHONUTF8=1`, or the ⚠ in the output kills it with a cp1252
UnicodeEncodeError. Measured, not guessed.
"""
from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

PDF_MIME = "application/pdf"
VISION_CAP_DEFAULT = 100        # migration 044's default for multimodal_max_vision_calls
EMPTY_TEXT_THRESHOLD = 1        # documents.py treats "no text" as nothing to chunk


def _rule(title: str) -> None:
    print("\n" + "=" * 78)
    print(title)
    print("=" * 78)


def analyse(path: str) -> dict:
    from app.services.extractors import aspects
    from app.services.extraction_service import extract_composable
    from app.services.multimodal_service import extract_pdf_images, extract_pdf_tables

    raw = open(path, "rb").read()
    out: dict = {"path": path, "bytes": len(raw)}

    # ---- Text, through BOTH shipped engines ---------------------------------
    per_engine = {}
    for name, fn in aspects.TEXT_ENGINES.items():
        try:
            text, _md = fn(raw, PDF_MIME)
            per_engine[name] = text or ""
        except Exception as exc:                    # an engine that dies IS the finding
            per_engine[name] = f"<<ENGINE RAISED {exc.__class__.__name__}: {exc}>>"
    out["text_by_engine"] = per_engine
    out["default_engine"] = "legacy"                # extraction_text_engine_pdf default
    out["default_chars"] = len(per_engine.get("legacy", ""))

    # ---- Pages + vector density ---------------------------------------------
    import fitz
    doc = fitz.Document(stream=raw, filetype="pdf")
    out["pages"] = doc.page_count
    ops = 0
    for page in doc:
        try:
            ops += len(page.get_drawings())
        except Exception:
            pass
    out["vector_drawings"] = ops
    doc.close()

    # ---- Images + tables, through the REAL path ------------------------------
    try:
        composed = extract_composable(raw, PDF_MIME)
        out["images"] = len(composed.images or [])
        out["tables_composable"] = len(composed.tables or [])
    except Exception as exc:
        out["images"] = f"<<RAISED {exc.__class__.__name__}: {exc}>>"
        out["tables_composable"] = "?"
    try:
        out["images_legacy_fallback"] = len(extract_pdf_images(raw))
    except Exception as exc:
        out["images_legacy_fallback"] = f"<<RAISED {exc.__class__.__name__}>>"
    try:
        out["tables_pdfplumber"] = len(extract_pdf_tables(raw))
    except Exception as exc:
        out["tables_pdfplumber"] = f"<<RAISED {exc.__class__.__name__}>>"

    return out


def verdict(a: dict) -> tuple[str, list[str]]:
    """Name the failure mode, and say what the app would DO with this file."""
    chars = a["default_chars"]
    imgs = a["images"] if isinstance(a["images"], int) else 0
    notes: list[str] = []

    if chars < EMPTY_TEXT_THRESHOLD:
        mode = "SCAN / IMAGE-ONLY — no text layer"
        notes.append(
            "Nothing to chunk. The user is told: 'No text could be read from this PDF. It "
            "is most likely a scan or a set of images, which needs OCR before it can be "
            "searched.' THERE IS NO OCR IN THIS APP — the product names a capability it "
            "does not have, which is honest and is also the end of the road for this file."
        )
        if imgs:
            notes.append(
                f"{imgs} image(s) DO reach the vision model, so the whole sheet becomes a "
                "1-2 sentence caption. That is the SEED-006 measurement (~5% of visible "
                "figure content survives) meeting a document that is 100% figure."
            )
    elif a["vector_drawings"] > 0 and chars < 4000:
        mode = "DRAWING-SHAPED — a text layer over vector geometry"
        notes.append(
            "⚠ THE DANGEROUS CASE, and the one no gate can catch. Text extracts, chunks "
            "embed, nothing errors and nothing goes red — but the numbers arrive with no "
            "tie to the geometry they annotate. A quantity derived from them is a guess "
            "wearing a decimal point, and it will look exactly like an answer."
        )
    else:
        mode = "ORDINARY DOCUMENT — prose and/or tables"
        notes.append("The shipped pipeline is the right engine for this file.")

    if imgs > VISION_CAP_DEFAULT:
        notes.append(
            f"⚠ {imgs} images exceeds the ceiling of {VISION_CAP_DEFAULT}: "
            f"{imgs - VISION_CAP_DEFAULT} would go unread — SAID on the document since "
            "SEED-227, silent before it."
        )
    return mode, notes


def main(paths: list[str]) -> None:
    for p in paths:
        if not os.path.exists(p):
            print(f"!! missing: {p}")
            continue
        a = analyse(p)
        _rule(f"{os.path.basename(p)}   ({a['bytes']:,} bytes, {a['pages']} page(s))")

        mode, notes = verdict(a)
        print(f"VERDICT: {mode}\n")
        for n in notes:
            print(f"  - {n}")

        print(f"\n  vector drawing ops : {a['vector_drawings']:,}")
        print(f"  images (REAL path) : {a['images']}"
              f"   [legacy fallback: {a['images_legacy_fallback']}]")
        print(f"  tables             : camelot {a['tables_composable']}"
              f"  ·  pdfplumber {a['tables_pdfplumber']}")

        print("\n  TEXT PER ENGINE (chars):")
        for name, text in a["text_by_engine"].items():
            mark = "  <- shipped default" if name == a["default_engine"] else ""
            print(f"    {name:>10}: {len(text):>7,}{mark}")

        sample = " ".join(a["text_by_engine"].get("legacy", "").split())[:420]
        print("\n  WHAT THE TEXT ACTUALLY LOOKS LIKE:")
        print(f"    {sample if sample else '<< nothing >>'}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    main(sys.argv[1:])
