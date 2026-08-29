/**
 * Phase 217.1 plan 07 (LIB-01 / D-217.1-07 / SC#5) — the Views tab body: the CARD GRID.
 *
 * ── WHY THIS FILE EXISTS AT ALL ────────────────────────────────────────────────────────
 * The sketch's own README said a Views tab that renders an empty state pointing at the
 * sidebar is "the cheapest mistake to find here and the most expensive to find after it
 * ships" — and then shipped exactly that prediction. Plan 07 replaces the sidebar-with-
 * more-clicks mount with the sketch's 2-column card grid.
 *
 * ⭐ IT DISPATCHES THE SAME SELECT_VIEW AS THE SIDEBAR. `ViewCardGrid` receives the
 * identical `views`/`selectedViewId`/six-callback prop surface `ViewsGroup` receives, and
 * a card's click dispatches the same `SELECT_VIEW` — `librarySelection`'s six-action
 * reducer stays the single source of selection truth (SC#5 / T-217.1-12a).
 *
 * ⭐ THE SIDEBAR MOUNT STAYS ALIVE BESIDE THIS BODY. `LibraryPage` deliberately mounts the
 * sidebar and the tab body at the same moment ("they can never disagree" is observable).
 * This tab body no longer duplicates the sidebar's list; the shared match-count cache
 * (`useViewCounts` in the grid) means one resolve serves both renderings.
 *
 * ⛔ NO STATE. This component owns nothing — no `useState`, no `useReducer`. Every value it
 * renders arrives as a prop from the page's reducer.
 */
import { ViewCardGrid } from "./ViewCardGrid"
import type { SavedView } from "@/types"

export interface ViewsTabProps {
  /** The caller's own + global saved views — the SAME array the sidebar mount receives. */
  views: SavedView[]
  /** `activeViewId(lib)` — the SAME value the sidebar mount receives. */
  selectedViewId: string | null
  onSelectView: (view: SavedView) => void
  onEditView: (view: SavedView) => void
  onRenameView: (view: SavedView) => void
  onDeleted: (id: string) => void
  /** The corpus denominator for "N of M documents". Optional — the fence mounts this
   *  component standalone without it; LibraryPage supplies `listDocuments.length`. */
  corpusCount?: number
  /** "New view" — opens the same filter-bar flow LibraryPage already drives. Optional
   *  for the same standalone-mount reason; a no-op default keeps the affordance honest. */
  onNewView?: () => void
}

export function ViewsTab({
  views,
  selectedViewId,
  onSelectView,
  onEditView,
  onRenameView,
  onDeleted,
  corpusCount = 0,
  onNewView,
}: ViewsTabProps) {
  return (
    <section data-testid="views-tab" className="flex flex-col gap-3">
      <div>
        <h2 className="text-lg font-semibold leading-tight">Saved views</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {views.length === 0
            ? "Filter the documents and save the filter to keep it here."
            : `${views.length} saved ${views.length === 1 ? "filter" : "filters"}. Pick one to see what it matches.`}
        </p>
      </div>

      {/* The card grid — the tab's own content (D-217.1-07). Its per-view match count is
          fetched lazily and shared with the sidebar's mount via one cache. */}
      <ViewCardGrid
        views={views}
        selectedViewId={selectedViewId}
        corpusCount={corpusCount}
        onSelectView={onSelectView}
        onEditView={onEditView}
        onRenameView={onRenameView}
        onDelete={onDeleted}
        onNewView={onNewView ?? (() => {})}
      />
    </section>
  )
}
