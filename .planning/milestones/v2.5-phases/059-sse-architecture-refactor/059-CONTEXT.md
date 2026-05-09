# Phase 059: SSE Architecture Refactor - Context

**Gathered:** 2026-05-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace the in-handler async generator + custom `SSEStreamingResponse`/`_SilentSSEIterator` shim with an `asyncio.Queue` producer/consumer pattern using `sse-starlette`'s `EventSourceResponse`. The whole current `event_stream` body becomes a background `agent_runner` task; the route handler only consumes the queue and delegates disconnect detection to `sse-starlette`. When the client disconnects (tab close, F5, network drop, frontend `AbortController`), the agent task receives `CancelledError` within 1 second, no further LLM API calls fire after that point, and the existing `asyncio.shield`-protected partial-response persistence still completes.

**In scope:**
- `backend/app/api/threads.py:520-1793` — the entire `event_stream` body lifts to an `agent_runner` background producer task; the route handler becomes the consumer. The pre-stream user-message INSERT at `threads.py:511` stays in the route handler (already `aexec`-wrapped per D-058-02).
- `backend/app/responses.py` — **deleted** entirely. `SSEStreamingResponse`, `_SilentSSEIterator`, and `sse_response()` all become redundant once `sse-starlette` handles disconnect.
- `backend/requirements.txt` — add `sse-starlette` (pin a version compatible with FastAPI 0.115 / Starlette ≥0.41).
- `backend/app/api/threads.py:1786-1791` — change the `except asyncio.CancelledError: pass` to `raise` after the shielded persist completes (research §A5: "Always re-raise `CancelledError` after cleanup").
- `tests/integration/test_059_disconnect.py` — new merge-gating integration test.
- `058-VERIFICATION.md`-style manual two-tab DevTools checklist for the disconnect path → `059-VERIFICATION.md` (non-gating, mirrors D-058-10).

**Out of scope (belongs to other phases):**
- Frontend `setViewingThread` / `AbortController` race fixes — Phase 060.
- `visibilitychange` / `pageshow` reconnect handlers + Resume button — Phase 061.
- Browser-MCP scenario harness — Phase 062 (parallel-able).
- Migration to `asyncpg` / async Supabase client — deferred (CONCUR-03).
- Backend `/stop` endpoint — does not exist and is NOT being added (D-059-03).
- A registry of in-flight tasks indexed by thread_id — not needed under D-059-03 (no server-side stop signal).
- KI-001 full fix (mid-LLM-call cancellation) — out of scope; Phase 059 only guarantees no NEW LLM calls fire after disconnect, matching the locked CONCUR-02 success criterion.

</domain>

<decisions>
## Implementation Decisions

### Loop boundary (where the producer task starts)
- **D-059-01:** **Whole `event_stream` body → background `agent_runner` task.** Setup (load settings, folder subtree, history), iteration loop, post-loop title/suggestion generation, `stream_end`, AND the `try/finally` shielded persist all live inside the producer. The route handler is thin: create queue, spawn task, return `EventSourceResponse(consumer())`. Matches research §A3 verbatim. Cancellation propagates naturally; partial-response persistence keeps working because the producer's `finally` block still runs and `asyncio.shield` already protects the DB write.
- **D-059-01b:** Producer is a nested `async def agent_runner(queue, ...)` defined inside the route handler — keeps the closure over `current_user`, `body`, `thread_id`, `supabase` exactly as the current code does. Planner may extract to `backend/app/api/_agent_runner.py` if the diff is cleaner; functionally equivalent.

### Cancellation model (single signal, no Stop endpoint)
- **D-059-02:** **Unified `task.cancel()` is the only cancel signal.** Drop `_stop_event = asyncio.Event()` (`threads.py:520`) and the `if stop_event.is_set(): return` guards at lines 748, 815, 871. `sse-starlette`'s built-in `request.is_disconnected()` monitor cancels the consumer; the consumer cancels the producer task on disconnect. The producer's outer `try/finally` still runs and `asyncio.shield(_persist_assistant_message())` still protects the partial-response DB write. **CHANGE** the `except asyncio.CancelledError: pass` at `threads.py:1790` to `except asyncio.CancelledError: raise` — research §A5 explicitly requires re-raising after cleanup; current code swallows it (mild task leak).
- **D-059-03:** **Stop button is purely client-side `AbortController`.** Confirmed: there is no `/stop` endpoint in the backend; the existing Stop UX worked via `_safe_send`'s `OSError` catcher in the now-deleted `responses.py`. Under the new architecture, AbortController closing the fetch → ASGI `http.disconnect` → `is_disconnected()` returns True → `task.cancel()` → producer's `finally` shields the persist. Stop and tab-close are indistinguishable to the backend, by design. **No task registry, no thread_id → task map, no new endpoint.**

### Queue protocol
- **D-059-04:** **JSON strings on the queue, `sse-starlette` for framing + disconnect detection.**
  - Producer puts the existing `json.dumps({...})` payloads onto `asyncio.Queue(maxsize=100)` — **without** the `f"data: {...}\n\n"` prefix/newlines. Every current `yield f"data: {json.dumps(...)}\n\n"` becomes `await queue.put(json.dumps({...}))`.
  - Consumer `async for` over the queue, yielding `{"data": payload}` dicts to `EventSourceResponse`. `sse-starlette` adds the `data: ` prefix + double-newline framing.
  - Sentinel = `None`. Producer's outermost `finally` always puts `None` last (after the shielded persist).
  - `maxsize=100` ≈ 2s of tokens at 50 tok/s — natural backpressure; consumer is fast (just hands payloads to ASGI send) so the queue rarely fills.
  - **No structured event-name routing** for this phase — frontend already dispatches on the JSON `type` field, not on the SSE `event` field. Future phase can introduce `event:` lines without changing the wire payload.
  - Ping interval = `EventSourceResponse(ping=15)` (15s default — matches industry SSE keepalive practice; proxies/load balancers won't time out).

### Cleanup + verification gate
- **D-059-05:** **Delete `backend/app/responses.py` entirely.** Its only caller is `threads.py:1793`. The `_SilentSSEIterator` OSError catchers and `SSEStreamingResponse._safe_send` swallow-then-stop logic become redundant once `sse-starlette` handles ASGI disconnect natively, and research §A3 explicitly warns: "Don't re-add the OSError-catching `SSEStreamingResponse` shim once `sse-starlette` is in place — it becomes redundant and can hide real bugs."
- **D-059-06:** **Merge gate = `tests/integration/test_059_disconnect.py::test_agent_task_cancels_on_disconnect`.** Pattern mirrors the 058 gate at `tests/integration/test_058_concurrency.py`:
  ```python
  async def test_agent_task_cancels_on_disconnect():
      async with httpx.AsyncClient(app=app, base_url=...) as c:
          # Slow mock LLM (reuse 058 mock fixture if present)
          async with c.stream("POST", f"/threads/{tid}/messages", json=...) as r:
              # Read a few tokens to confirm streaming started
              async for _ in r.aiter_bytes():
                  break  # abort after first chunk
          # After client closes, allow up to 1s for cancellation to propagate
          t0 = time.monotonic()
          await wait_until(lambda: agent_task.done() or no_more_llm_calls(), timeout=1.0)
          assert (time.monotonic() - t0) < 1.0
          assert agent_task.cancelled() or isinstance(agent_task.exception(), asyncio.CancelledError)
          # And: no LLM calls were made AFTER the disconnect timestamp
          assert llm_call_count_after(disconnect_t0) == 0
  ```
  Implementation details (how the mock LLM is wired, how `agent_task` is observable from the test, how LLM calls are counted) are Claude's discretion — pick whichever fixture/dependency-override mechanism is least intrusive (058's mock-LLM stub is the obvious starting point).
- **D-059-07:** **058's cross-tab test (`test_cross_tab_unblocked_during_sse`) MUST keep passing** — explicit regression guard in the 059 plan. Any 059 change that breaks 058's <1s GET-during-SSE benchmark is a blocking bug, not a 060 problem.
- **D-059-08:** **`059-VERIFICATION.md` includes a non-gating manual two-tab DevTools checklist** for the disconnect path — open Thread A streaming, close the tab, watch backend logs for `CancelledError` within 1s, confirm no further LLM API calls fire. Mirrors D-058-10 in format.

### Claude's Discretion
- Whether `agent_runner` is a nested `async def` inside the route handler (matches current closure pattern) or extracted to a module like `backend/app/api/_agent_runner.py`. Functionally equivalent; planner picks based on diff size and import-graph fit.
- Exact `sse-starlette` version pin (planner reads `requirements.txt` and PyPI to pick a version compatible with FastAPI 0.115 + Starlette ≥0.41 + Python 3.11+).
- Exact pytest fixture name and location for the slow mock LLM (058 already has one — reuse if present; otherwise fixture matches the 058 pattern).
- Whether to introduce a small `_yield(queue, type, **fields)` helper inside `agent_runner` to replace every `await queue.put(json.dumps({"type": ..., **fields}))` — purely ergonomics; planner decides.
- Whether to refactor the iteration `if stop_event.is_set(): return` checks (lines 748, 815, 871) into natural cancellation points (just delete them — `task.cancel()` raises `CancelledError` at the next `await`) or replace each with a comment explaining the deletion. Functionally equivalent under D-059-02.
- Test discovery: whether to put 059's mock-LLM patches in a shared `tests/integration/conftest.py` or reuse 058's fixture file directly.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Research and prior-attempt context
- `.planning/research/058-sse-concurrency-research.md` — primary research synthesis. **§A3 is binding for 059** — it is the canonical `asyncio.Queue` + background-task pattern with `EventSourceResponse` + `is_disconnected()`. **§A5 is binding for 059** — `request.is_disconnected()` semantics, the redundancy of the OSError-catching shim, and the "always re-raise CancelledError" rule. Decision matrix at the bottom: option **F** ("`asyncio.Queue` + background task pattern") is what 059 implements.
- `.planning/KNOWN-ISSUES.md` — KI-001 (in-flight LLM calls only stop at `yield` points). 059 does NOT fix KI-001 fully; it bounds it: no NEW LLM calls fire after disconnect, but the current LLM call may complete its current SDK call before cancellation lands. CONCUR-02's success criterion is "no further LLM API calls fire afterward," which the queue refactor achieves cleanly.
- `.planning/milestones/v2.4-phases/057-sse-realtime-reconnect-fix/057-DEFERRAL.md` — historical context for two prior failed attempts; the deferral document's "Backend FastAPI worker is single-threaded against SSE" section frames why 058+059 together unblock the milestone.

### Project-level decisions
- `.planning/PROJECT.md` — Key Decisions table for v2.5 (D-v2.5-01 through D-v2.5-04). D-v2.5-04 specifically locks 059 to `asyncio.Queue` + `sse-starlette` + `is_disconnected()`. **Locked.**

### Requirements
- `.planning/REQUIREMENTS.md` — **CONCUR-02** (SSE handler exits cleanly on disconnect within 1s, agent task cancelled). Acceptance criteria are the authoritative success bar.

### Roadmap
- `.planning/ROADMAP.md` — Phase 059 Success Criteria 1–4 are the binding behavioural contract (queue producer/consumer; `EventSourceResponse` + `is_disconnected()` polling; `CancelledError` within 1s; STREAM-01/STREAM-03 don't regress). Reproduced as decisions above.

### Phase 058 hand-off
- `.planning/phases/058-backend-sse-concurrency-fix/058-CONTEXT.md` — D-058-02 (pre-stream INSERT scope), D-058-03 (`aexec` helper exists at `backend/app/utils/db.py` and 059 reuses it directly), D-058-07 (AnyIO 200-token limiter is set in `lifespan()` — 059 inherits this).
- `.planning/phases/058-backend-sse-concurrency-fix/058-VERIFICATION.md` — verification format precedent for 059-VERIFICATION.md.
- `tests/integration/test_058_concurrency.py` — fixture/style precedent + the regression-guard test that 059 must NOT break.

### Codebase landmarks
- `backend/app/api/threads.py:520` — `_stop_event = asyncio.Event()` — **deleted in 059**.
- `backend/app/api/threads.py:522-1793` — `event_stream` async generator — **lifts to `agent_runner` background task**.
- `backend/app/api/threads.py:511` — pre-stream user-message INSERT (already `aexec`-wrapped per 058) — stays in the route handler (runs BEFORE queue/task creation).
- `backend/app/api/threads.py:736` — outer `try/finally` for shielded persist — moves into `agent_runner`'s body unchanged in shape.
- `backend/app/api/threads.py:1786-1791` — `_shielded_persist` + `asyncio.shield(...)` — keep verbatim **except** change `except asyncio.CancelledError: pass` to `raise` per research §A5.
- `backend/app/api/threads.py:1793` — `return sse_response(event_stream(_stop_event), stop_event=_stop_event)` — replaced with `return EventSourceResponse(consumer(), ping=15)`.
- `backend/app/responses.py` — **entire file deleted in 059**.
- `backend/app/utils/db.py::aexec` — reused as-is (D-058-03).
- `backend/app/main.py:50` — `lifespan()` already sets the AnyIO 200-token limiter (D-058-07) — unchanged.
- `backend/requirements.txt` — `fastapi==0.115.6`, `uvicorn[standard]==0.32.1`, `starlette` (transitive). Add `sse-starlette` here.
- `tests/integration/test_058_concurrency.py` — slow-mock-LLM fixture pattern; 059's test reuses or mirrors.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `backend/app/utils/db.py::aexec(query)` — wraps `query.execute` in `run_in_threadpool`. Already in use across the SSE path. Producer keeps using it inside the new `agent_runner` for every Supabase call (history load, title update, persist). No changes needed.
- 058's slow-mock-LLM fixture in `tests/integration/test_058_concurrency.py` — reuse for 059's disconnect test (slow tokens make the disconnect-during-stream window deterministic).
- `_persist_assistant_message` (`threads.py:~683`) and the `_shielded_persist` wrapper at line 1786 — keep both verbatim. Their `asyncio.shield` semantics already match what 059 needs from a producer's `finally`.

### Established Patterns
- **All Supabase reads/writes in the SSE path are `await aexec(...)` since 058.** The new `agent_runner` inherits this naturally — no sync `.execute()` calls to migrate.
- **Iteration loop already checks `stop_event.is_set()` at three places** (`threads.py:748, 815, 871`). Under D-059-02 these guards are deleted — `task.cancel()` raises `CancelledError` at the next `await`, which is structurally cleaner than polling a flag.
- **`asyncio.shield` is the existing pattern for protecting the final DB write** from cancellation. Pattern survives unchanged; only the swallowed-CancelledError gets fixed (raise instead of pass).
- **The route handler is `async def`**, so spawning `asyncio.create_task(agent_runner(...))` and immediately returning `EventSourceResponse(consumer(...))` is straightforward — no event-loop-bridge gymnastics.

### Integration Points
- **Producer task lifetime is bounded by the consumer's lifetime.** When `sse-starlette` detects `http.disconnect`, it cancels the consumer; the consumer's `finally` calls `task.cancel()` on the producer; the producer's `finally` runs the shielded persist; sentinel `None` flushes through; `EventSourceResponse` closes the response.
- **Frontend wire format is unchanged.** Every event still arrives as `data: {"type": "...", ...}\n\n`. The frontend SSE parser does not need any changes for 059. (060 will change frontend behavior — different file.)
- **058's cross-tab test will continue to exercise the SSE path** under the new architecture. If 058's test ever measures `>1s` for the cross-tab GET, that's a 059 regression (not a 060 issue) and must block merge.

</code_context>

<specifics>
## Specific Ideas

- New file (deleted, not added): `backend/app/responses.py` is gone. The git diff should show `D` for that file.
- Producer name: `agent_runner(queue: asyncio.Queue, ...)` — matches research §A3 verbatim.
- Consumer is an inline `async def event_consumer(): ...` inside the route handler that pulls from queue and yields `{"data": payload}` until sentinel.
- Pin: `sse-starlette` — let planner pick the latest stable version compatible with the Starlette pinned via FastAPI 0.115.6.
- Test name: `tests/integration/test_059_disconnect.py::test_agent_task_cancels_on_disconnect`. Single deterministic assertion: cancellation latency `< 1.0s` and post-disconnect LLM-call count `== 0`.
- Verification doc: `.planning/phases/059-sse-architecture-refactor/059-VERIFICATION.md` includes the manual two-tab DevTools timing checklist alongside the automated test.
- Code change at `threads.py:1790`: `except asyncio.CancelledError: pass` → `except asyncio.CancelledError: raise` — small but explicitly required by research §A5.

</specifics>

<deferred>
## Deferred Ideas

- **KI-001 full fix (mid-LLM-call cancellation).** 059 bounds it (no NEW LLM calls after disconnect) but doesn't abort an in-flight SDK call mid-token. A future phase could thread an `asyncio.CancelScope` or `httpx.AsyncClient` cancel token through the provider SDKs (`stream_anthropic`, `stream_openrouter`, etc.). Tracked in `KNOWN-ISSUES.md`; CONCUR-02 does not require this.
- **Structured `event:` field routing.** The queue carries data-only payloads in 059. A future refactor could introduce `event: token`, `event: tool_start`, etc. for cleaner `EventSource`-side routing. Frontend would need parser changes — not in v2.5 scope.
- **Process-local task registry indexed by thread_id.** Not needed under D-059-03 (no `/stop` endpoint). If a future phase adds server-driven stop/pause/resume, the registry is the place to start.
- **Migration to `asyncpg` / async Supabase client (CONCUR-03).** Removes the AnyIO 200-token ceiling entirely. Tracked in REQUIREMENTS.md "Future Requirements." 059 doesn't move this either way.
- **Hidden `/__sse_test__` debug route** for manual disconnect drills (curl + Ctrl-C). Considered and deferred — the integration test is sufficient. Add later if dev-loop friction surfaces.
- **`/__health/sse` endpoint** that reports current in-flight `agent_runner` task count. Useful observability but out of scope; v2.5 has no observability requirement.

</deferred>

---

*Phase: 059-sse-architecture-refactor*
*Context gathered: 2026-05-01*
