import { useState } from "react"
import { ChevronDown, ChevronRight, CheckCircle2, Loader2, Search, Globe, Database, FileText, Wrench } from "lucide-react"
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
  return <Wrench className="w-3.5 h-3.5" />
}

function toolLabel(name: string) {
  if (name === "search_documents") return "Searching documents"
  if (name === "query_documents") return "Querying documents"
  if (name === "web_search") return "Searching the web"
  if (name === "analyze_document") return "Analyzing document"
  return name
}

function toolSummary(tc: ToolCall) {
  if (tc.args.query) return tc.args.query
  if (tc.args.filename) return tc.args.filename
  return null
}

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

export function ToolCallPanel({ toolCalls, subAgent }: Props) {
  const allDone = toolCalls.every((tc) => tc.status === "done") &&
    (!subAgent || subAgent.status === "done")

  const [expanded, setExpanded] = useState(!allDone)

  // Auto-expand while running, but let user override
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
