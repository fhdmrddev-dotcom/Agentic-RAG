/**
 * Phase 276-06 / 276-REVIEW B-WR-02 — the Iris avatar's settle arithmetic, pure so it can be
 * unit-tested (jsdom has no getAnimations, so IrisAvatar's WAAPI path never runs under test).
 * Seamless-loop rules: .planning/sketches/276-iris-avatar/README.md ("Transitions never snap").
 */

/** The settle's floor and ceiling (ms), and the easing's x1 (`cubic-bezier(.3, y1, .6, 1)`). */
const SETTLE_MIN_MS = 450
const SETTLE_MAX_MS = 1400
const EASE_X1 = 0.3

/**
 * The orbit's settle: coast FORWARD from `ang` (deg) to a 120° stop — identical to rest by the
 * mark's symmetry, so it never rewinds — starting at the live speed `v` (deg/ms).
 *
 * The bezier's starting speed is `(y1 / x1) · remaining / dur`; matching `v` needs
 * `y1 = x1 · v · dur / remaining`, which must stay ≤ 1. 276-REVIEW B-WR-02: ~~always the NEXT
 * stop, `y1` clamped to 1~~ — when the next stop was close, the 450 ms floor forced the clamp and
 * the ring dropped up to ~15× in speed in one frame, then crept (≈10% of settles). Now, when the
 * next stop is closer than `x1 · v · SETTLE_MIN_MS` (the distance the floor can absorb at slope
 * ≤ 1), the coast goes on to the FOLLOWING stop, so the clamp never binds and the start matches.
 */
export function settleCoast(ang: number, v: number): { target: number; dur: number; y1: number } {
  let target = Math.ceil((ang + 0.001) / 120) * 120 // next 120° stop = identical to rest
  if (target - ang < EASE_X1 * v * SETTLE_MIN_MS) target += 120 // too close to arrive smoothly
  const remaining = Math.max(target - ang, 1)
  const dur = Math.max(SETTLE_MIN_MS, Math.min(SETTLE_MAX_MS, (2 * remaining) / v))
  const y1 = Math.min(1, EASE_X1 * ((v * dur) / remaining)) // initial slope = current speed
  return { target, dur, y1 }
}
