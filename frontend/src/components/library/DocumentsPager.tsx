/**
 * Phase 217.1 plan 06 (LIB-01 / WR-04) — client-side pager under the Documents table.
 *
 * `GET /documents` is unpaginated (`documents.py:726-760`), so the denominator is real
 * client-side. Bounded: PostgREST's default max-rows ceiling is 1000 (`reembed_service.py:
 * 255-258`'s named trap). When the loaded list is at or above that ceiling, the pager
 * renders a "list may be larger" honest arm instead of a confidently-wrong exact total.
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

/** PostgREST's default max-rows ceiling — above this the loaded list is suspect. */
const ROW_CAP = 1000

const ROW_OPTIONS = [10, 25, 50, 100]

interface Props {
  /** Total number of rows currently loaded (the client-side denominator). */
  total: number
  /** The current 0-based page offset (row index of the first visible row). */
  offset: number
  /** Rows per page. */
  limit: number
  onChange: (offset: number, limit: number) => void
}

export function DocumentsPager({ total, offset, limit, onChange }: Props) {
  const start = total === 0 ? 0 : offset + 1
  const end = Math.min(offset + limit, total)
  const canGoBack = offset > 0
  const canGoForward = offset + limit < total

  // ⭐ WR-04 / T-217.1-11a — the honest cap arm.
  const capped = total >= ROW_CAP

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
        <AnimatedNumber value={start} />–<AnimatedNumber value={end} /> of {capped ? <><AnimatedNumber value={total} />+</> : <AnimatedNumber value={total} />}
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

      {capped && (
        <span className="w-full text-center text-muted-foreground/70">
          The list may be larger than shown — the library has <AnimatedNumber value={total} />+ rows.
        </span>
      )}
    </div>
  )
}
