---
seed_id: SEED-302
title: Void and end-date a rate from the product, instead of hand-editing the database
created: 2026-09-19
surface: Agentic-RAG
status: planted
partial: false
status_note:
trigger_when: The operator needs to correct a wrong price, retire a model's rate, or asks again "what if I want to delete". ALSO fires the moment anything reads `effective_to` as if it were real — it is a hardcoded `None` today.
trigger_paths: ["backend/app/db/rates.py", "backend/app/api/admin_spend.py", "frontend/src/components/admin/spend/RepriceModal.tsx", "supabase/migrations/*model_rates*.sql"]
trigger_surfaces: [backend-api, database, admin-operator]
migration_note:
relates_to: ["257", "backend/app/db/rates.py", "supabase/migrations/184_model_rates_complete_roster.sql", "supabase/migrations/185_model_rates_db_roster.sql"]
folded_into: null
renumbered_from: null
renumbered_because: null
---

# SEED-302: Void and end-date a rate from the product

## Where this came from

The operator asked, at Phase 257's close: *"in any way we can add new models and prices but what
if I wanted to delete I have to go to the database or what. Maybe some models removed from
registry It should not be calculated or what do you suggest"*.

Measured answer at the time: **there is no delete path anywhere in the product.** `model_rates`
has `id, model_id, provider, input_cost_per_million, output_cost_per_million, effective_from,
created_at, created_by, org_id` and nothing else, and no code path issues a DELETE. Correcting a
mistake means opening the database by hand.

## ⛔ The bug that exists TODAY, independent of whether this seed ships

`backend/app/db/rates.py:267` emits `"effective_to": None` as a **hardcoded literal**. There is no
`effective_to` column — verified against the live schema. The API therefore advertises an end-date
concept that does not exist.

That is the same defect class Phase 257 hit three separate times: a field on the wire with nothing
behind it (the dead `RunCostBadge`, the unmeasured/unrated conflation in the summary, and this).
**A consumer that trusts `effective_to` will be wrong and nothing will say so.**

## The three things that got tangled, and the verdict on each

1. **"I typed the wrong price."** Repricing does not help — the bad row still prices every run
   between its `effective_from` and the correction. This needs a **VOID**, not a DELETE:
   `voided_at` / `voided_by` / `void_reason`, with resolution skipping voided rows. On a billing
   table the audit trail is the point, and a DELETE destroys the evidence that someone made a
   mistake and fixed it.

2. **"A model was removed from the registry."** ⛔ **Past spend MUST NOT change.** If
   de-registering a model un-priced its history, the org total would silently drop — which is
   exactly the *Historical Rewrite* failure scenario Phase 257's own G-4 UAT was written to catch.
   The registry decides what you can RUN; `model_rates` records what things COST. A rate
   outliving its model is correct, not leftover. What is owed is **labelling** — the ledger and
   model breakdown marking a row *"retired model"* — so an unfamiliar name does not read as a bug.

3. **"Stop counting it going forward."** That is an end-date: add `effective_to timestamptz NULL`,
   and resolve with `effective_from <= t AND (effective_to IS NULL OR t < effective_to)`. Future
   runs go unrated; past runs keep their price. This also makes `rates.py:267` honest.

## What shipping it looks like

A migration adding `effective_to` plus the three void columns; resolution updated in **the one
home** (`get_rate_for_model` / the four SQL consumers — ⛔ all five move together, that is CR-06's
lesson); a fence proving a voided or end-dated rate does not change what a **past** run cost; and
"End this rate" / "Void this rate" in `RepriceModal` so the operator never touches Postgres.

⚠ **It is a phase, not a gap.** G-7: *a closure round may never introduce a new user-facing
capability.* Phase 257 deliberately closed without it.

## Related, and deliberately NOT folded in here

The **third roster** problem. Phase 257 checks roster→rate. Nothing checks **runs→rate** — the
question the money actually depends on. Measured at 257's close, two models appear in real `runs`
and in **neither** roster: `deepseek-v4-pro-qwen3.5-9b-mtp` (1 run) and
`DeepSeek-V4-Flash-Vision-Exp` (1 run). Same class as the `claude-haiku-4-5` vs
`claude-haiku-4-5-20251001` alias mismatch the review found. ⛔ It wants an **operator-visible
check on the spend page**, driven from what actually ran — never a unit test, because a test that
needs Postgres SKIPS in CI and a skip reads as "not failing".
