import { Bot, Loader2, User } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Message } from "@/types"
import { ToolCallPanel } from "./ToolCallPanel"
import { MarkdownRenderer } from "./MarkdownRenderer"

interface Props {
  message: Message
  isStreaming?: boolean
}

export function MessageItem({ message, isStreaming }: Props) {
  const isUser = message.role === "user"

  if (isUser) {
    return (
      <div className="flex justify-end py-2">
        <div className="flex items-end gap-2 max-w-[70%]">
          <div className="bg-primary text-primary-foreground rounded-2xl rounded-br-sm px-4 py-2.5 text-sm leading-relaxed">
            <p className="whitespace-pre-wrap break-words">{message.content}</p>
          </div>
          <div className="flex-shrink-0 w-7 h-7 rounded-full bg-muted border flex items-center justify-center mb-0.5">
            <User className="w-3.5 h-3.5 text-foreground" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex gap-3 py-3">
      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary flex items-center justify-center mt-0.5">
        <Bot className="w-3.5 h-3.5 text-primary-foreground" />
      </div>
      <div className="flex-1 min-w-0 pt-0.5">
        {message.tool_calls && message.tool_calls.length > 0 && (
          <ToolCallPanel toolCalls={message.tool_calls} subAgent={message.sub_agent} />
        )}
        {isStreaming && message.content === "" && (!message.tool_calls || message.tool_calls.length === 0) ? (
          <span className="flex items-center gap-2 text-muted-foreground italic text-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            Thinking…
          </span>
        ) : isStreaming && message.content === "" && message.tool_calls && message.tool_calls.length > 0 && message.tool_calls.every((tc) => tc.status === "done") ? (
          <span className="flex items-center gap-2 text-muted-foreground italic text-sm mt-1">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Generating response…
          </span>
        ) : message.content ? (
          <div className="text-sm text-foreground">
            <MarkdownRenderer content={message.content} />
            {isStreaming && (
              <span className="inline-block w-2 h-4 ml-0.5 bg-foreground/40 animate-pulse rounded-sm align-text-bottom" />
            )}
          </div>
        ) : null}
      </div>
    </div>
  )
}
