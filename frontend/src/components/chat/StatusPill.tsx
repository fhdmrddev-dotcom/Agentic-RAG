/**
 * Phase 075.8 Task 1 — Universal status pill.
 *
 * Sketch source: sources/002-tool-call-panel/ D5 — "universal status pill".
 * Spec lives at .claude/skills/sketch-findings-agentic-rag/references/tool-call-panel.md#d5
 *
 * Visual contract (Deep Midnight, mirrored from sources/themes/default.css):
 *   running     → bg-primary/15  text-primary    dot animates dotBounce
 *   preparing   → same as running, italic verb
 *   done        → bg-success/15  text-success    duration shown
 *   failed      → bg-destructive/15 text-destructive  duration shown
 *   interrupted → bg-amber-500/15 text-amber-400 duration shown
 *
 * `dotBounce` keyframe lives in index.css:148-157 (predates this phase). Tailwind
 * JIT picks up `animate-dotBounce` from this file's class list — same path
 * MessageItem.tsx already exercises. No tailwind.config.js change needed.
 */

import { cn } from "@/lib/utils"

export type ToolStatus = "preparing" | "running" | "done" | "interrupted" | "failed"

export interface StatusPillProps {
  status: ToolStatus
  /** Milliseconds — shown for done/failed/interrupted. */
  duration?: number
  /** Overrides the default "running" verb (e.g., "searching", "executing"). */
  runningLabel?: string
  /** Custom done label (e.g., "4 results") — overrides the literal "done". */
  doneLabel?: string
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

const VARIANTS: Record<ToolStatus, string> = {
  preparing: "bg-primary/15 text-primary italic",
  running: "bg-primary/15 text-primary",
  done: "bg-success/15 text-success",
  interrupted: "bg-amber-500/15 text-amber-400",
  failed: "bg-destructive/15 text-destructive",
}

export function StatusPill({ status, duration, runningLabel, doneLabel }: StatusPillProps) {
  // Pill copy contract (D5):
  //   preparing/running → verb ("running" | runningLabel)
  //   done → "done · {duration}" or "{doneLabel} · {duration}" (duration omitted if undefined)
  //   failed → "failed · {duration}"
  //   interrupted → "interrupted · {duration}"
  let label: string
  if (status === "preparing") {
    label = runningLabel ?? "preparing"
  } else if (status === "running") {
    label = runningLabel ?? "running"
  } else if (status === "done") {
    const base = doneLabel ?? "done"
    label = duration != null && duration > 0 ? `${base} · ${formatDuration(duration)}` : base
  } else if (status === "failed") {
    label = duration != null && duration > 0 ? `failed · ${formatDuration(duration)}` : "failed"
  } else {
    // interrupted
    label = duration != null && duration > 0 ? `interrupted · ${formatDuration(duration)}` : "interrupted"
  }

  const isActive = status === "running" || status === "preparing"

  return (
    <span
      data-testid="status-pill"
      data-status={status}
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full",
        "font-mono text-[10px] uppercase tracking-wider",
        "flex-shrink-0",
        VARIANTS[status],
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "inline-block w-1.5 h-1.5 rounded-full bg-current",
          isActive && "animate-dotBounce",
        )}
      />
      <span className="tabular-nums">{label}</span>
    </span>
  )
}
