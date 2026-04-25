import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight } from "lucide-react"

interface Props {
  offset: number
  limit: number
  total: number
  onChange: (offset: number) => void
}

export function PaginationControls({ offset, limit, total, onChange }: Props) {
  const start = total === 0 ? 0 : offset + 1
  const end = Math.min(offset + limit, total)
  const canGoBack = offset > 0
  const canGoForward = offset + limit < total

  if (total === 0) return null

  return (
    <div className="flex items-center justify-center gap-3 py-3">
      <Button
        variant="outline"
        size="sm"
        className="h-8 gap-1 text-xs"
        onClick={() => onChange(Math.max(0, offset - limit))}
        disabled={!canGoBack}
      >
        <ChevronLeft className="h-3.5 w-3.5" />
        Previous
      </Button>
      <span className="text-xs text-muted-foreground tabular-nums">
        Showing {start}–{end} of {total}
      </span>
      <Button
        variant="outline"
        size="sm"
        className="h-8 gap-1 text-xs"
        onClick={() => onChange(offset + limit)}
        disabled={!canGoForward}
      >
        Next
        <ChevronRight className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
}
