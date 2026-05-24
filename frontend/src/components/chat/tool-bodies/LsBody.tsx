import { Folder, FileText } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ToolCall } from "@/types"

// Phase 075.7 Plan 01 (D-02 atomic extraction): lifted from ToolCallPanel.tsx
// LsResult (L192-218) + StatusBadge (L175-190). StatusBadge stays private —
// only LsBody uses it.

function StatusBadge({ status }: { status: string }) {
  const color =
    status === "completed" ? "text-success" :
    status === "processing" ? "text-amber-400" :
    status === "failed" ? "text-destructive" :
    "text-muted-foreground"
  return (
    <span className={cn("ml-1.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full", color,
      status === "completed" && "bg-success/10",
      status === "processing" && "bg-amber-400/10",
      status === "failed" && "bg-destructive/10",
    )}>
      {status}
    </span>
  )
}

export interface LsBodyProps {
  parsed: any
}

export function summarize(tc: ToolCall): string {
  try {
    const parsed = tc.result ? JSON.parse(tc.result) : null
    const folders = parsed?.folders?.length ?? 0
    const docs = parsed?.documents?.length ?? 0
    return `${folders} folder${folders !== 1 ? "s" : ""}, ${docs} document${docs !== 1 ? "s" : ""}`
  } catch {
    return "View results"
  }
}

export default function LsBody({ parsed }: LsBodyProps) {
  const folders: any[] = parsed.folders ?? []
  const documents: any[] = parsed.documents ?? []
  return (
    <div className="max-h-48 overflow-y-auto overflow-x-hidden space-y-1">
      {folders.map((f: any, i: number) => (
        <div key={i} className="flex items-center gap-2 text-xs font-mono text-foreground/80 min-w-0 py-0.5">
          <Folder className="w-3.5 h-3.5 text-amber-400/70 flex-shrink-0" />
          <span className="truncate">{f.name}</span>
          {f.is_global && (
            <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">global</span>
          )}
        </div>
      ))}
      {documents.map((d: any, i: number) => (
        <div key={i} className="flex items-center gap-2 text-xs font-mono text-foreground/80 min-w-0 py-0.5">
          <FileText className="w-3.5 h-3.5 text-primary/60 flex-shrink-0" />
          <span className="truncate">{d.filename}</span>
          {d.status && <StatusBadge status={d.status} />}
        </div>
      ))}
      {folders.length === 0 && documents.length === 0 && (
        <span className="text-xs text-muted-foreground italic">Empty folder</span>
      )}
    </div>
  )
}
