import { Bot, Loader2, User, Zap } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Message } from "@/types"
import { ToolCallPanel } from "./ToolCallPanel"
import { MarkdownRenderer } from "./MarkdownRenderer"
import { SourceReferences } from "./SourceReferences"

interface Props {
  message: Message
  isStreaming?: boolean
}

export function MessageItem({ message, isStreaming }: Props) {
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

  return (
    <div className="flex gap-3 py-3 animate-fadeSlideUp">
      <div className="flex-shrink-0 w-8 h-8 rounded-full gradient-primary flex items-center justify-center mt-0.5 shadow-sm shadow-primary/20">
        <Bot className="w-4 h-4 text-white" />
      </div>
      <div className="flex-1 min-w-0 pt-0.5">
        {message.tool_calls && message.tool_calls.length > 0 && (
          <ToolCallPanel toolCalls={message.tool_calls} subAgent={message.sub_agent} />
        )}
        {message.activatedSkill && (
          <div className="flex items-center gap-1.5 mt-2 text-xs text-primary animate-fadeSlideUp">
            <Zap className="h-3 w-3" />
            <span>Skill activated: {message.activatedSkill}</span>
          </div>
        )}
        {isStreaming && message.content === "" && (!message.tool_calls || message.tool_calls.length === 0) ? (
          <span className="flex items-center gap-2 text-muted-foreground text-sm animate-fadeSlideUp">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            <span className="italic">Thinking</span>
            <span className="flex gap-1 items-center">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-dotBounce" style={{ animationDelay: "0ms" }} />
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-dotBounce" style={{ animationDelay: "160ms" }} />
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-dotBounce" style={{ animationDelay: "320ms" }} />
            </span>
          </span>
        ) : isStreaming && message.content === "" && message.tool_calls && message.tool_calls.length > 0 && message.tool_calls.every((tc) => tc.status === "done") ? (
          <span className="flex items-center gap-2 text-muted-foreground text-sm mt-1.5 animate-fadeSlideUp">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
            <span className="italic">Generating response</span>
            <span className="flex gap-1 items-center">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-dotBounce" style={{ animationDelay: "0ms" }} />
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-dotBounce" style={{ animationDelay: "160ms" }} />
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-dotBounce" style={{ animationDelay: "320ms" }} />
            </span>
          </span>
        ) : message.content ? (
          <div className="text-sm text-foreground">
            <MarkdownRenderer content={message.content} />
            {isStreaming && !hasRunningTools && (
              <span className="inline-block w-2 h-4 ml-0.5 bg-primary/50 animate-pulse rounded-sm align-text-bottom" />
            )}
            {message.sources && message.sources.length > 0 && (
              <SourceReferences sources={message.sources} />
            )}
          </div>
        ) : null}
        {isStreaming && hasRunningTools && message.content && (
          <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground animate-fadeSlideUp">
            <span className="flex gap-1 items-center">
              <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-dotBounce" style={{ animationDelay: "0ms" }} />
              <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-dotBounce" style={{ animationDelay: "160ms" }} />
              <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-dotBounce" style={{ animationDelay: "320ms" }} />
            </span>
            <span className="italic">Agent is working</span>
          </div>
        )}
      </div>
    </div>
  )
}
