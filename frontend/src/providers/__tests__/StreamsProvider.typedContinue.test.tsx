/**
 * Phase 292.1 (BUG-261024-03, D-12 / D-14 / D-15 / D-16) — a typed continue behaves like the button.
 *
 * When the server resumes a paused run from a typed continue word, its reply is
 * `{continued: true, run_id, message_id: null, …}`: no user message row exists and no new run
 * started. So the browser must show NO user bubble and NO second assistant placeholder, and the
 * Continue card must read "Continuing…" (the `continuingThreads` slice).
 *
 * The client's word match is only a HINT (it skips the optimistic bubbles up front, so nothing
 * flashes). The server decides: a normal 201 for a hinted word inserts the bubbles late and runs the
 * ordinary path (D-15 / D-16), and an unexpected `continued: true` for un-hinted text removes the
 * bubbles it inserted (RESEARCH Pitfall 9: no ghost bubble).
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
import { useStreamsStore, markContinuing } from "@/stores/streamsStore"

const THREAD = "thread-2921"
const DEEP_PAUSE = { runId: "run-cap-1", mode: "cap_paused" as const, capPaused: true, continuesRemaining: 2 }
const CONTINUED = {
  continued: true,
  run_id: "run-cap-1",
  message_id: null,
  continues_used: 2,
  continues_remaining: 1,
}
let actions: ReturnType<typeof useStreamActions> | null = null

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

beforeEach(() => {
  vi.clearAllMocks()
  actions = null
  reset()
  mockGetMessages.mockResolvedValue([])
  mockGetActiveRuns.mockResolvedValue({ active_runs: [] })
  mockGetSnapshot.mockResolvedValue({ messages: [], active_runs: [] })
  mockGetThreadWorkflow.mockReturnValue(new Promise(() => {}))
  mockPostMessage.mockReturnValue(new Promise(() => {}))
  mockSubscribeToRun.mockImplementation(async () => new Promise<void>(() => {}))
})

afterEach(() => {
  cleanup()
  reset()
})

async function mountProvider() {
  render(
    <StreamsProvider>
      <Capture />
    </StreamsProvider>,
  )
  await waitFor(() => expect(actions).not.toBeNull())
}

function seedPause() {
  useStreamsStore.setState({ workflowLockByThread: new Map([[THREAD, DEEP_PAUSE]]) })
}

const bucket = () => useStreamsStore.getState().bucketsBySurface.get("chat")?.get(THREAD) ?? []

describe("292.1 D-14 — a typed continue that resumes shows no bubbles and reads Continuing…", () => {
  it("A: a continue word on a Deep pause, answered continued:true, inserts nothing", async () => {
    await mountProvider()
    seedPause()
    mockPostMessage.mockResolvedValue(CONTINUED)
    await act(async () => {
      await actions!.sendMessage(THREAD, "continue")
    })
    expect(mockPostMessage).toHaveBeenCalledTimes(1)
    expect(bucket().filter((m) => m.role === "user")).toHaveLength(0)
    expect(bucket().filter((m) => m.role === "assistant")).toHaveLength(0)
    expect(useStreamsStore.getState().continuingThreads.has(THREAD)).toBe(true)
    expect(useStreamsStore.getState().streamingThreads.has(THREAD)).toBe(false)
    expect(mockSubscribeToRun).not.toHaveBeenCalled()
  })

  it("A2: no optimistic bubble is shown while the typed continue is in flight", async () => {
    await mountProvider()
    seedPause()
    await act(async () => {
      void actions!.sendMessage(THREAD, "Continue.")
    })
    expect(mockPostMessage).toHaveBeenCalledTimes(1)
    expect(bucket()).toHaveLength(0)
  })

  it("B: the same word answered with a normal 201 runs the ordinary path (D-15/D-16)", async () => {
    await mountProvider()
    seedPause()
    mockPostMessage.mockResolvedValue({ message_id: "msg-1", run_id: "run-new" })
    await act(async () => {
      void actions!.sendMessage(THREAD, "continue")
    })
    await waitFor(() => expect(mockSubscribeToRun).toHaveBeenCalledTimes(1))
    const users = bucket().filter((m) => m.role === "user")
    const assistants = bucket().filter((m) => m.role === "assistant")
    expect(users).toHaveLength(1)
    expect(users[0].id).toBe("msg-1")
    expect(users[0].content).toBe("continue")
    expect(assistants).toHaveLength(1)
    expect(assistants[0].runId).toBe("run-new")
    expect(useStreamsStore.getState().streamingThreads.has(THREAD)).toBe(true)
    expect(useStreamsStore.getState().continuingThreads.has(THREAD)).toBe(false)
  })

  it("C: un-hinted text answered continued:true removes the bubbles it inserted (no ghost)", async () => {
    await mountProvider()
    mockPostMessage.mockResolvedValue(CONTINUED)
    await act(async () => {
      await actions!.sendMessage(THREAD, "hello there")
    })
    expect(bucket()).toHaveLength(0)
    expect(useStreamsStore.getState().continuingThreads.has(THREAD)).toBe(true)
    expect(mockSubscribeToRun).not.toHaveBeenCalled()
  })
})

describe("292.1 D-14 — Continuing… clears on a re-pause and on a terminal", () => {
  it("D1: clearWorkflowLockForThread removes the thread from continuingThreads", async () => {
    await mountProvider()
    seedPause()
    markContinuing(THREAD)
    expect(useStreamsStore.getState().continuingThreads.has(THREAD)).toBe(true)
    act(() => {
      useStreamsStore.getState().actions.clearWorkflowLockForThread(THREAD)
    })
    expect(useStreamsStore.getState().continuingThreads.has(THREAD)).toBe(false)
  })

  it("D2: a cap_paused SSE for the thread removes it from continuingThreads", async () => {
    await mountProvider()
    mockPostMessage.mockResolvedValue({ message_id: "msg-1", run_id: "run-1" })
    let callbacks: { onCapPaused?: (info: unknown) => void } | null = null
    mockSubscribeToRun.mockImplementation(async (_rid: string, _since: string, cbs: typeof callbacks) => {
      callbacks = cbs
      return new Promise<void>(() => {})
    })
    await act(async () => {
      void actions!.sendMessage(THREAD, "do the work")
    })
    await waitFor(() => expect(callbacks).not.toBeNull())
    markContinuing(THREAD)
    act(() => {
      callbacks!.onCapPaused!({ runId: "run-1", toolNames: [], continuesUsed: 1, continuesRemaining: 2 })
    })
    expect(useStreamsStore.getState().continuingThreads.has(THREAD)).toBe(false)
    expect(useStreamsStore.getState().workflowLockByThread.get(THREAD)?.capPaused).toBe(true)
  })
})
