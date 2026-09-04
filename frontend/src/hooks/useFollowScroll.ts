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

/**
 * ⚠ BUG-260904-02 / BUG-260823-01 — WHY THE ONE-FRAME FLAG WAS NOT ENOUGH.
 *
 * `beginProgrammaticScroll` used to clear its flag on the NEXT animation frame. That is
 * correct for an `instant` scroll, which lands in a single frame — and wrong for
 * `scrollIntoView({behavior:"smooth"})`, which keeps emitting scroll events for hundreds of
 * milliseconds. Every frame after the first was therefore read as a USER scroll, and because
 * our animation travels TOWARD the bottom those frames took the re-arm branch and switched
 * the pin back on under a reader who had just scrolled away. Auto-follow then dragged them
 * down; they scrolled up; the loop repeated for as long as tokens kept arriving. The operator
 * reported it as *"if I scroll up it is forcing me to go down"* during the final answer.
 *
 * Two changes, and BOTH are load-bearing — either alone reintroduces a variant of the bug:
 *
 *   1. The programmatic window lasts until the animation SETTLES (this constant), not one
 *      frame. Generous on purpose: a window that is too short re-opens the defect, while one
 *      that is too long is cancelled by the very next user gesture (see 2), so the cost of
 *      over-shooting is nil and the cost of under-shooting is the bug.
 *   2. A RE-ARM requires a real user gesture (`noteUserGesture`, fed by wheel / touch /
 *      pointer / key input from the scroll container). Our own scrolls can no longer vote
 *      themselves back into following. ⚠ Without this, extending the window alone would still
 *      lose the race whenever a token delta scheduled a fresh scroll each frame.
 *
 * ⚠ The RELEASE deliberately does NOT require a gesture. A scroll away from the bottom that
 * is not ours is the user by definition, and demanding a gesture there would strand a reader
 * whose input we failed to classify — the safe direction is to stop following, never to
 * follow harder.
 */
export const PROGRAMMATIC_SCROLL_SETTLE_MS = 900

/**
 * How recently a user gesture must have happened for a near-bottom scroll to RE-ARM the pin.
 * Comfortably longer than a smooth scroll-back so a flick that coasts to the bottom still
 * re-arms, and far shorter than a reading pause, so a stray scroll event minutes later cannot.
 */
export const USER_GESTURE_WINDOW_MS = 1500

/**
 * What the user's input was trying to do. `unknown` covers touch drags and scrollbar grabs,
 * where the direction is not in the event — those fall through to the geometry check.
 */
export type UserScrollIntent = "up" | "down" | "unknown"

export interface FollowScroll {
  /** true while the chat is following the live edge (auto-follow gated on this). */
  isPinned: boolean
  /** the "↓ Jump to live" chip is shown only when scrolled-away during a live run. */
  showJumpToLive: boolean
  /** re-pin + scroll to the live edge (the chip onClick). */
  jumpToLive: () => void
  /** attach to the viewport scroll event; release/re-arm the pin (ignores our own scrolls). */
  onScroll: () => void
  /** flag the scroll now in flight as programmatic so it doesn't trip the release. */
  beginProgrammaticScroll: () => void
  /**
   * The pin as of RIGHT NOW, read from the ref rather than from React state.
   * ⚠ The auto-follow effect must gate on this, not on `isPinned`: state reaches the effect a
   * commit later, and while a run streams a token delta re-runs that effect every few tens of
   * ms — so a stale `true` fires one more `scrollIntoView` after the user has begun scrolling,
   * which is felt as the list snapping back out from under the wheel.
   */
  isPinnedNow: () => boolean
  /**
   * Record a real user input on the scroll container (wheel / touch / pointer / key).
   * Cancels any in-flight programmatic window AND aborts a running smooth animation; an
   * UPWARD intent releases the pin synchronously, without waiting for the scroll event.
   */
  noteUserGesture: (intent?: UserScrollIntent) => void
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
  /**
   * Epoch ms until which scroll events are assumed to be our own animation settling, for the
   * purpose of the RELEASE. A user gesture cancels this one — their scroll must always be able
   * to free them, even mid-animation.
   */
  const programmaticUntilRef = useRef(0)
  /**
   * ⚠ THE SAME DEADLINE, BUT UNCANCELLABLE, AND IT GATES THE RE-ARM.
   *
   * MEASURED IN A BROWSER, 2026-09-04, on a run with a live tool step: with only the
   * cancellable timer, scrolling up during a tool call still dragged the reader back —
   * **+1136 px** (5661 → 6797) with the Jump-to-live chip already gone. The release DID fire;
   * the tail of our own in-flight `scrollIntoView` then re-armed it within the gesture window,
   * because the tail arrives milliseconds after the very gesture that cancelled the soft timer.
   *
   * So the two decisions need two clocks: a gesture may cancel our claim for the purpose of
   * LETTING GO, and may never cancel it for the purpose of TAKING HOLD again. While the pin is
   * released no new auto-follow scroll is started, so the only programmatic scroll that can
   * still be in flight is one that began before the release — which this deadline outlives.
   */
  const hardProgrammaticUntilRef = useRef(0)
  /** epoch ms of the last real user input on the container. */
  const lastGestureAtRef = useRef(0)

  const setIsPinned = useCallback((next: boolean) => {
    if (isPinnedRef.current === next) return
    isPinnedRef.current = next
    setIsPinnedState(next)
  }, [])

  // Claim the scroll now in flight as our own, for as long as a smooth animation can
  // keep emitting events. ⚠ NOT one animation frame — see PROGRAMMATIC_SCROLL_SETTLE_MS.
  const beginProgrammaticScroll = useCallback(() => {
    const until = Date.now() + PROGRAMMATIC_SCROLL_SETTLE_MS
    programmaticUntilRef.current = until
    hardProgrammaticUntilRef.current = until
  }, [])

  // A real user input. It ends our claim on the scroll immediately — the user always wins
  // over an animation we started — and it is the thing a re-arm is allowed to trust.
  const noteUserGesture = useCallback((intent: UserScrollIntent = "unknown") => {
    lastGestureAtRef.current = Date.now()
    programmaticUntilRef.current = 0
    // Release the pin RIGHT HERE, synchronously, rather than waiting for the scroll event
    // this gesture is about to produce.
    //
    // ⚠ OPERATOR-REPORTED, AFTER TWO FIXES THAT MEASURED CLEAN ON SYNTHETIC EVENTS: with a
    // REAL mouse wheel the list still dragged them down. A synthetic `WheelEvent` + a
    // `scrollTop` write is not a wheel — it produces ONE scroll event and lands instantly,
    // so it never exercised the two things that actually bite:
    //   1. React state is asynchronous. `setIsPinned(false)` from the scroll handler does not
    //      reach the auto-follow effect until the next commit, and while a run streams a token
    //      delta re-runs that effect every few tens of ms — so one or more further
    //      `scrollIntoView` calls fire AFTER the user has started scrolling, each restarting
    //      the animation. Releasing on the gesture itself, before the scroll event, closes it.
    //   2. An in-flight `scrollIntoView({behavior:"smooth"})` does NOT stop because our state
    //      changed — the browser keeps animating toward its target for hundreds of ms. It is
    //      cancelled by issuing another scroll on the same box, which is what the write below
    //      does: assigning the CURRENT offset aborts the animation without moving anything.
    // ⚠ ONLY an UPWARD intent releases here. A wheel-down at the live edge is a person
    // following along, and releasing on it would flash the "↓ Jump to live" chip for a frame
    // before the scroll event re-armed. Inputs whose direction we cannot read (touch drags,
    // scrollbar grabs) fall through to `onScroll`, which reads the geometry instead.
    if (intent === "up") setIsPinned(false)
    const vp = getViewport()
    if (vp) vp.scrollTop = vp.scrollTop
  }, [getViewport, setIsPinned])

  const onScroll = useCallback(() => {
    const vp = getViewport()
    if (!vp) return
    // Our own auto-follow scroll, still settling — it decides nothing.
    if (Date.now() < programmaticUntilRef.current) return
    const distFromBottom = vp.scrollHeight - vp.scrollTop - vp.clientHeight
    if (distFromBottom > FOLLOW_SCROLL_THRESHOLD) {
      // Scrolled away from the live edge, and it was not us → release. Deliberately does
      // NOT require a gesture: the safe direction is to stop following, never to follow
      // harder, so an input we failed to classify still frees the reader.
      setIsPinned(false)
      return
    }
    // Near the bottom. Re-arm needs BOTH: our own animation must have finished (the
    // uncancellable clock — a gesture cannot buy the tail permission to re-arm), and the user
    // must actually have brought the view back. Either check alone leaves the reader draggable.
    if (
      Date.now() >= hardProgrammaticUntilRef.current &&
      Date.now() - lastGestureAtRef.current <= USER_GESTURE_WINDOW_MS
    ) {
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

  const isPinnedNow = useCallback(() => isPinnedRef.current, [])

  return {
    isPinned,
    isPinnedNow,
    showJumpToLive,
    jumpToLive,
    onScroll,
    beginProgrammaticScroll,
    noteUserGesture,
  }
}
