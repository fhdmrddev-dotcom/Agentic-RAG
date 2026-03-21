import { useState } from "react"
import {
  ChevronDown, ChevronRight, CheckCircle2, Loader2,
  Search, Globe, Database, FileText, Wrench,
  FolderOpen, GitBranch, TextSearch, FileSearch,
  Folder,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { ToolCall, SubAgentState } from "@/types"
import { MarkdownRenderer } from "./MarkdownRenderer"

interface Props {
  toolCalls: ToolCall[]
  subAgent?: SubAgentState  // live sub-agent state during streaming
}

function toolIcon(name: string) {
  if (name === "search_documents") return <Search className="w-3.5 h-3.5" />
  if (name === "query_documents") return <Database className="w-3.5 h-3.5" />
  if (name === "web_search") return <Globe className="w-3.5 h-3.5" />
  if (name === "analyze_document") return <FileText className="w-3.5 h-3.5" />
  if (name === "ls") return <FolderOpen className="w-3.5 h-3.5" />
  if (name === "tree") return <GitBranch className="w-3.5 h-3.5" />
  if (name === "grep") return <TextSearch className="w-3.5 h-3.5" />
  if (name === "glob") return <FileSearch className="w-3.5 h-3.5" />
  return <Wrench className="w-3.5 h-3.5" />
}

function toolLabel(name: string) {
  if (name === "search_documents") return "Searching documents"
  if (name === "query_documents") return "Querying documents"
  if (name === "web_search") return "Searching the web"
  if (name === "analyze_document") return "Analyzing document"
  if (name === "ls") return "Listing folder"
  if (name === "tree") return "Browsing folder tree"
  if (name === "grep") return "Searching file contents"
  if (name === "glob") return "Finding files by pattern"
  return name
}

function toolSummary(tc: ToolCall) {
  if (tc.name === "ls" && tc.args.path) return tc.args.path
  if (tc.name === "tree" && tc.args.path) return tc.args.path
  if (tc.name === "grep" && tc.args.pattern) return tc.args.pattern
  if (tc.name === "glob" && tc.args.pattern) return tc.args.pattern
  if (tc.args.query) return tc.args.query
  if (tc.args.filename) return tc.args.filename
  return null
}

// ---- Result rendering helpers ----

function countTreeNodes(nodes: any[]): number {
  if (!Array.isArray(nodes)) return 0
  let count = 0
  for (const node of nodes) {
    count++
    if (Array.isArray(node.children)) count += countTreeNodes(node.children)
    if (Array.isArray(node.documents)) count += node.documents.length
  }
  return count
}

function resultSummary(name: string, parsed: any): string {
  if (name === "ls") {
    const folders = parsed.folders?.length ?? 0
    const docs = parsed.documents?.length ?? 0
    return `${folders} folder${folders !== 1 ? "s" : ""}, ${docs} document${docs !== 1 ? "s" : ""}`
  }
  if (name === "tree") {
    const count = countTreeNodes(parsed.tree ?? [])
    return `${count} item${count !== 1 ? "s" : ""}`
  }
  if (name === "grep" || name === "glob") {
    const total = parsed.total ?? parsed.matches?.length ?? 0
    return `${total} match${total !== 1 ? "es" : ""}`
  }
  return "View results"
}

function StatusBadge({ status }: { status: string }) {
  const color =
    status === "completed" ? "text-green-500" :
    status === "processing" ? "text-yellow-500" :
    status === "failed" ? "text-red-400" :
    "text-muted-foreground"
  return (
    <span className={cn("ml-1 opacity-80", color)}>
      [{status}]
    </span>
  )
}

function LsResult({ parsed }: { parsed: any }) {
  const folders: any[] = parsed.folders ?? []
  const documents: any[] = parsed.documents ?? []
  return (
    <div className="max-h-48 overflow-y-auto space-y-0.5">
      {folders.map((f: any, i: number) => (
        <div key={i} className="flex items-center gap-1.5 text-xs font-mono text-foreground/80">
          <Folder className="w-3 h-3 text-muted-foreground flex-shrink-0" />
          <span>{f.name}</span>
          {f.is_global && (
            <span className="text-[10px] text-muted-foreground">(global)</span>
          )}
        </div>
      ))}
      {documents.map((d: any, i: number) => (
        <div key={i} className="flex items-center gap-1.5 text-xs font-mono text-foreground/80">
          <FileText className="w-3 h-3 text-muted-foreground flex-shrink-0" />
          <span>{d.filename}</span>
          {d.status && <StatusBadge status={d.status} />}
        </div>
      ))}
      {folders.length === 0 && documents.length === 0 && (
        <span className="text-xs text-muted-foreground italic">Empty folder</span>
      )}
    </div>
  )
}

function TreeNodeRow({ node, depth }: { node: any; depth: number }) {
  const indent = depth * 16
  if (depth > 3) return (
    <div style={{ marginLeft: indent }} className="text-xs text-muted-foreground font-mono">…</div>
  )
  return (
    <>
      <div style={{ marginLeft: indent }} className="flex items-center gap-1.5 text-xs font-mono text-foreground/80">
        {node.type === "folder" ? (
          <Folder className="w-3 h-3 text-muted-foreground flex-shrink-0" />
        ) : (
          <FileText className="w-3 h-3 text-muted-foreground flex-shrink-0" />
        )}
        <span>{node.name}</span>
        {node.is_global && (
          <span className="text-[10px] text-muted-foreground">(global)</span>
        )}
      </div>
      {Array.isArray(node.documents) && node.documents.map((doc: any, i: number) => (
        <div
          key={i}
          style={{ marginLeft: indent + 16 }}
          className="flex items-center gap-1.5 text-xs font-mono text-foreground/80"
        >
          <FileText className="w-3 h-3 text-muted-foreground flex-shrink-0" />
          <span>{doc.filename}</span>
        </div>
      ))}
      {Array.isArray(node.children) && node.children.map((child: any, i: number) => (
        <TreeNodeRow key={i} node={child} depth={depth + 1} />
      ))}
    </>
  )
}

function TreeResult({ parsed }: { parsed: any }) {
  const tree: any[] = parsed.tree ?? []
  return (
    <div className="max-h-48 overflow-y-auto space-y-0.5">
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

function GrepResult({ parsed }: { parsed: any }) {
  const matches: any[] = parsed.matches ?? []
  return (
    <div className="max-h-48 overflow-y-auto space-y-0.5">
      {matches.length === 0 ? (
        <span className="text-xs text-muted-foreground italic">No matches</span>
      ) : (
        matches.map((m: any, i: number) => (
          <div key={i} className="flex items-center gap-1.5 text-xs font-mono text-foreground/80">
            <FileText className="w-3 h-3 text-muted-foreground flex-shrink-0" />
            <span>{m.filename}</span>
          </div>
        ))
      )}
    </div>
  )
}

function GlobResult({ parsed }: { parsed: any }) {
  const matches: any[] = parsed.matches ?? []
  return (
    <div className="max-h-48 overflow-y-auto space-y-0.5">
      {matches.length === 0 ? (
        <span className="text-xs text-muted-foreground italic">No matches</span>
      ) : (
        matches.map((m: any, i: number) => (
          <div key={i} className="flex items-center gap-1.5 text-xs font-mono text-foreground/80">
            <FileText className="w-3 h-3 text-muted-foreground flex-shrink-0" />
            <span>{m.path ?? m.filename}</span>
          </div>
        ))
      )}
    </div>
  )
}

function renderResult(name: string, parsed: any): React.ReactNode {
  if (name === "ls") return <LsResult parsed={parsed} />
  if (name === "tree") return <TreeResult parsed={parsed} />
  if (name === "grep") return <GrepResult parsed={parsed} />
  if (name === "glob") return <GlobResult parsed={parsed} />
  return null
}

function ToolResultBlock({ tc }: { tc: ToolCall }) {
  const [open, setOpen] = useState(false)

  let parsed: any = null
  try {
    parsed = tc.result ? JSON.parse(tc.result) : null
  } catch {
    // ignore parse errors
  }

  if (!parsed) return null

  if (parsed.error) {
    return (
      <div className="mt-1 text-xs text-red-400 italic">{parsed.error}</div>
    )
  }

  const summary = resultSummary(tc.name, parsed)
  const content = renderResult(tc.name, parsed)
  if (!content) return null

  return (
    <div className="mt-1.5">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground/70 transition-colors"
      >
        {open
          ? <ChevronDown className="w-3 h-3" />
          : <ChevronRight className="w-3 h-3" />}
        <span>{summary}</span>
      </button>
      {open && (
        <div className="mt-1.5 ml-4">
          {content}
        </div>
      )}
    </div>
  )
}

// ---- Sub-agent block ----

function SubAgentBlock({ agent }: { agent: SubAgentState }) {
  const [open, setOpen] = useState(agent.status === "running")
  return (
    <div className="mt-2 rounded-md border border-border/40 bg-background/60 overflow-hidden">
      <button
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-muted/30 transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        <FileText className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
        <span className="flex-1 text-xs text-muted-foreground truncate">
          <span className="font-medium text-foreground/80">{agent.filename}</span>
          {agent.task && <span className="ml-1 opacity-70">— {agent.task}</span>}
        </span>
        {agent.status === "running" ? (
          <Loader2 className="w-3 h-3 animate-spin text-muted-foreground flex-shrink-0" />
        ) : (
          <CheckCircle2 className="w-3 h-3 text-green-500 flex-shrink-0" />
        )}
        {open ? <ChevronDown className="w-3 h-3 text-muted-foreground" /> : <ChevronRight className="w-3 h-3 text-muted-foreground" />}
      </button>
      {open && agent.content && (
        <div className="px-3 pb-3 border-t border-border/30">
          <div className="mt-2 max-h-64 overflow-y-auto">
            <MarkdownRenderer content={agent.content} className="text-xs text-foreground/80" />
            {agent.status === "running" && (
              <span className="inline-block w-1.5 h-3 ml-0.5 bg-foreground/40 animate-pulse rounded-sm align-text-bottom" />
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ---- Main panel ----

export function ToolCallPanel({ toolCalls, subAgent }: Props) {
  const allDone = toolCalls.every((tc) => tc.status === "done") &&
    (!subAgent || subAgent.status === "done")

  const [expanded, setExpanded] = useState(!allDone)

  const isExpanded = expanded

  if (!toolCalls || toolCalls.length === 0) return null

  return (
    <div className={cn(
      "mb-3 rounded-xl border overflow-hidden text-sm transition-colors",
      allDone
        ? "border-border/40 bg-muted/10"
        : "border-primary/20 bg-primary/5"
    )}>
      {/* Header */}
      <button
        className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left hover:bg-muted/20 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        {allDone ? (
          <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
        ) : (
          <Loader2 className="w-4 h-4 animate-spin text-primary flex-shrink-0" />
        )}
        <span className={cn(
          "flex-1 text-xs font-medium",
          allDone ? "text-muted-foreground" : "text-primary"
        )}>
          {allDone
            ? `Used ${toolCalls.length} tool${toolCalls.length > 1 ? "s" : ""}`
            : "Thinking…"}
        </span>
        {isExpanded
          ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
          : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
      </button>

      {/* Body */}
      {isExpanded && (
        <div className="px-3.5 pb-3 space-y-2 border-t border-border/30">
          {toolCalls.map((tc, i) => {
            const summary = toolSummary(tc)
            // Use persisted sub_agent or live streaming sub_agent
            const agentState: SubAgentState | undefined =
              tc.sub_agent ?? (tc.name === "analyze_document" ? subAgent : undefined)

            return (
              <div key={i} className="pt-2">
                {/* Tool row */}
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground flex-shrink-0">{toolIcon(tc.name)}</span>
                  <span className="flex-1 min-w-0 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground/70">{toolLabel(tc.name)}</span>
                    {summary && (
                      <span className="ml-1.5 opacity-60 truncate">— {summary}</span>
                    )}
                  </span>
                  <span className="flex-shrink-0">
                    {tc.status === "running" ? (
                      <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
                    ) : (
                      <CheckCircle2 className="w-3 h-3 text-green-500" />
                    )}
                  </span>
                </div>

                {/* Result block (ls, tree, grep, glob) */}
                {tc.status === "done" && tc.result && !agentState && (
                  <ToolResultBlock tc={tc} />
                )}

                {/* Sub-agent block (live or restored) */}
                {agentState && <SubAgentBlock agent={agentState} />}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
