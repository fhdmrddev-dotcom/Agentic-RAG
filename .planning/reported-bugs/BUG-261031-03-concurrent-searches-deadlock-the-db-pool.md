---
id: BUG-261031-03
title: Concurrent searches deadlock the database pool (the ef_search probe takes a second connection)
reported: 2026-10-31
surface: Agentic-RAG
severity: major
status: folded
affected_areas: [backend/retrieval, backend/mcp, RAG/search, backend/db-pool]
folded_into: "305"
verified_closed_by: null
related_seeds: []
re_open_trigger: null
reproduces_on:
  branch: develop
  commit: f3041303e
  date: 2026-10-31
---

# BUG-261031-03: Concurrent searches deadlock the database pool

## What we observed

Measured 2026-10-31 at about 14:40 UTC on the local stack (orchestrator G-4 for Phase 305):

- 32 concurrent MCP `tools/call search_knowledge_base` requests (one MCP key `d5185f3b`, org
  `22f9c615`, query "invoice", limit 1) were POSTed in parallel to the backend on :8000 (asyncpg
  pool max 10).
- 2 got the per-key over-limit refusal, which is correct. Of the other 30, about 2 answered. The rest
  hung for more than 3 minutes.
- `/health` answered in 5 ms the whole time, so the event loop was alive.
- `pg_stat_activity` showed exactly 10 connections `idle in transaction`, all 3+ minutes old. On each
  one the last query was `SELECT set_config('app.acting_org_id', $1, true)`, the last setup statement
  in `app.dependencies._apply_rls_user_context`.
- Terminating those 10 backends let the next 10 queued calls take the connections and deadlock the
  same way. This was reproduced twice, until the burst drained. The terminated calls returned the
  generic "Something went wrong reading your documents." sentence.
- The audit ledger for that key shows `api_key.read`: 4 `ok` (the earlier single calls) and 30
  `error` (the terminated ones). There are **0 `api_key.refused` rows** for the 2 refusals, and **no
  `apikey:refaudit:sup:<key>:*` counter in Redis**. See "Second finding" below.
- A single search works. Only concurrency at or above the pool size triggers the hang.

## Root cause (measured, not hypothesised)

`backend/app/services/retrieval_tuning.py` `get_server_ef_search` (lines 124-128 at `f3041303e`)
runs from `apply_hnsw_session_knobs`. That function is called inside
`retrieval_rpc._call_as_user` (`retrieval_rpc.py:106-110`), which holds a pooled RLS connection
with its transaction open. When the 60 s probe cache is cold, the probe sees
`conn.is_in_transaction()` and runs `await (await get_pg_pool()).fetchval(...)`, which asks for a
**second** pooled connection while the first is still held. With `concurrency >= max_size`, every
connection is held by a caller that is waiting for one more connection. Nothing frees one, so the
callers wait forever (`pool.acquire` has no timeout). The ef_search knob is always set
(`hnsw_ef_search` defaults to 40), so every vector arm reaches the probe whenever the cache is cold.
The burst arrived after the earlier single calls' cache entry had expired.

Proof: a read-only live repro (a real asyncpg pool with `max_size=2`, the real `_call_as_user`, 4
concurrent calls, cold cache) finished **0 of 4** in 5 s. `pg_stat_activity` showed exactly 2
connections `idle in transaction` on `SELECT set_config('app.acting_org_id', $1, true)`. The
coroutine chain of each holder:

```
retrieval_rpc.py:108  _call_as_user
retrieval_tuning.py:244  apply_hnsw_session_knobs
retrieval_tuning.py:128  get_server_ef_search
asyncpg/pool.py:646  fetchval -> :1056 __aenter__ -> :896 _acquire -> :879 _acquire_impl
asyncio/queues.py:158  get            <- waiting for a 3rd connection
```

The other two calls waited at `retrieval_rpc.py:106`, the outer acquire. End to end, through the
real `acting_member_reads.search` (12 concurrent calls on a 2-connection pool, embeddings stubbed):
**0/12** completed before the fix and **12/12** after it.

**This was not introduced by MCP and does not only affect MCP.** The nested acquire has existed
since Phase 246 (`efeb77c57`, 2026-09-13). It sits in `_call_as_user`, which every retrieval RPC
uses, including the app's own chat `search_documents` path (and the `llm_batch_agents` fan-out).
MCP only adds the acting-org GUC, which is why the stuck connections' last statement was
`app.acting_org_id`. On the app path it would be `request.jwt.claims`. Both variants are pinned RED
then GREEN (`[mcp-acting-org]` and `[app-chat-search]`).

## Fix

`554fe5235`: when the probe is handed a connection that is inside a transaction, it reads
`SELECT reset_val FROM pg_catalog.pg_settings WHERE name = 'hnsw.ef_search'` on **that**
connection. It never takes a second pooled connection. `reset_val` is the session default, and a
`SET LOCAL` in the open transaction never changes it, so the D-246-05 rule that a SET LOCAL must not
poison the cache still holds. The live test pins this on the real server: `current_setting` reads
177 after a SET LOCAL while `reset_val` still reads 40. The pool size and the timeouts are unchanged.

RED `ccfbb1133`: `tests/unit/test_305_search_pool_deadlock.py` (asyncpg-shaped bounded pool) and
`tests/integration/test_305_search_pool_deadlock_live.py` (a real 2-connection pool, read-only).

## Second finding: refusal audit rows lost in the burst (NOT explained by the deadlock; cause unmeasured)

The 2 refusals wrote no `api_key.refused` row, although `test_305_audit_live.py` shows that row
being written for `rate_limited:expensive` under normal load. No suppressed counter exists in Redis
either. If the second refusal had reached `refusal_audit_slot`'s `count > 1` branch, it would have
left a counter with a 30-day TTL. So **neither refusal's bookkeeping finished**. One other
explanation would also produce this: the two refusals fell in different minute windows and both
writes failed.

What the code shows:
- The refusal bookkeeping (`audit_refused` → Redis `refusal_audit_slot` → `run_in_threadpool(get_service_role_supabase)`
  → PostgREST insert) never touches the asyncpg pool. The deadlocked holders were waiting on the
  event loop, and they held no worker thread and no PostgREST connection. **The pool deadlock alone
  therefore does not explain the lost rows.**
- `dispatch`'s `finally` runs the bookkeeping inside
  `anyio.move_on_after(BOOKKEEPING_DEADLINE_S=5, shield=True)`. If the deadline fires, the
  `CancelledError` is not caught by `audit_refused`'s `except Exception`, and `move_on_after`
  absorbs it. **A refusal row cut off by the 5 s bound therefore disappears with no log line.**
  That is an observability gap whatever the cause turns out to be.
- The hypothesis that anyio's 40-token thread limiter was full is not supported by the code: at
  burst start about 30 calls each hold at most one thread hop at a time. It is also not measured.

The bound was not changed, because there is no evidence yet. To measure it, compare the refused
calls' client-side latency with 5 s (about 5 s means the deadline cut them off), and read the
server log for `mcp refusal audit failed` / `audit write failed`, which mean an exception rather
than the deadline. Do this on a server that has the pool fix, so the burst no longer stalls.

## Why it matters

A burst of searches as large as the pool hangs every one of them for minutes, and in the app it can
take chat search down with it. Any MCP client running parallel tool calls can trigger it, and so can
an agent fan-out. The only recovery is to terminate backends by hand. It is also exposed in
production: the pool max defaults to 10 per worker.

## Surface classification

Agentic-RAG: this app's backend retrieval path.

## Suggested routing

- **Fold into in-flight phase:** 305 (fixed in `554fe5235`; ships with 305's deploy)
- **Defer to future phase / milestone:** the refusal-row loss under load, if the measurement above
  shows the 5 s bound fired
- **Plant as seed:** n/a
- **External — note only:** no

## Workarounds

Before the fix: keep concurrent searches below the pool's max size, or `pg_terminate_backend` the
`idle in transaction` holders.

## Reference / evidence links

- RED `ccfbb1133`, fix `554fe5235`
- Introduced by `efeb77c57` (Phase 246-01, the in-transaction pool probe)
- Debug session: `.planning/debug/305-mcp-search-pool-deadlock.md`
