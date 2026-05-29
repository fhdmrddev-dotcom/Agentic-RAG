/**
 * Phase 087 Plan 02 Task 1 — PanelRail (PANEL-01, sketch 004 / panel-shell.md D4).
 *
 * The collapsed 52px vertical icon strip. Collapse leaves a rail, not nothing —
 * a pending ask_user must NEVER go silent just because the panel is collapsed
 * (panel-shell.md "Lost signal on collapse" / D4). Each icon is a REAL <button>
 * whose aria-label INCLUDES the live count ("Todos — 2 of 3 done", "Files — 4",
 * "Pending question — needs your answer"); the visual count/warn badge is
 * decorative (aria-hidden) so the screen reader never double-announces
 * (UI-SPEC Accessibility Contract / Rail icon buttons). Clicking any icon expands
 * the panel back open.
 *
 * Color language (LOCKED): primary indigo = non-warning count badge; amber
 * (--warning) = pending-question warn badge.
 */
import { ListChecks, FileText, MessageCircleQuestion } from "lucide-react"
import { cn } from "@/lib/utils"

export interface PanelRailProps {
  todos: { done: number; total: number }
  filesCount: number
  pendingCount: number
  /** Expand the panel back to its open state. */
  onExpand: () => void
}

interface RailIconProps {
  Icon: typeof ListChecks
  label: string
  badge?: string | null
  warn?: boolean
  onClick: () => void
}

function RailIcon({ Icon, label, badge, warn, onClick }: RailIconProps) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cn(
        "relative grid h-[30px] w-[30px] place-items-center rounded-md text-[hsl(var(--muted-foreground-dim))]",
        "transition-colors hover:bg-accent hover:text-foreground",
        "focus:outline-none focus-visible:ring-1 focus-visible:ring-ring",
      )}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      {badge != null && (
        <span
          aria-hidden="true"
          className={cn(
            "absolute -right-0.5 -top-0.5 grid h-[14px] min-w-[14px] place-items-center rounded-full px-[3px]",
            "font-mono text-[9px] font-semibold text-[#06061a]",
            warn ? "bg-[hsl(var(--warning))]" : "bg-primary",
          )}
        >
          {badge}
        </span>
      )}
    </button>
  )
}

export function PanelRail({ todos, filesCount, pendingCount, onExpand }: PanelRailProps) {
  return (
    <div className="flex h-full w-[52px] flex-col items-center gap-3 border-l border-border py-3">
      <RailIcon
        Icon={ListChecks}
        label={`Todos — ${todos.done} of ${todos.total} done`}
        badge={todos.total > 0 ? `${todos.done}/${todos.total}` : null}
        onClick={onExpand}
      />
      <RailIcon
        Icon={FileText}
        label={`Files — ${filesCount}`}
        badge={filesCount > 0 ? String(filesCount) : null}
        onClick={onExpand}
      />
      {pendingCount > 0 && (
        <RailIcon
          Icon={MessageCircleQuestion}
          label="Pending question — needs your answer"
          badge={String(pendingCount)}
          warn
          onClick={onExpand}
        />
      )}
    </div>
  )
}

export default PanelRail
