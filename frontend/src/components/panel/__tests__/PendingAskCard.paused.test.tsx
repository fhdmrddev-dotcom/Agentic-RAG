/**
 * Phase 289 (289-01, D-13 / SEED-360 F-1) — a PAUSED run's card keeps its answer control.
 *
 * Before 289 the card flipped to `expired` purely on its countdown and read
 * "No response within 0:30 — agent stopped", with no answer control — on a run that was
 * paused and still waiting for that very answer (288-VALIDATION.md, F-1). The run page knows
 * the run's status, so it passes `paused`; the card then keeps the existing live-answer layout
 * (choices, free text, Send) and shows PAUSED_WAITING_LINE where the clock was.
 *
 * ⚠ The line makes NO claim that the run continues: that sentence comes back only after the
 * paused-then-answered path is driven green live (S5, plan 05).
 *
 * Every caller that does not pass `paused` (the chat panel's PendingAskStack among them) must
 * be behaviourally unchanged — the last case pins that.
 */
import { describe, it, expect, vi, afterEach } from "vitest"
import { act, render, screen, cleanup } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { mockPendingAskWithRunId } from "./fixtures"
import type { PendingAsk } from "@/types"

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

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api")
  return {
    ...actual,
    answerAskUser: vi.fn().mockResolvedValue(undefined),
  }
})
import { answerAskUser, ApiError } from "@/lib/api"
import { PAUSED_WAITING_LINE, PendingAskCard } from "../PendingAskCard"

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const noopReconcile = () => Promise.resolve()

/** A prompt whose 30 s window passed ten minutes ago: initial remaining is 0. */
const PAST_WINDOW: PendingAsk = {
  ...mockPendingAskWithRunId,
  tool_call_id: "tc-paused-1",
  run_id: "wr-paused-1",
  timeout_seconds: 30,
  created_at: new Date(Date.now() - 600_000).toISOString(),
}

describe("PendingAskCard paused (289-01 / D-13)", () => {
  it("keeps the answer control after the window when the run is paused, and never says 'agent stopped'", () => {
    render(<PendingAskCard ask={PAST_WINDOW} reconcile={noopReconcile} paused />)

    expect(screen.getByRole("button", { name: /send answer/i })).toBeInTheDocument()
    expect(screen.getAllByRole("radio").length).toBe(PAST_WINDOW.options!.length)
    expect(screen.getByRole("textbox")).toBeInTheDocument()
    expect(screen.queryByText(/agent stopped/)).toBeNull()
    expect(screen.queryByText("Expired")).toBeNull()
    expect(screen.getByText(PAUSED_WAITING_LINE)).toBeInTheDocument()
    // The clock is replaced, not shown at 0:00.
    expect(screen.queryByText("0:00")).toBeNull()
  })

  it("makes no claim that the run continues (that sentence waits for S5)", () => {
    expect(PAUSED_WAITING_LINE).not.toMatch(/continue/i)
    expect(PAUSED_WAITING_LINE).toMatch(/paused/i)
  })

  it("answers with the WORKFLOW run id and reaches the answered state", async () => {
    const user = userEvent.setup()
    render(<PendingAskCard ask={PAST_WINDOW} reconcile={noopReconcile} paused />)

    await user.click(screen.getAllByRole("radio")[0])
    await user.click(screen.getByRole("button", { name: /send answer/i }))

    expect(vi.mocked(answerAskUser)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(answerAskUser).mock.calls[0][0]).toBe("wr-paused-1")
    expect(vi.mocked(answerAskUser).mock.calls[0][1]).toMatchObject({
      tool_call_id: "tc-paused-1",
    })
    expect(await screen.findByText(/You answered/)).toBeInTheDocument()
  })

  it("289-REVIEW CR-02: a card that counted down to expired comes back when the run turns paused", () => {
    // The live path: the person is watching the page, the client clock reaches 0 before the
    // page's 5 s run poll reports `paused`, then the poll lands. The card is keyed on
    // tool_call_id, so it keeps its local state across that re-render.
    vi.useFakeTimers()
    try {
      const fresh: PendingAsk = {
        ...PAST_WINDOW,
        tool_call_id: "tc-paused-live",
        timeout_seconds: 2,
        created_at: new Date().toISOString(),
      }
      const { rerender } = render(<PendingAskCard ask={fresh} reconcile={noopReconcile} />)
      // one tick per act: each second's timeout is scheduled by the previous render's effect
      for (let i = 0; i < 4; i++) {
        act(() => {
          vi.advanceTimersByTime(1_000)
        })
      }
      expect(screen.getByText(/agent stopped/i)).toBeInTheDocument()
      expect(screen.queryByRole("button", { name: /send answer/i })).toBeNull()

      rerender(<PendingAskCard ask={fresh} reconcile={noopReconcile} paused />)

      expect(screen.getByRole("button", { name: /send answer/i })).toBeInTheDocument()
      expect(screen.getByText(PAUSED_WAITING_LINE)).toBeInTheDocument()
      expect(screen.queryByText(/agent stopped/i)).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it("289-REVIEW CR-02: a server-driven expiry (404) is terminal and stays expired while paused", async () => {
    vi.mocked(answerAskUser).mockRejectedValueOnce(new ApiError("gone", 404))
    const user = userEvent.setup()
    const ask: PendingAsk = { ...PAST_WINDOW, tool_call_id: "tc-paused-404" }
    const { rerender } = render(<PendingAskCard ask={ask} reconcile={noopReconcile} paused />)

    await user.click(screen.getAllByRole("radio")[0])
    await user.click(screen.getByRole("button", { name: /send answer/i }))
    expect(await screen.findByText(/the run is no longer active/i)).toBeInTheDocument()

    rerender(<PendingAskCard ask={ask} reconcile={noopReconcile} paused />)
    expect(screen.getByText(/the run is no longer active/i)).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /send answer/i })).toBeNull()
  })

  it("without `paused` (every existing caller) the same past-window card still expires as before", () => {
    render(<PendingAskCard ask={PAST_WINDOW} reconcile={noopReconcile} />)

    expect(screen.getByText(/no response within 0:30 — agent stopped/i)).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /send answer/i })).toBeNull()
  })
})
