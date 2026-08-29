/**
 * Phase 217 (LIB-01 / D-217-13 / SC#5) — the Views tab body: the SAVED-VIEW PICKER.
 *
 * ── WHY THIS FILE EXISTS AT ALL ────────────────────────────────────────────────────────
 * The sketch's own README says a tab with no content of its own is "the cheapest mistake to
 * find here and the most expensive to find after it ships". A Views tab that renders an
 * empty state pointing at the sidebar is exactly that tab. So this body carries the picker.
 *
 * ⭐ IT MOUNTS THE SHIPPED `ViewsGroup`. It does NOT reimplement a second list of views —
 * two lists is precisely the disagreement SC#5 forbids, and the sidebar mount and this one
 * are handed the SAME `selectedViewId` (`activeViewId(lib)`) by `LibraryPage`. There is one
 * source of selection truth and two renderings of it; they cannot disagree because neither
 * of them owns anything.
 *
 * ⛔ NO EAGER COUNT PASS. `ViewsGroup` already resolves per-view counts LAZILY and caches
 * them (`resolveView(id, {count_only:true})`, D-114-8 / SC#3). Fanning out one request per
 * saved view at mount is T-217-36 and is the one thing this tab must not add.
 *
 * ⛔ NO STATE. This component owns nothing — no `useState`, no `useReducer`. Every value it
 * renders arrives as a prop from the page's reducer.
 */
import { ViewsGroup } from "@/components/ingestion/ViewsGroup"
import type { SavedView } from "@/types"

export interface ViewsTabProps {
  /** The caller's own + global saved views — the SAME array the sidebar mount receives. */
  views: SavedView[]
  /** `activeViewId(lib)` — the SAME value the sidebar mount receives. */
  selectedViewId: string | null
  onSelectView: (view: SavedView) => void
  onEditView: (view: SavedView) => void
  onRenameView: (id: string, name: string) => Promise<void> | void
  onDeleted: (id: string) => void
}

export function ViewsTab({
  views,
  selectedViewId,
  onSelectView,
  onEditView,
  onRenameView,
  onDeleted,
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

      {/* The picker itself — the shipped group, composed. Its per-view count badge is the
          content this tab exists to carry, and it is fetched lazily by that component. */}
      <div className="rounded-xl bg-card/50 ghost-border p-3">
        <ViewsGroup
          views={views}
          selectedViewId={selectedViewId}
          onSelectView={onSelectView}
          onEditView={onEditView}
          onRenameView={onRenameView}
          onDeleted={onDeleted}
        />
      </div>
    </section>
  )
}
