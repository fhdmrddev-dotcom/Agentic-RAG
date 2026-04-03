import { useState } from "react"
import {
  ChevronDown, ChevronRight, CheckCircle2, Loader2,
  Search, Globe, Database, FileText, Wrench,
  FolderOpen, GitBranch, TextSearch, FileSearch,
  Folder, BookOpen, Zap, Clock, Terminal,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { ToolCall, SubAgentState } from "@/types"
import { MarkdownRenderer } from "./MarkdownRenderer"
import { ExecuteCodeBlock } from "./ExecuteCodeBlock"

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
  if (name === "execute_code") return <Terminal className={cls} />
  return <Wrench className={cls} />
}

function toolIconColor(name: string, status: string) {
  if (status === "running") return "text-primary"
  if (name === "web_search") return "text-amber-400"
  if (name === "query_documents") return "text-emerald-400"
  if (name === "search_documents") return "text-primary"
  if (name === "analyze_document") return "text-violet-400"
  if (name === "execute_code") return "text-blue-400"
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
  if (name === "execute_code") return "Executing code"
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

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function formatTotalDuration(toolCalls: ToolCall[]): string | null {
  const starts = toolCalls.filter(tc => tc.startedAt).map(tc => tc.startedAt!)
  const ends = toolCalls.filter(tc => tc.endedAt).map(tc => tc.endedAt!)
  if (starts.length === 0 || ends.length === 0) return null
  const total = Math.max(...ends) - Math.min(...starts)
  return formatDuration(total)
}

// ---- Execution time badge ----

function TimeBadge({ tc }: { tc: ToolCall }) {
  if (!tc.startedAt || !tc.endedAt) return null
  const duration = tc.endedAt - tc.startedAt
  return (
    <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground/60 font-mono tabular-nums flex-shrink-0">
      <Clock className="w-2.5 h-2.5" />
      {formatDuration(duration)}
    </span>
  )
}

// ---- Inline args preview ----

function formatArgsInline(args: Record<string, string>): string {
  const entries = Object.entries(args).filter(([, v]) => v !== undefined && v !== "")
  if (entries.length === 0) return ""
  const parts = entries.map(([k, v]) => {
    const val = String(v)
    const truncated = val.length > 72 ? val.slice(0, 72) + "…" : val
    return `"${k}": "${truncated}"`
  })
  return `{${parts.join(", ")}}`
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
  if (name === "search_documents") {
    if (Array.isArray(parsed)) return `${parsed.length} chunk${parsed.length !== 1 ? "s" : ""} found`
    return "View results"
  }
  if (name === "query_documents") {
    if (typeof parsed === "string") return parsed.length > 60 ? parsed.slice(0, 60) + "…" : parsed
    if (Array.isArray(parsed)) return `${parsed.length} row${parsed.length !== 1 ? "s" : ""}`
    return "View results"
  }
  if (name === "web_search") {
    return "View search results"
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

// ---- Search documents result ----

function SearchDocumentsResult({ parsed }: { parsed: any }) {
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

// ---- Query documents result (SQL) ----

function QueryDocumentsResult({ result }: { result: string }) {
  // query_documents returns a plain string, not JSON
  return (
    <div className="max-h-48 overflow-y-auto overflow-x-hidden">
      <pre className="text-[11px] font-mono text-foreground/70 whitespace-pre-wrap break-words leading-relaxed">
        {result}
      </pre>
    </div>
  )
}

// ---- Web search result ----

function WebSearchResult({ result }: { result: string }) {
  return (
    <div className="max-h-48 overflow-y-auto overflow-x-hidden">
      <div className="text-[11px] text-foreground/70 leading-relaxed space-y-1">
        <MarkdownRenderer content={result} className="text-[11px]" />
      </div>
    </div>
  )
}

// ---- Generic JSON result fallback ----

function GenericResult({ result }: { result: string }) {
  return (
    <div className="max-h-48 overflow-y-auto overflow-x-hidden">
      <pre className="text-[10px] font-mono text-foreground/50 whitespace-pre-wrap break-words leading-relaxed">
        {result.slice(0, 1500)}{result.length > 1500 ? "\n…" : ""}
      </pre>
    </div>
  )
}

function renderResult(name: string, parsed: any, rawResult?: string): React.ReactNode {
  if (name === "ls") return <LsResult parsed={parsed} />
  if (name === "tree") return <TreeResult parsed={parsed} />
  if (name === "grep") return <GrepResult parsed={parsed} />
  if (name === "glob") return <GlobResult parsed={parsed} />
  if (name === "read_document") return <ReadDocumentResult parsed={parsed} />
  if (name === "search_documents" && Array.isArray(parsed)) return <SearchDocumentsResult parsed={parsed} />
  if (name === "query_documents" && rawResult) return <QueryDocumentsResult result={rawResult} />
  if (name === "web_search" && rawResult) return <WebSearchResult result={rawResult} />
  // Fallback: show raw result for any other tool
  if (rawResult) return <GenericResult result={rawResult} />
  return null
}

function ToolResultBlock({ tc }: { tc: ToolCall }) {
  const [open, setOpen] = useState(false)

  let parsed: any = null
  try {
    parsed = tc.result ? JSON.parse(tc.result) : null
  } catch {
    // result is not JSON — ok for query_documents, web_search, etc.
  }

  if (parsed?.error) {
    return (
      <div className="mt-1 text-[10px] text-destructive/80 italic">{parsed.error}</div>
    )
  }

  const summary = parsed ? resultSummary(tc.name, parsed) : (tc.result ? "View results" : null)
  const content = renderResult(tc.name, parsed, tc.result ?? undefined)
  if (!summary && !content) return null

  // For tools whose detail content is just a repeat of the summary (no extra value), skip the toggle
  const hasExpandableDetail = content !== null && !["ls", "tree", "grep", "glob"].includes(tc.name)

  return (
    <div className="mt-1">
      {hasExpandableDetail ? (
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1 text-[10px] text-muted-foreground/50 hover:text-muted-foreground/80 transition-colors"
        >
          <span className="text-success/70">✓</span>
          <span>{summary}</span>
          {open ? <ChevronDown className="w-2.5 h-2.5" /> : <ChevronRight className="w-2.5 h-2.5" />}
        </button>
      ) : (
        <span className="flex items-center gap-1 text-[10px] text-muted-foreground/50">
          <span className="text-success/70">✓</span>
          <span>{summary}</span>
        </span>
      )}
      {open && content && (
        <div className="mt-1.5 rounded-lg bg-muted/15 p-2.5 ghost-border">
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
  const totalTime = allDone ? formatTotalDuration(toolCalls) : null

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
        className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-accent/30 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        {isExpanded
          ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground/60 flex-shrink-0" />
          : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/60 flex-shrink-0" />}
        <span className="text-xs text-muted-foreground/70 font-medium">
          {isExpanded ? "Hide steps" : "Show steps"}
        </span>
        <div className="flex-1" />
        {!allDone && (
          <div className="flex items-center gap-1.5 text-[10px] text-primary">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>Working…</span>
          </div>
        )}
        {allDone && (
          <span className="flex items-center gap-1 text-[10px] font-medium bg-success/12 text-success px-2 py-0.5 rounded-full">
            <CheckCircle2 className="w-2.5 h-2.5" />
            {toolCalls.length} step{toolCalls.length !== 1 ? "s" : ""} completed
            {totalTime && <span className="opacity-60 ml-1">· {totalTime}</span>}
          </span>
        )}
      </button>

      {/* Shimmer progress bar while tools are running */}
      {!allDone && <div className="tool-progress-bar" />}

      {/* Body */}
      {isExpanded && (
        <div className="px-4 pb-3.5 space-y-1 border-t border-border/20 min-w-0 overflow-hidden">
          {toolCalls.map((tc, i) => {
            const summary = toolSummary(tc)
            // Use persisted sub_agent or live streaming sub_agent
            const agentState: SubAgentState | undefined =
              tc.sub_agent ?? (tc.name === "analyze_document" ? subAgent : undefined)

            return (
              <div key={i} className="pt-2.5 animate-toolSlideIn" style={{ animationDelay: `${i * 80}ms` }}>
                {/* Connecting line between tools */}
                {i > 0 && (
                  <div className="h-px bg-border/20 -mt-1 mb-2.5 mx-1" />
                )}
                {tc.name === "execute_code" ? (
                  <ExecuteCodeBlock tc={tc} />
                ) : (
                  <div className="flex items-start gap-2.5">
                    {/* Icon */}
                    <span className={cn(
                      "mt-0.5 flex-shrink-0 p-1 rounded-md bg-muted/40 transition-colors duration-300",
                      toolIconColor(tc.name, tc.status)
                    )}>
                      {toolIcon(tc.name)}
                    </span>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      {/* Label row */}
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs font-semibold text-foreground/80 truncate">
                          {toolLabel(tc.name)}
                        </span>
                        <div className="flex-1" />
                        {tc.status === "running" ? (
                          <Loader2 className="w-3 h-3 animate-spin text-primary flex-shrink-0" />
                        ) : (
                          <span className="flex items-center gap-0.5 text-[10px] text-success flex-shrink-0">
                            <CheckCircle2 className="w-2.5 h-2.5" />
                            Complete
                          </span>
                        )}
                      </div>

                      {/* Inline args preview */}
                      {Object.keys(tc.args).length > 0 && (
                        <p className="text-[10px] font-mono text-muted-foreground/50 truncate mt-0.5 leading-relaxed">
                          {formatArgsInline(tc.args)}
                        </p>
                      )}

                      {/* Inline result summary + optional expandable detail */}
                      {tc.status === "done" && tc.result && !agentState && (
                        <ToolResultBlock tc={tc} />
                      )}

                      {/* Sub-agent block (live or restored) */}
                      {agentState && <SubAgentBlock agent={agentState} />}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
