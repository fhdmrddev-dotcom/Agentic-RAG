import { Fragment, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { ChevronDown, ChevronRight, Trash2, Loader2, RefreshCw, FolderInput, Check, X } from "lucide-react"
import { DocumentStatusBadge } from "./DocumentStatusBadge"
import {
  fetchDocumentVersions,
  restoreDocumentVersion,
  reingestDocument,
  acceptClassification,
  dismissClassification,
} from "@/lib/api"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { getFileIcon } from "@/lib/fileIcons"
import { cn } from "@/lib/utils"
import { MoveToFolderDialog } from "@/components/health/MoveToFolderDialog"
// Phase 217.1-02 (D-217.1-21) — `formatBytes` extracted to one shared leaf so the Documents
// table and the Ingestion tab's Needs-attention row can never disagree about what `1 MB` is.
import { formatBytes } from "@/lib/formatBytes"
import type { Document } from "@/types"

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
}

// Phase 112 Plan 04 (D-01): the inline `MetadataPanel` was RETIRED here — metadata
// now lives in the one honest surface (DocumentDetailPanel, opened by a row click).
// Version-history inline-expand stays (VersionHistoryPanel below).

function VersionHistoryPanel({
  documentId,
  onRestored,
  currentUserId,
}: {
  documentId: string
  onRestored: () => void
  currentUserId: string
}) {
  const [versions, setVersions] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [restoreTarget, setRestoreTarget] = useState<Document | null>(null)
  const [restoring, setRestoring] = useState(false)
  const [restoreError, setRestoreError] = useState<string | null>(null)

  useEffect(() => {
    fetchDocumentVersions(documentId)
      .then(setVersions)
      .catch(() => setFetchError("Could not load version history."))
      .finally(() => setLoading(false))
  }, [documentId])

  const handleRestore = async () => {
    if (!restoreTarget) return
    setRestoring(true)
    setRestoreError(null)
    try {
      await restoreDocumentVersion(restoreTarget.id)
      setRestoreTarget(null)
      setRestoreError(null)
      onRestored()
    } catch {
      setRestoreError("Restore failed. Please try again.")
      // Do NOT close dialog — let user retry or cancel
    } finally {
      setRestoring(false)
    }
  }

  if (loading) {
    return (
      <div className="px-4 py-3 bg-muted/30 border-t flex justify-center">
        <span className="h-3 w-3 animate-spin rounded-full border border-current border-t-transparent text-muted-foreground" />
      </div>
    )
  }

  if (fetchError) {
    return (
      <div className="px-4 py-3 bg-muted/30 border-t text-xs text-destructive">
        {fetchError}
      </div>
    )
  }

  if (versions.length === 0) {
    return (
      <div className="px-4 py-3 bg-muted/30 border-t text-xs text-muted-foreground">
        No version history available.
      </div>
    )
  }

  return (
    <>
      <div className="bg-muted/30 border-t p-3">
        <table className="w-full text-sm" aria-label="Version history">
          <thead>
            <tr>
              <th className="text-left font-semibold px-2 py-1">Version</th>
              <th className="text-left font-semibold px-2 py-1">Uploaded</th>
              <th className="text-left font-semibold px-2 py-1">Size</th>
              <th className="text-right font-semibold px-2 py-1">Actions</th>
            </tr>
          </thead>
          <tbody>
            {versions.map((v) => (
              <tr key={v.id} className="border-t border-border/50">
                <td className="px-2 py-1.5 text-sm font-semibold">v{v.version_number ?? 1}</td>
                <td className="px-2 py-1.5 text-sm text-muted-foreground">
                  {new Date(v.created_at).toLocaleDateString()}
                </td>
                <td className="px-2 py-1.5 text-sm text-muted-foreground">
                  {formatBytes(v.file_size)}
                </td>
                <td className="px-2 py-1.5 text-right">
                  {v.is_latest ? (
                    <span className="text-xs text-muted-foreground">Current</span>
                  ) : v.user_id === currentUserId ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setRestoreTarget(v)}
                      className="h-6 text-xs"
                    >
                      Restore
                    </Button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Restore confirmation dialog */}
      <Dialog open={restoreTarget !== null} onOpenChange={(open) => { if (!open) { setRestoreTarget(null); setRestoreError(null) } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Restore version?</DialogTitle>
            <DialogDescription>
              Restore v{restoreTarget?.version_number ?? 1}? This version will become active for retrieval. The current version remains in history.
            </DialogDescription>
          </DialogHeader>
          {restoreError && (
            <p className="text-sm text-destructive px-1">{restoreError}</p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRestoreTarget(null); setRestoreError(null) }} disabled={restoring}>
              Cancel
            </Button>
            <Button onClick={handleRestore} disabled={restoring}>
              {restoring ? (
                <>
                  <span className="h-3 w-3 animate-spin rounded-full border border-current border-t-transparent mr-2" />
                  Restoring...
                </>
              ) : (
                "Restore"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

/**
 * Phase 118 Plan 05 Task 2 — the compact one-glance classification chip (sketch 036-A:
 * `→ folder ✓ ✕`). Renders ONLY when the doc carries a "suggested" `_classification`
 * (reads the existing `doc.metadata` — zero new fetch). The full provenance card lives
 * in the DocumentDetailPanel's Classification section (Task 1); this is one-glance only.
 *
 * ✓ accepts (move + audit), ✕ dismisses — both re-fetch via onRefresh on a 200
 * (re-fetch-not-optimistic; the suggestion clears/flips server-side, the re-fetch
 * shows truth). a11y: ✓/✕ carry aria-label and are coarse-pointer always-on (the
 * .rel-x-touch utility — the action must be reachable on touch with no hover).
 */
function ClassificationRowChip({ doc, onRefresh }: { doc: Document; onRefresh: () => void }) {
  const sugg = doc.metadata?._classification
  const [busy, setBusy] = useState(false)
  if (!sugg || sugg.status !== "suggested") return null

  const folderName = sugg.suggested_folder_name ?? "(deleted folder)"

  async function run(fn: () => Promise<unknown>) {
    if (busy) return
    setBusy(true)
    try {
      await fn()
      // Re-fetch the authoritative list (re-fetch-not-optimistic) — the suggestion
      // clears/flips server-side; the re-fetch drops the chip.
      onRefresh()
    } catch {
      // Leave the chip in place — the user can retry. The panel section carries the
      // honest failure beat; the row chip stays quiet to avoid table-row churn.
    } finally {
      setBusy(false)
    }
  }

  return (
    <span
      className="inline-flex items-center gap-1"
      // The chip's controls are NOT the filename-open affordance — stop row clicks.
      // Phase 155 (A11Y-01): role="presentation" — this wrapper is a pure layout +
      // click-propagation guard, not itself an interactive control (its buttons are).
      role="presentation"
      onClick={(e) => e.stopPropagation()}
    >
      <span className="inline-flex items-center gap-1 rounded-full bg-[hsl(var(--warning)/0.15)] px-2 py-0.5 text-[11px] font-semibold text-[hsl(var(--warning))] whitespace-nowrap">
        <span aria-hidden="true" className="opacity-70">→</span>
        {folderName}
      </span>
      <button
        type="button"
        onClick={() => void run(() => acceptClassification(doc.id))}
        disabled={busy}
        aria-label={`Accept suggestion and move ${doc.filename} to ${folderName}`}
        className="rel-x-touch grid h-6 w-6 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-[hsl(var(--panel-status-done)/0.15)] hover:text-[hsl(var(--panel-status-done))] focus:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
      >
        <Check className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={() => void run(() => dismissClassification(doc.id))}
        disabled={busy}
        aria-label={`Dismiss classification suggestion for ${doc.filename}`}
        className="rel-x-touch grid h-6 w-6 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-[hsl(0_80%_60%/0.15)] hover:text-[hsl(0_80%_70%)] focus:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
      >
        <X className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </span>
  )
}

export function DocumentList({ documents, onDelete, onRefresh, folderId, currentUserId, onSelect, selectedDocId }: Props) {
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

  // Phase 112 Plan 04 (D-01): the chevron now toggles VERSION HISTORY ONLY —
  // metadata moved to the click-to-open DocumentDetailPanel (no longer drives expand).
  const hasVersions = (doc: Document) => (doc.version_number ?? 1) > 1
  const isExpandable = (doc: Document) => hasVersions(doc)

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
              <Fragment key={doc.id}>
                <tr
                  data-selected={selectedDocId === doc.id || undefined}
                  className={cn(
                    "border-b last:border-0 hover:bg-muted/20 transition-colors",
                    selectedDocId === doc.id && "bg-primary/5",
                  )}
                >
                  <td className="px-2 py-3">
                    {isExpandable(doc) && (
                      <button
                        onClick={() => toggle(doc.id)}
                        className="text-muted-foreground hover:text-foreground"
                        aria-label={expanded.has(doc.id) ? "Collapse version history" : "Expand version history"}
                      >
                        {expanded.has(doc.id)
                          ? <ChevronDown className="h-3.5 w-3.5" />
                          : <ChevronRight className="h-3.5 w-3.5" />}
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3 font-medium max-w-xs">
                    {/* Phase 112 (D-01): the filename cell opens the detail panel.
                        Distinct from the chevron (version-history toggle) per RESEARCH Q4. */}
                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                      <button
                        type="button"
                        onClick={() => onSelect?.(doc.id)}
                        // WR-02: this opens the detail panel — it is NOT a toggle
                        // (re-clicking does not un-select), so aria-pressed misleads
                        // screen readers into announcing togglable "pressed" state.
                        // aria-current marks the currently-open item instead (the
                        // codebase convention, cf. NavPanel's aria-current).
                        aria-current={selectedDocId === doc.id ? "true" : undefined}
                        className="flex items-center gap-1.5 flex-wrap text-left truncate hover:text-primary transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/40 rounded-sm"
                      >
                        {doc.filename}
                        {(doc.version_number ?? 1) > 1 && (
                          <span className="rounded-full bg-primary/10 text-primary px-2 py-0.5 text-xs">
                            v{doc.version_number}
                          </span>
                        )}
                        {(doc.table_count ?? 0) > 0 && (
                          <span className="rounded-full bg-primary/10 text-primary px-2 py-0.5 text-xs">
                            {doc.table_count} tables
                          </span>
                        )}
                        {(doc.image_count ?? 0) > 0 && (
                          <span className="rounded-full bg-primary/10 text-primary px-2 py-0.5 text-xs">
                            {doc.image_count} imgs
                          </span>
                        )}
                      </button>
                      {/* Phase 118 (CLASS-03): one-glance suggestion chip — only when a
                          "suggested" _classification is present on this doc. */}
                      <ClassificationRowChip doc={doc} onRefresh={onRefresh} />
                    </div>
                  </td>
                  <td className="px-4 py-3">{getFileIcon(doc.filename)}</td>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{formatBytes(doc.file_size)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{doc.chunk_count ?? "—"}</td>
                  <td className="px-4 py-3">
                    <DocumentStatusBadge status={doc.status} ingestionStep={doc.ingestion_step} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleReingest(doc.id)}
                            disabled={reingestingId === doc.id || doc.status === "pending" || doc.status === "processing"}
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-primary"
                            aria-label="Re-ingest document"
                          >
                            {reingestingId === doc.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                            ) : (
                              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Re-ingest document</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setMoveTarget(doc)}
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-primary"
                            aria-label="Move to folder"
                          >
                            <FolderInput className="h-3.5 w-3.5" aria-hidden="true" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Move to folder</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteTarget(doc)}
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                            aria-label="Delete document"
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Delete document</TooltipContent>
                      </Tooltip>
                    </div>
                  </td>
                </tr>
                {hasVersions(doc) && expanded.has(doc.id) && (
                  <tr>
                    <td colSpan={7} className="p-0">
                      <VersionHistoryPanel
                        documentId={doc.id}
                        onRestored={onRefresh}
                        currentUserId={currentUserId}
                      />
                    </td>
                  </tr>
                )}
              </Fragment>
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
