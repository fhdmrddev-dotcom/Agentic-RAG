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
  mockGetThreadWorkflow,
} = vi.hoisted(() => ({
  mockPostMessage: vi.fn(),
  mockSubscribeToRun: vi.fn(),
  mockGetMessages: vi.fn(),
  mockGetActiveRuns: vi.fn(),
  mockGetSnapshot: vi.fn(),
  mockCancelRun: vi.fn(),
  // ⚠ ADDED BY PHASE 194.1 PLAN 03 (R6) AND IT IS LOAD-BEARING, NOT COSMETIC.
  // `stopThread`/`stopStream` now fall back to `GET /threads/{id}/workflow` when
  // the bucket has no streaming row — which, after R5, is the NORMAL state during
  // a harness run. Left unmocked, the real implementation runs `fetch` in jsdom,
  // the resolver's own try/catch swallows the failure, and every harness Stop
  // case here reports "cancelRun called 0 times" for a reason that has nothing to
  // do with what it is testing. Measured: that is exactly what happened.
  mockGetThreadWorkflow: vi.fn(),
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
    // ⚠ THE COMPOSER MOUNTS `ConnectorsFlyout`, WHICH CALLS THIS ON MOUNT. Phase 216
    // added that component to `MessageInput` and did not widen the three suites that mock
    // this module, so they have failed with `No "listConnectorConnections" export is
    // defined on the "@/lib/api" mock` ever since — 10 red tests, none of them about
    // connectors. A mock factory is an ALLOW-LIST: an export it omits does not fall back
    // to the real module, it throws.
    listConnectorConnections: vi.fn().mockResolvedValue([]),
    ApiError: actual.ApiError,
    postMessage: mockPostMessage,
    subscribeToRun: mockSubscribeToRun,
    getMessages: mockGetMessages,
    getActiveRuns: mockGetActiveRuns,
    getSnapshot: mockGetSnapshot,
    cancelRun: mockCancelRun,
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

/**
 * A run whose SSE subscription the test can END on demand.
 *
 * ⚠ Why this exists, recorded because the obvious harness is WRONG and this
 * suite shipped the wrong one for one commit before a plant caught it.
 * `makeSseRecorder` above returns a promise that NEVER resolves, which is right
 * for delta-routing tests but fatal for anything reading `stoppedByUserRef`:
 * the `wasStoppedByUser` → `stopped: true` stamp lives in `sendMessage`'s
 * **`finally`** (`StreamsProvider.tsx:2352-2364`), reached only once
 * `await subscribeToRun(...)` RESOLVES. Under a never-resolving mock that
 * finally never runs, so `stopped` is never written and an assertion of
 * `stopped !== true` passes no matter what the ref holds.
 *
 * ⚠ And the second half of the same trap: `onTerminal("cancelled")` stamps
 * `stopped: true` UNCONDITIONALLY at `:2138` off the terminal KIND, with no
 * reference to `stoppedByUserRef` at all. A "positive control" built on
 * `cancelled` therefore proves the `kind` branch works and says nothing about
 * the ref. Both cases below use kind `"done"` on purpose, so the ONLY thing
 * that can write `stopped` is the ref.
 */
function makeControllableRun() {
  const captured: { cb: StreamCallbacks | null; resolve: (() => void) | null } = {
    cb: null,
    resolve: null,
  }
  mockSubscribeToRun.mockImplementation(
    async (_runId: string, _since: string, callbacks: StreamCallbacks) => {
      captured.cb = callbacks
      return new Promise<void>((res) => {
        captured.resolve = res
      })
    },
  )
  return {
    /** Fire a NORMAL terminal, then let `sendMessage`'s finally run. */
    async finishNormally() {
      await captured.cb!.onTerminal("done")
      captured.resolve!()
    },
  }
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
  // The DEFAULT frame names NO run, so a case that relies on the R6 fallback must
  // say so explicitly. A default that quietly supplied an id would let a case
  // pass while proving nothing about which source answered.
  mockGetThreadWorkflow.mockResolvedValue({
    active_workflow_run_id: null,
    last_workflow_run_id: null,
  })
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

    // ═══════════════════════════════════════════════════════════════════════
    // ⚠ SUPERSEDED BY PHASE 194.1 PLAN 03 (R5 + R6) — 2026-08-16. The original
    // assertions are quoted VERBATIM rather than deleted:
    //
    //     // Hop 2 landed: the placeholder carries the PRODUCER id.
    //     const bucket = useStreamsStore.getState().bucketsBySurface.get("chat")?.get("thread-H") ?? []
    //     const streaming = [...bucket].reverse().find((m) => m.role === "assistant" && m.runStatus === "streaming")
    //     expect(streaming?.runId).toBe(PRODUCER_RUN_ID)
    //     …
    //     expect(mockCancelRun).toHaveBeenCalledWith(PRODUCER_RUN_ID)
    //
    // ⚠ THE CHANGE IS REAL AND SIGNIFICANT AND IS STATED PLAINLY RATHER THAN
    // SMOOTHED: **on a HARNESS run the composer Stop no longer resolves the
    // producer `runs.run_id` at all.** R5 removes the optimistic placeholder that
    // carried it, so there is no bucket row to scan, and R6's fallback resolves
    // the thread's workflow frame instead — a `workflow_runs.id`.
    //
    // That is SAFE, and the reason is a shipped mechanism rather than an opinion:
    // `194-11` gave `DELETE /runs/{id}` a Step-1b dual-id fallback that accepts a
    // `workflow_runs.id`, whose clause (c) requires the thread anchor to still
    // point at the run — true for exactly the LIVE runs this case drives. ⚠ This
    // file's own header says `DELETE /runs/{id}` "accepts the PRODUCER
    // `runs.run_id` and nothing else"; **that sentence was made FALSE by 194-11 in
    // the same phase that wrote it**, and it is left standing above with this
    // correction beside it rather than edited away.
    //
    // ⚠ DEEP IS UNAFFECTED. R5's gate is keyed on `workflowDefinitionId`, which a
    // Deep send never sets, so a Deep composer Stop still scans the bucket and
    // still hands `cancelRun` the producer id. Only the harness surface moves.
    //
    // THE LANDMINE THIS CASE EXISTS TO GUARD IS STILL GUARDED, and the fixture is
    // built so it can still fire: `WorkflowLock.runId` is seeded here with the
    // PRODUCER id (write site #3 in its own JSDoc table — the kickoff seed) while
    // the frame returns the workflow-run anchor, so the two sources hold
    // DIFFERENT values, exactly as they do in production. If the resolver ever
    // read `workflowLockByThread` instead of the frame, the value assertion below
    // would red.
    // ═══════════════════════════════════════════════════════════════════════
    mockGetThreadWorkflow.mockResolvedValue({
      active_workflow_run_id: WORKFLOW_RUN_ANCHOR,
      last_workflow_run_id: WORKFLOW_RUN_ANCHOR,
    })

    // R5: the harness kickoff inserted NO assistant node, so the scan has nothing.
    const bucket = useStreamsStore.getState().bucketsBySurface.get("chat")?.get("thread-H") ?? []
    expect(bucket.filter((m) => m.role === "assistant")).toHaveLength(0)

    await act(async () => {
      await result.current.stopThread("thread-H")
    })

    expect(mockCancelRun).toHaveBeenCalledTimes(1)
    // THE ASSERTION THAT MATTERS IS STILL THE VALUE, NOT THE CALL — only the
    // source of the value moved.
    expect(mockCancelRun).toHaveBeenCalledWith(WORKFLOW_RUN_ANCHOR)
    // …and it came from the OWNER-SCOPED frame read, never from the lock record.
    expect(mockGetThreadWorkflow).toHaveBeenCalledWith("thread-H")
    expect(useStreamsStore.getState().workflowLockByThread.get("thread-H")?.runId).toBe(
      PRODUCER_RUN_ID,
    )
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

    // ═══════════════════════════════════════════════════════════════════════
    // ⚠ SUPERSEDED BY PHASE 194.1 PLAN 03 (R5) — 2026-08-16, and this one is
    // worth reading rather than skimming, because R5 does not merely change the
    // assertions: **IT REMOVES THE BUG THIS CASE WAS ABOUT.** The originals:
    //
    //     const last = bucket[bucket.length - 1]
    //     expect(last.role).toBe("assistant")      // MessageList's isLastAssistant
    //     expect(last.tool_calls ?? []).toHaveLength(0)  // MessageItem's !hasAnyTools
    //     expect(last.runStatus).toBe("streaming") // what the scan keys on
    //     …
    //     expect(mockCancelRun).toHaveBeenCalledWith(PRODUCER_RUN_ID)
    //
    // `BUG-260815-04` is the chat surface stuck on the pre-tools banner during a
    // harness run. That banner is `MessageItem.tsx:635`'s
    // `isStreaming && !hasAnyTools` arm, rendered on the LAST ASSISTANT ROW —
    // and after R5 a harness kickoff HAS no assistant row. The shape this case
    // drove is therefore unreachable on the harness path, which is the surface
    // removal `194.1-CONTEXT.md` D-21 claims for `BUG-260610-01`'s duplicate
    // avatar arriving in the same change.
    //
    // ⚠ THE CASE IS KEPT, NOT DELETED, AND ITS SUBJECT IS INVERTED: it now pins
    // the ABSENCE of the shape rather than survival OF it. A deleted case could
    // not tell a future reader that the state is gone by construction — it would
    // look like coverage nobody bothered to write. The Stop assertion stays,
    // because "the Stop still works in the stuck-banner scenario" is still the
    // question; only its answer's mechanism moved to R6's frame read.
    // ═══════════════════════════════════════════════════════════════════════
    const st = useStreamsStore.getState()
    expect(st.workflowLockByThread.has("thread-H")).toBe(true) // harness-locked
    expect(st.streamingThreads.has("thread-H")).toBe(true) // thread-level isStreaming
    const bucket = st.bucketsBySurface.get("chat")?.get("thread-H") ?? []
    // The banner needs a LAST ASSISTANT row. There is none — so the banner has
    // no row to be stuck on.
    expect(bucket.filter((m) => m.role === "assistant")).toHaveLength(0)
    expect(bucket[bucket.length - 1]?.role).toBe("user")

    mockGetThreadWorkflow.mockResolvedValue({
      active_workflow_run_id: "wfrun-stuck-banner",
      last_workflow_run_id: null,
    })
    await act(async () => {
      await result.current.stopThread("thread-H")
    })
    expect(mockCancelRun).toHaveBeenCalledTimes(1)
    expect(mockCancelRun).toHaveBeenCalledWith("wfrun-stuck-banner")
    // The producer id is still the one the LOCK holds, and it is still not what
    // reached `cancelRun` — the landmine guard survives the inversion.
    expect(mockCancelRun).not.toHaveBeenCalledWith(PRODUCER_RUN_ID)
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

  /**
   * ═══════════════════════════════════════════════════════════════════════════
   * ⚠ SUPERSEDED BY PHASE 194.1 PLAN 04 (R1 / D-05 / D-22) — 2026-08-16. The
   * original body, VERBATIM:
   *
   *     const onStop = vi.fn()
   *     // ChatArea.tsx:361-363 wires `onStop={stopStreaming}` and
   *     // `disabled={isStreaming}`; a harness thread additionally carries
   *     // workflowLocked. Both flags true is the live-workflow composer.
   *     render(
   *       <MessageInput onSend={vi.fn()} onStop={onStop} disabled workflowLocked threadId="thread-H" />,
   *     )
   *     const stop = screen.getByTestId("composer-stop")
   *     expect(stop).toBeInTheDocument()
   *     expect(stop).toHaveAttribute("aria-label", "Stop generation")
   *     await userEvent.click(stop)
   *     expect(onStop).toHaveBeenCalledTimes(1)
   *
   * ⚠ THE SUPERSEDED ASSERTION WAS THE WEAKER ONE, AND SAYING SO IS THE POINT.
   * `expect(onStop).toHaveBeenCalledTimes(1)` proved only that the composer invoked
   * *whatever the page handed it* — it could not see WHERE that went. The comment
   * above it (`onStop={stopStreaming}`) is precisely CONTEXT **D-22**'s finding:
   * the composer reached `stopStream`, NOT `stopThread`, and this suite's own
   * header could not tell.
   *
   * Plan 04 removes the prop entirely. The composer renders `<StopControl>`, which
   * dispatches `stopThread(threadId)` off the store — so the press can now be
   * followed all the way to `cancelRun`'s ARGUMENT, which is this file's stated
   * assertion rule (`:16-19`: never `toHaveBeenCalled()` alone, because `cancelRun`
   * swallows 404 and a wrong-id DELETE silently succeeds).
   *
   * ⚠ On this HARNESS thread the resolved id is the `workflow_runs.id` from the
   * frame, not the producer `runs.run_id` — R5 removed the bucket row that carried
   * the producer id. See the two SUPERSEDED blocks above for why that is safe
   * (`194-11`'s dual-id fallback on `DELETE /runs/{id}`).
   * ═══════════════════════════════════════════════════════════════════════════
   */
  it("the composer Stop control renders, and its press reaches cancelRun with the resolved id", async () => {
    const WORKFLOW_RUN_ANCHOR = "wfrun-composer-mount"
    mockGetThreadWorkflow.mockResolvedValue({
      active_workflow_run_id: WORKFLOW_RUN_ANCHOR,
      last_workflow_run_id: WORKFLOW_RUN_ANCHOR,
    })

    // The composer must sit INSIDE the provider now — its Stop reads the store
    // slice and dispatches the store action, rather than calling a prop.
    render(
      <StreamsProvider>
        <MessageInput onSend={vi.fn()} disabled workflowLocked threadId="thread-H" />
      </StreamsProvider>,
    )

    const stop = screen.getByTestId("composer-stop")
    expect(stop).toBeInTheDocument()
    // The accessible name is byte-unchanged through the move to a shared component.
    expect(stop).toHaveAttribute("aria-label", "Stop generation")

    await act(async () => {
      await userEvent.click(stop)
    })

    // R1: the control LEAVES the DOM in the same tick (168-B), so a second press
    // is impossible by construction.
    await waitFor(() => expect(screen.queryByTestId("composer-stop")).toBeNull())
    expect(screen.getByText("⊘ Stopping this run…")).toBeInTheDocument()

    // …and the VALUE reached the one durable cancel path.
    await waitFor(() => expect(mockCancelRun).toHaveBeenCalledWith(WORKFLOW_RUN_ANCHOR))
    expect(mockCancelRun).toHaveBeenCalledTimes(1)
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
    // ⚠ SUPERSEDED BY PHASE 194.1 PLAN 03 (R6). The original three assertions are
    // quoted VERBATIM rather than deleted, because a pin that vanishes is
    // indistinguishable from a pin that never existed:
    //
    //     expect(said).toMatch(/Stop did nothing/i)
    //     expect(said).toContain("thread-P")
    //     expect(said).toMatch(/pre-stamp/i)
    //
    // WHAT CHANGED AND WHY THE INVERSION IS THE POINT. 194-08 could only report
    // "no run id YET" and name the pre-stamp window as the CAUSE, because the
    // bucket scan was the only source of an id. 194.1 R6 adds a fallback read of
    // the thread's workflow frame (`GET /threads/{id}/workflow`), so by the time
    // this arm is reached BOTH sources have been consulted — and the pre-stamp
    // window is no longer even the likeliest explanation. A line asserting a cause
    // the code has not established is exactly the class of defect this phase
    // exists to remove, so `/pre-stamp/i` is now asserted ABSENT.
    //
    // The two properties 194-08 actually cared about are UNWEAKENED: the guard
    // still holds (zero cancels above) and the no-op is still VISIBLE.
    expect(said).toMatch(/resolved no run id/i)
    expect(said).toContain("thread-P")
    expect(said).toMatch(/nothing was cancelled/i)
    expect(said).not.toMatch(/pre-stamp/i)
    expect(said).not.toContain("press Stop again in a moment")
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
    // ⚠ SUPERSEDED BY PHASE 194.1 PLAN 03 (R6) — see the case above for the full
    // reasoning. The original assertions were, verbatim:
    //
    //     expect(said).toMatch(/Stop did nothing/i)
    //     expect(said).toContain("thread-P")
    //
    // ⚠ AND THIS CASE'S OWN SUBJECT — "behaves identically" — IS NOW STRONGER
    // THAN IT WAS. 194-08 achieved the mirroring by DUPLICATING the guard and its
    // message in both resolvers, which is what let the retired string exist TWICE
    // (`:2394` and `:2457` — CONTEXT D-22). 194.1 makes both resolvers call ONE
    // shared `resolveStopRunId` and ONE shared no-id arm, so identical behaviour
    // is now structural rather than a duplicated literal that could drift.
    expect(said).toMatch(/resolved no run id/i)
    expect(said).toContain("thread-P")
    expect(said).not.toMatch(/pre-stamp/i)
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
    const run = makeControllableRun()

    // Hold the kickoff POST open so the test acts INSIDE the real pre-stamp
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

    // ═══════════════════════════════════════════════════════════════════════
    // ⚠ SUPERSEDED BY PHASE 194.1 PLAN 03 (R5) — 2026-08-16. The originals:
    //
    //     // We are genuinely in the window: streaming placeholder, no runId yet.
    //     const inWindow = (…bucket…).filter((m) => m.role === "assistant" && m.runStatus === "streaming")
    //     expect(inWindow).toHaveLength(1)
    //     expect(inWindow[0].runId).toBeUndefined()
    //
    // R5 removes the placeholder on a harness kickoff, so "a streaming row with
    // no runId" is no longer the shape of this window — the shape is now "no
    // assistant row at all". The PROPERTY this case defends is UNCHANGED and is
    // the whole reason it survives the inversion: a Stop that cancelled NOTHING
    // must not leave the surface claiming the user stopped the run.
    //
    // The default frame mock names no run (see `beforeEach`), so this really is
    // the no-id arm on BOTH sources rather than a bucket miss papered over by a
    // frame hit — which is a stronger precondition than the original had.
    // ═══════════════════════════════════════════════════════════════════════
    const inWindow =
      (useStreamsStore.getState().bucketsBySurface.get("chat")?.get("thread-W") ?? []).filter(
        (m) => m.role === "assistant",
      )
    expect(inWindow).toHaveLength(0)

    await act(async () => {
      await result.current.stopThread("thread-W")
    })
    expect(mockCancelRun).toHaveBeenCalledTimes(0)

    // Let the run register, then END NORMALLY (kind "done" — so the only thing
    // that can write `stopped` is `stoppedByUserRef`, never the `:2138` kind
    // branch) and let sendMessage's finally run.
    await act(async () => {
      resolveKickoff({ run_id: "producer-run-late", message_id: "user-msg-late" })
      await Promise.resolve()
    })
    await waitFor(() => expect(mockSubscribeToRun).toHaveBeenCalled())
    await act(async () => {
      await run.finishNormally()
      await sendPromise
    })

    // The run ended on its own. A Stop that cancelled NOTHING must not have
    // marked it stopped-by-user.
    //
    // ⚠ SUPERSEDED BY PHASE 194.1 PLAN 03 (R5) — the ORIGINAL observable, quoted:
    //
    //     const asst = bucket.find((m) => m.role === "assistant")
    //     expect(asst?.runStatus).toBe("completed") // the finally really ran
    //     expect(asst?.stopped).not.toBe(true)
    //
    // With no placeholder on the harness path, `sendMessage`'s terminal write is
    // guarded by `if (!prev.some((m) => m.id === assistantId)) return prev` and is
    // a NO-OP — so there is no node to read `runStatus` off, and "the finally
    // really ran" needs a different witness. `streamingThreads` is that witness:
    // the finally's `streamingThreads.delete` is described in the provider as
    // "the AUTHORITATIVE streaming-end write", and it runs unconditionally.
    const bucket = useStreamsStore.getState().bucketsBySurface.get("chat")?.get("thread-W") ?? []
    expect(useStreamsStore.getState().streamingThreads.has("thread-W")).toBe(false)
    // THE PROPERTY IS UNWEAKENED, and is now asserted over the WHOLE bucket
    // rather than over one node — a stronger form, because it also catches a
    // future node that a later change might mint on this path.
    expect(bucket.filter((m) => m.stopped === true)).toHaveLength(0)
  })

  it("POSITIVE CONTROL: a Stop that DID cancel marks the message stopped, on the same 'done' terminal", async () => {
    // Without this the case above proves nothing. It must exercise the SAME
    // mechanism: kind "done", so `stopped` can only come from
    // `wasStoppedByUser`. (An earlier draft of this control used kind
    // "cancelled" and was VACUOUS — `:2138` stamps `stopped: true` off the kind
    // alone, with no reference to the ref.)
    //
    // ═══════════════════════════════════════════════════════════════════════
    // ⚠ SUPERSEDED BY PHASE 194.1 PLAN 03 (R5) — 2026-08-16, AND THE CONTROL
    // MOVED FROM THE HARNESS PATH TO THE DEEP PATH. The original opened with:
    //
    //     mockPostMessage.mockResolvedValueOnce({ run_id: "producer-run-marked", … })
    //     sendPromise = result.current.sendMessage("thread-W", "go", {
    //       workflowDefinitionId: "wf-def-1",
    //     })
    //     …
    //     expect(mockCancelRun).toHaveBeenCalledWith("producer-run-marked")
    //     …
    //     expect(asst?.stopped).toBe(true)
    //
    // WHY IT HAD TO MOVE, stated rather than smoothed: `stoppedByUserRef`'s only
    // OBSERVABLE EFFECT is `sendMessage`'s finally stamping `stopped: true` onto
    // `m.id === assistantId`. After R5 the harness path mints no such node, so on
    // that path the effect is not observable AT ALL — a control asserting it there
    // would be asserting `undefined === undefined` and would be exactly the
    // vacuous control the comment above warns about.
    //
    // ⚠ MOVING IT IS SOUND BECAUSE THE REF IS SHARED CODE, NOT PER-PATH CODE:
    // `stopThread` sets it below one resolution used by both paths, and the
    // finally that reads it is one block. Deep is simply the path on which the
    // effect still has somewhere to land — R5's gate keys on
    // `workflowDefinitionId`, which a Deep send never sets.
    //
    // ⚠ AND IT IS WORTH KNOWING WHAT THIS MEANS FOR THE PRODUCT rather than only
    // for the test: on a harness run there is no chat assistant bubble left for
    // "Response stopped" to render on. That is R5's intent — the harness run's
    // receipt is the RunCard and the panel, not a chat bubble — and it is why
    // this phase's stopping READING lives in the store rather than on a message.
    // ═══════════════════════════════════════════════════════════════════════
    const run = makeControllableRun()
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
      // DEEP: no `workflowDefinitionId`, so the placeholder is inserted exactly as
      // it always was (174 D-14 byte-identity) and carries the producer id.
      sendPromise = result.current.sendMessage("thread-W", "go")
    })
    await waitFor(() => expect(mockSubscribeToRun).toHaveBeenCalled())

    await act(async () => {
      await result.current.stopThread("thread-W")
    })
    // Deep still resolves from the BUCKET, so the producer id is still the value
    // — the original assertion, unchanged, on the path that still holds it.
    expect(mockCancelRun).toHaveBeenCalledWith("producer-run-marked")
    // ⚠ NO `expect(mockGetThreadWorkflow).not.toHaveBeenCalled()` HERE, and the
    // reason is a measurement rather than an omission: the provider's MOUNT
    // RECONCILE calls `getThreadWorkflow` on its own (`StreamsProvider.tsx`,
    // inside the reconcile action), so that assertion fails for a caller this
    // case is not about. The property is asserted the honest way instead — the
    // default frame mock (see `beforeEach`) names NO run, so a resolver that had
    // consulted the frame first would have resolved `undefined` and cancelled
    // NOTHING. The producer id above could only have come from the bucket.

    await act(async () => {
      await run.finishNormally()
      await sendPromise
    })

    const bucket = useStreamsStore.getState().bucketsBySurface.get("chat")?.get("thread-W") ?? []
    const asst = bucket.find((m) => m.role === "assistant")
    expect(asst?.stopped).toBe(true)
  })
})
