/**
 * Phase 094 Plan 03 (PANEL-08 / A11Y-03) — PhaseTimeline: the live harness phase
 * spine in the workspace panel (sketch 008 harness-phase-timeline winner).
 *
 * The operator's #1 acceptance bar made real: "show the workflow's REAL steps,
 * not a spinner." The skeleton renders from the reconcile `total_phases` alone
 * (the spinner-killer); live events advance the rows FORWARD only — the "Phase
 * i / N" counter NEVER moves backward (reconcile is the floor — D-v2.5-03).
 *
 * Data sources (Plan 02 + the reconcile read):
 *  - usePhases(threadId): the panel-only phasesByThread slice (running→done→failed,
 *    the reconcile-floor skeleton seeded from total_phases on mount).
 *  - useTasks(threadId): the sub-agent rows + the batch-agent tally.
 *  - getThreadWorkflow(threadId): the run-level frame (definition_name, run_status,
 *    mode) the live stream cannot reconstruct from scratch.
 *
 * A11Y (UI-SPEC §A11Y, vitest-axe gated — zero violations in every state):
 *  - <section aria-label="Workflow run timeline"> + <ol aria-label="Phases">/<li>.
 *  - ONE role="status" aria-live="polite" visually-hidden announcer, PRESENT at
 *    load, written ONLY on transition edges (plain-language milestones), throttled
 *    — never per-token. Failures use the SEPARATE role="alert" inside PhaseCard.
 *  - aria-busy="true" on the populating list, flips false at a terminal run_status.
 *
 * SUPPRESS-DON'T-FAKE (D-03): the ONLY counts shown are phases.length, "Phase i/N",
 * the {n}-agents tally (sub_agent_start), and the run-level end-of-run sources.
 * NO per-phase tool/search/source chip (those fire on the invisible sub stream).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { usePhases, useTasks } from "@/providers/StreamsProvider"
import { getThreadWorkflow, type ThreadWorkflowState } from "@/lib/api"
import type { Phase } from "@/types"
// Phase 188 Plan 05 (SPEC Req 8 / D-188-02): the terminal-run set MOVED to the shared
// derivation module so the canvas run view reads the same one. `timed_out` is carried
// forward unchanged (D-188-21) — the measurement is recorded in that module's docblock.
import { TERMINAL_RUN_STATUSES } from "@/lib/phaseState"
// ── Phase 214-11 Task 2 (STEP-04 / D-214-16) — THE TIMELINE'S STEP IDENTITY IS `PhaseCard`'S,
//    AND THAT IS A DECISION RATHER THAN AN OMISSION.
//
// This module does not import `StepIdentity` and must not. It renders one `PhaseCard` per
// phase (`:359-362`) and passes the whole `Phase` row down, so the identity arrives here as a
// CONSEQUENCE of the card mounting it — which is precisely D-214-16's *"coverage should be a
// consequence of one component existing, not a list kept in sync."* A second mount here would
// be the second home the decision exists to prevent, and the two could then disagree about the
// same step on the same screen.
//
// ⚠ SO THE CLAIM IS VERIFIED AT RUNTIME, NOT BY A GREP OVER THIS FILE. `__tests__/
// PhaseTimeline.test.tsx` renders the timeline with an `external_action` row and asserts
// `[data-step-identity]` is really in the tree — *verify it renders, do not assume the child
// does*. A grep would be satisfied by this very paragraph, which is the 187-24 trap and is why
// the paragraph is not the evidence.
import { PhaseCard } from "./PhaseCard"
// WR-05 — the panel's status vocabulary, read from its ONE home rather than re-derived.
import { statusWord } from "./phaseStatusMeta"
// ── Phase 200-07 (DES-02 / D-06 / D-07) — the ONE resolver, imported rather than mirrored.
//
// `runFactsBySlug` is `200-05`'s slug → facts lookup, and it is the reason this file
// subtracts no timestamps of its own. It also reads its map through `own()`, which matters
// live rather than theoretically here: `workflow_phases.slug` is unconstrained `text`
// (migration 121 declined `SEED-143`'s CHECK with a recorded trigger), so a phase slugged
// `constructor` really can reach this layer — and a bare index would hand back a FUNCTION
// typed as a facts object, which React refuses to render, blanking the row with nothing on
// screen to say anything went wrong.
import { runFactsBySlug } from "@/components/workflows/phaseDuration"

/** The run-level reconcile frame this timeline needs (subset of ThreadWorkflowState).
 *
 *  ⚠ Phase 200-07 — `phases` JOINED THE PICK, and it is what makes the durable per-step
 *  timings reachable at all. `GET /threads/{id}/workflow` has carried them since `200-02`
 *  widened the Python model; the client mirror declared them only from `200-07`. **FETCH IS
 *  AUTHORITATIVE** (D-v2.5-03): these rows come from the read, never from an SSE frame, and
 *  a terminal run has no stream at all — which is the same reason this component's
 *  reconcile floor exists. */
type RunFrame = Pick<
  ThreadWorkflowState,
  "mode" | "definition_name" | "run_status" | "current_phase_index" | "total_phases" | "phases"
>


/** Find the active (running/retrying) phase index, else the last done, else 0. */
function activePhaseIndex(phases: Phase[]): number {
  const running = phases.findIndex((p) => p.status === "running" || p.status === "retrying")
  if (running !== -1) return running
  // No live row → the last done/failed is the furthest-advanced position.
  for (let i = phases.length - 1; i >= 0; i--) {
    if (phases[i].status !== "pending") return i
  }
  return 0
}

/**
 * Plain-language milestone for the announcer (one sentence per transition edge).
 *
 * ⚠ THIS SWITCH IS SILENT TO A WIDENED `Phase["status"]`. It carries a `default:` arm, so
 * a new member does NOT become a typecheck error here the way it does in `PhaseCard`'s
 * `STATUS_META` — it simply announces nothing, and a screen-reader user is told a step
 * reached a terminal by hearing nothing at all. That is why 189's arm below was added from
 * a written list of consumers rather than from a compiler run: only the list finds it.
 * Recorded so the next widening does not have to rediscover it.
 *
 * The `default:` arm STAYS. Silence is the correct announcement for a state this component
 * has no sentence for; inventing one would be the announcer's version of a fail-open.
 */
function milestoneFor(phase: Phase | undefined, total: number): string {
  if (!phase) return ""
  const ordinal = `Phase ${phase.phaseIndex + 1} of ${total}`
  switch (phase.status) {
    case "running":
      return `${ordinal}, ${phase.slug}, started`
    case "done":
      return `${ordinal}, ${phase.slug}, complete`
    case "failed":
      return `${ordinal}, ${phase.slug}, failed`
    case "retrying":
      return `${ordinal}, ${phase.slug}, retrying`
    case "skipped":
      return `${ordinal}, ${phase.slug}, skipped`
    // Phase 189 Plan 08 (CONN-01 / D-07) — the governed external action's terminal, in the
    // shipped pattern: ordinal, slug, then the state. It ends in the panel's own harness
    // words and must not be spoken as `complete`; announcing a step that deliberately sent
    // nothing as finished is the same fail-open one language layer up.
    case "recorded-not-sent":
      return `${ordinal}, ${phase.slug}, not sent`
    // Phase 194 Plan 04 (RUN-01 / D-04 / D-13) — the stopped step's terminal, in the shipped
    // pattern: ordinal, slug, then the state. It ends in the panel's own harness words and
    // must not be spoken as `complete` or as `failed`; announcing an interrupted step as
    // finished, or as broken, is the same fail-open one language layer up.
    //
    // ⚠ THIS IS THE ARM THE COMPILER COULD NOT ASK FOR. The widening armed ELEVEN TS2741s
    // and NOT ONE of them was here, because of the fall-through arm below — so this arm came
    // off the plan's written list of consumers, exactly as 189's did. It was DRIVEN RED
    // first: with the arm absent, the announcer returned the EMPTY STRING and the case
    // reported `expected '' to be 'Phase 2 of 2, notify, stopped'`. A screen-reader user was
    // being told a step had reached a terminal by hearing nothing at all.
    case "cancelled":
      return `${ordinal}, ${phase.slug}, stopped`
    default:
      return ""
  }
}

export interface PhaseTimelineProps {
  threadId: string | null
}

export function PhaseTimeline({ threadId }: PhaseTimelineProps) {
  const { data: phases } = usePhases(threadId)
  const { data: tasks } = useTasks(threadId)

  // The run-level reconcile frame (definition_name / run_status / mode). Fetched
  // once on mount — the live stream can't reconstruct the definition name. The
  // phasesByThread slice already carries the reconcile-floor skeleton (Plan 02),
  // so the COUNTER derives from the slice (forward-only by construction); this
  // frame only supplies the header name + the terminal run_status for aria-busy.
  const [frame, setFrame] = useState<RunFrame | null>(null)
  /**
   * ⚠ Phase 200-07 — THE RE-READ TRIGGER, and it is the D-v2.5-03 rule rather than an
   * optimisation. The durable timestamps live on the FETCHED rows, and this component
   * fetched exactly once, at mount. A step that starts after mount would therefore have had
   * its `started_at` arrive on the SSE frame (which drives the slice) and never on the rows
   * the readings are computed from — so the reading would sit frozen while a person watched.
   *
   * The signature is (index, status) per row: the live stream MOVES it, and the fetch then
   * settles what actually happened. That is the shipped division of labour on this surface —
   * *"Realtime is a hint, not a source of truth; always reconcile via fetch"* — and it is the
   * same failure `196` measured one surface over, where a gate with no fetch reconcile HID a
   * shipped control. It is bounded by construction: one read per status transition, not a
   * poll.
   */
  const phaseSignature = phases.map((p) => `${p.phaseIndex}:${p.status}`).join(",")

  /**
   * ⚠ LATEST-WINS BY SEQUENCE, NOT CANCEL-ON-EVERY-TRIGGER — and this shape was arrived at
   * by MEASUREMENT rather than chosen for elegance.
   *
   * The obvious form is one effect keyed on `[threadId, phaseSignature]` with a per-effect
   * `cancelled` flag. It was written that way first, and it DROPPED ITS OWN RE-READ: the
   * slice this component renders is itself fetch-derived (`usePhases` mounts
   * `usePanelReconcile`, whose fetcher REPLACES the whole slice), so a settling reconcile
   * changes `phaseSignature`, which tears down the effect that is at that moment waiting for
   * the answer. Observed: four reads issued, and the frame still holding the first one's
   * payload. In a churny moment that starves the read indefinitely — and a starved read here
   * is not a blank, it is a STALE READING, which is the one failure mode this whole screen
   * exists to remove.
   *
   * So: the ABORT is scoped to the THREAD (where cancelling really is right — a previous
   * thread's answer must never land), and staleness is settled by a monotonic sequence.
   * A later request always wins; an earlier one that arrives late is discarded rather than
   * cancelling anybody.
   */
  const frameSeq = useRef(0)
  const frameAbort = useRef<AbortController | null>(null)

  // Effect 1 — the THREAD-scoped controller. Declared FIRST on purpose: React runs effects
  // in declaration order, so the controller exists before the read below is issued, and on
  // a thread change every in-flight read is aborted before the new one starts.
  useEffect(() => {
    const ctrl = new AbortController()
    frameAbort.current = ctrl
    return () => {
      ctrl.abort()
      frameAbort.current = null
    }
  }, [threadId])

  const readFrame = useCallback(() => {
    if (!threadId) {
      setFrame(null)
      return
    }
    const seq = ++frameSeq.current
    getThreadWorkflow(threadId, frameAbort.current?.signal)
      .then((wf) => {
        if (seq === frameSeq.current) setFrame(wf)
      })
      .catch(() => {
        // A reconcile miss is non-fatal — the slice still drives the timeline. Guarded by
        // the same sequence so a late failure cannot blank a fresher success.
        if (seq === frameSeq.current) setFrame(null)
      })
  }, [threadId])

  // Effect 2 — the read itself: at mount, on a thread change, and on every phase-status
  // transition. NO cleanup, which is the whole point: a trigger issues a read and never
  // revokes one.
  useEffect(() => {
    readFrame()
  }, [readFrame, phaseSignature])

  // ── Honest "Phase i / N" — total = the skeleton length (= reconcile
  //    total_phases); i = the active row's index + 1 (forward-only). ──
  const total = phases.length || frame?.total_phases || 0
  const activeIdx = activePhaseIndex(phases)
  const activePhase = phases[activeIdx]
  const counterCurrent = Math.min(activeIdx + 1, total)

  // ── Forward-only counter guard (INV-4): the displayed ordinal NEVER regresses.
  //    A stale/regressing live event can momentarily lower activeIdx; we clamp the
  //    rendered counter to its running maximum (reconcile is the floor). ──
  const counterFloorRef = useRef<number>(0)
  // WR-02 (PANEL-09): the component instance (and this render-local ref) persists
  // across thread switches — it has no key={threadId}. Reset the floor when the
  // thread changes so a previous Harness thread's "Phase 5 / 5" high-water mark
  // can't bleed into the next thread (mirrors the `frame` reset effect above).
  useEffect(() => {
    counterFloorRef.current = 0
  }, [threadId])
  const displayedCurrent = Math.max(counterFloorRef.current, counterCurrent)
  if (displayedCurrent > counterFloorRef.current) counterFloorRef.current = displayedCurrent

  const runTerminal = frame?.run_status != null && TERMINAL_RUN_STATUSES.has(frame.run_status)
  const anyRunning = phases.some((p) => p.status === "running" || p.status === "retrying")
  const isBusy = !runTerminal && anyRunning

  // ── Phase 200-07 (DES-02 / RS-MR-02 / RS-MR-04 / RS-MNR-02) — the per-step readings ──
  //
  // ⚠ ONE `now` PER RENDER, HOISTED, and it is `runFacts.ts`'s exact signature for
  // `relativeChanged.ts`'s exact reason: several rows resolved against separate
  // `Date.now()` defaults can straddle a boundary mid-render and print two readings of one
  // instant. The whole list ticks against a single value or it does not tick honestly.
  const [nowMs, setNowMs] = useState(() => Date.now())
  // ⚠ THE TICK IS GATED ON THE RUN BEING LIVE, WHICH IS `RS-MNR-02` MADE STRUCTURAL RATHER
  // THAN ASSERTED. A terminal run re-renders nothing here, so no clock can keep moving on a
  // run that ended. The second half of that guarantee is `phaseDuration.ts`'s `unfinished`
  // arm: an `active` row under a terminal run reads *did not finish* rather than a duration,
  // because `harness_engine.py:1698-1706` records that such a row is left behind by a crash.
  // Without BOTH halves this surface would re-create `BUG-260610-01`'s symptom on the very
  // screen built to remove it.
  useEffect(() => {
    if (!isBusy) return
    const id = window.setInterval(() => setNowMs(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [isBusy])

  // The slug → facts lookup. The DECISION is `phaseDuration.ts`'s, the WORDS are
  // `receiptVocabulary.ts`'s, and this component supplies only the three things it alone
  // holds: the durable rows, the RUN's status, and the one instant above.
  //
  // ⚠ `frame?.phases` — THE FETCHED ROWS, never the live slice. The slice's `Phase` carries
  // no timestamps at all (`types/index.ts:1018-1082`), so there is no second source here
  // that could disagree; a row the fetch has not seen yet simply resolves `undefined`, and
  // `PhaseCard` renders nothing for it. An absent answer is not `time not recorded`.
  const factsOf = useMemo(
    () => runFactsBySlug(frame?.phases ?? [], frame?.run_status, nowMs),
    [frame?.phases, frame?.run_status, nowMs],
  )

  // ── The {n}-agents tally (client tally of sub_agent_start — the ONLY count
  //    derivable; per-phase tool/search/source counts are suppressed, D-03). ──
  const agentTally = tasks.length

  // ── ONE polite announcer (present at load), written ONLY on transition edges,
  //    throttled — never per render/token. We track the last announced milestone
  //    string and only update when the active phase's (index, status) edge moves. ──
  const [announcement, setAnnouncement] = useState<string>("")
  const lastEdgeRef = useRef<string>("")
  useEffect(() => {
    if (runTerminal && frame?.run_status === "completed") {
      const edge = "run:complete"
      if (lastEdgeRef.current !== edge) {
        lastEdgeRef.current = edge
        setAnnouncement("Workflow complete")
      }
      return
    }
    if (!activePhase) return
    const edge = `${activePhase.phaseIndex}:${activePhase.status}`
    if (lastEdgeRef.current === edge) return
    lastEdgeRef.current = edge
    const sentence = milestoneFor(activePhase, total)
    if (sentence) setAnnouncement(sentence)
  }, [activePhase?.phaseIndex, activePhase?.status, runTerminal, frame?.run_status, total])

  // ── Doing-now narration (client-composed). "Setting up…" before the first
  //    phase; the failure-aware copy/complete handled by the slice + announcer. ──
  let doingNow = "Setting up…"
  if (runTerminal && frame?.run_status === "completed") doingNow = "Workflow complete"
  else if (activePhase?.status === "failed") doingNow = `Run failed during ${activePhase.slug}.`
  // WR-05: the STATUS goes through the vocabulary table, never straight out of the union.
  // This line used to interpolate `activePhase.status` — the internal `Phase["status"]`
  // member — into copy a user reads. For the six pre-189 members that read tolerably
  // (*notify — running*); the member 189 added rendered as **`notify — recorded-not-sent`**,
  // a kebab-case identifier on the one surface whose whole discipline (D-17) is that the
  // stored slug, the panel word and the canvas sentence are three DIFFERENT spellings.
  // `statusWord` is `STATUS_META`'s own `text` (the table two files' worth of comments call
  // the panel's vocabulary), reached through the same own-property guard the card uses.
  else if (activePhase) doingNow = `${activePhase.slug} — ${statusWord(activePhase.status)}`

  const headerName = frame?.definition_name?.trim() || "Workflow"

  return (
    <section aria-label="Workflow run timeline" className="flex flex-col gap-2 px-1">
      {/* Polite announcer — PRESENT at load (empty), written only on transition
          edges (throttled). Visually hidden; failures use PhaseCard's role=alert. */}
      <div role="status" aria-live="polite" className="sr-only">
        {announcement}
      </div>

      {/* Header: definition name + the honest "Phase i / N" chip + the agent tally. */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-2">
        <span className="min-w-0 truncate text-[13px] font-semibold text-foreground">{headerName}</span>
        {total > 0 && (
          <span className="rounded bg-primary/10 px-1.5 py-0.5 font-mono text-[11px] font-medium text-foreground">
            Phase {displayedCurrent} / {total}
          </span>
        )}
        {agentTally > 0 && (
          <span className="text-[11px] text-panel-muted-foreground">
            {agentTally} {agentTally === 1 ? "agent" : "agents"}
          </span>
        )}
      </div>

      <p className="px-2 text-[12px] text-panel-muted-foreground">{doingNow}</p>

      {/* The phase rows — <ol>/<li> (native order + position). aria-busy flips
          false at a terminal run_status. PhaseCard renders one row per phase.

          Phase 127-03 (WUX-03) — a DECORATIVE vertical energy-connector spine threads
          the rows in a relatively-positioned wrapper. It is aria-hidden +
          pointer-events-none + adds NO focusable/interactive element, so the
          <ol>/<li>/<PhaseCard> structure, aria-label, aria-busy, and the axe-locked
          list semantics are byte-unchanged. The energy comet is reduced-motion-gated
          (motion-safe:) and only animates while the run is live. */}
      <div className="relative">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-0 top-2 bottom-2 w-px bg-gradient-to-b from-transparent via-[hsl(var(--panel-status-active)/0.25)] to-transparent"
        >
          {isBusy && (
            <span className="absolute inset-x-0 top-0 h-8 rounded-full bg-[hsl(var(--panel-status-active)/0.55)] blur-[1px] motion-safe:animate-pulse" />
          )}
        </span>
        <ol aria-label="Phases" aria-busy={isBusy || undefined} className="flex flex-col gap-1.5">
          {phases.map((phase, i) => (
            <li key={`${phase.phaseIndex}-${phase.slug}`}>
              {/* ── Phase 252-04 (SC#5 hole 2 / D-25) — REUSE, NOT A SECOND DERIVATION.
                     `runTerminal` is computed once above from `frame.run_status` via the
                     shared `TERMINAL_RUN_STATUSES` set, and `frame` is the AUTHORITATIVE
                     FETCHED frame (see the `:65-76` docblock; D-v2.5-03 — Realtime is a
                     hint, not truth). `PhaseCard`'s own `timing` docblock warns that a
                     local ternary inside the card would be a second derivation and the
                     panel and the run page would eventually disagree — so the card is
                     TOLD, never left to work it out.

                     ⚠ BEFORE THE FETCH RESOLVES `frame` is null, so `runTerminal` is
                     false and `runLive` is `true` — i.e. THE PRE-FETCH DEFAULT IS TODAY'S
                     BEHAVIOUR. That is why this cannot flash an interrupted reading on
                     mount: the quiet row appears only once the frame has actually said the
                     run is over. */}
              <PhaseCard
                phase={phase}
                position={i}
                timing={factsOf(phase.slug)}
                runLive={!runTerminal}
              />
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

export default PhaseTimeline
