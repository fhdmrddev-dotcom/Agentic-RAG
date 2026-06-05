import { useState, useEffect, useMemo } from "react"
import {
  ChevronDown, ChevronRight, CheckCircle2, Loader2,
  Search, Globe, Database, FileText, Wrench,
  FolderOpen, GitBranch, TextSearch, FileSearch,
  BookOpen, Zap, Clock, Code2, Terminal,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { ToolCall, SubAgentState, SkillActivation } from "@/types"
import { MarkdownRenderer } from "./MarkdownRenderer"
import { TOOL_BODIES, GenericBody, summarizeToolCall } from "./tool-bodies"
import { ToolArgsLivePanel } from "./ToolArgsLivePanel"
import { ExecuteCodeEditorInset } from "./tool-bodies/ExecuteCodeBody"
import { toolLabel, toolSummary as getToolSummary } from "@/lib/toolMeta"
import { StatusPill, type ToolStatus } from "./StatusPill"
import { dedupToolCalls } from "@/lib/stepCount"

interface Props {
  toolCalls: ToolCall[]
  /**
   * Phase 095 Plan 03 (D-05): no longer read. The legacy analyze_document
   * sub-agent now lives on its owning tool_call (`tc.sub_agent`), stamped by
   * StreamsProvider — collapsing the dual render source. RunCard still passes
   * `message.sub_agent` for back-compat; the field is accepted but unused.
   */
  subAgent?: SubAgentState
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

// Phase 075.8 Task 2 (sketch 002 D5): map ToolCall.status → StatusPill ToolStatus.
// "failed" is not directly observable on ToolCall.status (failed execute_code
// surfaces through ExecuteCodeBody's exitCode path; non-execute_code tools
// surface errors via parsed.error). Treat anything terminal-but-not-done as
// done — failures show up via ToolResultBlock's destructive italic line.
function pillStatus(s: ToolCall["status"]): ToolStatus {
  if (s === "preparing") return "preparing"
  if (s === "running") return "running"
  if (s === "interrupted") return "interrupted"
  return "done"
}

// Phase 075.8 Task 2 (sketch 002 D5): TimeBadge was dropped — the StatusPill
// now carries the `· {duration}` suffix on done/failed/interrupted variants,
// making the standalone Clock+duration span redundant. ExecuteCodeBody
// underwent the same swap.

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

// ---- Result rendering ----
// Phase 075.7 Plan 01 (D-02 atomic extraction): all 9 inline *Result
// components + countTreeNodes helper + resultSummary function + StatusBadge
// + renderResult dispatch have been lifted into per-tool *Body.tsx files
// under ./tool-bodies/. Each Body owns its default component AND its named
// `summarize(tc)` derivation (D-03). The TOOL_BODIES + summarizeToolCall
// registry consumed by ToolResultBlock (below) is imported at the top of
// this file. `ToolResultBlock` stays inline per CONTEXT deferred list;
// only its inner dispatch was swapped to use the registry.

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

  // Phase 075.7 Plan 01 (D-02): per-Body summarize() via registry. Fallback
  // to "View results" preserves pre-refactor behavior for raw-non-JSON
  // results whose tool name lacks a SUMMARIES entry.
  const summary = tc.result ? (summarizeToolCall(tc) || "View results") : null

  // Phase 075.7 Plan 01 (D-02): dispatch via TOOL_BODIES registry. Per-Body
  // prop shapes preserved (ls/tree/grep/glob/read_document/search_documents
  // take `parsed`; query_documents/web_search take raw `result`). GenericBody
  // is the fallback for any other tool with a raw result.
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

  // Phase 075.7 Plan 03 T1 + UAT fix (Bug C — duplicate summary rows):
  //   - When tool is "done" and collapsed: render ONLY the `→ {summary}` row
  //     (sketch live-run-container D5 / UI-SPEC §7.5 collapsed-row format).
  //     It is itself the toggle that expands the body on click.
  //   - When tool is non-done OR expanded: render the chevron-button row
  //     (pre-Plan-03 toggle pattern) so streaming/preparing/interrupted tools
  //     and currently-expanded done tools keep the chevron affordance.
  //   - Never both rows at once.
  const isDoneAndCollapsed = !open && tc.status === "done"

  return (
    <div className="mt-1.5 ml-8">
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
          className="flex items-center gap-1.5 text-[11px] text-muted-foreground/60 hover:text-foreground transition-colors"
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

// ---- Step rail (Phase 095 Plan 03 Task 2, sketch 014 — unified-card-frame) ----
//
// The borderless step-numbered status-node rail. Each deduped tool renders on
// a 2-column grid: a rail column (node + connecting line + `snum`) and the
// step main column (the EXISTING per-tool head + body — REUSED verbatim, no
// second body system; G4). Node state derives from (index, status):
//   done   = a finished step (filled-success node, success snum)
//   active = the step running now (pulsing-primary ring node, primary snum)
//   queued = not-yet-started (dim outline node)
// Numbering makes the D-04 count + D-05 zero-dup structural (a dup = two
// same-numbered rows). Reuse-only CSS — no new keyframes.

type NodeState = "done" | "active" | "queued"

function StepRow({
  snum,
  node,
  isLast,
  children,
}: {
  snum: number
  node: NodeState
  isLast: boolean
  children: React.ReactNode
}) {
  return (
    <div className="grid grid-cols-[28px_1fr] min-w-0">
      {/* Rail column: connecting line + status node + step number */}
      <div className="relative flex flex-col items-center" aria-hidden="true">
        {/* the spine — fills success up to the active node; hidden on the last row */}
        {!isLast && (
          <div
            data-testid="step-rail-line"
            className={cn(
              "absolute top-5 bottom-0 w-px left-1/2 -translate-x-1/2",
              node === "queued" ? "bg-border" : "bg-success/60",
              node === "active" && "bg-gradient-to-b from-success/60 to-primary",
            )}
          />
        )}
        {/* the status node */}
        <span
          data-testid="step-node"
          data-node-state={node}
          className={cn(
            "relative z-[1] mt-2.5 w-2.5 h-2.5 rounded-full border-2 flex-shrink-0",
            node === "done" && "bg-success border-success",
            node === "active" &&
              "bg-card border-primary animate-pulseGlow shadow-[0_0_0_3px_hsl(var(--primary)/0.15)]",
            node === "queued" && "bg-card border-border",
          )}
        />
        {/* the step number */}
        <span
          data-testid="step-snum"
          className={cn(
            "mt-1 font-mono text-[10px] tabular-nums leading-none",
            node === "active" ? "text-primary font-bold" : "text-success/80",
            node === "queued" && "text-muted-foreground/50",
          )}
        >
          {snum}
        </span>
      </div>
      {/* Step main column: the reused per-tool head + body */}
      <div className="min-w-0">{children}</div>
    </div>
  )
}

// ---- Main panel ----

export function ToolCallPanel({ toolCalls, activatedSkills }: Props) {
  // Phase 075.7 Bug D fix: `isPlanning` and `iterationCount` props are still
  // declared in the Props interface (RunCard.tsx passes them) but are no
  // longer consumed here. RunCard owns run-level chrome (timer, counter,
  // header copy); ToolCallPanel renders body content only.
  // Phase 075.1 Plan 04 Atom B (B-260519-10) — dedup tool cards keyed on
  // tool_call_id. OpenRouter mid-flight re-render of cached calls produced
  // visible duplicates in UAT Round 3. Dedup preserves first occurrence
  // ordering so the timeline / displayItems sort below behaves the same;
  // only the duplicate suffix entries get dropped.
  //
  // Phase 095 Plan 03 Task 2 (D-04 single dedup home): import the ONE shared
  // dedup from @/lib/stepCount (Plan 01) instead of an inline copy. The shared
  // helper is byte-identical to the prior inline derivation (same
  // clientKey > id > composite fallback chain, first-occurrence ordering) —
  // the point is ONE source so the panel count and the RunCard headline count
  // (which also reads unifiedStepCount → dedupToolCalls) can never drift.
  const deduplicatedToolCalls = useMemo(() => dedupToolCalls(toolCalls), [toolCalls])

  if (!deduplicatedToolCalls || deduplicatedToolCalls.length === 0) return null

  // Phase 075.7 UAT fix (Bug D — duplicate frame/header):
  // ToolCallPanel is now BODY-ONLY. RunCard.tsx owns the outer rounded frame,
  // the sticky header (status + timer + counter + brand-pulse avatar), the
  // run-level expand/collapse state, and the streaming shimmer band.
  // Pre-Plan-02 outer header/frame derivations (hasInterrupted, allDone,
  // totalTime, activeTool, headerLabel, isActivelyWorking, isSynthesizing,
  // stepPrefix, expanded/setExpanded) were the sole consumers of that chrome
  // and have been removed alongside it.

  // Phase 56 D-09: interleave skill activations with tool calls by timestamp,
  // so skill rows appear inline between the tools in the order they occurred.
  type DisplayItem =
    | { kind: 'tool'; tc: ToolCall; t: number }
    | { kind: 'skill'; activation: SkillActivation; t: number }
  const displayItems: DisplayItem[] = [
    ...deduplicatedToolCalls.map((tc): DisplayItem => ({ kind: 'tool', tc, t: tc.status === "preparing" ? Infinity : (tc.startedAt ?? Date.now()) })),
    ...(activatedSkills ?? []).map((activation): DisplayItem => ({ kind: 'skill', activation, t: activation.occurredAt })),
  ].sort((a, b) => a.t - b.t)

  // Phase 095 Plan 03 Task 2 (sketch 014 rail): per-tool 1-based step number,
  // assigned in deduped-tool order. The snum is the rail's load-bearing
  // numbering — it maps 1:1 to unifiedStepCount and makes D-05 zero-dup
  // structural (a duplicate = two same-numbered rows). Keyed on the stable
  // clientKey > id > composite identity (the SAME key dedupToolCalls uses).
  const toolStepNumber = new Map<string, number>()
  deduplicatedToolCalls.forEach((tc, idx) => {
    const key = tc.clientKey ?? tc.id ?? `${tc.name}-${tc.startedAt ?? ''}-${idx}`
    toolStepNumber.set(key, idx + 1)
  })
  const stepKeyOf = (tc: ToolCall, idx: number) =>
    tc.clientKey ?? tc.id ?? `${tc.name}-${tc.startedAt ?? ''}-${idx}`
  // Node state from (status): the running/preparing tool is the active node;
  // a finished tool is done; anything else (rare) is queued.
  const nodeStateOf = (tc: ToolCall): NodeState => {
    if (tc.status === "running" || tc.status === "preparing") return "active"
    if (tc.status === "done" || tc.status === "interrupted") return "done"
    return "queued"
  }

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

  // 075.6 Plan 03 / SPEC Req #7: step-list collapse predicate.
  // Threshold N=3 locked per Boundary Keeper Round 1. Collapse window is the
  // run of consecutive completed (status === "done") tool items STRICTLY
  // preceding the active (running/preparing) tool item. When the window
  // length is ≥3, the displayItems map renders ONE summary row at i=0 and
  // null-returns for 1 ≤ i < activeIndex; expanding the chevron restores
  // per-row rendering. Iteration divider at L729 walks backward through
  // displayItems[j] for j=i-1 → 0 to find prevToolIteration — when collapsed,
  // the immediate predecessor of the active step is the LAST collapsed item,
  // so the divider above the active step fires correctly for the
  // iter-N → iter-(N+1) boundary (Pitfall 6 / Landmine L5 mitigation).
  const activeIndex = displayItems.findIndex(
    (it) => it.kind === "tool" && (it.tc.status === "running" || it.tc.status === "preparing"),
  )
  const completedBeforeActive =
    activeIndex === -1
      ? []
      : displayItems.slice(0, activeIndex).filter(
          (it): it is Extract<DisplayItem, { kind: "tool" }> =>
            it.kind === "tool" && it.tc.status === "done",
        )
  // 2026-05-24 fix: collapsed-summary count uses TOTAL items before active
  // (any kind: tool + skill), not only completed tools. Prior to this fix
  // the label said e.g. "Completed 3 steps" while the active row was
  // labelled "Step 7" because skill rows / undefined-status tools were
  // excluded from the count. The visible "Step N" header is derived from
  // `tc.iteration + 1` (line ~805) so the count needs to reflect every
  // row the user can see being hidden by collapse, not a subset.
  const hiddenStepsCount = activeIndex === -1 ? 0 : activeIndex
  const shouldCollapse = hiddenStepsCount >= 3
  const [stepsCollapsed, setStepsCollapsed] = useState(true)

  // Pitfall 6 mitigation: summary row carries iteration = min(iteration of
  // collapsed items) as data-iteration-min so future readers can see the
  // boundary the summary row spans without re-deriving it.
  const collapsedIterationMin = (() => {
    const iters = completedBeforeActive
      .map((it) => it.tc.iteration)
      .filter((x): x is number => x !== undefined)
    return iters.length > 0 ? Math.min(...iters) : undefined
  })()

  // Phase 075.7 UAT fix (Bug D): RunCard.tsx wraps this component and owns
  // the outer rounded frame, sticky header (run summary + timer + counter +
  // brand-pulse avatar), expand/collapse state, and shimmer. ToolCallPanel
  // renders the tool-list body only — no outer frame, no header.
  return (
    <div className="px-4 pb-3.5 space-y-1 min-w-0 overflow-hidden">
          {/* Phase 075.8 Task 4 (sketch 001 D3 — Focus Mode):
              Per-step result-summary rows replace the prior aggregate
              "Show N earlier steps" toggle. Collapsed past steps render
              as one-line `→ {summary}` rows inline (the sketch D3
              behavior — "while a run is in flight, completed tool calls
              auto-collapse to a one-line summary showing their result,
              not their args"). The aggregate Show-toggle is dropped per
              PLAN.md Task 4 pick.
              The "Hide earlier steps" toggle remains visible only when
              the user has opted into the full-expanded view, so they
              can re-fold without losing the affordance. */}
          {shouldCollapse && !stepsCollapsed && (
            <div
              key="expanded-steps-collapse"
              data-testid="expanded-steps-collapse"
              className="pt-2.5"
            >
              <button
                type="button"
                onClick={() => setStepsCollapsed(true)}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted/30 rounded-md transition-colors"
              >
                <ChevronDown className="w-3.5 h-3.5" />
                <span>Hide earlier steps</span>
              </button>
            </div>
          )}
          {displayItems.map((item, i) => {
            // Phase 075.8 Task 4 (sketch 001 D3 — Focus Mode):
            // When shouldCollapse + stepsCollapsed, past steps
            // (positions 0..activeIndex-1) render as one-line result-
            // summary rows via summarizeToolCall(tc). Clicking the row
            // expands the full view (sets stepsCollapsed=false).
            // The iteration divider above the active step still derives
            // prevToolIteration from displayItems[i-1] (the LAST
            // collapsed-but-rendered item) — the iter-N → iter-(N+1)
            // boundary above the active step continues to fire
            // (Pitfall 6 / Landmine L5 mitigation preserved).
            if (shouldCollapse && stepsCollapsed && i < activeIndex) {
              if (item.kind === 'tool') {
                const collapsedTc = item.tc
                const summaryText = summarizeToolCall(collapsedTc) || toolLabel(collapsedTc.name)
                return (
                  <button
                    key={`step-summary-${i}-${collapsedTc.clientKey ?? collapsedTc.id ?? collapsedTc.name}`}
                    type="button"
                    onClick={() => setStepsCollapsed(false)}
                    data-testid="step-summary-row"
                    data-iteration-min={i === 0 ? collapsedIterationMin : undefined}
                    aria-label={`Expand to view ${hiddenStepsCount} earlier steps`}
                    className="w-full text-left px-3 py-1.5 text-xs font-mono text-muted-foreground/70 hover:text-foreground hover:bg-muted/20 rounded-md transition-colors flex items-center gap-2"
                  >
                    <span className="opacity-50 flex-shrink-0">→</span>
                    <span className="truncate flex-1 min-w-0">{summaryText}</span>
                  </button>
                )
              }
              // Skill rows in collapsed Focus Mode: keep them visible as a
              // single compact line so the user still sees the activation
              // happened mid-run.
              return (
                <button
                  key={`step-summary-skill-${i}-${item.activation.occurredAt}`}
                  type="button"
                  onClick={() => setStepsCollapsed(false)}
                  className="w-full text-left px-3 py-1.5 text-xs font-mono text-muted-foreground/70 hover:text-foreground hover:bg-muted/20 rounded-md transition-colors flex items-center gap-2"
                >
                  <Zap className="w-3 h-3 opacity-50 flex-shrink-0" />
                  <span className="truncate flex-1 min-w-0 italic">
                    skill: {item.activation.skillName}
                  </span>
                </button>
              )
            }
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
            // Phase 095 Plan 03 Task 1 (D-05 root fix): the sub-agent now lives
            // ONLY on its owning tool_call (StreamsProvider onSubAgentStart stamps
            // it onto the analyze_document owner; the single-slot message-scoped
            // live-write is gone). The old dual source (tool-scoped OR the
            // message-scoped prop fallback) was the double-render ROOT — collapsed
            // to the tool-scoped value alone so a sub-agent body can never render
            // twice (once as the tool body, once via the message-scoped fallback).
            // The message-scoped `subAgent` prop is no longer read on this path.
            const agentState: SubAgentState | undefined = tc.sub_agent

            // Phase 075.8 Task 3 (sketch 002 D6): active-tool glow + bottom shimmer.
            // Applied to the per-tool wrapper when the tool is running or
            // preparing. The .tc-active-wrap class lives in index.css (box-shadow
            // + soft gradient backdrop); the bottom shimmer reuses
            // .tool-progress-bar positioned absolute at the wrapper's bottom.
            const isToolActive = tc.status === "running" || tc.status === "preparing"

            // Phase 095 Plan 03 Task 2 (sketch 014 rail): this tool's step
            // number + node state for the StepRow wrapper. `isLastTool` hides
            // the connecting spine on the final rail row.
            const stepKey = stepKeyOf(tc, i)
            const snum = toolStepNumber.get(stepKey) ?? 0
            const node = nodeStateOf(tc)
            const isLastTool = snum === deduplicatedToolCalls.length

            return (
              <div
                key={i}
                className={cn(
                  "pt-2.5 animate-toolSlideIn",
                  isToolActive && "tc-active-wrap rounded-md px-2",
                )}
                data-testid={isToolActive ? "tc-active" : undefined}
                data-tool-status={tc.status}
                style={{ animationDelay: `${i * 80}ms` }}
              >
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
                    {/* Phase 095 Plan 03 Task 2 (D-04 relabel): "Round N", not
                        "Step N". This within-run divider groups agent ROUNDS
                        (tc.iteration); after D-04, "Step" means exactly one
                        visible action (the rail snum / unifiedStepCount), so
                        the round divider is relabeled to free that word. */}
                    <span className="text-[10px] font-semibold text-muted-foreground/70 tracking-wider uppercase">
                      Round {tc.iteration + 1}
                    </span>
                    <div className="flex-1 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
                  </div>
                ) : i > 0 && (
                  <div className="h-px bg-border/20 -mt-1 mb-2.5 mx-1" />
                )}
                {/* Phase 095 Plan 03 Task 2: the EXISTING tool head + body
                    (reused verbatim — no second body system, G4) rendered onto
                    the borderless numbered status-node rail (sketch 014). */}
                <StepRow snum={snum} node={node} isLast={isLastTool}>
                {tc.name === "execute_code" ? (
                  // Phase 075.9 hot-fix: render ExecuteCodeBody for ALL
                  // execute_code statuses (preparing/running/done). Previously
                  // the `tc.status !== "preparing"` guard caused a full
                  // component-tree swap at tool_start: the generic-tool tree
                  // (with its standalone ExecuteCodeEditorInset) unmounted and
                  // ExecuteCodeBody mounted fresh, so the Shiki view appeared
                  // to "blink in" with the final code rather than streaming.
                  // ExecuteCodeBody itself reads displayCode = argsCodeText ??
                  // args.code, handles all 3 statuses, and embeds the same
                  // ExecuteCodeEditorInset — so the inset stays mounted from
                  // the first streamed byte through completion (true seamless
                  // handoff). The standalone inset/ToolArgsLivePanel below in
                  // the else branch are now dead code for execute_code (still
                  // active for other tools that emit tool_args_progress).
                  <TOOL_BODIES.execute_code tc={tc} />
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
                            <span className="font-semibold text-foreground/80">
                              {tc.status === "running" ? `Running ${toolLabel(tc.name)}` : toolLabel(tc.name)}
                            </span>
                            {summary && (
                              <span className="ml-1.5 opacity-50">"{summary}"</span>
                            )}
                          </>
                        )}
                      </span>
                      {/* Phase 075.8 Task 2 (sketch 002 D5):
                          - During RUNNING, keep the existing live elapsed
                            timer (since the pill running variant doesn't
                            show duration) — gives the user a live ticker.
                          - During DONE/INTERRUPTED, the pill carries the
                            duration suffix, so the standalone TimeBadge is
                            redundant and dropped.
                          - During PREPARING, no clock is meaningful yet —
                            the pill's italic verb signals the state. */}
                      {tc.status === "running" && tc.startedAt != null && (
                        <ElapsedTimer startedAt={tc.startedAt} />
                      )}
                      {/* Phase 075.8 Task 2: universal StatusPill replaces the
                          ad-hoc Loader2/Square/CheckCircle2 status indicator. */}
                      <StatusPill
                        status={pillStatus(tc.status)}
                        duration={
                          tc.startedAt != null && tc.endedAt != null
                            ? tc.endedAt - tc.startedAt
                            : undefined
                        }
                      />
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

                    {/* Phase 076.1 D-10: Google atomic args honest UX — when no
                        tool_args_progress events fire (atomic delivery), show
                        "Waiting for model..." instead of empty panel or stale
                        byte-count badge. Visible only during preparing state
                        with no argsCodeText and no argsBytesStreamed. */}
                    {tc.status === "preparing" && (!tc.argsCodeText || tc.argsCodeText.length === 0) && (tc.argsBytesStreamed == null || tc.argsBytesStreamed === 0) && (
                      <div className="px-3 py-2 text-xs text-muted-foreground flex items-center gap-2">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span>Waiting for model...</span>
                      </div>
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
                    {tc.status === "preparing" && tc.argsCodeText && tc.argsCodeText.length > 0 && tc.argsBytesStreamed != null && (() => {
                      // Phase 075.9 T3: panelExpanded Record key now uses
                      // clientKey (stable across preparing→running). The
                      // `tc.id ?? `idx-${i}`` fallback covers DB-loaded
                      // historical messages and in-flight test fixtures
                      // that pre-date the T2 stamp — REMOVE after migration
                      // window.
                      const panelKey = tc.clientKey ?? tc.id ?? `idx-${i}`
                      // Phase 075.9 T4: for execute_code preparing, suppress
                      // the panel body — the Shiki editor inset below owns
                      // the body now (seamless preparing→running handoff,
                      // no plain-pre → highlighted blink). The header
                      // "Generating code… (X.X KB)" affordance stays so the
                      // byte counter is still glanceable.
                      // Phase 076.1: isExecuteCode was dead code — execute_code
                      // is routed to TOOL_BODIES.execute_code at line 573-588
                      // and never reaches this else branch. Simplified to
                      // always use toolLabel(tc.name). D-08: surface
                      // tc.args.description when available.
                      const isExecuteCode = tc.name === "execute_code"
                      return (
                        <ToolArgsLivePanel
                          title={
                            tc.args?.description
                              ? `Generating ${toolLabel(tc.name)}: ${tc.args.description}`
                              : `Generating ${toolLabel(tc.name)}…`
                          }
                          contentText={tc.argsCodeText!}
                          byteCount={tc.argsBytesStreamed!}
                          expanded={panelExpanded[panelKey] ?? (i === lastPreparingIndex)}
                          onToggle={() => togglePanel(panelKey, i === lastPreparingIndex)}
                          hideBody={isExecuteCode}
                        />
                      )
                    })()}

                    {/* Phase 075.9 T4: live Shiki editor inset during
                        execute_code preparing. ExecuteCodeEditorInset reads
                        tc.argsCodeText ?? tc.args.code internally, so the
                        same inset mounts here (preparing) and inside
                        ExecuteCodeBody (running/done) — byte-identical
                        content at the tool_start transition means no
                        re-mount, no flash, no re-flow. The Suspense
                        fallback inside the inset shows a plain-pre with
                        the same font metrics, so even the WASM-load
                        moment doesn't shift the row. */}
                    {tc.status === "preparing" && tc.name === "execute_code" && tc.argsCodeText && tc.argsCodeText.length > 0 && (
                      <ExecuteCodeEditorInset tc={tc} />
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
                </StepRow>
                {/* Phase 075.8 Task 3 (sketch 002 D6): bottom progress shimmer
                    on every active tool — both the execute_code branch and the
                    generic-tool branch. Absolute-positioned against the
                    .tc-active-wrap parent so it sits at the bottom edge
                    without affecting layout. Top progress is reserved for the
                    run-card header (sketch D6 — avoid double-shimmer noise). */}
                {isToolActive && (
                  <div
                    className="tool-progress-bar absolute bottom-0 left-0 right-0"
                    data-testid="tc-bottom-shimmer"
                  />
                )}
              </div>
            )
          })}
    </div>
  )
}
