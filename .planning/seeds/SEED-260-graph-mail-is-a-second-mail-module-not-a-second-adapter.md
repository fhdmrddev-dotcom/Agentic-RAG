---
seed_id: SEED-260
title: Microsoft Graph mail is a second file beside gmail.py, not a second adapter — deferred from Phase 240 because no Azure app registration exists and untestable code is worse than absent code
created: 2026-09-09
planted_during: Phase 240 (SRC-05), at scoping — D-240-04
status: planted
priority: medium
surface: Agentic-RAG
relates_to:
  - Phase 240 (SRC-05) — the mail SHAPE this would be the second instance of
  - `backend/app/services/sources/mail/mailbox.py` — the provider-INDEPENDENT half; if it has to
    change to accommodate Graph mail, the split was drawn in the wrong place and THAT is the finding
  - `backend/app/services/sources/mail/gmail.py` — the shape to copy, 292 L
  - `backend/app/services/sources/adapters/microsoft_graph.py` — the adapter that would gain the
    same three delegation lines Drive gained (+35 / -0, about twenty of them comment)
  - Phase 238 — closed with ALL NINE live UAT rows owed on the same missing prerequisite
  - SEED-256 — no Microsoft 365 work/school tenant; SharePoint stays blocked independently
  - `backend/app/services/oauth_service.py:108-114` — the Microsoft `default_scopes`, which carry
    `Files.Read.All` and NOT `Mail.Read`
trigger_when: >
  BOTH of: (a) `MICROSOFT_OAUTH_CLIENT_ID` / `MICROSOFT_OAUTH_CLIENT_SECRET` are configured and
  Phase 238's row `M-1` has actually been driven, so a Microsoft connection can be made at all;
  AND (b) somebody wants a watched Outlook mailbox. ⚠ It is ALSO the right moment to re-read
  D-240-04's reasoning if anyone proposes building this speculatively before (a) — that is exactly
  what was declined.
---

# SEED-260: Graph mail is a second module, not a second adapter

## What Phase 240 built, and what it deliberately did not

Phase 240 made mail a **shape** carried by the adapter that already owns the connection, not a
fourth `SourceAdapter`. The evidence is a hash: `backend/app/services/sources/base.py` closed
**byte-identical** (`3b3d8770a6c9309f0635503d155dd8f7`, before and after), and the whole
delegation cost `google_drive.py` **+35 / −0 lines**, roughly twenty of them comment.

The split was drawn so a second family would be cheap:

| File | What it knows | Size |
|---|---|---|
| `mail/mailbox.py` | mailboxes, in the abstract. **Nothing about Google.** | 147 L |
| `mail/gmail.py` | Gmail's three reads and its error wording | 292 L |
| `adapters/google_drive.py` | three `if is_mail_*` delegations | +35 L |

**So Graph mail should be `mail/graph_mail.py` plus the same three lines in
`adapters/microsoft_graph.py`, and nothing else.** ⚠ `mailbox.py` is listed in
`test_boundary_fence.py`'s `FENCED_MODULES`, so if the Graph arm needs a provider literal there,
a test fails by name — which is the point. **If `mailbox.py` has to change, the split was wrong,
and recording that is worth more than the feature.**

## Why it was NOT built in Phase 240

**Two prerequisites, and neither is a code decision.**

1. **The `Mail.Read` scope does not ship.** `oauth_service.py`'s Microsoft `default_scopes` carry
   `openid`, `offline_access`, `User.Read`, `Files.Read.All` — and no mail scope. Adding one is a
   **re-consent**, which is the correct cost for that decision rather than an obstacle to it.
2. **There is no Azure app registration on this machine.** Phase 238 shipped the entire OneDrive
   adapter and closed with **all nine of its live UAT rows OWED** on exactly this: no
   `MICROSOFT_OAUTH_CLIENT_ID` / `MICROSOFT_OAUTH_CLIENT_SECRET`. A Graph mail arm would inherit
   that state on day one.

⛔ **The decisive argument is Phase 238's own verification, in its own words:** the two-step Graph
download *"is asserted against a fake `send_pinned_http`. The fake is mine, so it agrees with my
adapter by construction."* Building a second untestable-in-practice provider arm would have added
code that no one could drive, wearing a green suite that proves only self-consistency. **Absent
code is honest; untestable code that looks tested is not.**

## What to do when the trigger fires

1. Copy `mail/gmail.py`'s shape, not its contents. The three reads are: mail folders → `SourceNode`,
   messages in a folder → `SourceFile`, one message as RFC-822 bytes → the SAME `parse_eml_bytes`.
2. Graph serves a message's MIME via `/messages/{id}/$value`. ⚠ **Check whether it 302s to a
   different host, as `/content` does for files** — `egress.py` refuses redirects by design, and
   Phase 238's whole finding was that the two-step remedy must stay INSIDE the adapter and never
   leak into the shared contract.
3. Use a mail-specific egress key. ⛔ **Never reuse the file key.** `egress.py:266` and
   `service_tools.py:409` both record why: the key is what an audit can grep, and it is what makes
   *"a file tool cannot reach mail"* a checkable statement rather than a hope.
4. `thread_key` needs **no** provider work. It is derived from RFC 5322 headers in `ingest_enrich`
   (D-240-05), so Graph mail groups with Gmail mail and with hand-uploaded `.eml` automatically —
   which is the main dividend of not having used Gmail's `threadId`.
5. **Measure and publish the cost in lines**, the way Phase 238 published `352 L vs Drive's 399`
   and Phase 240 published `+35 / −0`. A number that grows is the finding.
