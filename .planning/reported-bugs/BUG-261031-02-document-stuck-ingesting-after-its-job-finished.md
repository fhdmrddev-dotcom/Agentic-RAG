---
id: BUG-261031-02
title: A document shows "ingesting" forever after its ingestion job finished
reported: 2026-10-31
surface: Agentic-RAG
severity: minor
status: closed
affected_areas: [backend/ingestion]
folded_into: null
verified_closed_by: "quick 2026-10-31"
related_seeds: []
re_open_trigger: null
reproduces_on:
  branch: develop
  commit: 7ef6ea349
  date: 2026-10-31
---

# BUG-261031-02: A document shows "ingesting" forever after its ingestion job finished

## What we observed

The operator: *"why i always see this file ACME_MSA_2026.md ingesting and never finishes"*.

Measured on the local DB, 2026-10-31. Document `1417fc12-a581-4068-adcc-ddbc1e3a848a`
(`ACME_MSA_2026.md`, org `22f9c615`, folder "Client ACME", uploaded 2026-09-28 19:34 UTC):

- `documents.status = 'processing'`, `ingestion_step = 'embedding'`, for 33 days
- its one chunk exists **with an embedding**; `metadata` and `full_markdown` are saved
- its `ingestion_jobs` row reads `status='completed'`, `retry_count=0`, no error

It was the only stuck document locally. Production (read-only query, same day): **no** document in
`processing`/`pending` older than an hour.

## Why it matters

The library and the ingestion strip show the file as ingesting forever, while it is in fact fully
searchable. Nothing ever corrects it, because `reclaim_stale_ingestion_claims` reads **jobs** only, and
this job was finished.

## Hypothesized cause

**Hypothesis, not a finding** — no backend logs from 2026-09-28 survive. `metadata` is written only by
the same `UPDATE` that sets `status='completed'` (`api/documents.py`, end of `ingest_document`), so that
write ran; something later wrote `status='processing'` back. The likeliest writer is a second, overlapping
ingest of the same row (`documents.py` / `ingest_splice.py` both write `processing` at their start).

## Fix (2026-10-31)

- The row was set to `completed` on the local DB (operator approved).
- `reconcile_finished_job_documents` (`backend/app/db/ingestion_jobs.py`) runs beside the stale-claim
  sweep every 60 s in `IngestionQueueService.tick`. A document in `processing` whose job finished more
  than 10 minutes ago, with no job still in flight, becomes `completed` when chunks exist and `failed`
  with a sentence when none do.
- `backend/tests/unit/test_bug_261031_02_finished_job_sweep.py` — 9 tests; the grace window, the
  in-flight-job guard and the no-chunk arm were each driven RED by breaking them.

The root cause (the late `processing` write) is NOT fixed; the sweep makes it self-heal within ~10 minutes.

## Surface classification

`Agentic-RAG` — this app's ingestion queue.
