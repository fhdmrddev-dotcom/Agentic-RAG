import { useCallback, useRef, useState } from "react"

/**
 * Phase 095 Plan 04 (D-03) — the follow-but-release scroll state machine.
 *
 * The one genuinely-new behavior on the chat scroll container (BUG-260529-02 #1,
 * SKETCH-CONSISTENCY §B "Smart follow-scroll"). It EXTENDS — never replaces — the
 * MessageList `isNearBottom < 120` heuristic and the BL-05 listener-attach guard.
 *
 * The machine:
 *   - `isPinned` (default true): the chat is following the live edge.
 *   - User scrolls UP past the threshold (a real, NON-programmatic scroll) →
 *     release: isPinned = false (leave the user where they are).
 *   - User scrolls back to within the threshold of the bottom → re-arm:
 *     isPinned = true.
 *   - A PROGRAMMATIC scroll (our own auto-follow `scrollIntoView` / `scrollTop`
 *     write) must NOT trip the release — it is flagged via `beginProgrammaticScroll`
 *     so the resulting scroll event is ignored by `onScroll` (T-095-04-02: the
 *     auto-follow can never fight a scrolled-up user).
 *   - `showJumpToLive = !isPinned && isStreaming` — the "↓ Jump to live" chip is a
 *     LIVE-RUN affordance only; it never appears once the run is terminal.
 *   - `jumpToLive()` re-pins and scrolls the viewport to the live edge.
 *
 * THRESHOLD = the EXISTING 120px (MessageList.tsx:37), chosen over the sketch's 56
 * to keep the felt near-bottom heuristic byte-for-byte unchanged.
 *
 * Pure hook — the ONLY DOM coupling is the `getViewport()` accessor. It imports no
 * components (the floating chip is composed in MessageList from the one shared
 * status strip).
 */
export const FOLLOW_SCROLL_THRESHOLD = 120

export interface FollowScroll {
  /** true while the chat is following the live edge (auto-follow gated on this). */
  isPinned: boolean
  /** the "↓ Jump to live" chip is shown only when scrolled-away during a live run. */
  showJumpToLive: boolean
  /** re-pin + scroll to the live edge (the chip onClick). */
  jumpToLive: () => void
  /** attach to the viewport scroll event; release/re-arm the pin (ignores our own scrolls). */
  onScroll: () => void
  /** flag the NEXT scroll as programmatic so it doesn't trip the release. */
  beginProgrammaticScroll: () => void
}

export function useFollowScroll(
  getViewport: () => HTMLElement | null,
  isStreaming: boolean,
): FollowScroll {
  // isPinned drives render (the chip + the auto-follow gate), so it is state —
  // mirrored into a ref so `onScroll`/`jumpToLive` read the current value without
  // a stale closure (the listener is attached once in MessageList).
  const [isPinned, setIsPinnedState] = useState(true)
  const isPinnedRef = useRef(true)
  const isProgrammaticScrollRef = useRef(false)

  const setIsPinned = useCallback((next: boolean) => {
    if (isPinnedRef.current === next) return
    isPinnedRef.current = next
    setIsPinnedState(next)
  }, [])

  // Flag the next scroll as our own (the auto-follow). Cleared on the next frame
  // so the single programmatic scroll event it produces is skipped, but a real
  // user scroll one frame later still releases.
  const beginProgrammaticScroll = useCallback(() => {
    isProgrammaticScrollRef.current = true
    requestAnimationFrame(() => {
      isProgrammaticScrollRef.current = false
    })
  }, [])

  const onScroll = useCallback(() => {
    const vp = getViewport()
    if (!vp) return
    // Our own auto-follow scroll — do not let it release the pin.
    if (isProgrammaticScrollRef.current) return
    const distFromBottom = vp.scrollHeight - vp.scrollTop - vp.clientHeight
    if (distFromBottom > FOLLOW_SCROLL_THRESHOLD) {
      // user scrolled up → release
      setIsPinned(false)
    } else {
      // back at/near the bottom → re-arm
      setIsPinned(true)
    }
  }, [getViewport, setIsPinned])

  const jumpToLive = useCallback(() => {
    setIsPinned(true)
    const vp = getViewport()
    if (!vp) return
    beginProgrammaticScroll()
    vp.scrollTop = vp.scrollHeight
  }, [getViewport, setIsPinned, beginProgrammaticScroll])

  // The chip is a live-run affordance: shown only when scrolled-away AND streaming.
  const showJumpToLive = !isPinned && isStreaming

  return { isPinned, showJumpToLive, jumpToLive, onScroll, beginProgrammaticScroll }
}
