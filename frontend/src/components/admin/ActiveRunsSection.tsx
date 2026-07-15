// ─────────────────────────────────────────────────────────────────────────────
// Phase 147 Plan 07 (ADMIN-02 / sketch 064-B) — the live active-runs surface.
//
// Every `runs:active` entry the shell fetches renders as a calm cross-provider
// card: the run's REAL @lobehub provider mark (via the shared providerLogo
// resolver — never placeholder art), the user, the model, a live-ticking elapsed
// (client math from started_at, D-07 — no poll needed to tick), and a kind badge
// (chat / workflow / eval / tuner, D-01).
//
// The Kill action has a victim, so it is deliberate + honest (064-B):
//   • killable runs (chat / workflow) get an "End run" control that opens a
//     confirm SHEET NAMING the victim ("End maria@… 's run on gpt-5, 2m 14s in —
//     cancels immediately, recorded with your name") — the run is NOT cancelled
//     until Confirm.
//   • the killed card does NOT vanish (NO optimistic removal — the shell owns the
//     list; we only overlay the honest cancel state). It goes Cancelling… →
//     Cancelled · recorded. A stalled run (server-derived `not_responding`) is
//     RECOVERED, not killed: "Recovering a stuck run…" → "Cancelled · recovered a
//     stuck run" (the zombie-heal truth, surfaced not hidden).
//   • eval / tuner runs are bounded internal jobs (killable === false, D-01):
//     NO Kill affordance, honest "ends on its own" copy.
//
// Tags: a `long-running` chip at >8 min (pure client math) and a highlighted
// `not responding` chip driven by the SERVER-derived `not_responding` boolean
// (Plan 147-02) — we never guess a stall client-side.
//
// PURE PRESENTATIONAL LEAF: props in, DOM out. The shell (ControlRoomPage, Plan
// 09) owns fetch/poll/state and threads `runs` + `onKill` down. `null` runs →
// calm dimmed placeholder; empty → calm "No runs in flight" (never "broken").
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from "react"
import { AlertTriangle, Bot, Check, Clock, Loader2, Timer } from "lucide-react"

import type { AdminActiveRun as ActiveRun } from "@/lib/api"
import { providerLogo } from "@/lib/providerLogo"
import { cn } from "@/lib/utils"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

/** A run is "long-running" once it passes eight minutes of elapsed wall time
 *  (064-B) — pure client math, never a server flag. */
const LONG_RUNNING_SEC = 8 * 60

/** Elapsed since a unix-epoch `started_at` (seconds), clamped at 0. Reads
 *  `Date.now()` so tests can pin it deterministically. */
function elapsedSecondsSince(startedAt: number): number {
  return Math.max(0, Math.floor(Date.now() / 1000 - startedAt))
}

/** Human elapsed — "8s", "2m 14s", "1h 3m". Matches the 064-B card grammar. */
function formatElapsed(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${sec}s`
  return `${sec}s`
}

/** The plain, human word for a run's kind (the badge label). */
const KIND_LABEL: Record<ActiveRun["kind"], string> = {
  chat: "Chat",
  workflow: "Workflow",
  eval: "Eval",
  tuner: "Tuner",
}

/** The identity we show for the run's owner. Prefer the email; fall back to a
 *  short masked user id; never render an empty string. */
function userLabelFor(run: ActiveRun): string {
  if (run.user_email) return run.user_email
  if (run.user_id) return `user ${run.user_id.slice(0, 8)}…`
  return "unknown user"
}

interface ActiveRunsSectionProps {
  /** Every `runs:active` entry (enriched); `null` while the shell is loading. */
  runs: ActiveRun[] | null
  /** Fire the operator Kill for a run (`killRun` from the shell). Resolves on a
   *  204; rejects on failure so the card can surface a retryable error. */
  onKill: (runId: string) => Promise<void>
}

/** The 064-B active-runs list: calm cross-provider cards + victim-naming Kill. */
export function ActiveRunsSection({ runs, onKill }: ActiveRunsSectionProps) {
  // null → the shell has not resolved the fetch yet: a calm dimmed placeholder,
  // never a crash (presentational-leaf discipline).
  if (runs === null) {
    return (
      <div
        aria-busy="true"
        className="rounded-[10px] border border-border bg-card px-4 py-6 text-sm text-muted-foreground opacity-40"
      >
        Loading active runs…
      </div>
    )
  }

  // Empty is calm, not broken — the honest "everything is idle" state (064-B #5).
  if (runs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-[10px] border border-dashed border-border bg-card/40 px-4 py-10 text-center">
        <div className="text-sm font-semibold text-foreground">No runs in flight</div>
        <div className="mt-1 text-xs text-muted-foreground">
          Every agent is idle right now — calm, not broken.
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2.5">
      {runs.map((run) => (
        <RunCard key={run.run_id} run={run} onKill={onKill} />
      ))}
    </div>
  )
}

type KillPhase = "idle" | "cancelling" | "cancelled" | "error"

/** One 064-B run card. Owns its own live-elapsed tick + kill lifecycle so the
 *  killed card can transition in place (NO optimistic removal — the parent list
 *  is untouched). */
function RunCard({
  run,
  onKill,
}: {
  run: ActiveRun
  onKill: (runId: string) => Promise<void>
}) {
  // Elapsed ticks client-side once per second (D-07). Seeded on mount from
  // started_at; the interval is cleared on unmount (no leak, no server poll).
  const [elapsedSec, setElapsedSec] = useState(() => elapsedSecondsSince(run.started_at))
  useEffect(() => {
    setElapsedSec(elapsedSecondsSince(run.started_at))
    const id = setInterval(() => setElapsedSec(elapsedSecondsSince(run.started_at)), 1000)
    return () => clearInterval(id)
  }, [run.started_at])

  const [confirmOpen, setConfirmOpen] = useState(false)
  const [killPhase, setKillPhase] = useState<KillPhase>("idle")
  // Captured at Confirm time so the terminal wording stays honest even if the
  // prop later changes: a stalled (not_responding) run is RECOVERED, not killed.
  const [killedStuck, setKilledStuck] = useState(false)

  const elapsedLabel = formatElapsed(elapsedSec)
  const longRunning = elapsedSec > LONG_RUNNING_SEC
  const notResponding = run.not_responding

  const HeaderMark = providerLogo(run.provider ?? undefined)
  const userLabel = userLabelFor(run)
  const modelLabel = run.model || "unknown model"
  const descId = `kill-confirm-${run.run_id}`

  async function handleConfirm() {
    // Capture the stalled-ness NOW (the honest zombie-heal signal) before the
    // async cancel; close the sheet and show the in-flight cancel state.
    setKilledStuck(notResponding)
    setConfirmOpen(false)
    setKillPhase("cancelling")
    try {
      await onKill(run.run_id)
      setKillPhase("cancelled")
    } catch {
      setKillPhase("error")
    }
  }

  return (
    <div
      className={cn(
        "rounded-[10px] border border-border bg-card px-3.5 py-3",
        notResponding && killPhase === "idle" && "border-destructive/40",
      )}
    >
      <div className="flex items-start gap-3">
        {/* Provider mark — the real @lobehub brand mark, or the Bot fallback for
            unmapped providers (mirrors the chat RunCard treatment). */}
        <div
          className={cn(
            "flex h-9 w-9 flex-none items-center justify-center rounded-lg",
            HeaderMark
              ? "bg-white text-zinc-900 ring-1 ring-black/10"
              : "bg-gradient-to-br from-primary to-primary/60",
          )}
        >
          {HeaderMark ? <HeaderMark size={18} /> : <Bot className="h-4 w-4 text-white" />}
        </div>

        <div className="min-w-0 flex-1">
          {/* Line 1: user + kind badge. */}
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium text-foreground" title={userLabel}>
              {userLabel}
            </span>
            <span className="flex-none rounded-md border border-border bg-muted/40 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {KIND_LABEL[run.kind]}
            </span>
          </div>

          {/* Line 2: model + live elapsed. */}
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted-foreground">
            <span className="truncate font-mono" title={modelLabel}>
              {modelLabel}
            </span>
            <span className="inline-flex items-center gap-1 tabular-nums">
              <Clock className="h-3 w-3" aria-hidden="true" />
              {elapsedLabel}
            </span>

            {longRunning && (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-400">
                <Timer className="h-3 w-3" aria-hidden="true" />
                Long-running
              </span>
            )}
            {notResponding && (
              <span className="inline-flex items-center gap-1 rounded-full border border-destructive/40 bg-destructive/15 px-1.5 py-0.5 text-[10px] font-semibold text-destructive">
                <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                Not responding
              </span>
            )}
          </div>
        </div>

        {/* Right rail: the kill affordance OR the honest terminal/idle copy. */}
        <div className="flex flex-none flex-col items-end justify-center gap-1">
          {killPhase === "idle" && run.killable && (
            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              className="inline-flex items-center rounded-md border border-destructive/40 bg-destructive/10 px-2.5 py-1 text-xs font-medium text-destructive transition-colors hover:bg-destructive/20"
              aria-label={`End run — ${userLabel} on ${modelLabel}`}
            >
              End run
            </button>
          )}

          {killPhase === "idle" && !run.killable && (
            // eval / tuner: bounded internal work — no victim, no Kill (D-01).
            <span className="text-right text-[11px] leading-snug text-muted-foreground">
              Ends on its own
            </span>
          )}

          {killPhase === "cancelling" && (
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground" role="status">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              {killedStuck ? "Recovering a stuck run…" : "Cancelling…"}
            </span>
          )}

          {killPhase === "cancelled" && (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground" role="status">
              <Check className="h-3.5 w-3.5 text-success" aria-hidden="true" />
              {killedStuck ? "Cancelled · recovered a stuck run" : "Cancelled · recorded"}
            </span>
          )}

          {killPhase === "error" && (
            <div className="flex flex-col items-end gap-1">
              <span className="text-xs text-destructive" role="status">
                Couldn&rsquo;t end the run
              </span>
              <button
                type="button"
                onClick={() => setConfirmOpen(true)}
                className="inline-flex items-center rounded-md border border-destructive/40 bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive transition-colors hover:bg-destructive/20"
              >
                Try again
              </button>
            </div>
          )}
        </div>
      </div>

      {/* The victim-naming confirm sheet — the deliberate guard for an action with
          a victim (064-B). Names WHO / which MODEL / how long IN before it fires. */}
      <Sheet open={confirmOpen} onOpenChange={setConfirmOpen}>
        <SheetContent side="bottom" aria-describedby={descId} className="mx-auto max-w-lg">
          <SheetHeader>
            <SheetTitle>End this run?</SheetTitle>
          </SheetHeader>
          <div className="px-4 pb-4">
            <p id={descId} className="text-sm text-foreground">
              End {userLabel}&rsquo;s run on {modelLabel}, {elapsedLabel} in — cancels
              immediately, recorded with your name.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                className="inline-flex items-center rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                Keep running
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                className="inline-flex items-center rounded-md bg-destructive px-3 py-1.5 text-sm font-medium text-destructive-foreground transition-colors hover:bg-destructive/90"
              >
                End it now
              </button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
