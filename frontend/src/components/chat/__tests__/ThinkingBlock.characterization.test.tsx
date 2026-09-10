/**
 * Phase 243 Plan 01 (CHAT-01 / CHAT-04 / D-243-16) — the PRE-EXTRACTION characterization net
 * for the thinking block.
 *
 * ⚠ THIS SUITE IS WRITTEN BEFORE ANYTHING MOVES, AND THAT IS ITS ENTIRE VALUE. Measured at
 * this base: `grep -rn "thinking-trigger|thinking-row"` across every suite in the tree returns
 * ZERO matches, so "the extraction changed no pixel" is today an ASSERTION and not a
 * MEASUREMENT. Plan 243-02 moves the thinking block out of `RunCard` and mounts it from
 * `MessageItem`; every case below must STILL PASS across that move, unedited. An edited fence
 * proves nothing about a move.
 *
 * ⭐ WHY THESE CASES RENDER `<MessageItem>` AND NOT THE CARD THEY CURRENTLY LIVE IN. A net
 * anchored to the component the code LEAVES cannot certify that the code moved safely. The
 * project's own precedent is one phase old: `src/__tests__/components/MessageItem.clamp.test.tsx`
 * imports `MessageItem`, not `UserMessageBubble`, which is exactly why the Phase 227 clamp cases
 * survived the bubble being extracted OUT of `MessageItem`. Only §6 anchors to the card, and
 * only because 243-02 explicitly LEAVES the planning placeholder and the elapsed segment there.
 *
 * ⛔ THE ONE PLAN PERMITTED TO CHANGE ANY OF THIS IS 243-04, and only two cases:
 *   • §5 (the body's class tokens) — sketch 234's V1 diff drops `font-mono`,
 *     `whitespace-pre-wrap`, `max-h-64` and `overflow-y-auto`, and moves `text-xs` → `text-sm`.
 *     `border-l-2` and `ml-3` STAY. Reason: the shipped body is a nested scroller in a
 *     monospaced voice; the sketch's winner is prose in the page's own scroll.
 *   • §2 / §1a (the trigger label) — `Thinking` / `Thinking...` becomes `Thought for N seconds`
 *     under D-243-13, which also has to find that number an honest source first.
 * Any other plan turning one of these red has changed a pixel it did not mean to.
 *
 * ⚠ TWO CASES PIN A DEFECT ON PURPOSE — §8 and §9. They assert what is WRONG today so that
 * 243-02's inversion is a MEASURED improvement rather than a side effect. Neither is ever to
 * be read as desired behaviour.
 *
 * ⚠ THE SETTLED/STREAMING SPLIT IS LOAD-BEARING, NOT A STYLE CHOICE. `RunCard` gates its whole
 * body behind `expanded = isStreamingNow || !hasTools || userExpanded`, and `MessageItem` mounts
 * the card ONLY for a turn with tool calls — so through that boundary `hasTools` is always true
 * and a SETTLED turn renders no thinking block at all until the collapsed run row is clicked.
 * Every settled case below therefore expands first (§1, §4, §5, §7, §9); the streaming cases
 * (§2, §3) must NOT, because `isStreamingNow` already makes `expanded` true. A settled case that
 * asserted without expanding would be asserting against an UNRENDERED subtree — it would pass
 * with the logic entirely broken, which is the vacuous-fence failure this phase exists to avoid.
 */
import { describe, it, expect, afterEach, vi } from "vitest"
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react"
import { TooltipProvider } from "@/components/ui/tooltip"
import { MessageItem } from "@/components/chat/MessageItem"
import { RunCard } from "@/components/chat/RunCard"
import type { Message, ToolCall } from "@/types"

const NOW = new Date().toISOString()

/** The house harness, copied verbatim from RunCard.characterization.test.tsx:55-57 —
 *  TooltipProvider and nothing else. No router, no provider, no store. */
function renderWithTooltip(ui: React.ReactElement) {
  return render(<TooltipProvider>{ui}</TooltipProvider>)
}

/** Local fixture factory, modelled on RunCard.characterization.test.tsx:28-53. There is no
 *  shared fixture module in this tree and this suite does not invent one. */
function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: "msg-thinking-1",
    thread_id: "thread-1",
    user_id: "user-1",
    role: "assistant",
    content: "Assistant response text",
    created_at: NOW,
    updated_at: NOW,
    model: "deepseek-reasoner",
    provider: "deepseek",
    tool_calls: [
      {
        id: "tc-1",
        name: "search_documents",
        args: { query: "knowledge" },
        status: "done",
        result: JSON.stringify([{ id: "doc-1", title: "Doc 1" }]),
        startedAt: 1_000_000,
        endedAt: 1_001_500,
      } as ToolCall,
    ],
    ...overrides,
  } as Message
}

/**
 * D-243-03 measured the reasoning corpus on this machine: median 198 chars, max 33,713 — a
 * 170× spread. A suite that exercises one end has not exercised the design, so both ends are
 * fixtures here. The median one CARRIES NEWLINES deliberately: `whitespace-pre-wrap` is one of
 * the four classes 243-04 drops, and the prose has to be asserted verbatim, newlines included.
 */
const REASONING_MEDIAN = [
  "The user is asking about the retention policy.",
  "I should search the knowledge base for the current document before answering,",
  "because the policy was revised and my memory is not a source I can cite.",
].join("\n") // measured: 197 chars — one off the corpus median of 198

/** Built programmatically — 33 KB is not pasted into a tracked file.
 *  Measured: 32,951 chars, just under the corpus maximum of 33,713. */
const REASONING_LONG = Array.from(
  { length: 435 },
  (_, i) => `Step ${i + 1}: weighing the retrieved passage against the question asked, again.`,
).join("\n")

/** Identity normalizer — the newlines ARE part of the deliverable, so the default
 *  whitespace-collapsing normalizer would assert something weaker than what ships. */
const RAW = (s: string) => s

/**
 * ⚠ THE EXACT COPY, AND A LOOSE REGEX WILL NOT DO — MEASURED, on this suite's first run.
 * `/planning next step/` matched the RUN HEADER's own `planning next step…` (a separate
 * string, with a typographic ellipsis, from the card's status-verb helper), so §6b's
 * mutual-exclusion case failed against correct code. The thinking row's copy is this one and
 * nothing else; asserting it exactly is what distinguishes the two surfaces.
 */
const PLANNING_COPY = "Thinking · planning next step"

/** The chevron inside FoldTrigger is an SVG and contributes no text, so a trigger's
 *  textContent is exactly its label. Trimmed so a stray whitespace edit is not a failure. */
function triggerText(): string {
  return (screen.getByTestId("thinking-trigger").textContent ?? "").trim()
}

/** SETTLED CASES ONLY. `RunCard`'s `expanded` gate hides the entire body of a settled
 *  tool-bearing turn; this opens it. Forward-compatible with 243-02: once the block mounts
 *  from `MessageItem` it sits OUTSIDE that gate, so a case that clicks and then asserts
 *  still passes. */
function expandSettledRun(): void {
  fireEvent.click(screen.getByTestId("run-card-collapsed"))
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe("Phase 243 — the thinking block, characterized against the UNMOVED code (D-243-16)", () => {
  // ── §1 — the settled reasoning fold. SETTLED: expands the collapsed run row first. ──
  describe("§1 — the settled reasoning fold", () => {
    it("§1a — a settled tool-bearing turn labels the trigger exactly `Thinking`, once the run row is open", () => {
      renderWithTooltip(<MessageItem message={makeMessage({ reasoningContent: REASONING_MEDIAN })} />)
      expandSettledRun()
      // CONTENT equality, not a substring: `Thinking...` must not satisfy this case.
      // ⚠ 243-04 changes this string to `Thought for N seconds` (D-243-13). No other plan may.
      expect(triggerText()).toBe("Thinking")
    })

    it("§1b — the fold is CLOSED by default: the reasoning prose is absent before the trigger is clicked", () => {
      renderWithTooltip(<MessageItem message={makeMessage({ reasoningContent: REASONING_MEDIAN })} />)
      expandSettledRun()
      // The trigger is present and correctly labelled — the positive control that proves this
      // absence is measured against a RENDERED subtree — and the prose is not.
      expect(triggerText()).toBe("Thinking")
      expect(screen.queryByText(REASONING_MEDIAN, { normalizer: RAW })).toBeNull()
    })

    it("§1c — clicking the trigger reveals the reasoning prose verbatim, newlines included", () => {
      renderWithTooltip(<MessageItem message={makeMessage({ reasoningContent: REASONING_MEDIAN })} />)
      expandSettledRun()
      fireEvent.click(screen.getByTestId("thinking-trigger"))
      const body = screen.getByText(REASONING_MEDIAN, { normalizer: RAW })
      expect(body).toBeInTheDocument()
      expect(body.textContent).toBe(REASONING_MEDIAN)
      expect(body.textContent).toContain("\n")
      // This is the SHORT end of D-243-03's 170× spread — §1d drives the other one.
      expect(REASONING_MEDIAN.length).toBeLessThan(300)
    })

    it("§1d — the 33 KB end of the 170× spread renders verbatim too (D-243-03)", () => {
      renderWithTooltip(<MessageItem message={makeMessage({ reasoningContent: REASONING_LONG })} />)
      expandSettledRun()
      fireEvent.click(screen.getByTestId("thinking-trigger"))
      const body = screen.getByText(REASONING_LONG, { normalizer: RAW })
      expect(body.textContent).toBe(REASONING_LONG)
      // The fixture is the measured end of the range, not a token long string.
      expect(REASONING_LONG.length).toBeGreaterThan(30_000)
    })
  })

  // ── §2 — STREAMING: no click. `isStreamingNow` already makes `expanded` true. ──
  it("§2 — a STREAMING turn labels the trigger exactly `Thinking...` with three ASCII dots, never the single ellipsis character", () => {
    renderWithTooltip(
      <MessageItem
        message={makeMessage({ runStatus: "streaming", reasoningContent: REASONING_MEDIAN })}
        isStreaming
      />,
    )
    expect(triggerText()).toBe("Thinking...")
    // ⭐ The negative control is what stops a later editor "tidying" the three dots into a
    //    typographic ellipsis and reddening nothing. … is that character.
    expect(triggerText()).not.toContain("…")
    expect(triggerText()).toContain("...")
  })

  // ── §3 — STREAMING: no click. ──
  it("§3 — while streaming, reasoning accumulates behind a CLOSED fold: the prose appears only once the trigger is clicked (D-243-02)", () => {
    renderWithTooltip(
      <MessageItem
        message={makeMessage({ runStatus: "streaming", reasoningContent: REASONING_MEDIAN })}
        isStreaming
      />,
    )
    // This is the mechanical form of "auto-expanding during the stream would flip the default
    // in effect — so it does not". A later plan that opens the fold mid-stream reds here.
    expect(triggerText()).toBe("Thinking...")
    expect(screen.queryByText(REASONING_MEDIAN, { normalizer: RAW })).toBeNull()
    fireEvent.click(screen.getByTestId("thinking-trigger"))
    expect(screen.getByText(REASONING_MEDIAN, { normalizer: RAW }).textContent).toBe(REASONING_MEDIAN)
  })

  // ── §4 — no count, ever (D-243-02). SETTLED. ──
  describe("§4 — the trigger carries no count", () => {
    it("§4a — the settled trigger's text is exactly `Thinking` and carries no unit, no total and no digit", () => {
      renderWithTooltip(<MessageItem message={makeMessage({ reasoningContent: REASONING_MEDIAN })} />)
      expandSettledRun()
      // `FoldTrigger`'s own comment: reasoning has no countable unit and inventing one would be
      // fabricated precision. A `· 4 steps`, a `· 1,180 chars` or any other invented unit reds here.
      expect(triggerText()).toMatch(/^Thinking(\.\.\.)?$/)
    })

    it("§4b — a reasoning body FULL of digits still produces a digit-free trigger — the assertion binds to the trigger, not to the page", () => {
      const digitsEverywhere = "Counted 4 passages, 1180 characters, across 12 documents and 3 folders."
      renderWithTooltip(<MessageItem message={makeMessage({ reasoningContent: digitsEverywhere })} />)
      expandSettledRun()
      fireEvent.click(screen.getByTestId("thinking-trigger"))
      // Positive control: the digits ARE on the page, in the body…
      expect(screen.getByText(digitsEverywhere, { normalizer: RAW }).textContent).toContain("1180")
      // …and still not on the trigger.
      expect(triggerText()).toMatch(/^Thinking(\.\.\.)?$/)
      expect(triggerText()).not.toMatch(/\d/)
    })
  })

  // ── §5 — the body's class tokens. SETTLED. ──
  it("§5 — the reasoning body's class tokens, pinned as the thing 243-04 will change", () => {
    renderWithTooltip(<MessageItem message={makeMessage({ reasoningContent: REASONING_MEDIAN })} />)
    expandSettledRun()
    fireEvent.click(screen.getByTestId("thinking-trigger"))
    const body = screen.getByText(REASONING_MEDIAN, { normalizer: RAW })
    // ⚠ THIS IS THE CLASS-STRING FORM, AND IT IS LEGITIMATE HERE BECAUSE THE CLASSES ARE THE
    //   DELIVERABLE of 243-04's V1 diff — it is not a presence assertion in disguise.
    //   243-04 / D-243-02 is the ONE authorised change:
    //     LEAVING  → font-mono · whitespace-pre-wrap · max-h-64 · overflow-y-auto
    //     CHANGING → text-xs becomes text-sm
    //     STAYING  → border-l-2 · ml-3
    //   Any other plan that reds this line has restyled the reasoning body by accident.
    for (const token of [
      "text-xs",
      "font-mono",
      "whitespace-pre-wrap",
      "max-h-64",
      "overflow-y-auto",
      "border-l-2",
      "ml-3",
    ]) {
      expect(body.className.split(/\s+/)).toContain(token)
    }
  })

  // ── §6 — the planning placeholder. THE ONLY SECTION ANCHORED TO THE CARD. ──
  //    243-02 LEAVES state 2 and the elapsed segment in `RunCard` by explicit decision, so
  //    anchoring them there is correct rather than accidental. Everything else in this file
  //    renders through `MessageItem`, which is the boundary that survives the move.
  describe("§6 — the planning placeholder (state 2), anchored to the card 243-02 leaves it in", () => {
    it("§6a — streaming + isPlanning + no reasoning renders `Thinking · planning next step`", () => {
      const msg = makeMessage({ runStatus: "streaming", isPlanning: true })
      renderWithTooltip(<RunCard message={msg} isStreaming />)
      expect(screen.getByTestId("thinking-row").textContent).toContain(PLANNING_COPY)
    })

    it("§6b — the SAME fixture with reasoning does not render the planning copy — states 1 and 2 are mutually exclusive by construction", () => {
      const msg = makeMessage({
        runStatus: "streaming",
        isPlanning: true,
        reasoningContent: REASONING_MEDIAN,
      })
      renderWithTooltip(<RunCard message={msg} isStreaming />)
      expect(screen.queryByText(PLANNING_COPY)).toBeNull()
      expect(screen.queryByTestId("thinking-row")).toBeNull()
      // Positive control — state 1 took the branch, so the absence above is a measured
      // exclusion rather than a fixture that rendered nothing at all.
      expect(triggerText()).toBe("Thinking...")
    })

    it("§6c — an honest start renders a duration beside the planning copy", () => {
      const msg = makeMessage({
        runStatus: "streaming",
        isPlanning: true,
        startedAt: new Date(Date.now() - 5_000).toISOString(),
      })
      renderWithTooltip(<RunCard message={msg} isStreaming />)
      const row = screen.getByTestId("thinking-row")
      expect(row.textContent).toContain(PLANNING_COPY)
      expect(within(row).getByText(/^\d+(\.\d+)?s$/)).toBeInTheDocument()
    })

    it("§6d — no honest start renders NO duration — the honesty gate, on the only input state 2 can reach", () => {
      // ⚠ MEASURED FINDING, recorded rather than papered over. The honesty rule has two arms:
      //   no parseable start, and a TERMINAL run with neither a persisted end nor a
      //   same-session frozen one. State 2 renders ONLY while streaming (see §6e), so the
      //   terminal arm is UNREACHABLE on this row and this case drives the reachable one.
      const msg = makeMessage({
        runStatus: "streaming",
        isPlanning: true,
        created_at: "not-a-date",
        startedAt: undefined,
      })
      renderWithTooltip(<RunCard message={msg} isStreaming />)
      const row = screen.getByTestId("thinking-row")
      expect(row.textContent).toContain(PLANNING_COPY)
      expect(within(row).queryByText(/^\d+(\.\d+)?s$/)).toBeNull()
    })

    it("§6e — a TERMINAL planning run renders no planning row at all, which is WHY the terminal arm of the honesty gate is unreachable here", () => {
      const msg = makeMessage({ runStatus: "completed", isPlanning: true })
      renderWithTooltip(<RunCard message={msg} />)
      // Terminal + tools ⇒ collapsed. Open it, so this absence is measured against a
      // rendered body rather than against nothing.
      expandSettledRun()
      expect(screen.queryByText(PLANNING_COPY)).toBeNull()
      expect(screen.queryByTestId("thinking-row")).toBeNull()
    })
  })

  // ── §7 — state 3. SETTLED: expand first, or the case is vacuous. ──
  it("§7 — state 3: with neither reasoning nor planning, no `Thinking` trigger and no `Thinking · planning next step` render inside an OPEN run", () => {
    renderWithTooltip(<MessageItem message={makeMessage()} />)
    expandSettledRun()
    // Positive control FIRST: the run body really is open, so the two absences below are
    // measured against a rendered subtree. An assertion made against an unrendered subtree
    // is not evidence — it would pass with the logic entirely broken.
    expect(screen.queryByTestId("run-card-collapsed")).toBeNull()
    expect(screen.getByText("Assistant response text")).toBeInTheDocument()
    expect(screen.queryByTestId("thinking-trigger")).toBeNull()
    expect(screen.queryByText(PLANNING_COPY)).toBeNull()
    expect(screen.queryByTestId("thinking-row")).toBeNull()
    expect(screen.queryByText(/^Thinking$/)).toBeNull()
  })

  // ── §8 — ⚠ DECLARED DEFECT (CHAT-04). This case asserts what is WRONG today. ──
  it("§8 — ⚠ DECLARED DEFECT (CHAT-04): a reasoning-bearing reply with ZERO tool calls renders no reasoning anywhere", () => {
    // ⛔ NEVER READ THIS AS DESIRED BEHAVIOUR. Measured for D-243-03: 105 of 340
    //    reasoning-bearing rows — 31% — called no tool at all, and their reasoning is
    //    INVISIBLE in the product, because the only renderer of `reasoningContent` in the
    //    codebase sits inside a card `MessageItem` mounts only for a tool-bearing turn.
    //    243-02 INVERTS this case: once the block mounts from `MessageItem` and self-guards
    //    on its own content, this fixture renders the reasoning and this expectation flips.
    // ⭐ The fixture is §1's, with ONE difference — an EMPTY `tool_calls`. That is what makes
    //    this a measurement of the tool-conditionality rather than of two unrelated fixtures.
    renderWithTooltip(
      <MessageItem message={makeMessage({ reasoningContent: REASONING_MEDIAN, tool_calls: [] })} />,
    )
    // Positive control: the reply itself renders, so this is a message on the page with its
    // reasoning missing — not an empty render.
    expect(screen.getByText("Assistant response text")).toBeInTheDocument()
    expect(screen.queryByTestId("thinking-trigger")).toBeNull()
    expect(screen.queryByText(REASONING_MEDIAN, { normalizer: RAW })).toBeNull()
    expect(screen.queryByTestId("run-card-collapsed")).toBeNull()
  })

  // ── §9 — ⚠ DECLARED DEFECT. This case asserts what is WRONG today. ──
  it("§9 — ⚠ DECLARED DEFECT: on a settled run the reasoning sits behind TWO folds — no thinking trigger exists until the run row is opened", () => {
    // ⛔ NEVER READ THIS AS DESIRED BEHAVIOUR. `expanded = isStreamingNow || !hasTools ||
    //    userExpanded`, and a settled tool-bearing turn has none of the three — so the whole
    //    block, trigger included, is not rendered at all. The reader must open the run row and
    //    THEN the thinking fold to reach reasoning that has already finished streaming.
    //    243-02 INVERTS this: the block mounts from `MessageItem`, OUTSIDE the card's
    //    `expanded` gate entirely, so one of the two folds disappears. That is what turns
    //    "the extraction removed a fold" from a side effect into a measured improvement.
    renderWithTooltip(<MessageItem message={makeMessage({ reasoningContent: REASONING_MEDIAN })} />)
    // Before the run row is opened: the row exists, and the thinking block does not.
    expect(screen.getByTestId("run-card-collapsed").textContent).toBeTruthy()
    expect(screen.queryByTestId("thinking-trigger")).toBeNull()
    expect(screen.queryByText(REASONING_MEDIAN, { normalizer: RAW })).toBeNull()
    // After: fold one is open, fold two is still closed.
    expandSettledRun()
    expect(triggerText()).toBe("Thinking")
    expect(screen.queryByText(REASONING_MEDIAN, { normalizer: RAW })).toBeNull()
    // And only the second click reaches the words.
    fireEvent.click(screen.getByTestId("thinking-trigger"))
    expect(screen.getByText(REASONING_MEDIAN, { normalizer: RAW }).textContent).toBe(REASONING_MEDIAN)
  })
})
