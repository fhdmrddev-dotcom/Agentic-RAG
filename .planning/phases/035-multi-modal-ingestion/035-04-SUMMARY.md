---
plan: 035-04
phase: 035-multi-modal-ingestion
status: complete
gap_closure: true
source_uat: 035-UAT.md
completed: 2026-04-18
---

# Summary: Plan 035-04 — Fix PDF Image Extraction (pdfplumber stream bytes)

## What Was Built

Fixed `extract_pdf_images` in `backend/app/services/multimodal_service.py` to correctly decode image bytes from pdfplumber's image dicts, where the `"stream"` key holds a `pdfminer.PDFStream` object rather than raw bytes.

Added a focused unit test (`test_extract_pdf_images_reads_stream_bytes`) that verifies `stream.get_data()` is called on PDFStream-like objects.

## Gap Closed

**UAT Test 5 — PDF Image Extraction + Vision Description**: No rows were being stored in `document_images` despite PDFs containing embedded images. Root cause: `img_obj.get("stream", b"")` returned either `b""` (key absent) or a PDFStream object that `io.BytesIO()` couldn't consume, both silently skipped.

## Changes Made

### `backend/app/services/multimodal_service.py`

Replaced lines 142–143:

```python
# BEFORE
img_bytes = img_obj.get("stream", b"")
if not img_bytes:
    continue
```

```python
# AFTER
stream_obj = img_obj.get("stream")
if stream_obj is None:
    continue
try:
    img_bytes = stream_obj.get_data() if hasattr(stream_obj, "get_data") else bytes(stream_obj)
except Exception:
    continue
if not img_bytes:
    continue
```

### `backend/tests/unit/test_multimodal_extraction.py`

Added `test_extract_pdf_images_reads_stream_bytes` — mocks a PDFStream-like object with `get_data()`, confirms:
- Image is returned (len == 1)
- Width/height correct (60x60)
- `b64_png` is non-empty
- `stream.get_data()` called exactly once

## Validation

- All 7 unit tests pass (`pytest backend/tests/unit/test_multimodal_extraction.py -v`)
- Manual: re-upload PDF with embedded image → `document_images` should now have rows with non-empty `description`

## Self-Check: PASSED

key-files:
  modified:
    - backend/app/services/multimodal_service.py
    - backend/tests/unit/test_multimodal_extraction.py
