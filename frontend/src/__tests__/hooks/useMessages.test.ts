/**
 * Tests for the useMessages hook — Phase 067.4 Plan 02 (R-4 + R-1 protection).
 *
 * Quotes D-067.4-R4-01 (LOCKED): "Plan 02 takes a surgical handler-by-handler
 * patch approach to frontend/src/hooks/useMessages.ts. NO broad refactor of the
 * SSE event dispatcher."
 *
 * Mocks:
 *   - @/lib/api      — getMessages, postMessage, subscribeToRun, getActiveRuns,
 *                      cancelRun (all functions imported by useMessages.ts)
 *   - @/lib/supabase — auth.getSession + channel/removeChannel (so module load
 *                      doesn't try to talk to a real Supabase instance)
 *
 * SSE-stream mocking strategy (NOVEL — no prior precedent in
 * frontend/src/__tests__/hooks/, documented in 067.4-PATTERNS.md):
 *   subscribeToRun is the SSE consumer. We mock it via mockImplementation,
 *   capturing the StreamCallbacks argument, then synchronously invoke each
 *   callback inside `act()` to simulate event arrival from the wire.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, waitFor, act } from "@testing-library/react"

// ── Mock API module ───────────────────────────────────────────────────────────
// vi.mock is hoisted; use vi.hoisted() for any closure-captured vars.
const {
  mockPostMessage,
  mockSubscribeToRun,
  mockGetMessages,
  mockGetActiveRuns,
  mockCancelRun,
} = vi.hoisted(() => ({
  mockPostMessage: vi.fn(),
  mockSubscribeToRun: vi.fn(),
  mockGetMessages: vi.fn(),
  mockGetActiveRuns: vi.fn(),
  mockCancelRun: vi.fn(),
}))

vi.mock("@/lib/api", () => ({
  postMessage: mockPostMessage,
  subscribeToRun: mockSubscribeToRun,
  getMessages: mockGetMessages,
  getActiveRuns: mockGetActiveRuns,
  cancelRun: mockCancelRun,
}))

// ── Mock Supabase auth ────────────────────────────────────────────────────────
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

import { useMessages } from "@/hooks/useMessages"
import type { StreamCallbacks } from "@/lib/api"

// ── SSE recorder helper ───────────────────────────────────────────────────────
/**
 * Captures the StreamCallbacks passed to subscribeToRun. Returns a getter that
 * resolves to the captured callbacks once subscribeToRun has been invoked.
 *
 * The mock returns a never-resolving Promise — the test orchestrates event
 * arrival manually by invoking the captured callbacks. The signal argument is
 * recorded but not exercised here (R-1 / R-4 don't depend on consumer abort).
 *
 * Each call to makeSseRecorder() resets the captured slot; the most recent
 * subscribeToRun invocation wins (Test 2 needs Thread A's callbacks even
 * after Thread B's view-switch fires).
 */
function makeSseRecorder() {
  const callbacksByRunId: Map<string, StreamCallbacks> = new Map()
  let lastCallbacks: StreamCallbacks | null = null
  mockSubscribeToRun.mockImplementation(
    async (runId: string, _since: string, callbacks: StreamCallbacks, _signal?: AbortSignal) => {
      callbacksByRunId.set(runId, callbacks)
      lastCallbacks = callbacks
      // Never resolves — caller drives event arrival via captured callbacks.
      return new Promise<void>(() => {})
    },
  )
  return {
    last: () => lastCallbacks,
    forRun: (runId: string) => callbacksByRunId.get(runId),
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────
describe("useMessages — R-4 active-thread tool-stage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetMessages.mockResolvedValue([])
    mockGetActiveRuns.mockResolvedValue([])
    mockCancelRun.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  /**
   * D-067.4-R4-01 (LOCKED): "Plan 02 takes a surgical handler-by-handler patch
   * approach to frontend/src/hooks/useMessages.ts. NO broad refactor of the SSE
   * event dispatcher."
   *
   * R-4 (UAT-discovered, 067.3 carry-forward): active-thread UI freezes at
   * tool-execution stage; refetch on thread-switch repairs.
   *
   * This test simulates the canonical sandbox SSE sequence WITHOUT a
   * setViewingThread switch, then asserts the active thread's bucket reflects
   * tool_calls[0].status === "done". A failure means a tool-stage handler
   * missed the per-thread bucket write — the freeze symptom from 067.3 UAT.
   * A pass guards the surgical fix from regressing.
   */
  it("clears spinner on tool_end WITHOUT thread navigation (R-4)", async () => {
    const recorder = makeSseRecorder()
    mockPostMessage.mockResolvedValue({
      run_id: "run-A",
      message_id: "user-msg-1",
    })

    const { result } = renderHook(() => useMessages())

    // Set thread A active and submit a sandbox prompt.
    act(() => {
      result.current.setViewingThread("thread-A")
    })

    let sendPromise!: Promise<void>
    act(() => {
      sendPromise = result.current.sendMessage("thread-A", "run code")
    })

    // Wait for subscribeToRun to capture the callbacks.
    await waitFor(() => expect(mockSubscribeToRun).toHaveBeenCalled())
    const cb = recorder.last() as StreamCallbacks
    expect(cb).toBeTruthy()

    // Synchronously fire the canonical sandbox SSE sequence inside one act().
    // Sequence per 067.4-CONTEXT.md / RESEARCH.md § 2.2:
    //   tool_preparing → tool_start → code_stdout → code_execution_complete
    //   → tool_end → done → terminal('done')
    act(() => {
      cb.onToolPreparing?.("execute_code", 0)
      cb.onToolStart?.("execute_code", { code: "print(1)" })
      cb.onCodeStdout?.("1")
      cb.onCodeExecutionComplete?.(0, 100, [])
      cb.onToolEnd?.("execute_code")
      cb.onDone()
      cb.onTerminal("done")
    })

    // R-4 assertion: active thread A's bucket reflects tool_end without
    // requiring a thread navigation away+back to trigger a refetch.
    await waitFor(() => {
      const msgs = result.current.messages
      const assistant = msgs.find((m) => m.role === "assistant")
      expect(assistant?.tool_calls?.[0]?.status).toBe("done")
    })

    // Suppress the never-resolving sendMessage promise so vitest doesn't
    // complain about unhandled work — we hold a reference to satisfy lint.
    void sendPromise
  })

  /**
   * D-067.4-R4-01 (LOCKED): "Plan 02 takes a surgical handler-by-handler patch
   * approach … per-thread bucket write pattern from D-067.4-R4-01."
   *
   * R-1 protection (Phase 067.3 closed): cross-thread switch mid-stream must
   * preserve the streamed-into thread's render. Per-thread bucket write
   * (`setMessagesForThread(threadId, prev => ...)`) is the architectural fix.
   * This test guards against any regression that would re-introduce the
   * legacy single-array race.
   */
  it("preserves both threads' renders during cross-thread switch (R-1 protection)", async () => {
    const recorder = makeSseRecorder()
    mockPostMessage.mockResolvedValueOnce({
      run_id: "run-A",
      message_id: "user-msg-A",
    })

    const { result } = renderHook(() => useMessages())

    // Start stream on Thread A.
    act(() => {
      result.current.setViewingThread("thread-A")
    })

    let sendPromise!: Promise<void>
    act(() => {
      sendPromise = result.current.sendMessage("thread-A", "hello A")
    })

    await waitFor(() => expect(mockSubscribeToRun).toHaveBeenCalledTimes(1))
    const cbA = recorder.forRun("run-A") as StreamCallbacks
    expect(cbA).toBeTruthy()

    // Switch to Thread B mid-stream.
    act(() => {
      result.current.setViewingThread("thread-B")
    })

    // Fire callbacks on Thread A's run while viewing Thread B. Per the
    // per-thread bucket write pattern these MUST land in Thread A's bucket
    // regardless of viewing thread.
    act(() => {
      cbA.onDelta("partial response from A")
      cbA.onToolPreparing?.("execute_code", 0)
      cbA.onToolEnd?.("execute_code")
    })

    // Switch back to Thread A — its bucket must have the delta + tool-end-
    // applied state (per-thread write preserved Thread A's content).
    act(() => {
      result.current.setViewingThread("thread-A")
    })

    await waitFor(() => {
      const msgs = result.current.messages
      const assistant = msgs.find((m) => m.role === "assistant")
      expect(assistant?.content).toContain("partial response from A")
    })

    void sendPromise
  })
})

// ── Phase 067.4 Plan 03 — R-5 code-execution heartbeat (additive) ─────────────
/**
 * D-067.4-R5-01 (amended — orchestrator-resolved decision #1):
 *   "Plan 03 ships a heartbeat strategy (NOT line-by-line streaming): the
 *    backend's sandbox_queue drain loop emits a `code_executing` SSE event
 *    every ~1 second carrying tool_index + elapsed_seconds. The frontend
 *    handler updates tool_calls[N].elapsedSeconds for the matching
 *    execute_code tool with status==='running' on the active thread's
 *    bucket. Strictly additive — the post-completion line emit at
 *    threads.py:2123-2128 is preserved unchanged; outputLines write
 *    semantics MUST NOT be altered."
 *
 * Two regression tests guard the heartbeat:
 *   - Test 3 (additive guard): outputLines unchanged + elapsedSeconds tracks
 *     last heartbeat (last-write-wins).
 *   - Test 4 (status gate): a late-arriving onCodeExecuting after status flips
 *     to "complete" MUST NOT mutate elapsedSeconds — the matcher is
 *     `tc.name === "execute_code" && tc.status === "running"`.
 */
describe("useMessages — R-5 code-execution heartbeat (additive)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetMessages.mockResolvedValue([])
    mockGetActiveRuns.mockResolvedValue([])
    mockCancelRun.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  /**
   * D-067.4-R5-01 amended: "Strictly additive — outputLines write semantics
   * preserved (post-completion line emit at threads.py:2123-2128 unchanged)."
   *
   * Sequence: tool_start → onCodeExecuting(0, 0.5) → onCodeExecuting(0, 1.5)
   *           → onCodeStdout("hi") → onCodeExecutionComplete → tool_end
   *
   * Asserts: outputLines === [{kind:"stdout", content:"hi"}] (unchanged)
   *          AND elapsedSeconds === 1.5 (last heartbeat wins).
   */
  it("code_executing handler does NOT alter outputLines write semantics (R-5 additive)", async () => {
    const recorder = makeSseRecorder()
    mockPostMessage.mockResolvedValue({
      run_id: "run-A",
      message_id: "user-msg-1",
    })

    const { result } = renderHook(() => useMessages())

    act(() => {
      result.current.setViewingThread("thread-A")
    })

    let sendPromise!: Promise<void>
    act(() => {
      sendPromise = result.current.sendMessage("thread-A", "run code")
    })

    await waitFor(() => expect(mockSubscribeToRun).toHaveBeenCalled())
    const cb = recorder.last() as StreamCallbacks
    expect(cb).toBeTruthy()

    act(() => {
      cb.onToolStart?.("execute_code", { code: "print('hi')" })
      cb.onCodeExecuting?.(0, 0.5)         // R-5 heartbeat tick #1
      cb.onCodeExecuting?.(0, 1.5)         // R-5 heartbeat tick #2 (last wins)
      cb.onCodeStdout?.("hi")              // post-completion line emit
      cb.onCodeExecutionComplete?.(0, 100, [])
      cb.onToolEnd?.("execute_code")
    })

    await waitFor(() => {
      const tc = result.current.messages
        .find((m) => m.role === "assistant")?.tool_calls?.[0]
      // R-5 additive: outputLines write semantics preserved (Rule).
      expect(tc?.outputLines).toEqual([{ kind: "stdout", content: "hi" }])
      // R-5 last-heartbeat-wins: 1.5s overwrote 0.5s.
      expect(tc?.elapsedSeconds).toBe(1.5)
    })

    void sendPromise
  })

  /**
   * D-067.4-R5-01 amended (status gate): once onCodeExecutionComplete fires,
   * tool status flips to "complete"; subsequent late-arriving onCodeExecuting
   * heartbeats MUST be no-op (matcher only updates running tools).
   */
  it("R-5 elapsed_seconds — only updates execute_code tools with status=running", async () => {
    const recorder = makeSseRecorder()
    mockPostMessage.mockResolvedValue({
      run_id: "run-A",
      message_id: "user-msg-1",
    })

    const { result } = renderHook(() => useMessages())

    act(() => {
      result.current.setViewingThread("thread-A")
    })

    let sendPromise!: Promise<void>
    act(() => {
      sendPromise = result.current.sendMessage("thread-A", "run code")
    })

    await waitFor(() => expect(mockSubscribeToRun).toHaveBeenCalled())
    const cb = recorder.last() as StreamCallbacks
    expect(cb).toBeTruthy()

    act(() => {
      cb.onToolStart?.("execute_code", { code: "print('hi')" })
      cb.onCodeExecuting?.(0, 0.5)              // status=running → updates
      cb.onCodeExecutionComplete?.(0, 100, [])  // sets exec data; tool_end will flip status
      cb.onToolEnd?.("execute_code")            // status -> "done"
      cb.onCodeExecuting?.(0, 99.0)             // late arrival, status !== "running" → MUST be no-op
    })

    await waitFor(() => {
      const tc = result.current.messages
        .find((m) => m.role === "assistant")?.tool_calls?.[0]
      // First heartbeat preserved; the late one was rejected by the status gate.
      expect(tc?.elapsedSeconds).toBe(0.5)
    })

    void sendPromise
  })
})

// ── Phase 067.5 — Row 11 empty-thread-until-refresh regression ─────────────────
/**
 * Phase 067.5 closes Phase 067.4 Row 11 RED — the empty-thread-until-refresh
 * symptom (1-of-4 streaming threads renders empty in UI even after waiting
 * minutes; F5 repairs it; Postgres has the row; React in-memory state is stale).
 *
 * Branch decision (per .planning/phases/067.5-frontend-reconcile-fix/067.5-01-REPRO-EVIDENCE.md):
 *   D-2-EARLY-WINDOW. loadMessages fires during postMessage in-flight window
 *   when the assistant placeholder has no `runId` stamped yet (line 759 stamp
 *   hasn't run). MERGE filter at lines 644-649 of useMessages.ts requires
 *   `m.runId && ...`, so the unstamped placeholder is DROPPED. Subsequent SSE
 *   `onDelta`/`onTerminal` callbacks targeting that placeholder's `assistantId`
 *   no-op via the `m.id === assistantId` map (placeholder is gone). Bucket
 *   stays empty until F5 → mount → reconcile → loadMessages with persisted DB
 *   row repairs it.
 *
 * The fix narrows the MERGE predicate to preserve temp placeholders WITHOUT
 * a stamped runId (they represent the postMessage-in-flight window — runId
 * will be stamped soon by sendMessage line 759), while still dropping them
 * when DB has caught up on a stamped runId (D-063.1-12 invariant preserved).
 *
 * Test 1 (REQUIRED): regression guard for reconcile-on-switch-back; passes
 * against the unfixed code, must continue to pass after fix lands.
 *
 * Test 2 (BRANCH D-2-EARLY-WINDOW): RED test — fails against unfixed code,
 * passes after fix lands. Drives the early-window MERGE-drops-unstamped-
 * placeholder failure mode directly.
 */
describe("Phase 067.5 — Row 11 empty-thread-until-refresh regression", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetMessages.mockResolvedValue([])
    mockGetActiveRuns.mockResolvedValue([])
    mockCancelRun.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  /**
   * Test 1 (REQUIRED — regression guard for all branches):
   * reconcile-on-switch-back surfaces the post-`done` state in
   * messagesByThread.get(threadA), not an empty placeholder.
   *
   * Sequence: thread A streams via reconcile → switch to B → fire
   * onDone+onTerminal on Thread A's captured callbacks → DB now returns the
   * populated row → switch back to A → reconcile fires → assert content
   * surfaces.
   */
  it("reconcile on switch-back surfaces the post-done state, not an empty placeholder", async () => {
    const recorder = makeSseRecorder()

    // Thread A: getActiveRuns returns the in-flight run; getMessages starts empty.
    mockGetActiveRuns.mockImplementation(async (threadId: string) => {
      if (threadId === "thread-A") {
        return [{ run_id: "run-A", started_at: "2026-05-09T10:00:00Z" }]
      }
      return []
    })

    const { result } = renderHook(() => useMessages())

    // View Thread A and trigger reconcile (simulates ChatArea mount/visibility).
    act(() => {
      result.current.setViewingThread("thread-A")
    })
    await act(async () => {
      await result.current.reconcile("thread-A")
    })

    // Reconcile inserts a temp-run-A placeholder + opens SSE consumer.
    await waitFor(() => expect(mockSubscribeToRun).toHaveBeenCalled())
    const cbA = recorder.forRun("run-A") as StreamCallbacks
    expect(cbA).toBeTruthy()

    // Stream content into Thread A.
    act(() => {
      cbA.onDelta("hello ")
      cbA.onDelta("world")
    })

    // Switch to Thread B mid-stream.
    act(() => {
      result.current.setViewingThread("thread-B")
    })
    await act(async () => {
      await result.current.reconcile("thread-B")
    })

    // Thread A's run completes while user views Thread B.
    act(() => {
      cbA.onDone()
      cbA.onTerminal("done")
    })

    // DB has caught up — getMessages now returns the populated assistant row.
    mockGetMessages.mockImplementation(async (threadId: string) => {
      if (threadId === "thread-A") {
        return [
          {
            id: "db-A",
            thread_id: "thread-A",
            user_id: "user-1",
            role: "assistant",
            content: "hello world",
            created_at: "2026-05-09T10:00:00Z",
            updated_at: "2026-05-09T10:01:00Z",
            runId: "run-A",
            runStatus: "completed",
          },
        ]
      }
      return []
    })
    // getActiveRuns now returns empty (run completed).
    mockGetActiveRuns.mockResolvedValue([])

    // Switch back to Thread A.
    act(() => {
      result.current.setViewingThread("thread-A")
    })
    await act(async () => {
      await result.current.reconcile("thread-A")
    })

    // Assertion: messages must contain the populated content + completed status.
    await waitFor(() => {
      const assistant = result.current.messages.find((m) => m.role === "assistant")
      expect(assistant?.content).toBe("hello world")
      expect(assistant?.runStatus).toBe("completed")
    })
  })

  /**
   * Test 2 (BRANCH D-3-CLEAR-WIPES-STREAMING-BUCKET): clearMessages must NOT
   * wipe the bucket of a thread that is currently being streamed into.
   *
   * Root cause (corrected from initial D-2 analysis — D-2 was invalidated by
   * test passing against unfixed code due to isSendingRef guard at
   * useMessages.ts:603):
   *
   *   1. User on Thread A, submits prompt. sendMessage(A) starts.
   *      streamingThreadIdRef = A. isSendingRef = true. Placeholder inserted.
   *   2. User switches view to Thread X. activeThreadIdRef = X.
   *      ChatArea.tsx:89-126 useEffect fires: clearMessages() reads
   *      activeThreadIdRef = X, clears bucket X. loadMessages(X) — early-
   *      returns because isSendingRef = true. (Bucket A still intact.)
   *   3. Thread A's run completes server-side. SSE done arrives. onTerminal
   *      flips runStatus on bucket A's placeholder; subscriptionsRef.delete(A).
   *      sendMessage's finally runs — isSendingRef = false. Bucket A remains
   *      populated with the full streamed content.
   *   4. User switches BACK to Thread A. activeThreadIdRef = A.
   *      ChatArea.tsx:123 calls clearMessages() — reads activeThreadIdRef = A.
   *      **Wipes bucket A.** loadMessages(A) refetches; if isSendingRef has
   *      already been reset (step 3 finished) the MERGE restores from DB. ✓
   *      But if the user switches back BEFORE step 3 fully completes (the
   *      narrow window between SSE done arriving server-side and finally
   *      running on the consumer), isSendingRef is still true → loadMessages
   *      early-returns → bucket A stays EMPTY. Subsequent SSE callbacks
   *      targeting the dropped placeholder's `assistantId` no-op via
   *      `m.id === assistantId` map. Empty thread persists until F5.
   *
   * Fix surface: guard `clearMessages` (useMessages.ts:572-588) to refuse
   * to wipe a bucket whose thread is `streamingThreadIdRef.current` —
   * preserves the streaming bucket while loadMessages's MERGE handles
   * post-stream reconciliation cleanly.
   *
   * RED behavior (current code): bucket A wiped on switch-back to streaming
   * thread → empty render.
   * GREEN behavior (after fix): bucket A preserved → content stays visible.
   */
  it("clearMessages does not wipe a bucket whose thread is currently streaming (Branch D-3)", async () => {
    const recorder = makeSseRecorder()
    mockPostMessage.mockResolvedValue({
      run_id: "run-A",
      message_id: "user-msg-A",
    })

    const { result } = renderHook(() => useMessages())

    // User on Thread A, submits prompt.
    act(() => {
      result.current.setViewingThread("thread-A")
    })

    let sendPromise!: Promise<void>
    act(() => {
      sendPromise = result.current.sendMessage("thread-A", "hello")
    })

    // Wait for SSE consumer subscription (postMessage resolved, runId stamped).
    await waitFor(() => expect(mockSubscribeToRun).toHaveBeenCalledTimes(1))
    const cbA = recorder.forRun("run-A") as StreamCallbacks
    expect(cbA).toBeTruthy()

    // SSE deltas land in bucket A while user views A.
    act(() => {
      cbA.onDelta("partial content")
    })

    await waitFor(() => {
      const assistant = result.current.messages.find((m) => m.role === "assistant")
      expect(assistant?.content).toBe("partial content")
    })

    // User switches AWAY to Thread X (mid-stream).
    act(() => {
      result.current.setViewingThread("thread-X")
    })

    // SSE delta arrives while user views X. Bucket A's placeholder updates
    // (per-thread bucket write — D-067.3-R1).
    act(() => {
      cbA.onDelta(" more content")
    })

    // User switches BACK to Thread A — STREAMING IS STILL IN FLIGHT
    // (no onDone / onTerminal yet; isSendingRef is still true).
    act(() => {
      result.current.setViewingThread("thread-A")
    })

    // Simulate ChatArea.tsx:123 calling clearMessages() on the thread.id useEffect
    // when the user switches back to Thread A.
    act(() => {
      result.current.clearMessages()
    })

    // Branch D-3 assertion: bucket A's content MUST be preserved because
    // streamingThreadIdRef === activeThreadIdRef === "thread-A".
    // Pre-fix (RED): clearMessages wipes bucket A unconditionally → bucket is
    // empty → result.current.messages is [].
    // Post-fix (GREEN): clearMessages refuses to wipe a streaming thread's
    // bucket → assistant content remains visible.
    const assistant = result.current.messages.find((m) => m.role === "assistant")
    expect(assistant).toBeTruthy()
    expect(assistant?.content).toBe("partial content more content")

    void sendPromise
  })
})
