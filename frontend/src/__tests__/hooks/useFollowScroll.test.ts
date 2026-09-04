/**
 * Phase 095 Plan 04 Task 1 — `useFollowScroll` state-machine test (D-03).
 *
 * The follow-but-release scroll discipline + the "↓ Jump to live" affordance.
 * This is the genuinely-new behavior on the chat scroll container
 * (BUG-260529-02 #1): follow the live edge while at/near bottom; release the
 * instant the user scrolls UP; re-arm at the bottom; programmatic scrolls (the
 * auto-follow itself) must NOT trip the release.
 *
 * RED at task start (useFollowScroll.ts does not exist); GREEN once the hook
 * implements the machine per 095-RESEARCH.md §"D-03 — Follow-but-release scroll"
 * and 095-VALIDATION.md → D-03 pass conditions.
 *
 * Threshold = the EXISTING 120px (MessageList.tsx:37) — chosen over the sketch's
 * 56 to keep the felt near-bottom heuristic byte-for-byte unchanged (PLAN Task 1
 * action: "the existing 120 is safest to avoid changing felt behavior").
 *
 * The hook is pure: its only DOM coupling is the `getViewport()` accessor. Tests
 * drive it with a fake viewport whose scroll geometry we set per case.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useFollowScroll } from "@/hooks/useFollowScroll"

// ── A fake Radix-viewport-like element with settable scroll geometry ──────────
function makeViewport(geom: {
  scrollHeight: number
  clientHeight: number
  scrollTop: number
}) {
  const vp = {
    scrollHeight: geom.scrollHeight,
    clientHeight: geom.clientHeight,
    scrollTop: geom.scrollTop,
    // jsdom HTMLElement has no real scroll; the hook writes scrollTop on jump.
  } as unknown as HTMLElement
  return vp
}

/** distFromBottom = scrollHeight - scrollTop - clientHeight. <120 = near bottom. */
function atBottom() {
  return makeViewport({ scrollHeight: 1000, clientHeight: 500, scrollTop: 500 }) // dist 0
}
function scrolledUp() {
  return makeViewport({ scrollHeight: 1000, clientHeight: 500, scrollTop: 100 }) // dist 400
}

describe("Phase 095 Plan 04 — useFollowScroll (D-03)", () => {
  beforeEach(() => {
    // Run the rAF-clear of the programmatic flag synchronously-ish in tests.
    vi.stubGlobal(
      "requestAnimationFrame",
      (cb: FrameRequestCallback) => setTimeout(() => cb(0), 0) as unknown as number,
    )
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllTimers()
  })

  it("initial state: isPinned=true, showJumpToLive=false", () => {
    const vp = atBottom()
    const { result } = renderHook(() => useFollowScroll(() => vp, true))
    expect(result.current.isPinned).toBe(true)
    expect(result.current.showJumpToLive).toBe(false)
  })

  it("user scrolls UP during streaming → isPinned=false AND showJumpToLive=true", () => {
    const vp = scrolledUp()
    const { result } = renderHook(() => useFollowScroll(() => vp, true))
    act(() => {
      result.current.onScroll()
    })
    expect(result.current.isPinned).toBe(false)
    expect(result.current.showJumpToLive).toBe(true)
  })

  it("user scrolls back to bottom → isPinned=true AND showJumpToLive=false (re-arm)", () => {
    const vp = scrolledUp()
    const { result, rerender } = renderHook(({ v }) => useFollowScroll(() => v, true), {
      initialProps: { v: vp },
    })
    // release
    act(() => {
      result.current.noteUserGesture()
      result.current.onScroll()
    })
    expect(result.current.isPinned).toBe(false)
    // now the USER scrolls the viewport back to the bottom.
    // ⚠ `noteUserGesture()` was added to this case by BUG-260904-02 and it is not a
    // weakening: a re-arm now requires a real user input, precisely so the tail of our own
    // smooth scroll can no longer re-arm on the reader's behalf. The negative control lives
    // in the "tail of our own smooth scroll" case below — without a gesture, no re-arm.
    const vpBottom = atBottom()
    rerender({ v: vpBottom })
    act(() => {
      result.current.noteUserGesture()
      result.current.onScroll()
    })
    expect(result.current.isPinned).toBe(true)
    expect(result.current.showJumpToLive).toBe(false)
  })

  it("a programmatic scroll does NOT release the pin (immune to its own auto-follow)", () => {
    // viewport reports scrolled-up geometry, but the scroll event was OUR write
    const vp = scrolledUp()
    const { result } = renderHook(() => useFollowScroll(() => vp, true))
    act(() => {
      result.current.beginProgrammaticScroll()
      // the scroll event our auto-follow caused arrives while the flag is set
      result.current.onScroll()
    })
    // pin held — the programmatic scroll did not trip the release
    expect(result.current.isPinned).toBe(true)
    expect(result.current.showJumpToLive).toBe(false)
  })

  it("jumpToLive() re-pins and hides the chip", () => {
    const vp = scrolledUp()
    const { result } = renderHook(() => useFollowScroll(() => vp, true))
    act(() => {
      result.current.onScroll()
    })
    expect(result.current.isPinned).toBe(false)
    act(() => {
      result.current.jumpToLive()
    })
    expect(result.current.isPinned).toBe(true)
    expect(result.current.showJumpToLive).toBe(false)
    // it scrolled the viewport to the live edge
    expect(vp.scrollTop).toBe(vp.scrollHeight)
  })

  it("NOT streaming → showJumpToLive stays false even when scrolled up (chip is a live-run affordance)", () => {
    const vp = scrolledUp()
    const { result } = renderHook(() => useFollowScroll(() => vp, false))
    act(() => {
      result.current.onScroll()
    })
    expect(result.current.isPinned).toBe(false)
    expect(result.current.showJumpToLive).toBe(false)
  })


  // ══════════════════════════════════════════════════════════════════════════════
  // BUG-260904-02 / BUG-260823-01 — the smooth-scroll TAIL must not re-arm the pin
  // ══════════════════════════════════════════════════════════════════════════════
  //
  // ⚠ THE DEFECT, IN ONE SENTENCE: `beginProgrammaticScroll` cleared its flag after ONE
  // animation frame, but `scrollIntoView({behavior:"smooth"})` keeps emitting scroll events
  // for HUNDREDS of milliseconds — so every frame of our own animation after the first was
  // read as a user scroll, and because those frames travel TOWARD the bottom they took the
  // re-arm branch and switched the pin back on under a reader who had just scrolled away.
  // The auto-follow then dragged them down, they scrolled up again, and the loop repeated.
  // That is the operator's report: "if I scroll up it is forcing me to go down."
  //
  // The fix is two-part and both halves are fenced below: the programmatic window lasts
  // until the animation settles rather than one frame, and a RE-ARM now requires a real
  // user gesture — our own scrolls can no longer vote themselves back into following.

  it("⭐ the tail of our own smooth scroll does NOT re-arm a pin the user released", () => {
    const vp = scrolledUp()
    const { result, rerender } = renderHook(({ v }) => useFollowScroll(() => v, true), {
      initialProps: { v: vp },
    })

    // The user scrolls up, by hand: gesture first, then the scroll event it causes.
    act(() => {
      result.current.noteUserGesture()
      result.current.onScroll()
    })
    expect(result.current.isPinned).toBe(false)

    // An auto-follow smooth scroll was ALREADY in flight when they did that. Its
    // animation keeps running and keeps firing scroll events, several frames later,
    // arriving at the bottom. None of them is the user.
    const vpBottom = atBottom()
    rerender({ v: vpBottom })
    act(() => {
      result.current.beginProgrammaticScroll()
      result.current.onScroll()
      result.current.onScroll()
      result.current.onScroll()
    })

    // The reader stays where they put themselves.
    expect(result.current.isPinned).toBe(false)
    expect(result.current.showJumpToLive).toBe(true)
  })

  it("⭐ MEASURED IN A BROWSER: the tail cannot re-arm just because the user gestured a moment ago", () => {
    // ⚠ THE SECOND HALF OF BUG-260904-02, AND THE FIRST FIX DID NOT COVER IT. Driven in a real
    // browser on a run with a live tool step: scrolling up still dragged the reader back
    // +1136 px (5661 -> 6797) with the chip already gone. The release fired correctly; then the
    // tail of our own in-flight smooth scroll re-armed inside the gesture window — because the
    // tail arrives milliseconds after the very gesture that released the pin.
    //
    // The tool-card path is where this bites hardest: it uses
    // `preparingEl.scrollIntoView({behavior:"smooth"})` on every token delta, so an animation is
    // essentially always in flight, which is exactly what the operator reported —
    // "mostly when it is generating and calling tools in the card, not in the raw text".
    const vp = scrolledUp()
    const { result, rerender } = renderHook(({ v }) => useFollowScroll(() => v, true), {
      initialProps: { v: vp },
    })

    // An auto-follow smooth scroll is in flight, THEN the user scrolls up out of it.
    act(() => {
      result.current.beginProgrammaticScroll()
      result.current.noteUserGesture()
      result.current.onScroll()
    })
    expect(result.current.isPinned).toBe(false)

    // The tail of that same animation now lands at the bottom, well inside the gesture window.
    const vpBottom = atBottom()
    rerender({ v: vpBottom })
    act(() => {
      result.current.onScroll()
      result.current.onScroll()
    })

    // It must NOT take hold again. A gesture buys the right to let go, never to grab back.
    expect(result.current.isPinned).toBe(false)
    expect(result.current.showJumpToLive).toBe(true)
  })

  it("a user gesture CANCELS the programmatic window immediately (scrolling away mid-animation still releases)", () => {
    const vp = atBottom()
    const { result, rerender } = renderHook(({ v }) => useFollowScroll(() => v, true), {
      initialProps: { v: vp },
    })
    act(() => {
      result.current.beginProgrammaticScroll()
    })
    // Mid-animation, the user grabs the wheel and scrolls up. Their scroll must win
    // over our in-flight window — otherwise the fix above would make the pin unbreakable
    // for as long as tokens keep arriving, which is the same bug wearing the other mask.
    const vpUp = scrolledUp()
    rerender({ v: vpUp })
    act(() => {
      result.current.noteUserGesture()
      result.current.onScroll()
    })
    expect(result.current.isPinned).toBe(false)
  })

  it("onScroll is a no-op (no throw) when the viewport is not yet mounted", () => {
    const { result } = renderHook(() => useFollowScroll(() => null, true))
    expect(() => act(() => result.current.onScroll())).not.toThrow()
    expect(result.current.isPinned).toBe(true)
  })
})
