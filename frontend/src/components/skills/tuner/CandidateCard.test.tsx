/**
 * Phase 123 Plan 05 Task 2a (TRIG-01) + Phase 123.1 Plan 02 Task 2 (D-11) — CandidateCard tests.
 *
 * CandidateCard (T-123-05-02 author-confirm, no auto-apply):
 *  - shows the candidate's held-out score.
 *  - selecting "Use" reveals an explicit diff-confirm strip (old vs new); confirming
 *    calls onConfirm (which wraps updateSkill) — nothing auto-applies.
 *  - WR-04: a failed save surfaces an inline error, never silent.
 *
 * D-11 (Phase 123.1 Plan 02) — long-description line-clamp + expand:
 *  - a ~1500-char description renders clamped (line-clamp) by default with a Show
 *    more / Show less toggle; expanding removes the clamp.
 *  - the header description AND both sides of the diff-confirm strip clamp+expand.
 *  - the held-out score and the Use action stay visible regardless of length (they
 *    are siblings of the clamped description, never pushed off-screen).
 */
import { describe, it, expect, vi } from "vitest"
import { render, screen, within } from "@testing-library/react"
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

describe("CandidateCard — held-out score + author-confirm, no auto-apply (042-A / D-03)", () => {
  it("shows the candidate's held-out score", () => {
    render(
      <CandidateCard
        candidate={makeCandidate({ held_out_score: 0.83 })}
        isWinner={false}
        currentDescription="old description"
        onConfirm={vi.fn()}
      />,
    )
    const card = screen.getByTestId("candidate-card")
    expect(card.textContent?.toLowerCase()).toContain("held-out")
    expect(card.textContent).toMatch(/0\.83|83/)
  })

  it("selecting Use reveals a diff strip and confirming calls onConfirm — nothing auto-applies", async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    const candidate = makeCandidate({
      description: "Use this skill when the user asks to write or fix SQL queries.",
    })
    render(
      <CandidateCard
        candidate={candidate}
        isWinner={true}
        currentDescription="Fires on SQL."
        onConfirm={onConfirm}
      />,
    )
    // No auto-apply: onConfirm is NOT called on mount.
    expect(onConfirm).not.toHaveBeenCalled()
    // The diff strip is not shown until the author asks for it.
    expect(screen.queryByTestId("candidate-diff-confirm")).toBeNull()

    await user.click(screen.getByRole("button", { name: /use/i }))

    // The diff-confirm strip appears (old vs new visible).
    const strip = screen.getByTestId("candidate-diff-confirm")
    expect(strip.textContent).toContain("Fires on SQL.")
    expect(strip.textContent).toContain(candidate.description)
    // STILL not applied — revealing the diff is not the write.
    expect(onConfirm).not.toHaveBeenCalled()

    await user.click(within(strip).getByRole("button", { name: /confirm|save/i }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(onConfirm).toHaveBeenCalledWith(candidate)
  })

  it("WR-04: a failed save surfaces an inline error and keeps the diff strip open (never silent)", async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn().mockRejectedValue(new Error("Failed to update skill. Please try again."))
    render(
      <CandidateCard
        candidate={makeCandidate()}
        isWinner={true}
        currentDescription="Fires on SQL."
        onConfirm={onConfirm}
      />,
    )
    await user.click(screen.getByRole("button", { name: /use/i }))
    await user.click(within(screen.getByTestId("candidate-diff-confirm")).getByRole("button", { name: /confirm|save/i }))

    // The rejection is caught and surfaced — not swallowed.
    const err = await screen.findByTestId("candidate-save-error")
    expect(err.textContent).toMatch(/failed to update skill/i)
    // The strip stays open (the write failed) and "Saved" never renders.
    expect(screen.getByTestId("candidate-diff-confirm")).toBeTruthy()
    expect(screen.queryByText(/now drives firing/i)).toBeNull()
  })
})

describe("CandidateCard — D-11 long-description line-clamp + expand", () => {
  it("clamps a ~1500-char header description by default and keeps the held-out score + Use action visible", () => {
    render(
      <CandidateCard
        candidate={makeCandidate({ description: LONG_DESC, held_out_score: 0.77 })}
        isWinner={false}
        currentDescription="old description"
        onConfirm={vi.fn()}
      />,
    )
    // The header description is clamped by default (the class is present).
    const desc = screen.getByTestId("candidate-description")
    expect(desc.className).toContain("line-clamp")
    // The held-out score + Use action are siblings — never pushed off-screen by the long text.
    const card = screen.getByTestId("candidate-card")
    expect(card.textContent?.toLowerCase()).toContain("held-out")
    expect(card.textContent).toMatch(/0\.77|77/)
    expect(screen.getByRole("button", { name: /use/i })).toBeTruthy()
    // A show-more toggle is offered for the long text.
    expect(screen.getByRole("button", { name: /show more/i })).toBeTruthy()
  })

  it("Show more removes the clamp (full text) and Show less re-clamps", async () => {
    const user = userEvent.setup()
    render(
      <CandidateCard
        candidate={makeCandidate({ description: LONG_DESC })}
        isWinner={false}
        currentDescription="old description"
        onConfirm={vi.fn()}
      />,
    )
    const desc = screen.getByTestId("candidate-description")
    expect(desc.className).toContain("line-clamp")

    await user.click(screen.getByRole("button", { name: /show more/i }))
    // Expanded — the clamp is removed and the toggle flips to "Show less".
    expect(screen.getByTestId("candidate-description").className).not.toContain("line-clamp")
    expect(screen.getByRole("button", { name: /show less/i })).toBeTruthy()

    await user.click(screen.getByRole("button", { name: /show less/i }))
    expect(screen.getByTestId("candidate-description").className).toContain("line-clamp")
  })

  it("clamps BOTH sides of the diff-confirm strip (current + new) and the Use→confirm action stays reachable", async () => {
    const user = userEvent.setup()
    render(
      <CandidateCard
        candidate={makeCandidate({ description: LONG_DESC })}
        isWinner={true}
        currentDescription={LONG_DESC}
        onConfirm={vi.fn()}
      />,
    )
    await user.click(screen.getByRole("button", { name: /use/i }))
    const strip = screen.getByTestId("candidate-diff-confirm")
    // both the line-through current AND the new description clamp by default.
    const current = within(strip).getByTestId("diff-current")
    const next = within(strip).getByTestId("diff-new")
    expect(current.className).toContain("line-clamp")
    expect(next.className).toContain("line-clamp")
    // the Confirm action is still visible (clamp didn't bury it).
    expect(within(strip).getByRole("button", { name: /confirm|save/i })).toBeTruthy()

    // expanding the diff reveals both sides in full.
    await user.click(within(strip).getByRole("button", { name: /show more/i }))
    expect(within(screen.getByTestId("candidate-diff-confirm")).getByTestId("diff-current").className).not.toContain(
      "line-clamp",
    )
    expect(within(screen.getByTestId("candidate-diff-confirm")).getByTestId("diff-new").className).not.toContain(
      "line-clamp",
    )
  })
})
