---
id: BUG-261014-04
title: A permanently stuck pending document absorbs every re-upload of the same bytes, in every folder
reported: 2026-10-14
surface: Agentic-RAG
severity: major
status: closed
affected_areas: [backend/ingestion, backend/upload, backend/watch-sync]
folded_into: "285"
verified_closed_by: "285 (521bf6491 — 285-LIVE-EVIDENCE.md SC#3 + D-14 heal)"
related_seeds: []
re_open_trigger: "The next phase whose files_modified names backend/app/api/documents.py's upload_document, backend/app/services/ingest_splice.py, or backend/app/db/ingestion_jobs.py, OR the first observed document stuck in 'pending' with no ingestion_jobs row (SELECT d.id FROM documents d LEFT JOIN ingestion_jobs j ON j.document_id = d.id WHERE d.status = 'pending' AND j.id IS NULL AND d.created_at < now() - interval '1 hour' returns any row)."
reproduces_on:
  branch: develop
  commit: 0b077d7fb
  date: 2026-10-14
---

# BUG-261014-04: A permanently stuck pending document absorbs every re-upload of the same bytes, in every folder

Source: Phase 280 code review, `280-REVIEW.md` **WR-04** (deferred by the operator's fix brief, not
fixed in 280). Verified against the code on 2026-10-14 before filing.

## What we observed

Read from the code, not driven live:

1. `/documents/upload` (`documents.py:~668-710`) mints the row `pending`, stores the bytes, then
   enqueues an `ingestion_jobs` row through asyncpg and, on failure, through the service-role client.
   If BOTH fail, the code only logs (`log.error("Failed to insert ingestion_job via supabase: …")`)
   and returns 201. The document stays `pending` with no job.
2. No document-level reaper exists (grep of `backend/app/services` for a stale/stuck `pending`
   document sweep found only the Expert-install claim reaper).
3. Since Phase 280 (D-24), the minter's in-flight leg is folder-agnostic: user + hash +
   `status <> 'failed'` + `is_latest`. So every later upload of the same bytes, in ANY folder, returns
   the dead `pending` row as `already_in_library: true`, and the duplicate arm (`documents.py:624-627`)
   enqueues nothing. Watch syncs link the dead row and never enqueue either.

**Expected:** re-uploading a file whose first ingest never started gets it ingested.
**Actual:** every re-upload reports "already in your Library" and the document never completes.

## Why it matters

The document never becomes searchable and nothing tells the person why. Before 280 a re-upload into a
different folder minted a separate copy that then completed, which was an accidental escape hatch; it
is now closed. Recovery needs a manual reingest that no UI points to.

## Hypothesized cause

The in-flight leg treats any non-failed, latest row as "in flight", without checking that something
is actually going to process it. The enqueue failure branch logs instead of marking the row `failed`.

## Surface classification

`Agentic-RAG` — the app's upload and ingestion pipeline.

## Suggested routing

- **Fold into in-flight phase:** n/a (deferred by decision in the 280 review fix).
- **Defer to future phase / milestone:** the next phase touching the upload handler or the minter.
- **Fix shape (from the review), smallest first:** mark the document `failed` when both enqueue paths
  fail (the error branch already exists and only logs); and/or have the `/upload` duplicate arm
  re-enqueue when the returned document is `pending` with no job; or have the in-flight leg ignore
  `pending` rows with no live `ingestion_jobs` row (or older than a staleness bound).
- **External — note only:** no.

## Workarounds

Use the document's reingest action (`POST /documents/{id}/reingest`) on the stuck row, or delete it
and upload again.

## Reference / evidence links

- `.planning/phases/280-in-once-out-clean/280-REVIEW.md` → WR-04 and its Fix log entry
- `backend/app/api/documents.py` (`upload_document`, the enqueue block and the duplicate arm)
- `backend/app/services/ingest_splice.py` (`mint_document_row`, step 3b, the in-flight leg)

## Closed 2026-10-16 (Phase 285)

Closed by Phase 285 plan 03 (`521bf6491`, FIX-14 / D-12). When both enqueue paths fail and the ingest worker is enabled, `/documents/upload` marks the document `failed` (guarded on `status='pending'`) and answers 201 `status: failed`, so it can no longer absorb a later same-bytes upload. The minter's in-flight leg is byte-unchanged (FIX-02). Migration 209's heal enqueues an existing >1 h stuck row whose bytes exist, and marks one with no bytes failed.

Verified live, RED first. Before the fix: upload 1 `status='pending'`, 0 jobs, and the folder-B upload `already_in_library=True`. After: upload 1 `status='failed'`, then the folder-B upload got a new id with 1 job. The heal was run live in a rolled-back transaction. Evidence: `.planning/phases/285-watch-and-re-upload-close-out/285-LIVE-EVIDENCE.md` § SC#3, § D-14.
