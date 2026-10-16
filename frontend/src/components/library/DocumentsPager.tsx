/**
 * Phase 217.1 plan 06 (LIB-01 / WR-04) — the pager under the Documents table.
 *
 * ⭐ Phase 284-03 (D-09): `GET /documents` pages on the server and answers the EXACT total
 * (`{documents, total, offset, limit}`), as do the view / filter resolves and Find. Every total
 * this pager is handed is therefore exact, and the 1000-row "may be larger" arm that
 * existed because the old whole-list read was cut at PostgREST's ceiling is DELETED — no caller
 * can produce it any more. Totals are grouped (`10,000`, UI-SPEC Typography).
 *
 * Extends `PaginationControls.tsx`'s prev/next/page-count logic with ONE new affordance:
 * a `Rows per page` `Select` (default 25).
 */
import {  } from "react"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { AnimatedNumber } from "@/components/ui/AnimatedNumber"

const ROW_OPTIONS = [10, 25, 50, 100]

interface Props {
  /** The server's exact total for this list. */
  total: number
  /** The current 0-based page offset (row index of the first visible row). */
  offset: number
  /** Rows per page. */
  limit: number
  onChange: (offset: number, limit: number) => void
  /** No-op since 284 (D-09); removed when DocumentsFindBody next changes. */
  exact?: boolean
}

export function DocumentsPager({ total, offset, limit, onChange }: Props) {
  const start = total === 0 ? 0 : offset + 1
  const end = Math.min(offset + limit, total)
  const canGoBack = offset > 0
  const canGoForward = offset + limit < total

  if (total === 0) return null

  return (
    <div
      data-testid="documents-pager"
      className="flex flex-wrap items-center justify-center gap-3 py-3 text-xs text-muted-foreground"
    >
      <div className="flex items-center gap-1.5">
        <span>Rows per page:</span>
        <Select
          value={String(limit)}
          onValueChange={(v) => onChange(0, parseInt(v, 10))}
        >
          <SelectTrigger className="h-7 w-[72px] text-xs" data-testid="rows-per-page-select">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ROW_OPTIONS.map((n) => (
              <SelectItem key={n} value={String(n)}>
                {n}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <span className="tabular-nums">
        <AnimatedNumber value={start.toLocaleString()} />–<AnimatedNumber value={end.toLocaleString()} /> of{" "}
        <AnimatedNumber value={total.toLocaleString()} />
      </span>

      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          className="h-7 gap-1 text-xs"
          onClick={() => onChange(Math.max(0, offset - limit), limit)}
          disabled={!canGoBack}
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-7 gap-1 text-xs"
          onClick={() => onChange(offset + limit, limit)}
          disabled={!canGoForward}
        >
          Next
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>

    </div>
  )
}
