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
 * Plan 08 (operator directive 2026-05-29 — nav-style consolidation): the rail now
 * leads with an ALWAYS-PRESENT Expand control (PanelRightOpen, "Expand workspace"),
 * mirroring NavPanel's single collapse/expand button. This is the permanent
 * reopen-by-mouse host on every thread (incl. the empty/welcome screen, where
 * todos=0 and files=0 leave no count badges) AND the permanent host for the
 * pulsing-amber-dot pending indicator (moved off the removed chat-header toggle).
 *
 * Color language (LOCKED): primary indigo = non-warning count badge; amber
 * (--warning) = pending-question warn badge / pulse dot.
 */
import { ListChecks, FileText, MessageCircleQuestion, PanelRightOpen } from "lucide-react"
import { cn } from "@/lib/utils"

export interface PanelRailProps {
  todos: { done: number; total: number }
  filesCount: number
  pendingCount: number
  /** True when an ask_user is pending → pulsing-amber-dot on the Expand control
   *  (PANEL-01). prefers-reduced-motion honored via motion-safe:. */
  pending?: boolean
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
        "relative grid h-[30px] w-[30px] place-items-center rounded-md text-panel-muted-foreground-dim",
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

export function PanelRail({ todos, filesCount, pendingCount, pending, onExpand }: PanelRailProps) {
  return (
    <div className="flex h-full w-[52px] flex-col items-center gap-3 border-l border-[hsl(var(--panel-border))] py-3">
      {/* Always-present Expand control (nav-parity with NavPanel's single button).
          Renders even when todos=0 and files=0 — the rail is never empty/
          un-actionable. Hosts the pulsing-amber-dot when an ask_user is pending. */}
      <button
        type="button"
        aria-label="Expand workspace"
        onClick={onExpand}
        className={cn(
          "relative grid h-[30px] w-[30px] place-items-center rounded-md text-panel-muted-foreground-dim",
          "transition-colors hover:bg-accent hover:text-foreground",
          "focus:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        )}
      >
        <PanelRightOpen className="h-4 w-4" aria-hidden="true" />
        {pending && (
          <span
            aria-hidden="true"
            className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-[hsl(var(--warning))] motion-safe:animate-pulse"
          />
        )}
      </button>
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
