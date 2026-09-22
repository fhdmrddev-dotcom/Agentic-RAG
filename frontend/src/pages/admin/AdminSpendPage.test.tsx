import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, waitFor, cleanup, fireEvent, within } from "@testing-library/react"
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
  // 92 runs HAVE a rate; 12 of them recorded nothing. So 80 actually priced. CR-06.
  unmeasuredRunsCount: 12,
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
    expect(screen.getByText(/\* 80 priced · 8 unrated · 12 no tokens excluded/i)).toBeInTheDocument()
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

  it("renders an error banner and Unavailable when data load fails — NEVER a confident $0.0000 (CR-04)", async () => {
    vi.mocked(spendApi.getSpendSummary).mockRejectedValueOnce(new Error("Network failure 500"))
    render(<AdminSpendPage />)

    await waitFor(() => {
      expect(screen.getByTestId("spend-load-error-banner")).toBeInTheDocument()
      expect(screen.getByTestId("spend-load-error")).toHaveTextContent("Network failure 500")
      expect(screen.getByTestId("spend-load-error-kpi")).toHaveTextContent("Unavailable")
    })

    // Strict assertion: the page must NOT display a confident "$0.0000" on failure
    expect(screen.queryByText("$0.0000")).not.toBeInTheDocument()
  })

  it("renders an em-dash and never confident $0.0000 while spend summary is loading (WR-12)", async () => {
    // Hang requests so summary is null and loadError is null
    vi.mocked(spendApi.getSpendSummary).mockReturnValueOnce(new Promise(() => {}))
    vi.mocked(spendApi.getSpendRuns).mockReturnValueOnce(new Promise(() => {}))
    vi.mocked(spendApi.getModelRates).mockReturnValueOnce(new Promise(() => {}))

    render(<AdminSpendPage />)

    // The headline KPI must render em-dash "—" while loading, NEVER a confident "$0.0000"
    const headlineCard = screen.getByText(/Total Org Spend/i).closest("div")
    expect(headlineCard).toHaveTextContent("—")
    expect(headlineCard).not.toHaveTextContent("$0.0000")
    expect(screen.queryByText("$0.0000")).not.toBeInTheDocument()
  })

  it("ignores stale load responses when a filter change or newer request races it (WR-02)", async () => {
    let resolveSlow!: (value: any) => void
    const slowPromise = new Promise((res) => {
      resolveSlow = res
    })

    // Initial mount: fast
    render(<AdminSpendPage />)
    await waitFor(() => expect(screen.getByText("$148.6200")).toBeInTheDocument())

    // First: trigger a refresh with slow response (fireEvent avoids awaiting pending promise)
    vi.mocked(spendApi.getSpendSummary).mockReturnValueOnce(slowPromise as any)
    vi.mocked(spendApi.getSpendRuns).mockReturnValueOnce(slowPromise as any)
    vi.mocked(spendApi.getModelRates).mockReturnValueOnce(slowPromise as any)
    fireEvent.click(screen.getByRole("button", { name: /Refresh/i }))

    // Now operator immediately switches chip to 7D, which resolves fast with $42.0000
    const fastSummary: SpendSummaryData = {
      ...mockSummary,
      totalSpendUsd: 42.0,
    }
    vi.mocked(spendApi.getSpendSummary).mockResolvedValueOnce(fastSummary)
    vi.mocked(spendApi.getSpendRuns).mockResolvedValueOnce({ runs: mockRuns, totalCount: 2 })
    vi.mocked(spendApi.getModelRates).mockResolvedValueOnce(mockRates)

    fireEvent.click(screen.getByRole("button", { name: /^7D$/ }))

    // 7D lands and updates KPI to $42.0000
    await waitFor(() => {
      expect(screen.getAllByText(/\$42\.0000/).length).toBeGreaterThanOrEqual(1)
    })

    // Now the stale slow refresh lands with $999.9900
    const staleSummary: SpendSummaryData = {
      ...mockSummary,
      totalSpendUsd: 999.99,
    }
    resolveSlow([staleSummary, { runs: mockRuns, totalCount: 2 }, mockRates])

    // Wait a tick: the stale result must be discarded by reqId guard
    await new Promise((r) => setTimeout(r, 50))
    expect(screen.getAllByText(/\$42\.0000/).length).toBeGreaterThanOrEqual(1)
    expect(screen.queryByText(/999\.99/)).not.toBeInTheDocument()
  })

  it("renders 'No tokens recorded' badge when a run has a registered rate but null tokens (CR-02)", async () => {
    const unmeasuredRatedRun: SpendRunItem = {
      id: "run-unmeasured-003",
      name: "Rated But Unmeasured Run",
      model: "deepseek-v4-flash",
      provider: "deepseek",
      status: "completed",
      createdAt: "2026-09-19T02:20:00Z",
      inputTokens: null,
      outputTokens: null,
      costUsd: null,
      isRated: true,
      tokenCoverage: null,
    }
    vi.mocked(spendApi.getSpendRuns).mockResolvedValueOnce({
      runs: [unmeasuredRatedRun],
      totalCount: 1,
    })

    render(<AdminSpendPage />)
    await waitFor(() => {
      expect(screen.getByTestId("unmeasured-cost-badge")).toBeInTheDocument()
      expect(screen.getByTestId("unmeasured-cost-badge")).toHaveTextContent("No tokens recorded")
    })

    // STRICT INVARIANT: never render $0.0000 and never render Unrated badge for rated model
    expect(screen.queryByText("$0.0000")).not.toBeInTheDocument()
    expect(screen.queryByTestId("unrated-cost-badge")).not.toBeInTheDocument()
  })
})

describe("AdminSpendPage — CR-06: the cards and the ledger must count the same way", () => {
  // The defect: `cost_usd IS NULL` meant BOTH "no registered rate" AND "a rate, but no
  // tokens", so the summary counted 675 unrated while the ledger beneath it counted 332,
  // and the blind-spots button offered "View 675 Unrated Runs" then showed 332 rows under
  // copy claiming none of them had a rate. These three cases pin the three separate places
  // that had to move together; each was driven RED against the pre-fix arithmetic.

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(spendApi.getSpendSummary).mockResolvedValue(mockSummary)
    vi.mocked(spendApi.getSpendRuns).mockResolvedValue({ runs: [], totalCount: 100 })
    vi.mocked(spendApi.getModelRates).mockResolvedValue([])
  })

  it("says PRICED about the runs that produced a figure, not about the runs that have a rate", async () => {
    render(<AdminSpendPage onBack={() => {}} />)
    // 92 rated - 12 unmeasured = 80 priced, out of 92 + 8 = 100 runs in window.
    // Reading ratedRunsCount here would print 92% and "92 runs priced" over a total built
    // from 80 of them.
    expect(await screen.findByText("80%")).toBeInTheDocument()
    expect(screen.getByText("(80 / 100)")).toBeInTheDocument()
    expect(screen.queryByText("92%")).not.toBeInTheDocument()
  })

  it("names the unmeasured runs separately instead of folding them into unrated", async () => {
    render(<AdminSpendPage onBack={() => {}} />)
    const tile = await screen.findByTestId("unmeasured-disclosure")
    expect(within(tile).getByText("12 runs")).toBeInTheDocument()
    // The unrated tile must still offer its own, SMALLER number - the button and the
    // population it filters to have to agree.
    expect(screen.getByText("View 8 Unrated Runs →")).toBeInTheDocument()
  })

  it("makes the honesty gauge itself say PRICED about priced runs, not rated ones", async () => {
    // This case exists because a plant proved the gauge was UNCOVERED. Reverting
    // BlindSpotsCard's `pricedCount` to `ratedRunsCount` left all 15 other cases GREEN - the
    // page-level "80%" assertion matches KPI-3 only, because the gauge's text node reads
    // "80% Priced" and an exact matcher never reaches it. A card whose entire job is honesty
    // needs its own claim pinned, not its neighbour's.
    render(<AdminSpendPage onBack={() => {}} />)
    const gauge = await screen.findByText(/% Priced$/)
    expect(gauge.textContent).toBe("80% Priced")
    expect(screen.getByText(/% No tokens$/).textContent).toBe("12% No tokens")
    expect(screen.getByText(/% Unrated$/).textContent).toBe("8% Unrated")
  })

  it("counts an unmeasured run as excluded from the total, like an unrated one", async () => {
    render(<AdminSpendPage onBack={() => {}} />)
    // The footnote under the headline figure must account for BOTH exclusions: 80 priced,
    // 8 unrated, 12 with no tokens. Before the fix it read "92 runs priced - 8 unrated".
    const footnote = await screen.findByText(/80 priced/)
    expect(footnote).toBeInTheDocument()
    // Deliberately scoped: "12 no tokens" also appears in the Blind Spots KPI breakdown, and
    // an unscoped matcher finds both. Both SHOULD render - this asserts the footnote one.
    expect(footnote.textContent).toMatch(/12 no tokens/)
    expect(footnote.textContent).toMatch(/8 unrated/)
  })
})

describe("AdminSpendPage — CR-07: a failed load answers nothing, not zero", () => {
  // The error banner and KPI card 1 knew about the failure; four other regions did not, so a
  // failed load still rendered "Tokens Counted 0.0k", "Pricing Coverage 0%", "Blind Spots 0 ·
  // 0 unrated · 0 partial", two empty charts and "No runs matching current filters." Each is
  // a CLAIM about the org made from data that never arrived — on the page whose premise is
  // saying what it cannot see.

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(spendApi.getSpendSummary).mockRejectedValue(new Error("network down"))
    vi.mocked(spendApi.getSpendRuns).mockRejectedValue(new Error("network down"))
    vi.mocked(spendApi.getModelRates).mockRejectedValue(new Error("network down"))
  })

  it("renders no confident figure in any KPI card when the load fails", async () => {
    render(<AdminSpendPage onBack={() => {}} />)
    await screen.findByTestId("spend-load-error")

    for (const id of ["tokens-counted-value", "pricing-coverage-value", "blind-spots-value"]) {
      const el = screen.getByTestId(id)
      expect(el.textContent).toBe("Unavailable")
    }
    // The specific false readings that shipped.
    expect(screen.queryByText("0.0k")).not.toBeInTheDocument()
    expect(screen.queryByText("0%")).not.toBeInTheDocument()
    expect(screen.queryByText(/0 unrated/)).not.toBeInTheDocument()
  })

  it("does not draw an empty chart, which would read as a claim of no spend", async () => {
    render(<AdminSpendPage onBack={() => {}} />)
    await screen.findByTestId("spend-load-error")
    expect(screen.getByTestId("daily-chart-unavailable")).toBeInTheDocument()
    expect(screen.getByTestId("donut-unavailable")).toBeInTheDocument()
  })

  it("withholds the honesty card rather than rendering a false all-clear", async () => {
    render(<AdminSpendPage onBack={() => {}} />)
    await screen.findByTestId("spend-load-error")
    expect(screen.getByTestId("blind-spots-card-unavailable")).toBeInTheDocument()
    // Fed zeroes the card claims a fully-priced window. That is the exact sentence this
    // page must never produce from data it does not have.
    expect(screen.queryByText(/All models in window rated/)).not.toBeInTheDocument()
    expect(screen.queryByText("100% Priced")).not.toBeInTheDocument()
  })

  it("says the ledger did not load, rather than that no runs matched", async () => {
    render(<AdminSpendPage onBack={() => {}} />)
    await screen.findByTestId("spend-load-error")
    expect(screen.getByTestId("ledger-empty-state").textContent)
      .toMatch(/Runs unavailable/)
    expect(screen.queryByText(/No runs matching current filters/)).not.toBeInTheDocument()
  })
})

// ── BUG-260923-02 — the ledger was TRUNCATED at 50 rows ──────────────────────────────────
// The header said "Attributable Runs Ledger (1183)" while the page only ever fetched
// `limit: 50` with no offset, so rows 51+ were unreachable although the API pages.
describe("AdminSpendPage — BUG-260923-02: every ledger row is reachable", () => {
  const TOTAL = 120
  const page = (offset: number) =>
    Array.from({ length: Math.min(50, TOTAL - offset) }, (_, i) => ({
      ...mockRuns[0],
      id: `run-${String(offset + i).padStart(4, "0")}-xxxxxxxx`,
    }))

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(spendApi.getSpendSummary).mockResolvedValue(mockSummary)
    vi.mocked(spendApi.getModelRates).mockResolvedValue(mockRates)
    vi.mocked(spendApi.getSpendRuns).mockImplementation(async (p) => ({
      runs: page(p?.offset ?? 0),
      totalCount: TOTAL,
    }))
  })

  it("shows where you are in the ledger and can move to the next page", async () => {
    render(<AdminSpendPage />)
    expect(await screen.findByText("Showing 1–50 of 120")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: /Next/ }))
    expect(await screen.findByText("Showing 51–100 of 120")).toBeInTheDocument()
    expect(screen.getByText(/run-0050/)).toBeInTheDocument()
    expect(vi.mocked(spendApi.getSpendRuns)).toHaveBeenLastCalledWith(
      expect.objectContaining({ offset: 50, limit: 50 }),
    )
  })

  it("reaches the last partial page and cannot go past it", async () => {
    render(<AdminSpendPage />)
    await screen.findByText("Showing 1–50 of 120")
    fireEvent.click(screen.getByRole("button", { name: /Next/ }))
    await screen.findByText("Showing 51–100 of 120")
    fireEvent.click(screen.getByRole("button", { name: /Next/ }))
    expect(await screen.findByText("Showing 101–120 of 120")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Next/ })).toBeDisabled()
  })

  it("a paging click does not reload the summary cards", async () => {
    render(<AdminSpendPage />)
    await screen.findByText("Showing 1–50 of 120")
    const summaryCalls = vi.mocked(spendApi.getSpendSummary).mock.calls.length
    fireEvent.click(screen.getByRole("button", { name: /Next/ }))
    await screen.findByText("Showing 51–100 of 120")
    expect(vi.mocked(spendApi.getSpendSummary).mock.calls.length).toBe(summaryCalls)
  })

  it("changing a filter goes back to page 1", async () => {
    render(<AdminSpendPage />)
    await screen.findByText("Showing 1–50 of 120")
    fireEvent.click(screen.getByRole("button", { name: /Next/ }))
    await screen.findByText("Showing 51–100 of 120")
    fireEvent.click(screen.getByRole("button", { name: "7D" }))
    expect(await screen.findByText("Showing 1–50 of 120")).toBeInTheDocument()
    expect(vi.mocked(spendApi.getSpendRuns)).toHaveBeenLastCalledWith(
      expect.objectContaining({ offset: 0 }),
    )
  })
})
