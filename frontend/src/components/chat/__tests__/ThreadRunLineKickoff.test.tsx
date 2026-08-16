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
import type { Message } from "@/types"

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
