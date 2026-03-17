import { Bot, Loader2, User } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Message } from "@/types"

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
        {isStreaming && message.content === "" ? (
          <span className="flex items-center gap-2 text-muted-foreground italic text-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            Thinking…
          </span>
        ) : (
          <div className={cn("text-sm leading-relaxed text-foreground")}>
            <p className="whitespace-pre-wrap break-words">{message.content}</p>
            {isStreaming && (
              <span className="inline-block w-2 h-4 ml-1 bg-foreground/40 animate-pulse rounded-sm align-text-bottom" />
            )}
          </div>
        )}
      </div>
    </div>
  )
}
