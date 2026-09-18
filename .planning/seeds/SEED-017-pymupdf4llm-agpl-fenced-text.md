---
title: PyMuPDF4LLM as opt-in AGPL-fenced text engine
seed_id: SEED-017
status: planted
planted: 2026-05-15
planted_during: v2.6 (Phase 071.2 — Per-Aspect Extraction Dispatcher)
trigger_when: CPU-time budget for text extraction tightens below 2s/page on the thesis-class reference doc — OR — project policy adopts AGPL-fence pattern (subprocess isolation) uniformly across extractors
scope: Small (single adapter + subprocess child + 1-column constraint update)
parent_phase: 071.2
related_phases: [071.2, 076 (potential)]
surface: Agentic-RAG
---

# SEED-017 — PyMuPDF4LLM as opt-in AGPL-fenced text engine

PyMuPDF4LLM is a newer wrapper around PyMuPDF that combines `get_images(full=True)` + smart OCR routing + markdown text output. It's a strict superset of what raw PyMuPDF does for text+image extraction in a layout-aware fashion, but it's AGPL-licensed — same fence as Phase 071 Plan 03 PyMuPDF subprocess.

## Why planted, not built

Phase 071.2 ships per-aspect dispatcher with three text engines (`legacy`, `docling`, `pymupdf`). PyMuPDF4LLM would be a fourth — adds another adapter, another subprocess pin, another set of fence-tests. Currently not justified by chunk-count or speed data:

- Phase 071.2 D-071.2-13 GATE confirmed legacy + `full_markdown` swap recovers chunk count to ≥ 200 on thesis.
- Docling text path (currently MEDIUM-confidence for layout-heavy PDFs) is the next-best-text candidate per D-071.2-02.

Adding PyMuPDF4LLM gains marginal quality if CPU budget tightens (the trigger above).

## Re-open trigger

See frontmatter. Either trigger fires → write a small phase plan that:

1. Adds `pymupdf4llm` to `requirements.txt` (single line, AGPL-fenced via subprocess)
2. Adds `pymupdf4llm_text` to `TEXT_ENGINES` in `backend/app/services/extractors/aspects/__init__.py`
3. Adapter file: `backend/app/services/extractors/aspects/text.py` adds `def pymupdf4llm_text(raw, mime) -> tuple[str, str | None]` invoking a NEW subprocess child at `backend/extractors/pymupdf4llm_isolated.py` (mirror existing `pymupdf_isolated.py` AGPL fence shape).
4. Migration: add `'pymupdf4llm'` as a valid value for `app_settings.extraction_text_engine_pdf` (constraint update, not new column).
5. Acceptance: same shape as Phase 071 Plan 03 — `test_pymupdf4llm_fence` runtime test asserts no `pymupdf4llm` import in parent process.

## Out of scope at planting

- No model download (pymupdf4llm uses existing PyMuPDF + tesseract; no GPU)
- No production rollout (opt-in via `app_settings` only)
- No DOCX path (pymupdf4llm is PDF-only)

## Source decision

Phase 071.2 CONTEXT.md D-071.2-15.
