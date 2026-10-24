/**
 * Phase 292.1 G-4 (lived UAT, 2026-10-24) — a first-turn cap pause keeps its Continue card LIVE.
 *
 * Measured in Chrome (thread 9f2fd306 / run 5c95a0d4, deepseek-v4-pro; and thread 4f4a977a,
 * gemini-3.8-flash): a Deep turn hits the tool-round cap on its FIRST turn, the backend emits the
 * non-terminal `cap_paused` SSE (the card appears), then finalizes the run `completed` BY DESIGN
 * (the pause lives in the carrier row — `app.db.runs.run_is_cap_paused`) and ends the stream with a
 * normal `done`. The sendMessage terminal wrapper cleared the lock unconditionally, so the card
 * vanished; a reload brought it back (GET /threads/{id}/workflow reports `cap_paused: true`).
 *
 * The fix asks the server instead of guessing (D-v2.5-03): a `done` for the run this thread's lock
 * holds as cap-paused goes through the shipped settle read (`releaseSettledWorkflowLock`). Every
 * other terminal is unchanged.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, act, waitFor, cleanup } from "@testing-library/react"

const { mockPostMessage, mockSubscribeToRun, mockGetMessages, mockGetActiveRuns, mockGetSnapshot, mockGetThreadWorkflow } =
  vi.hoisted(() => ({
    mockPostMessage: vi.fn(),
    mockSubscribeToRun: vi.fn(),
    mockGetMessages: vi.fn(),
    mockGetActiveRuns: vi.fn(),
    mockGetSnapshot: vi.fn(),
    mockGetThreadWorkflow: vi.fn(),
  }))

vi.mock("@/lib/api", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/api")>()
  return {
    ...actual,
    postMessage: mockPostMessage,
    subscribeToRun: mockSubscribeToRun,
    getMessages: mockGetMessages,
    getActiveRuns: mockGetActiveRuns,
    getSnapshot: mockGetSnapshot,
    getThreadWorkflow: mockGetThreadWorkflow,
  }
})

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

const THREAD = "thread-g41"
const RUN = "run-g41"

type Terminal = "done" | "error" | "cancelled" | "timed_out" | "reader_done"
type Cbs = {
  onCapPaused?: (info: { runId: string; toolNames: string[]; continuesUsed: number; continuesRemaining: number }) => void
  onTerminal: (kind: Terminal, errorPayload?: string) => Promise<void> | void
}

let actions: ReturnType<typeof useStreamActions> | null = null
let callbacks: Cbs | null = null

function Capture() {
  actions = useStreamActions()
  return null
}

function reset() {
  useStreamsStore.setState({
    bucketsBySurface: new Map(),
    streamingThreads: new Set(),
    harnessKickoffThreads: new Set(),
    workflowLockByThread: new Map(),
    continuingThreads: new Set(),
  })
}

/** The server's answer to the settle read, in the shape `GET /threads/{id}/workflow` returns. */
function wfRead(capPaused: boolean) {
  return {
    locked: false,
    lock_is_stale: false,
    active_workflow_run_id: null,
    latest_producer_run_id: RUN,
    mode: "cap_paused",
    cap_paused: capPaused,
    continues_remaining: 3,
    run_status: null,
    phases: [],
    total_phases: 0,
    current_phase_index: 0,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  actions = null
  callbacks = null
  reset()
  mockGetMessages.mockResolvedValue([])
  mockGetActiveRuns.mockResolvedValue({ active_runs: [] })
  mockGetSnapshot.mockResolvedValue({ messages: [], active_runs: [], since_cursors: {} })
  // The mount reconcile's read hangs, so it never writes a lock of its own into these cases.
  mockGetThreadWorkflow.mockReturnValue(new Promise(() => {}))
  mockPostMessage.mockResolvedValue({ message_id: "msg-g41", run_id: RUN })
  mockSubscribeToRun.mockImplementation(async (_rid: string, _since: string, cbs: Cbs) => {
    callbacks = cbs
    return new Promise<void>(() => {})
  })
})

afterEach(() => {
  cleanup()
  reset()
})

/** Mount, view the thread (only a pooled thread opens a stream), and send a Deep turn. */
async function sendDeepTurn() {
  render(
    <StreamsProvider>
      <Capture />
    </StreamsProvider>,
  )
  await waitFor(() => expect(actions).not.toBeNull())
  await act(async () => {
    actions!.setViewingThread(THREAD)
  })
  await waitFor(() => expect(mockGetThreadWorkflow).toHaveBeenCalled())
  await act(async () => {
    void actions!.sendMessage(THREAD, "research this thoroughly")
  })
  await waitFor(() => expect(callbacks).not.toBeNull())
}

function capPause() {
  act(() => {
    callbacks!.onCapPaused!({ runId: RUN, toolNames: ["search_documents"], continuesUsed: 0, continuesRemaining: 3 })
  })
  expect(useStreamsStore.getState().workflowLockByThread.get(THREAD)?.capPaused).toBe(true)
}

async function terminal(kind: Terminal) {
  await act(async () => {
    await callbacks!.onTerminal(kind)
  })
}

const lock = () => useStreamsStore.getState().workflowLockByThread.get(THREAD)

describe("292.1 G-4 — a `done` after a live cap pause asks the server before clearing the card", () => {
  it("A: the server still reports cap_paused → the lock (the Continue card) survives the terminal", async () => {
    await sendDeepTurn()
    capPause()
    const readsBefore = mockGetThreadWorkflow.mock.calls.length
    mockGetThreadWorkflow.mockResolvedValue(wfRead(true))
    await terminal("done")
    await waitFor(() => expect(mockGetThreadWorkflow.mock.calls.length).toBe(readsBefore + 1))
    await act(async () => {
      await Promise.resolve()
    })
    expect(lock()?.capPaused).toBe(true)
    expect(lock()?.runId).toBe(RUN)
    // The settle keeps the lock WITHOUT re-attaching the run that just ended: the send's own
    // stream is the only subscription ever opened.
    expect(mockSubscribeToRun).toHaveBeenCalledTimes(1)
  })

  it("B: the server reports no pause → the lock is cleared, after the read", async () => {
    await sendDeepTurn()
    capPause()
    const readsBefore = mockGetThreadWorkflow.mock.calls.length
    mockGetThreadWorkflow.mockResolvedValue(wfRead(false))
    await terminal("done")
    await waitFor(() => expect(lock()).toBeUndefined())
    expect(mockGetThreadWorkflow.mock.calls.length).toBeGreaterThan(readsBefore)
  })

  it("C: a `done` with NO pause this stream clears the lock at once, with no read (unchanged)", async () => {
    await sendDeepTurn()
    // A pause from an EARLIER run on this thread — not this stream's run.
    useStreamsStore.setState({
      workflowLockByThread: new Map([
        [THREAD, { runId: "run-earlier", mode: "cap_paused" as const, capPaused: true, continuesRemaining: 2 }],
      ]),
    })
    const readsBefore = mockGetThreadWorkflow.mock.calls.length
    await terminal("done")
    expect(lock()).toBeUndefined()
    expect(mockGetThreadWorkflow.mock.calls.length).toBe(readsBefore)
  })

  it("D: a non-`done` terminal after a pause still clears at once, with no read (unchanged)", async () => {
    await sendDeepTurn()
    capPause()
    const readsBefore = mockGetThreadWorkflow.mock.calls.length
    await terminal("cancelled")
    expect(lock()).toBeUndefined()
    expect(mockGetThreadWorkflow.mock.calls.length).toBe(readsBefore)
  })
})
