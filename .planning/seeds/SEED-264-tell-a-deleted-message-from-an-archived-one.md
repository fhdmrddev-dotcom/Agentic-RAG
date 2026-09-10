---
seed_id: SEED-264
title: Tell a DELETED message from an ARCHIVED one — mail now suppresses deletion detection wholesale, which is safe but blunt
created: 2026-09-10
planted_during: Phase 240 (SRC-05), closing code-review WR-03
status: planted
priority: medium
surface: Agentic-RAG
relates_to:
  - `backend/app/services/sources/base.py` — `SourceListing.deletions_detectable`, the flag this would refine
  - `backend/app/services/sources/mail/gmail.py` — the listing that sets it False
  - `backend/app/services/watch_service.py` — the suppression arm, beside the H-5 completeness guard
  - Phase 240 UAT row **M-5** — observed the marking behaviour this deliberately withdrew
trigger_when: >
  Anyone asks why a message they deleted in Gmail still shows as present in the Library, or a
  phase touches mail listing semantics. Also fires if a second label-shaped family (Graph mail,
  SEED-260) lands, since it will need the same answer and should not invent a second one.
---

## What was done, and what it cost

Code-review **WR-03** found that Gmail's **Archive** button — the most ordinary action in a
mailbox — removes the `INBOX` label, so an archived message drops out of a COMPLETE listing
exactly the way a deleted one does. `watch_service` marked its document `missing_at_source`. A
person tidying their inbox was told their Library was losing data.

The fix suppresses deletion detection for mail wholesale: `SourceListing.deletions_detectable`
is `False` for a mail listing, and the watch loop skips the deletion arm.

⛔ **THE COST IS REAL AND IS NOT HIDDEN: a message genuinely deleted at source now stays marked
present.** Phase 240's UAT row **M-5** drove exactly that case and watched it work —
`count_missing: 1`, `source_state: missing_at_source`, the document surviving intact. **That
marking is deliberately withdrawn**, and this seed exists so the withdrawal is a decision on the
record rather than a regression someone rediscovers.

⭐ **Why it is still the right trade today.** The two failure directions are not symmetric:

| | Says | Truth | Harm |
|---|---|---|---|
| Before | *"missing at source"* | you archived it | ⛔ alarming, and wrong — reads as data loss |
| After | nothing | you deleted it | ⚠ incomplete, and safe — the document is still yours |

This product's stated promise is that deletion at source never deletes your knowledge, so a
document that stays is consistent with it. A false alarm is not.

## The sharper rule this seed is for

Gmail can distinguish the two, and the check is cheap because it only runs on candidates:

- **Archived** — the message still exists; it simply no longer carries the watched label. It is
  in `All Mail`.
- **Trashed** — it carries `TRASH`. The person threw it away.
- **Gone** — `messages.get` answers 404. Permanently deleted.

So: when a watched item disappears from a mail listing, ask about *that message*. Mark it missing
only for the last two. The cost is one request per disappearance, and disappearances are rare —
unlike the per-message metadata reads that forced the batching work in the first place.

⚠ **Things to get right when it is built:**

1. **It must not become a provider branch in `watch_service`.** The whole point of
   `deletions_detectable` was to keep one rule for every family. The refinement belongs behind
   the adapter — most likely a listing that can answer *"is this specific id really gone?"*
   rather than a boolean on the whole page.
2. **Fail closed.** If the follow-up check errors or rate-limits, the answer is *"not proven
   gone"* — never *"missing"*. A 429 must not delete-mark someone's mail.
3. **The H-5 completeness guard still applies first.** An incomplete listing proves nothing about
   any candidate, whatever a per-message check says.
4. **Re-run M-5 when it lands.** That row is the only end-to-end evidence this behaviour ever had.
