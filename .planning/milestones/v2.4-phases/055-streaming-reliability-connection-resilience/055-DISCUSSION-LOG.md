# Phase 55: Streaming Reliability & Connection Resilience - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-26
**Phase:** 055-streaming-reliability-connection-resilience
**Areas discussed:** Cancellation depth, Supabase Realtime wiring, Persist-on-disconnect, Test strategy

---

## Cancellation depth

| Option | Description | Selected |
|--------|-------------|----------|
| stop_event checks only | Keep sync clients; check stop_event.is_set() at iteration boundary + inside chunk loop | ✓ |
| Full async clients | Convert create_streaming_chat + stream_anthropic to AsyncOpenAI/AsyncAnthropic | |
| Full async + sub-agent | Same as above, also convert run_sub_agent() to async | |

**User's choice:** stop_event checks only

| Option | Description | Selected |
|--------|-------------|----------|
| Iteration boundary + chunk loop | Check at top of each for-iteration pass AND inside the LLM streaming chunk loop | ✓ |
| Iteration boundary only | Check only at the start of each iteration; in-flight LLM call still completes | |

**User's choice:** Iteration boundary + chunk loop

---

## Supabase Realtime wiring

| Option | Description | Selected |
|--------|-------------|----------|
| Postgres changes on messages table | Subscribe to INSERT/UPDATE on messages WHERE thread_id = current thread | ✓ |
| Broadcast channel per thread | Backend emits broadcast event on persist; frontend subscribes to that channel | |
| Keep existing 1.5s fallback only | No Realtime; rely on existing useMessages.ts sseDrop setTimeout | |

**User's choice:** Postgres changes on messages table

| Option | Description | Selected |
|--------|-------------|----------|
| Merge into messages state directly | INSERT → append, UPDATE → replace by id. No loadMessages round-trip. | ✓ |
| Trigger loadMessages reload | Call loadMessages(threadId) on any Realtime event | |

**User's choice:** Merge into messages state directly

| Option | Description | Selected |
|--------|-------------|----------|
| Replace the 1.5s fallback | Remove sseDrop setTimeout from useMessages.ts; Realtime handles all drop recovery | ✓ |
| Run alongside (belt + suspenders) | Keep 1.5s fallback AND add Realtime | |

**User's choice:** Replace the 1.5s fallback

| Option | Description | Selected |
|--------|-------------|----------|
| Inside useMessages hook, scoped to active thread | Subscribe on sendMessage start, unsubscribe in finally | ✓ |
| Global subscription in ChatArea or App | Always-on subscription for current thread | |

**User's choice:** Inside useMessages hook, scoped to active thread

---

## Persist-on-disconnect

| Option | Description | Selected |
|--------|-------------|----------|
| asyncio.shield() in finally | Wrap _persist_assistant_message() with asyncio.shield() in event_stream() finally | ✓ |
| No change needed | Existing sync Supabase call already runs to completion before GeneratorExit propagates | |

**User's choice:** asyncio.shield() in finally

| Option | Description | Selected |
|--------|-------------|----------|
| Only completed tool calls | Keep existing behavior: only status=done tool calls persisted on disconnect | ✓ |
| Write interrupted state to DB too | Persist tool calls with status=interrupted so they survive page reload | |

**User's choice:** Only completed tool calls (consistent with Phase 44 decision)

---

## Test strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Unit tests for stop_event + manual E2E | Automated unit tests for generator exit logic; manual browser verification for Realtime | ✓ |
| Unit tests only | Only test stop_event logic in isolation | |
| Full integration tests | HTTP-level disconnect simulation | |

**User's choice:** Unit tests for stop_event + manual E2E

---

## Claude's Discretion

- Exact Supabase Realtime channel/API choice (`.channel()` broadcast vs `.from().on()` Postgres changes API)
- How to thread `stop_event` into the LLM chunk loop
- Hook/channel naming for the Realtime subscription

## Deferred Ideas

- Full async client conversion (AsyncOpenAI / AsyncAnthropic) — true mid-chunk cancellation
- Async sub-agent (`run_sub_agent_async`) — complete KI-001 resolution
- Interrupted tool call persistence to DB
- Full HTTP-level integration tests for disconnect simulation
