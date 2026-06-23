/**
 * Phase 123 Plan 05 Task 2a (TRIG-01) — ProviderScoreboard + CandidateCard tests.
 *
 * The load-bearing, no-analog contract (sketch 042-A provider-set adaptivity band +
 * RESEARCH Pattern 4). These assertions are the ORDERING GATE for Task 2b — they MUST
 * be GREEN before the case-editor / live-run compose proceeds.
 *
 * ProviderScoreboard (T-123-05-01 honesty):
 *  - N-column = the org's configured targets: a 3-provider set renders EXACTLY 3
 *    columns; a 1-provider set renders ONE column with NO "degraded"/"missing"
 *    affordance (single-provider is the CLEAN baseline, not a degraded mode).
 *  - a provider NOT in the target set NEVER renders (a score you can't act on is a
 *    fabricated measurement).
 *  - EVERY cell shows BOTH a fires (should-trigger recall) AND a no-false (should-NOT
 *    precision) sub-score — neither hidden to hover / a hidden aggregate.
 *  - OpenRouter and a native provider (zhipu / z-ai) render as DISTINCT columns.
 *
 * CandidateCard (T-123-05-02 author-confirm, no auto-apply):
 *  - shows the candidate's held-out score.
 *  - selecting "Use" reveals an explicit diff-confirm strip (old vs new); confirming
 *    calls onConfirm (which wraps updateSkill) — nothing auto-applies.
 */
import { describe, it, expect, vi } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { ProviderScoreboard } from "./ProviderScoreboard"
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

describe("ProviderScoreboard — N-column provider-set adaptivity (042-A)", () => {
  it("a 3-provider target set renders EXACTLY 3 columns", () => {
    const cells = [
      cell("openai", "gpt-5.4-mini", 0.9, 0.85, 0.875),
      cell("anthropic", "claude-haiku-4-5", 0.95, 0.9, 0.925),
      cell("google", "gemini-3.5-flash", 0.8, 0.75, 0.775),
    ]
    render(<ProviderScoreboard cells={cells} />)
    const columns = screen.getAllByTestId("scoreboard-cell")
    expect(columns).toHaveLength(3)
  })

  it("a 1-provider target set renders ONE column with NO degraded/missing affordance (clean baseline)", () => {
    const cells = [cell("anthropic", "claude-haiku-4-5", 0.92, 0.88, 0.9)]
    render(<ProviderScoreboard cells={cells} />)
    const columns = screen.getAllByTestId("scoreboard-cell")
    expect(columns).toHaveLength(1)
    // single-provider is the CLEAN baseline — never a degraded / missing label.
    const board = screen.getByTestId("provider-scoreboard")
    expect(board.textContent).not.toMatch(/degraded/i)
    expect(board.textContent).not.toMatch(/missing/i)
    expect(board.textContent).not.toMatch(/unavailable/i)
  })

  it("a provider NOT in the target set never renders (no fabricated column)", () => {
    const cells = [
      cell("openai", "gpt-5.4-mini", 0.9, 0.85, 0.875),
      cell("anthropic", "claude-haiku-4-5", 0.95, 0.9, 0.925),
    ]
    render(<ProviderScoreboard cells={cells} />)
    const board = screen.getByTestId("provider-scoreboard")
    // google was never a target → its label must not appear anywhere.
    expect(board.textContent?.toLowerCase()).not.toContain("google")
    expect(board.textContent?.toLowerCase()).not.toContain("gemini")
    expect(screen.getAllByTestId("scoreboard-cell")).toHaveLength(2)
  })

  it("EVERY cell shows BOTH a fires AND a no-false sub-score (never a hidden aggregate)", () => {
    const cells = [
      cell("openai", "gpt-5.4-mini", 0.9, 0.85, 0.875),
      cell("anthropic", "claude-haiku-4-5", 0.95, 0.9, 0.925),
    ]
    render(<ProviderScoreboard cells={cells} />)
    for (const el of screen.getAllByTestId("scoreboard-cell")) {
      // both sub-scores are LABELED in each cell (the false-fire rail is never hidden).
      expect(within(el).getByTestId("cell-fires")).toBeTruthy()
      expect(within(el).getByTestId("cell-no-false")).toBeTruthy()
      expect(el.textContent?.toLowerCase()).toContain("fires")
      expect(el.textContent?.toLowerCase()).toContain("no-false")
    }
  })

  it("OpenRouter and a native provider (z-ai / zhipu) render as DISTINCT columns", () => {
    const cells = [
      cell("openrouter", "z-ai/glm-5.1", 0.7, 0.6, 0.65),
      cell("zhipu", "glm-5.1", 0.85, 0.8, 0.825),
    ]
    render(<ProviderScoreboard cells={cells} />)
    const columns = screen.getAllByTestId("scoreboard-cell")
    expect(columns).toHaveLength(2)
    const board = screen.getByTestId("provider-scoreboard")
    expect(board.textContent?.toLowerCase()).toContain("openrouter")
    expect(board.textContent?.toLowerCase()).toContain("zhipu")
  })
})

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
