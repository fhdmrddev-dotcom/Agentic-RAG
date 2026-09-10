# ⚠ Correction to 241-VALIDATION.md — the "control" rows were measured on a SEQUENTIAL SCAN

Measured 2026-09-10 by the orchestrator, after `241-REVIEW.md` raised **WR-02** (the Layer-1
"exact" arm may not be exact, because plpgsql plan caching can defeat `enable_indexscan = off`).
WR-02 itself came out **neither confirmed nor refuted**. What the investigation *did* establish is
more consequential, and it changes how one sentence of the verdict should be read.

## The measurement

On the operator's real local database, 7,959 chunks:

```
lifetime index usage on document_chunks:
   document_chunks_embedding_idx              idx_scan=0        68 MB
   document_chunks_pkey                       idx_scan=0        344 kB
   document_chunks_search_vector_idx          idx_scan=0        6328 kB
   idx_document_chunks_org_id                 idx_scan=15       128 kB

bare ANN query plan on the REAL corpus:
   Limit  (cost=1767.29..1767.34 rows=20)
     ->  Sort  (cost=1767.29..1787.25 rows=7985)
           ->  Seq Scan on document_chunks  (cost=0.00..1554.81 rows=7985)
```

**`document_chunks_embedding_idx` has never been scanned — not once, in the life of the database —
and it occupies 68 MB.** At 7,959 rows a sequential scan plus a sort is cheaper than walking the
HNSW graph, so the planner never chooses the index.

## What this corrects

`241-VALIDATION.md`'s SC#1 table compares:

| Run | Corpus | Hit@1 |
|---|---|---|
| Control — real database, shipped config | 7,959 chunks | **0.78** |
| Bench at 100,000, shipped config | 100,000 chunks | **0.44** |

The verdict reads that delta as *selectivity starving `hnsw.ef_search = 40`*. **The mechanism is
real and the 100k half is measured on the index path** — `ef_search` demonstrably moved recall
there (0.44 → 0.78 at 200), and `ef_search` can only affect an HNSW index scan. But the **control
half was not on that path at all.** It was an exact sequential scan, which is why it scores 0.78:
a seq scan cannot "miss" a near neighbour.

⭐ **So the honest statement of the before/after is one step longer than the verdict gives it:**

> At small scale the planner chooses an exact sequential scan, so recall is whatever the embedding
> quality allows. As the corpus grows the planner switches to the approximate HNSW index — and it
> is only *then* that the seven always-on predicates starve a 40-candidate budget. **The transition
> is a PLAN CHANGE followed by selectivity starvation, not a smooth degradation of one path.**

This does not overturn SC#1 and it does not soften the finding — if anything it sharpens the
warning, because **the degradation is a cliff, not a slope.** An install can sit comfortably at
0.78 with no index scans at all, cross the planner's threshold on an ordinary Tuesday, and land on
the approximate path with no configuration having changed and nothing to notice.

⚠ **It does mean one thing must not be claimed:** that the two rows differ *only* in corpus size.
They differ in corpus size **and** in execution plan, and this phase did not measure where the
crossover sits.

## WR-02's actual status: OPEN, and untestable on this corpus

The proposed test — assert `pg_stat_user_indexes.idx_scan` does not move during the exact arm —
**cannot work on the real corpus, because the index never moves for anyone.** Both arms read `+0`
whether or not the GUC is honoured. Measured:

```
as the harness ships (cache=100, no plan_cache_mode): HNSW idx_scan during exact arm = +0
with the review's fix  (cache=0,  force_custom_plan) : HNSW idx_scan during exact arm = +0
POSITIVE CONTROL - index scans with the planner FREE : +0     <-- the test is BLIND
```

⭐ **The positive control is the only reason this is known.** Without it, `+0` in the "off" arm
reads as *"the GUC worked"* and WR-02 would have been closed on evidence that could not have
detected the defect. **A test whose positive control does not fire has measured nothing** — this
project's own recurring lesson, arriving here from a new direction.

**WR-02 therefore stays OPEN**, and its re-test requires a corpus large enough that the planner
chooses the index — i.e. the bench, which was torn down. The direction of the possible error
*understates* the collapse, so the headline verdict survives either way; what remains unproven is
the per-shape `recall_at_k = 1.000` readings in SC#2.

## An operational finding worth acting on separately

**The 68 MB HNSW index on this install is dead weight today** — it is maintained on every write and
read by nothing. That is not a defect (it is there for when the corpus grows, and it is what makes
the growth safe), but an operator should know that:

- **index size is not evidence the index is in use**, and
- **the first day it IS used is the day recall can drop**, with no deploy and no setting change.

⭐ **That is the strongest practical argument for the two knobs this phase shipped**: they are the
controls you need at exactly the moment nothing else changed.
