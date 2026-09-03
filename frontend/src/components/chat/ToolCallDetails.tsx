/**
 * Phase 227 Wave 2 — ToolCallDetails component.
 *
 * Encapsulates detail inspection blocks extracted from ToolCallPanel.tsx:
 *   - ToolArgsBlock: expandable parameters preview
 *   - ToolResultBlock: result dispatch (diff, JSON, markdown, image previews)
 *   - SubAgentBlock: subagent task & content display
 */
import { useState } from "react"
import {
  ChevronDown, ChevronRight, CheckCircle2, Loader2,
  Code2, Zap,
} from "lucide-react"
import type { ToolCall, SubAgentState } from "@/types"
import { MarkdownRenderer } from "./MarkdownRenderer"
import { TOOL_BODIES, GenericBody, summarizeToolCall } from "./tool-bodies"

// ---- Full args expandable ----

export function ToolArgsBlock({ tc }: { tc: ToolCall }) {
  const [open, setOpen] = useState(false)
  const entries = Object.entries(tc.args).filter(([, v]) => v !== undefined && v !== "")
  if (entries.length === 0) return null

  return (
    <div className="mt-1.5 ml-8" data-testid="tool-args-block">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-muted-foreground transition-colors"
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

// ---- Result rendering ----
// Result block (all tools). Phase 095 Plan 06: a finished tool reaches this
// branch only when it is EXPANDED (its key is in expandedSteps; the resting
// essence line is ToolEssenceLine). Open the result body directly so there
// is no redundant nested `→ summary` essence row.
export function ToolResultBlock({ tc, defaultOpen = false }: { tc: ToolCall; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)

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

  const summary = tc.result ? (summarizeToolCall(tc) || "View results") : null

  let content: React.ReactNode = null
  if (tc.name === "ls" && parsed) {
    content = <TOOL_BODIES.ls parsed={parsed} />
  } else if (tc.name === "tree" && parsed) {
    content = <TOOL_BODIES.tree parsed={parsed} />
  } else if (tc.name === "grep" && parsed) {
    content = <TOOL_BODIES.grep parsed={parsed} />
  } else if (tc.name === "glob" && parsed) {
    content = <TOOL_BODIES.glob parsed={parsed} />
  } else if (tc.name === "read_document" && parsed) {
    content = <TOOL_BODIES.read_document parsed={parsed} />
  } else if (tc.name === "search_documents" && Array.isArray(parsed)) {
    content = <TOOL_BODIES.search_documents parsed={parsed} />
  } else if (tc.name === "query_documents" && tc.result) {
    content = <TOOL_BODIES.query_documents result={tc.result} />
  } else if (tc.name === "web_search" && tc.result) {
    content = <TOOL_BODIES.web_search result={tc.result} />
  } else if (tc.result) {
    content = <GenericBody result={tc.result} />
  }

  if (!summary && !content) return null

  const isDoneAndCollapsed = !open && tc.status === "done"

  return (
    <div className="mt-1.5 ml-8" data-testid="tool-result-block">
      {isDoneAndCollapsed ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          data-testid="tool-result-summary"
          className="block w-full text-left font-mono text-xs text-muted-foreground hover:text-foreground transition-colors py-0.5"
          aria-label="Expand tool result"
        >
          → {summarizeToolCall(tc) || "View results"}
        </button>
      ) : (
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
        >
          {open
            ? <ChevronDown className="w-3 h-3" />
            : <ChevronRight className="w-3 h-3" />}
          <span className="font-medium">{summary}</span>
        </button>
      )}
      {open && content && (
        <div className="mt-1.5 ml-4.5 rounded-lg bg-card/50 backdrop-blur-md p-2.5 ghost-border">
          {content}
        </div>
      )}
    </div>
  )
}

// ---- Sub-agent block (live or restored) ----
// Phase 095 Plan 03 Task 1 (D-05 root fix): the sub-agent lives ONLY on its owning
// tool_call (stamped by StreamsProvider onSubAgentStart).
export function SubAgentBlock({ agent }: { agent: SubAgentState }) {
  const [open, setOpen] = useState(true)
  return (
    <div className="mt-3 rounded-lg overflow-hidden bg-card/40 ghost-border relative" data-testid="sub-agent-block">
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
