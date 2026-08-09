/**
 * Phase 174 Plan 03 Task 3 (STATE-01b / D-04 / D-05) — the sendMessage catch 403 branch.
 *
 * Locks the STATE-01b behavior + its NARROW divergence from the existing 400/409 rollback
 * paths (D-05 byte-identical guard):
 *
 *   • 403 (workflows kill-switch / app-layer ban) → the empty assistant placeholder is
 *     REPLACED with `blockedNotice` (server ApiError.message, verbatim), the USER bubble is
 *     KEPT, and `clearWorkflowLockForThread(threadId)` fires for the OWNING thread so the
 *     composer is never left locked (D-04). No run/runs query — the 403 fires before any
 *     INSERT (Pitfall 5).
 *   • 409 (workflow-lock refusal) → UNCHANGED: rolls back BOTH bubbles + sets a per-thread
 *     `reconcileErrors` entry; NO `blockedNotice`.
 *   • 400 (disabled-skill) → UNCHANGED: rolls back BOTH + sets `reconcileErrors` +
 *     `failedSendDrafts`; NO `blockedNotice`.
 *
 * Harness mirrors streamsProvider_bug_260707_01_streaming_flag.test.tsx (the vi.hoisted API
 * mock scaffold). `ApiError` is defined inside the mock factory so BOTH this test and
 * StreamsProvider import the SAME class from "@/lib/api" — `err instanceof ApiError` in the
 * catch works, and the test can construct rejections with a real `.status`.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, waitFor, act } from "@testing-library/react"
import type { ReactNode } from "react"

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

vi.mock("@/lib/api", () => {
  // Same class both sides import → `err instanceof ApiError` holds in the catch.
  class ApiError extends Error {
    status: number
    constructor(message: string, status: number) {
      super(message)
      this.status = status
      this.name = "ApiError"
    }
  }
  return {
    ApiError,
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
import { ApiError } from "@/lib/api"
import type { Message } from "@/types"

function renderProvider() {
  return renderHook(() => useStreamActions(), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <StreamsProvider>{children}</StreamsProvider>
    ),
  })
}

function bucketFor(threadId: string): Message[] {
  return useStreamsStore.getState().bucketsBySurface.get("chat")?.get(threadId) ?? []
}

const BLOCK_MESSAGE = "Workflows are currently disabled by the administrator"

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  useStreamsStore.setState({
    bucketsBySurface: new Map(),
    viewedThreadId: null,
    streamingThreads: new Set<string>(),
    fallbackNotices: new Map<string, string>(),
    reconcileErrors: new Map<string, Error>(),
    failedSendDrafts: new Map<string, string>(),
    workflowLockByThread: new Map(),
    loadingThreads: new Set<string>(),
    subscriptionsByThread: new Map<string, Set<string>>(),
  })
  mockGetMessages.mockResolvedValue([])
  mockGetActiveRuns.mockResolvedValue([])
  mockCancelRun.mockResolvedValue(undefined)
  // Empty fresh-thread snapshot so the setViewingThread reconcile opens no
  // subscription and never touches the workflow lock we control below.
  mockGetSnapshot.mockResolvedValue({
    messages: [],
    active_runs: [],
    since_cursors: {},
    runs_status: {},
    recently_active: [],
  })
})

afterEach(() => {
  vi.clearAllMocks()
})

describe("StreamsProvider sendMessage catch — STATE-01b amber 403 (D-04) + D-05 byte-identical divergence", () => {
  it("403: stamps blockedNotice (server msg verbatim), KEEPS the user bubble, and clears the workflow lock", async () => {
    const THREAD_ID = "thread-403"
    mockPostMessage.mockRejectedValue(new ApiError(BLOCK_MESSAGE, 403))

    const { result } = renderProvider()

    await act(async () => {
      result.current.setViewingThread(THREAD_ID)
    })

    // Seed a per-thread workflow lock so the defensive D-04 clear has something to
    // clear (proves the composer is not left locked after an administrative block).
    const actions = useStreamsStore.getState().actions
    act(() => {
      actions.setWorkflowLockForThread(THREAD_ID, {
        runId: "seed-run",
        mode: "harness",
        capPaused: false,
        continuesRemaining: 3,
      })
    })
    expect(useStreamsStore.getState().workflowLockByThread.has(THREAD_ID)).toBe(true)

    const clearSpy = vi.spyOn(actions, "clearWorkflowLockForThread")

    await act(async () => {
      await result.current.sendMessage(THREAD_ID, "launch the report workflow")
    })

    const bucket = bucketFor(THREAD_ID)
    // The user bubble SURVIVES (not rolled back like the 400/409 paths).
    const user = bucket.find((m) => m.role === "user")
    expect(user?.content).toBe("launch the report workflow")
    // The assistant placeholder carries the amber blockedNotice with the server string.
    const assistant = bucket.find((m) => m.role === "assistant")
    expect(assistant?.blockedNotice?.message).toBe(BLOCK_MESSAGE)

    // D-04: the lock was cleared for the OWNING thread → composer usable.
    expect(clearSpy).toHaveBeenCalledWith(THREAD_ID)
    expect(useStreamsStore.getState().workflowLockByThread.has(THREAD_ID)).toBe(false)
  })

  it("409: rolls back BOTH bubbles + sets reconcileErrors, NO blockedNotice (unchanged, D-05)", async () => {
    const THREAD_ID = "thread-409"
    mockPostMessage.mockRejectedValue(new ApiError("locked", 409))

    const { result } = renderProvider()

    await act(async () => {
      result.current.setViewingThread(THREAD_ID)
    })
    await act(async () => {
      await result.current.sendMessage(THREAD_ID, "deep prompt into a locked thread")
    })

    const bucket = bucketFor(THREAD_ID)
    // Both optimistic bubbles are gone (the rollback shape).
    expect(bucket).toHaveLength(0)
    // A per-thread reconcile banner is set; the divergent amber field is NEVER used here.
    const banner = useStreamsStore.getState().reconcileErrors.get(THREAD_ID) as ApiError | undefined
    expect(banner?.status).toBe(409)
    expect(bucket.some((m) => m.blockedNotice)).toBe(false)
  })

  it("400: rolls back BOTH + sets reconcileErrors + failedSendDrafts, NO blockedNotice (unchanged, D-05)", async () => {
    const THREAD_ID = "thread-400"
    const DETAIL = "Skill 'foo' is disabled by your administrator."
    mockPostMessage.mockRejectedValue(new ApiError(DETAIL, 400))

    const { result } = renderProvider()

    await act(async () => {
      result.current.setViewingThread(THREAD_ID)
    })
    await act(async () => {
      await result.current.sendMessage(THREAD_ID, "use the disabled skill")
    })

    const bucket = bucketFor(THREAD_ID)
    expect(bucket).toHaveLength(0)
    // The generic-ApiError branch surfaces the SERVER detail + stashes the draft.
    const banner = useStreamsStore.getState().reconcileErrors.get(THREAD_ID)
    expect(banner?.message).toBe(DETAIL)
    expect(useStreamsStore.getState().failedSendDrafts.get(THREAD_ID)).toBe("use the disabled skill")
    expect(bucket.some((m) => m.blockedNotice)).toBe(false)
  })
})
