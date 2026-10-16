/**
 * The eased fraction of the way from start to target, clamped to [0, 1].
 *
 * ⚠ The rAF timestamp is the FRAME's start time, which can be EARLIER than the
 * `performance.now()` the effect captured as `startTime` when the main thread was busy. An
 * unclamped negative `elapsed` made the cubic ease negative, and a mount animation from 0 to
 * 30,000 painted "-17,721 documents" (found by the Phase 284 G-4 drive at 50k).
 */
export function easedProgress(elapsed: number, duration: number): number {
  const progress = duration > 0 ? Math.min(Math.max(elapsed / duration, 0), 1) : 1
  return 1 - Math.pow(1 - progress, 3)
}
