import { useEffect, useLayoutEffect, useRef } from "react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { MessageItem } from "./MessageItem"
import { MessageSkeleton } from "./MessageSkeleton"
import type { Message } from "@/types"

interface Props {
  messages: Message[]
  isStreaming: boolean
  /** Phase 068.5 Gap-01: true when loadMessages is in flight for the active
   *  thread. Gates the cold-load skeleton so new/empty threads without a
   *  pending fetch don't render misleading shimmer. */
  isLoading?: boolean
  onSendMessage?: (content: string) => void
  showSuggestions?: boolean
  /** Phase 063 (Pattern 4 / D-063-04): forwarded to MessageItem; clicked from the Resume button on failed-run assistant bubbles. */
  onResume?: (message: Message) => void
}

export function MessageList({ messages, isStreaming, isLoading = false, onSendMessage, showSuggestions, onResume }: Props) {
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
      if (isNearBottomRef.current) {
        // Priority: scroll to active tool panel if one exists (076.1 D-01/D-02),
        // otherwise scroll to bottom. Single effect prevents competing scrollIntoView
        // calls that cause jitter (WR-03).
        const preparingEl = containerRef.current?.querySelector(
          '[data-tool-status="preparing"]'
        ) as HTMLElement | null
        if (isStreaming && preparingEl) {
          preparingEl.scrollIntoView({ behavior: "smooth", block: "nearest" })
        } else {
          bottomRef.current?.scrollIntoView({
            behavior: isStreaming ? "instant" : "smooth",
          })
        }
      }
    } else if (isStreaming && isNearBottomRef.current) {
      const preparingEl = containerRef.current?.querySelector(
        '[data-tool-status="preparing"]'
      ) as HTMLElement | null
      if (preparingEl) {
        preparingEl.scrollIntoView({ behavior: "smooth", block: "nearest" })
      } else {
        bottomRef.current?.scrollIntoView({ behavior: "instant" })
      }
    }
  }, [messages, isStreaming])

  return (
    <ScrollArea className="flex-1">
      <div ref={containerRef} className="space-y-1 px-6 py-6 max-w-4xl mx-auto">
        {/* Phase 068.5 (D-068.5-11 + D-068.5-12): cold-load skeleton placeholder
            when the bucket is empty AND a reconcile fetch is in flight.
            Gap-01 fix: gate on isLoading so new chats / empty threads without
            a pending fetch don't render misleading shimmer (D-068.5-11 was
            originally messages.length===0 only). Clears the instant the first
            message arrives (hydrate or reconcile resolves). */}
        {isLoading && messages.length === 0 ? (
          <MessageSkeleton />
        ) : (
          messages.map((msg, idx) => {
            const isLastAssistant =
              msg.role === "assistant" && idx === messages.length - 1
            return (
              <MessageItem
                key={msg.role === "assistant" && msg.runId ? `run-${msg.runId}` : msg.id}
                message={msg}
                isStreaming={isStreaming && isLastAssistant}
                onSendMessage={showSuggestions && isLastAssistant ? onSendMessage : undefined}
                onResume={onResume}
                isLastAssistant={isLastAssistant}
              />
            )
          })
        )}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  )
}
