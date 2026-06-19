import { useCallback, useEffect, useRef, useState } from "react"
import { Filter, MoreHorizontal, Pencil, SlidersHorizontal, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { NavRow } from "./NavRow"
import { deleteView, resolveView } from "@/lib/api"
import type { SavedView } from "@/types"

/**
 * ViewsGroup — the saved-"Views" sidebar group (Phase 114, sketch 031-A /
 * D-114-7/8/9). Rendered BELOW the Folders group, mirroring the FolderTree
 * group-header + node-list shape. Each view row builds from the SHARED `NavRow`
 * (Plan 04) — never a clone of the flawed FolderNode — passing a FUNNEL icon (vs
 * the amber folder), a per-view document count badge, the tooltip-labeled `G`
 * pill on seeded globals, and Edit / Rename / Delete actions (no "New subfolder").
 *
 * The honest Views-vs-Folders differentiator is the funnel icon + count badge +
 * the ABSENCE of a New-subfolder action (D-114-7) — NOT drop rejection. Saved
 * views are "saved filters," never "queries."
 *
 * Per-view counts are fetched LAZILY + CACHED (D-114-8): the count-only resolve
 * (`resolveView(id, {count_only:true})`) runs on first sight of a row and is
 * cached; it refreshes when a view is (re)selected. Counts are NOT fetched
 * eagerly for every view at scale (SC#3 — the sidebar must not degrade at ~10k
 * docs × N views). `listViews()` (the data source, owned by the page) is already
 * leak-safe from Phase 113.
 */

export interface ViewsGroupProps {
  /** The caller's own + global saved views (from `listViews()`, owned by the page). */
  views: SavedView[]
  /** The currently selected view id (mutually exclusive with a folder selection). */
  selectedViewId: string | null
  /** Click a view → load its `filter_expr` back into the FilterBar (D-114-1). */
  onSelectView: (view: SavedView) => void
  /** Edit → reopen the filter bar pre-filled for an in-place PATCH (D-114-3/9). */
  onEditView: (view: SavedView) => void
  /** Rename committed inline (Enter saves / Esc cancels). PATCHes the view name. */
  onRenameView: (id: string, name: string) => Promise<void> | void
  /** Fired after a view is deleted so the page can drop it from the list. */
  onDeleted: (id: string) => void
}

export function ViewsGroup({
  views,
  selectedViewId,
  onSelectView,
  onEditView,
  onRenameView,
  onDeleted,
}: ViewsGroupProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // ── Lazy + cached per-view counts (D-114-8 / SC#3) ──────────────────────────
  // The cache survives re-renders; a view's count is fetched once on first sight
  // (and refreshed on (re)selection), never eagerly for every view at mount.
  const [counts, setCounts] = useState<Record<string, number>>({})
  const inFlight = useRef<Set<string>>(new Set())

  const fetchCount = useCallback((id: string, { force = false }: { force?: boolean } = {}) => {
    if (inFlight.current.has(id)) return
    if (!force && counts[id] !== undefined) return
    inFlight.current.add(id)
    resolveView(id, { count_only: true })
      .then(({ total }) => setCounts((prev) => ({ ...prev, [id]: total })))
      .catch(() => {
        /* leave the count absent; NavRow renders gracefully without it */
      })
      .finally(() => {
        inFlight.current.delete(id)
      })
  }, [counts])

  // First-sight lazy fetch: when the set of views changes, fetch any count we do
  // not yet have. This runs per-view (not a single eager all-counts sweep) and
  // skips already-cached ids — so adding one view fetches exactly one count.
  useEffect(() => {
    for (const v of views) {
      if (counts[v.id] === undefined) fetchCount(v.id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [views])

  const handleSelect = (view: SavedView) => {
    onSelectView(view)
    // Refresh the count on open (D-114-8) — the resolved set may have changed.
    fetchCount(view.id, { force: true })
  }

  const handleCommitRename = async (id: string, newName: string) => {
    const name = newName.trim()
    setEditingId(null)
    if (!name) return
    try {
      await onRenameView(id, name)
    } catch (err) {
      console.error("Could not rename view:", err)
    }
  }

  const handleConfirmDelete = async (id: string) => {
    setDeletingId(null)
    try {
      await deleteView(id)
      onDeleted(id)
    } catch (err) {
      console.error("Could not delete view:", err)
    }
  }

  return (
    <div className="flex flex-col">
      {/* Group header — mirrors the Folders header style (uppercase, tracked). */}
      <div className="flex items-center justify-between px-2 mb-2">
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">
          Views
        </span>
        <SlidersHorizontal
          className="h-3.5 w-3.5 text-muted-foreground/50"
          aria-hidden="true"
        />
      </div>

      {/* Empty state — "saved filters," never "query." */}
      {views.length === 0 ? (
        <div className="text-center py-6 px-2">
          <p className="text-sm font-medium">No saved views yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            filter documents and Save as view.
          </p>
        </div>
      ) : (
        views.map((view) => {
          const isEditing = editingId === view.id
          const isDeleting = deletingId === view.id
          return (
            <div key={view.id}>
              {/* Each view row builds from the SHARED NavRow with a funnel icon —
                  a saved filter, NOT a droppable folder (D-114-7). */}
              <NavRow
                icon={Filter}
                iconClassName="text-primary"
                name={view.name}
                count={counts[view.id]}
                isSelected={selectedViewId === view.id}
                isGlobal={view.is_global}
                onSelect={() => handleSelect(view)}
                isEditing={isEditing}
                onCommitRename={(newName) => handleCommitRename(view.id, newName)}
                onCancelRename={() => setEditingId(null)}
                actions={
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        aria-label={`Actions for ${view.name}`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreHorizontal className="h-3 w-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    {/* Edit / Rename / Delete — NO "New subfolder" (the honest
                        differentiator: a view is a saved filter, D-114-9). */}
                    <DropdownMenuContent align="end" className="w-40">
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation()
                          onEditView(view)
                        }}
                      >
                        <SlidersHorizontal className="h-3.5 w-3.5 mr-2" />
                        Edit filter
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation()
                          setEditingId(view.id)
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5 mr-2" />
                        Rename
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation()
                          setDeletingId(view.id)
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                }
              />

              {/* Inline delete confirmation (mirrors FolderNode's idiom). */}
              {isDeleting && (
                <div className="ml-8 py-2 px-2 text-xs text-muted-foreground flex items-center gap-2 flex-wrap bg-destructive/5 rounded-md mt-1">
                  <span>
                    Delete the view <strong>{view.name}</strong>? Your documents are
                    not affected — only this saved filter is removed.
                  </span>
                  <div className="flex gap-1.5 mt-1 w-full">
                    <Button
                      variant="destructive"
                      size="sm"
                      className="h-6 text-xs px-2.5"
                      onClick={() => handleConfirmDelete(view.id)}
                    >
                      Delete
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs px-2.5"
                      onClick={() => setDeletingId(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )
        })
      )}
    </div>
  )
}
