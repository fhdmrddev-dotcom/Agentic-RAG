---
plan: 035-01
phase: 035-multi-modal-ingestion
status: complete
completed: 2026-04-18
key-files:
  created:
    - backend/supabase/migrations/018_document_tables.sql
    - backend/supabase/migrations/019_document_images.sql
    - backend/tests/unit/test_multimodal_extraction.py
  modified:
    - backend/requirements.txt
---

# Plan 035-01 Summary: Schema Migrations + RED Tests

## What Was Built

Created the schema foundation and test surface for Phase 35 multi-modal ingestion:

1. **Migration 018** (`document_tables`) — stores extracted PDF/DOCX tables as structured JSON rows. Nullable `page` column (DOCX has no page boundaries), `headers` and `rows` as JSONB, RLS enabled, CASCADE delete from `documents`.

2. **Migration 019** (`document_images`) — stores vision LLM descriptions of embedded document images. Nullable `page`, `description TEXT`, RLS enabled, CASCADE delete from `documents`.

3. **pdfplumber 0.11.9** — added to `requirements.txt` and installed in venv. Verified importable. Pulls in `pypdfium2`, `pdfminer.six`, `cryptography` as dependencies.

4. **6 RED test stubs** in `test_multimodal_extraction.py` — all fail with `ModuleNotFoundError: No module named 'app.services.multimodal_service'` (expected RED state). Tests cover:
   - `test_pdf_tables_inserted` — MODAL-01
   - `test_docx_tables_inserted` — MODAL-01
   - `test_table_extraction_failure_continues` — MODAL-01
   - `test_pdf_images_stored` — MODAL-02
   - `test_small_images_skipped` — MODAL-02
   - `test_image_description_failure_continues` — MODAL-02

## Deviations

- **`supabase db push` not run** — the Supabase CLI is not linked to the project (`supabase link` has not been run). Migration files exist in the repo. The user must apply them manually via the Supabase dashboard (SQL Editor) or by running `supabase link` then `supabase db push` from `backend/`. Plans 035-02 and 035-03 will fail at test time if the tables don't exist in the live DB, but the unit tests (which mock Supabase) will pass regardless.

## Self-Check

- [x] `backend/supabase/migrations/018_document_tables.sql` — exists, contains `CREATE TABLE IF NOT EXISTS document_tables` and `REFERENCES documents(id) ON DELETE CASCADE`
- [x] `backend/supabase/migrations/019_document_images.sql` — exists, contains `CREATE TABLE IF NOT EXISTS document_images`
- [x] `requirements.txt` contains `pdfplumber>=0.11.0`
- [x] `venv/Scripts/python -c "import pdfplumber"` exits 0 (version 0.11.9)
- [x] `test_multimodal_extraction.py` — 6 test functions present, all RED (ImportError)
- [x] Existing 82 unit tests still pass (1 pre-existing failure in `test_explorer_agent.py` unrelated to this plan)

## Self-Check: PASSED
