import { useState } from "react"
import { ChevronDown, ChevronRight } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { ToolCall } from "@/types"

// Phase 075.7 Plan 01 (D-02 atomic extraction): lifted from ToolCallPanel.tsx
// ReadDocumentResult (L306-342). ONLY stateful body — preserves the local
// useState(false) expand toggle (self-contained per RESEARCH §2.4 risk #4).

export interface ReadDocumentBodyProps {
  parsed: any
}

export function summarize(tc: ToolCall): string {
  try {
    const parsed = tc.result ? JSON.parse(tc.result) : null
    const content: string = parsed?.content ?? ""
    if (!content) return "no content"
    const preview = content.slice(0, 50).replace(/\s+/g, " ")
    return `${content.length} chars · ${preview}${content.length > 50 ? "…" : ""}`
  } catch {
    return "View results"
  }
}

export default function ReadDocumentBody({ parsed }: ReadDocumentBodyProps) {
  const [open, setOpen] = useState(false)

  if (!parsed) return null

  if (parsed.error) {
    return <div className="mt-1.5 text-xs text-destructive italic">{parsed.error}</div>
  }

  const isRange = parsed.start_line != null && parsed.end_line != null
  const header = isRange
    ? `Lines ${parsed.start_line}–${parsed.end_line}`
    : "Full document"
  const content: string = parsed.content ?? ""

  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        <span>{header}</span>
      </button>
      {open && (
        <div className="mt-2 ml-5 rounded-lg bg-card/60 ghost-border">
          <ScrollArea className="max-h-64">
            <pre className="p-3 text-xs font-mono leading-relaxed text-foreground/80 whitespace-pre-wrap break-words">
              {content || <span className="italic text-muted-foreground">No content available for this document.</span>}
            </pre>
          </ScrollArea>
        </div>
      )}
    </div>
  )
}
