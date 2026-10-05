/**
 * Phase 276-06 / 276-REVIEW B-WR-02 / 276 G4-avatar — the Iris avatar's motion arithmetic (the
 * settle coast and the shared phase clock), pure so it can be unit-tested (jsdom has no
 * getAnimations, so IrisAvatar's WAAPI path only runs under test with a stub).
 * Seamless-loop rules: .planning/sketches/276-iris-avatar/README.md ("Transitions never snap").
 */

/**
 * One full orbit at playbackRate 1 (ms) — `irisOrbitTurn 4.8s` in index.css (fenced by
 * IrisAvatar.test.tsx). The wave (1.6 s) and glow (1.6 s) periods divide it, and every loop
 * animation in an avatar shares ONE currentTime (the per-petal offsets are CSS delays), so a
 * position modulo this period places the ring, the wave and the glow at once.
 */
export const ORBIT_MS = 4800

/**
 * 276 G4-avatar — the SHARED PAGE CLOCK every working avatar is phase-locked to.
 *
 * The live assistant row REMOUNTS when the send POST resolves: the placeholder is keyed by its
 * `temp-…` id until `runId` is stamped on it, then `run-${runId}` (MessageList.tsx), so a fresh
 * IrisAvatar mounted and its CSS loops began at currentTime 0 — measured live as a one-frame
 * 14.6° → 0° snap of the ring ~2.6 s into `thinking`. Keys are not ours to change (MessageItem
 * is a G-5 hot file), so instead no avatar owns its own phase: the clock records where the
 * loops were (`pos`, ms into the orbit cycle) at `document.timeline` time `at`, advancing at
 * `rate`, and a newly mounted avatar starts exactly where that puts the previous one.
 */
export interface PhaseClock {
  /** document.timeline time (ms) the reading was taken at */
  at: number
  /** loop position at `at`, ms into the orbit cycle, [0, ORBIT_MS) */
  pos: number
  /** playbackRate at `at` */
  rate: number
}

/** `x` folded into [0, ORBIT_MS). */
export function orbitPos(x: number): number {
  return ((x % ORBIT_MS) + ORBIT_MS) % ORBIT_MS
}

/**
 * Where the loops are at timeline time `now`. With no reading yet (the first avatar on the
 * page) the timeline itself is the clock, so any two avatars started cold still agree.
 */
export function clockPhase(clock: PhaseClock | null, now: number): number {
  if (!clock) return orbitPos(now)
  return orbitPos(clock.pos + (now - clock.at) * clock.rate)
}

/**
 * The WAAPI `startTime` that puts an animation playing at `rate` at position `pos` when the
 * timeline reads `now` (currentTime = (timeline − startTime) · rate). Setting startTime, not
 * currentTime, also resolves a pending CSS animation on the spot — no one-frame hold.
 */
export function startTimeFor(pos: number, rate: number, now: number): number {
  return now - pos / rate
}

let sharedClock: PhaseClock | null = null

export function readPhaseClock(): PhaseClock | null {
  return sharedClock
}

export function writePhaseClock(clock: PhaseClock): void {
  sharedClock = { at: clock.at, pos: orbitPos(clock.pos), rate: clock.rate }
}

/** Test-only: forget every reading. */
export function resetPhaseClock(): void {
  sharedClock = null
}

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
