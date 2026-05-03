# Phase 063: Frontend Stream Decoupling - Research

**Researched:** 2026-05-03
**Domain:** React frontend rewire for run-backed streaming + FastAPI POST handler contract change
**Confidence:** HIGH (codebase landmarks all verified by direct read; D-063-01..04 LOCKED in CONTEXT.md; Phase 062 endpoints LIVE and tested per 062-VERIFICATION.md 20/21)

## Summary

Phase 063 wires the frontend to the run-backed streaming architecture shipped in Phases 061 (Redis Streams producer) and 062 (replay-and-tail HTTP API). The cutover is: `POST /threads/{id}/messages` returns `{message_id, run_id}` synchronously (no SSE on POST), then the frontend opens `GET /runs/{run_id}/stream?since=0` for actual tokens. On every (re)connect (mount, focus, visibilitychange, pageshow with `event.persisted`), the frontend reconciles state via `GET /threads/{id}/active-runs` and reattaches to any in-flight runs. Multi-tab sync, refresh-mid-stream, and bfcache restore fall out of this design for free because Phase 062's `replay_tail_consumer` is multi-consumer-fan-out-safe at the Redis layer.

The legacy `event_consumer` generator at `threads.py:331-426` and the `EventSourceResponse` return at `threads.py:2241-2244` get deleted entirely (D-063-01 hard cutover) — there is no dual-path window in production because Phases 061+062+063 ship as a single merge from the long-lived `v2.5-stream` feature branch (D-v2.5-11). Stop becomes server-only via `DELETE /runs/{rid}` (D-063-03); cross-tab Stop falls out for free because the producer's terminal `cancelled` sentinel propagates to all attached consumers via the same Redis Stream. Resume is surfaced only on `runs.status === 'failed'` (D-063-04), preserving D-v2.5-05's no-auto-retry-on-paid-LLM-calls principle.

**Primary recommendation:** Hard cutover the POST contract first (one ~50-line backend diff replacing the bottom of `send_message`), then rewrite `streamMessage` in `frontend/src/lib/api.ts` as two functions (`postMessage` returning `{message_id, run_id}` and `subscribeToRun(run_id, since, callbacks)` opening the GET stream), then add a single `useReconciliation` hook in `useMessages.ts` that fires on mount/focus/visibilitychange/pageshow and dedupes via in-flight run-id state. Do NOT introduce a new abstraction layer — this is a surgical rewrite that mirrors the existing `streamMessage` callback shape.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| User message INSERT | API/Backend | — | DB write is owned by FastAPI route; frontend cannot bypass auth/RLS [VERIFIED: existing code at threads.py:746-753] |
| `runs` row INSERT (status='streaming') + ZADD sorted-sets | API/Backend | — | Must happen BEFORE the producer task is spawned so `active-runs` query can find it; frontend cannot do this [VERIFIED: existing code at threads.py:768-807] |
| Returning `{message_id, run_id}` to caller | API/Backend | — | Synchronous JSON response replaces SSE response; pure POST handler change [LOCKED: D-063-01] |
| Producer task spawn + Redis XADD | API/Backend | — | UNCHANGED from Phase 061 — only the route's return shape changes; `agent_runner` body, `RUN_TASKS` registry, `_shielded_finalize` all stay [LOCKED: CONTEXT.md "Files that should NOT change"] |
| SSE event stream consumer | Browser/Client | — | The `replay_tail_consumer` in `runs.py` is the API surface; the browser opens `GET /runs/{rid}/stream?since=0` and parses tokens via fetch+ReadableStream (auth header support, like current code) [VERIFIED: api.ts:127-132 already uses fetch+reader, not native EventSource] |
| Reconciliation on mount/focus/visibility/pageshow | Browser/Client | — | Pure client-side concern; queries Phase 062's `active-runs` endpoint and reattaches via `GET /runs/{rid}/stream?since=0` [LOCKED: D-063-02 always since=0] |
| Stop button → `DELETE /runs/{rid}` | Browser/Client → API/Backend | — | Client fires DELETE; server cancels producer task; terminal sentinel propagates via Redis to all consumers [LOCKED: D-063-03; VERIFIED: runs.py:354-494 DELETE handler implements this idempotently] |
| Resume button visibility on `failed` runs | Browser/Client | — | Pure UI rendering decision driven by `active-runs` response status; never auto-retries [LOCKED: D-063-04] |
| Multi-tab token sync | Database/Storage (Redis) | Browser/Client | Redis Streams XREAD is non-destructive — N consumers each get the same sequence; no frontend dedupe needed [VERIFIED: 062-VERIFICATION.md T19 GREEN, test_062_multi_consumer_fanout.py] |
| Resource leak prevention on tab close / unmount | Browser/Client | — | AbortController on the GET stream subscription; Phase 062's `replay_tail_consumer.finally` is `pass` (D-061-03), so closing the consumer does NOT cancel the producer (correct semantics for navigate-away) [VERIFIED: runs.py:221-223] |
| bfcache restore handling | Browser/Client | — | `pageshow` with `event.persisted === true` ALWAYS triggers reconcile; local React state treated as untrusted [LOCKED: CONTEXT.md "bfcache Handling"] |

## User Constraints

> Pulled verbatim from `.planning/phases/063-frontend-stream-decoupling/063-CONTEXT.md`. The planner MUST honor every locked decision below — research them deeply, do not propose alternatives.

### Locked Decisions

**D-063-01: Hard cutover (POST contract change)**

Rewrite `POST /threads/{thread_id}/messages` to return `{message_id, run_id}` synchronously (HTTP 201). Delete the legacy SSE-on-POST code path (`return EventSourceResponse(event_consumer(...))` at threads.py:2241-2244 + the `event_consumer` generator function at threads.py:331-426). Frontend uses `GET /runs/{run_id}/stream` exclusively for token streaming.

Implications:
- The `event_consumer` generator at threads.py:331-426 becomes dead code → delete it
- Tests that exercise the legacy POST-streaming path either get rewritten to the new contract or deleted
- Backend integration tests under `backend/tests/integration/test_058_*`, `test_059_*`, `test_061_*` may have references to the SSE-on-POST contract — audit and update during execution

**D-063-02: Always `since=0` for reattach**

Frontend always opens `GET /runs/{run_id}/stream?since=0` on every (re)attach. No client-side offset persistence (no localStorage, no sessionStorage). The replay is full and idempotent — `setMessages` with identical content is a no-op for React reconciliation.

Implications:
- Frontend state model: assistant message content is fully derivable from the SSE stream, never partially-persisted to localStorage
- No "stream cursor" state to invalidate or migrate
- Reconnect logic is uniform across all triggers (mount, focus, visibilitychange, pageshow, bfcache)

**D-063-03: Server-only Stop semantics**

Stop button calls `DELETE /runs/{run_id}` only — no client-side `AbortController.abort()` on the SSE subscription. The server cancels the producer task; the terminal `cancelled` event propagates via Redis Stream to all attached consumers (this tab + other tabs); all SSE subscriptions close cleanly when they receive the terminal event per Phase 062's `TERMINAL_TYPES` break logic.

Implications:
- `abortStream`/`stopStreaming` Frontend functions are repurposed: instead of `AbortController.abort()` on the streamMessage fetch, they fire `fetch('/runs/{rid}', {method: 'DELETE'})` and await the terminal event
- AbortController stays for the GET stream subscription itself ONLY for genuine timeout cases (e.g., user navigates away — close the open SSE without cancelling the run)
- D-062-08..11 zombie-heal protocol on the backend handles the case where a Stop arrives after the producer already terminated (idempotent → 204)

**D-063-04: Resume button only on failed runs (no auto-retry)**

When `active-runs` returns a run with `status: 'failed'`, the frontend surfaces a Resume button on the assistant message bubble. Clicking it re-POSTs the original user message via the new `POST /threads/{tid}/messages` contract (gets a fresh `run_id`, opens a fresh stream). No automatic retry.

Implications:
- "Original user message" must be retrievable when the assistant message is rendered — already true since both are in the messages table linked by thread_id + ordering
- Resume button visible only when the corresponding `runs.status = 'failed'` (not `streaming`, `completed`, or `cancelled`)
- For `cancelled` runs (user clicked Stop), no Resume button — user can manually re-send if they want
- For long-stalled `streaming` runs (producer alive but no events for a long time), no Resume button — Phase 061 hard timeout (D-061-01) eventually transitions them to `failed` then Resume becomes available

### Claude's Discretion

CONTEXT.md does NOT enumerate Claude's-discretion bullets explicitly — but several mechanical decisions are deferred to the planner:

- Whether to extract `streamMessage` into two new functions (`postMessage` + `subscribeToRun`) or keep one orchestrator that internally awaits POST then opens GET (recommended: split — see "Pattern 1" below)
- Whether the reconciliation hook lives inside `useMessages.ts` (smaller surface, single hook) or in a separate `useStreamReconciliation.ts` (cleaner test boundary). Recommendation: keep inside `useMessages.ts` — it shares state already (`messages`, `setMessages`, `streamingThreadIdRef`) and a separate hook would force prop-drilling those refs
- Resume button placement in the message bubble — top-right of the assistant bubble (next to feedback thumbs) is the most natural shadcn affordance; the planner finalizes
- Where the `currentRunId` ref/state lives — recommended: in `useMessages.ts` alongside `streamingThreadIdRef`
- How deep into `useMessages.ts` the rewrite goes — minimum: drop AbortController for streamMessage, keep it for `loadMessages` (D-063-03 implication; D-v2.5-06 still applies for `loadMessages`)
- Test strategy split — backend integration tests for the new POST contract (mockable); browser MCP for refresh-mid-stream / multi-tab / bfcache (Phase 064 already owns the harness)

### Deferred Ideas (OUT OF SCOPE)

Per CONTEXT.md "Deferred Ideas": "None surfaced in this discussion. The phase scope is tight and the ROADMAP success criteria + risks already enumerate the relevant decisions."

Out-of-scope per the boundaries section:

- Browser MCP regression harness (Phase 064)
- Skills test infrastructure repair (Phase 065)
- `messages.confidence_*` columns being all NULL — separate behavioral bug, file scoped to a backlog item
- POST `/threads` and other non-streaming endpoints — only `/threads/{tid}/messages` changes
- Cleanup of CR-01 in `list_active_runs` (`.single()` → `.maybe_single()`) — owned by 062 follow-up or carried forward as a tiny tail-task in 063 if the planner decides; see "Common Pitfalls" §6 below

## Phase Requirements

Phase 063 closes two requirement IDs (no new IDs introduced this phase):

| ID | Description | Research Support |
|----|-------------|------------------|
| STREAM-04 (frontend layer) | Stream survives client navigation, refresh, and multi-tab access. Verified via (a) start streaming → refresh page → see continued streaming with no manual action; (b) start streaming → close tab → reopen thread in new tab → see live continuation; (c) open same thread in two tabs while streaming → both tabs render the same tokens in sync. | "Pattern 2: Reconciliation hook ordering" + "Pattern 3: bfcache restore" + "Code Examples §3" cover (a) refresh and (b) reopen; multi-consumer fan-out (T19 in 062-VERIFICATION) covers (c) two-tab. Resume button surface (D-063-04) covers the failed-run UX. |
| STREAM-02b | After tab switch mid-stream (Symptom E) or F5 mid-stream (Symptom F), the assistant message recovers without a manual second F5 — either auto-displays via reconcile fetch, or a "Resume" button appears if the backend is still mid-generation. Stop (Symptom G) does not trigger reload, and tool-result JSON does not leak into chat content (Bug 3 regression guard). | Subsumed by STREAM-04 per D-v2.5-10. The reconciliation hook (Pattern 2) + Resume button + DELETE Stop semantics each map directly. Bug 3 guard preserved by Phase 060's "drop the finally-block reload" — no change in 063 because we are not re-introducing it. |

The 5 still-pending HUMAN-UAT items from `062-VERIFICATION.md` (browser two-tab flow, DELETE cancel cross-tab, TTL-expired synthetic terminal, real Supabase RLS cross-user, Redis-down degradation) are NOT requirement IDs — they're verification items 062 deferred. Phase 063 closes (1) and (2) automatically as part of STREAM-04 verification; (3), (4), (5) remain Phase 064's harness territory.

## Standard Stack

### Core (already in the codebase — verify versions, do not change)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 18.x (verify package.json) | UI framework, hooks model | Already in use; D-v2.5-06 patterns rely on AbortController + refs |
| TypeScript | (project default) | Static typing | All hook/types changes are typed |
| Vite | (project default) | Dev server / bundler | Unchanged |
| `fetch` API + `ReadableStream` | Native browser | SSE-style streaming with custom auth headers | Already used at `api.ts:127-132`. Native `EventSource` does NOT support the `Authorization: Bearer` header [CITED: github.com/whatwg/html/issues/2177]; do not switch to it |
| sse-starlette | 2.4.1 (per Phase 059, pinned) | Backend SSE response (`EventSourceResponse`) | Phase 062's `replay_tail_consumer` already uses it with `ping=None` (D-061.1-04 H2 fix) |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| shadcn/ui Button | (already in repo) | Resume button affordance | Use existing `Button` import in `MessageItem.tsx`; match the variant used by feedback thumbs for visual symmetry |
| `lucide-react` | (already in repo, e.g. `Square`, `RotateCcw`) | Icon for Resume button | `RotateCcw` or `RefreshCw` is the typical Resume affordance; planner picks per Aether Intelligence design system |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `fetch` + ReadableStream | `EventSource` API | EventSource is simpler BUT does NOT support `Authorization` headers [CITED: MDN EventSource.withCredentials]. Would force cookie-based auth, which Supabase Auth does not use. Reject. |
| `fetch` + ReadableStream | `extended-eventsource` polyfill | Adds a dependency for ~zero benefit; current `streamMessage` reader loop is ~80 lines and already works. Reject. |
| Custom client-side cursor persistence (localStorage) | always since=0 | D-063-02 LOCKED: 152ms full replay measured in Phase 062 testing; persistence cost not justified |
| Auto-retry on `failed` runs | Resume button only | D-v2.5-05 LOCKED: paid LLM call retry must be explicit user intent |
| Client-side AbortController for Stop | Server `DELETE /runs/{rid}` | D-063-03 LOCKED: server-side cancel is the source of truth; cross-tab Stop falls out for free |

**Installation:** No new dependencies. All required libraries are already in `frontend/package.json` and `backend/requirements.txt`.

**Version verification (planner sanity-check at Wave 0):**
- `frontend/package.json` `react` version (expected ^18.x; if React 19 update is in flight, planner verifies StrictMode double-mount cleanup behavior — see Pitfall §3)
- `backend/requirements.txt` `sse-starlette==2.4.1` (Phase 059 pin) — should be unchanged; confirm before any backend edits

## Architecture Patterns

### System Architecture Diagram

```
                                 PHASE 063 — End-to-end data flow
                                 ──────────────────────────────────

  ┌──────────────────────────┐                   ┌────────────────────────────────┐
  │  ChatArea (React)        │                   │  FastAPI POST /threads/.../    │
  │                          │                   │       messages                 │
  │  user types →            │  ────POST────►    │   (rewritten in 063)           │
  │   handleSend             │                   │                                │
  │                          │  ◄──{msg_id,run_id}                                │
  │                          │       (HTTP 201)  │  Spawns producer task          │
  │  setMessages([...])      │                   │  Returns BEFORE producer       │
  │  Open GET stream         │                   │   finishes  (no SSE on POST)   │
  └────────────┬─────────────┘                   └────────────┬───────────────────┘
               │                                              │
               ▼                                              ▼
  ┌──────────────────────────┐                   ┌────────────────────────────────┐
  │  subscribeToRun(rid,     │  ────GET ────►    │  GET /runs/{rid}/stream        │
  │     since=0, callbacks)  │  /runs/{rid}/     │   ?since=0                     │
  │                          │   stream?since=0  │                                │
  │  fetch + ReadableStream  │                   │  replay_tail_consumer:         │
  │  reader loop parses      │  ◄═════SSE═══════ │   XREAD STREAMS run:{rid}      │
  │   data: {type, ...}      │   tokens, tools,  │   from `since` (replay) →      │
  │                          │   terminal event  │   BLOCK 5000 (live-tail)       │
  │  callbacks update        │                   │   break on TERMINAL_TYPES      │
  │   useMessages state      │                   └────────────┬───────────────────┘
  └────────────┬─────────────┘                                │
               │                                              ▼
               │ also (in parallel)                ┌────────────────────────┐
               │                                   │  Redis Stream          │
               │                                   │   run:{run_id}         │
               │                                   │  ────────────────      │
               │                                   │   xadd (token deltas)  │
               │                                   │   xadd (tool events)   │
               │                                   │   xadd (terminal       │
               │                                   │    sentinel: done /    │
               │                                   │    error / cancelled)  │
               │                                   └────────────┬───────────┘
               │                                                │
               │                                                ▲
               │                                                │ producer (asyncio.Task,
               │                                                │  spawned by POST handler)
               │                                                │  unaffected by 063
               │                                                │
   ╔═══════════▼════════════════════════════════════════════════════════════════╗
   ║  Reconciliation triggers (any one fires reconcile()):                      ║
   ║                                                                            ║
   ║   • mount    (component first renders for thread X)                        ║
   ║   • focus    (window regains focus)                                        ║
   ║   • visibilitychange   (document.visibilityState === 'visible')            ║
   ║   • pageshow with event.persisted === true   (bfcache restore — ALWAYS)    ║
   ║                                                                            ║
   ║  reconcile():                                                              ║
   ║   1. GET /threads/{tid}/active-runs            — Phase 062, status filter  ║
   ║   2. for each active run not currently subscribed:                         ║
   ║        synthesize placeholder assistant message (temp-id pattern)          ║
   ║        subscribeToRun(run.run_id, since=0, callbacks)                      ║
   ║   3. when terminal event arrives:                                          ║
   ║        SSE-built content stays canonical                                   ║
   ║        loadMessages(thread_id) once to reconcile any DB-only fields        ║
   ║          (e.g. confidence_*, suggestions if missed during reconnect)       ║
   ╚════════════════════════════════════════════════════════════════════════════╝

  ┌──────────────────────────┐                   ┌────────────────────────────────┐
  │  Stop button (Tab A)     │  ────DELETE────►  │  DELETE /runs/{rid}            │
  │                          │     /runs/{rid}   │   (Phase 062 — LIVE)           │
  │  no AbortController      │                   │                                │
  │   on stream fetch        │  ◄────HTTP 204    │  task.cancel() → producer      │
  │                          │                   │   CancelledError handler       │
  │                          │                   │   sets _terminal_status =      │
  │                          │                   │   'cancelled' → finalizer      │
  │                          │                   │   xadds terminal sentinel      │
  └──────────────────────────┘                   └────────────┬───────────────────┘
                                                              │
                                                              ▼
                                                  All attached consumers (Tab A, Tab B,
                                                  any other tab open on this run) read the
                                                  'cancelled' sentinel from Redis Stream,
                                                  break out of their XREAD loop, close
                                                  EventSourceResponse cleanly. Cross-tab
                                                  Stop = free side-effect.
```

### Recommended Project Structure

```
frontend/src/
├── lib/
│   └── api.ts            # Split streamMessage into postMessage + subscribeToRun
├── hooks/
│   └── useMessages.ts    # Add reconcile + currentRunId; rewrite stop semantics
└── components/chat/
    ├── ChatArea.tsx      # Add reconcile-triggering useEffect (mount, focus,
    │                     # visibilitychange, pageshow). Keep existing
    │                     # setViewingThread → abortStream → clearMessages →
    │                     # loadMessages ordering for thread-switch.
    └── MessageItem.tsx   # Conditional Resume button on assistant bubble when
                          # message.runStatus === 'failed' (new field on Message)

backend/app/api/
└── threads.py            # send_message: replace EventSourceResponse(event_consumer(...))
                          # at line 2241-2244 with `return {"message_id": <new_id>,
                          # "run_id": <run_id>}` (HTTP 201). Producer spawn unchanged.
                          # DELETE the module-level event_consumer at 331-426.
```

No new files required. No new directories.

### Pattern 1: Split `streamMessage` into `postMessage` + `subscribeToRun`

**What:** Today `streamMessage` does both POST-and-stream-from-its-response in one fetch. After 063, those are two distinct round trips with different semantics (one transactional, one long-lived stream). Splitting forces clear API boundaries and lets reconciliation reuse `subscribeToRun` for replay-on-reconnect.

**When to use:** Any path that wants to start a new generation OR attach to an existing one — these are exactly the two control paths the frontend now has.

**Example:**
```typescript
// Source: synthesized from existing streamMessage at api.ts:97-224 + Phase 062
// runs.py contract.

interface PostMessageResponse {
  message_id: string  // user message id
  run_id: string      // server-generated UUID per D-061-05
}

export async function postMessage(
  threadId: string,
  content: string,
  options: { model?: string; provider?: string; agentMode?: string }
): Promise<PostMessageResponse> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/threads/${threadId}/messages`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      content,
      model: options.model,
      provider: options.provider,
      agent_mode: options.agentMode ?? "default",
    }),
  })
  if (!res.ok) throw new Error("Failed to send message")
  return res.json() as Promise<PostMessageResponse>
}

// Callback shape mirrors current streamMessage exactly so MessageItem rendering
// is unchanged. ONLY transport changes.
export interface StreamCallbacks {
  onDelta: (text: string) => void
  onTitleUpdate?: (title: string) => void
  onToolPreparing?: (name: string, index: number) => void
  /* ... all 20+ existing callbacks from streamMessage ... */
  onTerminal: (kind: "done" | "error" | "cancelled", error?: string) => void
}

export async function subscribeToRun(
  runId: string,
  since: string = "0",  // D-063-02 always "0"; param exists for Phase 062 compat
  callbacks: StreamCallbacks,
  signal?: AbortSignal,
): Promise<void> {
  const headers = await getAuthHeaders()
  // Important: Authorization header — native EventSource cannot send custom
  // headers (https://github.com/whatwg/html/issues/2177), so we must use
  // fetch + ReadableStream like the existing streamMessage. Same parsing loop
  // verbatim.
  const url = `${API_BASE}/runs/${runId}/stream?since=${encodeURIComponent(since)}`
  const res = await fetch(url, { headers, signal })

  if (res.status === 404) {
    // Run not found / not owned. Treat as a synthetic "error" terminal so
    // callers (reconcile) can surface a generic failed state without crashing.
    callbacks.onTerminal("error", "run_not_found")
    return
  }
  if (res.status === 503) {
    // Phase 062 D-062-13: Redis unreachable. Treat as transient error; planner
    // decides whether reconcile retries on next visibility tick.
    callbacks.onTerminal("error", "streaming_unavailable")
    return
  }
  if (!res.ok || !res.body) throw new Error(`stream open failed: ${res.status}`)

  // PARSE LOOP — copied verbatim from existing streamMessage (api.ts:137-220).
  // Wire format byte-identical per ARCHITECTURE.md SSE event-types table and
  // Phase 062 D-062-05 ("Caller sees an identical wire shape regardless of
  // run state at request time").
  /* ... existing while(true) reader.read() + buffer.split('\n') logic ... */

  // Phase 062 emits TERMINAL_TYPES:
  //   "done"      → from producer's _shielded_finalize on success
  //   "error"     → on hard_timeout, LLM API failure, etc.
  //   "cancelled" → DELETE /runs/{rid} OR zombie heal
  // The current streamMessage already handles "done" + "stream_end"; add
  // "error" and "cancelled" branches that call onTerminal accordingly.
}
```

### Pattern 2: Reconciliation Hook Ordering (CONTEXT.md "Reconciliation Hook Ordering")

**What:** On thread mount/focus/visibility/bfcache, query `active-runs` IN PARALLEL with `loadMessages`, then for any active run not already subscribed, synthesize a placeholder assistant message and call `subscribeToRun(rid, "0", callbacks)`.

**When to use:** Every (re)connect path. Single helper invoked from 4 different effect/listener triggers.

**Example:**
```typescript
// Source: synthesized from CONTEXT.md "Reconciliation Hook Ordering" + 062
// active-runs response shape (run_id, started_at, status — all 'streaming')

// Lives in useMessages.ts. Stays close to existing setMessages calls so it
// can mutate placeholder content without prop-drilling.
const reconcile = useCallback(async (threadId: string) => {
  // Fire both in parallel per CONTEXT.md (active-runs MUST resolve before
  // loadMessages settles, otherwise the local message list will appear
  // missing the in-flight assistant message).
  const [activeRuns, _] = await Promise.all([
    listActiveRuns(threadId),    // GET /threads/{tid}/active-runs
    loadMessages(threadId),      // existing — sets DB-persisted messages
  ])

  for (const run of activeRuns) {
    // Skip if we're already subscribed to this run (e.g. focus event fired
    // while we already had it open). Track via a Map<run_id, AbortController>
    // in a ref.
    if (subscriptionsRef.current.has(run.run_id)) continue

    // Synthesize placeholder assistant message — temp-id pattern matches
    // sendMessage's existing optimistic placeholder so MessageItem renders
    // identically. The temp-id survives until the persisted message arrives
    // (loadMessages + Realtime upsert) at terminal time.
    const placeholderId = `temp-${run.run_id}`  // deterministic — dedupe-safe
    const placeholder: Message = {
      id: placeholderId,
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
      // Idempotent insert: if a message with id === placeholderId exists, no-op.
      // (Possible after StrictMode double-mount or rapid focus events.)
      if (prev.some((m) => m.id === placeholderId)) return prev
      return [...prev, placeholder]
    })

    // Open the stream — the same callbacks sendMessage uses, just keyed by
    // placeholderId instead of a fresh assistantId.
    const controller = new AbortController()
    subscriptionsRef.current.set(run.run_id, controller)
    subscribeToRun(run.run_id, "0", makeCallbacksFor(placeholderId), controller.signal)
      .catch((err) => {
        if (!(err instanceof Error && err.name === "AbortError")) console.error(err)
      })
      .finally(() => {
        subscriptionsRef.current.delete(run.run_id)
        // SSE-built content stays canonical; reload DB-only fields once at
        // terminal (per CONTEXT.md Reconciliation step 2c). loadMessages races
        // against Realtime upsert; either wins benignly.
        loadMessages(threadId).catch(console.error)
      })
  }
}, [/* deps */])
```

In ChatArea.tsx, the trigger wiring is:
```typescript
// Source: derived from MDN pageshow + visibilitychange best practices and
// CONTEXT.md "bfcache Handling".
useEffect(() => {
  if (!thread?.id) return
  // Mount trigger fires once; the visibility/focus/pageshow listeners cover
  // the rest.
  reconcile(thread.id).catch(console.error)

  const onVis = () => {
    if (document.visibilityState === "visible") reconcile(thread.id).catch(console.error)
  }
  const onFocus = () => reconcile(thread.id).catch(console.error)
  const onPageShow = (e: PageTransitionEvent) => {
    // CONTEXT.md mandate: bfcache restore ALWAYS reconciles, regardless of
    // local state. event.persisted === true is the canonical bfcache signal.
    if (e.persisted) reconcile(thread.id).catch(console.error)
  }

  document.addEventListener("visibilitychange", onVis)
  window.addEventListener("focus", onFocus)
  window.addEventListener("pageshow", onPageShow)

  return () => {
    document.removeEventListener("visibilitychange", onVis)
    window.removeEventListener("focus", onFocus)
    window.removeEventListener("pageshow", onPageShow)
  }
}, [thread?.id, reconcile])
```

### Pattern 3: Stop Semantics Rewrite (D-063-03)

**What:** `stopStreaming()` no longer aborts the fetch. It POSTs DELETE; the producer cancels; the terminal `cancelled` sentinel arrives via the open SSE; the parser breaks out of its loop naturally.

**When to use:** User clicks Stop button. Any mid-stream cancellation flow.

**Example:**
```typescript
// Source: synthesized from D-063-03 + Phase 062 runs.py:354-494 DELETE handler
// + existing useMessages stopStreaming at hooks/useMessages.ts:34-37

const stopStreaming = useCallback(async () => {
  const runId = currentRunIdRef.current
  if (!runId) return
  stoppedByUserRef.current = true   // existing flag — keep for "Response stopped" UI
  try {
    const headers = await getAuthHeaders()
    await fetch(`${API_BASE}/runs/${runId}`, { method: "DELETE", headers })
    // Phase 062 D-062-09 idempotent: if already terminal, returns 204 silent.
    // No need to await terminal event here — the consumer parser loop is
    // still open and will see the terminal sentinel (D-063-03 implication).
  } catch (err) {
    // Network failure on DELETE is recoverable; user can retry. Don't crash.
    console.error("Stop failed:", err)
  }
}, [])
```

### Pattern 4: Resume Button (D-063-04)

**What:** When `active-runs` returns a `failed` run on reconnect, the placeholder assistant message gets a `runStatus: 'failed'` field. `MessageItem` renders a Resume button conditional on that. Click handler calls `sendMessage` with the original user content.

**When to use:** Only when `runs.status === 'failed'`. NOT for `cancelled`, `completed`, or `streaming`.

**Example:**
```typescript
// In MessageItem.tsx — extends the existing assistant rendering branch.
// Source: synthesized from D-063-04 + existing MessageFeedback pattern at
// MessageItem.tsx:78-82 (the natural "post-message action" affordance slot).

{message.role === "assistant" && message.runStatus === "failed" && (
  <Button
    variant="ghost"
    size="sm"
    onClick={() => onResume?.(message)}
    className="mt-2 text-xs"
  >
    <RotateCcw className="w-3 h-3 mr-1.5" />
    Resume
  </Button>
)}
```

The handler in ChatArea / useMessages:
```typescript
const handleResume = useCallback((failedMsg: Message) => {
  // Find the immediately preceding user message in the same thread (the one
  // that prompted this failed assistant response).
  const idx = messages.findIndex((m) => m.id === failedMsg.id)
  const userMsg = idx > 0 ? messages[idx - 1] : null
  if (!userMsg || userMsg.role !== "user") return
  // Re-POST. Fresh run_id, fresh stream. Per D-063-04 / D-v2.5-05: explicit
  // user intent = the click; never auto-fired.
  sendMessage(failedMsg.thread_id, userMsg.content, /* same options */)
}, [messages, sendMessage])
```

### Anti-Patterns to Avoid

- **Native `EventSource` for the stream subscription:** Cannot attach `Authorization: Bearer` headers per the WHATWG html spec issue [CITED: github.com/whatwg/html/issues/2177]. The current `streamMessage` already uses `fetch` + ReadableStream — keep that pattern.
- **Persisting stream offset in localStorage:** D-063-02 explicitly forbids it. Cross-tab races on offset writes are exactly the kind of state-coordination bug Redis Streams avoids; reintroducing them in localStorage defeats the architecture.
- **Aborting the fetch on Stop:** D-063-03 forbids it. The cancellation must originate server-side so the producer task is actually killed (not just the consumer-side socket); also so all other tabs on the same run get the cancelled sentinel.
- **Auto-retry on `failed` runs:** D-063-04 + D-v2.5-05 forbid it. LLM calls cost money; never retry without explicit click.
- **Reading `event.persisted` only on `pageshow`:** Modern bfcache works; older browsers and some mobile contexts don't fire `pageshow` reliably — always pair with `visibilitychange` so non-bfcache restores also reconcile [CITED: web.dev articles bfcache].
- **Treating `loadMessages` resolution as authoritative when there's an in-flight run:** SSE-built content stays canonical (Phase 060 invariant); the loadMessages path should NOT overwrite a placeholder mid-stream. The existing `isSendingRef.current` guard at `useMessages.ts:73` already covers the send case; planner extends it to reconcile-attached runs.
- **Letting the reconcile fire concurrently with itself for the same thread_id:** A focus event landing during a visibilitychange tick can double-fire reconcile. Track in-flight reconciles in a ref (or use a `subscriptionsRef.current.has(run_id)` short-circuit per Pattern 2) so the second call no-ops the duplicate.
- **Two streaming code paths coexisting on `master`:** ROADMAP risk note + D-063-01 explicit: delete `event_consumer` and the `EventSourceResponse(event_consumer(...))` return in the same commit. No deprecation shim. Single feature branch landing per D-v2.5-11.
- **Forgetting that POST must INSERT the `runs` row BEFORE returning:** The current code already does this at `threads.py:768-807`; the rewrite must NOT move the response shape change above that block, or `active-runs` will race against the route's return and frontend will get an empty list and skip subscribing.
- **Using React's `useEffectEvent` (experimental) to escape stale closures:** Not yet stable in React 19.2 GA flow; stick to ref-based stale-closure prevention (existing `currentRunIdRef`) [CITED: react.dev React 19.2].

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SSE event parsing on the client | A new SSE parser | The existing `streamMessage` reader loop (api.ts:137-220) — reuse verbatim in `subscribeToRun` | Already handles partial chunks, `data: ` prefix, multi-event buffering. Phase 062 wire format is byte-identical to what 059 + 060 already parse |
| Multi-tab coordination of stream cursor | localStorage / BroadcastChannel / SharedWorker | Redis Streams via `replay_tail_consumer` | Phase 062 already proves multi-consumer fan-out (T19 GREEN). Two tabs both call `subscribeToRun(rid, "0")` and each gets the same sequence — no client-side coordination needed. |
| Reconnect with backoff / retry | Exponential-backoff library | Browser-native fetch retry + the four reconcile triggers | The triggers (mount, focus, visibility, pageshow) are the natural retry points. A standalone retry loop adds bandwidth burn and overlaps with the page-lifecycle events. |
| Cancel verb implementation | A custom cancellation token across tabs | Phase 062's `DELETE /runs/{rid}` (already shipped, idempotent, zombie-heals) | Server-side cancel is the source of truth; the terminal sentinel propagation handles cross-tab fan-out for free. |
| bfcache restore detection | Custom heuristic on `document.timing` | `pageshow` event with `event.persisted === true` | This is the canonical browser-provided bfcache signal [CITED: MDN pageshow_event]. |
| Authorization on EventSource | EventSource polyfill (`extended-eventsource`, `event-source-polyfill`) | `fetch` + ReadableStream (already in use) | Adding a polyfill for one fetch is overkill; the existing pattern already works and is tested against 059/061's wire format. |
| Optimistic placeholder ID generation | New scheme (e.g., correlator IDs) | Existing `temp-${Date.now()}-${Math.random()}` for sendMessage's optimistic message + new deterministic `temp-${run_id}` for reconnect placeholders | Two patterns, two purposes; both already idiomatic. Deterministic temp-id for reconnects gives idempotent React reconciliation. |
| Server-side run lifecycle table | New schema | `public.runs` from migration 035 (Phase 061) — no schema changes in 063 | Already shipped, indexed, RLS-protected. 063 adds zero migrations. |

**Key insight:** Phase 063 is the *thinnest possible* layer of new code. Every non-trivial subsystem (run-buffer, replay, cancel, multi-consumer) is already done in 061+062. The frontend's job is to call three endpoints and rerender. The biggest pitfalls are not technical complexity but *not deleting* the legacy POST-streams path (D-063-01).

## Common Pitfalls

### Pitfall 1: React StrictMode double-mount races subscriptions

**What goes wrong:** In dev (StrictMode), every `useEffect` fires twice. The reconciliation effect in ChatArea will trigger two `reconcile(threadId)` calls in quick succession. If those each open a `subscribeToRun(rid, "0")` without dedup, you'll have two consumers writing to the same placeholder via duplicate callbacks — duplicated tokens.

**Why it happens:** StrictMode intentionally exercises the cleanup path to surface missing-cleanup bugs [CITED: react.dev StrictMode]. The first effect's cleanup MUST cancel before the second effect's body runs.

**How to avoid:**
- Track in-flight subscriptions by `run_id` in a ref (`subscriptionsRef: Map<string, AbortController>`); short-circuit reconcile if `subscriptionsRef.current.has(run_id)`.
- Cleanup function returned from the `useEffect` aborts ALL controllers in the map.
- Use deterministic placeholder ids (`temp-${run_id}`) so re-running with the same run_id is idempotent at the React state level.

**Warning signs:** Tokens appear duplicated in dev but not prod (StrictMode is dev-only [CITED: react.dev StrictMode]). Console shows two simultaneous "stream opened" log entries for the same run_id.

### Pitfall 2: pageshow on bfcache restore renders stale React state

**What goes wrong:** Browser bfcaches the page (full DOM + JS state preserved). User navigates back N minutes later. React state still says "streaming Tab A's run", but the actual run has long since terminated and TTL-expired (10 min for completed; 60s for failed/cancelled per D-061-04). If we trust local state, the UI shows a permanently-spinning placeholder.

**Why it happens:** bfcache is a perf optimization that suspends the page wholesale — JS doesn't know how much wall-clock time elapsed. `event.persisted === true` on the next `pageshow` is the only signal [CITED: web.dev bfcache article].

**How to avoid:**
- Treat bfcache restore as ALWAYS-reconcile per CONTEXT.md guidance: on `pageshow` with `event.persisted === true`, fire `reconcile(thread.id)` unconditionally (even if local state looks complete).
- The reconcile call hits `active-runs`. If the run is no longer streaming (TTL-expired or terminal), the placeholder gets cleared by the parallel `loadMessages` rendering the persisted assistant message.
- For TTL-expired runs whose buffer disappeared: Phase 062's stream endpoint returns a synthetic terminal SSE event (`{type: 'done'|'error'|'cancelled', error: 'buffer_expired', runs_status: ...}`) — D-062-06 confirmed VERIFIED in 062-VERIFICATION.md T9-T11.

**Warning signs:** Long-stale chat tabs that "still show typing dots" hours after a stream completed.

### Pitfall 3: Stale `currentRunIdRef` after refocus on a different thread

**What goes wrong:** Tab A sends a message → `currentRunIdRef.current = run_A`. User switches to thread B, then back to thread A and clicks Stop. `currentRunIdRef` may carry run_B (or null) by then because thread switch reset it via Phase 060's setViewingThread teardown.

**Why it happens:** Refs are not reactive to renders; they capture the latest write. Thread switching writes to several refs (D-060 lineage); the order matters.

**How to avoid:**
- Make `currentRunIdRef` a `Map<thread_id, run_id>` (or just `Map<thread_id, Set<run_id>>` if multi-streaming-per-thread is ever in scope). Stop reads `Map.get(threadId)`. Reconcile updates per-thread.
- Alternative: derive currentRunId from message state — `messages.find(m => m.runStatus === 'streaming')?.runId`. Slightly slower but stale-closure-immune.

**Warning signs:** Stop sometimes "does nothing" after thread navigation; backend logs show DELETE for the wrong run_id (or no DELETE at all).

### Pitfall 4: Backend POST handler returns BEFORE producer's runs row INSERT settles

**What goes wrong:** The frontend opens `GET /runs/{run_id}/stream?since=0` immediately after the POST returns. If the runs row was scheduled async or never INSERTed, the stream endpoint's ownership SELECT (runs.py:275-285) returns 404. User sees an immediate "run not found" error.

**Why it happens:** Existing code at `threads.py:768-807` correctly INSERTs the runs row inside `await aexec(...)` BEFORE spawning the producer task — but the rewrite to remove `EventSourceResponse(...)` must NOT reorganize that block. The 063 rewrite is a pure response-shape change, not a control-flow change.

**How to avoid:**
- The diff in `send_message` must be: KEEP everything from `thread_resp = await aexec(...)` through the runs INSERT + ZADD + `task = asyncio.create_task(agent_runner(run_id))` + `RUN_TASKS[run_id] = task` + `task.add_done_callback(_evict)`. CHANGE only the bottom: replace `return EventSourceResponse(event_consumer(...), ping=None)` with `return JSONResponse(status_code=201, content={"message_id": <user_msg_id>, "run_id": str(run_id)})`.
- Ensure the user-message INSERT also returns the user message_id (currently the code at line 746-753 does INSERT but doesn't return — needs `.select(...)` or returning the inserted row's id).

**Warning signs:** Frontend immediately gets 404 on the GET stream. Backend logs show successful POST followed by failed GET for the same run_id within milliseconds.

### Pitfall 5: Realtime + SSE coordination on terminal — double-render or content overwrite

**What goes wrong:** When the run terminates, two paths produce the assistant message: (a) the SSE stream's accumulated `content` field on the placeholder, (b) Supabase Realtime upserts the persisted `messages` row arriving via the channel. If we naively replace the placeholder with the Realtime-arrived row, we may briefly show empty content during the swap, or worse, overwrite SSE-built content with a stale Realtime payload.

**Why it happens:** D-v2.5-03: Realtime is a hint, not source of truth. Reconcile on (re)connect is canonical. SSE-built content is also canonical mid-stream. They both write to the same React message slot.

**How to avoid:**
- Per CONTEXT.md "Code Context — Patterns to follow": "SSE-built content stays canonical; Realtime upsert just reconciles confidence_* + finalized fields."
- On terminal SSE event, don't replace the placeholder. Instead, fire a single `loadMessages(thread.id)` to fetch the persisted row's DB-only fields (confidence_*, source_refs at IDs, suggestions, etc.) and merge them into the placeholder by id (use the just-arrived persisted message id from `messages.find(m => m.id === <real_id>)`).
- Keep the placeholder's `content` as the source of truth; merge only the missing-from-SSE columns.
- If your Realtime listener exists (currently it shouldn't post Phase 060), make sure its handler does the same merge — never a wholesale replace of `content`.

**Warning signs:** On terminal, content briefly empties then refills; or confidence badge appears then disappears; or two assistant messages render briefly side by side.

### Pitfall 6: `list_active_runs` 500s for cross-user requests on real Postgres (CR-01 from 062-VERIFICATION.md)

**What goes wrong:** Per 062-VERIFICATION.md CR-01: the `list_active_runs` route at `threads.py:462` uses `.single()` instead of `.maybe_single()`. Mocked tests pass; real Postgres raises `PGRST116` on no-row, the patch in `main.py` only handles `code="204"`, and the error propagates as 500 instead of the required 404 (D-062-12).

**Why it happens:** Plan 01 of Phase 062 was written before the `.maybe_single()` pattern was established in `runs.py`. The planner caught it in verification but it wasn't fixed in 062.

**How to avoid:**
- 063 planner should decide one of: (a) include a 1-line tail-task in 063 to fix this (since 063 also touches `threads.py` and the file would already be in the diff), or (b) defer to a 062.x cleanup phase.
- Recommended: include in 063. The fix is mechanical (`.single()` → `.maybe_single()` + `row = thread_resp.data if thread_resp is not None else None`) and 063 will already trigger a re-run of all 062 tests — natural moment to close it.

**Warning signs:** Cross-user `GET /threads/{tid}/active-runs` returns 500 in browser MCP testing; `test_062_active_runs.py::test_active_runs_other_user_returns_404` GREEN under mock but failing on integration env.

### Pitfall 7: SSE backpressure when tab backgrounded

**What goes wrong:** When a tab is hidden (Chrome background tab throttling), the JS event loop runs at ~1 Hz. Tokens streaming in at ~50/sec accumulate in the OS receive buffer; the consumer's `await reader.read()` falls behind. On refocus, all events flush at once.

**Why it happens:** Chrome's tab-throttling is a battery optimization; SSE consumers running JS-side parsing are subject to it. The `EventSourceResponse(ping=None)` server side (Phase 061.1 D-061.1-04) means no ping frames — ironically that's beneficial because we don't waste backpressure on heartbeats.

**How to avoid:**
- Don't fight it. The backlog flushes correctly on refocus and React reconciliation handles the burst.
- Make sure `setMessages` updates inside the parser loop are throttled or batched if profiling shows main-thread jank on flush. Existing `streamMessage` doesn't batch and works fine for typical token rates — keep that behavior.
- bfcache + visibilitychange triggers ALSO fire reconcile on refocus; if the burst is so large that the consumer falls behind the server's TTL, the next reconcile picks it up from `since=0` again.

**Warning signs:** Jank on tab-refocus mid-stream; tokens appear all at once after a delay.

### Pitfall 8: Race between `active-runs` 200 OK and run completing in same tick

**What goes wrong:** User refreshes mid-stream. `active-runs` returns `[{run_id: X, status: 'streaming'}]` at T=0. Frontend opens stream at T=10ms. The run actually terminated between T=2ms and T=8ms. Stream endpoint sees `redis.exists("run:X") == false` → falls through to D-062-06 synthetic-terminal path. Frontend gets exactly one `done`+`buffer_expired` event and closes — but the placeholder content is still empty because we never replayed the actual deltas.

**Why it happens:** TTL-expired runs are a Phase 062 corner case explicitly handled by the synthetic terminal (T9-T11 GREEN). For COMPLETED runs that just terminated within the last 10 minutes, this case shouldn't happen because TTL is 600s. But for failed/cancelled (60s TTL) AND a long enough delay (mobile network), it CAN happen.

**How to avoid:**
- On `subscribeToRun` receiving a synthetic terminal with `error: "buffer_expired"`, treat it as a hint to immediately call `loadMessages(thread_id)` — the persisted assistant message has the complete content from the database.
- If `loadMessages` also returns no assistant message (because the run terminated as `cancelled` before the assistant message was persisted), the placeholder shows the canonical "Response stopped"/error UI based on `runs_status` field of the synthetic event.

**Warning signs:** "Empty bubble" briefly visible after refresh-during-fast-stream scenarios; resolves after a brief render delay.

### Pitfall 9: Auth token expiry mid-stream

**What goes wrong:** Supabase JWT default lifetime is 1 hour. If the user has a long-lived stream open and their token expires, the next `subscribeToRun` reconnect (e.g., visibility change) will return 401, not 404. Generic error handling renders this as "stream broken" without a clear path to recovery.

**Why it happens:** The reconcile path always grabs a fresh token via `getAuthHeaders()` (which calls `supabase.auth.getSession()` returning the current valid token if Supabase auto-refreshed it). But the 1h-old open stream uses the original token; if Supabase didn't auto-refresh in time, the GET stream may 401 mid-flight.

**How to avoid:**
- Supabase JS client auto-refreshes by default. As long as the page is alive, the session refreshes silently before expiry.
- For the rare bfcache-restore-after-1h case: the reconcile happens on `pageshow` with `event.persisted === true`, which fires AFTER React rehydration but BEFORE any timers fire. The fresh `getAuthHeaders()` call inside reconcile picks up the refreshed token automatically.
- No explicit handling needed in 063 — but document this as a 064 harness test scenario.

**Warning signs:** Long-running streams (rare but possible with hard_timeout=120s + sub-agent depth) get 401 on refocus after multi-hour idle.

## Runtime State Inventory

> Phase 063 has rewrite + delete elements (`event_consumer` deletion, `streamMessage` rewrite, contract change on POST). Apply the inventory checklist.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — Redis Stream `run:{run_id}` content unchanged (Phase 061 owns it); `public.runs` schema unchanged (Phase 061 migration 035) | None |
| Live service config | None — no n8n / Datadog / external services touch streaming | None |
| OS-registered state | None — no OS-level registrations involve streaming | None |
| Secrets/env vars | None new. Existing `REDIS_URL`, `RUN_HARD_TIMEOUT_SECONDS`, Supabase auth keys all unchanged | None |
| Build artifacts | Frontend bundle re-emit (Vite dev/prod) — automatic on next build. No stale `dist/` issue because the ChatArea/useMessages/api.ts files are sources, not artifacts | None — natural rebuild |
| Backend integration test files referencing old POST-stream contract | Verified by file landmarks: `backend/tests/integration/test_058_concurrency.py` (cross-tab regression), `test_059_disconnect.py::test_normal_stream_unchanged` (already excluded per DEF-061.1-01), `test_061_producer_survives_disconnect.py` (still excluded per DEF-061.1-02), and any other `test_058_*` / `test_059_*` / `test_061_*` that posts to `/threads/{tid}/messages` and reads SSE off the response | Audit at planning time. Per CONTEXT.md D-063-01: "Tests that exercise the legacy POST-streaming path either get rewritten to the new contract or deleted (cannot keep them — they exercise removed code)". Plan an explicit Wave 0 test-audit task. |

**Nothing else found in the other categories** — verified by:
- Grepping `frontend/src` for `EventSource|visibilitychange|pageshow` (only the existing comment at ChatArea.tsx:88 mentions them, no listeners exist)
- Reading the full 062-CONTEXT.md "Out of scope" section — POST handler explicitly deferred to 063
- Reading 061-CONTEXT.md "Files that should NOT change" — `agent_runner` body, `RUN_TASKS` semantics, `_shielded_finalize` ordering preserved

## Code Examples

Verified patterns from existing codebase (Source: direct Read of cited line numbers).

### Example 1: Existing user-message INSERT in send_message (PRESERVE — only response shape changes)

```python
# Source: backend/app/api/threads.py:746-753 (read 2026-05-03)
# This INSERT MUST stay before the runs row INSERT — frontend depends on
# the user message id flowing back in the response so it can deduplicate
# the optimistic placeholder.
await aexec(
    supabase.table("messages").insert({
        "thread_id": thread_id,
        "user_id": current_user["id"],
        "role": "user",
        "content": body.content,
    })
)
```

**Note for the planner:** This INSERT does NOT currently return the new message id. The 063 rewrite needs to capture it — change to `.insert(...).select("id").single()` + extract the id, OR rely on the message's natural row id from the response data of `aexec`. The current frontend doesn't use this id (it uses a temp-id), but D-063-01 explicitly requires `{message_id, run_id}` in the response.

### Example 2: Existing runs INSERT + ZADD pattern (PRESERVE verbatim)

```python
# Source: backend/app/api/threads.py:768-807 (read 2026-05-03)
# This entire block stays. Phase 063 makes ZERO changes here. The producer
# spawn at the end (asyncio.create_task) is also unchanged.
run_id = _uuid_mod.uuid4()
_resolved_model = body.model if getattr(body, "model", None) else _user_settings.llm_model
_resolved_provider = _user_settings.active_provider

try:
    await aexec(
        supabase.table("runs").insert({
            "run_id": str(run_id),
            "thread_id": thread_id,
            "user_id": current_user["id"],
            "status": "streaming",
            "model": _resolved_model,
            "provider": _resolved_provider,
        })
    )
    _started_score = time_mod.time()
    try:
        await redis.zadd(f"runs_by_thread:{thread_id}", {str(run_id): _started_score})
        await redis.zadd("runs:active", {str(run_id): _started_score})
    except Exception:
        logger.exception("ZADD failed for run %s; continuing (passive cleanup at query time)", run_id)
except Exception:
    # Spawn-failure cleanup ... (unchanged) ...
    raise
```

### Example 3: Phase 062 active-runs response shape (frontend consumes this)

```python
# Source: backend/app/models/run.py + threads.py:482-490 (read 2026-05-03)
# Frontend will type this as:
#   interface ActiveRun { run_id: string; started_at: string; status: 'streaming' }
# Always status='streaming' per D-062-02 — terminal runs are reached via
# GET /threads/{id}/messages, not active-runs.
runs_resp = await aexec(
    supabase.table("runs")
    .select("run_id, started_at, status")
    .eq("thread_id", str(thread_id))
    .eq("user_id", current_user["id"])
    .eq("status", "streaming")
    .order("started_at", desc=True)
)
return runs_resp.data or []
```

### Example 4: Existing fetch + ReadableStream parser (REUSE in subscribeToRun)

```typescript
// Source: frontend/src/lib/api.ts:127-220 (read 2026-05-03)
// The reader loop is reusable verbatim — Phase 062 wire format is byte-
// identical (data: {"type": ...}\n\n). Phase 063 just changes the URL
// (/runs/{rid}/stream instead of /threads/{tid}/messages) and method
// (GET instead of POST) in the fetch call. The split-on-newline +
// data: prefix parsing stays identical.
const res = await fetch(`${API_BASE}/threads/${threadId}/messages`, {
  method: "POST",
  headers,
  body: JSON.stringify({ content, model, provider, agent_mode: agentMode ?? "default" }),
  signal,
})
if (!res.ok) throw new Error("Failed to send message")
if (!res.body) throw new Error("No response body")
const reader = res.body.getReader()
const decoder = new TextDecoder()
let buffer = ""
let doneFired = false
while (true) {
  let done: boolean, value: Uint8Array | undefined
  try {
    ;({ done, value } = await reader.read())
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") return
    throw err
  }
  if (done) break
  buffer += decoder.decode(value, { stream: true })
  const lines = buffer.split("\n")
  buffer = lines.pop() ?? ""
  for (const line of lines) {
    if (!line.startsWith("data: ")) continue
    const raw = line.slice(6).trim()
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>
      if (parsed.type === "delta") onDelta(parsed.content as string)
      // ... rest of the type discriminator unchanged ...
    } catch { /* ignore malformed lines */ }
  }
}
```

### Example 5: Phase 062 DELETE endpoint contract (frontend Stop calls this)

```python
# Source: backend/app/api/runs.py:354-494 (read 2026-05-03)
# Idempotent. 204 on success / already-terminal / Redis-down. 404 on cross-user.
# Frontend Stop fires this and does NOTHING ELSE — the terminal sentinel
# arrives via the open SSE.
@router.delete("/{run_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
async def cancel_run(
    run_id: UUID,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
    redis: aioredis.Redis = Depends(get_redis),
):
    # Step 1: ownership SELECT (404 if not owned/missing)
    # Step 2: already-terminal → 204 silent
    # Step 3a: happy path — task.cancel() → 204 (producer's CancelledError handler runs async)
    # Step 3b: zombie heal — UPDATE Postgres + synthetic sentinel + ZREM x2 + EXPIRE 60 → 204
    ...
```

### Example 6: Existing Phase 060 ChatArea thread-switch ordering (PRESERVE)

```typescript
// Source: frontend/src/components/chat/ChatArea.tsx:68-90 (read 2026-05-03)
// This effect is unchanged in 063 — but a SECOND effect for reconcile
// hooks (mount, focus, visibility, pageshow) gets added alongside it.
// The setViewingThread → abortStream → clearMessages → loadMessages
// ordering MUST stay (D-060-01 / D-060-08).
useEffect(() => {
  setViewingThread(thread?.id ?? null)
  if (!thread) {
    clearMessages()
    return
  }
  if (justCreatedThreadRef.current === thread.id) {
    justCreatedThreadRef.current = null
    return
  }
  abortStream()
  clearMessages()
  loadMessages(thread.id).catch(console.error)
}, [thread?.id])
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| POST returns `EventSourceResponse` (events streamed inside the POST response body) | POST returns JSON `{message_id, run_id}` synchronously; frontend opens separate `GET /runs/{rid}/stream?since=0` for tokens | Phase 063 (this phase) | Generation lifetime decoupled from any single HTTP request; multi-tab + refresh + bfcache work as side-effects |
| Stop = `AbortController.abort()` on the in-flight POST fetch | Stop = `DELETE /runs/{rid}` server-side cancel verb | Phase 063 (this phase, building on Phase 062's DELETE handler) | Cross-tab Stop free; producer actually killed (not just consumer-side socket); aligns with Claude.ai/ChatGPT semantics |
| `EventSource` browser API for SSE | `fetch` + ReadableStream | Phase 056 (already in place) | Custom Authorization header support |
| In-memory `asyncio.Queue` between agent_runner producer and consumer | Redis Stream `run:{run_id}` | Phase 061 | Producer survives consumer disconnect; replay-from-offset; multi-consumer fan-out |
| LISTEN/NOTIFY or pgmq for streaming | Redis Streams | Phase 061 (D-v2.5-08 LOCKED) | Native multi-consumer + replay; bounded memory (`MAXLEN ~ 10000`); native TTL |
| Supabase Realtime as authoritative source for chat-message arrival | Reconcile-on-(re)connect via `active-runs` GET; Realtime is hint-only | v2.5 milestone (D-v2.5-03 LOCKED) | Realtime stops being load-bearing; correctness from explicit reconcile |

**Deprecated / outdated:**
- `event_consumer` async generator at `backend/app/api/threads.py:331-426` — DELETED in Phase 063 per D-063-01. Replaced by Phase 062's `replay_tail_consumer` in `backend/app/api/runs.py`.
- `EventSourceResponse(event_consumer(...))` return at `backend/app/api/threads.py:2241-2244` — DELETED in Phase 063 per D-063-01. Replaced by `JSONResponse(status_code=201, content={"message_id": ..., "run_id": ...})`.
- 8s fallback timer for tab-visibility recovery (Phase 060 already removed at D-060-07b/c) — replaced by the canonical visibilitychange + pageshow + focus reconcile hooks.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The user-message INSERT at `threads.py:746-753` does not currently return the new message id and the 063 rewrite needs to capture it via `.select("id").single()` or by reading `aexec`'s response data | Pitfall 4, Pattern 1 | Low — the planner verifies via direct read; if I'm wrong, just don't add the `.select(...)` |
| A2 | React in this project is 18.x (not 19), so `useEffectEvent` is unavailable; if React was upgraded, double-mount handling may differ | Pitfall 1, Anti-Patterns | Low — planner confirms via `frontend/package.json` at Wave 0 |
| A3 | Multi-tab rendering tolerance to identical `setMessages` calls is "no-op for React reconciliation" per D-063-02 — true if the message objects' `content` strings are byte-equal across tabs | Pattern 2, "Multi-Tab Sync (SC#4)" | Low — both tabs replay from the same Redis Stream entries; content IS byte-equal by construction |
| A4 | The current frontend Realtime subscription was deleted by Phase 060 (no listener exists for `messages` table changes) | Pitfall 5 | Low — direct grep on `useMessages.ts` shows no Realtime channel; if a listener exists elsewhere, planner re-checks |
| A5 | Phase 062's DELETE endpoint always succeeds (204) for owned runs and the producer's CancelledError handler runs ASYNC (DELETE does NOT await producer cleanup) | Pattern 3, D-063-03 | None — VERIFIED at runs.py:395-398 |
| A6 | Bfcache restore on Chrome / Safari (the only two browsers that fully support bfcache for HTTPS pages with active fetch streams) reliably fires `pageshow` with `event.persisted === true` | Pattern 2, Pitfall 2 | Low — canonical browser behavior [CITED: web.dev bfcache] but exact behavior with active fetch streams in flight is browser-specific. Planner can verify in Phase 064 harness |
| A7 | The frontend `streamMessage` reader loop (api.ts:137-220) handles partial chunk reassembly correctly for the GET stream endpoint just as it does for POST today (wire format byte-identical per Phase 062 D-062-05) | Pattern 1, Code Example 4 | Low — VERIFIED by 062's tests T6-T8 GREEN; the parsing logic is transport-agnostic |

**No high-risk assumptions remain unverified.** The only unverified item is A6 (bfcache + active fetch streams), which is a 064 harness concern, not a 063 implementation concern.

## Open Questions

1. **Should the user-message INSERT return `messages.id`, or is `run_id` sufficient for the response?**
   - What we know: D-063-01 mandates `{message_id, run_id}` response shape.
   - What's unclear: Whether `message_id` here means the user's message id (so the frontend can replace its optimistic placeholder) OR the assistant message id (which doesn't exist yet — the assistant message is persisted only at terminal time).
   - Recommendation: `message_id` = user-message id (it's the only one that exists synchronously). Planner confirms in PLAN.md.

2. **Where does `currentRunId` state live for the Stop flow when reconciling existing runs?**
   - What we know: Stop must `DELETE /runs/{rid}`; the rid is the run currently streaming for the active thread.
   - What's unclear: When a reconcile attaches to a run started by another tab, the local `currentRunIdRef` was never set by THIS tab's `sendMessage`. So the Stop button needs to read run_id from the placeholder message itself (or from a Map keyed by thread_id).
   - Recommendation: Store `runId` on the assistant Message object (extend the Message type with optional `runId: string` and `runStatus: 'streaming' | 'completed' | 'failed' | 'cancelled'`). Stop reads from the latest assistant message with `runStatus === 'streaming'`. Same source of truth for Resume button.

3. **Should the legacy frontend `streamMessage` function be removed entirely or kept as a thin compat shim that delegates to `postMessage` + `subscribeToRun`?**
   - What we know: Single-developer dev project, no external API consumers. D-063-01's "no backwards compatibility shim" applies to backend.
   - What's unclear: Frontend doesn't need a shim — but rewriting all callers in one diff is cleaner than leaving an alias.
   - Recommendation: Delete `streamMessage` outright; rewrite the two callers (`useMessages.sendMessage` and any test fixtures) to use the new functions. Smaller surface area.

4. **Backend integration test cleanup scope — which specific test files reference the legacy POST-stream contract?**
   - What we know: CONTEXT.md flags `test_058_*`, `test_059_*`, `test_061_*`. 062-VERIFICATION.md inherits 4 exclusions (DEF-061.1-01, DEF-061.1-02 carry-forward).
   - What's unclear: Whether the new tests (062's 9 test files) contain implicit references to the legacy POST shape that break post-cutover.
   - Recommendation: Wave 0 of 063 includes a test-audit task — `grep -rn 'EventSourceResponse\|streamMessage\|POST.*messages' backend/tests/integration/` and triage each match.

5. **Resume button click handler — does it call `sendMessage(...)` (which inserts a NEW user message + new run) or a different "retry" path that reuses the failed run's user message?**
   - What we know: D-063-04 says "re-POSTs the original user message via the new POST contract".
   - What's unclear: Whether re-POSTing means literally INSERTing a duplicate user-message row in the messages table, or whether the backend deduplicates based on content+thread+timestamp.
   - Recommendation: Re-POST literally. The backend POST handler doesn't dedupe today; adding dedup here is scope creep. Two identical user-messages in the history is the correct semantic for "I want to retry this exact prompt with a fresh LLM call" — it's also what ChatGPT does when you click Regenerate.

## Environment Availability

> Phase 063 has no NEW external dependencies — only edits existing code that calls already-running services.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Redis | Phase 062 endpoints (consumed by 063 frontend) | ✓ | 5.x via docker-compose.dev.yml | None — required for streaming. Health check at `/health` reports `{"redis": "ok" | "unreachable"}` per Phase 061 |
| Supabase (local Docker) | runs table SELECTs, threads ownership, messages persistence | ✓ | per supabase CLI | None — required |
| Node.js / Vite | Frontend build/dev | ✓ | per project default | None |
| Browser with bfcache support | Reconcile-on-pageshow in production | ✓ | Chrome/Safari/Firefox (modern) | Older browsers: visibilitychange + focus listeners cover the same path; pageshow listener is additive |
| Browser with EventSource-equivalent fetch + ReadableStream | All SSE consumption | ✓ | All evergreen browsers since 2017 | None — already in use |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** None.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Backend framework | pytest 8.x + pytest-asyncio + httpx ASGITransport (per Phase 058+ patterns) |
| Backend config file | `backend/pytest.ini` (project default; existing) |
| Backend quick run | `cd backend && python -m pytest tests/integration/test_063_*.py -x -q` |
| Backend full run | `cd backend && python -m pytest tests/integration/test_058_*.py tests/integration/test_059_*.py tests/integration/test_061_*.py tests/integration/test_062_*.py tests/integration/test_063_*.py -q -k 'not (test_normal_stream_unchanged or test_failed_run_expires_60s or test_120s_timeout_fires_full_finally or test_producer_continues_after_consumer_disconnect)'` (preserves DEF-061.1-01/02 inherited exclusions) |
| Frontend framework | None for unit (project doesn't have Jest/Vitest set up); Playwright e2e tests at `e2e/tests/*.spec.ts` (Phase 060 added `060-thread-race.spec.ts`) |
| Frontend e2e config | `e2e/playwright.config.ts` (existing) |
| Frontend e2e quick run | `cd frontend && npx playwright test e2e/tests/063-*.spec.ts` |
| Browser MCP harness | Phase 064 owns the comprehensive scenario coverage; 063 may include 1-2 minimal browser-driven smoke checks but defers symptom E/F/G/H matrix to 064 |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| STREAM-04 (frontend) | POST returns `{message_id, run_id}` synchronously (no SSE on POST) | unit (backend) | `pytest backend/tests/integration/test_063_post_contract.py::test_post_returns_message_and_run_ids -x` | ❌ Wave 0 |
| STREAM-04 (frontend) | POST inserts user message + runs row + spawns producer; returns immediately (response time < producer's first XADD) | integration (backend) | `pytest backend/tests/integration/test_063_post_contract.py::test_post_returns_before_producer_first_xadd -x` | ❌ Wave 0 |
| STREAM-04 (frontend) | Frontend `subscribeToRun(rid, "0")` consumes existing producer's stream end-to-end (replay+tail+terminal) — already proven by 062 tests; 063 adds a regression-guard combining new POST + fresh GET | integration (backend) | `pytest backend/tests/integration/test_063_post_then_subscribe.py::test_post_then_get_stream_renders_full_response -x` | ❌ Wave 0 |
| STREAM-04 (frontend, multi-tab) | Two consumers of same `run_id` get same sequence (062 already tested at API level; frontend regression preserved) | integration (backend) | Existing `pytest backend/tests/integration/test_062_multi_consumer_fanout.py -x` (re-run) | ✅ |
| STREAM-04 (frontend, refresh-mid-stream) | F5 mid-stream → `active-runs` lists run → frontend reattaches via `since=0` and replays | e2e (Playwright) | `npx playwright test e2e/tests/063-refresh-mid-stream.spec.ts` | ❌ Wave 0 |
| STREAM-04 (frontend, multi-tab) | Two browser tabs both render same tokens for same run | e2e (Playwright) — likely manual due to multi-tab orchestration | Manual or 064 harness | ❌ deferred to 064 |
| STREAM-02b (frontend, Symptom G) | Stop button → `DELETE /runs/{rid}` → server cancels → all consumers close cleanly | integration (backend) | Existing `pytest backend/tests/integration/test_062_delete_happy.py -x` (no change needed) | ✅ |
| STREAM-02b (frontend, Symptom G cross-tab) | Stop in Tab B closes Tab A's stream | manual / 064 harness | Manual via Chrome MCP | ❌ deferred to 064 |
| Resume button surfaces only on `failed` runs | Backend integration: active-runs returns failed run; frontend renders Resume button (DOM assertion) | e2e (Playwright) | `npx playwright test e2e/tests/063-resume-failed.spec.ts` | ❌ Wave 0 |
| No tool-result JSON leak (Bug 3 regression guard from Phase 060) | SSE-built content stays canonical; Realtime upsert merges fields without overwriting `content` | unit (frontend hook test) — no Jest/Vitest available; cover via e2e | Manual / 064 | ❌ deferred to 064 |
| `event_consumer` deleted from threads.py | Static check | unit (backend) | `pytest backend/tests/integration/test_063_legacy_path_deleted.py::test_event_consumer_not_importable -x` | ❌ Wave 0 |
| EventSourceResponse return at threads.py:2241-2244 deleted | Static check via test | unit (backend) | `pytest backend/tests/integration/test_063_legacy_path_deleted.py::test_post_does_not_return_eventsourceresponse -x` | ❌ Wave 0 |
| 058 cross-tab regression preserved | Existing 058 binding test still passes | integration (backend) | `pytest backend/tests/integration/test_058_concurrency.py::test_cross_tab_unblocked_during_sse -x` (must adapt to new POST contract — JSON response, not SSE; planner audits) | ✅ (test file exists; may need contract update) |

### Sampling Rate

- **Per task commit:** `cd backend && pytest tests/integration/test_063_*.py -x -q` (fast — only the new 063 files)
- **Per wave merge:** Backend full suite (combined regex above) + `cd frontend && npx playwright test e2e/tests/063-*.spec.ts`
- **Phase gate (before /gsd:verify-work):** Backend full suite green AND `e2e/tests/060-thread-race.spec.ts` green (Phase 060 regression) AND `e2e/tests/063-*.spec.ts` green AND CR-01 fixed if planner included it AND legacy `event_consumer` confirmed deleted by `grep`

### Wave 0 Gaps

- [ ] `backend/tests/integration/test_063_post_contract.py` — covers new POST `{message_id, run_id}` shape, response-before-first-XADD invariant
- [ ] `backend/tests/integration/test_063_post_then_subscribe.py` — covers POST+GET roundtrip end-to-end (regression guard combining new POST + 062 GET stream)
- [ ] `backend/tests/integration/test_063_legacy_path_deleted.py` — static-check tests asserting `event_consumer` is not importable from `app.api.threads` and POST handler signature returns JSON not SSE
- [ ] `e2e/tests/063-refresh-mid-stream.spec.ts` — Playwright covers Symptom F (F5 mid-stream → reattach via active-runs)
- [ ] `e2e/tests/063-resume-failed.spec.ts` — Playwright covers Resume button visibility on failed runs (uses backend mock fault injection per Phase 062 redis_down test pattern)
- [ ] Audit: any backend test in `test_058_*.py` / `test_059_*.py` / `test_061_*.py` that POSTs to `/threads/{tid}/messages` and reads SSE off the response — rewrite to GET `/runs/{rid}/stream` after POST returns JSON, OR delete if redundant with 062's coverage. Wave 0 task lists each file by name.
- [ ] (Optional, if planner pulls in CR-01 fix) `pytest backend/tests/integration/test_062_active_runs.py::test_active_runs_other_user_returns_404` re-runs against real Postgres (planner decides whether to scope this in 063)

### Test Framework Install

No installation needed. pytest, pytest-asyncio, httpx, Playwright, redis-py async, sse-starlette are all already in `backend/requirements.txt` and `frontend/package.json` per Phase 058–062 deliverables.

## Security Domain

> `security_enforcement` is not explicitly disabled in `.planning/config.json`; treat as enabled.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Supabase Auth JWT bearer; existing `getAuthHeaders()` flow on every request including the new `subscribeToRun` GET stream and the `DELETE /runs/{rid}` |
| V3 Session Management | yes | Supabase auto-refresh of JWT tokens; reconcile on visibilitychange picks up refreshed token via `getAuthHeaders()` (no stale-token issue at reconnect time — see Pitfall 9) |
| V4 Access Control | yes | RLS on `public.runs` (SELECT-only) + defense-in-depth `.eq("user_id", current_user["id"])` filter on every endpoint; ALL three Phase 062 endpoints already enforce this and return 404 not 403 (D-062-12) |
| V5 Input Validation | yes | FastAPI auto-validates `run_id: UUID` and `thread_id: UUID` path params (422 on malformed). Frontend `since=0` literal — no user-controlled input (D-063-02). DELETE has no body. POST body validated by Pydantic `MessageCreate` (existing). |
| V6 Cryptography | no — no new crypto primitives in 063; existing JWT handling unchanged | n/a |

### Known Threat Patterns for React+FastAPI+SSE+Redis stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cross-user IDOR on `GET /runs/{rid}/stream` | Information Disclosure | Existing `.eq("user_id", current_user["id"])` ownership SELECT + 404-not-403 (D-062-12); VERIFIED in 062-VERIFICATION.md T17 |
| Cross-user IDOR on `GET /threads/{tid}/active-runs` | Information Disclosure | Same ownership pattern; PARTIAL per CR-01 (`.single()` instead of `.maybe_single()`) — fix in 063 if planner decides |
| Cross-user IDOR on `DELETE /runs/{rid}` (cross-user cancel) | Tampering / Elevation of Privilege | Ownership SELECT runs BEFORE `RUN_TASKS.get` lookup (D-062-08 step 1 ordering); VERIFIED in 062-VERIFICATION.md T18 |
| Auth bypass via missing token on EventSource | Authentication | NOT applicable — we use `fetch` + ReadableStream (Authorization: Bearer header). EventSource API would have this flaw; we deliberately don't use it |
| Run-id enumeration | Information Disclosure | `run_id` is `gen_random_uuid()` (D-061-05) — 122 bits of entropy; brute-force infeasible |
| Replay attack via stale `since=0` request | Tampering | `since` is a Redis Stream ID; XREAD is non-destructive read. No state mutation. Replay is benign — same content rendered twice (D-063-02 idempotent semantics) |
| Resource exhaustion via parallel SSE consumers | DoS | Bounded by per-run `replay_tail_consumer.deadline = run_hard_timeout_seconds + 10` + bounded asyncio task pool. Single-worker uvicorn (D-v2.5-02) means N tabs share one worker; Phase 062 T-062-04 accepts this disposition |
| Auth token leak via URL query parameter | Information Disclosure | Token is in `Authorization` HEADER, NOT in `?since=0` query string. Server logs / proxy logs do not leak the token |
| CSRF on `DELETE /runs/{rid}` | Tampering | DELETE requires `Authorization: Bearer` header, not a cookie — CSRF inapplicable to bearer-token API |
| Bug 3 regression — tool-result JSON leaking into chat content | Tampering / Information Disclosure | Phase 060 invariant preserved by NOT reintroducing the `finally`-block `loadMessages` that caused it. 063 reconcile flow does call `loadMessages` BUT only at terminal time (not mid-stream), and merges DB-only fields without overwriting SSE content |

## Sources

### Primary (HIGH confidence)

- `.planning/phases/063-frontend-stream-decoupling/063-CONTEXT.md` — D-063-01..04 LOCKED decisions, reconciliation hook ordering, bfcache mandate (read 2026-05-03)
- `.planning/phases/061-run-backed-streaming-backend/061-CONTEXT.md` — D-061-01..17 producer/consumer contracts, RUN_TASKS registry, terminal sentinel discipline (read 2026-05-03)
- `.planning/phases/062-replay-tail-api/062-CONTEXT.md` — D-062-01..16 endpoint contracts, file layout discipline, multi-consumer fan-out at API layer (read 2026-05-03)
- `.planning/phases/062-replay-tail-api/062-VERIFICATION.md` — 20/21 truths VERIFIED, CR-01 (`.single()` vs `.maybe_single()`) gap, 5 still-pending HUMAN-UAT items (read 2026-05-03)
- `.planning/PROJECT.md` Key Decisions — D-v2.5-01..11 (read 2026-05-03)
- `.planning/REQUIREMENTS.md` — STREAM-04 acceptance text including (a)/(b)/(c) verification scenarios (read 2026-05-03)
- `.planning/ROADMAP.md` Phase 063 — Success Criteria #1–7 + Risks/Pitfalls (read 2026-05-03)
- `backend/app/api/threads.py:1-2244` — verified file landmarks for `event_consumer` (331-426), `_emit_terminal` (113-127), `RUN_TASKS` (78), `list_active_runs` (449-490), `send_message` (727-2244), `EventSourceResponse(event_consumer(...))` return (2241-2244) (read 2026-05-03)
- `backend/app/api/runs.py:1-494` — Phase 062 module: `replay_tail_consumer`, `_synthetic_terminal_generator`, `stream_run`, `cancel_run` (read 2026-05-03)
- `frontend/src/hooks/useMessages.ts:1-395` — current hook with Phase 060 race fixes; setViewingThread, AbortController for loadMessages, no Realtime listener (read 2026-05-03)
- `frontend/src/lib/api.ts:1-826` — current `streamMessage` reader loop, `getAuthHeaders`, `getMessages` (read 2026-05-03)
- `frontend/src/components/chat/ChatArea.tsx:1-213` — current thread-switch effect, no visibilitychange/pageshow listeners post-Phase-060 (read 2026-05-03)
- `frontend/src/components/chat/MessageItem.tsx:1-80+` — current assistant message rendering, where Resume button slot will live (read 2026-05-03)
- `frontend/src/types/index.ts:1-95` — current Message type, will need optional `runId`, `runStatus` fields (read 2026-05-03)
- CLAUDE.md project-level rules — React+Vite+Tailwind+shadcn, FastAPI, Supabase+Redis, no LangChain, run_in_threadpool, single uvicorn worker, Realtime hint-only (read 2026-05-03)

### Secondary (MEDIUM confidence)

- [MDN: Window: pageshow event](https://developer.mozilla.org/en-US/docs/Web/API/Window/pageshow_event) — `event.persisted` semantics for bfcache restore detection
- [web.dev: Back/forward cache](https://web.dev/articles/bfcache) — bfcache best practices including pagehide/pageshow event pairing for connection management
- [WHATWG html issue #2177: Setting headers for EventSource](https://github.com/whatwg/html/issues/2177) — confirms native EventSource API does not support custom headers like Authorization, validating the fetch+ReadableStream choice
- [MDN: EventSource: withCredentials property](https://developer.mozilla.org/en-US/docs/Web/API/EventSource/withCredentials) — withCredentials sends cookies but NOT bearer tokens
- [React 19.2 release notes](https://react.dev/blog/2025/10/01/react-19-2) — `useEffectEvent` still experimental; defer to ref-based stale-closure prevention
- [react.dev: StrictMode](https://react.dev/reference/react/StrictMode) — development-only double mount/cleanup; production unaffected
- [DEV.to: Why is useEffect Running Twice? Complete Guide to React 19 Strict Mode](https://dev.to/pockit_tools/why-is-useeffect-running-twice-the-complete-guide-to-react-19-strict-mode-and-effect-cleanup-1n60) — current canonical AbortController + cleanup pattern

### Tertiary (LOW confidence)

- (None — every claim above is grounded in a HIGH or MEDIUM source)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already in repo and verified at line numbers; no new deps
- Architecture: HIGH — 4 user decisions LOCKED + Phase 062 endpoints VERIFIED LIVE
- Pitfalls: MEDIUM-HIGH — pitfalls 1, 5, 6 are direct codebase observations (HIGH); pitfall 2 (bfcache stale state) and pitfall 8 (TTL race) are reasoned-from-architecture (MEDIUM); pitfall 9 (auth expiry) is partially defer-to-064
- Code examples: HIGH — every snippet sourced from a verified line range read in this session

**Research date:** 2026-05-03
**Valid until:** 2026-06-02 (30 days for stable architecture; the underlying browser SSE/bfcache APIs are stable, React 18 → 19 transition is the only fast-moving variable)
