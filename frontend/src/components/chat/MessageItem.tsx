import { useRef } from "react"
import { Bot, Loader2, RotateCcw, Square, User, Zap } from "lucide-react"
import type { Message } from "@/types"
import { Button } from "@/components/ui/button"
import { ToolCallPanel } from "./ToolCallPanel"
import { MarkdownRenderer } from "./MarkdownRenderer"
import { ConfidenceBadge } from "./ConfidenceBadge"
import { CitationList } from "./CitationList"
import { SuggestionPills } from "./SuggestionPills"
import { MessageFeedback } from "./MessageFeedback"
import { toolLabel, toolSummary, outerBannerLabel } from "@/lib/toolMeta"

interface Props {
  message: Message
  isStreaming?: boolean
  onSendMessage?: (content: string) => void
  /** Phase 063 (Pattern 4 / D-063-04): handler for the Resume button shown only on failed assistant runs. */
  onResume?: (message: Message) => void
}

export function MessageItem({ message, isStreaming, onSendMessage, onResume }: Props) {
  const isUser = message.role === "user"

  if (isUser) {
    return (
      <div className="flex justify-end py-2 animate-fadeSlideUp" data-testid="user-message">
        <div className="flex items-end gap-2.5 max-w-[70%]">
          <div className="gradient-primary text-white rounded-2xl rounded-br-md px-4 py-2.5 text-sm leading-relaxed shadow-sm">
            <p className="whitespace-pre-wrap break-words">{message.content}</p>
          </div>
          <div className="flex-shrink-0 w-7 h-7 rounded-full bg-muted border border-border/50 flex items-center justify-center mb-0.5">
            <User className="w-3.5 h-3.5 text-foreground/70" />
          </div>
        </div>
      </div>
    )
  }

  const hasRunningTools = message.tool_calls?.some((tc) => tc.status === "running") ?? false
  const hasAnyTools = (message.tool_calls?.length ?? 0) > 0
  const allToolsDone = hasAnyTools && !hasRunningTools
  // Phase 067.1 Plan 02: extend activeTool to include "preparing" so outerBannerLabel
  // can render the ~2s sandbox-warmup copy ("Preparing code…") before tool_start fires.
  // Mirror of ToolCallPanel.tsx:540 active-tool detection (PATTERNS.md).
  const activeTool = message.tool_calls?.find(
    (tc) => tc.status === "running" || tc.status === "preparing"
  ) ?? null

  // Label shown when the agent is actively running a tool alongside existing content
  const activeToolLabel = activeTool
    ? (() => {
        const summary = toolSummary(activeTool.name, activeTool.args)
        return summary
          ? `${toolLabel(activeTool.name)} — "${summary}"`
          : `${toolLabel(activeTool.name)}…`
      })()
    : null

  // Phase 075 D-075-14 (a) — BUG-260514-03 sticky bottom-indicator text.
  // outerBannerLabel(activeTool, hasAnyTools, …) can transiently return null
  // between macro-state transitions inside a long tool call (notably during
  // a silent matplotlib render window where no fresh state-change event arrives
  // — the prior 169-second chart cell repro). Without retention the bottom
  // indicator clears to blank and the user reads "stuck."
  //
  // Behavior: while isStreaming, retain the last non-null computed label and
  // render it when computedLabel is null. On terminal (isStreaming === false)
  // reset the sticky ref so the next stream starts fresh.
  //
  // Part (b) of D-075-14 — re-anchor on code_stdout — is covered implicitly:
  // each new code_stdout SSE event mutates the active tool_call's outputLines
  // (StreamsProvider.tsx:310-322 onCodeStdout handler), which re-renders
  // MessageItem; the recompute below picks up activeTool and refreshes the
  // sticky text. No explicit subscription needed in this component — the
  // tool-call mutation IS the subscription.
  const stickyLabelRef = useRef<string | null>(null)
  const computedLabel = isStreaming
    ? outerBannerLabel(activeTool, hasAnyTools, message.isPlanning ?? false)
    : null
  if (isStreaming && computedLabel !== null) {
    stickyLabelRef.current = computedLabel
  } else if (!isStreaming) {
    stickyLabelRef.current = null
  }
  const stickyBottomLabel: string | null = isStreaming
    ? (computedLabel ?? stickyLabelRef.current)
    : message.runStatus === "timed_out"
      ? "Agent reached time limit"
      : message.runStatus === "cancelled" || message.stopped
        ? "Response stopped"
        : null

  return (
    <div
      className="group flex gap-3 py-3 animate-fadeSlideUp"
      data-testid="assistant-message"
      data-streaming={isStreaming ? "true" : "false"}
    >
      {/* Phase 068.5 (D-068.5-05..07 + L-068.5-04 + RESEARCH §Finding #8):
          Pulse fires ONLY on runStatus === 'streaming' — the literal value
          from the 5-value codebase enum (NOT 'running' or 'queued' which do
          not exist). Resume button gate at lines 109-120 uses 'failed' ||
          'timed_out'; mutual exclusivity is structural (enum is one value
          at a time). Pattern S1 enum-conditional render. */}
      <div
        data-testid="assistant-bot-icon"
        className={`flex-shrink-0 w-8 h-8 rounded-full gradient-primary flex items-center justify-center mt-0.5 shadow-sm shadow-primary/20${message.runStatus === "streaming" ? " animate-brandPulse" : ""}`}
      >
        <Bot className="w-4 h-4 text-white" />
      </div>
      <div className="flex-1 min-w-0 pt-0.5">
        {message.tool_calls && message.tool_calls.length > 0 && (
          <ToolCallPanel
            toolCalls={message.tool_calls}
            subAgent={message.sub_agent}
            isPlanning={message.isPlanning}
            iterationCount={message.iterationCount}
            activatedSkills={message.activatedSkills}
          />
        )}
        {message.activatedSkill && (
          <div className="flex items-center gap-1.5 mt-2 text-xs text-primary animate-fadeSlideUp">
            <Zap className="h-3 w-3" />
            <span>Skill activated: {message.activatedSkill}</span>
          </div>
        )}
        {message.content ? (
          <div className="text-sm text-foreground">
            <MarkdownRenderer content={message.content} />
            {isStreaming && !hasRunningTools && (
              <span className="inline-block w-2 h-4 ml-0.5 bg-primary/50 animate-pulse rounded-sm align-text-bottom" />
            )}
            {message.confidence && <ConfidenceBadge confidence={message.confidence} />}
            {message.citations && message.citations.length > 0 && (
              <CitationList citations={message.citations} />
            )}
            {!isStreaming && message.suggestions && message.suggestions.length > 0 && onSendMessage && (
              <SuggestionPills
                questions={message.suggestions}
                onSelect={onSendMessage}
              />
            )}
            {!isStreaming && message.role === "assistant" && message.content && (
              <MessageFeedback messageId={message.id} />
            )}
            {/* Phase 063 (Pattern 4 / D-063-04) + Phase 066 D-066-09: Resume
                button on failed OR timed_out runs. Surfaces when runStatus
                ∈ {failed, timed_out} — never on cancelled (user explicitly
                stopped), completed, streaming, or undefined (DB-loaded
                historical messages without run metadata). Same onResume
                callback re-POSTs the original prompt with full conversation
                context (today's failed-state Resume code path). */}
            {!isStreaming && message.role === "assistant" && (message.runStatus === "failed" || message.runStatus === "timed_out") && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onResume?.(message)}
                className="mt-2 text-xs"
                aria-label="Resume run"
              >
                <RotateCcw className="w-3 h-3 mr-1.5" />
                Resume
              </Button>
            )}
          </div>
        ) : isStreaming && !hasAnyTools ? (
          // No tools yet — first LLM call is thinking
          <span className="flex items-center gap-2 text-muted-foreground text-sm animate-fadeSlideUp">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            <span className="italic">{outerBannerLabel(null, false, message.isPlanning ?? false)}</span>
            <span className="flex gap-1 items-center">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-dotBounce" style={{ animationDelay: "0ms" }} />
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-dotBounce" style={{ animationDelay: "160ms" }} />
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-dotBounce" style={{ animationDelay: "320ms" }} />
            </span>
          </span>
        ) : hasAnyTools ? (
          // Tools ran but no text yet — show whether we're still working or waiting
          // Shown regardless of isStreaming so SSE drops don't cause a blank
          <span className="flex items-center gap-2 text-muted-foreground text-sm mt-1.5 animate-fadeSlideUp">
            {isStreaming && <Loader2 className="w-3.5 h-3.5 animate-spin text-primary flex-shrink-0" />}
            {/* Phase 075 D-075-14 / BUG-260514-03: stickyBottomLabel retains the
                last non-null label across silent windows inside long tool calls
                (matplotlib renders, sandbox time.sleep, etc.) so the bottom
                indicator no longer goes blank. Computed above the JSX —
                see stickyLabelRef comment block. */}
            <span className="italic">{stickyBottomLabel}</span>
            {isStreaming && (
              <span className="flex gap-1 items-center">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-dotBounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-dotBounce" style={{ animationDelay: "160ms" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-dotBounce" style={{ animationDelay: "320ms" }} />
              </span>
            )}
          </span>
        ) : null}
        {/* Phase 066 D-066-10: stopped/timed-out indicator — shown after content
            when the run ended without completing. Banner copy mirrors the
            in-content banner switch (lines 130-145): runStatus === 'timed_out'
            renders "Agent reached time limit"; otherwise (cancelled or legacy
            stopped rows pre-D-063.1-15) renders "Response stopped". Without
            this dual update, a timed_out run with content would show
            contradictory copy (in-content banner suppressed because content
            present; bottom indicator says "Response stopped"). */}
        {(message.stopped || message.runStatus === "timed_out") && !isStreaming && (
          <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
            <Square className="w-3 h-3" />
            <span className="italic">
              {message.runStatus === "timed_out" ? "Agent reached time limit" : "Response stopped"}
            </span>
          </div>
        )}
        {/* Active tool indicator — shown below content when a tool is running alongside text */}
        {isStreaming && hasRunningTools && message.content && (
          <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground animate-fadeSlideUp">
            <Loader2 className="w-3 h-3 animate-spin text-primary flex-shrink-0" />
            <span className="italic truncate">{activeToolLabel ?? "Working…"}</span>
          </div>
        )}
        {/* Between-round planning indicator */}
        {isStreaming && message.isPlanning && !hasRunningTools && message.content && (
          <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground animate-fadeSlideUp">
            <Loader2 className="w-3 h-3 animate-spin text-primary flex-shrink-0" />
            <span className="italic">Thinking…</span>
          </div>
        )}
      </div>
    </div>
  )
}
