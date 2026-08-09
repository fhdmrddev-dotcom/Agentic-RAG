/**
 * BUG-260707-03 regression — at a clean Deep terminal, the accumulated
 * narration+answer blob must RESOLVE to the persisted clean final answer LIVE.
 *
 * Bug: onDelta only APPENDS (StreamsProvider.tsx:358 invariant), so the live
 * message.content is the whole run's narration + final answer concatenated. While
 * runStatus === "streaming", StreamingNarration folds that blob to a gist; the
 * final answer streams in as the blob's tail and stays folded — it only
 * "resolves" to the backend's clean persisted answer on a later reload/navigation
 * (regular chat has no run-completed content reconcile — onRunCompleted is
 * harness-only).
 *
 * Fix (StreamsProvider send-path onTerminal, done/reader_done): fire-and-forget
 * getMessages(threadId), find this run's persisted assistant message by runId, and
 * swap ONLY that bucket message's content to the persisted answer — so the fold
 * gives way to a clean, separated answer live, without a reload. Scoped to content
 * (preserves tool_calls / suggestions / files / runStatus).
 *
 * This test streams a multi-part blob then a clean terminal, mocks getMessages to
 * return the clean persisted answer, and asserts the bucket message's content is
 * reconciled from the blob to the clean answer. Pre-fix it stays the blob.
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

const THREAD_ID = "thread-resolve"
const RUN_ID = "run-resolve"
const BLOB =
  "Let me search the knowledge base. Now I'll generate the chart. Here is the blob answer tail."
const CLEAN_ANSWER = "Here's your chart: **chart.png** — a clean, separated final answer."

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
  mockGetActiveRuns.mockResolvedValue([])
  mockCancelRun.mockResolvedValue(undefined)
  mockPostMessage.mockResolvedValue({ run_id: RUN_ID, message_id: "real-user-msg" })
  mockGetSnapshot.mockResolvedValue({ messages: [], active_runs: [], since_cursors: {} })
  // The persisted assistant answer the backend saved (last iteration = clean answer),
  // tagged with this run's id so the terminal reconcile matches it by runId.
  mockGetMessages.mockResolvedValue([
    {
      id: "persisted-assistant",
      thread_id: THREAD_ID,
      user_id: "user-1",
      role: "assistant",
      content: CLEAN_ANSWER,
      created_at: "2026-07-07T00:00:00Z",
      updated_at: "2026-07-07T00:00:00Z",
      runId: RUN_ID,
      runStatus: "completed",
      tool_calls: [],
    },
  ])
})

afterEach(() => {
  vi.clearAllMocks()
})

describe("BUG-260707-03 — clean Deep terminal resolves the folded blob to the persisted final answer", () => {
  it("swaps the accumulated narration+answer blob for the clean persisted answer, live (no reload)", async () => {
    // The initial stream: append a multi-part blob (narration + answer tail), then
    // a clean terminal. Mirrors api.ts (onTerminal fired without await, then return).
    mockSubscribeToRun.mockImplementation(
      async (_rid: string, _since: string, cb: StreamCallbacks, _signal?: AbortSignal) => {
        cb.onDelta?.("Let me search the knowledge base. ")
        cb.onDelta?.("Now I'll generate the chart. ")
        cb.onDelta?.("Here is the blob answer tail.")
        cb.onTerminal?.("done")
      },
    )

    const { result } = renderProvider()
    await act(async () => {
      result.current.setViewingThread(THREAD_ID)
    })
    await act(async () => {
      await result.current.sendMessage(THREAD_ID, "do a multi-step thing")
    })

    // The onDelta stream accumulated the narration+answer BLOB onto the message
    // (that is what StreamingNarration folds). After the clean terminal, the
    // fire-and-forget getMessages reconcile swaps the blob for the persisted clean
    // answer. Pre-fix the content stays BLOB and this waitFor times out.
    expect(BLOB).not.toBe(CLEAN_ANSWER) // guard: the two are distinguishable
    await waitFor(() => {
      const bucket =
        useStreamsStore.getState().bucketsBySurface.get("chat")?.get(THREAD_ID) ?? []
      const asst = bucket.find((m) => m.role === "assistant" && m.runId === RUN_ID)
      expect(asst?.content).toBe(CLEAN_ANSWER)
    })
  })
})

/**
 * Phase 176 RENDER-02 (D-07) — the un-fold must ALSO happen on the mount/reconcile
 * path, not only the send path. A backgrounded parallel-thread run reaches its clean
 * terminal on the MOUNT-path onTerminal (StreamsProvider.tsx:1571-1663), which set
 * runStatus + cleaned subscriptions but had NO content-reconcile — so on switch-back
 * the folded blob only resolved on a full reload (the SC#10 parallel-thread residual
 * of BUG-260707-03).
 *
 * Fix: mirror the applied send-path reconcile (:2004-2027) into the mount-path
 * onTerminal, keyed on `run.run_id` (registeredRunId is undefined on this path —
 * Pitfall 2). Content-only swap: runStatus / tool fields are preserved.
 */
describe("Phase 176 RENDER-02 (D-07) — clean terminal on the MOUNT/reconcile path un-folds by run.run_id (no reload)", () => {
  it("swaps the backgrounded run's assistant blob for the persisted answer on the mount-path onTerminal, keyed on run.run_id, content-only (in place)", async () => {
    // reconcile (fired by setViewingThread) discovers the run via the snapshot's
    // active_runs, opens a subscription, the stream appends the narration+answer
    // BLOB, then reaches a clean terminal on the MOUNT-path onTerminal — the
    // send-path onTerminal (:2004-2027) never runs here (no sendMessage call).
    mockGetSnapshot.mockResolvedValue({
      messages: [],
      active_runs: [{ run_id: RUN_ID, status: "streaming", started_at: "2026-07-07T00:00:00Z" }],
      since_cursors: {},
    })
    // ISOLATION: the mock fires onDelta + onTerminal but NEVER resolves. The
    // reconcile-path subscribeToRun has a `.finally()` loadMessages "floor"
    // (StreamsProvider.tsx:1711-1714) that also fetches getMessages and does a
    // full-replace merge — leaving the promise pending keeps that floor from
    // firing so the ONLY thing that can un-fold the blob is the mount-path
    // onTerminal content-reconcile under test (a full-replace would also swap the
    // id to the persisted "persisted-assistant" row; we assert the id is
    // PRESERVED to prove it was the content-only in-place swap, not the reload).
    mockSubscribeToRun.mockImplementation(
      async (_rid: string, _since: string, cb: StreamCallbacks, _signal?: AbortSignal) => {
        cb.onDelta?.("Let me search the knowledge base. ")
        cb.onDelta?.("Now I'll generate the chart. ")
        cb.onDelta?.("Here is the blob answer tail.")
        cb.onTerminal?.("done")
        return new Promise<void>(() => {})
      },
    )

    const { result } = renderProvider()
    await act(async () => {
      result.current.setViewingThread(THREAD_ID)
    })

    // The mount-path content-reconcile fires getMessages and swaps ONLY this run's
    // assistant content to the persisted clean answer, keyed on run.run_id. Pre-fix
    // (no content-reconcile + floor suppressed) the content stays BLOB → timeout.
    expect(BLOB).not.toBe(CLEAN_ANSWER)
    await waitFor(() => {
      const bucket =
        useStreamsStore.getState().bucketsBySurface.get("chat")?.get(THREAD_ID) ?? []
      const asst = bucket.find((m) => m.role === "assistant" && m.runId === RUN_ID)
      expect(asst?.content).toBe(CLEAN_ANSWER)
    })
    // getMessages was invoked by the reconcile (no full reload merged it — the
    // floor is suppressed), and the swap was CONTENT-ONLY in place: the streaming
    // placeholder keeps its temp id + terminal runStatus (tool fields preserved),
    // rather than being replaced by the persisted "persisted-assistant" row.
    expect(mockGetMessages).toHaveBeenCalledWith(THREAD_ID)
    const bucket =
      useStreamsStore.getState().bucketsBySurface.get("chat")?.get(THREAD_ID) ?? []
    const asst = bucket.find((m) => m.role === "assistant" && m.runId === RUN_ID)
    expect(asst?.id.startsWith("temp-")).toBe(true)
    expect(asst?.runStatus).toBe("completed")
  })
})
