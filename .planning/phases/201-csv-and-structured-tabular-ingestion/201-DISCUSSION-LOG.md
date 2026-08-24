# Phase 201: CSV & Structured Tabular Ingestion — Discussion Log

**Date:** 2026-08-24  
**Milestone:** v3.8  
**Topic:** CSV & Spreadsheet Structured Ingestion (`TAB-01`)  

---

## 1. Context & Background

The operator identified in `SEED-149` that when a user uploads a `.csv` file into the knowledge base, the backend only creates text chunks and never populates `document_tables`. When the AI agent subsequently attempts to call the `query_table` tool on that CSV document, the tool returns:
```
Error: No tables found for document 'rag_corpus_documents.csv'
```
Even though the CSV document is 100% tabular data.

---

## 2. Questions & Decisions

### Q1: Which tabular file formats should extract structured tables?
- **User Choice:** CSV (`.csv`) and Excel (`.xlsx`, `.xls`).
- **Rationale:** CSV and Excel represent the vast majority of tabular business data uploaded by users. Both formats will now parse into structured `document_tables` records.

### Q2: How should multi-sheet Excel workbooks be handled?
- **User Choice:** Extract each sheet as a separate table (`table_index = 0, 1, 2...`) with sheet name in metadata.
- **Rationale:** Ensures every tab/sheet in an Excel workbook is accessible and individually queryable by `query_table`.

### Q3: How should headers and delimiters be handled?
- **User Choice:** First row as headers, auto-generating `Column 1, Column 2...` if cells are blank or numeric, with delimiter sniffing for CSVs.
- **Rationale:** Prevents empty/missing header errors while accommodating comma, semicolon, and tab separated values.

---

## 3. Implementation Next Steps

1. Implement `extract_csv_tables` and `extract_excel_tables` in `backend/app/services/multimodal_service.py`.
2. Connect MIME routing in `extract_and_store_tables`.
3. Add full unit test coverage in `backend/tests/unit/test_multimodal_extraction.py` and `test_multimodal_query.py`.
4. Proceed to `/gsd:plan-phase 201`.
