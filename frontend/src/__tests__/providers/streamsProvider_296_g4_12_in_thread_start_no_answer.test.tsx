/**
 * Phase 296 G-4 finding 12 (FAILED live 2026-10-27, reproduced 3 times): in an EXISTING thread,
 * "Run a workflow" → a published 1-step workflow ("293 board: deepseek"). The run completes
 * server-side in ~4 s and its answer row is persisted, but the chat column ends at the user bubble
 * "Run 293 board: deepseek" and the run status line disappears. A reopen renders the answer.
 *
 * Diagnosis: `.planning/milestones/v4.7-phases/296-close-v4-7-debt/evidence/g4/12-diagnosis.md`.
 *
 * THE PATH. `useStartWorkflowInThread` → `sendMessage(threadId, "Run <name>", {workflowDefinitionId})`.
 * The stream is followed by sendMessage's OWN kickoff follow (`subscribeToRun(run_id, "0", …)`), not by
 * `subscribeProducerStream`, so neither 296-04's terminal reconcile nor G-4 S3's run_completed end
 * applies to it. The harness kickoff inserts ZERO assistant nodes (194.1 R5), so the live `delta` and
 * the terminal's getMessages content patch both map over a row that does not exist, and the terminal
 * wrapper never re-reads the thread.
 *
 * THE WIRE, measured read-only in local Redis on the failing run `run:d0fe345e-d8da-4ec6-ad41-88703b4c6fac`
 * (thread 14555c45…, 03:43:03 → 03:43:06 UTC):
 *
 *   phase_started(say, 0) · phase_completed(say, 0) · delta · run_completed(completed) · done
 *
 * `done` is in the server's TERMINAL_TYPES, so the SSE route closes the connection after it, and the
 * client's `subscribeToRun` dispatches `onDone`, then (reader closed) `onTerminal("reader_done")`.
 * The mock below replays exactly that.
 *
 * The second describe covers the wrong status-line reading (1 phase done… · Step 1 of 1 · 1m 57s two
 * seconds in): both numbers describe the PREVIOUS run of the same thread (03:41:07), not this one.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, waitFor, act, cleanup } from "@testing-library/react"

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
}))

// An allow-list (the 295-10 / G-4 S3 convention): an omitted export throws rather than falling back
// to the real module and issuing a real fetch.
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
import { ThreadRunLine } from "@/components/chat/ThreadRunLine"
import { useStreamsStore } from "@/stores/streamsStore"
import type { StreamCallbacks } from "@/lib/api"
import type { Phase } from "@/types"

const THREAD_ID = "14555c45-ff3d-4073-8fde-2bc0ba079401"
const PRODUCER = "d0fe345e-d8da-4ec6-ad41-88703b4c6fac"
const KICKOFF = "Run 293 board: deepseek"

const iso = (msAgo: number) => new Date(Date.now() - msAgo).toISOString()

/** The thread as it stood before the start: one earlier run of the same workflow, 1m56s before. */
const PREV_USER = {
  id: "m-prev-user",
  thread_id: THREAD_ID,
  user_id: "user-1",
  role: "user",
  content: KICKOFF,
  created_at: iso(116_000),
  updated_at: iso(116_000),
}
const PREV_ANSWER = {
  id: "m-prev-answer",
  thread_id: THREAD_ID,
  user_id: "user-1",
  role: "assistant",
  content: "A data backup is a copy of your business's digital information…",
  created_at: iso(112_500),
  updated_at: iso(112_500),
  tool_calls: [],
}
/** This run's rows (03:43:03.040 user, 03:43:06.572 assistant). A harness answer carries no runId. */
const NEW_USER = { ...PREV_USER, id: "m-new-user", created_at: iso(0), updated_at: iso(0) }
const NEW_ANSWER = {
  ...PREV_ANSWER,
  id: "m-new-answer",
  content: "A data backup is a copy of your important files and systems stored separately…",
  created_at: iso(0),
  updated_at: iso(0),
}

const SAY_DONE_ROW = { phase_index: 0, slug: "say", status: "completed", phase_type: "llm_single" }

/** GET /threads/{id}/workflow before the POST commits: the PREVIOUS run, completed. */
const PREV_FRAME = {
  locked: false,
  lock_is_stale: false,
  active_workflow_run_id: null,
  last_workflow_run_id: "wr-2e0fe262",
  latest_producer_run_id: null,
  cap_paused: false,
  mode: "deep",
  run_status: "completed",
  total_phases: 1,
  current_phase_index: 0,
  phases: [SAY_DONE_ROW],
  last_run_status: "completed",
  last_run_created_at: iso(116_000),
  last_run_updated_at: iso(112_500),
  origin: { kind: "app" },
}
/** After the POST commits: this run, live. */
const NEW_LIVE_FRAME = {
  ...PREV_FRAME,
  locked: true,
  active_workflow_run_id: "wr-13cbbd01",
  last_workflow_run_id: "wr-13cbbd01",
  latest_producer_run_id: PRODUCER,
  mode: "harness",
  run_status: "active",
  phases: [{ ...SAY_DONE_ROW, status: "pending" }],
  last_run_status: "active",
  last_run_created_at: iso(0),
  last_run_updated_at: iso(0),
}
/** After the end. */
const NEW_DONE_FRAME = {
  ...NEW_LIVE_FRAME,
  locked: false,
  active_workflow_run_id: null,
  latest_producer_run_id: null,
  mode: "deep",
  run_status: "completed",
  phases: [SAY_DONE_ROW],
  last_run_status: "completed",
}

/** What the workspace panel's own reconcile wrote on thread open (reconcilePhases, completed run). */
const PREV_PHASE_SLICE: Phase[] = [
  { slug: "say", phaseIndex: 0, phaseType: "llm_single", status: "done", subAgents: [], pendingAsk: null },
]

let frame: Record<string, unknown> = PREV_FRAME
const streams = new Map<string, { cb: StreamCallbacks; close: () => void }>()
let resolvePost: (() => void) | null = null

async function drain() {
  await act(async () => {
    for (let i = 0; i < 8; i++) await Promise.resolve()
  })
}

const chatBucket = () => useStreamsStore.getState().bucketsBySurface.get("chat")?.get(THREAD_ID) ?? []
const chatBucketIds = () => chatBucket().map((m) => m.id)
const phaseStatuses = () =>
  (useStreamsStore.getState().phasesByThread.get(THREAD_ID) ?? []).map((p) => `${p.slug}:${p.status}`)

/** Open the existing thread, as the person did before pressing Run a workflow. */
async function openExistingThread() {
  render(
    <StreamsProvider>
      <ThreadRunLine threadId={THREAD_ID} />
    </StreamsProvider>,
  )
  await act(async () => {
    useStreamsStore.getState().actions.setViewingThread(THREAD_ID)
  })
  await waitFor(() => expect(chatBucketIds()).toEqual([PREV_USER.id, PREV_ANSWER.id]))
  act(() => {
    useStreamsStore.getState().actions.replacePhasesForThread(THREAD_ID, PREV_PHASE_SLICE)
  })
  await drain()
}

/** `useStartWorkflowInThread.start` — the send, deliberately NOT awaited. */
function startWorkflowInThread() {
  act(() => {
    void useStreamsStore.getState().actions.sendMessage(THREAD_ID, KICKOFF, {
      workflowDefinitionId: "wf-293-board-deepseek",
      inputs: {},
      surfaceId: "chat",
    })
  })
}

/** The POST commits (the run row now exists) and answers 201. */
async function postCommits() {
  await act(async () => {
    resolvePost?.()
  })
  await waitFor(() => expect(streams.has(PRODUCER)).toBe(true))
}

/** Replay `run:d0fe345e…` exactly as Redis holds it, then the server closes on `done`. */
async function replayWireAndClose() {
  const { cb, close } = streams.get(PRODUCER)!
  // The server's state when the stream ends: run finished, answer row persisted (03:43:06.572,
  // before `done` at 03:43:06.600).
  frame = NEW_DONE_FRAME
  const persisted = [PREV_USER, PREV_ANSWER, NEW_USER, NEW_ANSWER]
  mockGetSnapshot.mockResolvedValue({ messages: persisted, active_runs: [], since_cursors: {} })
  mockGetMessages.mockResolvedValue(persisted)
  await act(async () => {
    cb.onPhaseStarted?.({ phase: "say", phaseIndex: 0, phaseType: "llm_single" })
    cb.onPhaseCompleted?.("say", 0)
    cb.onDelta(NEW_ANSWER.content)
    cb.onRunCompleted?.("completed")
    cb.onDone()
    // api/threads.ts subscribeToRun: `done` is not a client terminal; the server breaks on it
    // (TERMINAL_TYPES) and the reader closes → onTerminal("reader_done"), then the call returns.
    cb.onTerminal("reader_done")
    close()
  })
  await drain()
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  streams.clear()
  frame = PREV_FRAME
  resolvePost = null
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
  mockGetMessages.mockResolvedValue([PREV_USER, PREV_ANSWER])
  mockGetActiveRuns.mockResolvedValue([])
  mockGetSnapshot.mockResolvedValue({
    messages: [PREV_USER, PREV_ANSWER],
    active_runs: [],
    since_cursors: {},
  })
  mockCancelRun.mockResolvedValue(undefined)
  mockGetThreadTodos.mockResolvedValue([])
  mockGetThreadWorkspaceFiles.mockResolvedValue([])
  mockGetThreadTasks.mockResolvedValue([])
  mockGetThreadPendingAsks.mockResolvedValue([])
  mockGetThreadWorkflow.mockImplementation(async () => frame)
  // The POST is held until the test commits it, so a frame read issued at the kickoff (the
  // synchronous live mark) reads the server as it was BEFORE the run row existed — as it did live.
  mockPostMessage.mockImplementation(
    () =>
      new Promise((resolve) => {
        resolvePost = () => {
          frame = NEW_LIVE_FRAME
          resolve({ message_id: NEW_USER.id, run_id: PRODUCER, model: "deepseek-chat", provider: "deepseek" })
        }
      }),
  )
  // The real subscribeToRun resolves when the server closes the stream.
  mockSubscribeToRun.mockImplementation(
    (runId: string, _since: string, cb: StreamCallbacks) =>
      new Promise<void>((resolve) => {
        streams.set(runId, { cb, close: resolve })
      }),
  )
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe("296 G-4 #12 — a workflow started inside an existing thread", () => {
  it("is followed by sendMessage's own kickoff follow, from cursor 0 (not subscribeProducerStream)", async () => {
    await openExistingThread()
    startWorkflowInThread()
    await postCommits()
    expect(mockSubscribeToRun).toHaveBeenCalledTimes(1)
    expect(mockSubscribeToRun.mock.calls[0][0]).toBe(PRODUCER)
    expect(mockSubscribeToRun.mock.calls[0][1]).toBe("0")
  })

  it("the run instrument leaves when the run ends (the half that 'works' — and why the line vanishes)", async () => {
    await openExistingThread()
    startWorkflowInThread()
    await postCommits()
    expect(screen.getByTestId("thread-run-line")).toHaveAttribute("data-run-line-state", "live")
    await replayWireAndClose()
    // Kickoff mark cleared by the streamingThreads transition, lock cleared by the terminal, and
    // ThreadRunLine is silent on `completed` by decision (D-16).
    await waitFor(() => expect(screen.queryByTestId("thread-run-line")).toBeNull())
  })

  it("THE DEFECT — the open thread shows the persisted answer with no reopen", async () => {
    await openExistingThread()
    startWorkflowInThread()
    await postCommits()
    await replayWireAndClose()
    await waitFor(() =>
      expect(
        chatBucketIds(),
        "the run completed and its answer row is persisted, but sendMessage's kickoff terminal never " +
          "re-reads the thread (only subscribeProducerStream's does), and a harness kickoff has no " +
          "assistant node for the live delta or the getMessages content patch to land on",
      ).toContain(NEW_ANSWER.id),
    )
    // and exactly once, after the person's own bubble
    expect(chatBucketIds()).toEqual([PREV_USER.id, PREV_ANSWER.id, NEW_USER.id, NEW_ANSWER.id])
  })
})

describe("296 G-4 #12 (d) — the live status line describes the PREVIOUS run", () => {
  it("THE DEFECT — this run's step is tracked, not the previous run's finished step", async () => {
    await openExistingThread()
    startWorkflowInThread()
    // Before any event of this run arrives, the line must not report a finished step.
    expect(
      screen.getByTestId("thread-run-line-word").textContent,
      "the phase slice still holds the previous run's `say: done`, so a run that has not started " +
        "reads `1 phase done…`",
    ).not.toMatch(/done/)
    await postCommits()
    const { cb } = streams.get(PRODUCER)!
    await act(async () => {
      cb.onPhaseStarted?.({ phase: "say", phaseIndex: 0, phaseType: "llm_single" })
    })
    expect(
      phaseStatuses(),
      "appendPhaseForThread is a no-op for a slug already present, so this run's phase_started " +
        "never lands over the previous run's row",
    ).toEqual(["say:running"])
  })

  it("THE DEFECT — the elapsed figure is this run's, not the time since the previous run started", async () => {
    await openExistingThread()
    startWorkflowInThread()
    await drain()
    const elapsedNow = () => screen.queryByTestId("thread-run-line-elapsed")?.textContent ?? ""
    // Before the POST commits, the only frame on hand is the previous (finished) run's: its anchor
    // is no measurement of this run, so the segment is absent or this run's own.
    expect(
      elapsedNow(),
      "the frame read at the kickoff is the previous run's (last_run_created_at 1m56s ago)",
    ).not.toMatch(/m /)
    await postCommits()
    await drain()
    // After the POST committed the frame must be re-read, or the line keeps the previous anchor.
    await waitFor(() =>
      expect(
        elapsedNow(),
        "ThreadRunLine re-reads the frame only on [threadId, isLive]; isLive was already true at the " +
          "kickoff, so the run id arriving changes nothing",
      ).toMatch(/^\d+s$/),
    )
  })
})
