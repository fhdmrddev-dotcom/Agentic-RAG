---
phase: 278-one-home-for-tools-and-filters
artifact: validation
plan: 04
sc_covered: [SC#5]
independent_review: self
date: 2026-10-13
---

# Phase 278: UAT scoreboard (SC#5 live smoke)

Phase 278 is a behaviour-preserving pure move: `tool_dispatcher.py` became a registry, with its handlers split into `services/tools/*`; one vocabulary home was added, and SEAM-02 was measured. Per CONTEXT §"Claude's Discretion" and the ROADMAP 278 Flags (the SC#10 decision), the live smoke is **one** native provider, Anthropic. The registry pin (`test_278_registry_pin.py`: names, order, bindings, schema sha256) is identical to base, so the move cannot change what any provider is sent. Every other row is still listed below, marked ⛔ with that reason. No row is omitted.

Gate evidence for SC#4 (full unit gate set-diff, vitest count gate, guard scripts, D-07 retarget/no-loss) is in `278-04-SUMMARY.md` § "Merged-tree gates (SC#4)".

## 4-axis bandwidth

| Axis | Status | Row |
|---|---|---|
| Cross-provider | 1 of 8 run (Anthropic); 7 ⛔ by decision | roster below |
| Multi-tool | ✅ **satisfied** | Anthropic row: `search_documents` + `execute_code` in one prompt |
| Parallel-thread | ⛔ not run by decision | CONTEXT Claude's-discretion: SC#5 is one native provider and the phase is behaviour-preserving; no streaming, run-buffer or UI-state code changed |
| Long-message | ⛔ not run by decision | same reason; no prompt-assembly or history code changed |

## Cross-provider roster (derived from `MODEL_CAPABILITIES`, not re-typed)

This was derived on 2026-10-13 by grouping `app.config.MODEL_CAPABILITIES` by `provider`. It gives 8 provider groups (openai 17, anthropic 7, google 7, deepseek 2, moonshot 3, minimax 8, zhipu 8, openrouter 9). For each group the table names the newest `capability_source: registry` id.

| # | Provider | Model (newest registry-backed) | native_tools / emit_tier | Verdict | Evidence / reason |
|---|---|---|---|---|---|
| 1 | OpenAI | `gpt-5.6-sol` | True / force_strict | ⛔ not run by decision | CONTEXT Claude's-discretion: SC#5 is one native provider; phase is behaviour-preserving (registry pin identical to base) |
| 2 | **Anthropic** | **`claude-sonnet-5`** | True / force | ✅ **PASS** | See the evidence below |
| 3 | Google | `gemini-3.5-flash` | True / force | ⛔ not run by decision | same reason as row 1 |
| 4 | DeepSeek | `deepseek-v4-pro` | True / force | ⛔ not run by decision | same reason as row 1 |
| 5 | Zhipu / GLM | `glm-5.2` | True / force | ⛔ not run by decision | same reason as row 1 |
| 6 | MiniMax | `MiniMax-M3` | True / force | ⛔ not run by decision | same reason as row 1 |
| 7 | Moonshot / Kimi | `kimi-k2.6` | True / **coerce** | ⛔ not run by decision | same reason as row 1 (the only `coerce` native rows; the first row to run if the board is ever scored) |
| 8 | OpenRouter | `deepseek/deepseek-v4-pro` | **False** / force | ⛔ not run by decision | same reason as row 1 (the non-native tool path) |

## Anthropic row evidence (row 2)

**Prompt** (operator, NEW chat, 2026-10-13): *"Search my documents for anything about invoices, then use execute_code to count how many results came back and print the count."* The operator replied "done, searched invoices".

**Backend on post-split code.** Port 8000 was held by PID 40336, created 2026-10-13 07:38:06 local, which is 03:38:06 UTC. That is after the 278-03 move commit `18abc1ed5` (2026-10-13T02:20:42+04:00 = 2026-10-12T22:20:42Z) and 47 s before the run started. Before the restart, the uvicorn on :8000 was PID 32740, started 2026-10-12 07:16, before the split. ⚠ Observation: both PIDs ran on the system Python (`C:\Python312\python.exe -m uvicorn … --reload`), not `backend/venv`. That is the operator's setup and is unchanged by 278.

**Evidence source:** a read-only asyncpg query against the LOCAL DB (`127.0.0.1:54322`, `SET default_transaction_read_only = on`). The DSN was asserted local before connecting. The Supabase MCP (production) was **not** used.

| Row | `audit_log.id` | `created_at` (UTC) | `run_id` | metadata key set |
|---|---|---|---|---|
| `search.query` | `b3d65512-1f21-4f31-b983-49204ff34e8e` | 2026-10-13 03:39:02.135852 | **`09c962aa-3aa6-4061-be0d-ae076c3f5b21`** (non-null) | `document_ids, filters, folder_ids, parent_run_id, query_text, result_kind, run_id, similarities, thread_id` |
| `code.execute` | `447164bb-cb05-4a14-aadf-7785944c1584` | 2026-10-13 03:39:21.766717 | null (expected: `code.execute` never carries run_id; null on all 200 pre-278 reference rows) | `language, thread_id` |

These are the only two rows of either action in the 60-minute window. There were 0 rows of either action between the move commit and this turn, so both rows are unambiguously post-split.

**Key-set comparison, matched by outcome.** The new `search.query` row has `query_text = "invoices"` and `result_kind = "passages"`, with 3 distinct document ids and no metadata filters. Among pre-278 `search.query` rows with `result_kind = "passages"` there are 3 key-set variants:

| pre-278 variant (result_kind = passages) | n | matches new row? |
|---|---|---|
| the 9-key set above | 29 (latest 2026-10-12 08:08:47 UTC) | ✅ **IDENTICAL** |
| + `matched_document_count` | 28 | no. Only the filtered-search writer adds this key (`search_documents_tool.py:1311`). This turn took the unfiltered path (`:1153`, `filters=[]`), which writes exactly the 9-key set. |
| + `matched_document_count`, `undated_excluded` | 20 | no (filtered path with a non-null undated count) |

The 9-key variant is the one recorded as the reference by `ref_rows.py` before the pause (`0ffe8cd7…`, 2026-10-12 08:08 UTC). The `code.execute` key set `language, thread_id` is **identical** to the single pre-278 variant (n=200).

**Cross-checks**
- `runs` row `09c962aa-3aa6-4061-be0d-ae076c3f5b21`: thread `c1c1e6a7-5f49-476a-b6d0-ee712543c164`, `status = completed`, `model = claude-sonnet-5`, `provider = anthropic`, started 03:38:53.53, completed 03:39:30.35 UTC. It is the thread's only (and so latest) run. There is no `workflow_runs` row, as expected for a plain chat run.
- Both audit rows carry `thread_id = c1c1e6a7-…`, the same thread.
- The thread's assistant message (03:39:27 UTC) has `tool_calls`: `search_documents` (status `done`) and then `execute_code` (status `done`). The final answer begins *"I searched for "invoices" and got **5 results** back, confirmed by the code execution count."* The model counted 5 result passages; the audit row records 3 distinct `document_ids`. These measure different things (passages vs distinct documents), so they do not conflict.

**Verdict: SC#5 MET.** After the split, one live Anthropic native-SDK turn used both tools and completed. It wrote a `search.query` row with a non-null `run_id` that resolves to the run, and a `code.execute` row. Both key sets are identical to the pre-278 rows with the same outcome.
