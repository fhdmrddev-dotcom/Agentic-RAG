/** Phase 217.1-12 — the fifth Library tab, assembling the Health surface.
 *
 *  Composition: coverage ring → stat tiles → signal chips → per-document bars.
 *  Mounted as a sibling of IngestionTab/IndexingTab — honours G-5 by construction.
 *
 *  ⚠ The three Governance-sourced chips (Broken links, Unclassified, Unsure metadata)
 *  render UNGATED here — Plan 13 (Wave 7) adds the governance_health chip-level gate
 *  in the next wave. This is explicit, not silent.
 */

import { useEffect, useState } from "react"
import { lazy, Suspense } from "react"
import { ChartSkeleton } from "@/components/health/ChartSkeleton"
import { getHealthOverview, getRetrievalTrend } from "@/lib/api"
import type { HealthOverview, RetrievalTrendPoint } from "@/lib/api"
import { CoverageRing } from "./CoverageRing"
import { HealthSignalChips } from "./HealthSignalChips"
import { HealthDocumentBars } from "./HealthDocumentBars"
import { CheckedQueriesSection } from "./CheckedQueriesSection"
import { AnimatedNumber } from "@/components/ui/AnimatedNumber"

const RetrievalTrendChart = lazy(() =>
  import("@/components/health/RetrievalTrendChart").then((m) => ({
    default: m.RetrievalTrendChart,
  })),
)

interface StatTile {
  label: string
  value: number | string
  description: string
}

function toStatTiles(overview: HealthOverview, checkedCount: number | null): StatTile[] {
  return [
    {
      label: "Documents",
      value: overview.total_documents,
      description: "in your library",
    },
    {
      label: "Searches",
      value: overview.retrieved_this_month,
      description: "retrieved in 30 days",
    },
    {
      label: "Never found",
      value: overview.never_retrieved_count,
      description: "never returned by a search",
    },
    {
      label: "Checked queries",
      // Plan 17: live count from listCheckedQueries().length (lifted from CheckedQueriesSection).
      value: checkedCount !== null ? checkedCount : "—",
      description: checkedCount !== null
        ? `${checkedCount} query${checkedCount !== 1 ? "ies" : "y"} tracked`
        : "coming with checked queries",
    },
    {
      label: "MATCH STRENGTH",
      value:
        overview.health_score != null
          ? `${Math.round(overview.health_score > 1 ? overview.health_score : overview.health_score * 100)}%`
          : "—",
      description: "average similarity of what searches returned",
    },
  ]
}

export function HealthTab() {
  const [overview, setOverview] = useState<HealthOverview | null>(null)
  const [trend, setTrend] = useState<RetrievalTrendPoint[] | null>(null)
  const [trendDays, setTrendDays] = useState(30)
  // Plan 17: the live checked-queries count, lifted from CheckedQueriesSection's own fetch.
  const [checkedCount, setCheckedCount] = useState<number | null>(null)

  useEffect(() => {
    getHealthOverview().then(setOverview).catch(() => setOverview(null))
  }, [])

  useEffect(() => {
    getRetrievalTrend(trendDays).then(setTrend).catch(() => setTrend(null))
  }, [trendDays])

  const tiles = overview ? toStatTiles(overview, checkedCount) : null

  return (
    <div className="flex flex-col gap-6">
      {/* ── Ring + chart row ───────────────────────────────────────────── */}
      <div className="grid grid-cols-[auto_1fr] gap-6">
        <div data-testid="health-coverage-ring">
          {overview ? (
            <CoverageRing
              retrieved={overview.retrieved_this_month}
              total={overview.total_documents}
            />
          ) : (
            <div className="h-44 w-44 animate-pulse bg-muted/30 rounded-lg" />
          )}
        </div>

        <div className="min-w-0" data-testid="health-searches-chart">
          <Suspense fallback={<ChartSkeleton />}>
            {trend ? (
              <RetrievalTrendChart data={trend} />
            ) : (
              <div className="ghost-border bg-card/50 rounded-lg p-4 h-64 animate-pulse" />
            )}
          </Suspense>
          <div className="flex items-center justify-between gap-2 mt-2">
            <div className="flex gap-1.5 p-0.5 rounded-lg bg-muted/20 border border-border/30">
              {[7, 30, 90].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setTrendDays(d)}
                  className={`text-xs px-2.5 py-1 rounded-md font-medium transition-all ${
                    trendDays === d
                      ? "bg-primary/20 text-primary border border-primary/30 shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                  }`}
                >
                  {d}d
                </button>
              ))}
            </div>
            {overview && overview.high_confidence_rate != null && (
              <span className="text-[11px] text-muted-foreground hidden sm:inline-flex items-center gap-1.5 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <AnimatedNumber value={`${Math.round(overview.high_confidence_rate * 100)}%`} /> high confidence
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Five stat tiles ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3" data-testid="health-stat-tiles">
        {/* ⚠ The skeleton arm must NOT index `Array.from({length:5})` as tile objects —
            that yields `undefined` elements and `tile.label` throws. It is a position
            array; map with an index key, no label access. */}
        {(tiles ?? Array.from({ length: 5 })).map((tile, i) => {
          const isMatchStrength = tile && tile.label === "MATCH STRENGTH"
          const isCheckedQueries = tile && tile.label === "Checked queries"
          const isTileLoading = !overview || (isCheckedQueries && checkedCount === null)
          return (
            <div
              key={tile ? tile.label : `skeleton-${i}`}
              className="card-interactive relative overflow-hidden rounded-xl border border-border/50 bg-card/40 backdrop-blur-sm p-4 flex flex-col gap-2 shadow-sm"
              // 217.1-18 — the MATCH STRENGTH tile carries the contract's per-tile hook.
              data-testid={isMatchStrength ? "health-match-strength-tile" : undefined}
            >
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {tile ? tile.label : "…"}
              </span>
              {!isTileLoading ? (
                <>
                  <span className="text-3xl font-bold font-headline tabular-nums leading-none text-foreground tracking-tight">
                    <AnimatedNumber value={tile.value} />
                  </span>
                  <span className="text-xs text-muted-foreground">{tile.description}</span>
                </>
              ) : (
                <div className="space-y-2">
                  <div className="animate-pulse bg-muted/30 h-8 w-16 rounded" />
                  <div className="animate-pulse bg-muted/30 h-3 w-24 rounded" />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* ── Seven signal chips, two groups ─────────────────────────────── */}
      <HealthSignalChips />

      {/* ── Per-document bars ──────────────────────────────────────────── */}
      <HealthDocumentBars />

      {/* ── Checked queries table (Plan 17) ───────────────────────────── */}
      <CheckedQueriesSection onTotalChange={setCheckedCount} />
    </div>
  )
}