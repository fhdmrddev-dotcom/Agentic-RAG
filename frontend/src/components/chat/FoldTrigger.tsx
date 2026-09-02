import { ChevronDown, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Phase 224-05 (`BUG-260902-07`, second half) — THE ONE FOLD CONTROL, USED TWICE.
 *
 * ── WHAT THIS FIXES ────────────────────────────────────────────────────────────────────
 *
 * The operator, 2026-09-02: *"the folded menu should be more clear; it is buried within the
 * text and it is not highlighted as it should be."*
 *
 * Measured, and it reproduced on TWO components rather than one:
 *
 *   `CitationList.tsx:32-44`   `text-xs text-muted-foreground` + a 12px chevron
 *   `RunCard.tsx:481-484`      `text-xs text-muted-foreground/80` + a 12px chevron
 *
 * Same size, same token, same absent border, same absent surface — and the reasoning one is
 * DIMMER still. Both sit directly beneath body copy set larger and at higher contrast, so
 * both read as a trailing sentence rather than as something you can press.
 *
 * ⚠ **IT IS ONE COMPONENT AND NOT TWO LOOKALIKES, AND THAT IS THE POINT.** This repo has
 * paid for the alternative repeatedly — `connectionMark` served four surfaces from two
 * copies until 214-08 moved it to `lib/`; `TOOL_PHRASES` named tools for the canvas while
 * chat rendered raw ids. **A second copy is how two surfaces drift.** If a third fold ever
 * needs this, it mounts this file.
 *
 * ── ⚠ WHAT IT MUST NOT BECOME ──────────────────────────────────────────────────────────
 *
 * The fix is **legibility, not loudness**. The Aether direction is *"the chrome stays out of
 * the way until it has something to say"*, so this is a quiet raised surface with a 1px
 * border — enough to read as pressable, not enough to compete with the answer above it. A
 * full-width button bar would over-correct and trade one readability problem for another.
 *
 * ⚠ **THE COUNT STAYS VISIBLE WHILE CLOSED.** `References · 2 sources` says how many there
 * are without being opened; a fold that hid the number would be a worse bug than the one
 * being fixed. `count` is therefore rendered by the trigger itself, not by the panel.
 */
export interface FoldTriggerProps {
  /** Whether the section it controls is currently open — drives the chevron and aria. */
  open: boolean
  /** The label, e.g. `References` or `Thinking`. */
  label: string
  /**
   * Optional count rendered as a quiet mono chip beside the label. Present on References
   * (`2`), absent on the Thinking fold — reasoning has no countable unit, and inventing one
   * would be the kind of fabricated precision the ConfidenceChip rules already forbid.
   */
  count?: number
  /** Extra classes for the rare caller that needs spacing; never for restyling the control. */
  className?: string
}

export function FoldTrigger({ open, label, count, className }: FoldTriggerProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-border",
        "bg-muted/50 px-2.5 py-1 text-xs font-medium text-muted-foreground",
        "transition-colors hover:border-primary/50 hover:bg-primary/10 hover:text-foreground",
        className,
      )}
    >
      {open ? (
        <ChevronDown className="h-3 w-3 flex-none opacity-70" aria-hidden="true" />
      ) : (
        <ChevronRight className="h-3 w-3 flex-none opacity-70" aria-hidden="true" />
      )}
      <span>{label}</span>
      {count != null && (
        <span className="font-mono text-[11px] tabular-nums text-foreground/80">{count}</span>
      )}
    </span>
  )
}

export default FoldTrigger
