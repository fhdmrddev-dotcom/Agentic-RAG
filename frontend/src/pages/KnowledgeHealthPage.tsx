import { useEffect, useState } from "react"
import { TrendingUp, FileQuestion, AlertTriangle, Clock } from "lucide-react"
import { getKnowledgeHealthSummary } from "@/lib/api"
import type { HealthSummary, MostRetrievedDoc, NeverRetrievedDoc, LowConfidenceDoc, StaleDoc } from "@/lib/api"
import { HealthPanel } from "@/components/health/HealthPanel"

function formatDaysOld(createdAt: string): string {
  const days = Math.floor((Date.now() - new Date(createdAt).getTime()) / 86_400_000)
  return `${days} days old`
}

export function KnowledgeHealthPage() {
  const [summary, setSummary] = useState<HealthSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getKnowledgeHealthSummary()
      .then(setSummary)
      .catch(() => setError("Health metrics could not be loaded. Refresh to try again."))
      .finally(() => setLoading(false))
  }, [])

  function removeFromPanel<T extends { document_id: string }>(
    key: keyof HealthSummary,
    id: string,
  ) {
    setSummary((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        [key]: (prev[key] as unknown as T[]).filter((d) => d.document_id !== id),
      }
    })
  }

  if (loading) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <span className="sr-only">Loading health metrics...</span>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="ghost-border bg-card/50 shadow-sm rounded-lg p-4 space-y-3">
              <div className="animate-pulse bg-muted/30 h-5 w-32 rounded" />
              <div className="animate-pulse bg-muted/30 h-10 rounded" />
              <div className="animate-pulse bg-muted/30 h-10 rounded" />
              <div className="animate-pulse bg-muted/30 h-10 rounded" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <header className="mb-2">
        <h1 className="font-headline font-bold text-xl">Library Health</h1>
        <p className="text-sm text-muted-foreground">Last 30 days · Stale threshold: 90 days</p>
      </header>

      {error && (
        <div className="bg-destructive/10 text-destructive text-sm px-4 py-2 rounded-lg mb-4">
          {error}
        </div>
      )}

      {summary && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          <HealthPanel<MostRetrievedDoc>
            title="Most Retrieved"
            icon={TrendingUp}
            iconClassName="text-primary"
            documents={summary.most_retrieved}
            emptyHeading="All quiet"
            emptyBody="No documents were retrieved in the last 30 days."
            emptyIcon={TrendingUp}
            renderChip={(doc) => (
              <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary shrink-0">
                {doc.retrieval_count} retrievals
              </span>
            )}
            onRemove={(id) => removeFromPanel<MostRetrievedDoc>("most_retrieved", id)}
          />

          <HealthPanel<NeverRetrievedDoc>
            title="Never Retrieved"
            icon={FileQuestion}
            iconClassName="text-muted-foreground"
            documents={summary.never_retrieved}
            emptyHeading="Great coverage"
            emptyBody="Every document in your library has been retrieved at least once."
            emptyIcon={FileQuestion}
            renderChip={(doc) => (
              <span className="text-xs px-2 py-0.5 rounded-full bg-muted/40 text-muted-foreground shrink-0">
                {formatDaysOld(doc.created_at)}
              </span>
            )}
            onRemove={(id) => removeFromPanel<NeverRetrievedDoc>("never_retrieved", id)}
          />

          <HealthPanel<LowConfidenceDoc>
            title="Low Confidence"
            icon={AlertTriangle}
            iconClassName="text-amber-400"
            documents={summary.low_confidence}
            emptyHeading="High quality matches"
            emptyBody="No documents show consistently low similarity scores."
            emptyIcon={AlertTriangle}
            renderChip={(doc) => (
              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-400/10 text-amber-400 shrink-0">
                {Math.round(doc.avg_similarity * 100)}% avg
              </span>
            )}
            onRemove={(id) => removeFromPanel<LowConfidenceDoc>("low_confidence", id)}
          />

          <HealthPanel<StaleDoc>
            title="Stale"
            icon={Clock}
            iconClassName="text-muted-foreground"
            documents={summary.stale}
            emptyHeading="Library is fresh"
            emptyBody="No documents older than 90 days found."
            emptyIcon={Clock}
            renderChip={(doc) => (
              <span className="text-xs px-2 py-0.5 rounded-full bg-muted/40 text-muted-foreground shrink-0">
                {doc.days_stale} days stale
              </span>
            )}
            onRemove={(id) => removeFromPanel<StaleDoc>("stale", id)}
          />
        </div>
      )}
    </div>
  )
}
