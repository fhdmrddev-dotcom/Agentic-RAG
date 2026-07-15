import { useEffect, useRef, useState, type ComponentType, type ReactNode } from "react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

/**
 * NavRow — the single shared sidebar-row primitive (Phase 114, D-114-13 / sketch 033-A).
 *
 * Extracted ONCE from the old `FolderNode` row body so that BOTH the Folders tree
 * and the Views group (Plan 06) build from the SAME row — never a clone of the
 * flawed original. It is a PURE presentational row: it holds NO recursion and NO
 * folder/view business logic (CRUD, selection wiring, delete-confirm, subfolder
 * create all live in the caller).
 *
 * The verified folder-tree debt is fixed HERE, while extracting:
 *  - a count slot renders on EVERY row (today only Root showed one) — D-114-8/13;
 *  - the bare uppercase `G` pill is wrapped in a tooltip ("Global — shared with
 *    everyone") so it is no longer opaque;
 *  - the action menu is keyboard/touch-reachable — faintly visible at rest
 *    (opacity-25) and fully revealed on hover OR focus-within, never `opacity-0`
 *    hover-only (which was invisible on touch);
 *  - a SINGLE soft indent guide replaces the dense hand-drawn branch lines, and
 *    indent is capped at ~3 levels (deeper nesting leans on FolderBreadcrumb).
 */

/** Indent cap — beyond this depth the row stops indenting (FolderBreadcrumb carries
 *  deep location). One indent step ≈ 16px; the soft guide sits one level in. */
export const NAVROW_INDENT_CAP = 3
const INDENT_STEP_PX = 16

export interface NavRowProps {
  /** lucide icon component for the leading icon slot. Folders pass an amber folder;
   *  Views pass a funnel. */
  icon: ComponentType<{ className?: string }>
  /** Override for the icon color class. Defaults to amber (folder container). */
  iconClassName?: string
  /** Row label. When `isEditing` is true an inline-rename input replaces it. */
  name: string
  /** Per-row document/match count. Rendered on EVERY row (D-114-8/13). Pass
   *  `undefined` to omit (e.g. a row that has no meaningful count yet). */
  count?: number
  /** Selected/active styling (bg-primary/10 vs hover:bg-accent/60). */
  isSelected?: boolean
  /** Shows the tooltip-labeled global "G" pill. */
  isGlobal?: boolean
  /** Nesting depth (0 = top level). Drives the single soft indent guide + the
   *  ~3-level indent cap. */
  depth?: number
  /** Leading slot before the icon (e.g. the expand chevron for folders). */
  leading?: ReactNode
  /** Row action menu (a DropdownMenu trigger + extra buttons). Rendered inside a
   *  reachable wrapper (faint at rest, revealed on hover/focus-within). */
  actions?: ReactNode
  /** Click handler for selecting the row. Ignored while editing. */
  onSelect?: () => void

  /* ---- inline rename (the FolderNode idiom: Enter saves, Esc cancels, blur commits) ---- */
  isEditing?: boolean
  onCommitRename?: (newName: string) => void
  onCancelRename?: () => void
}

export function NavRow({
  icon: Icon,
  iconClassName,
  name,
  count,
  isSelected = false,
  isGlobal = false,
  depth = 0,
  leading,
  actions,
  onSelect,
  isEditing = false,
  onCommitRename,
  onCancelRename,
}: NavRowProps) {
  const [editValue, setEditValue] = useState(name)
  // WR-07: an empty-name commit must NOT silently vanish. On Enter with a blank name
  // we keep the editor OPEN and show a validation hint; on blur with a blank name we
  // treat it as an INTENTIONAL cancel (revert visibly to the old name) rather than a
  // silent no-op. This makes "rename to blank" deliberate, not incidental.
  const [hint, setHint] = useState<string | null>(null)
  const editInputRef = useRef<HTMLInputElement>(null)

  // Re-seed the edit value (and clear any stale hint) whenever an edit session opens.
  // Phase 155 (A11Y-01): focus the rename input via ref (managed focus) instead of
  // the declarative `autoFocus` prop (jsx-a11y/no-autofocus) — same behavior.
  useEffect(() => {
    if (isEditing) {
      setEditValue(name)
      setHint(null)
      editInputRef.current?.focus()
    }
  }, [isEditing, name])

  // Single soft indent guide + ~3-level cap (replaces the dense hand-drawn branch
  // lines). Indent grows with depth up to the cap, then holds steady.
  const cappedDepth = Math.min(depth, NAVROW_INDENT_CAP)
  const padLeft = cappedDepth * INDENT_STEP_PX + 4

  return (
    <div className="relative" style={{ paddingLeft: `${padLeft}px` }}>
      {/* ONE soft indent guide — only when nested, a single 1px border-left. */}
      {cappedDepth > 0 && (
        <div
          className="absolute top-0 bottom-0 border-l border-border/30"
          style={{ left: `${(cappedDepth - 1) * INDENT_STEP_PX + 16}px` }}
          aria-hidden="true"
        />
      )}

      <div
        // Phase 155 (A11Y-01): the row is a keyboard-operable button-role select
        // target. It hosts nested controls (the actions menu, inline-rename input),
        // so it cannot be a native <button> (nested interactives are invalid); the
        // rule's sanctioned fallback — role + tab + keyboard support — is used. The
        // Enter/Space handler is guarded to the row itself so a nested control's key
        // press never double-fires select. (Restructuring this shared row primitive
        // into fully-separated select/action regions is logged to SEED-092-remainder.)
        role="button"
        tabIndex={isEditing ? -1 : 0}
        aria-label={name}
        className={cn(
          "flex items-center gap-2 py-1.5 px-2 rounded-lg cursor-pointer group relative transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
          isSelected
            ? "bg-primary/10 text-primary font-medium shadow-sm shadow-primary/5"
            : "hover:bg-accent/60",
        )}
        onClick={() => {
          if (!isEditing) onSelect?.()
        }}
        onKeyDown={(e) => {
          if (isEditing || e.target !== e.currentTarget) return
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            onSelect?.()
          }
        }}
      >
        {/* Leading slot (chevron for folders, spacer for flat rows) */}
        {leading ?? <div className="h-4 w-4 shrink-0" />}

        {/* Icon slot — amber folder / funnel view, primary when selected */}
        <Icon
          className={cn(
            "h-4 w-4 shrink-0 transition-colors",
            isSelected ? "text-primary" : iconClassName ?? "text-amber-500/70",
          )}
        />

        {/* Name or inline-rename input */}
        {isEditing ? (
          <div className="flex-1 min-w-0" role="presentation" onClick={(e) => e.stopPropagation()}>
            <input
              ref={editInputRef}
              value={editValue}
              aria-invalid={hint ? "true" : undefined}
              onChange={(e) => {
                setEditValue(e.target.value)
                if (hint) setHint(null) // clear the hint as soon as the user types
              }}
              onBlur={() => {
                // WR-07: blur with a blank name is an INTENTIONAL cancel (revert to the
                // old name), never a silent rename-to-empty. A non-empty name commits.
                if (editValue.trim()) onCommitRename?.(editValue.trim())
                else onCancelRename?.()
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  // WR-07: Enter on a blank name keeps the editor OPEN with a hint
                  // instead of committing an empty (silently-reverting) name.
                  if (!editValue.trim()) {
                    setHint("Name can't be empty")
                    return
                  }
                  onCommitRename?.(editValue.trim())
                }
                if (e.key === "Escape") {
                  e.preventDefault()
                  onCancelRename?.()
                }
              }}
              className={cn(
                "w-full min-w-0 px-1.5 py-0.5 text-sm bg-background border rounded-md outline-none focus:ring-1",
                hint
                  ? "border-destructive/60 focus:ring-destructive/40"
                  : "border-primary/30 focus:ring-primary/40",
              )}
            />
            {hint && (
              <span className="block mt-0.5 text-[11px] text-destructive">{hint}</span>
            )}
          </div>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-sm truncate flex-1 min-w-0">{name}</span>
            </TooltipTrigger>
            <TooltipContent side="right" className="max-w-[200px]">
              <p className="break-words">{name}</p>
            </TooltipContent>
          </Tooltip>
        )}

        {/* Global "G" pill — tooltip-labeled (no longer an opaque single letter) */}
        {isGlobal && !isEditing && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="shrink-0 text-[9px] font-medium uppercase tracking-wider text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full cursor-help">
                G
              </span>
            </TooltipTrigger>
            <TooltipContent>Global — shared with everyone</TooltipContent>
          </Tooltip>
        )}

        {/* Count slot — rendered on EVERY row (D-114-8/13). */}
        {count !== undefined && !isEditing && (
          <span className="shrink-0 text-xs text-muted-foreground ml-auto tabular-nums">
            {count}
          </span>
        )}

        {/* Reachable action menu: faint at rest, revealed on hover OR focus-within.
            Never opacity-0 hover-only (which was touch-invisible). */}
        {actions && !isEditing && (
          <div
            className={cn(
              "flex items-center gap-0 shrink-0 transition-opacity duration-150",
              "opacity-25 group-hover:opacity-100 focus-within:opacity-100",
              count === undefined && "ml-auto",
            )}
          >
            {actions}
          </div>
        )}
      </div>
    </div>
  )
}
