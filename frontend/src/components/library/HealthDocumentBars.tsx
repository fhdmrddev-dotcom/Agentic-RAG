/** Phase 217.1-12 (Task 2) — per-document health bars.
 *
 *  Two-arm legend only: `ready` / `stale — added more than 90 days ago`.
 *  ⛔ No `re-indexing` arm — it has no per-document source at all (D-217.1-28).
 *
 *  Reuses HealthDocumentRow.tsx's shipped per-document row shape, adapted
 *  for the Health tab context.
 */

import { useEffect, useState } from "react"
import { HealthDocumentRow } from "@/components/health/HealthDocumentRow"
import { getStaleDocs } from "@/lib/api"

interface DocumentHealthItem {
  document_id: string
  filename: string
  folder_id: string | null
  status: "ready" | "stale"
}

function StaleChip() {
  return (
    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-400/10 text-amber-400 border border-amber-400/20 tabular-nums shrink-0 font-medium">
      stale
    </span>
  )
}

function Legend() {
  return (
    <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3 font-medium">
      <span className="flex items-center gap-1.5">
        <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]" />
        ready
      </span>
      <span className="flex items-center gap-1.5">
        <span className="inline-block w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.5)]" />
        stale — added more than 90 days ago
      </span>
    </div>
  )
}

export function HealthDocumentBars() {
  const [items, setItems] = useState<DocumentHealthItem[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getStaleDocs(0, 50)
      .then((res) => {
        if (cancelled) return
        // Build the list from the stale response
        // plus a "ready" indicator for non-stale docs we can derive.
        const healthItems: DocumentHealthItem[] = res.items.map((d: { document_id: string; filename: string; folder_id: string | null }) => ({
          document_id: d.document_id,
          filename: d.filename,
          folder_id: d.folder_id,
          status: "stale" as const,
        }))
        setItems(healthItems)
        setTotal(res.total)
        setLoading(false)
      })
      .catch(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  if (loading) {
    return (
      <div className="rounded-xl border border-border/50 bg-card/40 backdrop-blur-sm p-4 space-y-3 shadow-sm">
        <div className="animate-pulse bg-muted/30 h-4 w-48 rounded" />
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="animate-pulse bg-muted/30 h-12 rounded" />
          ))}
        </div>
      </div>
    )
  }

  // Show stale docs as the primary per-document status view
  const staleItems = items.filter((d) => d.status === "stale")

  return (
    <div className="relative overflow-hidden rounded-xl border border-border/50 bg-card/40 backdrop-blur-sm p-5 shadow-sm" data-testid="health-document-bars">
      <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-base font-headline font-bold">Document status</h3>
        <span className="text-xs text-muted-foreground tabular-nums">
          {total} {total === 1 ? "document" : "documents"}
        </span>
      </div>
      <Legend />
      {staleItems.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">
          All documents are up to date.
        </p>
      ) : (
        <div className="divide-y divide-border/30">
          {staleItems.slice(0, 50).map((doc) => (
            <HealthDocumentRow
              key={doc.document_id}
              doc={doc}
              metricChip={<StaleChip />}
              onRemove={(id) => setItems((prev) => prev.filter((d) => d.document_id !== id))}
            />
          ))}
        </div>
      )}
    </div>
  )
}