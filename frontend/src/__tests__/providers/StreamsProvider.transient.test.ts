/**
 * Phase 075.1 Plan 01 — unit tests for the widened transient-stream-end
 * filter exported from `frontend/src/providers/StreamsProvider.tsx`.
 *
 * Decision matrix covered (mirrors PLAN.md <behavior> Tests 1-7):
 *
 *   1. kind="error" + payload startsWith "buffer_expired" + snapshot streaming
 *      → true (Phase 075 behavior preserved).
 *   2. kind="error" + payload=undefined + snapshot streaming → true (NEW —
 *      generic error fall-through is now transient when backend is still live).
 *   3. kind="done" + tool_calls includes running/preparing + snapshot streaming
 *      → true (NEW — premature done before tool results land).
 *   4. kind="done" + no running/preparing tool_calls → false (genuine
 *      completion is still terminal).
 *   5. kind="reader_done" + snapshot streaming → true (NEW — plain reader.done
 *      surfaced from api.ts:477 defensive close).
 *   6. snapshot active_runs missing the runId / status != "streaming" → false
 *      (fail-safe to terminal regardless of trigger).
 *   7. getSnapshot throws → false (fail-safe; preserves D-075-04 invariant).
 *
 * The helper is module-exported from StreamsProvider.tsx; tests mock `getSnapshot`
 * at the @/lib/api boundary just like the existing useMessages tests.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import type { ToolCall } from "@/types"

const {
  mockGetSnapshot,
  mockGetMessages,
  mockPostMessage,
  mockSubscribeToRun,
  mockGetActiveRuns,
  mockCancelRun,
  mockGetThreadWorkflow,
} = vi.hoisted(() => ({
  mockGetSnapshot: vi.fn(),
  mockGetMessages: vi.fn(),
  mockPostMessage: vi.fn(),
  mockSubscribeToRun: vi.fn(),
  mockGetActiveRuns: vi.fn(),
  mockCancelRun: vi.fn(),
  mockGetThreadWorkflow: vi.fn(),
}))

// Match the mocking strategy from src/__tests__/hooks/useMessages.test.ts —
// stub @/lib/api fully (no importActual, which would trip the eager Supabase
// client load that fails without VITE_SUPABASE_URL). Phase 145-05: the
// postMessage/subscribeToRun/getThreadWorkflow stubs are now controllable
// (hoisted refs) so the D-145-10 render test below can drive a real
// send → reader_done → reattach sequence.
vi.mock("@/lib/api", () => ({
  getSnapshot: mockGetSnapshot,
  getMessages: mockGetMessages,
  postMessage: mockPostMessage,
  subscribeToRun: mockSubscribeToRun,
  getActiveRuns: mockGetActiveRuns,
  cancelRun: mockCancelRun,
  getThreadWorkflow: mockGetThreadWorkflow,
  getThreadTodos: vi.fn().mockResolvedValue([]),
  getThreadTasks: vi.fn().mockResolvedValue([]),
  ApiError: class ApiError extends Error {},
}))

// Match useMessages.test.ts: stub supabase auth so module load does not try to
// reach a real Supabase URL (no VITE_SUPABASE_URL in vitest env).
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

// IMPORTANT: import AFTER the mocks so the SUT picks up mocked getSnapshot.
import { renderHook, act, waitFor } from "@testing-library/react"
import { createElement, type ReactNode } from "react"
import {
  _isTransientStreamEnd,
  _reattachAfterTransient,
  StreamsProvider,
  useStreamActions,
} from "@/providers/StreamsProvider"
import { useStreamsStore } from "@/stores/streamsStore"
import type { ThreadSnapshot } from "@/lib/api"
import type { MutableRefObject } from "react"

const THREAD_ID = "thread-abc"
const RUN_ID = "run-xyz"

function snapshotWithRun(streaming: boolean): ThreadSnapshot {
  return {
    messages: [],
    active_runs: streaming
      ? [{ run_id: RUN_ID, started_at: new Date().toISOString(), status: "streaming" }]
      : [],
    since_cursors: streaming ? { [RUN_ID]: "0" } : {},
  }
}

describe("_isTransientStreamEnd (Phase 075.1 Plan 01)", () => {
  beforeEach(() => {
    mockGetSnapshot.mockReset()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it("Test 1: returns snapshot on kind='error' + buffer_expired payload + snapshot streaming (Phase 075 preserved)", async () => {
    const snap = snapshotWithRun(true)
    mockGetSnapshot.mockResolvedValueOnce(snap)
    const result = await _isTransientStreamEnd(
      "error",
      "buffer_expired_during_tail",
      THREAD_ID,
      RUN_ID,
      undefined,
    )
    expect(result).toBe(snap)
    expect(mockGetSnapshot).toHaveBeenCalledWith(THREAD_ID)
  })

  it("Test 2: returns snapshot on kind='error' + undefined payload + snapshot streaming (NEW: generic error fall-through)", async () => {
    const snap = snapshotWithRun(true)
    mockGetSnapshot.mockResolvedValueOnce(snap)
    const result = await _isTransientStreamEnd(
      "error",
      undefined,
      THREAD_ID,
      RUN_ID,
      undefined,
    )
    expect(result).toBe(snap)
  })

  it("Test 3: returns snapshot on kind='done' with tool_calls still running/preparing + snapshot streaming (NEW: premature done)", async () => {
    const snap = snapshotWithRun(true)
    mockGetSnapshot.mockResolvedValueOnce(snap)
    const toolCalls: ToolCall[] = [
      { name: "execute_code", args: {}, status: "running" },
    ]
    const result = await _isTransientStreamEnd(
      "done",
      undefined,
      THREAD_ID,
      RUN_ID,
      toolCalls,
    )
    expect(result).toBe(snap)
  })

  it("Test 4: returns null on kind='done' with no running/preparing tool_calls (genuine completion stays terminal)", async () => {
    const toolCalls: ToolCall[] = [
      { name: "execute_code", args: {}, status: "done" },
    ]
    const result = await _isTransientStreamEnd(
      "done",
      undefined,
      THREAD_ID,
      RUN_ID,
      toolCalls,
    )
    expect(result).toBeNull()
    // Snapshot must NOT be probed on genuine completion (no tool churn).
    expect(mockGetSnapshot).not.toHaveBeenCalled()
  })

  it("Test 5: returns snapshot on kind='reader_done' + snapshot streaming (NEW: plain reader.done surfaced)", async () => {
    const snap = snapshotWithRun(true)
    mockGetSnapshot.mockResolvedValueOnce(snap)
    const result = await _isTransientStreamEnd(
      "reader_done",
      undefined,
      THREAD_ID,
      RUN_ID,
      undefined,
    )
    expect(result).toBe(snap)
  })

  it("Test 6: returns null when snapshot does NOT include the runId (fail-safe to terminal)", async () => {
    mockGetSnapshot.mockResolvedValueOnce(snapshotWithRun(false))
    // Try all four widened triggers — all must fall safe.
    expect(
      await _isTransientStreamEnd("error", "buffer_expired", THREAD_ID, RUN_ID, undefined),
    ).toBeNull()

    mockGetSnapshot.mockResolvedValueOnce(snapshotWithRun(false))
    expect(
      await _isTransientStreamEnd("error", undefined, THREAD_ID, RUN_ID, undefined),
    ).toBeNull()

    mockGetSnapshot.mockResolvedValueOnce(snapshotWithRun(false))
    expect(
      await _isTransientStreamEnd(
        "done",
        undefined,
        THREAD_ID,
        RUN_ID,
        [{ name: "execute_code", args: {}, status: "preparing" }],
      ),
    ).toBeNull()

    mockGetSnapshot.mockResolvedValueOnce(snapshotWithRun(false))
    expect(
      await _isTransientStreamEnd("reader_done", undefined, THREAD_ID, RUN_ID, undefined),
    ).toBeNull()
  })

  it("Test 7: returns null when getSnapshot throws (fail-safe; preserves D-075-04 invariant)", async () => {
    mockGetSnapshot.mockRejectedValueOnce(new Error("network down"))
    const result = await _isTransientStreamEnd(
      "error",
      "buffer_expired",
      THREAD_ID,
      RUN_ID,
      undefined,
    )
    expect(result).toBeNull()
  })

  it("Bonus: explicit terminals (cancelled / timed_out) are NEVER transient — short-circuit without probing snapshot", async () => {
    // No snapshot mock set — if the helper probed, the test would see
    // mockGetSnapshot return undefined and fail the active_runs.some() call.
    const cancelled = await _isTransientStreamEnd(
      "cancelled",
      undefined,
      THREAD_ID,
      RUN_ID,
      undefined,
    )
    expect(cancelled).toBeNull()
    const timed = await _isTransientStreamEnd(
      "timed_out",
      "timed_out: 120s per-call",
      THREAD_ID,
      RUN_ID,
      undefined,
    )
    expect(timed).toBeNull()
    expect(mockGetSnapshot).not.toHaveBeenCalled()
  })

  it("D-075.2-03: _reattachAfterTransient consumes threaded snapshot (no second getSnapshot probe)", async () => {
    const snap = snapshotWithRun(true)
    mockGetSnapshot.mockResolvedValueOnce(snap)
    const result = await _isTransientStreamEnd("error", "buffer_expired", THREAD_ID, RUN_ID, undefined)
    expect(result).toBe(snap)
    // Drive the reattach helper directly with the threaded snapshot:
    const lastSeenRef: MutableRefObject<Map<string, string>> = { current: new Map<string, string>() }
    const reattach = vi.fn()
    const ok = await _reattachAfterTransient(snap, THREAD_ID, RUN_ID, lastSeenRef, reattach)
    expect(ok).toBe(true)
    expect(reattach).toHaveBeenCalledTimes(1)
    // Critical: ONLY ONE getSnapshot call across the full flow.
    expect(mockGetSnapshot).toHaveBeenCalledTimes(1)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Phase 145-05 (D-145-10, FND-01) — a transient reattach RESTORES streamingThreads
//
// BUG-260707-01 root cause: the sendMessage `finally` (StreamsProvider.tsx:2020)
// unconditionally deletes threadId from streamingThreads when the awaited
// subscribeToRun resolves at a transient stream-end; the reattach callback
// (:1852) re-adds it. Because subscribeToRun fires onTerminal WITHOUT await and
// returns immediately, the finally-delete lands BEFORE the reattach-readd → nets
// to "present". Without the re-add, isStreaming (= streamingThreads.has(tid))
// reads false for the REST of a still-live run → the composer flips Stop→Send and
// the 👍/👎 feedback appear mid-run. Phase 145-05 preserves this restore so the
// composer/feedback stay HONEST until runs.status is terminal (no premature
// "done" affordances mid-run). This renders the provider (unlike the pure-helper
// tests above) to prove the streamingThreads membership end-to-end.
// ─────────────────────────────────────────────────────────────────────────────
function renderProvider() {
  return renderHook(() => useStreamActions(), {
    wrapper: ({ children }: { children: ReactNode }) =>
      createElement(StreamsProvider, null, children),
  })
}

describe("Phase 145-05 (D-145-10) — transient reattach keeps streamingThreads", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    useStreamsStore.setState({
      bucketsBySurface: new Map(),
      viewedThreadId: null,
      streamingThreads: new Set<string>(),
      fallbackNotices: new Map<string, string>(),
      reconcileErrors: new Map<string, Error>(),
      loadingThreads: new Set<string>(),
      subscriptionsByThread: new Map<string, Set<string>>(),
    })
    mockGetMessages.mockResolvedValue([])
    mockGetActiveRuns.mockResolvedValue([])
    mockCancelRun.mockResolvedValue(undefined)
    mockGetThreadWorkflow.mockResolvedValue({ locked: false })
    mockPostMessage.mockResolvedValue({ run_id: RUN_ID, message_id: "real-user-msg" })
    // First getSnapshot (the setViewingThread reconcile) → no active runs, so the
    // reconcile-derive is a no-op. Later getSnapshot calls (the transient probe
    // inside onTerminal) → the run is STILL streaming, so reader_done is treated
    // as transient and the reattach fires.
    mockGetSnapshot
      .mockResolvedValueOnce({ messages: [], active_runs: [], since_cursors: {} })
      .mockResolvedValue({
        messages: [],
        active_runs: [
          { run_id: RUN_ID, started_at: new Date().toISOString(), status: "streaming" },
        ],
        since_cursors: { [RUN_ID]: "0" },
      })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it("keeps the thread in streamingThreads after a reader_done → reattach (composer stays Stop; feedback stays hidden)", async () => {
    // 1st subscribeToRun = the initial stream: fire onTerminal WITHOUT await (like
    // api.ts), then resolve so sendMessage's `await subscribeToRun` finally runs.
    // 2nd call = the reattach: stays open (the run is still streaming).
    let subCalls = 0
    mockSubscribeToRun.mockImplementation(
      async (_rid: string, _since: string, cb: { onTerminal?: (k: string, e?: string) => void }) => {
        subCalls += 1
        if (subCalls === 1) {
          cb.onTerminal?.("reader_done")
          return
        }
        return new Promise<void>(() => {})
      },
    )

    const { result } = renderProvider()

    // Thread must be viewed to enter the stream pool (isThreadInStreamPool gates
    // both the initial subscribe and the reattach).
    await act(async () => {
      result.current.setViewingThread(THREAD_ID)
    })
    await act(async () => {
      await result.current.sendMessage(THREAD_ID, "run code that fails then retries")
    })

    await waitFor(() => expect(mockSubscribeToRun).toHaveBeenCalledTimes(2))

    // THE INVARIANT (D-145-10): still "streaming" after the transient reattach, so
    // isStreaming stays true → composer keeps Stop, feedback thumbs stay hidden.
    await waitFor(() => {
      expect(useStreamsStore.getState().streamingThreads.has(THREAD_ID)).toBe(true)
    })
  })
})
