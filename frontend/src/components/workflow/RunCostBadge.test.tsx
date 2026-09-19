import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { RunCostBadge } from "./RunCostBadge"

describe("RunCostBadge (METER-07)", () => {
  it("renders rated dollar amount formatted to 4 decimal places with complete coverage", () => {
    render(
      <RunCostBadge
        costUsd={1.316}
        isRated={true}
        tokenCoverage={["agent", "single", "batch", "emit"]}
      />
    )

    expect(screen.getByText("$1.3160")).toBeInTheDocument()
    expect(screen.queryByTestId("incomplete-coverage-asterisk")).not.toBeInTheDocument()
    expect(screen.queryByTestId("unrated-cost-badge")).not.toBeInTheDocument()
  })

  it("renders amber Unrated badge when isRated is false", () => {
    render(
      <RunCostBadge
        costUsd={null}
        isRated={false}
        unratedModel="deepseek-r1"
      />
    )

    const badge = screen.getByTestId("unrated-cost-badge")
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveTextContent("Unrated")
    expect(badge).toHaveAttribute("title", "Model 'deepseek-r1' has no registered rate")

    // STRICT INVARIANT (D-257-05): Under no circumstance may an unrated run render $0.00
    expect(screen.queryByText(/^\$0\.00(00)?$/)).not.toBeInTheDocument()
  })

  it("renders amber Unrated badge when costUsd is null even if isRated is not specified", () => {
    render(
      <RunCostBadge
        costUsd={null}
        unratedModel="qwen-2.5-72b"
      />
    )

    const badge = screen.getByTestId("unrated-cost-badge")
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveTextContent("Unrated")
    expect(badge).toHaveAttribute("title", "Model 'qwen-2.5-72b' has no registered rate")

    // Must never render $0.00
    expect(screen.queryByText(/^\$0\.00(00)?$/)).not.toBeInTheDocument()
  })

  it("renders cost with warning asterisk when token coverage is incomplete", () => {
    render(
      <RunCostBadge
        costUsd={0.45}
        isRated={true}
        tokenCoverage={["agent", "single"]} // missing batch, emit
      />
    )

    expect(screen.getByText("$0.4500")).toBeInTheDocument()
    const asterisk = screen.getByTestId("incomplete-coverage-asterisk")
    expect(asterisk).toBeInTheDocument()
    expect(asterisk).toHaveTextContent("*")
    expect(asterisk).toHaveAttribute("title", "Incomplete token coverage: lower bound")
  })

  it("renders cost with warning asterisk when tokenCoverage is null or empty", () => {
    render(
      <RunCostBadge
        costUsd={0.075}
        isRated={true}
        tokenCoverage={null}
      />
    )

    expect(screen.getByText("$0.0750")).toBeInTheDocument()
    const asterisk = screen.getByTestId("incomplete-coverage-asterisk")
    expect(asterisk).toBeInTheDocument()
  })

  // ── Phase 257.1 (reviewer) — the THIRD state, and the undefined/null distinction. ─────
  // Both behaviours were introduced by the 257 review's fixes and NOTHING covered them,
  // which is the same gap the review itself raised about this phase: a state you can see in
  // the product and cannot see in a suite is a state that can be deleted silently.

  it("renders 'No tokens recorded' — NOT 'Unrated' — when the model IS rated but no tokens were measured", () => {
    // pricing_service returns is_rated=True, cost_usd=None when both token counts are None.
    // Collapsing that into the unrated branch makes the tooltip state a FALSE cause: the
    // model is priced, the RUN was not measured.
    render(<RunCostBadge costUsd={null} isRated={true} unratedModel="gpt-4o" />)

    const badge = screen.getByTestId("unmeasured-cost-badge")
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveTextContent("No tokens recorded")
    expect(screen.queryByTestId("unrated-cost-badge")).not.toBeInTheDocument()
    expect(screen.queryByText(/no rate registered/i)).not.toBeInTheDocument()
    expect(badge.getAttribute("title")).toMatch(/HAS a registered rate/)
    // ⛔ and the invariant that outranks all of it
    expect(screen.queryByText("$0.0000")).not.toBeInTheDocument()
  })

  it("renders NO coverage asterisk when tokenCoverage is undefined — absent is not incomplete", () => {
    // The chat surface reads `public.runs`, which has no token_coverage column, so it passes
    // nothing. Scoring that as "incomplete" would stamp a false lower-bound marker on every
    // message in the product. Contrast with the `null` case above, which IS incomplete.
    render(<RunCostBadge costUsd={0.075} isRated={true} />)

    expect(screen.getByText("$0.0750")).toBeInTheDocument()
    expect(screen.queryByTestId("incomplete-coverage-asterisk")).not.toBeInTheDocument()
  })
})
