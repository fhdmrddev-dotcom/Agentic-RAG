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

| Filtered set (chunks) | Branch | iterative_scan | ef_search | recall | p50 / p95 ms | node / index (custom · generic) | shared read | Verdict |
|---|---|---|---|---|---|---|---|---|
| 500 | exact | — | — | | | | | |
| 1000 | exact | — | — | | | | | |
| 2000 | exact | — | — | | | | | |
| 5000 | exact | — | — | | | | | |
| 10000 | exact | — | — | | | | | |
| above T | index | strict_order | 40 / 60 / 80 / 100 | | | | | |
| above T | index | relaxed_order | 40 / 60 / 80 / 100 | | | | | |
| unfiltered (control) | index | (global setting, unchanged) | global | | | | | |

Chosen `FILTERED_EXACT_MAX_CHUNKS` = ___ · chosen `FILTERED_ITERATIVE_SCAN` = ___ · reason: ___

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

| # | Provider | Model (derived) | (a) | (b) | (c) | Evidence (audit ids / run ids) | Notes / ⛔ reason |
|---|---|---|---|---|---|---|---|
| 1 | openai | | | | | | |
| 2 | anthropic | | | | | | |
| 3 | google | | | | | | |
| 4 | deepseek | | | | | | |
| 5 | zhipu | | | | | | |
| 6 | minimax | | | | | | |
| 7 | moonshot | | | | | | `emit_tier: coerce` |
| 8 | openrouter | | | | | | `native_tools: False` |

## 4. G-4 lived-experience scenarios (CONTEXT `<specifics>`), driven by 272-05

| # | Scenario | I'd recognise failure if | Claude drive (evidence) | Operator sign-off |
|---|---|---|---|---|
| G4-1 | "October revenue" with October and March reports: answer states October 2025, every citation chip opens an October document, the card shows "Filtered: document date 1–31 Oct 2025" as visible text | a March figure appears, or the card shows no filter line | | OWED until signed |
| G4-2 | "Revenue for Acme GmbH in July" (no July docs): says nothing matched July for Acme GmbH, may name months that exist, NO citations | it answers with any number, or a second search card appears without the filter | | OWED until signed |
| G4-3 | "Revenue for Acme Gmbh" (wrong case/spelling): corrects to the real value and answers, or asks which entity | it says "no documents" for an entity that exists | | OWED until signed |

## 5. Known limits recorded, not hidden
- D-22: `grep` / `query_documents` / `read_document` are not structurally locked by D-09; the prompt
  rule plus the board's all-tool-calls check (prompt c) is the mitigation.
- Pitfall 11: `date_typed` parses only strict `YYYY-MM-DD`; documents with `"2025-10"` / `"October 2025"`
  metadata are undated under D-06 and reported in the undated count.
- A4: "today" is server UTC (no per-user timezone exists).
