"""Phase 071.3 Plan 01 — Table-engine bench (D-071.3-01..03, D-071.3-08, D-071.3-17).

Compares pymupdf / gmft / camelot on the user's thesis (35-table GT) and
`backend/tests/fixtures/extraction/friendly_real.pdf` (arXiv 2605.15184v1).
Writes a markdown matrix to `.planning/research/071.3-bench-results.md`; the
human then writes `WINNER.md` (Task 4) naming the winner.

Recall metric (D-071.3-17): bbox-area >= 25 px^2 counts; recall = engine_count / 35.
Structural fidelity is recorded but does NOT gate winner selection.

Usage:
    cd backend
    venv\\Scripts\\python.exe scripts/bench_table_engines.py --thesis "C:\\path\\to\\thesis.pdf"
    venv\\Scripts\\python.exe scripts/bench_table_engines.py            # friendly only
    venv\\Scripts\\python.exe scripts/bench_table_engines.py --engines pymupdf,camelot

Heavy deps (fitz/gmft/camelot) lazy-import inside each adapter (Pattern SP-4).
gmft first call downloads ~120 MB TATR weights (+15-30s cold start). Bench-only
deps in `bench_requirements.txt`; production `requirements.txt` is untouched.
"""
from __future__ import annotations
import argparse
import gc
import os
import statistics
import sys
import time
import traceback
from contextlib import contextmanager
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path

import psutil  # bench-only; every adapter uses it for peak-RSS readout

FIXTURES_DIR = Path(__file__).parent.parent / "tests" / "fixtures" / "extraction"
FRIENDLY_PDF = FIXTURES_DIR / "friendly_real.pdf"
THESIS_GROUND_TRUTH_TABLES = 35
THESIS_GROUND_TRUTH_FIGURES = 59
BBOX_AREA_THRESHOLD_PX2 = 25.0  # D-071.3-17
RUNS_PER_ENGINE = 3
DEFAULT_OUTPUT = Path(__file__).parent.parent.parent / ".planning" / "research" / "071.3-bench-results.md"
ALL_ENGINES = ("pymupdf", "gmft", "camelot")


@contextmanager
def _redirect_stdout_to_stderr():
    """Verbatim from backend/extractors/pymupdf_isolated.py:22-44.
    PyMuPDF 1.27's `find_tables()` prints a marketing nudge to stdout via
    Python `print()`; swap sys.stdout to sys.stderr to keep stdout clean."""
    saved = sys.stdout
    try:
        sys.stdout = sys.stderr
        yield
    finally:
        try:
            sys.stderr.flush()
        except Exception:
            pass
        sys.stdout = saved


def _count_detections_above_threshold(detections, threshold_px2: float) -> int:
    """Filter detections by bbox area (D-071.3-17). Bbox-less detections count.
    Accepts fitz.Rect, (x0,y0,x1,y1) tuple/list, or dict with 'bbox' key."""
    count = 0
    for d in detections:
        bbox = getattr(d, "bbox", None) or getattr(d, "_bbox", None)
        if bbox is None and isinstance(d, dict):
            bbox = d.get("bbox")
        area = 0.0
        try:
            if hasattr(bbox, "x0") and hasattr(bbox, "x1"):
                area = abs(float(bbox.x1) - float(bbox.x0)) * abs(float(bbox.y1) - float(bbox.y0))
            elif isinstance(bbox, (tuple, list)) and len(bbox) >= 4:
                area = abs(float(bbox[2]) - float(bbox[0])) * abs(float(bbox[3]) - float(bbox[1]))
        except Exception:
            area = 0.0
        if bbox is None or area >= threshold_px2:
            count += 1
    return count


@dataclass
class EngineResult:
    engine: str
    fixture: str
    table_count: int = 0
    runs_wall_s: list[float] = field(default_factory=list)
    peak_rss_mb: float = 0.0
    status: str = "success"  # success | failed
    error: str | None = None
    notes: str = ""

    @property
    def median_wall_s(self) -> float:
        return statistics.median(self.runs_wall_s) if self.runs_wall_s else 0.0

    @property
    def wall_range_s(self) -> tuple[float, float]:
        return (min(self.runs_wall_s), max(self.runs_wall_s)) if self.runs_wall_s else (0.0, 0.0)


def _pymupdf_count_strategy(page, strategy: str) -> int:
    try:
        with _redirect_stdout_to_stderr():
            tabs = page.find_tables(strategy=strategy)
        return _count_detections_above_threshold(list(tabs.tables or []), BBOX_AREA_THRESHOLD_PX2)
    except Exception:
        return 0


def run_pymupdf(raw: bytes) -> tuple[int, str]:
    """fitz.find_tables — tries lines_strict + text, returns max count.
    AGPL in-process OK per D-PRD-07 + D-071.3-11 (dev script, not prod import)."""
    import fitz  # noqa: PLC0415
    doc = fitz.Document(stream=raw, filetype="pdf")
    try:
        total_ls = sum(_pymupdf_count_strategy(p, "lines_strict") for p in doc)
        total_text = sum(_pymupdf_count_strategy(p, "text") for p in doc)
        best = max(total_ls, total_text)
        chose = "lines_strict" if total_ls >= total_text else "text"
        return best, f"lines_strict={total_ls} text={total_text} chose={chose}"
    finally:
        doc.close()


def _with_tempfile(raw: bytes, fn):
    import tempfile  # noqa: PLC0415
    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tf:
        tf.write(raw)
        tmp_path = tf.name
    try:
        return fn(tmp_path)
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass


def run_gmft(raw: bytes) -> tuple[int, str]:
    """gmft AutoTableDetector (Microsoft TATR via pypdfium2)."""
    from gmft.auto import AutoTableDetector  # noqa: PLC0415
    from gmft.pdf_bindings.pdfium import PyPDFium2Document  # noqa: PLC0415
    def _inner(p: str):
        det = AutoTableDetector()
        doc = PyPDFium2Document(p)
        try:
            cropped: list = []
            for page in doc:
                cropped.extend(det.extract(page))
            n = _count_detections_above_threshold(cropped, BBOX_AREA_THRESHOLD_PX2)
            return n, f"AutoTableDetector raw_n={len(cropped)} bbox_filtered={n}"
        finally:
            doc.close()
    return _with_tempfile(raw, _inner)


def run_camelot(raw: bytes) -> tuple[int, str]:
    """Camelot 1.0 flavor=stream pages=all (best for borderless academic per
    research brief sec 2.3 + arXiv 2410.09871)."""
    import camelot  # noqa: PLC0415
    def _inner(p: str):
        tables = camelot.read_pdf(p, flavor="stream", pages="all")
        n = _count_detections_above_threshold(list(tables), BBOX_AREA_THRESHOLD_PX2)
        return n, f"flavor=stream pages=all raw_n={len(tables)} bbox_filtered={n}"
    return _with_tempfile(raw, _inner)


ENGINE_FNS = {"pymupdf": run_pymupdf, "gmft": run_gmft, "camelot": run_camelot}


def bench_one_engine(engine_fn, raw: bytes, engine_name: str, fixture_name: str) -> EngineResult:
    """Run engine_fn RUNS_PER_ENGINE times; record median wall + peak RSS.
    First-run crash sets status='failed' and skips remaining runs."""
    res = EngineResult(engine=engine_name, fixture=fixture_name)
    proc = psutil.Process(os.getpid())
    peak = proc.memory_info().rss
    counts: list[int] = []
    notes: list[str] = []
    for attempt in range(RUNS_PER_ENGINE):
        gc.collect()
        t0 = time.perf_counter()
        try:
            count, note = engine_fn(raw)
        except Exception as exc:
            if attempt == 0:
                tb = traceback.format_exc(limit=3).splitlines()[-1]
                res.status = "failed"
                res.error = f"{type(exc).__name__}: {exc}"
                res.notes = f"first-run crash; skipped remaining. tb={tb}"
                return res
            notes.append(f"run{attempt + 1}_failed:{type(exc).__name__}")
            continue
        res.runs_wall_s.append(time.perf_counter() - t0)
        counts.append(count)
        notes.append(note)
        peak = max(peak, proc.memory_info().rss)
    res.peak_rss_mb = round(peak / (1024 * 1024), 1)
    if counts:
        res.table_count = counts[0] if len(set(counts)) == 1 else int(statistics.median(counts))
        if len(set(counts)) > 1:
            notes.append(f"count_variance={min(counts)}..{max(counts)}")
    res.notes = "; ".join(notes[:3])
    return res


def _log(msg: str) -> None:
    print(f"[bench] {msg}", file=sys.stderr)


def bench_all(thesis_path: Path | None, friendly_path: Path, engines: tuple[str, ...]) -> list[EngineResult]:
    results: list[EngineResult] = []
    fixtures: list[tuple[str, Path]] = [("thesis", thesis_path)] if thesis_path else []
    fixtures.append(("friendly_real", friendly_path))
    for fix_name, fix_path in fixtures:
        if not fix_path.exists():
            _log(f"SKIP fixture={fix_name} path={fix_path} (not found)")
            continue
        raw = fix_path.read_bytes()
        _log(f"=== fixture={fix_name} size={len(raw):,} bytes ===")
        for eng in engines:
            fn = ENGINE_FNS.get(eng)
            if fn is None:
                _log(f"unknown engine: {eng}")
                continue
            _log(f"running engine={eng} on {fix_name} ({RUNS_PER_ENGINE}x)...")
            res = bench_one_engine(fn, raw, eng, fix_name)
            tag = res.status if res.status == "success" else f"FAIL({res.error})"
            _log(f"  -> tables={res.table_count} median_wall={res.median_wall_s:.2f}s "
                 f"peak_rss={res.peak_rss_mb}MB status={tag}")
            results.append(res)
    return results


def _recall_pct(count: int, gt: int) -> str:
    return f"{(count / gt) * 100:.0f}%" if gt > 0 else "N/A"


def _row(r: EngineResult) -> str:
    gt = THESIS_GROUND_TRUTH_TABLES if r.fixture == "thesis" else 0
    recall = _recall_pct(r.table_count, gt) if r.fixture == "thesis" else "N/A"
    wall_range = f"{r.wall_range_s[0]:.2f}-{r.wall_range_s[1]:.2f}" if r.runs_wall_s else "—"
    status = r.status if r.status == "success" else f"failed: {r.error}"
    notes = (r.notes or "").replace("|", "/").replace("\n", " ")
    return (f"| {r.engine} | {r.fixture} | {r.table_count} | {recall} | "
            f"{r.median_wall_s:.2f} | {wall_range} | {r.peak_rss_mb} | {status} | {notes} |")


_REPORT_TEMPLATE = """\
# Phase 071.3 — Table Engine Bench Results

**Run date:** {run_date}
**Bench script:** `backend/scripts/bench_table_engines.py`
**Fixtures:**
{fixture_1}
2. `backend/tests/fixtures/extraction/friendly_real.pdf` (arXiv 2605.15184v1, CC-BY 4.0)

**Recall metric (D-071.3-17):** bbox-area >= {bbox_threshold:.0f} px^2 counts. Recall = engine_count / {gt_tables} on thesis.
**Runs per engine per fixture:** {runs} (median + range reported).

## Results Matrix

| Engine | Fixture | Tables Found | Recall vs GT | Median Wall (s) | Wall Range (s) | Peak RSS (MB) | Status | Notes |
|---|---|---|---|---|---|---|---|---|
{rows}

## Per-Engine Notes

- **Acceptance floor (D-071.3-02):** >= 20 tables on thesis (~57% recall, 5x pdfplumber).
- **Install footprint (approximate):**
  - `pymupdf`: ~25 MB (already shipped in production)
  - `gmft`: ~700 MB (torch CPU + transformers + pypdfium2; ~120 MB TATR weights lazy first call)
  - `camelot-py[base]`: ~80 MB (opencv-headless, pdfminer.six, pdfium)

{install_block}## Winner

*To be filled by user after review. Update `WINNER.md` in the phase directory with the chosen engine.*
"""


def write_results(results: list[EngineResult], output_path: Path, thesis_supplied: bool, install_notes: str = "") -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    fixture_1 = (
        f"1. User thesis PDF (ground truth: {THESIS_GROUND_TRUTH_TABLES} tables, "
        f"{THESIS_GROUND_TRUTH_FIGURES} figures — illustrative dev content)"
        if thesis_supplied else
        "1. *(User thesis PDF not supplied — re-run with `--thesis <abs-path>` to populate.)*"
    )
    body = _REPORT_TEMPLATE.format(
        run_date=datetime.now().isoformat(timespec="seconds"),
        fixture_1=fixture_1,
        bbox_threshold=BBOX_AREA_THRESHOLD_PX2,
        gt_tables=THESIS_GROUND_TRUTH_TABLES,
        runs=RUNS_PER_ENGINE,
        rows="\n".join(_row(r) for r in results),
        install_block=f"## Install Notes\n\n{install_notes}\n\n" if install_notes else "",
    )
    output_path.write_text(body, encoding="utf-8")


def main() -> None:
    ap = argparse.ArgumentParser(
        description="Bench 3 table engines (pymupdf, gmft, camelot) on 2 PDF fixtures. "
                    "Writes a markdown matrix to .planning/research/071.3-bench-results.md.",
    )
    ap.add_argument("--thesis", help="Absolute path to user thesis PDF (NOT committed). Omit to bench friendly only.", default=None)
    ap.add_argument("--output", help=f"Markdown output path (default: {DEFAULT_OUTPUT.as_posix()})", default=str(DEFAULT_OUTPUT))
    ap.add_argument("--engines", help=f"Comma-list filter. Choices: {','.join(ALL_ENGINES)}", default=",".join(ALL_ENGINES))
    args = ap.parse_args()
    engines = tuple(e.strip() for e in args.engines.split(",") if e.strip())
    unknown = [e for e in engines if e not in ALL_ENGINES]
    if unknown:
        ap.error(f"unknown engines: {unknown}. choose from {ALL_ENGINES}")
    thesis_path = Path(args.thesis).resolve() if args.thesis else None
    if thesis_path is not None and not thesis_path.exists():
        ap.error(f"--thesis path does not exist: {thesis_path}")
    output_path = Path(args.output).resolve()
    results = bench_all(thesis_path, FRIENDLY_PDF, engines)
    write_results(results, output_path, thesis_supplied=thesis_path is not None)
    _log(f"wrote {len(results)} result rows to {output_path}")
    _log("done.")


if __name__ == "__main__":
    main()
