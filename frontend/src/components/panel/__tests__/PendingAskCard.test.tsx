/**
 * Phase 087 Plan 05 — PendingAskCard contract (PANEL-04, D-03/D-04/D-05).
 *
 * Wave 0 (Plan 01) shipped this file as GREEN-only `it.todo(...)` contracts;
 * Plan 05 flips them to live tests as the component lands. Fixtures anchor both
 * the GET-reconciled prompt (run_id present) and the pure-SSE prompt (run_id
 * ABSENT — A2 / Pitfall 1: submit must be gated + reconcile triggered).
 */
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest"
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
/**
 * Phase 194.1 Plan 05 Task 3 — the THIRD and FOURTH keys, and needing them is the
 * measurement rather than plumbing.
 *
 * `PendingAskStack` now DERIVES `runIsOver` from the workflow lock and the phase
 * list — two hooks `WorkspacePanel` already calls for its timeline gate. Left out
 * of this explicit object literal they resolve to `undefined` and every case that
 * renders the STACK throws; the cases that render a bare `PendingAskCard` are
 * unaffected, which is itself the proof that the derivation lives in the stack and
 * not in the card.
 *
 * They default to the LIVE-RUN arm (`lock` present, `phases` empty) so every
 * pre-existing case still measures exactly what it measured before this prop
 * existed. `stackState` lets a case move them.
 */
const stackState: {
  lock: { runId: string; mode: "harness"; capPaused: boolean; continuesRemaining: number } | null
  phases: unknown[]
} = {
  lock: { runId: "wr-1", mode: "harness", capPaused: false, continuesRemaining: 3 },
  phases: [],
}
vi.mock("@/providers/StreamsProvider", () => ({
  useViewingThread: () => "thread-1",
  useAskUserPrompt: () => ({
    data: hookState.asks,
    isLoading: false,
    error: null,
    reconcile: hookState.reconcile,
  }),
  useWorkflowLockForThread: () => stackState.lock,
  usePhases: () => ({
    data: stackState.phases,
    isLoading: false,
    error: null,
    reconcile: vi.fn(),
  }),
}))

import {
  NO_DEADLINE_WAITING_LINE,
  RUN_STOPPED_RETIREMENT_LINE,
  PendingAskCard,
  PendingAskStack,
} from "../PendingAskCard"
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — Vite `?raw` import, typed by vite/client at build time only.
import cardSource from "../PendingAskCard.tsx?raw"

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  hookState.asks = []
  hookState.reconcile = vi.fn().mockResolvedValue(undefined)
  // Phase 194.1 Plan 05 — back to the LIVE-RUN arm, for the same reason the two
  // lines above exist: state a previous case left behind is indistinguishable from
  // state this case caused.
  stackState.lock = { runId: "wr-1", mode: "harness", capPaused: false, continuesRemaining: 3 }
  stackState.phases = []
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
  options: ["Approve this step", "Do not run it"],
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

// ─────────────────────────────────────────────────────────────────────────────
// Phase 194.1 Plan 05 Task 3 (R7(b)) — A STOPPED RUN RETIRES ITS APPROVAL WITH A
// SENTENCE, AND NEVER BY REMOVING IT.
//
// THE DEFECT, stated as a measurement: after a Stop, Postgres already reads
// `cancelled` while this card is still fully actionable — a user can pick an
// option and press Send Answer into a run that is over. The server's 404 catches
// it and that authority is UNCHANGED here; what this adds is the client declining
// to OFFER the action first. Defence in depth, not a replacement.
//
// ⚠ RETIRED, NOT REMOVED — a rule across every sketch-170 variant, not a
// preference. A card that vanishes mid-read is its own small dishonesty: the user
// who was halfway through the question cannot tell "the run stopped" from "the app
// lost my question". So the card STAYS, says why, and stops being dispatchable.
//
// ⚠ NO NEW `useState`. The card already carries NINE; a tenth for a fact derivable
// from two hooks the panel already calls would be the second-concern failure D-03
// forbids. The arm is DERIVED and short-circuits ABOVE `canSubmit`, which is why
// `canSubmit`'s own `state === "pending"` conjunct is byte-untouched.
describe("PendingAskCard (194.1-05 / R7(b)) — retired by a stopped run, never removed", () => {
  const ASK = mockPendingAskWithRunId

  function renderRetired() {
    return render(<PendingAskCard ask={ASK} reconcile={noopReconcile} runIsOver />)
  }

  it("the card is STILL IN THE DOM after the run is over — it is retired, not removed", () => {
    renderRetired()
    // The question the user was reading is still readable. This is the assertion
    // P3 (remove-the-card) reds against.
    expect(screen.getByText(ASK.prompt)).toBeInTheDocument()
  })

  it("says the RUN WAS STOPPED, in the exported constant's own words", () => {
    renderRetired()
    expect(screen.getByText(RUN_STOPPED_RETIREMENT_LINE)).toBeInTheDocument()
    // The sentence must actually name the event. A retirement that does not say
    // WHY is just the calm expired state the card already had.
    expect(RUN_STOPPED_RETIREMENT_LINE.toLowerCase()).toContain("stopped")
  })

  /**
   * ⚠ THE NAIVE FORM OF THIS CASE PASSES VACUOUSLY, AND IT WAS CAUGHT BY RUNNING
   * THE RED GATE RATHER THAN BY READING IT. Rendering a retired card cold and
   * asserting `disabled === true` proves NOTHING: `canSubmit` requires
   * `hasAnswer`, so a plain `pending` card with no option chosen is ALREADY
   * disabled on both axes. That version of the assertion was green against a
   * component with no retirement arm at all — it would have shipped a fence P4
   * could not red.
   *
   * The honest form drives the LIVED sequence on ONE instance: the user picks an
   * answer (proving the button is genuinely enabled first), and only THEN does the
   * run end. The enabled→disabled transition on the same node is the measurement;
   * either half alone is not.
   */
  it("a chosen answer becomes UNDISPATCHABLE when the run ends — BOTH disabled and aria-disabled", async () => {
    const user = userEvent.setup()
    const { rerender } = render(
      <PendingAskCard ask={ASK} reconcile={noopReconcile} runIsOver={false} />,
    )
    await user.click(screen.getByText("prod_sales_2026"))

    // PRECONDITION, asserted rather than assumed: it really is dispatchable now.
    const before = screen.getByRole("button", { name: /send answer/i }) as HTMLButtonElement
    expect(before.disabled).toBe(false)
    expect(before.getAttribute("aria-disabled")).toBe("false")

    // …the run is stopped.
    rerender(<PendingAskCard ask={ASK} reconcile={noopReconcile} runIsOver />)

    // ⚠ BOTH axes, never one. `disabled` is what the BROWSER honours and
    // `aria-disabled` is what a SCREEN READER announces; the shipped card drives
    // both from one `canSubmit`, and a retirement touching only one would make the
    // two audiences disagree. This is the assertion P4 reds against.
    const after = screen.getByRole("button", { name: /send answer/i }) as HTMLButtonElement
    expect(after.disabled).toBe(true)
    expect(after.getAttribute("aria-disabled")).toBe("true")

    // …and pressing it dispatches nothing. A `disabled` attribute that some later
    // refactor routed around would still satisfy the two clauses above.
    await user.click(after).catch(() => {})
    expect(vi.mocked(answerAskUser)).not.toHaveBeenCalled()
  })

  it("announces itself as a live region, like the expired arm whose shape it borrows", () => {
    renderRetired()
    expect(screen.getByRole("status")).toBeInTheDocument()
  })

  /**
   * The negative half. Without it, "retired when runIsOver" is equally consistent
   * with a card that is ALWAYS retired — and a fence that cannot tell those apart
   * has measured nothing.
   */
  it("a LIVE run's card is untouched — dispatchable, and carrying none of the retirement copy", async () => {
    const user = userEvent.setup()
    render(<PendingAskCard ask={ASK} reconcile={noopReconcile} runIsOver={false} />)
    await user.click(screen.getByText("prod_sales_2026"))
    const btn = screen.getByRole("button", { name: /send answer/i }) as HTMLButtonElement
    expect(btn.disabled).toBe(false)
    expect(btn.getAttribute("aria-disabled")).toBe("false")
    expect(screen.queryByText(RUN_STOPPED_RETIREMENT_LINE)).toBeNull()
  })

  it("the prop is OPTIONAL and defaults to live — every existing caller is unchanged", async () => {
    const user = userEvent.setup()
    render(<PendingAskCard ask={ASK} reconcile={noopReconcile} />)
    await user.click(screen.getByText("prod_sales_2026"))
    const btn = screen.getByRole("button", { name: /send answer/i }) as HTMLButtonElement
    expect(btn.disabled).toBe(false)
    expect(screen.queryByText(RUN_STOPPED_RETIREMENT_LINE)).toBeNull()
  })

  it("has no axe violations in the retired arm", async () => {
    const { container } = renderRetired()
    expect(await axe(container)).toHaveNoViolations()
  })

  /**
   * ⚠ THE DERIVATION'S TWO CONJUNCTS, EACH SHOWN TO MATTER SEPARATELY. This is the
   * lesson `api/runs.py`'s ledger row states in the backend and it applies here
   * unchanged: *a clause whose only test is a world where a sibling clause also
   * holds has never actually been tested.* `runIsOver = lock == null && phases > 0`
   * has exactly two ways to be wrong, and they point in OPPOSITE directions, so a
   * single "retired when the run is over" case cannot see either.
   */
  describe("the runIsOver derivation, driven through PendingAskStack", () => {
    beforeEach(() => {
      hookState.asks = [ASK]
    })

    it("retires when the lock is cleared AND phases exist (the run ended)", () => {
      stackState.lock = null
      stackState.phases = [{ slug: "p0" }]
      render(<PendingAskStack />)
      expect(screen.getByText(RUN_STOPPED_RETIREMENT_LINE)).toBeInTheDocument()
    })

    it("does NOT retire on a DEEP thread — no lock, but no phases either", () => {
      // ⚠ `lock == null` ALONE is true here. Retiring on it would kill every Deep
      // `ask_user` prompt the instant it appeared — a thread with no run to stop
      // must keep its approvals answerable.
      stackState.lock = null
      stackState.phases = []
      render(<PendingAskStack />)
      expect(screen.queryByText(RUN_STOPPED_RETIREMENT_LINE)).toBeNull()
      expect(screen.getByText(ASK.prompt)).toBeInTheDocument()
    })

    it("does NOT retire MID-RUN — phases exist, but the lock is still held", () => {
      // ⚠ `phases.length > 0` ALONE is true here. Retiring on it would kill a LIVE
      // prompt the moment its first phase row landed — the same defect Task 1 just
      // removed from the panel's Stop row, in a new place.
      stackState.lock = { runId: "wr-1", mode: "harness", capPaused: false, continuesRemaining: 3 }
      stackState.phases = [{ slug: "p0" }]
      render(<PendingAskStack />)
      expect(screen.queryByText(RUN_STOPPED_RETIREMENT_LINE)).toBeNull()
    })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Phase 194.1 Plan 05 Task 3 — FOUR retirements must wear FOUR coats.
//
// ⚠ THE THREE SHIPPED SENTENCES ARE **READ FROM SOURCE**, NEVER RE-TYPED. A fence
// built on a re-typed literal tests the typing. The extraction recipes are the ones
// `194.1-BASELINE.md` §9 recorded, including its two measured traps:
//   · Trap 1 — they are NOT three parallel strings. (b) is a TEMPLATE literal and
//     the other two are constants, so a fence that harvests double-quoted literals
//     finds two and silently thinks it found three.
//   · Trap 2 — a RAW sweep for (b) reds on the PROSE DOCUMENTING it: the sentence
//     appears in double quotes inside the NaN/0 guard's comment. Comments are
//     stripped FIRST, and the comment mention is separately asserted PRESENT so the
//     strip can never cover for a real absence.
// ⚠ §9's standing instruction holds: a later plan must NOT "fix" a red here by
// deleting that comment. It documents a real guard; the FENCE would be what is
// mis-scoped, never the documentation.
describe("PendingAskCard (194.1-05) — the four retirement sentences are pairwise distinct", () => {
  const src = cardSource as string
  const codeOnly = src
    .split("\n")
    .filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*"))
    .join("\n")

  it("the swept source is real and is the right file (an absence fence cannot detect its own blindness)", () => {
    expect(typeof src).toBe("string")
    expect(src.length).toBeGreaterThan(10000)
    expect(src).toContain("export function PendingAskCard")
    expect(codeOnly.length).toBeGreaterThan(3000)
  })

  it("all four are pairwise distinct AND share no complete sentence", () => {
    // (a) the 404-expiry constant, (b) the countdown template, (c) the no-deadline
    // fallback — all three READ out of the module's own source.
    const a = codeOnly.match(/setExpiredMessage\(\s*"([^"]+)"\s*\)/)![1]
    const b = codeOnly.match(/`(No response within \$\{[^}]+\} — agent stopped)`/)![1]
    const c = codeOnly.match(/"(This prompt is no longer active)"/)![1]
    // (d) is THIS plan's, imported from the module rather than typed here.
    const d = RUN_STOPPED_RETIREMENT_LINE

    // Every extraction actually found something — otherwise the distinctness below
    // is a set of comparisons over `undefined`.
    for (const s of [a, b, c, d]) {
      expect(typeof s).toBe("string")
      expect(s.length).toBeGreaterThan(20)
    }

    const all = [a, b, c, d]
    expect(new Set(all).size).toBe(4)

    // ⚠ THE STRONGER CLAUSE, AND THE ONE THAT ACTUALLY FIRES. 193.2 measured a
    // fence asserting only `a !== b` passing a real plant that swapped one arm's
    // SECOND sentence for another arm's while leaving the strings unequal. So split
    // on the em-dash and the sentence terminators and require NO overlap.
    //
    // ⚠ ALL SIX PAIRS, not three. A fence over a subset is passed by a plant that
    // reuses the pair it does not check.
    const sentences = (s: string) =>
      s
        .split(/[—.!?]/)
        .map((x) => x.trim().toLowerCase())
        .filter((x) => x.length > 8)
    const parts = all.map(sentences)
    const pairs: Array<[number, number]> = [
      [0, 1],
      [0, 2],
      [0, 3],
      [1, 2],
      [1, 3],
      [2, 3],
    ]
    expect(pairs).toHaveLength(6)
    for (const [i, j] of pairs) {
      expect(
        parts[i].filter((s) => parts[j].includes(s)),
        `sentences ${i} and ${j} share a complete sentence`,
      ).toHaveLength(0)
    }

    // ⚠ (a) and (c) BOTH open with "This prompt" and that is NOT a violation — the
    // clause is about complete sentences, not shared prefixes (§9 Trap 3). Asserted
    // positively so a later plan does not "fix" a non-problem by rewording shipped
    // copy nobody asked it to touch.
    expect(a.startsWith("This prompt")).toBe(true)
    expect(c.startsWith("This prompt")).toBe(true)
  })

  it("§9 Trap 2 is still real — (b) IS quoted in a comment, which is why the strip is what makes the fence honest", () => {
    // The comment mention is asserted PRESENT so nobody later reads the strip as
    // covering for an absence — and so nobody "fixes" a future red by deleting it.
    expect(src).toContain('"No response within 0:00 — agent stopped"')
    expect(codeOnly).not.toContain('"No response within')
  })

  it("the shared-complete-sentence clause DOES fire when two arms are collapsed (positive control)", () => {
    const collapsed = ["one thing here — same tail sentence", "two things — same tail sentence"]
    const sentences = (s: string) =>
      s.split(/[—.!?]/).map((x) => x.trim().toLowerCase()).filter((x) => x.length > 8)
    const [x, y] = collapsed.map(sentences)
    expect(x.filter((s) => y.includes(s))).not.toHaveLength(0)
  })
})
