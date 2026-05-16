---
spike: 001
name: pymupdf-full-baseline
validates: "Given the operator's thesis PDF, when run through the project's `pymupdf_full` adapter logic, then ~20 unique figures are extracted (anchor for all subsequent recall deltas)"
verdict: SURPRISE — VALIDATED-PLUS
related: [002-get-drawings-vector-cluster, 003-pdfplumber-figures]
tags: [seed-021, baseline, pymupdf, anchor, storage-cap-finding]
---

# Spike 001: pymupdf_full Baseline

## What This Validates

**Given** the operator's thesis PDF (~3.9MB, ~59 visible figures ground-truth),
**when** the existing project adapter `pymupdf_full_images_pdf` (replicated inline in `run.py`) is invoked,
**then** ~20 unique figures (post-SHA1-dedup) are extracted in <1s wall time — anchoring deltas for Spikes 002–004.

The Phase 071.4 verification measured this baseline at 20/59 = 34% recall. This spike re-confirms the number from a clean reproducer.

## How to Run

```bash
# From repo root (PowerShell or bash):
backend/venv/Scripts/python.exe .planning/spikes/001-pymupdf-full-baseline/run.py
```

**Fixture resolution order:**
1. `.planning/spikes/_fixtures/thesis.pdf` (operator's actual thesis — gitignored)
2. `backend/tests/fixtures/extraction/friendly_real.pdf` (small arXiv fallback — warns when used)

## What to Expect

Console output should match this shape:

```
Fixture: <path> (3,917,xxx bytes)
Raw figure count (pre-dedup):  ~20-22
Unique figures (SHA1 dedup):   20
Wall time:                      0.5-1.5s

Per-page distribution (top 10 pages):
  page  X: N images
  ...

---
BASELINE = 20 unique figures (post-SHA1 dedup)
GROUND TRUTH (thesis estimate): ~59 visible figures
RECALL: 33.9%
GAP TO 80%: need ~27 more figures
```

If unique count ≠ ~20 (±3), it's a signal that either:
- The fixture is wrong (e.g., friendly_real.pdf fallback fired — note the warning line)
- Phase 071.4 invariants have drifted in code

## Results (2026-05-16, against operator's thesis)

**HEADLINE FINDING: extraction ceiling is 67 figures, NOT 20. The "20 stored" baseline from Phase 071.4 verification was a STORAGE-LAYER ARTIFACT, not an extraction problem.**

```
Fixture: thesis.pdf (4,077,782 bytes)
Raw figure count (pre-dedup):  69
Unique figures (SHA1 dedup):   67
Wall time:                      1.38s

Per-page distribution (top 10 pages):
  page 179: 8 images
  page  94: 2 images
  page  96: 2 images
  page  98: 2 images
  page 101: 2 images
  page  26: 1 images
  ...

BASELINE = 67 unique figures (post-SHA1 dedup)
GROUND TRUTH (thesis estimate): ~59 visible figures
RECALL: 113.6%
```

### Why this matters

The Phase 071.4 verification stored 20 figures and recorded "34% recall." That number was the result of the hardcoded `_MAX_VISION_CALLS=20` cap in `backend/app/services/multimodal_service.py` — **not** a limitation of `pymupdf_full`'s detection. The extractor was finding 67 figures all along; the storage layer only ran `describe_image()` on the first 20 and dropped the rest.

D-072-08 (Plan 01) raises this cap to 100 via `app_settings.multimodal_max_vision_calls` — which now appears to be the **sole load-bearing change** for closing the recall gap, not the entire `vision_sweep` engine that was deferred.

### Friendly-real-fallback dry-run (smoke test before the thesis arrived)

1 unique figure on the 9-page arXiv paper (`friendly_real.pdf`). Confirmed the spike script runs end-to-end. Superseded by the real measurement above.

### Implications for downstream spikes

- **Spike 002** target ("vector clustering adds ≥15 figures") is moot — there are only 68 vector primitives across the entire 200-page thesis, almost no vector content to cluster.
- **Spike 003** target ("pdfplumber ≥30 figures") meaningless — both engines walk the same xref graph; convergence expected.
- **Spike 004** (Marker) — **SKIPPED**. The conditional gate ("if 002+003 union < 40") doesn't trigger because we're at 69 union from `pymupdf_full` alone.
- **Spike 005** (retrieval-value smoke) — **becomes the only remaining question**: does raising the cap from 20 → 100 (so 67 figures get stored + described) actually improve answers on figure-grounded queries against the live pipeline?
