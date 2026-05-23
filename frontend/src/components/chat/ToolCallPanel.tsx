import { useState, useEffect, useMemo } from "react"
import {
  ChevronDown, ChevronRight, CheckCircle2, Loader2,
  Search, Globe, Database, FileText, Wrench,
  FolderOpen, GitBranch, TextSearch, FileSearch,
  Folder, BookOpen, Zap, Clock, Code2, Terminal, Square,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { ToolCall, SubAgentState, SkillActivation } from "@/types"
import { MarkdownRenderer } from "./MarkdownRenderer"
import { ExecuteCodeBlock } from "./ExecuteCodeBlock"
import { ToolArgsLivePanel } from "./ToolArgsLivePanel"
import { toolLabel, toolSummary as getToolSummary, taskPhaseLabel } from "@/lib/toolMeta"

interface Props {
  toolCalls: ToolCall[]
  subAgent?: SubAgentState  // live sub-agent state during streaming
  isPlanning?: boolean      // agent finished tool round, deciding next action
  /** Phase 56 D-03: 0-based iteration index from iteration_start SSE event. Display as `Step ${N + 1}`. */
  iterationCount?: number
  /** Phase 56 D-08/D-09: ordered list of skill activations to interleave with tool rows. */
  activatedSkills?: SkillActivation[]
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
  if (status === "interrupted") return "text-amber-400"
  if (name === "web_search") return "text-amber-400"
  if (name === "query_documents") return "text-emerald-400"
  if (name === "search_documents") return "text-primary"
  if (name === "analyze_document") return "text-violet-400"
  if (name === "execute_code") return "text-blue-400"
  return "text-muted-foreground"
}

// toolLabel and toolSummary are imported from @/lib/toolMeta

function toolSummary(tc: ToolCall) {
  return getToolSummary(tc.name, tc.args)
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

// ---- Live elapsed timer (running tools) ----

function ElapsedTimer({ startedAt }: { startedAt: number }) {
  const [elapsed, setElapsed] = useState(() => Date.now() - startedAt)
  useEffect(() => {
    const t = setInterval(() => setElapsed(Date.now() - startedAt), 250)
    return () => clearInterval(t)
  }, [startedAt])
  return (
    <span className="flex items-center gap-0.5 text-[10px] text-primary/70 font-mono tabular-nums flex-shrink-0 animate-pulse">
      <Clock className="w-2.5 h-2.5" />
      {formatDuration(elapsed)}
    </span>
  )
}

// ---- Full args expandable ----

function ToolArgsBlock({ tc }: { tc: ToolCall }) {
  const [open, setOpen] = useState(false)
  const entries = Object.entries(tc.args).filter(([, v]) => v !== undefined && v !== "")
  if (entries.length === 0) return null

  return (
    <div className="mt-1.5 ml-8">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1 text-[10px] text-muted-foreground/50 hover:text-muted-foreground transition-colors"
      >
        <Code2 className="w-2.5 h-2.5" />
        <span>{open ? "Hide" : "Show"} parameters</span>
        {open ? <ChevronDown className="w-2.5 h-2.5" /> : <ChevronRight className="w-2.5 h-2.5" />}
      </button>
      {open && (
        <div className="mt-1 rounded-md bg-card/50 backdrop-blur-md px-2.5 py-1.5 font-mono text-[10px] leading-relaxed text-foreground/60 space-y-0.5 overflow-x-auto">
          {entries.map(([key, val]) => (
            <div key={key} className="flex gap-2 min-w-0">
              <span className="text-primary/60 flex-shrink-0">{key}:</span>
              <span className="truncate text-foreground/70">
                {typeof val === "object" && val !== null ? JSON.stringify(val) : String(val)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ---- Result rendering helpers ----

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
    // result is not JSON — that's ok for query_documents, web_search, etc.
  }

  // Check for JSON error
  if (parsed?.error) {
    return (
      <div className="mt-1.5 ml-8 text-xs text-destructive italic">{parsed.error}</div>
    )
  }

  const summary = parsed ? resultSummary(tc.name, parsed) : (tc.result ? "View results" : null)
  const content = renderResult(tc.name, parsed, tc.result ?? undefined)
  if (!summary && !content) return null

  return (
    <div className="mt-1.5 ml-8">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-[11px] text-muted-foreground/60 hover:text-foreground transition-colors"
      >
        {open
          ? <ChevronDown className="w-3 h-3" />
          : <ChevronRight className="w-3 h-3" />}
        <span className="font-medium">{summary}</span>
      </button>
      {open && content && (
        <div className="mt-1.5 ml-4.5 rounded-lg bg-card/50 backdrop-blur-md p-2.5 ghost-border">
          {content}
        </div>
      )}
    </div>
  )
}

// ---- Sub-agent block ----

function SubAgentBlock({ agent }: { agent: SubAgentState }) {
  // Always start open — sub-agent analysis is the main content; never auto-collapse it
  const [open, setOpen] = useState(true)
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

// ---- Skill activation row (Phase 56 D-08/D-09) ----

function SkillRow({ activation }: { activation: SkillActivation }) {
  return (
    <div className="pt-2.5 animate-toolSlideIn" data-testid="skill-load-card">
      <div className="flex items-center gap-2.5">
        <span className="flex-shrink-0 p-1 rounded-md bg-muted/50 text-violet-400">
          <Zap className="w-3.5 h-3.5" />
        </span>
        <span className="flex-1 min-w-0 text-xs text-muted-foreground truncate">
          <span className="font-semibold text-foreground/80">Loading skill</span>
          <span className="ml-1.5 opacity-50">"{activation.skillName}"</span>
          {activation.description && (
            <span className="ml-1.5 opacity-40 italic">— {activation.description}</span>
          )}
        </span>
        <span className="flex-shrink-0">
          <CheckCircle2 className="w-3.5 h-3.5 text-success animate-checkPop" />
        </span>
      </div>
    </div>
  )
}

// ---- Main panel ----

export function ToolCallPanel({ toolCalls, subAgent, isPlanning, iterationCount, activatedSkills }: Props) {
  // Phase 075.1 Plan 04 Atom B (B-260519-10) — dedup tool cards keyed on
  // tool_call_id. OpenRouter mid-flight re-render of cached calls produced
  // visible duplicates in UAT Round 3. Dedup preserves first occurrence
  // ordering so the timeline / displayItems sort below behaves the same;
  // only the duplicate suffix entries get dropped.
  const deduplicatedToolCalls = useMemo(() => {
    const seen = new Set<string>()
    const result: ToolCall[] = []
    // Phase 075.2 Plan 01 Task 3 (D-075.2-01 §2 / WR-03): fallback key
    // includes idx tiebreaker so two same-name entries without ids (and
    // without startedAt) cannot collide and get silently deduped. Dead
    // code once the Task 2 onToolStart replay-idempotency guard is in,
    // but ships as defense-in-depth so the next edge case in this
    // neighborhood cannot produce a silent dedup.
    ;(toolCalls ?? []).forEach((tc, idx) => {
      const key = tc.id || `${tc.name}-${tc.startedAt ?? ''}-${idx}`
      if (seen.has(key)) return
      seen.add(key)
      result.push(tc)
    })
    return result
  }, [toolCalls])

  if (!deduplicatedToolCalls || deduplicatedToolCalls.length === 0) return null

  const hasInterrupted = deduplicatedToolCalls.some((tc) => tc.status === "interrupted")
  const allDone = deduplicatedToolCalls.every((tc) => tc.status === "done" || tc.status === "interrupted") &&
    (!subAgent || subAgent.status === "done")

const [expanded, setExpanded] = useState(true)

  const isExpanded = expanded
  // Phase 075.1 Plan 04 Atom B — every read of the tool list inside the
  // render uses the deduplicated list so the dedup is authoritative for
  // ALL derived state (counts, active-tool lookup, header label, display
  // ordering). Reverting any single line to read `toolCalls` would
  // re-introduce the visible duplicate.
  const totalTime = allDone && !isPlanning ? formatTotalDuration(deduplicatedToolCalls) : null
  const activeTool = deduplicatedToolCalls.find((tc) => tc.status === "running" || tc.status === "preparing")

  const stepPrefix = (iterationCount != null && iterationCount >= 0)
    ? `Step ${iterationCount + 1}`
    : null

  // Phase 56 D-07: model is streaming the final answer when:
  //   - panel is still actively working (NOT allDone)
  //   - we are NOT in the explicit `isPlanning` between-rounds gap
  //   - no tool is currently running
  //   - at least one tool has run already (deduplicatedToolCalls.length > 0)
  // Pure derivation from existing state — no new SSE event, no new prop.
  const isSynthesizing = !allDone && !isPlanning && !activeTool && deduplicatedToolCalls.length > 0

  const headerLabel = (() => {
    if (allDone && !isPlanning) {
      return hasInterrupted
        ? `Stopped — used ${deduplicatedToolCalls.length} tool${deduplicatedToolCalls.length > 1 ? "s" : ""}`
        : `Used ${deduplicatedToolCalls.length} tool${deduplicatedToolCalls.length > 1 ? "s" : ""}`
    }
    // Phase 56 D-03/D-05/D-07: Step N prefix + task phase label (D-07 mapping from active tool name).
    if (activeTool) {
      const phase = taskPhaseLabel(activeTool.name)
      const summary = toolSummary(activeTool)
      const body = summary ? `${phase} — ${summary}` : `${phase}…`
      return stepPrefix ? `${stepPrefix} — ${body}` : body
    }
    if (isSynthesizing) {
      return stepPrefix ? `${stepPrefix} — Synthesizing answer` : "Synthesizing answer"
    }
    if (isPlanning) {
      return stepPrefix ? `${stepPrefix} — Thinking…` : "Thinking…"
    }
    // Default fallback (D-07 default) — never empty, never "Working".
    return stepPrefix ? `${stepPrefix} — Thinking…` : "Thinking…"
  })()

  const isActivelyWorking = !allDone || isPlanning

  // Phase 56 D-09: interleave skill activations with tool calls by timestamp,
  // so skill rows appear inline between the tools in the order they occurred.
  type DisplayItem =
    | { kind: 'tool'; tc: ToolCall; t: number }
    | { kind: 'skill'; activation: SkillActivation; t: number }
  const displayItems: DisplayItem[] = [
    ...deduplicatedToolCalls.map((tc): DisplayItem => ({ kind: 'tool', tc, t: tc.status === "preparing" ? Infinity : (tc.startedAt ?? Date.now()) })),
    ...(activatedSkills ?? []).map((activation): DisplayItem => ({ kind: 'skill', activation, t: activation.occurredAt })),
  ].sort((a, b) => a.t - b.t)

  // 075.6 Plan 02 / SPEC Req #4: default-expand-for-active-preparing rule.
  // The LAST tool in displayItems whose status === "preparing" is the
  // ACTIVE preparing tool (per Boundary Keeper Round 1: "expanded for active
  // preparing tool, collapsed for past preparing tools"). Past preparing
  // tools (rare — would require multiple back-to-back preparing entries for
  // the same agent loop iteration) render collapsed by default.
  const lastPreparingIndex = (() => {
    for (let i = displayItems.length - 1; i >= 0; i--) {
      const it = displayItems[i]
      if (it.kind === 'tool' && it.tc.status === 'preparing') return i
    }
    return -1
  })()

  // 075.6 Plan 02 / SPEC Req #4: per-tool-id expanded state for the
  // <ToolArgsLivePanel> chevron toggle. Default value follows the default-
  // for-active rule (i === lastPreparingIndex). useState inside the map
  // callback is NOT React-safe; lift to a component-scope Record keyed by
  // tc.id so each panel instance has its own user-toggle state.
  const [panelExpanded, setPanelExpanded] = useState<Record<string, boolean>>({})
  const togglePanel = (id: string, defaultExpanded: boolean) =>
    setPanelExpanded((prev) => ({ ...prev, [id]: !(prev[id] ?? defaultExpanded) }))

  return (
    <div className={cn(
      "mb-3 rounded-xl overflow-hidden max-w-full text-sm transition-all duration-300",
      isActivelyWorking
        ? "bg-primary/5 border border-primary/20 shadow-[0_0_20px_-4px_hsl(239_84%_67%/0.15)]"
        : "bg-card/80 backdrop-blur-sm ghost-border"
    )}>
      {/* Header */}
      <button
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-accent/30 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
{!isActivelyWorking ? (
          hasInterrupted ? (
            <Square className="w-4 h-4 text-amber-500 flex-shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0 animate-checkPop" />
          )
        ) : (
          <div className="flex-shrink-0 animate-pulseGlow rounded-full">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
          </div>
        )}
        <span className={cn(
          "flex-1 text-xs font-semibold tracking-wide truncate",
          isActivelyWorking ? "text-primary" : "text-muted-foreground"
        )}>
          {headerLabel}
        </span>
        {/* Total execution time */}
        {totalTime && (
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground/50 font-mono tabular-nums flex-shrink-0">
            <Clock className="w-3 h-3" />
            {totalTime}
          </span>
        )}
        {isExpanded
          ? <ChevronDown className="w-4 h-4 text-muted-foreground" />
          : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
      </button>

      {/* Shimmer progress bar while tools are running or planning */}
      {isActivelyWorking && <div className="tool-progress-bar" />}

      {/* Body */}
      {isExpanded && (
        <div className="px-4 pb-3.5 space-y-1 border-t border-border/20 min-w-0 overflow-hidden">
          {displayItems.map((item, i) => {
            if (item.kind === 'skill') {
              return (
                <div key={`skill-${i}-${item.activation.occurredAt}`}>
                  {i > 0 && <div className="h-px bg-border/20 -mt-1 mb-2.5 mx-1" />}
                  <SkillRow activation={item.activation} />
                </div>
              )
            }
            // D-067-03: get the previous tool item's iteration for boundary detection.
            // Skill rows don't partition iterations; walk back past consecutive skills
            // to find the most recent tool kind. undefined if no prior tool.
            let prevToolIteration: number | undefined = undefined
            if (item.kind === 'tool') {
              for (let j = i - 1; j >= 0; j--) {
                const candidate = displayItems[j]
                if (candidate.kind === 'tool') {
                  prevToolIteration = candidate.tc.iteration
                  break
                }
              }
            }
            const tc = item.tc
            // ===== Existing tool-call render body, unchanged =====
            const summary = toolSummary(tc)
            // Use persisted sub_agent or live streaming sub_agent
            const agentState: SubAgentState | undefined =
              tc.sub_agent ?? (tc.name === "analyze_document" ? subAgent : undefined)

            return (
              <div key={i} className="pt-2.5 animate-toolSlideIn" style={{ animationDelay: `${i * 80}ms` }}>
                {/* D-067-03: Step N divider on iteration boundary; plain inter-tool separator otherwise.
                    Renders ONLY when (a) not the first item, (b) both current and previous tool items
                    have a defined iteration, (c) iterations differ. Pitfall 4: NEVER above first iteration.
                    WRN-3: stricter than PATTERNS.md Pattern F — also gate on prevToolIteration !== undefined
                    to handle DB-loaded historical messages whose ToolCall objects have no `iteration` field
                    (Pitfall 5). PATTERNS.md Pattern F's looser conditional would render a spurious divider
                    on a thread where exactly one DB-loaded tool call precedes a fresh SSE-stamped tool call. */}
                {i > 0 && tc.iteration !== undefined && prevToolIteration !== undefined && tc.iteration !== prevToolIteration ? (
                  <div
                    className="flex items-center gap-2 my-3 mx-1"
                    data-testid="iteration-divider"
                    data-iteration={tc.iteration}
                  >
                    <div className="flex-1 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
                    <span className="text-[10px] font-semibold text-muted-foreground/70 tracking-wider uppercase">
                      Step {tc.iteration + 1}
                    </span>
                    <div className="flex-1 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
                  </div>
                ) : i > 0 && (
                  <div className="h-px bg-border/20 -mt-1 mb-2.5 mx-1" />
                )}
                {tc.name === "execute_code" && tc.status !== "preparing" ? (
                  <ExecuteCodeBlock tc={tc} />
                ) : (
                  <>
                    {/* Tool row */}
                    <div className="flex items-center gap-2.5">
                      <span className={cn(
                        "flex-shrink-0 p-1 rounded-md bg-muted/50 transition-colors duration-300",
                        toolIconColor(tc.name, tc.status),
                        tc.status === "preparing" && "opacity-50"
                      )}>
                        {toolIcon(tc.name)}
                      </span>
                      <span className="flex-1 min-w-0 text-xs text-muted-foreground truncate">
                        {tc.status === "preparing" ? (
                          <span className="font-semibold text-foreground/50 italic">
                            Preparing {toolLabel(tc.name)}…
                            {/* T-260523-09: bytes-streamed badge during the
                                long LLM tool-args generation. Replaces the
                                prior silent "preparing" state with a live
                                "X.X KB" counter. Visible only when the
                                backend has emitted at least one 5KB-boundary
                                tool_args_progress event for this tool. */}
                            {tc.argsBytesStreamed != null && tc.argsBytesStreamed > 0 && (
                              <span className="ml-1.5 font-normal text-foreground/40 not-italic font-mono tabular-nums">
                                ({(tc.argsBytesStreamed / 1024).toFixed(1)} KB)
                              </span>
                            )}
                          </span>
                        ) : (
                          <>
                            <span className="font-semibold text-foreground/80">{toolLabel(tc.name)}</span>
                            {summary && (
                              <span className="ml-1.5 opacity-50">"{summary}"</span>
                            )}
                          </>
                        )}
                      </span>
                      {/* Duration badge — live timer while running, static badge when done */}
                      {tc.status === "running" && tc.startedAt != null
                        ? <ElapsedTimer startedAt={tc.startedAt} />
                        : <TimeBadge tc={tc} />
                      }
                      <span className="flex-shrink-0">
                        {tc.status === "preparing" ? (
                          <span className="w-3.5 h-3.5 rounded-full bg-primary/30 animate-pulse inline-block" />
                        ) : tc.status === "running" ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                        ) : tc.status === "interrupted" ? (
                          <Square className="w-3.5 h-3.5 text-amber-500" />
                        ) : (
                          <CheckCircle2 className="w-3.5 h-3.5 text-success animate-checkPop" />
                        )}
                      </span>
                    </div>

                    {/* Phase 075.1 Plan 04 Atom D (B-260519-05) — sub-agent
                        transparency line. Surfaces the silent downgrade so
                        the user sees that an analyze_document call ran on
                        e.g. claude-haiku-4-5 even though the main agent is
                        claude-sonnet-4-6. Renders only when the backend
                        populated tc.sub_agent_model (today only the
                        analyze_document branch — extends naturally when
                        more sub-agent tools land). */}
                    {tc.sub_agent_model && (
                      <div className="ml-8 mt-1 text-[10px] text-muted-foreground/70 italic font-mono">
                        Sub-agent: {tc.sub_agent_model}
                      </div>
                    )}

                    {/* Preparing indicator bar — only visible during "preparing" state */}
                    {tc.status === "preparing" && (
                      <div className="mt-1.5 h-0.5 rounded-full bg-gradient-to-r from-primary/30 to-primary/10 animate-pulse" />
                    )}

                    {/* 075.6 Plan 02 / SPEC Req #4: live code panel during
                        preparing. The inline (X.X KB) byte counter above
                        REMAINS for the no-argsCodeText case (e.g., non-
                        execute_code tools that emit tool_args_progress with
                        byte count but no code body); when the panel renders,
                        its header carries its own at-a-glance byte counter
                        per SPEC §Boundaries (byte counter stays inside the
                        new panel).
                        Default-expanded for the ACTIVE preparing tool
                        (i === lastPreparingIndex), collapsed for past
                        preparing tools. User can toggle either way via the
                        chevron. */}
                    {tc.status === "preparing" && tc.argsCodeText && tc.argsCodeText.length > 0 && tc.argsBytesStreamed != null && (
                      <ToolArgsLivePanel
                        title={`Generating ${tc.name === "execute_code" ? "code" : toolLabel(tc.name)}…`}
                        contentText={tc.argsCodeText}
                        byteCount={tc.argsBytesStreamed}
                        expanded={panelExpanded[tc.id] ?? (i === lastPreparingIndex)}
                        onToggle={() => togglePanel(tc.id, i === lastPreparingIndex)}
                      />
                    )}

                    {/* Expandable parameters */}
                    {(tc.status === "done" || tc.status === "interrupted") && <ToolArgsBlock tc={tc} />}

                    {/* Result block (all tools) */}
                    {(tc.status === "done" || tc.status === "interrupted") && tc.result && !agentState && (
                      <ToolResultBlock tc={tc} />
                    )}

                    {/* Sub-agent block (live or restored) */}
                    {agentState && <SubAgentBlock agent={agentState} />}
                  </>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
