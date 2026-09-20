import { render, screen, fireEvent } from "@testing-library/react"
import { describe, it, expect, vi } from "vitest"
import { ExpertSpotlightCard } from "../ExpertSpotlightCard"
import type { ExpertBundle } from "@/types"

const mockFinancialExpert: ExpertBundle = {
  id: "00000000-0000-0000-0000-000000000259",
  name: "Financial Analyzer",
  slug: "financial-analyzer",
  description: "Specialized SEC 10-K & financial statement analysis",
  scope_mode: "restricted",
  member_skills: ["financial_ratio_calculator"],
  required_connections: [],
  knowledge_folder_ids: ["00000000-0000-0000-0000-000000000260"],
  prompt_suggestions: [],
  visibility: "public",
  is_system: true,
  is_enabled: true,
}

describe("ExpertSpotlightCard (Phase 260 / PACK-03 / D-260-06 / 260-UI-SPEC §2.3-2.4)", () => {
  it("renders expert name, glowing identity, and scope badges without lecturing prose", () => {
    const { container } = render(
      <ExpertSpotlightCard
        expert={mockFinancialExpert}
        onSelectPrompt={vi.fn()}
        onDismiss={vi.fn()}
      />,
    )

    // Name and Scope tag
    expect(screen.getByText("Financial Analyzer")).toBeInTheDocument()
    const scopeTag = screen.getByTestId("expert-scope-tag")
    expect(scopeTag).toHaveTextContent("Restricted")

    // Scope badges (clean tags without didactic paragraphs)
    expect(screen.getByText("SEC Filings & Reports")).toBeInTheDocument()
    expect(screen.getByText("ratio_calculator")).toBeInTheDocument()

    // Acceptance bar: Zero lecturing prose (operator mandate: "Less text, more visuals")
    const cardText = container.textContent || ""
    expect(cardText).not.toContain("retrieval boundary")
    expect(cardText).not.toContain("chat history retention")
    expect(cardText).not.toContain("this consultant will")
  })

  it("displays 3 large Action Tiles with icons, titles, and prompts", () => {
    render(
      <ExpertSpotlightCard
        expert={mockFinancialExpert}
        onSelectPrompt={vi.fn()}
        onDismiss={vi.fn()}
      />,
    )

    const tile0 = screen.getByTestId("action-tile-0")
    const tile1 = screen.getByTestId("action-tile-1")
    const tile2 = screen.getByTestId("action-tile-2")

    expect(tile0).toHaveTextContent("Q3 Revenue Growth YoY")
    expect(tile0).toHaveTextContent("Compare Q3 revenue growth and YoY trajectory from the latest filings.")

    expect(tile1).toHaveTextContent("Gross Margin Comparison")
    expect(tile1).toHaveTextContent("Calculate gross margin and EBITDA breakdown based on reported figures.")

    expect(tile2).toHaveTextContent("Operating Cash Flow")
    expect(tile2).toHaveTextContent("Analyze operating cash flow changes and liquidity position.")
  })

  it("triggers onSelectPrompt with 1-click execution when an Action Tile is clicked", () => {
    const onSelectPrompt = vi.fn()
    render(
      <ExpertSpotlightCard
        expert={mockFinancialExpert}
        onSelectPrompt={onSelectPrompt}
        onDismiss={vi.fn()}
      />,
    )

    const tile0 = screen.getByTestId("action-tile-0")
    fireEvent.click(tile0)

    expect(onSelectPrompt).toHaveBeenCalledTimes(1)
    expect(onSelectPrompt).toHaveBeenCalledWith(
      "Compare Q3 revenue growth and YoY trajectory from the latest filings.",
    )

    const tile1 = screen.getByTestId("action-tile-1")
    fireEvent.click(tile1)
    expect(onSelectPrompt).toHaveBeenCalledWith(
      "Calculate gross margin and EBITDA breakdown based on reported figures.",
    )
  })

  it("triggers onDismiss when close button is clicked", () => {
    const onDismiss = vi.fn()
    render(
      <ExpertSpotlightCard
        expert={mockFinancialExpert}
        onSelectPrompt={vi.fn()}
        onDismiss={onDismiss}
      />,
    )

    const dismissBtn = screen.getByRole("button", { name: /dismiss financial analyzer/i })
    fireEvent.click(dismissBtn)

    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it("renders custom prompt suggestions when provided by expert bundle", () => {
    const customExpert: ExpertBundle = {
      ...mockFinancialExpert,
      prompt_suggestions: [
        { title: "Custom Metric 1", prompt: "Explain the variance in operating expenses" },
        { title: "Custom Metric 2", prompt: "Summarize debt maturity schedule" },
      ],
    }

    const onSelectPrompt = vi.fn()
    render(
      <ExpertSpotlightCard
        expert={customExpert}
        onSelectPrompt={onSelectPrompt}
        onDismiss={vi.fn()}
      />,
    )

    expect(screen.getByText("Custom Metric 1")).toBeInTheDocument()
    expect(screen.getByText("Explain the variance in operating expenses")).toBeInTheDocument()
    expect(screen.getByText("Custom Metric 2")).toBeInTheDocument()

    fireEvent.click(screen.getByTestId("action-tile-0"))
    expect(onSelectPrompt).toHaveBeenCalledWith("Explain the variance in operating expenses")
  })
})
