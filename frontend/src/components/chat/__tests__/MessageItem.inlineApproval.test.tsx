/**
 * Phase 244 plan 03 Task 2 (SHELL-03 / BUG-260828-07, severity HIGH) — the approval is
 * answerable IN THE THREAD.
 *
 * ⛔ THE DEFECT. Driving an armed approval, the operator saw the same pause in both homes with
 * different controls: the workflow panel offered `Approve this step` / `Do not run it` / a
 * reason field / `Send Answer`; the chat thread rendered the question text and **no buttons**.
 * *"A human gate that appears without its controls is worse than one that does not appear: it
 * tells the operator a decision is required and then offers no way to make it. The run sat
 * until it was stopped."* The chat already had the CUE (`PausedRunCue`) — what it lacked was
 * the controls beside it.
 *
 * ⭐ THE FIX IS A MOUNT, NOT A RENDERER. `PendingAskStack` is shipped, zero-prop and
 * self-resolving; it goes INSIDE the existing `hasPendingAsk(message.tool_calls) && …` arm.
 * ⛔ Never a chat-native second renderer of the same pause — that is D-244-11's rejected arm,
 * the Phase 095 build-once inventory rule, and `SEED-219`'s complaint. Two renderers of one
 * decision is how the two homes came to disagree in the first place.
 *
 * ⛔ C-3 — "a third reader is free" IS REFUTED, AND THAT IS WHY THE MOUNT SITE MATTERS.
 * `useAskUserPrompt` is NOT a bare store selector: it mounts `usePanelReconcile`, which fires
 * a REAL `getThreadPendingAsks` fetch per mount on the `[threadId]` effect. `PendingAskStack`
 * also calls `usePhases` → a SECOND `usePanelReconcile`. The early
 * `if (asks.length === 0) return null` cannot save it — hooks run BEFORE the return.
 * `MessageList` renders one `MessageItem` per message with **no virtualisation**, so a
 * top-level mount would be 2 fetches × N ROWS. This codebase already measured and closed the
 * identical cost for `usePhases` (`MessageItem.tsx:180-188`: *"measured at 6 rows: 6 calls,
 * versus 1 with this component"*), and `HarnessOuterBanner` is the analog copied here.
 * **Case 3 below is the executable form of that docblock**, and it was driven RED against a
 * planted top-level mount.
 *
 * ⚠ MEASURED WHILE BUILDING THAT FENCE, and it makes C-3's arithmetic an UNDERSTATEMENT
 * rather than an overstatement — recorded beside the original, never over it. C-3 costs the
 * mount at "2 fetches on one row", one per `usePanelReconcile`. **A single `PendingAskStack`
 * mount was measured firing `getThreadPendingAsks` TWICE** (probe: 1 stack → 2 calls;
 * 3 stacks → 7). So the hook fires twice per mount, and a top-level mount would be ~4 ask
 * fetches PER ROW, not 2. The conclusion is unchanged and strengthened; only the constant was
 * wrong. ⛔ Case 3 therefore asserts an EQUALITY against a one-row control instead of a
 * literal — a literal encodes a per-mount constant that has already been measured wrong once,
 * and the property that actually matters is that the cost does not scale with ROW COUNT.
 *
 * ⚠ WHAT NARROWS IT, measured rather than inherited. The plan's `<interfaces>` says the arm is
 * narrowed by `MessageList.tsx:237` passing `isStreaming={isStreaming && isLastAssistant}`.
 * **Measured: that is not the gate.** `MessageItem.tsx` derives its own
 * `isMessageStreaming = message.runStatus === "streaming"` and the arm reads THAT. The
 * narrowing is per-message run status, not the parent's prop — a distinction that matters
 * because it means the bound survives a caller that passes `isStreaming` differently. Case 2
 * drives the real gate.
 *
 * ⚠ WHAT THIS SUITE DOES NOT CLOSE. `D-244-14` binds the closing evidence for SHELL-03 to a
 * **driven both-directions** row in `244-VALIDATION.md`: a real armed approval, answered from
 * the thread and seen settled in the panel, then the reverse. A synthetic mount test proves
 * MOUNTING, never ANSWERING. This file claims no part of that row.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, cleanup, waitFor } from "@testing-library/react"

const { getThreadPendingAsks, getThreadWorkflow } = vi.hoisted(() => ({
  getThreadPendingAsks: vi.fn(),
  getThreadWorkflow: vi.fn(),
}))

// ⚠ Spread the ACTUAL module — a mock factory is an ALLOW-LIST and an omitted export throws at
// import binding, which is what turned nine unrelated suites red in Phase 196.
vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual, getThreadPendingAsks, getThreadWorkflow }
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
import { MessageList } from "../MessageList"
import { PendingAskStack, default as PendingAskCard } from "@/components/panel/PendingAskCard"
import { StreamsProvider, useAskUserPrompt } from "@/providers/StreamsProvider"
import { TooltipProvider } from "@/components/ui/tooltip"
import { useStreamsStore } from "@/stores/streamsStore"
import type { Message, PendingAsk } from "@/types"

const THREAD = "thread-approval"

/** The two actions the PANEL offers, verbatim from BUG-260828-07's own transcript. */
const APPROVE = "Approve this step"
const DECLINE = "Do not run it"

const ASK: PendingAsk = {
  tool_call_id: "tc-approve-1",
  prompt: "Send the Q4 pricing sheet to procurement@meridian.example?",
  options: [APPROVE, DECLINE],
  timeout_seconds: null,
  run_id: "run-approval-1",
  created_at: "2026-09-11T09:00:00Z",
}

function assistantRow(over: Partial<Message> = {}): Message {
  return {
    id: "m-ask",
    thread_id: THREAD,
    user_id: "u-1",
    role: "assistant",
    content: "Checking the sheet before I send it.",
    created_at: "2026-09-11T09:00:00Z",
    updated_at: "2026-09-11T09:00:00Z",
    runStatus: "streaming",
    tool_calls: [
      { id: "tc-approve-1", name: "ask_user", status: "running", args: {} },
    ],
    ...over,
  } as Message
}

function wrap(ui: React.ReactElement) {
  return render(
    <StreamsProvider>
      <TooltipProvider>{ui}</TooltipProvider>
    </StreamsProvider>,
  )
}

// ⚠ jsdom implements no `scrollIntoView`, and `MessageList`'s follow-scroll effect calls it on
// mount — without this stub case 3 dies with `TypeError: … is not a function` before the fetch
// count can be read. ⛔ It is a MOUNT ENABLER, nothing more: this suite asserts no scroll
// behaviour, and the project's own note about `MessageList.test.tsx` stubbing this tree-wide
// (and thereby blinding itself to the scroll effect) is the reason that scope is stated here
// rather than left for a later reader to discover.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function () {}
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  getThreadPendingAsks.mockResolvedValue([ASK])
  getThreadWorkflow.mockResolvedValue({ mode: "deep", active_workflow_run_id: null, phases: null })
  useStreamsStore.setState({
    viewedThreadId: THREAD,
    pendingAsksByThread: new Map([[THREAD, [ASK]]]),
    phasesByThread: new Map(),
    workflowLockByThread: new Map(),
    reconcileErrors: new Map(),
    streamingThreads: new Set<string>(),
    loadingThreads: new Set<string>(),
    subscriptionsByThread: new Map<string, Set<string>>(),
  })
})

afterEach(() => cleanup())

describe("SHELL-03 / BUG-260828-07 — the controls join the cue, inline at the paused message", () => {
  it("1 — the paused row renders the cue AND the panel's two actions, by their LABELS", async () => {
    wrap(<MessageItem message={assistantRow()} isStreaming isLastAssistant />)

    // The shipped cue is unchanged and still there — this is additive, not a replacement.
    expect(await screen.findByText("ask_user · awaiting your answer")).toBeInTheDocument()

    // ⚠ THE ACTIONS, BY THE WORDS THE PANEL RENDERS — not by a `data-testid`. The complaint
    // in BUG-260828-07 is literally "it looked right and did nothing"; a presence assertion
    // cannot see content drift, which is this project's own repeated finding.
    expect(await screen.findByRole("radio", { name: APPROVE })).toBeInTheDocument()
    expect(screen.getByRole("radio", { name: DECLINE })).toBeInTheDocument()
    // …and the control that actually dispatches the decision.
    expect(screen.getByRole("button", { name: "Send Answer" })).toBeInTheDocument()
    // The question itself, so the row cannot render controls for an invisible prompt.
    expect(screen.getByText(ASK.prompt)).toBeInTheDocument()
  })

  it("2 — a row whose OWN run is not streaming renders no approval controls", async () => {
    // ⚠ The real gate is `message.runStatus === "streaming"` (MessageItem's own
    // `isMessageStreaming`), NOT the `isStreaming` prop — which is deliberately passed TRUE
    // here so the case cannot pass for the wrong reason.
    wrap(
      <MessageItem
        message={assistantRow({ id: "m-old", runStatus: "completed" })}
        isStreaming
        isLastAssistant
      />,
    )

    await waitFor(() => expect(screen.queryByText("ask_user · awaiting your answer")).toBeNull())
    expect(screen.queryByRole("radio", { name: APPROVE })).toBeNull()
    expect(screen.queryByRole("button", { name: "Send Answer" })).toBeNull()
    expect(getThreadPendingAsks).not.toHaveBeenCalled()
  })

  it("3 — SIX rows cost exactly what ONE row costs (the C-3 cost fence)", async () => {
    const older: Message[] = Array.from({ length: 5 }, (_, i) => ({
      id: `m-${i}`,
      thread_id: THREAD,
      user_id: "u-1",
      role: i % 2 === 0 ? "user" : "assistant",
      content: `turn ${i}`,
      created_at: "2026-09-11T08:0" + i + ":00Z",
      updated_at: "2026-09-11T08:0" + i + ":00Z",
      runStatus: "completed",
    })) as Message[]

    // ── The control: ONE row, which is the irreducible cost of mounting the stack at all.
    const single = wrap(
      <MessageList messages={[assistantRow()]} isStreaming threadId={THREAD} />,
    )
    await screen.findByRole("radio", { name: APPROVE })
    const oneRowCalls = getThreadPendingAsks.mock.calls.length
    single.unmount()
    getThreadPendingAsks.mockClear()

    // ── The measurement: SIX rows, only the last of which carries a live ask.
    wrap(<MessageList messages={[...older, assistantRow()]} isStreaming threadId={THREAD} />)
    await screen.findByRole("radio", { name: APPROVE })

    // ⛔ THE INVARIANT IS ROW-INDEPENDENCE, not a magic number — deliberately asserted as an
    // EQUALITY against the one-row control rather than against a literal. A literal would
    // rot the moment `usePanelReconcile`'s per-mount cost changed, and would then be
    // "corrected" by someone reading it as drift instead of as the cost multiplying.
    expect(getThreadPendingAsks.mock.calls.length).toBe(oneRowCalls)
    // …and concretely below one-per-row, so a regression cannot hide inside the equality.
    expect(getThreadPendingAsks.mock.calls.length).toBeLessThan(6)
  })

  it("4 — a row with no PENDING ask mounts nothing and buys no fetch", async () => {
    wrap(
      <MessageItem
        message={assistantRow({
          tool_calls: [
            { id: "tc-done", name: "ask_user", status: "completed", args: {} },
          ],
        })}
        isStreaming
        isLastAssistant
      />,
    )

    await waitFor(() => expect(screen.queryByRole("button", { name: "Send Answer" })).toBeNull())
    expect(getThreadPendingAsks).not.toHaveBeenCalled()
  })

  it("5 — the settle is STRUCTURAL: a second reader sees the same slice, at no second fetch", async () => {
    // D-244-11: one store slice, one reconcile, nothing to keep in sync. A sibling reader
    // mounted beside the chat card reads the SAME `pendingAsksByThread` entry; when the slice
    // is emptied (which is what answering does, via the ask_user_response SSE dispatch) BOTH
    // surfaces clear together because there is only one source.
    function SiblingReader() {
      const { data } = useAskUserPrompt(THREAD)
      return <div data-testid="sibling">{data.length === 0 ? "settled" : data[0].prompt}</div>
    }
    wrap(
      <>
        <MessageItem message={assistantRow()} isStreaming isLastAssistant />
        <SiblingReader />
      </>,
    )

    await screen.findByRole("radio", { name: APPROVE })
    expect(screen.getByTestId("sibling")).toHaveTextContent(ASK.prompt)
    const callsBefore = getThreadPendingAsks.mock.calls.length

    // Settle it the way the SSE dispatch does — replace the thread's slice.
    useStreamsStore.getState().actions.replacePendingAsksForThread(THREAD, [])

    await waitFor(() => expect(screen.getByTestId("sibling")).toHaveTextContent("settled"))
    expect(screen.queryByRole("radio", { name: APPROVE })).toBeNull()
    // ⛔ No re-fetch on either side — the settle travelled through the store, not the wire.
    expect(getThreadPendingAsks.mock.calls.length).toBe(callsBefore)
  })
})

describe("D-244-13 — the cross-surface shell's OTHER TWO homes still render their shipped copy", () => {
  /**
   * `PendingAskCard.tsx` is a cross-surface shell. `WorkspacePanel` mounts the STACK;
   * `WorkflowRunPage.tsx:1629` mounts the CARD DIRECTLY with its own ordering and its own
   * `runIsOver` (`isTerminal`) — so an edit to the card lands in three places, not one.
   * ⚠ C-4 corrects CONTEXT here: there was exactly ONE `PendingAskStack` mount before this
   * plan, not two. The chat mount is the SECOND stack and the THIRD concurrent
   * `useAskUserPrompt` reader in the tree.
   *
   * ⚠ SCOPE, stated rather than implied: these cases render the COMPONENTS the two homes
   * mount, not the pages. The page-level mount sites are asserted structurally below, which is
   * the half a render cannot cover.
   */
  it("6a — PendingAskStack (WorkspacePanel's mount) renders the question and both actions", async () => {
    wrap(<PendingAskStack />)
    expect(await screen.findByText(ASK.prompt)).toBeInTheDocument()
    expect(screen.getByRole("radio", { name: APPROVE })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Send Answer" })).toBeInTheDocument()
    expect(screen.getByText("Needs you")).toBeInTheDocument()
  })

  it("6b — PendingAskCard mounted DIRECTLY (WorkflowRunPage's shape) renders the same copy", async () => {
    wrap(
      <PendingAskCard ask={ASK} reconcile={vi.fn()} runIsOver={false} />,
    )
    expect(await screen.findByText(ASK.prompt)).toBeInTheDocument()
    expect(screen.getByRole("radio", { name: APPROVE })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Send Answer" })).toBeInTheDocument()
  })

  it("6c — both page mount sites still exist in source", async () => {
    // ⚠ A `?raw` source fence, because a render cannot see a page that stopped mounting the
    // component. Both are asserted NON-EMPTY first — a vacuous parse is how a `?raw` fence
    // passes while seeing nothing.
    const panel = (await import("@/components/panel/WorkspacePanel.tsx?raw")).default as string
    const runPage = (await import("@/pages/WorkflowRunPage.tsx?raw")).default as string
    expect(panel.length).toBeGreaterThan(1000)
    expect(runPage.length).toBeGreaterThan(1000)
    expect(panel).toContain("<PendingAskStack")
    expect(runPage).toContain("<PendingAskCard")
    // …and the chat mount is exactly ONE render site, inside the hasPendingAsk arm.
    const item = (await import("../MessageItem.tsx?raw")).default as string
    expect(item.length).toBeGreaterThan(1000)
    expect([...item.matchAll(/<PendingAskStack/g)]).toHaveLength(1)
  })
})
