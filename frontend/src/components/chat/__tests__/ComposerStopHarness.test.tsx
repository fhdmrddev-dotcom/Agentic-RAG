/**
 * Phase 194 Plan 08 (RUN-01 / V-06) — the composer Stop during a HARNESS run.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT THIS PINS, AND WHY IT IS A *VERIFY* SUITE RATHER THAN A FIX
 * ─────────────────────────────────────────────────────────────────────────────
 * SC#1 mount 2. `StreamsProvider.stopThread` / `stopStream` resolve a run id by
 * scanning the chat bucket for the LAST assistant message with
 * `runStatus === "streaming"` and reading its `.runId`. The whole question this
 * suite answers is *which id that is*, because `DELETE /runs/{id}` accepts the
 * PRODUCER `runs.run_id` and nothing else, while `WorkflowLock.runId` carries a
 * `workflow_runs.id` on two of its four write sites. A Stop wired to the wrong
 * one SILENTLY SUCCEEDS: `api.ts::cancelRun` deliberately swallows 404
 * (`if (!res.ok && res.status !== 404) throw`, :1266-1268) so a wrong-id DELETE
 * is indistinguishable from a run another tab already cancelled.
 *
 * Hence: every case here asserts the **VALUE** handed to `cancelRun`, never
 * `expect(cancelRun).toHaveBeenCalled()` alone. A call-counting test passes
 * under the landmine.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠ A MEASURED REFUTATION OF CONTEXT'S STATED FEAR — RECORDED BESIDE THE
 *   ORIGINAL WORDING, NOT INSTEAD OF IT
 * ─────────────────────────────────────────────────────────────────────────────
 * `194-CONTEXT.md` D-08 mount 2 says of the composer Stop that whether it
 * "actually renders and fires during a workflow run is UNVERIFIED", and that
 * `BUG-260815-04` — the chat surface stuck on the pre-tools banner during a
 * harness run — "may defeat" the `runStatus === "streaming"` scan.
 *
 * MEASURED AT HEAD: it does not defeat it, and the stuck banner is itself the
 * evidence. The banner branch is `MessageItem.tsx:635`
 *
 *     ) : isStreaming && !hasAnyTools ? (
 *
 * rendered on the LAST assistant row (`MessageList.tsx:182` passes
 * `isStreaming={isStreaming && isLastAssistant}`). The scan targets the LAST
 * assistant message in the same bucket. So when the stuck banner is on screen,
 * the row the scan walks to is the row the banner is drawn on — the state
 * CONTEXT feared would hide the target is the state that displays it. The
 * "stuck banner" case below drives exactly that shape (harness-locked thread,
 * `tool_calls: []`) and PASSES.
 *
 * ⚠ The refutation is stated with its one honest qualification rather than
 * rounded up. `MessageItem`'s `isStreaming` is the THREAD-level
 * `useStreamingForThread` value, not `message.runStatus`; the two predicates
 * are not literally identical. What makes them coincide is construction, not
 * coincidence: both mint sites stamp `runStatus: "streaming"` on the
 * placeholder they add — the send-path optimistic placeholder
 * (`StreamsProvider.tsx:1926-1936`) and the reconcile re-mint (`:1621-1632`) —
 * in the same breath as the `streamingThreads` add that drives the banner. A
 * future change that added a streaming thread WITHOUT a `runStatus`-stamped row
 * would separate them; nothing does today, and this note is the place a future
 * reader learns the property rests on that.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE FOUR HOPS OF THE ID TRACE (all verified at HEAD, all exercised below)
 * ─────────────────────────────────────────────────────────────────────────────
 *  1. `:1926-1936` — `sendMessage` inserts the optimistic assistant placeholder
 *     with `runStatus: "streaming"` and NO `runId`. (The pre-stamp window; see
 *     the Task-2 describe block at the bottom of this file.)
 *  2. `:2031`      — the kickoff POST resolves and stamps `runId: run_id` from
 *     the response body. That is the PRODUCER `runs.run_id`. ✅ correct type.
 *  3. `:1621-1632` — reload/reattach re-mints the placeholder with
 *     `runId: run.run_id` off `GET /threads/{id}/active-runs` — also producer.
 *  4. `:2400-2415` — `stopThread` scans, reads `.runId`, and `await cancelRun`.
 *
 * Hops 2 and 3 each get their own case, so a regression that re-seeds the
 * placeholder from the workflow-run anchor (`active_workflow_run_id`, a
 * `workflow_runs.id` — the WRONG type) reds here rather than shipping silently.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, renderHook, screen, waitFor, act, cleanup } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import type { Message } from "@/types"

// ── Mock API module (shape ported verbatim from
//    src/__tests__/providers/streamsProvider.test.tsx:33-62) ──────────────────
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

// ⚠ `getSnapshot` is load-bearing and is NOT in the ported five: since Phase 075
// (D-075-02) `reconcile` reads the ATOMIC `getSnapshot`, not `getActiveRuns`.
// Leaving it unmocked makes the whole reconcile die in its own
// `catch { console.error("reconcile failed:") }` — silently, so hop 3 would
// simply never mint. Measured: that is exactly what happened on the first run
// of this suite.
vi.mock("@/lib/api", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/api")>()
  return {
    ApiError: actual.ApiError,
    postMessage: mockPostMessage,
    subscribeToRun: mockSubscribeToRun,
    getMessages: mockGetMessages,
    getActiveRuns: mockGetActiveRuns,
    getSnapshot: mockGetSnapshot,
    cancelRun: mockCancelRun,
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
import type { StreamCallbacks } from "@/lib/api"
import { MessageInput, _resetComposerDraftsForTest } from "../MessageInput"

// ── Helpers ──────────────────────────────────────────────────────────────────
function makeSseRecorder() {
  const callbacksByRunId: Map<string, StreamCallbacks> = new Map()
  mockSubscribeToRun.mockImplementation(
    async (runId: string, _since: string, callbacks: StreamCallbacks) => {
      callbacksByRunId.set(runId, callbacks)
      return new Promise<void>(() => {})
    },
  )
  return { forRun: (runId: string) => callbacksByRunId.get(runId) }
}

function renderProvider() {
  return renderHook(() => useStreamActions(), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <StreamsProvider>{children}</StreamsProvider>
    ),
  })
}

/** Seed a chat bucket directly — used where the SEND path is not what is under
 *  test (last-of-several selection, the empty cases). */
function seedBucket(threadId: string, messages: Message[]) {
  useStreamsStore.setState((s) => {
    const surf = new Map(s.bucketsBySurface.get("chat") ?? new Map<string, Message[]>())
    surf.set(threadId, messages)
    const buckets = new Map(s.bucketsBySurface)
    buckets.set("chat", surf)
    return { bucketsBySurface: buckets }
  })
}

function assistant(over: Partial<Message>): Message {
  return {
    id: "m-" + Math.random().toString(36).slice(2),
    thread_id: "t",
    user_id: "",
    role: "assistant",
    content: "",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    tool_calls: [],
    ...over,
  } as Message
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  _resetComposerDraftsForTest()
  useStreamsStore.setState({
    bucketsBySurface: new Map(),
    viewedThreadId: null,
    streamingThreads: new Set<string>(),
    fallbackNotices: new Map<string, string>(),
    reconcileErrors: new Map<string, Error>(),
    failedSendDrafts: new Map<string, string>(),
    loadingThreads: new Set<string>(),
    subscriptionsByThread: new Map<string, Set<string>>(),
    workflowLockByThread: new Map(),
  })
  mockGetMessages.mockResolvedValue([])
  mockGetActiveRuns.mockResolvedValue([])
  mockGetSnapshot.mockResolvedValue({ messages: [], active_runs: [], since_cursors: {} })
  mockCancelRun.mockResolvedValue(undefined)
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  vi.restoreAllMocks()
})

// =============================================================================
// V-06 — the composer Stop resolves the PRODUCER id during a harness run
// =============================================================================
describe("V-06 — composer Stop during a harness run resolves the producer runs.run_id", () => {
  it("hop 2: stopThread cancels with the EXACT run_id from the kickoff POST body", async () => {
    makeSseRecorder()
    // The producer id and the workflow-run anchor are deliberately DIFFERENT
    // strings, so an assertion on the value can tell them apart. A test that
    // reused one string for both would pass under the landmine.
    const PRODUCER_RUN_ID = "producer-run-1111-2222"
    const WORKFLOW_RUN_ANCHOR = "wfrun-aaaa-bbbb"

    mockPostMessage.mockResolvedValueOnce({
      run_id: PRODUCER_RUN_ID,
      message_id: "user-msg-1",
    })

    const { result } = renderProvider()
    await act(async () => {
      result.current.setViewingThread("thread-H")
    })
    // A workflow-run anchor is present on the thread BEFORE the send — this is
    // the wrong-type id sitting within arm's reach of the stamp site. It must
    // not be the one that reaches cancelRun.
    act(() => {
      result.current.setWorkflowLockForThread("thread-H", {
        runId: WORKFLOW_RUN_ANCHOR,
        mode: "harness",
        capPaused: false,
        continuesRemaining: 3,
      })
    })

    let sendPromise!: Promise<void>
    await act(async () => {
      sendPromise = result.current.sendMessage("thread-H", "run the workflow", {
        workflowDefinitionId: "wf-def-1",
      })
    })
    await waitFor(() => expect(mockSubscribeToRun).toHaveBeenCalled())

    // Hop 2 landed: the placeholder carries the PRODUCER id.
    const bucket = useStreamsStore.getState().bucketsBySurface.get("chat")?.get("thread-H") ?? []
    const streaming = [...bucket].reverse().find((m) => m.role === "assistant" && m.runStatus === "streaming")
    expect(streaming?.runId).toBe(PRODUCER_RUN_ID)

    await act(async () => {
      await result.current.stopThread("thread-H")
    })

    expect(mockCancelRun).toHaveBeenCalledTimes(1)
    // THE ASSERTION THAT MATTERS: the VALUE, not the call.
    expect(mockCancelRun).toHaveBeenCalledWith(PRODUCER_RUN_ID)
    expect(mockCancelRun).not.toHaveBeenCalledWith(WORKFLOW_RUN_ANCHOR)
    void sendPromise
  })

  it("the BUG-260815-04 stuck-banner state (harness-locked, ZERO tool_calls) does NOT defeat the scan", async () => {
    makeSseRecorder()
    const PRODUCER_RUN_ID = "producer-run-stuck-banner"
    mockPostMessage.mockResolvedValueOnce({
      run_id: PRODUCER_RUN_ID,
      message_id: "user-msg-2",
    })

    const { result } = renderProvider()
    await act(async () => {
      result.current.setViewingThread("thread-H")
    })
    let sendPromise!: Promise<void>
    await act(async () => {
      sendPromise = result.current.sendMessage("thread-H", "run it", {
        workflowDefinitionId: "wf-def-1",
      })
    })
    await waitFor(() => expect(mockSubscribeToRun).toHaveBeenCalled())

    // Assert we are genuinely IN the stuck-banner shape before claiming the
    // scan survives it — otherwise this case proves nothing about the bug.
    const st = useStreamsStore.getState()
    expect(st.workflowLockByThread.has("thread-H")).toBe(true) // harness-locked
    expect(st.streamingThreads.has("thread-H")).toBe(true) // thread-level isStreaming
    const bucket = st.bucketsBySurface.get("chat")?.get("thread-H") ?? []
    const last = bucket[bucket.length - 1]
    expect(last.role).toBe("assistant") // MessageList's isLastAssistant
    expect(last.tool_calls ?? []).toHaveLength(0) // MessageItem's !hasAnyTools
    expect(last.runStatus).toBe("streaming") // what the scan keys on

    await act(async () => {
      await result.current.stopThread("thread-H")
    })
    expect(mockCancelRun).toHaveBeenCalledTimes(1)
    expect(mockCancelRun).toHaveBeenCalledWith(PRODUCER_RUN_ID)
    void sendPromise
  })

  it("hop 3: a reattached run's re-minted placeholder also carries the producer run_id", async () => {
    makeSseRecorder()
    const REATTACH_RUN_ID = "producer-run-reattached"
    mockGetSnapshot.mockResolvedValue({
      messages: [],
      active_runs: [
        { run_id: REATTACH_RUN_ID, started_at: new Date().toISOString(), status: "streaming" },
      ],
      since_cursors: {},
    })

    const { result } = renderProvider()
    await act(async () => {
      result.current.setViewingThread("thread-R")
    })
    await waitFor(() => {
      const b = useStreamsStore.getState().bucketsBySurface.get("chat")?.get("thread-R") ?? []
      expect(b.some((m) => m.runId === REATTACH_RUN_ID)).toBe(true)
    })

    await act(async () => {
      await result.current.stopThread("thread-R")
    })
    expect(mockCancelRun).toHaveBeenCalledTimes(1)
    expect(mockCancelRun).toHaveBeenCalledWith(REATTACH_RUN_ID)
  })

  it("picks the LAST streaming assistant message, never the first", async () => {
    const { result } = renderProvider()
    seedBucket("thread-M", [
      assistant({ id: "a1", thread_id: "thread-M", runId: "producer-OLD", runStatus: "streaming" }),
      assistant({ id: "a2", thread_id: "thread-M", runId: "producer-NEW", runStatus: "streaming" }),
    ])

    await act(async () => {
      await result.current.stopThread("thread-M")
    })
    expect(mockCancelRun).toHaveBeenCalledTimes(1)
    expect(mockCancelRun).toHaveBeenCalledWith("producer-NEW")
  })

  it("stopThread('') and a thread with no streaming assistant call cancelRun ZERO times", async () => {
    const { result } = renderProvider()
    seedBucket("thread-Q", [
      assistant({ id: "done", thread_id: "thread-Q", runId: "producer-done", runStatus: "completed" }),
    ])

    await act(async () => {
      await result.current.stopThread("")
    })
    expect(mockCancelRun).not.toHaveBeenCalled()

    await act(async () => {
      await result.current.stopThread("thread-Q")
    })
    expect(mockCancelRun).not.toHaveBeenCalled()
  })

  it("the composer Stop control renders (and fires) while the harness thread is streaming", async () => {
    const onStop = vi.fn()
    // ChatArea.tsx:361-363 wires `onStop={stopStreaming}` and
    // `disabled={isStreaming}`; a harness thread additionally carries
    // workflowLocked. Both flags true is the live-workflow composer.
    render(
      <MessageInput onSend={vi.fn()} onStop={onStop} disabled workflowLocked threadId="thread-H" />,
    )
    const stop = screen.getByTestId("composer-stop")
    expect(stop).toBeInTheDocument()
    expect(stop).toHaveAttribute("aria-label", "Stop generation")
    await userEvent.click(stop)
    expect(onStop).toHaveBeenCalledTimes(1)
  })
})

// =============================================================================
// T-194-08-01 — the PRE-STAMP WINDOW. A Stop that did nothing must not be
//               silent, and must not leave the surface claiming the user
//               stopped the run.
// =============================================================================
/**
 * The window is real and narrow. `sendMessage` writes the optimistic assistant
 * placeholder with `runStatus: "streaming"` and NO `runId`
 * (`StreamsProvider.tsx:1926-1936`), and only stamps `runId` once the kickoff
 * POST resolves (`:2031`). Between those two points both resolvers hit
 * `if (!runId) return` — `:2386` in `stopStream`, `:2408` in `stopThread`.
 *
 * ⚠ Client-side silence COMPOUNDS with server-side silence here, which is why
 * this is worth fixing for a one-RTT window: `api.ts::cancelRun` swallows 404
 * by design, so on the OTHER side of this guard a wrong id is silent too. A
 * phase about honest Stop cannot ship a Stop whose most likely failure mode
 * produces no evidence anywhere.
 */
describe("T-194-08-01 — a Stop in the pre-stamp window is OBSERVABLE, not a silent no-op", () => {
  it("stopThread with a streaming assistant that has NO runId warns AND cancels nothing", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const { result } = renderProvider()
    seedBucket("thread-P", [
      assistant({ id: "pre-stamp", thread_id: "thread-P", runStatus: "streaming" }),
    ])

    await act(async () => {
      await result.current.stopThread("thread-P")
    })

    // Both halves, in one case: the guard still holds (no bogus cancel) AND the
    // no-op is now visible.
    expect(mockCancelRun).toHaveBeenCalledTimes(0)
    expect(warn).toHaveBeenCalled()
    const said = warn.mock.calls.map((c) => c.map(String).join(" ")).join("\n")
    expect(said).toMatch(/Stop did nothing/i)
    expect(said).toContain("thread-P")
    expect(said).toMatch(/pre-stamp/i)
  })

  it("stopStream in the same condition behaves identically", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const { result } = renderProvider()
    await act(async () => {
      result.current.setViewingThread("thread-P")
    })
    seedBucket("thread-P", [
      assistant({ id: "pre-stamp", thread_id: "thread-P", runStatus: "streaming" }),
    ])

    await act(async () => {
      await result.current.stopStream()
    })

    expect(mockCancelRun).toHaveBeenCalledTimes(0)
    expect(warn).toHaveBeenCalled()
    const said = warn.mock.calls.map((c) => c.map(String).join(" ")).join("\n")
    expect(said).toMatch(/Stop did nothing/i)
    expect(said).toContain("thread-P")
  })

  it("the HAPPY paths stay silent — otherwise the signal cannot tell silence from noise", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const { result } = renderProvider()
    await act(async () => {
      result.current.setViewingThread("thread-P")
    })
    seedBucket("thread-P", [
      assistant({
        id: "stamped",
        thread_id: "thread-P",
        runId: "producer-run-happy",
        runStatus: "streaming",
      }),
    ])

    await act(async () => {
      await result.current.stopThread("thread-P")
    })
    await act(async () => {
      await result.current.stopStream()
    })

    expect(mockCancelRun).toHaveBeenCalledTimes(2)
    expect(mockCancelRun).toHaveBeenCalledWith("producer-run-happy")
    // NOT "warn was called fewer times" — ZERO. A signal that also fires on the
    // happy path is noise, and noise is what makes an operator stop reading logs.
    expect(warn).not.toHaveBeenCalled()
  })

  it("stoppedByUserRef is NOT set on the early-return path — the message never reads 'stopped'", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {})
    const recorder = makeSseRecorder()

    // Hold the kickoff POST open so the test can act INSIDE the real pre-stamp
    // window rather than simulating it.
    let resolveKickoff!: (v: { run_id: string; message_id: string }) => void
    mockPostMessage.mockReturnValueOnce(
      new Promise<{ run_id: string; message_id: string }>((res) => {
        resolveKickoff = res
      }),
    )

    const { result } = renderProvider()
    await act(async () => {
      result.current.setViewingThread("thread-W")
    })
    let sendPromise!: Promise<void>
    await act(async () => {
      sendPromise = result.current.sendMessage("thread-W", "go", {
        workflowDefinitionId: "wf-def-1",
      })
    })

    // We are genuinely in the window: streaming placeholder, no runId yet.
    const inWindow =
      (useStreamsStore.getState().bucketsBySurface.get("chat")?.get("thread-W") ?? []).filter(
        (m) => m.role === "assistant" && m.runStatus === "streaming",
      )
    expect(inWindow).toHaveLength(1)
    expect(inWindow[0].runId).toBeUndefined()

    await act(async () => {
      await result.current.stopThread("thread-W")
    })
    expect(mockCancelRun).toHaveBeenCalledTimes(0)

    // Let the run register and then finish normally.
    await act(async () => {
      resolveKickoff({ run_id: "producer-run-late", message_id: "user-msg-late" })
      await Promise.resolve()
    })
    await waitFor(() => expect(mockSubscribeToRun).toHaveBeenCalled())
    const cb = recorder.forRun("producer-run-late") as StreamCallbacks
    expect(cb).toBeTruthy()
    await act(async () => {
      await cb.onTerminal("done")
    })

    // The run ended on its own. A Stop that cancelled NOTHING must not have
    // marked it stopped-by-user.
    const bucket = useStreamsStore.getState().bucketsBySurface.get("chat")?.get("thread-W") ?? []
    const asst = bucket.find((m) => m.role === "assistant")
    expect(asst?.stopped).not.toBe(true)
    void sendPromise
  })

  it("POSITIVE CONTROL: a Stop AFTER the stamp DOES mark the message stopped", async () => {
    // Without this the case above proves nothing — `stopped` could be a field
    // nothing ever sets in this harness, and the assertion would be vacuous.
    const recorder = makeSseRecorder()
    mockPostMessage.mockResolvedValueOnce({
      run_id: "producer-run-marked",
      message_id: "user-msg-marked",
    })

    const { result } = renderProvider()
    await act(async () => {
      result.current.setViewingThread("thread-W")
    })
    let sendPromise!: Promise<void>
    await act(async () => {
      sendPromise = result.current.sendMessage("thread-W", "go", {
        workflowDefinitionId: "wf-def-1",
      })
    })
    await waitFor(() => expect(mockSubscribeToRun).toHaveBeenCalled())

    await act(async () => {
      await result.current.stopThread("thread-W")
    })
    expect(mockCancelRun).toHaveBeenCalledWith("producer-run-marked")

    const cb = recorder.forRun("producer-run-marked") as StreamCallbacks
    await act(async () => {
      await cb.onTerminal("cancelled")
    })

    const bucket = useStreamsStore.getState().bucketsBySurface.get("chat")?.get("thread-W") ?? []
    const asst = bucket.find((m) => m.role === "assistant")
    expect(asst?.stopped).toBe(true)
    void sendPromise
  })
})
