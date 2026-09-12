/**
 * Phase 244 plan 15 (SHELL-03 / UAT gap G-8) — ONE ANSWER MUST SETTLE BOTH HOMES.
 *
 * DRIVEN IN A REAL BROWSER on two real workflow runs (`244-UAT.md` § R2-4). An approval
 * answered in the CHAT column left the PANEL still rendering "NEEDS YOU — No deadline — the
 * run is waiting for your answer and will not continue on its own" three minutes later, and
 * the reverse direction failed the same way. The run line kept reading `live` with a climbing
 * 1s clock and the composer stayed disabled on "Workflow running — Cancel to switch back",
 * on a run the server had already finished.
 *
 * Mechanically, three things, none of which is a server defect:
 *   1. `PendingAskCard.handleSubmit` flips COMPONENT-LOCAL `useState` to "answered". The
 *      sibling home is a different component instance with its own `useState`.
 *   2. The designed cross-home settle is the `ask_user_response` SSE → `removePendingAskForThread`.
 *      On the WORKFLOW path the client is not subscribed to that run's stream, so the SSE never
 *      lands and the SHARED STORE IS NEVER WRITTEN. `D-244-11`'s "one store slice → criterion 3
 *      becomes STRUCTURAL" is true OF THE STORE and false OF THE PATH THAT REACHES IT.
 *   3. Nothing re-reads `GET /threads/{id}/workflow` after an answer, so `workflowLockByThread`
 *      (and `harnessKickoffThreads`) keep a lock the server has already dropped.
 *
 * ⛔ WHAT THESE FENCES DO NOT PROVE, STATED FIRST RATHER THAN DISCOVERED LATER.
 * Every case in this file is a JSDOM MOUNT OVER A MOCKED API. They prove the settle path does
 * what it claims WHEN HANDED A WIRE SHAPE. They CANNOT prove the product hands it that shape,
 * and they CANNOT observe two sibling surfaces disagreeing after a real network round trip —
 * which is precisely the thing the operator saw. `244-03` shipped a green mount fence over this
 * exact blocker and the operator found it live nineteen plans later; `244-12` then shipped
 * fences proving the approval MOUNTS, and the half that broke was whether it ANSWERS.
 * The driven evidence is owed at `244-15-UAT-ROW.md`, which is UNRUN.
 *
 * ⛔ EVERY ASSERTION READS THE STORE (or a mocked API call record), NEVER A `console` SPY —
 * the `244-11` rule, for the same reason: a console call is not a user-visible state, and
 * treating it as one is what made this class of gap invisible for the life of the feature.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import {
  renderHook,
  render,
  screen,
  within,
  waitFor,
  act,
  cleanup,
} from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"

const {
  mockPostMessage,
  mockSubscribeToRun,
  mockGetMessages,
  mockGetActiveRuns,
  mockGetSnapshot,
  mockCancelRun,
  mockGetThreadWorkflow,
  mockGetThreadTodos,
  mockGetThreadWorkspaceFiles,
  mockGetThreadPendingAsks,
  mockGetThreadTasks,
  mockAnswerAskUser,
} = vi.hoisted(() => ({
  mockPostMessage: vi.fn(),
  mockSubscribeToRun: vi.fn(),
  mockGetMessages: vi.fn(),
  mockGetActiveRuns: vi.fn(),
  mockGetSnapshot: vi.fn(),
  mockCancelRun: vi.fn(),
  mockGetThreadWorkflow: vi.fn(),
  mockGetThreadTodos: vi.fn(),
  mockGetThreadWorkspaceFiles: vi.fn(),
  mockGetThreadPendingAsks: vi.fn(),
  mockGetThreadTasks: vi.fn(),
  mockAnswerAskUser: vi.fn(),
}))

/**
 * ⚠ AN ALLOW-LIST, AND THAT PROPERTY IS LOAD-BEARING — copied from
 * `streamsProvider_244_snapshot_failure.test.tsx`. A `vi.mock` factory REPLACES the module,
 * so an export omitted here THROWS rather than silently falling back to the real module and
 * issuing a real fetch. Keep it that way.
 */
vi.mock("@/lib/api", () => ({
  postMessage: mockPostMessage,
  subscribeToRun: mockSubscribeToRun,
  getMessages: mockGetMessages,
  getActiveRuns: mockGetActiveRuns,
  getSnapshot: mockGetSnapshot,
  cancelRun: mockCancelRun,
  getThreadWorkflow: mockGetThreadWorkflow,
  getThreadTodos: mockGetThreadTodos,
  getThreadWorkspaceFiles: mockGetThreadWorkspaceFiles,
  getThreadPendingAsks: mockGetThreadPendingAsks,
  getThreadTasks: mockGetThreadTasks,
  answerAskUser: mockAnswerAskUser,
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
import { useStreamsStore, type WorkflowLock } from "@/stores/streamsStore"
import { PendingAskStack, PendingAskCard } from "@/components/panel/PendingAskCard"
import type { StreamCallbacks } from "@/lib/api"
import type { PendingAsk } from "@/types"
import { stripComments } from "@/lib/stripComments.testutil"

const THREAD_ID = "thread-settle"

/** A lock shaped exactly like the two shipped mount-reconcile writers produce. */
const HARNESS_LOCK: WorkflowLock = {
  runId: "wr-1",
  mode: "harness",
  capPaused: false,
  continuesRemaining: 3,
}

const EMPTY_SNAPSHOT = {
  messages: [],
  active_runs: [],
  since_cursors: {},
}

/**
 * The fixture prompt, shaped like the real one the operator answered — two choices, a
 * `run_id` present (a prompt WITHOUT one gates `Send Answer` behind "Preparing…"), and no
 * `created_at` (the SSE path, so the card seeds a fresh countdown rather than rendering
 * expired on mount).
 */
const ASK: PendingAsk = {
  tool_call_id: "tc-1",
  prompt: "Approve this step?",
  options: ["Approve this step", "Do not run it"],
  timeout_seconds: 300,
  run_id: "run-producer-1",
}

function renderProvider() {
  return renderHook(() => useStreamActions(), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <StreamsProvider>{children}</StreamsProvider>
    ),
  })
}

/**
 * Drain the settle path's microtasks deterministically.
 *
 * ⚠ NOT `waitFor`. Three of these cases are NEGATIVE CONTROLS (nothing must change), and a
 * `waitFor` over a negative assertion passes on its FIRST tick — i.e. before the path it is
 * supposed to be observing has even run. Draining a fixed number of turns means the same
 * number of turns elapse in the positive and the negative cases, so a green negative is a
 * claim about a path that actually executed.
 */
async function drain() {
  await act(async () => {
    for (let i = 0; i < 6; i++) await Promise.resolve()
  })
}

/** Seed BOTH disjuncts of `useHarnessLiveForThread` — the lock AND the kickoff mark. */
function seedLiveThread(lock: WorkflowLock = HARNESS_LOCK) {
  useStreamsStore.setState({
    workflowLockByThread: new Map([[THREAD_ID, lock]]),
    harnessKickoffThreads: new Set([THREAD_ID]),
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
    workflowLockByThread: new Map(),
    harnessKickoffThreads: new Set<string>(),
    stoppingThreads: new Set<string>(),
    stopNotConfirmed: new Set<string>(),
    pendingAsksByThread: new Map(),
    phasesByThread: new Map(),
  })
  mockGetMessages.mockResolvedValue([])
  mockGetActiveRuns.mockResolvedValue([])
  mockGetSnapshot.mockResolvedValue(EMPTY_SNAPSHOT)
  mockCancelRun.mockResolvedValue(undefined)
  mockGetThreadTodos.mockResolvedValue([])
  mockGetThreadWorkspaceFiles.mockResolvedValue([])
  mockGetThreadPendingAsks.mockResolvedValue([])
  mockGetThreadTasks.mockResolvedValue([])
  mockAnswerAskUser.mockResolvedValue(undefined)
  mockGetThreadWorkflow.mockResolvedValue({
    locked: false,
    lock_is_stale: false,
    active_workflow_run_id: null,
    cap_paused: false,
    mode: "deep",
  })
  mockSubscribeToRun.mockImplementation(
    async (_runId: string, _since: string, _cb: StreamCallbacks, _signal?: AbortSignal) => {
      return new Promise<void>(() => {})
    },
  )
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe("244-15 / G-8 — the settle path RELEASES a lock the server has already dropped", () => {
  it("Test 1 (non-vacuity) — the action exists on the store's actions and is callable", async () => {
    const { result } = renderProvider()
    expect(typeof result.current.releaseSettledWorkflowLock).toBe("function")
    expect(
      typeof useStreamsStore.getState().actions.releaseSettledWorkflowLock,
      "the store's own actions object must carry it — `PendingAskStack` reaches it through " +
        "`useStreamsStore.getState().actions`, NOT through the provider hook",
    ).toBe("function")
    await act(async () => {
      result.current.releaseSettledWorkflowLock(THREAD_ID)
    })
    await drain()
  })

  it("Test 2 (RELEASE) — a dropped anchor clears BOTH disjuncts of useHarnessLiveForThread", async () => {
    /**
     * ⛔ BOTH, NOT ONE. `useHarnessLiveForThread` reads
     * `harnessKickoffThreads.has(tid) || workflowLockByThread.get(tid)?.mode === "harness"`.
     * Clearing only the lock leaves the run line reading `live` with its 1s `setInterval`
     * clock on a dead run — which is exactly half of what the operator saw. Seeding both and
     * asserting both is what makes this case a claim about the render.
     */
    const { result } = renderProvider()
    seedLiveThread()
    mockGetThreadWorkflow.mockResolvedValue({
      locked: false,
      lock_is_stale: false,
      active_workflow_run_id: null,
      cap_paused: false,
      mode: "deep",
    })

    await act(async () => {
      result.current.releaseSettledWorkflowLock(THREAD_ID)
    })
    await drain()

    expect(useStreamsStore.getState().workflowLockByThread.has(THREAD_ID)).toBe(false)
    expect(
      useStreamsStore.getState().harnessKickoffThreads.has(THREAD_ID),
      "the kickoff mark survived the settle — the run line stays `live` with a climbing clock " +
        "on a run the server has finished",
    ).toBe(false)
  })

  it("Test 3 (FAIL-CLOSED — a LIVE anchor releases NOTHING)", async () => {
    /**
     * ⛔ THE NEGATIVE CONTROL THAT MAKES THE REST SAFE — `T-244-15-01` / `T-244-03-01`.
     * Unlocking the composer during a live harness run is an ELEVATION: the person types
     * into a composer the server will 409. Identity (`toBe`) rather than shape (`toEqual`),
     * so a path that cleared and rewrote an equal lock still fails.
     */
    const { result } = renderProvider()
    seedLiveThread()
    const before = useStreamsStore.getState().workflowLockByThread.get(THREAD_ID)
    mockGetThreadWorkflow.mockResolvedValue({
      locked: true,
      lock_is_stale: false,
      active_workflow_run_id: "wr-1",
      cap_paused: false,
      mode: "harness",
    })

    await act(async () => {
      result.current.releaseSettledWorkflowLock(THREAD_ID)
    })
    await drain()

    expect(useStreamsStore.getState().workflowLockByThread.get(THREAD_ID)).toBe(before)
    expect(useStreamsStore.getState().harnessKickoffThreads.has(THREAD_ID)).toBe(true)
  })

  it("Test 4 (FAIL-CLOSED — a CAP-PAUSED lock is a lock the person still needs)", async () => {
    /**
     * The cheap direction is the default: a DEEP run paused at its iteration cap keeps the
     * composer locked so the person clicks Continue/Cancel instead of typing into a composer
     * the server will refuse. `244-08` shut this hole; the settle path must not re-open it.
     */
    const { result } = renderProvider()
    seedLiveThread()
    const before = useStreamsStore.getState().workflowLockByThread.get(THREAD_ID)
    mockGetThreadWorkflow.mockResolvedValue({
      locked: false,
      lock_is_stale: false,
      active_workflow_run_id: null,
      cap_paused: true,
      mode: "deep",
      continues_remaining: 2,
    })

    await act(async () => {
      result.current.releaseSettledWorkflowLock(THREAD_ID)
    })
    await drain()

    expect(useStreamsStore.getState().workflowLockByThread.get(THREAD_ID)).toBe(before)
    expect(useStreamsStore.getState().harnessKickoffThreads.has(THREAD_ID)).toBe(true)
  })

  it("Test 5 (a STALE anchor releases, exactly like Test 2 — the shipped F2 self-heal reading)", async () => {
    const { result } = renderProvider()
    seedLiveThread()
    mockGetThreadWorkflow.mockResolvedValue({
      locked: true,
      lock_is_stale: true,
      active_workflow_run_id: "wr-1",
      cap_paused: false,
      mode: "harness",
    })

    await act(async () => {
      result.current.releaseSettledWorkflowLock(THREAD_ID)
    })
    await drain()

    expect(useStreamsStore.getState().workflowLockByThread.has(THREAD_ID)).toBe(false)
    expect(useStreamsStore.getState().harnessKickoffThreads.has(THREAD_ID)).toBe(false)
  })

  it("Test 6 (a FAILED read changes NOTHING and does not propagate)", async () => {
    /**
     * The caller is a click handler inside a card with NO error boundary — `BUG-260529-03`
     * crashed the whole panel on a null `options`. A rejected background read must never
     * reach it, and must never guess at a state it could not read.
     */
    const { result } = renderProvider()
    seedLiveThread()
    const lockBefore = useStreamsStore.getState().workflowLockByThread
    const kickoffBefore = useStreamsStore.getState().harnessKickoffThreads
    mockGetThreadWorkflow.mockRejectedValue(new Error("Failed to fetch workflow (status 503)"))

    await act(async () => {
      expect(() => result.current.releaseSettledWorkflowLock(THREAD_ID)).not.toThrow()
    })
    await drain()

    expect(useStreamsStore.getState().workflowLockByThread).toBe(lockBefore)
    expect(useStreamsStore.getState().harnessKickoffThreads).toBe(kickoffBefore)
  })

  it("Test 7 (RE-ATTACH, not a poll) — a still-live run with a producer shell re-subscribes once", async () => {
    /**
     * ⭐ THIS IS WHY THE FAIL-CLOSED ARM IS NOT A DEAD END. When the server still reports the
     * run live, the settle re-attaches the live producer stream — the IDENTICAL arm the mount
     * reconcile already owns (`StreamsProvider.tsx:2440`, idempotent per its own docblock) —
     * so the SHIPPED terminal handler clears the lock when the run really ends. The plan
     * invents no second terminal path.
     */
    const { result } = renderProvider()

    // Put the thread in the LRU-3 stream pool: `subscribeProducerStream` is gated on
    // `isThreadInStreamPool`, which reads `activeThreadIdRef`. Its ONLY writer is
    // `setViewingThread`. The mount reconcile it fires reads the `beforeEach` deep shape
    // (no anchor, no producer), so it opens no stream of its own.
    await act(async () => {
      result.current.setViewingThread(THREAD_ID)
    })
    await drain()
    mockSubscribeToRun.mockClear()

    seedLiveThread()
    mockGetThreadWorkflow.mockResolvedValue({
      locked: true,
      lock_is_stale: false,
      active_workflow_run_id: "wr-1",
      latest_producer_run_id: "producer-9",
      cap_paused: false,
      mode: "harness",
    })

    await act(async () => {
      result.current.releaseSettledWorkflowLock(THREAD_ID)
    })
    await drain()

    expect(mockSubscribeToRun).toHaveBeenCalledTimes(1)
    expect(mockSubscribeToRun.mock.calls[0][0]).toBe("producer-9")
  })

  it("Test 8 (NO TIMER, and the release arm is the SHIPPED writer) — a raw sweep of the action body", async () => {
    /**
     * ⚠ `ThreadRunLine.tsx`'s D-11 rule binds here: "`WorkflowRunPage` already owns the
     * polling concern; a second poller in the chat transcript would be a second home for it."
     * The settle is fired by an explicit human answer and is bounded by the number of answers.
     *
     * ⚠ AND THE SECOND HALF IS THE MORE IMPORTANT ONE. The release must go through
     * `clearStopStateForThread` — the SHIPPED writer of `harnessKickoffThreads` — and NOT
     * through a hand-written `Set` delete. Two writers of one slice that differ is how slices
     * drift in this file, which `244-14`'s CR-01 already paid for once.
     *
     * ⚠ COMMENTS ARE STRIPPED FIRST: the action's own docblock names `setWorkflowLockForThread`
     * in order to forbid it, so an unstripped sweep would match prose and fail for the wrong
     * reason — the `244-12` failure this phase repaired one file over (IN-02).
     */
    const src = stripComments(
      ((await import("@/providers/StreamsProvider.tsx?raw")).default as string).replace(
        /\r\n/g,
        "\n",
      ),
    )
    expect(
      src.length,
      "the provider source parsed empty — this fence would pass vacuously",
    ).toBeGreaterThan(50000)

    const at = src.indexOf("releaseSettledWorkflowLock:")
    expect(
      at,
      "the settle action was not found in the provider source — this fence is pointing at " +
        "nothing and must be re-aimed rather than left silently matching zero",
    ).toBeGreaterThan(-1)

    // Brace-match the action body from its first `{` so the sweep cannot read a neighbour.
    const open = src.indexOf("{", at)
    let depth = 0
    let end = open
    for (let i = open; i < src.length; i++) {
      if (src[i] === "{") depth++
      else if (src[i] === "}") {
        depth--
        if (depth === 0) {
          end = i
          break
        }
      }
    }
    const body = src.slice(at, end + 1)
    expect(body.length, "the brace match collapsed — the body read empty").toBeGreaterThan(120)

    expect(body).not.toMatch(/setInterval|setTimeout/)
    expect(
      body,
      "the settle must not become a SEVENTH `setWorkflowLockForThread` derivation — it " +
        "RELEASES only (T-244-15-02). A call here re-opens G-1.",
    ).not.toMatch(/setWorkflowLockForThread/)
    expect(body).toMatch(/getThreadWorkflow\(/)
    expect(body).toMatch(/clearWorkflowLockForThread\(/)
    expect(
      body,
      "the release must go through the SHIPPED `harnessKickoffThreads` writer, never a " +
        "hand-rolled Set delete",
    ).toMatch(/clearStopStateForThread\(/)
    expect(body).toMatch(/refreshPhaseSpineAfterStop\(/)
  })
})

/**
 * ⭐ THE HALF THAT MATTERS: one answer, both homes.
 *
 * ⚠ AND THE SAME LIMIT APPLIES, restated where the cases are rather than only in the header.
 * Two `<PendingAskStack/>` instances under one provider in jsdom is a MODEL of two surfaces,
 * not two surfaces: they share a process, a store instance and a synchronous scheduler. The
 * real failure had a network round trip in the middle of it. A green run here says the
 * mechanism composes; it does not say the product does.
 */
describe("244-15 / G-8 — an answer in ONE home clears the other", () => {
  /** Mount the two homes over one thread — the panel's stack and the chat column's stack. */
  function renderTwoHomes() {
    useStreamsStore.setState({ viewedThreadId: THREAD_ID })
    mockGetThreadPendingAsks.mockResolvedValue([ASK])
    return render(
      <StreamsProvider>
        <div data-testid="home-a">
          <PendingAskStack />
        </div>
        <div data-testid="home-b">
          <PendingAskStack />
        </div>
      </StreamsProvider>,
    )
  }

  /** Answer inside one home: pick the SAFE choice, then Send Answer. */
  async function answerIn(home: "home-a" | "home-b") {
    const user = userEvent.setup()
    const scope = within(screen.getByTestId(home))
    // ⚠ "Do not run it" ON PURPOSE, mirroring the operator-safety rule the UAT row carries:
    // the fixture step is outward-facing and irreversible. It costs nothing here and keeps
    // the fence and the driven row describing the same click.
    await user.click(scope.getByRole("radio", { name: "Do not run it" }))
    await user.click(scope.getByRole("button", { name: "Send Answer" }))
  }

  it("Test 9 (THE DEFECT — chat → panel) — answering in home A clears home B", async () => {
    /**
     * ⚠ BEFORE THE WIRING THIS CASE IS RED ON THE SECOND HOME WHILE THE FIRST GOES GREEN,
     * and that asymmetry IS the measured defect reproduced in jsdom: `handleSubmit` flips
     * COMPONENT-LOCAL `useState` to "answered", so home A stops offering Send Answer and
     * home B — a different component instance with its own `useState` — never hears.
     */
    renderTwoHomes()
    await waitFor(() =>
      expect(screen.getAllByRole("button", { name: "Send Answer" })).toHaveLength(2),
    )

    // The server has accepted the answer; the next GET excludes it (`panel.py:190-205`
    // filters NOT EXISTS a matching `ask_user_response` row, and `runs.py` Step 2 persists
    // that row BEFORE the POST returns — there is no race on this half).
    mockGetThreadPendingAsks.mockResolvedValue([])
    await answerIn("home-a")

    await waitFor(() =>
      expect(
        within(screen.getByTestId("home-b")).queryByRole("button", { name: "Send Answer" }),
        "the sibling home still offers an answer to a prompt the server has already settled",
      ).toBeNull(),
    )
  })

  it("Test 10 (the reverse direction — panel → chat) — answering in home B clears home A", async () => {
    /**
     * ⛔ TWO CASES, NOT ONE. The UAT measured both directions separately and they failed for
     * one cause — but a fence over a single direction is passed by a fix that only works one
     * way, and nothing would say so.
     */
    renderTwoHomes()
    await waitFor(() =>
      expect(screen.getAllByRole("button", { name: "Send Answer" })).toHaveLength(2),
    )

    mockGetThreadPendingAsks.mockResolvedValue([])
    await answerIn("home-b")

    await waitFor(() =>
      expect(
        within(screen.getByTestId("home-a")).queryByRole("button", { name: "Send Answer" }),
        "the sibling home still offers an answer to a prompt the server has already settled",
      ).toBeNull(),
    )
  })

  it("Test 11 (a FAILED answer settles NOTHING) — a 500 leaves the card answerable", async () => {
    /**
     * The settle runs on SUCCESS only. An answer the server refused must leave the prompt in
     * the store and the card answerable — settling on a refusal would clear a prompt that is
     * still genuinely waiting, which is a worse lie than the one being fixed.
     */
    renderTwoHomes()
    await waitFor(() =>
      expect(screen.getAllByRole("button", { name: "Send Answer" })).toHaveLength(2),
    )

    const asksBefore = mockGetThreadPendingAsks.mock.calls.length
    const wfBefore = mockGetThreadWorkflow.mock.calls.length
    const { ApiError } = await import("@/lib/api")
    mockAnswerAskUser.mockRejectedValue(
      new ApiError("Failed to submit ask_user answer", 500),
    )

    await answerIn("home-a")

    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument())
    expect(mockGetThreadPendingAsks.mock.calls.length).toBe(asksBefore)
    expect(mockGetThreadWorkflow.mock.calls.length).toBe(wfBefore)
    expect(
      useStreamsStore.getState().pendingAsksByThread.get(THREAD_ID)?.length,
      "a refused answer removed the prompt — the person can no longer answer a run that is " +
        "still waiting",
    ).toBe(1)
  })

  it("Test 12 (the THIRD home is untouched) — a bare card with no onAnswered settles nothing", async () => {
    /**
     * ⛔ `WorkflowRunPage` mounts `PendingAskCard` DIRECTLY (`:1629`), not the stack, and its
     * home was measured CORRECT during the drive. The new callback is OPTIONAL and defaults
     * to absent, so that home is behaviourally byte-unchanged. Asserted BY CALL COUNT on the
     * mocked API rather than by render — a render assertion would pass for a card that fired
     * the settle and simply had not re-rendered yet.
     */
    const reconcileSpy = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<PendingAskCard ask={ASK} reconcile={reconcileSpy} />)

    await user.click(screen.getByRole("radio", { name: "Do not run it" }))
    await user.click(screen.getByRole("button", { name: "Send Answer" }))

    await waitFor(() => expect(mockAnswerAskUser).toHaveBeenCalledTimes(1))
    expect(reconcileSpy).not.toHaveBeenCalled()
    expect(mockGetThreadPendingAsks).not.toHaveBeenCalled()
    expect(mockGetThreadWorkflow).not.toHaveBeenCalled()
  })
})
