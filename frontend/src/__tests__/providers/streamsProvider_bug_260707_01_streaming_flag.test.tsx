/**
 * BUG-260707-01 regression — streamingThreads must SURVIVE a transient
 * stream-end + reattach.
 *
 * Bug: `isStreaming = streamingThreads.has(threadId)` gates the composer's
 * Stop↔Send button, the composer's disabled state, and (via MessageItem.tsx:451)
 * the 👍/👎 MessageFeedback buttons. `streamingThreads` is added once at send
 * (StreamsProvider.tsx:1715) and deleted in the sendMessage `finally`
 * (:1968-1972) when the awaited subscribeToRun resolves at a stream-end.
 *
 * On a MULTI-ROUND run (e.g. an execute_code failure/retry that closes the SSE
 * at a turn boundary), the stream ends transiently → the finally deletes the
 * thread from streamingThreads → `onTerminal`'s async `_isTransientStreamEnd`
 * probe + `_reattachAfterTransient` open a NEW subscription to finish the run.
 * Pre-fix, the reattach re-added only `subscriptionsByThread`, NOT
 * `streamingThreads` — so `isStreaming` read false for the REST of the run and
 * the UI flipped to a premature "done" state (Send button + feedback thumbs)
 * while the run was still streaming.
 *
 * Fix (StreamsProvider.tsx reattach callback): re-add threadId to
 * streamingThreads alongside subscriptionsByThread. subscribeToRun calls
 * onTerminal WITHOUT await (api.ts) and returns immediately, so the finally
 * delete lands BEFORE the reattach re-add — delete-then-readd nets to "present".
 *
 * This test drives the exact sequence: send → 1st subscribeToRun fires
 * onTerminal("reader_done") + resolves (→ finally deletes) → transient probe
 * sees a streaming snapshot → reattach opens a 2nd subscription (→ re-adds).
 * Asserts streamingThreads.has(THREAD_ID) is TRUE after reattach. Pre-fix this
 * assertion FAILS (stays deleted).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, waitFor, act } from "@testing-library/react"
import type { ReactNode } from "react"

const {
  mockPostMessage,
  mockSubscribeToRun,
  mockGetMessages,
  mockGetActiveRuns,
  mockGetSnapshot,
  mockCancelRun,
} = vi.hoisted(() => ({
  mockPostMessage: vi.fn(),
  mockSubscribeToRun: vi.fn(),
  mockGetMessages: vi.fn(),
  mockGetActiveRuns: vi.fn(),
  mockGetSnapshot: vi.fn(),
  mockCancelRun: vi.fn(),
}))

vi.mock("@/lib/api", () => ({
  postMessage: mockPostMessage,
  subscribeToRun: mockSubscribeToRun,
  getMessages: mockGetMessages,
  getActiveRuns: mockGetActiveRuns,
  getSnapshot: mockGetSnapshot,
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

import { StreamsProvider, useStreamActions } from "@/providers/StreamsProvider"
import { useStreamsStore } from "@/stores/streamsStore"
import type { StreamCallbacks } from "@/lib/api"

function renderProvider() {
  return renderHook(() => useStreamActions(), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <StreamsProvider>{children}</StreamsProvider>
    ),
  })
}

const THREAD_ID = "thread-transient"
const RUN_ID = "run-transient"

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
  })
  mockGetMessages.mockResolvedValue([])
  mockGetActiveRuns.mockResolvedValue([])
  mockCancelRun.mockResolvedValue(undefined)
  mockPostMessage.mockResolvedValue({ run_id: RUN_ID, message_id: "real-user-msg" })
  // First getSnapshot (reconcile at setViewingThread) → no active runs, so
  // reconcile opens no subscription. Later getSnapshot (the transient probe
  // inside onTerminal) → the run is STILL streaming, so _isTransientStreamEnd
  // treats reader_done as transient and reattach fires.
  mockGetSnapshot
    .mockResolvedValueOnce({ messages: [], active_runs: [], since_cursors: {} })
    .mockResolvedValue({
      messages: [],
      active_runs: [{ run_id: RUN_ID, started_at: new Date().toISOString(), status: "streaming" }],
      since_cursors: { [RUN_ID]: "0" },
    })
})

afterEach(() => {
  vi.clearAllMocks()
})

describe("BUG-260707-01 — streamingThreads survives a transient stream-end + reattach", () => {
  it("keeps the thread in streamingThreads after a reader_done→reattach (composer stays Stop; no premature feedback)", async () => {
    // 1st subscribeToRun = the initial stream: mirror api.ts by firing
    // onTerminal WITHOUT await, then resolving so the sendMessage `await
    // subscribeToRun` completes and its finally runs. 2nd call = the reattach:
    // stays open (the run is still streaming).
    let subCalls = 0
    mockSubscribeToRun.mockImplementation(
      async (_rid: string, _since: string, cb: StreamCallbacks, _signal?: AbortSignal) => {
        subCalls += 1
        if (subCalls === 1) {
          cb.onTerminal?.("reader_done") // fire-and-forget, exactly like api.ts
          return
        }
        return new Promise<void>(() => {}) // reattached subscription stays open
      },
    )

    const { result } = renderProvider()

    // Thread must be viewed to enter the stream pool (isThreadInStreamPool gates
    // both the initial subscribe and the reattach).
    await act(async () => {
      result.current.setViewingThread(THREAD_ID)
    })

    await act(async () => {
      await result.current.sendMessage(THREAD_ID, "run some code that fails then retries")
    })

    // The reattach opens a SECOND subscription — wait for it, which also drains
    // the finally (delete) + reattach (re-add) microtask chain.
    await waitFor(() => expect(mockSubscribeToRun).toHaveBeenCalledTimes(2))

    // THE INVARIANT: the thread is still "streaming" after the transient
    // reattach, so isStreaming (= streamingThreads.has) stays true → composer
    // keeps Stop, feedback thumbs stay hidden. Pre-fix this is false.
    await waitFor(() => {
      expect(useStreamsStore.getState().streamingThreads.has(THREAD_ID)).toBe(true)
    })
  })
})
