/**
 * Phase 123 Plan 05 Task 2a (TRIG-01) — ProviderScoreboard (sketch 042-A, NO ANALOG).
 * Phase 123.1 Plan 02 Task 1 (D-02/D-12) — restored to sketch-041's VERTICAL full-width
 * provider rows (the build had crammed them into a fixed N-column horizontal grid
 * that's illegible at the org's real 8-provider count — BUG-260624-01 HIGH #1).
 *
 * The load-bearing, no-analog render: ONE full-width row per provider cell where the row
 * set = the org's CONFIGURED targets (NOT a fixed four). Two hard rules from the 042-A
 * provider-set adaptivity band:
 *
 *   1. A provider the org doesn't run NEVER renders — a score you can't act on is a
 *      fabricated measurement (honesty-is-load-bearing, T-123-05-01). The rows are
 *      driven PURELY by the cells the server returned; a non-target provider simply
 *      isn't in the cell list, so it never appears.
 *   2. N=1 (single-provider) is the CLEAN BASELINE, not a degraded mode — one row,
 *      NO "degraded"/"missing" affordance; OpenRouter is a DISTINCT row from native
 *      DeepSeek / GLM (zhipu/z-ai) / Kimi (moonshot) / MiniMax when both are targets
 *      (the serving path, not the model name, drives trigger behavior — cf. Phase 122
 *      per-provider emit_tier).
 *
 * Each row carries (042-A): provider · model | leading COMBINED-score number (the
 * server-computed `TunerCell.score`, previously unused — D-12) | a colored magnitude bar
 * whose width + tone come from that same `score` | BOTH honest sub-scores `fires` (should-
 * trigger recall) and `no-false` (the should-NOT false-fire rail). The component renders
 * SERVER-computed scores ONLY — it never recomputes the held-out split or `(fires+no_false)/2`
 * client-side (the honesty boundary, T-123.1-02-01). It stays a pure cells-in render so
 * Plan 04 can mount a second instance for the baseline candidate's D-04 standalone block.
 */
import { cn } from "@/lib/utils"
import type { TunerCell } from "@/lib/api"

interface Props {
  /** The per-provider cells the server returned for ONE candidate. The row set is
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

/** The combined-score magnitude tone (good ≥~0.85 · mid ~0.6-0.85 · bad <0.6, sketch
 *  041/042 thresholds). Drives BOTH the leading number's text color and the bar fill. */
function scoreTone(score: number): { text: string; bar: string } {
  if (score >= 0.85) {
    return { text: "text-[hsl(var(--panel-status-done))]", bar: "bg-[hsl(var(--panel-status-done))]" }
  }
  if (score >= 0.6) {
    return { text: "text-[hsl(var(--panel-status-active))]", bar: "bg-[hsl(var(--panel-status-active))]" }
  }
  return { text: "text-[hsl(0_80%_72%)]", bar: "bg-[hsl(0_80%_72%)]" }
}

export function ProviderScoreboard({ cells }: Props) {
  return (
    // Vertical full-width rows (sketch 041 `.scoreboard` flex-column) — legible at 8+
    // providers, never a fixed N-column horizontal grid.
    <div data-testid="provider-scoreboard" className="flex flex-col gap-2">
      {cells.map((c) => {
        const tone = scoreTone(c.score)
        // Bar width is the SERVER combined score (0..1) → %, clamped to [0,100].
        const width = `${Math.max(0, Math.min(100, Math.round(c.score * 100)))}%`
        return (
          <div
            key={`${c.provider}:${c.model}`}
            data-testid="scoreboard-cell"
            className="rounded-lg ghost-border bg-card/40 px-3 py-2.5 grid grid-cols-[1.3fr_auto_1fr] items-center gap-3"
          >
            {/* Col 1: provider · model (provider distinct from the model serving path). */}
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="text-xs font-mono font-semibold text-foreground truncate" title={c.provider}>
                {c.provider}
              </span>
              <span className="text-[10px] font-mono text-muted-foreground truncate" title={c.model}>
                {c.model}
              </span>
            </div>

            {/* Col 2: leading COMBINED score (server cell.score, D-12) — the at-a-glance number. */}
            <div className="flex flex-col items-end gap-0.5 shrink-0">
              <span
                data-testid="cell-score"
                className={cn("text-base font-mono font-bold tabular-nums", tone.text)}
              >
                {fmt(c.score)}
              </span>
              <span className="text-[9px] uppercase tracking-wider font-mono text-muted-foreground">score</span>
            </div>

            {/* Col 3: magnitude bar (width + tone from cell.score) over BOTH honest sub-scores. */}
            <div className="flex flex-col gap-1.5 min-w-0">
              <div
                data-testid="scoreboard-bar"
                className="h-[5px] rounded-full bg-muted/60 overflow-hidden"
                role="presentation"
              >
                <div
                  data-testid="scoreboard-bar-fill"
                  className={cn("h-full rounded-full", tone.bar)}
                  style={{ width }}
                />
              </div>
              {/* BOTH sub-scores, ALWAYS visible (never a hidden aggregate / hover-only). */}
              <div className="flex items-center justify-between gap-3 text-[11px] font-mono">
                <span data-testid="cell-fires" className="flex items-center gap-1.5">
                  <span className="text-muted-foreground">fires</span>
                  <span className={cn("tabular-nums", railTone(c.axes.fires, false))}>{fmt(c.axes.fires)}</span>
                </span>
                <span data-testid="cell-no-false" className="flex items-center gap-1.5">
                  <span className="text-muted-foreground">no-false</span>
                  <span className={cn("tabular-nums", railTone(c.axes.no_false, true))}>{fmt(c.axes.no_false)}</span>
                </span>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
