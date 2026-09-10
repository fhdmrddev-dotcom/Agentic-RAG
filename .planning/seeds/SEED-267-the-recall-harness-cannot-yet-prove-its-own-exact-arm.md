---
seed_id: SEED-267
title: The recall harness cannot yet prove its own "exact" arm is exact — and its probe targets are not stably bound
created: 2026-09-10
planted_during: Phase 241 (QUEUE-06) — raised by 241-REVIEW.md WR-02/WR-03/WR-04, left OPEN at the phase close
status: planted
priority: medium
surface: Agentic-RAG
severity: major     # It does not affect the shipped product. It affects whether this project's own recall numbers can be trusted.
folded_into: null
relates_to:
  - `backend/app/services/recall_eval.py` — `_set_planner`, `measure_layer1`, `resolve_probe_targets`,
    and the probe-vector cache.
  - `scripts/measure-recall.py` — the CLI both layers run through.
  - `.planning/phases/241-recall-at-corpus-scale/241-VERDICT-CORRECTION-PLAN-PATH.md` — why the
    obvious test for WR-02 is blind on the current corpus.
trigger_when: >
  ANY of these becomes true:
  (1) a recall number produced by this harness is about to be quoted as evidence in a decision —
      a milestone gate, a customer-facing claim, a regression verdict, or a phase's success criterion;
  (2) a corpus large enough for the planner to choose the HNSW index exists again (the Phase 241
      bench, or a real install past the crossover) — that is the ONLY place WR-02 is testable;
  (3) `measure_layer1`'s per-shape `recall_at_k` is relied on, as opposed to the Layer-2 Hit@k
      figures, which do not depend on the exact/ann comparison at all;
  (4) anyone re-runs the harness and gets a DIFFERENT set of probe targets than
      `241-VALIDATION.md` records.
---

# Three open findings, all about whether the measurement can be believed

Phase 241 rewrote the recall harness precisely because the previous one **could not report a
failure** — it matched on text instead of vectors and scored every miss as a perfect hit. The
rewrite is a large improvement and its Layer-2 (semantic Hit@k) results are sound. **These three
findings are about Layer 1**, the mechanical exact-vs-approximate comparison, and about how probes
bind to documents.

⛔ **None of this affects the shipped product.** `recall_eval.py` is a dev measurement harness. What
is at stake is whether this project's own numbers mean what they say.

## WR-02 — the "exact" arm is not proven to be exact

Layer 1 forces its exact arm off the index with session GUCs (`enable_indexscan = off`, etc.). But
`public.match_document_chunks` is **`LANGUAGE plpgsql`** (verified: `select lanname … → plpgsql`),
and a plpgsql function's inner plan is cached by the SPI plancache with the standard
custom→generic transition after five executions. **Planner-cost GUCs do not invalidate a cached
plan.** One run makes ~200 executions on one connection. Worse, `enable_indexscan = off` adds
`disable_cost` to every custom plan, which is exactly the condition that makes PostgreSQL prefer
the generic plan.

**If that happens, both arms execute the same plan, `ann_ids == exact_ids`, and `recall_at_k` reads
`1.000`** — the precise number the harness was rewritten to stop being able to print by accident.
`241-VALIDATION.md` reports `1.000` in **all 63** filtered shape-runs.

⚠ **The direction of the possible error UNDERSTATES the collapse**, so Phase 241's headline finding
is not at risk. What is unproven is the per-shape `1.000`.

### ⛔ Why it was not simply tested, and the trap for whoever tries

The obvious test — assert `pg_stat_user_indexes.idx_scan` does not move during the exact arm —
**is blind on the operator's real corpus.** Measured 2026-09-10:

```
as the harness ships (cache=100, no plan_cache_mode): idx_scan during exact arm = +0
with the review's fix  (cache=0,  force_custom_plan) : idx_scan during exact arm = +0
POSITIVE CONTROL — planner FREE, default GUCs       : +0     <-- the test measures nothing
```

`document_chunks_embedding_idx` has **`idx_scan = 0` for the life of that database** (68 MB, never
scanned): at 7,959 rows the planner chooses `Seq Scan` + `Sort`. So `+0` in the "off" arm is not
evidence the GUC worked — the index never moves for anyone.

⭐ **Only the positive control revealed that.** Without it, WR-02 would have been closed on a test
incapable of detecting the defect. **A test whose positive control does not fire has measured
nothing.**

### What to do when the trigger fires

- `SET LOCAL plan_cache_mode = force_custom_plan` in `measuring_connection()`, and
  `asyncpg.connect(..., statement_cache_size=0)`.
- Then PROVE it on a corpus where the planner actually picks the index: assert `idx_scan` moves for
  the ann arm and does NOT move for the exact arm, **with a positive control that fires.**

## WR-03 — probe targets are bound by an unordered first-substring-match

`resolve_probe_targets` runs `SELECT id, filename FROM documents WHERE is_latest = true` with **no
`ORDER BY`**, builds a dict keyed by lowercased filename (arbitrarily dropping one of any pair that
collide), then takes the **first** substring match in that arbitrary iteration order.

Postgres may return rows in any order, and *will* change order after a `VACUUM`, an update, or a
plan change. **So the same probe can bind to a different document run-to-run**, which silently
breaks SC#3's whole promise that *"a later regression is detectable rather than anecdotal"*.
Fix: `ORDER BY filename, id`, and refuse ambiguity rather than picking.

## WR-04 — the probe cache is rebuilt on ANY read failure, and its `embedding_model` is never checked

The cache at `reports/probe-vectors.json` is what makes before/after comparable — 241 used one file
(md5 `5be60f80415a6a74b054e832653d5f48`) across all 26 runs, and says so as a headline. But **any**
read failure silently rebuilds it, and the `embedding_model` recorded inside is written and never
compared. A corrupted file, or a run after the embedding model changes, therefore produces a
*fresh* cache and a comparison that silently is not like-for-like. Fix: refuse rather than rebuild,
and check the model.

# The transferable lesson

⭐ **This project rewrote a harness because it could not report failure, and the replacement's most
important number is the one still hardest to trust.** The Layer-2 figures — real questions, real
documents, a miss scored as a miss — needed none of this machinery and are believable as they
stand. **The elaborate mechanical layer is the part carrying the unproven assumption.**

Related: [[SEED-076]], [[SEED-020]] (retrieval quality, which owns the two probes that miss at BOTH
corpus sizes and are explicitly NOT this defect).
