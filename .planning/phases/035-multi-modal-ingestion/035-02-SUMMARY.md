---
plan: 035-02
phase: 035-multi-modal-ingestion
status: complete
completed: 2026-04-18
key-files:
  created:
    - backend/app/services/multimodal_service.py
  modified:
    - backend/app/api/documents.py
---

# Plan 035-02 Summary: Table Extraction + Pipeline Wiring

## What Was Built

**`backend/app/services/multimodal_service.py`** — new service with 7 module-level functions:

- `extract_pdf_tables(raw)` — pdfplumber table extraction, normalises headers/rows
- `extract_docx_tables(raw)` — python-docx table extraction, page=None always
- `extract_and_store_tables(raw, mime_type, document_id, user_id, supabase)` — orchestrator with try/except; inserts list of rows to `document_tables` in one call
- `extract_pdf_images(raw, min_px=50)` — pdfplumber image extraction with PIL PNG re-encode
- `extract_docx_images(raw, min_px=50)` — python-docx inline shapes extraction
- `describe_image(b64_png, app_settings)` — synchronous OpenAI vision call
- `extract_and_store_images(raw, mime_type, document_id, user_id, supabase, app_settings)` — orchestrator with try/except, secondary size guard, capped at 20 vision calls

**`backend/app/api/documents.py`** — three changes:
1. `ingest_document` signature extended with `raw: bytes = b""` and `mime_type: str = ""`
2. `extracting_tables` Realtime status event + `extract_and_store_tables` call added after metadata extraction
3. `background_tasks.add_task` call site updated to pass `raw` and `mime_type`

## Deviations

- **All 6 tests GREEN in Plan 035-02** (not just 3) — `extract_and_store_images` was implemented fully in this plan rather than deferring MODAL-02 to Plan 035-03. The secondary size guard (needed to make `test_small_images_skipped` pass with mocked `extract_pdf_images`) was added inline.

## Self-Check

- [x] `multimodal_service.py` contains all 7 module-level functions
- [x] `ingest_document` has `raw: bytes = b""` and `mime_type: str = ""` params
- [x] `ingest_document` contains `extracting_tables` status update
- [x] `background_tasks.add_task` passes `raw` and `mime_type`
- [x] All 6 multimodal tests PASS (6/6 GREEN)
- [x] 82 existing unit tests still pass (1 pre-existing unrelated failure)

## Self-Check: PASSED
