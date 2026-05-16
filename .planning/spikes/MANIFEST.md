# Spike Manifest

## Idea

**image-recall-union** — measure whether mixing free OSS PDF figure-detection engines can close the 20/59 figure-recall gap on the operator's thesis at $0 cost (no vision-LLM-per-page). Feeds the SEED-021 spike-first re-open trigger that was locked into Phase 072 CONTEXT.md on 2026-05-16 when `vision_sweep` (~$3-5/extract) was deferred.

The spike answers two paired questions:
- **(a)** Which OSS engine — `pymupdf_full` (baseline), `page.get_drawings()` clustering, `pdfplumber.figures`, or Marker (CPU) — performs best on the thesis at $0 cost?
- **(b)** Does the marginal recall lift from $0 engines actually improve retrieval quality on figure-grounded queries against the existing strong pipeline (hybrid search + reranker + 15+ tools)?

Both must come back positive to justify a future v3.x phase. Either negative closes SEED-021 (or downgrades next attempt to vision_sweep with a separate cost gate).

## Spikes

| # | Name | Validates | Verdict | Tags |
|---|------|-----------|---------|------|
| 001 | pymupdf-full-baseline | pymupdf_full extracts N figures on the operator's thesis (anchor) | **SURPRISE: 67 figures (NOT 20)** — storage cap was the real bottleneck | seed-021, baseline, pymupdf, storage-cap-finding |
| 002 | get-drawings-vector-cluster | vector clustering adds ≥15 figures (target union 20 → 35+) | INVALIDATED (but harmless) — thesis only has 68 vector primitives total; +2 figures | seed-021, pymupdf, vector-clustering, thesis-is-raster-heavy |
| 003 | pdfplumber-figures | pdfplumber.images is a viable drop-in (target ≥30) | VALIDATED — 61 figures, comparable to pymupdf_full (engines walk same xref graph) | seed-021, pdfplumber, drop-in-alternative |
| 004 | marker-cpu-smoke | Marker recall on CPU (conditional on 002+003 union <40) | SKIPPED — conditional gate not triggered (union = 69) | seed-021, marker, gpl, skipped |
| 005 | retrieval-value-smoke | 5-10 figure-grounded queries: cap=20 baseline vs cap=100 lifted | PENDING (needs operator hand-evaluation) | seed-021, retrieval, leg-b, human-judgment |

## Topline finding (2026-05-16)

**The "20 figures stored = 34% recall" baseline was a storage-layer cap, not an extraction problem.** Spike 001 ran the same `pymupdf_full` extractor used in production and found 67 unique figures on the operator's thesis. The DB confirmed the diagnosis: `app_settings.multimodal_max_vision_calls = 100` is already populated correctly (per migration 044), but `backend/app/services/multimodal_service.py:_MAX_VISION_CALLS = 20` hardcodes the consumer side. The vision-LLM successfully describes 20 of 20 it tries (current state: `empty=0`); the other 47 figures are silently dropped before any LLM call is made.

**Implication for Phase 072:** Plan 01 (D-072-08 — replace the hardcode with the `app_settings` read) becomes the **sole load-bearing change** for the recall lift, not the entire vision_sweep engine that was deferred. The deferral was even more correct than originally argued.

**Open question:** does going from 20 → 67 stored figures actually improve answers on figure-grounded queries against the live pipeline? Spike 005 is set up to measure this; needs operator hand-evaluation. Can be deferred to Phase 072 Plan 03's existing live-UAT step instead of running here.

## Related artifacts

- **SEED-021**: `.planning/seeds/SEED-021-table-image-recall-lift.md` — the re-open trigger this spike fills
- **Phase 072 CONTEXT.md** `<deferred>` block: documents the vision_sweep retraction and points here
- **Reference fixture**: `backend/tests/fixtures/extraction/friendly_real.pdf` (arXiv 2605.15184v1, CC-BY 4.0, ~59 visible figures ground truth)
- **Project memory**: `[[feedback-extraction-root-cause-not-plumbing]]`, `[[feedback-research-landscape-completeness]]`, `[[feedback-preserve-engine-optionality]]`, `[[feedback-docling-skepticism]]`
