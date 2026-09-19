import React, { useEffect, useState } from "react"
import {
  DollarSign,
  Calendar,
  Filter,
  Plus,
  ArrowLeft,
  RefreshCw,
  Layers,
  AlertTriangle,
  ShieldCheck,
  CheckCircle2,
  Clock,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { getSpendSummary, getSpendRuns, getModelRates } from "@/lib/api/spend"
import type { SpendSummaryData, SpendRunItem, ModelRateItem } from "@/types/spend"
import { DailySpendChart } from "@/components/admin/spend/DailySpendChart"
import { SpendDonutChart } from "@/components/admin/spend/SpendDonutChart"
import { BlindSpotsCard } from "@/components/admin/spend/BlindSpotsCard"
import { RepriceModal } from "@/components/admin/spend/RepriceModal"

interface AdminSpendPageProps {
  onBack?: () => void
}

type TimeRangeFilter = "today" | "7d" | "30d" | "all"
type CoverageFilter = "all" | "rated" | "unrated" | "incomplete_coverage"

const PROVIDER_BADGES: Record<string, { label: string; className: string }> = {
  openai: { label: "OA", className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  anthropic: { label: "AN", className: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  deepseek: { label: "DS", className: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  openrouter: { label: "OR", className: "bg-purple-500/10 text-purple-400 border-purple-500/20" },
  google: { label: "GO", className: "bg-red-500/10 text-red-400 border-red-500/20" },
}

/**
 * ⛔ THE ONE PLACE THE TIME CHIP BECOMES A TIMESTAMP. Phase 257.1.
 *
 * Operator: *"the filter is working but it is not working on the charts and visuals, it is
 * working on the entries below it."* Exactly right, and the cause was that the two endpoints
 * speak DIFFERENT DIALECTS of the same filter:
 *
 *   GET /admin/spend/runs     takes `time_range`  — a string: "today" | "7d" | "30d"
 *   GET /admin/spend/summary  takes `start_time`  — an ISO timestamp
 *
 * The ledger passed its chip straight through and filtered correctly. The summary call was
 * `getSpendSummary()` — no arguments at all — so every region fed by `summary` (all four KPI
 * cards, the daily chart, the donut, the blind-spots gauge) stayed pinned to all-time while
 * the rows underneath moved. Two halves of one page answering about different populations.
 *
 * ⚠ The backend supported this the whole time; nothing was missing there. Measured on the
 * live dev DB, org 22f9c615 — the figures the charts SHOULD have been showing:
 *     all   $24.9083 · 851 rated · 332 unrated · 89 daily buckets
 *     30d   $ 4.3543 · 171 rated ·  97 unrated · 28 buckets
 *     7d    $ 1.5233 ·  40 rated ·  16 unrated ·  6 buckets
 *     today $ 0.0000 ·   1 rated ·   0 unrated ·  1 bucket
 *
 * A single helper, so the two dialects are reconciled in ONE place rather than at each call
 * site — the next endpoint that wants a window converts here, not inline.
 */
export function timeRangeToStartTime(range: TimeRangeFilter, now: Date = new Date()): string | undefined {
  if (range === "all") return undefined
  if (range === "today") {
    // ⚠ The BROWSER's midnight, which is not necessarily the ledger's. `get_spend_runs`
    // filters "today" with `r.started_at >= CURRENT_DATE`, evaluated in the DATABASE's
    // timezone. On a box where both agree (local dev, and a UTC server with a UTC operator)
    // these are the same instant; for an operator in a different zone from the server they
    // differ by the offset, so the charts and the ledger can disagree by a few hours of runs
    // at the boundary. Named rather than papered over: closing it properly means the ledger
    // taking an explicit window too, which is an API change, not a client-side rounding.
    const midnight = new Date(now)
    midnight.setHours(0, 0, 0, 0)
    return midnight.toISOString()
  }
  const days = range === "7d" ? 7 : 30
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString()
}

export const AdminSpendPage: React.FC<AdminSpendPageProps> = ({ onBack }) => {
  const [timeRange, setTimeRange] = useState<TimeRangeFilter>("30d")
  const [coverageFilter, setCoverageFilter] = useState<CoverageFilter>("all")
  const [summary, setSummary] = useState<SpendSummaryData | null>(null)
  const [runs, setRuns] = useState<SpendRunItem[]>([])
  const [rates, setRates] = useState<ModelRateItem[]>([])
  const [totalRunsCount, setTotalRunsCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isRepriceModalOpen, setIsRepriceModalOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<"ledger" | "rates">("ledger")

  // Generation counter to prevent stale request races (WR-02).
  const reqId = React.useRef(0)

  // ── ONE place builds the three requests; TWO consumers run them. Phase 257.1. ────────
  //
  // ⛔ THE ARGUMENT TO `getSpendSummary` IS THE WHOLE FIX, and it was missing TWICE.
  // Both the mount effect and the `fetchData` callback below called `getSpendSummary()`
  // BARE, so every summary-fed region (four KPI cards, the daily chart, the donut, the
  // blind-spots gauge) answered about all-time while the ledger answered about the chip.
  // The second copy is why this is now a shared callback rather than two literal bodies:
  // the duplicate was byte-identical, so fixing one and missing the other would have left
  // the page correct on load and wrong again after a reprice — the hardest kind to see.
  //
  // ⚠ `fetchData` is NOT dead code. A first pass at this fix deleted it on that assumption
  // and broke the page (`ReferenceError: fetchData is not defined`); it drives the refresh
  // control and `RepriceModal`'s `onSuccess`. The suite caught it immediately, which is the
  // argument for the suite, not for the assumption.
  //
  // ⚠ Only the TIME window reaches the summary: `/admin/spend/summary` has no status
  // parameter, so the coverage chips scope the LEDGER only — said out loud in the ledger
  // header rather than left for the operator to infer from two numbers that disagree.
  const loadAll = React.useCallback(async () => {
    return Promise.all([
      getSpendSummary({ startTime: timeRangeToStartTime(timeRange) }),
      getSpendRuns({
        timeRange: timeRange === "all" ? undefined : timeRange,
        filterStatus: coverageFilter === "all" ? undefined : coverageFilter,
        limit: 50,
      }),
      getModelRates(),
    ] as const)
  }, [timeRange, coverageFilter])

  const applyAll = React.useCallback(
    ([sumData, runsData, ratesData]: Awaited<ReturnType<typeof loadAll>>) => {
      setSummary(sumData)
      setRuns(runsData.runs)
      setTotalRunsCount(runsData.totalCount)
      setRates(ratesData)
      setLoadError(null)
    },
    [],
  )

  // The imperative door: the refresh control and RepriceModal's onSuccess.
  const fetchData = React.useCallback(async () => {
    const mine = ++reqId.current
    setIsLoading(true)
    try {
      const result = await loadAll()
      if (mine === reqId.current) {
        applyAll(result)
      }
    } catch (err) {
      console.error("Failed to load spend data:", err)
      if (mine === reqId.current) {
        setLoadError(err instanceof Error ? err.message : String(err))
      }
    } finally {
      if (mine === reqId.current) {
        setIsLoading(false)
      }
    }
  }, [loadAll, applyAll])

  // The declarative door: mount, and every filter change.
  useEffect(() => {
    let alive = true
    const mine = ++reqId.current
    setIsLoading(true)
    ;(async () => {
      try {
        const result = await loadAll()
        if (alive && mine === reqId.current) {
          applyAll(result)
        }
      } catch (err) {
        console.error("Failed to load spend data:", err)
        if (alive && mine === reqId.current) {
          setLoadError(err instanceof Error ? err.message : String(err))
        }
      } finally {
        if (alive && mine === reqId.current) {
          setIsLoading(false)
        }
      }
    })()

    return () => {
      alive = false
    }
  }, [loadAll, applyAll])

  const totalTokens = (summary?.totalInputTokens || 0) + (summary?.totalOutputTokens || 0)
  const inputTokenPct = totalTokens > 0
    ? Math.round(((summary?.totalInputTokens || 0) / totalTokens) * 100)
    : 50
  const outputTokenPct = 100 - inputTokenPct

  const pricedRunsRatio = summary && (summary.ratedRunsCount + summary.unratedRunsCount > 0)
    ? Math.round((summary.ratedRunsCount / (summary.ratedRunsCount + summary.unratedRunsCount)) * 100)
    : 100

  return (
    // ⛔ `h-full min-h-0` IS THE SCROLL, AND `flex-1` ALONE WAS NOT. Phase 257.1.
    // Operator, on the shipped page: *"I see a lot of information that's good but it is not
    // scrolling down."* The root carried `flex-1 overflow-y-auto` — but this page is mounted
    // into `ChatLayout`'s `<main className="flex-1 overflow-hidden">` (:846), and that main
    // is NOT a flex container. `flex-1` on a child of a non-flex parent is inert, so the root
    // had NO constrained height; `overflow-y-auto` on an element that is as tall as its own
    // content never scrolls, and everything past the viewport was simply clipped by main's
    // `overflow-hidden`. The content was rendering the whole time — it was unreachable.
    //
    // `h-full` gives it main's height (definite: main is `flex-1` inside a flex column), and
    // `min-h-0` is the companion this repo has already paid for twice — ChatLayout:797 carries
    // the same note, and a flex child's `min-height:auto` default is what stops it shrinking
    // below its content. `flex-1` is kept so the root still behaves if a future mount puts it
    // inside a flex column.
    <div className="h-full min-h-0 flex-1 overflow-y-auto bg-background p-6 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-border/50">
        <div>
          <div className="flex items-center gap-2 mb-1">
            {onBack && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onBack}
                className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-indigo-400" />
              Spend & Metering
            </h1>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
              Cockpit
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Attributable dollar expenditure per run and organization · what this view cannot see
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            disabled={isLoading}
            className="text-xs gap-1.5 h-8 font-mono border-border/60"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>

          <Button
            size="sm"
            onClick={() => setIsRepriceModalOpen(true)}
            className="text-xs gap-1.5 h-8 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-sm"
          >
            <Plus className="h-3.5 w-3.5" />
            Reprice Model
          </Button>
        </div>
      </div>

      {/* Filter Ribbon */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg bg-card/60 border border-border/40 text-xs">
        {/* Time Range Pills */}
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground mr-1 flex items-center gap-1 font-mono">
            <Clock className="h-3 w-3" /> Time:
          </span>
          {(["today", "7d", "30d", "all"] as TimeRangeFilter[]).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setTimeRange(r)}
              className={`px-2.5 py-1 rounded-md font-mono transition-colors ${
                timeRange === r
                  ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 font-semibold"
                  : "text-muted-foreground hover:text-foreground hover:bg-card"
              }`}
            >
              {r === "today" ? "Today" : r === "7d" ? "7D" : r === "30d" ? "Last 30D" : "All Time"}
            </button>
          ))}
        </div>

        {/* Coverage Filter Pills */}
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground mr-1 flex items-center gap-1 font-mono">
            <Filter className="h-3 w-3" /> Coverage:
          </span>
          {(
            [
              { id: "all", label: "All Runs" },
              { id: "rated", label: "Fully Rated" },
              { id: "unrated", label: "Has Unrated" },
              { id: "incomplete_coverage", label: "Partial Coverage" },
            ] as const
          ).map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCoverageFilter(c.id)}
              className={`px-2.5 py-1 rounded-md font-mono transition-colors ${
                coverageFilter === c.id
                  ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 font-semibold"
                  : "text-muted-foreground hover:text-foreground hover:bg-card"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Error banner (CR-04) */}
      {loadError && (
        <div
          className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 flex items-center justify-between text-xs"
          data-testid="spend-load-error-banner"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 flex-shrink-0 text-amber-400" />
            <span data-testid="spend-load-error">Could not load spend — {loadError}</span>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={fetchData}
            disabled={isLoading}
            className="text-xs h-7 gap-1 border-amber-500/40 hover:bg-amber-500/20 text-amber-200"
          >
            <RefreshCw className={`h-3 w-3 ${isLoading ? "animate-spin" : ""}`} />
            Retry
          </Button>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Total Spend */}
        <div className="rounded-xl border border-border bg-card p-4 flex flex-col justify-between shadow-sm">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              Total Org Spend (Attributable)
            </span>
            <div className="mt-1 flex items-baseline gap-1">
              {loadError ? (
                <span className="text-xl font-bold font-mono text-amber-400" data-testid="spend-load-error-kpi">
                  Unavailable
                </span>
              ) : (
                <span className="text-2xl font-bold font-mono text-emerald-400">
                  {summary ? `$${summary.totalSpendUsd.toFixed(4)}` : "—"}
                </span>
              )}
              {!loadError && summary && summary.unratedRunsCount > 0 && (
                <span className="text-sm font-mono text-amber-400" title="Excludes unrated runs">*</span>
              )}
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-border/30 text-[11px] font-mono text-muted-foreground">
            {loadError ? (
              <span className="text-amber-400/90 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> Data load failed
              </span>
            ) : summary && summary.unratedRunsCount > 0 ? (
              <span className="text-amber-400/90 flex items-center gap-1">
                * {summary.ratedRunsCount} runs priced · {summary.unratedRunsCount} unrated excluded
              </span>
            ) : summary ? (
              <span className="text-emerald-400/90 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> 100% of runs in window priced
              </span>
            ) : (
              <span>—</span>
            )}
          </div>
        </div>

        {/* 2. Tokens Counted */}
        <div className="rounded-xl border border-border bg-card p-4 flex flex-col justify-between shadow-sm">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              Tokens Counted
            </span>
            <div className="mt-1 text-2xl font-bold font-mono text-foreground">
              {totalTokens > 1_000_000
                ? `${(totalTokens / 1_000_000).toFixed(2)}M`
                : `${(totalTokens / 1_000).toFixed(1)}k`}
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-border/30">
            <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground mb-1">
              <span className="text-cyan-400">In: {inputTokenPct}%</span>
              <span className="text-purple-400">Out: {outputTokenPct}%</span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-background overflow-hidden flex">
              <div className="bg-cyan-400 h-full" style={{ width: `${inputTokenPct}%` }} />
              <div className="bg-purple-400 h-full" style={{ width: `${outputTokenPct}%` }} />
            </div>
          </div>
        </div>

        {/* 3. Pricing Coverage */}
        <div className="rounded-xl border border-border bg-card p-4 flex flex-col justify-between shadow-sm">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              Pricing Coverage Ratio
            </span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono text-foreground">
                {pricedRunsRatio}%
              </span>
              <span className="text-xs font-mono text-muted-foreground">
                ({summary?.ratedRunsCount || 0} / {(summary?.ratedRunsCount || 0) + (summary?.unratedRunsCount || 0)})
              </span>
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-border/30">
            <div className="w-full h-1.5 rounded-full bg-background overflow-hidden flex">
              <div className="bg-emerald-500 h-full" style={{ width: `${pricedRunsRatio}%` }} />
              {pricedRunsRatio < 100 && (
                <div className="bg-amber-500 h-full" style={{ width: `${100 - pricedRunsRatio}%` }} />
              )}
            </div>
          </div>
        </div>

        {/* 4. Blind Spots */}
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 flex flex-col justify-between shadow-sm">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-amber-400 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" /> Blind Spots & Residues
            </span>
            <div className="mt-1 text-2xl font-bold font-mono text-amber-300">
              {(summary?.unratedRunsCount || 0) + (summary?.incompleteCoverageCount || 0)}
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-amber-500/20 text-[11px] font-mono text-amber-400/90 flex items-center justify-between">
            <span>{summary?.unratedRunsCount || 0} unrated</span>
            <span>{summary?.incompleteCoverageCount || 0} partial</span>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Daily Spend Bar Chart */}
        <div className="lg:col-span-7 rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Calendar className="h-4 w-4 text-indigo-400" />
              14-Day Spend & Unrated Volume
            </h2>
            <span className="text-[10px] font-mono text-muted-foreground">Daily Attributable</span>
          </div>
          <DailySpendChart data={summary?.dailySpend || []} height={190} />
        </div>

        {/* Model Market Share Donut Chart */}
        <div className="lg:col-span-5 rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Layers className="h-4 w-4 text-purple-400" />
              Model Spend Share
            </h2>
            <span className="text-[10px] font-mono text-muted-foreground">Volume & Rates</span>
          </div>
          <SpendDonutChart
            data={summary?.modelBreakdown || []}
            totalSpendUsd={summary?.totalSpendUsd || 0}
            size={180}
          />
        </div>
      </div>

      {/* "What This View Cannot See" Honesty Summary Card */}
      <BlindSpotsCard
        unratedRunsCount={summary?.unratedRunsCount || 0}
        incompleteCoverageCount={summary?.incompleteCoverageCount || 0}
        ratedRunsCount={summary?.ratedRunsCount || 0}
        onFilterUnrated={() => setCoverageFilter("unrated")}
        onFilterIncompleteCoverage={() => setCoverageFilter("incomplete_coverage")}
        onOpenRateRegistry={() => setActiveTab("rates")}
      />

      {/* Main Ledger / Rates Tab Navigation */}
      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="flex items-center justify-between px-5 py-3 border-b border-border/50 bg-card/60">
          <div className="flex items-center gap-2 font-mono text-xs">
            <button
              type="button"
              onClick={() => setActiveTab("ledger")}
              className={`px-3 py-1.5 rounded-lg transition-colors font-semibold ${
                activeTab === "ledger"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Attributable Runs Ledger ({totalRunsCount})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("rates")}
              className={`px-3 py-1.5 rounded-lg transition-colors font-semibold ${
                activeTab === "rates"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Active Rate Registry ({rates.length})
            </button>
          </div>

          <div className="text-xs text-muted-foreground font-mono flex items-center gap-2">
            {activeTab === "ledger" ? "Ordered by start time DESC" : "Ordered by effective date"}
            {/* ⛔ SAY WHICH REGION A FILTER MOVES. Phase 257.1. The time chip now scopes the
                whole page, but `/admin/spend/summary` has no status parameter, so a coverage
                chip scopes the LEDGER ONLY. Leaving that unsaid is how an operator reads two
                honest numbers, sees them disagree, and concludes the page is broken — which
                is precisely what happened when the charts silently ignored the time chip. */}
            {activeTab === "ledger" && coverageFilter !== "all" && (
              <span
                className="px-2 py-0.5 rounded bg-indigo-500/15 text-indigo-300 border border-indigo-500/30"
                data-testid="coverage-scope-note"
                title="The coverage filter narrows this ledger only. The charts and KPI cards above follow the time range, and always cover every run in it."
              >
                coverage filter applies to this ledger only
              </span>
            )}
          </div>
        </div>

        {/* Tab 1: Runs Ledger Table */}
        {activeTab === "ledger" && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border/40 bg-muted/20 font-mono text-[11px] text-muted-foreground">
                  <th className="py-2.5 px-4 font-medium">Run Identity</th>
                  <th className="py-2.5 px-4 font-medium">Model & Provider</th>
                  <th className="py-2.5 px-4 font-medium">Timestamp</th>
                  <th className="py-2.5 px-4 font-medium">Tokens (In / Out)</th>
                  <th className="py-2.5 px-4 font-medium">Attributable Spend</th>
                  <th className="py-2.5 px-4 font-medium">Coverage Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20 font-mono">
                {runs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-muted-foreground">
                      No runs matching current filters.
                    </td>
                  </tr>
                ) : (
                  runs.map((run) => {
                    const providerBadge = run.provider
                      ? PROVIDER_BADGES[run.provider.toLowerCase()] || {
                          label: run.provider.slice(0, 2).toUpperCase(),
                          className: "bg-card text-foreground border-border",
                        }
                      : { label: "??", className: "bg-muted text-muted-foreground" }

                    const totalToks = (run.inputTokens || 0) + (run.outputTokens || 0)
                    const inPct = totalToks > 0 ? Math.round(((run.inputTokens || 0) / totalToks) * 100) : 50

                    return (
                      <tr key={run.id} className="hover:bg-accent/20 transition-colors">
                        {/* Run Identity */}
                        <td className="py-2.5 px-4">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-foreground truncate max-w-[120px]">
                              {run.id.slice(0, 8)}…
                            </span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-card text-muted-foreground border border-border/40">
                              {run.status}
                            </span>
                          </div>
                        </td>

                        {/* Model & Provider */}
                        <td className="py-2.5 px-4">
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${providerBadge.className}`}
                            >
                              {providerBadge.label}
                            </span>
                            <span className="text-foreground font-medium">{run.model}</span>
                          </div>
                        </td>

                        {/* Timestamp */}
                        <td className="py-2.5 px-4 text-muted-foreground text-[11px]">
                          {run.createdAt ? new Date(run.createdAt).toLocaleString() : "—"}
                        </td>

                        {/* Tokens */}
                        <td className="py-2.5 px-4">
                          <div>
                            <span className="text-foreground">{totalToks.toLocaleString()}</span>
                            <div className="w-20 h-1 rounded-full bg-background overflow-hidden flex mt-1">
                              <div className="bg-cyan-400 h-full" style={{ width: `${inPct}%` }} />
                              <div className="bg-purple-400 h-full" style={{ width: `${100 - inPct}%` }} />
                            </div>
                          </div>
                        </td>

                        {/* Attributable Spend */}
                        <td className="py-2.5 px-4">
                          {run.isRated && run.costUsd !== null ? (
                            <span className="text-emerald-400 font-semibold font-mono">
                              ${run.costUsd.toFixed(4)}
                            </span>
                          ) : run.isRated && run.costUsd === null ? (
                            <span
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-500/15 text-slate-300 border border-slate-400/30 text-[11px] font-semibold font-mono"
                              title={`Model '${run.model}' has a registered rate, but this run recorded no token counts`}
                              data-testid="unmeasured-cost-badge"
                            >
                              <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                              No tokens recorded
                            </span>
                          ) : (
                            /* STRICT INVARIANT: unrated runs display ▲ Unrated badge, NEVER $0.00 */
                            <span
                              className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30 text-[11px] font-semibold"
                              title={`Model '${run.model}' has no registered rate`}
                              data-testid="unrated-cost-badge"
                            >
                              ▲ Unrated
                            </span>
                          )}
                        </td>

                        {/* Coverage Status */}
                        <td className="py-2.5 px-4">
                          {run.isCoverageComplete ? (
                            <span className="text-emerald-400 flex items-center gap-1 text-[11px]">
                              <ShieldCheck className="h-3.5 w-3.5" /> 4/4 Complete
                            </span>
                          ) : (
                            <span
                              className="text-amber-400 flex items-center gap-1 text-[11px]"
                              title={
                                run.tokenCoverage
                                  ? `Coverage legs: [${run.tokenCoverage.join(", ")}]`
                                  : "No coverage legs reported"
                              }
                            >
                              <AlertTriangle className="h-3.5 w-3.5" /> Partial
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 2: Rate Registry Table */}
        {activeTab === "rates" && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border/40 bg-muted/20 font-mono text-[11px] text-muted-foreground">
                  <th className="py-2.5 px-4 font-medium">Model Name</th>
                  <th className="py-2.5 px-4 font-medium">Provider</th>
                  <th className="py-2.5 px-4 font-medium">Prompt Rate ($ / 1M)</th>
                  <th className="py-2.5 px-4 font-medium">Completion Rate ($ / 1M)</th>
                  <th className="py-2.5 px-4 font-medium">Effective From</th>
                  <th className="py-2.5 px-4 font-medium">Effective To</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20 font-mono">
                {rates.map((rate) => (
                  <tr key={rate.id} className="hover:bg-accent/20 transition-colors">
                    <td className="py-2.5 px-4 font-semibold text-foreground">{rate.modelName}</td>
                    <td className="py-2.5 px-4 text-muted-foreground">{rate.provider || "Default (all)"}</td>
                    <td className="py-2.5 px-4 text-cyan-400">${rate.inputCostPerMillion}</td>
                    <td className="py-2.5 px-4 text-purple-400">${rate.outputCostPerMillion}</td>
                    <td className="py-2.5 px-4 text-muted-foreground text-[11px]">
                      {rate.effectiveFrom ? new Date(rate.effectiveFrom).toLocaleDateString() : "Beginning of time"}
                    </td>
                    <td className="py-2.5 px-4 text-muted-foreground text-[11px]">
                      {rate.effectiveTo ? new Date(rate.effectiveTo).toLocaleDateString() : "Active (open-ended)"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Reprice Modal */}
      <RepriceModal
        isOpen={isRepriceModalOpen}
        onClose={() => setIsRepriceModalOpen(false)}
        onSuccess={fetchData}
      />
    </div>
  )
}
export default AdminSpendPage
