/**
 * Phase 194.1 Plan 01 (Wave 1) — THE TWO RESOLVERS AND THE KICKOFF PLACEHOLDER, TODAY.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THIS EXISTS AS ITS OWN WAVE
 * ─────────────────────────────────────────────────────────────────────────────
 * Plan 03 edits `stopThread`'s id resolution (R6) and deletes `sendMessage`'s
 * optimistic assistant placeholder (R5). Both are captured here BEFORE either
 * moves. A characterization baseline only proves something if it PREDATES the
 * change (the 188.1 lesson, re-proved in 193 and 193.1).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE SEQUENCING CONSTRAINT THIS SUITE MAKES VISIBLE (CONTEXT D-14)
 * ─────────────────────────────────────────────────────────────────────────────
 * `stopThread` resolves `runId` ONLY by scanning the chat bucket for a streaming
 * assistant message (`StreamsProvider.tsx:2411-2418`) — i.e. it reads EXACTLY
 * the placeholder R5 deletes. Shipping R5 before R6 would leave the harness Stop
 * with no run-id source at all, turning a partial silent no-op into a total one.
 * Case 1 and case 4 below are the two halves of that dependency, pinned so the
 * coupling is a measurement rather than a paragraph.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE ASSERTION RULE, INHERITED AND NOT NEGOTIABLE
 * ─────────────────────────────────────────────────────────────────────────────
 * Every cancel case asserts the **VALUE** handed to `cancelRun`, never
 * `expect(cancelRun).toHaveBeenCalled()` alone
 * (`ComposerStopHarness.test.tsx:16-19`). `api.ts::cancelRun` deliberately
 * swallows 404, and `WorkflowLock.runId` carries a `workflow_runs.id` on two of
 * its four write sites — so a Stop wired to the wrong id SILENTLY SUCCEEDS and a
 * call-counting test passes under the landmine.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * TWO MOCK KEYS THAT ARE LOAD-BEARING AND LOOK OPTIONAL
 * ─────────────────────────────────────────────────────────────────────────────
 *  - `getSnapshot`: since Phase 075 (D-075-02) `reconcile` reads the ATOMIC
 *    `getSnapshot`, not `getActiveRuns`. Leaving it unmocked makes the whole
 *    reconcile die inside its own `catch { console.error("reconcile failed:") }`
 *    — SILENTLY (`ComposerStopHarness.test.tsx:92-97` records measuring exactly
 *    that on its first run).
 *  - `getThreadWorkflow`: NOT exercised by any case here. It is in the bundle
 *    because plan 03 adds it, and a bundle that grows in the same commit as its
 *    first consumer is a bundle nobody re-derives.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * GATE SCOPE — measured
 * ─────────────────────────────────────────────────────────────────────────────
 * NOT executed by `scripts/vitest-count-gate.cjs`: `TARGETS` has one directory
 * entry (`src/components/workflows`) and no `src/__tests__` entry of any kind.
 * See `194.1-BASELINE.md` §2.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act, waitFor, cleanup } from "@testing-library/react"
import { createElement, type ReactNode } from "react"
import type { Message } from "@/types"

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
  mockGetThreadWorkflow: vi.fn(),
}))

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

import { ApiError } from "@/lib/api"
import { StreamsProvider, useStreamActions } from "@/providers/StreamsProvider"
import { useStreamsStore } from "@/stores/streamsStore"
import type { StreamCallbacks } from "@/lib/api"

const THREAD = "thread-baseline"
const PRODUCER_RUN_ID = "run-producer-0001"

function renderActions() {
  return renderHook(() => useStreamActions(), {
    wrapper: ({ children }: { children: ReactNode }) =>
      createElement(StreamsProvider, null, children),
  })
}

function assistant(over: Partial<Message>): Message {
  return {
    id: "m-" + Math.random().toString(36).slice(2),
    thread_id: THREAD,
    user_id: "",
    role: "assistant",
    content: "",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    tool_calls: [],
    ...over,
  } as Message
}

function seedBucket(threadId: string, messages: Message[]) {
  act(() => {
    useStreamsStore.setState((s) => {
      const surf = new Map(s.bucketsBySurface.get("chat") ?? new Map<string, Message[]>())
      surf.set(threadId, messages)
      const buckets = new Map(s.bucketsBySurface)
      buckets.set("chat", surf)
      return { bucketsBySurface: buckets }
    })
  })
}

function readBucket(threadId: string): Message[] {
  return useStreamsStore.getState().bucketsBySurface.get("chat")?.get(threadId) ?? []
}

/** A `postMessage` that NEVER resolves — the only way to observe the optimistic
 *  placeholder in its PRE-STAMP shape. Once the POST resolves, `:2031` stamps
 *  `runId` onto the very node under test, so a resolving mock would measure the
 *  post-stamp node and quietly claim it was the insert. */
function postMessageHangs() {
  mockPostMessage.mockImplementation(() => new Promise(() => {}))
}

function subscribeHangs() {
  mockSubscribeToRun.mockImplementation(
    async (_runId: string, _since: string, _cb: StreamCallbacks) => new Promise<void>(() => {}),
  )
}

let consoleErrorSpy: ReturnType<typeof vi.spyOn>
let consoleWarnSpy: ReturnType<typeof vi.spyOn>

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
    workflowLockByThread: new Map(),
  })
  mockGetMessages.mockResolvedValue([])
  mockGetActiveRuns.mockResolvedValue([])
  mockGetSnapshot.mockResolvedValue({ messages: [], active_runs: [], since_cursors: {} })
  mockCancelRun.mockResolvedValue(undefined)
  mockGetThreadWorkflow.mockResolvedValue({ definition_slug: null })
  subscribeHangs()
  // The network-failure arm logs through console.error by design; the pre-stamp
  // guard logs through console.warn. Silence both so a green run is quiet — and
  // KEEP the spies so the cases can assert ON them rather than around them.
  consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
  consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
})

afterEach(() => {
  consoleErrorSpy.mockRestore()
  consoleWarnSpy.mockRestore()
  cleanup()
})

// ─────────────────────────────────────────────────────────────────────────────
describe("194.1-01 case 1 — the bucket-scan resolution WORKS today", () => {
  it("stopThread hands cancelRun the producer run id off the streaming assistant row", async () => {
    const { result } = renderActions()
    seedBucket(THREAD, [
      // ⚠ `"completed"`, not `"done"`. The `Message.runStatus` union is
      // `"streaming" | "completed" | "failed" | "cancelled" | "timed_out"` — the
      // SSE terminal KIND is `"done"` (`onTerminal("done")`) and the persisted
      // STATUS is `"completed"`. Two different vocabularies for one moment, and
      // the first draft of this file used the wrong one; caught by `tsc -p
      // tsconfig.app.json`, which is also why the bare `--noEmit` form (checking
      // ZERO files in this repo) is not an acceptable substitute.
      assistant({ runStatus: "completed", runId: "run-OLD-must-not-win" }),
      assistant({ runStatus: "streaming", runId: PRODUCER_RUN_ID }),
    ])

    await act(async () => {
      await result.current.stopThread(THREAD)
    })

    // THE VALUE, never the call count.
    expect(mockCancelRun).toHaveBeenCalledTimes(1)
    expect(mockCancelRun).toHaveBeenCalledWith(PRODUCER_RUN_ID)
    // And it is the LAST streaming row that wins — the scan is `[...].reverse().find()`.
    expect(mockCancelRun).not.toHaveBeenCalledWith("run-OLD-must-not-win")
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe("194.1-01 case 2 — the silent no-op is REAL (the defect R6 repairs)", () => {
  /**
   * ⚠ THIS CASE PINS A DEFECT, ON PURPOSE. It is what makes plan 03's fix
   * OBSERVABLE: without a green "today it does nothing" here, the fix's own test
   * could not distinguish "R6 works" from "R6 was never needed".
   */
  it("an EMPTY bucket makes stopThread call cancelRun not at all", async () => {
    const { result } = renderActions()
    seedBucket(THREAD, [])

    await act(async () => {
      await result.current.stopThread(THREAD)
    })

    expect(mockCancelRun).not.toHaveBeenCalled()
  })

  it("a bucket with NO streaming assistant is equally silent", async () => {
    const { result } = renderActions()
    seedBucket(THREAD, [
      assistant({ runStatus: "completed", runId: "run-finished" }),
      assistant({ runStatus: "failed", runId: "run-broken" }),
    ])

    await act(async () => {
      await result.current.stopThread(THREAD)
    })

    expect(mockCancelRun).not.toHaveBeenCalled()
  })

  /**
   * The pre-stamp window (Phase 194-08 / T-194-08-01): a row that MATCHES the
   * scan but carries no id. `cancelRun` is still never called with a falsy id —
   * the guard is intact — but the only evidence is a console.warn. This is the
   * half of the defect Phase 194 already repaired, and it is pinned separately
   * from the total silence above so R6 cannot be credited with fixing it.
   */
  it("a streaming row with NO runId warns and cancels nothing", async () => {
    const { result } = renderActions()
    seedBucket(THREAD, [assistant({ runStatus: "streaming", runId: undefined })])

    await act(async () => {
      await result.current.stopThread(THREAD)
    })

    expect(mockCancelRun).not.toHaveBeenCalled()
    expect(consoleWarnSpy).toHaveBeenCalled()
    const warned = consoleWarnSpy.mock.calls.flat().join(" ")
    // ═════════════════════════════════════════════════════════════════════════
    // ⚠ SUPERSEDED BY PLAN 03 (R6) — 2026-08-16. The two original assertions are
    // quoted VERBATIM below rather than deleted, with their original comment, so
    // the BEFORE this file exists to record is still legible:
    //
    //     expect(warned).toContain("Stop did nothing: no run id yet for thread")
    //     // ⚠ The FALSE-CAUSE half of that string, pinned at its live site. This is
    //     // one of the exactly TWO occurrences in `frontend/src`
    //     // (`StreamsProvider.tsx:2394` and `:2457` — `194.1-BASELINE.md` §5), and
    //     // R6's `== 0` acceptance retires BOTH. Pinning it on the emitted VALUE
    //     // rather than on source is what makes this a behavioural before.
    //     expect(warned).toContain("press Stop again in a moment")
    //
    // THE PIN DID ITS JOB AND IS BEING HONOURED, NOT DISCARDED. It said R6's
    // acceptance retires both occurrences; plan 03 retired both, and the sweep in
    // `StreamsProvider.stopping.test.ts` now asserts ZERO across all of
    // `frontend/src`. The inversion below is what that retirement LOOKS like from
    // this file, and the assertion is flipped to `not` rather than removed — an
    // absent assertion could not tell a retirement from an oversight.
    //
    // The two properties this case actually pinned are UNWEAKENED and are
    // re-asserted above: the guard holds (zero cancels) and the no-op is VISIBLE.
    // ═════════════════════════════════════════════════════════════════════════
    expect(warned).toContain("Stop resolved no run id for thread")
    expect(warned).not.toContain("press Stop again in a moment")
    expect(warned).not.toMatch(/pre-stamp/i)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe("194.1-01 case 3 — `stopStream` is the BYTE-MIRROR (CONTEXT D-22)", () => {
  /**
   * ⚠ THE COMPOSER STOP REACHES *THIS* RESOLVER, NOT `stopThread`
   * (`ChatArea.tsx:361 onStop={stopStreaming}` →
   * `useMessages.ts:118 stopStreaming: actions.stopStream`). The SPEC's R6
   * acceptance — `grep -c "press Stop again in a moment" == 0` — is therefore
   * NOT satisfiable by editing `stopThread` alone. These cases are the reason
   * that is a measurement and not an opinion.
   *
   * The one behavioural difference from `stopThread`: the target thread comes
   * from `activeThreadIdRef` (SOLE WRITER `setViewingThread`, L-068-03), not an
   * argument. So the viewed thread must be set FIRST — and the seed must come
   * AFTER, because `setViewingThread` fires a reconcile that would otherwise
   * race the seed.
   */
  async function viewThread(
    result: { current: ReturnType<typeof useStreamActions> },
    threadId: string,
  ) {
    await act(async () => {
      result.current.setViewingThread(threadId)
    })
    await waitFor(() => expect(useStreamsStore.getState().viewedThreadId).toBe(threadId))
  }

  it("resolves the SAME id from the SAME scan as stopThread", async () => {
    const { result } = renderActions()
    await viewThread(result, THREAD)
    seedBucket(THREAD, [assistant({ runStatus: "streaming", runId: PRODUCER_RUN_ID })])

    await act(async () => {
      await result.current.stopStream()
    })

    expect(mockCancelRun).toHaveBeenCalledTimes(1)
    expect(mockCancelRun).toHaveBeenCalledWith(PRODUCER_RUN_ID)
  })

  it("is equally silent on an empty bucket — the same defect, the second site", async () => {
    const { result } = renderActions()
    await viewThread(result, THREAD)
    seedBucket(THREAD, [])

    await act(async () => {
      await result.current.stopStream()
    })

    expect(mockCancelRun).not.toHaveBeenCalled()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe("194.1-01 case 4 — the HARNESS kickoff placeholder [SUPERSEDED by plan 03 / R5]", () => {
  /**
   * ⚠ THE TITLE SAID "inserts an assistant placeholder today" AND THAT WAS TRUE
   * ON 2026-08-16 WHEN PLAN 01 WROTE IT. Plan 03 made it false, and the title is
   * amended rather than left to mislead — a describe block asserting a
   * present-tense fact goes stale exactly as a ledger row does.
   *
   * The original body, its reasoning and its `1` are quoted verbatim on the case
   * below. What the case measured is unchanged and still valuable: the node R5
   * deletes (`StreamsProvider.tsx:1925-1941`), captured in its PRE-STAMP shape via
   * a never-resolving `postMessage` — once the POST resolves, `:2031` stamps
   * `runId` onto that very node, and a resolving mock would have measured the
   * post-stamp row while calling it the insert.
   */
  /**
   * ═══════════════════════════════════════════════════════════════════════════
   * ⚠ SUPERSEDED BY PLAN 03 (R5) — 2026-08-16. THE WHOLE BODY IS INVERTED, and
   * the original is quoted VERBATIM here rather than deleted, because this case's
   * ONLY job was to be the BEFORE and a deleted before is not a before:
   *
   *     it("exactly ONE assistant row, runStatus streaming, runId undefined", async () => {
   *       postMessageHangs()
   *       const { result } = renderActions()
   *       act(() => {
   *         void result.current.sendMessage(THREAD, "run the quarterly close", {
   *           workflowDefinitionId: "wf-def-1",
   *         })
   *       })
   *       await waitFor(() => {
   *         expect(readBucket(THREAD).filter((m) => m.role === "assistant")).toHaveLength(1)
   *       })
   *       const assistants = readBucket(THREAD).filter((m) => m.role === "assistant")
   *       expect(assistants).toHaveLength(1)
   *       expect(assistants[0].runStatus).toBe("streaming")
   *       expect(assistants[0].runId).toBeUndefined()
   *       expect(assistants[0].content).toBe("")
   *       // The user bubble is a SEPARATE node and is NOT what R5 removes.
   *       expect(readBucket(THREAD).filter((m) => m.role === "user")).toHaveLength(1)
   *     })
   *
   * R5 deletes exactly that node, so `1` becomes `0`. The case's OTHER half —
   * "the user bubble is a SEPARATE node and is NOT what R5 removes" — was a
   * prediction, and it is kept as a live assertion below because it is now a
   * RESULT: the user bubble is still there, alone.
   * ═══════════════════════════════════════════════════════════════════════════
   */
  it("ZERO assistant rows — the node is gone; the user bubble is NOT", async () => {
    postMessageHangs()
    const { result } = renderActions()

    act(() => {
      void result.current.sendMessage(THREAD, "run the quarterly close", {
        workflowDefinitionId: "wf-def-1",
      })
    })

    await waitFor(() => {
      expect(readBucket(THREAD).filter((m) => m.role === "user")).toHaveLength(1)
    })

    expect(readBucket(THREAD).filter((m) => m.role === "assistant")).toHaveLength(0)
    // The prediction this case made about the user bubble, now a measurement.
    expect(readBucket(THREAD).filter((m) => m.role === "user")).toHaveLength(1)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe("194.1-01 case 5 — a DEEP send inserts the same placeholder", () => {
  /**
   * 174 D-14's byte-identity baseline. CONTEXT D-13 requires R5's gate to be
   * HARNESS-SCOPED — keyed on the signal `sendMessage` already receives — so
   * Deep never reaches the branch and its byte-identity holds BY CONSTRUCTION
   * rather than by test. This case is what will prove that claim: plan 03 must
   * leave it green, UNTOUCHED.
   */
  it("exactly ONE assistant row, runStatus streaming, runId undefined — no workflowDefinitionId", async () => {
    postMessageHangs()
    const { result } = renderActions()

    act(() => {
      void result.current.sendMessage(THREAD, "what did we ship last week?")
    })

    await waitFor(() => {
      expect(readBucket(THREAD).filter((m) => m.role === "assistant")).toHaveLength(1)
    })

    const assistants = readBucket(THREAD).filter((m) => m.role === "assistant")
    expect(assistants).toHaveLength(1)
    expect(assistants[0].runStatus).toBe("streaming")
    expect(assistants[0].runId).toBeUndefined()
    expect(assistants[0].content).toBe("")
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe("194.1-01 cases 6 & 7 — the two HONESTY ARMS that ride on the node R5 deletes", () => {
  /**
   * ⚠ CONTEXT D-23. These two arms are the reason R5 is not a one-line deletion.
   * Both write onto the placeholder BY ID (`m.id === assistantId`), so removing
   * the insert turns each `map` into a no-op over an absent node — and the
   * result is a NEW SILENCE in a phase whose subject is honesty.
   *
   * Plan 03 is REQUIRED to keep both green while deleting the node they ride on,
   * by INSERTING a notice-bearing node on these arms instead of mapping onto an
   * absent one. Each arm owes its own fence, driven RED by shipping the gate
   * without the repair.
   *
   * ⚠ Both are measured FIREABLE at base — see `194.1-BASELINE.md` §8. That was
   * not assumed: a case that cannot fire is worse than no case, and the plan
   * explicitly required this to be recorded either way.
   */
  it("case 6 — a 403 kill-switch REPLACES the placeholder's body with an amber blockedNotice", async () => {
    const MSG = "Workflows are currently disabled by the administrator"
    mockPostMessage.mockRejectedValue(new ApiError(MSG, 403))
    const { result } = renderActions()

    await act(async () => {
      await result.current.sendMessage(THREAD, "run it", { workflowDefinitionId: "wf-def-1" })
    })

    const blocked = readBucket(THREAD).filter(
      (m) => m.role === "assistant" && m.blockedNotice != null,
    )
    expect(blocked).toHaveLength(1)
    expect(blocked[0].blockedNotice?.message).toBe(MSG)
    // The user bubble SURVIVES on this arm — that is the 129-C amber divergence
    // from the 400/409 rollback shape, and it is pinned so a plan cannot quietly
    // convert this arm into a rollback while "keeping the notice".
    expect(readBucket(THREAD).filter((m) => m.role === "user")).toHaveLength(1)
  })

  it("case 7 — a network failure flips the placeholder to runStatus failed", async () => {
    mockPostMessage.mockRejectedValue(new Error("network down"))
    const { result } = renderActions()

    await act(async () => {
      await result.current.sendMessage(THREAD, "run it", { workflowDefinitionId: "wf-def-1" })
    })

    const assistants = readBucket(THREAD).filter((m) => m.role === "assistant")
    expect(assistants).toHaveLength(1)
    expect(assistants[0].runStatus).toBe("failed")
    expect(assistants[0].blockedNotice).toBeUndefined()
  })

  /**
   * The discriminator between 6 and 7, asserted so neither case can be credited
   * with the other's coverage. `blockedNotice` and `runStatus:"failed"` are
   * different fields written by different branches; a single node carrying both
   * would mean the branches had merged.
   */
  it("the two arms are DISTINGUISHABLE — neither node carries the other's mark", async () => {
    mockPostMessage.mockRejectedValue(new ApiError("blocked", 403))
    const a = renderActions()
    await act(async () => {
      await a.result.current.sendMessage(THREAD, "x", { workflowDefinitionId: "wf" })
    })
    const blockedNode = readBucket(THREAD).find((m) => m.role === "assistant")!
    expect(blockedNode.blockedNotice).toBeDefined()
    expect(blockedNode.runStatus).not.toBe("failed")
  })
})
