# Phase 069 Plan 01 — Deferred Items

Out-of-scope discoveries surfaced during execution. NOT touched by Plan 01.

## Pre-existing integration test failures (NOT caused by Phase 069)

Verified by running the same tests against the pre-Phase-069 file state — both
failures reproduce identically without any Phase 069 changes applied.

### 1. `tests/integration/test_documents.py::TestFullMarkdown::test_ingest_stores_full_markdown`

- **Symptom:** `StopIteration` on `supabase.table("documents").update({"ingestion_step": "embedding"}).eq("id", document_id).execute()` at `documents.py:689`.
- **Root cause:** The test sets `mock_builder.execute.side_effect = [3 results]` — only three `execute()` calls expected. But `ingest_document` now emits SIX `ingestion_step` update→execute pairs (`extracting`, `chunking`, `embedding`, `extracting_tables`, `extracting_images`, `metadata`) plus the chunk insert + completion update, well above 3. The test was written before commit `b2ada03` (phase 56-01) added the granular `ingestion_step` flow, and the side_effect list was never updated.
- **Fix shape:** Extend the side_effect list to cover all `ingestion_step` updates the current ingest path emits. Trivial but unrelated to Phase 069's seam carve.
- **Phase 069 impact:** None. The test fails with `StopIteration` long before any extraction logic runs. Phase 069 does not touch `ingest_document`'s body.

### 2. `tests/integration/test_documents.py::TestUploadDocument::test_upload_with_valid_folder_id_returns_201`

- **Symptom:** `KeyError: 'user_id'` at `documents.py:178` — `folder_check.data["user_id"]` fails because the mock returns `{}` (or doesn't populate `user_id`).
- **Root cause:** The integration test setup for the folder-check mock does not stub `user_id` on the folder row. The folder-ownership guard at L177-181 (added later) reads `folder_check.data["user_id"]`, but the test predates this guard.
- **Fix shape:** Update the test mock to include `user_id` matching the test user. Trivial mock-tweak, unrelated to Phase 069.
- **Phase 069 impact:** None. The KeyError fires during folder validation, well before either the upload path's `extract_text` / `get_extractor` call.

## Latent bug: DOCX image extraction (python-docx 1.2.0)

- **Where:** `backend/app/services/multimodal_service.py:extract_docx_images` line 193 (`img_bytes = shape._inline.graphic.graphicData.pic.blipFill.blip.part.blob`).
- **Symptom:** `AttributeError: 'CT_Blip' object has no attribute 'part'`. Caught + silently continued by the `try/except Exception: continue` at L205. Result: every DOCX yields zero images today.
- **Root cause:** python-docx 1.2.0 reshaped the internal Blip XML element API; `.part` is no longer a CT_Blip attribute.
- **Verified by:** Phase 069 golden capture shows DOCX images=0 even when the fixture embeds a valid 96×96 inline picture.
- **Phase 069 impact:** None — Phase 069 preserves today's behavior verbatim. The golden test codifies `images=[]` for the reference DOCX as the binding baseline. Phase 071 (RAG-MM-LIFT-02 → DOCX `related_parts` walk) is the planned home for this fix.

## Latent quirk: pdfplumber image streams + PIL on ReportLab-embedded images

- **Where:** `backend/app/services/multimodal_service.py:extract_pdf_images` line 159-163.
- **Symptom:** Images embedded into a ReportLab-generated PDF surface as a `PDFStream` with raw Flate-decoded pixel bytes (no recognizable image header). `PIL.Image.open(io.BytesIO(stream_data))` raises `UnidentifiedImageError`. Caught + silently continued by the `try/except Exception: continue` at L163-164. Result: zero images extracted from this class of synthesized PDF.
- **Phase 069 impact:** Same as DOCX — preserved as today's baseline in the golden test. May be fixed organically when Phase 071 swaps in Docling / PyMuPDF, which understand stream-decoding metadata.

---

These items will resurface during Phase 071 (Docling primary engine) which is where the abstraction seam carved in Phase 069 actually pays off.
