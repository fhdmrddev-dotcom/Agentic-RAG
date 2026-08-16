import { useEffect, useLayoutEffect, useRef } from "react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { MessageItem } from "./MessageItem"
import { MessageSkeleton } from "./MessageSkeleton"
import { RunStatusStrip } from "./RunStatusStrip"
import { ThreadRunLine } from "./ThreadRunLine"
import { useFollowScroll } from "@/hooks/useFollowScroll"
import { unifiedStepCount } from "@/lib/stepCount"
import { dedupMessagesByRunId } from "@/lib/dedupMessages"
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
  /**
   * Phase 194.1 Plan 06 (RUN-01 / D-15) — the ONE prop this plan adds, and the only
   * movement its D-03 stop condition allows on this interface.
   *
   * It exists so `ThreadRunLine` can be mounted at LIST level rather than inside the
   * transcript. That placement is the decision, not an implementation detail: after
   * plan 03 a HARNESS run inserts no assistant node at all, so there is no message for
   * a run reading to hang off — and the returning reading must survive a stop that has
   * already NULLed `threads.active_workflow_run_id`.
   *
   * Optional and nullable on purpose. Every existing call site keeps working, and a
   * `null` thread renders nothing and buys no round trip (asserted, not assumed).
   */
  threadId?: string | null
}

/**
 * Phase 095 Plan 04 (D-06 hybrid) — the floating chip's compact elapsed.
 *
 * Honest start-ts derivation mirroring RunCard's D-06 `formatElapsed`: elapsed =
 * now - Date.parse(created_at), recomputed at render (the streaming cadence
 * re-renders this each token via the messages-ref change). `Xm Ys` once a run
 * crosses a minute so a long Kimi/Moonshot run never reads an unwieldy 192.4s.
 * Returns null when the start-ts is unparseable (never NaN — the strip then
 * shows no elapsed).
 */
function formatFloatingElapsed(createdAt: string | undefined): string | null {
  if (!createdAt) return null
  const startMs = Date.parse(createdAt)
  if (!Number.isFinite(startMs)) return null
  const elapsedS = Math.max(0, (Date.now() - startMs) / 1000)
  if (elapsedS < 60) return `${elapsedS.toFixed(0)}s`
  const m = Math.floor(elapsedS / 60)
  const s = Math.floor(elapsedS % 60)
  return `${m}m ${s}s`
}

export function MessageList({ messages, isStreaming, isLoading = false, onSendMessage, showSuggestions, onResume, threadId }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const prevCountRef = useRef(0)
  const containerRef = useRef<HTMLDivElement>(null)
  // BL-05 fix: track whether the scroll listener has actually attached.
  // Until it has, we cannot trust the near-bottom read — the auto-follow would
  // fight a user who has scrolled up. (Symptom: smooth scroll → instant snap →
  // smooth scroll during reconcile + send.)
  const scrollListenerAttachedRef = useRef(false)

  // Phase 095 Plan 04 (D-03): the follow-but-release scroll state machine. It
  // EXTENDS the old `isNearBottom < 120` heuristic — `isPinned` replaces the
  // bare near-bottom ref, adding explicit release-on-scroll-up / re-arm-at-bottom
  // + the "↓ Jump to live" affordance. The viewport accessor is the same Radix
  // viewport lookup the BL-05 listener attaches to.
  const getViewport = () =>
    (containerRef.current?.closest("[data-radix-scroll-area-viewport]") as HTMLElement | null) ?? null
  const { isPinned, showJumpToLive, jumpToLive, onScroll, beginProgrammaticScroll } =
    useFollowScroll(getViewport, isStreaming)

  // BL-05 fix: useLayoutEffect + retry — the Radix ScrollArea viewport may
  // not be in the DOM on the first render pass; useEffect's lookup returns
  // null and the listener never attaches. Use useLayoutEffect to run before
  // paint and retry on the next animation frame if the viewport isn't
  // mounted yet. (Phase 095: attaches the hook's `onScroll` — the release/re-arm
  // driver — replacing the old bare handleScroll.)
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
      el.addEventListener("scroll", onScroll, { passive: true })
      scrollListenerAttachedRef.current = true
      cleanup = () => {
        el.removeEventListener("scroll", onScroll)
        scrollListenerAttachedRef.current = false
      }
    }
    tryAttach()
    return () => {
      cancelled = true
      cleanup?.()
    }
    // onScroll is stable across renders (useCallback over stable deps); attach once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Phase 095 Plan 04 (D-03): auto-follow is now GATED on `isPinned`. While
  // pinned, follow the live edge; the instant the user scrolls up the hook
  // releases the pin and this effect stops scrolling (the release). Each scroll
  // write is preceded by `beginProgrammaticScroll()` so the scroll event it
  // produces does NOT trip the release (T-095-04-02). The active-`preparing`
  // tool priority (Focus Mode, 076.1 D-01/D-02) is preserved verbatim.
  useEffect(() => {
    const newCount = messages.length
    const scrollToTarget = (behavior: ScrollBehavior) => {
      const preparingEl = containerRef.current?.querySelector(
        '[data-tool-status="preparing"]'
      ) as HTMLElement | null
      // Flag the upcoming scroll as our own BEFORE the write so onScroll skips it.
      beginProgrammaticScroll()
      if (isStreaming && preparingEl) {
        preparingEl.scrollIntoView({ behavior: "smooth", block: "nearest" })
      } else {
        bottomRef.current?.scrollIntoView({ behavior })
      }
    }
    if (newCount > prevCountRef.current) {
      prevCountRef.current = newCount
      // Only follow while pinned. A user scrolled up mid-stream is left in place.
      if (isPinned) {
        scrollToTarget(isStreaming ? "instant" : "smooth")
      }
    } else if (isStreaming && isPinned) {
      // token-delta cadence: the messages ref changes per token; follow the edge.
      const preparingEl = containerRef.current?.querySelector(
        '[data-tool-status="preparing"]'
      ) as HTMLElement | null
      beginProgrammaticScroll()
      if (preparingEl) {
        preparingEl.scrollIntoView({ behavior: "smooth", block: "nearest" })
      } else {
        bottomRef.current?.scrollIntoView({ behavior: "instant" })
      }
    }
  }, [messages, isStreaming, isPinned, beginProgrammaticScroll])

  // Phase 095 Plan 04 — the floating chip's status: derive the real step count +
  // elapsed from the live-streaming assistant message (the last assistant bubble
  // while streaming). The chip reuses the ONE RunStatusStrip (placement=floating,
  // Plan 02) — no second strip. Per the hybrid (D-06): the timer's persistent
  // identity lives in the header strip; this chip is the "↓ Jump to live" home,
  // carrying step + a calm motion verb so it is honest from the bottom too.
  const streamingMessage =
    isStreaming && messages.length > 0 && messages[messages.length - 1].role === "assistant"
      ? messages[messages.length - 1]
      : undefined
  const chipStepCount = streamingMessage ? unifiedStepCount(streamingMessage) : 0
  const chipElapsed = formatFloatingElapsed(streamingMessage?.created_at) ?? ""

  // BUG-260626-01: collapse same-runId duplicates before render. In the
  // live/just-completed window of a multi-run thread the chat bucket can
  // transiently hold TWO assistant messages with the same runId — the
  // in-place-completed `temp-…` placeholder AND the persisted/reconciled row.
  // Both are keyed `run-${runId}` below, so React would duplicate/omit subtrees
  // (duplicated GENERATED FILES panels + source-doc bleed). The shared
  // dedupMessagesByRunId keeps the persisted (non-`temp-`) row so the key is
  // always unique; the SAME helper de-doubles useDerivedPanel's workspace todos
  // (BUG-260626-01 sibling). Order-preserving; a no-op for single runs and for
  // rows without a runId (harness answers, user rows).
  const renderMessages = dedupMessagesByRunId(messages)

  return (
    <ScrollArea className="flex-1">
      <div ref={containerRef} className="relative space-y-1 px-6 py-6 max-w-4xl mx-auto">
        {/* Phase 068.5 (D-068.5-11 + D-068.5-12): cold-load skeleton placeholder
            when the bucket is empty AND a reconcile fetch is in flight.
            Gap-01 fix: gate on isLoading so new chats / empty threads without
            a pending fetch don't render misleading shimmer (D-068.5-11 was
            originally messages.length===0 only). Clears the instant the first
            message arrives (hydrate or reconcile resolves). */}
        {isLoading && messages.length === 0 ? (
          <MessageSkeleton />
        ) : (
          renderMessages.map((msg, idx) => {
            const isLastAssistant =
              msg.role === "assistant" && idx === renderMessages.length - 1
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

        {/* Phase 194.1 Plan 06 (RUN-01 / R4 + R5 — D-15): the run-anchored line.
            AFTER the messages map and BEFORE the auto-scroll anchor, so it is at
            LIST level — not inside the transcript — and `bottomRef` still lands at
            the true bottom of the scrollable content.

            ⚠ IT IS A SIBLING OF THE FLOATING CHIP BELOW, NOT A REPLACEMENT FOR IT
            (D-17). That chip's `RunStatusStrip` is gated on `showJumpToLive`, i.e.
            it appears only once you have scrolled away — a different affordance,
            byte-untouched by this plan.

            ⚠ LIST LEVEL RATHER THAN MESSAGE LEVEL IS LOAD-BEARING. After plan 03 a
            harness kickoff inserts NO assistant node, so there is no message for a
            run reading to anchor to; and a stop NULLs the thread's live run anchor,
            so the returning reading has to come from the persisted row. Both facts
            point at the same placement. */}
        <ThreadRunLine threadId={threadId ?? null} />

        <div ref={bottomRef} />

        {/* Phase 095 Plan 04 (D-03 hybrid, home #2): the floating "↓ Jump to live"
            chip. Appears ONLY on scroll-away during a live run (showJumpToLive =
            !isPinned && isStreaming) so it never occludes the live stream while
            following. Clicking it re-pins + scrolls to the live edge. It reuses
            the ONE RunStatusStrip — no second strip.

            The button IS the single floating pill (border + bg + glow); the strip
            is mounted with placement="header-bare" INSIDE it so the live-status
            segments render as plain text WITHOUT a second nested pill border (both
            placement="floating" AND the Plan-07 placement="header" pill would
            double-frame inside this pill — WR-01, code-review 095).

            Phase 095 Plan 08 (GAP-095-03 LOW): per sketch 015 `.live-chip`, the
            status segments LEAD and the `.jump` affordance TRAILS (the jump morphs
            in AFTER the status). So the RunStatusStrip renders FIRST and the
            "↓ Jump to live" span trails. */}
        {showJumpToLive && (
          <button
            type="button"
            data-testid="jump-to-live-chip"
            data-placement="floating"
            onClick={jumpToLive}
            aria-label="Jump to live"
            className="animate-fadeSlideUp sticky bottom-3 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full border border-primary/50 bg-popover/92 px-3 py-1.5 shadow-lg backdrop-blur-md transition-colors hover:border-primary"
          >
            <RunStatusStrip
              elapsedLabel={chipElapsed}
              stepCount={chipStepCount}
              activityVerb="Streaming…"
              placement="header-bare"
            />
            <span aria-hidden="true" className="opacity-40">
              ·
            </span>
            <span className="font-mono text-xs font-semibold text-primary">
              ↓ Jump to live
            </span>
          </button>
        )}
      </div>
    </ScrollArea>
  )
}
