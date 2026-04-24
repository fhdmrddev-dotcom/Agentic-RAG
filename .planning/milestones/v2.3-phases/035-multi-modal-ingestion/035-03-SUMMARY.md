---
plan: 035-03
phase: 035-multi-modal-ingestion
status: complete
completed: 2026-04-18
key-files:
  modified:
    - backend/app/api/documents.py
---

# Plan 035-03 Summary: Image Extraction Pipeline Wiring

## What Was Built

Added `extract_and_store_images` call into `ingest_document` immediately after table extraction:

- `extracting_images` Realtime status event fires before image extraction
- `extract_and_store_images(raw, mime_type, document_id, user_id, supabase, app_settings)` called with the already-loaded `app_settings` instance
- Lazy import alongside `extract_and_store_tables` in the multi-modal block

## Self-Check

- [x] `documents.py` contains `extracting_images` status string
- [x] `documents.py` contains `extract_and_store_images(raw, mime_type, document_id, user_id, supabase, app_settings)`
- [x] All 6 multimodal tests PASS (6/6 GREEN)
- [x] 233 existing unit tests pass, zero regressions (13 pre-existing failures unchanged)

## Phase 035 Complete — All Success Criteria Met

1. MODAL-01: PDF table extraction via pdfplumber → `document_tables`
2. MODAL-01: DOCX table extraction via python-docx → `document_tables`, `page=NULL`
3. MODAL-02: Image extraction + vision LLM description → `document_images`
4. Graceful failure handling — ingestion never aborted by extraction errors
5. Realtime status events: `extracting_tables` and `extracting_images`
6. `supabase db push` pending — user must apply migrations 018/019 manually

## Self-Check: PASSED
