---
id: BUG-261014-03
title: A watch purge deletes the rows AND bytes of a hand-uploaded document the watch only dedup-linked to
reported: 2026-10-14
surface: Agentic-RAG
severity: major
status: folded
affected_areas: [backend/connectors, backend/watch-sync, backend/ingestion, backend/retention]
folded_into: "285"
verified_closed_by: null
related_seeds: []
re_open_trigger: "The next phase whose files_modified names backend/app/api/sources.py, backend/app/services/document_purge.py or backend/app/services/watch_service.py, OR the next phase that changes the minter's dedup legs (ingest_splice.mint_document_row). Whichever comes first must fold this or explicitly re-defer it."
reproduces_on:
  branch: develop
  commit: 0b077d7fb
  date: 2026-10-14
---

# BUG-261014-03: A watch purge deletes the rows AND bytes of a hand-uploaded document the watch only dedup-linked to

Source: Phase 280 code review, `280-REVIEW.md` **WR-03** (deferred by the operator's fix brief, not
fixed in 280). Verified against the code on 2026-10-14 before filing.

## What we observed

Read from the code, not driven live:

1. `watch_service.py:359-372`, the new-file arm: when the minter answers `is_duplicate=True`, the watch
   item is written with `document_id = mint_res.document["id"]` ("Duplicate in folder: link into watch
   items"). That id is the EXISTING document, which the watch did not mint.
2. Both purge doors pass every linked `document_id` to `document_purge.purge_documents`:
   - `DELETE /sources/watches/{id}?purge_documents=true` (`sources.py:331-341`);
   - `POST /sources/watches/{id}/purge` (`sources.py:469-481`).
3. `purge_documents` deletes those rows and, since Phase 280 (DEBT-10), removes their stored bytes.

So: upload `contract.pdf` by hand, then create a watch on a cloud folder that holds the same bytes.
The watch links its item to the hand-uploaded document. Purging the watch's documents deletes the
hand-uploaded document and its file.

**Expected:** "purge this watch's documents" removes only what the watch brought in.
**Actual:** it also removes a document the person uploaded themselves, row and bytes.

## Why it matters

Data loss of a document the person never connected to the watch, triggered by a control that reads as
scoped to the watch. Two Phase 280 changes widened it:

- **D-24** made the minter's in-flight leg folder-agnostic, so a watch syncing the same bytes as a
  hand upload still in flight in ANOTHER folder now links to that upload (before 280 it minted its own
  copy);
- **DEBT-10** made both purge doors remove bytes, so the loss now includes the stored file.

The class pre-dates 280 for COMPLETED duplicates (the completed dedup leg was already folder-agnostic).

## Hypothesized cause

The watch item's `document_id` records "the document these bytes resolve to", while the purge doors
read it as "the document this watch minted". No column distinguishes the two.

## Surface classification

`Agentic-RAG` — the app's own watch sync and purge endpoints.

## Suggested routing

- **Fold into in-flight phase:** n/a (280 is repair-only and this was deferred by decision).
- **Defer to future phase / milestone:** the next phase touching `sources.py` / `document_purge.py` /
  `watch_service.py` (see `re_open_trigger`).
- **Fix shape (from the review):** restrict the purge set to documents the watch actually minted, e.g.
  filter `doc_ids` to rows whose `source_connection_id` equals the watch's connection, and skip any
  document another watch item or a manual provenance still references. Pin it with a unit case: a hand
  upload linked as a duplicate survives the purge, with its bytes.
- **External — note only:** no.

## Workarounds

Do not use "purge documents" on a watch whose folder holds files you also uploaded by hand. Deleting
the watch without `purge_documents=true` leaves every document in place.

## Reference / evidence links

- `.planning/phases/280-in-once-out-clean/280-REVIEW.md` → WR-03 and its Fix log entry
- `backend/app/services/watch_service.py:359-372`
- `backend/app/api/sources.py:331-341`, `:469-481`
- `backend/app/services/document_purge.py` (`purge_documents`)
