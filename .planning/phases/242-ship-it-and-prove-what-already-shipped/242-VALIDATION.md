---
phase: 242-ship-it-and-prove-what-already-shipped
status: owed
driven: 0 / 5
surface: Agentic-RAG
---

# Phase 242 — VALIDATION (UAT rows)

**Authored 2026-09-11, at the phase's close. ⛔ ZERO ROWS DRIVEN — no browser was opened at any
point in this phase.**

⚠ **Why this file exists at all, and why it was nearly missed:** the ROADMAP marks Phase 242
**UI hint: yes**, so **G-4 fires** — *"Operator-defined 'I'd recognize failure here' scenarios…
Chrome MCP drives all 3 at phase verification — wire format + screenshot are insufficient."* And
CLAUDE.md is explicit that **UAT rows MUST be authored under VALIDATION.md, NOT in PLAN.md tasks.**
Neither plan carried one, and the phase would have closed with its headline criterion — the one
that names *production* — carried by nothing. Found by the plan-checker.

⚠⚠ **THE STANDING RULE FOR EVERY ROW BELOW: READ THE NETWORK RESPONSE, NOT THE BANNER.**
`241-HUMAN-UAT.md`'s row 3 recorded this project making exactly that error — *"a red banner is
exactly what a PASSING refusal looks like"*, and **"presence of an error is not evidence of the
RIGHT error."** Open DevTools → Network, click the `PUT /settings` request, and read **the request
payload** and **the response body**. A green tick proves nothing here; the whole deliverable is
*which fields travelled*.

---

## Row 1 — SC#1 · the save that could not be performed ⛔ **RUN THIS FIRST**

| | |
|---|---|
| **Requirement** | SHIP-01 |
| **Surface** | Settings → **Search** tab |
| **Why it is first** | It is the only row that names PRODUCTION, and it is the criterion the whole phase is about |

**Steps**
1. Open Settings → Search. Open DevTools → Network, filter to `settings`.
2. Change exactly ONE field — *RRF-K constant*, say 60 → 61.
3. Save.

**Pass**
- The `PUT /settings` **request payload contains exactly one key** — `{"rrf_k": 61}`.
- The response is **200**, and reloading the page shows 61.

**Fail — and each of these is a different defect, so record WHICH**
- The payload carries more than the one key → the diff is not wired.
- The payload is `{}` → the baseline disagrees with what `hydrate` set. ⛔ **This is the silent-drop
  failure and it is the worst outcome**: the save would report success and change nothing.
- A 400 naming a field you did not touch → the diff is not reaching the wire.

---

## Row 2 — SC#2 · a value you never typed can no longer take the tab down

| | |
|---|---|
| **Requirement** | SHIP-01 |
| **Setup** | ⚠ Needs a stored out-of-range value, and **migration 178 now makes that impossible to create through the database** — that is the point of the migration. To exercise it, run against an environment where 178 has NOT been applied, or temporarily `ALTER TABLE public.app_settings DROP CONSTRAINT app_settings_multimodal_max_vision_calls_bound;`, set `multimodal_max_vision_calls = 1001`, and restore the constraint afterwards **by re-running migration 178**, which clamps the row first. |

**Steps** — with `multimodal_max_vision_calls = 1001` stored, change only *Search breadth* and save.

**Pass** — the save **succeeds**; the payload carries only `hnsw_ef_search`. The stored 1001 is
still 1001 and is simply not in the request.
**Fail** — HTTP 400 mentioning *"Images read per document"*. That is the shipped bug reproducing.

---

## Row 3 — SC#2 · the refusal names the STORED value

| | |
|---|---|
| **Requirement** | SHIP-01 · D-242-03 |

**Steps** — with `multimodal_max_vision_calls = 1001` stored (same setup as row 2), open the
*Images read per document* field, **re-enter 1001 yourself**, and save.

**Pass** — the banner reads, in substance: *"'Images read per document' was already set to 1001,
which is outside the allowed range of 1–1000. That is what is blocking this save — nothing you just
changed is at fault."*
**Fail** — the old sentence (*"must be between 1 and 1000"*), which is truthful about the rule and
misleading about the cause.

**Mirror, in the same row** — type **2000** instead. The banner must read the OLD sentence, because
now you DID type it and that sentence carries what the bound buys. ⚠ Getting the nicer sentence here
would be a regression: the new branch must not swallow the old one.

---

## Row 4 — SC#3 · the schema refuses what the API refuses

| | |
|---|---|
| **Requirement** | SHIP-01 |
| **Where** | Supabase SQL editor, against **local** |

```sql
update public.app_settings set multimodal_max_vision_calls = 1001;   -- must FAIL
update public.app_settings set vision_max_pages = 900;               -- must FAIL
update public.app_settings set multimodal_max_vision_calls = null;   -- must SUCCEED
```

**Pass** — the first two raise `new row for relation "app_settings" violates check constraint`; the
third succeeds (NULL is legal deliberately — `_val()` falls back to the `config.py` default).
⚠ Restore the row afterwards; `multimodal_max_vision_calls` was `1000` and `vision_max_pages` `50`.

---

## Row 5 — SC#1 · **on the database production serves from** ⛔ OPERATOR + CLOUD

| | |
|---|---|
| **Requirement** | SHIP-01 |
| **Blocked on** | the operator, on the live product |

**Steps** — on the deployed app, Settings → Search, change one field, save, and read the network
response.

**Pass** — 200, one key in the payload.
⭐ **Expected to pass on the evidence already gathered**, and that is stated so a pass is not
mistaken for proof of the fix: cloud holds `multimodal_max_vision_calls = 100` and
`vision_max_pages = 50`, both in range, so **the tab already saved in production before this phase**.
What this row proves is the NEW payload shape reaching production — not that a bug was cured there.

⚠ **Migration 178 is NOT applied to cloud.** This row does not require it. Applying it is operator
action and is named in `242-VERIFICATION.md` under owed work.

---

## What a driven row must record

The `PUT /settings` **request payload** (verbatim), the **HTTP status**, the **response body on a
refusal** (verbatim), and the environment (local or cloud). A row that records only "worked" is not
a driven row.
