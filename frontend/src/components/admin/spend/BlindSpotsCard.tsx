import React from "react"
import { AlertTriangle, ShieldCheck, ArrowRight, BookOpen, Layers } from "lucide-react"
import { Button } from "@/components/ui/button"

interface BlindSpotsCardProps {
  unratedRunsCount: number
  incompleteCoverageCount: number
  ratedRunsCount: number
  onFilterUnrated: () => void
  onFilterIncompleteCoverage: () => void
  onOpenRateRegistry: () => void
}

export const BlindSpotsCard: React.FC<BlindSpotsCardProps> = ({
  unratedRunsCount,
  incompleteCoverageCount,
  ratedRunsCount,
  onFilterUnrated,
  onFilterIncompleteCoverage,
  onOpenRateRegistry,
}) => {
  const totalRuns = ratedRunsCount + unratedRunsCount
  const ratedPct = totalRuns > 0 ? Math.round((ratedRunsCount / totalRuns) * 100) : 100
  const unratedPct = 100 - ratedPct

  const hasBlindSpots = unratedRunsCount > 0 || incompleteCoverageCount > 0

  return (
    <div className="rounded-xl border border-amber-500/30 bg-gradient-to-b from-amber-500/10 to-amber-500/5 p-5 shadow-sm">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-amber-500/20">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-amber-500/20 p-2 text-amber-400">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              What This View Cannot See
              <span className="text-[11px] font-mono font-normal px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                Honesty Disclosure
              </span>
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              The first number anyone quotes should state what it excludes. Totals above omit unrated and unmeasured usage.
            </p>
          </div>
        </div>

        {/* Coverage Honesty Gauge */}
        <div className="flex flex-col items-end gap-1.5 flex-none font-mono">
          <div className="flex items-center gap-3 text-xs">
            <span className="text-emerald-400 font-semibold flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5" />
              {ratedPct}% Priced
            </span>
            {unratedPct > 0 && (
              <span className="text-amber-400 font-semibold flex items-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5" />
                {unratedPct}% Unrated
              </span>
            )}
          </div>
          {/* Dual tone progress track */}
          <div className="w-48 h-2 rounded-full bg-card overflow-hidden flex border border-border/40">
            <div
              className="bg-emerald-500 h-full transition-all duration-300"
              style={{ width: `${ratedPct}%` }}
              title={`${ratedPct}% Rated`}
            />
            {unratedPct > 0 && (
              <div
                className="bg-amber-500 h-full transition-all duration-300"
                style={{ width: `${unratedPct}%` }}
                title={`${unratedPct}% Unrated`}
              />
            )}
          </div>
        </div>
      </div>

      {/* Disclosures Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
        {/* 1. Unrated Models */}
        <div className="rounded-lg bg-card/60 p-3 border border-border/50 flex flex-col justify-between gap-3">
          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-foreground">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                Unrated Models
              </span>
              <span className="font-mono text-amber-400 font-bold">{unratedRunsCount} runs</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1.5 leading-relaxed">
              Models without a registered rate in <code className="text-foreground">model_rates</code> are excluded from org dollar totals rather than falsely priced at $0.00.
            </p>
          </div>
          {unratedRunsCount > 0 ? (
            <button
              type="button"
              onClick={onFilterUnrated}
              className="text-xs text-amber-400 hover:text-amber-300 font-medium flex items-center gap-1 transition-colors text-left"
            >
              View {unratedRunsCount} Unrated Runs →
            </button>
          ) : (
            <span className="text-[11px] text-emerald-400 flex items-center gap-1">
              ✓ All models in window rated
            </span>
          )}
        </div>

        {/* 2. Incomplete Token Coverage */}
        <div className="rounded-lg bg-card/60 p-3 border border-border/50 flex flex-col justify-between gap-3">
          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-foreground">
              <span className="flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-indigo-400" />
                Partial Coverage Legs
              </span>
              <span className="font-mono text-indigo-300 font-bold">{incompleteCoverageCount} runs</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1.5 leading-relaxed">
              Runs missing one or more of the 4 counting legs (<code className="text-foreground">agent</code>, <code className="text-foreground">single</code>, <code className="text-foreground">batch</code>, <code className="text-foreground">emit</code>). Dollar amounts are lower bounds.
            </p>
          </div>
          {incompleteCoverageCount > 0 ? (
            <button
              type="button"
              onClick={onFilterIncompleteCoverage}
              className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1 transition-colors text-left"
            >
              View {incompleteCoverageCount} Incomplete Coverage Runs →
            </button>
          ) : (
            <span className="text-[11px] text-emerald-400 flex items-center gap-1">
              ✓ Full 4-leg coverage recorded
            </span>
          )}
        </div>

        {/* 3. Residual Disclosures (SEED-300) */}
        <div className="rounded-lg bg-card/60 p-3 border border-border/50 flex flex-col justify-between gap-3">
          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-foreground">
              <span className="flex items-center gap-1.5">
                <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
                Residual Blind Spots
              </span>
              <span className="font-mono text-muted-foreground text-[10px]">SEED-300</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1.5 leading-relaxed">
              Pre-Phase 256 historical runs hold NULL token counts. Uninstrumented external egress and uncounted judge shots in legacy runs are permanently unmetered.
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenRateRegistry}
            className="text-xs text-muted-foreground hover:text-foreground font-medium flex items-center gap-1 transition-colors text-left"
          >
            Open Rate Registry (Migration 183) →
          </button>
        </div>
      </div>
    </div>
  )
}
