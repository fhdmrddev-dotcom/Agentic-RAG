# Phase 246 Verification Data: The Recall Cliff and Out-of-the-Box Restoration

**Measurement Date:** 2026-09-13  
**Harness Target Database:** `recall_bench` (`postgresql://postgres:postgres@127.0.0.1:54322/recall_bench`)  
**Live Target Isolation:** Confirmed. Live development database (`postgres`, 169 documents, 7,995 chunks) remained read-only and untouched.

---

## 1 · Corpus & Benchmark Environment

| Property | Value | Notes |
|---|---|---|
| Database Target | `recall_bench` | Dedicated throwaway benchmark database built via `scripts/build-recall-bench.py` |
| Total Document Chunks | 100,000 | 7,995 verbatim copied from live development database + 92,005 synthetic perturbed vectors |
| Total Documents | 3,850 | Synthesized across skewed tenant distribution |
| HNSW Index | `public.document_chunks_embedding_idx` | `vector_cosine_ops`, `m = 16`, `ef_construction = 64` (781.0 MB) |
| Table Storage Size | 1,617.6 MB | Document chunks relation size |
| Evaluated Small Tenant | `bench-skew_0.002` | User ID: `5aa65229-1a8d-4c50-80d3-cac588a43616` |
| Tenant Share of Corpus | 0.002 (0.2%) | Exactly 200 chunks in the 100,000-chunk corpus (`QUEUE-06` cliff shape) |

---

## 2 · Execution Plan Defense

Verification inspected the Postgres execution plan with `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` on the vector search query:

```sql
SELECT id, document_id, 1 - (embedding <=> $1::public.vector) AS similarity
FROM public.document_chunks
WHERE user_id = $2::uuid
ORDER BY embedding <=> $1::public.vector
LIMIT 20
```

* **Execution Plan Node Type:** `Index Scan`
* **Index Name:** `document_chunks_embedding_idx`
* **Index Traversal:** `uses_index = True`
* **Planning / Execution Time:** `1.202 ms`
* **Sequential Scan Trap Avoidance:** Proved that query traversal executes through the pgvector HNSW index structure and does not fall back to a sequential scan.

---

## 3 · Dual-Measurement Results: Recall@20 & Latency Tradeoff

Evaluated across deterministic query vectors sampled from the corpus (`sample_query_vectors(conn, seed="241")`) under `match_document_chunks`:

| Configuration | `hnsw.ef_search` | `recall@20` | Underfill Ratio | p50 Latency (ms) | p95 Latency (ms) | Outcome |
|---|---|---|---|---|---|---|
| **Old Shipped Default** | `40` | **0.045** | **0.955** (95.5% lost) | 3.34 ms | 3.91 ms | **Recall Collapse:** Small tenant starves candidate beam; 95.5% of answers dropped. |
| **New Out-of-the-Box Default** | `200` | **1.000** | **0.000** (0% lost) | 1,081.90 ms | 1,127.65 ms | **Full Recall Restored:** Complete recovery across all sampled queries without operator intervention. |

---

## 4 · Tradeoff Analysis & Conclusions

1. **The Recall Cliff is Real and Reproducible:**
   At `ef_search = 40`, a tenant owning 0.2% of the library suffers a recall collapse to 0.045 (over 95% underfill). Fast answers (3.3 ms) are worthless if 19 out of 20 relevant passages are discarded before tenant filters execute.
2. **200 Restores Complete Recall Out of the Box:**
   Raising the default to `200` in code (`config.py`, `models/user_settings.py`, and `retrieval_tuning.py`) completely eliminates the cliff (`recall@20 = 1.000`) without requiring database migrations.
3. **Latency Profile:**
   At `ef_search = 200`, the query performs deeper index traversal, yielding ~1.1s p95 latency. As established in Phase 241 and documented on the Settings screen, higher values (e.g. 1000) degrade recall due to vector neighborhood graph geometry, proving that 200 is the calibrated sweet spot between search breadth and precision.
