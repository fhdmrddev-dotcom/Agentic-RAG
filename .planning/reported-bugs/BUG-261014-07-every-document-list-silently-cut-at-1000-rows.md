---
id: BUG-261014-07
title: Every document list is unpaginated and silently cut at the API's 1,000-row cap
reported: 2026-10-14
surface: Agentic-RAG
severity: major
status: closed
affected_areas: [backend/api/documents, backend/services/document_search_service, frontend/library, frontend/pickers]
folded_into: "284"
verified_closed_by: "Phase 284 (2026-10-16) — 284-MEASUREMENTS.md AFTER at 10k and 50k: every reported total equals count(*) on all six surfaces; G-4 B paged a 10,000-document folder to its oldest document in Chrome (284-LIVE-EVIDENCE.md)"
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

## Closed by Phase 284 (2026-10-16)

Measured at 10,000 and 50,000 documents (`284-MEASUREMENTS.md`). BEFORE, 4 of 5 Library surfaces
reported a total that was NOT `count(*)` (Root read 579 of 30,000; Big 193 of 10,000; every picker
downloaded 1,000 of 50,020). AFTER, every reported total equals `count(*)` on all six surfaces at
both sizes. In Chrome, the 10,000-document folder paged to its last page and ended on the database's
oldest document (G-4 B), and a saved view of 8,289 matches did the same (G-4 F). The route inventory
(`test_284_route_inventory.py`), the request recorder (`test_284_request_recorder*.py`) and the
frontend fence (`libraryListFence.test.ts`) were each driven RED against a planted regression.

Load time is flat for a folder page and the summary, but Root and Find page 1 take 2.5x longer at
50k than at 10k (an exact count is linear in N). That is a speed finding, not a silent cut. It is
recorded as `SEED-357`, so this report stays closed.
