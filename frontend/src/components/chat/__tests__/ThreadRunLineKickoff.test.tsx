/**
 * Phase 194.1 Plan 06 Task 4 — R5's TWO HALVES, PROVED TOGETHER ON SCREEN.
 *
 * ═════════════════════════════════════════════════════════════════════════════
 * ⚠ WHY THIS IS A SEPARATE FILE, IN ONE LINE, BECAUSE THE PLAN REQUIRES ONE
 * ═════════════════════════════════════════════════════════════════════════════
 * These two cases need a REAL `StreamsProvider` in the tree to drive a real
 * `sendMessage`, and `src/__tests__/components/chat/MessageList.test.tsx` must
 * NOT gain one: its bare-`TooltipProvider` harness is the structural evidence
 * that R4's stopped receipt is persisted-derived rather than live-derived (174
 * D1), and `MessageList.runline.baseline.test.tsx` pins that harness on purpose.
 * A plan that quietly wrapped it in a provider to make a new case render would
 * destroy the only proof R4 has, and every suite would stay green.
 *
 * ═════════════════════════════════════════════════════════════════════════════
 * WHAT THESE CASES ADD OVER PLAN 03's
 * ═════════════════════════════════════════════════════════════════════════════
 * `StreamsProvider.stopping.test.ts` already proves the ZERO-ASSISTANT-NODE half
 * at STORE level, and it is not duplicated here. What is missing until now is
 * that the two facts hold **TOGETHER, in one rendered tree**: the transcript
 * carries a run instrument AND carries no assistant node, at the same moment.
 * That conjunction is what sketch 171-C's acceptance actually claims — *"so the
 * artefact cannot be drawn twice regardless of which of the three candidate
 * mechanisms in `194-MEASUREMENTS.md` is live"* — and either fact alone is
 * consistent with a broken product:
 *
 *   · zero assistant nodes ALONE is the dead air C was refuted for;
 *   · a run instrument ALONE says nothing about the duplicate avatar.
 *
 * ═════════════════════════════════════════════════════════════════════════════
 * ⚠ THE BOUNDARY, CARRIED FORWARD RATHER THAN LEFT TO BE REDISCOVERED
 * ═════════════════════════════════════════════════════════════════════════════
 * From sketch 171's own *"NOT guaranteed"* row: **R5 does not repair the
 * double-mount race.** It removes the SURFACE the duplicate artefact was drawn
 * on at kickoff. If the same race later reaches a CONTENT-BEARING message the
 * artefact returns, and nothing in this file would have prevented it. The
 * measurement trigger in `194-MEASUREMENTS.md` is still undischarged: a
 * qualifying store dump would say which mechanism is live, which is the
 * difference between *"cannot render twice HERE"* and *"cannot render twice"*.
 */
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest"
import { render, screen, act, waitFor, cleanup } from "@testing-library/react"
import type { ReactNode } from "react"
import { TooltipProvider } from "@/components/ui/tooltip"
import type { Message, Phase } from "@/types"

// ── The mocked API bundle. Shape ported from `ComposerStopHarness.test.tsx:78-122`,
//    which itself ports it from `streamsProvider.test.tsx:33-62`. ──────────────
//
// ⚠ `getSnapshot` and `getThreadWorkflow` are both load-bearing and neither is
// obvious. `reconcile` reads the ATOMIC `getSnapshot` (D-075-02), so leaving it
// unmocked kills the whole reconcile inside its own catch — silently. And since
// plan 03's R6, the stop resolvers fall back to `GET /threads/{id}/workflow`,
// which after R5 is the NORMAL state during a harness run; unmocked, the real
// implementation runs `fetch` in jsdom and the failure is swallowed by a
// try/catch, so a case fails for a reason unrelated to what it tests. Both were
// measured doing exactly that in the suite this bundle comes from.
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
    ...actual,
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
import { MessageList } from "../MessageList"

const THREAD = "thread-H"
const EMPTY: Message[] = []

/** Captured so a case can drive a real `sendMessage` from outside the tree. */
let actions: ReturnType<typeof useStreamActions> | null = null

/**
 * The transcript exactly as the product mounts it: `MessageList` fed from the
 * SAME store slices `ChatArea` feeds it from, with the SAME `threadId` prop.
 * Nothing here is a stand-in for the component under test.
 */
function Transcript() {
  actions = useStreamActions()
  const messages = useStreamsStore(
    (s) => s.bucketsBySurface.get("chat")?.get(THREAD) ?? EMPTY,
  )
  const isStreaming = useStreamsStore((s) => s.streamingThreads.has(THREAD))
  return <MessageList messages={messages} isStreaming={isStreaming} threadId={THREAD} />
}

function renderTranscript(): ReturnType<typeof render> {
  return render(
    <StreamsProvider>
      <TooltipProvider>
        <Transcript />
      </TooltipProvider>
    </StreamsProvider> as ReactNode,
  )
}

// jsdom lacks `scrollIntoView`; `MessageList`'s auto-scroll effect calls it inside
// a passive effect and would otherwise throw before any assertion runs. Same stub
// `MessageList.test.tsx:37-41` uses, for the same reason.
beforeAll(() => {
  if (!HTMLElement.prototype.scrollIntoView) {
    HTMLElement.prototype.scrollIntoView = function () {}
  }
})

beforeEach(() => {
  vi.clearAllMocks()
  actions = null
  useStreamsStore.setState({
    bucketsBySurface: new Map(),
    streamingThreads: new Set(),
    harnessKickoffThreads: new Set(),
    workflowLockByThread: new Map(),
    phasesByThread: new Map(),
  })
  mockGetMessages.mockResolvedValue([])
  mockGetActiveRuns.mockResolvedValue({ active_runs: [] })
  mockGetSnapshot.mockResolvedValue({ messages: [], active_runs: [] })
  // ⚠ The frame read NEVER RESOLVES on purpose. Both cases below assert what is
  // on screen BEFORE any fetch settles; a mock that resolved would let a green
  // read past a component that only rendered after the round trip — the exact
  // interval R5's acceptance forbids.
  mockGetThreadWorkflow.mockReturnValue(new Promise(() => {}))
  // Ditto for the SEND: a never-resolving POST guarantees NO delta, NO terminal
  // and NO reconcile can arrive between the send and the assertion.
  mockPostMessage.mockReturnValue(new Promise(() => {}))
  mockSubscribeToRun.mockImplementation(async () => new Promise<void>(() => {}))
})

afterEach(() => {
  cleanup()
  useStreamsStore.setState({
    bucketsBySurface: new Map(),
    streamingThreads: new Set(),
    harnessKickoffThreads: new Set(),
  })
})

describe("194.1-06 — R5: a harness kickoff carries an instrument and NO assistant node", () => {
  it("zero assistant nodes AND the run line, in ONE tree", async () => {
    renderTranscript()
    await waitFor(() => expect(actions).not.toBeNull())

    await act(async () => {
      void actions!.sendMessage(THREAD, "run the quarterly close", {
        workflowDefinitionId: "wf-def-1",
      })
    })

    // The prompt IS on screen — so the absence below is an absence in a RENDERED
    // transcript, not the absence of a render. Without this the assistant-node
    // assertion would pass over an empty container.
    expect(screen.getByTestId("user-message")).toBeInTheDocument()

    // Half one: nothing for a double mount to duplicate.
    expect(screen.queryAllByTestId("assistant-message")).toHaveLength(0)

    // Half two: and the transcript is NOT silent about it.
    const line = screen.getByTestId("thread-run-line")
    expect(line).toHaveAttribute("data-run-line-state", "live")
    expect(screen.getByTestId("thread-run-line-word")).toHaveTextContent(
      "Starting workflow…",
    )
  })

  it("a DEEP send still inserts its assistant node — the gate is harness-scoped", async () => {
    // ⚠ THE POSITIVE CONTROL, and it is not optional. Without it "zero assistant
    // nodes" is equally consistent with a transcript that renders no assistant
    // node for ANY send — i.e. with the feature being broken rather than gated.
    // 174 D-14's Deep byte-identity is what this protects.
    renderTranscript()
    await waitFor(() => expect(actions).not.toBeNull())

    await act(async () => {
      void actions!.sendMessage(THREAD, "just chat with me")
    })

    expect(screen.queryAllByTestId("assistant-message")).toHaveLength(1)
    // …and no live run line, because a Deep send stamps no kickoff mark.
    expect(screen.queryByTestId("thread-run-line")).toBeNull()
  })
})

describe("194.1-06 — R5: there is NO dead interval between the prompt and the instrument", () => {
  it("the line is present at the first frame after the send, before any delta", async () => {
    renderTranscript()
    await waitFor(() => expect(actions).not.toBeNull())

    // ⚠ ASSERTED WITHOUT ADVANCING TIMERS AND WITHOUT FLUSHING THE FETCH. Every
    // mock that could settle is a never-resolving promise (see `beforeEach`), so
    // at this point:
    //   · `postMessage` has NOT returned → no `run_id`, no lock seed, no delta;
    //   · `getThreadWorkflow` has NOT returned → the line has no frame at all;
    //   · `subscribeToRun` has NOT been reached → no SSE callback exists.
    // The ONLY thing that can make the line render is the SYNCHRONOUS kickoff
    // mark stamped in the same tick as the user-message insert
    // (`StreamsProvider.tsx:2160-2162`). If the line were mounted on the first
    // delta, or on a resolved fetch, this case reds — and P10 proved it does.
    await act(async () => {
      void actions!.sendMessage(THREAD, "run the quarterly close", {
        workflowDefinitionId: "wf-def-1",
      })
    })

    expect(mockSubscribeToRun).not.toHaveBeenCalled()
    expect(screen.getByTestId("thread-run-line")).toBeInTheDocument()

    // …and it is honest about what it does not yet know: with no frame and no
    // phase rows, the step and duration segments are ABSENT rather than invented.
    expect(screen.queryByTestId("thread-run-line-steps")).toBeNull()
    expect(screen.queryByTestId("thread-run-line-elapsed")).toBeNull()
  })

  it("the instrument is a SIBLING of the jump-to-live chip, which is not showing", async () => {
    // D-17, asserted on screen rather than by reading the diff: the floating chip
    // is gated on `showJumpToLive = !isPinned && isStreaming`, so at kickoff — while
    // pinned — it is correctly absent. The run line is present anyway. That is the
    // whole reason 171-C's "the never-vanishes strip covers the gap" was refuted.
    renderTranscript()
    await waitFor(() => expect(actions).not.toBeNull())

    await act(async () => {
      void actions!.sendMessage(THREAD, "run the quarterly close", {
        workflowDefinitionId: "wf-def-1",
      })
    })

    expect(screen.queryByTestId("jump-to-live-chip")).toBeNull()
    expect(screen.getByTestId("thread-run-line")).toBeInTheDocument()
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// Phase 244-13 (UAT gap G-1) — D1..D4: THE LOCK MUST SAY WHAT IT IS
// ═════════════════════════════════════════════════════════════════════════════
//
// ⛔ THE DEFECT. Driven in a browser 2026-09-12 while running UAT row L-2. On a DEEP
// (General-mode) thread whose latest run is `cap_paused`, the transcript renders a LIVE
// harness run receipt that contradicts the amber card 41px above it. Both on screen in ONE
// `getBoundingClientRect` pass:
//
//     amber card, top=272px:  "Reached the Continue limit — this run is stopped. Start a
//                              new message to keep going."
//     run line,   top=313px:  "⟡ Starting workflow…"   data-run-line-state="live"
//
// There is no workflow. The thread has never had one. The line also runs a 1s
// `setInterval` clock (`ThreadRunLine.tsx:243-249`) for a run that is stopped.
//
// ⛔ CAUSE, MEASURED. `244-03` made the server populate the thread lock for a cap-paused
// DEEP run (`threads.py:1237-1276`) — the lock used to be harness-only. But
// `useHarnessLiveForThread` (`StreamsProvider.tsx:4598-4602`) still read PRESENCE:
//
//     s.harnessKickoffThreads.has(threadId) || s.workflowLockByThread.has(threadId)
//
// i.e. it treated ANY non-null lock as "a harness run is live". A 244-03 SERVER change
// reached a CLIENT consumer written against the old invariant.
//
// ⛔ WHY NO FENCE CAUGHT IT, verbatim from the gap's `why_no_fence_caught_it`: *"Both the
// ThreadRunLine and MessageItem suites construct their harness state directly, so no test
// ever asks 'what does a DEEP thread with a cap_paused lock render?' The invariant that
// broke lived in a COMMENT, not in an assertion."* These four cases are that comment moved
// into an assertion.
//
// ⛔ THE LOCK IS NEVER HAND-SEEDED HERE. Every case below drives `setViewingThread`, which is
// the product's SOLE writer of `activeThreadIdRef` and fires the real `reconcile` — so the
// lock is produced by `getThreadWorkflow`'s answer travelling through the real branch at
// `StreamsProvider.tsx:2355-2372`. Seeding the store directly would fence the selector and
// leave the branch that actually mislabels a Deep pause `"harness"` untested — which is the
// mistake the gap names. (⚠ 244-12 found one of its own fences passing for the wrong reason;
// this file's answer is to drive the writer, not to construct the shape.)
//
// ⛔ ASSERTIONS ARE ON RENDERED CONTENT, not on `data-testid` presence alone — *"presence
// assertions cannot see content drift"* (Phase 235's lesson, re-recorded by 244-11 for this
// exact surface).

/** The server frame for a DEEP run paused at its iteration cap — `mode: "deep"`, NOT locked,
 *  `cap_paused: true`, with only a producer run id. This is the shape `threads.py` answers
 *  for the thread UAT row L-2 drove, and it is the shape the reconcile branch at
 *  `StreamsProvider.tsx:2355` consumes. */
const DEEP_CAP_PAUSED_FRAME = {
  thread_id: THREAD,
  mode: "deep" as const,
  locked: false,
  active_workflow_run_id: null,
  run_status: null,
  definition_slug: null,
  definition_name: null,
  current_phase_slug: null,
  current_phase_index: null,
  total_phases: null,
  lock_is_stale: false,
  cap_paused: true,
  continues_used: 3,
  continues_remaining: 0,
  latest_producer_run_id: "run-deep-capped",
  last_run_status: "cap_paused",
  last_run_created_at: "2026-09-12T06:00:00Z",
  last_run_updated_at: "2026-09-12T06:04:00Z",
  phases: null,
}

/** The server frame for a GENUINE, live harness run. ⚠ `latest_producer_run_id` is null on
 *  purpose: a non-null value makes the reconcile branch re-subscribe a producer stream, which
 *  is a second behaviour these cases are not about. */
const HARNESS_LIVE_FRAME = {
  ...DEEP_CAP_PAUSED_FRAME,
  mode: "harness" as const,
  locked: true,
  active_workflow_run_id: "wr-live-1",
  run_status: "running",
  cap_paused: false,
  continues_used: 0,
  continues_remaining: 3,
  latest_producer_run_id: null,
  last_run_status: "running",
}

/** The server frame for an ordinary DEEP thread with no lock at all — the `else` arm. */
const DEEP_UNLOCKED_FRAME = {
  ...DEEP_CAP_PAUSED_FRAME,
  cap_paused: false,
  continues_used: 0,
  continues_remaining: 3,
  latest_producer_run_id: null,
  last_run_status: null,
}

/** Drive the PRODUCT's writer: `setViewingThread` → `reconcile` → the workflow-lock branch.
 *  Resolves when a lock has actually landed, so nothing below can pass on a thread that was
 *  never locked at all. */
async function driveLockFromServer(frame: unknown): Promise<void> {
  // ⚠ `since_cursors` IS LOAD-BEARING and its absence is silent. The shipped `beforeEach`
  // mock omits it, which was harmless while no case drove a reconcile — `reconcile` does
  // `Object.entries(snapshot.since_cursors)` (`StreamsProvider.tsx:2047`) and dies inside its
  // own catch with `TypeError: Cannot convert undefined or null to object`, so the workflow
  // block below it never runs and NO lock ever lands. Measured while driving D1-D4 RED.
  mockGetSnapshot.mockResolvedValue({ messages: [], active_runs: [], since_cursors: {} })
  mockGetThreadWorkflow.mockResolvedValue(frame)
  await waitFor(() => expect(actions).not.toBeNull())
  await act(async () => {
    actions!.setViewingThread(THREAD)
  })
  await waitFor(() =>
    expect(useStreamsStore.getState().workflowLockByThread.has(THREAD)).toBe(true),
  )
}

/** Put ONE empty streaming assistant row in the transcript, AFTER the lock has landed. The
 *  bucket and the streaming flag are ordinary transcript state, not the thing under test;
 *  what is under test is which banner `MessageItem` picks for the lock that is already there.
 *  Doing it after the lock lands is what makes the fetch DELTA below attributable. */
async function addStreamingAssistantRow(): Promise<void> {
  await act(async () => {
    useStreamsStore.setState((s) => ({
      bucketsBySurface: new Map(s.bucketsBySurface).set(
        "chat",
        new Map().set(THREAD, [
          {
            id: "m-streaming",
            thread_id: THREAD,
            user_id: "user-1",
            role: "assistant",
            content: "",
            created_at: "2026-09-12T06:05:00Z",
            updated_at: "2026-09-12T06:05:00Z",
            runStatus: "streaming",
          } as Message,
        ]),
      ),
      streamingThreads: new Set([THREAD]),
    }))
  })
}

describe("244-13 / G-1 — a DEEP cap-pause is NOT a live workflow", () => {
  it("D1 — renders NO live run line and NOT the harness word", async () => {
    renderTranscript()
    await driveLockFromServer(DEEP_CAP_PAUSED_FRAME)

    // CAUSE — the lock says what it IS. Before the discriminator landed this read
    // `"harness"` for a run that has no workflow at all.
    expect(useStreamsStore.getState().workflowLockByThread.get(THREAD)?.mode).toBe("cap_paused")

    // CONSEQUENCE — what the person actually sees. Both the STATE ATTRIBUTE and the
    // rendered SENTENCE, because either alone is consistent with the defect: a line that
    // renders `state="live"` with different copy is still a phantom, and the harness word
    // rendered in a non-live line is still a lie about what is running.
    const line = screen.queryByTestId("thread-run-line")
    expect(line).toBeNull()
    expect(screen.queryByText("Starting workflow…")).toBeNull()
    expect(document.querySelector('[data-run-line-state="live"]')).toBeNull()
  })

  it("D2 — registers NO 1s clock for a run that is stopped", async () => {
    // ⛔ A STOPPED RUN MUST NOT TICK. `ThreadRunLine.tsx:243-249` starts a 1000ms
    // `window.setInterval` on the LIVE arm only, so the interval's existence IS the live
    // arm's existence — measured rather than argued. The spy is filtered to 1000ms: the
    // provider's own stream watchdog registers a 5000ms tick and is not this defect.
    const spy = vi.spyOn(window, "setInterval")
    renderTranscript()
    await driveLockFromServer(DEEP_CAP_PAUSED_FRAME)

    const oneSecondTicks = spy.mock.calls.filter((c) => c[1] === 1000)
    expect(oneSecondTicks).toHaveLength(0)

    // Non-vacuity: the spy IS installed and IS seeing the provider's watchdog, so a zero
    // above is a real absence rather than a spy that was never reached.
    expect(spy.mock.calls.length).toBeGreaterThan(0)
    spy.mockRestore()
  })

  it("D3 — takes the DEEP banner and mounts NOTHING that fetches the thread workflow", async () => {
    // ⚠ THIS IS `T-194-07-03`'s DISPOSITION, WHICH 244-03 SILENTLY VOIDED.
    // `MessageItem`'s own docblock asserts *"only when `workflowLock != null` ⇒ a DEEP thread
    // never mounts it, so the Deep path costs zero fetches and zero subscriptions"*. Once the
    // server started sending a lock for a Deep cap-pause that sentence became FALSE, and
    // `HarnessOuterBanner` → `usePhases` → `usePanelReconcile` began firing a
    // `getThreadWorkflow` FETCH on the primary Deep path. It belongs in an assertion now.
    renderTranscript()
    await driveLockFromServer(DEEP_CAP_PAUSED_FRAME)

    const before = mockGetThreadWorkflow.mock.calls.length
    await addStreamingAssistantRow()

    // The DEEP sentence, by value — `toolMeta.ts`'s non-harness pre-tools string.
    expect(await screen.findByText("Setting up agent…")).toBeInTheDocument()
    expect(screen.queryByText("Starting workflow…")).toBeNull()

    // …and the row cost NOTHING. D4 below is this assertion's positive control: the same
    // delta on a genuine harness lock is non-zero, so a zero here cannot be a harness that
    // never rendered.
    expect(mockGetThreadWorkflow.mock.calls.length - before).toBe(0)
  })

  it("D4 — a GENUINE harness run is UNHARMED: live line, harness banner, advancing step", async () => {
    // ⛔ THE ANTI-REGRESSION HALF. A fix that silences the phantom by silencing the real one
    // is not a fix, and it would pass D1-D3 perfectly.
    renderTranscript()
    await driveLockFromServer(HARNESS_LIVE_FRAME)
    expect(useStreamsStore.getState().workflowLockByThread.get(THREAD)?.mode).toBe("harness")

    // The live line, by state AND by word.
    const line = await screen.findByTestId("thread-run-line")
    expect(line).toHaveAttribute("data-run-line-state", "live")
    expect(screen.getByTestId("thread-run-line-word")).toHaveTextContent("Starting workflow…")

    // …and it ADVANCES with the phase slice, rather than being a static label.
    await act(async () => {
      useStreamsStore.setState((s) => ({
        phasesByThread: new Map(s.phasesByThread).set(THREAD, [
          // ⚠ `phaseIndex` IS 0-BASED and `harnessBannerProgress` renders `phaseIndex + 1`
          // (`toolMeta.ts:128`). A 1-based fixture reads "Step 3 of 3" for the middle phase —
          // measured while driving this case, and recorded so the next reader does not.
          { slug: "plan", phaseIndex: 0, phaseType: "plan", status: "done", subAgents: [], pendingAsk: null },
          { slug: "act", phaseIndex: 1, phaseType: "act", status: "running", subAgents: [], pendingAsk: null },
          { slug: "check", phaseIndex: 2, phaseType: "check", status: "pending", subAgents: [], pendingAsk: null },
        ] as unknown as Phase[]),
      }))
    })
    expect(await screen.findByTestId("thread-run-line-steps")).toHaveTextContent("Step 2 of 3")

    // The banner arm, and the fetch it legitimately costs — the positive control for D3.
    const before = mockGetThreadWorkflow.mock.calls.length
    await addStreamingAssistantRow()
    expect(await screen.findAllByText(/Working on phase 2…|Starting workflow…/)).not.toHaveLength(0)
    expect(screen.queryByText("Setting up agent…")).toBeNull()
    expect(mockGetThreadWorkflow.mock.calls.length - before).toBeGreaterThan(0)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// Phase 244-13 — D5b: THE `cap_paused` SSE CARRIES NO MODE, SO IT MUST INHERIT
// ═════════════════════════════════════════════════════════════════════════════
//
// `StreamsProvider.tsx:1193`'s `onCapPaused` is write site #1 of six, and it is the ONLY one
// with no answer available on the wire: the SSE event carries `runId` + `continuesRemaining`
// and nothing about mode. ⛔ The rule is therefore an INFERENCE with a reason, not a fact off
// the wire: **keep whatever this thread's lock already says, and default to `cap_paused`.**
// A thread only holds a harness lock because a harness run put one there (site 4's kickoff
// seed or site 2's reconcile), so inheriting is exactly as strong as those two writes.
//
// ⚠ HONESTY ABOUT COLOUR, stated rather than left to be discovered: arm (a) is GREEN BOTH
// WAYS — site 1 hard-coded `"harness"`, so a harness cap-pause already read `"harness"`. It is
// here as the anti-regression half. **Arm (b) is the one that was RED**: a DEEP run that caps
// mid-stream was labelled `"harness"` by this very line, which is the phantom G-1 describes
// arriving by its live route rather than by the reconcile.
//
// ⛔ Driven through the REAL `sendMessage` and the REAL SSE callback bundle — the lock is
// never written by hand in either arm.

/** Drive a real send, then fire the real `onCapPaused` SSE callback the provider registered. */
async function sendThenCapPause(opts?: { workflowDefinitionId?: string }): Promise<void> {
  // ⚠ THE THREAD MUST BE VIEWED FIRST, and that is a product fact rather than harness noise:
  // `sendMessage` only opens a stream when `isThreadInStreamPool` says so
  // (`StreamsProvider.tsx:1694-1703`), and the keep-set is built from `activeThreadIdRef` +
  // the MRU list — both written ONLY by `setViewingThread`. Without it the POST resolves,
  // `subscribeToRun` is never reached, and no SSE callback bundle exists to fire. Measured.
  mockGetSnapshot.mockResolvedValue({ messages: [], active_runs: [], since_cursors: {} })
  mockGetThreadWorkflow.mockResolvedValue(DEEP_UNLOCKED_FRAME)
  mockPostMessage.mockResolvedValue({
    message_id: "msg-1",
    run_id: "run-live-1",
    model: "gpt-test",
    provider: "openai",
  })
  await waitFor(() => expect(actions).not.toBeNull())
  await act(async () => {
    actions!.setViewingThread(THREAD)
  })
  // Let the nav reconcile SETTLE before the send: its `else` arm clears the thread lock, and
  // a reconcile landing after the kickoff seed would clear the very lock arm (a) is about.
  await waitFor(() => expect(mockGetThreadWorkflow).toHaveBeenCalled())
  await act(async () => {
    await Promise.resolve()
  })
  await act(async () => {
    void actions!.sendMessage(THREAD, "go", opts)
  })
  await waitFor(() => expect(mockSubscribeToRun).toHaveBeenCalled())
  const callbacks = mockSubscribeToRun.mock.calls[0][2] as {
    onCapPaused: (info: { runId: string; continuesRemaining: number }) => void
  }
  await act(async () => {
    callbacks.onCapPaused({ runId: "run-live-1", continuesRemaining: 0 })
  })
}

describe("244-13 / WR-07 — the cap_paused SSE inherits the lock's mode", () => {
  it("D5b(a) — a HARNESS run that caps keeps mode 'harness' (anti-regression, green both ways)", async () => {
    renderTranscript()
    await sendThenCapPause({ workflowDefinitionId: "wf-def-1" })

    const lock = useStreamsStore.getState().workflowLockByThread.get(THREAD)
    expect(lock?.mode).toBe("harness")
    expect(lock?.capPaused).toBe(true)
  })

  it("D5b(b) — a DEEP run that caps is labelled 'cap_paused', never 'harness'", async () => {
    renderTranscript()
    await sendThenCapPause()

    const lock = useStreamsStore.getState().workflowLockByThread.get(THREAD)
    expect(lock?.capPaused).toBe(true)
    // ⛔ THE DEFECT, at its live route. There is no workflow on this thread and never was.
    expect(lock?.mode).toBe("cap_paused")
    // …and the consequence on screen: no live run line for a run that is stopped.
    expect(screen.queryByTestId("thread-run-line")).toBeNull()
  })
})
