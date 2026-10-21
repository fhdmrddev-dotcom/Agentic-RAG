/**
 * Phase 295 gap round 2 (295-10 / D-r1-02, the SC#4 miss) — after an answer in the chat thread,
 * the open tab must keep following the run.
 *
 * Measured live three times by the round-1 re-drive (runs `c4232e01`, S2 `74493c29`, armed
 * `9cb788d0`): after an answer in the chat thread, the panel read `Running` past the run's end and
 * through the next question, until the person switched threads.
 *
 * The mechanism, read from the code:
 *   - A paused run has no live producer, so `GET /threads/{id}/workflow` reports the lock stale and
 *     the client holds NO workflow lock for the thread. When this tab started the run, the kickoff
 *     mark is cleared when its stream ends at the pause. So at answer time the thread holds neither.
 *   - The answer's settle, `releaseSettledWorkflowLock`, returned early on exactly that condition
 *     (no lock and no kickoff mark), so it never read the thread's workflow state again.
 *   - The answer route re-drives the run on a NEW producer shell, and it mints that shell before it
 *     returns 200 (`api/runs.py::_redrive_paused_workflow_run`: `resume_run`, then the shell INSERT
 *     in `_build_resume_context`). Nothing in the tab ever subscribed to it.
 *
 * The fix lets a thread whose recorded run status is `paused` (the 295-08 store field, written by
 * the phase reconcile's own read) through that guard. The settle's shipped live arm then re-attaches
 * the new producer stream, and the run's own events move the panel.
 *
 * These cases mount the real provider and the real stack over a mocked API. They prove the
 * mechanism composes; the live re-drive owes the product proof.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, waitFor, act, cleanup } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

const {
  mockPostMessage,
  mockSubscribeToRun,
  mockGetMessages,
  mockGetActiveRuns,
  mockGetSnapshot,
  mockCancelRun,
  mockGetThreadWorkflow,
  mockGetThreadTodos,
  mockGetThreadWorkspaceFiles,
  mockGetThreadPendingAsks,
  mockGetThreadTasks,
  mockAnswerAskUser,
} = vi.hoisted(() => ({
  mockPostMessage: vi.fn(),
  mockSubscribeToRun: vi.fn(),
  mockGetMessages: vi.fn(),
  mockGetActiveRuns: vi.fn(),
  mockGetSnapshot: vi.fn(),
  mockCancelRun: vi.fn(),
  mockGetThreadWorkflow: vi.fn(),
  mockGetThreadTodos: vi.fn(),
  mockGetThreadWorkspaceFiles: vi.fn(),
  mockGetThreadPendingAsks: vi.fn(),
  mockGetThreadTasks: vi.fn(),
  mockAnswerAskUser: vi.fn(),
}))

// An allow-list, copied from `streamsProvider_244_settle_ask.test.tsx`: an omitted export throws
// rather than falling back to the real module and issuing a real fetch.
vi.mock("@/lib/api", () => ({
  postMessage: mockPostMessage,
  subscribeToRun: mockSubscribeToRun,
  getMessages: mockGetMessages,
  getActiveRuns: mockGetActiveRuns,
  getSnapshot: mockGetSnapshot,
  cancelRun: mockCancelRun,
  getThreadWorkflow: mockGetThreadWorkflow,
  getThreadTodos: mockGetThreadTodos,
  getThreadWorkspaceFiles: mockGetThreadWorkspaceFiles,
  getThreadPendingAsks: mockGetThreadPendingAsks,
  getThreadTasks: mockGetThreadTasks,
  answerAskUser: mockAnswerAskUser,
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

import { StreamsProvider } from "@/providers/StreamsProvider"
import { useStreamsStore } from "@/stores/streamsStore"
import { useAskDraftStore } from "@/stores/askDraftStore"
import { PendingAskStack } from "@/components/panel/PendingAskCard"
import type { StreamCallbacks } from "@/lib/api"
import type { PendingAsk } from "@/types"

const THREAD_ID = "thread-295-10"
const NEW_PRODUCER = "producer-redrive-2"

const PHASE_ROWS = [
  { phase_index: 0, slug: "research", status: "active", phase_type: "llm_agent" },
  { phase_index: 1, slug: "wrap", status: "pending", phase_type: "llm_single" },
]

/** `GET /threads/{id}/workflow` for a PAUSED run: the anchor is set, the old producer shell is
 *  terminal, so the lock reads stale and there is no live producer to attach to. */
const PAUSED_FRAME = {
  locked: true,
  lock_is_stale: true,
  active_workflow_run_id: "wr-1",
  last_workflow_run_id: "wr-1",
  latest_producer_run_id: null,
  cap_paused: false,
  mode: "harness",
  run_status: "paused",
  total_phases: 2,
  current_phase_index: 0,
  phases: PHASE_ROWS,
}

/** The same read right after an accepted answer: the run is `active` again and the re-drive's new
 *  producer shell is live (it is INSERTed before the answer route returns 200). */
const REDRIVEN_FRAME = {
  ...PAUSED_FRAME,
  lock_is_stale: false,
  latest_producer_run_id: NEW_PRODUCER,
  run_status: "active",
}

const ASK: PendingAsk = {
  tool_call_id: "tc-first",
  prompt: "The search found nothing. What should the run do?",
  options: ["Continue without sources", "Stop the run"],
  timeout_seconds: null,
  run_id: "wr-1",
}

const NEXT_ASK: PendingAsk = {
  tool_call_id: "tc-second",
  prompt: "Send the summary to the client?",
  options: ["Approve this step", "Do not run it"],
  timeout_seconds: null,
  run_id: "wr-1",
}

let frame: Record<string, unknown> = PAUSED_FRAME
let serverAsks: PendingAsk[] = [ASK]
const streams = new Map<string, StreamCallbacks>()

async function drain() {
  await act(async () => {
    for (let i = 0; i < 8; i++) await Promise.resolve()
  })
}

/** Mount the provider and the panel home, then OPEN the thread the way the app does. */
async function openPausedThread() {
  render(
    <StreamsProvider>
      <PendingAskStack home="panel" />
    </StreamsProvider>,
  )
  await act(async () => {
    useStreamsStore.getState().actions.setViewingThread(THREAD_ID)
  })
  await waitFor(() => expect(screen.getByText(ASK.prompt)).toBeInTheDocument())
  await waitFor(() =>
    expect(useStreamsStore.getState().workflowRunStatusByThread.get(THREAD_ID)).toBe("paused"),
  )
  await drain()
  // The precondition the defect needs, asserted rather than assumed: the paused thread holds no
  // workflow lock and no kickoff mark, so nothing but the recorded status says a run is waiting.
  expect(useStreamsStore.getState().workflowLockByThread.has(THREAD_ID)).toBe(false)
  expect(useStreamsStore.getState().harnessKickoffThreads.has(THREAD_ID)).toBe(false)
  expect(mockSubscribeToRun).not.toHaveBeenCalled()
}

async function answer(choice: string) {
  const user = userEvent.setup()
  await user.click(screen.getByRole("radio", { name: choice }))
  await user.click(screen.getByRole("button", { name: "Send Answer" }))
}

const phaseStatuses = () =>
  (useStreamsStore.getState().phasesByThread.get(THREAD_ID) ?? []).map((p) => `${p.slug}:${p.status}`)

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  streams.clear()
  frame = PAUSED_FRAME
  serverAsks = [ASK]
  useAskDraftStore.setState(useAskDraftStore.getInitialState(), true)
  useStreamsStore.setState({
    bucketsBySurface: new Map(),
    viewedThreadId: null,
    streamingThreads: new Set<string>(),
    reconcileErrors: new Map<string, Error>(),
    loadingThreads: new Set<string>(),
    subscriptionsByThread: new Map<string, Set<string>>(),
    workflowLockByThread: new Map(),
    harnessKickoffThreads: new Set<string>(),
    stoppingThreads: new Set<string>(),
    stopNotConfirmed: new Set<string>(),
    pendingAsksByThread: new Map(),
    phasesByThread: new Map(),
    workflowRunStatusByThread: new Map<string, string | null>(),
  })
  mockGetMessages.mockResolvedValue([])
  mockGetActiveRuns.mockResolvedValue([])
  mockGetSnapshot.mockResolvedValue({ messages: [], active_runs: [], since_cursors: {} })
  mockCancelRun.mockResolvedValue(undefined)
  mockGetThreadTodos.mockResolvedValue([])
  mockGetThreadWorkspaceFiles.mockResolvedValue([])
  mockGetThreadTasks.mockResolvedValue([])
  mockGetThreadWorkflow.mockImplementation(async () => frame)
  mockGetThreadPendingAsks.mockImplementation(async () => serverAsks)
  // The server's order: the answer is persisted, the run is resumed and the new shell is minted,
  // and only then does the route answer 200.
  mockAnswerAskUser.mockImplementation(async () => {
    serverAsks = []
    frame = REDRIVEN_FRAME
  })
  mockSubscribeToRun.mockImplementation(
    async (runId: string, _since: string, cb: StreamCallbacks) => {
      streams.set(runId, cb)
      return new Promise<void>(() => {})
    },
  )
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe("295-10 / D-r1-02 — after an answer, the open tab follows the re-driven run", () => {
  it("THE DEFECT — an answer on a paused run re-attaches the re-drive's new producer stream", async () => {
    await openPausedThread()
    await answer("Continue without sources")

    await waitFor(() =>
      expect(
        mockSubscribeToRun.mock.calls.map((c) => c[0]),
        "the answer was accepted and the run re-driven on a new producer, but the tab never " +
          "subscribed to it — the panel keeps reading Running until a thread switch",
      ).toContain(NEW_PRODUCER),
    )
  })

  it("the panel's phases reach the terminal state with no thread switch", async () => {
    await openPausedThread()
    expect(phaseStatuses()).toEqual(["research:running", "wrap:pending"])
    await answer("Continue without sources")
    await waitFor(() => expect(streams.has(NEW_PRODUCER)).toBe(true))

    const cb = streams.get(NEW_PRODUCER)!
    await act(async () => {
      cb.onPhaseCompleted?.("research", 0)
      cb.onPhaseStarted?.({ phase: "wrap", phaseIndex: 1, phaseType: "llm_single" })
      cb.onPhaseCompleted?.("wrap", 1)
      cb.onRunCompleted?.("completed")
    })

    expect(phaseStatuses()).toEqual(["research:done", "wrap:done"])
    // And no second thread was opened to get there.
    expect(useStreamsStore.getState().viewedThreadId).toBe(THREAD_ID)
  })

  it("when the re-attached stream ends, one read records the server's status and phases", async () => {
    await openPausedThread()
    await answer("Continue without sources")
    await waitFor(() => expect(streams.has(NEW_PRODUCER)).toBe(true))

    // The run finished on the server; the stream ends. The status must not stay `paused`.
    frame = {
      ...PAUSED_FRAME,
      active_workflow_run_id: null,
      locked: false,
      lock_is_stale: false,
      mode: "deep",
      run_status: "completed",
      phases: [
        { phase_index: 0, slug: "research", status: "completed", phase_type: "llm_agent" },
        { phase_index: 1, slug: "wrap", status: "completed", phase_type: "llm_single" },
      ],
    }
    const before = mockGetThreadWorkflow.mock.calls.length
    await act(async () => {
      streams.get(NEW_PRODUCER)!.onTerminal?.("done")
    })
    await waitFor(() => expect(phaseStatuses()).toEqual(["research:done", "wrap:done"]))
    expect(useStreamsStore.getState().workflowRunStatusByThread.get(THREAD_ID)).toBe("completed")
    expect(mockGetThreadWorkflow.mock.calls.length - before).toBe(1)
  })

  it("a pause that lands during the re-attached stream shows its card, answerable", async () => {
    await openPausedThread()
    await answer("Continue without sources")
    await waitFor(() => expect(streams.has(NEW_PRODUCER)).toBe(true))

    const cb = streams.get(NEW_PRODUCER)!
    await act(async () => {
      cb.onPhaseCompleted?.("research", 0)
      cb.onPhaseStarted?.({ phase: "wrap", phaseIndex: 1, phaseType: "llm_single" })
      cb.onAskUserPrompt?.(NEXT_ASK)
    })

    await waitFor(() => expect(screen.getByText(NEXT_ASK.prompt)).toBeInTheDocument())
    expect(document.body.textContent ?? "").not.toContain("Retired")
    const user = userEvent.setup()
    await user.click(screen.getByRole("radio", { name: "Approve this step" }))
    const send = screen.getByRole("button", { name: "Send Answer" }) as HTMLButtonElement
    expect(send.disabled).toBe(false)
  })
})

describe("295-10 — the settle guard stays narrow", () => {
  it("a thread whose recorded run is over, with no lock and no mark, still issues no workflow read", async () => {
    render(<StreamsProvider>{null}</StreamsProvider>)
    act(() => {
      useStreamsStore.setState({
        workflowRunStatusByThread: new Map<string, string | null>([[THREAD_ID, "completed"]]),
      })
    })
    mockGetThreadWorkflow.mockClear()
    await act(async () => {
      useStreamsStore.getState().actions.releaseSettledWorkflowLock(THREAD_ID)
    })
    await drain()
    expect(mockGetThreadWorkflow).not.toHaveBeenCalled()
  })

  it("a paused run whose re-drive has not started reads once and attaches nothing", async () => {
    render(<StreamsProvider>{null}</StreamsProvider>)
    act(() => {
      useStreamsStore.setState({
        workflowRunStatusByThread: new Map<string, string | null>([[THREAD_ID, "paused"]]),
      })
    })
    frame = PAUSED_FRAME
    mockGetThreadWorkflow.mockClear()
    await act(async () => {
      useStreamsStore.getState().actions.releaseSettledWorkflowLock(THREAD_ID)
    })
    await drain()
    expect(mockGetThreadWorkflow).toHaveBeenCalledTimes(1)
    expect(mockSubscribeToRun).not.toHaveBeenCalled()
    expect(useStreamsStore.getState().workflowLockByThread.has(THREAD_ID)).toBe(false)
  })
})
