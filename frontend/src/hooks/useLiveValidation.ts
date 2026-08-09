/**
 * Phase 184-06 (VALID-02 / VALID-03 · D-184-13 · D-184-14 · D-184-15) — the live
 * structural-validation loop.
 *
 * THIS HOOK OWNS THE ONLY CALL TO THE SERVER'S VALIDATION SEAM IN THE WHOLE APP.
 * `WorkflowCanvas.tsx` carries a shipped source fence forbidding it from naming that
 * route at all, and honouring the fence forces the better architecture for free: the
 * canvas receives `verdicts` as a PROP, the transport lives here and in `lib/api.ts`,
 * and Phase 188 can reuse this shape for live run state without touching the canvas.
 *
 * ── COMPOSED, NOT COPIED (the `usePanelReconcile.ts:1-26` precedent) ────────────────
 *
 * There is no shipped debounced-fetch hook to copy, so this one is composed from the two
 * halves the app already has:
 *   1. The AbortController half — `usePanelReconcile.ts:114-130` (a controller per effect
 *      run, aborted in the cleanup) plus its double-shaped abort-error check at `:84-92`,
 *      copied verbatim rather than paraphrased.
 *   2. The timer half — `lib/throttle.ts`'s hand-rolled `setTimeout` closure, which is the
 *      house answer to "do not add a debounce dependency". Its SHAPE is reused, not the
 *      function: `makeThrottle` is a trailing-edge THROTTLE (it fires a fixed interval
 *      after the FIRST call and ignores the rest), and D-184-13 needs a DEBOUNCE, which
 *      restarts its timer on every call. Hence `clearTimeout` on every effect run.
 *
 * ── LAST-WRITE-WINS IS ENFORCED TWICE, DELIBERATELY (D-184-13) ─────────────────────
 *
 * BELT — `controller.abort()` in the effect cleanup, alongside `clearTimeout`. An edit
 * inside the debounce window issues ZERO requests; an edit after it cancels the in-flight
 * one.
 *
 * BRACES — a monotonic sequence number. `seqRef` is incremented once per effect run and
 * `appliedRef` records the highest sequence already rendered; a resolution whose sequence
 * is not strictly higher is DROPPED. This is not redundancy for its own sake: abort is
 * best-effort, and a response already sitting in the network buffer when `abort()` fires
 * still resolves. The sequence check is therefore the FIRST and ONLY staleness test in the
 * success path — deliberately NOT an `aborted` check, because a test that passed on abort
 * would prove nothing about the case abort cannot cover, and R7's out-of-order proof has
 * to fail when this guard is removed.
 *
 * ── EVERY NON-200 IS FAIL-CLOSED, AND THE CAUSE IS KEPT (D-184-14) ────────────────
 *
 * A failed check NEVER produces a clean reading. `degraded` carries no `ok` field at all,
 * so "a database blip rendered as a green light" is not a representable state rather than
 * a bug we test for. The BEHAVIOUR is uniform; the WORDING is not, and the caller words it
 * (184-08 / 184-13): `"unreadable"` is the shape-rejection case and reads *"We couldn't
 * check this — the workflow's shape isn't something we can read yet."*, while
 * `"unreachable"` covers an unreachable server, an expired token, a mid-session flag flip
 * and a timeout, and reads *"We couldn't reach the check."* A user hitting a reproducible
 * shape rejection must not be told to retry forever, which is why one cause is not enough.
 * The rejected body itself is logged at the `lib/api.ts` boundary and never travels with
 * the error — nothing reachable from `ValidationState` contains it.
 *
 * ── THE CLIENT CLASSIFIES NOTHING (VALID-03 / D-182-06) ───────────────────────────
 *
 * `code`, `message` and the severity field are passed through exactly as received,
 * including for codes this client has never seen — the server's own classifier already
 * fails closed on an unknown code, and a second opinion here would be a fork of a rule set
 * that has exactly one owner. There is no allow-list, no re-mapping and no comparison
 * against any severity literal anywhere in this file.
 *
 * ── NO CALL BEFORE THE FIRST EDIT (D-184-15) ──────────────────────────────────────
 *
 * While `enabled` is false or `def` is null the hook issues nothing and reports `idle`.
 * The caller holds `enabled` false until the author's first edit, so a brand-new zero-step
 * draft is never greeted with a not-ok envelope and a full problems tray — the empty
 * canvas shows an INVITATION instead, which is not a claimed verdict and therefore not
 * client-side validation. The moment a step exists the loop takes over and the server owns
 * every verdict from then on.
 *
 * ── TWO FEEL RULES (recorded in 184-CONTEXT under Claude's Discretion) ─────────────
 *
 *   - Verdicts are HELD STALE, never cleared, while a check is in flight (`checking:
 *     true`), because clearing them makes every node's mark flicker on every keystroke.
 *   - The checking beat has a MINIMUM VISIBLE DURATION, so a fast answer cannot make it
 *     strobe. The minimum is implemented as a second timer rather than a clock read, so it
 *     behaves identically under fake timers and in a browser.
 *
 * ── CALLER CONTRACT ───────────────────────────────────────────────────────────────
 *
 * The loop keys on the definition's IDENTITY. The caller must produce a new object per
 * EDIT and not per render (a `useMemo` over the store's phases reference does this) —
 * a fresh object literal built during render would re-fire the loop on every render, and
 * a mutated-in-place object would never fire it at all.
 */
import { useEffect, useRef, useState } from "react"

import { validateWorkflow, type Verdict, type WorkflowDefinitionJSON } from "@/lib/api"
import type { ServerVerdict } from "@/components/workflows/builderStore"

/** The quiet period an edit burst coalesces over before one request is issued (D-184-13).
 *  ONE window covers structural and config edits alike — the server has an opinion about
 *  both, so splitting them would mean two loops disagreeing about which answer is current. */
export const VALIDATE_DEBOUNCE_MS = 500

/** The minimum time the checking beat stays visible once it has started, so a fast answer
 *  cannot make it strobe on every keystroke. */
export const CHECKING_MIN_VISIBLE_MS = 300

/** Why the live check could not produce an answer (D-184-14). Same fail-closed behaviour
 *  either way; the caller words them differently because the two mean different things to
 *  the person reading them. */
export type DegradedValidationCause = "unreadable" | "unreachable"

/**
 * The loop's four distinguished states, in the `PublishOutcome` discriminated-union idiom
 * whose own docblock states the rule this inherits: *a binary ok/error handler is
 * FORBIDDEN*. A boolean pair could represent "clean AND degraded" and "checking AND idle";
 * this cannot.
 *
 *   idle      — nothing has been asked yet (D-184-15), and nothing is claimed.
 *   checking  — the FIRST check is in flight and there is no previous answer to hold. It
 *               deliberately carries no `ok` field: an unanswered check must not be able to
 *               render as a verdict of any kind.
 *   verdicts  — the server answered. `ok` and the array are its words, not ours.
 *   degraded  — the check did not run. There is no `ok` here BY CONSTRUCTION, so no code
 *               path can turn a failed check into a clean reading. `verdicts` carries the
 *               previous answer forward, held stale, so marks dim rather than vanish.
 */
export type ValidationState =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "verdicts"; ok: boolean; verdicts: Verdict[]; checking: boolean }
  | {
      kind: "degraded"
      cause: DegradedValidationCause
      verdicts: Verdict[]
      checking: boolean
    }

/**
 * ONE SHAPE, TWO DECLARATIONS, BRIDGED AT COMPILE TIME.
 *
 * `builderStore.ts` declared `ServerVerdict` first, and `lib/api.ts` declares `Verdict` as
 * the wire shape. Neither can import the other: the store carries a source fence forbidding
 * it from naming the API client (so an undo can never write to the server), and the API
 * client must not depend on a store that type-imports the Builder page. This hook is the
 * one module that legitimately sees both, so the equivalence is asserted HERE — a drift in
 * either declaration becomes a typecheck error instead of a silent divergence.
 *
 * EXPORTED on purpose: an unreferenced local type alias is dead weight the linter removes
 * and the assertion dies with it. Exporting keeps it live without anyone needing to use it.
 */
type MutuallyAssignable<A extends B, B> = [A, B]
export type VerdictBridge = [
  MutuallyAssignable<Verdict, ServerVerdict>,
  MutuallyAssignable<ServerVerdict, Verdict>,
]

/** The previous answer, carried forward so a check in flight dims marks instead of
 *  clearing them. Nothing to carry before the first answer. */
function heldVerdicts(state: ValidationState): Verdict[] {
  return state.kind === "verdicts" || state.kind === "degraded" ? state.verdicts : []
}

/** Begin the beat: hold whatever the server last said, dimmed. */
function beginBeat(state: ValidationState): ValidationState {
  if (state.kind === "verdicts" || state.kind === "degraded") {
    return { ...state, checking: true }
  }
  return { kind: "checking" }
}

/**
 * An abort caused by a newer edit is NOT a failure and must never surface as degraded
 * (D-184-14). The double-shaped check is copied verbatim from `usePanelReconcile.ts:84-92`
 * — the second arm catches an abort-shaped rejection that is not an `Error` instance,
 * which is what a cross-realm or polyfilled reject can hand back.
 */
function isAbortError(err: unknown): boolean {
  if (err instanceof Error && err.name === "AbortError") return true
  if (err && typeof err === "object" && "name" in err && (err as { name: string }).name === "AbortError")
    return true
  return false
}

/**
 * Which honest line the caller should render. Branches on the error's NAME rather than on
 * `instanceof`, so a rejection that crossed a module or realm boundary still classifies —
 * and so this never has to parse a message. Anything that is not the typed shape rejection
 * is the unreachable class: a real network failure, a timeout, an expired token, and a
 * mid-session flag flip all mean "we could not get an answer", and all of them fail closed.
 */
function causeOf(err: unknown): DegradedValidationCause {
  const name =
    err && typeof err === "object" && "name" in err ? (err as { name: string }).name : ""
  return name === "WorkflowValidateUnreadableError" ? "unreadable" : "unreachable"
}

/**
 * @param def      The definition to check, or null while there is nothing to check.
 * @param enabled  False until the author's first edit (D-184-15). While false, and while
 *                 `def` is null, the hook issues NOTHING.
 */
export function useLiveValidation(
  def: WorkflowDefinitionJSON | null,
  enabled: boolean,
): ValidationState {
  const [state, setState] = useState<ValidationState>({ kind: "idle" })

  // Monotonic per effect run. Survives a StrictMode double-invoke: the first run's timer is
  // cleared by its own cleanup before it can fire, and the second run simply takes the next
  // sequence number.
  const seqRef = useRef(0)
  // The highest sequence already rendered. A resolution that is not strictly newer is dropped.
  const appliedRef = useRef(0)

  useEffect(() => {
    // D-184-15 — nothing is asked, and nothing is claimed. A previously rendered answer is
    // deliberately NOT wiped here: discarding the server's last word without a new one would
    // be the client asserting something on its own.
    if (!enabled || def === null) return

    const seq = ++seqRef.current
    const controller = new AbortController()
    let minVisibleTimer: ReturnType<typeof setTimeout> | null = null
    // Per-beat bookkeeping for the minimum-visible rule. Two independent events end the
    // beat and either can happen first, so both are recorded and whichever is last clears it.
    const beat = { minElapsed: false, settled: false }

    const endBeatIfReady = () => {
      if (!beat.minElapsed || !beat.settled) return
      // Only the CURRENT beat may clear the flag — a superseded beat's timer must not turn
      // off the indicator belonging to the check that replaced it.
      if (seq !== seqRef.current) return
      setState((s) =>
        s.kind === "verdicts" || s.kind === "degraded" ? { ...s, checking: false } : s,
      )
    }

    const debounceTimer = setTimeout(() => {
      setState(beginBeat)
      minVisibleTimer = setTimeout(() => {
        beat.minElapsed = true
        endBeatIfReady()
      }, CHECKING_MIN_VISIBLE_MS)

      validateWorkflow(def, controller.signal)
        .then((res) => {
          // BRACES, and the only staleness test on this path — see the docblock.
          if (seq <= appliedRef.current) return
          appliedRef.current = seq
          beat.settled = true
          setState({
            kind: "verdicts",
            ok: res.ok,
            verdicts: res.verdicts,
            checking: !beat.minElapsed,
          })
        })
        .catch((err: unknown) => {
          // Superseded by a newer edit — dropped silently, never degraded.
          if (isAbortError(err)) return
          if (seq <= appliedRef.current) return
          appliedRef.current = seq
          beat.settled = true
          setState((s) => ({
            kind: "degraded",
            cause: causeOf(err),
            verdicts: heldVerdicts(s),
            checking: !beat.minElapsed,
          }))
        })
    }, VALIDATE_DEBOUNCE_MS)

    return () => {
      // An edit inside the window cancels the pending call outright — zero requests issued.
      clearTimeout(debounceTimer)
      if (minVisibleTimer !== null) clearTimeout(minVisibleTimer)
      // BELT: an in-flight call is aborted. Every timer this effect created is cleared on
      // unmount too, following the shipped in-Builder transient-timer precedent.
      controller.abort()
    }
  }, [def, enabled])

  return state
}
