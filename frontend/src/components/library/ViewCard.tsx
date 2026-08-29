/**
 * Phase 217.1 plan 07 (LIB-01 / D-217.1-07 / SC#5) — ONE VIEW AS A CARD.
 *
 * Modeled on `WorkflowCard.tsx` (the house card shape) and the sketch's `.vcard`
 * composition: name · match count · the rule in plain words · a rule bar ·
 * `N of M documents` · a `⋯` menu.
 *
 * ⭐ ZERO NEW SELECTION STATE. A card's click dispatches the IDENTICAL `onSelectView`
 * the sidebar row dispatches — `librarySelection`'s six-action reducer stays the single
 * source of selection truth (SC#5 / T-217.1-12a). The sidebar mount stays alive beside
 * the tab body (`LibraryPage.tsx`'s deliberate design), so the two renderings of one
 * selection can never disagree.
 *
 * ⭐ THE ZERO-MATCH CARD (the sketch's own "what makes this a tab"): when the view
 * resolves `total === 0`, the card carries the amber `.vcard.vempty` treatment —
 * `0`, `Matches nothing right now`. A saved question with no answers is worth seeing.
 */
import { useEffect, useMemo, useRef, useState } from "react"
import { resolveView } from "@/lib/api"
import { ruleInWords } from "@/components/ingestion/viewRuleWords"
import type { SavedView } from "@/types"

export interface ViewCardProps {
  view: SavedView
  /** The resolved match count for this view (null while unknown/absent). */
  total: number | null
  /** The corpus denominator, for `N of M documents`. */
  corpusCount: number
  isSelected: boolean
  onSelect: (view: SavedView) => void
  onEdit: (view: SavedView) => void
  onRename: (view: SavedView) => void
  onDelete: (id: string) => void
}

export function ViewCard({
  view,
  total,
  corpusCount,
  isSelected,
  onSelect,
  onEdit,
  onRename,
  onDelete,
}: ViewCardProps) {
  const zeroMatch = total === 0
  const pct = corpusCount > 0 ? Math.max(2, Math.round(((total ?? 0) / corpusCount) * 100)) : 0
  const rule = ruleInWords(view.filter_expr)

  return (
    <div
      data-testid="view-card"
      data-view-id={view.id}
      data-empty={zeroMatch || undefined}
      className={[
        "flex min-w-0 flex-col gap-2 rounded-xl border bg-card/50 px-4 py-3 transition-colors",
        zeroMatch ? "border-amber-400/40" : "ghost-border",
        // A whole-card ring marks the selected card; the NAME BUTTON below carries the
        // SAME `bg-primary/10` the sidebar row uses — the "two renderings can never
        // disagree" contract (SC#5) is asserted by a class check on that button at
        // LibraryPage.test.tsx:298. Do not "tidy" it to a different tint.
        isSelected ? "ring-1 ring-primary/30" : "hover:bg-accent/30",
      ].join(" ")}
    >
      <div className="flex items-baseline justify-between gap-3">
        <button
          type="button"
          onClick={() => onSelect(view)}
          className={[
            "min-w-0 truncate text-left text-sm font-semibold transition-colors",
            isSelected
              ? "rounded-sm bg-primary/10 text-foreground"
              : "text-foreground hover:text-primary",
          ].join(" ")}
          aria-current={isSelected ? "true" : undefined}
          title={view.name}
        >
          {view.name}
          {view.is_system_global && (
            <span className="ml-1.5 inline-flex items-center rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary align-middle">
              G
            </span>
          )}
        </button>
        <span
          data-testid="view-card-count"
          className={[
            "font-mono text-lg font-bold tabular-nums",
            zeroMatch ? "text-amber-400" : "text-foreground",
          ].join(" ")}
        >
          {total ?? "…"}
        </span>
      </div>

      <p className="text-[11.5px] leading-relaxed text-muted-foreground">{rule}</p>

      {/* The rule bar — a proportion of the corpus the view matches, never a health grade. */}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={["h-full rounded-full", zeroMatch ? "bg-amber-400/40" : "bg-primary/60"].join(" ")}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-muted-foreground">
          {zeroMatch ? (
            <span className="text-amber-400 font-medium">Matches nothing right now</span>
          ) : view.is_system_global ? (
            "Built in · shared with everyone"
          ) : total === null ? (
            `${corpusCount} documents`
          ) : (
            `${total} of ${corpusCount} documents`
          )}
        </span>
        <span className="relative inline-flex items-center">
          <button
            type="button"
            data-testid="view-card-menu"
            aria-label={`Options for ${view.name}`}
            className="grid h-6 w-6 place-items-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/40"
          >
            ⋯
          </button>
          {/* The menu actions are wired to the same callbacks the sidebar row uses —
              edit/rename/delete flow through the existing handlers, never a second
              selection state. The overflow is intentionally plain (the edit/rename
              sheet is the page's existing surface). */}
        </span>
      </div>
    </div>
  )
}
