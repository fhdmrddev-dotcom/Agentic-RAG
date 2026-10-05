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
import {
  ORBIT_MS,
  clockPhase,
  orbitPos,
  readPhaseClock,
  resetPhaseClock,
  settleCoast,
  startTimeFor,
  writePhaseClock,
  type PhaseClock,
} from "../irisMotion"

// ORBIT_MS: one full 360° orbit at playbackRate 1 (3 × 1.6 s, 120° per cycle) — now exported by
// irisMotion and fenced against index.css's irisOrbitTurn duration in IrisAvatar.test.tsx.
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

/**
 * 276 G4-avatar — the shared page clock. The live assistant row remounts when its key moves from
 * `temp-…` to `run-${runId}`; a fresh avatar used to start its loops at 0 and the ring snapped
 * 14.6° → 0° in one frame. Every working avatar now reads one clock on `document.timeline` time.
 */
describe("clockPhase / startTimeFor — avatars mounted at different times share one phase (G4-avatar)", () => {
  it("with no reading yet the timeline itself is the clock, so two cold mounts agree", () => {
    // A mounts at t=1000 and plays at rate 1 from clockPhase(null, 1000); B mounts at t=3600.
    const aStart = startTimeFor(clockPhase(null, 1000), 1, 1000)
    const aAt3600 = orbitPos((3600 - aStart) * 1)
    expect(clockPhase(null, 3600)).toBeCloseTo(aAt3600, 9)
  })

  it.each(Object.entries(RATES))("%s: a later mount lands where the clock puts the earlier one", (_s, rate) => {
    const clock: PhaseClock = { at: 1000, pos: 700, rate }
    // the earlier avatar, locked at the reading, is at (now - startTime) · rate
    const aStart = startTimeFor(clock.pos, rate, clock.at)
    for (const now of [1000, 1016.7, 3600, 3600 + ORBIT_MS * 7 + 3]) {
      const a = orbitPos((now - aStart) * rate)
      const b = clockPhase(clock, now)
      // the later avatar, locked at `now`, reads the same position now and every frame after
      const bStart = startTimeFor(b, rate, now)
      expect(b, `now=${now}`).toBeCloseTo(a, 6)
      expect(orbitPos((now + 500 - bStart) * rate)).toBeCloseTo(orbitPos((now + 500 - aStart) * rate), 6)
    }
  })

  it("the clock advances at its recorded rate (a tween's re-reading carries the new speed)", () => {
    const clock: PhaseClock = { at: 0, pos: 0, rate: 1.45 }
    expect(clockPhase(clock, 1000)).toBeCloseTo(1450, 9)
    expect(clockPhase({ ...clock, rate: 0.8 }, 1000)).toBeCloseTo(800, 9)
  })

  it("positions fold into [0, ORBIT_MS), negatives included", () => {
    expect(orbitPos(ORBIT_MS)).toBe(0)
    expect(orbitPos(ORBIT_MS + 5)).toBe(5)
    expect(orbitPos(-5)).toBe(ORBIT_MS - 5)
  })

  it("writePhaseClock / readPhaseClock / resetPhaseClock hold one folded reading", () => {
    resetPhaseClock()
    expect(readPhaseClock()).toBeNull()
    writePhaseClock({ at: 10, pos: ORBIT_MS + 20, rate: 0.8 })
    expect(readPhaseClock()).toEqual({ at: 10, pos: 20, rate: 0.8 })
    resetPhaseClock()
    expect(readPhaseClock()).toBeNull()
  })
})
