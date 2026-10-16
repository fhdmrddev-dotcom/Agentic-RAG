/**
 * Phase 284-05 checkpoint (G-4 at 50k) — the Library's Root header painted "-17,721 documents"
 * on its way to 30,000. The rAF timestamp is the frame's START, so it can precede the
 * `performance.now()` the effect captured; the ease of a negative progress is negative.
 * `easedProgress` is the one place the fraction is computed, and it never leaves [0, 1].
 */
import { describe, it, expect } from "vitest"
import { easedProgress } from "@/components/ui/animatedNumberProgress"

describe("easedProgress — the animation fraction never leaves [0, 1]", () => {
  it("a frame stamped BEFORE the effect's start time is the start, never below it", () => {
    expect(easedProgress(-50, 300)).toBe(0)
    expect(0 + (30000 - 0) * easedProgress(-50, 300)).toBe(0)
  })

  it("past the duration is the target, and the midpoint eases out (cubic)", () => {
    expect(easedProgress(900, 300)).toBe(1)
    expect(easedProgress(150, 300)).toBeCloseTo(0.875, 6)
    expect(easedProgress(0, 300)).toBe(0)
  })

  it("a zero duration lands on the target instead of dividing by zero", () => {
    expect(easedProgress(0, 0)).toBe(1)
  })
})
