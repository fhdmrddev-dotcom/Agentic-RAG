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

/**
 * Phase 243 Plan 03 (CHAT-02 / D-243-15) — the ACCUMULATING, LEADING-EDGE coalescer.
 *
 * ── REUSE THE SHAPE, NOT THE FUNCTION (`useLiveValidation.ts:11-22`'s precedent) ──
 *
 * `makeThrottle` above is the house timer closure and this is composed from its shape:
 * one `setTimeout`, one `.flush()`, no dependency added. It is a SEPARATE export, and
 * ⛔ `makeThrottle` must not be "unified" with it, because the delta path needs the
 * OPPOSITE of `makeThrottle` on BOTH of its axes, and `makeThrottle`'s contract is
 * correct for the call site it already has (the localStorage cache writer,
 * `StreamsProvider.tsx:3525`, pinned by `__tests__/lib/throttle.test.ts`):
 *
 *   1. `makeThrottle` is LAST-WRITE-WINS (`:19,28` — `lastArgs = args` discards the
 *      previous call). For a cache writer that is exactly right: only the newest
 *      snapshot matters. For a token stream it is DATA LOSS — the accumulation lives
 *      in the caller (`m.content + delta`), so a discarded call is a discarded token.
 *      This coalescer therefore carries NO ARGUMENTS AT ALL. The buffer lives in the
 *      caller's closure and `apply` drains it, so there is nothing a window can drop.
 *   2. `makeThrottle` has NO LEADING EDGE (`:8-9`, deliberate — N writes per burst
 *      would defeat the batch). For a reply that is a visible pause of up to `waitMs`
 *      before the first character appears. This coalescer fires the FIRST call
 *      synchronously and coalesces only what follows.
 *
 * Cadence guarantee: after the leading fire, `apply` runs at most once per `waitMs`
 * for as long as calls keep arriving, and never when nothing is pending. `flush()`
 * drains immediately and closes the window, so the next call leads again — which is
 * what makes it correct at a terminal edge.
 */
export function makeAccumulatingCoalescer(
  apply: () => void,
  waitMs: number,
): (() => void) & { flush: () => void } {
  let timer: ReturnType<typeof setTimeout> | null = null
  let pending = false

  const onWindowEnd = () => {
    timer = null
    if (!pending) return
    pending = false
    apply()
    // A fire always opens a new window, so the cadence stays bounded for as long as
    // calls keep arriving. The window closes only on a tick with nothing pending.
    timer = setTimeout(onWindowEnd, waitMs)
  }

  const coalesced = (() => {
    if (timer === null) {
      apply() // leading edge
      timer = setTimeout(onWindowEnd, waitMs)
      return
    }
    pending = true
  }) as (() => void) & { flush: () => void }

  coalesced.flush = () => {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
    if (pending) {
      pending = false
      apply()
    }
  }

  return coalesced
}
