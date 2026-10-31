---
status: resolved
trigger: "Pool deadlock in the phase 305 MCP server: 32 concurrent search_knowledge_base calls, 10 connections idle in transaction after SELECT set_config('app.acting_org_id', $1, true), rest hang > 3 min"
created: 2026-10-31T14:45:00Z
updated: 2026-10-31T15:30:00Z
---

## Current Focus

reasoning_checkpoint:
  hypothesis: "retrieval_tuning.get_server_ef_search, called from apply_hnsw_session_knobs inside _call_as_user's open RLS transaction, sees conn.is_in_transaction() and probes through a SECOND pooled connection (get_pg_pool().fetchval). With the 60 s cache cold and >= pool_max concurrent searches, every pooled connection is held by a caller waiting for an (N+1)th connection."
  confirming_evidence:
    - "Read-only live repro (real asyncpg pool max_size=2, real _call_as_user, 4 concurrent calls, cold cache): 0/4 done after 5 s; pg_stat_activity shows exactly 2 'idle in transaction' with last query SELECT set_config('app.acting_org_id', $1, true)"
    - "Coroutine chain of the two holders: retrieval_rpc.py:108 _call_as_user -> retrieval_tuning.py:244 apply_hnsw_session_knobs -> retrieval_tuning.py:128 get_server_ef_search -> asyncpg pool.fetchval -> _acquire_impl -> queues.get; the other two wait at retrieval_rpc.py:106 (the outer acquire)"
  falsification_test: "If the fix (probe on the SAME connection via pg_settings.reset_val) is applied and > pool_max concurrent calls still hang, the hypothesis is wrong or incomplete."
  fix_rationale: "Removes the nested acquire entirely: the probe reads the session default (reset_val, which SET LOCAL does not change) on the connection the caller already holds, so no code path holds one pooled connection while waiting for another."
  blind_spots: "Operator stack runs WORKER_COUNT 1-2 with other traffic; the refusal-audit loss (orchestrator's second hypothesis) is a separate question, tested separately."

## Symptoms

expected: 32 concurrent MCP searches queue for the 10-connection pool and all complete (2 over-limit refusals)
actual: ~2 answered, the rest hung > 3 min; 10 connections idle in transaction, last query set_config('app.acting_org_id'); terminating them made the next 10 deadlock identically
errors: terminated calls returned "Something went wrong reading your documents."
reproduction: concurrency >= pool max_size of searches with the ef_search probe cache cold
started: Phase 246 (efeb77c57, 2026-09-13) added the in-transaction pool probe

## Eliminated

## Evidence

- timestamp: 2026-10-31T14:48:00Z
  checked: retrieval_tuning.get_server_ef_search
  found: "in-transaction conn -> else branch -> `p = await get_pg_pool(); raw = await p.fetchval(query)`; config hnsw_ef_search default 40 (non-None) so every vector arm reaches the probe when the 60 s cache is cold"
  implication: nested pool acquire while holding a pooled RLS connection
- timestamp: 2026-10-31T14:50:00Z
  checked: live read-only repro, scratchpad stackdump.py
  found: see reasoning_checkpoint confirming_evidence
  implication: root cause confirmed; affects every _call_as_user caller (app chat search too), not only MCP

## Resolution

root_cause: "backend/app/services/retrieval_tuning.py:124-128 get_server_ef_search acquires a second pooled connection while the caller (retrieval_rpc._call_as_user, retrieval_rpc.py:106-110) holds one inside an open transaction"
fix: "554fe5235 — in-transaction probe reads pg_settings.reset_val on the held connection; never a second pooled connection (RED ccfbb1133)"
verification: "unit + live RED->GREEN (both MCP and app variants); e2e acting_member_reads.search 12 concurrent on 2-conn pool 0/12 -> 12/12; targeted subset failures identical to base (15 inherited test_retrieval_service); baseline gate 70 <= 71 PASSED"
files_changed: [backend/app/services/retrieval_tuning.py]

## Human verify (orchestrator, 2026-10-31)

Re-ran the 32-call burst on the operator stack (:8000, `--reload`, fix loaded): 30 answered, 2 refused, 0 connections idle in transaction; 30 `api_key.read` + 1 `api_key.refused` audit rows; 30 `mcp_usage` rows. Recorded in `305-VALIDATION.md` §2.2.
