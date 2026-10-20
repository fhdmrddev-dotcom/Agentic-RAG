/**
 * Phase 287-03 Task 1 (A-01) - `sendMessage` forwards a harness kickoff's `inputs` to postMessage.
 *
 * The provider already forwarded `workflowDefinitionId`; the launch inputs a person typed into a
 * form were dropped at this seam, so a thread-started workflow would have run with none. ONE
 * optional field, passed through verbatim, no branch.
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

const THREAD = "thread-287"
let actions: ReturnType<typeof useStreamActions> | null = null

function Capture() {
  actions = useStreamActions()
  return null
}

beforeEach(() => {
  vi.clearAllMocks()
  actions = null
  useStreamsStore.setState({
    bucketsBySurface: new Map(),
    streamingThreads: new Set(),
    harnessKickoffThreads: new Set(),
    workflowLockByThread: new Map(),
  })
  mockGetMessages.mockResolvedValue([])
  mockGetActiveRuns.mockResolvedValue({ active_runs: [] })
  mockGetSnapshot.mockResolvedValue({ messages: [], active_runs: [] })
  mockGetThreadWorkflow.mockReturnValue(new Promise(() => {}))
  mockPostMessage.mockReturnValue(new Promise(() => {}))
  mockSubscribeToRun.mockImplementation(async () => new Promise<void>(() => {}))
})

afterEach(() => {
  cleanup()
  useStreamsStore.setState({
    bucketsBySurface: new Map(),
    streamingThreads: new Set(),
    harnessKickoffThreads: new Set(),
  })
})

async function mountProvider() {
  render(
    <StreamsProvider>
      <Capture />
    </StreamsProvider>,
  )
  await waitFor(() => expect(actions).not.toBeNull())
}

describe("287-03 - sendMessage forwards launch inputs", () => {
  it("a harness kickoff's inputs reach postMessage verbatim", async () => {
    await mountProvider()
    await act(async () => {
      void actions!.sendMessage(THREAD, "Run Send report", {
        workflowDefinitionId: "wf-1",
        inputs: { to: "a" },
      })
    })
    expect(mockPostMessage).toHaveBeenCalledTimes(1)
    const opts = mockPostMessage.mock.calls[0][2]
    expect(opts.workflowDefinitionId).toBe("wf-1")
    expect(opts.inputs).toEqual({ to: "a" })
  })

  it("a Deep send posts an options object with no inputs value (byte-identical)", async () => {
    await mountProvider()
    await act(async () => {
      void actions!.sendMessage(THREAD, "just chat")
    })
    expect(mockPostMessage).toHaveBeenCalledTimes(1)
    const opts = mockPostMessage.mock.calls[0][2]
    // postMessage drops an undefined value; the VALUE must be absent on a Deep send.
    expect(opts.inputs).toBeUndefined()
    expect(opts.workflowDefinitionId).toBeUndefined()
  })

  it("a harness kickoff still creates no assistant node and marks the kickoff", async () => {
    await mountProvider()
    await act(async () => {
      void actions!.sendMessage(THREAD, "Run X", { workflowDefinitionId: "wf-1", inputs: {} })
    })
    const msgs = useStreamsStore.getState().bucketsBySurface.get("chat")?.get(THREAD) ?? []
    expect(msgs.filter((m) => m.role === "assistant")).toHaveLength(0)
    expect(useStreamsStore.getState().harnessKickoffThreads.has(THREAD)).toBe(true)
  })
})
