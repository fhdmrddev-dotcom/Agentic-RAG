---
id: BUG-260517-01
title: /reextract orphan chunks survive subsequent /reingest (regression of BUG-260516-04 pattern on a different code path)
reported: 2026-05-17
surface: Agentic-RAG
severity: major
status: open
affected_areas: [backend/ingestion, backend/api/documents, RAG/retrieval, frontend/documents-list]
folded_into: null
related_seeds: []
re_open_trigger: null
reproduces_on:
  branch: v2.5-dev
  commit: d29f068
  date: 2026-05-17
---

# BUG-260517-01: /reextract orphan chunks survive subsequent /reingest

## What we observed

During Phase 072 Plan 03 UAT, the operator's DOCX
(`3bf355d6-d4e1-416b-b067-9a63dd821945`, "Fahed Mrad Chapters 1 to 4.docx")
ended up with three distinct chunk batches in `document_chunks` after a
sequence of operations:

| Batch created_at | Row count | Source |
|---|---|---|
| `2026-05-16T20:59:19` | 404 | Orchestrator's full `/reextract` (under simulated LLM disconnect) — **never cleaned up** |
| `2026-05-16T21:15:52` | 402 | Operator's manual UI Reingest click at ~21:17 — text chunks |
| `2026-05-16T21:17:18` | 58 | Same Reingest — image-description chunks (1 per image) |
| **Total in DB** | **864** | |

**`documents.chunk_count = 402`** (UI source-of-truth — reads this column).
**Actual `document_chunks` row count = 864.** UI is undercounting by 462.

The PDF on the same document (different doc_id `517a2827-90be-4d19-b6f9-aa6be36a32b6`)
is consistent (441 text + 67 image = 508 actual, `chunk_count=441` text-only) — only the
DOCX exhibits the orphan-chunk pattern. The PDF was last touched by a clean
ingest at 20:46:45 and not subjected to the `/reextract → /reingest` sequence.

## Why it matters

- **RAG retrieval returns duplicates** — the 404 orphan chunks contain stale or
  partial text content that vector search now retrieves alongside the fresh 402+58.
  Reduces answer quality and inflates context window usage on every query.
- **UI lies** — `documents.chunk_count = 402` doesn't reflect what's actually
  in the chunk store. Operators making capacity / retrieval decisions based on
  the dashboard are working from stale numbers.
- **Storage / embedding cost waste** — 462 extra rows, each with a 1536-dim
  embedding, occupying disk and contributing to embedding-API-call cost on the
  prior ingestion.
- **Confidence regression** — Phase 071.4 was supposed to have closed
  BUG-260516-04 (`/reingest` chunk accumulation). This finding suggests either
  the fix didn't cover the `/reextract → /reingest` sequence, or `/reingest`'s
  cascade-delete doesn't catch chunks created by a sibling operation.

## Hypothesized cause

Three possibilities, listed in order of plausibility:

1. **`/reingest`'s delete-cascade scopes by something other than `document_id`** — e.g.,
   filters on `created_at` window, `version_number`, or `is_latest`, and the orphan
   chunks from a prior `/reextract` are outside that window. Plan 071.4's fix may
   have been correct for the `/reingest → /reingest` race (which was BUG-260516-04's
   reported repro) but the `/reextract → /reingest` ordering isn't covered.

2. **`/reextract`'s chunk-creation path doesn't update `documents.chunk_count`** — so
   the count drifts immediately after every `/reextract`, and a subsequent `/reingest`
   replaces only what `chunk_count` claims to exist. The orchestrator's `/reextract`
   produced 404 chunks but the `chunk_count` column was never updated to reflect them;
   the `/reingest` then "replaced" the 0 chunks it thought existed.

3. **Race between Plan 03's full `/reextract` background task and the operator's
   subsequent UI Reingest click** — the orchestrator's `/reextract` returned 202 in 3s,
   but the actual chunk-write happened later in a BackgroundTask. If the operator
   clicked Reingest before that BackgroundTask had committed its writes, `/reingest`'s
   cascade would have seen "no chunks to delete" and proceeded to add new ones —
   then the BackgroundTask committed its 404 chunks AFTER the cascade had already
   run, leaving them stranded. (Tested timing: orchestrator's /reextract finished
   ~20:59:19 per the chunk timestamp; operator's Reingest fired at 21:17 — ~18 minutes
   later, so this race is UNLIKELY unless the BackgroundTask was somehow re-queued.)

(1) is the most likely. Phase 072.1 audit will resolve.

## Surface classification

**Agentic-RAG** — this is a backend ingestion bug in `backend/app/api/documents.py`
(the `/reingest` and `/reextract` route handlers + their cascade-delete steps).
Cross-checked at `/gsd:plan-phase` for Phase 072.1; will be cross-checked at
`/gsd:complete-milestone v2.6` to confirm closure.

## Suggested routing

- **Fold into in-flight phase:** Phase 072.1 (gap-closure phase being created
  from Phase 072 VERIFICATION.md). Bundle with the Plan 03 dispatcher fix
  (Gap 2) since both touch the `/reextract` surface area and benefit from
  shared integration test infrastructure.
- **Defer to future phase / milestone:** n/a
- **Plant as seed:** n/a
- **External — note only:** no

## Workarounds (prompt-side, code-side, or UI-side)

- **Manual cleanup:** delete the orphan chunk batch directly:
  ```sql
  DELETE FROM document_chunks
  WHERE document_id = '3bf355d6-d4e1-416b-b067-9a63dd821945'
    AND created_at >= '2026-05-16T20:59:19'
    AND created_at <  '2026-05-16T20:59:20';
  ```
  Or for any doc with the pattern: `DELETE FROM document_chunks WHERE document_id=? AND id NOT IN (newest batch by created_at)`.
- **Avoidance:** until Phase 072.1 fix lands, avoid the `/reextract → /reingest`
  sequence on the same doc. Use either operation alone; if both are needed, run
  the manual cleanup SQL between them.
- **UI-side:** the dashboard count is unreliable after `/reextract`; run the
  `count(*) FROM document_chunks` SQL to get the true count.

## Reference / evidence links

- Surfaced during Phase 072 Plan 03 UAT — see `.planning/phases/072-multimodal-lift-docx-completeness/072-HUMAN-UAT.md` Gap 3
- Plan 03 VERIFICATION: `.planning/phases/072-multimodal-lift-docx-completeness/072-VERIFICATION.md` § Anti-Patterns + Gap 3
- Related closed bug: `.planning/reported-bugs/reingest-endpoint-does-not-delete-prior-tables-and-images.md` (BUG-260516-04 — closed in Phase 071.4 for the `/reingest → /reingest` repro)
- Forensic timestamps from operator's DOCX captured in UAT scoreboard
