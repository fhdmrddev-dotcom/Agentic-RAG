/**
 * Phase 217.1 plan 10 (LIB-01 / BE-2 / D-217.1-27) — the Vector store card.
 *
 * Renders the corpus facts from `GET /library/index-summary`: Vectors · Chunks indexed ·
 * Documents with no vectors · Last indexed. The facts render for EVERY user (ungated);
 * only the ACTION buttons are gated (in `IndexingTab`).
 *
 * ⛔ HONESTY: an unknown value reads `UNKNOWN`, never `0`. `Last indexed` is
 * `max(embedded_at)` (BE-1) — a `never` (null) reads `never`, never a fabricated time.
 */
import type { IndexSummary } from "@/lib/api"
import { Database } from "lucide-react"

const UNKNOWN = "Not known yet"

function Fact({ label, value, loading }: { label: string; value?: string; loading?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2 px-1 rounded-md hover:bg-muted/30 transition-colors duration-150">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      {loading ? (
        <div className="h-4 w-16 animate-pulse bg-muted/30 rounded" />
      ) : (
        <span className="min-w-0 truncate font-mono text-sm font-medium text-foreground" title={value}>
          {value ?? UNKNOWN}
        </span>
      )}
    </div>
  )
}

export function VectorStoreCard({ summary }: { summary: IndexSummary | null }) {
  const loading = summary === null
  const vectors = summary?.vectors
  const chunks = summary?.chunks_total
  const noVectors = summary?.documents_without_vectors
  const lastIndexed = summary?.last_indexed

  return (
    <div className="group relative rounded-xl border border-border/50 bg-gradient-to-b from-card/80 to-card/40 backdrop-blur-sm p-4 shadow-sm card-interactive overflow-hidden">
      {/* Subtle top accent gradient */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-primary/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

      <div className="flex items-center gap-2 mb-2">
        <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center text-primary">
          <Database className="h-3.5 w-3.5" />
        </div>
        <h3 className="text-sm font-semibold leading-tight text-foreground">Vector store</h3>
      </div>
      <div className="mt-1 divide-y divide-border/20">
        <Fact label="Vectors" value={vectors == null ? undefined : vectors.toLocaleString()} loading={loading} />
        <Fact label="Chunks indexed" value={chunks == null ? undefined : chunks.toLocaleString()} loading={loading} />
        <Fact
          label="Documents with no vectors"
          value={noVectors == null ? undefined : noVectors.toLocaleString()}
          loading={loading}
        />
        <Fact
          label="Last indexed"
          value={lastIndexed === null ? "never" : lastIndexed ? new Date(lastIndexed).toLocaleString() : undefined}
          loading={loading}
        />
      </div>
    </div>
  )
}
