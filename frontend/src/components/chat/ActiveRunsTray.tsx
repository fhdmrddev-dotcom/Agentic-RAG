import { useEffect, useMemo, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import type { Thread } from "@/types"
import {
  useStreamingThreadIds,
  useStreamActions,
  getActiveRunStartMs,
} from "@/providers/StreamsProvider"
// Phase 194.1 Plan 05 Task 2 (R1 / D-06) — the ONE shared Stop control, which is
// also why `Square` is no longer imported here: the shared component draws it.
import { StopControl } from "./StopControl"

/**
 * SEED-064 — cross-thread active-runs tray (the "Both, layered" winner, sketch 017).
 *
 * The sidebar dots (NavPanel) give ambient "which chats are alive" awareness; THIS
 * is the management surface: a compact "● N running" counter that opens a popover
 * listing every live run across threads with a per-run Stop + a Stop-all. Closes
 * the UAT Test 3 gap where a backgrounded runaway run had no reachable Stop.
 *
 * Honesty/perf notes:
 *  - `useStreamingThreadIds()` is reference-stable across token deltas (it selects
 *    the `streamingThreads` Set, reassigned only on start/stop) → this component
 *    re-renders on start/stop, not on every streamed token.
 *  - Elapsed is read NON-reactively via `getActiveRunStartMs` on a local 1s ticker
 *    (only while the popover is open) so per-token bucket mutations cost nothing.
 *  - Every Stop routes through the one durable cancel path (`stopThread` →
 *    DELETE /runs/{id}); nothing here invents new backend behavior.
 *
 * ⚠ PHASE 194.1 PLAN 05 — `Stop all` IS BYTE-UNTOUCHED, AND THAT IS A DECISION
 * RATHER THAN AN OMISSION, recorded here so the next reader finds a decision.
 *
 * The PER-ROW Stop became the shared `StopControl` component (one component, one pressed
 * state, one resolver). `Stop all` did not, because it is a BULK control over N
 * threads and not a per-thread mount: it has no single thread whose stopping state
 * it could show, so a shared per-thread component is the wrong shape for it. The
 * acknowledgement a user needs is nevertheless delivered — pressing `Stop all`
 * dispatches the same resolver once per listed thread, which puts EVERY row into
 * its own stopping reading through the shared store. The bulk button is answered by
 * the rows it acts on, which is more informative than a state on the button itself.
 *
 * ⚠ Consequence, stated rather than left to be discovered: this file now contains
 * exactly ONE `streamActions.stopThread` call, not two. `ActiveRunsTray.test.tsx`'s
 * source fence pins that count and was superseded in place when it changed.
 */
function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

export function ActiveRunsTray({ threads }: { threads: Thread[] }) {
  const streamingThreadIds = useStreamingThreadIds()
  const streamActions = useStreamActions()
  const [open, setOpen] = useState(false)
  const [nowTick, setNowTick] = useState(() => Date.now())
  const rootRef = useRef<HTMLDivElement>(null)

  const runningIds = useMemo(
    () => threads.filter((t) => streamingThreadIds.has(t.id)).map((t) => t.id),
    [threads, streamingThreadIds],
  )
  const count = runningIds.length

  // Tick elapsed only while the popover is open (and something is running).
  useEffect(() => {
    if (!open || count === 0) return
    const id = window.setInterval(() => setNowTick(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [open, count])

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false) }
    document.addEventListener("mousedown", onDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  // Auto-close + collapse when nothing is running anymore.
  useEffect(() => {
    if (count === 0 && open) setOpen(false)
  }, [count, open])

  if (count === 0) return null

  const titleFor = (id: string) =>
    threads.find((t) => t.id === id)?.title || "Untitled chat"

  return (
    <div ref={rootRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-mono transition-colors",
          "border-primary/40 bg-primary/10 text-primary hover:bg-primary/20",
        )}
        aria-label={`${count} run${count === 1 ? "" : "s"} in progress`}
        aria-expanded={open}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" aria-hidden="true" />
        {count} running
      </button>

      {open && (
        <div
          className="absolute right-0 top-full z-50 mt-1.5 w-72 rounded-lg border border-border bg-popover p-1.5 shadow-lg shadow-black/30 animate-in fade-in slide-in-from-top-1"
          role="dialog"
          aria-label="Active runs"
        >
          <div className="flex items-center justify-between px-2 py-1.5">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Active runs · {count}
            </span>
            {count > 1 && (
              <button
                onClick={() => { runningIds.forEach((id) => void streamActions.stopThread(id)) }}
                className="rounded-md border border-destructive/40 bg-destructive/10 px-2 py-0.5 text-[11px] text-destructive hover:bg-destructive/20 transition-colors"
              >
                Stop all
              </button>
            )}
          </div>

          {runningIds.map((id) => {
            const startMs = getActiveRunStartMs(id)
            const elapsed = startMs != null ? formatElapsed(nowTick - startMs) : null
            return (
              <div key={id} className="flex items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-muted/60">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary animate-pulse" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm" title={titleFor(id)}>{titleFor(id)}</div>
                  {elapsed && (
                    <div className="font-mono text-[10px] text-muted-foreground">⏱ {elapsed} · running</div>
                  )}
                </div>
                {/* Phase 194.1 Plan 05 Task 2 (R1) — the SHARED control. The inline
                    `<button>` that stood here is gone; `StopControl`'s `tray` variant
                    reproduces its chrome byte-for-byte (it differs from the panel's by
                    exactly two things and the two strings are deliberately NOT
                    unified — see the variant table), and the dispatch moved into the
                    shared component. The aria label stays per-ROW because it names the
                    thread, which is the one thing a shared default cannot know. */}
                <StopControl
                  threadId={id}
                  variant="tray"
                  ariaLabel={`Stop run on ${titleFor(id)}`}
                />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
