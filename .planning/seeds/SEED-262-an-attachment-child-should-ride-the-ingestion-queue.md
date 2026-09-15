---
seed_id: SEED-262
title: An attachment child is minted and ingested INLINE, beside the queue rather than on it — six two-paths disagreements have now been fixed one at a time instead of removing the second path
created: 2026-09-09
planted_during: Phase 240 (SRC-05), during UAT row M-2 — the sixth disagreement was found live
status: planted
priority: high
surface: Agentic-RAG
relates_to:
  - `backend/app/services/email_attachments.py` — mints the child and calls `ingest_document` directly
  - `backend/app/services/ingest_splice.py` — `splice_document`, the queue pipeline the child bypasses
  - `backend/app/services/ingestion_queue_service.py` — retries, backoff, checkpointing the child never gets
  - SEED-261 — the reporting half of the same shape
trigger_when: >
  A SEVENTH disagreement between the two ingest paths is found, or any phase that touches
  `email_attachments.py`, `ingest_splice.py` or the ingestion queue. Fires immediately if an
  attachment is reported as arriving with something the parent got and it did not.
trigger_paths:
  - "**/email_attachments.py"
  - "**/ingest_splice.py"
---

## The pattern, stated once

`ingest_splice.py`'s own comments narrate the first three; Phase 240 added three more in a
single day. **Every one is the same shape**: the queue pipeline does something, and the second,
inline path does not.

| # | What the second path missed | Found by |
|---|---|---|
| 1 | metadata enrichment (BUG-260905-06) | going looking |
| 2 | the empty-chunk refusal | going looking |
| 3 | the Phase 234 provenance carry | going looking |
| 4 | the attachment loop existed on ONE path only | Phase 240 `grep` |
| 5 | a transient failure is retried | the operator's UAT attachment |
| 6 | PDF/DOCX go to the extraction service, not `extract_text` | the operator's UAT attachment |

⭐ **#4, #5 and #6 were all found in one day, and two of them by ONE email.** That rate is the
argument: the disagreements are not rare accidents being cleaned up, they are the expected
output of maintaining two pipelines, and fixing them one at a time will not stop producing them.

## What the child is missing today, structurally

It is minted by `mint_document_row` and then handed straight to the legacy `ingest_document`.
So it never gets: the queue's retry and exponential backoff, checkpointed resumption, stage
progress, the circuit breaker, or any of the `splice_document` steps that get added later. **Each
of those is a future disagreement that nobody has hit yet.**

## The shape of an answer

Enqueue the attachment child as an ingestion job instead of ingesting it inline — the parent is
already complete at that point, and the loop already runs after chunking precisely so a child is
never hung off a failed parent.

⚠ **Two things to check before doing it**, both real:

1. **The manifest is written from the loop's return value.** Enqueuing makes the outcome
   asynchronous, so `status: "completed"` could no longer be claimed at that moment — it would
   have to say `queued`, which is more honest anyway and is what SEED-261 needs a reader for.
2. **Depth.** `MAX_MAIL_NESTING_DEPTH` is enforced by an argument passed down the inline call.
   A queued child re-enters the pipeline from the top, so the depth has to ride on the JOB or
   the nesting guard (TM-240-09) silently stops holding.
