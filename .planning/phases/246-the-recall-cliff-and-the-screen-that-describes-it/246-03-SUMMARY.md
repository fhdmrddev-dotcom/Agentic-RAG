---
phase: 246-the-recall-cliff-and-the-screen-that-describes-it
plan: 03
subsystem: backend / recall-evaluation
tags: [recall, benchmark, hnsw, ef_search, sequential_scan, explain_analyze, pgvector, hot-file-ledger]
requires:
  - "Phase 246 Plan 01 (retrieval tuning probe & knobs)"
  - "Phase 241 (build-recall-bench.py throwaway harness)"
provides:
  - "Empirical EXPLAIN (ANALYZE, BUFFERS) execution plan evidence inside match_document_chunks"
  - "The ef_search ladder (40, 60, 80, 100, 120, 150, 200) demonstrating the cost inflection cliff"
  - "Disclosure that recall@20 = 1.000 at ef_search=200 was a 1.1s full Sequential Scan"
  - "Corrective re-evaluation of Phase 241 and D-v4.0-EF-DEFAULT assumptions"
  - "Synced hot-file ledger entries for recall_eval.py (4/3/1070 FIRES) and settingsSearchPayload.ts (2/2/116)"
affects:
  - "backend/app/services/recall_eval.py"
  - "docs/HOT-FILE-LEDGER.md"
  - "CLAUDE.md"
  - "backend/tests/unit/test_246_recall_measurement.py"
  - ".planning/phases/246-the-recall-cliff-and-the-screen-that-describes-it/246-VERIFICATION-DATA.md"
tech-stack:
  added: []
  patterns:
    - "Automated execution-plan inspection via EXPLAIN (ANALYZE, BUFFERS) inside PL/pgSQL functions"
    - "Targeted database isolation: benchmark harness runs strictly against recall_bench (live DB read-only)"
    - "Cost-inflection threshold analysis of pgvector HNSW index scan vs table scan + sort"
key-files:
  created:
    - backend/tests/unit/test_246_recall_measurement.py
    - .planning/phases/246-the-recall-cliff-and-the-screen-that-describes-it/246-VERIFICATION-DATA.md
  modified:
    - backend/app/services/recall_eval.py
    - docs/HOT-FILE-LEDGER.md
    - CLAUDE.md
decisions:
  - "Blocker A resolved: Built dedicated throwaway benchmark database `recall_bench` (100,000 chunks) via `scripts/build-recall-bench.py`. Live dev database (`postgres`) was opened read-only and untouched."
  - "Blocker B & G-3 resolved: `recall_eval.py` triple synced to `4 / 3 / 1070 | ⚠ FIRES` and added to CLAUDE.md G-5 FIRING table. `settingsSearchPayload.ts` synced to `2 / 2 / 116 | no (2 phases)`."
  - "Sequential Scan Disclosure: `EXPLAIN (ANALYZE, BUFFERS)` proved that `ef_search >= 100` flips from HNSW index scan to Sequential Scan reading 103,771 pages (~830 MB) and taking 1,106 ms."
  - "Sweet-spot claim retracted: Retracted 'calibrated sweet spot' and 'vector neighborhood graph geometry' claims; 200 was a table scan, not a graph geometry optimum."
  - "SC#1 & SC#4 UNMET: Declared SC#1 and SC#4 unmet. Phase 246 blocked. Default reverted to 40 in `521f4a025`."
metrics:
  duration: "~1h 30m"
  completed: 2026-09-13
  tasks: 3
  commits: 4
  files_changed: 5
verification_mode: reviewed
reviewer: claude
reviewed_at: 2026-09-13
---

# Phase 246 Plan 03: Benchmark Evaluation, Execution Plan Defense, and the Sequential Scan Disclosure — Summary

## 1 · Corpus & Benchmark Environment

All Layer 1 benchmark runs were isolated to the dedicated throwaway benchmark database `recall_bench`, built using `scripts/build-recall-bench.py`:
- **Database Target:** `postgresql://postgres:postgres@127.0.0.1:54322/recall_bench`
- **Total Document Chunks:** 100,000 (7,995 copied from live `postgres` + 92,005 synthetic perturbed vectors).
- **Total Documents:** 3,850.
- **HNSW Index:** `public.document_chunks_embedding_idx` (`vector_cosine_ops`, `m = 16`, `ef_construction = 64`, size: 781.0 MB).
- **Evaluated Small Tenant:** `bench-skew_0.002` (`user_id = 5aa65229-1a8d-4c50-80d3-cac588a43616`, owning exactly 200 chunks / 0.2% of corpus).
- **Live Database Isolation:** Confirmed. The live development database (`postgres`, 169 docs, 7,995 chunks) remained read-only and untouched.

---

## 2 · Execution Plan Defense: The Sequential Scan Disclosure

Verification directly inspected the internal execution plan of `match_document_chunks` under authenticated caller context (`SET ROLE authenticated`, `auth.uid() = 5aa65229-1a8d-4c50-80d3-cac588a43616`) using `EXPLAIN (ANALYZE, BUFFERS)` on `recall_bench`.

### 2.1 The Execution Plan at `ef_search = 200` (The Shipped Query)

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

- **Node Type:** `Seq Scan on document_chunks dc` (cost=0.00..6368.82).
- **Buffers:** Reads **103,771 8KB disk pages (~830 MB)**, with 443,629 shared buffer hits.
- **Index Traversal:** `document_chunks_embedding_idx` was completely bypassed.

### 2.2 The Execution Plan at `ef_search = 40` (Genuine Index Scan)

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

- **Node Type:** `Index Scan using document_chunks_embedding_idx on document_chunks dc`.
- **Execution Time:** **4.217 ms** (reading only 280 disk pages).
- **Candidates Checked:** Explored 40 global graph candidates, removed 39 rows by post-filter, returned 1 candidate for the 0.2% tenant (`recall@20 = 0.045`).

### 2.3 The Cost Inflection Mechanism

Postgres cost estimates for the HNSW index scan scale with `ef_search`:
- At `ef_search = 40`: Estimated index startup cost = `2582.75`, Limit cost = `4915.34`.
- At `ef_search = 80`: Estimated index startup cost = `4322.71`, Limit cost = `6650.95`.
- At `ef_search >= 100`: Estimated index startup cost crosses the fixed cost of a full table scan + Hash Join + Sort (**`7189.71`**).
- At `ef_search = 200`: Estimated index startup cost reaches `8970.62`, and total index plan cost reaches `120184.55`.

At `ef_search >= 100`, the Postgres query planner concludes that scanning all 100,000 chunks sequentially is cheaper than walking the HNSW graph. It abandons the index.

---

## 3 · The `ef_search` Ladder (40 to 200)

Evaluated across deterministic query vectors on `recall_bench` for tenant `bench-skew_0.002`:

| `hnsw.ef_search` | Execution Path | Disk Buffers Read | Rows Returned | `recall@20` | Underfill | Latency | Notes |
|:---:|:---:|:---:|:---:|:---:|:---:|:---:|---|
| **40** | **HNSW Index Scan** | 280 | 1 | **0.045** | 0.955 | 4.22 ms | Real index walk. Explores 40 global nodes, post-filters to 1 row. |
| **60** | **HNSW Index Scan** | 240 | 1 | **0.050** | 0.950 | 3.56 ms | Real index walk. Explores 60 global nodes, returns 1 row. |
| **80** | **HNSW Index Scan** | 210 | 1 | **0.050** | 0.950 | 4.13 ms | Real index walk. Highest value before planner cost flip. |
| **100** | **Sequential Scan** | 103,456 | 20 | **1.000** | 0.000 | 1,387.91 ms | **Planner flips.** Index cost > 7189.71; reads full table. |
| **120** | **Sequential Scan** | 103,502 | 20 | **1.000** | 0.000 | 1,171.17 ms | Full table scan. |
| **150** | **Sequential Scan** | 103,612 | 20 | **1.000** | 0.000 | 1,027.91 ms | Full table scan. |
| **200** | **Sequential Scan** | 103,771 | 20 | **1.000** | 0.000 | 1,106.35 ms | Full table scan; 288× latency regression. |

### Finding: There is No Intermediate Knee
Every genuine index walk ($\le 80$) returns exactly **one row** (~0.05 recall) in ~4 ms. Every good recall number ($\ge 100$) is a **full table scan** taking over a second. Raising `ef_search` does not repair the cliff; it accidentally disables the index.

---

## 4 · Consequence for Phase 241 and D-v4.0-EF-DEFAULT

1. **Phase 241 Measurement Inherited the Blind Spot:**
   - Phase 241 concluded that `ef_search = 200` restored recall to 1.000, and QUEUE-06's shipped remedy rested on that.
   - However, Phase 241 never inspected `EXPLAIN` inside `match_document_chunks` on the benchmark harness. In reality, Phase 241 was measuring a Sequential Scan too, and mistook the table scan's perfect recall for index recovery.
2. **D-v4.0-EF-DEFAULT Reversal was Unsound:**
   - At the v4.0 close, `D-v4.0-EF-DEFAULT` left the default at 40. Phase 246 re-opened and reversed it on the assumption that 200 restored index recall.
   - Because 200 is a table scan on skewed 100k-chunk corpora, the reversal was based on a measurement that did not mean what it claimed.
3. **The Real Lever:**
   - In pgvector 0.8.0, post-filtered HNSW cannot solve the recall cliff for small tenants without `hnsw.iterative_scan = 'relaxed_order'` or `'strict_order'`.
   - SEED-076's recording that iterative_scan alone was "refuted" (0.494–0.684) is now suspect as well, because those runs may also have crossed a cost inflection without plan inspection.

---

## 5 · Register Fixes & Gate Verification

1. **Hot-File Ledger (G-3):**
   - Corrected `backend/app/services/recall_eval.py` to `4 / 3 / 1070 | ⚠ FIRES` in `docs/HOT-FILE-LEDGER.md` and added it to the `CLAUDE.md` G-5 FIRING table.
   - Synced `frontend/src/pages/settingsSearchPayload.ts` to `2 / 2 / 116 | no (2 phases)`.
   - `node scripts/check-hot-file-ledger.cjs 246`: **0 missing rows**.
   - `node scripts/check-claude-md-size.cjs`: **99,625 chars (OK)**.
2. **TypeScript:**
   - `npx tsc -p tsconfig.app.json --noEmit`: Exact 67 baseline errors (0 new errors).
3. **Status:**
   - `SC#1` and `SC#4` are **UNMET**.
   - In commit `521f4a025`, the operator reverted the default to 40 across backend, frontend, and tests.
   - Planted `SEED-273` for `hnsw.iterative_scan`.
