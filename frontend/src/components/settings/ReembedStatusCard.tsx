import { useCallback, useEffect, useState } from "react"
import { RefreshCw, CheckCircle2, TriangleAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { getReembedProgress, kickReembed, type ReembedProgress } from "@/lib/api"

/**
 * Phase 111.1 Plan 06 — D-04 / D-05 graceful-dip re-embed status card (sketch
 * 026 winner: C's rich status card as the HOME in Settings).
 *
 * Carries running / partial-failed / complete with the D-05 "nothing was lost"
 * promise, re-embedded/total/remaining + a "Re-embed now" re-kick. Progress is
 * read via getReembedProgress and RECONCILED ON FETCH (Realtime is a hint —
 * D-v2.5-03; the counts are derived live from document_chunks, the source of
 * truth — we poll lightly while running, and never trust a stale push over the
 * fetched record). When idle/complete the card collapses to nothing (no nag).
 *
 * The slim "search is catching up" pointer (ReembedSearchPointer) is a separate
 * export that appears ONLY where search happens (Documents/search surface),
 * deep-links into this card, and auto-hides on completion.
 */

const RUNNING_POLL_MS = 4000

function pct(p: ReembedProgress): number {
  if (p.total == null || p.total === 0 || p.re_embedded == null) return 0
  return Math.min(100, Math.round((p.re_embedded / p.total) * 100))
}

// Rough remaining-ETA from the live counts (mirrors the modal's ~700/min heuristic).
function remainingEta(p: ReembedProgress): string {
  if (p.remaining == null || p.remaining <= 0) return "done"
  const minutes = Math.max(1, Math.round(p.remaining / 700))
  return minutes <= 1 ? "~1 min" : `~${minutes} min`
}

export function ReembedStatusCard({ id }: { id?: string }) {
  const [progress, setProgress] = useState<ReembedProgress | null>(null)
  const [rekicking, setRekicking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const p = await getReembedProgress()
      setProgress(p)
      setError(null)
    } catch (e) {
      // A failed fetch is a transient hint problem — keep the last good record
      // rather than blanking the card (reconcile-on-fetch tolerates a miss).
      setError(e instanceof Error ? e.message : "Could not read re-embed progress")
    }
  }, [])

  // Initial fetch + a light poll WHILE running (reconcile-on-fetch every tick).
  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (progress?.status !== "running") return
    const t = setInterval(() => void refresh(), RUNNING_POLL_MS)
    return () => clearInterval(t)
  }, [progress?.status, refresh])

  const onRekick = useCallback(async () => {
    setRekicking(true)
    try {
      const p = await kickReembed()
      setProgress(p)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start re-embed")
    } finally {
      setRekicking(false)
    }
  }, [])

  if (!progress) return null

  const { status } = progress
  // Idle / complete-with-nothing-pending => the card stays out of the way (D-05:
  // no nag once the corpus is current). Only running / partial / failed are HOMES.
  if (status === "idle") return null
  if (status === "complete" && (progress.remaining ?? 0) === 0) return null

  const isRunning = status === "running"
  const isComplete = status === "complete"
  const isFailedish = status === "partial" || status === "failed"

  const total = progress.total ?? 0
  const done = progress.re_embedded ?? 0

  return (
    <div
      id={id}
      className="overflow-hidden rounded-lg bg-card border border-border shadow-sm"
      role="status"
      aria-live="polite"
    >
      {/* Head */}
      <div className="flex items-start gap-3 p-5">
        <div
          className={cn(
            "grid h-10 w-10 shrink-0 place-items-center rounded-md border",
            isRunning && "bg-primary/15 border-primary/30",
            isComplete && "bg-success/15 border-success/30",
            isFailedish && "bg-destructive/15 border-destructive/30",
          )}
        >
          {isRunning && <RefreshCw className="h-5 w-5 text-primary animate-spin" />}
          {isComplete && <CheckCircle2 className="h-5 w-5 text-success" />}
          {isFailedish && <TriangleAlert className="h-5 w-5 text-destructive" />}
        </div>
        <div className="min-w-0">
          <h4 className="font-headline text-sm font-bold text-foreground">
            {isRunning && "Re-embedding library"}
            {isComplete && "Re-embed complete"}
            {isFailedish && "Re-embed stopped"}
          </h4>
          <p className="text-xs text-muted-foreground font-mono truncate" title={progress.model ?? ""}>
            {progress.model ? `→ ${progress.model}` : ""}
            {isFailedish ? " · resumable" : ""}
          </p>
        </div>
        <span
          className={cn(
            "ml-auto shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-mono uppercase tracking-wide",
            isRunning && "bg-primary/15 text-primary",
            isComplete && "bg-success/15 text-success",
            isFailedish && "bg-destructive/15 text-destructive",
          )}
        >
          {isRunning ? "running" : isComplete ? "complete" : "stalled"}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-primary/10">
        <div
          className={cn(
            "h-full transition-all duration-700",
            isRunning && "bg-primary",
            isComplete && "bg-success",
            isFailedish && "bg-destructive",
          )}
          style={{ width: `${pct(progress)}%` }}
        />
      </div>

      <div className="px-5 pb-5 pt-4">
        {/* Stats */}
        <div className="mb-4 flex gap-6">
          <div>
            <div className="font-mono text-lg font-bold text-foreground">{done.toLocaleString()}</div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">re-embedded</div>
          </div>
          <div>
            <div className="font-mono text-lg font-bold text-foreground">{total.toLocaleString()}</div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">total chunks</div>
          </div>
          <div>
            <div className="font-mono text-lg font-bold text-foreground">
              {isComplete ? "done" : remainingEta(progress)}
            </div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">remaining</div>
          </div>
        </div>

        {/* The honest note — recall dip + the D-05 "nothing was lost" promise */}
        <div
          className={cn(
            "mb-4 flex items-start gap-2 rounded-md px-4 py-3 text-xs",
            isRunning && "bg-amber-400/10 text-muted-foreground",
            isComplete && "bg-success/10 text-muted-foreground",
            isFailedish && "bg-destructive/10 text-muted-foreground",
          )}
        >
          {isRunning && (
            <span>
              <b className="text-amber-400">Search at reduced recall.</b> Chunks not yet re-embedded are filtered out of
              results, so search stays up and fully recovers as this completes. Old vectors are kept until each
              replacement is written — nothing is lost if this is interrupted.
            </span>
          )}
          {isComplete && (
            <span>
              <b className="text-success">Full recall restored.</b> Every chunk is now embedded with the current model.
              Search is back to full quality.
            </span>
          )}
          {isFailedish && (
            <span>
              <b className="text-destructive">Stopped with {(progress.remaining ?? 0).toLocaleString()} chunks left.</b>{" "}
              Nothing was lost — old vectors are intact and search runs at reduced recall. Re-embed now picks up exactly
              where it stopped.
            </span>
          )}
        </div>

        {/* Re-kick — D-05 manual "Re-embed now" for a failed/partial run */}
        {isFailedish && (
          <div className="flex gap-3">
            <Button
              size="sm"
              onClick={onRekick}
              disabled={rekicking}
              className="gap-1.5 gradient-primary text-white border-none font-semibold"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", rekicking && "animate-spin")} />
              {rekicking ? "Resuming…" : "Re-embed now"}
            </Button>
          </div>
        )}

        {error && <p className="mt-2 text-[11px] text-amber-400">{error}</p>}
      </div>
    </div>
  )
}

/**
 * The slim "search is catching up" pointer (sketch 026 — the whisper of B).
 * Appears ONLY where search happens (Documents/search surface), deep-links into
 * the status card, and auto-hides the moment the job completes. Self-fetches its
 * own progress (reconcile-on-fetch) so any search surface can mount it cheaply.
 *
 * `onViewProgress` is the deep-link handler (e.g. navigate to Settings and scroll
 * the status card into view); if omitted the link is hidden.
 */
export function ReembedSearchPointer({ onViewProgress }: { onViewProgress?: () => void }) {
  const [progress, setProgress] = useState<ReembedProgress | null>(null)

  const fetchOnce = useCallback(async () => {
    try {
      const p = await getReembedProgress()
      setProgress(p)
    } catch {
      /* transient — leave the pointer hidden on a failed fetch */
    }
  }, [])

  // ⛔ BUG-260905-15 — THIS POLLED FOREVER ON AN IDLE PAGE, and its own sibling twenty lines
  //   above shows what it should always have been. The interval used to be UNCONDITIONAL:
  //
  //       void fetchOnce()
  //       const t = setInterval(() => void fetchOnce(), RUNNING_POLL_MS)   // no status gate
  //
  //   `ReembedStatusCard` gates the identical poll on `status !== "running"`. This one did
  //   not, so every Library page open anywhere hit `/settings/reembed-progress` every 4s for
  //   as long as it stayed open — forever, with no re-embed running and nobody touching the
  //   app. Reported by the operator while idly waiting for a Drive folder to list.
  //
  // ⚠ EACH TICK IS TWO LOG LINES, NOT ONE — CORS sends an `OPTIONS` preflight before every
  //   `GET`. With `LibraryStatTiles` reading the same endpoint the two interleave, which is
  //   why a 4s poll reads as "the same line every 2 seconds" in the backend log.
  //
  // ⚠ THE FIX IS NOT A SLOWER IDLE POLL. This pointer must still notice a re-embed STARTED
  //   ELSEWHERE (the person kicks it in Settings, then comes back to the Library). Focus is
  //   strictly better than any interval for that: it catches the return INSTANTLY, where even
  //   a 60s poll lags up to a minute and still costs a request a minute all night.
  //   It is the shape D-v2.5-03 already prescribes — reconcile by fetch on (re)connect.
  useEffect(() => {
    void fetchOnce()
    const onVisible = () => {
      if (document.visibilityState === "visible") void fetchOnce()
    }
    document.addEventListener("visibilitychange", onVisible)
    window.addEventListener("focus", onVisible)
    return () => {
      document.removeEventListener("visibilitychange", onVisible)
      window.removeEventListener("focus", onVisible)
    }
  }, [fetchOnce])

  // ⚠ The ONLY interval, and it exists only while a job is actually running — so the count in
  //   a visible pointer still ticks live. An idle page issues NO repeat requests at all.
  useEffect(() => {
    if (progress?.status !== "running") return
    const t = setInterval(() => void fetchOnce(), RUNNING_POLL_MS)
    return () => clearInterval(t)
  }, [progress?.status, fetchOnce])

  // Only visible while there's still a recall dip (running OR partial/failed with
  // chunks remaining). Auto-hides on completion / idle.
  if (!progress) return null
  const stillDipping =
    progress.status === "running" ||
    ((progress.status === "partial" || progress.status === "failed") && (progress.remaining ?? 0) > 0)
  if (!stillDipping) return null

  return (
    <div
      className="flex items-center gap-2 rounded-md bg-amber-400/10 border border-amber-400/25 px-3 py-1.5 text-xs text-muted-foreground"
      role="status"
      aria-live="polite"
    >
      <RefreshCw className="h-3.5 w-3.5 shrink-0 text-amber-400 animate-spin" />
      <span>Search is catching up — some documents are temporarily excluded while re-embedding.</span>
      {onViewProgress && (
        <button
          type="button"
          onClick={onViewProgress}
          className="ml-auto shrink-0 font-semibold text-primary hover:underline"
        >
          View progress →
        </button>
      )}
    </div>
  )
}
