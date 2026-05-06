# Phase 067: Frontend Streaming-UX Fix — Pattern Map

**Mapped:** 2026-05-07
**Files analyzed:** 8 (6 modified, 2 read-only references that anchor patterns)
**Analogs found:** 8 / 8 (every diff target has an in-codebase analog inside the same file or a sibling)

> Phase 067 is a polish pass on infrastructure that already exists. Every "should I copy from X?" question has an answer in the same file or a sibling under `frontend/src/hooks/`, `frontend/src/components/chat/`, `backend/app/api/`. There are NO greenfield surfaces in this phase.

## File Classification

| File | Status | Role | Data Flow | Closest Analog | Match Quality |
|------|--------|------|-----------|----------------|---------------|
| `frontend/src/hooks/useMessages.ts` | MODIFIED | hook (state-machine) | event-driven (SSE deltas → reducer) | Self — Phase 063.1 D-063.1-08/11 patterns at lines 544-549 / 779-784 / 700-704 | EXACT (extend existing pattern) |
| `frontend/src/components/chat/ChatArea.tsx` | READ ONLY | component (trigger source) | event-driven (DOM events → reconcile) | Self — D-063.1-07 thread-switch effect at 79-127, listener effect at 158-188 | N/A (no diff expected) |
| `frontend/src/components/chat/MessageItem.tsx` | MODIFIED | component (render) | request-response (props → JSX) | Self — banner switch at 130-145, dual banner at 159-166 | EXACT (delete one branch) |
| `frontend/src/components/chat/ToolCallPanel.tsx` | MODIFIED | component (render) | request-response (props → JSX) | Self — inter-tool separator at 640/656; gradient palette at 473/705; skill-row pattern at 506-525 | EXACT (extend existing render loop) |
| `frontend/src/lib/api.ts` | MODIFIED (1 line) | client (SSE parser) | streaming (chunked → callbacks) | Self — `iteration_start` branch at 394-395 | EXACT |
| `frontend/src/types/index.ts` | MODIFIED (1 field) | model | data-shape | Self — Message.iterationCount field at 81-82 | EXACT |
| `backend/app/api/runs.py` | MODIFIED | service (SSE generator) | streaming (Redis xread → SSE) | Self — Phase 1 xread try/except at 104-117 (replay phase) and existing 168-174 (tail phase); cooperative cancel pattern at `threads.py:2285-2293, 2374-2375` | role-match (extend) |
| `backend/.env` | MODIFIED (1-line delete) | config | static | None needed — Pydantic `extra="ignore"` at `app/config.py:245` makes deletion safe | N/A |
| `backend/.env.example` | MODIFIED (cosmetic) | config | static | Same as above | N/A |

---

## Pattern Assignments

### `frontend/src/hooks/useMessages.ts` (hook, event-driven)

**Analog:** SELF — Phase 063.1 D-063.1-08 thread-match gate; Phase 063.1 D-063.1-11 in-flight bool lock; Phase 063 BL-03 cleanup-belongs-to-onTerminal.

#### Pattern A — `guardedSetMessages` thread-match gate (Phase 063.1 D-063.1-08) — VERBATIM, copy verbatim

**sendMessage flavor (useMessages.ts:544-549):**
```typescript
const guardedSetMessages: typeof setMessages = ((
  update: Parameters<typeof setMessages>[0],
) => {
  if (streamingThreadIdRef.current !== activeThreadIdRef.current) return
  setMessages(update)
}) as typeof setMessages
```

Gate semantics: the originalsendMessage was for THIS thread (set at line 458, cleared in finally at 618), but the user has navigated away.

**reconcile flavor (useMessages.ts:779-784):**
```typescript
const guardedSetMessages: typeof setMessages = ((
  update: Parameters<typeof setMessages>[0],
) => {
  if (activeThreadIdRef.current !== threadId) return
  setMessages(update)
}) as typeof setMessages
```

Gate semantics: the reconcile was for THIS threadId (closure variable), but `activeThreadIdRef` has moved on.

**The D-067-02 extension target — UNGUARDED `setMessages` for terminal flip:**

`useMessages.ts:560-589` (sendMessage `originalOnTerminal` override) uses **plain** `setMessages` at line 568, NOT `guardedSetMessages`. Same pattern in `reconcile` at lines 795-826 (line 807 uses plain `setMessages`).

**The proposed extension** (RESEARCH "Setting up the terminal-flip guard" + Code Examples block):

```typescript
// Source: useMessages.ts:560-589 (current sendMessage) — recommended modification
const originalOnTerminal = callbacks.onTerminal
callbacks.onTerminal = (kind, errorPayload) => {
  // D-067-02: terminal-flip guard. Allows the runStatus mutation IFF the
  // placeholder identified by `assistantId` still exists in current state.
  // If a thread switch + reconcile collapsed the buffer in between deltas
  // and terminal, writing runStatus to a stale id is a no-op; the next
  // reconcile will pick up the correct DB-row runStatus via Phase 063.1
  // D-063.1-13/15 LEFT JOIN.
  setMessages((prev) => {
    if (!prev.some((m) => m.id === assistantId)) return prev
    return prev.map((m) => {
      if (m.id !== assistantId) return m
      if (kind === "done") return { ...m, runStatus: "completed" }
      if (kind === "error") return { ...m, runStatus: "failed" }
      if (kind === "timed_out") return { ...m, runStatus: "timed_out", stopped: true }
      // kind === "cancelled"
      return { ...m, runStatus: "cancelled", stopped: true }
    })
  })
  // BL-03 — subscriptionsRef cleanup belongs HERE, not in finally
  if (registeredRunId) subscriptionsRef.current.delete(registeredRunId)
  // Pitfall 8 — TTL-expired buffer fallback to loadMessages
  if (errorPayload === "buffer_expired") {
    loadMessages(threadId).catch(console.error)
  }
  originalOnTerminal(kind, errorPayload)
}
```

This is the **chosen pattern over** "extend `guardedSetMessages` to gate on `activeThreadIdRef` strictly" because the run actually ended and the placeholder needs the correct `runStatus` regardless of viewing thread (matches existing comment block at lines 539-543). The existence-check satisfies the "no concurrent unguarded `setMessages` writes" invariant of D-067-01 without breaking refresh-recovery.

#### Pattern B — `reconcileInFlightRef` boolean lock (Phase 063.1 D-063.1-11) — VERBATIM, do not modify

**Source:** declared `useMessages.ts:323`; top-of-reconcile guard at lines 700-701; `finally` reset at lines 868-875.

```typescript
// Top of reconcile body (line 700-701)
if (reconcileInFlightRef.current) return
reconcileInFlightRef.current = true
try {
  // ... reconcile body — UNCHANGED ...
} finally {
  // ALWAYS reset, even on exception (line 874)
  reconcileInFlightRef.current = false
}
```

Phase 067 implication: D-067-01's "single state machine" cleanup MUST preserve the set-before-await + finally-reset pattern verbatim. NEVER use a Promise-based mutex (StrictMode re-entrancy) and NEVER use a debounce (D-063.1 deferred ideas explicitly rejects).

#### Pattern C — BL-03 cleanup-belongs-to-onTerminal (Phase 063 + 063.1)

**Source:** `useMessages.ts:582` (sendMessage cleanup) and `:821` (reconcile cleanup) — both DELETE inside the `originalOnTerminal` override:

```typescript
// useMessages.ts:582 — sendMessage's onTerminal cleanup
if (registeredRunId) subscriptionsRef.current.delete(registeredRunId)
```

```typescript
// useMessages.ts:821 — reconcile's onTerminal cleanup
subscriptionsRef.current.delete(run.run_id)
```

The `.finally(() => { ... })` at lines 853-866 is a SAFETY NET only (catches AbortError + thrown network errors), NOT primary cleanup. **D-067-02's tighten MUST preserve this ordering** — subscription delete runs BEFORE `originalOnTerminal(kind, errorPayload)` is invoked.

#### Pattern D — `temp-${run_id}` deterministic placeholder (Phase 063.1 D-063.1-12)

**Source:** `useMessages.ts:727-749` (reconcile path) + Phase 063.1 D-063.1-04 runId-match dedup at `useMessages.ts:726`:

```typescript
const existingByRunId = messagesRef.current.find((m) => m.runId === run.run_id)
const targetId = existingByRunId?.id ?? `temp-${run.run_id}`

if (!existingByRunId) {
  const placeholder: Message = {
    id: targetId,
    thread_id: threadId,
    user_id: "",
    role: "assistant",
    content: "",
    created_at: run.started_at,
    updated_at: run.started_at,
    tool_calls: [],
    runId: run.run_id,
    runStatus: "streaming",
  }
  setMessages((prev) => {
    if (prev.some((m) => m.id === targetId)) return prev
    return [...prev, placeholder]
  })
}
```

**MERGE-preserve filter** in `loadMessages` at lines 426-439 (Phase 063.1 D-063.1-12): preserves live `temp-` placeholders when `loadMessages` returns DB rows that haven't yet caught up to the live run.

D-067-01 cleanup MUST preserve both shapes:
- sendMessage's `makeTempId()` placeholder → POST returns run_id → stamp run_id via setMessages map at `useMessages.ts:514-520`
- reconcile's `temp-${run.run_id}` deterministic placeholder

---

### `frontend/src/components/chat/MessageItem.tsx` (component, request-response)

**Analog:** SELF — banner switch at lines 130-145; dual banner at lines 159-166.

**Current banner switch (lines 134-141):**
```tsx
<span className="italic">
  {isStreaming
    ? (allToolsDone ? "Synthesizing answer" : "Working")
    : message.runStatus === "timed_out"
      ? "Agent reached time limit"   /* Phase 066 D-066-10 */
      : message.runStatus === "cancelled" || message.stopped
        ? "Response stopped"          /* user clicked Stop */
        : "Saving response…"}        /* ← D-067-02 DELETE */
</span>
```

**D-067-02 modification (RESEARCH Code Examples):**
```tsx
<span className="italic">
  {isStreaming
    ? (allToolsDone ? "Synthesizing answer" : "Working")
    : message.runStatus === "timed_out"
      ? "Agent reached time limit"
      : message.runStatus === "cancelled" || message.stopped
        ? "Response stopped"
        : null}   /* No fallback — terminal states only carry text */
</span>
```

**Pitfall 3 audit gate** (RESEARCH lines 452-460): grep `"Saving response"` across `frontend/src/` MUST return 0 matches after the edit. The dual banner at lines 159-166 ALREADY correctly handles `timed_out` and `cancelled`/`stopped` — DO NOT touch it.

**Open question for plan-phase** (RESEARCH Open Question 2): `null` may leave an orphaned bouncing-dots `<span>` at lines 142-148. Plan-phase verifies via Chrome MCP that the parent `<span>` short-circuits when no banner text is selected.

---

### `frontend/src/components/chat/ToolCallPanel.tsx` (component, request-response)

**Analog:** SELF — inter-tool separator at lines 640/656 (`h-px bg-border/20`); gradient palette at line 473 (`from-primary to-violet-500`) and 705 (`from-primary/30 to-primary/10`); skill-row interleave pattern at lines 584-587, 636-643.

#### Pattern E — Inter-item divider in flat array (existing — extend)

**Source:** `ToolCallPanel.tsx:636-657` — the existing render loop already injects a divider `i > 0` between consecutive items:

```tsx
{displayItems.map((item, i) => {
  if (item.kind === 'skill') {
    return (
      <div key={`skill-${i}-${item.activation.occurredAt}`}>
        {i > 0 && <div className="h-px bg-border/20 -mt-1 mb-2.5 mx-1" />}
        <SkillRow activation={item.activation} />
      </div>
    )
  }
  const tc = item.tc
  // ... tool-call render body ...
  return (
    <div key={i} className="pt-2.5 animate-toolSlideIn" style={{ animationDelay: `${i * 80}ms` }}>
      {/* Connecting line between tools */}
      {i > 0 && (
        <div className="h-px bg-border/20 -mt-1 mb-2.5 mx-1" />
      )}
      {/* ...tool body... */}
    </div>
  )
})}
```

**D-067-03 extension target — divider injection point.** A "Step N" divider replaces (or augments) the existing `i > 0` separator when the iteration changed between consecutive items. Pitfall 4 (RESEARCH lines 462-470) says: render divider ONLY when `i > 0 && tool_calls[i].iteration !== tool_calls[i-1].iteration` — never above the first iteration.

#### Pattern F — Existing gradient palette (Aether Intelligence tokens already in use)

**Source:** `ToolCallPanel.tsx:473` (sub-agent left accent — best match for gradient direction):
```tsx
<div className="absolute left-0 top-0 bottom-0 w-0.5 bg-gradient-to-b from-primary to-violet-500" />
```

**Source:** `ToolCallPanel.tsx:705` (preparing-tool indicator bar — best match for gradient palette):
```tsx
<div className="mt-1.5 h-0.5 rounded-full bg-gradient-to-r from-primary/30 to-primary/10 animate-pulse" />
```

**Existing inter-tool separator (`h-px bg-border/20`):**
```tsx
<div className="h-px bg-border/20 -mt-1 mb-2.5 mx-1" />
```

**Recommended Step N divider composition** (Claude's discretion per CONTEXT.md):
```tsx
{i > 0 && tc.iteration !== prevTc.iteration && tc.iteration !== undefined && (
  <div className="flex items-center gap-2 my-3 mx-1">
    <div className="flex-1 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
    <span className="text-[10px] font-semibold text-muted-foreground/70 tracking-wider uppercase">
      Step {tc.iteration + 1}
    </span>
    <div className="flex-1 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
  </div>
)}
```

This matches the user's mockup `──── Step 2 ──────────` and reuses existing `from-primary` token + `text-muted-foreground` from line 614.

#### Pattern G — Existing `iterationCount` consumer (header-only — KEEP)

**Source:** `ToolCallPanel.tsx:529, 542-544, 565, 568, 571, 574`:
```tsx
export function ToolCallPanel({ toolCalls, subAgent, isPlanning, iterationCount, activatedSkills }: Props) {
  // ...
  const stepPrefix = (iterationCount != null && iterationCount >= 0)
    ? `Step ${iterationCount + 1}`
    : null
  // ... used inside headerLabel construction (line 565, 568, 571, 574) ...
}
```

D-067-03 does NOT replace this; it ADDS per-iteration dividers inside the body using a NEW `iteration?: number` field on `ToolCall` (vs. the existing `iterationCount` on `Message`).

---

### `frontend/src/types/index.ts` (model, data-shape)

**Analog:** SELF — existing optional fields at lines 33-43 follow `field?: type` pattern.

**Current ToolCall (lines 28-43):**
```typescript
export interface ToolCall {
  name: string
  id?: string
  args: Record<string, string>
  status: "running" | "done" | "interrupted" | "preparing"
  result?: string
  sub_agent?: SubAgentState
  startedAt?: number
  endedAt?: number
  outputLines?: OutputLine[]
  outputFiles?: OutputFile[]
  executionDurationMs?: number
  exitCode?: number
  errorMessage?: string
}
```

**D-067-03 addition (RESEARCH Code Examples):**
```typescript
/** D-067-03: 0-based iteration index from iteration_start SSE event. Used by
 * ToolCallPanel to render "Step N" gradient dividers between iteration groups.
 * Undefined for tool calls loaded from DB (historical messages — no divider). */
iteration?: number
```

Pitfall 5 (RESEARCH lines 472-480): persisted ToolCall objects loaded via `getMessages` have NO iteration field. Render dividers ONLY when `iteration` is defined AND consecutive tool calls have different defined values.

---

### `frontend/src/lib/api.ts` (client, streaming)

**Analog:** SELF — existing `iteration_start` callback wiring at line 394-395.

**Current parser (lines 394-395):**
```typescript
} else if (t === "iteration_start" && callbacks.onIterationStart) {
  callbacks.onIterationStart(parsed.iteration as number)
}
```

This already fires per `iteration_start` SSE event. **D-067-03 stamping target:** when the per-message-id callbacks in `useMessages.ts` track the current iteration via `onIterationStart` (already at line 274), the stamping happens inside `onToolPreparing` (lines 73+) and `onToolStart` by reading the most recent iteration from a closure-tracked counter. No change to `api.ts` required IF the stamping is done frontend-side; if planner chooses backend stamping, this is the wire point.

---

### `backend/app/api/runs.py` (service, streaming)

**Analog A:** SELF — existing `try/except RedisError` at lines 104-117 (replay phase) and 168-174 (tail phase).
**Analog B:** `backend/app/api/threads.py:2285-2293` and `:2374-2375` — existing `except asyncio.CancelledError: raise` cooperative cancellation pattern.

#### Pattern H — Existing redis xread try/except (current)

**Source:** `runs.py:162-174` (Phase 2 live-tail xread):
```python
try:
    result = await redis.xread(
        streams={stream_key: last_id},
        count=100,
        block=5000,
    )
except RedisError:
    logger.exception(
        "replay_tail_consumer xread (tail phase) raised RedisError for run %s",
        run_id,
    )
    yield {"data": json.dumps({"type": "error", "error": "redis_error"})}
    return
```

**Source:** `runs.py:183-196` (post-BLOCK exists probe):
```python
try:
    if not await redis.exists(stream_key):
        yield {"data": json.dumps({
            "type": "error",
            "error": "buffer_expired_during_tail",
        })}
        return
except (RedisError, OSError):
    logger.exception(
        "replay_tail_consumer post-BLOCK exists probe failed for run %s",
        run_id,
    )
```

#### Pattern I — Cooperative cancellation analog (RE-USE shape)

**Source:** `backend/app/api/threads.py:2285-2293` (cancellation handler in producer loop):
```python
except asyncio.CancelledError:
    # D-066-05 UNCHANGED: cancellation comes from app lifespan shutdown
    # OR DELETE /runs/{id} (cancel verb). The DELETE handler writes its
    # own error string ('cancelled_by_user') in runs.py:423; this branch
    # leaves _terminal_error = None and lets the finalizer write NULL,
    # which is the legacy contract for in-process producer cancellation.
    _terminal_status = "cancelled"
    _terminal_error = None
    raise   # MUST re-raise so timeout context + asyncio task state stay correct (Pitfall 3)
```

**Source:** `backend/app/api/threads.py:2374-2375`:
```python
except asyncio.CancelledError:
    raise   # propagate; lifespan-cancel path
```

**Phase 059 D-059-04 invariant:** never swallow `CancelledError` — re-raise so timeout context + asyncio task state stay correct.

#### Pattern J — D-067-04 modification (RESEARCH Code Examples lines 580-624)

**Module top (after line 48):**
```python
from redis.exceptions import RedisError, TimeoutError as RedisTimeoutError
```

> **Variable-shadowing trap (Pitfall 2 / RESEARCH lines 442-450):** the route handler `stream_run` at `runs.py:267` declares `redis: aioredis.Redis = Depends(get_redis)`, shadowing the `redis` module name. Writing `redis.exceptions.TimeoutError` inside the route would AttributeError. The module-level alias import is the only safe approach. Module docstring at lines 24-30 explicitly warns about this.

**Inside `replay_tail_consumer` Phase 2 (replaces current 162-174):**
```python
try:
    result = await redis.xread(
        streams={stream_key: last_id},
        count=100,
        block=5000,
    )
except asyncio.CancelledError:
    # D-067-04: cooperative cancellation — never swallow (Phase 059 D-059-04).
    # Client disconnected; close cleanly with INFO log, no stack trace.
    logger.info(
        "replay_tail_consumer xread (tail phase) cancelled by client disconnect for run %s",
        run_id,
    )
    raise
except RedisTimeoutError:
    # D-067-04: socket-read deadline elapsed — cancellation-equivalent at this
    # site (the only thing it means here is the consumer's blocking xread was
    # interrupted while no client was actively listening).
    logger.info(
        "replay_tail_consumer xread (tail phase) socket timeout for run %s "
        "(client likely disconnected)",
        run_id,
    )
    yield {"data": json.dumps({"type": "error", "error": "redis_timeout"})}
    return
except RedisError:
    # Genuine RedisError (connection reset, OOM, cluster failover, etc.) —
    # keep full traceback for diagnostics.
    logger.exception(
        "replay_tail_consumer xread (tail phase) raised RedisError for run %s",
        run_id,
    )
    yield {"data": json.dumps({"type": "error", "error": "redis_error"})}
    return
```

**Open question (RESEARCH Open Question 4):** plan-phase decides whether to extend the same pattern to the Phase 1 replay xread at `runs.py:104-117` and the post-BLOCK exists probe at `runs.py:183-196`. RESEARCH recommends YES — extend to all three for symmetric defense.

---

### `backend/.env` (config, static)

**Analog:** None needed — Pydantic `extra="ignore"` at `app/config.py:245` makes the deletion safe.

#### Pattern K — Pydantic `extra="ignore"` env handling (CONFIRMED safe)

**Source:** `backend/app/config.py:245`:
```python
class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")
```

**Existing dead-code documentation:** `backend/app/config.py:366-371`:
```python
# budgets live on MODEL_CAPABILITIES.llm_call_timeout_seconds +
# LLM_CALL_TIMEOUT_OVERRIDES env (resolved via get_per_call_timeout()).
# The legacy `RUN_HARD_TIMEOUT_SECONDS` env-var symbol is silently
# parsed-and-ignored (Pydantic Settings `extra="ignore"` at line 129) so
# legacy deploys with the env set don't error at startup, but the value
# has no effect.
```

**D-067-06 deletion** (RESEARCH lines 482-490): one-line delete of `RUN_HARD_TIMEOUT_SECONDS=600` from `backend/.env`. Pitfall 6: plan-phase verifies the `extra="ignore"` line is still present AFTER the deletion (passive concern — D-067-06 only deletes the env var reference, not the Pydantic config).

`backend/.env.example` is asserted ABSENT of the var (RESEARCH assumption A3) — plan-phase verifies via grep, deletes if present.

---

## Shared Patterns

### No-side-effects-in-setMessages-updaters (Phase 057 deferral §1, Phase 060 D-060-11)

**Apply to:** EVERY useMessages.ts edit in this phase.

React Strict Mode double-invokes updaters; bail-out optimizations can skip them. The terminal-flip override at `useMessages.ts:568-577` is a PURE state update with no side effects (good); the subscription cleanup at line 582 is OUTSIDE the setMessages call (good); the `buffer_expired` fallback at lines 585-586 is a `loadMessages(threadId).catch(...)` call OUTSIDE the setMessages but BEFORE `originalOnTerminal` — also good.

**D-067-02 acceptance criterion:** the new existence-check `setMessages((prev) => prev.some(...) ? prev : prev.map(...))` is a PURE state update; no console.error, no fetch, no ref mutation inside the updater body.

### For-loop body byte-identical preservation (Phase 063.1 plan 04 SUMMARY)

**Apply to:** any structural rewrap of `useMessages.ts` reconcile body (lines 713-867).

D-067-01 acceptance criterion (mirrored from Phase 063.1 plan 04 #5): "for-loop body in reconcile is byte-identical to current state; only structural wrapping changed." Warning sign: diff for `useMessages.ts` exceeds ~100 lines on the reconcile function alone — that means re-indentation drift.

### Live-tooling verification (D-067-07 phase-wide)

**Apply to:** every plan's `<verify>` block in this phase.

| Tool | Gate For |
|------|----------|
| Chrome MCP | Every visible UI change (placeholder render, real-time delta painting, "Step N" dividers, terminal banner correctness, Resume button visibility, no "Saving response…" thrash) |
| Supabase CLI / MCP | Every backend lifecycle assertion (runs-row inspection, terminal-state correctness, no orphaned `streaming` rows) |
| LangSmith MCP | Every timeout / cancellation / error path (trace `GeneratorExit` absence, clean stream closure, expected exception column) |
| `npx tsc --noEmit -p tsconfig.json` | EVERY frontend commit (always-on gate) |
| `pytest tests/integration/test_066_*.py` | EVERY backend commit (regression baseline) |
| `npx vitest run` | OPTIONAL — newly available; supplement only when state-machine diff > 50 lines |

---

## No Analog Found

None. Every diff target has an in-codebase analog. The phase is a polish pass on existing infrastructure.

| File | Why no analog needed |
|------|----------------------|
| `backend/.env` | Pydantic `extra="ignore"` makes config-line deletion mechanically trivial; no analog beyond Pattern K. |
| `backend/.env.example` | Same. |
| `frontend/src/lib/api.ts` (1-line surface) | Existing `iteration_start` branch at line 394-395 already correctly wires `onIterationStart`; no parser change required if iteration stamping is done frontend-side per RESEARCH recommendation. |

---

## Metadata

**Analog search scope:**
- `frontend/src/hooks/useMessages.ts` (lines 1-957 — full file context)
- `frontend/src/components/chat/{ChatArea,MessageItem,ToolCallPanel}.tsx`
- `frontend/src/lib/api.ts` (lines 375-433 — SSE parser tail)
- `frontend/src/types/index.ts` (lines 20-100)
- `backend/app/api/runs.py` (lines 1-230)
- `backend/app/api/threads.py` (lines 2270-2330 — cancellation pattern reference)
- `backend/app/config.py` (lines 240-260, 360-380)

**Files scanned:** 8 (every file in CONTEXT.md `<canonical_refs>` "Existing code surfaces" + sibling analogs)

**Pattern extraction date:** 2026-05-07

**Scope decision:** Every analog lives INSIDE the same file or a sibling under `frontend/src/hooks/`, `frontend/src/components/chat/`, or `backend/app/api/`. No cross-module pattern hunting was required — Phase 067 reuses the exact infrastructure built in Phases 060→063.1→066. The planner can reference these line-anchored patterns directly in plan actions without re-discovering them.
