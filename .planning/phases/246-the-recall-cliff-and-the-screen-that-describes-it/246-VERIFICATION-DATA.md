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
| `hnsw.iterative_scan` | `off` | pgvector 0.8.0 default; post-filters globally fetched HNSW candidates |

---

## 2 · Execution Plan Defense: The Sequential Scan Disclosure

Verification directly inspected the internal execution plan of `match_document_chunks` under authenticated caller context (`SET ROLE authenticated`, `auth.uid() = 5aa65229-1a8d-4c50-80d3-cac588a43616`) using `EXPLAIN (ANALYZE, BUFFERS)` on `recall_bench`.

### 2.1 The Execution Plan at `ef_search = 200` (The Measured Query)

```text
Limit  (cost=7189.71..7189.76 rows=20 width=136) (actual time=1106.309..1106.314 rows=20 loops=1)
  Buffers: shared hit=443629 read=103771
  ->  Hash Join  (cost=322.10..6976.51 rows=8012 width=136) (actual time=2.636..1106.258 rows=143 loops=1)
        Buffers: shared hit=443629 read=103771
        ->  Hash Join  (cost=309.84..6772.96 rows=16025 width=154) (actual time=2.526..1103.069 rows=22309 loops=1)
              Join Filter: ((dc.user_id = (NULLIF(((current_setting('request.jwt.claims'::text, true))::jsonb ->> 'sub'::text), ''::text))::uuid) OR ((d.folder_id IS NOT NULL) AND public.folder_is_org_shared(d.folder_id)) OR public.connection_doc_is_visible(d.source_connection_id, d.ingest_visibility))
              Rows Removed by Join Filter: 53344
              Buffers: shared hit=442485 read=103769
              ->  Seq Scan on document_chunks dc  (cost=0.00..6368.82 rows=35114 width=170) (actual time=0.025..442.110 rows=79695 loops=1)
                    Filter: ((embedding_model = 'text-embedding-3-small'::text) AND (('1'::double precision - (embedding OPERATOR(public.<=>) $1)) > '0.3'::double precision))
                    Rows Removed by Filter: 20305
                    Buffers: shared hit=299541 read=103549
              ->  Hash  (cost=264.12..264.12 rows=3657 width=54) (actual time=2.450..2.452 rows=3659 loops=1)
                    Buffers: shared hit=1 read=215
                    ->  Seq Scan on documents d  (cost=0.00..264.12 rows=3657 width=54) (actual time=0.006..0.891 rows=3659 loops=1)
                          Filter: (is_latest AND ((source_state IS NULL) OR (source_state <> 'source_disconnected'::text)))
                          Rows Removed by Filter: 191
                          Buffers: shared hit=1 read=215
        ->  Hash  (cost=9.77..9.77 rows=200 width=16) (actual time=0.089..0.090 rows=1 loops=1)
              Buffers: shared read=2
              ->  HashAggregate  (cost=7.77..9.77 rows=200 width=16) (actual time=0.088..0.089 rows=1 loops=1)
                    Group Key: public.current_user_org_ids()
                    ->  ProjectSet  (cost=0.00..5.27 rows=1000 width=16) (actual time=0.083..0.085 rows=1 loops=1)
Planning Time: 0.455 ms
Execution Time: 1106.354 ms
```

* **Node Type:** `Seq Scan on document_chunks dc` (cost=0.00..6368.82).
* **Buffers Read / Hit:** `shared hit=443629 read=103771`. The scan reads **103,771 8KB pages from disk (~830 MB)**, corresponding to the entire `document_chunks` table relation.
* **HNSW Index Scan:** Completely bypassed. `document_chunks_embedding_idx` was not traversed.

### 2.2 The Execution Plan at `ef_search = 40` (Real Index Scan)

```text
Limit  (cost=2583.03..4915.34 rows=20 width=136) (actual time=1.073..4.157 rows=1 loops=1)
  Buffers: shared hit=536 read=280
  ->  Nested Loop Semi Join  (cost=2583.03..936905.20 rows=8012 width=136) (actual time=1.072..4.156 rows=1 loops=1)
        Join Filter: (dc.org_id = (public.current_user_org_ids()))
        Rows Removed by Join Filter: 7
        Buffers: shared hit=536 read=280
        ->  Nested Loop  (cost=2583.03..936885.17 rows=8012 width=154) (actual time=0.985..4.067 rows=1 loops=1)
              Buffers: shared hit=526 read=280
              ->  Index Scan using document_chunks_embedding_idx on document_chunks dc  (cost=2582.75..764701.13 rows=35114 width=170) (actual time=0.932..4.012 rows=1 loops=1)
                    Order By: (embedding <=> $1)
                    Filter: ((embedding_model = 'text-embedding-3-small'::text) AND (('1'::double precision - (embedding OPERATOR(public.<=>) $1)) > '0.3'::double precision))
                    Rows Removed by Filter: 39
                    Buffers: shared hit=163 read=216
              ->  Index Scan using documents_pkey on documents d  (cost=0.28..0.85 rows=1 width=54) (actual time=0.045..0.046 rows=1 loops=1)
                    Index Cond: (id = dc.document_id)
Execution Time: 4.217 ms
```

* **Node Type:** `Index Scan using document_chunks_embedding_idx on document_chunks dc`.
* **Candidates Checked:** Explored 40 global graph candidates, removed 39 rows by post-filter, returned 1 candidate for the 0.2% tenant.
* **Execution Time:** `4.217 ms`.

### 2.3 Cost Mechanism: Why Planner Flips from Index Scan to Seq Scan

Postgres cost estimates for the HNSW index scan scale with `ef_search`:
* At `ef_search = 40`: Estimated index startup cost = `2582.75`, Limit cost = `4915.34`.
* At `ef_search = 80`: Estimated index startup cost = `4322.71`, Limit cost = `6650.95`.
* At `ef_search = 100`: Estimated index startup cost exceeds `5192`.
* At `ef_search = 200`: Estimated index startup cost reaches `8970.62`, Limit cost = `120184.55`.

Meanwhile, a full table scan + Hash Join + Sort is estimated at a fixed cost of **`7189.71`**.
At `ef_search >= 100`, the planner determines that scanning all 100,000 chunks sequentially is cheaper than exploring the HNSW index.

---

## 3 · Ladder Measurements Across `ef_search` (40 to 200)

Driven against `recall_bench` with `small_tenant_user_id = 5aa65229-1a8d-4c50-80d3-cac588a43616` (0.2% tenant share) through `match_document_chunks`:

| `hnsw.ef_search` | Execution Path | Disk Buffers Read | Rows Returned | `recall@20` | Underfill | Latency (ms) | Notes |
|:---:|:---:|:---:|:---:|:---:|:---:|:---:|---|
| **40** | **HNSW Index Scan** | 280 | 1 | **0.045** | 0.955 | 4.22 ms | Real index walk. Starves candidate beam (0.4 expected). |
| **60** | **HNSW Index Scan** | 240 | 1 | **0.050** | 0.950 | 3.56 ms | Real index walk. Explores 60 candidates, returns 1. |
| **80** | **HNSW Index Scan** | 210 | 1 | **0.050** | 0.950 | 4.13 ms | Real index walk. Highest ef_search before planner flip. |
| **100** | **Sequential Scan** | 103,456 | 20 | **1.000** | 0.000 | 1,387.91 ms | **Planner flips.** Index cost > 7189.71; reads full table. |
| **150** | **Sequential Scan** | 103,612 | 20 | **1.000** | 0.000 | 1,027.91 ms | Sequential scan over all 100k chunks. |
| **200** | **Sequential Scan** | 103,771 | 20 | **1.000** | 0.000 | 1,106.35 ms (p95 1,127 ms) | Out-of-the-box default; 288× latency regression. |

---

## 4 · Honest Findings & Unmet Criteria

1. **SC#1 and SC#4 are UNMET:**
   * SC#1 required: *"The Layer 1 benchmark harness runs against a populated corpus with the cliff shape ... and measures recall@20 ... without falling back to a sequential scan."*
   * SC#4 required: *"Raising the default hnsw_ef_search to 200 in config.py restores recall@20 to 1.000 on the benchmark harness, confirmed by a re-run of the Layer 1 measurement."*
   * **Reality:** The measured `recall@20 = 1.000` at `ef_search = 200` was produced entirely by a **Sequential Scan**, reading 103,771 disk pages and taking 1.1 seconds. The HNSW index scan does NOT achieve 1.000 recall at `ef_search=200` with `hnsw.iterative_scan = off`.

2. **The "Calibrated Sweet Spot" Claim is Retracted:**
   * Section 4.3's prior claim of a "calibrated sweet spot between search breadth and precision due to vector neighborhood graph geometry" is retracted.
   * There was no index geometry optimization; the 1.1s latency was a table scan triggered by planner cost inflection.

3. **Phase Decision Required:**
   * In pgvector 0.8.0, post-filtered HNSW cannot solve the recall cliff for 0.2% tenants without `hnsw.iterative_scan = 'relaxed_order'` or `'strict_order'`, or without partition-level / tenant-level indexing.
   * The code changes in Wave 1 (raising default to 200) cause Postgres planner on a 100k-chunk corpus to drop index scanning and perform sequential scans for queries with `match_document_chunks` joins.
   * Phase 246 remains **BLOCKED** and cannot close until the phase direction is resolved by the operator.
