---
seed_id: SEED-273
title: "HNSW iterative scan: Postgres planner cost inflection on selective filters and re-evaluating the recall cliff"
created: 2026-09-13
planted_during: Phase 246 post-execution review (BUS-204)
status: planted
surface: Agentic-RAG
severity: major
category: database / pgvector / retrieval-quality / performance
priority: high
relates_to:
  - backend/app/config.py                                  # :1004 hnsw_iterative_scan: str = "off"; :1007 hnsw_ef_search: int = 40
  - backend/app/services/retrieval_tuning.py               # apply_hnsw_session_knobs
  - backend/app/services/recall_eval.py                    # Layer 1 benchmark harness
  - scripts/build-recall-bench.py                          # 100k-chunk benchmark builder
  - .planning/phases/246-the-recall-cliff-and-the-screen-that-describes-it/246-VERIFICATION-DATA.md  # the empirical ladder
  - .planning/milestones/v4.0-phases/241-recall-at-corpus-scale/241-VALIDATION.md  # Phase 241 measurements
  - .planning/seeds/SEED-076-filtered-vector-search-recall-pgvector-index-scale.md
trigger_when: >
  The next phase touching `backend/app/services/retrieval_tuning.py`, `backend/app/config.py`
  (retrieval knobs), or re-measuring Layer 1 recall. The evaluation MUST re-measure Phase 241 with
  `EXPLAIN (ANALYZE, BUFFERS)` inspected at EVERY point to verify index usage vs sequential scan —
  because SEED-076's "refuted" ordering (0.494–0.684) may itself have crossed the planner's cost
  inflection, leaving that refutation suspect.
trigger_paths:
  - "backend/app/config.py"
  - "backend/app/services/retrieval_tuning.py"
migration_note: |
  `surface:` was normalised to `Agentic-RAG`. Its original line(s), verbatim:
  surface: Agentic-RAG / retrieval / database
---

# The Discovery (Phase 246)

In Phase 246, `match_document_chunks` was evaluated on the 100,000-chunk `recall_bench` database under authenticated context for a tenant owning 0.2% of the library (200 chunks). Direct inspection via `EXPLAIN (ANALYZE, BUFFERS)` proved that **`ef_search` is not a working lever for small-tenant filtered recall**:

```text
 ef_search | Execution Path    | Buffers Read | Rows Returned | recall@20 | Latency (ms)
        40 | HNSW Index Scan   |          280 |             1 |    0.0450 |      4.22 ms
        60 | HNSW Index Scan   |          240 |             1 |    0.0500 |      3.56 ms
        80 | HNSW Index Scan   |          210 |             1 |    0.0500 |      4.13 ms
       100 | Sequential Scan   |      103,456 |            20 |    1.0000 |   1387.91 ms
       150 | Sequential Scan   |      103,612 |            20 |    1.0000 |   1027.91 ms
       200 | Sequential Scan   |      103,771 |            20 |    1.0000 |   1106.35 ms
```

### The Mechanism
1. **At `ef_search <= 80`:** Postgres executes `Index Scan using document_chunks_embedding_idx`. Because `hnsw.iterative_scan = off` post-filters globally fetched graph candidates, the 40–80 global candidates yield only ~0.16 tenant candidates, returning 1 row (`recall@20 = 0.045–0.050`).
2. **At `ef_search >= 100`:** The Postgres query planner's estimated startup cost for the HNSW index scan scales with `ef_search`. At `ef_search = 100`, it exceeds `7189.71` (the cost of a full table scan + Hash Join + Sort). The planner **completely abandons the index** and falls back to a `Seq Scan on document_chunks dc`. It reads 103,771 8KB disk pages (~830 MB) and scans all 100,000 chunks to find the 200 tenant chunks.
3. **The Result:** The "perfect" `recall@20 = 1.000` at `ef_search = 200` was never an index walk. It was a sequential scan that took 1.1 seconds (a 288× latency regression from 3.91 ms to 1,127 ms). Every genuine index walk returned 1 row.

---

# Why Phase 241 and SEED-076 Are Suspect

1. **Phase 241 Measured a Sequential Scan Unawares:**
   Phase 241 concluded that `ef_search = 200` restored recall to 1.000, and QUEUE-06's shipped remedy rested on that conclusion. However, Phase 241 never inspected `EXPLAIN` inside `match_document_chunks`. On the empirical evidence of Phase 246, Phase 241 was measuring a sequential table scan without knowing it.
2. **SEED-076's "Refuted" Ordering is Unproven:**
   SEED-076 recorded `hnsw.iterative_scan` as "refuted" because it supposedly reached only `0.494–0.684` recall. But if those runs also crossed or approached the planner's cost inflection, or if query planner settings (`enable_seqscan`, work_mem, cost factors) varied, the comparison was never clean. The refutation inherited the same defect.

---

# The Real Lever: `hnsw.iterative_scan`

In pgvector 0.8.0, `hnsw.iterative_scan` was introduced specifically for selective filtering queries. Instead of fetching a fixed `ef_search` candidate pool and post-filtering, iterative scan dynamically continues traversing the graph until `LIMIT` valid rows matching the filter are retrieved (or the search space is exhausted).

Currently, `config.py:1004` hardcodes:
```python
hnsw_iterative_scan: str = "off"
```

### Options Available in pgvector 0.8.0:
- `'relaxed_order'`: Scans iteratively, potentially yielding slightly relaxed distance ordering in exchange for avoiding sequential scans and high recall on selective filters.
- `'strict_order'`: Enforces strict distance ordering during iterative traversal.

---

# Actionable Verification Checklist for Trigger Phase

When this seed triggers, the executing phase must:
1. **Re-measure on `recall_bench` (100k chunks, 0.2% tenant):**
   - Test `hnsw.iterative_scan = 'relaxed_order'` and `'strict_order'` at `ef_search = 40, 60, 80, 100`.
2. **Mandatory Execution Plan Inspection at Every Point:**
   - Execute `EXPLAIN (ANALYZE, BUFFERS)` on `match_document_chunks`.
   - Assert `Node Type == "Index Scan"` and `Index Name == "document_chunks_embedding_idx"`.
   - Assert `shared read` buffers are low (< 1,000 blocks, NOT ~103,000 blocks).
3. **Record Dual Metrics:**
   - Record `recall@20`, underfill, and p50/p95 latency.
   - Prove whether iterative scan restores recall to > 0.90 while keeping latency under 20 ms.
