# Phase 55: Streaming Reliability & Connection Resilience - Context

**Gathered:** 2026-04-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix three known streaming durability gaps: (1) KI-001 — in-flight LLM calls continue after SSE disconnect because stop_event only fires at yield boundaries; (2) lost responses when user navigates away mid-stream and SSE drops; (3) persist-on-disconnect not protected from CancelledError. No async client conversion, no sub-agent redesign.

</domain>

<decisions>
## Implementation Decisions

### Cancellation — KI-001 Fix
- **D-01:** Keep sync LLM clients (no AsyncOpenAI / AsyncAnthropic conversion). Fix KI-001 by passing `stop_event` into `event_stream()` and checking `stop_event.is_set()` at two points: (1) the top of each `for iteration in range(max_iterations)` pass, and (2) inside the LLM streaming chunk loop after each chunk is yielded. Stops within one chunk cycle — fast enough for UX, minimal refactor risk.
- **D-02:** `run_sub_agent()` stays sync — no async sub-agent conversion in this phase. The iteration-boundary check prevents NEW sub-agent calls after stop fires; the in-flight call still completes. Acceptable for v2.4.

### Supabase Realtime Recovery
- **D-03:** Frontend subscribes to Postgres `INSERT`/`UPDATE` changes on the `messages` table filtered to `thread_id = <current thread>`. Subscription starts when `sendMessage` begins, unsubscribes in the `finally` block of `useMessages`.
- **D-04:** On Realtime event — merge directly into messages state: `INSERT` → append, `UPDATE` → replace by `id`. No `loadMessages` round-trip needed.
- **D-05:** Remove the existing 1.5s SSE-drop fallback (`sseDrop` setTimeout block in `useMessages.ts` lines ~325–334). Realtime handles all drop recovery. No duplicate reloads.
- **D-06:** Realtime subscription lives inside the `useMessages` hook, scoped to active thread. Not a global subscription — subscribes only while a stream is in progress or just completed.

### Persist on Disconnect
- **D-07:** Wrap `_persist_assistant_message()` with `asyncio.shield()` in the `event_stream()` `finally` block to protect the DB write from `CancelledError` propagation. Persist always completes even if the outer ASGI task is cancelled.
- **D-08:** Only completed tool calls (`status=done`) are persisted on disconnect — in-flight tool calls are dropped. Consistent with Phase 44 decision; interrupted tools are frontend-only state.

### Test Strategy
- **D-09:** Unit tests for stop_event logic: verify generator exits at the correct point (iteration boundary and between chunks) when stop_event is set; verify `_persist_assistant_message()` is called in `finally` on early exit. Manual browser verification for Realtime recovery (same pattern as Phase 54).

### Claude's Discretion
- Exact hook/channel name for the Supabase Realtime subscription
- Whether to use `supabase.channel()` broadcast vs `supabase.from().on()` Postgres changes API — both produce the same user-facing result; pick whichever the existing Supabase JS client version supports cleanly
- How to thread `stop_event` into the LLM chunk loop — via closure (event already in scope) or explicit parameter

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Streaming Architecture
- `backend/app/responses.py` — `_SilentSSEIterator`, `SSEStreamingResponse`, `sse_response()`. Current stop_event wiring. The `stop_event` is set by `_safe_send` on disconnect and shared with the iterator via `body_iterator._stop_event = stop_event`.
- `backend/app/api/threads.py` — `event_stream()` async generator (line 500). `max_iterations` (lines 562, 566). `finally` block with `_persist_assistant_message()` (lines 1695–1699). Agent loop structure (`for iteration in range(max_iterations)` at line 727).

### Frontend Streaming Hook
- `frontend/src/hooks/useMessages.ts` — Full hook. `stopStreaming()` / `abortStream()` (lines 30–45). SSE-drop fallback to remove (lines ~325–334). `sendMessage` try/finally structure.

### Sub-agent (reference only — no changes)
- `backend/app/services/sub_agent_service.py` — `run_sub_agent()` is sync. No changes in this phase.

### Supabase Realtime Existing Usage
- `backend/app/api/documents.py` — Search for existing Realtime broadcast calls (`realtime` / `broadcast`) to understand current Supabase Realtime pattern in this codebase.

### Known Issue
- `.planning/KNOWN-ISSUES.md` — KI-001 full description, root cause, and recommended approach. Section: "In-flight LLM calls and tool executions continue after SSE disconnect."

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `stop_event` (`asyncio.Event`): Already created in `SSEStreamingResponse.__call__` and shared into `_SilentSSEIterator`. The event_stream generator closure can read it directly — no new plumbing needed for the backend check.
- `asyncio.shield()`: Standard library — no new dependency. Wraps `_persist_assistant_message()` call in finally.
- Supabase JS client: Already imported in `frontend/src/lib/api.ts` and used for auth. `supabase.channel()` / `.from().on()` are available in the existing `@supabase/supabase-js` version.

### Established Patterns
- Stop detection: `stoppedByUserRef.current` / `abortControllerRef.current?.abort()` in `useMessages.ts` — new Realtime subscription should follow the same ref pattern for cleanup.
- Realtime in codebase: Documents use Supabase Realtime for ingestion status updates — find that subscription and reuse the same channel/subscription pattern.
- Provider dispatch: `event_stream()` already dispatches to `stream_anthropic()` or `create_adaptive_streaming_chat()` based on `active_provider`. Both return iterables — `stop_event.is_set()` check wraps the same way for both.

### Integration Points
- `event_stream()` in `threads.py`: Add `stop_event` check at line ~727 (top of `for iteration` loop) and inside the chunk-yield loop for both OpenAI and Anthropic streaming paths.
- `useMessages.ts` `finally` block: Add `supabase.removeChannel(channel)` unsubscribe call. Remove the `sseDrop` setTimeout block (~lines 325–334).
- `_persist_assistant_message()`: Currently a sync function called from async context — `asyncio.shield(asyncio.get_event_loop().run_in_executor(None, _persist_assistant_message))` or wrapping the entire async finally call. Check whether it's already awaitable or still sync.

</code_context>

<specifics>
## Specific Ideas

- **stop_event threading**: The `stop_event` is already in scope as a closure variable inside `SSEStreamingResponse.__call__` — but `event_stream()` is defined before `SSEStreamingResponse` wraps it. The recommended approach from KNOWN-ISSUES.md is to pass it via closure or parameter. Simplest: use the `_SilentSSEIterator._stop_event` attribute that gets set at response time — `event_stream()` can reference it via a shared `asyncio.Event()` created before the generator is defined.
- **Realtime filter**: Use `filter: thread_id=eq.{threadId}` in the Postgres changes subscription so only relevant messages trigger the callback — avoid all-table broadcasts.
- **Replace not supplement**: D-05 explicitly removes the 1.5s timeout. If Realtime is unavailable (RLS issue, network blip), the user can still manually refresh. Belt-and-suspenders was explicitly rejected.

</specifics>

<deferred>
## Deferred Ideas

- **Full async client conversion** (AsyncOpenAI / AsyncAnthropic): True mid-chunk cancellation. Deferred — larger refactor, not needed when stop_event checks provide sub-second UX.
- **Async sub-agent** (`run_sub_agent_async`): Complete KI-001 resolution. Deferred — in-flight sub-agent still runs to completion, which is acceptable in v2.4.
- **Interrupted tool call persistence**: Writing `status=interrupted` tool calls to DB on disconnect. Deferred — frontend-only state is sufficient per Phase 44 decision.
- **Full integration tests** (HTTP disconnect simulation): High confidence but expensive. Deferred — unit tests + manual verification covers v2.4 bar.

</deferred>

---

*Phase: 055-streaming-reliability-connection-resilience*
*Context gathered: 2026-04-26*
