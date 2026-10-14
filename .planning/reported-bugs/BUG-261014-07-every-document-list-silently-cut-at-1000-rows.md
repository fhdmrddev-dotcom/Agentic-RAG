---
id: BUG-261014-07
title: Every document list is unpaginated and silently cut at the API's 1,000-row cap
reported: 2026-10-14
surface: Agentic-RAG
severity: major
status: folded
affected_areas: [backend/api/documents, backend/services/document_search_service, frontend/library, frontend/pickers]
folded_into: "284"
verified_closed_by: null
related_seeds: []
re_open_trigger: "Phase 284 closes without SC#1-#3 measured at 10k/50k documents."
reproduces_on:
  branch: develop
  commit: e422066ca
  date: 2026-10-14
---

# BUG-261014-07: Every document list is unpaginated and silently cut at 1,000 rows

Source: the operator's question after `BUG-261014-06` — *"if we have thousands and 10s of
thousands of documents in the production … make sure that this is a sustainable solution not a
batch"*.

## What was measured (2026-10-14)

- The local API caps a response at **1,000 rows with no error**: `document_chunks` read as the
  operator returned **1,000 of 8,851** (`count="exact"`). Supabase's default `max_rows` is 1,000;
  production's setting was not read.
- `GET /documents` loads every latest document in one request with no limit, then the Library
  filters by folder and counts chunks / folder totals **in the browser**. Above 1,000 documents it
  returns 1,000 and says nothing, so the list and every count are quietly wrong.
- Find (`document_search_service.py:573`) loads every match and slices a page in Python.
- 5 screens call `listDocuments()` for the whole library just to fill a picker.
- Production's largest account: **164** latest documents (read via Supabase MCP), so nothing is
  visibly broken there today.

## Behaviour by size (same code locally and in production)

| Latest documents | Result |
|---|---|
| ≤ ~200 | works |
| ~200-1,000 | 414, Library shows 0 (`BUG-261014-06`; batching stopgap on develop only) |
| > 1,000 | no error, only 1,000 shown, counts wrong |
| 10,000+ | the same cut-off, plus the full download and in-browser counting on every load |

## Routing

Folded into **Phase 284 — Library at Scale** (FIX-11): server-paged list, server-side
aggregates, Find paged in SQL, server-search pickers, measured at 10k / 50k seeded documents.
