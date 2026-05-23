/**
 * Phase 075.6 Plan 03 / Req #8 — pinned "Working" badge at the top of an
 * active assistant turn.
 *
 * Reuses the existing `.animate-brandPulse` keyframe from index.css:207-220
 * (shipped Phase 068.5) — DO NOT redefine the keyframe here.
 *
 * Wrapped in `React.memo` with a custom equality on `(visible, label)` per
 * RESEARCH Pitfall 5 / Landmine L4. The stable outer wrapper preserves the
 * DOM node across reducer-driven re-renders, so:
 *   1. The CSS animation runs smoothly (no remount-induced restart flicker).
 *   2. Identical-props re-renders from the parent MessageItem are skipped
 *      (parent re-runs every onToolArgsProgress reducer tick during a long
 *      execute_code stream — without the memo, this badge would repaint
 *      O(N) times for N progress events).
 *
 * Folds BUG-260514-03 (streaming-indicator-top-bottom-desync) per
 * D-075.6-D1 — the Working badge supersedes the bottom-indicator
 * sticky-text path.
 */
import React from "react"

export interface WorkingBadgeProps {
  visible: boolean
  label?: string
}

function WorkingBadgeImpl({ visible, label = "Working" }: WorkingBadgeProps) {
  // IN-06 (2026-05-24): gate `animate-brandPulse` on `visible` so the keyframe
  // doesn't continue running on an invisible (empty-content) node. The stable
  // outer wrapper still preserves the DOM node across visibility transitions
  // (Pitfall 5 / Landmine L4 mitigation) — only the animation class is gated.
  return (
    <div
      data-testid="working-badge"
      className={
        "flex items-center gap-1.5 text-xs font-semibold text-primary/80 mb-1" +
        (visible ? " animate-brandPulse" : "")
      }
      aria-hidden={!visible}
    >
      {visible && (
        <>
          <span aria-hidden="true">✦</span>
          <span>{label}</span>
        </>
      )}
    </div>
  )
}

export const WorkingBadge = React.memo<WorkingBadgeProps>(
  WorkingBadgeImpl,
  (prev, next) => prev.visible === next.visible && prev.label === next.label,
)
WorkingBadge.displayName = "WorkingBadge"
