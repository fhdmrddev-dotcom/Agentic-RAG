/**
 * Phase 235 plan 04 (SURF-02 / SURF-03) — THE ONE CLIENT-SIDE READER OF THE SOURCE VERDICT.
 *
 * ── ⛔ RULE 1 · D-235-05 — THIS HOOK DERIVES NOTHING ──────────────────────────────────
 *
 * The debounce rule ("how many soft failures in a row before a source counts as stopped")
 * lives on the SERVER and has ALREADY been applied by the time `stopped[]` arrives. Client-side
 * derivation of the verdict was considered and REJECTED at scoping, because a second decider
 * means the rail badge, the Library Health row and the source card can disagree with each other
 * about the same source — three surfaces, three answers, and nobody able to say which is right.
 *
 * So: `stopped` is passed through UNTOUCHED. No filtering, no re-counting, no "looks failed to
 * me" second-guessing. An empty array means *nothing is stopped*, even when the reader is off
 * and a failure is visible somewhere else on the screen. The suite proves this by reading this
 * file's own source rather than by asserting it in prose.
 *
 * ── ⛔ RULE 2 · D-v2.5-03 — REALTIME IS A HINT, NEVER TRUTH ───────────────────────────
 *
 * This hook POLLS, on the cadence the server names in its own response. No Supabase Realtime
 * subscription is added here. If one is ever added as a hint, it MUST fetch-reconcile on
 * (re)connect rather than trusting a payload — `useDocuments.ts` is the shipped precedent for
 * that discipline, and this docblock exists so the next author reaches for it instead of
 * treating a socket message as the new verdict.
 *
 * ── ⚠ `loading` IS PART OF THE CONTRACT (SEED-248) ───────────────────────────────────
 *
 * `useDocuments.ts` is that seed's named gap: it exposes no loading flag, so its consumers
 * cannot tell "no sources need attention" from "we have not asked yet". Those two states look
 * identical and mean opposite things. `loading` is therefore returned, not left to be inferred
 * from an empty array.
 *
 * ── A FAILING PROBE MUST NOT BLANK THE SHELL ─────────────────────────────────────────
 *
 * A rejected fetch keeps the PREVIOUS verdict, settles `loading`, and never throws. The health
 * probe is an accessory to every page; it is not allowed to take one down.
 */

import { useCallback, useEffect, useRef, useState } from "react"

import { getSourceHealth, type SourceHealth, type StoppedSource } from "@/lib/api/sources"

/**
 * Before the first response there is no server-named cadence to obey. 60s is a deliberately
 * SLOW opening beat — the first real response replaces it, and being late once costs nothing
 * next to polling an unknown endpoint hard.
 */
const FALLBACK_POLL_SECONDS = 60

export interface SourceAttention {
  /** The server's verdict, verbatim. Never re-derived here. */
  stopped: StoppedSource[]
  /** ⛔ The LIVE reader, not the config flag (RESEARCH C-4). */
  readerRunning: boolean
  /** The cadence the server asked for; the poll below obeys it. */
  pollIntervalSeconds: number
  /** True until the first response settles, success or failure. */
  loading: boolean
  /**
   * ⛔ HAS A VERDICT EVER ARRIVED? (Phase 235 plan 11 · T-235-39)
   *
   * `loading` alone cannot separate the three truths a consumer has to tell apart. After a
   * rejected first probe `loading` is `false` and `stopped` is `[]` — byte-identical to the
   * server saying *nothing is wrong*. A surface reading only those two would print an
   * all-clear it never received, which is the repudiation this flag exists to stop.
   *
   *   loading            → we have not looked yet
   *   !loading && !this  → we could not ask
   *   !loading && this   → the server answered, and `stopped` is its whole answer
   *
   * ⚠ It stays TRUE once a verdict has landed, even if a LATER probe rejects — the hook's
   * own rule is that a failure keeps the previous verdict, and a slightly stale answer is
   * better than a blank one.
   */
  verdictKnown: boolean
  /** Re-fetch now, aborting whatever is in flight. */
  refresh: () => void
}

export function useSourceAttention(): SourceAttention {
  const [verdict, setVerdict] = useState<SourceHealth | null>(null)
  const [loading, setLoading] = useState(true)

  const inFlight = useRef<AbortController | null>(null)

  const refresh = useCallback(() => {
    // The newest ask wins: whatever is still open is abandoned rather than raced.
    inFlight.current?.abort()
    const controller = new AbortController()
    inFlight.current = controller

    getSourceHealth(controller.signal)
      .then((next) => {
        if (controller.signal.aborted) return
        setVerdict(next)
        setLoading(false)
      })
      .catch(() => {
        // An abort is not a failure — the replacement fetch owns the outcome.
        if (controller.signal.aborted) return
        // A real failure keeps the previous verdict. Silence is better than a wrong verdict,
        // and a blank shell is worse than a slightly stale one.
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    refresh()
    return () => {
      inFlight.current?.abort()
    }
  }, [refresh])

  const pollIntervalSeconds = verdict?.poll_interval_seconds ?? FALLBACK_POLL_SECONDS

  useEffect(() => {
    const id = setInterval(refresh, pollIntervalSeconds * 1000)
    return () => {
      clearInterval(id)
    }
  }, [refresh, pollIntervalSeconds])

  return {
    stopped: verdict?.stopped ?? [],
    readerRunning: verdict?.reader_running ?? false,
    pollIntervalSeconds,
    loading,
    // Derived from state the hook already holds — no second `useState`, no second effect.
    verdictKnown: verdict !== null,
    refresh,
  }
}
