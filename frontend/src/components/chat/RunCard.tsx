import { memo, useEffect, useRef, useState } from "react"
import { Bot, ChevronDown, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Message, ToolCall } from "@/types"
import { ToolCallPanel } from "./ToolCallPanel"
import { outerBannerLabel } from "@/lib/toolMeta"

interface RunCardProps {
  message: Message
  isStreaming?: boolean
}

/**
 * Phase 075.7 RunCard — wrapper for assistant turns with tool_calls.length > 0.
 *
 * Per CONTEXT D-09: MessageItem mounts <RunCard> for tool-bearing turns only.
 *   Pure-text replies render with NO RunCard, NO border.
 * Per CONTEXT D-10: whole-message prop; memoized via React.memo with default
 *   shallow-eq (mirrors MessageItem.tsx:30 — Phase 075.4-04 invariant).
 * Per CONTEXT D-11 (CORRECTED — see RESEARCH §3.2): sticky header uses
 *   `position: sticky; top: 0` against the Radix ScrollArea Viewport that
 *   MessageList.tsx:91 wraps the message list in. No new scroll container
 *   introduced.
 * Per CONTEXT D-12: RunCard owns the TOP sticky header; MessageItem keeps the
 *   BOTTOM stickyLabelRef indicator at MessageItem.tsx:105-120 verbatim.
 *   Two independent sticky surfaces at opposite ends of the message.
 * Per CONTEXT D-07 + SPEC out-of-scope #6: NO new keyframes — reuse
 *   animate-brandPulse, animate-fadeSlideUp, tool-progress-bar, animate-pulseGlow.
 * Per RESEARCH §6: message.content (final assistant answer) renders OUTSIDE
 *   RunCard in MessageItem so the deferred Anthropic terminal-frame bug
 *   (BUG-260514-02) remains re-litigable.
 *
 * Plan 03 (this version) adds (atop Plan 02's visual frame):
 *   - Lazy useState initializer that defaults to collapsed only when terminal
 *     AND has tools — historical DB-loaded turns mount already collapsed.
 *   - useEffect with wasStreamingRef one-shot guard so streaming→terminal
 *     transition auto-collapses live runs (R-6 + CONTEXT D-05/D-07).
 *   - Collapsed-row JSX `[bot icon] Run · N tool calls · ✓ status · duration ▸`
 *     shown when `!expanded && isTerminal && hasTools` (sketch live-run-container
 *     D5 + UI-SPEC §8.2). Click-to-expand restores the full body.
 *   - Header click is a NO-OP while `runStatus === "streaming"` (CONTEXT D-08).
 *   - aria-expanded + role="button" + tabIndex management for keyboard a11y.
 */
export const RunCard = memo(function RunCard({ message, isStreaming }: RunCardProps) {
  const hasTools = (message.tool_calls?.length ?? 0) > 0
  const isStreamingNow = message.runStatus === "streaming"
  // Terminal predicate per RESEARCH §5.4: any non-"streaming" runStatus —
  // including undefined for DB-loaded historical messages — is treated as
  // terminal. The lazy initializer below uses this to mount historical
  // tool-bearing turns already collapsed.
  const isTerminal = !isStreamingNow

  // Pure-derivation collapse model — see 075.7-DEBUG-runstatus-transition.md.
  // Replaces a wasStreamingRef one-shot useEffect that could silently miss the
  // streaming→terminal transition under React 18 batching or temp-id → DB-id
  // remounts. Rules:
  //   - streaming → always show body (D-08: user cannot fold a live run)
  //   - terminal + no tools → show body (no collapse target — R-6 exception)
  //   - terminal + tools → collapsed UNLESS user explicitly expanded via click
  // userExpanded is the user-toggle state; React re-evaluates the derivation
  // on every render. Reset on message.id change so DB-reload remounts get
  // the default-collapsed historical view.
  const [userExpanded, setUserExpanded] = useState(false)
  // Reset user-toggle when message identity changes (e.g., temp-id → DB-id
  // swap on first persistence reconcile). Pattern matches the pre-fix
  // RunCard's setExpanded(false) effect; setState-in-effect is intentional.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setUserExpanded(false) }, [message.id])
  const expanded = isStreamingNow || !hasTools || userExpanded

  // Header click: CONTEXT D-08 mandates this be a NO-OP while streaming, so
  // the user cannot accidentally hide the live progress they're watching.
  // Once terminal, the header toggles expand/collapse like a normal button.
  const handleHeaderClick = () => {
    if (isStreamingNow) return  // D-08 no-op
    setUserExpanded(v => !v)
  }

  // Timer: recompute elapsed seconds every 250ms during streaming.
  // Freezes when streaming ends.
  const startedAtRef = useRef<number | null>(null)
  const [elapsedMs, setElapsedMs] = useState(0)
  useEffect(() => {
    if (!isStreamingNow) return
    if (startedAtRef.current == null) startedAtRef.current = performance.now()
    const id = window.setInterval(() => {
      if (startedAtRef.current != null) {
        setElapsedMs(performance.now() - startedAtRef.current)
      }
    }, 250)
    return () => window.clearInterval(id)
  }, [isStreamingNow])

  const elapsedSeconds = (elapsedMs / 1000).toFixed(1)

  // Header copy is runStatus-aware (075.7-DEBUG fix — Bug A):
  //   - streaming → outerBannerLabel (per-tool active-state taxonomy from
  //     Phase 067.1; fallback "Synthesizing answer…" between tools).
  //   - terminal + tools → static `Run · N tool calls · ✓ done` mirroring the
  //     collapsed-row copy (sketch live-run-container D5 + UI-SPEC §8.2).
  //   - terminal + no tools → just the status word.
  // outerBannerLabel was authored as a streaming-only helper (toolMeta.ts:68);
  // calling it on terminal turns returned the streaming-phase fallback string
  // and is the root cause of the "Synthesizing answer…" persistence bug.
  const lastTool = message.tool_calls?.[message.tool_calls.length - 1] ?? null
  const activeTool =
    lastTool && (lastTool.status === "running" || lastTool.status === "preparing")
      ? lastTool
      : null
  const headerTitle = isStreamingNow
    ? outerBannerLabel(activeTool, hasTools, message.isPlanning ?? false)
    : hasTools
      ? `Run · ${message.tool_calls?.length ?? 0} tool${(message.tool_calls?.length ?? 0) === 1 ? "" : "s"} · ${statusGlyph(message.runStatus)} ${statusWord(message.runStatus)}`
      : statusWord(message.runStatus)

  // Step subtitle: `Step N` derived from the 0-based iterationCount stamped
  // by the iteration_start SSE event (CONTEXT interfaces — display as N+1).
  const stepLabel =
    message.iterationCount != null ? `Step ${message.iterationCount + 1}` : null

  return (
    <div
      data-testid="run-card"
      className={cn(
        "mb-3 rounded-[14px] overflow-hidden max-w-full text-sm transition-all duration-300",
        isStreamingNow
          ? "bg-primary/5 border border-primary/35 shadow-[0_0_24px_hsl(239_100%_82%/0.18)]"
          : "bg-card/80 backdrop-blur-sm border border-border",
      )}
      data-streaming={isStreaming ? "true" : "false"}
    >
      {/* Sticky header — pins against the Radix ScrollArea Viewport that
          MessageList.tsx:91 wraps the message list in (RESEARCH §3.2). */}
      <header
        role="button"
        tabIndex={isStreamingNow ? -1 : 0}
        aria-expanded={expanded}
        onClick={handleHeaderClick}
        onKeyDown={(e) => {
          if (isStreamingNow) return  // D-08: keyboard activation also no-op while streaming
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            setUserExpanded(v => !v)
          }
        }}
        className={cn(
          "sticky top-0 z-10 backdrop-blur-md bg-popover/92 border-b border-border px-4 py-3 flex items-center gap-3",
          !isStreamingNow && "cursor-pointer hover:bg-popover/98 transition-colors",
        )}
      >
        {/* Brand-pulse avatar — mirrors MessageItem.tsx:137 predicate verbatim. */}
        <div
          className={cn(
            "flex-shrink-0 w-8 h-8 rounded-full gradient-primary flex items-center justify-center shadow-sm shadow-primary/20",
            isStreamingNow && "animate-brandPulse",
          )}
        >
          <Bot className="w-4 h-4 text-white" />
        </div>

        {/* Title + subtitle stack. */}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-foreground truncate">
            {headerTitle}
          </div>
          {stepLabel && (
            <div className="text-xs font-mono text-muted-foreground truncate">
              {stepLabel}
            </div>
          )}
        </div>

        {/* Timer — JetBrains Mono via font-mono (UI-SPEC §4). Shown while
            streaming OR when at least one tick was recorded so the final
            elapsed time stays visible briefly after terminal. */}
        {(isStreamingNow || elapsedMs > 0) && (
          <span
            className="text-xs font-mono text-muted-foreground flex-shrink-0 tabular-nums"
            aria-live="polite"
          >
            {elapsedSeconds}s
          </span>
        )}

        {/* Loader spinner during streaming */}
        {isStreamingNow && (
          <Loader2 className="w-4 h-4 animate-spin text-primary flex-shrink-0" />
        )}
      </header>

      {/* Progress shimmer band — existing class from index.css:246-265.
          No new keyframes per UI-SPEC §5.2 + R-7. */}
      {isStreamingNow && <div className="tool-progress-bar" />}

      {/* Plan 03 (R-6 + sketch D5 + UI-SPEC §8.2): Collapsed-row JSX —
          shown when !expanded && terminal && hasTools. Clicking expands the
          body. Uses existing animate-fadeSlideUp (CONTEXT D-07; R-7 — no
          new keyframes). */}
      {!expanded && isTerminal && hasTools && (
        <button
          type="button"
          data-testid="run-card-collapsed"
          onClick={() => setUserExpanded(true)}
          className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-accent/30 transition-colors animate-fadeSlideUp text-sm text-muted-foreground"
          aria-label="Expand run details"
        >
          <Bot className="w-4 h-4 text-primary/60 flex-shrink-0" />
          <span>
            Run · {message.tool_calls?.length ?? 0} tool
            {" "}
            {(message.tool_calls?.length ?? 0) === 1 ? "call" : "calls"}
          </span>
          <span aria-hidden="true">·</span>
          <span>
            {statusGlyph(message.runStatus)} {statusWord(message.runStatus)}
          </span>
          {elapsedMs > 0 && (
            <>
              <span aria-hidden="true">·</span>
              <span className="font-mono">{(elapsedMs / 1000).toFixed(1)}s</span>
            </>
          )}
          <ChevronDown className="w-4 h-4 ml-auto flex-shrink-0" />
        </button>
      )}

      {/* Inner body — existing ToolCallPanel renders the per-tool list,
          narration interleave, step-list collapse-at-3+, active-glow on
          inner tool cards. All preserved verbatim by Plan 01. Plan 03
          gates the body behind `expanded` (true by default for streaming;
          false for terminal+tools turns until user clicks to expand). */}
      {expanded && (
        <div className="p-3">
          <ToolCallPanel
            toolCalls={message.tool_calls ?? []}
            subAgent={message.sub_agent}
            isPlanning={message.isPlanning}
            iterationCount={message.iterationCount}
            activatedSkills={message.activatedSkills}
          />
          {/* Phase 075.8 Task 5 (sketch 001 D4 — Next-up footer).
              While the run is streaming AND there's a forward-look signal
              (planning between iterations, OR the last tool just finished
              and the agent is deciding the next step), render a
              dashed-border row at the bottom of the run body. Per sketch
              live-run-container D4, this completes the past/present/future
              triad: past = result-summary rows, present = active tool +
              header timer, future = this Next-up footer. */}
          {isStreamingNow && shouldShowNextUp(message, activeTool) && (
            <div
              data-testid="next-up-footer"
              className="mx-1 mt-2 flex items-center gap-2 px-3 py-2 border border-dashed border-border rounded-md text-xs font-mono text-muted-foreground"
            >
              <span className="uppercase tracking-wider opacity-60 flex-shrink-0">Next</span>
              <span className="flex-1 truncate">
                {nextHint(message, activeTool)}
              </span>
              <span className="opacity-50 flex-shrink-0">queued</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
})

// Phase 075.8 Task 5 — derive the next-up hint copy from message state.
// Priority:
//   1. While there's an active tool, the active step itself is "now" — don't
//      show a Next: footer (the timer in the header carries the present moment).
//   2. When isPlanning is true (post-tool, pre-next-tool window), show the
//      explicit planning copy.
//   3. Fallback: "deciding next step…" — covers the brief moment between
//      iteration boundaries before isPlanning flips.
function shouldShowNextUp(message: Message, activeTool: ToolCall | null): boolean {
  if (activeTool) return false
  if (message.isPlanning) return true
  // If there's at least one done tool and no active tool, the agent is
  // between iterations — show the deciding placeholder.
  const tools = message.tool_calls ?? []
  if (tools.length === 0) return false
  const lastTool = tools[tools.length - 1]
  return lastTool.status === "done"
}

function nextHint(message: Message, activeTool: ToolCall | null): string {
  if (activeTool) return ""
  if (message.isPlanning) return "planning next step…"
  return "deciding next step…"
}

// File-local helpers — UI-SPEC §8.2 copy contract.
function statusGlyph(s: Message["runStatus"]): string {
  if (s === "completed" || s === undefined) return "✓"
  if (s === "failed") return "✗"
  if (s === "timed_out") return "⏱"
  if (s === "cancelled") return "■"
  return "✓"
}

function statusWord(s: Message["runStatus"]): string {
  if (s === "completed" || s === undefined) return "done"
  if (s === "failed") return "failed"
  if (s === "timed_out") return "timed out"
  if (s === "cancelled") return "cancelled"
  return "done"
}
