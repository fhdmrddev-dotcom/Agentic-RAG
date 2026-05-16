"""Spike 001 — pymupdf_full baseline measurement.

Anchors the deltas for spikes 002-004. Uses the project's existing adapter
(`backend/app/services/extractors/aspects/images_pdf.py::pymupdf_full_images_pdf`)
WITHOUT importing it — we replicate the relevant logic inline to keep the
spike self-contained and runnable from a fresh shell with only `pymupdf` in
the venv.

Per the spike workflow: every line serves the question. No auth, no DB, no
config files. The PDF path is hardcoded to the project's known fixture.

Run from repo root with the backend venv activated:
    cd backend && venv/Scripts/python ../.planning/spikes/001-pymupdf-full-baseline/run.py

Expected output: figure count + per-page breakdown + wall time.
"""
from __future__ import annotations

import hashlib
import io
import sys
import time
from pathlib import Path

import fitz  # PyMuPDF — AGPL in-process per D-PRD-07
from PIL import Image as PILImage

REPO_ROOT = Path(__file__).resolve().parents[3]
THESIS_PRIMARY = REPO_ROOT / ".planning" / "spikes" / "_fixtures" / "thesis.pdf"
THESIS_FALLBACK = REPO_ROOT / "backend" / "tests" / "fixtures" / "extraction" / "friendly_real.pdf"


def resolve_fixture() -> Path:
    if THESIS_PRIMARY.exists():
        return THESIS_PRIMARY
    print(
        f"⚠ Thesis not found at {THESIS_PRIMARY} — falling back to {THESIS_FALLBACK.name} "
        "(small arXiv paper — signal will be weaker than the operator's 59-figure thesis).",
        file=sys.stderr,
    )
    return THESIS_FALLBACK


def extract_images_pymupdf_full(raw: bytes) -> list[dict]:
    """Mirror of pymupdf_full_images_pdf for the spike anchor.

    Walks page.get_images(full=True), extracts via doc.extract_image(xref),
    PNG-encodes via PIL. Returns list of {page, image_index, sha1, width, height}.
    """
    doc = fitz.Document(stream=raw, filetype="pdf")
    out: list[dict] = []
    global_idx = 0
    try:
        for page_num, page in enumerate(doc, start=1):
            for (xref, *_) in page.get_images(full=True):
                try:
                    info = doc.extract_image(xref)
                    raw_img = info["image"]
                    img = PILImage.open(io.BytesIO(raw_img)).convert("RGB")
                    buf = io.BytesIO()
                    img.save(buf, format="PNG")
                    png_bytes = buf.getvalue()
                    out.append({
                        "page": page_num,
                        "image_index": global_idx,
                        "sha1": hashlib.sha1(png_bytes).hexdigest()[:16],
                        "width": info.get("width") or img.width,
                        "height": info.get("height") or img.height,
                    })
                    global_idx += 1
                except Exception as e:  # noqa: BLE001
                    print(f"  ! page={page_num} xref={xref} skipped: {e}", file=sys.stderr)
    finally:
        doc.close()
    return out


def main() -> int:
    fixture = resolve_fixture()
    if not fixture.exists():
        print(f"FAIL: no fixture available at {fixture}", file=sys.stderr)
        return 2

    raw = fixture.read_bytes()
    print(f"Fixture: {fixture} ({len(raw):,} bytes)")

    t0 = time.perf_counter()
    images = extract_images_pymupdf_full(raw)
    elapsed = time.perf_counter() - t0

    # Unique-by-hash count (matches the dedup Plan 02 will ship — gives us the
    # post-dedup floor that the project itself stores).
    unique_hashes = {im["sha1"] for im in images}

    print(f"\nRaw figure count (pre-dedup):  {len(images)}")
    print(f"Unique figures (SHA1 dedup):   {len(unique_hashes)}")
    print(f"Wall time:                      {elapsed:.2f}s")

    # Per-page breakdown
    by_page: dict[int, int] = {}
    for im in images:
        by_page[im["page"]] = by_page.get(im["page"], 0) + 1
    print("\nPer-page distribution (top 10 pages):")
    for page, count in sorted(by_page.items(), key=lambda x: -x[1])[:10]:
        print(f"  page {page:3d}: {count} images")

    # Verdict signal
    print("\n---")
    print(f"BASELINE = {len(unique_hashes)} unique figures (post-SHA1 dedup)")
    print(f"GROUND TRUTH (thesis estimate): ~59 visible figures")
    print(f"RECALL: {len(unique_hashes) / 59 * 100:.1f}%")
    print(f"GAP TO 80%: need ~{47 - len(unique_hashes)} more figures")
    return 0


if __name__ == "__main__":
    sys.exit(main())
