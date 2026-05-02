# Phase 059 — Manual Verification Checklist

**Phase:** 059-sse-architecture-refactor
**Date:** [fill in when run]
**Tester:** [fill in]
**Environment:** local dev (uvicorn single worker) against real OpenAI/OpenRouter LLM

---

## CI Gate (Automated — Binding)

The merge gate for Phase 059 is the pytest integration test:

```bash
cd backend && venv/Scripts/python.exe -m pytest \
  tests/integration/test_059_disconnect.py::test_agent_task_cancels_on_disconnect -v
```

This test must pass (exit 0) before merging. It uses a slow mock LLM stream
(`_slow_chunks` — 0.3s per chunk) to keep the SSE producer running long
enough for the test client to disconnect mid-stream, then asserts that
cancellation propagates within **1 second** (no NEW `create_adaptive_streaming_chat`
calls after the disconnect timestamp) and that the shielded persist still
inserted an assistant message.

A measured baseline from a passing run on this branch: cancellation
propagation observed in well under 1 second; LLM-call count after
disconnect = 0; assistant message present in mock Supabase insert log.

---

## Manual Two-Tab DevTools Timing Checklist

This checklist is **not gating** but provides human confirmation against a
real LLM and real network, ruling out test-environment artefacts (httpx
ASGITransport simulates http.disconnect cleanly but does not exercise
the proxy / load-balancer ping path that EventSourceResponse(ping=15)
addresses).

Estimated time: 2 minutes.

### Setup

- [ ] Backend running: `uvicorn app.main:app --reload` (single worker — do
      NOT use `--workers N`; D-v2.5-02 explicitly rejects multi-worker)
- [ ] Frontend running: `npm run dev` or equivalent
- [ ] Logged in as a test user with at least one thread containing
      several messages
- [ ] Backend terminal/log window visible so `CancelledError` lines and
      assistant-persist log lines can be observed in real time

### Procedure

**Tab A — Start a streaming response and disconnect:**

1. Open the application in Tab A.
2. Open Chrome / Edge / Firefox DevTools → Network tab → filter by `XHR`
   or `Fetch`.
3. Open the backend's terminal/log window so you can watch for
   `CancelledError` log lines as they arrive.
4. In Tab A, send a message that will trigger a long LLM response (e.g.
   "Write a 1000-word essay about asyncio cancellation semantics").
5. Observe the SSE stream begin — DevTools shows the
   `POST /threads/{id}/messages` request as `(pending)` with a streaming
   response visible in the Response panel.
6. After ~2 seconds of streaming, **close the tab** (Cmd+W / Ctrl+W).
   - Note the wall-clock time of the close (or use a stopwatch).

**Backend log inspection — measure cancellation latency:**

7. Switch to the backend's terminal.
8. Wait up to 1 second after the tab close.
9. Search the log output for:
   - A `CancelledError` traceback (the producer task being cancelled), OR
   - The assistant-message persist log line (the shielded DB write
     completing).
10. Confirm that within 1 second of the tab close, the LLM API request
    count stops incrementing (no further `openai`/`anthropic`/`openrouter`
    calls fire — visually confirm by watching the backend log for
    provider request lines).

### Expected Result

| Metric                                              | Pre-059 (broken)                        | Post-059 (fixed)                          | Your result   |
| --------------------------------------------------- | --------------------------------------- | ----------------------------------------- | ------------- |
| Time from tab close to `CancelledError` in logs     | Variable (sometimes never)              | < 1 second                                | [fill in]     |
| New LLM API calls fired AFTER tab close             | Up to N more (one per agent iteration)  | 0                                         | [fill in]     |
| Assistant message persisted in `messages` table     | May or may not (race condition)         | Yes (shielded persist always completes)   | [fill in]     |

### Pass Criteria

- [ ] Within 1 second of closing Tab A, the backend log shows
      `CancelledError` (or the producer's `finally` cleanup messages) and
      ceases all LLM calls.
- [ ] Querying `messages` for the test thread shows an assistant row was
      persisted (even though the client never received the full response).
- [ ] No `OSError` or transport-error tracebacks appear in the log
      (sse-starlette handles disconnect cleanly; if you see OSError
      tracebacks, that's a regression — the deleted `_SilentSSEIterator`
      was suppressing them and a re-introduction would mask real bugs).

### Fail Action

If cancellation propagation exceeds 1 second OR new LLM calls keep firing
after tab close:

1. Confirm `backend/app/responses.py` is deleted (`[ ! -f backend/app/responses.py ]`).
   If the file is back, an earlier branch was merged incorrectly — revert
   and rebuild.
2. Verify `grep -A1 "except asyncio.CancelledError" backend/app/api/threads.py | grep -q "raise"`
   returns truthy. If `pass` is back instead of `raise`, the cancel-leak
   documented in RESEARCH §A5 is reintroduced.
3. Verify `grep -c "EventSourceResponse(event_consumer(), ping=15)" backend/app/api/threads.py`
   returns `1`. If `0`, the return statement reverted and sse-starlette
   is no longer wired.
4. Re-run the automated CI gate test to confirm whether the test
   environment also reproduces the regression.
5. File a 059-blocker if the automated test also regresses.

---

## Notes

[Fill in any observations here — e.g. actual cancellation latency
measured, LLM model used, whether the persisted assistant message
contained partial content from before the disconnect, any non-OSError
log lines that appeared.]

> Caveat (RESEARCH Pitfall 5): the persisted assistant message in
> Postgres may have characters beyond what the client saw on screen
> before the tab closed. CONCUR-02 explicitly accepts this — the
> shielded persist captures whatever `full_content` had accumulated
> by the time cancellation landed, which can include tokens that
> were buffered in the queue but never flushed to the client.

---

## Appendix — Why this checklist exists alongside the automated test

The automated test isolates the 059 fix by mocking
`create_adaptive_streaming_chat` (with a slow chunked stream) and the
Supabase client. The manual test exercises the *full* stack: real
network latency, real Supabase round-trips, real LLM streaming I/O,
and the proxy/keepalive path that `EventSourceResponse(ping=15)` is
designed to handle. A green automated test plus a green manual
checklist together provide the strongest evidence that CONCUR-02 is
satisfied in production-like conditions.

---

*Phase: 059-sse-architecture-refactor*
*Checklist version: 1.0 (2026-05-02)*
