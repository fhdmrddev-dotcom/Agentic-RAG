---
status: awaiting_human_verify
trigger: "Lost MCP audit rows under concurrency (phase 305): 32 concurrent tools/call search_knowledge_base -> 30 answered at ~72.5 s + 2 refused; mcp_usage has all 60 rows, audit_log has ZERO rows for the 32 calls. 1 and 3 concurrent calls audit fine."
created: 2026-10-31T15:40:00Z
updated: 2026-10-31T16:45:00Z
---

## Current Focus

reasoning_checkpoint:
  hypothesis: "Each MCP audit row costs two GIL-bound threadpool hops (a fresh supabase-py client ~0.19 s + a first PostgREST call ~0.21 s). N concurrent rows serialize to ~N x 0.2-0.4 s; when the client-build hop ends after dispatch's 5 s shielded bound, anyio re-delivers the deadline at the insert hop's checkpoint, the CancelledError passes every `except Exception`, move_on_after swallows it, and the row vanishes with no log line."
  confirming_evidence:
    - "auditbench N=30: 30 bounds fired, 0 rows, no log; N=10: 0 fired, 10 rows"
    - "own server, 100 list_documents: 1 row lost, INSTR shows CancelledError inside write_audit_entry after 0.24 s, zero 'audit write failed' lines"
    - "live RED test (32 dispatches, bound 2 s): 1/30 rows kept, refusal row lost"
  falsification_test: "With the row written on the asyncpg pool (no thread hop, no client build), the 32-dispatch live test at the same 2 s bound must keep 30 + 1 rows; if rows are still lost the cause is elsewhere."
  fix_rationale: "Removes the per-row client build and both thread hops: one parameterized INSERT on the already-open asyncpg pool (the path mcp_usage rows take, which never lost a row), which is cancellable, so the bound also really bounds. A fired bound is logged naming tool, key and write."
  blind_spots: "Pool saturation (> 10 concurrent holders) could still delay an insert past the bound — now logged, never silent. 293's HTTP refusal path (audit_key_call_now) keeps the thread hops; it has no bound so it does not lose rows, only latency."
next_action: operator re-runs the original 32-call burst (rerank on) against :8000 after restarting it with the fix, and checks audit_log shows 30 api_key.read + 1 api_key.refused

## Symptoms

expected: exactly one audit_log row per tools/call (30 api_key.read + >= 1 api_key.refused) under concurrency
actual: 32 concurrent calls -> 0 audit rows; 60 mcp_usage rows (asyncpg) all landed; 1 call and 3 calls audit 4/4
errors: none observed in the orchestrator's view (no log captured)
reproduction: 32 concurrent tools/call search_knowledge_base with one MCP key (limit 30/min), rerank on (jev via OpenRouter), operator backend :8000
started: phase 305 (dispatch finally + WR-03 bound)

## Eliminated

## Evidence

- timestamp: 2026-10-31T15:40:00Z
  checked: dispatch.py finally, audit.py, api_key_auth.audit_key_call_now, audit_service.write_audit_entry
  found: "audit path = move_on_after(5, shield=True) -> audit_key_call_now -> run_in_threadpool(get_service_role_supabase -> create_client, a NEW supabase client per call) -> aexec(insert) = second run_in_threadpool -> PostgREST. A fired bound raises CancelledError, which passes both `except Exception` and is swallowed by move_on_after: no log line. Usage writes go through asyncpg directly."
  implication: two threadpool hops + a client build per row; a silent-loss path exists by construction
- timestamp: 2026-10-31T15:55:00Z
  checked: scratch auditbench.py — N concurrent audit_answered under move_on_after(5, shield=True), real local supabase, real create_client per row
  found: "N=1 1.57s rows 1 | N=3 2.97s rows 3 | N=10 9.07s bound_fired 0 rows 10 | N=30 25.40s bound_fired 30 rows 0"
  implication: loss scales with concurrency, independent of rerank and of any search; and the 'bounded' call is held 25 s (the thread hops are shielded, so the 5 s bound does not bound them)
- timestamp: 2026-10-31T15:58:00Z
  checked: scratch clientcost.py — get_service_role_supabase cost
  found: "sequential create_client 0.19 s each; first PostgREST call on a fresh client 0.21 s (0.013 s on a warm one); 10 concurrent builds wall 2.51 s, 30 concurrent 7.63 s (GIL-serialized)"
  implication: per-row bookkeeping is ~0.4 s of GIL-held work, so N rows queue N x 0.2-0.4 s
- timestamp: 2026-10-31T16:05:00Z
  checked: own uvicorn (instr_serve_app, serverburst.py), throwaway org/key; 32 searches (empty corpus) then 100 list_documents
  found: "32 searches: 30 answered at 14.1 s, all 31 rows landed, audit_answered took 8.1 s each (> the 5 s bound) | 100 list_documents: 99 rows; INSTR 'audit_answered CANCELLED/RAISED CancelledError after 10.28s', 'write_audit_entry CancelledError after 0.24s'; zero 'audit write failed' lines"
  implication: H1 confirmed on a real server: the bound cancels the row silently; H2 (swallowed PostgREST errors) eliminated (no error lines)
- timestamp: 2026-10-31T16:10:00Z
  checked: anyio 4.12.1 _asyncio.py run_sync_in_worker_thread / _deliver_cancellation / _restart_cancellation_in_parent
  found: "a thread hop runs in CancelScope(shield=True); a deadline that passes during it is re-delivered when it exits and raised at the NEXT checkpoint. The next checkpoint after the build hop is the insert hop's checkpoint -> the row is cancelled before the insert starts. A deadline that passes during the insert hop finds no further checkpoint -> row lands but the call is held past the bound."
  implication: deterministic rule: the row is lost iff the client-build hop (or a limiter wait) ends after the bound. The rerank-loaded operator burst held all 30 calls ~67 s and their bookkeeping then queued together -> 30/30 lost; the refusal that got the CR-02 slot lost its row the same way (answered 11.4 s), the other was suppressed (answered 2.1 s, no row expected)
- timestamp: 2026-10-31T16:15:00Z
  checked: RED tests
  found: "tests/integration/test_305_audit_concurrency_live.py (32 real dispatches, real audit seam, bound 2 s): '1/30 answered calls kept their audit row', one POST /rest/v1/audit_log in the log, no failure line. tests/unit/test_305_audit.py -k fired: 3 failed with AssertionError: [] (no log line when the bound fires)"
  implication: reproducible RED for both halves of the invariant

## Resolution

root_cause: "backend/app/mcp/audit.py wrote each row through api_key_auth.audit_key_call_now: a new supabase-py client per row + a PostgREST insert, two GIL-serialized threadpool hops inside dispatch.py's 5 s shielded bound. Under concurrency the build hop ended past the bound, anyio re-delivered the deadline at the insert hop's checkpoint, and the CancelledError (past every `except Exception`, swallowed by move_on_after) removed the row with no log line."
fix: "audit.py: insert_audit_row = one parameterized INSERT on the asyncpg pool (metadata from the 293 _audit_args builder); dispatch.py: both bookkeeping bounds log at ERROR (tool, key, write) when they fire. audit_key_call_now untouched (293 HTTP refusals have no bound)."
verification: "live RED->GREEN: 32 dispatches at a 2 s bound 1/30 -> 30+1 rows (3 stable runs, 2.5 s each); unit fired-bound tests RED->GREEN; own-server bursts after the fix: 32 searches 30 read + 1 refused (14.1 s -> 7.7 s), 100 list_documents 100/100 (27.6 s -> 0.85 s), 0 'NOT written' lines; targeted unit 976 passed; 37 live audit/refusal/spend/tools/304-parity passed"
files_changed: [backend/app/mcp/audit.py, backend/app/mcp/dispatch.py, backend/tests/unit/test_305_audit.py, backend/tests/unit/_mcp305_harness.py, backend/tests/unit/test_305_edge_refusals.py, docs/HOT-FILE-LEDGER.md]
