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
  // Phase 176-04 RENDER-03: StreamsProvider's non-dispatch early-return stashes a
  // quiet reconcileErrors hint as an ApiError (the same 099-08 seam carrier that
  // renders a custom banner message). The provider imports ApiError from this module,
  // so the mock must provide a compatible constructor or `new ApiError(...)` throws.
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
    failedSendDrafts: new Map<string, string>(),
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
 * Phase 176 RENDER-01 (D-05 option b / D-06) + WR-01 — a single send must render
 * exactly ONE user bubble, and the dedup must be IDENTITY-based (the persisted
 * message_id), never a cross-clock created_at compare.
 *
 * WR-01 root cause: the optimistic user temp's created_at is the CLIENT clock; its
 * persisted twin's created_at is the SERVER clock. The ORIGINAL guard dropped the
 * temp only when `serverTs >= clientTs`, so a client-ahead skew (a common few-second
 * drift) made the genuine twin compare "older" → the temp was NOT superseded → BOTH
 * rows rendered = a duplicate user bubble that persisted to reload. The old test
 * hardcoded a `2099` twin timestamp, which always beat the temp's clock and so hid
 * the skew hole entirely.
 *
 * Fix: the temp is deduped against its OWN persisted twin by message_id IDENTITY —
 * stamped as `registeredUserMsgId` when postMessage resolves (reconcile path), and,
 * for a reconcile that races AHEAD of the resolve, dropped at swap time when the
 * twin (id === message_id) is already merged. Both are skew-free and content-
 * normalization-proof. D-06 preserve is intact: a still-in-flight temp with no
 * confirmed twin survives. These tests exercise the EARLIER-server-timestamp skew
 * case that used to hide the bug, under both race orderings.
 */
type TestSnapshot = {
  messages: Message[]
  active_runs: never[]
  since_cursors: Record<string, string>
  runs_status: Record<string, string>
  recently_active: never[]
}

describe("Phase 176 RENDER-01 / WR-01 — identity-based user-temp dedup (skew-immune)", () => {
  it("drops the optimistic user temp for its persisted twin under CLIENT-AHEAD clock skew — reconcile races ahead of the resolve (one user bubble)", async () => {
    const THREAD_ID = "thread-dup"
    const RUN_ID = "run-dup"
    const REAL_USER_MSG_ID = "persisted-user-row"
    const CONTENT = "say hi briefly"

    // Gate getSnapshot so reconcile's MERGE fires AFTER the optimistic writes but
    // BEFORE postMessage stamps the message_id — the exact race window WR-01 targets.
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

    // Pre-check: exactly one optimistic user temp (no message_id yet) in the bucket.
    const bucketPre =
      useStreamsStore.getState().bucketsBySurface.get("chat")?.get(THREAD_ID) ?? []
    expect(bucketPre.filter((m) => m.role === "user")).toHaveLength(1)
    const tempUser = bucketPre.find((m) => m.role === "user")
    expect(tempUser?.id.startsWith("temp-")).toBe(true)

    // Resolve getSnapshot with the persisted twin BUT with a server created_at
    // EARLIER than the temp's client created_at — the client-ahead skew the old
    // `created_at >=` guard got wrong (it kept BOTH rows). The reconcile runs
    // pre-resolve, so the temp has no registeredUserMsgId yet → it is PRESERVED here
    // (D-06); the identity dedup lands at the postMessage resolve below.
    const skewedEarlier = new Date(Date.parse(tempUser!.created_at) - 5000).toISOString()
    await act(async () => {
      resolveSnapshot({
        messages: [
          {
            id: REAL_USER_MSG_ID,
            thread_id: THREAD_ID,
            user_id: "user-1",
            role: "user",
            content: CONTENT,
            created_at: skewedEarlier,
            updated_at: skewedEarlier,
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

    // Resolve postMessage with the SAME message_id the snapshot twin carries. The
    // swap path sees the twin already merged → DROPS the temp (never mints a second
    // same-id row), leaving exactly ONE user bubble — the persisted twin. Under the
    // OLD skew-fragile guard this ended as two same-id user rows.
    await act(async () => {
      resolvePost({ run_id: RUN_ID, message_id: REAL_USER_MSG_ID })
      await Promise.resolve()
      await Promise.resolve()
    })
    await waitFor(() => expect(mockSubscribeToRun).toHaveBeenCalledTimes(1))

    const bucketPost =
      useStreamsStore.getState().bucketsBySurface.get("chat")?.get(THREAD_ID) ?? []
    const userRows = bucketPost.filter((m) => m.role === "user")
    expect(userRows).toHaveLength(1)
    expect(userRows[0].id).toBe(REAL_USER_MSG_ID)
    expect(userRows[0].id.startsWith("temp-")).toBe(false)

    void sendPromise
  })

  it("dedups by identity when postMessage resolves BEFORE the reconcile — realistic ordering, still skew-immune (one user bubble)", async () => {
    const THREAD_ID = "thread-dup-2"
    const RUN_ID = "run-dup-2"
    const REAL_USER_MSG_ID = "persisted-user-row-2"
    const CONTENT = "say hi briefly"

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

    const tempUser =
      (useStreamsStore.getState().bucketsBySurface.get("chat")?.get(THREAD_ID) ?? []).find(
        (m) => m.role === "user",
      )
    expect(tempUser?.id.startsWith("temp-")).toBe(true)

    // Resolve postMessage FIRST: the temp id is swapped to the real message_id and
    // registeredUserMsgId is stamped BEFORE the reconcile merges the twin.
    await act(async () => {
      resolvePost({ run_id: RUN_ID, message_id: REAL_USER_MSG_ID })
      await Promise.resolve()
      await Promise.resolve()
    })
    const midUser =
      (useStreamsStore.getState().bucketsBySurface.get("chat")?.get(THREAD_ID) ?? []).find(
        (m) => m.role === "user",
      )
    expect(midUser?.id).toBe(REAL_USER_MSG_ID)
    expect(midUser?.registeredUserMsgId).toBe(REAL_USER_MSG_ID)

    // Reconcile merges the persisted twin with an EARLIER server created_at (skew).
    // The swapped (non-temp) row is replaced by the snapshot twin — one user bubble.
    const skewedEarlier = new Date(Date.parse(midUser!.created_at) - 5000).toISOString()
    await act(async () => {
      resolveSnapshot({
        messages: [
          {
            id: REAL_USER_MSG_ID,
            thread_id: THREAD_ID,
            user_id: "user-1",
            role: "user",
            content: CONTENT,
            created_at: skewedEarlier,
            updated_at: skewedEarlier,
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

    const bucketPost =
      useStreamsStore.getState().bucketsBySurface.get("chat")?.get(THREAD_ID) ?? []
    const userRows = bucketPost.filter((m) => m.role === "user")
    expect(userRows).toHaveLength(1)
    expect(userRows[0].id).toBe(REAL_USER_MSG_ID)

    void sendPromise
  })

  it("preserves the in-flight temp when the snapshot holds a prior-turn user row (no registered twin → survives, D-06 intact)", async () => {
    // D-06 guard: the WR-01 identity fix must NOT weaken the 075.7 preserve. A
    // pre-resolve temp carries no registeredUserMsgId yet, so it has NO confirmed
    // twin — it survives regardless of a prior-turn persisted row's content (the
    // identity match is scoped to the temp's OWN message_id, never content). Two
    // distinct user bubbles are correct here.
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

/**
 * Phase 176-04 RENDER-03 (D-10.2 / D-11) — honesty guarantee on the non-dispatch
 * early-return.
 *
 * sendMessage's duplicate-guard (`if (sendingThreadsRef.current.has(threadId))
 * return`) protects against a re-entrant/racing second send into a thread that is
 * already sending (SEED-055 per-thread mutex). It USED to return SILENTLY — so if a
 * fresh-thread reconcile race ever routed the real send through this branch, the
 * user's just-typed message vanished with no trace (the intermittent silent
 * send-drop, BUG-260603-01).
 *
 * Fix (Task 1): before returning, stash the dropped draft in `failedSendDrafts` +
 * a quiet `reconcileErrors` hint through the EXISTING 099-08 recovery seam (the same
 * store-update shape as the ApiError rollback path) so ChatArea's
 * `prefillMessage={failedDraft ?? …}` restores the composer text and the per-thread
 * banner surfaces the honest hint. No new toast/error channel (D-11). The
 * successful-dispatch path and the ApiError rollback are untouched.
 */
describe("Phase 176-04 RENDER-03 — non-dispatch early-return stashes an honest recoverable draft", () => {
  it("stashes failedSendDrafts + a quiet reconcileErrors hint when a second same-thread send hits the duplicate-guard", async () => {
    const THREAD_ID = "thread-nondispatch"

    // Gate postMessage so the FIRST send stays in flight (sendingThreadsRef holds
    // THREAD_ID) while the SECOND send fires and hits the duplicate-guard.
    let resolvePost!: (resp: { run_id: string; message_id: string }) => void
    const postPromise = new Promise<{ run_id: string; message_id: string }>((resolve) => {
      resolvePost = resolve
    })
    mockPostMessage.mockImplementation(() => postPromise)
    mockGetSnapshot.mockResolvedValue({
      messages: [],
      active_runs: [],
      since_cursors: {},
      runs_status: {},
      recently_active: [],
    })

    const { result } = renderProvider()

    // Send #1 — dispatches, suspends at the gated postMessage → the thread is now in
    // sendingThreadsRef for the duration.
    let firstSend!: Promise<void>
    await act(async () => {
      firstSend = result.current.sendMessage(THREAD_ID, "first message")
    })
    expect(mockPostMessage).toHaveBeenCalledTimes(1)

    // Send #2 into the SAME thread — hits the duplicate-guard non-dispatch early-return.
    await act(async () => {
      await result.current.sendMessage(THREAD_ID, "second dropped message")
    })

    // The second send did NOT dispatch (postMessage still called exactly once)…
    expect(mockPostMessage).toHaveBeenCalledTimes(1)

    // …but it was NOT silently lost: the dropped draft + a quiet retry hint are
    // stashed on the EXISTING failedSendDrafts / reconcileErrors seam.
    const state = useStreamsStore.getState()
    expect(state.failedSendDrafts.get(THREAD_ID)).toBe("second dropped message")
    expect(state.reconcileErrors.get(THREAD_ID)?.message).toBe("Couldn't send — tap to retry")

    // Finish the first send cleanly so no promise dangles.
    mockSubscribeToRun.mockResolvedValue(undefined)
    await act(async () => {
      resolvePost({ run_id: "run-1", message_id: "msg-1" })
    })
    void firstSend
  })

  it("a normal successful send stashes nothing (no false send-drop hint)", async () => {
    const THREAD_ID = "thread-clean-send"
    mockPostMessage.mockResolvedValue({ run_id: "run-ok", message_id: "msg-ok" })
    mockSubscribeToRun.mockResolvedValue(undefined)
    mockGetSnapshot.mockResolvedValue({
      messages: [],
      active_runs: [],
      since_cursors: {},
      runs_status: {},
      recently_active: [],
    })

    const { result } = renderProvider()
    await act(async () => {
      await result.current.sendMessage(THREAD_ID, "clean message")
    })

    const state = useStreamsStore.getState()
    expect(state.failedSendDrafts.has(THREAD_ID)).toBe(false)
    expect(state.reconcileErrors.has(THREAD_ID)).toBe(false)
  })
})

/**
 * Phase 176-04 RENDER-03 (D-10.1) — fresh-thread ordering tighten via a sibling
 * pending-send ref honored by the preserve-guard.
 *
 * On a fresh thread ChatArea does onCreateThread → setViewingThread (fires the
 * nav reconcile) → sendMessage (whose sendingThreadsRef.add lives INSIDE
 * sendMessage, i.e. AFTER the nav reconcile fires). To tighten that ordering,
 * ChatArea now pre-marks the thread via `markThreadPendingSend(threadId)` BEFORE
 * setViewingThread, adding it to a SIBLING `pendingSendThreadsRef`. The
 * preserve-guard's `sendInFlightOnThisThread` honors BOTH refs, so the reconcile
 * the nav triggers preserves the optimistic temp even in the pre-`sendingThreadsRef`
 * window. Critically the duplicate-guard at sendMessage's top still checks ONLY
 * `sendingThreadsRef`, so the pending flag does NOT trip it — the real send still
 * dispatches (a tripped guard would drop the send, which Task 1's honesty guard
 * would then merely recover; here we want the send to ACTUALLY go).
 */
describe("Phase 176-04 RENDER-03 — fresh-thread pending-send flag honored by the preserve-guard (D-10.1)", () => {
  it("a reconcile fired while ONLY the pending flag is set preserves the optimistic temp", async () => {
    const THREAD_ID = "thread-pending-preserve"
    mockGetSnapshot.mockResolvedValue({
      messages: [],
      active_runs: [],
      since_cursors: {},
      runs_status: {},
      recently_active: [],
    })

    const { result } = renderProvider()

    // Pre-mark pending-send BEFORE the nav reconcile (mirrors ChatArea handleSend).
    // This does NOT add to sendingThreadsRef — only the sibling pending ref.
    result.current.markThreadPendingSend(THREAD_ID)

    // Seed the optimistic user temp a fresh send would write (untyped — no runId).
    useStreamsStore.setState((s) => {
      const surfMap = new Map(s.bucketsBySurface.get("chat") ?? new Map())
      surfMap.set(THREAD_ID, [
        {
          id: "temp-user",
          thread_id: THREAD_ID,
          user_id: "",
          role: "user",
          content: "fresh hi",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          tool_calls: [],
        },
      ])
      const nextBuckets = new Map(s.bucketsBySurface)
      nextBuckets.set("chat", surfMap)
      return { bucketsBySurface: nextBuckets }
    })

    // Fire the reconcile the nav triggers. sendingThreadsRef is EMPTY — only the
    // pending flag is set. The negative companion above proves that WITHOUT an
    // in-flight marker the stray untyped temp is discarded; here the pending flag
    // makes sendInFlightOnThisThread true so the temp SURVIVES.
    await act(async () => {
      result.current.setViewingThread(THREAD_ID)
    })

    await waitFor(() => {
      const bucket =
        useStreamsStore.getState().bucketsBySurface.get("chat")?.get(THREAD_ID) ?? []
      expect(bucket).toHaveLength(1)
      expect(bucket[0].id).toBe("temp-user")
    })
  })

  it("does NOT trip the duplicate-guard — the real send dispatches — and clears the pending flag on resolve", async () => {
    const THREAD_ID = "thread-pending-dispatch"

    let resolvePost!: (resp: { run_id: string; message_id: string }) => void
    const postPromise = new Promise<{ run_id: string; message_id: string }>((resolve) => {
      resolvePost = resolve
    })
    mockPostMessage.mockImplementation(() => postPromise)
    mockSubscribeToRun.mockResolvedValue(undefined)
    mockGetSnapshot.mockResolvedValue({
      messages: [],
      active_runs: [],
      since_cursors: {},
      runs_status: {},
      recently_active: [],
    })

    const { result } = renderProvider()

    // Mirror ChatArea's fresh-thread ordering exactly: pre-mark pending, THEN
    // setViewingThread (pools the thread + fires the nav reconcile), THEN sendMessage.
    // The pre-mark must NOT make sendMessage's duplicate-guard early-return.
    result.current.markThreadPendingSend(THREAD_ID)
    await act(async () => {
      result.current.setViewingThread(THREAD_ID)
    })

    let sendPromise!: Promise<void>
    await act(async () => {
      sendPromise = result.current.sendMessage(THREAD_ID, "real send")
    })

    // The duplicate-guard checks ONLY sendingThreadsRef — the pending flag does not
    // trip it — so the real send DISPATCHED, and nothing was stashed as a send-drop
    // (Task 1's honesty guard did NOT fire on this legitimate send).
    expect(mockPostMessage).toHaveBeenCalledTimes(1)
    expect(useStreamsStore.getState().failedSendDrafts.has(THREAD_ID)).toBe(false)

    // Resolve so the send completes and the finally clears BOTH refs.
    await act(async () => {
      resolvePost({ run_id: "run-p", message_id: "msg-p" })
    })
    await waitFor(() => expect(mockSubscribeToRun).toHaveBeenCalledTimes(1))
    await act(async () => {
      await sendPromise
    })

    // Cleared-on-resolve: overwrite the bucket with a lone stray untyped temp and
    // fire a fresh reconcile. With the pending flag now cleared (and no send in
    // flight), the preserve-guard discards it — proving the flag was released.
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

    await act(async () => {
      result.current.setViewingThread(THREAD_ID)
    })

    await waitFor(() => {
      const bucket =
        useStreamsStore.getState().bucketsBySurface.get("chat")?.get(THREAD_ID) ?? []
      expect(bucket.some((m) => m.id === "temp-stray")).toBe(false)
    })
  })
})
