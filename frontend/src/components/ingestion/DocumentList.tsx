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
import { ChevronDown, ChevronRight, Trash2 } from "lucide-react"
import { DocumentStatusBadge } from "./DocumentStatusBadge"
import { fetchDocumentVersions, restoreDocumentVersion } from "@/lib/api"
import { getFileIcon } from "@/lib/fileIcons"
import type { Document, DocumentMetadata } from "@/types"

interface Props {
  documents: Document[]
  onDelete: (id: string, scope?: "version" | "all") => void
  onRefresh: () => void
  folderId?: string | null
  currentUserId: string
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function MetadataPanel({ metadata }: { metadata: DocumentMetadata }) {
  return (
    <div className="px-4 py-3 bg-muted/30 border-t text-xs space-y-1.5">
      {metadata.title && (
        <div>
          <span className="font-medium text-muted-foreground">Title: </span>
          {metadata.title}
        </div>
      )}
      {metadata.author && (
        <div>
          <span className="font-medium text-muted-foreground">Author: </span>
          {metadata.author}
        </div>
      )}
      {metadata.date && (
        <div>
          <span className="font-medium text-muted-foreground">Date: </span>
          {metadata.date}
        </div>
      )}
      {metadata.document_type && (
        <div>
          <span className="font-medium text-muted-foreground">Type: </span>
          {metadata.document_type}
        </div>
      )}
      {metadata.language && (
        <div>
          <span className="font-medium text-muted-foreground">Language: </span>
          {metadata.language}
        </div>
      )}
      {metadata.topics && metadata.topics.length > 0 && (
        <div className="flex flex-wrap gap-1 items-center">
          <span className="font-medium text-muted-foreground">Topics: </span>
          {metadata.topics.map((t) => (
            <span
              key={t}
              className="rounded-full bg-primary/10 text-primary px-2 py-0.5"
            >
              {t}
            </span>
          ))}
        </div>
      )}
      {metadata.summary && (
        <div>
          <span className="font-medium text-muted-foreground">Summary: </span>
          {metadata.summary}
        </div>
      )}
    </div>
  )
}

function VersionHistoryPanel({
  documentId,
  currentVersionNumber,
  onRestored,
  currentUserId,
}: {
  documentId: string
  currentVersionNumber: number
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

export function DocumentList({ documents, onDelete, onRefresh, folderId, currentUserId }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [deleteTarget, setDeleteTarget] = useState<Document | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [activeScope, setActiveScope] = useState<"version" | "all" | null>(null)

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
            ? "No documents uploaded yet."
            : "No documents in this folder"}
        </p>
        {folderId != null && (
          <p className="text-xs text-muted-foreground text-center">
            Upload files above to add them here.
          </p>
        )}
      </div>
    )
  }

  const hasMetadata = (doc: Document) =>
    doc.status === "completed" && doc.metadata != null

  const hasVersions = (doc: Document) => (doc.version_number ?? 1) > 1
  const isExpandable = (doc: Document) => hasMetadata(doc) || hasVersions(doc)

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
                  className="border-b last:border-0 hover:bg-muted/20 transition-colors"
                >
                  <td className="px-2 py-3">
                    {isExpandable(doc) && (
                      <button
                        onClick={() => toggle(doc.id)}
                        className="text-muted-foreground hover:text-foreground"
                        aria-label={expanded.has(doc.id) ? "Collapse details" : "Expand details"}
                      >
                        {expanded.has(doc.id)
                          ? <ChevronDown className="h-3.5 w-3.5" />
                          : <ChevronRight className="h-3.5 w-3.5" />}
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3 font-medium max-w-xs truncate">
                    <span className="flex items-center gap-1.5 flex-wrap">
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
                    </span>
                  </td>
                  <td className="px-4 py-3">{getFileIcon(doc.filename)}</td>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{formatBytes(doc.file_size)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{doc.chunk_count ?? "—"}</td>
                  <td className="px-4 py-3">
                    <DocumentStatusBadge status={doc.status} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteTarget(doc)}
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
                {hasMetadata(doc) && expanded.has(doc.id) && (
                  <tr>
                    <td colSpan={7} className="p-0">
                      <MetadataPanel metadata={doc.metadata!} />
                    </td>
                  </tr>
                )}
                {hasVersions(doc) && expanded.has(doc.id) && (
                  <tr>
                    <td colSpan={7} className="p-0">
                      <VersionHistoryPanel
                        documentId={doc.id}
                        currentVersionNumber={doc.version_number ?? 1}
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
    </>
  )
}
