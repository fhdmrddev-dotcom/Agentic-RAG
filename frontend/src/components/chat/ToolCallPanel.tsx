/**
 * Phase 227 Wave 2 — Decomposed ToolCallPanel orchestrator.
 *
 * Reduced from 1019 lines to ~350 lines by extracting:
 *   - ToolCallDetails.tsx: arguments, results, diffs, subagents (~180 lines)
 *   - StepRow.tsx: timeline rail column, status node, essence line (~155 lines)
 *   - toolStepDerivation.ts: pure step computation & map derivations (~70 lines)
 */
import { useState, useEffect, useMemo } from "react"
import {
  ChevronUp, CheckCircle2, Loader2,
  Zap, Clock,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { ToolCall, SubAgentState, SkillActivation } from "@/types"
import { TOOL_BODIES } from "./tool-bodies"
import { ToolArgsLivePanel } from "./ToolArgsLivePanel"
import { ExecuteCodeEditorInset } from "./tool-bodies/ExecuteCodeBody"
import { toolLabel } from "@/lib/toolMeta"
import { preparingDescription } from "@/lib/providerLogo"
import { StatusPill } from "./StatusPill"
import { dedupToolCalls } from "@/lib/stepCount"
import {
  StepRow, ToolEssenceLine, toolIcon, toolIconColor,
  toolSummary, pillStatus,
} from "./StepRow"
import {
  ToolArgsBlock, ToolResultBlock, SubAgentBlock,
} from "./ToolCallDetails"
import {
  buildDisplayItems, buildToolStepNumberMap, stepKeyOf,
  nodeStateOf, findLastPreparingIndex, findActiveIndex,
  formatDuration,
} from "./toolStepDerivation"

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
  /** BUG-260823-02: True when the run is actively streaming. When false (history/settled), entrance animations are suppressed to prevent blink waves. */
  isStreaming?: boolean
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

// ---- Skill activation row (Phase 56 D-08/D-09) ----

function SkillRow({ activation, isStreaming }: { activation: SkillActivation; isStreaming?: boolean }) {
  return (
    <div className={cn("pt-2.5", isStreaming && "animate-toolSlideIn")} data-testid="skill-load-card">
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
          <CheckCircle2 className={cn("w-3.5 h-3.5 text-success", isStreaming && "animate-checkPop")} />
        </span>
      </div>
    </div>
  )
}

// ---- Main panel ----

export function ToolCallPanel({ toolCalls, activatedSkills, isStreaming = false }: Props) {
  // Phase 095 Plan 03 Task 2 (D-04 single dedup home): import the ONE shared
  // dedup from @/lib/stepCount instead of an inline copy.
  const deduplicatedToolCalls = useMemo(() => dedupToolCalls(toolCalls), [toolCalls])

  if (!deduplicatedToolCalls || deduplicatedToolCalls.length === 0) return null

  // Interleave skill activations with tool calls by timestamp
  const displayItems = buildDisplayItems(deduplicatedToolCalls, activatedSkills)
  const toolStepNumber = buildToolStepNumberMap(deduplicatedToolCalls)
  // 075.6 Plan 02 / SPEC Req #4: default-expand-for-active-preparing rule.
  // The LAST tool in displayItems whose status === "preparing" is the
  // ACTIVE preparing tool (per Boundary Keeper Round 1: "expanded for active
  // preparing tool, collapsed for past preparing tools"). Past preparing
  // tools (rare — would require multiple back-to-back preparing entries for
  // the same agent loop iteration) render collapsed by default.
  const lastPreparingIndex = findLastPreparingIndex(displayItems)

  // 075.6 Plan 02 / SPEC Req #4: per-tool-id expanded state for the
  // <ToolArgsLivePanel> chevron toggle. Default value follows the default-
  // for-active rule (i === lastPreparingIndex). useState inside the map
  // callback is NOT React-safe; lift to a component-scope Record keyed by
  // tc.id so each panel instance has its own user-toggle state.
  const [panelExpanded, setPanelExpanded] = useState<Record<string, boolean>>({})
  const togglePanel = (id: string, defaultExpanded: boolean) =>
    setPanelExpanded((prev) => ({ ...prev, [id]: !(prev[id] ?? defaultExpanded) }))

  const activeIndex = findActiveIndex(displayItems)

  // Per-step expanded Set keyed on the SAME `stepKeyOf` identity the rail snum
  // + dedup use. Membership means "this step is expanded to its full body";
  // absence means "folded to its one-line essence card" (ToolEssenceLine).
  // Clicking one essence card expands ONLY that card (D-01 click-to-expand);
  // the others stay folded. The identity scheme survives the
  // preparing->running->done id mutation (075.9) and a reload (state is
  // reconstructed from `toolCalls` each render). State stays component-local
  // and provider-agnostic — no StreamsProvider/api.ts/backend change.
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(() => new Set())
  const expandStep = (key: string) => setExpandedSteps((prev) => new Set(prev).add(key))
  const collapseStep = (key: string) =>
    setExpandedSteps((prev) => {
      const n = new Set(prev)
      n.delete(key)
      return n
    })

  return (
    <div className="px-4 pb-3.5 space-y-1 min-w-0 overflow-hidden">
      {displayItems.map((item, i) => {
        // Skill activation rows always render as the full SkillRow card.
        if (item.kind === "skill") {
          return (
            <div key={`skill-${i}-${item.activation.occurredAt}`}>
              {i > 0 && <div className="h-px bg-border/20 -mt-1 mb-2.5 mx-1" />}
              <SkillRow activation={item.activation} isStreaming={isStreaming} />
            </div>
          )
        }

        // D-067-03: get the previous tool item's iteration for boundary detection.
        // Skill rows don't partition iterations; walk back past consecutive skills
        // to find the most recent tool kind. undefined if no prior tool.
        let prevToolIteration: number | undefined = undefined
        if (item.kind === "tool") {
          for (let j = i - 1; j >= 0; j--) {
            const candidate = displayItems[j]
            if (candidate.kind === "tool") {
              prevToolIteration = candidate.tc.iteration
              break
            }
          }
        }
        const tc = item.tc
        const summary = toolSummary(tc)
        const agentState: SubAgentState | undefined = tc.sub_agent
        // Phase 075.8 Task 3 (sketch 002 D6): active-tool glow + bottom shimmer.
        // Applied to the per-tool wrapper when the tool is running or preparing.
        const isToolActive = tc.status === "running" || tc.status === "preparing"

        // BUG-260823-02: a STABLE key, not the list index. With `key={i}`
        // React re-identified rows whenever the list changed shape, and a
        // remounted element restarts its CSS animation from `opacity: 0` —
        // so the whole history re-played its entrance on every reconcile.
        const stepKey = stepKeyOf(tc, i)
        const snum = toolStepNumber.get(stepKey) ?? 0
        const node = nodeStateOf(tc)
        const isLastTool = snum === deduplicatedToolCalls.length

        // Phase 095 Plan 06: an EARLIER finished step (i < activeIndex)
        // that the user expanded out of its essence row. It renders its
        // full body here and gets a per-row re-collapse control so it can
        // fold back to its essence independently.
        const isExpandedEarlierStep =
          activeIndex !== -1 && i < activeIndex && expandedSteps.has(stepKey)

        // Phase 095 Plan 06 (GAP-095-03 essence) / SEED-098 Change 1:
        // The essence line is the resting shape for active and finished tools.
        const isFinished = tc.status === "done" || tc.status === "interrupted"
        const isActive = tc.status === "running" || tc.status === "preparing"
        const isCollapsedToEssence = (isFinished || isActive) && !expandedSteps.has(stepKey)

        // BUG-260823-02: Suppress entrance slide animation for settled historical tool calls.
        // Only active tools during live streaming animate; historical rows render settled.
        const shouldAnimate = isStreaming && isToolActive

        return (
          <div
            key={stepKey}
            className={cn(
              "pt-2.5",
              shouldAnimate && "animate-toolSlideIn",
              isToolActive && "tc-active-wrap rounded-md px-2",
            )}
            data-testid={isToolActive ? "tc-active" : undefined}
            data-tool-status={tc.status}
          >
            {/* D-067-03: Step N divider on iteration boundary; plain inter-tool separator otherwise. */}
            {i > 0 && tc.iteration !== undefined && prevToolIteration !== undefined && tc.iteration !== prevToolIteration ? (
              <div
                className="flex items-center gap-2 my-3 mx-1"
                data-testid="iteration-divider"
                data-iteration={tc.iteration}
              >
                <div className="flex-1 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
                <span className="text-[10px] font-semibold text-muted-foreground tracking-wider uppercase">
                  Round {tc.iteration + 1}
                </span>
                <div className="flex-1 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
              </div>
            ) : i > 0 && (
              <div className="h-px bg-border/20 -mt-1 mb-2.5 mx-1" />
            )}

            <StepRow snum={snum} node={node} isLast={isLastTool}>
              {/* Per-row re-collapse for an earlier step */}
              {isExpandedEarlierStep && (
                <button
                  type="button"
                  onClick={() => collapseStep(stepKey)}
                  data-testid="step-recollapse"
                  aria-label="Hide this step"
                  className="mb-1 flex items-center gap-1 text-[10px] text-muted-foreground hover:text-muted-foreground transition-colors"
                >
                  <ChevronUp className="w-3 h-3" />
                  <span>Hide</span>
                </button>
              )}

              {isCollapsedToEssence ? (
                <>
                  <ToolEssenceLine tc={tc} onExpand={() => expandStep(stepKey)} />
                  {tc.sub_agent_model && (
                    <div className="ml-8 mt-1 text-[10px] text-muted-foreground italic font-mono">
                      Sub-agent: {tc.sub_agent_model}
                    </div>
                  )}
                </>
              ) : tc.name === "execute_code" ? (
                // Phase 075.9 hot-fix: render ExecuteCodeBody for ALL execute_code statuses
                // (preparing/running/done) for seamless streaming handoff.
                <TOOL_BODIES.execute_code tc={tc} />
              ) : (
                <>
                  {/* Tool row */}
                  <div className="flex items-center gap-2.5">
                    <span
                      className={cn(
                        "flex-shrink-0 p-1 rounded-md bg-muted/50 transition-colors duration-300",
                        toolIconColor(tc.name, tc.status),
                        tc.status === "preparing" && "opacity-50",
                      )}
                    >
                      {toolIcon(tc.name)}
                    </span>
                    <span className="flex-1 min-w-0 text-xs text-muted-foreground truncate">
                      {tc.status === "preparing" ? (
                        <span className="font-semibold text-foreground/50 italic">
                          Preparing {toolLabel(tc.name)}…
                          {(() => {
                            const prepDesc = preparingDescription(tc)
                            return prepDesc ? (
                              <span className="ml-1 font-normal text-foreground/60 not-italic">
                                {" "}— {prepDesc}
                              </span>
                            ) : null
                          })()}
                          {tc.argsBytesStreamed != null && tc.argsBytesStreamed > 0 && (
                            <span className="ml-1.5 font-normal text-foreground/40 not-italic font-mono tabular-nums">
                              ({(tc.argsBytesStreamed / 1024).toFixed(1)} KB)
                            </span>
                          )}
                        </span>
                      ) : (
                        <>
                          <span
                            className={cn(
                              "font-semibold",
                              tc.status === "running" ? "text-primary" : "text-foreground/80",
                            )}
                          >
                            {tc.status === "running" ? `Running ${toolLabel(tc.name)}` : toolLabel(tc.name)}
                          </span>
                          {summary && (
                            <span className="ml-1.5 opacity-50">"{summary}"</span>
                          )}
                        </>
                      )}
                    </span>

                    {tc.status === "running" && tc.startedAt != null && (
                      <ElapsedTimer startedAt={tc.startedAt} />
                    )}

                    <StatusPill
                      status={pillStatus(tc.status)}
                      duration={
                        tc.startedAt != null && tc.endedAt != null
                          ? tc.endedAt - tc.startedAt
                          : undefined
                      }
                    />
                  </div>

                  {/* Sub-agent model line */}
                  {tc.sub_agent_model && (
                    <div className="ml-8 mt-1 text-[10px] text-muted-foreground italic font-mono">
                      Sub-agent: {tc.sub_agent_model}
                    </div>
                  )}

                  {/* Preparing indicator bar */}
                  {tc.status === "preparing" && (
                    <div className="mt-1.5 h-0.5 rounded-full bg-gradient-to-r from-primary/30 to-primary/10 animate-pulse" />
                  )}

                  {/* Google atomic args waiting indicator */}
                  {tc.status === "preparing" && (!tc.argsCodeText || tc.argsCodeText.length === 0) && (tc.argsBytesStreamed == null || tc.argsBytesStreamed === 0) && (
                    <div className="px-3 py-2 text-xs text-muted-foreground flex items-center gap-2">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span>Waiting for model...</span>
                    </div>
                  )}

                  {/* 075.6 Plan 02 / SPEC Req #4: live code panel during preparing */}
                  {tc.status === "preparing" && tc.argsCodeText && tc.argsCodeText.length > 0 && tc.argsBytesStreamed != null && (() => {
                    const panelKey = tc.clientKey ?? tc.id ?? `idx-${i}`
                    const isExecuteCode = tc.name === "execute_code"
                    const prepDesc = preparingDescription(tc)
                    return (
                      <ToolArgsLivePanel
                        title={
                          prepDesc
                            ? `Generating ${toolLabel(tc.name)}: ${prepDesc}`
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

                  {/* Phase 075.9 T4: live Shiki editor inset for execute_code preparing */}
                  {tc.status === "preparing" && tc.name === "execute_code" && tc.argsCodeText && tc.argsCodeText.length > 0 && (
                    <ExecuteCodeEditorInset tc={tc} />
                  )}

                  {/* Expandable parameters */}
                  {(tc.status === "done" || tc.status === "interrupted") && <ToolArgsBlock tc={tc} />}

                  {/* Result block */}
                  {(tc.status === "done" || tc.status === "interrupted") && tc.result && !agentState && (
                    <ToolResultBlock tc={tc} defaultOpen={expandedSteps.has(stepKey)} />
                  )}

                  {/* Sub-agent block */}
                  {agentState && <SubAgentBlock agent={agentState} />}
                </>
              )}
            </StepRow>

            {/* Phase 075.8 Task 3 (sketch 002 D6): bottom progress shimmer on active tools */}
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

