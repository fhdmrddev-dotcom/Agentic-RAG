# Phase 36: Multi-Modal Query & Library UI - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-18
**Phase:** 036-multi-modal-query-library-ui
**Areas discussed:** Image search inclusion, query_tables tool interface, Badge data source, Badge placement

---

## Image Search Inclusion

| Option | Description | Selected |
|--------|-------------|----------|
| Embed as document_chunks | Insert image descriptions as chunks into `document_chunks` during ingestion; `search_documents` picks them up automatically | ✓ |
| Separate embedding on document_images | Add vector column to `document_images`, new RPC to union results | |
| Post-ingestion backfill only | One-time script, no pipeline change | |

**User's choice:** Embed as document_chunks (Recommended)
**Notes:** No new RPC or migration needed.

---

### Image Chunk Content Format

| Option | Description | Selected |
|--------|-------------|----------|
| [Image p.N]: \<description\> | Prefixed with page number; DOCX uses [Image] (no page) | ✓ |
| [Image]: \<description\> | No page number, consistent across formats | |
| Raw description only | No prefix, indistinguishable from text chunks | |

**User's choice:** [Image p.N]: \<description\> (Recommended)

---

## query_tables Tool Interface

### Tool Signature

| Option | Description | Selected |
|--------|-------------|----------|
| document_name + column_filter | Named parameters; backend resolves doc + filters rows | ✓ |
| Raw SQL like query_documents | LLM writes SQL against document_tables | |
| document_name only | Returns all tables, LLM filters in context | |

**User's choice:** document_name + column_filter (Recommended)

---

### Return Format

| Option | Description | Selected |
|--------|-------------|----------|
| Structured JSON with headers + rows | `{document, page, table_index, headers, rows, truncated}` | ✓ |
| Markdown table string | Pre-formatted, less programmatic | |
| Row count + first N rows | Truncates by default | |

**User's choice:** Structured JSON (Recommended)

---

### Row Cap

| Option | Description | Selected |
|--------|-------------|----------|
| Cap at 50 rows per table | Returns first 50, truncated: true flag | ✓ |
| No cap | Return all rows | |
| Cap at 20 rows | More aggressive | |

**User's choice:** 50 rows per table (Recommended)

---

## Badge Data Source

| Option | Description | Selected |
|--------|-------------|----------|
| Add counts to GET /documents response | Backend aggregates counts, one request, always fresh | ✓ |
| Separate modal-stats endpoint | Lazy fetch on expand, N extra requests | |
| Direct Supabase client queries | Frontend queries tables directly | |

**User's choice:** Add counts to GET /documents response (Recommended)

---

## Badge Placement

| Option | Description | Selected |
|--------|-------------|----------|
| Inline in filename cell | Chips next to filename and vN badge, only when count > 0 | ✓ |
| New 'Extractions' column | Dedicated column header | |
| Inside expanded metadata panel | Low discoverability, no layout change | |

**User's choice:** Inline in filename cell (Recommended)
**Notes:** Reuse existing `rounded-full bg-primary/10 text-primary px-2 py-0.5 text-xs` chip style.

---

## Claude's Discretion

- Error handling for query_tables (document not found, no tables, no column match) — informative JSON errors
- column_filter matching case sensitivity — exact match acceptable as first pass

## Deferred Ideas

None.
