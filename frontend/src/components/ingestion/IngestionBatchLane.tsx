import React, { useState } from "react"
import { cn } from "@/lib/utils"

interface IngestionBatchLaneProps {
  /** Total countable rows/files in current batch */
  totalFiles: number
  /** Number of files already completed and preserved */
  completedFiles: number
  /** Whether the queue is currently held/paused on provider refusal */
  isPaused?: boolean
  /** Active file name being embedded (optional) */
  activeFileName?: string
  /** External motion energy override (0 = calm, 1 = energized). Defaults to internal state. */
  energy?: number
  className?: string
}

const TOTAL_LANE_BARS = 34

/**
 * Phase 230 Plan 05: IngestionBatchLane (Sketch 227 Variant B winner).
 *
 * Visualises the ingestion queue as a discrete batch wave across 34 bars.
 * - Every bar represents ~10 files (countable rows).
 * - The wave moves left -> right.
 * - When paused, the held amber column is exactly where the provider refused.
 * - ⛔ STRICT D-217-19 COMPLIANCE: NO PERCENTAGE AND NO ETA.
 * - Energized by default with a calm toggle (Phase 127 precedent), respecting prefers-reduced-motion.
 */
export function IngestionBatchLane({
  totalFiles,
  completedFiles,
  isPaused = false,
  activeFileName,
  energy: externalEnergy,
  className,
}: IngestionBatchLaneProps) {
  const [internalEnergy, setInternalEnergy] = useState<number>(1)
  const effectiveEnergy = externalEnergy ?? internalEnergy

  const safeTotal = Math.max(1, totalFiles)
  const safeCompleted = Math.min(Math.max(0, completedFiles), safeTotal)
  const step = Math.max(1, Math.round(safeTotal / TOTAL_LANE_BARS))
  const filledBars = Math.round((safeCompleted / safeTotal) * TOTAL_LANE_BARS)

  return (
    <div
      data-testid="ingestion-batch-lane"
      className={cn(
        "rounded-xl border border-border bg-gradient-to-b from-card to-background p-4 shadow-sm",
        className,
      )}
      style={{ "--energy": effectiveEnergy } as React.CSSProperties}
    >
      {/* ── Header: Title, State Pill & Motion Mode Toggle ────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <h3 className="font-semibold text-sm tracking-tight">
            {isPaused ? "Ingestion paused" : "Batch progress"}
          </h3>
          <span
            data-testid="lane-status-pill"
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium border",
              isPaused
                ? "bg-amber-500/10 border-amber-500/40 text-amber-500 dark:text-amber-400"
                : safeCompleted >= safeTotal
                ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
                : "bg-primary/10 border-primary/30 text-primary animate-pulse",
            )}
          >
            {isPaused ? "⏸ Paused" : safeCompleted >= safeTotal ? "✓ Completed" : "● Working"}
          </span>
        </div>

        {/* Calm / Energized toggle */}
        <div className="flex items-center gap-1 text-xs" data-testid="lane-energy-toggle">
          <span className="text-[11px] text-muted-foreground mr-1 uppercase tracking-wider font-mono">
            Motion:
          </span>
          <button
            type="button"
            onClick={() => setInternalEnergy(1)}
            className={cn(
              "px-2 py-0.5 rounded-full border transition-colors",
              effectiveEnergy === 1
                ? "bg-primary/15 border-primary text-primary font-medium"
                : "bg-muted border-border text-muted-foreground hover:text-foreground",
            )}
          >
            Energized
          </button>
          <button
            type="button"
            onClick={() => setInternalEnergy(0)}
            className={cn(
              "px-2 py-0.5 rounded-full border transition-colors",
              effectiveEnergy === 0
                ? "bg-primary/15 border-primary text-primary font-medium"
                : "bg-muted border-border text-muted-foreground hover:text-foreground",
            )}
          >
            Calm
          </button>
        </div>
      </div>

      {/* ── The 34 Bars Lane ──────────────────────────────────────────── */}
      <div className="flex gap-[3px] my-3" data-testid="batch-lane-bars">
        {Array.from({ length: TOTAL_LANE_BARS }).map((_, i) => {
          const isCompleted = i < filledBars
          const isCurrent = i === filledBars && safeCompleted < safeTotal

          return (
            <i
              key={i}
              className={cn(
                "flex-1 h-6 rounded-[3px] transition-all duration-300",
                isCompleted &&
                  "bg-[linear-gradient(180deg,hsl(142_71%_52%),hsl(142_60%_30%))] border-transparent",
                isCurrent &&
                  (isPaused
                    ? "bg-[linear-gradient(180deg,hsl(38_92%_62%),hsl(38_80%_34%))] border-transparent shadow-[0_0_10px_rgba(245,158,11,0.5)]"
                    : "bg-[linear-gradient(180deg,hsl(239_100%_82%),hsl(239_84%_52%))] border-transparent shadow-[0_0_12px_rgba(99,102,241,0.5)] animate-laneRise"),
                !isCompleted && !isCurrent && "bg-muted/50 border border-border/50",
              )}
            />
          )
        })}
      </div>

      {/* ── Honest File Counts (NO ETA, NO PERCENTAGE per D-217-19) ───── */}
      <div className="flex justify-between items-center text-xs font-mono text-muted-foreground">
        <span data-testid="lane-file-count">
          <strong className="text-foreground">{safeCompleted} of {safeTotal} files</strong>
        </span>
        <span className="text-muted-foreground/70">
          each bar ≈ {step} {step === 1 ? "file" : "files"}
        </span>
      </div>

      {/* Optional Active File Row */}
      {activeFileName && !isPaused && (
        <div className="mt-2.5 pt-2 border-t border-border/50 flex items-center gap-2 text-xs">
          <span className="w-2 h-2 rounded-full bg-primary animate-brandPulse flex-none" />
          <span className="truncate text-muted-foreground">
            Embedding: <span className="text-foreground font-medium">{activeFileName}</span>
          </span>
        </div>
      )}
    </div>
  )
}
