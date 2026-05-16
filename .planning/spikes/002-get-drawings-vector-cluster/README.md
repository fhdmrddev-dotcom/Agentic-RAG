---
spike: 002
name: get-drawings-vector-cluster
validates: "Given the thesis PDF, when `page.get_drawings()` vector primitives are bbox-clustered and rendered, then ≥15 additional figures beyond pymupdf_full are recovered (target: union 20 → 35+)"
verdict: INVALIDATED — but harmless (thesis is raster-only, premise didn't apply)
related: [001-pymupdf-full-baseline, 003-pdfplumber-figures]
tags: [seed-021, pymupdf, vector-clustering, headline, pattern-A, thesis-is-raster-heavy]
---

# Spike 002: get_drawings() Vector Clustering (HEADLINE)

## What This Validates

**Given** the thesis PDF (~3.9MB, ~59 visible figures),
**when** `page.get_drawings()` vector primitives are filtered by bbox area, clustered by spatial overlap, rendered to PNGs, and SHA1-deduped,
**then** the UNION with `pymupdf_full`'s raster set recovers ≥35 unique figures total (a meaningful lift over the 20-figure baseline).

This is the **headline experiment** for the SEED-021 spike. If union ≥35, Pattern A (`pymupdf_full` + vector clustering) is viable at $0 cost and proceeds toward a v3.x phase. If union plateaus near 20, the technique doesn't help on this corpus.

Decision thresholds (encoded in `run.py` verdict signal):
- **GREEN** — union ≥ 47 (≥80% recall): closes the entire SEED-021 question without any LLM cost
- **YELLOW** — union 35-46: meaningful lift; consider Spike 003 (pdfplumber) or 004 (Marker) for additional gain
- **RED** — union < 35: vector clustering isn't the answer; fall through to Spike 003/004

## How to Run

```bash
backend/venv/Scripts/python.exe .planning/spikes/002-get-drawings-vector-cluster/run.py
```

Fixture resolution: same as Spike 001 (`_fixtures/thesis.pdf` preferred, friendly_real.pdf fallback with warning).

## What to Expect

Console output:

```
Fixture: <path> (3,9xx,xxx bytes)
Tunables: MIN_BBOX_AREA=1000.0px²  CLUSTER_EPS_PAD=8.0px  MIN_CLUSTER_DIM=30.0px  RENDER_DPI=100

Raster anchor (pymupdf_full):           20
Vector clusters (filtered + dedup):     N
Overlap (hashed-identical PNGs):        0  [rasterized clips rarely match decoded raw images]
Novel figures from vector clustering:   N
UNION TOTAL:                            M
Total vector primitives walked:         <few hundred>
Wall time:                              <2-10s>

Per-page vector cluster distribution (top 10):
  page  X: K vector clusters
  ...

---
BASELINE (pymupdf_full alone): 20
VECTOR ALONE: N
UNION TOTAL: M
GROUND TRUTH (thesis estimate): ~59
RECALL @ union: X.X%

VERDICT SIGNAL: GREEN / YELLOW / WEAK YELLOW / RED
```

## Tunables (intentional cheap heuristics — not load-bearing)

These four constants live at the top of `run.py`. Adjust if results are oddly high (lots of false positives) or oddly low (technique missing obvious figures):

| Constant | Default | Effect |
|---|---|---|
| `MIN_BBOX_AREA` | 1000 px² | Drops tiny primitives (text decorations, page-number rules). Raise to suppress more false positives. |
| `CLUSTER_EPS_PAD` | 8 px | How close two bboxes must be to merge into one cluster. Lower → more fragmentation; higher → over-merging. |
| `MIN_CLUSTER_DIM` | 30 px | Minimum width/height for a cluster to count as a figure. Filters page-spanning thin lines. |
| `RENDER_DPI` | 100 | Resolution of rendered clip. Higher → larger files, more memory; lower → blurry. |

## Results (2026-05-16, against operator's thesis)

```
Fixture: thesis.pdf (4,077,782 bytes)
Tunables: MIN_BBOX_AREA=1000.0px²  CLUSTER_EPS_PAD=8.0px  MIN_CLUSTER_DIM=30.0px  RENDER_DPI=100

Raster anchor (pymupdf_full):           67
Vector clusters (filtered + dedup):     2
Overlap (hashed-identical PNGs):        0
Novel figures from vector clustering:   2
UNION TOTAL:                            69
Total vector primitives walked:         68
Wall time:                              1.48s

Per-page vector cluster distribution:
  page 178: 1 vector clusters
  page 179: 1 vector clusters
```

### Verdict

**INVALIDATED** as a recall-lift technique on this thesis. The hypothesis was that vector primitives (charts, flowcharts, diagrams rendered as paths) would account for the missing figures. But the thesis only contains **68 vector primitives across the entire 200-page document** — almost no vector content. The 2 cluster figures it produced were minor.

But this is a **harmless invalidation** — the technique might still help on a vector-heavy doc (architecture diagrams, technical specifications, system schematics). It just didn't help on a thesis that's primarily prose + raster figures.

### Why the headline target didn't apply

Spike 001 revealed that the real gap on the thesis was **storage-side** (`_MAX_VISION_CALLS=20` cap), not **extraction-side**. With `pymupdf_full` already finding 67 figures, there was no 20→35+ gap to close.

### Reusability

The clustering helper in `run.py` is throwaway-quality, but the union-find + bbox merge pattern would slot cleanly into a future per-aspect engine if/when vector-heavy documents become a target. Not load-bearing for any current decision.
