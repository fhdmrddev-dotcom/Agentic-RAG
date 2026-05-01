# Phase 059: SSE Architecture Refactor - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-01
**Phase:** 059-sse-architecture-refactor
**Areas discussed:** Agent loop boundary, Cancel + shielded persist, Queue + poll cadence, Shim removal + verify

---

## Area selection

| Area | Selected |
|------|----------|
| Agent loop boundary | ✓ |
| Cancel + shielded persist | ✓ |
| Queue + poll cadence | ✓ |
| Shim removal + verify | ✓ |

User selected all four. Foundational architecture phase — no skips warranted.

---

## Agent loop boundary

| Option | Description | Selected |
|--------|-------------|----------|
| Whole event_stream → producer (Recommended) | Entire current event_stream body becomes the agent_runner background task: setup, iteration loop, post-loop suggestions, and the shielded persist all live inside it. Handler is thin: poll is_disconnected(), drain queue, yield events, cancel task on disconnect. Matches research §A3 verbatim. Cancel propagates naturally; persist's finally + asyncio.shield still works. | ✓ |
| Iteration loop only → producer | Setup + post-loop title/suggestions stay in the handler; only the multi-iteration LLM loop runs as a background task. Persist runs handler-side. More moving parts; cancellation only covers the LLM loop, not pre/post work. | |
| Per-iteration task → producer | Each LLM iteration spawns its own short-lived task. Maximally fine-grained cancellation but adds significant orchestration; tool dispatch already lives inside one iteration so this only helps if the LLM call itself is the cancel target. Likely overkill for v2.5 scope. | |

**User's choice:** Whole event_stream → producer.
**Notes:** Captured as **D-059-01**. Locks the architecture to the canonical research §A3 pattern. The producer is a nested closure inside the route handler (D-059-01b) to keep the existing closure over `current_user`, `body`, `thread_id`, `supabase` — same shape as today's `event_stream`.

---

## Cancel + shielded persist

| Option | Description | Selected |
|--------|-------------|----------|
| Unified — task.cancel() is the only signal (Recommended) | Drop _stop_event. Stop button calls a new endpoint that cancels the agent task by id; disconnect-poll calls task.cancel() on is_disconnected. The producer's existing finally block (lines 1780-1791) keeps asyncio.shield around _persist_assistant_message so cancellation re-raises after the DB write completes. One signal, one cleanup path. | ✓ |
| Coexist — _stop_event for Stop, cancel for disconnect | Stop button keeps setting _stop_event (graceful: agent finishes current iteration, persists, exits cleanly); disconnect uses task.cancel (hard: CancelledError mid-iteration, shield still protects persist). Two paths through the producer's finally; matches existing Stop semantics exactly with no behavior change. | |
| Stop = cancel + persistence flag | Stop button cancels the task AND sets a 'stop_requested' flag the shielded persist consults to mark the message as intentionally stopped (not error). Cleaner DB semantics for partial responses but introduces a new column/flag concept the current code doesn't have. | |

**User's choice:** Unified.
**Notes:** Captured as **D-059-02**. Drops `_stop_event` entirely; deletes the `if stop_event.is_set(): return` guards at lines 748, 815, 871. Adds a research-§A5-mandated fix at line 1790: `except asyncio.CancelledError: pass` → `raise`.

### Sub-question: Stop wiring

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — client abort only (Recommended) | Stop = frontend aborts the fetch. Backend detects via is_disconnected() and cancels the task. One unified disconnect-driven cancel path. | ✓ |
| No — there is a backend Stop endpoint | Then we need to refactor it: a process-local registry mapping {thread_id: asyncio.Task} so /stop can find and cancel the task. | |

**User's choice:** Client abort only.
**Notes:** Captured as **D-059-03**. Confirms there is no `/stop` endpoint and none is being added. Stop and tab-close converge on the same code path. No task registry needed.

---

## Queue + poll cadence

| Option | Description | Selected |
|--------|-------------|----------|
| JSON strings + sse-starlette built-in disconnect (Recommended) | Producer puts the existing json.dumps(...) payloads onto an asyncio.Queue(maxsize=100). Consumer awaits queue.get(), yields {'data': payload} dicts to EventSourceResponse, which handles SSE framing + disconnect monitoring + ping internally. Sentinel = None marks end-of-stream. Rely on sse-starlette's built-in ASGI http.disconnect monitor — it already cancels the consumer task on disconnect; our handler propagates that to task.cancel(). Minimal code, library handles the SLA. Ping interval = 15s default. | ✓ |
| Structured dicts + manual is_disconnected() race | Producer puts {'event': 'token', 'data': payload} dicts on the queue (gives us a typed channel for future event-name routing). Consumer races asyncio.wait_for(queue.get(), timeout=0.5) against a periodic is_disconnected() check; on disconnect, task.cancel(). More code, more knobs, but fully explicit — no library magic. | |
| Strings on queue + manual is_disconnected() poll | Strings as in option 1, but poll is_disconnected() ourselves in a 0.5s wait_for loop instead of trusting sse-starlette. Belt-and-suspenders — if sse-starlette's built-in detection ever lags, we still meet the 1s SLA. | |

**User's choice:** JSON strings + sse-starlette built-in disconnect.
**Notes:** Captured as **D-059-04**. `asyncio.Queue(maxsize=100)`, sentinel `None`, payloads are existing `json.dumps({...})` outputs without `data: ` prefix or trailing newlines. Frontend wire format unchanged — frontend already dispatches on JSON `type` field, not on SSE `event` field, so structured `event:` lines stay deferred.

---

## Shim removal + verify

| Option | Description | Selected |
|--------|-------------|----------|
| Delete responses.py + httpx disconnect test (Recommended) | Once EventSourceResponse is wired, threads.py:1793 is the only caller of sse_response/SSEStreamingResponse — delete responses.py entirely. Merge gate = a new tests/integration/test_059_disconnect.py::test_agent_task_cancels_on_disconnect. Plus 058's cross-tab test must keep passing (regression guard). Add a 2-min manual two-tab DevTools timing checklist to 059-VERIFICATION.md (non-gating, mirrors D-058-10). | ✓ |
| Keep responses.py as thin facade | Wrap EventSourceResponse with a sse_response(gen) helper for backward compat at the call site. Cleaner diff but leaves dead code (the _SilentSSEIterator + OSError catchers become redundant). Risks the research §A3 anti-pattern. | |
| Delete responses.py, but add a /__sse_test__ debug route | Same as option 1 plus a hidden test-only endpoint that returns a slow EventSourceResponse for manual disconnect drills. Cheap dev-loop. Skip if the integration test feels sufficient. | |

**User's choice:** Delete responses.py + httpx disconnect test.
**Notes:** Captured as **D-059-05** (delete responses.py), **D-059-06** (httpx integration test as merge gate), **D-059-07** (058's cross-tab test is an explicit regression guard), and **D-059-08** (non-gating manual two-tab DevTools checklist in 059-VERIFICATION.md, mirroring D-058-10).

---

## Claude's Discretion

- Whether `agent_runner` is a nested `async def` inside the route handler (matches current closure pattern) or extracted to `backend/app/api/_agent_runner.py`. Functionally equivalent.
- Exact `sse-starlette` version pin compatible with FastAPI 0.115 + Starlette ≥0.41 + Python 3.11+.
- Exact pytest fixture name and location for the slow mock LLM (058 already has one — reuse if present).
- Whether to introduce a `_yield(queue, type, **fields)` helper inside `agent_runner` to replace every `await queue.put(json.dumps({...}))` — purely ergonomics.
- Whether to refactor or simply delete the three `if stop_event.is_set(): return` checks (lines 748, 815, 871). Functionally equivalent under D-059-02.
- Test discovery: shared `tests/integration/conftest.py` vs reusing 058's fixture file directly.

## Deferred Ideas

- KI-001 full fix (mid-LLM-call cancellation) — 059 only bounds it; full fix is a future phase.
- Structured `event:` field routing on the SSE wire — frontend parser would need changes; not in v2.5 scope.
- Process-local task registry indexed by thread_id — not needed under D-059-03; reconsider if a server-driven stop/pause/resume feature is added later.
- Migration to `asyncpg` / async Supabase client — already tracked as CONCUR-03.
- Hidden `/__sse_test__` debug route for manual disconnect drills — integration test is sufficient.
- `/__health/sse` endpoint reporting in-flight `agent_runner` count — observability nice-to-have, out of scope.
