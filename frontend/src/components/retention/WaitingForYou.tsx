/**
 * Phase 275 plan 04 (S4 / D-01 / D-03 / D-10) — the Waiting for you sub-tab.
 *
 * One card per policy with due work, newest sweep first: a delete batch (type the count) or a
 * review batch (Keep / Archive / Delete per row). The cards render INLINE — no banner, no link
 * (UI-SPEC §Sketch deviations, D-01). Self-fetching with the honest-degrade rule; a confirmed card
 * is replaced by its result banner, and `onRecorded` pulses the band.
 */
import { useCallback, useEffect, useRef, useState } from "react"

import { listQueue, type QueueList } from "@/lib/api/retention"
import { DeleteBatchCard } from "./DeleteBatchCard"
import { ReviewBatchCard } from "./ReviewBatchCard"
import { AMBER_TEXT_CLASS } from "./RetentionChip"
import { RETENTION_COPY } from "./retentionCopy"

const C = RETENTION_COPY

export function WaitingForYou({
  onRecorded,
  onCountChange,
}: {
  onRecorded?: () => void
  /** The live waiting count, so the sub-tab pill follows what this list shows. */
  onCountChange?: (n: number) => void
}) {
  const [queue, setQueue] = useState<QueueList | null>(null)
  const [loadError, setLoadError] = useState(false)
  // Bumped by Reload so every card remounts from the server's rows (ticks reset honestly).
  const [generation, setGeneration] = useState(0)
  const alive = useRef(true)

  const load = useCallback(async () => {
    try {
      const res = await listQueue()
      if (!alive.current) return
      setQueue(res)
      setLoadError(false)
    } catch {
      if (alive.current) setLoadError(true) // keep the last-known batches
    }
  }, [])

  useEffect(() => {
    alive.current = true
    void load()
    return () => {
      alive.current = false
    }
  }, [load])

  useEffect(() => {
    if (queue) onCountChange?.(queue.total)
  }, [queue, onCountChange])

  const reload = () => {
    setGeneration((g) => g + 1)
    void load()
  }

  const batches = [...(queue?.batches ?? [])].sort((a, b) => (b.found_at ?? "").localeCompare(a.found_at ?? ""))

  return (
    <section className="grid gap-4" aria-busy={queue === null && !loadError}>
      <p className="text-xs text-muted-foreground">{C.ported.waitingCrumb}</p>
      {loadError && (
        <p role="alert" className={`text-sm ${AMBER_TEXT_CLASS}`}>
          {C.contract.loadFailed}{" "}
          <button type="button" className="underline" onClick={reload}>
            {C.contract.tryAgain}
          </button>
        </p>
      )}
      {queue !== null && batches.length === 0 ? (
        <div className="rounded-[10px] border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
          {C.ported.waitingEmpty}
        </div>
      ) : (
        batches.map((b) =>
          b.kind === "review" ? (
            <ReviewBatchCard key={`${b.policy_id}-${generation}`} batch={b} onRecorded={onRecorded} onReload={reload} />
          ) : (
            <DeleteBatchCard key={`${b.policy_id}-${generation}`} batch={b} onRecorded={onRecorded} onReload={reload} />
          ),
        )
      )}
    </section>
  )
}
