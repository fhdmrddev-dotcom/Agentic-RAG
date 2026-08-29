import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { reingestDocument } from "@/lib/api"
import { cn } from "@/lib/utils"
import { MoveToFolderDialog } from "@/components/health/MoveToFolderDialog"
import { DocumentRow, hasVersions } from "./DocumentRow"
import type { Document, Folder } from "@/types"

interface Props {
  documents: Document[]
  onDelete: (id: string, scope?: "version" | "all") => void
  onRefresh: () => void
  folderId?: string | null
  currentUserId: string
  /** Phase 112 (D-01): open the document detail panel. Inline metadata expand is
   *  retired — the filename cell click opens the push/split panel instead. */
  onSelect?: (id: string) => void
  /** The currently open document (drives the selected-row affordance). */
  selectedDocId?: string | null
  /** Phase 217.1-05 — folders are held by `LibraryPage` (`useFolders`) and threaded
   *  down so the row's folder pill can resolve `doc.folder_id` to a name. No new fetch. */
  folders?: Folder[]
}

// Phase 112 Plan 04 (D-01): the inline `MetadataPanel` was RETIRED here — metadata
// now lives in the one honest surface (DocumentDetailPanel, opened by a row click).
// Version-history inline-expand stays (VersionHistoryPanel, inside DocumentRow).

/**
 * Phase 217.1 plan 05 (LIB-03) — the G-5 named seam, DISCHARGED. The per-row body lives
 * in `DocumentRow.tsx`; this component owns ONLY the `<table>`, the seven-column `<thead>`
 * ordering, and the CSS shed (`nth-child(3-5)`, applied by `LibraryPage` at ≤430px).
 *
 * ⛔ THE SHED INVARIANT: exactly seven `<th>`s in the order chevron / Filename / Type /
 * Size / Chunks / Status / Actions, with the `<th className="px-4 py-3 …">` class strings
 * byte-identical to the pre-extraction version. `drive.cjs` A1/A2 read these.
 */
export function DocumentList({
  documents,
  onDelete,
  onRefresh,
  folderId,
  currentUserId,
  onSelect,
  selectedDocId,
  folders,
}: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [deleteTarget, setDeleteTarget] = useState<Document | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [activeScope, setActiveScope] = useState<"version" | "all" | null>(null)
  const [reingestingId, setReingestingId] = useState<string | null>(null)
  // Phase 114 (D-114-14): the Move-to-folder document-row action. A single dialog
  // keyed to the active row's document — reuses the existing MoveToFolderDialog +
  // PATCH /documents/{id}/move (zero net-new backend). No drag-drop is built.
  const [moveTarget, setMoveTarget] = useState<Document | null>(null)

  // BUG-260516-03: surface the reingest action that previously only existed
  // on the Library Health page. Same /documents/{id}/reingest endpoint
  // /reextract+chunks behind the scenes (BUG-260516-04 fixed the underlying
  // accumulation issue, so this is safe to expose).
  async function handleReingest(id: string) {
    setReingestingId(id)
    try {
      await reingestDocument(id)
      // No need to manually refresh — the Realtime UPDATE on status change
      // will trigger a refetch via useDocuments.ts (loadDocuments on terminal
      // state transition). The button just kicks the backend.
    } catch (e) {
      console.error("Reingest failed:", e)
    } finally {
      setReingestingId(null)
    }
  }

  // Filter by selected folder:
  // - folderId === undefined: no folder context — show all (backward compat)
  // - folderId === null: Root — show root-level documents (folder_id === null)
  // - folderId = string: show only documents in that folder
  const filtered =
    folderId === undefined
      ? documents
      : folderId === null
        ? documents.filter((d) => d.folder_id == null)  // == catches null AND undefined (pre-migration docs)
        : documents.filter((d) => d.folder_id === folderId)

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const handleDelete = async (scope?: "version" | "all") => {
    if (!deleteTarget) return
    setDeleting(true)
    setActiveScope(scope ?? null)
    setDeleteError(null)
    try {
      await onDelete(deleteTarget.id, scope)
      setDeleteTarget(null)
      setDeleteError(null)
    } catch {
      setDeleteError("Delete failed. Please try again.")
      // Do NOT close dialog — let user retry or cancel
    } finally {
      setDeleting(false)
      setActiveScope(null)
    }
  }

  if (filtered.length === 0) {
    return (
      <div>
        <p className="text-sm text-muted-foreground text-center py-8">
          {folderId == null
            ? "No root documents yet."
            : "No documents in this folder"}
        </p>
        <p className="text-xs text-muted-foreground text-center">
          Upload files above to add them here.
        </p>
      </div>
    )
  }

  // The chunk proportion bar's denominator: the highest chunk_count over the loaded
  // documents. Computed ONCE here, passed down to every row.
  const maxChunkCount = filtered.reduce((m, d) => Math.max(m, d.chunk_count ?? 0), 0)

  return (
    <>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-2 py-3 w-8" />
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Filename</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Type</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Size</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Chunks</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((doc) => (
              <DocumentRow
                key={doc.id}
                doc={doc}
                folders={folders}
                maxChunkCount={maxChunkCount}
                isExpanded={expanded.has(doc.id)}
                onToggleExpand={toggle}
                onSelect={onSelect}
                selectedDocId={selectedDocId}
                reingesting={reingestingId === doc.id}
                onReingest={handleReingest}
                onMove={setMoveTarget}
                onDeleteRequest={setDeleteTarget}
                onRefresh={onRefresh}
                currentUserId={currentUserId}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Delete confirmation dialog */}
      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null)
            setDeleteError(null)
            setActiveScope(null)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete document?</DialogTitle>
            <DialogDescription>
              {deleteTarget && hasVersions(deleteTarget) ? (
                <>
                  This document has {deleteTarget.version_number} versions.{" "}
                  <span className="font-medium text-foreground">Delete v{deleteTarget.version_number}</span>{" "}
                  to promote v{(deleteTarget.version_number ?? 1) - 1} as current, or delete all versions permanently.
                </>
              ) : (
                <>
                  Permanently delete{" "}
                  <span className="font-medium text-foreground">{deleteTarget?.filename}</span>?{" "}
                  This action cannot be undone.
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {deleteError && (
            <p className="text-sm text-destructive px-1">{deleteError}</p>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteTarget(null)
                setDeleteError(null)
                setActiveScope(null)
              }}
              disabled={deleting}
            >
              Cancel
            </Button>

            {deleteTarget && hasVersions(deleteTarget) ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => handleDelete("version")}
                  disabled={deleting}
                >
                  {deleting && activeScope === "version" ? (
                    <>
                      <span className="h-3 w-3 animate-spin rounded-full border border-current border-t-transparent mr-2" />
                      Deleting...
                    </>
                  ) : (
                    `Delete v${deleteTarget.version_number}`
                  )}
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => handleDelete("all")}
                  disabled={deleting}
                >
                  {deleting && activeScope === "all" ? (
                    <>
                      <span className="h-3 w-3 animate-spin rounded-full border border-current border-t-transparent mr-2" />
                      Deleting...
                    </>
                  ) : (
                    "Delete All Versions"
                  )}
                </Button>
              </>
            ) : (
              <Button
                variant="destructive"
                onClick={() => handleDelete()}
                disabled={deleting}
              >
                {deleting ? (
                  <>
                    <span className="h-3 w-3 animate-spin rounded-full border border-current border-t-transparent mr-2" />
                    Deleting...
                  </>
                ) : (
                  "Delete"
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Phase 114 (D-114-14): Move-to-folder — reuses the existing dialog +
          PATCH /documents/{id}/move. onMoved refreshes the list so the moved doc
          drops out of the current folder view. */}
      {moveTarget && (
        <MoveToFolderDialog
          open={moveTarget !== null}
          documentId={moveTarget.id}
          documentName={moveTarget.filename}
          onClose={() => setMoveTarget(null)}
          onMoved={() => {
            setMoveTarget(null)
            onRefresh()
          }}
        />
      )}
    </>
  )
}
