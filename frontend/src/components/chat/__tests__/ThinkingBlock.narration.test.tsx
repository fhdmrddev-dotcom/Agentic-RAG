/**
 * BUG-260912-01 — inter-tool NARRATION belongs in the fold, not in the message body.
 *
 * ⛔ THE DEFECT. The app has exactly ONE fold and it was fed by exactly ONE thing:
 * `reasoningContent`, the provider's dedicated reasoning channel (`reasoning_delta` —
 * DeepSeek `reasoning_content`, `<think>`-stripped Kimi / MiniMax / GLM). Ordinary assistant
 * prose is a `delta` and went to the message body, untagged. So a model that routes its
 * thinking through the dedicated channel folded correctly and looked clean, and a model that
 * simply TALKS — which is most of them — put every word in the body. On a five-tool run the
 * answer ended up buried under "I'll start by…", "Now let me…", "Excellent analysis!…".
 *
 * ⭐ WHICH IS WHY THIS READ AS MODEL-SPECIFIC AND IS NOT. The renderer was not wrong for one
 * model and right for another; it was blind to the distinction. §1 is that case: narration
 * with NO provider reasoning must still draw a fold, or moving the text out of the body would
 * render it nowhere at all — which is strictly worse than the noise it replaced.
 *
 * ⚠ THE `reasoningMs` TRAP IS WHY THESE ARE TWO FIELDS AND NOT ONE. Merging narration into
 * `reasoningContent` is the obvious smaller diff, and it would make "Thought for N seconds"
 * describe an interval it never measured — the span is computed from reasoning deltas ALONE
 * (D-243-13, and 243-06/HI-1 rejected a version that billed tool time at 40100 ms). §4 pins
 * that the label is untouched by narration.
 */
import { describe, it, expect, afterEach } from "vitest"
import { render, screen, fireEvent, cleanup } from "@testing-library/react"
import { TooltipProvider } from "@/components/ui/tooltip"
import { MessageItem } from "@/components/chat/MessageItem"
import type { Message } from "@/types"

const NOW = new Date().toISOString()

function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: "msg-narration-1",
    thread_id: "thread-1",
    user_id: "user-1",
    role: "assistant",
    content: "Here is your presentation.",
    created_at: NOW,
    updated_at: NOW,
    model: "XHToken/Spark-X2.5-4B-GGUF",
    provider: "custom",
    tool_calls: [],
    ...overrides,
  } as Message
}

const renderIt = (ui: React.ReactElement) => render(<TooltipProvider>{ui}</TooltipProvider>)

/** The reported shape, verbatim from the operator's screenshot. */
const NARRATION = [
  "I'll start by searching for RPA research by Fahed Mrad in your knowledge base.",
  "I found several relevant documents. Let me now load the PPTX skill.",
  "Excellent analysis! Now let me also analyze the dissertation document.",
].join("\n\n")

afterEach(cleanup)

describe("BUG-260912-01 — narration folds", () => {
  it("§1 draws a fold for narration even when there is NO provider reasoning", () => {
    // ⛔ THE CASE THAT MATTERS MOST. Every model without a reasoning channel lands here, and
    // before the fix the self-guard `if (!reasoningContent) return null` would have returned
    // null while the text had already been moved OUT of the body — losing it entirely.
    renderIt(<MessageItem message={makeMessage({ narrationContent: NARRATION })} />)
    expect(screen.getByTestId("thinking-block")).toBeInTheDocument()
  })

  it("§2 keeps narration OUT of the message body — the whole point", () => {
    renderIt(<MessageItem message={makeMessage({ narrationContent: NARRATION })} />)
    // The fold is CLOSED by default (D-243-02), so narration must not be on screen at all
    // while the answer is.
    expect(screen.queryByText(/I'll start by searching/)).not.toBeInTheDocument()
    expect(screen.getByText(/Here is your presentation/)).toBeInTheDocument()
  })

  it("§3 reveals every narration turn when opened, as separate paragraphs", () => {
    renderIt(<MessageItem message={makeMessage({ narrationContent: NARRATION })} />)
    fireEvent.click(screen.getByTestId("thinking-trigger"))
    const paras = screen.getAllByTestId("thinking-narration-paragraph")
    // ⛔ THREE, NOT ONE. StreamsProvider joins turns with a BLANK LINE precisely so they do not
    // run together — the `…in parallel.I found several…` seam in the report is what one
    // paragraph would look like.
    expect(paras).toHaveLength(3)
    expect(paras[0]).toHaveTextContent(/I'll start by searching/)
    expect(paras[2]).toHaveTextContent(/Excellent analysis/)
  })

  it("§4 does NOT claim a measured thinking time for narration", () => {
    // ⚠ `reasoningMs` is undefined here because nothing measured a reasoning span — there was
    // no reasoning. The label must fall back to the no-number form (RunCard's honesty rule),
    // never invent a duration from narration it did not time.
    renderIt(<MessageItem message={makeMessage({ narrationContent: NARRATION })} />)
    expect(screen.queryByText(/Thought for \d+ second/)).not.toBeInTheDocument()
  })

  it("§5 renders BOTH sources in the one fold when a model has reasoning and narration", () => {
    renderIt(
      <MessageItem
        message={makeMessage({ narrationContent: NARRATION, reasoningContent: "Weighing the passage." })}
      />,
    )
    fireEvent.click(screen.getByTestId("thinking-trigger"))
    // One fold, two sources — and each still tellable apart by its own testid.
    expect(screen.getAllByTestId("thinking-paragraph")).toHaveLength(1)
    expect(screen.getAllByTestId("thinking-narration-paragraph")).toHaveLength(3)
    expect(screen.getAllByTestId("thinking-block")).toHaveLength(1)
  })

  it("§6 stays INERT for a message with neither — byte-identical to before", () => {
    // D-14's default-inert rule: a run whose model never narrated must see no change at all.
    renderIt(<MessageItem message={makeMessage()} />)
    expect(screen.queryByTestId("thinking-block")).not.toBeInTheDocument()
  })

  it("§7 shows exactly ONE thinking indicator mid-stream, never the fold AND the planning row", () => {
    // ⛔ THE REGRESSION THIS FIX SHIPPED, CAUGHT IN A LIVE BROWSER RUN AND NOT BY ANY TEST.
    // `RunCard`'s planning row asked `!reasoningContent` — a COMPLETE question while the fold
    // had exactly one input. Narration made it a second input, opening a window where
    // narration is set and reasoning is still empty: the fold drew, and so did the row.
    // Measured on 2026-09-13 mid-stream: `deciding next step…` and `Thinking...` stacked.
    //
    // ⚠ THE STREAMING STATE IS LOAD-BEARING HERE. The row is gated on `isStreamingNow`, so
    // the double COLLAPSES once the run settles — a test over a finished message sees one
    // indicator and passes against the broken code. That is precisely why this defect
    // survived six green cases above it.
    renderIt(
      <MessageItem
        message={makeMessage({
          content: "",
          narrationContent: NARRATION,
          isPlanning: true,
          runStatus: "streaming",
          tool_calls: [{ id: "t1", name: "search_documents", status: "done", args: {} }],
        } as Partial<Message>)}
        isStreaming
      />,
    )
    expect(screen.getByTestId("thinking-block")).toBeInTheDocument()
    expect(screen.queryByTestId("thinking-row")).not.toBeInTheDocument()
  })
})
