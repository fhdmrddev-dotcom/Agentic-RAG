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
import { useEffectiveFeaturesOptional } from "@/providers/EffectiveFeaturesProvider"

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
  enabled = true,
): { count: number; loading: boolean; error?: string } {
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState<string | undefined>()
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  useEffect(() => {
    if (!enabled) {
      setCount(0)
      setLoading(false)
      setError(undefined)
      return
    }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled])

  return { count, loading, error }
}

function ChipRow({ id, label, count, loading }: SignalChip) {
  return (
    <div
      key={id}
      className="card-interactive rounded-xl border border-border/50 bg-card/40 backdrop-blur-sm px-3.5 py-2.5 flex items-center justify-between min-w-0 shadow-sm transition-all duration-200"
    >
      <span className="text-sm font-medium text-foreground/90 truncate">{label}</span>
      <span className="text-xs font-semibold tabular-nums px-2 py-0.5 rounded-md bg-muted/50 text-foreground/80 shrink-0 ml-2 border border-border/30">
        {loading ? "…" : count}
      </span>
    </div>
  )
}

export function HealthSignalChips() {
  const featuresCtx = useEffectiveFeaturesOptional()
  const governanceEnabled = featuresCtx?.features.governance_health === true

  const mostRetrieved = useSignalFetch(() => getMostRetrieved(0, 1))
  const neverRetrieved = useSignalFetch(() => getNeverRetrieved(0, 1))
  const lowConfQueries = useSignalFetch(() => getLowConfidenceQueries(0, 1))
  const staleDocs = useSignalFetch(() => getStaleDocs(0, 1))
  const govBroken = useSignalFetch(() => getGovBroken(0, 1), governanceEnabled)
  const govUnclassified = useSignalFetch(() => getGovUnclassified(0, 1), governanceEnabled)
  const govLowConf = useSignalFetch(() => getGovLowConfidence(0, 1), governanceEnabled)

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
    // ⚠ Governance-sourced chips are gated by governance_health
    // (Plan 13 — T-217.1-04). When disabled the getGov* calls
    // never fire and the chips never render.
    ...(governanceEnabled
      ? [
          {
            id: "broken-links" as const,
            label: "Broken links",
            ...govBroken,
            group: "in-good-shape" as const,
          },
          {
            id: "unclassified" as const,
            label: "Unclassified",
            ...govUnclassified,
            group: "in-good-shape" as const,
          },
          {
            id: "unsure-metadata" as const,
            label: "Unsure metadata",
            ...govLowConf,
            group: "in-good-shape" as const,
          },
        ]
      : []),
  ]

  const beingUsed = chips.filter((c) => c.group === "being-used")
  const inGoodShape = chips.filter((c) => c.group === "in-good-shape")
  const expectedBeingUsed = 3
  const expectedInGoodShape = governanceEnabled ? 4 : 1

  if (chips.every((c) => c.loading)) {
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Being used</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {Array.from({ length: expectedBeingUsed }).map((_, i) => (
              <div key={i} className="rounded-xl border border-border/30 bg-card/30 backdrop-blur-sm px-3 py-2 h-10 animate-pulse" />
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">In good shape</p>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
            {Array.from({ length: expectedInGoodShape }).map((_, i) => (
              <div key={i} className="rounded-xl border border-border/30 bg-card/30 backdrop-blur-sm px-3 py-2 h-10 animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2" data-testid="health-chipgroup-being-used">
        <p className="text-xs font-medium text-muted-foreground">Being used</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {beingUsed.map((chip) => (
            <ChipRow key={chip.id} {...chip} />
          ))}
        </div>
      </div>
      <div className="space-y-2" data-testid="health-chipgroup-in-good-shape">
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