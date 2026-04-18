import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { LucideIcon } from "lucide-react"
import { HealthDocumentRow } from "./HealthDocumentRow"
import { HealthEmptyState } from "./HealthEmptyState"

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
  renderChip: (doc: T) => React.ReactNode
  onRemove: (id: string) => void
}

export function HealthPanel<T extends BaseDoc>({
  title,
  icon: Icon,
  iconClassName,
  documents,
  emptyHeading,
  emptyBody,
  emptyIcon,
  renderChip,
  onRemove,
}: Props<T>) {
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
          <HealthEmptyState icon={emptyIcon} heading={emptyHeading} body={emptyBody} />
        ) : (
          <div className="divide-y divide-border/30">
            {documents.map((doc) => (
              <HealthDocumentRow
                key={doc.document_id}
                doc={doc}
                metricChip={renderChip(doc)}
                onRemove={onRemove}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
