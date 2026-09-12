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
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * ⛔⛔ CORRECTION — Phase 244 plan 12 (G-6, BLOCKER). EVERYTHING ABOVE THIS LINE IS PRESERVED
 * RATHER THAN REWRITTEN, BECAUSE THE DOCBLOCK BEING CONFIDENT AND WRONG IS THE FINDING.
 *
 * This suite was GREEN and the bug it claims to fence was **still live in the product**. Driven
 * 2026-09-12 in Chrome on a REAL workflow-raised approval (200-Word Essay Writer, step 2 "act"),
 * the chat thread rendered NO approval controls and NO paused cue. All three controls measured
 * at `left >= 1103` against the panel's own left edge of `1082` — every one inside the panel.
 * `anyApprovalControlInChatColumn = FALSE`.
 *
 * ⭐ WHY THIS FILE COULD NOT SEE IT: every case above **CONSTRUCTS**
 * `tool_calls: [{ name: "ask_user", status: "running" }]` — the DEEP-AGENT shape — and so proves
 * the component renders WHEN HANDED that shape. It never asks whether the product emits it for a
 * workflow run. The row the harness actually writes is `role="system"` with
 * `tool_calls: [{ kind: "ask_user_prompt" }]`: no `name`, no `status`. **The harness speaks
 * `kind`; `hasPendingAsk` reads `name`/`status`.**
 *
 * ⛔⛔ AND WIDENING THAT PREDICATE WOULD HAVE CLOSED NOTHING — measured at planning, twice,
 * because it is the obvious wrong turn. `backend/app/api/threads.py:427-438` and `:682-691`
 * BOTH apply `.neq("role", "system")` (`BUG-260528-01` — `MessageResponse.role` is
 * `Literal["user","assistant"]` and serializing a system row 500s the whole thread). **No
 * message in the transcript carries the harness carrier shape at all.** A wider predicate would
 * have shipped a SECOND green fence over the same blocker.
 *
 * ⭐ THE FIX IS A MOVE, NOT A PREDICATE. The mount went to LIST level in `MessageList.tsx`, a
 * sibling of `ThreadRunLine` — whose own shipped comment already makes this exact argument for a
 * harness kickoff that inserts no assistant node. `PendingAskStack` is zero-prop and
 * self-resolving, so a pause reaches it through the STORE, with no message to anchor to.
 *
 * ⚠ CONSEQUENCE FOR THIS FILE, stated so a later reader does not "tidy" it back:
 *   · Cases 1, 2, 3 and 5 now render through **`MessageList`**. Their numbers and their claims
 *     are kept; each carries a line saying what its anchor used to be and why it moved.
 *   · Case 4 deliberately KEEPS its bare-`MessageItem` anchor — see its own docblock. It is now
 *     the executable proof that the ROW mounts no stack at all, which is a claim only a
 *     row-level render can make.
 *   · W1-W5 are the new cases. **W1 is the gap**: it seeds through the PRODUCT's own writer path
 *     and carries no ask-bearing message whatsoever.
 * ⛔ NO CASE WAS DELETED. The count gate's contract is *no per-file DECREASE*, and the narrow
 * mount's reasoning is the only written record of a cost that is still true about a per-row mount.
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
import { stripComments } from "@/lib/stripComments.testutil"

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

/**
 * 244-12 (G-6): AN ORDINARY TURN — a user row and an assistant row, and **nothing else**.
 *
 * ⛔ NO `tool_calls` ON EITHER ROW, AND THAT ABSENCE IS THE WHOLE POINT. This is the transcript
 * a WORKFLOW-raised pause actually produces on the wire: the carrier row is `role="system"` and
 * `threads.py`'s `.neq("role","system")` filters it off, so the frontend receives ordinary rows
 * and learns about the pause ONLY through the store. A fixture that hand-builds an `ask_user`
 * tool call is the exact failure this gap is about.
 */
function plainTurn(): Message[] {
  return [
    {
      id: "m-plain-user",
      thread_id: THREAD,
      user_id: "u-1",
      role: "user",
      content: "Write the essay and email it to procurement.",
      created_at: "2026-09-11T08:59:00Z",
      updated_at: "2026-09-11T08:59:00Z",
    },
    {
      id: "m-plain-assistant",
      thread_id: THREAD,
      user_id: "u-1",
      role: "assistant",
      content: "Starting the workflow.",
      created_at: "2026-09-11T08:59:30Z",
      updated_at: "2026-09-11T08:59:30Z",
      runStatus: "completed",
    },
  ] as Message[]
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
    // ⚠ 244-12 RE-AIMED IN PLACE. This case's anchor was a BARE `<MessageItem>`; it now renders
    // through `<MessageList>`. The claim is unchanged — cue and actions, together, on a paused
    // Deep turn — but the controls are no longer the ROW's to render, so a row-level render
    // would now assert a mount that was deliberately removed.
    wrap(<MessageList messages={[assistantRow()]} isStreaming threadId={THREAD} />)

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

  it("2 — a row whose OWN run is not streaming renders no inline CUE, and does not OWN the controls", async () => {
    // ⚠ 244-12 RE-AIMED IN PLACE, and the re-aim is a real change of claim rather than a change
    // of anchor. The original read "renders no approval controls", which was a statement about
    // the per-row mount. That mount is gone: the controls now come from LIST level and are
    // present here. What SURVIVES the move — and is still worth fencing — is that the per-row
    // narrowing still governs the CUE, and that the row does not own the controls.
    // ⚠ The real gate for the cue is `message.runStatus === "streaming"` (MessageItem's own
    // `isMessageStreaming`), NOT the `isStreaming` prop — which is deliberately passed TRUE
    // here so the case cannot pass for the wrong reason.
    wrap(
      <MessageList
        messages={[assistantRow({ id: "m-old", runStatus: "completed" })]}
        isStreaming
        threadId={THREAD}
      />,
    )

    // The controls ARE on the page — from the list-level mount, fed by the store.
    const approve = await screen.findByRole("radio", { name: APPROVE })
    // …and the inline cue is NOT, because this row's own run is not streaming.
    expect(screen.queryByText("ask_user · awaiting your answer")).toBeNull()

    // ⛔ THE CONTROLS ARE NOT INSIDE THE ROW. Positive control first: the row must actually be
    // on the page, or the containment check below would be a claim about nothing.
    const rows = Array.from(document.querySelectorAll('[data-testid="assistant-message"]'))
    expect(rows.length).toBeGreaterThan(0)
    for (const row of rows) expect(row.contains(approve)).toBe(false)
  })

  it("3 — SIX rows cost exactly what ONE row costs (the C-3 cost fence)", async () => {
    // ⚠ 244-12: this case ALREADY rendered through `MessageList`, so its anchor did not move —
    // but its meaning did. It used to prove that a NARROW per-row mount did not multiply; it now
    // proves that a LIST-LEVEL mount cannot, by construction. ⛔ It is kept rather than replaced
    // by W3: this case drives the DEEP shape (a row carrying the ask), W3 drives the WORKFLOW
    // shape (no ask-bearing row at all), and the cost property has to hold on both.
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

  it("4 — the ROW ITSELF mounts no stack and buys no fetch — not for a settled ask, and not for a live one", async () => {
    // ⚠ 244-12 — THIS CASE DELIBERATELY KEEPS ITS BARE-`MessageItem` ANCHOR, and that is a
    // decision rather than an oversight. 244-12's plan asked for cases 1-5 to be re-aimed
    // through `MessageList`; doing so HERE would have required emptying the store to keep the
    // "nothing renders" half true, at which point the case would pass because there was nothing
    // to render — the precise failure mode this whole gap is about — and it would duplicate W4.
    // Kept at row level, it is instead the EXECUTABLE FORM OF TASK 2's REMOVAL: the row mounts
    // no `PendingAskStack`, so it buys no `getThreadPendingAsks`, and that is a claim only a
    // row-level render can make. The LIST-level cost is W4's to publish.
    wrap(
      <MessageItem
        message={assistantRow({
          // ⚠ `"done"`, not `"completed"` — `ToolCall.status` is
          // `"preparing" | "running" | "done" | "interrupted"`, and `hasPendingAsk` matches
          // only the middle two. The first draft of this case used `"completed"`, which
          // typechecks nowhere and would have made the case pass for a reason unrelated to
          // the arm it is testing.
          tool_calls: [{ id: "tc-done", name: "ask_user", status: "done", args: {} }],
        })}
        isStreaming
        isLastAssistant
      />,
    )

    await waitFor(() => expect(screen.queryByRole("button", { name: "Send Answer" })).toBeNull())
    expect(getThreadPendingAsks).not.toHaveBeenCalled()

    // ⛔ AND THE SHARP HALF, added by 244-12: the SAME is true of a row carrying a LIVE ask —
    // the shape that used to mount the stack. The row renders its cue and nothing else.
    cleanup()
    wrap(<MessageItem message={assistantRow()} isStreaming isLastAssistant />)
    expect(await screen.findByText("ask_user · awaiting your answer")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Send Answer" })).toBeNull()
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
    // ⚠ 244-12 RE-AIMED IN PLACE: the anchor moved from a bare `<MessageItem>` to
    // `<MessageList>`, because that is where the chat column's approval surface now lives. The
    // claim is unchanged.
    wrap(
      <>
        <MessageList messages={[assistantRow()]} isStreaming threadId={THREAD} />
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

describe("G-6 (244-12, BLOCKER) — the shape the PRODUCT writes, not the shape a test builds", () => {
  it("W1 — a WORKFLOW-raised pause reaches the chat column with NO ask-bearing message at all", async () => {
    // ⛔ THE GAP, EXECUTABLE. Every case above hands the component a constructed
    // `tool_calls: [{ name: "ask_user", status: "running" }]`. The harness writes no such row to
    // the transcript — its carrier is `role="system"` and `threads.py` filters it off the wire —
    // so this case carries NO ask-bearing message whatsoever and learns about the pause exactly
    // the way the product does.
    //
    // ⛔ SEEDED THROUGH THE PRODUCT'S OWN WRITER. The slice starts EMPTY; `useAskUserPrompt`
    // mounts `usePanelReconcile`, whose `fetcher` IS `getThreadPendingAsks`, and the resolved
    // rows are written by `replacePendingAsksForThread`. That is the thread-open path the
    // operator drove — not a hand-written store value, and certainly not a hand-written message.
    useStreamsStore.setState({ pendingAsksByThread: new Map() })

    const messages = plainTurn()
    // The negative control that makes this case about the PRODUCT's shape rather than about a
    // convenient fixture: assert the absence BEFORE rendering, so it cannot be argued after.
    for (const m of messages) expect(m.tool_calls).toBeUndefined()

    wrap(<MessageList messages={messages} isStreaming={false} threadId={THREAD} />)

    // ⚠ THE RENDERED CONTROL WORDS, never a `data-testid`. `BUG-260828-07`'s complaint was
    // literally "it looked right and did nothing", which a presence assertion cannot see.
    expect(await screen.findByRole("radio", { name: APPROVE })).toBeInTheDocument()
    expect(screen.getByRole("radio", { name: DECLINE })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Send Answer" })).toBeInTheDocument()
    // …and the question, so the column cannot offer controls for an invisible prompt.
    expect(screen.getByText(ASK.prompt)).toBeInTheDocument()
    // …written by the product's fetcher, which is the half that makes the seeding honest.
    expect(getThreadPendingAsks).toHaveBeenCalled()
  })

  it("W2 — the DEEP path is not traded away, and the pause renders EXACTLY ONE set of controls", async () => {
    // ⛔ BOTH MUST HOLD. A fix that swaps one unreachable path for another is not a fix, and a
    // fix that leaves BOTH mounts in place gives one decision two homes in the same column —
    // "actionable twice and agreed in neither", the ROADMAP's own named failure mode. The
    // `getAllBy…` length assertions are what distinguish the two outcomes.
    wrap(<MessageList messages={[assistantRow()]} isStreaming threadId={THREAD} />)

    expect(await screen.findByText("ask_user · awaiting your answer")).toBeInTheDocument()
    expect(screen.getAllByRole("radio", { name: APPROVE })).toHaveLength(1)
    expect(screen.getAllByRole("radio", { name: DECLINE })).toHaveLength(1)
    expect(screen.getAllByRole("button", { name: "Send Answer" })).toHaveLength(1)
  })

  it("W3 — SIX ordinary rows cost exactly what ONE costs, on the WORKFLOW shape", async () => {
    // C-3's measurement, re-driven AT THE NEW SITE rather than assumed by it. This is the
    // property that made the original mount narrow; a list-level mount should make it
    // structural, and "should" is not a fence.
    const single = wrap(
      <MessageList messages={plainTurn()} isStreaming={false} threadId={THREAD} />,
    )
    await screen.findByRole("radio", { name: APPROVE })
    const oneTurnCalls = getThreadPendingAsks.mock.calls.length
    single.unmount()
    getThreadPendingAsks.mockClear()

    const many: Message[] = Array.from({ length: 6 }, (_, i) => ({
      id: `m-w3-${i}`,
      thread_id: THREAD,
      user_id: "u-1",
      role: i % 2 === 0 ? "user" : "assistant",
      content: `turn ${i}`,
      created_at: `2026-09-11T08:0${i}:00Z`,
      updated_at: `2026-09-11T08:0${i}:00Z`,
      runStatus: "completed",
    })) as Message[]

    wrap(<MessageList messages={many} isStreaming={false} threadId={THREAD} />)
    await screen.findByRole("radio", { name: APPROVE })

    // ⛔ AN EQUALITY AGAINST A CONTROL, never a literal — a literal encodes a per-mount constant
    // this project has already measured wrong once (see the header). The property that matters
    // is that the cost does not scale with ROW COUNT.
    expect(getThreadPendingAsks.mock.calls.length).toBe(oneTurnCalls)
    expect(getThreadPendingAsks.mock.calls.length).toBeLessThan(6)
  })

  it("W4 — no pause: nothing renders — and the unconditional mount's REAL cost is asserted, not hidden", async () => {
    // ⚠ THE MEASURED TRUTH RATHER THAN THE CONVENIENT ONE. The list-level mount is
    // UNCONDITIONAL, so it buys `getThreadPendingAsks` on EVERY thread open — including threads
    // that will never pause. The Deep path previously bought zero there. That regression is
    // REAL, it was accepted deliberately (every gate on this mount is a narrowing mount
    // condition, and a narrowing mount condition is what made SHELL-03 unreachable twice over),
    // and this case ASSERTS it rather than writing an assertion that would hide it.
    //
    // ⚠ THE REAL FIGURE, measured 2026-09-12 by toggling this exact mount off and on against
    // this exact fixture — NOT the plan's "roughly 2-4" estimate, which understated it:
    //     getThreadPendingAsks  0 -> 2      (useAskUserPrompt's usePanelReconcile)
    //     getThreadWorkflow     1 -> 3      (PendingAskStack's usePhases -> reconcilePhases)
    //   ⇒ +4 fetches per THREAD OPEN, on every thread, pause or no pause.
    // ⛔ The assertions below deliberately bind the SHAPE of the cost (non-zero, and identical
    // with and without a pause) rather than the literal 2 — a literal encodes a per-mount
    // constant this project has already measured wrong once. The literal lives here and in
    // 244-12-SUMMARY.md, where a reader can see it rot.
    useStreamsStore.setState({ pendingAsksByThread: new Map() })
    getThreadPendingAsks.mockResolvedValue([])

    const noPause = wrap(
      <MessageList messages={plainTurn()} isStreaming={false} threadId={THREAD} />,
    )
    await waitFor(() => expect(getThreadPendingAsks).toHaveBeenCalled())
    expect(screen.queryByRole("radio", { name: APPROVE })).toBeNull()
    expect(screen.queryByRole("button", { name: "Send Answer" })).toBeNull()
    expect(screen.queryByText("ask_user · awaiting your answer")).toBeNull()
    const noPauseCalls = getThreadPendingAsks.mock.calls.length
    // ⛔ NON-ZERO. This is the bought fetch, named.
    expect(noPauseCalls).toBeGreaterThan(0)

    noPause.unmount()
    getThreadPendingAsks.mockClear()
    getThreadPendingAsks.mockResolvedValue([ASK])

    wrap(<MessageList messages={plainTurn()} isStreaming={false} threadId={THREAD} />)
    await screen.findByRole("radio", { name: APPROVE })

    // …and it is the SAME cost with and without a pause, which is what "unconditional" means
    // and what bounds the regression: one mount per thread, never one per row and never a
    // second one when a pause appears.
    expect(noPauseCalls).toBe(getThreadPendingAsks.mock.calls.length)
  })

  it("W5 — the settle is STRUCTURAL on the SSE path too: one slice, both readers, no second fetch", async () => {
    // Case 5 drives the store's `replace` (the reconcile path). This drives the OTHER product
    // writer: `onAskUserPrompt` → `addPendingAskForThread` and `onAskUserResponse` →
    // `removePendingAskForThread` (`StreamsProvider.tsx:1165-1168`). Both writers feed the ONE
    // slice both homes read, which is what makes "answering in either home settles both"
    // structural rather than synchronised.
    function SiblingReader() {
      const { data } = useAskUserPrompt(THREAD)
      return <div data-testid="sibling-sse">{data.length === 0 ? "settled" : data[0].prompt}</div>
    }

    useStreamsStore.setState({ pendingAsksByThread: new Map() })
    getThreadPendingAsks.mockResolvedValue([])

    wrap(
      <>
        <MessageList messages={plainTurn()} isStreaming={false} threadId={THREAD} />
        <SiblingReader />
      </>,
    )
    await waitFor(() => expect(screen.getByTestId("sibling-sse")).toHaveTextContent("settled"))
    expect(screen.queryByRole("radio", { name: APPROVE })).toBeNull()
    const callsAfterMount = getThreadPendingAsks.mock.calls.length

    // The SSE prompt arrives.
    useStreamsStore.getState().actions.addPendingAskForThread(THREAD, ASK)
    expect(await screen.findByRole("radio", { name: APPROVE })).toBeInTheDocument()
    expect(screen.getByTestId("sibling-sse")).toHaveTextContent(ASK.prompt)

    // The answer lands — from EITHER home; the wire event is the same one.
    useStreamsStore.getState().actions.removePendingAskForThread(THREAD, ASK.tool_call_id)
    await waitFor(() => expect(screen.queryByRole("radio", { name: APPROVE })).toBeNull())
    expect(screen.getByTestId("sibling-sse")).toHaveTextContent("settled")

    // ⛔ Neither the arrival nor the settle went back to the wire.
    expect(getThreadPendingAsks.mock.calls.length).toBe(callsAfterMount)
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
    // …and the chat column mounts it exactly ONCE — at LIST level, not per row.
    // ⚠ 244-12 INVERTED THIS ASSERTION, and the reason is worth more than the assertion.
    // It used to read `toHaveLength(1)` against `MessageItem.tsx`. After the mount moved, a
    // PROSE mention of the identifier in MessageItem's own "it was here and is gone" comment
    // kept that count at 1 — so the fence went on passing while the thing it counted had left
    // the file. A source fence that counts a token cannot tell code from a comment; the only
    // repair is to count in the file that now OWNS the mount and to assert ZERO in the one that
    // does not. Both directions are asserted, with a non-empty positive control on each.
    //
    // ⛔ 244-14 (review IN-02) — AND BOTH SIDES ARE NOW COUNTED WITH THE COMMENTS REMOVED.
    // The repair above made the ZERO side immune and left the ONE side carrying the identical
    // hazard one file over: a future comment in `MessageList.tsx` that happens to spell the
    // opening bracket holds the count at 1 with the mount DELETED. DRIVEN, not reasoned —
    // the mount was removed from `MessageList.tsx` and replaced by a comment naming it, and
    // this case stayed GREEN; with `stripComments` it goes red, and the file was restored
    // md5-identical afterwards. The normaliser is the SHARED one
    // (`@/lib/stripComments.testutil`), reused rather than re-implemented, because the fix for
    // "two copies of a rule drift" must not itself be a second copy of a rule.
    const item = stripComments((await import("../MessageItem.tsx?raw")).default as string)
    const list = stripComments((await import("../MessageList.tsx?raw")).default as string)
    expect(item.length).toBeGreaterThan(1000)
    expect(list.length).toBeGreaterThan(1000)
    expect([...item.matchAll(/<PendingAskStack/g)]).toHaveLength(0)
    expect(
      [...list.matchAll(/<PendingAskStack/g)],
      "the list-level mount is gone from MessageList.tsx — the chat column renders no approval",
    ).toHaveLength(1)
    // …and the CUE stayed behind, which is what makes the split deliberate rather than a move
    // of everything.
    expect([...item.matchAll(/<PausedRunCue/g)]).toHaveLength(1)
  })
})
