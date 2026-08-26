# Phase 202: Table Chunks Retrieval Injection & Semantic Search - Context

**Gathered:** 2026-08-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Extracted tables (from CSV, Excel, DOCX, and PDF) stored in document_tables are formatted and injected as structured vector chunks in document_chunks. This enables semantic vector search and hybrid search to retrieve exact cell facts, row values, and schema context across all document types.

</domain>

<decisions>
## Implementation Decisions

### Table Representation in Vector Chunks
- **D-01:** Hybrid Representation: Each table chunk begins with a schema header bracket [Table {index} | Page {page} | Columns: {headers}] followed by clean Markdown table syntax (| Col1 | Col2 |\n|---|---|...).
- **D-02:** Standard markdown formatting preserves structural relations between adjacent columns and rows for LLM reasoning.

### Table Partitioning & Large Tables
- **D-03:** Row-batched Partitioning with Header Propagation: Tables exceeding chunk boundaries are split into batches of 25-30 data rows per chunk.
- **D-04:** Every split chunk repeats the markdown table column header (| Col1 | Col2 | + delimiter line) so vector embeddings and LLMs never encounter orphan data cells without column labels.

### Chunk Metadata & Search Attribution
- **D-05:** Dedicated Chunk Metadata: Injected table chunks are flagged in document_chunks.metadata with is_table: true, 	able_index, page, and columns: [...].
- **D-06:** Citation and search interfaces can inspect is_table to render tabular badges or table-specific previews.

### Ingestion Lifecycle & Backfill
- **D-07:** Integrated Ingestion: process_document_background and eingest_document generate both text chunks and table chunks during standard document processing.
- **D-08:** Backfill Helper: Provide a backfill utility/endpoint to generate table chunks for historical documents that already have extracted rows in document_tables.

### Claude's Discretion
- Markdown formatting edge cases (e.g. escaping pipe characters inside cell contents).
- Exact batch threshold (25-30 rows) tuned to fit within embedding context limits (~512-1000 tokens).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Tabular Ingestion & Multi-Modal Foundation
- ackend/app/services/multimodal_service.py — extract_and_store_tables, document_tables schema, and table retrieval helpers
- ackend/app/api/documents.py — Document upload, background processing pipeline, and eingest_document
- ackend/app/services/embedding_service.py — chunk_text and embed_chunks pipeline
- ackend/app/services/retrieval_service.py — Vector and hybrid search over document_chunks

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- document_tables table in Postgres (stores headers, rows, page, table_index, bbox, extractor).
- embed_chunks in pp.services.embedding_service for multi-provider embedding generation.
- _tabular_text_blocks helper in documents.py (Phase 201).

### Established Patterns
- document_chunks table stores chunk text, document_id, user_id, chunk_index, embedding vector, and jsonb metadata.
- All embedding operations resolve user_settings to maintain embedding vector space consistency (EMBED-04).

</code_context>

<specifics>
## Specific Ideas & Requirements

- Requirement TAB-02: Extracted tables (CSV, DOCX, PDF) are injected as structured markdown representations and summaries into document_chunks so semantic vector search retrieves facts located within table cells.
- Traceability seeds: SEED-149, SEED-087, SEED-021, SEED-022.

</specifics>
