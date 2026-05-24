import { memo, useEffect, useRef, useState } from "react"
import { Bot, ChevronDown, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Message } from "@/types"
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
  const shouldAutoCollapse = hasTools && isTerminal

  // Lazy initializer (RESEARCH §4.4):
  //   - DB-loaded historical (terminal + tools): expanded = false
  //   - Live streaming (streaming OR streaming+notools OR terminal-but-notools): expanded = true
  // The useEffect below handles the streaming→terminal live transition.
  const [expanded, setExpanded] = useState(() => !shouldAutoCollapse)

  // One-shot streaming→terminal transition: when SSE flips runStatus from
  // "streaming" to a terminal value AND the turn has tool_calls > 0, fold
  // the body down. wasStreamingRef tracks the previous status so a second
  // collapse doesn't fire after the user has manually expanded a collapsed
  // terminal turn (R-6 + CONTEXT D-05 + D-07).
  const wasStreamingRef = useRef(message.runStatus === "streaming")
  useEffect(() => {
    if (wasStreamingRef.current && isTerminal && hasTools) {
      // This is the one-shot streaming→terminal transition (RESEARCH §4.4).
      // We intentionally use setState in an effect here because the
      // collapse must happen ONCE on the transition, AND we must respect
      // a subsequent user-driven expand (so we can't derive expanded purely
      // from props). The wasStreamingRef guard makes this a one-shot.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setExpanded(false)
    }
    wasStreamingRef.current = message.runStatus === "streaming"
  }, [message.runStatus, hasTools, isTerminal])

  // Header click: CONTEXT D-08 mandates this be a NO-OP while streaming, so
  // the user cannot accidentally hide the live progress they're watching.
  // Once terminal, the header toggles expand/collapse like a normal button.
  const handleHeaderClick = () => {
    if (message.runStatus === "streaming") return  // D-08 no-op
    setExpanded(v => !v)
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
        role="button"
        tabIndex={isStreamingNow ? -1 : 0}
        aria-expanded={expanded}
        onClick={handleHeaderClick}
        onKeyDown={(e) => {
          if (isStreamingNow) return  // D-08: keyboard activation also no-op while streaming
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            setExpanded(v => !v)
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
          onClick={() => setExpanded(true)}
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
        </div>
      )}
    </div>
  )
})

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
