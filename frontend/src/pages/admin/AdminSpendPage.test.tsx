import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, waitFor, cleanup } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { AdminSpendPage } from "./AdminSpendPage"
import * as spendApi from "@/lib/api/spend"
import type { SpendSummaryData, SpendRunItem, ModelRateItem } from "@/types/spend"

afterEach(() => {
  cleanup()
})

vi.mock("@/lib/api/spend", () => ({
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
    {
      modelId: "gpt-4o",
      spendUsd: 80.5,
      percentage: 54,
      color: "hsl(142 71% 45%)",
      runCount: 50,
      ratedCount: 50,
      unratedCount: 0,
      isRated: true,
    },
    {
      modelId: "claude-3-5-sonnet",
      spendUsd: 42.0,
      percentage: 28,
      color: "hsl(25 95% 53%)",
      runCount: 30,
      ratedCount: 30,
      unratedCount: 0,
      isRated: true,
    },
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
    await user.click(ratesButton)

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

  // ── Phase 257.1 — the page must own its own scroll. ──────────────────────────────────
  // Operator on the shipped page: *"I see a lot of information that's good but it is not
  // scrolling down."* The root carried `flex-1 overflow-y-auto`, but ChatLayout mounts this
  // into `<main className="flex-1 overflow-hidden">` which is NOT a flex container — so
  // `flex-1` was inert, the root had no constrained height, and `overflow-y-auto` on an
  // element as tall as its own content never scrolls. Everything below the fold was
  // rendering and unreachable.
  //
  // ⛔ ASSERTING CLASSES IS NORMALLY WEAK — this repo's own rule is that a presence
  // assertion cannot see content drift. Here the class IS the deliverable: there is no
  // rendered text that differs between a page that scrolls and one that does not, and
  // jsdom has no layout engine to measure a real scroll with. So the classes are the only
  // honest thing to bind, and `h-full` + `min-h-0` are named individually rather than as a
  // whole className string, so reordering or adding a utility does not false-fail.
  // ── Phase 257.1 — the time chip must reach the CHARTS, not only the ledger. ──────────
  // Operator: *"the filter is working but it is not working on the charts and visuals, it
  // is working on the entries below it."* The two endpoints speak different dialects of the
  // same filter (`/runs` takes `time_range`, `/summary` takes `start_time`) and the page
  // called `getSpendSummary()` bare, so every summary-fed region answered about all-time.
  // These cases bind the ARGUMENT, because that is the whole defect — the rendering was
  // always correct, it was being handed the wrong population.

  it("passes a start_time window to the SUMMARY, not just a time_range to the ledger", async () => {
    render(<AdminSpendPage />)
    await waitFor(() => {
      expect(spendApi.getSpendSummary).toHaveBeenCalled()
    })
    // default chip is 30d → the summary must be scoped, never called bare
    const arg = vi.mocked(spendApi.getSpendSummary).mock.calls[0]?.[0]
    expect(arg).toBeDefined()
    expect(arg?.startTime).toEqual(expect.any(String))
    expect(Number.isNaN(Date.parse(arg!.startTime!))).toBe(false)
  })

  it("re-scopes the summary when the time chip changes, and drops the window on All Time", async () => {
    const user = userEvent.setup()
    render(<AdminSpendPage />)
    await waitFor(() => expect(spendApi.getSpendSummary).toHaveBeenCalled())

    await user.click(screen.getByRole("button", { name: /^7D$/ }))
    await waitFor(() => {
      const last = vi.mocked(spendApi.getSpendSummary).mock.calls.at(-1)?.[0]
      expect(last?.startTime).toEqual(expect.any(String))
    })
    const sevenDay = vi.mocked(spendApi.getSpendSummary).mock.calls.at(-1)![0]!.startTime!

    await user.click(screen.getByRole("button", { name: /All Time/i }))
    await waitFor(() => {
      const last = vi.mocked(spendApi.getSpendSummary).mock.calls.at(-1)?.[0]
      // ⛔ undefined, not a very old date — "all time" must send NO lower bound, so the
      // server decides the horizon rather than the client guessing one.
      expect(last?.startTime).toBeUndefined()
    })

    // and 7d is a tighter window than the 30d default it replaced
    const firstCall = vi.mocked(spendApi.getSpendSummary).mock.calls[0]![0]!.startTime!
    expect(Date.parse(sevenDay)).toBeGreaterThan(Date.parse(firstCall))
  })

  it("names the coverage filter's scope, because /summary has no status parameter", async () => {
    const user = userEvent.setup()
    render(<AdminSpendPage />)
    await waitFor(() => expect(screen.getByText("$148.6200")).toBeInTheDocument())

    expect(screen.queryByTestId("coverage-scope-note")).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: /Has Unrated/i }))
    await waitFor(() => {
      expect(screen.getByTestId("coverage-scope-note")).toBeInTheDocument()
    })
  })

  it("gives its root a constrained height so the page can actually scroll", async () => {
    const { container } = render(<AdminSpendPage />)
    await waitFor(() => {
      expect(screen.getByText("$148.6200")).toBeInTheDocument()
    })

    const root = container.firstElementChild as HTMLElement
    expect(root).toBeTruthy()
    // the scroller itself
    expect(root.className).toMatch(/\boverflow-y-auto\b/)
    // …and the two that give it something to scroll WITHIN. Dropping either one silently
    // restores the unreachable-content bug, with no visible diff in any other assertion.
    expect(root.className).toMatch(/\bh-full\b/)
    expect(root.className).toMatch(/\bmin-h-0\b/)
  })
})
