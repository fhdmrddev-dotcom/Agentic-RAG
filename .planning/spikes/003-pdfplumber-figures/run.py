"""Spike 003 — pdfplumber.page.images comparison.

Question: pdfplumber is already a project dep. Its `page.images` accessor
returns native raster bboxes (was originally going to use `page.figures` but
that attribute doesn't exist in pdfplumber 0.11.9 — pivoted to `page.images`,
which is the actual API). Does this match, beat, or complement
pymupdf_full's `get_images(full=True)`?

The result is essentially a sanity-check: both engines walk the PDF's
image-object xrefs, so they SHOULD converge on similar counts. Divergence
would tell us one engine is missing image objects the other catches.

Run from repo root:
    backend/venv/Scripts/python.exe .planning/spikes/003-pdfplumber-figures/run.py

Output: pdfplumber image count + comparison to Spike 001 + 002 numbers.
"""
from __future__ import annotations

import hashlib
import io
import sys
import time
from pathlib import Path

import pdfplumber
from PIL import Image as PILImage

REPO_ROOT = Path(__file__).resolve().parents[3]
THESIS_PRIMARY = REPO_ROOT / ".planning" / "spikes" / "_fixtures" / "thesis.pdf"
THESIS_FALLBACK = REPO_ROOT / "backend" / "tests" / "fixtures" / "extraction" / "friendly_real.pdf"

RENDER_DPI = 100  # match Spike 002 for like-vs-like clip comparisons
MIN_FIG_DIM = 30  # px — same lower bound as Spike 002


def resolve_fixture() -> Path:
    if THESIS_PRIMARY.exists():
        return THESIS_PRIMARY
    print(
        f"⚠ Thesis not found at {THESIS_PRIMARY} — falling back to {THESIS_FALLBACK.name} "
        "(small arXiv paper — signal will be weaker than the operator's 59-figure thesis).",
        file=sys.stderr,
    )
    return THESIS_FALLBACK


def render_clip_sha1(page, bbox_dict: dict) -> str:
    """pdfplumber image bboxes are in PDF user-space points; we crop via
    pdfplumber's own raster path and SHA1 the rendered PNG bytes."""
    x0 = float(bbox_dict["x0"])
    y0 = float(bbox_dict["top"])
    x1 = float(bbox_dict["x1"])
    y1 = float(bbox_dict["bottom"])
    # Clamp to page mediabox so within_bbox doesn't raise
    page_x0, page_y0, page_x1, page_y1 = (
        float(page.bbox[0]), float(page.bbox[1]),
        float(page.bbox[2]), float(page.bbox[3]),
    )
    x0 = max(page_x0, x0)
    y0 = max(page_y0, y0)
    x1 = min(page_x1, x1)
    y1 = min(page_y1, y1)
    if x1 <= x0 or y1 <= y0:
        raise ValueError("degenerate bbox after clamp")
    cropped = page.within_bbox((x0, y0, x1, y1)).to_image(resolution=RENDER_DPI)
    buf = io.BytesIO()
    cropped.save(buf, format="PNG")
    return hashlib.sha1(buf.getvalue()).hexdigest()[:16]


def main() -> int:
    fixture = resolve_fixture()
    if not fixture.exists():
        print(f"FAIL: no fixture available at {fixture}", file=sys.stderr)
        return 2

    print(f"Fixture: {fixture} ({fixture.stat().st_size:,} bytes)")
    print(f"Tunables: RENDER_DPI={RENDER_DPI}  MIN_FIG_DIM={MIN_FIG_DIM}px")
    print()

    t0 = time.perf_counter()
    figure_hashes: set[str] = set()
    raw_figure_count = 0
    by_page: dict[int, int] = {}

    with pdfplumber.open(str(fixture)) as pdf:
        print(f"Total pages: {len(pdf.pages)}")
        for page_num, page in enumerate(pdf.pages, start=1):
            page_imgs = page.images or []
            raw_figure_count += len(page_imgs)
            kept = 0
            for fig in page_imgs:
                width = float(fig.get("x1", 0)) - float(fig.get("x0", 0))
                height = float(fig.get("bottom", 0)) - float(fig.get("top", 0))
                if width < MIN_FIG_DIM or height < MIN_FIG_DIM:
                    continue
                try:
                    h = render_clip_sha1(page, fig)
                    figure_hashes.add(h)
                    kept += 1
                except Exception as e:  # noqa: BLE001
                    print(f"  ! page={page_num} image_render failed: {e}", file=sys.stderr)
            if kept:
                by_page[page_num] = kept

    elapsed = time.perf_counter() - t0

    print(f"Raw page.images count (pre-filter, pre-dedup): {raw_figure_count}")
    print(f"After MIN_FIG_DIM filter + SHA1 dedup:         {len(figure_hashes)}")
    print(f"Wall time:                                      {elapsed:.2f}s")

    print("\nPer-page distribution (top 10):")
    for page, count in sorted(by_page.items(), key=lambda x: -x[1])[:10]:
        print(f"  page {page:3d}: {count} figures")

    print("\n---")
    print(f"PDFPLUMBER FIGURES (dedup):  {len(figure_hashes)}")
    print(f"GROUND TRUTH (thesis):       ~59")
    print(f"RECALL: {len(figure_hashes) / 59 * 100:.1f}%")
    print()

    # Verdict signal — compares against the Spike 001/002 expected baseline
    if len(figure_hashes) >= 35:
        print("VERDICT SIGNAL: STRONG — pdfplumber.figures alone clears the YELLOW bar; could be a near-drop-in swap for pymupdf_full")
    elif len(figure_hashes) > 25:
        print("VERDICT SIGNAL: COMPLEMENT — modest standalone count but may union usefully with pymupdf_full and/or vector clustering")
    elif len(figure_hashes) < 5:
        print("VERDICT SIGNAL: WEAK — pdfplumber.figures is not picking up much; technique likely doesn't help on academic PDFs")
    else:
        print("VERDICT SIGNAL: NEUTRAL — needs union with Spike 001/002 to assess incremental value")

    return 0


if __name__ == "__main__":
    sys.exit(main())
