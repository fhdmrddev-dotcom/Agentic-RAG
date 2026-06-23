/**
 * Phase 123 Plan 05 Task 2a (TRIG-01) — ProviderScoreboard (sketch 042-A, NO ANALOG).
 *
 * The load-bearing, no-analog render: an N-COLUMN per-provider grid where N = the
 * org's CONFIGURED targets (NOT a fixed four). Two hard rules from the 042-A
 * provider-set adaptivity band:
 *
 *   1. A provider the org doesn't run NEVER renders — a score you can't act on is a
 *      fabricated measurement (honesty-is-load-bearing, T-123-05-01). The grid is
 *      driven PURELY by the cells the server returned; a non-target provider simply
 *      isn't in the cell list, so it never appears.
 *   2. N=1 (single-provider) is the CLEAN BASELINE, not a degraded mode — one column,
 *      NO "degraded"/"missing" affordance; OpenRouter is a DISTINCT column from native
 *      DeepSeek / GLM (zhipu/z-ai) / Kimi (moonshot) / MiniMax when both are targets
 *      (the serving path, not the model name, drives trigger behavior — cf. Phase 122
 *      per-provider emit_tier).
 *
 * EVERY cell shows BOTH sub-scores (never a hidden aggregate / hover-only): `fires` =
 * should-trigger recall · `no-false` = should-NOT precision (the false-fire rail). The
 * UI renders server-computed scores only — no client-side fabrication.
 */
import { cn } from "@/lib/utils"
import type { TunerCell } from "@/lib/api"

interface Props {
  /** The per-provider cells the server returned for ONE candidate. The column set is
   *  derived from these — a non-target provider simply isn't in the list (rule 1). */
  cells: TunerCell[]
}

/** Format a 0..1 sub-score as a raw 2-decimal value (never a fabricated %). */
function fmt(score: number): string {
  return score.toFixed(2)
}

/** A sub-score is the false-fire rail when it's the should-NOT precision; tint
 *  red-ward as it drops so a regressed no-false reads pre-attentively (042-A). */
function railTone(score: number, isNoFalse: boolean): string {
  if (!isNoFalse) {
    // fires (recall): green-ward when high, dim when low.
    return score >= 0.8 ? "text-[hsl(var(--panel-status-done))]" : "text-muted-foreground"
  }
  // no-false (the false-fire rail): a low value is a regression — surface it red.
  if (score >= 0.85) return "text-[hsl(var(--panel-status-done))]"
  if (score >= 0.6) return "text-[hsl(var(--panel-status-active))]"
  return "text-[hsl(0_80%_72%)]"
}

export function ProviderScoreboard({ cells }: Props) {
  return (
    <div
      data-testid="provider-scoreboard"
      className="grid gap-2"
      style={{ gridTemplateColumns: `repeat(${Math.max(cells.length, 1)}, minmax(0, 1fr))` }}
    >
      {cells.map((c) => (
        <div
          key={`${c.provider}:${c.model}`}
          data-testid="scoreboard-cell"
          className="rounded-lg ghost-border bg-card/40 px-2.5 py-2 flex flex-col gap-1.5"
        >
          {/* Column header = the provider (distinct from the model serving path). */}
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="text-[11px] font-mono font-semibold text-foreground truncate" title={c.provider}>
              {c.provider}
            </span>
            <span className="text-[10px] font-mono text-muted-foreground truncate" title={c.model}>
              {c.model}
            </span>
          </div>

          {/* BOTH sub-scores, ALWAYS visible (never a hidden aggregate / hover-only). */}
          <div className="flex flex-col gap-0.5 text-[11px] font-mono">
            <span data-testid="cell-fires" className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">fires</span>
              <span className={cn("tabular-nums", railTone(c.axes.fires, false))}>{fmt(c.axes.fires)}</span>
            </span>
            <span data-testid="cell-no-false" className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">no-false</span>
              <span className={cn("tabular-nums", railTone(c.axes.no_false, true))}>{fmt(c.axes.no_false)}</span>
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}
