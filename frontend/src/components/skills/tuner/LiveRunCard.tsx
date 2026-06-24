/**
 * Phase 123 Plan 05 Task 2b (TRIG-01) — LiveRunCard (sketch 043-A).
 *
 * Per-provider live progress lanes over the SSE stream
 * (tuner_progress/tuner_provider_done/tuner_complete), a NEVER-VANISHING elapsed
 * timer derived from a STABLE start-ts (the 095 lesson — never reset on transient
 * stream-ends), an explicit "runs in the background — reconciles on return", and
 * Cancel. A QUEUED provider shows queued, NEVER a fake percent (queued ≠ running —
 * T-123-05-03): only running/done lanes carry a meaningful affordance.
 *
 * Phase 123.1 Plan 08 Task 2 (TT-14 no-flash) — a "reconciling" phase. On run
 * completion the SkillTunerPage keeps this card MOUNTED in `phase="reconciling"`
 * (timer frozen, an honest "finishing — loading results…" footer, Cancel hidden)
 * through the gap between the 'done' terminal and getTunerResults resolving — so the
 * pane never flashes empty between "done" and the final scoreboard arriving. The
 * never-vanishes timer (the 095 lesson) is preserved: elapsed freezes when phase
 * !== "running" but the card never disappears.
 */
import { useEffect, useState } from "react"
import { Clock, Loader2, CheckCircle2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/** One provider lane in the live run. `status` carries the honest queued≠running
 *  distinction (043-A): a queued lane never shows a fabricated percent. */
export interface ProviderLane {
  provider: string
  model: string
  status: "queued" | "running" | "done"
  score?: number
}

interface Props {
  lanes: ProviderLane[]
  /** The STABLE run start-ts (ms epoch) — the elapsed timer derives from this and
   *  never resets on a transient stream-end (the 095 never-vanishes lesson). */
  startTs: number | null
  /** "reconciling" (TT-14) keeps the card mounted with a frozen timer + an honest
   *  "finishing — loading results…" footer through the done→getTunerResults gap. */
  phase: "running" | "reconciling" | "error"
  error: string | null
  onCancel: () => void
}

function laneTestId(provider: string): string {
  return `lane-${provider}`
}

export function LiveRunCard({ lanes, startTs, phase, error, onCancel }: Props) {
  // The never-vanishes timer: tick a clock so elapsed = now − startTs renders
  // continuously. Elapsed derives ONLY from the stable startTs (immune to dropped
  // SSE / temp remounts); it freezes only when phase is no longer running.
  const [now, setNow] = useState<number>(() => Date.now())
  useEffect(() => {
    if (phase !== "running") return
    const id = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [phase])

  const elapsedS = startTs != null ? Math.max(0, (now - startTs) / 1000) : 0

  return (
    <div data-testid="live-run-card" className="rounded-xl ghost-border bg-card/50 p-4 shadow-sm flex flex-col gap-3">
      {/* Header: the never-vanishing elapsed timer + the leave-and-reconcile promise. */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary" aria-hidden="true" />
          <span data-testid="live-run-timer" className="text-sm font-mono tabular-nums text-foreground">
            ⏱ {elapsedS.toFixed(1)}s
          </span>
        </div>
        {/* Cancel is available only while a run is actually streaming — hidden once we're
            reconciling (the job already finished) or errored (nothing to cancel). */}
        {phase === "running" && (
          <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={onCancel}>
            <X className="h-3 w-3" />
            Cancel
          </Button>
        )}
      </div>

      {/* Per-provider lanes — queued ≠ running (no fake percent on a queued lane). */}
      <ul className="flex flex-col gap-1.5">
        {lanes.map((lane) => (
          <li
            key={`${lane.provider}:${lane.model}`}
            data-testid={laneTestId(lane.provider)}
            className="flex items-center justify-between gap-2 rounded-lg bg-card/40 px-2.5 py-1.5 text-xs"
          >
            <div className="flex flex-col min-w-0">
              <span className="font-mono text-foreground truncate">{lane.provider}</span>
              <span className="font-mono text-[10px] text-muted-foreground truncate">{lane.model}</span>
            </div>
            <span
              className={cn(
                "flex items-center gap-1.5 font-mono text-[11px] shrink-0",
                lane.status === "done" && "text-[hsl(var(--panel-status-done))]",
                lane.status === "running" && "text-[hsl(var(--panel-status-active))]",
                lane.status === "queued" && "text-muted-foreground",
              )}
            >
              {lane.status === "queued" && <>queued</>}
              {lane.status === "running" && (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                  running
                </>
              )}
              {lane.status === "done" && (
                <>
                  <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                  {lane.score != null ? lane.score.toFixed(2) : "done"}
                </>
              )}
            </span>
          </li>
        ))}
      </ul>

      {phase === "error" && error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : phase === "reconciling" ? (
        // TT-14: the job is done — we're loading the final scoreboard. Honest, NOT the
        // red error and NOT the "runs in the background" idle line; the card stays mounted
        // (no empty-pane flash) until getTunerResults resolves.
        <p data-testid="live-run-reconciling" className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
          finishing — loading results…
        </p>
      ) : (
        <p className="text-[11px] text-muted-foreground">
          Runs in the background — you can leave; it reconciles on return.
        </p>
      )}
    </div>
  )
}
