---
seed_id: SEED-263
title: A forwarded block is stripped only when that message is already in the library — replies dedupe, forwards must not, because a forwarded body is often the only copy
created: 2026-09-09
planted_during: Phase 240 (SRC-05) — measured after M-2 passed, on the operator's real thread
status: planted
priority: medium
surface: Agentic-RAG
relates_to:
  - `backend/app/services/email_extraction_service.py` — `strip_quoted_replies`, the three reply dialects
  - `backend/app/services/ingest_enrich.py` — writes `email_message_id` / `email_references` / `email_in_reply_to`
  - Phase 240 SC#1 — *"an answer cites the message that said it, ONCE"*, verified on replies only
trigger_when: >
  Forwarding mail into a watched label becomes a workflow anyone actually uses, or a person
  reports the same passage coming back from several documents in one thread. Also fires if
  Phase 241 (recall at corpus scale) measures duplicate hits within a `thread_key`.
---

## Measured, not assumed

`strip_quoted_replies` was run directly against four dialects on 2026-09-09:

| Dialect | Quoted history survives into the stored document? |
|---|---|
| Gmail reply (`On … wrote:` + `>`) | stripped ✅ |
| Outlook reply (`From:` / `Sent:` block) | stripped ✅ |
| `-----Original Message-----` | stripped ✅ |
| **Gmail forward** (`---------- Forwarded message ---------`) | ⛔ **kept** |

⚠ **Phase 240's SC#1 verified three REPLY dialects and never tested a forward.** The fixture was
a 14-message reply thread; the claim *"the distinctive paragraph appears in exactly 1 document"*
is true for replies and was never asked of forwards.

The operator's own thread shows the accumulation in production data — three documents under one
`thread_key` carrying **one, then two, then three** forwarded-header blocks. Only headers piled
up there because the original had no body; with a real body the body accumulates too, and a
search for a phrase from message 1 returns every document in the chain.

## ⛔ WHY THE OBVIOUS FIX IS WRONG, AND THIS SEED EXISTS INSTEAD OF A COMMIT

**A reply's quoted history is redundant — the original is already its own document. A forward's
content frequently is not.** Mail forwarded in from outside the watched label, or from before the
watch's `after:` anchor, exists in the library ONLY inside the forward. Stripping it there does
not deduplicate anything; it deletes the payload and ingests an empty document.

⭐ **Operator decision, 2026-09-09: take the safe option now.** Forwards stay intact and the
duplication is a recorded limitation. *"Nothing is ever lost"* beat *"nothing is ever repeated"*,
because a duplicate is visible and recoverable and a silent drop is neither.

## The rule this seed is actually for

Strip a forwarded block **only when the forwarded message is already in the library.** The
identifiers needed are already stored by `ingest_enrich` — `email_message_id`,
`email_references`, `email_in_reply_to` — so the test is a lookup, not a heuristic.

⚠ **Things to get right when it is built:**

1. **Look up by `Message-ID`, never by matching text.** A body-similarity rule would strip a
   quote of a document that is NOT in the library the moment two messages happen to share a
   paragraph.
2. **The forwarded headers are not a reliable `Message-ID` source.** Gmail's
   `---------- Forwarded message ---------` block prints From/Date/Subject/To and **no
   Message-ID**, so the lookup key has to come from `References`, or the block has to be matched
   to a stored document by (sender, date, subject) — which is a heuristic and should be treated
   as one.
3. **Decide per BLOCK, not per message.** A three-hop chain can have its oldest hop in the
   library and its middle hop not; stripping all-or-nothing gets one of the two cases wrong.
4. **Say what was removed.** A document whose forwarded history was dropped should record that it
   was, and which document now holds it — otherwise a person reading the stored text cannot tell
   a stripped forward from an empty one.
