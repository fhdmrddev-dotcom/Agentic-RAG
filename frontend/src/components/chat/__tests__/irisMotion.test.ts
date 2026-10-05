/**
 * 276-REVIEW B-WR-02 — the orbit settle never snaps.
 *
 * `cubic-bezier(.3, y1, .6, 1)` starts at speed `(y1 / .3) · remaining / dur`. The sketch's bar
 * (`.planning/sketches/276-iris-avatar/README.md` "Transitions never snap") is that this equals
 * the live spin speed and that the coast ends on a 120° stop (identical to rest by symmetry).
 * Before the fix, a stop closer than ~0.3·v·450° forced `y1` to its clamp of 1 and the ring
 * dropped up to ~15x in speed in one frame.
 */
import { describe, expect, it } from "vitest"
import { settleCoast } from "../irisMotion"

const ORBIT_MS = 4800 // one full 360° orbit at playbackRate 1 (3 × 1.6 s, 120° per cycle)
const RATES = { thinking: 1, tool: 1.45, streaming: 0.8 }

function startSpeed(ang: number, v: number): { start: number; target: number; y1: number } {
  const { target, dur, y1 } = settleCoast(ang, v)
  return { start: (y1 / 0.3) * ((target - ang) / dur), target, y1 }
}

describe("settleCoast — the orbit coasts to a 120° stop at the live speed (B-WR-02)", () => {
  for (const [state, rate] of Object.entries(RATES)) {
    const v = (360 / ORBIT_MS) * rate
    it(`${state}: every pose (0.25° steps) starts within 1% of the live speed and ends on a 120° stop`, () => {
      for (let ang = 0; ang < 360; ang += 0.25) {
        const { start, target, y1 } = startSpeed(ang, v)
        expect(target % 120, `ang=${ang}`).toBe(0)
        expect(target, `ang=${ang}`).toBeGreaterThan(ang) // forward, never a rewind
        expect(y1, `ang=${ang}`).toBeLessThan(1) // the clamp never binds
        expect(Math.abs(start - v) / v, `ang=${ang}: start ${start} vs live ${v}`).toBeLessThan(0.01)
      }
    })
  }

  it("1° short of a stop at the tool rate goes on to the FOLLOWING stop instead of creeping", () => {
    const v = (360 / ORBIT_MS) * RATES.tool
    const { target } = settleCoast(119, v)
    expect(target).toBe(240)
  })

  it("far from the next stop it still takes the NEXT stop", () => {
    const v = (360 / ORBIT_MS) * RATES.thinking
    expect(settleCoast(10, v).target).toBe(120)
  })
})
