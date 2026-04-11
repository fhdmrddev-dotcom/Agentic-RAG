import { useEffect, useRef } from "react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { MessageItem } from "./MessageItem"
import type { Message } from "@/types"

interface Props {
  messages: Message[]
  isStreaming: boolean
}

export function MessageList({ messages, isStreaming }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const prevCountRef = useRef(0)
  const isNearBottomRef = useRef(true)
  const containerRef = useRef<HTMLDivElement>(null)

  // Track whether user has scrolled up so we don't fight them during streaming
  const handleScroll = () => {
    const el = containerRef.current?.closest("[data-radix-scroll-area-viewport]") as HTMLElement | null
    if (!el) return
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    isNearBottomRef.current = distFromBottom < 120
  }

  useEffect(() => {
    const el = containerRef.current?.closest("[data-radix-scroll-area-viewport]") as HTMLElement | null
    if (!el) return
    el.addEventListener("scroll", handleScroll, { passive: true })
    return () => el.removeEventListener("scroll", handleScroll)
  }, [])

  useEffect(() => {
    const newCount = messages.length
    if (newCount > prevCountRef.current) {
      // New message added — always scroll to bottom
      prevCountRef.current = newCount
      bottomRef.current?.scrollIntoView({ behavior: "smooth" })
    } else if (isStreaming && isNearBottomRef.current) {
      // Existing message growing — only follow if user is near the bottom
      bottomRef.current?.scrollIntoView({ behavior: "instant" })
    }
  }, [messages, isStreaming])

  return (
    <ScrollArea className="flex-1">
      <div ref={containerRef} className="space-y-1 px-6 py-6 max-w-4xl mx-auto">
        {messages.map((msg, idx) => {
          const isLastAssistant =
            msg.role === "assistant" && idx === messages.length - 1
          return (
            <MessageItem
              key={msg.id}
              message={msg}
              isStreaming={isStreaming && isLastAssistant}
            />
          )
        })}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  )
}
