/**
 * Phase 087 Plan 05 — PendingAskCard contract (PANEL-04, D-03/D-04/D-05).
 *
 * Wave 0 (Plan 01) shipped this file as GREEN-only `it.todo(...)` contracts;
 * Plan 05 flips them to live tests as the component lands. Fixtures anchor both
 * the GET-reconciled prompt (run_id present) and the pure-SSE prompt (run_id
 * ABSENT — A2 / Pitfall 1: submit must be gated + reconcile triggered).
 */
import { describe, it, expect, vi, afterEach } from "vitest"
import { act, render, screen, waitFor, cleanup, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { axe } from "vitest-axe"
import { mockPendingAskWithRunId, mockPendingAskNoRunId } from "./fixtures"
import type { PendingAsk } from "@/types"

// ── Mock Supabase auth so the real api.ts module-load (importActual below)
//    never constructs a client against a real URL (panelHooks idiom) ──
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

// ── Partial-mock the api client: answerAskUser is observable + deterministic;
//    ApiError stays the REAL class (importActual) so the component's
//    `err instanceof ApiError` 404-honesty branch is exercised against the
//    true class identity (096-04 / BUG-260605-01). ──
vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api")
  return {
    ...actual,
    answerAskUser: vi.fn().mockResolvedValue(undefined),
  }
})
import { answerAskUser, ApiError } from "@/lib/api"

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

import {
  NO_DEADLINE_WAITING_LINE,
  PendingAskCard,
  PendingAskStack,
} from "../PendingAskCard"

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

  it("calls answerAskUser(run_id, { tool_call_id, response_text, choice_index }) on submit with run_id present — a choice-click sends the chosen OPTION TEXT, never \"\" (BUG-260607-01)", async () => {
    const user = userEvent.setup()
    render(<PendingAskCard ask={mockPendingAskWithRunId} reconcile={noopReconcile} />)
    await user.click(screen.getAllByRole("radio")[0])
    await user.click(screen.getByRole("button", { name: /send answer/i }))
    await waitFor(() =>
      expect(answerAskUser).toHaveBeenCalledWith("run-ask-1", {
        tool_call_id: "tc-ask-1",
        // BUG-260607-01 regression guard: the resolved option text rides
        // response_text — the empty-string body fed the model an empty answer
        // (run 92c7b64c, 2026-06-07) and the agent re-asked instead of acting.
        response_text: "prod_sales_2026",
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
    // 096-04: created_at now drives the countdown seed — keep these FRESH
    // (relative to now) so both cards mount pending, preserving the ordering
    // assertion this test owns.
    const now = Date.now()
    hookState.asks = [
      { ...mockPendingAskWithRunId, tool_call_id: "tc-old", created_at: new Date(now - 60_000).toISOString(), prompt: "Older question?" },
      { ...mockPendingAskWithRunId, tool_call_id: "tc-new", created_at: new Date(now).toISOString(), prompt: "Newer question?" },
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

// ─────────────────────────────────────────────────────────────────────────────
// Phase 096 Plan 04 (BUG-260605-01 / D-06 honesty) — 404 honesty + created_at
// countdown. A dead prompt must never read as live: a 404 on submit surfaces a
// visible expired state (never silence), and the countdown derives from
// created_at so a reconciled stale prompt never shows a misleading fresh 5:00.
// ─────────────────────────────────────────────────────────────────────────────

/** A pending ask whose created_at is `secondsAgo` seconds in the past. */
function mockPendingAskCreatedAgo(
  secondsAgo: number,
  overrides: Partial<PendingAsk> = {},
): PendingAsk {
  return {
    ...mockPendingAskWithRunId,
    created_at: new Date(Date.now() - secondsAgo * 1000).toISOString(),
    ...overrides,
  }
}

describe("PendingAskCard (096-04) — 404 honesty + created_at-derived countdown", () => {
  it("surfaces a visible expired state when answerAskUser rejects with ApiError(404) — never silence", async () => {
    const user = userEvent.setup()
    vi.mocked(answerAskUser).mockRejectedValueOnce(
      new ApiError("Failed to submit ask_user answer", 404),
    )
    render(<PendingAskCard ask={mockPendingAskCreatedAgo(5)} reconcile={noopReconcile} />)
    await user.click(screen.getAllByRole("radio")[0])
    await user.click(screen.getByRole("button", { name: /send answer/i }))
    // The 404 is the backend's IDOR-safe "run not active" answer — the card
    // flips to the calm expired state with the CONSTANT honesty message.
    expect(
      await screen.findByText("This prompt has expired — the run is no longer active"),
    ).toBeInTheDocument()
    // The amber pending chrome is gone — submitting rolled back, calm grey status.
    expect(screen.queryByText("Needs you")).not.toBeInTheDocument()
    expect(screen.getByRole("status")).toBeInTheDocument()
  })

  it("stays pending + shows a visible retryable error line on ApiError(500) — submit re-enabled", async () => {
    const user = userEvent.setup()
    vi.mocked(answerAskUser).mockRejectedValueOnce(
      new ApiError("Failed to submit ask_user answer", 500),
    )
    render(<PendingAskCard ask={mockPendingAskCreatedAgo(5)} reconcile={noopReconcile} />)
    await user.click(screen.getAllByRole("radio")[0])
    await user.click(screen.getByRole("button", { name: /send answer/i }))
    // Visible, constant-string error — never silent, never raw server text.
    expect(
      await screen.findByText("Couldn't submit your answer — try again."),
    ).toBeInTheDocument()
    // Still the pending card; the submit button is re-enabled for retry.
    expect(screen.getByText("Needs you")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /send answer/i })).toBeEnabled()
  })

  it("renders expired ON MOUNT for a reconciled stale prompt (created_at 10min ago, timeout 300s) — never a fresh 5:00", () => {
    render(<PendingAskCard ask={mockPendingAskCreatedAgo(600)} reconcile={noopReconcile} />)
    expect(screen.queryByText("Needs you")).not.toBeInTheDocument()
    expect(screen.getByRole("status")).toBeInTheDocument()
    expect(screen.getByText(/no response within 5:00 — agent stopped/i)).toBeInTheDocument()
  })

  it("seeds the countdown from created_at (30s ago, timeout 300s → ≈270 remaining)", () => {
    render(<PendingAskCard ask={mockPendingAskCreatedAgo(30)} reconcile={noopReconcile} />)
    const clock = screen.getByText(/^\d+:\d{2}$/)
    const [m, s] = clock.textContent!.split(":").map(Number)
    const remaining = m * 60 + s
    expect(remaining).toBeLessThanOrEqual(271)
    expect(remaining).toBeGreaterThanOrEqual(268)
  })

  it("seeds at timeout_seconds when created_at is absent (SSE-fresh — current behavior preserved)", () => {
    // mockPendingAskNoRunIdButReady carries run_id but NO created_at — the
    // genuinely-fresh SSE path (emission ≈ mount) honestly shows the full clock.
    render(<PendingAskCard ask={mockPendingAskNoRunIdButReady()} reconcile={noopReconcile} />)
    expect(screen.getByText("5:00")).toBeInTheDocument()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Phase 185 Plan 05 (GOVERN-03 / L-15) — a prompt with NO deadline.
//
// The armed action-risk checkpoint sends `timeout_seconds: null`: the engine
// subscribes with no timeout, so the run really does wait for a person forever
// (SPEC Req 9 — no answer must mean the run never proceeds). Before this plan the
// card seeded its countdown from that value and flipped to `expired`, rendering
// "No response within 0:00 — agent stopped" the instant the prompt appeared —
// G-4 scenario 3's named failure ("the prompt survived but is unreachable"),
// shipped by the fix meant to prevent it.
//
// The honesty fence cuts BOTH ways: the waiting sentence may appear on the
// null-deadline card and must NEVER appear on a card that has a deadline.
// ─────────────────────────────────────────────────────────────────────────────

const mockPendingAskNoDeadline = (): PendingAsk => ({
  ...mockPendingAskWithRunId,
  tool_call_id: "tc-armed-1",
  prompt: 'Step 2 of 4, "Send the renewal notice", is about to run.',
  options: ["Approve and run this step", "Do not run it"],
  timeout_seconds: null,
})

describe("PendingAskCard (185-05) — a null deadline is a wait, never an expiry", () => {
  it("stays pending forever with timeout_seconds: null — fake timers advanced far past any plausible deadline", () => {
    vi.useFakeTimers()
    try {
      render(<PendingAskCard ask={mockPendingAskNoDeadline()} reconcile={noopReconcile} />)
      // 100_000 s ≫ the 300 s the shipped prompts use, and ≫ the created_at
      // seed that makes a stale reconciled prompt mount expired.
      act(() => {
        vi.advanceTimersByTime(100_000_000)
      })
      // Still the amber needs-you card…
      expect(screen.getByText("Needs you")).toBeInTheDocument()
      // …and nothing anywhere claims it stopped.
      expect(screen.queryByText(/agent stopped/i)).not.toBeInTheDocument()
      expect(screen.queryByText(/^Expired$/)).not.toBeInTheDocument()
      // No countdown is rendered at all — a clock with no deadline behind it is
      // the lie this task removes.
      expect(screen.queryByText(/^\d+:\d{2}$/)).not.toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it("renders the waiting line verbatim from the exported const when there is no deadline", () => {
    render(<PendingAskCard ask={mockPendingAskNoDeadline()} reconcile={noopReconcile} />)
    expect(screen.getByText(NO_DEADLINE_WAITING_LINE)).toBeInTheDocument()
    // The question itself still renders — the card is not replaced by the line.
    expect(
      screen.getByText('Step 2 of 4, "Send the renewal notice", is about to run.'),
    ).toBeInTheDocument()
  })

  it("NEVER renders the waiting line on a card that HAS a deadline (SPEC Req 9, third bullet)", () => {
    // timeout_seconds: 300 — the unarmed control. This run does not wait; it
    // expires. Saying "the run is waiting for your answer" here would be false.
    render(<PendingAskCard ask={mockPendingAskWithRunId} reconcile={noopReconcile} />)
    expect(screen.queryByText(NO_DEADLINE_WAITING_LINE)).toBeNull()
    // …and its countdown is untouched.
    expect(screen.getByText(/^\d+:\d{2}$/)).toBeInTheDocument()
  })

  it("has no axe violations with no deadline", async () => {
    const { container } = render(
      <PendingAskCard ask={mockPendingAskNoDeadline()} reconcile={noopReconcile} />,
    )
    expect(await axe(container)).toHaveNoViolations()
  })
})
