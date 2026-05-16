# Phase 071.3 — Deferred Items (Out-of-Scope Findings)

Per `<deviation_rules>` SCOPE BOUNDARY: pre-existing test failures unrelated
to the current task are logged here, not fixed in Plan 04. Verified pre-existing
by stashing Plan 04 changes and re-running each test against the Phase 071.3
Plan 03 baseline (commit `9b6fabb` minus Plan 04 changes).

## Pre-existing test failures (NOT introduced by Plan 04)

1. **`tests/integration/test_documents.py::TestUploadDocument::test_upload_with_valid_folder_id_returns_201`**
   - Error: `KeyError: 'user_id'` in folder ownership check.
   - Root cause: mock builder fixture returns `{'id': ..., 'user_id': None}` but
     test sets `'user_id'` to be filtered. Fixture mock contract mismatch.
   - Verified pre-existing 2026-05-16 (failed on stashed working tree before Plan 04 changes).

2. **`tests/integration/test_documents.py::TestReextractDocument::test_reextract_explicit_pymupdf_timeout_does_NOT_fallback`**
   - Error: `NameError: name 'mock_get_extractor' is not defined`.
   - Root cause: test uses `mock_get_extractor.call_count` without defining the
     mock in scope. Pre-existing test authoring bug.

3. **`tests/integration/test_documents.py::TestFullMarkdown::test_ingest_stores_full_markdown`**
   - Pre-existing failure.

4. **`tests/unit/test_extraction_service.py::test_legacy_extractor_pdf_matches_golden`**
   - Error: dict comparison includes `'equations': []` in the actual output but
     not in the golden expected dict.
   - Root cause: Phase 071.2 added `equations` to `ExtractedDocument` but the
     legacy-golden fixture was never updated.

5. **`tests/unit/test_extraction_service.py::test_legacy_extractor_docx_matches_golden`**
   - Same root cause as #4 (golden fixture pre-dates `equations` field).

These belong in a separate hygiene phase (e.g. a "test fixture refresh"
follow-on after Plan 05). Plan 04 leaves them untouched.

## Notes

- Tests scoped to Plan 04 changes pass cleanly:
  - `tests/unit/test_aspect_engines_*.py` (12 passed)
  - `tests/unit/test_extract_composable.py`
  - `tests/integration/test_extraction_dispatcher.py` (6 passed)
- The pre-existing failures listed above also fail on the stashed baseline,
  confirming they pre-date Plan 04.
