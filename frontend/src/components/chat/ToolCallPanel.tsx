import { useState } from "react"
import {
  ChevronDown, ChevronRight, CheckCircle2, Loader2,
  Search, Globe, Database, FileText, Wrench,
  FolderOpen, GitBranch, TextSearch, FileSearch,
  Folder, BookOpen, Zap,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { ToolCall, SubAgentState } from "@/types"
import { MarkdownRenderer } from "./MarkdownRenderer"

interface Props {
  toolCalls: ToolCall[]
  subAgent?: SubAgentState  // live sub-agent state during streaming
}

function toolIcon(name: string) {
  const cls = "w-3.5 h-3.5"
  if (name === "search_documents") return <Search className={cls} />
  if (name === "query_documents") return <Database className={cls} />
  if (name === "web_search") return <Globe className={cls} />
  if (name === "analyze_document") return <FileText className={cls} />
  if (name === "ls") return <FolderOpen className={cls} />
  if (name === "tree") return <GitBranch className={cls} />
  if (name === "grep") return <TextSearch className={cls} />
  if (name === "glob") return <FileSearch className={cls} />
  if (name === "read_document") return <BookOpen className={cls} />
  return <Wrench className={cls} />
}

function toolIconColor(name: string, status: string) {
  if (status === "running") return "text-primary"
  if (name === "web_search") return "text-amber-400"
  if (name === "query_documents") return "text-emerald-400"
  if (name === "search_documents") return "text-primary"
  if (name === "analyze_document") return "text-violet-400"
  return "text-muted-foreground"
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
  if (name === "read_document") return "Reading document"
  return name
}

function toolSummary(tc: ToolCall) {
  if (tc.name === "read_document" && tc.args.document_id) return tc.args.document_id
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

function LsResult({ parsed }: { parsed: any }) {
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
        {node.is_global && (
          <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">global</span>
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

function TreeResult({ parsed }: { parsed: any }) {
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

function GrepResult({ parsed }: { parsed: any }) {
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

function GlobResult({ parsed }: { parsed: any }) {
  const matches: any[] = parsed.matches ?? []
  return (
    <div className="max-h-48 overflow-y-auto overflow-x-hidden space-y-1">
      {matches.length === 0 ? (
        <span className="text-xs text-muted-foreground italic">No matches</span>
      ) : (
        matches.map((m: any, i: number) => (
          <div key={i} className="flex items-center gap-2 text-xs font-mono text-foreground/80 min-w-0 py-0.5">
            <FileText className="w-3.5 h-3.5 text-primary/60 flex-shrink-0" />
            <span className="truncate">{m.path ?? m.filename}</span>
          </div>
        ))
      )}
    </div>
  )
}

function ReadDocumentResult({ parsed }: { parsed: any }) {
  const [open, setOpen] = useState(false)

  if (!parsed) return null

  if (parsed.error) {
    return <div className="mt-1.5 text-xs text-destructive italic">{parsed.error}</div>
  }

  const isRange = parsed.start_line != null && parsed.end_line != null
  const header = isRange
    ? `Lines ${parsed.start_line}\u2013${parsed.end_line}`
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

function renderResult(name: string, parsed: any): React.ReactNode {
  if (name === "ls") return <LsResult parsed={parsed} />
  if (name === "tree") return <TreeResult parsed={parsed} />
  if (name === "grep") return <GrepResult parsed={parsed} />
  if (name === "glob") return <GlobResult parsed={parsed} />
  if (name === "read_document") return <ReadDocumentResult parsed={parsed} />
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
      <div className="mt-1.5 text-xs text-destructive italic">{parsed.error}</div>
    )
  }

  const summary = resultSummary(tc.name, parsed)
  const content = renderResult(tc.name, parsed)
  if (!content) return null

  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        {open
          ? <ChevronDown className="w-3.5 h-3.5" />
          : <ChevronRight className="w-3.5 h-3.5" />}
        <span className="font-medium">{summary}</span>
      </button>
      {open && (
        <div className="mt-2 ml-5">
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
    <div className="mt-3 rounded-lg overflow-hidden bg-card/40 ghost-border relative">
      {/* Gradient left accent */}
      <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-gradient-to-b from-primary to-violet-500" />
      <button
        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left hover:bg-accent/40 transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        <Zap className="w-3.5 h-3.5 text-violet-400 flex-shrink-0" />
        <span className="flex-1 text-xs text-muted-foreground truncate">
          <span className="font-semibold text-foreground/90">{agent.filename}</span>
          {agent.task && <span className="ml-1.5 opacity-60">— {agent.task}</span>}
        </span>
        {agent.status === "running" ? (
          <div className="flex-shrink-0 animate-pulseGlow rounded-full">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
          </div>
        ) : (
          <CheckCircle2 className="w-3.5 h-3.5 text-success flex-shrink-0" />
        )}
        {open ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
      </button>
      {open && agent.content && (
        <div className="px-4 pb-3 border-t border-border/20">
          <div className="mt-2 max-h-64 overflow-y-auto">
            <MarkdownRenderer content={agent.content} className="text-xs text-foreground/80" />
            {agent.status === "running" && (
              <span className="inline-block w-1.5 h-3 ml-0.5 bg-primary/50 animate-pulse rounded-sm align-text-bottom" />
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
      "mb-3 rounded-xl overflow-hidden max-w-full text-sm transition-all duration-300",
      allDone
        ? "bg-muted/30 ghost-border"
        : "bg-primary/5 border border-primary/20 shadow-[0_0_20px_-4px_hsl(239_84%_67%/0.15)]"
    )}>
      {/* Header */}
      <button
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-accent/30 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        {allDone ? (
          <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0" />
        ) : (
          <div className="flex-shrink-0 animate-pulseGlow rounded-full">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
          </div>
        )}
        <span className={cn(
          "flex-1 text-xs font-semibold tracking-wide",
          allDone ? "text-muted-foreground" : "text-primary"
        )}>
          {allDone
            ? `Used ${toolCalls.length} tool${toolCalls.length > 1 ? "s" : ""}`
            : "Working…"}
        </span>
        {isExpanded
          ? <ChevronDown className="w-4 h-4 text-muted-foreground" />
          : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
      </button>

      {/* Body */}
      {isExpanded && (
        <div className="px-4 pb-3.5 space-y-1 border-t border-border/20 min-w-0 overflow-hidden">
          {toolCalls.map((tc, i) => {
            const summary = toolSummary(tc)
            // Use persisted sub_agent or live streaming sub_agent
            const agentState: SubAgentState | undefined =
              tc.sub_agent ?? (tc.name === "analyze_document" ? subAgent : undefined)

            return (
              <div key={i} className="pt-2.5">
                {/* Connecting line between tools */}
                {i > 0 && (
                  <div className="h-px bg-border/20 -mt-1 mb-2.5 mx-1" />
                )}
                {/* Tool row */}
                <div className="flex items-center gap-2.5">
                  <span className={cn("flex-shrink-0 p-1 rounded-md bg-muted/50", toolIconColor(tc.name, tc.status))}>
                    {toolIcon(tc.name)}
                  </span>
                  <span className="flex-1 min-w-0 text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground/80">{toolLabel(tc.name)}</span>
                    {summary && (
                      <span className="ml-1.5 opacity-50 truncate block sm:inline">"{summary}"</span>
                    )}
                  </span>
                  <span className="flex-shrink-0">
                    {tc.status === "running" ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                    ) : (
                      <CheckCircle2 className="w-3.5 h-3.5 text-success" />
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
