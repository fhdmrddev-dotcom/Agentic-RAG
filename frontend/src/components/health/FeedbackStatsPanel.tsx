import { ThumbsUp } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { HealthDocumentRow } from "./HealthDocumentRow"
import { HealthEmptyState } from "./HealthEmptyState"
import type { FeedbackStats, DownvotedDocument } from "@/lib/api"

interface Props {
  stats: FeedbackStats
  onRemoveDownvoted: (id: string) => void
}

export function FeedbackStatsPanel({ stats, onRemoveDownvoted }: Props) {
  const positivePercent = Math.round(stats.positive_rate * 100)
  const hasRatings = stats.total_ratings > 0
  const hasDownvoted = stats.downvoted_documents.length > 0

  return (
    <Card className="ghost-border bg-card/50 shadow-sm mb-6">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="flex items-center gap-2">
          <ThumbsUp className="h-4 w-4 text-primary" />
          <CardTitle className="text-base font-headline font-bold">User Feedback</CardTitle>
        </div>
        <span className="text-xs text-muted-foreground">
          {stats.total_ratings} {stats.total_ratings === 1 ? "rating" : "total ratings"}
        </span>
      </CardHeader>

      <CardContent className="p-0">
        {!hasRatings ? (
          <HealthEmptyState
            icon={ThumbsUp}
            heading="No feedback yet"
            body="Thumbs up and down ratings will appear here once users start rating responses."
          />
        ) : (
          <>
            {/* Positive rate stat */}
            <div className="flex items-baseline gap-2 mb-4 px-4 pt-2">
              <span className="text-3xl font-bold font-headline tabular-nums leading-none text-primary">
                {positivePercent}%
              </span>
              <span className="text-sm font-medium text-muted-foreground">positive rating</span>
              <span className="text-xs font-medium text-muted-foreground">
                all-time &middot; {stats.total_ratings} total ratings
              </span>
            </div>

            {/* Most downvoted section heading */}
            <p className="text-xs font-medium text-muted-foreground px-4 pb-2">
              Most downvoted (last 30 days)
            </p>

            {/* Downvoted documents list or empty state */}
            {!hasDownvoted ? (
              <HealthEmptyState
                icon={ThumbsUp}
                heading="No downvoted documents"
                body="No documents have been downvoted in the last 30 days."
              />
            ) : (
              <div className="divide-y divide-border/30">
                {stats.downvoted_documents.map((doc: DownvotedDocument) => (
                  <HealthDocumentRow
                    key={doc.document_id}
                    doc={doc}
                    metricChip={
                      <span className="text-xs px-2 py-0.5 rounded-full bg-destructive/10 text-destructive shrink-0 tabular-nums">
                        {doc.downvote_count} &#8595;
                      </span>
                    }
                    onRemove={onRemoveDownvoted}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
