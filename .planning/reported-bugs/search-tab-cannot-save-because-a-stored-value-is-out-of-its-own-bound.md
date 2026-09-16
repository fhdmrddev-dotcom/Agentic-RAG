---
id: BUG-260910-03
title: The whole Search settings tab is unsaveable because a STORED value sits outside the bound the API enforces
reported: 2026-09-10
surface: Agentic-RAG
severity: blocking
status: closed
affected_areas: [frontend/settings, backend/settings-api, RAG/multimodal]
folded_into: 242
verified_closed_by: 242
related_seeds: [SEED-227]
re_open_trigger: null
reproduces_on:
  branch: develop
  commit: d9c6b9c2f
  date: 2026-09-10
---

> ⭐ **CLOSED BY PHASE 242 (flipped 2026-09-16, Phase 252 Plan 01 / D-35).** The closing artifact is
> commit **`46292bb81`** — *"feat(242-02): the Search tab sends only what CHANGED, and a refusal
> names the stored value"*. Both halves of this report are addressed by it: the tab no longer
> re-submits an untouched stored value that is out of its own bound (so an unrelated control is
> saveable again), and a refusal now names the value that is actually stored rather than describing
> the rule in the abstract.
>
> Corroborated in two registers: `REQUIREMENTS.md:22` (*"Fixed by 46292bb81 (Phase 242-02)"*) and
> `ROADMAP.md:289`, which records this report and `BUG-260911-01` as **measured fixed 2026-09-13**
> and instructs the flip — *"bookkeeping, not work; leaving them open is what made two of three
> registers stale at scoping."*

# What happens

On the operator's live local install, **every save on Settings → Search fails with HTTP 400** —
the reranker, the embedding model, the retrieval threshold, `rrf_k`, and Phase 241's two new
HNSW controls alike. The banner reads:

> Images read per document must be between 1 and 1000. 0 would silently stop every image from
> being read.

⚠ **The message names a setting the operator did not touch, and is not on the part of the form
they edited.** It is truthful about the rule and actively misleading about the cause.

# Why

`app_settings.multimodal_max_vision_calls` holds **`1001`** — measured:

```
{'multimodal_max_vision_calls': 1001, 'hnsw_ef_search': None, 'hnsw_iterative_scan': None}
```

Three facts combine:

1. `SettingsPage.tsx:888` puts `multimodal_max_vision_calls` in the **Search tab's** payload,
   sending the value it loaded whether or not the operator touched it.
2. `api/settings.py:466` refuses anything outside `1 <= n <= 1000` — and that check sits at
   **position 13** of the validation sequence, long before `hnsw_ef_search` at **position 28**.
3. There is **no CHECK constraint** on the column (`grep` over `supabase/migrations/*.sql`
   returns none), so the database never prevented the value being stored.

The bound arrived in SEED-227's `cfc411b51` — *"the image ceiling reaches the UI"* — **after** a
value beyond it already existed. **The API began refusing a number the database was still holding,
and the tab that round-trips it became permanently unsaveable.**

# The shape of it, which is the part worth generalising

⭐ **This is the identical failure mode as Phase 241's CR-01, arriving from the opposite direction.**
CR-01: a field the form always sends, referencing a column that does not exist → the whole tab 500s.
This: a field the form always sends, carrying a value the API rejects → the whole tab 400s.

**Both are the same structural fault: a settings form that submits its entire tab as one
all-or-nothing payload, validated field-by-field with an early `raise`.** Any single field that
cannot pass — for any reason, including one nobody edited — takes every other field with it.

⚠ **A new bound on an existing settings column is a MIGRATION, not just an API change.** Adding
`1 <= n <= 1000` in Python without (a) a CHECK constraint and (b) a data fix for rows already
outside it leaves exactly this state: legal-looking data the application refuses to accept.

# Impact

- **Blocking** for the operator right now: no Search setting can be saved at all.
- It **blocked Phase 241's UAT row 3** — the 9999 out-of-range test never reached the
  `hnsw_ef_search` validator, so the search-breadth refusal was not exercised by that attempt.
  ⚠ Had the network response not been read, the banner would have been taken as row 3 passing.

# Fix

1. **Data:** bring the stored value into range (`1001` → `1000`, the legal maximum nearest the
   stored intent). Reversible, one row.
2. **Schema:** add a CHECK constraint so the column cannot hold an out-of-range value again — the
   pattern migration 176 already uses for `hnsw_ef_search`.
3. **Structural (the real fix):** either send only CHANGED fields from each tab, or collect all
   validation failures and return them together rather than raising on the first. ⛔ Until one of
   those lands, this class of bug recurs on the next bound added to any settings column.
4. **Message:** when a refusal names a field the operator did not edit, say so — *"this was already
   set to a value outside the allowed range"* — rather than presenting it as a rejection of what
   they just typed.
