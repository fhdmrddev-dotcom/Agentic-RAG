# Phase 36: Multi-Modal Query & Library UI - Context

**Gathered:** 2026-04-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver query capability for extracted multi-modal data (tables and images) and surface extraction counts in the document library UI.

Specifically:
- Embed image descriptions into `document_chunks` so `search_documents` picks them up automatically
- Implement a `query_tables` tool (backend service + tool definition + dispatch) for structured table queries
- Return `table_count` / `image_count` aggregates on the GET /documents response
- Show "N tables / N images" chips inline in the filename cell of the document library

Out of scope: new vector RPC, separate embedding store, image viewer/previews, table editing, ingestion pipeline changes beyond the chunk insertion step.

</domain>

<decisions>
## Implementation Decisions

### Image Descriptions in Vector Search

- **D-01:** Image descriptions are inserted as rows in `document_chunks` during the Phase 35 ingestion pipeline (inside `extract_and_store_images`, after storing the `document_images` row). No new RPC or migration needed — `match_document_chunks` picks them up automatically.
- **D-02:** Chunk content format: `[Image p.N]: <description>` (e.g. `[Image p.3]: A bar chart showing Q3 revenue by region.`). DOCX images (page = None) use `[Image]: <description>`. Makes image-derived content identifiable in citations and grep results.
- **D-03:** Embeddings use the same `embed_texts()` call used for regular text chunks — no special embedding path.

### query_tables Tool

- **D-04:** Tool signature: `document_name` (string, required) + `column_filter` (optional `{column: value}` object) + `page` (optional int). Backend resolves `document_id` via `resolve_document_id()`, then queries `document_tables`, then filters rows server-side where the named column matches the value.
- **D-05:** Return format: structured JSON per matched table: `{document: filename, page: N|null, table_index: N, headers: [...], rows: [[...]], truncated: bool}`. Multiple matching tables returned as an array.
- **D-06:** Row cap: 50 rows per table. When a table has more rows, return the first 50 and set `truncated: true`. Consistent with the `read_document` 3k char cap pattern.
- **D-07:** `query_tables` is added to General Mode only (`get_tools()`) — not Explorer mode. Listed in the General Mode system prompt tool catalog.
- **D-08:** Tool definition lives in `openai_service.py` alongside all other tool constants. Dispatch logic in the chat router (`documents.py`) following the existing tool dispatch pattern.

### Badge Data Source

- **D-09:** Backend aggregates `table_count` and `image_count` from `document_tables` and `document_images` (COUNT GROUP BY document_id) and includes them in the existing GET /documents response. The `Document` Pydantic response model gains two new optional int fields. The frontend `Document` TypeScript interface gains `table_count?: number` and `image_count?: number`.
- **D-10:** Counts are `0` (or omitted/null) for documents that have no extracted tables/images (e.g. plain text). The UI only renders badges when count > 0.

### Badge Placement

- **D-11:** Badges appear inline in the filename cell, same row as the existing vN version chip. Only shown when count > 0. Format: small muted chips — "3 tables" and "2 imgs" (abbreviated label for space). Reuses the existing `rounded-full bg-primary/10 text-primary px-2 py-0.5 text-xs` chip style already used for vN.

### Claude's Discretion

- Error handling for `query_tables` when document not found, no tables exist, or column_filter matches nothing — return informative JSON error messages consistent with the existing tool error pattern (e.g. `{"error": "No tables found for document 'X'"`).
- Whether `column_filter` matching is case-insensitive or exact — choose whichever is simpler to implement; exact match is fine as a first pass.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Multi-Modal Foundation (Phase 35)
- `backend/app/services/multimodal_service.py` — `extract_and_store_images()` is where D-01 image chunk insertion must be added; `extract_and_store_tables()` shows the table schema written to `document_tables`
- `supabase/migrations/` — migrations 018/019 define `document_tables` and `document_images` table schemas (from Phase 35 plans)

### Tool Pattern References
- `backend/app/services/openai_service.py` — all tool constant definitions; `QUERY_DOCUMENTS_TOOL` is the closest analogue for `QUERY_TABLES_TOOL`; `get_tools()` is where query_tables must be added
- `backend/app/api/documents.py` — tool dispatch loop; shows how existing tools are dispatched and how `query_documents` calls `sql_service`

### Retrieval / Search
- `backend/app/services/retrieval_service.py` — `_vector_search()` and `search_documents()` show how `document_chunks` is queried; image chunks will appear here automatically once inserted
- `backend/app/services/embedding_service.py` — `embed_texts()` function to use for embedding image description strings

### Frontend Document Library
- `frontend/src/components/ingestion/DocumentList.tsx` — current document table UI; filename cell with vN chip (lines 353-360) is the insertion point for table/image badges
- `frontend/src/types/index.ts` — `Document` interface (line 104) needs `table_count?: number` and `image_count?: number` added

### Document API
- `backend/app/api/documents.py` — GET /documents endpoint; response model must include aggregate counts

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `resolve_document_id(filename, user_id, supabase)` in `retrieval_service.py` — resolves document name to ID; `query_tables` handler should reuse this directly
- `embed_texts(texts, user_settings)` in `embedding_service.py` — same call used for text chunks; use for image description embeddings
- vN chip pattern in `DocumentList.tsx` lines 354-358 — `rounded-full bg-primary/10 text-primary px-2 py-0.5 text-xs` span; badges reuse this style
- Existing tool dispatch pattern in `documents.py` — `elif tool_name == "query_tables": result = handle_query_tables(...)` following all other tool handlers

### Established Patterns
- Tool constants in `openai_service.py`, service logic in a dedicated service file or inline handler, dispatch in the chat router
- `extract_and_store_*` functions silently swallow exceptions — same pattern for the new chunk insertion step
- `document_chunks` rows include: `document_id`, `user_id`, `content`, `chunk_index`, `embedding` (vector), `search_vector` (tsvector for keyword search)
- Context cap pattern: `read_document` caps at 3k chars with `truncated` flag; `query_tables` caps at 50 rows with `truncated: bool`

### Integration Points
- Phase 35 `ingest_document` in `documents.py` calls `extract_and_store_images` — adding chunk insertion here (after the `document_images` insert) keeps everything in one place
- GET /documents endpoint in `backend/app/api/documents.py` returns the document list — aggregate counts join added here
- `get_tools()` in `openai_service.py` returns General Mode tool list — `QUERY_TABLES_TOOL` added here
- System prompt in `documents.py` (General Mode block) — tool catalog entry added for `query_tables`

</code_context>

<specifics>
## Specific Ideas

- Image chunk content: `[Image p.N]: <description>` for PDFs, `[Image]: <description>` for DOCX (no page info available)
- Document library badge mockup: `Report.pdf  [v2]  [3 tables]  [2 imgs]` — chips only appear when count > 0
- query_tables response example:
  ```json
  [
    {
      "document": "Q3 Report.pdf",
      "page": 2,
      "table_index": 0,
      "headers": ["Region", "Q3 Revenue", "YoY Change"],
      "rows": [["APAC", "$1.2M", "+12%"], ...],
      "truncated": false
    }
  ]
  ```

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 036-multi-modal-query-library-ui*
*Context gathered: 2026-04-18*
