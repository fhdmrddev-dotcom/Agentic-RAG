/**
 * Phase 068.5 (Plan 01 — Wave 0): RED test stubs for `frontend/src/lib/throttle.ts`.
 *
 * Tests the trailing-edge throttle helper used by <StreamsProvider> useEffect #4
 * (D-068.5-03) to batch writes to localStorage during streaming while
 * guaranteeing a clean snapshot at thread-switch via `.flush()`.
 *
 * Canonical reference: 068.5-RESEARCH.md §Pattern 2 lines 304-340.
 *
 * RED at task start (file doesn't exist); GREEN at Task 2 end.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { makeThrottle } from "@/lib/throttle" // RED — implements in Task 2

describe("Phase 068.5 — makeThrottle: trailing-edge timing", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("invokes fn exactly once after waitMs when called 3x rapidly, with LAST args", () => {
    const fn = vi.fn<(arg: number) => void>()
    const throttled = makeThrottle(fn, 500)

    throttled(1)
    throttled(2)
    throttled(3)

    expect(fn).not.toHaveBeenCalled()
    vi.advanceTimersByTime(500)
    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenCalledWith(3)
  })

  it(".flush() invokes immediately with last args + cancels pending timer", () => {
    const fn = vi.fn<(arg: string) => void>()
    const throttled = makeThrottle(fn, 500)

    throttled("first")
    throttled("second")
    expect(fn).not.toHaveBeenCalled()

    throttled.flush()
    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenCalledWith("second")

    // Pending timer is cancelled — advancing time should NOT fire fn again.
    vi.advanceTimersByTime(1000)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it(".flush() on an idle throttle (no pending call) is a no-op", () => {
    const fn = vi.fn<(arg: number) => void>()
    const throttled = makeThrottle(fn, 500)

    throttled.flush()
    expect(fn).not.toHaveBeenCalled()
  })

  it("starts a new throttle window after .flush()", () => {
    const fn = vi.fn<(arg: number) => void>()
    const throttled = makeThrottle(fn, 500)

    throttled(1)
    throttled.flush()
    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenLastCalledWith(1)

    // New window opens.
    throttled(2)
    expect(fn).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(500)
    expect(fn).toHaveBeenCalledTimes(2)
    expect(fn).toHaveBeenLastCalledWith(2)
  })
})
