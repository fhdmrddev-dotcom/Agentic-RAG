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

// ══════════════════════════════════════════════════════════════════════════════
// Phase 243 Plan 03 Task 1 (D-243-05) — THE RED DRIVE, at HEAD, against the code
// that actually exists rather than against a bug report.
// ══════════════════════════════════════════════════════════════════════════════
//
// ⚠ `BUG-260823-01` names a root cause — a programmatic-scroll flag cleared on the
// NEXT ANIMATION FRAME — and that code NO LONGER EXISTS. It was replaced on
// 2026-09-04 by `64357e979` (BUG-260904-02), twelve days after the report was filed,
// while the report stayed `status: open`. So none of the cases below test the report;
// they test HEAD.
//
// The candidate residual D-243-05 names, restated so it is CHECKED and not assumed:
// while pinned, `MessageList`'s effect refreshes `hardProgrammaticUntilRef` to
// `now + PROGRAMMATIC_SCROLL_SETTLE_MS` (900) on EVERY token. A gesture at `t` opens
// `USER_GESTURE_WINDOW_MS` (1500). Between `t + 900` and `t + 1500` there is a
// ~600 ms window in which BOTH re-arm conditions are satisfied, so ANY scroll event
// whose geometry is within `FOLLOW_SCROLL_THRESHOLD` (120px) of the bottom re-arms
// the pin — including one the reader did not cause.
//
// ⭐ THE PAIR IS THE POINT. Case A must not re-arm; case B MUST. A fix that passes A
// by refusing every late re-arm breaks B, which `:191-227`'s own ⭐ comment records as
// the whole design ("a flick that coasts to the bottom still re-arms").

describe("Phase 243 Plan 03 (D-243-05) — the ~600 ms re-arm window, driven at HEAD", () => {
  let clock = 0
  beforeEach(() => {
    clock = 1_000_000
    vi.spyOn(Date, "now").mockImplementation(() => clock)
  })
  afterEach(() => {
    vi.mocked(Date.now).mockRestore()
  })

  /** A viewport whose geometry the case moves, the way a real one moves. */
  function movableViewport() {
    return makeViewport({ scrollHeight: 1000, clientHeight: 500, scrollTop: 500 })
  }
  function setGeom(vp: HTMLElement, scrollTop: number) {
    ;(vp as unknown as { scrollTop: number }).scrollTop = scrollTop
  }

  it("⭐ A — an UPWARD gesture, then a near-bottom scroll 1000 ms later: the pin must NOT re-arm", () => {
    const vp = movableViewport()
    const { result } = renderHook(() => useFollowScroll(() => vp, true))

    // Token cadence while pinned: the effect claims each scroll it starts. The LAST
    // claim is the one that matters — it expires at t + 900.
    act(() => {
      result.current.beginProgrammaticScroll()
      clock += 40
      result.current.beginProgrammaticScroll()
      clock += 40
      result.current.beginProgrammaticScroll()
    })

    // The reader wheels UP. A small nudge — 60px — so they are still inside the 120px
    // near-bottom threshold. This is the shape that matters: a big scroll lands in the
    // RELEASE branch on every later event and can never re-arm, so it cannot show the bug.
    const t = clock
    setGeom(vp, 440) // dist = 1000 - 440 - 500 = 60  (< 120, "near bottom")
    act(() => {
      result.current.noteUserGesture("up")
      result.current.onScroll()
    })
    expect(result.current.isPinned).toBe(false)

    // 1000 ms later: past the 900 ms hard clock, still inside the 1500 ms gesture window.
    // A scroll event arrives that the reader did not produce (scroll anchoring as the
    // streaming content above them grows, a focus move, a late layout shift).
    clock = t + 1000
    act(() => {
      result.current.onScroll()
    })

    // The reader stays where they put themselves.
    expect(result.current.isPinned).toBe(false)
    expect(result.current.showJumpToLive).toBe(true)
  })

  it("⭐ B — THE MIRROR: a downward flick that COASTS to the bottom inside the gesture window MUST still re-arm", () => {
    const vp = movableViewport()
    const { result } = renderHook(() => useFollowScroll(() => vp, true))

    // The reader scrolls well up and the pin releases.
    setGeom(vp, 100) // dist 400
    act(() => {
      result.current.noteUserGesture("up")
      result.current.onScroll()
    })
    expect(result.current.isPinned).toBe(false)

    // Much later — outside every window — they flick back DOWN toward the live edge.
    clock += 5_000
    const t = clock
    act(() => {
      result.current.noteUserGesture("down")
    })

    // The flick coasts: the scroll events it produces land at the bottom 400 ms later,
    // inside the 1500 ms gesture window and past any programmatic claim.
    clock = t + 400
    setGeom(vp, 500) // dist 0
    act(() => {
      result.current.onScroll()
    })

    expect(result.current.isPinned).toBe(true)
    expect(result.current.showJumpToLive).toBe(false)
  })

  it("⭐ C — the tail of our OWN scroll still cannot re-arm inside the hard window (BUG-260904-02's fence, re-driven at HEAD)", () => {
    const vp = movableViewport()
    const { result } = renderHook(() => useFollowScroll(() => vp, true))

    const t = clock
    setGeom(vp, 100)
    act(() => {
      result.current.beginProgrammaticScroll()
      result.current.noteUserGesture("up")
      result.current.onScroll()
    })
    expect(result.current.isPinned).toBe(false)

    // 300 ms later the tail of that same animation lands at the bottom — inside the
    // 900 ms hard clock, so it is refused.
    clock = t + 300
    setGeom(vp, 500)
    act(() => {
      result.current.onScroll()
      result.current.onScroll()
    })
    expect(result.current.isPinned).toBe(false)
  })
})
