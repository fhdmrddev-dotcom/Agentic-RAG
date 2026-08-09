import { Folder, FileText } from "lucide-react"
import type { ToolCall } from "@/types"

// Phase 075.7 Plan 01 (D-02 atomic extraction): lifted from ToolCallPanel.tsx
// TreeResult (L255-268) + private helpers TreeNodeRow (L220-253) and
// countTreeNodes (L135-144). All three move together — only TreeBody uses them.

function countTreeNodes(nodes: any[], depth = 0): number {
  if (!Array.isArray(nodes) || depth > 10) return 0
  let count = 0
  for (const node of nodes) {
    count++
    if (Array.isArray(node.children)) count += countTreeNodes(node.children, depth + 1)
    if (Array.isArray(node.documents)) count += node.documents.length
  }
  return count
}

function TreeNodeRow({ node, depth }: { node: any; depth: number }) {
  const indent = depth * 16
  if (depth > 3) return (
    <div style={{ marginLeft: indent }} className="text-xs text-muted-foreground font-mono">…</div>
  )
  return (
    <>
      <div style={{ marginLeft: indent }} className="flex items-center gap-2 text-xs font-mono text-foreground/80 min-w-0 py-0.5">
        {node.type === "folder" ? (
          <Folder className="w-3.5 h-3.5 text-amber-400/70 flex-shrink-0" />
        ) : (
          <FileText className="w-3.5 h-3.5 text-primary/60 flex-shrink-0" />
        )}
        <span className="truncate">{node.name}</span>
        {node.is_org_shared && (
          <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">shared</span>
        )}
      </div>
      {Array.isArray(node.documents) && node.documents.map((doc: any, i: number) => (
        <div
          key={i}
          style={{ marginLeft: indent + 16 }}
          className="flex items-center gap-2 text-xs font-mono text-foreground/80 min-w-0 py-0.5"
        >
          <FileText className="w-3.5 h-3.5 text-primary/60 flex-shrink-0" />
          <span className="truncate">{doc.filename}</span>
        </div>
      ))}
      {Array.isArray(node.children) && node.children.map((child: any, i: number) => (
        <TreeNodeRow key={i} node={child} depth={depth + 1} />
      ))}
    </>
  )
}

export interface TreeBodyProps {
  parsed: any
}

export function summarize(tc: ToolCall): string {
  try {
    const parsed = tc.result ? JSON.parse(tc.result) : null
    const count = countTreeNodes(parsed?.tree ?? [])
    return `${count} item${count !== 1 ? "s" : ""}`
  } catch {
    return "View results"
  }
}

export default function TreeBody({ parsed }: TreeBodyProps) {
  const tree: any[] = parsed.tree ?? []
  return (
    <div className="max-h-48 overflow-y-auto overflow-x-hidden space-y-0.5">
      {tree.length === 0 ? (
        <span className="text-xs text-muted-foreground italic">Empty tree</span>
      ) : (
        tree.map((node: any, i: number) => (
          <TreeNodeRow key={i} node={node} depth={0} />
        ))
      )}
    </div>
  )
}
