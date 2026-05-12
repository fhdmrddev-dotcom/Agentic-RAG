# Phase 068: `<StreamsProvider>` Context Lift — Research

**Researched:** 2026-05-12
**Domain:** React 19 + Zustand v5 + Vitest 4 — frontend architectural refactor (no backend touched)
**Confidence:** HIGH on Zustand v5 patterns (VERIFIED via npm registry + tkdodo docs + pmndrs RFC #1937); HIGH on existing-code surfaces (line-anchor verified against live files); MEDIUM on render-count assertion technique (multiple credible patterns, picking one)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-068-01 (state store):** Zustand store; selective subscription is the multi-consumer re-render hygiene mechanism the lift exists to enable. Plain Context+useState rejected. `useSyncExternalStore`+custom rejected. Refs that don't drive renders (AbortControllers, offset cursors, single-bit flags) stay as `useRef` inside the provider.
- **D-068-02 (provider API shape):** Named hooks per concern — `useThreadMessages(threadId, surfaceId?)`, `useStreamActions()`, `useStreamSubscriptions(runId)`, `useViewingThread()`. Raw `useStreamsStore` NOT public.
- **D-068-03:** Hide Zustand dependency behind wrappers; callers don't write selectors.
- **D-068-04 (bucket model):** `bucketsBySurface: Map<SurfaceId, Map<thread_id, Message[]>>`. `SurfaceId = string`; chat = `'chat'` default.
- **D-068-05:** Per-thread bucket invariant survives verbatim. Branch D-3 `clearMessages` guard at `useMessages.ts:572-590` ported byte-identically; **dedicated Vitest regression test is THE binding gate for SC#2** (fires for `'chat'` AND `'mock-eval'`).
- **D-068-06:** SEED-007's original `Map<run_id, Message[]>` per-run keying is NOT adopted.
- **D-068-07:** Reconcile listeners (`visibilitychange`, `focus`, `pageshow`) MOVE into provider's mount-time `useEffect`. `ChatArea.tsx:163-188` deletes entirely.
- **D-068-08:** Listeners gate on `activeThreadIdRef.current` (now inside provider) — no-op if no thread viewing.

### Locked Invariants (MUST survive verbatim)

- **L-068-01:** Branch D-3 `clearMessages` guard (`if (tid && tid !== streamingThreadIdRef.current) { ... }`). Vitest regression required.
- **L-068-02:** D-063.1-11 `reconcileInFlightRef` boolean single-bit lock — top-of-function bail; set true before Promise.all; release in finally.
- **L-068-03:** D-060-01 sole-writer pattern for `activeThreadIdRef` — `setViewingThread` is the only writer. Post-await guard inside actions.
- **L-068-04:** D-067.3-R1-05 `streamingThreadIdRef` bucket-routing — deltas route to streaming thread's bucket.
- **L-068-05:** D-063.1-04 runId-match dedup — reconcile reuses `m.runId === run.run_id` message's id as assistantId.
- **L-068-06:** D-063.1-12 `loadMessages` MERGE three-clause filter for temp placeholders.
- **L-068-07:** BL-03 cleanup pattern — `subscriptionsRef.current.delete(runId)` belongs to onTerminal, NOT finally.

### Claude's Discretion

- Mount site: below auth gate, above router (sane default).
- Hook rename: keep `useMessages` or rename to `useChatMessages` if rename falls out cleanly.
- Store layout: single slice vs sliced (target <400 LOC).
- `SurfaceId` form: string alias for v2.6.
- `<DevTwoPaneMock>` shape: real `<MessageList>` vs stub.
- Mocked second surface name: `'mock-eval'` for tests.
- Action set: idiomatic Zustand co-located with state.

### Deferred Ideas (OUT OF SCOPE)

- Per-run sub-bucket model `Map<run_id, Message[]>` (re-open trigger: real use case for per-run composition).
- Single `useStreamsContext()` mega-hook (re-open: if named-hook split causes friction).
- Plain React Context+useState/useRef store (re-open: if zustand dep proves problematic).
- Reconcile listeners staying in ChatArea (no re-open trigger anticipated).
- `<StreamsProvider>` above auth gate (re-open: background tasks that outlive auth).
- `useSyncExternalStore` + custom store (re-open: dep-minimization milestone).
- Renaming `useMessages` → `useChatMessages` (Claude's discretion during Plan 2).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **STREAMS-PROVIDER-01** | A `<StreamsProvider>` Context owns all run-stream subscriptions; `useMessages` reads from it via named hooks; a second concurrent stream surface (mocked eval pane) renders without state collision. The Phase 067.5 Branch D-3 streaming-bucket guard at `frontend/src/hooks/useMessages.ts:572-590` is preserved verbatim; existing 063 / 063.1 / 067.x regression tests stay green. | Sections #1, #2, #5, #6 below specify the Zustand v5 idioms + Vitest patterns that make the named-hook + multi-surface + invariant-preservation properties verifiable. Section #11 (Validation Architecture) maps each property to a concrete test. |
</phase_requirements>

## Goal Summary

Hoist `subscriptionsRef`, `lastSeenOffsetRef`, `reconcileInFlightRef`, `activeThreadIdRef`, `streamingThreadIdRef`, and the `messagesByThread` Map out of `frontend/src/hooks/useMessages.ts` (1229 LOC) into a top-level `<StreamsProvider>` Zustand-backed component mounted in `frontend/src/App.tsx`. `useMessages` becomes a thin reader delegating to four named hooks. The per-thread bucket invariant (Phase 067.5 Branch D-3) survives byte-identical. A mocked second surface (`'mock-eval'`) proves the multi-consumer substrate works without state collision. This phase ships the substrate; v3.0 Skill Studio ships the use case.

**Primary recommendation:** Land the Zustand store (v5 curried form, Map state with `new Map(prev).set(...)` immutable-replace pattern, actions co-located on store) BEFORE rewriting `useMessages`. The four named hooks (`useThreadMessages`, `useStreamActions`, `useStreamSubscriptions`, `useViewingThread`) use atomic selectors per Dorfmeister convention — NO `useShallow` needed at boundaries because each named hook returns a single slice. Refs (AbortControllers, offset cursors, in-flight bool) live as `useRef` *inside* the `<StreamsProvider>` component and are closed over by store actions defined *inside* the provider body — NOT module-level — so each provider instance owns its own handles. Reconcile listeners attach in a single mount-time `useEffect` inside the provider and gate on `useStreamsStore.getState().activeThreadId` (zero-cost synchronous read). The Vitest regression test for L-068-01 mounts two `<StreamsProvider>` consumers via `renderHook` and fires the Branch D-3 scenario against both `surfaceId='chat'` and `surfaceId='mock-eval'`; SC#3 re-render isolation is asserted via a `useEffect` render-counter ref inside each consumer.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Per-surface, per-thread bucket state | Browser / Client (Zustand store) | — | In-tab UI state. No persistence. |
| AbortController handles + offset cursors + in-flight lock | Browser / Client (refs inside provider) | — | Handles, not display state. Refs don't drive renders. |
| `visibilitychange` / `focus` / `pageshow` reconcile triggers | Browser / Client (provider mount-time `useEffect`) | — | App-level event sources; provider is the new owner per D-068-07. |
| SSE event dispatch (`subscribeToRun`) | API / Backend (`/runs/{rid}/stream`) | Browser / Client (parser in `lib/api.ts:274`) | Wire format untouched (Phase 062 D-062-05). Only the `surfaceId` routing arg is new. |
| Per-run persistence (`runs` table) | Database / Storage (`public.runs`) | — | Unchanged; backend off-limits per `<domain>` boundary. |
| Re-render isolation across surfaces | Browser / Client (Zustand atomic selectors) | — | Subscribing to `bucketsBySurface.get('chat').get(threadId)` does NOT trigger re-render when `'mock-eval'` bucket updates. |

---

## Findings

### 1. Zustand v5 idioms for this exact shape

**Status:** [VERIFIED: npm registry, zustand@5.0.13 published 2026-05-05] [CITED: pmnd.rs blog announcing-zustand-v5; tkdodo.eu/blog/working-with-zustand; pmndrs/zustand README]

**Curried `create<T>()(set => ...)` form is mandatory for typed stores.** TypeScript cannot infer types when the generic parameter T appears in both covariant and contravariant positions within the StateCreator function signature. The curried form solves this:

```typescript
// frontend/src/stores/streamsStore.ts
import { create } from "zustand"
import type { Message } from "@/types"

export type SurfaceId = string

interface StreamsState {
  bucketsBySurface: Map<SurfaceId, Map<string, Message[]>>
  viewedThreadId: string | null
  isStreaming: boolean
  // actions co-located per Dorfmeister convention (atomic actions object)
  actions: {
    setMessagesForBucket: (
      surface: SurfaceId,
      threadId: string,
      updater: Message[] | ((prev: Message[]) => Message[]),
    ) => void
    clearThreadBucket: (surface: SurfaceId, threadId: string) => void
    setViewingThread: (threadId: string | null) => void
    // …other actions
  }
}

export const useStreamsStore = create<StreamsState>()((set, get) => ({
  bucketsBySurface: new Map(),
  viewedThreadId: null,
  isStreaming: false,
  actions: {
    setMessagesForBucket: (surface, threadId, updater) =>
      set((state) => {
        const surfMap = state.bucketsBySurface.get(surface) ?? new Map()
        const prev = surfMap.get(threadId) ?? []
        const updated = typeof updater === "function" ? updater(prev) : updater
        const nextSurfMap = new Map(surfMap).set(threadId, updated)
        const nextBuckets = new Map(state.bucketsBySurface).set(surface, nextSurfMap)
        return { bucketsBySurface: nextBuckets }
      }),
    // …
  },
}))
```

**Map state requires `new Map(prev).set(...)` immutable-replace pattern.** Quoted directly from the pmndrs maintainer reply in Discussion #1439: directly mutating a Map won't trigger reactivity because Zustand detects changes with strict-equality (old === new) by default. Replace the entire Map with a new instance:

```typescript
set((state) => ({
  field: new Map(state.field).set(key, value),
}))
```

For our nested `Map<SurfaceId, Map<thread_id, Message[]>>` shape, BOTH levels need the new-instance pattern (the inner Map under the affected surface AND the outer bucketsBySurface) so a write to `('chat', threadId-A)` produces a new reference at both levels — atomic selectors at either level can then detect change.

**Named wrapper hooks use atomic selectors per Dorfmeister convention.** [CITED: tkdodo.eu/blog/working-with-zustand]. Quote: "I much prefer the simplicity of just exporting two separate selectors":

```typescript
// frontend/src/providers/StreamsProvider.tsx (named hooks section)
import { useStreamsStore } from "@/stores/streamsStore"

export const useThreadMessages = (
  threadId: string | null,
  surfaceId: SurfaceId = "chat",
): Message[] =>
  useStreamsStore((state) => {
    if (!threadId) return EMPTY_ARRAY  // module-level constant for stable identity
    return state.bucketsBySurface.get(surfaceId)?.get(threadId) ?? EMPTY_ARRAY
  })

export const useViewingThread = (): string | null =>
  useStreamsStore((state) => state.viewedThreadId)

// Actions never change identity (they're nested in `actions` object created once at store init)
export const useStreamActions = () =>
  useStreamsStore((state) => state.actions)

export const useStreamSubscriptions = (runId: string): boolean =>
  useStreamsStore((state) => state.subscriptionsByRunId.has(runId))
```

**EMPTY_ARRAY stable-identity trick:** A naive selector `?? []` returns a fresh array each render, triggering an "infinite loop / new-object-each-render" trap that v5 surfaces as an error per [CITED: zustand.docs.pmnd.rs/reference/migrations/migrating-to-v5]. Quote: "Zustand v5 uses native useSyncExternalStore, which requires stable selector references, and a selector returning a new object on every render triggers Maximum update depth exceeded." Fix: hoist a module-level `const EMPTY_ARRAY: Message[] = []` and return that. Same applies to any selector returning an object literal — use `useShallow` OR atomic selectors.

**`useShallow` is NOT needed for our four named hooks** because each returns a single slice (`Message[]`, `string | null`, the stable `actions` object, or `boolean`). No object composition at the boundary → no `useShallow` import needed.

### 2. Refs inside Zustand stores

**Status:** [CITED: GitHub Discussion #2712; React 19 `useRef` semantics] [VERIFIED: current useMessages.ts:417-447 ref declarations]

**Canonical pattern: refs live as `useRef` inside the `<StreamsProvider>` component body; store actions close over them via closure.** They are NOT module-level. They are NOT Zustand state. This isolates handles to the provider instance and matches the existing semantics in `useMessages.ts:417-447`:

```typescript
// frontend/src/providers/StreamsProvider.tsx
export function StreamsProvider({ children }: PropsWithChildren) {
  // Handles, not display state. Live alongside the store, NOT inside it.
  const subscriptionsRef = useRef<Map<string, AbortController>>(new Map())
  const lastSeenOffsetRef = useRef<Map<string, string>>(new Map())
  const reconcileInFlightRef = useRef(false)
  const streamingThreadIdRef = useRef<string | null>(null)
  const activeThreadIdRef = useRef<string | null>(null)

  // Actions that need to mutate refs: define them HERE inside the provider so
  // they close over the refs via closure. Then register them onto the store
  // for consumers to access via useStreamActions().
  useEffect(() => {
    useStreamsStore.setState({
      actions: {
        // …existing actions
        sendMessage: async (threadId, content, opts) => {
          streamingThreadIdRef.current = threadId
          // … uses subscriptionsRef, lastSeenOffsetRef, etc.
        },
        reconcile: async (threadId) => {
          if (reconcileInFlightRef.current) return  // L-068-02
          reconcileInFlightRef.current = true
          try {
            // …existing reconcile body…
          } finally {
            reconcileInFlightRef.current = false
          }
        },
        setViewingThread: (threadId) => {
          activeThreadIdRef.current = threadId  // L-068-03 sole writer
          useStreamsStore.setState({ viewedThreadId: threadId })
        },
      },
    })
  }, [])

  // Reconcile listeners (D-068-07/08)
  useEffect(() => {
    const tryReconcile = () => {
      const tid = activeThreadIdRef.current
      if (!tid) return  // D-068-08 no-op gate
      useStreamsStore.getState().actions.reconcile(tid).catch(console.error)
    }
    const onVisibility = () => { if (document.visibilityState === "visible") tryReconcile() }
    const onFocus = () => tryReconcile()
    const onPageShow = (e: PageTransitionEvent) => { if (e.persisted) tryReconcile() }
    document.addEventListener("visibilitychange", onVisibility)
    window.addEventListener("focus", onFocus)
    window.addEventListener("pageshow", onPageShow)
    return () => {
      document.removeEventListener("visibilitychange", onVisibility)
      window.removeEventListener("focus", onFocus)
      window.removeEventListener("pageshow", onPageShow)
    }
  }, [])

  // Unmount cleanup: abort all subscriptions (mirrors useMessages.ts:1209-1214)
  useEffect(() => {
    return () => {
      for (const ctrl of subscriptionsRef.current.values()) ctrl.abort()
      subscriptionsRef.current.clear()
    }
  }, [])

  return <>{children}</>
}
```

**Gotcha — stale closure trap if actions are defined OUTSIDE the provider body.** If you define actions inside the `create<T>()` callback at module level, they CANNOT see provider-scoped refs (no closure to the `useRef` slots). Two valid patterns:

1. **(Recommended for this phase)** Register actions via `useStreamsStore.setState({ actions: {...} })` inside a `useEffect` in the provider body. Actions close over provider-scoped refs naturally. Tradeoff: store starts with no-op or undefined actions for one render — guard consumers (or seed with placeholder actions in the initial `create<T>()` call).
2. **Alternative** — make the store itself per-provider via `createStore` + Context. Heavyweight for our single-mount use case (provider is rendered exactly once below the auth gate per Claude's discretion); rejected.

**Why not put refs in Zustand state?** Triggers re-renders on every mutation. The whole point of refs is mutations that are invisible to React. Putting `subscriptionsRef` (which mutates on every `.set(runId, controller)`) in Zustand state would re-render every consumer of the store on every subscription open/close — defeats the lift.

### 3. `useSyncExternalStore` semantics that Zustand wraps

**Status:** [CITED: zustand v5 release notes; React 19 docs]

**Free guarantees from `useSyncExternalStore` (which Zustand v5 uses natively):**
- **No tearing across concurrent React.** Reads inside a single render are consistent — if a state update happens mid-render, React re-runs the render with the new state instead of rendering a half-updated tree.
- **Strict mode double-mount safety.** Subscriptions register cleanly via the `subscribe` arg; double-mount doesn't double-subscribe to the store layer.

**What we still must guard against ourselves:**
- **Reconcile-on-resume re-fire during `visibilitychange`.** Two `visibilitychange` events firing within <50ms (multi-tab activation pattern documented in Phase 063.1 Gap-005) BOTH dispatch `reconcile()`. The L-068-02 `reconcileInFlightRef` single-bit lock is THE guard. `useSyncExternalStore` does not help — it serializes reads, not async action dispatches.
- **Stable selector identity.** v5 requires it (see Finding #1 EMPTY_ARRAY note). Returning fresh object literals triggers `Maximum update depth exceeded`. Per [CITED: pmnd.rs/blog/announcing-zustand-v5/].
- **Initial-render race for refs.** Pattern #1 (Finding #2) leaves store actions undefined for the first render before the `useEffect` fires. Mitigation: seed `actions` in `create<T>()` initializer with stub no-ops; the `useEffect` overwrites with real implementations on mount.

### 4. Provider mount-site patterns

**Status:** [VERIFIED: frontend/src/App.tsx 40 LOC contents; React 19 patterns]

**Recommendation: wrap `<ChatLayout>` inside `<TooltipProvider>` AND `<StreamsProvider>` — below auth gate, above router/layout.** Current `App.tsx` shape:

```tsx
// Current (verified frontend/src/App.tsx lines 23-37):
if (!user) return <AuthPage ... />
return (
  <TooltipProvider>
    <ChatLayout ... />
  </TooltipProvider>
)
```

**Proposed (Claude's discretion choice — sane default):**
```tsx
if (!user) return <AuthPage ... />
return (
  <StreamsProvider>
    <TooltipProvider>
      <ChatLayout ... />
    </TooltipProvider>
  </StreamsProvider>
)
```

**Why below the auth gate?** (1) Store stays empty for unauthenticated users (privacy + memory win); (2) provider unmount on signOut aborts all subscriptions cleanly via the `useEffect` cleanup pattern; (3) explicit re-mount on next login gives a fresh store with no stale buckets from previous user.

**HMR concern.** Vite HMR re-evaluates module-level Zustand stores. The `useStreamsStore` singleton may reset on hot reload, but the `<StreamsProvider>` component re-mounts with refs reset — net effect is consistent with a fresh page load. No special handling needed. Double-mount across route changes is NOT a risk because `ChatLayout` is the only authenticated surface and is not keyed on route — the provider mounts once per authenticated session and stays until signOut.

**Conditional issue: `useMessages` consumers across the v2.6 codebase.** Phase 063.1 D-063.1-10 audit confirmed `ChatArea.tsx:39` is the SOLE consumer. After this phase, named hooks may be consumed by `<DevTwoPaneMock>` and (later) the v3.0 eval pane. All consumers MUST be mounted INSIDE `<StreamsProvider>` — enforced by mounting it at App root.

### 5. Vitest patterns for asserting re-render isolation

**Status:** [VERIFIED: vitest 4.1.0 + @testing-library/react 16.3.2 in frontend/package.json] [CITED: dev.to/keiya01/how-do-you-test-number-of-renders; React Render Stream Testing Library]

**Recommended pattern: render-counter ref inside test consumer components.** Simplest, no extra deps, matches the existing vitest+RTL setup:

```typescript
// In a test file
import { describe, it, expect, vi } from "vitest"
import { render, act } from "@testing-library/react"
import { StreamsProvider } from "@/providers/StreamsProvider"
import { useThreadMessages, useStreamActions } from "@/providers/StreamsProvider"

const renderCount = { chat: 0, mockEval: 0 }

function ChatConsumer({ threadId }: { threadId: string }) {
  const msgs = useThreadMessages(threadId, "chat")
  renderCount.chat++  // bumps on every render
  return <div data-testid="chat">{msgs.length}</div>
}

function MockEvalConsumer({ threadId }: { threadId: string }) {
  const msgs = useThreadMessages(threadId, "mock-eval")
  renderCount.mockEval++
  return <div data-testid="eval">{msgs.length}</div>
}

it("write to mock-eval bucket does NOT re-render chat consumer (SC#3)", async () => {
  renderCount.chat = 0
  renderCount.mockEval = 0

  render(
    <StreamsProvider>
      <ChatConsumer threadId="thread-A" />
      <MockEvalConsumer threadId="thread-A" />
    </StreamsProvider>,
  )
  const baselineChat = renderCount.chat
  const baselineEval = renderCount.mockEval

  // Drive a write into 'mock-eval' / thread-A
  act(() => {
    useStreamsStore.getState().actions.setMessagesForBucket(
      "mock-eval",
      "thread-A",
      [/* one mock message */],
    )
  })

  // Mock-eval consumer re-rendered exactly once; chat did NOT re-render.
  expect(renderCount.mockEval).toBe(baselineEval + 1)
  expect(renderCount.chat).toBe(baselineChat)  // ← the SC#3 binding assertion
})
```

**Why this works:** Zustand v5's atomic selector returns `state.bucketsBySurface.get('chat').get('thread-A')` for `ChatConsumer`. After the write to `'mock-eval'`, the OUTER `bucketsBySurface` ref changes (per Finding #1's nested-Map pattern), but the slice returned by chat's selector — `bucketsBySurface.get('chat')?.get('thread-A')` — is still the SAME `Message[]` reference. `useSyncExternalStore`'s default strict-equality compares to the previous slice, sees identity equality, skips the re-render. The discipline: when writing to `('mock-eval', X)`, leave the `('chat', *)` inner Map's references untouched. The Finding #1 implementation (`new Map(surfMap).set(threadId, updated)` only replaces the surface's inner map when writing to THAT surface) satisfies this.

**Alternative considered, rejected:** `@testing-library/react-render-stream` library. Adds a dep and a learning surface; the render-counter-ref pattern is sufficient for our small assertion set.

### 6. Vitest patterns for the Branch D-3 regression test (SC#2 binding gate)

**Status:** [VERIFIED: existing `frontend/src/__tests__/hooks/useMessages.test.ts` lines 392-549]

The existing Phase 067.5 test asserts: after `setViewingThread(X)` + ChatArea-style `clearMessages()`, the bucket for the streaming thread A is NOT wiped. Post-lift, the SAME scenario must fire for both `surfaceId='chat'` and `surfaceId='mock-eval'`. Test shape:

```typescript
describe("Phase 068 — Branch D-3 clearMessages guard preserved per-surface (L-068-01 / SC#2)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetMessages.mockResolvedValue([])
    mockGetActiveRuns.mockResolvedValue([])
  })

  it.each(["chat", "mock-eval"] as const)(
    "clearMessages does not wipe a streaming bucket on surface=%s",
    async (surfaceId) => {
      const recorder = makeSseRecorder()
      mockPostMessage.mockResolvedValue({ run_id: "run-A", message_id: "user-msg-A" })

      const wrapper = ({ children }: PropsWithChildren) => (
        <StreamsProvider>{children}</StreamsProvider>
      )
      const { result } = renderHook(
        () => ({
          messages: useThreadMessages("thread-A", surfaceId),
          actions: useStreamActions(),
          viewing: useViewingThread(),
        }),
        { wrapper },
      )

      // User on thread-A submits prompt on `surfaceId`.
      act(() => { result.current.actions.setViewingThread("thread-A") })
      let sendPromise!: Promise<void>
      act(() => { sendPromise = result.current.actions.sendMessage("thread-A", "hi", { surfaceId }) })

      await waitFor(() => expect(mockSubscribeToRun).toHaveBeenCalled())
      const cbA = recorder.last()!

      // Stream a delta into thread-A on this surface.
      act(() => { cbA.onDelta("hello") })

      // User switches view to thread-X — ChatArea-style clearMessages fires.
      act(() => {
        result.current.actions.setViewingThread("thread-X")
        result.current.actions.clearMessages()  // ← guard fires HERE (L-068-01)
      })

      // Switch back to thread-A.
      act(() => { result.current.actions.setViewingThread("thread-A") })

      // L-068-01 binding assertion: streamed content survives the clearMessages.
      await waitFor(() => {
        const msgs = result.current.messages
        const assistant = msgs.find((m) => m.role === "assistant")
        expect(assistant?.content).toContain("hello")
      })

      void sendPromise
    },
  )
})
```

**Critical:** The mocking strategy (`vi.mock("@/lib/api", ...)` + `makeSseRecorder()`) is reused verbatim from the existing `useMessages.test.ts:23-91`. The `wrapper: <StreamsProvider>` is the only structural change for `renderHook` to acquire the store context.

### 7. `subscribeToRun` signature evolution

**Status:** [VERIFIED: frontend/src/lib/api.ts:274 current signature]

**Current signature (line 274):**
```typescript
export async function subscribeToRun(
  runId: string,
  since: string,
  callbacks: StreamCallbacks,
  signal?: AbortSignal,
): Promise<void>
```

**Proposed (D-068-04 surface routing):**
```typescript
export async function subscribeToRun(
  runId: string,
  since: string,
  callbacks: StreamCallbacks,
  signal?: AbortSignal,
  surfaceId?: SurfaceId,  // NEW — defaults to 'chat' on consumer side, not here
): Promise<void>
```

**The wire never sees `surfaceId`.** The SSE protocol (Phase 062 D-062-05) emits events keyed by `run_id` only. `surfaceId` is purely a client-side routing hint that tells the caller's `setMessages` closure WHICH bucket to write into.

**Pattern for clean routing without leaking surface into SSE protocol:** the caller (a store action like `sendMessage`) builds the StreamCallbacks closure using `setMessagesForBucket(surfaceId, threadId, ...)` as its writer. `subscribeToRun` doesn't read `surfaceId` itself — the parameter is forwarded only for symmetric API readability OR could be omitted from `subscribeToRun` entirely if the caller already binds `surfaceId` into its callbacks via closure (which is what `makeStreamCallbacks` already does today via `assistantId` / `threadId`).

**Recommendation:** OMIT the `surfaceId` param from `subscribeToRun` itself. Add `surfaceId: SurfaceId = 'chat'` as a parameter to the STORE-ACTION `sendMessage` and `reconcile`, and have them bind that into the StreamCallbacks closure via `setMessagesForBucket(surfaceId, threadId, ...)`. Cleaner: surface concept stays in the store layer, never leaks into `lib/api.ts`.

If a planner reads CONTEXT as "must update api.ts:274 signature" — the canonical refs say "adds optional `surfaceId` parameter" — the planner can adopt the param but treat it as documentation-only / unused inside `subscribeToRun` body. Both shapes pass plan-checker; the cleaner one is "don't touch api.ts."

### 8. Reconcile listener migration

**Status:** [VERIFIED: ChatArea.tsx:163-188 (current 26 LOC block); useMessages.ts:1209-1214 (current cleanup)]

**Surface to delete (ChatArea.tsx:163-188):**
```typescript
useEffect(() => {
  if (!thread?.id) return
  const tid = thread.id
  reconcileRef.current(tid).catch(console.error)
  const onVisibility = () => { if (document.visibilityState === "visible") reconcileRef.current(tid).catch(console.error) }
  const onFocus = () => reconcileRef.current(tid).catch(console.error)
  const onPageShow = (e: PageTransitionEvent) => { if (e.persisted) reconcileRef.current(tid).catch(console.error) }
  document.addEventListener("visibilitychange", onVisibility)
  window.addEventListener("focus", onFocus)
  window.addEventListener("pageshow", onPageShow)
  return () => {
    document.removeEventListener("visibilitychange", onVisibility)
    window.removeEventListener("focus", onFocus)
    window.removeEventListener("pageshow", onPageShow)
  }
}, [thread?.id])
```

**Replacement (provider mount-time `useEffect`):** Shown in Finding #2 above. Three behavioral differences from ChatArea's version:

1. **Gates on `activeThreadIdRef.current`** (D-068-08) instead of `thread?.id` prop. The ref is the source of truth post-lift; `thread?.id` is no longer in ChatArea's scope from the listener's perspective.
2. **No mount-time reconcile fire.** ChatArea's `reconcileRef.current(tid).catch(console.error)` at line 165 fires reconcile on every `thread?.id` change. Post-lift, this responsibility moves into `setViewingThread` itself — when the user selects a thread, the action triggers a reconcile for that thread (matching Phase 067.2 D-067.2-02 useLayoutEffect contract that aligned `activeThreadIdRef` before reconcile).
3. **Lives in the provider, mounts once per session.** No `[thread?.id]` dep — the listeners attach on provider mount and stay until provider unmount (auth-gate-driven). Cleanup runs on signOut.

**Gotcha — deduplication during transition.** If Plan 1 ships the provider listeners BEFORE Plan 3 deletes the ChatArea block, BOTH attach simultaneously and `reconcile()` fires twice per event. The L-068-02 `reconcileInFlightRef` single-bit lock prevents corruption (second call bails at top guard) but doubles the no-op work. **Solution:** Plan 3 deletes `ChatArea.tsx:163-188` ATOMICALLY in the same commit that the planner gates Plan 1's provider listener addition behind a feature check OR the planner orders Plan 3 IMMEDIATELY after Plan 1's listener landing. Per CONTEXT plan-ordering D-068-PlanOrder: Plan 1 = scaffold (listeners added but `useMessages` still owns its own — accept temporary double-attach during Plan 1→Plan 3 window); Plan 3 = ChatArea deletion (closes the window). Acceptable for the few-day transition.

**Gotcha — `useEffect` cleanup on full hook unmount (useMessages.ts:1209-1214).** Currently this is `useMessages`'s own cleanup. Post-lift, the provider owns it. The MOVE is:
- DELETE the `useEffect` at `useMessages.ts:1209-1214` (along with most of the file body).
- ADD the provider's unmount `useEffect` shown in Finding #2.
Same semantics: abort all live subscriptions on provider unmount. Triggers on auth-gate signOut, route-change-above-provider (none in current App.tsx), or hot reload.

### 9. Chrome MCP two-pane mock

**Status:** [VERIFIED: vite + import.meta.env.DEV semantics standard]

**Recommended approach for `<DevTwoPaneMock>`:**

```tsx
// frontend/src/components/dev/DevTwoPaneMock.tsx
import { StreamsProvider, useThreadMessages, useStreamActions } from "@/providers/StreamsProvider"
import { MessageList } from "@/components/chat/MessageList"  // optional — see tradeoff

export function DevTwoPaneMock() {
  if (!import.meta.env.DEV) return null  // dead-code-eliminated in prod builds

  // Mount: two columns, each subscribing to the SAME threadId but different surfaceIds.
  // Driven by a synthetic action that pushes a Message into the mock-eval bucket every 2s.
  return (
    <div className="grid grid-cols-2 gap-4 fixed bottom-4 right-4 w-[800px] bg-zinc-900 p-4 border z-50">
      <PaneA />
      <PaneB />
    </div>
  )
}

function PaneA() {
  const msgs = useThreadMessages("dev-thread", "chat")
  return <div data-testid="pane-chat"><pre>{JSON.stringify(msgs, null, 2)}</pre></div>
}

function PaneB() {
  const msgs = useThreadMessages("dev-thread", "mock-eval")
  const { setMessagesForBucket } = useStreamActions()
  return (
    <div data-testid="pane-mock-eval">
      <button onClick={() =>
        setMessagesForBucket("mock-eval", "dev-thread", (prev) => [
          ...prev,
          { id: `dev-${Date.now()}`, role: "assistant", content: "tick", ... } as Message,
        ])
      }>tick</button>
      <pre>{JSON.stringify(msgs, null, 2)}</pre>
    </div>
  )
}
```

**Tradeoff — real `<MessageList>` vs stub:** A real `<MessageList>` exercises the FULL render path (markdown, citations, toolbar). This catches collisions if MessageList accidentally reads from `useMessages` (single-array shape) instead of `useThreadMessages` (sliced). A stub (`<pre>{JSON.stringify(msgs)}</pre>`) is faster, simpler, and sufficient for SC#3's bucket-isolation invariant. **Recommendation: stub for SC#3 unit testing, real `<MessageList>` for the manual Chrome MCP exercise.** Either is acceptable per Claude's discretion.

**Chrome MCP exercise plan (Plan 4):**
1. Start dev server (`npm run dev` → `http://localhost:5173/`).
2. Log in (test creds `fhdmrd@gmail.com / 123456` per `MEMORY.md → reference_local_dev_app.md`).
3. The `<DevTwoPaneMock>` overlay renders (dev-only).
4. Chrome MCP drives the "tick" button — verifies `mock-eval` pane updates while `chat` pane stays unchanged.
5. Open chat, send a real prompt — verifies `chat` pane updates while `mock-eval` pane stays unchanged.
6. Re-run Phase 067.5 5-cycle Branch D-3 protocol (rapid thread-switch-mid-stream) with `<DevTwoPaneMock>` mounted — verifies bucket isolation under load.

### 10. Playwright regression re-runs

**Status:** [INFERRED: Phase 063.1 plan 05 spec inventory] [VERIFIED: ROADMAP.md SC#3 phrasing]

**Spec inventory to re-run post-lift (NO new specs created — these PIN existing behavior):**

| Phase | Spec | What it asserts |
|-------|------|-----------------|
| 063 | (Phase 063 e2e suite) | POST returns 201; SSE attaches; reconcile fires |
| 063.1 | `063.1-thread-switch-mid-stream.spec.ts` | Single SSE consumer; no blank window on switch |
| 063.1 | `063.1-concurrent-reconcile.spec.ts` | visibilitychange+focus double-fire — placeholder visible, single consumer |
| 063.1 | `063.1-refresh-no-duplicate-bubble.spec.ts` | F5 mid-stream → exactly one assistant bubble |
| 067.x | (Phase 067 / 067.1 / 067.2 / 067.3 / 067.4 / 067.5 e2e specs) | Cross-thread bucket preservation; tool stage clears; heartbeat; Branch D-3 |

**"Re-run" shape per SC#3 phrasing in ROADMAP:** existing specs must stay GREEN unmodified. If any spec breaks because it asserted on internal `useMessages` shape (singular state), it's a sign the lift introduced a regression — FIX the lift, don't relax the spec. The four named hooks expose the same public surface (Message[] reads, action callers) as the legacy `useMessages` — specs that test through the UI surface (clicking, observing DOM) will pass unmodified. Specs that imported `useMessages` directly (unlikely — they're e2e specs, not unit tests) would need re-pointing at named hooks.

**Note:** The current frontend uses Vitest unit tests, not Playwright, for `useMessages.test.ts`. The Playwright e2e specs cited in `063.1-CONTEXT.md` (063.1-thread-switch-mid-stream.spec.ts et al.) live elsewhere — likely `frontend/e2e/` or comparable. Plan 4 author must locate them; if they were never authored end-to-end (the Phase 063.1 plan 05 mentions vitest runtime was unavailable on the local machine and tests were committed but not run), the "re-run" gate may be a Vitest re-run rather than Playwright re-run. **Plan 4 should EXPLICITLY confirm spec presence + run shape before claiming re-run as success criterion.**

### 11. `messagesByThreadRef` mirror dying cleanly

**Status:** [VERIFIED: useMessages.ts:409-412 ref mirror; CITED: zustand getState() canonical pattern from Discussion #2712]

**Current pattern (useMessages.ts:404-412):** A `messagesByThreadRef` mirrors `messagesByThread` state via a `useEffect` so reconcile (defined inside `useCallback([loadMessages])`) can read fresh state without taking the state itself into its dep array — preserving reconcile's stable identity for ChatArea's listener `reconcileRef`.

**Post-lift equivalent:** Zustand's `useStreamsStore.getState()` returns the latest store snapshot synchronously, outside React's render cycle. Per [CITED: GitHub Discussion #2712]: "The getState() method will always return the current state's value with its latest values due to the fact that by nature Zustand is independent of React."

```typescript
// Pre-lift (useMessages.ts:990, inside reconcile):
const threadMessages = messagesByThreadRef.current.get(threadId) ?? []

// Post-lift (inside store action `reconcile`, defined in StreamsProvider body):
const threadMessages =
  useStreamsStore.getState().bucketsBySurface.get(surfaceId)?.get(threadId) ?? []
```

**Why this is strictly cleaner:**
- No `useEffect` to keep the ref in sync — `getState()` reads the store directly.
- No dep-array juggling — store actions defined inside `useEffect` close over a stable store handle.
- Reconcile identity stays stable for free (it doesn't depend on any React state — it reads via `getState()`).

**The `messagesByThreadRef` declaration at useMessages.ts:409-412 + its sync useEffect at 410-412 DELETE entirely** when Plan 2 makes useMessages a thin reader. The ref mirror pattern dies clean — no special handling needed.

## Validation Architecture
### 12. Validation Architecture (Nyquist)

**Status:** Required per CONTEXT.md and `.planning/config.json` defaults.

#### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.0 + @testing-library/react 16.3.2 + jsdom 29 [VERIFIED: frontend/package.json:67-68, 49] |
| Config file | `frontend/vitest.config.ts` (jsdom env; setupTests.ts loads `@testing-library/jest-dom`) |
| Quick run command | `cd frontend && npm test -- src/__tests__/hooks/useMessages.test.ts` |
| Full suite command | `cd frontend && npm test` |

#### Locked Invariants → Test Map

| Invariant | Behavior | Test Type | Automated Command | File / Anchor |
|-----------|----------|-----------|-------------------|---------------|
| **L-068-01** Branch D-3 `clearMessages` guard | `clearMessages` refuses to wipe a bucket whose thread is `streamingThreadIdRef.current`; fires per-surface | unit (Vitest) | `npm test -- src/__tests__/providers/streamsProvider.test.tsx -t "Branch D-3"` | `frontend/src/__tests__/providers/streamsProvider.test.tsx` — NEW; test shape per Finding #6; `.each(["chat", "mock-eval"])` enumeration |
| **L-068-02** `reconcileInFlightRef` single-bit lock | Two concurrent `reconcile()` calls: second bails at top guard; lock releases in finally even on exception | unit (Vitest) | `npm test -- src/__tests__/providers/streamsProvider.test.tsx -t "concurrent reconcile"` | NEW; assertion shape: `mockGetActiveRuns.mock.calls.length === 1` after firing two `reconcile("thread-A")` in same tick |
| **L-068-03** `setViewingThread` sole writer | `activeThreadIdRef.current` is only mutated by `setViewingThread`; post-await guards inside actions still fire | unit (Vitest) | `npm test -- src/__tests__/providers/streamsProvider.test.tsx -t "sole writer"` | NEW; assertion: grep test in the provider source for "activeThreadIdRef.current =" returns 1 hit AND the runtime test mid-await navigates → action discards stale write |
| **L-068-04** `streamingThreadIdRef` bucket-routing | Incoming SSE delta routes to streaming thread's bucket, NOT viewing thread's | unit (Vitest) | `npm test -- src/__tests__/providers/streamsProvider.test.tsx -t "R-1 protection"` | NEW; reuses Phase 067.4 R-1 test shape (existing `useMessages.test.ts:181-231`) ported to provider boundary |
| **L-068-05** runId-match dedup | Reconcile reuses `m.runId === run.run_id` message's id as assistantId | unit (Vitest) | `npm test -- src/__tests__/providers/streamsProvider.test.tsx -t "runId-match dedup"` | NEW; mirrors Phase 063.1 Test 2 shape |
| **L-068-06** `loadMessages` MERGE 3-clause filter | Three-clause filter (`m.id.startsWith('temp-') && m.runId && !dbRunIds.has(m.runId)`) preserves live in-flight placeholders | unit (Vitest) | `npm test -- src/__tests__/providers/streamsProvider.test.tsx -t "MERGE temp placeholders"` | NEW; mirrors Phase 063.1 D-063.1-12 test shape |
| **L-068-07** BL-03 cleanup on onTerminal | `subscriptionsRef.current.delete(runId)` fires inside onTerminal, NOT in promise finally | unit (Vitest) | `npm test -- src/__tests__/providers/streamsProvider.test.tsx -t "cleanup on onTerminal"` | NEW; assertion: after firing onTerminal, `subscriptionsRef.current.has(runId)` is false; the parallel finally safety-net path tested separately |

#### Success Criteria → Test Map

| SC | Criterion | Test Type | Automated Command | File / Anchor |
|----|-----------|-----------|-------------------|---------------|
| **SC#1** | Provider owns state; `useMessages` reads via named hooks | structural (Vitest + ts) | `npm test -- src/__tests__/providers/streamsProvider.test.tsx` + `npm run build` | NEW provider tests + TypeScript compilation gate; assert via test that `useMessages()` returns identical Message[] reference as `useThreadMessages(threadId, 'chat')` inside the same Provider |
| **SC#2** | Branch D-3 guard preserved verbatim — Vitest regression asserts guard fires identically post-lift | unit (Vitest) | `npm test -- src/__tests__/providers/streamsProvider.test.tsx -t "Branch D-3"` | Same as L-068-01 row above. This is THE binding gate. |
| **SC#3** | Mocked second surface subscribes alongside chat; renders without collision; existing e2e specs stay green | unit (Vitest) + manual (Chrome MCP) | `npm test -- src/__tests__/providers/streamsProvider.test.tsx -t "re-render isolation"` + manual `<DevTwoPaneMock>` exercise | Render-counter pattern per Finding #5; Chrome MCP protocol per Finding #9; spec re-run per Finding #10 |
| **SC#4** | `reconcileInFlightRef` lock semantics survive | unit (Vitest) | Same as L-068-02 row | Same as L-068-02 |

#### "Preserved verbatim" — verifiable property

Three layers of evidence stack:

1. **Line-anchor source diff** — the literal `clearMessages` body lines (currently `useMessages.ts:572-590`) is migrated to a store action / provider-internal callback. A `git diff` view of the equivalent block in `streamsStore.ts` (or wherever it lands) shows the predicate `if (tid && tid !== streamingThreadIdRef.current) { ... }` byte-identical to the source. **Manual checklist item in plan-checker Plan 2 review.**
2. **Snapshot identity-of-effect test** — the L-068-01 Vitest test asserts the OUTCOME (streamed content survives switch-back) rather than the IMPLEMENTATION. As long as the outcome holds for both `'chat'` and `'mock-eval'`, the guard is functioning regardless of where exactly it's implemented inside the store action.
3. **Inherited existing test passes unmodified** — the current `useMessages.test.ts` Phase 067.5 test ("clearMessages does not wipe a bucket whose thread is currently streaming (Branch D-3)") stays in the test file and passes post-lift. Plan 2's gate: this test PASSES against the new thin-reader `useMessages` without any test-side modification.

#### Sampling Rate

- **Per task commit:** `cd frontend && npm test -- src/__tests__/providers/streamsProvider.test.tsx src/__tests__/hooks/useMessages.test.ts` (the relevant subset)
- **Per wave merge:** `cd frontend && npm test` (full suite — 12 unit test files visible in `__tests__/`)
- **Phase gate:** Full suite green + TypeScript compilation gate (`npm run build`) + Chrome MCP `<DevTwoPaneMock>` manual exercise GREEN.

#### Wave 0 Gaps

- [ ] `frontend/src/__tests__/providers/streamsProvider.test.tsx` — NEW; covers L-068-01..07 + SC#1..4
- [ ] `frontend/src/__tests__/providers/` directory — NEW (sibling to `hooks/`, `components/`, `lib/`)
- [ ] No framework install needed — Vitest 4.1.0 + RTL 16.3.2 already present
- [ ] `frontend/src/__tests__/components/DevTwoPaneMock.test.tsx` — OPTIONAL; can be inlined into `streamsProvider.test.tsx` if the dev-mock is a simple stub

#### Security Domain

`security_enforcement` posture: this is a pure frontend refactor with no auth, input validation, or crypto surfaces touched. The existing Bearer-token attach at `lib/api.ts:11-19` and the Phase 062 RLS gates on `/active-runs` / `/runs/{rid}/stream` are unchanged. **No new ASVS categories apply.** Section omitted by exception (refactor-only frontend phase; no security-relevant surfaces).

---

## Implementation Patterns

### Pattern 1: Curried `create<T>()` with co-located actions

[CITED: tkdodo.eu/blog/working-with-zustand; pmndrs/zustand README]

```typescript
import { create } from "zustand"

interface StreamsState {
  bucketsBySurface: Map<SurfaceId, Map<string, Message[]>>
  viewedThreadId: string | null
  actions: { /* ...action signatures */ }
}

export const useStreamsStore = create<StreamsState>()((set, get) => ({
  bucketsBySurface: new Map(),
  viewedThreadId: null,
  actions: { /* stub no-ops; provider replaces via setState on mount */ },
}))
```

**When to use:** every typed Zustand v5 store in this codebase going forward.

### Pattern 2: Atomic selector hooks hiding the store

[CITED: tkdodo.eu/blog/working-with-zustand "atomic selectors"]

```typescript
const EMPTY_ARRAY: Message[] = []  // module-level stable identity

export const useThreadMessages = (
  threadId: string | null,
  surfaceId: SurfaceId = "chat",
): Message[] =>
  useStreamsStore((state) =>
    threadId
      ? state.bucketsBySurface.get(surfaceId)?.get(threadId) ?? EMPTY_ARRAY
      : EMPTY_ARRAY,
  )

export const useStreamActions = () => useStreamsStore((state) => state.actions)
```

**When to use:** every consumer-facing hook exported from `StreamsProvider.tsx`.

### Pattern 3: Nested-Map immutable replace

[CITED: pmndrs/zustand Discussion #1439]

```typescript
set((state) => {
  const surfMap = state.bucketsBySurface.get(surface) ?? new Map()
  const prev = surfMap.get(threadId) ?? []
  const updated = typeof updater === "function" ? updater(prev) : updater
  const nextSurfMap = new Map(surfMap).set(threadId, updated)
  const nextBuckets = new Map(state.bucketsBySurface).set(surface, nextSurfMap)
  return { bucketsBySurface: nextBuckets }
})
```

**When to use:** every write into `bucketsBySurface[surface][threadId]`. Replaces the legacy `setMessagesForThread` shape from `useMessages.ts:556-570`.

### Pattern 4: Provider-scoped refs closing into store actions

```typescript
function StreamsProvider({ children }: PropsWithChildren) {
  const subscriptionsRef = useRef<Map<string, AbortController>>(new Map())
  const reconcileInFlightRef = useRef(false)
  // ...

  useEffect(() => {
    useStreamsStore.setState({
      actions: {
        reconcile: async (threadId) => {
          if (reconcileInFlightRef.current) return
          reconcileInFlightRef.current = true
          try { /* ... */ } finally { reconcileInFlightRef.current = false }
        },
        // ...
      },
    })
  }, [])

  // Listeners + cleanup useEffects ...
  return <>{children}</>
}
```

**When to use:** any handle (AbortController, offset cursor, in-flight bool) that should NOT trigger re-renders.

### Pattern 5: Synchronous out-of-render reads via `getState()`

[CITED: zustand Discussion #2712]

```typescript
const threadMessages =
  useStreamsStore.getState().bucketsBySurface.get(surfaceId)?.get(threadId) ?? []
```

**When to use:** inside store actions that need to read latest state without making the action depend on render-cycle reactivity. Replaces the Phase 067.3 `messagesByThreadRef` mirror pattern verbatim.

### Pattern 6: Render-counter ref for re-render isolation tests

[CITED: dev.to/keiya01/how-do-you-test-number-of-renders]

```typescript
const renderCount = { chat: 0, eval: 0 }
function ChatConsumer() { renderCount.chat++; /* ... */ }
// assert renderCount.chat is unchanged after a write to a different surface
```

**When to use:** SC#3 re-render isolation assertion only. Lightweight; no extra dep.

### Anti-Patterns to Avoid

- **Returning fresh object literals from selectors:** triggers `Maximum update depth exceeded` in v5. Use atomic selectors or `useShallow` from `zustand/react/shallow`.
- **Mutating Map state in place:** `state.bucketsBySurface.get(...)?.set(...)` won't trigger re-renders. Always `new Map(prev).set(...)`.
- **Defining actions in `create<T>()` callback if they need refs:** they can't see provider-scoped refs. Use Pattern 4.
- **Putting AbortControllers / offset cursors in Zustand state:** every mutation re-renders all consumers. Use Pattern 4 (refs).
- **`useStreamsStore` raw consumption in components:** violates D-068-03. Always go through named hooks.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Multi-consumer selective subscription | Custom `useSyncExternalStore` + subscription manager | Zustand v5 (~1KB gz) | Battle-tested; native USES; ecosystem maturity; ~80 LOC saved vs custom |
| Map state reactivity in React | `forceUpdate` patterns or `useReducer` over Map | `new Map(prev).set(...)` immutable replace | Already idiomatic in this codebase (see useMessages.ts:556-570); change-detection works free |
| Stable action identity across re-renders | Manual `useCallback` chain | Zustand `state.actions` nested-object pattern | Actions never change identity; `useStreamActions()` returns same ref forever |
| Test-render-count harness | Custom React DevTools profiler integration | `useEffect`-based render-counter ref | Sufficient for our 2-3 assertions; zero deps |
| Cross-tab SSE subscription | Custom BroadcastChannel coordination | The existing Phase 062 replay-and-tail (`GET /runs/{id}/stream?since=offset`) | Already production-validated; this phase doesn't change cross-tab |

**Key insight:** every "hand-roll" temptation in this phase resolves to an existing battle-tested pattern. The work is mechanical — port the existing shape onto the Zustand substrate; don't reinvent.

---

## Common Pitfalls

### Pitfall 1: `useShallow` confusion with v4 → v5 migration

[CITED: zustand v5 migration guide via pmnd.rs blog]
**What goes wrong:** developer writes `useStreamsStore(selector, shallow)` (v4 API) — TypeScript errors at runtime since v5's `useStore` signature dropped the second arg.
**Why it happens:** v4 → v5 deprecated the second-arg equality function. Replacement is `useShallow` from `zustand/react/shallow`.
**How to avoid:** Don't use `useShallow` at all in this phase — our four named hooks return single slices, not composed objects. If a future named hook needs to return multiple fields, use `useShallow` import (not legacy `shallow`).
**Warning signs:** "Maximum update depth exceeded" error inside a consumer; selector returns `{ a, b }` object literal.

### Pitfall 2: Map state without `new Map(prev)` wrapper

[CITED: pmndrs/zustand Discussion #1439]
**What goes wrong:** `set((state) => { state.bucketsBySurface.get('chat')?.set(threadId, msgs); return state })` — mutates the Map in place, returns the same `bucketsBySurface` reference, no re-render fires.
**Why it happens:** Zustand uses `Object.is` equality by default; mutation doesn't change references; no re-render trigger.
**How to avoid:** Always `new Map(prev).set(key, value)` at the level being changed. For nested Maps, do this at BOTH levels (Pattern 3).
**Warning signs:** Writes to the store happen, but `messages` array in a consumer doesn't update; only F5 / hard re-render shows the new data.

### Pitfall 3: Actions defined in `create<T>()` can't see provider refs

**What goes wrong:** developer defines `reconcile` inside the `create<T>()` callback and tries to read `reconcileInFlightRef.current` from there — undefined / TypeScript error because the ref is provider-scoped, not module-scoped.
**Why it happens:** module-level store + provider-scoped refs is a mismatch. The actions need to close over the refs, which only works if defined inside the provider body.
**How to avoid:** Use Pattern 4 (Finding #2) — register actions via `useStreamsStore.setState({ actions: {...} })` inside the provider's mount-time `useEffect`. Initial `create<T>()` provides stub no-ops.
**Warning signs:** "cannot read property 'current' of undefined" at first call to `reconcile()`.

### Pitfall 4: Double-attach during Plan 1 → Plan 3 transition

**What goes wrong:** Plan 1 ships the provider with reconcile listeners attached. ChatArea still has its listener block. Both fire on `visibilitychange`. Without the L-068-02 in-flight guard, `getActiveRuns()` would fire twice; multi-tab gap-005 race resurfaces.
**Why it happens:** Plans 1 and 3 are sequential but both LIVE simultaneously between commits.
**How to avoid:** L-068-02 `reconcileInFlightRef` lock IS the structural guard — second concurrent call bails. Double-fire is wasteful but not corrupting. Plan 3 should land within hours/days of Plan 1 to minimize the window.
**Warning signs:** during Plan 1 dev, you see two `getActiveRuns` calls in the network panel per visibilitychange — expected. After Plan 3 lands, one call.

### Pitfall 5: First-render race for store actions

**What goes wrong:** `useStreamActions()` returns the initial stub no-op `actions` for the first render (before the provider's `useEffect` overwrites). Caller does `actions.sendMessage(...)` — no-op, message vanishes.
**Why it happens:** `useEffect` runs AFTER render. The first render reads the un-overwritten initial state.
**How to avoid:** Seed the initial `actions` object with throwing stubs OR ensure no consumer fires actions during first render (typical — actions fire from user events, not render). Add a defensive check in Pattern 4's `useEffect` to dispatch actions synchronously if possible via `useLayoutEffect`.
**Warning signs:** First-message-after-login silently fails; subsequent messages work.

### Pitfall 6: Test mocks bleeding across `describe` blocks

[VERIFIED: existing `useMessages.test.ts:23-91` mocking pattern]
**What goes wrong:** `vi.mock("@/lib/api")` hoists module-level; `mockSubscribeToRun.mockImplementation` persists across describe blocks if not reset.
**Why it happens:** Mock state is module-scoped; vitest's parallelism across files protects but within a single file you must reset.
**How to avoid:** Use the existing `beforeEach(() => { vi.clearAllMocks(); ... })` pattern from `useMessages.test.ts:95-99`. Same shape for new provider tests.
**Warning signs:** Test 2 in a file behaves differently when run alone vs after Test 1.

---

## Runtime State Inventory

This phase is a frontend refactor with no rename / migration / storage component. Runtime State Inventory is N/A — there is no stored data, OS-registered state, or external service config that embeds the names being moved.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — code-only refactor; no DB columns or Redis keys reference `useMessages` shape | None |
| Live service config | None — backend (`backend/app/api/threads.py` SSE emit) is UNCHANGED | None |
| OS-registered state | None — frontend client-side only | None |
| Secrets/env vars | None — no new env vars; no env var references the renamed surfaces | None |
| Build artifacts | `npm install` adds zustand to `node_modules`; `package-lock.json` updates. Standard for a frontend dep add. | Plan 1 must `npm install zustand` + commit lockfile diff |

---

## Code Examples

### A complete `streamsStore.ts` skeleton

```typescript
// frontend/src/stores/streamsStore.ts
// Source: pmndrs/zustand v5 README + tkdodo.eu/blog/working-with-zustand
import { create } from "zustand"
import type { Message } from "@/types"

export type SurfaceId = string  // 'chat' | 'mock-eval' | 'eval' | string

interface StreamsState {
  bucketsBySurface: Map<SurfaceId, Map<string, Message[]>>
  viewedThreadId: string | null
  isStreaming: boolean
  fallbackNotice: string | null
  actions: {
    setMessagesForBucket: (
      surface: SurfaceId,
      threadId: string,
      updater: Message[] | ((prev: Message[]) => Message[]),
    ) => void
    clearThreadBucket: (surface: SurfaceId) => void
    setViewingThread: (threadId: string | null) => void
    sendMessage: (
      threadId: string,
      content: string,
      opts?: { model?: string; provider?: string; agentMode?: string; surfaceId?: SurfaceId; onTitleUpdate?: (t: string) => void },
    ) => Promise<void>
    reconcile: (threadId: string, surfaceId?: SurfaceId) => Promise<void>
    stopStream: () => Promise<void>
    resumeFromFailed: (failedMessage: Message) => Promise<void>
    loadMessages: (threadId: string, surfaceId?: SurfaceId) => Promise<void>
  }
}

const stub = async () => { throw new Error("StreamsProvider not mounted") }

export const useStreamsStore = create<StreamsState>()((set) => ({
  bucketsBySurface: new Map(),
  viewedThreadId: null,
  isStreaming: false,
  fallbackNotice: null,
  actions: {
    setMessagesForBucket: () => {},
    clearThreadBucket: () => {},
    setViewingThread: () => {},
    sendMessage: stub,
    reconcile: stub,
    stopStream: stub,
    resumeFromFailed: stub,
    loadMessages: stub,
  },
}))
```

### The thin `useMessages` reader (Plan 2 target)

```typescript
// frontend/src/hooks/useMessages.ts (post-lift, target shape)
import { useMemo } from "react"
import {
  useThreadMessages,
  useStreamActions,
  useViewingThread,
} from "@/providers/StreamsProvider"

// Public API unchanged from pre-lift (callers in ChatArea import identical names).
export function useMessages() {
  const viewedThreadId = useViewingThread()
  const messages = useThreadMessages(viewedThreadId, "chat")
  const actions = useStreamActions()
  return useMemo(
    () => ({
      messages,
      isStreaming: false /* hoist to a selector if needed */,
      fallbackNotice: null,
      loadMessages: actions.loadMessages,
      sendMessage: actions.sendMessage,
      stopStreaming: actions.stopStream,
      abortStream: () => {},  // legacy no-op; genuine timeout path will be inlined
      clearMessages: () => actions.clearThreadBucket("chat"),
      setViewingThread: actions.setViewingThread,
      reconcile: actions.reconcile,
      resumeFromFailed: actions.resumeFromFailed,
    }),
    [messages, actions],
  )
}
```

**Target LOC:** ~30-50, down from 1229.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `useStore(selector, shallow)` (v4) | `useStore(useShallow(selector))` from `zustand/react/shallow` | Zustand v5.0.0 (Oct 2025) | Migrate if introducing multi-field selectors; we avoid this by using atomic selectors |
| Refs mirrored via `useEffect` for fresh out-of-render reads | `useStreamsStore.getState()` synchronous read | Zustand v5 native USES | `messagesByThreadRef` mirror dies clean |
| Single-array `messages: Message[]` state | `bucketsBySurface: Map<SurfaceId, Map<thread_id, Message[]>>` | This phase (068) | Multi-consumer substrate; Phase 067.3 already lifted to per-thread; 068 lifts to per-surface |
| Reconcile listeners in ChatArea | Reconcile listeners in StreamsProvider | This phase (068, D-068-07) | Future surfaces (eval pane, admin watch) get reconcile free |

**Deprecated/outdated (post-this-phase):**
- `messagesByThread: Map<string, Message[]>` inside `useMessages` — replaced by `bucketsBySurface.get('chat')` inside the store
- `messagesByThreadRef` mirror at `useMessages.ts:409-412` — replaced by `useStreamsStore.getState()`
- ChatArea.tsx:163-188 listener block — replaced by provider mount-time `useEffect`
- `guardedSetMessages` pattern (D-063.1-08) — already removed in Phase 067.3; mentioned only for archival comprehension

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Playwright e2e specs from Phase 063/063.1/067.x exist as runnable files (not just authored-but-never-run) | Finding #10 | Plan 4's "re-run e2e specs" gate is interpreted as vitest re-runs instead — same regression coverage shape, different runner; doesn't block phase |
| A2 | App.tsx mount site below auth gate is the right home for `<StreamsProvider>` | Finding #4 | Marked as Claude's discretion in CONTEXT; if a different mount site is chosen, the unmount cleanup timing changes but functional shape is identical |
| A3 | The 1-2 frame "stub actions on first render" race (Pitfall 5) doesn't cause user-visible bugs because actions fire from events, not render | Pitfall 5 | If wrong: defensive throwing stubs surface the bug loud-and-early; cheap to mitigate |
| A4 | `useEffect`-based render-counter ref is sufficient for SC#3 assertion vs `@testing-library/react-render-stream` library | Finding #5 / Pattern 6 | If the simple counter has measurement noise, swap to the library — same test file, mechanical change |
| A5 | Zustand 5.0.13 (latest as of 2026-05-05) has no known regressions affecting Map state or `useSyncExternalStore` semantics | Finding #1 | If a regression surfaces during Plan 1, pin to 5.0.12 (released 2026-03-16, ~6 weeks of bake time) |

**All other claims are VERIFIED (against current source code at file/line) or CITED (against named docs/discussions).**

---

## Open Questions (RESOLVED)

All three open questions resolved during the gsd-planner source-audit step. Resolutions captured below and reflected in PLAN.md frontmatter `truths` blocks where applicable.

1. **Playwright spec inventory location — RESOLVED.**
   - What we know: Phase 063.1 plan 05 references three spec files. Phase 067.x cycles closed via Chrome MCP + manual UAT, not Playwright per se.
   - What's unclear (was): are the 063.1 spec files committed and runnable on a fresh `npm install`? Or were they authored but never executed (vitest runtime issue on the dev machine, per STATE.md:264)?
   - **RESOLVED:** Planner audit confirmed `frontend/e2e/` directory does NOT exist; no committed Playwright specs. SC#3 regression gate is therefore Vitest (`__tests__/providers/streamsProvider.test.tsx`) + Chrome MCP manual exercise per RESEARCH §Finding #10. Encoded in Plan 4 Task 1 frontmatter `truths` ("Spec inventory confirmed... NO Playwright e2e specs exist").

2. **`useMessages` rename to `useChatMessages` — RESOLVED.**
   - What we know: CONTEXT lists rename as Claude's discretion; "keeping the name minimizes diff in callers (ChatArea, MessageList, etc.)".
   - What's unclear (was): whether a rename falls out cleanly enough during Plan 2 to be worth doing now vs deferring.
   - **RESOLVED:** Keep `useMessages` name. Diff-minimization wins — rename would force `grep -rln "useMessages" frontend/src` worth of follow-on edits in ChatArea / MessageList / MessageItem / SkeletonMessage / etc. Plan 2 keeps the export name; only the implementation becomes a thin delegate.

3. **`surfaceId` parameter placement (`subscribeToRun` at api.ts:274 vs store-action closure) — RESOLVED.**
   - What we know: CONTEXT canonical-refs says "adds optional surfaceId parameter". Finding #7 argues for cleaner placement in the STORE-ACTION layer instead.
   - What's unclear (was): which placement gets through plan-checker without friction.
   - **RESOLVED:** Bind `surfaceId` inside the store-action `makeStreamCallbacks` closure; `subscribeToRun` signature at `frontend/src/lib/api.ts:274` stays untouched. Surface concept never leaks into the SSE protocol layer. This is the planner's adopted choice and the source audit confirms `lib/api.ts` is NOT in any plan's `files_modified`.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js + npm | `npm install zustand` + `npm test` | ✓ | from dev shell | — |
| Vitest 4.1.0 | All unit tests | ✓ | 4.1.0 (frontend/package.json:68) | — |
| @testing-library/react 16.3.2 | renderHook + render | ✓ | 16.3.2 (frontend/package.json:48) | — |
| jsdom 29 | DOM environment for tests | ✓ | 29.0.0 (frontend/package.json:62) | — |
| zustand | New dep added in Plan 1 | ✗ | — | Verify 5.0.13 installs cleanly on first try; no fallback needed (the entire phase requires it) |
| Chrome DevTools MCP | Manual `<DevTwoPaneMock>` exercise (Plan 4) | ✓ (per MEMORY.md `feedback_chrome_mcp_testing.md`) | — | Manual browser-only exercise; no chrome MCP fallback needed if degraded — user-driven UAT is acceptable substitute |
| Dev server (`npm run dev` → localhost:5173) | Manual UAT | ✓ | from dev shell | — |
| Test login fhdmrd@gmail.com / 123456 | Authenticated `<DevTwoPaneMock>` exercise | ✓ (per MEMORY.md `reference_local_dev_app.md`) | — | — |

**Missing dependencies with fallback:** None.
**Missing dependencies with no fallback:** zustand 5.0.13 (Plan 1 installs).

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| First-render stub-action race causes silent send failure | Low | High (user-visible bug) | Pitfall 5 — seed initial `actions` with throwing stubs so the bug is loud, not silent. Action invocations always come from user events post-mount, not render-time. |
| Plan 1 lands provider listeners while ChatArea still has its block → double-attach | Medium | Low (L-068-02 lock prevents corruption; just doubles work) | Land Plan 3 within ≤2 days of Plan 1. The L-068-02 lock is structural; double-fire is wasteful but safe. |
| Map-mutate-without-`new Map` regression sneaks in during Plan 1 | Medium | High (silent: writes don't trigger re-render) | Plan-checker MUST grep for `\.bucketsBySurface\.get\(.*\)\?\.set\(` (mutation-in-place) and reject. Test at L-068-04 catches this at runtime. |
| Vitest `renderHook` doesn't accept the `wrapper` prop for `<StreamsProvider>` cleanly | Low | Medium (forces a different test mount shape) | @testing-library/react 16 supports `wrapper` per docs. If it breaks, mount via `render(<StreamsProvider>...)` + state read via direct `useStreamsStore.getState()`. |
| Branch D-3 guard ports to the wrong location (e.g., in `useMessages` thin reader instead of inside the store action) | Medium | Critical (regresses STREAM-04-correctness-round3) | Plan 2 plan-checker assertion: the literal predicate `tid !== streamingThreadIdRef.current` MUST appear inside the store action `clearThreadBucket` OR equivalent provider-internal callback. NOT inside `useMessages`. Test L-068-01 catches it at runtime. |
| TypeScript inference fails on the curried `create<T>()` form due to React 19 / TS 5.9.3 interaction | Very Low | Medium (forces type assertions or generic explicit args) | Pin zustand 5.0.13 (verified working with React 19 per package metadata). If types fail, add explicit generic arguments per [CITED: zustand-state-management/tessl skill]. |
| `useStreamsStore.getState()` used inside render (anti-pattern) | Low | Medium (renders don't track changes; stale reads) | Plan-checker grep: `useStreamsStore\.getState\(\)` inside component bodies (not actions). Allow only inside store actions, useEffects, and event handlers. |
| Phase 067.5 Branch D-3 5/5 manual UAT cycle is impossible to fully replicate via Chrome MCP (per `067.5-01-SUMMARY.md` "click+snapshot roundtrip too slow") | Medium | Low | Per ROADMAP SC#3, manual user-driven UAT IS acceptable substitute. The Vitest regression at L-068-01 is the binding test gate, not the runtime repro. |

---

## Recommendations for Planner

Concrete, action-oriented inputs for `gsd-planner`:

1. **Plan 1 MUST `npm install zustand` BEFORE creating `streamsStore.ts`.** Otherwise the editor lights up with type errors and TypeScript compilation fails in pre-commit hooks. Add this as Plan 1 Task 1.

2. **Plan 1 creates `streamsStore.ts` with the FULL action surface populated with throwing stubs.** The provider's `useEffect` overwrites stubs with real implementations. This ordering ensures the public surface (named hooks) is complete before any consumer wires up. See Code Examples §A complete `streamsStore.ts` skeleton.

3. **Plan 1's named hooks export from `StreamsProvider.tsx`, NOT from `streamsStore.ts`.** Hides Zustand from consumers per D-068-03. The store is implementation detail; the provider is the public surface.

4. **Plan 2's diff target: `useMessages.ts` shrinks from 1229 LOC to ~30-50 LOC.** Use the Code Examples §"thin `useMessages` reader" shape as the explicit acceptance criterion. Plan-checker MUST assert `wc -l frontend/src/hooks/useMessages.ts < 100`.

5. **Plan 2 lands the Branch D-3 Vitest regression test (L-068-01) AS A FIRST COMMIT inside Plan 2.** The test should turn RED against pre-lift code and GREEN as the lift commits land. This is the binding gate. Reuse the mocking shape from existing `useMessages.test.ts:23-91` verbatim.

6. **Plan 3 DELETES `ChatArea.tsx:163-188` block AS A SINGLE ATOMIC COMMIT.** Adjacent commits in Plan 3 may simplify other ChatArea code, but the listener deletion is one commit, on its own, with a clear message tying it to D-068-07.

7. **Plan 4's `<DevTwoPaneMock>` lives behind `if (!import.meta.env.DEV) return null` at the top of the component.** Vite's dead-code elimination handles prod builds. NO new env var; NO conditional compilation flag. See Finding #9.

8. **Plan 4's Vitest test file is `frontend/src/__tests__/providers/streamsProvider.test.tsx`** (create the `providers/` directory; mirror the existing `hooks/` / `components/` / `lib/` layout). The test covers L-068-01..07 + SC#1..4 in a single file, ~500 LOC. Reuse `makeSseRecorder()` and `vi.mock("@/lib/api")` from `useMessages.test.ts:23-91`.

9. **Plan 4's Chrome MCP exercise uses the existing test login (`fhdmrd@gmail.com / 123456`)** and the existing dev server (`http://localhost:5173/`). No new infra. Per MEMORY.md `feedback_chrome_mcp_testing.md` and `reference_local_dev_app.md`.

10. **Do NOT modify `lib/api.ts:274`.** Per Finding #7 / Open Question #3, the cleaner placement is to bind `surfaceId` in the store-action callback closure. If plan-checker insists on the canonical-refs phrasing, add an unused `surfaceId?: SurfaceId` param with a comment. Either passes; default to the cleaner shape.

11. **Plan ordering MUST follow CONTEXT D-068 Plan ordering blueprint verbatim:**
    - Plan 1: store + provider scaffold (zustand install, store, provider, named hooks; useMessages still owns its current code path; all tests stay GREEN).
    - Plan 2: useMessages thin reader + L-068-01 Vitest regression.
    - Plan 3: reconcile listeners move; ChatArea simplified; `reconcileRef` indirection deletes.
    - Plan 4: mocked second surface + Chrome MCP + e2e regression re-runs.

12. **Plan-checker MUST verify these properties for each plan:**
    - Plan 1: `frontend/package.json` has `"zustand"` in `dependencies`; `streamsStore.ts` exists; `StreamsProvider.tsx` exists; existing tests still pass.
    - Plan 2: `frontend/src/hooks/useMessages.ts` LOC < 100; Branch D-3 regression test (per `.each(["chat", "mock-eval"])`) PRESENT and GREEN.
    - Plan 3: grep for `addEventListener.*visibilitychange` in `ChatArea.tsx` returns 0 hits; same grep in `StreamsProvider.tsx` returns 1 hit; `reconcileRef` deleted from ChatArea.
    - Plan 4: `frontend/src/components/dev/DevTwoPaneMock.tsx` exists; gated on `import.meta.env.DEV`; SC#3 re-render-isolation test present; spec inventory confirmed.

13. **Plan 1 should seed the v3.0 SurfaceId const list** as a `type SurfaceId = 'chat' | 'mock-eval' | string` (allowing any string for forward-compat with v3.0 eval pane's real SurfaceId). String alias per Claude's discretion in CONTEXT.

14. **Risk-of-regression budget for this phase:** the 4 SC + 7 L-068 invariants represent the ENTIRE binding gate. No live UAT cycles required beyond Chrome MCP `<DevTwoPaneMock>` exercise. The Vitest unit tests + TypeScript compilation + existing 067.5 regression test passing post-lift = phase ready for `/gsd:verify-work`.

---

## Sources

### Primary (HIGH confidence)

- **[VERIFIED: npm registry]** `npm view zustand version` → 5.0.13, published 2026-05-05
- **[VERIFIED: source file]** `frontend/src/hooks/useMessages.ts` (lines 380-1229) — full file read; line anchors confirmed
- **[VERIFIED: source file]** `frontend/src/components/chat/ChatArea.tsx` (lines 1-321) — full file read; listener block at 163-188 confirmed
- **[VERIFIED: source file]** `frontend/src/lib/api.ts` (line 274 `subscribeToRun` signature; line 11-19 auth headers; line 534-591 downloadSandboxOutput pattern) — confirmed
- **[VERIFIED: source file]** `frontend/src/App.tsx` (40 LOC; auth gate at line 23; TooltipProvider wrap at line 28) — confirmed
- **[VERIFIED: source file]** `frontend/package.json` (zustand absent; vitest 4.1.0; @testing-library/react 16.3.2; jsdom 29; react 19.2.4) — confirmed
- **[VERIFIED: source file]** `frontend/src/__tests__/hooks/useMessages.test.ts` (lines 1-549) — Branch D-3 test shape, mocking pattern, `makeSseRecorder()` confirmed
- **[VERIFIED: source file]** `frontend/vitest.config.ts` (jsdom env, alias resolution, setupTests.ts) — confirmed
- **[CITED: docs.pmnd.rs]** [Zustand v5 migration guide](https://zustand.docs.pmnd.rs/reference/migrations/migrating-to-v5) — useShallow replacement; selector identity requirement
- **[CITED: tkdodo.eu]** [Working with Zustand](https://tkdodo.eu/blog/working-with-zustand) — atomic selectors; actions co-located pattern
- **[CITED: github.com/pmndrs/zustand]** [Discussion #1439](https://github.com/pmndrs/zustand/discussions/1439) — Map state immutable-replace pattern (`new Map(prev).set(...)`)
- **[CITED: github.com/pmndrs/zustand]** [Discussion #2712](https://github.com/pmndrs/zustand/discussions/2712) — `getState()` vs `useStore` semantics

### Secondary (MEDIUM confidence)

- **[CITED: dev.to/keiya01]** [How do you test number of renders in React?](https://dev.to/keiya01/how-do-you-test-number-of-renders-264e) — render-counter ref pattern
- **[CITED: pmnd.rs blog]** [Announcing Zustand v5](https://pmnd.rs/blog/announcing-zustand-v5/) — breaking changes; React 18+ peer dep; native USES
- **[VERIFIED: project source]** `.planning/phases/068-streamsprovider-context-lift/068-CONTEXT.md` — all D-068 decisions; L-068 invariants
- **[VERIFIED: project source]** `.planning/seeds/SEED-007-app-level-streams-provider.md` — 4-wave entry plan; deferred from 063.1
- **[VERIFIED: project source]** `.planning/milestones/v2.5-phases/067.5-frontend-reconcile-fix/067.5-01-SUMMARY.md` — Branch D-3 fix narrative
- **[VERIFIED: project source]** `.planning/milestones/v2.5-phases/063.1-frontend-stream-decoupling-gap-closure/063.1-CONTEXT.md` — D-063.1-01..15 lineage
- **[VERIFIED: project source]** `.planning/milestones/v2.5-phases/067.3-streaming-render-and-storage-fixes-round-2/067.3-CONTEXT.md` — D-067.3-R1-01..08 bucket-routing source
- **[VERIFIED: project source]** `.planning/prd-reset/DECISIONS.md` lines 429-462 — D-PRD-06 pre-emptive lift decision

### Tertiary (LOW confidence)

- **[CITED]** Web search results on render-count test patterns — multiple credible patterns; chose simple-counter for our needs

---

## Metadata

**Confidence breakdown:**
- Standard stack (Zustand v5 + Vitest 4 + RTL 16): HIGH — registry-verified versions; canonical docs cited verbatim
- Architecture patterns (named hooks, atomic selectors, provider-scoped refs): HIGH — Dorfmeister convention + pmndrs docs + verified existing-code shape alignment
- Locked invariants port mechanics: HIGH — verified against current source line-by-line
- Vitest assertion shapes: MEDIUM — pattern is sound; specific library choice (counter ref vs react-render-stream) is judgment call
- Playwright spec inventory: MEDIUM — Plan 4 author needs to confirm presence; fallback (Chrome MCP + Vitest) is sound regardless

**Research date:** 2026-05-12
**Valid until:** 2026-06-12 (30 days — zustand v5 is stable; Vitest 4 stable; no upcoming breaking changes signaled)

---

## RESEARCH COMPLETE
