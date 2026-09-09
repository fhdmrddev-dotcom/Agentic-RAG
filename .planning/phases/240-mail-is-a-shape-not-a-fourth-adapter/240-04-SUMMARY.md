# 240-04 — SUMMARY

**Goal:** the Library shows a conversation, and the picker stops offering switched-off connections.
**Commit:** `3e13eec74` · **Status:** complete

## What shipped
- `GET /documents/{id}/conversation` + `ConversationMessage` / `ConversationResponse`.
- `DocumentConversationSection.tsx`, mounted in the shipped detail panel, gated on the document
  looking like mail (read from metadata — **no fetch decides whether a section exists**).
- `BUG-260908-02` fixed in `sourceCapability.ts` — one predicate, both surfaces.
- The **first test suites** `ConnectedSourceSection` and `CreateWatchModal` have ever had.

## The security shape
⛔ The route takes a **document id and never a `thread_key`**. A key is derived from a
`Message-ID`, which is chosen by whoever sent the mail — so anyone who can email this user could
choose a lookup handle. The open document is resolved first under the caller's own auth; siblings
are then read scoped to that document's owner. Capped at 200 and **reports** the truncation
(PostgREST truncates at 1000 silently — the trap `_fetch_readability` already records).

## Three of my own defects were caught by EXISTING fences, not by me
1. **`CR01.reset.test.tsx`** — `setConvoTotal` missing from the `doc.id` reset block. A collapsed
   `PanelSection` never remounts, so a badge from document A would persist on document B.
2. **`DocumentDetailPanel.a11y.test.tsx`** — an earlier draft mounted the section TWICE (once in a
   `hidden` div) so the panel could learn the total before showing it. The loading state is
   `role="status"` and that suite asserts none exists before a PATCH. **Two mounts to avoid one
   empty accordion was the wrong trade**; the shipped Relationships pattern already had the answer.
3. **My own positive control** — the picker fixture used `display_name` where the component reads
   `name`, so every NEGATIVE assertion was passing vacuously.

⚠ And one fence of mine was **blind on first writing**: it asserted `'"user_id"' in body`, and
deleting the real `.eq("user_id", owner_id)` left it GREEN because a neighbouring line contained
the string. **A fence a neighbouring line can satisfy is not a fence.**

## BUG-260908-02, closed on a RED drive
Commenting out the `is_enabled` check reds **6 of the 10 new cases** across both suites; restored,
29/29 pass. Among them: `CreateWatchModal` pre-selects `capable[0]`, so a switched-off connection
would have been chosen FOR the person the instant the modal opened — nobody had reported that half.
⚠ The server-side refusal stays; a UI filter is not a security control.

## Gates
Count gate **OK — total 7914 · pinned 7149 · 247/247 · 0 failing** (RED at this phase's baseline on
an EMPTY frontend diff). All three new suites in **both** knobs. `tsc` zero new.

⚠ My first tsc baseline keyed on `file(line,col)`, so a 3-line barrel edit made two untouched
errors read as NEW. Compare `file + code + message`.

## Owed
`M-3` (search a long thread) and `M-4` (disable the connection) drive this live.
