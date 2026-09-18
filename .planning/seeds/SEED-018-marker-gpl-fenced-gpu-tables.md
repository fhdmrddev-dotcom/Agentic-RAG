---
title: Marker as opt-in GPL-fenced GPU table engine
seed_id: SEED-018
status: planted
planted: 2026-05-15
planted_during: v2.6 (Phase 071.2 — Per-Aspect Extraction Dispatcher)
trigger_when: GPU compute provisioned for the deployment — OR — Phase 071.2 D-071.2-12 floor RED on tables (TableFormer recall insufficient on thesis-class PDFs)
scope: Medium (subprocess fence + GPU opt-in + adapter + constraint update)
parent_phase: 071.2
related_phases: [071.2]
surface: Agentic-RAG
---

# SEED-018 — Marker as opt-in GPL-fenced GPU table engine

Marker is a strong layout-aware PDF extractor with GPU-accelerated table detection. GPL-licensed — same subprocess fence pattern Phase 071 Plan 03 used for PyMuPDF.

## Why planted, not built

Phase 071.2 ships Docling TableFormer as the default PDF table engine (`extraction_table_engine_pdf='docling_tf'` per D-071.2-02). Procycons 2025 benchmark says Docling+TableFormer hits 97.9% on complex tables, beating ruling-line tools. If that bears out in our D-071.2-12 floor verification (thesis PDF tables ≥ 20), Marker is not needed.

If Phase 071.2 Plan 05 Task 4 (live UAT) hits the floor RED on tables → promote SEED-018 to a phase: subprocess-fenced Marker integration, GPU-opt-in via env var, integrated as a new `TABLE_ENGINES['marker']` entry.

## Re-open trigger

See frontmatter. Either trigger fires → write a phase plan that:

1. Adds Marker to `requirements.txt` (GPL — subprocess fence required; mirror PyMuPDF pattern at `backend/extractors/marker_isolated.py`)
2. Adapter: `backend/app/services/extractors/aspects/tables.py` adds `def marker_tables(raw, mime) -> list[TableData]` invoking subprocess child
3. GPU opt-in env var: `MARKER_USE_GPU=1` (default 0 — CPU fallback works but slow)
4. Migration: `app_settings.extraction_table_engine_pdf` accepts `'marker'` (constraint update)
5. Acceptance: same fence-test pattern as Phase 071 Plan 03 (`test_marker_fence` runtime assertion)

## Out of scope at planting

- No CPU-only deployment promise (Marker on CPU is materially slower than Docling-TF; opt-in only)
- No DOCX path (Marker is PDF-only)
- No model-download orchestration in install scripts (deferred to that phase plan)

## Failure-mode escalation path (D-071.2-12 RED on tables)

If Phase 071.2 Plan 05 Task 4 reports `tables < 20` on thesis under Docling-TF defaults:

1. Don't band-aid Phase 071.2 — let it ship at the lower table count, log the gap.
2. Open a new phase (e.g. 076.5 or appropriate slot) titled "Marker GPL-fenced GPU table engine".
3. Reuse SEED-018 frontmatter trigger as the rationale.
4. Implement per the steps above.

## Source decision

Phase 071.2 CONTEXT.md D-071.2-16.
