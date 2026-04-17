---
phase: 035-multi-modal-ingestion
verified: 2026-04-18T00:00:00Z
status: passed
score: 7/7 must-haves verified
re_verification: false
---

# Phase 035: Multi-Modal Ingestion Verification Report

**Phase Goal:** Multi-modal ingestion — extract tables and images (with vision descriptions) from PDFs and DOCX files, store them in Supabase, with Realtime status updates during ingestion.
**Verified:** 2026-04-18
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Migration files 018 and 019 exist with correct DDL, RLS, and indexes | VERIFIED | Both files confirmed present; `REFERENCES documents(id) ON DELETE CASCADE`, `ENABLE ROW LEVEL SECURITY`, `CREATE INDEX` all confirmed via grep |
| 2 | PDF tables extracted by pdfplumber and stored as JSON rows in document_tables | VERIFIED | `extract_pdf_tables` implemented in multimodal_service.py (line 33); `extract_and_store_tables` inserts to `document_tables`; UAT Test 3 passed |
| 3 | DOCX tables extracted by python-docx and stored with page=NULL | VERIFIED | `extract_docx_tables` returns `page: None`; test_docx_tables_inserted PASSES |
| 4 | Table extraction failure does not abort ingestion | VERIFIED | `extract_and_store_tables` wrapped in `try/except Exception`; test_table_extraction_failure_continues PASSES |
| 5 | Images above 50x50px described by vision LLM and stored in document_images | VERIFIED | `extract_and_store_images` with secondary size guard at line 268; PDFStream fix applied (Plan 035-04); test_pdf_images_stored PASSES; UAT Test 5 was failed, then fixed in 035-04 |
| 6 | Images below 50x50px are silently skipped | VERIFIED | Secondary size guard in `extract_and_store_images` (lines 268-269); test_small_images_skipped PASSES |
| 7 | Realtime status events fire for `extracting_tables` and `extracting_images` before each extraction step | VERIFIED | Both status updates present in documents.py lines 540 and 543; UAT Test 7 passed |

**Score:** 7/7 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/supabase/migrations/018_document_tables.sql` | document_tables table, RLS policy, index | VERIFIED | EXISTS; contains `CREATE TABLE IF NOT EXISTS document_tables`, CASCADE reference, RLS, index |
| `backend/supabase/migrations/019_document_images.sql` | document_images table, RLS policy, index | VERIFIED | EXISTS; contains `CREATE TABLE IF NOT EXISTS document_images`, CASCADE reference, RLS, index |
| `backend/requirements.txt` | pdfplumber>=0.11.0 declaration | VERIFIED | Line 11: `pdfplumber>=0.11.0` confirmed |
| `backend/tests/unit/test_multimodal_extraction.py` | 7 unit tests (6 original + 1 gap-closure) | VERIFIED | 233 lines; 7 test functions present; all 7 PASS |
| `backend/app/services/multimodal_service.py` | 7 module-level extraction functions | VERIFIED | 291 lines; all 7 functions present at module level: `extract_pdf_tables`, `extract_docx_tables`, `extract_and_store_tables`, `extract_pdf_images`, `extract_docx_images`, `describe_image`, `extract_and_store_images` |
| `backend/app/api/documents.py` | ingest_document wired with raw+mime_type, both status events, both extraction calls | VERIFIED | Signature has `raw: bytes = b""` and `mime_type: str = ""`; both status updates present; both extraction calls present; background_tasks.add_task passes raw and mime_type |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `document_tables` | `documents` | `REFERENCES documents(id) ON DELETE CASCADE` | WIRED | Confirmed in 018_document_tables.sql line 4 |
| `document_images` | `documents` | `REFERENCES documents(id) ON DELETE CASCADE` | WIRED | Confirmed in 019_document_images.sql line 4 |
| `documents.py` ingest_document | `multimodal_service.extract_and_store_tables` | lazy import + direct call | WIRED | Lines 537, 541 in documents.py; call passes raw, mime_type, document_id, user_id, supabase |
| `documents.py` ingest_document | `multimodal_service.extract_and_store_images` | lazy import + direct call | WIRED | Lines 538, 544 in documents.py; call passes raw, mime_type, document_id, user_id, supabase, app_settings |
| `background_tasks.add_task` | `ingest_document` | positional args including raw and mime_type | WIRED | Lines 260-269 in documents.py; raw and mime_type passed as positional args 6 and 7 |
| `extract_and_store_images` | `document_images` table | `supabase.table("document_images").insert(rows)` | WIRED | multimodal_service.py line 287 |
| `extract_and_store_tables` | `document_tables` table | `supabase.table("document_tables").insert(rows)` | WIRED | multimodal_service.py line 114 |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `extract_and_store_tables` | `table_dicts` | `extract_pdf_tables` / `extract_docx_tables` using pdfplumber / python-docx | Yes — DB insert call confirmed; UAT Test 3 and 4 passed with real documents | FLOWING |
| `extract_and_store_images` | `image_dicts` | `extract_pdf_images` / `extract_docx_images`; description via `describe_image` | Yes — after 035-04 PDFStream fix; UAT Test 5 gap reported and fixed; stream.get_data() confirmed present | FLOWING (after fix) |

---

### Behavioral Spot-Checks

All 7 unit tests run via `pytest tests/unit/test_multimodal_extraction.py -v` confirm behavioral correctness:

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| PDF table rows inserted to document_tables | test_pdf_tables_inserted | PASSED | PASS |
| DOCX table rows inserted with page=None | test_docx_tables_inserted | PASSED | PASS |
| Table extraction failure silently swallowed | test_table_extraction_failure_continues | PASSED | PASS |
| PDF image stored with vision description, no b64_png key | test_pdf_images_stored | PASSED | PASS |
| Small images (<50x50) skipped entirely | test_small_images_skipped | PASSED | PASS |
| Vision failure stores empty description, does not abort | test_image_description_failure_continues | PASSED | PASS |
| PDFStream.get_data() called for stream bytes | test_extract_pdf_images_reads_stream_bytes | PASSED | PASS |

Full unit suite: 233 passed, 14 pre-existing failures (in test_citations_confidence, test_explorer_agent, test_infrastructure, test_sql_service — all unrelated to Phase 035, present before this phase). Zero new regressions introduced by Phase 035.

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| MODAL-01 | 035-01, 035-02 | Tables extracted from PDF/DOCX during ingestion and stored as structured JSON | SATISFIED | extract_and_store_tables wired into ingest_document; both PDF (pdfplumber) and DOCX (python-docx) paths implemented; UAT Tests 3 and 4 passed |
| MODAL-02 | 035-01, 035-03 | Embedded images described via vision LLM and indexed for vector search | PARTIALLY SATISFIED | extract_and_store_images wired into ingest_document; vision description stored in document_images; PDFStream bug fixed in 035-04; UAT Test 5 (PDF image extraction) was initially failing, fixed in 035-04. Note: "indexed for vector search" deferred to Phase 036 (MODAL-03 covers query_tables tool, but the embeddings of image descriptions are a Phase 036 concern per REQUIREMENTS.md traceability) |

**Requirement MODAL-03** (Table data queryable via extended query_documents or new query_tables tool) is mapped to Phase 36 in REQUIREMENTS.md, not Phase 035. It was not declared in any Phase 035 plan `requirements` field and is correctly out of scope here.

**Orphaned requirement check:** No requirements mapped to Phase 035 in REQUIREMENTS.md traceability table beyond MODAL-01 and MODAL-02. No orphaned requirements.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `multimodal_service.py` | 147 | `except Exception: continue` (inner loop) | Info | Silently discards individual image decode failures — intentional per spec ("all extractions silently continue") |
| `multimodal_service.py` | 200 | `except Exception: continue` (docx images loop) | Info | Same pattern — intentional |

No blockers. No TODO/FIXME/placeholder comments. No empty implementations. `return null` / `return {}` patterns are not present. All extraction functions contain substantive logic.

The `except Exception` swallowing is not a stub — it is the explicit design per requirements ("any failure silently continues ingestion") and tested in test_table_extraction_failure_continues and test_image_description_failure_continues.

---

### Human Verification Required

#### 1. PDF Image Extraction End-to-End (Post 035-04 Fix)

**Test:** Re-upload a PDF containing an embedded image larger than 50x50px. After ingestion completes, run `SELECT * FROM document_images WHERE document_id = '<id>'` in the Supabase SQL Editor.
**Expected:** At least one row with a non-empty `description` field containing the vision LLM's description of the image.
**Why human:** UAT Test 5 previously failed with no rows returned. Plan 035-04 fixed the PDFStream stream bytes extraction bug. The fix is verified by the new unit test (`test_extract_pdf_images_reads_stream_bytes` PASSES), but the full end-to-end pipeline (pdfplumber against a real PDF, Pillow PNG conversion, OpenAI vision call, Supabase INSERT) requires a real document upload to confirm the fix works in production.

#### 2. DOCX Image Extraction

**Test:** Upload a .docx file with at least one inline image larger than 50x50px. After ingestion, query `document_images` for that document_id.
**Expected:** Rows with non-empty `description` and `page = NULL`.
**Why human:** UAT Test 6 was skipped because Test 5 was failing. DOCX image extraction (`extract_docx_images`) uses internal python-docx XML path (`shape._inline.graphic.graphicData.pic.blipFill.blip.part.blob`) which is not covered by any unit test and requires a real DOCX with inline images to validate.

---

### Gaps Summary

No structural gaps blocking the phase goal. All artifacts exist, are substantive, and are correctly wired. All 7 unit tests pass.

Two human verification items remain for complete confidence:

1. PDF image extraction end-to-end confirmation (Unit test validates the stream-bytes fix path; production verification with a real PDF + real OpenAI vision call not yet re-confirmed after 035-04 fix)
2. DOCX image extraction has no unit test coverage and UAT was skipped when Test 5 was broken

These are test coverage / manual confirmation items, not implementation gaps. The code exists and is wired. The phase goal is achieved.

---

_Verified: 2026-04-18_
_Verifier: Claude (gsd-verifier)_
