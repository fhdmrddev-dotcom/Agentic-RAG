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

const { mockGetSnapshot } = vi.hoisted(() => ({
  mockGetSnapshot: vi.fn(),
}))

// Match the mocking strategy from src/__tests__/hooks/useMessages.test.ts —
// stub @/lib/api fully (no importActual, which would trip the eager Supabase
// client load that fails without VITE_SUPABASE_URL).
vi.mock("@/lib/api", () => ({
  getSnapshot: mockGetSnapshot,
  // Stub the other named exports the SUT module imports — only types are
  // needed at compile time; the function bodies are never called by the
  // _isTransientStreamEnd helper under test.
  getMessages: vi.fn(),
  postMessage: vi.fn(),
  subscribeToRun: vi.fn(),
  getActiveRuns: vi.fn(),
  cancelRun: vi.fn(),
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
import { _isTransientStreamEnd } from "@/providers/StreamsProvider"
import type { ThreadSnapshot } from "@/lib/api"

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

  it("Test 1: returns true on kind='error' + buffer_expired payload + snapshot streaming (Phase 075 preserved)", async () => {
    mockGetSnapshot.mockResolvedValueOnce(snapshotWithRun(true))
    const result = await _isTransientStreamEnd(
      "error",
      "buffer_expired_during_tail",
      THREAD_ID,
      RUN_ID,
      undefined,
    )
    expect(result).toBe(true)
    expect(mockGetSnapshot).toHaveBeenCalledWith(THREAD_ID)
  })

  it("Test 2: returns true on kind='error' + undefined payload + snapshot streaming (NEW: generic error fall-through)", async () => {
    mockGetSnapshot.mockResolvedValueOnce(snapshotWithRun(true))
    const result = await _isTransientStreamEnd(
      "error",
      undefined,
      THREAD_ID,
      RUN_ID,
      undefined,
    )
    expect(result).toBe(true)
  })

  it("Test 3: returns true on kind='done' with tool_calls still running/preparing + snapshot streaming (NEW: premature done)", async () => {
    mockGetSnapshot.mockResolvedValueOnce(snapshotWithRun(true))
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
    expect(result).toBe(true)
  })

  it("Test 4: returns false on kind='done' with no running/preparing tool_calls (genuine completion stays terminal)", async () => {
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
    expect(result).toBe(false)
    // Snapshot must NOT be probed on genuine completion (no tool churn).
    expect(mockGetSnapshot).not.toHaveBeenCalled()
  })

  it("Test 5: returns true on kind='reader_done' + snapshot streaming (NEW: plain reader.done surfaced)", async () => {
    mockGetSnapshot.mockResolvedValueOnce(snapshotWithRun(true))
    const result = await _isTransientStreamEnd(
      "reader_done",
      undefined,
      THREAD_ID,
      RUN_ID,
      undefined,
    )
    expect(result).toBe(true)
  })

  it("Test 6: returns false when snapshot does NOT include the runId (fail-safe to terminal)", async () => {
    mockGetSnapshot.mockResolvedValueOnce(snapshotWithRun(false))
    // Try all four widened triggers — all must fall safe.
    expect(
      await _isTransientStreamEnd("error", "buffer_expired", THREAD_ID, RUN_ID, undefined),
    ).toBe(false)

    mockGetSnapshot.mockResolvedValueOnce(snapshotWithRun(false))
    expect(
      await _isTransientStreamEnd("error", undefined, THREAD_ID, RUN_ID, undefined),
    ).toBe(false)

    mockGetSnapshot.mockResolvedValueOnce(snapshotWithRun(false))
    expect(
      await _isTransientStreamEnd(
        "done",
        undefined,
        THREAD_ID,
        RUN_ID,
        [{ name: "execute_code", args: {}, status: "preparing" }],
      ),
    ).toBe(false)

    mockGetSnapshot.mockResolvedValueOnce(snapshotWithRun(false))
    expect(
      await _isTransientStreamEnd("reader_done", undefined, THREAD_ID, RUN_ID, undefined),
    ).toBe(false)
  })

  it("Test 7: returns false when getSnapshot throws (fail-safe; preserves D-075-04 invariant)", async () => {
    mockGetSnapshot.mockRejectedValueOnce(new Error("network down"))
    const result = await _isTransientStreamEnd(
      "error",
      "buffer_expired",
      THREAD_ID,
      RUN_ID,
      undefined,
    )
    expect(result).toBe(false)
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
    expect(cancelled).toBe(false)
    const timed = await _isTransientStreamEnd(
      "timed_out",
      "timed_out: 120s per-call",
      THREAD_ID,
      RUN_ID,
      undefined,
    )
    expect(timed).toBe(false)
    expect(mockGetSnapshot).not.toHaveBeenCalled()
  })
})
