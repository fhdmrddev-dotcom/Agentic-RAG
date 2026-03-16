import { Button } from "@/components/ui/button"
import { Trash2 } from "lucide-react"
import { DocumentStatusBadge } from "./DocumentStatusBadge"
import type { Document } from "@/types"

interface Props {
  documents: Document[]
  onDelete: (id: string) => void
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function DocumentList({ documents, onDelete }: Props) {
  if (documents.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        No documents uploaded yet.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Filename</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Size</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Chunks</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
            <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
          </tr>
        </thead>
        <tbody>
          {documents.map((doc) => (
            <tr key={doc.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
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
          ))}
        </tbody>
      </table>
    </div>
  )
}
