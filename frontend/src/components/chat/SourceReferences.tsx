import { FileText } from "lucide-react"
import type { SourceReference } from "@/types"

interface Props {
  sources: SourceReference[]
}

export function SourceReferences({ sources }: Props) {
  if (!sources || sources.length === 0) return null

  return (
    <div className="flex flex-wrap gap-2 mt-3">
      {sources.map((src) => (
        <span
          key={src.document_id}
          className="inline-flex items-center gap-1.5 text-xs bg-muted/40 text-muted-foreground rounded-full px-2.5 py-1 border border-border/40"
          title={src.filename}
        >
          <FileText className="w-3 h-3 flex-shrink-0" />
          <span className="truncate max-w-[180px]">{src.filename}</span>
        </span>
      ))}
    </div>
  )
}
