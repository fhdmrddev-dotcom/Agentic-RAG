import { describe, it, expect } from "vitest"
import { apportion100 } from "./BlindSpotsCard"

/**
 * ⛔ THE HONESTY GAUGE MUST NOT BE THE THING THAT IS WRONG. Phase 257, CR-06 follow-up.
 *
 * The first version of the three-segment gauge rounded each share independently and clamped
 * only the last one, so the first two were free to overflow: 8 runs with 7 priced and 1
 * unmeasured rendered "88% Priced · 13% No tokens" — 101% of a track 100% wide. Found by
 * gemini reviewing the CR-06 fix, which is exactly what that review was for.
 *
 * These cases are exhaustive rather than illustrative, because the defect was invisible at
 * the round numbers anyone would pick by hand: 851/343/332 sums to 100 perfectly fine.
 */
describe("apportion100 — segments that always sum to exactly 100", () => {
  it("sums to exactly 100 for every combination up to 40 runs per bucket", () => {
    const offenders: string[] = []
    for (let priced = 0; priced <= 40; priced++) {
      for (let unmeasured = 0; unmeasured <= 40; unmeasured++) {
        for (let unrated = 0; unrated <= 40; unrated++) {
          const sum = apportion100([priced, unmeasured, unrated]).reduce((a, b) => a + b, 0)
          if (sum !== 100) offenders.push(`${priced}/${unmeasured}/${unrated} -> ${sum}`)
        }
      }
    }
    expect(offenders).toEqual([])
  })

  it("closes the exact case the review found: 7 priced + 1 unmeasured over 8 runs", () => {
    // The pre-fix arithmetic gave 88 + 13 + 0 = 101.
    const [priced, unmeasured, unrated] = apportion100([7, 1, 0])
    expect(priced + unmeasured + unrated).toBe(100)
    expect(priced).toBe(88)
    expect(unmeasured).toBe(12)
  })

  it("reads an empty window as fully priced rather than as a bare track", () => {
    expect(apportion100([0, 0, 0])).toEqual([100, 0, 0])
  })

  it("never hands a bucket more than the whole, and never a negative share", () => {
    for (const parts of [[1, 0, 0], [0, 1, 0], [0, 0, 1], [1, 1, 1], [999, 1, 1]]) {
      const out = apportion100(parts)
      expect(out.reduce((a, b) => a + b, 0)).toBe(100)
      expect(out.every((n) => n >= 0 && n <= 100)).toBe(true)
    }
  })
})
