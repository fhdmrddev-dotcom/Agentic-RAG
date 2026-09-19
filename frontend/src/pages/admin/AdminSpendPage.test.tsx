import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, waitFor, cleanup, act } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { AdminSpendPage } from "./AdminSpendPage"
import * as spendApi from "@/api/spend"
import type { SpendSummaryData, SpendRunItem, ModelRateItem } from "@/types/spend"

afterEach(() => {
  cleanup()
})

vi.mock("@/api/spend", () => ({
  getSpendSummary: vi.fn(),
  getSpendRuns: vi.fn(),
  getModelRates: vi.fn(),
  repriceModel: vi.fn(),
}))

const mockSummary: SpendSummaryData = {
  totalSpendUsd: 148.62,
  ratedRunsCount: 92,
  unratedRunsCount: 8,
  incompleteCoverageCount: 5,
  totalInputTokens: 41500000,
  totalOutputTokens: 6700000,
  dailySpend: [
    { date: "2026-09-18", dayLabel: "09/18", spendUsd: 12.45, unratedCount: 1 },
    { date: "2026-09-19", dayLabel: "09/19", spendUsd: 8.20, unratedCount: 0 },
  ],
  modelBreakdown: [
    { modelId: "gpt-4o", spendUsd: 80.5, percentage: 54, color: "hsl(142 71% 45%)" },
    { modelId: "claude-3-5-sonnet", spendUsd: 42.0, percentage: 28, color: "hsl(25 95% 53%)" },
  ],
}

const mockRuns: SpendRunItem[] = [
  {
    id: "run-rated-001",
    name: "Doc Ingestion Analysis",
    model: "gpt-4o",
    provider: "openai",
    status: "completed",
    createdAt: "2026-09-19T02:00:00Z",
    inputTokens: 1000,
    outputTokens: 500,
    costUsd: 0.0075,
    isRated: true,
    tokenCoverage: ["agent", "single", "batch", "emit"],
  },
  {
    id: "run-unrated-002",
    name: "Unrated Model Run",
    model: "custom-local-llm",
    provider: "lmstudio",
    status: "completed",
    createdAt: "2026-09-19T02:10:00Z",
    inputTokens: 5000,
    outputTokens: 2000,
    costUsd: null,
    isRated: false,
    tokenCoverage: ["agent", "single"],
  },
]

const mockRates: ModelRateItem[] = [
  {
    id: "rate-1",
    modelName: "gpt-4o",
    provider: "openai",
    inputCostPerMillion: "2.500000",
    outputCostPerMillion: "10.000000",
    effectiveFrom: "2026-01-01T00:00:00Z",
    effectiveTo: null,
    orgId: null,
    createdAt: "2026-01-01T00:00:00Z",
  },
]

describe("AdminSpendPage (METER-07)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(spendApi.getSpendSummary).mockResolvedValue(mockSummary)
    vi.mocked(spendApi.getSpendRuns).mockResolvedValue({
      runs: mockRuns,
      totalCount: mockRuns.length,
      limit: 50,
      offset: 0,
    })
    vi.mocked(spendApi.getModelRates).mockResolvedValue(mockRates)
  })

  it("renders cockpit title and KPI metrics with unrated asterisk disclaimer", async () => {
    render(<AdminSpendPage />)

    await waitFor(() => {
      expect(screen.getByText("Spend & Metering")).toBeInTheDocument()
      expect(screen.getByText("$148.6200")).toBeInTheDocument()
    })

    // Check footnote with strict anti-falsehood disclaimer
    expect(screen.getByText(/\* 92 runs priced · 8 unrated excluded/i)).toBeInTheDocument()
  })

  it("renders unrated runs with '▲ Unrated' badge and NEVER renders $0.00", async () => {
    render(<AdminSpendPage />)

    await waitFor(() => {
      expect(screen.getByText("run-unrated-002".slice(0, 8) + "…")).toBeInTheDocument()
    })

    // Rated run displays its attributable cost
    expect(screen.getByText("$0.0075")).toBeInTheDocument()

    // Unrated run MUST display '▲ Unrated'
    const unratedBadge = screen.getByText("▲ Unrated")
    expect(unratedBadge).toBeInTheDocument()
    expect(unratedBadge).toHaveAttribute("title", "Model 'custom-local-llm' has no registered rate")

    // STRICT INVARIANT: The page must NEVER display "$0.00" or "$0.0000" for an unrated run
    const zeroSpendMatches = screen.queryAllByText(/^\$0\.00(00)?$/)
    expect(zeroSpendMatches.length).toBe(0)
  })

  it("updates spend runs list when coverage filter pills are clicked", async () => {
    const user = userEvent.setup()
    render(<AdminSpendPage />)

    await waitFor(() => {
      expect(screen.getByText("Has Unrated")).toBeInTheDocument()
    })

    await user.click(screen.getByText("Has Unrated"))

    await waitFor(() => {
      expect(spendApi.getSpendRuns).toHaveBeenCalledWith(
        expect.objectContaining({
          filterStatus: "unrated",
        })
      )
    })
  })

  it("renders the 'What This View Cannot See' honesty card with quick actions", async () => {
    const user = userEvent.setup()
    render(<AdminSpendPage />)

    await waitFor(() => {
      expect(screen.getByText("$148.6200")).toBeInTheDocument()
    })
    expect(screen.getByRole("heading", { name: /What This View Cannot See/i })).toBeInTheDocument()
    expect(screen.getByText("View 8 Unrated Runs →")).toBeInTheDocument()
    expect(screen.getByText("View 5 Incomplete Coverage Runs →")).toBeInTheDocument()

    // Clicking 'View 8 Unrated Runs →' switches coverage filter to 'unrated'
    await user.click(screen.getByText("View 8 Unrated Runs →"))

    await waitFor(() => {
      expect(spendApi.getSpendRuns).toHaveBeenCalledWith(
        expect.objectContaining({
          filterStatus: "unrated",
        })
      )
    })
  })

  it("switches to Active Rate Registry tab and displays registered rates", async () => {
    const user = userEvent.setup()
    render(<AdminSpendPage />)

    await waitFor(() => {
      expect(screen.getByText("$148.6200")).toBeInTheDocument()
      expect(screen.getByText("Active Rate Registry (1)")).toBeInTheDocument()
    })

    const ratesButton = screen.getByRole("button", { name: /Active Rate Registry/i })
    act(() => {
      ratesButton.click()
    })

    await waitFor(() => {
      expect(screen.getByText(/Prompt Rate/i)).toBeInTheDocument()
    })
  })

  it("opens Reprice Model modal with strict append-only disclaimer", async () => {
    const user = userEvent.setup()
    render(<AdminSpendPage />)

    await waitFor(() => {
      expect(screen.getByText("$148.6200")).toBeInTheDocument()
      expect(screen.getByRole("button", { name: /Reprice Model/i })).toBeInTheDocument()
    })

    await user.click(screen.getByRole("button", { name: /Reprice Model/i }))

    await waitFor(() => {
      expect(screen.getByText(/Reprice Model Rate/i)).toBeInTheDocument()
      expect(
        screen.getByText(/Repricing is strictly append-only/i)
      ).toBeInTheDocument()
    })
  })
})
