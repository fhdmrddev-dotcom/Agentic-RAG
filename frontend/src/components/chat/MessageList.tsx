import { useEffect, useLayoutEffect, useRef } from "react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { MessageItem } from "./MessageItem"
import type { Message } from "@/types"

interface Props {
  messages: Message[]
  isStreaming: boolean
  onSendMessage?: (content: string) => void
  showSuggestions?: boolean
  /** Phase 063 (Pattern 4 / D-063-04): forwarded to MessageItem; clicked from the Resume button on failed-run assistant bubbles. */
  onResume?: (message: Message) => void
}

export function MessageList({ messages, isStreaming, onSendMessage, showSuggestions, onResume }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const prevCountRef = useRef(0)
  const isNearBottomRef = useRef(true)
  const containerRef = useRef<HTMLDivElement>(null)
  // BL-05 fix: track whether the scroll listener has actually attached.
  // Until it has, we cannot trust isNearBottomRef.current — it would stay
  // at its initial `true` and the auto-follow would fight a user who has
  // scrolled up. (Symptom: smooth scroll → instant snap → smooth scroll
  // during reconcile + send.)
  const scrollListenerAttachedRef = useRef(false)

  // Track whether user has scrolled up so we don't fight them during streaming
  const handleScroll = () => {
    const el = containerRef.current?.closest("[data-radix-scroll-area-viewport]") as HTMLElement | null
    if (!el) return
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    isNearBottomRef.current = distFromBottom < 120
  }

  // BL-05 fix: useLayoutEffect + retry — the Radix ScrollArea viewport may
  // not be in the DOM on the first render pass; useEffect's lookup returns
  // null and the listener never attaches. Use useLayoutEffect to run before
  // paint and retry on the next animation frame if the viewport isn't
  // mounted yet.
  useLayoutEffect(() => {
    let cleanup: (() => void) | null = null
    let cancelled = false
    const tryAttach = () => {
      if (cancelled) return
      const el = containerRef.current?.closest("[data-radix-scroll-area-viewport]") as HTMLElement | null
      if (!el) {
        // Viewport not mounted yet — try again next frame.
        requestAnimationFrame(tryAttach)
        return
      }
      el.addEventListener("scroll", handleScroll, { passive: true })
      scrollListenerAttachedRef.current = true
      cleanup = () => {
        el.removeEventListener("scroll", handleScroll)
        scrollListenerAttachedRef.current = false
      }
    }
    tryAttach()
    return () => {
      cancelled = true
      cleanup?.()
    }
  }, [])

  useEffect(() => {
    const newCount = messages.length
    if (newCount > prevCountRef.current) {
      prevCountRef.current = newCount
      // BL-05 fix: only auto-scroll when the user is actually near the
      // bottom (or the listener hasn't attached yet so we have no signal —
      // the initial-render case where defaulting to scroll feels right).
      // Use "instant" while streaming to avoid the smooth→instant→smooth
      // visual jitter on every reconcile / token tick.
      if (isNearBottomRef.current) {
        bottomRef.current?.scrollIntoView({
          behavior: isStreaming ? "instant" : "smooth",
        })
      }
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
              onSendMessage={showSuggestions && isLastAssistant ? onSendMessage : undefined}
              onResume={onResume}
            />
          )
        })}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  )
}
