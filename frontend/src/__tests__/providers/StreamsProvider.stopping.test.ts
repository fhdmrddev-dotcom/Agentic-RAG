/**
 * Phase 194.1 Plan 03 — THE STOPPING SLICE, THE 8s CLIMB-DOWN, BOTH RESOLVERS,
 * THE KICKOFF GATE AND ITS TWO HONESTY REPAIRS.
 *
 * The AFTER to `StreamsProvider.stopping.baseline.test.ts`'s BEFORE. That suite
 * was captured by plan 01 on an UNMOVED tree and must stay green here except
 * where this plan legitimately INVERTS an assertion — and every inversion is
 * recorded in place, under a `SUPERSEDED` marker, never deleted.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE ASSERTION RULE, INHERITED AND NOT NEGOTIABLE
 * ─────────────────────────────────────────────────────────────────────────────
 * Every cancel case asserts the **VALUE** handed to `cancelRun`, never
 * `expect(cancelRun).toHaveBeenCalled()` alone
 * (`ComposerStopHarness.test.tsx:16-19`). `api.ts::cancelRun` deliberately
 * swallows 404 and `WorkflowLock.runId` carries two different id types across its
 * write sites, so a Stop wired to the wrong id SILENTLY SUCCEEDS and a
 * call-counting test passes under the landmine. Plant P5 below drives that.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠ THE L-01 BOUNDARY IS A STATEMENT, NEVER A FIX — AND IT IS FENCED
 * ─────────────────────────────────────────────────────────────────────────────
 * At the shipped `WORKER_COUNT=2`, roughly half of stops end with the run
 * reporting `completed`, because a producer on the other worker writes the
 * terminal over the cancel (`backend/app/db/workflows.py:1458-1463` — `finish_run`
 * has no terminal guard; Phase 194 SC#2, FAILED). With the stopping clear keyed on
 * the `streamingThreads` slice transition, the surface HONESTLY shows
 * `⊘ Stopping this run…` and then `✓ Complete`.
 *
 * **THAT IS CORRECT BEHAVIOUR FOR THIS PHASE.** No code here may special-case,
 * delay or suppress the terminal reading, and the fence in
 * `describe("… L-01 boundary")` reds against exactly that well-meaning change.
 * RUN-01 stays UNTICKED until the separate L-01 phase ships.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * TWO MOCK KEYS THAT ARE LOAD-BEARING AND LOOK OPTIONAL
 * ─────────────────────────────────────────────────────────────────────────────
 *  - `getSnapshot`: since Phase 075 (D-075-02) `reconcile` reads the ATOMIC
 *    `getSnapshot`, not `getActiveRuns`. Leaving it unmocked makes the whole
 *    reconcile die inside its own `catch { console.error("reconcile failed:") }`
 *    — SILENTLY (`ComposerStopHarness.test.tsx:92-97` records measuring that).
 *  - `getThreadWorkflow`: R6's frame fallback. Plan 01 put it in the bundle
 *    unused precisely so this plan would not have to grow the bundle in the same
 *    commit as its first consumer.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * GATE SCOPE — measured, not assumed
 * ─────────────────────────────────────────────────────────────────────────────
 * NOT executed by `scripts/vitest-count-gate.cjs`: `TARGETS` has one directory
 * entry (`src/components/workflows`) and no `src/__tests__` entry of any kind
 * (`194.1-BASELINE.md` §2). This plan does NOT add one — a gate-scope change is
 * not scoped here.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act, waitFor, cleanup } from "@testing-library/react"
import { createElement, type ReactNode } from "react"
import type { Message } from "@/types"

// ⚠ `?raw` IMPORTS, NOT `node:fs`. The first draft of this file read both sources
// with `readFileSync`/`resolve` and produced SIX typecheck errors under
// `tsc -p tsconfig.app.json` (`Cannot find module 'node:fs'`, `Cannot find name
// '__dirname'`, and implicit-any on the strip callbacks) — the app tsconfig
// carries no node types, on purpose. `?raw` is the shipped pattern in this tree
// (`ActiveRunsTray.test.tsx:104`, `StopControl.baseline.test.tsx:149`,
// `WorkspacePanel.test.tsx:30`) and it is also what the count gate's own
// `tsc` baseline was measured against.
import providerSource from "@/providers/StreamsProvider.tsx?raw"
import storeSource from "@/stores/streamsStore.ts?raw"

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

import { StreamsProvider, useStreamActions } from "@/providers/StreamsProvider"
import { useStreamsStore } from "@/stores/streamsStore"
import type { StreamCallbacks } from "@/lib/api"

const THREAD = "thread-stopping"
const PRODUCER_RUN_ID = "run-producer-0001"

/** ⚠ Mirrors `STOP_TIMEOUT_MS` in `StreamsProvider.tsx`. Deliberately re-declared
 *  rather than imported: the constant is module-private, and R2's acceptance is
 *  about the OBSERVED window, so a test that imported the value would agree with
 *  any value the source happened to hold — including 1 ms. Plant P1 (set the
 *  source to 3000) is what proves this pair is actually load-bearing. */
const STOP_WINDOW_MS = 8000

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

function seedStreaming(threadId: string) {
  act(() => {
    useStreamsStore.setState((s) => ({
      streamingThreads: new Set(s.streamingThreads).add(threadId),
    }))
  })
}

/** The ONLY honest way to simulate "the run reached a terminal": drop the thread
 *  from `streamingThreads`. Every one of the four shipped terminal routes ends in
 *  exactly this write, which is why the clear is keyed here and not on
 *  `onTerminal` (see the comment above the subscription in the provider). */
function leaveStreaming(threadId: string) {
  act(() => {
    useStreamsStore.setState((s) => {
      const next = new Set(s.streamingThreads)
      next.delete(threadId)
      return { streamingThreads: next }
    })
  })
}

const isStopping = (t: string) => useStreamsStore.getState().stoppingThreads.has(t)
const isNotConfirmed = (t: string) => useStreamsStore.getState().stopNotConfirmed.has(t)
const isKickoff = (t: string) => useStreamsStore.getState().harnessKickoffThreads.has(t)

/** A `cancelRun` that never settles — so the press can be observed in its own
 *  synchronous tick without the resolution racing the assertion. */
function cancelHangs() {
  mockCancelRun.mockImplementation(() => new Promise(() => {}))
}

/**
 * ⚠ LOAD-BEARING IN EVERY FAKE-TIMER CASE, and it was found by MEASURING rather
 * than by reading. `seedStreaming` writes `streamingThreads` DIRECTLY without
 * stamping `lastEventAtRef`, so the thread reads as immediately inactive to the
 * Phase 145-05 inactivity watchdog — whose shared ~5s interval then fires a
 * read-only `getSnapshot` probe, gets the default EMPTY `active_runs`, and
 * silently finalizes the thread at t+5000. Under fake timers that lands INSIDE
 * R2's 8s window and clears the stopping state for a reason that has nothing to
 * do with R2.
 *
 * The first draft of this suite hit exactly that: the t+7000 case read `false`.
 * Note the t+2000 case would have passed ANYWAY under the artifact — for the
 * wrong reason — which is the more dangerous half and the reason this helper is
 * applied to the whole describe rather than to the cases that visibly failed.
 */
function snapshotStillStreaming(runId: string) {
  mockGetSnapshot.mockResolvedValue({
    messages: [],
    active_runs: [{ run_id: runId, started_at: new Date().toISOString(), status: "streaming" }],
    since_cursors: { [runId]: "0" },
  })
}

function subscribeHangs() {
  mockSubscribeToRun.mockImplementation(
    async (_runId: string, _since: string, _cb: StreamCallbacks) => new Promise<void>(() => {}),
  )
}

/** A `postMessage` that NEVER resolves — the only way to observe the optimistic
 *  inserts in their PRE-STAMP shape (plan 01's recipe, inherited verbatim). */
function postMessageHangs() {
  mockPostMessage.mockImplementation(() => new Promise(() => {}))
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
    stoppingThreads: new Set<string>(),
    stopNotConfirmed: new Set<string>(),
    harnessKickoffThreads: new Set<string>(),
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
  consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
  consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
})

afterEach(() => {
  consoleErrorSpy.mockRestore()
  consoleWarnSpy.mockRestore()
  cleanup()
})

// ─────────────────────────────────────────────────────────────────────────────
// R1 — THE PRESS IS RECORDED IN THE SAME SYNCHRONOUS TICK
// ─────────────────────────────────────────────────────────────────────────────
describe("194.1-03 R1 — the press is synchronous, before any network work", () => {
  it("stopThread marks the thread stopping BEFORE its promise is awaited", async () => {
    cancelHangs()
    const { result } = renderActions()
    seedStreaming(THREAD)
    seedBucket(THREAD, [assistant({ runStatus: "streaming", runId: PRODUCER_RUN_ID })])

    // ⚠ Deliberately NOT awaited. The whole point of R1 is that the reading is on
    // before the first `await` yields — a press acknowledged one microtask later
    // is still a press acknowledged after the user has stopped looking.
    act(() => {
      void result.current.stopThread(THREAD)
    })

    expect(isStopping(THREAD)).toBe(true)
    expect(isNotConfirmed(THREAD)).toBe(false)
  })

  it("stopStream marks the VIEWED thread stopping in the same tick (the byte-mirror)", async () => {
    cancelHangs()
    const { result } = renderActions()
    await act(async () => {
      result.current.setViewingThread(THREAD)
    })
    await waitFor(() => expect(useStreamsStore.getState().viewedThreadId).toBe(THREAD))
    seedStreaming(THREAD)
    seedBucket(THREAD, [assistant({ runStatus: "streaming", runId: PRODUCER_RUN_ID })])

    act(() => {
      void result.current.stopStream()
    })

    expect(isStopping(THREAD)).toBe(true)
  })

  it("a falsy thread id records nothing — the early return is UNCHANGED", async () => {
    const { result } = renderActions()
    await act(async () => {
      await result.current.stopThread("")
    })
    expect(useStreamsStore.getState().stoppingThreads.size).toBe(0)
    expect(mockCancelRun).not.toHaveBeenCalled()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// R2 — THE 8s CLIMB-DOWN, ALL THREE POINTS
// ─────────────────────────────────────────────────────────────────────────────
describe("194.1-03 R2 — the climb-down is exactly 8s, measured at three points", () => {
  beforeEach(() => {
    // See `snapshotStillStreaming`'s docblock — without this the Phase 145-05
    // watchdog finalizes the seeded thread at t+5000 and every reading below
    // measures the watchdog instead of R2.
    snapshotStillStreaming(PRODUCER_RUN_ID)
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  /**
   * ⚠ ALL THREE POINTS ARE REQUIRED AND THE REASON IS MECHANICAL, not stylistic.
   * A suite asserting only "not-confirmed is on at t+8000" passes under a 1 ms
   * timeout, and would therefore also pass under plant P1 (STOP_TIMEOUT_MS set to
   * 3000). The t+7000 case is the one that fires under P1.
   */
  it("at t+7000 the reading is STILL stopping and not-confirmed is absent", async () => {
    cancelHangs()
    const { result } = renderActions()
    seedStreaming(THREAD)
    seedBucket(THREAD, [assistant({ runStatus: "streaming", runId: PRODUCER_RUN_ID })])

    act(() => {
      void result.current.stopThread(THREAD)
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(STOP_WINDOW_MS - 1000)
    })

    expect(isStopping(THREAD)).toBe(true)
    expect(isNotConfirmed(THREAD)).toBe(false)
  })

  it("at t+8000 it has climbed down — stopping off, not-confirmed on", async () => {
    cancelHangs()
    const { result } = renderActions()
    seedStreaming(THREAD)
    seedBucket(THREAD, [assistant({ runStatus: "streaming", runId: PRODUCER_RUN_ID })])

    act(() => {
      void result.current.stopThread(THREAD)
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(STOP_WINDOW_MS)
    })

    expect(isStopping(THREAD)).toBe(false)
    expect(isNotConfirmed(THREAD)).toBe(true)
  })

  /**
   * ⚠ THIS IS THE ONLY CASE THAT PROVES `clearTimeout` ACTUALLY RUNS (plant P2).
   * Clearing the flag on expiry without clearing the HANDLE leaves a timer that
   * fires at t+8000 over a thread that terminated at t+2000 — and raises
   * "not confirmed" about a stop that WAS confirmed. That is a new lie, in the
   * one phase whose subject is an honest Stop.
   */
  it("a cancel that terminates at t+2000 NEVER raises not-confirmed, even past t+8000", async () => {
    cancelHangs()
    const { result } = renderActions()
    seedStreaming(THREAD)
    seedBucket(THREAD, [assistant({ runStatus: "streaming", runId: PRODUCER_RUN_ID })])

    act(() => {
      void result.current.stopThread(THREAD)
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000)
    })
    expect(isStopping(THREAD)).toBe(true)

    leaveStreaming(THREAD)
    expect(isStopping(THREAD)).toBe(false)
    expect(isNotConfirmed(THREAD)).toBe(false)

    // Well past the window the ARMED timer would have fired at.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(STOP_WINDOW_MS + 2000)
    })
    expect(isNotConfirmed(THREAD)).toBe(false)
    expect(isStopping(THREAD)).toBe(false)
  })

  /**
   * A second press must not extend the window. If it re-armed, the reading would
   * survive to t+13000 and this case's t+8100 read would still say "stopping" —
   * i.e. a user who pressed twice would wait longer for the truth than one who
   * pressed once.
   */
  it("a second press while stopping does NOT re-arm the timer", async () => {
    cancelHangs()
    const { result } = renderActions()
    seedStreaming(THREAD)
    seedBucket(THREAD, [assistant({ runStatus: "streaming", runId: PRODUCER_RUN_ID })])

    act(() => {
      void result.current.stopThread(THREAD)
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000)
    })
    act(() => {
      void result.current.stopThread(THREAD)
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3100)
    })

    // t = 8100 from the FIRST press. Fired. (Re-armed, it would fire at 13000.)
    expect(isStopping(THREAD)).toBe(false)
    expect(isNotConfirmed(THREAD)).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// R1/R2 — THE ONE CLEAR THAT COVERS ALL FOUR `streamingThreads` DELETE ROUTES
// ─────────────────────────────────────────────────────────────────────────────
describe("194.1-03 — the clear is keyed on the SLICE TRANSITION, not on onTerminal", () => {
  /**
   * ⚠ PLANT P3 IS WHAT THIS CASE EXISTS FOR. `onTerminal` is wrapped twice
   * (`StreamsProvider.tsx` reconcile path and send path) and covers NEITHER the
   * reconcile-DERIVE delete NOR the inactivity-watchdog delete — the exact
   * missed-terminal cases Phase 145 exists to close. A clear keyed on `onTerminal`
   * passes every other case in this file and reds here.
   */
  it("reconcile-DERIVE clears the stopping state — a route onTerminal cannot see", async () => {
    cancelHangs()
    const { result } = renderActions()
    seedStreaming(THREAD)
    seedBucket(THREAD, [assistant({ runStatus: "streaming", runId: PRODUCER_RUN_ID })])

    act(() => {
      void result.current.stopThread(THREAD)
    })
    expect(isStopping(THREAD)).toBe(true)

    // The AUTHORITATIVE snapshot says nothing is streaming → the derive deletes
    // the thread from streamingThreads. No `onTerminal` fires anywhere.
    mockGetSnapshot.mockResolvedValue({ messages: [], active_runs: [], since_cursors: {} })
    await act(async () => {
      await result.current.reconcile(THREAD)
    })

    await waitFor(() => expect(useStreamsStore.getState().streamingThreads.has(THREAD)).toBe(false))
    expect(isStopping(THREAD)).toBe(false)
    expect(isNotConfirmed(THREAD)).toBe(false)
  })

  it("the not-confirmed reading is ALSO cleared when the thread later leaves streaming", async () => {
    snapshotStillStreaming(PRODUCER_RUN_ID)
    vi.useFakeTimers()
    try {
      cancelHangs()
      const { result } = renderActions()
      seedStreaming(THREAD)
      seedBucket(THREAD, [assistant({ runStatus: "streaming", runId: PRODUCER_RUN_ID })])

      act(() => {
        void result.current.stopThread(THREAD)
      })
      await act(async () => {
        await vi.advanceTimersByTimeAsync(STOP_WINDOW_MS)
      })
      expect(isNotConfirmed(THREAD)).toBe(true)

      leaveStreaming(THREAD)
      expect(isNotConfirmed(THREAD)).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// ⚠ THE L-01 BOUNDARY FENCE (plant P4)
// ─────────────────────────────────────────────────────────────────────────────
describe("194.1-03 — the L-01 boundary: the terminal reading is NOT suppressed", () => {
  /**
   * At `WORKER_COUNT=2` a producer on the OTHER worker writes `completed` over the
   * cancel (`backend/app/db/workflows.py:1458-1463`, no terminal guard — Phase 194
   * SC#2, FAILED). So after a Stop the surface will show `⊘ Stopping this run…`
   * and then `✓ Complete`, and **that is correct for this phase**.
   *
   * This case fences the well-meaning change in the direction someone would
   * actually make it: hiding or delaying the terminal reading because the thread
   * had been stopping. Plant P4 does exactly that and reds here.
   */
  it("stopping, then a `completed` terminal — BOTH readings occur, in order, unmasked", async () => {
    cancelHangs()
    const { result } = renderActions()
    seedStreaming(THREAD)
    seedBucket(THREAD, [assistant({ runStatus: "streaming", runId: PRODUCER_RUN_ID })])

    act(() => {
      void result.current.stopThread(THREAD)
    })
    // Reading 1 — the honest acknowledgement.
    expect(isStopping(THREAD)).toBe(true)

    // The other worker wins the race and writes `completed` over the cancel.
    act(() => {
      useStreamsStore.getState().actions.setMessagesForBucket("chat", THREAD, (prev) =>
        prev.map((m) => (m.runId === PRODUCER_RUN_ID ? { ...m, runStatus: "completed" } : m)),
      )
    })
    leaveStreaming(THREAD)

    // Reading 2 — NOT suppressed, NOT rewritten to "cancelled", NOT delayed.
    expect(isStopping(THREAD)).toBe(false)
    const row = readBucket(THREAD).find((m) => m.runId === PRODUCER_RUN_ID)
    expect(row?.runStatus).toBe("completed")
  })

  /**
   * The source half of the same fence. A suppression could also be implemented in
   * the render layer or by conditioning a status write on the stopping slice — so
   * the provider is swept for any line that reads `stoppingThreads` in the same
   * breath as a `runStatus`.
   *
   * ⚠ COMMENT-STRIPPED, and the prose mention asserted PRESENT afterwards. A raw
   * sweep reds on the paragraph documenting the rule (`194.1-BASELINE.md` §9
   * Trap 2; the `192-05` `title=` lesson), and a strip that hid a real absence
   * would be worse than no fence at all.
   */
  it("no runStatus write in the provider sits inside a stopping-slice condition", () => {
    const raw = providerSource
    const lines = raw.split("\n")
    expect(lines.length).toBeGreaterThan(1000) // the sweep is over a real file

    const code = lines.filter((l: string) => !/^\s*(\/\/|\*|\/\*)/.test(l))
    expect(code.length).toBeGreaterThan(500) // …and the strip did not eat it

    // ⚠ THE WINDOW IS LOAD-BEARING AND WAS FOUND BY DRIVING, NOT BY READING. The
    // first form of this fence asked whether ONE line named both the slice and
    // `runStatus` — and it stayed GREEN under plant P4, whose `if
    // (stoppingThreads.has(t))` and whose `runStatus` rewrite sit five lines
    // apart. A one-line fence cannot see the only shape this suppression would
    // ever actually take. (The behavioural case above DID fire under P4; this
    // arm was being credited with a reach it did not have — the 193.2 lesson.)
    const WINDOW = 8
    const offenders: string[] = []
    for (let i = 0; i < code.length; i++) {
      if (!/stoppingThreads|stopNotConfirmed/.test(code[i])) continue
      for (let j = i + 1; j <= Math.min(i + WINDOW, code.length - 1); j++) {
        if (/runStatus/.test(code[j])) offenders.push(`${code[i].trim()} … ${code[j].trim()}`)
      }
    }
    expect(offenders).toEqual([])

    // The strip cannot be hiding an absence: the rule IS documented in prose here.
    expect(raw).toContain("L-01")
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// THE STORE HOLDS NO TIMER HANDLE
// ─────────────────────────────────────────────────────────────────────────────
describe("194.1-03 — no timer handle lives in the Zustand store", () => {
  /**
   * `streamsStore.ts:22-27`'s own rule, mechanised. ⚠ The RAW form of this grep
   * returns **1** at this commit, and the single hit is the COMMENT stating the
   * rule — this plan's `<acceptance_criteria>` asked for a raw `0` and the raw
   * form is therefore not satisfiable without deleting the rule's own statement.
   * That is the recurring lesson of this repository landing again, and the
   * BASELINE's §9 Trap 2 is explicit that the FENCE is what is mis-scoped in this
   * situation, never the documentation. So: strip comments, assert 0 in CODE, and
   * assert the prose mention is PRESENT so the strip cannot cover for an absence.
   */
  it("zero timer calls in store CODE, with the rule still stated in store PROSE", () => {
    const raw = storeSource
    const lines = raw.split("\n")
    expect(lines.length).toBeGreaterThan(300)

    const code = lines.filter((l: string) => !/^\s*(\/\/|\*|\/\*)/.test(l))
    expect(code.length).toBeGreaterThan(100)
    expect(code.filter((l: string) => /setTimeout|setInterval|clearTimeout/.test(l))).toEqual([])

    expect(raw).toContain("NO TIMER HANDLE MAY EVER BE PUT HERE")
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// R6 — RESOLVE THE RUN ID WITHOUT THE CHAT BUCKET, ON BOTH RESOLVERS
// ─────────────────────────────────────────────────────────────────────────────
describe("194.1-03 R6 — the frame read is a FALLBACK, on both resolvers", () => {
  it("bucket populated → the BUCKET's producer id wins (Deep is unchanged)", async () => {
    const { result } = renderActions()
    seedBucket(THREAD, [
      assistant({ runStatus: "completed", runId: "run-OLD-must-not-win" }),
      assistant({ runStatus: "streaming", runId: PRODUCER_RUN_ID }),
    ])
    mockGetThreadWorkflow.mockResolvedValue({
      active_workflow_run_id: "wfr-should-not-be-used",
      last_workflow_run_id: "wfr-also-not",
    })

    await act(async () => {
      await result.current.stopThread(THREAD)
    })

    // ⚠ THE VALUE. Plant P5 (asserting only `toHaveBeenCalled()`) passes under a
    // wrong id because `cancelRun` swallows 404 — that is the whole reason this
    // rule exists (`ComposerStopHarness.test.tsx:16-19`).
    expect(mockCancelRun).toHaveBeenCalledTimes(1)
    expect(mockCancelRun).toHaveBeenCalledWith(PRODUCER_RUN_ID)
    // ⚠ Plant P6 (frame first) reds HERE: the frame must not be consulted at all
    // when the bucket answered, or every Deep stop changes id type.
    expect(mockGetThreadWorkflow).not.toHaveBeenCalled()
  })

  /**
   * ⚠ THIS IS THE ASSERTION plan 01's baseline case 2 pinned as a DEFECT.
   *
   * SUPERSEDED — `194.1-01`'s baseline reads, verbatim:
   *   `it("an EMPTY bucket makes stopThread call cancelRun not at all")`
   *   `expect(mockCancelRun).not.toHaveBeenCalled()`
   * That was TRUE and was pinned ON PURPOSE, so that this fix would be
   * distinguishable from "R6 was never needed". It is inverted here BECAUSE R6
   * ships, and the original is quoted rather than deleted.
   */
  it("bucket EMPTY + frame has an ACTIVE anchor → cancelRun gets THAT value", async () => {
    const { result } = renderActions()
    seedBucket(THREAD, [])
    mockGetThreadWorkflow.mockResolvedValue({
      active_workflow_run_id: "wfr-live-0001",
      last_workflow_run_id: "wfr-older-0000",
    })

    await act(async () => {
      await result.current.stopThread(THREAD)
    })

    expect(mockCancelRun).toHaveBeenCalledTimes(1)
    expect(mockCancelRun).toHaveBeenCalledWith("wfr-live-0001")
  })

  it("bucket EMPTY + anchor NULLed → cancelRun gets last_workflow_run_id", async () => {
    const { result } = renderActions()
    seedBucket(THREAD, [])
    mockGetThreadWorkflow.mockResolvedValue({
      active_workflow_run_id: null,
      last_workflow_run_id: "wfr-finished-0002",
    })

    await act(async () => {
      await result.current.stopThread(THREAD)
    })

    expect(mockCancelRun).toHaveBeenCalledTimes(1)
    expect(mockCancelRun).toHaveBeenCalledWith("wfr-finished-0002")
  })

  it("stopStream gets the SAME fallback — the two resolvers do not drift", async () => {
    const { result } = renderActions()
    await act(async () => {
      result.current.setViewingThread(THREAD)
    })
    await waitFor(() => expect(useStreamsStore.getState().viewedThreadId).toBe(THREAD))
    seedBucket(THREAD, [])
    mockGetThreadWorkflow.mockResolvedValue({
      active_workflow_run_id: "wfr-live-mirror",
      last_workflow_run_id: null,
    })

    await act(async () => {
      await result.current.stopStream()
    })

    expect(mockCancelRun).toHaveBeenCalledTimes(1)
    expect(mockCancelRun).toHaveBeenCalledWith("wfr-live-mirror")
  })

  it("bucket empty AND the frame names no run → nothing cancelled, and the state climbs down AT ONCE", async () => {
    const { result } = renderActions()
    seedStreaming(THREAD)
    seedBucket(THREAD, [])
    mockGetThreadWorkflow.mockResolvedValue({
      active_workflow_run_id: null,
      last_workflow_run_id: null,
    })

    await act(async () => {
      await result.current.stopThread(THREAD)
    })

    expect(mockCancelRun).not.toHaveBeenCalled()
    // A press that provably cancelled NOTHING must not sit showing
    // `⊘ Stopping this run…` for eight seconds.
    expect(isStopping(THREAD)).toBe(false)
    expect(isNotConfirmed(THREAD)).toBe(true)
  })

  it("a frame read that THROWS falls through to the no-id arm — it never escapes the click", async () => {
    const { result } = renderActions()
    seedStreaming(THREAD)
    seedBucket(THREAD, [])
    mockGetThreadWorkflow.mockRejectedValue(new Error("frame read exploded"))

    await act(async () => {
      await expect(result.current.stopThread(THREAD)).resolves.toBeUndefined()
    })

    expect(mockCancelRun).not.toHaveBeenCalled()
    expect(isNotConfirmed(THREAD)).toBe(true)
  })

  /**
   * ⚠ SUPERSEDED — `194.1-01`'s baseline case 2 third `it()` reads, verbatim:
   *   `expect(warned).toContain("press Stop again in a moment")`
   * pinned at its live site as one of exactly TWO occurrences in `frontend/src`
   * (`StreamsProvider.tsx:2394` and `:2457` — `194.1-BASELINE.md` §5). R6's
   * acceptance retires BOTH, so the assertion is inverted here and the original
   * is quoted rather than deleted.
   *
   * The replacement line must state ONLY what has been ESTABLISHED — that no run
   * id could be resolved from either source and that nothing was cancelled — and
   * must name the thread id and the condition and NOTHING ELSE (T-194.1-03-01,
   * inherited from T-194-08-04).
   */
  it("the console line claims no cause it has not established", async () => {
    const { result } = renderActions()
    seedBucket(THREAD, [])
    mockGetThreadWorkflow.mockResolvedValue({
      active_workflow_run_id: null,
      last_workflow_run_id: null,
    })

    await act(async () => {
      await result.current.stopThread(THREAD)
    })

    const warned = consoleWarnSpy.mock.calls.flat().join(" ")
    expect(warned).toContain(THREAD)
    expect(warned).not.toContain("press Stop again in a moment")
    expect(warned).not.toContain("pre-stamp")
    // …and it does say the two things it CAN say.
    expect(warned.toLowerCase()).toContain("no run id")
    expect(warned.toLowerCase()).toContain("nothing was cancelled")
    // T-194.1-03-01: no message content, no auth header, no run output.
    expect(warned).not.toContain("token")
    expect(warned).not.toContain("Authorization")
  })

  it("stoppedByUserRef is set ONLY on a path that actually issues a cancel", async () => {
    const { result } = renderActions()
    seedBucket(THREAD, [])
    mockGetThreadWorkflow.mockResolvedValue({
      active_workflow_run_id: null,
      last_workflow_run_id: null,
    })
    await act(async () => {
      await result.current.stopThread(THREAD)
    })
    expect(mockCancelRun).not.toHaveBeenCalled()

    // The observable consequence of the ref: a later send's `finally` stamps
    // `stopped: true` on its own assistant row. With nothing cancelled, nothing
    // may be marked stopped.
    postMessageHangs()
    act(() => {
      void result.current.sendMessage(THREAD, "hello")
    })
    await waitFor(() => {
      expect(readBucket(THREAD).filter((m) => m.role === "assistant")).toHaveLength(1)
    })
    expect(readBucket(THREAD).find((m) => m.role === "assistant")?.stopped).toBeUndefined()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// R6 — THE FALSE-CAUSE STRING, SWEPT OVER THE WHOLE OF `frontend/src`
// ─────────────────────────────────────────────────────────────────────────────
describe("194.1-03 R6 — the false-cause string is gone from BOTH resolvers", () => {
  /**
   * ⚠ PLANT P7 IS WHAT SCOPES THIS FENCE. The SPEC framed R6 as a `stopThread`
   * change, and the string exists TWICE — `:2394` inside `stopStream` and `:2457`
   * inside `stopThread` (CONTEXT D-22, measured in `194.1-BASELINE.md` §5). A
   * fence scoped to one function passes while the composer Stop — which reaches
   * `stopStream`, NOT `stopThread` — still lies. So the sweep is the whole tree.
   *
   * The swept file list is PRINTED AND ASSERTED NON-EMPTY before the count is
   * asserted zero. That is the 192.1 lesson: a sweep over an empty list reports
   * "0 occurrences" and passes green while defending nothing.
   */
  /**
   * ⚠ THE EXPLICIT 30s BUDGET IS NOT DECORATION. This case reads several hundred
   * modules through Vite's `?raw` transform; it was measured at **5007 ms** on one
   * run — i.e. it FAILED ON THE DEFAULT 5s TIMEOUT and PASSED on the next run of
   * the identical tree. A fence that reds on wall-clock rather than on the
   * property it defends teaches the next reader to ignore it.
   */
  it("zero occurrences across every .ts/.tsx under frontend/src", async () => {
    const NEEDLE = "press Stop again in a moment"
    const files = import.meta.glob("/src/**/*.{ts,tsx}", { query: "?raw", import: "default" })
    const paths = Object.keys(files)

    // The 192.1 fence-can-fire check, in BOTH directions.
    expect(paths.length).toBeGreaterThan(100)
    expect(paths.some((p) => p.includes("providers/StreamsProvider"))).toBe(true)

    // ⚠ THE ONE-LINE EXCLUSION, stated rather than implied: TEST FILES ARE
    // EXCLUDED, because three of them legitimately QUOTE the retired sentence in
    // order to assert its ABSENCE — this suite, plan 01's baseline (whose pin is
    // superseded in place), and `ComposerStopHarness.test.tsx`. Excluding them by
    // individual name rotted within one commit: adding
    // `expect(said).not.toContain(NEEDLE)` to a third file reddened this fence
    // for asserting exactly the property it defends.
    const isTest = (p: string) => p.includes("__tests__") || /\.test\.tsx?$/.test(p)
    const production = paths.filter((p) => !isTest(p))
    // …and the exclusion must not have eaten the surface under test.
    expect(production.length).toBeGreaterThan(100)
    expect(production.some((p) => p.includes("providers/StreamsProvider"))).toBe(true)

    const hits: string[] = []
    for (const p of production) {
      const src = (await files[p]()) as string
      if (src.includes(NEEDLE)) hits.push(p)
    }
    expect(hits).toEqual([])
  }, 30_000)
})

// ─────────────────────────────────────────────────────────────────────────────
// R5 — NO ASSISTANT NODE AT HARNESS KICKOFF; DEEP BYTE-IDENTICAL
// ─────────────────────────────────────────────────────────────────────────────
describe("194.1-03 R5 — a harness kickoff inserts ZERO assistant nodes", () => {
  /**
   * ⚠ SUPERSEDED — `194.1-01`'s baseline case 4 reads, verbatim:
   *   `it("exactly ONE assistant row, runStatus streaming, runId undefined")`
   *   `expect(assistants).toHaveLength(1)`
   * measured on the unmoved tree. R5 deletes exactly that node, so the assertion
   * is inverted here; the original is quoted rather than deleted, and plan 01's
   * file is updated in place under its own SUPERSEDED marker.
   *
   * ⚠ THE ACCEPTANCE COUNTS NODES, NOT VISIBILITY (plant P8). Hiding the node
   * with CSS satisfies "the user does not see a duplicate avatar" and does NOT
   * satisfy R5, whose acceptance is *zero assistant nodes in the transcript* —
   * a hidden node is still in the transcript, still in the bucket, and still the
   * thing every `m.id === assistantId` map writes onto.
   */
  it("ZERO assistant rows; the user bubble is untouched", async () => {
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
  })

  it("the thread is marked harness-live SYNCHRONOUSLY — before any promise resolves", async () => {
    postMessageHangs()
    const { result } = renderActions()

    act(() => {
      void result.current.sendMessage(THREAD, "run it", { workflowDefinitionId: "wf-def-1" })
    })

    // ⚠ No `waitFor`. R5's acceptance is "no interval showing a prompt with no run
    // instrument"; a fetch-driven liveness signal fails it by one kickoff RTT.
    expect(isKickoff(THREAD)).toBe(true)
  })

  /**
   * ⚠ PLANT P9. Gating on `agentMode` instead of `workflowDefinitionId` reds
   * HERE, because Deep sends carry an agentMode and no definition id. 174 D-14's
   * byte-identity holds BY CONSTRUCTION only while the gate keys on the signal
   * Deep never sets (`streamsStore.ts`: "Omitted on a Deep send (byte-identical)").
   */
  it("a DEEP send still inserts exactly ONE assistant node — and is NOT marked harness-live", async () => {
    postMessageHangs()
    const { result } = renderActions()

    act(() => {
      void result.current.sendMessage(THREAD, "what did we ship last week?", {
        agentMode: "explorer",
      })
    })

    await waitFor(() => {
      expect(readBucket(THREAD).filter((m) => m.role === "assistant")).toHaveLength(1)
    })
    const assistants = readBucket(THREAD).filter((m) => m.role === "assistant")
    expect(assistants[0].runStatus).toBe("streaming")
    expect(assistants[0].runId).toBeUndefined()
    expect(assistants[0].content).toBe("")
    expect(isKickoff(THREAD)).toBe(false)
  })

  it("the harness-live mark is cleared by the SAME slice-transition subscription", async () => {
    postMessageHangs()
    const { result } = renderActions()

    act(() => {
      void result.current.sendMessage(THREAD, "run it", { workflowDefinitionId: "wf-def-1" })
    })
    await waitFor(() => expect(useStreamsStore.getState().streamingThreads.has(THREAD)).toBe(true))
    expect(isKickoff(THREAD)).toBe(true)

    leaveStreaming(THREAD)
    expect(isKickoff(THREAD)).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// R5 — THE TWO HONESTY REPAIRS (CONTEXT D-23)
// ─────────────────────────────────────────────────────────────────────────────
describe("194.1-03 R5 — both honesty arms still reach the screen with no placeholder", () => {
  /**
   * ⚠ PLANT P10 IS THE SINGLE MOST IMPORTANT RED IN THIS PLAN: ship the kickoff
   * gate WITHOUT this repair and BOTH cases below go red — which is exactly what
   * `194.1-BASELINE.md` §8 measured on the unmoved tree, by planting the gate and
   * watching baseline cases 6 and 7 fail while case 5 (Deep) stayed green.
   *
   * The mechanism: both arms wrote onto the placeholder BY ID
   * (`m.id === assistantId`), so deleting the insert turns each `map` into a NO-OP
   * OVER AN ABSENT NODE. `workflow_kickoff.py:200` is raised on the harness path
   * and ONLY the harness path, so silencing it here silences it everywhere.
   */
  it("a 403 kill-switch still puts the administrator's message on screen", async () => {
    const { ApiError } = await import("@/lib/api")
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
    // The user bubble SURVIVES on this arm — the 129-C amber divergence from the
    // 400/409 rollback shape, pinned so a plan cannot quietly convert this arm
    // into a rollback while "keeping the notice".
    expect(readBucket(THREAD).filter((m) => m.role === "user")).toHaveLength(1)
  })

  it("a network failure still produces a visible failed reading — it is not silent", async () => {
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

  it("the two arms stay DISTINGUISHABLE — neither node carries the other's mark", async () => {
    const { ApiError } = await import("@/lib/api")
    mockPostMessage.mockRejectedValue(new ApiError("blocked", 403))
    const { result } = renderActions()
    await act(async () => {
      await result.current.sendMessage(THREAD, "x", { workflowDefinitionId: "wf" })
    })
    const node = readBucket(THREAD).find((m) => m.role === "assistant")!
    expect(node.blockedNotice).toBeDefined()
    expect(node.runStatus).not.toBe("failed")
  })

  it("DEEP's behaviour on both arms is unchanged", async () => {
    const { ApiError } = await import("@/lib/api")
    const MSG = "You are banned"
    mockPostMessage.mockRejectedValue(new ApiError(MSG, 403))
    const { result } = renderActions()

    await act(async () => {
      await result.current.sendMessage(THREAD, "hi")
    })

    // Deep inserted its placeholder, so the 403 arm MAPS onto it exactly as it
    // always did — one node, carrying the notice. The repair must not double it.
    const assistants = readBucket(THREAD).filter((m) => m.role === "assistant")
    expect(assistants).toHaveLength(1)
    expect(assistants[0].blockedNotice?.message).toBe(MSG)
  })

  it("the 409 lock-refusal arm is UNAFFECTED — both temps roll back, no node survives", async () => {
    const { ApiError } = await import("@/lib/api")
    mockPostMessage.mockRejectedValue(new ApiError("locked", 409))
    const { result } = renderActions()

    await act(async () => {
      await result.current.sendMessage(THREAD, "hi", { workflowDefinitionId: "wf-def-1" })
    })

    expect(readBucket(THREAD).filter((m) => m.role === "assistant")).toHaveLength(0)
    expect(readBucket(THREAD).filter((m) => m.role === "user")).toHaveLength(0)
    expect(useStreamsStore.getState().reconcileErrors.get(THREAD)).toBeDefined()
  })

  it("the generic ApiError rollback arm is UNAFFECTED — routes to reconcileErrors", async () => {
    const { ApiError } = await import("@/lib/api")
    mockPostMessage.mockRejectedValue(new ApiError("that skill is disabled", 400))
    const { result } = renderActions()

    await act(async () => {
      await result.current.sendMessage(THREAD, "hi", { workflowDefinitionId: "wf-def-1" })
    })

    expect(readBucket(THREAD).filter((m) => m.role === "assistant")).toHaveLength(0)
    expect(readBucket(THREAD).filter((m) => m.role === "user")).toHaveLength(0)
    expect(useStreamsStore.getState().reconcileErrors.get(THREAD)?.message).toBe(
      "that skill is disabled",
    )
    expect(useStreamsStore.getState().failedSendDrafts.get(THREAD)).toBe("hi")
  })
})
