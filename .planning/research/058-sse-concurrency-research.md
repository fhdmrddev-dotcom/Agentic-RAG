# Research — Backend SSE Concurrency + Frontend Reconnect (v2.5 SSE Milestone)

*Generated 2026-05-01 to drive the v2.5 SSE milestone after Phase 057 deferral. Synthesizes web research (FastAPI/Starlette/Uvicorn/Supabase docs + engineering blogs) with codebase reading. Use as input to `/gsd-new-milestone` and the per-phase planner.*

## TL;DR

The dominant blocker is **mechanical**: the synchronous `supabase-py` client's `.execute()` calls inside `event_stream` block the asyncio event loop, freezing every other request in the worker for the full SSE duration. Multi-worker masks this; the right fix is `run_in_threadpool` wrapping. Prior Realtime-based reconnect attempts failed because Supabase Realtime is documented best-effort (not at-least-once), so it cannot be the source of truth for chat-message arrival.

Five sequenced phases proposed: 058 (backend concurrency), 059 (SSE architecture refactor), 060 (frontend race fixes), 061 (reconnect handlers), 062 (validation harness).

---

## Section A — Backend Concurrency (Highest Priority)

### A1. Sync `.execute()` in async handler blocks the event loop. Confidence: HIGH

Confirmed by [FastAPI Concurrency docs](https://fastapi.tiangolo.com/async/): if a library doesn't support `await`, declare path operations as `def`, because `def` endpoints run in an external threadpool. Sync calls inside `async def` run **directly on the event loop** and block ALL other coroutines in the worker.

Field-confirmation: [techbuddies case study](https://www.techbuddies.io/2026/01/10/case-study-fixing-fastapi-event-loop-blocking-in-a-high-traffic-api/), [techbuddies asyncio best practices](https://www.techbuddies.io/2026/01/05/top-7-fastapi-asyncio-best-practices-for-non-blocking-web-apis/).

### A2. Remediation patterns. Confidence: HIGH

| Option | Verdict | Why |
|---|---|---|
| **`starlette.concurrency.run_in_threadpool`** | **Best for FastAPI (tactical)** | Purpose-built; uses AnyIO; respects FastAPI contextvars; same default executor FastAPI uses for sync `def` endpoints |
| `asyncio.to_thread` | Equivalent fallback (stdlib 3.9+) | Same context-propagation; portable but not FastAPI-aware |
| Async client (`asyncpg`, supabase async) | **Best long-term** | Removes the threadpool ceiling; required if QPS × latency > 40 (default AnyIO threadpool size) |

**Pitfall — 40-thread default ceiling:** if you wrap every `.execute()` in `run_in_threadpool` but >40 concurrent in-flight DB calls exist, you queue at the AnyIO limiter — same symptom, different layer. Bump explicitly:

```python
import anyio
anyio.to_thread.current_default_thread_limiter().total_tokens = 200
```

Sources: [Starlette Thread Pool docs](https://starlette.dev/threadpool/), [Sentry: run_in_executor vs run_in_threadpool](https://sentry.io/answers/fastapi-difference-between-run-in-executor-and-run-in-threadpool/), [Kludex/fastapi-tips](https://github.com/Kludex/fastapi-tips/blob/main/README.md).

### A3. Canonical SSE-for-LLM-agent architecture. Confidence: HIGH

Pattern: **`asyncio.Queue` producer/consumer with a background task.** Celery is over-engineered until horizontal scaling or CPU-bound work is needed.

```python
from starlette.concurrency import run_in_threadpool
from sse_starlette.sse import EventSourceResponse
import asyncio

async def agent_runner(queue: asyncio.Queue, thread_id: str, prompt: str):
    try:
        async for token_or_tool_event in run_agent_loop(prompt):
            await queue.put({"event": "token", "data": token_or_tool_event})
        await run_in_threadpool(supabase.table("messages").insert(...).execute)
        await queue.put({"event": "done", "data": ""})
    except Exception as e:
        await queue.put({"event": "error", "data": str(e)})
    finally:
        await queue.put(None)  # sentinel

@app.get("/threads/{tid}/stream")
async def stream(tid: str, request: Request):
    queue: asyncio.Queue = asyncio.Queue(maxsize=100)
    task = asyncio.create_task(agent_runner(queue, tid, prompt))

    async def event_gen():
        try:
            while True:
                if await request.is_disconnected():
                    task.cancel()
                    break
                try:
                    msg = await asyncio.wait_for(queue.get(), timeout=15.0)
                except asyncio.TimeoutError:
                    yield {"event": "ping", "data": ""}
                    continue
                if msg is None:
                    break
                yield msg
        finally:
            if not task.done():
                task.cancel()
    return EventSourceResponse(event_gen())
```

Why this beats alternatives: **BackgroundTasks** (FastAPI's built-in) only runs *after* response completes, so it can't drive a stream; **Celery+Redis** adds infra and serialization round-trip per token (latency-hostile for streaming). The queue boundary lets the SSE handler exit cleanly on disconnect without leaking the agent loop.

Sources: [DEV: Build an LLM Web App Part 4](https://dev.to/zachary62/build-an-llm-web-app-in-python-from-scratch-part-4-fastapi-background-tasks-sse-21g4), [Agent Factory: Streaming with SSE](https://agentfactory.panaversity.org/docs/Building-Agent-Factories/fastapi-for-agents/streaming-with-sse).

### A4. Uvicorn `--workers N` is a scaling lever, not a concurrency fix. Confidence: HIGH

Multi-worker is wrong as the primary fix:
- No shared in-memory state (sessions/caches must move to Redis)
- Breaks debugger attach in dev
- Multiplies DB connections (Supabase pgbouncer ceiling)
- Only N× more head-of-line blocking — masks the real bug

**Verdict:** Single worker in dev. In prod, `workers = CPU cores` *after* blocking calls are fixed.

Sources: [Scaling FastAPI](https://medium.com/@aahana.khanal11/scaling-a-fastapi-application-handling-multiple-requests-at-once-e5c128720c95), [techbuddies workers](https://www.techbuddies.io/2026/03/06/top-7-strategies-to-master-fastapi-uvicorn-concurrency-workers/).

### A5. `request.is_disconnected()` is the canonical disconnect-detection pattern. Confidence: HIGH

Active polling pattern. `sse-starlette` itself uses passive ASGI `http.disconnect` monitor + active `is_disconnected()` polling + `CancelledError` cleanup ([sse-starlette client disconnect](https://deepwiki.com/sysid/sse-starlette/3.5-client-disconnection-detection), [encode/starlette#297](https://github.com/encode/starlette/issues/297)).

The current OSError-catching `SSEStreamingResponse` subclass in `backend/app/responses.py` is a secondary safety net. With `sse-starlette` + `is_disconnected()`, the custom subclass becomes redundant and can be removed.

**Always re-raise `CancelledError`** after cleanup; swallowing it leaks tasks.

---

## Section B — Supabase Realtime Delivery Semantics

### B1. Best-effort, NOT at-least-once. Confidence: HIGH

Per [Supabase discussion #21093](https://github.com/orgs/supabase/discussions/21093): "The server does not guarantee that every message will be delivered to your clients." Events can be missed when:
1. WAL outpaces replication
2. Realtime server crashes/restarts and WAL segments needed have been pruned
3. Client disconnects (no replay queue) — "if you ever drop a connection due to internet issues, power down of app or tabs going into background there is no queue so any changes that happened are missed"
4. RLS authorization can't keep up and times out

Per [Postgres Changes docs](https://supabase.com/docs/guides/realtime/postgres-changes): "If your database cannot authorize the changes rapidly enough, the changes will be delayed until you receive a timeout."

**This is why Phase 057's Realtime-only fix attempt was architecturally doomed.**

### B2. Required setup. Confidence: HIGH

1. **Add to publication:** `ALTER PUBLICATION supabase_realtime ADD TABLE messages;`
2. **REPLICA IDENTITY:** Default fine for INSERT events. `FULL` only for UPDATE/DELETE pre-images.
3. **RLS:** Postgres Changes filters events through SELECT policy — if RLS denies the row, the event is dropped silently.

### B3. Hybrid Realtime + reconcile is canonical. Confidence: HIGH

Pattern: **Realtime for low-latency happy-path + a reconciliation fetch on (re)connect/visibility-change keyed on a monotonic column** (`created_at` or `id`). Don't poll continuously — gate on `visibilitychange` + `pageshow`.

Sources: [BetterLink: Supabase Realtime in Practice](https://eastondev.com/blog/en/posts/dev/supabase-realtime-practice/), [Sequin: All the ways to react to changes in Supabase](https://blog.sequinstream.com/all-the-ways-to-react-to-changes-in-supabase/).

---

## Section C — Frontend Reconnect Patterns

### C1. Fetch-based SSE + recovery polling on page-load is correct. Confidence: HIGH

`EventSource` + `Last-Event-Id` is theoretically elegant but has three deal-breakers for an LLM chat:
1. **GET-only** — long prompts blow URL length limits
2. **No custom headers** — can't send `Authorization: Bearer ...`
3. **Replay requires server-side event log keyed by ID** — backend persists *only at end-of-stream*, so there's nothing to replay mid-flight

Right pattern: fetch+`ReadableStream` for the stream + a one-shot recovery on page-load. Library option: [@microsoft/fetch-event-source](https://github.com/Azure/fetch-event-source).

### C2. `visibilitychange` + `pageshow` both required. Confidence: HIGH

`visibilitychange` does NOT fire on bfcache restore. Listen to both:

```js
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') reconcile();
});
window.addEventListener('pageshow', (e) => {
  if (e.persisted) reconcile();
});
```

### C3. Polling-after-page-load best practices. Confidence: MEDIUM

- **Detection:** last persisted message has `role === 'user'` with no following assistant message
- **Strategy:** *single* server reconcile call (`GET /threads/:id/messages?after=<last_id>`), not a polling loop
- **If still missing:** show explicit "Resume / Regenerate" button. Don't auto-retry the LLM — costs money, may produce duplicates
- **Cancellation:** `AbortController` tied to thread-id ref

### C4. AbortController is the canonical race-fix. Confidence: HIGH

Per [React docs "You Might Not Need an Effect"](https://react.dev/learn/you-might-not-need-an-effect) and [Max Rozen's post](https://maxrozen.com/race-conditions-fetching-data-react-with-useeffect):

```ts
useEffect(() => {
  const ctrl = new AbortController();
  const myRequestId = ++latestRequestRef.current;
  fetch(`/threads/${threadId}/messages`, { signal: ctrl.signal })
    .then(r => r.json())
    .then(data => {
      if (myRequestId !== latestRequestRef.current) return;
      setMessages(data);
    })
    .catch(e => { if (e.name !== 'AbortError') throw e; });
  return () => ctrl.abort();
}, [threadId]);
```

The "loadMessages overwriting its own guard ref" bug from v2.5-dev (Bug 1 in deferral) is the classic symptom of guard-without-abort. Sources: [j-labs AbortController](https://www.j-labs.pl/en/tech-blog/how-to-use-the-useeffect-hook-with-the-abortcontroller/), [wanago.io](https://wanago.io/2022/04/11/abort-controller-race-conditions-react/).

---

## Decision Matrix — Backend Concurrency

| Option | Latency to fix | Risk | Fixes the bug? | Long-term cost |
|---|---|---|---|---|
| **A. Wrap `.execute()` in `run_in_threadpool`** | Hours | Low | Yes (until 40-thread ceiling) | Bump tokens to 200; tech debt |
| B. `asyncio.to_thread` | Hours | Low | Same as A | Same |
| C. Switch to `asyncpg` directly | Days | Medium | Yes, fully | Best — removes ceiling, drops supabase-py for raw SQL |
| D. `--workers 4` | Minutes | Medium | **No** — masks bug | Hides issue from observability |
| E. Celery + Redis pub/sub | Week+ | High | Yes, but overkill | Infra burden; latency on stream |
| F. **`asyncio.Queue` + background task pattern (A3)** | 1–2 days | Low-Med | Yes, fixes architecture | Best for SSE endpoint specifically |

---

## Proposed v2.5 Phase Sequence

| # | Phase | Scope | Validation |
|---|---|---|---|
| **058** | Backend SSE Concurrency Fix | Wrap `.execute()` calls in `run_in_threadpool`; bump AnyIO tokens to 200 | Cross-tab `GET /threads/B/messages` returns < 1s during Thread A SSE |
| **059** | SSE Architecture Refactor | `asyncio.Queue` + background task; replace `SSEStreamingResponse` with `sse-starlette`; `is_disconnected()` polling | Disconnect-during-stream cleanup; agent task cancels (no wasted tokens) |
| **060** | Frontend Race Fixes | `setViewingThread` separation; remove `loadMessages` from SSE finally; `AbortController` cleanup; drop per-stream `channelRef` | Symptom H + Bug 3 don't recur in browser MCP |
| **061** | Reconnect Handlers (E + F) | `visibilitychange` + `pageshow` → single reconcile fetch; "Resume" button on detected user-only state | Symptoms E + F resolved in browser MCP |
| **062** | Validation Harness | chrome-in-browser MCP integration; fetch interceptor; scripted E/F/G/H + navigate-during-stream | Reproducible test runs across all symptoms |

**Sequencing:** 058 → 059 → 060 → 061 hard-ordered. 062 can run parallel with 058 (different files). Without 058, navigation symptoms persist regardless of frontend work — that's what burned the v2.5-dev attempt.

---

## Sources

- [FastAPI Concurrency and async / await](https://fastapi.tiangolo.com/async/)
- [Starlette Thread Pool](https://starlette.dev/threadpool/)
- [Sentry: run_in_executor vs run_in_threadpool](https://sentry.io/answers/fastapi-difference-between-run-in-executor-and-run-in-threadpool/)
- [Kludex fastapi-tips](https://github.com/Kludex/fastapi-tips/blob/main/README.md)
- [techbuddies: FastAPI event loop blocking case study](https://www.techbuddies.io/2026/01/10/case-study-fixing-fastapi-event-loop-blocking-in-a-high-traffic-api/)
- [techbuddies: FastAPI asyncio best practices](https://www.techbuddies.io/2026/01/05/top-7-fastapi-asyncio-best-practices-for-non-blocking-web-apis/)
- [techbuddies: Uvicorn workers strategies](https://www.techbuddies.io/2026/03/06/top-7-strategies-to-master-fastapi-uvicorn-concurrency-workers/)
- [DEV: Build an LLM Web App Part 4 (FastAPI + SSE)](https://dev.to/zachary62/build-an-llm-web-app-in-python-from-scratch-part-4-fastapi-background-tasks-sse-21g4)
- [Agent Factory: Streaming with SSE](https://agentfactory.panaversity.org/docs/Building-Agent-Factories/fastapi-for-agents/streaming-with-sse)
- [sse-starlette: client disconnect detection](https://deepwiki.com/sysid/sse-starlette/3.5-client-disconnection-detection)
- [encode/starlette #297: Detect closed client connections](https://github.com/encode/starlette/issues/297)
- [Supabase Postgres Changes docs](https://supabase.com/docs/guides/realtime/postgres-changes)
- [Supabase discussion #21093: Why no delivery guarantee](https://github.com/orgs/supabase/discussions/21093)
- [Supabase Realtime Concepts](https://supabase.com/docs/guides/realtime/concepts)
- [BetterLink: Supabase Realtime in Practice](https://eastondev.com/blog/en/posts/dev/supabase-realtime-practice/)
- [Sequin: All the ways to react to changes in Supabase](https://blog.sequinstream.com/all-the-ways-to-react-to-changes-in-supabase/)
- [MDN: Using server-sent events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events)
- [HTML spec §9.2 server-sent events](https://html.spec.whatwg.org/multipage/server-sent-events.html)
- [Azure/fetch-event-source](https://github.com/Azure/fetch-event-source)
- [LogRocket: fetch-event-source in React](https://blog.logrocket.com/using-fetch-event-source-server-sent-events-react/)
- [Max Rozen: Fixing Race Conditions in React with useEffect](https://maxrozen.com/race-conditions-fetching-data-react-with-useeffect)
- [j-labs: AbortController in React](https://www.j-labs.pl/en/tech-blog/how-to-use-the-useeffect-hook-with-the-abortcontroller/)
- [wanago.io: AbortController and race conditions](https://wanago.io/2022/04/11/abort-controller-race-conditions-react/)

---

*Companion to: `.planning/phases/057-sse-realtime-reconnect-fix/057-DEFERRAL.md`*
