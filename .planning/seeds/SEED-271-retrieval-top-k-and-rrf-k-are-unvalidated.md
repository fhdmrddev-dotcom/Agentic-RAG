---
seed_id: SEED-271
title: "retrieval_top_k and rrf_k have no bound anywhere — not in Python, not in the schema"
created: 2026-09-11
planted_during: Phase 242 Plan 01, while discharging ROADMAP SC#3 ("the general fix, not the specific one")
status: planted
surface: Agentic-RAG
severity: medium
category: settings / validation / retrieval
priority: medium
relates_to:
  - backend/app/api/settings.py                     # :535-541 — a bare `is not None`, no range
  - backend/app/services/retrieval_service.py       # the reader; SEED-224's extraction is owed here since Phase 231
  - backend/app/services/retrieval_tuning.py        # RECALL-02's home; has NO ledger row
  - supabase/migrations/178_app_settings_vision_calls_bound.sql   # the pattern a bound would follow
  - backend/tests/unit/test_242_settings_bounds_have_schema_constraints.py  # the fence whose allow-list is EMPTY
trigger_when: >
  The next phase whose `files_modified` names `backend/app/api/settings.py` or
  `backend/app/services/retrieval_service.py` — **or** Phase 246, whichever comes first. Phase 246
  is the natural home: `retrieval_top_k`'s ceiling interacts with `hnsw_ef_search`, which is that
  phase's subject, and both knobs live on the same Settings → Search card.
---

## What was measured, and what it refutes

`242-CONTEXT.md` `<deferred>` reads:

> A CHECK constraint on every other bounded settings column — `vision_max_pages`,
> `retrieval_top_k`, `rrf_k` and the HNSW knobs all carry Python-side bounds with no schema
> constraint. **Sweeping the rest is a phase, not a gap.**

Driven at HEAD on 2026-09-11, against `pg_constraint` on the live local database and against every
file in `supabase/migrations/`:

| column | Python bound | schema CHECK |
|---|---|---|
| `multimodal_max_vision_calls` | `1..1000` (`settings.py:467`) | ✅ **added by migration 178** |
| `vision_max_pages` | `1..500` (`settings.py:492`) | ✅ **added by migration 178** |
| `source_max_file_size_mb` | FLOOR..CEILING (`settings.py:514-518`) | ✅ already there — `app_settings_source_max_file_size_mb_bounds`, **migration 174** |
| `hnsw_ef_search` | FLOOR..CEILING (`settings.py:602`) | ✅ already there — `app_settings_hnsw_ef_search_bounds`, **migration 176** |
| `hnsw_iterative_scan` | enum membership (`settings.py:624`) | ✅ already there — `app_settings_hnsw_iterative_scan_values`, **migration 176** |
| **`retrieval_top_k`** | ⛔ **NONE** (`settings.py:535` — a bare `is not None`) | ⛔ **NONE** |
| **`rrf_k`** | ⛔ **NONE** (`settings.py:541`) | ⛔ **NONE** |

⭐ **So the deferral's premise was wrong in both directions.** Three of the five columns it named
were already constrained, which made the remaining sweep two columns rather than five — small
enough that Phase 242 took it, and the fence's allow-list is now **EMPTY**. And the two columns it
listed as *"carry Python-side bounds"* carry **no bound at all**, which is a different and arguably
worse finding than a missing CHECK: there is nothing to back up.

## Why this is a phase and not a gap

Adding a CHECK to an already-bounded column is mechanical — copy migration 178. **Adding a bound to
an unbounded one is not.** It needs a NUMBER and a reason, and the reason is what the refusal
sentence has to say:

- **`retrieval_top_k`** sizes every retrieval call. `0` returns nothing while every search still
  reports success — the same silent-success shape SEED-226/SEED-227 exist to refuse. A large value
  costs latency and context window on every single question. ⚠ Its ceiling **interacts with
  `hnsw_ef_search`**: asking for more results than the index walks candidates is incoherent, and
  `hnsw_ef_search` is Phase 246's subject. A number chosen here without that phase's measurements
  would be a guess.
- **`rrf_k`** is the constant in the reciprocal-rank-fusion denominator (`1 / (k + rank)`). `0` is
  not a crash but it makes rank-1 dominate absolutely; a negative value can divide by zero at a
  specific rank. It has no natural upper bound — past a few hundred, fusion degrades to "ignore
  rank entirely" without announcing it.

Both also need the Phase 241 treatment rather than a bare range: **the sentence must carry the
COST**, not just the numbers (`SEED-258`, `D-241-09`). *"Must be between 1 and 200"* leaves the
operator exactly as blind as no bound at all.

## What is already in place when this is picked up

- `backend/tests/unit/test_242_settings_bounds_have_schema_constraints.py` parses `settings.py`
  with `ast` and requires every `lo <= body.<x> <= hi` bound to have a matching CHECK. **Adding a
  bound to `retrieval_top_k` without a migration will turn it RED in the commit that adds it** —
  the fence is already watching for exactly this work.
- `BOUNDS_WITHOUT_SCHEMA_CONSTRAINT` in that file is EMPTY, so any exception added later is a
  deliberate, reviewed deferral rather than a silence.
- Migration 178 is the pattern: clamp any out-of-range row FIRST (a CHECK cannot be added while a
  row violates it), `DROP CONSTRAINT IF EXISTS` before `ADD CONSTRAINT` so the file is re-runnable,
  and permit NULL so `_val()`'s config fallback keeps working.
- `backend/app/services/retrieval_tuning.py` — RECALL-02's home — **still has no hot-file ledger
  row**; the ROADMAP's Phase 246 entry says one is owed in that phase's commit.

## What would make this urgent rather than medium

A value reaching these columns from outside `PUT /settings` — a restored dump, a hand-edit in the
SQL editor, or a second writer. Today the Settings UI is the only path and it sends integers from
number inputs, so the exposure is latent. **It is the same shape `multimodal_max_vision_calls` had
right up until the operator's row held `1001`.**
