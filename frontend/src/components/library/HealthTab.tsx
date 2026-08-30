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

function toStatTiles(overview: HealthOverview, checkedCount?: number): StatTile[] {
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
      value: checkedCount ?? "Not known yet",
      description: checkedCount !== undefined
        ? `${checkedCount} query${checkedCount !== 1 ? "ies" : "y"} tracked`
        : "coming with checked queries",
    },
    {
      label: "MATCH STRENGTH",
      value: overview.health_score != null ? `${Math.round(overview.health_score * 100)}%` : "—",
      description: "average similarity of what searches returned",
    },
  ]
}

export function HealthTab() {
  const [overview, setOverview] = useState<HealthOverview | null>(null)
  const [trend, setTrend] = useState<RetrievalTrendPoint[] | null>(null)
  const [trendDays, setTrendDays] = useState(30)

  useEffect(() => {
    getHealthOverview().then(setOverview).catch(() => setOverview(null))
  }, [])

  useEffect(() => {
    getRetrievalTrend(trendDays).then(setTrend).catch(() => setTrend(null))
  }, [trendDays])

  const tiles = overview ? toStatTiles(overview) : null

  return (
    <div className="flex flex-col gap-6 overflow-y-auto">
      {/* ── Ring + chart row ───────────────────────────────────────────── */}
      <div className="grid grid-cols-[auto_1fr] gap-6">
        {overview ? (
          <CoverageRing
            retrieved={overview.retrieved_this_month}
            total={overview.total_documents}
          />
        ) : (
          <div className="h-44 w-44 animate-pulse bg-muted/30 rounded-lg" />
        )}

        <div className="min-w-0">
          <Suspense fallback={<ChartSkeleton />}>
            {trend ? (
              <RetrievalTrendChart data={trend} />
            ) : (
              <div className="ghost-border bg-card/50 rounded-lg p-4 h-64 animate-pulse" />
            )}
          </Suspense>
          <div className="flex gap-2 mt-2">
            {[7, 30, 90].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setTrendDays(d)}
                className={`text-xs px-2 py-1 rounded ${
                  trendDays === d
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {d}d
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Five stat tiles ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {(tiles ?? Array.from({ length: 5 })).map((tile) => (
          <div
            key={tile.label}
            className="ghost-border bg-card/50 rounded-lg p-4 flex flex-col gap-2"
          >
            <span className="text-xs font-medium text-muted-foreground">{tile.label}</span>
            {overview ? (
              <>
                <span className="text-3xl font-bold font-headline tabular-nums leading-none text-foreground">
                  {tile.value}
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
        ))}
      </div>

      {/* ── Seven signal chips, two groups ─────────────────────────────── */}
      <HealthSignalChips />

      {/* ── Per-document bars ──────────────────────────────────────────── */}
      <HealthDocumentBars />
    </div>
  )
}