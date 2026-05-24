import type { ToolCall } from "@/types"

// Phase 075.7 Plan 01 (D-02 atomic extraction): lifted from ToolCallPanel.tsx
// QueryDocumentsResult (L376-385). Today's signature takes raw `{ result: string }`
// (not parsed JSON) — preserved verbatim per PATTERNS.md discretion note.

export interface QueryDocumentsBodyProps {
  result: string
}

export function summarize(tc: ToolCall): string {
  const r = tc.result ?? ""
  if (!r) return "no output"
  const cleaned = r.replace(/\s+/g, " ").trim()
  return cleaned.length > 80 ? cleaned.slice(0, 80) + "…" : cleaned
}

export default function QueryDocumentsBody({ result }: QueryDocumentsBodyProps) {
  // query_documents returns a plain string, not JSON
  return (
    <div className="max-h-48 overflow-y-auto overflow-x-hidden">
      <pre className="text-[11px] font-mono text-foreground/70 whitespace-pre-wrap break-words leading-relaxed">
        {result}
      </pre>
    </div>
  )
}
