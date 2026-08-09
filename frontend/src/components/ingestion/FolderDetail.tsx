import { Globe, FileText, FolderIcon, Calendar, HardDrive } from "lucide-react"
import type { Folder, Document } from "@/types"

interface FolderDetailProps {
  folder: Folder
  documents: Document[]
  subfolderCount: number
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

export function FolderDetail({ folder, documents, subfolderCount }: FolderDetailProps) {
  const docCount = documents.length
  const totalSize = documents.reduce((sum, d) => sum + (d.file_size ?? 0), 0)

  return (
    <div className="flex items-center gap-4 px-4 py-2.5 rounded-lg border bg-muted/30 text-sm text-muted-foreground">
      {folder.is_org_shared && (
        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
          <Globe className="h-3 w-3" />
          Shared with org
        </span>
      )}
      <span className="inline-flex items-center gap-1">
        <FileText className="h-3.5 w-3.5" />
        {docCount} {docCount === 1 ? "document" : "documents"}
      </span>
      <span className="inline-flex items-center gap-1">
        <HardDrive className="h-3.5 w-3.5" />
        {formatBytes(totalSize)}
      </span>
      {subfolderCount > 0 && (
        <span className="inline-flex items-center gap-1">
          <FolderIcon className="h-3.5 w-3.5" />
          {subfolderCount} {subfolderCount === 1 ? "subfolder" : "subfolders"}
        </span>
      )}
      <span className="inline-flex items-center gap-1">
        <Calendar className="h-3.5 w-3.5" />
        Created {formatDate(folder.created_at)}
      </span>
    </div>
  )
}
