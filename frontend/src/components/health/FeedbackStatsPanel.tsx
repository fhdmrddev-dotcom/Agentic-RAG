import { useState } from "react"
import { ThumbsUp } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { HealthDocumentRow } from "./HealthDocumentRow"
import { HealthEmptyState } from "./HealthEmptyState"
import { HealthScoreGauge } from "./HealthScoreGauge"
import { PaginationControls } from "./PaginationControls"
import type { FeedbackStats, DownvotedDocument } from "@/lib/api"

interface Props {
  stats: FeedbackStats
  onRemoveDownvoted: (id: string) => void
}

const DOWNVOTED_LIMIT = 5

export function FeedbackStatsPanel({ stats, onRemoveDownvoted }: Props) {
  const positivePercent = Math.round(stats.positive_rate * 100)
  const hasRatings = stats.total_ratings > 0
  const hasDownvoted = stats.downvoted_documents.length > 0

  const [offset, setOffset] = useState(0)
  const totalDownvoted = stats.downvoted_documents.length
  const pagedDownvoted = stats.downvoted_documents.slice(offset, offset + DOWNVOTED_LIMIT)

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
            heading="No feedback yet"
            body="Thumbs up and down ratings will appear here once users start rating responses."
            variant="neutral"
          />
        ) : (
          <>
            {/* Positive rate gauge */}
            <div className="flex items-center gap-4 px-4 pt-4 pb-2">
              <HealthScoreGauge score={positivePercent} size="sm" />
              <div className="flex flex-col">
                <span className="text-sm font-medium text-muted-foreground">positive rating</span>
                <span className="text-xs text-muted-foreground">
                  all-time · {stats.total_ratings} total ratings
                </span>
              </div>
            </div>

            {/* Most downvoted section heading */}
            <p className="text-xs font-medium text-muted-foreground px-4 pb-2 pt-2">
              Most downvoted (last 30 days)
            </p>

            {/* Downvoted documents list or empty state */}
            {!hasDownvoted ? (
              <HealthEmptyState
                heading="All clear — no negative feedback in the last 30 days"
                body="Your users are happy with the responses."
                variant="positive"
              />
            ) : (
              <>
                <div className="divide-y divide-border/30">
                  {pagedDownvoted.map((doc: DownvotedDocument) => (
                    <HealthDocumentRow
                      key={doc.document_id}
                      doc={doc}
                      metricChip={
                        <span className="text-xs px-2 py-0.5 rounded-full bg-destructive/10 text-destructive shrink-0 tabular-nums">
                          {doc.downvote_count} &#8595;
                        </span>
                      }
                      onRemove={(id) => {
                        onRemoveDownvoted(id)
                        // Reset to first page if current page becomes empty
                        const newTotal = totalDownvoted - 1
                        if (offset >= newTotal && offset > 0) {
                          setOffset(Math.max(0, offset - DOWNVOTED_LIMIT))
                        }
                      }}
                    />
                  ))}
                </div>
                {totalDownvoted > DOWNVOTED_LIMIT && (
                  <PaginationControls
                    offset={offset}
                    limit={DOWNVOTED_LIMIT}
                    total={totalDownvoted}
                    onChange={setOffset}
                  />
                )}
              </>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
