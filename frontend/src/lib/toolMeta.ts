import type { ToolCall } from "@/types"

/**
 * Shared tool metadata helpers — used by ToolCallPanel and MessageItem.
 * Keeps labels and summaries in one place so they don't drift.
 */

export function toolLabel(name: string): string {
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
  if (name === "load_skill") return "Loading skill"
  if (name === "save_skill") return "Saving skill"
  if (name === "read_skill_file") return "Reading skill file"
  return name
}

export function toolSummary(name: string, args: Record<string, unknown>): string | null {
  if (name === "execute_code" && args.description) return args.description as string
  if (name === "read_document" && args.filename) return args.filename as string
  if (name === "read_document") return null // don't show raw UUID
  if (name === "ls" && args.path) return args.path as string
  if (name === "tree" && args.path) return args.path as string
  if (name === "grep" && args.pattern) return args.pattern as string
  if (name === "glob" && args.pattern) return args.pattern as string
  if (name === "load_skill" && args.skill_name) return args.skill_name as string
  if (name === "save_skill" && args.name) return args.name as string
  if (name === "analyze_document" && args.filename) return args.filename as string
  if (args.query) return args.query as string
  if (args.filename) return args.filename as string
  return null
}

/**
 * Phase 56 D-07: derive overall task phase from active tool name.
 * Pure frontend logic — no new backend events. Used by ToolCallPanel header.
 * Default returns "Thinking…" per D-07 (between tools / unknown).
 */
export function taskPhaseLabel(toolName: string): string {
  if (toolName === "search_documents") return "Gathering context"
  if (toolName === "query_documents") return "Gathering context"
  if (toolName === "web_search") return "Gathering context"
  if (toolName === "analyze_document") return "Analyzing"
  if (toolName === "execute_code") return "Running code"
  if (toolName === "load_skill") return "Loading skill"
  return "Thinking…"
}

/**
 * Phase 067.1 Plan 02: derive outer-banner placeholder copy from in-flight state.
 * Used by MessageItem outer placeholder to replace generic "Thinking" / "Working".
 * Pure frontend logic — no new backend events; derives from already-emitted SSE state
 * (iteration_start, tool_preparing, tool_start, code_execution_start, skill_activated).
 *
 * State precedence (most-specific first):
 * - No tools and no isPlanning → "Setting up agent…" (pre-first-delta silence)
 * - isPlanning (true) → "Thinking…"
 * - hasAnyTools but no activeTool → "Synthesizing answer…" (all-tools-done state)
 * - activeTool present → tool-specific copy from the per-tool branches below
 */
export function outerBannerLabel(
  activeTool: ToolCall | null,
  hasAnyTools: boolean,
  isPlanning: boolean,
): string {
  if (!hasAnyTools && !isPlanning) return "Setting up agent…"
  if (isPlanning) return "Thinking…"
  if (!activeTool) return "Synthesizing answer…"
  if (activeTool.name === "search_documents") return "Searching knowledge base…"
  if (activeTool.name === "query_documents") return "Querying document metadata…"
  if (activeTool.name === "web_search") return "Searching the web…"
  if (activeTool.name === "analyze_document") return "Analyzing document…"
  if (activeTool.name === "execute_code") {
    return activeTool.status === "preparing" ? "Preparing code…" : "Running code…"
  }
  if (activeTool.name === "load_skill") {
    const skillName = (activeTool.args?.skill_name as string | undefined) ?? ""
    return `Loading skill "${skillName}"…`
  }
  return "Working…"
}
