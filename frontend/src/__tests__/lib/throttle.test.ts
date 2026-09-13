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
import { makeThrottle, makeAccumulatingCoalescer } from "@/lib/throttle" // RED — implements in Task 2

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

/**
 * Phase 243 Plan 03 (CHAT-02 / D-243-15) — the SECOND export, and it is deliberately the
 * OPPOSITE of `makeThrottle` on both axes.
 *
 * ⛔ The four cases above are `makeThrottle`'s and are UNCHANGED by Phase 243. They are
 * the proof that the cache writer's trailing-only, last-write-wins contract was not
 * altered to serve the delta path — a "unification" of the two would break one of the
 * two call sites silently, which is why they are two functions.
 */
describe("Phase 243 Plan 03 — makeAccumulatingCoalescer: leading edge, no args to lose", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it("fires the FIRST call synchronously — the leading edge `makeThrottle` deliberately lacks", () => {
    const apply = vi.fn()
    const coalesce = makeAccumulatingCoalescer(apply, 60)

    coalesce()
    expect(apply).toHaveBeenCalledTimes(1) // no timer advanced
  })

  it("coalesces a burst: 30 calls inside one window produce the leading fire plus ONE trailing fire", () => {
    const apply = vi.fn()
    const coalesce = makeAccumulatingCoalescer(apply, 60)

    for (let i = 0; i < 30; i++) coalesce()
    expect(apply).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(60)
    expect(apply).toHaveBeenCalledTimes(2)
  })

  it("bounds the cadence: calls every 10 ms for 600 ms fire at most once per 60 ms window", () => {
    const apply = vi.fn()
    const coalesce = makeAccumulatingCoalescer(apply, 60)

    for (let i = 0; i < 60; i++) {
      coalesce()
      vi.advanceTimersByTime(10)
    }
    expect(apply.mock.calls.length).toBeLessThanOrEqual(1 + Math.ceil(600 / 60))
    expect(apply.mock.calls.length).toBeGreaterThan(1)
  })

  it("never fires on an idle tick — the window closes when nothing is pending", () => {
    const apply = vi.fn()
    const coalesce = makeAccumulatingCoalescer(apply, 60)

    coalesce()
    expect(apply).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(6000)
    expect(apply).toHaveBeenCalledTimes(1)
  })

  it("flush() drains a pending window immediately and cancels its timer", () => {
    const apply = vi.fn()
    const coalesce = makeAccumulatingCoalescer(apply, 60)

    coalesce() // leading fire
    coalesce() // pending
    expect(apply).toHaveBeenCalledTimes(1)

    coalesce.flush()
    expect(apply).toHaveBeenCalledTimes(2)

    vi.advanceTimersByTime(1000)
    expect(apply).toHaveBeenCalledTimes(2)
  })

  it("flush() with nothing pending is a no-op, and it re-opens the leading edge", () => {
    const apply = vi.fn()
    const coalesce = makeAccumulatingCoalescer(apply, 60)

    coalesce.flush()
    expect(apply).not.toHaveBeenCalled()

    coalesce()
    expect(apply).toHaveBeenCalledTimes(1)
    coalesce.flush() // nothing pending — must not double-fire
    expect(apply).toHaveBeenCalledTimes(1)

    // The window was closed by flush, so the next call LEADS again.
    coalesce()
    expect(apply).toHaveBeenCalledTimes(2)
  })

  it("carries NO arguments, so there is no last-write-wins channel to lose data through", () => {
    // The buffer lives in the caller's closure; `apply` drains it. This is the structural
    // answer to `makeThrottle`'s `lastArgs = args` (`throttle.ts:19`).
    let buffer = ""
    const drained: string[] = []
    const coalesce = makeAccumulatingCoalescer(() => {
      drained.push(buffer)
      buffer = ""
    }, 60)

    buffer += "a"
    coalesce()
    buffer += "b"
    coalesce()
    buffer += "c"
    coalesce()
    coalesce.flush()

    expect(drained.join("")).toBe("abc")
  })
})
