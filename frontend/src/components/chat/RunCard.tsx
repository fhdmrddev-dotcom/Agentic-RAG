import { memo, useEffect, useRef, useState } from "react"
import { Bot, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Message } from "@/types"
import { ToolCallPanel } from "./ToolCallPanel"
import { outerBannerLabel } from "@/lib/toolMeta"

interface RunCardProps {
  message: Message
  isStreaming?: boolean
}

/**
 * Phase 075.7 Plan 02 — RunCard wrapper for assistant turns with tool_calls.length > 0.
 *
 * Per CONTEXT D-09: MessageItem mounts <RunCard> for tool-bearing turns only.
 *   Pure-text replies render with NO RunCard, NO border.
 * Per CONTEXT D-10: whole-message prop; memoized via React.memo with default
 *   shallow-eq (mirrors MessageItem.tsx:30 — Phase 075.4-04 invariant).
 * Per CONTEXT D-11 (CORRECTED — see RESEARCH §3.2): sticky header uses
 *   `position: sticky; top: 0` against the Radix ScrollArea Viewport that
 *   MessageList.tsx:91 wraps the message list in. No new scroll container
 *   introduced. Verified that no intermediate transform/overflow ancestor
 *   breaks sticky behavior.
 * Per CONTEXT D-12: RunCard owns the TOP sticky header; MessageItem keeps the
 *   BOTTOM stickyLabelRef indicator at MessageItem.tsx:105-120 verbatim.
 *   Two independent sticky surfaces at opposite ends of the message.
 * Per CONTEXT D-07 + SPEC out-of-scope #6: NO new keyframes — reuse
 *   animate-brandPulse, animate-fadeSlideUp, tool-progress-bar, animate-pulseGlow.
 * Per RESEARCH §6: message.content (final assistant answer) renders OUTSIDE
 *   RunCard in MessageItem so the deferred Anthropic terminal-frame bug
 *   (BUG-260514-02) remains re-litigable. DO NOT pull message.content into
 *   RunCard.
 *
 * NOTE: Plan 02 (this plan) scaffolds the `expanded` state initializer but
 * Plan 03 owns the auto-collapse-on-completion behavior, the collapsed-row
 * summary JSX, and the click-to-expand interaction wire. This plan ships the
 * VISUAL FRAME (sticky header + active glow + timer + counter + brand-pulse
 * avatar + inner ToolCallPanel mount). For Plan 02 we keep `expanded` always
 * true so the body still renders for terminal+tools turns — Plan 03 will land
 * the lazy initializer flip AND the collapsed-row JSX together so the user
 * always has something to click.
 */
export const RunCard = memo(function RunCard({ message, isStreaming }: RunCardProps) {
  const hasTools = (message.tool_calls?.length ?? 0) > 0
  const isStreamingNow = message.runStatus === "streaming"

  // Lazy initializer — Plan 02 ships always-expanded. Plan 03 flips to
  // `!shouldAutoCollapse` AND lands the collapsed-row JSX + streaming→terminal
  // transition effect. See plan-author's discretion note in PLAN.md (action).
  const [expanded] = useState(() => true)

  // Timer: recompute elapsed seconds every 250ms during streaming.
  // Pattern from Phase 56.1 D-03 (ElapsedTimer setInterval(250ms) with cleanup
  // on unmount). Freezes when streaming ends.
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

  // Header copy: outerBannerLabel reuses the existing toolMeta taxonomy
  // (UI-SPEC §8.2). Picks per-tool phrasing when a tool is running/preparing,
  // falls back to "Synthesizing answer…" between tools, "Thinking…" while
  // planning, "Setting up agent…" pre-first-delta.
  const lastTool = message.tool_calls?.[message.tool_calls.length - 1] ?? null
  const activeTool =
    lastTool && (lastTool.status === "running" || lastTool.status === "preparing")
      ? lastTool
      : null
  const headerTitle = outerBannerLabel(activeTool, hasTools, message.isPlanning ?? false)

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
        className="sticky top-0 z-10 backdrop-blur-md bg-popover/92 border-b border-border px-4 py-3 flex items-center gap-3"
      >
        {/* Brand-pulse avatar — mirrors MessageItem.tsx:137 predicate verbatim.
            Per UI-SPEC §6.5 the RunCard sticky-header avatar carries the SAME
            pulse for tool-bearing turns; MessageItem keeps the outer-column
            pulse as a fallback for tool-less turns. */}
        <div
          className={cn(
            "flex-shrink-0 w-8 h-8 rounded-full gradient-primary flex items-center justify-center shadow-sm shadow-primary/20",
            isStreamingNow && "animate-brandPulse",
          )}
        >
          <Bot className="w-4 h-4 text-white" />
        </div>

        {/* Title + subtitle stack. Title = active-state copy (e.g. "Running
            code…"); subtitle = current step. */}
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

      {/* Inner body — existing ToolCallPanel renders the per-tool list,
          narration interleave, step-list collapse-at-3+, active-glow on
          inner tool cards. All preserved verbatim by Plan 01. Plan 03
          will wire the registry-driven `→ {summary}` row on collapsed
          past tools INSIDE ToolCallPanel — RunCard does not own that JSX. */}
      {expanded && (
        <div className="p-3">
          <ToolCallPanel
            toolCalls={message.tool_calls ?? []}
            subAgent={message.sub_agent}
            isPlanning={message.isPlanning}
            iterationCount={message.iterationCount}
            activatedSkills={message.activatedSkills}
          />
        </div>
      )}
    </div>
  )
})
