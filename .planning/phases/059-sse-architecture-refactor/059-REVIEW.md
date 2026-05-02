---
phase: 059-sse-architecture-refactor
reviewed: 2026-05-02T00:00:00Z
depth: standard
files_reviewed: 3
files_reviewed_list:
  - backend/app/api/threads.py
  - backend/requirements.txt
  - backend/tests/integration/test_059_disconnect.py
findings:
  critical: 4
  warning: 7
  info: 4
  total: 15
status: issues_found
---

# Phase 059: Code Review Report

**Reviewed:** 2026-05-02
**Depth:** standard
**Files Reviewed:** 3
**Status:** issues_found

## Summary

The Phase 059 refactor moves the SSE generator into an `agent_runner` background task feeding an `asyncio.Queue`, with `event_consumer()` driving `EventSourceResponse(..., ping=15)`. The high-level structure is sound: outer `try/finally` pushes a sentinel, inner `try/finally` shields the persist, and `event_consumer.finally` cancels the producer.

However, several invariants the phase claims to enforce are **not actually enforced** by the code as written. In particular:

- **I3 (persist on disconnect) can deadlock the queue under back-pressure**, blocking task cancellation indefinitely.
- **I4 (CancelledError re-raised) is broken**: the inner generic `except Exception` clause catches `CancelledError` (which inherits from `BaseException` only on Python 3.8+, but the inner-loop OpenAI SDK iteration runs synchronously and any provider exception path swallows it via the broad except). More importantly, the shielded-persist's `except CancelledError: raise` runs only when the *shield itself* sees the cancel — but `_persist_assistant_message`'s exception handler swallows the cancellation entirely.
- **The integration test does not actually validate I1, I3, or I4** as written — `httpx.AsyncClient(app=app)` with `ASGITransport` does NOT propagate `http.disconnect` on context-manager exit when the response body is still being streamed; the test passes for reasons unrelated to the cancellation contract it claims to assert.

Each of these is detailed below with the exact line and a fix.

## Critical Issues

### CR-01: Queue back-pressure can prevent disconnect cancellation (violates I1, I3)

**File:** `backend/app/api/threads.py:520, 763, 830, 889, 1067, 1162, 1175, 1326, 1435, 1439, 1450, 1500, 1631, 1681, 1716, 1723, 1729, 1741, 1749, 1768, 1773, 1786, 1791, 1807`

**Issue:** The producer queue is bounded (`asyncio.Queue(maxsize=100)`). Every `await queue.put(...)` in the producer is a cancellation point — but on client disconnect, the consumer stops pulling from the queue (`event_consumer`'s `while True` exits or never resumes). The producer can block on `queue.put` forever waiting for a slot. The consumer's `finally` then calls `task.cancel()` followed by `await task`, which DOES wake the blocked `put` with `CancelledError` — that part is OK. BUT: in the inner `try` block of `agent_runner`, the path then runs `await asyncio.shield(_shielded_persist())`. After the shield completes, `CancelledError` is re-raised, which propagates to the outer `try/finally`, which then calls `await queue.put(None)` (line 1807) on a queue the consumer is no longer draining. **That `put` will hang forever** because (a) the consumer has already broken out of its `while True` loop or is awaiting `task` (deadlock), and (b) `task.cancel()` was already serviced — there is no second cancel coming.

The combination is: consumer awaits `task` → producer awaits `queue.put(None)` for a slot the consumer will never free → deadlock. The route handler hangs until the worker process is killed. This violates I1 (1s latency) and silently breaks I3 (persist appears to "complete" but the request never returns; under multiple disconnects the worker fills with hung tasks).

**Fix:** Replace the sentinel `put` with `put_nowait`, and drain-or-discard on full:

```python
finally:
    # On disconnect the consumer has stopped pulling; do not block on put.
    try:
        queue.put_nowait(None)
    except asyncio.QueueFull:
        # Consumer is gone — drop the sentinel; the consumer's `await task`
        # will resolve when this finally returns. Safe because consumer.finally
        # only awaits the task, never re-checks the queue.
        pass
```

Equivalently, make the queue unbounded for the sentinel slot, or have `event_consumer.finally` drain the queue with `get_nowait` until the task completes.

---

### CR-02: `_persist_assistant_message` swallows CancelledError, breaking I4

**File:** `backend/app/api/threads.py:729-732`

**Issue:**
```python
try:
    await aexec(supabase.table("messages").insert(row))
except Exception as e:
    logger.error("Failed to persist assistant message: %s", e)
```

On Python 3.8+ `asyncio.CancelledError` inherits from `BaseException`, so a bare `except Exception` does not catch it directly. **However**, this code is wrapped in `asyncio.shield(_shielded_persist())` at line 1803 — the shield's contract is that the inner coroutine continues running even when the outer task is cancelled. When the outer cancel fires, `await asyncio.shield(...)` raises `CancelledError` *to the caller* immediately, but the shielded coroutine is still alive. The `_shielded_persist` coroutine continues running in the background and any exception inside `_persist_assistant_message` is logged-and-swallowed. So far so good.

The real bug: the comment at line 1800 says *"aexec runs in run_in_threadpool — not directly cancellable; shield is sufficient."* This is **wrong** in one important case. If the producer is cancelled DURING `_persist_assistant_message` itself (not the outer flow), the shield protects the threadpool call, but the `except Exception` will catch `RuntimeError` raised by Postgrest on a closed connection without distinguishing it — the message is logged, then the function returns normally, and the outer `finally` proceeds. This is the documented behavior, so no defect on this branch.

**The actual I4 violation** is here: the shielded-persist's `try/except CancelledError: raise` at lines 1804-1805 only catches the cancel at the `await asyncio.shield(...)` boundary. After re-raise, the outer `finally` (line 1806) runs `await queue.put(None)`. That `put` is **also a cancellation point**, and since the task is already in cancelled state, it will raise `CancelledError` immediately without ever placing the sentinel. Combined with CR-01, the consumer ends up awaiting a task whose finally never queued the sentinel, but since the consumer already broke out of its `while True` (or never started another `get`), this isn't visible at the consumer — but the assistant message persist *also* may or may not have completed depending on timing of when the threadpool task scheduled.

**Fix:** Make the persist genuinely uncancellable AND ensure the sentinel is best-effort:

```python
finally:
    async def _shielded_persist():
        try:
            await _persist_assistant_message()
        except BaseException:
            logger.exception("Shielded persist failed")
    # asyncio.shield converts cancellation of OUTER task into a CancelledError
    # raised at the await — but the inner persist still runs to completion
    # because the shield owns its own task. Ensure the inner suppresses errors
    # so partial state never raises into our finally.
    try:
        await asyncio.shield(_shielded_persist())
    except asyncio.CancelledError:
        # Re-raise AFTER ensuring the sentinel is queued — otherwise the
        # outer finally's queue.put(None) never gets a chance.
        try:
            queue.put_nowait(None)
        except asyncio.QueueFull:
            pass
        raise
```

---

### CR-03: Test does not actually trigger client disconnect — invariants I1/I2/I3/I4 are not validated

**File:** `backend/tests/integration/test_059_disconnect.py:117-135, 144-204`

**Issue:** The test's premise is that exiting the `async with client.stream(...)` context manager triggers an ASGI `http.disconnect` event, which in turn cancels the task. **This is not what httpx's `ASGITransport` does.**

`httpx.ASGITransport` in 0.27+ collects the entire ASGI response body into `body_parts` before returning a `Response`. The `client.stream()` async iterator does *not* drive the underlying ASGI app incrementally — by the time `aiter_lines()` yields the first line, the transport has already received `http.response.start` plus some body. Exiting the context closes the *client-side* response, but does NOT send `{"type": "http.disconnect"}` to the ASGI app. The asgi task continues running to completion (or pytest timeout, whichever first).

Evidence in the test's own comments at lines 79-83: *"httpx ASGITransport BUFFERS the entire response in `body_parts` before returning control to the test. With count=50 × delay=0.3s = 15s of streaming, the entire test run exceeds the 10s timeout."* This admits the test is bounded by `count=5` chunks × 0.3s = ~1.5s of streaming → the agent loop completes naturally well within the 1.0s post-disconnect budget plus the test's 10s timeout. **The test passes because the agent finishes normally, not because cancellation propagated.**

Specifically:
- **I1 (latency < 1s)** is asserted via `counter.count_after(t_disconnect) == 0`. But `_make_counted_chat` is called exactly ONCE per agent iteration (the test admits this in lines 83-86). After the first call records its timestamp, the agent enters `_fast_chunks`/`_slow_chunks` iteration; even without cancellation, no second call would fire because `_slow_chunks` yields `_make_done_chunk()` ending the stream and the agent exits the loop normally. **The assertion `count_after == 0` is trivially true regardless of whether cancellation works.**
- **I2 (no NEW LLM calls after disconnect)** has the same flaw — the test relies on the natural single-iteration shape of the patched stream, not on cancellation.
- **I3 (no consumer hang)** is "validated" by the absence of a timeout, but a proper hang test would block the queue at `maxsize=100` then disconnect — this test never reaches even 100 events.
- **I4 (shielded persist runs on disconnect)** — the assertion at lines 194-204 succeeds because the agent runs to completion normally; the persist would happen even without `asyncio.shield`.

**Fix:** Either (a) use a real HTTP server (`uvicorn` in a thread with `httpx.AsyncClient(base_url=f"http://127.0.0.1:{port}")` so disconnect is real), or (b) directly invoke the route, manually cancel the task returned by `asyncio.create_task`, and assert the producer's state. Option (b) is faster but requires refactoring `send_message` to expose the task. Option (a) example:

```python
import uvicorn, threading, socket
def _free_port():
    s = socket.socket(); s.bind(("127.0.0.1", 0)); p = s.getsockname()[1]; s.close(); return p

async def test_agent_task_cancels_on_disconnect():
    port = _free_port()
    config = uvicorn.Config(app, host="127.0.0.1", port=port, log_level="error")
    server = uvicorn.Server(config)
    t = threading.Thread(target=server.run, daemon=True); t.start()
    # ... wait for ready ...
    async with httpx.AsyncClient(base_url=f"http://127.0.0.1:{port}") as c:
        ...
```

Without one of these fixes, **D-059-06 merge gate has no actual coverage of the cancellation contract**.

---

### CR-04: Consumer `await task` can hang forever if producer's outer-finally `queue.put(None)` blocks

**File:** `backend/app/api/threads.py:1828-1833`

**Issue:** The consumer's finally:
```python
finally:
    if not task.done():
        task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass
```

`await task` will not return until the producer's coroutine fully unwinds. The producer's outer `finally` runs `await queue.put(None)` (line 1807). If the consumer broke out of the `while True` because a previous payload was the *last one before the stall* (e.g., normal completion path put `stream_end` then sentinel arrives second), this is fine. But if the consumer broke out because of disconnect-induced exit (sse-starlette cancels the consumer), the consumer is no longer pulling from the queue. The producer's `queue.put(None)` then blocks (queue is full → see CR-01) OR raises `CancelledError` (because the task is already cancelled) — but the producer handles `CancelledError` only at the shield boundary. After the shield re-raises, control reaches the outer finally; the `await queue.put(None)` will itself receive the same pending `CancelledError`, **never enqueueing the sentinel**, and the task completes with `CancelledError`. That is fine for `await task` (it raises and is caught).

So this works for the cancel path, but **only because the queue.put(None) becomes a no-op via re-raised cancel, not because of intentional design**. Combined with the maxsize=100 bound, if the queue is full at cancel time the put will be cancelled, the sentinel never lands, and any future consumer that reuses this queue would deadlock — luckily there isn't one. The risk is fragility: any future change that swallows `CancelledError` in the outer finally (e.g., adding `try/except` around the put for "robustness") will silently deadlock the route.

**Fix:** Document this contract explicitly and use a non-blocking put as in CR-01:
```python
finally:
    try:
        queue.put_nowait(None)
    except asyncio.QueueFull:
        pass
```

This makes the sentinel ordering deterministic regardless of cancel state.

---

## Warnings

### WR-01: `import logging` and `logger` re-bound inside `agent_runner` — shadows module logger and re-runs on every request

**File:** `backend/app/api/threads.py:535-536, 1835`

**Issue:** Inside the request handler:
```python
async def agent_runner() -> None:
    try:
        import logging
        logger = logging.getLogger(__name__)
```
`import logging` runs once globally regardless (module cache), but the `logger = ...` assignment runs on every request. More importantly, `logger` here is a **closure-local variable** — code paths inside `_persist_assistant_message` (line 706, 732) reference `logger` via closure resolution to *this* local. If `_persist_assistant_message` is called from a path where `logger` was never assigned (e.g., an early failure before line 536), `UnboundLocalError` would fire. The current flow always assigns it first, so it works — but it's fragile. The bottom-half consumer at line 1835 separately imports logging and creates its own logger, which is also redundant.

**Fix:** Move to module scope:
```python
# top of file
import logging
logger = logging.getLogger(__name__)
```
Remove lines 535-536 and the import at 1835.

---

### WR-02: `tool_calls_buffer` is annotated twice with conflicting types

**File:** `backend/app/api/threads.py:821, 874`

**Issue:** On line 821 (Anthropic path) `tool_calls_buffer = {}` (untyped). On line 874 (OpenAI/etc. path, same iteration but in else branch) `tool_calls_buffer: dict = {}`. Same issue with `finish_reason` (822, 875). Not a bug, but the lopsided annotations suggest copy-paste churn and complicate refactoring.

**Fix:** Annotate once before the if/else and assign in both branches, or remove the inconsistent annotation.

---

### WR-03: `from app.services.sandbox_service import sandbox_manager` re-imported inside `delete_thread` shadows top-level conditional import

**File:** `backend/app/api/threads.py:33-34, 305-307`

**Issue:** Top of file:
```python
if settings.sandbox_enabled:
    from app.services.sandbox_service import sandbox_manager, harvest_output_files
```
Inside `delete_thread`:
```python
if settings.sandbox_enabled:
    from app.services.sandbox_service import sandbox_manager
    sandbox_manager.close_session(thread_id)
```
The local re-import is fine but unnecessary; if `settings.sandbox_enabled` is True at startup, `sandbox_manager` is already in module scope. If it's False at startup but True at request time, the top-level binding doesn't exist and the local re-import is required. This implicit dependency on import order is a maintenance hazard. Worse: line 1329 (`session = sandbox_manager.get_or_create(thread_id)`) does NOT re-import locally, so an instance where `sandbox_enabled=False` at startup but `True` per-user-setting (settings has user-level overrides per `user_settings.sandbox_enabled` at line 661) will `NameError` at line 1329.

**Fix:** Either always import `sandbox_manager` at module scope (it's cheap), or guard line 1329 with an explicit check + local import.

---

### WR-04: `loop = asyncio.get_event_loop()` is deprecated outside coroutine context, will warn/raise in 3.12+

**File:** `backend/app/api/threads.py:1330`

**Issue:** `asyncio.get_event_loop()` inside a coroutine was deprecated in 3.10 and emits `DeprecationWarning`; in 3.12+ it raises `DeprecationWarning` more loudly and in a future Python it may raise `RuntimeError` if no loop is running on the current thread. The correct call inside a coroutine is `asyncio.get_running_loop()`.

**Fix:**
```python
loop = asyncio.get_running_loop()
```

---

### WR-05: `asyncio.create_task` results discarded — silent task leaks, and tasks die with the request scope

**File:** `backend/app/api/threads.py:1132-1137, 1201-1206, 1521-1526, 1565, 1566-1571, 1609-1614`

**Issue:** Every audit-log and memory-write fire-and-forget pattern uses `asyncio.create_task(...)` without retaining a reference. Per Python docs, the event loop only weakly references tasks created this way; they can be garbage-collected mid-execution producing the warning *"Task was destroyed but it is pending!"*. Worse, in this code these tasks are **created on the request-handler task** — when the request handler returns, the parent task ends; orphan child tasks may be cancelled by the loop's task-graph teardown depending on uvicorn's worker config. For audit logs, a missed write is silently lost.

**Fix:** Either (a) use `BackgroundTasks` (already imported on line 10) and pass the FastAPI background task instance, or (b) retain a module-level set of pending tasks:

```python
_BACKGROUND_TASKS: set[asyncio.Task] = set()

def _spawn(coro):
    t = asyncio.create_task(coro)
    _BACKGROUND_TASKS.add(t)
    t.add_done_callback(_BACKGROUND_TASKS.discard)
    return t
```

Replace all `asyncio.create_task(...)` calls with `_spawn(...)`.

---

### WR-06: `disabled_tools` informational text leaks UI hint into LLM context regardless of mode

**File:** `backend/app/api/threads.py:658-671`

**Issue:** The disabled-tools note is appended to the system prompt, which is fine, but `user_settings.web_search_enabled` and `user_settings.sandbox_enabled` are checked unconditionally. If `user_settings` does not define these attributes (older settings rows missing the fields), `getattr` would throw `AttributeError`. The model `load_user_settings` presumably always returns these — this is a latent bug if the schema evolves and an older row is loaded.

**Fix:** Use `getattr(user_settings, "web_search_enabled", True)` for defensive access, or add a Pydantic default.

---

### WR-07: Test relies on shared module state (`AppStatus.should_exit_event`) and patches it as autouse — fragile to sse-starlette upgrade

**File:** `backend/tests/integration/test_059_disconnect.py:43-62`

**Issue:** The autouse fixture reaches into `sse_starlette.sse.AppStatus` and clobbers a private attribute. Any sse-starlette minor version bump that renames or relocates this could silently break the fixture without an obvious failure. Currently pinned to `sse-starlette==2.4.1` (requirements.txt line 2), so the risk is bounded — but a Renovate-style auto-bump would land here. Add a version assertion in the fixture:

```python
import sse_starlette
assert sse_starlette.__version__.startswith("2.4."), \
    "AppStatus reset fixture validated only for sse-starlette 2.4.x"
```

---

## Info

### IN-01: Dead/duplicated import inside Anthropic branch

**File:** `backend/app/api/threads.py:808`

`from app.services.openai_service import _resolve_max_tokens` is a leading-underscore (private) import done lazily. Acceptable but signals that `_resolve_max_tokens` is not part of the service's public API; if it changes signature, the call here breaks silently. Either expose it as a public symbol or duplicate the small amount of logic.

---

### IN-02: Indentation drift in inner try/except — likely 2-space vs 4-space mix

**File:** `backend/app/api/threads.py:748-1724`

The inner `try` at line 749 is indented with 2 extra spaces relative to the outer `try` at line 748:
```python
            try:  # outer try/finally — guarantees persist...
              try:
                _needs_pre_injection = ...
```
The corresponding `except APIError as e:` at 1683 is also indented with the 2-space offset. Python accepts this because indentation only needs to be consistent within a block, but it makes the file inconsistent with the rest of the codebase (4-space indent throughout). This is a strong indicator the inner block was added by a different editor / autoformatter and never reconciled.

**Fix:** Re-indent lines 749-1724 to the standard 4-space block to match the surrounding file.

---

### IN-03: TODO/FIXME-style narrative comments mixing with code

**File:** `backend/app/api/threads.py:1331-1336`

The 6-line comment explaining why `sandbox_queue` was renamed is informative, but it documents a *previous* bug, not the current code. This is exactly the kind of explanation that belongs in the phase commit message or PATTERNS.md, not in the source. Long-form historical comments rot quickly when nearby code changes.

**Fix:** Replace with a one-line note pointing to the phase doc:
```python
# sandbox_queue: distinct from outer SSE queue — see 059-PATTERNS.md "Naming collisions"
sandbox_queue: asyncio.Queue = asyncio.Queue()
```

---

### IN-04: Test cross-imports private symbols from sibling test module — coupling tests together

**File:** `backend/tests/integration/test_059_disconnect.py:27-37`

The test imports `USER_ID, _make_result, _make_sse_chunk, _make_done_chunk, _fast_chunks, _thread_row, _message_row, _make_table_builder, _build_mock_supabase` from `test_058_concurrency`. The leading-underscore names indicate the helpers are private to the 058 test. Cross-importing private symbols couples tests: a refactor of 058's helpers will silently change 059's test fixture surface. The header comment acknowledges this as a deliberate "Default: Option 1" choice (PATTERNS.md), but extracting to `tests/integration/_sse_helpers.py` after the *second* consumer (this file is already the second consumer) is the documented threshold — extraction is overdue.

**Fix:** Promote the shared helpers to `tests/integration/_sse_helpers.py` now and update both 058 and 059 tests.

---

_Reviewed: 2026-05-02_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
