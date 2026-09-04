/**
 * Phase 217.1 plan 06 (LIB-01 / D-217.1 sparkline-drop) — three stat tiles for the
 * Documents tab, modeled on `HealthStatBar.tsx`'s label / big-number / description shape.
 *
 *   CHUNKS            — sum of `chunk_count` over the currently loaded documents (no fetch)
 *   VECTORS           — `total` from `getReembedProgress()`; description = model name
 *   FOUND BY A SEARCH — `retrieved_this_month` from `getHealthOverview()`; `last 30 days`
 *
 * ⛔ NO SPARKLINE on any tile — a DROP, not a deferral (neither CHUNKS nor VECTORS has
 * stored history; a line drawn from one point is the *Embedding Quality 92%* lie).
 *
 * ⛔ An unreachable source (failed fetch) renders the honest-unknown arm ("Not known yet"),
 * never `0`.
 */
import { useEffect, useState } from "react"
import { getReembedProgress, getHealthOverview } from "@/lib/api"
import type { Document } from "@/types"

const UNKNOWN = "Not known yet"

interface TileState<T> {
  value: T | null
  error: boolean
}

function useAsyncValue<T>(fetcher: () => Promise<T>): TileState<T> {
  const [state, setState] = useState<TileState<T>>({ value: null, error: false })
  useEffect(() => {
    let alive = true
    fetcher()
      .then((v) => { if (alive) setState({ value: v, error: false }) })
      .catch(() => { if (alive) setState({ value: null, error: true }) })
    return () => { alive = false }
    // fetcher is stable per mount (created inline); no dep needed
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return state
}

/** One tile: label · big number · description. Mirrors HealthStatBar's card shape. */
function Tile({
  label,
  value,
  description,
}: {
  label: string
  value: string
  description: string
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1 rounded-xl bg-card/50 ghost-border px-4 py-3">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="font-mono text-2xl font-bold text-foreground tabular-nums">{value}</span>
      <span className="text-xs text-muted-foreground">{description}</span>
    </div>
  )
}

export function LibraryStatTiles({ documents }: { documents: Document[] }) {
  // CHUNKS — derived from the already-held documents, zero fetch.
  const chunkSum = documents.reduce((s, d) => s + (d.chunk_count ?? 0), 0)
  const docCount = documents.length

  // VECTORS — total chunk/vector count + model name from the re-embed progress endpoint.
  const vectors = useAsyncValue(async () => {
    const p = await getReembedProgress()
    return { total: p.total, model: p.model }
  })

  // FOUND BY A SEARCH — retrieved_this_month from the health overview.
  const found = useAsyncValue(async () => {
    const o = await getHealthOverview()
    return o.retrieved_this_month
  })

  return (
    <div
      data-testid="documents-stat-tiles"
      className="flex flex-wrap gap-3"
    >
      <Tile
        label="Chunks"
        value={chunkSum.toLocaleString()}
        description={`across ${docCount} document${docCount === 1 ? "" : "s"}`}
      />
      <Tile
        label="Vectors"
        value={
          vectors.error
            ? UNKNOWN
            : vectors.value === null
              ? "…"
              : vectors.value.total !== null
                ? vectors.value.total.toLocaleString()
                : UNKNOWN
        }
        description={
          vectors.error
            ? "—"
            : vectors.value === null
              ? "…"
              : vectors.value.model ?? "—"
        }
      />
      <Tile
        label="Found by a search"
        value={found.error ? UNKNOWN : found.value === null ? "…" : found.value.toLocaleString()}
        description={found.error ? "—" : found.value === null ? "…" : "last 30 days"}
      />
    </div>
  )
}
