import React from "react"
import { AlertTriangle, ShieldCheck, BookOpen, Layers, Gauge } from "lucide-react"

interface BlindSpotsCardProps {
  unratedRunsCount: number
  /**
   * THE THIRD STATE. Phase 257 CR-06. Runs that HAVE a registered rate but recorded no
   * tokens. Excluded from the dollar total exactly like an unrated run, but for a different
   * reason and with a different remedy - so a card whose whole job is to say what the total
   * cannot see must name them separately rather than fold them into "unrated". Folding them
   * in is what made this card offer "View 675 Unrated Runs" and then show 332, under copy
   * claiming none of them had a registered rate when 343 of them did.
   */
  unmeasuredRunsCount: number
  incompleteCoverageCount: number
  /** A rate EXISTS - the same meaning as the ledger's is_rated. priced = rated - unmeasured. */
  ratedRunsCount: number
  onFilterUnrated: () => void
  onFilterIncompleteCoverage: () => void
  onOpenRateRegistry: () => void
}

/**
 * Split 100 across `parts` so the result ALWAYS sums to exactly 100 (largest remainder).
 * An all-zero input returns [100, 0, 0, ...] so an empty window reads as fully priced rather
 * than as a bare track. Exported for its own test: this is arithmetic, and arithmetic that
 * only ever runs inside a component is arithmetic nobody checks.
 */
export function apportion100(parts: number[]): number[] {
  const total = parts.reduce((a, b) => a + b, 0)
  if (total <= 0) return parts.map((_, i) => (i === 0 ? 100 : 0))
  const exact = parts.map((p) => (p / total) * 100)
  const floors = exact.map((e) => Math.floor(e))
  let remaining = 100 - floors.reduce((a, b) => a + b, 0)
  // Biggest fractional part first; ties go to the earlier segment, which keeps the output
  // deterministic rather than dependent on sort stability.
  const order = exact
    .map((e, i) => ({ i, frac: e - Math.floor(e) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i)
  const out = [...floors]
  for (const { i } of order) {
    if (remaining <= 0) break
    out[i] += 1
    remaining -= 1
  }
  return out
}

export const BlindSpotsCard: React.FC<BlindSpotsCardProps> = ({
  unratedRunsCount,
  unmeasuredRunsCount,
  incompleteCoverageCount,
  ratedRunsCount,
  onFilterUnrated,
  onFilterIncompleteCoverage,
  onOpenRateRegistry,
}) => {
  // THE GAUGE SAYS "PRICED", SO IT MUST COUNT PRICED. CR-06. Reading ratedRunsCount here
  // would render "72% Priced" on a window where 43% produced a figure - a brand new false
  // claim, on the card that exists to prevent false claims.
  const pricedCount = Math.max(0, ratedRunsCount - unmeasuredRunsCount)
  // ⛔ THREE INDEPENDENT Math.round CALLS DO NOT SUM TO 100, and the first version of this
  // gauge shipped that bug. Found by gemini's review of this fix; driven before fixing.
  //
  // Rounding each share on its own and clamping only the LAST one leaves the first two free
  // to overflow: 8 runs, 7 priced (87.5 -> 88) and 1 unmeasured (12.5 -> 13) gives 101, the
  // track renders 101% of its own width, and the labels announce "88% Priced · 13% No
  // tokens" over 8 runs. An exhaustive sweep of rated<=40 x unmeasured x unrated<=40 found
  // 34 such combinations. Clamping the remainder hid the third segment; it never fixed the
  // arithmetic, and a gauge on the honesty card must not be the thing that is wrong.
  //
  // Largest-remainder allocation: hand out the 100 whole units by integer share, then give
  // the leftovers to the biggest fractional parts. Sums to exactly 100 by construction, for
  // every input, and stays stable as the counts move.
  const [pricedPct, unmeasuredPct, unratedPct] = apportion100([
    pricedCount,
    unmeasuredRunsCount,
    unratedRunsCount,
  ])

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
              The first number anyone quotes should state what it excludes. Totals above omit runs with no registered rate, and runs whose tokens were never recorded.
            </p>
          </div>
        </div>

        {/* Coverage Honesty Gauge */}
        <div className="flex flex-col items-end gap-1.5 flex-none font-mono">
          <div className="flex items-center gap-3 text-xs">
            <span className="text-emerald-400 font-semibold flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5" />
              {pricedPct}% Priced
            </span>
            {unmeasuredPct > 0 && (
              <span
                className="text-slate-300 font-semibold flex items-center gap-1"
                title="A rate is registered, but no tokens were recorded for these runs"
              >
                <Gauge className="h-3.5 w-3.5" />
                {unmeasuredPct}% No tokens
              </span>
            )}
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
              style={{ width: `${pricedPct}%` }}
              title={`${pricedPct}% Priced`}
            />
            {unmeasuredPct > 0 && (
              <div
                className="bg-slate-400 h-full transition-all duration-300"
                style={{ width: `${unmeasuredPct}%` }}
                title={`${unmeasuredPct}% Rated but no tokens recorded`}
              />
            )}
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
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 pt-4">
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

        {/* 2. Rated, but nothing measured (CR-06) */}
        <div
          className="rounded-lg bg-card/60 p-3 border border-border/50 flex flex-col justify-between gap-3"
          data-testid="unmeasured-disclosure"
        >
          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-foreground">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-slate-400" />
                Rated, No Tokens
              </span>
              <span className="font-mono text-slate-300 font-bold">{unmeasuredRunsCount} runs</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1.5 leading-relaxed">
              These models <em>do</em> have a registered rate. Nothing was recorded to price, so
              they are excluded from the total rather than counted as $0.00 spend.
            </p>
          </div>
          {unmeasuredRunsCount > 0 ? (
            // NO BUTTON, DELIBERATELY. /admin/spend/runs has rated / unrated /
            // incomplete_coverage and no chip for this state, so any filter offered here would
            // land the operator on a different population than the number promised - which is
            // the exact defect (CR-06) this tile exists because of. The ledger already labels
            // these rows "No tokens recorded"; say where to look instead.
            <span className="text-[11px] text-muted-foreground">
              Shown as <span className="text-slate-300">No tokens recorded</span> in the ledger below.
            </span>
          ) : (
            <span className="text-[11px] text-emerald-400 flex items-center gap-1">
              Every rated run measured
            </span>
          )}
        </div>

        {/* 3. Incomplete Token Coverage */}
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

        {/* 4. Residual Disclosures (SEED-300) */}
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
