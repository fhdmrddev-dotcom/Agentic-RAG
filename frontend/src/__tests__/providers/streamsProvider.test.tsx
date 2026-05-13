/**
 * Phase 068 (StreamsProvider Context Lift) — L-068-01..07 binding regression tests.
 *
 * Three-layer evidence stack for "preserved verbatim" (RESEARCH §Validation
 * Architecture point 3):
 *   1. Predicate-grep against StreamsProvider.tsx (Plan 1 Task 3 external check
 *      — gates `activeThreadIdRef.current =` to exactly 1; Plan 2 Task 2c keeps
 *      it at 1).
 *   2. Runtime per-surface assertions in THIS FILE — `it.each(["chat",
 *      "mock-eval"])` on the Branch D-3 guard (L-068-01 / SC#2 binding gate).
 *   3. Unmodified existing useMessages.test.ts:536-604 Branch D-3 test —
 *      passes after Plan 2 Task 3 thin-reader rewrite.
 *
 * Test names mirror the verification map in 068-VALIDATION.md so the
 * acceptance-criterion grep over `describe(...)` text finds at least 7 invariant
 * describes (L-068-01..07).
 *
 * Mocks are byte-identical to useMessages.test.ts:23-58 (vi.hoisted + vi.mock
 * for @/lib/api + @/lib/supabase). makeSseRecorder() helper ported verbatim
 * from useMessages.test.ts:76-91.
 *
 * L-068-03 static-analysis is enforced EXTERNALLY by Plan 1 Task 3 acceptance
 * criterion `grep -cE 'activeThreadIdRef\.current\s*=' StreamsProvider.tsx == 1`.
 * This file's L-068-03 test is RUNTIME-ONLY (mid-await navigation behavior) — no
 * readFileSync / fs imports here.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, waitFor, act } from "@testing-library/react"
import type { ReactNode } from "react"

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

import { StreamsProvider, useStreamActions } from "@/providers/StreamsProvider"
import { useStreamsStore } from "@/stores/streamsStore"
import type { StreamCallbacks } from "@/lib/api"

// ── SSE recorder helper (port of useMessages.test.ts:76-91) ───────────────────
function makeSseRecorder() {
  const callbacksByRunId: Map<string, StreamCallbacks> = new Map()
  let lastCallbacks: StreamCallbacks | null = null
  mockSubscribeToRun.mockImplementation(
    async (
      runId: string,
      _since: string,
      callbacks: StreamCallbacks,
      _signal?: AbortSignal,
    ) => {
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

// ── Provider wrapper helper (RESEARCH §Finding #6) ────────────────────────────
function renderProvider() {
  return renderHook(() => useStreamActions(), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <StreamsProvider>{children}</StreamsProvider>
    ),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  // Reset Zustand store to baseline so cross-test bucket/subscription state
  // does not leak. setState replaces only the keys provided (NOT a deep reset),
  // but actions get re-registered on each <StreamsProvider> mount so the
  // throwing-stub actions from the store module file are not visible to tests.
  useStreamsStore.setState({
    bucketsBySurface: new Map(),
    viewedThreadId: null,
    isStreaming: false,
    fallbackNotice: null,
    subscriptionsByRunId: new Set<string>(),
  })
  mockGetMessages.mockResolvedValue([])
  mockGetActiveRuns.mockResolvedValue([])
  mockCancelRun.mockResolvedValue(undefined)
})

afterEach(() => {
  vi.clearAllMocks()
})

// =============================================================================
// L-068-04 — R-1 protection (bucket routing on the streaming thread, not the
//            viewing thread). Mirrors useMessages.test.ts:181-231 shape but
//            asserts directly against useStreamsStore state at the bucket.
// =============================================================================
describe("Phase 068 — L-068-04 R-1 protection (per-thread bucket routing)", () => {
  it("incoming SSE deltas route to streamingThreadIdRef's bucket, NOT the viewing thread's", async () => {
    const recorder = makeSseRecorder()
    mockPostMessage.mockResolvedValueOnce({
      run_id: "run-A",
      message_id: "user-msg-A",
    })

    const { result } = renderProvider()

    // Start stream on Thread A.
    await act(async () => {
      result.current.setViewingThread("thread-A")
    })

    let sendPromise!: Promise<void>
    await act(async () => {
      sendPromise = result.current.sendMessage("thread-A", "hello A")
    })

    await waitFor(() => expect(mockSubscribeToRun).toHaveBeenCalledTimes(1))
    const cbA = recorder.forRun("run-A") as StreamCallbacks
    expect(cbA).toBeTruthy()

    // Switch view to Thread B mid-stream.
    await act(async () => {
      result.current.setViewingThread("thread-B")
    })

    // Fire delta on Thread A's run while viewing Thread B. The delta MUST land
    // in Thread A's bucket regardless of viewing thread.
    act(() => {
      cbA.onDelta("streamed")
    })

    await waitFor(() => {
      const bucketA = useStreamsStore.getState().bucketsBySurface.get("chat")?.get("thread-A") ?? []
      const assistantA = bucketA.find((m) => m.role === "assistant")
      expect(assistantA?.content).toContain("streamed")
    })

    // Thread B's bucket must NOT contain the delta (cross-thread isolation).
    const bucketB = useStreamsStore.getState().bucketsBySurface.get("chat")?.get("thread-B") ?? []
    const assistantB = bucketB.find((m) => m.role === "assistant")
    expect(assistantB?.content ?? "").not.toContain("streamed")

    void sendPromise
  })
})

// =============================================================================
// L-068-07 — cleanup on onTerminal (subscriptionsRef.delete fires inside
//            onTerminal, not in promise .finally; subscriptionsByRunId mirror
//            removed too).
// =============================================================================
describe("Phase 068 — L-068-07 cleanup on onTerminal (subscriptionsByRunId mirror)", () => {
  it("onTerminal removes the runId from subscriptionsByRunId before the .finally fires", async () => {
    const recorder = makeSseRecorder()
    mockPostMessage.mockResolvedValueOnce({
      run_id: "run-A",
      message_id: "user-msg-A",
    })

    const { result } = renderProvider()

    await act(async () => {
      result.current.setViewingThread("thread-A")
    })

    let sendPromise!: Promise<void>
    await act(async () => {
      sendPromise = result.current.sendMessage("thread-A", "hello")
    })

    await waitFor(() => expect(mockSubscribeToRun).toHaveBeenCalled())
    const cbA = recorder.forRun("run-A") as StreamCallbacks
    expect(cbA).toBeTruthy()

    // Mirror should show run-A as subscribed.
    await waitFor(() => {
      expect(useStreamsStore.getState().subscriptionsByRunId.has("run-A")).toBe(true)
    })

    // Fire onTerminal('done') — subscriptionsRef.delete fires inside this path.
    act(() => {
      cbA.onTerminal("done")
    })

    // Mirror should reflect the delete synchronously (onTerminal calls
    // setState within the same act() tick).
    await waitFor(() => {
      expect(useStreamsStore.getState().subscriptionsByRunId.has("run-A")).toBe(false)
    })

    void sendPromise
  })
})

// =============================================================================
// L-068-01 / SC#2 — Branch D-3 binding gate (per-surface). The clearThreadBucket
//                   guard refuses to wipe a bucket whose thread is currently
//                   streamed into. Tested for BOTH "chat" AND "mock-eval"
//                   surfaces — per-surface invariance per D-068-05.
// =============================================================================
describe("Phase 068 — L-068-01 Branch D-3 (clearThreadBucket guard, per-surface)", () => {
  it.each(["chat", "mock-eval"])(
    "clearThreadBucket does NOT wipe a streaming bucket on surface=%s",
    async (surface) => {
      const recorder = makeSseRecorder()
      mockPostMessage.mockResolvedValueOnce({
        run_id: "run-A",
        message_id: "user-msg-A",
      })

      const { result } = renderProvider()

      // User on Thread A, submits prompt — sendMessage opens an SSE consumer
      // on the named surface. (setViewingThread is single-arg until Task 2c
      // adds the optional surfaceId parameter; viewing-thread tracking is
      // surface-agnostic — the chat-vs-mock-eval split happens at the
      // sendMessage/clearThreadBucket call sites via surfaceId opts.)
      await act(async () => {
        result.current.setViewingThread("thread-A")
      })

      let sendPromise!: Promise<void>
      await act(async () => {
        sendPromise = result.current.sendMessage("thread-A", "hello", {
          surfaceId: surface,
        })
      })

      await waitFor(() => expect(mockSubscribeToRun).toHaveBeenCalled())
      const cbA = recorder.forRun("run-A") as StreamCallbacks
      expect(cbA).toBeTruthy()

      // SSE delta lands in bucket A while user views A.
      act(() => {
        cbA.onDelta("partial content")
      })

      await waitFor(() => {
        const bucketA =
          useStreamsStore.getState().bucketsBySurface.get(surface)?.get("thread-A") ?? []
        const assistant = bucketA.find((m) => m.role === "assistant")
        expect(assistant?.content).toBe("partial content")
      })

      // User switches AWAY to Thread X (mid-stream).
      await act(async () => {
        result.current.setViewingThread("thread-X")
      })

      // Stream advances while user views X.
      act(() => {
        cbA.onDelta(" more content")
      })

      // User switches BACK to Thread A — STREAMING IS STILL IN FLIGHT.
      await act(async () => {
        result.current.setViewingThread("thread-A")
      })

      // Fire clearMessages (clearThreadBucket on this surface). The guard
      // predicate refuses to wipe because streamingThreadIdRef === "thread-A"
      // AND activeThreadIdRef === "thread-A".
      act(() => {
        result.current.clearThreadBucket(surface)
      })

      // Bucket A MUST still contain the streamed content (Branch D-3 guard).
      const bucketAFinal =
        useStreamsStore.getState().bucketsBySurface.get(surface)?.get("thread-A") ?? []
      const assistantFinal = bucketAFinal.find((m) => m.role === "assistant")
      expect(assistantFinal).toBeTruthy()
      expect(assistantFinal?.content).toBe("partial content more content")

      void sendPromise
    },
  )
})

// =============================================================================
// L-068-02 / SC#4 — concurrent reconcile lock. Two concurrent reconcile() calls
//                   in the same tick: the second bails at the top guard.
// =============================================================================
describe("Phase 068 — L-068-02 concurrent reconcile lock (single-bit in-flight)", () => {
  it("two concurrent reconcile() calls deduplicate via the in-flight bit", async () => {
    // Slow-resolving active-runs so both reconciles overlap on the same tick.
    // getActiveRuns returns ActiveRun[] directly per lib/api.ts:456-467.
    let resolveFirst!: (v: { run_id: string; started_at: string }[]) => void
    let resolveSecond!: (v: { run_id: string; started_at: string }[]) => void
    mockGetActiveRuns
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirst = resolve
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveSecond = resolve
          }),
      )

    const { result } = renderProvider()

    // Fire two reconciles in the same act() tick. The SECOND must bail at
    // the top guard (in-flight bit is true synchronously after the first
    // call's `if (reconcileInFlightRef.current) return; reconcileInFlightRef.current = true`).
    await act(async () => {
      void result.current.reconcile("thread-A")
      void result.current.reconcile("thread-A")
    })

    // Only ONE getActiveRuns call should have fired — the second reconcile
    // bailed at the top guard.
    expect(mockGetActiveRuns).toHaveBeenCalledTimes(1)

    // Settle the first reconcile so the lock releases.
    await act(async () => {
      resolveFirst([])
      // Flush microtasks.
      await Promise.resolve()
    })

    // Now fire a third reconcile — call count should advance to 2.
    await act(async () => {
      void result.current.reconcile("thread-A")
      await Promise.resolve()
    })

    expect(mockGetActiveRuns).toHaveBeenCalledTimes(2)

    // Cleanup — resolve the second to avoid leaving pending promises.
    if (resolveSecond) resolveSecond([])
  })
})

// =============================================================================
// L-068-03 — sole writer (RUNTIME mid-await navigation test; static-analysis is
//            enforced by Plan 01 Task 3 external grep).
// =============================================================================
describe("Phase 068 — L-068-03 sole writer (mid-await navigation discards stale write)", () => {
  it("loadMessages's post-await guard discards a write to the previous thread when user navigated away", async () => {
    // Slow-resolving getMessages so we can fire setViewingThread mid-await.
    let resolveLoad!: (v: never[]) => void
    mockGetMessages.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveLoad = resolve
        }),
    )

    const { result } = renderProvider()

    // Begin loadMessages on Thread A.
    await act(async () => {
      result.current.setViewingThread("thread-A")
    })

    let loadPromise!: Promise<void>
    act(() => {
      loadPromise = result.current.loadMessages("thread-A")
    })

    // While the getMessages call is pending, the user navigates to Thread B.
    await act(async () => {
      result.current.setViewingThread("thread-B")
    })

    // Now resolve getMessages with a payload that would have populated Thread A.
    await act(async () => {
      resolveLoad([
        {
          id: "db-A-row",
          thread_id: "thread-A",
          user_id: "user-1",
          role: "assistant",
          content: "stale payload",
          created_at: "2026-05-09T10:00:00Z",
          updated_at: "2026-05-09T10:01:00Z",
        },
      ] as never[])
      await loadPromise
    })

    // Post-await guard should have caught the stale write: bucket A must be
    // empty (no write happened because activeThreadIdRef !== threadId).
    const bucketA = useStreamsStore.getState().bucketsBySurface.get("chat")?.get("thread-A") ?? []
    expect(bucketA).toEqual([])
  })
})

// =============================================================================
// L-068-05 — runId-match dedup. reconcile reuses an existing temp placeholder's
//            id (m.runId === run.run_id) as the assistantId — no second bubble.
// =============================================================================
describe("Phase 068 — L-068-05 runId-match dedup (reconcile reuses placeholder id)", () => {
  it("reconcile reuses existing placeholder id when runId matches; no second bubble inserted", async () => {
    // Pre-seed bucket with a placeholder that already carries runId='run-A'.
    // Use the `temp-existing` id (temp- prefix) so the MERGE 3-clause filter
    // in loadMessages preserves it across the reconcile-fire from setViewingThread.
    // (In production this row would either be a temp- placeholder from
    // sendMessage's optimistic insert, or a DB-persisted row returned by
    // getMessages — both survive the MERGE filter. An arbitrary non-temp id
    // would not, hence the temp- prefix here.)
    const existingPlaceholderId = "temp-existing"
    useStreamsStore.setState((s) => {
      const surfMap = new Map<string, import("@/types").Message[]>()
      surfMap.set("thread-A", [
        {
          id: existingPlaceholderId,
          thread_id: "thread-A",
          user_id: "",
          role: "assistant",
          content: "",
          created_at: "2026-05-09T10:00:00Z",
          updated_at: "2026-05-09T10:00:00Z",
          tool_calls: [],
          runId: "run-A",
          runStatus: "streaming",
        },
      ])
      const next = new Map(s.bucketsBySurface)
      next.set("chat", surfMap)
      return { bucketsBySurface: next }
    })

    // Persistent mocks so reconcile-fire-from-setViewingThread (Task 2c) and
    // the explicit reconcile both observe the same active-runs payload.
    mockGetMessages.mockResolvedValue([])
    mockGetActiveRuns.mockResolvedValue([
      { run_id: "run-A", started_at: "2026-05-09T10:00:00Z" },
    ])

    const recorder = makeSseRecorder()
    const { result } = renderProvider()

    await act(async () => {
      result.current.setViewingThread("thread-A")
    })

    await act(async () => {
      await result.current.reconcile("thread-A")
    })

    await waitFor(() => expect(mockSubscribeToRun).toHaveBeenCalled())

    // Bucket must still have exactly ONE assistant message (the existing
    // placeholder), NOT two (existing + a fresh `temp-run-A`).
    const bucket =
      useStreamsStore.getState().bucketsBySurface.get("chat")?.get("thread-A") ?? []
    const assistants = bucket.filter((m) => m.role === "assistant")
    expect(assistants).toHaveLength(1)
    expect(assistants[0].id).toBe(existingPlaceholderId)

    // Fire onDelta on the captured callbacks — it must target the existing
    // placeholder's id (via the closed-over assistantId), so the existing
    // placeholder's content updates.
    const cb = recorder.last() as StreamCallbacks
    act(() => {
      cb.onDelta("hello")
    })

    await waitFor(() => {
      const bucketAfter =
        useStreamsStore.getState().bucketsBySurface.get("chat")?.get("thread-A") ?? []
      const existing = bucketAfter.find((m) => m.id === existingPlaceholderId)
      expect(existing?.content).toBe("hello")
    })
  })
})

// =============================================================================
// L-068-06 — MERGE 3-clause filter. loadMessages preserves live in-flight temp
//            placeholders (`startsWith('temp-') && m.runId && !dbRunIds.has(m.runId)`)
//            while discarding temp placeholders already represented in the DB.
// =============================================================================
describe("Phase 068 — L-068-06 MERGE temp placeholders (3-clause filter)", () => {
  it("loadMessages keeps temp- placeholders whose runId is not in DB; drops temp- placeholders whose runId IS in DB", async () => {
    // Pre-seed bucket with TWO temp placeholders.
    useStreamsStore.setState((s) => {
      const surfMap = new Map<string, import("@/types").Message[]>()
      surfMap.set("thread-A", [
        {
          id: "temp-keep",
          thread_id: "thread-A",
          user_id: "",
          role: "assistant",
          content: "",
          created_at: "2026-05-09T10:00:00Z",
          updated_at: "2026-05-09T10:00:00Z",
          tool_calls: [],
          runId: "run-LIVE",
          runStatus: "streaming",
        },
        {
          id: "temp-drop",
          thread_id: "thread-A",
          user_id: "",
          role: "assistant",
          content: "",
          created_at: "2026-05-09T10:00:00Z",
          updated_at: "2026-05-09T10:00:00Z",
          tool_calls: [],
          runId: "run-DB",
          runStatus: "streaming",
        },
      ])
      const next = new Map(s.bucketsBySurface)
      next.set("chat", surfMap)
      return { bucketsBySurface: next }
    })

    // DB returns a row with runId='run-DB' — so 'temp-drop' should be filtered
    // out by the 3-clause filter; 'temp-keep' (runId='run-LIVE') survives.
    // Use mockResolvedValue (persistent) instead of mockResolvedValueOnce so
    // the reconcile-fire-on-setViewingThread (Task 2c) doesn't consume the
    // mock before the explicit loadMessages call lands.
    mockGetMessages.mockResolvedValue([
      {
        id: "db-row",
        thread_id: "thread-A",
        user_id: "user-1",
        role: "assistant",
        content: "from db",
        created_at: "2026-05-09T10:00:00Z",
        updated_at: "2026-05-09T10:01:00Z",
        runId: "run-DB",
        runStatus: "completed",
      },
    ])

    const { result } = renderProvider()

    await act(async () => {
      result.current.setViewingThread("thread-A")
    })

    await act(async () => {
      await result.current.loadMessages("thread-A")
    })

    const bucket =
      useStreamsStore.getState().bucketsBySurface.get("chat")?.get("thread-A") ?? []
    const ids = bucket.map((m) => m.id)
    expect(ids).toContain("db-row") // DB row landed
    expect(ids).toContain("temp-keep") // live in-flight placeholder preserved
    expect(ids).not.toContain("temp-drop") // DB caught up — placeholder dropped
  })
})

// =============================================================================
// setViewingThread reconcile-fire contract (producer side of Plan 3 pre-flight
// gate — iter-3 MED #4 resolution). Fires reconcile when threadId is non-null;
// no-op for null (D-068-08 listener-gate extended to programmatic path).
// =============================================================================
describe("Phase 068 — setViewingThread reconcile-fire contract (producer side of Plan 3 gate)", () => {
  it("setViewingThread on a non-null thread fires reconcile", async () => {
    mockGetActiveRuns.mockResolvedValueOnce([])
    const { result } = renderProvider()
    await act(async () => {
      result.current.setViewingThread("thread-A")
    })
    await waitFor(() => {
      expect(mockGetActiveRuns).toHaveBeenCalledWith("thread-A")
    })
  })

  it("setViewingThread(null) does NOT fire reconcile (D-068-08 gate extended to programmatic path)", async () => {
    const { result } = renderProvider()
    await act(async () => {
      result.current.setViewingThread(null)
    })
    // Flush any microtasks scheduled by the action (defensive — there should be none for null).
    await Promise.resolve()
    expect(mockGetActiveRuns).not.toHaveBeenCalled()
  })
})

// =============================================================================
// Phase 068 Plan 3 — listener migration canary (D-068-07 / D-068-08 / SC#1).
// Canary pattern (NOT RED-before-GREEN TDD): these four tests land GREEN
// against the Plan 1 + Plan 2 state BEFORE Task 2 deletes the ChatArea
// listener block. If Task 2 regresses anything, the canary trips RED.
//   1. Provider attaches all 3 listeners on mount (D-068-07 sole-owner gate).
//   2. Listeners no-op when activeThreadIdRef.current is null (D-068-08).
//   3. Listeners fire reconcile when activeThreadIdRef.current is set.
//   4. L-068-02 in-flight lock serializes rapid visibility+focus double-fire.
// =============================================================================
describe("Phase 068 — listener migration (D-068-07 / D-068-08 / SC#1)", () => {
  it("provider attaches visibilitychange / focus / pageshow listeners on mount", async () => {
    const docAddSpy = vi.spyOn(document, "addEventListener")
    const winAddSpy = vi.spyOn(window, "addEventListener")

    renderProvider()

    // useEffect runs after first commit; the spy captures the attach calls.
    const docEvents = docAddSpy.mock.calls.map((c) => c[0])
    const winEvents = winAddSpy.mock.calls.map((c) => c[0])

    expect(docEvents).toContain("visibilitychange")
    expect(winEvents).toContain("focus")
    expect(winEvents).toContain("pageshow")

    docAddSpy.mockRestore()
    winAddSpy.mockRestore()
  })

  it("listeners no-op when activeThreadIdRef.current is null (D-068-08 gate)", async () => {
    // Force visibility=visible so the visibilitychange handler's inner gate passes.
    const originalVisDescriptor = Object.getOwnPropertyDescriptor(
      Document.prototype,
      "visibilityState",
    )
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "visible",
    })

    try {
      renderProvider()
      // Do NOT call setViewingThread — activeThreadIdRef.current stays null.

      // Fire all three event types in the same tick.
      await act(async () => {
        document.dispatchEvent(new Event("visibilitychange"))
        window.dispatchEvent(new Event("focus"))
        window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true }))
        await Promise.resolve()
      })

      // D-068-08 gate: tryReconcile() short-circuits on null activeThreadIdRef
      // — getActiveRuns must NOT have been called.
      expect(mockGetActiveRuns).not.toHaveBeenCalled()
    } finally {
      if (originalVisDescriptor) {
        Object.defineProperty(document, "visibilityState", originalVisDescriptor)
      } else {
        // jsdom default — restore the prototype getter.
        Object.defineProperty(document, "visibilityState", {
          configurable: true,
          get: () => "visible",
        })
      }
    }
  })

  it("listeners fire reconcile when activeThreadIdRef.current is set (visibility entry point)", async () => {
    const originalVisDescriptor = Object.getOwnPropertyDescriptor(
      Document.prototype,
      "visibilityState",
    )
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "visible",
    })

    try {
      mockGetActiveRuns.mockResolvedValue([])

      const { result } = renderProvider()

      // setViewingThread itself fires reconcile #1 (Plan 2 Task 2c — producer
      // side of the Plan 3 pre-flight gate). Let it settle BEFORE we dispatch
      // visibilitychange so the L-068-02 in-flight lock is released; only then
      // can we attribute the second mockGetActiveRuns call to the listener path.
      await act(async () => {
        result.current.setViewingThread("thread-A")
      })
      await waitFor(() => {
        expect(mockGetActiveRuns).toHaveBeenCalledWith("thread-A")
      })

      mockGetActiveRuns.mockClear()

      // Now dispatch visibilitychange — listener must fire reconcile.
      await act(async () => {
        document.dispatchEvent(new Event("visibilitychange"))
        await Promise.resolve()
      })

      await waitFor(() => {
        expect(mockGetActiveRuns).toHaveBeenCalledWith("thread-A")
      })
    } finally {
      if (originalVisDescriptor) {
        Object.defineProperty(document, "visibilityState", originalVisDescriptor)
      } else {
        Object.defineProperty(document, "visibilityState", {
          configurable: true,
          get: () => "visible",
        })
      }
    }
  })

  it("L-068-02 lock serializes rapid visibility+focus double-fire (single getActiveRuns)", async () => {
    const originalVisDescriptor = Object.getOwnPropertyDescriptor(
      Document.prototype,
      "visibilityState",
    )
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "visible",
    })

    try {
      // Slow-resolving active-runs so the in-flight lock holds across both
      // event dispatches. getActiveRuns returns ActiveRun[] (see lib/api.ts:456-467).
      let resolveActiveRuns!: (v: { run_id: string; started_at: string }[]) => void
      mockGetActiveRuns.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveActiveRuns = resolve
          }),
      )

      const { result } = renderProvider()

      // setViewingThread fires reconcile #1 — this holds the lock (pending
      // getActiveRuns promise). Don't await its settle — we want the lock held.
      await act(async () => {
        result.current.setViewingThread("thread-A")
      })

      await waitFor(() => {
        expect(mockGetActiveRuns).toHaveBeenCalledTimes(1)
      })

      // Lock is held. Dispatch BOTH visibilitychange AND focus in the same
      // act() tick — both listener paths attempt reconcile and BOTH should
      // bail at the top guard `if (reconcileInFlightRef.current) return`.
      await act(async () => {
        document.dispatchEvent(new Event("visibilitychange"))
        window.dispatchEvent(new Event("focus"))
        await Promise.resolve()
      })

      // Still only the original setViewingThread-fired reconcile is in flight.
      expect(mockGetActiveRuns).toHaveBeenCalledTimes(1)

      // Release the lock — verifies the test's setup was actually serialized
      // (not just slow), and avoids leaving a hanging promise.
      await act(async () => {
        resolveActiveRuns([])
        await Promise.resolve()
      })
    } finally {
      if (originalVisDescriptor) {
        Object.defineProperty(document, "visibilityState", originalVisDescriptor)
      } else {
        Object.defineProperty(document, "visibilityState", {
          configurable: true,
          get: () => "visible",
        })
      }
    }
  })
})
