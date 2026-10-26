/**
 * Phase 296-04 (BUG-261024-04, frontend lead (3) — D-10, measure first).
 *
 * Reported: each follow-up chat turn re-lists every file an earlier turn made. RESEARCH F10 names
 * three leads; (1) and (2) are backend and are measured in 296-06. Lead (3) is the client merge:
 * `onFinalOutputFiles` stamping a turn's file list onto the wrong assistant message, or folding
 * the previous turn's list into the new one.
 *
 * This suite drives two real turns through the provider over a mocked API and asserts that the
 * second turn's `final_output_files` lands ONLY on the second turn's assistant message, and that
 * the first turn's list is neither re-merged onto it nor overwritten.
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
    wrapper: ({ children }: { children: ReactNode }) => <StreamsProvider>{children}</StreamsProvider>,
  })
}

const THREAD_ID = "thread-296-files"
const RUN_1 = "run-turn-1"
const RUN_2 = "run-turn-2"

const TURN_1_FILES = [
  { filename: "report.pdf", url: "https://x/report.pdf", size: 10, is_hero: true },
  { filename: "chart_1.png", url: "https://x/chart_1.png", size: 5, is_hero: false },
]
const TURN_2_FILES = [{ filename: "report_v2.pdf", url: "https://x/report_v2.pdf", size: 11, is_hero: true }]

const bucket = () => useStreamsStore.getState().bucketsBySurface.get("chat")?.get(THREAD_ID) ?? []
const filesOf = (runId: string) =>
  (bucket().find((m) => m.role === "assistant" && m.runId === runId)?.finalOutputFiles ?? []).map(
    (f) => f.filename,
  )

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  useStreamsStore.setState({
    bucketsBySurface: new Map(),
    viewedThreadId: null,
    streamingThreads: new Set<string>(),
    reconcileErrors: new Map<string, Error>(),
    loadingThreads: new Set<string>(),
    subscriptionsByThread: new Map<string, Set<string>>(),
  })
  mockGetActiveRuns.mockResolvedValue([])
  mockCancelRun.mockResolvedValue(undefined)
  mockGetSnapshot.mockResolvedValue({ messages: [], active_runs: [], since_cursors: {} })
})

afterEach(() => {
  vi.clearAllMocks()
})

describe("296-04 / BUG-261024-04 lead (3) — a follow-up turn's files stamp only that turn", () => {
  it("turn 2's final_output_files land on turn 2 alone; turn 1 keeps its own list", async () => {
    // Turn 1 runs to the end; the reload-shaped persisted rows carry its own files.
    mockGetMessages.mockResolvedValue([
      {
        id: "u-1",
        thread_id: THREAD_ID,
        user_id: "user-1",
        role: "user",
        content: "Make a PDF with 3 charts",
        created_at: "2026-10-26T00:00:00Z",
        updated_at: "2026-10-26T00:00:00Z",
        tool_calls: [],
      },
      {
        id: "a-1",
        thread_id: THREAD_ID,
        user_id: "user-1",
        role: "assistant",
        content: "Here is the PDF.",
        created_at: "2026-10-26T00:00:01Z",
        updated_at: "2026-10-26T00:00:01Z",
        runId: RUN_1,
        runStatus: "completed",
        finalOutputFiles: TURN_1_FILES,
        tool_calls: [],
      },
    ])
    const streams = new Map<string, StreamCallbacks>()
    mockSubscribeToRun.mockImplementation(async (runId: string, _since: string, cb: StreamCallbacks) => {
      streams.set(runId, cb)
      if (runId === RUN_1) {
        cb.onDelta?.("Here is the PDF.")
        cb.onFinalOutputFiles?.(TURN_1_FILES)
        cb.onTerminal?.("done")
        return
      }
      // Turn 2 stays live, so nothing but the stamp under test can write its files.
      return new Promise<void>(() => {})
    })

    const { result } = renderProvider()
    await act(async () => {
      result.current.setViewingThread(THREAD_ID)
    })

    mockPostMessage.mockResolvedValueOnce({ run_id: RUN_1, message_id: "u-1" })
    await act(async () => {
      await result.current.sendMessage(THREAD_ID, "Make a PDF with 3 charts")
    })
    await waitFor(() => expect(filesOf(RUN_1)).toEqual(["report.pdf", "chart_1.png"]))

    mockPostMessage.mockResolvedValueOnce({ run_id: RUN_2, message_id: "u-2" })
    await act(async () => {
      void result.current.sendMessage(THREAD_ID, "Change the title")
    })
    await waitFor(() => expect(streams.has(RUN_2)).toBe(true))
    await act(async () => {
      streams.get(RUN_2)!.onFinalOutputFiles?.(TURN_2_FILES)
    })

    await waitFor(() =>
      expect(filesOf(RUN_2), "turn 2's card lists files turn 2 did not make").toEqual(["report_v2.pdf"]),
    )
    expect(filesOf(RUN_1), "turn 2's list was stamped onto turn 1").toEqual(["report.pdf", "chart_1.png"])
  })
})
