---
phase: 202-table-chunks-retrieval-injection-and-semantic-search
plan: 01
subsystem: multimodal-retrieval
tags: [TAB-02, SEED-149, SEED-087, SEED-021, SEED-022, backend, multimodal, tables, chunking, vector-search, embeddings]

requires:
  - phase: 201-csv-and-structured-tabular-ingestion
    provides: extract_csv_tables, extract_excel_tables, document_tables population
  - phase: 035-multimodal-extraction
    provides: extract_and_store_tables, extract_and_store_images
  - phase: 111.1-metadata-enrichment
    provides: EMBED-04 user_settings propagation in embed_texts

provides:
  - format_table_markdown_chunks() with hybrid schema headers and 25-row partitioning
  - embed_and_store_table_chunks() with chunk_index offsetting, org_id propagation, embedding model tagging
  - backfill_document_table_chunks() helper for indexing historical tables
  - Automatic table chunks injection inside extract_and_store_tables()

affects:
  - match_document_chunks / vector search — now retrieves exact cell facts from formatted table markdown
  - hybrid search — FTS and vector search index table schema and row data
  - document_chunks table — contains dedicated table chunks offset from text chunks

tech-stack:
  added: []
  patterns:
    - hybrid-table-chunking: schema header [Table N | Page P | Columns: ...] followed by clean Markdown table syntax
    - header-propagating-batching: tables >25 rows split into chunks with repeated column header line on every chunk
    - multimodal-chunk-offsetting: non-text chunks (tables, images) query max(chunk_index) + 1 to avoid key collisions

key-files:
  created:
    - backend/tests/unit/test_table_chunks_injection.py
  modified:
    - backend/app/services/multimodal_service.py
    - backend/tests/unit/test_multimodal_extraction.py

key-decisions:
  - "TABLE_CHUNK_MAX_ROWS = 25: balances dense table context against embedding token budget (~512-1000 tokens)"
  - "Markdown tables with spaces (| --- | --- |) used as standard clean syntax for LLM synthesis"
  - "Table cell sanitization: replace raw newlines with spaces and escape unescaped pipe characters"
  - "Offset chunk_index from max(chunk_index) on document_chunks to maintain sequential index order"
  - "org_id, embedding_model, and embedding_dimensions propagated to every table chunk row for tenancy and vector alignment"

patterns-established:
  - "format_table_markdown_chunks: standard converter from structured table dict to list of Markdown chunk strings"
  - "backfill_document_table_chunks: safe idempotency check via '[Table %' prefix before backfilling"

requirements-completed: [TAB-02]

duration: 15min
completed: 2026-08-24
---

# Phase 202: Table Chunks Retrieval Injection & Semantic Search — Plan 01 Summary

**Extracted tables from PDF, DOCX, CSV, and Excel are now formatted as structured Markdown chunks with schema headers and injected with embeddings into `document_chunks` so semantic and hybrid search can retrieve cell facts directly.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-08-24T07:29Z
- **Completed:** 2026-08-24T07:33Z
- **Tasks:** 4
- **Files modified:** 2 (+ 1 created)

## Accomplishments

- `format_table_markdown_chunks()`: Converts table dicts into hybrid schema headers `[Table N | Page P | Columns: ...]` and standard Markdown tables. Large tables (>25 rows) are partitioned into batches with column headers repeated on every split chunk.
- `embed_and_store_table_chunks()`: Offsets `chunk_index` from `max(chunk_index) + 1`, embeds chunk texts using active `user_settings` (`EMBED-04`), tags rows with `embedding_model`, `embedding_dimensions`, and `org_id`, and inserts into `document_chunks`.
- `backfill_document_table_chunks()`: Helper function to generate table chunks for documents that already have extracted rows in `document_tables`.
- Integrated directly into `extract_and_store_tables()` for seamless execution during upload and reingest.
- 46 unit tests passing with 0 failures across table chunk injection, multimodal extraction, and tabular text extraction suites.

## Task Commits

1. **Tasks 1-4 (Implementation & Tests)** — `bbe73a91` (`feat(202-01): table chunks retrieval injection & semantic search (TAB-02)`)

## Files Created/Modified

- `backend/app/services/multimodal_service.py` — Added `TABLE_CHUNK_MAX_ROWS`, `_sanitize_markdown_cell`, `format_table_markdown_chunks`, `embed_and_store_table_chunks`, `backfill_document_table_chunks`; wired into `extract_and_store_tables`
- `backend/tests/unit/test_table_chunks_injection.py` — New: 7 unit tests for table chunk formatting, partitioning, sanitization, embedding offsets, extraction hook, and backfill
- `backend/tests/unit/test_multimodal_extraction.py` — Updated mock assertions to accommodate subsequent table chunk insert calls

## Decisions Made

- `TABLE_CHUNK_MAX_ROWS = 25`: Prevents embedding token overflow for large tables while ensuring each chunk contains sufficient row context.
- Cell sanitization (`\n` → space, `|` → `\|`): Ensures malformed cell contents cannot break the markdown table structure.
- `org_id` and embedding model propagation: Ensures multi-tenancy RLS (`TEN-04`) and vector space consistency (`EMBED-04` / `D-10`) are preserved.

## Deviations from Plan

None — plan executed exactly as written.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `TAB-02` is completely satisfied; vector search and hybrid search now index table cells across all document types.
- Ready for **Phase 203: Outlook (`.msg`) & Email (`.eml`) Ingestion Pipeline** (`EMML-01`, `EML-02`).

---
*Phase: 202-table-chunks-retrieval-injection-and-semantic-search*
*Completed: 2026-08-24*
