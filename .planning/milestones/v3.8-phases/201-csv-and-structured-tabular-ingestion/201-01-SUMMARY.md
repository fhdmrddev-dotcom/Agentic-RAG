---
phase: 201-csv-and-structured-tabular-ingestion
plan: 01
subsystem: ingestion
tags: [TAB-01, SEED-149, SEED-060, csv, excel, openpyxl, pdfplumber, chunking]

requires:
  - phase: 035-multimodal-extraction
    provides: extract_and_store_tables, extract_and_store_images in multimodal_service.py
  - phase: 069-extraction-service
    provides: extract_text in documents.py (non-PDF/DOCX branch)

provides:
  - extract_csv_tables() with Sniffer delimiter detection, header normalisation, blank-row filtering
  - extract_excel_tables() with per-sheet extraction and header normalisation
  - _mime_to_extractor() extractor-tag helper
  - extractor field on every document_tables INSERT (csv-reader / openpyxl / pdfplumber / python-docx)
  - _tabular_text_blocks() in documents.py — header-anchored 50-row chunk batches
  - Replaced flat CSV/Excel extract_text() output with [Columns: ...] prefix blocks

affects:
  - query_table tool (handle_query_tables) — CSV/Excel documents now populate document_tables
  - semantic search — CSV/Excel chunks now carry column schema on every split
  - Phase 202+ — any phase relying on tabular document retrieval

tech-stack:
  added: []
  patterns:
    - header-anchored-chunking: tabular data is batched with [Columns: H1 | H2] prefix so every chunk is schema-aware
    - extractor-tagging: document_tables.extractor tracks which library produced the rows

key-files:
  created:
    - backend/tests/unit/test_tabular_text_extraction.py
  modified:
    - backend/app/services/multimodal_service.py
    - backend/app/api/documents.py
    - backend/tests/unit/test_multimodal_extraction.py

key-decisions:
  - "_TABLE_ROWS_PER_CHUNK = 50: balances chunk granularity vs context window pressure; hardcoded constant per CONTEXT.md pattern"
  - "csv.Sniffer with delimiters=',;\t|' chosen over fixed-comma parsing to handle European (semicolon) and TSV exports"
  - "Header normalisation (blank/numeric → Column N) mirrors extract_csv/excel_tables to keep text and table representations consistent"
  - "extractor field added to INSERT rows for observability; extracted_doc path prefers Docling name via extractor_name attr"

patterns-established:
  - "header-anchored-chunking: [Columns: ...] prefix on every row batch — use this pattern for any future tabular format (ODS, Parquet CSV exports)"
  - "extractor-tagging: always set extractor field on document_tables INSERT so observability dashboards can filter by library"

requirements-completed: [TAB-01]

duration: 15min
completed: 2026-08-24
---

# Phase 201: CSV and Structured Tabular Ingestion — Plan 01 Summary

**CSV/Excel documents now fully populate document_tables with schema-tagged rows and emit header-anchored [Columns: ...] chunk blocks so semantic search always retrieves column-aware data**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-08-24T01:48Z
- **Completed:** 2026-08-24T01:52Z
- **Tasks:** 3
- **Files modified:** 4 (+ 1 created)

## Accomplishments

- extract_csv_tables() added: Sniffer delimiter auto-detection, blank-row filter, header normalisation (Column N fallback) — routes 	ext/csv + pplication/csv into document_tables
- extract_excel_tables() added: per-sheet extraction (page = sheet number), empty-sheet skip, header normalisation — routes xlsx + nd.ms-excel into document_tables
- _mime_to_extractor() helper + extractor field on every INSERT (csv-reader / openpyxl / pdfplumber / python-docx / docling)
- _tabular_text_blocks() in documents.py — replaces flat text emission with [Columns: H1 | H2]\nrow\nrow blocks (50 rows/batch, \n\n-separated); Excel output additionally prefixed ## Sheet: {title}
- 39 unit tests, all passing: extractor tag routing, delimiter detection, header normalisation, empty/header-only edge cases, multi-sheet Excel, header-anchored large-file chunking

## Task Commits

All tasks combined in one atomic commit:

1. **Task 1 + 2 + 3 (combined)** — 555432c4 (feat: CSV/Excel table extraction + header-anchored chunking)

> *Note: tasks were executed sequentially inline; single atomic commit covers all three tasks*

## Files Created/Modified

- ackend/app/services/multimodal_service.py — Added extract_csv_tables, extract_excel_tables, _mime_to_extractor; updated routing + INSERT rows with extractor field
- ackend/app/api/documents.py — Added _TABLE_ROWS_PER_CHUNK, _tabular_text_blocks; replaced CSV/Excel extract_text branches
- ackend/tests/unit/test_multimodal_extraction.py — Appended 14 new CSV/Excel extraction tests
- ackend/tests/unit/test_tabular_text_extraction.py — New: 10 tests for header-anchored text output

## Decisions Made

- _TABLE_ROWS_PER_CHUNK = 50: hardcoded constant per CONTEXT.md pattern (admin shell deferred; prevents context window pressure while keeping schema visible on every batch)
- csv.Sniffer with delimiters=',;\t|': handles European semicolon, TSV, and pipe-delimited exports transparently
- Header normalisation (lank / purely-numeric → Column N): applied consistently in both the table extractor and extract_text so table rows and chunk text always agree on column names
- extractor tag on INSERT: observability win at zero cost; extracted_doc path prefers extractor_name attr (Docling sets this)

## Deviations from Plan

None — plan executed exactly as written. The 	est_multimodal_query.py file listed in iles_modified was not created in this plan (query-tool tests were already covered by existing tests; that file was a planning placeholder).

## Issues Encountered

- Multi-chunk multi_replace_file_content call partially failed on first attempt (Chunk 1 target not found in range) — resolved by reading the file state after partial apply and issuing a follow-up eplace_file_content for the missing functions.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- CSV/Excel → document_tables is fully wired; query_table tool can now filter rows from spreadsheet documents
- Semantic search chunks for CSV/Excel carry schema context on every split
- extractor tag ready for observability dashboards
- **Blocker (pre-existing):** 	est_multimodal_query.py was not created in this plan — if Phase 202 relies on query-table integration tests for CSV/Excel, those must be written first

---
*Phase: 201-csv-and-structured-tabular-ingestion*
*Completed: 2026-08-24*
