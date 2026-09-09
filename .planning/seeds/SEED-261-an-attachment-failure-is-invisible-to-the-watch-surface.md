---
seed_id: SEED-261
title: An attachment that fails to ingest is invisible to every watch surface — it is in no run's count_errors and is not a watch item, so the only record is a JSON field inside its parent document
created: 2026-09-09
planted_during: Phase 240 (SRC-05), during UAT row M-2 — found by driving the operator's real Gmail watch
status: planted
priority: medium
surface: Agentic-RAG
relates_to:
  - `backend/app/services/email_attachments.py` — writes the honest per-attachment manifest entry
  - `backend/app/services/watch_service.py` — closes its run BEFORE any attachment is touched
  - `frontend/src/components/sources/WatchedFoldersSection.tsx` — reads `connector_watch_items`
  - `frontend/src/components/sources/RunHistoryList.tsx` — reads `connector_sync_runs`
  - SEED-254 — per-run attribution for file states; the same missing writer, one level up
trigger_when: >
  The next phase that touches watch reporting, `connector_watch_items`, or the Watched Folders
  surface. Also fires immediately if a person reports "the email arrived but its attachment did
  not" and nothing in the UI can tell them why.
---

## The measurement

The operator emailed themselves `pgmp exam content outline.pdf` on 2026-09-09 and pressed
**Sync now**. From the backend log, in order:

| Time | Event |
|---|---|
| `18:48:25.746` | `Watch … sync complete: 1 new, 0 modified, 0 renamed, 0 missing, 0 restored, **0 errors**` |
| `18:48:34.685` | the attachment's document row is created |
| `18:48:34.705` | the `attached_to` relationship is created |
| `18:48:54.715` | `Email attachment 'pgmp exam content outline.pdf' processing failed … : timed out` |

⛔ **The run closed its books twenty-nine seconds before the attachment failed**, and it is not a
timing accident — it is the architecture. A watch LISTS and ENQUEUES; ingestion happens downstream
on the queue. `count_errors` therefore counts what the watch itself saw and structurally cannot
ever include an attachment outcome.

## Why no surface can show it today

Three registers exist and the fact is in none of the two the UI reads:

| Register | Reader | Carries the attachment failure? |
|---|---|---|
| `connector_sync_runs.count_errors` | `RunHistoryList` | ⛔ no — the run had already ended |
| `connector_watch_items.state` | `WatchedFoldersSection` | ⛔ no — an attachment is not a watch item; only the MESSAGE is, and the message succeeded |
| `documents.metadata.attachments[]` | nothing | ✅ yes: `{"error": "timed out", "status": "failed", "filename": "…"}` |

⭐ **The honest record already exists and is written correctly** — `email_attachments.py` records a
refusal and a failure rather than dropping either, which is the half that was designed properly.
**What is missing is a READER.** A person looking at the watch sees a clean, successful sync; the
truth is one join away in a JSON column nothing queries.

## What this is NOT

⚠ **Not the 20-second storage timeout.** That is a separate, unexplained defect (a
`storage3` `DEFAULT_TIMEOUT = 20` read timeout on an upload that takes 0.03–0.56 s in isolation);
it is what made this attachment fail. **This seed is about the failure being unreportable, and it
would still be true if the cause were a password-protected PDF.**

⚠ **Not closed by the 2026-09-09 UI work.** That change made a run with `count_errors > 0` stop
reading as clean, and gave the row a compact failure count. Both read registers that an attachment
never reaches. **A green watch can still hide a document that did not arrive.**

## The shape of an answer

Whatever writes it must attribute the outcome to something a surface already reads. The two
candidates, and the reason to prefer the first:

1. **Give an attachment a `connector_watch_items` row of its own**, parented by the message's
   `external_id`. It then inherits every existing surface — the row's failure count, the per-file
   sentence, the eventual per-run attribution SEED-254 asks for — with no new reader.
   ⛔ **The deletion guard must be checked first**: `sync_watch` derives `deleted_candidates` from
   items whose `external_id` is absent from the source listing, and an attachment will never
   appear in a mailbox listing. A naive row would be marked `missing` on the very next sync.
2. A per-document ingest-outcome read on the parent. Cheaper to write, but it is a fourth register
   and a fourth thing to keep honest.
