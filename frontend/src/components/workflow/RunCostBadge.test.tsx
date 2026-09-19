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
})
