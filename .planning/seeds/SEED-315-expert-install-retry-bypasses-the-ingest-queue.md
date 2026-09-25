---
seed_id: SEED-315
title: An Expert install Retry never reaches the ingest queue — its storage PUT 409s and it falls back to a direct splice
created: 2026-09-24
surface: Agentic-RAG
status: planted
partial: false
status_note:
trigger_when: Any phase touching backend/app/services/sources/import_service.py _enqueue_or_splice, the Expert installer's re-drive, or ingest retries/lease recovery.
trigger_paths: ["backend/app/services/sources/import_service.py", "backend/app/services/expert_install_service.py"]
trigger_surfaces: []
migration_note:
relates_to: ["266", "266-03 SUMMARY 'Notes for 266-05'", "BUG-260905-04", "266-REVIEW WR-01", "266-REVIEW WR-06"]
folded_into: null
renumbered_from: null
renumbered_because: null
---

# SEED-315: an Expert install Retry bypasses the ingest queue

## The finding

266-03 predicted it and 266-05 measured it (`evidence/07-retry-route-probe.txt`,
`evidence/08-retry-fixed-inprocess.txt`). A failed corpus document is re-driven in place with its
existing `file_path`. `_enqueue_or_splice` (`import_service.py`) PUTs the bytes to that key with no
`upsert`, storage answers `409 Duplicate — The resource already exists`, and the function falls back to
`background_tasks.add_task(splice_document, …)`. Measured: **no new `ingestion_jobs` row** after the
Retry (the only job row is the original install's).

The document still completes (3/3 chunks embedded, measured after the 266-05 fix), so this is not a
stranded document. But the Retry runs on the legacy branch BUG-260905-04 retired as the main path: no
queue retries, no lease recovery, no concurrency cap, and the Ingestion tab has no job to show.

A second defect on the same branch WAS fixed in 266-05 (`fix(266-05)`): the re-drive handed the asyncpg
row's `UUID` id to `splice_document`, which failed with `Object of type UUID is not JSON serializable`
and left the document `failed` with its chunks already deleted.

## Why it matters

A Retry is the only recovery the install UI offers (D-266-03). It is exercised exactly when ingestion
already failed once, which is when queue retries and lease recovery matter most.

## When to surface

Any phase touching `_enqueue_or_splice` in `import_service.py` or the installer's `_redrive_failed`; any
work on ingest retries or the Ingestion tab's job accounting.

## Scope estimate

Small. Pass `upsert: "true"` in the storage `file_options` for a re-drive (or delete the object first),
so the job is enqueued; pin it with a test that a re-drive creates a job row. Phase 266 did not edit
`import_service.py`, by plan.

## Folded in at the 266 review triage (2026-09-25): WR-06 and WR-01

**WR-06 is this seed** — the code review found the same storage-PUT fallback independently. Fix
options it named: delete the old object or upload with `upsert=True` before `_enqueue_or_splice`, or
add a re-enqueue helper that inserts the ingestion job without re-uploading (the bytes are already in
storage).

**WR-01 rides with it, because the two compound.** `derive_install_state` bounds staleness only while
the install row reads `installing`. Once it reads `installed`, any corpus document not yet
`completed`/`failed` keeps the Expert on "Installing…" with no time limit. The UI then has no control
(`installing` maps to a status line), `inviteGate` blocks invite, and the catalog polls every 4 s while
open. A document stranded by a dead worker, a lost BackgroundTask, or a Retry on this non-durable path
never leaves that state. Fix named by the review: select `updated_at` in
`list_install_corpus_documents`; derive `failed` / `STALE_INSTALL` for an in-flight corpus document
older than N minutes, and let the retry path re-drive a stale `pending`/`processing` document as it
does a `failed` one.

⛔ Fix both before the first real customer install: today a Retry is exactly the path most likely to
strand a document, and a stranded document is exactly the state with no way out.

