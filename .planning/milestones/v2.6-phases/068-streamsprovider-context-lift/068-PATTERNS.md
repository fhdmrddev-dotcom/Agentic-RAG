# Phase 068: `<StreamsProvider>` Context Lift — Pattern Map

**Mapped:** 2026-05-12
**Files analyzed:** 9 (4 new + 5 modified)
**Analogs found:** 6 / 9 (1 NEW pattern in this codebase; 2 trivial/no-analog-needed)

## Pattern landscape summary

This phase introduces **two new architectural primitives** that have no prior precedent in the codebase:

1. **`stores/` directory** — no Zustand or any external state-management library exists today. All shared state is React `useState` inside hooks (`useFolders`, `useMessages`, `useThreads`, etc.). Closest analog for the *shape* of `streamsStore.ts` is `frontend/src/hooks/useMessages.ts` lines 380-475 (the per-thread bucket Map state with refs alongside) — the contents lift almost line-for-line, just rehoused under Zustand's `create<T>()`.
2. **`providers/` directory** — no custom React Provider exists today. The only "Provider" in the tree is `<TooltipProvider>` from Radix (a re-export of `TooltipPrimitive.Provider` at `frontend/src/components/ui/tooltip.tsx:6`). No custom `createContext`/`useContext` usage exists anywhere in `frontend/src/` (verified via Grep — 0 hits).

Both new directories follow the existing top-level layout convention (`frontend/src/hooks/`, `frontend/src/lib/`, `frontend/src/components/`, `frontend/src/pages/`). Mirror that flat structure.

The Zustand patterns themselves come from RESEARCH.md Findings #1-#5; the planner should not re-research these.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `frontend/src/stores/streamsStore.ts` | state store (NEW pattern) | event-driven + state | `frontend/src/hooks/useMessages.ts:380-475` (Map state + refs setup) | role-match (different mechanism — Zustand vs useState — but identical state shape) |
| `frontend/src/providers/StreamsProvider.tsx` | React provider + named hooks (NEW pattern) | event-driven | `frontend/src/components/ui/tooltip.tsx:6` (TooltipProvider re-export) + `frontend/src/hooks/useMessages.ts:1209-1214` (unmount cleanup) + `frontend/src/components/chat/ChatArea.tsx:162-187` (listener block) | partial — assembled from three sources |
| `frontend/src/__tests__/providers/streamsProvider.test.tsx` | Vitest unit test | request-response | `frontend/src/__tests__/hooks/useMessages.test.ts` (full file) | exact — same mocking, same shape |
| `frontend/src/components/dev/DevTwoPaneMock.tsx` | dev-only component | render-only | `frontend/src/components/chat/ExecuteCodeBlock.tsx:1-23` (only `import.meta.env.*` consumer in src) | partial — analog is for env-var read, not DEV-flag gate |
| `frontend/src/hooks/useMessages.ts` (rewrite) | thin reader hook | state consumer | `frontend/src/hooks/useFolders.ts:20-100` (small hook that delegates) — **no perfect analog**; this becomes a NEW thin-reader pattern | NEW pattern (flag for planner) |
| `frontend/src/components/chat/ChatArea.tsx` (edit) | state consumer | request-response | itself (delete `:162-187` block + rewire imports) | self-modification |
| `frontend/src/lib/api.ts` (optional edit) | API client | request-response | itself; per RESEARCH §7 + Open Q #3, **recommend NOT modifying** | self-modification (likely no-op) |
| `frontend/src/App.tsx` (edit) | composition root | render-only | itself (add one wrap layer matching existing `<TooltipProvider>` pattern at line 28) | self-modification |
| `frontend/package.json` (edit) | dep manifest | n/a | itself (add one line to `dependencies`) | trivial |

---

## Pattern Assignments

### `frontend/src/stores/streamsStore.ts` (Zustand store, NEW pattern)

**Closest existing analog:** `frontend/src/hooks/useMessages.ts:380-475` — the existing Map-of-bucket state + refs declaration block. The shape lifts almost line-for-line; only the *mechanism* changes (Zustand `create<T>()` instead of `useState`).

**Authoritative patterns:** RESEARCH.md Findings #1-#3 (curried `create<T>()`, atomic selectors, nested-Map immutable replace) — these are the load-bearing idioms, freshly verified against zustand 5.0.13.

**Existing-state-shape excerpt to lift** (from `useMessages.ts:394-447`):
```typescript
// Existing: per-thread bucket Map state
const [messagesByThread, setMessagesByThread] = useState<Map<string, Message[]>>(() => new Map())
const [viewedThreadId, setViewedThreadId] = useState<string | null>(null)
const messages = useMemo<Message[]>(
  () => (viewedThreadId ? messagesByThread.get(viewedThreadId) ?? [] : []),
  [messagesByThread, viewedThreadId],
)

// Refs that DO NOT drive re-renders (handles):
const subscriptionsRef = useRef<Map<string, AbortController>>(new Map())
const lastSeenOffsetRef = useRef<Map<string, string>>(new Map())
const reconcileInFlightRef = useRef(false)
const streamingThreadIdRef = useRef<string | null>(null)
const activeThreadIdRef = useRef<string | null>(null)
```

**Bucket-write pattern to lift** (from `useMessages.ts:556-570`) — the model for `setMessagesForBucket`:
```typescript
const setMessagesForThread = useCallback(
  (threadId: string, updater: Message[] | ((prev: Message[]) => Message[])) => {
    setMessagesByThread((store) => {
      const prev = store.get(threadId) ?? []
      const updated =
        typeof updater === "function"
          ? (updater as (p: Message[]) => Message[])(prev)
          : updater
      const next = new Map(store)
      next.set(threadId, updated)
      return evictIfOverCapacity(next, threadId)
    })
  },
  [evictIfOverCapacity],
)
```

In the lift, this becomes a Zustand action with the nested-Map outer-wrap pattern from RESEARCH §Pattern 3:
```typescript
setMessagesForBucket: (surface, threadId, updater) =>
  set((state) => {
    const surfMap = state.bucketsBySurface.get(surface) ?? new Map()
    const prev = surfMap.get(threadId) ?? []
    const updated = typeof updater === "function" ? updater(prev) : updater
    const nextSurfMap = new Map(surfMap).set(threadId, updated)
    const nextBuckets = new Map(state.bucketsBySurface).set(surface, nextSurfMap)
    return { bucketsBySurface: nextBuckets }
  }),
```

**Branch D-3 guard to port verbatim (L-068-01)** — from `useMessages.ts:572-598`:
```typescript
const clearMessages = useCallback(() => {
  // Phase 067.5 (Branch D-3-CLEAR-WIPES-STREAMING-BUCKET): refuse to wipe a
  // bucket whose thread is currently being streamed into.
  // [comment block preserved verbatim]
  const tid = activeThreadIdRef.current
  if (tid && tid !== streamingThreadIdRef.current) {
    setMessagesByThread((store) => {
      if (!store.has(tid)) return store
      const next = new Map(store)
      next.delete(tid)
      return next
    })
    lastViewedAtRef.current.delete(tid)
  }
  setIsStreaming(false)
```

**Drift gotchas:**
- **Zustand v5 curried form is mandatory** — `create<StreamsState>()((set, get) => ({...}))`. The double parens are not a typo. v4's single-arg form will TypeScript-error.
- **Map state requires `new Map(prev).set(...)` at BOTH levels** for nested Maps (outer `bucketsBySurface` AND inner per-surface Map). Mutating in place will not trigger reactivity. See RESEARCH §Pitfall 2.
- **`EMPTY_ARRAY` module-level constant** required for selectors that fall through to a default `[]`. Returning fresh `[]` literals in a selector triggers `Maximum update depth exceeded` in v5 (uses native `useSyncExternalStore` with strict identity). See RESEARCH §Finding #1.
- **DO NOT put refs in Zustand state** — `subscriptionsRef`, `lastSeenOffsetRef`, `reconcileInFlightRef`, `streamingThreadIdRef`, `activeThreadIdRef` all stay as `useRef` *inside the provider*, not in the store. RESEARCH §Finding #2.

---

### `frontend/src/providers/StreamsProvider.tsx` (React provider + named hooks, NEW pattern)

**Closest existing analog (assembled):**

1. **Provider re-export shape** — `frontend/src/components/ui/tooltip.tsx:1-28`:
```typescript
import * as React from "react"
import * as TooltipPrimitive from "@radix-ui/react-tooltip"
const TooltipProvider = TooltipPrimitive.Provider
// ...
export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
```
The pattern: a single module exports the Provider plus the named consumer surfaces. `StreamsProvider.tsx` follows the same shape — `export { StreamsProvider, useThreadMessages, useStreamActions, useStreamSubscriptions, useViewingThread }` from one file.

2. **Listener block to MOVE (not re-write)** — `frontend/src/components/chat/ChatArea.tsx:162-187`:
```typescript
useEffect(() => {
  if (!thread?.id) return
  const tid = thread.id
  reconcileRef.current(tid).catch(console.error)
  const onVisibility = () => {
    if (document.visibilityState === "visible") {
      reconcileRef.current(tid).catch(console.error)
    }
  }
  const onFocus = () => reconcileRef.current(tid).catch(console.error)
  const onPageShow = (e: PageTransitionEvent) => {
    if (e.persisted) reconcileRef.current(tid).catch(console.error)
  }
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
Provider-internal version drops the `thread?.id` dep (no closure over a prop), gates on `activeThreadIdRef.current` instead (D-068-08), reads via `useStreamsStore.getState().actions.reconcile`. Per RESEARCH §Finding #2 and #8.

3. **Unmount cleanup to MOVE** — `frontend/src/hooks/useMessages.ts:1209-1214`:
```typescript
useEffect(() => {
  return () => {
    for (const ctrl of subscriptionsRef.current.values()) ctrl.abort()
    subscriptionsRef.current.clear()
  }
}, [])
```
Lifts verbatim into the provider body.

**Named-hook layer (RESEARCH §Finding #1):**
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

export const useViewingThread = (): string | null =>
  useStreamsStore((state) => state.viewedThreadId)

export const useStreamActions = () =>
  useStreamsStore((state) => state.actions)
```

**Drift gotchas:**
- **Actions must be defined INSIDE the provider body** (via `useStreamsStore.setState({ actions: {...} })` in a `useEffect`) so they close over provider-scoped refs. Defining actions inside `create<T>()` at module level **breaks** because they cannot see the refs. RESEARCH §Pitfall 3 + §Finding #2.
- **First-render stub-action race** — initial `actions` object holds throwing stubs (or no-ops); provider's `useEffect` overwrites on mount. Action invocations from user events post-mount are fine; do NOT call actions during render. RESEARCH §Pitfall 5.
- **Mount site:** wrap *inside* the auth gate, *outside* `<TooltipProvider>`. Match existing `App.tsx:23-37` shape — provider becomes the outermost authenticated wrapper.

---

### `frontend/src/__tests__/providers/streamsProvider.test.tsx` (Vitest unit test, exact analog)

**Closest existing analog:** `frontend/src/__tests__/hooks/useMessages.test.ts` — same Vitest+RTL setup, same `jsdom` env, same `@/lib/api` mock surface. **Lift the mocking primitives verbatim.**

**Mocking block to copy** (`useMessages.test.ts:20-58`):
```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, waitFor, act } from "@testing-library/react"

const {
  mockPostMessage,
  mockSubscribeToRun,
  mockGetMessages,
  mockGetActiveRuns,
  mockCancelRun,
} = vi.hoisted(() => ({
  mockPostMessage: vi.fn(),
  mockSubscribeToRun: vi.fn(),
  mockGetMessages: vi.fn(),
  mockGetActiveRuns: vi.fn(),
  mockCancelRun: vi.fn(),
}))

vi.mock("@/lib/api", () => ({
  postMessage: mockPostMessage,
  subscribeToRun: mockSubscribeToRun,
  getMessages: mockGetMessages,
  getActiveRuns: mockGetActiveRuns,
  cancelRun: mockCancelRun,
}))

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { user: { id: "user-1" }, access_token: "token" } },
      }),
    },
    channel: vi.fn(),
    removeChannel: vi.fn(),
  },
}))
```

**`makeSseRecorder` helper to copy verbatim** (`useMessages.test.ts:76-91`):
```typescript
function makeSseRecorder() {
  const callbacksByRunId: Map<string, StreamCallbacks> = new Map()
  let lastCallbacks: StreamCallbacks | null = null
  mockSubscribeToRun.mockImplementation(
    async (runId: string, _since: string, callbacks: StreamCallbacks, _signal?: AbortSignal) => {
      callbacksByRunId.set(runId, callbacks)
      lastCallbacks = callbacks
      return new Promise<void>(() => {})  // never resolves; tests drive callbacks
    },
  )
  return {
    last: () => lastCallbacks,
    forRun: (runId: string) => callbacksByRunId.get(runId),
  }
}
```

**Branch D-3 regression test shape to adapt** (`useMessages.test.ts:392-604`) — the existing Branch D-3 test, ported to use `<StreamsProvider>` as renderHook wrapper and `.each(["chat", "mock-eval"])` enumeration:
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
      // ... mirrors useMessages.test.ts:536-604 verbatim, with renderHook
      // wrapper:<StreamsProvider> and surface routing on the action calls.
    },
  )
})
```

**Drift gotchas:**
- `renderHook` accepts `{ wrapper: ({ children }) => <StreamsProvider>{children}</StreamsProvider> }` — same call shape, just adds the wrapper option. RESEARCH §Finding #6.
- The existing Phase 067.5 Branch D-3 test at `useMessages.test.ts:536-604` should STAY in `useMessages.test.ts` and pass post-lift (against the new thin-reader `useMessages`). This is the third evidence layer for "preserved verbatim" per RESEARCH §Validation Architecture point 3.
- The new `__tests__/providers/` directory does not exist yet — create it as a sibling of `__tests__/hooks/`, `__tests__/components/`, `__tests__/lib/`.

---

### `frontend/src/components/dev/DevTwoPaneMock.tsx` (dev-only component)

**Closest existing analog:** No existing `components/dev/` directory; no existing `import.meta.env.DEV` gated component. The only `import.meta.env.*` consumer in `frontend/src/` is `frontend/src/components/chat/ExecuteCodeBlock.tsx:13`:
```typescript
const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? ""
```
That's for an env-var read, not a `DEV`-flag gate. The DEV-flag pattern is a NEW convention in this codebase.

**Recommended shape (from RESEARCH §Finding #9):**
```tsx
export function DevTwoPaneMock() {
  if (!import.meta.env.DEV) return null  // Vite dead-code-eliminates in prod
  return (
    <div className="grid grid-cols-2 gap-4 fixed bottom-4 right-4 w-[800px] bg-zinc-900 p-4 border z-50">
      <PaneA />
      <PaneB />
    </div>
  )
}
```

**Drift gotchas:**
- Vite's dead-code elimination only fires for the literal `import.meta.env.DEV` token, NOT for a variable bound to it. Keep the `if (!import.meta.env.DEV) return null` at the top of the function literal, exactly as shown.
- Create new `frontend/src/components/dev/` directory (it doesn't exist). Mirror the existing flat-component layout (sibling to `components/chat/`, `components/ui/`, `components/layout/`).
- Choose stub vs real `<MessageList>` per RESEARCH §Finding #9 tradeoff — stub for SC#3 unit isolation, real for Chrome MCP manual exercise. Planner's call.

---

### `frontend/src/hooks/useMessages.ts` (rewrite to thin reader — NEW pattern)

**No close analog exists.** This codebase has no precedent for a "hook delegates to a lower-layer store/provider" pattern. All hooks today own their state directly. **Flag for planner: this is a NEW pattern in the codebase.**

**Closest reference for "small hook that returns a memoized object":** `frontend/src/hooks/useFolders.ts:20-100` — at least demonstrates the small-hook return shape (single `useMemo`-free interface object), though useFolders owns its state. Use only as a sanity reference for "small hook style"; not as a structural template.

**Target shape (from RESEARCH §Code Examples §"thin useMessages reader"):**
```typescript
import { useMemo } from "react"
import {
  useThreadMessages,
  useStreamActions,
  useViewingThread,
} from "@/providers/StreamsProvider"

export function useMessages() {
  const viewedThreadId = useViewingThread()
  const messages = useThreadMessages(viewedThreadId, "chat")
  const actions = useStreamActions()
  return useMemo(
    () => ({
      messages,
      isStreaming: false,
      fallbackNotice: null,
      loadMessages: actions.loadMessages,
      sendMessage: actions.sendMessage,
      stopStreaming: actions.stopStream,
      abortStream: () => {},
      clearMessages: () => actions.clearThreadBucket("chat"),
      setViewingThread: actions.setViewingThread,
      reconcile: actions.reconcile,
      resumeFromFailed: actions.resumeFromFailed,
    }),
    [messages, actions],
  )
}
```

**Drift gotchas:**
- **The public `UseMessages` interface MUST stay identical** so `ChatArea.tsx:27-38` imports keep working untouched. The plan-checker should grep that `useMessages.ts` still exports the same 11 properties (`messages`, `isStreaming`, `fallbackNotice`, `loadMessages`, `sendMessage`, `stopStreaming`, `abortStream`, `clearMessages`, `setViewingThread`, `reconcile`, `resumeFromFailed`).
- **LOC target: < 100** per RESEARCH §Recommendations #4. Source today: 1229 LOC.
- The Phase 067.5 Branch D-3 test inside `useMessages.test.ts` (lines 536-604) MUST stay GREEN against this rewritten thin reader — this is part 3 of the "preserved verbatim" evidence stack.

---

### `frontend/src/components/chat/ChatArea.tsx` (edit: delete listener block; rewire imports)

**Self-modifying analog.** Two surgical edits:

**Edit 1 — delete the listener block at lines 162-187** (the entire `useEffect(() => { ... }, [thread?.id])` block that attaches visibilitychange/focus/pageshow). Also delete the `reconcileRef` indirection at lines 157-160:
```typescript
// DELETE: lines 157-160
const reconcileRef = useRef(reconcile)
useEffect(() => {
  reconcileRef.current = reconcile
}, [reconcile])

// DELETE: lines 162-187 (entire useEffect with listeners)
```

**Edit 2 — rewire imports** from the single `useMessages()` call site at lines 27-38. If the planner keeps `useMessages` as a thin wrapper, **no change needed** (diff-minimizing). If renaming, replace with:
```typescript
import { useThreadMessages, useStreamActions, useViewingThread } from "@/providers/StreamsProvider"

// inside component:
const viewedThreadId = useViewingThread()
const messages = useThreadMessages(viewedThreadId, "chat")
const { sendMessage, stopStream, clearThreadBucket, setViewingThread, reconcile, resumeFromFailed, loadMessages } = useStreamActions()
```

**Drift gotchas:**
- The `reconcileRef.current(tid).catch(...)` initial-fire-on-mount call at line 165 has no listener-block replacement. Per RESEARCH §Finding #8 point 2: "reconcile on thread select" moves into `setViewingThread` itself, which the provider's action performs. Verify the provider action triggers reconcile when thread selection changes.
- Plan 3 atomic-commit guarded by RESEARCH §Recommendations #6 — listener deletion is one commit, on its own.

---

### `frontend/src/lib/api.ts` (optional edit: subscribeToRun signature)

**Self-modifying analog.** Current signature at line 274:
```typescript
export async function subscribeToRun(
  runId: string,
  since: string,
  callbacks: StreamCallbacks,
  signal?: AbortSignal,
): Promise<void>
```

**Recommendation per RESEARCH §Finding #7 + §Recommendations #10: DO NOT modify this file.** Bind `surfaceId` inside the store-action callback closures via `setMessagesForBucket(surfaceId, threadId, ...)`. The SSE wire never sees `surfaceId`; placing it on `subscribeToRun` would leak the surface concept into the API layer unnecessarily.

If plan-checker insists on the canonical-refs phrasing ("adds optional `surfaceId` parameter"), add an unused parameter with a doc comment marking it routing-only:
```typescript
export async function subscribeToRun(
  runId: string,
  since: string,
  callbacks: StreamCallbacks,
  signal?: AbortSignal,
  /** Routing param — used only by callers binding callbacks; no effect inside this function. */
  _surfaceId?: SurfaceId,
): Promise<void>
```

**Drift gotchas:** Either choice passes the plan-checker. Cleaner: leave `lib/api.ts` unchanged.

---

### `frontend/src/App.tsx` (edit: add `<StreamsProvider>` wrap)

**Self-modifying analog.** Current shape at lines 23-37 already establishes the wrap pattern via `<TooltipProvider>`:
```typescript
if (!user) return <AuthPage onSignIn={signIn} onSignUp={signUp} />

return (
  <TooltipProvider>
    <ChatLayout ... />
  </TooltipProvider>
)
```

**Post-lift (Claude's discretion choice — sane default per RESEARCH §Finding #4):**
```typescript
if (!user) return <AuthPage onSignIn={signIn} onSignUp={signUp} />

return (
  <StreamsProvider>
    <TooltipProvider>
      <ChatLayout ... />
    </TooltipProvider>
  </StreamsProvider>
)
```

**Drift gotchas:**
- Mount BELOW auth gate (only authenticated users get a store). Privacy + memory win per RESEARCH §Finding #4.
- The provider is the OUTERMOST authenticated wrapper. This makes `<DevTwoPaneMock>` and any future surface (eval pane) able to subscribe via the named hooks.

---

### `frontend/package.json` (edit: add zustand dep)

**Self-modifying analog.** Add `"zustand": "^5.0.13"` to the `dependencies` block (currently at lines 14-44). Mirror existing single-line dep entries.

**Drift gotchas:**
- Run `npm install zustand@^5.0.13` (Plan 1 Task 1 per RESEARCH §Recommendations #1) — installs the dep AND updates `package-lock.json` atomically.
- Pin to `^5.0.13` (verified working with React 19 per RESEARCH §Risks). Fallback `5.0.12` available if 5.0.13 regresses.

---

## Shared Patterns

### Per-thread bucket invariant (L-068-04 / D-067.3-R1-05)

**Source:** `frontend/src/hooks/useMessages.ts:684, 716, 769, 1011, 1054, 1074` — every `setMessagesForThread(threadId, ...)` call binds the write to the streaming thread's bucket, not the viewing thread's.

**Apply to:** every store action that writes into `bucketsBySurface` (`sendMessage`, `reconcile`, `loadMessages`, all the SSE event handlers in `makeStreamCallbacks`).

**Concrete invariant:**
```typescript
// Inside any SSE event handler closure:
setMessagesForBucket(surfaceId, threadId, (prev) => ...)  // threadId === STREAMING thread, NOT viewing thread
```

---

### Sole-writer for `activeThreadIdRef` (L-068-03 / D-060-01)

**Source:** `frontend/src/hooks/useMessages.ts:509-513`:
```typescript
const setViewingThread = useCallback((threadId: string | null) => {
  activeThreadIdRef.current = threadId
  setViewedThreadId(threadId)
  if (threadId) lastViewedAtRef.current.set(threadId, Date.now())
}, [])
```

**Apply to:** the provider. `setViewingThread` becomes the ONLY function that writes `activeThreadIdRef.current`. Plan-checker grep on `StreamsProvider.tsx`: `activeThreadIdRef.current\s*=` returns exactly 1 hit (inside `setViewingThread`).

**Post-await guard inside actions** (applies to `loadMessages`, `reconcile`):
```typescript
// after every await inside an action:
if (activeThreadIdRef.current !== threadId) return  // bail — user navigated away
```

---

### Reconcile in-flight lock (L-068-02 / D-063.1-11)

**Source:** `frontend/src/hooks/useMessages.ts:956-960, 1136-1143`:
```typescript
// Top of reconcile:
if (reconcileInFlightRef.current) return
reconcileInFlightRef.current = true
try {
  // ... body ...
} finally {
  reconcileInFlightRef.current = false  // ALWAYS reset
}
```

**Apply to:** the provider's `reconcile` action. RESEARCH §Pattern 4 shows the lift verbatim.

---

### Subscription cleanup on onTerminal (L-068-07 / BL-03)

**Source:** `frontend/src/hooks/useMessages.ts:1089` (reconcile) and equivalent site in sendMessage:
```typescript
// Inside onTerminal callback override:
subscriptionsRef.current.delete(run.run_id)
```

**Apply to:** every action that opens a subscription (`sendMessage`, `reconcile`). The `.finally()` block after the `subscribeToRun(...)` call serves as a safety net only — never the primary cleanup. See `useMessages.ts:1121-1134` for the canonical pattern (onTerminal does cleanup; .finally re-checks for safety net via `if (subscriptionsRef.current.has(run.run_id))`).

---

### MERGE 3-clause filter for loadMessages temp placeholders (L-068-06 / D-063.1-12)

**Source:** `frontend/src/hooks/useMessages.ts` — referenced extensively but the literal predicate is `m.id.startsWith('temp-') && m.runId && !dbRunIds.has(m.runId)`.

**Apply to:** the store action `loadMessages`. The three-clause filter for preserving live in-flight temp placeholders survives byte-identical; just the surrounding state machinery changes from `setMessagesByThread` to `setMessagesForBucket(surfaceId, threadId, ...)`.

---

### runId-match dedup in reconcile (L-068-05 / D-063.1-04)

**Source:** `frontend/src/hooks/useMessages.ts:990-992`:
```typescript
const threadMessages = messagesByThreadRef.current.get(threadId) ?? []
const existingByRunId = threadMessages.find((m) => m.runId === run.run_id)
const targetId = existingByRunId?.id ?? `temp-${run.run_id}`
```

**Apply to:** the provider's `reconcile` action. The lift change: `messagesByThreadRef.current.get(threadId)` becomes `useStreamsStore.getState().bucketsBySurface.get(surfaceId)?.get(threadId)` (RESEARCH §Pattern 5). The `messagesByThreadRef` mirror dies cleanly — `getState()` replaces it.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `frontend/src/stores/streamsStore.ts` | Zustand store | event-driven | No `stores/` directory exists; no Zustand or any external state-management lib used today. The state shape lifts from `useMessages.ts:380-475` but the *mechanism* is fresh. |
| `frontend/src/providers/StreamsProvider.tsx` | React custom Provider | event-driven | No custom React Provider exists in codebase. Only `TooltipProvider` (Radix re-export). No `createContext`/`useContext` usage anywhere in `frontend/src/`. |
| `frontend/src/hooks/useMessages.ts` (rewrite as thin reader) | hook delegating to lower-layer store | state consumer | No "hook delegates to store/provider" pattern exists; all hooks today own their state via local `useState`/`useRef`. This is a NEW architectural layer. |

**Planner should rely on RESEARCH.md Findings #1-#9 for these three files**, since no analog provides actionable detail. The store and provider patterns are well-specified in RESEARCH §Pattern 1-6.

---

## Metadata

**Analog search scope:**
- `frontend/src/hooks/` (7 files; closest analog for state-managing hook)
- `frontend/src/components/ui/` (custom + Radix wrappers; provider analog)
- `frontend/src/components/chat/` (consumer site; ChatArea, ExecuteCodeBlock)
- `frontend/src/__tests__/` (test analog)
- `frontend/src/App.tsx`, `frontend/src/lib/api.ts` (composition root + API client)
- `graphify-out/GRAPH_REPORT.md` (god nodes, community structure — confirmed no existing Provider/store patterns)

**Files scanned:** 12 source files read in full or in load-bearing ranges; graph report consulted for cross-module hub awareness.

**Pattern extraction date:** 2026-05-12

**Key insight for planner:** This phase ships **two genuinely new architectural primitives** (`stores/` and `providers/` directories) to an otherwise hook-only codebase. The state *shape* and *invariants* (Branch D-3 guard, reconcile lock, sole-writer pattern, bucket routing, MERGE filter, runId-match dedup) all lift verbatim from `useMessages.ts`. The *mechanism* (Zustand + provider-scoped refs + named selector hooks) is freshly specified in RESEARCH.md. The mechanical lift is straightforward; the binding gate is the Branch D-3 Vitest regression test (L-068-01) firing per-surface (`['chat', 'mock-eval']`).
