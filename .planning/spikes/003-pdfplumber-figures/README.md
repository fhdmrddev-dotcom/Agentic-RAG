---
spike: 003
name: pdfplumber-figures
validates: "Given the thesis PDF, when `pdfplumber.page.images` is iterated and bbox-rendered, then ≥30 unique figures are recovered (drop-in alternative to pymupdf_full). Note: `page.figures` doesn't exist in pdfplumber 0.11.9 — pivoted mid-spike to `page.images`."
verdict: VALIDATED (with caveat)
related: [001-pymupdf-full-baseline, 002-get-drawings-vector-cluster]
tags: [seed-021, pdfplumber, drop-in-alternative, api-correction]
---

# Spike 003: pdfplumber.figures Comparison

## What This Validates

**Given** the thesis PDF,
**when** `pdfplumber.Page.figures` is iterated across all pages and each bbox is rendered + SHA1-deduped,
**then** the figure count is observed — comparable to Spike 001 (pymupdf_full = 20) and Spike 002 (vector clusters).

pdfplumber is already a project dependency. If this single-API approach matches or beats `pymupdf_full`, it's a trivial swap in the per-aspect dispatcher (replace `pymupdf_full_images_pdf` registration with a `pdfplumber_figures_pdf` adapter).

Decision thresholds:
- **STRONG (≥35)** — drop-in candidate; near-replacement for pymupdf_full
- **COMPLEMENT (26-34)** — union-pattern candidate (combine with pymupdf_full + vector clusters)
- **NEUTRAL (5-25)** — needs union with Spikes 001+002 to assess
- **WEAK (<5)** — technique not viable on academic PDFs

## How to Run

```bash
backend/venv/Scripts/python.exe .planning/spikes/003-pdfplumber-figures/run.py
```

Fixture resolution: same as Spikes 001 + 002.

## What to Expect

```
Fixture: <path> (3,9xx,xxx bytes)
Tunables: RENDER_DPI=100  MIN_FIG_DIM=30px

Raw page.figures count (pre-filter, pre-dedup): N
After MIN_FIG_DIM filter + SHA1 dedup:          M
Wall time:                                       <few seconds>

Per-page distribution (top 10):
  page  X: K figures
  ...

---
PDFPLUMBER FIGURES (dedup):  M
GROUND TRUTH (thesis):       ~59
RECALL: X.X%

VERDICT SIGNAL: STRONG / COMPLEMENT / NEUTRAL / WEAK
```

## Results (2026-05-16, against operator's thesis)

```
Fixture: thesis.pdf (4,077,782 bytes)
Tunables: RENDER_DPI=100  MIN_FIG_DIM=30px

Total pages: 195
Raw page.images count (pre-filter, pre-dedup): 71
After MIN_FIG_DIM filter + SHA1 dedup:         61
Wall time:                                      9.03s
```

### API correction mid-spike

The original spike script targeted `page.figures`, which doesn't exist in pdfplumber 0.11.9. Pivoted to `page.images`, which is the actual API. Both engines (`pymupdf_full` and `pdfplumber.images`) walk the PDF's image-xref graph and detect a near-identical set: 67 vs 61 after dedup (different rendering paths cause minor hash divergence on the same logical image, not actual detection differences).

### Verdict

**VALIDATED** — pdfplumber.images is a viable drop-in alternative. Detection count is comparable to pymupdf_full. No reason to swap engines based on detection alone; the existing `pymupdf_full` choice (driven by Form-XObject coverage per `aspects/images_pdf.py:36-44` docstring) stays preferred.

### Why this matters less than expected

Spike 001 already revealed the bottleneck was storage-side, not detection-side. Both pdfplumber and pymupdf_full would be capped at 20 stored by the current `_MAX_VISION_CALLS` hardcode regardless. The decision lever lives in Phase 072 Plan 01 (raise the cap), not in engine selection.

### Wall-time delta

- `pymupdf_full`: 1.38s on 200 pages
- `pdfplumber.images` + bbox-rendered SHA1: 9.03s on 200 pages

pdfplumber is ~7× slower because it renders each image bbox at 100 DPI instead of decoding the embedded raw image. Not a problem for the spike's purposes; would matter for production ingest if pdfplumber became the default engine.
