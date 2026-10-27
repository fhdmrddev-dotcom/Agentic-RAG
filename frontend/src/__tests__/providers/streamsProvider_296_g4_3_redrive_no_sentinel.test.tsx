/**
 * Phase 296 G-4 scenario 3 (FAILED live 2026-10-27): a run followed after "Continue without sources"
 * ends, and the open thread never shows its answer or the step's Unsourced mark.
 *
 * 296-04 put the fix in `subscribeProducerStream`'s `onTerminal` wrapper (reconcile the viewed
 * thread, then re-read the steps). Its unit test drives that wrapper by calling `onTerminal("done")`
 * by hand. The live stream never calls it.
 *
 * MEASURED in local Redis, read-only, on the failed run's re-drive producer
 * `run:4d313e4c-ef72-4844-b12e-16d030b1b039` (TTL -1, 7 entries):
 *
 *   phase_started(research) · phase_completed(research) · phase_transition · phase_started(wrap)
 *   · phase_completed(wrap) · delta · run_completed(status=completed)
 *
 * There is no terminal sentinel (`done` / `error` / `cancelled` / `timed_out`) and no EXPIRE.
 * The re-drive (`api/runs.py::_redrive_paused_workflow_run` → `_wake`) ends with `finalize_run`
 * only. It never calls `_emit_terminal`, unlike `run_producer.py`'s finalizer. So the server's
 * `replay_tail_consumer` holds the SSE connection open until `consumer_timeout_seconds` (610 s), and
 * the client's `subscribeToRun` never calls `onTerminal`. The panel still reaches Complete because
 * `run_completed` → `onRunCompleted` → `finalizeAllPhasesForThread`, which is why the panel and the
 * chat disagreed on screen.
 *
 * The mock below replays that wire exactly: run_completed, then nothing.
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

// An allow-list, copied from `streamsProvider_295_10_follow_after_answer.test.tsx`: an omitted
// export throws rather than falling back to the real module and issuing a real fetch.
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

const THREAD_ID = "thread-296-g4-3"
const REDRIVE_PRODUCER = "4d313e4c-ef72-4844-b12e-16d030b1b039"

const PHASE_ROWS = [
  { phase_index: 0, slug: "research", status: "active", phase_type: "llm_agent" },
  { phase_index: 1, slug: "wrap", status: "pending", phase_type: "llm_single" },
]

/** The paused run, as `GET /threads/{id}/workflow` reports it before the answer. */
const PAUSED_FRAME = {
  locked: true,
  lock_is_stale: true,
  active_workflow_run_id: "wr-8557f483",
  last_workflow_run_id: "wr-8557f483",
  latest_producer_run_id: null,
  cap_paused: false,
  mode: "harness",
  run_status: "paused",
  total_phases: 2,
  current_phase_index: 0,
  phases: PHASE_ROWS,
}

/** Right after the accepted answer: the re-drive's shell is live (minted before the 200). */
const REDRIVEN_FRAME = {
  ...PAUSED_FRAME,
  lock_is_stale: false,
  latest_producer_run_id: REDRIVE_PRODUCER,
  run_status: "active",
}

const UNSOURCED = { continued_by: "Dev Person", at: "2026-10-27T01:56:06Z" }

/** After the end: completed, and step 1 carries its Unsourced mark (what a reopen shows). */
const COMPLETED_FRAME = {
  ...PAUSED_FRAME,
  active_workflow_run_id: null,
  locked: false,
  lock_is_stale: false,
  mode: "deep",
  run_status: "completed",
  phases: [
    { phase_index: 0, slug: "research", status: "completed", phase_type: "llm_agent", unsourced: UNSOURCED },
    { phase_index: 1, slug: "wrap", status: "completed", phase_type: "llm_single" },
  ],
}

const ASK: PendingAsk = {
  tool_call_id: "tc-found-nothing",
  prompt: "Searched 295-07 empty KB folder and found nothing. How should the run continue?",
  options: ["Continue without sources", "Stop the run"],
  timeout_seconds: null,
  run_id: "wr-8557f483",
}

/** The persisted answer row (01:56:09.510). A harness answer carries no runId. */
const HARNESS_ANSWER = {
  id: "m-redrive-answer",
  thread_id: THREAD_ID,
  user_id: "user-1",
  role: "assistant",
  content: "The previous step found no project status information because the folder is empty.",
  created_at: "2026-10-27T01:56:09.510Z",
  updated_at: "2026-10-27T01:56:09.510Z",
  tool_calls: [],
}

let frame: Record<string, unknown> = PAUSED_FRAME
let serverAsks: PendingAsk[] = [ASK]
const streams = new Map<string, { cb: StreamCallbacks; signal?: AbortSignal }>()

async function drain() {
  await act(async () => {
    for (let i = 0; i < 8; i++) await Promise.resolve()
  })
}

async function followRedriveAfterAnswer() {
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
  const user = userEvent.setup()
  await user.click(screen.getByRole("radio", { name: "Continue without sources" }))
  await user.click(screen.getByRole("button", { name: "Send Answer" }))
  // Step 5 of the lived drive: the page subscribes to the re-drive's stream.
  await waitFor(() => expect(streams.has(REDRIVE_PRODUCER)).toBe(true))
}

/** Replay `run:4d313e4c…` exactly as Redis holds it. No terminal sentinel follows. */
async function replayRedriveWireWithoutSentinel() {
  const { cb } = streams.get(REDRIVE_PRODUCER)!
  // The server's state at the moment `run_completed` is XADDed: finish_run(completed) and the
  // answer row are already written (harness_engine.py run_workflow: finish_run →
  // _surface_final_answer → run_completed).
  frame = COMPLETED_FRAME
  mockGetSnapshot.mockResolvedValue({ messages: [HARNESS_ANSWER], active_runs: [], since_cursors: {} })
  mockGetMessages.mockResolvedValue([HARNESS_ANSWER])
  await act(async () => {
    cb.onPhaseStarted?.({ phase: "research", phaseIndex: 0, phaseType: "llm_agent" })
    cb.onPhaseCompleted?.("research", 0)
    cb.onPhaseTransition?.("research", "wrap", undefined as unknown as string)
    cb.onPhaseStarted?.({ phase: "wrap", phaseIndex: 1, phaseType: "llm_single" })
    cb.onPhaseCompleted?.("wrap", 1)
    cb.onDelta(HARNESS_ANSWER.content)
    cb.onRunCompleted?.("completed")
    // ⛔ NO cb.onTerminal(...) — the buffer holds no `done`/`error`/`cancelled`/`timed_out`, and
    // the server keeps the SSE open for 610 s.
  })
}

const chatBucketIds = () =>
  (useStreamsStore.getState().bucketsBySurface.get("chat")?.get(THREAD_ID) ?? []).map((m) => m.id)

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
  mockAnswerAskUser.mockImplementation(async () => {
    serverAsks = []
    frame = REDRIVEN_FRAME
  })
  // The real subscribeToRun resolves only when the server closes the stream; this one never does,
  // which is what the live server does for 610 s on a re-drive stream.
  mockSubscribeToRun.mockImplementation(
    async (runId: string, _since: string, cb: StreamCallbacks, signal?: AbortSignal) => {
      streams.set(runId, { cb, signal })
      return new Promise<void>(() => {})
    },
  )
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe("296 G-4 S3 — a re-driven run whose stream ends with run_completed and no sentinel", () => {
  it("the panel reaches Complete from the live events (the half that worked live)", async () => {
    await followRedriveAfterAnswer()
    await replayRedriveWireWithoutSentinel()
    expect(phaseStatuses()).toEqual(["research:done", "wrap:done"])
  })

  it("THE DEFECT — the open thread shows the persisted answer with no reopen", async () => {
    await followRedriveAfterAnswer()
    await replayRedriveWireWithoutSentinel()
    await waitFor(() =>
      expect(
        chatBucketIds(),
        "the run completed and its answer row is persisted, but the re-drive stream carries no " +
          "terminal sentinel, so the follow's onTerminal reconcile (296-04) never runs and the " +
          "answer stays missing until a thread switch",
      ).toContain(HARNESS_ANSWER.id),
    )
  })

  it("THE DEFECT — step 1 keeps its Unsourced mark with no reopen", async () => {
    await followRedriveAfterAnswer()
    await replayRedriveWireWithoutSentinel()
    await waitFor(() =>
      expect(
        (useStreamsStore.getState().phasesByThread.get(THREAD_ID) ?? [])[0]?.unsourced,
        "the live phase events carry no unsourced field, and no step read follows the run's end",
      ).toEqual(UNSOURCED),
    )
  })

  it("the follow releases its connection once the run has said it is over", async () => {
    await followRedriveAfterAnswer()
    await replayRedriveWireWithoutSentinel()
    await drain()
    expect(
      useStreamsStore.getState().subscriptionsByThread.get(THREAD_ID)?.has(REDRIVE_PRODUCER) ?? false,
      "the follow still holds a pool slot for a finished run (the server would hold it for 610 s)",
    ).toBe(false)
    expect(streams.get(REDRIVE_PRODUCER)!.signal?.aborted).toBe(true)
  })
})
