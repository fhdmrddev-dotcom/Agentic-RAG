# Phase 058 — Manual Verification Checklist

**Phase:** 058-backend-sse-concurrency-fix
**Date:** [fill in when run]
**Tester:** [fill in]
**Environment:** local dev (uvicorn single worker) against real OpenAI/OpenRouter LLM

---

## CI Gate (Automated — Binding)

The merge gate for Phase 058 is the pytest integration test:

```bash
cd backend && venv/Scripts/python.exe -m pytest \
  tests/integration/test_058_concurrency.py::test_cross_tab_unblocked_during_sse -v
```

This test must pass (exit 0) before merging. It uses a slow mock pre-stream
INSERT (1.5s) to keep an `aexec(...)` call in flight on a threadpool worker
and asserts that a concurrent GET on another thread returns in **under 1
second**. On a healthy run, the GET completes in tens of milliseconds.

A measured baseline from a passing run on this branch: **~15ms elapsed**
(threshold 1000ms). If a future run shows elapsed times approaching the
threshold or any regression, treat it as a 058 alert and investigate
before merging.

---

## Manual Two-Tab DevTools Timing Checklist

This checklist is **not gating** but provides human confirmation against a
real LLM and real Supabase instance, ruling out test-environment artefacts.
The automated CI gate above is **confirmatory only** in the manual flow.

Estimated time: 2 minutes.

### Setup

- [ ] Backend running: `uvicorn app.main:app --reload` (single worker — do
      NOT use `--workers N`; D-v2.5-02 explicitly rejects multi-worker as
      the answer to this concurrency bug)
- [ ] Frontend running: `npm run dev` or equivalent
- [ ] Logged in as a test user with at least one thread containing several
      messages

### Procedure

**Tab A — Start a streaming response:**

1. Open the application in Tab A.
2. Navigate to any existing thread (or create one).
3. Open Chrome / Edge / Firefox DevTools → Network tab → filter by `XHR` or
   `Fetch`.
4. Send a message that will trigger a moderately long LLM response (e.g.
   "Write a 200-word paragraph about asyncio concurrency").
5. Observe the streaming response begin. Keep the tab open and streaming.

**Tab B — Measure the concurrent GET:**

6. While Tab A is still streaming, open a **new browser tab** (Tab B).
7. Navigate to the same application.
8. Open DevTools → Network tab in Tab B.
9. Navigate to a **different thread** (Thread B) — click a thread in the
   sidebar while Tab A continues streaming.
10. In Tab B's DevTools Network panel, find the `GET /threads/{id}/messages`
    request that fires when you navigate to Thread B.
11. Record the response time shown in the "Time" column.

### Expected Result

| Metric                                  | Pre-058 (broken)                 | Post-058 (fixed) | Your result   |
| --------------------------------------- | -------------------------------- | ---------------- | ------------- |
| `GET /threads/B/messages` response time | ~30s (hangs until SSE finishes)  | < 1 second       | [fill in]     |

### Pass Criteria

- [ ] The `GET /threads/{B}/messages` response time in Tab B's DevTools is
      **under 1 second** while Tab A is actively streaming.
- [ ] Thread B's messages load correctly (no blank screen, no error).
- [ ] Tab A's stream continues uninterrupted — navigating Tab B does not
      abort Thread A's SSE.

### Fail Action

If the GET response time is >= 1 second:

1. Check that the backend restarted after Plan 02's edits (kill and re-run
   uvicorn; module-level `_patch_postgrest_maybe_single` and the lifespan
   limiter bump only run on a fresh process).
2. Verify `grep -c "await aexec" backend/app/api/threads.py` returns >= 15
   (should be 22 on this branch).
3. Verify the lifespan AnyIO bump took effect:
   ```bash
   curl -s http://localhost:8000/health  # should return 200
   ```
   then check uvicorn logs for any startup errors.
4. Re-run the automated CI gate test to confirm the test environment also
   reproduces the regression.
5. File a 058-blocker if the automated test also regresses.

---

## Notes

[Fill in any observations here — e.g. actual latency measured, LLM model
used, thread sizes tested]

---

## Appendix — Why this checklist exists alongside the automated test

The automated test isolates the 058 fix to the `.execute()` wrap surface
(D-058-09) by mocking `create_adaptive_streaming_chat` and the Supabase
client. The manual test exercises the *full* stack: real network latency,
real Supabase round-trips, real LLM streaming I/O, real browser concurrency
semantics. A green automated test plus a green manual checklist together
provide the strongest evidence that CONCUR-01 is satisfied in production-
like conditions.

---

*Phase: 058-backend-sse-concurrency-fix*
*Checklist version: 1.0 (2026-05-01)*
