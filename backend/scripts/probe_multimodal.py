"""Diagnostic: compare multimodal extractors side-by-side on a single document.

Counts how many tables and images each extractor *finds* — no vision calls,
no DB writes. Use this to decide whether to invest in Phase 062.

Usage:
    cd backend
    python scripts/probe_multimodal.py <document_id>
    python scripts/probe_multimodal.py --file /path/to/doc.pdf

Extractors compared:
    - pdfplumber   (current production path)
    - PyMuPDF      (fitz: get_images + get_drawings clustered)
    - Docling      (layout-aware; optional — install with `pip install docling`)
"""
from __future__ import annotations

import argparse
import io
import os
import sys
from dataclasses import dataclass, field

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


@dataclass
class ProbeResult:
    extractor: str
    available: bool
    tables: int = 0
    real_tables: int = 0  # excludes 1x1 noise rows
    images: int = 0
    vector_figures: int = 0  # PyMuPDF only — clustered vector drawings
    notes: list[str] = field(default_factory=list)
    error: str | None = None

    def summary(self) -> str:
        if not self.available:
            return f"  {self.extractor:12s}  [unavailable] {self.error or ''}"
        parts = [f"tables={self.tables}", f"real_tables={self.real_tables}", f"images={self.images}"]
        if self.vector_figures:
            parts.append(f"vector_figures={self.vector_figures}")
        return f"  {self.extractor:12s}  " + "  ".join(parts)


# ---------------------------------------------------------------------------
# Extractor 1: pdfplumber (current production path — mirrors multimodal_service)
# ---------------------------------------------------------------------------

def probe_pdfplumber(raw: bytes) -> ProbeResult:
    r = ProbeResult(extractor="pdfplumber", available=False)
    try:
        import pdfplumber
    except ImportError as e:
        r.error = f"not installed: {e}"
        return r
    r.available = True
    try:
        with pdfplumber.open(io.BytesIO(raw)) as pdf:
            for page in pdf.pages:
                # tables
                for tbl in page.extract_tables():
                    if not tbl or not tbl[0]:
                        continue
                    r.tables += 1
                    rows = tbl[1:]
                    cols = len(tbl[0])
                    if cols >= 2 and len(rows) >= 1:
                        r.real_tables += 1
                # images
                for img in page.images:
                    w = img.get("width", 0)
                    h = img.get("height", 0)
                    if w >= 50 and h >= 50:
                        r.images += 1
    except Exception as e:
        r.error = str(e)
    return r


# ---------------------------------------------------------------------------
# Extractor 2: PyMuPDF (fitz) — raster XObjects + clustered vector drawings
# ---------------------------------------------------------------------------

def _merge_bboxes(boxes: list[tuple[float, float, float, float]], gap: float = 12.0):
    """Cluster overlapping/adjacent bboxes into figure regions."""
    if not boxes:
        return []
    boxes = sorted(boxes, key=lambda b: (b[1], b[0]))
    merged: list[list[float]] = [list(boxes[0])]
    for x0, y0, x1, y1 in boxes[1:]:
        placed = False
        for m in merged:
            mx0, my0, mx1, my1 = m
            if not (x1 < mx0 - gap or x0 > mx1 + gap or y1 < my0 - gap or y0 > my1 + gap):
                m[0] = min(mx0, x0); m[1] = min(my0, y0)
                m[2] = max(mx1, x1); m[3] = max(my1, y1)
                placed = True
                break
        if not placed:
            merged.append([x0, y0, x1, y1])
    # Multi-pass: keep merging until stable (handles transitive overlaps)
    changed = True
    while changed:
        changed = False
        out: list[list[float]] = []
        for box in merged:
            absorbed = False
            for o in out:
                if not (box[2] < o[0] - gap or box[0] > o[2] + gap
                        or box[3] < o[1] - gap or box[1] > o[3] + gap):
                    o[0] = min(o[0], box[0]); o[1] = min(o[1], box[1])
                    o[2] = max(o[2], box[2]); o[3] = max(o[3], box[3])
                    absorbed = True
                    changed = True
                    break
            if not absorbed:
                out.append(box)
        merged = out
    return merged


def probe_pymupdf(raw: bytes) -> ProbeResult:
    r = ProbeResult(extractor="PyMuPDF", available=False)
    try:
        import fitz  # PyMuPDF
    except ImportError as e:
        r.error = f"not installed (`pip install pymupdf`): {e}"
        return r
    r.available = True
    try:
        doc = fitz.open(stream=raw, filetype="pdf")
        for page in doc:
            # Raster images (more thorough than pdfplumber's page.images)
            for img_info in page.get_images(full=True):
                xref = img_info[0]
                try:
                    base = doc.extract_image(xref)
                    if base.get("width", 0) >= 50 and base.get("height", 0) >= 50:
                        r.images += 1
                except Exception:
                    continue

            # Vector drawings clustered into figure regions
            try:
                drawings = page.get_drawings()
            except Exception:
                drawings = []
            bboxes: list[tuple[float, float, float, float]] = []
            for d in drawings:
                rect = d.get("rect")
                if rect is None:
                    continue
                try:
                    x0, y0, x1, y1 = float(rect.x0), float(rect.y0), float(rect.x1), float(rect.y1)
                except Exception:
                    continue
                w, h = x1 - x0, y1 - y0
                if w < 2 or h < 2:
                    continue  # skip degenerate strokes
                bboxes.append((x0, y0, x1, y1))
            figures = [b for b in _merge_bboxes(bboxes) if (b[2] - b[0]) >= 50 and (b[3] - b[1]) >= 50]
            r.vector_figures += len(figures)

            # Tables — use PyMuPDF's built-in table finder (1.23+)
            try:
                tabs = page.find_tables()
                for t in tabs:
                    r.tables += 1
                    nrows = len(t.rows) if hasattr(t, "rows") else 0
                    ncols = len(t.header.names) if hasattr(t, "header") and t.header else 0
                    if ncols >= 2 and nrows >= 1:
                        r.real_tables += 1
            except Exception as e:
                r.notes.append(f"find_tables not available: {e}")
        doc.close()
    except Exception as e:
        r.error = str(e)
    return r


# ---------------------------------------------------------------------------
# Extractor 3: Docling (layout-aware)
# ---------------------------------------------------------------------------

def probe_docling(raw: bytes, filename: str) -> ProbeResult:
    r = ProbeResult(extractor="Docling", available=False)
    try:
        from docling.document_converter import DocumentConverter
    except ImportError as e:
        r.error = f"not installed (`pip install docling`): {e}"
        return r
    r.available = True
    try:
        import tempfile
        with tempfile.NamedTemporaryFile(suffix=os.path.splitext(filename)[1] or ".pdf", delete=False) as tf:
            tf.write(raw)
            tmp_path = tf.name
        try:
            converter = DocumentConverter()
            result = converter.convert(tmp_path)
            doc = result.document
            r.tables = len(doc.tables)
            for t in doc.tables:
                try:
                    nrows = t.data.num_rows if hasattr(t, "data") else 0
                    ncols = t.data.num_cols if hasattr(t, "data") else 0
                    if ncols >= 2 and nrows >= 1:
                        r.real_tables += 1
                except Exception:
                    r.real_tables += 1  # count as real if metadata unavailable
            r.images = len(doc.pictures) if hasattr(doc, "pictures") else 0
        finally:
            try:
                os.unlink(tmp_path)
            except Exception:
                pass
    except Exception as e:
        r.error = str(e)
    return r


# ---------------------------------------------------------------------------
# Loader
# ---------------------------------------------------------------------------

def load_from_supabase(document_id: str) -> tuple[bytes, str, str]:
    from app.dependencies import get_supabase
    sb = get_supabase()
    doc_row = (
        sb.table("documents")
        .select("id, filename, mime_type, file_path")
        .eq("id", document_id)
        .single()
        .execute()
    )
    if not doc_row.data:
        raise SystemExit(f"Document {document_id} not found.")
    file_path = doc_row.data["file_path"]
    raw = sb.storage.from_("documents").download(file_path)
    return raw, doc_row.data["filename"], doc_row.data.get("mime_type", "")


def load_from_file(path: str) -> tuple[bytes, str, str]:
    with open(path, "rb") as f:
        raw = f.read()
    mime = "application/pdf" if path.lower().endswith(".pdf") else ""
    return raw, os.path.basename(path), mime


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main() -> None:
    ap = argparse.ArgumentParser(description="Probe multimodal extraction quality across libraries.")
    ap.add_argument("document_id", nargs="?", help="UUID of a document already in Supabase Storage.")
    ap.add_argument("--file", help="Local file path (use instead of document_id).")
    ap.add_argument("--with-docling", action="store_true",
                    help="Also run Docling (slow first run — downloads ~600MB of models).")
    args = ap.parse_args()

    # Force line-buffered stdout so progress prints arrive in real time
    try:
        sys.stdout.reconfigure(line_buffering=True)
    except Exception:
        pass

    if not args.document_id and not args.file:
        ap.error("Provide either <document_id> or --file <path>.")

    if args.file:
        print(f"[load] reading local file {args.file}", flush=True)
        raw, filename, mime = load_from_file(args.file)
    else:
        print(f"[load] downloading document {args.document_id} from Supabase Storage", flush=True)
        raw, filename, mime = load_from_supabase(args.document_id)

    print(f"\nDocument: {filename}  ({len(raw):,} bytes, mime={mime or 'unknown'})\n", flush=True)

    results: list[ProbeResult] = []
    print("[1/3] running pdfplumber...", flush=True)
    results.append(probe_pdfplumber(raw))
    print("      done.", flush=True)
    print("[2/3] running PyMuPDF...", flush=True)
    results.append(probe_pymupdf(raw))
    print("      done.", flush=True)
    if args.with_docling:
        print("[3/3] running Docling (first run downloads models — may take several minutes)...", flush=True)
        results.append(probe_docling(raw, filename))
        print("      done.", flush=True)
    else:
        print("[3/3] Docling skipped (pass --with-docling to include).", flush=True)
        skipped = ProbeResult(extractor="Docling", available=False)
        skipped.error = "skipped (use --with-docling to enable)"
        results.append(skipped)
    print(flush=True)

    print("Extraction comparison")
    print("=" * 70)
    for r in results:
        print(r.summary())
        if r.notes:
            for n in r.notes:
                print(f"      note: {n}")
    print()

    # Quick verdict
    pp = next(r for r in results if r.extractor == "pdfplumber")
    fz = next(r for r in results if r.extractor == "PyMuPDF")
    dl = next(r for r in results if r.extractor == "Docling")

    print("Verdict")
    print("-" * 70)
    if fz.available:
        delta_imgs = (fz.images + fz.vector_figures) - pp.images
        delta_tables = fz.real_tables - pp.real_tables
        print(f"  PyMuPDF vs pdfplumber:  +{delta_imgs} images/figures,  "
              f"{'+' if delta_tables >= 0 else ''}{delta_tables} real tables")
    if dl.available:
        delta_imgs = dl.images - pp.images
        delta_tables = dl.real_tables - pp.real_tables
        print(f"  Docling vs pdfplumber:  +{delta_imgs} images,  "
              f"{'+' if delta_tables >= 0 else ''}{delta_tables} real tables")
    if not (fz.available or dl.available):
        print("  Install pymupdf and/or docling to see comparison numbers.")
    print()


if __name__ == "__main__":
    main()
