"""Spike 002 — page.get_drawings() vector primitives + bbox clustering.

The headline experiment of the SEED-021 image-recall-union spike series.

Question: can we recover figures that pymupdf_full misses (vector charts,
flowcharts, diagrams) by clustering PyMuPDF's vector path primitives into
synthetic "figure" records?

Approach:
  1. For each page, walk `page.get_drawings()` → list of {rect, items, ...}
  2. Filter primitives by bbox area (drop tiny paths < 1000px² — text decorations)
  3. Union-find clustering by bbox overlap (simple: merge bboxes that overlap
     or sit within `eps_pad` of each other)
  4. For each cluster, render the bounding region via page.get_pixmap(clip=bbox)
  5. SHA1-dedup the rendered PNGs to suppress repeated headers / page numbers /
     decorative elements that appear on every page

Run from repo root (no extra deps beyond PyMuPDF + Pillow which the backend
venv already has):

    backend/venv/Scripts/python.exe .planning/spikes/002-get-drawings-vector-cluster/run.py

Output: vector-only cluster count + union-with-pymupdf_full count + per-page
breakdown + wall time + RAM peak.
"""
from __future__ import annotations

import base64
import hashlib
import io
import sys
import time
from dataclasses import dataclass
from pathlib import Path

import fitz  # PyMuPDF — AGPL in-process per D-PRD-07
from PIL import Image as PILImage

REPO_ROOT = Path(__file__).resolve().parents[3]
THESIS_PRIMARY = REPO_ROOT / ".planning" / "spikes" / "_fixtures" / "thesis.pdf"
THESIS_FALLBACK = REPO_ROOT / "backend" / "tests" / "fixtures" / "extraction" / "friendly_real.pdf"

# Tunables (throwaway — picked from rough heuristics, NOT load-bearing for the project)
MIN_BBOX_AREA = 1000.0          # px² — drop tiny path primitives (text decorations, page-number underlines)
CLUSTER_EPS_PAD = 8.0           # px — bboxes within this distance merge into one cluster
MIN_CLUSTER_DIM = 30.0          # px — a cluster narrower or shorter than this isn't a "figure"
RENDER_DPI = 100                # rasterize clip at this DPI — keeps memory bounded


def resolve_fixture() -> Path:
    if THESIS_PRIMARY.exists():
        return THESIS_PRIMARY
    print(
        f"⚠ Thesis not found at {THESIS_PRIMARY} — falling back to {THESIS_FALLBACK.name} "
        "(small arXiv paper — signal will be weaker than the operator's 59-figure thesis).",
        file=sys.stderr,
    )
    return THESIS_FALLBACK


@dataclass
class BBox:
    x0: float
    y0: float
    x1: float
    y1: float

    @property
    def area(self) -> float:
        return max(0.0, self.x1 - self.x0) * max(0.0, self.y1 - self.y0)

    @property
    def width(self) -> float:
        return self.x1 - self.x0

    @property
    def height(self) -> float:
        return self.y1 - self.y0

    def overlaps_or_near(self, other: "BBox", eps: float) -> bool:
        # Inflate self by eps on all sides, then check overlap.
        return not (
            other.x1 < self.x0 - eps
            or other.x0 > self.x1 + eps
            or other.y1 < self.y0 - eps
            or other.y0 > self.y1 + eps
        )

    def union(self, other: "BBox") -> "BBox":
        return BBox(
            x0=min(self.x0, other.x0),
            y0=min(self.y0, other.y0),
            x1=max(self.x1, other.x1),
            y1=max(self.y1, other.y1),
        )


def collect_drawing_bboxes(page) -> list[BBox]:
    """Walk page.get_drawings() and return per-primitive bboxes that pass the
    area filter. Each drawing dict has a "rect" key (a fitz.Rect)."""
    out: list[BBox] = []
    for drawing in page.get_drawings():
        rect = drawing.get("rect")
        if rect is None:
            continue
        bb = BBox(x0=float(rect.x0), y0=float(rect.y0), x1=float(rect.x1), y1=float(rect.y1))
        if bb.area < MIN_BBOX_AREA:
            continue
        out.append(bb)
    return out


def cluster_bboxes(boxes: list[BBox], eps: float) -> list[BBox]:
    """Greedy union-find clustering: merge any two bboxes that overlap or sit
    within `eps` of each other. O(n²) — fine for a spike (n < few hundred per
    page in practice)."""
    if not boxes:
        return []
    parent = list(range(len(boxes)))

    def find(i: int) -> int:
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    def union(i: int, j: int) -> None:
        ri, rj = find(i), find(j)
        if ri != rj:
            parent[ri] = rj

    for i in range(len(boxes)):
        for j in range(i + 1, len(boxes)):
            if boxes[i].overlaps_or_near(boxes[j], eps):
                union(i, j)

    # Collect clusters → unioned bboxes
    cluster_map: dict[int, BBox] = {}
    for i, bb in enumerate(boxes):
        root = find(i)
        if root in cluster_map:
            cluster_map[root] = cluster_map[root].union(bb)
        else:
            cluster_map[root] = bb
    return list(cluster_map.values())


def render_clip_sha1(page, bbox: BBox, dpi: int) -> str:
    """Render the page region inside bbox at `dpi`, PNG-encode, return SHA1.

    Uses PyMuPDF's matrix scaling: 72 DPI is the PDF baseline; we scale by
    dpi/72 to get the requested density.
    """
    zoom = dpi / 72.0
    mat = fitz.Matrix(zoom, zoom)
    clip = fitz.Rect(bbox.x0, bbox.y0, bbox.x1, bbox.y1)
    pix = page.get_pixmap(matrix=mat, clip=clip, alpha=False)
    # Pillow round-trip → bytes consistent with the project's hash convention
    img = PILImage.frombytes("RGB", (pix.width, pix.height), pix.samples)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return hashlib.sha1(buf.getvalue()).hexdigest()[:16]


def extract_via_get_images(doc) -> set[str]:
    """Reproduce pymupdf_full hash set (Spike 001's anchor) so we can compute
    the UNION of vector-cluster figures + raster figures."""
    raster_hashes: set[str] = set()
    for page in doc:
        for (xref, *_) in page.get_images(full=True):
            try:
                info = doc.extract_image(xref)
                raw_img = info["image"]
                img = PILImage.open(io.BytesIO(raw_img)).convert("RGB")
                buf = io.BytesIO()
                img.save(buf, format="PNG")
                raster_hashes.add(hashlib.sha1(buf.getvalue()).hexdigest()[:16])
            except Exception:
                continue
    return raster_hashes


def main() -> int:
    fixture = resolve_fixture()
    if not fixture.exists():
        print(f"FAIL: no fixture available at {fixture}", file=sys.stderr)
        return 2

    raw = fixture.read_bytes()
    print(f"Fixture: {fixture} ({len(raw):,} bytes)")
    print(f"Tunables: MIN_BBOX_AREA={MIN_BBOX_AREA}px²  CLUSTER_EPS_PAD={CLUSTER_EPS_PAD}px  "
          f"MIN_CLUSTER_DIM={MIN_CLUSTER_DIM}px  RENDER_DPI={RENDER_DPI}")
    print()

    t0 = time.perf_counter()
    doc = fitz.Document(stream=raw, filetype="pdf")

    # Raster anchor (Spike 001's set)
    raster_hashes = extract_via_get_images(doc)

    # Vector clustering pass
    vector_cluster_hashes: set[str] = set()
    by_page_clusters: dict[int, int] = {}
    total_primitives = 0
    try:
        for page_num, page in enumerate(doc, start=1):
            primitives = collect_drawing_bboxes(page)
            total_primitives += len(primitives)
            clusters = cluster_bboxes(primitives, eps=CLUSTER_EPS_PAD)
            kept = 0
            for cluster_bb in clusters:
                if cluster_bb.width < MIN_CLUSTER_DIM or cluster_bb.height < MIN_CLUSTER_DIM:
                    continue
                try:
                    h = render_clip_sha1(page, cluster_bb, dpi=RENDER_DPI)
                    vector_cluster_hashes.add(h)
                    kept += 1
                except Exception as e:  # noqa: BLE001
                    print(f"  ! page={page_num} cluster_render failed: {e}", file=sys.stderr)
            if kept:
                by_page_clusters[page_num] = kept
    finally:
        doc.close()

    elapsed = time.perf_counter() - t0

    # Union: figures from raster anchor + figures from vector clustering
    union_hashes = raster_hashes | vector_cluster_hashes

    n_raster = len(raster_hashes)
    n_vector = len(vector_cluster_hashes)
    n_union = len(union_hashes)
    overlap = len(raster_hashes & vector_cluster_hashes)
    novel_from_vector = n_vector - overlap

    print(f"Raster anchor (pymupdf_full):           {n_raster}")
    print(f"Vector clusters (filtered + dedup):     {n_vector}")
    print(f"Overlap (hashed-identical PNGs):        {overlap}  [likely 0 — rasterized clips rarely match decoded raw images byte-for-byte]")
    print(f"Novel figures from vector clustering:   {novel_from_vector}")
    print(f"UNION TOTAL:                            {n_union}")
    print(f"Total vector primitives walked:         {total_primitives}")
    print(f"Wall time:                              {elapsed:.2f}s")

    print("\nPer-page vector cluster distribution (top 10):")
    for page, count in sorted(by_page_clusters.items(), key=lambda x: -x[1])[:10]:
        print(f"  page {page:3d}: {count} vector clusters")

    print("\n---")
    print(f"BASELINE (pymupdf_full alone): {n_raster}")
    print(f"VECTOR ALONE: {n_vector}")
    print(f"UNION TOTAL: {n_union}")
    print(f"GROUND TRUTH (thesis estimate): ~59")
    print(f"RECALL @ union: {n_union / 59 * 100:.1f}%")
    print()

    # Verdict heuristic
    if n_union >= 47:
        print("VERDICT SIGNAL: GREEN — union exceeds 80% recall target without any LLM cost")
    elif n_union >= 35:
        print("VERDICT SIGNAL: YELLOW — meaningful lift (≥35 figures) but short of 80%; consider Spike 003 or 004 next")
    elif n_union > n_raster + 3:
        print("VERDICT SIGNAL: WEAK YELLOW — some lift but small (delta < 15); Spike 003+004 likely needed")
    else:
        print("VERDICT SIGNAL: RED — vector clustering produced no meaningful lift; technique is not the answer on this fixture")

    return 0


if __name__ == "__main__":
    sys.exit(main())
