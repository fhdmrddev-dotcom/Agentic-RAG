/**
 * Phase 096 Plan 05 (D-09 / D-10 / D-11 — BUG-260530-01) — thread-keyed LRU-3
 * stream pool behavior tests.
 *
 * The bug: one held-open streaming fetch per active run saturates the browser's
 * 6-per-host HTTP/1.1 connection cap → 15-30s thread-switch hangs. The fix caps
 * held-open streams at STREAM_POOL_SIZE = 3 (viewed thread + 2 most-recently-
 * viewed background threads), evicting the LRU thread's streams on navigation.
 *
 * Five behaviors (096-05-PLAN.md Task 1):
 *   1. Pool enforcement — visit A,B,C,D → only D+C+B hold subscriptions; A's
 *      controller aborted, entries removed from subscriptionsRef AND
 *      subscriptionsByThread.
 *   2. Cursor retention — eviction NEVER touches lastSeenOffsetRef (the D-11
 *      replay substrate); return-to-thread re-attaches with the retained
 *      client cursor (client cursors win over snapshot re-seeds).
 *   3. Reattach on return — navigate back to the evicted thread → reconcile
 *      calls getSnapshot AND subscribeToRun fires again (the :1259
 *      subscriptionsRef.has short-circuit does NOT skip — no ghost
 *      bookkeeping; Pitfall 3).
 *   4. PANEL-06 isolation (RESEARCH assumption A4 confirm) — chat-message
 *      selector subscribers record zero re-renders from pool churn (eviction
 *      bookkeeping + bystander threads across the full evict+reattach cycle).
 *   5. Gating — an open attempt for a thread OUTSIDE the keep-set is skipped
 *      (no subscribeToRun call, no slot reservation); an in-pool thread's open
 *      proceeds (positive control).
 *
 * Mock scaffold copied from streamsProvider.test.tsx:34-67 with `getSnapshot`
 * ADDED to the @/lib/api factory (reconcile calls it at StreamsProvider.tsx:1179
 * — the existing scaffold predates the Phase 075 atomic-swap) plus
 * `getThreadWorkflow` (reconcile's workflow-lock read at :1399).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, renderHook, waitFor, act } from "@testing-library/react"
import type { ReactNode } from "react"
import type { Message } from "@/types"

// ── Mock API module ───────────────────────────────────────────────────────────
// vi.mock is hoisted; use vi.hoisted() for any closure-captured vars.
const {
  mockPostMessage,
  mockSubscribeToRun,
  mockGetMessages,
  mockGetActiveRuns,
  mockGetSnapshot,
  mockCancelRun,
  mockGetThreadWorkflow,
} = vi.hoisted(() => ({
  mockPostMessage: vi.fn(),
  mockSubscribeToRun: vi.fn(),
  mockGetMessages: vi.fn(),
  mockGetActiveRuns: vi.fn(),
  mockGetSnapshot: vi.fn(),
  mockCancelRun: vi.fn(),
  mockGetThreadWorkflow: vi.fn(),
}))

vi.mock("@/lib/api", () => ({
  postMessage: mockPostMessage,
  subscribeToRun: mockSubscribeToRun,
  getMessages: mockGetMessages,
  getActiveRuns: mockGetActiveRuns,
  // NOTE: getSnapshot is REQUIRED here (absent from the older scaffold) —
  // reconcile's atomic swap (D-075-02) calls it on every setViewingThread.
  getSnapshot: mockGetSnapshot,
  cancelRun: mockCancelRun,
  getThreadWorkflow: mockGetThreadWorkflow,
  // Class stand-in so `err instanceof ApiError` checks don't blow up.
  ApiError: class ApiError extends Error {
    status: number
    constructor(message: string, status: number) {
      super(message)
      this.status = status
    }
  },
}))

// ── Mock Supabase auth ────────────────────────────────────────────────────────
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

import { StreamsProvider, useStreamActions, useThreadMessages } from "@/providers/StreamsProvider"
import { useStreamsStore } from "@/stores/streamsStore"
import { requestProducerResubscribe } from "@/providers/producerResubscribeSignal"
import type { StreamCallbacks, ThreadSnapshot } from "@/lib/api"

// ── SSE recorder (extends streamsProvider.test.tsx makeSseRecorder :74-91) ────
// Captures EVERY subscribeToRun call with its since-cursor + AbortSignal so the
// pool tests can assert (a) eviction aborts the signal and (b) re-attach reuses
// the retained cursor. The returned promise never resolves — held-open stream.
interface RecordedCall {
  runId: string
  since: string
  callbacks: StreamCallbacks
  signal?: AbortSignal
}

function makePoolSseRecorder() {
  const calls: RecordedCall[] = []
  mockSubscribeToRun.mockImplementation(
    async (
      runId: string,
      since: string,
      callbacks: StreamCallbacks,
      signal?: AbortSignal,
    ) => {
      calls.push({ runId, since, callbacks, signal })
      // Never resolves — caller drives event arrival via captured callbacks.
      return new Promise<void>(() => {})
    },
  )
  return {
    calls,
    forRun: (runId: string) => calls.filter((c) => c.runId === runId),
    lastForRun: (runId: string): RecordedCall | undefined =>
      calls.filter((c) => c.runId === runId).at(-1),
  }
}

// ── Snapshot factory ──────────────────────────────────────────────────────────
// Each pool thread carries exactly ONE active run named after the thread:
// thread-A → run-A, etc. since_cursors optionally seeds the server cursor.
function snapshotFor(runId: string, cursor?: string): ThreadSnapshot {
  return {
    messages: [],
    active_runs: [{ run_id: runId, started_at: "2026-06-06T00:00:00Z" }] as never,
    since_cursors: cursor ? { [runId]: cursor } : {},
  }
}

/** Wire getSnapshot so `thread-X` reconciles to `run-X` (1 active run each). */
function wireSnapshots(cursors: Record<string, string> = {}) {
  mockGetSnapshot.mockImplementation(async (threadId: string) => {
    const runId = threadId.replace("thread-", "run-")
    return snapshotFor(runId, cursors[runId])
  })
}

// ── Provider wrapper helper ───────────────────────────────────────────────────
function renderProvider() {
  return renderHook(() => useStreamActions(), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <StreamsProvider>{children}</StreamsProvider>
    ),
  })
}

/** Navigate to a thread and wait for its run's stream attach + full reconcile
 *  settle (the workflow read is reconcile's last await — once it has fired for
 *  this thread, the in-flight lock is released for the next navigation). */
async function navigateAndAttach(
  setViewingThread: (tid: string | null) => void,
  recorder: ReturnType<typeof makePoolSseRecorder>,
  threadId: string,
  expectedSubscribeCalls = 1,
) {
  const runId = threadId.replace("thread-", "run-")
  await act(async () => {
    setViewingThread(threadId)
  })
  await waitFor(() => {
    expect(recorder.forRun(runId).length).toBeGreaterThanOrEqual(expectedSubscribeCalls)
  })
  await waitFor(() => {
    expect(mockGetThreadWorkflow).toHaveBeenCalledWith(threadId)
  })
  // Flush trailing microtasks so reconcile's finally releases the in-flight lock.
  await act(async () => {
    await Promise.resolve()
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  useStreamsStore.setState({
    bucketsBySurface: new Map(),
    viewedThreadId: null,
    streamingThreads: new Set<string>(),
    fallbackNotices: new Map<string, string>(),
    reconcileErrors: new Map<string, Error>(),
    loadingThreads: new Set<string>(),
    subscriptionsByThread: new Map<string, Set<string>>(),
    todosByThread: new Map(),
    tasksByThread: new Map(),
    workflowLockByThread: new Map(),
    phasesByThread: new Map(),
  })
  mockGetMessages.mockResolvedValue([])
  mockGetActiveRuns.mockResolvedValue([])
  mockCancelRun.mockResolvedValue(undefined)
  mockGetSnapshot.mockResolvedValue({ messages: [], active_runs: [], since_cursors: {} })
  mockGetThreadWorkflow.mockResolvedValue({
    locked: false,
    lock_is_stale: false,
    active_workflow_run_id: null,
    cap_paused: false,
    continues_remaining: 0,
    latest_producer_run_id: null,
  })
})

afterEach(() => {
  vi.clearAllMocks()
})

// =============================================================================
// Test 1 — pool enforcement (D-09). 4 threads × 1 active run, visited A,B,C,D:
// keep-set = {D, C, B}; A's stream evicted — controller aborted AND both
// bookkeeping entries (subscriptionsRef via abort-proof + subscriptionsByThread)
// removed. Eviction bookkeeping symmetry per StreamsProvider.tsx:1051-1059
// (api.ts:516-517 — AbortError is SILENT, no onTerminal: the evictor must do
// the remove pair itself).
// =============================================================================
describe("Phase 096-05 — Test 1: LRU-3 pool enforcement on navigation", () => {
  it("visiting A,B,C,D keeps only D+C+B subscribed; A is aborted and de-booked", async () => {
    const recorder = makePoolSseRecorder()
    wireSnapshots()

    const { result } = renderProvider()

    await navigateAndAttach(result.current.setViewingThread, recorder, "thread-A")
    await navigateAndAttach(result.current.setViewingThread, recorder, "thread-B")
    await navigateAndAttach(result.current.setViewingThread, recorder, "thread-C")

    // Pool not yet exceeded: all 3 still subscribed.
    const byThreadBefore = useStreamsStore.getState().subscriptionsByThread
    expect(byThreadBefore.get("thread-A")?.has("run-A")).toBe(true)
    expect(byThreadBefore.get("thread-B")?.has("run-B")).toBe(true)
    expect(byThreadBefore.get("thread-C")?.has("run-C")).toBe(true)
    expect(recorder.lastForRun("run-A")?.signal?.aborted).toBe(false)

    // 4th thread — LRU (thread-A) must be evicted.
    await navigateAndAttach(result.current.setViewingThread, recorder, "thread-D")

    const byThread = useStreamsStore.getState().subscriptionsByThread
    // Keep-set holds.
    expect(byThread.get("thread-B")?.has("run-B")).toBe(true)
    expect(byThread.get("thread-C")?.has("run-C")).toBe(true)
    expect(byThread.get("thread-D")?.has("run-D")).toBe(true)
    // A's subscriptionsByThread entry removed (GC drops the whole key).
    expect(byThread.has("thread-A")).toBe(false)
    // A's controller aborted (the held-open fetch released)…
    expect(recorder.lastForRun("run-A")?.signal?.aborted).toBe(true)
    // …while the keep-set's streams stay live.
    expect(recorder.lastForRun("run-B")?.signal?.aborted).toBe(false)
    expect(recorder.lastForRun("run-C")?.signal?.aborted).toBe(false)
    expect(recorder.lastForRun("run-D")?.signal?.aborted).toBe(false)
  })
})

// =============================================================================
// Test 2 — cursor retention (D-11 replay substrate). Eviction NEVER cleans
// lastSeenOffsetRef: after advancing A's cursor via onCursor and evicting A,
// returning to A re-subscribes with the ADVANCED client cursor (which also
// beats the snapshot's since_cursors re-seed — client cursors win, :1218-1222).
// =============================================================================
describe("Phase 096-05 — Test 2: evicted run's cursor is retained for replay", () => {
  it("re-attach after eviction subscribes with the retained (advanced) cursor", async () => {
    const recorder = makePoolSseRecorder()
    // Server seeds run-A's cursor at 100-0 on every snapshot.
    wireSnapshots({ "run-A": "100-0" })

    const { result } = renderProvider()

    await navigateAndAttach(result.current.setViewingThread, recorder, "thread-A")
    // First attach consumed the server-seeded cursor.
    expect(recorder.lastForRun("run-A")?.since).toBe("100-0")

    // Stream advances — client cursor moves past the server seed.
    const cbA = recorder.lastForRun("run-A")!.callbacks
    act(() => {
      cbA.onCursor?.("150-0")
    })

    // Evict A (B, C, D fill the pool).
    await navigateAndAttach(result.current.setViewingThread, recorder, "thread-B")
    await navigateAndAttach(result.current.setViewingThread, recorder, "thread-C")
    await navigateAndAttach(result.current.setViewingThread, recorder, "thread-D")
    expect(useStreamsStore.getState().subscriptionsByThread.has("thread-A")).toBe(false)

    // Return to A — the re-attach must use the RETAINED client cursor (150-0),
    // not "0" (cursor wiped = replay lost) and not "100-0" (server re-seed
    // overwrote the client cursor).
    await navigateAndAttach(result.current.setViewingThread, recorder, "thread-A", 2)
    expect(recorder.forRun("run-A").length).toBe(2)
    expect(recorder.lastForRun("run-A")?.since).toBe("150-0")
  })
})

// =============================================================================
// Test 3 — reattach on return (Pitfall 3 / ghost bookkeeping). Returning to the
// evicted thread re-runs reconcile: getSnapshot fires for it AND subscribeToRun
// fires a SECOND time for its run — proving eviction removed the
// subscriptionsRef entry (a stale entry would make the :1259
// `subscriptionsRef.current.has(run.run_id) → continue` short-circuit skip
// re-attach forever).
// =============================================================================
describe("Phase 096-05 — Test 3: returning to an evicted thread re-attaches", () => {
  it("reconcile on return calls getSnapshot and re-subscribes the evicted run", async () => {
    const recorder = makePoolSseRecorder()
    wireSnapshots()

    const { result } = renderProvider()

    await navigateAndAttach(result.current.setViewingThread, recorder, "thread-A")
    await navigateAndAttach(result.current.setViewingThread, recorder, "thread-B")
    await navigateAndAttach(result.current.setViewingThread, recorder, "thread-C")
    await navigateAndAttach(result.current.setViewingThread, recorder, "thread-D")

    // A evicted; exactly one subscribe so far for run-A.
    expect(recorder.forRun("run-A").length).toBe(1)
    expect(useStreamsStore.getState().subscriptionsByThread.has("thread-A")).toBe(false)

    mockGetSnapshot.mockClear()

    // Return to A.
    await navigateAndAttach(result.current.setViewingThread, recorder, "thread-A", 2)

    // Reconcile ran for A (snapshot fetched)…
    expect(mockGetSnapshot).toHaveBeenCalledWith("thread-A")
    // …and the stream re-attached (NO ghost short-circuit at :1259).
    expect(recorder.forRun("run-A").length).toBe(2)
    expect(recorder.lastForRun("run-A")?.signal?.aborted).toBe(false)
    // Bookkeeping restored symmetrically.
    expect(
      useStreamsStore.getState().subscriptionsByThread.get("thread-A")?.has("run-A"),
    ).toBe(true)
  })
})

// =============================================================================
// Test 4 — PANEL-06 isolation (RESEARCH assumption A4 confirm). Pool churn
// (eviction bookkeeping setState + subscription slot writes) must NEVER
// re-render chat-message selector subscribers:
//   (a) the EVICTED thread's chat consumer records ZERO re-renders across the
//       navigation that evicts its stream (only subscriptionsByThread is
//       written for it — never its bucket);
//   (b) a BYSTANDER thread's chat consumer records ZERO re-renders across the
//       ENTIRE evict + reattach cycle.
// (The returned-to thread's own reconcile hydration re-render is pre-existing
// reconcile behavior, not pool churn — out of scope here.)
// =============================================================================
describe("Phase 096-05 — Test 4: PANEL-06 isolation (zero chat re-renders from pool churn)", () => {
  it("evict + reattach cycle re-renders neither the evicted thread's chat selector (during eviction) nor a bystander's", async () => {
    const recorder = makePoolSseRecorder()
    wireSnapshots()

    const renderCount = { evicted: 0, bystander: 0 }

    function EvictedThreadConsumer() {
      renderCount.evicted++
      const msgs = useThreadMessages("thread-A")
      return <div data-testid="evicted">{msgs.length}</div>
    }
    function BystanderConsumer() {
      renderCount.bystander++
      const msgs = useThreadMessages("thread-E")
      return <div data-testid="bystander">{msgs.length}</div>
    }

    render(
      <StreamsProvider>
        <EvictedThreadConsumer />
        <BystanderConsumer />
      </StreamsProvider>,
    )

    const actions = useStreamsStore.getState().actions

    // Attach A, B, C (pool full). A's reconcile hydration re-renders its
    // consumer — expected, happens BEFORE the baselines below.
    await navigateAndAttach(actions.setViewingThread, recorder, "thread-A")
    await navigateAndAttach(actions.setViewingThread, recorder, "thread-B")
    await navigateAndAttach(actions.setViewingThread, recorder, "thread-C")

    const baselineEvicted = renderCount.evicted
    const baselineBystander = renderCount.bystander

    // Navigate to D — evicts thread-A's stream (abort + subscriptionsByThread
    // remove). NEITHER consumer's bucket is touched.
    await navigateAndAttach(actions.setViewingThread, recorder, "thread-D")
    expect(useStreamsStore.getState().subscriptionsByThread.has("thread-A")).toBe(false)

    // (a) Eviction churn never re-rendered the evicted thread's chat selector.
    expect(renderCount.evicted).toBe(baselineEvicted)

    // Return to A — reattach (slot reservation setState + subscribeToRun).
    await navigateAndAttach(actions.setViewingThread, recorder, "thread-A", 2)

    // (b) The bystander recorded ZERO re-renders across the entire cycle.
    expect(renderCount.bystander).toBe(baselineBystander)
  })
})

// =============================================================================
// Test 5 — gating. ALL open sites are gated on isThreadInStreamPool: an open
// attempt for a thread OUTSIDE the keep-set is skipped — no subscribeToRun
// call AND no slot-reservation write (a reserved-but-never-opened slot would
// be ghost bookkeeping). Positive control: an in-pool thread's open proceeds.
// Driven via the producer re-subscribe signal (the one open site reachable
// without navigation — 092-07 Facet C).
// =============================================================================
describe("Phase 096-05 — Test 5: open attempts outside the keep-set are skipped", () => {
  it("producer re-subscribe for an out-of-pool thread is skipped; in-pool proceeds", async () => {
    const recorder = makePoolSseRecorder()
    wireSnapshots()

    const { result } = renderProvider()

    // Fill the pool: keep-set = {D, C, B}.
    await navigateAndAttach(result.current.setViewingThread, recorder, "thread-B")
    await navigateAndAttach(result.current.setViewingThread, recorder, "thread-C")
    await navigateAndAttach(result.current.setViewingThread, recorder, "thread-D")

    const callsBefore = recorder.calls.length

    // Open attempt for thread-X (never visited — OUTSIDE the keep-set).
    await act(async () => {
      requestProducerResubscribe({ threadId: "thread-X", producerRunId: "run-X-producer" })
      await Promise.resolve()
    })

    // Skipped: no stream opened, no slot reserved.
    expect(recorder.forRun("run-X-producer").length).toBe(0)
    expect(recorder.calls.length).toBe(callsBefore)
    expect(useStreamsStore.getState().subscriptionsByThread.has("thread-X")).toBe(false)

    // Positive control: the same signal for an IN-POOL thread (thread-D, the
    // viewed thread) opens a stream for its fresh producer run id.
    await act(async () => {
      requestProducerResubscribe({ threadId: "thread-D", producerRunId: "run-D-producer" })
      await Promise.resolve()
    })
    await waitFor(() => {
      expect(recorder.forRun("run-D-producer").length).toBe(1)
    })
    expect(
      useStreamsStore.getState().subscriptionsByThread.get("thread-D")?.has("run-D-producer"),
    ).toBe(true)
  })
})
