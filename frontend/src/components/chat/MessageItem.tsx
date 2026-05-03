import { Bot, Loader2, RotateCcw, Square, User, Zap } from "lucide-react"
import type { Message } from "@/types"
import { Button } from "@/components/ui/button"
import { ToolCallPanel } from "./ToolCallPanel"
import { MarkdownRenderer } from "./MarkdownRenderer"
import { ConfidenceBadge } from "./ConfidenceBadge"
import { CitationList } from "./CitationList"
import { SuggestionPills } from "./SuggestionPills"
import { MessageFeedback } from "./MessageFeedback"
import { toolLabel, toolSummary } from "@/lib/toolMeta"

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
      <div className="flex justify-end py-2 animate-fadeSlideUp">
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
  const activeTool = message.tool_calls?.find((tc) => tc.status === "running")

  // Label shown when the agent is actively running a tool alongside existing content
  const activeToolLabel = activeTool
    ? (() => {
        const summary = toolSummary(activeTool.name, activeTool.args)
        return summary
          ? `${toolLabel(activeTool.name)} — "${summary}"`
          : `${toolLabel(activeTool.name)}…`
      })()
    : null

  return (
    <div className="group flex gap-3 py-3 animate-fadeSlideUp">
      <div className="flex-shrink-0 w-8 h-8 rounded-full gradient-primary flex items-center justify-center mt-0.5 shadow-sm shadow-primary/20">
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
            {/* Phase 063 (Pattern 4 / D-063-04): Resume button on failed runs.
                Surfaces ONLY when runStatus === 'failed' — never on cancelled
                (user explicitly stopped), completed, streaming, or undefined
                (DB-loaded historical messages without run metadata). */}
            {!isStreaming && message.role === "assistant" && message.runStatus === "failed" && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onResume?.(message)}
                className="mt-2 text-xs"
                aria-label="Resume failed run"
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
            <span className="italic">Thinking</span>
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
            <span className="italic">
{isStreaming
                ? (allToolsDone ? "Synthesizing answer" : "Working")
                : message.stopped
                  ? "Response stopped"
                  : "Saving response…"}
            </span>
            {isStreaming && (
              <span className="flex gap-1 items-center">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-dotBounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-dotBounce" style={{ animationDelay: "160ms" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-dotBounce" style={{ animationDelay: "320ms" }} />
              </span>
            )}
          </span>
) : null}
        {/* Stopped indicator — shown after content when user stopped mid-stream */}
        {message.stopped && !isStreaming && (
          <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
            <Square className="w-3 h-3" />
            <span className="italic">Response stopped</span>
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
