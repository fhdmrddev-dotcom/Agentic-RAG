/**
 * Phase 217.1 plan 05 (LIB-03) — the extracted row. DISCHARGES the 12-phase-fires G-5
 * named seam on `DocumentList.tsx`: *"the row IS the extraction."*
 *
 * ⭐ `DocumentList` keeps ONLY the `<table>`, the seven-column `<thead>` ordering, and the
 * CSS shed (`nth-child(3-5)` at 430px, applied by `LibraryPage`). This component owns every
 * per-row affordance:
 *
 *   1. folder tag pill under the filename (`Root` when `folder_id` is null — D-217.1-31,
 *      never `Uncategorized`),
 *   2. chunk count with a proportion bar (`ChunkProportionBar`),
 *   3. the expand chevron, still VERSION-GATED (`version_number > 1`, D-217.1-30 — a chevron
 *      that expands nothing is worse than no chevron),
 *   4. the inline six-stage `IngestionStrip` for in-flight rows (the SAME component the
 *      Ingestion tab mounts — one component, two places, never a fork),
 *   5. the failure sentence for failed rows (`classifyIngestionError`, the SAME mapper
 *      Wave 1 built, imported, not re-implemented).
 *
 * ⛔ THE SHED INVARIANT: this row renders EXACTLY seven `<td>`s in the same order
 * (chevron, Filename, Type, Size, Chunks, Status, Actions), no `colSpan` on the main row —
 * `LibraryPage`'s `nth-child(n+3):nth-child(-n+5)` shed hides Type/Size/Chunks by position.
 * The version-history expand row is a SEPARATE `<tr>` and is the only `colSpan` user.
 */
import { useEffect, useState } from "react"
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
import { IngestionStrip } from "./IngestionStrip"
import {
  fetchDocumentVersions,
  restoreDocumentVersion,
  acceptClassification,
  dismissClassification,
} from "@/lib/api"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { getFileIcon } from "@/lib/fileIcons"
import { cn } from "@/lib/utils"
import { formatBytes } from "@/lib/formatBytes"
import { classifyIngestionError } from "@/components/library/ingestionErrorVocabulary"
import { ChunkProportionBar } from "@/components/library/ChunkProportionBar"
import type { Document, Folder } from "@/types"

/** Phase 112 (D-01): the chevron toggles VERSION HISTORY ONLY. */
export function hasVersions(doc: Document): boolean {
  return (doc.version_number ?? 1) > 1
}

export function isExpandable(doc: Document): boolean {
  return hasVersions(doc)
}

export interface DocumentRowProps {
  doc: Document
  /** Held by `LibraryPage` (`useFolders`), threaded down — no new fetch. Optional so
   *  existing mounts that do not supply folders keep working (folder pill resolves what
   *  it can, `Root` for `folder_id: null`). */
  folders?: Folder[]
  /** Highest `chunk_count` over the currently loaded documents — computed once in
   *  `DocumentList`, passed down. Drives the proportion bar's fill. */
  maxChunkCount: number
  isExpanded: boolean
  onToggleExpand: (id: string) => void
  onSelect?: (id: string) => void
  selectedDocId?: string | null
  /** True while THIS row's re-ingest is in flight. */
  reingesting: boolean
  onReingest: (id: string) => void
  onMove: (doc: Document) => void
  onDeleteRequest: (doc: Document) => void
  onRefresh: () => void
  currentUserId: string
}

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

export function DocumentRow({
  doc,
  folders,
  maxChunkCount,
  isExpanded,
  onToggleExpand,
  onSelect,
  selectedDocId,
  reingesting,
  onReingest,
  onMove,
  onDeleteRequest,
  onRefresh,
  currentUserId,
}: DocumentRowProps) {
  // ── The folder tag pill (D-217.1-31): `Root` for `folder_id: null`, the resolved
  // folder name otherwise. A set-but-unresolvable id (folder deleted) renders no pill —
  // never a made-up name.
  const folderName =
    doc.folder_id == null
      ? "Root"
      : folders?.find((f) => f.id === doc.folder_id)?.name ?? null

  return (
    <>
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
              onClick={() => onToggleExpand(doc.id)}
              className="text-muted-foreground hover:text-foreground"
              aria-label={isExpanded ? "Collapse version history" : "Expand version history"}
            >
              {isExpanded
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
          {folderName && (
            <div className="mt-1">
              <span
                data-testid="folder-pill"
                className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground whitespace-nowrap"
              >
                {folderName}
              </span>
            </div>
          )}
        </td>
        <td className="px-4 py-3">{getFileIcon(doc.filename)}</td>
        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{formatBytes(doc.file_size)}</td>
        <td className="px-4 py-3 text-muted-foreground">
          <ChunkProportionBar value={doc.chunk_count ?? 0} max={maxChunkCount} />
        </td>
        <td className="px-4 py-3">
          {doc.status === "processing" ? (
            // The inline six-stage strip for an in-flight row — the SAME component the
            // Ingestion tab mounts. One component, two places, never a fork.
            <IngestionStrip document={doc} />
          ) : doc.status === "failed" ? (
            // The failure sentence — the SAME mapper Wave 1 built, imported, not re-implemented.
            <span data-testid="row-failure-sentence" className="text-xs text-destructive">
              {classifyIngestionError(doc.error_message)}
            </span>
          ) : (
            <DocumentStatusBadge status={doc.status} ingestionStep={doc.ingestion_step} />
          )}
        </td>
        <td className="px-4 py-3 text-right">
          <div className="flex items-center justify-end gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onReingest(doc.id)}
                  disabled={reingesting || doc.status === "pending" || doc.status === "processing"}
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-primary"
                  aria-label="Re-ingest document"
                >
                  {reingesting ? (
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
                  onClick={() => onMove(doc)}
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
                  onClick={() => onDeleteRequest(doc)}
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
      {hasVersions(doc) && isExpanded && (
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
    </>
  )
}
