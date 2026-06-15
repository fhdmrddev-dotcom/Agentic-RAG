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
      result.current.onScroll()
    })
    expect(result.current.isPinned).toBe(false)
    // now the viewport is back at the bottom
    const vpBottom = atBottom()
    rerender({ v: vpBottom })
    act(() => {
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

  it("onScroll is a no-op (no throw) when the viewport is not yet mounted", () => {
    const { result } = renderHook(() => useFollowScroll(() => null, true))
    expect(() => act(() => result.current.onScroll())).not.toThrow()
    expect(result.current.isPinned).toBe(true)
  })
})
