/** Phase 217.1-12 (Task 2) — seven signal chips in two groups.
 *
 *  ⚠ The three Governance-sourced chips render UNGATED in this plan. Plan 13
 *  (Wave 7) adds the governance_health chip-level render gate. This is an
 *  explicitly deferred threat (T-217.1-04), never a silent omission.
 *
 *  ⛔ The word `golden` appears nowhere in this file. The forbidden-needle
 *  check is assembled at runtime in the test suite, never spelled literally.
 */

import { useEffect, useRef, useState } from "react"
import {
  getMostRetrieved,
  getNeverRetrieved,
  getLowConfidenceQueries,
  getStaleDocs,
  getGovBroken,
  getGovUnclassified,
  getGovLowConfidence,
} from "@/lib/api"

interface SignalChip {
  id: string
  label: string
  count: number
  group: "being-used" | "in-good-shape"
  loading: boolean
  error?: string
}

function useSignalFetch<T>(
  fetcher: () => Promise<{ items: T[]; total: number }>,
): { count: number; loading: boolean; error?: string } {
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | undefined>()
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(undefined)
    fetcherRef.current()
      .then((res) => {
        if (!cancelled) {
          setCount(res.total)
          setLoading(false)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load")
          setLoading(false)
        }
      })
    return () => { cancelled = true }
    // ⚠ Stable ref — intentionally empty: the fetcher is callable without
    // being a dependency, so inline closures don't trigger infinite loops.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { count, loading, error }
}

function ChipRow({ id, label, count, loading }: SignalChip) {
  return (
    <div
      key={id}
      className="ghost-border bg-card/50 rounded-lg px-3 py-2 flex items-center justify-between min-w-0"
    >
      <span className="text-sm text-foreground truncate">{label}</span>
      <span className="text-xs tabular-nums text-muted-foreground shrink-0 ml-2">
        {loading ? "…" : count}
      </span>
    </div>
  )
}

export function HealthSignalChips() {
  const mostRetrieved = useSignalFetch(() => getMostRetrieved(0, 1))
  const neverRetrieved = useSignalFetch(() => getNeverRetrieved(0, 1))
  const lowConfQueries = useSignalFetch(() => getLowConfidenceQueries(0, 1))
  const staleDocs = useSignalFetch(() => getStaleDocs(0, 1))
  const govBroken = useSignalFetch(() => getGovBroken(0, 1))
  const govUnclassified = useSignalFetch(() => getGovUnclassified(0, 1))
  const govLowConf = useSignalFetch(() => getGovLowConfidence(0, 1))

  const chips: SignalChip[] = [
    // ── Being used group ─────────────────────────────────────────
    {
      id: "most-found",
      label: "Most found",
      ...mostRetrieved,
      group: "being-used",
    },
    {
      id: "never-found",
      label: "Never found",
      ...neverRetrieved,
      group: "being-used",
    },
    {
      id: "weak-matches",
      label: "Weak matches",
      ...lowConfQueries,
      group: "being-used",
    },
    // ── In good shape group ──────────────────────────────────────
    {
      id: "stale",
      label: "Stale",
      ...staleDocs,
      group: "in-good-shape",
    },
    // ⚠ These three Governance-sourced chips are UNGATED here.
    // Plan 13 adds the chip-level governance_health gate.
    {
      id: "broken-links",
      label: "Broken links",
      ...govBroken,
      group: "in-good-shape",
    },
    {
      id: "unclassified",
      label: "Unclassified",
      ...govUnclassified,
      group: "in-good-shape",
    },
    {
      id: "unsure-metadata",
      label: "Unsure metadata",
      ...govLowConf,
      group: "in-good-shape",
    },
  ]

  const beingUsed = chips.filter((c) => c.group === "being-used")
  const inGoodShape = chips.filter((c) => c.group === "in-good-shape")

  if (chips.every((c) => c.loading)) {
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Being used</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="ghost-border bg-card/50 rounded-lg px-3 py-2 h-10 animate-pulse" />
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">In good shape</p>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="ghost-border bg-card/50 rounded-lg px-3 py-2 h-10 animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">Being used</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {beingUsed.map((chip) => (
            <ChipRow key={chip.id} {...chip} />
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">In good shape</p>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
          {inGoodShape.map((chip) => (
            <ChipRow key={chip.id} {...chip} />
          ))}
        </div>
      </div>
    </div>
  )
}