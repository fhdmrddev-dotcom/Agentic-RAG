---
phase: 201
slug: csv-and-structured-tabular-ingestion
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-08-24
---

# Phase 201 — Validation Strategy: CSV & Structured Tabular Ingestion (TAB-01)

> Per-phase validation contract for feedback sampling during execution.
> Requirements: `TAB-01` (`SEED-149`, `SEED-060`)

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Backend framework** | pytest, async execution |
| **Backend quick run** | `cd backend && venv\Scripts\python -m pytest tests/unit/test_multimodal_extraction.py tests/unit/test_tabular_text_extraction.py tests/unit/test_multimodal_query.py -x` |
| **Full backend suite** | `cd backend && venv\Scripts\python -m pytest tests/unit` |
| **Typecheck** | `cd frontend && npx tsc --noEmit` (0 errors — no frontend changes this phase) |

---

## Three Root Problems Fixed

| ID | Root Problem | Fix Location |
|----|-------------|--------------|
| **P-A** | `extract_and_store_tables` drops CSV/Excel with `else: return` → `query_table` never finds rows | `multimodal_service.py` |
| **P-B** | `extract_text` CSV/Excel chunks lose column schema → semantic search is context-blind | `documents.py:extract_text` |
| **P-C** | Large CSV/Excel files: only the first chunk has headers; all subsequent chunks are schema-blind | `documents.py:extract_text` + `_tabular_text_blocks` helper |

---

## Per-Task Verification Map

| Behavior | Root Problem | Threat | Test Type | Automated Command | Status |
|----------|-------------|--------|-----------|-------------------|--------|
| `extract_csv_tables` parses comma-separated CSV into headers + rows | P-A | Missing CSV extraction | unit | `pytest -k test_extract_csv_tables_basic` | ⬜ |
| `extract_csv_tables` detects semicolon delimiter via Sniffer | P-A | Wrong delimiter → all-one-column parse | unit | `pytest -k test_extract_csv_tables_semicolon_delimiter` | ⬜ |
| `extract_csv_tables` detects tab delimiter | P-A | TSV file parsed as single column | unit | `pytest -k test_extract_csv_tables_tab_delimiter` | ⬜ |
| `extract_csv_tables` normalizes blank/numeric headers → `Column N` | P-A | Nameless columns → query_table confusion | unit | `pytest -k test_extract_csv_tables_header_normalization` | ⬜ |
| `extract_csv_tables` filters blank trailing rows | P-A | Empty rows inserted into document_tables | unit | `pytest -k test_extract_csv_tables_blank_rows_filtered` | ⬜ |
| `extract_csv_tables` returns `[]` on empty CSV | P-A | Empty insert call on blank file | unit | `pytest -k test_extract_csv_tables_empty_file_returns_empty` | ⬜ |
| `extract_csv_tables` returns `[]` on header-only CSV (no data rows) | P-A | Single-row table with no usable data | unit | `pytest -k test_extract_csv_tables_header_only_returns_empty` | ⬜ |
| `extract_excel_tables` extracts single-sheet workbook | P-A | Missing Excel extraction | unit | `pytest -k test_extract_excel_tables_single_sheet` | ⬜ |
| `extract_excel_tables` extracts each sheet separately (page=sheet_num) | P-A | Multi-sheet data loss | unit | `pytest -k test_extract_excel_tables_multi_sheet` | ⬜ |
| `extract_excel_tables` normalizes None/numeric cell headers → `Column N` | P-A | Blank Excel headers | unit | `pytest -k test_extract_excel_tables_header_normalization` | ⬜ |
| `extract_excel_tables` skips empty sheets | P-A | Empty insert for blank sheets | unit | `pytest -k test_extract_excel_tables_empty_sheet_skipped` | ⬜ |
| `extract_and_store_tables` routes `text/csv` → CSV extractor + `extractor="csv-reader"` | P-A | Routing drop + missing observability | unit | `pytest -k test_extract_and_store_tables_csv` | ⬜ |
| `extract_and_store_tables` routes Excel MIME → Excel extractor + `extractor="openpyxl"` | P-A | Routing drop + missing observability | unit | `pytest -k test_extract_and_store_tables_excel` | ⬜ |
| `extract_and_store_tables` is no-op for unsupported MIME | P-A | Over-extraction on plain text | unit | `pytest -k test_extract_and_store_tables_unsupported_mime_noop` | ⬜ |
| `extract_text` CSV output contains `[Columns: ...]` header prefix | P-B | Schema-blind chunks on CSV ingest | unit | `pytest -k test_extract_text_csv_contains_column_header` | ⬜ |
| `extract_text` CSV output with >50 rows has multiple `\n\n`-separated blocks, each starting with `[Columns:]` | P-C | Schema-blind chunks on large CSV ingest | unit | `pytest -k test_extract_text_csv_header_anchored_blocks_for_large_files` | ⬜ |
| `extract_text` CSV filters empty trailing rows (no degenerate empty blocks) | P-C | Ghost `[Columns:]` block with no data | unit | `pytest -k test_extract_text_csv_empty_rows_filtered` | ⬜ |
| `extract_text` Excel output contains `## Sheet:` heading + `[Columns: ...]` | P-B | Schema-blind chunks on Excel ingest | unit | `pytest -k test_extract_text_excel_contains_sheet_and_columns` | ⬜ |
| `extract_text` Excel multi-sheet: each sheet block has its own `[Columns:]` | P-B/P-C | Cross-sheet column ambiguity | unit | `pytest -k test_extract_text_excel_multi_sheet_each_has_columns` | ⬜ |
| `extract_text` CSV with header-only returns empty string or column-only block | P-A | No data = no meaningful chunks | unit | `pytest -k test_extract_text_csv_single_row_header_only_empty` | ⬜ |
| `handle_query_tables` returns structured rows from CSV document | P-A | query_table tool failure on CSV docs | unit | `pytest -k test_handle_query_tables_csv_document` | ⬜ |
| `handle_query_tables` with page filter queries correct sheet number for Excel | P-A | Sheet misidentification on page filter | unit | `pytest -k test_handle_query_tables_excel_page_filter` | ⬜ |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*
