# 240-03 — SUMMARY

**Goal:** attachments arrive on BOTH ingest paths, and message 1's paragraph appears once.
**Commit:** `5f8a54702` · **Status:** complete

## ⛔ The defect, measured before planning started

```
grep -n "rfc822\|attachment" backend/app/services/ingest_splice.py
→ one docstring line, and no code.
```

The email-attachment child loop lived **only** in `api/documents.py`'s legacy `ingest_document`.
**Watches and `/upload` both run the queue path.** So a watched mailbox would have ingested every
message and **zero attachments** — SC#2 false, with the whole suite green, because every existing
attachment test exercises the legacy path.

⚠ **The FOURTH recorded disagreement between these two paths.** `ingest_splice.py`'s own comments
narrate three: BUG-260905-06 (metadata), the empty-chunk refusal, the Phase 234 provenance carry.

## What shipped
`backend/app/services/email_attachments.py` — one function, both callers. `api/documents.py`
**+15 / −115**, a further real G-5 discharge on a file already discharged at 229.

⭐ **Proven a MOVE, not a rewrite:** the legacy pin was written and passing BEFORE the extraction
and passes unchanged after.

Two deliberate deltas, both named: a **`depth` cap** (a `.eml` inside a `.eml` becomes reachable
from a watch — new exposure, guarded in the same commit) and **`org_id` / `ingest_visibility`
pass-through** (omitting them would mint a child outside its connection's visibility scope).

## ROADMAP's named dedup failure does not happen
*"Two different emails carrying the same attachment collide on `documents_dedup_idx` and one is
silently swallowed."* The `document_relationships` insert sits ABOVE the `is_duplicate`
early-return. **Driven RED by moving it below** — the second link vanished and the test failed.

## SC#1 measured, not assumed
A 14-message thread where every reply quotes message 1's paragraph:

| dialect | before stripping | after |
|---|---|---|
| Gmail (`On … wrote:` + `>`) | 14 / 14 | **1** |
| Outlook (`From:` / `Sent:`) | 14 / 14 | **1** |
| `-----Original Message-----` | 14 / 14 | **1** |

⭐ Neutralising `strip_quoted_replies` returns **14**, and the test asserts that too. The positive
control runs every time, so a fixture that stopped reproducing the problem fails loudly.

⛔ **`retrieval_service.py` NOT modified** — it fires G-5 at 10 phases with an extraction owed
since 231. The measurement being green is why no retrieval change was needed.

## Gates
Backend `71 failed / 4320 passed`; failing NAME SET identical to base, zero new.

## Owed
Nothing from this plan. `M-2` drives it live.
