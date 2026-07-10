/**
 * Phase 123 Plan 05 Task 2a (TRIG-01) + Phase 123.1 Plan 02 Task 2 (D-11)
 * + Phase 139 Plan 05 (SI-02, D-08) — CandidateCard tests.
 *
 * CandidateCard (D-08 propose door, no one-click apply):
 *  - shows the candidate's held-out score.
 *  - the ACTIONABLE winner offers "Propose this description" — clicking it calls
 *    onConfirm (which opens the DescriptionProposalCard review door); nothing is
 *    written directly, and it is NOT called on mount (no auto-apply).
 *  - a BASELINE winner (nothing beat current) shows NO propose affordance (D-02).
 *  - a non-winner candidate shows NO propose affordance (gated on isActionableWinner).
 *  - WR-04: a failed propose surfaces an inline error, never silent.
 *
 * D-11 — long-description line-clamp + expand:
 *  - a ~1500-char description renders clamped (line-clamp) by default with a Show
 *    more / Show less toggle; expanding removes the clamp.
 *  - the held-out score and the propose action stay visible regardless of length.
 */
import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { CandidateCard } from "./CandidateCard"
import type { TunerCell, TunerCandidate } from "@/lib/api"

function cell(provider: string, model: string, fires: number, noFalse: number, score: number): TunerCell {
  return { provider, model, axes: { fires, no_false: noFalse }, score }
}

function makeCandidate(overrides: Partial<TunerCandidate> = {}): TunerCandidate {
  return {
    index: 1,
    description: "Use this skill when the user asks to write or fix SQL queries.",
    cells: [cell("openai", "gpt-5.4-mini", 0.9, 0.8, 0.85)],
    held_out_score: 0.85,
    is_baseline: false,
    ...overrides,
  }
}

// A long (~1500-char) description like the real `docx` skill that buries the score.
const LONG_DESC =
  "Use this skill when the user asks to create, build, generate, write, or update a " +
  "Microsoft Word document (.docx) from the knowledge base. ".repeat(20)

describe("CandidateCard — held-out score + the propose door, no one-click apply (D-08)", () => {
  it("shows the candidate's held-out score", () => {
    render(
      <CandidateCard
        candidate={makeCandidate({ held_out_score: 0.83 })}
        isWinner={false}
        onConfirm={vi.fn()}
      />,
    )
    const card = screen.getByTestId("candidate-card")
    expect(card.textContent?.toLowerCase()).toContain("held-out")
    expect(card.textContent).toMatch(/0\.83|83/)
  })

  it("the actionable winner offers 'Propose this description'; clicking calls onConfirm — no auto-apply", async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    render(<CandidateCard candidate={makeCandidate()} isWinner={true} onConfirm={onConfirm} />)

    // No auto-apply: onConfirm is NOT called on mount.
    expect(onConfirm).not.toHaveBeenCalled()

    // The propose door is the ONLY action — no inline diff-confirm strip.
    const propose = screen.getByRole("button", { name: /propose this description/i })
    expect(propose).toBeInTheDocument()

    await user.click(propose)
    // Clicking opens the review door (onConfirm) — the write itself lives in the review card.
    expect(onConfirm).toHaveBeenCalledTimes(1)
    // After a successful propose the card states the proposal is under review below.
    expect(await screen.findByTestId("candidate-proposed")).toBeInTheDocument()
  })

  it("WR-04: a failed propose surfaces an inline error (never silent)", async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn().mockRejectedValue(new Error("Failed to propose description. Please try again."))
    render(<CandidateCard candidate={makeCandidate()} isWinner={true} onConfirm={onConfirm} />)

    await user.click(screen.getByRole("button", { name: /propose this description/i }))

    const err = await screen.findByTestId("candidate-propose-error")
    expect(err.textContent).toMatch(/failed to propose/i)
    // The propose button stays (retry-able); no false "proposed" state on failure.
    expect(screen.getByRole("button", { name: /propose this description/i })).toBeInTheDocument()
    expect(screen.queryByTestId("candidate-proposed")).toBeNull()
  })
})

describe("CandidateCard — 123.1-rev calibrated winner pop (honest, not misleading)", () => {
  it("an ACTIONABLE winner (a rewrite that beat baseline) shows the loud '★ best held-out' badge + propose CTA", () => {
    render(
      <CandidateCard
        candidate={makeCandidate({ is_baseline: false, held_out_score: 0.94 })}
        isWinner={true}
        onConfirm={vi.fn()}
      />,
    )
    const card = screen.getByTestId("candidate-card")
    expect(card.textContent?.toLowerCase()).toContain("best held-out")
    // The propose door is offered on the actionable winner.
    expect(screen.getByRole("button", { name: /propose this description/i })).toBeTruthy()
  })

  it("a BASELINE winner (nothing beat current) stays CALM — no '★ best held-out', no propose affordance (D-02)", () => {
    render(
      <CandidateCard
        candidate={makeCandidate({ is_baseline: true, held_out_score: 1.0 })}
        isWinner={true}
        onConfirm={vi.fn()}
      />,
    )
    const card = screen.getByTestId("candidate-card")
    // Honesty: the description you ALREADY run must not offer "propose" — the page's
    // winner-verdict banner ("keeping it") owns that message.
    expect(card.textContent?.toLowerCase()).toContain("current (baseline)")
    expect(card.textContent?.toLowerCase()).not.toContain("best held-out")
    expect(screen.queryByRole("button", { name: /propose this description/i })).toBeNull()
  })

  it("a NON-winner candidate shows NO propose affordance (gated on isActionableWinner)", () => {
    render(
      <CandidateCard
        candidate={makeCandidate({ is_baseline: false, held_out_score: 0.5 })}
        isWinner={false}
        onConfirm={vi.fn()}
      />,
    )
    expect(screen.queryByRole("button", { name: /propose this description/i })).toBeNull()
  })
})

describe("CandidateCard — D-11 long-description line-clamp + expand", () => {
  it("clamps a ~1500-char header description by default and keeps the held-out score + propose action visible", () => {
    render(
      <CandidateCard
        candidate={makeCandidate({ description: LONG_DESC, held_out_score: 0.77, is_baseline: false })}
        isWinner={true}
        onConfirm={vi.fn()}
      />,
    )
    // The header description is clamped by default (the class is present).
    const desc = screen.getByTestId("candidate-description")
    expect(desc.className).toContain("line-clamp")
    // The held-out score + propose action are siblings — never pushed off-screen by the long text.
    const card = screen.getByTestId("candidate-card")
    expect(card.textContent?.toLowerCase()).toContain("held-out")
    expect(card.textContent).toMatch(/0\.77|77/)
    expect(screen.getByRole("button", { name: /propose this description/i })).toBeTruthy()
    // A show-more toggle is offered for the long text.
    expect(screen.getByRole("button", { name: /show more/i })).toBeTruthy()
  })

  it("Show more removes the clamp (full text) and Show less re-clamps", async () => {
    const user = userEvent.setup()
    render(
      <CandidateCard candidate={makeCandidate({ description: LONG_DESC })} isWinner={false} onConfirm={vi.fn()} />,
    )
    const desc = screen.getByTestId("candidate-description")
    expect(desc.className).toContain("line-clamp")

    await user.click(screen.getByRole("button", { name: /show more/i }))
    expect(screen.getByTestId("candidate-description").className).not.toContain("line-clamp")
    expect(screen.getByRole("button", { name: /show less/i })).toBeTruthy()

    await user.click(screen.getByRole("button", { name: /show less/i }))
    expect(screen.getByTestId("candidate-description").className).toContain("line-clamp")
  })
})
