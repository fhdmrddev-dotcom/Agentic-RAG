/**
 * Phase 271 plan 02 (D-03 / UI-SPEC S4) — the meta line above Find results.
 *
 * In order: the count, "Sorted by" + the sort select, a decorative dot + the deterministic line,
 * the optional scope line, and "Clear search" pushed right.
 *
 * ⛔ THIS IS THE ONLY COUNT ON SCREEN IN FIND. The filter bar's own match count is suppressed in this
 * mode, so two numbers can never disagree. The count is the SERVER's total, never a page length.
 *
 * ⛔ THE SELECT RE-REQUESTS FROM THE SERVER; THE CLIENT NEVER RE-SORTS. This component only reports
 * the chosen value. The stated sort is the server's order, so a client re-sort of one page would
 * make the label lie about every other page.
 *
 * Props only: the sort options (value + label) are passed in, so this file imports no Find state
 * and fetches nothing.
 */
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

export interface FindMetaLineProps {
  /** The server's total for the active search. `null` before the first answer. */
  total: number | null
  loading: boolean
  sort: string
  sortOptions: ReadonlyArray<{ value: string; label: string }>
  onSortChange: (value: string) => void
  /** True when no Folder condition is set, so the search spans every visible folder. */
  showScopeLine: boolean
  onClearSearch: () => void
}

export function FindMetaLine({
  total,
  loading,
  sort,
  sortOptions,
  onSortChange,
  showScopeLine,
  onClearSearch,
}: FindMetaLineProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <span aria-live="polite">
        {loading ? (
          <span role="status">Searching…</span>
        ) : total !== null ? (
          <span
            className={cn(
              "font-semibold tabular-nums",
              total === 0 ? "text-warning" : "text-foreground",
            )}
          >
            {total === 1 ? "1 document" : `${total} documents`}
          </span>
        ) : null}
      </span>

      <span aria-hidden="true">·</span>
      <span>Sorted by</span>
      <Select value={sort} onValueChange={onSortChange}>
        <SelectTrigger aria-label="Sort results" className="h-8 w-auto gap-1 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {sortOptions.map((option) => (
            <SelectItem key={option.value} value={option.value} className="text-xs">
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <span aria-hidden="true">·</span>
      <span className="inline-flex items-center gap-1.5">
        <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-success" />
        <span>Exact match on fields. No AI ranking.</span>
      </span>

      {showScopeLine && (
        <>
          <span aria-hidden="true">·</span>
          <span>Searching every folder you can see.</span>
        </>
      )}

      <button
        type="button"
        onClick={onClearSearch}
        className="ml-auto text-primary hover:underline focus:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded"
      >
        Clear search
      </button>
    </div>
  )
}
