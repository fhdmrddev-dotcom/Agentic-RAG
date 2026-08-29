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

const UNKNOWN = "Not known yet"

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="min-w-0 truncate font-mono text-sm text-foreground" title={value}>
        {value}
      </span>
    </div>
  )
}

export function VectorStoreCard({ summary }: { summary: IndexSummary | null }) {
  const vectors = summary?.vectors
  const chunks = summary?.chunks_total
  const noVectors = summary?.documents_without_vectors
  const lastIndexed = summary?.last_indexed

  return (
    <div className="rounded-xl bg-card/50 ghost-border px-4 py-3">
      <h3 className="text-sm font-semibold leading-tight">Vector store</h3>
      <div className="mt-1">
        <Fact label="Vectors" value={vectors == null ? UNKNOWN : vectors.toLocaleString()} />
        <Fact label="Chunks indexed" value={chunks == null ? UNKNOWN : chunks.toLocaleString()} />
        <Fact
          label="Documents with no vectors"
          value={noVectors == null ? UNKNOWN : noVectors.toLocaleString()}
        />
        <Fact
          label="Last indexed"
          value={lastIndexed === null ? "never" : new Date(lastIndexed).toLocaleString()}
        />
      </div>
    </div>
  )
}
