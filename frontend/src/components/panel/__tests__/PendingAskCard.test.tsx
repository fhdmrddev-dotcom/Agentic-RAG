/**
 * Phase 087 Plan 05 — PendingAskCard contract (PANEL-04, D-03/D-04/D-05).
 *
 * Wave 0 (Plan 01) shipped this file as GREEN-only `it.todo(...)` contracts;
 * Plan 05 flips them to live tests as the component lands. Fixtures anchor both
 * the GET-reconciled prompt (run_id present) and the pure-SSE prompt (run_id
 * ABSENT — A2 / Pitfall 1: submit must be gated + reconcile triggered).
 */
import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, waitFor, cleanup, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { axe } from "vitest-axe"
import { mockPendingAskWithRunId, mockPendingAskNoRunId } from "./fixtures"
import type { PendingAsk } from "@/types"

// ── Mock the api client so submit is observable + deterministic ──
vi.mock("@/lib/api", () => ({
  answerAskUser: vi.fn().mockResolvedValue(undefined),
}))
import { answerAskUser } from "@/lib/api"

// ── Mock the Phase 086 hooks so PendingAskStack consumes a controlled array ──
const hookState: { asks: PendingAsk[]; reconcile: ReturnType<typeof vi.fn> } = {
  asks: [],
  reconcile: vi.fn().mockResolvedValue(undefined),
}
vi.mock("@/providers/StreamsProvider", () => ({
  useViewingThread: () => "thread-1",
  useAskUserPrompt: () => ({
    data: hookState.asks,
    isLoading: false,
    error: null,
    reconcile: hookState.reconcile,
  }),
}))

import { PendingAskCard, PendingAskStack } from "../PendingAskCard"

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  hookState.asks = []
  hookState.reconcile = vi.fn().mockResolvedValue(undefined)
})

const noopReconcile = () => Promise.resolve()

describe("PendingAskCard (PANEL-04) — answer + resume", () => {
  it("renders the prompt text + the amber needs-you treatment", () => {
    render(<PendingAskCard ask={mockPendingAskWithRunId} reconcile={noopReconcile} />)
    expect(screen.getByText(mockPendingAskWithRunId.prompt)).toBeInTheDocument()
    expect(screen.getByText("Needs you")).toBeInTheDocument()
  })

  it("renders choice chips above the free-text field only when options are supplied", () => {
    render(<PendingAskCard ask={mockPendingAskWithRunId} reconcile={noopReconcile} />)
    const radios = screen.getAllByRole("radio")
    expect(radios).toHaveLength(mockPendingAskWithRunId.options.length)
    expect(screen.getByRole("radiogroup")).toBeInTheDocument()
  })

  it("always renders the free-text field even when options is [] (no-options trap, D3)", () => {
    render(<PendingAskCard ask={mockPendingAskNoRunId} reconcile={noopReconcile} />)
    expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument()
    expect(screen.getByPlaceholderText("Type an answer…")).toBeInTheDocument()
  })

  it("disables Submit until the user picks a chip or types free-text", async () => {
    const user = userEvent.setup()
    render(<PendingAskCard ask={mockPendingAskWithRunId} reconcile={noopReconcile} />)
    const submit = screen.getByRole("button", { name: /send answer/i })
    expect(submit).toBeDisabled()
    await user.click(screen.getAllByRole("radio")[0])
    expect(submit).toBeEnabled()
  })

  it("calls answerAskUser(run_id, { tool_call_id, response_text, choice_index }) on submit with run_id present", async () => {
    const user = userEvent.setup()
    render(<PendingAskCard ask={mockPendingAskWithRunId} reconcile={noopReconcile} />)
    await user.click(screen.getAllByRole("radio")[0])
    await user.click(screen.getByRole("button", { name: /send answer/i }))
    await waitFor(() =>
      expect(answerAskUser).toHaveBeenCalledWith("run-ask-1", {
        tool_call_id: "tc-ask-1",
        response_text: "",
        choice_index: 0,
      }),
    )
  })

  it("sends typed free-text (no choice) as response_text with choice_index null", async () => {
    const user = userEvent.setup()
    render(<PendingAskCard ask={mockPendingAskNoRunIdButReady()} reconcile={noopReconcile} />)
    await user.type(screen.getByPlaceholderText("Type an answer…"), "use staging")
    await user.click(screen.getByRole("button", { name: /send answer/i }))
    await waitFor(() =>
      expect(answerAskUser).toHaveBeenCalledWith("run-ready", {
        tool_call_id: "tc-ask-2",
        response_text: "use staging",
        choice_index: null,
      }),
    )
  })

  it("gates submit (disabled + triggers reconcile) when PendingAsk.run_id is undefined (A2 / Pitfall 1)", async () => {
    const user = userEvent.setup()
    const reconcile = vi.fn().mockResolvedValue(undefined)
    render(<PendingAskCard ask={mockPendingAskNoRunId} reconcile={reconcile} />)
    // reconcile fires once on mount-if-missing to fetch the run_id-carrying prompt
    await waitFor(() => expect(reconcile).toHaveBeenCalledTimes(1))
    // even after typing, submit stays gated (shows "Preparing…") and never POSTs
    await user.type(screen.getByPlaceholderText("Type an answer…"), "yes")
    const submit = screen.getByRole("button", { name: /preparing/i })
    expect(submit).toBeDisabled()
    await user.click(submit)
    expect(answerAskUser).not.toHaveBeenCalled()
  })

  it("flips to the green 'Answered · agent resumed' state after a successful submit (D4)", async () => {
    const user = userEvent.setup()
    render(<PendingAskCard ask={mockPendingAskWithRunId} reconcile={noopReconcile} />)
    await user.click(screen.getAllByRole("radio")[0])
    await user.click(screen.getByRole("button", { name: /send answer/i }))
    expect(await screen.findByText(/answered · agent resumed/i)).toBeInTheDocument()
    expect(screen.getByText(/you answered/i)).toBeInTheDocument()
    expect(screen.getByText(mockPendingAskWithRunId.options[0])).toBeInTheDocument()
  })

  it("renders the calm '.expired' state on timeout, never an opaque crash (D5)", () => {
    const expired: PendingAsk = { ...mockPendingAskWithRunId, timeout_seconds: 0 }
    expect(() =>
      render(<PendingAskCard ask={expired} reconcile={noopReconcile} />),
    ).not.toThrow()
    expect(screen.getByText(/no response within 0:00 — agent stopped/i)).toBeInTheDocument()
    // the amber needs-you label is gone — the card is calm grey
    expect(screen.queryByText("Needs you")).not.toBeInTheDocument()
  })

  it("stacks multiple pending asks — newest pinned on top, each its own amber card (D-03)", () => {
    hookState.asks = [
      { ...mockPendingAskWithRunId, tool_call_id: "tc-old", created_at: "2026-05-29T10:00:00Z", prompt: "Older question?" },
      { ...mockPendingAskWithRunId, tool_call_id: "tc-new", created_at: "2026-05-29T10:05:00Z", prompt: "Newer question?" },
    ]
    render(<PendingAskStack />)
    const prompts = screen.getAllByText(/question\?/i)
    expect(prompts).toHaveLength(2)
    // newest pinned on top → "Newer question?" precedes "Older question?" in DOM order
    expect(prompts[0]).toHaveTextContent("Newer question?")
    expect(prompts[1]).toHaveTextContent("Older question?")
    // each is its own amber needs-you card
    expect(screen.getAllByText("Needs you")).toHaveLength(2)
  })

  // Phase 088-01 (D-13a) — structural a11y regression gate across the card's
  // meaningful states: pending (radiogroup + free-text + buttons), answered
  // (post-submit green state), and expired (calm timeout). axe = STRUCTURE only
  // (Pitfall 5 — contrast is Plan 05 / Chrome MCP).
  it("has no axe violations (pending — radiogroup + free-text)", async () => {
    const { container } = render(
      <PendingAskCard ask={mockPendingAskWithRunId} reconcile={noopReconcile} />,
    )
    expect(await axe(container)).toHaveNoViolations()
  })

  it("has no axe violations (answered state)", async () => {
    const user = userEvent.setup()
    const { container } = render(
      <PendingAskCard ask={mockPendingAskWithRunId} reconcile={noopReconcile} />,
    )
    await user.click(screen.getAllByRole("radio")[0])
    await user.click(screen.getByRole("button", { name: /send answer/i }))
    await screen.findByText(/answered · agent resumed/i)
    expect(await axe(container)).toHaveNoViolations()
  })

  it("has no axe violations (expired state)", async () => {
    const expired: PendingAsk = { ...mockPendingAskWithRunId, timeout_seconds: 0 }
    const { container } = render(
      <PendingAskCard ask={expired} reconcile={noopReconcile} />,
    )
    expect(await axe(container)).toHaveNoViolations()
  })
})

/** A no-options prompt that already carries run_id (free-text submit path). */
function mockPendingAskNoRunIdButReady(): PendingAsk {
  return { ...mockPendingAskNoRunId, run_id: "run-ready" }
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 094 Plan 05 Task 2 (D-06) — ask.draft renders ABOVE the question.
//
// The draft is the prior phase's text the user is being asked to confirm; it is
// labelled "not yet saved" so it is NEVER read as the final answer. Long drafts
// preview behind a faded mask + open a WIDE overlay over the chat. When draft is
// undefined (older streams) NO draft block renders (DRAFT-MISSING guard).
// ─────────────────────────────────────────────────────────────────────────────

/** Short draft (renders inline, no open-wide control). */
const SHORT_DRAFT = "Use the prod_sales_2026 dataset for the Q3 rollup."
/** Long draft (>~120 words) → faded preview + "Review & edit full draft". */
const LONG_DRAFT = Array.from({ length: 200 }, (_, i) => `word${i}`).join(" ")

function mockPendingAskWithDraft(draft: string): PendingAsk {
  return { ...mockPendingAskWithRunId, draft }
}

describe("PendingAskCard (D-06) — draft preview above the question", () => {
  it("renders the draft body + the verbatim 'not yet saved' DRAFT tag ABOVE the prompt", () => {
    render(<PendingAskCard ask={mockPendingAskWithDraft(SHORT_DRAFT)} reconcile={noopReconcile} />)
    // The non-negotiable label — proves the draft is not the final answer.
    expect(
      screen.getByText(/DRAFT · awaiting your review — not yet saved/i),
    ).toBeInTheDocument()
    // The draft body renders.
    expect(screen.getByText(SHORT_DRAFT)).toBeInTheDocument()
    // The draft block precedes the question in DOM order (ABOVE the prompt).
    const draftTag = screen.getByText(/DRAFT · awaiting your review — not yet saved/i)
    const prompt = screen.getByText(mockPendingAskWithRunId.prompt)
    expect(draftTag.compareDocumentPosition(prompt)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    )
  })

  it("does NOT render a DRAFT block when ask.draft is undefined (DRAFT-MISSING guard)", () => {
    render(<PendingAskCard ask={mockPendingAskWithRunId} reconcile={noopReconcile} />)
    expect(
      screen.queryByText(/DRAFT · awaiting your review — not yet saved/i),
    ).not.toBeInTheDocument()
    // The question still renders — the card is not blank.
    expect(screen.getByText(mockPendingAskWithRunId.prompt)).toBeInTheDocument()
  })

  it("shows a word count + 'Review & edit full draft' control for a long draft", () => {
    render(<PendingAskCard ask={mockPendingAskWithDraft(LONG_DRAFT)} reconcile={noopReconcile} />)
    // Word count is computed from the draft length at render (never a fixture).
    expect(screen.getByText(/200 words · long draft/i)).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /review & edit full draft/i }),
    ).toBeInTheDocument()
  })

  it("opens a WIDE overlay containing the full draft when 'Review & edit full draft' is clicked", async () => {
    const user = userEvent.setup()
    render(<PendingAskCard ask={mockPendingAskWithDraft(LONG_DRAFT)} reconcile={noopReconcile} />)
    await user.click(screen.getByRole("button", { name: /review & edit full draft/i }))
    // The overlay is a dialog with the full draft body.
    const dialog = await screen.findByRole("dialog")
    expect(within(dialog).getByText(/word199/)).toBeInTheDocument()
    // The "not yet saved" contract carries into the overlay title.
    expect(within(dialog).getByText(/not yet saved/i)).toBeInTheDocument()
  })

  it("has no axe violations with a draft present", async () => {
    const { container } = render(
      <PendingAskCard ask={mockPendingAskWithDraft(SHORT_DRAFT)} reconcile={noopReconcile} />,
    )
    expect(await axe(container)).toHaveNoViolations()
  })
})
