import { FileText } from "lucide-react"
import type { ToolCall } from "@/types"

// Phase 075.7 Plan 01 (D-02 atomic extraction): lifted from ToolCallPanel.tsx
// SearchDocumentsResult (L346-372).

export interface SearchDocumentsBodyProps {
  parsed: any
}

export function summarize(tc: ToolCall): string {
  try {
    const parsed = tc.result ? JSON.parse(tc.result) : null
    if (!Array.isArray(parsed) || parsed.length === 0) return "0 results"
    const top = parsed[0]
    const filename = top?.metadata?.filename ?? top?.filename ?? "result"
    const score = top?.similarity != null ? ` (${(top.similarity * 100).toFixed(0)}%)` : ""
    return `top match: ${filename}${score}`
  } catch {
    return "View results"
  }
}

export default function SearchDocumentsBody({ parsed }: SearchDocumentsBodyProps) {
  if (!Array.isArray(parsed) || parsed.length === 0) return null
  return (
    <div className="max-h-48 overflow-y-auto overflow-x-hidden space-y-1.5">
      {parsed.map((chunk: any, i: number) => (
        <div key={i} className="rounded-md bg-muted/20 px-2.5 py-2 space-y-1">
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="w-3 h-3 text-primary/60 flex-shrink-0" />
            <span className="text-[11px] font-mono text-foreground/80 truncate">
              {chunk.metadata?.filename ?? chunk.filename ?? `Chunk ${i + 1}`}
            </span>
            {chunk.similarity != null && (
              <span className="ml-auto text-[10px] font-mono text-muted-foreground/60 flex-shrink-0">
                {(chunk.similarity * 100).toFixed(0)}% match
              </span>
            )}
          </div>
          {chunk.content && (
            <p className="text-[10px] text-foreground/50 leading-relaxed line-clamp-2 pl-5">
              {chunk.content.slice(0, 200)}
            </p>
          )}
        </div>
      ))}
    </div>
  )
}
