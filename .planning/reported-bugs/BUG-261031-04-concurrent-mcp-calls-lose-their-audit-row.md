---
id: BUG-261031-04
title: Concurrent MCP calls lose their audit row silently (the bookkeeping bound cancels a slow threadpool write)
reported: 2026-10-31
surface: Agentic-RAG
severity: major
status: folded
affected_areas: [backend/mcp, backend/audit, security/api-keys]
folded_into: "305"
verified_closed_by: null
related_seeds: []
re_open_trigger: null
reproduces_on:
  branch: develop
  commit: 78027d6fb
  date: 2026-10-31
---

# BUG-261031-04: Concurrent MCP calls lose their audit row silently

## What we observed

32 concurrent `tools/call search_knowledge_base` with one MCP key (limit 30 searches/min) on the
operator's local backend, 2026-10-31 15:14Z: 30 answered (all at about 72.5 s), 2 refused by the
per-key limit (2.1 s and 11.4 s). `mcp_usage` got all 60 rows. `audit_log` got **zero** rows for
those 32 calls, so neither `api_key.read` nor `api_key.refused` was written. The expected count was 30 + 1, since the
second refusal is counted by the CR-02 throttle and not written. With 1 call and with 3 concurrent
calls every row landed.

Reproduced without rerank and without the operator's server (own uvicorn, throwaway org and key):

| Run | Rows | Notes |
|---|---|---|
| in-process, N concurrent `audit_answered` under the 5 s shielded bound | N=1: 1/1 · N=3: 3/3 · N=10: 10/10 (held 9 s) · **N=30: 0/30, 30 bounds fired** | no log line for any lost row |
| own server, 32 searches (empty corpus) | 31/31 | every `audit_answered` took 8.1 s, past the 5 s bound |
| own server, 100 `list_documents` | **99/100** | `CancelledError` inside `write_audit_entry` after 0.24 s; zero `audit write failed` lines |
| live test, 32 real dispatches, bound 2 s | **1/30 read rows, refusal row lost** | one `POST /rest/v1/audit_log` in the log |

## Why it matters

Every MCP call is meant to leave exactly one audit row (KEY-07, D-26). This is the owner's record of
what a key did. Under load the record disappeared, and without a log line nobody could tell that rows were
missing. Refusals were lost the same way, and those are the security-relevant rows. The call was
also held well past the bound that was supposed to cap it (WR-03): 8 to 25 s, not 5 s.

## Cause (measured)

The MCP audit row went through `api_key_auth.audit_key_call_now`, which does
`run_in_threadpool(get_service_role_supabase)` (a NEW supabase-py client for every row, measured
0.19 s of GIL-held work) and then `aexec(insert)` (a second threadpool hop; the first PostgREST call on
a fresh client takes 0.21 s against 0.013 s on a warm one). Those two hops serialize under
concurrency: 30 concurrent client builds take 7.6 s of wall time. Each thread hop runs inside a shielded anyio
scope. When the 5 s deadline passes during the build hop, anyio re-delivers it at the next
checkpoint, which is the insert hop's own checkpoint, so the row is cancelled before the insert
starts. `CancelledError` passes both `except Exception` blocks and `move_on_after` swallows it.
The row vanishes and nothing is logged. On the operator's burst the rerank held all 30 calls about 67 s,
so their bookkeeping queued at the same moment and every row was lost. The refusal that won the
CR-02 slot lost its row the same way (answered at 11.4 s). The other refusal was suppressed and
expected no row (answered at 2.1 s). `mcp_usage` rows go straight to asyncpg and were never lost.

## Fix

- `backend/app/mcp/audit.py`: the row is one parameterized `INSERT` on the asyncpg pool
  (`insert_audit_row`), with metadata from the 293 builder `_audit_args`. No client build and no
  thread hop, and it can be cancelled, so the bound now really caps it.
- `backend/app/mcp/dispatch.py`: when either bookkeeping bound (audit and usage) fires, it logs at
  ERROR with the tool, the key and the write that was lost.
- `audit_key_call_now` is unchanged. It still serves 293's HTTP refusals, which have no bound and
  so lose no rows (they only pay the latency).

After the fix, on the same own-server bursts: 32 searches gave **30 `api_key.read` + 1
`api_key.refused`** (wall 14.1 s → 7.7 s), and 100 `list_documents` gave **100/100** (27.6 s → 0.85 s). No
`NOT written` line appeared in either log.

## Surface classification

Agentic-RAG: the app's MCP server (phase 305).

## Suggested routing

- **Fold into in-flight phase:** 305 (fixed there).
- **Defer to future phase / milestone:** n/a
- **Plant as seed:** n/a
- **External — note only:** no

## Workarounds (prompt-side, code-side, or UI-side)

None before the fix.

## Reference / evidence links

- Debug session: `.planning/debug/305-mcp-audit-rows-lost-under-concurrency.md`
- RED: `backend/tests/integration/test_305_audit_concurrency_live.py`, `backend/tests/unit/test_305_audit.py -k fired`
- Related: BUG-261031-03 (the pool deadlock found by the same burst)
