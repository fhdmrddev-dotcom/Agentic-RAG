import { Bot, Loader2, User } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Message } from "@/types"

interface Props {
  message: Message
  isStreaming?: boolean
}

export function MessageItem({ message, isStreaming }: Props) {
  const isUser = message.role === "user"

  return (
    <div className={cn("flex items-end gap-2", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary flex items-center justify-center">
          <Bot className="w-4 h-4 text-primary-foreground" />
        </div>
      )}
      <div
        className={cn(
          "max-w-[75%] rounded-2xl px-4 py-2 text-sm",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-foreground",
        )}
      >
        {isStreaming && !isUser && message.content === "" ? (
          <span className="flex items-center gap-2 text-foreground/50 italic">
            <Loader2 className="w-4 h-4 animate-spin" />
            Thinking…
          </span>
        ) : (
          <>
            <p className="whitespace-pre-wrap break-words">{message.content}</p>
            {isStreaming && !isUser && (
              <span className="inline-block w-2 h-4 ml-1 bg-foreground/50 animate-pulse rounded-sm" />
            )}
          </>
        )}
      </div>
      {isUser && (
        <div className="flex-shrink-0 w-7 h-7 rounded-full bg-muted flex items-center justify-center">
          <User className="w-4 h-4 text-foreground" />
        </div>
      )}
    </div>
  )
}
