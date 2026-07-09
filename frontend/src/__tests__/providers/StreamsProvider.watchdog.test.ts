/**
 * Phase 145 Plan 05 (FND-01) — inactivity watchdog + reconcile-DERIVED
 * `streamingThreads` (U7 / Pattern 2).
 *
 * The load-bearing frontend fix for run-state honesty (Direction A): a finished
 * run must finalize the UI — no phantom "running", no dead Stop — even when the
 * terminal SSE is missed and the connection never closes. RESEARCH A3 proved the
 * ONLY code that wrote `streamingThreads` was the send path (add :1715, reattach
 * re-add :1852, finally-delete :2020); `reconcile()` never touched it, so a
 * missed-terminal left a permanent phantom until a full page reload.
 *
 * This suite proves the two mechanisms that close that gap:
 *   1. reconcile-DERIVE — after every getSnapshot, `streamingThreads` is derived
 *      from `snapshot.active_runs` in BOTH directions:
 *        - Direction A: DELETE when no run is streaming (phantom Stop clears)
 *        - Direction B: RE-ADD when a still-active run is reconciled (Stop reappears)
 *      guarded by `sendingThreadsRef` so an in-flight send is never clobbered
 *      (Pitfall 1, mirroring clearThreadBucket:1302).
 *   2. inactivity watchdog — ONE shared ~5s setInterval over the streaming set;
 *      after N≈20s of per-thread inactivity it fires a READ-ONLY getSnapshot probe
 *      (the _isTransientStreamEnd-style active_runs check, NOT full reconcile()).
 *      On a terminal verdict it SILENTLY finalizes (D-145-04): delete +
 *      terminal-flip to "completed", no banner / no "reconnecting" state. While
 *      still streaming it is a no-op. The watchdog only RECONCILES, never kills
 *      (D-145-05) — the authoritative kill of a dead producer is the backend sweep.
 *
 * Mock boundary copied verbatim from StreamsProvider.transient.test.ts:27-63 +
 * the render harness from streamsProvider_bug_260707_01_streaming_flag.test.tsx
 * (renderHook + useStreamActions). Fake-timer recipe mirrors
 * streamsProvider.test.tsx (vi.useFakeTimers() + vi.advanceTimersByTimeAsync).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { createElement, type ReactNode } from "react"

const {
  mockGetSnapshot,
  mockGetMessages,
  mockGetActiveRuns,
  mockPostMessage,
  mockSubscribeToRun,
  mockCancelRun,
  mockGetThreadWorkflow,
} = vi.hoisted(() => ({
  mockGetSnapshot: vi.fn(),
  mockGetMessages: vi.fn(),
  mockGetActiveRuns: vi.fn(),
  mockPostMessage: vi.fn(),
  mockSubscribeToRun: vi.fn(),
  mockCancelRun: vi.fn(),
  mockGetThreadWorkflow: vi.fn(),
}))

// Match the transient/bug-260707-01 mocking strategy — stub @/lib/api fully so
// the eager Supabase client load (which fails without VITE_SUPABASE_URL) is
// never reached.
vi.mock("@/lib/api", () => ({
  getSnapshot: mockGetSnapshot,
  getMessages: mockGetMessages,
  getActiveRuns: mockGetActiveRuns,
  postMessage: mockPostMessage,
  subscribeToRun: mockSubscribeToRun,
  cancelRun: mockCancelRun,
  getThreadWorkflow: mockGetThreadWorkflow,
  getThreadTodos: vi.fn().mockResolvedValue([]),
  getThreadTasks: vi.fn().mockResolvedValue([]),
  ApiError: class ApiError extends Error {},
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

// IMPORT the provider AFTER the mocks.
import { StreamsProvider, useStreamActions } from "@/providers/StreamsProvider"
import { useStreamsStore } from "@/stores/streamsStore"
import type { ThreadSnapshot } from "@/lib/api"
import type { Message } from "@/types"

const THREAD_ID = "thread-watchdog"
const RUN_ID = "run-watchdog"

// The watchdog inactivity window is ~20s and the tick ~5s; advancing 6s fires
// exactly one tick, and (because the test seeds streamingThreads DIRECTLY, never
// stamping lastEventAt) the thread reads as immediately inactive on that tick.
const ADVANCE_PAST_TICK_MS = 6_000

function snapshotWithRun(streaming: boolean): ThreadSnapshot {
  return {
    messages: [],
    active_runs: streaming
      ? [{ run_id: RUN_ID, started_at: new Date().toISOString(), status: "streaming" }]
      : [],
    since_cursors: streaming ? { [RUN_ID]: "0" } : {},
  }
}

function streamingPlaceholder(): Message {
  return {
    id: `temp-${RUN_ID}`,
    thread_id: THREAD_ID,
    user_id: "",
    role: "assistant",
    content: "partial answer so far",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    tool_calls: [],
    runId: RUN_ID,
    runStatus: "streaming",
  }
}

function seedStreamingThread() {
  useStreamsStore.setState({
    streamingThreads: new Set<string>([THREAD_ID]),
    bucketsBySurface: new Map([
      ["chat", new Map<string, Message[]>([[THREAD_ID, [streamingPlaceholder()]]])],
    ]),
  })
}

function renderProvider() {
  return renderHook(() => useStreamActions(), {
    wrapper: ({ children }: { children: ReactNode }) =>
      createElement(StreamsProvider, null, children),
  })
}

function resetStore() {
  useStreamsStore.setState({
    bucketsBySurface: new Map(),
    viewedThreadId: null,
    streamingThreads: new Set<string>(),
    fallbackNotices: new Map<string, string>(),
    reconcileErrors: new Map<string, Error>(),
    loadingThreads: new Set<string>(),
    subscriptionsByThread: new Map<string, Set<string>>(),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  resetStore()
  mockGetMessages.mockResolvedValue([])
  mockGetActiveRuns.mockResolvedValue([])
  mockCancelRun.mockResolvedValue(undefined)
  mockGetThreadWorkflow.mockResolvedValue({ locked: false })
  // Reattached / send subscriptions stay open by default.
  mockSubscribeToRun.mockImplementation(() => new Promise<void>(() => {}))
})

afterEach(() => {
  vi.clearAllMocks()
})

// ─────────────────────────────────────────────────────────────────────────────
// Watchdog (fake timers) — D-145-03 / D-145-04
// ─────────────────────────────────────────────────────────────────────────────
describe("Phase 145-05 — inactivity watchdog (fake timers)", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it("watchdog silent-finalizes on terminal snapshot (D-145-03/04)", async () => {
    // getSnapshot probe returns a TERMINAL snapshot (no streaming run).
    mockGetSnapshot.mockResolvedValue(snapshotWithRun(false))

    const { unmount } = renderProvider()
    act(() => {
      seedStreamingThread()
    })

    // Advance past one watchdog tick; the seeded thread has no lastEventAt, so it
    // reads as inactive → the probe fires → terminal verdict → silent finalize.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ADVANCE_PAST_TICK_MS)
    })

    // Stop clears (streamingThreads no longer holds the thread) …
    expect(useStreamsStore.getState().streamingThreads.has(THREAD_ID)).toBe(false)
    // … and the placeholder runStatus flipped to "completed" (silent terminal-flip).
    const bucket =
      useStreamsStore.getState().bucketsBySurface.get("chat")?.get(THREAD_ID) ?? []
    expect(bucket.find((m) => m.runId === RUN_ID)?.runStatus).toBe("completed")
    // No banner / reconnecting copy: the message carries no runError.
    expect(bucket.find((m) => m.runId === RUN_ID)?.runError).toBeUndefined()
    unmount()
  })

  it("watchdog no-ops while the snapshot is still streaming (D-145-03)", async () => {
    // getSnapshot probe returns a STILL-STREAMING snapshot.
    mockGetSnapshot.mockResolvedValue(snapshotWithRun(true))

    const { unmount } = renderProvider()
    act(() => {
      seedStreamingThread()
    })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(ADVANCE_PAST_TICK_MS)
    })

    // The watchdog re-fetched, saw a live run, and left everything alone.
    expect(useStreamsStore.getState().streamingThreads.has(THREAD_ID)).toBe(true)
    const bucket =
      useStreamsStore.getState().bucketsBySurface.get("chat")?.get(THREAD_ID) ?? []
    expect(bucket.find((m) => m.runId === RUN_ID)?.runStatus).toBe("streaming")
    unmount()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// reconcile-DERIVE streamingThreads (Pattern 2 / U7) — both directions + guard
// ─────────────────────────────────────────────────────────────────────────────
describe("Phase 145-05 — reconcile-derived streamingThreads (Pattern 2 / U7)", () => {
  it("reconcile clears streamingThreads on a terminal snapshot (Direction A)", async () => {
    mockGetSnapshot.mockResolvedValue(snapshotWithRun(false))

    const { result } = renderProvider()
    act(() => {
      useStreamsStore.setState({ streamingThreads: new Set<string>([THREAD_ID]) })
    })

    await act(async () => {
      await result.current.reconcile(THREAD_ID)
    })

    // Direction A: runs.status is terminal → the Stop clears through the existing
    // selectors with no call-site change.
    expect(useStreamsStore.getState().streamingThreads.has(THREAD_ID)).toBe(false)
  })

  it("reconcile re-adds streamingThreads on an active snapshot (Direction B)", async () => {
    mockGetSnapshot.mockResolvedValue(snapshotWithRun(true))

    const { result } = renderProvider()
    // streamingThreads starts empty (beforeEach reset) — simulates a live run the
    // client lost track of (e.g. after an evicted stream).
    await act(async () => {
      await result.current.reconcile(THREAD_ID)
    })

    // Direction B: a still-active reconciled run RE-SHOWS Stop.
    expect(useStreamsStore.getState().streamingThreads.has(THREAD_ID)).toBe(true)
  })

  it("reconcile respects the sendingThreadsRef guard — never clobbers an in-flight send (Pitfall 1)", async () => {
    // postMessage never resolves → the send hangs, keeping the thread in BOTH
    // sendingThreadsRef and streamingThreads for the duration of the test.
    mockPostMessage.mockReturnValue(new Promise(() => {}))
    // A concurrent reconcile sees a TERMINAL snapshot (the derive would delete —
    // except for the in-flight-send guard).
    mockGetSnapshot.mockResolvedValue(snapshotWithRun(false))

    const { result } = renderProvider()

    // Kick off the send (optimistic writes + streamingThreads.add land
    // synchronously; postMessage then hangs).
    act(() => {
      void result.current.sendMessage(THREAD_ID, "hello")
    })
    expect(useStreamsStore.getState().streamingThreads.has(THREAD_ID)).toBe(true)

    await act(async () => {
      await result.current.reconcile(THREAD_ID)
    })

    // Guard held: the terminal-snapshot derive did NOT delete a thread with a
    // pending send.
    expect(useStreamsStore.getState().streamingThreads.has(THREAD_ID)).toBe(true)
  })
})
