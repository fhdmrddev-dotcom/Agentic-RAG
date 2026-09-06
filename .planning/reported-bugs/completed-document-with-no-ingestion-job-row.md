---
id: BUG-260906-03
title: A completed document can have no ingestion_jobs row, so the job table is not a record of what was ingested
reported: 2026-09-06
surface: Agentic-RAG
severity: minor
status: deferred
affected_areas: [backend/ingestion, connectors/sources, observability]
folded_into: null
verified_closed_by: null
related_seeds: []
re_open_trigger: >
  Phase 235's discuss-phase (2026-09-06) made the choice this report asked for deliberately:
  D-235-06 counts runs from the watch loop's OWN connector_sync_runs rows, never from
  ingestion_jobs. That demotes this from a blocker to an observability debt. RE-OPENS on any
  future retry, resume, audit or cost-attribution feature built on the ingestion_jobs table,
  or on the first report of a document that cannot be traced to how it was ingested.
reproduces_on:
  branch: develop
  commit: da34aa8f7
  date: 2026-09-06
---

# BUG-260906-03: A completed document can have no `ingestion_jobs` row

## What we observed

Five files imported in one batch through the Phase 233 preview→confirm path. All five reached
`status = completed` with chunks. **Three have an `ingestion_jobs` row and two do not.**

Measured on the live database, 2026-09-06:

```
2026-09-05 22:48:00 | Fahed Mrad_CV_Sep_2025.pdf        | completed | jobs=1 chunks=15
2026-09-05 22:48:05 | Project Manager.pdf               | completed | jobs=0 chunks=7
2026-09-05 22:48:28 | TRANSACTION_RECEIPT_20251114…pdf  | completed | jobs=1 chunks=5
2026-09-05 22:48:33 | Fahed Mrad_CV_Aug_2025.pdf        | completed | jobs=1 chunks=16
2026-09-05 22:48:38 | Fahed Mrad_CV_Sep_2024.pdf        | completed | jobs=0 chunks=15
```

`jobs=0 chunks=15` means the document **was** ingested — it just was not ingested by the queue. Two
files in a single user action took a different code path from their three neighbours, and nothing in
the product records which.

## Why it matters

Low user impact today: all five documents are complete, chunked and retrievable. **The content is
correct.** The severity is `minor` for that reason and no other.

What is damaged is **the record**. `ingestion_jobs` is the only durable trace of an ingestion having
happened, and it is now known to be incomplete. That matters immediately for two things:

1. **Phase 235 SC#1** is a per-source run history — *"how many files were added, skipped and
   failed"*. Counting jobs would have undercounted this batch by 40%.
2. **Any future retry, resume, audit or cost attribution** built on the job table inherits the same
   blind spot silently.

⚠ It is also the same shape as `BUG-260906-01` and the four defects of 2026-09-05: **two paths
serving one outcome.** Here the outcome (an ingested document) is achieved by both, so nothing looks
broken — which is why this one is easy to leave alone and worth writing down instead.

## Hypothesized cause

**Hypothesis, not finding.** The import path appears to mint documents and then either enqueue a job
or ingest inline depending on a condition not yet identified — most likely a dedup/`on_conflict`
branch, a size or mime threshold, or a fallback when the queue enqueue raises. The two job-less files
are not obviously distinguishable from their neighbours by size, type or order, so the branch has not
been located and should not be guessed at.

The first diagnostic step is to determine which of `ingest_document` (inline) or
`ingestion_queue_service` produced the chunks for `Project Manager.pdf`, and what made those two
files different.

## Surface classification

`Agentic-RAG` — this app, backend ingestion. Routes normally.

## Suggested routing

- **Fold into in-flight phase:** n/a — Phase 234 is closing.
- **Defer to future phase / milestone:** **Phase 235**, alongside `BUG-260906-02`. That phase has to
  decide what a "run" is and what it counts; this bug says the obvious source of truth is not one.
  ⚠ If 235 chooses to count jobs, this must be fixed first; if it chooses to count documents by
  `source`, this becomes an observability debt rather than a blocker — **that choice is the
  decision, and it should be made deliberately rather than inherited.**
- **Plant as seed:** n/a
- **External — note only:** no

## Workarounds

For counting purposes, query `documents` filtered on `metadata->'source'` rather than
`ingestion_jobs`. Every one of the five files carries a correct `source` object.

## Reference / evidence links

- `backend/app/services/sources/import_service.py` — the import path
- `backend/app/services/ingest_splice.py` — `async_mint_document_row`, the shared mint
- `backend/app/db/ingestion_jobs.py` — `insert_ingestion_job`
- `.planning/phases/234-the-watch-loop-the-library-reads-by-itself/234-VERIFICATION.md` §finding 3
