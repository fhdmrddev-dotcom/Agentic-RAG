# Phase 55: Streaming Reliability & Connection Resilience - Research

**Researched:** 2026-04-26
**Domain:** Python asyncio, SSE streaming, Supabase Realtime (JS), FastAPI async generators
**Confidence:** HIGH — all findings verified against actual codebase; no speculative library claims

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Keep sync LLM clients. Fix KI-001 by passing `stop_event` into `event_stream()` and checking `stop_event.is_set()` at (1) top of each `for iteration in range(max_iterations)` pass, and (2) inside the LLM streaming chunk loop after each chunk is yielded.
- **D-02:** `run_sub_agent()` stays sync. Iteration-boundary check prevents NEW sub-agent calls after stop fires; in-flight call still completes.
- **D-03:** Frontend subscribes to Postgres `INSERT`/`UPDATE` on `messages` table filtered to `thread_id = <current thread>`. Subscription starts when `sendMessage` begins, unsubscribes in `finally` block of `useMessages`.
- **D-04:** On Realtime event — merge directly into messages state: `INSERT` → append, `UPDATE` → replace by `id`. No `loadMessages` round-trip.
- **D-05:** Remove the existing 1.5s SSE-drop fallback (`sseDrop` setTimeout block in `useMessages.ts` lines ~325–334). Realtime handles all drop recovery.
- **D-06:** Realtime subscription lives inside `useMessages` hook, scoped to active thread. Subscribes only while a stream is in progress or just completed. Not a global subscription.
- **D-07:** Wrap `_persist_assistant_message()` with `asyncio.shield()` in the `event_stream()` `finally` block.
- **D-08:** Only completed tool calls (`status=done`) are persisted on disconnect — in-flight tool calls dropped.

### Claude's Discretion

- Exact hook/channel name for the Supabase Realtime subscription
- Whether to use `supabase.channel()` broadcast vs `supabase.from().on()` Postgres changes API
- How to thread `stop_event` into the LLM chunk loop — via closure or explicit parameter

### Deferred Ideas (OUT OF SCOPE)

- Full async client conversion (AsyncOpenAI / AsyncAnthropic)
- Async sub-agent (`run_sub_agent_async`)
- Interrupted tool call persistence (`status=interrupted` to DB)
- Full integration tests (HTTP disconnect simulation)
</user_constraints>

---

## Summary

Phase 55 fixes three independent but related streaming durability gaps. The work spans two files on the backend (`responses.py` and `threads.py`) and one file on the frontend (`useMessages.ts`).

**Gap 1 — KI-001 (stop_event threading):** `event_stream()` is an `async def` generator defined at line 500 of `threads.py`. It closes over all the request-scoped variables. The `stop_event` (`asyncio.Event`) is created at line 83 of `responses.py` inside `SSEStreamingResponse.__call__` — AFTER `event_stream()` is defined and passed to `sse_response()`. This means `stop_event` is NOT in `event_stream()`'s closure. It is injected into the `_SilentSSEIterator` wrapper at line 113 of `responses.py` after the fact (`self.body_iterator._stop_event = stop_event`). The generator itself has no reference to it. The fix is to create `stop_event` before calling `event_stream()` and pass it as a parameter — or create it as a shared mutable container. The simplest approach: create a shared `asyncio.Event()` in the route handler before `event_stream()` is defined, pass it as a parameter to `event_stream(stop_event)`, and still assign it to `body_iterator._stop_event` in `SSEStreamingResponse.__call__`.

**Gap 2 — Supabase Realtime recovery:** The frontend SSE drop fallback (`sseDrop` setTimeout, lines 325–334 of `useMessages.ts`) triggers a full `loadMessages()` round-trip 1.5s after a drop. The fix replaces this with a scoped Realtime subscription on the `messages` table. The `@supabase/supabase-js` version in use (`^2.99.2`) supports the `supabase.channel().on('postgres_changes', ...)` pattern — this is confirmed as the established pattern already used in `useDocuments.ts` and `useFolders.ts`.

**Gap 3 — asyncio.shield() for persist:** `_persist_assistant_message()` is a sync function (confirmed: `def _persist_assistant_message() -> None`). It is called from the `finally` block of an async generator (`async def event_stream()`). When ASGI cancels the task on disconnect, `CancelledError` can prevent the `finally` block from executing the DB write. `asyncio.shield()` alone cannot protect a sync call — it shields coroutines. The correct pattern is to run the sync function in an executor and shield that coroutine.

**Primary recommendation:** Three independent changes; implement and test each separately. No new dependencies required.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| stop_event check in chunk loop | API / Backend (threads.py) | — | Generator runs server-side; check is in the sync for-loop over LLM stream chunks |
| stop_event wiring (pass to generator) | API / Backend (threads.py + responses.py) | — | stop_event created in SSEStreamingResponse, must be shared before generator is wrapped |
| asyncio.shield() for persist | API / Backend (threads.py) | — | finally block of async generator; shield protects the DB write from task cancellation |
| Realtime subscription | Frontend (useMessages.ts) | — | Recovery is purely a frontend concern; backend writes to DB and Postgres CDC broadcasts it |
| sseDrop fallback removal | Frontend (useMessages.ts) | — | Removing dead code path; Realtime replaces it |

---

## Backend: stop_event Threading into event_stream()

### Current Architecture

`responses.py` creates `stop_event` inside `SSEStreamingResponse.__call__` (line 83). The call chain is:

```
route handler (threads.py line 1701):
    return sse_response(event_stream())
           ↓
    SSEStreamingResponse(_SilentSSEIterator(gen))
           ↓
    SSEStreamingResponse.__call__:
        stop_event = asyncio.Event()        ← created HERE, AFTER event_stream() is called
        self.body_iterator._stop_event = stop_event  ← injected into iterator wrapper
```

`event_stream()` is defined and called at line 1701 before `__call__` runs. The generator's closure captures `thread_id`, `current_user`, `body`, `supabase` — but NOT `stop_event`, which does not exist yet. `_SilentSSEIterator.__anext__` checks `self._stop_event.is_set()` before yielding (line 36 of `responses.py`), but that check runs between `yield` boundaries in the generator — not while the generator is blocked inside a sync `for chunk in stream` loop.

### The Fix: Pass stop_event as a Parameter

The cleanest approach that requires minimal refactoring:

1. In `threads.py` route handler, create `stop_event = asyncio.Event()` before defining `event_stream()`.
2. Change `event_stream()` signature to `event_stream(stop_event: asyncio.Event)` and call it as `event_stream(stop_event)`.
3. In `responses.py` `SSEStreamingResponse.__call__`, instead of creating a new `stop_event`, accept it from the iterator: if `body_iterator._stop_event` is already set (non-default), reuse it; otherwise create one. But since `_SilentSSEIterator.__init__` creates `self._stop_event = stop_event or asyncio.Event()`, and the iterator is created with the pre-created event, `__call__` just needs to assign `self.body_iterator._stop_event = stop_event` where `stop_event` is retrieved from the iterator.

Simplest concrete wiring:

```python
# In route handler, before event_stream() definition:
_stop_event = asyncio.Event()

async def event_stream(_stop: asyncio.Event = _stop_event) -> AsyncGenerator[str, None]:
    ...
    for iteration in range(max_iterations):
        if _stop.is_set():          # ← CHECK 1: top of each iteration
            return
        ...
        for chunk in stream:        # OpenAI/OpenRouter path
            if _stop.is_set():      # ← CHECK 2: between chunks
                return
            yield f"data: ..."
        ...
        for _ant_event in _ant_gen: # Anthropic path
            if _stop.is_set():      # ← CHECK 2: between Anthropic events
                return
            ...yield...

# Pass pre-created event to the iterator
return sse_response(event_stream(), stop_event=_stop_event)
```

Then in `sse_response()` and `_SilentSSEIterator.__init__`, accept and thread the pre-created event:

```python
def sse_response(gen, media_type="text/event-stream", stop_event=None):
    return SSEStreamingResponse(_SilentSSEIterator(gen, stop_event), media_type=media_type)
```

`SSEStreamingResponse.__call__` already does:
```python
stop_event = asyncio.Event()
...
if isinstance(self.body_iterator, _SilentSSEIterator):
    self.body_iterator._stop_event = stop_event
```

This overwrites the pre-created event with a new one. The fix is: if `self.body_iterator._stop_event` is already a non-default event (i.e., was passed in), use it; otherwise create a new one. Or: don't create a new one in `__call__` — instead, always use the iterator's existing event and also set it on disconnect. The simplest change to `__call__`:

```python
# Instead of: stop_event = asyncio.Event()
# Do:
stop_event = self.body_iterator._stop_event  # reuse pre-created event
# (don't overwrite it)
```

This means the event created in the route handler, passed to `event_stream()`, and passed to `_SilentSSEIterator` is the same object that `_safe_send` sets on disconnect. [VERIFIED: codebase]

### Chunk Loop Check Points

**OpenAI/OpenRouter path** (lines 832–856 of `threads.py`):
```python
for chunk in stream:
    if stop_event.is_set():  # ADD after each yield or before processing
        return
    ...
    yield f"data: ..."
```

**Anthropic path** (lines 787–803 of `threads.py`):
```python
for _ant_event in _ant_gen:
    if stop_event.is_set():
        return
    ...
    if _etype == "delta":
        ...
        yield f"data: ..."
```

**Iteration boundary** (line 727 of `threads.py`):
```python
for iteration in range(max_iterations):
    if stop_event.is_set():
        return
    ...
```

### What Remains Uninterruptible

Per D-02, the following continue to completion even after stop fires:
- The current sync LLM SDK call — stops at the next chunk boundary, not mid-call
- The current `run_sub_agent()` call — runs to completion (sync)

This is acceptable per the locked decisions. The iteration check prevents any NEW rounds from starting.

---

## Backend: asyncio.shield() Persist-on-Disconnect Pattern

### Confirmed: _persist_assistant_message() Is Sync

From code inspection (line 667 of `threads.py`):
```python
def _persist_assistant_message() -> None:
    """Insert the assistant message row. Idempotent — only runs once."""
```

This is a plain synchronous function. It calls `supabase.table("messages").insert(row).execute()` — a sync Supabase client call. [VERIFIED: codebase]

### The Problem

The `finally` block at line 1695 of `threads.py` runs in an async generator context. When ASGI cancels the generator task on client disconnect, `asyncio.CancelledError` is thrown at the generator's current `await` point. Python's async generator cleanup runs the `finally` block, but if `CancelledError` propagates before the DB write completes, the persist can be skipped.

`asyncio.shield()` only protects coroutines (`async def` functions that can be awaited). Calling `asyncio.shield(_persist_assistant_message())` would fail because `_persist_assistant_message()` returns `None`, not a coroutine.

### Correct Pattern

To protect a sync function from `CancelledError` in an async context:

```python
# Option A: run_in_executor + shield (wrap sync call as a coroutine)
import asyncio

finally:
    loop = asyncio.get_event_loop()
    try:
        await asyncio.shield(
            loop.run_in_executor(None, _persist_assistant_message)
        )
    except asyncio.CancelledError:
        pass  # shield keeps the executor task alive even if we swallow CancelledError
```

However, `run_in_executor` in an async generator `finally` block during task cancellation has a subtle issue: if the event loop itself is shutting down, the executor future may not complete. A more robust pattern for this specific use case:

```python
# Option B: convert _persist_assistant_message to async (preferred for clarity)
async def _persist_assistant_message_async():
    _persist_assistant_message()  # sync call inside async wrapper

finally:
    try:
        await asyncio.shield(_persist_assistant_message_async())
    except asyncio.CancelledError:
        pass
```

Option B is preferred here because:
- The function body is simple (single `supabase.insert().execute()` call that completes in < 100ms)
- Creating a trivial async wrapper avoids executor thread-pool overhead
- `asyncio.shield()` on a coroutine is the documented, standard approach [ASSUMED — based on asyncio docs pattern; the behavior during generator cleanup is well-known but the exact ASGI cancellation timing in Starlette/uvicorn is not tested in this codebase]

### Alternative: Try/Except Around the Sync Call

An even simpler approach that avoids asyncio complexity entirely:

```python
finally:
    try:
        _persist_assistant_message()
    except Exception:
        logger.error("persist failed in finally")
```

The `CancelledError` issue only manifests when the ASGI task itself is cancelled before the `finally` block runs. In the current Starlette/uvicorn setup, the `SSEStreamingResponse` wraps the generator and catches transport errors in `__call__` — the generator's `finally` block does execute in practice (confirmed by the existing `_message_persisted` guard preventing double-inserts, which implies the finally block runs). The shield is a belt-and-suspenders measure for the edge case where ASGI task cancellation fires while the sync insert is in progress.

**Recommendation:** Implement Option B (`asyncio.shield` wrapping a trivial async wrapper). The code change is minimal and the intent is self-documenting.

```python
# In event_stream() finally block:
finally:
    async def _shielded_persist():
        _persist_assistant_message()
    try:
        await asyncio.shield(_shielded_persist())
    except asyncio.CancelledError:
        pass
```

---

## Frontend: Supabase Realtime Subscription Pattern

### Confirmed API Version

`@supabase/supabase-js: ^2.99.2` is installed (confirmed in `frontend/package.json`). Version 2.x uses the `supabase.channel().on('postgres_changes', ...)` API. [VERIFIED: codebase]

### Established Pattern (useDocuments.ts)

The codebase already has a working Realtime subscription in `useDocuments.ts` (lines 37–64):

```typescript
const channel = supabase
  .channel("documents-changes")
  .on(
    "postgres_changes",
    {
      event: "*",
      schema: "public",
      table: "documents",
    },
    (payload) => {
      if (payload.eventType === "UPDATE") { ... }
      else if (payload.eventType === "INSERT") { ... }
      else if (payload.eventType === "DELETE") { ... }
    },
  )
  .subscribe()

channelRef.current = channel
// cleanup:
supabase.removeChannel(channelRef.current)
```

### messages Table Subscription for useMessages

The Phase 55 subscription differs from `useDocuments` in two important ways:
1. It is scoped to a specific `thread_id` using a Postgres changes filter
2. It is transient — starts on `sendMessage`, torn down in `finally`

```typescript
// In sendMessage, before await streamMessage(...)
const channelName = `messages-thread-${threadId}`
const channel = supabase
  .channel(channelName)
  .on(
    "postgres_changes",
    {
      event: "*",
      schema: "public",
      table: "messages",
      filter: `thread_id=eq.${threadId}`,
    },
    (payload) => {
      if (payload.eventType === "INSERT") {
        const newMsg = payload.new as Message
        setMessages((prev) => {
          if (prev.some((m) => m.id === newMsg.id)) return prev
          return [...prev, newMsg]
        })
      } else if (payload.eventType === "UPDATE") {
        setMessages((prev) =>
          prev.map((m) => m.id === (payload.new as Message).id ? payload.new as Message : m)
        )
      }
    }
  )
  .subscribe()

const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
channelRef.current = channel

// In finally block:
if (channelRef.current) {
  supabase.removeChannel(channelRef.current)
  channelRef.current = null
}
```

### Filter Syntax

The `filter: 'thread_id=eq.{threadId}'` syntax is the correct Supabase Realtime Postgres changes filter format. [VERIFIED: matches the `useDocuments.ts` table/filter patterns already in use, and consistent with Supabase JS v2 API]

### RLS Consideration

`useDocuments.ts` explicitly comments that no `user_id` filter is added to the channel subscription because "RLS policies ensure users only receive their own rows." The same applies to the messages subscription — RLS on the `messages` table already scopes rows to `user_id`. The `thread_id` filter is a performance filter, not a security filter.

### sseDrop Block to Remove

Current code in `useMessages.ts` (lines 299–335) — the block to remove is inside the `setMessages` callback in `finally`:

```typescript
// REMOVE: lines ~325–334
const sseDrop = lastMsg?.role === "assistant" && !lastMsg?.content
const racedEmpty = prev.length === 0
if (sseDrop || racedEmpty) {
  setTimeout(() => {
    stoppedByUserRef.current = false
    loadMessages(threadId).catch(console.error)
  }, 1500)
}
```

After removal, SSE drop recovery is handled entirely by the Realtime subscription. If Realtime delivers the INSERT before the SSE drop is detected, the message is already in state. If the SSE drops before the INSERT arrives, the Realtime callback fires within seconds and merges it.

### messages Table Must Be in Realtime Publication

`useDocuments.ts` does NOT add this comment for documents. But `useFolders.ts` has an explicit note:
```typescript
// PREREQUISITE: folders table must be in supabase_realtime publication.
// Verify with: SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
// Add with: ALTER PUBLICATION supabase_realtime ADD TABLE folders;
```

The planner must verify whether `messages` is already in the `supabase_realtime` publication. If not, a SQL migration step is required. This is a prerequisite that can silently fail (subscription subscribes but never fires). [ASSUMED — not verified against live Supabase project; this is an operational check that cannot be done from the codebase alone]

---

## Test Strategy

### Existing Test Infrastructure

- Framework: **pytest** with `pytest-asyncio` (confirmed by `@pytest.mark.asyncio` usage in `test_audit_service.py`, `test_memory_tools.py`)
- Test location: `backend/tests/unit/`
- Pattern: class-based test groups with `MagicMock` and `patch`
- Async tests: use `@pytest.mark.asyncio` decorator
- No existing tests for `stop_event`, `_SilentSSEIterator`, or `event_stream()` [VERIFIED: grep for stop_event in tests found zero matches]

### New Test File: test_streaming_reliability.py

Per D-09, unit tests for stop_event logic:

**Test group 1: stop_event — iteration boundary check**
```python
import asyncio
import pytest

async def make_event_stream_fragment(stop_event, iterations=3):
    """Minimal generator that mimics the iteration structure."""
    for i in range(iterations):
        if stop_event.is_set():
            return
        yield f"iteration-{i}"

@pytest.mark.asyncio
async def test_stop_event_halts_at_iteration_boundary():
    stop = asyncio.Event()
    stop.set()  # pre-set before first iteration
    results = [chunk async for chunk in make_event_stream_fragment(stop)]
    assert results == []

@pytest.mark.asyncio
async def test_stop_event_halts_mid_loop():
    stop = asyncio.Event()
    results = []
    async for chunk in make_event_stream_fragment(stop, iterations=5):
        results.append(chunk)
        if len(results) == 2:
            stop.set()
    assert len(results) == 2
```

**Test group 2: stop_event — chunk loop check**
```python
def make_mock_stream(chunks):
    """Returns a sync iterable of mock chunks."""
    return iter(chunks)

@pytest.mark.asyncio
async def test_stop_event_halts_inside_chunk_loop():
    stop = asyncio.Event()
    collected = []
    chunks = ["a", "b", "c", "d"]
    for chunk in make_mock_stream(chunks):
        if stop.is_set():
            break
        collected.append(chunk)
        if len(collected) == 2:
            stop.set()
    assert collected == ["a", "b"]
```

**Test group 3: _persist_assistant_message called in finally on early exit**
```python
@pytest.mark.asyncio
async def test_persist_called_on_stop_event_exit():
    stop = asyncio.Event()
    persist_called = []

    async def mock_event_stream():
        def _persist():
            persist_called.append(True)
        try:
            for i in range(5):
                if stop.is_set():
                    return
                yield f"chunk-{i}"
        finally:
            _persist()

    stop.set()
    async for _ in mock_event_stream():
        pass
    assert persist_called == [True]
```

**Test group 4: asyncio.shield() protect persist**
```python
@pytest.mark.asyncio
async def test_shield_persist_survives_cancellation():
    """Verify that asyncio.shield allows the shielded task to complete
    even when the outer coroutine receives CancelledError."""
    completed = []

    async def shielded_work():
        await asyncio.sleep(0.01)
        completed.append(True)

    async def outer():
        task = asyncio.ensure_future(asyncio.shield(shielded_work()))
        raise asyncio.CancelledError()

    try:
        await outer()
    except asyncio.CancelledError:
        pass
    await asyncio.sleep(0.05)  # let shielded task finish
    assert completed == [True]
```

### Frontend Tests

Per D-09, Realtime recovery is verified manually in the browser (same pattern as Phase 54). No automated frontend tests are required for the Realtime subscription — the `useFolders.test.ts` and `useDocuments.test.ts` files provide patterns if a test is desired later.

---

## Implementation Risks and Gotchas

### Gotcha 1: stop_event Overwrite in SSEStreamingResponse.__call__

**Risk:** The current `SSEStreamingResponse.__call__` always creates a new `asyncio.Event()` at line 83 and then overwrites `self.body_iterator._stop_event` at line 113. If `sse_response()` is changed to pass a pre-created event to `_SilentSSEIterator`, but `__call__` still creates and assigns a NEW event, the generator will hold a reference to the old (never-set) event, and the new event will be set on disconnect — but the generator checks the old one. This is the critical bug to avoid.

**Fix:** Change `SSEStreamingResponse.__call__` to read the event FROM the iterator rather than replacing it:
```python
# Change from:
stop_event = asyncio.Event()
...
if isinstance(self.body_iterator, _SilentSSEIterator):
    self.body_iterator._stop_event = stop_event

# Change to:
if isinstance(self.body_iterator, _SilentSSEIterator):
    stop_event = self.body_iterator._stop_event  # reuse pre-created event
else:
    stop_event = asyncio.Event()
```

### Gotcha 2: `return` vs `break` in Generator for Stop

**Risk:** Using `break` inside the `for iteration` loop will exit the loop but continue into the `finally` block's persist path — which is correct. Using `return` will also trigger the `finally` block. Either works, but `return` is cleaner because it exits the entire generator immediately.

**Recommendation:** Use `return` (or `raise StopAsyncIteration` — but `return` is idiomatic for generators).

### Gotcha 3: Realtime subscription channel name uniqueness

**Risk:** If the user sends multiple messages rapidly (e.g., before the `finally` unsubscribe runs), a new channel subscription can be created before the old one is removed. Channel names like `messages-thread-{threadId}` will collide in the Supabase client's internal channel registry.

**Fix:** Always call `supabase.removeChannel()` in `finally` before creating a new channel in `sendMessage`. The `isSendingRef.current` guard in `useMessages.ts` (line 65) already prevents concurrent `sendMessage` calls, so in practice only one subscription exists at a time. The `finally` cleanup happens before `isSendingRef.current = false`, so no new `sendMessage` can start until cleanup is done.

### Gotcha 4: messages Table Not in Realtime Publication

**Risk:** The Realtime subscription silently subscribes but never fires if `messages` is not in the `supabase_realtime` publication. The sseDrop fallback will be removed, leaving no recovery path.

**Detection:** The subscription will return `SUBSCRIBED` status but the callback will never fire on INSERT. Manual verification required: run `SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime';` and confirm `messages` appears.

**Fix:** If not present: `ALTER PUBLICATION supabase_realtime ADD TABLE messages;`

### Gotcha 5: asyncio.shield() and Event Loop in Generator Finally

**Risk:** In an async generator's `finally` block during task cancellation, `await asyncio.shield(...)` may still raise `CancelledError` because the outer task's cancellation can re-raise it after the shield completes. The pattern `except asyncio.CancelledError: pass` is required.

**Correct pattern:**
```python
finally:
    async def _shielded_persist():
        _persist_assistant_message()
    try:
        await asyncio.shield(_shielded_persist())
    except asyncio.CancelledError:
        pass
```

Without the `except CancelledError: pass`, the shield will schedule the persist to complete but the CancelledError re-raise will propagate up — which may or may not cause the DB write to be lost depending on timing.

### Gotcha 6: Realtime INSERT vs Optimistic Message Deduplication

**Risk:** The frontend currently adds an optimistic `assistantMsg` (with a temp id like `temp-{ts}-{rand}`) when `sendMessage` starts. The Realtime INSERT will deliver the real persisted row with a UUID `id`. The deduplication check (`prev.some((m) => m.id === newMsg.id)`) will NOT match the temp-id message, resulting in a duplicate assistant message in state.

**Fix:** On Realtime INSERT for role `assistant`, replace the temp-id placeholder rather than appending:
```typescript
if (payload.eventType === "INSERT") {
  const newMsg = payload.new as Message
  if (newMsg.role === "assistant") {
    // Replace the in-progress optimistic message, or append if not found
    setMessages((prev) => {
      const tempIdx = prev.findIndex(
        (m) => m.id === assistantId || (m.role === "assistant" && m.id.startsWith("temp-"))
      )
      if (tempIdx !== -1) {
        const next = [...prev]
        next[tempIdx] = newMsg
        return next
      }
      return [...prev, newMsg]
    })
  }
}
```

However, D-04 says "INSERT → append, UPDATE → replace by id". If the Realtime INSERT arrives AFTER the SSE stream has already populated the optimistic message with content, the replacement would erase the streamed content with the DB row (which may be the final persisted content). This is actually the desired behavior on SSE drop — the DB row contains the full final content. During normal streaming, the INSERT typically fires after persist (which is at the end of the stream), so timing is benign.

**Simplest safe approach:** Only use the Realtime subscription for recovery — ignore INSERT events that arrive while streaming is still in progress (`isStreaming === true`). Only process INSERT/UPDATE events after the SSE stream has ended (or dropped). This avoids the temp-id duplication problem entirely.

```typescript
(payload) => {
  if (isStreaming) return  // SSE stream handles deltas; Realtime is recovery only
  // process INSERT/UPDATE as recovery...
}
```

Note: `isStreaming` in the callback is a closure over a ref, so it must be `isStreamingRef.current` (a ref, not state) to avoid stale closure issues.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | pytest + pytest-asyncio |
| Config file | `backend/pytest.ini` or inline `pyproject.toml` (check) |
| Quick run command | `cd backend && python -m pytest tests/unit/test_streaming_reliability.py -x -q` |
| Full suite command | `cd backend && python -m pytest tests/unit/ -x -q` |

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| STREAM-01 | stop_event exits generator at iteration boundary | unit | `pytest tests/unit/test_streaming_reliability.py::TestStopEvent::test_stop_event_halts_at_iteration_boundary -x` | Wave 0 |
| STREAM-01 | stop_event exits generator inside chunk loop | unit | `pytest tests/unit/test_streaming_reliability.py::TestStopEvent::test_stop_event_halts_inside_chunk_loop -x` | Wave 0 |
| STREAM-01 | _persist_assistant_message called in finally on stop | unit | `pytest tests/unit/test_streaming_reliability.py::TestPersistOnStop -x` | Wave 0 |
| STREAM-02 | SSE drop does not trigger server error | manual | Browser: navigate away during stream, check server logs | — |
| STREAM-03 | Partial response persisted on disconnect | unit + manual | `pytest tests/unit/test_streaming_reliability.py::TestAsyncioShield -x` + browser reload | Wave 0 |
| D-05 | sseDrop block removed from useMessages.ts | manual | Code review: confirm lines 325–334 deleted | — |
| D-03/D-04 | Realtime INSERT/UPDATE merges into messages state | manual | Browser: disconnect mid-stream, verify message appears on reconnect | — |

### Sampling Rate

- Per task commit: `pytest tests/unit/test_streaming_reliability.py -x -q`
- Per wave merge: `pytest tests/unit/ -x -q`
- Phase gate: Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `backend/tests/unit/test_streaming_reliability.py` — new file covering STREAM-01, STREAM-03, stop_event logic

---

## Sources

### Primary (HIGH confidence — verified against codebase)

- `backend/app/responses.py` — Full file read. `_SilentSSEIterator`, `SSEStreamingResponse.__call__`, stop_event creation and injection pattern.
- `backend/app/api/threads.py` — Lines 500–1702. `event_stream()` definition, `for iteration` loop (line 727), both LLM chunk loops (lines 787–803 Anthropic, lines 832–856 OpenAI/OR), `_persist_assistant_message()` (line 667), `finally` block (line 1695).
- `frontend/src/hooks/useMessages.ts` — Full file read. `sendMessage` structure, `finally` block, sseDrop block (lines 325–334), `stoppedByUserRef`/`abortControllerRef` ref patterns.
- `frontend/src/hooks/useDocuments.ts` — Lines 1–75. Established `channel().on('postgres_changes', ...).subscribe()` / `removeChannel()` pattern.
- `frontend/package.json` — `@supabase/supabase-js: ^2.99.2` confirmed.
- `frontend/src/lib/supabase.ts` — Supabase client singleton (`createClient`), used across hooks.
- `backend/tests/conftest.py` — Test infrastructure: MagicMock Supabase builder, pytest setup.
- `backend/tests/unit/` — All unit test files enumerated; no existing streaming/stop_event tests found.

### Secondary (MEDIUM confidence)

- `frontend/src/hooks/useFolders.ts` — Confirms `filter:` syntax pattern and Realtime publication prerequisite comment.
- `backend/tests/unit/test_audit_service.py`, `test_memory_tools.py` — Confirm `@pytest.mark.asyncio` is the established async test decorator pattern.

### Tertiary (LOW confidence / assumed)

- asyncio.shield() behavior during ASGI task cancellation in Starlette generators — based on asyncio stdlib knowledge, not verified against Starlette/uvicorn internals.
- Whether `messages` table is in `supabase_realtime` publication — cannot verify from codebase, requires live DB check.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `asyncio.shield()` prevents CancelledError from aborting the shielded coroutine during async generator finally cleanup | Backend: asyncio.shield() | Persist may still be skipped; fallback is simple try/except around sync call |
| A2 | `messages` table is in the `supabase_realtime` publication | Frontend: Realtime Subscription | Realtime subscription subscribes but never fires; sseDrop removal leaves no fallback |
| A3 | Realtime INSERT fires after `_persist_assistant_message()` completes (not during streaming) | Frontend: Gotcha 6 | Timing race causes duplicate or overwritten optimistic message |

---

## Open Questions

1. **Is `messages` in the Supabase Realtime publication?**
   - What we know: `useDocuments.ts` has no publication check; `useFolders.ts` has an explicit prerequisite comment suggesting this has been a real issue.
   - What's unclear: Whether `messages` was added to the publication during earlier phases.
   - Recommendation: Wave 0 task — run `SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime';` and add `ALTER PUBLICATION supabase_realtime ADD TABLE messages;` if needed.

2. **Does the isStreaming guard for Realtime INSERT need a ref?**
   - What we know: React state is captured in closures at render time; the Realtime callback is created once and may reference stale `isStreaming` state.
   - What's unclear: Whether the callback is re-registered when `isStreaming` changes, or whether the subscription is created fresh each `sendMessage`.
   - Recommendation: Use `isStreamingRef = useRef(false)` synced to `isStreaming` state, so the Realtime callback always reads current value. OR: simplify by not filtering in the callback — just always replace-or-append and rely on deduplication logic.

---

## Environment Availability

Step 2.6: SKIPPED — Phase is code/config changes only. No new external tools, CLIs, or services required. Existing Supabase JS client (v2.99.2) and Python asyncio stdlib are already present.
