import { FileText } from "lucide-react"
import type { ToolCall } from "@/types"

// Phase 075.7 Plan 01 (D-02 atomic extraction): lifted from ToolCallPanel.tsx
// SearchDocumentsResult (L346-372).

export interface SearchDocumentsBodyProps {
  parsed: any
}

// Phase 272-05 (F-3) — a non-passage result says WHICH one it is. Every non-array result used to
// read "0 results", so a D-09 lock refusal looked exactly like a real empty search (G4-2). The
// keys are the handler's (`search_documents_tool.py`), pinned by this file's test via `?raw`.
function summarizeOutcome(parsed: any): string | null {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null
  if (parsed.error === "refused_retry") return "refused — would drop the filter"
  if (parsed.error === "invalid_filter") {
    return parsed.field ? `invalid filter (${parsed.field})` : "invalid filter"
  }
  if (parsed.error === "retrieval_unavailable") return "search unavailable"
  if (parsed.status === "no_documents_matched") {
    if (parsed.reason === "not_searchable_yet") {
      return `${parsed.matched_documents ?? "some"} matched — not searchable yet`
    }
    return "no documents matched"
  }
  return null
}

export function summarize(tc: ToolCall): string {
  try {
    const parsed = tc.result ? JSON.parse(tc.result) : null
    const outcome = summarizeOutcome(parsed)
    if (outcome) return outcome
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
              <span className="ml-auto text-[10px] font-mono text-muted-foreground flex-shrink-0">
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
