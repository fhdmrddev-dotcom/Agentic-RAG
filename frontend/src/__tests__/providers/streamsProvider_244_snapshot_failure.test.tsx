/**
 * Phase 244 plan 11 (SHELL-01 / UAT gap G-3) — A FAILED SNAPSHOT MUST REACH STATE.
 *
 * DRIVEN 2026-09-12 during Phase 244's UAT: `GET /threads/{id}/snapshot` returned **503**
 * on 2 of 4 observed calls. When it fails the thread header and composer render normally
 * and the TRANSCRIPT IS SILENTLY INCOMPLETE — a sweep of EVERY leaf element for
 * /unavailable|error|failed|retry|try again|something went wrong/i returned ZERO matches.
 * The backend is explicit (`{"detail": "Streaming infrastructure unavailable"}` +
 * `Retry-After: 10`, threads.py:517/:526); the UI discarded both.
 *
 * The swallow was ONE clause, in `StreamsProvider.tsx`'s `reconcile` action:
 *
 *     try { snapshot = await getSnapshot(threadId) }
 *     catch (err) { console.error("reconcile failed:", err); return }
 *
 * ⚠ `frontend/src/lib/api/threads.ts:1063`'s own docstring claims *"Both surface as a
 * generic Error to the caller; the StreamsProvider consumer routes via its existing error
 * handler."* **There was no such routing.** The console.error WAS the handler.
 *
 * ⛔ EVERY ASSERTION HERE READS THE STORE, NEVER A `console.error` SPY. A console call is
 * not a user-visible state, and treating it as one is precisely what made this gap
 * invisible for the life of the feature.
 *
 * ⛔ The rejection fixture uses the client's REAL throw shape — a BARE
 * `Error("Failed to fetch snapshot (status 503)")`, not an `ApiError`, because
 * `getSnapshot` throws exactly that (`threads.ts:1067`). A fixture that invents its own
 * error shape is the "the test constructs the shape it then asserts" failure that let this
 * phase's G-6 ship green.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import type { ReactNode } from "react"

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
  getSnapshot: mockGetSnapshot,
  cancelRun: mockCancelRun,
  getThreadWorkflow: mockGetThreadWorkflow,
  // The provider's non-dispatch early-return constructs an ApiError; a mock factory is an
  // ALLOW-LIST, so an omitted export throws rather than falling back to the real module.
  ApiError: class ApiError extends Error {
    status: number
    constructor(message: string, status: number) {
      super(message)
      this.name = "ApiError"
      this.status = status
    }
  },
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

import { StreamsProvider, useStreamActions } from "@/providers/StreamsProvider"
import { useStreamsStore } from "@/stores/streamsStore"
import type { StreamCallbacks } from "@/lib/api"

/** The client's REAL throw for a 503 — `threads.ts:1067`, verbatim shape. */
const SNAPSHOT_503 = () => new Error("Failed to fetch snapshot (status 503)")

const EMPTY_SNAPSHOT = {
  messages: [],
  active_runs: [],
  since_cursors: {},
}

function renderProvider() {
  return renderHook(() => useStreamActions(), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <StreamsProvider>{children}</StreamsProvider>
    ),
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
    failedSendDrafts: new Map<string, string>(),
    loadingThreads: new Set<string>(),
    subscriptionsByThread: new Map<string, Set<string>>(),
    workflowLockByThread: new Map(),
  })
  mockGetMessages.mockResolvedValue([])
  mockGetActiveRuns.mockResolvedValue([])
  mockCancelRun.mockResolvedValue(undefined)
  mockGetThreadWorkflow.mockResolvedValue({ mode: "deep", active_workflow_run_id: null })
  mockSubscribeToRun.mockImplementation(
    async (_runId: string, _since: string, _cb: StreamCallbacks, _signal?: AbortSignal) => {
      return new Promise<void>(() => {})
    },
  )
})

afterEach(() => {
  vi.clearAllMocks()
})

describe("244-11 / G-3 — a snapshot failure reaches the per-thread error slice", () => {
  it("Test 1 (THE GAP) — a 503 from getSnapshot writes the thread's reconcileErrors entry", async () => {
    const THREAD_ID = "thread-503"
    const thrown = SNAPSHOT_503()
    mockGetSnapshot.mockRejectedValue(thrown)

    const { result } = renderProvider()

    await act(async () => {
      await result.current.reconcile(THREAD_ID)
    })

    // ⛔ THE STORE, not a console spy. Pre-fix this Map is EMPTY and the UI has nothing
    // to render — that is the whole defect, in one assertion.
    expect(useStreamsStore.getState().reconcileErrors.has(THREAD_ID)).toBe(true)
    expect(useStreamsStore.getState().reconcileErrors.get(THREAD_ID)).toBe(thrown)
    expect(useStreamsStore.getState().reconcileErrors.get(THREAD_ID)?.message).toBe(
      "Failed to fetch snapshot (status 503)",
    )
  })

  it("Test 2 (CONTROL — the happy path is untouched) — a resolving snapshot writes NO error and hydrates", async () => {
    const THREAD_ID = "thread-ok"
    mockGetSnapshot.mockResolvedValue({
      ...EMPTY_SNAPSHOT,
      messages: [
        {
          id: "m-1",
          thread_id: THREAD_ID,
          user_id: "user-1",
          role: "user",
          content: "hello",
          created_at: "2026-09-12T00:00:00Z",
          updated_at: "2026-09-12T00:00:00Z",
          tool_calls: [],
        },
      ],
    })

    const { result } = renderProvider()

    await act(async () => {
      await result.current.reconcile(THREAD_ID)
    })

    expect(useStreamsStore.getState().reconcileErrors.has(THREAD_ID)).toBe(false)
    const bucket =
      useStreamsStore.getState().bucketsBySurface.get("chat")?.get(THREAD_ID) ?? []
    expect(bucket.map((m) => m.id)).toEqual(["m-1"])
  })

  it("Test 3 (CONTROL — a navigation is not a failure) — an AbortError writes NOTHING", async () => {
    // `reconcile` is fired from `setViewingThread` on EVERY thread switch. Without this
    // arm, every switch that cancels an in-flight snapshot would raise a banner on
    // arrival at the thread the person actually wanted.
    const THREAD_ID = "thread-aborted"
    mockGetSnapshot.mockRejectedValue(new DOMException("aborted", "AbortError"))

    const { result } = renderProvider()

    await act(async () => {
      await result.current.reconcile(THREAD_ID)
    })

    expect(useStreamsStore.getState().reconcileErrors.has(THREAD_ID)).toBe(false)
  })

  it("Test 4 (CONTROL — the slice is per-thread) — a failure on A leaves B clean", async () => {
    // D-075.4-A1: `reconcileErrors` is a per-thread Map. A bleed here puts a failure
    // banner on a conversation that is perfectly fine.
    const THREAD_A = "thread-A"
    const THREAD_B = "thread-B"
    mockGetSnapshot.mockRejectedValue(SNAPSHOT_503())

    const { result } = renderProvider()

    await act(async () => {
      await result.current.reconcile(THREAD_A)
    })

    expect(useStreamsStore.getState().reconcileErrors.has(THREAD_A)).toBe(true)
    expect(useStreamsStore.getState().reconcileErrors.has(THREAD_B)).toBe(false)
  })
})
