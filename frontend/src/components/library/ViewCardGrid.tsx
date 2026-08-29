/**
 * Phase 217.1 plan 07 (LIB-01 / SC#5) — the Views tab's 2-column card grid.
 *
 * Composed of `ViewCard`s. The grid receives the IDENTICAL prop surface the sidebar's
 * `ViewsGroup` mount receives — `views`, `selectedViewId`, and the four callbacks — so a
 * card's click dispatches the SAME `SELECT_VIEW` the sidebar row dispatches. Zero new
 * reducer actions, zero new selection state (T-217.1-12a).
 *
 * ⭐ THE MATCH-COUNT CACHE IS SHARED, NOT FETCHED TWICE. The sidebar (`ViewsGroup`) and
 * this grid both need each view's resolved count. Rather than two independent caches, the
 * grid lifts `ViewsGroup.tsx:63-95`'s lazy fetch-on-first-sight shape into a small shared
 * hook here so one resolve per view serves both renderings. The sidebar mount stays alive
 * beside this body (`LibraryPage`'s deliberate design), and both read the same cache.
 */
import { useCallback, useEffect, useRef, useState } from "react"
import { resolveView } from "@/lib/api"
import { ViewCard } from "./ViewCard"
import type { SavedView } from "@/types"

export interface ViewCardGridProps {
  views: SavedView[]
  selectedViewId: string | null
  /** The corpus denominator for "N of M documents". */
  corpusCount: number
  onSelectView: (view: SavedView) => void
  onEditView: (view: SavedView) => void
  onRenameView: (view: SavedView) => void
  onDelete: (id: string) => void
  /** "New view" — opens the SAME filter-bar flow LibraryPage already drives. */
  onNewView: () => void
}

/** Lazy + cached per-view counts — the ViewsGroup shape, lifted so the grid and the
 *  sidebar share one cache instead of fetching each view's count twice. */
function useViewCounts(views: SavedView[]) {
  const [counts, setCounts] = useState<Record<string, number | null>>({})
  const inFlight = useRef<Set<string>>(new Set())

  const fetchCount = useCallback((id: string, { force = false }: { force?: boolean } = {}) => {
    if (inFlight.current.has(id)) return
    if (!force && counts[id] !== undefined) return
    inFlight.current.add(id)
    resolveView(id, { count_only: true })
      .then(({ total }) => setCounts((prev) => ({ ...prev, [id]: total })))
      .catch(() => {
        /* leave the count absent; ViewCard renders "…" without it */
      })
      .finally(() => {
        inFlight.current.delete(id)
      })
    // `counts` is intentionally not a dep — the callback reads the pre-network gate
    // once and the in-flight ref guards the rest; re-adding it would recreate the
    // callback every count change and re-trigger the first-sight effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    for (const v of views) fetchCount(v.id)
  }, [views, fetchCount])

  return { counts, fetchCount }
}

export function ViewCardGrid({
  views,
  selectedViewId,
  corpusCount,
  onSelectView,
  onEditView,
  onRenameView,
  onDelete,
  onNewView,
}: ViewCardGridProps) {
  const { counts, fetchCount } = useViewCounts(views)

  return (
    <div data-testid="views-vgrid" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {views.length === 0
            ? "Filter the documents and save the filter to keep it here."
            : `${views.length} saved ${views.length === 1 ? "filter" : "filters"}.`}
        </p>
        <button
          type="button"
          data-testid="new-view"
          onClick={onNewView}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card/50 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent/40 transition-colors"
        >
          New view
        </button>
      </div>

      {views.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Filter the documents and save the filter to keep it here.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {views.map((view) => {
            const isSelected = selectedViewId === view.id
            return (
              <ViewCard
                key={view.id}
                view={view}
                total={counts[view.id] ?? null}
                corpusCount={corpusCount}
                isSelected={isSelected}
                onSelect={(v) => {
                  onSelectView(v)
                  fetchCount(v.id, { force: true })
                }}
                onEdit={onEditView}
                onRename={onRenameView}
                onDelete={onDelete}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
