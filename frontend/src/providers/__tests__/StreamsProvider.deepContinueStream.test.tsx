/**
 * Phase 292.1 UAT (2026-10-24 · deepseek-v4-flash · thread 24474458 · run 5549031c) — a Deep Continue
 * shows its progress live.
 *
 * ⛔ THE DEFECT. After the tool-limit card, Continue (button or a typed "continue") left the card on
 * "Continuing…" with NO tool steps and NO streaming text, then the finished answer appeared all at
 * once. A Deep Continue keeps the SAME run id and returns no `producer_run_id`, and the first
 * segment's stream had already ended with `done` — so nothing listened to the continuation.
 *
 * ⚠ THE OFFSET IS THE TRAP. The continuation XADDs to the SAME `run:{id}` buffer, which still holds
 * the first segment's events and its `done` sentinel (EXPIRE 600 after a `completed` finalize), and
 * the stream wire carries no `id:` lines, so the client never learned an offset. Following the run
 * from "0" would re-render the first segment and stop at its old `done`. The server now returns
 * `stream_since` (the buffer's tail read before the spawn) and the provider follows from there.
 *
 * Asserted here: the provider follows the SAME run from `stream_since`; the continuation's tool and
 * text events land in the EXISTING assistant turn without duplicating the first segment (its text
 * moves into the fold once, exactly as a turn boundary moves it, and a same-iteration tool name is
 * not swallowed by the replay guard); the segment ends through the server-authoritative settle on
 * `done`, and on a re-pause.
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
import { requestProducerResubscribe } from "@/providers/producerResubscribeSignal"
import { useStreamsStore, markContinuing } from "@/stores/streamsStore"
import type { Message } from "@/types"
import type { StreamCallbacks } from "@/lib/api"

const THREAD = "thread-2921-live"
const RUN = "run-cap-1"
const SINCE = "1729765841000-7"
const DEEP_PAUSE = { runId: RUN, mode: "cap_paused" as const, capPaused: true, continuesRemaining: 2 }
const SEG1_TEXT = "Let me search the knowledge base first."

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
    subscriptionsByThread: new Map(),
  })
}

type Sub = { rid: string; since: string; cbs: StreamCallbacks; signal?: AbortSignal }
let subs: Sub[] = []

beforeEach(() => {
  vi.clearAllMocks()
  actions = null
  subs = []
  reset()
  mockGetMessages.mockResolvedValue([])
  mockGetActiveRuns.mockResolvedValue({ active_runs: [] })
  mockGetSnapshot.mockResolvedValue({ messages: [], active_runs: [], since_cursors: {} })
  mockGetThreadWorkflow.mockReturnValue(new Promise(() => {}))
  mockPostMessage.mockReturnValue(new Promise(() => {}))
  mockSubscribeToRun.mockImplementation(
    async (rid: string, since: string, cbs: StreamCallbacks, signal?: AbortSignal) => {
      subs.push({ rid, since, cbs, signal })
      return new Promise<void>(() => {})
    },
  )
})

afterEach(() => {
  cleanup()
  reset()
})

async function mountAndView() {
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
    await Promise.resolve()
  })
}

/** The paused first segment, as the live session left it: one finished tool on iteration 0. */
function seedPausedTurn() {
  const seg1: Message = {
    id: "temp-a1",
    thread_id: THREAD,
    user_id: "",
    role: "assistant",
    content: SEG1_TEXT,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    runId: RUN,
    runStatus: "completed",
    tool_calls: [
      { id: "running-1", name: "search_documents", args: { query: "q1" }, status: "done", iteration: 0 },
    ],
  } as Message
  useStreamsStore.getState().actions.setMessagesForBucket("chat", THREAD, [seg1])
  useStreamsStore.setState({ workflowLockByThread: new Map([[THREAD, DEEP_PAUSE]]) })
  markContinuing(THREAD)
}

const bucket = () => useStreamsStore.getState().bucketsBySurface.get("chat")?.get(THREAD) ?? []
const assistants = () => bucket().filter((m) => m.role === "assistant")

async function followFromButton() {
  await act(async () => {
    requestProducerResubscribe({ threadId: THREAD, producerRunId: RUN, since: SINCE })
  })
  await waitFor(() => expect(subs).toHaveLength(1))
  return subs[0]
}

/** The continuation's own events: the resumed (dropped) calls, then the model's answer. */
function driveContinuation(cbs: StreamCallbacks) {
  act(() => {
    cbs.onToolStart?.("search_documents", { query: "q2" })
    cbs.onToolEnd?.("search_documents", "found 3")
    cbs.onToolStart?.("execute_code", { code: "print(1)" })
    cbs.onToolEnd?.("execute_code", "1")
    cbs.onIterationStart?.(0)
    cbs.onDelta("The answer is 42.")
    cbs.onDone?.()
  })
}

describe("292.1 UAT — the button: a Deep Continue follows the SAME run from stream_since", () => {
  it("1: subscribes the paused run id from the server's offset, never from 0", async () => {
    await mountAndView()
    seedPausedTurn()
    const sub = await followFromButton()
    expect(sub.rid).toBe(RUN)
    expect(sub.since).toBe(SINCE)
    expect(useStreamsStore.getState().streamingThreads.has(THREAD)).toBe(true)
    expect(assistants()[0].runStatus).toBe("streaming")
  })

  it("2: the continuation's tools and text land in the EXISTING turn, the first segment once", async () => {
    await mountAndView()
    seedPausedTurn()
    const sub = await followFromButton()
    driveContinuation(sub.cbs)

    const turns = assistants()
    expect(turns).toHaveLength(1)
    const turn = turns[0]
    expect(turn.id).toBe("temp-a1")
    // the first segment's call, plus BOTH continuation calls — a same-name call on iteration 0
    // must not be swallowed by the replay guard
    expect(turn.tool_calls?.map((t) => [t.name, t.status])).toEqual([
      ["search_documents", "done"],
      ["search_documents", "done"],
      ["execute_code", "done"],
    ])
    expect(turn.content).toBe("The answer is 42.")
    expect(turn.narrationContent).toBe(SEG1_TEXT)
    expect(`${turn.narrationContent}${turn.content}`.split(SEG1_TEXT)).toHaveLength(2)
  })

  it("3: a second request for the same run while attached opens nothing new (idempotent)", async () => {
    await mountAndView()
    seedPausedTurn()
    await followFromButton()
    await act(async () => {
      requestProducerResubscribe({ threadId: THREAD, producerRunId: RUN, since: SINCE })
    })
    expect(mockSubscribeToRun).toHaveBeenCalledTimes(1)
  })

  it("4: `done` settles through the server — completed clears the lock and Continuing…", async () => {
    await mountAndView()
    seedPausedTurn()
    const sub = await followFromButton()
    driveContinuation(sub.cbs)
    mockGetThreadWorkflow.mockResolvedValue({ locked: false, lock_is_stale: false, cap_paused: false })
    await act(async () => {
      sub.cbs.onTerminal("done")
    })
    await waitFor(() => expect(useStreamsStore.getState().workflowLockByThread.has(THREAD)).toBe(false))
    expect(useStreamsStore.getState().continuingThreads.has(THREAD)).toBe(false)
    expect(useStreamsStore.getState().streamingThreads.has(THREAD)).toBe(false)
    expect(assistants()[0].runStatus).toBe("completed")
  })

  it("5: `done` with the server still reporting a pause keeps the card", async () => {
    await mountAndView()
    seedPausedTurn()
    const sub = await followFromButton()
    mockGetThreadWorkflow.mockResolvedValue({ locked: false, lock_is_stale: false, cap_paused: true })
    await act(async () => {
      sub.cbs.onTerminal("done")
    })
    await act(async () => {
      await Promise.resolve()
    })
    expect(useStreamsStore.getState().workflowLockByThread.get(THREAD)?.capPaused).toBe(true)
  })

  it("6: a re-pause ends the segment — Continuing… clears, the lock re-pauses, the stream closes", async () => {
    await mountAndView()
    seedPausedTurn()
    const sub = await followFromButton()
    act(() => {
      sub.cbs.onCapPaused?.({ runId: RUN, toolNames: ["execute_code"], continuesUsed: 2, continuesRemaining: 1 })
    })
    expect(useStreamsStore.getState().continuingThreads.has(THREAD)).toBe(false)
    expect(useStreamsStore.getState().workflowLockByThread.get(THREAD)).toMatchObject({
      runId: RUN,
      capPaused: true,
      continuesRemaining: 1,
    })
    expect(assistants()[0].runStatus).toBe("completed")
    expect(useStreamsStore.getState().streamingThreads.has(THREAD)).toBe(false)
    expect(sub.signal?.aborted).toBe(true)
  })
})

describe("292.1 UAT — the typed path: a continued:true send follows the same run too", () => {
  it("7: continued:true with stream_since follows the run and its events land in the existing turn", async () => {
    await mountAndView()
    seedPausedTurn()
    useStreamsStore.setState({ continuingThreads: new Set() })
    mockPostMessage.mockResolvedValue({
      continued: true,
      run_id: RUN,
      message_id: null,
      continues_used: 1,
      continues_remaining: 2,
      stream_since: SINCE,
    })
    await act(async () => {
      await actions!.sendMessage(THREAD, "continue")
    })
    await waitFor(() => expect(subs).toHaveLength(1))
    expect(subs[0].rid).toBe(RUN)
    expect(subs[0].since).toBe(SINCE)
    expect(bucket().filter((m) => m.role === "user")).toHaveLength(0)
    driveContinuation(subs[0].cbs)
    expect(assistants()).toHaveLength(1)
    expect(assistants()[0].content).toBe("The answer is 42.")
    expect(assistants()[0].tool_calls).toHaveLength(3)
    expect(useStreamsStore.getState().continuingThreads.has(THREAD)).toBe(true)
  })
})
