---
id: BUG-261012-01
title: Both watch purge paths delete the document rows but never remove the stored file bytes
reported: 2026-10-12
surface: Agentic-RAG
severity: minor
status: folded   # folded into Phase 280 at discuss 2026-10-14 (280-CONTEXT.md)
affected_areas: [backend/watch, backend/connectors, storage, data-protection]
folded_into: "280"
verified_closed_by: null
related_seeds: [SEED-210, SEED-072]
re_open_trigger: null
reproduces_on:
  branch: develop
  commit: 3ef48e78c
  date: 2026-10-12
---

# BUG-261012-01: Both watch purge paths delete the document rows but never remove the stored file bytes

## What we observed

Found by code reading during Phase 275 plan 02 (the hold guard was added to both doors) and deferred to
275-05 to file, as that plan directed (`275-02-SUMMARY.md:194`). **Not driven live.**

Two doors in `backend/app/api/sources.py` purge a watch's documents:

| Door | Lines | What it deletes |
|---|---|---|
| `DELETE /watches/{watch_id}?purge_documents=true` (`delete_folder_watch`) | `:328-344` | `documents` rows for every watch item (`.table("documents").delete().in_("id", doc_ids)` at `:340`), then the watch |
| `POST /watches/{watch_id}/purge` (`purge_missing_watch_documents`) | `:474-489` | `documents` rows whose watch item is `missing` / `unauthorized` (`:485`), then those `connector_watch_items` rows |

Neither door calls `supabase.storage.from_("documents").remove(...)`. The row delete cascades to chunks,
tables and images, but the uploaded/ingested file stays in the `documents` storage bucket with no row
pointing at it.

For contrast, the Library delete (`backend/app/api/documents.py:1868`, `:1883`) and the Phase 275
disposition confirm (`backend/app/services/retention/disposition.py`) both remove the bytes after the row
delete succeeds.

**Expected:** a purged document leaves nothing behind, as a Library delete does.
**Actual:** the file bytes are orphaned in storage indefinitely.

## Why it matters

- **Data protection.** A purge is the action an admin takes to make content go away. The content
  survives in storage, where no UI, retention policy or audit can see it. A data-subject erasure request
  (SEED-072) answered through a purge would be answered falsely.
- Storage cost grows with every purge, with nothing to reclaim it.
- Severity `minor` because watching ships **off by default** (`WATCH_PROCESS_ENABLED=false`) and no UI
  calls the `?purge_documents=true` variant today (275-UI-SPEC S10). It becomes `major` when a customer
  turns watching on.

## Hypothesized cause

Hypothesis: the purge doors were written in Phase 234 as row operations (VIS-05 / SC#3) and never adopted
the storage-remove step the Library delete already had. Phase 275-02 added the hold guard and removed the
log-and-continue swallow, deliberately without changing what is deleted (its D-32 scope).

## Surface classification

`Agentic-RAG` — this app's watch API and storage. Routable at `/gsd:discuss-phase`.

## Suggested routing

- **Fold into in-flight phase:** n/a (275 is closing; `sources.py` is a FIRING hot file and 275's D-32
  allowed guard calls only).
- **Defer to future phase / milestone:** the next phase that touches `backend/app/api/sources.py` or the
  watch loop, or SEED-210's remainder; must land before `WATCH_PROCESS_ENABLED` defaults on.
- **Plant as seed:** related to SEED-210 (inbound lifecycle) and SEED-072 (data-subject rights).
- **External — note only:** no.

Fix shape (for planning, not decided): collect `file_path` for the ids BEFORE the row delete, remove the
bytes AFTER it succeeds (the 275-02 ordering rule, T-275-12: never remove a byte before the row delete
could be refused by a hold), and pin it with a source fence like
`test_275_delete_paths.py::test_every_storage_remove_in_delete_document_follows_its_row_delete`.

## Workarounds (prompt-side, code-side, or UI-side)

- Delete the documents from the Library instead of purging; that path removes the bytes.
- An operator can list orphaned objects (storage objects whose path no `documents.file_path` references)
  and remove them by hand.

## Reference / evidence links

- `backend/app/api/sources.py:328-344`, `:474-489`
- `.planning/phases/275-retention-legal-hold/275-02-SUMMARY.md:194`, `:210`
- `backend/app/api/documents.py:1868`, `:1883` (the ordering the fix should copy)
