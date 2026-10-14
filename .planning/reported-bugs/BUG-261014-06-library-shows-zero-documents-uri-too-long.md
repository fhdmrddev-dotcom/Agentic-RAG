---
id: BUG-261014-06
title: Library shows 0 documents (only the chunk/vector tiles) once a user owns ~200+ documents
reported: 2026-10-14
surface: Agentic-RAG
severity: major
status: closed
affected_areas: [backend/api/documents, frontend/library]
folded_into: null
verified_closed_by: "quick fix 2026-10-14 — test_261014_list_documents_batches_in.py + live GET /documents 200 (286 docs) + Library rendered 286 documents / 8,026 chunks"
related_seeds: []
re_open_trigger: "Any other `.in_()` over an unbounded id list (e.g. documents.py's global_folder_ids read) returns 414, or GET /documents 500s again."
reproduces_on:
  branch: develop
  commit: 65a7747f7
  date: 2026-10-14
---

# BUG-261014-06: Library shows 0 documents once a user owns ~200+ documents

## What the operator observed

"why I do not see any document in the library only the chunk count" — every folder read 0, Root read
"No root documents yet", while the VECTORS tile read 8,851 and saved views still counted 76.

## Cause (measured)

- Browser: `GET /documents` → `net::ERR_FAILED` (a 500 carries no CORS header). Direct call: `500`.
- Reproduced the handler's reads with the operator's JWT: own documents OK (286), then
  `document_tables` / `document_images` `.in_("document_id", <286 ids>)` → `APIError 414 "URI too long"`.
- 104 documents were added 2026-10-14 (Phase 280 OneDrive UAT), taking the account from ~182 to 286
  ids — past the URL limit. That is why it appeared today.

## Fix

`list_documents` batches the two count reads at `_ID_BATCH = 100` ids. Live after uvicorn reload:
`GET /documents` 200, 286 rows; Library shows CHUNKS 8,026 across 286 documents, Root 200.
