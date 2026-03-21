import { Fragment, useState } from "react"
import { Button } from "@/components/ui/button"
import { ChevronDown, ChevronRight, Trash2 } from "lucide-react"
import { DocumentStatusBadge } from "./DocumentStatusBadge"
import type { Document, DocumentMetadata } from "@/types"

interface Props {
  documents: Document[]
  onDelete: (id: string) => void
  folderId?: string | null
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

export function DocumentList({ documents, onDelete, folderId }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

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

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="px-2 py-3 w-8" />
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Filename</th>
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
                  {hasMetadata(doc) && (
                    <button
                      onClick={() => toggle(doc.id)}
                      className="text-muted-foreground hover:text-foreground"
                      aria-label={expanded.has(doc.id) ? "Collapse metadata" : "Expand metadata"}
                    >
                      {expanded.has(doc.id)
                        ? <ChevronDown className="h-3.5 w-3.5" />
                        : <ChevronRight className="h-3.5 w-3.5" />}
                    </button>
                  )}
                </td>
                <td className="px-4 py-3 font-medium max-w-xs truncate">{doc.filename}</td>
                <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{formatBytes(doc.file_size)}</td>
                <td className="px-4 py-3 text-muted-foreground">{doc.chunk_count ?? "—"}</td>
                <td className="px-4 py-3">
                  <DocumentStatusBadge status={doc.status} />
                </td>
                <td className="px-4 py-3 text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDelete(doc.id)}
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </td>
              </tr>
              {hasMetadata(doc) && expanded.has(doc.id) && (
                <tr>
                  <td colSpan={6} className="p-0">
                    <MetadataPanel metadata={doc.metadata!} />
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  )
}
