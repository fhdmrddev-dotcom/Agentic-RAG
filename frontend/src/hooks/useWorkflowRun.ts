// ─────────────────────────────────────────────────────────────────────────────
// Phase 286 Plan 03 (REG-07 / D-09, 2026-10-18) — the run page's READ and its BEAT.
//
// MOVED VERBATIM from `pages/WorkflowRunPage.tsx`, every comment included. Nothing here
// was rewritten; the bodies were sliced out of the page by line, so a reader comparing this
// file against the page at the phase base finds the same bytes. The page calls both hooks at
// the positions the moved text used to occupy, so its effect order is unchanged.
//
// ⚠ WHY TWO HOOKS AND NOT ONE, and the reason is CR-01 rather than taste:
//
//   • `useWorkflowRun` owns the run READ — the four state/ref declarations, the mount read
//     with its stale-response guard and its 404 wording, and the CR-01 `refreshRun`. The
//     page calls it where those declarations used to sit, at the top of the component.
//
//   • `useWorkflowRunPoll` owns the run BEAT — the 5 s poll and the terminal edge. Both are
//     gated on `isTerminal`, and the PAGE derives `isTerminal` from the `run` value the
//     read wrote (the poll tears itself down on the very read that comes back terminal). So
//     the beat must be called AFTER that derivation. Folding both into one hook would either
//     move the derivation in with them (taking a fact the page owns) or call the beat before
//     the derivation exists, which re-opens CR-01. The page calls it where the two effects
//     used to sit, after the elapsed tick.
//
// The moved comments still say "above" where they meant a neighbour in the page: the poll's
// "1s clock above" and "WAKE handler above" are the page's tick and its wake listener, and
// "the mount effect above" inside `refreshRun`'s docblock is the read effect in this hook.
// They are kept as written because the move is byte-for-byte.
//
// ⚠ Every module is imported under the SAME specifier the page used (`@/lib/api`), so a
// test that mocks that specifier for the page still intercepts the reads made from here.
//
// ⚠ THIS FILE NAMES NONE OF THE FOUR THINGS THE PAGE IS FENCED AGAINST NAMING — the panel's
// file-list component, the previewer, the viewed-thread selector hook, and a second mount of
// the stop control. They are described in words here on purpose, the way the hot-file
// ledger describes them: a source sweep does not exempt prose.
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useRef, useState } from "react"
import { getWorkflowRun, type WorkflowRunRead } from "@/lib/api"
import { ApiError } from "@/lib/api"

/** CR-01 — how often the RUN row itself is re-read while it is still live. */
const RUN_POLL_MS = 5000

export type LoadPhase = "loading" | "ready" | "missing" | "broken"

/** The run READ: the state, the mount read (stale-response guard + 404 wording) and the
 *  CR-01 refresh. `setRetryNonce` is returned as-is so the page's Try-again handler stays
 *  byte-identical. */
export function useWorkflowRun(runId: string | null) {
  const [run, setRun] = useState<WorkflowRunRead | null>(null)
  const [loadPhase, setLoadPhase] = useState<LoadPhase>("loading")
  /** Bumped by "Try again" — a retry is a NEW read of the same id, never a mutation. */
  const [retryNonce, setRetryNonce] = useState(0)
  const currentRunRef = useRef(runId)

  // ── The read (the SkillStudioPage:75-100 stale-response guard, verbatim in shape) ──
  useEffect(() => {
    currentRunRef.current = runId
    // Reset on run switch — no prior run's payload, spine or verdict may leak onto a
    // newly-opened run.
    setRun(null)
    if (!runId) {
      setLoadPhase("loading")
      return
    }
    setLoadPhase("loading")
    const requested = runId
    let cancelled = false
    const alive = () => !cancelled && currentRunRef.current === requested
    getWorkflowRun(requested)
      .then((r) => {
        if (!alive()) return
        setRun(r)
        setLoadPhase("ready")
      })
      .catch((err: unknown) => {
        if (!alive()) return
        // 404 is BOTH "no such run" and "not yours" — the server makes them
        // indistinguishable on purpose (T-092-04), so the copy names both possibilities
        // rather than asserting the one we cannot know.
        const status = err instanceof ApiError ? err.status : 0
        setLoadPhase(status === 404 ? "missing" : "broken")
      })
    return () => {
      cancelled = true
    }
  }, [runId, retryNonce])

  /**
   * ⚠ CR-01 — RE-READ THE RUN ITSELF. A run-level status is the ONE fact no other source
   * on this surface carries: the phase slice knows about steps, the file list knows about
   * artefacts, and neither can tell you the run finished. Before this, `setRun` had exactly
   * one caller (the mount effect above, whose other key is bumped only by a button that
   * renders on the broken screen), so `band`, `isTerminal`, `ticking` and the alert were
   * all frozen at mount — the surface asserted a run was running at exactly the moment it
   * was not, with a clock still counting to make the claim actively.
   *
   * TWO RULES, both load-bearing:
   *   1. `loadPhase` is NEVER touched here. This is a refresh of a surface that already
   *      resolved, so a blip must leave the run standing rather than replacing it with the
   *      broken screen. Only the mount read owns the load phase.
   *   2. The stale-response guard is re-applied per call. A poll in flight across a run
   *      switch must not write the OLD run's payload over the new one — the same reason
   *      the mount read carries it.
   */
  const refreshRun = useCallback(() => {
    const requested = currentRunRef.current
    if (!requested) return
    getWorkflowRun(requested)
      .then((r) => {
        if (currentRunRef.current === requested) setRun(r)
      })
      .catch(() => {
        /* a blip must not tear down a good surface — see rule 1 above */
      })
  }, [])

  return { run, loadPhase, setRetryNonce, refreshRun }
}

/**
 * Exactly the identifiers the two moved effects read, under the same names, so both effect
 * bodies and both dependency arrays are byte-identical to the page's. The reconcile
 * callbacks are typed by shape only: this hook calls them and never inspects what they
 * return.
 */
export interface WorkflowRunPollArgs {
  runId: string | null
  loadPhase: LoadPhase
  isTerminal: boolean
  run: WorkflowRunRead | null
  refreshRun: () => void
  reconcile: () => unknown
  reconcileAsks: () => unknown
  reconcileStream: (threadId: string) => unknown
  reconcileFiles: () => unknown
}

/** The run BEAT: the 5 s poll and the terminal edge. Call it AFTER `isTerminal` is
 *  derived from the value `useWorkflowRun` wrote — see the header for why. */
export function useWorkflowRunPoll({
  runId,
  loadPhase,
  isTerminal,
  run,
  refreshRun,
  reconcile,
  reconcileAsks,
  reconcileStream,
  reconcileFiles,
}: WorkflowRunPollArgs): void {
  // CR-01: the run poll, sited HERE because it is gated on `isTerminal` and that is derived
  // just above. It runs ONLY while the run is non-terminal and the surface has resolved,
  // and it tears itself down the moment a read comes back terminal — `isTerminal` is a
  // dependency, and the value it reads is the one this poll wrote. So a finished run is
  // never re-read forever, and no interval survives a run switch.
  //
  // 5s is a deliberate order of magnitude apart from the 1s clock above: the clock is a
  // local render, the poll is a network read, and pinning them to the same beat would make
  // a per-second request out of a per-second repaint.
  // F1 (UAT 2026-08-05) — THE PHASE SLICE RIDES THIS SAME BEAT, and before it did the
  // canvas froze at its mount-time paint while a person watched it.
  //
  // Measured live: a 3-phase run whose DB rows read `completed / active / pending` painted
  // `Running / Not started / Not started` for 100 s on a VISIBLE tab. The reconcile
  // machinery was never broken — dispatching a wake event snapped the readings straight to
  // the truth. Nothing was DRIVING it. Two channels were meant to and neither could:
  //
  //   1. The STREAM. `reconcileStream` ran once, at mount — where the thread's
  //      `latest_producer_run_id` is legitimately `null` on an `llm_human_input` phase,
  //      because the producer run ends while the `workflow_run` stays active. One attempt
  //      against a value that is not there yet is the same as no attempt, so it is retried
  //      on the beat rather than assumed.
  //   2. The WAKE handler above, which fires on `visibilitychange` / `online` — neither of
  //      which happens to someone sitting and watching. "Watch a run" is this phase's goal
  //      and the watching case is precisely the one with no wake event in it.
  //
  // This is also the shape the project already mandates: Realtime is a hint, not a source of
  // truth — always reconcile via fetch (D-v2.5-03). The slice is now correct whether or not
  // an SSE connection ever arms, which is why the fix is a poll and not a second stream.
  useEffect(() => {
    if (!runId || loadPhase !== "ready" || isTerminal) return
    const threadId = run?.thread_id ?? null
    const tick = () => {
      refreshRun()
      if (!threadId) return
      void reconcile()
      void reconcileStream(threadId)
      // F5: the pending-ask slice rides the SAME beat. A step that starts waiting after
      // mount is precisely the case with no wake event in it — someone sitting and
      // watching — which is the F1 lesson applied to the second slice this page derives
      // a reading from.
      void reconcileAsks()
    }
    const id = window.setInterval(tick, RUN_POLL_MS)
    return () => window.clearInterval(id)
  }, [
    runId,
    loadPhase,
    isTerminal,
    refreshRun,
    run?.thread_id,
    reconcile,
    reconcileAsks,
    reconcileStream,
  ])

  // The terminal EDGE. The poll above tears itself down on the read that observes the
  // verdict, so that same tick is the last one — and the deliverable row is written as the
  // run finishes. Without a read here the final per-node state and the file both land after
  // the last poll and are never fetched. Gated on `isTerminal` so it fires once, on the
  // transition, not on every render of a finished run.
  useEffect(() => {
    if (!runId || loadPhase !== "ready" || !isTerminal) return
    if (!run?.thread_id) return
    void reconcile()
    void reconcileFiles()
  }, [runId, loadPhase, isTerminal, run?.thread_id, reconcile, reconcileFiles])
}
