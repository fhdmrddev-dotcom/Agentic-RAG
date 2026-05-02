# Phase 059: SSE Architecture Refactor - Research

**Researched:** 2026-05-01
**Domain:** Python asyncio + Starlette ASGI streaming, SSE producer/consumer patterns, task cancellation
**Confidence:** HIGH

## Summary

Phase 059 replaces the in-handler async-generator + custom `SSEStreamingResponse`/`_SilentSSEIterator` shim with the canonical `asyncio.Queue` producer/consumer pattern documented in research §A3, using `sse-starlette`'s `EventSourceResponse` for ASGI disconnect detection and re-raising `CancelledError` after the shielded persist (research §A5). All eight locked decisions D-059-01 through D-059-08 are non-negotiable and CONCUR-02 acceptance is the merge bar: client disconnects (tab close, F5, network drop, AbortController) cause the agent task to receive `CancelledError` within 1 second; no further LLM API calls fire after that point; the `asyncio.shield`-protected partial-response persist still completes.

The architectural shift is mechanical and bounded: the entire `event_stream` body at `backend/app/api/threads.py:520-1793` lifts into a nested `agent_runner(queue, ...)` background task; the route handler becomes a thin queue consumer that yields `{"data": payload}` dicts to `EventSourceResponse(consumer(), ping=15)`. Three `if stop_event.is_set(): return` guards (lines 748, 815, 871) and the entire `_stop_event = asyncio.Event()` machinery are deleted — `task.cancel()` raises `CancelledError` at the next `await` naturally. The `except asyncio.CancelledError: pass` at line 1790 changes to `raise`. `backend/app/responses.py` is deleted entirely.

**Primary recommendation:** Pin `sse-starlette==2.4.1` (the only 2.x line whose hard dependency is just `anyio>=4.7.0` — no Starlette upper bound conflict with FastAPI 0.115.6's `starlette<0.42.0,>=0.40.0`). 3.x lines hard-require `starlette>=0.49.1` and would break the FastAPI pin. Use `EventSourceResponse(consumer(), ping=15)` only — do NOT use 2.x `shutdown_event`/`shutdown_grace_period` parameters in 059 (those are for graceful server-shutdown, not client-disconnect, and add scope creep). Wire the queue at `maxsize=100` per D-059-04. Sentinel = `None`. Producer's outermost `finally` always puts the sentinel last, after the shielded persist.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Loop boundary (where the producer task starts)**
- **D-059-01:** Whole `event_stream` body → background `agent_runner` task. Setup (load settings, folder subtree, history), iteration loop, post-loop title/suggestion generation, `stream_end`, AND the `try/finally` shielded persist all live inside the producer. The route handler is thin: create queue, spawn task, return `EventSourceResponse(consumer())`. Matches research §A3 verbatim. Cancellation propagates naturally; partial-response persistence keeps working because the producer's `finally` block still runs and `asyncio.shield` already protects the DB write.
- **D-059-01b:** Producer is a nested `async def agent_runner(queue, ...)` defined inside the route handler — keeps the closure over `current_user`, `body`, `thread_id`, `supabase` exactly as the current code does. Planner may extract to `backend/app/api/_agent_runner.py` if the diff is cleaner; functionally equivalent.

**Cancellation model (single signal, no Stop endpoint)**
- **D-059-02:** Unified `task.cancel()` is the only cancel signal. Drop `_stop_event = asyncio.Event()` (`threads.py:520`) and the `if stop_event.is_set(): return` guards at lines 748, 815, 871. `sse-starlette`'s built-in `request.is_disconnected()` monitor cancels the consumer; the consumer cancels the producer task on disconnect. The producer's outer `try/finally` still runs and `asyncio.shield(_persist_assistant_message())` still protects the partial-response DB write. CHANGE the `except asyncio.CancelledError: pass` at `threads.py:1790` to `except asyncio.CancelledError: raise` — research §A5 explicitly requires re-raising after cleanup; current code swallows it (mild task leak).
- **D-059-03:** Stop button is purely client-side `AbortController`. Confirmed: there is no `/stop` endpoint in the backend; the existing Stop UX worked via `_safe_send`'s `OSError` catcher in the now-deleted `responses.py`. Under the new architecture, AbortController closing the fetch → ASGI `http.disconnect` → `is_disconnected()` returns True → `task.cancel()` → producer's `finally` shields the persist. Stop and tab-close are indistinguishable to the backend, by design. **No task registry, no thread_id → task map, no new endpoint.**

**Queue protocol**
- **D-059-04:** JSON strings on the queue, `sse-starlette` for framing + disconnect detection.
  - Producer puts the existing `json.dumps({...})` payloads onto `asyncio.Queue(maxsize=100)` — without the `f"data: {...}\n\n"` prefix/newlines. Every current `yield f"data: {json.dumps(...)}\n\n"` becomes `await queue.put(json.dumps({...}))`.
  - Consumer `async for` over the queue, yielding `{"data": payload}` dicts to `EventSourceResponse`. `sse-starlette` adds the `data: ` prefix + double-newline framing.
  - Sentinel = `None`. Producer's outermost `finally` always puts `None` last (after the shielded persist).
  - `maxsize=100` ≈ 2s of tokens at 50 tok/s — natural backpressure; consumer is fast (just hands payloads to ASGI send) so the queue rarely fills.
  - No structured event-name routing for this phase — frontend already dispatches on the JSON `type` field, not on the SSE `event` field. Future phase can introduce `event:` lines without changing the wire payload.
  - Ping interval = `EventSourceResponse(ping=15)` (15s default — matches industry SSE keepalive practice; proxies/load balancers won't time out).

**Cleanup + verification gate**
- **D-059-05:** Delete `backend/app/responses.py` entirely. Its only caller is `threads.py:1793`. The `_SilentSSEIterator` OSError catchers and `SSEStreamingResponse._safe_send` swallow-then-stop logic become redundant once `sse-starlette` handles ASGI disconnect natively, and research §A3 explicitly warns: "Don't re-add the OSError-catching `SSEStreamingResponse` shim once `sse-starlette` is in place — it becomes redundant and can hide real bugs."
- **D-059-06:** Merge gate = `tests/integration/test_059_disconnect.py::test_agent_task_cancels_on_disconnect`. Pattern mirrors the 058 gate. Cancellation latency `< 1.0s` and post-disconnect LLM-call count `== 0`.
- **D-059-07:** 058's cross-tab test (`test_cross_tab_unblocked_during_sse`) MUST keep passing — explicit regression guard in the 059 plan. Any 059 change that breaks 058's <1s GET-during-SSE benchmark is a blocking bug, not a 060 problem.
- **D-059-08:** `059-VERIFICATION.md` includes a non-gating manual two-tab DevTools checklist for the disconnect path — open Thread A streaming, close the tab, watch backend logs for `CancelledError` within 1s, confirm no further LLM API calls fire. Mirrors D-058-10 in format.

### Claude's Discretion

- Whether `agent_runner` is a nested `async def` inside the route handler (matches current closure pattern) or extracted to a module like `backend/app/api/_agent_runner.py`. Functionally equivalent; planner picks based on diff size and import-graph fit.
- Exact `sse-starlette` version pin (planner reads `requirements.txt` and PyPI to pick a version compatible with FastAPI 0.115 + Starlette ≥0.41 + Python 3.11+). **Researched and resolved below: `sse-starlette==2.4.1`.**
- Exact pytest fixture name and location for the slow mock LLM (058 already has one — reuse if present; otherwise fixture matches the 058 pattern).
- Whether to introduce a small `_yield(queue, type, **fields)` helper inside `agent_runner` to replace every `await queue.put(json.dumps({"type": ..., **fields}))` — purely ergonomics; planner decides.
- Whether to refactor the iteration `if stop_event.is_set(): return` checks (lines 748, 815, 871) into natural cancellation points (just delete them — `task.cancel()` raises `CancelledError` at the next `await`) or replace each with a comment explaining the deletion. Functionally equivalent under D-059-02.
- Test discovery: whether to put 059's mock-LLM patches in a shared `tests/integration/conftest.py` or reuse 058's fixture file directly.

### Deferred Ideas (OUT OF SCOPE)

- **KI-001 full fix (mid-LLM-call cancellation).** 059 bounds it (no NEW LLM calls after disconnect) but doesn't abort an in-flight SDK call mid-token. Tracked in `KNOWN-ISSUES.md`; CONCUR-02 does not require this.
- **Structured `event:` field routing.** A future refactor could introduce `event: token`, `event: tool_start`, etc.
- **Process-local task registry indexed by thread_id.** Not needed under D-059-03.
- **Migration to `asyncpg` / async Supabase client (CONCUR-03).** Tracked in REQUIREMENTS.md "Future Requirements."
- **Hidden `/__sse_test__` debug route** for manual disconnect drills. Considered and deferred.
- **`/__health/sse` endpoint** that reports current in-flight `agent_runner` task count. Out of scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **CONCUR-02** | When the SSE client disconnects (tab close, F5, network drop), the backend agent task is cancelled within 1 second — no wasted LLM tokens generating responses no client will receive. Verified by: trigger a long-running agent loop → close the SSE connection mid-stream → confirm in backend logs that the agent task receives `CancelledError` and that no further LLM API calls fire after disconnect. | Architectures: §"asyncio.Queue + Background Task", §"sse-starlette EventSourceResponse Internals", §"Cancellation Propagation Timeline (≤1s budget)". Test infrastructure: §"Test Fixture for Mid-Stream Disconnect". Pitfalls: §"Pitfall — Suppressed CancelledError", §"Pitfall — `asyncio.shield` Caveat", §"Pitfall — sse-starlette Version Conflict with FastAPI 0.115". |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

CLAUDE.md directives the planner MUST honor:

- **Python venv required** — `backend/venv/Scripts/python` (Windows) is the single source of truth; never invoke a system Python.
- **No LangChain, no LangGraph** — raw SDK calls only. The producer/consumer pattern uses `asyncio.Queue` + `asyncio.create_task` from stdlib; `sse-starlette` is the only new dependency.
- **Pydantic for structured LLM outputs** — does not affect 059 (no new LLM call sites).
- **All tables need RLS** — does not affect 059 (no schema changes).
- **Stream chat responses via SSE** — 059 keeps the wire format unchanged. Frontend SSE parser is not touched.
- **Use Supabase Realtime for ingestion status updates** — does not affect 059.
- **Module 2+ uses stateless completions — store and send chat history yourself** — already implemented; 059 keeps history loading inside `agent_runner`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| ASGI disconnect detection | Backend (sse-starlette) | — | `EventSourceResponse` runs `_listen_for_disconnect` as a sibling task in its `anyio.create_task_group`; first sibling to finish cancels the others. Frontend cannot observe this. |
| Producer task lifetime | Backend (`asyncio.create_task`) | — | Lives inside the route handler closure. Cancelled by the consumer's `finally` block on disconnect. |
| Consumer wire framing | Backend (sse-starlette) | — | `EventSourceResponse` adds `data: ` prefix + double-newline framing automatically. Producer never emits raw SSE. |
| Cancellation signal | Backend (`task.cancel()`) | — | One-way producer cancel only — no client-side `/stop` endpoint (D-059-03). |
| Stop UX (user-initiated abort) | Frontend (`AbortController`) | Backend (passive disconnect handler) | Browser closes the fetch; ASGI delivers `http.disconnect`; backend cancels the producer. Stop and tab-close are indistinguishable on the backend. |
| Partial-response persistence | Backend (`asyncio.shield`) | — | Already-existing `_shielded_persist` wrapper survives task cancellation; the only behavior change is re-raising `CancelledError` after the shielded await completes. |
| LLM call placement | Backend (provider services) | — | All LLM streaming SDK calls live inside `agent_runner` (the producer). Iteration boundary `await`s become natural cancellation points. |
| Queue backpressure | Backend (`asyncio.Queue(maxsize=100)`) | — | `await queue.put(...)` blocks the producer when the queue is full; natural flow control without a dedicated buffer manager. |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `sse-starlette` | **2.4.1** | `EventSourceResponse` ASGI wrapper that handles `http.disconnect`, ping keepalive, framing | Industry-standard SSE wrapper for Starlette/FastAPI. v2.4.1 is the **only currently-published version** whose hard dependencies (`anyio>=4.7.0` only) do not conflict with FastAPI 0.115.6's pinned `starlette<0.42.0,>=0.40.0` window. [VERIFIED: PyPI JSON for `sse-starlette==2.4.1` and `fastapi==0.115.6`]. |
| `anyio` | `>=4.7.0` (already installed: 4.12.1) | Cooperative task groups, cancellation scopes, run_in_threadpool primitive | Already in the install set via Starlette/FastAPI; sse-starlette uses it for its internal `create_task_group`. [VERIFIED: `pip show anyio` in `backend/venv` returned 4.12.1] |
| `asyncio` (stdlib) | Python 3.12.6 | `Queue`, `create_task`, `shield`, `CancelledError` | Already in use; pattern is canonical Python (research §A3). [VERIFIED: `python -V` returned 3.12.6 in `backend/venv`] |

**Compatibility verification (CRITICAL — do NOT skip):**

```text
fastapi 0.115.6 requires_dist:    starlette<0.42.0,>=0.40.0   [VERIFIED PyPI 2026-05-01]
starlette installed in venv:      0.41.3                       [VERIFIED `python -c 'import starlette'`]
sse-starlette 2.4.1 hard deps:    anyio>=4.7.0                 [VERIFIED PyPI requires_dist excludes starlette from core]
sse-starlette 3.0.4+ hard deps:   starlette>=0.49.1            [VERIFIED PyPI — INCOMPATIBLE with FastAPI 0.115.6]
```

The 3.x line is INCOMPATIBLE with FastAPI 0.115.6 because Starlette 0.49 has not been blessed by FastAPI 0.115.6's pin. Upgrading FastAPI is **out of scope** for 059 (would touch every endpoint and break Phase 058's freshly-shipped concurrency fix). Pin to **`sse-starlette==2.4.1`**.

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `httpx` | `>=0.27.0` (already installed) | `AsyncClient` + `ASGITransport` for the integration test | Already used in `test_058_concurrency.py`. Reuse `async with c.stream(...) as r: async for _ in r.aiter_lines(): break` to simulate mid-stream disconnect. [VERIFIED: existing test file] |
| `pytest-asyncio` | `>=0.24.0` (already installed) | Marks async test functions | Required by 058's `@pytest.mark.asyncio`. Reuse. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `sse-starlette==2.4.1` | FastAPI's built-in `fastapi.sse.EventSourceResponse` (FastAPI 0.135+) | Faster (Rust-side serialization) but **requires FastAPI 0.135+** — 058 just shipped on 0.115.6 and a FastAPI bump is out of scope. Defer to a future milestone. [CITED: WebSearch summary; FastAPI 0.135.0 release notes] |
| `sse-starlette==2.4.1` | `sse-starlette==2.2.1` | 2.2.1 hard-pins `starlette>=0.41.3` (compatible) but is older; 2.4.1 has the same effective compatibility surface and uses `examples` extra for the starlette pin (looser core constraint). Pick 2.4.1. |
| `asyncio.Queue` | `anyio.create_memory_object_stream` | More portable (works on trio) but the codebase is asyncio-native; introducing anyio streams here is gratuitous. |
| `asyncio.Queue(maxsize=100)` | Unbounded `asyncio.Queue()` | Unbounded queue means a slow client can let the producer race ahead unbounded — memory pressure if the agent generates many tokens before the consumer can flush. `maxsize=100` provides natural backpressure (D-059-04). |

**Installation:**

```bash
# Add to backend/requirements.txt:
sse-starlette==2.4.1

# Then in venv:
backend/venv/Scripts/pip install sse-starlette==2.4.1
```

**Version verification (run before pinning):**

```bash
python -c "import urllib.request, json; \
  d = json.loads(urllib.request.urlopen('https://pypi.org/pypi/sse-starlette/2.4.1/json').read()); \
  print('python:', d['info']['requires_python']); \
  print('deps:', d['info']['requires_dist'])"
```

Last-verified output (2026-05-01):
- `python: >=3.9` (project is on 3.12.6 — compatible)
- `deps: ['anyio>=4.7.0', ...examples/uvicorn/granian/daphne are extras]`

## Architecture Patterns

### System Architecture Diagram

```text
                      Client (browser)
                            |
                  POST /threads/{tid}/messages
                            |
                            v
              FastAPI route handler  ──────────────────┐
                            |                          |
                  await aexec(insert user msg)         |  pre-stream INSERT stays here
                            |                          |  (D-058-02 — unchanged)
                            v                          |
              queue = asyncio.Queue(maxsize=100)       |
              task = asyncio.create_task(              |
                       agent_runner(queue, ...))       |
                            |                          |
                            v                          |
              return EventSourceResponse(consumer(),    |
                                          ping=15)     |
                            |                          |
            ┌───────────────┴────────────────┐         |
            v                                v         |
   sse-starlette internal               consumer()     |
   anyio.create_task_group():           async gen      |
   ┌──────────────────────┐             reading        |
   │ _stream_response     │◄──── data ── queue.get()   |
   │ _ping (every 15s)    │             yields         |
   │ _listen_for_disconnect│ ──┐         {"data":...}  |
   └──────────────────────┘   │                        |
                              │                        |
                  http.disconnect arrives              |
                              │                        |
                              v                        |
                cancel_on_finish triggers              |
                task_group.cancel_scope.cancel()       |
                              │                        |
                              v                        |
                consumer's finally:                    |
                  if not task.done(): task.cancel()    |
                              │                        |
                              v                        |
              agent_runner CancelledError fires at     |
              next await (LLM iter, queue.put, etc.)   |
                              │                        |
                              v                        |
              agent_runner outer finally:              |
                await asyncio.shield(_persist_msg())   ◄── partial response saved
                raise   ◄── re-raise CancelledError    |
                              │                        |
                              v                        |
              await queue.put(None)  ◄── sentinel      |
                              │                        |
                              v                        |
              consumer reads None, exits               |
              EventSourceResponse closes               |
```

**Key flow guarantees:**

1. The route handler returns `EventSourceResponse(...)` *before* the producer has produced anything — Starlette starts iterating the consumer as soon as the response is returned.
2. `sse-starlette` runs four sibling tasks in its `anyio.create_task_group`: `_stream_response` (sends data), `_ping`, `_listen_for_exit_signal_with_grace`, `_listen_for_disconnect`. Whichever finishes first cancels all others (the `cancel_on_finish` pattern). [CITED: sse-starlette ARCHITECTURE.md via Context7]
3. When `_listen_for_disconnect` sees `http.disconnect`, it sets `self.active = False` and returns. `cancel_on_finish` then triggers `task_group.cancel_scope.cancel()`, which raises `CancelledError` in `_stream_response` (the consumer-iterating task).
4. The consumer's `finally` block then calls `task.cancel()` on the producer, which raises `CancelledError` at the producer's next `await`.
5. The producer's outermost `try/finally` runs `asyncio.shield(_persist_assistant_message())`. The shield ensures the DB write COMPLETES even though the surrounding scope is being cancelled.
6. After the shielded persist returns, the producer must `raise` the `CancelledError` (D-059-02 — research §A5). This terminates the producer task cleanly.

### Recommended Project Structure

The phase changes a small surface area. No new directory tree.

```text
backend/
├── app/
│   ├── api/
│   │   └── threads.py           # MODIFIED: route handler thin; agent_runner is nested
│   │                            # (or _agent_runner.py if extracted — Claude's discretion)
│   ├── responses.py             # DELETED ENTIRELY (D-059-05)
│   ├── utils/
│   │   └── db.py                # UNCHANGED (058's aexec helper reused as-is)
│   └── main.py                  # UNCHANGED (058's lifespan + AnyIO 200-token limiter inherited)
└── requirements.txt             # MODIFIED: + sse-starlette==2.4.1
backend/tests/
└── integration/
    ├── test_058_concurrency.py  # UNCHANGED (regression-guard — D-059-07)
    └── test_059_disconnect.py   # NEW: merge-gating test (D-059-06)
.planning/phases/059-sse-architecture-refactor/
├── 059-CONTEXT.md               # already exists
└── 059-VERIFICATION.md          # NEW: manual two-tab DevTools checklist (D-059-08)
```

### Pattern 1: `asyncio.Queue` Producer/Consumer with `EventSourceResponse`

**What:** The canonical SSE-for-LLM-agent pattern from research §A3, distilled to the exact shape 059 implements.

**When to use:** Any FastAPI/Starlette SSE endpoint where the work-generating coroutine and the response-yielding coroutine need to be decoupled (so disconnects on the client cancel the work).

**Example — minimal sketch (the planner adapts to threads.py):**

```python
# Source: Context7 sse-starlette docs + research §A3 pattern
from sse_starlette import EventSourceResponse
from starlette.requests import Request
import asyncio
import json

@router.post("/{thread_id}/messages")
async def send_message(thread_id: str, body: MessageCreate, request: Request, ...):
    # Pre-stream INSERT (D-058-02) stays here — runs BEFORE queue creation
    await aexec(supabase.table("messages").insert({...}))

    queue: asyncio.Queue = asyncio.Queue(maxsize=100)

    async def agent_runner() -> None:
        """Producer — entire current event_stream body lives here."""
        try:
            try:
                # Setup: load settings, folder subtree, history (existing code)
                # ...
                # Iteration loop with LLM streaming (existing code)
                #   every  yield f"data: {json.dumps({...})}\n\n"
                #   becomes await queue.put(json.dumps({...}))
                # ...
                # post-loop title/suggestion generation, stream_end (existing code)
            finally:
                # D-059-02: shield the DB write, re-raise CancelledError
                async def _shielded_persist():
                    await _persist_assistant_message()
                try:
                    await asyncio.shield(_shielded_persist())
                except asyncio.CancelledError:
                    raise   # ← was `pass` (line 1790); now `raise` per §A5
        finally:
            # Sentinel: ALWAYS pushed last so consumer can exit cleanly
            await queue.put(None)

    task = asyncio.create_task(agent_runner())

    async def consumer():
        """Thin consumer — yields queue payloads as SSE data dicts."""
        try:
            while True:
                payload = await queue.get()
                if payload is None:
                    break
                yield {"data": payload}
        finally:
            if not task.done():
                task.cancel()
            # Drain task to surface any non-cancellation exception (e.g. for logs)
            try:
                await task
            except asyncio.CancelledError:
                pass  # expected on disconnect
            except Exception:
                logger.exception("agent_runner crashed")

    return EventSourceResponse(consumer(), ping=15)
```

**Critical mapping for the planner:**

| Current code (`threads.py:520-1793`) | New code |
|---|---|
| `_stop_event = asyncio.Event()` (line 520) | **DELETE** |
| `async def event_stream(stop_event = _stop_event)` (line 522) | rename → `async def agent_runner()` (no parameter) |
| `if stop_event.is_set(): return` (lines 748, 815, 871) | **DELETE** all three (cancellation propagates via `task.cancel()` at the next `await`) |
| `yield f"data: {json.dumps({...})}\n\n"` (every occurrence) | `await queue.put(json.dumps({...}))` |
| Inner `try/finally` ending at line 1791 with `except asyncio.CancelledError: pass` | Same shape, but `raise` instead of `pass` (D-059-02) |
| `return sse_response(event_stream(_stop_event), stop_event=_stop_event)` (line 1793) | `return EventSourceResponse(consumer(), ping=15)` |

### Pattern 2: `asyncio.shield` in a Cancelled `finally` Block

**What:** Protects an `await`-able cleanup operation from cancellation while the surrounding scope is being cancelled.

**Mechanics (verified semantics from Python docs):**
- `task.cancel()` arranges for `CancelledError` to be thrown at the next `await` in the wrapped coroutine.
- `await asyncio.shield(coro)` runs `coro` as an inner Task. If the **outer** awaiter is cancelled, the outer `await` raises `CancelledError`, but the inner Task continues to completion. From the inner Task's perspective, no cancellation happened.
- After the shielded await raises, the cleanup is already done (or running to completion in the background).
- The canonical pattern in the `except asyncio.CancelledError` handler is `raise` (the official Python docs example explicitly re-raises after cleanup).

**When to use:** A DB write at the end of a streaming handler that must complete even if the client disconnects.

**Example — current threads.py:1786-1791 with the D-059-02 fix applied:**

```python
# Source: Python 3 official docs for asyncio.shield + research §A5
async def _shielded_persist():
    await _persist_assistant_message()

try:
    await asyncio.shield(_shielded_persist())
except asyncio.CancelledError:
    raise   # ← was `pass` — research §A5 mandates re-raise
```

**Critical caveat (from official Python docs):**

> If the wrapped awaitable itself is cancelled (i.e. from within itself) that would also cancel `shield()`.

In practice this means: if `_persist_assistant_message()` raises `CancelledError` from inside (not common — only happens if it explicitly self-cancels), the shield does NOT protect. For 059, `_persist_assistant_message` is an `await aexec(supabase.table("messages").insert(row))` call which runs inside `run_in_threadpool` — the threadpool worker thread is not directly cancellable, so this caveat does not apply in practice. [VERIFIED: `app/utils/db.py::aexec` source]

### Pattern 3: Re-raising `CancelledError` after Cleanup

**What:** The canonical Python cancellation-cleanup pattern (research §A5; Python 3 official docs example).

**Why it matters:** Swallowing `CancelledError` means the cancelling caller doesn't know cleanup is done — anyio task groups in particular may wait on uncancelled tasks indefinitely. Re-raising lets the cancellation propagate up to the route handler's task and lets `EventSourceResponse`'s task group complete cleanly.

**Example:**

```python
# Source: Python 3 docs https://docs.python.org/3/library/asyncio-task.html
async def cancel_me():
    try:
        await asyncio.sleep(3600)
    except asyncio.CancelledError:
        print('cancel_me(): cancel sleep')
        raise              # ← re-raise after cleanup
    finally:
        print('cancel_me(): after sleep')
```

### Anti-Patterns to Avoid

- **Re-introducing the OSError-catching shim.** `_SilentSSEIterator`, `SSEStreamingResponse._safe_send`, the entire `responses.py` file: research §A3 explicitly warns "Don't re-add the OSError-catching shim once `sse-starlette` is in place — it becomes redundant and can hide real bugs." When `sse-starlette` is in place, OSError on send means something genuinely broken (uvicorn-level transport failure), and you want to see it, not swallow it. Delete the file as D-059-05 mandates. Do not stash a copy.
- **Putting `asyncio.shield` outside the `try`.** If you call `await asyncio.shield(_shielded_persist())` outside a `try: ... except asyncio.CancelledError`, the cancellation propagates and the outer caller has to handle it. Place the shield *inside* the `try` so the `except CancelledError: raise` still runs. (Current code already does this — preserve.)
- **Replacing `await queue.put(...)` with `queue.put_nowait(...)`.** `put_nowait` raises `QueueFull` if `maxsize=100` is reached. Backpressure is desired, not optional — use `await put`.
- **Polling `request.is_disconnected()` from the producer.** Don't. The consumer doesn't need to either when using `EventSourceResponse` — the library spawns `_listen_for_disconnect` as a sibling task and cancels the consumer for you. The user generator can call `await request.is_disconnected()` for early-exit optimisation, but it's not the disconnect-detection mechanism. The mechanism is **task cancellation by sse-starlette's task group**.
- **Adding a `data:` prefix or trailing `\n\n` to queue payloads.** `EventSourceResponse` does this. If you add it, you'll get `data: data: {...}\n\n\n\n` on the wire and the frontend parser will choke.
- **Yielding non-dict items from the consumer.** `EventSourceResponse` expects `dict`-like items with at least `data`, optionally `event` and `id`. Yielding raw strings is undefined behaviour; yield `{"data": payload}`.
- **Using `sse-starlette==3.x` with FastAPI 0.115.6.** 3.x hard-pins `starlette>=0.49.1`; pip will refuse to install or `requirements.txt` resolution will silently downgrade FastAPI/Starlette. Stick to **2.4.1** until a future phase upgrades FastAPI.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Detecting `http.disconnect` from the ASGI receive channel | A custom `_listen_for_disconnect` task watching `await receive()` for `{"type": "http.disconnect"}` | `EventSourceResponse(...)` from sse-starlette | sse-starlette's task-group + `cancel_on_finish` pattern is battle-tested; reimplementing it is exactly what the v2.4 SSEStreamingResponse shim did, and it has multiple known edge cases (the project hit several of them). [CITED: research §A3, §A5] |
| SSE wire framing (`data: ...\n\n`, `id:`, `event:`, ping `:`) | Manual string concatenation inside the consumer | `EventSourceResponse` framing | The HTML5 SSE spec has subtle rules (UTF-8 BOM stripping, multi-line `data:` joining, comment/ping handling). The library implements them. [CITED: HTML spec §9.2 server-sent events via research sources] |
| 15-second SSE keepalive ping | A `while True: await asyncio.sleep(15); yield {"data": ""}` task | `EventSourceResponse(content, ping=15)` | The library runs ping in its task group; you don't have to coordinate it with disconnect detection. Default already 15s. [VERIFIED: Context7 docs] |
| Re-raising `CancelledError` correctly | A custom error-handling pattern | The official Python pattern: `except asyncio.CancelledError: raise` after cleanup | The official Python docs example is the standard. Anything else risks anyio task-group hangs. [CITED: docs.python.org/3/library/asyncio-task.html] |
| Mid-stream client-disconnect simulation in tests | Custom uvicorn restart logic, manual ASGI scope manipulation | `httpx.AsyncClient(app=app)` + `async with c.stream(...)` + `break` after first chunk | Already in use in `test_058_concurrency.py`. Exiting the `async with` early triggers ASGI `http.disconnect`. [VERIFIED: existing 058 test] |

**Key insight:** sse-starlette is a 500-line library. Reimplementing it is what got us into this mess (`responses.py` is the project's hand-rolled equivalent — and per research it has known disconnect-detection gaps). The whole point of 059 is to delete `responses.py`. Don't accidentally re-create it.

## Runtime State Inventory

> 059 is a refactor phase but introduces no runtime state migration. No databases, ID renames, registered services, secrets, or build artifacts change. This section is included for completeness because the phase touches the SSE serving path.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — wire format on the SSE stream is unchanged (still `data: {"type": "...", ...}\n\n`); message rows in Postgres are written by the same `_persist_assistant_message` function with the same shape. | None. |
| Live service config | None — there is no production config (no `/stop` endpoint exists on the server, per D-059-03; no environment variable references `responses.py`). | None — verified by `grep -r "responses" backend/app/` shows only the import in `threads.py:1793` (also being deleted). |
| OS-registered state | None — uvicorn auto-discovers routes; no Windows Task Scheduler, systemd, or pm2 entries reference SSE-specific names. | None. |
| Secrets / env vars | None — the new dependency `sse-starlette` reads no env vars by default. The existing `ANYIO_THREAD_TOKENS` env var (D-058-07) is unchanged. | None. |
| Build artifacts / installed packages | `sse-starlette==2.4.1` is a NEW package added to `requirements.txt`. Developers must run `pip install -r requirements.txt` after pulling. | Document in 059 plan: "After `git pull`, run `backend/venv/Scripts/pip install -r backend/requirements.txt`". |

**Nothing else found** — verified by grepping the repo for `responses`, `SSEStreamingResponse`, `_SilentSSEIterator`, `_stop_event`, `sse_response` and confirming all references are inside `backend/app/responses.py` (deleted), `backend/app/api/threads.py` (modified), or test files in `.claude/worktrees/` (stale snapshots, not active).

## Common Pitfalls

### Pitfall 1: sse-starlette Version Conflict with FastAPI 0.115.6

**What goes wrong:** Installing `sse-starlette` without a version pin grabs 3.4.1 (latest). pip then either fails to resolve (`fastapi 0.115.6 requires starlette<0.42.0; sse-starlette 3.4.1 requires starlette>=0.49.1`) or — worse — silently upgrades Starlette and breaks 058's freshly-shipped concurrency fix because the `lifespan` startup hook ABI changes.

**Why it happens:** sse-starlette 3.x was published Feb 2026 with hard-bumped Starlette baseline; FastAPI 0.115.6 (the project's pin) shipped Dec 2025 against Starlette 0.41. The project chose not to upgrade FastAPI in v2.5 milestone scope.

**How to avoid:** Pin `sse-starlette==2.4.1` exactly — not `>=2.4.1`, not `^2.4.0`. Add to `backend/requirements.txt` directly under the existing `fastapi==0.115.6` line so it's reviewable.

**Warning signs:** `pip install` reports `ERROR: Could not find a version that satisfies the requirement starlette` or pip downgrades fastapi during install. If either happens, the pin is wrong — fix it before merging.

### Pitfall 2: Suppressed `CancelledError` After Shielded Persist

**What goes wrong:** Current code at `threads.py:1790` is `except asyncio.CancelledError: pass`. After 059's refactor, this prevents cancellation from reaching the `agent_runner` task's outer scope. The task never finishes; `task.done()` returns False; the consumer's `await task` in its drain block hangs forever or until the test timeout fires.

**Why it happens:** The previous `_SilentSSEIterator` shim's `_stop_event` design treated `CancelledError` as a normal exit signal — swallowing it was correct in that architecture. In a `task.cancel()`-based architecture, swallowing it leaks the task and breaks anyio task-group cleanup semantics.

**How to avoid:** Change `pass` to `raise`. This is the canonical Python pattern (research §A5; official docs example).

**Warning signs:** Test `test_agent_task_cancels_on_disconnect` reports `task.cancelled()` is False AND `task.exception()` is None — the task ran to "natural completion" instead of being cancelled. That's the symptom of swallowed cancellation.

### Pitfall 3: `asyncio.shield` Caveat — Cancellation Originating Inside

**What goes wrong:** If `_persist_assistant_message()` itself raises `CancelledError` (because the threadpool wrapper is cancelled, or because a future change makes the persist self-cancelling), the shield does NOT protect — official Python docs explicitly say "If the wrapped awaitable itself is cancelled (i.e. from within itself) that would also cancel `shield()`."

**Why it happens:** `asyncio.shield` shields against EXTERNAL cancellation of its caller. It cannot shield against cancellation that originates inside the shielded coroutine.

**How to avoid:** For 059 this is theoretical: `_persist_assistant_message` is `await aexec(query)` which runs inside `run_in_threadpool` (a threadpool worker thread that asyncio cannot directly cancel). The wrapped `.execute()` call runs synchronously in the worker; once started, it runs to completion. Document the assumption in a comment.

**Warning signs:** If a future phase migrates `aexec` to a native async client (CONCUR-03 / asyncpg), revisit the shielding pattern — `asyncpg` calls ARE cancellable, and the shield's caveat would then bite. Add a comment in `agent_runner` calling out the assumption.

### Pitfall 4: Queue Sentinel Never Sent (Producer Crash)

**What goes wrong:** If `agent_runner` raises an unhandled exception BEFORE its outer `finally` runs (e.g. an exception during setup, before the inner `try/finally` is entered), the consumer's `await queue.get()` blocks forever. The route handler's response stays open; the client times out.

**Why it happens:** The sentinel `await queue.put(None)` lives in the producer's outermost `finally`. If the producer raises before that `finally` is entered, the sentinel is never queued. Python evaluates `try/finally` pairs in order — an exception during the `try`'s setup before any `try` is reached will bypass the `finally`.

**How to avoid:** Wrap the ENTIRE producer body in a single `try/finally`, with the sentinel push in the outermost `finally`. The CONTEXT.md sketch already does this. The planner must verify the structure is `async def agent_runner(): try: try: ... finally: shield-persist; finally: queue.put(None)` — both finallys mandatory; outer finally is the sentinel.

**Warning signs:** Test `test_agent_task_cancels_on_disconnect` hangs. Pytest reports the timeout being hit, no `CancelledError` on the task. That means the producer crashed before reaching its outer `finally`.

### Pitfall 5: Frontend Sees Phantom Tokens After Disconnect

**What goes wrong:** Between the client closing the fetch (browser AbortController) and the producer receiving `CancelledError`, the producer may have queued several payloads that the consumer hasn't yet sent. After cancellation, those payloads are simply discarded — the consumer's `finally` cancels the producer, drains nothing.

**Why it happens / matters:** This is correct behaviour, not a bug. But it means: the persisted assistant message in Postgres may have characters beyond what the client saw on screen. CONCUR-02 explicitly accepts this ("no further LLM API calls fire afterward" is the bar — not "client sees exactly what was persisted").

**How to avoid:** Document in `059-VERIFICATION.md` that this is by design. The persisted assistant message is always at-least-as-long-as the visible client transcript — never the other way around.

**Warning signs:** A frontend dev files a "messages don't match what I saw on screen" bug. Reply: WAI; the backend persisted everything it had generated up to the disconnect moment, which is the correct behaviour for crash recovery (if 060/061 ever restore from persistence after F5, the user gets MORE than they saw, not less).

### Pitfall 6: 058's Cross-Tab Test Becomes Order-Sensitive

**What goes wrong:** 058's test mocks the messages-table builder to return slow on the first call (the pre-stream INSERT) and fast on subsequent calls. After 059's refactor, the order of `aexec` calls changes slightly: the route handler still does the pre-stream INSERT first (D-058-02 unchanged), but the producer's history-load `await aexec(...)` happens in the background task instead of in the same generator frame. If the mock state-tracking depends on EXACT call ordering, the test could flake.

**Why it happens:** The test uses a global `state["messages_select_count"]` counter. When the route handler returns and the producer task has not yet run, `count == 1` (the pre-stream INSERT). When Thread B's GET fires, it goes through the threads-table mock, not the messages-table mock — so the counter is unaffected. The test should still pass — but verify by running it under the 059 changes.

**How to avoid:** D-059-07 is explicit: "058's cross-tab test MUST keep passing." Run `pytest backend/tests/integration/test_058_concurrency.py -v` after the 059 refactor. If it fails, the failure is a 059 bug — not a 058 regression — and must block merge.

**Warning signs:** 058's test reports a >1.0s elapsed time after 059 lands. Treat as a 059-blocking bug; possibly the producer task's history load is somehow blocking the event loop (it shouldn't — it's all `await aexec`).

### Pitfall 7: `httpx.AsyncClient.stream(...)` Hanging in Tests

**What goes wrong:** A known issue (httpx discussion #1787): `client.stream()` against an SSE endpoint can hang because the test code and server code run on the same asyncio loop. If the test enters `async for line in r.aiter_lines():` and the server hasn't sent anything yet, both sides park indefinitely.

**Why it happens:** ASGITransport in httpx serves the request inline on the same loop. SSE servers typically `await asyncio.sleep(0.x)` before yielding, which gives the loop time to schedule the test coroutine — but if the producer awaits something blocking (e.g. a misbehaving mock), the test hangs.

**How to avoid:** Always set a timeout on the `httpx.AsyncClient.stream(...)` (058's test uses `timeout=30.0`). For the disconnect test, break out of `aiter_lines()` after the FIRST bytes (or first `data:` line) — don't wait for completion. Add `try/except asyncio.TimeoutError` around the test body.

**Warning signs:** Pytest reports the test hung past its `--timeout` (set one in `pytest.ini` if not already set; 058's test has `timeout=30.0` on the stream call but no overall pytest timeout).

### Pitfall 8: Frontend SSE Parser Sees `event:` Lines It Doesn't Expect

**What goes wrong:** `EventSourceResponse` will emit `event: ping` lines (or `: ping` comment lines, depending on `ping_message_factory`) every 15s. If the frontend parser strictly checks `if (line.startsWith("data:"))` and ignores other lines, this is fine — but if it asserts on event names, surprising parsing.

**How to avoid:** D-059-04 locks the queue payload to data-only (no `event:` field). Verify in `frontend/src/hooks/useChatStream.ts` (or wherever the SSE parser lives) that ping lines (which arrive as `: ping` comments by default in sse-starlette) are silently ignored. The default sse-starlette ping message is a comment line (starts with `:`), which any conforming SSE parser drops. [VERIFIED: sse-starlette source — ping is a comment, not a data event]

**Warning signs:** Frontend console shows `Unexpected SSE line` warnings every 15s after 059 lands.

## Code Examples

Verified patterns from official sources.

### Example 1: Canonical sse-starlette FastAPI Endpoint

```python
# Source: Context7 sse-starlette docs (sysid/sse-starlette/llms.txt)
import asyncio
from fastapi import FastAPI
from starlette.requests import Request
from sse_starlette import EventSourceResponse

app = FastAPI()

async def generate():
    counter = 0
    try:
        while True:
            counter += 1
            yield {"data": f"Item {counter}", "id": str(counter)}
            await asyncio.sleep(0.5)
    except asyncio.CancelledError:
        # Generator was cancelled (client disconnected)
        raise

@app.get("/events")
async def events(request: Request):
    return EventSourceResponse(generate(), ping=15)
```

### Example 2: Cancellation-Safe Cleanup Pattern

```python
# Source: docs.python.org/3/library/asyncio-task.html
import asyncio

async def cancel_me():
    try:
        await asyncio.sleep(3600)
    except asyncio.CancelledError:
        # Cleanup logic here, then re-raise
        raise
    finally:
        # Always-runs cleanup
        ...
```

### Example 3: `httpx.AsyncClient` Mid-Stream Disconnect Test

```python
# Source: existing tests/integration/test_058_concurrency.py + httpx-sse PyPI docs
import asyncio
import httpx
import pytest

@pytest.mark.asyncio
async def test_disconnect_propagates_to_producer(monkeypatch):
    # ... slow-mock-LLM fixture so the SSE stays open long enough to disconnect
    async with httpx.AsyncClient(app=app, base_url="http://test") as c:
        async with c.stream(
            "POST", f"/threads/{thread_id}/messages",
            json={"content": "hello"},
            headers={"Authorization": "Bearer test-token"},
            timeout=30.0,
        ) as r:
            # Read at least one chunk to confirm the stream started
            async for line in r.aiter_lines():
                if line.startswith("data:"):
                    break  # ← exiting `async with c.stream(...)` triggers http.disconnect

        # Now verify cancellation propagated within 1s
        # (mock LLM exposes a counter; assert it stopped incrementing)
```

### Example 4: Asyncio Queue Producer with Sentinel Pattern

```python
# Source: research §A3 + Python asyncio docs
import asyncio
import json

async def producer(queue: asyncio.Queue):
    try:
        try:
            for token in generate_tokens():
                await queue.put(json.dumps({"type": "delta", "content": token}))
            await queue.put(json.dumps({"type": "done"}))
        finally:
            # Critical cleanup with shield (e.g. DB write)
            await asyncio.shield(persist())
    finally:
        # Sentinel ALWAYS pushed last so consumer can exit
        await queue.put(None)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `StreamingResponse` + custom OSError-catching iterator | `EventSourceResponse` from sse-starlette + `task.cancel()` | sse-starlette became the default with v2.0+ (≈2024); the Starlette maintainers reference it from the official docs as the SSE solution | Removes ~150 LOC of error-suppression boilerplate; correct disconnect semantics out of the box |
| `asyncio.Event` polling for stop signals | `task.cancel()` + `try/except CancelledError: raise` after shielded cleanup | Python 3.8+ canonical; documented in official asyncio docs example | Cancellation is delivered at the next `await`, not at the next polling interval — far more responsive |
| Manual `request.is_disconnected()` polling at every iteration | sse-starlette's `_listen_for_disconnect` sibling task | sse-starlette 1.x → 2.x | Disconnect detection is ASGI-native (waits on `receive()` instead of polling) |
| Synchronous `for chunk in stream:` blocking the event loop | (unchanged in 059 — still synchronous) | (KI-001 — deferred) | 059 does NOT fix this; CONCUR-02 only requires "no NEW LLM calls after disconnect" |

**Deprecated/outdated:**

- `responses.py` (`SSEStreamingResponse`, `_SilentSSEIterator`, `sse_response`): file deleted in 059 (D-059-05).
- `_stop_event = asyncio.Event()` polling pattern at three iteration points in `event_stream`: deleted in 059 (D-059-02).
- `asyncio.CancelledError: pass` swallow at line 1790: changed to `raise` in 059 (D-059-02 + research §A5).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | sse-starlette 2.4.1's default ping format is a comment line (`: ping`) that conforming SSE parsers ignore. | Pitfall 8 | Low — verified via Context7 source code reference; if wrong, frontend may log a warning but won't break the parse. |
| A2 | The frontend SSE parser at `frontend/src/hooks/useChatStream.ts` (or equivalent) silently skips non-`data:` lines. | Pitfall 8 | Low — every conforming SSE parser does this per HTML5 spec. If the project rolled its own that doesn't, fix is one-line. |
| A3 | The producer task's history-load `await aexec(...)` does not somehow re-introduce event-loop blocking after the route handler returns. | Pitfall 6 | Low — `aexec` already wraps in `run_in_threadpool` per 058. Verified by reading `app/utils/db.py`. |
| A4 | 1 second is enough budget for: ASGI receive of `http.disconnect` → sse-starlette task-group cancel → consumer finally → `task.cancel()` → producer's next `await` raises CancelledError. | Cancellation Propagation Timeline | Medium — typical end-to-end is <100ms in well-behaved scenarios. Edge case: if the producer is mid-`for chunk in stream:` (sync iterator from OpenAI SDK) and the chunk takes 800ms+, the next `await` is delayed. KI-001 explicitly accepts this. |

**Cancellation Propagation Timeline (≤1s budget):**

| Step | Typical | Worst case (KI-001 territory) | Bounded by |
|------|---------|-------------------------------|------------|
| Browser AbortController fires | 0 ms | 0 ms | Client |
| TCP FIN reaches uvicorn | ≤50ms (LAN) | ≤200ms (cellular) | Network |
| Uvicorn synthesizes `http.disconnect` ASGI msg | <1ms | <1ms | Uvicorn |
| sse-starlette `_listen_for_disconnect` `await receive()` returns | <1ms | <1ms | asyncio scheduling |
| `cancel_on_finish` cancels task group | <1ms | <1ms | anyio |
| Consumer's `finally` runs `task.cancel()` | <1ms | <1ms | asyncio |
| Producer hits next `await` → `CancelledError` raised | <10ms | up to **next chunk boundary** of the LLM stream — typically 50-300ms; worst case 500ms+ if a token batch is in flight | Provider SDK |
| `asyncio.shield(_persist)` runs | 50-200ms (Supabase round-trip via `aexec`/`run_in_threadpool`) | 500ms (cold pgbouncer) | Postgres |
| Sentinel `None` queued; producer task exits | <1ms | <1ms | asyncio |
| **Total budget consumed** | **~150ms typical** | **~900ms worst case** | |

**Conclusion:** 1 second is adequate but not generous. The CONCUR-02 acceptance test should ideally measure latency from `http.disconnect` to "no further LLM API calls" — KI-001's behaviour means that an in-flight chunk may complete after the disconnect, but no NEW LLM call (i.e. next iteration of the agent loop) starts. The 058's test pattern of a `slow_mock_llm` reused here keeps the test deterministic.

## Open Questions (RESOLVED)

1. **Should the consumer await `task` after sentinel?**
   - What we know: The pattern in research §A3 spawns the task, never awaits it (it's "fire and forget"). However, anyio task groups inside sse-starlette will detect that the consumer's underlying task finished but the producer is still alive — depending on Python/uvicorn versions, this can leave a "Task was destroyed but it is pending!" warning in logs.
   - What's unclear: Does the `consumer()`'s `finally` block need an explicit `await task` (with a `try/except CancelledError: pass`) to drain the producer task cleanly?
   - **RESOLVED:** **Yes** — add it. The CONTEXT.md sketch already implies this; the planner should make it explicit. Also benefits: lets the consumer surface non-cancellation exceptions from the producer for logging. (Implemented in `059-02-PLAN.md` consumer block — `try/await task/except CancelledError: pass`.)

2. **Where exactly does the producer's `try/finally` need to be placed for the sentinel to be guaranteed?**
   - What we know: D-059-04 says "Producer's outermost `finally` always puts `None` last (after the shielded persist)." The sketch in this document uses the structure `async def agent_runner(): try: try: <body>; finally: shielded_persist; finally: queue.put(None)`.
   - What's unclear: Is the `try/finally`-wrapping mechanically faithful to the existing line 736-1791 structure?
   - **RESOLVED:** The current code at `threads.py:736-1791` ALREADY has the outer `try/finally` for the shielded persist. 059's change is to wrap the WHOLE producer body in ONE more outer `try/finally` whose only purpose is `await queue.put(None)`. Two finallys: outer = sentinel, inner = shielded persist. (Implemented in `059-02-PLAN.md` task 1 action — explicit two-finally structure verified.)

3. **Does `EventSourceResponse` need a `Content-Type: text/event-stream; charset=utf-8` header explicitly, or does it set it itself?**
   - What we know: Looking at sse-starlette source (Context7), `EventSourceResponse` sets `media_type = "text/event-stream"` automatically. CORS is handled by FastAPI's existing middleware (verified `main.py` has `CORSMiddleware`).
   - What's unclear: Are there any required `Cache-Control: no-cache` or `X-Accel-Buffering: no` headers we need to manually pass via `headers={...}`?
   - **RESOLVED:** sse-starlette sets `Cache-Control: no-cache` automatically (verified in source). Don't override unless a future nginx layer surfaces buffering. Deferred — no plan action.

4. **Should 059 add a `pytest.ini` timeout to prevent the disconnect test hanging if the cancellation logic regresses?**
   - What we know: 058's test uses `timeout=30.0` on the httpx stream call, which limits ONE call. Pytest itself has no global test timeout in the project today.
   - What's unclear: Does `pytest-asyncio` have a default timeout? (No, it doesn't — defaults to none.)
   - **RESOLVED:** Add `pytest-timeout>=2.4.0` and set a 10s timeout on the disconnect test. Belt-and-suspenders against Pitfall 4 (queue sentinel never sent → consumer hangs forever). (Implemented in `059-01-PLAN.md` task 1 — `pytest-timeout>=2.4.0` pinned in `backend/requirements.txt`; `@pytest.mark.timeout(10)` decorator applied in `059-03-PLAN.md` test body.)

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Python | venv runtime | ✓ | 3.12.6 (`backend/venv/Scripts/python -V`) | — |
| FastAPI | route handler | ✓ | 0.115.6 (locked; D-058 baseline) | — |
| Starlette | ASGI base | ✓ | 0.41.3 (transitive via FastAPI) | — |
| anyio | sse-starlette dep | ✓ | 4.12.1 | — |
| httpx | integration tests | ✓ | (already installed; used by 058's test) | — |
| pytest-asyncio | integration tests | ✓ | (already installed; used by 058's test) | — |
| **sse-starlette** | EventSourceResponse | ✗ | — (must be added to requirements.txt) | None — phase blocked without it |
| Supabase | DB writes (already wrapped via `aexec`) | ✓ (via supabase-py 2.10.0) | — | — |

**Missing dependencies with no fallback:**
- `sse-starlette==2.4.1` — blocks 059 entirely. The phase plan must include "add to `backend/requirements.txt` and run `pip install -r backend/requirements.txt`" as Wave 0.

**Missing dependencies with fallback:**
- None.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | `pytest>=8.0.0` + `pytest-asyncio>=0.24.0` (already pinned in `backend/requirements.txt`) |
| Config file | `backend/tests/conftest.py` (env vars + dependency overrides) |
| Quick run command | `cd backend && venv/Scripts/python -m pytest tests/integration/test_059_disconnect.py -v` |
| Full suite command | `cd backend && venv/Scripts/python -m pytest tests/ -v` (excludes `.claude/worktrees`) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CONCUR-02 | Agent task receives `CancelledError` within 1s of client disconnect | integration | `cd backend && venv/Scripts/python -m pytest tests/integration/test_059_disconnect.py::test_agent_task_cancels_on_disconnect -v` | ❌ Wave 0 |
| CONCUR-02 (count) | No new LLM API calls fire after disconnect timestamp | integration | (same test — asserts `llm_call_count_after(disconnect_t0) == 0`) | ❌ Wave 0 |
| D-059-07 (regression) | 058's cross-tab GET test still passes < 1.0s | integration | `cd backend && venv/Scripts/python -m pytest tests/integration/test_058_concurrency.py -v` | ✅ exists |
| D-059-05 (cleanup) | `backend/app/responses.py` no longer exists | structural | `[ ! -f backend/app/responses.py ] && echo OK \|\| echo FAIL` | (no file — assertion on file absence) |
| D-059-02 (raise) | `threads.py` no longer contains `except asyncio.CancelledError:\n        pass` in the persist block | structural | `grep -A1 "except asyncio.CancelledError" backend/app/api/threads.py \| grep -q "raise"` | (grep assertion) |
| Wire format unchanged | A normal end-to-end happy-path message stream still produces the same `data: {...}` lines as v2.4 | integration | new lightweight smoke in `test_059_disconnect.py::test_normal_stream_unchanged` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `cd backend && venv/Scripts/python -m pytest tests/integration/test_059_disconnect.py tests/integration/test_058_concurrency.py -x` (the two gating tests)
- **Per wave merge:** `cd backend && venv/Scripts/python -m pytest tests/integration/ -v` (full integration suite — touches threads, skills, documents, kb, folders, health)
- **Phase gate:** Full backend suite green: `cd backend && venv/Scripts/python -m pytest tests/ -v` before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `backend/tests/integration/test_059_disconnect.py` — new file. Two tests:
  - `test_agent_task_cancels_on_disconnect` (D-059-06 merge gate)
  - `test_normal_stream_unchanged` (smoke — happy-path stream still emits `delta`/`done`/`stream_end` events as v2.4 did)
- [ ] Mock-LLM helper (slow chunks): reuse 058's `_fast_chunks()` pattern but parameterise to slow chunks (`asyncio.sleep(0.3)` between each). Either inline in `test_059_disconnect.py` or extract to a shared `tests/integration/_sse_helpers.py`.
- [ ] LLM-call counter helper: instrument `create_adaptive_streaming_chat` (and Anthropic `stream_anthropic`) via patch to count invocations and expose `count_at(t)` to assertions.
- [ ] `pytest-timeout>=2.4.0`: add to `backend/requirements.txt` and decorate the disconnect test with `@pytest.mark.timeout(10)` to bound Pitfall 4/7 hangs.
- [ ] Framework install: none additional — `sse-starlette==2.4.1` is the only new package.

### Validation Invariants (Nyquist Dimension 8)

Each invariant below corresponds to a binding behavioural contract from D-059-01 through D-059-08. The integration test must establish ALL FOUR.

| # | Invariant | Test assertion | Rationale |
|---|-----------|----------------|-----------|
| I1 | **Cancellation latency ≤ 1.0s** from disconnect to `task.done()`/`task.cancelled()`. | `t_cancel = time.monotonic() - t_disconnect; assert t_cancel < 1.0` | CONCUR-02 success criterion. |
| I2 | **No NEW LLM calls** fire after disconnect. | `assert llm_call_counter.count_after(t_disconnect) == 0` (where the patched mock LLM increments the counter on `__init__`/first chunk request) | CONCUR-02 success criterion verbatim. |
| I3 | **Queue sentinel ordering** — the consumer's last yielded event before exit is the producer's last queued event (i.e. sentinel is reached, not a hang). | Test reads streamed lines into a list; asserts the list is non-empty AND contains no error markers AND ends without a hang. (Implicit via test not timing out.) | Pitfall 4 guard. |
| I4 | **Persist completion on cancel** — after the disconnect propagates and the producer's `finally` runs, the messages table contains an assistant message row for `thread_id` with `role='assistant'` and non-null `content`. | `mock_supabase.table('messages').insert.call_args_list` includes one call with `role='assistant'`. | STREAM-01/03 regression guard (D-059-07 secondary). |

**Test command (running ALL invariants in one test):**

```bash
cd backend && venv/Scripts/python -m pytest \
  tests/integration/test_059_disconnect.py::test_agent_task_cancels_on_disconnect -v -s
```

**Per-invariant commands (if the planner splits into separate tests):**

```bash
# I1
pytest tests/integration/test_059_disconnect.py::test_cancellation_latency_under_1s -v
# I2
pytest tests/integration/test_059_disconnect.py::test_no_llm_calls_after_disconnect -v
# I3
pytest tests/integration/test_059_disconnect.py::test_queue_sentinel_drains -v
# I4
pytest tests/integration/test_059_disconnect.py::test_partial_response_persisted_on_cancel -v
```

The test pattern follows 058's existing approach (httpx.AsyncClient + ASGITransport + dependency_overrides + monkey-patched LLM streaming entry point). The 058 test file (`test_058_concurrency.py:230-251`, `_consume_sse`) gives the disconnect-simulation primitive: exit `async with c.stream(...)` after one chunk → ASGI emits `http.disconnect`.

## Sources

### Primary (HIGH confidence)
- **Context7 / DeepWiki — sysid/sse-starlette**: `EventSourceResponse` API, `_listen_for_disconnect` internals, `cancel_on_finish` task-group pattern, ARCHITECTURE.md flow diagrams. [Resolved via `ctx7 docs /sysid/sse-starlette`]
- **PyPI JSON for `fastapi==0.115.6`**: `requires_dist: starlette<0.42.0,>=0.40.0` — confirms 3.x sse-starlette is incompatible.
- **PyPI JSON for `sse-starlette==2.4.1`**: `requires_dist: anyio>=4.7.0` (no hard starlette pin in core) — confirms compatibility.
- **Backend venv `import starlette; starlette.__version__`**: 0.41.3 — confirms installed version.
- **docs.python.org/3/library/asyncio-task.html**: `asyncio.shield` exact semantics, `Task.cancel()` semantics, canonical try/except CancelledError: raise pattern. [WebFetched]
- **superfastpython.com/asyncio-shield/**: shield-from-cancellation behaviour and caveats. [WebFetched]
- **research/058-sse-concurrency-research.md §A3, §A5**: binding for 059 per CONTEXT.md.
- **CONTEXT.md (`.planning/phases/059-sse-architecture-refactor/059-CONTEXT.md`)**: D-059-01 through D-059-08 — locked decisions.

### Secondary (MEDIUM confidence)
- **DeepWiki sse-starlette client-disconnection-detection page**: confirms EventSourceResponse does NOT auto-poll `is_disconnected()` — disconnect detection happens via the sibling `_listen_for_disconnect` task on `http.disconnect`. User generators *can* call `request.is_disconnected()` for early-exit but it is not the disconnect mechanism. [WebFetched]
- **encode/httpx issue #2186**: ASGITransport streaming behaviour quirks. Confirms `c.stream(...)` context-exit emits ASGI `http.disconnect`. [WebSearched, summary only — workaround patterns documented in 058's test file]
- **github.com/sysid/sse-starlette/blob/main/sse_starlette/sse.py**: confirmed parameter list (ping=15 default, send_timeout, shutdown_event, shutdown_grace_period, client_close_handler_callable). [WebFetched]
- **CLAUDE.md (project root)**: Python venv mandate, no LangChain/LangGraph, raw SDK calls only.
- **058's `test_cross_tab_unblocked_during_sse`** at `backend/tests/integration/test_058_concurrency.py:259-335` and `_consume_sse` helper at lines 230-251 — gives the exact httpx + ASGI disconnect primitive 059 reuses.

### Tertiary (LOW confidence — flagged for validation if used)
- **httpx-sse PyPI**: alternative SSE consumer (`aconnect_sse`) — NOT used by 059's test (the existing httpx pattern is sufficient and matches 058). [WebSearch only — not adopted]
- **FastAPI 0.135+ built-in `fastapi.sse.EventSourceResponse`**: faster alternative with Rust-side serialisation, but requires FastAPI bump out of scope. [WebSearch only — defer to future milestone]

## Metadata

**Confidence breakdown:**
- Standard stack: **HIGH** — version compatibility verified end-to-end via PyPI JSON for both `sse-starlette` candidates and `fastapi==0.115.6`; installed Starlette confirmed via `import starlette` in the project venv.
- Architecture: **HIGH** — sse-starlette internals confirmed via Context7-resolved docs (sysid/sse-starlette ARCHITECTURE.md, llms.txt) describing `cancel_on_finish` task-group + `_listen_for_disconnect` semantics; matches research §A3 verbatim.
- Pitfalls: **HIGH** — each pitfall corresponds to a verified technical mechanism (Python docs `asyncio.shield` caveat, sse-starlette source, FastAPI version pin in PyPI JSON, httpx test-hang issue thread).
- Cancellation timing: **MEDIUM** — typical numbers from research and SDK behaviour; worst case bounded by KI-001 which the user has accepted.

**Research date:** 2026-05-01
**Valid until:** 2026-05-31 (30 days — sse-starlette is stable; the only fast-moving facet is the FastAPI version pin and corresponding sse-starlette compat — re-verify if FastAPI is bumped before phase merges)
