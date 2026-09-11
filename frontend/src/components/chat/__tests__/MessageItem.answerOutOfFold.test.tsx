/**
 * Phase 243 Plan 05 (CHAT-05 / CHAT-01 — D-243-06, D-243-14) — THE ANSWER COMES OUT OF THE
 * NARRATION FOLD, and the navigation path is driven rather than assumed.
 *
 * `BUG-260707-03`'s residual #2: *"a run that finished while the operator was on another page
 * … still relies on a reload."* D-243-06 states the cause, and it is NOT that the answer is
 * missing or un-streamed — `StreamsProvider`'s `onDelta` appends `content: m.content + delta`
 * per token the whole time. It is that on a **tool-bearing, still-streaming** message
 * `MessageItem` routes that content into `<StreamingNarration>`, the one-line italic gist, so
 * the answer is written INSIDE a fold and only surfaces when the run-end reconcile swaps in
 * the persisted text.
 *
 * ⚠ THE SEND-PATH HALF ALREADY SHIPPED AT PHASE 176, so a fence that drives a live send
 * passes while the residual stands. This file drives TWO levels, because the defect could
 * live at either and no plan may guess which:
 *
 *   §1-§5  the BRANCH, at the component — what a mounted `MessageItem` draws for a live
 *          tool-bearing run, including the three surfaces the ROADMAP names as the ones that
 *          "regress with it, and nobody notices because the criteria only asked about
 *          reasoning": the streaming CURSOR (§3), the narration BANNER (§4), the CITATION
 *          branch and its absence hint (§5).
 *   §6     the NAVIGATION path, at the provider — driven through `StreamsProvider`'s own
 *          callbacks and its own `reconcile`, never through a hand-built message that already
 *          carries the answer (that fixture would assume the conclusion).
 *
 * ⛔ `StreamingNarration` is NOT deleted and NOT restyled by this plan (243-PATTERNS §F.4).
 * §4 exists to prove the component survives whatever narrowing §1 forces.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, cleanup, act, waitFor, renderHook } from "@testing-library/react"
import React, { type ReactNode } from "react"
import { TooltipProvider } from "@/components/ui/tooltip"
import type { Message, Citation } from "@/types"

// ⚠ THE MOCK SPREADS THE REAL MODULE rather than re-exporting a hand-picked list
// (`MessageList.test.tsx:30-40`, recorded there as load-bearing). `MessageItem`'s subtree
// pulls `continueRun` and friends from `@/lib/api`; a factory naming only the five wire calls
// §6 drives would break §1-§5 for a reason no assertion in this file would explain.
const {
  mockPostMessage,
  mockSubscribeToRun,
  mockGetMessages,
  mockGetActiveRuns,
  mockGetSnapshot,
  mockCancelRun,
  mockGetThreadWorkflow,
  mockListThreadTodos,
} = vi.hoisted(() => ({
  mockPostMessage: vi.fn(),
  mockSubscribeToRun: vi.fn(),
  mockGetMessages: vi.fn(),
  mockGetActiveRuns: vi.fn(),
  mockGetSnapshot: vi.fn(),
  mockCancelRun: vi.fn(),
  mockGetThreadWorkflow: vi.fn(),
  mockListThreadTodos: vi.fn(),
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
    // ⚠ MEASURED, not defensive. Left real, `getThreadWorkflow` runs a jsdom `fetch`,
    // the reconcile's own try/catch swallows the 401 — and because that await sits INSIDE
    // `reconcileInFlightRef`'s window, the next navigation's reconcile short-circuits on the
    // in-flight guard and never fires. The §6b case then reds for a reason that has nothing
    // to do with the product. `MessageList.test.tsx:24-31` records the same trap.
    getThreadWorkflow: mockGetThreadWorkflow,
    listThreadTodos: mockListThreadTodos,
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

import { MessageItem } from "../MessageItem"
import { StreamingNarration } from "../StreamingNarration"
import { StreamsProvider, useStreamActions } from "@/providers/StreamsProvider"
import { useStreamsStore } from "@/stores/streamsStore"
import type { StreamCallbacks } from "@/lib/api"

// The three strings §1 turns on.
//
// ⭐ They are chosen so the two states are DISTINGUISHABLE BY CONTENT, not by the presence of
// a `data-testid` (D-243-11 — "presence assertions cannot see content drift"). Today the whole
// blob folds and Radix's closed `CollapsibleContent` does not mount, so ONLY the last line
// survives in the DOM, stripped to a gist inside the trigger. So:
//   - NARRATION and ANSWER_P1 are ABSENT from the document today and PRESENT after the fix
//   - ANSWER_P2 is present today only as the italic gist INSIDE the narration subtree
const NARRATION = "Now I will search the knowledge base for the withholding figures."
const ANSWER_P1 = "The withholding lines do not agree — invoice1092 shows a 230.00 gap."
const ANSWER_P2 = "The 1042-S figure is a sum across the chunks retrieved, not a stated total."
const BLOB = [NARRATION, ANSWER_P1, ANSWER_P2].join("\n\n")

const REASONING =
  "Both documents are already in the retrieved set, so I do not need another search."

function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: "m-fold-1",
    thread_id: "t-fold",
    user_id: "u-1",
    role: "assistant",
    content: BLOB,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  } as Message
}

/** A live, tool-bearing, still-streaming assistant turn — the exact shape D-243-06 names. */
function liveToolBearing(overrides: Partial<Message> = {}): Message {
  return makeMessage({
    runStatus: "streaming",
    reasoningContent: REASONING,
    tool_calls: [{ id: "tc-1", name: "search_documents", status: "completed", args: {} }],
    ...overrides,
  } as Partial<Message>)
}

const renderItem = (ui: React.ReactElement) =>
  render(<TooltipProvider>{ui}</TooltipProvider>)

/** True when `b` comes STRICTLY AFTER `a` in document order. */
function isAfter(a: Element, b: Element): boolean {
  return Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)
}

afterEach(() => {
  cleanup()
})

// §1 — THE ANSWER IS THE MESSAGE BODY WHILE THE RUN IS LIVE
describe("§1 CHAT-05 — a live tool-bearing run writes its answer as the message body, not inside the fold", () => {
  it("renders every paragraph of the streaming content as real body text", () => {
    renderItem(<MessageItem message={liveToolBearing()} isStreaming />)

    // Today: the whole blob is folded, the closed Collapsible does not mount its body, and
    // these two strings are nowhere in the document.
    expect(screen.getByText(NARRATION)).toBeInTheDocument()
    expect(screen.getByText(ANSWER_P1)).toBeInTheDocument()
    expect(screen.getByText(ANSWER_P2)).toBeInTheDocument()
  })

  it("does not route the answer through the narration fold", () => {
    const { container } = renderItem(<MessageItem message={liveToolBearing()} isStreaming />)

    const narration = container.querySelector('[data-testid="streaming-narration"]')
    const answer = screen.getByText(ANSWER_P2)
    // Today `answer` IS the gist span inside the trigger, so `contains` is true.
    expect(narration === null || !narration.contains(answer)).toBe(true)
  })
})

// §2 — THE ORDER IN TIME (D-243-01), ASSERTED BY DOCUMENT POSITION
describe("§2 D-243-01 — thinking, then the tool rows, then the answer", () => {
  it("places the thinking trigger before the run card and the run card before the answer body", () => {
    renderItem(<MessageItem message={liveToolBearing()} isStreaming />)

    const thinking = screen.getByTestId("thinking-block")
    const runCard = screen.getByTestId("run-card")
    const answer = screen.getByText(ANSWER_P1)

    expect(isAfter(thinking, runCard)).toBe(true)
    expect(isAfter(runCard, answer)).toBe(true)
  })
})

// §3 — THE STREAMING CURSOR (ROADMAP collateral surface #1)
describe("§3 the streaming caret survives the change", () => {
  it("still renders the live-edge caret on a streaming turn with no running tool", () => {
    const { container } = renderItem(<MessageItem message={liveToolBearing()} isStreaming />)
    expect(container.querySelector("span.animate-pulse")).not.toBeNull()
  })

  it("keeps the caret at the live edge — after the answer body, not before it", () => {
    const { container } = renderItem(<MessageItem message={liveToolBearing()} isStreaming />)
    const caret = container.querySelector("span.animate-pulse")!
    const answer = screen.getByText(ANSWER_P2)
    expect(isAfter(answer, caret)).toBe(true)
  })

  it("still withholds the caret while a tool is actually running", () => {
    const { container } = renderItem(
      <MessageItem
        message={liveToolBearing({
          tool_calls: [{ id: "tc-1", name: "execute_code", status: "running", args: {} }],
        } as Partial<Message>)}
        isStreaming
      />,
    )
    expect(container.querySelector("span.animate-pulse")).toBeNull()
  })
})

// §4 — THE NARRATION BANNER (ROADMAP collateral surface #2)
describe("§4 StreamingNarration is neither deleted nor restyled", () => {
  it("still folds a blob to its gist when rendered in its own right", () => {
    render(<StreamingNarration content={BLOB} />)
    const trigger = screen.getByTestId("streaming-narration-trigger")
    expect(trigger).toHaveTextContent(ANSWER_P2)
    // Folded at rest: the body is not mounted until the trigger is opened.
    expect(screen.queryByTestId("streaming-narration-body")).toBeNull()
  })

  it("still self-guards on empty content", () => {
    const { container } = render(<StreamingNarration content={"  \n  "} />)
    expect(container.querySelector('[data-testid="streaming-narration"]')).toBeNull()
  })
})

// §5 — THE CITATION BRANCH AND ITS ABSENCE HINT (ROADMAP collateral surface #3)
const CITATIONS: Citation[] = [
  {
    index: 1,
    document_id: "doc-1",
    document_name: "invoice1092.pdf",
    chunk_id: "c-1",
    snippet: "withheld 4,120.00",
  } as Citation,
]

describe("§5 the citation branch and the absence hint keep their gates", () => {
  it("does NOT render the absence hint on a live tool-bearing run — the gate is unchanged", () => {
    renderItem(
      <MessageItem
        message={liveToolBearing({ citations: CITATIONS } as Partial<Message>)}
        isStreaming
      />,
    )
    expect(screen.queryByLabelText("About citations")).toBeNull()
  })

  it("still renders the absence hint on the settled cited answer", () => {
    renderItem(
      <MessageItem
        message={makeMessage({
          runStatus: "completed",
          citations: CITATIONS,
          tool_calls: [
            { id: "tc-1", name: "search_documents", status: "completed", args: {} },
          ],
        } as Partial<Message>)}
      />,
    )
    expect(screen.getByLabelText("About citations")).toBeInTheDocument()
  })

  it("still routes a LIVE cited answer through the citation renderer, not the fold", () => {
    const { container } = renderItem(
      <MessageItem
        message={
          liveToolBearing({
            content: `${ANSWER_P1} [1]`,
            citations: CITATIONS,
          }) as Message
        }
        isStreaming
      />,
    )
    expect(container.querySelector('[data-testid="streaming-narration"]')).toBeNull()
    expect(screen.getByText(/230\.00 gap/)).toBeInTheDocument()
  })
})

// §6 — THE NAVIGATION PATH, DRIVEN THROUGH THE PROVIDER'S OWN CALLBACKS
//
// ⭐ This is the half `BUG-260707-03` residual #2 is actually stated on, and the half no
// existing suite covers from the NAVIGATION direction. `isMessageStreaming` is
// `message.runStatus === "streaming"` — a per-MESSAGE flag. If a run terminates while its
// thread is not the mounted surface and nothing flips that flag off `"streaming"` in the
// bucket, the fold persists on return with no reload to clear it.

const THREAD_ID = "thread-nav"
const OTHER_THREAD = "thread-other"
const RUN_ID = "run-nav"
const CLEAN_ANSWER = "Here is the clean, separated final answer the backend persisted."

function renderProvider() {
  return renderHook(() => useStreamActions(), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <StreamsProvider>{children}</StreamsProvider>
    ),
  })
}

function bucketFor(threadId: string) {
  return useStreamsStore.getState().bucketsBySurface.get("chat")?.get(threadId) ?? []
}

const PERSISTED_TERMINAL = {
  id: "persisted-assistant",
  thread_id: THREAD_ID,
  user_id: "user-1",
  role: "assistant" as const,
  content: CLEAN_ANSWER,
  created_at: "2026-09-11T00:00:00Z",
  updated_at: "2026-09-11T00:00:00Z",
  runId: RUN_ID,
  runStatus: "completed" as const,
  tool_calls: [],
}

describe("§6 the navigation path — a run that finished while the operator was elsewhere", () => {
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
    mockGetActiveRuns.mockResolvedValue([])
    mockCancelRun.mockResolvedValue(undefined)
    mockPostMessage.mockResolvedValue({ run_id: RUN_ID, message_id: "real-user-msg" })
    mockGetSnapshot.mockResolvedValue({ messages: [], active_runs: [], since_cursors: {} })
    mockGetMessages.mockResolvedValue([PERSISTED_TERMINAL])
    mockGetThreadWorkflow.mockResolvedValue({
      locked: false,
      lock_is_stale: false,
      active_workflow_run_id: null,
      cap_paused: false,
      continues_remaining: 0,
      latest_producer_run_id: null,
    })
    mockListThreadTodos.mockResolvedValue([])
  })

  it("6a — a backgrounded run's clean terminal leaves a TERMINAL runStatus and the persisted answer", async () => {
    // The run is discovered by the MOUNT/reconcile path (no sendMessage anywhere), streams
    // its narration+answer blob, and reaches a clean terminal while the operator is looking
    // at a different thread. The subscription mock never resolves, which suppresses the
    // `.finally()` loadMessages floor — so the ONLY thing that can settle this message is
    // the provider's own terminal handling, not a reload.
    mockGetSnapshot.mockResolvedValue({
      messages: [],
      active_runs: [{ run_id: RUN_ID, status: "streaming", started_at: "2026-09-11T00:00:00Z" }],
      since_cursors: {},
    })
    let fire: (() => void) | null = null
    mockSubscribeToRun.mockImplementation(
      async (_rid: string, _since: string, cb: StreamCallbacks) => {
        cb.onDelta?.(`${NARRATION}\n\n`)
        cb.onDelta?.(`${ANSWER_P1}\n\n`)
        cb.onDelta?.(ANSWER_P2)
        fire = () => cb.onTerminal?.("done")
        return new Promise<void>(() => {})
      },
    )

    const { result } = renderProvider()
    await act(async () => {
      result.current.setViewingThread(THREAD_ID)
    })
    await waitFor(() => expect(fire).not.toBeNull())

    // The operator navigates away BEFORE the run ends.
    const awayFrom6a = mockGetSnapshot.mock.calls.length
    await act(async () => {
      result.current.setViewingThread(OTHER_THREAD)
    })
    await waitFor(() =>
      expect(mockGetSnapshot.mock.calls.length).toBeGreaterThan(awayFrom6a),
    )
    // The run finishes while nobody is looking at its thread.
    await act(async () => {
      fire!()
    })

    await waitFor(() => {
      const asst = bucketFor(THREAD_ID).find(
        (m) => m.role === "assistant" && m.runId === RUN_ID,
      )
      expect(asst?.runStatus).toBe("completed")
      expect(asst?.content).toBe(CLEAN_ANSWER)
    })
  })

  it("6b — a run that ended with NO client callback at all settles on navigate-back, with no reload", async () => {
    // The harshest reading of the criterion: the operator navigates away, the run terminates
    // server-side, and this client is told NOTHING (the stream was evicted / the tab was
    // backgrounded past the pool). On return, only `reconcile` can resolve it.
    mockGetSnapshot.mockResolvedValue({
      messages: [],
      active_runs: [{ run_id: RUN_ID, status: "streaming", started_at: "2026-09-11T00:00:00Z" }],
      since_cursors: {},
    })
    mockSubscribeToRun.mockImplementation(
      async (_rid: string, _since: string, cb: StreamCallbacks) => {
        cb.onDelta?.(`${NARRATION}\n\n`)
        cb.onDelta?.(`${ANSWER_P1}\n\n`)
        cb.onDelta?.(ANSWER_P2)
        return new Promise<void>(() => {})
      },
    )

    const { result } = renderProvider()
    await act(async () => {
      result.current.setViewingThread(THREAD_ID)
    })
    await waitFor(() => {
      const asst = bucketFor(THREAD_ID).find(
        (m) => m.role === "assistant" && m.runId === RUN_ID,
      )
      expect(asst?.runStatus).toBe("streaming")
    })

    // Navigate away. No terminal callback will ever arrive for this run.
    const awayFrom6b = mockGetSnapshot.mock.calls.length
    await act(async () => {
      result.current.setViewingThread(OTHER_THREAD)
    })
    await waitFor(() =>
      expect(mockGetSnapshot.mock.calls.length).toBeGreaterThan(awayFrom6b),
    )

    // Server-side the run has since finished and been persisted.
    mockGetSnapshot.mockResolvedValue({
      messages: [PERSISTED_TERMINAL],
      active_runs: [],
      since_cursors: {},
    })

    // Navigate BACK — no reload, no loadMessages by hand. The reconcile it fires is the
    // ONLY thing that can resolve this message.
    const snapCallsBefore = mockGetSnapshot.mock.calls.length
    await act(async () => {
      result.current.setViewingThread(THREAD_ID)
    })
    // The navigate-back reconcile actually ran — otherwise the assertion below would be
    // measuring the in-flight guard rather than the reconcile.
    await waitFor(() =>
      expect(mockGetSnapshot.mock.calls.length).toBeGreaterThan(snapCallsBefore),
    )

    await waitFor(() => {
      const asst = bucketFor(THREAD_ID).find(
        (m) => m.role === "assistant" && m.runId === RUN_ID,
      )
      expect(asst).toBeDefined()
      expect(asst?.runStatus).not.toBe("streaming")
      expect(asst?.content).toBe(CLEAN_ANSWER)
    })
  })
})
