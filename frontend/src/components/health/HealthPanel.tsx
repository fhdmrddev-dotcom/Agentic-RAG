import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ChevronDown, ChevronUp } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { HealthDocumentRow } from "./HealthDocumentRow"
import { HealthEmptyState } from "./HealthEmptyState"

const DEFAULT_MAX_VISIBLE = 5
const BACKEND_LIMIT = 10

interface BaseDoc {
  document_id: string
  filename: string
  folder_id: string | null
}

interface Props<T extends BaseDoc> {
  title: string
  icon: LucideIcon
  iconClassName: string
  documents: T[]
  emptyHeading: string
  emptyBody: string
  emptyIcon: LucideIcon
  emptyVariant?: "positive" | "neutral"
  renderChip: (doc: T) => React.ReactNode
  onRemove: (id: string) => void
  maxVisible?: number
}

export function HealthPanel<T extends BaseDoc>({
  title,
  icon: Icon,
  iconClassName,
  documents,
  emptyHeading,
  emptyBody,
  emptyIcon,
  emptyVariant = "positive",
  renderChip,
  onRemove,
  maxVisible = DEFAULT_MAX_VISIBLE,
}: Props<T>) {
  const [expanded, setExpanded] = useState(false)

  const hasMore = documents.length > maxVisible
  const visible = expanded ? documents : documents.slice(0, maxVisible)
  const hiddenCount = documents.length - maxVisible
  const atBackendLimit = documents.length >= BACKEND_LIMIT

  return (
    <Card className="ghost-border bg-card/50 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="flex items-center gap-2">
          <Icon className={`h-4 w-4 ${iconClassName}`} />
          <CardTitle className="text-base font-headline font-bold">{title}</CardTitle>
        </div>
        <span className="text-xs text-muted-foreground">
          {documents.length} {documents.length === 1 ? "document" : "documents"}
        </span>
      </CardHeader>
      <CardContent className="p-0">
        {documents.length === 0 ? (
          <HealthEmptyState icon={emptyIcon} heading={emptyHeading} body={emptyBody} variant={emptyVariant} />
        ) : (
          <>
            <div className="divide-y divide-border/30">
              {visible.map((doc) => (
                <HealthDocumentRow
                  key={doc.document_id}
                  doc={doc}
                  metricChip={renderChip(doc)}
                  onRemove={onRemove}
                />
              ))}
            </div>

            {hasMore && (
              <div className="px-4 py-2 border-t border-border/30">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full h-7 text-xs text-muted-foreground hover:text-foreground gap-1"
                  onClick={() => setExpanded(!expanded)}
                >
                  {expanded ? (
                    <>
                      <ChevronUp className="h-3 w-3" />
                      Show less
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-3 w-3" />
                      Show {hiddenCount} more
                    </>
                  )}
                </Button>
              </div>
            )}

            {atBackendLimit && expanded && (
              <p className="text-xs text-muted-foreground text-center pb-3 px-4">
                Showing top {BACKEND_LIMIT} — your library may contain more.
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
