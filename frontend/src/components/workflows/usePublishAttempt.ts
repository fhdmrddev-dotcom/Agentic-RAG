// ─────────────────────────────────────────────────────────────────────────────
// Phase 308.1-04 (BUG-261107-01; D-03, D-19, D-21, D-24; UI-SPEC §State machine, rules 1-9) —
// the publish screen's request/follow logic.
//
// The request/follow logic MOVED from PublishGauntlet.tsx :724-771 per D-03 (its `outcome`,
// `error` and `elapsedSec` state, the ticker and `runGauntlet`, the PASS rule verbatim), then
// was made to follow a server-side run. Before 308.1 the POST held one HTTP request open for the
// whole golden run — minutes — and the browser answered "Failed to fetch" when anything between
// it and the worker gave up. The POST now answers 202 with a HANDLE; this hook follows that
// handle with `GET /workflows/{id}/publish` until a verdict is ready, and picks it up again
// when the modal is reopened.
//
// Shape copied from `hooks/useWorkflowRun.ts`: a stale-response guard (`currentAttemptRef`, a
// request counter — only the newest read may write), a blip that never tears the view down
// (a transient read failure keeps the phase and keeps polling), and an interval gated on a
// non-terminal phase AND on the modal being open.
//
// ⚠ `start` and `read` are INJECTED, never imported here. The gauntlet passes `publishWorkflow`
//   and `getPublishAttempt`; that keeps the literal the gauntlet's own source test greps for in
//   the gauntlet, and lets this hook be driven with plain `vi.fn()`s.
// ⚠ The hook never re-derives pass/block: the server's verdict becomes the outcome verbatim,
//   and a dropped poll can never become one (T-308.1-18).
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useRef, useState } from "react"
import type { PublishAttempt, PublishOutcome, PublishVerdict } from "@/lib/api"

/** D-19 — how often a running attempt is re-read (inside D-19's 2-5 s band). */
const POLL_MS = 3000
/** D-UI-06 — consecutive failed reads before the follow-error line shows. */
const FOLLOW_ERROR_AFTER = 2
/** UI-SPEC rule 3 — the elapsed clock's beat. */
const TICK_MS = 1000

export type PublishPhase = "opening" | "idle" | "submitting" | "running" | "finishing" | "done" | "lost"

export interface UsePublishAttemptArgs {
  definitionId: string
  /** The modal is open. Reads and polling happen only while it is. */
  open: boolean
  /** `publishWorkflow`-shaped. */
  start: (definitionId: string, goldenInput: string) => Promise<PublishOutcome>
  /** `getPublishAttempt`-shaped; throws an error carrying `status` on a non-2xx. */
  read: (definitionId: string) => Promise<PublishAttempt>
  onPublished?: (version: number, notes: readonly string[]) => void
}

export interface UsePublishAttempt {
  phase: PublishPhase
  outcome: PublishOutcome | null
  error: string | null
  /** The last attempt read while following (progress lives here). */
  attempt: PublishAttempt | null
  goldenRunId: string | null
  elapsedSec: number
  /** True after FOLLOW_ERROR_AFTER consecutive failed reads; false after the next good one. */
  followError: boolean
  submit: (goldenInput: string) => Promise<void>
  reset: () => void
}

function statusOf(e: unknown): number | null {
  if (e && typeof e === "object" && "status" in e) {
    const s = (e as { status: unknown }).status
    return typeof s === "number" ? s : null
  }
  return null
}

/** A finished attempt's verdict as the outcome the POST would have answered. A tail whose
 *  flip lost answers `already_published` — the POST used to say that with HTTP 409. */
function outcomeOfVerdict(verdict: PublishVerdict): PublishOutcome {
  if (verdict.blocked_stage === "already_published") return { kind: "already_published" }
  return { kind: "verdict", verdict }
}

function isFollowing(phase: PublishPhase): boolean {
  return phase === "running" || phase === "finishing"
}

export function usePublishAttempt({
  definitionId,
  open,
  start,
  read,
  onPublished,
}: UsePublishAttemptArgs): UsePublishAttempt {
  const [phase, setPhase] = useState<PublishPhase>("opening")
  const [outcome, setOutcome] = useState<PublishOutcome | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState<PublishAttempt | null>(null)
  const [goldenRunId, setGoldenRunId] = useState<string | null>(null)
  const [followError, setFollowError] = useState(false)
  // The clock: `clickMs` anchors it until the first read answers; then the server's
  // `started_at` does. `nowMs` is the beat, so `elapsedSec` is derived, never stored.
  const [clickMs, setClickMs] = useState<number | null>(null)
  const [nowMs, setNowMs] = useState(() => Date.now())

  /** Stale-response guard: bumped by every read, submit, reset and close; only the newest
   *  request may write. */
  const currentAttemptRef = useRef(0)
  const failuresRef = useRef(0)
  /** onPublished fires once per golden_run_id per mount (D-UI-07). */
  const firedForRef = useRef<Set<string>>(new Set())
  const onPublishedRef = useRef(onPublished)
  const readRef = useRef(read)
  const startRef = useRef(start)
  useEffect(() => {
    onPublishedRef.current = onPublished
    readRef.current = read
    startRef.current = start
  })

  /** A terminal outcome. The PASS rule moved verbatim from the gauntlet. */
  const settle = useCallback((result: PublishOutcome) => {
    setOutcome(result)
    setAttempt(null)
    setFollowError(false)
    failuresRef.current = 0
    setPhase("done")
    // VERBATIM: a PASS is ONLY published === true (never re-derived).
    if (result.kind === "verdict" && result.verdict.published === true) {
      const key = result.verdict.golden_run_id ?? "__no_golden_run__"
      if (firedForRef.current.has(key)) return
      firedForRef.current.add(key)
      onPublishedRef.current?.(
        result.verdict.version ?? 0,
        (result.verdict.auto_answered ?? []).map((note) => note.message),
      )
    }
  }, [])

  /** Follow a running/finishing attempt the server answered. */
  const follow = useCallback((a: PublishAttempt) => {
    setAttempt(a)
    setGoldenRunId(a.golden_run_id)
    setNowMs(Date.now())
    setPhase(a.state === "finishing" ? "finishing" : "running")
  }, [])

  /** One read while following. A 404 (or the attempt gone) is `lost`; anything else that
   *  fails is transient and changes nothing but the follow-error count. */
  const poll = useCallback(async () => {
    const id = ++currentAttemptRef.current
    let a: PublishAttempt
    try {
      a = await readRef.current(definitionId)
    } catch (e) {
      if (id !== currentAttemptRef.current) return
      if (statusOf(e) === 404) {
        setAttempt(null)
        setFollowError(false)
        setPhase("lost")
        return
      }
      failuresRef.current += 1
      if (failuresRef.current >= FOLLOW_ERROR_AFTER) setFollowError(true)
      return
    }
    if (id !== currentAttemptRef.current) return
    failuresRef.current = 0
    setFollowError(false)
    if (a?.state === "running" || a?.state === "finishing") follow(a)
    else if (a?.state === "done" && a.verdict) settle(outcomeOfVerdict(a.verdict))
    else {
      setAttempt(null)
      setPhase("lost")
    }
  }, [definitionId, follow, settle])

  // ── Open: ask the server where this draft's publish is (D-21). ──
  // Every open (and every close) starts from `opening` with nothing carried over. The reset
  // is the "adjust state while rendering" pattern rather than a setState in the effect body
  // (react-hooks/set-state-in-effect); the effect only invalidates older reads and sends one.
  const openKey = open ? definitionId : null
  const [seenOpenKey, setSeenOpenKey] = useState<string | null>(null)
  if (openKey !== seenOpenKey) {
    setSeenOpenKey(openKey)
    setPhase("opening")
    setOutcome(null)
    setError(null)
    setAttempt(null)
    setGoldenRunId(null)
    setFollowError(false)
    setClickMs(null)
  }
  useEffect(() => {
    const id = ++currentAttemptRef.current
    failuresRef.current = 0
    if (!open) return
    // A client that throws synchronously is a failed read, never a crashed effect.
    let pending: Promise<PublishAttempt>
    try {
      pending = readRef.current(definitionId)
    } catch (e) {
      pending = Promise.reject(e)
    }
    pending.then(
      (a) => {
        if (id !== currentAttemptRef.current) return
        if (a?.state === "running" || a?.state === "finishing") follow(a)
        else if (a?.state === "done" && a.verdict) settle(outcomeOfVerdict(a.verdict))
        else setPhase("idle")
      },
      () => {
        // Safe to fall through: D-10 makes a POST on a draft with a running attempt answer
        // that attempt's 202 handle.
        if (id !== currentAttemptRef.current) return
        setPhase("idle")
      },
    )
  }, [open, definitionId, follow, settle])

  // ── Follow: one read every POLL_MS while running/finishing and the modal is open. ──
  const following = open && isFollowing(phase)
  useEffect(() => {
    if (!following) return
    const t = window.setInterval(() => void poll(), POLL_MS)
    return () => window.clearInterval(t)
  }, [following, poll])

  // ── The clock's beat, only while there is something to time. ──
  const timing = open && (phase === "submitting" || isFollowing(phase))
  useEffect(() => {
    if (!timing) return
    const t = window.setInterval(() => setNowMs(Date.now()), TICK_MS)
    return () => window.clearInterval(t)
  }, [timing])

  const startedAt = attempt?.progress?.started_at ? Date.parse(attempt.progress.started_at) : Number.NaN
  const anchorMs = Number.isNaN(startedAt) ? clickMs : startedAt
  const elapsedSec = timing && anchorMs != null ? Math.max(0, Math.floor((nowMs - anchorMs) / 1000)) : 0

  const submit = useCallback(
    async (goldenInput: string) => {
      const id = ++currentAttemptRef.current
      const clicked = Date.now()
      failuresRef.current = 0
      setClickMs(clicked)
      setNowMs(clicked)
      setError(null)
      setOutcome(null)
      setAttempt(null)
      setGoldenRunId(null)
      setFollowError(false)
      setPhase("submitting")
      let result: PublishOutcome
      try {
        result = await startRef.current(definitionId, goldenInput)
      } catch (e) {
        if (id !== currentAttemptRef.current) return
        const message = e instanceof Error ? e.message : "publish failed"
        // Rule 6: ONE read — the server may have started the run before the answer was lost.
        const readId = ++currentAttemptRef.current
        try {
          const a = await readRef.current(definitionId)
          if (readId !== currentAttemptRef.current) return
          if (a?.state === "running" || a?.state === "finishing") {
            follow(a)
            return
          }
        } catch {
          if (readId !== currentAttemptRef.current) return
        }
        setError(message)
        setPhase("idle")
        return
      }
      if (id !== currentAttemptRef.current) return
      if (result.kind === "running") {
        setGoldenRunId(result.verdict.golden_run_id)
        setPhase(result.verdict.state === "finishing" ? "finishing" : "running")
        await poll()
        return
      }
      settle(result)
    },
    [definitionId, follow, poll, settle],
  )

  const reset = useCallback(() => {
    currentAttemptRef.current += 1
    failuresRef.current = 0
    setOutcome(null)
    setError(null)
    setAttempt(null)
    setGoldenRunId(null)
    setFollowError(false)
    setClickMs(null)
    setPhase("idle")
  }, [])

  return { phase, outcome, error, attempt, goldenRunId, elapsedSec, followError, submit, reset }
}
