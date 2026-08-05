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
import { useEffect, useRef, useState } from "react"
import { usePhases, useTasks } from "@/providers/StreamsProvider"
import { getThreadWorkflow, type ThreadWorkflowState } from "@/lib/api"
import type { Phase } from "@/types"
// Phase 188 Plan 05 (SPEC Req 8 / D-188-02): the terminal-run set MOVED to the shared
// derivation module so the canvas run view reads the same one. `timed_out` is carried
// forward unchanged (D-188-21) — the measurement is recorded in that module's docblock.
import { TERMINAL_RUN_STATUSES } from "@/lib/phaseState"
import { PhaseCard } from "./PhaseCard"

/** The run-level reconcile frame this timeline needs (subset of ThreadWorkflowState). */
type RunFrame = Pick<
  ThreadWorkflowState,
  "mode" | "definition_name" | "run_status" | "current_phase_index" | "total_phases"
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

/** Plain-language milestone for the announcer (one sentence per transition edge). */
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
  useEffect(() => {
    if (!threadId) {
      setFrame(null)
      return
    }
    let cancelled = false
    const ctrl = new AbortController()
    getThreadWorkflow(threadId, ctrl.signal)
      .then((wf) => {
        if (!cancelled) setFrame(wf)
      })
      .catch(() => {
        // A reconcile miss is non-fatal — the slice still drives the timeline.
        if (!cancelled) setFrame(null)
      })
    return () => {
      cancelled = true
      ctrl.abort()
    }
  }, [threadId])

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
  else if (activePhase) doingNow = `${activePhase.slug} — ${activePhase.status}`

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
              <PhaseCard phase={phase} position={i} />
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

export default PhaseTimeline
