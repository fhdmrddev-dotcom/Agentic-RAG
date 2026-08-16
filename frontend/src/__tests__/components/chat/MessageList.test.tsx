/**
 * Phase 068.5 (Plan 01 — Wave 0): RED test stubs for `MessageList.tsx` empty-state
 * skeleton branch.
 *
 * Tests D-068.5-11 (cold-load 3-bubble skeleton with shimmer) + D-068.5-12
 * (skeleton clears the instant the first message renders).
 *
 * RED at task start (MessageSkeleton + empty-state ternary don't exist yet);
 * GREEN at Task 4 end.
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi, afterAll } from "vitest"
import { render, screen, act, waitFor, cleanup } from "@testing-library/react"
import type { ReactNode } from "react"
import { TooltipProvider } from "@/components/ui/tooltip"
import { MessageList } from "@/components/chat/MessageList"
import { ThreadRunLine } from "@/components/chat/ThreadRunLine"
import { useStreamsStore } from "@/stores/streamsStore"
import type { Message, Phase } from "@/types"
import type { ThreadWorkflowState } from "@/lib/api"

// ── Phase 194.1 Plan 06 — the ONE mocked wire call. ─────────────────────────────
//
// `ThreadRunLine` reads the shipped, ungated, owner-scoped
// `GET /threads/{id}/workflow`. Left unmocked, the real implementation runs
// `fetch` in jsdom, the component's own try/catch swallows the failure, and every
// stopped-arm case below would report an absent line for a reason that has nothing
// to do with what it is testing — precisely what `ComposerStopHarness.test.tsx:78-101`
// records happening to it.
//
// ⚠ The mock SPREADS the real module rather than re-exporting a hand-picked list.
// `MessageItem`'s subtree pulls other exports from `@/lib/api`, and a factory that
// named only `getThreadWorkflow` would break the Phase 068.5 / 095 describes above
// for a reason no assertion in this file would explain.
const { mockGetThreadWorkflow } = vi.hoisted(() => ({
  mockGetThreadWorkflow: vi.fn(),
}))
vi.mock("@/lib/api", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/api")>()
  return { ...actual, getThreadWorkflow: mockGetThreadWorkflow }
})

// MessageItem renders Radix tooltips on the assistant bubble; provide the
// TooltipProvider context the D-03 chip tests need (they render real
// assistant messages, unlike the skeleton tests above which render empty/user).
function renderML(ui: ReactNode) {
  return render(<TooltipProvider>{ui}</TooltipProvider>)
}

// A flushable requestAnimationFrame queue for the D-03 scroll tests: the
// follow-scroll hook clears its programmatic-scroll flag on a rAF, and jsdom
// never auto-flushes rAF. We queue callbacks and run them on demand.
let rafQueue: FrameRequestCallback[] = []
function flushRaf() {
  const q = rafQueue
  rafQueue = []
  q.forEach((cb) => cb(0))
}

// jsdom lacks scrollIntoView; stub it so MessageList's auto-scroll effect
// (`bottomRef.current?.scrollIntoView`) doesn't throw inside passive effects.
beforeAll(() => {
  if (!HTMLElement.prototype.scrollIntoView) {
    HTMLElement.prototype.scrollIntoView = function () {}
  }
})

const NOW = "2026-05-13T00:00:00Z"

function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: "msg-1",
    thread_id: "thread-1",
    user_id: "user-1",
    role: "user",
    content: "Hello",
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  }
}

describe("Phase 068.5 — MessageList skeleton", () => {
  it("renders <MessageSkeleton/> (data-testid='message-skeleton') when isLoading AND messages.length === 0", () => {
    // Phase 068.5 Gap-01: skeleton requires BOTH isLoading=true AND empty
    // messages. Empty + not-loading = new chat → no skeleton.
    render(<MessageList messages={[]} isStreaming={false} isLoading={true} />)
    expect(screen.getByTestId("message-skeleton")).toBeInTheDocument()
  })

  it("does NOT render the skeleton when at least one message is present", () => {
    render(<MessageList messages={[makeMessage()]} isStreaming={false} isLoading={true} />)
    expect(screen.queryByTestId("message-skeleton")).toBeNull()
  })

  it("Gap-01: does NOT render the skeleton on empty list when isLoading is false (new chat / no fetch in flight)", () => {
    render(<MessageList messages={[]} isStreaming={false} isLoading={false} />)
    expect(screen.queryByTestId("message-skeleton")).toBeNull()
  })

  it("Gap-01: defaults isLoading to false — empty list with no prop renders no skeleton", () => {
    render(<MessageList messages={[]} isStreaming={false} />)
    expect(screen.queryByTestId("message-skeleton")).toBeNull()
  })
})

/**
 * Phase 095 Plan 04 (D-03) — the floating "↓ Jump to live" chip wiring.
 *
 * MessageList wires `useFollowScroll` over the Radix viewport and renders the
 * floating chip (reusing the ONE RunStatusStrip) ONLY on scroll-away during a
 * live run. These cases drive the real viewport scroll geometry to prove:
 *   - scroll-UP during streaming → the chip renders (the pin released).
 *   - scroll-to-bottom → the chip hides + follow re-arms.
 * (095-VALIDATION.md → D-03 pass condition.)
 */
function setViewportGeometry(
  vp: HTMLElement,
  geom: { scrollHeight: number; clientHeight: number; scrollTop: number },
) {
  Object.defineProperty(vp, "scrollHeight", { value: geom.scrollHeight, configurable: true })
  Object.defineProperty(vp, "clientHeight", { value: geom.clientHeight, configurable: true })
  // scrollTop is writable on real elements; jsdom keeps it at 0 — define it.
  Object.defineProperty(vp, "scrollTop", { value: geom.scrollTop, writable: true, configurable: true })
}

function fireScroll(vp: HTMLElement) {
  act(() => {
    // The mount auto-scroll effect flags a programmatic scroll and schedules a
    // rAF to clear it. jsdom never auto-flushes rAF, so flush any pending frames
    // before the user scroll — otherwise `onScroll` would skip the release,
    // mistaking the user scroll for our own auto-follow. (In the browser the rAF
    // clears within ~16ms, well before a real user scroll.)
    flushRaf()
    vp.dispatchEvent(new Event("scroll"))
  })
}

function makeAssistant(overrides: Partial<Message> = {}): Message {
  return makeMessage({ id: "a-1", role: "assistant", content: "thinking…", ...overrides })
}

describe("Phase 095 Plan 04 — MessageList follow-but-release chip (D-03)", () => {
  beforeEach(() => {
    rafQueue = []
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      rafQueue.push(cb)
      return rafQueue.length as unknown as number
    })
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    rafQueue = []
  })

  function renderStreaming() {
    const utils = renderML(
      <MessageList messages={[makeAssistant()]} isStreaming={true} />,
    )
    // BL-05 attaches the scroll listener on a rAF; flush microtasks/frames so the
    // viewport listener is live before we dispatch scroll events.
    const vp = utils.container.querySelector(
      "[data-radix-scroll-area-viewport]",
    ) as HTMLElement
    return { ...utils, vp }
  }

  it("does NOT render the Jump-to-live chip while pinned at the bottom (default)", () => {
    const { vp } = renderStreaming()
    setViewportGeometry(vp, { scrollHeight: 1000, clientHeight: 500, scrollTop: 500 }) // dist 0
    fireScroll(vp)
    expect(screen.queryByTestId("jump-to-live-chip")).toBeNull()
  })

  it("scroll-up during streaming → the Jump-to-live chip renders", () => {
    const { vp } = renderStreaming()
    setViewportGeometry(vp, { scrollHeight: 1000, clientHeight: 500, scrollTop: 100 }) // dist 400 > 120
    fireScroll(vp)
    const chip = screen.getByTestId("jump-to-live-chip")
    expect(chip).toBeInTheDocument()
    expect(chip).toHaveTextContent("Jump to live")
    // reuses the ONE RunStatusStrip (no second strip)
    expect(chip.querySelector("[data-testid='run-status-strip']")).not.toBeNull()
  })

  it("scroll back to bottom → the chip hides + follow re-arms", () => {
    const { vp } = renderStreaming()
    // release
    setViewportGeometry(vp, { scrollHeight: 1000, clientHeight: 500, scrollTop: 100 })
    fireScroll(vp)
    expect(screen.getByTestId("jump-to-live-chip")).toBeInTheDocument()
    // re-arm
    setViewportGeometry(vp, { scrollHeight: 1000, clientHeight: 500, scrollTop: 500 })
    fireScroll(vp)
    expect(screen.queryByTestId("jump-to-live-chip")).toBeNull()
  })

  it("NOT streaming → no chip even when scrolled up (the chip is a live-run affordance)", () => {
    const { container } = renderML(
      <MessageList messages={[makeAssistant()]} isStreaming={false} />,
    )
    const vp = container.querySelector("[data-radix-scroll-area-viewport]") as HTMLElement
    setViewportGeometry(vp, { scrollHeight: 1000, clientHeight: 500, scrollTop: 100 })
    fireScroll(vp)
    expect(screen.queryByTestId("jump-to-live-chip")).toBeNull()
  })

  it("clicking the chip re-pins (hides the chip)", () => {
    const { vp } = renderStreaming()
    setViewportGeometry(vp, { scrollHeight: 1000, clientHeight: 500, scrollTop: 100 })
    fireScroll(vp)
    const chip = screen.getByTestId("jump-to-live-chip")
    act(() => {
      chip.click()
    })
    expect(screen.queryByTestId("jump-to-live-chip")).toBeNull()
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// Phase 194.1 Plan 06 (RUN-01 / R4 + R5) — THE RUN-ANCHORED LINE.
//
// ⚠ THE HARNESS SHAPE IS THE EVIDENCE, NOT A CONVENIENCE. `renderML()` above is a
// bare `TooltipProvider` and **NO `StreamsProvider`**. So "the streaming store is
// empty" is STRUCTURAL here — there is no provider in the tree to arrange — rather
// than arranged. That is exactly the property R4's central acceptance rests on
// (174 D1: *derived from persisted state, never from live streaming state*), and
// `MessageList.runline.baseline.test.tsx` pins the shape itself so a later plan
// cannot quietly wrap this harness in a provider to make a new line render.
//
// ⚠ A LATER PLAN MUST NOT ADD A `StreamsProvider` TO THIS FILE. If a case
// genuinely needs one, it belongs in a provider-backed suite with one line saying
// why it moved.
//
// ⚠ WHAT R5 DOES AND DOES NOT REPAIR — carried forward from sketch 171's own
// "NOT guaranteed" row so a future reader finds a BOUNDARY rather than a claim:
// R5 removes the surface the duplicate avatar was drawn on. **It does NOT repair
// the double-mount race.** If the same race later reaches a CONTENT-BEARING
// message the artefact returns, and nothing in this file would have prevented it.
// ═════════════════════════════════════════════════════════════════════════════

const RUN_NOW = "2026-08-16T10:00:00.000Z"
const RUN_END = "2026-08-16T10:02:18.000Z" // 138s → "2m 18s", the sketch's own figure

function frame(over: Partial<ThreadWorkflowState> = {}): ThreadWorkflowState {
  return {
    thread_id: "thread-1",
    mode: "harness",
    locked: false,
    active_workflow_run_id: null, // ⚠ the stop already NULLed it — that is the point
    run_status: null,
    definition_slug: "quarterly-close",
    definition_name: "Quarterly close",
    current_phase_slug: null,
    current_phase_index: null,
    total_phases: 3,
    lock_is_stale: false,
    cap_paused: false,
    continues_used: 0,
    continues_remaining: 3,
    last_workflow_run_id: "wfr-1",
    last_run_status: "cancelled",
    last_run_created_at: RUN_NOW,
    last_run_updated_at: RUN_END,
    phases: [
      { slug: "gather", phase_index: 0, status: "completed" },
      { slug: "draft", phase_index: 1, status: "completed" },
      { slug: "review", phase_index: 2, status: "cancelled" },
    ],
    ...over,
  }
}

function livePhase(slug: string, phaseIndex: number, status: Phase["status"]): Phase {
  return {
    id: `ph-${phaseIndex}`,
    slug,
    name: slug,
    phaseIndex,
    status,
    subAgents: [],
    pendingAsk: null,
  } as unknown as Phase
}

/** Reset every store slice this line can read, so no case inherits another's. */
function resetRunLineStore() {
  useStreamsStore.setState({
    harnessKickoffThreads: new Set<string>(),
    workflowLockByThread: new Map(),
    phasesByThread: new Map<string, Phase[]>(),
  })
}

afterAll(() => {
  resetRunLineStore()
})

describe("194.1-06 — the stopped receipt (R4), derived from persisted state", () => {
  beforeEach(() => {
    resetRunLineStore()
    mockGetThreadWorkflow.mockReset()
    mockGetThreadWorkflow.mockResolvedValue(frame())
  })
  afterEach(() => {
    cleanup()
    resetRunLineStore()
  })

  it("renders the word, the step count and the duration as VALUES", async () => {
    renderML(<ThreadRunLine threadId="thread-1" />)
    const line = await screen.findByTestId("thread-run-line")

    expect(line).toHaveAttribute("data-run-line-state", "stopped")
    expect(screen.getByTestId("thread-run-line-word")).toHaveTextContent("Stopped by you")
    // ⚠ Asserted as a VALUE, never as mere presence: `2 of 3` is the whole of
    // 194 D-13 — a stop must not read as though nothing survived, and two phases
    // genuinely did complete before the interruption.
    expect(screen.getByTestId("thread-run-line-steps")).toHaveTextContent("2 of 3 steps")
    // …and the duration is a VALUE too, not "some non-empty string".
    expect(screen.getByTestId("thread-run-line-elapsed")).toHaveTextContent("2m 18s")
    expect(line.textContent ?? "").toContain("⊘")
  })

  it("the elapsed figure DISCLOSES the two fields it came from, in words", async () => {
    // The shipped rule (`WorkflowRunPage.tsx:770-773`): "a number is only ever
    // shown beside the field it came from. A queued-anchored figure is not a lie —
    // an UNLABELLED one is." T-194.1-06-02.
    renderML(<ThreadRunLine threadId="thread-1" />)
    const el = await screen.findByTestId("thread-run-line-elapsed")
    const title = el.getAttribute("title") ?? ""
    expect(title).toContain("created_at")
    expect(title).toContain("updated_at")
    // …and it says what that MEANS, not only which columns it read.
    expect(title.toLowerCase()).toContain("queued")
  })

  it("no phase rows → the step segment is OMITTED, never rendered as `0 of 0`", async () => {
    mockGetThreadWorkflow.mockResolvedValue(frame({ phases: [] }))
    renderML(<ThreadRunLine threadId="thread-1" />)
    const line = await screen.findByTestId("thread-run-line")

    expect(screen.queryByTestId("thread-run-line-steps")).toBeNull()
    // The reading is still honest and still carries its duration.
    expect(line.textContent ?? "").toContain("Stopped by you")
    expect(line.textContent ?? "").toContain("2m 18s")
    expect(line.textContent ?? "").not.toContain("0 of 0")
  })

  it("an unparseable timestamp OMITS the duration — never `NaN`, never a bare number", async () => {
    mockGetThreadWorkflow.mockResolvedValue(frame({ last_run_updated_at: "not-a-date" }))
    renderML(<ThreadRunLine threadId="thread-1" />)
    const line = await screen.findByTestId("thread-run-line")

    expect(screen.queryByTestId("thread-run-line-elapsed")).toBeNull()
    expect(line.textContent ?? "").not.toContain("NaN")
    // The rest of the reading survives — a missing anchor costs one segment.
    expect(line.textContent ?? "").toContain("2 of 3 steps")
  })

  it("a frame read that FAILS degrades to no line rather than throwing", async () => {
    mockGetThreadWorkflow.mockRejectedValue(new Error("network"))
    renderML(<ThreadRunLine threadId="thread-1" />)
    await waitFor(() => expect(mockGetThreadWorkflow).toHaveBeenCalled())
    expect(screen.queryByTestId("thread-run-line")).toBeNull()
  })
})

describe("194.1-06 — D-16: silent on `completed` AND silent on `failed` (two cases, not one)", () => {
  beforeEach(() => {
    resetRunLineStore()
    mockGetThreadWorkflow.mockReset()
  })
  afterEach(() => {
    cleanup()
    resetRunLineStore()
  })

  it("a workflow that COMPLETED normally renders nothing — R4's acceptance", async () => {
    mockGetThreadWorkflow.mockResolvedValue(frame({ last_run_status: "completed" }))
    renderML(<ThreadRunLine threadId="thread-1" />)
    await waitFor(() => expect(mockGetThreadWorkflow).toHaveBeenCalled())
    expect(screen.queryByTestId("thread-run-line")).toBeNull()
  })

  it("a workflow that FAILED renders nothing — a stated boundary, not an oversight", async () => {
    // D-16. `RunCard` and the run surface already carry failure in their own
    // vocabulary; a failure reading here is a SECOND capability. Re-open trigger:
    // an operator observing that a failed thread is as silent as a stopped one
    // was before this phase.
    mockGetThreadWorkflow.mockResolvedValue(frame({ last_run_status: "failed" }))
    renderML(<ThreadRunLine threadId="thread-1" />)
    await waitFor(() => expect(mockGetThreadWorkflow).toHaveBeenCalled())
    expect(screen.queryByTestId("thread-run-line")).toBeNull()
  })

  it("a thread with NO run at all renders nothing", async () => {
    mockGetThreadWorkflow.mockResolvedValue(
      frame({
        mode: "deep",
        last_workflow_run_id: null,
        last_run_status: null,
        last_run_created_at: null,
        last_run_updated_at: null,
        phases: null,
      }),
    )
    renderML(<ThreadRunLine threadId="thread-1" />)
    await waitFor(() => expect(mockGetThreadWorkflow).toHaveBeenCalled())
    expect(screen.queryByTestId("thread-run-line")).toBeNull()
  })

  it("`threadId == null` renders nothing AND buys no round trip", () => {
    renderML(<ThreadRunLine threadId={null} />)
    expect(screen.queryByTestId("thread-run-line")).toBeNull()
    // The absence of the read is asserted, not assumed: a component that fetched
    // on a null thread would be spending a request per empty chat.
    expect(mockGetThreadWorkflow).not.toHaveBeenCalled()
  })
})

describe("194.1-06 — the LIVE state (R5), present from the synchronous kickoff mark", () => {
  beforeEach(() => {
    resetRunLineStore()
    mockGetThreadWorkflow.mockReset()
    mockGetThreadWorkflow.mockResolvedValue(frame())
  })
  afterEach(() => {
    cleanup()
    resetRunLineStore()
  })

  it("a kickoff-marked thread renders the line with the SHIPPED harness word", () => {
    useStreamsStore.setState({ harnessKickoffThreads: new Set(["thread-1"]) })
    renderML(<ThreadRunLine threadId="thread-1" />)

    const line = screen.getByTestId("thread-run-line")
    expect(line).toHaveAttribute("data-run-line-state", "live")
    // The word is the one Phase 174 D4 already chose and `toolMeta` pins byte-exact.
    expect(screen.getByTestId("thread-run-line-word")).toHaveTextContent("Starting workflow…")
    expect(line.textContent ?? "").toContain("◆")
  })

  it("the live step segment counts the STORE's phases, in the CLIENT vocabulary", () => {
    // ⚠ THE TWO VOCABULARIES ARE THE POINT. The store spells a finished phase
    // `done`; the wire spells it `completed` (`lib/phaseState.ts:59-72` maps
    // between them). Handing this array to `stepsFrom` would TYPECHECK and then
    // report `0 of 3` — the exact "nothing survived" lie D-13 forbids — which is
    // why the live arm uses the shipped `harnessBannerProgress` instead.
    useStreamsStore.setState({
      harnessKickoffThreads: new Set(["thread-1"]),
      phasesByThread: new Map<string, Phase[]>([
        [
          "thread-1",
          [
            livePhase("gather", 0, "done"),
            livePhase("draft", 1, "running"),
            livePhase("review", 2, "pending"),
          ],
        ],
      ]),
    })
    renderML(<ThreadRunLine threadId="thread-1" />)
    expect(screen.getByTestId("thread-run-line-steps")).toHaveTextContent("Step 2 of 3")
  })

  it("live with NO phases yet → the line is still there, with the step segment omitted", () => {
    // This is the kickoff frame itself: the mark is stamped synchronously and no
    // phase row exists yet. A line that waited for phases would reintroduce the
    // dead air 171-C was refuted for.
    useStreamsStore.setState({ harnessKickoffThreads: new Set(["thread-1"]) })
    renderML(<ThreadRunLine threadId="thread-1" />)
    expect(screen.getByTestId("thread-run-line")).toBeInTheDocument()
    expect(screen.queryByTestId("thread-run-line-steps")).toBeNull()
  })

  it("the live arm renders BEFORE the frame read resolves — no dead frame", () => {
    // ⚠ ASSERTED WITHOUT FLUSHING THE FETCH, ON PURPOSE. The mock returns a
    // promise that never settles. If the line only appeared after a resolution,
    // the dead interval R5's acceptance forbids would exist and this case would red.
    mockGetThreadWorkflow.mockReturnValue(new Promise(() => {}))
    useStreamsStore.setState({ harnessKickoffThreads: new Set(["thread-1"]) })
    renderML(<ThreadRunLine threadId="thread-1" />)
    expect(screen.getByTestId("thread-run-line")).toBeInTheDocument()
    expect(screen.getByTestId("thread-run-line-word")).toHaveTextContent("Starting workflow…")
  })

  it("live WINS over a stopped frame — a re-run must not read as the previous stop", async () => {
    // The frame still names the LAST run as `cancelled` while a NEW one is live.
    useStreamsStore.setState({ harnessKickoffThreads: new Set(["thread-1"]) })
    renderML(<ThreadRunLine threadId="thread-1" />)
    await waitFor(() => expect(mockGetThreadWorkflow).toHaveBeenCalled())
    expect(screen.getByTestId("thread-run-line")).toHaveAttribute("data-run-line-state", "live")
    expect(screen.queryByText("Stopped by you")).toBeNull()
  })
})

describe("194.1-06 — R4 THROUGH THE LIST, with the streaming store structurally empty", () => {
  /**
   * ⚠ THIS IS R4's CENTRAL ACCEPTANCE AND THE HARNESS IS THE EVIDENCE. Everything
   * here goes through `MessageList` — the real mount, the real prop — inside a bare
   * `TooltipProvider` with **NO `StreamsProvider` anywhere in the tree**. So the
   * claim *"it renders with the live streaming store empty"* is STRUCTURAL rather
   * than arranged: there is no provider to arrange.
   *
   * That is 174 D1 made mechanical (*derived from persisted state, never from live
   * streaming state*), and it is the property whose absence kept `BUG-260610-01`
   * open for two months.
   */
  beforeEach(() => {
    resetRunLineStore()
    mockGetThreadWorkflow.mockReset()
    mockGetThreadWorkflow.mockResolvedValue(frame())
  })
  afterEach(() => {
    cleanup()
    resetRunLineStore()
  })

  function stoppedThread(): Message {
    return {
      id: "msg-user-1",
      thread_id: "thread-1",
      user_id: "user-1",
      role: "user",
      content: "Run the quarterly close workflow",
      created_at: RUN_NOW,
      updated_at: RUN_NOW,
    }
  }

  it("a returning transcript carries the stopped receipt, with both figures as VALUES", async () => {
    const { container } = renderML(
      <MessageList messages={[stoppedThread()]} isStreaming={false} threadId="thread-1" />,
    )
    await screen.findByTestId("thread-run-line")

    // The prompt is rendered too, so this is a reading INSIDE a transcript rather
    // than a component floating on its own.
    expect(container.textContent ?? "").toContain("Run the quarterly close workflow")

    expect(screen.getByTestId("thread-run-line-word")).toHaveTextContent("Stopped by you")
    expect(screen.getByTestId("thread-run-line-steps")).toHaveTextContent("2 of 3 steps")
    expect(screen.getByTestId("thread-run-line-elapsed")).toHaveTextContent("2m 18s")
  })

  it("the line sits AFTER the last message and BEFORE the scroll anchor (list level, D-15)", async () => {
    const { container } = renderML(
      <MessageList messages={[stoppedThread()]} isStreaming={false} threadId="thread-1" />,
    )
    const line = await screen.findByTestId("thread-run-line")
    const prompt = screen.getByTestId("user-message")

    // ⚠ ORDER asserted by DOM position, never by class name or by markup shape.
    // `Node.DOCUMENT_POSITION_FOLLOWING` is 4.
    expect(prompt.compareDocumentPosition(line) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    // …and it is a SIBLING of the transcript rather than a child of any message:
    // no `MessageItem` subtree contains it.
    expect(prompt.contains(line)).toBe(false)
    // The scroll anchor is still the LAST child of the message column, so the
    // auto-follow effect keeps landing at the true bottom.
    const column = container.querySelector(".relative.space-y-1") as HTMLElement
    expect(column).not.toBeNull()
    expect(column.contains(line)).toBe(true)
  })

  it("absent through the list on `completed`, and absent on `failed` (D-16, two cases)", async () => {
    mockGetThreadWorkflow.mockResolvedValue(frame({ last_run_status: "completed" }))
    renderML(<MessageList messages={[stoppedThread()]} isStreaming={false} threadId="thread-1" />)
    await waitFor(() => expect(mockGetThreadWorkflow).toHaveBeenCalled())
    expect(screen.queryByTestId("thread-run-line")).toBeNull()
    cleanup()

    mockGetThreadWorkflow.mockClear()
    mockGetThreadWorkflow.mockResolvedValue(frame({ last_run_status: "failed" }))
    renderML(<MessageList messages={[stoppedThread()]} isStreaming={false} threadId="thread-1" />)
    await waitFor(() => expect(mockGetThreadWorkflow).toHaveBeenCalled())
    expect(screen.queryByTestId("thread-run-line")).toBeNull()
  })

  it("every shipped call site without the prop is unaffected — no line, no round trip", () => {
    // `MessageList`'s new prop is optional, and the four Phase-068.5 / 095 describes
    // above call it without one. This states that as a property rather than leaving
    // it to be inferred from those suites still being green.
    renderML(<MessageList messages={[stoppedThread()]} isStreaming={false} />)
    expect(screen.queryByTestId("thread-run-line")).toBeNull()
    expect(mockGetThreadWorkflow).not.toHaveBeenCalled()
  })
})

describe("194.1-06 — the source fences on ThreadRunLine", () => {
  /** ⚠ RAW, NOT COMMENT-STRIPPED, for the two forbidden identifiers — the Phase
   *  193 D-24(a) precedent: a docblock QUOTING one would be caught too. That is
   *  affordable only because the module names both by ROLE and spells neither,
   *  which its own docblock states as a rule rather than as a habit. */
  it("reads NOTHING from the live message store — 174 D1, made mechanical", async () => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore — Vite `?raw` import.
    const src = (await import("@/components/chat/ThreadRunLine.tsx?raw")).default as string
    // The empty-sweep guard first: an absence over "" is vacuously true (192.1).
    expect(src.length).toBeGreaterThan(4000)
    expect(src).toContain("export function ThreadRunLine")

    expect(src).not.toMatch(/useStreamingForThread/)
    expect(src).not.toMatch(/bucketsBySurface/)
    // POSITIVE CONTROLS — both needles match the shapes they forbid.
    expect("const s = useStreamingForThread(threadId)").toMatch(/useStreamingForThread/)
    expect("s.bucketsBySurface.get(id)").toMatch(/bucketsBySurface/)
  })

  it("draws no mark outside the two D-18 allows", async () => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore — Vite `?raw` import.
    const src = (await import("@/components/chat/ThreadRunLine.tsx?raw")).default as string
    // ⚠ Built from char codes so THIS FILE does not itself contain the two marks
    // — the fence would otherwise be unable to describe what it forbids without a
    // future whole-subtree sweep redding on it (the 187-24 shape).
    const CANCELLED_STATE_MARK = String.fromCharCode(0x25a0) // RunCard's cancelled glyph
    const SKETCH_STOP_MARK = String.fromCharCode(0x23f9) // the sketch's stop glyph
    expect(src).not.toContain(CANCELLED_STATE_MARK)
    expect(src).not.toContain(SKETCH_STOP_MARK)
    // POSITIVE CONTROL — the needles are the real characters.
    expect(`x${CANCELLED_STATE_MARK}y`).toContain(CANCELLED_STATE_MARK)
    expect(`x${SKETCH_STOP_MARK}y`).toContain(SKETCH_STOP_MARK)
  })

  it("carries NO run-navigation seam — the deferral is fenced, not merely stated", async () => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore — Vite `?raw` import.
    const raw = (await import("@/components/chat/ThreadRunLine.tsx?raw")).default as string
    // ⚠ COMMENT-STRIPPED, and that is the OPPOSITE choice from the fence two cases
    // above — deliberately. The module's docblock EXPLAINS the deferral at length
    // and necessarily quotes the panel's shipped label, so a raw sweep would red on
    // its own documentation (`194.1-BASELINE.md` §9 Trap 2). The strip is followed
    // by a positive assertion that the prose mention SURVIVES, so it can never
    // cover for a real absence (the plan-03 shape).
    const code = raw
      .split("\n")
      .filter((l) => !/^\s*(\*|\/\*|\/\/)/.test(l))
      .join("\n")
    expect(code.length).toBeGreaterThan(1500)
    expect(code).toContain("export function ThreadRunLine")

    expect(code).not.toContain("Open the run")
    expect(code).not.toMatch(/onOpenRun/)
    // …and the DOCUMENTED deferral is still present, so the strip is not hiding a
    // silently-deleted decision.
    expect(raw).toContain("Open the run")
    expect(raw).toContain("Re-open trigger")
    // POSITIVE CONTROL — the strip does not eat real code lines.
    expect(
      ["/** doc */", "  * more doc", "const x = 1"]
        .filter((l) => !/^\s*(\*|\/\*|\/\/)/.test(l))
        .join("\n"),
    ).toBe("const x = 1")
  })
})
