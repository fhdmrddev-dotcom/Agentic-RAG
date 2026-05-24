import { FileText } from "lucide-react"
import type { ToolCall } from "@/types"

// Phase 075.7 Plan 01 (D-02 atomic extraction): lifted from ToolCallPanel.tsx
// GrepResult (L270-286).

export interface GrepBodyProps {
  parsed: any
}

export function summarize(tc: ToolCall): string {
  try {
    const parsed = tc.result ? JSON.parse(tc.result) : null
    const total = parsed?.total ?? parsed?.matches?.length ?? 0
    return `${total} match${total !== 1 ? "es" : ""}`
  } catch {
    return "View results"
  }
}

export default function GrepBody({ parsed }: GrepBodyProps) {
  const matches: any[] = parsed.matches ?? []
  return (
    <div className="max-h-48 overflow-y-auto overflow-x-hidden space-y-1">
      {matches.length === 0 ? (
        <span className="text-xs text-muted-foreground italic">No matches</span>
      ) : (
        matches.map((m: any, i: number) => (
          <div key={i} className="flex items-center gap-2 text-xs font-mono text-foreground/80 min-w-0 py-0.5">
            <FileText className="w-3.5 h-3.5 text-primary/60 flex-shrink-0" />
            <span className="truncate">{m.filename}</span>
          </div>
        ))
      )}
    </div>
  )
}
