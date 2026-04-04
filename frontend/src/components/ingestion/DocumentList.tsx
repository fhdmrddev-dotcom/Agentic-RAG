import { Fragment, useState } from "react"
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

function getFileIcon(filename: string) {
  const ext = filename.split(".").pop()?.toLowerCase()
  const cls = "h-5 w-5"
  
  // Custom SVG Icons mimicking official branding
  switch (ext) {
    case "pdf":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M4 18V6C4 4.89543 4.89543 4 6 4H14L20 10V18C20 19.1046 19.1046 20 18 20H6C4.89543 20 4 19.1046 4 18Z" fill="#E12106"/>
          <path d="M14 4L20 10H14V4Z" fill="#B31D08"/>
          <text x="6" y="16" fill="white" fontSize="5" fontWeight="bold" fontFamily="sans-serif">PDF</text>
        </svg>
      )
    case "doc":
    case "docx":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M4 18V6C4 4.89543 4.89543 4 6 4H14L20 10V18C20 19.1046 19.1046 20 18 20H6C4.89543 20 4 19.1046 4 18Z" fill="#2B579A"/>
          <path d="M14 4L20 10H14V4Z" fill="#1E3E6E"/>
          <text x="7" y="16.5" fill="white" fontSize="8" fontWeight="bold" fontFamily="sans-serif">W</text>
        </svg>
      )
    case "pptx":
    case "ppt":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M4 18V6C4 4.89543 4.89543 4 6 4H14L20 10V18C20 19.1046 19.1046 20 18 20H6C4.89543 20 4 19.1046 4 18Z" fill="#D24726"/>
          <path d="M14 4L20 10H14V4Z" fill="#A4371D"/>
          <text x="7" y="16.5" fill="white" fontSize="8" fontWeight="bold" fontFamily="sans-serif">P</text>
        </svg>
      )
    case "xlsx":
    case "xls":
    case "csv":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M4 18V6C4 4.89543 4.89543 4 6 4H14L20 10V18C20 19.1046 19.1046 20 18 20H6C4.89543 20 4 19.1046 4 18Z" fill="#217346"/>
          <path d="M14 4L20 10H14V4Z" fill="#185333"/>
          <text x="7" y="16.5" fill="white" fontSize="8" fontWeight="bold" fontFamily="sans-serif">X</text>
        </svg>
      )
    case "txt":
    case "md":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M4 18V6C4 4.89543 4.89543 4 6 4H14L20 10V18C20 19.1046 19.1046 20 18 20H6C4.89543 20 4 19.1046 4 18Z" fill="#7B7B7B"/>
          <path d="M14 4L20 10H14V4Z" fill="#5F5F5F"/>
          <rect x="7" y="11" width="10" height="1" fill="white" opacity="0.5"/>
          <rect x="7" y="13" width="10" height="1" fill="white" opacity="0.5"/>
          <rect x="7" y="15" width="6" height="1" fill="white" opacity="0.5"/>
        </svg>
      )
    default:
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M4 18V6C4 4.89543 4.89543 4 6 4H14L20 10V18C20 19.1046 19.1046 20 18 20H6C4.89543 20 4 19.1046 4 18Z" fill="#9CA3AF"/>
          <path d="M14 4L20 10H14V4Z" fill="#6B7280"/>
        </svg>
      )
  }
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
  const [deleteTarget, setDeleteTarget] = useState<Document | null>(null)

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
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteTarget !== null} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete document?</DialogTitle>
            <DialogDescription>
              This will permanently delete{" "}
              <span className="font-medium text-foreground">{deleteTarget?.filename}</span>{" "}
              and all its chunks. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deleteTarget) {
                  onDelete(deleteTarget.id)
                  setDeleteTarget(null)
                }
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
