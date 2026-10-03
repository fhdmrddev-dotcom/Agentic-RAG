---
phase: 272-close-means-wrong
requirement: FIND-07
nyquist_validation: false
written_at: planning (2026-10-03)
filled_by: 272-05
---

# Phase 272: Close Means Wrong — Validation

This file is the home of the phase's UAT rows (CLAUDE.md "UAT scoreboard recipe": rows live here,
never inside PLAN tasks). Plans 01-04 prove behaviour with automated suites; **272-05 fills every
table below** with measured results and evidence paths. A row is never deleted: a row that cannot be
run is marked ⛔ with its reason and the blocking id.

## 1. Automated test map (Req / SC / decision → suite)

| Item | Behaviour | Suite (plan) |
|---|---|---|
| D-13 | Moved functions AST-identical to base; unfiltered RPC SQL + args pinned | `tests/unit/test_272_pure_move.py` (01) |
| D-13 | Default predicates are DATA; an appended `enforced_in_rpc=False` predicate forces a resolved scope with no new branch | `tests/unit/test_272_scope_seam.py` (01) |
| D-15 | Handler moved; registry still 29; retargeted patches proven hit | `tests/unit/test_272_search_tool_move.py` + `test_259/261_closed_core_inventory.py` + `test_085_tool_registration.py` (01) |
| D-03 | `filters` schema: op enum == `ViewCondition.op`; no anyOf/oneOf/additionalProperties/type-arrays; survives the Google sanitizer; `types.Tool` constructs | `tests/unit/test_272_tool_schema.py` (02) |
| D-08 | "Filtered: …" line from args; visible text in both card branches; null when unfiltered | `src/lib/__tests__/toolMeta.test.ts`, `src/__tests__/components/ToolCallPanel.test.tsx` (02) |
| D-14 / D-18 / Pitfall 6-8 | Migration 200: one signature per name; anon/PUBLIC no EXECUTE; empty array → 0 rows; cross-org ids → 0 rows; exact branch has no HNSW node; btree index used | `tests/integration/test_272_rpc_document_scope.py` (03) |
| D-19 | Both arms receive the SAME `p_document_ids`; folder scope still passed; unfiltered call byte-identical | `tests/unit/test_272_filtered_both_arms.py` (03) |
| D-10 | Matched set with no passage over threshold → top passages marked `low_similarity` | `tests/unit/test_272_filtered_both_arms.py` (03) |
| D-21 / D-06 / D-11 / D-23 / Pitfall 2 | Ids, undated count, nearby values, document types are RLS-decided (org B never counted) | `tests/integration/test_272_scope_rls.py` (03), `tests/unit/test_272_scope_resolver.py` (03) |
| D-04 / D-20 | Unknown field / enum value refused with the valid list; mixed-case value canonicalised to the stored spelling | `tests/unit/test_272_filter_validation.py` (04) |
| SC#2 / D-18 | Empty set → kind 2 with ZERO retrieval calls | `tests/unit/test_272_result_kinds.py` (04) |
| SC#2 / D-09 | Dropping a zero-matched field is refused; same field new value allowed; state survives iterations; shared with sub-agents | `tests/unit/test_272_retry_lock.py` (04) |
| SC#1 / D-12 | Audit row carries `filters` + `result_kind` from ONE writer | `tests/unit/test_272_result_kinds.py`, re-driven `tests/unit/test_268_search_audit_keys.py` (04) |
| D-07 / D-02 / D-22 / D-23 | Date line; removed guidance absent; filtered-empty rule present; vocabulary substituted once per run | `tests/unit/test_272_prompt_and_vocabulary.py` (04) |
| D-24 | Kind 3 + refused rows excluded from "found nothing"; kind 2 still counts | `tests/unit/test_272_knowledge_health_kinds.py` (04) |

## 2. SC#3 — the recall ladder (SEED-273 checklist), filled by 272-05

Bench: `recall_bench` (rebuilt or migrated to 200). Every point records: recall@k vs the exact arm,
p50/p95 ms, the plan node + index name read from the body-statement EXPLAIN JSON (custom AND generic
plan), and `shared read` buffers. ⛔ Never the `pg_stat_user_indexes` counter fallback.

**Measured 2026-10-03 by 272-05** (`scripts/measure-filtered-recall.py`; raw JSON
`evidence/recall-ladder.json` and `evidence/recall-ladder-15000.json`). Bench `recall_bench`:
100,000 chunks, pgvector 0.8.0; caller `7fcfb80e-…` (69,805 chunks, its own org). Each filtered set
is a disjoint group of latest 25-chunk documents given a bench-only `metadata.date` month (2031-01 …
2031-06) and resolved by a date RANGE, the way a filter resolves it. 25 query vectors (seed `272`,
sampled from the caller's chunks), k = 20, threshold `FILTERED_MATCH_FLOOR` (-2.0) on filtered
calls. Ground truth: an independent exact statement on an owner connection with index scans off.
Calls made the production way (`SET LOCAL ROLE authenticated` + both claim GUCs; knobs through the
shipped `apply_hnsw_session_knobs`); warm cache (one untimed pass first). EXPLAIN: the two body
statements copied from `pg_get_functiondef`, `PREPARE` + `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
EXECUTE` under `force_custom_plan` and `force_generic_plan`, owner connection with the caller's claim
GUCs (the body runs as the DEFINER, so `SET ROLE authenticated` would add RLS quals the body never
sees). ⛔ `pg_stat_user_indexes.idx_scan` is never read. The function carries
`plan_cache_mode=force_custom_plan` (migration 201, below), so the CUSTOM column is what runs; the
GENERIC column is what would run without that pin.

Node key: BHS = Bitmap Heap Scan, BIS = Bitmap Index Scan, IS = Index Scan, Seq = Seq Scan;
`btree:document_id` = `idx_document_chunks_document_id`, `HNSW` = `document_chunks_embedding_idx`.

| Filtered set (chunks) | Branch | iterative_scan | ef_search | recall@20 (min) | p50 / p95 ms | node / index (custom · generic) | shared read (custom · generic) | Verdict |
|---|---|---|---|---|---|---|---|---|
| unfiltered (control) | index | off | 40 | 0.89 (min 0.0) | 12.54 / 34.41 | IS[HNSW] → IS[documents_pkey] · Seq(documents) → BHS(document_chunks) → BIS[btree:document_id] | 0 · 99795 | control (global knobs, unchanged) |
| 500 | exact | — | — | 1.0 (min 1.0) | 12.27 / 17.84 | BHS(document_chunks) → BIS[btree:document_id] → IS[documents_pkey] · Seq(documents) → IS[btree:document_id] | 0 · 0 | btree, no HNSW ✅ |
| 500 | index | strict_order | 40 | 1.0 (min 1.0) | 11.52 / 13.69 | BHS(document_chunks) → BIS[btree:document_id] → IS[documents_pkey] · Seq(documents) → BHS(document_chunks) → BIS[btree:document_id] | 0 · 99856 | planner chose btree (no HNSW node) |
| 500 | index | strict_order | 60 | 1.0 (min 1.0) | 11.53 / 19.69 | BHS(document_chunks) → BIS[btree:document_id] → IS[documents_pkey] · Seq(documents) → BHS(document_chunks) → BIS[btree:document_id] | 0 · 100045 | planner chose btree (no HNSW node) |
| 500 | index | strict_order | 80 | 1.0 (min 1.0) | 8.96 / 11.76 | BHS(document_chunks) → BIS[btree:document_id] → IS[documents_pkey] · Seq(documents) → BHS(document_chunks) → BIS[btree:document_id] | 0 · 100041 | planner chose btree (no HNSW node) |
| 500 | index | strict_order | 100 | 1.0 (min 1.0) | 10.1 / 11.84 | BHS(document_chunks) → BIS[btree:document_id] → IS[documents_pkey] · Seq(documents) → BHS(document_chunks) → BIS[btree:document_id] | 0 · 100040 | planner chose btree (no HNSW node) |
| 500 | index | relaxed_order | 40 | 1.0 (min 1.0) | 10.54 / 14.01 | BHS(document_chunks) → BIS[btree:document_id] → IS[documents_pkey] · Seq(documents) → BHS(document_chunks) → BIS[btree:document_id] | 0 · 100042 | planner chose btree (no HNSW node) |
| 500 | index | relaxed_order | 60 | 1.0 (min 1.0) | 11.93 / 17.26 | BHS(document_chunks) → BIS[btree:document_id] → IS[documents_pkey] · Seq(documents) → BHS(document_chunks) → BIS[btree:document_id] | 0 · 100044 | planner chose btree (no HNSW node) |
| 500 | index | relaxed_order | 80 | 1.0 (min 1.0) | 9.91 / 14.67 | BHS(document_chunks) → BIS[btree:document_id] → IS[documents_pkey] · Seq(documents) → BHS(document_chunks) → BIS[btree:document_id] | 0 · 100042 | planner chose btree (no HNSW node) |
| 500 | index | relaxed_order | 100 | 1.0 (min 1.0) | 11.11 / 13.02 | BHS(document_chunks) → BIS[btree:document_id] → IS[documents_pkey] · Seq(documents) → BHS(document_chunks) → BIS[btree:document_id] | 0 · 100046 | planner chose btree (no HNSW node) |
| 500 | index | off | 40 | 1.0 (min 1.0) | 9.79 / 12.13 | BHS(document_chunks) → BIS[btree:document_id] → IS[documents_pkey] · Seq(documents) → BHS(document_chunks) → BIS[btree:document_id] | 0 · 100043 | planner chose btree (no HNSW node) |
| 1,000 | exact | — | — | 1.0 (min 1.0) | 18.85 / 19.8 | BHS(document_chunks) → BIS[btree:document_id] → Seq(documents) · Seq(documents) → IS[btree:document_id] | 0 · 0 | btree, no HNSW ✅ |
| 1,000 | index | strict_order | 40 | 1.0 (min 1.0) | 18.7 / 24.25 | BHS(document_chunks) → BIS[btree:document_id] → Seq(documents) · Seq(documents) → BHS(document_chunks) → BIS[btree:document_id] | 0 · 99795 | planner chose btree (no HNSW node) |
| 1,000 | index | strict_order | 60 | 1.0 (min 1.0) | 19.82 / 28.48 | BHS(document_chunks) → BIS[btree:document_id] → Seq(documents) · Seq(documents) → BHS(document_chunks) → BIS[btree:document_id] | 0 · 99938 | planner chose btree (no HNSW node) |
| 1,000 | index | strict_order | 80 | 1.0 (min 1.0) | 17.97 / 20.41 | BHS(document_chunks) → BIS[btree:document_id] → Seq(documents) · Seq(documents) → BHS(document_chunks) → BIS[btree:document_id] | 0 · 99939 | planner chose btree (no HNSW node) |
| 1,000 | index | strict_order | 100 | 1.0 (min 1.0) | 17.77 / 23.21 | BHS(document_chunks) → BIS[btree:document_id] → Seq(documents) · Seq(documents) → BHS(document_chunks) → BIS[btree:document_id] | 0 · 99939 | planner chose btree (no HNSW node) |
| 1,000 | index | relaxed_order | 40 | 1.0 (min 1.0) | 20.52 / 25.51 | BHS(document_chunks) → BIS[btree:document_id] → Seq(documents) · Seq(documents) → BHS(document_chunks) → BIS[btree:document_id] | 0 · 99940 | planner chose btree (no HNSW node) |
| 1,000 | index | relaxed_order | 60 | 1.0 (min 1.0) | 20.29 / 31.29 | BHS(document_chunks) → BIS[btree:document_id] → Seq(documents) · Seq(documents) → BHS(document_chunks) → BIS[btree:document_id] | 0 · 99938 | planner chose btree (no HNSW node) |
| 1,000 | index | relaxed_order | 80 | 1.0 (min 1.0) | 19.81 / 24.88 | BHS(document_chunks) → BIS[btree:document_id] → Seq(documents) · Seq(documents) → BHS(document_chunks) → BIS[btree:document_id] | 0 · 99939 | planner chose btree (no HNSW node) |
| 1,000 | index | relaxed_order | 100 | 1.0 (min 1.0) | 21.24 / 37.08 | BHS(document_chunks) → BIS[btree:document_id] → Seq(documents) · Seq(documents) → BHS(document_chunks) → BIS[btree:document_id] | 0 · 99938 | planner chose btree (no HNSW node) |
| 1,000 | index | off | 40 | 1.0 (min 1.0) | 19.77 / 29.96 | BHS(document_chunks) → BIS[btree:document_id] → Seq(documents) · Seq(documents) → BHS(document_chunks) → BIS[btree:document_id] | 0 · 99939 | planner chose btree (no HNSW node) |
| 2,000 | exact | — | — | 1.0 (min 1.0) | 34.42 / 46.2 | BHS(document_chunks) → BIS[btree:document_id] → Seq(documents) · Seq(documents) → IS[btree:document_id] | 0 · 0 | btree, no HNSW ✅ |
| 2,000 | index | strict_order | 40 | 1.0 (min 1.0) | 34.95 / 67.94 | BHS(document_chunks) → BIS[btree:document_id] → Seq(documents) · Seq(documents) → BHS(document_chunks) → BIS[btree:document_id] | 0 · 99812 | planner chose btree (no HNSW node) |
| 2,000 | index | strict_order | 60 | 1.0 (min 1.0) | 38.48 / 48.73 | BHS(document_chunks) → BIS[btree:document_id] → Seq(documents) · Seq(documents) → BHS(document_chunks) → BIS[btree:document_id] | 0 · 99944 | planner chose btree (no HNSW node) |
| 2,000 | index | strict_order | 80 | 1.0 (min 1.0) | 37.24 / 48.49 | BHS(document_chunks) → BIS[btree:document_id] → Seq(documents) · Seq(documents) → BHS(document_chunks) → BIS[btree:document_id] | 0 · 99947 | planner chose btree (no HNSW node) |
| 2,000 | index | strict_order | 100 | 1.0 (min 1.0) | 39.03 / 56.21 | BHS(document_chunks) → BIS[btree:document_id] → Seq(documents) · Seq(documents) → BHS(document_chunks) → BIS[btree:document_id] | 0 · 99961 | planner chose btree (no HNSW node) |
| 2,000 | index | relaxed_order | 40 | 1.0 (min 1.0) | 36.83 / 45.38 | BHS(document_chunks) → BIS[btree:document_id] → Seq(documents) · Seq(documents) → BHS(document_chunks) → BIS[btree:document_id] | 0 · 99955 | planner chose btree (no HNSW node) |
| 2,000 | index | relaxed_order | 60 | 1.0 (min 1.0) | 38.32 / 62.09 | BHS(document_chunks) → BIS[btree:document_id] → Seq(documents) · Seq(documents) → BHS(document_chunks) → BIS[btree:document_id] | 0 · 99953 | planner chose btree (no HNSW node) |
| 2,000 | index | relaxed_order | 80 | 1.0 (min 1.0) | 34.03 / 43.87 | BHS(document_chunks) → BIS[btree:document_id] → Seq(documents) · Seq(documents) → BHS(document_chunks) → BIS[btree:document_id] | 0 · 99946 | planner chose btree (no HNSW node) |
| 2,000 | index | relaxed_order | 100 | 1.0 (min 1.0) | 31.38 / 35.25 | BHS(document_chunks) → BIS[btree:document_id] → Seq(documents) · Seq(documents) → BHS(document_chunks) → BIS[btree:document_id] | 0 · 99951 | planner chose btree (no HNSW node) |
| 2,000 | index | off | 40 | 1.0 (min 1.0) | 35.77 / 51.12 | BHS(document_chunks) → BIS[btree:document_id] → Seq(documents) · Seq(documents) → BHS(document_chunks) → BIS[btree:document_id] | 0 · 99947 | planner chose btree (no HNSW node) |
| 5,000 | exact | — | — | 1.0 (min 1.0) | 77.28 / 108.24 | BHS(document_chunks) → BIS[btree:document_id] → Seq(documents) · Seq(documents) → IS[btree:document_id] | 0 · 0 | btree, no HNSW ✅ |
| 5,000 | index | strict_order | 40 | 1.0 (min 1.0) | 88.34 / 125.19 | BHS(document_chunks) → BIS[btree:document_id] → Seq(documents) · Seq(documents) → BHS(document_chunks) → BIS[btree:document_id] | 0 · 99927 | planner chose btree (no HNSW node) |
| 5,000 | index | strict_order | 60 | 1.0 (min 1.0) | 72.24 / 92.29 | BHS(document_chunks) → BIS[btree:document_id] → Seq(documents) · Seq(documents) → BHS(document_chunks) → BIS[btree:document_id] | 0 · 100000 | planner chose btree (no HNSW node) |
| 5,000 | index | strict_order | 80 | 1.0 (min 1.0) | 70.15 / 86.69 | BHS(document_chunks) → BIS[btree:document_id] → Seq(documents) · Seq(documents) → BHS(document_chunks) → BIS[btree:document_id] | 0 · 99977 | planner chose btree (no HNSW node) |
| 5,000 | index | strict_order | 100 | 1.0 (min 1.0) | 72.14 / 90.26 | BHS(document_chunks) → BIS[btree:document_id] → Seq(documents) · Seq(documents) → BHS(document_chunks) → BIS[btree:document_id] | 0 · 99971 | planner chose btree (no HNSW node) |
| 5,000 | index | relaxed_order | 40 | 1.0 (min 1.0) | 76.27 / 120.83 | BHS(document_chunks) → BIS[btree:document_id] → Seq(documents) · Seq(documents) → BHS(document_chunks) → BIS[btree:document_id] | 0 · 100007 | planner chose btree (no HNSW node) |
| 5,000 | index | relaxed_order | 60 | 1.0 (min 1.0) | 73.77 / 85.77 | BHS(document_chunks) → BIS[btree:document_id] → Seq(documents) · Seq(documents) → BHS(document_chunks) → BIS[btree:document_id] | 0 · 99976 | planner chose btree (no HNSW node) |
| 5,000 | index | relaxed_order | 80 | 1.0 (min 1.0) | 67.45 / 74.34 | BHS(document_chunks) → BIS[btree:document_id] → Seq(documents) · Seq(documents) → BHS(document_chunks) → BIS[btree:document_id] | 0 · 99972 | planner chose btree (no HNSW node) |
| 5,000 | index | relaxed_order | 100 | 1.0 (min 1.0) | 65.64 / 76.09 | BHS(document_chunks) → BIS[btree:document_id] → Seq(documents) · Seq(documents) → BHS(document_chunks) → BIS[btree:document_id] | 0 · 99971 | planner chose btree (no HNSW node) |
| 5,000 | index | off | 40 | 1.0 (min 1.0) | 67.53 / 73.92 | BHS(document_chunks) → BIS[btree:document_id] → Seq(documents) · Seq(documents) → BHS(document_chunks) → BIS[btree:document_id] | 0 · 99971 | planner chose btree (no HNSW node) |
| 10,000 | exact | — | — | 1.0 (min 1.0) | 126.31 / 139.56 | BHS(document_chunks) → BIS[btree:document_id] → Seq(documents) · Seq(documents) → IS[btree:document_id] | 0 · 0 | btree, no HNSW ✅ |
| 10,000 | index | strict_order | 40 | 1.0 (min 1.0) | 136.71 / 172.06 | BHS(document_chunks) → BIS[btree:document_id] → Seq(documents) · Seq(documents) → BHS(document_chunks) → BIS[btree:document_id] | 0 · 101212 | planner chose btree (no HNSW node) |
| 10,000 | index | strict_order | 60 | 1.0 (min 1.0) | 126.16 / 150.18 | BHS(document_chunks) → BIS[btree:document_id] → Seq(documents) · Seq(documents) → BHS(document_chunks) → BIS[btree:document_id] | 0 · 101339 | planner chose btree (no HNSW node) |
| 10,000 | index | strict_order | 80 | 1.0 (min 1.0) | 133.06 / 152.45 | BHS(document_chunks) → BIS[btree:document_id] → Seq(documents) · Seq(documents) → BHS(document_chunks) → BIS[btree:document_id] | 0 · 101441 | planner chose btree (no HNSW node) |
| 10,000 | index | strict_order | 100 | 1.0 (min 1.0) | 138.73 / 161.01 | BHS(document_chunks) → BIS[btree:document_id] → Seq(documents) · Seq(documents) → BHS(document_chunks) → BIS[btree:document_id] | 0 · 101343 | planner chose btree (no HNSW node) |
| 10,000 | index | relaxed_order | 40 | 1.0 (min 1.0) | 140.18 / 152.21 | BHS(document_chunks) → BIS[btree:document_id] → Seq(documents) · Seq(documents) → BHS(document_chunks) → BIS[btree:document_id] | 0 · 101333 | planner chose btree (no HNSW node) |
| 10,000 | index | relaxed_order | 60 | 1.0 (min 1.0) | 137.33 / 172.83 | BHS(document_chunks) → BIS[btree:document_id] → Seq(documents) · Seq(documents) → BHS(document_chunks) → BIS[btree:document_id] | 0 · 101337 | planner chose btree (no HNSW node) |
| 10,000 | index | relaxed_order | 80 | 1.0 (min 1.0) | 163.73 / 228.71 | BHS(document_chunks) → BIS[btree:document_id] → Seq(documents) · Seq(documents) → BHS(document_chunks) → BIS[btree:document_id] | 0 · 101335 | planner chose btree (no HNSW node) |
| 10,000 | index | relaxed_order | 100 | 1.0 (min 1.0) | 142.11 / 186.88 | BHS(document_chunks) → BIS[btree:document_id] → Seq(documents) · Seq(documents) → BHS(document_chunks) → BIS[btree:document_id] | 0 · 101371 | planner chose btree (no HNSW node) |
| 10,000 | index | off | 40 | 1.0 (min 1.0) | 145.82 / 170.56 | BHS(document_chunks) → BIS[btree:document_id] → Seq(documents) · Seq(documents) → BHS(document_chunks) → BIS[btree:document_id] | 0 · 101342 | planner chose btree (no HNSW node) |
| unfiltered (control, 2nd run) | index | off | 40 | 0.89 (min 0.0) | 5.97 / 12.2 | IS[HNSW] → IS[documents_pkey] · Seq(documents) → BHS(document_chunks) → BIS[btree:document_id] | 0 · 100813 | control (global knobs, unchanged) |
| 15,000 | exact | — | — | 1.0 (min 1.0) | 193.93 / 221.47 | BHS(document_chunks) → BIS[btree:document_id] → Seq(documents) · Seq(documents) → IS[btree:document_id] | 5942 · 2690 | btree, no HNSW ✅ |
| 15,000 | index | strict_order | 40 | 1.0 (min 1.0) | 191.91 / 205.5 | BHS(document_chunks) → BIS[btree:document_id] → Seq(documents) · Seq(documents) → BHS(document_chunks) → BIS[btree:document_id] | 5402 · 100986 | planner chose btree (no HNSW node) |
| 15,000 | index | strict_order | 60 | 1.0 (min 1.0) | 189.29 / 223.93 | BHS(document_chunks) → BIS[btree:document_id] → Seq(documents) · Seq(documents) → BHS(document_chunks) → BIS[btree:document_id] | 5311 · 100934 | planner chose btree (no HNSW node) |
| 15,000 | index | strict_order | 80 | 1.0 (min 1.0) | 188.45 / 232.27 | BHS(document_chunks) → BIS[btree:document_id] → Seq(documents) · Seq(documents) → BHS(document_chunks) → BIS[btree:document_id] | 4661 · 100952 | planner chose btree (no HNSW node) |
| 15,000 | index | strict_order | 100 | 1.0 (min 1.0) | 181.48 / 197.27 | BHS(document_chunks) → BIS[btree:document_id] → Seq(documents) · Seq(documents) → BHS(document_chunks) → BIS[btree:document_id] | 5332 · 100919 | planner chose btree (no HNSW node) |
| 15,000 | index | relaxed_order | 40 | 1.0 (min 1.0) | 183.27 / 202.22 | BHS(document_chunks) → BIS[btree:document_id] → Seq(documents) · Seq(documents) → BHS(document_chunks) → BIS[btree:document_id] | 4833 · 100951 | planner chose btree (no HNSW node) |
| 15,000 | index | relaxed_order | 60 | 1.0 (min 1.0) | 183.18 / 229.69 | BHS(document_chunks) → BIS[btree:document_id] → Seq(documents) · Seq(documents) → BHS(document_chunks) → BIS[btree:document_id] | 4794 · 100958 | planner chose btree (no HNSW node) |
| 15,000 | index | relaxed_order | 80 | 1.0 (min 1.0) | 176.14 / 193.24 | BHS(document_chunks) → BIS[btree:document_id] → Seq(documents) · Seq(documents) → BHS(document_chunks) → BIS[btree:document_id] | 4144 · 100924 | planner chose btree (no HNSW node) |
| 15,000 | index | relaxed_order | 100 | 1.0 (min 1.0) | 181.0 / 218.96 | BHS(document_chunks) → BIS[btree:document_id] → Seq(documents) · Seq(documents) → BHS(document_chunks) → BIS[btree:document_id] | 4516 · 100925 | planner chose btree (no HNSW node) |
| 15,000 | index | off | 40 | 1.0 (min 1.0) | 210.49 / 309.94 | BHS(document_chunks) → BIS[btree:document_id] → Seq(documents) · Seq(documents) → BHS(document_chunks) → BIS[btree:document_id] | 4855 · 100948 | planner chose btree (no HNSW node) |

**Reading.**
- **Recall is 1.000 at every filtered point** (both branches, every mode, every ef, min 1.000).
- **No filtered point ever produced an HNSW node.** Up to 15,000 chunks the custom planner served
  the "index branch" from the `document_id` btree too, so `iterative_scan` had nothing to change.
  The SEED-273 "Index Scan using document_chunks_embedding_idx" assertion cannot be met on a
  filtered call at these sizes, and it does not need to be: there is no graph walk, so no cliff.
- **Residual = latency, not recall:** exact p95 46 ms at 2,000, 108 ms at 5,000, 140 ms at 10,000,
  221 ms at 15,000 (shared read ~5,000 blocks at 15,000, above SEED-273's `< 1,000` bar).
- The unfiltered control (global knobs, unchanged by 272) read recall 0.89 (min 0.0) — the
  pre-existing global-knob behaviour, not a 272 change (D-14); it is SEED-273's open half.
- ⚠ **The GENERIC column is the finding that changed the phase.** On the first run (before the
  pin; `evidence/ladder-run1-aborted.txt`) the unfiltered control's function calls took p50 1,587
  ms. PL/pgSQL switches a pooled session to the generic plan after five calls, and with migration
  200's btree that plan is a whole-table join (shared read ~100,000). Isolated with rolled-back DDL
  (`evidence/plancache-diagnosis.txt`): the btree ALONE causes it (migration 170 body + btree:
  3-8 ms → 0.45-1.0 s vector; keyword 0.5-0.9 s → 12-32 s). **Migration 201** pins both RPCs to
  custom plans (back to 2.5-6 ms). 201 must ship with 200.

**Decision rule** (written before the values were read): `FILTERED_EXACT_MAX_CHUNKS` = the largest
measured size whose exact-branch p95 ≤ (unfiltered-control p95 + 50 ms) and whose plan uses
`idx_document_chunks_document_id` with no HNSW node; `FILTERED_ITERATIVE_SCAN` = the mode reaching
recall ≥ 0.90 at ef 40 with the lower p95 above that size; if neither reaches 0.90 above T, raise T
to the largest size with exact p95 ≤ 250 ms.

**Applied:** control p95 = 34.41 ms → bound 84.41 ms. Exact p95: 500 → 17.84 ✅, 1,000 → 19.80 ✅,
2,000 → 46.20 ✅, 5,000 → 108.24 ✗, 10,000 → 139.56 ✗. Above T at ef 40: strict 1.000 / 125.19 ·
172.06 · 205.5 ms vs relaxed 1.000 / 120.83 · 152.21 · 202.22 ms (5,000 · 10,000 · 15,000). The
fallback did not trigger (both modes reach 1.000).

Chosen `FILTERED_EXACT_MAX_CHUNKS` = **2000** · chosen `FILTERED_ITERATIVE_SCAN` = **relaxed_order** ·
reason: the rule above, measured; `FILTERED_MATCH_FLOOR` stays -2.0 (D-10). Global knobs unchanged
(`hnsw_ef_search = 40`, `hnsw_iterative_scan = off`). SEED-076 lever 4 stays deferred.

## 3. SC#4 — the 8-row SC#10 board (D-17), filled by 272-05

Roster is **re-derived at run time** from the effective registry (newest registry-backed model per
provider + OpenRouter); the candidates below were measured at research and are NOT authoritative.
Method: per-request `model` + `provider` on `POST /threads/{id}/messages`; verdicts from `audit_log`
`search.query` rows (`filters`, `result_kind`, `document_ids`) AND every persisted tool call of the
run (`messages.tool_calls`, D-22). ⛔ A correct answer without the `filters` argument FAILS the row.

Prompts (fixture: October + March + September reports for Acme GmbH and Beta Ltd; no July documents):
- **(a)** "What was October revenue?" — PASS iff a `search_documents` call carries a date filter on
  `date` covering October, the stated range is in the answer, and every cited document's `date_typed`
  is in October.
- **(b)** "What was revenue for Acme GmbH?" — PASS iff a `search_documents` call carries
  `legal_entity` = `Acme GmbH` and every citation is an Acme GmbH document.
- **(c)** "What was revenue for Acme GmbH in July?" — PASS iff the filtered call returns
  `no_documents_matched`, the answer says nothing matched, cites nothing, and NO later tool call in
  the run (search_documents, grep, query_documents, read_document, analyze_document, …) retrieves
  content from outside the filter.

~~⛔ **NOT YET RUN (2026-10-03, 272-05).** Blocked by OpenAI `429 — You have no credits remaining`.~~
**Unblocked the same day:** the operator added credits; the paused fixture jobs resumed on their own
(all five `completed`, one embedded chunk each), a direct `text-embedding-3-small` probe returned 1536
dims, and `--seed` re-ran idempotently (`SEED OK` ×5: `date_typed` = the ISO date, `legal_entity` set,
`chunks=1`). **Run 2026-10-03** with `scripts/run-272-board.py --run`, one fresh thread per row × prompt,
per-request `model` + `provider`, no global setting mutated; the `runs` row's effective
`provider/model` equals the requested one on all 24 runs. Raw JSON per run: `evidence/board/`
(24 files + `board-summary.json`); roster derivation and per-run lines: `evidence/board/board-run.log`;
per-run audit ids, filters, tools and citations: `evidence/board/board-verdicts-readout.txt`.

**Totals: 20 / 24 PASS** — (a) 7/8 · (b) 7/8 · (c) 6/8. No row ⛔ (every provider had a key).

| # | Provider | Model (derived) | (a) | (b) | (c) | Evidence (audit ids / run ids) | Notes / ⛔ reason |
|---|---|---|---|---|---|---|---|
| 1 | openai | gpt-5.6-luna | PASS | PASS | PASS | a `29a00ef9` / run `b48bda6f` · b `2cae94db` / `4d6d2d9b` · c `3b25b99a` / `ae6fd181` | one `search_documents` per prompt, filter emitted each time; (c) tools inspected: `search_documents` only |
| 2 | anthropic | claude-sonnet-5 | PASS | PASS | PASS | a `42fbd879` / `58ad3294` · b `5765e719` / `e1a93c18` · c `2279bbf5` / `0a00a180` | one filtered call per prompt; (c) tools: `search_documents` only |
| 3 | google | gemini-3.5-flash | **FAIL** | **FAIL** | **FAIL** | a `abfa1198`,`8b239da5` / `7bdfff7f` · b `6eafc0bd`,`da13c30c`,`b315a808` / `d79bb11b` · c `adfb0016`,`c191c25d`,`34054ca2` / `78784975` | (a) correct October figures but **no `filters` argument** on either search (it scoped by `query_documents` SQL) → FAIL by D-17; cited 8 docs incl. March and unrelated files. (b) emitted `legal_entity = Acme GmbH`, then an unfiltered search and a `title` filter on ACME Corporation → cited `acme_q3_2026_financial_report.md`. (c) never emitted entity + July; 14 tool calls (`query_documents` ×9, `grep` ×2, `search_documents` ×3), **no answer written**, 6 citations |
| 4 | deepseek | deepseek-v4-pro | PASS | PASS | PASS | a `2bb4ae3b` / `ee3dd20b` · b `5ec900a8` / `f9da6a15` · c `01807bd4` / `c3cd0d50` | roster tie flash/pro → pro; (c) tools: `search_documents` only |
| 5 | zhipu | glm-5.2 | PASS | PASS | PASS | a `32e80e8d` / `908595cb` · b `a8487fac` / `0106c2e5` · c `c86d2d4b` / `802e9614` | (c) tools: `search_documents` only |
| 6 | minimax | MiniMax-M3 | PASS | PASS | **FAIL** | a `d001bfc7` / `f0e456cc` · b `a0287ebc` / `6c9b6b89` · c `47e0a64c`,`43041938` / `63ef49eb` | (a) also ran one `query_documents` after the filtered search (citations stayed October). (c) searched `legal_entity = Acme GmbH` WITHOUT the date first (`passages`, Sep + Mar), then entity + July (`no_documents_matched`); the answer says July has nothing but **cites Sep 2025 EUR 1,180,000 and Mar 2026 EUR 1,410,000** → FAIL. The D-09 lock cannot catch it: it fires only AFTER an empty filtered search |
| 7 | moonshot | kimi-k2.6 | PASS | PASS | PASS | a `25240977` / `322eb03c` · b `60e940c4` / `c723435a` · c `30108aa0` / `89b97c06` | `emit_tier: coerce` — emitted the filter on all three; (c) tools: `search_documents` only |
| 8 | openrouter | z-ai/glm-5.2 | PASS | PASS | PASS | a `e31dce50` / `2780ce00` · b `4b347e9e` / `53671b46` · c `55ccff7c` / `56b3fbc8` | `native_tools: False` (the non-native path) — emitted the filter on all three |

**Roster derivation** (`sc10_188_run_board.derive_roster`, verbatim from `board-run.log`): 8 groups
from `MODEL_CAPABILITIES`, every pick `capability_source=registry`: anthropic `claude-sonnet-5` ·
deepseek `deepseek-v4-pro` (tied with `deepseek-v4-flash`) · google `gemini-3.5-flash` · minimax
`MiniMax-M3` · moonshot `kimi-k2.6` (`emit_tier=coerce`) · openai `gpt-5.6-luna` (tied with
`-sol`/`-terra`) · openrouter `z-ai/glm-5.2` (`native_tools=False`) · zhipu `glm-5.2`.

**Reading.**
- **Every PASS was earned by emission:** each passing row carries a `search.query` audit row whose
  `filters` hold the asked dimension (`date between 2025-10-01 and 2025-10-31`; `legal_entity eq Acme
  GmbH`; both together for (c), `result_kind = no_documents_matched`), and every passing (c) ran exactly
  ONE tool call — the empty filtered search — so D-22 had nothing later to inspect.
- **Google never emits the filter reliably; MiniMax pre-empts it once.** That is the CONTEXT
  `<deferred>` trigger for the admin "must filter" field flag (D-01: *"revisit if the SC#10 board shows a
  provider that will not emit filters reliably"*). It fired; it was not built (no re-scope).
- ⚠ **Finding F-2, visible on EVERY passing (b) row:** `legal_entity = Acme GmbH` matches **3**
  documents (audit `matched_document_count = 3`), but each of the seven passing rows received and
  cited only **2**, and several answers say *"there are two monthly financial reports"* — a false
  completeness claim inside a correct filter. The (b) rule (every citation is Acme GmbH) cannot see it.
  Cause, read from the code: `retrieval_rank._select_filtered_vector_rows` returns ONLY the rows above
  the configured threshold (0.3) when any clears it (D-10 as written), so a matched document below it
  is dropped unless keyword fusion brings it back. Not fixed here (a behaviour change to D-10 needs a
  decision and a backend restart) — routed to the operator at Task 4.
  ⚠ **CORRECTED at the re-run (below), and the original is kept:** the threshold was ONE of TWO
  causes. The second is `retrieval_rank._deduplicate_chunks`, which compares word-set Jaccard ACROSS
  documents: the September and October Acme reports score **0.90** (≥ 0.85), so September is
  collapsed into October even after the threshold half is fixed.

### 3b. Re-run after the operator's restart (2026-10-03) — published BESIDE the first board

**Live stack, verified before anything was trusted:** exactly one listener on :8000, PID 54676
(parent 56028, uvicorn `--reload`), started `2026-10-03T13:09:26+04:00`, after `676024f6a`
(`12:56:34+04:00`); `/health` 200. **Behavioural probe** (deepseek (b), run `7a7234da`, evidence
`evidence/board-rerun-probe/`): the October report (similarity 0.295, under 0.3) came back marked
`low_similarity: true` BESIDE an above-threshold March row. Before `6922624d6` that combination
could not happen (D-10 dropped it), so the live process serves the D-27 threshold fix. **But the
filtered call returned 2 of 3 matched documents** (audit `6c74ddef`, `matched_document_count = 3`),
and September was missing. Root cause: the dedup collapse above (Jaccard per fixture pair, Acme
Sep/Oct **0.900** is the only pair ≥ 0.85; Acme Oct/Beta Oct 0.767; every other pair ≤ 0.81).
**Fixed by TDD under Rule 1** (D-27 is the operator's ruling and this broke it): RED `cfaa0fb4a`,
GREEN `1cef556f3`. On the filtered path, `_deduplicate_chunks(…, same_document_only=True)` collapses
near-duplicates only within ONE document. The unfiltered path is unchanged and pinned. ⚠ **The
reloader did not respawn on `1cef556f3`** (PID 54676 unchanged afterwards), so this fix is NOT live
until the operator restarts again. ⇒ **Restart #3 done (listener pid 42856, started `13:46:55+04:00`); the fix is live, proven behaviourally by probe 2 (3/3).**

**What was re-run on the live process, and why only that:** (a) ×8 and (c) ×8. Neither prompt's
filter co-matches the only near-duplicate pair, so the un-restarted dedup cannot change their
filtered results. (b) ×8 depends on the dedup fix and is **OWED after restart #3**, never run on code
known to be incomplete. ⇒ **Run after restart #3; see the totals below the table.** Raw: `evidence/board-rerun/` (16 JSON + `board-summary.json` +
`board-run-ac.log` + `board-verdicts-readout.txt`). Roster re-derived at run time, identical to
the first board. Effective `runs.provider/model` == requested on all 16 runs.

| # | Provider | Model | (a) first → re-run | (b) first → re-run | (c) first → re-run | Re-run evidence (audit / run) | Attribution of every changed verdict |
|---|---|---|---|---|---|---|---|
| 1 | openai | gpt-5.6-luna | PASS → PASS | PASS → **PASS** (3/3) | PASS → PASS | a run `dbee42f8` · c run `73dcdf27` · b `49aea8b8` / `1e2efd39` | (b) coverage 2/3 → **3/3**, Sep 2025 EUR 1,180,000 cited. **D-27** (threshold `6922624d6` + dedup `1cef556f3`) |
| 2 | anthropic | claude-sonnet-5 | PASS → PASS | PASS → **PASS** (3/3) | PASS → PASS | a run `7326da8c` · c run `a57201c1` · b `1695b252` / `0aedb4fc` | (b) coverage 2/3 → **3/3**, Sep 2025 EUR 1,180,000 cited. **D-27** (threshold `6922624d6` + dedup `1cef556f3`) |
| 3 | google | gemini-3.5-flash | FAIL → FAIL | FAIL → FAIL (3/3) | FAIL → FAIL | a `ad59c881` / `d6ab50f9` · c `21dbdc55`,`92f54a2a` / `5835720e` · b `6732f57d`,`2efc5cec`,`0b0889e6` / `1c791074` | unchanged. (a): `filters: []` again, scoped by `query_documents` SQL, cited 5 incl. unrelated files. (c): first call `legal_entity = Acme GmbH` with NO date, then 13 more calls, ended at the 15-step cap with no answer. Model behaviour (Task 4 investigation). **(b): verdict unchanged, cause changed.** The first call (`legal_entity = Acme GmbH`, audit `6732f57d`) now returned all **3/3** matched reports, Sep 2025 included, so the `read_document` it made for September on the first board was not needed. It then widened ON ITS OWN: `query_documents`, an unfiltered search (`2efc5cec`, `filters: []`) and a `title = ACME Corporation …` filter (`0b0889e6`), and cited `acme_q3_2026_financial_report.md` + `acme_contract_renewal_schedule_2026.md`. Our contribution (F-2) is gone. What remains is model behaviour |
| 4 | deepseek | deepseek-v4-pro | PASS → PASS | PASS → **PASS** (3/3; probe 1 was 2/3, probe 2 3/3) | PASS → PASS | a run `889437d0` · c run `efcac385` · probe b `6c74ddef` / `7a7234da` · probe 2 b `38ca454d` / `ad675312` · b `2a334c03` / `58eeddec` | (b) coverage 2/3 → **3/3**, Sep 2025 EUR 1,180,000 cited. **D-27** (threshold `6922624d6` + dedup `1cef556f3`) |
| 5 | zhipu | glm-5.2 | PASS → PASS | PASS → **PASS** (3/3) | PASS → PASS | a run `61cd11e4` · c run `91f22d9a` · b `b43f6325` / `3e8ed757` | (b) coverage 2/3 → **3/3**, Sep 2025 EUR 1,180,000 cited. **D-27** (threshold `6922624d6` + dedup `1cef556f3`) |
| 6 | minimax | MiniMax-M3 | PASS → **FAIL** | PASS → **PASS** (3/3) | FAIL → **PASS** | a `8f69c46f` / `cb275a0c` · c `33e17fd7`,`7c45dbef` / `63051a8b` · b `bcd9d124` / `914c2f28` | **(a) unexplained by D-27 / F-3: run-to-run model variance.** It made one search with NO `filters` (`search_documents(query="October revenue")`), then `query_documents` SQL, and cited 5 including `nulfix.txt` and `sample.pdf`. D-27 only changes filtered calls and F-3 is frontend-only, so neither can produce this. **(c) unexplained by D-27 / F-3: run-to-run model variance.** This time there was no entity-only pre-search: two filtered-empty searches (July 2026, then July 2025), both `no_documents_matched`, 0 citations · **(b) coverage 2/3 → 3/3, Sep 2025 cited: D-27** |
| 7 | moonshot | kimi-k2.6 | PASS → PASS | PASS → **PASS** (3/3) | PASS → PASS | a run `af964975` · c run `d1ff8796` · b `ac880a74` / `fb990fc0` | (b) coverage 2/3 → **3/3**, Sep 2025 EUR 1,180,000 cited. **D-27** (threshold `6922624d6` + dedup `1cef556f3`) |
| 8 | openrouter | z-ai/glm-5.2 | PASS → PASS | PASS → **PASS** (3/3) | PASS → PASS | a run `48cad518` · c run `2dbd5d4c` · b `df9802b0` / `de9c05fa` | (b) coverage 2/3 → **3/3**, Sep 2025 EUR 1,180,000 cited. **D-27** (threshold `6922624d6` + dedup `1cef556f3`) |

**Re-run totals (live process = `c29ec8635`):** (a) **6/8** (was 7/8) · (c) **7/8** (was 6/8) · (b)
**OWED** (restart #3).

**(b) ×8, run after restart #3 (2026-10-03, live process started `13:46:55+04:00`, after `1cef556f3` at `13:16:04+04:00`; one listener on :8000, pid 42856):** **(b) 7/8, unchanged from the first board, and every one of the 8 filtered calls now returned 3/3 matched documents** (was 2/3 on all 7 passing rows; Sep 2025 EUR 1,180,000 cited on all 8). No verdict changed, so there is no verdict to attribute; the coverage change is attributed to **D-27** on every row. Probe first (deepseek, run `ad675312`, audit `38ca454d`, `evidence/board-rerun-probe2/`): `filtered call returned 3/3 matched docs · Sep 2025 cited: True`. Raw: `evidence/board-rerun-b/` (8 JSON + `board-summary.json` + `board-run-b.log` + `board-verdicts-readout.txt`). Roster re-derived at run time, line-for-line identical to the (a)/(c) re-run's. Effective `runs.provider/model` == requested on all 8.

**Complete board after the fixes (a) 6/8 · (b) 7/8 · (c) 7/8 = 20/24** (first board 20/24: 7 · 7 · 6). Google holds 3 of the 4 FAILs and every one of its FAILs is model behaviour; the fourth, MiniMax (a), is run-to-run variance (see above). Both changed verdicts are MiniMax, in opposite directions, and neither is
attributable to a fix. ⚠ That is the finding: **MiniMax's filter emission is not stable run to run**,
so one sample of a MiniMax row is not a measurement. Google is stable in failing.

## 4. G-4 lived-experience scenarios (CONTEXT `<specifics>`), driven by 272-05

| # | Scenario | I'd recognise failure if | Claude drive (evidence) | Operator sign-off |
|---|---|---|---|---|
| G4-1 | "October revenue" with October and March reports: answer states October 2025, every citation chip opens an October document, the card shows "Filtered: document date 1–31 Oct 2025" as visible text | a March figure appears, or the card shows no filter line | **PASS, with observation F-1.** Answer: *"…October 2025 revenue splits as follows: Acme GmbH: EUR 1,240,000 [1] · Beta Ltd: GBP 860,000 [2]"*; markers `Citation 1: 272-board-acme-2025-10.md`, `Citation 2: 272-board-beta-2025-10.md`; References · 2 sources, both October. No March / September figure. The card line reads **`Filtered: document date 1–31 Oct 2025`** (visible, 659×20 px) — **after one click**: at rest the finished run card is folded to `✓ done` and the line is not in the DOM (F-1). Audit `352d7fb5` (`date between 2025-10-01 and 2025-10-31`, `passages`). `evidence/g4-1-at-rest.png`, `g4-1-runcard-open.png`, `g4-1-references-open.png`, `g4-1-dom.txt`, `g4-1-runcard-open-dom.txt` | OWED until signed |
| G4-2 | "Revenue for Acme GmbH in July" (no July docs): says nothing matched July for Acme GmbH, may name months that exist, NO citations | it answers with any number, or a second search card appears without the filter | **PASS, with observation F-3.** Answer: *"No documents matched legal entity = Acme GmbH · document date 1–31 July 2026, so I can't give you a July revenue figure…"* then nearby months (Mar 2026, Oct 2025, Sep 2025 — 1 document each). No number, no citation marker, no References. A SECOND card exists and carries a filter line — **`Filtered: legal entity = Acme GmbH`** (the date dropped): it is the **D-09 lock refusing** the retry (audit `c8b9c9ba`, `result_kind = refused_retry`; first call `d9bc7f2b`, `no_documents_matched`). But the card summary reads **`Searching documents → 0 results`**, the same words as a real empty search, and the workspace TODO shows it `COMPLETED` (F-3). `evidence/g4-2-*.png`, `g4-2-dom.txt`, `g4-2-runcard-open-dom.txt` | OWED until signed |
| G4-3 | "Revenue for Acme Gmbh" (wrong case/spelling): corrects to the real value and answers, or asks which entity | it says "no documents" for an entity that exists | **PASS by its written bar, with finding F-2.** The call carried **`Filtered: legal entity = Acme GmbH`** (canonicalised from `Acme Gmbh`, D-20; audit `bb2b1072`) and answered with figures. But it says *"here are the **two** monthly figures in your documents"* — March 2026 EUR 1,410,000 and October 2025 EUR 1,240,000 — while the filter matched **3** documents (`matched_document_count = 3`); September 2025 (EUR 1,180,000) was dropped by the D-10 threshold split (VALIDATION §3 "Finding F-2"). Rendered: `● Low confidence`. `evidence/g4-3-*.png`, `g4-3-dom.txt`, `g4-3-runcard-open-dom.txt` | OWED until signed |

**How driven:** real Chromium (Playwright 1.60, `chromium-1223`, headless, 1600×1000, dark) from a
scratch script outside the repo (271 precedent; no Chrome MCP in this executor), as the dev user
signed in through the UI (`pressSequentially`, key events), against `http://localhost:5173/app.html`.
Model = the operator's saved setting, **deepseek / deepseek-v4-flash** (the lived default, not a board
row). Rendered text read at rest, then after one click on the run card's status row.
Threads: G4-1 `ff82bf25` (first drive) and `6cfb82df` (re-drive with the unfold step) · G4-2
`d420779b` · G4-3 `18995c2a`.

**Findings for the operator (not fixed in 272-05):**
- **F-1 (copy/layout):** a finished run card folds to `✓ done`, so the "Filtered: …" line is one click
  away at rest. Pre-existing RunCard fold behaviour, not a 272 change; the line itself is visible text
  (not a tooltip) once unfolded.
- **F-2 (correctness, the serious one):** inside a matched filter set, documents whose passages fall
  below the 0.3 threshold are dropped when ANY passage clears it, and the model then states a false
  count. Seen on G4-3 and on all 7 passing board (b) rows.
- **F-3 (copy):** `SearchDocumentsBody.tsx:14` summarises every non-array result as `0 results` — a
  lock refusal (`refused_retry`), an invalid filter and a true empty match all read the same.

**Operator rulings at the Task 4 checkpoint (2026-10-03), and what was done with each:**

| Item | Ruling | Done in 272-05 | Re-run owed |
|---|---|---|---|
| **F-2** | **Fix in 272.** Every matched document returns its best passage, up to `top_k`, with below-threshold ones marked `low_similarity`. Recorded as CONTEXT **D-27**, which refines D-10. | Fixed with TDD. RED: 7 new or changed cases in `test_272_filtered_both_arms.py`. GREEN: `retrieval_rank._select_filtered_vector_rows` keeps each uncovered document's best row, marked. The new `_cover_matched_documents` keeps one passage per document in the filtered top-`k` cut, and after rerank. The unfiltered path is unchanged, and `test_unfiltered_rpc_calls_are_pinned` stays green. | Board (b) × 8 and G4-3, **after a backend restart** |
| **Google 0/3** | **Investigate first**, bounded. | Verdict: **(ii) model behaviour**, plus one cause on our side in row (b), which is F-2 and is now fixed. Evidence is in `272-UAT-LOG.md` → "Google 0/3 — bounded investigation". The schema survives the sanitizer whole, and Gemini emitted well-formed `filters` 3 times. It preferred `query_documents` SQL, never emitted a date filter, and run (c) ended at the 15-step iteration cap. **SC#4 Google rows (a) and (c) are recorded UNMET (model behaviour).** | Google (b) after the restart. (a) and (c) re-run only to confirm |
| **F-3** | **Fast fix now.** | Fixed with TDD. `SearchDocumentsBody.summarize` now reads `refused — would drop the filter` / `invalid filter (<field>)` / `no documents matched` / `N matched — not searchable yet` / `search unavailable`. A new suite, `SearchDocumentsBody.test.ts` (9 cases, 6 RED on the shipped tree), is adopted in BOTH count-gate knobs. The workspace TODO showing a refused call as `COMPLETED` is a separate file (the panel's activity-derived todos), so it is **noted and not fixed**. | G4-2 card text, after the restart and a frontend reload |
| **F-1** | **Accept, plant a seed.** | **SEED-333** planted, routed to Phase 273. Its `trigger_paths` include `RunCard.tsx`. | none |

**Re-run of the G-4 drive after the operator's restart (2026-10-03)** — same method as above
(Playwright 1.60 Chromium, headless, 1600×1000, dark, signed in through the UI, key events, model =
the saved deepseek / deepseek-v4-flash), fresh threads. Vite served the F-3 source (the module text
contains `refused — would drop the filter`). Evidence has a `-rerun` suffix, and the first drive's
files are untouched.

| # | Re-run result | Rendered text (verbatim) | Evidence |
|---|---|---|---|
| G4-1 | **PASS** (F-1 unchanged, accepted → SEED-333) | *"Assuming you mean October 2025 (the most recent completed October before today), I found two monthly financial reports: Acme GmbH — October 2025 revenue was EUR 1,240,000 · Beta Ltd — October 2025 revenue was GBP 860,000"*. Citation markers only `272-board-acme-2025-10.md` and `272-board-beta-2025-10.md`; `References · 2 sources`. After one click: card `Searching documents→View results` + **`Filtered: document date 1–31 Oct 2025`** (visible, 659×20). No March or September figure. Audit `a23161d1` (`date between 2025-10-01 and 2025-10-31`, `passages`), thread `86d3344e` | `evidence/g4-1-at-rest-rerun.png`, `g4-1-runcard-open-rerun.png`, `g4-1-references-open-rerun.png`, `g4-1-dom-rerun.txt`, `g4-1-runcard-open-dom-rerun.txt` |
| G4-2 | **PASS; F-3 verified** | *"No documents matched the filter I used: legal entity = Acme GmbH · document date 1–31 July 2026. So I can't give you a July 2026 revenue figure…"* then nearby Mar 2026 / Oct 2025 / Sep 2025. No number, no citation marker, no References. ONE card: **`Searching documents→no documents matched`** + `Filtered: legal entity = Acme GmbH · document date 1–31 Jul 2026`. Before F-3 this read `0 results`. The model did not retry this time, so no refusal card rendered. Audit `a7b215f8` (`no_documents_matched`), thread `cc74f48d`. **The refusal text was verified on real persisted data:** the FIRST G4-2 thread (`d420779b`, whose second call is the lock's `refused_retry`, audit `c8b9c9ba`), re-opened in the current frontend, renders card 2 as **`Searching documents→refused — would drop the filter`** + `Filtered: legal entity = Acme GmbH` | `evidence/g4-2-at-rest-rerun.png`, `g4-2-runcard-open-rerun.png`, `g4-2-dom-rerun.txt`, `g4-2-runcard-open-dom-rerun.txt`, `g4-2-first-thread-runcard-open-rerun.png`, `g4-2-first-thread-dom-rerun.txt` |
| G4-3 | ~~**OWED after restart #3**~~ → **PASS (re-run 2, after restart #3); F-2 closed on the lived surface** | *"Acme GmbH's revenue appears in three monthly financial reports in your library:"* then a table **September 2025 EUR 1,180,000** (`272-board-acme-2025-09.md`) · **October 2025 EUR 1,240,000** · **March 2026 EUR 1,410,000**; *"…I've limited this to Acme GmbH as asked."* `● High confidence` (was `● Low confidence`); **`References · 3 sources`**, all three Acme GmbH reports (0.64 / 0.63 / 0.63). After one click: card `Searching documents→View results` + **`Filtered: legal entity = Acme GmbH`** (visible, 659×20), canonicalised from the typed `Acme Gmbh` (D-20). Audit `fb979f54` (`legal_entity eq Acme GmbH`, `passages`, `matched_document_count = 3`, 3 `document_ids`), run `2839d9dd` (deepseek / deepseek-v4-flash, `completed`), thread `ec595218`. **Observation O-1 (not a 272 defect):** this answer put the filenames in a *Source* table column instead of `[n]` markers, so there are **0 inline citation markers** and the footer reads *"Unmarked claims read as general knowledge"* while References lists 3 sources. Model formatting variance (the first G4-3 drive and probe 2 both used `[n]` markers) | `evidence/g4-3-at-rest-rerun2.png`, `g4-3-references-open-rerun2.png`, `g4-3-runcard-open-rerun2.png`, `g4-3-dom-rerun2.txt`, `g4-3-runcard-open-dom-rerun2.txt` |

## 5. Known limits recorded, not hidden
- D-22: `grep` / `query_documents` / `read_document` are not structurally locked by D-09; the prompt
  rule plus the board's all-tool-calls check (prompt c) is the mitigation.
- Pitfall 11: `date_typed` parses only strict `YYYY-MM-DD`; documents with `"2025-10"` / `"October 2025"`
  metadata are undated under D-06 and reported in the undated count.
- A4: "today" is server UTC (no per-user timezone exists).
