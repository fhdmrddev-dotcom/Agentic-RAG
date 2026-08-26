# Phase 201: CSV & Structured Tabular Ingestion — Context

**Phase:** 201  
**Milestone:** v3.8 (Document Intelligence, Automations & Connectors)  
**Requirement:** `TAB-01`  
**Seeds:** `SEED-149`, `SEED-060`  

---

## 1. Problem & Context

In the current ingestion pipeline (`multimodal_service.py`), table extraction is only invoked for `.pdf` (via Docling/pdfplumber) and `.docx` (via python-docx). When a user uploads a `.csv` or `.xlsx` spreadsheet:
1. The file is ingested as plain text chunks.
2. `document_tables` receives **0 rows**.
3. When the AI agent attempts to use `query_table` on the CSV, the tool fails with `No tables found for document '<filename>.csv'`.
4. The document table count badge in the UI shows 0 tables despite the document being 100% tabular data.

---

## 2. Locked Decisions

### D-201-01: Formats Ingested as Structured Tables
- **CSV files (`text/csv`, `.csv`)** — parsed via Python's standard `csv` module with delimiter sniffing (comma, semicolon, tab).
- **Excel spreadsheets (`.xlsx`, `.xls`, `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, `application/vnd.ms-excel`)** — parsed via `openpyxl` / `xlrd`.

### D-201-02: Multi-Sheet Workbooks
- Each sheet in an Excel workbook is extracted as an independent table row in `document_tables`.
- `page`: sheet number (1-indexed).
- `table_index`: 0-indexed sheet index.
- Metadata captures sheet name for clear identification.

### D-201-03: Header Extraction & Normalization
- First row is treated as column headers.
- If a header cell is blank, empty, or numeric, fallback column names (`Column 1`, `Column 2`, etc.) are assigned to maintain valid named schemas.
- Cell values are normalized into clean string/number values suitable for `query_table` filtering and SQL querying.

### D-201-04: Tool & Ingestion Integration
- `extract_and_store_tables` in `multimodal_service.py` is extended to handle `text/csv` and Excel MIME types.
- `_fetch_document_tables` and `query_table` seamlessly query CSV/Excel rows from `document_tables`.
- Document re-ingestion properly flushes and replaces table rows for updated CSVs.

---

## 3. Downstream Plan & Research Directives

1. **Target Files**:
   - `backend/app/services/multimodal_service.py`: Add `extract_csv_tables` and `extract_excel_tables`.
   - `backend/app/services/extraction_service.py`: Ensure MIME type routing routes CSV/Excel bytes to table extraction.
   - `backend/tests/unit/test_multimodal_extraction.py`: Unit tests for CSV and multi-sheet Excel table parsing.
   - `backend/tests/unit/test_multimodal_query.py`: Unit tests for `query_table` over CSV documents.
2. **Success Criteria**:
   - Ingesting a CSV yields `document_tables` rows with accurate `headers` and `rows`.
   - Ingesting a multi-sheet Excel file yields multiple `document_tables` rows (one per sheet).
   - `query_table(document_name="data.csv")` executes successfully without error.
