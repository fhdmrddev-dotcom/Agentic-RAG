---
spike: 004
name: marker-cpu-smoke
validates: "Given the thesis PDF, when Marker runs CPU-only in an isolated venv, then figure-output count + wall time are observed (only runs if 002+003 union <40)"
verdict: SKIPPED — conditional gate not triggered
related: [001-pymupdf-full-baseline, 002-get-drawings-vector-cluster, 003-pdfplumber-figures]
tags: [seed-021, marker, gpl, isolated-venv, skipped]
---

# Spike 004: Marker CPU Smoke — SKIPPED

## Why skipped

The conditional gate on this spike was: **"only runs if Spikes 002 + 003 union still < 40 figures."**

Actual results from upstream spikes:

| Engine | Figures (post-dedup) |
|---|---|
| `pymupdf_full` (Spike 001) | **67** |
| Vector clustering (Spike 002) | +2 novel = 69 union |
| `pdfplumber.images` (Spike 003) | 61 |
| **Combined union (001 + 002 + 003)** | **~69** |

We exceeded the gate (40) by 29 figures using engines that are already in the project's dependency closure. There's no recall ceiling here to lift further with a heavier engine.

## What was avoided

Marker (`marker-pdf`) install:
- ~500MB of weights for the layout model
- GPU strongly recommended (CPU runs ~minutes per page on academic docs)
- GPL-3.0 license — would need subprocess fence per the SEED-018 pattern if it ever shipped to production
- Throwaway venv install + maintenance overhead

All of that complexity becomes worth doing only when cheaper paths fail. They didn't.

## Re-open trigger

This spike folder stays as a marker for future work. Run Marker only when:
1. A new document class arrives where `pymupdf_full` + vector clustering can't reach the figure count operator can count by eye, AND
2. A spike-positive case is made that more raw figure detection (not better storage / retrieval) is the actual bottleneck.

Neither holds today.

## Results

SKIPPED. No code committed. No install performed.
