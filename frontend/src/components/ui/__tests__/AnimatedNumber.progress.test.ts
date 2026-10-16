/**
 * Phase 284-05 checkpoint (G-4 at 50k) — the Library's Root header painted "-17,721 documents"
 * on its way to 30,000. The rAF timestamp is the frame's START, so it can precede the
 * `performance.now()` the effect captured; the ease of a negative progress is negative.
 * `easedProgress` is the one place the fraction is computed, and it never leaves [0, 1].
 */
import { describe, it, expect } from "vitest"
import { easedProgress, formatDisplayNumber, parseDisplayNumber } from "@/components/ui/animatedNumberProgress"

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

/**
 * 284-REVIEW IN-05 — a `toLocaleString()` count is parsed with the LOCALE's group separator.
 * The parse used to strip commas only, so in de-DE "10.000" read as 10.000 with three decimals and
 * the count-up frames showed "3.142…" on the way to 10.000. The animation's frames are now the
 * same grouped integer the final frame is.
 */
describe("parseDisplayNumber / formatDisplayNumber — locale-grouped counts", () => {
  it("de-DE: '10.000' is ten thousand, grouped, no decimals — and a frame formats as de-DE", () => {
    const p = parseDisplayNumber("10.000", "de-DE")
    expect(p).toMatchObject({ prefix: "", num: 10000, suffix: "", grouped: true, decimals: 0 })
    expect(formatDisplayNumber(3142, p!, "de-DE")).toBe("3.142")
  })

  it("en-US: '10,000' is ten thousand; '1,234.5' keeps its decimal", () => {
    expect(parseDisplayNumber("10,000", "en-US")).toMatchObject({ num: 10000, grouped: true, decimals: 0 })
    const p = parseDisplayNumber("1,234.5", "en-US")
    expect(p).toMatchObject({ num: 1234.5, grouped: true, decimals: 1 })
    expect(formatDisplayNumber(617.3, p!, "en-US")).toBe("617.3")
  })

  it("an ungrouped decimal keeps its meaning in any locale ('12.5 MB', '42%', a plain number)", () => {
    expect(parseDisplayNumber("12.5 MB", "de-DE")).toMatchObject({ num: 12.5, suffix: " MB", grouped: false, decimals: 1 })
    expect(parseDisplayNumber("42%", "en-US")).toMatchObject({ num: 42, suffix: "%", grouped: false })
    expect(parseDisplayNumber(1536, "de-DE")).toMatchObject({ num: 1536, grouped: false, decimals: 0 })
    expect(formatDisplayNumber(6.25, parseDisplayNumber("12.5 MB", "de-DE")!, "de-DE")).toBe("6.3 MB")
  })

  it("text with no number is not a number", () => {
    expect(parseDisplayNumber("…", "en-US")).toBeNull()
  })
})
