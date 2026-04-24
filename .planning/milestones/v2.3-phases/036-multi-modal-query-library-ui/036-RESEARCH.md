# Phase 36: Multi-Modal Query & Library UI — Research

**Researched:** 2026-04-18
**Domain:** LLM tool dispatch, vector embeddings, Supabase table queries, React UI chips
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Image Descriptions in Vector Search**
- D-01: Image descriptions are inserted as rows in `document_chunks` during the Phase 35 ingestion pipeline (inside `extract_and_store_images`, after storing the `document_images` row). No new RPC or migration needed — `match_document_chunks` picks them up automatically.
- D-02: Chunk content format: `[Image p.N]: <description>` (e.g. `[Image p.3]: A bar chart showing Q3 revenue by region.`). DOCX images (page = None) use `[Image]: <description>`.
- D-03: Embeddings use the same `embed_texts()` call used for regular text chunks — no special embedding path.

**query_tables Tool**
- D-04: Tool signature: `document_name` (string, required) + `column_filter` (optional `{column: value}` object) + `page` (optional int). Backend resolves `document_id` via `resolve_document_id()`, then queries `document_tables`, then filters rows server-side where the named column matches the value.
- D-05: Return format: structured JSON per matched table: `{document: filename, page: N|null, table_index: N, headers: [...], rows: [[...]], truncated: bool}`. Multiple matching tables returned as an array.
- D-06: Row cap: 50 rows per table. When a table has more rows, return the first 50 and set `truncated: true`. Consistent with the `read_document` 3k char cap pattern.
- D-07: `query_tables` is added to General Mode only (`get_tools()`) — not Explorer mode. Listed in the General Mode system prompt tool catalog.
- D-08: Tool definition lives in `openai_service.py` alongside all other tool constants. Dispatch logic in the chat router (`threads.py`) following the existing tool dispatch pattern.

**Badge Data Source**
- D-09: Backend aggregates `table_count` and `image_count` from `document_tables` and `document_images` (COUNT GROUP BY document_id) and includes them in the existing GET /documents response. The `Document` Pydantic response model gains two new optional int fields. The frontend `Document` TypeScript interface gains `table_count?: number` and `image_count?: number`.
- D-10: Counts are `0` (or omitted/null) for documents that have no extracted tables/images. The UI only renders badges when count > 0.

**Badge Placement**
- D-11: Badges appear inline in the filename cell, same row as the existing vN version chip. Only shown when count > 0. Format: small muted chips — "3 tables" and "2 imgs" (abbreviated label for space). Reuses the existing `rounded-full bg-primary/10 text-primary px-2 py-0.5 text-xs` chip style already used for vN.

### Claude's Discretion
- Error handling for `query_tables` when document not found, no tables exist, or column_filter matches nothing — return informative JSON error messages consistent with the existing tool error pattern (e.g. `{"error": "No tables found for document 'X'"}`).
- Whether `column_filter` matching is case-insensitive or exact — choose whichever is simpler to implement; exact match is fine as a first pass.

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MODAL-03 | Table data queryable via new query_tables tool | All four deliverables (image chunk insertion, QUERY_TABLES_TOOL constant, tool dispatch, badge counts) directly satisfy this requirement. Image descriptions becoming searchable via vector search is the complementary enablement path. |
</phase_requirements>

---

## Summary

Phase 36 has four tightly-scoped deliverables, all of which extend existing patterns with no new tables or RPCs required. The infrastructure from Phase 35 — `document_tables`, `document_images`, `extract_and_store_images`, `resolve_document_id` — is fully in place and confirmed shipped.

**Image chunk insertion** (D-01 through D-03) is a two-line addition inside `extract_and_store_images` in `multimodal_service.py`. After the `document_images` INSERT, the same function embeds the description string via `embed_texts()` and inserts a row into `document_chunks`. Because `match_document_chunks` is a SECURITY DEFINER RPC that queries all `document_chunks` rows, no RPC change is needed — image-derived chunks surface automatically.

**`query_tables` tool** (D-04 through D-08) follows the exact same pattern as every other tool in this codebase: constant in `openai_service.py`, `elif` branch in `threads.py`, service logic inline or in a new service function. The handler calls `resolve_document_id`, queries `document_tables` with optional server-side column filtering, applies the 50-row cap per table, and returns a JSON array. Error cases (`{"error": "..."}`) follow the established pattern seen in `analyze_document`, `recall`, and others.

**Badge counts on GET /documents** (D-09 through D-10) require a joined aggregate query on the two Phase 35 tables. The existing `list_documents` endpoint in `documents.py` returns raw Supabase rows; it must be extended to COUNT rows in `document_tables` and `document_images` grouped by document_id, then merge those counts before returning. The `DocumentResponse` Pydantic model and the frontend `Document` TypeScript interface each need two new optional integer fields.

**Primary recommendation:** Plan as three sequential tasks — (1) image chunk insertion in `extract_and_store_images`, (2) `QUERY_TABLES_TOOL` constant + dispatch + service logic, (3) badge counts in GET /documents response + frontend `Document` interface + `DocumentList.tsx` chip rendering. Each task is independently testable.

---

## Standard Stack

### Core (all already in use — no new installs)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| supabase-py | existing | Querying `document_tables`, `document_images`, `document_chunks` | Project-standard DB client |
| openai (Python SDK) | existing | `embed_texts()` for image description embeddings | Same call used for all text chunks |
| Pydantic v2 | existing | `DocumentResponse` model extension | Project standard for response models |
| React + Tailwind | existing | Frontend badge chips | Project stack |
| shadcn/ui | existing | Chip styling follows vN pattern | Project UI library |

### No New Dependencies
This phase requires zero new packages. All functionality is built on the existing stack.

---

## Architecture Patterns

### Pattern 1: Tool Constant + Dispatch in threads.py

Every tool in this project follows a three-part structure confirmed by reading `openai_service.py` and `threads.py`:

1. **Constant in `openai_service.py`** — a JSON Schema dict assigned to a module-level name (`QUERY_TABLES_TOOL`).
2. **Added to `get_tools()`** — unconditionally appended (like `REMEMBER_TOOL`) since `query_tables` has no env-flag gate.
3. **Dispatch `elif` in `threads.py`** — at line ~1192 (after `recall`, before fallthrough), an `elif tool_name == "query_tables":` branch invokes the service function and assigns `tool_result`.

The existing `QUERY_DOCUMENTS_TOOL` is the closest analogue for the JSON Schema shape (single required string param, optional object param).

```python
# openai_service.py — pattern from QUERY_DOCUMENTS_TOOL / REMEMBER_TOOL
QUERY_TABLES_TOOL = {
    "type": "function",
    "function": {
        "name": "query_tables",
        "description": (
            "Query structured table data extracted from a document. "
            "Use when the user asks about specific values in a document's tables: "
            "'show me the revenue table from Q3 Report', "
            "'what are the headers in the financial summary table?', "
            "'find rows where Region is APAC'. "
            "Returns table headers and rows. Use column_filter to narrow results to rows "
            "where a column matches a specific value."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "document_name": {
                    "type": "string",
                    "description": "Filename (or partial name) of the document to query tables from.",
                },
                "column_filter": {
                    "type": "object",
                    "description": (
                        "Optional filter: {column_name: value}. Returns only rows where "
                        "the named column exactly matches the value. "
                        "Example: {\"Region\": \"APAC\"}"
                    ),
                    "additionalProperties": {"type": "string"},
                },
                "page": {
                    "type": "integer",
                    "description": "Optional: only return tables from this page number. Omit to return all pages.",
                },
            },
            "required": ["document_name"],
        },
    },
}
```

### Pattern 2: Image Chunk Insertion in extract_and_store_images

The insertion point is confirmed: inside `extract_and_store_images` in `multimodal_service.py`, after `supabase.table("document_images").insert(rows).execute()` at line 287. The pattern mirrors how regular text chunks are inserted during ingestion (`ingest_document` in `documents.py`, lines 522-532).

Key considerations from codebase inspection:
- `embed_texts()` is imported from `openai_service` — already imported in the multimodal context via `app_settings`
- The function signature already receives `app_settings: UserEffectiveSettings` so embedding credentials are available
- `document_chunks` columns: `document_id`, `user_id`, `content`, `chunk_index`, `embedding`
- `chunk_index` must be set; for image chunks it should be offset from the existing chunk count or use a large starting offset (e.g., `10000 + image_index`) to avoid collisions with text chunks. Simplest approach: query `MAX(chunk_index)` for the document and use `max_idx + 1 + image_index`
- Silent exception swallow pattern is already in place — the new embed + insert calls must also be inside the existing `try` block

```python
# Inside extract_and_store_images, after document_images insert:
# D-01/D-02/D-03: embed image descriptions as document_chunks for vector search
if rows:
    try:
        from app.services.openai_service import embed_texts  # noqa: PLC0415
        chunk_rows_for_images = []
        # Get current max chunk_index for this document to avoid collision
        max_idx_result = (
            supabase.table("document_chunks")
            .select("chunk_index")
            .eq("document_id", document_id)
            .order("chunk_index", desc=True)
            .limit(1)
            .execute()
        )
        base_idx = (max_idx_result.data[0]["chunk_index"] + 1) if max_idx_result.data else 0
        descriptions = []
        for i, row in enumerate(rows):
            page = row.get("page")
            desc = row.get("description", "").strip()
            if not desc:
                continue
            content = f"[Image p.{page}]: {desc}" if page is not None else f"[Image]: {desc}"
            descriptions.append((i, content))
        if descriptions:
            texts = [d[1] for d in descriptions]
            embeddings = embed_texts(texts, user_settings=app_settings)
            for (i, content), embedding in zip(descriptions, embeddings):
                chunk_rows_for_images.append({
                    "document_id": document_id,
                    "user_id": user_id,
                    "content": content,
                    "chunk_index": base_idx + i,
                    "embedding": embedding,
                })
            supabase.table("document_chunks").insert(chunk_rows_for_images).execute()
            log.info("Stored %d image chunk(s) for document %s", len(chunk_rows_for_images), document_id)
    except Exception as exc:
        log.warning("Image chunk embedding failed for document %s: %s", document_id, exc)
```

### Pattern 3: Badge Count Aggregation in list_documents

The `list_documents` endpoint (lines 281-317 in `documents.py`) currently queries `documents` only. To add counts, the backend must:

1. Collect `document_ids` from the merged result
2. Run two COUNT GROUP BY queries against `document_tables` and `document_images`
3. Merge counts into each document dict before returning

```python
# After building `merged` list in list_documents:
doc_ids = [d["id"] for d in merged]
if doc_ids:
    table_counts_res = (
        supabase.table("document_tables")
        .select("document_id")
        .in_("document_id", doc_ids)
        .execute()
    )
    image_counts_res = (
        supabase.table("document_images")
        .select("document_id")
        .in_("document_id", doc_ids)
        .execute()
    )
    # Aggregate in Python
    from collections import Counter
    tc = Counter(r["document_id"] for r in (table_counts_res.data or []))
    ic = Counter(r["document_id"] for r in (image_counts_res.data or []))
    for doc in merged:
        doc["table_count"] = tc.get(doc["id"], 0)
        doc["image_count"] = ic.get(doc["id"], 0)
```

Note: Supabase Python client does not natively support `COUNT(*) GROUP BY` in a single RPC-free call. The cleanest approach is fetching all matching `document_id` rows and counting in Python — acceptable for typical library sizes (< 1000 documents). For very large libraries this could be optimized later with an RPC, but that is out of scope for this phase.

### Pattern 4: Frontend Badge Chips

The insertion point is `DocumentList.tsx` lines 353-360 — the `<span>` containing the filename and vN chip:

```tsx
// Current (lines 353-360)
<span className="flex items-center gap-1.5">
  {doc.filename}
  {(doc.version_number ?? 1) > 1 && (
    <span className="rounded-full bg-primary/10 text-primary px-2 py-0.5 text-xs">
      v{doc.version_number}
    </span>
  )}
</span>

// Extended with table/image badges (D-10: only when count > 0)
<span className="flex items-center gap-1.5 flex-wrap">
  {doc.filename}
  {(doc.version_number ?? 1) > 1 && (
    <span className="rounded-full bg-primary/10 text-primary px-2 py-0.5 text-xs">
      v{doc.version_number}
    </span>
  )}
  {(doc.table_count ?? 0) > 0 && (
    <span className="rounded-full bg-primary/10 text-primary px-2 py-0.5 text-xs">
      {doc.table_count} tables
    </span>
  )}
  {(doc.image_count ?? 0) > 0 && (
    <span className="rounded-full bg-primary/10 text-primary px-2 py-0.5 text-xs">
      {doc.image_count} imgs
    </span>
  )}
</span>
```

### Pattern 5: query_tables Service Logic

The dispatch handler in `threads.py` should call a standalone function. Two options:
- **Inline handler** (like `remember`/`recall`) — appropriate given the logic is simple
- **New service function** (like `query_documents` → `sql_service.py`) — cleaner for testing

Given complexity, inline in `threads.py` following the `recall` pattern is acceptable. However, extracting to a `handle_query_tables(args, user_id, supabase)` function in a new or existing service file would make it unit-testable without HTTP setup. Given Phase 35 established `multimodal_service.py`, this function could be added there or as a new `query_tables_service.py`.

```python
# Service function (can be inline in threads.py or extracted)
def handle_query_tables(args: dict, user_id: str, supabase) -> str:
    from app.services.retrieval_service import resolve_document_id  # noqa
    import json

    document_name = args.get("document_name", "").strip()
    column_filter: dict | None = args.get("column_filter") or None
    page_filter: int | None = args.get("page")

    # 1. Resolve document
    doc_id = resolve_document_id(document_name, user_id, supabase)
    if not doc_id:
        return json.dumps({"error": f"Document '{document_name}' not found."})

    # 2. Query document_tables
    query = (
        supabase.table("document_tables")
        .select("page, table_index, headers, rows")
        .eq("document_id", doc_id)
        .eq("user_id", user_id)
    )
    if page_filter is not None:
        query = query.eq("page", page_filter)

    result = query.order("table_index").execute()
    tables = result.data or []

    if not tables:
        return json.dumps({"error": f"No tables found for document '{document_name}'."})

    # 3. Apply column_filter server-side (Python)
    output = []
    for tbl in tables:
        headers: list[str] = tbl.get("headers") or []
        rows: list[list] = tbl.get("rows") or []

        if column_filter:
            matched_rows = []
            for row in rows:
                for col_name, col_val in column_filter.items():
                    try:
                        col_idx = headers.index(col_name)
                        if len(row) > col_idx and str(row[col_idx]) == str(col_val):
                            matched_rows.append(row)
                    except ValueError:
                        pass  # column not found in this table — skip
            rows = matched_rows

        if not rows and column_filter:
            continue  # skip tables that have no matching rows after filter

        truncated = len(rows) > 50
        output.append({
            "document": document_name,
            "page": tbl.get("page"),
            "table_index": tbl["table_index"],
            "headers": headers,
            "rows": rows[:50],
            "truncated": truncated,
        })

    if not output:
        return json.dumps({"error": f"No matching rows found for the given column filter in '{document_name}'."})

    return json.dumps(output)
```

### Anti-Patterns to Avoid

- **Adding chunk_index collisions:** Image chunks must not use `chunk_index` values that overlap with text chunks for the same document. Use `MAX(chunk_index) + 1 + i` as the base.
- **Empty description embedding:** Skip rows where `description` is empty string — embedding an empty string wastes an API call and produces a near-zero vector that pollutes search results.
- **Supabase GROUP BY via client API:** The supabase-py client doesn't support GROUP BY natively. Count in Python after fetching all `document_id` rows.
- **Mutating the Supabase row dict directly:** The `merged` list contains dicts from Supabase. Adding `table_count`/`image_count` keys mutates these dicts — this is fine since they're not shared references, but the pattern must be consistent before returning.
- **Frontend: rendering badges when count is 0:** D-10 explicitly forbids this. Always guard with `(doc.table_count ?? 0) > 0`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Document ID resolution | Custom filename lookup | `resolve_document_id()` in `retrieval_service.py` | Already handles case-insensitive exact + partial match, is_latest=True scoping |
| Text embedding | Custom OpenAI embed call | `embed_texts()` in `openai_service.py` | Handles embedding key/base_url routing, model selection, user_settings override |
| Supabase mock in tests | Custom mock factory | `_make_builder()` from `conftest.py` | Project-standard fluent mock; already wired for all chaining methods |

---

## Common Pitfalls

### Pitfall 1: chunk_index Collision with Text Chunks
**What goes wrong:** Image chunk inserts fail or produce duplicate `chunk_index` values for the same document, corrupting retrieval order.
**Why it happens:** Text chunks use `chunk_index` 0..N-1. If image chunks also start at 0, there are duplicates.
**How to avoid:** Query `MAX(chunk_index)` from `document_chunks` for the document before inserting image chunks. Use `max + 1 + i` as the base index.
**Warning signs:** `search_documents` returns image-derived chunks mixed incoherently with text chunks at wrong positions.

### Pitfall 2: Empty Description Embeddings
**What goes wrong:** `embed_texts([""])` returns a near-zero vector that can pollute similarity results or cause API errors depending on provider.
**Why it happens:** `describe_image` returns `""` on failure (existing behavior in Phase 35). The image chunk insertion step must skip rows where `description` is empty.
**How to avoid:** Filter `descriptions` list to exclude entries where `row.get("description", "").strip()` is falsy before calling `embed_texts`.

### Pitfall 3: list_documents Performance with Large doc_ids List
**What goes wrong:** `.in_("document_id", doc_ids)` with thousands of IDs may hit Supabase query limits.
**Why it happens:** Supabase has URL length limits on PostgREST GET requests; large `in_` lists serialize into the URL.
**How to avoid:** For typical libraries (< 500 documents) this is not a problem. If the project grows, an RPC can be added later. No action needed in Phase 36.
**Warning signs:** 414 Request-URI Too Long errors from Supabase.

### Pitfall 4: Supabase COUNT via .select("count")
**What goes wrong:** Attempting `supabase.table("document_tables").select("count", count="exact")` may return data inconsistently with supabase-py.
**Why it happens:** The `count="exact"` parameter works at the response header level, not in `.data`. It returns `.count` not `.data[0]["count"]`.
**How to avoid:** Use the Python-side counting approach (fetch all `document_id` rows, use `Counter`). This is explicit and testable.

### Pitfall 5: Tool Dispatch Location
**What goes wrong:** Adding `query_tables` dispatch to `documents.py` instead of `threads.py`.
**Why it happens:** The CONTEXT.md canonical refs mention `documents.py` as the tool dispatch location. Inspection of the actual code reveals that tool dispatch lives in `threads.py` (the `event_stream` generator, ~line 730+). The `documents.py` file is the documents REST API router with no tool dispatch.
**How to avoid:** Add the `elif tool_name == "query_tables":` branch in `backend/app/api/threads.py` after the `recall` handler (~line 1220).

### Pitfall 6: System Prompt Update
**What goes wrong:** `query_tables` tool is registered but not described in the system prompt `SYSTEM_PROMPT` constant in `threads.py`, so the agent may not know when to use it.
**Why it happens:** D-07 says it must be listed in the General Mode system prompt tool catalog. The `SYSTEM_PROMPT` string in `threads.py` has a `## Tool selection guide` section that lists each tool.
**How to avoid:** Add a bullet for `query_tables` to the tool catalog section of `SYSTEM_PROMPT`.

### Pitfall 7: `ilike` on document_tables Fails — No filename Column
**What goes wrong:** Trying to filter `document_tables` by `filename` directly fails because `document_tables` only has `document_id`, not `filename`.
**Why it happens:** `resolve_document_id` returns a UUID. That UUID is used to filter `document_tables.document_id`. The `document_name` input to `query_tables` must first be resolved to a UUID via `resolve_document_id`, then used for the DB query.
**How to avoid:** Always call `resolve_document_id(document_name, user_id, supabase)` first.

---

## Code Examples

### QUERY_TABLES_TOOL Constant (analogous to QUERY_DOCUMENTS_TOOL)
```python
# Source: openai_service.py — QUERY_DOCUMENTS_TOOL pattern
QUERY_TABLES_TOOL = {
    "type": "function",
    "function": {
        "name": "query_tables",
        "description": (
            "Query structured tables extracted from a specific document. "
            "Use when the user asks for data from a document's tables: "
            "'show me all rows in the revenue table', "
            "'what are the column headers in the financial summary?', "
            "'find rows where Region is APAC in Q3 Report'. "
            "Returns table headers and matching rows (up to 50 rows per table). "
            "Use column_filter to filter rows where a specific column matches a value."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "document_name": {
                    "type": "string",
                    "description": "Filename (or partial name) of the document to query.",
                },
                "column_filter": {
                    "type": "object",
                    "description": (
                        "Optional row filter: {\"ColumnName\": \"value\"}. "
                        "Returns only rows where that column matches exactly. "
                        "Example: {\"Region\": \"APAC\"}"
                    ),
                    "additionalProperties": {"type": "string"},
                },
                "page": {
                    "type": "integer",
                    "description": "Optional: restrict to tables on this page number only.",
                },
            },
            "required": ["document_name"],
        },
    },
}
```

### DocumentResponse Model Extension
```python
# Source: backend/app/models/document.py — add to DocumentResponse
class DocumentResponse(BaseModel):
    # ... existing fields ...
    table_count: int = 0
    image_count: int = 0
```

### TypeScript Document Interface Extension
```typescript
// Source: frontend/src/types/index.ts — Document interface (line 104)
export interface Document {
  // ... existing fields ...
  table_count?: number
  image_count?: number
}
```

### dispatch in threads.py (after recall handler)
```python
# Source: threads.py — follows recall handler pattern
elif tool_name == "query_tables":
    from app.services.multimodal_service import handle_query_tables  # noqa: PLC0415
    tool_result = handle_query_tables(args, current_user["id"], supabase)
```

---

## Environment Availability

Step 2.6: SKIPPED (no external dependencies identified — all required libraries are already installed and in use from Phase 35).

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest (existing) |
| Config file | `backend/pytest.ini` or none — tests run via `cd backend && python -m pytest` |
| Quick run command | `cd "C:/Vibe Apps/Agentic RAG/backend" && python -m pytest tests/unit/test_multimodal_query.py -x -q` |
| Full suite command | `cd "C:/Vibe Apps/Agentic RAG/backend" && python -m pytest tests/ -x -q` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MODAL-03 | query_tables returns table data for a known document | unit | `pytest tests/unit/test_multimodal_query.py::test_query_tables_returns_data -x` | ❌ Wave 0 |
| MODAL-03 | query_tables returns error JSON when document not found | unit | `pytest tests/unit/test_multimodal_query.py::test_query_tables_document_not_found -x` | ❌ Wave 0 |
| MODAL-03 | query_tables applies column_filter server-side | unit | `pytest tests/unit/test_multimodal_query.py::test_query_tables_column_filter -x` | ❌ Wave 0 |
| MODAL-03 | query_tables caps at 50 rows and sets truncated=true | unit | `pytest tests/unit/test_multimodal_query.py::test_query_tables_row_cap -x` | ❌ Wave 0 |
| MODAL-03 | image chunk insertion embeds description into document_chunks | unit | `pytest tests/unit/test_multimodal_query.py::test_image_chunk_insertion -x` | ❌ Wave 0 |
| MODAL-03 | image chunk insertion skips empty descriptions | unit | `pytest tests/unit/test_multimodal_query.py::test_image_chunk_skips_empty_description -x` | ❌ Wave 0 |
| MODAL-03 | GET /documents includes table_count and image_count | integration | `pytest tests/integration/test_documents.py::test_list_documents_includes_modal_counts -x` | ❌ Wave 0 |
| MODAL-03 | QUERY_TABLES_TOOL is in get_tools() but not get_explorer_tools() | unit | `pytest tests/unit/test_openai_service.py::test_query_tables_in_general_not_explorer -x` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `cd "C:/Vibe Apps/Agentic RAG/backend" && python -m pytest tests/unit/test_multimodal_query.py -x -q`
- **Per wave merge:** `cd "C:/Vibe Apps/Agentic RAG/backend" && python -m pytest tests/ -x -q`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `backend/tests/unit/test_multimodal_query.py` — 6 unit tests covering MODAL-03 (query_tables service, image chunk insertion)
- [ ] `backend/tests/integration/test_documents.py` — add 1 test for modal counts in list_documents response
- [ ] `backend/tests/unit/test_openai_service.py` — add 1 test verifying QUERY_TABLES_TOOL presence/absence

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Text-only document_chunks | Text + image description chunks | Phase 36 (this phase) | Image content becomes searchable via existing match_document_chunks RPC |
| No table query tool | query_tables tool | Phase 36 (this phase) | Agent can answer structured table questions without re-reading full document |

---

## Open Questions

1. **chunk_index collision strategy**
   - What we know: Text chunks use indices 0..N-1 per document. Image chunks must not overlap.
   - What's unclear: Whether querying `MAX(chunk_index)` is safe when the document has no chunks yet (e.g., very short document). Answer: if `.data` is empty, `base_idx = 0` is fine.
   - Recommendation: Use `MAX(chunk_index) + 1` as base, defaulting to 0 if no text chunks exist. Document this in the plan.

2. **`search_vector` (tsvector) column on document_chunks**
   - What we know: The `document_chunks` table has a `search_vector tsvector` column for keyword search (per schema from migration 002 and hybrid search in `retrieval_service.py`).
   - What's unclear: Whether inserting image chunks without a `search_vector` value will cause keyword search failures.
   - Recommendation: Check migration 002 to see if `search_vector` is auto-populated via trigger or must be set on insert. If trigger-based, no action needed. If insert-required, set `search_vector = to_tsvector('english', content)` on image chunk rows. This is LOW confidence and must be verified before the plan is executed.

---

## Project Constraints (from CLAUDE.md)

| Constraint | Applies to Phase 36? | Impact |
|------------|---------------------|--------|
| No LangChain, no LangGraph — raw SDK calls only | Yes | `embed_texts()` already uses raw OpenAI SDK — no change needed |
| Use Pydantic for structured LLM outputs | Partial | `DocumentResponse` model extension uses Pydantic — compliant |
| All tables need Row-Level Security | N/A | No new tables created in this phase |
| Stream chat responses via SSE | Yes | `query_tables` dispatch in `threads.py` follows existing SSE tool dispatch pattern |
| Module 2+ uses stateless completions — store and send chat history yourself | Yes | No change to history management; tool result stored via existing `_persist_message` pattern |
| Python backend must use a venv virtual environment | Yes | No new packages to install |

---

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection — `backend/app/services/multimodal_service.py` — confirmed `extract_and_store_images` structure and insertion point
- Direct codebase inspection — `backend/app/services/openai_service.py` — confirmed `get_tools()`, `get_explorer_tools()`, all tool constant patterns
- Direct codebase inspection — `backend/app/api/threads.py` — confirmed tool dispatch location (NOT documents.py), existing `elif tool_name ==` pattern from line 734
- Direct codebase inspection — `backend/app/api/documents.py` — confirmed `list_documents` structure, `DocumentResponse` model location
- Direct codebase inspection — `backend/supabase/migrations/018_document_tables.sql`, `019_document_images.sql` — confirmed schema: columns, RLS, indexes
- Direct codebase inspection — `frontend/src/components/ingestion/DocumentList.tsx` lines 353-360 — confirmed vN chip pattern and insertion point
- Direct codebase inspection — `frontend/src/types/index.ts` line 104 — confirmed `Document` interface, no `table_count`/`image_count` fields present

### Secondary (MEDIUM confidence)
- CONTEXT.md D-01 through D-11 — all decisions verified against codebase; all constraints are consistent with existing patterns
- Phase 35 migration SQL — schema for `document_tables` (id, document_id, user_id, page, table_index, headers JSONB, rows JSONB) confirmed directly

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; all libraries confirmed in use
- Architecture patterns: HIGH — all patterns verified against actual code; dispatch location pitfall documented
- Pitfalls: HIGH — Pitfall 5 (dispatch location confusion) is critical and verified by reading both files; all others grounded in code inspection
- Test structure: HIGH — existing test patterns in test_multimodal_extraction.py and test_memory_tools.py confirm the mock style

**Research date:** 2026-04-18
**Valid until:** 2026-05-18 (stable codebase; only invalidated by changes to threads.py dispatch, multimodal_service.py, or documents.py)
