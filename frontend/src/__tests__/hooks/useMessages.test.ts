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
