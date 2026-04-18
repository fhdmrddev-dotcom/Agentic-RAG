import { useCallback, useEffect, useState } from "react"
import { TrendingUp, FileQuestion, AlertTriangle, Clock, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getKnowledgeHealthSummary } from "@/lib/api"
import type { HealthSummary, MostRetrievedDoc, NeverRetrievedDoc, LowConfidenceDoc, StaleDoc } from "@/lib/api"
import { getFeedbackStats } from "@/lib/api"
import type { FeedbackStats } from "@/lib/api"
import { HealthPanel } from "@/components/health/HealthPanel"
import { HealthStatBar } from "@/components/health/HealthStatBar"
import { RetrievalChart } from "@/components/health/RetrievalChart"
import { FeedbackStatsPanel } from "@/components/health/FeedbackStatsPanel"

function formatDaysOld(createdAt: string): string {
  const days = Math.floor((Date.now() - new Date(createdAt).getTime()) / 86_400_000)
  return `${days}d old`
}

function ConfidenceChip({ similarity }: { similarity: number }) {
  const pct = Math.round(similarity * 100)
  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <div className="w-14 h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-amber-400 rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-amber-400 tabular-nums w-8 text-right">{pct}%</span>
    </div>
  )
}

function StaleChip({ daysStale }: { daysStale: number }) {
  const colorClass =
    daysStale > 365
      ? "bg-red-400/10 text-red-400"
      : daysStale > 180
        ? "bg-orange-400/10 text-orange-400"
        : "bg-amber-400/10 text-amber-400"
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 tabular-nums ${colorClass}`}>
      {daysStale}d stale
    </span>
  )
}

function StatBarSkeleton() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="ghost-border bg-card/50 rounded-lg p-4 space-y-2">
          <div className="animate-pulse bg-muted/30 h-3 w-20 rounded" />
          <div className="animate-pulse bg-muted/30 h-8 w-12 rounded" />
          <div className="animate-pulse bg-muted/30 h-3 w-24 rounded" />
        </div>
      ))}
    </div>
  )
}

function ChartSkeleton() {
  return (
    <div className="ghost-border bg-card/50 rounded-lg p-4 mb-6 space-y-3">
      <div className="animate-pulse bg-muted/30 h-4 w-56 rounded" />
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="animate-pulse bg-muted/30 h-3 w-32 rounded" />
          <div className="animate-pulse bg-muted/30 h-5 rounded flex-1" style={{ maxWidth: `${60 - i * 10}%` }} />
        </div>
      ))}
    </div>
  )
}

export function KnowledgeHealthPage() {
  const [summary, setSummary] = useState<HealthSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [feedbackStats, setFeedbackStats] = useState<FeedbackStats | null>(null)
  const [feedbackError, setFeedbackError] = useState<string | null>(null)

  const load = useCallback((isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError(null)
    setFeedbackError(null)
    Promise.allSettled([
      getKnowledgeHealthSummary(),
      getFeedbackStats(),
    ]).then(([healthResult, feedbackResult]) => {
      if (healthResult.status === "fulfilled") {
        setSummary(healthResult.value)
      } else {
        setError("Health metrics could not be loaded. Refresh to try again.")
      }
      if (feedbackResult.status === "fulfilled") {
        setFeedbackStats(feedbackResult.value)
      } else {
        setFeedbackError("Feedback stats could not be loaded. Refresh to try again.")
      }
    }).finally(() => {
      setLoading(false)
      setRefreshing(false)
    })
  }, [])

  useEffect(() => { load() }, [load])

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
      <div className="h-full overflow-y-auto">
        <div className="p-6 max-w-5xl mx-auto">
          <header className="mb-6">
            <div className="animate-pulse bg-muted/30 h-6 w-40 rounded mb-2" />
            <div className="animate-pulse bg-muted/30 h-4 w-56 rounded" />
          </header>
          <StatBarSkeleton />
          <ChartSkeleton />
          <div className="ghost-border bg-card/50 rounded-lg p-4 mb-6 space-y-3">
            <div className="animate-pulse bg-muted/30 h-4 w-40 rounded" />
            <div className="animate-pulse bg-muted/30 h-8 w-20 rounded" />
            <div className="animate-pulse bg-muted/30 h-10 rounded" />
            <div className="animate-pulse bg-muted/30 h-10 rounded" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto">
    <div className="p-6 max-w-5xl mx-auto">
      <header className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-headline font-bold text-xl">Library Health</h1>
          <p className="text-sm text-muted-foreground">Last 30 days · Stale threshold: 90 days</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 text-xs text-muted-foreground"
          onClick={() => load(true)}
          disabled={refreshing}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </header>

      {error && (
        <div className="bg-destructive/10 text-destructive text-sm px-4 py-2 rounded-lg mb-6">
          {error}
        </div>
      )}

      {summary && (
        <>
          <HealthStatBar
            totalDocuments={summary.total_documents}
            retrievedCount={summary.most_retrieved.length}
            flaggedCount={summary.low_confidence.length + summary.stale.length}
            unusedCount={summary.never_retrieved.length}
          />

          <RetrievalChart docs={summary.most_retrieved} />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <HealthPanel<MostRetrievedDoc>
              title="Most Retrieved"
              icon={TrendingUp}
              iconClassName="text-primary"
              documents={summary.most_retrieved}
              emptyHeading="All quiet"
              emptyBody="No documents were retrieved in the last 30 days."
              emptyIcon={TrendingUp}
              renderChip={(doc) => (
                <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary shrink-0 tabular-nums">
                  {doc.retrieval_count}×
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
                <span className="text-xs px-2 py-0.5 rounded-full bg-muted/40 text-muted-foreground shrink-0 tabular-nums">
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
              renderChip={(doc) => <ConfidenceChip similarity={doc.avg_similarity} />}
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
              renderChip={(doc) => <StaleChip daysStale={doc.days_stale} />}
              onRemove={(id) => removeFromPanel<StaleDoc>("stale", id)}
            />
          </div>
        </>
      )}

      {/* Feedback section — independent of health summary */}
      {feedbackError && (
        <div className="bg-destructive/10 text-destructive text-sm px-4 py-2 rounded-lg mb-6">
          {feedbackError}
        </div>
      )}
      {feedbackStats && (
        <FeedbackStatsPanel
          stats={feedbackStats}
          onRemoveDownvoted={(id) =>
            setFeedbackStats((prev) =>
              prev
                ? { ...prev, downvoted_documents: prev.downvoted_documents.filter((d) => d.document_id !== id) }
                : prev
            )
          }
        />
      )}
    </div>
    </div>
  )
}
