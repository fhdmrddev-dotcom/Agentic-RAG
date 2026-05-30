/**
 * Phase 087 Plan 02 Task 1 — PanelSection (PANEL-01, sketch 004 / panel-shell.md D2).
 *
 * The collapsible accordion primitive shared by all four panel sections
 * (Todos · Files · Pending question · Versions). The `.sec-head` is a REAL
 * <button aria-expanded> (Enter/Space toggle for free), the chevron is decorative
 * (aria-hidden) and rotates on collapse, and the right-aligned mono count badge is
 * the ONLY non-400 (font-semibold/600) weight in the panel (UI-SPEC Typography).
 * `.count.warn` → amber (--warning) when a question is pending.
 *
 * A11Y (UI-SPEC Accessibility Contract): the body is a role="region" labelled by
 * the head's id; the head carries aria-expanded + aria-controls. The collapse
 * uses display:none (instant), so prefers-reduced-motion only affects the chevron
 * rotation — guarded via the motion-safe: variant below.
 */
import { useId, useState } from "react"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

/** Count badge value: a fraction ({done,total}) or a flat number. */
export type PanelSectionCount = { done?: number; total?: number } | number

export interface PanelSectionProps {
  title: string
  count?: PanelSectionCount
  /** Amber the count badge (pending question). */
  warn?: boolean
  defaultOpen?: boolean
  children: React.ReactNode
}

function renderCount(count: PanelSectionCount | undefined): string | null {
  if (count == null) return null
  if (typeof count === "number") return String(count)
  const { done, total } = count
  if (done != null && total != null) return `${done}/${total}`
  if (total != null) return String(total)
  if (done != null) return String(done)
  return null
}

export function PanelSection({
  title,
  count,
  warn = false,
  defaultOpen = true,
  children,
}: PanelSectionProps) {
  const [open, setOpen] = useState(defaultOpen)
  const headId = useId()
  const bodyId = useId()
  const countText = renderCount(count)

  return (
    <div className="flex flex-col border-b border-border/40">
      <button
        type="button"
        id={headId}
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex w-full items-center gap-2 px-4 py-3 text-left",
          // Phase 088-05 (UAT SC#2): panel-scoped AA muted (was --muted-foreground-dim
          // → 3.59:1 dark / 4.01:1 light on the panel surface; now ≥4.5:1 both themes).
          "text-[0.72rem] uppercase tracking-[0.07em] text-panel-muted-foreground-dim",
          "transition-colors hover:text-panel-muted-foreground",
          "focus:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        )}
      >
        <ChevronDown
          aria-hidden="true"
          className={cn(
            "h-3 w-3 flex-none text-current motion-safe:transition-transform",
            !open && "-rotate-90",
          )}
        />
        <span className="min-w-0 truncate">{title}</span>
        {countText != null && (
          <span
            className={cn(
              // The ONLY non-400 weight in the panel (UI-SPEC Typography).
              "ml-auto font-mono text-[0.72rem] font-semibold normal-case tracking-normal",
              // Phase 088-05 (UAT SC#2): the count badge ("2/2", "2") is meaningful
              // metadata → panel-scoped AA muted (light --muted-foreground was 4.01:1).
              warn ? "text-[hsl(var(--warning))]" : "text-panel-muted-foreground",
            )}
          >
            {countText}
          </span>
        )}
      </button>

      {open && (
        <div id={bodyId} role="region" aria-labelledby={headId} className="pb-3">
          {children}
        </div>
      )}
    </div>
  )
}

export default PanelSection
