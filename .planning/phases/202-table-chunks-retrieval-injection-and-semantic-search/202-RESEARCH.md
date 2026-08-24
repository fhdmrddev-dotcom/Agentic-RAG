# Phase 202: Table Chunks Retrieval Injection & Semantic Search — Research

**Gathered:** 2026-08-24
**Status:** Complete

## Executive Summary

Phase 201 implemented extract_csv_tables and extract_excel_tables so all tabular documents (PDF, DOCX, CSV, Excel) store structured tables in document_tables.
Phase 202 fulfills requirement TAB-02: extracted tables must be transformed into structured Markdown vector chunks and injected into document_chunks. This ensures vector and hybrid search can retrieve cell facts directly.

## Architecture & Data Flow

[Ingestion Pipeline (documents.py)]
       │
       ├─► 1. Extract Text & Chunks -> document_chunks (text chunks, chunk_index 0..K)
       │
       ├─► 2. Extract & Store Tables (multimodal_service.py -> document_tables)
       │       │
       │       └─► Form Table Markdown Chunks (format_table_chunks)
       │             - Hybrid schema header: [Table {idx} | Page {p} | Columns: {headers}]
       │             - Partitioned into 25-30 rows per batch with propagated headers
       │             - Generate embeddings via embed_texts(..., user_settings)
       │             - Insert into document_chunks (chunk_index K+1..N)
       │
       └─► 3. Extract & Store Images (multimodal_service.py -> document_images & document_chunks)

## Key Invariants & Technical Details

1. **Table Markdown Format (D-01 / D-02):**
   Each chunk begins with a schema header [Table {idx} | Page {page} | Columns: {headers}] followed by clean Markdown table syntax.

2. **Partitioning & Header Propagation (D-03 / D-04):**
   - Tables with >30 rows are partitioned into batches of 25-30 data rows.
   - Every batch chunk repeats [Table N | Page P | Columns: ...] and the markdown column headers | Col1 | Col2 |
|---|---|.
   - Prevents embedding token overflow while guaranteeing column association for every cell value.

3. **Embedding Vector Alignment (EMBED-04 / D-10):**
   - Must use embed_texts (or embed_chunks) passing user_settings=app_settings.
   - Populate embedding_model and embedding_dimensions on document_chunks so the vector space matches text chunks and query embeddings.
   - Read org_id from document and include in chunk rows for multi-tenant isolation (TEN-04).

4. **Chunk Index Offset:**
   - Query max(chunk_index) for the document_id in document_chunks before inserting table chunks to avoid index collisions.

5. **Historical Backfill Helper (D-08):**
   - Function ackfill_table_chunks(supabase, document_id, user_id, app_settings): reads rows from document_tables, checks if table chunks already exist, formats them, generates embeddings, and inserts them into document_chunks.

## Validation Architecture

- **Unit tests:**
  - 	est_format_table_chunks_single_small_table: single table formatted as markdown with schema header.
  - 	est_format_table_chunks_large_table_partitioning: table with 75 rows split into 3 chunks with repeated headers.
  - 	est_extract_and_store_tables_generates_document_chunks: mocks embed_texts and verifies document_chunks insert.
  - 	est_backfill_table_chunks: verifies backfill queries document_tables and populates document_chunks.
- **Quick run command:** env\Scripts\python -m pytest tests/unit/test_table_chunks_injection.py tests/unit/test_multimodal_extraction.py -v
