/**
 * Phase 250 code review WR-06 — DOES `isStreaming || isLoading` EVER GO FALSE MID-RUN?
 *
 * `TodosSection.tsx` claims, as a fact, that OR-ing `useLoadingForThread` into
 * `useStreamingForThread` closes the window where `streamingThreads` reads empty for a
 * live run. That claim was untested, and `TodosSection.test.tsx` structurally cannot test
 * it: both selectors are `vi.fn()` there, so it pins the MOCK's ordering, not the
 * provider's.
 *
 * ⛔ THE TWO SETS ARE WRITTEN BY INDEPENDENT CODE PATHS.
 *   - `loadingThreads` — added at the TOP of `loadMessages`, removed in its `finally`.
 *   - `streamingThreads` — added by the reconcile-derive and by the send/reattach paths,
 *     none of which is `loadMessages`.
 *
 * ⚠ And `reconcile()` is NOT triggered by opening a thread: its listeners are
 * `visibilitychange` / `focus` / `pageshow`. So nothing in the code makes the two windows
 * abut — which is what this file measures against the REAL store rather than asserting.
 *
 * ⛔ EVERY ASSERTION READS THE STORE. The consequence being guarded is a user-visible
 * flash of `Not ticked` on live work, so the thing to sample is exactly what the two
 * selectors read, at every step.
 *
 * ⭐ VERDICT: THE WINDOW IS REAL. Both cases below PASS, which means the claim in
 * `TodosSection.tsx` was false — liveness reads FALSE after `loadMessages` resolves on a
 * thread whose run is live, and only `reconcile()` closes it. Filed as `BUG-260915-01`.
 *
 * ⛔ THESE ARE CHARACTERIZATION TESTS OF A DEFECT, SO A FAILURE HERE IS GOOD NEWS.
 * They assert the BROKEN ordering on purpose. When someone fixes the missing trigger,
 * `expect(afterLoad).toBe(false)` goes red — that is the suite telling them the bug is
 * gone, not that they broke something. Flip the expectation and close `BUG-260915-01`;
 * do NOT delete the file, because the window reopening silently is the failure mode that
 * produced it in the first place.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import type { ReactNode } from "react"

const { mockPostMessage, mockSubscribeToRun, mockGetMessages, mockGetActiveRuns,
        mockGetSnapshot, mockCancelRun, mockGetThreadWorkflow } = vi.hoisted(() => ({
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

const TID = "thread-wr06"

/** EXACTLY what `TodosSection` computes — the two selectors, OR-ed. */
function livenessNow(): boolean {
  const s = useStreamsStore.getState()
  return s.streamingThreads.has(TID) || s.loadingThreads.has(TID)
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
  mockGetSnapshot.mockResolvedValue({ messages: [], active_runs: [], since_cursors: {} })
  mockCancelRun.mockResolvedValue(undefined)
  mockGetThreadWorkflow.mockResolvedValue({ mode: "deep", active_workflow_run_id: null })
  mockSubscribeToRun.mockImplementation(
    async (_r: string, _s: string, _c: StreamCallbacks, _sig?: AbortSignal) =>
      new Promise<void>(() => {}),
  )
})

describe("WR-06 — the isStreaming || isLoading liveness window", () => {
  it("goes FALSE after loadMessages resolves on a thread whose run is live", async () => {
    // The scenario the claim is about: open a thread that already has a live run.
    // `loadMessages` marks loading, fetches, and clears loading in its `finally`.
    // Nothing in that path adds the thread to `streamingThreads`.
    const { result } = renderProvider()

    const samples: boolean[] = []
    mockGetMessages.mockImplementation(async () => {
      samples.push(livenessNow()) // mid-fetch: loading is set
      return []
    })

    await act(async () => {
      await result.current.loadMessages(TID)
    })
    samples.push(livenessNow()) // after the finally

    // ⚠ This documents the MEASURED behaviour, whichever way it falls. If the second
    // sample is false, the claim in TodosSection.tsx is wrong and the window is real.
    expect(samples[0]).toBe(true)
    expect(samples[samples.length - 1]).toBe(false)
  })

  it("is closed by reconcile() — but only once reconcile has RUN", async () => {
    // `reconcile` is what derives `streamingThreads` from the authoritative
    // `snapshot.active_runs`. It is listener-driven (visibilitychange / focus /
    // pageshow), so opening a thread does not call it.
    const { result } = renderProvider()
    mockGetSnapshot.mockResolvedValue({
      messages: [],
      active_runs: [{ run_id: "run-1", status: "streaming", last_event_id: "0-0" }],
      since_cursors: {},
    })

    await act(async () => {
      await result.current.loadMessages(TID)
    })
    const afterLoad = livenessNow()

    await act(async () => {
      await useStreamsStore.getState().actions.reconcile(TID)
    })
    const afterReconcile = livenessNow()

    expect(afterReconcile).toBe(true)
    // The gap between the two is the window the comment claims does not exist.
    expect(afterLoad).toBe(false)
  })
})
