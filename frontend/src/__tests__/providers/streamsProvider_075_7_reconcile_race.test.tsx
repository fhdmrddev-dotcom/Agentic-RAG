/**
 * Phase 075.7 follow-up — reconcile-vs-sendMessage MERGE race regression guard.
 *
 * Root cause (see .planning/debug/075-7-live-render-regression.md):
 *   On a fresh thread, ChatArea's useLayoutEffect fires
 *   setViewingThread(threadId) which fires reconcile (fire-and-forget).
 *   Meanwhile sendMessage synchronously writes two optimistic `temp-`
 *   placeholders WITHOUT a runId (runId is only stamped AFTER postMessage
 *   resolves). The pre-fix reconcile MERGE predicate REQUIRED `m.runId` to
 *   keep a temp placeholder — so when getSnapshot resolved before postMessage
 *   stamped the runId, BOTH placeholders were filtered out and the bucket was
 *   wiped to []. All subsequent SSE callbacks then no-op'd against the empty
 *   bucket and nothing rendered until F5.
 *
 * Fix (StreamsProvider.tsx:790-808): widen the predicate so temp placeholders
 * without a runId ALSO survive when a sendMessage is in flight on the same
 * thread (`isSendingRef.current && streamingThreadIdRef.current === threadId`).
 *
 * This test forces the exact race ordering deterministically:
 *   1. setViewingThread fires reconcile, but getSnapshot is gated on a manual
 *      resolver so it does NOT resolve yet.
 *   2. sendMessage runs — writes userMsg + assistantMsg (no runId), then awaits
 *      postMessage (also gated on a manual resolver).
 *   3. Resolve getSnapshot FIRST with the empty fresh-thread snapshot — this
 *      triggers reconcile's setMessagesForBucket while the placeholders are
 *      still in their no-runId window.
 *   4. Assert the bucket still contains BOTH temp placeholders (user + assistant).
 *   5. Resolve postMessage so the test finalises cleanly.
 *
 * Without the fix, step 4 fails because the bucket is `[]`.
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

vi.mock("@/lib/api", () => ({
  postMessage: mockPostMessage,
  subscribeToRun: mockSubscribeToRun,
  getMessages: mockGetMessages,
  getActiveRuns: mockGetActiveRuns,
  getSnapshot: mockGetSnapshot,
  cancelRun: mockCancelRun,
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

import { StreamsProvider, useStreamActions } from "@/providers/StreamsProvider"
import { useStreamsStore } from "@/stores/streamsStore"
import type { StreamCallbacks } from "@/lib/api"
import { dedupMessagesByRunId } from "@/lib/dedupMessages"
import type { Message } from "@/types"

function renderProvider() {
  return renderHook(() => useStreamActions(), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <StreamsProvider>{children}</StreamsProvider>
    ),
  })
}

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
  mockSubscribeToRun.mockImplementation(
    async (_runId: string, _since: string, _cb: StreamCallbacks, _signal?: AbortSignal) => {
      return new Promise<void>(() => {})
    },
  )
})

afterEach(() => {
  vi.clearAllMocks()
})

describe("Phase 075.7 — reconcile-vs-sendMessage MERGE race (fresh-thread fresh-send)", () => {
  it("preserves both temp placeholders when getSnapshot resolves mid-send (before runId is stamped)", async () => {
    const THREAD_ID = "thread-fresh"
    const RUN_ID = "run-fresh"
    const REAL_USER_MSG_ID = "real-user-msg-id"

    // Gate getSnapshot so reconcile's MERGE fires deterministically AFTER
    // sendMessage's optimistic writes but BEFORE postMessage stamps the runId.
    let resolveSnapshot!: (snap: {
      messages: never[]
      active_runs: never[]
      since_cursors: Record<string, string>
      runs_status: Record<string, string>
      recently_active: never[]
    }) => void
    const snapshotPromise = new Promise<{
      messages: never[]
      active_runs: never[]
      since_cursors: Record<string, string>
      runs_status: Record<string, string>
      recently_active: never[]
    }>((resolve) => {
      resolveSnapshot = resolve
    })
    mockGetSnapshot.mockImplementation(() => snapshotPromise)

    // Gate postMessage so we can resolve it AFTER asserting the bucket survived
    // the reconcile MERGE pass.
    let resolvePost!: (resp: { run_id: string; message_id: string }) => void
    const postPromise = new Promise<{ run_id: string; message_id: string }>((resolve) => {
      resolvePost = resolve
    })
    mockPostMessage.mockImplementation(() => postPromise)

    const { result } = renderProvider()

    // Step 1: setViewingThread fires reconcile (fire-and-forget).
    //   getSnapshot is awaited but hasn't resolved yet.
    await act(async () => {
      result.current.setViewingThread(THREAD_ID)
    })

    // Step 2: kick off sendMessage. Optimistic writes land synchronously.
    //   Then it awaits postMessage which is still gated.
    let sendPromise!: Promise<void>
    await act(async () => {
      sendPromise = result.current.sendMessage(THREAD_ID, "say hi briefly")
    })

    // Pre-check: bucket contains exactly the two optimistic placeholders, both
    // missing runId (this is the race window we're testing).
    const bucketPreReconcile =
      useStreamsStore.getState().bucketsBySurface.get("chat")?.get(THREAD_ID) ?? []
    expect(bucketPreReconcile).toHaveLength(2)
    expect(bucketPreReconcile.every((m) => m.id.startsWith("temp-"))).toBe(true)
    expect(bucketPreReconcile.every((m) => m.runId === undefined)).toBe(true)
    const tempUser = bucketPreReconcile.find((m) => m.role === "user")
    const tempAssistant = bucketPreReconcile.find((m) => m.role === "assistant")
    expect(tempUser?.content).toBe("say hi briefly")
    expect(tempAssistant?.content).toBe("")

    // Step 3: resolve getSnapshot with the empty fresh-thread snapshot. This
    // runs reconcile's setMessagesForBucket MERGE while sendMessage is still
    // mid-flight (postMessage hasn't resolved → no runId stamped yet).
    await act(async () => {
      resolveSnapshot({
        messages: [],
        active_runs: [],
        since_cursors: {},
        runs_status: {},
        recently_active: [],
      })
      // Let microtasks drain so reconcile's .then chain runs.
      await Promise.resolve()
      await Promise.resolve()
    })

    // ASSERT: bucket STILL contains both placeholders. Pre-fix, this is where
    // the MERGE filtered both out and the bucket became []. Post-fix, the
    // sendInFlightOnThisThread branch keeps them.
    const bucketPostReconcile =
      useStreamsStore.getState().bucketsBySurface.get("chat")?.get(THREAD_ID) ?? []
    expect(bucketPostReconcile).toHaveLength(2)
    const survivingUser = bucketPostReconcile.find((m) => m.role === "user")
    const survivingAssistant = bucketPostReconcile.find((m) => m.role === "assistant")
    expect(survivingUser?.content).toBe("say hi briefly")
    expect(survivingAssistant).toBeTruthy()

    // Step 4: resolve postMessage so sendMessage can finish wiring subscription
    //   and stamp the runId. This validates the end-to-end path still works
    //   after the predicate change.
    await act(async () => {
      resolvePost({ run_id: RUN_ID, message_id: REAL_USER_MSG_ID })
    })

    await waitFor(() => expect(mockSubscribeToRun).toHaveBeenCalledTimes(1))

    const bucketFinal =
      useStreamsStore.getState().bucketsBySurface.get("chat")?.get(THREAD_ID) ?? []
    const finalUser = bucketFinal.find((m) => m.role === "user")
    const finalAssistant = bucketFinal.find((m) => m.role === "assistant")
    expect(finalUser?.id).toBe(REAL_USER_MSG_ID)
    expect(finalAssistant?.runId).toBe(RUN_ID)

    void sendPromise
  })

  it("when send is NOT in flight, no-runId temps are still discarded (predicate scope is correct)", async () => {
    // Negative companion: the widening MUST be gated by
    // `isSendingRef && streamingThreadIdRef === threadId`. If no send is in
    // flight, a stray no-runId temp placeholder in the bucket must NOT survive
    // a reconcile — that would be a different bug (stale optimistic state
    // leaking across thread navigation).
    const THREAD_ID = "thread-no-send"

    mockGetSnapshot.mockResolvedValue({
      messages: [],
      active_runs: [],
      since_cursors: {},
      runs_status: {},
      recently_active: [],
    })

    const { result } = renderProvider()

    // Seed a stray no-runId temp placeholder directly into the bucket.
    useStreamsStore.setState((s) => {
      const surfMap = new Map(s.bucketsBySurface.get("chat") ?? new Map())
      surfMap.set(THREAD_ID, [
        {
          id: "temp-stray",
          thread_id: THREAD_ID,
          user_id: "",
          role: "assistant",
          content: "stale",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          tool_calls: [],
        },
      ])
      const nextBuckets = new Map(s.bucketsBySurface)
      nextBuckets.set("chat", surfMap)
      return { bucketsBySurface: nextBuckets }
    })

    // Trigger reconcile via setViewingThread. No sendMessage in flight, so
    // sendInFlightOnThisThread === false, so the stray temp is filtered out.
    await act(async () => {
      result.current.setViewingThread(THREAD_ID)
    })

    await waitFor(() => {
      const bucket =
        useStreamsStore.getState().bucketsBySurface.get("chat")?.get(THREAD_ID) ?? []
      expect(bucket).toHaveLength(0)
    })
  })
})

/**
 * Phase 176 RENDER-01 (D-05 option b / D-06) — a single send must render exactly
 * ONE user bubble. The optimistic user temp (no runId) + the persisted user row
 * used to reconcile to TWO: the 075.7-widened preserve-guard kept the untyped temp
 * unconditionally while a send was in flight, so once the snapshot ALSO carried the
 * persisted twin the merge returned both (BUG-260712-02, "dup user bubble for the
 * life of the view").
 *
 * Fix: inside the untyped-temp branch, compute `supersededByPersisted` against the
 * snapshot — role user, equal content, non-temp id, created_at >= the temp — and
 * DROP the temp only once its persisted twin exists. This dedups against the
 * snapshot (mirror of the assistant-side !dbRunIds.has(runId) drop, but user temps
 * match on CONTENT, not runId) WITHOUT weakening the 075.7 preserve (a temp with no
 * twin in the snapshot is still preserved — D-06, never stop preserving temps).
 */
type TestSnapshot = {
  messages: Message[]
  active_runs: never[]
  since_cursors: Record<string, string>
  runs_status: Record<string, string>
  recently_active: never[]
}

describe("Phase 176 RENDER-01 — content-supersede drop (untyped user temp vs persisted twin)", () => {
  it("drops the optimistic user temp once the snapshot holds its identical-content persisted twin (one user bubble)", async () => {
    const THREAD_ID = "thread-dup"
    const RUN_ID = "run-dup"
    const REAL_USER_MSG_ID = "persisted-user-row"
    const CONTENT = "say hi briefly"

    // Gate getSnapshot so reconcile's MERGE fires AFTER the optimistic writes but
    // BEFORE postMessage stamps the runId — the exact race window RENDER-01 targets.
    let resolveSnapshot!: (snap: TestSnapshot) => void
    const snapshotPromise = new Promise<TestSnapshot>((resolve) => {
      resolveSnapshot = resolve
    })
    mockGetSnapshot.mockImplementation(() => snapshotPromise)

    let resolvePost!: (resp: { run_id: string; message_id: string }) => void
    const postPromise = new Promise<{ run_id: string; message_id: string }>((resolve) => {
      resolvePost = resolve
    })
    mockPostMessage.mockImplementation(() => postPromise)

    const { result } = renderProvider()

    await act(async () => {
      result.current.setViewingThread(THREAD_ID)
    })

    let sendPromise!: Promise<void>
    await act(async () => {
      sendPromise = result.current.sendMessage(THREAD_ID, CONTENT)
    })

    // Pre-check: exactly one optimistic user temp (no runId) in the bucket.
    const bucketPre =
      useStreamsStore.getState().bucketsBySurface.get("chat")?.get(THREAD_ID) ?? []
    expect(bucketPre.filter((m) => m.role === "user")).toHaveLength(1)
    expect(bucketPre.find((m) => m.role === "user")?.id.startsWith("temp-")).toBe(true)

    // Resolve getSnapshot with a snapshot that ALREADY holds the persisted user
    // row: identical content, non-temp id, created_at newer than the temp. Pre-fix
    // this is where the merge returned TWO user rows (temp + persisted).
    await act(async () => {
      resolveSnapshot({
        messages: [
          {
            id: REAL_USER_MSG_ID,
            thread_id: THREAD_ID,
            user_id: "user-1",
            role: "user",
            content: CONTENT,
            created_at: "2099-01-01T00:00:00Z",
            updated_at: "2099-01-01T00:00:00Z",
            tool_calls: [],
          } as Message,
        ],
        active_runs: [],
        since_cursors: {},
        runs_status: {},
        recently_active: [],
      })
      await Promise.resolve()
      await Promise.resolve()
    })

    // ASSERT: EXACTLY ONE user bubble — the temp was superseded by its persisted
    // twin (drop-against-snapshot). Pre-fix: two user rows.
    const bucketPost =
      useStreamsStore.getState().bucketsBySurface.get("chat")?.get(THREAD_ID) ?? []
    const userRows = bucketPost.filter((m) => m.role === "user")
    expect(userRows).toHaveLength(1)
    expect(userRows[0].id).toBe(REAL_USER_MSG_ID)
    expect(userRows[0].id.startsWith("temp-")).toBe(false)

    await act(async () => {
      resolvePost({ run_id: RUN_ID, message_id: REAL_USER_MSG_ID })
    })
    await waitFor(() => expect(mockSubscribeToRun).toHaveBeenCalledTimes(1))

    void sendPromise
  })

  it("preserves the temp when the snapshot holds a DIFFERENT-content user row (the drop is content-scoped, not a blanket stop-preserving)", async () => {
    // D-06 guard: the fix must NOT weaken the 075.7 preserve. When the snapshot
    // carries a genuinely different (earlier-turn) persisted user row, the in-flight
    // temp has NO twin → it must survive (two distinct user bubbles are correct).
    const THREAD_ID = "thread-distinct"
    const RUN_ID = "run-distinct"
    const CONTENT = "brand new question"
    const EARLIER_CONTENT = "an earlier different message"

    let resolveSnapshot!: (snap: TestSnapshot) => void
    const snapshotPromise = new Promise<TestSnapshot>((resolve) => {
      resolveSnapshot = resolve
    })
    mockGetSnapshot.mockImplementation(() => snapshotPromise)

    let resolvePost!: (resp: { run_id: string; message_id: string }) => void
    const postPromise = new Promise<{ run_id: string; message_id: string }>((resolve) => {
      resolvePost = resolve
    })
    mockPostMessage.mockImplementation(() => postPromise)

    const { result } = renderProvider()

    await act(async () => {
      result.current.setViewingThread(THREAD_ID)
    })

    let sendPromise!: Promise<void>
    await act(async () => {
      sendPromise = result.current.sendMessage(THREAD_ID, CONTENT)
    })

    await act(async () => {
      resolveSnapshot({
        messages: [
          {
            id: "persisted-earlier-row",
            thread_id: THREAD_ID,
            user_id: "user-1",
            role: "user",
            content: EARLIER_CONTENT,
            created_at: "2099-01-01T00:00:00Z",
            updated_at: "2099-01-01T00:00:00Z",
            tool_calls: [],
          } as Message,
        ],
        active_runs: [],
        since_cursors: {},
        runs_status: {},
        recently_active: [],
      })
      await Promise.resolve()
      await Promise.resolve()
    })

    // Both user rows present: the earlier persisted one AND the in-flight temp
    // (no identical-content twin → still preserved, 075.7 intact).
    const bucketPost =
      useStreamsStore.getState().bucketsBySurface.get("chat")?.get(THREAD_ID) ?? []
    const userRows = bucketPost.filter((m) => m.role === "user")
    expect(userRows).toHaveLength(2)
    expect(userRows.some((m) => m.content === CONTENT && m.id.startsWith("temp-"))).toBe(true)
    expect(userRows.some((m) => m.content === EARLIER_CONTENT)).toBe(true)

    await act(async () => {
      resolvePost({ run_id: RUN_ID, message_id: "real-user-msg-distinct" })
    })
    await waitFor(() => expect(mockSubscribeToRun).toHaveBeenCalledTimes(1))

    void sendPromise
  })
})

/**
 * Phase 174-04 (STATE-04 / D-12) — the pre-runId window this file guards is also
 * where a duplicate avatar can appear: the mount / first-SSE race can leave TWO
 * empty optimistic assistant placeholders for the SAME send in the bucket BEFORE
 * a runId exists (BUG-260610-01 reproduces even on fast OpenAI — a race, not
 * latency). The MessageList render seam (dedupMessagesByRunId) now collapses ONLY
 * that same-send twin — two ADJACENT empty temp/no-runId assistant rows — so
 * exactly one avatar renders, WITHOUT erasing the STATE-01b amber (blockedNotice)
 * bubble or a failed-send placeholder (both permanent temp/no-runId rows).
 */
function bucketRow(overrides: Partial<Message>): Message {
  return {
    id: "x",
    thread_id: "thread-fresh",
    user_id: "",
    role: "assistant",
    content: "",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    tool_calls: [],
    ...overrides,
  } as Message
}

describe("Phase 174-04 STATE-04 — pre-runId double-mount collapses to one avatar at the render seam", () => {
  it("collapses the same-send twin but leaves the amber/failed row + a genuine harness answer untouched", () => {
    // The transient bucket during the pre-runId race: user row + two empty
    // same-send placeholders (the double-mount), then — from an EARLIER send in
    // the same thread — a permanent STATE-01b amber row and a genuine harness
    // answer (real id, no runId). Only the same-send twin may collapse.
    const rendered = dedupMessagesByRunId([
      bucketRow({ id: "u1", role: "user", content: "hi" }),
      bucketRow({ id: "temp-a", runId: undefined, content: "" }),
      bucketRow({ id: "temp-b", runId: undefined, content: "" }),
      bucketRow({ id: "u0", role: "user", content: "earlier" }),
      bucketRow({ id: "temp-amber", runId: undefined, content: "", blockedNotice: { message: "blocked" } }),
      bucketRow({ id: "harness-ans", runId: undefined, content: "workflow answer" }),
    ])
    // The temp-a/temp-b twin collapses to temp-a; the amber + harness rows survive.
    const assistantIds = rendered.filter((m) => m.role === "assistant").map((m) => m.id)
    expect(assistantIds).toEqual(["temp-a", "temp-amber", "harness-ans"])
  })
})
