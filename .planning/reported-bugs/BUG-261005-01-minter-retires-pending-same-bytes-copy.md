---
id: BUG-261005-01
title: The shared document minter retires a still-indexing copy of the same bytes, then 409s — the only copy drops out of the Library and search
reported: 2026-10-05
surface: Agentic-RAG
severity: major
status: open
affected_areas: [backend/ingestion, documents, library, search]
folded_into: null
verified_closed_by: null
related_seeds: [SEED-247]
re_open_trigger: null
reproduces_on:
  branch: develop
  commit: 237c3f87a
  date: 2026-10-05
---

# BUG-261005-01: The minter retires a still-indexing copy of the same bytes

## What we observed

Found by the Phase 274 code review (`.planning/phases/274-thread-scoped-attachments/274-REVIEW.md`, CR-02), traced through
the code, not yet driven live on this path.

`async_mint_document_row` (`backend/app/services/ingest_splice.py`) checks for a duplicate only among **completed** documents.
When the same bytes arrive a second time while the first copy is still `pending`/`processing`:

1. the duplicate check misses the in-flight first copy;
2. the versioning step retires that copy (`is_latest = false`) in a separate statement;
3. the insert then hits the dedup unique index (23505).

On `POST /documents/upload` the caller gets a 409, but the first copy has already been retired, so it drops out of
`GET /documents` and out of search. Nothing in the Library still points at the file.

## Why it matters

Uploading a file twice in quick succession (a double-click, two tabs, a retry after a slow response) can silently remove the
only Library copy from search. It looks like a successful upload followed by the document disappearing.

## Hypothesized cause

The retire-then-insert sequence is not atomic, and the duplicate check's status filter is narrower than the unique index it
races against.

## Scope note

Phase 274's Save-to-Library route guards its own door at the boundary (it links an in-flight same-bytes copy instead of
minting — 274-REVIEW.md fix log). The Library upload door and every other minter caller still go through the shared path.

## Related, unverified

CR-01 in the same review: the minter's folder check compares only `user_id`, never the folder's org. Phase 274 guards the promote route
(D-29). Whether `POST /documents/upload` lets a two-org user mint into another org's folder is **not yet measured** — drive it
before filing it.
