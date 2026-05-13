/**
 * Phase 068.5: Trailing-edge throttle with explicit `.flush()` method.
 *
 * Used by <StreamsProvider> (D-068.5-03) to batch writes to localStorage
 * during streaming (~500ms cadence) while still guaranteeing a clean
 * snapshot at terminal events + on thread switch via `.flush()`.
 *
 * No leading-edge fire (would cause N writes per stream burst, defeating
 * the batch). No max-wait (the trailing window is bounded by waitMs).
 * No this-binding (Zustand subscribers don't need it).
 *
 * Canonical reference: 068.5-RESEARCH.md §Pattern 2 lines 304-340.
 */
export function makeThrottle<T extends (...args: never[]) => void>(
  fn: T,
  waitMs: number,
): T & { flush: () => void } {
  let timer: ReturnType<typeof setTimeout> | null = null
  let lastArgs: Parameters<T> | null = null
  const invoke = () => {
    timer = null
    if (lastArgs) {
      fn(...lastArgs)
      lastArgs = null
    }
  }
  const throttled = ((...args: Parameters<T>) => {
    lastArgs = args
    if (timer === null) {
      timer = setTimeout(invoke, waitMs)
    }
  }) as T & { flush: () => void }
  throttled.flush = () => {
    if (timer !== null) {
      clearTimeout(timer)
      invoke()
    }
  }
  return throttled
}
